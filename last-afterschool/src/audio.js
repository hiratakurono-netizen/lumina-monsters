// BGM（HTMLAudio）と効果音（WebAudio で合成）
const Audio2 = (() => {
  let ctx = null, master = null, muted = false;
  let bgmEl = null, bgmKey = null;
  const BGM_VOL = 0.4;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function playBgm(key) {
    if (bgmKey === key) return;
    bgmKey = key;
    const old = bgmEl;
    if (old) fade(old, old.volume, 0, 600, () => old.pause());
    if (!key || !BGM[key]) { bgmEl = null; return; }
    const el = new Audio(BGM[key]);
    el.loop = true; el.volume = 0;
    el.play().catch(() => {});
    fade(el, 0, muted ? 0 : BGM_VOL, 900);
    bgmEl = el;
  }
  function fade(el, from, to, ms, done) {
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      try { el.volume = from + (to - from) * k; } catch (e) {}
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    };
    step();
  }
  function toggleMute() {
    muted = !muted;
    if (bgmEl) bgmEl.volume = muted ? 0 : BGM_VOL;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  // ---- synth helpers ----
  function noiseBuf() {
    const len = ctx.sampleRate * 0.6, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let nb = null;
  function noise(dur, f0, f1, vol, type = 'bandpass', q = 1) {
    if (!ctx) return;
    nb = nb || noiseBuf();
    const s = ctx.createBufferSource(); s.buffer = nb;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  function tone(dur, f0, f1, vol, type = 'sine', delay = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  const SFX = {
    swingS: () => noise(0.12, 2400, 900, 0.25),
    swingM: () => noise(0.18, 1800, 500, 0.3),
    swingL: () => { noise(0.35, 900, 200, 0.4); tone(0.3, 160, 60, 0.15, 'sawtooth'); },
    kick: () => noise(0.1, 1200, 600, 0.22),
    hit: () => { noise(0.08, 3000, 1500, 0.35, 'highpass'); tone(0.09, 220, 90, 0.35, 'square'); },
    hitHeavy: () => { noise(0.25, 2000, 200, 0.5); tone(0.3, 120, 35, 0.6); },
    slam: () => { noise(0.6, 800, 60, 0.7, 'lowpass'); tone(0.6, 90, 25, 0.8); },
    fire: () => noise(0.3, 600, 2500, 0.25),
    jump: () => tone(0.15, 300, 600, 0.12, 'triangle'),
    hurt: () => { tone(0.2, 500, 180, 0.25, 'square'); noise(0.12, 1500, 500, 0.2); },
    die: () => { tone(0.25, 700, 120, 0.2, 'triangle'); noise(0.2, 2500, 400, 0.15); },
    pickup: () => { [660, 880, 1320].forEach((f, i) => tone(0.18, f, f, 0.15, 'triangle', i * 0.07)); },
    transform: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(0.3, f, f * 1.01, 0.12, 'triangle', i * 0.06)); noise(0.6, 400, 4000, 0.15); },
    blip: () => tone(0.03, 900, 900, 0.04, 'square'),
    select: () => tone(0.08, 660, 990, 0.12, 'triangle'),
    lvup: () => { [523, 659, 784, 1046].forEach((f, i) => tone(0.25, f, f, 0.16, 'square', i * 0.09)); },
    heal: () => { [784, 988, 1175].forEach((f, i) => tone(0.2, f, f, 0.12, 'sine', i * 0.08)); },
    warn: () => { tone(0.25, 220, 200, 0.2, 'sawtooth'); tone(0.25, 220, 200, 0.2, 'sawtooth', 0.3); },
  };
  function sfx(name) { if (!ctx || muted) return; try { SFX[name] && SFX[name](); } catch (e) {} }

  return { init, resume, playBgm, sfx, toggleMute, get muted() { return muted; } };
})();
