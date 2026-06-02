# IDIA - I Did It Again

IDIA is a small local-first PWA for privately tracking personal events through circular buttons. It is intentionally not a streak, badge, or productivity-gamification app.

The guiding idea is simple:

> record personal events, do not build a morality of productivity.

## Features

- Mobile-first installable PWA for iPhone and iPad.
- No account, no backend, no analytics, no telemetry.
- Data stored locally in the browser with IndexedDB.
- Offline app shell through a service worker.
- Manual JSON export and import.
- Deduplicated imports by UUID.
- Count, event, and rating button types.
- Icon-centric bubbles with stored `iconId` and `themeId`.
- Curated in-app icon catalog with keyword suggestions.
- Rolling targets over the last N days.
- Immediate undo after each registration.
- Discovery / Statistics view with local SVG charts.
- 90-day synthetic demo dataset for trying pattern discovery.
- Per-button reset, demo reset, and "keep buttons, delete logs" reset.
- Philosophy / About page.
- Light and dark mode.

## Run locally

From this directory:

```bash
python3 -m http.server 5174
```

Then open:

```text
http://localhost:5174/
```

## GitHub Pages

This app is static HTML, CSS, and JavaScript. The public deployment is served through the `gh-pages` branch.

Expected project URL:

```text
https://valeriopaolini.github.io/IDIA/
```

Because IDIA uses relative paths, it works from a GitHub Pages project path such as `/IDIA/`.

## Discovery / Statistics

The Discovery view is designed for observation, not scoring. It lets you:

- choose a primary button;
- choose a 7, 30, or 90 day range;
- pick charts suggested by the button type;
- optionally compare with a second button;
- read short, cautious insights.

Implemented charts:

- Timeline for count, event, and rating logs.
- Rolling frequency for count and event buttons.
- Rolling average for rating buttons.
- Raster map across recent days.
- Hour-of-day distribution.
- Gap between events.
- Value distribution for ratings.
- Overlay comparison.
- Days with vs without comparison.
- 24h-before-event summary for event buttons.

Overlay and comparison views deliberately use cautious language. They can show a possible association, but do not claim causality.

## Demo data

On first launch, IDIA seeds a 90-day synthetic dataset with 18 buttons covering count, event, and rating examples. The dataset is adult and urban in tone, with recognizable patterns such as coffee in the morning, drinks on weekends, sleep quality after night out, and mood/energy variations.

The demo exists so the Discovery view is useful immediately. It is not a recommendation about what to track.

Reset options:

- `Reset demo data`: replaces local data with the synthetic demo again.
- `Keep buttons, delete logs`: keeps the schema and clears all observations.
- `Delete everything`: clears local buttons and logs.
- `Reset data` inside a button: clears only that button's logs.
- `Duplicate` inside a button: copies the button configuration without data.

## Privacy model

IDIA stores user-created buttons and log entries in IndexedDB on the user's device/browser profile. The app does not send those records to GitHub, a server, an analytics provider, or a sync service.

What leaves the device during normal use:

- Browser requests for static app files, such as `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, and icons.
- Standard web server request metadata visible to the host, such as IP address, user agent, requested URL, and timestamps.

What does not leave the device:

- Button names created by the user.
- Event timestamps recorded by the user.
- Rating values.
- Targets.
- Imported/exported JSON contents, unless the user manually stores or shares the backup file somewhere outside the device.

## Service worker

The service worker runs inside the user's browser, scoped to this web app. It caches the static app shell so IDIA can open offline after the first successful load.

It does not run on GitHub servers. GitHub Pages only serves the static files.

## Data model

### Button

- `id`: UUID
- `name`: display name
- `type`: `count`, `event`, or `rating`
- `ratingScale`: optional, `5`, `10`, or `100`
- `color`: marble color
- `iconId`: internal icon identifier, such as `coffee`, `moon`, or `brain-circuit`
- `themeId`: visual theme identifier, such as `amber`, `blue`, or `violet`
- `icon`: optional placeholder for future versions
- `size`: `small`, `medium`, or `large`
- `target`: optional rolling target
- `createdAt`
- `updatedAt`
- `archived`

### LogEntry

- `id`: UUID
- `buttonId`: related button UUID
- `timestamp`: event timestamp
- `type`: `count`, `event`, or `rating`
- `value`: optional rating value
- `note`: optional note
- `createdAt`
- `editedAt`: optional edit timestamp

## Backup

Use the export button to download a complete JSON backup. On iPhone or iPad, save it manually to Files, iCloud Drive, or another location you choose.

Import merges the JSON backup into the local IndexedDB database and skips records with UUIDs that already exist.
