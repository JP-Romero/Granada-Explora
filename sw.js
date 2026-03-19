// ═══════════════════════════════════════════════════════
//  Granada Explora — Service Worker v3
//
//  Estrategias:
//  · INSTALL   → pre-cachear assets locales + tiles del mapa de Granada
//  · ACTIVATE  → limpiar cachés antiguas
//  · FETCH     → cache-first (local) | network-first (CDN/imágenes)
//               → fallback a offline.html si no hay red ni caché
// ═══════════════════════════════════════════════════════

const CACHE_STATIC = 'granada-static-v9';  // HTML, manifest, íconos
const CACHE_TILES  = 'granada-tiles-v9';   // Tiles del mapa CartoDB
const CACHE_IMAGES = 'granada-images-v9';  // Imágenes de lugares (ImageKit)
const CACHE_CDN    = 'granada-cdn-v9';     // Leaflet, Lucide, Tailwind, Fonts
const OFFLINE_URL  = 'offline.html';

// ── Assets locales críticos ─────────────────────────────────────────────────
const STATIC_ASSETS = [
    './',
    'index.html',
    'offline.html',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

// ── Tiles de Granada, Nicaragua ─────────────────────────────────────────────
// Bounding box con margen: cubre centro histórico + isletas + alrededores
const GRANADA_BOUNDS = {
    north: 11.960,
    south: 11.895,
    west:  -86.010,
    east:  -85.895
};
// Zooms 13-15 (~80 tiles). Zoom 16+ genera demasiados tiles (200+).
const TILE_ZOOMS = [13, 14, 15];

function latLngToTileXY(lat, lng, zoom) {
    const n      = Math.pow(2, zoom);
    const x      = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y      = Math.floor(
        (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
    );
    return { x, y };
}

function buildGranadaTileURLs() {
    const urls = [];
    for (const zoom of TILE_ZOOMS) {
        const tl = latLngToTileXY(GRANADA_BOUNDS.north, GRANADA_BOUNDS.west, zoom);
        const br = latLngToTileXY(GRANADA_BOUNDS.south, GRANADA_BOUNDS.east, zoom);
        for (let x = tl.x; x <= br.x; x++) {
            for (let y = tl.y; y <= br.y; y++) {
                urls.push(`https://a.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`);
            }
        }
    }
    console.log(`[SW] Tiles a pre-cachear: ${urls.length}`);
    return urls;
}

// ── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            // Assets estáticos: fallo aquí cancela la instalación
            caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS)),

            // Tiles: cada tile falla de forma independiente (no bloquea install)
            caches.open(CACHE_TILES).then(cache =>
                Promise.allSettled(
                    buildGranadaTileURLs().map(url =>
                        fetch(url, { mode: 'cors' })
                            .then(res => { if (res.ok) cache.put(url, res); })
                            .catch(() => {})
                    )
                )
            )
        ]).then(() => {
            console.log('[SW] Install OK');
            return self.skipWaiting();
        })
    );
});

// ── ACTIVATE: limpiar cachés obsoletas ──────────────────────────────────────
self.addEventListener('activate', event => {
    const VALID = [CACHE_STATIC, CACHE_TILES, CACHE_IMAGES, CACHE_CDN];
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => !VALID.includes(k)).map(k => {
                    console.log('[SW] Eliminando caché obsoleta:', k);
                    return caches.delete(k);
                })
            ))
            .then(() => {
                console.log('[SW] Activate OK');
                return self.clients.claim();
            })
    );
});

// ── FETCH: enrutador de estrategias ─────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

    if (url.hostname.includes('cartocdn.com')) {
        event.respondWith(tileStrategy(request));
        return;
    }
    if (url.hostname.includes('imagekit.io')) {
        event.respondWith(imageStrategy(request));
        return;
    }
    if (isCDN(url)) {
        event.respondWith(networkFirstStrategy(request, CACHE_CDN));
        return;
    }
    event.respondWith(cacheFirstStrategy(request));
});

// ── Clasificadores ───────────────────────────────────────────────────────────
function isCDN(url) {
    return ['cdn.tailwindcss.com','unpkg.com','fonts.googleapis.com',
            'fonts.gstatic.com','cdnjs.cloudflare.com']
        .some(h => url.hostname.includes(h));
}

// ── Estrategias ──────────────────────────────────────────────────────────────

// Cache-first → red → offline.html para navegación
async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_STATIC);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        if (request.mode === 'navigate') {
            return (await caches.match(OFFLINE_URL)) ||
                new Response('Sin conexión', { status: 503 });
        }
        return new Response('Sin conexión', { status: 503 });
    }
}

// Network-first → caché
async function networkFirstStrategy(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
            return (await caches.match(OFFLINE_URL)) ||
                new Response('Sin conexión', { status: 503 });
        }
        return new Response('Sin conexión', { status: 503 });
    }
}

// Tiles: cache-first normalizando subdominios a/b/c → 'a'
async function tileStrategy(request) {
    const normalizedURL = request.url.replace(
        /https:\/\/[abc]\.basemaps\.cartocdn/,
        'https://a.basemaps.cartocdn'
    );
    const key = new Request(normalizedURL, { mode: 'cors' });

    const cached = await caches.match(key);
    if (cached) return cached;

    try {
        const response = await fetch(request, { mode: 'cors' });
        if (response.ok) {
            const cache = await caches.open(CACHE_TILES);
            cache.put(key, response.clone());
        }
        return response;
    } catch {
        return new Response('Tile no disponible', { status: 503 });
    }
}

// Imágenes: network-first, placeholder SVG si no hay caché
async function imageStrategy(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_IMAGES);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;

        // SVG placeholder cuando la imagen no está cacheada
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="#FDF3E3"/>
                <text x="50%" y="44%" dominant-baseline="middle" text-anchor="middle"
                    font-size="32">📷</text>
                <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle"
                    font-family="sans-serif" font-size="12" fill="#9CA3AF">
                    Imagen no disponible offline
                </text>
            </svg>`,
            { status: 200, headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
}
