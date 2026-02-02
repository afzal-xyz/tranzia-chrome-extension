# Tranzia Chrome Extension

A Chrome extension that overlays safety scores directly on Google Maps directions.

## Features

- **Automatic Detection**: Detects when you're viewing directions on Google Maps
- **Safety Scores**: Shows safety scores for each route option
- **Safest Route Highlight**: Marks the safest route when comparing alternatives
- **Click for Details**: Click any badge to see the full safety report on Tranzia

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `tranzia-extension` folder
5. The extension is now installed!

## Usage

1. Open [Google Maps](https://www.google.com/maps)
2. Search for directions between two locations
3. Safety badges will automatically appear next to each route option
4. Green = Low Risk, Amber = Moderate, Red = High Risk
5. Click any badge for the full Tranzia report

## Files

```
tranzia-extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker (API calls, caching)
├── content.js         # Injected into Google Maps pages
├── styles.css         # Badge styling
├── popup/
│   ├── popup.html     # Extension popup
│   ├── popup.js       # Popup logic
│   └── popup.css      # Popup styling
└── icons/
    ├── icon16.png     # Toolbar icon
    ├── icon48.png     # Extensions page
    └── icon128.png    # Chrome Web Store
```

## Supported Maps

- Google Maps (www.google.com/maps)

## Coming Soon

- Apple Maps web support
- Compare all route alternatives
- Time-of-day safety variations

## API

This extension uses the Tranzia `/v1/score-url` API endpoint.

## License

Proprietary - Tranzia © 2026
