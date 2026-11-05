// =====================================================================
//  さいごの放課後 / THE LAST AFTERSCHOOL（仮題）  — config / scenario data
//  名前・数値・セリフはすべてここに集約。調整はこのファイルだけで完結させる方針。
// =====================================================================

const VIEW_W = 960, VIEW_H = 540;
const GROUND_Y = 468;
// 内部の描画解像度の倍率（ゲーム座標は 960x540 のまま、キャンバスは 1920x1080）
const RENDER_SCALE = 2;
// 主人公の表示倍率。キックの行は元シートで大きめに描かれているので個別に補正
const HERO_SCALE = 1.25;
// 主人公の大きさ（素材の書き出しサイズ tools/extract_hero.py の TARGET_FIG_H と合わせる：300→264 で 0.88）
const HERO_SIZE = 0.88;
// 武器を持っている時の移動速度（重いほど遅い）
const WEIGHT_SPEED = { S: 1.0, M: 0.88, L: 0.74 };
const ANIM_SCALE = { kick: 0.77, swingS: 1.06, swingM: 1.06, swingL: 1.06, swingL2: 1.06 };

// 名前はすべて仮。ここを書き換えれば全セリフに反映される。
const NAMES = {
  hero: 'ユキ',     // 主人公（仮）
  partner: 'ルゥ',  // 小さな相棒（仮）
  friend: 'ミオ',   // 主人公の友人（仮）
};

// BGM（リポジトリ直下の既存楽曲を仮で流用）
const BGM = {
  morning: 'assets/bgm/03_base_morning_camp.mp3',
  battle: 'assets/bgm/01_battle_luminous_rush.mp3',
  boss: 'assets/bgm/02_boss_crimson_assault.mp3',
  sorrow: 'assets/bgm/04_final_abyss_gate.mp3',
};

// ---------------------------------------------------------------------
//  武器：身近な物を相棒の力で「武器化」したもの
//  box = [x0, y0, x1, y1]  足元基準・右向き時の攻撃判定
// ---------------------------------------------------------------------
// 武器の見た目は weapon（WEAPON_ART）で描画し、振りは arc（度・前方が+90）で決める。
// 体はアイドルのポーズを使い、武器だけを手に持って振る。
const WEAPONS = {
  kick: {
    name: 'キック', icon: 'kick', anim: 'kick', size: 'K',
    frameMs: [50, 50, 60, 60, 120, 80, 70, 70],
    hits: [{ frame: 4, dmg: 9, box: [5, -110, 105, -30], kb: 260, launch: 0, stop: 60 }],
    step: [0, 0, 20, 30, 60, 0, 0, 0], cancelAt: 5,
  },
  // 振りは主人公の振りモーション（SPRITE_DATA.swing）。arc は属性の軌跡を出す先端位置の近似（度・前方が+90）
  // バットは体の正面から後ろ側へ振り抜く絵なので、当たり判定は前後に広く取る
  bat: {
    name: '砂纏いのバット', from: '野球バット', icon: 'bat', anim: 'swing_bat', swing: 'bat', size: 'S', weapon: 'bat', element: 'sand',
    // 振り抜き感：構え（1〜2コマ目）で溜めて、3〜4コマ目を一瞬で振り抜き、5コマ目の振り切った姿勢で止める
    frameMs: [90, 130, 35, 40, 170, 70, 70, 80],
    arc: [-10, -20, -100, -110, -110, -100, -90, -10],
    smear: { frame: 2, from: -95, to: 150, r: 78 },   // 頭上→正面→背中側へ弧を描く残像
    hits: [
      { frame: 2, dmg: 12, box: [-60, -150, 130, -5], kb: 200, stop: 60, shake: 3 },
      { frame: 3, dmg: 16, box: [-150, -140, 120, -5], kb: 300, launch: 220, stop: 80, shake: 6 },
    ],
    step: [0, -10, 80, 40, 0, 0, 0, 0], cancelAt: 5,
  },
  chair: {
    name: '椅子', from: '椅子', icon: 'chair', anim: 'swing_chair', swing: 'chair', size: 'M', weapon: 'chair',
    frameMs: [80, 90, 70, 70, 80, 90, 90, 100],
    arc: [0, -60, 40, 90, 90, 90, 60, 0],
    hits: [
      { frame: 3, dmg: 14, box: [-15, -135, 125, -5], kb: 220, stop: 60, shake: 4 },
      { frame: 5, dmg: 20, box: [-20, -140, 145, -5], kb: 300, launch: 180, stop: 80, shake: 6 },
    ],
    step: [0, 0, 40, 40, 50, 30, 0, 0], cancelAt: 6,
  },
  desk: {
    name: '机のグレートソード', from: '机', icon: 'desk', anim: 'swing_desk', swing: 'desk', size: 'L', weapon: 'desk',
    frameMs: [110, 100, 90, 90, 220, 140],
    arc: [0, -60, -40, -20, 90, 0],
    hits: [{ frame: 4, dmg: 48, box: [-20, -175, 200, 10], kb: 520, launch: 380, stop: 150, shake: 14, slam: true }],
    step: [0, 0, 20, 30, 60, 0], cancelAt: 5, next: 'desk2',
  },
  // 机の2段目：振りモーションの後半を速く再生して、もう一度叩きつける
  desk2: {
    name: '追い打ち', anim: 'swing_desk', swing: 'desk', size: 'L', weapon: 'desk', hidden: true,
    frameMap: [2, 3, 4],
    frameMs: [70, 70, 220],
    arc: [-40, -20, 90],
    hits: [
      { frame: 1, dmg: 22, box: [-30, -170, 180, 5], kb: 300, stop: 70, shake: 6 },
      { frame: 2, dmg: 34, box: [-20, -170, 200, 10], kb: 480, launch: 300, stop: 110, shake: 10 },
    ],
    step: [30, 40, 0], cancelAt: 2,
  },
};
// 必殺「フルスイング」：今持っている武器に相棒が力を込めて振り抜く
const SPECIAL = { mp: 25, dmgMul: 1.8 };

const ELEMENTS = {
  none: { color: '#c9a2ff', glow: '#7b52ff', name: '' },
  sand: { color: '#e8d09a', glow: '#b08a46', name: '砂' },
  fire: { color: '#ffb35a', glow: '#ff5a1f', name: '炎' },
  ice:  { color: '#bfe9ff', glow: '#4a9fff', name: '氷' },   // 敵を凍えさせる（ひるみ・足止めが長い）
};

// ---------------------------------------------------------------------
//  敵
// ---------------------------------------------------------------------
const ENEMIES = {
  slime:   { spr: 'slime_s', scale: 0.85, hp: 22, dmg: 6, speed: 70, ai: 'hop', w: 50, h: 36, exp: 4 },
  slime_p: { spr: 'slime_p', scale: 0.85, hp: 34, dmg: 8, speed: 80, ai: 'hop', w: 56, h: 40, exp: 6 },
  bat:     { spr: 'bat', scale: 0.42, hp: 16, dmg: 6, speed: 140, ai: 'fly', w: 50, h: 32, exp: 5, fly: true },
  shroom:  { spr: 'shroom', scale: 0.62, hp: 52, dmg: 9, speed: 45, ai: 'spore', w: 56, h: 56, exp: 9 },
  imp:     { spr: 'imp_s', scale: 0.72, hp: 36, dmg: 10, speed: 120, ai: 'lunge', w: 46, h: 50, exp: 8 },
  ghost:   { spr: 'ghost', scale: 0.6, hp: 46, dmg: 9, speed: 70, ai: 'ghost', w: 56, h: 60, exp: 10, fly: true, weak: 'fire' },
  golem:   { spr: 'golem', scale: 1.15, hp: 1300, dmg: 12, speed: 70, ai: 'golem', w: 170, h: 185, exp: 120, boss: true,
             name: '瓦礫の番人 ガレキゴーレム' },
};

// ---------------------------------------------------------------------
//  シナリオ
//  who: hero / partner / friend / narr / sys / news / ???
//  face（主人公のみ）: default / happy / worried / angry / sad / fluster
// ---------------------------------------------------------------------
const L = (who, text, face) => ({ who, text, face });

const CHAPTERS = [
  // -------------------------------------------------------------- STAGE 1
  {
    id: 's1', title: 'STAGE 1', sub: 'いつもの日常', bg: 'street', bgm: 'morning', length: 3000,
    loadout: { weapons: [], fire: false, partner: false, canFight: false },
    intro: [
      L('narr', 'その朝も、世界はいつも通りだった。'),
      L('narr', '——少なくとも、わたしにはそう見えていた。'),
      L('hero', 'ふぁ……。いってきまーす。', 'default'),
      L('sys', '←→ で移動　Shift（または→→）で走る'),
    ],
    events: [
      { x: 520, type: 'talk', once: true, lines: [
        L('hero', 'あ、今日もいる。おはよ、ねこさん。', 'happy'),
        L('hero', '……ふふ。撫でさせてはくれないんだよね。', 'default'),
      ], prop: 'cat' },
      { x: 1150, type: 'talk', once: true, lines: [
        L('news', '「——観測史上最高の気温を、今年も各地で更新。専門家は」'),
        L('news', '「海面の上昇と森林の減少が、このまま続けば——」'),
        L('hero', '……。', 'worried'),
        L('hero', 'なんか最近、こういうニュースばっかりだな。', 'worried'),
      ], prop: 'tv' },
      { x: 1750, type: 'talk', once: true, lines: [
        L('hero', '駅前のクレープ屋さん、新作いちごミルク味だって。', 'happy'),
        L('hero', '帰りに{friend}と寄ろうっと。', 'happy'),
      ], prop: 'shop' },
      { x: 2350, type: 'talk', once: true, lines: [
        L('friend', '📱 おはよー！ 今日1限 小テストだよ〜〜'),
        L('hero', 'え、うそ。……あれ、今。', 'worried'),
        L('hero', '空に、ひび……？', 'worried'),
        L('hero', '……寝不足かな。', 'default'),
      ], prop: 'crack' },
    ],
    endX: 2850,
    outro: [
      L('narr', '校門をくぐった瞬間、悲鳴が聞こえた。'),
    ],
  },
  // -------------------------------------------------------------- STAGE 2
  {
    id: 's2', title: 'STAGE 2', sub: '学校への襲撃', bg: 'schoolyard', bgm: 'battle', length: 2200,
    loadout: { weapons: [], fire: false, partner: false, canFight: true },
    intro: [
      L('hero', 'な、なに……これ……！？', 'worried'),
      L('hero', '{friend}……！ みんな、どこ！？', 'worried'),
      L('sys', 'X でキック　C / Space でジャンプ'),
    ],
    events: [
      { x: 600, type: 'wave', waves: [
        [['slime', 1], ['slime', 1]],
        [['slime', 1], ['slime_p', 1], ['slime', -1]],
      ], lines: [L('hero', 'こ、来ないで……っ！', 'angry')] },
      { x: 1500, type: 'wave', scripted: 'overwhelm', waves: [
        [['slime', 1], ['slime_p', 1], ['slime', -1], ['slime_p', -1], ['bat', 1], ['bat', -1]],
      ], lines: [L('hero', 'うそ、こんなに……！', 'worried')] },
    ],
    endX: 99999,
    outro: [
      L('hero', 'はぁ、はぁ……もう、だめ……', 'sad'),
      L('narr', '足がもつれた。モンスターの影が、視界を覆う——'),
    ],
  },
  // -------------------------------------------------------------- STAGE 3
  {
    id: 's3', title: 'STAGE 3', sub: '小さな相棒との出会い', bg: 'schoolyard', bgm: 'battle', length: 2400,
    loadout: { weapons: [], fire: false, partner: true, canFight: true },
    intro: [
      L('???', 'ちょっと待ったーーっ！'),
      L('narr', 'まばゆい光。モンスターたちが弾き飛ばされる。'),
      L('hero', '……え？ ちいさい……ドラゴン……？', 'worried'),
      L('partner', 'ドラゴンじゃないよ！ ……たぶん。'),
      L('partner', 'ボクは{partner}。キミ、まだ動ける？'),
      L('hero', 'う、うん……なんとか。', 'worried'),
      L('partner', 'じゃあ、手を貸して。キミに、ちょっとだけ不思議な力をあげる。'),
      L('partner', '身の回りの物を「武器」に変える力。……なんでボク、こんなことできるんだろ。'),
      L('partner', 'まあいっか！ ほら、あそこのバット！ 拾って！'),
    ],
    events: [
      { x: 420, type: 'item', item: 'bat', lines: [
        L('partner', 'いくよ——『武器化』！ ついでに校庭の砂も纏わせちゃえ！'),
        L('hero', 'わっ……バットが、剣みたいに……！', 'happy'),
        L('sys', 'Z で攻撃（連打でコンボ）　Q で武器切替'),
        L('partner', 'MPが溜まったら V で必殺の「フルスイング」！ ボクの力を武器に込めるよ！'),
      ] },
      { x: 900, type: 'wave', waves: [
        [['slime', 1], ['slime', -1], ['bat', 1]],
        [['slime_p', 1], ['slime_p', -1], ['bat', 1], ['bat', -1]],
      ], lines: [L('hero', '……やるしかない、よね。', 'angry')] },
      { x: 1700, type: 'wave', waves: [
        [['imp', 1], ['slime', -1], ['slime', 1]],
        [['imp', 1], ['imp', -1], ['bat', 1]],
      ], lines: [L('partner', '校舎の中に逃げ遅れた人がいるかも！ 屋上まで行けば、出口が開けるはず！')] },
    ],
    endX: 2250,
    outro: [
      L('hero', '{partner}、なんで屋上なの？', 'default'),
      L('partner', 'わかんない。……でも、そこに「いる」気がするんだ。この騒ぎの元が。'),
    ],
  },
  // -------------------------------------------------------------- STAGE 4-1
  {
    id: 's4a', title: 'STAGE 4-1', sub: '校舎', bg: 'corridor', bgm: 'battle', length: 3000,
    loadout: { weapons: ['bat'], fire: false, partner: true, canFight: true },
    intro: [
      L('hero', '……誰も、いない。', 'sad'),
      L('hero', '昨日まで、ここで普通に笑ってたのに。', 'sad'),
      L('partner', '……行こう。立ち止まったら、きっと動けなくなる。'),
    ],
    events: [
      { x: 380, type: 'item', item: 'chair', lines: [
        L('partner', '椅子の脚もいけるよ！ 小さくて速い武器だ！'),
        L('sys', 'Q で武器を切り替え。軽い武器は手数で押す！'),
      ] },
      { x: 900, type: 'wave', waves: [
        [['shroom', 1], ['slime_p', -1], ['bat', 1]],
        [['imp', 1], ['shroom', -1], ['imp', -1]],
      ] },
      { x: 1500, type: 'talk', once: true, lines: [
        L('friend', '📱 {hero}どこ！？ わたし体育館に避難してる！ ぶじ？'),
        L('hero', '{friend}……よかった……。', 'happy'),
        L('hero', '（「だいじょうぶ、すぐ行く」……っと）', 'default'),
      ] },
      { x: 1800, type: 'item', item: 'desk', lines: [
        L('hero', '……ねえ{partner}。この机も、いける？', 'default'),
        L('partner', 'もちろん！ ……でも、すっっっごく大きくなるよ？'),
        L('hero', 'いいよ。大きいほうが、みんなを守れる。', 'angry'),
        L('sys', '机のグレートソードを手に入れた！ 振り終わりにもう一度 Z で回転斬り！'),
      ] },
      { x: 2300, type: 'wave', waves: [
        [['shroom', 1], ['shroom', -1], ['imp', 1], ['bat', -1]],
        [['imp', 1], ['imp', -1], ['slime_p', 1], ['slime_p', -1], ['bat', 1]],
      ], lines: [L('partner', 'いっぱい来た！ 机で薙ぎ払っちゃえ！')] },
    ],
    endX: 2850,
    outro: [L('partner', 'この先、家庭科室！ 嫌な気配がする……')],
  },
  // -------------------------------------------------------------- STAGE 4-2
  {
    id: 's4b', title: 'STAGE 4-2', sub: '家庭科室', bg: 'homeec', bgm: 'battle', length: 2400,
    loadout: { weapons: ['bat', 'chair', 'desk'], fire: false, partner: true, canFight: true },
    intro: [
      L('hero', 'ひゃっ……！ い、今の、おばけ……！？', 'fluster'),
      L('partner', 'ゴーストだ！ 普通の攻撃じゃ効きにくいよ！'),
      L('hero', 'むりむりむり、ホラーは本当にむり……！', 'fluster'),
    ],
    events: [
      { x: 520, type: 'wave', waves: [[['ghost', 1], ['ghost', -1]]],
        lines: [L('partner', 'がんばって！ あ、あそこのコンロ……！')] },
      { x: 1000, type: 'item', item: 'stove', lines: [
        L('partner', 'ガスコンロの炎を武器に移すよ——『魔力付与』！'),
        L('hero', 'あったかい……。これなら、こわくない！', 'happy'),
        L('sys', '全ての武器に炎が宿った！ ゴーストに大ダメージ、敵を燃やす！'),
      ] },
      { x: 1500, type: 'wave', waves: [
        [['ghost', 1], ['ghost', -1], ['shroom', 1]],
        [['ghost', 1], ['imp', -1], ['imp', 1], ['bat', -1]],
      ], lines: [L('hero', 'もう逃げない……！', 'angry')] },
    ],
    endX: 2250,
    outro: [
      L('partner', '階段の上……屋上だ。'),
      L('hero', '……行こう。', 'angry'),
    ],
  },
  // -------------------------------------------------------------- STAGE 4-3 (BOSS)
  {
    id: 's4c', title: 'STAGE 4-3', sub: '屋上', bg: 'rooftop', bgm: 'boss', length: 1500,
    loadout: { weapons: ['bat', 'chair', 'desk'], fire: true, partner: true, canFight: true },
    intro: [
      L('narr', '夕焼けの屋上。空に走る亀裂から、紫の光が零れていた。'),
      L('narr', '崩れたフェンスと給水塔が、ひとつに寄り集まっていく——'),
      L('partner', 'あいつだ！ 学校中のモンスターを呼んでたのは！'),
      L('hero', '……みんなの学校を、返して。', 'angry'),
    ],
    events: [
      { x: 400, type: 'boss', enemy: 'golem', lines: [] },
    ],
    endX: 99999,
    outro: [
      L('narr', '瓦礫の巨人が崩れ落ちる。空の亀裂が、ゆっくりと閉じていく。'),
      L('hero', '……おわった、の……？', 'sad'),
      L('partner', 'うん。……とりあえず、今日のところは。'),
    ],
  },
  // -------------------------------------------------------------- STAGE 5 (story)
  {
    id: 's5', title: 'STAGE 5', sub: '三つの世界', bg: 'rooftop_calm', bgm: 'sorrow', length: 960, storyOnly: true,
    loadout: { weapons: ['bat', 'chair', 'desk'], fire: true, partner: true, canFight: false },
    intro: [
      L('hero', 'ねえ、{partner}。あのモンスターたち……どこから来たの？', 'default'),
      L('partner', '……話すね。思い出せたことだけ、だけど。'),
      L('partner', '世界はね、三つに分かれてるんだ。人間の住む「現世」、モンスターの住む「魔界」、それから神さまたちの「神界」。'),
      L('partner', 'ずっとずっと昔は、ひとつの世界だった。人間も、モンスターも、神さまも、一緒に暮らしてた。'),
      L('hero', '……一緒に？', 'worried'),
      L('partner', 'でも神さまたちは、秩序と均衡を守るために、世界を三つに切り分けた。'),
      L('partner', 'いまの現世は……人が増えて、街が広がって、森も海も削られて。少しずつ、天秤が傾いてる。'),
      L('partner', '魔界も同じ。分けられたせいで、命がめぐる仕組みが壊れて……ゆっくり、枯れていってる。'),
      L('hero', 'だから、こっちに来たの？ 生きるために……？', 'sad'),
      L('partner', '……たぶん。'),
      L('hero', '……。', 'sad'),
      L('hero', '朝のニュース、思い出しちゃった。', 'sad'),
      L('partner', '{hero}？'),
      L('hero', 'ううん。……ねえ、{partner}。明日も、学校あるかな。', 'default'),
      L('partner', '……あるよ。キミが、守ったから。'),
      L('narr', '夕焼けが、やけにきれいだった。'),
      L('narr', 'それが「終わり」の色だと知るのは、もう少し先のこと。'),
    ],
    events: [],
    endX: 99999,
    outro: [],
  },
];

// 主人公の拡大に合わせて雑魚敵も少し大きく
for (const k in ENEMIES) { const e = ENEMIES[k]; if (!e.boss) { e.scale *= 1.2; e.w *= 1.2; e.h *= 1.2; } }

const ITEMS = {
  bat:   { label: '野球バット', weapon: 'bat' },
  chair: { label: '椅子', weapon: 'chair' },
  desk:  { label: '机', weapon: 'desk' },
  stove: { label: 'ガスコンロ', fire: true },
};

// 次のレベルまでの経験値（本編の調整：Lv が上がるほど急に重くなる。Lv1:36 / Lv4:156 / Lv8:484）
function expNeed(lv) { return 20 + lv * 10 + lv * lv * 6; }
