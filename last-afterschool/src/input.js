// キーボード / タッチ / ゲームパッド を共通の「ボタン」にまとめる
const Input = (() => {
  const held = {}, pressed = {};
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', KeyE: 'down',
    KeyZ: 'attack', KeyJ: 'attack', KeyX: 'kick', KeyK: 'kick',
    KeyC: 'jump', Space: 'jump', KeyV: 'special', KeyL: 'special',
    KeyQ: 'swap', ShiftLeft: 'run', ShiftRight: 'run',
    Enter: 'ok', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
  };
  let lastRightTap = 0, lastLeftTap = 0, dashLatch = false;

  function down(btn) {
    if (!held[btn]) {
      pressed[btn] = true;
      const now = performance.now();
      if (btn === 'right') { if (now - lastRightTap < 260) dashLatch = true; lastRightTap = now; }
      if (btn === 'left') { if (now - lastLeftTap < 260) dashLatch = true; lastLeftTap = now; }
    }
    held[btn] = true;
  }
  function up(btn) {
    held[btn] = false;
    if (btn === 'left' || btn === 'right') dashLatch = false;
  }

  addEventListener('keydown', e => {
    const b = KEYMAP[e.code];
    if (b) { e.preventDefault(); if (!e.repeat) down(b); }
    Audio2.unlock();
  });
  addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) up(b); });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });

  // ---- touch buttons (built in index.html as [data-btn]) ----
  function bindTouch() {
    document.querySelectorAll('[data-btn]').forEach(el => {
      const b = el.dataset.btn;
      const on = e => { e.preventDefault(); Audio2.unlock(); try { el.setPointerCapture(e.pointerId); } catch (_) {} down(b); el.classList.add('on'); };
      const off = e => { e.preventDefault(); up(b); el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  // ---- gamepad ----
  const padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) return;
    const ax = p.axes[0] || 0;
    const map = {
      left: ax < -0.4 || (p.buttons[14] && p.buttons[14].pressed),
      right: ax > 0.4 || (p.buttons[15] && p.buttons[15].pressed),
      down: (p.axes[1] || 0) > 0.5 || (p.buttons[13] && p.buttons[13].pressed),
      jump: p.buttons[0] && p.buttons[0].pressed,
      attack: p.buttons[2] && p.buttons[2].pressed,
      kick: p.buttons[1] && p.buttons[1].pressed,
      special: p.buttons[3] && p.buttons[3].pressed,
      swap: p.buttons[5] && p.buttons[5].pressed,
      run: p.buttons[7] && p.buttons[7].pressed,
      pause: p.buttons[9] && p.buttons[9].pressed,
      ok: p.buttons[0] && p.buttons[0].pressed,
    };
    for (const k in map) {
      if (map[k] && !padPrev[k]) down(k);
      if (!map[k] && padPrev[k]) up(k);
      padPrev[k] = map[k];
    }
  }

  return {
    held, bindTouch, pollPad,
    hit(btn) { return !!pressed[btn]; },
    // 決定キー：Z / Enter / Space / タップ
    confirm() { return pressed.ok || pressed.attack || pressed.jump; },
    get dash() { return dashLatch || held.run; },
    endFrame() { for (const k in pressed) pressed[k] = false; },
    tap() { pressed.ok = true; },
  };
})();
