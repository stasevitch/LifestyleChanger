// Language switch: every screen in Russian, nothing left in English, setting survives a reload.
// Usage: node test/lang.js <screenshot-dir>   (after python3 build.py)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });

// Words allowed to stay Latin in Russian: names, formats, units shown as-is.
const ALLOWED = new Set(['ACC', 'AHA', 'OMRON', 'connect', 'CSV', 'PDF', 'iPhone', 'Safari', 'English', 'Language', 'PM', 'IPHONE']);
const leftovers = text => (text.match(/[A-Za-z]{2,}/g) || []).filter(w => !ALLOWED.has(w));

srv.listen(8769, async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 14'] })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8769/'); await page.waitForTimeout(300);
  await page.click('.tab[data-view=more]');
  await page.selectOption('#s-lang', 'ru'); await page.waitForTimeout(200);
  const found = {};
  const visibleText = () => page.evaluate(() => document.body.innerText);
  for (const v of ['today', 'history', 'trends', 'more']) {
    await page.click(`.tab[data-view=${v}]`); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, `ru-${v}.png`), fullPage: true });
    found[v] = leftovers(await visibleText());
  }
  await page.click('#tab-add'); await page.click('#f-save'); await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, 'ru-sheet.png') });
  found.sheet = leftovers(await visibleText());
  const err = await page.textContent('#f-err');
  await page.click('#sheet-cancel');
  await page.click('.tab[data-view=trends]'); await page.click('[data-act=report]'); await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'ru-report.png'), fullPage: true });
  found.report = leftovers(await page.evaluate(() => document.querySelector('#report-overlay').innerText));
  await page.click('#report-close');
  const csv = await page.evaluate(() => document.querySelector('#view-trends') && 1);
  await page.reload(); await page.waitForTimeout(300);
  const afterReload = { lang: await page.evaluate(() => document.documentElement.lang), tab: await page.textContent('.tab[data-view=today]') };
  await page.click('.tab[data-view=more]'); await page.selectOption('#s-lang', 'en'); await page.waitForTimeout(150);
  const backToEn = await page.textContent('.tab[data-view=today]');
  const bad = Object.entries(found).filter(([, w]) => w.length);
  console.log(JSON.stringify({ leftovers: Object.fromEntries(bad), validationRu: err, afterReload, backToEn, errors }, null, 1));
  const ok = !bad.length && /[а-я]/i.test(err) && afterReload.lang === 'ru' && /Сегодня/.test(afterReload.tab) && /Today/.test(backToEn) && !errors.length;
  console.log(ok ? 'PASS' : 'FAIL'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
});
