// =====================================================================
//  バランスの数式（数値の調整はこのファイルだけで行う）
//  考え方：
//  ・「深さ」d（草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40・魔王城41〜50）で敵の強さが決まる
//  ・ダンジョン（段＝tier）が1つ進むごとに、敵の強さも装備の威力も TP 倍になる
//  ・敵には「防御」があり、攻撃から一定量を差し引く（下限は元の25%）。
//    → 威力の低い古い装備ほど大きく削られ、新しい装備に替えた時に差がはっきり出る
//  ・レベルの成長は控えめにし、強さの伸びは主に装備で得る
//  検証：node tools/balance_sim.js（docs/BALANCE.md に表を書き出す）
// =====================================================================
const BAL = {
  TP: 1.8,                     // 段ごとの強さの倍率（敵・装備とも）
  DEF: 0.5,                    // 敵の防御＝「その深さで想定する一撃」の何割を差し引くか
  REF_HIT: 15,                 // 想定する一撃の基準（攻撃モーションの当たりの平均くらい）
  MIN_DMG: 0.25,               // 防御で削られても、元の何割は必ず通る（0にはならない）
  LV_ATK: 0.015,               // レベル1つあたりの攻撃の伸び（本編）
  LV_HP: 6,                    // レベル1つあたりの最大HPの伸び
  RARITY_MUL: [1, 1.1, 1.22, 1.36, 1.5],

  // 段：草原0〜魔王城4。エンドレス・ボスラッシュでは 5 以上（魔王城より強い）になる
  tier(d) { return Math.floor((Math.max(1, d) - 1) / 10); },
  // 深さ50を越えた所で出る装備の強さの倍率（「＋」付き装備）。段が1つ上がるごとに TP 倍
  deepMul(d) { return d > 50 ? Math.pow(this.TP, (d - 50) / 10) : 1; },
  floorOf(d) { return d - this.tier(d) * 10; },
  // ダンジョン内の伸び：1階 0.78 → 10階 1.37。1〜2階は前の装備でも戦え、3階からは更新が必要になる
  ramp(f) { return 0.78 + 0.065 * (f - 1); },
  E(d) { return Math.pow(this.TP, this.tier(d)) * this.ramp(this.floorOf(d)); },
  // その深さで想定するレベル（成長分を敵にも上乗せして、レベル上げだけで押し切れないようにする）
  expLv(d) { return 1 + 0.75 * (d - 1); },
  lvComp(d) { return 1 + this.LV_ATK * (this.expLv(d) - 1); },
  // 敵の強さ。tier の補正値は docs/BALANCE.md の試算で決めたもの
  enemy(d, boss = false) {
    const t = this.tier(d), f = this.floorOf(d), E = this.E(d), lc = this.lvComp(d);
    return {
      tier: t, floor: f,
      hpMul: E * lc * (boss ? 0.95 : 1),
      def: this.DEF * this.REF_HIT * E * lc,
      dmgMul: 1.12 * Math.pow(1.75, t) * (0.85 + 0.0375 * (f - 1)),
      agg: 1 + 0.12 * t + 0.015 * (f - 1),            // 攻撃の間隔・予備動作が短くなる
      speed: 1 + 0.06 * t,
    };
  },
  // 敵の素の数値はダンジョンごとに違う（城の敵は素のHPが高い）ので、草原の平均に合わせてから倍率を掛ける
  //   → ダンジョン内の「硬い敵・柔らかい敵」の差は残しつつ、全体の強さは上の式だけで決まる
  REF_FOE: { hp: 32, dmg: 7.5 },
  REF_BOSS: { 5: { hp: 520, dmg: 12 }, 10: { hp: 1200, dmg: 13 } },
  BOSS_DEF: 0.5,               // ボスの防御は通常の半分（長期戦で古い装備が完全に通らなくならないように）
  foeNorm(D) {
    const ids = [...new Set(D.foes(10).map(f => f[0]))];
    const avg = k => ids.reduce((a, id) => a + ENEMIES[id][k], 0) / ids.length;
    return { hp: this.REF_FOE.hp / avg('hp'), dmg: this.REF_FOE.dmg / avg('dmg') };
  },
  // 1体分の倍率（generator が spawn に入れる）
  spawnScale(d, type, norm, elite) {
    const s = this.enemy(d), base = ENEMIES[type], E = elite ? this.ELITE : null;
    return {
      hpMul: s.hpMul * norm.hp * (E ? E.hp : 1), def: s.def * (E ? E.def : 1), dmgK: norm.dmg * (E ? E.dmg : 1),
      agg: s.agg + (E ? E.agg : 0), speed: s.speed, elite: !!elite,
    };
  },
  bossScale(d, floor, type) {
    const s = this.enemy(d, true), R = this.REF_BOSS[floor] || this.REF_BOSS[5], base = ENEMIES[type];
    return { hpMul: s.hpMul * R.hp / base.hp, def: s.def * this.BOSS_DEF, dmgK: R.dmg / base.dmg, agg: s.agg, speed: 1 };
  },
  // 防御の差し引き
  applyDef(raw, def) { return Math.max(raw * this.MIN_DMG, raw - (def || 0)); },
  // 強化個体（エリート）
  ELITE: { hp: 2.6, dmg: 1.25, def: 1.2, agg: 0.25, gold: 4 },
  eliteChance(f) { return f <= 1 ? 0 : 0.04 + 0.012 * f; },
  // 装備の威力：段 t の武器は REF × TP^t × v（v は同じ段の中での差 1.0〜1.3）
  weaponAtk(ref, t, v) { return Math.round(ref * Math.pow(this.TP, t) * v); },
};
