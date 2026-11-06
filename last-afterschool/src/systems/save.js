// =====================================================================
//  セーブ v2（localStorage・1つの JSON）
//  ・旧セーブ（v1：{ unlocked, lv, exp }）は自動で v2 に移す。プロローグの進行は消えない
//  ・プロローグが使う unlocked / lv / exp はトップレベルにそのまま置く（既存コードとの互換）
//  ・書き出し／読み込み：iOS Safari で保存データが消えた時の備え
// =====================================================================
const Save = {
  key: 'last-afterschool-save-v2',
  oldKey: 'last-afterschool-save-v1',
  fresh() {
    return {
      v: 2, unlocked: 0, lv: 1, exp: 0,
      main: false,            // 本編（町）に入ったか
      gold: 0, uid: 1,
      bag: [],                // 装備品の個体データ
      equip: { weapons: [null, null, null], armor: null, acc: [null, null], partner: null },  // bag の uid
      items: {},              // 消耗品 { id: 個数 }
      dungeons: {},           // { grassland: { best: 0, checkpoint: 1, cleared: false } }
      hp: null,               // 町に戻った時の HP（null＝満タン）
      flags: {},              // 会話・初回イベントの既読など
    };
  },
  migrate(d) {
    if (!d || typeof d !== 'object') return this.fresh();
    if (d.v === 2) return Object.assign(this.fresh(), d, { equip: Object.assign(this.fresh().equip, d.equip || {}) });
    // v1 → v2
    return Object.assign(this.fresh(), { unlocked: d.unlocked || 0, lv: d.lv || 1, exp: d.exp || 0 });
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key) || localStorage.getItem(this.oldKey);
      return this.migrate(raw ? JSON.parse(raw) : null);
    } catch (e) { return this.fresh(); }
  },
  store(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
  // 書き出し：コピーして保管できる文字列（日本語を含むので UTF-8 → base64）
  exportCode(d) { return 'LA2:' + btoa(unescape(encodeURIComponent(JSON.stringify(d)))); },
  importCode(code) {
    const s = String(code || '').trim();
    if (!s.startsWith('LA2:')) throw new Error('セーブデータの文字列ではありません');
    return this.migrate(JSON.parse(decodeURIComponent(escape(atob(s.slice(4))))));
  },
};
