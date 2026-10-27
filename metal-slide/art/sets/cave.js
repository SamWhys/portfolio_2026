/* METAL SLIDE set: Mission 1, the Cave of Slides. A scrolling level, 2112px wide.
   16 colors, dithered, CRT scanlines. Left to right: the mine entrance, an approach strewn
   with rejected decks, propaganda of the General and cramped layout billboards, the slide
   troopers' checkpoint, the workshop where dev POWs chisel HTML into stone desks, the
   General's briefing (projector, screen, lectern), the APPENDIX vault and the run out to
   daylight. Far layers are hazed toward warm umber so the cast pops (Metal Slug values).
   Events: [slide 1] [slide 12] [slide 63] [slide 84] [staging review] [wireframe] [daylight] */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint, F = MS.font;
  var W = MS.W, H = MS.H;
  var G = 156;       // ground line: feet stand here
  var WIDTH = 2112;

  // The 16-color cave palette by role.
  var K = '#0b0810', D1 = '#1d1420', D2 = '#33242c', R1 = '#4e3a3a', R2 = '#75574a', R3 = '#a07a5c',
    SK = '#d6a77c', PA = '#f2dcb0', WH = '#fff6e0', OL1 = '#3a4630', OL2 = '#66783e', RU = '#8e2f24',
    OR = '#d9542a', YE = '#ffb840', TE1 = '#2f6e70', TE2 = '#7fd0c0';

  // ------------------------------------------------------------ the floor plan (world x)
  var A = 1076;                                    // DEV 1's seat
  var DEVS = [A, A + 42, A + 110, A + 152];        // an aisle between DEV 2 and DEV 3
  var PILES = A - 176, DESKS = A + 86;             // where the first two play segments stop
  var TROOPS = [A - 64, A - 42];                   // the checkpoint guards
  var PROJ = A + 190, GEN = A + 230, LECT = GEN + 24; // the lectern stands at his right hand
  var SCREEN = { x: A + 180, y: 36, w: 104, h: 64 };
  var BOARD = A - 86;                              // the morale board's left edge
  var VAULT = A + 352;                             // the APPENDIX door
  var EXIT = WIDTH - 40;
  var HOLES = [[1376, 22], [1520, 16], [1640, 26], [1770, 20], [1880, 24]]; // where daylight breaks in
  var MID_SPEED = 0.55;
  var MID_TORCHES = [[70, 76], [170, 70], [380, 76], [560, 70], [650, 72], [830, 74], [950, 70], [1140, 76], [1270, 72]];

  function sprite(rows, pal) { return MS.props.sprite(rows, pal, K); }
  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ------------------------------------------------------------ tiny 3x5 lettering
  // For posters, stencils and scratched graffiti. gaps (optional) adds uneven letter
  // spacing, which is the whole point of this cave.
  var TINY = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110', '?': '110001010000010', '!': '010010010000010', ':': '000010000010000', '.': '000000000000010',
    '-': '000000111000000', '/': '001001010100100', "'": '010010000000000', '%': '101001010100101', '+': '000010111010000',
    '<': '001010100010001', '>': '100010001010100', '=': '000111000111000', ',': '000000000010100'
  };
  function tiny(g, text, x, y, col, gaps) {
    g.fillStyle = col;
    text = String(text).toUpperCase();
    var cx = Math.round(x), cy = Math.round(y);
    for (var i = 0; i < text.length; i++) {
      var b = TINY[text[i]];
      if (b) for (var k = 0; k < 15; k++) if (b.charAt(k) === '1') g.fillRect(cx + k % 3, cy + Math.floor(k / 3), 1, 1);
      cx += (text[i] === ' ' ? 3 : 4) + (gaps ? gaps[i % gaps.length] : 0);
    }
    return cx - Math.round(x) - 1;
  }
  function tinyW(text) { return String(text).length * 4 - 1; }
  // The big font, one letter at a time, with uneven gaps.
  function spaced(g, text, x, y, col, gaps) {
    var cx = x;
    for (var i = 0; i < text.length; i++) { cx += F.draw(g, text[i], cx, y, col) + 1 + (gaps[i] || 0); }
  }
  MS.tinyText = MS.tinyText || tiny;

  // ------------------------------------------------------------ props
  function desk(f) {
    return once('desk' + f, function () {
      var s = f ? 'lslsllsl' : 'llslslls';
      return sprite([
        '...........mmmmmmmmmmm..',
        '..........mMMMMMMMMMMMm.',
        '..........mMssssssssMMm.',
        '..tttttt..mM' + s + 'MMm.',
        '..tTTTTt..mMssssssssMMm.',
        '..tTccTt..mMs' + s.slice(0, 6) + 'sMMm.',
        '..tTTTTt..mMssssssssMMm.',
        '..tTccTt..mMMMMMMMMMMMm.',
        '..tTTTTt...mmmmmmmmmmm..',
        '..tttttt.......mMMm.....',
        'DDDDDDDDDDDDDDDDDDDDDDDD',
        'dddddddddddddddddddddddd',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        '.LL..................LL.',
        'LLLL................LLLL'
      ], { m: D2, M: R1, s: TE1, l: TE2, t: R2, T: R3, c: R1, D: R3, d: R2, L: R1 });
    });
  }
  function stool() {
    return once('stool', function () {
      return sprite(['RRRRRRRR', 'rRRRRRRr', 'rRRRRRRr', 'rrRRRRrr', '.rRRRRr.', '.rRRRRr.', '.rRRRRr.', 'rrrrrrrr'], { R: R2, r: R1 });
    });
  }
  function lectern() {
    return once('lectern', function () {
      return sprite([
        'PPPPPPPPPPPPPP..',
        'POOOOOOOOOOOOP..',
        'PWWWWWWWWWWWWPw.',
        'PWkkkWWWkkkWWPww',
        'PWWWWWWWWWWWWPww',
        'PPPPPPPPPPPPPPww',
        '.wwwwwwwwwwwwwww',
        '..BBBBBBBBBBBB..',
        '..BbbbbbbbbbbB..',
        '..BbBBBBBBBBbB..',
        '..BbBYYYYYYBbB..',
        '..BbBYOOOOYBbB..',
        '..BbBYYYYYYBbB..',
        '..BbBBBBBBBBbB..',
        '..BbBBBBBBBBbB..',
        '..BbBBBBBBBBbB..',
        '..BbbbbbbbbbbB..',
        '.BBBBBBBBBBBBBB.',
        'bbbbbbbbbbbbbbbb'
      ], { P: R1, O: OR, W: PA, k: R2, w: R1, B: R2, b: R1, Y: YE });
    });
  }
  function projector() {
    return once('projector', function () {
      return sprite([
        '...gggggggg...',
        '..gGGGGGGGGg..',
        '..gGGGGGGGGgLL',
        '..gGGGGGGGGgLL',
        '..gggggggggg..',
        'CCCCCCCCCCCCCC',
        'CccCCCCCCCCccC',
        'CCCCCCCCCCCCCC',
        'CccCCCCCCCCccC',
        'CCCCCCCCCCCCCC',
        'cccccccccccccc'
      ], { g: D2, G: R1, L: TE2, C: R2, c: R1 });
    });
  }
  // General Bulletpoint's face, for the propaganda posters.
  function generalFace() {
    return once('genface', function () {
      return sprite([
        '..CCCCCCCC..',
        '.CCCCYYCCCC.',
        'CCCCCCCCCCCC',
        '.BBBBBBBBBB.',
        '.SSSSSSSSSS.',
        '.SKKSSSSKKS.',
        '.SSESSSSESS.',
        '.SSSSNNSSSS.',
        'MMMMMSSMMMMM',
        'M.SSRRRRSS.M',
        '..SSSRRSSS..',
        '...UUUUUU...',
        '..UUUYYUUU..'
      ], { C: OL1, Y: YE, B: D1, S: SK, K: D1, E: K, N: R3, M: R3, R: RU, U: OL2 });
    });
  }

  // ------------------------------------------------------------ the level: things to jump
  // Each solid is drawn by this set, exactly over its collision box (h <= 28).
  var SOLIDS = [
    // the approach: entrance to the deck piles
    { x: 168, w: 18, h: 10, kind: 'decks' },
    { x: 352, w: 18, h: 8, kind: 'fire' },        // a burning slide pile, troopers roasting marshmallows
    { x: 478, w: 22, h: 20, kind: 'crate' },
    { x: 690, w: 26, h: 22, kind: 'pile' },
    // the checkpoint, into the workshop
    { x: 956, w: 26, h: 18, kind: 'barricade' },
    // the run out to daylight
    { x: 1500, w: 22, h: 12, kind: 'rocks' },
    { x: 1720, w: 30, h: 18, kind: 'cart' },
    { x: 1860, w: 22, h: 26, kind: 'crates' }
  ];

  // Things to blast. Billboards sit at blaster height (Sam's muzzle is 23px above his
  // feet, y 133); the checkpoint's hang higher, so you jump to hit them. The two mockups
  // over the far desks lie past the desks mark: they wait for [blast the layouts].
  var TARGETS = [
    { id: 'cave-bill1', x: 226, y: 110, w: 28, h: 22, kind: 'layout', label: '8PX GRID', mount: 'post' },
    { id: 'cave-slide1', x: 424, y: 120, w: 14, h: 12, kind: 'slide', label: '8PX' },
    { id: 'cave-bill2', x: 584, y: 108, w: 32, h: 24, kind: 'layout', label: 'GRID', mount: 'post' },
    { id: 'cave-bill3', x: 764, y: 110, w: 28, h: 22, kind: 'layout', label: '8PX', mount: 'post' },
    { id: 'cave-slide2', x: 1040, y: 108, w: 14, h: 12, kind: 'slide', label: '8PX' },
    { id: 'cave-wall1', x: A + 30, y: 86, w: 26, h: 20, kind: 'layout', label: 'PADDING!', mount: 'rope' },
    { id: 'cave-wall2', x: A + 92, y: 58, w: 26, h: 20, kind: 'layout', label: '8PX', mount: 'chain' },
    { id: 'cave-wall3', x: A + 134, y: 56, w: 28, h: 22, kind: 'layout', label: '8PX GRID', mount: 'chain' },
    { id: 'cave-bill4', x: 1600, y: 110, w: 28, h: 22, kind: 'layout', label: '8PX', mount: 'post' },
    { id: 'cave-slide3', x: 1800, y: 120, w: 14, h: 12, kind: 'slide', label: '8PX' },
    { id: 'cave-bill5', x: 1934, y: 108, w: 32, h: 24, kind: 'layout', label: 'GRID', mount: 'post' }
  ];

  // Loafing slide troopers, met ahead of Sam. They scream and run when they notice him.
  var EXTRAS = [
    { id: 'cave-roast1', costume: 'trooper', x: 334, facing: 1, loaf: 'sit', held: 'marshmallow', line: 'MY MARSHMALLOW!' },
    { id: 'cave-roast2', costume: 'trooper2', x: 388, facing: -1, loaf: 'sit', held: 'marshmallow', line: 'A DESIGNER?!' },
    { id: 'cave-lobber1', costume: 'trooper', x: 636, facing: -1, thrower: true, line: 'OUT OF SLIDES!' },
    { id: 'cave-overseer', costume: 'trooper2', x: 1148, facing: -1, loaf: 'laughpoint', line: 'NOT THE GRID!' },
    { id: 'cave-gossip', costume: 'trooper2', x: 1662, facing: -1, loaf: 'gossip', line: 'HE SAID SIXTEEN!' },
    { id: 'cave-sunbather', costume: 'trooper', x: 1828, facing: 1, loaf: 'sit', line: 'MY TAN!' },
    { id: 'cave-lobber2', costume: 'trooper', x: 1992, facing: -1, thrower: true, line: 'TAKE THE APPENDIX!' }
  ];

  function spawn(w, fromX, toX) {
    if (!MS.enemies || !MS.enemies.make) return [];
    return EXTRAS.filter(function (e) { return e.x > fromX + 40 && e.x < toX + 60; }).map(function (e) {
      return MS.enemies.make(e.id, { costume: e.costume, x: e.x, facing: e.facing, loaf: e.loaf, thrower: e.thrower, held: e.held, line: e.line });
    });
  }

  // The checkpoint guards cower as Sam charges past them with the blaster.
  function levelUpdate(w, dt, play) {
    var sam = w.actors.SAM;
    if (!sam || !play) return;
    ['TROOPER1', 'TROOPER2'].forEach(function (id) {
      var a = w.actors[id];
      if (!a || !a.visible || a.playAnim) return;
      var near = Math.abs(sam.x - a.x) < 70;
      var shot = (play.shots || []).some(function (s) { return Math.abs(s.x - a.x) < 22; });
      if (near || shot) { a.playAnim = 'cower'; if (!w.instant) w.emote(id, 'sweat'); }
    });
  }

  function onHit(w, t) {
    if (w.instant || !w.burst) return;
    var y = t.y != null ? t.y : w.ground - t.h;
    if (t.kind === 'layout') w.burst(t.x + t.w / 2, y + t.h / 2, 6, { kind: 'chip', colors: [R3, PA, R2], speed: 70, g: 300, life: 0.6, size: 1 });
  }

  // ------------------------------------------------------------ solids, drawn to match their boxes
  function outline(c, ink) {
    var g = c.getContext('2d');
    var img = g.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
    var on = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) on[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    g.fillStyle = ink;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (on[y * w + x]) continue;
      if ((x > 0 && on[y * w + x - 1]) || (x < w - 1 && on[y * w + x + 1]) || (y > 0 && on[(y - 1) * w + x]) || (y < h - 1 && on[(y + 1) * w + x])) g.fillRect(x, y, 1, 1);
    }
  }
  var PAINT = {
    decks: function (r, w, h, rnd) {
      for (var y = h; y > 0; y -= 4) {
        var bw = w - Math.round(rnd() * 4), bx = Math.round(rnd() * (w - bw));
        var top = Math.max(0, y - 4);
        r(bx, top, bw, y - top, PA);
        r(bx, top, bw, 1, rnd() > 0.5 ? OR : RU);
        r(bx, y - 1, bw, 1, R3);
        r(bx + Math.floor(bw / 2), top, 1, y - top, R1);
      }
    },
    fire: function (r, w, h, rnd) {
      for (var x = 0; x < w; x++) {
        var top = Math.round(2 + Math.abs(x - w / 2) / (w / 2) * 4 + rnd());
        r(x, top, 1, h - top, x % 3 ? PA : R3);
        r(x, h - 2, 1, 2, D2);
        if (rnd() > 0.6) r(x, top, 1, 1, OR);
      }
      r(2, h - 3, w - 4, 1, R1);
    },
    crate: function (r, w, h, rnd) {
      r(0, 0, w, h, R2);
      for (var y = 4; y < h; y += 5) r(0, y, w, 1, R1);
      r(0, 0, w, 1, R3); r(0, 0, 2, h, R3); r(w - 2, 0, 2, h, R1);
      r(2, 1, w - 4, 1, SK);
      tiny(this.g, 'DECK', this.ox + Math.floor((w - 15) / 2), this.oy + Math.floor(h / 2) - 2, PA);
    },
    pile: function (r, w, h, rnd) {
      for (var x = 0; x < w; x++) {
        var k = Math.sin((x + 0.5) / w * Math.PI);
        var top = Math.round(h - h * Math.pow(k, 0.6) + rnd() * 2);
        r(x, top, 1, h - top, rnd() > 0.3 ? PA : R3);
        for (var y = top + 2; y < h; y += 3) if (rnd() > 0.55) r(x, y, 1, 1, rnd() > 0.5 ? OR : R2);
        r(x, top, 1, 1, WH);
      }
      r(Math.floor(w / 2) - 5, Math.floor(h / 2), 11, 5, RU);
      tiny(this.g, 'NO', this.ox + Math.floor(w / 2) - 3, this.oy + Math.floor(h / 2), PA);
    },
    barricade: function (r, w, h, rnd) {
      for (var row = 0; row * 6 < h; row++) {
        var y = h - (row + 1) * 6, off = row % 2 ? 4 : 0;
        for (var x = -off; x < w; x += 9) {
          var bx = Math.max(0, x), bw = Math.min(8, w - bx, x + 8 - bx);
          if (bw < 2) continue;
          r(bx, Math.max(0, y + 1), bw, 5, PA);
          r(bx, Math.max(0, y + 1), bw, 1, WH);
          r(bx, y + 5, bw, 1, R3);
          if (bw >= 6) r(bx + 2, y + 3, 3, 1, OR);
        }
      }
      r(0, 0, w, 2, YE);
      for (var s = 0; s < w; s += 6) r(s, 0, 3, 2, RU);
    },
    rocks: function (r, w, h, rnd) {
      [[0, 0.75], [0.38, 1], [0.7, 0.6]].forEach(function (b) {
        var bx = Math.round(b[0] * w), bw = Math.round(w * 0.42), bh = Math.round(h * b[1]);
        for (var y = 0; y < bh; y++) {
          var k = Math.sqrt(1 - Math.pow(1 - y / bh, 2));
          var ww = Math.max(2, Math.round(bw * (0.55 + 0.45 * k)));
          var x0 = bx + Math.round((bw - ww) / 2);
          r(x0, h - bh + y, ww, 1, y < 2 ? R3 : y > bh - 3 ? R1 : R2);
          r(x0, h - bh + y, 1, 1, R3);
        }
      });
    },
    cart: function (r, w, h, rnd) {
      for (var x = 2; x < w - 2; x += 3) r(x, 0, 2, 6, rnd() > 0.5 ? PA : WH);
      for (var x2 = 3; x2 < w - 3; x2 += 5) r(x2, 0, 3, 1, OR);
      r(0, 5, w, 2, R3);
      r(1, 7, w - 2, h - 12, R1);
      r(3, 8, w - 6, h - 14, R2);
      for (var rv = 2; rv < w - 2; rv += 6) r(rv, 9, 1, 1, SK);
      [5, w - 10].forEach(function (wx) { r(wx, h - 5, 5, 5, D2); r(wx + 1, h - 4, 3, 3, R1); r(wx + 2, h - 3, 1, 1, R3); });
    },
    crates: function (r, w, h, rnd) {
      var hb = Math.round(h * 0.55);
      r(0, h - hb, w, hb, R2); r(0, h - hb, w, 1, R3); r(0, h - hb, 2, hb, R3); r(w - 2, h - hb, 2, hb, R1);
      for (var y = h - hb + 5; y < h; y += 5) r(0, y, w, 1, R1);
      var tw = w - 6;
      r(2, 0, tw, h - hb, R2); r(2, 0, tw, 1, R3); r(2, 0, 2, h - hb, R3); r(tw, 0, 2, h - hb, R1);
      r(2, h - hb - 1, tw, 1, R1);
      tiny(this.g, 'PPT', this.ox + 5, this.oy + Math.floor((h - hb) / 2) - 2, OR);
      tiny(this.g, 'V9', this.ox + 4, this.oy + h - hb + 3, PA);
    }
  };
  function solidImg(s) {
    return once('solid:' + s.kind + ':' + s.x, function () {
      var c = canvas(s.w + 2, s.h + 1), g = c.getContext('2d');
      var ctx = { g: g, ox: 1, oy: 1 };
      function r(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w), Math.round(h)); }
      PAINT[s.kind].call(ctx, r, s.w, s.h, MS.util.rng(s.x * 13 + s.w));
      outline(c, K);
      return c;
    });
  }
  function flame(g, x, y, t, seed, big) {
    var f = Math.floor(t * 9 + seed) % 3;
    var h = [7, 8, 6][f] + (big || 0), sw = [0, 1, -1][f];
    P.rect(g, x - 2, y - h + 4, 5, h - 3, OR);
    P.rect(g, x - 1 + sw, y - h, 3, h - 1, YE);
    P.rect(g, x + sw, y - h - 1, 1, 2, WH);
    P.rect(g, x - 1, y - 2, 3, 2, YE);
  }
  // The campfire: flames over the burning deck, and the roasting sticks while anyone's roasting.
  function campfire(g, sx, s, w, t) {
    var cx = sx + Math.floor(s.w / 2), top = G - s.h + 2;
    flame(g, cx - 4, top + 2, t, 0, 1);
    flame(g, cx + 3, top + 1, t, 1.3, 3);
    flame(g, cx, top, t, 2.1, 5);
    var p = w.play;
    if (!p || !p.extras) return;
    p.extras.forEach(function (e) {
      if (e.state !== 'loaf' || !/^cave-roast/.test(e.id)) return;
      var hx = Math.round(e.x - s.x + sx + e.facing * 6), hy = G - 18;
      var tx = cx - e.facing * 3, ty = top - 4;
      var n = Math.max(Math.abs(tx - hx), Math.abs(ty - hy));
      g.fillStyle = R1;
      for (var i = 0; i <= n; i++) g.fillRect(Math.round(hx + (tx - hx) * i / n), Math.round(hy + (ty - hy) * i / n), 1, 1);
      P.rect(g, tx - 1, ty - 1, 3, 3, Math.floor(t * 2 + e.x) % 4 ? WH : SK);
    });
  }

  var props = [];
  DEVS.forEach(function (x, i) {
    props.push({ x: x, z: -1, draw: function (g, sx) { g.drawImage(stool(), sx - 6, G - 11); } });
    props.push({ x: x + 16, z: 1, draw: function (g, sx, w, t) {
      var f = Math.floor(t * 2 + i * 0.7) % 2;
      g.drawImage(desk(f), sx - 13, G - 23);
    } });
  });
  props.push({ x: PROJ, z: -1, draw: function (g, sx) { g.drawImage(projector(), sx - 8, G - 13); } });
  props.push({ x: LECT, z: 1, draw: function (g, sx) { g.drawImage(lectern(), sx - 9, G - 20); } });
  SOLIDS.forEach(function (s) {
    props.push({ x: s.x, z: -1, draw: function (g, sx, w, t) {
      g.drawImage(solidImg(s), sx - 1, G - s.h - 1);
      if (s.kind === 'fire') campfire(g, sx, s, w, t);
    } });
  });

  // ------------------------------------------------------------ painting helpers
  function column(g, rnd, x, w, top, bottom, dark, mid, lit, side) {
    for (var y = top; y < bottom; y++) {
      var wob = Math.round(Math.sin(y * 0.09 + x) * 2 + (rnd() - 0.5) * 1.5);
      var ww = w + wob;
      P.rect(g, x - ww / 2, y, ww, 1, mid);
      P.rect(g, x - ww / 2, y, 2, 1, dark);
      if (lit) P.rect(g, x + (side > 0 ? ww / 2 - 3 : -ww / 2 + 2), y, 2, 1, lit);
    }
    for (var i = 0; i < w / 4; i++) {
      var cy = top + rnd() * (bottom - top), cx = x - w / 2 + 4 + rnd() * (w - 8);
      P.rect(g, cx, cy, 1, 3 + rnd() * 5, dark);
    }
  }
  // A lumpy boulder outcrop.
  function boulder(g, rnd, x, y, w, h, base, dark, lit) {
    for (var yy = 0; yy < h; yy++) {
      var k = Math.sqrt(1 - Math.pow(1 - yy / h, 2));
      var ww = Math.round(w * (0.5 + 0.5 * k) + (rnd() - 0.5) * 2);
      var x0 = x + Math.round((w - ww) / 2);
      P.rect(g, x0, y + yy, ww, 1, base);
      P.rect(g, x0, y + yy, 2, 1, lit);
      P.rect(g, x0 + ww - 2, y + yy, 2, 1, dark);
    }
    for (var i = 0; i < w / 5; i++) P.rect(g, x + 3 + rnd() * (w - 6), y + 3 + rnd() * (h - 4), 2 + rnd() * 3, 1, dark);
  }
  // A torn sheet of paper pinned up: paper, a dog-ear, a nail.
  function sheet(g, x, y, w, h, torn) {
    var cut = torn ? 9 : 0;
    for (var yy = 0; yy < h; yy++) {
      var ww = yy < h - cut ? w : w - (yy - (h - cut)) - 1;   // the torn corner is missing
      P.rect(g, x + 1, y + yy + 1, ww, 1, D2);
      P.rect(g, x, y + yy, ww, 1, PA);
    }
    P.rect(g, x, y + h - 1, w - cut, 1, SK);
    if (torn) for (var j = 0; j < 6; j++) P.rect(g, x + w - cut - 1 + j, y + h - 1 - j, 1, 1, R3); // the ragged edge
    P.rect(g, x + Math.floor(w / 2) - 1, y + 1, 2, 2, R1);
  }
  // A propaganda poster of the General, slogan set with dreadful spacing.
  function poster(g, x, y, lines, gaps) {
    P.rect(g, x + 1, y + 1, 30, 40, D2);
    P.rect(g, x, y, 30, 40, PA);
    P.rect(g, x, y, 30, 18, OR);
    P.rect(g, x, y, 30, 1, YE);
    P.rect(g, x + 1, y + 39, 29, 1, SK);
    g.drawImage(generalFace(), x + 8, y + 3);
    lines.forEach(function (l, i) { tiny(g, l, x + 3 + (i % 2) * 2, y + 22 + i * 7, i === lines.length - 1 ? RU : R1, gaps); });
    P.rect(g, x + 14, y + 1, 2, 2, R1);
  }
  // A big stacked mound of rejected decks, with sticky notes.
  function deckMound(g, rnd, x, w, h) {
    for (var c = 0; c < w; c += 3) {
      var k = Math.sin((c + 1.5) / w * Math.PI);
      var top = G - 10 - Math.round(h * Math.pow(k, 0.7) + rnd() * 4);
      for (var y = top; y < G - 8; y += 3) {
        P.rect(g, x + c, y, 3, 2, rnd() > 0.15 ? PA : WH);
        P.rect(g, x + c, y + 2, 3, 1, rnd() > 0.5 ? R3 : SK);
        if (rnd() > 0.7) P.rect(g, x + c, y, 3, 1, rnd() > 0.5 ? OR : RU);
      }
    }
    for (var n = 0; n < w / 14; n++) {
      var nx = x + 6 + rnd() * (w - 16), ny = G - 22 - rnd() * h * 0.6;
      P.rect(g, nx, ny, 7, 6, YE); P.rect(g, nx + 1, ny + 2, 5, 1, R3); P.rect(g, nx + 1, ny + 4, 3, 1, R3);
    }
  }

  // ------------------------------------------------------------ layers
  var layers = [
    // Far: the back wall of the great cavern. Painted mid-brown and baked toward the haze.
    { speed: 0.25, paint: function (g, w, h) {
      var rnd = MS.util.rng(7);
      P.vgrad(g, 0, 0, w, h, [[0, D1], [0.22, D2], [0.45, R1], [0.62, R2], [0.74, R1], [1, D2]]);
      for (var i = 0; i < 10; i++) P.radial(g, 30 + i * 80 + rnd() * 30, 92 + rnd() * 34, 56 + rnd() * 30, 'rgba(214,150,96,0.32)');
      for (var s = 0; s < 90; s++) P.rect(g, rnd() * w, 26 + rnd() * 116, 8 + rnd() * 46, 1, rnd() > 0.5 ? D2 : R1);
      for (var c = 0; c < 9; c++) column(g, rnd, 20 + c * 92 + rnd() * 40, 16 + rnd() * 22, 0, 146, D2, R1, R2, rnd() > 0.5 ? 1 : -1);
      // a giant slide carved into the far wall, years ago: "SLIDE 1 OF 412"
      var cx = 300;
      P.rect(g, cx, 40, 76, 50, R2); P.rect(g, cx + 2, 42, 72, 46, R3); P.rect(g, cx + 2, 42, 72, 8, R1);
      for (var l = 0; l < 4; l++) P.rect(g, cx + 8, 56 + l * 7, 30 + (l * 13) % 24, 2, R2);
      tiny(g, '1/412', cx + 50, 80, R1);
      // a thin waterfall down the far wall, and the pool it makes
      for (var y = 20; y < 140; y++) { P.rect(g, 612 + Math.round(Math.sin(y * 0.3) * 0.6), y, 3, 1, TE1); if (y % 3 === 0) P.rect(g, 613, y, 1, 1, TE2); }
      P.rect(g, 596, 136, 36, 3, TE1);
      // ceiling and floor
      P.ridge(g, rnd, 0, w, 20, 5, 3, D1, { ceiling: true });
      for (var k = 0; k < 34; k++) P.spike(g, rnd() * w, 14 + rnd() * 8, 4 + rnd() * 6, 10 + rnd() * 24, D1, true);
      P.ridge(g, rnd, 0, w, 138, 3, 4, R1);
    } },
    // Mid: rock columns lit by the torches, mine scaffolding, banners, junked monitors.
    // The torch flames and their glow are drawn live right after it, behind the near layer.
    { speed: MID_SPEED, after: drawTorches, paint: function (g, w, h) {
      var rnd = MS.util.rng(21);
      for (var x = 40; x < w; x += 150 + Math.round(rnd() * 60)) column(g, rnd, x, 28 + rnd() * 14, 0, 150, D1, D2, R1, rnd() > 0.5 ? 1 : -1);
      // mine scaffolding: a long beam and its posts
      P.rect(g, 0, 30, w, 5, R1); P.rect(g, 0, 30, w, 1, R2); P.rect(g, 0, 34, w, 1, D1);
      for (var px = 120; px < w; px += 190) { P.rect(g, px, 30, 5, 120, R1); P.rect(g, px, 30, 1, 120, R2); P.rect(g, px + 4, 30, 1, 120, D1); P.rect(g, px - 6, 60, 17, 2, R1); }
      // banners: the General's slogans
      function banner(bx, bw, l1, l2, cloth) {
        P.rect(g, bx, 35, bw, 28, cloth); P.rect(g, bx, 35, bw, 2, '#a83a2a');
        for (var b = 0; b < bw; b += 5) P.rect(g, bx + b, 63, 3, 2, cloth);
        F.drawCentered(g, l1, bx + bw / 2, 39, PA);
        if (l2) F.drawCentered(g, l2, bx + bw / 2, 50, YE);
      }
      banner(616, 64, 'SHIP IT', 'FRIDAY!!', RU);
      banner(214, 76, 'THE DECK', 'IS THE SPEC', RU);
      banner(1020, 70, 'MAKE IT', 'POP!', OL1);
      // chains hanging from the beam
      [150, 470, 600, 900, 1170, 1310].forEach(function (x) { for (var y = 35; y < 90 + (x % 3) * 8; y += 3) P.rect(g, x, y, 1, 2, R1); });
      // stacks of dead monitors
      [[60, 126], [380, 126], [394, 126], [387, 114], [840, 128], [1150, 126], [1164, 126], [1157, 114]].forEach(function (m) {
        P.rect(g, m[0], m[1], 13, 11, D2); P.rect(g, m[0] + 2, m[1] + 2, 9, 6, TE1); P.rect(g, m[0] + 3, m[1] + 3, 2, 1, TE2);
      });
      // ore carts of slides on a mid ledge
      [[520, 132], [980, 134]].forEach(function (c) {
        P.rect(g, c[0], c[1] - 4, 22, 4, PA); P.rect(g, c[0] + 2, c[1] - 5, 5, 1, OR);
        P.rect(g, c[0], c[1], 22, 7, R1); P.rect(g, c[0], c[1], 22, 1, R2);
        P.rect(g, c[0] + 3, c[1] + 7, 4, 3, D1); P.rect(g, c[0] + 15, c[1] + 7, 4, 3, D1);
      });
      // torch brackets (the flames are drawn live)
      MID_TORCHES.forEach(function (t) { P.rect(g, t[0] - 1, t[1], 3, 10, R1); P.rect(g, t[0] - 3, t[1] - 2, 7, 3, R2); });
      P.ridge(g, rnd, 0, w, 146, 2, 5, D2);
    } },
    // Near: the walls right behind the playfield, the signs, the floor.
    { speed: 1, paint: paintNear },
    // Front: stalactites and rocks passing close to the camera.
    { speed: 1.35, front: true, dither: 1, paint: function (g, w, h) {
      var rnd = MS.util.rng(55);
      for (var x = 20; x < w; x += 110 + rnd() * 120) P.spike(g, x, 0, 10 + rnd() * 16, 12 + rnd() * 24, K, true, D1);
      for (var r = 90; r < w; r += 260 + rnd() * 220) {
        var s = 16 + Math.round(rnd() * 18);
        for (var y = 0; y < s; y++) {
          var ww = Math.round(s * 1.6 * Math.sqrt(1 - Math.pow(1 - y / s, 2)));
          P.rect(g, r - ww / 2, H - y, ww, 1, K);
          if (y > s - 3) P.rect(g, r - ww / 2, H - y, ww, 1, D1);
        }
      }
    } }
  ];

  function paintNear(g, w, h) {
    var rnd = MS.util.rng(33);

    // a low rock shelf at the back of the floor, all along the level
    for (var x = 0; x < w; x += 20 + Math.round(rnd() * 26)) {
      var bw = 26 + Math.round(rnd() * 30), bh = 8 + Math.round(rnd() * 14);
      boulder(g, rnd, x, 146 - bh, bw, bh, R1, D2, R2);
    }

    // the floor: a 1px dark lip, a lit top, then darker going down
    P.vgrad(g, 0, 146, w, h - 146, [[0, R2], [0.1, R1], [0.4, D2], [1, D1]]);
    P.rect(g, 0, 145, w, 1, D1);
    P.rect(g, 0, 146, w, 1, R3);
    for (var i = 0; i < 360; i++) {
      var fx = rnd() * w, fy = 149 + rnd() * 60;
      P.rect(g, fx, fy, 1 + rnd() * 3, 1, rnd() > 0.5 ? D2 : R1);
    }
    for (var c = 0; c < 40; c++) P.rect(g, rnd() * w, 160 + rnd() * 40, 6 + rnd() * 10, 1, D1);
    // slides dropped everywhere
    for (var s = 0; s < 36; s++) {
      var sx = rnd() * w, sy = 151 + rnd() * 30;
      P.rect(g, sx, sy, 5, 3, PA); P.rect(g, sx, sy, 5, 1, rnd() > 0.5 ? OR : RU);
    }
    // puddles that catch the torchlight
    [[150, 172], [420, 184], [640, 168], [880, 176], [1240, 180], [1480, 170], [1700, 182], [1940, 174]].forEach(function (p) {
      P.rect(g, p[0], p[1], 22, 3, TE1); P.rect(g, p[0] + 3, p[1], 8, 1, TE2);
    });

    // ---- the entrance: a timber mine mouth on the left edge
    P.rect(g, 0, 36, 58, 110, D2);
    for (var ey = 36; ey < 146; ey++) P.rect(g, 52 + Math.sin(ey * 0.2) * 3, ey, 8, 1, R1);
    P.rect(g, 6, 40, 4, 106, R2); P.rect(g, 6, 40, 1, 106, R3); P.rect(g, 44, 40, 4, 106, R2); P.rect(g, 44, 40, 1, 106, R3);
    P.rect(g, 2, 36, 52, 5, R2); P.rect(g, 2, 36, 52, 1, R3);
    // the sign, kerned by eye
    P.rect(g, 64, 70, 54, 26, R2); P.rect(g, 64, 70, 54, 1, R3); P.rect(g, 65, 71, 52, 24, R1); P.rect(g, 64, 95, 54, 1, D2);
    spaced(g, 'SLIDE', 67, 73, PA, [0, 3, -1, 4]);
    spaced(g, 'CAVE', 74, 84, YE, [4, 0, 2]);
    P.rect(g, 89, 96, 3, 50, R2); P.rect(g, 89, 96, 1, 50, R3);
    // a lantern on the entrance post
    P.rect(g, 47, 70, 5, 7, R1); P.rect(g, 48, 71, 3, 5, YE);

    // ---- the approach
    poster(g, 116, 60, ['THE DECK', 'IS THE', 'SPEC'], [0, 1, -1, 2]);
    poster(g, 516, 56, ['EYEBALL', 'IT!'], [1, -1, 0, 3, -1]);
    poster(g, 1548, 58, ['LOGO', 'BIGGER'], [2, 0, -1]);
    // the spec sheet: PADDING ???, torn and nailed to a rock
    boulder(g, rnd, 268, 92, 64, 54, R2, R1, R3);
    sheet(g, 278, 70, 42, 52, true);
    tiny(g, 'SPEC V1', 282, 74, R1);
    P.rect(g, 282, 81, 32, 1, R3);
    tiny(g, 'PADDING:', 282, 85, RU); tiny(g, '???', 300, 92, RU, [2, -1]);
    tiny(g, 'MARGIN:', 282, 100, R1); tiny(g, 'VIBES', 284, 107, R1, [1, 0, 2, -1]);
    P.rect(g, 310, 72, 2, 10, R2); P.rect(g, 309, 70, 4, 2, R3);  // the chisel that pinned it
    // scratched graffiti: measurements, by eye
    boulder(g, rnd, 396, 104, 54, 42, R2, R1, R3);
    tiny(g, '15PX?', 402, 112, D2); tiny(g, '17PX?', 408, 120, D2, [1, 0, 2]); tiny(g, '16?!', 400, 130, RU);
    for (var tm = 0; tm < 4; tm++) { for (var k = 0; k < 4; k++) P.rect(g, 432 + k * 2, 112 + tm * 6, 1, 4, D2); P.rect(g, 431, 114 + tm * 6, 8, 1, D2); }
    // a rack of old projector carousels
    P.rect(g, 620, 96, 40, 3, R2); P.rect(g, 622, 99, 2, 47, R1); P.rect(g, 656, 99, 2, 47, R1); P.rect(g, 620, 120, 40, 2, R2);
    [0, 13, 26].forEach(function (o) { P.rect(g, 624 + o, 88, 10, 8, D2); P.rect(g, 626 + o, 90, 6, 4, R2); P.rect(g, 624 + o, 112, 10, 8, D2); P.rect(g, 626 + o, 114, 6, 4, OR); });

    // ---- the piles of rejected decks
    deckMound(g, rnd, PILES - 70, 96, 36);
    P.rect(g, PILES - 34, 92, 2, 30, R2);
    P.rect(g, PILES - 54, 84, 44, 14, RU); P.rect(g, PILES - 54, 84, 44, 1, OR);
    tiny(g, 'REJECTED', PILES - 50, 88, PA, [0, 1, 0, -1, 2, 0, 0]);

    // ---- the checkpoint: a HALT sign on a post
    P.rect(g, 945, 124, 3, 22, R2); P.rect(g, 945, 124, 1, 22, R3);
    P.rect(g, 930, 106, 34, 20, PA); P.rect(g, 930, 106, 34, 4, RU); P.rect(g, 931, 125, 33, 1, SK);
    tiny(g, 'HALT', 939, 112, RU); tiny(g, 'DEPT?', 936, 119, R1, [0, 2, 0, -1]);
    // the morale board
    var by = 78;
    P.rect(g, BOARD + 6, by + 26, 3, G - by - 36, R1); P.rect(g, BOARD + 96, by + 26, 3, G - by - 36, R1);
    P.rect(g, BOARD, by, 104, 26, D1); P.rect(g, BOARD + 1, by + 1, 102, 24, R1); P.rect(g, BOARD + 1, by + 1, 102, 1, R2);
    F.drawCentered(g, 'DAYS WITHOUT', BOARD + 52, by + 4, PA);
    F.drawCentered(g, 'A NEW DECK: 0', BOARD + 52, by + 14, YE);
    // a beam over the desks, for the mockups the devs are stuck on
    P.rect(g, A + 82, 0, 1, 44, R3); P.rect(g, A + 166, 0, 1, 44, R3);
    P.rect(g, A + 78, 44, 92, 4, R2); P.rect(g, A + 78, 44, 92, 1, R3); P.rect(g, A + 78, 47, 92, 1, R1);
    // the workshop wall: chiseled markup and the devs' tally of attempts
    for (var tg = 0; tg < 7; tg++) {
      var wx = A - 8 + tg * 26 + Math.round(rnd() * 6), wy = 100 + Math.round(rnd() * 18);
      tiny(g, ['<DIV>', '</P>', 'PX?', '<H1>', '17?', '</DIV>', '15?'][tg], wx, wy, R2);
    }

    // ---- the briefing: the projector screen's frame and cloth
    var sy = SCREEN.y - 8;
    P.rect(g, SCREEN.x - 6, sy, 4, G - sy, R1); P.rect(g, SCREEN.x + SCREEN.w + 2, sy, 4, G - sy, R1);
    P.rect(g, SCREEN.x - 4, sy, 1, G - sy, R2); P.rect(g, SCREEN.x + SCREEN.w + 4, sy, 1, G - sy, R2);
    P.rect(g, SCREEN.x - 8, sy, SCREEN.w + 16, 5, R2); P.rect(g, SCREEN.x - 8, sy, SCREEN.w + 16, 1, R3);
    P.rect(g, SCREEN.x + 20, 0, 1, sy, R3); P.rect(g, SCREEN.x + SCREEN.w - 20, 0, 1, sy, R3);
    P.rect(g, SCREEN.x - 1, SCREEN.y - 1, SCREEN.w + 2, SCREEN.h + 2, K);
    P.rect(g, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, PA);
    // a stone dais for the General
    P.rect(g, GEN - 30, 140, 72, 6, R2); P.rect(g, GEN - 30, 140, 72, 1, R3);

    // ---- the APPENDIX vault, where the General goes to sulk
    var vx = VAULT;
    boulder(g, rnd, vx - 40, 40, 100, 106, R1, D2, R2);
    for (var r = 30; r > 0; r--) {
      var col = r > 28 ? D2 : r > 25 ? R2 : r > 4 ? R1 : R3;
      for (var a = 0; a < 64; a++) {
        var ang = a / 64 * Math.PI * 2;
        P.rect(g, vx + 10 + Math.cos(ang) * r, 96 + Math.sin(ang) * r, 1, 1, col);
      }
    }
    for (var b = 0; b < 8; b++) { var an = b / 8 * Math.PI * 2; P.rect(g, vx + 9 + Math.cos(an) * 22, 95 + Math.sin(an) * 22, 3, 3, R3); }
    P.rect(g, vx - 16, 90, 52, 11, D2);
    tiny(g, 'APPENDIX', vx - 13, 93, YE);
    tiny(g, 'A-Z', vx + 5, 108, R3);

    // ---- the run out: cracked ceiling, fallen scaffold, the daylight mouth
    HOLES.forEach(function (hole) {
      var hx = hole[0];
      for (var cy = 0; cy < 28; cy++) P.rect(g, hx + Math.round(Math.sin(cy * 0.7 + hx) * 3) + cy * 0.3, cy, 1, 1, D1);
    });
    P.rect(g, 1902, 96, 3, 50, R2); P.rect(g, 1902, 96, 1, 50, R3);
    P.rect(g, 1888, 80, 32, 17, PA); P.rect(g, 1888, 80, 32, 4, OL2); P.rect(g, 1889, 96, 31, 1, SK);
    tiny(g, 'EXIT', 1893, 86, OL1, [2, 0, 1]); tiny(g, '->', 1908, 91, R1);
    // the mouth of the cave: sky, hills and grass in daylight
    var ex = w - 116;
    var C = MS.color;
    for (var my = 22; my < 146; my++) {
      var edge = ex + 14 + Math.round(Math.sin(my * 0.17) * 4 + (my < 52 ? (52 - my) * 0.7 : 0));
      var k = (my - 22) / 100;
      var sky = k < 0.5 ? C.mix(WH, PA, k * 2) : C.mix(PA, SK, Math.min(1, (k - 0.5) * 2));
      P.rect(g, edge, my, w - edge, 1, sky);
      P.rect(g, edge - 9, my, 8, 1, R1); P.rect(g, edge - 2, my, 2, 1, R3);
    }
    P.radial(g, w - 30, 48, 26, 'rgba(255,246,224,0.95)');
    for (var hx = ex + 10; hx < w; hx++) {
      var hy = 114 + Math.round(Math.sin(hx * 0.05) * 5);
      if (hx >= ex + 14 + Math.round(Math.sin(hy * 0.17) * 4)) P.rect(g, hx, hy, 1, 146 - hy, hy < 116 ? OL2 : OL1);
    }
    for (var gr = ex + 20; gr < w; gr += 3) P.rect(g, gr, 140 + Math.round(rnd() * 3), 2, 6, OL2);
    P.rect(g, ex - 10, 12, w - ex + 10, 12, R1); P.rect(g, ex - 10, 23, w - ex + 10, 1, D2);
    for (var t = 0; t < 12; t++) P.spike(g, ex + t * 10, 24, 6, 6 + rnd() * 10, R1, true);
  }

  // ------------------------------------------------------------ dynamic bits
  // A dithered glow: palette pixels in a Bayer pattern, densest at the center.
  function glow(g, cx, cy, r, col, strength) {
    var B = MS.palette.BAYER;
    g.fillStyle = col;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      var d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      var a = (1 - d) * strength;
      var px = Math.round(cx + x), py = Math.round(cy + y);
      if (a * 16 > B[((py & 3) * 4) + (px & 3)]) g.fillRect(px, py, 1, 1);
    }
  }

  // Random-ish but fixed: the cramped mockup on slide 12.
  function drawSlide12(g, x, y) {
    var S = SCREEN;
    P.rect(g, x, y, S.w, 9, OR);
    tiny(g, 'HOMEPAGE V2', x + 3, y + 2, WH, [0, 1, 0, -1, 2, 0, 1, 0, 0, -1]);
    P.rect(g, x + 2, y + 11, 16, 11, R1); tiny(g, 'LOGO', x + 3, y + 14, PA);
    tiny(g, 'HOMEABOUTSHOP', x + 17, y + 12, R1, [-1, 0, -1, 1, -1, 0]);
    P.rect(g, x + 21, y + 19, 79, 15, TE1); P.rect(g, x + 24, y + 22, 40, 2, TE2); P.rect(g, x + 26, y + 27, 22, 2, TE2);
    [[3, 36, 27, 12], [33, 37, 30, 10], [70, 35, 31, 14]].forEach(function (b) { P.rect(g, x + b[0], y + b[1], b[2], b[3], R3); P.rect(g, x + b[0] + 2, y + b[1] + 2, b[2] - 7, 1, PA); });
    F.draw(g, 'PADDING: ???', x + 6, y + S.h - 13, RU);
  }

  function drawSlide(g, sx, sy, n) {
    var S = SCREEN;
    var x = sx, y = sy;
    P.rect(g, x, y, S.w, S.h, PA);
    if (n === 1) {
      P.rect(g, x, y, S.w, 11, OR);
      F.draw(g, 'WEBSITE BRIEF v9', x + 4, y + 2, WH);
      ['- MAKE IT POP', '- APPLE, BUT FUN', '- SYNERGY', '- SEE SLIDE 63'].forEach(function (l, i) { F.draw(g, l, x + 6, y + 15 + i * 10, R1); });
    } else if (n === 12) {
      drawSlide12(g, x, y);
    } else if (n === 63) {
      for (var i = 0; i < S.h - 10; i++) P.rect(g, x, y + i, S.w, 1, i < 18 ? RU : i < 34 ? OR : i < 44 ? YE : TE1);
      P.rect(g, x + 40, y + 30, 22, 14, YE); P.rect(g, x + 44, y + 27, 14, 3, YE);
      P.rect(g, x, y + 46, S.w, 1, TE2); P.rect(g, x + 10, y + 49, 30, 1, TE2);
      F.draw(g, 'HOVER STATES', x + 4, y + S.h - 9, R1);
    } else if (n === 84) {
      var big = F.big('LOGO', { scale: 3, stops: [OR, OR, RU], outline: 0, shadowColor: null, italic: false });
      g.drawImage(big, Math.round(x + S.w / 2 - big.width / 2), y + 12);
      F.drawCentered(g, 'BIGGER?', x + S.w / 2, y + 44, R1);
    }
    if (n) F.draw(g, (n === 1 ? '1' : n) + '/84', x + S.w - 26, y + S.h - 9, R2);
  }

  // ------------------------------------------------------------ [staging review]
  // Three weeks later the built site goes up on staging, on the briefing screen, and all the
  // feedback arrives at once: red pen, one round at a time, up to round seven. Drawn from
  // w.state.staging (0..1). The scene's camera shows only the left 98px of the screen, so
  // everything sits there. The next [slide N] takes the screen back.
  var STAGING_T = 2.0;
  var UPLOADED = 0.18, SITE_UP = 0.32, NOTE0 = 0.36, NOTE_STEP = 0.09;
  // Red pen with a paper-white edge, so it reads on any color of the page.
  function pen(g, text, x, y, big) {
    function ink(dx, dy, col) {
      if (!big) { tiny(g, text, x + dx, y + dy, col); return; }
      var cx = x + dx;   // the big letters, each a little off the line
      for (var i = 0; i < text.length; i++) cx += F.draw(g, text[i], cx, y + dy + [0, -1, 0, 1, 0, -1, 1, 0][i % 8], col) + 1;
    }
    ink(-1, 0, WH); ink(1, 0, WH); ink(0, -1, WH); ink(0, 1, WH);
    ink(0, 0, RU);
  }
  // A hasty pen loop: a bit more than one turn, opening as it goes.
  function loop(g, cx, cy, rx, ry) {
    var n = Math.round((rx + ry) * 4);
    for (var i = 0; i <= n * 1.12; i++) {
      var a = i / n * Math.PI * 2 - 2.4, k = 1 + i / n * 0.14;
      P.rect(g, Math.round(cx + Math.cos(a) * rx * k), Math.round(cy + Math.sin(a) * ry * k), 1, 1, RU);
    }
  }
  // The site as built, by eye: logo, nav, hero, three cards with three different gaps.
  function stagingSite(g, x, y) {
    P.rect(g, x + 3, y + 12, 17, 7, R1); tiny(g, 'LOGO', x + 4, y + 13, PA);
    [[71, 6], [79, 5], [88, 7]].forEach(function (n) { P.rect(g, x + n[0], y + 15, n[1], 1, R2); }); // the nav
    P.rect(g, x + 3, y + 21, 92, 16, TE1);
    P.rect(g, x + 7, y + 24, 40, 2, TE2); P.rect(g, x + 7, y + 29, 26, 2, TE2);
    P.rect(g, x + 72, y + 29, 18, 6, YE); P.rect(g, x + 75, y + 31, 12, 2, OR);
    [[3, 40, 24, 12], [29, 40, 27, 12], [63, 41, 32, 11]].forEach(function (c) {
      P.rect(g, x + c[0], y + c[1], c[2], c[3], R3);
      P.rect(g, x + c[0] + 2, y + c[1] + 2, c[2] - 8, 1, PA); P.rect(g, x + c[0] + 2, y + c[1] + 5, c[2] - 12, 1, SK);
    });
  }
  // One note per round after the first. The last is the same note as the one before it.
  var NOTES = [
    function (g, x, y) { pen(g, 'MORE SPACE', x + 6, y + 23); },
    function (g, x, y) { pen(g, 'LESS SPACE', x + 6, y + 30); },
    function (g, x, y) { loop(g, x + 11, y + 15, 11, 6); pen(g, 'BIGGER LOGO', x + 25, y + 13); },
    function (g, x, y) { pen(g, 'MAKE IT POP', x + 50, y + 22); },
    function (g, x, y) {
      // an arrow into the gap between the last two cards
      P.rect(g, x + 57, y + 46, 7, 1, RU); P.rect(g, x + 58, y + 45, 1, 3, RU); P.rect(g, x + 59, y + 44, 1, 5, RU);
      pen(g, 'SPACING?', x + 66, y + 44);
    },
    function (g, x, y) {
      pen(g, 'SPACING?', x + 6, y + 42, true);
      P.rect(g, x + 5, y + 51, 46, 1, RU); P.rect(g, x + 8, y + 53, 42, 1, RU);
    }
  ];
  function stagingNotes(k) { return Math.max(0, Math.min(NOTES.length, Math.floor((k - NOTE0) / NOTE_STEP) + 1)); }

  function drawStaging(g, x, y, k) {
    var S = SCREEN;
    P.rect(g, x, y, S.w, S.h, PA);
    // the staging server's bar
    P.rect(g, x, y, S.w, 10, D2);
    P.rect(g, x + 3, y + 4, 2, 2, k >= UPLOADED ? OL2 : YE);
    F.draw(g, 'STAGING', x + 8, y + 1, TE2);
    if (k < UPLOADED) {
      var u = k / UPLOADED;
      tiny(g, 'UPLOADING', x + 32, y + 24, R1);
      P.rect(g, x + 20, y + 32, 58, 5, R2); P.rect(g, x + 21, y + 33, 56, 3, PA);
      P.rect(g, x + 21, y + 33, Math.round(56 * u), 3, OR);
      return;
    }
    var e = Math.min(1, (k - UPLOADED) / (SITE_UP - UPLOADED));
    g.save();
    g.beginPath(); g.rect(x, y + 10, S.w, Math.round(44 * e)); g.clip();
    stagingSite(g, x, y);
    g.restore();
    if (k < SITE_UP) return;
    var n = stagingNotes(k);
    for (var i = 0; i < n; i++) NOTES[i](g, x, y);
    // the round counter
    P.rect(g, x, y + 54, S.w, 10, RU);
    P.rect(g, x, y + 54, S.w, 1, OR);
    F.drawCentered(g, 'FEEDBACK ROUND ' + (n + 1), x + 49, y + 55, PA);
  }

  // ------------------------------------------------------------ [wireframe]
  // UX design arrives: the briefing screen that showed the red pen now shows an actual
  // wireframe on an 8px grid, with the padding marked. Drawn from w.state.wireframe (0..1):
  // the grid fades in, the boxes draw in, then the padding redlines. Fits in the left 98px,
  // the part the desks camera sees.
  var WIRE_T = 1.8;
  function drawWireframe(g, x, y, k) {
    var S = SCREEN, gx = x + 4, gy = y + 12;               // grid origin: 8px cells, 11 x 5
    P.rect(g, x, y, S.w, S.h, WH);
    P.rect(g, x, y, S.w, 10, D2);
    P.rect(g, x + 3, y + 4, 2, 2, OL2);
    F.draw(g, 'WIREFRAME', x + 8, y + 1, TE2);
    // the 8px grid, as dots, fading in
    var gridK = Math.min(1, k / 0.25);
    g.fillStyle = gridK > 0.5 ? TE2 : SK;
    for (var cx = 0; cx <= 11; cx++) for (var cy = 0; cy <= 5; cy++) {
      if ((cx + cy) % 2 && gridK < 1) continue;
      g.fillRect(gx + cx * 8, gy + cy * 8, 1, 1);
    }
    function box(i, bx, by, bw, bh, fill) {                // in grid cells; i is its turn to draw
      if (k < 0.25 + i * 0.09) return;
      var X = gx + bx * 8, Y = gy + by * 8, Wd = bw * 8, Hd = bh * 8;
      if (fill) P.rect(g, X, Y, Wd, Hd, fill);
      P.rect(g, X, Y, Wd, 1, R1); P.rect(g, X, Y + Hd - 1, Wd, 1, R1);
      P.rect(g, X, Y, 1, Hd, R1); P.rect(g, X + Wd - 1, Y, 1, Hd, R1);
      return { X: X, Y: Y, W: Wd, H: Hd };
    }
    box(0, 0, 0, 11, 1, PA);                               // the header
    var img = box(1, 1, 1, 4, 3);                          // a hero image, crossed out the wireframe way
    if (img) {
      for (var d = 0; d < img.W - 2; d++) {
        var yy = Math.round(d * (img.H - 2) / (img.W - 2));
        g.fillStyle = R3; g.fillRect(img.X + 1 + d, img.Y + 1 + yy, 1, 1); g.fillRect(img.X + 1 + d, img.Y + img.H - 2 - yy, 1, 1);
      }
    }
    var txt = box(2, 6, 1, 4, 2);                          // a text block
    if (txt) for (var l = 0; l < 3; l++) P.rect(g, txt.X + 2, txt.Y + 3 + l * 4, l === 2 ? 18 : 28, 1, R3);
    var btn = box(3, 6, 3, 2, 1, TE2);                     // a button
    if (btn) P.rect(g, btn.X + 3, btn.Y + 3, 10, 2, TE1);
    // the padding, marked in red: the same 8 everywhere
    if (k >= 0.72) {
      [[gx + 8, gy + 8, 8, 0], [gx + 40, gy + 8, 8, 0], [gx + 40, gy + 24, 0, 8], [gx, gy + 16, 8, 0]].forEach(function (m) {
        var mx = m[0], my = m[1];
        if (m[2]) { P.rect(g, mx, my + 13, m[2], 1, OR); P.rect(g, mx, my + 11, 1, 5, OR); P.rect(g, mx + m[2] - 1, my + 11, 1, 5, OR); }
        else { P.rect(g, mx + 3, my, 1, m[3], OR); }
      });
      tiny(g, '8', gx + 10, gy + 16, RU); tiny(g, '8', gx + 42, gy + 16, RU);
    }
    // the footer: the rule everyone can now see
    P.rect(g, x, y + 54, S.w, 10, TE1);
    P.rect(g, x, y + 54, S.w, 1, TE2);
    if (k >= 0.85) tiny(g, 'PADDING 8 / GRID 8PX', x + 6, y + 57, WH);
  }

  // Posts, chains and pegs that hold the billboards up (the boards are drawn by playfx).
  function drawMounts(g, camX) {
    TARGETS.forEach(function (tg) {
      var sx = Math.round(tg.x - camX);
      if (sx < -60 || sx > W + 20 || !tg.mount) return;
      var bottom = tg.y + tg.h;
      if (tg.mount === 'post') {
        [sx + 5, sx + tg.w - 8].forEach(function (px) {
          P.rect(g, px - 1, bottom, 5, G - bottom - 2, K);
          P.rect(g, px, bottom, 3, G - bottom - 2, R2);
          P.rect(g, px, bottom, 1, G - bottom - 2, R3);
        });
        P.rect(g, sx + 2, G - 4, tg.w - 4, 3, R1);
      } else if (tg.mount === 'chain' || tg.mount === 'rope') {
        var top = tg.mount === 'chain' ? 48 : 0;
        [sx + 4, sx + tg.w - 5].forEach(function (cx) {
          for (var y = top; y < tg.y; y += 3) { P.rect(g, cx, y, 1, 2, R3); P.rect(g, cx + 1, y + 1, 1, 1, D2); }
        });
      }
    });
  }

  function drawTorches(g, w, camX, t) {
    var mx = Math.round(camX * MID_SPEED);
    MID_TORCHES.forEach(function (tc, i) {
      var x = tc[0] - mx, y = tc[1] - 3;
      if (x < -40 || x > W + 40) return;
      glow(g, x, y, 26 + (Math.floor(t * 7 + i) % 2), OR, 0.5);
      glow(g, x, y, 11, YE, 0.6);
      flame(g, x, y, t, i * 1.7);
    });
  }

  function drawBack(g, w, camX, t) {
    // the ceiling breaks open when the daylight comes in
    var d = w.state.daylight || 0;
    if (d > 0) {
      HOLES.forEach(function (hole) {
        var hx = Math.round(hole[0] - camX), hw = Math.round(hole[1] * Math.min(1, d * 1.6));
        if (hx < -40 || hx > W + 40 || hw < 2) return;
        for (var y = 0; y < 18; y++) {
          var ww = Math.round(hw * (1 - y / 22));
          P.rect(g, hx - Math.floor(ww / 2) - 1 - y * 0.4, y, ww + 2, 1, R3);
          P.rect(g, hx - Math.floor(ww / 2) - y * 0.4, y, ww, 1, y < 6 ? WH : PA);
        }
      });
    }
    // pools of daylight on the floor, where the shafts land
    if (d > 0) {
      var Bp = MS.palette.BAYER;
      HOLES.forEach(function (hole, i) {
        var px = Math.round(hole[0] - camX - (G - 10) * 0.4), pw = hole[1] + 10;
        if (px < -60 || px > W + 60) return;
        g.fillStyle = i % 2 ? YE : WH;
        for (var y = G - 12; y < G + 6; y++) {
          var k = 1 - Math.abs(y - (G - 3)) / 9;
          for (var x = px - pw / 2; x < px + pw / 2; x++) {
            var e = k * (1 - Math.abs(x - px) / (pw / 2));
            if (e * d * 9 > Bp[((y & 3) * 4) + (Math.round(x) & 3)]) g.fillRect(Math.round(x), y, 1, 1);
          }
        }
      });
    }
    drawMounts(g, camX);
    var sx = SCREEN.x - camX;
    if (sx > -SCREEN.w && sx < W) {
      if (w.state.wireframe > 0) drawWireframe(g, sx, SCREEN.y, w.state.wireframe);
      else if (!w.state.slide && w.state.staging > 0) drawStaging(g, sx, SCREEN.y, w.state.staging);
      else drawSlide(g, sx, SCREEN.y, w.state.slide);
      // projector light
      var lx = PROJ + 7 - camX, ly = G - 11;
      g.fillStyle = TE2;
      var B = MS.palette.BAYER;
      for (var yy = SCREEN.y + SCREEN.h; yy < ly; yy++) {
        var k = (yy - SCREEN.y - SCREEN.h) / (ly - SCREEN.y - SCREEN.h);
        var x0 = MS.util.lerp(sx + 8, lx - 2, k), x1 = MS.util.lerp(sx + SCREEN.w - 8, lx + 4, k);
        for (var xx = Math.round(x0); xx < x1; xx++) if (B[((yy & 3) * 4) + (xx & 3)] < 2) g.fillRect(xx, yy, 1, 1);
      }
    }
  }

  // Shafts of daylight from the broken ceiling and the cave mouth, over everyone.
  function drawFront(g, w, camX, t) {
    var d = w.state.daylight || 0;
    if (d <= 0) return;
    var B = MS.palette.BAYER;
    var dens = Math.round(d * 5);
    HOLES.forEach(function (hole, i) {
      var hx = hole[0] - camX, hw = hole[1];
      if (hx < -40 || hx > W + 120) return;
      g.fillStyle = i % 2 ? YE : WH;
      for (var y = 10; y < G; y++) {
        var fade = y > G - 30 ? 1 : 0;
        var x0 = hx - hw / 2 + 3 - (y - 10) * 0.4;
        for (var x = Math.round(x0); x < x0 + hw - 6; x++) if (B[((y & 3) * 4) + (x & 3)] < dens - fade) g.fillRect(x, y, 1, 1);
      }
    });
    var ex = WIDTH - 112 - camX;
    if (ex < W) {
      g.fillStyle = WH;
      for (var y2 = 30; y2 < G + 20; y2++) {
        var x2 = ex + 10 - (y2 - 30) * 0.9;
        for (var x3 = Math.round(x2); x3 < x2 + 22; x3++) if (B[((y2 & 3) * 4) + (x3 & 3)] < dens - 1) g.fillRect(x3, y2, 1, 1);
      }
    }
  }

  // Cosmetic only: water drips, embers from the torches and the campfire.
  function update(w, dt) {
    if (w.reduced) return;
    var fx = w.caveFx || (w.caveFx = { drip: 0, ember: 0 });
    fx.drip -= dt;
    if (fx.drip <= 0) {
      fx.drip = 0.5 + Math.random() * 0.9;
      var x = w.camera.x + 20 + Math.random() * (W - 40);
      w.fx.particles.push({ x: x, y: 18, vx: 0, vy: 30, g: 260, life: 1.6, color: TE2, size: 1, floorOff: 18 });
    }
    fx.ember -= dt;
    if (fx.ember <= 0) {
      fx.ember = 0.18;
      var fire = SOLIDS[1];
      var fsx = fire.x + fire.w / 2;
      if (fsx > w.camera.x - 20 && fsx < w.camera.x + W + 20) {
        w.fx.particles.push({ x: fsx + (Math.random() - 0.5) * 10, y: G - 14, vx: (Math.random() - 0.5) * 8, vy: -18, g: -4, life: 1.1, color: Math.random() > 0.5 ? YE : OR, size: 1, kind: 'ember', floor: false });
      }
      var mx = Math.round(w.camera.x * MID_SPEED);
      var tc = MID_TORCHES[Math.floor(Math.random() * MID_TORCHES.length)];
      var tx = tc[0] - mx;
      if (tx > 0 && tx < W) w.fx.particles.push({ x: w.camera.x + tx, y: tc[1] - 10, vx: (Math.random() - 0.5) * 6, vy: -14, g: -2, life: 0.9, color: YE, size: 1, kind: 'ember', floor: false });
    }
  }

  var set = {
    name: 'cave', era: 'stone', width: WIDTH, ground: G, camera: A - 106, entry: 52, bg: K,
    haze: '#7a5c4c',
    music: 'cave', arms: 'PPT', crowd: 'DEVS',
    marks: {
      entrance: 40, piles: PILES, workshop: 1000, desks: DESKS, podium: A + 170, projector: PROJ, lectern: LECT,
      screen: SCREEN.x + SCREEN.w / 2, appendix: VAULT, vault: VAULT, daylight: WIDTH - 120, exit: EXIT
    },
    cast: {
      SAM: { names: ['SAM'], costume: 'sam', x: -40, visible: false },
      GENERAL: { names: ['GENERAL BULLETPOINT', 'BULLETPOINT', 'THE GENERAL'], costume: 'general', x: GEN, facing: -1 },
      DEV1: { names: ['DEV 1'], costume: 'pow1', x: DEVS[0], chained: true, anim: 'work', groups: ['DEVS'] },
      DEV2: { names: ['DEV 2'], costume: 'pow2', x: DEVS[1], chained: true, anim: 'work', groups: ['DEVS'] },
      DEV3: { names: ['DEV 3'], costume: 'pow3', x: DEVS[2], chained: true, anim: 'work', groups: ['DEVS'] },
      DEV4: { names: ['DEV 4'], costume: 'pow4', x: DEVS[3], chained: true, anim: 'work', groups: ['DEVS'] },
      TROOPER1: { names: ['TROOPER 1', 'SLIDE TROOPER 1'], costume: 'trooper', x: TROOPS[0], facing: -1, groups: ['TROOPERS'] },
      TROOPER2: { names: ['TROOPER 2', 'SLIDE TROOPER 2'], costume: 'trooper2', x: TROOPS[1], facing: -1, groups: ['TROOPERS'] }
    },
    events: [
      { id: 'slide', match: /^(?:show |next )?slide (\d+)$/ },
      { id: 'staging', match: /^(?:the )?(?:staging(?: review| server| feedback)?|site goes up on staging|feedback arrives)$/ },
      { id: 'daylight', match: /^(?:daylight|light pours in|the sun breaks through)$/ },
      { id: 'wireframe', match: /^(?:show )?(?:the |an? )?(?:actual )?wireframe(?: (?:appears|goes up|lands))?$/ }
    ],
    eventsById: {
      slide: { run: function (w, args, Task) {
        return new Task(0, null, function () { w.state.slide = Number(args[0]) || 0; if (!w.instant) w.sfx('select'); });
      } },
      // The site goes up on the briefing screen, then the red pen arrives, round after round.
      // The screen shows staging while no slide is up (slide 0); finish() snaps to round seven.
      staging: { run: function (w, args, Task) {
        var heard = -1, up = false;
        return new Task(STAGING_T, function (t) {
          var k = w.state.staging = Math.min(1, t / STAGING_T);
          w.state.slide = 0;
          if (w.instant) return;
          if (heard < 0) { heard = 0; w.sfx('select'); }
          if (!up && k >= SITE_UP) { up = true; w.sfx('build'); }
          var n = stagingNotes(k);
          if (n > heard) { heard = n; w.sfx('pop'); }
        }, function () { w.state.slide = 0; w.state.staging = 1; });
      } },
      // UX design arrives: an actual wireframe on the briefing screen, on an 8px grid.
      wireframe: { run: function (w, args, Task) {
        var heard = 0;
        return new Task(WIRE_T, function (t) {
          var k = w.state.wireframe = Math.min(1, t / WIRE_T);
          if (w.instant) return;
          var n = k >= 0.85 ? 3 : k >= 0.72 ? 2 : k >= 0.25 ? 1 : 0;
          if (n > heard) { heard = n; w.sfx(n === 3 ? 'fix' : n === 2 ? 'snap' : 'select'); }
        }, function () { w.state.wireframe = 1; });
      } },
      // The ceiling cracks open and light pours in. Deterministic: finish() snaps to full daylight.
      daylight: { run: function (w, args, Task) {
        var rumbled = false;
        return new Task(1.4, function (t) {
          w.state.daylight = Math.min(1, t / 1.4);
          if (!rumbled && !w.instant) {
            rumbled = true;
            w.sfx('boom');
            if (!w.reduced) { w.camera.shake = 0.5; w.camera.shakeAmp = 2; }
            HOLES.forEach(function (hole) {
              if (hole[0] > w.camera.x - 20 && hole[0] < w.camera.x + W + 20 && w.debris) w.debris(hole[0], 14, [R3, R2, R1], 6);
            });
          }
        }, function () { w.state.daylight = 1; });
      } }
    },
    initState: function () { return { slide: 0, staging: 0, daylight: 0, wireframe: 0 }; },
    level: { solids: SOLIDS, targets: TARGETS, spawn: spawn, update: levelUpdate, onHit: onHit },
    layers: layers, props: props, drawBack: drawBack, drawFront: drawFront, update: update
  };
  MS.sets = MS.sets || {};
  MS.sets.cave = set;
})(typeof window !== 'undefined' ? window : globalThis);
