// Camera-scan flow with a mocked Anthropic API response (no real key used).
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist'), out = process.argv[2];
const srv = http.createServer((q, s) => { let p = path.join(dist, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); s.end(d); }); });
const reply = (obj, extra = {}) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 1500, output_tokens: 120 }, content: [{ type: 'text', text: JSON.stringify(obj) }], ...extra });
srv.listen(8766, async () => {
  const browser = await chromium.launch();
  // 1. Draw a fake LCD monitor and photograph it.
  const art = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await art.setContent(`<body style="margin:0;background:#888;display:grid;place-items:center;height:800px"><div style="background:#c9d4c0;width:360px;padding:30px;border-radius:20px;font-family:monospace;color:#222">
    <div style="font-size:20px">11-24 &nbsp; 7:15</div><div style="font-size:110px;text-align:right">128<small style="font-size:18px">SYS</small></div>
    <div style="font-size:110px;text-align:right">84<small style="font-size:18px">DIA</small></div><div style="font-size:50px;text-align:right">♥ 66<small style="font-size:16px">PUL</small></div></div></body>`);
  const photo = path.join(out, 'fake-monitor.jpg'); await art.screenshot({ path: photo, type: 'jpeg' }); await art.close();

  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const requests = [];
  let mode = 'ok';
  await page.route('https://api.anthropic.com/**', async route => {
    const body = route.request().postDataJSON(); requests.push({ url: route.request().url(), body, headers: route.request().headers() });
    if (mode === 'auth') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    if (mode === 'unreadable') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply({ readable: false, systolic: null, diastolic: null, pulse: null, year: null, month: null, day: null, hour: null, minute: null, irregular_heartbeat: false, is_memory_or_average: false, uncertain_fields: [], device: null, problem: 'The screen is blurred. Hold the phone steady and closer.' })) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply({ readable: true, systolic: 128, diastolic: 84, pulse: 66, year: null, month: 11, day: 24, hour: 7, minute: 15, irregular_heartbeat: false, is_memory_or_average: false, uncertain_fields: ['pulse'], device: null, problem: null })) });
  });
  await page.goto('http://localhost:8766/'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/today.png` });
  // No key yet: Today's Scan button opens the guided setup
  await page.click('[data-act=scan]');
  const setupOpen = await page.isVisible('#setup-overlay');
  await page.screenshot({ path: `${out}/setup.png` });
  await page.click('#setup-paste');               // clipboard is empty/denied here -> manual box opens
  await page.waitForTimeout(200);
  const pasteFallback = await page.textContent('#setup-err');
  await page.fill('#setup-key', 'not-a-key'); await page.click('#setup-save');
  const badKey = await page.textContent('#setup-err');
  await page.fill('#setup-key', 'sk-ant-api03-' + 'x'.repeat(40)); await page.click('#setup-save');
  await page.screenshot({ path: `${out}/setup-done.png` });
  const noKey = { setupOpen, pasteFallback, badKey };
  // Scan straight from the "ready" screen
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#setup-done [data-act=scan]')]);
  await chooser.setFiles(photo);
  await page.waitForSelector('#scan-msg strong:has-text("Check these numbers")', { timeout: 20000 });
  await page.screenshot({ path: `${out}/scan-result.png` });


  await page.click('#f-save');
  const saved = await page.evaluate(() => { const r = BPD.state.readings.filter(x => x.source === 'photo'); return r.map(x => ({ sys: x.sys, dia: x.dia, pulse: x.pulse, t: new Date(x.ts).toString().slice(0, 21), s: x.session })); });
  // Unreadable + auth error paths
  mode = 'unreadable'; await page.click('.tab[data-view=today]');
  const [ch2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#view-today [data-act=scan]')]); await ch2.setFiles(photo);
  await page.waitForSelector('.scan-status.bad', { timeout: 20000 }); const unreadable = await page.textContent('#scan-msg');
  mode = 'auth'; await page.setInputFiles('#scan-file', photo);
  await page.waitForFunction(() => /not accepted/.test(document.querySelector('#scan-msg').textContent), null, { timeout: 20000 }); const auth = await page.textContent('#scan-msg');
  const r0 = requests[0];
  console.log(JSON.stringify({ noKey, saved, unreadable, auth, errors,
    request: { url: r0.url, model: r0.body.model, effort: r0.body.output_config.effort, format: r0.body.output_config.format.type, fallbacks: r0.body.fallbacks,
      beta: r0.headers['anthropic-beta'], browserHeader: r0.headers['anthropic-dangerous-direct-browser-access'], imgKB: Math.round(r0.body.messages[0].content[0].source.data.length * 0.75 / 1024) } }, null, 1));
  await browser.close(); srv.close();
});
