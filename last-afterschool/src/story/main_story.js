// =====================================================================
//  本編のストーリー・会話イベント
//  ・各エリア到着（そのダンジョンに初めて入った時）
//  ・各エリア10階のボス戦の前後（そのダンジョンをまだクリアしていない間）
//  ・魔王撃破後のエンディング（町へ帰還 → ミオと再会 → クレープ屋 → 帰り道 → THE END）
//  既存の会話表示（Dialogue）・背景・キャラクターの絵だけを使う。セーブデータの項目は増やさない
//  （到着＝最高到達階が0、ボス会話＝未クリア、で判定する）
// =====================================================================
const STORY = (() => {
const K = (text) => L('king', text);   // 魔王のせりふ
const H = (text, face = 'default') => L('hero', text, face);
const R = (text) => L('partner', text);
const N = (text) => L('narr', text);
const M = (text, face = 'happy') => L('friend', text, face);
return {
  // ---------------- エリア到着 ----------------
  arrive: {
    grassland: [
      H('わぁ……！ さっきまでの景色と全然違うね', 'happy'),
      R('ここは草原のエリアだよ。見渡すかぎり、緑がいっぱい！'),
      H('なんだか、ちょっと落ち着く場所だね', 'happy'),
      R('油断しちゃダメだよ。ここにも魔物がいるからね'),
      H('うん。よし、行こう！', 'happy'),
    ],
    desert: [
      H('今度は砂漠……！ 暑そうだね', 'worried'),
      R('うん。草原とは全然違う環境だね'),
      H('こんなところまで来ることになるなんて、思ってもいなかったよ'),
      R('でも、ここを越えれば次に進めるよ'),
      H('よし！ 暑さに負けずに頑張ろう！', 'happy'),
    ],
    snow: [
      H('さむっ……！ ここ、すごく寒いね', 'fluster'),
      R('雪と氷に覆われた場所だね'),
      H('さっきまで暑かったのに、今度はこんなに寒いなんて……', 'worried'),
      R('体調に気をつけてね。足元にも注意して'),
      H('うん。ここも乗り越えてみせるよ！', 'happy'),
    ],
    volcano: [
      H('うわぁ……！ すごい熱気！', 'fluster'),
      R('ここは火山のエリアだよ。今までの場所より危険かもしれないね'),
      H('溶岩まで流れてる……。気をつけないと', 'worried'),
      R('うん。時間にも気を配って進もう'),
      H('ここを越えれば、いよいよ最後のエリアだね'),
      R('そうだね。もう少しだよ、{hero}'),
    ],
    castle: [
      H('ここが……魔王城', 'worried'),
      R('この先に魔王がいるはずだよ'),
      H('ここまで長かったね'),
      R('うん。でも、まだ終わってない'),
      H('魔王を倒して、全部終わらせよう', 'angry'),
      R('……そうだね'),
      H('行こう、{partner}！', 'happy'),
    ],
  },

  // ---------------- 10階ボス戦の前 ----------------
  bossPre: {
    grassland: [
      H('うわっ……大きい！', 'fluster'),
      R('草原の奥を守っている魔物みたい'),
      H('体中が苔だらけだね……', 'worried'),
      R('炎なら、あの苔の鎧を焼き払えるかもしれないよ'),
      H('なるほど。試してみよう！', 'happy'),
    ],
    desert: [
      H('砂の中から何か出てきた……！', 'fluster'),
      R('気をつけて！ あれがこの砂漠の主みたい'),
      H('大きな槍まで持ってる……！', 'worried'),
      R('攻撃をよく見て。無理に近づかない方がいいよ'),
      H('わかった。慎重にいこう！'),
    ],
    snow: [
      H('竜……！？ こんなところにいるなんて！', 'fluster'),
      R('この雪原を守っている魔物だよ'),
      H('体が氷で覆われてる……普通の攻撃じゃ厳しそう', 'worried'),
      R('炎を使えば、氷の鎧を溶かせるはずだよ'),
      H('よし。今まで覚えたことを全部使って戦おう！', 'angry'),
    ],
    volcano: [
      H('また巨像……！ 今度は体が溶岩みたいになってる', 'fluster'),
      R('溶岩の鎧をまとっているみたいだね'),
      H('炎は効かなそう……', 'worried'),
      R('氷の力を使ってみて。熱を冷ませるかもしれないよ'),
      H('わかった！ これまで手に入れた力を試してみる！', 'angry'),
    ],
    castle: [
      K('人間がここまで辿り着くとはな'),
      H('あなたが魔王……！', 'angry'),
      K('我らの世界に踏み込み、数多の同胞を倒してきたか'),
      H('人間の世界を襲ったのは、あなたたちでしょ！', 'angry'),
      K('本当にそう思っているのか？'),
      H('どういう意味……？', 'worried'),
      K('人間の世界に異変が起きた理由を知らぬまま、ここまで来たのだな'),
      R('{hero}、気をつけて。魔王の言葉に惑わされないで'),
      K('……ほう。その小さな存在が、まだ人間の側にいるとは'),
      H('{partner}のことを知っているの？', 'worried'),
      K('いや……今は語る時ではない'),
      R('……'),
      K('来るがいい、人間。すべてを知る覚悟があるのならな'),
      H('私は、私の世界を守る！', 'angry'),
    ],
  },

  // ---------------- 10階ボス撃破後 ----------------
  bossPost: {
    grassland: [
      H('やった……！ 倒せた！', 'happy'),
      R('うん！ これで草原の奥まで進めるね'),
      H('最初はどうなるかと思ったけど、少しずつ強くなってる気がする！', 'happy'),
      R('ふふっ。その調子だよ、{hero}'),
    ],
    desert: [
      H('はぁ……はぁ……。なんとか勝てたね', 'worried'),
      R('すごいよ、{hero}！ もうこんな強敵にも勝てるんだね'),
      H('最初の頃と比べたら、少しは成長できてるかな？'),
      R('もちろん。ボクはずっと見てきたからね'),
      H('えへへ。ありがとう、{partner}', 'happy'),
    ],
    snow: [
      H('やった……！ 竜にも勝てたよ！', 'happy'),
      R('うん。{hero}、本当に強くなったね'),
      H('ここまで来られたのも、{partner}がいてくれたからだよ', 'happy'),
      R('……そっか。ありがとう'),
      H('どうしたの？ なんだか少し寂しそう', 'worried'),
      R('ううん。なんでもないよ！'),
    ],
    volcano: [
      H('これで……火山も突破できたね！', 'happy'),
      R('うん。残るは最後の場所だけだよ'),
      H('魔王城……。いよいよ魔王がいるんだね', 'worried'),
      R('……うん'),
      H('{partner}？', 'worried'),
      R('大丈夫。最後まで一緒に行こう'),
      H('もちろん！', 'happy'),
    ],
    castle: [
      K('……見事だ。人間よ'),
      H('どうして……。どうして人間の世界を襲ったの？', 'sad'),
      K('我らもまた、生きるために戦っていたにすぎぬ'),
      H('生きるため……？', 'worried'),
      K('神々は人間の命の力を集め、己らの世界を維持しようとしている'),
      H('神様が……？', 'worried'),
      K('人間の世界で起きている異変も、そのためのものだ'),
      H('そんなこと、信じられない……', 'sad'),
      K('信じるかどうかは、お前が決めればよい'),
      K('我ら魔族も、ただ滅ぼされるわけにはいかなかった。それだけのことだ'),
      H('じゃあ……魔族がみんな悪いわけじゃないんだね', 'sad'),
      K('少なくとも、我らにも守りたいものがあった'),
      H('……', 'sad'),
      K('人間よ。神々の行いを知ったうえで、これからどう生きる？'),
      K('この先に何が待つのか……それは、お前たち自身で確かめるがよい'),
      K('そして……そこの小さき者よ'),
      R('……'),
      K('お前も、いつまでも知らぬふりはできまい'),
      H('{partner}……？', 'worried'),
      R('……行こう、{hero}'),
      H('うん……', 'sad'),
    ],
  },

  // ---------------- エンディング ----------------
  // 場面ごとに背景・位置・ミオの立ち位置を決める。act：その行で起きること（ミオが去る など）
  ending: [
    { title: '帰還', bg: 'town', x: 2560, town: true, bgm: 'morning', lines: [
      H('……帰ってきたんだね', 'sad'),
      R('うん。人間の世界だよ'),
      H('なんだか、ずいぶん久しぶりに感じるな'),
      R('いろんなことがあったからね'),
      H('魔王が言っていたこと……神様が人間の命の力を集めているって話', 'worried'),
      R('……'),
      H('まだ信じられないけど、あの話が本当なら……', 'worried'),
      R('今は、少し休もう。{hero}も疲れたでしょ？'),
      H('そうだね。まずは、いつもの日常に戻りたいな', 'happy'),
    ] },
    { title: '再会', bg: 'town', x: 1930, town: true, bgm: 'morning', lines: [
      M('{hero}！！', 'surprise'),
      H('{friend}！', 'happy'),
      M('もう！ 心配したんだからね！ 急にいなくなっちゃうし、連絡も取れないし！', 'sulk'),
      H('ごめんね……。本当にいろいろあって', 'sad'),
      M('……まあ、無事でよかった', 'shy'),
      H('うん。ただいま！', 'happy'),
      M('おかえり！ ねえ、覚えてる？ 前に約束したクレープ！', 'laugh'),
      H('あっ……！ 覚えてるよ！', 'fluster'),
      M('じゃあ今日は約束どおり、付き合ってもらうからね！', 'happy'),
      H('もちろん！', 'happy'),
    ] },
    { title: 'クレープ屋', bg: 'street', x: 1730, mio: 1830, prop: { x: 1750, prop: 'shop' }, bgm: 'morning', lines: [
      M('やっぱりここのクレープは最高！', 'laugh'),
      H('うん。なんだか、すごく懐かしい味がする', 'happy'),
      M('何それ。そんなに久しぶりでもないでしょ？', 'think'),
      H('ふふっ。そうだね', 'happy'),
      M('これからは、ちゃんと遊びに行こうね', 'happy'),
      H('うん。約束！', 'happy'),
      R('……'),
      H('{partner}も食べる？'),
      R('ボクは大丈夫。二人で楽しんで'),
      H('そっか。ありがとう、{partner}', 'happy'),
      M('{partner}ちゃんも、ずっと{hero}と一緒にいてくれたんだよね', 'shy'),
      R('うん。ずっと一緒だったよ'),
      H('{partner}がいてくれたから、ここまで来られたんだよ', 'happy'),
      R('……{hero}'),
      M('これからも三人でいっぱい遊ぼうね！', 'laugh'),
      H('うん！', 'happy'),
    ] },
    { title: '帰り道', bg: 'town', x: 1250, mio: 1350, town: true, dusk: 0.25, bgm: 'sorrow', lines: [
      M('じゃあ、私はこっちだから！', 'happy'),
      H('うん。またね、{friend}！', 'happy'),
      M('明日も学校でね！', 'laugh'),
      H('また明日！', 'happy'),
      Object.assign(N('ミオが手を振りながら去っていく。'), { act: 'mioLeave' }),
      H('……なんだか、夢みたいだったね'),
      R('そうだね'),
      H('魔物と戦ったことも、魔王の話も……全部、本当にあったんだよね', 'worried'),
      R('うん'),
      H('でも、こうしてまた{friend}とクレープを食べられてよかった', 'happy'),
      R('{hero}が笑っているところを見られて、ボクもうれしいよ'),
      H('ありがとう、{partner}。ずっと一緒にいてくれて', 'happy'),
      R('……こちらこそ'),
    ] },
    { title: '夜', bg: 'town', x: 700, town: true, dusk: 0.55, skyCrack: true, walk: true, bgm: 'sorrow', lines: [
      N('ユキとルゥが並んで歩いている。'),
      H('ねえ、{partner}'),
      R('なあに？'),
      H('これからも、こうして一緒にいられるよね？'),
      R('もちろんだよ'),
      H('よかった', 'happy'),
      N('……少し、間が空く。'),
      Object.assign(N('ユキが空を見上げる。'), { act: 'lookUp' }),
      H('……あの空のひび、もう大丈夫なのかな', 'worried'),
      N('ルゥも空を見上げる。'),
      R('……まだ、完全にはね'),
      H('えっ？', 'worried'),
      R('ううん。なんでもないよ'),
      H('{partner}？', 'worried'),
      R('{hero}。いつか、すべてを知る日が来ても……'),
      N('ルゥは言葉を止める。'),
      H('すべてを知る日？', 'worried'),
      R('……その時も、ボクのことを信じてくれる？'),
      H('もちろんだよ。だって、{partner}は大切な友達だもん', 'happy'),
      R('……そっか'),
      N('ルゥが少しだけ笑う。'),
      H('さあ、帰ろう！ 明日も学校だしね！', 'happy'),
      R('うん！'),
      Object.assign(N('二人が並んで歩いていく。'), { act: 'walkAway' }),
    ] },
  ],
};
})();
// 台本のナレーションは名前を直接書いているので、名前の差し替えに合わせる
for (const sc of STORY.ending) for (const l of sc.lines) if (l.who === 'narr') l.text = l.text.replace(/ユキ/g, '{hero}').replace(/ルゥ/g, '{partner}').replace(/ミオ/g, '{friend}');

// =====================================================================
//  ゲームの流れへの組み込み
// =====================================================================
const StoryFlow = {
  isStory(id) { return !!STORY.arrive[id]; },
  // 階を作った直後に呼ぶ：到着・ボス戦前後の会話を章データに付ける
  attach(game, ch) {
    const run = game.run, id = run && run.id; if (!this.isStory(id)) return;
    const d = game.save.dungeons[id] || {};
    if (run.floor === 1 && !(d.best > 0)) ch.intro = STORY.arrive[id];   // 初めて来た時だけ
    if (run.floor === 10 && !d.cleared && ch.boss) { ch.bossPre = STORY.bossPre[id]; ch.bossPost = STORY.bossPost[id]; }
  },
  // エンディング：場面を順に再生して、最後に THE END
  startEnding(game) {
    game.run = null; game.save.hp = null; Save.store(game.save);
    game.endingIdx = 0; game.transition(() => this.playScene(game));
  },
  playScene(game) {
    const sc = STORY.ending[game.endingIdx];
    if (!sc) { game.scene = 'theend'; game.t = 0; Audio2.playBgm('sorrow'); return; }
    const ch = {
      id: 'ending_' + game.endingIdx, title: 'ENDING', sub: sc.title, bg: sc.bg, bgm: sc.bgm, length: sc.bg === 'town' ? TOWN.length : 3000,
      loadout: { weapons: [], fire: false, partner: true, canFight: false }, cutscene: true,
      intro: sc.lines, events: sc.prop ? [Object.assign({ type: 'deco', done: true }, sc.prop)] : [], endX: 99999, outro: [],
      showTown: !!sc.town, mio: sc.mio ? { x: sc.mio, a: 1 } : null, dusk: sc.dusk || 0, skyCrack: !!sc.skyCrack, walk: !!sc.walk,
      onDone: () => { game.endingIdx++; game.transition(() => this.playScene(game)); },
    };
    game.world = new World(ch, game.save, game);
    const P = game.world.player; P.x = sc.x; P.face = sc.mio && sc.mio < sc.x ? -1 : 1; P.locked = true;
    game.world.camX = clamp(sc.x - VIEW_W / 2 + 60, 0, ch.length - VIEW_W);
    game.card = { t: 0 }; game.scene = 'card'; game.fade = 1;
    Audio2.playBgm(sc.bgm);
  },
  // 会話の行に付いた演出（ミオが去る・空を見上げる・歩いていく）
  update(W, dt) {
    const ch = W.ch, l = W.dialogue && W.dialogue.line;
    if (l && l.act === 'mioLeave' && ch.mio) ch.mio.leaving = true;
    if (l && l.act === 'walkAway') ch.walking = true;
    if (ch.mio && ch.mio.leaving) { ch.mio.x += 90 * dt; ch.mio.a = Math.max(0, ch.mio.a - dt * 0.35); }
    if (ch.walk || ch.walking) { const P = W.player; if (ch.walking) { P.x += 60 * dt; P.anim = 'walk'; P.ft += dt; if (P.ft > 0.14) { P.ft = 0; P.frame = (P.frame + 1) % 5; } } }
    if (ch.walking) W.camX += 60 * dt;
  },
  // 夕暮れ・夜の色、空のひび、ミオの姿
  drawBack(W, ctx, cam) {
    const ch = W.ch;
    if (ch.skyCrack) {
      ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(W.time * 1.5) * 0.08; ctx.strokeStyle = '#e8d8ff'; ctx.lineWidth = 2; ctx.shadowColor = '#b48aff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(560, 40); ctx.lineTo(590, 80); ctx.lineTo(575, 110); ctx.lineTo(610, 150); ctx.moveTo(590, 80); ctx.lineTo(630, 92); ctx.stroke(); ctx.restore();
    }
    if (ch.mio && ch.mio.a > 0) { ctx.save(); ctx.globalAlpha = ch.mio.a; Town.drawMio(ctx, ch.mio.x - cam, GROUND_Y, W.time, -1); ctx.restore(); }
  },
  drawTint(W, ctx) {
    if (!W.ch.dusk) return;
    ctx.fillStyle = `rgba(20,10,50,${W.ch.dusk})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
};

// THE END → 少し間を置いて「まだ、物語は終わっていない。」→ 町へ
Object.assign(Game, {
  startEnding() { StoryFlow.startEnding(this); },
  u_theend() { if (this.t > 7 && (Input.confirm() || this.takeTap())) this.transition(() => this.enterTown()); },
  d_theend() {
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.max(0, Math.min(1, (this.t - 1) / 1.5));
    ctx.font = `44px ${FONT}`; ctx.fillStyle = '#fff6ff'; ctx.fillText('THE END', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.globalAlpha = Math.max(0, Math.min(1, (this.t - 4.5) / 2));
    ctx.font = `20px ${FONT}`; ctx.fillStyle = '#c9b6ff'; ctx.fillText('まだ、物語は終わっていない。', VIEW_W / 2, VIEW_H / 2 + 60);
    ctx.globalAlpha = this.t > 7 ? 0.5 + Math.sin(this.t * 3) * 0.5 : 0;
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText('Z / Enter / タップで町へ', VIEW_W / 2, VIEW_H - 40);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  },
});
