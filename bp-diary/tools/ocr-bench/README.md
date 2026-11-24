# Monitor-reading benchmark

Measures how well `public/bpocr.js` (the on-phone seven-segment reader) reads blood pressure monitor screens.

```
cd bp-diary/tools/ocr-bench
npm i dseg@0.46.0          # seven-segment font for synthetic photos (Playwright is preinstalled in dev envs)
SEED=777 node gen.js 60    # 60 synthetic photos + out/truth.json (or: SEED=5 node gen-angled.js 40 for angled A&D-style photos)
node run.js auto           # whole photo, the way the app reads it
node run.js crop           # framed to the screen
node run.js full           # whole photo, single pass
```

Real photos: put them in `out/` and list them in `out/truth.json` as `{ "f": "name.jpg", "sys": 128, "dia": 84, "pul": 66 }` (add `"crop": {x,y,w,h}` to test framing). Real photos are the most useful test.
