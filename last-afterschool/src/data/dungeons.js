// =====================================================================
//  魔界ダンジョンの定義（数値はすべて仮。草原のプレイテストで調整する）
//  ・chunks：部屋パーツ。x は部屋の左端からの位置、y は画面の高さ（地面＝GROUND_Y=468）
//      solids  … 足場（Terrain の形式。type 'oneway' はすり抜け床）
//      foes    … 敵を置ける場所 { x, y? }（y を省くとその下の地面に置く。fly は空中）
//      chests  … 宝箱を置ける場所 { x, y, hidden? }（hidden は寄り道の先の良い宝箱）
//      wave    … 入るとカメラが止まって敵が湧く戦闘部屋
//  ・生成のルールは src/dungeon/generator.js
// =====================================================================

// 地面を作る小さな関数（部屋パーツを書きやすくするため）
const G0 = (x, w) => ({ x, y: GROUND_Y, w, h: 120 });                       // 地面
const OW = (x, y, w) => ({ x, y, w, type: 'oneway' });                      // すり抜け床
const BL = (x, y, w, h) => ({ x, y, w, h });                                 // ブロック（段差・壁）

const DUNGEONS = {
  grassland: {
    name: '草原', tier: 0, bg: 'grassland', bgm: 'grassland', bossBgm: 'boss', jumpMul: 1,
    decor: [{ img: 'flowers', s: 0.7 }],   // 飾り（触れても何も起きない）
    terrainTheme: { texture: ENV.ground_grass, top: '#7fb069', side: '#5b4a5e', dark: '#463a4c', edge: '#b9e08f', oneway: '#8a6e5a', onewayTop: '#c9a77e' },
    // 階ごとの敵の出現表（重み）。深い階ほど種類が増える
    foes(floor) {
      const t = [['slime', 5], ['sprout', 4], ['bat', 3]];
      if (floor >= 3) t.push(['shroom', 3], ['slime_p', 3]);
      if (floor >= 6) t.push(['wolf', 4]);
      if (floor >= 8) t.push(['bat', 2], ['wolf', 2]);
      if (floor >= 2) t.push(['wisp_shot', 3]);
      if (floor >= 4) t.push(['big_shroom', 3]);
      return t;
    },
    // 部屋パーツ
    chunks: {
      start: { w: 520, solids: [G0(0, 520)], foes: [], chests: [] },
      exit:  { w: 640, solids: [G0(0, 640)], foes: [], chests: [], exitX: 420 },
      // role：部屋の役割（explore 探索 / action 足場アクション / battle 戦闘 / treasure 宝 / secret 隠し / gimmick 環境ギミック）
      // feats：ダンジョンごとに中身が変わる「枠」。slot の意味は generator.js の BIOME_SLOTS
      //   gate 属性で壊す壁（進むのに必須）／source その属性の源（必ず gate より手前）／bridge 渡れない穴を越える仕掛け
      //   hazard 地形の危険物／block 宝箱をふさぐ岩など（任意）／cracked 隠し通路のひび割れた壁
      flat:  { w: 720, weight: 3, role: 'explore', solids: [G0(0, 720)], foes: [{ x: 260 }, { x: 520 }, { x: 400, y: 300, fly: true }], chests: [], objs: [{ x: 120, kind: 'bush', p: 0.6 }, { x: 640, kind: 'bush', p: 0.5 }, { x: 380, kind: 'campfire', p: 0.18 }] },
      step:  { w: 820, weight: 3, role: 'explore', solids: [G0(0, 820), BL(300, 408, 160, 60), OW(520, 340, 160)], foes: [{ x: 150 }, { x: 680 }, { x: 600, y: 340 }], chests: [{ x: 600, y: 340 }] },
      pit:   { w: 760, weight: 2, role: 'action', solids: [G0(0, 260), OW(300, 380, 120), G0(460, 300)], foes: [{ x: 620 }, { x: 360, y: 260, fly: true }], chests: [] },
      gap:   { w: 620, weight: 2, role: 'action', solids: [G0(0, 230), G0(350, 270)], foes: [{ x: 480 }], chests: [] },
      hill:  { w: 920, weight: 2, role: 'explore', solids: [G0(0, 920), BL(250, 388, 400, 80), OW(380, 288, 140)], foes: [{ x: 120 }, { x: 800 }, { x: 450, y: 388 }], chests: [{ x: 450, y: 288 }], objs: [{ x: 300, y: 388, kind: 'bush', p: 0.6 }, { x: 860, kind: 'campfire', p: 0.25 }] },
      ledges:{ w: 840, weight: 2, role: 'action', solids: [G0(0, 840), OW(150, 360, 140), OW(380, 280, 140), OW(610, 360, 140)], foes: [{ x: 300 }, { x: 720 }, { x: 450, y: 200, fly: true }], chests: [{ x: 450, y: 280 }] },
      // 寄り道：高い所の宝箱（足場から2段ジャンプで届く）。中身は良いもの
      hidden:{ w: 900, weight: 1, role: 'treasure', solids: [G0(0, 900), OW(480, 340, 130), OW(680, 220, 130)], foes: [{ x: 200 }, { x: 820 }], chests: [{ x: 745, y: 220, hidden: true }] },
      // キノコのばね：高い足場の宝箱へ（キノコで跳ばないと届かない寄り道）
      spring:{ w: 760, weight: 2, role: 'treasure', solids: [G0(0, 760), OW(420, 170, 150)], foes: [{ x: 160 }, { x: 640 }], chests: [{ x: 495, y: 170, hidden: true, viaSpring: true }], objs: [{ x: 330, kind: 'mushroom', p: 1 }, { x: 80, kind: 'bush', p: 0.6 }] },
      // 戦闘部屋：入るとカメラが止まり、敵が湧く
      arena: { w: 980, weight: 2, role: 'battle', solids: [G0(0, 980), OW(160, 360, 160), OW(660, 360, 160)], foes: [], chests: [], wave: true },
      // ---- 地形の部屋（本編改善） ----
      // 崖：高台に登って、反対側へ飛び降りる。高台の上に宝箱と敵
      cliff: { w: 1000, weight: 2, role: 'action', solids: [G0(0, 330), OW(200, 378, 110), BL(330, 268, 360, 330), G0(690, 310)], foes: [{ x: 150 }, { x: 520, y: 268 }, { x: 860 }], chests: [{ x: 640, y: 268 }] },
      // 上下の分かれ道：下は危険物と敵、上は足場伝いに宝箱
      split: { w: 1100, weight: 2, role: 'explore', solids: [G0(0, 1100), OW(160, 340, 170), OW(400, 250, 220), OW(700, 340, 170)], foes: [{ x: 300 }, { x: 900 }, { x: 510, y: 250 }, { x: 620, y: 180, fly: true }], chests: [{ x: 470, y: 250 }], feats: [{ slot: 'hazard', x: 560 }] },
      // 動く床：ジャンプでは越えられない幅の穴
      movepit: { w: 900, weight: 2, role: 'action', solids: [G0(0, 240), Object.assign(OW(300, 400, 130), { move: { range: 280, period: 4.2 } }), G0(700, 200)], foes: [{ x: 120 }, { x: 800 }, { x: 450, y: 250, fly: true }], chests: [] },
      // 崩れる足場：乗ると少しして落ちる（数秒で戻る）
      crumbles: { w: 1000, weight: 2, role: 'action', solids: [G0(0, 220), Object.assign(OW(300, 410, 110), { crumble: true }), Object.assign(OW(500, 360, 110), { crumble: true }), Object.assign(OW(700, 410, 110), { crumble: true }), G0(880, 120)], foes: [{ x: 120 }, { x: 560, y: 240, fly: true }], chests: [] },
      // 属性の壁：手前の「源」で武器に属性を宿して壁を壊す（源は必ず手前にある）
      gatewall: { w: 960, weight: 2, role: 'gimmick', solids: [G0(0, 960)], foes: [{ x: 360 }, { x: 760 }, { x: 860 }], chests: [], feats: [{ slot: 'source', x: 180 }, { slot: 'gate', x: 540 }] },
      // 渡れない穴：雪原は水を凍らせる、火山は溶岩を冷やす、ほかは動く床・崩れる足場
      liquid: { w: 980, weight: 2, role: 'gimmick', solids: [G0(0, 320), G0(720, 260)], foes: [{ x: 120 }, { x: 860 }, { x: 520, y: 260, fly: true }], chests: [], feats: [{ slot: 'source', x: 170, bridge: true }, { slot: 'bridge', x: 320, w: 400 }] },
      // 危険地帯：地上は危険物、上の足場を渡れば避けられる
      hazardrun: { w: 1100, weight: 2, role: 'gimmick', solids: [G0(0, 1100), OW(350, 330, 170), OW(620, 330, 170)], foes: [{ x: 520 }, { x: 980 }, { x: 500, y: 220, fly: true }], chests: [], feats: [{ slot: 'hazard', x: 280 }, { slot: 'hazard', x: 760 }] },
      // 隠し通路：一番上の足場の先、ひび割れた壁の奥に宝箱
      secret: { w: 1000, weight: 1, role: 'secret', solids: [G0(0, 1000), OW(260, 380, 130), OW(440, 290, 130), OW(620, 200, 170), BL(830, 200, 170, 30)], foes: [{ x: 160 }, { x: 900 }], chests: [{ x: 910, y: 200, hidden: true }], feats: [{ slot: 'cracked', x: 790, y: -300, w: 40, h: 500 }, { slot: 'stone', x: 985, y: -300, w: 15, h: 500 }] },
      // 埋まった宝箱：岩・砂山・氷塊を壊すと宝箱が出てくる
      buried: { w: 820, weight: 2, role: 'treasure', solids: [G0(0, 820)], foes: [{ x: 200 }, { x: 700 }], chests: [{ x: 480, y: GROUND_Y, lockedBy: 'block' }], feats: [{ slot: 'block', x: 480 }] },
      // 見張り：高台に強化個体（エリート）。倒すと良い物を落とす
      guard: { w: 1000, weight: 2, role: 'battle', solids: [G0(0, 1000), OW(240, 400, 120), BL(380, 348, 260, 120)], foes: [{ x: 510, y: 348, elite: true }, { x: 200 }, { x: 820 }], chests: [{ x: 600, y: 348 }] },
      // ボス部屋（5階・10階）
      boss:  { w: 1300, solids: [G0(0, 1300), Object.assign(OW(180, 340, 180), { fragile: true }), Object.assign(OW(940, 340, 180), { fragile: true })], foes: [], chests: [], boss: true, objs: [{ x: 120, kind: 'campfire', p: 1, bossOnly: 10 }] },
    },
    // 5階：中ボス、10階：ボス（専用の行動は第6段階で作る。今は既存の行動の流用：仮）
    bosses: { 5: 'wolf_boss', 10: 'golem_moss' },
    // 起伏のある地形のパターン（generator.js の TERRAIN_STYLES）と、よく出る部屋の重み
    styles: ['rolling', 'meadow'], chunkW: { spring: 3, hidden: 2, split: 3 },
  },
};

// 本編の敵（プロローグの ENEMIES に追加する）。数値は1階基準で、深い階では generator が強くする
Object.assign(ENEMIES, {
  sprout:    { spr: 'sprout', scale: 0.9, hp: 26, dmg: 6, speed: 80, ai: 'hop', w: 50, h: 56, exp: 5 },
  wolf:      { spr: 'wolf', scale: 0.85, hp: 44, dmg: 10, speed: 150, ai: 'lunge', w: 70, h: 70, exp: 10 },
  wolf_boss: { spr: 'wolf_l', scale: 1.05, hp: 520, dmg: 12, speed: 170, ai: 'wolfBoss', w: 140, h: 140, exp: 80, boss: true, name: '草原の主 オオカミ（仮）' },
  // 苔の鎧（moss）：ダメージ半減。炎の攻撃か BREAK ではがれる。ボス部屋の左端にたき火がある
  golem_moss:{ spr: 'golem', scale: 1.15, hp: 1200, dmg: 13, speed: 70, ai: 'golemMoss', moss: { el: 'fire', name: '苔の鎧', filter: 'hue-rotate(70deg) saturate(1.6)' }, vine: 'grass', w: 170, h: 185, exp: 200, boss: true, name: '苔むした巨像（仮）' },
});

// =====================================================================
//  砂漠・雪原・火山（部屋の形は草原と同じパーツを使い、置く物と環境のルールを変える）
//  env: heat（水分ゲージ・熱中症） / cold（ジャンプ力低下・氷と深雪の床） / lava（制限時間・溶岩）
// =====================================================================
// 草原の部屋パーツを写して、置く物の種類を差し替える。map: 草原の種類 → このダンジョンの種類（null で置かない）
function biomeChunks(map, extra = {}) {
  const out = JSON.parse(JSON.stringify(DUNGEONS.grassland.chunks));
  for (const [k, c] of Object.entries(out)) {
    c.objs = (c.objs || []).map(o => (map[o.kind] === undefined ? o : map[o.kind] && Object.assign(o, { kind: map[o.kind] }))).filter(Boolean);
    if (extra[k]) c.objs.push(...extra[k]);
  }
  return out;
}
Object.assign(DUNGEONS, {
  desert: {
    name: '砂漠', tier: 1, bg: 'desert', bgm: 'desert', bossBgm: 'boss', jumpMul: 1, env: 'heat',
    terrainTheme: { texture: ENV.desert_ground, onewayTexture: ENV.desert_oneway },
    decor: [{ img: 'desert_cactus3', s: 0.9 }, { img: 'desert_skull', s: 0.7 }, { img: 'desert_block', s: 0.8 }, { img: 'desert_cactus2', s: 0.9 }],
    foes(f) { const t = [['scorpion', 5], ['skel', 4], ['skullfire', 3]]; if (f >= 4) t.push(['mummy', 3]); if (f >= 7) t.push(['scorpion', 3], ['skullfire', 2]); if (f >= 2) t.push(['sand_eye', 3]); if (f >= 4) t.push(['vulture', 3]); return t; },
    styles: ['dunes', 'mesa'], chunkW: { buried: 3, crumbles: 3, hazardrun: 3, cliff: 1 },
    // 草むら→サボテン（触ると痛い・叩くと砂属性）、たき火→オアシス（水分回復）、キノコ→間欠泉
    chunks: biomeChunks({ bush: 'cactus', campfire: 'oasis', mushroom: 'geyser' }, { boss: [{ x: 120, kind: 'oasis', p: 1, bossOnly: 10 }] }),
    bosses: { 5: 'sand_spider', 10: 'sand_colossus' },
  },
  snow: {
    name: '雪原', tier: 2, bg: 'snow', bgm: 'snow', bossBgm: 'boss', jumpMul: 0.75, env: 'cold',
    terrainTheme: { texture: ENV.snow_ground, onewayTexture: ENV.snow_oneway },
    decor: [{ img: 'snow_tree', s: 0.9 }, { img: 'snow_tree2', s: 0.9 }, { img: 'snow_skull', s: 0.7 }, { img: 'snow_ice', s: 0.8 }],
    foes(f) { const t = [['snow_wolf', 5], ['frost_ghost', 3], ['ice_wisp', 3]]; if (f >= 4) t.push(['ice_knight', 3]); if (f >= 7) t.push(['snow_wolf', 3], ['ice_knight', 2]); if (f >= 2) t.push(['frost_wisp', 3]); if (f >= 4) t.push(['yeti', 3]); return t; },
    styles: ['terraces', 'crevasse'], chunkW: { liquid: 3, cliff: 3, ledges: 1, gap: 1 },
    // 草むら→氷晶（叩くと氷属性）、たき火はそのまま（霜竜の鎧を溶かす）、キノコ→間欠泉
    chunks: biomeChunks({ bush: 'icecrystal', mushroom: 'geyser' }),
    bosses: { 5: 'frost_wolf', 10: 'frost_dragon' },
    surfaces: { ice: 0.3, snow: 0.2 },   // 地面が氷（滑る）・深雪（遅い）になる確率
  },
  volcano: {
    name: '火山', tier: 3, bg: 'volcano', bgm: 'volcano', bossBgm: 'boss', jumpMul: 1, env: 'lava', timeLimit: 180,
    terrainTheme: { texture: ENV.volcano_ground, onewayTexture: ENV.volcano_oneway },
    decor: [{ img: 'volcano_deadtree2', s: 0.8 }, { img: 'volcano_skeleton', s: 0.6 }, { img: 'volcano_deadtree', s: 0.75 }],
    foes(f) { const t = [['fire_imp', 5], ['skullfire', 4], ['magma_slime', 3]]; if (f >= 4) t.push(['ash_reaper', 3]); if (f >= 7) t.push(['fire_imp', 3], ['ash_reaper', 2]); if (f >= 2) t.push(['flame_wyrm', 3]); if (f >= 4) t.push(['magma_golem', 3]); return t; },
    styles: ['crags', 'rift'], chunkW: { liquid: 3, crumbles: 3, hazardrun: 3, movepit: 1 },
    // 草むら→溶岩だまり（踏むと熱い）、たき火→冷気の噴出口（氷属性＋制限時間の延長）、キノコ→間欠泉
    chunks: biomeChunks({ bush: 'lavapit', campfire: 'frostvent', mushroom: 'geyser' }, {
      gap: [{ x: 120, kind: 'lavapit', p: 0.5 }], step: [{ x: 720, kind: 'lavapit', p: 0.5 }],
      boss: [{ x: 120, kind: 'frostvent', p: 1, bossOnly: 10 }],
    }),
    bosses: { 5: 'flame_reaper', 10: 'magma_colossus' },
  },
});

// 魔界の敵（数値は「深さ1」相当の基準。深さに応じて generator が強くする）
Object.assign(ENEMIES, {
  // 砂漠
  scorpion:     { spr: 'spider', scale: 0.75, hp: 40, dmg: 9, speed: 130, ai: 'lunge', w: 70, h: 52, exp: 9 },
  skel:         { spr: 'skeleton', scale: 0.5, hp: 55, dmg: 11, speed: 100, ai: 'lunge', w: 60, h: 66, exp: 11 },
  skullfire:    { spr: 'skullfire', scale: 0.42, hp: 32, dmg: 9, speed: 150, ai: 'fly', w: 50, h: 52, exp: 9, fly: true },
  mummy:        { spr: 'hood', scale: 0.6, hp: 70, dmg: 10, speed: 60, ai: 'spore', w: 60, h: 68, exp: 13 },
  sand_spider:  { spr: 'spider2', scale: 1.0, hp: 520, dmg: 12, speed: 180, ai: 'wolfBoss', w: 150, h: 100, exp: 120, boss: true, name: '砂の女王 オオサソリ（仮）' },
  sand_colossus:{ spr: 'skel_l', scale: 0.95, hp: 1200, dmg: 13, speed: 70, ai: 'golemMoss', vine: 'sand', w: 180, h: 155, exp: 260, boss: true, name: '砂に眠る巨人（仮）' },
  // 雪原
  snow_wolf:    { spr: 'wolf', scale: 0.85, hp: 52, dmg: 10, speed: 160, ai: 'lunge', w: 70, h: 70, exp: 12 },
  frost_ghost:  { spr: 'ghost2', scale: 0.55, hp: 50, dmg: 9, speed: 75, ai: 'ghost', w: 56, h: 60, exp: 12, fly: true, weak: 'fire' },
  ice_wisp:     { spr: 'wisp_l', scale: 0.42, hp: 36, dmg: 9, speed: 140, ai: 'fly', w: 50, h: 60, exp: 10, fly: true },
  ice_knight:   { spr: 'knight', scale: 0.62, hp: 110, dmg: 13, speed: 70, ai: 'lunge', w: 66, h: 80, exp: 18 },
  frost_wolf:   { spr: 'wolf_l', scale: 1.05, hp: 540, dmg: 12, speed: 175, ai: 'wolfBoss', w: 140, h: 140, exp: 160, boss: true, name: '氷牙の狼王（仮）' },
  // 氷の鎧：炎で溶ける
  frost_dragon: { spr: 'dragon', scale: 0.62, hp: 1250, dmg: 14, speed: 70, ai: 'golemMoss', vine: 'ice', moss: { el: 'fire', name: '氷の鎧', filter: 'hue-rotate(160deg) brightness(1.35)' }, w: 200, h: 130, exp: 340, boss: true, name: '霜竜（仮）' },
  // 火山
  fire_imp:     { spr: 'imp', scale: 0.62, hp: 48, dmg: 11, speed: 140, ai: 'lunge', w: 56, h: 52, exp: 13 },
  magma_slime:  { spr: 'golem_s', scale: 0.48, hp: 64, dmg: 10, speed: 70, ai: 'hop', w: 56, h: 56, exp: 12 },   // 溶岩の小岩人形
  ash_reaper:   { spr: 'reaper', scale: 0.55, hp: 80, dmg: 12, speed: 80, ai: 'ghost', w: 70, h: 66, exp: 16, fly: true, weak: 'ice' },
  flame_reaper: { spr: 'reaper2', scale: 0.85, hp: 560, dmg: 13, speed: 175, ai: 'wolfBoss', w: 160, h: 125, exp: 200, boss: true, name: '炎の死神（仮）' },
  // 溶岩の鎧：氷で冷え固まる
  magma_colossus:{ spr: 'golem', scale: 1.2, hp: 1300, dmg: 15, speed: 70, ai: 'golemMoss', vine: 'lava', moss: { el: 'ice', name: '溶岩の鎧', filter: 'hue-rotate(-35deg) saturate(2.2) brightness(1.1)' }, w: 175, h: 190, exp: 420, boss: true, name: '溶岩の巨像（仮）' },
});

// =====================================================================
//  魔王城（最終ダンジョン）：1〜5階は城の外（荒野と城門）、6〜10階は城の中
//  環境の制限はなし。敵の強さ・攻撃・ボス戦が中心。zones で階ごとに見た目と敵を切り替える
// =====================================================================
DUNGEONS.castle = {
  name: '魔王城', tier: 4, bgm: 'castle', bossBgm: 'boss', lastBossBgm: 'maou', jumpMul: 1,
  // 外：草むら→深淵の裂け目（踏むと痛い）、キノコ→間欠泉 ／ 中：たき火→燭台（ふれると炎）
  chunks: biomeChunks({ bush: 'abyss', mushroom: 'geyser' }),
  zones: [
    { upTo: 5, name: '魔王城・外郭', bg: 'castle_out',
      terrainTheme: { texture: ENV.castle_out_ground, onewayTexture: ENV.castle_out_oneway },
      decor: [{ img: 'castle_out_deadtree', s: 0.75 }, { img: 'castle_out_rubble', s: 0.8 }, { img: 'castle_out_skeleton', s: 0.6 }, { img: 'castle_out_orb', s: 0.8 }],
      foes(f) { const t = [['dark_knight', 5], ['eye_bat', 4], ['gargoyle', 3], ['dark_mage', 3]]; if (f >= 3) t.push(['shade', 3], ['gargoyle_d', 3]); return t; },
      styles: ['ramparts', 'rolling'] },
    { upTo: 10, name: '魔王城・城内', bg: 'castle_in',
      terrainTheme: { texture: ENV.castle_in_ground, onewayTexture: ENV.castle_in_oneway },
      decor: [{ img: 'castle_in_candle', s: 0.9 }, { img: 'castle_in_deadtree', s: 0.75 }, { img: 'castle_in_rubble', s: 0.8 }, { img: 'castle_in_candle2', s: 0.9 }],
      objMap: { bush: null, campfire: 'candle' },
      foes(f) { const t = [['royal_guard', 5], ['succubus', 3], ['eye_sentry', 3], ['dark_knight', 2], ['dark_mage', 3], ['iron_golem', 3]]; if (f >= 8) t.push(['royal_guard', 3], ['succubus', 2]); return t; },
      styles: ['stairs', 'halls'] },
  ],
  bosses: { 5: 'gate_keeper', 10: 'demon_king' },
  chunkW: { guard: 3, gatewall: 3, split: 3, movepit: 3 },
};

Object.assign(ENEMIES, {
  // 城の外
  dark_knight: { spr: 'knight2', scale: 0.62, hp: 120, dmg: 13, speed: 85, ai: 'lunge', w: 66, h: 84, exp: 20 },
  eye_bat:     { spr: 'eye_bat', scale: 0.36, hp: 60, dmg: 11, speed: 150, ai: 'fly', w: 60, h: 52, exp: 16, fly: true },
  gargoyle:    { spr: 'bat_big', scale: 0.4, hp: 70, dmg: 12, speed: 170, ai: 'fly', w: 70, h: 44, exp: 17, fly: true },
  shade:       { spr: 'hood', scale: 0.6, hp: 90, dmg: 12, speed: 70, ai: 'spore', w: 60, h: 68, exp: 18 },
  // 城の中
  royal_guard: { spr: 'knight_l', scale: 0.48, hp: 170, dmg: 15, speed: 90, ai: 'lunge', w: 90, h: 70, exp: 26 },
  succubus:    { spr: 'succubus', scale: 0.36, hp: 110, dmg: 13, speed: 85, ai: 'ghost', w: 70, h: 72, exp: 24, fly: true, weak: 'ice' },
  eye_sentry:  { spr: 'eye_mech', scale: 0.48, hp: 120, dmg: 13, speed: 50, ai: 'spore', w: 66, h: 56, exp: 22 },
  // 5階：城門の番人（飛びかかり・突進・子分を呼ぶ）
  gate_keeper: { spr: 'castle', scale: 0.75, hp: 640, dmg: 15, speed: 170, ai: 'wolfBoss', minion: 'dark_knight', w: 150, h: 175, exp: 300, boss: true, name: '動く城門（仮）' },
  // 10階：魔王。魔王の結界（ダメージ半減）は炎か氷、どちらの属性でもはがせる。HP半分で闇の弾を撃ってくる
  demon_king:  { spr: 'eldereye', scale: 0.85, hp: 1500, dmg: 16, speed: 60, ai: 'demonKing', vine: 'abyss', moss: { el: 'any', name: '魔王の結界', filter: 'hue-rotate(250deg) saturate(1.8) brightness(1.2)' }, w: 190, h: 175, exp: 800, boss: true, name: '魔王（仮）' },
});

// =====================================================================
//  追加の攻撃パターンを持つ敵（射撃＝エネルギー弾 / 急降下 / 叩きつけ）
// =====================================================================
Object.assign(ENEMIES, {
  wisp_shot:  { spr: 'wisp', scale: 0.5, hp: 24, dmg: 7, speed: 70, ai: 'shooter', w: 44, h: 58, exp: 7, fly: true, shot: '#8affd0' },
  big_shroom: { spr: 'shroom_l', scale: 0.6, hp: 60, dmg: 9, speed: 45, ai: 'slammer', w: 76, h: 72, exp: 11 },
  sand_eye:   { spr: 'eye_wing', scale: 0.5, hp: 38, dmg: 9, speed: 80, ai: 'shooter', w: 64, h: 34, exp: 11, fly: true, shot: '#ffd36a' },
  vulture:    { spr: 'bat_big', scale: 0.36, hp: 44, dmg: 10, speed: 160, ai: 'diver', w: 70, h: 40, exp: 12, fly: true },
  frost_wisp: { spr: 'wisp', scale: 0.5, hp: 40, dmg: 9, speed: 70, ai: 'shooter', w: 44, h: 58, exp: 12, fly: true, shot: '#9fe0ff' },
  yeti:       { spr: 'beast', scale: 0.62, hp: 110, dmg: 13, speed: 60, ai: 'slammer', w: 96, h: 68, exp: 18 },
  flame_wyrm: { spr: 'wyrmling', scale: 0.42, hp: 60, dmg: 12, speed: 150, ai: 'diver', w: 76, h: 50, exp: 15, fly: true },
  magma_golem:{ spr: 'golem_m', scale: 0.62, hp: 110, dmg: 13, speed: 55, ai: 'slammer', w: 66, h: 68, exp: 17 },
  dark_mage:  { spr: 'hood', scale: 0.6, hp: 90, dmg: 12, speed: 60, ai: 'shooter', w: 60, h: 68, exp: 20, shot: '#c58aff' },
  gargoyle_d: { spr: 'bat_big', scale: 0.42, hp: 80, dmg: 13, speed: 170, ai: 'diver', w: 76, h: 46, exp: 19, fly: true },
  iron_golem: { spr: 'golem_m', scale: 0.78, hp: 180, dmg: 15, speed: 55, ai: 'slammer', w: 84, h: 86, exp: 26 },
});
