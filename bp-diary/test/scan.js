// Camera-scan flow in the app with the on-phone reader (no network, no key).
// Usage: node test/scan.js <screenshot-dir>   (after python3 build.py)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const fx = f => path.join(__dirname, 'fixtures', f);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });

srv.listen(8768, async () => {
  const browser = await browser_();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { const u = new URL(r.url()); if (u.hostname !== 'localhost' && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) external.push(u.hostname); });
  await page.goto('http://localhost:8768/'); await page.waitForTimeout(400);

  const scan = async (file, viaLibrary) => {
    await page.click('#tab-add');
    const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click(viaLibrary ? '#scan-lib-btn' : '#scan-btn')]);
    await ch.setFiles(fx(file));
    await page.waitForFunction(() => /Check these|Couldn't/.test(document.querySelector('#scan-msg').textContent), null, { timeout: 20000 });
    return page.evaluate(() => ({ sys: document.querySelector('#f-sys').value, dia: document.querySelector('#f-dia').value, pulse: document.querySelector('#f-pulse').value,
      msg: document.querySelector('#scan-msg').textContent, bad: document.querySelector('#scan-status').classList.contains('bad') }));
  };

  const a = await scan('monitor-a.jpg', false);         // stacked layout, want 95/59/55
  await page.screenshot({ path: path.join(out, 'scan-a.png') });
  await page.click('#f-save');
  const saved = await page.evaluate(() => BPD.state.readings.filter(r => r.source === 'photo').map(r => `${r.sys}/${r.dia}/${r.pulse}`));
  const b = await scan('monitor-b.jpg', true);           // side-by-side layout from the library, want 136/58/110
  await page.click('#sheet-cancel');
  const side = await scan('monitor-a-sideways.jpg', true); // photo turned 90°, want 95/59
  await page.click('#sheet-cancel');
  // Zoomed-out library photo: if not read automatically, framing opens; drag over the screen.
  const far = await scan('monitor-a-far.jpg', true);
  let framed = null;
  if (await page.isVisible('#frame-overlay')) {
    const box = await page.$eval('#frame-canvas', c => { const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    // monitor screen sits at about x 0.62-0.86, y 0.12-0.55 of the photo
    await page.mouse.move(box.x + box.w * 0.64, box.y + box.h * 0.14); await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.84, box.y + box.h * 0.5, { steps: 5 }); await page.mouse.up();
    await page.screenshot({ path: path.join(out, 'frame.png') });
    await page.click('#frame-read');
    await page.waitForFunction(() => /Check these|Still couldn't/.test(document.querySelector('#scan-msg').textContent), null, { timeout: 20000 });
    framed = await page.evaluate(() => ({ sys: document.querySelector('#f-sys').value, dia: document.querySelector('#f-dia').value, pulse: document.querySelector('#f-pulse').value }));
  }
  await page.click('#sheet-cancel');
  const c = await scan('not-a-monitor.png', true);       // an app icon: should fail politely
  if (await page.isVisible('#frame-overlay')) await page.click('#frame-cancel');
  await page.screenshot({ path: path.join(out, 'scan-fail.png') });
  await page.click('#sheet-cancel');
  const todayClean = await page.evaluate(() => !document.querySelector('#view-today [data-act=scan]') && !document.querySelector('.quick-add'));

  const result = { a, saved, b, side, far, framed, c, todayClean, external: [...new Set(external)], errors };
  console.log(JSON.stringify(result, null, 1));
  const ok = a.sys === '95' && a.dia === '59' && saved.length === 1 && b.sys === '136' && b.dia === '58' && side.sys === '95' && side.dia === '59' && ((far.sys === '95' && far.dia === '59') || (framed && framed.sys === '95' && framed.dia === '59')) && c.bad && todayClean && !result.external.length && !errors.length;
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
});
function browser_() { return chromium.launch(); }
