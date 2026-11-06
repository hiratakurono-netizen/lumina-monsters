// =====================================================================
//  セーブ v2（localStorage・1つの JSON）
//  ・旧セーブ（v1：{ unlocked, lv, exp }）は自動で v2 に移す。プロローグの進行は消えない
//  ・プロローグが使う unlocked / lv / exp はトップレベルにそのまま置く（既存コードとの互換）
//  ・書き出し／読み込み：iOS Safari で保存データが消えた時の備え
// =====================================================================
// ---------------------------------------------------------------------
//  埋め込み（iframe）の判定：iPhone / iPad の Safari で、iframe の中で動いている時だけ true
//  ・iOS の Safari は、埋め込み（itch.io など）の中の localStorage を消すことがある
//  ・その時はタイトルに「新しいタブで遊ぶ」ボタンを出し、外部送信（ランキング等）もしない
// ---------------------------------------------------------------------
const EMBED = (() => {
  let inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }   // 別ドメインの親に触れない＝iframe の中
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // iPadOS は Mac のふりをするのでタッチで見分ける
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const safari = /AppleWebKit/.test(ua);   // iOS のブラウザはすべて WebKit（Safari と同じ保存の制限）
  const iosFrame = inFrame && ios && touch && safari;
  return { inFrame, ios, iosFrame, allowNetwork: !iosFrame };   // allowNetwork：ランキングなど外部へ送ってよいか（今は送信する機能なし）
})();

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
  // 保存はすべてここを通る。保存のたびに保存時刻（savedAt）を記録する（新旧どちらのデータか判断するため）
  save(d) { d.savedAt = Date.now(); try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
  store(d) { this.save(d); },   // 以前の呼び名（中身は save と同じ）
  stamp(d) { return d && d.savedAt ? new Date(d.savedAt).toLocaleString('ja-JP') : '不明'; },
  // 書き出し：コピーして保管できる文字列（日本語を含むので UTF-8 → base64）
  exportCode(d) { return 'LA2:' + btoa(unescape(encodeURIComponent(JSON.stringify(d)))); },
  importCode(code) {
    const s = String(code || '').trim();
    if (!s.startsWith('LA2:')) throw new Error('セーブデータの文字列ではありません');
    return this.migrate(JSON.parse(decodeURIComponent(escape(atob(s.slice(4))))));
  },
  // 「新しいタブで開く」：今のセーブを URL の # に付けて新しいタブで開く。
  // 開いた側は起動時に # から読み込んで自分の保存領域に保存し、# を消す（アプリ内ブラウザ・iframe でセーブが残らない対策）
  openInNewTab(d) {
    const url = location.href.split('#')[0] + '#la2=' + encodeURIComponent(this.exportCode(d));
    let w = null; try { w = window.open(url, '_blank'); } catch (e) {}
    return !!w;
  },
  fromHash() {
    try {
      const m = location.hash.match(/^#la2=(.+)$/); if (!m) return;
      const d = this.importCode(decodeURIComponent(m[1]));
      const cur = this.load();
      // 引き継ぐデータのほうが新しい（保存時刻が後）時だけ上書きする。時刻がなければ進み具合で比べる
      const prog = x => (x.main ? 1000 : 0) + (x.unlocked || 0) * 10 + Object.values(x.dungeons || {}).reduce((a, v) => a + (v.best || 0), 0) + (x.lv || 0);
      const newer = d.savedAt && cur.savedAt ? d.savedAt >= cur.savedAt : prog(d) >= prog(cur);
      if (newer) { const t = d.savedAt; this.save(d); if (t) { d.savedAt = t; try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} } }
      history.replaceState(null, '', location.href.split('#')[0]);
    } catch (e) {}
  },
};
Save.fromHash();
