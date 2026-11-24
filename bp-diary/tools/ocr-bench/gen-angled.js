// Angled photos of an A&D-style monitor (thin italic digits, colour scale, labels, small in frame).
// Usage: SEED=5 node gen-angled.js 40
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true }); const N = +process.argv[2] || 40;
let seed = +(process.env.SEED || 5); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];
const fontDir = path.join(path.dirname(require.resolve('dseg/package.json')), 'fonts', 'DSEG7-Classic');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 1600 } });
  const font = f => `url(data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, f)).toString('base64')})`;
  const truth = [];
  for (let i = 0; i < N; i++) {
    const sys = ri(95, 185), dia = ri(55, Math.min(115, sys - 20)), pul = ri(48, 115);
    const ry = ri(-28, 28), rx = ri(-22, 22), rz = (rnd() * 12 - 6).toFixed(1), scale = (0.55 + rnd() * 0.45).toFixed(2);
    const weight = pick(['Regular', 'Italic', 'Italic', 'BoldItalic']), ghost = (0.08 + rnd() * 0.12).toFixed(2), glare = rnd() < 0.5 ? (0.15 + rnd() * 0.3).toFixed(2) : 0;
    const big = 120, small = 64;
    const num = v => `<span style="position:relative;display:inline-block"><span style="position:absolute;right:0;opacity:${ghost}">${'8'.repeat(String(v).length)}</span>${v}</span>`;
    const lbl = (a, b) => `<span style="display:inline-block;font:600 15px Arial;line-height:1.1;margin-left:10px;vertical-align:top;color:#1f2a24">${a}<br><span style="font-size:9px">${b}</span></span>`;
    await p.setContent(`<style>@font-face{font-family:S;src:${font('DSEG7Classic-' + weight + '.woff2')}}</style>
      <body style="margin:0;height:1600px;overflow:hidden;background:linear-gradient(${ri(0,180)}deg,#8a6a4a,#5a4030 60%,#3c3c44);display:grid;place-items:center">
      <div style="position:absolute;left:${ri(-100,200)}px;top:${ri(900,1300)}px;width:700px;height:260px;background:#5d6066;border-radius:80px;transform:rotate(${ri(-20,20)}deg)"></div>
      <div style="perspective:900px"><div style="transform:scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg);background:linear-gradient(#f6f6f2,#d9dad4);padding:40px 46px 220px;border-radius:46px;box-shadow:0 20px 50px rgba(0,0,0,.5)">
        <div style="font:bold 22px Arial;color:#1d2d6b;margin-bottom:10px">A&amp;D <span style="font-size:12px;font-weight:400">Medical</span></div>
        <div style="background:#26407a;padding:22px;border-radius:12px">
          <div id="lcd" style="position:relative;display:flex;gap:16px;background:#b4bcae;padding:14px 18px;border-radius:6px;color:#1b211c;font-family:S;width:400px">
            <div style="display:grid;gap:3px;align-content:center">${['#d9363e','#e0662f','#e7a83a','#e4d04a','#7cbf5a','#3d8fd0'].map(c => `<div style="width:14px;height:22px;background:${c}"></div>`).join('')}</div>
            <div style="flex:1">
              <div style="text-align:right;font-size:${big}px;line-height:1.08">${num(sys)}${lbl('SYS.', 'ВЕРХНЕЕ<br>mmHg')}</div>
              <div style="text-align:right;font-size:${big}px;line-height:1.08">${num(dia)}${lbl('DIA.', 'НИЖНЕЕ<br>mmHg')}</div>
              <div style="text-align:right;font-size:${small}px;line-height:1.1">${num(pul)}${lbl('ПУЛЬС', '/min')}</div>
            </div>
            ${glare > 0 ? `<div style="position:absolute;inset:0;background:linear-gradient(${ri(0,180)}deg,rgba(255,255,255,0) 30%,rgba(255,255,255,${glare}) 50%,rgba(255,255,255,0) 70%)"></div>` : ''}
          </div>
          <div style="font:10px Arial;color:#fff;margin-top:8px;text-align:center">UA-888 ИЗМЕРИТЕЛЬ АРТЕРИАЛЬНОГО ДАВЛЕНИЯ</div>
        </div>
        <div style="width:70px;height:70px;border-radius:50%;background:#26407a;margin:40px auto 0;color:#fff;font:12px Arial;display:grid;place-items:center">СТАРТ</div>
      </div></div></body>`);
    await p.evaluate(() => document.fonts.ready);
    const bb = await (await p.$('#lcd')).boundingBox(); const m = 12;
    const f = `a${String(i).padStart(3, '0')}.jpg`;
    await p.screenshot({ path: path.join(out, f), type: 'jpeg', quality: 82 });
    truth.push({ f, sys, dia, pul, rx, ry, rz: +rz, scale: +scale, weight, glare: +glare, crop: { x: bb.x - m, y: bb.y - m, w: bb.width + 2 * m, h: bb.height + 2 * m } });
  }
  fs.writeFileSync(path.join(out, 'truth.json'), JSON.stringify(truth, null, 1)); await b.close(); console.log('generated', N);
})();
