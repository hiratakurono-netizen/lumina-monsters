// =====================================================================
//  ドロップ・宝箱（数値はすべて仮。草原のプレイテストで調整する）
// =====================================================================
const LOOT = {
  ENEMY_ITEM_CHANCE: 0.07,     // 通常の敵が装備を落とす確率
  CHEST_ITEM_CHANCE: 0.5,      // 通常の宝箱に装備が入っている確率（隠し宝箱は必ず）
  // ボスの確定ドロップ：{ 個数, 最低レアリティ段階, レジェンドの確率 }
  BOSS: { 5: { n: 2, minTier: 1, legend: 0 }, 10: { n: 2, minTier: 2, legend: 0.15 } },

  // 階ごとのレアリティの重み（コモン → レジェンド）。深い階ほど上が出やすい
  // floor は「深さ」（草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40）
  weights(floor) {
    return [
      Math.max(8, 60 - floor * 4),
      28 + Math.min(floor, 20),
      floor >= 2 ? 4 + Math.min(floor, 25) * 1.6 : 1.5,
      floor >= 5 ? Math.min(30, (floor - 4) * 1.2) : 0.2,
      floor >= 25 ? (floor - 24) * 0.4 : 0,
    ];
  },
  rollRarity(rng, floor, minTier = 0) {
    const w = this.weights(floor).map((x, i) => (i < minTier ? 0 : x));
    if (w.every(x => !x)) w[minTier] = 1;
    return RARITIES[rng.weighted(w.map((_, i) => i), i => w[i])].id;
  },
  // その階で出てよい装備の種類（minFloor が浅い物から解禁）
  pickBase(rng, floor) {
    // 浅い所の弱い装備ばかり出ないよう、深さの10階手前より浅い物は出にくくする
    const ids = Object.keys(ITEM_BASES).filter(id => ITEM_BASES[id].minFloor <= floor + 1 && ITEM_BASES[id].minFloor > floor - 14);
    if (!ids.length) return rng.pick(Object.keys(ITEM_BASES).filter(id => ITEM_BASES[id].minFloor <= floor + 1));
    return rng.pick(ids);
  },
  roll(save, rng, floor, opts = {}) {
    const rarity = opts.legend && rng.chance(opts.legend) ? 'legend' : this.rollRarity(rng, floor, opts.minTier || 0);
    const it = Inv.make(save, this.pickBase(rng, floor), rarity, rng);
    it.isNew = true;
    return it;
  },
};
