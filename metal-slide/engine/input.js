/* METAL SLIDE engine: input.
   One virtual pad fed by the keyboard, a gamepad and the touch pad. Keys are matched by
   physical position (e.code), so WASD works on AZERTY too. Two modes:
   - scene (dialogue): keys advance or rewind lines;
   - play (a play segment): run, jump, crouch, fire.
   Presentation clickers send PageDown/PageUp and work in both.
   Any input also wakes the game from demo mode; that input is swallowed. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // Physical key -> action.
  var CODES = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyX: 'jump', KeyK: 'jump',
    KeyZ: 'fire', KeyJ: 'fire', Enter: 'fire', NumpadEnter: 'fire',
    PageDown: 'next', PageUp: 'back', Backspace: 'back', KeyP: 'back', KeyN: 'next',
    KeyM: 'mute', KeyF: 'full', Backquote: 'notes', Home: 'home'
  };
  // Fallback when e.code is empty (some virtual keyboards).
  var KEYS = {
    ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
    ' ': 'jump', x: 'jump', k: 'jump', z: 'fire', j: 'fire', Enter: 'fire', PageDown: 'next', PageUp: 'back',
    Backspace: 'back', p: 'back', n: 'next', m: 'mute', f: 'full', '`': 'notes', Home: 'home'
  };

  // Letter, number and symbol keys can be switched off (WCAG 2.1.4: speech input users
  // trip single-character shortcuts by accident). The arrows, Space, Enter, Escape and
  // Page Up/Down still do everything.
  var letterKeys = true;
  function setLetterKeys(on) { letterKeys = !!on; }
  function isCharKey(code, key) {
    if (code) return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote)$/.test(code);
    return (key || '').length === 1 && key !== ' ';
  }

  // A finished touch, classified. dx, dy in CSS px (y grows down), dt in ms. Pure, so Node
  // can test it. Small and quick is a tap, small and long a hold, otherwise the main axis.
  var TAP_SLOP = 14, SWIPE = 28;
  function gesture(dx, dy, dt) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < TAP_SLOP && ay < TAP_SLOP) return dt < 350 ? 'tap' : 'hold';
    if (ax < SWIPE && ay < SWIPE) return 'drift';
    if (ay >= ax) return dy < 0 ? 'up' : 'down';
    return dx > 0 ? 'right' : 'left';
  }

  // What an action means in each mode. Pure, so Node can test it.
  function actionFor(code, key, mode) {
    if (!letterKeys && isCharKey(code, key)) return null;
    if (code === 'Escape' || key === 'Escape') return 'options';
    if (/^[0-9]$/.test(key || '')) return 'jumpto:' + key;
    var a = CODES[code] || KEYS[(key || '').length === 1 ? key.toLowerCase() : key] || null;
    if (!a) return null;
    if (a === 'mute' || a === 'full' || a === 'notes' || a === 'home') return a;
    if (mode === 'play') {
      if (a === 'next') return 'auto';
      if (a === 'up') return 'jump';
      return a; // left, right, down, jump, fire, back
    }
    // scene
    if (a === 'right' || a === 'jump' || a === 'fire' || a === 'next') return 'next';
    if (a === 'left' || a === 'back') return 'back';
    return null; // up, down do nothing in scenes
  }

  // ------------------------------------------------------------- the virtual pad
  function Pad() {
    this.keys = {};        // held physical codes -> action
    this.hOrder = [];      // horizontal codes, most recent last
    this.touch = { left: false, right: false, down: false, jump: false, fire: false };
    this.gp = { left: false, right: false, down: false, jump: false, fire: false };
    this.presses = { jump: 0, fire: 0 };
    this.runner = 0;       // touch play: Sam runs this way by himself (1, -1, or 0 for off)
  }
  // scene: true when the key acts as Next in a story scene. It is still held (so a
  // direction held into play carries over), but never counts as a jump or a shot later.
  Pad.prototype.press = function (code, action, scene) {
    if (this.keys[code]) return false; // already held: a repeat
    this.keys[code] = action;
    if (action === 'left' || action === 'right') this.hOrder.push(code);
    if (!scene && (action === 'jump' || action === 'up')) this.presses.jump++;
    if (!scene && action === 'fire') this.presses.fire++;
    return true;
  };
  Pad.prototype.release = function (code) {
    delete this.keys[code];
    var i = this.hOrder.indexOf(code);
    if (i >= 0) this.hOrder.splice(i, 1);
  };
  Pad.prototype.clear = function () {
    this.keys = {}; this.hOrder = [];
    this.touch = { left: false, right: false, down: false, jump: false, fire: false };
    this.gp = { left: false, right: false, down: false, jump: false, fire: false };
    this.presses = { jump: 0, fire: 0 };
  };
  Pad.prototype.heldAction = function (action) {
    for (var c in this.keys) if (this.keys[c] === action) return true;
    return false;
  };
  Pad.prototype.any = function () {
    var t = this.touch, g = this.gp;
    return Object.keys(this.keys).length > 0 || t.left || t.right || t.down || t.jump || t.fire || g.left || g.right || g.down || g.jump || g.fire;
  };
  // The controls the player controller reads. One-shot presses are consumed here.
  Pad.prototype.read = function () {
    var last = this.hOrder.length ? this.keys[this.hOrder[this.hOrder.length - 1]] : null;
    var t = this.touch, g = this.gp;
    var run = !last && !t.down ? this.runner : 0; // the runner (1, -1): on by himself, stopped by a duck
    var left = last === 'left' || ((t.left || g.left || run < 0) && !last);
    var right = last === 'right' || ((t.right || g.right || run > 0) && !last);
    var c = {
      left: left && !right, right: right && !left,
      down: this.heldAction('down') || t.down || g.down,
      jump: this.heldAction('jump') || this.heldAction('up') || t.jump || g.jump,
      fire: this.heldAction('fire') || t.fire || g.fire,
      jumpPressed: this.presses.jump > 0, firePressed: this.presses.fire > 0,
      runner: !!run // the movement is the runner's, not the player's hand
    };
    this.presses.jump = 0; this.presses.fire = 0;
    return c;
  };

  var pad = new Pad();
  var game = null;

  // Touch buttons: pad('jump'|'fire'|'left'|'right'|'down', isDown)
  function touchPad(action, down) {
    if (!game) return;
    game.lastDevice = 'touch';
    if (down && game.wake()) return;
    if (down && !pad.touch[action]) {
      var playing = game.director.isPlaying();
      if (playing && action === 'jump') pad.presses.jump++;
      if (playing && action === 'fire') pad.presses.fire++;
      if (action === 'fire' && !playing) game.next(); // fire advances lines too
    }
    pad.touch[action] = !!down;
    game.idle = 0;
  }
  // Touch d-pad: dir is null | 'left' | 'right' | 'down'
  function dpad(dir) {
    if (!game) return;
    game.lastDevice = 'touch';
    if (dir && game.wake()) return;
    pad.touch.left = dir === 'left'; pad.touch.right = dir === 'right'; pad.touch.down = dir === 'down';
    if (dir) game.idle = 0;
  }

  // Gamepad (standard mapping), polled every fixed step. Optional everywhere.
  var gpPrev = {};
  function pollGamepad() {
    if (!game || !navigator.getGamepads) return;
    var list;
    try { list = navigator.getGamepads(); } catch (e) { return; }
    var now = { left: false, right: false, down: false, jump: false, fire: false, start: false, select: false };
    for (var i = 0; list && i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var b = function (n) { return !!(p.buttons[n] && p.buttons[n].pressed); };
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      now.left = now.left || b(14) || ax < -0.5;
      now.right = now.right || b(15) || ax > 0.5;
      now.down = now.down || b(13) || ay > 0.6;
      now.jump = now.jump || b(0);
      now.fire = now.fire || b(2) || b(1);
      now.start = now.start || b(9);
      now.select = now.select || b(8);
    }
    var changed = false;
    for (var k in now) if (now[k] !== !!gpPrev[k]) changed = true;
    if (changed) {
      game.lastDevice = 'pad';
      var pressed = function (k) { return now[k] && !gpPrev[k]; };
      var anyPress = pressed('jump') || pressed('fire') || pressed('start') || pressed('select') || pressed('left') || pressed('right');
      if (anyPress && game.wake()) { gpPrev = now; return; }
      if (anyPress) game.idle = 0;
      var playing = game.director.isPlaying();
      if (pressed('select')) game.toggleWatch();
      else if (!playing && (pressed('jump') || pressed('fire') || pressed('start'))) game.next();
      else if (playing && pressed('start')) game.next();
      if (playing && pressed('jump')) pad.presses.jump++;
      if (playing && pressed('fire')) pad.presses.fire++;
    }
    pad.gp = { left: now.left, right: now.right, down: now.down, jump: now.jump, fire: now.fire };
    if (pad.gp.left || pad.gp.right || pad.gp.jump || pad.gp.fire) game.idle = 0;
    gpPrev = now;
  }

  function bind(g, stage, controlsEl) {
    game = g;
    var d = g.director;
    function unlock() { if (MS.audio) MS.audio.unlock(); }
    var rightDownAt = 0;

    window.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (t && t.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter')) return; // let the button act
      if (t && t.tagName === 'A' && (e.code === 'Enter' || e.key === 'Enter')) return; // let the link open
      if (g.paused) return; // the Options dialog has the keyboard
      if (!letterKeys && isCharKey(e.code, e.key)) return;
      // On the world map the keys mean what they do in a scene: Next, Back, digits.
      var mode = g.screen !== 'map' && d.isPlaying() ? 'play' : 'scene';
      var raw = CODES[e.code] || KEYS[(e.key || '').length === 1 ? e.key.toLowerCase() : e.key];
      var act = actionFor(e.code, e.key, mode);
      if (!act && !raw) return;
      e.preventDefault();
      g.lastDevice = 'key';
      g.idle = 0;
      unlock();
      var fresh = raw ? pad.press(e.code || e.key, raw, mode !== 'play') : true;
      if (e.code === 'PageDown' || e.code === 'PageUp') g.presenter = true;
      if (g.wake()) { pad.presses.jump = 0; pad.presses.fire = 0; return; }
      if (!fresh || e.repeat) return;
      if (act && act.indexOf('jumpto:') === 0) { pad.clear(); g.jump(Number(act.slice(7))); return; }
      switch (act) {
        case 'mute': g.toggleMute(); return;
        case 'full': g.fullscreen(); return;
        case 'notes': g.toggleDebug(); return;
        case 'options': pad.clear(); g.openOptions(); return;
        case 'home': pad.clear(); g.jump(0); return;
        case 'next': g.next(); return;
        case 'back': pad.clear(); g.back(); return;
        case 'auto': g.next(); return;
      }
      if (mode === 'play' && raw === 'right' && g.presenter) rightDownAt = Date.now();
    });

    window.addEventListener('keyup', function (e) {
      pad.release(e.code || e.key);
      // Clickers that send arrows: a quick tap of → in play counts as "auto-run".
      if (g.presenter && rightDownAt && (CODES[e.code] === 'right') && Date.now() - rightDownAt < 150 && d.isPlaying()) g.next();
      rightDownAt = 0;
    });
    function clearAll() { pad.clear(); }
    window.addEventListener('blur', clearAll);
    window.addEventListener('pagehide', clearAll);
    window.addEventListener('contextmenu', clearAll);
    document.addEventListener('visibilitychange', function () { if (document.hidden) clearAll(); });

    // The stage: mouse clicks and touches. Touch play is a runner (Sam runs by himself):
    // a touch fires on contact and keeps firing while held, a swipe up jumps, a swipe down
    // ducks while the finger stays down. In scenes a tap reads on and a swipe right goes back.
    var down = null;
    function touchEnd() { pad.touch.fire = false; pad.touch.jump = false; pad.touch.down = false; }
    stage.addEventListener('pointerdown', function (e) {
      if (controlsEl.contains(e.target)) return;
      if (g.screen === 'map') { g.wake(); down = null; return; } // the map's own buttons do the work
      var touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      g.lastDevice = touch ? 'touch' : 'key';
      var appEl = document.getElementById('app');
      if (touch && !appEl.classList.contains('touch')) {
        appEl.classList.add('touch');
        window.dispatchEvent(new Event('resize'));
      }
      g.idle = 0;
      down = { x: e.clientX, y: e.clientY, t: e.timeStamp || Date.now(), touch: touch, id: e.pointerId };
      unlock();
      if (g.wake()) { down = null; return; }
      if (d.isPlaying()) { pad.presses.fire++; pad.touch.fire = true; down.fired = true; }
      if (touch && stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id || !d.isPlaying()) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dy) < SWIPE || Math.abs(dy) < Math.abs(dx)) return;
      if (dy < 0 && !down.jumped) { down.jumped = true; pad.presses.jump++; pad.touch.jump = true; pad.touch.fire = false; }
      if (dy > 0 && !down.ducked) { down.ducked = true; pad.touch.down = true; pad.touch.fire = false; }
    });
    function up(e) {
      touchEnd();
      if (!down || controlsEl.contains(e.target) || g.screen === 'map') { down = null; return; }
      if (e.button !== undefined && e.button > 0) { down = null; return; }
      var gst = gesture(e.clientX - down.x, e.clientY - down.y, (e.timeStamp || Date.now()) - down.t);
      var fired = down.fired;
      down = null;
      if (fired) return; // in play the touch already did its job
      if (gst === 'right') g.back(); else if (gst !== 'up' && gst !== 'down') g.next();
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', function () { touchEnd(); down = null; });
    // iOS only unlocks audio from a touchend or click, not a pointerdown.
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('click', unlock);

    controlsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (e.detail > 0) b.blur(); // a mouse click shouldn't leave focus that swallows Space
      unlock();
      g.idle = 0;
      var act = b.getAttribute('data-act');
      if (act === 'options') { g.openOptions(); return; }
      if (act === 'map') { g.wake(); g.openMap(); return; }
      if (act === 'watch') { g.toggleWatch(); g.poke(); return; }
      if (g.wake()) return;
      if (act === 'next') g.next();
      else if (act === 'back') g.back();
      else if (act === 'sound') g.toggleMute();
      else if (act === 'full') g.fullscreen();
      g.poke();
    });
  }

  MS.input = {
    bind: bind, actionFor: actionFor, Pad: Pad, pad: touchPad, dpad: dpad, pollGamepad: pollGamepad,
    setLetterKeys: setLetterKeys, letterKeys: function () { return letterKeys; }, gesture: gesture,
    setRunner: function (dir) { pad.runner = dir || 0; },
    controls: function () { return pad.read(); }, any: function () { return pad.any(); },
    release: function () { pad.clear(); }, state: pad,
    dropPresses: function () { pad.presses.jump = 0; pad.presses.fire = 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
