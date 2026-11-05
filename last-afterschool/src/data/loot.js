// =====================================================================
//  ドロップ・宝箱（数値はすべて仮。草原のプレイテストで調整する）
// =====================================================================
const LOOT = {
  ENEMY_ITEM_CHANCE: 0.06,     // 通常の敵が装備を落とす確率（強化個体は必ず）
  CHEST_ITEM_CHANCE: 0.5,      // 通常の宝箱に装備が入っている確率（隠し宝箱は必ず）
  // ボスの確定ドロップ：{ 個数, 最低レアリティ段階, レジェンドの確率 }
  // 5階：今のダンジョンの武器（アンコモン以上）＋1個。10階：そのボス専用の武器（レア以上）＋レア以上1個
  BOSS: { 5: { n: 2, minTier: 1, legend: 0, weapon: true }, 10: { n: 1, minTier: 2, legend: 0.15, bossItem: true } },

  // 階ごとのレアリティの重み（コモン → レジェンド）。深い階ほど上が出やすい
  // floor は「深さ」（草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40）
  weights(d) {
    // ダンジョンが変わるたびに「良い装備探し」がやり直しになるよう、レアリティはダンジョン内の階（1〜10）で決める
    const f = BAL.floorOf(d), t = BAL.tier(d);
    return [
      Math.max(12, 60 - f * 4),
      28 + f,
      f >= 2 ? 4 + f * 1.6 : 1.5,
      f >= 5 ? (f - 4) * 1.2 + t * 0.4 : 0.2 + t * 0.2,
      f >= 8 ? 0.3 + t * 0.15 : 0,
    ];
  },

  rollRarity(rng, floor, minTier = 0) {
    const w = this.weights(floor).map((x, i) => (i < minTier ? 0 : x));
    if (w.every(x => !x)) w[minTier] = 1;
    return RARITIES[rng.weighted(w.map((_, i) => i), i => w[i])].id;
  },
  // その階で出てよい装備の種類（minFloor が浅い物から解禁）
  // 装備の段：武器は tier、防具・アクセは出始める深さから
  tierOf(b) { return b.tier !== undefined ? b.tier : BAL.tier(Math.min(50, b.minFloor)); },
  // その深さで出る装備：8割は今のダンジョンの段、2割は1つ前の段。ボス専用（minFloor 99）は出ない
  pickBase(rng, floor, opts = {}) {
    const t = BAL.tier(floor), useT = t > 0 && !opts.current && rng.chance(0.2) ? t - 1 : t;
    let ids = Object.keys(ITEM_BASES).filter(id => { const b = ITEM_BASES[id]; return b.minFloor <= floor + 1 && this.tierOf(b) === useT && (!opts.kind || b.kind === opts.kind); });
    if (!ids.length) ids = Object.keys(ITEM_BASES).filter(id => ITEM_BASES[id].minFloor <= Math.max(floor + 1, t * 10 + 2) && this.tierOf(ITEM_BASES[id]) === t && (!opts.kind || ITEM_BASES[id].kind === opts.kind));
    return rng.pick(ids);
  },
  roll(save, rng, floor, opts = {}) {
    const rarity = opts.legend && rng.chance(opts.legend) ? 'legend' : this.rollRarity(rng, floor, opts.minTier || 0);
    const it = Inv.make(save, opts.base || this.pickBase(rng, floor, opts), rarity, rng);
    it.isNew = true;
    return it;
  },
};

// ボスのドロップ一式（確定）。dungeonId はボス専用武器を引くため
LOOT.bossDrops = function (save, rng, depth, floor, dungeonId) {
  const B = this.BOSS[floor] || { n: 1, minTier: 1 }, out = [];
  if (B.weapon) out.push(this.roll(save, rng, depth, { minTier: 1, kind: 'weapon', current: true }));
  if (B.bossItem) {
    const id = Object.keys(ITEM_BASES).find(k => ITEM_BASES[k].boss === dungeonId);
    if (id) out.push(this.roll(save, rng, depth, { base: id, minTier: 2, legend: 0.25 }));
  }
  for (let i = 0; i < B.n; i++) out.push(this.roll(save, rng, depth, B));
  return out;
};
