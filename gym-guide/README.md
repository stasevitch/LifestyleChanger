# Gym Guide

For gym beginners who don't know what a machine is called or how to use it. Installable web app (PWA); no server, no account, works offline.

## Step 1: what's this machine? (done)
- **Identify by two questions**: how you use it (sitting, lying, standing, kneeling, cardio), then what moves (push, pull, squeeze, curl, legs, body bends). Matching machines are shown as pictures to compare with what's in front of you.
- **All machines**: browse by muscle group (chest, back, shoulders, arms, legs, glutes, core, cardio) or search by name, nickname ("butterfly", "Gravitron") or muscle.
- **Machine page**: drawing with the moving part in orange, other names, muscles, how to recognise it, set-up, how to do it, what to avoid, other uses, and a beginner starting point.
- 24 machines: 20 strength machines and 4 cardio machines. The catalog is the `MACHINES` list in `src/app.html`; the drawings are built from small shape helpers in the same file.

## Planned
- Photo recognition: take a picture, get the matching machine page.
- Beginner programs that link to these machine pages, and a workout log.
- Russian translation, like BP Diary.

## Project layout
- `src/app.html`: the whole app (markup, styles, script, machine catalog).
- `public/`: manifest, service worker, icons (`make_icons.py` redraws them).
- `build.py`: produces `dist/`.
- `test/e2e.js`: Playwright walk-through on an emulated iPhone (`node test/e2e.js <screenshot-dir> [light|dark]`).

## Build and run
```
python3 build.py
python3 -m http.server -d dist 8000
```

General guidance, not medical advice. Ask gym staff to show you a machine the first time.
