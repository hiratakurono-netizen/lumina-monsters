// =====================================================================
//  地形エンジン
//  ・地形データ（足場の矩形の配列）がないステージ＝プロローグは「GROUND_Y の平らな床」
//    として振る舞い、今までの挙動を変えない。
//  ・足場の種類
//      oneway … 上から乗れる床。下からはすり抜け、↓＋ジャンプで降りられる
//      solid  … 乗れて、横（壁）と下（天井）もふさぐブロック
//    どちらにも surface（ice / snow / lava など、ダンジョンの特殊な床）を付けられる（今は見た目と判定の土台だけ）
//  ・ギミック（src/dungeon/gimmicks.js）が足場を動かす・消す・出す
//      off   … 今は存在しない（崩れた床・壊した壁・凍らせる前の水面）。判定にも描画にも使わない
//      style … ギミック側で描く足場（壁・門・水面の橋など）。地面の素材では描かない
//      dx    … このフレームに動いた量（動く床。乗っている主人公を一緒に運ぶ）
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
      if (s.off || (skipOneway && s.type === 'oneway')) continue;
      if (x + hw > s.x && x - hw < s.x + s.w && s.y >= y0 - 2 && s.y < best) best = s.y;
    }
    return best;
  }
  /** 足元の床そのもの（特殊な床の判定用）。なければ null */
  surfaceAt(x, y, hw = 0) {
    for (const s of this.solids) if (!s.off && Math.abs(s.y - y) < 2 && x + hw > s.x && x - hw < s.x + s.w) return s;
    return null;
  }
  /** 横移動を solid の壁で止める。体の上端 top〜下端 bottom の範囲で判定 */
  blockX(x, prevX, top, bottom, hw) {
    for (const s of this.solids) {
      if (s.type !== 'solid' || s.off) continue;
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
      if (s.type !== 'solid' || s.off) continue;
      const bottom = s.y + s.h;
      if (x + hw > s.x && x - hw < s.x + s.w && headPrev >= bottom && headNew < bottom) hit = hit === null ? bottom : Math.max(hit, bottom);
    }
    return hit;
  }

  // 素材の地面（上に草、下に土の帯）を敷き詰める。すり抜け床は草の縁だけの薄い足場
  // 素材の帯は左右の端の絵がつながらないので、「そのまま＋左右反転」を1組にして敷く（継ぎ目が鏡合わせで一致する）
  static mirrored(im) {
    if (!im || !im.width) return im;
    Terrain._mir = Terrain._mir || new Map();
    if (!Terrain._mir.has(im)) {
      const c = document.createElement('canvas'); c.width = im.width * 2; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.translate(im.width * 2, 0); x.scale(-1, 1); x.drawImage(im, 0, 0);
      Terrain._mir.set(im, c);
    }
    return Terrain._mir.get(im);
  }
  static soilColor(im) {   // 帯の下の方の平均色（少し暗く）
    Terrain._soil = Terrain._soil || new Map();
    if (!Terrain._soil.has(im)) {
      const c = document.createElement('canvas'); c.width = im.width; c.height = 6; const x = c.getContext('2d');
      x.drawImage(im, 0, im.height - 6, im.width, 6, 0, 0, im.width, 6);
      const d = x.getImageData(0, 0, im.width, 6).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      Terrain._soil.set(im, [r / n * 0.8 | 0, g / n * 0.8 | 0, b / n * 0.8 | 0]);
    }
    return Terrain._soil.get(im);
  }
  drawTextured(ctx, cam, tex, owTex) {
    tex = Terrain.mirrored(tex); owTex = Terrain.mirrored(owTex);
    const TW = tex.width, top = Math.min(26, tex.height), soil = tex.height > 50 ? [30, tex.height - 30] : [Math.floor(tex.height / 2), Math.ceil(tex.height / 2)];
    for (const s of this.solids) {
      if (s.off || s.style) continue;
      const x0 = Math.round(s.x - cam) + (s.shake ? Math.round(Math.sin(performance.now() / 20) * 2) : 0), y = Math.round(s.y);
      if (x0 + s.w < -10 || x0 > VIEW_W + 10) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y - 8, s.w, VIEW_H); ctx.clip();
      const sx0 = ((s.x % TW) + TW) % TW;
      if (s.type === 'oneway' && owTex && owTex.width) {   // すり抜け床の専用素材（岩床など）
        const OW = owTex.width, oh = Math.min(owTex.height, 30), ox0 = ((s.x % OW) + OW) % OW;
        for (let x = x0 - ox0; x < x0 + s.w; x += OW) ctx.drawImage(owTex, 0, 0, OW, oh, x, y - 4, OW, oh);
        ctx.fillStyle = 'rgba(20,10,30,.45)'; ctx.fillRect(x0, y + oh - 4, s.w, 5);
      } else if (s.type === 'oneway') {
        for (let x = x0 - sx0; x < x0 + s.w; x += TW) ctx.drawImage(tex, 0, 0, TW, top, x, y - 6, TW, top);
        ctx.fillStyle = 'rgba(20,10,30,.45)'; ctx.fillRect(x0, y + top - 6, s.w, 6);
      } else {
        const h = Math.min(s.h, VIEW_H - y + 20);
        for (let x = x0 - sx0; x < x0 + s.w; x += TW) {
          ctx.drawImage(tex, x, y - 6);
          if (tex.height >= 60) for (let yy = y - 6 + tex.height; yy < y + h; yy += soil[1]) ctx.drawImage(tex, 0, soil[0], TW, soil[1], x, yy, TW, soil[1]);
        }
        // 細い地面の帯（砂漠〜魔王城）は、帯の下を土の色で塗る（帯をくり返すと横じまになるため）
        if (tex.height < 60) { const [r, g, b] = Terrain.soilColor(tex); const gr = ctx.createLinearGradient(0, y - 6 + tex.height, 0, y + h); gr.addColorStop(0, `rgb(${r},${g},${b})`); gr.addColorStop(1, `rgb(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0})`); ctx.fillStyle = gr; ctx.fillRect(x0, y - 7 + tex.height, s.w, h); }
        // 雪原の特殊な床：氷（青い光沢）・深雪（白く盛り上がる）
        if (s.surface === 'ice') { ctx.fillStyle = 'rgba(170,225,255,.55)'; ctx.fillRect(x0, y - 6, s.w, 12); ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 20; i < s.w; i += 70) ctx.fillRect(x0 + i, y - 4, 26, 2); }
        if (s.surface === 'snow') { ctx.fillStyle = '#f4fbff'; for (let i = 0; i < s.w; i += 22) { ctx.beginPath(); ctx.ellipse(x0 + i + 11, y - 4, 14, 7, 0, Math.PI, 0); ctx.fill(); } }
        // 側面（段差・壁）に影
        // 隣に同じ高さの地面が続いている側には影を付けない（継ぎ目の縦線を出さない）
        const joinL = this.solids.some(o => o !== s && !o.style && o.type !== 'oneway' && o.y === s.y && Math.abs(o.x + o.w - s.x) < 2);
        const joinR = this.solids.some(o => o !== s && !o.style && o.type !== 'oneway' && o.y === s.y && Math.abs(s.x + s.w - o.x) < 2);
        ctx.fillStyle = 'rgba(20,10,30,.35)'; if (!joinL) ctx.fillRect(x0, y + 10, 3, h); if (!joinR) ctx.fillRect(x0 + s.w - 3, y + 10, 3, h);
      }
      ctx.restore();
    }
  }
  /** 足場の描画（地形データがある時だけ）。見た目は theme で変える */
  draw(ctx, cam) {
    if (!this.solids.length) return;
    const th = Object.assign({ top: '#8fb27a', side: '#5d6e4f', dark: '#3e4a35', edge: '#c8e0a8', oneway: '#b89a7a', onewayTop: '#e2cfa8' }, this.theme || {});
    const tex = th.texture && IMG[th.texture];
    if (tex && tex.width) return this.drawTextured(ctx, cam, tex, th.onewayTexture && IMG[th.onewayTexture]);
    for (const s of this.solids) {
      if (s.off || s.style) continue;
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
