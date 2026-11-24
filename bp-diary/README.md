# BP Diary

Personal blood pressure diary. Installable web app (PWA) for iPhone and Android; no server, data stays on the device.

## Features (Phase 1)
- Morning and evening sessions; several readings per session are averaged (2 readings, 1 minute apart is the usual protocol). Extra readings any time.
- Pulse, arm, position, irregular-heartbeat flag, tags (coffee, alcohol, smoked, stress, exercise, poor sleep, salty meal, meds, pain), note.
- ACC/AHA adult categories with colour coding and a severe-reading warning.
- Trends: 7 / 30 / 90 days / all, daily-average chart, morning vs evening, category mix, tag patterns.
- Doctor report (print or save as PDF), CSV export, JSON backup and restore.
- CSV import from OMRON connect and other monitor apps (auto-detects columns, delimiters, date order; skips duplicates).
- Date format (device, DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD) and 12/24-hour time.
- Camera scan: photograph any blood pressure monitor (any brand) and the values are filled in for you to confirm. Uses Claude vision with your own Anthropic API key, stored only on the phone.
- Works offline once installed (camera scan needs internet).

## Project layout
- `src/app.html` – the whole app (markup, styles, script). Edit this.
- `public/` – manifest, service worker, icons.
- `public/vendor/` – the official Anthropic JS SDK bundled as one browser module (rebuild with `vendor-sdk.sh <version>`).
- `build.py` – produces `dist/` (the deployable site). `make_icons.py` redraws icons.
- `test/e2e.js` – Playwright end-to-end check on an emulated iPhone.
- `test/scan.js` – camera-scan flow against a mocked API (no key needed).

## Build and run
```
python3 build.py
python3 -m http.server -d dist 8000
```
Deploy `dist/` to any static host (GitHub Pages, Netlify, Vercel). Open it in Safari on iPhone, then Share > Add to Home Screen.

Not medical advice. Categories follow the 2017 ACC/AHA guideline; a doctor may set different targets.
