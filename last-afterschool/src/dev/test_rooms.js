// =====================================================================
//  開発用のテスト部屋（本編には出てこない）
//  ブラウザのコンソールで  Game.debugRoom('terrain')  と入力すると入れる
// =====================================================================
const TEST_ROOMS = {
  // 地形エンジンの確認：段差（solid）・すり抜け床（oneway）・穴・高台（2段ジャンプで届く高さ）・壁
  terrain: {
    id: 'test_terrain', title: 'TEST', sub: '地形テスト', bg: 'schoolyard', bgm: 'battle', length: 2600,
    loadout: { weapons: ['bat', 'chair', 'desk'], fire: false, partner: true, canFight: true },
    terrainTheme: { top: '#8fb27a', side: '#5d6e4f', dark: '#3e4a35', edge: '#c8e0a8' },
    terrain: [
      { x: 0, y: 468, w: 700, h: 120 },                 // 床
      { x: 560, y: 360, w: 160, type: 'oneway' },       // すり抜け床
      { x: 690, y: 380, w: 140, type: 'oneway' },       // 穴の上の足場
      { x: 830, y: 468, w: 620, h: 120 },               // 床（700〜830 は穴）
      { x: 1000, y: 408, w: 120, h: 60 },               // 段差（高さ60）
      { x: 1200, y: 268, w: 160, type: 'oneway' },      // 高台（高さ200：2段ジャンプで届く）
      { x: 1450, y: 468, w: 1150, h: 120 },             // 床
      { x: 1700, y: 368, w: 60, h: 100 },               // 壁（高さ100：ジャンプで越える）
      { x: 2000, y: 330, w: 200, type: 'oneway' },
    ],
    intro: [L('sys', '地形テスト：段差・すり抜け床（↓＋ジャンプで降りる）・穴・高台・壁')],
    events: [
      { x: 1500, type: 'wave', waves: [[['slime', 1], ['slime_p', 1], ['bat', -1]]] },
    ],
    endX: 99999, outro: [],
  },
};

Game.debugRoom = name => {
  const ch = TEST_ROOMS[name];
  if (!ch) return console.warn('テスト部屋がありません:', Object.keys(TEST_ROOMS));
  Game.world = new World(ch, Game.save, Game);
  Game.card = { t: 0 }; Game.scene = 'card'; Game.fade = 1;
  Audio2.playBgm(ch.bgm);
};
