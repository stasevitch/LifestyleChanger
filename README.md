# LifestyleChanger

Tools that help people live healthier: track blood pressure, find their way around the gym, cut down on alcohol and smoking, and eat better, backed by real, sourced facts.

| Folder | What it is | Status |
|---|---|---|
| `bp-diary/` | Blood pressure diary (installable web app) | Phase 1 done |
| `gym-guide/` | Gym guide for beginners: identify a machine and learn how to use it (installable web app) | Step 1: machine identifier |
| `habits/` | Alcohol and smoking tracking, streaks, milestones | Planned |
| `facts/` | Researched fact library with sources (food, alcohol, smoking; US, China, Europe, Asia) | Planned |
| `photo-scan` (later) | Read any monitor's screen from a photo, built and tested as its own project, then added to BP Diary once it's reliable. Earlier experiment kept in `bp-diary/tools/ocr-bench/` | Planned, not started |
| `site/` | Landing page for the hosted site | |

The site is built and published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
Live apps: https://stasevitch.github.io/LifestyleChanger/bp-diary/ and https://stasevitch.github.io/LifestyleChanger/gym-guide/
