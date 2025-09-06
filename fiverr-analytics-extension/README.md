# Fiverr Analytics Overlay (MV3)

Chrome extension that injects a CSP-safe overlay on Fiverr pages, parses gigs resiliently, computes keyword analytics, shows SVG charts, and supports JSON/CSV export.

## Features
- Resilient parser with selector fallbacks and MutationObserver updates
- Keyword frequency analytics with avg price/rating
- CSP-compliant charts using inline SVG (no external libs, no eval)
- JSON/CSV export
- Popup to toggle overlay and auto-update

## Install (Developer Mode)
1. Open Chrome → Extensions → Enable Developer Mode.
2. Load Unpacked → select the `fiverr-analytics-extension` directory.
3. Navigate to a Fiverr search or gig page; use the popup to toggle the overlay.

## MV3 & CSP
- No inline scripts; popup uses external `popup.js` and `popup.css`.
- Content scripts are declared in `manifest.json` and run at `document_idle`.
- Charts are created with SVG DOM APIs; no canvas or remote assets.
- Only `https://www.fiverr.com/*` is matched.

## Structure
- `src/background/service_worker.js`: settings storage and messaging
- `src/content/parser.js`: robust parsing for search and gig pages
- `src/content/analytics.js`: keyword aggregation
- `src/content/charts.js`: SVG bar/donut charts
- `src/content/exporter.js`: download JSON/CSV
- `src/content/overlay.js`: Shadow DOM overlay UI
- `src/content/content.js`: glue logic, observer, messaging
- `src/popup/*`: popup UI

## Notes
- Icons are omitted; add under `src/assets/` and update manifest if desired.
- Extend parser selectors as Fiverr UI evolves.