// =====================================================================
//  ダンジョン進行（Game に足すメソッド）
//  ・出発 → 各階 → 出口 → 次の階 … 5階・10階の出口で帰還できる
//  ・帰還の鈴：いつでも町へ（ゴールドは失わない）
//  ・倒れた：その潜入で拾ったゴールドの1/3を失って町へ（装備・アイテムは失わない）
// =====================================================================
const DungeonFlow = {
  dg() { const id = this.run.id; return (this.save.dungeons[id] = this.save.dungeons[id] || { best: 0, checkpoint: 1, cleared: false }); },

  departDungeon(id, startFloor) {
    if (!DUNGEONS[id]) { UI.toast('このダンジョンはまだ実装されていません'); return; }
    if (!this.save.equip.weapons.some(u => u != null)) { UI.toast('武器を1つ以上装備してください（自宅）'); return; }
    UI.close();
    this.run = { id, floor: startFloor, startFloor, gained: 0, seedBase: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, hp: null, mp: 10, water: 100, heat: 0 };   // 水分は潜入のはじめに満タン
    this.transition(() => this.startFloor());
  },
  startFloor() {
    const ch = DungeonGen.build(this.run); ch.dungeonId = this.run.id;
    if (DUNGEONS[this.run.id].timeLimit) this.run.timeLeft = DUNGEONS[this.run.id].timeLimit;   // 火山：階ごとに制限時間
    this.world = new World(ch, this.save, this);
    const d = this.dg(); d.best = Math.max(d.best || 0, this.run.floor); Save.store(this.save);
    this.card = { t: 0 }; this.scene = 'card'; this.fade = 1;
    Audio2.playBgm(ch.bgm);
  },
  addRunGold(v) { this.save.gold += v; if (this.run) this.run.gained += v; },
  keepHero(W) { const P = W.player; this.run.hp = P.hp; this.run.mp = P.mp; this.save.lv = P.lv; this.save.exp = P.exp; },

  floorCleared(W) {
    this.keepHero(W);
    const f = this.run.floor, d = this.dg(), name = DUNGEONS[this.run.id].name;
    if (f === 10 && this.run.id === 'castle') {   // 最終ダンジョン：魔王を倒した（エンディングは今後のストーリーで作る：仮）
      d.cleared = true; Save.store(this.save);
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

  // 戦闘中のアイテム（いちごミルク・お弁当・帰還の鈴）
  openItemMenu() {
    const W = this.world, P = W.player, s = this.save, h = UI.h;
    const use = (id, fn) => () => { if (!Inv.useItem(s, id)) return; fn(); Save.store(s); Audio2.sfx('heal'); UI.render(); };
    UI.open({ title: 'アイテム', tabs: [{ label: '', render: el => {
      const rows = [
        ['milk', `HP +40（今 ${Math.ceil(P.hp)} / ${P.maxHp}）`, use('milk', () => { P.hp = Math.min(P.maxHp, P.hp + 40); W.floatText(P.x, P.y - 130, 'HP +40', '#8fe0a0', 16); })],
        ['bento', 'HPを全回復', use('bento', () => { P.hp = P.maxHp; W.floatText(P.x, P.y - 130, 'HP 全回復', '#8fe0a0', 16); })],
        ['water', this.world.ch.env === 'heat' ? `水分を満タンに（今 ${Math.round(this.run.water)}%）` : '砂漠で水分を回復する', () => { if (!Inv.useItem(s, 'water')) return; this.run.water = 100; this.run.heat = 0; Save.store(s); Audio2.sfx('heal'); W.floatText(P.x, P.y - 130, '水分 100%', '#9fe0ff', 16); UI.render(); }],
        ['cooler', this.world.ch.env === 'lava' ? `残り時間を30秒のばす（今 ${Math.ceil(this.run.timeLeft)}秒）` : '火山の残り時間をのばす', () => { if (!Inv.useItem(s, 'cooler')) return; if (this.run.timeLeft != null) this.run.timeLeft += 30; Save.store(s); Audio2.sfx('heal'); W.floatText(P.x, P.y - 130, '+30秒', '#9fe0ff', 16); UI.render(); }],
        ['power', this.run.power ? '使用中（攻撃力 +20%）' : 'この潜入の間、攻撃力 +20%', () => { if (this.run.power || !Inv.useItem(s, 'power')) return; this.run.power = true; P.stats.atkPct += 20; Save.store(s); Audio2.sfx('lvup'); W.floatText(P.x, P.y - 130, '攻撃力 +20%', '#ffb35a', 16); UI.render(); }],
        ['bell', '町へ帰る（ゴールドは失わない）', () => { if (!Inv.useItem(s, 'bell')) return; this.keepHero(W); UI.close(); this.returnToTown([L('sys', '帰還の鈴が鳴り、町へ戻った。')]); }],
      ];
      for (const [id, desc, fn] of rows) {
        const n = Inv.count(s, id);
        el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, `${CONSUMABLES[id].name} ×${n}`), h('div', { class: 'sub' }, desc)]),
          h('button', { class: 'ui-btn', disabled: !n, onclick: fn }, '使う')]));
      }
      el.append(h('div', { class: 'ui-note' }, 'アイテムはコンビニで買えます。'));
    } }] });
  },
};
Object.assign(Game, DungeonFlow);

// 倒れた時：ダンジョンなら町へ戻す（プロローグは今まで通りのゲームオーバー画面）
{
  const baseGameOver = Game.gameOver;
  Game.gameOver = function (W) { return W.ch.dungeon && this.run ? this.dungeonFailed(W) : baseGameOver.call(this, W); };
}
