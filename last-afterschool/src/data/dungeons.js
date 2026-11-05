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
    name: '草原', bg: 'grassland', bgm: 'battle', bossBgm: 'boss', jumpMul: 1,
    terrainTheme: { top: '#7fb069', side: '#5b4a5e', dark: '#463a4c', edge: '#b9e08f', oneway: '#8a6e5a', onewayTop: '#c9a77e' },
    // 階ごとの敵の出現表（重み）。深い階ほど種類が増える
    foes(floor) {
      const t = [['slime', 5], ['sprout', 4], ['bat', 3]];
      if (floor >= 3) t.push(['shroom', 3], ['slime_p', 3]);
      if (floor >= 6) t.push(['wolf', 4]);
      if (floor >= 8) t.push(['bat', 2], ['wolf', 2]);
      return t;
    },
    // 部屋パーツ
    chunks: {
      start: { w: 520, solids: [G0(0, 520)], foes: [], chests: [] },
      exit:  { w: 640, solids: [G0(0, 640)], foes: [], chests: [], exitX: 420 },
      flat:  { w: 720, weight: 3, solids: [G0(0, 720)], foes: [{ x: 260 }, { x: 520 }, { x: 400, y: 300, fly: true }], chests: [], objs: [{ x: 120, kind: 'bush', p: 0.6 }, { x: 640, kind: 'bush', p: 0.5 }, { x: 380, kind: 'campfire', p: 0.18 }] },
      step:  { w: 820, weight: 3, solids: [G0(0, 820), BL(300, 408, 160, 60), OW(520, 340, 160)], foes: [{ x: 150 }, { x: 680 }, { x: 600, y: 340 }], chests: [{ x: 600, y: 340 }] },
      pit:   { w: 760, weight: 2, solids: [G0(0, 260), OW(300, 380, 120), G0(460, 300)], foes: [{ x: 620 }, { x: 360, y: 260, fly: true }], chests: [] },
      gap:   { w: 620, weight: 2, solids: [G0(0, 230), G0(350, 270)], foes: [{ x: 480 }], chests: [] },
      hill:  { w: 920, weight: 2, solids: [G0(0, 920), BL(250, 388, 400, 80), OW(380, 288, 140)], foes: [{ x: 120 }, { x: 800 }, { x: 450, y: 388 }], chests: [{ x: 450, y: 288 }], objs: [{ x: 300, y: 388, kind: 'bush', p: 0.6 }, { x: 860, kind: 'campfire', p: 0.25 }] },
      ledges:{ w: 840, weight: 2, solids: [G0(0, 840), OW(150, 360, 140), OW(380, 280, 140), OW(610, 360, 140)], foes: [{ x: 300 }, { x: 720 }, { x: 450, y: 200, fly: true }], chests: [{ x: 450, y: 280 }] },
      // 寄り道：高い所の宝箱（足場から2段ジャンプで届く）。中身は良いもの
      hidden:{ w: 900, weight: 1, solids: [G0(0, 900), OW(480, 340, 130), OW(680, 220, 130)], foes: [{ x: 200 }, { x: 820 }], chests: [{ x: 745, y: 220, hidden: true }] },
      // 戦闘部屋：入るとカメラが止まり、敵が湧く
      // キノコのばね：高い足場の宝箱へ（キノコで跳ばないと届かない寄り道）
      spring:{ w: 760, weight: 2, solids: [G0(0, 760), OW(420, 170, 150)], foes: [{ x: 160 }, { x: 640 }], chests: [{ x: 495, y: 170, hidden: true, viaSpring: true }], objs: [{ x: 330, kind: 'mushroom', p: 1 }, { x: 80, kind: 'bush', p: 0.6 }] },
      arena: { w: 980, weight: 2, solids: [G0(0, 980), OW(160, 360, 160), OW(660, 360, 160)], foes: [], chests: [], wave: true },
      // ボス部屋（5階・10階）
      boss:  { w: 1300, solids: [G0(0, 1300), OW(180, 340, 180), OW(940, 340, 180)], foes: [], chests: [], boss: true, objs: [{ x: 120, kind: 'campfire', p: 1, bossOnly: 10 }] },
    },
    // 5階：中ボス、10階：ボス（専用の行動は第6段階で作る。今は既存の行動の流用：仮）
    bosses: { 5: 'wolf_boss', 10: 'golem_moss' },
  },
};

// 本編の敵（プロローグの ENEMIES に追加する）。数値は1階基準で、深い階では generator が強くする
Object.assign(ENEMIES, {
  sprout:    { spr: 'sprout', scale: 0.9, hp: 26, dmg: 6, speed: 80, ai: 'hop', w: 50, h: 56, exp: 5 },
  wolf:      { spr: 'wolf', scale: 0.85, hp: 44, dmg: 10, speed: 150, ai: 'lunge', w: 70, h: 70, exp: 10 },
  wolf_boss: { spr: 'wolf_l', scale: 1.05, hp: 520, dmg: 12, speed: 170, ai: 'wolfBoss', w: 140, h: 140, exp: 80, boss: true, name: '草原の主 オオカミ（仮）' },
  // 苔の鎧（moss）：ダメージ半減。炎の攻撃か BREAK ではがれる。ボス部屋の左端にたき火がある
  golem_moss:{ spr: 'golem', scale: 1.15, hp: 1200, dmg: 13, speed: 70, ai: 'golemMoss', moss: true, w: 170, h: 185, exp: 200, boss: true, name: '苔むした巨像（仮）' },
});
