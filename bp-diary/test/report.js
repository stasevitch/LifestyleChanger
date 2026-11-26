// Doctor report: builds a journal-style report, saves it as PDF and image (English and Russian).
// Usage: node test/report.js <output-dir>   (after python3 build.py). Writes report-<lang>.pdf / .png there.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, s) => { let p = path.join(dist, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });

srv.listen(8770, async () => {
  const browser = await chromium.launch();
  // Desktop context: the Save buttons download files (phones get the share sheet instead).
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8770/'); await page.waitForTimeout(300);
  // Real-looking data: 16 days, a few gaps, tags, notes, an irregular heartbeat and an extra reading.
  await page.evaluate(() => {
    const st = BPD.state, day = 864e5, today = new Date(); today.setHours(0, 0, 0, 0);
    st.readings = [];
    for (let i = 15; i >= 0; i--) {
      const d = today.getTime() - i * day;
      if (i !== 15) st.readings.push({ id: 'm' + i, ts: d + 7.5 * 36e5, sys: 128 + (i * 7) % 13, dia: 78 + (i * 5) % 11, pulse: 60 + (i * 3) % 20, session: 'morning', tags: i === 6 ? ['coffee'] : [], note: '', irregular: i === 9, source: 'manual' });
      if (i !== 15) st.readings.push({ id: 'm2' + i, ts: d + 7.55 * 36e5, sys: 126 + (i * 5) % 11, dia: 77 + (i * 3) % 9, pulse: 62, session: 'morning', tags: [], note: '', irregular: false, source: 'manual' });
      if (i !== 0) st.readings.push({ id: 'e' + i, ts: d + 21 * 36e5, sys: 124 + (i * 11) % 22, dia: 74 + (i * 7) % 16, pulse: 58 + (i * 5) % 25, session: 'evening', tags: i === 12 ? ['alcohol'] : i === 11 ? ['salty'] : [], note: i === 11 ? 'Fatty dinner' : '', irregular: false, source: 'manual' });
    }
    st.readings.push({ id: 'x1', ts: today.getTime() - 4 * day + 14.3 * 36e5, sys: 142, dia: 91, pulse: 74, session: 'extra', tags: ['stress'], note: '', irregular: false, source: 'manual' });
    st.settings.name = 'Test Patient';
  });
  const result = { errors };
  for (const lang of ['en', 'ru']) {
    await page.click('.tab[data-view=more]'); await page.selectOption('#s-lang', lang);
    await page.click('[data-act=report]');
    await page.waitForFunction(() => !!BPD.reportFiles, null, { timeout: 20000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, `report-screen-${lang}.png`) });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#report-pdf')]);
    await dl.saveAs(path.join(out, `report-${lang}.pdf`));
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#report-png')]);
    await dl2.saveAs(path.join(out, `report-${lang}.png`));
    result[lang] = { pdf: dl.suggestedFilename(), png: dl2.suggestedFilename(), pdfBytes: fs.statSync(path.join(out, `report-${lang}.pdf`)).size,
      pages: await page.$$eval('#report-pages img', a => a.length), saveLabel: await page.textContent('#report-pdf') };
    // switching the period rebuilds the report
    await page.click('#report-range [data-days="14"]');
    await page.waitForFunction(() => !!BPD.reportFiles, null, { timeout: 20000 });
    result[lang].rebuilt14 = true;
    await page.click('#report-close');
  }
  console.log(JSON.stringify(result, null, 1));
  const ok = !errors.length && result.en.pdfBytes > 10000 && result.ru.pdfBytes > 10000 && /Сохранить/.test(result.ru.saveLabel);
  console.log(ok ? 'PASS' : 'FAIL'); await browser.close(); srv.close(); process.exit(ok ? 0 : 1);
});
