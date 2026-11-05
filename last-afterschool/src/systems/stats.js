// =====================================================================
//  ステータス計算：レベル＋装備 → 最終ステータス
//  ・攻撃の倍率 atkMul は、今の攻撃計算（武器の当たり × Lv倍率）にさらに掛ける
//  ・被ダメージ ＝ 敵の攻撃 × 100 ÷（100＋防御）
// =====================================================================
const Stats = {
  // 装備中の武器1本の性能（攻撃倍率・属性・攻撃速度など）
  weapon(s, uid) {
    const it = uid != null ? Inv.byUid(s, uid) : null;
    if (!it) return null;
    const b = Inv.base(it), r = Inv.rarity(it);
    const out = { uid, type: b.type, name: Inv.name(it), rarity: r, powerMul: (b.atk / WEAPON_TYPE_REF[b.type]) * r.mul, crit: b.crit || 0, element: b.element || null,
      atkPct: 0, aspd: 0, steal: 0, spcost: 0 };   // この武器を持っている時だけ効く付与効果
    for (const a of it.affixes) {
      const d = AFFIX_BY_ID[a.k]; if (!d) continue;
      if (d.element) out.element = d.element;
      else if (a.k === 'atk') out.atkPct += a.v; else if (a.k in out) out[a.k] += a.v;
    }
    return out;
  },
  calc(s) {
    const lv = s.lv || 1;
    const st = { lv, maxHp: 100 + (lv - 1) * 8, atkPct: 0, aspd: 0, crit: 10, def: 0, move: 0, steal: 0, spcost: 0 };
    const worn = [s.equip.armor, ...s.equip.acc, ...s.equip.weapons].map(u => (u != null ? Inv.byUid(s, u) : null)).filter(Boolean);
    for (const it of worn) {
      const b = Inv.base(it), isWeapon = b.kind === 'weapon';
      if (!isWeapon) { st.def += b.def || 0; st.maxHp += b.hp || 0; st.crit += b.crit || 0; st.move += b.spd || 0; }
      for (const a of it.affixes) {
        if (isWeapon && ['atk', 'aspd', 'crit', 'steal', 'spcost'].includes(a.k)) continue;  // 武器の攻撃系は持っている時だけ（戦闘側で加算）
        if (a.k === 'atk') st.atkPct += a.v; else if (a.k in st) st[a.k] += a.v;
      }
    }
    return st;
  },
  // 比較表示用：装備を差し替えた時の数値の差
  diff(s, slot, uid) {
    const before = this.calc(s), tmp = JSON.parse(JSON.stringify(s));
    if (uid == null) Inv.unequip(tmp, slot); else Inv.equip(tmp, slot, uid);
    const after = this.calc(tmp);
    return { before, after };
  },
};
