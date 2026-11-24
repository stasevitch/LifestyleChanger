// Generates synthetic blood pressure monitor photos (seven-segment LCD) with ground truth into ./out.
// Usage: npm i dseg@0.46.0 && SEED=42 node gen.js 60
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true }); const N = +process.argv[2] || 60;
const fontDir = path.join(path.dirname(require.resolve('dseg/package.json')), 'fonts', 'DSEG7-Classic');
let seed = +(process.env.SEED || 42); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1100 } });
  const font = f => `url(data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, f)).toString('base64')})`;
  const truth = [];
  for (let i = 0; i < N; i++) {
    const sys = ri(95, 185), dia = ri(55, Math.min(115, sys - 20)), pul = ri(48, 115);
    const style = pick(['grey', 'green', 'blue', 'grey']), italic = rnd() < 0.6, layout = pick(['stack', 'stack', 'side']);
    const ghost = rnd() < 0.5; // faint unlit segments ("888") like real LCDs
    const bg = { grey: '#b9c0b4', green: '#bcd0a8', blue: '#1d3550' }[style], fg = style === 'blue' ? '#e8f2ff' : '#1a1d1a';
    const rot = (rnd() * 16 - 8).toFixed(1), blur = (rnd() * 1.6).toFixed(2), glare = rnd() < 0.5 ? (0.15 + rnd() * 0.35).toFixed(2) : 0;
    const date = rnd() < 0.5;
    const num = (v, size) => `<span style="position:relative;display:inline-block"><span style="position:absolute;right:0;opacity:${ghost ? .07 : 0}">${'8'.repeat(String(v).length)}</span>${v}</span>`;
    const big = ri(120, 160), small = Math.round(big * (0.45 + rnd() * 0.15));
    const lbl = t => `<span style="font:600 16px Arial;color:${fg};opacity:.8;margin-left:8px">${t}</span>`;
    const body = layout === 'stack'
      ? `<div style="text-align:right;font-size:${big}px;line-height:1.05">${num(sys)}${lbl('SYS<br>mmHg')}</div>
         <div style="text-align:right;font-size:${big}px;line-height:1.05">${num(dia)}${lbl('DIA<br>mmHg')}</div>
         <div style="text-align:right;font-size:${small}px;line-height:1.1">♥ ${num(pul)}${lbl('PUL<br>/min')}</div>`
      : `<div style="display:flex;gap:30px;justify-content:flex-end;font-size:${Math.round(big*.8)}px">${num(sys)}<span>${num(dia)}</span></div>
         <div style="display:flex;justify-content:space-between;font:600 16px Arial"><span>SYS</span><span>DIA</span></div>
         <div style="text-align:right;font-size:${small}px">${num(pul)}${lbl('PULSE')}</div>`;
    await p.setContent(`<style>@font-face{font-family:S;src:${font(italic ? 'DSEG7Classic-BoldItalic.woff2' : 'DSEG7Classic-Bold.woff2')}}</style>
      <body style="margin:0;background:${pick(['#d8d2c4', '#6d7a83', '#f0efe9', '#4a3f35'])};height:1100px;display:grid;place-items:center">
      <div style="transform:rotate(${rot}deg);filter:blur(${blur}px);background:${pick(['#f4f4f2', '#2b2b2e', '#e9e5dc'])};padding:40px 40px 120px;border-radius:40px;box-shadow:0 10px 40px rgba(0,0,0,.4)">
      <div id="lcd" style="position:relative;background:${bg};color:${fg};font-family:S;padding:20px 30px;border-radius:12px;width:${layout === 'stack' ? 480 : 560}px">
      ${date ? `<div style="font-size:26px;margin-bottom:6px">${ri(1,12)}/${ri(1,28)} &nbsp; ${ri(5,22)}:${String(ri(0,59)).padStart(2,'0')}</div>` : ''}
      ${body}
      ${glare > 0 ? `<div style="position:absolute;inset:0;border-radius:12px;background:linear-gradient(${ri(0,180)}deg,rgba(255,255,255,0) 30%,rgba(255,255,255,${glare}) 50%,rgba(255,255,255,0) 70%)"></div>` : ''}
      </div></div></body>`);
    await p.evaluate(() => document.fonts.ready);
    const box = await (await p.$('#lcd')).boundingBox();
    const f = `m${String(i).padStart(3, '0')}.jpg`;
    await p.screenshot({ path: path.join(out, f), type: 'jpeg', quality: 80 });
    // "crop" = what a user would frame: the LCD with a loose random margin
    const m = 20 + rnd() * 50;
    truth.push({ f, sys, dia, pul, style, italic, layout, ghost, rot: +rot, blur: +blur, glare: +glare, date,
      crop: { x: Math.max(0, box.x - m), y: Math.max(0, box.y - m), w: Math.min(900, box.width + 2 * m), h: Math.min(1100, box.height + 2 * m) } });
  }
  fs.writeFileSync(path.join(out, 'truth.json'), JSON.stringify(truth, null, 1));
  await b.close(); console.log('generated', N);
})();
