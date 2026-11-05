// =====================================================================
//  アイテムのデータ（数値の調整はこのファイルで行う）
//  ・元データ（種類ごと）と、個体データ（拾った1個ごと：レアリティ・付与効果）を分ける
//  ・武器の type は振りモーション（WEAPONS のキー）。今は bat / chair / desk の3系統
//  ※ 名前・数値はすべて仮。草原のプレイテストで調整する
// =====================================================================

const RARITIES = [
  { id: 'common',   name: 'コモン',     color: '#e8e4f0', affixes: 0, mul: 1.00, weight: 60 },
  { id: 'uncommon', name: 'アンコモン', color: '#7fe08a', affixes: 1, mul: 1.08, weight: 28 },
  { id: 'rare',     name: 'レア',       color: '#6ab4ff', affixes: 2, mul: 1.18, weight: 10 },
  { id: 'epic',     name: 'エピック',   color: '#c77dff', affixes: 3, mul: 1.30, weight: 2 },
  { id: 'legend',   name: 'レジェンド', color: '#ffd36a', affixes: 3, mul: 1.45, weight: 0 },
];
const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r, i) => [r.id, Object.assign({ tier: i }, r)]));

// 武器の攻撃力は「基準値」に対する倍率で、今の攻撃の当たり（WEAPONS の dmg）に掛かる。
// 基準値＝プロローグの武器の強さ（バット14・椅子20・机30）
const WEAPON_TYPE_REF = { bat: 14, chair: 20, desk: 30 };

const ITEM_BASES = {
  // ---- 武器：バット系（小・速い） ----
  w_bat_wood:   { kind: 'weapon', type: 'bat',   name: '木製バット',     atk: 14, price: 60,  minFloor: 1 },
  w_bat_pipe:   { kind: 'weapon', type: 'bat',   name: '錆びた鉄パイプ', atk: 16, price: 90,  minFloor: 2 },
  w_bat_metal:  { kind: 'weapon', type: 'bat',   name: '金属バット',     atk: 19, price: 150, minFloor: 4 },
  w_bat_mop:    { kind: 'weapon', type: 'bat',   name: 'デッキブラシ',   atk: 17, price: 120, minFloor: 3, crit: 5 },
  // ---- 武器：椅子系（中） ----
  w_chair_class:{ kind: 'weapon', type: 'chair', name: '教室の椅子',     atk: 20, price: 80,  minFloor: 1 },
  w_chair_pipe: { kind: 'weapon', type: 'chair', name: 'パイプ椅子',     atk: 23, price: 130, minFloor: 3 },
  w_chair_stool:{ kind: 'weapon', type: 'chair', name: '音楽室の丸椅子', atk: 26, price: 190, minFloor: 6 },
  // ---- 武器：机系（大・重い） ----
  w_desk_class: { kind: 'weapon', type: 'desk',  name: '教室の机',       atk: 30, price: 100, minFloor: 1 },
  w_desk_teach: { kind: 'weapon', type: 'desk',  name: '教卓',           atk: 36, price: 200, minFloor: 5 },
  w_desk_lab:   { kind: 'weapon', type: 'desk',  name: '理科室の実験台', atk: 42, price: 300, minFloor: 8 },
  // ---- 防具（見た目は変わらない） ----
  a_uniform:    { kind: 'armor', name: '制服',             def: 0,  hp: 0,  price: 0,   minFloor: 99 },
  a_jersey:     { kind: 'armor', name: '学校ジャージ',     def: 6,  hp: 10, price: 120, minFloor: 1 },
  a_cardigan:   { kind: 'armor', name: 'カーディガン',     def: 10, hp: 0,  price: 160, minFloor: 2 },
  a_coat:       { kind: 'armor', name: '冬のコート',       def: 16, hp: 20, price: 260, minFloor: 5 },
  // ---- アクセサリー ----
  c_hairpin:    { kind: 'accessory', name: 'ヘアピン',     crit: 4,  price: 90,  minFloor: 1 },
  c_ribbon:     { kind: 'accessory', name: 'リボン',       hp: 15,   price: 90,  minFloor: 1 },
  c_watch:      { kind: 'accessory', name: '腕時計',       spd: 6,   price: 140, minFloor: 3 },
  c_charm:      { kind: 'accessory', name: 'お守り',       def: 6,   price: 140, minFloor: 3 },
};

// 消耗品（同じ物は個数で重ねる）。use は戦闘中の効果（ダンジョンの段階で使う）
const CONSUMABLES = {
  milk:   { name: 'いちごミルク', desc: 'HPを40回復',                       price: 30,  max: 9 },
  bento:  { name: 'お弁当',       desc: 'HPを全回復',                       price: 120, max: 3 },
  water:  { name: '水',           desc: '水分を回復（砂漠で必要）',         price: 20,  max: 9 },
  cooler: { name: '冷却材',       desc: '火山の残り時間を30秒のばす',       price: 60,  max: 5 },
  bell:   { name: '帰還の鈴',     desc: 'ダンジョンからいつでも町へ帰る',   price: 80,  max: 3 },
  power:  { name: '力のキャンディ', desc: 'その潜入の間、攻撃力 +20%（重ねがけ不可）', price: 90, max: 3 },
};

// 付与効果。v はレアリティの段階が上がるほど上振れしやすい
const AFFIXES = [
  { id: 'atk',   name: '攻撃力',     unit: '%', roll: [5, 15],  slots: ['weapon', 'accessory'] },
  { id: 'aspd',  name: '攻撃速度',   unit: '%', roll: [5, 12],  slots: ['weapon', 'accessory'] },
  { id: 'crit',  name: '会心率',     unit: '%', roll: [3, 8],   slots: ['weapon', 'accessory'] },
  { id: 'hp',    name: '最大HP',     unit: '',  roll: [8, 25],  slots: ['armor', 'accessory'] },
  { id: 'def',   name: '防御',       unit: '',  roll: [3, 10],  slots: ['armor', 'accessory'] },
  { id: 'move',  name: '移動速度',   unit: '%', roll: [4, 10],  slots: ['weapon', 'armor', 'accessory'] },
  { id: 'steal', name: 'HP吸収',     unit: '%', roll: [2, 5],   slots: ['weapon'] },
  { id: 'spcost',name: '必殺MP軽減', unit: '',  roll: [2, 6],   slots: ['weapon', 'accessory'] },
  { id: 'el_sand', name: '砂属性',   unit: '',  roll: [1, 1],   slots: ['weapon'], element: 'sand' },
  { id: 'el_fire', name: '炎属性',   unit: '',  roll: [1, 1],   slots: ['weapon'], element: 'fire' },
];
const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map(a => [a.id, a]));

// 本編開始時に渡すもの（プロローグで使った3つの武器＋制服）
const STARTER_KIT = {
  gold: 100,
  items: { milk: 3, bell: 1 },
  bag: [
    { base: 'w_bat_wood', rarity: 'common', affixes: [{ k: 'el_sand', v: 1 }] },  // 校庭の砂を纏ったバット
    { base: 'w_chair_class', rarity: 'common', affixes: [] },
    { base: 'w_desk_class', rarity: 'common', affixes: [] },
    { base: 'a_uniform', rarity: 'common', affixes: [] },
  ],
};
