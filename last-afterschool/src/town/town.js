// =====================================================================
//  現世の町（歩き回れる拠点）
//  ・施設・人は TOWN.facilities に並べる。増やす時はここに足して interact に分岐を書く
//  ・メニューは UI（HTML の重ね表示）。データの変更後は Save.store で保存する
// =====================================================================
NAMES.town = '宵ヶ丘';   // 町の名前（仮）

const TOWN = {
  id: 'town', town: true, title: '現世', sub: `${NAMES.town}の町`, bg: 'town', bgm: 'morning', length: 2600,
  loadout: { weapons: [], fire: false, partner: true, canFight: false },
  intro: [], events: [], endX: 99999, outro: [],
  facilities: [
    { id: 'home',  x: 300,  name: '自宅' },
    { id: 'shop',  x: 860,  name: 'コンビニ' },
    { id: 'smith', x: 1380, name: '鍛冶屋' },
    { id: 'mio',   x: 1760, name: NAMES.friend, npc: true },
    { id: 'gate',  x: 2300, name: '学校の屋上' },
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
    for (const f of TOWN.facilities) {
      const x = f.x - cam;
      if (x < -200 || x > VIEW_W + 200) continue;
      if (f.id === 'home') {
        R('#e8d8e2', x - 110, G - 190, 220, 190); ctx.fillStyle = '#7c5f8d';
        ctx.beginPath(); ctx.moveTo(x - 130, G - 190); ctx.lineTo(x, G - 260); ctx.lineTo(x + 130, G - 190); ctx.fill();
        R('#ffd9a0', x - 85, G - 160, 44, 36); R('#ffd9a0', x + 41, G - 160, 44, 36);
        R('#6d5248', x - 22, G - 92, 44, 92); R('#d8b080', x + 12, G - 50, 5, 5);
        sign(x, G - 205, '自宅');
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
        ctx.font = `14px ${FONT}`; ctx.fillStyle = '#ffd6e6'; ctx.textAlign = 'center'; ctx.fillText(NAMES.friend, x, G - 170); ctx.textAlign = 'left';
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
    }
    // 近くの施設の上に「しらべる」
    if (W.nearFac && !W.dialogue) {
      const f = W.nearFac, x = f.x - cam, y = GROUND_Y - (f.npc ? 200 : 300) + Math.sin(t * 5) * 4;
      ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe27a';
      ctx.strokeStyle = '#1a0f2a'; ctx.lineWidth = 4; const s = IS_TOUCH ? '▼ しらべる' : '▼ ↓ しらべる';
      ctx.strokeText(s, x, y); ctx.fillText(s, x, y); ctx.textAlign = 'left';
    }
  },
  // 友人ミオ：専用の絵がまだないので、主人公の待機絵を暗い色に染めた仮の姿（仮実装）
  _mio: null,
  drawMio(ctx, x, G, t) {
    const set = SPRITE_DATA.heroine.idle, f = set.frames[0], img = IMG[set.img];
    if (!img || !img.width) return;
    if (!this._mio) {
      const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const x2 = c.getContext('2d');
      x2.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = 'rgba(60,40,70,.55)'; x2.fillRect(0, 0, f.w, f.h);
      this._mio = c;
    }
    const sc = set.scale, bob = Math.sin(t * 2) * 1.5;
    ctx.save(); ctx.translate(Math.round(x), Math.round(G)); ctx.scale(-1, 1);
    ctx.drawImage(this._mio, -f.ax * sc, -f.ay * sc + bob, f.w * sc, f.h * sc); ctx.restore();
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
      L('friend', `あ、{hero}！ 学校、しばらく休校だって。`),
      L('friend', 'ねえ、最近ちょっと疲れた顔してない？'),
      L('hero', 'ううん、大丈夫。', 'default'),
      L('friend', '無理しないでね。駅前のクレープ、また一緒に行こ？ 約束だよ。'),
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
    const equipTab = el => {
      el.append(h('div', { class: 'ui-note' }, '枠をタップすると、付け替えられる装備が出ます。武器1〜3は戦闘中に「武器」ボタンで切り替え。'));
      for (const [sl, label] of slotDefs) {
        const uid = slotUid(sl), it = uid != null ? Inv.byUid(s, uid) : null;
        const row = it ? itemRow(it) : h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name', style: { color: '#7d72a0' } }, '（なし）')])]);
        row.prepend(h('div', { class: 'slot' }, label));
        row.classList.toggle('sel', selSlot === sl);
        row.addEventListener('click', () => { selSlot = selSlot === sl ? null : sl; Audio2.sfx('blip'); UI.render(); });
        el.append(row);
        if (selSlot === sl) {
          const cands = s.bag.filter(c => Inv.slotOf(c) === kindOf(sl) && c.uid !== uid);
          if (it) el.append(h('button', { class: 'ui-btn ghost', onclick: () => { Inv.unequip(s, sl); this.save(game); selSlot = null; UI.render(); } }, 'はずす'));
          if (!cands.length) el.append(h('div', { class: 'ui-note' }, '付け替えられる装備がありません。'));
          for (const c of cands) el.append(itemRow(c, [diffText(sl, c.uid), h('button', { class: 'ui-btn', onclick: e => { e.stopPropagation(); Inv.equip(s, sl, c.uid); this.save(game); Audio2.sfx('pickup'); selSlot = null; UI.render(); } }, '装備')]));
        }
      }
    };
    const bagTab = el => {
      el.append(h('div', { class: 'ui-h' }, `装備品（${s.bag.length} / ${BAG_MAX}）`));
      const order = { weapon: 0, armor: 1, accessory: 2 };
      [...s.bag].sort((a, b) => order[Inv.slotOf(a)] - order[Inv.slotOf(b)] || Inv.rarity(b).tier - Inv.rarity(a).tier).forEach(it => el.append(itemRow(it)));
      // 一覧で見たので「NEW」を外す（表示は次に開いた時から消える）
      if (s.bag.some(it => it.isNew)) { s.bag.forEach(it => { delete it.isNew; }); this.save(game); }
      el.append(h('div', { class: 'ui-h' }, '消耗品'));
      const ids = Object.keys(CONSUMABLES).filter(id => Inv.count(s, id));
      if (!ids.length) el.append(h('div', { class: 'ui-note' }, 'なし'));
      ids.forEach(id => el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, `${CONSUMABLES[id].name} ×${Inv.count(s, id)}`), h('div', { class: 'sub' }, CONSUMABLES[id].desc)])])));
    };
    const statusTab = el => {
      const st = Stats.calc(s), need = 20 + s.lv * 15;
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
    UI.open({ title: '自宅', headRight: this.goldHead(game), tabs: [
      { label: '装備', render: equipTab }, { label: '持ち物', render: bagTab }, { label: 'ステータス', render: statusTab }, { label: 'セーブ', render: saveTab }] });
  },

  // ---- コンビニ：買う・売る ----
  SHOP_STOCK: ['milk', 'bento', 'water', 'cooler', 'bell'],
  SHOP_EQUIP: ['a_jersey', 'c_hairpin', 'c_ribbon', 'w_bat_pipe', 'w_chair_pipe'],   // 仮の品ぞろえ（進行で増やす予定）
  openShop(game) {
    const s = game.save, h = UI.h;
    const buyTab = el => {
      el.append(h('div', { class: 'ui-h' }, '消耗品'));
      for (const id of this.SHOP_STOCK) {
        const c = CONSUMABLES[id], have = Inv.count(s, id), can = s.gold >= c.price && have < c.max;
        el.append(h('div', { class: 'ui-row' }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, `${c.name}　${c.price} G`), h('div', { class: 'sub' }, `${c.desc}（所持 ${have} / ${c.max}）`)]),
          h('button', { class: 'ui-btn', disabled: !can, onclick: () => { s.gold -= c.price; Inv.addItem(s, id, 1); this.save(game); Audio2.sfx('pickup'); UI.render(); } }, '買う')]));
      }
      el.append(h('div', { class: 'ui-h' }, '装備品'));
      for (const id of this.SHOP_EQUIP) {
        const b = ITEM_BASES[id], can = s.gold >= b.price && s.bag.length < BAG_MAX;
        const desc = b.kind === 'weapon' ? `威力 ${b.atk}` : [b.def ? `防御 ${b.def}` : '', b.hp ? `HP +${b.hp}` : '', b.crit ? `会心 +${b.crit}%` : '', b.spd ? `移動 +${b.spd}%` : ''].filter(Boolean).join(' / ');
        el.append(h('div', { class: 'ui-row', style: { '--rc': RARITY_BY_ID.common.color } }, [h('div', { class: 'main' }, [h('div', { class: 'name' }, `${b.name}　${b.price} G`), h('div', { class: 'sub' }, desc)]),
          h('button', { class: 'ui-btn', disabled: !can, onclick: () => { s.gold -= b.price; Inv.add(s, Inv.make(s, id, 'common')); this.save(game); Audio2.sfx('pickup'); UI.toast(`${b.name}を買いました（自宅で装備できます）`); UI.render(); } }, '買う')]));
      }
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
    } }] });
  },
};
