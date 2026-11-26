// More page layout, hold-to-delete, report periods and full-screen view.
// Usage: node test/more.js <screenshot-dir>   (after python3 build.py)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });

srv.listen(8771, async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 14'] })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8771/'); await page.waitForTimeout(300);
  // 100 days of morning + evening readings
  await page.evaluate(() => { const st = BPD.state, day = 864e5, t0 = new Date(); t0.setHours(0, 0, 0, 0); st.readings = [];
    for (let i = 99; i >= 0; i--) { st.readings.push({ id: 'm' + i, ts: t0 - i * day + 7 * 36e5, sys: 125 + i % 20, dia: 78 + i % 14, pulse: 66, session: 'morning', tags: i % 10 === 0 ? ['coffee'] : [], note: '', source: 'manual' });
      if (i) st.readings.push({ id: 'e' + i, ts: t0 - i * day + 21 * 36e5, sys: 128 + (i * 3) % 18, dia: 80 + i % 12, pulse: 70, session: 'evening', tags: [], note: '', source: 'manual' }); } });
  const r = { errors };
  await page.click('.tab[data-view=more]'); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'more-top.png') });
  r.firstSection = await page.$eval('#view-more h2.sec', h => h.textContent);
  r.importInData = await page.$eval('#import-file', i => !!i.closest('.card').querySelector('#clear-all'));

  // Delete all: tap, short hold (cancel), full hold
  const count = () => page.evaluate(() => BPD.state.readings.length);
  const before = await count();
  await page.click('#clear-all'); r.armedLabel = await page.textContent('#clear-all');
  const box = await page.$eval('#clear-all', b => { const x = b.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();
  r.afterShortHold = await count();
  await page.screenshot({ path: path.join(out, 'hold.png') });

  // Report: default 1 month on one page; full-screen view; 3 months; custom dates
  await page.click('[data-act=report]');
  await page.waitForFunction(() => !!BPD.reportFiles, null, { timeout: 20000 });
  r.defaultChip = await page.$eval('#report-range [aria-pressed=true]', b => b.textContent);
  r.monthPages = await page.$$eval('#report-pages img', a => a.length);
  await page.screenshot({ path: path.join(out, 'report-sheet.png') });
  await page.click('#report-pages img'); await page.waitForTimeout(200);
  r.viewerOpen = await page.isVisible('#viewer');
  await page.screenshot({ path: path.join(out, 'viewer.png') });
  await page.click('#viewer-pages img'); r.zoomed = await page.$eval('#viewer-pages', v => v.classList.contains('zoom'));
  await page.click('#viewer-close');
  await page.click('#report-range [data-days="91"]'); await page.waitForFunction(() => !!BPD.reportFiles, null, { timeout: 20000 });
  r.threeMonthPages = await page.$$eval('#report-pages img', a => a.length);
  await page.click('#report-range [data-custom]'); await page.waitForTimeout(100);
  r.datesVisible = await page.isVisible('#report-dates');
  const d = new Date(); d.setDate(d.getDate() - 6); const iso = x => x.toISOString().slice(0, 10);
  await page.fill('#rp-from', iso(d)); await page.dispatchEvent('#report-dates', 'change');
  await page.waitForFunction(() => !!BPD.reportFiles, null, { timeout: 20000 });
  r.customPages = await page.$$eval('#report-pages img', a => a.length);
  await page.click('#report-close');

  // Now the full hold deletes
  await page.click('#clear-all');
  const box2 = await page.$eval('#clear-all', b => { const x = b.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  await page.mouse.move(box2.x, box2.y); await page.mouse.down(); await page.waitForTimeout(3300); await page.mouse.up();
  r.afterFullHold = await count();

  console.log(JSON.stringify(r, null, 1));
  const ok = !errors.length && before > 0 && r.afterShortHold === before && r.afterFullHold === 0 && r.monthPages === 1 && r.threeMonthPages >= 2
    && r.viewerOpen && r.zoomed && r.datesVisible && r.customPages === 1 && r.importInData && /Doctor report/.test(r.firstSection) && /1 month/.test(r.defaultChip);
  console.log(ok ? 'PASS' : 'FAIL'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
});
