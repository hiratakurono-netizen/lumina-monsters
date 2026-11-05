// 手続き生成のドット風背景（パララックス）
const Backgrounds = (() => {
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function grad(x, y0, y1, stops) { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  const R = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a | 0, b | 0, w | 0, h | 0); };

  // ---------- sky ----------
  function sky(stops, extra) {
    const [c, x] = cv(VIEW_W, VIEW_H);
    x.fillStyle = grad(x, 0, GROUND_Y, stops); x.fillRect(0, 0, VIEW_W, VIEW_H);
    // ディザっぽい横縞で「ドット絵の空」感
    x.globalAlpha = 0.06;
    for (let y = 0; y < GROUND_Y; y += 4) { x.fillStyle = y % 8 ? '#fff' : '#000'; x.fillRect(0, y, VIEW_W, 1); }
    x.globalAlpha = 1;
    if (extra) extra(x);
    return c;
  }
  function crack(x, cx, cy, len, alpha, seed) {
    const r = rng(seed);
    x.save(); x.globalAlpha = alpha;
    x.strokeStyle = '#d9b8ff'; x.shadowColor = '#a46bff'; x.shadowBlur = 18; x.lineWidth = 3;
    let px = cx, py = cy; x.beginPath(); x.moveTo(px, py);
    for (let i = 0; i < 9; i++) { px += (r() - 0.3) * len / 5; py += (r() - 0.5) * len / 4; x.lineTo(px, py); }
    x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, cy);
    for (let i = 0; i < 6; i++) x.lineTo(cx - r() * len / 2, cy + (r() - 0.5) * len / 2);
    x.stroke(); x.restore();
  }

  // ---------- skyline / buildings ----------
  function skyline(w, h, base, col, winCol, seed, minH, maxH, winRate = 0.25) {
    const [c, x] = cv(w, h), r = rng(seed);
    let px = 0;
    while (px < w) {
      const bw = 40 + r() * 70, bh = minH + r() * (maxH - minH);
      R(x, col, px, base - bh, bw, bh);
      if (r() < 0.3) R(x, col, px + bw * 0.4, base - bh - 14, 6, 14);
      for (let wy = base - bh + 8; wy < base - 8; wy += 10)
        for (let wx = px + 5; wx < px + bw - 6; wx += 9)
          if (r() < winRate) R(x, winCol, wx, wy, 4, 5);
      px += bw + 2;
    }
    return c;
  }

  function street() {
    const s = sky([[0, '#b9a6d6'], [0.55, '#e7c6d8'], [1, '#f4dccf']], x => {
      x.fillStyle = 'rgba(255,240,220,.55)'; x.beginPath(); x.arc(760, 120, 46, 0, 7); x.fill();
      crack(x, 300, 90, 80, 0.12, 7);
    });
    const far = skyline(1920, 400, 400, '#a58fbf', '#c8b5dc', 11, 40, 150, 0.15);
    const [m, mx] = cv(1920, 470), r = rng(3);
    // 住宅・電柱・電線・桜
    for (let i = 0; i < 12; i++) {
      const hx = i * 160 + r() * 30, hw = 120, hh = 90 + r() * 30, top = 470 - 30 - hh;
      const wall = ['#efe3ea', '#e2d6e6', '#f2e9df', '#dcd2e4'][i % 4];
      R(mx, wall, hx, top, hw, hh + 30);
      mx.fillStyle = ['#6a5a8c', '#7c5f7d', '#5d6a8f'][i % 3];
      mx.beginPath(); mx.moveTo(hx - 10, top); mx.lineTo(hx + hw / 2, top - 40); mx.lineTo(hx + hw + 10, top); mx.fill();
      R(mx, '#9db3d8', hx + 18, top + 22, 26, 22); R(mx, '#9db3d8', hx + hw - 44, top + 22, 26, 22);
      R(mx, '#7d6a7a', hx + hw / 2 - 12, top + hh - 20, 24, 50);
      R(mx, '#cfc3d3', hx - 5, 470 - 34, hw + 10, 34); // 塀
      for (let b = 0; b < hw + 10; b += 16) R(mx, '#bdb0c4', hx - 5 + b, 470 - 34, 1, 34);
    }
    for (let i = 0; i < 6; i++) { // 桜
      const tx = i * 330 + 90;
      R(mx, '#6b4f5e', tx, 300, 12, 140);
      mx.fillStyle = '#f2c6d6';
      for (let k = 0; k < 26; k++) { mx.beginPath(); mx.arc(tx + 6 + (r() - 0.5) * 110, 290 + (r() - 0.5) * 70, 14 + r() * 12, 0, 7); mx.fill(); }
      mx.fillStyle = '#fbe2ea';
      for (let k = 0; k < 12; k++) { mx.beginPath(); mx.arc(tx + 6 + (r() - 0.5) * 90, 275 + (r() - 0.5) * 50, 8, 0, 7); mx.fill(); }
    }
    for (let i = 0; i < 5; i++) { const px = i * 400 + 200; R(mx, '#5c5068', px, 140, 8, 330); R(mx, '#5c5068', px - 20, 160, 48, 5); }
    mx.strokeStyle = 'rgba(60,50,80,.6)'; mx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { mx.beginPath(); mx.moveTo(0, 165 + k * 6); for (let px = 0; px <= 1920; px += 400) mx.quadraticCurveTo(px + 200 - 200, 190 + k * 6, px + 204, 165 + k * 6); mx.stroke(); }
    const floor = floorTile([['#8d84a0', 0, 22], ['#6f6684', 22, 50]], fx => {
      for (let i = 0; i < 1920; i += 120) R(fx, '#e9e2f0', i, 40, 60, 4);
      R(fx, '#b4aac4', 0, 0, 1920, 4);
    });
    return { sky: s, layers: [{ img: far, f: 0.15, y: 70 }, { img: m, f: 0.55, y: 0 }], floor, tint: null, ambient: 'petal' };
  }

  function schoolyard() {
    const s = sky([[0, '#3a1e4a'], [0.5, '#8a3b5c'], [1, '#e0805f']], x => {
      crack(x, 520, 70, 160, 0.55, 21); crack(x, 200, 140, 90, 0.4, 5);
      x.fillStyle = 'rgba(30,10,30,.35)';
      for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(120 + i * 160, 200 + (i % 2) * 30, 90, 40, 0, 0, 7); x.fill(); }
    });
    const far = skyline(1920, 400, 400, '#4a2848', '#ff9a6a', 31, 50, 160, 0.08);
    const [m, mx] = cv(1920, 470), r = rng(9);
    // 校舎
    const by = 170;
    R(mx, '#cdbfcf', 60, by, 1800, 300 - 40);
    R(mx, '#b3a3b8', 60, by, 1800, 10);
    for (let f = 0; f < 3; f++) for (let wx = 90; wx < 1840; wx += 70) {
      const lit = r() < 0.15;
      R(mx, lit ? '#ffb38a' : '#6e5a7e', wx, by + 30 + f * 78, 46, 44);
      R(mx, '#cdbfcf', wx + 22, by + 30 + f * 78, 2, 44);
      if (r() < 0.12) R(mx, '#2a1630', wx + 6, by + 40 + f * 78, 20, 20);
    }
    R(mx, '#cdbfcf', 900, by - 70, 120, 70); R(mx, '#f4eef5', 935, by - 55, 50, 50);
    mx.fillStyle = '#4a3a50'; mx.fillRect(959, by - 50, 2, 22); mx.fillRect(959, by - 30, 16, 2);
    // フェンス
    mx.strokeStyle = 'rgba(70,60,80,.55)'; mx.lineWidth = 1;
    for (let fx = 0; fx < 1920; fx += 10) { mx.beginPath(); mx.moveTo(fx, 380); mx.lineTo(fx + 40, 470); mx.moveTo(fx + 40, 380); mx.lineTo(fx, 470); mx.stroke(); }
    for (let fx = 0; fx < 1920; fx += 160) R(mx, '#4d4256', fx, 370, 5, 100);
    R(mx, '#4d4256', 0, 370, 1920, 4);
    const floor = floorTile([['#b89a7a', 0, 72]], fx => {
      const rr = rng(4);
      for (let i = 0; i < 500; i++) R(fx, rr() < 0.5 ? '#a68869' : '#c8ab8a', rr() * 1920, rr() * 72, 2, 2);
      R(fx, '#efe6dc', 0, 18, 1920, 3);
    });
    return { sky: s, layers: [{ img: far, f: 0.15, y: 60 }, { img: m, f: 0.6, y: 0 }], floor, ambient: 'ash' };
  }

  function corridor() {
    const s = sky([[0, '#3d2c48'], [1, '#2a1f33']]);
    const [m, mx] = cv(1920, 470), r = rng(17);
    R(mx, '#cbbfc9', 0, 40, 1920, 430);
    R(mx, '#9c8ea0', 0, 360, 1920, 110); R(mx, '#7f7085', 0, 356, 1920, 6);
    R(mx, '#e6dde4', 0, 40, 1920, 18);
    for (let i = 0; i < 6; i++) { // 窓（赤い空）
      const wx = 60 + i * 320;
      mx.fillStyle = grad(mx, 110, 300, [[0, '#4a1c3c'], [1, '#d66a55']]); mx.fillRect(wx, 110, 200, 190);
      crack(mx, wx + 100, 150, 60, 0.4, i + 3);
      R(mx, '#e6dde4', wx + 98, 110, 5, 190); R(mx, '#e6dde4', wx, 200, 200, 5);
      R(mx, '#8a7b8e', wx - 6, 104, 212, 6); R(mx, '#8a7b8e', wx - 6, 300, 212, 8);
    }
    for (let i = 0; i < 3; i++) { // 教室ドア
      const dx = 280 + i * 640;
      R(mx, '#8b6f62', dx, 160, 70, 196); R(mx, '#a5897b', dx + 8, 168, 54, 70);
      R(mx, '#6d5248', dx + 50, 260, 6, 18);
      R(mx, '#efe8ec', dx + 4, 132, 62, 20);
      mx.fillStyle = '#4a3d50'; mx.font = '14px DotGothic16, monospace'; mx.fillText(['2-A', '2-B', '2-C'][i], dx + 20, 147);
    }
    for (let i = 0; i < 10; i++) { const px = r() * 1920; R(mx, '#e5e0b8', px, 320, 30, 26); R(mx, '#d27a7a', px + 4, 324, 8, 3); }
    const floor = floorTile([['#8f8494', 0, 72]], fx => {
      for (let i = 0; i < 1920; i += 64) R(fx, '#7d7283', i, 0, 2, 72);
      R(fx, '#b2a7b8', 0, 0, 1920, 3);
      fx.globalAlpha = 0.2; R(fx, '#fff', 0, 10, 1920, 6); fx.globalAlpha = 1;
    });
    return { sky: s, layers: [{ img: m, f: 0.9, y: 0 }], floor, ambient: 'dust', dim: 0.12 };
  }

  function homeec() {
    const s = sky([[0, '#2f2a3a'], [1, '#1f1a28']]);
    const [m, mx] = cv(1920, 470), r = rng(41);
    R(mx, '#bfc6cc', 0, 40, 1920, 430);
    for (let y = 40; y < 470; y += 16) R(mx, '#aab2b9', 0, y, 1920, 1);
    for (let x = 0; x < 1920; x += 16) R(mx, '#aab2b9', x, 40, 1, 430);
    for (let i = 0; i < 4; i++) { // 吊り戸棚
      const cx = 80 + i * 480; R(mx, '#d8cbb8', cx, 80, 300, 90); R(mx, '#b9aa95', cx + 148, 80, 4, 90);
      R(mx, '#9a8b78', cx + 130, 150, 14, 4); R(mx, '#9a8b78', cx + 158, 150, 14, 4);
    }
    for (let i = 0; i < 6; i++) { // 調理台
      const tx = 30 + i * 320;
      R(mx, '#8d8f97', tx, 330, 260, 140); R(mx, '#d6d8de', tx - 6, 318, 272, 14);
      R(mx, '#6e7078', tx + 20, 350, 100, 80); R(mx, '#6e7078', tx + 140, 350, 100, 80);
      R(mx, '#3a3c44', tx + 30, 305, 40, 14); R(mx, '#3a3c44', tx + 90, 305, 40, 14);
      if (r() < 0.4) { mx.fillStyle = '#c86a4a'; mx.beginPath(); mx.ellipse(tx + 200, 308, 26, 10, 0, 0, 7); mx.fill(); }
    }
    const floor = floorTile([['#7d7a86', 0, 72]], fx => {
      for (let i = 0; i < 1920; i += 36) for (let j = 0; j < 72; j += 36) if (((i + j) / 36) % 2 === 0) R(fx, '#6f6c78', i, j, 36, 36);
    });
    return { sky: s, layers: [{ img: m, f: 0.9, y: 0 }], floor, ambient: 'steam', dim: 0.18 };
  }

  function rooftop(calm) {
    const s = sky(calm
      ? [[0, '#3b2f6a'], [0.45, '#c26a8a'], [0.8, '#f2a46a'], [1, '#ffd29a']]
      : [[0, '#1d1236'], [0.45, '#7a2d6a'], [0.8, '#e86a52'], [1, '#ffb070']], x => {
      x.fillStyle = 'rgba(255,200,150,.7)'; x.beginPath(); x.arc(700, 360, 70, 0, 7); x.fill();
      if (!calm) { crack(x, 480, 60, 260, 0.9, 77); crack(x, 480, 60, 200, 0.6, 78); }
      else crack(x, 480, 60, 90, 0.18, 77);
    });
    const far = skyline(1920, 420, 420, calm ? '#4a2f5c' : '#2c173a', '#ffcf8a', 51, 60, 210, 0.2);
    const [m, mx] = cv(1920, 470);
    R(mx, '#6a5a72', 1250, 230, 140, 110); R(mx, '#58495f', 1250, 230, 140, 10);
    R(mx, '#4d4054', 1260, 340, 10, 130); R(mx, '#4d4054', 1370, 340, 10, 130);
    mx.strokeStyle = 'rgba(40,30,50,.7)';
    for (let fx = 0; fx < 1920; fx += 12) { mx.beginPath(); mx.moveTo(fx, 340); mx.lineTo(fx + 48, 470); mx.moveTo(fx + 48, 340); mx.lineTo(fx, 470); mx.stroke(); }
    for (let fx = 0; fx < 1920; fx += 200) R(mx, '#3b3042', fx, 330, 6, 140);
    R(mx, '#3b3042', 0, 330, 1920, 5);
    if (!calm) { mx.clearRect(700, 330, 260, 140); R(mx, '#3b3042', 690, 360, 30, 6); }
    const floor = floorTile([['#8d8090', 0, 72]], fx => {
      for (let i = 0; i < 1920; i += 96) R(fx, '#7a6e7e', i, 0, 2, 72);
      R(fx, '#a99dad', 0, 0, 1920, 3);
    });
    return { sky: s, layers: [{ img: far, f: 0.1, y: 50 }, { img: m, f: 0.7, y: 0 }], floor, ambient: calm ? 'mote' : 'ember' };
  }


  // 現世の町（夕方の商店街）。施設の建物は town.js 側で描く
  function town() {
    const s = sky([[0, '#4b3a78'], [0.5, '#c27a8e'], [1, '#f2b48a']], x => {
      x.fillStyle = 'rgba(255,214,160,.65)'; x.beginPath(); x.arc(640, 330, 60, 0, 7); x.fill();
      crack(x, 300, 80, 70, 0.14, 91);
    });
    const far = skyline(1920, 420, 420, '#6a4a7a', '#ffcf8a', 61, 50, 170, 0.12);
    const [m, mx] = cv(1920, 470), r = rng(77);
    for (let i = 0; i < 16; i++) {  // 低い家並み
      const hx = i * 120 + r() * 20, hw = 100, hh = 70 + r() * 40, top = 470 - 40 - hh;
      R(mx, ['#d9c6d2', '#cbb8cf', '#e2d1c6'][i % 3], hx, top, hw, hh + 40);
      mx.fillStyle = ['#6a5a8c', '#7c5f7d', '#5d6a8f'][i % 3];
      mx.beginPath(); mx.moveTo(hx - 8, top); mx.lineTo(hx + hw / 2, top - 30); mx.lineTo(hx + hw + 8, top); mx.fill();
      R(mx, r() < 0.5 ? '#ffd9a0' : '#8a7fa6', hx + 16, top + 18, 20, 16); R(mx, r() < 0.5 ? '#ffd9a0' : '#8a7fa6', hx + hw - 36, top + 18, 20, 16);
    }
    for (let i = 0; i < 6; i++) { const px = i * 340 + 120; R(mx, '#4d4256', px, 150, 6, 320); R(mx, '#4d4256', px - 16, 168, 38, 4); }
    mx.strokeStyle = 'rgba(50,40,70,.55)'; mx.lineWidth = 1;
    for (let k = 0; k < 2; k++) { mx.beginPath(); mx.moveTo(0, 172 + k * 6); for (let px = 0; px <= 1920; px += 340) mx.quadraticCurveTo(px + 170, 196 + k * 6, px + 340, 172 + k * 6); mx.stroke(); }
    const road = IMG[ENV.ground_road];
    const floor = floorTile([['#9a8ea6', 0, 14], ['#7d7290', 14, 72]], fx => {
      if (road && road.width) { for (let i = 0; i < 1920; i += road.width) { fx.drawImage(road, i, 0, road.width, 48); fx.drawImage(road, 0, 20, road.width, 28, i, 48, road.width, 28); } return; }
      for (let i = 0; i < 1920; i += 48) R(fx, '#8b7f9c', i, 14, 2, 58);
      R(fx, '#c9bfd6', 0, 0, 1920, 3);
    });
    return { sky: s, layers: [{ img: far, f: 0.15, y: 50 }, { img: m, f: 0.5, y: 0 }], floor, ambient: 'petal', zoom: 1.4 };
  }


  // 魔界・草原（紫がかった空と草の丘。床は暗い奈落＝穴の底に見える）
  // 草原：もらった背景素材（夜の丘と木）を地面まで届く高さに拡大し、左右反転をつなげて継ぎ目なく流す
  function grasslandArt() {
    const src = IMG[ENV.bg_grass]; if (!src || !src.width) return null;
    const H = GROUND_Y + 16, k = H / src.height, w = Math.round(src.width * k);
    const [tile, tx] = cv(w * 2, H);
    tx.drawImage(src, 0, 0, w, H);
    tx.save(); tx.translate(w * 2, 0); tx.scale(-1, 1); tx.drawImage(src, 0, 0, w, H); tx.restore();
    const [s, sx] = cv(VIEW_W, VIEW_H); sx.fillStyle = '#28234f'; sx.fillRect(0, 0, VIEW_W, VIEW_H);
    const floor = floorTile([['#0e0818', 0, 72]]);
    return { sky: s, layers: [{ img: tile, f: 0.25, y: 0 }], floor, ambient: 'mote' };
  }
  // 砂漠・雪原・火山：素材の帯（空＋奥から手前へ2〜3枚）を縦に重ね、手前ほど速く流す
  function biomeArt(name, n) {
    const sky = IMG[ENV[`${name}_sky`]]; if (!sky || !sky.width) return null;
    const layers = [];
    for (let i = 0; i < n; i++) layers.push(IMG[ENV[`${name}_layer${i}`]]);
    const k = 1.25;   // 帯の拡大率
    const mirror = im => {   // 左右反転をつなげて継ぎ目なく流す
      const w = Math.round(im.width * k), h = Math.round(im.height * k), [c, x] = cv(w * 2, h);
      x.drawImage(im, 0, 0, w, h); x.save(); x.translate(w * 2, 0); x.scale(-1, 1); x.drawImage(im, 0, 0, w, h); x.restore();
      // 帯の上側をぼかして、奥の帯や空となじませる（帯の境目の横線を消す）
      x.globalCompositeOperation = 'destination-in';
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.4, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = g; x.fillRect(0, 0, w * 2, h);
      return c;
    };
    // 手前の帯の下端を地面に合わせ、奥の帯ほど上に（少し重ねて）置く
    const out = []; let bottom = GROUND_Y + 14;
    for (let i = n - 1; i >= 0; i--) {
      const img = mirror(layers[i]); out.unshift({ img, f: 0.12 + 0.18 * i, y: bottom - img.height });
      bottom = bottom - img.height * 0.55;
    }
    const [s, sx] = cv(VIEW_W, VIEW_H);
    sx.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, VIEW_W, Math.max(bottom + 40, sky.height * k));
    return { sky: s, layers: out, floor: floorTile([['#1a1018', 0, 72]]), ambient: name === 'snow' ? 'snowfall' : name === 'volcano' ? 'ember' : 'sand' };
  }
  function grassland() {
    const art = grasslandArt(); if (art) return art;
    const s = sky([[0, '#1f1838'], [0.5, '#3d3a6a'], [1, '#6a8a8a']], x => {
      x.fillStyle = 'rgba(220,240,255,.75)'; x.beginPath(); x.arc(760, 110, 52, 0, 7); x.fill();
      x.fillStyle = 'rgba(31,24,56,.9)'; x.beginPath(); x.arc(780, 100, 46, 0, 7); x.fill();   // 欠けた月
      crack(x, 260, 70, 120, 0.35, 33);
    });
    const [far, fx] = cv(1920, 420), r = rng(5);
    fx.fillStyle = '#2e2a52';
    for (let i = 0; i < 9; i++) { const bx = i * 220 + r() * 60, h = 120 + r() * 120; fx.beginPath(); fx.moveTo(bx - 140, 420); fx.lineTo(bx, 420 - h); fx.lineTo(bx + 140, 420); fx.fill(); }
    fx.fillStyle = '#3a4a62';
    for (let i = 0; i < 6; i++) { const bx = i * 330 + r() * 80; fx.beginPath(); fx.ellipse(bx, 420, 220, 90 + r() * 40, 0, Math.PI, 0); fx.fill(); }
    const [m, mx] = cv(1920, 470);
    for (let i = 0; i < 7; i++) {  // 浮かぶ岩と、ねじれた木
      const tx = i * 280 + r() * 60, ty = 120 + r() * 120;
      mx.fillStyle = '#4a4466'; mx.beginPath(); mx.moveTo(tx - 40, ty); mx.lineTo(tx + 40, ty); mx.lineTo(tx + 10, ty + 50); mx.fill();
      mx.fillStyle = '#6fa06a'; mx.fillRect(tx - 40, ty - 6, 80, 8);
    }
    for (let i = 0; i < 8; i++) {
      const tx = i * 250 + 60 + r() * 40;
      mx.fillStyle = '#2f2840'; mx.fillRect(tx, 300, 12, 170);
      mx.fillStyle = 'rgba(90,140,110,.85)';
      for (let k = 0; k < 14; k++) { mx.beginPath(); mx.arc(tx + 6 + (r() - 0.5) * 100, 290 + (r() - 0.5) * 60, 12 + r() * 12, 0, 7); mx.fill(); }
    }
    const floor = floorTile([['#0e0818', 0, 72]], x => { x.fillStyle = 'rgba(120,80,200,.18)'; for (let i = 0; i < 40; i++) x.fillRect(rng(9)() * 1920, 20 + (i % 5) * 10, 3, 3); });
    return { sky: s, layers: [{ img: far, f: 0.15, y: 60 }, { img: m, f: 0.45, y: 0 }], floor, ambient: 'mote', zoom: 1.4 };
  }

  function floorTile(bands, extra) {
    const [c, x] = cv(1920, VIEW_H - GROUND_Y);
    bands.forEach(([col, y0, y1]) => R(x, col, 0, y0, 1920, y1 - y0));
    if (extra) extra(x);
    return c;
  }

  const cache = {};
  function get(name) {
    if (!cache[name]) cache[name] = ({
      street, schoolyard, corridor, homeec, town, grassland,
      desert: () => biomeArt('desert', 2), snow: () => biomeArt('snow', 3), volcano: () => biomeArt('volcano', 3),
      rooftop: () => rooftop(false), rooftop_calm: () => rooftop(true),
    })[name]();
    return cache[name];
  }

  function draw(ctx, bg, camX) {
    ctx.drawImage(bg.sky, 0, 0);
    // zoom：遠景・中景を地面の高さを基準に拡大する（町・魔界は 1.4 倍で建物や木を大きく見せる）
    const z = bg.zoom || 1;
    for (const L of bg.layers) {
      const w = L.img.width * z, h = L.img.height * z, y = GROUND_Y + (L.y - GROUND_Y) * z, off = -((camX * L.f) % w);
      for (let x = off; x < VIEW_W; x += w) ctx.drawImage(L.img, Math.floor(x), Math.floor(y), Math.ceil(w) + 1, h);
    }
    const w = bg.floor.width, off = -(camX % w);
    for (let x = off; x < VIEW_W; x += w) ctx.drawImage(bg.floor, Math.floor(x), GROUND_Y);
    if (bg.dim) { ctx.fillStyle = `rgba(10,5,20,${bg.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  return { get, draw };
})();
