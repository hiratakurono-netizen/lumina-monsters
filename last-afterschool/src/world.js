// 1ステージ分のランタイム（カメラ・イベント・ウェーブ・戦闘処理）
class World {
  constructor(chIdx, save, game) {
    // chIdx はプロローグの章番号。章データ（オブジェクト）を直接渡すこともできる（テスト部屋・本編のダンジョン用）
    this.game = game; this.chIdx = typeof chIdx === 'number' ? chIdx : -1; this.ch = typeof chIdx === 'number' ? CHAPTERS[chIdx] : chIdx;
    this.bg = Backgrounds.get(this.ch.bg);
    this.terrain = this.ch.terrain ? new Terrain(this.ch.terrain, { theme: this.ch.terrainTheme }) : Terrain.flat();
    this.camX = 0; this.camLock = null; this.shake = 0; this.hitstop = 0; this.flash = 0; this.slowmo = 0;
    this.enemies = []; this.projs = []; this.fx = []; this.fxTop = []; this.fxBack = []; this.pickups = [];
    this.player = new Player(this, save);
    this.partnerOn = this.ch.loadout.partner;
    this.partner = new Partner(this.player);
    this.events = this.ch.events.map(e => Object.assign({ done: false }, e));
    this.items = this.events.filter(e => e.type === 'item').map(e => ({ ev: e, x: e.x, taken: false, t: 0 }));
    this.state = 'intro'; this.dialogue = null; this.wave = null; this.spawnQ = []; this.goArrow = 0;
    this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.boss = null; this.time = 0; this.ambT = 0;
    this.endTriggered = false;
  }

  // ---------------- flow ----------------
  say(lines, done) { this.dialogue = new Dialogue(lines.map(l => Object.assign({}, l, { text: fmt(l.text) })), done); }
  begin() {
    Audio2.playBgm(this.ch.bgm);
    this.say(this.ch.intro, () => {
      if (this.ch.storyOnly) return this.finish();
      this.state = 'play';
    });
  }
  finish() {
    if (this.endTriggered) return; this.endTriggered = true;
    this.state = 'outro'; this.player.locked = true;
    const done = () => this.game.chapterClear(this);
    if (this.ch.outro && this.ch.outro.length) this.say(this.ch.outro, done); else done();
  }
  onPlayerDown() {
    if (this.state !== 'play') return;
    this.state = 'dead'; this.player.locked = true; this.slowmo = 1.2;
    setTimeout(() => this.game.gameOver(this), 1400);
  }

  // ---------------- update ----------------
  update(dt) {
    if (this.dialogue) { this.dialogue.update(dt); if (this.dialogue.closed) { const d = this.dialogue; this.dialogue = null; d.done && d.done(); this.inputGrace = 0.15; } }
    if (this.inputGrace > 0) { this.inputGrace -= dt; Input.endFrame(); }
    if (this.hitstop > 0) { this.hitstop -= dt; this.updateFx(dt * 0.3); return; }
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }
    this.time += this.state === 'play' && !this.dialogue ? dt : 0;
    const P = this.player;

    if (!this.dialogue) {
      P.update(dt);
      if (this.state === 'play') this.checkEvents();
    } else if (P.state !== 'attack') { P.vx = 0; P.anim = 'idle'; P.ft += dt; if (P.ft > 0.22) { P.ft = 0; P.frame = (P.frame + 1) % 4; } P.physics(dt); }
    if (this.partnerOn) this.partner.update(dt);

    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const p of this.projs) p.update(dt);
    this.projs = this.projs.filter(p => !p.dead);
    this.updatePickups(dt);
    this.updateWave(dt);
    this.updateFx(dt);

    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.player.mp < this.player.maxMp) this.player.mp = Math.min(this.player.maxMp, this.player.mp + dt * 0.6);

    // camera
    let target = P.x - VIEW_W * 0.42;
    target = clamp(target, 0, this.ch.length - VIEW_W);
    if (this.camLock) target = clamp(target, this.camLock.min, this.camLock.max);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.goArrow = Math.max(0, this.goArrow - dt);
    this.ambient(dt);
  }
  updateFx(dt) {
    for (const f of this.fx) f.update(dt); this.fx = this.fx.filter(f => !f.dead);
    for (const f of this.fxTop) f.update(dt); this.fxTop = this.fxTop.filter(f => !f.dead);
    for (const f of this.fxBack) f.update(dt); this.fxBack = this.fxBack.filter(f => !f.dead);
  }

  checkEvents() {
    const P = this.player;
    for (const ev of this.events) {
      if (ev.done) continue;
      if (ev.type === 'talk' && P.x >= ev.x) { ev.done = true; this.say(ev.lines); return; }
      if (ev.type === 'wave' && P.x >= ev.x) { ev.done = true; this.startWave(ev); return; }
      if (ev.type === 'boss' && P.x >= ev.x) { ev.done = true; this.startBoss(ev); return; }
    }
    if (!this.wave && P.x >= this.ch.endX) this.finish();
  }

  startWave(ev) {
    const min = clamp(ev.x - VIEW_W * 0.45, 0, this.ch.length - VIEW_W);
    this.camLock = { min, max: min };
    this.wave = { ev, idx: -1, delay: 0.4, t: 0 };
    if (ev.lines && ev.lines.length) this.say(ev.lines);
  }
  startBoss(ev) {
    this.camLock = { min: 0, max: this.ch.length - VIEW_W };
    const b = new Enemy(this, ev.enemy, this.ch.length - 260, GROUND_Y);
    b.cool = 2.5; this.enemies.push(b); this.boss = b;
    this.bossIntro = 2.2; Audio2.sfx('warn'); this.shake = 10;
    this.wave = { ev, idx: 99, delay: 0, t: 0, boss: true };
  }
  updateWave(dt) {
    const w = this.wave; if (!w || this.dialogue) return;
    w.t += dt;
    if (this.bossIntro > 0) this.bossIntro -= dt;
    // スポーンキュー
    if (this.spawnQ.length) {
      this.spawnQ[0].t -= dt;
      if (this.spawnQ[0].t <= 0) { const s = this.spawnQ.shift(); this.spawn(s.type, s.side); }
    }
    if (w.boss) return;
    if (w.ev.scripted === 'overwhelm') {
      this.player.minHp = 1;
      if (w.t > 7 || this.player.hp < this.player.maxHp * 0.35) { this.wave = null; this.player.locked = true; this.finish(); }
      if (w.idx < 0) { w.idx = 0; this.queueWave(w.ev.waves[0]); }
      if (this.enemies.length < 3 && !this.spawnQ.length) this.queueWave(w.ev.waves[0]);
      return;
    }
    if (this.enemies.length === 0 && this.spawnQ.length === 0) {
      w.delay -= dt;
      if (w.delay <= 0) {
        w.idx++;
        if (w.idx >= w.ev.waves.length) { this.wave = null; this.camLock = null; this.goArrow = 2.5; Audio2.sfx('pickup'); }
        else { this.queueWave(w.ev.waves[w.idx]); w.delay = 0.8; }
      }
    }
  }
  queueWave(list) { list.forEach(([type, side], i) => this.spawnQ.push({ type, side, t: i === 0 ? 0.2 : 0.35 })); }
  spawn(type, side) {
    const d = ENEMIES[type];
    const x = side > 0 ? this.camX + VIEW_W + 20 : this.camX - 20;
    const gy = this.terrain.groundBelow(x, -1000, 0);
    const y = d.fly ? GROUND_Y - 180 - rand(0, 60) : (gy < Infinity ? gy : GROUND_Y);
    const e = new Enemy(this, type, x, y);
    e.vx = -side * 120; this.enemies.push(e);
  }

  // ---------------- combat ----------------
  playerHit(P, h, atk) {
    const def = atk.def, el = P.element, E = ELEMENTS[el];
    const b = h.box.map(v => v * HERO_SCALE);
    const box = P.face > 0 ? [P.x + b[0], P.y + b[1], P.x + b[2], P.y + b[3]] : [P.x - b[2], P.y + b[1], P.x - b[0], P.y + b[3]];
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, r = Math.max(40, (box[2] - box[0]) * 0.45);
    if (el !== 'none' && atk.key !== 'kick') this.fx.push(new SlashArc(P.x + P.face * 20, cy, r, P.face, E.color, E.glow));
    // 紫の爆発エフェクトは必殺専用（その技の最後の一撃で出す）
    if (atk.special && h === def.hits[def.hits.length - 1]) {
      this.fxBack.push(new Burst(P.x + P.face * 115, P.face, el)); this.flash = 0.5; this.shake = Math.max(this.shake, h.shake || 10);
      Audio2.sfx('slam'); this.dust(P.x + P.face * 100, GROUND_Y, 14);
      if (el === 'fire') for (let i = 0; i < 24; i++) this.spark(P.x + P.face * rand(20, 220), GROUND_Y - rand(0, 30), '#ff9a3a', 1, -rand(100, 400));
      if (el === 'sand') this.dust(P.x + P.face * 120, GROUND_Y, 20, '#d9c08c');
    }
    else if (h.slam) { // 通常の机の叩きつけ：揺れ・音・砂ぼこりだけ
      this.shake = Math.max(this.shake, h.shake || 10); Audio2.sfx('slam'); this.dust(P.x + P.face * 100, GROUND_Y, 10);
    }
    let any = false;
    const lvMul = 1 + (P.lv - 1) * 0.08, spMul = atk.special ? SPECIAL.dmgMul : 1;
    for (const e of this.enemies) {
      if (e.dying > 0 || e.spawnT > 0.2) continue;
      if (!overlap(box, e.box())) continue;
      let mul = lvMul * spMul;
      if (el === 'fire') mul *= 1.25;
      if (e.d.weak) mul *= e.d.weak === el ? 2 : 0.5;
      if (e.phased && el !== 'fire') { this.floatText(e.x, e.y - e.d.h - 10, 'MISS', '#9aa', 14); continue; }
      const crit = Math.random() < 0.1; if (crit) mul *= 1.5;
      const dmg = Math.round(h.dmg * mul * rand(0.92, 1.08));
      any = true;
      e.damage(dmg, P.x);
      if (crit) this.floatText(e.x, e.y - e.d.h - 34, 'CRITICAL!', '#ffe27a', 14);
      if (e.boss) {
        e.poise += dmg;
        if (e.poise > 170 && (e.state === 'move' || e.state === 'recover')) { e.poise = 0; e.state = 'stagger'; e.st = 1.1; e.vx = P.face * 160; this.floatText(e.x, e.y - 230, 'BREAK!', '#9fe0ff', 24); }
      } else {
        e.vx = (Math.sign(e.x - P.x) || P.face) * (h.kb || 150) * (atk.special ? 1.4 : 1); // 主人公から離れる向きに飛ばす
        if (h.launch) { e.vy = -h.launch; e.launched = true; e.onGround = false; }
        e.stun = 0.35 + (el === 'sand' ? 0.3 : 0) + (h.launch ? 0.3 : 0);
        e.state = 'move';
      }
      if (el === 'fire') e.burn = 2.2;
      // ヒットエフェクト
      const hx = clamp(e.x, box[0], box[2]), hy = e.y - e.d.h * 0.5;
      this.spark(hx, hy, E.color, 8);
      this.spark(hx, hy, '#ffffff', 4);
      if (!atk.special) P.mp = Math.min(P.maxMp, P.mp + 2.2);
      this.combo++; this.comboT = 2.2; this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.combo === 10 || this.combo === 25) P.setFace('happy', 1.4);
    }
    if (any) {
      this.hitstop = Math.max(this.hitstop, (h.stop || 50) / 1000 * (atk.special ? 1.4 : 1));
      this.shake = Math.max(this.shake, h.shake || (def.size === 'L' ? 8 : 3));
      Audio2.sfx(h.dmg >= 25 || atk.special ? 'hitHeavy' : 'hit');
    }
  }
  doSpecial(P) {
    // 今持っている武器で出す（机の時だけ2段目まで続ける）。武器がなければキック
    const key = P.weapon || 'kick';
    P.startAttack(key, { special: true, chainNext: key === 'desk' ? 'desk2' : null });
    P.inv = 1.6; P.setFace('fluster', 1.6);
    this.partner.glow = 1.2; this.flash = 0.35; this.hitstop = 0.12;
    this.floatText(P.x, P.y - 170, 'フルスイング！！', '#ffe27a', 26);
    Audio2.sfx('transform');
  }
  killEnemy(e) {
    if (e.dying > 0) return;
    e.dying = e.boss ? 2.2 : 0.45; e.vx = 0; Audio2.sfx('die');
    this.spark(e.x, e.y - e.d.h / 2, '#e8d8ff', 14);
    this.player.gainExp(e.d.exp);
    if (!e.boss && Math.random() < 0.13) this.pickups.push({ x: e.x, y: e.y - 40, vy: -260, t: 0, kind: 'milk' });
    if (e.boss) {
      this.slowmo = 1.8; this.flash = 1; this.shake = 24; Audio2.sfx('slam');
      for (let i = 0; i < 60; i++) this.fx.push(new Particle({ x: e.x + rand(-90, 90), y: e.y - rand(0, 180), vx: rand(-300, 300), vy: rand(-500, -100), g: 900, life: rand(0.8, 1.6), size: rand(6, 14), color: ['#7d7488', '#a49ab0', '#5d556a'][i % 3] }));
      this.projs = [];
      setTimeout(() => { this.wave = null; this.boss = null; this.finish(); }, 2600);
    }
  }

  // ---------------- items / pickups ----------------
  updatePickups(dt) {
    const P = this.player;
    for (const it of this.items) {
      it.t += dt;
      if (it.taken) continue;
      if (this.state === 'play' && !this.dialogue && Math.abs(P.x - it.x) < 40) {
        it.taken = true; it.ev.done = true;
        const I = ITEMS[it.ev.item];
        if (I.weapon) { P.weapons.push(I.weapon); P.wIdx = P.weapons.length - 1; P.canFight = true; }
        if (I.fire) P.fire = true;
        Audio2.sfx('transform'); this.flash = 0.6; this.partner.glow = 1.5; P.setFace('happy', 2);
        for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; this.fx.push(new Particle({ x: it.x, y: GROUND_Y - 50, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, drag: 0.05, life: 0.7, size: 4, color: I.fire ? '#ffb35a' : '#e6d6ff', add: true })); }
        this.say(it.ev.lines);
      }
    }
    for (const p of this.pickups) {
      p.t += dt; p.vy += 1200 * dt; p.y += p.vy * dt; if (p.y > GROUND_Y - 12) { p.y = GROUND_Y - 12; p.vy = 0; }
      if (Math.abs(P.x - p.x) < 30 && Math.abs(P.y - 40 - p.y) < 70) {
        p.dead = true; P.hp = Math.min(P.maxHp, P.hp + 22); Audio2.sfx('heal'); this.floatText(P.x, P.y - 130, 'いちごミルク +22', '#ffb6d0', 15);
      }
      if (p.t > 12) p.dead = true;
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  }

  // ---------------- particles ----------------
  spark(x, y, color, n, vyBias = 0) { for (let i = 0; i < n; i++) this.fx.push(new Particle({ x, y, vx: rand(-320, 320), vy: rand(-320, 220) + vyBias, drag: 0.02, life: rand(0.15, 0.4), size: rand(2, 5), color, add: true })); }
  dust(x, y, n, color = '#cbbfd6') { for (let i = 0; i < n; i++) this.fx.push(new Particle({ x: x + rand(-14, 14), y: y - rand(0, 8), vx: rand(-120, 120), vy: rand(-120, -20), drag: 0.05, life: rand(0.3, 0.6), size: rand(3, 7), color })); }
  floatText(x, y, t, c, s) { this.fxTop.push(new FloatText(x, y, t, c, s)); }
  addProj(p) { this.projs.push(p); }
  ambient(dt) {
    this.ambT -= dt; if (this.ambT > 0) return; this.ambT = 0.08;
    const k = this.bg.ambient, x = this.camX + rand(0, VIEW_W + 200);
    const P = (o) => this.fx.push(new Particle(Object.assign({ life: 5, size: 3 }, o)));
    if (k === 'petal') P({ x, y: -10, vx: rand(-60, -20), vy: rand(30, 60), color: Math.random() < 0.5 ? '#f6c9d9' : '#fde3ec', size: 4 });
    if (k === 'ash') P({ x, y: -10, vx: rand(-40, 10), vy: rand(30, 70), color: Math.random() < 0.4 ? '#ff9a6a' : '#3a2a3a', size: 3 });
    if (k === 'ember') P({ x, y: GROUND_Y + 10, vx: rand(-20, 20), vy: rand(-80, -30), color: '#ffb070', add: true, size: 2, life: 4 });
    if (k === 'dust' && Math.random() < 0.4) P({ x, y: rand(60, 400), vx: rand(-8, 8), vy: rand(-6, 6), color: 'rgba(255,240,220,.6)', size: 2, life: 3 });
    if (k === 'steam' && Math.random() < 0.3) P({ x, y: 300, vx: rand(-10, 10), vy: rand(-40, -20), color: 'rgba(230,230,240,.35)', size: 8, life: 2 });
    if (k === 'mote' && Math.random() < 0.5) P({ x, y: rand(80, 420), vx: rand(-10, 10), vy: rand(-20, -5), color: '#fff2c8', add: true, size: 2, life: 4 });
  }

  // ---------------- draw ----------------
  draw(ctx) {
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
    const cam = Math.round(this.camX);
    Backgrounds.draw(ctx, this.bg, cam);
    this.terrain.draw(ctx, cam);
    this.drawProps(ctx, cam);
    this.drawItems(ctx, cam);
    for (const f of this.fxBack) f.draw(ctx, cam);
    for (const e of this.enemies) e.draw(ctx, cam);
    this.player.draw(ctx, cam);
    if (this.partnerOn) this.partner.draw(ctx, cam);
    for (const p of this.projs) p.draw(ctx, cam);
    for (const f of this.fx) f.draw(ctx, cam);
    for (const f of this.fxTop) f.draw(ctx, cam);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,248,255,${Math.min(0.75, this.flash)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }
  drawItems(ctx, cam) {
    for (const it of this.items) {
      if (it.taken) continue;
      const x = it.x - cam, y = GROUND_Y - 30 + Math.sin(it.t * 3) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 4, x, y, 60); g.addColorStop(0, 'rgba(220,190,255,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120); ctx.restore();
      Icons.draw(ctx, it.ev.item, x, y, 2);
      ctx.font = '14px DotGothic16, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 3;
      const lab = ITEMS[it.ev.item].label; ctx.strokeText(lab, x, y - 48); ctx.fillText(lab, x, y - 48); ctx.textAlign = 'left';
    }
    for (const p of this.pickups) Icons.draw(ctx, 'milk', p.x - cam, p.y, 2, p.t > 9 && Math.floor(p.t * 8) % 2);
  }
  drawProps(ctx, cam) {
    for (const ev of this.events) if (ev.prop) Props[ev.prop] && Props[ev.prop](ctx, ev.x - cam + 60, this.time);
  }
}

// ---------------------------------------------------------------------
//  小物のドット絵（手続き描画）
// ---------------------------------------------------------------------
const Icons = {
  draw(ctx, kind, x, y, s, hidden) {
    if (hidden) return;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s);
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
    switch (kind) {
      case 'bat': ctx.rotate(-0.6); R('#3a2a1e', -2, -16, 5, 32); R('#c9a47a', -3, -16, 6, 22); R('#e2c39b', -2, -16, 2, 20); R('#2a1e14', -3, 12, 6, 3); break;
      case 'chair': R('#6b7280', -9, -4, 2, 14); R('#6b7280', 7, -4, 2, 14); R('#b98a5a', -10, -6, 20, 4); R('#b98a5a', -10, -18, 20, 9); R('#6b7280', -9, -10, 2, 6); R('#6b7280', 7, -10, 2, 6); break;
      case 'desk': R('#c79a63', -16, -12, 32, 4); R('#a77b49', -15, -8, 30, 5); R('#6b7280', -14, -3, 2, 14); R('#6b7280', 12, -3, 2, 14); break;
      case 'stove': R('#5f6470', -14, -6, 28, 14); R('#2a2d35', -12, -8, 10, 2); R('#2a2d35', 2, -8, 10, 2);
        ctx.fillStyle = '#6ab4ff'; for (let i = 0; i < 3; i++) R('#6ab4ff', -11 + i * 3, -12 - (i % 2) * 2, 2, 4); for (let i = 0; i < 3; i++) R('#9fd0ff', 3 + i * 3, -12 - ((i + 1) % 2) * 2, 2, 4);
        R('#e6e6ea', -10, 2, 4, 3); R('#e6e6ea', 6, 2, 4, 3); break;
      case 'milk': R('#fff', -5, -8, 10, 14); R('#ff9ec0', -5, -2, 10, 8); R('#fff', -5, -11, 10, 3); R('#e07aa0', -2, 0, 4, 3); break;
      case 'kick': R('#e8e4f0', -6, -2, 12, 5); R('#3a3550', -6, 3, 12, 2); R('#2a2540', -3, -10, 5, 8); break;
      case 'fire': ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(8, 0, 0, 8); ctx.quadraticCurveTo(-8, 0, 0, -10); ctx.fill(); R('#ffd27a', -2, 0, 4, 5); break;
    }
    ctx.restore();
  },
};

const Props = {
  cat(ctx, x, t) {
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a), b, w, h); };
    const y = GROUND_Y - 34;
    R('#2e2838', -14, y - 12, 26, 12); R('#2e2838', 6, y - 22, 12, 12); R('#2e2838', 6, y - 26, 3, 4); R('#2e2838', 15, y - 26, 3, 4);
    R('#ffe27a', 9, y - 18, 2, 2); R('#ffe27a', 14, y - 18, 2, 2);
    const tw = Math.sin(t * 3) * 4; R('#2e2838', -18, y - 14 - tw, 4, 10);
  },
  tv(ctx, x, t) {
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a), b, w, h); };
    R('#4d4560', -70, GROUND_Y - 190, 140, 150); R('#9fb6d8', -62, GROUND_Y - 182, 124, 70);
    R('#2a2433', -54, GROUND_Y - 176, 60, 44); R('#d56a5a', -50, GROUND_Y - 170, 50, 26);
    R('#ffd36a', -48, GROUND_Y - 168, 30 + Math.sin(t * 2) * 6, 4);
    R('#2a2433', 12, GROUND_Y - 176, 44, 44); R('#7aa6d8', 16, GROUND_Y - 170, 36, 32);
    R('#e9e2f0', -62, GROUND_Y - 100, 124, 14);
    ctx.fillStyle = '#4d4560'; ctx.font = '11px DotGothic16, monospace'; ctx.fillText('でんきのミヤタ', x - 48, GROUND_Y - 89);
  },
  shop(ctx, x) {
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a), b, w, h); };
    for (let i = 0; i < 7; i++) R(i % 2 ? '#fff' : '#f39ab8', -70 + i * 20, GROUND_Y - 180, 20, 26);
    R('#f6e6d6', -66, GROUND_Y - 154, 132, 120); R('#8a6a5a', -66, GROUND_Y - 40, 132, 6);
    R('#ffd6a0', -40, GROUND_Y - 130, 20, 36); R('#ff9ec0', -40, GROUND_Y - 134, 20, 10);
    ctx.fillStyle = '#c0567a'; ctx.font = '12px DotGothic16, monospace'; ctx.fillText('CRÊPE', x - 6, GROUND_Y - 110);
    ctx.fillText('新作!', x - 2, GROUND_Y - 92);
  },
  crack() {},
};
