// シードつき乱数（同じシードなら同じ結果。ダンジョン生成・ドロップの再現に使う）
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),   // a〜b（両端を含む）
    pick: arr => arr[Math.floor(next() * arr.length)],
    weighted: (arr, w) => { const tot = arr.reduce((t, x) => t + w(x), 0); let r = next() * tot; for (const x of arr) { r -= w(x); if (r <= 0) return x; } return arr[arr.length - 1]; },
    chance: p => next() < p,
  };
}
