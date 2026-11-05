// =====================================================================
//  バランスの試算（node tools/balance_sim.js）→ docs/BALANCE.md に表を書き出す
//  ゲームと同じ式（src/data/balance.js・items.js・dungeons.js）を読み込んで計算する
//  モデル：一撃の基準 15（BAL.REF_HIT）を毎秒 2 回、会心 10%（×1.5）。
//          装備：前のダンジョンのレア（v1.15）/ 前のレジェンド（v1.3）/ 今のコモン（v1.0）/ 今のレア（v1.15）
// =====================================================================
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, Set, Map, Error, document: { createElement: () => ({ getContext: () => ({}) }) }, window: {}, navigator: { userAgent: '' }, localStorage: { getItem() {}, setItem() {} }, Image: class {}, performance: { now: () => 0 } };
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8').replace(/^(const|let|class) (\w+)/gm, (m, k, n) => k === 'class' ? `var ${n} = class ${n}` : `var ${n}`), ctx, { filename: f });
for (const f of ['src/config.js', 'src/data/balance.js', 'src/data/items.js', 'src/data/dungeons.js']) load(f);
const { BAL, DUNGEONS, ENEMIES, ITEM_BASES } = vm.runInContext('({ BAL, DUNGEONS, ENEMIES, ITEM_BASES })', ctx);

const HPS = 2, CRIT = 1 + 0.1 * 0.5, IDS = ['grassland', 'desert', 'snow', 'volcano', 'castle'], NAMES = ['草原', '砂漠', '雪原', '火山', '魔王城'];
const R = BAL.RARITY_MUL;
const gear = (t, v, r) => (t < 0 ? 0.75 : Math.pow(BAL.TP, t)) * v * R[r];   // t<0 は初期装備（素手に近い）
const lvMul = d => 1 + BAL.LV_ATK * (BAL.expLv(d) - 1);
const hitDmg = (d, g, def) => BAL.applyDef(BAL.REF_HIT * g * lvMul(d) * CRIT, def);
const dz = (id, f) => { let D = DUNGEONS[id]; const Z = D.zones && D.zones.find(z => f <= z.upTo); return Z ? Object.assign({}, D, Z) : D; };
const avgFoe = (D, f, k) => { const t = D.foes(f); const tw = t.reduce((a, x) => a + x[1], 0); return t.reduce((a, [id, w]) => a + ENEMIES[id][k] * w, 0) / tw; };
// 防具：その段で一番良い防具＋アクセ（アンコモン相当）
const armorOf = t => {
  if (t < 0) return { def: 0, hp: 0 };
  const best = k => Object.values(ITEM_BASES).filter(b => b.kind === k && b.minFloor < 99 && BAL.tier(Math.max(1, b.minFloor)) <= t).sort((a, b) => b.def - a.def)[0] || { def: 0, hp: 0 };
  const a = best('armor'), c = best('acc');
  return { def: Math.round(((a.def || 0) + (c.def || 0)) * R[1]), hp: Math.round(((a.hp || 0) + (c.hp || 0)) * R[1]) };
};
const pHp = (d, arm) => 100 + (BAL.expLv(d) - 1) * BAL.LV_HP + arm.hp;
const taken = (raw, d, arm) => raw * BAL.enemy(d).dmgMul * 100 / (100 + arm.def);

let md = `# バランス試算（自動生成：node tools/balance_sim.js）\n\n`;
md += `数式は \`src/data/balance.js\`。この表はゲームと同じ式・同じデータから計算している。\n\n`;
md += `## 考え方\n`;
md += `- ダンジョン（段）が1つ進むと、敵の強さも装備の威力も **×${BAL.TP}**。ダンジョン内でも1階→10階で約1.75倍に上がる（ramp）。\n`;
md += `- 敵には**防御**がある：その深さで想定する一撃の ${BAL.DEF * 100}% を差し引く（下限：元の ${BAL.MIN_DMG * 100}%＝旧装備でも0にはならない）。\n`;
md += `  → 威力の低い古い装備ほど大きく削られる。HPを増やすだけの調整ではなく「防御」で装備更新の差を作る。\n`;
md += `- レベルの伸びは控えめ（攻撃 +${BAL.LV_ATK * 100}%/Lv・HP +${BAL.LV_HP}/Lv）。想定レベル分は敵にも上乗せ（lvComp）し、レベル上げだけで押し切れないようにする。\n`;
md += `- 敵の攻撃は段ごとに ×1.75、行動の速さ（攻撃間隔・予備動作）も段ごとに +12%。強化個体は HP×${BAL.ELITE.hp}・攻撃×${BAL.ELITE.dmg}・行動 +${BAL.ELITE.agg * 100}%、装備を必ず落とす。\n`;
md += `- 敵の素の数値はダンジョンごとに違うので、草原の平均（HP ${BAL.REF_FOE.hp}・攻撃 ${BAL.REF_FOE.dmg}）にそろえてから倍率を掛ける（硬い敵・柔らかい敵の差は残る）。\n\n`;
md += `モデル：一撃 ${BAL.REF_HIT}（攻撃モーションの平均）を毎秒 ${HPS} 回・会心 10%。装備の v は同じ段の中での差（1.0〜1.3）。レアリティ倍率 ${R.join(' / ')}。\n\n`;

md += `## 1. 通常の敵を倒すまでの時間（秒）\n\n`;
md += `「前段レア」＝1つ前のダンジョンのレア武器（v1.15）、「前段レジェ」＝前のダンジョンのレジェンド最上位（v1.3）、「今コモン」＝このダンジョンのコモン（v1.0）、「今レア」＝このダンジョンのレア（v1.15）。\n\n`;
md += `| ダンジョン | 階 | 敵HP | 防御 | 前段レア | 前段レジェ | 今コモン | 今レア | 判定 |\n|---|---|---|---|---|---|---|---|---|\n`;
const rows = [];
for (let t = 0; t < 5; t++) for (const f of [1, 2, 3, 5, 8, 10]) {
  const d = t * 10 + f, D = dz(IDS[t], f), S = BAL.enemy(d), norm = BAL.foeNorm(D);
  const hp = avgFoe(D, f, 'hp') * S.hpMul * norm.hp, def = S.def;
  const ttk = g => hp / hitDmg(d, g, def) / HPS;
  const pr = ttk(gear(t - 1, 1.15, 2)), pl = ttk(gear(t - 1, 1.3, 4)), cc = ttk(gear(t, 1.0, 0)), cr = ttk(gear(t, 1.15, 2));
  const verdict = t === 0 ? '—' : f <= 2 ? (pr < 4 ? '前の装備で進める' : '要注意') : f <= 3 ? (pr > cc * 1.5 ? '更新したくなる' : '差が小さい') : (pr > cr * 2 ? '新装備が中心' : '差が小さい');
  rows.push({ t, f, pr, cc });
  md += `| ${NAMES[t]} | ${f} | ${hp.toFixed(0)} | ${def.toFixed(1)} | ${t ? pr.toFixed(1) : '—'} | ${t ? pl.toFixed(1) : '—'} | ${cc.toFixed(1)} | ${cr.toFixed(1)} | ${verdict} |\n`;
}
md += `\n読み方：1〜2階は前のダンジョンの装備でも数秒で倒せる。3階あたりで前段レアが今コモンの1.5倍以上かかり、4〜5階以降は2倍以上の差がつく（＝新装備が中心）。旧装備でも防御の下限があるので、0ダメージにはならない。\n\n`;

md += `## 2. ボスを倒すまでの時間（秒、通常攻撃のみ。必殺・BREAK・属性は含まない）\n\n`;
md += `| ダンジョン | 階 | ボス | HP | 防御 | 前段レア | 今レア | 今レア＋ボス武器相当（v1.4） |\n|---|---|---|---|---|---|---|---|\n`;
for (let t = 0; t < 5; t++) for (const f of [5, 10]) {
  const d = t * 10 + f, D = dz(IDS[t], f), type = D.bosses[f], s = BAL.bossScale(d, f, type), hp = ENEMIES[type].hp * s.hpMul;
  const ttk = g => hp / hitDmg(d, g, s.def) / HPS;
  md += `| ${NAMES[t]} | ${f} | ${ENEMIES[type].name} | ${hp.toFixed(0)} | ${s.def.toFixed(1)} | ${t ? ttk(gear(t - 1, 1.15, 2)).toFixed(0) : '—'} | ${ttk(gear(t, 1.15, 2)).toFixed(0)} | ${ttk(gear(t, 1.4, 2)).toFixed(0)} |\n`;
}
md += `\n5階のボスは今のダンジョンの武器を必ず落とし、10階のボスは専用武器（v1.4前後）を落とす。\n\n`;

md += `## 3. 受けるダメージ（通常の敵の接触1回）\n\n`;
md += `| ダンジョン | 階 | 想定Lv | 前段の防具 | 今の防具 | 最大HP(今) | 何回で倒れるか（前段→今） |\n|---|---|---|---|---|---|---|\n`;
for (let t = 0; t < 5; t++) for (const f of [1, 5, 10]) {
  const d = t * 10 + f, raw = BAL.REF_FOE.dmg, prev = armorOf(t - 1), cur = armorOf(t);
  const a = taken(raw, d, prev), b = taken(raw, d, cur);
  md += `| ${NAMES[t]} | ${f} | ${BAL.expLv(d).toFixed(0)} | ${a.toFixed(0)}（防${prev.def}） | ${b.toFixed(0)}（防${cur.def}） | ${pHp(d, cur).toFixed(0)} | ${(pHp(d, prev) / a).toFixed(1)} → ${(pHp(d, cur) / b).toFixed(1)} |\n`;
}
md += `\n強化個体は ×${BAL.ELITE.dmg}、ボスの技は種類ごとの値×同じ倍率。ガードで30%に減る。\n\n`;

md += `## 4. 武器の威力（攻撃力。レアリティ倍率をかける前）\n\n| 段 | バット | 椅子 | 机 | 短剣 | 剣 | 斧 |\n|---|---|---|---|---|---|---|\n`;
for (let t = 0; t < 5; t++) md += `| ${NAMES[t]} | ${['bat', 'chair', 'desk', 'dagger', 'sword', 'axe'].map(k => { const v = Object.values(ITEM_BASES).filter(b => b.kind === 'weapon' && b.type === k && b.tier === t && b.minFloor < 99).map(b => b.atk); return v.length ? `${Math.min(...v)}〜${Math.max(...v)}` : '—'; }).join(' | ')} |\n`;
md += `\n## 5. ドロップ\n- 通常の敵：${LOOT_TEXT()}\n`;
function LOOT_TEXT() { return '6%で装備（8割は今のダンジョンの段、2割は1つ前の段）。強化個体は必ず（アンコモン以上）'; }
md += `- 1階の最初の部屋：**補給の宝箱**（今のダンジョンの武器が必ず入る＝ドロップ運で進めなくなることはない）\n`;
md += `- 5階ボス：今のダンジョンの武器（アンコモン以上）＋2個。10階ボス：ボス専用武器（レア以上・25%でレジェンド）＋1個\n`;
md += `- レアリティの出やすさはダンジョン内の階で決まる（ダンジョンが変わるたびに装備集めがやり直しになる）\n\n`;
md += `## 6. 属性と環境（進行に必要な属性は、必ずその手前に「源」がある）\n\n| ダンジョン | 進むのに必要 | 源 | ほかのギミック |\n|---|---|---|---|\n`;
md += `| 草原 | 草のつるの壁（炎） | たき火 | 動く床・崩れる足場・いばら（炎で焼ける）・背の高い草（敵が隠れる）・キノコのばね・岩の下の宝箱 |\n`;
md += `| 砂漠 | 砂の壁（砂） | サボテン（叩く） | 崩れる足場・流砂（遅い・跳べない）・砂嵐（向かい風と視界）・砂山の宝箱・オアシス |\n`;
md += `| 雪原 | 雪山の壁（炎）・水の穴（氷で凍らせる） | たき火・氷晶 | 氷の床（滑る）・深雪（遅い・跳びにくい）・つらら・氷塊の宝箱（炎で一撃） |\n`;
md += `| 火山 | 溶岩の岩（氷）・溶岩の穴（氷で冷やす） | 冷気の噴出口（何度でも） | 制限時間・噴き出す床・崩れる足場・ボスの攻撃で足場が壊れる |\n`;
md += `| 魔王城 | 外：瓦礫の壁（何でも）／中：封印の扉（燭台を全部灯す） | 燭台 | 落とし格子・闇の噴出・強化個体の見張り・ボスの攻撃で足場が壊れる |\n\n`;
md += `検証：生成した全ダンジョン×10階×数百シードで、出口まで届くか・属性の壁の手前に源があるかを調べている（源を消すと必ず「到達不可」になることも確認）。\n`;
fs.writeFileSync(path.join(root, 'docs/BALANCE.md'), md);
// 自己チェック：1〜2階は前の装備で4秒未満、5階以降は前段レアが今コモンより遅い
const bad = rows.filter(r => r.t > 0 && ((r.f <= 2 && r.pr >= 4) || (r.f >= 5 && r.pr < r.cc)));
console.log(md.split('\n').slice(0, 60).join('\n'));
console.log(bad.length ? 'CHECK NG ' + JSON.stringify(bad) : 'CHECK OK');
