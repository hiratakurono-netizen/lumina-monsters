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
    // ダンジョン：生成された敵と宝箱を置く（敵は主人公が近づくまで眠っている）
    this.chests = (this.ch.chests || []).map(c => Object.assign({ opened: false, t: 0 }, c));
    for (const sp of this.ch.spawns || []) { const e = this.makeEnemy(sp.type, sp.x, sp.y, sp); e.awake = false; e.spawnT = 0; this.enemies.push(e); }
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
    // 町：近くの施設を調べる
    if (this.ch.town) {
      this.nearFac = Town.near(this);
      if (this.nearFac && !this.dialogue && this.state === 'play' && !UI.isOpen && Input.hit('down')) Town.interact(this.nearFac, this.game);
    }

    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const p of this.projs) p.update(dt);
    this.projs = this.projs.filter(p => !p.dead);
    this.updatePickups(dt);
    if (this.ch.dungeon) this.updateDungeon(dt);
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
      if (ev.type === 'boss_dg' && P.x >= ev.x) { ev.done = true; this.startBossDg(); return; }
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
  // ダンジョンのボス：ボス部屋でカメラを止めて登場させる。倒すと出口が開く
  startBossDg() {
    const B = this.ch.boss, min = clamp(B.x - 1000, 0, this.ch.length - VIEW_W);
    this.camLock = { min, max: min + 340 };
    const b = this.makeEnemy(B.type, B.x, undefined, { hpMul: B.hpMul });
    b.cool = 2.5; this.enemies.push(b); this.boss = b;
    this.bossIntro = 2.2; Audio2.sfx('warn'); this.shake = 10;
    this.wave = { ev: { waves: [] }, idx: 99, delay: 0, t: 0, boss: true };
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
    // ウェーブで湧いた敵だけを数える（ダンジョンに置かれた眠っている敵は数えない）
    if (!this.enemies.some(e => e.fromWave) && this.spawnQ.length === 0) {
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
    const e = this.makeEnemy(type, x, d.fly ? GROUND_Y - 180 - rand(0, 60) : undefined, this.wave && this.wave.ev);
    e.vx = -side * 120; e.fromWave = true; this.enemies.push(e);
  }
  // 敵を作る。y を省くとその下の地面に立たせる。scale.hpMul / dmgMul で深い階ほど強く
  makeEnemy(type, x, y, scale) {
    const d = ENEMIES[type];
    if (y === undefined) { const gy = this.terrain.groundBelow(x, -1000, 0, !!d.boss); y = d.fly ? GROUND_Y - 180 : (gy < Infinity ? gy : GROUND_Y); }
    const e = new Enemy(this, type, x, y);
    if (scale && scale.hpMul) { e.hp = e.maxHp = Math.round(d.hp * scale.hpMul); }
    if (scale && scale.dmgMul) e.dmgMul = scale.dmgMul;
    return e;
  }

  // ---------------- combat ----------------
  playerHit(P, h, atk) {
    const def = atk.def, el = P.element, E = ELEMENTS[el];
    const b = h.box.map(v => v * HERO_SCALE * HERO_SIZE);
    const box = P.face > 0 ? [P.x + b[0], P.y + b[1], P.x + b[2], P.y + b[3]] : [P.x - b[2], P.y + b[1], P.x - b[0], P.y + b[3]];
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, r = Math.max(40, (box[2] - box[0]) * 0.45);
    // 斬撃のエフェクト：属性なしでも出す（新しい振りの絵には斬撃が描かれていないため）
    if (atk.key !== 'kick') this.fx.push(new SlashArc(P.x + P.face * 20, cy, r, P.face, E.color, E.glow));
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
      const it = P.wItems && atk.key !== 'kick' ? P.item : null;   // 本編：装備した武器の威力・付与効果
      if (it) mul *= it.powerMul * (1 + ((P.stats ? P.stats.atkPct : 0) + it.atkPct) / 100);
      const critRate = ((P.stats ? P.stats.crit : 10) + (it ? it.crit : 0)) / 100;
      const crit = Math.random() < critRate; if (crit) mul *= 1.5;
      const dmg = Math.round(h.dmg * mul * rand(0.92, 1.08));
      any = true;
      e.damage(dmg, P.x);
      if (it && it.steal) P.hp = Math.min(P.maxHp, P.hp + dmg * it.steal / 100);   // HP吸収
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
    const fl = this.ch.dungeon ? this.ch.floor : 1;
    this.player.gainExp(Math.round(e.d.exp * (1 + 0.15 * (fl - 1))));
    if (this.ch.dungeon) {
      this.dropGold(e.x, e.y - 30, Math.round((3 + fl * 2) * (e.boss ? 15 : 1) * rand(0.7, 1.3)));
      // 装備のドロップ：ボスは確定、通常の敵はまれに
      const rng = makeRng((Math.random() * 4294967296) >>> 0), save = this.game.save;
      if (e.boss) { const B = LOOT.BOSS[fl] || { n: 1, minTier: 1 }; for (let i = 0; i < B.n; i++) this.dropItem(e.x + (i - 0.5) * 60, e.y - 60, LOOT.roll(save, rng, fl, B)); }
      else if (rng.chance(LOOT.ENEMY_ITEM_CHANCE)) this.dropItem(e.x, e.y - 40, LOOT.roll(save, rng, fl));
    }
    if (!e.boss && Math.random() < 0.13) this.pickups.push({ x: e.x, y: e.y - 40, vy: -260, t: 0, kind: 'milk' });
    if (e.boss) {
      this.slowmo = 1.8; this.flash = 1; this.shake = 24; Audio2.sfx('slam');
      for (let i = 0; i < 60; i++) this.fx.push(new Particle({ x: e.x + rand(-90, 90), y: e.y - rand(0, 180), vx: rand(-300, 300), vy: rand(-500, -100), g: 900, life: rand(0.8, 1.6), size: rand(6, 14), color: ['#7d7488', '#a49ab0', '#5d556a'][i % 3] }));
      this.projs = [];
      setTimeout(() => { this.wave = null; this.boss = null; if (this.ch.dungeon) { this.camLock = null; this.bossDefeated = true; this.goArrow = 3; } else this.finish(); }, 2600);
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
      p.t += dt; p.x += (p.vx || 0) * dt; p.vx = (p.vx || 0) * 0.96; p.vy += 1200 * dt; p.y += p.vy * dt;
      const gy = this.terrain.groundBelow(p.x, p.y - p.vy * dt + 12, 0) - 12;
      if (p.y > gy) { p.y = gy; p.vy = 0; }
      if (p.y > VIEW_H + 60) p.dead = true;
      if (p.kind === 'item') { this.touchItem(p, P); continue; }
      if (Math.abs(P.x - p.x) < 30 && Math.abs(P.y - 40 - p.y) < 70) {
        p.dead = true;
        if (p.kind === 'gold') { this.game.addRunGold(p.v); Audio2.sfx('blip'); this.floatText(P.x, P.y - 130, `+${p.v} G`, '#ffe27a', 15); }
        else { P.hp = Math.min(P.maxHp, P.hp + 22); Audio2.sfx('heal'); this.floatText(P.x, P.y - 130, 'いちごミルク +22', '#ffb6d0', 15); }
      }
      if (p.t > 12 && p.kind !== 'item') p.dead = true;   // 装備は消えない
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  }

  // ---------------- dungeon（宝箱・ゴールド・出口） ----------------
  dropGold(x, y, total) {
    const n = Math.min(5, 1 + Math.floor(total / 12));
    for (let i = 0; i < n; i++) this.pickups.push({ kind: 'gold', v: Math.max(1, Math.round(total / n)), x, y, vx: rand(-140, 140), vy: rand(-420, -220), t: 0 });
  }
  dropItem(x, y, item) { this.pickups.push({ kind: 'item', item, x, y, vx: rand(-90, 90), vy: -420, t: 0 }); }
  // 装備を拾う：すぐ持ち物に入れて保存する。持ち物がいっぱいの時は地面に残す
  touchItem(p, P) {
    p.cool = Math.max(0, (p.cool || 0) - 1 / 60);
    if (Math.abs(P.x - p.x) > 34 || Math.abs(P.y - 40 - p.y) > 70 || p.cool > 0) return;
    const s = this.game.save, r = Inv.rarity(p.item);
    if (Inv.add(s, p.item)) {
      p.dead = true; Save.store(s);
      Audio2.sfx(r.tier >= 2 ? 'lvup' : 'pickup');
      this.floatText(P.x, P.y - 150, Inv.name(p.item), r.color, r.tier >= 2 ? 20 : 16);
      if (r.tier >= 2) { this.flash = 0.2; this.spark(p.x, p.y, r.color, 16); }
    } else { p.cool = 2; this.floatText(P.x, P.y - 150, '持ち物がいっぱい（自宅で整理）', '#ff9a9a', 14); }
  }
  updateDungeon(dt) {
    const P = this.player;
    for (const c of this.chests) {
      c.t += dt;
      if (c.opened || this.state !== 'play') continue;
      if (Math.abs(P.x - c.x) < 40 && Math.abs(P.y - c.y) < 12) {
        // 宝箱を開ける。中身は今はゴールドだけ（装備のドロップは次の段階で追加：仮）
        c.opened = true; Audio2.sfx('pickup'); this.flash = 0.25;
        this.dropGold(c.x, c.y - 30, Math.round((15 + c.floor * 8) * (c.hidden ? 3 : 1) * rand(0.8, 1.2)));
        // 宝箱の装備：隠し宝箱は必ず入っていて、レアリティも出やすい（2階ぶん深い扱い・アンコモン以上）
        const rng = makeRng((Math.random() * 4294967296) >>> 0), save = this.game.save;
        if (c.hidden) this.dropItem(c.x, c.y - 40, LOOT.roll(save, rng, c.floor + 2, { minTier: 1 }));
        else if (rng.chance(LOOT.CHEST_ITEM_CHANCE)) this.dropItem(c.x, c.y - 40, LOOT.roll(save, rng, c.floor));
        this.floatText(c.x, c.y - 70, c.hidden ? '隠し宝箱！' : '宝箱', '#ffe27a', 16);
      }
    }
    // 出口（ボス階はボスを倒すまで閉じている）
    const open = !this.ch.boss || this.bossDefeated;
    if (open && !this.exitUsed && this.state === 'play' && !this.dialogue && P.onGround && Math.abs(P.x - this.ch.exitX) < 40) {
      this.exitUsed = true; Audio2.sfx('transform'); this.flash = 0.5;
      this.game.floorCleared(this);
    }
  }
  // 落ちている装備：レアリティの色で光る。レア以上は光の柱
  drawLoot(ctx, p, cam) {
    const r = Inv.rarity(p.item), b = Inv.base(p.item), x = p.x - cam, y = p.y + Math.sin(p.t * 3) * 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (r.tier >= 2) { const g = ctx.createLinearGradient(0, y - 220, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, r.color); ctx.globalAlpha = 0.35 + Math.sin(p.t * 4) * 0.1; ctx.fillStyle = g; ctx.fillRect(x - 6, y - 220, 12, 220); }
    ctx.globalAlpha = 0.55; const g2 = ctx.createRadialGradient(x, y, 2, x, y, 30); g2.addColorStop(0, r.color); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(x - 30, y - 30, 60, 60);
    ctx.restore();
    Icons.draw(ctx, b.kind === 'weapon' ? b.type : b.kind === 'armor' ? 'armor' : 'acc', x, y, 1.6);
  }
  drawDungeon(ctx, cam) {
    for (const c of this.chests) {
      const x = c.x - cam, y = c.y;
      if (x < -60 || x > VIEW_W + 60) continue;
      const lid = c.opened ? -10 : 0;
      ctx.fillStyle = c.hidden ? '#b98a2a' : '#8a5a3a'; ctx.fillRect(x - 18, y - 22, 36, 22);
      ctx.fillStyle = c.hidden ? '#ffd36a' : '#c9a77e'; ctx.fillRect(x - 20, y - 30 + lid, 40, 10);
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 3, y - 18, 6, 6);
      if (!c.opened) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(c.t * 4) * 0.12; ctx.fillStyle = c.hidden ? '#ffd36a' : '#fff0c8'; ctx.beginPath(); ctx.arc(x, y - 16, 30, 0, 7); ctx.fill(); ctx.restore(); }
    }
    // 出口のゲート
    const ex = this.ch.exitX - cam, open = !this.ch.boss || this.bossDefeated;
    if (ex > -100 && ex < VIEW_W + 100) {
      const t = this.time, gy = this.terrain.groundBelow(this.ch.exitX, 0, 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = open ? 0.75 + Math.sin(t * 3) * 0.15 : 0.25;
      const g = ctx.createRadialGradient(ex, gy - 70, 5, ex, gy - 70, 80); g.addColorStop(0, open ? '#e8d0ff' : '#776688'); g.addColorStop(1, 'rgba(80,40,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, gy - 70, 46, 78, 0, 0, 7); ctx.fill(); ctx.restore();
      ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = open ? '#ffe9a8' : '#9d90c8';
      ctx.fillText(open ? (this.ch.floor % 5 === 0 ? '出口（帰還できる）' : '出口') : '封印されている', ex, gy - 160); ctx.textAlign = 'left';
    }
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
    if (this.ch.town) Town.drawFacilities(ctx, cam, this);
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
    for (const p of this.pickups) {
      if (p.kind === 'item') { this.drawLoot(ctx, p, cam); continue; }
      Icons.draw(ctx, p.kind === 'gold' ? 'gold' : 'milk', p.x - cam, p.y, 2, p.t > 9 && Math.floor(p.t * 8) % 2);
    }
    if (this.ch.dungeon) this.drawDungeon(ctx, cam);
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
      case 'armor': R('#e8e4f0', -8, -8, 16, 14); R('#e8e4f0', -12, -8, 4, 7); R('#e8e4f0', 8, -8, 4, 7); R('#2a2540', -2, -8, 4, 4); R('#b03050', -2, -4, 4, 2); break;
      case 'acc': ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.stroke(); R('#9fe0ff', -2, -9, 4, 4); break;
      case 'gold': R('#b8860b', -5, -5, 10, 10); R('#ffd36a', -4, -4, 8, 8); R('#fff3b0', -2, -3, 2, 4); break;
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
