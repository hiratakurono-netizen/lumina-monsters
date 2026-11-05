// ダンジョン生成の検証（node tools/validate_dungeons.js [シード数]）
// 全ダンジョン×10階で：出口まで行けるか・属性の壁の手前に源があるか・敵の数値が正しいか
const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, JSON, Object, Array, Set, Map, Error, document: { createElement: () => ({ getContext: () => ({}) }) }, window: {}, navigator: { userAgent: '' }, localStorage: { getItem() {}, setItem() {} }, Image: class {}, performance: { now: () => 0 } };
vm.createContext(ctx);
const root = require('path').join(__dirname, '..'), N = +process.argv[2] || 200;
const load = f => vm.runInContext(fs.readFileSync(root + '/' + f, 'utf8').replace(/^(const|let|class) (\w+)/gm, (m, k, n) => k === 'class' ? `var ${n} = class ${n}` : `var ${n}`), ctx, { filename: f });
for (const f of ['src/config.js', 'src/data/balance.js', 'src/data/items.js', 'src/systems/rng.js', 'src/data/dungeons.js', 'src/dungeon/generator.js']) load(f);
console.log(vm.runInContext(`
  const out = {};
  for (const id of ['grassland', 'desert', 'snow', 'volcano', 'castle']) {
    let fails = 0, n = 0, att = 0, rooms = {}, feats = {}, elites = 0, chestsLost = 0, errs = [];
    for (let f = 1; f <= 10; f++) for (let s = 0; s < ${N}; s++) {
      try { const ch = DungeonGen.build({ id, floor: f, seedBase: s * 7777 }); n++;
        att += (ch.seed - (s * 7777 + f * 7919)) / 104729;
        ch.rooms.forEach(r => rooms[r] = (rooms[r] || 0) + 1);
        ch.feats.forEach(o => feats[o.kind + (o.style ? ':' + o.style : '')] = (feats[o.kind + (o.style ? ':' + o.style : '')] || 0) + 1);
        ch.terrain.forEach(t => { if (t.move) feats.mover = (feats.mover || 0) + 1; if (t.crumble) feats.crumble = (feats.crumble || 0) + 1; });
        elites += ch.spawns.filter(sp => sp.elite).length;
        ch.spawns.forEach(sp => { if (!ENEMIES[sp.type] || !(sp.hpMul > 0)) fails++; });
        // 源のない属性の壁がないか（generator の到達判定で開けられた壁だけで出口に行けている＝合格）
        for (const w of ch.feats.filter(x => x.kind === 'wall' && x.gate && x.el && x.el !== 'candles')) {
          const src = ch.objs.filter(o => (ELEMENT_SOURCES[w.el] || []).includes(o.kind) && o.x < ch.terrain.find(t => t.gid === w.gid).x);
          if (!src.length) { fails++; errs.push(id + f + ' gate-no-src'); }
        }
      } catch (e) { fails++; errs.push(id + f + ':' + e.message); }
    }
    out[id] = { fails, floors: n, avgRetry: +(att / n).toFixed(2), elitesPerFloor: +(elites / n).toFixed(2), rooms: JSON.stringify(rooms), feats: JSON.stringify(feats), errs: errs.slice(0, 5) };
  }
  JSON.stringify(out, null, 1);`, ctx));
