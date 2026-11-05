// シーン管理・会話・HUD・メインループ
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const FONT = 'DotGothic16, "Hiragino Sans", monospace';
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);

// =====================================================================
//  Save
// =====================================================================
// セーブは src/systems/save.js（v2・旧データは自動で移行）

// =====================================================================
//  Dialogue
// =====================================================================
class Dialogue {
  constructor(lines, done) { this.lines = lines; this.i = 0; this.chars = 0; this.done = done; this.closed = !lines.length; this.blipT = 0; }
  get line() { return this.lines[this.i]; }
  update(dt) {
    if (this.closed) return;
    const len = this.line.text.length;
    const prev = Math.floor(this.chars);
    this.chars = Math.min(len, this.chars + dt * (this.line.who === 'narr' ? 22 : 34));
    if (Math.floor(this.chars) !== prev && prev % 2 === 0 && this.line.who !== 'narr') Audio2.sfx('blip');
    if (Input.hit('pause')) { this.closed = true; return; }
    if (Input.confirm() || Input.hit('kick')) {
      if (this.chars < len) this.chars = len;
      else { this.i++; this.chars = 0; if (this.i >= this.lines.length) this.closed = true; }
    }
  }
  draw(ctx, player) {
    if (this.closed) return;
    const L = this.line, text = L.text.slice(0, Math.floor(this.chars));
    if (L.who === 'narr') {
      ctx.fillStyle = 'rgba(8,4,16,.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = `22px ${FONT}`; ctx.fillStyle = '#efe6ff'; ctx.textAlign = 'center';
      wrap(ctx, text, VIEW_W / 2, VIEW_H / 2 - 10, 760, 34, true);
      ctx.textAlign = 'left'; this.prompt(ctx, VIEW_W / 2 + 6, VIEW_H / 2 + 60);
      return;
    }
    if (L.who === 'sys') {
      const w = 640, x = (VIEW_W - w) / 2, y = 70;
      panel(ctx, x, y, w, 64, 'rgba(30,22,52,.92)', '#ffe27a');
      ctx.font = `17px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center';
      ctx.fillText('▶ ' + text, VIEW_W / 2, y + 38); ctx.textAlign = 'left';
      this.prompt(ctx, x + w - 22, y + 50); return;
    }
    const x = 40, y = VIEW_H - 170, w = VIEW_W - 80, h = 150;
    panel(ctx, x, y, w, h, 'rgba(22,16,40,.93)', '#b9a2ff');
    let tx = x + 26;
    const name = { hero: NAMES.hero, partner: NAMES.partner, friend: NAMES.friend, news: 'ニュース', '???': '？？？' }[L.who] || '';
    if (L.who === 'hero') {
      const img = IMG[SPRITE_DATA.portraits[L.face || 'default']];
      panel(ctx, x + 14, y + 14, 122, 122, '#2a2140', '#e0d0ff');
      ctx.drawImage(img, x + 19, y + 19, 112, 112); tx = x + 156;
    } else if (L.who === 'partner' || L.who === '???') {
      panel(ctx, x + w - 136, y + 14, 122, 122, '#2a2140', '#fff4d0');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,200,.15)'; ctx.fillRect(x + w - 131, y + 19, 112, 112); ctx.restore();
      drawMon(ctx, 'wyrmling', x + w - 75, y + 120, 0.55, false);
      if (L.who === '???') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x + w - 131, y + 19, 112, 112); }
    }
    if (name) {
      panel(ctx, tx - 6, y - 18, ctx.measureText(name).width + 60, 32, '#3b2d63', '#e0d0ff');
      ctx.font = `17px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(name, tx + 10, y + 4);
    }
    ctx.font = `20px ${FONT}`; ctx.fillStyle = L.who === 'news' ? '#bfe3ff' : L.who === 'friend' ? '#ffd6e6' : '#f4eeff';
    const maxW = (L.who === 'partner' || L.who === '???') ? w - 190 : x + w - tx - 30;
    wrap(ctx, text, tx, y + 50, maxW, 32);
    this.prompt(ctx, x + w - (L.who === 'partner' || L.who === '???' ? 160 : 30), y + h - 18);
  }
  prompt(ctx, x, y) {
    if (this.chars < this.line.text.length) return;
    const b = Math.sin(performance.now() / 150) * 3;
    ctx.fillStyle = '#e0d0ff'; ctx.beginPath(); ctx.moveTo(x - 8, y - 6 + b); ctx.lineTo(x + 8, y - 6 + b); ctx.lineTo(x, y + 4 + b); ctx.fill();
  }
}
function panel(ctx, x, y, w, h, fill, line) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
}
function wrap(ctx, text, x, y, maxW, lh, center) {
  const lines = []; let cur = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      if ('、。！？…」』）'.includes(ch)) { cur += ch; lines.push(cur); cur = ''; continue; }
      lines.push(cur); cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  const y0 = center ? y - (lines.length - 1) * lh / 2 : y;
  lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
}

// =====================================================================
//  HUD
// =====================================================================
function drawHud(ctx, W) {
  const P = W.player;
  // ステータスパネル（モックの配置に準拠）
  panel(ctx, 14, 12, 420, 92, 'rgba(18,12,34,.85)', '#8f7fd0');
  panel(ctx, 20, 18, 80, 80, '#2a2140', '#d8c8ff');
  ctx.drawImage(IMG[SPRITE_DATA.portraits[P.portrait]], 24, 22, 72, 72);
  ctx.font = `15px ${FONT}`; ctx.fillStyle = '#fff';
  ctx.fillText(`HP: ${Math.ceil(P.hp)}/${P.maxHp}`, 112, 38);
  bar(ctx, 112, 44, 180, 9, P.hp / P.maxHp, P.hp < P.maxHp * 0.3 ? '#ff6a6a' : '#4fd06a');
  ctx.fillStyle = '#fff'; ctx.fillText(`MP: ${Math.floor(P.mp)}/${P.maxMp}`, 112, 72);
  bar(ctx, 112, 78, 180, 9, P.mp / P.maxMp, P.mp >= SPECIAL.mp ? '#5ab4ff' : '#3a6fb0');
  if (W.partnerOn && P.mp >= SPECIAL.mp && P.canFight) { ctx.fillStyle = `rgba(255,230,120,${0.6 + Math.sin(W.time * 6) * 0.4})`; ctx.font = `12px ${FONT}`; ctx.fillText('V:必殺OK', 230, 72); }
  // 武器スロット
  for (let i = 0; i < 3; i++) {
    const x = 304 + i * 42, y = 30, k = P.weapons[i];
    panel(ctx, x, y, 38, 38, k && i === P.wIdx ? '#3b2d63' : '#1e1734', k && i === P.wIdx ? '#a8ffb0' : '#5a4d86');
    if (k) Icons.draw(ctx, k, x + 19, y + 22, 1.4);
    if (k && P.fire) Icons.draw(ctx, 'fire', x + 31, y + 32, 0.6);
  }
  ctx.font = `11px ${FONT}`; ctx.fillStyle = '#b9aee0';
  if (P.item) ctx.fillStyle = P.item.rarity.color;
  ctx.fillText(P.item ? P.item.name : P.weapon ? WEAPONS[P.weapon].name : (P.canFight ? '素手（キック）' : ''), 304, 84);
  if (P.tempElT > 0) { const E = ELEMENTS[P.tempEl]; ctx.font = `12px ${FONT}`; ctx.fillStyle = E.color; ctx.fillText(`${E.name}属性 ${Math.ceil(P.tempElT)}秒`, 304, 98); }
  if (W.ch.dungeon) { ctx.font = `14px ${FONT}`; ctx.fillStyle = '#ffe27a'; const g = `所持金 ${Game.save.gold} G` + (Game.run ? `（今回 +${Game.run.gained}）` : ''); ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 4; ctx.strokeText(g, 20, IS_TOUCH ? 152 : 128); ctx.fillText(g, 20, IS_TOUCH ? 152 : 128); }
  // 下部
  ctx.font = `18px ${FONT}`; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 4;
  // スマホでは下端がボタンに隠れるので Lv/TIME を上に置く
  const lvY = IS_TOUCH ? 128 : VIEW_H - 16, timeY = IS_TOUCH ? 56 : VIEW_H - 16;
  const lv = `Lv ${P.lv}`; ctx.strokeText(lv, 20, lvY); ctx.fillText(lv, 20, lvY);
  const need = expNeed(P.lv); bar(ctx, 80, lvY - 10, 80, 5, P.exp / need, '#ffe27a');
  const t = W.time, tt = `TIME ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  ctx.textAlign = 'right'; ctx.strokeText(tt, VIEW_W - 20, timeY); ctx.fillText(tt, VIEW_W - 20, timeY);
  ctx.font = `14px ${FONT}`; ctx.fillStyle = '#d8ccff';
  const st = `${W.ch.title}  ${W.ch.sub}`; ctx.strokeText(st, VIEW_W - 20, 30); ctx.fillText(st, VIEW_W - 20, 30);
  // コンボ
  if (W.combo >= 2) {
    const s = 1 + Math.max(0, W.comboT - 1.9) * 2;
    ctx.save(); ctx.translate(VIEW_W - 30, IS_TOUCH ? 130 : 110); ctx.scale(s, s);
    ctx.font = `34px ${FONT}`; ctx.fillStyle = W.combo >= 25 ? '#ff8ad0' : W.combo >= 10 ? '#ffe27a' : '#fff';
    ctx.strokeText(W.combo, -60, 0); ctx.fillText(W.combo, -60, 0);
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#e0d0ff'; ctx.strokeText('HITS', 0, 0); ctx.fillText('HITS', 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  // GO →
  if (W.goArrow > 0 && Math.floor(W.goArrow * 4) % 2 === 0) {
    ctx.font = `32px ${FONT}`; ctx.fillStyle = '#ffe27a'; ctx.strokeText('GO ▶', VIEW_W - 150, VIEW_H / 2); ctx.fillText('GO ▶', VIEW_W - 150, VIEW_H / 2);
  }
  // ボス
  const B = W.boss;
  if (B) {
    const bw = IS_TOUCH ? 440 : 560, x = (VIEW_W - bw) / 2, y = IS_TOUCH ? 150 : VIEW_H - 46;
    ctx.font = `15px ${FONT}`; ctx.fillStyle = '#ffd0d8'; ctx.strokeText(B.d.name, x, y - 8); ctx.fillText(B.d.name, x, y - 8);
    bar(ctx, x, y, bw, 12, Math.max(0, B.hp / B.maxHp), B.rage ? '#ff4a6a' : '#d070ff');
    if (W.bossIntro > 0) {
      const a = Math.min(1, W.bossIntro), y2 = VIEW_H / 2 - 30;
      ctx.fillStyle = `rgba(120,10,30,${0.6 * a})`; ctx.fillRect(0, y2 - 40, VIEW_W, 80);
      ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,220,230,${a})`;
      ctx.fillText('— WARNING —', VIEW_W / 2, y2 - 2); ctx.font = `18px ${FONT}`; ctx.fillText(B.d.name, VIEW_W / 2, y2 + 28); ctx.textAlign = 'left';
    }
  }
}
function bar(ctx, x, y, w, h, k, col) {
  ctx.fillStyle = '#0c0818'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#2a2444'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.min(1, k)) * w, h);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, Math.max(0, Math.min(1, k)) * w, 2);
}

// =====================================================================
//  Game (scenes)
// =====================================================================
const Game = {
  scene: 'loading', world: null, save: Save.load(), t: 0, menu: 0, sub: null, fade: 0, card: null, paused: false, pauseIdx: 0,

  start() { this.scene = 'boot'; },
  startChapter(i) {
    this.world = new World(i, this.save, this);
    this.card = { t: 0 }; this.scene = 'card'; this.fade = 1;
    Audio2.playBgm(CHAPTERS[i].bgm);
  },
  chapterClear(W) {
    const next = W.chIdx + 1;
    this.save.lv = W.player.lv; this.save.exp = W.player.exp;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(next, CHAPTERS.length - 1));
    Save.store(this.save);
    this.transition(() => { if (next < CHAPTERS.length) this.startChapter(next); else { this.scene = 'end'; this.t = 0; Audio2.playBgm('sorrow'); } });
  },
  // 現世の町へ（プロローグのあと／つづきから）。初回はスターター装備を渡す
  enterTown() {
    const s = this.save; s.flags = s.flags || {};
    if (!s.main) { s.main = true; Inv.giveStarter(s); }
    this.world = new World(Town.chapter(s), s, this);
    s.flags.townIntro = true; Save.store(s);
    this.card = { t: 0 }; this.scene = 'card'; this.fade = 1;
    Audio2.playBgm(TOWN.bgm);
  },
  gameOver(W) { this.scene = 'gameover'; this.t = 0; this.menu = 0; },
  transition(fn) { this.fadeOut = { t: 0, fn }; },

  update(dt) {
    this.t += dt;
    Input.pollPad();
    if (Input.hit('mute')) Audio2.toggleMute();
    if (this.fadeOut) {
      this.fadeOut.t += dt;
      if (this.fadeOut.t > 0.6) { const f = this.fadeOut.fn; this.fadeOut = null; this.fade = 1; f(); }
      Input.endFrame(); return;
    }
    this.fade = Math.max(0, this.fade - dt * 1.6);
    const S = this['u_' + this.scene]; if (S) S.call(this, dt);
    document.body.classList.toggle('town', (this.scene === 'play' || this.scene === 'card') && !!(this.world && this.world.ch.town));
    document.body.classList.toggle('dungeon', this.scene === 'play' && !!(this.world && this.world.ch.dungeon));
    this.tapAt = null;
    Input.endFrame();
  },
  draw() {
    // 2倍の解像度で描く（座標は 960x540 のまま）。主人公の高解像度素材が等倍で出る
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0714'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const S = this['d_' + this.scene]; if (S) S.call(this);
    const f = this.fadeOut ? Math.min(1, this.fadeOut.t / 0.6) : this.fade;
    if (f > 0) { ctx.fillStyle = `rgba(6,3,12,${f})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (Audio2.muted) { ctx.font = `12px ${FONT}`; ctx.fillStyle = '#887'; ctx.fillText('MUTE (M)', VIEW_W - 80, VIEW_H - 40); }
  },

  // ---------- boot ----------
  u_boot() { if (Input.confirm() || Input.hit('pause')) this.leaveBoot(); },
  leaveBoot() { if (this.scene !== 'boot') return; Audio2.unlock(); this.scene = 'title'; this.menu = 0; this.fade = 1; Audio2.playBgm('sorrow'); },
  // キャンバス上のタップ位置（ゲーム座標）。各シーンで消費する
  takeTap() { const t = this.tapAt; this.tapAt = null; return t; },
  d_boot() {
    ctx.fillStyle = '#e9dcff'; ctx.font = `22px ${FONT}`; ctx.textAlign = 'center';
    ctx.globalAlpha = 0.5 + Math.sin(this.t * 3) * 0.5;
    ctx.fillText(IS_TOUCH ? 'TAP TO START' : 'PRESS ENTER / TAP', VIEW_W / 2, VIEW_H / 2);
    ctx.globalAlpha = 1; ctx.font = `13px ${FONT}`; ctx.fillStyle = '#887aa8';
    ctx.fillText(IS_TOUCH ? '音が出ます　スマホは横向き推奨' : '音が出ます（M でミュート）', VIEW_W / 2, VIEW_H / 2 + 40); ctx.textAlign = 'left';
  },

  // ---------- title ----------
  titleItems() {
    const it = this.save.main ? [{ k: 'continue', t: 'つづきから' }, { k: 'new', t: 'はじめから' }] : [{ k: 'new', t: 'はじめから' }];
    if (this.save.unlocked > 0) it.push({ k: 'select', t: 'ステージセレクト' });
    it.push({ k: 'options', t: 'オプション' });
    it.push({ k: 'help', t: 'あそびかた' });
    return it;
  },
  u_title(dt) {
    const tap = this.takeTap();
    if (this.sub === 'options') { if (this.updateOptions(tap)) this.sub = null; return; }
    if (this.sub === 'confirmNew') {   // 本編のデータを消して最初からやり直す確認
      if (tap) { const i = tap.y > 280 && tap.y < 320 ? 0 : tap.y >= 320 && tap.y < 360 ? 1 : -1; if (i >= 0) { this.confirmIdx = i; Input.tap(); } }
      if (Input.hit('up') || Input.hit('down') || Input.hit('left') || Input.hit('right')) { this.confirmIdx ^= 1; Audio2.sfx('blip'); }
      if (Input.hit('pause') || Input.hit('kick')) { this.sub = null; return; }
      if (Input.confirm()) {
        Audio2.sfx('select'); this.sub = null;
        if (this.confirmIdx === 0) { this.save = Save.fresh(); Save.store(this.save); this.transition(() => this.startChapter(0)); }
      }
      return;
    }
    if (this.sub === 'help') { if (tap || Input.confirm() || Input.hit('pause') || Input.hit('kick')) { this.sub = null; Audio2.sfx('select'); } return; }
    if (this.sub === 'select') {
      const n = this.save.unlocked + 1;
      if (Input.hit('up') || Input.hit('left')) { this.selIdx = (this.selIdx + n - 1) % n; Audio2.sfx('blip'); }
      if (Input.hit('down') || Input.hit('right')) { this.selIdx = (this.selIdx + 1) % n; Audio2.sfx('blip'); }
      if (Input.hit('pause') || Input.hit('kick')) { this.sub = null; return; }
      if (tap) {
        if (tap.x < 180 || tap.x > 780 || tap.y < 60 || tap.y > 480) { this.sub = null; return; }
        const i = Math.floor((tap.y - 122) / 42);
        if (i < 0 || i >= n) return;
        if (i !== this.selIdx) { this.selIdx = i; Audio2.sfx('blip'); return; }
        Audio2.sfx('select'); this.sub = null; this.transition(() => this.startChapter(i)); return;
      }
      if (Input.confirm()) { Audio2.sfx('select'); const i = this.selIdx; this.sub = null; this.transition(() => this.startChapter(i)); }
      return;
    }
    const items = this.titleItems();
    if (tap) {
      const i = items.findIndex((_, k) => tap.y > 320 + k * 40 - 30 && tap.y < 320 + k * 40 + 10 && tap.x > 50 && tap.x < 420);
      if (i < 0) return;
      this.menu = i; Input.tap();
    }
    if (Input.hit('up') || Input.hit('left')) { this.menu = (this.menu + items.length - 1) % items.length; Audio2.sfx('blip'); }
    if (Input.hit('down') || Input.hit('right') || Input.hit('swap')) { this.menu = (this.menu + 1) % items.length; Audio2.sfx('blip'); }
    if (Input.confirm()) {
      Audio2.sfx('select');
      const k = items[this.menu].k;
      if (k === 'continue') this.transition(() => this.enterTown());
      if (k === 'new' && this.save.main) { this.sub = 'confirmNew'; this.confirmIdx = 1; }
      else if (k === 'new') { this.save.lv = 1; this.save.exp = 0; this.transition(() => this.startChapter(0)); }
      if (k === 'select') { this.sub = 'select'; this.selIdx = this.save.unlocked; }
      if (k === 'help') this.sub = 'help';
      if (k === 'options') { this.sub = 'options'; this.optIdx = 0; }
    }
  },
  d_title() {
    const bg = Backgrounds.get('rooftop_calm');
    Backgrounds.draw(ctx, bg, this.t * 12);
    ctx.fillStyle = 'rgba(12,6,24,.35)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 舞う光
    for (let i = 0; i < 30; i++) {
      const x = (i * 97 + this.t * (10 + i % 5 * 4)) % VIEW_W, y = (i * 53 + Math.sin(this.t + i) * 20 - this.t * 15 * (1 + i % 3)) % VIEW_H;
      ctx.fillStyle = `rgba(255,240,210,${0.25 + (i % 4) * 0.1})`; ctx.fillRect(x, (y + VIEW_H) % VIEW_H, 2, 2);
    }
    // キーアート
    const ka = IMG[SPRITE_DATA.keyart];
    // 新しい全身イラスト（背景透過）を右側に大きく
    if (ka && ka.width) {
      const h = 500, w = ka.width * h / ka.height;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ka, 940 - w, 30 + Math.sin(this.t * 1.2) * 4, w, h); ctx.restore();
    }
    // タイトル
    ctx.textAlign = 'left';
    ctx.font = `15px ${FONT}`; ctx.fillStyle = '#d8c8ff'; ctx.fillText('THE LAST AFTERSCHOOL', 60, 120);
    ctx.font = `56px ${FONT}`; ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 8;
    ctx.strokeText('さいごの放課後', 54, 186); ctx.fillStyle = '#fff6ff'; ctx.fillText('さいごの放課後', 54, 186);
    ctx.font = `13px ${FONT}`; ctx.fillStyle = '#b9aee0'; ctx.fillText('（仮題） PROTOTYPE ver.0.1', 60, 212);
    ctx.font = `17px ${FONT}`; ctx.fillStyle = '#f2d8e8';
    ctx.fillText('世界が終わるまでの、ほんの少しの放課後。', 60, 252);
    const items = this.titleItems();
    items.forEach((it, i) => {
      const y = 320 + i * 40, on = i === this.menu && !this.sub;
      ctx.font = `22px ${FONT}`; ctx.fillStyle = on ? '#ffe9a8' : '#cfc3ea';
      ctx.fillText((on ? '▶ ' : '　') + it.t, 70, y);
    });
    ctx.font = `12px ${FONT}`; ctx.fillStyle = '#8c80b0';
    ctx.fillText(IS_TOUCH ? 'タップで選択' : '↑↓ 選択　Z / Enter 決定　M ミュート', 70, VIEW_H - 30);
    if (this.sub === 'help') this.drawHelp();
    if (this.sub === 'select') this.drawSelect();
    if (this.sub === 'options') this.drawOptions();
    if (this.sub === 'confirmNew') {
      ctx.fillStyle = 'rgba(8,4,16,.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel(ctx, 230, 190, 500, 200, 'rgba(16,10,32,.97)', '#ff8a9a');
      ctx.textAlign = 'center'; ctx.font = `18px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText('セーブデータを消して、最初から始めますか？', VIEW_W / 2, 240);
      ctx.font = `13px ${FONT}`; ctx.fillStyle = '#ffb0bc'; ctx.fillText('装備・お金・進行はすべて消えます', VIEW_W / 2, 264);
      ['はい（消して最初から）', 'いいえ'].forEach((t, i) => { ctx.font = `19px ${FONT}`; ctx.fillStyle = i === this.confirmIdx ? '#ffe9a8' : '#bfb3e0'; ctx.fillText((i === this.confirmIdx ? '▶ ' : '') + t, VIEW_W / 2, 306 + i * 40); });
      ctx.textAlign = 'left';
    }
  },
  drawHelp() {
    panel(ctx, 120, 60, 720, 420, 'rgba(16,10,32,.96)', '#b9a2ff');
    ctx.font = `22px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText('あそびかた', 150, 100);
    const rows = [
      ['←  →', '移動（Shift / 2回押しでダッシュ）'],
      ['C / Space', 'ジャンプ'],
      ['Z', '武器で攻撃（連打でコンボ）'],
      ['X', 'キック（攻撃の後半をキャンセルできる）'],
      ['G / F', 'ガード（長押し）。ガード中に ←→ で緊急回避'],
      ['V', '必殺「フルスイング」（MP 25）'],
      ['Q', '武器切替'],
      ['Esc / P', 'ポーズ（会話中はスキップ）'],
      ['M', 'ミュート'],
    ];
    rows.forEach(([k, v], i) => {
      ctx.font = `18px ${FONT}`; ctx.fillStyle = '#d8c8ff'; ctx.fillText(k, 160, 150 + i * 36);
      ctx.fillStyle = '#fff'; ctx.fillText(v, 330, 150 + i * 36);
    });
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#b9aee0';
    ctx.fillText('スマホ：横向きにして画面のボタンで操作。ゲームパッドにも対応。', 160, 455);
  },
  drawSelect() {
    panel(ctx, 180, 60, 600, 420, 'rgba(16,10,32,.96)', '#b9a2ff');
    ctx.font = `22px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText('ステージセレクト', 210, 100);
    CHAPTERS.forEach((c, i) => {
      const ok = i <= this.save.unlocked, on = i === this.selIdx;
      ctx.font = `19px ${FONT}`; ctx.fillStyle = !ok ? '#4d4466' : on ? '#ffe9a8' : '#e0d6ff';
      ctx.fillText(`${on ? '▶' : '　'} ${c.title}　${ok ? c.sub : '？？？'}`, 220, 150 + i * 42);
    });
  },

  // ---------- chapter card ----------
  u_card(dt) {
    this.card.t += dt;
    if (this.card.t > 2.4 || (this.card.t > 0.6 && (Input.confirm() || this.takeTap()))) { this.scene = 'play'; this.world.begin(); }
  },
  d_card() {
    const W = this.world; W.draw(ctx);
    const a = Math.min(1, this.card.t * 2) * Math.min(1, (2.4 - this.card.t) * 2);
    ctx.fillStyle = `rgba(8,4,16,${0.75 * a})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = `20px ${FONT}`; ctx.fillStyle = '#b9a2ff'; ctx.fillText(W.ch.title, VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.font = `40px ${FONT}`; ctx.fillStyle = '#fff6ff'; ctx.fillText(W.ch.sub, VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.fillStyle = '#b9a2ff'; ctx.fillRect(VIEW_W / 2 - 160 * a, VIEW_H / 2 + 46, 320 * a, 2);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  },

  // ---------- play ----------
  u_play(dt) {
    const W = this.world;
    if (UI.isOpen) { if (Input.hit('pause')) UI.close(); return; }   // 町のメニューを開いている間は止める
    // 町：近くに施設がある時だけ「しらべる」ボタンを出す
    const ib = document.querySelector('[data-btn="down"]'); if (ib) ib.hidden = !(W.ch.town && W.nearFac && !W.dialogue);
    const tap = this.takeTap();
    if (tap && W.dialogue && !this.paused) Input.tap();
    if (this.paused && this.pauseOpt) { if (this.updateOptions(tap)) this.pauseOpt = false; return; }
    if (this.paused) {
      if (tap) { const i = Math.floor((tap.y - 240) / 40); if (i >= 0 && i < 3) { this.pauseIdx = i; Input.tap(); } }
      if (Input.hit('up') || Input.hit('left')) { this.pauseIdx = (this.pauseIdx + 2) % 3; Audio2.sfx('blip'); }
      if (Input.hit('down') || Input.hit('right')) { this.pauseIdx = (this.pauseIdx + 1) % 3; Audio2.sfx('blip'); }
      if (Input.hit('pause')) this.paused = false;
      else if (Input.confirm()) {
        if (this.pauseIdx === 0) this.paused = false;
        else if (this.pauseIdx === 1) { this.pauseOpt = true; this.optIdx = 0; Audio2.sfx('select'); }
        else { this.paused = false; this.transition(() => { this.scene = 'title'; this.menu = 0; Audio2.playBgm('sorrow'); }); }
      }
      return;
    }
    if (Input.hit('pause') && !W.dialogue && W.state === 'play') { this.paused = true; this.pauseIdx = 0; Input.endFrame(); return; }
    if (W.ch.dungeon && Input.hit('item') && !W.dialogue && W.state === 'play') { this.openItemMenu(); return; }   // 戦闘中のアイテム
    // 武器を持っていない時はガードボタンを出さない
    const gb = document.querySelector('[data-btn="guard"]'); if (gb) gb.hidden = W.player.weapons.length === 0;
    W.update(Math.min(dt, 1 / 30));
  },
  d_play() {
    const W = this.world; W.draw(ctx);
    if (W.ch.storyOnly) this.drawStoryOverlay(W);
    if (W.ch.town) Town.drawHud(ctx, W, this.save);
    else if (!W.ch.storyOnly) drawHud(ctx, W);
    if (W.dialogue) W.dialogue.draw(ctx, W.player);
    if (this.paused) {
      ctx.fillStyle = 'rgba(8,4,16,.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.textAlign = 'center'; ctx.font = `32px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText('PAUSE', VIEW_W / 2, 210);
      ['つづける', 'オプション', 'タイトルへ'].forEach((t, i) => { ctx.font = `20px ${FONT}`; ctx.fillStyle = i === this.pauseIdx ? '#ffe9a8' : '#bfb3e0'; ctx.fillText((i === this.pauseIdx ? '▶ ' : '') + t, VIEW_W / 2, 270 + i * 40); });
      ctx.textAlign = 'left';
      if (this.pauseOpt) this.drawOptions();
    }
  },
  // ---------- options（タイトルとポーズの両方から開く） ----------
  // 行: 0=BGM, 1=効果音, 2=もどる。←→で音量（10段階）、タップは ◀ ▶ かバーの位置
  OPT: { x: 240, y: 130, w: 480, h: 280, rows: [210, 280, 360], barX: 420, barW: 200 },
  updateOptions(tap) {
    const O = this.OPT;
    const get = i => (i === 0 ? Audio2.bgmVol : Audio2.sfxVol);
    const set = (i, v) => { if (i === 0) Audio2.setBgm(v); else { Audio2.setSfx(v); Audio2.sfx('hit'); } };
    if (Input.hit('up')) { this.optIdx = (this.optIdx + 2) % 3; Audio2.sfx('blip'); }
    if (Input.hit('down')) { this.optIdx = (this.optIdx + 1) % 3; Audio2.sfx('blip'); }
    if (this.optIdx < 2) {
      if (Input.hit('left')) set(this.optIdx, get(this.optIdx) - 0.1);
      if (Input.hit('right')) set(this.optIdx, get(this.optIdx) + 0.1);
    }
    if (tap) {
      if (tap.x < O.x || tap.x > O.x + O.w || tap.y < O.y || tap.y > O.y + O.h) { Audio2.sfx('select'); return true; }
      const i = O.rows.findIndex(y => Math.abs(tap.y - y) < 28);
      if (i === 2) { Audio2.sfx('select'); return true; }
      if (i >= 0) {
        this.optIdx = i;
        if (tap.x < O.barX - 4) set(i, get(i) - 0.1);
        else if (tap.x > O.barX + O.barW + 4) set(i, get(i) + 0.1);
        else set(i, Math.ceil((tap.x - O.barX) / O.barW * 10) / 10);
      }
    }
    if (Input.hit('pause') || Input.hit('kick') || (Input.confirm() && this.optIdx === 2)) { Audio2.sfx('select'); return true; }
    return false;
  },
  drawOptions() {
    const O = this.OPT;
    ctx.fillStyle = 'rgba(8,4,16,.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(ctx, O.x, O.y, O.w, O.h, 'rgba(16,10,32,.97)', '#b9a2ff');
    ctx.font = `22px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center';
    ctx.fillText('オプション', O.x + O.w / 2, O.y + 40);
    [['BGM', Audio2.bgmVol], ['効果音', Audio2.sfxVol]].forEach(([label, v], i) => {
      const y = O.rows[i], on = this.optIdx === i;
      ctx.textAlign = 'left'; ctx.font = `19px ${FONT}`; ctx.fillStyle = on ? '#ffe9a8' : '#e0d6ff';
      ctx.fillText((on ? '▶ ' : '　') + label, O.x + 30, y + 7);
      ctx.fillStyle = on ? '#ffe9a8' : '#9d90c8'; ctx.textAlign = 'center';
      ctx.fillText('◀', O.barX - 22, y + 7); ctx.fillText('▶', O.barX + O.barW + 22, y + 7);
      for (let k = 0; k < 10; k++) {
        const filled = k < Math.round(v * 10);
        ctx.fillStyle = filled ? (on ? '#ffe27a' : '#b9a2ff') : '#2a2444';
        ctx.fillRect(O.barX + k * (O.barW / 10) + 2, y - 10, O.barW / 10 - 4, 20);
      }
      ctx.font = `14px ${FONT}`; ctx.fillStyle = '#cfc3ea'; ctx.textAlign = 'left';
      ctx.fillText(String(Math.round(v * 10)), O.barX + O.barW + 44, y + 6);
    });
    const on = this.optIdx === 2;
    ctx.font = `19px ${FONT}`; ctx.fillStyle = on ? '#ffe9a8' : '#e0d6ff'; ctx.textAlign = 'center';
    ctx.fillText((on ? '▶ ' : '') + 'もどる', O.x + O.w / 2, O.rows[2] + 7);
    ctx.font = `12px ${FONT}`; ctx.fillStyle = '#8c80b0';
    ctx.fillText(IS_TOUCH ? '◀ ▶ かバーをタップで調整' : '↑↓ 選択　←→ 音量', O.x + O.w / 2, O.y + O.h - 14);
    ctx.textAlign = 'left';
  },
  drawStoryOverlay(W) {
    // 三つの世界の図（STAGE 5）
    const k = Math.min(1, W.time + (W.dialogue ? W.dialogue.i / 3 : 0));
    if (!W.dialogue || W.dialogue.i < 2 || W.dialogue.i > 8) return;
    const cx = VIEW_W / 2, cy = 190, a = Math.min(1, (W.dialogue.i - 1) / 1.5);
    ctx.save(); ctx.globalAlpha = a;
    const worlds = [['神界', '#fff1c8', 0, -80], ['現世', '#9fd0ff', -150, 40], ['魔界', '#c69bff', 150, 40]];
    const joined = W.dialogue.i === 3;
    worlds.forEach(([n, c, dx, dy]) => {
      const x = cx + (joined ? dx * 0.25 : dx), y = cy + (joined ? dy * 0.25 : dy);
      ctx.fillStyle = c; ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(x, y, 58, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 58, 0, 7); ctx.stroke();
      ctx.font = `18px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(n, x, y + 6);
    });
    ctx.restore(); ctx.textAlign = 'left';
  },

  // ---------- game over ----------
  u_gameover() {
    const tap = this.takeTap();
    if (this.t < 1) return;
    if (tap) { const i = tap.y > 350 && tap.y < 400 ? 0 : tap.y >= 400 && tap.y < 440 ? 1 : -1; if (i >= 0) { this.menu = i; Input.tap(); } }
    if (Input.hit('up') || Input.hit('down') || Input.hit('left') || Input.hit('right')) { this.menu ^= 1; Audio2.sfx('blip'); }
    if (Input.confirm()) { const i = this.world.chIdx; if (this.menu === 0 && i >= 0) this.transition(() => this.startChapter(i)); else if (this.menu === 0) { const ch = this.world.ch; this.transition(() => { this.world = new World(ch, this.save, this); this.card = { t: 0 }; this.scene = 'card'; }); } else this.transition(() => { this.scene = 'title'; Audio2.playBgm('sorrow'); }); }
  },
  d_gameover() {
    this.world.draw(ctx);
    ctx.fillStyle = `rgba(10,4,16,${Math.min(0.8, this.t)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center'; ctx.font = `36px ${FONT}`; ctx.fillStyle = '#e8c8d8'; ctx.fillText('……ここで、終わり？', VIEW_W / 2, 200);
    ctx.drawImage(IMG[SPRITE_DATA.portraits.sad], VIEW_W / 2 - 48, 230, 96, 96);
    ['もう一度', 'タイトルへ'].forEach((t, i) => { ctx.font = `20px ${FONT}`; ctx.fillStyle = i === this.menu ? '#ffe9a8' : '#bfb3e0'; ctx.fillText((i === this.menu ? '▶ ' : '') + t, VIEW_W / 2, 380 + i * 40); });
    ctx.textAlign = 'left';
  },

  // ---------- end card ----------
  u_end() { if (this.t > 3 && (Input.confirm() || this.takeTap())) this.transition(() => this.enterTown()); },  // プロローグのあとは町へ
  d_end() {
    const bg = Backgrounds.get('rooftop_calm'); Backgrounds.draw(ctx, bg, 0);
    ctx.fillStyle = `rgba(8,4,16,${Math.min(0.82, this.t * 0.3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    const lines = [
      [1, 18, '#b9a2ff', 'PROTOTYPE ver.0.1 — ここまで遊んでくれて、ありがとう。'],
      [2, 30, '#fff6ff', 'つづく —— STAGE 6「現世と魔界を巡る旅」'],
      [3.5, 16, '#d8c8ff', '魔界にも、ふつうに暮らすモンスターたちがいる。'],
      [4.5, 16, '#d8c8ff', '魔王は、守りたいもののために、人の命を奪っている。'],
      [5.5, 16, '#d8c8ff', 'そして神々は——'],
    ];
    lines.forEach(([t0, s, c, txt], i) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.t - t0));
      ctx.font = `${s}px ${FONT}`; ctx.fillStyle = c; ctx.fillText(txt, VIEW_W / 2, 150 + i * 56);
    });
    ctx.globalAlpha = this.t > 7 ? 0.5 + Math.sin(this.t * 3) * 0.5 : 0;
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText('Z / Enter でタイトルへ', VIEW_W / 2, VIEW_H - 40);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  },

  // ---------- loading ----------
  d_loading() {
    ctx.fillStyle = '#b9a2ff'; ctx.font = `18px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('Now Loading…', VIEW_W / 2, VIEW_H / 2); ctx.textAlign = 'left';
  },
};

// =====================================================================
//  boot
// =====================================================================
function loadAll() {
  const paths = new Set();
  Object.values(SPRITE_DATA.heroine).forEach(a => paths.add(a.img));
  // 使うモンスターだけ読み込む（シートから切り出した残りは今後のステージ用）
  const used = new Set(['wyrmling']); Object.values(ENEMIES).forEach(e => used.add(e.spr));
  used.forEach(k => paths.add(SPRITE_DATA.monsters[k].img));
  Object.values(SPRITE_DATA.portraits).forEach(p => paths.add(p));
  Object.values(SPRITE_DATA.swing).forEach(a => paths.add(a.img));
  paths.add(SPRITE_DATA.keyart);
  Object.values(WEAPON_ART).forEach(w => paths.add(w.file));
  return Promise.all([...paths].map(p => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = (window.ASSET_MAP && window.ASSET_MAP[p]) || p; IMG[p] = i; })));
}

function fit() {
  const wrap = document.getElementById('wrap'), cs = getComputedStyle(wrap);
  const w = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const s = Math.max(0.1, Math.min(w / VIEW_W, h / VIEW_H));
  canvas.style.width = Math.floor(VIEW_W * s) + 'px'; canvas.style.height = Math.floor(VIEW_H * s) + 'px';
}
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200)); fit();
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Audio2.unlock();
  if (Game.scene === 'boot') { Game.leaveBoot(); return; }
  const r = canvas.getBoundingClientRect();
  Game.tapAt = { x: (e.clientX - r.left) / r.width * VIEW_W, y: (e.clientY - r.top) / r.height * VIEW_H };
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
Input.bindTouch();
if (IS_TOUCH) document.body.classList.add('touch');

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  Game.update(dt); Game.draw();
  requestAnimationFrame(loop);
}
Promise.all([loadAll(), document.fonts ? document.fonts.load(`20px DotGothic16`).catch(() => {}) : null]).then(() => Game.start());
requestAnimationFrame(loop);

// デバッグ用：コンソールから Game.debugJump(3) などでステージへ
Game.debugJump = i => Game.startChapter(i);
