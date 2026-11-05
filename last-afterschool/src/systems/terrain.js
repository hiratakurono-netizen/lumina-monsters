// =====================================================================
//  地形エンジン
//  ・地形データ（足場の矩形の配列）がないステージ＝プロローグは「GROUND_Y の平らな床」
//    として振る舞い、今までの挙動を変えない。
//  ・足場の種類
//      oneway … 上から乗れる床。下からはすり抜け、↓＋ジャンプで降りられる
//      solid  … 乗れて、横（壁）と下（天井）もふさぐブロック
//    どちらにも surface（ice / snow / lava など、ダンジョンの特殊な床）を付けられる（今は見た目と判定の土台だけ）
//  ・足場がない場所は穴。落ちると画面の下へ抜ける
// =====================================================================
class Terrain {
  /** @param {Array<{x,y,w,h,type?,surface?}>} solids  @param {{flatFloor?:boolean, theme?:object}} opts */
  constructor(solids = [], opts = {}) {
    this.solids = solids.map(s => Object.assign({ type: 'solid', h: 40 }, s));
    this.flat = opts.flatFloor !== undefined ? opts.flatFloor : this.solids.length === 0;
    this.theme = opts.theme || null;
  }
  static flat() { return new Terrain([], { flatFloor: true }); }

  /**
   * 足元より下で一番近い床の高さ。x±hw の範囲に掛かっている足場が対象。
   * y0 は前のフレームの足の高さ（そこより上の床は無視＝下からすり抜ける）。床がなければ Infinity（穴）。
   */
  groundBelow(x, y0, hw = 0, skipOneway = false) {
    let best = this.flat ? GROUND_Y : Infinity;
    for (const s of this.solids) {
      if (skipOneway && s.type === 'oneway') continue;
      if (x + hw > s.x && x - hw < s.x + s.w && s.y >= y0 - 2 && s.y < best) best = s.y;
    }
    return best;
  }
  /** 足元の床そのもの（特殊な床の判定用）。なければ null */
  surfaceAt(x, y, hw = 0) {
    for (const s of this.solids) if (Math.abs(s.y - y) < 2 && x + hw > s.x && x - hw < s.x + s.w) return s;
    return null;
  }
  /** 横移動を solid の壁で止める。体の上端 top〜下端 bottom の範囲で判定 */
  blockX(x, prevX, top, bottom, hw) {
    for (const s of this.solids) {
      if (s.type !== 'solid') continue;
      if (bottom <= s.y + 1 || top >= s.y + s.h) continue;          // 高さが重なっていない
      if (prevX + hw <= s.x && x + hw > s.x) x = s.x - hw;            // 右へ進んで左の壁に当たる
      else if (prevX - hw >= s.x + s.w && x - hw < s.x + s.w) x = s.x + s.w + hw;  // 左へ進んで右の壁に当たる
    }
    return x;
  }
  /** 上昇中に頭が solid の底に当たったら、その高さ（底の y）を返す。なければ null */
  ceiling(x, headPrev, headNew, hw) {
    let hit = null;
    for (const s of this.solids) {
      if (s.type !== 'solid') continue;
      const bottom = s.y + s.h;
      if (x + hw > s.x && x - hw < s.x + s.w && headPrev >= bottom && headNew < bottom) hit = hit === null ? bottom : Math.max(hit, bottom);
    }
    return hit;
  }

  /** 足場の描画（地形データがある時だけ）。見た目は theme で変える */
  draw(ctx, cam) {
    if (!this.solids.length) return;
    const th = Object.assign({ top: '#8fb27a', side: '#5d6e4f', dark: '#3e4a35', edge: '#c8e0a8', oneway: '#b89a7a', onewayTop: '#e2cfa8' }, this.theme || {});
    for (const s of this.solids) {
      const x = Math.round(s.x - cam), y = Math.round(s.y);
      if (x + s.w < -10 || x > VIEW_W + 10) continue;
      if (s.type === 'oneway') {
        ctx.fillStyle = th.oneway; ctx.fillRect(x, y, s.w, 10);
        ctx.fillStyle = th.onewayTop; ctx.fillRect(x, y, s.w, 3);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 8; i < s.w; i += 24) ctx.fillRect(x + i, y + 10, 4, 10);
      } else {
        const h = Math.min(s.h, VIEW_H - y + 20);
        ctx.fillStyle = th.side; ctx.fillRect(x, y, s.w, h);
        ctx.fillStyle = th.dark; for (let i = 0; i < s.w; i += 32) for (let j = 14; j < h; j += 28) ctx.fillRect(x + i + ((j / 28) % 2) * 16, y + j, 14, 3);
        ctx.fillStyle = th.top; ctx.fillRect(x, y, s.w, 8);
        ctx.fillStyle = th.edge; ctx.fillRect(x, y, s.w, 2);
      }
    }
  }
}
