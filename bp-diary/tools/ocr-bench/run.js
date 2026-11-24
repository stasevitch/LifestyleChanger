// Measures public/bpocr.js on the photos in ./out (made by gen.js, or real photos with a truth.json).
// Usage: node run.js [crop|full]
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const files = { '/bpocr.js': path.join(__dirname, '..', '..', 'public', 'bpocr.js') };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const p = files[u] || (u.startsWith('/out/') ? path.join(__dirname, u) : null);
  if (u === '/') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end('<!doctype html><script src="bpocr.js"></script>'); }
  if (!p) { s.writeHead(404); return s.end(); }
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'image/jpeg' }); s.end(d); });
});
srv.listen(8795, async () => {
  const b = await chromium.launch(); const page = await b.newPage(); await page.goto('http://localhost:8795/');
  const useCrop = process.argv[2] !== 'full';
  const res = await page.evaluate(async useCrop => {
    const truth = await (await fetch('out/truth.json')).json(); const out = [];
    for (const t of truth) { const img = new Image(); img.src = 'out/' + t.f; await img.decode();
      const r = BPOCR.readMonitor(img, useCrop ? t.crop : null); out.push({ f: t.f, want: [t.sys, t.dia, t.pul], got: [r.systolic, r.diastolic, r.pulse] }); }
    return out;
  }, useCrop);
  let all = 0, bp = 0, pul = 0;
  for (const r of res) { const okBP = r.got[0] === r.want[0] && r.got[1] === r.want[1], okP = r.got[2] === r.want[2]; bp += okBP; pul += okP; all += okBP && okP; if (!(okBP && okP)) console.log('miss', r.f, 'want', r.want.join('/'), 'got', r.got.join('/')); }
  console.log(`${res.length} photos (${useCrop ? 'framed to screen' : 'whole photo'}): sys+dia ${bp}, pulse ${pul}, all three ${all}`);
  await b.close(); srv.close();
});
