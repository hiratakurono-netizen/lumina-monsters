// =====================================================================
//  地形ギミック（本編のダンジョン）
//  generator.js が ch.feats（ギミックの一覧）と、足場の印（move / crumble / fragile / style / off）を作る。
//  ここでは毎フレームの動き・攻撃が当たった時・描画を受け持つ。
//
//  属性と環境の関係（新しい属性を足す時は WALL_EL と hit() に1行足す）
//    炎 … 草のつる・雪山・氷塊を燃やす／溶かす、いばらを焼く、燭台に火を灯す
//    氷 … 水を凍らせて足場にする、溶岩を冷やして足場にする、溶岩の岩を砕く
//    砂 … 砂の壁を崩す、埋まった宝箱を掘り出す
// =====================================================================
const WALL_EL = {
  vines: { el: 'fire', need: '炎で燃やせそう', ok: '燃えている！', col: '#ffb35a' },
  snowpile: { el: 'fire', need: '炎で溶かせそう', ok: '溶けていく！', col: '#ffb35a' },
  icewall: { el: 'fire', need: '炎なら一撃で溶ける', ok: '溶けていく！', col: '#ffb35a' },
  sandwall: { el: 'sand', need: '砂の力で崩せそう', ok: '崩れていく！', col: '#e8c890' },
  magmarock: { el: 'ice', need: '冷やせば砕けそう', ok: '冷えて固まる！', col: '#9fe0ff' },
  mound: { el: 'sand', need: '掘り出せそう', ok: '', col: '#e8c890' },
  boulder: { el: 'fire', need: '', ok: '', col: '#fff' },
  rubble: { el: null, need: '', ok: '', col: '#fff' },
  cracked: { el: null, need: '', ok: '', col: '#fff' },
  seal: { el: 'candles', need: '燭台に火を灯すと開く', ok: '', col: '#d9a0ff' },
};

const Gimmicks = {
  init(W) {
    W.feats = (W.ch.feats || []).map(f => Object.assign({ t: 0, cd: 0, msgT: 0 }, f));
    W.byGid = new Map(W.terrain.solids.filter(s => s.gid).map(s => [s.gid, s]));
    for (const s of W.terrain.solids) if (s.crumble || s.fragile) { s.ct = 0; s.respawn = 0; }
    W.stormT = 0;
  },

  // ---------------- 毎フレーム ----------------
  update(W, dt) {
    const P = W.player, T = W.terrain;
    P.gimSlow = 1; P.gimJump = 1;
    // 動く床（横に往復）。乗っている主人公は Player.physics が dx の分だけ運ぶ
    for (const s of T.solids) {
      if (s.move) { const m = s.move; m.t = (m.t || m.phase * m.period) + dt; const nx = m.x0 + (1 - Math.cos(m.t / m.period * Math.PI * 2)) / 2 * m.range; s.dx = nx - s.x; s.x = nx; }
      // 崩れる足場：乗ると揺れ、0.55秒で落ちる。3秒で元に戻る
      if (s.crumble || s.fragile) {
        if (s.off) { s.respawn -= dt; if (s.respawn <= 0) { s.off = false; s.ct = 0; s.shake = false; } continue; }
        const on = P.onGround && Math.abs(P.y - s.y) < 2 && P.x + 12 > s.x && P.x - 12 < s.x + s.w;
        if (s.crumble && on) s.ct += dt; else if (s.ct > 0 && !s.falling) s.ct = Math.max(0, s.ct - dt * 0.5);
        s.shake = s.ct > 0.05;
        if (s.ct > 0.55 || s.falling) { s.off = true; s.falling = false; s.respawn = s.fragile ? 6 : 3; W.dust(s.x + s.w / 2, s.y + 6, 8); Audio2.sfx('kick'); }
      }
    }
    // ボスの突進・飛びかかりで、ボス部屋の足場が壊れる（火山・魔王城）
    if (W.ch.bossBreak && W.boss && W.boss.hp > 0) {
      const b = W.boss.box();
      for (const s of T.solids) if (s.fragile && !s.off && b[0] < s.x + s.w && b[2] > s.x && b[1] < s.y + 10 && b[3] > s.y - 30) { s.falling = true; W.shake = Math.max(W.shake, 8); W.floatText(s.x + s.w / 2, s.y - 30, '足場が砕けた！', '#ffb0a0', 14); }
    }
    for (const f of W.feats) {
      f.t += dt; f.cd -= dt; f.msgT -= dt;
      const s = f.gid && W.byGid.get(f.gid);
      if (f.kind === 'wall' && !f.broken && f.el === 'candles') {
        const lit = W.objs.filter(o => o.seal === f.seal && o.lit).length;
        if (lit >= f.candles) { this.breakWall(W, f, s); W.floatText(s.x, GROUND_Y - 200, '封印が解けた！', '#d9a0ff', 20); }
      }
      if (f.kind === 'wall' && !f.broken && f.gate && Math.abs(P.x - s.x) < 220 && f.msgT <= 0 && W.state === 'play') {
        f.msgT = 6; const info = WALL_EL[f.style];
        if (info && info.need) W.floatText(s.x + s.w / 2, GROUND_Y - 230, info.need + (f.el === 'candles' ? `（${W.objs.filter(o => o.seal === f.seal && o.lit).length}/${f.candles}）` : ''), info.col, 15);
      }
      if (f.kind === 'portcullis') {   // 落とし格子：開く→閉じるをくり返す。主人公が下にいる間は閉じない
        const ph = ((f.t / f.period) + f.phase) % 1, want = ph < 0.5;   // 前半は閉じている
        const under = Math.abs(P.x - (s.x + s.w / 2)) < 30;
        if (want && s.off && !under) { s.off = false; Audio2.sfx('slam'); W.shake = Math.max(W.shake, 3); }
        if (!want) s.off = true;
        s.lift = s.off ? Math.min(1, (s.lift || 0) + dt * 3) : Math.max(0, (s.lift || 0) - dt * 6);
      }
      if (f.kind === 'thorns' && !f.dead && P.onGround && P.x > f.x && P.x < f.x + f.w && Math.abs(P.y - GROUND_Y) < 3 && f.cd <= 0) { f.cd = 0.8; P.hurt(5, P.x - P.face * 30); }
      if (f.kind === 'quicksand' && P.onGround && P.x > f.x && P.x < f.x + f.w && Math.abs(P.y - GROUND_Y) < 3) { P.gimSlow = 0.45; P.gimJump = 0.8; if (Math.random() < 0.2) W.dust(P.x, GROUND_Y, 1, '#d9c08c'); }
      if (f.kind === 'icicle') this.icicle(W, f, dt);
      if (f.kind === 'eruptor' || f.kind === 'eruptor_dark') {
        const ph = ((f.t / f.period) + f.phase) % 1; f.state = ph < 0.55 ? 'idle' : ph < 0.78 ? 'warn' : 'erupt';
        if (f.state === 'erupt' && Math.abs(P.x - f.x) < 34 && P.y > GROUND_Y - 230 && f.cd <= 0) { f.cd = 0.6; P.hurt(12, f.x); }
        if (f.state === 'erupt' && Math.random() < 0.6) W.spark(f.x + rand(-14, 14), GROUND_Y - rand(0, 200), f.kind === 'eruptor' ? '#ff9a3a' : '#c58aff', 1, -rand(200, 500));
      }
      // 液体（水・溶岩）に落ちたら、すぐ手前の足場へ戻る
      if (f.kind === 'bridge' && !f.on && P.y > GROUND_Y + 40 && P.x > f.x && P.x < f.x + f.w) P.fellInPit();
    }
    // 燭台：ふれると火が灯る（封印の扉）
    for (const o of W.objs) if (o.kind === 'candle' && o.seal && !o.lit && Math.abs(P.x - o.x) < 40 && Math.abs(P.y - o.y) < 70) { o.lit = true; Audio2.sfx('fire'); W.spark(o.x, o.y - 70, '#ffb35a', 12); }
    // 砂嵐（砂漠）：14秒ごとに5秒、向かい風で押し戻され、視界が悪くなる
    if (W.ch.storm && W.state === 'play' && !W.dialogue) {
      W.stormT += dt; const ph = W.stormT % 14;
      if (ph > 8 && ph - dt <= 8) W.floatText(P.x, P.y - 170, '砂嵐が来る…！', '#e8c890', 16);
      W.storm = ph > 9 ? Math.min(1, (ph - 9) * 2, (14 - ph) * 2) : 0;
      if (W.storm > 0.3) { const nx = P.x - 80 * W.storm * dt; P.x = T.blockX(nx, P.x, P.y - 120, P.y - 4, 18); if (Math.random() < W.storm) W.dust(P.x + rand(0, 400), rand(200, GROUND_Y), 1, '#d9c08c'); }
    }
  },
  icicle(W, f, dt) {
    const P = W.player;
    if (!f.st) { f.st = 'hang'; f.y = 40; }
    if (f.st === 'hang' && Math.abs(P.x - f.x) < 90 && f.cd <= 0) { f.st = 'shake'; f.k = 0.5; }
    if (f.st === 'shake') { f.k -= dt; if (f.k <= 0) { f.st = 'fall'; f.vy = 0; } }
    if (f.st === 'fall') {
      f.vy += 2200 * dt; f.y += f.vy * dt;
      if (overlap([f.x - 12, f.y - 40, f.x + 12, f.y], P.box())) { P.hurt(11, f.x); f.y = GROUND_Y; }
      if (f.y >= GROUND_Y) { f.st = 'gone'; f.k = 6; W.spark(f.x, GROUND_Y - 10, '#cfefff', 12); Audio2.sfx('kick'); }
    }
    if (f.st === 'gone') { f.k -= dt; if (f.k <= 0) { f.st = 'hang'; f.y = 40; f.cd = 1.5; } }
  },
  breakWall(W, f, s) {
    f.broken = true; s.off = true;
    W.shake = Math.max(W.shake, 8); Audio2.sfx('slam');
    const col = { vines: '#6fa06a', sandwall: '#d9c08c', mound: '#d9c08c', snowpile: '#f4fbff', icewall: '#bfe9ff', magmarock: '#5a3a3a', rubble: '#8a8090', cracked: '#8a8090', boulder: '#8a8090', seal: '#c58aff' }[f.style] || '#aaa';
    for (let i = 0; i < 4; i++) W.dust(s.x + s.w / 2, s.y + s.h - i * Math.min(80, s.h / 4), 6, col);
    if (f.secret) { W.floatText(s.x, Math.max(120, s.y + s.h - 60), '隠し通路！', '#ffe27a', 20); Audio2.sfx('lvup'); }
    if (f.block) for (const c of W.chests) if (c.lockedBy === f.gid) { c.lockedBy = null; W.floatText(c.x, c.y - 70, '宝箱が出てきた！', '#ffe27a', 18); }
  },

  // ---------------- 攻撃が当たった時 ----------------
  hit(W, box, el, special) {
    for (const f of W.feats) {
      const s = f.gid && W.byGid.get(f.gid);
      if (f.kind === 'wall' && !f.broken && s && overlap(box, [s.x - 6, Math.max(s.y, GROUND_Y - 300), s.x + s.w + 6, s.y + s.h])) {
        if (f.cd > 0) continue; f.cd = 0.18;
        if (f.el === 'candles') { if (f.msgT <= 0) { f.msgT = 2; W.floatText(s.x + s.w / 2, GROUND_Y - 200, '燭台に火を灯すと開く', '#d9a0ff', 15); } continue; }
        const need = f.el, ok = !need || el === need;
        if (!ok) { W.spark(s.x + s.w / 2, box[1] + 30, '#ffffff', 4); if (f.msgT <= 0) { f.msgT = 2; W.floatText(s.x + s.w / 2, GROUND_Y - 200, `${ELEMENTS[need].name}属性が必要（近くに源がある）`, ELEMENTS[need].color, 15); } continue; }
        f.hp -= (f.fastEl && el === f.fastEl) || special ? 99 : 1;
        W.spark(s.x + s.w / 2, box[1] + 30, need ? ELEMENTS[need].color : '#e8e0d0', 10); Audio2.sfx('kick');
        if (need && WALL_EL[f.style] && WALL_EL[f.style].ok && f.hp > 0) W.floatText(s.x + s.w / 2, GROUND_Y - 200, WALL_EL[f.style].ok, ELEMENTS[need].color, 15);
        if (f.hp <= 0) this.breakWall(W, f, s);
      }
      // 氷で水を凍らせる・溶岩を冷やす：穴のふちで攻撃すると、穴をふさぐ足場が現れる（ずっと残る）
      if (f.kind === 'bridge' && !f.on && el === f.el && overlap(box, [f.x - 30, GROUND_Y - 80, f.x + f.w + 30, GROUND_Y + 60])) {
        f.on = true; s.off = false; Audio2.sfx('transform'); W.flash = 0.25;
        W.floatText(f.x + f.w / 2, GROUND_Y - 120, f.liquid === 'water' ? '水が凍った！' : '溶岩が冷えて固まった！', '#bfe9ff', 20);
        for (let i = 0; i < 16; i++) W.spark(f.x + rand(0, f.w), GROUND_Y, '#cfefff', 2);
      }
      if (f.kind === 'thorns' && !f.dead && el === 'fire' && overlap(box, [f.x, GROUND_Y - 40, f.x + f.w, GROUND_Y])) { f.dead = true; W.floatText(f.x + f.w / 2, GROUND_Y - 80, 'いばらが燃え尽きた', '#ffb35a', 15); for (let i = 0; i < 10; i++) W.spark(f.x + rand(0, f.w), GROUND_Y - 10, '#ff9a3a', 2); }
      if (f.kind === 'tallgrass' && !f.dead && overlap(box, [f.x, GROUND_Y - 60, f.x + f.w, GROUND_Y])) { f.dead = true; W.dust(f.x + f.w / 2, GROUND_Y - 20, 8, el === 'fire' ? '#ff9a3a' : '#6fa06a'); }
      if (f.kind === 'icicle' && f.st === 'hang' && overlap(box, [f.x - 14, 0, f.x + 14, 120])) { f.st = 'fall'; f.vy = 0; }
    }
    // 燭台：炎の攻撃でも灯る
    if (el === 'fire') for (const o of W.objs) if (o.kind === 'candle' && o.seal && !o.lit && overlap(box, [o.x - 20, o.y - 90, o.x + 20, o.y])) { o.lit = true; Audio2.sfx('fire'); }
  },

  // ---------------- 描画 ----------------
  drawBack(W, ctx, cam) {
    for (const f of W.feats) {
      const s = f.gid && W.byGid.get(f.gid);
      if (f.kind === 'bridge') this.drawLiquid(ctx, f, s, cam, W.time);
      if (f.kind === 'wall' && !f.broken) this.drawWall(ctx, f, s, cam, W);
      if (f.kind === 'portcullis') this.drawGate(ctx, s, cam);
      if (f.kind === 'stone') this.drawWall(ctx, { style: 'rubble', hp: 1, maxHp: 1, cd: 0 }, s, cam, W);
      const x = Math.round((f.x || 0) - cam);
      if (x < -300 || x > VIEW_W + 300) continue;
      if (f.kind === 'thorns' && !f.dead) { ctx.strokeStyle = '#5a3a4a'; ctx.lineWidth = 3; for (let i = 0; i < f.w; i += 14) { ctx.beginPath(); ctx.moveTo(x + i, GROUND_Y); ctx.lineTo(x + i + 7, GROUND_Y - 22 - (i % 3) * 6); ctx.lineTo(x + i + 14, GROUND_Y); ctx.stroke(); } ctx.fillStyle = '#c84a6a'; for (let i = 6; i < f.w; i += 28) ctx.fillRect(x + i, GROUND_Y - 20, 4, 4); }
      if (f.kind === 'quicksand') { const g = ctx.createLinearGradient(0, GROUND_Y - 6, 0, GROUND_Y + 30); g.addColorStop(0, '#c9a46a'); g.addColorStop(1, '#8a6a3a'); ctx.fillStyle = g; ctx.fillRect(x, GROUND_Y - 6, f.w, 36); ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + f.w / 2, GROUND_Y + 2, (f.w / 2 - 10) * ((W.time * 0.4 + i / 3) % 1), 5 * ((W.time * 0.4 + i / 3) % 1), 0, 0, 7); ctx.stroke(); } }
      if (f.kind === 'eruptor' || f.kind === 'eruptor_dark') {
        const dark = f.kind === 'eruptor_dark', c1 = dark ? '#7a4aa8' : '#ff6a2a', c2 = dark ? '#e0b0ff' : '#ffd36a';
        ctx.fillStyle = dark ? '#2a1a3a' : '#3a1a14'; ctx.fillRect(x - 26, GROUND_Y - 6, 52, 8);
        if (f.state === 'warn') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + Math.sin(W.time * 30) * 0.2; ctx.fillStyle = c1; ctx.fillRect(x - 22, GROUND_Y - 10, 44, 8); ctx.restore(); }
        if (f.state === 'erupt') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, GROUND_Y - 240, 0, GROUND_Y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(x - 26, GROUND_Y - 240, 52, 240); ctx.fillStyle = c2; ctx.globalAlpha = 0.6; ctx.fillRect(x - 10, GROUND_Y - 200, 20, 200); ctx.restore(); }
      }
      if (f.kind === 'icicle' && f.st !== 'gone') {
        const ox = f.st === 'shake' ? Math.sin(W.time * 60) * 2 : 0;
        ctx.fillStyle = '#cfefff'; ctx.beginPath(); ctx.moveTo(x - 12 + ox, f.y - 44); ctx.lineTo(x + 12 + ox, f.y - 44); ctx.lineTo(x + ox, f.y); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x - 6 + ox, f.y - 40, 3, 22);
        if (f.st === 'hang') { ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x - 20, 0, 40, f.y - 40); }
      }
    }
    // 崩れる足場：ひびの印
    for (const s of W.terrain.solids) if ((s.crumble || s.fragile) && !s.off) { const x = Math.round(s.x - cam); if (x < -200 || x > VIEW_W + 200) continue; ctx.strokeStyle = 'rgba(30,10,20,.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 16; i < s.w; i += 30) { ctx.moveTo(x + i, s.y); ctx.lineTo(x + i + 6, s.y + 8); ctx.lineTo(x + i + 2, s.y + 14); } ctx.stroke(); }
    // 封印の燭台：灯っているかの印
    for (const o of W.objs) if (o.kind === 'candle' && o.seal) { const x = Math.round(o.x - cam); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.lit ? 0.6 + Math.sin(W.time * 8) * 0.1 : 0.15; ctx.fillStyle = o.lit ? '#ffb35a' : '#8a7aa0'; ctx.beginPath(); ctx.arc(x, o.y - 80, o.lit ? 26 : 14, 0, 7); ctx.fill(); ctx.restore(); }
  },
  // 前景（主人公・敵より手前）：背の高い草、砂嵐
  drawFront(W, ctx, cam) {
    for (const f of W.feats) {
      if (f.kind !== 'tallgrass' || f.dead) continue;
      const x = Math.round(f.x - cam); if (x < -200 || x > VIEW_W + 200) continue;
      for (let i = 0; i < f.w; i += 9) {
        const h = 46 + ((i * 37) % 23), sw = Math.sin(W.time * 2 + i) * 4;
        ctx.strokeStyle = i % 2 ? '#4f8a4a' : '#6faa5a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x + i, GROUND_Y + 2); ctx.quadraticCurveTo(x + i + sw, GROUND_Y - h / 2, x + i + sw * 2, GROUND_Y - h); ctx.stroke();
      }
    }
    if (W.storm > 0) {
      const P = W.player, px = P.x - cam, py = P.y - 70;
      ctx.save();
      const g = ctx.createRadialGradient(px, py, 90, px, py, 420);
      g.addColorStop(0, `rgba(210,170,110,${0.15 * W.storm})`); g.addColorStop(1, `rgba(190,150,90,${0.82 * W.storm})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = `rgba(255,235,190,${0.5 * W.storm})`; ctx.lineWidth = 2;
      for (let i = 0; i < 30; i++) { const yy = (i * 53 + W.time * 90) % VIEW_H, xx = VIEW_W - ((i * 137 + W.time * 900) % (VIEW_W + 200)); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 60, yy - 4); ctx.stroke(); }
      ctx.restore();
    }
  },
  drawLiquid(ctx, f, s, cam, t) {
    const x = Math.round(f.x - cam); if (x + f.w < -10 || x > VIEW_W + 10) return;
    const water = f.liquid === 'water', y = GROUND_Y + 46;
    const g = ctx.createLinearGradient(0, y, 0, VIEW_H); g.addColorStop(0, water ? '#3a7ab0' : '#ff6a1a'); g.addColorStop(1, water ? '#14304a' : '#5a1408');
    ctx.fillStyle = g; ctx.fillRect(x, y, f.w, VIEW_H - y);
    ctx.fillStyle = water ? 'rgba(200,235,255,.6)' : 'rgba(255,220,120,.8)';
    for (let i = 0; i < f.w; i += 40) ctx.fillRect(x + i + Math.sin(t * 2 + i) * 6, y + 2 + Math.sin(t * 3 + i) * 2, 18, 2);
    if (!water) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(t * 2) * 0.08; ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x, y - 60, f.w, 60); ctx.restore(); }
    if (f.on) {   // 凍った床・冷えた岩の床
      ctx.fillStyle = water ? '#cfefff' : '#3a2e2e'; ctx.fillRect(x, GROUND_Y - 2, f.w, 22);
      ctx.fillStyle = water ? '#ffffff' : '#5a4646'; for (let i = 10; i < f.w; i += 60) ctx.fillRect(x + i, GROUND_Y, 28, 3);
      ctx.fillStyle = water ? 'rgba(120,180,230,.6)' : 'rgba(255,90,30,.5)'; for (let i = 30; i < f.w; i += 75) ctx.fillRect(x + i, GROUND_Y + 10, 3, 9);
    } else {
      ctx.font = `13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#cfefff';
      ctx.fillText(water ? '氷の攻撃で凍らせられそう' : '氷の攻撃で冷やせそう', x + f.w / 2, GROUND_Y - 30); ctx.textAlign = 'left';
    }
  },
  drawGate(ctx, s, cam) {
    const x = Math.round(s.x - cam); if (x < -60 || x > VIEW_W + 60) return;
    const top = 0, bottom = GROUND_Y - (s.lift || 0) * 320;
    ctx.fillStyle = '#2a2230'; ctx.fillRect(x - 10, 0, s.w + 20, 26);
    ctx.fillStyle = '#5a5262';
    for (let i = 0; i < s.w; i += 11) ctx.fillRect(x + i, top, 5, bottom - top);
    for (let y = top + 40; y < bottom; y += 60) ctx.fillRect(x - 2, y, s.w + 4, 5);
    ctx.fillStyle = '#8a8296'; for (let i = 0; i < s.w; i += 11) { ctx.beginPath(); ctx.moveTo(x + i - 2, bottom); ctx.lineTo(x + i + 2.5, bottom + 12); ctx.lineTo(x + i + 7, bottom); ctx.fill(); }
  },
  drawWall(ctx, f, s, cam, W) {
    const x = Math.round(s.x - cam); if (x + s.w < -20 || x > VIEW_W + 20) return;
    const top = Math.max(-20, s.y), h = s.y + s.h - top, t = W.time, dmg = 1 - f.hp / f.maxHp;
    const shake = f.cd > 0 ? Math.sin(t * 80) * 2 : 0, X = x + shake;
    const st = f.style;
    if (st === 'vines') {
      ctx.fillStyle = '#2f4a2a'; ctx.fillRect(X, top, s.w, h);
      for (let i = 0; i < s.w; i += 10) { ctx.strokeStyle = i % 20 ? '#4f7a3a' : '#6a9a4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(X + i + 4, top); for (let y = top; y < top + h; y += 30) ctx.lineTo(X + i + 4 + Math.sin(y * 0.05 + i) * 5, y); ctx.stroke(); }
      ctx.fillStyle = '#8fca7a'; for (let y = top + 20; y < top + h; y += 46) ctx.fillRect(X + ((y * 7) % (s.w - 10)), y, 10, 7);
      ctx.fillStyle = '#c84a6a'; for (let y = top + 40; y < top + h; y += 90) ctx.fillRect(X + ((y * 3) % (s.w - 6)), y, 5, 5);
    } else if (st === 'sandwall' || st === 'mound') {
      ctx.fillStyle = '#c9a46a'; if (st === 'mound') { ctx.beginPath(); ctx.ellipse(X + s.w / 2, s.y + s.h, s.w / 2 + 10, s.h, 0, Math.PI, 0); ctx.fill(); }
      else { ctx.fillRect(X, top, s.w, h); ctx.fillStyle = '#b08a52'; for (let y = top + 8; y < top + h; y += 24) ctx.fillRect(X, y, s.w, 6); ctx.fillStyle = '#e0c48a'; for (let y = top + 18; y < top + h; y += 48) ctx.fillRect(X + 6, y, s.w - 12, 3); }
      if (st === 'mound') { ctx.fillStyle = '#e0c48a'; ctx.fillRect(X + 30, s.y + 20, 22, 3); ctx.fillStyle = '#ffd36a'; ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.3; ctx.fillRect(X + s.w / 2 - 3, s.y + s.h - 26, 6, 6); ctx.globalAlpha = 1; }
    } else if (st === 'snowpile' || st === 'icewall') {
      const ice = st === 'icewall';
      ctx.fillStyle = ice ? 'rgba(150,210,250,.85)' : '#eef8ff'; ctx.fillRect(X, top, s.w, h);
      ctx.fillStyle = ice ? 'rgba(255,255,255,.7)' : '#cfe4f4'; for (let y = top + 10; y < top + h; y += 34) ctx.fillRect(X + (ice ? 8 : 0), y, ice ? 6 : s.w, ice ? 22 : 8);
      if (!ice) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(X + s.w / 2, top + h, s.w / 2 + 18, 30, 0, Math.PI, 0); ctx.fill(); }
    } else if (st === 'magmarock') {
      ctx.fillStyle = '#3a2424'; ctx.fillRect(X, top, s.w, h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,${100 + Math.sin(t * 3) * 40 | 0},40,.8)`; ctx.lineWidth = 3;
      for (let y = top + 20; y < top + h; y += 50) { ctx.beginPath(); ctx.moveTo(X + 6, y); ctx.lineTo(X + s.w / 2, y + 16); ctx.lineTo(X + s.w - 8, y + 6); ctx.stroke(); }
      ctx.restore();
    } else if (st === 'rubble' || st === 'cracked' || st === 'boulder') {
      if (st === 'boulder') { ctx.fillStyle = '#6a6470'; ctx.beginPath(); ctx.ellipse(X + s.w / 2, s.y + s.h / 2 + 6, s.w / 2 + 6, s.h / 2 + 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a8490'; ctx.beginPath(); ctx.ellipse(X + s.w / 2 - 14, s.y + s.h / 2 - 10, 24, 16, 0, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = st === 'cracked' ? '#4a4252' : '#5a5262'; ctx.fillRect(X, top, s.w, h); ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let y = top; y < top + h; y += 28) ctx.fillRect(X, y, s.w, 3); for (let y = top; y < top + h; y += 56) ctx.fillRect(X + s.w / 2, y, 3, 28); }
      if (st === 'cracked') { ctx.strokeStyle = 'rgba(255,240,200,.35)'; ctx.lineWidth = 2; ctx.beginPath(); const yb = s.y + s.h; ctx.moveTo(X + 8, yb - 120); ctx.lineTo(X + 22, yb - 80); ctx.lineTo(X + 12, yb - 50); ctx.lineTo(X + 28, yb - 10); ctx.stroke(); }
    } else if (st === 'seal') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(X, 0, X + s.w, 0); g.addColorStop(0, 'rgba(120,60,200,0)'); g.addColorStop(0.5, `rgba(190,120,255,${0.55 + Math.sin(t * 3) * 0.15})`); g.addColorStop(1, 'rgba(120,60,200,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 10, top, s.w + 20, h);
      ctx.fillStyle = '#f0d8ff'; for (let y = top + 30; y < top + h; y += 60) { ctx.fillRect(X + s.w / 2 - 8, y + Math.sin(t * 2 + y) * 4, 16, 3); ctx.fillRect(X + s.w / 2 - 2, y - 6 + Math.sin(t * 2 + y) * 4, 4, 15); }
      ctx.restore();
    }
    // ひび（ダメージを受けた壁）
    if (dmg > 0 && st !== 'seal') { ctx.strokeStyle = 'rgba(20,10,10,.6)'; ctx.lineWidth = 2; ctx.beginPath(); const yb = s.y + s.h; for (let k = 0; k < 1 + dmg * 3; k++) { ctx.moveTo(X + 6 + k * 9, yb - 20 - k * 40); ctx.lineTo(X + s.w - 8, yb - 60 - k * 30); } ctx.stroke(); }
  },
};
