// Logs a workout through the UI on top of 8 weeks of seeded history, then checks history, records, progress charts, editing, units and backup.
// Usage: node test/tracker.js <out-dir> [light|dark]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
srv.listen(8767, async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: process.argv[3] || 'light', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', d => d.accept());
  const shot = async n => page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const res = { overflow: {} };
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(300);
  await shot('t0-empty');
  // Seed 8 weeks: Mon & Thu, slowly getting stronger
  await page.evaluate(() => {
    const day = 864e5, now = Date.now(), ws = [];
    for (let k = 0; k < 16; k++) {
      const start = now - (56 - k * 3.5) * day - 2 * 3600e3, g = Math.floor(k / 2);
      const items = [
        { ex: 'chest-press', sets: [{ w: 30 + g * 2.5, r: 12 }, { w: 30 + g * 2.5, r: 12 }, { w: 30 + g * 2.5, r: 10 }] },
        { ex: 'lat-pulldown', sets: [{ w: 35 + g * 2.5, r: 12 }, { w: 35 + g * 2.5, r: 11 }, { w: 35 + g * 2.5, r: 10 }] },
        { ex: k % 2 ? 'leg-press' : 'assisted-pullup', sets: k % 2 ? [{ w: 60 + g * 5, r: 12 }, { w: 60 + g * 5, r: 12 }] : [{ w: 40 - g * 2.5, r: 6 }, { w: 40 - g * 2.5, r: 5 }] },
        { ex: 'treadmill', sets: [{ min: 10 + g, km: 1 + g * 0.1 }] },
      ];
      if (k % 4 !== 3) ws.push({ id: 'seed' + k, start, end: start + (45 + k) * 6e4, items });
    }
    GG.store.workouts = ws; GG.save();
  });
  await page.reload(); await page.waitForTimeout(300);
  await shot('t1-home');
  // Repeat last workout prefills from history
  await page.click('[data-act=repeat]');
  res.prefilled = await page.$$eval('#view-workout .ex', cs => cs.map(c => [c.querySelector('.ex-name').textContent, [...c.querySelectorAll('[data-f]')].map(i => i.value).join('/')]));
  // Tick an empty-ish set should refuse: clear reps of first chest-press set then tick
  const first = '#view-workout .ex[data-i="0"] .set-row[data-s="0"]';
  await page.fill(`${first} [data-f=r]`, ''); await page.click(`${first} .tick`);
  res.refusedEmpty = await page.$eval(`${first} .tick`, b => b.getAttribute('aria-pressed'));
  // Heavier chest press -> record
  for (let s = 0; s < 3; s++) { const r = `#view-workout .ex[data-i="0"] .set-row[data-s="${s}"]`; await page.fill(`${r} [data-f=w]`, '50'); await page.fill(`${r} [data-f=r]`, '10'); await page.click(`${r} .tick`); }
  res.restVisible = await page.isVisible('#rest');
  res.restText = await page.textContent('#rest-t');
  await page.click('#view-workout .ex[data-i="1"] .set-row[data-s="0"] .tick');
  // Add a custom exercise
  await page.click('[data-act=add]'); await page.waitForTimeout(100);
  await shot('t2-add');
  await page.fill('#add-q', 'butterfly'); res.addSearch = await page.$$eval('#add-list .pick b', e => e.map(x => x.textContent));
  await page.fill('#add-q', ''); await page.fill('#c-name', 'Cable face pull'); await page.click('#custom-form button');
  await page.waitForTimeout(150);
  res.afterCustom = await page.$$eval('#view-workout .ex-name', e => e.map(x => x.textContent));
  const cf = '#view-workout .ex[data-i="4"] .set-row[data-s="0"]';
  await page.fill(`${cf} [data-f=w]`, '15'); await page.fill(`${cf} [data-f=r]`, '15'); await page.click(`${cf} .tick`);
  await shot('t3-active');
  res.overflow.active = await overflow();
  // Survives a reload mid-workout
  await page.reload(); await page.waitForTimeout(200);
  res.activeAfterReload = await page.$$eval('#view-workout .tick[aria-pressed=true]', e => e.length);
  await page.click('.sess-head [data-act=finish]'); await page.waitForTimeout(200);
  res.saved = await page.textContent('.done-banner');
  await shot('t4-saved');
  // Edit: change a value
  await page.click('[data-act=edit]'); await page.fill('#view-session .ex[data-i="1"] .set-row[data-s="0"] [data-f=r]', '13'); await page.click('[data-act=edit-save]');
  res.edited = await page.$$eval('#view-session .item-line > span', e => e.map(x => x.textContent));
  // Progress
  await page.click('.tab[data-view=progress]'); await page.waitForTimeout(200);
  await shot('t5-progress');
  res.overflow.progress = await overflow();
  res.progressRows = await page.$$eval('.prog-row b', e => e.map(x => x.textContent));
  const box = await page.$('#ch-weeks svg'); const bb = await box.boundingBox();
  await page.mouse.move(bb.x + bb.width - 10, bb.y + bb.height / 2); res.weekTip = await page.textContent('#ch-weeks .tip');
  await page.click('.prog-row[data-m=chest-press]'); await page.waitForTimeout(200);
  await page.$eval('#ch-ex', e => e.scrollIntoView({ block: 'center' })); const lb = await (await page.$('#ch-ex svg')).boundingBox(); await page.mouse.move(lb.x + lb.width - 5, lb.y + 60);
  res.exTip = await page.textContent('#ch-ex .tip');
  await shot('t6-exercise');
  res.overflow.exercise = await overflow();
  await page.click('[data-metric=vol]'); res.volHead = await page.textContent('#ex-progress .chart-head h3');
  await page.goto('http://localhost:8767/#m/assisted-pullup'); await page.waitForTimeout(150);
  res.assistNote = await page.textContent('#ex-progress .chart-head span');
  // History
  await page.click('.tab[data-view=history]'); await page.waitForTimeout(150); res.historyCount = await page.$$eval('#view-history .wk', e => e.length);
  await shot('t7-history');
  // Units
  await page.click('#gear'); await page.waitForTimeout(100); await page.click('[data-unit=lb]'); await page.waitForTimeout(100);
  await page.click('.tab[data-view=history]'); await page.waitForTimeout(100); await page.click('#view-history .wk'); await page.waitForTimeout(100);
  res.lbText = await page.textContent('#view-session .item-line > span');
  await page.click('#back'); await page.waitForTimeout(100); await page.click('#gear'); await page.waitForTimeout(100); await page.click('[data-unit=kg]');
  await shot('t8-settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
  const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); res.backupWorkouts = backup.workouts.length;
  console.log(JSON.stringify({ ...res, errors }, null, 1));
  await browser.close(); srv.close();
});
