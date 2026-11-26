// Walks the identify flow, browse/search and a machine page on an emulated iPhone; saves screenshots to the folder given.
// Usage: node test/e2e.js <out-dir> [light|dark]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
srv.listen(8766, async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: process.argv[3] || 'light' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(m.text()));
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const res = {};
  await page.goto('http://localhost:8766/'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/1-step1.png`, fullPage: true });
  await page.click('[data-q=pos] [data-v=sit]');
  await page.screenshot({ path: `${out}/2-step2.png`, fullPage: true });
  await page.click('[data-q=move] [data-v=pull]');
  res.sitPull = await page.$$eval('#view-identify .mc b', els => els.map(e => e.textContent));
  await page.screenshot({ path: `${out}/3-results.png`, fullPage: true });
  await page.click('#view-identify .mc');
  res.title = await page.textContent('#title');
  await page.screenshot({ path: `${out}/4-machine.png`, fullPage: true });
  res.overflowMachine = await overflow();
  await page.click('#back'); await page.waitForTimeout(100);
  res.backToResults = await page.$$eval('#view-identify .mc', els => els.length);
  // Every path through the questions shows at least one machine
  res.deadEnds = await page.evaluate(() => { const out = []; const { MACHINES } = GG;
    for (const p of ['sit', 'lie', 'stand', 'kneel']) for (const mv of ['push', 'pull', 'squeeze', 'curl', 'legs', 'core']) {
      if (!MACHINES.some(m => m.pos.includes(p) && m.move.includes(mv)) && !MACHINES.some(m => m.move.includes(mv) && !m.cardio)) out.push(p + '/' + mv); }
    return out; });
  await page.click('[data-reset=pos]'); await page.click('[data-q=pos] [data-v=cardio]');
  res.cardio = await page.$$eval('#view-identify .mc b', els => els.map(e => e.textContent));
  await page.click('.tab[data-view=browse]'); await page.waitForTimeout(100);
  res.all = await page.$$eval('#list .mc', els => els.length);
  await page.screenshot({ path: `${out}/5-browse.png`, fullPage: true });
  res.overflowBrowse = await overflow();
  await page.fill('#q', 'butterfly'); res.searchButterfly = await page.$$eval('#list .mc b', els => els.map(e => e.textContent));
  await page.fill('#q', 'hamstrings'); res.searchHamstrings = await page.$$eval('#list .mc b', els => els.map(e => e.textContent));
  await page.fill('#q', ''); await page.click('[data-g=arms]'); res.arms = await page.$$eval('#list .mc', els => els.length);
  // Direct link to a machine page
  await page.goto('http://localhost:8766/#m/smith-machine'); await page.waitForTimeout(300);
  res.directTitle = await page.textContent('#title');
  await page.click('#back'); res.afterDirectBack = await page.textContent('#title');
  console.log(JSON.stringify({ ...res, errors }, null, 1));
  await browser.close(); srv.close();
});
