/* METAL SLIDE set: Mission 4, THE SIEGE. Midnight in the company's city, 2200px wide.
   A moonlit skyline, lit office windows, and a street of storefronts, each one of the
   company's websites (generic names only). Left to right: the company HQ, seven storefronts
   whose doors are broken (a missing alt text, low contrast, no focus ring, no label, a
   keyboard trap, no captions, a "click here" link), the all-night cafe where the night shift
   hides under its site status board, their office-furniture barricade, a closed block, the
   civic plaza (the arena) and the city gate.
   The boss is legal risk with legs: reams of paper for legs, ring binders for feet, a bound
   contract for a chest, a giant binder clip for shoulders and a red wax-seal eye. Nobody is
   inside it. Its weak points are accessibility failures; fix them all and it collapses into
   a harmless pile of paper that files itself away. A gate (level.gates) stands over its body
   until every weak point is fixed.
   Story state: w.state.robot (0 before it arrives, 1 in place), w.state.locked (the doors
   lock) and w.state.fixed. Everything else (sway, collapse progress, flying paper) is
   cosmetic and lives on w.siegeFx, so rewind and replay draw it the same.
   Events: [the robot arrives] (it stomps into the plaza) and [the doors lock]. */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint, C = MS.color, U = MS.util;
  var W = MS.W, H = MS.H;
  var G = 156;          // where feet stand
  var LIP = 146;        // the back edge of the sidewalk: the 1px dark lip
  var CURB = 172;       // the front edge of the sidewalk
  var WIDTH = 2200;

  // Story places, left to right. The night shift waits between the street and the
  // barricade, so the street pan and the barricade scene both frame them.
  var M = { hq: 56, street: 900, barricade: 1000, arena: 1500, gate: 1960 };
  var SKY_SPEED = 0.04, FAR_SPEED = 0.1, MID_SPEED = 0.25, BACK_SPEED = 0.5, FRONT_SPEED = 1.3;

  // ------------------------------------------------------------ colors
  var INK = '#0d0b1a';
  var PAPER = '#f2ead6', PAPER_HI = '#fffaf0', PAPER_SH = '#d6cab0', PAPER_DK = '#ada08a', PRINT = '#8c8270';
  var BINDER = '#2f4f9a', BINDER_HI = '#5a7ac8', BINDER_DK = '#1c2f66';
  var CLIPC = '#1c1c28', STEEL = '#c8ccd8', STEEL_DK = '#8a90a6';
  var WAX = '#c4202e', WAX_DK = '#7a1020', WAX_HI = '#ff7070';
  var KRAFT = '#b8864c', KRAFT_DK = '#8a6034', KRAFT_HI = '#d8aa70';
  var TAB_Y = '#f2c83c', TAB_P = '#f27ab4', TAB_G = '#6ad070';
  var RED = '#e8323c', RED_DK = '#9a1a26', OK = '#3ad070', OK_DK = '#1a8a44', FOCUS = '#5ad8ff';
  var LAMP = '#ffe6a0', WARM = '#ffd27a', WARM_HI = '#fff0c0', COOL = '#9ad8ff', DARKWIN = '#1a2048';
  var WHITE = '#ffffff';

  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function r(g, x, y, w, h, c) { if (w > 0 && h > 0) P.rect(g, x, y, w, h, c); }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function fillA(g, x, y, w, h, rgba) { g.fillStyle = rgba; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function disc(g, cx, cy, rad, c) {
    for (var y = -rad; y <= rad; y++) {
      var ww = Math.round(Math.sqrt(rad * rad - y * y) * 2);
      if (ww > 0) r(g, cx - ww / 2, cy + y, ww, 1, c);
    }
  }
  // A thick pixel line.
  function line(g, x0, y0, x1, y1, c, t) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    t = t || 1;
    g.fillStyle = c;
    for (var i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t, t);
  }
  function rgba(hex, a) { var c = C.rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  // Soft light, fading out from the center (the modern era is full color, so alpha is fine).
  function glow(g, cx, cy, rad, col, strength) { P.radial(g, cx, cy, rad, rgba(col, strength)); }
  // The same, squashed into an ellipse: pools of light on the pavement.
  function pool(g, cx, cy, rx, ry, col, strength) {
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    P.radial(g, 0, 0, rx, rgba(col, strength));
    g.restore();
  }

  // Ring everything painted on a canvas with a 1px dark outline, Metal Slug style.
  function outline(c, ink) {
    var g = c.getContext('2d');
    var cw = c.width, ch = c.height;
    var d = g.getImageData(0, 0, cw, ch).data;
    var on = new Uint8Array(cw * ch);
    for (var i = 0; i < cw * ch; i++) on[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    g.fillStyle = ink || INK;
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      if (on[y * cw + x]) continue;
      if ((x > 0 && on[y * cw + x - 1]) || (x < cw - 1 && on[y * cw + x + 1]) ||
        (y > 0 && on[(y - 1) * cw + x]) || (y < ch - 1 && on[(y + 1) * cw + x])) g.fillRect(x, y, 1, 1);
    }
    return c;
  }
  // Paint a w x h thing into its own canvas (1px margin for the outline), outlined.
  function stamp(w, h, paint, ink) {
    var c = canvas(w + 2, h + 2), g = c.getContext('2d');
    g.save(); g.translate(1, 1); paint(g, w, h); g.restore();
    return outline(c, ink);
  }

  // ------------------------------------------------------------ tiny 3x5 lettering
  var TINY = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110', '?': '110001010000010', '!': '010010010000010', ':': '000010000010000', '.': '000000000000010',
    '-': '000000111000000', '/': '001001010100100', "'": '010010000000000', '_': '000000000000111', '+': '000010111010000',
    '<': '001010100010001', '>': '100010001010100', '=': '000111000111000', ',': '000000000010100', '(': '010100100100010',
    ')': '010001001001010'
  };
  function tiny(g, text, x, y, col) {
    g.fillStyle = col;
    text = String(text).toUpperCase();
    var cx = Math.round(x), cy = Math.round(y);
    for (var i = 0; i < text.length; i++) {
      var b = TINY[text[i]];
      if (b) for (var k = 0; k < 15; k++) if (b.charAt(k) === '1') g.fillRect(cx + k % 3, cy + Math.floor(k / 3), 1, 1);
      cx += text[i] === ' ' ? 3 : 4;
    }
  }
  function tinyW(text) { var w = 0; String(text).split('').forEach(function (ch) { w += ch === ' ' ? 3 : 4; }); return Math.max(0, w - 1); }
  function tinyC(g, text, cx, y, col) { tiny(g, text, Math.round(cx - tinyW(text) / 2), y, col); }
  // A 5x4 check mark.
  function check(g, x, y, col) {
    px(g, x + 4, y, col); px(g, x + 3, y + 1, col); px(g, x, y + 1, col); px(g, x + 1, y + 2, col); px(g, x + 2, y + 2, col); px(g, x + 2, y + 3, col);
  }
  // A padlock, 9x11. Closed: green with a check. Open: red, the shackle up and swung aside.
  function padlock(g, x, y, closed) {
    x = Math.round(x); y = Math.round(y);
    var body = closed ? OK : RED, dark = closed ? OK_DK : RED_DK;
    var sx = closed ? x + 2 : x + 4, sy = closed ? y : y - 3;
    r(g, sx - 1, sy - 1, 7, 7, INK); r(g, sx, sy, 5, 6, STEEL); r(g, sx + 1, sy + 1, 3, 5, INK);
    r(g, x - 1, y + 4, 11, 8, INK); r(g, x, y + 5, 9, 6, body); r(g, x, y + 5, 9, 1, C.mix(body, WHITE, 0.4)); r(g, x, y + 10, 9, 1, dark);
    if (closed) check(g, x + 2, y + 6, WHITE);
    else { r(g, x + 4, y + 7, 1, 2, INK); px(g, x + 4, y + 6, INK); }
  }

  // A 5x6 closed padlock for small screens.
  function miniLock(g, x, y) {
    r(g, x + 1, y, 3, 1, STEEL); px(g, x + 1, y + 1, STEEL); px(g, x + 3, y + 1, STEEL);
    r(g, x, y + 2, 5, 4, OK); px(g, x + 2, y + 3, '#0e3424');
  }

  // ------------------------------------------------------------ the storefronts (websites)
  // Each storefront is one of the company's websites. The broken thing in it is a level target;
  // after [the doors lock] each gets a padlock.
  var STORES = [
    { x: 160, w: 96, name: 'SHOP', brand: '#ff5ab0', awn: ['#b8285e', '#f6e2ea'], top: 36, mat: 'brick', target: 'st-shop' },
    { x: 262, w: 96, name: 'HELP', brand: '#5af0ff', awn: ['#246ea8', '#e4f2fa'], top: 46, mat: 'concrete', target: 'st-help' },
    { x: 364, w: 92, name: 'BLOG', brand: '#ffb040', awn: ['#c0641a', '#f8ead6'], top: 28, mat: 'panel', target: 'st-blog' },
    { x: 462, w: 96, name: 'JOBS', brand: '#7aff8a', awn: ['#22804a', '#e4f6ea'], top: 40, mat: 'brick2', target: 'st-jobs' },
    { x: 564, w: 92, name: 'DOCS', brand: '#c89aff', awn: ['#563a9c', '#efe8fa'], top: 32, mat: 'concrete', target: 'st-docs' },
    { x: 662, w: 96, name: 'NEWS', brand: '#ff6a5a', awn: ['#aa2e28', '#faeae6'], top: 48, mat: 'brick', target: 'st-news' },
    { x: 764, w: 92, name: 'EVENTS', brand: '#ffe05a', awn: ['#a8841a', '#faf2d8'], top: 38, mat: 'panel', target: 'st-events' }
  ];
  function doorX(s) { return s.x + s.w - 30; }

  // ------------------------------------------------------------ level data
  // Things to jump, drawn by this set exactly over their boxes (h <= 24). None sits in the
  // 70px run-up to a standing target, so the demo never hops past one.
  var SOLIDS = [
    { x: 236, w: 18, h: 12, kind: 'papers' },
    { x: 452, w: 10, h: 14, kind: 'hydrant' },
    { x: 528, w: 22, h: 20, kind: 'bins' },
    { x: 690, w: 28, h: 18, kind: 'barrier' },
    // the night shift's barricade (Sam stops at the barricade mark, just short of it)
    { x: 1028, w: 32, h: 24, kind: 'barricade' },
    { x: 1176, w: 28, h: 18, kind: 'barrier' },
    { x: 1352, w: 22, h: 14, kind: 'notices' }
  ];

  // The boss, standing in the plaza. Rest positions of its parts, in world pixels.
  var RB = {
    footF: { x: 1556, y: 147, w: 36, h: 9 },
    footB: { x: 1606, y: 147, w: 36, h: 9 },
    legF: { x: 1566, y: 112, w: 22, h: 36 },
    legB: { x: 1613, y: 112, w: 22, h: 36 },
    hips: { x: 1562, y: 97, w: 80, h: 17 },
    torso: { x: 1564, y: 56, w: 76, h: 42 },
    clip: { x: 1560, y: 49, w: 84, h: 9 },
    head: { x: 1584, y: 25, w: 38, h: 26 },
    board: { x: 1542, y: 92, w: 30, h: 24 }
  };
  var ROBOT_X0 = 1532, ROBOT_X1 = 1688;      // its drawn extent, arms included
  var SHOULDER_F = [1568, 62], HAND_F = [1558, 92];
  var SHOULDER_B = [1638, 62];
  var ARM_B = { rest: [[1656, 54], [1666, 40]], wind: [[1660, 48], [1676, 28]], toss: [[1648, 46], [1638, 30]] };
  var EYE = { x: 1595, y: 36 };
  var ARRIVE_DX = 300, ARRIVE_DUR = 3.2, STEPS = 4;
  var COLLAPSE_DUR = 2.4;
  var PILE = { x: 1528, w: 160, h: 36 };
  var ARCHIVE = { x: 1796, w: 30, h: 18 };

  // Blastable things. Standing shots fly 23px above the feet (y 133), so a standing target
  // reaches down to y 131 or lower; the high ones need a jump (the apex reaches about y 75).
  // label is what pops when it's fixed; look picks the drawing.
  var STORE_TARGETS = [
    { id: 'st-shop', x: 186, y: 112, w: 22, h: 20, look: 'img', label: 'ALT TEXT' },
    { id: 'st-help', x: 295, y: 80, w: 30, h: 14, look: 'contrast', label: '4.5:1' },
    { id: 'st-blog', x: 426, y: 114, w: 20, h: 18, look: 'focus', label: 'FOCUS' },
    { id: 'st-jobs', x: 484, y: 100, w: 26, h: 16, look: 'label', label: 'LABEL' },
    { id: 'st-docs', x: 625, y: 118, w: 22, h: 16, look: 'trap', label: 'NO TRAP' },
    { id: 'st-news', x: 680, y: 74, w: 30, h: 20, look: 'captions', label: 'CAPTIONS' },
    { id: 'st-events', x: 788, w: 24, h: 22, look: 'link', label: 'LINK TEXT' }
  ].map(function (t) { t.kind = 'siegedoor'; t.hp = 1; return t; });

  // The boss's weak points: accessibility failures. Two standing, three for a jump; every
  // jump one sits within a hop of where the gate stops Sam, and all of them sit ahead of it.
  // Hits to fix: 3 standing (easy from range), 2 for the big chest panel, 1 for the two small
  // panels a hop only passes once each way, so the demo never stalls at the gate.
  var WEAK = [
    { id: 'wp-trap', x: 1566, y: 120, w: 22, h: 14, look: 'trap', part: 'legF', fail: 'KEYBOARD TRAP', label: 'NO TRAP' },
    { id: 'wp-contrast', x: 1612, y: 118, w: 24, h: 16, look: 'contrast', part: 'legB', fail: 'CONTRAST 2:1', label: '4.5:1' },
    { id: 'wp-label', x: 1546, y: 98, w: 22, h: 14, look: 'label', part: 'board', fail: 'NO LABEL', label: 'LABEL' },
    { id: 'wp-focus', x: 1576, y: 100, w: 26, h: 12, look: 'focus', part: 'hips', fail: 'NO FOCUS', label: 'FOCUS' },
    { id: 'wp-alt', x: 1572, y: 64, w: 30, h: 22, look: 'alt', part: 'torso', fail: 'NO ALT TEXT', label: 'ALT TEXT' }
  ].map(function (t) { t.kind = 'siegeweak'; t.hp = t.y + t.h > 130 ? 3 : t.h >= 20 ? 2 : 1; t.weak = true; return t; });
  var WEAK_IDS = WEAK.map(function (t) { return t.id; });

  var TARGETS = STORE_TARGETS.concat(WEAK);
  var BY_ID = {};
  TARGETS.forEach(function (t) { BY_ID[t.id] = t; });

  // The robot's body is a wall until every weak point is fixed (see MS.player.solidsOf).
  var GATES = [{ x: 1544, w: 100, h: 130, until: WEAK_IDS }];

  function allFixed(w) {
    var f = w.state.fixed || {};
    for (var i = 0; i < WEAK_IDS.length; i++) if (!f[WEAK_IDS[i]]) return false;
    return true;
  }
  function siegeFx(w) { return w.siegeFx || (w.siegeFx = { steam: 0, sheet: 0, sheets: [] }); }
  // Notice when the last weak point is fixed (live), so the collapse can play. A fresh world
  // (a rewind, a mission jump) starts already collapsed: nothing replays.
  function track(w) {
    var fx = siegeFx(w), all = allFixed(w);
    if (fx.all == null) { fx.all = all; return fx; }
    if (all && !fx.all) { fx.all = true; fx.collapseAt = w.time; fx.cues = {}; }
    else if (!all && fx.all) { fx.all = false; fx.collapseAt = null; }
    return fx;
  }

  // Night-shift people met on the way: they notice Sam, scream and run off ahead of him.
  // Each stands just past a standing target, so its bolts aren't lost on them.
  var EXTRAS = [
    { id: 'sg-coffee', costume: 'worker3', x: 336, facing: -1, loaf: 'idle', held: 'coffee', line: 'IT HAS LEGS!' },
    { id: 'sg-gossip1', costume: 'pm', x: 824, facing: 1, loaf: 'gossip', held: 'coffee', line: 'WHO CALLED LEGAL?!' },
    { id: 'sg-gossip2', costume: 'worker1', x: 844, facing: -1, loaf: 'gossip', line: 'I READ THE TERMS!' },
    { id: 'sg-mover', costume: 'worker3', x: 1250, facing: -1, loaf: 'idle', held: 'boxes', line: 'MY FILES!' }
  ];
  function spawn(w, fromX, toX) {
    if (!MS.enemies || !MS.enemies.make) return [];
    return EXTRAS.filter(function (e) { return e.x > fromX + 40 && e.x < toX + 8; }).map(function (e) {
      return MS.enemies.make(e.id, { costume: MS.costumes && MS.costumes[e.costume] ? e.costume : 'worker1', x: e.x, facing: e.facing, loaf: e.loaf, held: e.held, line: e.line });
    });
  }

  // The night shift cheers Sam on as he runs past (play only: settle clears playAnim), and
  // the robot lobs legal notices at him: they stagger, never hurt, and a bolt pops them.
  var FANS = { WORKER1: 'cheer', WORKER2: 'point', DESIGNER: 'wave', DEVELOPER: 'cheer', PM: 'clap' };
  var THROW_EVERY = [2.6, 2.2, 2.9], THROW_RANGE = 320, THROW_FROM = 1250, WIND = 0.4;
  function robotActive(w) { return (w.state.robot || 0) >= 1 && !allFixed(w); }
  function levelUpdate(w, dt, play) {
    var sam = w.actors.SAM;
    if (!sam || !play) return;
    Object.keys(FANS).forEach(function (id) {
      var a = w.actors[id];
      if (!a || !a.visible || a.playAnim) return;
      if (Math.abs(sam.x - a.x) < 50) a.playAnim = FANS[id];
    });
    var fx = siegeFx(w);
    fx.windup = null;
    if (w.instant || !robotActive(w) || play.dir < 0 || sam.x < THROW_FROM) return;
    if (Math.abs(sam.x - ARM_B.rest[1][0]) > THROW_RANGE) return;
    if (play.siegeT == null) { play.siegeT = 1.2; play.siegeN = 0; }
    play.siegeT -= dt;
    fx.windup = play.siegeT;
    if (play.siegeT > 0) return;
    play.siegeN++;
    play.siegeT = THROW_EVERY[play.siegeN % THROW_EVERY.length];
    lob(w, play, sam.x, 1.15);
    if (play.siegeN % 3 === 0) lob(w, play, sam.x - 26, 1.4); // now and then a second one, short
    fx.throwAt = w.time;
    w.sfx('paper');
  }
  function lob(w, play, tx, T) {
    var x0 = ARM_B.rest[1][0] - 4, y0 = ARM_B.rest[1][1] - 4, arc = 22;
    var vx = U.clamp((tx - x0) / T, -180, 180);
    play.thrown.push({ x: x0, y: y0, vx: vx, vy: -4 * arc / T + (G - 12 - y0) / T, g: 8 * arc / (T * T), t: 0, dead: false, look: 'notice' });
  }

  // A fixed storefront sparkles; a weak point blows a puff of paper and the robot flinches.
  function onHit(w, t) {
    if (w.instant) return;
    var y = t.y != null ? t.y : G - t.h, cx = t.x + t.w / 2, cy = y + t.h / 2;
    if (t.weak) {
      siegeFx(w).flinchAt = w.time;
      if (w.explode) w.explode(cx, cy, 'small');
      if (w.burst) w.burst(cx, cy, 10, { kind: 'confetti', colors: [PAPER, PAPER_SH, PAPER_HI], speed: 80, g: 160, life: 0.9 });
      w.sfx('paper');
    } else if (w.burst) {
      w.burst(cx, cy, 10, { kind: 'spark', colors: [WHITE, FOCUS, OK], speed: 80, g: 0, spread: Math.PI * 2, life: 0.45, floor: false });
    }
  }

  // ------------------------------------------------------------ painting helpers
  // A lit or dark office window. Lit ones are warm or cool, with blinds or a plant now and then.
  function win(g, rnd, x, y, w, h, litChance) {
    if (rnd() < litChance) {
      var cool = rnd() < 0.22;
      r(g, x, y, w, h, cool ? COOL : WARM);
      r(g, x, y, w, 1, cool ? '#d8f0ff' : WARM_HI);
      r(g, x, y + h - 1, w, 1, cool ? '#6ab0e0' : '#e0a850');
      var s = rnd();
      if (s < 0.25 && h >= 6) for (var by = y + 2; by < y + h - 1; by += 2) r(g, x, by, w, 1, cool ? '#b8e0fa' : '#f0c060');
      else if (s < 0.38 && w >= 5 && h >= 6) { r(g, x + 1, y + h - 3, 2, 2, '#2a6a3a'); px(g, x + 1, y + h - 4, '#3a8a4a'); px(g, x + 2, y + h - 5, '#3a8a4a'); }
      else if (s < 0.46 && w >= 6 && h >= 7) { r(g, x + w - 4, y + h - 5, 3, 4, '#3a2a30'); px(g, x + w - 3, y + h - 6, '#3a2a30'); }
    } else {
      r(g, x, y, w, h, DARKWIN);
      if (rnd() < 0.35) px(g, x + w - 2, y + 1, '#4a5a9a');
    }
  }

  var MATS = {
    brick: { base: '#5a3a4c', dark: '#442a3a', ledge: '#8a7488' },
    brick2: { base: '#664434', dark: '#4e3228', ledge: '#9a8070' },
    concrete: { base: '#4a5072', dark: '#3a3f5e', ledge: '#7a82a4' },
    panel: { base: '#3c4670', dark: '#2e365a', ledge: '#6e7aa8' }
  };
  // Upper floors over a storefront: wall, cornice, rows of windows, sometimes a fire escape.
  function facade(g, rnd, x, w, top, bottom, mat, escape) {
    var m = MATS[mat];
    r(g, x, top, w, bottom - top, m.base);
    var y;
    if (mat === 'brick' || mat === 'brick2') {
      for (y = top + 2; y < bottom; y += 3) {
        r(g, x, y, w, 1, m.dark);
        for (var bx = x + ((y - top) % 6 ? 2 : 5); bx < x + w; bx += 6) px(g, bx, y - 1, m.dark);
      }
    } else if (mat === 'concrete') {
      for (y = top + 9; y < bottom; y += 18) r(g, x, y, w, 1, m.dark);
      for (var cx = x + 24; cx < x + w; cx += 24) r(g, cx, top, 1, bottom - top, m.dark);
    } else {
      for (var p0 = x + 3; p0 < x + w; p0 += 5) r(g, p0, top, 1, bottom - top, m.dark);
    }
    var ww = mat === 'panel' ? 6 : mat === 'concrete' ? 14 : 9, wh = mat === 'panel' ? 12 : mat === 'concrete' ? 8 : 11;
    var stepX = ww + (mat === 'concrete' ? 6 : 7), stepY = wh + 8;
    var n = Math.max(1, Math.floor((w - 8 + (stepX - ww)) / stepX)), x0 = x + Math.floor((w - (n * stepX - (stepX - ww))) / 2);
    for (y = top + 7; y + wh < bottom - 3; y += stepY) {
      for (var i = 0; i < n; i++) {
        var wx = x0 + i * stepX;
        r(g, wx - 1, y - 1, ww + 2, wh + 2, m.dark);
        win(g, rnd, wx, y, ww, wh, 0.36);
        r(g, wx - 1, y + wh + 1, ww + 2, 1, m.ledge);
      }
    }
    if (escape) {
      var ex = x + Math.floor(w / 2) - 14;
      for (y = top + 18; y < bottom - 6; y += stepY) {
        r(g, ex, y + wh - 2, 28, 2, '#1c1e34'); for (var rx = ex; rx < ex + 28; rx += 3) r(g, rx, y + wh - 7, 1, 5, '#1c1e34');
        r(g, ex, y + wh - 7, 28, 1, '#1c1e34'); line(g, ex + 2, y + wh - 2, ex + 24, y + wh + stepY - 3, '#1c1e34', 1);
      }
    }
    // the cornice
    r(g, x - 2, top - 3, w + 4, 3, m.ledge); r(g, x - 2, top - 3, w + 4, 1, '#a8b0cc'); r(g, x - 2, top, w + 4, 1, INK);
    // rooftop clutter
    var roll = rnd();
    if (roll < 0.35) { var tx = x + 8 + Math.floor(rnd() * (w - 30)); r(g, tx, top - 17, 14, 11, '#3a2e3e'); r(g, tx - 1, top - 19, 16, 3, '#2a2030'); r(g, tx + 2, top - 6, 1, 3, '#2a2030'); r(g, tx + 11, top - 6, 1, 3, '#2a2030'); }
    else if (roll < 0.6) { var ax = x + 10 + Math.floor(rnd() * (w - 20)); r(g, ax, top - 22, 1, 19, '#2a2f4e'); r(g, ax - 3, top - 16, 7, 1, '#2a2f4e'); px(g, ax, top - 23, '#ff5050'); }
    else { r(g, x + 6, top - 7, 12, 4, '#3a4062'); r(g, x + 22, top - 6, 9, 3, '#353b5c'); }
  }

  // Store goods behind the glass, one kind per website.
  function goods(g, s, x0, x1) {
    var y0 = 102, mid = Math.round((x0 + x1) / 2);
    var shelf = '#8a6448';
    if (s.name === 'SHOP') {
      r(g, x0 + 2, 128, x1 - x0 - 4, 2, shelf);
      [[x0 + 3, '#ff5ab0'], [x0 + 12, '#5a8aff'], [x1 - 12, '#ffd04a']].forEach(function (b) { r(g, b[0], 121, 8, 7, b[1]); r(g, b[0], 121, 8, 1, WHITE); });
      r(g, x1 - 10, 108, 7, 4, '#f4f4f8'); r(g, x1 - 10, 111, 8, 1, '#3a3a4a'); r(g, x1 - 8, 104, 4, 3, '#ffd04a'); px(g, x1 - 7, 105, INK);
    } else if (s.name === 'HELP') {
      r(g, x0 + 4, 124, x1 - x0 - 8, 4, '#6a5a7a'); r(g, x0 + 4, 128, 3, 10, '#4a3e5a'); r(g, x1 - 7, 128, 3, 10, '#4a3e5a');
      disc(g, mid, 110, 6, WHITE); r(g, mid - 2, 115, 3, 3, WHITE); tinyC(g, '?', mid + 1, 108, '#246ea8');
      r(g, x0 + 8, 118, 6, 6, '#2a2a3a'); r(g, x0 + 9, 119, 4, 3, '#5af0ff');
    } else if (s.name === 'BLOG') {
      for (var b = 0; b < 3; b++) { r(g, x0 + 3, 110 + b * 9, x1 - x0 - 6, 1, shelf); for (var k = 0; k < 6; k++) r(g, x0 + 4 + k * 5, 104 + b * 9, 3, 6, ['#ffb040', '#5a8aff', '#ff6a5a', '#7aff8a'][(k + b) % 4]); }
      r(g, x1 - 12, 130, 8, 8, '#a0402a'); r(g, x1 - 12, 126, 3, 4, '#a0402a');
    } else if (s.name === 'JOBS') {
      r(g, x0 + 6, 121, x1 - x0 - 12, 9, '#22804a'); tinyC(g, 'HIRING', mid, 123, WHITE);
      r(g, x0 + 4, 134, x1 - x0 - 8, 2, shelf);
    } else if (s.name === 'DOCS') {
      for (var d = 0; d < 3; d++) { r(g, x0 + 3, 112 + d * 9, x1 - x0 - 6, 1, shelf); for (var q = 0; q < 8; q++) r(g, x0 + 4 + q * 5, 105 + d * 9, 4, 7, ['#563a9c', '#2f4f9a', '#a83a3a', '#c8a03a'][(q * 3 + d) % 4]); }
    } else if (s.name === 'NEWS') {
      for (var n = 0; n < 3; n++) { var nx = x0 + 4 + n * 16; r(g, nx, 112, 13, 18, '#f4f0e6'); r(g, nx + 1, 113, 11, 2, INK); r(g, nx + 1, 117, 6, 5, '#7a8aa8'); r(g, nx + 8, 117, 4, 1, '#9a9aa8'); r(g, nx + 8, 119, 4, 1, '#9a9aa8'); r(g, nx + 1, 124, 11, 1, '#9a9aa8'); }
      r(g, x0 + 2, 131, x1 - x0 - 4, 2, shelf);
    } else if (s.name === 'EVENTS') {
      r(g, x0 + 6, 106, 22, 20, WHITE); r(g, x0 + 6, 106, 22, 4, '#a8841a');
      for (var cy = 112; cy < 124; cy += 4) for (var cx = x0 + 8; cx < x0 + 27; cx += 4) r(g, cx, cy, 2, 2, cy === 116 && cx === x0 + 16 ? RED : '#9a9aa8');
      [[x1 - 10, 108, '#ff5ab0'], [x1 - 4, 112, '#5af0ff']].forEach(function (bl) { disc(g, bl[0], bl[1], 3, bl[2]); line(g, bl[0], bl[1] + 3, bl[0] - 2, 130, '#c8c0b0', 1); });
    }
  }

  // A storefront: the sign band is a browser toolbar, an awning, the window, the door.
  function store(g, rnd, s) {
    var x = s.x, w = s.w;
    facade(g, rnd, x, w, s.top, 78, s.mat, s.mat === 'brick');
    // the sign band: three dots and an address bar with the site's name in neon
    r(g, x, 78, w, 14, INK); r(g, x + 1, 79, w - 2, 12, '#1a1c34');
    px(g, x + 4, 84, '#ff5a5a'); px(g, x + 7, 84, '#ffd04a'); px(g, x + 10, 84, '#5ad86a');
    var barX = x + 14, barW = w - 20;
    if (s.name === 'NEWS') { barX = x + 52; barW = w - 56; }
    r(g, barX, 81, barW, 9, '#262a48');
    if (s.name !== 'HELP') {
      glow(g, barX + barW / 2, 85, 22, s.brand, 0.3);
      MS.font.drawCentered(g, s.name, barX + barW / 2 + 1, 83, C.mix(s.brand, '#1a1c34', 0.55));
      MS.font.drawCentered(g, s.name, barX + barW / 2, 82, C.mix(s.brand, WHITE, 0.25));
    }
    // the awning
    for (var ay = 0; ay < 8; ay++) {
      for (var st = 0; st < w + 4; st += 6) r(g, x - 2 + st, 92 + ay, Math.min(6, w + 4 - st), 1, (st / 6) % 2 ? s.awn[1] : s.awn[0]);
    }
    for (var sc = 0; sc < w + 4; sc += 6) { r(g, x - 2 + sc + 1, 100, 4, 1, (sc / 6) % 2 ? s.awn[1] : s.awn[0]); }
    r(g, x - 2, 92, w + 4, 1, C.mix(s.awn[0], WHITE, 0.35));
    // the window, lit from inside
    var wx0 = x + 6, wx1 = doorX(s) - 6;
    r(g, wx0 - 2, 101, wx1 - wx0 + 4, 41, '#24263e');
    P.vgrad(g, wx0, 103, wx1 - wx0, 37, [[0, '#f6e2b0'], [1, '#d8b07a']]);
    goods(g, s, wx0, wx1);
    for (var gx = wx0 + 6; gx < wx1 - 4; gx += 22) for (var gy = 0; gy < 37; gy++) {
      var sx = gx + Math.round((37 - gy) * 0.4);
      if (sx < wx1 - 3) fillA(g, sx, 103 + gy, 3, 1, 'rgba(255,255,255,0.22)');
    }
    r(g, wx0 - 2, 140, wx1 - wx0 + 4, 2, '#4a4e6e');
    // the door
    var dx = doorX(s);
    r(g, dx - 2, 102, 24, 44, '#24263e');
    r(g, dx, 104, 20, 3, LAMP);
    P.vgrad(g, dx, 108, 20, 38, [[0, '#f0d8a0'], [1, '#c8a070']]);
    r(g, dx + 9, 108, 2, 38, '#24263e');
    r(g, dx + 3, 124, 4, 1, STEEL_DK); r(g, dx + 13, 124, 4, 1, STEEL_DK);
    fillA(g, dx + 2, 110, 2, 30, 'rgba(255,255,255,0.25)');
    // the kick plate, and pilasters between shops
    r(g, x, 142, w, 4, '#3a3e5c'); r(g, x, 142, w, 1, '#5a6086');
    r(g, x - 4, 78, 4, LIP - 78, '#2a2e4e'); r(g, x - 4, 78, 1, LIP - 78, '#454a72');
  }

  // Brackets and struts for the targets that hang off a facade (the targets are drawn live).
  function mounts(g) {
    // the HELP sign hangs on a bracket
    r(g, 295 + 4, 76, 1, 4, INK); r(g, 295 + 25, 76, 1, 4, INK); r(g, 292, 75, 36, 2, '#1c1e34');
    // the NEWS screen sits on two struts
    r(g, 686, 70, 2, 5, '#1c1e34'); r(g, 702, 70, 2, 5, '#1c1e34'); r(g, 682, 68, 26, 2, '#1c1e34');
  }

  // ------------------------------------------------------------ the sky
  function cloudBand(g, cx, cy, len, col, lit) {
    for (var i = 0; i < len; i++) {
      var hh = Math.round(2 + Math.sin(i / len * Math.PI) * 3 + Math.sin(i * 0.7) * 1);
      r(g, cx + i, cy - hh, 1, hh, col);
      px(g, cx + i, cy - hh, lit);
    }
  }
  function paintSky(g, w, h) {
    var rnd = U.rng(404);
    P.vgrad(g, 0, 0, w, h, [[0, '#090c24'], [0.3, '#131944'], [0.55, '#20265a'], [0.72, '#33316c'], [0.86, '#4c3f7a'], [1, '#5e4a84']]);
    for (var i = 0; i < 150; i++) {
      var sx = rnd() * w, sy = rnd() * 112, b = rnd();
      px(g, sx, sy, b > 0.88 ? WHITE : b > 0.5 ? '#aab6ea' : '#6672b0');
    }
    [[40, 22], [150, 12], [236, 34], [420, 16], [356, 70], [96, 58]].forEach(function (s) {
      px(g, s[0], s[1], WHITE); px(g, s[0] - 1, s[1], '#8a96d8'); px(g, s[0] + 1, s[1], '#8a96d8'); px(g, s[0], s[1] - 1, '#8a96d8'); px(g, s[0], s[1] + 1, '#8a96d8');
    });
    // the moon, a soft halo round it
    var mx = 330, my = 24;
    glow(g, mx, my, 48, '#6a74c8', 0.32);
    glow(g, mx, my, 22, '#c8ccf0', 0.3);
    disc(g, mx, my, 13, '#d8d4bc'); disc(g, mx - 1, my - 1, 12, '#f6f2dc');
    disc(g, mx + 4, my - 3, 3, '#e2dcc2'); disc(g, mx - 5, my + 4, 2, '#e2dcc2'); disc(g, mx + 1, my + 6, 2, '#e8e2c8'); px(g, mx - 3, my - 5, '#e2dcc2');
    // thin clouds drifting across it, lit along their tops
    cloudBand(g, 282, 36, 70, '#2c2e64', '#8a8ec8');
    cloudBand(g, 350, 16, 54, '#262a5c', '#7a80c0');
    cloudBand(g, 40, 76, 90, '#2a2a60', '#5a5c9a');
    cloudBand(g, 150, 94, 120, '#36346e', '#5e5c9a');
  }

  // ------------------------------------------------------------ the far skyline
  function paintFar(g, w, h) {
    var rnd = U.rng(31);
    var x = -6;
    while (x < w) {
      var bw = 8 + Math.floor(rnd() * 16), top = 80 + Math.floor(rnd() * 44);
      r(g, x, top, bw, h - top, '#232a5a');
      r(g, x + bw - 1, top, 1, h - top, '#2e3670');
      if (rnd() > 0.72) { var ax = x + Math.floor(bw / 2); r(g, ax, top - 9, 1, 9, '#232a5a'); px(g, ax, top - 10, '#ff5a5a'); }
      for (var wy = top + 3; wy < 146; wy += 4) for (var wx = x + 2; wx < x + bw - 1; wx += 3) if (rnd() < 0.15) px(g, wx, wy, rnd() > 0.3 ? '#d8b46a' : '#7ab0e8');
      x += bw + Math.floor(rnd() * 3);
    }
    // a broadcast mast on the far hill
    var mx = 420;
    for (var my = 26; my < 90; my++) { var hw = Math.round((my - 26) * 0.08); r(g, mx - hw, my, hw * 2 + 1, 1, '#232a5a'); }
    px(g, mx, 25, '#ff5a5a'); px(g, mx, 50, '#ff5a5a');
    r(g, 0, 140, w, h - 140, '#20275a');
  }

  // Searchlight beams over the city while the robot stands in it (after the far layer, so
  // nearer towers cut across them). They sweep slowly; with reduced motion they hold still.
  var BEAMS = [[1548, -0.32, 0], [1908, 0.28, 2.1], [980, -0.12, 4.2]];
  function drawBeams(g, w, camX, t) {
    var k = w.state.robot || 0;
    if (k <= 0 || allFixed(w)) return;
    BEAMS.forEach(function (b) {
      var sx = (b[0] - camX) * 0.5;
      var a = -Math.PI / 2 + b[1] + (w.reduced ? 0 : Math.sin(t * 0.33 + b[2]) * 0.22);
      var L = 250, spread = 15;
      var ex = sx + Math.cos(a) * L, ey = 160 + Math.sin(a) * L;
      var nx = -Math.sin(a) * spread, ny = Math.cos(a) * spread;
      if (Math.max(sx, ex + Math.abs(nx)) < -30 || Math.min(sx, ex - Math.abs(nx)) > W + 30) return;
      g.fillStyle = 'rgba(190,206,255,0.075)';
      g.beginPath(); g.moveTo(sx - 2, 160); g.lineTo(ex - nx, ey - ny); g.lineTo(ex + nx, ey + ny); g.lineTo(sx + 2, 160); g.closePath(); g.fill();
      g.fillStyle = 'rgba(230,238,255,0.06)';
      g.beginPath(); g.moveTo(sx - 1, 160); g.lineTo(ex - nx * 0.4, ey - ny * 0.4); g.lineTo(ex + nx * 0.4, ey + ny * 0.4); g.lineTo(sx + 1, 160); g.closePath(); g.fill();
    });
  }

  // ------------------------------------------------------------ the mid skyline
  function paintMid(g, w, h) {
    var rnd = U.rng(57);
    var x = -10;
    while (x < w) {
      var bw = 26 + Math.floor(rnd() * 34), top = 36 + Math.floor(rnd() * 64);
      var base = ['#2c3466', '#303a6e', '#283060', '#343c72'][Math.floor(rnd() * 4)];
      r(g, x, top, bw, h - top, base);
      r(g, x, top, 2, h - top, C.mix(base, '#8a90c8', 0.25)); r(g, x + bw - 3, top, 3, h - top, C.mix(base, '#0a0c20', 0.35));
      for (var wy = top + 4; wy < 150; wy += 6) for (var wx = x + 4; wx < x + bw - 4; wx += 5) {
        var on = rnd() < 0.28;
        r(g, wx, wy, 3, 3, on ? (rnd() < 0.75 ? '#f0c470' : '#86c4f0') : '#20275a');
      }
      var roll = rnd();
      if (roll < 0.22) { var tx = x + 6 + Math.floor(rnd() * (bw - 18)); r(g, tx, top - 12, 11, 9, '#2a2440'); r(g, tx - 1, top - 14, 13, 2, '#201a32'); r(g, tx + 2, top - 3, 1, 3, '#201a32'); r(g, tx + 8, top - 3, 1, 3, '#201a32'); }
      else if (roll < 0.42) { var ax = x + Math.floor(bw / 2); r(g, ax, top - 18, 1, 18, base); px(g, ax, top - 19, '#ff5050'); }
      else if (roll < 0.52 && bw > 36) {
        var label = ['HOTEL', 'CINEMA', 'NEWS', 'CLOUD'][Math.floor(rnd() * 4)], col = ['#ff5ab0', '#5af0ff', '#ffb040'][Math.floor(rnd() * 3)];
        r(g, x + 4, top - 10, bw - 8, 8, '#141630'); r(g, x + 6, top - 2, 1, 2, '#141630'); r(g, x + bw - 7, top - 2, 1, 2, '#141630');
        tinyC(g, label, x + bw / 2, top - 8, col);
      }
      x += bw + 2 + Math.floor(rnd() * 8);
    }
    // a landmark spire with a beacon
    var sx = 560;
    r(g, sx - 12, 30, 24, h - 30, '#2e3870'); r(g, sx + 8, 30, 4, h - 30, '#232a5a'); r(g, sx - 12, 30, 2, h - 30, '#4a5490');
    for (var s = 0; s < 18; s++) r(g, sx - 12 + s * 0.66, 30 - s, 24 - s * 1.33, 1, '#2e3870');
    r(g, sx, -6, 1, 18, '#2e3870'); px(g, sx, -7, '#ff6a6a');
    for (var ly = 36; ly < 140; ly += 5) for (var lx = sx - 9; lx < sx + 8; lx += 4) if (rnd() < 0.35) r(g, lx, ly, 2, 3, '#f0c470');
  }

  // ------------------------------------------------------------ the rooftops behind the street
  function paintBack(g, w, h) {
    var rnd = U.rng(89);
    var x = -8;
    while (x < w) {
      var bw = 44 + Math.floor(rnd() * 46), top = 40 + Math.floor(rnd() * 50);
      var mat = ['brick', 'concrete', 'panel', 'brick2'][Math.floor(rnd() * 4)];
      facade(g, rnd, x, bw, top, LIP, mat, mat === 'brick' && rnd() < 0.5);
      x += bw + 3 + Math.floor(rnd() * 12);
    }
    // a billboard on the rooftops: the design system, accessible by default
    var bx = 700, by = 16;
    r(g, bx + 6, by + 22, 2, LIP - by - 22, '#1c1e34'); r(g, bx + 54, by + 22, 2, LIP - by - 22, '#1c1e34');
    for (var cy = by + 30; cy < LIP; cy += 10) line(g, bx + 8, cy, bx + 54, cy + 8, '#1c1e34', 1);
    r(g, bx - 1, by - 1, 64, 24, INK); r(g, bx, by, 62, 22, '#f4f6ff');
    r(g, bx + 4, by + 4, 20, 8, '#2a5ae0');
    r(g, bx + 3, by + 3, 22, 1, FOCUS); r(g, bx + 3, by + 12, 22, 1, FOCUS); r(g, bx + 3, by + 3, 1, 10, FOCUS); r(g, bx + 24, by + 3, 1, 10, FOCUS);
    tiny(g, 'OK', bx + 10, by + 6, WHITE);
    tiny(g, 'BUILT', bx + 30, by + 4, '#1c2f66'); tiny(g, 'IN', bx + 30, by + 11, '#2a5ae0');
    tiny(g, 'FOR ALL', bx + 4, by + 16, '#5a6086');
  }

  // ------------------------------------------------------------ the street (the playfield layer)
  var LAMPS = [156, 360, 561, 761, 1084, 1292];
  function lampPost(g, x) {
    r(g, x - 1, 40, 3, LIP - 40, '#1c1f38'); r(g, x, 40, 1, LIP - 40, '#3a3f62');
    r(g, x - 3, LIP - 6, 7, 6, '#1c1f38'); r(g, x - 3, LIP - 6, 7, 1, '#3a3f62');
    r(g, x, 38, 10, 2, '#1c1f38'); r(g, x + 6, 39, 10, 4, '#1c1f38'); r(g, x + 7, 43, 8, 1, LAMP);
    glow(g, x + 11, 45, 20, LAMP, 0.42); r(g, x + 9, 43, 4, 1, WHITE);
    g.fillStyle = 'rgba(255,226,150,0.07)';
    g.beginPath(); g.moveTo(x + 7, 44); g.lineTo(x + 15, 44); g.lineTo(x + 38, LIP); g.lineTo(x - 16, LIP); g.closePath(); g.fill();
  }

  function paintHQ(g, rnd) {
    var x1 = 152;
    r(g, 0, 0, x1, 94, '#1d2654');
    for (var fy = 2; fy < 86; fy += 9) {
      r(g, 0, fy, x1, 1, '#2c3870');
      for (var wx = 2; wx < x1 - 4; wx += 10) win(g, rnd, wx, fy + 2, 8, 6, 0.46);
    }
    for (var mx = 0; mx < x1; mx += 10) r(g, mx, 0, 2, 88, '#2a3466');
    r(g, x1 - 4, 0, 4, 94, '#141a3e');
    // the canopy and the HQ sign
    r(g, 0, 84, x1 + 4, 10, INK); r(g, 0, 85, x1 + 2, 8, '#262c52'); r(g, 0, 85, x1 + 2, 1, '#4a5488');
    glow(g, 76, 68, 34, '#9ad8ff', 0.25);
    r(g, 52, 56, 48, 24, INK); r(g, 53, 57, 46, 22, '#141a3e');
    // the company mark: a door in a rounded square
    r(g, 58, 61, 12, 14, WHITE); r(g, 59, 62, 10, 12, '#2a5ae0'); r(g, 62, 65, 4, 9, WHITE); px(g, 58, 61, '#141a3e'); px(g, 69, 61, '#141a3e'); px(g, 58, 74, '#141a3e'); px(g, 69, 74, '#141a3e');
    MS.font.draw(g, 'HQ', 76, 63, WHITE);
    // the lobby: double height glass, bright inside
    P.vgrad(g, 0, 94, x1, LIP - 94, [[0, '#f2e4b8'], [1, '#d8c08c']]);
    r(g, 8, 100, 30, 18, '#2a5ae0'); r(g, 10, 102, 26, 14, '#f4f6ff'); r(g, 12, 104, 12, 5, '#2a5ae0'); r(g, 11, 103, 14, 1, FOCUS); r(g, 11, 109, 14, 1, FOCUS);
    tiny(g, 'A11Y', 13, 111, '#1c2f66');
    r(g, 96, 124, 44, 14, '#5a4a3a'); r(g, 96, 124, 44, 2, '#8a7050'); r(g, 112, 116, 8, 8, '#2a2a3a'); r(g, 113, 117, 6, 5, COOL);
    r(g, 140, 112, 8, 26, '#2a5a3a'); disc(g, 144, 110, 5, '#3a8a4a'); r(g, 141, 136, 6, 4, '#8a6448');
    for (var gm = 0; gm < x1; gm += 22) r(g, gm, 94, 2, LIP - 94, '#3a3f62');
    r(g, 0, 118, x1, 1, '#3a3f62');
    // the revolving door
    r(g, 56, 104, 30, 42, '#24263e'); P.vgrad(g, 58, 106, 26, 40, [[0, '#f8ecc8'], [1, '#e0c890']]);
    r(g, 70, 106, 2, 40, '#24263e'); line(g, 58, 112, 70, 140, '#3a3f62', 1); line(g, 84, 112, 72, 140, '#3a3f62', 1);
    fillA(g, 60, 108, 3, 34, 'rgba(255,255,255,0.3)');
    r(g, 0, 142, x1, 4, '#3a3e5c'); r(g, 0, 142, x1, 1, '#5a6086');
  }

  // The all-night cafe where the night shift gathered, the site status board on its wall.
  var CAFE = { x: 860, w: 150 };
  var BOARD = { x: 886, y: 22, w: 112, h: 50 };
  function paintCafe(g, rnd) {
    var x = CAFE.x, w = CAFE.w;
    facade(g, rnd, x, w, 4, 78, 'concrete', false);
    // the board's housing and struts (the screen is drawn live)
    r(g, BOARD.x - 4, BOARD.y - 4, BOARD.w + 8, BOARD.h + 8, '#1c1f38'); r(g, BOARD.x - 4, BOARD.y - 4, BOARD.w + 8, 1, '#4a5080');
    r(g, BOARD.x + 10, BOARD.y + BOARD.h + 4, 3, 6, '#1c1f38'); r(g, BOARD.x + BOARD.w - 13, BOARD.y + BOARD.h + 4, 3, 6, '#1c1f38');
    glow(g, BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2, 80, '#5a7ad8', 0.22);
    // the sign band and awning
    r(g, x, 78, w, 14, INK); r(g, x + 1, 79, w - 2, 12, '#2a1c1a');
    glow(g, x + w / 2, 85, 50, '#ff9a3a', 0.28);
    MS.font.drawCentered(g, 'CAFE  OPEN 24H', x + w / 2, 82, '#ffb050');
    for (var ay = 0; ay < 8; ay++) for (var st = 0; st < w + 4; st += 6) r(g, x - 2 + st, 92 + ay, Math.min(6, w + 4 - st), 1, (st / 6) % 2 ? '#f4e6d0' : '#7a3a22');
    // big warm windows: stools, tables, the coffee machine
    r(g, x + 2, 101, w - 4, 41, '#24263e');
    P.vgrad(g, x + 4, 103, w - 8, 37, [[0, '#ffe2a8'], [1, '#e8b070']]);
    r(g, x + 4, 126, w - 8, 3, '#6a4a34');
    for (var sx = x + 12; sx < x + w - 10; sx += 18) { r(g, sx, 129, 5, 2, '#3a2a24'); r(g, sx + 2, 131, 1, 9, '#3a2a24'); }
    r(g, x + w - 30, 108, 18, 18, '#3a3a46'); r(g, x + w - 28, 110, 14, 6, '#5a5a6a'); r(g, x + w - 24, 118, 6, 6, WHITE); px(g, x + w - 16, 111, '#7aff8a');
    r(g, x + 8, 106, 30, 10, '#2a1c1a'); tiny(g, 'COFFEE', x + 11, 108, '#ffd27a');
    for (var gx = x + 10; gx < x + w - 8; gx += 26) for (var gy = 0; gy < 37; gy++) fillA(g, gx + Math.round((37 - gy) * 0.4), 103 + gy, 3, 1, 'rgba(255,255,255,0.18)');
    for (var mu = x + 2; mu < x + w; mu += 37) r(g, mu, 101, 2, 41, '#24263e');
    r(g, x, 142, w, 4, '#3a3e5c'); r(g, x, 142, w, 1, '#5a6086');
    r(g, x - 4, 78, 4, LIP - 78, '#2a2e4e');
  }

  // The alley the barricade blocks, then a closed block with its shutters down.
  function paintAlley(g, rnd) {
    var x0 = 1010, x1 = 1078;
    r(g, x0, 44, x1 - x0, LIP - 44, '#221c30');
    for (var y = 46; y < LIP; y += 3) { r(g, x0, y, x1 - x0, 1, '#1a1426'); }
    // a side door with a caged light, a dumpster in the shadows
    r(g, x0 + 34, 102, 16, 44, '#151020'); r(g, x0 + 35, 103, 14, 43, '#3a3046'); r(g, x0 + 38, 96, 8, 4, '#1a1426'); r(g, x0 + 39, 97, 6, 2, LAMP);
    glow(g, x0 + 42, 100, 24, LAMP, 0.35);
    r(g, x0 + 4, 118, 26, 28, '#1e3a2e'); r(g, x0 + 2, 116, 30, 3, '#163024'); r(g, x0 + 6, 122, 22, 1, '#2a5040');
    // the fire escape up the wall
    for (var fy = 56; fy < 100; fy += 18) { r(g, x0 + 8, fy, 50, 2, '#100c1a'); for (var fx = x0 + 8; fx < x0 + 58; fx += 3) r(g, fx, fy - 5, 1, 5, '#100c1a'); line(g, x0 + 10, fy + 2, x0 + 52, fy + 17, '#100c1a', 1); }
  }
  function paintBlock(g, rnd) {
    var x = 1080, w = 220;
    facade(g, rnd, x, 108, 44, 92, 'brick2', true);
    facade(g, rnd, x + 112, 108, 56, 92, 'panel', false);
    [[x, 108], [x + 112, 108]].forEach(function (s) {
      r(g, s[0], 92, s[1], 54, '#2e3254');
      r(g, s[0] + 4, 96, s[1] - 8, 6, '#1c1f38');
      // a roller shutter, pulled down for the night
      for (var y = 102; y < 142; y += 3) { r(g, s[0] + 4, y, s[1] - 8, 2, '#5a5f80'); r(g, s[0] + 4, y, s[1] - 8, 1, '#6e7496'); }
      r(g, s[0] + 4, 140, s[1] - 8, 2, '#3a3e5c');
      r(g, s[0] + s[1] / 2 - 3, 136, 6, 3, '#2a2e4e');
    });
    // the bus shelter, its ad lit: the design system
    var bx = 1150;
    r(g, bx, 100, 56, 3, '#1c1f38'); r(g, bx, 103, 2, 43, '#1c1f38'); r(g, bx + 54, 103, 2, 43, '#1c1f38');
    fillA(g, bx + 2, 103, 52, 40, 'rgba(160,200,255,0.12)');
    r(g, bx + 30, 106, 22, 32, '#f4f6ff'); r(g, bx + 30, 106, 22, 1, WHITE);
    glow(g, bx + 41, 122, 28, '#cfe0ff', 0.3);
    r(g, bx + 33, 112, 16, 7, '#2a5ae0'); r(g, bx + 32, 111, 18, 1, FOCUS); r(g, bx + 32, 119, 18, 1, FOCUS); r(g, bx + 32, 111, 1, 9, FOCUS); r(g, bx + 49, 111, 1, 9, FOCUS);
    tiny(g, 'GO', bx + 38, 113, WHITE);
    tinyC(g, 'FOR', bx + 41, 124, '#1c2f66'); tinyC(g, 'ALL', bx + 41, 130, '#2a5ae0');
    r(g, bx + 6, 132, 20, 3, '#5a5f80'); r(g, bx + 8, 135, 2, 8, '#3a3e5c'); r(g, bx + 22, 135, 2, 8, '#3a3e5c');
    // a ROAD CLOSED sign at the edge of the plaza
    r(g, 1270, 112, 2, 34, '#1c1f38'); r(g, 1258, 104, 26, 12, INK); r(g, 1259, 105, 24, 10, '#f4f4f8');
    for (var hz = 0; hz < 24; hz += 4) r(g, 1259 + hz, 105, 2, 2, RED);
    tinyC(g, 'CLOSED', 1271, 109, RED_DK);
  }

  // The civic hall behind the plaza, its audit billboard, two floodlight masts.
  var BILL = { x: 1376, y: 20, w: 96, h: 46 };
  var MASTS = [1318, 1906];
  function paintPlaza(g, rnd) {
    var x0 = 1300, x1 = 1924;
    r(g, x0, 58, x1 - x0, LIP - 58, '#363c64');
    r(g, x0, 58, x1 - x0, 30, '#4a5076');
    for (var cy = 64; cy < 88; cy += 8) r(g, x0, cy, x1 - x0, 1, '#3e4468');
    r(g, x0, 55, x1 - x0, 3, '#7a82a4'); r(g, x0, 55, x1 - x0, 1, '#a8b0cc'); r(g, x0, 88, x1 - x0, 2, '#2a2e4e');
    // columns, dark glass between them, the floodlights caught in it
    for (var c = x0 + 10; c < x1 - 6; c += 44) {
      r(g, c + 8, 90, 36, LIP - 90, '#18204a');
      for (var gy = 94; gy < LIP - 6; gy += 12) for (var gx = c + 11; gx < c + 42; gx += 8) win(g, rnd, gx, gy, 6, 9, 0.18);
      fillA(g, c + 14, 92, 4, LIP - 96, 'rgba(255,250,220,0.10)');
      r(g, c, 90, 8, LIP - 90, '#5e6690'); r(g, c, 90, 2, LIP - 90, '#8a92ba'); r(g, c + 6, 90, 2, LIP - 90, '#454c76');
    }
    // the billboard's frame and struts (its screen is drawn live)
    r(g, BILL.x + 12, BILL.y + BILL.h, 3, 58 - BILL.y - BILL.h + 2, '#1c1f38'); r(g, BILL.x + BILL.w - 15, BILL.y + BILL.h, 3, 58 - BILL.y - BILL.h + 2, '#1c1f38');
    r(g, BILL.x - 4, BILL.y - 4, BILL.w + 8, BILL.h + 8, '#1c1f38'); r(g, BILL.x - 4, BILL.y - 4, BILL.w + 8, 1, '#4a5080');
    // low hedges along the base
    for (var hx = x0 + 30; hx < x1 - 20; hx += 62) { r(g, hx, LIP - 8, 30, 8, '#1a3436'); for (var hb = 0; hb < 30; hb += 5) disc(g, hx + hb + 2, LIP - 8, 3, '#1f3e40'); r(g, hx - 1, LIP - 3, 32, 3, '#4a4e70'); }
    // floodlight masts, beams on the robot's spot
    MASTS.forEach(function (mx, i) {
      r(g, mx - 3, 14, 2, LIP - 14, '#1c1f38'); r(g, mx + 2, 14, 2, LIP - 14, '#1c1f38');
      for (var ly = 18; ly < LIP; ly += 8) { line(g, mx - 2, ly, mx + 2, ly + 4, '#1c1f38', 1); line(g, mx + 2, ly + 4, mx - 2, ly + 8, '#1c1f38', 1); }
      r(g, mx - 10, 6, 21, 10, '#1c1f38');
      for (var lp = 0; lp < 4; lp++) { r(g, mx - 9 + (lp % 2) * 10, 7 + Math.floor(lp / 2) * 4, 8, 3, '#fffbe6'); }
      glow(g, mx, 11, 30, '#fff4d0', 0.5);
      var tx = 1616, dir = i ? -1 : 1;
      g.fillStyle = 'rgba(255,248,215,0.06)';
      g.beginPath(); g.moveTo(mx - 6 * dir, 12); g.lineTo(mx + 8 * dir, 16); g.lineTo(tx + 70 * dir, LIP); g.lineTo(tx - 50 * dir, LIP); g.closePath(); g.fill();
    });
  }

  // The city gate: a wall, a round arch, the plaque. The leaves and the padlock are live.
  var GATE = { x: 1924, cx: 2054, half: 58, spring: 108, top: 50 };
  function archHalf(y) {
    if (y >= GATE.spring) return GATE.half;
    var d = GATE.spring - y;
    return d >= GATE.half ? 0 : Math.round(Math.sqrt(GATE.half * GATE.half - d * d));
  }
  function paintGateWall(g, rnd, w) {
    var x0 = GATE.x;
    r(g, x0, 14, w - x0, LIP - 14, '#3a4066');
    for (var y = 14; y < LIP; y += 8) {
      var off = ((y - 14) / 8) % 2 ? 0 : 10;
      for (var x = x0 - off; x < w; x += 20) { r(g, Math.max(x0, x + 1), y + 1, 18 - Math.max(0, x0 - x - 1), 6, '#444b74'); r(g, Math.max(x0, x + 1), y + 1, 18 - Math.max(0, x0 - x - 1), 1, '#58608a'); }
    }
    for (var m = x0; m < w; m += 14) { r(g, m, 6, 9, 8, '#444b74'); r(g, m, 6, 9, 1, '#6a72a0'); }
    r(g, x0, 14, w - x0, 2, '#2a2e4e');
    // the towers either side of the arch
    [[x0, 28], [w - 30, 30]].forEach(function (tw) { r(g, tw[0], 0, tw[1], LIP, '#4a5280'); r(g, tw[0], 0, 2, LIP, '#6a72a0'); r(g, tw[0] + tw[1] - 3, 0, 3, LIP, '#30365a'); for (var ty = 20; ty < LIP; ty += 24) r(g, tw[0] + tw[1] / 2 - 2, ty, 4, 10, '#1a1e3a'); });
    // the arch: the outside world through it, a highway running off into the night
    for (var ay = GATE.top; ay < LIP; ay++) {
      var hw = archHalf(ay);
      if (!hw) continue;
      r(g, GATE.cx - hw - 4, ay, hw * 2 + 8, 1, '#5a6290');
      var k = (ay - GATE.top) / (LIP - GATE.top);
      r(g, GATE.cx - hw, ay, hw * 2, 1, C.mix('#141a40', '#3a3270', k));
    }
    for (var hx = GATE.cx - 56; hx < GATE.cx + 56; hx++) { var hy = 118 + Math.round(Math.sin(hx * 0.05) * 3); r(g, hx, hy, 1, LIP - hy, '#1a1c3c'); }
    for (var rl = 0; rl < 20; rl++) { var rw = 6 + rl * 2.2; r(g, GATE.cx - rw / 2, 126 + rl, rw, 1, '#26283e'); }
    for (var li = 0; li < 9; li++) { px(g, GATE.cx - 30 + li * 7, 120 + (li % 3), '#ffd27a'); px(g, GATE.cx - 26 + li * 7, 122, '#ff5a5a'); }
    // the plaque
    r(g, GATE.cx - 34, 17, 68, 13, INK); r(g, GATE.cx - 33, 18, 66, 11, '#262a52'); r(g, GATE.cx - 33, 18, 66, 1, '#8a92c0');
    MS.font.drawCentered(g, 'CITY GATE', GATE.cx, 20, '#e8ecff');
    r(g, GATE.cx - 9, 32, 18, 18, '#5a6290'); r(g, GATE.cx - 8, 33, 16, 16, '#3a4066');
  }

  function paintGround(g, rnd, w, h) {
    var END = 1300;
    // the sidewalk: slabs, the light pools under each lamp
    r(g, 0, LIP, END, CURB - LIP, '#4f5577');
    r(g, 0, LIP + 1, END, 1, '#666c90');
    for (var sx = 0; sx < END; sx += 16) r(g, sx, LIP + 2, 1, CURB - LIP - 2, '#41466a');
    r(g, 0, LIP + 13, END, 1, '#464b6e');
    LAMPS.forEach(function (lx) { if (lx < END) pool(g, lx + 11, LIP + 12, 40, 12, '#ffe2a8', 0.22); });
    STORES.forEach(function (s) { pool(g, s.x + s.w / 2 - 10, LIP + 3, s.w / 2 + 6, 7, '#ffd8a0', 0.2); });
    pool(g, CAFE.x + CAFE.w / 2, LIP + 3, 80, 8, '#ffc890', 0.22);
    pool(g, 76, LIP + 3, 80, 8, '#ffeac0', 0.24);
    // the curb, then the road, wet: the shop signs shimmer in it
    r(g, 0, CURB, END, 2, '#8a8ea8'); r(g, 0, CURB + 2, END, 3, '#30344e');
    P.vgrad(g, 0, CURB + 5, END, h - CURB - 5, [[0, '#272b44'], [1, '#181a2e']]);
    for (var lx = 6; lx < END; lx += 26) r(g, lx, 199, 12, 2, '#a89a56');
    STORES.forEach(function (s) {
      var cx = s.x + s.w / 2;
      for (var ry = CURB + 7; ry < h - 2; ry += 2) {
        var k = (ry - CURB) / (h - CURB), rw = 6 + ((ry * 7) % 11);
        fillA(g, cx - rw / 2 + ((ry * 13) % 7) - 3, ry, rw, 1, rgba(s.brand, 0.42 * (1 - k)));
      }
    });
    [[300, 186], [700, 190], [1150, 188]].forEach(function (mh) { r(g, mh[0] - 10, mh[1], 20, 4, '#14162a'); r(g, mh[0] - 8, mh[1] + 1, 16, 2, '#2e3250'); r(g, mh[0] - 10, mh[1], 20, 1, '#3e4262'); });
    // the plaza: big pale slabs, footprints of binders cracked into them
    r(g, END, LIP, w - END, h - LIP, '#4e5072');
    var rows = [LIP + 1, LIP + 9, LIP + 20, LIP + 34, LIP + 52, h];
    for (var ri = 0; ri < rows.length - 1; ri++) {
      var y0 = rows[ri], y1 = rows[ri + 1], sw = 22 + ri * 8;
      for (var tx = END - ((ri * 13) % sw); tx < w; tx += sw) {
        var xx = Math.max(END, tx + 1), sh = rnd();
        r(g, xx, y0 + 1, tx + sw - xx, y1 - y0 - 1, sh > 0.85 ? '#5c5e82' : sh > 0.3 ? '#55577a' : '#4c4e70');
        r(g, xx, y0 + 1, tx + sw - xx, 1, '#66688e');
      }
    }
    pool(g, 1612, 166, 170, 30, '#fff6dc', 0.2);
    pool(g, 1612, 160, 90, 12, '#fff6dc', 0.18);
    for (var fp = 0; fp < 6; fp++) {
      var fx = 1312 + fp * 44, fy = fp % 2 ? 160 : 168;
      r(g, fx, fy, 34, 5, '#3a3b5a'); line(g, fx + 4, fy + 1, fx + 12, fy + 4, '#2a2b44', 1); line(g, fx + 20, fy, fx + 28, fy + 4, '#2a2b44', 1);
    }
    for (var sp = 0; sp < 24; sp++) { var px0 = 1300 + rnd() * 640, py0 = LIP + 6 + rnd() * 60; r(g, px0, py0, 5, 3, PAPER_SH); r(g, px0, py0, 5, 1, PAPER_HI); }
    // through the gate the road runs out of town
    r(g, GATE.cx - 40, LIP, 80, h - LIP, '#2a2c46');
    for (var dl = LIP + 4; dl < h; dl += 9) r(g, GATE.cx - 1, dl, 2, 5, '#a89a56');
    r(g, 0, LIP, w, 1, INK);
  }

  function paintNear(g, w, h) {
    var rnd = U.rng(1960);
    paintHQ(g, rnd);
    STORES.forEach(function (s) { store(g, rnd, s); });
    mounts(g);
    paintCafe(g, rnd);
    paintAlley(g, rnd);
    paintBlock(g, rnd);
    paintPlaza(g, rnd);
    paintGateWall(g, rnd, w);
    LAMPS.forEach(function (lx) { lampPost(g, lx); });
    paintGround(g, rnd, w, h);
  }

  // ------------------------------------------------------------ the front layer
  function paintFront(g, w, h) {
    var rnd = U.rng(1300);
    var DARK = '#0b0c1e', RIM = '#2c3062';
    // overhead wires, and a traffic signal hanging off them now and then
    for (var x = 60; x < w; x += 330 + Math.floor(rnd() * 170)) {
      var span = 210 + Math.floor(rnd() * 60);
      for (var i = 0; i < span; i++) px(g, x + i, Math.round(5 + Math.sin(i / span * Math.PI) * 9), DARK);
      if (rnd() < 0.7) {
        var sx = x + Math.floor(span / 2) - 3, sy = 14;
        r(g, sx + 3, 12, 1, 3, DARK); r(g, sx, sy, 8, 19, DARK); r(g, sx, sy, 8, 1, RIM);
        disc(g, sx + 4, sy + 4, 2, '#ff4a4a'); disc(g, sx + 4, sy + 9, 2, '#3a2a1a'); disc(g, sx + 4, sy + 14, 2, '#1a3a2a');
      }
    }
    // the bottom edge: shrubs, bollards, a newspaper box
    for (var bx = 30; bx < w; bx += 250 + Math.floor(rnd() * 190)) {
      var kind = Math.floor(rnd() * 3);
      if (kind === 0) {
        for (var b = 0; b < 46; b += 6) disc(g, bx + b, H - 3 + (b % 4), 8, DARK);
        for (var e = 0; e < 46; e += 6) px(g, bx + e, H - 10 + (e % 4), RIM);
      } else if (kind === 1) {
        for (var p = 0; p < 4; p++) { r(g, bx + p * 18, H - 18, 6, 18, DARK); r(g, bx + p * 18, H - 18, 6, 1, RIM); r(g, bx + p * 18, H - 14, 6, 2, '#5a4a20'); }
      } else {
        r(g, bx, H - 24, 16, 24, DARK); r(g, bx, H - 24, 16, 1, RIM); r(g, bx + 2, H - 20, 12, 6, '#1a1c34'); r(g, bx + 3, H - 19, 10, 1, '#3a3e60');
      }
    }
  }

  var layers = [
    { speed: SKY_SPEED, haze: 0.08, paint: paintSky },
    { speed: FAR_SPEED, haze: 0.4, paint: paintFar, after: drawBeams },
    { speed: MID_SPEED, haze: 0.3, paint: paintMid },
    { speed: BACK_SPEED, haze: 0.18, paint: paintBack },
    { speed: 1, paint: paintNear },
    { speed: FRONT_SPEED, front: true, paint: paintFront }
  ];

  // ------------------------------------------------------------ solids, drawn to match their boxes
  function solidImg(s) {
    return once('solid:' + s.kind + ':' + s.x, function () {
      var rnd = U.rng(s.x * 7 + s.w);
      return stamp(s.w, s.h, function (g, w, h) {
        if (s.kind === 'papers' || s.kind === 'notices') {
          // bundles of printouts tied with string
          var bh = Math.floor(h / 2);
          [[0, h - bh, w], [2, 0, w - 4]].forEach(function (b, i) {
            for (var y = 0; y < (i ? h - bh : bh); y++) r(g, b[0], b[1] + y, b[2], 1, y === 0 ? PAPER_HI : y % 2 ? PAPER_SH : PAPER);
            r(g, b[0] + b[2] - 2, b[1], 2, i ? h - bh : bh, PAPER_DK);
            r(g, b[0] + Math.floor(b[2] / 2), b[1], 1, i ? h - bh : bh, KRAFT_DK);
          });
          if (s.kind === 'notices') { r(g, 3, 2, 6, 3, WAX); r(g, w - 9, h - bh + 2, 6, 3, WAX); }
          else { r(g, 4, h - bh + 2, w - 10, 3, RED); tiny(g, 'TOS', 5, h - bh + 1, WHITE); }
        } else if (s.kind === 'hydrant') {
          r(g, 2, 3, w - 4, h - 3, '#c8302a'); r(g, 3, 3, 2, h - 4, '#e86a5a'); r(g, 0, 6, w, 3, '#a8241e'); r(g, 3, 0, w - 6, 3, '#a8241e'); r(g, 1, h - 2, w - 2, 2, '#7a1a16');
        } else if (s.kind === 'bins') {
          [[0, '#2f6ad0'], [11, '#2f8a5a']].forEach(function (b) {
            r(g, b[0], 4, 11, h - 4, b[1]); r(g, b[0], 4, 11, 1, C.mix(b[1], WHITE, 0.4)); r(g, b[0] + 2, 8, 7, 1, C.mix(b[1], INK, 0.4));
            r(g, b[0] + 1, 0, 9, 4, PAPER); r(g, b[0] + 2, -1, 4, 2, PAPER_HI); r(g, b[0] + 6, 1, 3, 1, PRINT);
          });
          tiny(g, 'TOS', 3, 10, WHITE);
        } else if (s.kind === 'barrier') {
          r(g, 2, 7, 2, h - 7, '#8a8ea8'); r(g, w - 4, 7, 2, h - 7, '#8a8ea8'); line(g, 3, 7, 0, h - 1, '#8a8ea8', 1); line(g, w - 3, 7, w - 1, h - 1, '#8a8ea8', 1);
          for (var bx = 0; bx < w; bx++) r(g, bx, 3, 1, 5, Math.floor(bx / 4) % 2 ? WHITE : '#ff7a1a');
          r(g, 0, 3, w, 1, '#ffd0a0'); r(g, Math.floor(w / 2) - 2, 0, 4, 3, '#ffb020');
        } else if (s.kind === 'barricade') {
          // office furniture: a desk on its side, filing boxes, a chair on top
          r(g, 12, 6, w - 12, h - 6, '#8a6a4a'); r(g, 12, 6, w - 12, 1, '#b08a64'); r(g, w - 3, 6, 3, h - 6, '#6a4e36');
          r(g, 16, 10, 12, 5, '#6a4e36'); r(g, 21, 12, 3, 1, STEEL); r(g, 16, 17, 12, 5, '#6a4e36'); r(g, 21, 19, 3, 1, STEEL);
          [[0, h - 9], [0, h - 18]].forEach(function (b, i) { r(g, b[0] + i, b[1], 13, 9, KRAFT); r(g, b[0] + i, b[1], 13, 1, KRAFT_HI); r(g, b[0] + 4 + i, b[1] + 3, 5, 2, KRAFT_DK); r(g, b[0] + i, b[1] + 8, 13, 1, KRAFT_DK); });
          r(g, 18, 0, 10, 3, '#2a2a3a'); r(g, 26, -4, 2, 7, '#2a2a3a'); r(g, 20, 3, 1, 3, '#2a2a3a');
        }
      });
    });
  }
  // The night shift's whiteboard, propped up behind the barricade.
  function whiteboard() {
    return once('whiteboard', function () {
      return stamp(40, 46, function (g) {
        r(g, 6, 30, 2, 16, '#8a8ea8'); r(g, 32, 30, 2, 16, '#8a8ea8'); r(g, 2, 44, 10, 2, '#8a8ea8'); r(g, 28, 44, 10, 2, '#8a8ea8');
        r(g, 0, 0, 40, 32, '#c8ccd8'); r(g, 1, 1, 38, 30, '#f4f6fa'); r(g, 1, 1, 38, 1, WHITE);
        tinyC(g, 'STAND', 20, 4, RED); tinyC(g, 'BACK!', 20, 11, RED);
        line(g, 6, 22, 16, 18, '#2a5ae0', 1); line(g, 16, 18, 22, 24, '#2a5ae0', 1); r(g, 26, 19, 8, 6, '#2a5ae0'); px(g, 30, 22, WHITE);
        r(g, 2, 28, 36, 2, '#9aa0b4');
      });
    });
  }

  var props = [];
  SOLIDS.forEach(function (s) {
    props.push({ x: s.x, z: -1, draw: function (g, sx) { g.drawImage(solidImg(s), sx - 1, G - s.h - 1); } });
  });
  props.push({ x: 1040, z: -3, draw: function (g, sx) { g.drawImage(whiteboard(), sx - 1, G - 47); } });

  // ------------------------------------------------------------ the robot's parts
  // Reams of paper, each a little offset, sheet edges showing.
  function ream(g, rnd, w, h, size, wraps) {
    var y = h;
    while (y > 0) {
      var rh = Math.min(size, y), top = y - rh, off = Math.round((rnd() - 0.5) * 2);
      r(g, off, top, w, rh, PAPER);
      for (var sy = top + 2; sy < y; sy += 2) r(g, off + 1, sy, w - 3, 1, PAPER_SH);
      r(g, off, top, w, 1, PAPER_HI);
      r(g, off + w - 3, top, 3, rh, PAPER_DK);
      if (wraps && rnd() < 0.45 && rh > 5) { var wc = rnd() < 0.5 ? KRAFT : '#c84a3a'; r(g, off, top + 2, w, 3, wc); r(g, off, top + 2, w, 1, C.mix(wc, WHITE, 0.3)); }
      y -= rh;
    }
  }
  function partImg(id) {
    return once('robot:' + id, function () {
      var rnd = U.rng(U.hash(id));
      var b = RB[id] || RB[id.replace(/[FB]$/, '')];
      if (id === 'footF' || id === 'footB') {
        return stamp(b.w, b.h, function (g, w, h) {
          r(g, 0, 0, w, h, BINDER); r(g, 0, 0, w, 1, BINDER_HI); r(g, 0, h - 2, w, 2, BINDER_DK);
          r(g, 0, 0, 5, h, BINDER_DK); r(g, 1, 2, 3, 4, '#e8e8f0');
          for (var rx = 9; rx < w - 3; rx += 7) { r(g, rx, h - 3, 3, 2, STEEL); px(g, rx, h - 3, WHITE); }
          r(g, 10, 2, w - 16, 3, BINDER_HI);
        });
      }
      if (id === 'legF' || id === 'legB') {
        return stamp(b.w, b.h, function (g, w, h) {
          ream(g, rnd, w, h, 7, true);
          // a binder clip at the knee
          r(g, 3, 1, w - 6, 5, CLIPC); r(g, 3, 1, w - 6, 1, '#4a4a5a');
          line(g, 5, 0, 3, -4, STEEL, 1); line(g, w - 6, 0, w - 4, -4, STEEL, 1);
        });
      }
      if (id === 'hips') {
        return stamp(b.w, b.h, function (g, w, h) {
          r(g, 0, 0, w, h, KRAFT); r(g, 0, 0, w, 3, KRAFT_HI); r(g, 0, 3, w, 1, KRAFT_DK); r(g, 0, h - 2, w, 2, KRAFT_DK);
          r(g, w - 3, 0, 3, h, KRAFT_DK);
          r(g, 44, 6, 26, 8, PAPER_HI); r(g, 44, 6, 26, 1, WHITE); tinyC(g, 'CASE', 57, 7, INK);
          r(g, 4, 6, 6, 3, '#5a3a20');
        });
      }
      if (id === 'torso') {
        return stamp(b.w, b.h, function (g, w, h) {
          // a bound contract: page edges along the top and side, the cover, a seal
          r(g, 0, 0, w, h, PAPER); for (var ey = 1; ey < 5; ey += 2) r(g, 2, ey, w - 4, 1, PAPER_SH);
          r(g, 0, 5, w, 1, PAPER_DK);
          r(g, 0, 6, 6, h - 6, BINDER); r(g, 0, 6, 6, 1, BINDER_HI); for (var ry = 10; ry < h - 2; ry += 6) r(g, 2, ry, 2, 2, STEEL);
          r(g, w - 4, 6, 4, h - 6, PAPER_SH); for (var sy = 8; sy < h; sy += 2) px(g, w - 3, sy, PAPER_DK);
          // the fine print
          for (var fy = 10; fy < h - 4; fy += 3) for (var fx = 40; fx < w - 8; fx += 5) r(g, fx, fy, 3 + ((fx + fy) % 2), 1, PRINT);
          // the seal of the clause, a big section mark
          disc(g, 56, 30, 7, WAX_DK); disc(g, 56, 30, 6, WAX); px(g, 53, 26, WAX_HI); px(g, 54, 26, WAX_HI);
          r(g, 55, 26, 3, 1, PAPER_HI); px(g, 54, 27, PAPER_HI); r(g, 55, 28, 2, 1, PAPER_HI); px(g, 57, 29, PAPER_HI); px(g, 54, 30, PAPER_HI); px(g, 57, 30, PAPER_HI); r(g, 55, 31, 2, 1, PAPER_HI); px(g, 54, 32, PAPER_HI); r(g, 55, 33, 3, 1, PAPER_HI);
          // sticky tabs out of both edges
          [[-3, 14, TAB_Y], [-3, 24, TAB_P], [-3, 33, TAB_G], [w - 1, 12, TAB_P], [w - 1, 28, TAB_Y]].forEach(function (tb) { r(g, tb[0], tb[1], 4, 4, tb[2]); });
          r(g, 6, h - 3, w - 10, 3, PAPER_SH);
        });
      }
      if (id === 'clip') {
        return stamp(b.w, b.h, function (g, w, h) {
          for (var y = 0; y < h; y++) { var ins = Math.round((h - 1 - y) * 0.6); r(g, ins, y, w - ins * 2, 1, y === 0 ? '#4a4a5a' : CLIPC); }
          r(g, 6, h - 3, w - 12, 1, '#34344a');
        });
      }
      if (id === 'head') {
        return stamp(b.w, b.h, function (g, w, h) {
          ream(g, rnd, w, h, 6, false);
          // the mouth: a shredder slot with strips hanging out
          r(g, 3, h - 7, 22, 3, INK);
          for (var st = 5; st < 24; st += 3) r(g, st, h - 4, 1, 2 + (st % 2), PAPER_HI);
          r(g, w - 9, 3, 5, 3, TAB_Y);
        });
      }
      if (id === 'board') {
        return stamp(b.w, b.h, function (g, w, h) {
          r(g, 0, 2, w, h - 2, '#8a5a34'); r(g, 0, 2, w, 1, '#b07a4a');
          r(g, 2, 5, w - 4, h - 7, PAPER_HI); for (var ly = 20; ly < h - 3; ly += 2) r(g, 4, ly, w - 10, 1, PAPER_SH);
          r(g, 9, 0, 12, 5, STEEL); r(g, 9, 0, 12, 1, WHITE); r(g, 12, 1, 6, 2, STEEL_DK);
        });
      }
      if (id === 'bundle') {
        return stamp(14, 12, function (g, w, h) {
          for (var y = 0; y < h; y += 2) { var o = (y >> 1) % 2; r(g, o, y, w - 1, 2, PAPER); r(g, o, y, w - 1, 1, PAPER_HI); }
          r(g, 3, 3, 4, 3, WAX); r(g, 0, 6, w, 1, KRAFT_DK);
        });
      }
      return canvas(1, 1);
    });
  }
  function pileImg() {
    return once('robot:pile', function () {
      var rnd = U.rng(1714);
      return stamp(PILE.w, PILE.h, function (g, w, h) {
        var tops = [];
        for (var x = 0; x < w; x++) {
          var k = Math.sin((x + 0.5) / w * Math.PI);
          var top = Math.round(h - (h - 6) * Math.pow(k, 0.7) + (rnd() - 0.5) * 2);
          tops.push(top);
          for (var y = top; y < h; y++) px(g, x, y, ((y + (x >> 2)) % 3 === 0) ? PAPER_SH : PAPER);
          px(g, x, top, PAPER_HI);
        }
        for (var i = 0; i < 30; i++) { var sx = 6 + rnd() * (w - 20), sy = tops[Math.round(sx)] + 3 + rnd() * 10; r(g, sx, sy, 6 + rnd() * 8, 1, rnd() < 0.5 ? PAPER_DK : PRINT); }
        [[14, h - 8, 16], [w - 40, h - 11, 18], [62, h - 15, 12], [100, h - 6, 14]].forEach(function (bn) { r(g, bn[0], bn[1], bn[2], 5, BINDER); r(g, bn[0], bn[1], bn[2], 1, BINDER_HI); r(g, bn[0], bn[1], 3, 5, BINDER_DK); });
        [[40, h - 12], [118, h - 14]].forEach(function (cl) { r(g, cl[0], cl[1], 7, 4, CLIPC); line(g, cl[0] + 1, cl[1], cl[0] - 1, cl[1] - 4, STEEL, 1); line(g, cl[0] + 5, cl[1], cl[0] + 7, cl[1] - 4, STEEL, 1); });
        [[26, h - 18, TAB_Y], [88, h - 22, TAB_P], [132, h - 9, TAB_G]].forEach(function (tb) { r(g, tb[0], tb[1], 4, 3, tb[2]); });
        // the wax seal on top, gone dim; a sheet waved as a white flag
        var ex = Math.round(w * 0.55), ey = tops[ex] + 4;
        disc(g, ex, ey, 5, WAX_DK); disc(g, ex, ey, 4, '#9a1a28'); px(g, ex - 2, ey - 2, '#c04050');
        var fx = 34, fy = tops[fx];
        r(g, fx, fy - 13, 1, 14, KRAFT); r(g, fx + 1, fy - 13, 10, 7, PAPER_HI); r(g, fx + 1, fy - 7, 10, 1, PAPER_SH);
        // one sheet stamped on the way down
        r(g, 104, h - 13, 24, 9, PAPER_HI); r(g, 105, h - 12, 22, 7, RED); r(g, 106, h - 11, 20, 5, PAPER_HI); tinyC(g, 'FILED', 116, h - 11, RED);
      });
    });
  }
  function archiveImg() {
    return once('robot:archive', function () {
      return stamp(ARCHIVE.w, ARCHIVE.h, function (g, w, h) {
        r(g, 0, 3, w, h - 3, KRAFT); r(g, 0, 3, w, 1, KRAFT_HI); r(g, w - 3, 3, 3, h - 3, KRAFT_DK); r(g, 0, h - 2, w, 2, KRAFT_DK);
        r(g, -1, 1, w + 2, 3, KRAFT_DK); r(g, -1, 1, w + 2, 1, KRAFT);
        r(g, 5, 7, 18, 7, PAPER_HI); tinyC(g, 'FILED', 14, 8, INK);
        r(g, 3, -2, 8, 3, PAPER); r(g, 14, -3, 6, 4, PAPER_SH);
      });
    });
  }

  // ------------------------------------------------------------ the robot, live
  // Its pose comes from story state (w.state.robot, w.state.fixed); sway, the throw and the
  // collapse are cosmetic timers on w.siegeFx. FRAME is shared with the weak-point looks,
  // which playfx draws later in the same frame.
  var FRAME = { show: false, dx: 0, bob: 0, liftF: 0, liftB: 0, arm: 0, c: 0, jx: 0 };
  function robotFrame(w, t) {
    var k = w.state.robot || 0;
    var f = { show: k > 0, dx: 0, bob: 0, liftF: 0, liftB: 0, arm: 0, c: 0, jx: 0, eye: 0 };
    if (!f.show) return f;
    var fx = track(w), calm = w.reduced;
    if (k < 1) {
      var s = Math.min(STEPS - 1e-6, k * STEPS), i = Math.floor(s), loc = s - i, mv = Math.min(1, loc / 0.55);
      f.dx = Math.round(ARRIVE_DX * (1 - (i + U.ease.inOut(mv)) / STEPS));
      var lift = loc < 0.55 ? Math.round(Math.sin(mv * Math.PI) * 10) : 0;
      if (i % 2 === 0) f.liftF = lift; else f.liftB = lift;
      f.bob = loc < 0.55 ? -Math.round(Math.sin(mv * Math.PI) * 2) : 0;
    } else {
      f.bob = calm ? 0 : Math.floor(t * 1.4) % 2;
      if (fx.windup != null && fx.windup < WIND) f.arm = 1 - Math.max(0, fx.windup) / WIND;
      if (fx.throwAt != null && w.time - fx.throwAt < 0.3) f.arm = -1 + (w.time - fx.throwAt) / 0.3;
      if (fx.flinchAt != null && w.time - fx.flinchAt < 0.25 && !calm) f.dx = 2;
    }
    if (allFixed(w)) f.c = fx.collapseAt == null ? 1 : U.clamp((w.time - fx.collapseAt) / COLLAPSE_DUR, 0, 1);
    if (f.c > 0 && f.c < 0.24 && !calm) f.jx = Math.floor(w.time * 24) % 2 ? 1 : -1;
    var sam = w.actors.SAM;
    if (sam && sam.visible) f.eye = sam.x < EYE.x + f.dx - 8 ? -1 : sam.x > EYE.x + f.dx + 8 ? 1 : 0;
    return f;
  }

  // How far a part has fallen during the collapse: [delay, drift x, rest height above ground].
  var FALL = {
    head: [0.06, -34, 16], clip: [0.12, 26, 10], armB: [0.08, 36, 4], armF: [0.14, -26, 4], board: [0.16, -30, 2],
    torso: [0.2, 4, 12], hips: [0.3, -8, 6], legF: [0.36, -6, 0], legB: [0.38, 8, 0], footF: [1, 0, 0], footB: [1, 0, 0]
  };
  function fallOff(id, c, bottom) {
    var f = FALL[id];
    if (!f || c <= f[0]) return [0, 0];
    var u = Math.min(1, (c - f[0]) / 0.32);
    return [Math.round(f[1] * u), Math.round(Math.max(0, (G - f[2] - bottom) * u * u))];
  }

  // An accordion-folded paper arm along a polyline.
  function accordion(g, pts, ox, oy) {
    var i;
    for (i = 0; i < pts.length - 1; i++) line(g, pts[i][0] + ox - 3, pts[i][1] + oy - 3, pts[i + 1][0] + ox - 3, pts[i + 1][1] + oy - 3, INK, 7);
    var n = 0;
    for (i = 0; i < pts.length - 1; i++) {
      var x0 = pts[i][0] + ox, y0 = pts[i][1] + oy, x1 = pts[i + 1][0] + ox, y1 = pts[i + 1][1] + oy;
      var len = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (var s = 0; s <= len; s++, n++) r(g, Math.round(x0 + (x1 - x0) * s / len) - 2, Math.round(y0 + (y1 - y0) * s / len) - 2, 5, 5, (n >> 2) % 2 ? PAPER : PAPER_SH);
    }
  }
  function lerpPt(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }

  function drawRobot(g, w, camX, t, f) {
    if (!f.show) return;
    if (f.c >= 1) { drawPile(g, w, camX); return; }
    var X = f.dx + f.jx - camX;
    if (ROBOT_X0 + X > W + 10 || ROBOT_X1 + X < -10) { if (f.c > 0) drawPileGrow(g, camX, f.c); return; }
    var c = f.c;
    function part(id, liftY, upper) {
      var b = RB[id], o = fallOff(id, c, b.y + b.h);
      if (c > 0.9) return;
      g.drawImage(partImg(id), Math.round(b.x + X + o[0]) - 1, Math.round(b.y + (upper ? f.bob : 0) - (liftY || 0) + o[1]) - 1);
    }
    // the back arm, raised, a bundle of notices in its hand
    var ob = fallOff('armB', c, 70), ub = f.bob;
    if (c <= 0.9) {
      var pose = f.arm > 0 ? [lerpPt(ARM_B.rest[0], ARM_B.wind[0], f.arm), lerpPt(ARM_B.rest[1], ARM_B.wind[1], f.arm)]
        : f.arm < 0 ? [lerpPt(ARM_B.rest[0], ARM_B.toss[0], -f.arm), lerpPt(ARM_B.rest[1], ARM_B.toss[1], -f.arm)] : ARM_B.rest;
      accordion(g, [SHOULDER_B, pose[0], pose[1]], X + ob[0], ub + ob[1]);
      if (c === 0) g.drawImage(partImg('bundle'), Math.round(pose[1][0] + X - 7) - 1, Math.round(pose[1][1] + ub - 10) - 1);
    }
    part('legB', f.liftB); part('footB', f.liftB);
    part('hips', 0, true); part('torso', 0, true);
    part('head', 0, true);
    // the paperclip antenna and the wax-seal eye
    var ho = fallOff('head', c, RB.head.y + RB.head.h), hx = RB.head.x + X + ho[0], hy = RB.head.y + f.bob + ho[1];
    if (c <= 0.9) {
      line(g, hx + 28, hy - 13, hx + 28, hy + 1, INK, 3); line(g, hx + 28, hy - 13, hx + 33, hy - 13, INK, 3); line(g, hx + 33, hy - 13, hx + 33, hy - 2, INK, 3);
      line(g, hx + 29, hy - 12, hx + 29, hy + 1, STEEL, 1); line(g, hx + 29, hy - 12, hx + 33, hy - 12, STEEL, 1); line(g, hx + 33, hy - 12, hx + 33, hy - 3, STEEL, 1);
      line(g, hx + 31, hy - 3, hx + 31, hy - 9, STEEL, 1);
      var ex = Math.round(EYE.x + X + ho[0]), ey = Math.round(EYE.y + f.bob + ho[1]);
      disc(g, ex, ey, 8, INK); disc(g, ex, ey, 7, WAX_DK); disc(g, ex, ey, 6, c > 0 ? '#9a1a28' : WAX);
      for (var a = 0; a < 8; a++) px(g, ex + Math.round(Math.cos(a * Math.PI / 4) * 5), ey + Math.round(Math.sin(a * Math.PI / 4) * 5), WAX_DK);
      disc(g, ex + f.eye * 2, ey, 2, c > 0 ? '#5a0a14' : INK);
      if (c === 0 && (w.reduced || Math.floor(t * 2) % 2 === 0)) { px(g, ex - 3, ey - 3, WAX_HI); px(g, ex - 2, ey - 3, WAX_HI); px(g, ex - 3, ey - 2, WAX_HI); }
    }
    // the giant binder clip for shoulders, its wire handles up like horns
    part('clip', 0, true);
    var co = fallOff('clip', c, RB.clip.y + RB.clip.h), cx = RB.clip.x + X + co[0], cy = RB.clip.y + f.bob + co[1];
    if (c <= 0.9) {
      [[8, -6], [RB.clip.w - 8, 6]].forEach(function (hd) {
        var x0 = cx + hd[0], tipX = x0 + hd[1], tipY = cy - 11;
        line(g, x0 - 1, cy - 1, tipX - 1, tipY - 1, INK, 3); line(g, x0, cy, tipX, tipY, STEEL, 1);
        line(g, tipX - 1, tipY - 1, tipX - 1 - hd[1] / 2, tipY - 1, INK, 3); line(g, tipX, tipY, tipX - hd[1] / 2, tipY, STEEL, 1);
      });
    }
    part('legF', f.liftF); part('footF', f.liftF);
    // the front arm, holding out its clipboard of forms
    var of = fallOff('armF', c, 96);
    if (c <= 0.9) accordion(g, [SHOULDER_F, [1562, 76], HAND_F], X + of[0], f.bob + of[1]);
    part('board', 0, true);
    if (c > 0.42) drawPileGrow(g, camX, c);
  }
  // The pile rises out of the ground as the parts come down onto it.
  function drawPileGrow(g, camX, c) {
    var k = U.clamp((c - 0.42) / 0.48, 0, 1);
    if (k <= 0) return;
    var img = pileImg(), hh = Math.max(1, Math.round(img.height * U.ease.out(k))), sy = img.height - hh;
    var x = Math.round(PILE.x - camX) - 1, y = G + 1 - PILE.h - 1;
    g.drawImage(img, 0, sy, img.width, hh, x, y + sy, img.width, hh);
  }
  function drawPile(g, w, camX) {
    var x = Math.round(PILE.x - camX);
    if (x < W + 10 && x + PILE.w > -10) g.drawImage(pileImg(), x - 1, G + 1 - PILE.h - 1);
  }
  // The robot's case files hop out of the pile into an archive box, then the rest follows.
  function drawArchive(g, w, camX, t, f) {
    if (!f.show || f.c <= 0.55) return;
    var k = U.clamp((f.c - 0.55) / 0.35, 0, 1);
    var x0 = 1616, x1 = ARCHIVE.x, y1 = G - ARCHIVE.h;
    var x = U.lerp(x0, x1, k), y = U.lerp(G - 30, y1, k) - Math.sin(k * Math.PI) * 26;
    var sx = Math.round(x - camX);
    if (sx > W + 20 || sx < -40) return;
    g.drawImage(archiveImg(), sx - 1, Math.round(y) - 1);
    var fx = w.siegeFx;
    if (!fx || f.c < 1) return;
    (fx.sheets || []).forEach(function (s) {
      var u = U.clamp((w.time - s.at) / s.dur, 0, 1);
      var qx = U.lerp(s.x0, ARCHIVE.x + 14, u) - camX, qy = U.lerp(s.y0, G - ARCHIVE.h, u) - Math.sin(u * Math.PI) * 30;
      var c2 = Math.cos(u * 9 + s.spin), ww = Math.max(1, Math.round(8 * Math.abs(c2)));
      r(g, qx - ww / 2 - 1, qy - 1, ww + 2, 8, INK); r(g, qx - ww / 2, qy, ww, 6, c2 > 0 ? PAPER_HI : PAPER_SH);
      if (ww > 4 && c2 > 0) { r(g, qx - ww / 2 + 1, qy + 2, ww - 2, 1, PRINT); }
    });
  }

  // ------------------------------------------------------------ the targets' looks (drawn by playfx)
  function snapPop(k) { return k < 0 ? 0 : Math.round(Math.sin(U.clamp(k, 0, 1) * Math.PI) * -2); }
  function frameRect(g, x, y, w, h, edge, fill) { r(g, x, y, w, h, INK); r(g, x + 1, y + 1, w - 2, h - 2, edge); r(g, x + 2, y + 2, w - 4, h - 4, fill); }
  // A torn picture: the broken-image icon.
  function brokenImage(g, x, y, w, h) {
    r(g, x, y, w, h, '#e4e4ee');
    r(g, x + 1, y + h - 3, Math.floor(w / 2) - 1, 2, '#9aa4b8'); px(g, x + 3, y + h - 4, '#9aa4b8');
    r(g, x + Math.floor(w / 2) + 1, y + 2, w - Math.floor(w / 2) - 2, 1, '#9aa4b8');
    for (var i = 0; i < h; i++) px(g, x + Math.floor(w / 2) + (i % 2), y + i, INK);
    disc(g, x + w - 4, y + h - 5, 1, '#c8ccd8');
  }
  function photo(g, x, y, w, h, prod) {
    P.vgrad(g, x, y, w, h, [[0, '#7ac8ff'], [1, '#d8f0ff']]);
    disc(g, x + w - 4, y + 3, 2, '#ffe05a');
    r(g, x, y + h - 3, w, 3, '#4ac06a');
    if (prod) { r(g, x + 3, y + h - 6, 9, 3, prod); r(g, x + 3, y + h - 7, 4, 1, prod); r(g, x + 3, y + h - 4, 10, 1, WHITE); }
    else { r(g, x + 2, y + h - 6, 5, 3, '#2f8a4a'); r(g, x + 5, y + h - 8, 6, 5, '#3aa85a'); }
  }
  function lookDoor(g, T, x, y, t, k, seed, reduced) {
    var d = BY_ID[T.id];
    if (!d) return;
    var w = T.w, h = T.h, fixed = k >= 0, calm = reduced, blink = calm || Math.floor(t * 2) % 2 === 0;
    y += snapPop(k);
    switch (d.look) {
      case 'img':
        frameRect(g, x, y, w, h, fixed ? OK : '#9aa0b4', '#f4f4fa');
        if (fixed) { photo(g, x + 2, y + 2, w - 4, h - 9, '#ff5ab0'); r(g, x + 2, y + h - 7, w - 4, 5, WHITE); tiny(g, 'ALT', x + 3, y + h - 7, INK); check(g, x + w - 8, y + h - 6, OK_DK); }
        else { brokenImage(g, x + 3, y + 3, w - 6, h - 11); tinyC(g, 'ALT?', x + w / 2, y + h - 7, RED); }
        break;
      case 'contrast':
        r(g, x, y, w, h, INK);
        r(g, x + 1, y + 1, w - 2, h - 2, fixed ? '#16306e' : '#7a8094');
        if (fixed) { r(g, x + 1, y + 1, w - 2, 1, FOCUS); MS.font.drawCentered(g, 'HELP', x + w / 2, y + 4, WHITE); check(g, x + w - 7, y + h - 6, OK); }
        else MS.font.drawCentered(g, 'HELP', x + w / 2, y + 4, '#8a90a2');
        break;
      case 'focus':
        if (fixed) { r(g, x, y + 3, w, h - 6, INK); r(g, x + 1, y + 4, w - 2, h - 8, FOCUS); r(g, x + 3, y + 6, w - 6, h - 12, '#2a5ae0'); tinyC(g, 'GO', x + w / 2, y + 7, WHITE); }
        else { r(g, x + 2, y + 5, w - 4, h - 10, INK); r(g, x + 3, y + 6, w - 6, h - 12, '#6a7aa8'); tinyC(g, 'GO', x + w / 2, y + 7, '#c8d0e8'); }
        break;
      case 'label':
        frameRect(g, x, y, w, h, fixed ? OK : '#c8ccd8', '#f6f6fa');
        r(g, x + 2, y + 2, w - 4, 3, '#22804a');
        if (fixed) { tiny(g, 'NAME', x + 3, y + 6, INK); r(g, x + 3, y + 11, w - 10, 3, INK); r(g, x + 4, y + 12, w - 12, 1, WHITE); check(g, x + w - 7, y + 11, OK_DK); }
        else { tiny(g, '?', x + 3, y + 8, RED); r(g, x + 7, y + 8, w - 10, 5, INK); r(g, x + 8, y + 9, w - 12, 3, WHITE); if (blink) r(g, x + 9, y + 9, 1, 3, INK); }
        break;
      case 'trap':
        r(g, x + 4, y + 3, 14, 10, INK); r(g, x + 5, y + 4, 12, 8, WHITE); r(g, x + 5, y + 11, 12, 1, '#c8ccd8'); tiny(g, 'TAB', x + 5, y + 5, INK);
        if (fixed) { r(g, x, y + 2, 2, 12, STEEL_DK); r(g, x + w - 2, y + 2, 2, 12, STEEL_DK); r(g, x + w - 6, y + 13, 4, 1, OK); check(g, x + w - 6, y, OK); }
        else { for (var bx = x + 1; bx < x + w; bx += 3) r(g, bx, y, 1, h, INK); r(g, x, y, w, 1, INK); r(g, x, y + h - 1, w, 1, INK); padlock(g, x + w - 9, y + h - 9, false); }
        break;
      case 'captions':
        r(g, x, y, w, h, INK); r(g, x + 1, y + 1, w - 2, h - 2, '#2a2c3e');
        r(g, x + 2, y + 2, w - 4, h - 9, '#2a3a6a'); disc(g, x + w / 2, y + 7, 3, '#d8a07a'); r(g, x + w / 2 - 5, y + 10, 10, 3, '#3a4a8a');
        r(g, x + 2, y + h - 7, w - 4, 5, '#0a0a14');
        if (fixed) { r(g, x + 4, y + h - 6, 12, 1, WHITE); r(g, x + 4, y + h - 4, 16, 1, WHITE); r(g, x + w - 9, y + h - 7, 7, 5, WHITE); tiny(g, 'C', x + w - 8, y + h - 7, INK); px(g, x + w - 4, y + h - 5, INK); }
        else if (blink) { px(g, x + w / 2 - 3, y + h - 4, '#9aa0b4'); px(g, x + w / 2, y + h - 4, '#9aa0b4'); px(g, x + w / 2 + 3, y + h - 4, '#9aa0b4'); }
        break;
      case 'link':
        // a sandwich board on the sidewalk
        line(g, x + 2, y + h - 1, x + 6, y + 2, INK, 2); line(g, x + w - 3, y + h - 1, x + w - 7, y + 2, INK, 2);
        r(g, x + 1, y, w - 2, h - 5, INK); r(g, x + 2, y + 1, w - 4, h - 7, '#3a2a1a'); r(g, x + 3, y + 2, w - 6, h - 9, '#24302a');
        if (fixed) { tinyC(g, 'VIEW', x + w / 2, y + 3, WHITE); tinyC(g, 'DATES', x + w / 2, y + 9, '#ffe05a'); r(g, x + 4, y + 15, w - 8, 1, '#ffe05a'); }
        else { tinyC(g, 'CLICK', x + w / 2, y + 3, '#7a8a80'); tinyC(g, 'HERE', x + w / 2, y + 9, '#7a8a80'); r(g, x + 5, y + 15, w - 10, 1, '#5a6a60'); }
        break;
    }
  }
  // A weak point on the robot: corner brackets pulse red at 1 Hz (steady with reduced motion)
  // until it's fixed, then it seals with a green rim.
  function corners(g, x, y, w, h, col) {
    [[x - 2, y - 2, 1, 1], [x + w + 1, y - 2, -1, 1], [x - 2, y + h + 1, 1, -1], [x + w + 1, y + h + 1, -1, -1]].forEach(function (cn) {
      r(g, Math.min(cn[0], cn[0] + cn[2] * 3), cn[1], 4, 1, col); r(g, cn[0], Math.min(cn[1], cn[1] + cn[3] * 3), 1, 4, col);
    });
  }
  function lookWeak(g, T, x, y, t, k, seed, reduced) {
    var d = BY_ID[T.id];
    if (!d || !FRAME.show || FRAME.c > 0.2) return;
    var lift = d.part === 'legF' ? -FRAME.liftF : d.part === 'legB' ? -FRAME.liftB : FRAME.bob;
    x += FRAME.dx + FRAME.jx; y += lift + snapPop(k);
    var w = T.w, h = T.h, fixed = k >= 0, pulse = reduced || Math.floor(t * 2) % 2 === 0;
    if (!fixed) corners(g, x, y, w, h, pulse ? RED : RED_DK);
    var edge = fixed ? OK : (pulse ? RED : RED_DK);
    switch (d.look) {
      case 'alt':
        frameRect(g, x, y, w, h, edge, '#e8e2d2');
        if (fixed) { photo(g, x + 2, y + 2, w - 4, h - 9, null); r(g, x + 2, y + h - 7, w - 4, 5, WHITE); tiny(g, 'ALT', x + 4, y + h - 7, INK); check(g, x + w - 9, y + h - 6, OK_DK); }
        else { brokenImage(g, x + 4, y + 3, w - 8, h - 11); tinyC(g, 'NO ALT', x + w / 2, y + h - 7, RED); }
        break;
      case 'contrast':
        frameRect(g, x, y, w, h, edge, fixed ? WHITE : '#9a9aa6');
        if (fixed) { tinyC(g, '4.5:1', x + w / 2, y + 3, '#16306e'); r(g, x + 4, y + 10, w - 8, 1, '#16306e'); check(g, x + w - 8, y + h - 6, OK_DK); }
        else { tinyC(g, '2:1', x + w / 2, y + 3, '#a8a8b4'); r(g, x + 4, y + 10, w - 8, 1, '#a6a6b2'); }
        break;
      case 'trap':
        r(g, x, y, w, h, INK); r(g, x + 1, y + 1, w - 2, h - 2, edge);
        r(g, x + 5, y + 3, 12, 8, WHITE); r(g, x + 5, y + 10, 12, 1, '#c8ccd8'); tiny(g, 'TAB', x + 5, y + 4, INK);
        if (fixed) check(g, x + w - 7, y + 1, WHITE);
        else for (var tj = 0; tj < w - 2; tj += 3) { px(g, x + 1 + tj, y + 2, STEEL); px(g, x + 2 + tj, y + 3, STEEL); px(g, x + 1 + tj, y + h - 3, STEEL); px(g, x + 2 + tj, y + h - 4, STEEL); }
        break;
      case 'focus':
        if (fixed) { r(g, x, y, w, h, INK); r(g, x + 1, y + 1, w - 2, h - 2, FOCUS); r(g, x + 3, y + 3, w - 6, h - 6, '#2a5ae0'); tinyC(g, 'AGREE', x + w / 2, y + 4, WHITE); }
        else { r(g, x + 2, y + 2, w - 4, h - 4, INK); r(g, x + 3, y + 3, w - 6, h - 6, '#6a6a7a'); tinyC(g, 'AGREE', x + w / 2, y + 4, '#a8a8b8'); }
        break;
      case 'label':
        frameRect(g, x, y, w, h, edge, PAPER_HI);
        if (fixed) { tiny(g, 'NAME', x + 3, y + 2, INK); r(g, x + 3, y + 8, w - 6, 3, INK); r(g, x + 4, y + 9, w - 8, 1, WHITE); }
        else { tiny(g, '?', x + 3, y + 4, RED); r(g, x + 7, y + 4, w - 10, 6, INK); r(g, x + 8, y + 5, w - 12, 4, WHITE); if (pulse) r(g, x + 9, y + 5, 1, 4, INK); }
        break;
    }
  }
  function registerLooks() {
    if (!MS.playfx || !MS.playfx.looks || MS.playfx.looks.siegeweak) return;
    MS.playfx.looks.siegedoor = lookDoor;
    MS.playfx.looks.siegeweak = lookWeak;
  }
  registerLooks();

  // ------------------------------------------------------------ live drawing behind the cast
  function drawStatusBoard(g, w, camX, t) {
    var bx = Math.round(BOARD.x - camX), by = BOARD.y;
    if (bx > W + 4 || bx + BOARD.w < -4) return;
    var fixed = w.state.fixed || {}, k = w.state.locked || 0, blink = w.reduced || Math.floor(t * 2) % 2 === 0;
    r(g, bx, by, BOARD.w, BOARD.h, INK); r(g, bx + 1, by + 1, BOARD.w - 2, BOARD.h - 2, '#2a2e4c');
    r(g, bx + 3, by + 3, BOARD.w - 6, BOARD.h - 6, '#0a1026');
    tiny(g, 'SITE STATUS', bx + 6, by + 5, '#cfe0ff');
    var open = 0;
    STORES.forEach(function (s, i) {
      var tx = bx + 6 + (i % 4) * 26, ty = by + 13 + Math.floor(i / 4) * 17;
      var ok = fixed[s.target], locked = k >= (i + 1) / (STORES.length + 1);
      if (!ok) open++;
      r(g, tx, ty, 24, 15, ok ? '#0e3424' : '#3a1020');
      r(g, tx, ty, 24, 1, ok ? OK : RED);
      tinyC(g, s.name, tx + 12, ty + 2, '#e8ecff');
      if (locked) miniLock(g, tx + 10, ty + 8);
      else if (ok) check(g, tx + 10, ty + 9, OK);
      else if (blink) tiny(g, '!', tx + 11, ty + 8, RED);
    });
    var msg = k >= 1 ? 'ALL LOCKED' : open ? open + ' OPEN' : 'ALL FIXED';
    var col = k >= 1 ? OK : open ? RED : WARM;
    tiny(g, msg, bx + BOARD.w - 6 - tinyW(msg), by + 5, col);
    // the eighth slot: the design system, the one fix behind every door
    var sx = bx + 6 + 3 * 26, sy = by + 30;
    r(g, sx, sy, 24, 15, '#16245a'); r(g, sx, sy, 24, 1, FOCUS); tinyC(g, 'DS', sx + 12, sy + 3, FOCUS); tinyC(g, k >= 1 ? 'ON' : '...', sx + 12, sy + 9, k >= 1 ? OK : '#8a96c8');
  }

  // The audit billboard over the plaza counts the ways in: every unfixed door and weak point.
  function drawBillboard(g, w, camX, t) {
    var bx = Math.round(BILL.x - camX), by = BILL.y;
    if (bx > W + 4 || bx + BILL.w < -4) return;
    var fixed = w.state.fixed || {}, n = 0;
    TARGETS.forEach(function (tg) { if (!fixed[tg.id]) n++; });
    r(g, bx, by, BILL.w, BILL.h, INK); r(g, bx + 1, by + 1, BILL.w - 2, BILL.h - 2, '#2a2e4c'); r(g, bx + 3, by + 3, BILL.w - 6, BILL.h - 6, '#0a1026');
    tinyC(g, 'ACCESSIBILITY AUDIT', bx + BILL.w / 2, by + 6, '#cfe0ff');
    MS.font.drawCentered(g, 'WAYS IN: ' + n, bx + BILL.w / 2, by + 16, n ? '#ff6a6a' : OK);
    var total = TARGETS.length, done = total - n;
    r(g, bx + 8, by + 32, BILL.w - 16, 5, '#1c2244');
    r(g, bx + 8, by + 32, Math.round((BILL.w - 16) * done / total), 5, n ? '#ffb040' : OK);
    tinyC(g, n ? 'WCAG 2.2 AA: FAILING' : 'WCAG 2.2 AA: PASS', bx + BILL.w / 2, by + 39, n ? '#ff9a9a' : OK);
  }

  // The gate's leaves stand open until the robot falls, then swing shut under a green padlock.
  function gateShut(w, f) {
    if (!allFixed(w)) return 0;
    return f.c >= 1 || !f.show ? 1 : U.clamp((f.c - 0.62) / 0.34, 0, 1);
  }
  function drawGate(g, w, camX, t, f) {
    var cx = Math.round(GATE.cx - camX);
    if (cx < -80 || cx > W + 80) return;
    var k = gateShut(w, f);
    for (var y = GATE.top + 4; y < LIP; y++) {
      var hw = archHalf(y);
      if (!hw) continue;
      var lw = Math.round(U.lerp(5, hw, k));
      [[cx - hw, 1], [cx + hw - lw, -1]].forEach(function (lf) {
        r(g, lf[0], y, lw, 1, (y % 12) < 2 ? '#3e4570' : '#5a6290');
        if (lw > 6) { px(g, lf[1] > 0 ? lf[0] + lw - 1 : lf[0], y, INK); if (y % 12 === 6) { px(g, lf[0] + 3, y, '#8a92c0'); px(g, lf[0] + lw - 4, y, '#8a92c0'); } }
      });
    }
    if (k >= 1) { r(g, cx - 1, GATE.top + 8, 2, LIP - GATE.top - 8, INK); r(g, cx - 16, 112, 32, 4, '#2a2e4e'); }
    padlock(g, cx - 4, 34, k >= 1);
  }

  function drawLocks(g, w, camX) {
    var k = w.state.locked || 0;
    if (k <= 0) return;
    STORES.forEach(function (s, i) {
      var at = (i + 1) / (STORES.length + 1);
      if (k < at) return;
      var u = Math.min(1, (k - at) * (STORES.length + 1) * 2);
      var x = Math.round(doorX(s) + 6 - camX);
      if (x < -20 || x > W + 20) return;
      padlock(g, x, 98 - (w.reduced ? 0 : Math.round((1 - U.ease.out(u)) * 8)), true);
    });
  }

  function drawBack(g, w, camX, t) {
    registerLooks();
    FRAME = robotFrame(w, t);
    drawStatusBoard(g, w, camX, t);
    drawBillboard(g, w, camX, t);
    drawGate(g, w, camX, t, FRAME);
    drawLocks(g, w, camX);
    drawRobot(g, w, camX, t, FRAME);
    drawArchive(g, w, camX, t, FRAME);
  }

  // While it marches in: a Metal Slug warning, blinking at 1.25 Hz (steady with reduced motion).
  function drawFront(g, w, camX, t) {
    var k = w.state.robot || 0;
    if (k <= 0 || k >= 1 || !MS.font.big) return;
    var shift = w.reduced ? 0 : Math.floor(t * 20) % 8;
    [24, 52].forEach(function (yy) {
      r(g, 0, yy, W, 6, INK);
      for (var x = -8 + shift; x < W; x += 8) { r(g, x, yy + 1, 4, 4, '#ffcf3a'); }
    });
    if (!w.reduced && Math.floor(t * 2.5) % 2) return;
    var img = MS.font.big('WARNING!', { scale: 2, outline: 1, stops: ['#ffffff', '#ffd0d0', '#ff5a5a', '#c8202a', '#ff7a7a'], shadowColor: '#0b0508' });
    g.drawImage(img, Math.round(W / 2 - img.width / 2), 31);
    MS.font.drawCentered(g, 'LEGAL RISK APPROACHING', W / 2, 62, '#ffd0d0', { shadow: INK });
  }

  // ------------------------------------------------------------ cosmetic updates
  // Collapse beats, steam off the manholes, and pages filing themselves away.
  var CUES = [
    [0, function (w) { w.sfx('boom'); if (w.explode) w.explode(RB.head.x + 19, RB.head.y + 12, 'small'); paperBurst(w, RB.head.x + 19, RB.head.y + 12, 12); }],
    [0.2, function (w) { if (w.explode) w.explode(RB.torso.x + 38, RB.torso.y + 20, 'medium'); paperBurst(w, RB.torso.x + 38, RB.torso.y + 20, 18); w.sfx('paper'); }],
    [0.42, function (w) { if (w.explode) w.explode(RB.hips.x + 40, RB.hips.y + 8, 'small'); paperBurst(w, RB.hips.x + 40, RB.hips.y + 8, 14); }],
    [0.62, function (w) {
      w.sfx('stomp');
      if (w.burst) w.burst(1608, G - 2, 16, { kind: 'dust', colors: ['#8a8aa8', '#6a6a88'], speed: 60, g: -10, angle: -Math.PI / 2, spread: Math.PI * 1.4, life: 0.6, size: 2, floor: false });
      if (!w.reduced) { w.camera.shake = 0.3; w.camera.shakeAmp = 2; }
    }],
    [0.96, function (w) { w.sfx('lock'); if (w.burst) w.burst(GATE.cx, 40, 12, { kind: 'spark', colors: [WHITE, OK, FOCUS], speed: 70, g: 0, spread: Math.PI * 2, life: 0.5, floor: false }); }]
  ];
  function paperBurst(w, x, y, n) {
    if (w.burst) w.burst(x, y, n, { kind: 'confetti', colors: [PAPER, PAPER_SH, PAPER_HI, TAB_Y], speed: 100, g: 140, life: 1.4, spread: Math.PI * 1.7 });
  }
  var MANHOLES = [300, 700, 1150];
  function update(w, dt) {
    var fx = track(w);
    if (fx.collapseAt != null && w.fx) {
      var c = (w.time - fx.collapseAt) / COLLAPSE_DUR;
      fx.cues = fx.cues || {};
      CUES.forEach(function (cu, i) { if (!fx.cues[i] && c >= cu[0]) { fx.cues[i] = true; cu[1](w); } });
    }
    if (!w.fx || w.reduced) return;
    var cam = w.camera.x;
    fx.steam -= dt;
    if (fx.steam <= 0) {
      fx.steam = 0.45;
      MANHOLES.forEach(function (mx) {
        if (mx < cam - 20 || mx > cam + W + 20 || Math.random() > 0.6) return;
        w.fx.particles.push({ x: mx + (Math.random() - 0.5) * 10, y: 186, vx: 3 + Math.random() * 3, vy: -12, g: -3, life: 1.6, color: Math.random() > 0.5 ? '#7a7c9a' : '#5e607e', size: 3, kind: 'puff', floor: false });
      });
    }
    // once it's a pile, the pages file themselves away a sheet at a time
    if (fx.all && (fx.collapseAt == null || w.time - fx.collapseAt > COLLAPSE_DUR)) {
      fx.sheet -= dt;
      fx.sheets = fx.sheets.filter(function (s) { return w.time - s.at < s.dur; });
      if (fx.sheet <= 0 && ARCHIVE.x > cam - 200 && PILE.x < cam + W + 60) {
        fx.sheet = 1.1 + Math.random() * 0.6;
        fx.sheets.push({ at: w.time, dur: 1.3, x0: 1586 + Math.random() * 70, y0: G - 30 - Math.random() * 6, spin: Math.random() * 6 });
      }
    }
  }

  // ------------------------------------------------------------ events
  // [the robot arrives]: it stomps in from the right, four steps, the ground thumping each
  // time a binder lands. Deterministic: finish() snaps it into place (robot = 1).
  function stomp(w, n) {
    w.sfx('stomp');
    var dx = Math.round(ARRIVE_DX * (1 - n / STEPS)), foot = n % 2 ? RB.footF : RB.footB;
    if (w.burst) w.burst(foot.x + dx + foot.w / 2, G - 1, 10, { kind: 'dust', colors: ['#8a8aa8', '#6a6a88'], speed: 50, g: -10, angle: -Math.PI / 2, spread: Math.PI * 1.5, life: 0.5, size: 2, floor: false });
    if (!w.reduced) { w.camera.shake = 0.22; w.camera.shakeAmp = 2; }
  }
  var LOCK_DUR = 1.6;

  MS.sets = MS.sets || {};
  MS.sets.siege = {
    name: 'siege', era: 'modern', width: WIDTH, ground: G, camera: 200, entry: 40, bg: '#090c24',
    haze: '#4a5486', music: 'siege', crowd: 'WORKERS',
    marks: {
      hq: M.hq, headquarters: M.hq, lobby: M.hq, street: M.street, storefronts: 500, shops: 500, stores: 500,
      cafe: 935, 'status board': 942, board: 942, barricade: M.barricade, arena: M.arena, plaza: M.arena,
      robot: 1602, litigator: 1602, pile: 1602, gate: M.gate, 'city gate': M.gate
    },
    // The night shift huddles in front of the cafe, between the street and the barricade:
    // in frame for the street pan (camera 708) and when Sam stops at the barricade (823).
    cast: {
      SAM: { names: ['SAM'], costume: 'sam4', x: -40, visible: false },
      WORKER1: { names: ['WORKER 1'], costume: 'worker1', x: 864, groups: ['WORKERS'] },
      WORKER2: { names: ['WORKER 2'], costume: 'worker2', x: 890, groups: ['WORKERS'] },
      DESIGNER: { names: ['DESIGNER', 'THE DESIGNER'], costume: 'designer', x: 918, groups: ['WORKERS'] },
      DEVELOPER: { names: ['DEVELOPER', 'DEV', 'THE DEVELOPER'], costume: 'developer', x: 946, facing: -1, groups: ['WORKERS'] },
      PM: { names: ['PM', 'PRODUCT MANAGER', 'THE PM'], costume: 'pm', x: 974, facing: -1, groups: ['WORKERS'] }
    },
    events: [
      { id: 'arrive', match: /^(?:the )?(?:giant |paper |legal )?(?:robot|litigator|boss) (?:arrives|appears|attacks|lands|stomps in|marches in|walks in)$/ },
      { id: 'lock', match: /^(?:the |all the |every )?(?:doors?|pages?|sites?|storefronts?) (?:lock|locks|shut|close|lock up)$/ }
    ],
    eventsById: {
      arrive: { run: function (w, args, Task) {
        var planted = 0;
        return new Task(ARRIVE_DUR, function (t) {
          var k = Math.min(0.999, t / ARRIVE_DUR);
          w.state.robot = k;
          var s = k * STEPS, i = Math.floor(s), want = i + (s - i >= 0.55 ? 1 : 0);
          while (planted < Math.min(STEPS, want)) { planted++; if (!w.instant) stomp(w, planted); }
        }, function () { w.state.robot = 1; });
      } },
      // Every storefront fixed on the way locks, one after another, and the board agrees.
      lock: { run: function (w, args, Task) {
        var done = 0;
        return new Task(LOCK_DUR, function (t) {
          w.state.locked = Math.min(0.999, t / LOCK_DUR);
          var want = Math.min(STORES.length, Math.floor(w.state.locked * (STORES.length + 1)));
          while (done < want) {
            var s = STORES[done++];
            if (w.instant) continue;
            w.sfx('lock');
            var x = doorX(s) + 10;
            if (w.burst && x > w.camera.x - 10 && x < w.camera.x + W + 10) w.burst(x, 104, 8, { kind: 'spark', colors: [WHITE, OK], speed: 60, g: 0, spread: Math.PI * 2, life: 0.4, floor: false });
          }
        }, function () { w.state.locked = 1; });
      } }
    },
    initState: function () { return { robot: 0, locked: 0 }; },
    level: { solids: SOLIDS, targets: TARGETS, gates: GATES, spawn: spawn, update: levelUpdate, onHit: onHit },
    layers: layers, props: props, drawBack: drawBack, drawFront: drawFront, update: update
  };
})(typeof window !== 'undefined' ? window : globalThis);
