// =====================================================================
//  ダンジョンの階層生成
//  1) 部屋パーツを「開始 → 中間（役割の並びを決めて乱数で選ぶ）→（ボス）→ 出口」の順に横へつなげる
//  2) パーツの「枠（slot）」を、ダンジョンごとのギミックに置き換える（BIOME_SLOTS）
//  3) 敵・宝箱を置く。敵の強さは src/data/balance.js の式で決まる。強化個体（エリート）もここで決める
//  4) 到達可能性を調べる：ジャンプで届くか・壁にふさがれていないか・属性の壁の手前に源があるか。
//     出口まで行けなければシードを変えて作り直す（進行不能の階は絶対に出さない）
//  同じシードなら同じ階になる（不具合の再現用）
// =====================================================================

// ダンジョンごとの「枠」の中身。新しい属性・ダンジョンを足す時はここに1行足す
//   gate   … { style, el（必須の属性。'candles' は燭台を全部灯す封印）, hp }
//   source … その属性の源のオブジェクト（gate / bridge の手前に必ず置く）
//   bridge … latent（属性で現れる橋）/ mover（動く床）/ crumble（崩れる足場）
//   hazard … 地形の危険物、block … 宝箱をふさぐ物（fastEl の属性なら一撃）
const BIOME_SLOTS = {
  grassland:  { gate: { style: 'vines', el: 'fire', hp: 2 }, source: { fire: 'campfire' }, bridge: { mode: 'mover' }, hazard: ['thorns'], block: { style: 'boulder', hp: 4, fastEl: 'fire' }, grass: true },
  desert:     { gate: { style: 'sandwall', el: 'sand', hp: 2 }, source: { sand: 'cactus' }, bridge: { mode: 'crumble' }, hazard: ['quicksand'], block: { style: 'mound', hp: 3, fastEl: 'sand' }, storm: true },
  snow:       { gate: { style: 'snowpile', el: 'fire', hp: 2 }, source: { fire: 'campfire', ice: 'icecrystal' }, bridge: { mode: 'latent', el: 'ice', liquid: 'water' }, hazard: ['icicle'], block: { style: 'icewall', hp: 5, fastEl: 'fire' } },
  volcano:    { gate: { style: 'magmarock', el: 'ice', hp: 2 }, source: { ice: 'frostvent' }, bridge: { mode: 'latent', el: 'ice', liquid: 'lava' }, hazard: ['eruptor'], block: { style: 'magmarock', hp: 4, fastEl: 'ice' }, bossBreak: true },
  castle_out: { gate: { style: 'rubble', el: null, hp: 6 }, source: {}, bridge: { mode: 'mover' }, hazard: ['eruptor_dark'], block: { style: 'rubble', hp: 4 }, bossBreak: true },
  castle_in:  { gate: { style: 'seal', el: 'candles', hp: 1 }, source: { fire: 'candle' }, bridge: { mode: 'mover' }, hazard: ['portcullis'], block: { style: 'rubble', hp: 4 }, bossBreak: true },
};
// 属性の源（その属性を武器に宿すオブジェクト）
const ELEMENT_SOURCES = { fire: ['campfire', 'candle'], ice: ['icecrystal', 'frostvent'], sand: ['cactus'] };

const DungeonGen = {
  // 主人公が届く範囲（2段ジャンプで約260上がる。余裕をみて小さめに）
  REACH: { rise: 220, gap: 230, dropGap: 320 },
  ROLES: { explore: 1, action: 1, battle: 1, treasure: 1, secret: 1, gimmick: 1 },

  build(run) {
    const D = DUNGEONS[run.id];
    for (let attempt = 0; attempt < 30; attempt++) {
      const seed = (run.seedBase + run.floor * 7919 + attempt * 104729) >>> 0;
      const ch = this.layout(D, run.floor, seed);
      if (this.reachable(ch, ch.jumpMul)) { ch.seed = seed; return ch; }
    }
    throw new Error('階層を生成できませんでした');
  },

  // 部屋の役割の並び：必ず「足場」「ギミック」「戦闘」「宝か隠し」を入れ、残りを乱数で埋める
  plan(rng, C, n, floor) {
    const byRole = r => Object.keys(C).filter(k => C[k].weight && C[k].role === r);
    const need = ['action', 'gimmick', 'battle', rng.chance(0.4) ? 'secret' : 'treasure'];
    if (floor >= 3) need.push('gimmick');
    if (floor >= 6) need.push('action');
    const roles = need.slice(0, n);
    const all = Object.keys(C).filter(k => C[k].weight);
    while (roles.length < n) roles.push(C[rng.weighted(all, k => C[k].weight)].role);
    // 並びを混ぜる（同じ役割が3つ続かないように）
    for (let i = roles.length - 1; i > 0; i--) { const j = rng.int(0, i); [roles[i], roles[j]] = [roles[j], roles[i]]; }
    const seq = [];
    for (const r of roles) {
      const pool = byRole(r).length ? byRole(r) : all;
      let k, tries = 0;
      do { k = rng.weighted(pool, x => C[x].weight); } while (tries++ < 8 && (k === seq[seq.length - 1] || seq.filter(x => x === k).length >= 2));
      seq.push(k);
    }
    return seq;
  },

  layout(D, floor, seed) {
    // 魔王城のように階で見た目・敵が変わるダンジョン（zones）
    const Z = D.zones && D.zones.find(z => floor <= z.upTo);
    if (Z) D = Object.assign({}, D, Z, { chunks: Z.objMap ? biomeChunks(Object.assign({ bush: 'abyss', mushroom: 'geyser' }, Z.objMap)) : D.chunks, name: Z.name });
    const rng = makeRng(seed), C = D.chunks, SL = BIOME_SLOTS[D.bg] || BIOME_SLOTS.grassland;
    const isBoss = !!D.bosses[floor];
    // 中間パーツの数：浅い階 4〜5、深い階 8〜9
    const n = isBoss ? 0 : 4 + Math.floor(floor / 2) + rng.int(0, 1);
    const seq = ['start', ...(isBoss ? [] : this.plan(rng, C, n, floor)), ...(isBoss ? ['boss'] : []), 'exit'];
    const depth = (D.tier || 0) * 10 + floor;   // 深さ：草原1〜10・砂漠11〜20・雪原21〜30・火山31〜40・魔王城41〜50
    const S = BAL.enemy(depth), norm = BAL.foeNorm(D);

    const ch = {
      id: `dg_${floor}`, dungeon: true, dungeonId: null, floor, title: D.name, sub: `${floor}F`, bg: D.bg,
      bgm: isBoss ? D.bossBgm : D.bgm, terrainTheme: D.terrainTheme, jumpMul: D.jumpMul, env: D.env || null,
      depth, rooms: seq,
      loadout: { weapons: [], fire: false, partner: true, canFight: true },
      intro: [], events: [], endX: 99999, outro: [],
      terrain: [], spawns: [], chests: [], objs: [], feats: [], exitX: 0, boss: null,
      dmgMul: S.dmgMul,                  // 敵の攻撃（接触・弾・ボスの技・環境）すべてに掛かる
      burnMul: S.hpMul,                  // 燃焼ダメージも敵の硬さに合わせる
      foeScale: BAL.spawnScale(depth, D.foes(floor)[0][0], norm, false),   // 呼ばれた子分の強さ
      storm: SL.storm && floor >= 3 && rng.chance(0.6),   // 砂嵐（砂漠3階から）
      bossBreak: !!SL.bossBreak,         // ボスの攻撃で足場が壊れる
      snowDeep: !!D.surfaces,
    };
    const foes = D.foes(floor);
    const perChunk = 1 + Math.floor(floor / 3);   // 1部屋あたりの敵の数の目安
    let eliteLeft = floor >= 2 ? 1 + Math.floor(floor / 5) : 0;   // 1階あたりの強化個体の上限
    let gid = 0, x = 0;
    const solid = (t) => { ch.terrain.push(t); return t; };
    const obj = (o) => { ch.objs.push(Object.assign({ y: GROUND_Y, alt: rng.chance(0.5) }, o)); };
    const addSpawn = (type, sx, sy, elite) => ch.spawns.push(Object.assign({ type, x: sx, y: sy }, BAL.spawnScale(depth, type, norm, elite)));

    for (const k of seq) {
      const c = C[k];
      const roomFeats = [];
      for (const s of c.solids) {
        const t = Object.assign({}, s, { x: s.x + x });
        if (t.move) { t.move = Object.assign({ x0: t.x, phase: rng.next() }, t.move); t.gid = ++gid; }
        // 雪原：地面の一部が氷（滑る）や深雪（遅い）になる。最初と出口の部屋・ギミックの部屋はふつうの地面
        if (D.surfaces && t.y === GROUND_Y && t.type !== 'oneway' && !['start', 'exit', 'boss'].includes(k) && c.role !== 'gimmick') {
          const r = rng.next(); if (r < D.surfaces.ice) t.surface = 'ice'; else if (r < D.surfaces.ice + D.surfaces.snow) t.surface = 'snow';
        }
        solid(t);
      }
      // ---- 枠（slot）をこのダンジョンのギミックに置き換える ----
      let blockGid = null;
      for (const f of c.feats || []) {
        const fx = f.x + x;
        if (f.slot === 'source') {
          // gate の源：ダンジョンの gate の属性。bridge の源：橋の属性
          const el = f.bridge ? SL.bridge.el : (SL.gate.el === 'candles' ? 'fire' : SL.gate.el);
          if (f.bridge && SL.bridge.mode !== 'latent') continue;
          if (!el) continue;
          const kind = SL.source[el]; if (!kind) continue;
          if (SL.gate.el === 'candles' && !f.bridge) {   // 封印：燭台を2つ灯す
            const sealGid = gid + 100000 + x;   // 後で gate と結ぶ
            obj({ x: fx - 40, kind, seal: sealGid }); obj({ x: fx + 150, kind, seal: sealGid });
            roomFeats.push({ sealKey: sealGid });
          } else obj({ x: fx, kind, source: true });
        }
        if (f.slot === 'gate') {
          const G = SL.gate, t = solid({ x: fx, y: -300, w: 56, h: GROUND_Y + 300, style: G.style, gid: ++gid });
          const sk = roomFeats.find(r => r.sealKey);
          ch.feats.push({ kind: 'wall', gid: t.gid, style: G.style, el: G.el, hp: G.hp, maxHp: G.hp, gate: true, seal: sk ? sk.sealKey : null });
        }
        if (f.slot === 'cracked') {
          const t = solid({ x: fx, y: f.y, w: f.w, h: f.h, style: 'cracked', gid: ++gid });
          ch.feats.push({ kind: 'wall', gid: t.gid, style: 'cracked', el: null, hp: 3, maxHp: 3, secret: true });
        }
        if (f.slot === 'stone') {   // 壊せない岩壁（隠し部屋の裏口をふさぐ）
          const t = solid({ x: fx, y: f.y, w: f.w, h: f.h, style: 'stone', gid: ++gid });
          ch.feats.push({ kind: 'stone', gid: t.gid });
        }
        if (f.slot === 'block') {
          const B = SL.block, h = B.style === 'mound' ? 70 : 110, t = solid({ x: fx - 60, y: GROUND_Y - h, w: 120, h, style: B.style, gid: ++gid });
          ch.feats.push({ kind: 'wall', gid: t.gid, style: B.style, el: null, fastEl: B.fastEl || null, hp: B.hp, maxHp: B.hp, block: true });
          blockGid = t.gid;
        }
        if (f.slot === 'bridge') {
          const B = SL.bridge;
          if (B.mode === 'latent') {
            const t = solid({ x: fx, y: GROUND_Y, w: f.w, h: 40, type: 'oneway', style: 'bridge', off: true, gid: ++gid });
            ch.feats.push({ kind: 'bridge', gid: t.gid, el: B.el, liquid: B.liquid, x: fx, w: f.w });
          } else if (B.mode === 'mover') {
            solid({ x: fx + 40, y: 410, w: 130, type: 'oneway', move: { x0: fx + 40, range: f.w - 210, period: 4.2, phase: rng.next() }, gid: ++gid });
          } else {
            for (let i = 0; i < 3; i++) solid({ x: fx + 20 + i * 135, y: i === 1 ? 380 : 410, w: 95, type: 'oneway', crumble: true, gid: ++gid });
          }
        }
        if (f.slot === 'hazard') {
          const hz = rng.pick(SL.hazard);
          if (hz === 'portcullis') { const t = solid({ x: fx, y: -300, w: 34, h: GROUND_Y + 300, style: 'portcullis', gid: ++gid }); ch.feats.push({ kind: 'portcullis', gid: t.gid, period: 5, phase: rng.next() }); }
          else ch.feats.push({ kind: hz, x: fx, w: hz === 'quicksand' ? 200 : hz === 'thorns' ? 130 : 60, period: 3.4, phase: rng.next() });
        }
      }
      // 敵：候補から選ぶ（多すぎない）。elite の候補は必ず強化個体
      const spots = [...c.foes];
      const forced = floor >= 2 ? spots.filter(s => s.elite) : [];   // 1階は強化個体なし
      for (const sp of forced) { const fit = foes.filter(f => !ENEMIES[f[0]].fly); addSpawn(rng.weighted(fit, f => f[1])[0], sp.x + x, sp.y, true); spots.splice(spots.indexOf(sp), 1); }
      const count = Math.min(spots.length, perChunk + rng.int(0, 1));
      for (let i = 0; i < count; i++) {
        const sp = spots.splice(rng.int(0, spots.length - 1), 1)[0];
        // 置き場所（空中か地上か）に合う敵だけから選ぶ。合う敵がいなければ置かない
        const fit = foes.filter(f => !!ENEMIES[f[0]].fly === !!sp.fly);
        if (!fit.length) continue;
        const type = rng.weighted(fit, f => f[1])[0];
        const elite = eliteLeft > 0 && !sp.fly && rng.chance(BAL.eliteChance(floor));
        if (elite) eliteLeft--;
        addSpawn(type, sp.x + x, sp.y, elite);
        // 草原：背の高い草むらに隠れている敵
        if (SL.grass && !sp.fly && (sp.y === undefined || sp.y === GROUND_Y) && rng.chance(0.35)) ch.feats.push({ kind: 'tallgrass', x: sp.x + x - 70, w: 140 });
      }
      // 宝箱：候補ごとに一定の確率（寄り道・ふさがれた宝箱は必ず）
      for (const cs of c.chests) {
        if (cs.lockedBy && !blockGid) continue;
        if (cs.hidden || cs.lockedBy || rng.chance(0.55)) ch.chests.push({ x: cs.x + x, y: cs.y, hidden: !!cs.hidden || !!cs.lockedBy, viaSpring: !!cs.viaSpring, floor: depth, lockedBy: cs.lockedBy ? blockGid : null });
      }
      for (const o of c.objs || []) {
        if (o.bossOnly && o.bossOnly !== floor) continue;
        if (rng.chance(o.p)) obj({ x: o.x + x, y: o.y || GROUND_Y, kind: o.kind });
      }
      if (c.wave) {
        const sc = BAL.spawnScale(depth, foes[0][0], norm, false);
        ch.events.push(Object.assign({ x: x + 200, type: 'wave', waves: [this.waveList(rng, foes, floor), this.waveList(rng, foes, floor)] }, sc));
      }
      if (c.boss) ch.boss = Object.assign({ type: D.bosses[floor], x: x + c.w - 300 }, BAL.bossScale(depth, floor, D.bosses[floor]));
      // 飾り（花・サボテン・雪の木など。触れても何も起きない）
      for (const t of c.solids) if (t.y === GROUND_Y && t.w > 200 && D.decor) for (let fx = t.x + 60; fx < t.x + t.w - 60; fx += 260) if (rng.chance(0.35)) { const d = rng.pick(D.decor); ch.objs.push({ x: fx + x + rng.int(-40, 40), y: GROUND_Y, kind: 'deco', img: d.img, s: d.s }); }
      // 1階の最初の部屋：補給の宝箱（今のダンジョンの武器が必ず入っている＝ドロップ運で詰まらない）
      if (k === 'start' && floor === 1) ch.chests.push({ x: x + 380, y: GROUND_Y, supply: true, floor: depth });
      if (c.exitX) ch.exitX = x + c.exitX;
      x += c.w;
    }
    // 封印の扉と燭台を結ぶ（燭台の seal はその部屋の gate と同じ鍵）
    for (const f of ch.feats) if (f.seal) f.candles = ch.objs.filter(o => o.seal === f.seal).length;
    ch.length = x;
    if (ch.boss) ch.events.push({ x: ch.boss.x - 700, type: 'boss_dg', enemy: ch.boss.type });
    return ch;
  },
  waveList(rng, foes, floor) {
    const n = 2 + Math.min(3, Math.floor(floor / 2));
    return Array.from({ length: n }, (_, i) => [rng.weighted(foes, f => f[1])[0], i % 2 ? -1 : 1]);
  },

  // ---------------------------------------------------------------
  //  到達可能性
  //  ・足場の上面を「面」にする。上に壁が立っている所で面を切る（壁の左右は別の面）
  //  ・面どうしを「ジャンプで届くか」でつなぐ。間に越えられない高さの壁があればつながない
  //  ・動く床は両端の位置に面を置き、その2つをつなぐ
  //  ・属性の壁／凍らせる橋／封印は「その源に先に行けるなら」開いたものとして、もう一度調べる
  //  ・出口の床まで行ければ合格。行けない宝箱は消す
  // ---------------------------------------------------------------
  reachable(ch, jumpMul = 1, report) {
    const R = this.REACH, rise = R.rise * jumpMul * (ch.snowDeep ? 0.9 : 1);
    const feats = ch.feats || [], open = new Set();
    for (const f of feats) if (f.kind === 'portcullis') open.add(f.gid);   // 落とし格子は周期的に開く
    const byGid = new Map(ch.terrain.filter(s => s.gid).map(s => [s.gid, s]));
    const active = s => (s.off ? open.has(s.gid) : !(s.gid && open.has(s.gid) && s.style && s.style !== 'bridge'));
    let seen, surf;
    const sources = el => ch.objs.filter(o => (ELEMENT_SOURCES[el] || []).includes(o.kind));
    const onSeen = (px, py) => surf.some((s, i) => seen.has(i) && px >= s.x0 - 4 && px <= s.x1 + 4 && Math.abs(s.y - py) < 3);
    for (let pass = 0; pass < 12; pass++) {
      const sol = ch.terrain.filter(active);
      const walls = sol.filter(s => s.type !== 'oneway');
      surf = [];
      for (const s of sol) {
        const spans = s.move ? [[s.move.x0, s.move.x0 + s.w], [s.move.x0 + s.move.range, s.move.x0 + s.move.range + s.w]] : [[s.x, s.x + s.w]];
        const ids = [];
        for (let [a, b] of spans) {
          // 上に立つ壁で切る
          let pieces = [[a, b]];
          for (const w of walls) {
            if (w === s || !(w.y < s.y - 1 && w.y + w.h > s.y - 2)) continue;
            pieces = pieces.flatMap(([p0, p1]) => (w.x >= p1 || w.x + w.w <= p0) ? [[p0, p1]] : [[p0, w.x], [w.x + w.w, p1]].filter(([u, v]) => v - u > 8));
          }
          for (const [p0, p1] of pieces) { ids.push(surf.length); surf.push({ x0: p0, x1: p1, y: s.y, s }); }
        }
        if (s.move && ids.length > 1) for (const i of ids) surf[i].ride = ids;   // 動く床の両端は行き来できる
      }
      const blocked = (a, b) => {
        const lo = Math.min(a.x1, b.x1), hi = Math.max(a.x0, b.x0);   // 2つの面の間
        const L = Math.min(lo, hi), H = Math.max(lo, hi);
        return walls.some(w => w !== a.s && w !== b.s && w.x < H && w.x + w.w > L && w.y < a.y - rise && w.y + w.h > Math.min(a.y, b.y) - 110);
      };
      const start = surf.findIndex(s => 100 >= s.x0 && 100 <= s.x1 && s.y === GROUND_Y);
      if (start < 0) return false;
      seen = new Set([start]); const q = [start];
      while (q.length) {
        const ai = q.shift(), a = surf[ai];
        if (a.ride) for (const j of a.ride) if (!seen.has(j)) { seen.add(j); q.push(j); }
        surf.forEach((b, j) => {
          if (seen.has(j)) return;
          const gap = Math.max(0, b.x0 - a.x1, a.x0 - b.x1), up = a.y - b.y;
          if (((up <= rise && gap <= R.gap) || (up < 0 && gap <= R.dropGap)) && !blocked(a, b)) { seen.add(j); q.push(j); }
        });
      }
      // 開けられる仕掛けを開けて、もう一度
      let changed = false;
      for (const f of feats) {
        if (open.has(f.gid)) continue;
        const s = byGid.get(f.gid); if (!s) continue;
        const near = surf.some((p, i) => seen.has(i) && p.y >= s.y - 2 && p.y <= s.y + s.h + 2 && Math.max(0, s.x - p.x1, p.x0 - (s.x + s.w)) < 60);
        if (!near) continue;
        let ok = false;
        if (f.kind === 'wall') {
          if (f.el === 'candles') ok = ch.objs.filter(o => o.seal === f.seal).every(o => onSeen(o.x, o.y));
          else ok = !f.el || sources(f.el).some(o => onSeen(o.x, o.y));
        }
        if (f.kind === 'bridge') ok = sources(f.el).some(o => onSeen(o.x, o.y));
        if (ok) { open.add(f.gid); changed = true; }
      }
      if (!changed) break;
    }
    const goal = surf.findIndex(s => ch.exitX >= s.x0 && ch.exitX <= s.x1 && s.y === GROUND_Y);
    // 宝箱も取れる位置にあるか（届かない宝箱は消す）。キノコのばねで届く宝箱（viaSpring）は残す
    ch.chests = ch.chests.filter(c => {
      if (c.viaSpring) return true;
      if (c.lockedBy) return onSeen(c.x - 80, GROUND_Y) || onSeen(c.x + 80, GROUND_Y);
      const i = surf.findIndex(s => c.x >= s.x0 && c.x <= s.x1 && Math.abs(s.y - c.y) < 2);
      return i < 0 || seen.has(i);
    });
    if (report) Object.assign(report, { surfaces: surf.length, reached: seen.size, opened: open.size, goal: goal >= 0 && seen.has(goal) });
    return goal >= 0 && seen.has(goal);
  },
};
