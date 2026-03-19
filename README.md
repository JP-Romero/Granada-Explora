# Granada Explora - PWA

Granada Explora is an interactive Progressive Web App (PWA) designed to guide tourists through the historical and natural wonders of Granada, Nicaragua. Known as "The Great Sultana," Granada is a jewel of colonial architecture and natural beauty, and this app makes it easier to explore.

## Core Features

- **Interactive Map**: View key tourist attractions across Granada with categorized markers.
- **Offline Mode**: Access critical information even without an internet connection, thanks to advanced service worker caching.
- **Categorized Places**: Easily find locations based on your interests:
  - **Cultura**: Historic landmarks and museums.
  - **Naturaleza**: Lakes, volcanoes, and nature reserves.
  - **Comida**: Local gastronomy and dining hotspots.
  - **Hoteles**: Recommended accommodations.
  - **Actividades**: Tours and local experiences.
- **Personalized Routes**: Pre-designed itineraries to make the most of your visit.
- **Favorites**: Save your must-see places for quick access later.

## Technologies Used

- **Tailwind CSS**: For a modern, responsive user interface.
- **Leaflet.js**: For interactive map functionality.
- **Service Workers**: To enable offline capabilities and asset caching.
- **Lucide Icons**: For clean and modern iconography.

## Setup and Installation

As a PWA, Granada Explora can be installed directly on your mobile device or used as a standard website.

### For Developers:

1. Clone this repository:
   ```bash
   git clone https://github.com/JP-Romero/Granada-Explora.git
   ```
2. Open `index.html` in any modern web browser or host it using a simple static file server.

### For Users:

1. Navigate to the app URL in your mobile browser.
2. Select "Add to Home Screen" from your browser's menu to install it as an app.

## Project Structure

- `index.html`: Main application entry point and UI.
- `manifest.json`: PWA configuration for installation and app behavior.
- `sw.js`: Service worker for offline functionality and caching strategy.
- `offline.html`: Fallback page for when no connection is available.
- `icons/`: App icons in various sizes.
