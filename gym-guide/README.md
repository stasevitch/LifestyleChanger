# Gym Guide

A workout app that does three things, in this order:
1. **Track** every exercise and workout and show your progress.
2. **Programs** from beginner to advanced, built on guidelines from the ACSM, NSCA and WHO.
3. **Learn the gym**: identify a machine and see how to use it.

 Installable web app (PWA) for iPhone and Android. No server and no account: data stays on the phone.

Part of LifestyleChanger: built and published with the rest of the site by the repository's `.github/workflows/pages.yml`, at `/gym-guide/`.

## Features
**Workout log**
- Start a workout, add exercises, enter weight and reps, tick each set. A rest timer starts after each set (1–3 min or off; vibrates when it's over).
- Each exercise shows what you did last time and fills in those numbers to start from.
- Repeat your last workout, or any past one, in one tap.
- A workout in progress survives closing the app.
- Finish shows time, sets and weight lifted, and any new records (heaviest weight, best set, most reps, longest hold, longest or furthest cardio).
- History by month; open any workout to edit it or delete it.

**Programs**
- 5 programs: First Steps (beginner, machines, 3 days), Fit & Healthy (beginner, WHO activity guideline, 5 days), Full Body Foundations (beginner, 3 days), Upper / Lower (intermediate, 4 days), Push / Pull / Legs (advanced, 6 days). The data is `PROGRAMS` in `src/app.html`.
- Each has who it's for, equipment, how it's set up, rules, every day's exercises with sets, reps and rest, and its sources.
- Follow one and the Workout tab offers the next day, set up with the target sets, reps and rest; the rest timer uses the program's rest time.
- Double progression: when you hit the top of the rep range on every set, the app tells you to go one step heavier.
- Sets, reps, rest, training days and load increases follow the ACSM position stand on resistance training progression (2009), the NSCA's Essentials of Strength Training and Conditioning (2016) and the WHO physical activity guidelines (2020). The programs are written for this app and not endorsed by these organisations.

**Progress**
- This week, weeks in a row, all workouts and time trained.
- Workouts per week and weight lifted per week for the last 12 weeks.
- Every exercise with its change since the first session and a small trend line.
- Each exercise page: records, a chart per workout (heaviest weight, total lifted or most reps; minutes or distance for cardio), and past sessions. For the assisted pull-up machine, less help weight counts as progress.

**Exercises**
- 24 machines with drawings and how-to guides, 22 free-weight, cable and bodyweight exercises with short how-to steps, plus your own (weight and reps, reps only, time held, or cardio).
- "What's this machine?": answer 2 questions (how you use it, what moves) and match the drawing.
- Browse by muscle or search by name, nickname ("butterfly", "Gravitron") or muscle.

**Settings**: kg or lb (distances follow: km or miles), rest timer length, JSON backup export and import, delete all.

## Project layout
- `src/app.html`: the whole app (markup, styles, script). The machine catalog is `MACHINES`, other exercises are `FREE`.
- `public/`: manifest, service worker, icons (`make_icons.py` redraws them; a placeholder for now).
- `build.py`: produces `dist/`.
- `test/e2e.js`: machine identifier walk-through. `test/tracker.js`: logs a workout on top of 8 weeks of seeded history and checks records, charts, editing, units and backup. `test/programs.js`: follows a program and checks targets, hints and the next day. Run either with `node test/<name>.js <screenshot-dir> [light|dark]`.

## Build and run
```
python3 build.py
python3 -m http.server -d dist 8000
```

## Planned
- Photo recognition of machines.
- Russian translation.

General guidance, not medical advice.
