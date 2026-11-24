const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
srv.listen(8765, async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: process.argv[3] || 'light' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:8765/'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/1-today-examples.png`, fullPage: true });
  await page.click('.tab[data-view=trends]'); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/2-trends.png`, fullPage: true });
  await page.click('.tab[data-view=today]');
  await page.click('#tab-add'); await page.fill('#f-sys', '131'); await page.fill('#f-dia', '84'); await page.fill('#f-pulse', '72');
  await page.click('#f-tags button[data-v=coffee]');
  await page.screenshot({ path: `${out}/3-add-sheet.png` });
  await page.click('#f-save-more'); await page.fill('#f-sys', '127'); await page.fill('#f-dia', '82'); await page.click('#f-save');
  // validation check
  await page.click('#tab-add'); await page.fill('#f-sys', '80'); await page.fill('#f-dia', '90'); await page.click('#f-save');
  const err = await page.textContent('#f-err'); await page.click('#sheet-cancel');
  await page.screenshot({ path: `${out}/4-today-real.png`, fullPage: true });
  await page.click('.tab[data-view=more]');
  await page.setInputFiles('#import-file', path.join(__dirname, 'sample-omron.csv')); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/5-import.png`, fullPage: true });
  await page.click('[data-act=import-confirm]');
  await page.click('.tab[data-view=history]'); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/6-history.png`, fullPage: true });
  const st = await page.evaluate(() => ({ n: BPD.state.readings.length, ex: BPD.state.readings.filter(r => r.source === 'example').length,
    irr: BPD.state.readings.filter(r => r.irregular).length,
    sessions: BPD.state.readings.map(r => r.session).join(','),
    usDate: BPD.parseDateTime('11/24/2026', '7:05 PM', 'MDY')?.toString(), named: BPD.parseDateTime('Nov 24, 2026', '07:05', 'auto')?.toString(),
    reload: null }));
  await page.reload(); await page.waitForTimeout(300);
  st.afterReload = await page.evaluate(() => BPD.state.readings.length);
  await page.click('.tab[data-view=trends]'); await page.click('[data-act=report]'); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/7-report.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(JSON.stringify({ validationError: err, ...st, overflow, errors }, null, 1));
  await browser.close(); srv.close();
});
