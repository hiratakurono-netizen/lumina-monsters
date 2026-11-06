// =====================================================================
//  ダンジョン進行（Game に足すメソッド）
//  ・出発 → 各階 → 出口 → 次の階 … 5階・10階の出口で帰還できる
//  ・帰還の鈴：いつでも町へ（ゴールドは失わない）
//  ・倒れた：その潜入で拾ったゴールドの1/3を失って町へ（装備・アイテムは失わない）
// =====================================================================
const L_ = (who, text, face) => L(who, text, face);   // ボスラッシュでは L を難易度に使うため
const DungeonFlow = {
  dg() { const id = this.run.id; return (this.save.dungeons[id] = this.save.dungeons[id] || { best: 0, checkpoint: 1, cleared: false }); },

  departDungeon(id, startFloor, opts = {}) {
    if (!DUNGEONS[id] && id !== 'endless' && id !== 'bossrush') { UI.toast('このダンジョンはまだ実装されていません'); return; }
    if (!this.save.equip.weapons.some(u => u != null)) { UI.toast('武器を1つ以上装備してください（自宅）'); return; }
    UI.close();
    this.run = { id, floor: startFloor, startFloor, diff: opts.diff || 0, gained: 0, seedBase: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, hp: null, mp: 10, water: 100, heat: 0 };   // 水分は潜入のはじめに満タン
    this.transition(() => this.startFloor());
  },
  startFloor() {
    const ch = DungeonGen.build(this.run); ch.dungeonId = ch.dungeonId || this.run.id;
    if (typeof StoryFlow !== 'undefined') StoryFlow.attach(this, ch);   // 到着・10階ボス戦前後の会話
    if (ch.timeLimit) this.run.timeLeft = ch.timeLimit;   // 火山：階ごとに制限時間
    this.world = new World(ch, this.save, this);
    const d = this.dg(); d.best = Math.max(d.best || 0, this.run.floor); Save.store(this.save);
    this.card = { t: 0 }; this.scene = 'card'; this.fade = 1;
    Audio2.playBgm(ch.bgm);
  },
  addRunGold(v) { this.save.gold += v; if (this.run) this.run.gained += v; },
  keepHero(W) { const P = W.player; this.run.hp = P.hp; this.run.mp = P.mp; this.save.lv = P.lv; this.save.exp = P.exp; },

  floorCleared(W) {
    this.keepHero(W);
    if (this.run.id === 'endless') return this.endlessCleared(W);
    if (this.run.id === 'bossrush') return this.bossrushCleared(W);
    const f = this.run.floor, d = this.dg(), name = DUNGEONS[this.run.id].name;
    if (f === 10 && this.run.id === 'castle') {   // 最終ダンジョン：魔王を倒した。初めての時はエンディングへ
      const first = !d.cleared; d.cleared = true; Save.store(this.save);
      if (first && typeof StoryFlow !== 'undefined') return StoryFlow.startEnding(this);
      return this.returnToTown([
        L('narr', '魔王の体が、ゆっくりと闇にほどけていく。'),
        L('partner', '……終わった、の？'),
        L('hero', 'わからない。でも……空のひび、少しだけ小さくなった気がする。', 'sad'),
        L('sys', '魔王城を踏破した！（エンディングは今後追加予定）'),
      ]);
    }
    if (f === 10) {
      d.cleared = true; Save.store(this.save);
      return this.returnToTown([L('sys', `${name}を踏破した！`), L('partner', 'やったね、{hero}！ ……でも、まだ先がある。')]);
    }
    if (f === 5) {
      d.checkpoint = Math.max(d.checkpoint || 1, 6); this.run.hp = W.player.maxHp;   // 中ボス撃破で全回復（仮）
      Save.store(this.save);
      const h = UI.h;
      UI.open({ title: `${name} 5階の出口`, onClose: () => { if (this.run && this.run.floor === 5) this.nextFloor(); }, tabs: [{ label: '', render: el => {
        el.append(h('div', { class: 'ui-note' }, '中ボスを倒した！ HPが全回復した。次からは6階から始められます。'));
        el.append(h('button', { class: 'ui-btn', onclick: () => { this.run.floor = 0; UI.close(); this.returnToTown([L('sys', '町へ帰還した。')]); } }, '町へ帰還する'));
        el.append(h('button', { class: 'ui-btn ghost', onclick: () => UI.close() }, '6階へ進む'));
      } }] });
      return;
    }
    this.nextFloor();
  },
  // エンドレス：5階ごとに「帰る／進む」を選べる。ボス（5階ごと）を倒すとHP全回復
  endlessCleared(W) {
    const n = this.run.floor, d = this.dg();
    d.best = Math.max(d.best || 0, n); Save.store(this.save);
    if (n % 5 !== 0) return this.nextFloor();
    this.run.hp = W.player.maxHp;
    const h = UI.h;
    UI.open({ title: `エンドレス ${n}階`, onClose: () => { if (this.run && this.run.floor === n) this.nextFloor(); }, tabs: [{ label: '', render: el => {
      el.append(h('div', { class: 'ui-note' }, `${n}階を突破！ HPが全回復した。最高記録 ${d.best}階。ここから先はさらに敵が強くなる（深さ ${ENDLESS.depth(n + 1)}）。`));
      el.append(h('button', { class: 'ui-btn', onclick: () => { this.run.floor = 0; UI.close(); this.returnToTown([L('sys', `エンドレス ${n}階で町へ帰還した。`)]); } }, '町へ帰還する'));
      el.append(h('button', { class: 'ui-btn ghost', onclick: () => UI.close() }, `${n + 1}階へ進む`));
    } }] });
  },
  // ボスラッシュ：5連戦。勝つたびにHPが少し回復、5勝でクリア報酬
  bossrushCleared(W) {
    const L = BOSSRUSH.LEVELS[this.run.diff], n = this.run.floor;
    if (n < 5) { this.run.hp = Math.min(W.player.maxHp, W.player.hp + W.player.maxHp * L.heal); return this.nextFloor(); }
    const s = this.save; s.bossrush = s.bossrush || {}; const first = !s.bossrush[L.id]; s.bossrush[L.id] = (s.bossrush[L.id] || 0) + 1;
    const rng = makeRng((Math.random() * 4294967296) >>> 0), got = [];
    for (let i = 0; i < L.reward + (first ? 1 : 0); i++) { const it = LOOT.roll(s, rng, L.depth + 8, { minTier: i === 0 ? 3 : 2 }); if (Inv.add(s, it)) got.push(Inv.name(it)); }
    const gold = Math.round(200 * Math.pow(1.6, this.run.diff) * (first ? 2 : 1)); s.gold += gold;
    Save.store(s);
    this.returnToTown([L_('sys', `ボスラッシュ「${L.name}」制覇！${first ? '（初回ボーナス）' : ''}`), L_('sys', `報酬：${gold} G${got.length ? '・' + got.join('・') : '（持ち物がいっぱい）'}`)]);
  },
  nextFloor() { this.run.floor++; Save.store(this.save); this.transition(() => this.startFloor()); },

  returnToTown(lines) {
    this.run = null; this.save.hp = null; Town.restock(this.save); Save.store(this.save);   // 帰るたびにショップの品ぞろえが変わる
    this.transition(() => { this.enterTown(); if (lines && lines.length) this.world.ch.intro = lines; });
  },
  dungeonFailed(W) {
    this.keepHero(W);
    const lost = Math.floor(this.run.gained / 3);
    this.save.gold = Math.max(0, this.save.gold - lost);
    this.returnToTown([L('narr', '目の前が暗くなって——気がつくと、町に戻っていた。'), L('sys', lost > 0 ? `拾ったゴールドの1/3（${lost} G）を失った。` : '失ったものはなかった。')]);
  },

  // 戦闘中の「道具」：自宅の持ち物画面と同じ画面（装備の変更はできない。道具を使う・捨てるはできる）
  openItemMenu() { Town.openHome(this, { field: true }); },
  // 道具を使う。使えたら true
  fieldUse(id) {
    const W = this.world, P = W.player, s = this.save, run = this.run;
    const fx = (t, c) => { Save.store(s); Audio2.sfx('heal'); W.floatText(P.x, P.y - 130, t, c, 16); return true; };
    if (id === 'water' && W.ch.env !== 'heat') { UI.toast('砂漠で使う道具です'); return false; }
    if (id === 'cooler' && run.timeLeft == null) { UI.toast('火山で使う道具です'); return false; }
    if (id === 'power' && run.power) { UI.toast('もう使っています'); return false; }
    if (!Inv.useItem(s, id)) return false;
    if (id === 'milk') { P.hp = Math.min(P.maxHp, P.hp + 40); return fx('HP +40', '#8fe0a0'); }
    if (id === 'bento') { P.hp = P.maxHp; return fx('HP 全回復', '#8fe0a0'); }
    if (id === 'water') { run.water = 100; run.heat = 0; return fx('水分 100%', '#9fe0ff'); }
    if (id === 'cooler') { run.timeLeft += 30; return fx('+30秒', '#9fe0ff'); }
    if (id === 'power') { run.power = true; P.stats.atkPct += 20; Audio2.sfx('lvup'); return fx('攻撃力 +20%', '#ffb35a'); }
    if (id === 'bell') { this.keepHero(W); Save.store(s); UI.close(); this.returnToTown([L('sys', '帰還の鈴が鳴り、町へ戻った。')]); return true; }
    return false;
  },
};
Object.assign(Game, DungeonFlow);

// 倒れた時：ダンジョンなら町へ戻す（プロローグは今まで通りのゲームオーバー画面）
{
  const baseGameOver = Game.gameOver;
  Game.gameOver = function (W) { return W.ch.dungeon && this.run ? this.dungeonFailed(W) : baseGameOver.call(this, W); };
}
