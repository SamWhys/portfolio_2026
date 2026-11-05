# AI Workshop — Case Study Presentation

Offline, double-click-to-run talk engine.

## Run it
Open `index.html` in any modern browser. Works straight from the filesystem
(`file://`) — **no server, no build step**.

## How it's built
- Vanilla HTML/CSS/JS. No framework, no bundler, no ES modules.
- Classic `<script src>` only, loaded in order. No CDN / network calls at runtime.
- `assets/js/data.js` — the content layer (`TALK` + `CASE_STUDIES`).
- `assets/js/app.js` — the engine (hub, and later: nav, reveal, reset).
- `assets/css/styles.css` — fixed light, high-contrast projector theme.
- `assets/vendor/` — vendored libraries (offline). `assets/cs1..cs3/` — per-study media.

## Status
Scaffold: offline shell + data model + placeholder hub. Navigation, reveal, and
reset come in later steps.
