// =====================================================================
//  ダンジョンの階層生成
//  1) 部屋パーツを「開始 → 中間（乱数）→ 出口」の順に横へつなげる
//  2) パーツ内の候補から、敵・宝箱を乱数で選んで置く
//  3) 足場どうしの到達可能性を調べ、出口まで行けなければシードを変えて作り直す
//  同じシードなら同じ階になる（不具合の再現用）
// =====================================================================
const DungeonGen = {
  // 主人公が届く範囲（2段ジャンプで約260上がる。余裕をみて小さめに）
  REACH: { rise: 220, gap: 230, dropGap: 320 },

  build(run) {
    const D = DUNGEONS[run.id];
    for (let attempt = 0; attempt < 20; attempt++) {
      const seed = (run.seedBase + run.floor * 7919 + attempt * 104729) >>> 0;
      const ch = this.layout(D, run.floor, seed);
      if (this.reachable(ch, D.jumpMul)) { ch.seed = seed; return ch; }
    }
    throw new Error('階層を生成できませんでした');
  },

  layout(D, floor, seed) {
    const rng = makeRng(seed), C = D.chunks;
    const isBoss = !!D.bosses[floor];
    // 中間パーツの数：浅い階 4〜5、深い階 7〜8
    const n = isBoss ? 0 : 4 + Math.floor(floor / 2) + rng.int(0, 1);
    const pool = Object.entries(C).filter(([, c]) => c.weight);
    const seq = ['start'];
    for (let i = 0; i < n; i++) {
      let k;
      do { k = rng.weighted(pool, ([, c]) => c.weight)[0]; } while (k === seq[seq.length - 1] && (k === 'arena' || k === 'hidden'));  // 同じ特別部屋は続けない
      seq.push(k);
    }
    if (isBoss) seq.push('boss');
    seq.push('exit');

    const ch = {
      id: `dg_${floor}`, dungeon: true, dungeonId: null, floor, title: D.name, sub: `${floor}F`, bg: D.bg,
      bgm: isBoss ? D.bossBgm : D.bgm, terrainTheme: D.terrainTheme, jumpMul: D.jumpMul,
      loadout: { weapons: [], fire: false, partner: true, canFight: true },
      intro: [], events: [], endX: 99999, outro: [],
      terrain: [], spawns: [], chests: [], objs: [], exitX: 0, boss: null,
    };
    const hpMul = 1 + 0.14 * (floor - 1), dmgMul = 1 + 0.07 * (floor - 1);   // 深い階ほど強い（行動の変化は第6段階で追加）
    const foes = D.foes(floor);
    const perChunk = 1 + Math.floor(floor / 3);   // 1部屋あたりの敵の数の目安
    let x = 0;
    for (const k of seq) {
      const c = C[k];
      for (const s of c.solids) ch.terrain.push(Object.assign({}, s, { x: s.x + x }));
      // 敵：候補から選ぶ（多すぎない）
      const spots = [...c.foes];
      const count = Math.min(spots.length, perChunk + rng.int(0, 1));
      for (let i = 0; i < count; i++) {
        const sp = spots.splice(rng.int(0, spots.length - 1), 1)[0];
        let type = rng.weighted(foes, f => f[1])[0];
        if (sp.fly && !ENEMIES[type].fly) type = 'bat';
        if (!sp.fly && ENEMIES[type].fly) type = 'slime';
        ch.spawns.push({ type, x: sp.x + x, y: sp.y, hpMul, dmgMul });
      }
      // 宝箱：候補ごとに一定の確率（寄り道の宝箱は必ず）
      for (const cs of c.chests) if (cs.hidden || rng.chance(0.55)) ch.chests.push({ x: cs.x + x, y: cs.y, hidden: !!cs.hidden, viaSpring: !!cs.viaSpring, floor });
      for (const o of c.objs || []) {
        if (o.bossOnly && o.bossOnly !== floor) continue;
        if (rng.chance(o.p)) ch.objs.push({ x: o.x + x, y: o.y || GROUND_Y, kind: o.kind });
      }
      if (c.wave) ch.events.push({ x: x + 200, type: 'wave', waves: [this.waveList(rng, foes, floor), this.waveList(rng, foes, floor)], hpMul, dmgMul });
      if (c.boss) ch.boss = { type: D.bosses[floor], x: x + c.w - 300, hpMul: 1 + 0.05 * (floor - 1) };
      if (c.exitX) ch.exitX = x + c.exitX;
      x += c.w;
    }
    ch.length = x;
    if (ch.boss) ch.events.push({ x: ch.boss.x - 700, type: 'boss_dg', enemy: ch.boss.type });
    return ch;
  },
  waveList(rng, foes, floor) {
    const n = 2 + Math.min(3, Math.floor(floor / 2));
    return Array.from({ length: n }, (_, i) => [rng.weighted(foes, f => f[1])[0], i % 2 ? -1 : 1]);
  },

  // 到達可能性：足場の上面どうしを「ジャンプで届くか」でつなぎ、出口の床まで行けるか調べる
  reachable(ch, jumpMul = 1) {
    const R = this.REACH, rise = R.rise * jumpMul;
    const surf = ch.terrain.map(s => ({ x0: s.x, x1: s.x + s.w, y: s.y }));
    const on = x => surf.findIndex(s => x >= s.x0 && x <= s.x1 && s.y === GROUND_Y);
    const start = on(100), goal = on(ch.exitX);
    if (start < 0 || goal < 0) return false;
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const a = surf[q.shift()];
      surf.forEach((b, j) => {
        if (seen.has(j)) return;
        const gap = Math.max(0, b.x0 - a.x1, a.x0 - b.x1), up = a.y - b.y;
        if ((up <= rise && gap <= R.gap) || (up < 0 && gap <= R.dropGap)) { seen.add(j); q.push(j); }
      });
    }
    // 宝箱も取れる位置にあるか（届かない宝箱は消す）
    // キノコのばねで届く宝箱（viaSpring）は残す
    ch.chests = ch.chests.filter(c => { if (c.viaSpring) return true; const i = surf.findIndex(s => c.x >= s.x0 && c.x <= s.x1 && Math.abs(s.y - c.y) < 2); return i < 0 || seen.has(i); });
    return seen.has(goal);
  },
};
