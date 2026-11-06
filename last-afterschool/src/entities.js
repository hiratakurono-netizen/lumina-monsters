// プレイヤー / 敵 / 弾 / パーティクル
const IMG = {};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const fmt = s => s.replace(/\{(\w+)\}/g, (_, k) => NAMES[k] || k);

function spriteSet(anim) {
  if (anim.startsWith('swing_')) return SPRITE_DATA.swing[anim.slice(6)];
  return SPRITE_DATA.heroine[anim];
}
function heroFrame(anim, i) { const a = spriteSet(anim); return [IMG[a.img], a.frames[Math.min(i, a.frames.length - 1)]]; }
function drawHero(ctx, anim, i, x, y, face, scale) {
  const set = spriteSet(anim);
  if (!scale) scale = set.scale || HERO_SCALE * (ANIM_SCALE[anim] || 1);
  const [img, f] = heroFrame(anim, i);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax * scale, -f.ay * scale, f.w * scale, f.h * scale);
  ctx.restore();
}
function drawMon(ctx, spr, x, y, scale, flip, sx = 1, sy = 1, rot = 0) {
  const m = SPRITE_DATA.monsters[spr], img = IMG[m.img];
  const w = m.w * scale * sx, h = m.h * scale * sy;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
  if (rot) { ctx.translate(0, -h / 2); ctx.rotate(rot); ctx.translate(0, h / 2); }   // 体の中心で傾ける
  ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
}

// =====================================================================
//  武器の絵（assets/weapons/*.png）。grip＝持ち手の位置（回転の中心＝手の位置）
//  rot＝絵の向きから「前方が上（角度0）」に合わせるための回転オフセット（度）
//  tip＝持ち手から先端へのベクトル（軌跡の計算用）
// =====================================================================
const WEAPON_ART = {
  bat:   { file: 'assets/weapons/weapon_bat.png',   grip: [7, 56], rot: 0,   tip: [0, -56], S: 1.25 },
  chair: { file: 'assets/weapons/weapon_chair.png', grip: [4, 50], rot: 0,   tip: [0, -48], S: 1.25 },
  desk:  { file: 'assets/weapons/weapon_desk.png',  grip: [8, 52], rot: -90, tip: [58, -30], S: 1.25 },
};
const HAND = { x: 20, y: -70 };  // 体の基準点から見た手の位置（ワールド、向き=+1）
const HOLD_ANGLE = { bat: -28, chair: -18, desk: -20 }; // 持ち歩き時の角度（度・前方が+90）

// =====================================================================
//  Player
// =====================================================================
class Player {
  constructor(world, save) {
    this.w = world;
    this.x = 140; this.y = GROUND_Y; this.vx = 0; this.vy = 0; this.face = 1;
    this.onGround = true; this.state = 'idle'; this.anim = 'idle'; this.frame = 0; this.ft = 0;
    this.lv = save.lv || 1; this.exp = save.exp || 0;
    this.maxHp = 100 + (this.lv - 1) * 8; this.hp = this.maxHp; this.maxMp = 50; this.mp = 10;
    const lo = world.ch.loadout;
    this.weapons = lo.weapons.slice(); this.wIdx = 0; this.fire = lo.fire; this.canFight = lo.canFight;
    this.inv = 0; this.atk = null; this.hurtT = 0; this.locked = false; this.faceTimer = 0; this.faceOverride = null;
    this.minHp = 0;
    this.guarding = false; this.dodgeT = 0; this.dodgeCD = 0; this.ghosts = []; this.jumps = 0; this.airDodged = false;
    // 本編のダンジョン：装備とステータスから組み立てる（プロローグは今まで通り）
    if (world.ch.dungeon) {
      const st = Stats.calc(save), run = world.game.run || {};
      if (run.power) st.atkPct += 20;   // 力のキャンディ（その潜入の間ずっと）
      this.stats = st; this.maxHp = st.maxHp;
      this.hp = run.hp != null ? Math.min(this.maxHp, run.hp) : this.maxHp;
      this.mp = run.mp != null ? run.mp : 10;
      this.wItems = save.equip.weapons.filter(u => u != null && Inv.byUid(save, u)).map(u => Stats.weapon(save, u));
      this.weapons = this.wItems.map(w => w.type); this.wIdx = 0; this.canFight = true; this.fire = false;
    }
  }
  get item() { return this.wItems ? this.wItems[this.wIdx] || null : null; }   // 今持っている武器の装備データ
  spCost() { return Math.max(5, SPECIAL.mp - (this.item ? this.item.spcost : 0)); }
  get weapon() { return this.weapons.length ? this.weapons[this.wIdx] : null; }
  weightSpeed() { const w = this.weapon && WEAPONS[this.weapon]; return (w ? (WEIGHT_SPEED[w.size] || 1) : 1) * (this.stats ? 1 + this.stats.move / 100 : 1) * this.envSlow(); }
  // 環境で遅くなる倍率：深雪の上 0.6、熱中症2段階目以降 0.8
  envSlow() { return (this.onGround && this.surface === 'snow' ? 0.6 : 1) * ((this.w.heatStage || 0) >= 2 ? 0.8 : 1) * (this.gimSlow || 1); }
  get jumpK() { return Math.sqrt(this.w.ch.jumpMul || 1) * (this.gimJump || 1) * (this.onGround && this.surface === 'snow' ? 0.9 : 1); }   // 深雪・流砂でも低くなる   // 雪原はジャンプの高さが約75%
  get element() {
    if (this.fire) return 'fire';
    if (this.tempElT > 0 && !(this.atk && this.atk.key === 'kick')) return this.tempEl;   // たき火などで一時的に付いた属性
    if (this.wItems) return this.atk && this.atk.key === 'kick' ? 'none' : ((this.item && this.item.element) || 'none'); const w = this.atk ? WEAPONS[this.atk.key] : (this.weapon && WEAPONS[this.weapon]); return (w && w.element) || 'none'; }
  setFace(f, t = 1.2) { this.faceOverride = f; this.faceTimer = t; }
  get portrait() {
    if (this.faceTimer > 0 && this.faceOverride) return this.faceOverride;
    if (this.hurtT > 0) return 'sad';
    if (this.hp < this.maxHp * 0.3) return 'worried';
    return 'default';
  }

  startAttack(key, opts = {}) {
    const def = WEAPONS[key];
    this.atk = { key, def, frame: 0, ft: 0, queued: false, special: !!opts.special, chainNext: opts.chainNext || null, trail: [] };
    this.state = 'attack'; this.anim = def.anim; this.frame = 0;
    const s = key === 'kick' ? 'kick' : def.size === 'L' ? 'swingL' : def.size === 'M' ? 'swingM' : 'swingS';
    Audio2.sfx(s);
    if (this.element === 'fire' && key !== 'kick') Audio2.sfx('fire');
    this.enterFrame();
  }
  enterFrame() {
    const a = this.atk, def = a.def;
    const st = (def.step && def.step[a.frame]) || 0;
    this.vx = st * this.face * 6;
    if (def.smear && def.smear.frame === a.frame) {   // 振り抜きの残像と風切り
      this.w.fx.push(new SwingSmear(this.x + this.face * 4, this.y - 82 * HERO_SIZE, def.smear, this.face, ELEMENTS[this.element]));
      this.w.shake = Math.max(this.w.shake, 2); Audio2.sfx('swingM');
    }
    for (const h of def.hits) if (h.frame === a.frame) this.w.playerHit(this, h, a);
  }
  // 武器の角度（度）。前方が+90、真上が0
  weaponAngle(a) {
    const arc = a.def.arc; if (!arc) return 0;
    const i = Math.min(a.frame, arc.length - 1), n = Math.min(i + 1, arc.length - 1);
    const k = i >= arc.length - 1 ? 0 : clamp(a.ft / a.def.frameMs[a.frame], 0, 1);
    return arc[i] + (arc[n] - arc[i]) * k;
  }
  tipAt(angle, key) {
    const art = WEAPON_ART[key], r = (angle + art.rot) * Math.PI / 180;
    const lx = art.tip[0] * Math.cos(r) - art.tip[1] * Math.sin(r);
    const ly = art.tip[0] * Math.sin(r) + art.tip[1] * Math.cos(r);
    return { x: this.x + this.face * (HAND.x + lx), y: this.y + HAND.y + ly };
  }
  // 属性武器の振り軌跡（砂・炎）を積む
  updateTrail(a, dt) {
    const key = a.def.weapon; if (!key) return;
    const el = this.element;
    a.trail.forEach(p => p.t += dt);
    a.trail = a.trail.filter(p => p.t < 0.3);
    const tip = this.tipAt(this.weaponAngle(a), key);
    a.trail.push({ x: tip.x, y: tip.y, t: 0 });
    if (el === 'sand' && Math.random() < 0.7) this.w.dust(tip.x, tip.y, 1, '#d9c08c');
    if (el === 'fire' && Math.random() < 0.8) this.w.spark(tip.x, tip.y, '#ff9a3a', 1, -40);
  }

  update(dt) {
    const W = this.w, I = Input;
    this.inv -= dt; this.hurtT -= dt; this.faceTimer -= dt; this.dodgeCD -= dt;
    if (this.tempElT > 0) this.tempElT -= dt;
    this.ghosts.forEach(g => g.t += dt); this.ghosts = this.ghosts.filter(g => g.t < 0.3);
    const control = !this.locked && !W.dialogue && W.state === 'play';
    const guardHeld = control && !!I.held.guard && this.weapons.length > 0;

    if (this.state === 'dodge') { // 緊急回避：無敵つき
      this.dodgeT -= dt; this.inv = Math.max(this.inv, 0.05);
      if (Math.random() < 0.6) this.ghosts.push({ x: this.x, y: this.y, frame: this.frame, anim: this.anim, face: this.face, t: 0 });
      if (this.dodgeT <= 0) { this.state = 'idle'; this.vx = 0; }
      return this.physics(dt);
    }

    if (this.state === 'attack') {
      const a = this.atk, def = a.def;
      if (control) {
        if (I.hit('attack') || (a.special && a.frame >= def.cancelAt - 1)) a.queued = true;
        if (I.hit('kick') && a.key !== 'kick' && a.frame >= def.cancelAt) { this.startAttack('kick'); return this.physics(dt); }
      }
      a.ft += dt * 1000 * (this.item && a.key !== 'kick' ? 1 + this.item.aspd / 100 : 1) * ((this.w.heatStage || 0) >= 2 ? 0.8 : 1);   // 攻撃速度の付与効果・熱中症で遅くなる
      if (a.ft >= def.frameMs[a.frame]) {
        a.ft = 0; a.frame++;
        if (a.frame >= def.frameMs.length) {
          const nxt = a.queued && !def.last ? (def.next || (a.special ? null : (a.key !== 'kick' ? a.key : null))) : null;
          if (a.chainNext) { const c = a.chainNext; this.startAttack(c, { special: a.special }); }
          else if (nxt && control && a.key !== 'desk2') this.startAttack(nxt);
          else { this.atk = null; this.state = 'idle'; }
        } else {
          this.frame = a.frame; this.enterFrame();
        }
      }
      if (this.atk) { const d = this.atk.def; this.frame = d.frameMap ? d.frameMap[this.atk.frame] : (d.swing || !d.weapon ? this.atk.frame : 0); this.updateTrail(this.atk, dt); }
      else this.frame = 0;
      return this.physics(dt);
    }
    if (this.state === 'hurt') {
      this.anim = 'hurt'; this.frame = Math.min(3, Math.floor((0.8 - this.hurtT) / 0.08));
      if (this.hurtT <= 0.5) this.state = 'idle';
      return this.physics(dt);
    }

    let move = 0;
    if (control) {
      if (I.held.left) move -= 1;
      if (I.held.right) move += 1;
      if (I.hit('jump') && I.held.down && this.onGround && W.terrain.surfaceAt(this.x, this.y, 12) && W.terrain.surfaceAt(this.x, this.y, 12).type === 'oneway') {
        this.dropT = 0.25; this.onGround = false; this.vy = 60;  // すり抜け床から降りる
      } else if (I.hit('jump')) {
        if (this.onGround) { this.vy = -780 * this.jumpK; this.onGround = false; this.jumps = 1; Audio2.sfx('jump'); }
        else if (this.jumps < 2) { // 空中2段ジャンプ
          this.vy = -700 * this.jumpK; this.jumps = 2; Audio2.sfx('jump');
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; W.fx.push(new Particle({ x: this.x + Math.cos(a) * 18, y: this.y - 10, vx: Math.cos(a) * 160, vy: Math.sin(a) * 50, drag: 0.02, life: 0.35, size: 4, color: '#e6dcff', add: true })); }
        }
      }
      if (I.hit('swap') && this.weapons.length > 1) {
        this.wIdx = (this.wIdx + 1) % this.weapons.length; Audio2.sfx('select');
        W.floatText(this.x, this.y - 140, this.item ? this.item.name : WEAPONS[this.weapon].name, this.item ? this.item.rarity.color : '#e9dcff', 14);
      }
      if (this.canFight) {
        if (I.hit('special') && !guardHeld) {
          if (W.partnerOn && this.mp >= this.spCost()) { this.mp -= this.spCost(); W.doSpecial(this); return this.physics(dt); }
          else if (W.partnerOn) W.floatText(this.x, this.y - 140, 'MPが足りない', '#9bb6ff', 13);
        }
        if (I.hit('attack') && !guardHeld) { this.startAttack(this.weapon || 'kick'); return this.physics(dt); }
        if (I.hit('kick') && !guardHeld) { this.startAttack('kick'); return this.physics(dt); }
      }
    }
    this.guarding = guardHeld && this.onGround;
    // ガード＋横入力＝緊急回避（スマブラ風）。空中でも1回だけ使える
    if (guardHeld && move !== 0 && this.dodgeCD <= 0 && (this.onGround || !this.airDodged)) {
      this.state = 'dodge'; this.dodgeT = 0.28; this.dodgeCD = 0.7; this.inv = 0.32;
      this.face = move; this.vx = move * 560; this.guarding = false;
      if (!this.onGround) { this.airDodged = true; this.vy = 0; }
      else W.dust(this.x, this.y, 5);
      Audio2.sfx('jump');
      return this.physics(dt);
    }
    const run = control && I.dash && move !== 0 && !this.guarding;
    const speed = (this.guarding ? 110 : run ? 340 : 190) * this.weightSpeed();
    // 氷の上は滑る（ゆっくり加速・ゆっくり止まる）
    if (this.onGround && this.surface === 'ice') this.vx += (move * speed - this.vx) * Math.min(1, dt * 2.2);
    else this.vx = move * speed;
    if (move) this.face = move;
    // 待機・ガード中は武器を構えたポーズ（振りの1コマ目）。歩き・走りは武器をしまう
    const ready = this.weapon && SPRITE_DATA.swing[this.weapon] ? `swing_${this.weapon}` : null;
    if (this.guarding) { this.anim = ready || 'idle'; this.frame = 0; this.ft = 0; }
    else if (!this.onGround) { this.anim = 'run'; this.frame = this.vy < 0 ? 2 : 6; }
    else if (move) {
      const nextAnim = run ? 'run' : 'walk';
      if (this.anim !== nextAnim) { this.anim = nextAnim; this.frame = 0; this.ft = 0; }
      this.ft += dt; const fd = run ? 0.075 : 0.13;
      if (this.ft > fd) { this.ft = 0; this.frame = (this.frame + 1) % spriteSet(this.anim).frames.length; if (run && this.frame % 3 === 0) W.dust(this.x - this.face * 20, this.y, 2); }
    } else if (ready) {
      this.anim = ready; this.frame = 0; this.ft = 0;
    } else {
      if (this.anim !== 'idle') { this.anim = 'idle'; this.frame = 0; this.ft = 0; }
      this.ft += dt; if (this.ft > 0.3) { this.ft = 0; this.frame = (this.frame + 1) % spriteSet('idle').frames.length; }
    }
    this.physics(dt);
  }
  physics(dt) {
    const W = this.w;
    if (this.state === 'attack' || this.state === 'hurt') this.vx *= Math.pow(0.0005, dt);
    if (!(this.state === 'dodge' && !this.onGround)) this.vy += 2100 * dt; // 空中回避中は落ちない
    // 地形との当たり（プロローグは GROUND_Y の平らな床なので、これまでと同じ動きになる）
    const T = W.terrain;
    // 動く床に乗っていたら、床と一緒に運ばれる
    if (this.onGround) { const rs = T.surfaceAt(this.x, this.y, 12); if (rs && rs.dx) this.x = T.blockX(this.x + rs.dx, this.x, this.y - 120, this.y - 4, 18); }
    const prevX = this.x, prevY = this.y;
    this.dropT = Math.max(0, (this.dropT || 0) - dt);
    this.x += this.vx * dt;
    this.x = T.blockX(this.x, prevX, this.y - 120, this.y - 4, 18);
    this.y += this.vy * dt;
    if (this.vy < 0) { const c = T.ceiling(this.x, prevY - 120, this.y - 120, 14); if (c !== null) { this.y = c + 120; this.vy = 0; } }
    const g = T.groundBelow(this.x, prevY, 12, this.dropT > 0);
    if (this.vy >= 0 && this.y >= g) {
      if (!this.onGround && this.vy > 300) W.dust(this.x, g, 4);
      this.y = g; this.vy = 0; this.onGround = true; this.jumps = 0; this.airDodged = false;
      const sf = T.surfaceAt(this.x, g, 12); this.surface = sf && sf.surface || null;
      if (!sf || !(sf.move || sf.crumble || sf.fragile)) this.safe = { x: this.x, y: g };   // 落ちた時に戻る場所（動く床・崩れる床は除く）  // 穴に落ちた時に戻る場所
    } else if (this.onGround) this.onGround = false;
    const lo = W.camLock ? W.camLock.min + 60 : 30, hi = W.camLock ? W.camLock.max + VIEW_W - 60 : W.ch.length - 30;
    this.x = clamp(this.x, lo, hi);
    if (this.y > VIEW_H + 80) this.fellInPit();
  }
  // 穴に落ちた：最大HPの15%（仮）のダメージで、直前の足場へ戻る
  fellInPit() {
    const W = this.w, s = this.safe || { x: 140, y: GROUND_Y };
    const d = Math.max(1, Math.round(this.maxHp * 0.15));
    this.x = s.x; this.y = s.y - 2; this.vx = 0; this.vy = 0; this.onGround = false;
    this.hp = Math.max(this.minHp, this.hp - d); this.inv = 1.0; this.state = 'idle'; this.atk = null;
    Audio2.sfx('hurt'); W.floatText(this.x, this.y - 130, '-' + d, '#ff7a8a', 18);
    if (this.hp <= 0) W.onPlayerDown();
  }
  hurt(dmg, fromX) {
    if (this.inv > 0 || this.w.state !== 'play') return false;
    if (this.w.ch.dmgMul) dmg = Math.round(dmg * this.w.ch.dmgMul);   // 深いダンジョンほど敵の攻撃が痛い
    if (this.stats && this.stats.def) dmg = Math.max(1, Math.round(dmg * 100 / (100 + this.stats.def)));   // 防御
    // ガード：正面からの攻撃はダメージ30%・ノックバックなし
    if (this.guarding && (fromX - this.x) * this.face > 0) {
      const d = Math.max(1, Math.round(dmg * 0.3));
      this.hp = Math.max(this.minHp, this.hp - d); this.inv = 0.25;
      Audio2.sfx('blip'); this.w.shake = Math.max(this.w.shake, 3); this.w.hitstop = Math.max(this.w.hitstop, 0.03);
      this.w.spark(this.x + this.face * 40, this.y - 70, '#bfe9ff', 8);
      this.w.floatText(this.x, this.y - 120, 'GUARD -' + d, '#bfe9ff', 16);
      if (this.hp <= 0) this.w.onPlayerDown();
      return true;
    }
    this.hp = Math.max(this.minHp, this.hp - dmg);
    this.inv = 1.0; this.hurtT = 0.8; this.state = 'hurt'; this.atk = null; this.guarding = false; this.anim = 'hurt'; this.frame = 0;
    this.vx = (this.x < fromX ? -1 : 1) * 320; this.vy = -280; this.onGround = false;
    Audio2.sfx('hurt'); this.w.shake = Math.max(this.w.shake, 6); this.w.hitstop = 0.06;
    this.w.floatText(this.x, this.y - 120, '-' + dmg, '#ff7a8a', 18);
    this.w.combo = 0;
    if (this.hp <= 0) this.w.onPlayerDown();
    return true;
  }
  box() { return [this.x - 20, this.y - 125 * HERO_SIZE, this.x + 20, this.y]; }
  gainExp(n) {
    this.exp += n;
    let need = expNeed(this.lv);
    while (this.exp >= need) {
      this.exp -= need; this.lv++; this.maxHp += this.w.ch.dungeon ? BAL.LV_HP : 8; this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.1));
      Audio2.sfx('lvup'); this.w.floatText(this.x, this.y - 160, 'LEVEL UP!', '#ffe27a', 22); this.setFace('happy', 1.5);
      need = expNeed(this.lv);
    }
  }
  draw(ctx, cam) {
    const blink = this.inv > 0 && this.state !== 'attack' && this.state !== 'dodge' && Math.floor(this.inv * 20) % 2 === 0;
    // 影
    ctx.fillStyle = 'rgba(10,0,20,.35)'; ctx.beginPath();
    const sg = this.w.terrain.groundBelow(this.x, this.y, 12);
    if (sg < Infinity) ctx.ellipse(this.x - cam, sg + 2, 34 * Math.max(0.3, 1 - (sg - this.y) / 600), 7, 0, 0, 7);
    ctx.fill();
    // 回避の残像
    for (const g of this.ghosts) {
      ctx.globalAlpha = 0.4 * (1 - g.t / 0.3);
      drawHero(ctx, g.anim, g.frame, g.x - cam, g.y, g.face);
    }
    if (blink) ctx.globalAlpha = 0.35;
    if (this.atk && this.atk.special) { // 必殺中のオーラ
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.random() * 0.15;
      const el = ELEMENTS[this.element];
      const g = ctx.createRadialGradient(this.x - cam, this.y - 60, 10, this.x - cam, this.y - 60, 120);
      g.addColorStop(0, el.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g;
      ctx.fillRect(this.x - cam - 130, this.y - 190, 260, 220); ctx.restore();
    }
    drawHero(ctx, this.anim, this.frame, this.x - cam, this.y, this.face);
    ctx.globalAlpha = 1;
    this.drawOverlayWeapon(ctx, cam);
    if (this.guarding) this.drawGuard(ctx, cam);
    if (this.atk) this.drawWeapon(ctx, cam);
  }
  // 手ぶらの振り（短剣・剣・斧）に、今の武器のアイコンを手の位置で重ねる
  drawOverlayWeapon(ctx, cam) {
    if (!this.anim.startsWith('swing_')) return;
    const type = this.anim.slice(6), pose = HAND_POSE[type], it = this.item;
    const path = (it && it.icon) || (WEAPON_ART[type] && WEAPON_ART[type].file), im = path && IMG[path];   // プロローグは装備データがないので種類ごとの絵
    if (!pose || !im || !im.width) return;
    const set = SPRITE_DATA.swing[type], k = set.scale, [hx, hy, ang] = pose[Math.min(this.frame, pose.length - 1)];
    const sp = ICON_SPEC[path] || ICON_GRIP[type], s = sp.size / Math.max(im.width, im.height);
    ctx.save();
    ctx.translate(Math.round(this.x - cam + this.face * hx * k), Math.round(this.y - hy * k));
    ctx.scale(this.face, 1);
    ctx.rotate((ang - sp.dir) * Math.PI / 180);   // 絵の向き（dir）を、そのコマの武器の向き（ang）に合わせる
    ctx.drawImage(im, -sp.gx * im.width * s, -sp.gy * im.height * s, im.width * s, im.height * s);
    ctx.restore();
  }
  drawGuard(ctx, cam) {
    const x = this.x - cam + this.face * 30, y = this.y - 70;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(160,220,255,.85)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 42, this.face > 0 ? -1.2 : Math.PI - 1.2, this.face > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,.18)'; ctx.fill(); ctx.restore();
  }
  // 歩き・走り・待機中も武器を手に持つ（構えの角度は HOLD_ANGLE）
  drawHeld(ctx, cam) {
    const key = this.weapon; if (!key || !WEAPON_ART[key] || this.state === 'dodge' || this.state === 'hurt') return;
    const art = WEAPON_ART[key], img = IMG[art.file];
    const ang = (HOLD_ANGLE[key] + art.rot) * Math.PI / 180;
    ctx.save();
    ctx.translate(Math.round(this.x - cam + this.face * HAND.x), Math.round(this.y + HAND.y + (this.onGround && this.anim !== 'idle' ? Math.sin(performance.now() / 110) * 2 : 0)));
    ctx.scale(this.face, 1); ctx.rotate(ang);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -art.grip[0] * art.S, -art.grip[1] * art.S, img.width * art.S, img.height * art.S);
    ctx.restore();
  }
  drawWeapon(ctx, cam) {
    const a = this.atk, key = a.def.weapon; if (!key) return;
    const art = WEAPON_ART[key], el = this.element, E = ELEMENTS[el];
    // 属性の軌跡（砂＝砂煙、炎＝揺らぐ火の線）
    if (a.trail.length > 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pts = a.trail.map(p => ({ x: p.x - cam, y: p.y, t: p.t }));
      const jit = el === 'fire' ? 4 : 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = E.glow; ctx.lineWidth = el === 'fire' ? 16 : 12; ctx.globalAlpha = 0.35;
      ctx.beginPath(); pts.forEach((p, i) => { const jx = (Math.random() - 0.5) * jit; i ? ctx.lineTo(p.x + jx, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
      ctx.strokeStyle = E.color; ctx.lineWidth = el === 'fire' ? 6 : 4; ctx.globalAlpha = 0.8;
      ctx.beginPath(); pts.forEach((p, i) => { const jx = (Math.random() - 0.5) * jit; i ? ctx.lineTo(p.x + jx, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
      ctx.restore();
    }
    if (a.def.swing) return; // 振りのコマに武器が描かれている
    // 武器本体（連続回転の武器）：持ち手（grip）を手の位置に合わせ、その点を中心に回す
    const ang = (this.weaponAngle(a) + art.rot) * Math.PI / 180;
    const img = IMG[art.file];
    ctx.save();
    ctx.translate(Math.round(this.x - cam + this.face * HAND.x), Math.round(this.y + HAND.y));
    ctx.scale(this.face, 1); ctx.rotate(ang);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -art.grip[0] * art.S, -art.grip[1] * art.S, img.width * art.S, img.height * art.S);
    ctx.restore();
  }
}

// =====================================================================
//  Partner（肩に乗る小さな相棒）
// =====================================================================
class Partner {
  constructor(p) { this.p = p; this.x = p.x; this.y = p.y - 130; this.t = 0; this.glow = 0; }
  update(dt) {
    this.t += dt; this.glow = Math.max(0, this.glow - dt);
    const tx = this.p.x - this.p.face * 40, ty = this.p.y - 140 + Math.sin(this.t * 3) * 6;
    this.x += (tx - this.x) * Math.min(1, dt * 6); this.y += (ty - this.y) * Math.min(1, dt * 6);
  }
  draw(ctx, cam) {
    const x = this.x - cam, y = this.y;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 26 + this.glow * 40 + Math.sin(this.t * 4) * 2;
    const g = ctx.createRadialGradient(x, y - 18, 2, x, y - 18, r);
    g.addColorStop(0, 'rgba(255,250,230,.45)'); g.addColorStop(1, 'rgba(255,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - 18 - r, r * 2, r * 2); ctx.restore();
    drawMon(ctx, 'wyrmling', x, y, 0.4, this.p.face > 0, 1, 1 + Math.sin(this.t * 6) * 0.03);
  }
}

// =====================================================================
//  Enemy
// =====================================================================
class Enemy {
  constructor(world, type, x, y) {
    const d = ENEMIES[type]; this.w = world; this.type = type; this.d = d;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.hp = d.hp; this.maxHp = d.hp;
    this.face = -1; this.t = rand(0, 1); this.cool = rand(0.6, 1.4); this.state = 'move'; this.st = 0;
    this.stun = 0; this.flash = 0; this.burn = 0; this.burnTick = 0; this.dead = false; this.dying = 0;
    this.onGround = !d.fly; this.alpha = 1; this.homeY = y; this.poise = 0; this.rage = false;
    this.spawnT = 0.4;
  }
  get boss() { return !!this.d.boss; }
  box() { const d = this.d; return [this.x - d.w / 2, this.y - d.h, this.x + d.w / 2, this.y]; }
  update(dt) {
    const W = this.w, P = W.player, d = this.d;
    this.t += dt; this.flash -= dt; this.spawnT -= dt;
    if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.dead = true; return; }
    if (this.burn > 0) {
      this.burn -= dt; this.burnTick -= dt;
      if (this.burnTick <= 0) { this.burnTick = 0.35; this.damage(Math.round((this.boss ? 4 : 3) * (W.ch.burnMul || 1)), null, true); W.spark(this.x + rand(-15, 15), this.y - d.h * 0.6, '#ff9a3a', 3); }
    }
    const dir = Math.sign(P.x - this.x) || 1, dist = Math.abs(P.x - this.x);
    // 置かれた敵は、主人公が近づくまで眠っている（ダンジョン）
    const asleep = this.awake === false && dist > 620; if (!asleep) this.awake = true;
    if (this.stun > 0) {
      this.stun -= dt;
      this.vx *= Math.pow(0.02, dt);
      if (d.fly && !this.launched) this.vy *= Math.pow(0.02, dt);
    } else if (this.entering) {
      // 戦闘エリアの外から跳び込んでくる途中（着地するまで行動しない）
      this.face = Math.sign(this.vx) || dir;
    } else if (W.state === 'play' && !W.dialogue && !asleep) {
      this.face = dir;
      AI[d.ai](this, dt * (this.agg || 1), dir, dist, P, W);   // 深いダンジョン・強化個体ほど行動が速い
    }
    // physics
    const grav = (d.fly && !this.launched) ? 0 : 1900;
    const T = W.terrain, prevX = this.x, prevY = this.y;
    // 足場の端から落ちないように止まる（飛ばされた時は落ちる）
    if (!d.fly && !d.boss && this.onGround && !this.launched && !this.entering && this.vx && this.vy >= 0) { const g = T.groundBelow(this.x + Math.sign(this.vx) * (d.w / 2 + 6), this.y - 2, 0); if (g > this.y + 40) this.vx = 0; }
    let slow = 1; if (this.chill > 0) { this.chill -= dt; slow = this.d.boss ? 0.75 : 0.5; if (Math.random() < 0.2) W.spark(this.x, this.y - this.d.h * 0.5, '#bfe9ff', 1); }   // 氷で凍えると動きが鈍る
    this.vy += grav * dt; this.x += this.vx * dt * slow; this.y += this.vy * dt;
    if (!d.fly) this.x = T.blockX(this.x, prevX, this.y - d.h, this.y - 4, d.w / 2);
    const gnd = T.groundBelow(this.x, prevY, 0, !!d.boss);   // ボスはすり抜け床に乗らない（大きな体で足場に引っかからないように）
    const floor = d.fly && !this.launched ? Math.min(gnd, GROUND_Y) - 20 : gnd;
    if (this.y > VIEW_H + 120 && !d.boss) { this.dead = true; return; }  // 穴に落ちた敵は消える
    if (this.y >= floor) {
      if (this.launched && this.vy > 380) { this.vy = -this.vy * 0.35; W.dust(this.x, floor, 5); Audio2.sfx('kick'); }
      else { if (this.entering && this.vy > 0) { this.entering = false; this.vx = 0; W.dust(this.x, floor, 8); Audio2.sfx('kick'); } this.y = floor; this.vy = 0; this.onGround = true; if (this.launched && d.fly) { this.launched = false; } else this.launched = false; }
    }
    if (d.fly && !this.launched && this.stun <= 0 && this.y < 60) this.y = 60;
    const lo = W.camLock ? W.camLock.min - 60 : -100, hi = W.camLock ? W.camLock.max + VIEW_W + 60 : W.ch.length + 100;
    if (this.spawnT <= 0 && !this.entering) this.x = clamp(this.x, lo + 40, hi - 40);
    // 接触ダメージ
    const contact = this.contactDmg !== undefined ? this.contactDmg : d.dmg;
    if (contact > 0 && this.stun <= 0 && this.alpha > 0.5 && overlap(this.box(), P.box())) P.hurt(contact * (this.dmgK || 1), this.x);
  }
  damage(n, srcX, quiet) {
    if (this.dying > 0) return;
    if (this.d.moss && this.moss > 0) n = Math.max(1, Math.round(n * 0.5));   // 鎧（苔・氷・溶岩）：ダメージ半減
    this.hp -= n; this.flash = 0.08;
    if (!quiet) this.w.floatText(this.x + rand(-12, 12), this.y - this.d.h - 10, String(Math.round(n)), n >= 40 ? '#ffd36a' : '#ffffff', n >= 40 ? 22 : 16);
    if (this.hp <= 0) this.w.killEnemy(this);
  }
  draw(ctx, cam) {
    const d = this.d; let sx = 1, sy = 1, ox = 0, oy = 0;
    if (d.ai === 'hop') { const s = this.onGround ? Math.sin(this.t * 10) * 0.06 : -0.08; sx = 1 + s; sy = 1 - s; if (this.state === 'crouch') { sx = 1.15; sy = 0.85; } }
    if (d.ai === 'fly') oy = Math.sin(this.t * 12) * 3;
    if (this.state === 'tele' || this.state === 'crouch') ox = Math.sin(this.t * 60) * 2;
    if (this.state === 'charge' && d.ai === 'spore') { sx = 1 + Math.sin(this.t * 30) * 0.06 + 0.1; sy = sx; }
    if (d.ai === 'golem') { oy = this.liftY || 0; }
    let rot = 0;
    // 1枚絵なので、歩き・溜め・突進をプログラムで動かす
    if (!d.fly && d.ai !== 'hop' && this.onGround && Math.abs(this.vx) > 30) oy -= Math.abs(Math.sin(this.t * 14)) * 5;
    if (d.ai === 'wolfBoss') {
      if (this.state === 'crouch') { sx = 1.18; sy = 0.78; ox = Math.sin(this.t * 50) * 2; }
      if (this.state === 'howl') { const k = Math.sin(this.t * 40) * 0.04; sx = 1 + k; sy = 1.08 - k; ox = Math.sin(this.t * 70) * 3; }
      if (this.state === 'dash') rot = -0.12;
      if (this.state === 'pounce') rot = this.vy < 0 ? -0.35 : 0.25;
      if (this.state === 'dizzy') rot = Math.sin(this.t * 6) * 0.1;
      if (this.state === 'land') { sx = 1.2; sy = 0.82; }
    }
    if (d.ai === 'slammer') { if (this.state === 'crouch') { sx = 1.2; sy = 0.78; ox = Math.sin(this.t * 50) * 2; } if (this.state === 'land') { sx = 1.25; sy = 0.8; } }
    if (d.ai === 'diver') { if (this.state === 'tele') ox = Math.sin(this.t * 70) * 3; if (this.state === 'dive') { sx = 0.8; sy = 1.25; } if (this.state === 'stuck') rot = Math.sin(this.t * 8) * 0.15; }
    if (this.entering) rot = (this.vy < 0 ? -0.25 : 0.2) * (this.face || 1);
    const spawnA = this.spawnT > 0 ? 1 - this.spawnT / 0.4 : 1;
    // 影
    ctx.fillStyle = 'rgba(10,0,20,.3)'; ctx.beginPath();
    const sg = this.w.terrain.groundBelow(this.x, this.y, 0);
    if (sg < Infinity) ctx.ellipse(this.x - cam, sg + 2, d.w * 0.55, 6, 0, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = this.alpha * spawnA * (this.dying > 0 ? this.dying / 0.45 : 1);
    if (this.dying > 0) { sx *= 1 + (0.45 - this.dying); sy *= 1 - (0.45 - this.dying) * 1.5; }
    if (this.elite && this.dying <= 0) {   // 強化個体：赤金のオーラと★
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = d.w * 0.8 + Math.sin(this.t * 6) * 4, cx = this.x - cam, cy = this.y - d.h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r); g.addColorStop(0, 'rgba(255,120,60,.45)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
      ctx.font = `14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36a'; ctx.fillText('★強化', cx, this.y - d.h - 14); ctx.textAlign = 'left';
    }
    drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy, rot);
    const tele = (this.state === 'tele' || this.state === 'crouch' || this.state === 'howl') && Math.floor(this.t * 12) % 2;
    if (this.flash > 0 || this.dying > 0 || tele) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.7;
      drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy, rot);
    }
    if (d.moss && this.moss > 0) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.45 * this.moss; ctx.filter = d.moss.filter || 'none'; drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy, rot); ctx.filter = 'none'; }
    if (this.rage) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + Math.sin(this.t * 8) * 0.08; drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy); }
    ctx.restore();
    if (this.burn > 0 && Math.random() < 0.5) this.w.spark(this.x + rand(-d.w / 3, d.w / 3), this.y - rand(0, d.h), '#ff8a3a', 1, -80);
    if (!this.boss && this.hp < this.maxHp && this.dying <= 0) {
      const bw = 40, x = this.x - cam - bw / 2, y = this.y - d.h - 8 + oy;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, bw, 4);
      ctx.fillStyle = '#ff6a8a'; ctx.fillRect(x, y, bw * Math.max(0, this.hp / this.maxHp), 4);
    }
    if (d.boss && (this.state === 'crouch' || this.state === 'howl' || this.state === 'tele')) {
      ctx.font = `28px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6a6a'; ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 5;
      ctx.strokeText('！', this.x - cam, this.y - d.h - 24); ctx.fillText('！', this.x - cam, this.y - d.h - 24); ctx.textAlign = 'left';
    }
    if (this.state === 'dizzy') {
      for (let i = 0; i < 3; i++) { const a = this.t * 4 + i * 2.1; ctx.fillStyle = '#ffe680'; ctx.fillRect(this.x - cam + Math.cos(a) * 40 - 3, this.y - d.h - 10 + Math.sin(a) * 8, 6, 6); }
    }
  }
}

// ---------------------------------------------------------------------
//  敵AI
// ---------------------------------------------------------------------
const AI = {
  hop(e, dt, dir, dist) {
    e.cool -= dt;
    if (e.onGround) {
      e.vx *= Math.pow(0.001, dt);
      if (e.cool <= 0.15 && e.cool > 0) e.state = 'crouch';
      if (e.cool <= 0) { e.state = 'move'; e.vy = -rand(330, 430); e.vx = dir * e.d.speed * rand(1.8, 2.6); e.onGround = false; e.cool = rand(0.7, 1.3); }
    }
  },
  fly(e, dt, dir, dist, P) {
    e.cool -= dt;
    if (e.state === 'move') {
      const ty = GROUND_Y - 170 + Math.sin(e.t * 2) * 30;
      e.vx += (dir * e.d.speed - e.vx) * dt * 2; e.vy = (ty - e.y) * 2;
      if (e.cool <= 0 && dist < 380) { e.state = 'tele'; e.st = 0.35; e.vx = 0; e.vy = -60; }
    } else if (e.state === 'tele') {
      e.st -= dt; if (e.st <= 0) { e.state = 'swoop'; e.st = 0.7; const dx = P.x - e.x, dy = (P.y - 50) - e.y, l = Math.hypot(dx, dy) || 1; e.vx = dx / l * 460; e.vy = dy / l * 460; }
    } else if (e.state === 'swoop') {
      e.st -= dt; if (e.st <= 0 || e.y > GROUND_Y - 30) { e.state = 'move'; e.cool = rand(1.6, 2.6); e.vy = -200; }
    }
  },
  spore(e, dt, dir, dist, P, W) {
    e.cool -= dt;
    if (e.state === 'move') {
      e.vx = dist > 120 ? dir * e.d.speed : 0;
      if (dist < 170 && e.cool <= 0) { e.state = 'charge'; e.st = 0.6; e.vx = 0; }
    } else if (e.state === 'charge') {
      e.st -= dt;
      if (e.st <= 0) { W.addProj(new Spore(W, e.x + dir * 40, e.y - 30, dir)); e.state = 'move'; e.cool = rand(1.8, 2.6); }
    }
  },
  lunge(e, dt, dir, dist) {
    e.cool -= dt;
    if (e.state === 'move') {
      e.vx = dist > 170 ? dir * e.d.speed : -dir * 40;
      if (dist < 240 && e.cool <= 0) { e.state = 'tele'; e.st = 0.45; e.vx = 0; }
    } else if (e.state === 'tele') {
      e.st -= dt; if (e.st <= 0) { e.state = 'lunge'; e.st = 0.35; e.vx = dir * 560; e.vy = -200; }
    } else if (e.state === 'lunge') {
      e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cool = rand(1.2, 2); e.vx = 0; }
    }
  },
  ghost(e, dt, dir, dist, P) {
    const cyc = (e.t % 5) / 5;
    e.alpha = cyc < 0.7 ? 0.85 : 0.2 + Math.abs(Math.sin(e.t * 6)) * 0.1;
    e.phased = cyc >= 0.7;
    const ty = P.y - 70 + Math.sin(e.t * 1.7) * 40;
    e.vx += (dir * e.d.speed - e.vx) * dt * 1.5; e.vy = (ty - e.y) * 1.5;
  },
  // ---- 本編で追加した攻撃パターン ----
  // 射撃：距離をとり、光って溜めてからエネルギー弾を撃つ（深い階ほど連射）。弾は攻撃で打ち消せる
  shooter(e, dt, dir, dist, P, W) {
    e.cool -= dt; const fly = !!e.d.fly;
    if (fly) { const ty = GROUND_Y - 200 + Math.sin(e.t * 1.6) * 30; e.vy = (Math.min(ty, P.y - 150) - e.y) * 2; }
    if (e.state === 'move') {
      const want = dist < 260 ? -dir : dist > 430 ? dir : 0;   // 近すぎたら離れ、遠すぎたら寄る
      e.vx += (want * e.d.speed - e.vx) * Math.min(1, dt * 4);
      if (e.cool <= 0 && dist < 620) { e.state = 'tele'; e.st = 0.7; e.vx = 0; e.shots = (e.agg || 1) >= 1.25 ? 2 : 1; }
    } else if (e.state === 'tele') {
      e.st -= dt; if (Math.random() < 0.4) W.spark(e.x + dir * 30, e.y - e.d.h * 0.55, e.d.shot || '#8affd0', 1);
      if (e.st <= 0) {
        const sx = e.x + dir * 34, sy = e.y - e.d.h * 0.55, a = Math.atan2((P.y - 60) - sy, P.x - sx);
        W.addProj(new EnergyShot(W, sx, sy, a, e.d.shot || '#8affd0', e.dmgK || 1)); Audio2.sfx('blip');
        e.shots--; if (e.shots > 0) e.st = 0.28; else { e.state = 'move'; e.cool = rand(2.0, 3.0); }
      }
    }
  },
  // 急降下：高い所から主人公の真上へ回り込み、震えてから真下へ突っ込む。地面に刺さって少しの間動けない（反撃の好機）
  diver(e, dt, dir, dist, P, W) {
    e.cool -= dt;
    if (e.state === 'move') {
      const ty = GROUND_Y - 320; e.vy = (ty - e.y) * 2.5; e.vx += ((P.x - e.x) * 2.2 - e.vx) * Math.min(1, dt * 3);
      e.vx = clamp(e.vx, -e.d.speed * 1.6, e.d.speed * 1.6);
      if (e.cool <= 0 && Math.abs(P.x - e.x) < 50 && e.y < GROUND_Y - 250) { e.state = 'tele'; e.st = 0.5; e.vx = 0; e.vy = 0; }
    } else if (e.state === 'tele') {
      e.st -= dt; e.vy = -30; if (e.st <= 0) { e.state = 'dive'; e.vy = 950; e.vx = 0; }
    } else if (e.state === 'dive') {
      e.vy = 950; const g = W.terrain.groundBelow(e.x, e.y - 10, 0);
      if (e.y >= Math.min(g, GROUND_Y + 40) - 24) { e.state = 'stuck'; e.st = 0.9; e.vy = 0; W.dust(e.x, e.y, 10); W.shake = Math.max(W.shake, 5); Audio2.sfx('kick'); }
    } else if (e.state === 'stuck') {
      e.vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cool = rand(1.8, 2.6); e.vy = -300; }
    }
    e.contactDmg = e.state === 'dive' ? e.d.dmg * 1.5 : e.state === 'stuck' ? 0 : e.d.dmg;
  },
  // 叩きつけ：重い体で高く跳び、主人公の位置へ落ちて衝撃波。着地の瞬間に地面にいると当たる（ジャンプでかわせる）
  slammer(e, dt, dir, dist, P, W) {
    e.cool -= dt;
    if (e.state === 'move') {
      if (e.onGround) e.vx = dist > 90 ? dir * e.d.speed : 0;
      if (e.cool <= 0 && dist < 340 && e.onGround) { e.state = 'crouch'; e.st = 0.6; e.vx = 0; }
    } else if (e.state === 'crouch') {
      e.st -= dt; if (e.st <= 0) { e.state = 'air'; const T = 0.95; e.vy = -900; e.vx = clamp((P.x - e.x) / T, -420, 420); e.onGround = false; e.airT = 0; }
    } else if (e.state === 'air') {
      e.airT += dt;
      if (e.onGround && e.airT > 0.15) {
        e.state = 'land'; e.st = 0.7; e.vx = 0; W.shake = Math.max(W.shake, 9); Audio2.sfx('slam'); W.dust(e.x, e.y, 14);
        W.addProj(new ImpactRing(W, e.x, e.y, 170, e.dmgK || 1));
      }
    } else if (e.state === 'land') { e.st -= dt; if (e.st <= 0) { e.state = 'move'; e.cool = rand(1.8, 2.8); } }
  },
  // 草原の主 オオカミ：飛びかかり（伏せて溜める）／突進（震えて赤く光る）／HP半分で子分を呼ぶ
  wolfBoss(e, dt, dir, dist, P, W) {
    const rage = e.hp < e.maxHp * 0.5;
    if (rage && !e.rage) { e.rage = true; e.state = 'howl'; e.st = 1.0; e.next = 'summon'; e.vx = 0; Audio2.sfx('warn'); W.floatText(e.x, e.y - 170, 'ウォォーン！', '#ff9a9a', 22); }
    const sp = rage ? 1.2 : 1;
    e.st -= dt; e.contactDmg = 0;
    const lo = W.camLock ? W.camLock.min + 90 : 90, hi = W.camLock ? W.camLock.max + VIEW_W - 90 : W.ch.length - 90;
    switch (e.state) {
      case 'move':   // 主人公との間合いを取りながら回り込む（下がり続けない）
        e.cool -= dt * sp;
        e.vx = dist > 300 ? dir * e.d.speed : dist < 200 ? -dir * e.d.speed * 0.6 : 0;
        if ((e.x <= lo && e.vx < 0) || (e.x >= hi && e.vx > 0)) e.vx = 0;
        if (e.cool <= 0) {
          e.vx = 0;
          if (dist < 420 && Math.random() < 0.6) { e.state = 'crouch'; e.st = 0.7 / sp; }
          else { e.state = 'howl'; e.st = 0.8 / sp; e.next = 'dash'; e.dir = dir; }
          Audio2.sfx('warn');
        }
        break;
      case 'crouch':   // 伏せて溜める → 主人公めがけて跳ぶ
        e.vx = 0; e.face = dir;
        if (e.st <= 0) { e.state = 'pounce'; const T = 0.62; e.vx = (P.x - e.x) / T; e.vy = -680; e.onGround = false; e.st = 1.2; }
        break;
      case 'pounce':
        e.contactDmg = e.d.dmg;
        if (e.onGround && e.vy >= 0) {
          e.state = 'land'; e.st = 0.9; e.vx = 0; W.shake = 12; Audio2.sfx('slam'); W.dust(e.x, e.y, 10);
          W.addProj(new Shockwave(W, e.x, 1)); W.addProj(new Shockwave(W, e.x, -1));
        }
        break;
      case 'howl':     // 震えて赤く光る → 突進 or 子分を呼ぶ
        e.vx = 0;
        if (e.next === 'dash') e.face = e.dir;
        if (e.st <= 0) {
          if (e.next === 'summon') {
            for (const side of [1, -1]) { const m = W.makeEnemy(e.d.minion || 'wolf', side > 0 ? hi : lo, undefined, W.ch.foeScale || { hpMul: 1 + 0.14 * ((W.ch.floor || 1) - 1), dmgMul: e.dmgMul }); m.vx = -side * 120; W.enemies.push(m); }
            e.state = 'move'; e.cool = 1.5;
          } else { e.state = 'dash'; e.st = 1.6; }
        }
        break;
      case 'dash': {   // 端まで駆け抜ける。壁にぶつかると目を回す
        e.vx = e.dir * 600 * sp; e.contactDmg = Math.round(e.d.dmg * 1.1);
        if (Math.random() < 0.5) W.dust(e.x - e.dir * 50, e.y, 1);
        if ((e.dir > 0 && e.x >= hi) || (e.dir < 0 && e.x <= lo)) { e.x = clamp(e.x, lo, hi); e.vx = 0; e.state = 'dizzy'; e.st = 1.8; W.shake = 10; Audio2.sfx('slam'); }
        else if (e.st <= 0) { e.state = 'land'; e.st = 0.6; e.vx = 0; }
        break;
      }
      case 'land': case 'dizzy': case 'stagger':
        e.vx *= Math.pow(0.01, dt);
        if (e.st <= 0) { e.state = 'move'; e.cool = rand(1.4, 2.2) / sp; }
        break;
      default: e.state = 'move';
    }
  },
  // 苔むした巨像：巨像の攻撃（叩きつけ・突進・岩）に加えて、足元からツタを生やす
  // 魔王：巨像と同じ地上の攻撃＋深淵の棘。HPが半分を切ると、扇状に闇の弾を撃ち、騎士を呼ぶ
  demonKing(e, dt, dir, dist, P, W) {
    e.orbCD = (e.orbCD === undefined ? 3 : e.orbCD) - dt;
    if (e.rage && e.state === 'move' && e.orbCD <= 0) {
      e.orbCD = 3.6; Audio2.sfx('warn'); e.state = 'recover'; e.st = 1.0; e.vx = 0;
      for (let i = -2; i <= 2; i++) W.addProj(new DarkOrb(W, e.x, e.y - e.d.h * 0.6, Math.atan2(P.y - 60 - (e.y - e.d.h * 0.6), P.x - e.x) + i * 0.22, 0.5));
      if (!e.called || W.enemies.filter(x => x.type === 'royal_guard').length === 0 && Math.random() < 0.35) {
        e.called = true;
        for (const side of [1, -1]) { const lo = W.camLock ? W.camLock.min + 90 : 90, hi = W.camLock ? W.camLock.max + VIEW_W - 90 : W.ch.length - 90; const m = W.makeEnemy('royal_guard', side > 0 ? hi : lo, undefined, W.ch.foeScale || { hpMul: 2 }); m.vx = -side * 120; W.enemies.push(m); }
      }
      return;
    }
    AI.golemMoss(e, dt, dir, dist, P, W);
  },
  golemMoss(e, dt, dir, dist, P, W) {
    if (e.moss === undefined) e.moss = e.d.moss ? 1 : 0;
    e.vineCD = (e.vineCD === undefined ? 4 : e.vineCD) - dt;
    if (e.state === 'move' && e.vineCD <= 0) {
      e.vineCD = e.rage ? 4.5 : 6.5; Audio2.sfx('warn');
      const n = e.rage ? 3 : 2;
      for (let i = 0; i < n; i++) W.addProj(new Vine(W, P.x + (i - (n - 1) / 2) * 110, 0.9 + i * 0.25, e.d.vine));
      e.state = 'recover'; e.st = 1.2; e.vx = 0;
      return;
    }
    AI.golem(e, dt, dir, dist, P, W);
  },
  golem(e, dt, dir, dist, P, W) {
    const rage = e.hp < e.maxHp * 0.5;
    if (rage && !e.rage) { e.rage = true; W.floatText(e.x, e.y - 220, '激昂！', '#ff6a6a', 26); Audio2.sfx('warn'); W.shake = 12; }
    // 弱体化：激昂時の加速を控えめに（1.35→1.15）、歩きの接触ダメージ 8→5
    const sp = rage ? 1.15 : 1;
    e.st -= dt * sp; e.contactDmg = 5; e.liftY = 0;
    switch (e.state) {
      case 'move':
        e.vx = dist > 150 ? dir * e.d.speed * sp : 0;
        e.cool -= dt * sp;
        if (e.cool <= 0) {
          const r = Math.random();
          // 予備動作を長めにして見てから避けられるように
          if (dist < 260) { e.state = 'tele'; e.next = 'slam'; e.st = 1.1; }
          else if (r < 0.5) { e.state = 'tele'; e.next = 'charge'; e.st = 1.0; e.dir = dir; }
          else { e.state = 'tele'; e.next = 'rocks'; e.st = 0.8; }
          e.vx = 0; Audio2.sfx('warn');
        }
        break;
      case 'tele':
        e.vx = 0; e.liftY = e.next === 'slam' ? -Math.min(30, (1.1 - e.st) * 40) : 0;
        if (e.next === 'charge') e.face = e.dir;
        if (e.st <= 0) {
          if (e.next === 'slam') {
            e.state = 'recover'; e.st = 1.4; W.shake = 18; Audio2.sfx('slam'); W.dust(e.x - 80, GROUND_Y, 10); W.dust(e.x + 80, GROUND_Y, 10);
            W.addProj(new Shockwave(W, e.x, 1)); W.addProj(new Shockwave(W, e.x, -1));
            if (rage) setTimeout(() => { if (!e.dead && e.dying <= 0) { W.addProj(new Shockwave(W, e.x, 1)); W.addProj(new Shockwave(W, e.x, -1)); W.shake = 10; Audio2.sfx('slam'); } }, 650);
            if (Math.abs(P.x - e.x) < 170 && P.onGround) P.hurt(e.d.dmg, e.x);
          } else if (e.next === 'charge') { e.state = 'charge'; e.st = 1.3; }
          else {
            e.state = 'recover'; e.st = 1.1;
            const n = rage ? 3 : 2;
            for (let i = 0; i < n; i++) W.addProj(new Rock(W, e.x, e.y - 160, P.x + (i - (n - 1) / 2) * 90));
          }
        }
        break;
      case 'charge': {
        e.vx = e.dir * 480 * sp; e.contactDmg = 13;
        if (Math.random() < 0.4) W.dust(e.x - e.dir * 60, GROUND_Y, 1);
        const lo = W.camLock ? W.camLock.min + 110 : 110, hi = W.camLock ? W.camLock.max + VIEW_W - 110 : W.ch.length - 110;
        if ((e.dir > 0 && e.x >= hi) || (e.dir < 0 && e.x <= lo)) {
          e.x = clamp(e.x, lo, hi); e.vx = 0; e.state = 'dizzy'; e.st = 2.2; W.shake = 16; Audio2.sfx('slam');
          for (let i = 0; i < 2; i++) W.addProj(new Rock(W, e.x + rand(-200, 200), -40, e.x + rand(-350, 350)));
        } else if (e.st <= 0) { e.state = 'recover'; e.st = 0.6; e.vx = 0; }
        break;
      }
      case 'dizzy': case 'recover': case 'stagger':
        e.vx *= Math.pow(0.01, dt); e.contactDmg = 0;
        if (e.st <= 0) { e.state = 'move'; e.cool = rand(1.8, 2.8) / sp; } // 攻撃の間隔 0.8〜1.6秒 → 1.8〜2.8秒
        break;
    }
  },
};

// =====================================================================
//  Projectiles
// =====================================================================
// ツタ：地面に予兆（緑の光）→ 0.4秒だけ地面から突き出す
// ボスが地面から突き出させる物の色（草原＝ツタ・砂漠＝砂の槍・雪原＝氷柱・火山＝溶岩）
const VINE_COLORS = {
  grass: { warn: 'rgba(120,230,120,A)', dark: '#3e6b48', light: '#7fb069' },
  sand: { warn: 'rgba(240,200,120,A)', dark: '#a8763c', light: '#e8c98a' },
  ice: { warn: 'rgba(160,220,255,A)', dark: '#5a8fc0', light: '#dff4ff' },
  lava: { warn: 'rgba(255,120,60,A)', dark: '#7a2a14', light: '#ffb35a' },
  abyss: { warn: 'rgba(190,110,255,A)', dark: '#2a1040', light: '#b070ff' },
};
class Vine {
  constructor(w, x, delay, kind = 'grass') { this.w = w; this.x = x; this.t = -delay; this.c = VINE_COLORS[kind] || VINE_COLORS.grass; this.dead = false; this.hit = false; this.gy = w.terrain.groundBelow(x, 0, 0); if (this.gy === Infinity) this.dead = true; }
  update(dt) {
    this.t += dt; if (this.t > 0.45) this.dead = true;
    if (this.t >= 0 && !this.hit && overlap([this.x - 26, this.gy - 120, this.x + 26, this.gy], this.w.player.box())) { if (this.w.player.hurt(11, this.x)) this.hit = true; }
    if (this.t >= 0 && this.t < dt * 1.5) { this.w.dust(this.x, this.gy, 6, this.c.light); this.w.shake = Math.max(this.w.shake, 4); Audio2.sfx('kick'); }
  }
  draw(ctx, cam) {
    const x = this.x - cam;
    if (this.t < 0) { const a = 0.3 + 0.3 * Math.sin(this.t * 30); ctx.fillStyle = this.c.warn.replace('A', a); ctx.fillRect(x - 30, this.gy - 6, 60, 6); return; }
    const h = 120 * Math.min(1, this.t / 0.08) * (this.t > 0.3 ? 1 - (this.t - 0.3) / 0.15 : 1);
    ctx.fillStyle = this.c.dark; ctx.beginPath(); ctx.moveTo(x - 22, this.gy); ctx.lineTo(x - 4, this.gy - h); ctx.lineTo(x + 6, this.gy - h * 0.7); ctx.lineTo(x + 22, this.gy); ctx.fill();
    ctx.fillStyle = this.c.light; ctx.fillRect(x - 3, this.gy - h, 5, h * 0.9);
  }
}
// エネルギー弾（射撃する敵）。主人公の攻撃で打ち消せる（reflectable）
class EnergyShot {
  constructor(w, x, y, ang, color, k = 1) { Object.assign(this, { w, x, y, ang, color, k, t: 0, dead: false, reflectable: true }); }
  box() { return [this.x - 12, this.y - 12, this.x + 12, this.y + 12]; }
  update(dt) {
    this.t += dt; this.x += Math.cos(this.ang) * 320 * dt; this.y += Math.sin(this.ang) * 320 * dt;
    if (this.t > 3 || this.y > this.w.terrain.groundBelow(this.x, this.y - 30, 0) || this.y > GROUND_Y + 60) { this.dead = true; this.w.spark(this.x, this.y, this.color, 4); }
    if (overlap(this.box(), this.w.player.box())) { this.w.player.hurt(10 * this.k, this.x); this.dead = true; }
    if (Math.random() < 0.5) this.w.fx.push(new Particle({ x: this.x, y: this.y, life: 0.25, size: 5, color: this.color, add: true }));
  }
  draw(ctx, cam) {
    const x = this.x - cam, r = 11 + Math.sin(this.t * 30) * 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, this.y, 1, x, this.y, r * 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, this.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 2, this.y - r * 2, r * 4, r * 4); ctx.restore();
  }
}
// 叩きつけの衝撃：着地の瞬間、近くの地面にいる主人公に当たる（空中ならかわせる）
class ImpactRing {
  constructor(w, x, y, r, k = 1) { Object.assign(this, { w, x, y, r, k, t: 0, dead: false });
    const P = w.player; if (P.onGround && Math.abs(P.x - x) < r && Math.abs(P.y - y) < 40) P.hurt(14 * k, x); }
  update(dt) { this.t += dt; if (this.t > 0.4) this.dead = true; }
  draw(ctx, cam) {
    const x = this.x - cam, k = this.t / 0.4;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe2b0'; ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(x, this.y, this.r * (0.4 + k * 0.6), 14 * (0.4 + k), 0, 0, 7); ctx.stroke(); ctx.restore();
  }
}
// 闇の弾：少し溜めてから真っすぐ飛ぶ
class DarkOrb {
  constructor(w, x, y, ang, delay) { Object.assign(this, { w, x, y, ang, t: -delay, dead: false }); }
  update(dt) {
    this.t += dt; if (this.t < 0) return;
    this.x += Math.cos(this.ang) * 330 * dt; this.y += Math.sin(this.ang) * 330 * dt;
    if (this.t > 3.5 || this.y > GROUND_Y + 20) this.dead = true;
    if (overlap([this.x - 14, this.y - 14, this.x + 14, this.y + 14], this.w.player.box())) { this.w.player.hurt(12, this.x); this.dead = true; }
  }
  draw(ctx, cam) {
    const x = this.x - cam, r = this.t < 0 ? 6 + (0.5 + this.t) * 16 : 13;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, this.y, 1, x, this.y, r * 2); g.addColorStop(0, '#f0d8ff'); g.addColorStop(0.4, '#9a4dff'); g.addColorStop(1, 'rgba(60,0,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 2, this.y - r * 2, r * 4, r * 4); ctx.restore();
  }
}
class Spore {
  constructor(w, x, y, dir) { this.w = w; this.x = x; this.y = y; this.vx = dir * 90; this.t = 0; this.dead = false; }
  update(dt) { this.t += dt; this.x += this.vx * dt; this.vx *= 0.98; if (this.t > 1.3) this.dead = true;
    const r = 18 + this.t * 30, P = this.w.player;
    if (this.t > 0.1 && overlap([this.x - r, this.y - r, this.x + r, this.y + r], P.box())) P.hurt(8, this.x); }
  draw(ctx, cam) { const r = 18 + this.t * 30; ctx.save(); ctx.globalAlpha = Math.max(0, 0.55 - this.t * 0.4);
    ctx.fillStyle = '#c69bff'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(this.x - cam + Math.cos(i * 1.3 + this.t * 2) * r * 0.5, this.y + Math.sin(i * 2.1 + this.t) * r * 0.4, r * 0.55, 0, 7); ctx.fill(); }
    ctx.restore(); }
}
class Shockwave {
  constructor(w, x, dir) { this.w = w; this.x = x; this.dir = dir; this.t = 0; this.dead = false; this.hitDone = false; }
  update(dt) { this.t += dt; this.x += this.dir * 430 * dt; if (this.t > 1.8) this.dead = true;
    const P = this.w.player; if (!this.hitDone && overlap([this.x - 22, GROUND_Y - 46, this.x + 22, GROUND_Y], P.box())) { if (P.hurt(10, this.x - this.dir * 50)) this.hitDone = true; }
    if (Math.random() < 0.5) this.w.dust(this.x, GROUND_Y, 1); }
  draw(ctx, cam) { const x = this.x - cam; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(200,150,255,.6)'; ctx.beginPath(); ctx.moveTo(x - 26, GROUND_Y); ctx.lineTo(x, GROUND_Y - 50 - Math.sin(this.t * 30) * 6); ctx.lineTo(x + 26, GROUND_Y); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 3, GROUND_Y - 36, 6, 36); ctx.restore(); }
}
class Rock {
  constructor(w, x, y, tx) { this.w = w; this.x = x; this.y = y; const T = 1.0; this.vx = (tx - x) / T; this.vy = -500; this.g = (2 * (GROUND_Y - y - this.vy * T)) / (T * T); this.dead = false; this.r = rand(12, 18); this.rot = 0; }
  update(dt) { this.vy += this.g * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += dt * 8;
    const P = this.w.player;
    if (overlap([this.x - this.r, this.y - this.r, this.x + this.r, this.y + this.r], P.box())) { P.hurt(8, this.x); this.dead = true; this.w.dust(this.x, this.y, 5); }
    if (this.y >= GROUND_Y - 4) { this.dead = true; this.w.dust(this.x, GROUND_Y, 6); Audio2.sfx('kick'); } }
  draw(ctx, cam) { ctx.save(); ctx.translate(this.x - cam, this.y); ctx.rotate(this.rot);
    ctx.fillStyle = '#7d7488'; ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
    ctx.fillStyle = '#a49ab0'; ctx.fillRect(-this.r, -this.r, this.r, this.r / 2); ctx.restore(); }
}

// =====================================================================
//  Particles / effects
// =====================================================================
class Particle {
  constructor(o) { Object.assign(this, { vx: 0, vy: 0, g: 0, life: 0.5, size: 3, color: '#fff', drag: 1, add: false }, o); this.max = this.life; }
  update(dt) { this.life -= dt; this.vy += this.g * dt; this.vx *= Math.pow(this.drag, dt); this.vy *= Math.pow(this.drag, dt); this.x += this.vx * dt; this.y += this.vy * dt; this.dead = this.life <= 0; }
  draw(ctx, cam) { ctx.globalAlpha = Math.max(0, this.life / this.max); if (this.add) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.color; const s = this.size; ctx.fillRect(Math.round(this.x - cam - s / 2), Math.round(this.y - s / 2), s, s);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
}
class SlashArc {
  constructor(x, y, r, face, color, glow, life = 0.16) { Object.assign(this, { x, y, r, face, color, glow, life, max: life }); }
  update(dt) { this.life -= dt; this.dead = this.life <= 0; }
  draw(ctx, cam) {
    const k = 1 - this.life / this.max;
    ctx.save(); ctx.translate(this.x - cam, this.y); ctx.scale(this.face, 1);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = this.glow; ctx.lineWidth = 16 * (1 - k) + 2; ctx.beginPath(); ctx.arc(0, 0, this.r * (0.9 + k * 0.2), -1.4, 1.1); ctx.stroke();
    ctx.strokeStyle = this.color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(0, 0, this.r * (0.9 + k * 0.2), -1.3, 1.0); ctx.stroke();
    ctx.restore();
  }
}
// 振り抜きの残像：from（度）→ to（度）へ一気に伸びて、すぐ薄れる三日月
class SwingSmear {
  constructor(x, y, sm, face, E) { Object.assign(this, { x, y, sm, face, E, life: 0.24, max: 0.24 }); }
  update(dt) { this.life -= dt; this.dead = this.life <= 0; }
  draw(ctx, cam) {
    const k = 1 - this.life / this.max, grow = Math.min(1, k / 0.25), fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const a0 = this.sm.from * Math.PI / 180, a1 = a0 + (this.sm.to - this.sm.from) * Math.PI / 180 * grow, r = this.sm.r;
    ctx.save(); ctx.translate(this.x - cam, this.y); ctx.scale(this.face, 1); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
    const n = 18;
    for (let i = 0; i < n; i++) {   // 先端ほど太く明るい
      const t0 = i / n, t1 = (i + 1) / n + 0.01, w = 3 + 17 * t1;
      ctx.globalAlpha = fade * (0.15 + 0.85 * t1 * t1);
      ctx.strokeStyle = i > n - 4 ? '#ffffff' : this.E.color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(0, 0, r - w * 0.3, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1); ctx.stroke();
    }
    ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = this.E.glow; ctx.lineWidth = 2;   // 風切りの線
    for (let i = 0; i < 4; i++) { const rr = r + 14 + i * 9; ctx.beginPath(); ctx.arc(0, 0, rr, a1 - 0.9 + i * 0.1, a1 - 0.1); ctx.stroke(); }
    ctx.restore();
  }
}
class Burst {
  constructor(x, face, element) { this.x = x; this.face = face; this.el = element; this.life = 0.42; this.max = 0.42; }
  update(dt) { this.life -= dt; this.dead = this.life <= 0; }
  draw(ctx, cam) {
    const k = 1 - this.life / this.max, a = SPRITE_DATA.heroine.burst, f = a.frames[0];
    const s = (1.1 + k * 0.35) * HERO_SCALE * HERO_SIZE;
    ctx.save(); ctx.translate(this.x - cam, GROUND_Y + 6); ctx.scale(this.face, 1);
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    ctx.drawImage(IMG[a.img], f.x, f.y, f.w, f.h, -f.ax * s, -f.ay * s * (1 + k * 0.3), f.w * s, f.h * s * (1 + k * 0.3));
    ctx.restore();
    if (this.el !== 'none') { // 属性の色を加算で重ねる
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * (1 - k);
      const e = ELEMENTS[this.el], g = ctx.createRadialGradient(this.x - cam, GROUND_Y - 40, 10, this.x - cam, GROUND_Y - 40, 200);
      g.addColorStop(0, e.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(this.x - cam - 220, GROUND_Y - 240, 440, 260); ctx.restore();
    }
  }
}
class FloatText {
  constructor(x, y, text, color, size) { Object.assign(this, { x, y, text, color, size, life: 0.9, max: 0.9, vy: -70 }); }
  update(dt) { this.life -= dt; this.y += this.vy * dt; this.vy *= 0.92; this.dead = this.life <= 0; }
  draw(ctx, cam) {
    ctx.globalAlpha = Math.min(1, this.life / 0.3); ctx.font = `${this.size}px DotGothic16, monospace`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a0f2a'; ctx.strokeText(this.text, this.x - cam, this.y);
    ctx.fillStyle = this.color; ctx.fillText(this.text, this.x - cam, this.y); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
}
