// プレイヤー / 敵 / 弾 / パーティクル
const IMG = {};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const fmt = s => s.replace(/\{(\w+)\}/g, (_, k) => NAMES[k] || k);

function heroFrame(anim, i) { const a = SPRITE_DATA.heroine[anim]; return [IMG[a.img], a.frames[Math.min(i, a.frames.length - 1)]]; }
function drawHero(ctx, anim, i, x, y, face, scale = HERO_SCALE * (ANIM_SCALE[anim] || 1)) {
  const [img, f] = heroFrame(anim, i);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax * scale, -f.ay * scale, f.w * scale, f.h * scale);
  ctx.restore();
}
function drawMon(ctx, spr, x, y, scale, flip, sx = 1, sy = 1) {
  const m = SPRITE_DATA.monsters[spr], img = IMG[m.img];
  const w = m.w * scale * sx, h = m.h * scale * sy;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
}

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
  }
  get weapon() { return this.weapons.length ? this.weapons[this.wIdx] : null; }
  get element() { if (this.fire) return 'fire'; const w = this.atk ? WEAPONS[this.atk.key] : (this.weapon && WEAPONS[this.weapon]); return (w && w.element) || 'none'; }
  setFace(f, t = 1.2) { this.faceOverride = f; this.faceTimer = t; }
  get portrait() {
    if (this.faceTimer > 0 && this.faceOverride) return this.faceOverride;
    if (this.hurtT > 0) return 'sad';
    if (this.hp < this.maxHp * 0.3) return 'worried';
    return 'default';
  }

  startAttack(key, opts = {}) {
    const def = WEAPONS[key];
    this.atk = { key, def, frame: 0, ft: 0, queued: false, special: !!opts.special, chainNext: opts.chainNext || null };
    this.state = 'attack'; this.anim = def.anim; this.frame = 0;
    const s = def.anim === 'swingL' || def.anim === 'swingL2' ? 'swingL' : def.anim === 'swingM' ? 'swingM' : def.anim === 'kick' ? 'kick' : 'swingS';
    Audio2.sfx(s);
    if (this.fire && key !== 'kick') Audio2.sfx('fire');
    this.enterFrame();
  }
  enterFrame() {
    const a = this.atk, def = a.def;
    const st = (def.step && def.step[a.frame]) || 0;
    this.vx = st * this.face * 6;
    for (const h of def.hits) if (h.frame === a.frame) this.w.playerHit(this, h, a);
  }

  update(dt) {
    const W = this.w, I = Input;
    this.inv -= dt; this.hurtT -= dt; this.faceTimer -= dt;
    const control = !this.locked && !W.dialogue && W.state === 'play';

    if (this.state === 'attack') {
      const a = this.atk, def = a.def;
      if (control) {
        if (I.hit('attack') || (a.special && a.frame >= def.cancelAt - 1)) a.queued = true;
        if (I.hit('kick') && a.key !== 'kick' && a.frame >= def.cancelAt) { this.startAttack('kick'); return this.physics(dt); }
      }
      a.ft += dt * 1000;
      if (a.ft >= def.frameMs[a.frame]) {
        a.ft = 0; a.frame++;
        if (a.frame >= def.frameMs.length) {
          const nxt = a.queued ? (def.next || (a.special ? null : (a.key !== 'kick' ? a.key : null))) : null;
          if (a.chainNext) { const c = a.chainNext; this.startAttack(c, { special: a.special }); }
          else if (nxt && control && a.key !== 'desk2') this.startAttack(nxt);
          else { this.atk = null; this.state = 'idle'; }
        } else {
          this.frame = a.frame; this.enterFrame();
        }
      }
      this.frame = this.atk ? this.atk.frame : 0;
      return this.physics(dt);
    }
    if (this.state === 'hurt') {
      if (this.hurtT <= 0.5) this.state = 'idle';
      return this.physics(dt);
    }

    let move = 0;
    if (control) {
      if (I.held.left) move -= 1;
      if (I.held.right) move += 1;
      if (I.hit('jump') && this.onGround) { this.vy = -780; this.onGround = false; Audio2.sfx('jump'); }
      if (I.hit('swap') && this.weapons.length > 1) {
        this.wIdx = (this.wIdx + 1) % this.weapons.length; Audio2.sfx('select');
        W.floatText(this.x, this.y - 140, WEAPONS[this.weapon].name, '#e9dcff', 14);
      }
      if (this.canFight) {
        if (I.hit('special')) {
          if (W.partnerOn && this.mp >= SPECIAL.mp) { this.mp -= SPECIAL.mp; W.doSpecial(this); return this.physics(dt); }
          else if (W.partnerOn) W.floatText(this.x, this.y - 140, 'MPが足りない', '#9bb6ff', 13);
        }
        if (I.hit('attack')) { this.startAttack(this.weapon || 'kick'); return this.physics(dt); }
        if (I.hit('kick')) { this.startAttack('kick'); return this.physics(dt); }
      }
    }
    const run = control && I.dash && move !== 0;
    const speed = run ? 340 : 190;
    this.vx = move * speed;
    if (move) this.face = move;
    if (!this.onGround) { this.anim = 'run'; this.frame = this.vy < 0 ? 1 : 4; }
    else if (move) {
      const nextAnim = run ? 'run' : 'walk';
      if (this.anim !== nextAnim) { this.anim = nextAnim; this.frame = 0; this.ft = 0; }
      this.ft += dt; const fd = run ? 0.075 : 0.15;
      if (this.ft > fd) { this.ft = 0; this.frame = (this.frame + 1) % SPRITE_DATA.heroine[this.anim].frames.length; if (run && this.frame % 3 === 0) W.dust(this.x - this.face * 20, this.y, 2); }
    } else {
      if (this.anim !== 'idle') { this.anim = 'idle'; this.frame = 0; this.ft = 0; }
      this.ft += dt; if (this.ft > 0.22) { this.ft = 0; this.frame = (this.frame + 1) % 4; }
    }
    this.physics(dt);
  }
  physics(dt) {
    const W = this.w;
    if (this.state === 'attack' || this.state === 'hurt') this.vx *= Math.pow(0.0005, dt);
    this.vy += 2100 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y >= GROUND_Y) { if (!this.onGround && this.vy > 300) W.dust(this.x, GROUND_Y, 4); this.y = GROUND_Y; this.vy = 0; this.onGround = true; }
    const lo = W.camLock ? W.camLock.min + 60 : 30, hi = W.camLock ? W.camLock.max + VIEW_W - 60 : W.ch.length - 30;
    this.x = clamp(this.x, lo, hi);
  }
  hurt(dmg, fromX) {
    if (this.inv > 0 || this.w.state !== 'play') return false;
    this.hp = Math.max(this.minHp, this.hp - dmg);
    this.inv = 1.0; this.hurtT = 0.8; this.state = 'hurt'; this.atk = null;
    this.vx = (this.x < fromX ? -1 : 1) * 320; this.vy = -280; this.onGround = false;
    Audio2.sfx('hurt'); this.w.shake = Math.max(this.w.shake, 6); this.w.hitstop = 0.06;
    this.w.floatText(this.x, this.y - 120, '-' + dmg, '#ff7a8a', 18);
    this.w.combo = 0;
    if (this.hp <= 0) this.w.onPlayerDown();
    return true;
  }
  box() { return [this.x - 22, this.y - 125, this.x + 22, this.y]; }
  gainExp(n) {
    this.exp += n;
    let need = 20 + this.lv * 15;
    while (this.exp >= need) {
      this.exp -= need; this.lv++; this.maxHp += 8; this.hp = Math.min(this.maxHp, this.hp + 25);
      Audio2.sfx('lvup'); this.w.floatText(this.x, this.y - 160, 'LEVEL UP!', '#ffe27a', 22); this.setFace('happy', 1.5);
      need = 20 + this.lv * 15;
    }
  }
  draw(ctx, cam) {
    const blink = this.inv > 0 && this.state !== 'attack' && Math.floor(this.inv * 20) % 2 === 0;
    // 影
    ctx.fillStyle = 'rgba(10,0,20,.35)'; ctx.beginPath();
    ctx.ellipse(this.x - cam, GROUND_Y + 2, 34 * (1 - (GROUND_Y - this.y) / 600), 7, 0, 0, 7); ctx.fill();
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
  }
}

// =====================================================================
//  Partner（肩に乗る小さな相棒）
// =====================================================================
class Partner {
  constructor(p) { this.p = p; this.x = p.x; this.y = p.y - 130; this.t = 0; this.glow = 0; }
  update(dt) {
    this.t += dt; this.glow = Math.max(0, this.glow - dt);
    const tx = this.p.x - this.p.face * 44, ty = this.p.y - 158 + Math.sin(this.t * 3) * 6;
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
      if (this.burnTick <= 0) { this.burnTick = 0.35; this.damage(this.boss ? 4 : 3, null, true); W.spark(this.x + rand(-15, 15), this.y - d.h * 0.6, '#ff9a3a', 3); }
    }
    const dir = Math.sign(P.x - this.x) || 1, dist = Math.abs(P.x - this.x);
    if (this.stun > 0) {
      this.stun -= dt;
      this.vx *= Math.pow(0.02, dt);
      if (d.fly && !this.launched) this.vy *= Math.pow(0.02, dt);
    } else if (W.state === 'play' && !W.dialogue) {
      this.face = dir;
      AI[d.ai](this, dt, dir, dist, P, W);
    }
    // physics
    const grav = (d.fly && !this.launched) ? 0 : 1900;
    this.vy += grav * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    const floor = d.fly && !this.launched ? GROUND_Y - 20 : GROUND_Y;
    if (this.y >= floor) {
      if (this.launched && this.vy > 380) { this.vy = -this.vy * 0.35; W.dust(this.x, GROUND_Y, 5); Audio2.sfx('kick'); }
      else { this.y = floor; this.vy = 0; this.onGround = true; if (this.launched && d.fly) { this.launched = false; } else this.launched = false; }
    }
    if (d.fly && !this.launched && this.stun <= 0 && this.y < 60) this.y = 60;
    const lo = W.camLock ? W.camLock.min - 60 : -100, hi = W.camLock ? W.camLock.max + VIEW_W + 60 : W.ch.length + 100;
    if (this.spawnT <= 0) this.x = clamp(this.x, lo + 40, hi - 40);
    // 接触ダメージ
    const contact = this.contactDmg !== undefined ? this.contactDmg : d.dmg;
    if (contact > 0 && this.stun <= 0 && this.alpha > 0.5 && overlap(this.box(), P.box())) P.hurt(contact, this.x);
  }
  damage(n, srcX, quiet) {
    if (this.dying > 0) return;
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
    const spawnA = this.spawnT > 0 ? 1 - this.spawnT / 0.4 : 1;
    // 影
    ctx.fillStyle = 'rgba(10,0,20,.3)'; ctx.beginPath();
    ctx.ellipse(this.x - cam, GROUND_Y + 2, d.w * 0.55, 6, 0, 0, 7); ctx.fill();
    ctx.save();
    ctx.globalAlpha = this.alpha * spawnA * (this.dying > 0 ? this.dying / 0.45 : 1);
    if (this.dying > 0) { sx *= 1 + (0.45 - this.dying); sy *= 1 - (0.45 - this.dying) * 1.5; }
    drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy);
    if (this.flash > 0 || this.dying > 0 || this.state === 'tele' && Math.floor(this.t * 12) % 2) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.7;
      drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy);
    }
    if (this.rage) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + Math.sin(this.t * 8) * 0.08; drawMon(ctx, d.spr, this.x - cam + ox, this.y + oy, d.scale, this.face > 0, sx, sy); }
    ctx.restore();
    if (this.burn > 0 && Math.random() < 0.5) this.w.spark(this.x + rand(-d.w / 3, d.w / 3), this.y - rand(0, d.h), '#ff8a3a', 1, -80);
    if (!this.boss && this.hp < this.maxHp && this.dying <= 0) {
      const bw = 40, x = this.x - cam - bw / 2, y = this.y - d.h - 8 + oy;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, bw, 4);
      ctx.fillStyle = '#ff6a8a'; ctx.fillRect(x, y, bw * Math.max(0, this.hp / this.maxHp), 4);
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
  golem(e, dt, dir, dist, P, W) {
    const rage = e.hp < e.maxHp * 0.5;
    if (rage && !e.rage) { e.rage = true; W.floatText(e.x, e.y - 220, '激昂！', '#ff6a6a', 26); Audio2.sfx('warn'); W.shake = 12; }
    const sp = rage ? 1.35 : 1;
    e.st -= dt * sp; e.contactDmg = 8; e.liftY = 0;
    switch (e.state) {
      case 'move':
        e.vx = dist > 150 ? dir * e.d.speed * sp : 0;
        e.cool -= dt * sp;
        if (e.cool <= 0) {
          const r = Math.random();
          if (dist < 260) { e.state = 'tele'; e.next = 'slam'; e.st = 0.85; }
          else if (r < 0.55) { e.state = 'tele'; e.next = 'charge'; e.st = 0.75; e.dir = dir; }
          else { e.state = 'tele'; e.next = 'rocks'; e.st = 0.55; }
          e.vx = 0; Audio2.sfx('warn');
        }
        break;
      case 'tele':
        e.vx = 0; e.liftY = e.next === 'slam' ? -Math.min(30, (0.85 - e.st) * 50) : 0;
        if (e.next === 'charge') e.face = e.dir;
        if (e.st <= 0) {
          if (e.next === 'slam') {
            e.state = 'recover'; e.st = 1.0; W.shake = 18; Audio2.sfx('slam'); W.dust(e.x - 80, GROUND_Y, 10); W.dust(e.x + 80, GROUND_Y, 10);
            W.addProj(new Shockwave(W, e.x, 1)); W.addProj(new Shockwave(W, e.x, -1));
            if (rage) setTimeout(() => { if (!e.dead && e.dying <= 0) { W.addProj(new Shockwave(W, e.x, 1)); W.addProj(new Shockwave(W, e.x, -1)); W.shake = 10; Audio2.sfx('slam'); } }, 450);
            if (Math.abs(P.x - e.x) < 190 && P.onGround) P.hurt(e.d.dmg, e.x);
          } else if (e.next === 'charge') { e.state = 'charge'; e.st = 1.3; }
          else {
            e.state = 'recover'; e.st = 0.8;
            const n = rage ? 5 : 3;
            for (let i = 0; i < n; i++) W.addProj(new Rock(W, e.x, e.y - 160, P.x + (i - (n - 1) / 2) * 90));
          }
        }
        break;
      case 'charge': {
        e.vx = e.dir * 560 * sp; e.contactDmg = 18;
        if (Math.random() < 0.4) W.dust(e.x - e.dir * 60, GROUND_Y, 1);
        const lo = W.camLock ? W.camLock.min + 110 : 110, hi = W.camLock ? W.camLock.max + VIEW_W - 110 : W.ch.length - 110;
        if ((e.dir > 0 && e.x >= hi) || (e.dir < 0 && e.x <= lo)) {
          e.x = clamp(e.x, lo, hi); e.vx = 0; e.state = 'dizzy'; e.st = 1.6; W.shake = 16; Audio2.sfx('slam');
          for (let i = 0; i < 4; i++) W.addProj(new Rock(W, e.x + rand(-200, 200), -40, e.x + rand(-350, 350)));
        } else if (e.st <= 0) { e.state = 'recover'; e.st = 0.6; e.vx = 0; }
        break;
      }
      case 'dizzy': case 'recover': case 'stagger':
        e.vx *= Math.pow(0.01, dt); e.contactDmg = 0;
        if (e.st <= 0) { e.state = 'move'; e.cool = rand(0.8, 1.6) / sp; }
        break;
    }
  },
};

// =====================================================================
//  Projectiles
// =====================================================================
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
    const P = this.w.player; if (!this.hitDone && overlap([this.x - 22, GROUND_Y - 46, this.x + 22, GROUND_Y], P.box())) { if (P.hurt(14, this.x - this.dir * 50)) this.hitDone = true; }
    if (Math.random() < 0.5) this.w.dust(this.x, GROUND_Y, 1); }
  draw(ctx, cam) { const x = this.x - cam; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(200,150,255,.6)'; ctx.beginPath(); ctx.moveTo(x - 26, GROUND_Y); ctx.lineTo(x, GROUND_Y - 50 - Math.sin(this.t * 30) * 6); ctx.lineTo(x + 26, GROUND_Y); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 3, GROUND_Y - 36, 6, 36); ctx.restore(); }
}
class Rock {
  constructor(w, x, y, tx) { this.w = w; this.x = x; this.y = y; const T = 1.0; this.vx = (tx - x) / T; this.vy = -500; this.g = (2 * (GROUND_Y - y - this.vy * T)) / (T * T); this.dead = false; this.r = rand(12, 18); this.rot = 0; }
  update(dt) { this.vy += this.g * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += dt * 8;
    const P = this.w.player;
    if (overlap([this.x - this.r, this.y - this.r, this.x + this.r, this.y + this.r], P.box())) { P.hurt(10, this.x); this.dead = true; this.w.dust(this.x, this.y, 5); }
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
class Burst {
  constructor(x, face, element) { this.x = x; this.face = face; this.el = element; this.life = 0.42; this.max = 0.42; }
  update(dt) { this.life -= dt; this.dead = this.life <= 0; }
  draw(ctx, cam) {
    const k = 1 - this.life / this.max, a = SPRITE_DATA.heroine.burst, f = a.frames[0];
    const s = (1.1 + k * 0.35) * HERO_SCALE;
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
