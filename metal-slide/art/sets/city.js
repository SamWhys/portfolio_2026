/* METAL SLIDE set: Mission 3, the City of 47 Blues. A bright open-plan office on a high
   floor, glass from wall to wall, the skyline outside. Left to right: the lobby (revolving
   door, reception, elevators), the print corner, the lounge, the desks and the wall of 47
   buttons, the hall of brand-blue posters, the kitchen and its water cooler, and the big
   window at the end. Mismatched buttons drift about to be blasted into tokens.
   Events: [buttons unify] (the 47 buttons snap into one component set),
   [city builds] (towers rise outside, block by block, all from the same blocks),
   [the numbers climb] (the board turns into a results dashboard) and [sirens] (emergency
   light from the street at the big window, and a news ticker about the new laws). */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint, F = MS.font, C = MS.color;
  var W = MS.W, H = MS.H;
  var G = 156;          // where feet stand
  var LIP = 146;        // the back edge of the floor: the 1px dark lip
  var WIDTH = 2200;

  // Story places, left to right. The desk crowd stands so that it reads on screen at the
  // desks, at the board and in the opening pan (see the cast below).
  var M = { lobby: 56, meeting: 790, desks: 1000, board: 1200, kitchen: 1540, museum: 1720, window: 1960 };
  var BOARD = { x: 1044, y: 36, w: 140, h: 64 };
  var BIG_WINDOW = 1800;
  var SKY_SPEED = 0.06, CITY_SPEED = 0.25, STREET_SPEED = 0.5, FRONT_SPEED = 1.3;

  // Interior colors: light, cool and low in contrast, so the dark-outlined people pop.
  var INK = '#1d2130';
  var CEIL = '#eef1f6', CEIL2 = '#d5dae4', MUL = '#8b95a8', MUL_HI = '#bcc4d2', MUL_SH = '#6c7588';
  var CRED = '#dfe3ea', CRED_HI = '#f5f7fa', CRED_SH = '#c2c8d3';
  var BLUE = '#2f5be0', BLUE_HI = '#6a90ff', BLUE_SH = '#1e3c9c';

  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

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
  // Paint a w x h prop into a canvas with a 1px margin for the outline.
  function stamp(w, h, paint, ink) {
    var c = canvas(w + 2, h + 2), g = c.getContext('2d');
    g.save(); g.translate(1, 1); paint(g, w, h); g.restore();
    return outline(c, ink);
  }
  function r(g, x, y, w, h, col) { P.rect(g, x, y, w, h, col); }
  function fakeText(g, x, y, w, col) { for (var i = 0; i < w; i += 5) r(g, x + i, y, Math.min(3 + (i * 7) % 3, w - i), 1, col); }

  // ------------------------------------------------------------ level data
  // Solids stand on the floor (h <= 28) and are drawn below so the look matches the box.
  var SOLIDS = [
    { x: 226, w: 20, h: 16, kind: 'boxes' },
    { x: 446, w: 24, h: 24, kind: 'copier' },
    { x: 610, w: 42, h: 16, kind: 'pingpong' },
    { x: 838, w: 16, h: 20, kind: 'planter' },
    { x: 1084, w: 14, h: 13, kind: 'chair' },
    { x: 1318, w: 22, h: 20, kind: 'boxes' },
    { x: 1414, w: 16, h: 22, kind: 'planter' },
    { x: 1612, w: 28, h: 18, kind: 'cart' },
    { x: 1830, w: 24, h: 11, kind: 'beanbag' }
  ];
  // Mismatched buttons to blast. Standing shots fly at y 133; the high ones need a jump.
  // The label is what pops when one snaps into a token.
  var TARGETS = [
    { id: 'city-b1', x: 150, y: 119, w: 22, h: 12, label: 'TOKEN' },
    { id: 'city-b2', x: 300, y: 94, w: 24, h: 12, label: 'BLUE 500' },
    { id: 'city-b3', x: 344, y: 121, w: 20, h: 11, label: 'RADIUS 4' },
    { id: 'city-b4', x: 520, y: 119, w: 24, h: 12, label: 'V1.0' },
    { id: 'city-b5', x: 652, y: 92, w: 22, h: 12, label: 'A11Y' },
    { id: 'city-b6', x: 736, y: 120, w: 22, h: 11, label: '8PX' },
    { id: 'city-b7', x: 800, y: 96, w: 24, h: 12, label: 'ONE NAME' },
    { id: 'city-b8', x: 866, y: 119, w: 22, h: 12, label: 'TOKEN' },
    { id: 'city-b9', x: 1052, y: 90, w: 22, h: 11, label: 'ONE BLUE' },
    { id: 'city-b10', x: 1144, y: 84, w: 24, h: 12, label: 'REUSED' },
    { id: 'city-b11', x: 1266, y: 119, w: 22, h: 12, label: 'TOKEN' },
    { id: 'city-b12', x: 1366, y: 94, w: 24, h: 12, label: 'SAME NAME' },
    { id: 'city-b13', x: 1482, y: 121, w: 22, h: 11, label: 'DARK MODE' },
    { id: 'city-b14', x: 1676, y: 119, w: 22, h: 12, label: 'A11Y' },
    { id: 'city-b15', x: 1760, y: 96, w: 24, h: 12, label: 'V2.0' },
    { id: 'city-b16', x: 1866, y: 119, w: 22, h: 12, label: 'SHIPPED' }
  ].map(function (t) { t.kind = 'button'; t.hp = 1; return t; });
  // Office extras who loaf until Sam turns up, then flee screaming.
  var EXTRAS = [
    { id: 'city-gossip1', costume: 'pm', x: 386, facing: 1, loaf: 'gossip', held: 'coffee', line: 'NOT MY SPRINT!' },
    { id: 'city-gossip2', costume: 'worker2', x: 410, facing: -1, loaf: 'gossip', line: 'PER MY LAST EMAIL!' },
    { id: 'city-deckman', costume: 'pm', x: 780, facing: -1, loaf: 'idle', thrower: true, line: 'MORE DECKS!' },
    { id: 'city-intern', costume: 'worker3', x: 1186, facing: -1, loaf: 'idle', held: 'boxes', line: 'ELEVEN PICKERS!' },
    { id: 'city-cooler1', costume: 'pm', x: 1516, facing: 1, loaf: 'gossip', held: 'coffee', line: 'CIRCLE BACK!' },
    { id: 'city-cooler2', costume: 'worker1', x: 1556, facing: -1, loaf: 'gossip', held: 'coffee', line: 'TAKE IT OFFLINE!' },
    { id: 'city-vp', costume: 'pm', x: 1790, facing: -1, loaf: 'idle', thrower: true, line: 'ONE MORE DECK!' }
  ];

  function spawn(w, fromX, toX) {
    // (Targets outside this stretch are armored by C.play: they spark until their turn.)
    if (!MS.enemies) return [];
    return EXTRAS.filter(function (e) { return e.x > fromX + 60 && e.x < toX + 8; }).map(function (e) {
      return MS.enemies.make(e.id, { costume: MS.costumes && MS.costumes[e.costume] ? e.costume : 'pm', x: e.x, facing: e.facing, loaf: e.loaf, thrower: e.thrower, held: e.held, line: e.line });
    });
  }

  function onHit(w, t) {
    if (w.instant || !w.burst) return;
    var y = t.y != null ? t.y : G - t.h;
    w.burst(t.x + t.w / 2, y + t.h / 2, 8, { kind: 'confetti', colors: [BLUE, '#ffffff', BLUE_HI], speed: 60, g: 140, life: 0.7 });
  }

  // ------------------------------------------------------------ the 47 buttons
  var MESS = (function () {
    var rnd = MS.util.rng(47);
    var cols = ['#2f5be0', '#3a6ae8', '#2a4ad0', '#4a7af0', '#1e40c0', '#5a8aff', '#2f5bd0', '#3d55b8', '#4f86e8', '#2440a8', '#e04a4a', '#22a06a', '#8a4ae0', '#f0a020'];
    var out = [];
    for (var i = 0; i < 47; i++) {
      out.push({
        x: 4 + rnd() * (BOARD.w - 34), y: 13 + rnd() * (BOARD.h - 24),
        w: 12 + Math.floor(rnd() * 18), h: 5 + Math.floor(rnd() * 6),
        col: cols[Math.floor(rnd() * cols.length)], round: rnd() > 0.5, line: rnd() > 0.4, tilt: Math.floor(rnd() * 3) - 1
      });
    }
    return out;
  })();
  // The tidy end state: one component, four variants, six sizes.
  var KEEP = 20;
  function tidy(i) {
    var c = i % 4, row = Math.floor(i / 4) % 5;
    var cw = 28, ch = 8;
    return { x: 10 + c * (cw + 4), y: 13 + row * (ch + 1), w: cw, h: ch - 1, variant: c };
  }
  var VARIANT = [[BLUE, '#ffffff'], [BLUE_SH, '#ffffff'], ['#ffffff', BLUE], ['#dfe3ea', '#8b95a8']];

  function drawBoard(g, w, camX, t) {
    var bx = Math.round(BOARD.x - camX), by = BOARD.y;
    if (bx < -BOARD.w - 4 || bx > W + 4) return;
    // [the numbers climb]: the results slide in over the component set (no slide when reduced)
    var nk = w.state.numbers || 0;
    var slide = nk > 0 && !w.reduced ? Math.round((1 - MS.util.ease.out(Math.min(1, nk / RESULTS_IN))) * (BOARD.w - 2)) : 0;
    if (!nk || slide > 0) drawButtons(g, w, bx, by);
    if (nk > 0) {
      g.save();
      g.beginPath(); g.rect(bx + 1, by + 1, BOARD.w - 2, BOARD.h - 2); g.clip();
      drawResults(g, bx + slide, by, nk);
      if (slide > 0) r(g, bx + slide, by + 1, 1, BOARD.h - 2, '#c8ced8');
      g.restore();
    }
  }

  function drawButtons(g, w, bx, by) {
    var k = w.state.unified || 0;
    r(g, bx + 1, by + 1, BOARD.w - 2, BOARD.h - 2, k >= 1 ? '#f7f9ff' : '#fbfcff');
    F.draw(g, k >= 0.5 ? 'BUTTON  v1.0' : 'BUTTONS (ALL 47)', bx + 5, by + 3, k >= 0.5 ? BLUE : '#3a4152');
    if (k >= 0.5) F.draw(g, 'ONE SOURCE', bx + BOARD.w - 52, by + BOARD.h - 9, '#8b95a8');
    else F.draw(g, 'WHICH ONE?', bx + BOARD.w - 52, by + BOARD.h - 9, '#d0342c');
    MESS.forEach(function (m, i) {
      var tt = tidy(i);
      var e = MS.util.ease.inOut(Math.max(0, Math.min(1, k * 1.5 - (i % 7) * 0.07)));
      if (i >= KEEP && e >= 1) return;
      if (i >= KEEP) g.globalAlpha = 1 - e;
      var x = Math.round(bx + MS.util.lerp(m.x, tt.x, e)), y = Math.round(by + MS.util.lerp(m.y, tt.y, e) + m.tilt * (1 - e));
      var ww = Math.round(MS.util.lerp(m.w, tt.w, e)), hh = Math.round(MS.util.lerp(m.h, tt.h, e));
      var v = VARIANT[tt.variant];
      var fill = e > 0.5 && i < KEEP ? v[0] : m.col, ink = e > 0.5 && i < KEEP ? v[1] : '#ffffff';
      r(g, x, y, ww, hh, INK);
      r(g, x + 1, y + 1, ww - 2, hh - 2, fill);
      if (m.round && e < 0.5) { r(g, x, y, 1, 1, '#fbfcff'); r(g, x + ww - 1, y + hh - 1, 1, 1, '#fbfcff'); }
      if (m.line || e > 0.5) r(g, x + 4, y + Math.floor(hh / 2), Math.max(2, ww - 9), 1, ink);
      g.globalAlpha = 1;
    });
  }

  // ------------------------------------------------------------ [the numbers climb]
  // The board becomes a results dashboard: three rows of bars climbing, one row after
  // another, each ending in a green arrow. No real numbers. Drawn from w.state.numbers.
  // Everything stays above local y 47: two fixed tokens hang over the board's bottom corners.
  var NUMBERS_T = 2.0, RESULTS_IN = 0.1;
  var RESULTS = [
    { label: 'LEADS', bars: [2, 3, 3, 4, 6, 7, 8] },
    { label: 'DOWNLOADS', bars: [1, 2, 3, 4, 5, 7, 8] },
    { label: 'ENGAGEMENT', bars: [2, 2, 4, 5, 6, 7, 8] }
  ];
  var UP = '#1f8a4c';
  function resultRow(k, i) { return Math.max(0, Math.min(1, (k - 0.12 - i * 0.22) / 0.36)); }
  function upArrow(g, x, y) { // ▲ with a stem, cap height
    r(g, x + 2, y, 1, 1, UP); r(g, x + 1, y + 1, 3, 1, UP); r(g, x, y + 2, 5, 1, UP);
    r(g, x + 1, y + 3, 3, 4, UP);
  }
  function rowsDone(k) { var n = 0; RESULTS.forEach(function (row, i) { if (resultRow(k, i) >= 1) n++; }); return n; }
  function drawResults(g, bx, by, k) {
    r(g, bx + 1, by + 1, BOARD.w - 2, BOARD.h - 2, '#f7f9ff');
    F.draw(g, 'RESULTS', bx + 5, by + 3, BLUE);
    F.draw(g, 'SINCE v1.0', bx + BOARD.w - 5 - F.measure('SINCE v1.0'), by + 3, '#8b95a8');
    RESULTS.forEach(function (row, i) {
      var ry = by + 14 + i * 11, e = resultRow(k, i);
      if (i) r(g, bx + 4, ry - 1, BOARD.w - 8, 1, '#e4e8f0');
      var lw = F.draw(g, row.label, bx + 5, ry + 1, '#3a4152');
      if (e >= 1) upArrow(g, bx + 9 + lw, ry + 1);
      r(g, bx + 77, ry + 10, 57, 1, '#c8ced8');
      row.bars.forEach(function (h, j) {
        var ej = MS.util.ease.out(Math.max(0, Math.min(1, e * 1.7 - j * 0.11)));
        var hh = Math.max(1, Math.round(h * ej));
        r(g, bx + 78 + j * 8, ry + 10 - hh, 6, hh, j === row.bars.length - 1 ? BLUE_HI : BLUE);
      });
    });
  }

  // ------------------------------------------------------------ [sirens]
  // Red and blue light from the street below washes up the big window in a slow pulse
  // (0.5 Hz, red falling as blue rises, steady under reduced motion), and the news ticker
  // hanging in front of the window lights up and crawls (still, centered, when reduced).
  var SIREN_T = 2.0;
  var SIGN = { x: 1812, y: 36, w: 344, h: 13 };
  var TICK_V = 32, TICK_GAP = 60;
  var AMBER = '#ffb02e', ALERT = '#ff5a4a', RED_LIGHT = '255,36,36', BLUE_LIGHT = '36,92,255';
  var TICKER = [['NEW:', ALERT], ['EUROPEAN ACCESSIBILITY ACT', AMBER], '.', ['ADA', AMBER], '.', ['WCAG 2.2', AMBER]];
  // Draws the ticker line with its left edge at x (or only measures it when g is null).
  function tickerLine(g, x, y) {
    var cx = x;
    TICKER.forEach(function (part, i) {
      if (i) cx += 5;
      if (part === '.') { if (g) r(g, cx, y + 3, 2, 2, AMBER); cx += 2; return; }
      cx += g ? F.draw(g, part[0], cx, y, part[1], { shadow: '#5a2a10' }) : F.measure(part[0]);
    });
    return cx - x;
  }
  var TICKER_W = 0;
  function sirenPulse(w) { return w.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(w.time * Math.PI); }

  function drawSirenGlow(g, w, camX) {
    var k = w.state.sirens || 0;
    if (!k) return;
    var wx = BIG_WINDOW - camX, x0 = Math.max(0, wx);
    if (x0 >= W) return;
    var a = Math.min(1, k / 0.4) * 0.8, p = sirenPulse(w);
    g.save();
    g.beginPath(); g.rect(x0, 18, W - x0, LIP - 24); g.clip();
    glowEllipse(g, wx + 96, LIP + 12, 150, 92, RED_LIGHT, a * (0.3 + 0.7 * p));
    glowEllipse(g, wx + 300, LIP + 12, 150, 92, BLUE_LIGHT, a * (0.3 + 0.7 * (1 - p)));
    g.restore();
  }
  // A soft elliptical glow of rgb at alpha a (fading to the same color, not to black).
  function glowEllipse(g, cx, cy, rx, ry, rgb, a) {
    g.save(); g.translate(cx, cy); g.scale(rx / ry, 1);
    P.radial(g, 0, 0, ry, 'rgba(' + rgb + ',' + a.toFixed(3) + ')', 'rgba(' + rgb + ',0)');
    g.restore();
  }
  // The same light, caught on the ceiling and the floor just inside the glass.
  function drawSirenWash(g, w, camX) {
    var k = w.state.sirens || 0;
    if (!k) return;
    var wx = BIG_WINDOW - camX, x0 = Math.max(0, wx);
    if (x0 >= W) return;
    var a = Math.min(1, k / 0.4) * 0.3, p = sirenPulse(w);
    g.save();
    g.beginPath(); g.rect(x0, 0, W - x0, 17); g.rect(x0, LIP + 1, W - x0, 14); g.clip();
    glowEllipse(g, wx + 96, 8, 120, 40, RED_LIGHT, a * (0.3 + 0.7 * p));
    glowEllipse(g, wx + 300, 8, 120, 40, BLUE_LIGHT, a * (0.3 + 0.7 * (1 - p)));
    glowEllipse(g, wx + 96, LIP + 1, 120, 24, RED_LIGHT, a * (0.3 + 0.7 * p));
    glowEllipse(g, wx + 300, LIP + 1, 120, 24, BLUE_LIGHT, a * (0.3 + 0.7 * (1 - p)));
    g.restore();
  }

  function signImg() {
    return once('ticker', function () {
      var c = canvas(SIGN.w, SIGN.h), g = c.getContext('2d');
      r(g, 0, 0, SIGN.w, SIGN.h, INK);
      r(g, 1, 1, SIGN.w - 2, SIGN.h - 2, '#141820');
      r(g, 1, 1, SIGN.w - 2, 1, '#2a2f3c');
      g.fillStyle = '#1e2432';
      for (var y = 3; y < SIGN.h - 2; y += 2) for (var x = 3; x < SIGN.w - 2; x += 2) g.fillRect(x, y, 1, 1);
      return c;
    });
  }
  function drawTicker(g, w, camX) {
    var sx = Math.round(SIGN.x - camX), y = SIGN.y;
    if (sx > W || sx + SIGN.w < 0) return;
    r(g, sx + 12, 17, 1, y - 17, '#8b95a8'); r(g, sx + SIGN.w - 13, 17, 1, y - 17, '#8b95a8');
    g.drawImage(signImg(), sx, y);
    var k = w.state.sirens || 0;
    if (k < 0.1) return;
    if (!TICKER_W) TICKER_W = tickerLine(null, 0, 0);
    var left = sx + 2, right = sx + SIGN.w - 2;
    g.save();
    g.beginPath(); g.rect(left, y + 2, right - left, SIGN.h - 4); g.clip();
    if (w.reduced) tickerLine(g, sx + Math.round((SIGN.w - TICKER_W) / 2), y + 3);
    else {
      var fx = w.cityFx || (w.cityFx = {});
      if (fx.sirenAt == null) fx.sirenAt = w.time - (SIGN.w - 30) / TICK_V; // landed here by a rewind: already mid-crawl
      var s = Math.max(0, (w.time - fx.sirenAt) * TICK_V), period = TICKER_W + TICK_GAP;
      for (var j = Math.max(0, Math.floor((s - (right - left) - TICKER_W) / period)); j <= Math.floor(s / period); j++) {
        var x = Math.round(right - s + j * period);
        if (x < right && x + TICKER_W > left) tickerLine(g, x, y + 3);
      }
    }
    g.restore();
  }

  // ------------------------------------------------------------ the skyline
  // Before: every tower picked its own blue. After [city builds]: new towers, one block type.
  function tower(g, rnd, x, base, w, h, style) {
    var blues = ['#8fb0dc', '#9cb8e0', '#86a6d4', '#a4bee4', '#93aed8', '#b2c4dc', '#a8b4c8'];
    var col = blues[Math.floor(rnd() * blues.length)];
    var top = base - h;
    r(g, x, top, w, h, col);
    r(g, x, top, 2, h, C.shade(col, 0.25));
    r(g, x + w - 2, top, 2, h, C.shade(col, -0.12));
    var win = C.shade(col, 0.4);
    if (style === 0) for (var y = top + 4; y < base; y += 5) r(g, x + 3, y, w - 6, 2, win);
    else if (style === 1) for (var yy = top + 4; yy < base; yy += 6) for (var xx = x + 3; xx < x + w - 3; xx += 4) r(g, xx, yy, 2, 3, win);
    else for (var xs = x + 3; xs < x + w - 3; xs += 3) r(g, xs, top + 3, 1, h - 3, win);
    if (rnd() > 0.5) { r(g, x + w / 2 - 1, top - 10 - rnd() * 10, 1, 20, col); }
    if (rnd() > 0.6) { r(g, x - 2, top, w + 4, 3, C.shade(col, -0.08)); }
  }

  // The new towers stand across the street (street-layer depth), in front of the old low-rises.
  var BUILT = [12, 15, 10, 16, 13, 15, 11, 14, 16, 12, 15, 13, 14];
  var BLOCK = 7, BUILT_W = 34, BUILT_BASE = 130;
  function builtX(i) { return 24 + i * 88; }
  var BUILT_COL = C.mix('#3f6fd8', '#cbdbfc', 0.12), BUILT_SH = C.mix('#2a4fb0', '#cbdbfc', 0.12), BUILT_WIN = '#eaf3ff', BUILT_HI = C.mix('#8fb2ff', '#cbdbfc', 0.1);

  function drawBuilt(g, w, camX, t) {
    var k = w.state.built || 0;
    var off = Math.round(camX * STREET_SPEED);
    BUILT.forEach(function (n, i) {
      var x = builtX(i) - off;
      if (x < -50 || x > W + 10) return;
      var base = BUILT_BASE;
      if (k < 1) {
        // a tower crane waiting on every other lot
        if (i % 2 === 0) {
          var cy = base - n * BLOCK - 14;
          var crane = C.mix('#e0a040', '#cbdbfc', 0.2);
          r(g, x + 12, cy, 2, base - cy, crane);
          for (var j = cy + 3; j < base; j += 4) r(g, x + 11, j, 4, 1, crane);
          r(g, x - 6, cy, 40, 2, crane); r(g, x + 6, cy - 6, 2, 6, crane);
          r(g, x + 24, cy + 2, 1, 10 + Math.round(Math.sin(t + i) * 2), C.mix('#5a6478', '#cbdbfc', 0.4));
        }
      }
      if (!k) return;
      var e = Math.max(0, Math.min(1, (k - i * 0.035) / 0.55));
      var rows = e * n, full = Math.floor(rows), frac = rows - full;
      for (var b = 0; b < full; b++) block(g, x, base - (b + 1) * BLOCK);
      if (full < n && frac > 0) {
        var drop = Math.round((1 - MS.util.ease.in(frac)) * 46);
        block(g, x, base - (full + 1) * BLOCK - drop);
      }
      if (full >= n) {
        var topY = base - n * BLOCK;
        r(g, x - 1, topY - 3, BUILT_W + 2, 3, BUILT_HI);
        r(g, x + BUILT_W / 2, topY - 9, 1, 6, BUILT_HI);
      }
    });
  }
  function block(g, x, y) {
    r(g, x, y, BUILT_W, BLOCK, BUILT_COL);
    r(g, x, y, BUILT_W, 1, BUILT_HI);
    r(g, x, y, 2, BLOCK, BUILT_HI); r(g, x + BUILT_W - 3, y, 3, BLOCK, BUILT_SH);
    for (var wx = x + 4; wx < x + BUILT_W - 4; wx += 5) r(g, wx, y + 2, 3, 3, BUILT_WIN);
  }

  // ------------------------------------------------------------ layers
  function cloud(g, cx, cy, s, col, shade) {
    [[0, 0, 7], [8, -3, 9], [17, 0, 7], [-7, 2, 5], [24, 2, 5]].forEach(function (b) {
      var rr = b[2] * s;
      for (var yy = -rr; yy <= rr * 0.55; yy++) {
        var ww = Math.round(Math.sqrt(rr * rr - yy * yy) * 2);
        r(g, cx + b[0] * s - ww / 2, cy + b[1] * s + yy, ww, 1, yy > rr * 0.15 ? shade : col);
      }
    });
  }

  function glassWall(g, x0, x1, top, bottom, step, rnd, open) {
    g.fillStyle = 'rgba(214,232,255,0.16)';
    g.fillRect(x0, top, x1 - x0, bottom - top);
    // reflections: soft diagonal streaks
    for (var x = x0 + 10; x < x1; x += step) {
      if (rnd() < 0.55) {
        var sw = 6 + Math.floor(rnd() * 10);
        for (var y = top; y < bottom; y++) {
          var sx = x + (bottom - y) * 0.45;
          if (sx > x + step - 8 || sx < x) continue;
          g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(Math.round(sx), y, sw, 1);
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(Math.round(sx) + sw + 3, y, 2, 1);
        }
      }
    }
    for (var m = x0; m <= x1; m += step) {
      r(g, m - 2, top, 5, bottom - top, MUL);
      r(g, m - 2, top, 1, bottom - top, MUL_HI);
      r(g, m + 2, top, 1, bottom - top, MUL_SH);
    }
    if (!open) { r(g, x0, top + 46, x1 - x0, 2, MUL); r(g, x0, top + 46, x1 - x0, 1, MUL_HI); }
  }

  function credenza(g, x0, x1) {
    r(g, x0, 120, x1 - x0, 21, CRED);
    r(g, x0, 120, x1 - x0, 2, CRED_HI);
    r(g, x0, 122, x1 - x0, 1, CRED_SH);
    for (var x = x0 + 18; x < x1 - 4; x += 18) { r(g, x, 124, 1, 16, CRED_SH); r(g, x - 4, 130, 2, 2, MUL); }
  }

  function poster(g, x, y, w, h, col, title, sub) {
    r(g, x - 1, y - 1, w + 2, h + 2, '#a8b0c0');
    r(g, x, y, w, h, '#fbfcff');
    r(g, x + 3, y + 3, w - 6, h - 16, col);
    F.drawCentered(g, title, x + w / 2, y + h - 11, '#3a4152');
    if (sub) fakeText(g, x + 4, y + h - 3, w - 8, '#c0c6d2');
  }

  function floorBand(g, x0, x1, kind, rnd) {
    var hgt = H - LIP;
    if (kind === 'stone') {
      P.vgrad(g, x0, LIP, x1 - x0, hgt, [[0, '#e6e2da'], [0.25, '#d6d1c8'], [1, '#b8b2a8']]);
      for (var i = 0; i < (x1 - x0) / 7; i++) {
        var vx = x0 + rnd() * (x1 - x0), vy = LIP + 4 + rnd() * (hgt - 6);
        r(g, vx, vy, 4 + rnd() * 10, 1, rnd() > 0.5 ? '#c8c2b8' : '#efece6');
      }
      for (var sx = x0; sx < x1; sx += 48) r(g, sx, LIP + 1, 1, hgt, 'rgba(150,140,130,0.35)');
      for (var ry = LIP + 18; ry < H; ry += 24) r(g, x0, ry, x1 - x0, 1, 'rgba(150,140,130,0.35)');
    } else if (kind === 'wood' || kind === 'deck') {
      var a = kind === 'wood' ? ['#d6b88c', '#c6a476', '#a98a60'] : ['#dcc39c', '#cdb084', '#b49470'];
      P.vgrad(g, x0, LIP, x1 - x0, hgt, [[0, a[0]], [0.3, a[1]], [1, a[2]]]);
      for (var y = LIP + 6, n = 0; y < H; y += 7 + Math.floor(n / 3), n++) {
        r(g, x0, y, x1 - x0, 1, 'rgba(120,88,52,0.32)');
        for (var j = x0 + ((n * 37) % 60); j < x1; j += 60 + (n % 3) * 12) r(g, j, y - 6 - Math.floor(n / 3), 1, 6 + Math.floor(n / 3), 'rgba(120,88,52,0.28)');
      }
      for (var h2 = 0; h2 < (x1 - x0) / 9; h2++) r(g, x0 + rnd() * (x1 - x0), LIP + 3 + rnd() * 50, 6 + rnd() * 14, 1, 'rgba(255,240,210,0.35)');
    } else if (kind === 'tile') {
      for (var ty = LIP + 1, tr = 0; ty < H; ty += 6 + tr, tr++) {
        for (var tx = x0, tc = 0; tx < x1; tx += 10 + tr, tc++) {
          r(g, tx, ty, 10 + tr, 6 + tr, (tc + tr) % 2 ? '#e6e9ef' : '#d3d8e2');
        }
      }
      for (var gy = LIP + 1; gy < H; gy += 3) r(g, x0, gy, x1 - x0, 1, 'rgba(255,255,255,' + (0.12 - (gy - LIP) / 900) + ')');
      r(g, x0, LIP + 1, x1 - x0, 1, 'rgba(255,255,255,0.5)');
    }
  }

  function paintInterior(g, w, h) {
    var rnd = MS.util.rng(31);
    // ceiling, with recessed light panels and a soffit shadow
    r(g, 0, 0, w, 16, CEIL);
    for (var lx = 20; lx < w; lx += 64) { r(g, lx, 10, 30, 3, '#ffffff'); r(g, lx, 13, 30, 1, CEIL2); r(g, lx + 40, 6, 2, 2, '#c8ced8'); }
    r(g, 0, 16, w, 1, CEIL2); r(g, 0, 17, w, 1, '#c6ccd8');

    // a low wall under the glass, everywhere but the big window
    r(g, 0, 118, BIG_WINDOW, LIP - 118, '#e4e7ee'); r(g, 0, 118, BIG_WINDOW, 2, '#f5f7fa'); r(g, 0, 120, BIG_WINDOW, 1, CRED_SH);
    // glass from wall to wall, broken by a few solid wall panels
    var walls = [[236, 330], [1440, 1662]];
    var spans = [], from = 58;
    walls.forEach(function (wl) { spans.push([from, wl[0]]); from = wl[1]; });
    spans.push([from, BIG_WINDOW]);
    spans.forEach(function (s) { glassWall(g, s[0], s[1], 18, 118, 64, rnd); });
    glassWall(g, BIG_WINDOW, w + 64, 18, LIP - 6, 128, rnd, true);
    walls.forEach(function (wl) {
      r(g, wl[0], 18, wl[1] - wl[0], LIP - 18, '#e7e9ee');
      r(g, wl[0], 18, 3, LIP - 18, '#f6f7fa'); r(g, wl[1] - 3, 18, 3, LIP - 18, '#cfd4de');
    });

    // the lobby: revolving door, reception, the "today's blue" totem, elevators
    r(g, 0, 26, 60, 8, '#5f687a'); r(g, 0, 26, 60, 1, '#8b95a8');
    F.drawCentered(g, 'IN', 29, 27, '#e8ecf4');
    r(g, 0, 34, 4, LIP - 34, '#6c7588'); r(g, 56, 34, 4, LIP - 34, '#6c7588');
    g.fillStyle = 'rgba(214,232,255,0.28)'; g.fillRect(4, 34, 52, LIP - 34);
    r(g, 28, 34, 2, LIP - 34, '#8b95a8');
    for (var dy = 40; dy < LIP; dy += 3) { r(g, 10 + (dy % 9), dy, 1, 1, 'rgba(255,255,255,0.4)'); }
    r(g, 12, 60, 10, 70, 'rgba(255,255,255,0.18)'); r(g, 34, 60, 10, 70, 'rgba(160,190,230,0.22)');
    // reception desk
    r(g, 92, 112, 104, 34, '#eceef2'); r(g, 92, 112, 104, 3, '#c89a6a'); r(g, 92, 115, 104, 1, '#a87e54');
    r(g, 92, 116, 104, 2, '#d8dce4');
    [[100, '#2f5be0'], [110, '#3a6ae8'], [120, '#2a4ad0']].forEach(function (b) { r(g, b[0], 121, 8, 8, b[1]); });
    F.draw(g, 'BLUE CO.', 98, 132, '#3a4152');
    fakeText(g, 136, 124, 50, '#c0c6d2'); fakeText(g, 146, 130, 40, '#c0c6d2');
    r(g, 104, 100, 14, 10, '#3a4152'); r(g, 105, 101, 12, 7, '#9ad4ff'); r(g, 110, 110, 2, 2, '#3a4152');
    r(g, 170, 104, 6, 8, '#ffffff'); r(g, 171, 102, 4, 2, '#d0342c');
    // totem screen
    r(g, 206, 64, 24, 82, '#4a5264'); r(g, 208, 66, 20, 56, '#1e2a4a');
    F.drawCentered(g, 'TODAY', 218, 68, '#ffffff'); F.drawCentered(g, 'BLUE:', 218, 78, '#9ad4ff');
    r(g, 211, 90, 14, 10, '#3a6ae8'); F.drawCentered(g, '#38', 218, 104, '#ffd36a');
    r(g, 214, 122, 8, 24, '#5f687a');
    // elevators
    [248, 290].forEach(function (ex) {
      r(g, ex, 50, 34, LIP - 50, '#c3c9d4'); r(g, ex + 2, 52, 30, LIP - 52, '#b4bccb');
      r(g, ex + 16, 52, 2, LIP - 52, '#8b95a8'); r(g, ex + 3, 54, 2, 80, 'rgba(255,255,255,0.35)');
      r(g, ex + 8, 38, 18, 9, '#2a2e3a'); F.drawCentered(g, '47', ex + 17, 39, '#ff8a4a');
    });
    r(g, 285, 96, 3, 8, '#8b95a8'); r(g, 286, 98, 1, 1, '#ffffff'); r(g, 286, 101, 1, 1, '#ffffff');

    // the print corner: a pinboard of all the dropdowns we built
    credenza(g, 330, 520);
    r(g, 352, 42, 84, 58, '#c8a070'); r(g, 354, 44, 80, 54, '#e2c49a');
    F.drawCentered(g, 'DROPDOWNS', 394, 46, '#5a3a24');
    for (var dd = 0; dd < 6; dd++) {
      var px = 358 + (dd % 3) * 26, py = 58 + Math.floor(dd / 3) * 20;
      r(g, px, py, 22, 7, '#ffffff'); r(g, px + 16, py + 2, 4, 3, ['#2f5be0', '#e04a4a', '#22a06a', '#3a6ae8', '#8a4ae0', '#2a4ad0'][dd]);
      r(g, px, py + 7, 22, 6 - (dd % 3), '#f0f2f6');
      r(g, px + 10, py - 1, 2, 2, '#d0342c');
    }
    r(g, 360, 100, 2, 20, '#8b6a44'); r(g, 426, 100, 2, 20, '#8b6a44');
    r(g, 468, 100, 34, 18, '#ffffff'); F.draw(g, 'v38!', 472, 104, '#d0342c'); r(g, 467, 99, 36, 1, '#c8ced8');

    // the lounge
    credenza(g, 540, 690);
    r(g, 560, 34, 96, 26, '#2a2e3a');
    F.drawCentered(g, 'REINVENT', 608, 38, '#ff8ab8'); F.drawCentered(g, 'THE WHEEL', 608, 48, '#7ff4ff');
    r(g, 584, 60, 1, 6, '#5f687a'); r(g, 632, 60, 1, 6, '#5f687a');

    // the meeting room: a glass box where the sync about the sync has run since Tuesday
    r(g, 700, 24, 180, 3, '#8b95a8'); r(g, 700, 24, 3, LIP - 24, '#8b95a8'); r(g, 877, 24, 3, LIP - 24, '#8b95a8');
    g.fillStyle = 'rgba(200,220,245,0.22)'; g.fillRect(703, 27, 174, LIP - 27);
    r(g, 724, 40, 70, 42, '#2a2e3a'); r(g, 726, 42, 66, 38, '#e8eefc');
    F.drawCentered(g, 'SYNC ABOUT', 759, 46, '#3a4152'); F.drawCentered(g, 'THE SYNC #11', 759, 56, BLUE);
    r(g, 732, 68, 50, 2, '#c0c6d2'); r(g, 732, 72, 34, 2, '#c0c6d2');
    r(g, 806, 46, 54, 10, '#ffffff'); F.draw(g, 'BLUE 7', 812, 47, '#5f687a');
    r(g, 806, 60, 18, 14, '#ffd36a'); r(g, 828, 62, 18, 14, '#ff8ab8'); r(g, 812, 78, 18, 14, '#9ad4ff');
    r(g, 716, 108, 150, 4, '#c89a6a'); r(g, 716, 112, 150, 1, '#a87e54'); r(g, 730, 113, 3, 33, '#8b95a8'); r(g, 850, 113, 3, 33, '#8b95a8');
    [740, 768, 796, 824].forEach(function (cx2) { r(g, cx2, 98, 10, 10, '#3a4152'); r(g, cx2, 98, 10, 1, '#5f687a'); });
    r(g, 752, 104, 6, 4, '#ffffff'); r(g, 806, 103, 8, 5, '#9ad4ff');
    for (var gl = 0; gl < 4; gl++) r(g, 710 + gl * 44, 30, 2, 60, 'rgba(255,255,255,0.3)');

    g.save(); g.translate(200, 0);
    // the desks: the wall of 47 buttons and the trophy shelf
    r(g, BOARD.x - 200 - 4, BOARD.y - 4, BOARD.w + 8, BOARD.h + 8, '#5f687a');
    r(g, BOARD.x - 200 - 3, BOARD.y - 3, BOARD.w + 6, 1, '#8b95a8');
    r(g, BOARD.x - 200 - 2, BOARD.y + BOARD.h + 4, BOARD.w + 4, 2, '#c8ced8');
    credenza(g, 690, 1052);
    for (var tr = 0; tr < 11; tr++) {
      var tx = 702 + tr * 9;
      r(g, tx, 112, 5, 5, '#ffc83a'); r(g, tx + 1, 112, 1, 4, '#fff2a0'); r(g, tx + 2, 117, 1, 2, '#c8901a'); r(g, tx, 119, 5, 1, '#c8901a');
    }
    r(g, 700, 106, 101, 4, '#ffffff'); F.draw(g, 'DATE PICKERS: 11', 703, 101, '#3a4152');

    // the hall of brand blues: roll-up banners, one per 'final' blue
    credenza(g, 1060, 1236);
    ['#3a6ae8', '#2f5be0', '#2a4ad0', '#4a7af0'].forEach(function (c, i) {
      var bx = 1066 + i * 40;
      r(g, bx + 1, LIP - 4, 22, 4, '#8b95a8'); r(g, bx + 11, 64, 2, 80, '#8b95a8');
      r(g, bx, 66, 24, 58, '#fbfcff'); r(g, bx, 66, 24, 2, '#c8ced8');
      r(g, bx + 3, 70, 18, 30, c); r(g, bx + 5, 72, 6, 2, 'rgba(255,255,255,0.5)');
      F.drawCentered(g, i === 3 ? 'FINAL' : 'v' + (12 + i), bx + 12, 104, '#3a4152');
      fakeText(g, bx + 4, 116, 16, '#c0c6d2');
    });
    r(g, 1092, 54, 60, 12, '#ffd36a'); r(g, 1092, 66, 60, 1, '#c8a040'); F.drawCentered(g, 'WHICH ONE?', 1122, 56, '#3a2a10');
    // the clock: which Friday?
    for (var cy = -9; cy <= 9; cy++) { var cw = Math.round(Math.sqrt(81 - cy * cy) * 2); r(g, 1224 - cw / 2, 52 + cy, cw, 1, cy < -7 || cy > 7 ? '#5f687a' : '#ffffff'); }
    r(g, 1224, 45, 1, 7, '#2a2e3a'); r(g, 1224, 52, 5, 1, '#2a2e3a');
    F.drawCentered(g, 'FRIDAY?', 1224, 64, '#d0342c');

    // the kitchen
    r(g, 1240, 22, 222, 28, '#f6f7fa');
    for (var cx = 1244; cx < 1458; cx += 30) { r(g, cx, 24, 28, 24, '#ffffff'); r(g, cx, 47, 28, 1, CRED_SH); r(g, cx + 24, 34, 2, 6, MUL); }
    for (var by = 52; by < 118; by += 6) for (var bx2 = 1240 + ((by / 6) % 2) * 6; bx2 < 1430; bx2 += 12) r(g, bx2, by, 11, 5, '#e2e8ef');
    // a shelf of 47 blue mugs
    r(g, 1250, 66, 160, 2, '#c3c9d4');
    var mugs = ['#2f5be0', '#3a6ae8', '#2a4ad0', '#4a7af0', '#1e40c0', '#5a8aff', '#3d55b8', '#4f86e8'];
    for (var mg = 0; mg < 23; mg++) { var mx = 1252 + mg * 7; r(g, mx, 60, 5, 6, mugs[(mg * 5) % mugs.length]); r(g, mx + 5, 61, 1, 3, mugs[(mg * 5) % mugs.length]); }
    F.draw(g, 'LABEL YOUR BLUE', 1264, 72, '#5f687a');
    // counter, sink, coffee machine, microwave
    r(g, 1240, 116, 190, 30, '#dfe3ea'); r(g, 1240, 114, 190, 3, '#9aa2b2'); r(g, 1240, 117, 190, 1, '#f5f7fa');
    for (var dx2 = 1256; dx2 < 1430; dx2 += 24) { r(g, dx2, 120, 1, 26, CRED_SH); r(g, dx2 - 6, 126, 3, 2, MUL); }
    r(g, 1252, 106, 18, 8, '#c3c9d4'); r(g, 1259, 98, 2, 8, '#8b95a8'); r(g, 1259, 98, 6, 2, '#8b95a8');
    r(g, 1380, 88, 22, 26, '#3a4152'); r(g, 1382, 90, 18, 8, '#5f687a'); r(g, 1388, 102, 6, 8, '#ffffff'); r(g, 1384, 92, 3, 2, '#7fff9a');
    r(g, 1294, 98, 28, 16, '#eceef2'); r(g, 1296, 100, 18, 12, '#2a2e3a'); r(g, 1316, 101, 4, 2, '#7fff9a');
    // water cooler
    r(g, 1340, 92, 16, 54, '#e8ecf4'); r(g, 1340, 92, 16, 2, '#ffffff'); r(g, 1343, 104, 10, 3, '#5f687a');
    r(g, 1342, 74, 12, 18, '#9ad4ff'); r(g, 1342, 74, 12, 2, '#cfeaff'); r(g, 1344, 78, 2, 12, 'rgba(255,255,255,0.6)');
    r(g, 1346, 70, 4, 4, '#4a7af0');
    // fridge
    r(g, 1430, 56, 30, 90, '#f2f4f8'); r(g, 1430, 56, 2, 90, '#ffffff'); r(g, 1430, 92, 30, 1, CRED_SH);
    r(g, 1434, 66, 2, 20, MUL); r(g, 1434, 98, 2, 20, MUL);
    r(g, 1442, 64, 12, 10, '#ffd36a'); r(g, 1446, 100, 10, 12, '#9ad4ff'); r(g, 1440, 78, 9, 8, '#ff8ab8');

    g.restore();

    // the standup corner: a fifteen-minute standup, live, and the button museum
    r(g, 1676, 92, 52, 54, '#c3c9d4'); r(g, 1678, 94, 48, 50, '#e4e7ee');
    g.fillStyle = 'rgba(214,232,255,0.35)'; g.fillRect(1680, 56, 44, 36);
    r(g, 1678, 54, 48, 2, '#8b95a8'); r(g, 1678, 54, 2, 38, '#8b95a8'); r(g, 1724, 54, 2, 38, '#8b95a8');
    r(g, 1684, 80, 12, 6, '#c8ccd4'); r(g, 1684, 80, 12, 1, '#ffffff'); r(g, 1686, 82, 8, 2, '#8b95a8');
    r(g, 1700, 76, 10, 9, '#3a8ae8'); r(g, 1700, 76, 10, 3, '#9ac8ff');
    r(g, 1713, 78, 9, 7, '#2f5be0');
    r(g, 1688, 60, 2, 12, 'rgba(255,255,255,0.6)');
    F.drawCentered(g, 'MUSEUM', 1702, 100, '#5f687a'); fakeText(g, 1684, 112, 36, '#a8b0c0');
    r(g, 1742, 46, 44, 26, '#2a2e3a'); r(g, 1744, 48, 40, 22, '#141820');
    F.drawCentered(g, 'STANDUP', 1764, 50, '#ffd36a'); F.drawCentered(g, '0:47:12', 1764, 60, '#ff5a4a');
    r(g, 1762, 72, 3, 74, '#5f687a'); r(g, 1754, LIP - 3, 19, 3, '#5f687a');

    // the big window: wall-to-wall glass, a handrail, a bench and a tree in a tub
    r(g, BIG_WINDOW, LIP - 26, w - BIG_WINDOW, 2, '#c3c9d4'); r(g, BIG_WINDOW, LIP - 26, w - BIG_WINDOW, 1, '#ffffff');
    for (var px2 = BIG_WINDOW + 8; px2 < w; px2 += 24) r(g, px2, LIP - 24, 1, 18, '#c3c9d4');
    r(g, 1880, 128, 64, 4, '#c89a6a'); r(g, 1880, 132, 64, 1, '#a87e54'); r(g, 1884, 133, 3, 13, '#5f687a'); r(g, 1937, 133, 3, 13, '#5f687a');
    for (var lf = 0; lf < 40; lf++) {
      var ang = lf * 2.4, rad = 6 + (lf % 7) * 2.6;
      r(g, 2140 + Math.cos(ang) * rad * 1.2, 70 + Math.sin(ang) * rad, 5, 4, lf % 3 ? '#4aa86a' : '#2f8a52');
    }
    r(g, 2139, 82, 3, 48, '#8a6a44'); r(g, 2128, 126, 26, 20, '#f2f4f8'); r(g, 2128, 126, 26, 2, '#ffffff'); r(g, 2128, 142, 26, 4, '#c8ced8');

    // baseboard, the dark lip and the floors
    r(g, 0, LIP - 5, w, 5, '#cfd4de'); r(g, 0, LIP - 5, w, 1, '#eef1f6');
    floorBand(g, 0, 336, 'stone', rnd);
    floorBand(g, 336, 1440, 'wood', rnd);
    floorBand(g, 1440, 1662, 'tile', rnd);
    floorBand(g, 1662, w, 'deck', rnd);
    r(g, 0, LIP, w, 1, '#323848');
    r(g, 0, LIP + 1, w, 1, 'rgba(255,255,255,0.35)');
    // floor gags: the caution sign's shadow, cable covers, a lobby rug
    r(g, 70, LIP + 22, 150, 2, '#c8302a'); r(g, 70, LIP + 24, 150, 18, '#a82a3a'); r(g, 74, LIP + 27, 142, 12, '#c8443a');
    for (var cv = 0; cv < 4; cv++) r(g, 520 + cv * 260, LIP + 38, 30, 3, 'rgba(60,64,80,0.35)');
  }

  var layers = [
    { speed: SKY_SPEED, haze: 0.08, paint: function (g, w, h) {
      var rnd = MS.util.rng(3);
      P.vgrad(g, 0, 0, w, h, [[0, '#4f9ae8'], [0.45, '#8cc4f4'], [0.7, '#cfe6fb'], [1, '#eef6ff']]);
      P.radial(g, w * 0.72, 34, 90, 'rgba(255,255,236,0.75)');
      for (var c = 0; c < 6; c++) cloud(g, rnd() * w, 26 + rnd() * 40, 0.7 + rnd() * 0.6, '#ffffff', '#dceafa');
      for (var t = 0; t < w; t++) if (t > w * 0.1 && t < w * 0.45) r(g, t, 24 - t * 0.03, 1, 1, 'rgba(255,255,255,0.6)');
    } },
    { speed: CITY_SPEED, haze: 0.42, paint: function (g, w, h) {
      var rnd = MS.util.rng(11);
      for (var x = -10; x < w; x += 14 + Math.floor(rnd() * 16)) tower(g, rnd, x, 132, 16 + Math.floor(rnd() * 22), 30 + rnd() * 70, Math.floor(rnd() * 3));
      r(g, 0, 128, w, h - 128, '#a8b8cc');
    } },
    { speed: STREET_SPEED, haze: 0.22, paint: function (g, w, h) {
      var rnd = MS.util.rng(19);
      var x = 0;
      while (x < w) {
        var bw = 40 + Math.floor(rnd() * 50), bh = 18 + rnd() * 26;
        var top = 128 - bh;
        var col = ['#c49a86', '#b4a8a0', '#a8b0bc', '#c8b49a', '#9aa6b8'][Math.floor(rnd() * 5)];
        r(g, x, top, bw, h - top, col);
        r(g, x, top, bw, 2, C.shade(col, 0.3)); r(g, x, top + 2, bw, 1, C.shade(col, -0.15));
        for (var wy = top + 7; wy < 150; wy += 9) for (var wx = x + 5; wx < x + bw - 6; wx += 9) {
          r(g, wx, wy, 5, 5, C.shade(col, -0.25)); r(g, wx, wy, 5, 1, C.shade(col, 0.35));
        }
        if (rnd() > 0.5) { // water tank
          var tx = x + 8 + rnd() * (bw - 24);
          r(g, tx, top - 14, 12, 10, '#9a7a5a'); r(g, tx - 1, top - 16, 14, 2, '#7a5a3a'); r(g, tx + 1, top - 4, 1, 4, '#5a4a3a'); r(g, tx + 10, top - 4, 1, 4, '#5a4a3a');
        } else if (rnd() > 0.4) { // billboard
          var bx = x + 6;
          r(g, bx + 4, top - 6, 2, 6, '#5a5e66'); r(g, bx + 30, top - 6, 2, 6, '#5a5e66');
          r(g, bx, top - 26, 38, 20, '#ffffff'); r(g, bx + 2, top - 24, 34, 16, ['#3a6ae8', '#2f5be0', '#4a7af0'][Math.floor(rnd() * 3)]);
          r(g, bx + 5, top - 20, 18, 2, '#ffffff'); r(g, bx + 5, top - 15, 26, 2, 'rgba(255,255,255,0.6)');
        } else {
          r(g, x + 6, top - 5, 10, 5, '#b8bcc4'); r(g, x + 20, top - 4, 8, 4, '#a8acb4');
        }
        x += bw + 3 + Math.floor(rnd() * 8);
      }
    }, after: function (g, w, camX, t) { drawBuilt(g, w, camX, t); drawSirenGlow(g, w, camX); } },
    { speed: 1, paint: paintInterior },
    { speed: FRONT_SPEED, front: true, paint: function (g, w, h) {
      var rnd = MS.util.rng(77);
      for (var x = 140; x < w; x += 300 + Math.floor(rnd() * 160)) {
        // pendant lamps hanging into frame
        r(g, x, 0, 1, 12, '#2a2f3c');
        r(g, x - 9, 12, 19, 6, '#2a2f3c'); r(g, x - 8, 12, 17, 1, '#4a5264');
        g.fillStyle = 'rgba(255,240,200,0.10)';
        g.beginPath(); g.moveTo(x - 8, 18); g.lineTo(x + 9, 18); g.lineTo(x + 26, 70); g.lineTo(x - 25, 70); g.fill();
        r(g, x - 4, 18, 9, 1, '#fff2c8');
      }
      for (var p = 60; p < w; p += 240 + Math.floor(rnd() * 200)) {
        // a big office plant at the bottom edge
        for (var l = 0; l < 9; l++) {
          var lx = p + l * 5 - 20, lh = 18 + (l * 7) % 13;
          for (var y = 0; y < lh; y++) r(g, lx + Math.round(Math.sin(y * 0.25 + l) * 2), H - y, 4 - Math.floor(y / 8), 1, y > lh - 4 ? '#3a8a50' : (l % 2 ? '#1f5a36' : '#2a6e42'));
        }
        r(g, p - 18, H - 6, 34, 6, '#e8ecf4'); r(g, p - 18, H - 6, 34, 1, '#ffffff');
      }
    } }
  ];

  // ------------------------------------------------------------ props
  function deskImg() {
    return once('desk', function () {
      return stamp(24, 18, function (g) {
        r(g, 7, 0, 12, 8, '#2a2e3a'); r(g, 8, 1, 10, 6, '#cfe4ff'); r(g, 9, 2, 4, 1, BLUE); r(g, 9, 4, 7, 1, '#9ab8f0'); r(g, 14, 2, 3, 2, '#e04a4a');
        r(g, 12, 8, 2, 2, '#5f687a');
        r(g, 0, 10, 24, 2, '#f4f4f8'); r(g, 0, 12, 24, 1, '#c8ccd8');
        r(g, 1, 13, 2, 5, '#8a92a4'); r(g, 21, 13, 2, 5, '#8a92a4');
        r(g, 3, 9, 6, 1, '#5f687a');
      });
    });
  }
  function seatImg() {
    return once('seat', function () {
      return stamp(10, 10, function (g) {
        r(g, 0, 0, 4, 6, '#3a4152'); r(g, 0, 6, 10, 2, '#3a4152'); r(g, 4, 8, 2, 2, '#2a2e3a'); r(g, 1, 9, 8, 1, '#2a2e3a');
      });
    });
  }
  function solidImg(s) {
    return once('solid:' + s.kind + s.w + 'x' + s.h + (s.label || ''), function () {
      return stamp(s.w, s.h, function (g, w, h) {
        if (s.kind === 'boxes') {
          var rows = Math.round(h / 8);
          for (var i = 0; i < rows; i++) {
            var bw = w - (i % 2) * 4, bx = (i % 2) * 2, by = h - (i + 1) * (h / rows);
            r(g, bx, by, bw, h / rows - 1, '#c8955a'); r(g, bx, by, bw, 1, '#e2b47a'); r(g, bx + bw / 2 - 1, by, 2, h / rows - 1, '#d8b080');
            r(g, bx, by + h / rows - 2, bw, 1, '#a07040');
          }
          if (s.label) { r(g, 2, h - 6, w - 4, 4, '#f4ead8'); }
        } else if (s.kind === 'copier') {
          r(g, 0, 6, w, h - 6, '#e4e7ee'); r(g, 0, 6, w, 1, '#ffffff'); r(g, 0, h - 3, w, 3, '#9aa2b2');
          r(g, 2, 2, w - 6, 4, '#c3c9d4'); r(g, 3, 0, w - 8, 2, '#f8f8fb');
          r(g, w - 6, 8, 4, 3, '#2a2e3a'); r(g, w - 5, 9, 1, 1, '#e04a4a');
          r(g, 3, 12, w - 6, 2, '#5f687a'); r(g, 4, 15, w - 10, 3, '#ffffff');
          r(g, 3, 19, w - 6, 1, '#c3c9d4');
        } else if (s.kind === 'planter') {
          for (var l = 0; l < 7; l++) {
            var lx = 1 + l * 2, lh = 6 + (l * 5) % 7;
            r(g, lx, h - 12 - lh, 2, lh, l % 2 ? '#2f9a5a' : '#46c27a');
          }
          r(g, 0, h - 12, w, 12, '#f2f4f8'); r(g, 0, h - 12, w, 2, '#ffffff'); r(g, 1, h - 3, w - 2, 3, '#c8ced8');
        } else if (s.kind === 'pingpong') {
          // side-on: the net sticks up from the middle of the green top
          r(g, w / 2 - 1, 0, 3, 4, '#f4f4f8'); r(g, w / 2, 1, 1, 3, '#c8ccd8');
          r(g, 0, 4, w, 4, '#2f7a5a'); r(g, 0, 4, w, 1, '#6ad8a8'); r(g, 0, 7, w, 1, '#ffffff');
          r(g, 3, 8, 3, h - 8, '#5f687a'); r(g, w - 6, 8, 3, h - 8, '#5f687a'); r(g, 6, 12, w - 12, 1, '#8b95a8');
          r(g, 6, 1, 4, 3, '#e04a4a'); r(g, 9, 3, 2, 1, '#8a5a30'); r(g, w - 9, 2, 2, 2, '#ffffff');
        } else if (s.kind === 'chair') {
          r(g, 0, 0, 5, 7, '#3a4152'); r(g, 0, 0, 5, 1, '#5f687a');
          r(g, 0, 6, w, 3, '#3a4152'); r(g, 0, 6, w, 1, '#5f687a');
          r(g, w / 2 - 1, 9, 2, h - 11, '#2a2e3a'); r(g, 1, h - 2, w - 2, 1, '#2a2e3a'); r(g, 1, h - 1, 2, 1, '#2a2e3a'); r(g, w - 3, h - 1, 2, 1, '#2a2e3a');
        } else if (s.kind === 'cart') {
          r(g, 0, 0, w, 2, '#8b95a8'); r(g, 0, 8, w, 2, '#8b95a8'); r(g, 1, 2, 2, h - 4, '#8b95a8'); r(g, w - 3, 2, 2, h - 4, '#8b95a8');
          r(g, 4, -1, 6, 1, '#ffd36a'); r(g, 4, 2, 9, 6, '#f8f0dc'); r(g, 14, 3, 9, 5, '#9ad4ff'); r(g, 5, 10, 16, 5, '#e2b47a');
          r(g, 2, h - 3, 4, 3, '#2a2e3a'); r(g, w - 6, h - 3, 4, 3, '#2a2e3a');
        } else if (s.kind === 'beanbag') {
          for (var y = 0; y < h; y++) {
            var k = y / h, ww = Math.round(w * (0.55 + 0.45 * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2)));
            r(g, (w - ww) / 2, y, ww, 1, y < 2 ? '#ff9a6a' : '#e8603a');
          }
          r(g, w / 2 - 4, 3, 6, 1, '#ffb88a');
        }
      });
    });
  }

  var SEATED = [{ x: 900 }, { x: 942 }, { x: 1112 }];
  var props = [];
  SEATED.forEach(function (d) {
    props.push({ x: d.x - 6, z: -3, draw: function (g, sx) { g.drawImage(seatImg(), sx - 6, G - 11); } });
    props.push({ x: d.x + 16, z: -1, draw: function (g, sx) { g.drawImage(deskImg(), sx - 12, G - 19); } });
  });
  SOLIDS.forEach(function (s) {
    props.push({ x: s.x, z: -1, draw: function (g, sx) {
      g.drawImage(solidImg(s), sx - 1, G - s.h - 1);
      if (s.kind === 'copier') { r(g, sx + 3, G - s.h + 7, 9, 7, '#ffd36a'); r(g, sx + 5, G - s.h + 9, 5, 1, '#d0342c'); r(g, sx + 5, G - s.h + 11, 3, 1, '#d0342c'); }
    } });
  });

  // ------------------------------------------------------------ live drawing
  function drawBack(g, w, camX, t) { drawBoard(g, w, camX, t); drawSirenWash(g, w, camX); drawTicker(g, w, camX); }

  function sparkleRing(w, x, y, n) {
    if (w.instant || w.reduced) return;
    w.burst(x, y, n, { kind: 'spark', colors: ['#ffffff', BLUE_HI, '#ffd36a'], speed: 90, g: 0, spread: Math.PI * 2, life: 0.5, floor: false });
  }

  MS.sets = MS.sets || {};
  MS.sets.city = {
    name: 'city', era: 'modern', width: WIDTH, ground: G, camera: 0, entry: 40, bg: '#4f9ae8',
    music: 'city', crowd: 'WORKERS', haze: '#cbdbfc',
    marks: {
      lobby: M.lobby, entrance: M.lobby, meeting: M.meeting, 'meeting room': M.meeting, desks: M.desks, office: M.desks,
      board: M.board, whiteboard: M.board, buttons: M.board, kitchen: M.kitchen, cooler: M.kitchen, 'water cooler': M.kitchen,
      museum: M.museum, standup: M.museum, window: M.window, 'big window': M.window
    },
    // The desk crowd straddles the desks mark: workers 1-3 behind Sam's arrival, the designer,
    // developer and PM in front of the board, so the desk scene, the board scene and the
    // opening pan all frame them without the camera hunting.
    cast: {
      SAM: { names: ['SAM'], costume: 'sam3', x: -40, visible: false },
      WORKER3: { names: ['WORKER 3'], costume: 'worker3', x: 900, anim: 'work', z: -2, groups: ['WORKERS'] },
      WORKER1: { names: ['WORKER 1'], costume: 'worker1', x: 942, anim: 'work', z: -2, groups: ['WORKERS'] },
      WORKER2: { names: ['WORKER 2'], costume: 'worker2', x: 972, facing: -1, groups: ['WORKERS'] },
      DESIGNER: { names: ['DESIGNER', 'THE DESIGNER'], costume: 'designer', x: 1066, groups: ['WORKERS'] },
      DEVELOPER: { names: ['DEVELOPER', 'DEV', 'THE DEVELOPER'], costume: 'developer', x: 1112, anim: 'work', z: -2, groups: ['WORKERS'] },
      PM: { names: ['PM', 'PRODUCT MANAGER', 'THE PM'], costume: 'pm', x: 1162, facing: -1, groups: ['WORKERS'] }
    },
    events: [
      { id: 'unify', match: /^(?:the )?buttons (?:unify|snap together|line up)$/ },
      { id: 'build', match: /^(?:the )?city (?:builds|rises|grows)$/ },
      { id: 'numbers', match: /^(?:the )?(?:numbers|results|metrics|stats|charts?) (?:climb|climbs|rise|rises|go up|goes up|grow|grows)$/ },
      { id: 'sirens', match: /^(?:the )?(?:sirens?|alarms?)(?: (?:wails?|sounds?|blares?|go(?:es)? off|starts?))?$/ }
    ],
    eventsById: {
      unify: { run: function (w, args, Task) {
        var popped = false;
        return new Task(1.4, function (t) {
          w.state.unified = Math.min(1, t / 1.4);
          if (!popped && !w.instant) { popped = true; w.sfx('build'); }
          if (!w.instant && !w.reduced && Math.floor(t * 8) !== Math.floor((t - 1 / 60) * 8)) {
            sparkleRing(w, BOARD.x + 10 + ((t * 977) % (BOARD.w - 20)), BOARD.y + 14 + ((t * 431) % (BOARD.h - 24)), 4);
          }
        }, function () { w.state.unified = 1; });
      } },
      build: { run: function (w, args, Task) {
        var popped = false, topped = {};
        return new Task(2.2, function (t) {
          var k = w.state.built = Math.min(1, t / 2.2);
          if (w.instant) return;
          if (!popped) { popped = true; w.sfx('build'); }
          if (w.reduced) return;
          var cam = w.camera.x;
          BUILT.forEach(function (n, i) {
            if (topped[i] || (k - i * 0.035) / 0.55 < 1) return;
            topped[i] = true;
            var sx = builtX(i) - Math.round(cam * STREET_SPEED) + BUILT_W / 2;
            if (sx > -10 && sx < W + 10) w.burst(cam + sx, BUILT_BASE - n * BLOCK - 6, 6, { kind: 'spark', colors: ['#ffffff', '#cfe0ff'], speed: 50, g: 0, spread: Math.PI * 2, life: 0.4, floor: false });
          });
        }, function () { w.state.built = 1; });
      } },
      // The board turns into results: three rows of bars climb in turn. finish() snaps to 1.
      numbers: { run: function (w, args, Task) {
        var heard = 0, started = false;
        return new Task(NUMBERS_T, function (t) {
          var k = w.state.numbers = Math.min(1, t / NUMBERS_T);
          if (w.instant) return;
          if (!started) { started = true; w.sfx('pop'); }
          var n = rowsDone(k);
          for (; heard < n; heard++) {
            w.sfx('select');
            sparkleRing(w, BOARD.x + 12 + F.measure(RESULTS[heard].label), BOARD.y + 17 + heard * 11, 5);
          }
        }, function () { w.state.numbers = 1; });
      } },
      // Emergency light at the big window and the news ticker. The pulse and the crawl are
      // cosmetic (world time, w.cityFx); the state is just how far the event got.
      sirens: { run: function (w, args, Task) {
        var sounded = false;
        return new Task(SIREN_T, function (t) {
          w.state.sirens = Math.min(1, t / SIREN_T);
          if (w.instant || sounded) return;
          sounded = true;
          w.sfx('siren');
          (w.cityFx || (w.cityFx = {})).sirenAt = w.time;
        }, function () { w.state.sirens = 1; });
      } }
    },
    initState: function () { return { unified: 0, built: 0, numbers: 0, sirens: 0 }; },
    layers: layers, props: props, drawBack: drawBack,
    level: { solids: SOLIDS, targets: TARGETS, spawn: spawn, onHit: onHit }
  };
})(typeof window !== 'undefined' ? window : globalThis);
