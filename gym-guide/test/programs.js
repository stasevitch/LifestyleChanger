// Programs: checks every program's exercises exist, follows First Steps, runs a day, and checks targets, the go-heavier hint and the next day.
// Usage: node test/programs.js <out-dir> [light|dark]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
const wait = ms => new Promise(r => setTimeout(r, ms));
srv.listen(8768, async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: process.argv[3] || 'light' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', d => d.accept());
  const shot = n => page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const res = { overflow: {} };
  await page.goto('http://localhost:8768/'); await wait(300);
  res.missing = await page.evaluate(() => { const ids = new Set([...GG.MACHINES, ...GG.FREE].map(e => e.id)); return GG.PROGRAMS.flatMap(p => p.days.flatMap(d => d.ex.filter(e => !ids.has(e.id)).map(e => p.id + ':' + e.id))); });
  // One earlier leg press session at the top of the range -> hint
  await page.evaluate(() => { const t = Date.now() - 3 * 864e5; GG.store.workouts = [{ id: 'old', start: t, end: t + 3e6, items: [{ ex: 'leg-press', sets: [{ w: 60, r: 15 }, { w: 60, r: 15 }] }, { ex: 'chest-press', sets: [{ w: 30, r: 12 }, { w: 30, r: 11 }] }] }]; GG.save(); });
  await page.reload(); await wait(200);
  await page.click('.tab[data-view=programs]'); await wait(150);
  res.programs = await page.$$eval('#view-programs .wk .d', e => e.map(x => x.firstChild.textContent));
  await shot('p1-programs'); res.overflow.list = await overflow();
  await page.click('[data-level=advanced]'); res.advanced = await page.$$eval('#view-programs .wk', e => e.length);
  await page.click('[data-level=all]');
  await page.click('[data-p=first-steps]'); await wait(150);
  await shot('p2-program'); res.overflow.program = await overflow();
  await page.click('[data-act=follow]'); await wait(200);
  res.home = await page.textContent('#view-workout .hello .step');
  await shot('p3-home');
  await page.click('[data-act=start-day][data-day="0"]'); await wait(150);
  res.items = await page.$$eval('#view-workout .ex', cs => cs.map(c => [c.querySelector('.ex-name').textContent, c.querySelectorAll('.set-row:not(.h)').length, c.querySelector('.last b')?.textContent]));
  res.hint = await page.$$eval('#view-workout .ex .howto', e => e.map(x => x.textContent));
  res.placeholder = await page.getAttribute('#view-workout .ex[data-i="2"] [data-f=r]', 'placeholder');
  res.head = await page.textContent('#view-workout .sess-head .muted');
  await shot('p4-day');
  res.overflow.day = await overflow();
  // Do the first set of leg press, check rest uses the program's 90 s
  await page.fill('#view-workout .ex[data-i="0"] .set-row[data-s="0"] [data-f=w]', '65'); await page.click('#view-workout .ex[data-i="0"] .set-row[data-s="0"] .tick');
  res.rest = await page.textContent('#rest-t');
  await page.click('.sess-head [data-act=finish]'); await wait(200);
  res.saved = await page.evaluate(() => [GG.store.workouts.length, GG.store.program.next, GG.store.workouts.slice(-1)[0].program]);
  await page.click('.tab[data-view=workout]'); await wait(150);
  res.nextBtn = await page.textContent('#view-workout [data-act=start-day].btn');
  await page.click('.tab[data-view=history]'); await wait(150);
  res.historyLabel = await page.textContent('#view-history .wk .m');
  // Free-weight exercise page has steps but no drawing
  await page.goto('http://localhost:8768/#m/goblet-squat'); await wait(200);
  res.freePage = await page.$$eval('#view-machine .sect h3', e => e.map(x => x.textContent));
  await page.goto('http://localhost:8768/#p/ppl'); await wait(200);
  res.pplDays = await page.$$eval('#view-program h2.sec', e => e.map(x => x.textContent));
  console.log(JSON.stringify({ ...res, errors }, null, 1));
  await browser.close(); srv.close();
});
