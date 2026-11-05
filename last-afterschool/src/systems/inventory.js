// =====================================================================
//  所持品・装備・ゴールド（セーブデータ s を直接操作する小さな関数群）
// =====================================================================
const BAG_MAX = 30;   // 装備品の所持上限（仮）

const Inv = {
  base(it) { return ITEM_BASES[it.base]; },
  rarity(it) { return RARITY_BY_ID[it.rarity] || RARITY_BY_ID.common; },
  slotOf(it) { return this.base(it).kind; },               // weapon / armor / accessory
  name(it) { return this.base(it).name + (it.plus ? ` +${it.plus}` : ''); },

  // 個体を作る（ドロップ・宝箱・ショップ用）。rng はシードつき乱数
  make(s, baseId, rarityId, rng = makeRng(Date.now())) {
    const b = ITEM_BASES[baseId], r = RARITY_BY_ID[rarityId] || RARITY_BY_ID.common;
    const pool = AFFIXES.filter(a => a.slots.includes(b.kind));
    const affixes = [];
    for (let i = 0; i < r.affixes && pool.length; i++) {
      const a = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
      if (a.element && affixes.some(x => AFFIX_BY_ID[x.k].element)) { i--; continue; }  // 属性は1つまで
      const k = rng.next() ** (1 / (1 + r.tier * 0.4));           // 上のレアリティほど高い値が出やすい
      affixes.push({ k: a.id, v: Math.round(a.roll[0] + (a.roll[1] - a.roll[0]) * k) });
    }
    return { uid: s.uid++, base: baseId, rarity: r.id, plus: 0, affixes };
  },
  add(s, it) {
    if (s.bag.length >= BAG_MAX) return false;
    if (!it.uid) it.uid = s.uid++;
    s.bag.push(it); return true;
  },
  byUid(s, uid) { return s.bag.find(i => i.uid === uid) || null; },
  isEquipped(s, uid) { const e = s.equip; return e.weapons.includes(uid) || e.armor === uid || e.acc.includes(uid); },
  // 装備する：slot は 'weapon:0' / 'armor' / 'acc:1' など
  equip(s, slot, uid) {
    const [kind, idx] = slot.split(':');
    // 同じ物が別の枠に付いていたら外す
    s.equip.weapons = s.equip.weapons.map(u => (u === uid ? null : u));
    s.equip.acc = s.equip.acc.map(u => (u === uid ? null : u));
    if (s.equip.armor === uid) s.equip.armor = null;
    if (kind === 'weapon') s.equip.weapons[+idx] = uid;
    else if (kind === 'acc') s.equip.acc[+idx] = uid;
    else s.equip.armor = uid;
  },
  unequip(s, slot) {
    const [kind, idx] = slot.split(':');
    if (kind === 'weapon') s.equip.weapons[+idx] = null; else if (kind === 'acc') s.equip.acc[+idx] = null; else s.equip.armor = null;
  },
  remove(s, uid) {
    if (this.isEquipped(s, uid)) return false;
    s.bag = s.bag.filter(i => i.uid !== uid); return true;
  },
  // ショップでの値段（レアリティと付与効果の数で上がる）
  buyPrice(it) { return Math.round((this.base(it).price || 40) * this.rarity(it).mul * (1 + it.affixes.length * 0.35) * (1 + this.rarity(it).tier * 0.25)); },
  sellPrice(it) { return Math.max(1, Math.round((this.base(it).price || 20) * 0.3 * this.rarity(it).mul * (1 + it.affixes.length * 0.25))); },
  // 消耗品
  count(s, id) { return s.items[id] || 0; },
  addItem(s, id, n = 1) { const max = CONSUMABLES[id].max; const have = this.count(s, id); const add = Math.min(n, max - have); s.items[id] = have + add; return add; },
  useItem(s, id) { if (!this.count(s, id)) return false; s.items[id]--; return true; },
  // 付与効果の文字（例：攻撃力 +12%）
  affixText(a) { const d = AFFIX_BY_ID[a.k]; if (!d) return a.k; return d.element ? `${d.name}が付く` : `${d.name} +${a.v}${d.unit}`; },
  // 本編開始時の持ち物
  giveStarter(s) {
    s.gold += STARTER_KIT.gold;
    for (const [id, n] of Object.entries(STARTER_KIT.items)) this.addItem(s, id, n);
    const its = STARTER_KIT.bag.map(t => Object.assign({ uid: s.uid++, plus: 0 }, JSON.parse(JSON.stringify(t))));
    its.forEach(it => s.bag.push(it));
    s.equip.weapons = its.filter(i => this.slotOf(i) === 'weapon').map(i => i.uid).slice(0, 3);
    s.equip.armor = (its.find(i => this.slotOf(i) === 'armor') || {}).uid || null;
  },
};
