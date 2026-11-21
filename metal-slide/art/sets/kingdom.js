/* METAL SLIDE set: Mission 2, the Kingdom of FINAL_FINAL_V9. A scrolling level, 2200px wide.
   32 colors (DawnBringer 32), lightly dithered; the far layers are hazed toward grey-blue so
   the cast pops (Metal Slug values). The castle sits on its hill behind the whole level.
   Left to right: the town gate, the royal post (versions travel by horse), the well and its
   drying lines of wet copies, notice boards plastered with final_v7, FINAL_final and v3, the
   market, the square, the scriptorium where monks recopy mockups by candlelight, the tower the
   mason built from version three, the guards' tents, the moat bridge and the castle gate.
   Hand-copied versions hang everywhere to be blasted: they roll up and puff away.
   Events: [cursors appear] / [cursors vanish] (multiplayer cursors over everyone) and
   [scrolls merge] (every copy in town flies into one glowing living file). */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint, C = MS.color;
  var W = MS.W, H = MS.H;
  var G = 156;          // where feet stand
  var LIP = 146;        // the back edge of the street: the 1px dark lip
  var WIDTH = 2200;

  // DawnBringer 32, by role.
  var NAVY = '#222034', PLUM = '#45283c', BRN0 = '#663931', BRN = '#8f563b', ORA = '#df7126',
    TAN = '#d9a066', TAN2 = '#eec39a', YEL = '#fbf236', LGRN = '#99e550', GRN = '#6abe30', TEAL = '#37946e',
    OLV = '#4b692f', OLV0 = '#524b24', SLATE = '#323c39', IND = '#3f3f74', BLU0 = '#306082', BLU = '#5b6ee1',
    BLU2 = '#639bff', CYA = '#5fcde4', PALE = '#cbdbfc', WHT = '#ffffff', GB = '#9badb7', GRY = '#847e87',
    GRY0 = '#696a6a', GRY00 = '#595652', RED = '#ac3232', RED2 = '#d95763',
    OLV2 = '#8f974a', MUS = '#8a6f30';

  // ------------------------------------------------------------ the floor plan (world x)
  // Story places, left to right. The villagers and the knight gather on the square between
  // the market and the scriptorium, so the market scene (Sam at the market mark) and the
  // opening tower pan both frame them without the camera hunting. The king waits at his gate.
  var M = { gate: 56, well: 430, market: 1000, square: 1120, scriptorium: 1200, tower: 1260, castle: 1960 };
  var SCRIBE_X = 1264, DESK_X = 1238, MASON_X = 1326, KING_X = 2010;
  var SCRIPT = { x: 1176, w: 126 };        // the scriptorium
  var TOWER = { x: 1306, w: 70 };          // the tower built from v3
  var BOARD = { x: 736, w: 108 };          // the town notice board
  var WALL_X = 1846;                       // the castle wall
  var GATE = { x: 2082, w: 60 };           // the castle gate arch
  var BALCONY = { x: 2066, w: 92, y: 74 }; // the court gallery over the gate
  var EASEL_X = 2052;                      // the royal drawing of the tower (v9)
  var BRIDGE = { x: 1764, w: 82 };         // the moat bridge
  var FILE = { x: 1232, y: 62, w: 56, h: 40 }; // where the living file is born
  var SKY_SPEED = 0.04, HILL_SPEED = 0.1, FAR_SPEED = 0.25, MID_SPEED = 0.5, FRONT_SPEED = 1.3;

  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function r(g, x, y, w, h, c) { P.rect(g, x, y, w, h, c); }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
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

  // Ring everything painted on a canvas with a 1px dark outline, Metal Slug style.
  function outline(c, ink) {
    var g = c.getContext('2d');
    var cw = c.width, ch = c.height;
    var d = g.getImageData(0, 0, cw, ch).data;
    var on = new Uint8Array(cw * ch);
    for (var i = 0; i < cw * ch; i++) on[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    g.fillStyle = ink || NAVY;
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

  // ------------------------------------------------------------ level data
  // Things to jump, drawn by this set exactly over their boxes (h <= 28).
  var SOLIDS = [
    // the gate to the market
    { x: 184, w: 24, h: 16, kind: 'hay' },
    { x: 330, w: 22, h: 18, kind: 'barrels' },
    { x: 520, w: 34, h: 22, kind: 'cart' },
    { x: 676, w: 22, h: 24, kind: 'crates' },
    { x: 880, w: 26, h: 12, kind: 'trough' },
    // the market to the scriptorium
    { x: 1084, w: 20, h: 12, kind: 'pile' },
    // the scriptorium to the castle
    { x: DESK_X, w: 22, h: 14, kind: 'desk' },
    { x: 1404, w: 28, h: 20, kind: 'blocks' },
    { x: 1534, w: 34, h: 22, kind: 'stonecart' },
    { x: 1676, w: 22, h: 18, kind: 'barrels' },
    { x: 1790, w: 26, h: 16, kind: 'hay' }
  ];

  // The drying line by the well sags between its poles at 370 and 500.
  function lineY(x) { return 104 + Math.round(Math.sin((x - 372) / 128 * Math.PI) * 4); }

  // Hand-copied versions to blast. Standing shots fly 23px above the feet (y 133), so a
  // standing target reaches down to y 131 or lower; the high ones need a jump (the apex
  // reaches about y 75). Each hangs from something drawn below (mount). Blasted, it rolls
  // up and is gone.
  var TARGETS = [
    // the gate to the market
    { id: 'kd-s1', x: 140, y: 110, w: 18, h: 24, label: 'V3', mount: 'post' },
    { id: 'kd-s2', x: 384, y: lineY(392) + 1, w: 16, h: 27, label: 'V5', mount: 'line' },
    { id: 'kd-s3', x: 462, y: lineY(472) + 1, w: 20, h: 25, label: 'FINAL_V7', mount: 'line' },
    { id: 'kd-s4', x: 602, y: 76, w: 18, h: 24, label: 'V4', mount: 'sign' },
    { id: 'kd-s5', x: 752, y: 106, w: 26, h: 26, label: 'FINAL_FINAL', mount: 'board' },
    { id: 'kd-s6', x: 804, y: 108, w: 18, h: 24, label: 'V6', mount: 'board' },
    { id: 'kd-s7', x: 906, y: 76, w: 18, h: 24, label: 'V8', mount: 'pole' },
    // the market to the scriptorium
    { id: 'kd-s8', x: 1044, y: 110, w: 18, h: 24, label: 'V2', mount: 'awning' },
    { id: 'kd-s9', x: 1142, y: 74, w: 20, h: 22, label: 'COPY', mount: 'rope' },
    // the scriptorium to the castle
    { id: 'kd-s10', x: 1352, y: 106, w: 28, h: 26, label: 'V3', mount: 'scaffold' },
    { id: 'kd-s11', x: 1478, y: 110, w: 18, h: 24, label: 'V5', mount: 'post' },
    { id: 'kd-s12', x: 1624, y: 80, w: 28, h: 22, label: 'FINAL2', mount: 'pole' },
    { id: 'kd-s13', x: 1722, w: 22, h: 26, label: 'V6', mount: 'ground' },
    { id: 'kd-s14', x: 1840, y: 106, w: 26, h: 26, label: 'FINAL_FINAL', mount: 'post' },
    { id: 'kd-s15', x: 1897, y: 78, w: 18, h: 22, label: 'V7', mount: 'banner' }
  ].map(function (t) { t.kind = 'scroll'; t.hp = 1; return t; });

  // Loafers met ahead of Sam: guards dicing, monks lugging and tossing old copies, guards
  // gossiping by the castle. Each screams its line and flees when it notices him.
  var EXTRAS = [
    { id: 'kd-dice1', costume: 'knight', x: 258, facing: 1, loaf: 'sit', line: 'SNAKE EYES!' },
    { id: 'kd-dice2', costume: 'knight', x: 296, facing: -1, loaf: 'sit', line: 'I WAS WINNING!' },
    { id: 'kd-tosser', costume: 'scribe2', x: 846, facing: -1, loaf: 'idle', thrower: true, line: 'TAKE V2! TAKE IT!' },
    { id: 'kd-monk', costume: 'scribe2', x: 1078, facing: 1, loaf: 'idle', held: 'boxes', line: 'FORTY COPIES!' },
    { id: 'kd-herald', costume: 'knight', x: 1600, facing: -1, loaf: 'idle', thrower: true, line: 'I AM THE GUARDS!' },
    { id: 'kd-gossip1', costume: 'knight', x: 1756, facing: 1, loaf: 'gossip', line: 'HE HAS V9?!' },
    { id: 'kd-gossip2', costume: 'scribe2', x: 1778, facing: -1, loaf: 'gossip', line: 'TELL THE KING!' }
  ];

  function spawn(w, fromX, toX) {
    if (!MS.enemies || !MS.enemies.make) return [];
    return EXTRAS.filter(function (e) { return e.x > fromX + 40 && e.x < toX + 8; }).map(function (e) {
      return MS.enemies.make(e.id, { costume: MS.costumes && MS.costumes[e.costume] ? e.costume : 'villager1', x: e.x, facing: e.facing, loaf: e.loaf, thrower: e.thrower, held: e.held, line: e.line });
    });
  }

  // The townsfolk cheer Sam on as he runs past (play only: settle clears playAnim).
  var FANS = { VILLAGER1: 'cheer', VILLAGER2: 'wave', VILLAGER3: 'cheer', KNIGHT: 'salute', SCRIBE: 'wave', MASON: 'cheer' };
  function levelUpdate(w, dt, play) {
    var sam = w.actors.SAM;
    if (!sam || !play) return;
    Object.keys(FANS).forEach(function (id) {
      var a = w.actors[id];
      if (!a || !a.visible || a.playAnim) return;
      if (Math.abs(sam.x - a.x) < 52) { a.playAnim = FANS[id]; if (!w.instant && id === 'SCRIBE') w.emote(id, '!'); }
    });
  }

  // A Metal Slug plume where the copy was, and its parchment flying apart.
  function onHit(w, t) {
    if (w.instant) return;
    var y = t.y != null ? t.y : G - t.h, cx = t.x + t.w / 2, cy = y + t.h / 2;
    if (w.explode) w.explode(cx, cy, 'small');
    if (w.burst) w.burst(cx, cy, 8, { kind: 'chip', colors: [TAN2, TAN, BRN], speed: 70, g: 300, life: 0.7, size: 1 });
  }

  // ------------------------------------------------------------ painting helpers
  // Rough ashlar: courses of stone blocks, a light top edge on each.
  function stones(g, rnd, x, y, w, h, base, dark, lite, course) {
    course = course || 5;
    r(g, x, y, w, h, dark);
    for (var cy = y; cy < y + h; cy += course) {
      var bx = x - Math.floor(rnd() * 9);
      while (bx < x + w) {
        var bw = 6 + Math.floor(rnd() * 8);
        var x0 = Math.max(x, bx + 1), x1 = Math.min(x + w, bx + bw);
        var hh = Math.min(course - 1, y + h - cy - 1);
        if (x1 > x0 && hh > 0) {
          var col = rnd() > 0.86 ? lite : base;
          r(g, x0, cy + 1, x1 - x0, hh, col);
          r(g, x0, cy + 1, x1 - x0, 1, lite);
        }
        bx += bw;
      }
    }
  }

  // A small leaded window with shutters and, sometimes, a flower box.
  function windowAt(g, x, y, w, h, o) {
    o = o || {};
    r(g, x - 1, y - 1, w + 2, h + 2, BRN0);
    r(g, x, y, w, h, o.lit ? ORA : IND);
    if (o.lit) { r(g, x, y + h - 3, w, 3, YEL); r(g, x + 1, y + 1, w - 2, 1, TAN2); }
    else { r(g, x + 1, y + 1, 2, h - 2, BLU0); px(g, x + 1, y + 1, PALE); }
    r(g, x + Math.floor(w / 2), y, 1, h, BRN0); r(g, x, y + Math.floor(h / 2), w, 1, BRN0);
    if (o.shutter) {
      r(g, x - 4, y - 1, 3, h + 2, o.shutter); r(g, x + w + 1, y - 1, 3, h + 2, o.shutter);
      r(g, x - 4, y + 2, 3, 1, NAVY); r(g, x + w + 1, y + 2, 3, 1, NAVY);
      r(g, x - 4, y + h - 3, 3, 1, NAVY); r(g, x + w + 1, y + h - 3, 3, 1, NAVY);
    }
    if (o.flowers) {
      r(g, x - 2, y + h + 1, w + 4, 3, BRN); r(g, x - 2, y + h + 1, w + 4, 1, TAN);
      for (var f = 0; f < w + 4; f += 2) { px(g, x - 2 + f, y + h, f % 4 ? GRN : RED2); px(g, x - 1 + f, y + h - 1, f % 6 ? LGRN : YEL); }
    }
  }

  // A pinned-up poster: parchment, a version in red ink, scribble lines, a nail.
  // text may hold two lines split by '|'.
  function poster(g, x, y, w, h, text, ink) {
    r(g, x + 1, y + 1, w, h, BRN0);
    r(g, x, y, w, h, TAN2);
    r(g, x, y + h - 1, w, 1, TAN);
    r(g, x + w - 1, y, 1, h, TAN);
    var lines = text ? String(text).split('|') : [];
    lines.forEach(function (l, i) { tinyC(g, l, x + w / 2, y + 2 + i * 6, ink || RED); });
    for (var ly = y + (lines.length ? 3 + lines.length * 6 : 3); ly < y + h - 2; ly += 2) r(g, x + 2, ly, Math.max(2, w - 4 - ((ly * 7) % 5)), 1, TAN);
    px(g, x + Math.floor(w / 2), y, GRY00);
  }

  // A tile roof whose eave runs along the front: courses narrowing toward the ridge.
  function eaveRoof(g, x, w, top, rh, col, dark, lite) {
    for (var i = 0; i < rh; i++) {
      var inset = Math.round(i * 0.7), y = top - 1 - i;
      r(g, x - 5 + inset, y, w + 10 - inset * 2, 1, i % 3 === 2 ? dark : col);
      if (i % 3 === 0) for (var sx = x - 4 + inset + (i % 2) * 3; sx < x + w + 5 - inset; sx += 6) px(g, sx, y, dark);
    }
    r(g, x - 5 + Math.round((rh - 1) * 0.7), top - rh, w + 10 - Math.round((rh - 1) * 0.7) * 2, 1, lite);
    r(g, x - 5, top, w + 10, 1, NAVY); r(g, x - 3, top + 1, w + 6, 1, BRN0);
  }

  // A gable front: a plaster triangle with a king post, tile edges along both slopes.
  function gable(g, x, w, top, col, dark, wall) {
    var half = Math.ceil(w / 2) + 4, cx = x + w / 2;
    for (var i = 0; i < half; i++) {
      var hw = half - i;
      r(g, cx - hw, top - 1 - i, hw * 2, 1, col);
      if (hw > 6) r(g, cx - hw + 5, top - 1 - i, (hw - 5) * 2, 1, wall);
      px(g, cx - hw, top - 1 - i, dark); px(g, cx + hw - 1, top - 1 - i, dark);
    }
    r(g, cx - 1, top - half + 4, 2, half - 4, BRN0);
    line(g, cx - 1, top - half + 8, cx - half + 8, top - 2, BRN0, 2);
    line(g, cx, top - half + 8, cx + half - 9, top - 2, BRN0, 2);
    r(g, x - 4, top - 1, w + 8, 2, BRN0); r(g, x - 4, top, w + 8, 1, NAVY);
    r(g, cx - 2, top - half - 1, 4, 2, dark);
  }

  // A half-timbered house front: rough stone ground floor, a jettied plaster floor above with
  // its timber frame, windows with shutters and flowers, a door, a tile roof.
  var CHIMNEYS = [];
  function house(g, rnd, x, w, h, o) {
    o = o || {};
    var base = LIP, top = base - h, gf = 24;
    var wall = o.wall || TAN2, roof = o.roof || RED, rdark = o.roofDark || BRN0, rlite = o.roofLite || RED2;
    // ground floor
    stones(g, rnd, x, base - gf, w, gf, GRY, GRY00, GB);
    r(g, x, base - gf, 1, gf, GRY00); r(g, x + w - 1, base - gf, 1, gf, GRY00);
    // upper floors, jettied out 2px
    var ux = x - 2, uw = w + 4, ub = base - gf;
    r(g, ux, top, uw, ub - top, wall);
    for (var sh = top; sh < ub; sh += 3) px(g, ux + 2 + ((sh * 13) % (uw - 4)), sh, TAN);
    var floors = Math.max(1, Math.round((ub - top) / 24)), fh = (ub - top) / floors;
    var step = w > 70 ? 16 : 13;
    var posts = [];
    for (var pp = ux; pp <= ux + uw - 2; pp += step) posts.push(pp);
    if (posts[posts.length - 1] < ux + uw - 2) posts.push(ux + uw - 2);
    for (var f = 0; f < floors; f++) {
      var y0 = Math.round(top + f * fh), y1 = Math.round(top + (f + 1) * fh);
      r(g, ux, y0, uw, 2, BRN0);
      for (var p = 0; p < posts.length - 1; p++) {
        var a = posts[p] + 2, b = posts[p + 1];
        if (b - a < 6) continue;
        if ((p + f) % 2 === 0 && b - a >= 9) {
          windowAt(g, a + Math.floor((b - a - 7) / 2), y0 + 5, 7, Math.min(9, y1 - y0 - 10), { shutter: o.shutter, flowers: o.flowers && f === floors - 1 && p % 3 === 0 });
        } else {
          line(g, a, y1 - 3, b - 2, y0 + 2, BRN0, 2);
        }
      }
    }
    posts.forEach(function (pp2) { r(g, pp2, top, 2, ub - top, BRN0); });
    r(g, ux, ub - 3, uw, 3, BRN0); r(g, ux, ub - 3, uw, 1, BRN);
    r(g, ux, ub, uw, 1, NAVY);
    // the door
    var dw = 10, dx = o.door === 'left' ? x + 5 : o.door === 'right' ? x + w - dw - 5 : x + Math.floor((w - dw) / 2);
    r(g, dx - 1, base - 19, dw + 2, 19, GRY00);
    r(g, dx, base - 18, dw, 18, BRN);
    for (var dp = dx + 2; dp < dx + dw; dp += 3) r(g, dp, base - 18, 1, 18, BRN0);
    r(g, dx, base - 18, dw, 1, TAN); px(g, dx + dw - 3, base - 9, YEL);
    r(g, dx - 2, base - 1, dw + 4, 1, GB);
    if (o.shop) {
      var sx0 = dx > x + w / 2 ? x + 4 : x + w - 22;
      r(g, sx0 - 1, base - 17, 20, 11, BRN0); r(g, sx0, base - 16, 18, 9, IND); r(g, sx0 + 1, base - 15, 3, 7, BLU0);
      r(g, sx0 - 2, base - 6, 22, 2, BRN);
    }
    // roof
    if (o.gable) gable(g, ux, uw, top, roof, rdark, wall);
    else eaveRoof(g, ux, uw, top, o.roofH || 16, roof, rdark, rlite);
    if (o.chimney != null) {
      var cx = x + o.chimney, ct = top - (o.gable ? Math.ceil(uw / 2) - 2 : (o.roofH || 16)) - 6;
      r(g, cx - 1, ct - 1, 9, top - ct + 1, NAVY); r(g, cx, ct, 7, top - ct, BRN0); r(g, cx, ct, 7, 2, GRY00); r(g, cx + 1, ct + 3, 5, 1, BRN);
      CHIMNEYS.push([cx + 3, ct - 2]);
    }
    if (o.sign) o.sign(g, x, w, top);
  }

  // A wrought-iron bracket with a painted sign hanging from it.
  function hangSign(g, x, y, w, h, bg, ink, text, wallRight) {
    var wallX = wallRight ? x + w + 6 : x - 6;
    r(g, Math.min(wallX, x), y - 7, w + 7, 2, NAVY);
    line(g, wallX, y - 1, wallRight ? x + w - 8 : x + 8, y - 6, NAVY, 1);
    r(g, x + 2, y - 5, 1, 5, NAVY); r(g, x + w - 3, y - 5, 1, 5, NAVY);
    r(g, x - 1, y - 1, w + 2, h + 2, NAVY); r(g, x, y, w, h, bg); r(g, x, y, w, 1, C.mix(bg, WHT, 0.3));
    if (text) tinyC(g, text, x + w / 2, y + Math.floor((h - 5) / 2), ink);
  }

  // A row of round tree tops.
  function treeBlob(g, cx, cy, rad, dark, mid, lite) {
    disc(g, cx, cy, rad, dark);
    disc(g, cx - 1, cy - 1, rad - 2, mid);
    disc(g, cx - Math.round(rad / 3), cy - Math.round(rad / 3), Math.max(1, rad - Math.round(rad * 0.55)), lite);
  }

  function cloud(g, cx, cy, s, top, under, shadow) {
    [[0, 0, 8], [10, -4, 10], [21, -1, 8], [-9, 2, 6], [30, 3, 6]].forEach(function (b) {
      var rr = Math.round(b[2] * s);
      for (var yy = -rr; yy <= Math.round(rr * 0.5); yy++) {
        var ww = Math.round(Math.sqrt(Math.max(0, rr * rr - yy * yy)) * 2);
        r(g, cx + b[0] * s - ww / 2, cy + b[1] * s + yy, ww, 1, yy > rr * 0.3 ? shadow : yy > -rr * 0.2 ? under : top);
      }
    });
  }

  // ------------------------------------------------------------ the sky
  function paintSky(g, w, h) {
    var rnd = MS.util.rng(5);
    P.vgrad(g, 0, 0, w, h, [[0, BLU0], [0.26, BLU2], [0.56, PALE], [0.74, TAN2], [1, TAN2]]);
    // far mountains, snow on the tops
    for (var x = 0; x < w; x++) {
      var y = Math.round(98 + Math.sin(x * 0.021) * 9 + Math.sin(x * 0.057 + 2) * 5 + Math.sin(x * 0.11) * 2);
      r(g, x, y, 1, h - y, GB);
      if (y < 96) r(g, x, y, 1, Math.max(1, Math.round((96 - y) * 0.6)), WHT);
      if ((x * 7) % 11 === 0) r(g, x, y + 3, 1, 6, GRY);
    }
    for (var c = 0; c < 6; c++) cloud(g, 20 + c * 78 + rnd() * 30, 22 + rnd() * 34, 0.8 + rnd() * 0.6, WHT, PALE, GB);
  }

  // ------------------------------------------------------------ the castle on its hill
  var HILL_CASTLE = 330;
  function paintHill(g, w, h) {
    var rnd = MS.util.rng(13);
    // the green hills, patchwork fields and hedgerows
    function hy(x) {
      var d = (x - HILL_CASTLE) / 120;
      return Math.round(122 + Math.sin(x * 0.017) * 5 + Math.sin(x * 0.043 + 1) * 3 - 30 * Math.exp(-d * d));
    }
    for (var x = 0; x < w; x++) {
      var y = hy(x);
      r(g, x, y, 1, h - y, GRN);
      r(g, x, y, 1, 2, LGRN);
      if ((x + Math.round(y)) % 37 < 18) r(g, x, y + 8 + (x % 3), 1, h - y, OLV2);
      if ((x * 3) % 53 < 2) r(g, x, y + 4, 1, h - y, TEAL);
    }
    for (var hh = 0; hh < 26; hh++) { var tx = rnd() * w; treeBlob(g, tx, hy(Math.round(tx)) - 2, 3 + Math.round(rnd() * 2), TEAL, GRN, LGRN); }
    // the road winding up to the gate
    for (var s = 0; s < 70; s++) {
      var k = s / 70, rx = HILL_CASTLE - 70 + Math.sin(k * 6) * 18 + k * 60, ry = hy(Math.round(rx)) + 4 - k * 8;
      r(g, rx, ry, 3, 1, TAN2);
    }
    // the castle
    var cx = HILL_CASTLE, by = hy(cx) - 2;
    r(g, cx - 58, by - 22, 116, 24, PALE);
    for (var b = cx - 58; b < cx + 58; b += 6) r(g, b, by - 25, 4, 3, PALE);
    r(g, cx - 58, by - 4, 116, 6, GB);
    for (var ws = cx - 52; ws < cx + 52; ws += 12) r(g, ws, by - 15, 2, 4, IND);
    function tower(tx, top, tw, roofCol) {
      r(g, tx - tw / 2, top, tw, by - top, PALE);
      r(g, tx + tw / 2 - 3, top, 3, by - top, GB);
      for (var wy = top + 6; wy < by - 6; wy += 9) r(g, tx - 1, wy, 2, 4, IND);
      for (var i = 0; i < tw / 2 + 6; i++) {
        var ww = Math.max(1, tw + 4 - i * 2 * (tw + 4) / (tw + 12));
        r(g, tx - ww / 2, top - i, ww, 1, i % 4 === 3 ? PLUM : roofCol);
      }
      var tip = top - Math.round(tw / 2 + 6);
      r(g, tx, tip - 8, 1, 8, NAVY); r(g, tx + 1, tip - 8, 5, 3, YEL);
    }
    tower(cx - 60, by - 40, 12, RED);
    tower(cx + 60, by - 38, 12, RED);
    r(g, cx - 24, by - 46, 48, 46, PALE); r(g, cx + 18, by - 46, 6, 46, GB);
    for (var kb = cx - 24; kb < cx + 24; kb += 6) r(g, kb, by - 49, 4, 3, PALE);
    for (var kw = cx - 16; kw < cx + 16; kw += 10) r(g, kw, by - 36, 3, 6, IND);
    tower(cx - 30, by - 62, 14, RED);
    tower(cx + 8, by - 76, 16, RED);
    tower(cx + 34, by - 56, 10, PLUM);
    r(g, cx - 6, by - 12, 12, 12, IND); r(g, cx - 4, by - 14, 8, 2, IND);
  }

  // ------------------------------------------------------------ the far town
  function paintFar(g, w, h) {
    var rnd = MS.util.rng(23);
    // a windmill on a rise
    var wm = 150;
    for (var x = 0; x < w; x++) { var yy = Math.round(128 + Math.sin(x * 0.02) * 4 - 12 * Math.exp(-Math.pow((x - wm) / 50, 2))); r(g, x, yy, 1, h - yy, TEAL); r(g, x, yy, 1, 1, GRN); }
    r(g, wm - 6, 96, 12, 22, TAN2); r(g, wm + 3, 96, 3, 22, TAN); r(g, wm - 8, 92, 16, 5, BRN0); r(g, wm - 2, 108, 4, 8, BRN0);
    line(g, wm, 94, wm - 18, 76, BRN, 2); line(g, wm, 94, wm + 18, 112, BRN, 2); line(g, wm, 94, wm + 18, 76, BRN, 2); line(g, wm, 94, wm - 18, 112, BRN, 2);
    // rows of roofs, gables to the street
    var x0 = 0;
    while (x0 < w) {
      var bw = 18 + Math.floor(rnd() * 22), bh = 14 + Math.floor(rnd() * 18), top = 132 - bh;
      var roof = [RED, BRN, PLUM, RED][Math.floor(rnd() * 4)];
      r(g, x0, top, bw, h - top, rnd() > 0.5 ? TAN2 : PALE);
      for (var i = 0; i < bw / 2 + 2; i++) r(g, x0 - 2 + i, top - i, bw + 4 - i * 2, 1, roof);
      for (var wy = top + 4; wy < 140; wy += 7) for (var wx = x0 + 3; wx < x0 + bw - 3; wx += 6) r(g, wx, wy, 2, 3, IND);
      x0 += bw + Math.floor(rnd() * 6) - 2;
    }
    // trees between the houses
    for (var t = 0; t < w / 30; t++) { var tx = rnd() * w; treeBlob(g, tx, 124 + rnd() * 8, 5 + Math.round(rnd() * 3), TEAL, GRN, LGRN); }
    // the town wall with its round towers
    r(g, 0, 132, w, h - 132, GB);
    for (var b = 0; b < w; b += 6) r(g, b, 129, 4, 3, GB);
    for (var s = 0; s < w; s += 9) r(g, s + ((s / 9) % 2) * 4, 136 + ((s / 9) % 3) * 3, 5, 1, GRY);
    for (var tw = 60; tw < w; tw += 170 + Math.floor(rnd() * 40)) {
      r(g, tw - 8, 112, 16, h - 112, PALE); r(g, tw + 4, 112, 4, h - 112, GB);
      for (var k = 0; k < 13; k++) r(g, tw - 10 + k * 0.8, 112 - k, 20 - k * 1.6, 1, k % 4 === 3 ? PLUM : RED);
      r(g, tw - 1, 120, 2, 5, IND);
    }
  }

  // ------------------------------------------------------------ the rooftops right behind the street
  var MID_CHURCH = 520, MID_BELFRY = 250, MID_KEEP = 1060;
  function paintMid(g, w, h) {
    var rnd = MS.util.rng(37);
    // tall trees
    for (var t = 0; t < w / 70; t++) {
      var tx = 30 + t * 70 + rnd() * 30;
      r(g, tx - 1, 100, 3, 46, BRN0);
      treeBlob(g, tx, 92 - rnd() * 10, 13 + Math.round(rnd() * 6), TEAL, GRN, LGRN);
    }
    // houses: walls, eaves and gables, chimneys
    var x = -10;
    while (x < w) {
      var bw = 34 + Math.floor(rnd() * 34), bh = 56 + Math.floor(rnd() * 40), top = LIP - bh;
      var wall = rnd() > 0.5 ? TAN2 : PALE, roof = [RED, BRN, IND, RED, PLUM][Math.floor(rnd() * 5)];
      r(g, x, top, bw, LIP - top, wall);
      for (var px0 = x + 6; px0 < x + bw - 4; px0 += 12) r(g, px0, top, 2, LIP - top, BRN0);
      for (var fy = top + 18; fy < LIP; fy += 20) r(g, x, fy, bw, 2, BRN0);
      for (var wy = top + 6; wy < LIP - 10; wy += 20) for (var wx = x + 9; wx < x + bw - 8; wx += 12) { r(g, wx, wy, 4, 6, IND); px(g, wx, wy, PALE); }
      if (rnd() > 0.45) {
        var half = Math.ceil(bw / 2) + 3;
        for (var i = 0; i < half; i++) r(g, x + bw / 2 - (half - i), top - i, (half - i) * 2, 1, i % 3 === 2 ? C.shade(roof, -0.3) : roof);
      } else {
        for (var j = 0; j < 14; j++) r(g, x - 3 + j * 0.8, top - j, bw + 6 - j * 1.6, 1, j % 3 === 2 ? C.shade(roof, -0.3) : roof);
      }
      if (rnd() > 0.5) { var chx = x + 6 + rnd() * (bw - 16); r(g, chx, top - 22, 6, 14, BRN0); r(g, chx, top - 22, 6, 2, GRY00); }
      x += bw + 2 + Math.floor(rnd() * 10);
    }
    // the belfry with its clock
    var bx = MID_BELFRY;
    r(g, bx - 14, 34, 28, LIP - 34, GB); r(g, bx + 8, 34, 6, LIP - 34, GRY);
    stones(g, rnd, bx - 14, 34, 22, LIP - 34, GB, GRY, PALE, 6);
    disc(g, bx, 54, 8, PALE); disc(g, bx, 54, 6, WHT); r(g, bx, 49, 1, 5, NAVY); r(g, bx, 54, 4, 1, NAVY);
    r(g, bx - 7, 70, 14, 16, IND); r(g, bx - 1, 72, 2, 10, YEL);
    for (var bi = 0; bi < 22; bi++) r(g, bx - 17 + bi * 0.8, 34 - bi, 34 - bi * 1.6, 1, bi % 3 === 2 ? NAVY : IND);
    r(g, bx, 6, 1, 8, YEL); r(g, bx - 2, 8, 5, 1, YEL);
    // the church: nave, rose window, the tall spire
    var cx = MID_CHURCH;
    r(g, cx - 40, 74, 70, LIP - 74, PALE);
    stones(g, rnd, cx - 40, 74, 70, LIP - 74, PALE, GB, WHT, 6);
    for (var ni = 0; ni < 20; ni++) r(g, cx - 44 + ni * 1.2, 74 - ni, 78 - ni * 2.4, 1, ni % 3 === 2 ? NAVY : IND);
    disc(g, cx - 5, 96, 9, GRY00); disc(g, cx - 5, 96, 7, BLU); disc(g, cx - 5, 96, 3, RED2);
    for (var sp = 0; sp < 8; sp++) { var an = sp / 8 * Math.PI * 2; px(g, cx - 5 + Math.cos(an) * 5, 96 + Math.sin(an) * 5, YEL); }
    r(g, cx - 11, 118, 12, LIP - 118, BRN0); disc(g, cx - 5, 118, 6, BRN0); r(g, cx - 5, 114, 1, 32, NAVY);
    r(g, cx + 30, 32, 26, LIP - 32, PALE); r(g, cx + 50, 32, 6, LIP - 32, GB);
    stones(g, rnd, cx + 30, 32, 20, LIP - 32, PALE, GB, WHT, 6);
    r(g, cx + 38, 44, 10, 18, NAVY); disc(g, cx + 43, 44, 5, NAVY); r(g, cx + 42, 46, 2, 12, YEL);
    for (var si = 0; si < 58; si++) {
      var sw = Math.max(1, 30 - si * 0.52);
      r(g, cx + 43 - sw / 2, 32 - si, sw, 1, si % 5 === 4 ? NAVY : IND);
      if (sw > 3) px(g, cx + 43 - sw / 2, 32 - si, BLU);
    }
    r(g, cx + 42, -30, 2, 6, YEL);
    // the castle keep, behind the castle wall at the far end
    var kx = MID_KEEP;
    r(g, kx, 60, w - kx, LIP - 60, PALE);
    stones(g, rnd, kx, 60, w - kx, LIP - 60, PALE, GB, WHT, 6);
    for (var kb = kx; kb < w; kb += 8) r(g, kb, 54, 5, 6, PALE);
    [[kx + 40, 22, 22], [kx + 120, 4, 30], [kx + 196, 30, 20]].forEach(function (t2) {
      var tx2 = t2[0], ttop = t2[1], tw = t2[2];
      r(g, tx2 - tw / 2, ttop, tw, LIP - ttop, PALE); r(g, tx2 + tw / 2 - 5, ttop, 5, LIP - ttop, GB);
      for (var wy2 = ttop + 10; wy2 < 120; wy2 += 16) { r(g, tx2 - 2, wy2, 4, 7, IND); disc(g, tx2, wy2, 2, IND); }
      for (var q = 0; q < tw * 0.9; q++) {
        var qw = Math.max(1, tw + 6 - q * (tw + 6) / (tw * 0.9));
        r(g, tx2 - qw / 2, ttop - q, qw, 1, q % 4 === 3 ? BRN0 : RED);
      }
      var tip = ttop - Math.round(tw * 0.9);
      r(g, tx2, tip - 10, 1, 10, NAVY); r(g, tx2 + 1, tip - 10, 7, 4, YEL); r(g, tx2 + 1, tip - 7, 4, 1, ORA);
    });
  }

  // ------------------------------------------------------------ the street (the playfield layer)
  function paintNear(g, w, h) {
    var rnd = MS.util.rng(41);
    CHIMNEYS.length = 0;

    // ---- the town gate: a stone gatehouse, its portcullis up
    stones(g, rnd, 0, 22, 78, LIP - 22, GB, GRY, PALE, 6);
    for (var cb = 0; cb < 78; cb += 10) { r(g, cb, 14, 7, 9, GB); r(g, cb, 14, 7, 1, PALE); r(g, cb + 6, 14, 1, 9, GRY); }
    r(g, 0, 22, 78, 2, GRY00);
    r(g, 74, 22, 4, LIP - 22, GRY);
    var ax = 12, aw = 48, atop = 70;
    for (var y = atop; y < LIP; y++) {
      var dy = y - (atop + aw / 2), half = y < atop + aw / 2 ? Math.round(Math.sqrt(Math.max(0, (aw / 2) * (aw / 2) - dy * dy))) : aw / 2;
      r(g, ax + aw / 2 - half - 2, y, half * 2 + 4, 1, GRY00);
      r(g, ax + aw / 2 - half, y, half * 2, 1, y < 84 ? NAVY : y < 112 ? PALE : y < 128 ? GRN : TAN);
      if (y >= 112 && y < 128 && (y % 3 === 0)) r(g, ax + aw / 2 - half, y, half * 2, 1, TEAL);
      if (y >= 106 && y < 112) for (var hx3 = ax + aw / 2 - half; hx3 < ax + aw / 2 + half; hx3 += 7) px(g, hx3 + (y % 4), y, GB);
    }
    for (var rd = 0; rd < 18; rd++) r(g, ax + aw / 2 - 3 - rd * 0.9, 128 + rd, 6 + rd * 1.8, 1, rd % 3 ? TAN2 : TAN);
    treeBlob(g, ax + 10, 110, 6, TEAL, GRN, LGRN); treeBlob(g, ax + 38, 108, 5, TEAL, GRN, LGRN);
    r(g, ax + 2, 84, aw - 4, 3, GRY00);
    for (var pb = ax + 3; pb < ax + aw - 2; pb += 5) { r(g, pb, atop + 2, 2, 12, GRY00); px(g, pb, atop + 14, GB); }
    r(g, ax + 2, atop + 8, aw - 4, 2, GRY00);
    // the name plaque over the arch
    r(g, 13, 36, 48, 13, NAVY); r(g, 14, 37, 46, 11, BRN); r(g, 14, 37, 46, 1, TAN);
    tinyC(g, 'FINAL_FINAL', 37, 38, TAN2); tinyC(g, '_V9', 37, 43, YEL);
    // banners either side
    [4, 64].forEach(function (bx) {
      r(g, bx, 26, 9, 34, RED); r(g, bx, 26, 9, 2, RED2); r(g, bx + 8, 26, 1, 34, BRN0);
      for (var t2 = 0; t2 < 4; t2++) px(g, bx + t2 * 2 + 1, 60, RED);
      r(g, bx + 3, 34, 3, 3, YEL); px(g, bx + 3, 33, YEL); px(g, bx + 5, 33, YEL);
    });
    // arrow slits
    r(g, 34, 26, 2, 7, NAVY);

    // ---- house A, then the royal post
    house(g, rnd, 86, 76, 86, { gable: true, roof: RED, chimney: 14, shutter: TEAL, flowers: true, door: 'right',
      sign: function (g2) { hangSign(g2, 96, 92, 18, 9, NAVY, YEL, 'INN', true); } });
    // the royal post: a stable with horses, saddlebags of scrolls, the courier timetable
    var px0 = 204, pw = 128;
    r(g, px0, 70, pw, LIP - 70, BRN);
    for (var pl = px0 + 4; pl < px0 + pw; pl += 6) r(g, pl, 70, 1, LIP - 70, BRN0);
    r(g, px0, 70, pw, 3, BRN0);
    eaveRoof(g, px0, pw, 70, 14, BRN, BRN0, TAN);
    // the hayloft door, hay spilling
    r(g, px0 + 52, 76, 22, 16, NAVY); r(g, px0 + 54, 80, 18, 12, MUS);
    for (var hy2 = 0; hy2 < 18; hy2 += 2) px(g, px0 + 54 + hy2, 79 + (hy2 % 3), YEL);
    // the sign board
    r(g, px0 + 8, 96, 50, 13, NAVY); r(g, px0 + 9, 97, 48, 11, RED); r(g, px0 + 9, 97, 48, 1, RED2);
    tinyC(g, 'ROYAL POST', px0 + 33, 100, YEL);
    // two stalls with half doors and horses looking out
    [[px0 + 70, BRN], [px0 + 98, TAN]].forEach(function (s, i) {
      var sx = s[0];
      r(g, sx - 1, 104, 24, 42, NAVY); r(g, sx, 105, 22, 41, SLATE);
      r(g, sx, 124, 22, 22, BRN0); for (var hd = sx + 2; hd < sx + 22; hd += 5) r(g, hd, 124, 1, 22, BRN);
      line(g, sx, 125, sx + 21, 145, BRN, 1); r(g, sx, 124, 22, 1, TAN);
      // the horse: neck, head, blaze, mane, an ear
      var hc = s[1], hk = i ? BRN : BRN0;
      r(g, sx + 6, 108, 9, 17, hc); r(g, sx + 6, 108, 3, 17, hk);
      r(g, sx + 8, 110 + i, 12, 8, hc); r(g, sx + 16, 113 + i, 5, 5, hc); px(g, sx + 19, 115 + i, NAVY);
      r(g, sx + 12, 110 + i, 2, 6, WHT); px(g, sx + 12, 112 + i, NAVY);
      r(g, sx + 5, 106, 3, 14, NAVY); px(g, sx + 9, 107, hc); px(g, sx + 10, 106, hc);
      r(g, sx + 15, 117 + i, 6, 1, NAVY);
    });
    // saddlebags stuffed with copies, hanging on pegs
    [[px0 + 12, 116], [px0 + 36, 118]].forEach(function (sb) {
      r(g, sb[0] - 1, sb[1] - 1, 16, 14, NAVY); r(g, sb[0], sb[1], 14, 12, BRN0); r(g, sb[0], sb[1], 14, 3, BRN);
      for (var sc = 0; sc < 4; sc++) { r(g, sb[0] + 1 + sc * 3, sb[1] - 6 + (sc % 2), 3, 7, TAN2); r(g, sb[0] + 1 + sc * 3, sb[1] - 6 + (sc % 2), 3, 1, TAN); }
      px(g, sb[0] + 6, sb[1] + 6, YEL);
    });
    // the courier timetable chalkboard
    r(g, px0 + 10, 134, 44, 12, NAVY); r(g, px0 + 11, 135, 42, 11, SLATE);
    tiny(g, 'V9: TUE', px0 + 13, 136, WHT); tiny(g, 'ETA: ???', px0 + 13, 141, YEL);

    // ---- house B, the well, the drying lines of wet copies
    house(g, rnd, 334, 66, 96, { roof: IND, roofDark: NAVY, roofLite: BLU, chimney: 44, shutter: RED, door: 'left', roofH: 18,
      sign: function (g2) { hangSign(g2, 384, 94, 16, 10, TAN2, BRN0, 'INK', false); } });
    // a lane between the houses, an arch over it, the next street lit beyond
    r(g, 404, 56, 54, LIP - 56, SLATE);
    r(g, 414, 76, 34, LIP - 76, GRY0); r(g, 414, 76, 34, 2, GRY00);
    for (var lw = 0; lw < 12; lw++) r(g, 418 + lw * 0.6, LIP - 12 + lw, 26 - lw * 1.2, 1, lw % 2 ? GB : GRY);
    r(g, 404, 50, 54, 8, BRN0); r(g, 404, 50, 54, 1, BRN); for (var ab = 404; ab < 458; ab += 9) r(g, ab, 52, 1, 6, NAVY);
    for (var lnx = 406; lnx < 456; lnx++) px(g, lnx, 66 + Math.round(Math.sin((lnx - 406) / 50 * Math.PI) * 3), BRN0);
    [[412, RED2], [424, WHT], [436, BLU2], [446, YEL]].forEach(function (lk) { var lly = 67 + Math.round(Math.sin((lk[0] - 406) / 50 * Math.PI) * 3); r(g, lk[0], lly, 6, 7, lk[1]); r(g, lk[0], lly, 6, 1, NAVY); });
    // the well
    var wx = M.well - 18;
    r(g, wx - 1, 117, 38, 29, NAVY);
    stones(g, rnd, wx, 118, 36, 28, GRY, GRY00, PALE, 5);
    r(g, wx - 2, 116, 40, 3, GB); r(g, wx - 2, 116, 40, 1, PALE);
    r(g, wx + 2, 88, 3, 28, BRN0); r(g, wx + 31, 88, 3, 28, BRN0);
    for (var wr = 0; wr < 9; wr++) r(g, wx - 4 + wr, 88 - wr, 44 - wr * 2, 1, wr % 3 === 2 ? BRN0 : RED);
    r(g, wx + 5, 96, 26, 2, BRN); r(g, wx + 17, 98, 1, 12, TAN);
    r(g, wx + 14, 109, 8, 7, BRN); r(g, wx + 14, 109, 8, 1, TAN); r(g, wx + 15, 111, 6, 1, BRN0);
    // the drying line: poles, a sagging rope, wet copies pegged to dry
    [370, 500].forEach(function (pl2) { r(g, pl2 - 1, 100, 4, LIP - 100, NAVY); r(g, pl2, 100, 2, LIP - 100, BRN); r(g, pl2 - 2, 100, 6, 2, BRN0); });
    for (var lx = 372; lx < 500; lx++) px(g, lx, lineY(lx), TAN);
    [[404, 'V8'], [418, ''], [438, 'V7'], [486, '']].forEach(function (d, i) {
      var ly = lineY(d[0]) + 1;
      poster(g, d[0], ly, 10, 13 + (i % 2) * 3, d[1], RED);
      r(g, d[0] + 2, ly - 1, 1, 3, BRN0); r(g, d[0] + 7, ly - 1, 1, 3, BRN0);
      for (var dd = 0; dd < 3; dd++) px(g, d[0] + 2 + dd * 3, ly + 15 + (i % 2) * 3 + dd, BLU2);
    });
    r(g, 488, 120, 18, 9, NAVY); r(g, 489, 121, 16, 7, TAN2); tinyC(g, 'WET', 497, 122, RED);

    // ---- house C and D: posters of every version on the walls
    house(g, rnd, 508, 70, 80, { gable: true, roof: BRN, roofDark: BRN0, chimney: 50, shutter: TEAL, flowers: true, door: 'mid' });
    house(g, rnd, 582, 86, 104, { roof: RED, chimney: 12, shutter: BLU0, door: 'right', roofH: 18, shop: true,
      sign: function (g2) {
        hangSign(g2, 636, 70, 27, 9, TEAL, WHT, 'QUILLS', false);
      } });
    poster(g, 520, 124, 12, 14, 'V3', RED); poster(g, 534, 122, 11, 13, 'V5', BLU0);
    poster(g, 556, 126, 12, 13, 'V6', RED);
    poster(g, 646, 118, 14, 16, 'V7?', RED); poster(g, 600, 122, 12, 13, '???', PLUM);

    // ---- house E, then the town notice board
    house(g, rnd, 670, 62, 88, { gable: true, roof: IND, roofDark: NAVY, chimney: 40, shutter: RED, door: 'left', flowers: true });
    // a low wall behind the board
    stones(g, rnd, 732, 116, 116, 30, GB, GRY, PALE, 6);
    r(g, 732, 114, 116, 3, PALE);
    var bx = BOARD.x, bw = BOARD.w;
    r(g, bx + 6, 58, 4, LIP - 58, NAVY); r(g, bx + bw - 10, 58, 4, LIP - 58, NAVY);
    r(g, bx + 7, 58, 2, LIP - 58, BRN); r(g, bx + bw - 9, 58, 2, LIP - 58, BRN);
    for (var rb = 0; rb < 8; rb++) r(g, bx - 4 + rb, 58 - rb, bw + 8 - rb * 2, 1, rb % 3 === 2 ? BRN0 : RED);
    r(g, bx - 1, 59, bw + 2, 74, NAVY); r(g, bx, 60, bw, 72, BRN); r(g, bx, 60, bw, 1, TAN);
    for (var gr = bx + 3; gr < bx + bw; gr += 7) r(g, gr, 61, 1, 70, BRN0);
    r(g, bx + 24, 62, 60, 9, NAVY); r(g, bx + 25, 63, 58, 7, TAN2); tinyC(g, 'TOWN NOTICES', bx + 54, 64, BRN0);
    poster(g, bx + 3, 74, 25, 20, 'FINAL|_V7', RED);
    poster(g, bx + 31, 73, 16, 19, 'V3', RED);
    poster(g, bx + 50, 75, 25, 20, 'FINAL|FINAL', RED);
    poster(g, bx + 79, 72, 26, 22, 'V8|REAL', BLU0);
    poster(g, bx + 30, 95, 19, 12, 'USE', TEAL); r(g, bx + 34, 103, 9, 1, TEAL); px(g, bx + 42, 102, TEAL); px(g, bx + 42, 104, TEAL);
    poster(g, bx + 50, 97, 26, 12, 'NO,THIS', TEAL);
    poster(g, bx + 79, 96, 26, 12, 'LOST V6', PLUM);

    // ---- house F, the tavern
    house(g, rnd, 852, 74, 92, { roof: BRN, roofDark: BRN0, roofLite: TAN, chimney: 56, shutter: TEAL, door: 'mid', roofH: 18, flowers: true,
      sign: function (g2) { hangSign(g2, 860, 82, 28, 12, NAVY, YEL, 'TAVERN', true); } });

    // ---- the market: two tall houses behind the stalls
    house(g, rnd, 930, 82, 100, { gable: true, roof: RED, chimney: 16, shutter: BLU0, door: 'left', flowers: true });
    house(g, rnd, 1016, 80, 90, { roof: IND, roofDark: NAVY, roofLite: BLU, chimney: 52, shutter: RED, door: 'right', roofH: 18 });
    // the stalls: striped awnings over counters of goods
    function stall(sx, sw, c1, c2, sign, goods) {
      r(g, sx + 1, 102, 2, LIP - 102, NAVY); r(g, sx + sw - 3, 102, 2, LIP - 102, NAVY);
      r(g, sx - 1, 124, sw + 2, 22, NAVY); r(g, sx, 125, sw, 21, BRN); r(g, sx, 125, sw, 2, TAN);
      for (var pk = sx + 3; pk < sx + sw; pk += 8) r(g, pk, 128, 1, 18, BRN0);
      goods(sx, sw);
      for (var ay = 0; ay < 10; ay++) {
        var ext = Math.round(ay * 0.6);
        for (var st = 0; st < sw + ext * 2; st += 6) r(g, sx - ext + st, 96 + ay, Math.min(6, sw + ext * 2 - st), 1, (st / 6) % 2 ? c2 : c1);
      }
      for (var sc2 = 0; sc2 < sw + 12; sc2 += 6) { r(g, sx - 6 + sc2, 106, 6, 3, (sc2 / 6) % 2 ? c2 : c1); px(g, sx - 6 + sc2 + 2, 109, (sc2 / 6) % 2 ? c2 : c1); }
      r(g, sx - 7, 95, sw + 14, 1, NAVY);
      if (sign) { r(g, sx + sw / 2 - 17, 86, 34, 9, NAVY); r(g, sx + sw / 2 - 16, 87, 32, 7, TAN2); tinyC(g, sign, sx + sw / 2, 88, RED); }
    }
    stall(934, 46, RED, WHT, 'COPIES', function (sx) {
      for (var i = 0; i < 6; i++) { r(g, sx + 3 + i * 7, 119, 5, 6, TAN2); r(g, sx + 3 + i * 7, 119, 5, 1, TAN); r(g, sx + 5 + i * 7, 121, 1, 3, RED); }
      r(g, sx + 6, 128, 34, 7, TAN2); tinyC(g, '2 FOR 1', sx + 23, 129, RED);
    });
    stall(988, 44, BLU, YEL, 'INK', function (sx) {
      for (var i = 0; i < 5; i++) { r(g, sx + 4 + i * 8, 118, 5, 7, NAVY); r(g, sx + 5 + i * 8, 116, 3, 2, BRN0); px(g, sx + 5 + i * 8, 119, BLU); }
      line(g, sx + 30, 112, sx + 36, 118, WHT, 1); line(g, sx + 33, 111, sx + 38, 117, WHT, 1);
    });
    stall(1046, 46, TEAL, TAN2, 'FRESH V8', function (sx) {
      for (var i = 0; i < 7; i++) { disc(g, sx + 6 + i * 6, 121, 2, i % 3 ? RED : LGRN); }
      r(g, sx + 4, 115, 14, 3, TAN); r(g, sx + 26, 114, 12, 4, YEL);
    });
    // pennant banners on poles between the stalls
    [928, 1100].forEach(function (pp) {
      r(g, pp - 1, 48, 3, LIP - 48, NAVY); r(g, pp, 48, 1, LIP - 48, BRN);
      disc(g, pp, 47, 2, YEL);
    });
    for (var pn = 928; pn < 1100; pn += 2) {
      var py = 56 + Math.round(Math.sin((pn - 928) / 172 * Math.PI) * 10);
      px(g, pn, py, BRN0);
      if (pn % 10 === 0) { var pc = [RED, YEL, BLU, WHT, TEAL][(pn / 10) % 5]; for (var pt = 0; pt < 5; pt++) r(g, pn - 2 + pt * 0.4, py + 1 + pt, 5 - pt * 0.8, 1, pc); }
    }

    // ---- the square: the market cross, plastered with notices
    stones(g, rnd, 1098, 110, 80, 36, GB, GRY, PALE, 6); r(g, 1098, 108, 80, 3, PALE);
    house(g, rnd, 1130, 44, 70, { gable: true, roof: BRN, roofDark: BRN0, shutter: TEAL, door: 'mid' });
    var mc = 1108;
    r(g, mc - 10, LIP - 6, 20, 6, GRY); r(g, mc - 10, LIP - 6, 20, 1, PALE); r(g, mc - 7, LIP - 10, 14, 4, GB);
    r(g, mc - 3, 60, 6, LIP - 70, GB); r(g, mc + 1, 60, 2, LIP - 70, GRY); r(g, mc - 6, 62, 12, 3, GB); r(g, mc - 1, 52, 2, 10, GB); r(g, mc - 4, 55, 8, 2, GB);
    poster(g, mc - 5, 84, 10, 12, 'V9?', RED); poster(g, mc - 6, 104, 12, 10, 'V7', BLU0);

    // ---- the scriptorium: arcade windows lit by candles, its name carved over the door
    var sx = SCRIPT.x, sw = SCRIPT.w, stop = 42;
    r(g, sx - 1, stop - 1, sw + 2, LIP - stop + 1, NAVY);
    stones(g, rnd, sx, stop, sw, LIP - stop, TAN2, TAN, WHT, 6);
    for (var cr = 0; cr < 16; cr++) r(g, sx - 6 + cr, stop - cr, sw + 12 - cr * 2, 1, cr % 3 === 2 ? NAVY : IND);
    r(g, sx - 6, stop, sw + 12, 2, NAVY);
    r(g, sx, stop + 2, sw, 2, BRN0);
    // a string course and the carved name
    r(g, sx, 60, sw, 3, TAN); r(g, sx, 63, sw, 1, BRN0);
    r(g, sx + 26, 46, 74, 11, BRN0); r(g, sx + 27, 47, 72, 9, TAN2); tinyC(g, 'SCRIPTORIUM', sx + 63, 49, BRN0);
    // round-arched windows (the monks are drawn live, see drawBack)
    SCRIPT_WIN.forEach(function (wn) {
      var x0 = wn[0];
      for (var yy = 66; yy < 106; yy++) {
        var dy2 = yy - 76, hw = yy < 76 ? Math.round(Math.sqrt(Math.max(0, 100 - dy2 * dy2))) : 10;
        r(g, x0 + 10 - hw - 2, yy, hw * 2 + 4, 1, BRN0);
        r(g, x0 + 10 - hw, yy, hw * 2, 1, yy < 76 ? PLUM : BRN0);
      }
      r(g, x0 - 2, 105, 24, 3, TAN); r(g, x0 - 2, 105, 24, 1, WHT);
      r(g, x0, 76, 20, 29, PLUM);
    });
    // the door, the opening hours
    r(g, sx + 98, 112, 18, 34, NAVY); disc(g, sx + 107, 112, 9, NAVY);
    r(g, sx + 99, 113, 16, 33, BRN); disc(g, sx + 107, 113, 8, BRN);
    for (var dp = sx + 101; dp < sx + 115; dp += 3) r(g, dp, 108, 1, 38, BRN0);
    r(g, sx + 111, 128, 2, 2, YEL);
    r(g, sx + 4, 112, 36, 20, NAVY); r(g, sx + 5, 113, 34, 18, TAN2);
    tinyC(g, 'COPIES', sx + 22, 115, BRN0); tinyC(g, 'WHILE U', sx + 22, 121, BRN0); tinyC(g, 'WAIT', sx + 22, 127, RED);
    r(g, sx + 44, 118, 30, 9, NAVY); r(g, sx + 45, 119, 28, 7, RED); tinyC(g, '3 WEEKS', sx + 59, 120, YEL);
    // stacks of parchment against the wall
    for (var ps = 0; ps < 3; ps++) {
      var psx = sx + 78 + ps * 6, psh = 8 + ps * 3;
      for (var sy2 = 0; sy2 < psh; sy2 += 2) { r(g, psx, LIP - 2 - sy2, 6, 2, TAN2); px(g, psx + (sy2 % 3), LIP - 2 - sy2, TAN); }
    }

    // ---- the tower, built exactly to version three: upside down (wider at the top than at
    // the bottom), leaning, its door upstairs, its top never finished
    var tx = TOWER.x, tw = TOWER.w;
    for (var ty = 22; ty < LIP; ty++) {
      var extra = Math.round((LIP - ty) * 0.12), lean = Math.round((LIP - ty) * 0.05);
      var wid = tw - 14 + extra, left = tx + 7 - Math.round(extra / 2) + lean;
      r(g, left - 1, ty, wid + 2, 1, NAVY);
      r(g, left, ty, wid, 1, ty % 6 === 0 ? GRY : GB);
      for (var sb2 = (ty % 12 < 6 ? 4 : 10); sb2 < wid; sb2 += 12) px(g, left + sb2, ty, GRY);
      r(g, left + wid - 7, ty, 7, 1, ty % 6 === 0 ? GRY00 : GRY);
      r(g, left, ty, 2, 1, PALE);
    }
    // a band of corbels under the overhang
    r(g, tx + 4, 30, tw + 2, 3, GRY00);
    for (var co = tx + 6; co < tx + tw + 4; co += 6) { r(g, co, 33, 3, 3, GRY); px(g, co, 33, GB); }
    // mismatched blocks from somebody else's version
    [[tx + 8, 120, TAN], [tx + 40, 96, RED2], [tx + 20, 64, TAN], [tx + 46, 52, PALE]].forEach(function (b2) { r(g, b2[0], b2[1], 10, 5, b2[2]); r(g, b2[0], b2[1], 10, 1, WHT); });
    // the jagged unfinished top
    for (var jx = 0; jx < tw; jx += 6) { var jh = [6, 2, 9, 0, 4, 7, 1, 5, 3, 8, 2, 6][jx / 6 % 12]; r(g, tx + 5 + jx, 22 - jh, 5, jh, GB); r(g, tx + 5 + jx, 22 - jh, 5, 1, PALE); r(g, tx + 9 + jx, 22 - jh, 1, jh, GRY); }
    // windows at random heights, a door on the first floor (no stairs)
    [[tx + 12, 40, 6, 9], [tx + 44, 52, 6, 9], [tx + 18, 86, 6, 12], [tx + 50, 104, 5, 8]].forEach(function (wv) { r(g, wv[0] - 1, wv[1] - 1, wv[2] + 2, wv[3] + 2, NAVY); r(g, wv[0], wv[1], wv[2], wv[3], IND); });
    r(g, tx + 30, 98, 13, 22, NAVY); r(g, tx + 31, 99, 11, 21, BRN); r(g, tx + 31, 99, 11, 1, TAN); px(g, tx + 39, 110, YEL);
    r(g, tx + 28, 120, 17, 2, BRN0);
    r(g, tx + 24, 66, 22, 9, NAVY); r(g, tx + 25, 67, 20, 7, TAN2); tinyC(g, 'TOWER', tx + 35, 68, BRN0);
    // scaffolding all round: poles, planks, a ladder, a hoist with a block on its rope
    [tx - 10, tx + tw + 8].forEach(function (pl3) { r(g, pl3 - 1, 26, 4, LIP - 26, NAVY); r(g, pl3, 26, 2, LIP - 26, BRN); });
    [58, 98].forEach(function (pky) { r(g, tx - 13, pky - 1, tw + 26, 5, NAVY); r(g, tx - 12, pky, tw + 24, 3, TAN); r(g, tx - 12, pky + 2, tw + 24, 1, BRN); });
    for (var ld = 60; ld < LIP; ld += 5) r(g, tx - 20, ld, 7, 1, BRN);
    r(g, tx - 21, 58, 1, LIP - 58, BRN0); r(g, tx - 13, 58, 1, LIP - 58, BRN0);
    r(g, tx + tw + 7, 18, 30, 3, BRN0); r(g, tx + tw + 7, 18, 3, 10, BRN0); line(g, tx + tw + 9, 27, tx + tw + 30, 19, BRN0, 1);
    r(g, tx + tw + 32, 21, 1, 46, TAN);
    r(g, tx + tw + 27, 66, 11, 8, NAVY); r(g, tx + tw + 28, 67, 9, 6, GB); r(g, tx + tw + 28, 67, 9, 1, PALE);
    // a timber prop keeping it up, wedged with a stone
    line(g, tx + tw + 17, LIP - 2, tx + tw - 1, 84, NAVY, 4); line(g, tx + tw + 18, LIP - 3, tx + tw, 85, BRN, 2);
    line(g, tx + tw + 18, LIP - 3, tx + tw, 85, TAN, 1);
    r(g, tx + tw + 12, LIP - 6, 10, 6, NAVY); r(g, tx + tw + 13, LIP - 5, 8, 5, GB); r(g, tx + tw + 13, LIP - 5, 8, 1, PALE);
    // the six drawings, every one a different tower
    var dbx = 1392;
    r(g, dbx + 4, 74, 3, LIP - 74, BRN0); r(g, dbx + 52, 74, 3, LIP - 74, BRN0);
    r(g, dbx - 1, 71, 60, 40, NAVY); r(g, dbx, 72, 58, 38, BRN); r(g, dbx, 72, 58, 1, TAN);
    for (var dw2 = 0; dw2 < 6; dw2++) {
      var ddx = dbx + 2 + (dw2 % 3) * 19, ddy = 74 + Math.floor(dw2 / 3) * 18;
      r(g, ddx, ddy, 17, 16, TAN2); r(g, ddx, ddy + 15, 17, 1, TAN);
      var cxd = ddx + 8;
      if (dw2 === 0) { r(g, cxd - 2, ddy + 5, 4, 9, BLU0); for (var q = 0; q < 4; q++) r(g, cxd - 3 + q * 0.75, ddy + 5 - q, 6 - q * 1.5, 1, RED); }
      else if (dw2 === 1) { r(g, cxd - 4, ddy + 4, 8, 10, BLU0); r(g, cxd - 4, ddy + 3, 2, 1, BLU0); r(g, cxd + 2, ddy + 3, 2, 1, BLU0); }
      else if (dw2 === 2) { r(g, cxd - 2, ddy + 7, 4, 7, BLU0); disc(g, cxd, ddy + 5, 3, RED); px(g, cxd, ddy + 1, RED); }
      else if (dw2 === 3) { for (var q2 = 0; q2 < 10; q2++) r(g, cxd - 2 + Math.round(q2 * 0.4), ddy + 4 + q2, 4, 1, BLU0); }
      else if (dw2 === 4) { r(g, cxd - 5, ddy + 9, 10, 5, BLU0); r(g, cxd - 2, ddy + 3, 4, 6, BLU0); }
      else { r(g, cxd - 1, ddy + 2, 2, 12, BLU0); r(g, cxd - 4, ddy + 2, 8, 1, BLU0); }
      tiny(g, 'V' + (dw2 + 1), ddx + 1, ddy + 1, RED);
    }

    // ---- the mason's yard: a low wall, stacked blocks
    stones(g, rnd, 1454, 110, 110, 36, GB, GRY, PALE, 6); r(g, 1454, 108, 110, 3, PALE);
    house(g, rnd, 1466, 84, 92, { roof: RED, chimney: 20, shutter: TEAL, door: 'mid', roofH: 18, flowers: true,
      sign: function (g2) { hangSign(g2, 1518, 98, 26, 9, GRY00, WHT, 'MASONS', false); } });
    for (var bk = 0; bk < 3; bk++) { r(g, 1456 + bk * 11, LIP - 9, 10, 9, NAVY); r(g, 1457 + bk * 11, LIP - 8, 8, 8, GB); r(g, 1457 + bk * 11, LIP - 8, 8, 1, PALE); }
    r(g, 1461, LIP - 18, 10, 9, NAVY); r(g, 1462, LIP - 17, 8, 8, GB); r(g, 1462, LIP - 17, 8, 1, PALE);

    // ---- the guards' tents
    function tent(tx2, tw2, c1, c2) {
      var top2 = 86, half = tw2 / 2;
      for (var yy2 = top2; yy2 < LIP; yy2++) {
        var k = (yy2 - top2) / (LIP - top2), hw2 = Math.round(4 + (half - 4) * Math.min(1, k * 1.3));
        r(g, tx2 - hw2 - 1, yy2, hw2 * 2 + 2, 1, NAVY);
        for (var xx = -hw2; xx < hw2; xx++) px(g, tx2 + xx, yy2, Math.floor((xx + 40) / 6) % 2 ? c2 : c1);
      }
      r(g, tx2 - 7, LIP - 26, 14, 26, NAVY); r(g, tx2 - 6, LIP - 25, 12, 25, SLATE);
      line(g, tx2 - 6, LIP - 25, tx2 - 12, LIP - 1, C.shade(c1, -0.2), 1); line(g, tx2 + 5, LIP - 25, tx2 + 11, LIP - 1, C.shade(c1, -0.2), 1);
      r(g, tx2, top2 - 12, 1, 12, NAVY); r(g, tx2 + 1, top2 - 12, 7, 4, c1);
      r(g, tx2 - half - 2, LIP - 1, 4, 1, BRN0); r(g, tx2 + half - 2, LIP - 1, 4, 1, BRN0);
    }
    tent(1606, 70, RED, TAN2);
    tent(1686, 56, BLU, TAN2);
    // a weapon rack of practice swords (and a quill)
    r(g, 1730, 118, 26, 3, BRN0); r(g, 1732, 118, 2, 28, BRN0); r(g, 1752, 118, 2, 28, BRN0);
    for (var sw2 = 1736; sw2 < 1752; sw2 += 4) { r(g, sw2, 106, 1, 26, PALE); r(g, sw2 - 1, 116, 3, 1, YEL); }

    // ---- the castle approach: banner poles, then the moat and its bridge
    [1762].forEach(function (bp) {
      r(g, bp - 1, 30, 3, LIP - 30, NAVY); r(g, bp, 30, 1, LIP - 30, BRN); disc(g, bp, 29, 2, YEL);
      r(g, bp + 2, 34, 12, 30, RED); r(g, bp + 2, 34, 12, 2, RED2);
      for (var t3 = 0; t3 < 6; t3++) px(g, bp + 2 + t3 * 2, 64, RED);
      r(g, bp + 5, 44, 6, 4, YEL); px(g, bp + 5, 43, YEL); px(g, bp + 7, 43, YEL); px(g, bp + 10, 43, YEL);
    });
    stones(g, rnd, BRIDGE.x, 124, BRIDGE.w, 22, GRY, GRY00, GB, 6);
    r(g, BRIDGE.x, 122, BRIDGE.w, 3, GB);

    // ---- the castle wall, its round towers, the gate, the court gallery
    var cwx = WALL_X;
    stones(g, rnd, cwx, 30, w - cwx, 58, GB, GRY, PALE, 7);
    stones(g, rnd, cwx, 88, w - cwx, LIP - 88, GRY, GRY0, GB, 7);
    r(g, cwx, 33, w - cwx, 3, GRY);
    // the battered plinth, ivy, moss, arrow slits
    r(g, cwx, 132, w - cwx, LIP - 132, GRY0); r(g, cwx, 132, w - cwx, 1, GB);
    for (var pz = cwx + 4; pz < w; pz += 16) r(g, pz, 133, 1, 13, GRY00);
    [[cwx + 58, 60], [2040, 44], [2168, 70]].forEach(function (iv) {
      for (var vy = 0; vy < iv[1]; vy += 2) {
        var vx = iv[0] + Math.round(Math.sin(vy * 0.3) * 3);
        r(g, vx - 2, LIP - vy, 5, 2, vy % 6 ? TEAL : OLV); px(g, vx + ((vy * 5) % 7) - 3, LIP - vy, GRN);
      }
    });
    [[1940, 56], [2004, 60], [2120, 52]].forEach(function (sl) { r(g, sl[0] - 1, sl[1] - 1, 4, 12, GRY00); r(g, sl[0], sl[1], 2, 10, NAVY); });
    for (var cm = cwx; cm < w; cm += 12) { r(g, cm, 20, 8, 10, GB); r(g, cm, 20, 8, 1, PALE); r(g, cm + 7, 20, 1, 10, GRY); }
    r(g, cwx, 30, w - cwx, 3, GRY00);
    r(g, cwx - 1, 20, 1, LIP - 20, NAVY);
    [cwx + 30, w - 30].forEach(function (rt) {
      for (var yy3 = 6; yy3 < LIP; yy3++) {
        var trw = 36;
        r(g, rt - trw / 2 - 1, yy3, trw + 2, 1, NAVY);
        r(g, rt - trw / 2, yy3, trw, 1, (yy3 % 7) ? GB : GRY);
        r(g, rt - trw / 2, yy3, 3, 1, PALE); r(g, rt + trw / 2 - 7, yy3, 7, 1, GRY);
        if (yy3 % 7 === 0) for (var vs = rt - 14 + (yy3 % 14 ? 6 : 0); vs < rt + 14; vs += 12) r(g, vs, yy3, 1, 7, GRY);
      }
      for (var tb = rt - 20; tb < rt + 20; tb += 8) { r(g, tb, -2, 6, 9, GB); r(g, tb, -2, 6, 1, PALE); }
      r(g, rt - 2, 40, 4, 12, NAVY); r(g, rt - 2, 80, 4, 12, NAVY);
    });
    // long royal banners
    [cwx + 74, 2022, 2178 - 34].forEach(function (bnx) {
      r(g, bnx - 1, 34, 16, 62, NAVY); r(g, bnx, 35, 14, 60, RED); r(g, bnx, 35, 14, 2, RED2); r(g, bnx + 12, 35, 2, 60, BRN0);
      for (var tz = 0; tz < 7; tz++) px(g, bnx + tz * 2, 95, RED);
      r(g, bnx + 3, 52, 8, 6, YEL); px(g, bnx + 3, 50, YEL); px(g, bnx + 3, 51, YEL); px(g, bnx + 7, 50, YEL); px(g, bnx + 7, 51, YEL); px(g, bnx + 10, 50, YEL); px(g, bnx + 10, 51, YEL);
      r(g, bnx + 4, 54, 6, 1, RED);
    });
    // the gate arch, portcullis raised, a red carpet out of it
    var gx = GATE.x, gw = GATE.w, gtop = 92;
    for (var gy = gtop; gy < LIP; gy++) {
      var gdy = gy - (gtop + gw / 2), gh = gy < gtop + gw / 2 ? Math.round(Math.sqrt(Math.max(0, (gw / 2) * (gw / 2) - gdy * gdy))) : gw / 2;
      r(g, gx + gw / 2 - gh - 3, gy, gh * 2 + 6, 1, GRY00);
      r(g, gx + gw / 2 - gh, gy, gh * 2, 1, gy < 118 ? NAVY : SLATE);
    }
    for (var pc2 = gx + 4; pc2 < gx + gw - 2; pc2 += 6) { r(g, pc2, gtop + 4, 2, 12, GRY00); px(g, pc2, gtop + 16, PALE); }
    r(g, gx + 2, gtop + 10, gw - 4, 2, GRY00);
    r(g, gx + 18, LIP - 30, gw - 36, 30, RED); r(g, gx + 18, LIP - 30, gw - 36, 1, RED2);
    // the gallery over the gate (the court and its balustrade are drawn live)
    var bcx = BALCONY.x, bcw = BALCONY.w, bcy = BALCONY.y;
    r(g, bcx - 4, bcy, bcw + 8, 5, NAVY); r(g, bcx - 3, bcy, bcw + 6, 4, GB); r(g, bcx - 3, bcy, bcw + 6, 1, PALE);
    for (var br = bcx; br < bcx + bcw; br += 14) { r(g, br, bcy + 4, 6, 8, GRY); r(g, br + 1, bcy + 4, 4, 1, GB); }
    r(g, bcx, 30, bcw, bcy - 30, GRY00);
    r(g, bcx + 6, 38, bcw - 12, bcy - 38, SLATE);
    // torches beside the gate (flames are drawn live)
    TORCHES.forEach(function (tc) { r(g, tc[0] - 1, tc[1], 3, 9, BRN0); r(g, tc[0] - 3, tc[1] - 2, 7, 3, GRY00); });

    // ---- the street: a 1px dark lip, a band of flagstones, then cobbles going down
    P.vgrad(g, 0, LIP, w, h - LIP, [[0, GRY], [0.5, GRY0], [1, GRY00]]);
    r(g, 0, LIP + 1, w, 5, GB);
    for (var fx = 0; fx < w; fx += 14 + ((fx * 7) % 5)) { r(g, fx, LIP + 1, 1, 5, GRY); }
    r(g, 0, LIP + 1, w, 1, PALE);
    r(g, 0, LIP + 6, w, 1, GRY00);
    // cobbles: irregular rounded stones, small and lit at the back, bigger and darker in front
    var rowY = LIP + 7, rowH = 4, row = 0;
    while (rowY < h) {
      var depth = (rowY - LIP) / (h - LIP);
      var cx2 = -Math.floor(rnd() * rowH * 2);
      while (cx2 < w) {
        var cw2 = rowH + 2 + Math.floor(rnd() * (rowH + 2));
        var shade = rnd();
        var baseC = shade > 0.97 ? TAN : shade > 0.86 ? (depth < 0.35 ? PALE : GB) : shade > 0.3 ? (depth < 0.45 ? GB : GRY) : (depth < 0.45 ? GRY : GRY0);
        var lite = depth < 0.3 ? PALE : depth < 0.6 ? GB : GRY, darkC = depth < 0.5 ? GRY0 : GRY00;
        var ch = rowH - 1 - (rnd() > 0.7 ? 1 : 0);
        r(g, cx2 + 1, rowY, cw2 - 2, ch, baseC);
        r(g, cx2, rowY + 1, cw2, Math.max(1, ch - 2), baseC);
        r(g, cx2 + 1, rowY + ch - 1, cw2 - 2, 1, darkC);
        r(g, cx2 + 1, rowY, Math.max(1, Math.round((cw2 - 2) * 0.6)), 1, lite);
        cx2 += cw2 + (rnd() > 0.8 ? 1 : 0);
      }
      rowY += rowH; row++;
      rowH = Math.min(9, 4 + Math.floor(row / 2));
    }
    // a worn cart rut along the street, and moss in the cracks
    for (var rx = 0; rx < w; rx += 2) { var rv = 186 + Math.round(Math.sin(rx * 0.013) * 2); px(g, rx, rv, GRY00); }
    for (var ms = 0; ms < 160; ms++) { var mx = rnd() * w, my = LIP + 9 + rnd() * 56; r(g, mx, my, 2, 1, rnd() > 0.5 ? OLV : OLV2); }
    // straw, dropped parchment, puddles of sky
    for (var sv = 0; sv < 110; sv++) { var sxv = rnd() * w, syv = LIP + 8 + rnd() * 50; r(g, sxv, syv, 2 + rnd() * 3, 1, rnd() > 0.5 ? YEL : TAN); }
    for (var pa = 0; pa < 22; pa++) { var pxx = rnd() * w, pyy = LIP + 10 + rnd() * 44; r(g, pxx, pyy, 5, 3, TAN2); r(g, pxx, pyy, 5, 1, WHT); px(g, pxx + 1, pyy + 1, RED); }
    [[150, 176], [470, 190], [790, 172], [1180, 184], [1500, 178], [1700, 192]].forEach(function (pd) {
      r(g, pd[0], pd[1], 26, 4, BLU0); r(g, pd[0] + 2, pd[1] - 1, 22, 1, BLU0); r(g, pd[0] + 4, pd[1], 10, 1, BLU2); r(g, pd[0] + 16, pd[1] + 2, 5, 1, PALE);
    });
    // the moat bridge: planks over the water
    r(g, BRIDGE.x, LIP, BRIDGE.w, h - LIP, BLU0);
    for (var wl = LIP + 4; wl < h; wl += 5) for (var wx2 = BRIDGE.x + ((wl / 5) % 2) * 6; wx2 < BRIDGE.x + BRIDGE.w; wx2 += 14) r(g, wx2, wl, 6, 1, BLU);
    r(g, BRIDGE.x, LIP, BRIDGE.w, 1, NAVY);
    r(g, BRIDGE.x, LIP + 1, BRIDGE.w, 34, BRN);
    for (var pkx = BRIDGE.x; pkx < BRIDGE.x + BRIDGE.w; pkx += 7) { r(g, pkx, LIP + 1, 1, 34, BRN0); px(g, pkx + 3, LIP + 4, TAN); px(g, pkx + 3, LIP + 30, TAN); }
    r(g, BRIDGE.x, LIP + 1, BRIDGE.w, 1, TAN);
    r(g, BRIDGE.x, LIP + 35, BRIDGE.w, 2, BRN0);
    [BRIDGE.x - 5, BRIDGE.x + BRIDGE.w].forEach(function (bk) {
      r(g, bk, LIP, 5, h - LIP, GRY0); r(g, bk + 1, LIP, 3, h - LIP, GRY);
      for (var by2 = LIP + 3; by2 < h; by2 += 6) r(g, bk, by2, 5, 1, GRY00);
    });
    for (var post = BRIDGE.x + 4; post < BRIDGE.x + BRIDGE.w; post += 26) { r(g, post, LIP + 30, 3, 14, BRN0); r(g, post, LIP + 30, 3, 1, TAN); }
    // flagstones in front of the castle
    r(g, WALL_X, LIP + 1, w - WALL_X, h - LIP - 1, GRY);
    for (var fy2 = LIP + 1, fr = 0; fy2 < h; fy2 += 6 + fr, fr++) {
      var fh2 = 5 + fr, dep = (fy2 - LIP) / (h - LIP);
      for (var fx2 = WALL_X - ((fr * 11) % 17); fx2 < w; ) {
        var fw2 = 16 + fr * 2 + Math.floor(rnd() * 8), sh2 = rnd();
        var fc = sh2 > 0.85 ? PALE : sh2 > 0.25 ? (dep < 0.5 ? GB : GRY) : (dep < 0.5 ? GRY : GRY0);
        var fx0 = Math.max(WALL_X, fx2 + 1);
        r(g, fx0, fy2 + 1, fx2 + fw2 - fx0, fh2 - 1, fc);
        r(g, fx0, fy2 + 1, fx2 + fw2 - fx0, 1, dep < 0.5 ? PALE : GB);
        if (rnd() > 0.8) r(g, fx0 + 3, fy2 + 3, Math.min(5, fw2 - 6), 1, GRY0);
        fx2 += fw2;
      }
    }
    r(g, GATE.x + 18, LIP, GATE.w - 36, h - LIP, RED); r(g, GATE.x + 18, LIP, 1, h - LIP, RED2); r(g, GATE.x + GATE.w - 19, LIP, 1, h - LIP, BRN0);
    r(g, 0, LIP, w, 1, NAVY);
  }

  var SCRIPT_WIN = [[SCRIPT.x + 8], [SCRIPT.x + 40], [SCRIPT.x + 72]];
  var TORCHES = [[GATE.x - 10, 104], [GATE.x + GATE.w + 8, 104], [WALL_X + 52, 98]];

  // ------------------------------------------------------------ the front layer
  function paintFront(g, w, h) {
    var rnd = MS.util.rng(59);
    // bunting strung across the street, high up
    for (var b = 120; b < w; b += 360 + Math.floor(rnd() * 160)) {
      var span = 120 + Math.floor(rnd() * 60);
      for (var x = 0; x < span; x++) {
        var y = Math.round(4 + Math.sin(x / span * Math.PI) * 12);
        px(g, b + x, y, NAVY);
        if (x % 9 === 0) { var c = [RED, YEL, BLU, WHT, TEAL][(x / 9) % 5]; for (var t = 0; t < 6; t++) r(g, b + x + Math.round(t * 0.4), y + 1 + t, Math.max(1, 6 - t), 1, c); }
      }
    }
    // overhanging branches in the top corners
    for (var tr = 260; tr < w; tr += 520 + Math.floor(rnd() * 240)) {
      for (var l = 0; l < 7; l++) treeBlob(g, tr + l * 13 - 40, -4 + (l % 3) * 6, 10 + (l % 2) * 3, OLV, TEAL, GRN);
    }
    // the bottom edge: hedges with flowers, fence posts, a cat asleep on a barrel
    for (var hx = 60; hx < w; hx += 300 + Math.floor(rnd() * 200)) {
      var hw = 50 + Math.floor(rnd() * 40);
      for (var i = 0; i < hw; i += 7) treeBlob(g, hx + i, H - 4 + (i % 3), 8, OLV0, OLV, TEAL);
      for (var f = 0; f < hw; f += 6) px(g, hx + f, H - 9 - (f % 4), f % 12 ? RED2 : YEL);
    }
    for (var fp = 200; fp < w; fp += 470 + Math.floor(rnd() * 150)) {
      for (var k = 0; k < 4; k++) { r(g, fp + k * 12, H - 20, 4, 20, BRN0); r(g, fp + k * 12, H - 20, 4, 1, BRN); }
      r(g, fp - 2, H - 15, 42, 3, BRN0); r(g, fp - 2, H - 7, 42, 3, BRN0);
    }
    var cat = 1240;
    r(g, cat - 9, H - 18, 18, 18, NAVY); r(g, cat - 8, H - 17, 16, 17, BRN0); r(g, cat - 8, H - 12, 16, 1, NAVY);
    r(g, cat - 7, H - 23, 13, 5, NAVY); r(g, cat - 6, H - 22, 11, 4, ORA); r(g, cat - 7, H - 25, 2, 2, NAVY); r(g, cat + 4, H - 25, 2, 2, NAVY);
    r(g, cat + 5, H - 21, 5, 2, ORA); px(g, cat - 4, H - 20, NAVY); px(g, cat - 1, H - 20, NAVY);
  }

  var layers = [
    { speed: SKY_SPEED, haze: 0.12, dither: 0.6, paint: paintSky },
    { speed: HILL_SPEED, haze: 0.42, dither: 0.5, paint: paintHill },
    { speed: FAR_SPEED, haze: 0.4, dither: 0.45, paint: paintFar },
    { speed: MID_SPEED, haze: 0.22, dither: 0.35, paint: paintMid },
    { speed: 1, dither: 0.25, paint: paintNear },
    { speed: FRONT_SPEED, front: true, dither: 0, paint: paintFront }
  ];

  // ------------------------------------------------------------ solids, drawn to match their boxes
  function solidImg(s) {
    return once('solid:' + s.kind + ':' + s.x, function () {
      var rnd = MS.util.rng(s.x * 7 + s.w);
      return stamp(s.w, s.h, function (g, w, h) {
        if (s.kind === 'hay') {
          for (var y = 0; y < h; y++) {
            var k = y / h, ww = Math.round(w * (0.62 + 0.38 * Math.sin(Math.min(1, k * 1.5) * Math.PI / 2)));
            r(g, (w - ww) / 2, y, ww, 1, y < 2 ? YEL : y > h - 4 ? MUS : TAN);
          }
          for (var st = 0; st < w * 2; st++) px(g, 2 + rnd() * (w - 4), 2 + rnd() * (h - 4), rnd() > 0.5 ? YEL : MUS);
          r(g, 0, Math.round(h * 0.55), w, 1, BRN0);
        } else if (s.kind === 'barrels') {
          var bw = Math.floor(w / 2);
          [0, bw].forEach(function (bx, i) {
            var top = i ? 3 : 0;
            r(g, bx, top, bw, h - top, BRN); r(g, bx + 1, top, 2, h - top, TAN); r(g, bx + bw - 3, top, 2, h - top, BRN0);
            r(g, bx, top + 3, bw, 2, GRY00); r(g, bx, h - 5, bw, 2, GRY00);
            r(g, bx, top, bw, 2, BRN0); r(g, bx + 2, top, bw - 4, 1, TAN);
          });
          r(g, 2, -2, 6, 3, TAN2); r(g, 3, -2, 4, 1, WHT);
        } else if (s.kind === 'cart') {
          for (var cx = 2; cx < w - 2; cx += 3) { r(g, cx, 0, 3, 8, TAN2); r(g, cx, 0, 3, 1, TAN); px(g, cx + 1, 3, RED); }
          r(g, 0, 7, w, 3, BRN); r(g, 0, 7, w, 1, TAN);
          r(g, 1, 10, w - 2, h - 16, BRN0); for (var pl = 4; pl < w - 2; pl += 6) r(g, pl, 10, 1, h - 16, BRN);
          [6, w - 12].forEach(function (wx) {
            disc(g, wx + 3, h - 4, 4, NAVY); disc(g, wx + 3, h - 4, 3, BRN); px(g, wx + 3, h - 4, YEL);
            r(g, wx, h - 4, 7, 1, BRN0); r(g, wx + 3, h - 7, 1, 7, BRN0);
          });
          r(g, w - 1, 9, 6, 2, BRN0);
        } else if (s.kind === 'crates') {
          var hb = Math.round(h * 0.55);
          function crate(cx0, cy0, cw, ch) {
            r(g, cx0, cy0, cw, ch, BRN); r(g, cx0, cy0, cw, 1, TAN); r(g, cx0, cy0, 1, ch, TAN);
            r(g, cx0 + cw - 1, cy0, 1, ch, BRN0); r(g, cx0, cy0 + ch - 1, cw, 1, BRN0);
            line(g, cx0 + 1, cy0 + ch - 2, cx0 + cw - 2, cy0 + 1, BRN0, 1);
          }
          crate(0, h - hb, w, hb); crate(3, 0, w - 6, h - hb);
          r(g, 5, h - hb - 9, 12, 6, TAN2); tinyC(g, 'V8', 11, h - hb - 9 + 0, RED);
        } else if (s.kind === 'trough') {
          r(g, 0, 0, w, h, BRN); r(g, 0, 0, w, 1, TAN); r(g, 2, 1, w - 4, 3, BLU); r(g, 3, 1, 6, 1, PALE);
          r(g, 2, 5, w - 4, 1, BRN0); r(g, 1, h - 3, 3, 3, BRN0); r(g, w - 4, h - 3, 3, 3, BRN0);
        } else if (s.kind === 'pile') {
          for (var x = 0; x < w; x++) {
            var kk = Math.sin((x + 0.5) / w * Math.PI), top2 = Math.round(h - h * Math.pow(kk, 0.6));
            r(g, x, top2, 1, h - top2, TAN2);
            for (var yy = top2 + 2; yy < h; yy += 2) if (rnd() > 0.6) px(g, x, yy, TAN);
            px(g, x, top2, WHT);
          }
          r(g, Math.floor(w / 2) - 4, 5, 9, 4, RED); tinyC(g, 'V', Math.floor(w / 2), 4, WHT);
        } else if (s.kind === 'desk') {
          // a slanted copying desk: the mockup being copied, the inkpot, a candle stub
          r(g, 2, 5, 2, h - 5, BRN0); r(g, w - 5, 5, 2, h - 5, BRN0); r(g, 1, h - 2, w - 2, 2, BRN0);
          for (var dy = 0; dy < 6; dy++) r(g, 0, dy, w, 1, dy === 0 ? TAN : BRN);
          r(g, 3, 0, w - 8, 4, TAN2); r(g, 4, 1, 5, 2, BLU2); r(g, 10, 1, 6, 1, GRY); r(g, 10, 2, 4, 1, GRY);
          r(g, w - 4, -3, 3, 3, NAVY); px(g, w - 3, -4, WHT); px(g, w - 2, -5, WHT);
          r(g, 6, 8, w - 12, 2, BRN0);
        } else if (s.kind === 'blocks') {
          [[0, h - 10, 14, 10], [14, h - 10, 14, 10], [6, 0, 14, 10]].forEach(function (b2) {
            r(g, b2[0], b2[1], b2[2], b2[3], GB); r(g, b2[0], b2[1], b2[2], 1, PALE); r(g, b2[0] + b2[2] - 2, b2[1], 2, b2[3], GRY);
            r(g, b2[0], b2[1] + b2[3] - 1, b2[2], 1, GRY);
          });
          tinyC(g, 'V3', 13, 2, RED);
        } else if (s.kind === 'stonecart') {
          [[2, 0], [11, 1], [20, 0]].forEach(function (st2) { r(g, st2[0], st2[1], 9, 8, GB); r(g, st2[0], st2[1], 9, 1, PALE); r(g, st2[0] + 7, st2[1], 2, 8, GRY); });
          r(g, 0, 8, w, 3, BRN); r(g, 0, 8, w, 1, TAN);
          r(g, 1, 11, w - 2, h - 17, BRN0); for (var pl2 = 5; pl2 < w - 2; pl2 += 6) r(g, pl2, 11, 1, h - 17, BRN);
          [6, w - 12].forEach(function (wx2) {
            disc(g, wx2 + 3, h - 4, 4, NAVY); disc(g, wx2 + 3, h - 4, 3, BRN); px(g, wx2 + 3, h - 4, YEL);
            r(g, wx2, h - 4, 7, 1, BRN0); r(g, wx2 + 3, h - 7, 1, 7, BRN0);
          });
        }
      });
    });
  }

  // ------------------------------------------------------------ props
  function flame(g, x, y, t, seed, big) {
    var f = Math.floor(t * 9 + seed) % 3;
    var hh = [5, 6, 4][f] + (big || 0), sw = [0, 1, -1][f];
    r(g, x - 1, y - hh + 3, 3, hh - 2, ORA);
    r(g, x + sw, y - hh, 1, hh - 1, YEL);
    px(g, x + sw, y - hh - 1, WHT);
    r(g, x - 1, y - 1, 3, 1, YEL);
  }
  // A dithered glow in palette pixels: densest at the center (no partial alpha in pixel art).
  function glow(g, cx, cy, rad, col, strength) {
    var B = MS.palette.BAYER;
    g.fillStyle = col;
    for (var y = -rad; y <= rad; y++) for (var x = -rad; x <= rad; x++) {
      var d = Math.sqrt(x * x + y * y) / rad;
      if (d > 1) continue;
      var px2 = Math.round(cx + x), py = Math.round(cy + y);
      if ((1 - d) * strength * 16 > B[((py & 3) * 4) + (px2 & 3)]) g.fillRect(px2, py, 1, 1);
    }
  }
  function stool() {
    return once('stool', function () {
      return stamp(10, 9, function (g) { r(g, 0, 0, 10, 2, BRN); r(g, 0, 0, 10, 1, TAN); r(g, 1, 2, 2, 7, BRN0); r(g, 7, 2, 2, 7, BRN0); r(g, 2, 5, 6, 1, BRN0); });
    });
  }
  function parchPile(n) {
    return once('pile' + n, function () {
      var hh = 6 + n * 4;
      return stamp(9, hh, function (g) {
        for (var y = 0; y < hh; y += 2) { var o = (y * 3 + n) % 3 - 1; r(g, 1 + o, hh - 2 - y, 7, 2, TAN2); r(g, 1 + o, hh - 1 - y, 7, 1, TAN); }
        r(g, 2, hh - 6, 5, 1, RED);
      });
    });
  }
  function diceCrate() {
    return once('dicecrate', function () {
      return stamp(14, 9, function (g) {
        r(g, 0, 0, 14, 9, BRN); r(g, 0, 0, 14, 1, TAN); line(g, 1, 8, 12, 1, BRN0, 1);
        r(g, 3, -3, 3, 3, WHT); px(g, 4, -2, NAVY); r(g, 8, -3, 3, 3, WHT); px(g, 8, -3, NAVY); px(g, 10, -1, NAVY);
      });
    });
  }
  // The official drawing of the tower, version nine: tall, slender, flags. Nothing like it.
  function easel() {
    return once('easel', function () {
      return stamp(30, 52, function (g) {
        line(g, 4, 51, 12, 0, BRN0, 2); line(g, 25, 51, 17, 0, BRN0, 2); r(g, 14, 10, 2, 42, BRN0);
        r(g, 1, 4, 28, 34, TAN2); r(g, 1, 37, 28, 1, TAN); r(g, 0, 38, 30, 2, BRN);
        r(g, 12, 14, 6, 21, BLU0); r(g, 13, 14, 2, 21, BLU2);
        for (var i = 0; i < 9; i++) r(g, 15 - Math.max(1, 5 - i * 0.6), 14 - i, Math.max(2, 10 - i * 1.2), 1, RED);
        r(g, 14, 2, 1, 4, NAVY); r(g, 15, 2, 4, 2, YEL);
        r(g, 9, 24, 3, 11, BLU0); r(g, 18, 24, 3, 11, BLU0);
        tiny(g, 'V9', 3, 6, RED);
        r(g, 3, 31, 6, 1, GRY); r(g, 21, 31, 6, 1, GRY);
      });
    });
  }

  var props = [];
  SOLIDS.forEach(function (s) {
    props.push({ x: s.x, z: -1, draw: function (g, sx, w, t) {
      g.drawImage(solidImg(s), sx - 1, G - s.h - 1);
      if (s.kind === 'desk') { r(g, sx + 2, G - s.h - 4, 2, 4, WHT); flame(g, sx + 3, G - s.h - 5, w.reduced ? 0 : t, 0.4); }
    } });
  });
  props.push({ x: SCRIBE_X + 2, z: -2, draw: function (g, sx) { g.drawImage(stool(), sx - 5, G - 10); } });
  // the scribe's forty copies (they leave when the scrolls merge)
  [[SCRIBE_X + 18, 2], [SCRIBE_X + 28, 1], [SCRIBE_X - 46, 0]].forEach(function (pp, i) {
    props.push({ x: pp[0], z: -1, draw: function (g, sx, w) {
      if ((w.state.merged || 0) > 0.12 + i * 0.05) return;
      var img = parchPile(pp[1]);
      g.drawImage(img, sx - 5, G - img.height + 1);
    } });
  });
  props.push({ x: 276, z: -2, draw: function (g, sx) { g.drawImage(diceCrate(), sx - 8, G - 10); } });
  props.push({ x: EASEL_X, z: -2, draw: function (g, sx) { g.drawImage(easel(), sx - 16, G - 53); } });

  // ------------------------------------------------------------ live drawing behind the cast
  function drawMounts(g, w, camX) {
    TARGETS.forEach(function (tg) {
      var sx = Math.round(tg.x - camX);
      if (sx < -60 || sx > W + 30) return;
      var top = tg.y != null ? tg.y : G - tg.h, cx = sx + Math.floor(tg.w / 2);
      var m = tg.mount;
      if (m === 'post') {
        r(g, cx - 2, top - 8, 4, G - 2 - (top - 8), NAVY); r(g, cx - 1, top - 8, 2, G - 2 - (top - 8), BRN);
        r(g, sx - 3, top - 5, tg.w + 6, 4, NAVY); r(g, sx - 2, top - 4, tg.w + 4, 2, BRN); r(g, sx - 2, top - 4, tg.w + 4, 1, TAN);
        r(g, cx - 4, G - 4, 8, 3, BRN0);
      } else if (m === 'pole') {
        r(g, sx - 4, 34, 3, G - 36, NAVY); r(g, sx - 3, 34, 1, G - 36, BRN); disc(g, sx - 3, 33, 2, YEL);
        r(g, sx - 4, top - 4, tg.w + 6, 3, NAVY); r(g, sx - 3, top - 3, tg.w + 4, 1, BRN);
        r(g, sx - 1, 38, 10, 7, RED); r(g, sx - 1, 38, 10, 1, RED2); px(g, sx + 9, 44, RED);
      } else if (m === 'line' || m === 'board') {
        r(g, sx + 2, top - 1, 2, 3, m === 'line' ? BRN : GRY00); r(g, sx + tg.w - 4, top - 1, 2, 3, m === 'line' ? BRN : GRY00);
      } else if (m === 'sign' || m === 'awning' || m === 'rope' || m === 'scaffold' || m === 'banner') {
        var from = m === 'sign' ? 68 : m === 'awning' ? 108 : m === 'rope' ? 42 : m === 'scaffold' ? 98 : 34;
        if (m === 'sign') { r(g, sx - 6, from - 2, tg.w + 12, 2, NAVY); line(g, sx - 6, from - 8, sx - 6, from, NAVY, 1); line(g, sx - 6, from - 8, sx + 4, from - 2, NAVY, 1); }
        if (m === 'rope') { r(g, sx - 6, from - 2, tg.w + 12, 3, NAVY); r(g, sx - 5, from - 1, tg.w + 10, 1, BRN); }
        if (m === 'banner') { r(g, sx - 3, from - 2, tg.w + 6, 3, NAVY); r(g, sx - 2, from - 1, tg.w + 4, 1, GRY); }
        for (var y = from; y < top; y += 2) { px(g, sx + 3, y, BRN0); px(g, sx + tg.w - 4, y, BRN0); }
      } else if (m === 'ground') {
        r(g, sx - 3, G - 5, 6, 5, NAVY); r(g, sx - 2, G - 4, 4, 4, GB);
        r(g, sx + tg.w - 3, G - 7, 7, 7, NAVY); r(g, sx + tg.w - 2, G - 6, 5, 6, BRN);
      }
    });
  }

  // Monks copying by candlelight in the scriptorium windows. They clap once the copies merge.
  var MONKS = [['scribe2', 1], ['scribe', -1], ['scribe2', 1]];
  function rigFrame(w, costume, anim, t, facing) {
    var cos = MS.costumes && MS.costumes[costume];
    if (!cos || !MS.rig) return null;
    return MS.rig.frame(costume, cos, anim, MS.rig.frameIndex(anim, t), { era: MS.ui ? MS.ui.paletteEra(w) : '' });
  }
  function drawFigure(g, f, x, feetY, facing) {
    if (!f) return;
    if (facing < 0) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(f.canvas, -f.ox, feetY - f.oy); g.restore(); }
    else g.drawImage(f.canvas, x - f.ox, feetY - f.oy);
  }
  function drawScriptorium(g, w, camX, t) {
    var merged = (w.state.merged || 0) >= 1;
    SCRIPT_WIN.forEach(function (wn, i) {
      var x0 = Math.round(wn[0] - camX);
      if (x0 < -30 || x0 > W + 10) return;
      glow(g, x0 + 10, 92, 14, ORA, 0.55);
      g.save(); g.beginPath(); g.rect(x0, 76, 20, 29); g.clip();
      r(g, x0, 76, 20, 29, PLUM);
      glow(g, x0 + 10 + MONKS[i][1] * 4, 96, 11, ORA, 0.9);
      var anim = merged ? 'cheer' : 'work';
      drawFigure(g, rigFrame(w, MONKS[i][0], anim, t + i * 0.7), x0 + 10 - MONKS[i][1] * 3, 118, MONKS[i][1]);
      g.restore();
      // the candle on the sill
      var cx = x0 + 10 + MONKS[i][1] * 6;
      r(g, cx - 1, 99, 3, 6, WHT); r(g, cx - 1, 99, 1, 6, PALE);
      flame(g, cx, 98, w.reduced ? 0 : t, i * 1.3);
    });
  }

  // The court on the gallery over the castle gate. They cheer when the villagers do.
  var COURT = [['knight', 'idle', 1], ['villager2', 'gossip', 1], ['scribe2', 'idle', -1], ['knight', 'idle', -1]];
  function drawCourt(g, w, camX, t) {
    var bx = Math.round(BALCONY.x - camX);
    if (bx < -BALCONY.w - 20 || bx > W + 20) return;
    var cheer = ['VILLAGER1', 'VILLAGER2', 'VILLAGER3'].some(function (id) { var a = w.actors[id]; return a && a.anim === 'cheer'; });
    COURT.forEach(function (c, i) {
      var anim = cheer ? 'cheer' : c[1];
      drawFigure(g, rigFrame(w, c[0], anim, t + i * 0.37), bx + 12 + i * 22, BALCONY.y + 2, c[2]);
    });
    // the balustrade, over their legs
    var y = BALCONY.y - 16;
    r(g, bx - 4, y - 1, BALCONY.w + 8, 4, NAVY); r(g, bx - 3, y, BALCONY.w + 6, 2, GB); r(g, bx - 3, y, BALCONY.w + 6, 1, PALE);
    for (var b = bx - 2; b < bx + BALCONY.w + 2; b += 6) {
      r(g, b, y + 3, 4, 13, NAVY); r(g, b + 1, y + 3, 2, 13, GB); px(g, b + 1, y + 8, PALE);
    }
    r(g, bx - 4, BALCONY.y - 1, BALCONY.w + 8, 2, NAVY);
  }

  function drawTorches(g, w, camX, t) {
    TORCHES.forEach(function (tc, i) {
      var x = tc[0] - camX;
      if (x < -30 || x > W + 30) return;
      glow(g, x, tc[1] - 4, 12 + (Math.floor(t * 7 + i) % 2), ORA, 0.45);
      flame(g, x, tc[1] - 2, w.reduced ? 0 : t, i * 1.7, 1);
    });
  }

  function drawBack(g, w, camX, t) {
    drawScriptorium(g, w, camX, t);
    drawCourt(g, w, camX, t);
    drawTorches(g, w, camX, t);
    drawMounts(g, w, camX);
  }

  // ------------------------------------------------------------ [scrolls merge]: the living file
  // Where the copies come from: the scriptorium windows, the scribe's desk and piles, the
  // notice board and market far behind (they fly in from off screen), and the townsfolk's hands.
  var FLY_SPOTS = [
    [SCRIPT.x + 18, 84], [SCRIPT.x + 50, 86], [SCRIPT.x + 82, 82],
    [SCRIBE_X + 18, 140], [SCRIBE_X + 28, 136], [SCRIBE_X - 46, 146], [DESK_X + 8, 140], [SCRIBE_X + 22, 128],
    [960, 70], [990, 110], [1010, 40], [SCRIPT.x - 30, 30],
    [1390, 90], [1420, 80]
  ];
  var FLY_HANDS = ['VILLAGER1', 'VILLAGER2', 'VILLAGER3', 'KNIGHT', 'MASON'];
  function flySources(w) {
    var out = FLY_SPOTS.map(function (s) { return [s[0], s[1]]; });
    FLY_HANDS.forEach(function (id) {
      var a = w.actors[id];
      if (a && a.visible) out.push([a.x + (a.facing || 1) * 6, G - 24]);
    });
    return out;
  }
  var MERGE_DUR = 2.4;
  // Phases of the merge, as fractions of its progress k.
  var FLY_END = 0.58, CORE_END = 0.7;

  // A hand-copied page in flight, spinning about its vertical axis.
  function sheet(g, x, y, spin, k) {
    var c = Math.cos(spin), ww = Math.max(1, Math.round(10 * Math.abs(c)));
    x = Math.round(x - ww / 2); y = Math.round(y - 6);
    r(g, x - 1, y - 1, ww + 2, 14, NAVY);
    r(g, x, y, ww, 12, c >= 0 ? TAN2 : TAN);
    if (ww > 4 && c >= 0) {
      r(g, x, y, ww, 2, BRN0); r(g, x + 1, y + 4, ww - 2, 1, BRN); r(g, x + 1, y + 6, ww - 4, 1, BRN); r(g, x + 1, y + 8, ww - 3, 1, BRN);
      px(g, x + ww - 3, y + 10, RED);
    }
    if (k > 0.6) { px(g, x - 2, y + 6, WHT); px(g, x + ww + 1, y + 2, CYA); }
  }

  function drawMerge(g, w, camX, t) {
    var k = w.state.merged || 0;
    if (k <= 0 || k >= 1) return;
    var P0 = { x: FILE.x - camX, y: FILE.y + FILE.h / 2 };
    var src = flySources(w);
    if (k < FLY_END + 0.04) {
      src.forEach(function (s, i) {
        var d = (i % 7) * 0.035 + (i % 3) * 0.02;
        var u = Math.max(0, Math.min(1, (k - d) / (FLY_END - 0.16)));
        if (u >= 1) return;
        var sx = s[0] - camX, sy = s[1];
        var at = function (v) {
          var e = MS.util.ease.inOut(v);
          return [MS.util.lerp(sx, P0.x, e) + Math.sin(v * Math.PI) * ((i % 2) ? 18 : -14), MS.util.lerp(sy, P0.y, e) - Math.sin(v * Math.PI) * (26 + (i % 4) * 8)];
        };
        if (u > 0.08) for (var tr = 1; tr <= 3; tr++) { var q = at(Math.max(0, u - tr * 0.035)); px(g, q[0], q[1], tr === 1 ? WHT : CYA); }
        var p2 = at(u);
        sheet(g, p2[0], p2[1], u * (10 + i % 5), u);
      });
    }
    // the copies press together into a bright core, which pops into the file
    if (k > 0.3 && k < CORE_END + 0.05) {
      var c = Math.min(1, (k - 0.3) / (FLY_END - 0.3));
      var rad = Math.round(2 + c * 9 - Math.max(0, (k - FLY_END) / (CORE_END - FLY_END)) * 6);
      if (rad > 0) {
        glow(g, P0.x, P0.y, rad + 8, CYA, 0.8);
        disc(g, P0.x, P0.y, rad, WHT); disc(g, P0.x, P0.y, Math.max(1, rad - 3), YEL);
      }
    }
    if (k >= FLY_END) {
      var u2 = Math.min(1, (k - FLY_END) / (1 - FLY_END));
      drawFile(g, w, P0.x, P0.y, u2, 1, t);
    }
  }

  // The living file: one canvas, always the latest version, with the whole team's cursors on it.
  // open: 0..1 how far it has unfolded; s: scale (1 big, 0.5 the little companion during play).
  var FILE_CURSORS = [RED2, GRN, BLU];
  function drawFile(g, w, cx, cy, open, s, t) {
    var calm = w.reduced;
    var fw = Math.max(4, Math.round(FILE.w * s * Math.min(1, open / 0.4)));
    var fh = Math.max(3, Math.round(FILE.h * s * Math.max(0.08, Math.min(1, (open - 0.25) / 0.4))));
    var bob = calm ? 0 : Math.round(Math.sin(t * 2.2) * 1);
    var x = Math.round(cx - fw / 2), y = Math.round(cy - fh / 2) + bob;
    if (open < 1) glow(g, cx, y + fh / 2, Math.round(Math.max(fw, fh) * 0.6) + 4, CYA, 0.8);
    var pulse = calm ? 0 : Math.floor(t * 3) % 2;
    r(g, x - 2, y - 2, fw + 4, fh + 4, pulse ? CYA : WHT);
    r(g, x - 1, y - 1, fw + 2, fh + 2, NAVY);
    r(g, x, y, fw, fh, WHT);
    if (open < 0.6 || fh < 10) return;
    var u = Math.min(1, (open - 0.6) / 0.3);
    // the top bar: three dots, the file name, LIVE
    var bar = Math.max(3, Math.round(6 * s));
    r(g, x, y, fw, bar, IND);
    px(g, x + 2, y + 1, RED2); px(g, x + 4, y + 1, YEL); px(g, x + 6, y + 1, LGRN);
    if (s > 0.8) {
      tiny(g, 'TOWN', x + 10, y + 1, PALE);
      var live = !calm && Math.floor(t * 2) % 2 ? LGRN : GRN;
      px(g, x + fw - 19, y + 2, live); px(g, x + fw - 18, y + 2, live); px(g, x + fw - 19, y + 3, live); px(g, x + fw - 18, y + 3, live);
      tiny(g, 'LIVE', x + fw - 16, y + 1, LGRN);
    }
    if (u <= 0) return;
    // the page: a header with a crown, a hero with the tower, text, one button
    var ix = x + Math.round(3 * s), iw = fw - Math.round(6 * s), iy = y + bar + Math.round(2 * s);
    var hh = Math.max(2, Math.round(5 * s));
    r(g, ix, iy, iw, hh, RED);
    r(g, ix + 1, iy + 1, Math.max(2, Math.round(4 * s)), Math.max(1, hh - 2), YEL);
    for (var n = 0; n < 3; n++) r(g, ix + iw - Math.round((6 + n * 6) * s), iy + Math.floor(hh / 2), Math.max(1, Math.round(4 * s)), 1, WHT);
    var gap = Math.max(1, Math.round(3 * s));
    var hy = iy + hh + gap, heroH = Math.max(3, Math.round(12 * s));
    r(g, ix, hy, iw, heroH, BLU2);
    r(g, ix, hy + heroH - Math.max(1, Math.round(3 * s)), iw, Math.max(1, Math.round(3 * s)), GRN);
    var tcx = ix + Math.round(iw * 0.7);
    r(g, tcx - Math.round(2 * s), hy + Math.round(3 * s), Math.max(2, Math.round(4 * s)), heroH - Math.round(3 * s), PALE);
    r(g, tcx - Math.round(3 * s), hy + Math.round(2 * s), Math.max(2, Math.round(6 * s)), Math.max(1, Math.round(2 * s)), RED);
    var ty = hy + heroH + gap;
    r(g, ix, ty, Math.round(iw * 0.6), 1, GRY); r(g, ix, ty + Math.max(2, Math.round(3 * s)), Math.round(iw * 0.45), 1, GRY);
    var bw = Math.max(4, Math.round(16 * s)), bh = Math.max(2, Math.round(5 * s));
    var by = Math.min(y + fh - bh - Math.round(2 * s), ty + Math.round(6 * s));
    r(g, ix, by, bw, bh, BLU); r(g, ix + 2, by + Math.floor(bh / 2), Math.max(1, bw - 4), 1, WHT);
    // the spacing shows on hover, like it does in the real thing
    if (s > 0.8 && (calm || Math.floor(t / 1.5) % 2 === 0)) {
      var mx = ix + Math.round(iw * 0.35);
      r(g, mx, iy + hh, 1, gap, RED2); r(g, mx - 1, iy + hh, 3, 1, RED2); r(g, mx - 1, hy - 1, 3, 1, RED2);
      r(g, mx + 2, iy + hh - 2, 9, 7, RED2); tiny(g, '16', mx + 3, iy + hh - 1, WHT);
    }
    // the team's cursors, gliding about
    if (u >= 1) {
      FILE_CURSORS.forEach(function (col, i) {
        var a = calm ? i * 2.1 : t * (0.7 + i * 0.23) + i * 2.1;
        var qx = Math.round(x + fw * (0.5 + Math.cos(a) * 0.32)), qy = Math.round(y + fh * (0.55 + Math.sin(a * 1.3) * 0.28));
        arrow(g, qx, qy, col);
        if (s > 0.8) r(g, qx + 4, qy + 6, 5, 3, col);
      });
    }
  }
  function arrow(g, x, y, col) {
    var rows = ['c....', 'cc...', 'ccc..', 'cccc.', 'ccccc', 'cc...', 'c.c..'];
    rows.forEach(function (row, j) { for (var i = 0; i < row.length; i++) if (row[i] === 'c') { px(g, x + i, y + j, col); } });
    px(g, x - 1, y, WHT); px(g, x - 1, y + 6, WHT);
  }

  // Once merged, the file stays with Sam: it hovers by his shoulder (smaller while he plays).
  // Where it is drawn is cosmetic (w.kingdomFx.file eases toward it); the story state is w.state.merged.
  function drawLivingFile(g, w, camX, t) {
    var k = w.state.merged || 0;
    if (k < 1) return;
    var sam = w.actors.SAM;
    var home = { x: FILE.x, y: FILE.y + FILE.h / 2, s: 1 };
    var want = home;
    if (sam && sam.visible && (w.mode === 'play' || Math.abs(sam.x - M.scriptorium) > 40)) {
      var small = w.mode === 'play';
      want = { x: sam.x - (sam.facing || 1) * (small ? 16 : 30), y: G + (sam.y || 0) - (small ? 62 : 76), s: small ? 0.5 : 0.85 };
    }
    var kfx = w.kingdomFx || (w.kingdomFx = { smoke: 0, leaf: 0 });
    var f = kfx.file;
    if (!f || t - f.time > 0.5 || t < f.time || w.reduced) f = kfx.file = { x: want.x, y: want.y, s: want.s, time: t };
    var dt = Math.min(0.1, t - f.time);
    f.time = t;
    var ease = Math.min(1, dt * 6);
    f.x += (want.x - f.x) * ease; f.y += (want.y - f.y) * ease; f.s += (want.s - f.s) * ease;
    var x = f.x - camX;
    if (x < -60 || x > W + 60) return;
    drawFile(g, w, x, f.y, 1, f.s, t);
  }

  // ------------------------------------------------------------ [cursors appear]
  var COLORS = ['#d95763', '#5b6ee1', '#6abe30', '#df7126', '#76428a', '#37946e', '#ac3232', '#d77bba'];
  var NAMES = ['ADA', 'OTTO', 'BRAM', 'ELSA', 'GUS', 'IVY', 'RUFUS', 'MAUD'];
  function drawCursors(g, w, camX, t) {
    var k = w.state.cursors || 0;
    if (!k || !MS.props || !MS.props.cursor || !MS.ui) return;
    var i = 0;
    w.ids.forEach(function (id) {
      var a = w.actors[id];
      if (!a.visible || id === 'SAM') return;
      var n = i++;
      if (k < 1 && (n / 8) > k) return;
      var sx = a.x - camX;
      if (sx < -40 || sx > W + 40) return;
      var col = COLORS[n % COLORS.length];
      var bob = w.reduced ? 0 : Math.round(Math.sin(t * 2.4 + n) * 2);
      var x = Math.round(sx + 6 + Math.cos(t * 1.3 + n) * (w.reduced ? 0 : 3));
      var y = MS.ui.headY(w, a) - 18 - (n % 2) * 12 + bob;
      g.drawImage(MS.props.cursor(col, NAMES[n % NAMES.length]), x, y);
    });
  }

  function drawFront(g, w, camX, t) {
    drawMerge(g, w, camX, t);
    drawLivingFile(g, w, camX, t);
    drawCursors(g, w, camX, t);
  }

  // Cosmetic only: chimney smoke and a few leaves on the wind.
  function update(w, dt) {
    if (w.reduced || !w.fx) return;
    var fx = w.kingdomFx || (w.kingdomFx = { smoke: 0, leaf: 0 });
    fx.smoke -= dt;
    if (fx.smoke <= 0 && CHIMNEYS.length) {
      fx.smoke = 0.35;
      CHIMNEYS.forEach(function (c) {
        if (c[0] < w.camera.x - 10 || c[0] > w.camera.x + W + 10 || Math.random() > 0.5) return;
        w.fx.particles.push({ x: c[0] + (Math.random() - 0.5) * 2, y: c[1], vx: 4 + Math.random() * 3, vy: -9, g: -2, life: 2.2, color: Math.random() > 0.5 ? PALE : GB, size: 3, kind: 'puff', floor: false });
      });
    }
    fx.leaf -= dt;
    if (fx.leaf <= 0) {
      fx.leaf = 0.9 + Math.random() * 1.4;
      w.fx.particles.push({ x: w.camera.x + W + 4, y: 20 + Math.random() * 70, vx: -24 - Math.random() * 14, vy: 6, g: 4, life: 6, color: Math.random() > 0.5 ? GRN : MUS, size: 1, floor: false });
    }
  }

  // ------------------------------------------------------------ the set
  MS.sets = MS.sets || {};
  MS.sets.kingdom = {
    name: 'kingdom', era: 'medieval', width: WIDTH, ground: G, camera: 700, entry: 40, bg: BLU0,
    haze: '#9badb7',
    music: 'kingdom', crowd: 'VILLAGERS',
    marks: {
      gate: M.gate, 'town gate': M.gate, post: 270, 'royal post': 270, stable: 270, well: M.well, 'notice board': BOARD.x + BOARD.w / 2,
      board: BOARD.x + BOARD.w / 2, notices: BOARD.x + BOARD.w / 2, tavern: 890, market: M.market, stalls: M.market,
      square: M.square, cross: M.square, scriptorium: M.scriptorium, desk: DESK_X, tower: M.tower,
      'six drawings': 1420, yard: 1500, tents: 1640, bridge: BRIDGE.x + BRIDGE.w / 2, moat: BRIDGE.x + BRIDGE.w / 2,
      castle: M.castle, 'castle gate': M.castle
    },
    // The villagers and the knight gather on the square: in frame both at the market and in
    // the opening tower pan. The scribe works at his desk outside the scriptorium, facing the
    // street; the mason stands by his tower; the king waits at his gate beside the drawing.
    cast: {
      SAM: { names: ['SAM'], costume: 'sam2', x: -40, visible: false },
      VILLAGER1: { names: ['VILLAGER 1', 'PEASANT'], costume: 'villager1', x: 1116, groups: ['VILLAGERS'] },
      VILLAGER3: { names: ['VILLAGER 3'], costume: 'villager3', x: 1134, z: -1, groups: ['VILLAGERS'] },
      VILLAGER2: { names: ['VILLAGER 2'], costume: 'villager2', x: 1154, facing: -1, groups: ['VILLAGERS'] },
      KNIGHT: { names: ['KNIGHT', 'THE KNIGHT'], costume: 'knight', x: 1176, facing: -1 },
      SCRIBE: { names: ['SCRIBE', 'THE SCRIBE'], costume: 'scribe', x: SCRIBE_X, facing: -1, anim: 'work', groups: ['SCRIBES'] },
      MASON: { names: ['MASON', 'THE MASON'], costume: 'mason', x: MASON_X, facing: -1 },
      KING: { names: ['KING', 'THE KING'], costume: 'king', x: KING_X, facing: -1 }
    },
    events: [
      { id: 'cursors', match: /^(?:the )?(?:multiplayer )?cursors (appear|vanish|disappear)$/ },
      { id: 'merge', match: /^(?:the |all the |all )?(?:scrolls|copies|versions|mockups) (?:merge|merges|combine|unite|become one)$/ }
    ],
    eventsById: {
      cursors: { run: function (w, args, Task) {
        var on = args[0] === 'appear', pinged = false;
        return new Task(on ? 1.2 : 0.3, function (t) {
          w.state.cursors = on ? Math.min(1, t / 1.2) : Math.max(0, 1 - t / 0.3);
          if (on && !pinged && !w.instant) { pinged = true; w.sfx('sparkle'); }
        }, function () { w.state.cursors = on ? 1 : 0; });
      } },
      // Every hand-copied version flies together into one glowing living file.
      // Deterministic: finish() snaps to merged = 1; the flight itself is drawn from the progress.
      merge: { run: function (w, args, Task) {
        var cues = {};
        function cue(name, k, fn) { if (!cues[name] && w.state.merged >= k) { cues[name] = true; if (!w.instant) fn(); } }
        return new Task(MERGE_DUR, function (t) {
          w.state.merged = Math.min(0.999, t / MERGE_DUR);
          cue('go', 0, function () { w.sfx('build'); });
          cue('core', FLY_END, function () {
            w.sfx('sparkle');
            if (!w.reduced && w.burst) w.burst(FILE.x, FILE.y + FILE.h / 2, 16, { kind: 'spark', colors: [WHT, CYA, YEL], speed: 110, g: 0, spread: Math.PI * 2, life: 0.5, floor: false });
          });
          cue('open', CORE_END, function () { w.sfx('hologram'); });
        }, function () { w.state.merged = 1; });
      } }
    },
    initState: function () { return { cursors: 0, merged: 0 }; },
    level: { solids: SOLIDS, targets: TARGETS, spawn: spawn, update: levelUpdate, onHit: onHit },
    layers: layers, props: props, drawBack: drawBack, drawFront: drawFront, update: update
  };
})(typeof window !== 'undefined' ? window : globalThis);
