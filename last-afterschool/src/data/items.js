// =====================================================================
//  アイテムのデータ（数値の調整はこのファイルで行う）
//  ・元データ（種類ごと）と、個体データ（拾った1個ごと：レアリティ・付与効果）を分ける
//  ・武器の type は振りモーション（WEAPONS のキー）。今は bat / chair / desk の3系統
//  ※ 名前・数値はすべて仮。草原のプレイテストで調整する
// =====================================================================

// 素材シート（tools/extract_env.py で切り出し）の画像
const ENV = {
  bg_grass: 'assets/env/bg_grass.png', ground_grass: 'assets/env/ground_grass.png', ground_road: 'assets/env/ground_road.png',
  bush: 'assets/env/bush.png', bush2: 'assets/env/bush2.png', flowers: 'assets/env/flowers.png',
  store: 'assets/env/store.png', school: 'assets/env/school.png', bench: 'assets/env/bench.png', lamp: 'assets/env/lamp.png', vending: 'assets/env/vending.png', pole: 'assets/env/pole.png',
};
// 砂漠・雪原・火山の素材（tools/extract_biomes.py で切り出し）。ENV['desert_cactus'] などで引ける
const BIOME_PROPS = {
  desert: ['sky', 'layer0', 'layer1', 'ground', 'oneway', 'obelisk', 'house', 'cactus', 'cactus2', 'cactus3', 'palm', 'palms', 'skull', 'skull2', 'block', 'bricks', 'i_dagger', 'i_sword', 'i_axe'],
  snow: ['sky', 'layer0', 'layer1', 'layer2', 'ground', 'oneway', 'tower', 'igloo', 'tree', 'tree2', 'tree3', 'skeleton', 'ice', 'skull', 'i_dagger', 'i_sword', 'i_axe'],
  volcano: ['sky', 'layer0', 'layer1', 'layer2', 'ground', 'oneway', 'tower', 'furnace', 'deadtree', 'deadtree2', 'deadtree3', 'lavapit', 'skeleton', 'i_dagger', 'i_sword', 'i_axe'],
  castle_out: ['sky', 'layer0', 'layer1', 'layer2', 'ground', 'oneway', 'keep', 'throne', 'deadtree', 'deadtree2', 'abyss', 'skeleton', 'rubble', 'orb', 'i_dagger', 'i_sword', 'i_axe'],
  castle_in: ['sky', 'layer0', 'layer1', 'ground', 'oneway', 'candle', 'candle2', 'smallthrone', 'bonethrone', 'keep', 'throne', 'deadtree', 'deadtree2', 'deadtree3', 'furnace', 'chest', 'skeleton', 'rubble', 'i_dagger', 'i_sword', 'i_axe'],
};
for (const [b, list] of Object.entries(BIOME_PROPS)) for (const n of list) ENV[`${b}_${n}`] = `assets/env/${b}_${n}.png`;
// 専用のアイコン画像がある装備
const ITEM_ICON = { w_chair_pipe: 'assets/env/i_chair_pipe.png', w_bat_mop: 'assets/env/i_bat_mop.png', w_bat_metal: 'assets/env/i_bat_metal.png',
  w_stone_dagger: ENV.desert_i_dagger, w_stone_sword: ENV.desert_i_sword, w_stone_axe: ENV.desert_i_axe,
  w_ice_dagger: ENV.snow_i_dagger, w_frost_sword: ENV.snow_i_sword, w_ice_axe: ENV.snow_i_axe,
  w_obsidian_dagger: ENV.volcano_i_dagger, w_magma_blade: ENV.volcano_i_sword, w_volcano_axe: ENV.volcano_i_axe,
  w_fang_dagger: ENV.castle_out_i_dagger, w_demon_sword: ENV.castle_out_i_sword, w_shatter_axe: ENV.castle_in_i_axe,
  w_dark_dagger: ENV.castle_in_i_dagger, w_king_sword: ENV.castle_in_i_sword };

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
const WEAPON_TYPE_REF = { bat: 14, chair: 20, desk: 30, dagger: 22, sword: 30, axe: 44 };

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
  // ---- 魔界の武器：短剣（4連）・剣（3連）・斧（2連）。振りは手ぶらのモーションに武器のアイコンを重ねる ----
  // minFloor は「深さ」（草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40）。element は最初から付いている属性
  w_stone_dagger:   { kind: 'weapon', type: 'dagger',   name: '石の短剣',       atk: 22, price: 260, minFloor: 11 },
  w_stone_sword:    { kind: 'weapon', type: 'sword', name: '石の剣',         atk: 30, price: 320, minFloor: 13 },
  w_stone_axe:      { kind: 'weapon', type: 'axe',  name: '石の斧',         atk: 44, price: 400, minFloor: 15, element: 'sand' },
  w_ice_dagger:     { kind: 'weapon', type: 'dagger',   name: '氷鉄の短剣',     atk: 30, price: 520, minFloor: 21 },
  w_frost_sword:    { kind: 'weapon', type: 'sword', name: '霜の魔剣',       atk: 42, price: 640, minFloor: 23, element: 'ice' },
  w_ice_axe:        { kind: 'weapon', type: 'axe',  name: '氷晶の戦斧',     atk: 60, price: 780, minFloor: 25, element: 'ice' },
  w_obsidian_dagger:{ kind: 'weapon', type: 'dagger',   name: '黒曜石の短剣',   atk: 40, price: 900, minFloor: 31 },
  w_magma_blade:    { kind: 'weapon', type: 'sword', name: 'マグマブレード', atk: 56, price: 1100, minFloor: 33, element: 'fire' },
  w_volcano_axe:    { kind: 'weapon', type: 'axe',  name: '火山の斧',       atk: 80, price: 1300, minFloor: 35, element: 'fire' },
  // 魔王城（深さ41〜50）
  w_fang_dagger:    { kind: 'weapon', type: 'dagger',   name: '魔王の牙の短剣', atk: 52, price: 1600, minFloor: 41 },
  w_demon_sword:    { kind: 'weapon', type: 'sword', name: '魔王の魔剣',     atk: 72, price: 1900, minFloor: 43 },
  w_shatter_axe:    { kind: 'weapon', type: 'axe',  name: '魔王の破砕斧',   atk: 100, price: 2300, minFloor: 45 },
  w_dark_dagger:    { kind: 'weapon', type: 'dagger',   name: '魔王の暗黒短剣', atk: 60, price: 2400, minFloor: 46 },
  w_king_sword:     { kind: 'weapon', type: 'sword', name: '魔王の魔王剣',   atk: 84, price: 2800, minFloor: 48 },
  // ---- 防具（見た目は変わらない） ----
  a_uniform:    { kind: 'armor', name: '制服',             def: 0,  hp: 0,  price: 0,   minFloor: 99 },
  a_jersey:     { kind: 'armor', name: '学校ジャージ',     def: 6,  hp: 10, price: 120, minFloor: 1 },
  a_cardigan:   { kind: 'armor', name: 'カーディガン',     def: 10, hp: 0,  price: 160, minFloor: 2 },
  a_coat:       { kind: 'armor', name: '冬のコート',       def: 16, hp: 20, price: 260, minFloor: 5 },
  a_cloak:      { kind: 'armor', name: '砂よけの外套',     def: 24, hp: 30, price: 480, minFloor: 12 },
  a_down:       { kind: 'armor', name: 'ダウンジャケット', def: 34, hp: 50, price: 760, minFloor: 22 },
  a_fireproof:  { kind: 'armor', name: '耐火の防護服',     def: 46, hp: 70, price: 1100, minFloor: 32 },
  a_darkmail:   { kind: 'armor', name: '黒鉄の胸当て',     def: 60, hp: 90, price: 1700, minFloor: 42 },
  // ---- アクセサリー ----
  c_hairpin:    { kind: 'accessory', name: 'ヘアピン',     crit: 4,  price: 90,  minFloor: 1 },
  c_ribbon:     { kind: 'accessory', name: 'リボン',       hp: 15,   price: 90,  minFloor: 1 },
  c_watch:      { kind: 'accessory', name: '腕時計',       spd: 6,   price: 140, minFloor: 3 },
  c_charm:      { kind: 'accessory', name: 'お守り',       def: 6,   price: 140, minFloor: 3 },
  c_sun:        { kind: 'accessory', name: '太陽のペンダント', hp: 40, def: 6, price: 420, minFloor: 12 },
  c_snowflake:  { kind: 'accessory', name: '雪の結晶のブローチ', crit: 9, price: 640, minFloor: 22 },
  c_ember:      { kind: 'accessory', name: '熾火の指輪',     spd: 10, def: 10, price: 900, minFloor: 32 },
  c_orb:        { kind: 'accessory', name: '魔石のペンダント', hp: 60, crit: 8, price: 1500, minFloor: 44 },
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
  { id: 'el_ice',  name: '氷属性',   unit: '',  roll: [1, 1],   slots: ['weapon'], element: 'ice' },
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

// 元データに自分の id を持たせる（アイコンの引き当て用）
for (const [id, b] of Object.entries(ITEM_BASES)) b.id = id;
