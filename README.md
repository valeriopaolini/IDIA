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
- Rolling targets over the last N days.
- Immediate undo after each registration.
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

This app is static HTML, CSS, and JavaScript. It can be published directly from the repository root on the `main` branch.

Expected project URL:

```text
https://valeriopaolini.github.io/IDIA/
```

Because IDIA uses relative paths, it works from a GitHub Pages project path such as `/IDIA/`.

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
