// =====================================================================
//  現世の町（歩き回れる拠点）
//  ・施設・人は TOWN.facilities に並べる。増やす時はここに足して interact に分岐を書く
//  ・メニューは UI（HTML の重ね表示）。データの変更後は Save.store で保存する
// =====================================================================
NAMES.town = '宵ヶ丘';   // 町の名前（仮）

const TOWN = {
  id: 'town', town: true, title: '現世', sub: `${NAMES.town}の町`, bg: 'town', bgm: 'morning', length: 3020,
  loadout: { weapons: [], fire: false, partner: true, canFight: false },
  intro: [], events: [], endX: 99999, outro: [],
  // 街の飾り（街灯・ベンチ・自販機）。x は町の座標、s は拡大率
  decor: [
    { x: 120, img: 'lamp', s: 1.6 }, { x: 640, img: 'vending', s: 1.5 }, { x: 700, img: 'lamp', s: 1.6 },
    { x: 1300, img: 'bench', s: 1.4 }, { x: 1830, img: 'lamp', s: 1.6 }, { x: 2250, img: 'bench', s: 1.4 }, { x: 2380, img: 'vending', s: 1.5 }, { x: 2950, img: 'lamp', s: 1.6 },
  ],
  facilities: [
    { id: 'home',  x: 340,  name: '自宅' },
    { id: 'shop',  x: 980,  name: 'コンビニ' },
    { id: 'smith', x: 1600, name: '鍛冶屋' },
    { id: 'mio',   x: 2040, name: NAMES.friend, npc: true },
    { id: 'gate',  x: 2660, name: '学校の屋上' },
  ],
};

// 初めて町に来た時の会話
const TOWN_FIRST_VISIT = [
  L('narr', 'あの日から、学校は休校になった。'),
  L('narr', '町はいつも通りの顔をしている。……少なくとも、表向きは。'),
  L('partner', '{hero}。魔界の扉は、まだ学校の屋上に開いたままだよ。'),
  L('partner', 'モンスターがこっちに来る前に、こっちから止めに行こう。'),
  L('hero', '……うん。ちゃんと準備してからね。', 'default'),
  L('partner', '家で装備を整えて、コンビニで回復アイテムを買って。それから屋上へ！'),
  L('sys', '建物や人の前で ↓（スマホは「しらべる」）'),
];

const Town = {
  chapter(save) {
    const ch = Object.assign({}, TOWN);
    if (!save.flags || !save.flags.townIntro) ch.intro = TOWN_FIRST_VISIT;
    return ch;
  },
  near(W) {
    const P = W.player;
    return TOWN.facilities.find(f => Math.abs(P.x - f.x) < (f.npc ? 60 : 90)) || null;
  },

  // ---------------- 描画 ----------------
  drawFacilities(ctx, cam, W) {
    const G = GROUND_Y, t = W.time;
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const sign = (x, y, text, col = '#fff6ff') => {
      ctx.font = `15px ${FONT}`; const w = ctx.measureText(text).width + 20;
      R('#2a2140', x - w / 2, y - 18, w, 26); R('#b9a2ff', x - w / 2, y - 18, w, 2);
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(text, x, y); ctx.textAlign = 'left';
    };
    for (const d of TOWN.decor) {   // 街の飾り
      const im = IMG[ENV[d.img]], x = d.x - cam;
      if (!im || !im.width || x < -100 || x > VIEW_W + 100) continue;
      ctx.drawImage(im, Math.round(x - im.width * d.s / 2), Math.round(G - im.height * d.s + 2), im.width * d.s, im.height * d.s);
    }
    const FZ = 1.45;   // 建物の拡大率（地面を基準に大きく描く）
    const art = (key, x, s) => { const im = IMG[ENV[key]]; if (!im || !im.width) return false; ctx.drawImage(im, Math.round(x - im.width * s / 2), Math.round(G - im.height * s + 3), im.width * s, im.height * s); return im.height * s; };
    for (const f of TOWN.facilities) {
      const x = f.x - cam;
      if (x < -320 || x > VIEW_W + 320) continue;
      ctx.save(); ctx.translate(x, G); ctx.scale(f.npc ? 1 : FZ, f.npc ? 1 : FZ); ctx.translate(-x, -G);
      if (f.id === 'home') {
        R('#e8d8e2', x - 110, G - 190, 220, 190); ctx.fillStyle = '#7c5f8d';
        ctx.beginPath(); ctx.moveTo(x - 130, G - 190); ctx.lineTo(x, G - 260); ctx.lineTo(x + 130, G - 190); ctx.fill();
        R('#ffd9a0', x - 85, G - 160, 44, 36); R('#ffd9a0', x + 41, G - 160, 44, 36);
        R('#6d5248', x - 22, G - 92, 44, 92); R('#d8b080', x + 12, G - 50, 5, 5);
        sign(x, G - 205, '自宅');
      } else if (f.id === 'shop' && IMG[ENV.store] && IMG[ENV.store].width) {
        const hh = art('store', x, 1.9 / FZ); sign(x, G - hh - 14, 'コンビニ');
      } else if (f.id === 'shop') {
        R('#f2eef4', x - 130, G - 170, 260, 170);
        for (let i = 0; i < 13; i++) R(i % 2 ? '#fff' : '#6ab48a', x - 130 + i * 20, G - 170, 20, 22);
        R('#bfe0ff', x - 110, G - 132, 150, 100); R('#8ab0d0', x - 110, G - 132, 150, 4);
        R('#6e6080', x + 60, G - 120, 50, 120); R('#bfe0ff', x + 66, G - 112, 38, 60);
        ctx.fillStyle = 'rgba(255,240,200,.35)'; ctx.fillRect(x - 108, G - 128, 146, 96);
        sign(x, G - 185, 'コンビニ');
      } else if (f.id === 'smith') {
        R('#8a7468', x - 100, G - 140, 200, 140); R('#5a4a44', x - 110, G - 152, 220, 16);
        R('#3a302c', x - 30, G - 90, 60, 90); R('#2a2224', x - 20, G - 30, 40, 14);
        sign(x, G - 168, '鍛冶屋（準備中）', '#c9bfd6');
      } else if (f.id === 'mio') {
        this.drawMio(ctx, x, G, t);
        ctx.font = `14px ${FONT}`; ctx.fillStyle = '#ffd6e6'; ctx.textAlign = 'center'; ctx.fillText(NAMES.friend, x, G - 175); ctx.textAlign = 'left';
      } else if (f.id === 'gate' && IMG[ENV.school] && IMG[ENV.school].width) {
        const hh = art('school', x, 2.3 / FZ);
        const a = 0.35 + Math.sin(t * 2.4) * 0.12;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, G - hh - 10, 6, x, G - hh - 10, 120); g.addColorStop(0, `rgba(200,140,255,${a})`); g.addColorStop(1, 'rgba(120,60,200,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 130, G - hh - 130, 260, 240); ctx.restore();
        sign(x, G - hh - 14, '学校（屋上のゲート）');
      } else if (f.id === 'gate') {
        R('#cdbfcf', x - 140, G - 260, 280, 260); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) R('#6e5a7e', x - 120 + j * 66, G - 240 + i * 70, 44, 40);
        R('#5a4a66', x - 34, G - 110, 68, 110);
        // 屋上から漏れる魔界の光（ゲート）
        const a = 0.35 + Math.sin(t * 2.4) * 0.12;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, G - 280, 6, x, G - 280, 120); g.addColorStop(0, `rgba(200,140,255,${a})`); g.addColorStop(1, 'rgba(120,60,200,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 130, G - 400, 260, 240); ctx.restore();
        sign(x, G - 128, '学校（屋上のゲート）');
      }
      ctx.restore();
    }
    // 近くの施設の上に「しらべる」
    if (W.nearFac && !W.dialogue) {
      const f = W.nearFac, x = f.x - cam, y = GROUND_Y - (f.npc ? 200 : 410) + Math.sin(t * 5) * 4;
      ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe27a';
      ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 4; const s = IS_TOUCH ? '▼ しらべる' : '▼ ↓ しらべる';
      ctx.strokeText(s, x, y); ctx.fillText(s, x, y); ctx.textAlign = 'left';
    }
  },
  // 友人ミオ：専用の絵がまだないので、主人公の待機絵を暗い色に染めた仮の姿（仮実装）
  _mio: null,
  // 親友ミオ：立ち姿3ポーズをゆっくり切り替える
  // 主人公と同じ縮尺（HERO_SCALE・HERO_SIZE）で描く。主人公より少しだけ小柄
  MIO_K: HERO_SCALE * HERO_SIZE * 0.97,
  drawMio(ctx, x, G, t, flip) {
    const set = SPRITE_DATA.friend.stand, img = IMG[set.img];
    if (!img || !img.width) return;
    const f = set.frames[[0, 1, 0, 2][Math.floor(t / 2.4) % 4]], sc = set.scale * this.MIO_K, bob = Math.sin(t * 2) * 1;
    ctx.fillStyle = 'rgba(10,0,20,.3)'; ctx.beginPath(); ctx.ellipse(x, G + 2, 30, 7, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(Math.round(x), 0); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, f.x, f.y, f.w, f.h, Math.round(-f.ax * sc), Math.round(G - f.ay * sc + bob), f.w * sc, f.h * sc);
    ctx.restore();
  },
  drawHud(ctx, W, save) {
    panel(ctx, 14, 12, 300, 58, 'rgba(18,12,34,.85)', '#8f7fd0');
    ctx.font = `16px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText(`${TOWN.title}・${TOWN.sub}`, 28, 36);
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(`Lv ${save.lv}`, 28, 58);
    ctx.fillStyle = '#ffe27a'; ctx.fillText(`所持金 ${save.gold} G`, 110, 58);
  },

  // ---------------- 施設 ----------------
  interact(f, game) {
    const W = game.world, s = game.save;
    Audio2.sfx('select');
    if (f.id === 'home') return this.openHome(game);
    if (f.id === 'shop') return this.openShop(game);
    if (f.id === 'gate') return this.openGate(game);
    if (f.id === 'mio') return W.say([
      L('friend', `あ、{hero}！ 学校、しばらく休校だって。`, 'laugh'),
      L('friend', 'ねえ、最近ちょっと疲れた顔してない？', 'think'),
      L('hero', 'ううん、大丈夫。', 'default'),
      L('friend', '無理しないでね。駅前のクレープ、また一緒に行こ？ 約束だよ。', 'shy'),
      L('hero', '……うん。約束。', 'sad'),
    ]);
    if (f.id === 'smith') return W.say([
      L('partner', 'まだ閉まってるみたい。魔界で材料を集めたら、開けてもらえるかも？'),
      L('sys', '鍛冶屋（強化・分解）は今後の実装予定です'),
    ]);
  },
  save(game) { Save.store(game.save); },
  goldHead(game) { return () => `所持金 ${game.save.gold} G`; },

  // ---- 自宅：装備・持ち物・ステータス・セーブ ----
  openHome(game) {
    const s = game.save, h = UI.h;
    let selSlot = null;
    const slotDefs = [['weapon:0', '武器1'], ['weapon:1', '武器2'], ['weapon:2', '武器3'], ['armor', '防具'], ['acc:0', 'アクセ1'], ['acc:1', 'アクセ2']];
    const slotUid = sl => { const [k, i] = sl.split(':'); return k === 'weapon' ? s.equip.weapons[+i] : k === 'acc' ? s.equip.acc[+i] : s.equip.armor; };
    const kindOf = sl => (sl.startsWith('weapon') ? 'weapon' : sl.startsWith('acc') ? 'accessory' : 'armor');
    const itemRow = (it, extra = []) => {
      const r = Inv.rarity(it), b = Inv.base(it);
      const basic = b.kind === 'weapon' ? `威力 ${b.atk}（${r.name}）` : [b.def ? `防御 ${b.def}` : '', b.hp ? `HP +${b.hp}` : '', b.crit ? `会心 +${b.crit}%` : '', b.spd ? `移動 +${b.spd}%` : ''].filter(Boolean).join(' / ') || r.name;
      return h('div', { class: 'ui-row', style: { '--rc': r.color } }, [
        h('div', { class: 'main' }, [h('div', { class: 'name' }, [Inv.name(it) + (Inv.isEquipped(s, it.uid) ? '　［装備中］' : ''), it.isNew ? h('span', { class: 'ui-new' }, 'NEW') : null]),
          h('div', { class: 'sub' }, [basic, ...it.affixes.map(a => ' / ' + Inv.affixText(a))].join(''))]),
        ...extra]);
    };
    const diffText = (sl, uid) => {
      if (kindOf(sl) === 'weapon') {
        const now = Stats.weapon(s, slotUid(sl)), nw = Stats.weapon(s, uid);
        const a = now ? now.powerMul * WEAPON_TYPE_REF[now.type] : 0, b = nw ? nw.powerMul * WEAPON_TYPE_REF[nw.type] : 0;
        const d = Math.round(b - a); return h('span', { class: d >= 0 ? 'up' : 'down' }, `威力 ${d >= 0 ? '▲+' : '▼'}${d}`);
      }
      const { before, after } = Stats.diff(s, sl, uid), parts = [];
      for (const [k, n] of [['def', '防御'], ['maxHp', 'HP'], ['crit', '会心'], ['move', '移動']]) {
        const d = after[k] - before[k]; if (d) parts.push(h('span', { class: d > 0 ? 'up' : 'down' }, `${n}${d > 0 ? '▲+' : '▼'}${d} `));
      }
      return parts.length ? h('span', {}, parts) : h('span', { class: 'ui-note' }, '変化なし');
    };
    // ---- 装備・持ち物（中央に主人公、左右に装備枠、右に持ち物のアイコン一覧） ----
    const st8 = this._home = this._home || { sel: null, cat: 'all' };
    const kindLabel = { weapon: '武器', armor: '防具', accessory: 'アクセ' };
    const firstSlot = kind => { const list = slotDefs.filter(([sl]) => kindOf(sl) === kind).map(([sl]) => sl); return list.find(sl => slotUid(sl) == null) || list[0]; };
    const basicText = it => { const b = Inv.base(it); return b.kind === 'weapon' ? `威力 ${b.atk}${b.crit ? ` / 会心 +${b.crit}%` : ''}` : [b.def ? `防御 ${b.def}` : '', b.hp ? `HP +${b.hp}` : '', b.crit ? `会心 +${b.crit}%` : '', b.spd ? `移動 +${b.spd}%` : ''].filter(Boolean).join(' / ') || '効果なし'; };
    const icon = it => h('img', { src: Town.itemIcon(Inv.base(it)), alt: '', draggable: 'false' });
    const pick = sel => () => { st8.sel = sel; Audio2.sfx('blip'); UI.render(); };
    const dollTab = el => {
      const wrap = h('div', { class: 'home' });
      // 左：主人公と装備枠
      const left = h('div', { class: 'home-left' });
      const doll = h('div', { class: 'doll' });
      const slotTile = ([sl, label], col, row) => {
        const uid = slotUid(sl), it = uid != null ? Inv.byUid(s, uid) : null, on = st8.sel && st8.sel.slot === sl;
        return h('button', { class: 'tile slot' + (on ? ' on' : '') + (it ? '' : ' empty'), style: { '--rc': it ? Inv.rarity(it).color : '#3b2d63', gridColumn: col, gridRow: row }, 'aria-label': `${label}：${it ? Inv.name(it) : 'なし'}`,
          onclick: pick({ slot: sl, uid }) }, [it ? icon(it) : h('span', { class: 'slot-label' }, label), it && it.plus ? h('span', { class: 'badge' }, '+' + it.plus) : null, h('span', { class: 'cap' }, label)]);
      };
      slotDefs.slice(0, 3).forEach((d, i) => doll.append(slotTile(d, 1, i + 1)));
      doll.append(h('div', { class: 'hero', style: { gridColumn: 2, gridRow: '1 / 4' } }, h('img', { src: Town.heroPortrait(), alt: NAMES.hero })));
      slotDefs.slice(3).forEach((d, i) => doll.append(slotTile(d, 3, i + 1)));
      left.append(doll, this.homeDetail(game, st8, { slotDefs, slotUid, kindOf, firstSlot, basicText, diffText, kindLabel }));   // 詳細は主人公の下（一覧に重ならない）
      // 右：持ち物
      const right = h('div', { class: 'home-right' });
      const cats = [['all', 'すべて'], ['weapon', '武器'], ['armor', '防具'], ['accessory', 'アクセ'], ['cons', '道具']];
      right.append(h('div', { class: 'cats', role: 'tablist' }, cats.map(([k, n]) => h('button', { class: 'cat' + (st8.cat === k ? ' on' : ''), role: 'tab', 'aria-selected': String(st8.cat === k), onclick: () => { st8.cat = k; Audio2.sfx('blip'); UI.render(); } }, n))));
      const grid = h('div', { class: 'inv-grid' });
      const order = { weapon: 0, armor: 1, accessory: 2 };
      const want = st8.sel && st8.sel.slot ? kindOf(st8.sel.slot) : null;
      if (st8.cat !== 'cons') {
        [...s.bag].filter(it => st8.cat === 'all' || Inv.slotOf(it) === st8.cat)
          .sort((x, y) => order[Inv.slotOf(x)] - order[Inv.slotOf(y)] || Inv.rarity(y).tier - Inv.rarity(x).tier)
          .forEach(it => {
            const on = st8.sel && st8.sel.uid === it.uid && !st8.sel.slot, dim = want && Inv.slotOf(it) !== want;
            grid.append(h('button', { class: 'tile' + (on ? ' on' : '') + (dim ? ' dim' : ''), style: { '--rc': Inv.rarity(it).color }, 'aria-label': Inv.name(it), onclick: pick({ uid: it.uid }) },
              [icon(it), Inv.isEquipped(s, it.uid) ? h('span', { class: 'eq' }, 'E') : null, it.isNew ? h('span', { class: 'new' }) : null, it.plus ? h('span', { class: 'badge' }, '+' + it.plus) : null]));
          });
      }
      if (st8.cat === 'all' || st8.cat === 'cons') {
        Object.keys(CONSUMABLES).filter(id => Inv.count(s, id)).forEach(id => {
          const on = st8.sel && st8.sel.cons === id;
          grid.append(h('button', { class: 'tile' + (on ? ' on' : ''), style: { '--rc': '#5a4d86' }, 'aria-label': CONSUMABLES[id].name, onclick: pick({ cons: id }) },
            [h('img', { src: Town.itemIcon({ kind: 'cons', id }), alt: '' }), h('span', { class: 'badge' }, String(Inv.count(s, id)))]));
        });
      }
      if (!grid.children.length) grid.append(h('div', { class: 'ui-note' }, 'ここには何もありません。'));
      right.append(grid, h('div', { class: 'inv-count' }, `装備品 ${s.bag.length} / ${BAG_MAX}`));
      wrap.append(left, right); el.append(wrap);
      if (s.bag.some(it => it.isNew)) { s.bag.forEach(it => { delete it.isNew; }); this.save(game); }   // 見たので NEW を外す（次に開いた時から消える）
    };
    const statusTab = el => {
      const st = Stats.calc(s), need = expNeed(s.lv);
      const box = (k, v) => h('div', { class: 'ui-stat' }, [k, h('b', {}, v)]);
      el.append(h('div', { class: 'ui-grid' }, [box('レベル', s.lv), box('経験値', `${s.exp} / ${need}`), box('最大HP', st.maxHp), box('防御', st.def),
        box('会心率', `${st.crit}%`), box('移動速度', `${st.move >= 0 ? '+' : ''}${st.move}%`), box('攻撃力（装備）', `+${st.atkPct}%`), box('所持金', `${s.gold} G`)]));
      el.append(h('div', { class: 'ui-h' }, '武器'));
      s.equip.weapons.forEach((u, i) => { const w = Stats.weapon(s, u); el.append(h('div', { class: 'ui-note' }, `武器${i + 1}：${w ? `${w.name}（威力 ×${w.powerMul.toFixed(2)}${w.element ? '・' + ELEMENTS[w.element].name + '属性' : ''}）` : 'なし'}`)); });
    };
    const saveTab = el => {
      el.append(h('button', { class: 'ui-btn', onclick: () => { this.save(game); UI.toast('保存しました'); } }, '保存する'));
      el.append(h('div', { class: 'ui-note' }, '町に戻った時や買い物の時にも自動で保存されます。iPhone の Safari は、しばらく開かないと保存データが消えることがあります。下の「書き出す」で出る文字列をメモ帳などに保管しておくと安心です。'));
      const out = h('textarea', { class: 'ui-text', readonly: true, 'aria-label': 'セーブデータの文字列' });
      el.append(h('div', { class: 'ui-h' }, '書き出し'), h('button', { class: 'ui-btn ghost', onclick: async () => {
        out.value = Save.exportCode(s); out.select();
        try { await navigator.clipboard.writeText(out.value); UI.toast('コピーしました'); } catch (e) { UI.toast('文字列を長押ししてコピーしてください'); }
      } }, '書き出してコピー'), out);
      const inp = h('textarea', { class: 'ui-text', placeholder: 'LA2: で始まる文字列を貼り付け', 'aria-label': '読み込むセーブデータ' });
      const msg = h('div', { class: 'ui-note' });
      el.append(h('div', { class: 'ui-h' }, '読み込み（今のデータは上書きされます）'), inp, h('button', { class: 'ui-btn ghost', onclick: () => {
        try { const d = Save.importCode(inp.value); Object.keys(s).forEach(k => delete s[k]); Object.assign(s, d); this.save(game); msg.textContent = '読み込みました。'; UI.toast('読み込みました'); }
        catch (e) { msg.textContent = '読み込めませんでした：' + e.message; }
      } }, '読み込む'), msg);
    };
    st8.sel = null;
    UI.open({ title: '自宅', wide: true, headRight: this.goldHead(game), tabs: [
      { label: '装備・持ち物', render: dollTab }, { label: 'ステータス', render: statusTab }, { label: 'セーブ', render: saveTab }] });
  },

  // 選んだ物の詳細と操作（装備・はずす・比較）
  homeDetail(game, st8, k) {
    const s = game.save, h = UI.h, sel = st8.sel, box = h('div', { class: 'detail' });
    const done = (msg) => { this.save(game); Audio2.sfx('pickup'); if (msg) UI.toast(msg); UI.render(); };
    if (!sel) {
      const st = Stats.calc(s);
      box.append(h('div', { class: 'd-name' }, `${NAMES.hero}　Lv ${s.lv}`),
        h('div', { class: 'd-stats' }, [`HP ${st.maxHp}`, `防御 ${st.def}`, `会心 ${st.crit}%`, `攻撃 +${st.atkPct}%`].map(t => h('span', {}, t))),
        h('div', { class: 'd-sub' }, '装備枠か持ち物のアイコンをタップしてください。'));
      return box;
    }
    if (sel.cons) {
      const c = CONSUMABLES[sel.cons];
      box.append(h('div', { class: 'd-name' }, `${c.name} ×${Inv.count(s, sel.cons)}`), h('div', { class: 'd-sub' }, c.desc + '（ダンジョンの「道具」から使えます）'));
      return box;
    }
    const it = sel.uid != null ? Inv.byUid(s, sel.uid) : null;
    if (!it) {   // 空の装備枠
      box.append(h('div', { class: 'd-name' }, `${k.slotDefs.find(d => d[0] === sel.slot)[1]}：なし`), h('div', { class: 'd-sub' }, `右の一覧から${k.kindLabel[k.kindOf(sel.slot)]}を選ぶと、ここに装備できます。`));
      return box;
    }
    const r = Inv.rarity(it), kind = Inv.slotOf(it), equipped = Inv.isEquipped(s, it.uid);
    box.style.setProperty('--rc', r.color);
    box.append(h('div', { class: 'd-name' }, [Inv.name(it), h('span', { class: 'd-rar' }, r.name)]),
      h('div', { class: 'd-sub' }, [k.basicText(it), ...it.affixes.map(a => ' / ' + Inv.affixText(a))].join('')));
    const acts = h('div', { class: 'd-acts' });
    if (equipped) {
      const sl = k.slotDefs.map(d => d[0]).find(x => k.slotUid(x) === it.uid);
      acts.append(h('button', { class: 'ui-btn ghost', onclick: () => { Inv.unequip(s, sl); st8.sel = { slot: sl, uid: null }; done(); } }, 'はずす'));
    } else {
      // 装備先：選んでいる枠があればそこ、なければ空いている枠（全部埋まっていれば1つ目）
      const targets = sel.slot && k.kindOf(sel.slot) === kind ? [sel.slot] : k.slotDefs.filter(([x]) => k.kindOf(x) === kind).map(([x]) => x);
      const main = sel.slot && k.kindOf(sel.slot) === kind ? sel.slot : k.firstSlot(kind);
      box.append(h('div', { class: 'd-cmp' }, [`${k.slotDefs.find(d => d[0] === main)[1]}と比べると：`, k.diffText(main, it.uid)]));
      targets.forEach(x => acts.append(h('button', { class: 'ui-btn' + (x === main ? '' : ' ghost'), onclick: () => { Inv.equip(s, x, it.uid); st8.sel = { slot: x, uid: it.uid }; done(); } },
        targets.length > 1 ? `${k.slotDefs.find(d => d[0] === x)[1]}へ` : '装備する')));
    }
    box.append(acts);
    return box;
  },
  // 持ち物のアイコン（武器は武器の絵、ほかは小さなドット絵）をキャッシュして返す
  _icons: {},
  itemIcon(b) {
    const key = b.id && ITEM_ICON[b.id] ? b.id : b.kind === 'weapon' ? 'w_' + b.type : b.kind === 'cons' ? 'c_' + b.id : b.kind;
    if (this._icons[key]) return this._icons[key];
    if (b.id && ITEM_ICON[b.id]) return (this._icons[key] = ITEM_ICON[b.id]);
    if (b.kind === 'cons' && b.id === 'water' && ENV.town2_i_water) return (this._icons[key] = ENV.town2_i_water);
    if (b.kind === 'weapon') return (this._icons[key] = WEAPON_ART[b.type].file);
    const c = document.createElement('canvas'); c.width = 48; c.height = 48; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    Icons.draw(x, b.kind === 'cons' ? b.id : b.kind === 'armor' ? 'armor' : 'acc', 24, 26, 2.4);
    return (this._icons[key] = c.toDataURL());
  },
  heroPortrait() {
    if (this._hero) return this._hero;
    const set = SPRITE_DATA.heroine.idle, f = set.frames[0], img = IMG[set.img];
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    c.getContext('2d').drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    return (this._hero = c.toDataURL());
  },
  // ---- コンビニ：買う・売る ----
  // 消耗品の品ぞろえ。need が true の時だけ並ぶ（進行で増える）
  SHOP_STOCK: [
    { id: 'milk' },
    { id: 'bell' },
    { id: 'bento', need: s => Town.best(s) >= 3 },
    { id: 'power', need: s => Town.best(s) >= 5 },
    { id: 'water', need: s => !!(s.dungeons.grassland || {}).cleared },        // 砂漠が開いたら
    { id: 'cooler', need: s => !!(s.dungeons.snow || {}).cleared },           // 火山が開いたら
  ],
  // 一番深く行けた「深さ」（草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40）。ショップの品ぞろえに使う
  best(s) { return Math.max(1, ...Object.entries(s.dungeons || {}).map(([id, d]) => (d.best || 0) + ((DUNGEONS[id] || {}).tier || 0) * 10)); },
  // 装備の品ぞろえ：魔界から帰るたびに入れ替わる5品。到達した階が深いほど強い物が並ぶ
  restock(s) {
    const rng = makeRng((Date.now() ^ (s.uid * 2654435761)) >>> 0), fl = Math.min(10, this.best(s));
    s.shop = { items: Array.from({ length: 5 }, () => { const it = LOOT.roll(s, rng, fl); delete it.isNew; return it; }) };
  },
  openShop(game) {
    const s = game.save, h = UI.h;
    const buyTab = el => {
      el.append(h('div', { class: 'ui-h' }, '消耗品'));
      for (const { id, need } of this.SHOP_STOCK) {
        if (need && !need(s)) continue;
        const c = CONSUMABLES[id], have = Inv.count(s, id), can = s.gold >= c.price && have < c.max;
        el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, c.name), h('div', { class: 'sub' }, `${c.desc}（所持 ${have} / ${c.max}）`)]), h('div', { class: 'price' }, `${c.price} G`),
          h('button', { class: 'ui-btn', disabled: !can, onclick: () => { s.gold -= c.price; Inv.addItem(s, id, 1); this.save(game); Audio2.sfx('pickup'); UI.render(); } }, '買う')]));
      }
      if (!s.shop) { this.restock(s); this.save(game); }
      el.append(h('div', { class: 'ui-h' }, '装備品（魔界から帰るたびに入れ替わります）'));
      if (!s.shop.items.length) el.append(h('div', { class: 'ui-note' }, '売り切れ。次の入荷をお待ちください。'));
      s.shop.items.forEach((it, i) => {
        const b = Inv.base(it), r = Inv.rarity(it), price = Inv.buyPrice(it), can = s.gold >= price && s.bag.length < BAG_MAX;
        const basic = b.kind === 'weapon' ? `威力 ${b.atk}` : [b.def ? `防御 ${b.def}` : '', b.hp ? `HP +${b.hp}` : '', b.crit ? `会心 +${b.crit}%` : '', b.spd ? `移動 +${b.spd}%` : ''].filter(Boolean).join(' / ');
        el.append(h('div', { class: 'ui-row', style: { '--rc': r.color } }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, Inv.name(it)), h('div', { class: 'sub' }, [`${r.name}・${basic}`, ...it.affixes.map(a => ' / ' + Inv.affixText(a))].join(''))]), h('div', { class: 'price' }, `${price} G`),
          h('button', { class: 'ui-btn', disabled: !can, onclick: () => { s.gold -= price; s.shop.items.splice(i, 1); it.uid = s.uid++; it.isNew = true; Inv.add(s, it); this.save(game); Audio2.sfx('pickup'); UI.toast(`${b.name}を買いました（自宅で装備できます）`); UI.render(); } }, '買う')]));
      });
    };
    const sellTab = el => {
      const list = s.bag.filter(it => !Inv.isEquipped(s, it.uid));
      el.append(h('div', { class: 'ui-note' }, '装備中の物は売れません。'));
      if (!list.length) el.append(h('div', { class: 'ui-note' }, '売れる物がありません。'));
      for (const it of list) {
        const r = Inv.rarity(it), p = Inv.sellPrice(it);
        el.append(h('div', { class: 'ui-row', style: { '--rc': r.color } }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, Inv.name(it)), h('div', { class: 'sub' }, [r.name, ...it.affixes.map(a => ' / ' + Inv.affixText(a))].join(''))]),
          h('button', { class: 'ui-btn ghost', onclick: () => { Inv.remove(s, it.uid); s.gold += p; this.save(game); Audio2.sfx('pickup'); UI.render(); } }, `売る ${p} G`)]));
      }
    };
    UI.open({ title: 'コンビニ', headRight: this.goldHead(game), tabs: [{ label: '買う', render: buyTab }, { label: '売る', render: sellTab }] });
  },

  // ---- 学校の屋上：魔界へ出発（ダンジョンは次の段階で実装：仮） ----
  openGate(game) {
    const s = game.save, h = UI.h;
    const list = [['grassland', '草原'], ['desert', '砂漠'], ['snow', '雪原'], ['volcano', '火山'], ['castle', '魔王城']];
    const endlessTab = el => {
      const open = (s.dungeons.snow || {}).cleared, d = s.dungeons.endless || {};
      el.append(h('div', { class: 'ui-note' }, open ? `どこまでも続く魔界。5階ごとに景色が変わり、深くなるほど敵が強く、「＋」付きの強い装備が手に入る。5階ごとに町へ戻れる。最高記録：${d.best || 0}階` : '雪原をクリアすると挑戦できます。'));
      el.append(h('button', { class: 'ui-btn', disabled: !open, onclick: () => game.departDungeon('endless', 1) }, '1階から挑む'));
    };
    const rushTab = el => {
      const open = (s.dungeons.volcano || {}).cleared, rec = s.bossrush || {};
      el.append(h('div', { class: 'ui-note' }, open ? 'ボスと5連戦。5回勝てばクリア。超級・地獄級はエンドレスの「＋」装備が必要な難しさです。' : '火山をクリアすると挑戦できます。'));
      BOSSRUSH.LEVELS.forEach((Lv, i) => {
        const can = open && (i === 0 || rec[BOSSRUSH.LEVELS[i - 1].id]);
        el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, Lv.name), h('div', { class: 'sub' }, !open ? '？？？' : can ? (rec[Lv.id] ? `制覇 ${rec[Lv.id]}回` : '未制覇') : '前の難易度を制覇すると挑戦できます')]),
          h('button', { class: 'ui-btn', disabled: !can, onclick: () => game.departDungeon('bossrush', 1, { diff: i }) }, '挑む')]));
      });
    };
    UI.open({ title: '魔界へのゲート', tabs: [{ label: 'ダンジョン', render: el => {
      el.append(h('div', { class: 'ui-note' }, '行き先と開始階を選んでください。'));
      list.forEach(([id, name], i) => {
        const open = i === 0 || (s.dungeons[list[i - 1][0]] || {}).cleared;
        const d = s.dungeons[id] || {};
        const start = f => () => game.departDungeon ? game.departDungeon(id, f) : UI.toast('魔界のダンジョンは次の段階で実装します（仮）');
        el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, open ? name : '？？？'), h('div', { class: 'sub' }, open ? `最高到達 ${d.best || 0} 階${d.cleared ? '・クリア済み' : ''}` : '前のダンジョンをクリアすると行けます')]),
          h('button', { class: 'ui-btn', disabled: !open, onclick: start(1) }, '1階から'),
          h('button', { class: 'ui-btn ghost', disabled: !open || !(d.checkpoint >= 6), onclick: start(6) }, '6階から')]));
      });
    } }, { label: 'エンドレス', render: endlessTab }, { label: 'ボスラッシュ', render: rushTab }] });
  },
};
