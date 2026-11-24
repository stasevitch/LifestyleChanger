// On-device reader for blood pressure monitor displays (seven-segment LCD).
// No network and no AI service: finds digits and checks which segments are lit.
// BPOCR.readMonitor(imageOrCanvas, crop?) -> { systolic, diastolic, pulse, unsure: [], found }
(function (global) {
  'use strict';

  // ---------- image helpers ----------
  function toGray(src, crop, maxW, maxH) {
    const sw = crop ? crop.w : (src.naturalWidth || src.width), sh = crop ? crop.h : (src.naturalHeight || src.height);
    const scale = Math.min(maxW / sw, maxH / sh, 2);
    const W = Math.max(1, Math.round(sw * scale)), H = Math.max(1, Math.round(sh * scale));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, crop ? crop.x : 0, crop ? crop.y : 0, sw, sh, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data, gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    return { gray, W, H };
  }

  function otsu(values) {
    const hist = new Float64Array(256); for (const v of values) hist[Math.max(0, Math.min(255, v | 0))]++;
    const n = values.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let wB = 0, sB = 0, best = -1, thr = 128;
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i];
      const d = sB / wB - (sum - sB) / wF, v = wB * wF * d * d; if (v > best) { best = v; thr = i; } }
    return thr;
  }

  // Local (Bradley) threshold; ink = 1. dark=true: ink darker than surroundings.
  function binarize(gray, W, H, dark) {
    const ii = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += gray[y * W + x]; ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + row; } }
    const r = Math.max(10, Math.round(Math.min(W, H) / 6)), t = 0.12, bin = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(H - 1, y + r);
      for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(W - 1, x + r), area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const mean = (ii[(y1 + 1) * (W + 1) + x1 + 1] - ii[y0 * (W + 1) + x1 + 1] - ii[(y1 + 1) * (W + 1) + x0] + ii[y0 * (W + 1) + x0]) / area;
        const v = gray[y * W + x]; bin[y * W + x] = dark ? (v < mean * (1 - t) ? 1 : 0) : (v > mean * (1 + t) ? 1 : 0); } }
    return bin;
  }

  // Rotate (deg) then shear (slant, tan) a binary image; nearest neighbour.
  function transform(bin, W, H, deg, shear) {
    const rad = deg * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), out = new Uint8Array(W * H), cx = W / 2, cy = H / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xu = x - cx + shear * (y - cy), yu = y - cy;               // undo shear
      const sx = Math.round(xu * cs - yu * sn + cx), sy = Math.round(xu * sn + yu * cs + cy); // undo rotation
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) out[y * W + x] = bin[sy * W + sx];
    }
    return out;
  }

  function profileScore(bin, W, H, deg, shear, vertical) {
    const rad = deg * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), L = (vertical ? W : H) * 2 + 1, prof = new Float64Array(L);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (bin[y * W + x]) {
      const xr = (x - W / 2) * cs + (y - H / 2) * sn, yr = -(x - W / 2) * sn + (y - H / 2) * cs; // rotate by -deg
      const k = Math.floor((vertical ? xr - shear * yr + W : yr + H) / 2); // 2-px bins match the 2-px sampling
      if (k >= 0 && k < L) prof[k]++;
    }
    let s1 = 0, s2 = 0; for (const v of prof) { s1 += v; s2 += v * v; } return s2 - s1 * s1 / L;
  }

  // ---------- connected components ----------
  function components(bin, W, H) {
    const lab = new Int32Array(W * H).fill(-1), comps = [], stack = [];
    for (let i = 0; i < W * H; i++) {
      if (!bin[i] || lab[i] >= 0) continue;
      const c = { x0: W, y0: H, x1: 0, y1: 0, n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0, syy: 0 }, id = comps.length; lab[i] = id; stack.push(i);
      while (stack.length) { const p = stack.pop(), x = p % W, y = (p / W) | 0; c.n++; c.sx += x; c.sy += y; c.sxx += x * x; c.sxy += x * y; c.syy += y * y;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (const q of [p - 1, p + 1, p - W, p + W]) { if (q < 0 || q >= W * H || lab[q] >= 0 || !bin[q]) continue; if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue; lab[q] = id; stack.push(q); } }
      comps.push(c);
    }
    comps.lab = lab;
    return comps;
  }

  // Drop blobs that are clearly not digit segments: anything touching the photo edge
  // (case, table, shadows) or huge, or specks.
  function clean(bin, W, H) {
    const comps = components(bin, W, H), lab = comps.lab, out = new Uint8Array(W * H);
    const keep = comps.map(c => { const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
      const edge = c.x0 <= 1 || c.y0 <= 1 || c.x1 >= W - 2 || c.y1 >= H - 2;
      return !edge && w < W * 0.5 && h < H * 0.5 && c.n >= 10; });
    for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && keep[lab[i]]) out[i] = 1;
    return out;
  }

  // ---------- seven-segment decoding ----------
  //            a  b  c  d  e  f  g
  const DIGITS = { 0: [1,1,1,1,1,1,0], 1: [0,1,1,0,0,0,0], 2: [1,1,0,1,1,0,1], 3: [1,1,1,1,0,0,1], 4: [0,1,1,0,0,1,1],
    5: [1,0,1,1,0,1,1], 6: [1,0,1,1,1,1,1], 7: [1,1,1,0,0,0,0], 8: [1,1,1,1,1,1,1], 9: [1,1,1,1,0,1,1] };
  const ALT = [[6, [0,0,1,1,1,1,1]], [7, [1,1,1,0,0,1,0]], [9, [1,1,1,0,0,1,1]]]; // common variants
  // Zones as fractions of the digit box: [x0, x1, y0, y1]
  const ZONES = [[0.3, 0.7, 0.0, 0.16], [0.72, 1.0, 0.16, 0.42], [0.72, 1.0, 0.58, 0.84], [0.3, 0.7, 0.84, 1.0], [0.0, 0.28, 0.58, 0.84], [0.0, 0.28, 0.16, 0.42], [0.3, 0.7, 0.42, 0.58]];

  function decodeDigit(bin, W, box, refH) {
    const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1;
    if (w < h * 0.38) return { d: 1, dist: 0 };      // a lone "1" is a narrow bar
    const fill = ZONES.map(([a, b, c, d]) => {
      const X0 = box.x0 + Math.floor(a * w), X1 = box.x0 + Math.ceil(b * w) - 1, Y0 = box.y0 + Math.floor(c * h), Y1 = box.y0 + Math.ceil(d * h) - 1;
      let on = 0, n = 0; for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { n++; on += bin[y * W + x]; } return n ? on / n : 0;
    });
    const hole = (cx, cy) => { let on = 0, n = 0; const X0 = box.x0 + Math.floor((cx - 0.1) * w), X1 = box.x0 + Math.ceil((cx + 0.1) * w), Y0 = box.y0 + Math.floor((cy - 0.06) * h), Y1 = box.y0 + Math.ceil((cy + 0.06) * h);
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { n++; on += bin[y * W + x]; } return n ? on / n : 0; };
    if (hole(0.5, 0.29) > 0.45 || hole(0.5, 0.71) > 0.45) return { d: null, dist: 99 }; // solid blob (icon), not a digit
    const seg = fill.map(f => f > 0.28 ? 1 : 0);
    let best = null, bestD = 99;
    const cands = Object.entries(DIGITS).map(([k, v]) => [+k, v]).concat(ALT);
    for (const [k, v] of cands) { let dd = 0; for (let i = 0; i < 7; i++) dd += v[i] !== seg[i]; if (dd < bestD) { bestD = dd; best = k; } }
    return { d: best, dist: bestD, seg, fill };
  }

  // Merge segment components into digit boxes.
  function groupDigits(comps, W, H) {
    const minDim = Math.min(W, H);
    let cs = comps.filter(c => c.n > 12 && (c.y1 - c.y0) < H * 0.9 && (c.x1 - c.x0) < W * 0.6);
    const len = c => Math.max(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1), thk = c => Math.min(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1);
    const longest = Math.max(1, ...cs.map(len));
    const segs = cs.filter(c => len(c) > longest * 0.5).map(thk).sort((a, b) => a - b);
    const refThick = segs.length ? segs[Math.floor(segs.length / 2)] : 4;
    cs = cs.filter(c => thk(c) >= refThick * 0.3 && len(c) >= longest * 0.12);
    const par = cs.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
    const thick = c => Math.max(2, Math.min(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1));
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      const gx = -ox, gy = -oy, tol = Math.max(2, 0.45 * Math.min(thick(a), thick(b)));
      const minH = Math.min(a.y1 - a.y0, b.y1 - b.y0);
      const ta = thick(a), tb = thick(b), horizA = (a.x1 - a.x0) > (a.y1 - a.y0), horizB = (b.x1 - b.x0) > (b.y1 - b.y0);
      if (Math.max(ta, tb) / Math.min(ta, tb) > 2.6) continue;    // different digit sizes
      const touchV = ox > -tol && gy <= tol && !(horizA && horizB);  // bar meets side bar, or upper/lower side bars
      const touchH = horizA && horizB && oy > 0.6 * minH && gx <= tol * 0.6; // one bar split by glare
      if (touchV || touchH) { const ra = find(i), rb = find(j); if (ra !== rb) par[ra] = rb; }
    }
    const groups = new Map();
    cs.forEach((c, i) => { const r = find(i); const g = groups.get(r) || { x0: W, y0: H, x1: 0, y1: 0, n: 0, parts: 0 };
      g.x0 = Math.min(g.x0, c.x0); g.y0 = Math.min(g.y0, c.y0); g.x1 = Math.max(g.x1, c.x1); g.y1 = Math.max(g.y1, c.y1); g.n += c.n; g.parts++; groups.set(r, g); });
    return [...groups.values()].filter(g => { const h = g.y1 - g.y0 + 1, w = g.x1 - g.x0 + 1; return h > minDim * 0.06 && h / w > 1.1 && h / w < 8; });
  }

  // Remove small print (labels like SYS, mmHg, PUL) and specks: keep only strokes as thick as digit bars.
  function dropThin(bin, W, H, Hd, densMin) {
    const comps = components(bin, W, H), lab = comps.lab;
    const len = c => Math.max(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1), thk = c => c.n / len(c); // mean stroke width
    const longest = Math.max(1, ...comps.map(len));
    const ref = comps.filter(c => len(c) > longest * 0.5).map(thk).sort((a, b) => a - b);
    const refT = ref.length ? ref[Math.floor(ref.length / 2)] : 4;
    const dens = c => c.n / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1));
    const keep = comps.map(c => thk(c) >= refT * 0.38 && len(c) >= Math.max(longest * 0.15, Hd * 0.13)
      && (len(c) > Hd * 0.4 || dens(c) >= densMin)
      && !(len(c) < Hd * 0.4 && dens(c) > 0.5 && (c.x1 - c.x0 + 1) / (c.y1 - c.y0 + 1) > 0.7 && (c.x1 - c.x0 + 1) / (c.y1 - c.y0 + 1) < 1.45)); // compact solid icon (heart) // small shapes must be solid bars, not words like mmHg
    const out = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && keep[lab[i]]) out[i] = 1;
    return out;
  }

  // Split the cleaned, straightened image along empty rows and columns into digit boxes.
  function xyCut(bin, W, H, Hd) {
    const rowGap = Math.max(3, Math.round(0.07 * Hd)), colGap = Math.max(2, Math.round(0.05 * Hd));
    const boxes = [];
    const inkBounds = b => { let x0 = b.x1, x1 = b.x0, y0 = b.y1, y1 = b.y0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (bin[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < x0 ? null : { x0, x1, y0, y1 }; };
    const split = (b, horizontal) => { // horizontal: cut along empty rows
      const n = horizontal ? b.y1 - b.y0 + 1 : b.x1 - b.x0 + 1, prof = new Uint32Array(n);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (bin[y * W + x]) prof[horizontal ? y - b.y0 : x - b.x0]++;
      const gap = horizontal ? rowGap : colGap, parts = []; let start = -1, zeros = 0;
      for (let i = 0; i <= n; i++) { const on = i < n && prof[i] > 0;
        if (on) { if (start < 0) start = i; else if (zeros >= gap) { parts.push([start, i - zeros - 1]); start = i; } zeros = 0; }
        else if (start >= 0) { zeros++; if (i === n) parts.push([start, i - zeros]); } }
      return parts.map(([a, z]) => horizontal ? { x0: b.x0, x1: b.x1, y0: b.y0 + a, y1: b.y0 + z } : { x0: b.x0 + a, x1: b.x0 + z, y0: b.y0, y1: b.y1 });
    };
    const rec = (b, depth) => {
      b = inkBounds(b); if (!b) return;
      const rows = split(b, true);
      if (rows.length > 1 && depth < 8) { rows.forEach(r => rec(r, depth + 1)); return; }
      const cols = split(b, false);
      if (cols.length > 1 && depth < 8) { cols.forEach(c => rec(c, depth + 1)); return; }
      boxes.push(b);
    };
    rec({ x0: 0, x1: W - 1, y0: 0, y1: H - 1 }, 0);
    // A box much taller than the typical digit is two rows touching (e.g. pulse right under diastolic):
    // cut it at its emptiest row and split each part again.
    const hs = boxes.filter(b => (b.x1 - b.x0 + 1) > 0.38 * (b.y1 - b.y0 + 1)).map(b => b.y1 - b.y0 + 1).sort((a, b) => a - b);
    const typical = hs.length ? hs[Math.floor(hs.length * 0.6)] : 0;
    if (typical) for (let pass = 0; pass < 2; pass++) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i], h = b.y1 - b.y0 + 1;
        if (h < 1.38 * typical) continue;
        let bestY = -1, bestInk = Infinity;
        for (let y = b.y0 + Math.round(0.4 * typical); y <= b.y1 - Math.round(0.3 * typical); y++) {
          let ink = 0; for (let x = b.x0; x <= b.x1; x++) ink += bin[y * W + x];
          if (ink < bestInk) { bestInk = ink; bestY = y; } }
        if (bestY < 0) continue;
        boxes.splice(i, 1);
        const before = boxes.length;
        rec({ x0: b.x0, x1: b.x1, y0: b.y0, y1: bestY - 1 }, 0); rec({ x0: b.x0, x1: b.x1, y0: bestY + 1, y1: b.y1 }, 0);
        if (boxes.length === before) boxes.push(b);
      }
    }
    return boxes.filter(b => { const h = b.y1 - b.y0 + 1, w = b.x1 - b.x0 + 1;
      if (h < Hd * 0.3 || h / w <= 1.1 || h / w >= 12) return false;
      if (w < 0.38 * h && h / w < 3.2) return false; // a "1" is a tall thin bar; squat blocks are icons or colour scales
      return true; });
  }

  // Digits of similar height on one baseline, close together, form a number.
  function groupNumbers(digits) {
    digits.sort((a, b) => a.x0 - b.x0);
    const nums = [];
    for (const d of digits) {
      const h = d.y1 - d.y0 + 1;
      let host = null;
      for (const n of nums) { const last = n.digits[n.digits.length - 1], lh = last.y1 - last.y0 + 1;
        const sameRow = Math.abs((d.y0 + d.y1) / 2 - (last.y0 + last.y1) / 2) < 0.3 * Math.max(h, lh) && Math.abs(h - lh) < 0.25 * Math.max(h, lh);
        const dNarrow = (d.x1 - d.x0 + 1) < 0.38 * h; // a "1" sits at the right of its cell, so the gap before it is wide
        if (sameRow && d.x0 - last.x1 < 0.32 * Math.max(h, lh) + (dNarrow ? 0.5 * h : 0) && d.x0 > last.x0) { host = n; break; } }
      if (host) host.digits.push(d); else nums.push({ digits: [d] });
    }
    return nums.map(n => {
      const ds = n.digits, h = Math.max(...ds.map(d => d.y1 - d.y0 + 1));
      // a "1" is narrow and right-aligned in its cell; handled by decodeDigit
      return { v: +ds.map(d => d.r.d).join(''), text: ds.map(d => d.r.d).join(''), h, cy: (Math.min(...ds.map(d => d.y0)) + Math.max(...ds.map(d => d.y1))) / 2, cx: (ds[0].x0 + ds[ds.length - 1].x1) / 2,
        x0: ds[0].x0, conf: ds.every(d => d.r.dist === 0) ? 1 : ds.every(d => d.r.dist <= 1) ? 0.6 : 0.2, len: ds.length };
    });
  }

  function interpret(nums) {
    const cand = nums.filter(n => n.len >= 2 && n.len <= 3 && n.conf > 0.2);
    if (cand.length < 2) return null;
    const maxH = Math.max(...cand.map(n => n.h));
    const rowOf = n => Math.round(n.cy / (maxH * 0.6));
    const order = (a, b) => rowOf(a) - rowOf(b) || a.cx - b.cx;
    const big = cand.filter(n => n.h >= maxH * 0.7).sort(order);
    let sys = null, dia = null;
    for (let i = 0; i < big.length && !sys; i++) for (let j = i + 1; j < big.length; j++)
      if (big[i].v >= 60 && big[i].v <= 260 && big[j].v >= 30 && big[j].v <= 160 && big[j].v < big[i].v) { sys = big[i]; dia = big[j]; break; }
    if (!sys) return null;
    const rest = cand.filter(n => n !== sys && n !== dia && n.h >= maxH * 0.3 && n.cy > sys.cy && n.v >= 30 && n.v <= 220).sort((a, b) => b.h - a.h || b.cy - a.cy);
    const pul = rest[0] || null;
    const unsure = [];
    if (sys.conf < 1) unsure.push('systolic'); if (dia.conf < 1) unsure.push('diastolic'); if (pul && pul.conf < 1) unsure.push('pulse');
    return { systolic: sys.v, diastolic: dia.v, pulse: pul ? pul.v : null, unsure };
  }

  function readOnce(gray, W, H, dark, densMin) {
    const bin0 = clean(binarize(gray, W, H, dark), W, H);
    // straighten: tilt from the direction of the horizontal bars (median), row profile as fallback
    const hb = components(bin0, W, H).filter(c => (c.x1 - c.x0 + 1) > 2.2 * (c.y1 - c.y0 + 1) && c.n > 30).map(c => {
      const mx = c.sx / c.n, my = c.sy / c.n, vxx = c.sxx / c.n - mx * mx, vxy = c.sxy / c.n - mx * my; return vxx > 0 ? Math.atan(vxy / vxx) * 180 / Math.PI : 0; }).sort((a, b) => a - b);
    let deg = 0;
    if (hb.length >= 3) deg = hb[Math.floor(hb.length / 2)];
    else { let best = -1; for (let a = -12; a <= 12; a += 0.5) { const sc = profileScore(bin0, W, H, a, 0, false); if (sc > best) { best = sc; deg = a; } } }
    deg = Math.max(-15, Math.min(15, deg));
    // Italic slant: lean of the tall vertical bars (dx per dy), median over bars.
    const upright = transform(bin0, W, H, deg, 0);
    const slopes = components(upright, W, H).filter(c => (c.y1 - c.y0 + 1) > 2.2 * (c.x1 - c.x0 + 1) && c.n > 30).map(c => {
      const mx = c.sx / c.n, my = c.sy / c.n, vyy = c.syy / c.n - my * my, vxy = c.sxy / c.n - mx * my; return vyy > 0 ? vxy / vyy : 0; }).sort((a, b) => a - b);
    let shear = slopes.length >= 2 ? slopes[Math.floor(slopes.length / 2)] : 0;
    shear = Math.max(-0.45, Math.min(0.45, shear));
    const binT = transform(bin0, W, H, deg, shear);
    const vbars = components(binT, W, H).filter(c => (c.y1 - c.y0 + 1) > 2.2 * (c.x1 - c.x0 + 1)).map(c => c.y1 - c.y0 + 1).sort((a, b) => b - a);
    const Hd = vbars.length ? vbars[Math.min(1, vbars.length - 1)] * 2.1 : H / 3;
    const bin = dropThin(binT, W, H, Hd, densMin);
    const digits = xyCut(bin, W, H, Hd);
    for (const d of digits) d.r = decodeDigit(bin, W, d);
    const good = digits.filter(d => d.r.dist <= 1);
    const nums = groupNumbers(good);
    return { res: interpret(nums), nums, deg, shear, bin, W, H, digits, dark };
  }

  function readMonitor(src, crop) {
    const { gray, W, H } = toGray(src, crop, 720, 720);
    // Try both polarities (dark digits on light LCD, light digits on backlit LCD); keep the confident one.
    const tries = [readOnce(gray, W, H, true, 0.76), readOnce(gray, W, H, false, 0.76)];
    const score = t => t.res ? 10 - t.res.unsure.length + (t.res.pulse ? 1 : 0) : -1;
    tries.sort((a, b) => score(b) - score(a));
    const t = tries[0];
    // Small pulse digits have thinner bars: if pulse is missing, look again with a looser filter.
    if (t.res && !t.res.pulse) {
      const again = readOnce(gray, W, H, t.dark, 0.55);
      if (again.res && again.res.pulse && again.res.systolic === t.res.systolic && again.res.diastolic === t.res.diastolic) { t.res.pulse = again.res.pulse; if (again.res.unsure.includes('pulse')) t.res.unsure.push('pulse'); }
      else if (again.res && again.res.pulse) { t.res.pulse = again.res.pulse; t.res.unsure.push('pulse'); }
    }
    return { ...(t.res || { systolic: null, diastolic: null, pulse: null, unsure: [] }), found: !!t.res, angle: t.deg, shear: t.shear, numbers: t.nums.map(n => n.text + '@' + n.h + (n.conf < 1 ? '?' : '')), _t: t };
  }

  // Where are the digits? Segment bars are solid, long and thin; find where they cluster.
  function findScreen(src) {
    const { gray, W, H } = toGray(src, null, 900, 900);
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = sw / W;
    let best = null;
    for (const dark of [true, false]) {
      const bars = components(binarize(gray, W, H, dark), W, H).filter(c => {
        const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, L = Math.max(w, h), T = Math.min(w, h);
        return L > Math.min(W, H) * 0.02 && L < Math.min(W, H) * 0.25 && L / T > 2.3 && c.n / (w * h) > 0.5;
      }).map(c => ({ x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2, L: Math.max(c.x1 - c.x0, c.y1 - c.y0), c }));
      if (bars.length < 6) continue;
      // densest neighbourhood: for each bar, count bars of similar size nearby
      let top = null;
      for (const b of bars) {
        const near = bars.filter(o => Math.abs(o.x - b.x) < b.L * 4 && Math.abs(o.y - b.y) < b.L * 4 && o.L > b.L * 0.4 && o.L < b.L * 2.5);
        if (!top || near.length > top.length) top = near;
      }
      if (!top || top.length < 6) continue;
      const x0 = Math.min(...top.map(o => o.c.x0)), x1 = Math.max(...top.map(o => o.c.x1)), y0 = Math.min(...top.map(o => o.c.y0)), y1 = Math.max(...top.map(o => o.c.y1));
      if (!best || top.length > best.n) best = { n: top.length, x0, x1, y0, y1 };
    }
    if (!best) return null;
    const mx = (best.x1 - best.x0) * 0.2 + 10, my = (best.y1 - best.y0) * 0.2 + 10;
    const x = Math.max(0, best.x0 - mx), y = Math.max(0, best.y0 - my);
    return { x: x * k, y: y * k, w: (Math.min(W, best.x1 + mx) - x) * k, h: (Math.min(H, best.y1 + my) - y) * k };
  }

  const quality = r => !r || !r.found ? -1 : 10 - 2 * r.unsure.length + (r.pulse ? 2 : 0);
  // Read a whole photo: as is, then the area where digits cluster, then a few standard crops.
  function readPhoto(src) {
    const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
    let best = null;
    const tryCrop = crop => { let r; try { r = readMonitor(src, crop); } catch (e) { return false; } if (quality(r) > quality(best)) best = r; return quality(best) >= 12; };
    if (tryCrop(null)) return best;
    const scr = findScreen(src);
    if (scr && tryCrop(scr)) return best;
    for (const [fx, fy, fw, fh] of [[0.12, 0.12, 0.76, 0.76], [0.2, 0.15, 0.6, 0.6], [0.05, 0.05, 0.6, 0.6], [0.35, 0.05, 0.6, 0.6], [0.05, 0.35, 0.6, 0.6], [0.35, 0.35, 0.6, 0.6]])
      if (tryCrop({ x: W * fx, y: H * fy, w: W * fw, h: H * fh })) return best;
    return best && best.found ? best : null;
  }

  global.BPOCR = { readMonitor, readPhoto, findScreen };
})(window);
