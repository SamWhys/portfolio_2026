/* METAL SLIDE set: Mission 5, Tomorrow, Today. A hopeful city at sunrise: garden towers,
   waterfalls, skybridges, flying pods. Full color plus bloom. Left to right: a glass
   skybridge (with the idea queue: everyone still waits for a review slot), the plaza and its
   fountain, the hologram garden where the citizens gather around the kiosk (buried under the
   researcher's sticky notes), the waterfall terraces, and the overlook at the edge of the
   city. Idea bubbles drift about to be blasted into tiny working prototypes.
   Events: [the notes sort] (the sticky-note mountain clusters into a draft report),
   [the report is checked] (the researcher stamps every page), [prototype appears] /
   [prototype vanishes] (a working checkout over the kiosk), [tools rise] (team tools, then
   company tools) and [ideas bloom] (a thought bubble over every citizen and dev turns into a
   tiny prototype). */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint, F = MS.font, C = MS.color;
  var W = MS.W, H = MS.H;
  var G = 156;
  var LIP = 146;
  var WIDTH = 2200;

  // Story places, left to right. The citizens gather around the kiosk between the plaza and
  // the hologram marks, so the plaza scene, the hologram scene and the opening pan all frame
  // them without the camera hunting.
  var M = { skybridge: 56, plaza: 1000, garden: 1110, hologram: 1200, terraces: 1480, overlook: 1960, fountain: 820 };
  var KIOSK = 1088;
  var HOLO = { x: KIOSK - 30, y: 30, w: 60, h: 62 };
  var BRIDGE_END = 640;
  var SKY_SPEED = 0.05, FAR_SPEED = 0.18, MID_SPEED = 0.42, FRONT_SPEED = 1.25;

  var INK = '#2a1f45';
  var GLOW = '#7ff4ff', GLOW2 = '#bff8ff', GOLD = '#ffd36a', PINK = '#ff8ab8', LEAF = '#3ab87a', LEAF2 = '#5ad89a', LEAF3 = '#2a9a68';
  var STONE = '#f2eefa', STONE2 = '#dcd4f0', STONE3 = '#bfb4e0';

  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
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
  function stamp(w, h, paint, ink) {
    var c = canvas(w + 2, h + 2), g = c.getContext('2d');
    g.save(); g.translate(1, 1); paint(g, w, h); g.restore();
    return outline(c, ink);
  }
  function r(g, x, y, w, h, col) { P.rect(g, x, y, w, h, col); }
  function disc(g, cx, cy, rad, col, squash) {
    for (var y = -rad; y <= rad; y++) {
      var ww = Math.round(Math.sqrt(rad * rad - y * y) * 2);
      r(g, cx - ww / 2, cy + y * (squash || 1), ww, Math.max(1, squash || 1), col);
    }
  }

  // ------------------------------------------------------------ level data
  var SOLIDS = [
    { x: 206, w: 30, h: 10, kind: 'bench' },
    { x: 396, w: 18, h: 20, kind: 'planter' },
    { x: 560, w: 16, h: 14, kind: 'pod' },
    { x: 756, w: 18, h: 24, kind: 'planter' },
    { x: KIOSK - 7, w: 14, h: 22, kind: 'kiosk' },
    { x: 1262, w: 30, h: 10, kind: 'bench' },
    { x: 1420, w: 18, h: 24, kind: 'planter' },
    { x: 1550, w: 30, h: 10, kind: 'bench' },
    { x: 1700, w: 20, h: 20, kind: 'planter' }
  ];
  // Idea bubbles waiting in line. A shot turns one into a tiny working prototype; the
  // label is what pops. Standing shots fly at y 133; the high ones need a jump.
  var TARGETS = [
    { id: 'future-i1', x: 140, y: 118, label: 'TRY IT' },
    { id: 'future-i2', x: 300, y: 94, label: 'PROTOTYPE' },
    { id: 'future-i3', x: 468, y: 119, label: 'TESTED' },
    { id: 'future-i4', x: 640, y: 96, label: 'CLICKABLE' },
    { id: 'future-i5', x: 700, y: 118, label: 'A/B' },
    { id: 'future-i6', x: 842, y: 118, label: 'WORKS' },
    { id: 'future-i7', x: 930, y: 96, label: 'SHIPPED' },
    // (none between the hologram and x 1410: that stretch is the research hologram and the tools)
    { id: 'future-i8', x: 1414, y: 96, label: 'TRY IT' },
    { id: 'future-i9', x: 1545, y: 118, label: 'V2' },
    { id: 'future-i10', x: 1690, y: 94, label: 'TESTED' },
    { id: 'future-i11', x: 1480, y: 96, label: 'LEARNED' },
    { id: 'future-i12', x: 1620, y: 119, label: 'WORKS' },
    { id: 'future-i13', x: 1760, y: 118, label: 'PROTOTYPE' },
    { id: 'future-i14', x: 1850, y: 94, label: 'SHIPPED' }
  ].map(function (t) { t.kind = 'bubble'; t.w = 16; t.h = 14; t.hp = 1; return t; });
  // Relaxed citizens, startled by a stranger with a blaster.
  var EXTRAS = [
    { id: 'future-zen', costume: 'citizen3', x: 222, facing: -1, loaf: 'sit', line: 'MY MEDITATION!' },
    { id: 'future-decker', costume: 'citizen2', x: 664, facing: -1, loaf: 'idle', thrower: true, line: "I'LL START A DECK!" },
    { id: 'future-dreamer', costume: 'citizen1', x: 884, facing: 1, loaf: 'think', line: 'I WAS DAYDREAMING!' },
    { id: 'future-napper', costume: 'citizen3', x: 1566, facing: -1, loaf: 'sit', line: 'FIVE MORE MINUTES!' },
    { id: 'future-yogi', costume: 'citizen2', x: 1490, facing: 1, loaf: 'think', held: 'smoothie', line: 'MY SMOOTHIE!' },
    { id: 'future-selfie', costume: 'citizen1', x: 1820, facing: -1, loaf: 'wave', line: 'NOT MY GOOD SIDE!' }
  ];

  function spawn(w, fromX, toX) {
    // (Targets outside this stretch are armored by C.play: they spark until their turn.)
    if (!MS.enemies) return [];
    return EXTRAS.filter(function (e) { return e.x > fromX + 60 && e.x < toX + 8; }).map(function (e) {
      return MS.enemies.make(e.id, { costume: MS.costumes && MS.costumes[e.costume] ? e.costume : 'citizen1', x: e.x, facing: e.facing, loaf: e.loaf, thrower: e.thrower, held: e.held, line: e.line });
    });
  }

  function onHit(w, t) {
    if (w.instant || !w.burst) return;
    var y = t.y != null ? t.y : G - t.h;
    w.burst(t.x + t.w / 2, y + t.h / 2, 10, { kind: 'spark', colors: [GLOW, '#ffffff', GOLD, PINK], speed: 70, g: 0, spread: Math.PI * 2, life: 0.5, floor: false });
  }

  // ------------------------------------------------------------ painters
  function spire(g, x, base, w, h, col, garden, lit) {
    for (var y = 0; y < h; y++) {
      var k = y / h;
      var ww = Math.max(2, Math.round(w * (0.55 + 0.45 * Math.sin(Math.min(1, k * 1.2) * Math.PI / 2))));
      r(g, x - ww / 2, base - h + y, ww, 1, col);
      if (lit) r(g, x + ww / 2 - 2, base - h + y, 2, 1, lit);
    }
    r(g, x - w / 2 + 2, base - h + 8, 1, h - 8, C.shade(col, 0.3));
    if (garden) for (var gy = base - h + 14; gy < base - 6; gy += 12) {
      r(g, x - w / 2 - 3, gy, w + 6, 3, LEAF2); r(g, x - w / 2 - 2, gy + 3, w + 4, 1, LEAF3);
      for (var vy = 0; vy < 5; vy++) r(g, x - w / 2 - 3 + (vy * 7) % (w + 6), gy + 4, 1, 2 + vy % 3, LEAF3);
      for (var f = 0; f < w; f += 4) r(g, x - w / 2 + f, gy - 1, 1, 1, f % 8 ? PINK : GOLD);
    }
  }

  function cloud(g, cx, cy, s, col, shade) {
    [[0, 0, 7], [8, -3, 9], [17, 0, 7], [-7, 2, 5], [24, 2, 5]].forEach(function (b) {
      var rr = b[2] * s;
      for (var yy = -rr; yy <= rr * 0.5; yy++) {
        var ww = Math.round(Math.sqrt(rr * rr - yy * yy) * 2);
        r(g, cx + b[0] * s - ww / 2, cy + b[1] * s + yy, ww, 1, yy > rr * 0.1 ? shade : col);
      }
    });
  }

  function tree(g, x, base, rad, trunk) {
    r(g, x - 1, base - trunk, 3, trunk, '#8a6a8a');
    disc(g, x, base - trunk - rad + 2, rad, LEAF3);
    disc(g, x - 2, base - trunk - rad, rad - 2, LEAF);
    disc(g, x - 3, base - trunk - rad - 2, rad - 5, LEAF2);
    for (var f = 0; f < 5; f++) r(g, x - rad + 3 + f * (rad / 2.5), base - trunk - rad + ((f * 5) % 7) - 2, 2, 2, f % 2 ? PINK : '#ffffff');
  }

  function railing(g, x0, x1, top) {
    g.fillStyle = 'rgba(200,250,255,0.22)'; g.fillRect(x0, top + 2, x1 - x0, LIP - top - 2);
    for (var gx = x0 + 6; gx < x1; gx += 13) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(gx, top + 4, 1, LIP - top - 8); }
    r(g, x0, top, x1 - x0, 2, '#ffffff'); r(g, x0, top + 2, x1 - x0, 1, STONE3);
    for (var px = x0; px <= x1; px += 40) { r(g, px, top, 2, LIP - top, '#ffffff'); r(g, px + 2, top, 1, LIP - top, STONE3); }
  }

  function floorBand(g, x0, x1, kind, rnd) {
    var hgt = H - LIP;
    if (kind === 'bridge') {
      P.vgrad(g, x0, LIP, x1 - x0, 22, [[0, 'rgba(225,250,255,0.95)'], [1, 'rgba(180,225,250,0.85)']]);
      for (var gx = x0 + 10; gx < x1; gx += 32) r(g, gx, LIP + 1, 1, 21, 'rgba(127,244,255,0.75)');
      r(g, x0, LIP + 9, x1 - x0, 1, 'rgba(255,255,255,0.7)');
      r(g, x0, LIP + 22, x1 - x0, 7, '#ffffff'); r(g, x0, LIP + 24, x1 - x0, 2, GLOW); r(g, x0, LIP + 28, x1 - x0, 1, STONE3);
      for (var u = x0 + 40; u < x1; u += 80) { r(g, u, LIP + 29, 6, 6, '#e8e4f8'); r(g, u + 1, LIP + 35, 4, 2, STONE3); }
    } else if (kind === 'plaza') {
      P.vgrad(g, x0, LIP, x1 - x0, hgt, [[0, '#f6f2ff'], [0.3, '#e6e0f6'], [1, '#c8bfe6']]);
      for (var y = LIP + 8, n = 0; y < H; y += 9 + n * 2, n++) r(g, x0, y, x1 - x0, 1, 'rgba(127,244,255,0.55)');
      for (var sx = x0 + 16; sx < x1; sx += 48) for (var yy = LIP + 1; yy < H; yy += 1) {
        var lean = (sx - (x0 + x1) / 2) * (yy - LIP) / 260;
        if ((yy & 1) === 0) r(g, sx + lean, yy, 1, 1, 'rgba(127,244,255,0.35)');
      }
      for (var s2 = 0; s2 < (x1 - x0) / 20; s2++) r(g, x0 + rnd() * (x1 - x0), LIP + 4 + rnd() * 60, 2, 1, 'rgba(255,255,255,0.8)');
    } else if (kind === 'garden') {
      P.vgrad(g, x0, LIP, x1 - x0, hgt, [[0, '#f4ecdc'], [0.35, '#e8dcc6'], [1, '#d0c0a8']]);
      for (var p = 0; p < (x1 - x0) / 5; p++) r(g, x0 + rnd() * (x1 - x0), LIP + 8 + rnd() * 62, 2 + rnd() * 4, 1, 'rgba(160,130,100,0.25)');
      for (var gx2 = x0; gx2 < x1; gx2 += 2) r(g, gx2, LIP - 2 - ((gx2 * 7) % 5 === 0 ? 2 : 0), 1, 3, gx2 % 6 ? LEAF2 : LEAF);
      for (var bf = x0 + 4; bf < x1; bf += 11) r(g, bf, LIP - 3 - (bf % 3), 1, 1, bf % 22 ? PINK : GOLD);
    } else if (kind === 'deck') {
      P.vgrad(g, x0, LIP, x1 - x0, hgt, [[0, '#e8c8a0'], [0.3, '#d8b088'], [1, '#b88c6a']]);
      for (var dy = LIP + 6, m = 0; dy < H; dy += 7 + Math.floor(m / 3), m++) r(g, x0, dy, x1 - x0, 1, 'rgba(130,80,60,0.3)');
      for (var hl = 0; hl < (x1 - x0) / 9; hl++) r(g, x0 + rnd() * (x1 - x0), LIP + 3 + rnd() * 50, 6 + rnd() * 12, 1, 'rgba(255,240,220,0.4)');
    }
  }

  function paintWalk(g, w, h) {
    var rnd = MS.util.rng(41);
    // ---- the skybridge: a garden tower door, suspension pylons, glass railing
    r(g, 0, 0, 44, LIP, '#f6f2ff'); r(g, 40, 0, 4, LIP, STONE2);
    for (var ty = 18; ty < LIP; ty += 26) { r(g, 0, ty, 46, 4, LEAF2); r(g, 0, ty + 4, 46, 1, LEAF3); for (var v = 2; v < 44; v += 7) r(g, v, ty + 5, 1, 3 + (v % 4), LEAF3); }
    r(g, 8, 84, 26, 62, '#2a3a5a'); r(g, 10, 86, 22, 60, '#3a5a8a'); disc(g, 21, 86, 11, '#3a5a8a', 1); r(g, 10, 86, 22, 2, GLOW);
    r(g, 12, 100, 18, 1, 'rgba(255,255,255,0.4)');
    [170, 470].forEach(function (px) {
      r(g, px - 3, 14, 6, LIP - 14, '#ffffff'); r(g, px + 2, 14, 1, LIP - 14, STONE3); r(g, px - 5, 10, 10, 4, '#ffffff');
      r(g, px - 1, 6, 2, 4, GLOW);
      for (var side = -1; side <= 1; side += 2) {
        for (var cx = 0; cx < 150; cx++) {
          var k = cx / 150;
          var cy = 16 + (LIP - 26 - 16) * Math.pow(k, 1.6);
          r(g, px + side * cx, cy, 1, 1, '#f4f2ff');
          if (cx % 14 === 7) r(g, px + side * cx, cy, 1, LIP - 24 - cy, 'rgba(255,255,255,0.45)');
        }
      }
    });
    railing(g, 44, BRIDGE_END, 120);
    // the idea queue: a holo board everyone politely waits in front of
    r(g, 300, 128, 3, 18, STONE3); r(g, 288, LIP - 2, 27, 2, STONE3);

    // ---- the plaza: trees in round planters, lamp posts, the fountain basin
    r(g, BRIDGE_END, 118, 440, 28, '#e8e2f6'); r(g, BRIDGE_END, 118, 440, 2, '#ffffff'); r(g, BRIDGE_END, 120, 440, 1, STONE3);
    for (var bx = BRIDGE_END + 12; bx < 1080; bx += 22) r(g, bx, 124, 1, 18, STONE2);
    tree(g, 690, 120, 16, 18); tree(g, 960, 120, 14, 16); tree(g, 1032, 118, 11, 14);
    [728, 900].forEach(function (lx) {
      r(g, lx, 58, 2, 60, '#ffffff'); r(g, lx + 2, 58, 1, 60, STONE3);
      disc(g, lx + 1, 54, 5, '#fff6d8'); disc(g, lx + 1, 54, 3, '#ffffff');
    });
    // fountain basin (the water is animated in drawBack)
    var fx = M.fountain;
    r(g, fx - 34, 128, 68, 18, '#ffffff'); r(g, fx - 34, 128, 68, 2, '#f8f6ff'); r(g, fx - 34, 140, 68, 6, STONE2);
    r(g, fx - 30, 130, 60, 4, 'rgba(127,244,255,0.9)');
    r(g, fx - 4, 92, 8, 36, '#ffffff'); r(g, fx + 2, 92, 2, 36, STONE3);
    r(g, fx - 16, 100, 32, 4, '#ffffff'); r(g, fx - 16, 104, 32, 1, STONE3);
    // garden beds behind the kiosk
    for (var gb = 1040; gb < 1190; gb += 3) {
      var hh = 8 + ((gb * 13) % 9);
      r(g, gb, LIP - 8 - hh, 2, hh, gb % 2 ? LEAF : LEAF3);
      if (gb % 9 === 0) r(g, gb - 1, LIP - 9 - hh, 3, 3, gb % 18 ? PINK : GOLD);
    }
    r(g, 1036, LIP - 9, 156, 9, '#ffffff'); r(g, 1036, LIP - 9, 156, 1, STONE2); r(g, 1036, LIP - 2, 156, 2, STONE3);

    // ---- the terraces: a green wall stepping up, and the waterfall
    r(g, 1200, 30, 560, LIP - 30, '#e6f4ea');
    for (var tr = 0; tr < 5; tr++) {
      var ty2 = 36 + tr * 22;
      r(g, 1200, ty2, 560, 4, '#ffffff'); r(g, 1200, ty2 + 4, 560, 1, STONE2);
      for (var pl = 1200; pl < 1760; pl += 2) {
        var ph = 3 + ((pl * 7 + tr * 13) % 7);
        r(g, pl, ty2 - ph, 1, ph, ((pl + tr) % 5) ? LEAF : LEAF3);
        if ((pl + tr * 3) % 13 === 0) r(g, pl, ty2 - ph - 1, 2, 2, (pl % 3) ? PINK : GOLD);
      }
      for (var vn = 1204 + tr * 9; vn < 1760; vn += 37) for (var vy = 0; vy < 6 + (vn % 8); vy++) r(g, vn + Math.round(Math.sin(vy * 0.7)), ty2 + 5 + vy, 1, 1, LEAF3);
    }
    r(g, 1200, 24, 560, 6, '#ffffff'); r(g, 1200, 28, 560, 2, STONE2);
    for (var arch = 1236; arch < 1740; arch += 120) {
      r(g, arch, 110, 3, 36, '#ffffff');
      for (var ax = 0; ax < 34; ax++) r(g, arch + ax, 110 - Math.round(Math.sin(ax / 34 * Math.PI) * 10), 1, 2, '#ffffff');
      r(g, arch + 34, 110, 3, 36, '#ffffff');
    }
    // the waterfall's pool and rocks (the falling water is animated in drawBack)
    r(g, 1438, 128, 70, 18, '#ffffff'); r(g, 1442, 130, 62, 6, 'rgba(127,244,255,0.95)'); r(g, 1438, 140, 70, 6, STONE2);
    r(g, 1452, 24, 42, 6, '#ffffff');

    // ---- the overlook: open sky, a railing, a coin telescope, flower boxes
    railing(g, 1760, w, 118);
    r(g, 2032, 100, 4, 46, '#8a6a8a'); r(g, 2024, 94, 20, 10, '#c8a0d8'); r(g, 2040, 96, 6, 6, '#a880c0'); r(g, 2026, 96, 4, 3, '#ffffff');
    r(g, 2026, LIP - 3, 16, 3, '#8a6a8a');
    [1800, 1900, 2120].forEach(function (fb) {
      r(g, fb, 110, 30, 8, '#c8a0d8'); r(g, fb, 110, 30, 1, '#e8c8f0');
      for (var fl = 0; fl < 10; fl++) { r(g, fb + 2 + fl * 3, 104 + (fl % 3), 2, 6, LEAF); r(g, fb + 2 + fl * 3, 102 + (fl % 3), 2, 2, fl % 2 ? PINK : GOLD); }
    });

    // ---- the walk itself, and the 1px lip along its back edge
    floorBand(g, 0, BRIDGE_END, 'bridge', rnd);
    floorBand(g, BRIDGE_END, 1196, 'plaza', rnd);
    floorBand(g, 1196, 1760, 'garden', rnd);
    floorBand(g, 1760, w, 'deck', rnd);
    r(g, 0, LIP, w, 1, '#4a3a6a');
    r(g, 0, LIP + 1, w, 1, 'rgba(255,255,255,0.5)');
    for (var lg = BRIDGE_END + 60; lg < 1196; lg += 120) r(g, lg, LIP + 30, 24, 2, 'rgba(127,244,255,0.6)');
  }

  var layers = [
    { speed: SKY_SPEED, haze: 0.05, paint: function (g, w, h) {
      var rnd = MS.util.rng(12);
      P.vgrad(g, 0, 0, w, h, [[0, '#4a4aa8'], [0.2, '#8a6ac8'], [0.4, '#e08ac0'], [0.56, '#ffb0a8'], [0.7, '#ffd8a8'], [0.86, '#fff0c8'], [1, '#fff6e0']]);
      for (var s = 0; s < 30; s++) { var sy = rnd() * 40; r(g, rnd() * w, sy, 1, 1, 'rgba(255,255,255,' + (0.9 - sy / 50) + ')'); }
      var sx = 330, sy2 = 96;
      P.radial(g, sx, sy2, 150, 'rgba(255,240,200,0.75)');
      P.radial(g, sx, sy2, 60, 'rgba(255,250,230,0.9)');
      disc(g, sx, sy2, 22, '#fffbec');
      for (var c = 0; c < 7; c++) cloud(g, rnd() * w, 26 + rnd() * 50, 0.8 + rnd() * 0.8, '#ffe0ec', '#f0a8c8');
      for (var b = 0; b < 5; b++) { var by = 70 + b * 7; r(g, sx - 70 + b * 9, by, 140 - b * 18, 1, 'rgba(255,255,255,0.35)'); }
    } },
    { speed: FAR_SPEED, haze: 0.45, paint: function (g, w, h) {
      var rnd = MS.util.rng(22);
      for (var i = 0; i < w / 22; i++) spire(g, rnd() * w, 156, 10 + rnd() * 16, 50 + rnd() * 80, rnd() > 0.5 ? '#c8b8e8' : '#a8c8f0', rnd() > 0.6, null);
      // mist below the city, so the drop under the skybridge feels deep
      P.vgrad(g, 0, 140, w, h - 140, [[0, 'rgba(255,230,240,0.9)'], [1, 'rgba(250,210,230,1)']]);
      for (var m = 0; m < 9; m++) cloud(g, rnd() * w, 170 + rnd() * 30, 1.2 + rnd(), '#fff4f8', '#f8d8e8');
    } },
    { speed: MID_SPEED, haze: 0.2, paint: function (g, w, h) {
      var rnd = MS.util.rng(32);
      var xs = [];
      for (var x = 30; x < w; x += 96 + Math.floor(rnd() * 40)) xs.push(x);
      xs.forEach(function (x, i) {
        var tw = 26 + rnd() * 16, th = 90 + rnd() * 60;
        spire(g, x, 216, tw, th + 60, i % 2 ? '#f0ecfa' : '#e2eef8', true, '#ffffff');
        if (i % 3 === 1) { // a waterfall pouring off a terrace
          var wx = x + tw / 2 + 2;
          for (var y = 216 - th + 10; y < h; y++) r(g, wx, y, 4, 1, y % 5 ? '#c8f4ff' : '#ffffff');
          r(g, wx - 2, 216 - th + 8, 8, 2, '#ffffff');
        }
        if (i < xs.length - 1 && i % 2 === 0) { // a skybridge to the next tower
          var nx = xs[i + 1], by = 216 - th + 30 + rnd() * 20;
          for (var bx = x; bx < nx; bx++) { var sag = Math.sin((bx - x) / (nx - x) * Math.PI) * 5; r(g, bx, by + sag, 1, 3, '#ffffff'); r(g, bx, by + sag + 3, 1, 1, GLOW); }
        }
      });
    }, after: function (g, w, camX, t) {
      if (w.reduced) return;
      for (var i = 0; i < 5; i++) {
        var x = ((t * (12 + i * 5) + i * 160) % (W + 80)) - 40;
        var y = 26 + i * 13 + Math.sin(t * 0.8 + i) * 2;
        r(g, x, y, 10, 3, '#f8f6ff'); r(g, x + 2, y - 1, 6, 1, GLOW); r(g, x - 5, y + 1, 5, 1, 'rgba(127,244,255,0.5)');
      }
    } },
    { speed: 1, paint: paintWalk },
    { speed: FRONT_SPEED, front: true, paint: function (g, w, h) {
      var rnd = MS.util.rng(52);
      for (var v = 0; v < w / 140; v++) {
        var x = rnd() * w, len = 14 + rnd() * 24;
        for (var y = 0; y < len; y++) r(g, x + Math.sin(y * 0.3) * 2, y, 2, 1, y % 6 ? '#2a8a5a' : PINK);
        r(g, x - 1, len, 4, 3, '#3ab87a');
      }
      for (var p = 80; p < w; p += 260 + Math.floor(rnd() * 180)) {
        for (var l = 0; l < 8; l++) {
          var lx = p + l * 6 - 20, lh = 14 + (l * 7) % 12;
          for (var yy = 0; yy < lh; yy++) r(g, lx + Math.round(Math.sin(yy * 0.3 + l) * 2), H - yy, 4 - Math.floor(yy / 6), 1, l % 2 ? '#1f6a4a' : '#2a8a5a');
          r(g, lx, H - lh - 2, 3, 3, l % 3 ? PINK : GOLD);
        }
      }
    } }
  ];

  // ------------------------------------------------------------ props (solids)
  function solidImg(s) {
    return once('solid:' + s.kind + s.w + 'x' + s.h, function () {
      return stamp(s.w, s.h, function (g, w, h) {
        if (s.kind === 'bench') {
          r(g, 0, 0, w, 3, '#ffffff'); r(g, 0, 3, w, 1, STONE2); r(g, 0, 4, w, 1, GLOW);
          r(g, 3, 5, 3, h - 5, '#e8e4f8'); r(g, w - 6, 5, 3, h - 5, '#e8e4f8'); r(g, 6, 7, w - 12, 1, STONE3);
        } else if (s.kind === 'planter') {
          var pot = Math.min(12, h - 6);
          for (var l = 0; l < w / 2; l++) {
            var lh = h - pot - 1 - ((l * 5) % 5);
            r(g, l * 2, h - pot - lh, 2, lh, l % 2 ? LEAF3 : LEAF);
            if (l % 3 === 0) r(g, l * 2, h - pot - lh - 1, 2, 2, l % 2 ? GOLD : PINK);
          }
          r(g, 0, h - pot, w, pot, '#ffffff'); r(g, 0, h - pot, w, 2, '#f8f6ff'); r(g, 1, h - 3, w - 2, 3, STONE2); r(g, 2, h - pot + 4, w - 4, 1, GLOW);
        } else if (s.kind === 'pod') {
          r(g, 0, 2, w, h - 2, '#f4f2ff'); r(g, 0, 2, w, 1, '#ffffff'); r(g, 0, h - 3, w, 3, STONE2);
          r(g, 2, 0, w - 4, 2, '#e8e4f8'); r(g, 3, 5, w - 6, 3, GLOW); r(g, w / 2 - 1, 9, 2, 2, GOLD);
        } else if (s.kind === 'kiosk') {
          r(g, 1, 4, w - 2, h - 4, '#f4f2ff'); r(g, 1, 4, w - 2, 1, '#ffffff'); r(g, 0, h - 3, w, 3, STONE2);
          r(g, 2, 0, w - 4, 4, '#3a4a7a'); r(g, 4, 1, w - 8, 2, GLOW);
          r(g, 4, 8, w - 8, 6, '#2a3a5a'); r(g, 5, 9, 2, 1, GLOW); r(g, 5, 11, 4, 1, GLOW2);
        }
      });
    });
  }
  var props = [];
  SOLIDS.forEach(function (s) {
    props.push({ x: s.x, z: -1, draw: function (g, sx) { g.drawImage(solidImg(s), sx - 1, G - s.h - 1); } });
  });

  // ------------------------------------------------------------ live drawing
  function drawBack(g, w, camX, t) {
    var calm = w.reduced;
    // fountain jets
    var fx = M.fountain - camX;
    if (fx > -60 && fx < W + 60) {
      for (var j = -1; j <= 1; j++) {
        for (var k = 0; k < 14; k++) {
          var ph = calm ? k / 14 : ((t * 1.4 + k / 14) % 1);
          var px = fx + j * ph * 22, py = 92 - Math.sin(ph * Math.PI) * (j ? 14 : 26) + ph * (j ? 34 : 8);
          r(g, px, py, 2, 2, k % 3 ? '#c8f4ff' : '#ffffff');
        }
      }
    }
    // the waterfall into the terrace pool
    var wx = 1460 - camX;
    if (wx > -60 && wx < W + 60) {
      for (var y = 30; y < 132; y++) {
        var off = calm ? 0 : Math.floor(t * 40);
        for (var c = 0; c < 26; c += 2) r(g, wx + c, y, 2, 1, ((y + off + c * 3) % 7) ? '#c8f4ff' : '#ffffff');
      }
      if (!calm) for (var sp = 0; sp < 8; sp++) r(g, wx - 4 + ((t * 30 + sp * 11) % 34), 126 - ((t * 20 + sp * 7) % 6), 2, 2, '#ffffff');
    }
    // the idea queue holo board on the skybridge
    var qx = 302 - camX;
    if (qx > -70 && qx < W + 70) {
      var flick = !calm && Math.floor(t * 12) % 23 === 0;
      if (!flick) {
        g.fillStyle = 'rgba(127,244,255,0.18)'; g.fillRect(qx - 34, 60, 68, 66);
        g.fillStyle = 'rgba(20,30,70,0.6)'; g.fillRect(qx - 32, 62, 64, 62);
        r(g, qx - 32, 62, 64, 1, GLOW); r(g, qx - 32, 123, 64, 1, GLOW);
        F.drawCentered(g, 'IDEA QUEUE', qx, 65, GLOW2);
        F.drawCentered(g, 'NOW: #12', qx, 79, '#ffffff');
        F.drawCentered(g, 'YOU: #4812', qx, 91, GOLD);
        F.drawCentered(g, 'REVIEW: Q3', qx, 105, PINK);
      }
    }
    drawTools(g, w, camX, t);
    drawBoard(g, w, camX, t);
  }

  function drawHolo(g, w, camX, t) {
    var k = w.state.proto || 0;
    if (!k) return;
    var x = Math.round(HOLO.x - camX), y = HOLO.y;
    if (x < -HOLO.w - 10 || x > W + 10) return;
    var hh = Math.round(HOLO.h * k);
    var flick = !w.reduced && k < 1 && Math.floor(t * 30) % 3 === 0;
    if (flick) return;
    var top = y + HOLO.h - hh;
    // the beam from the kiosk
    g.fillStyle = 'rgba(127,244,255,0.16)';
    g.beginPath(); g.moveTo(x + HOLO.w / 2 - 3, G - 22); g.lineTo(x + HOLO.w / 2 + 3, G - 22); g.lineTo(x + HOLO.w - 6, top + hh); g.lineTo(x + 6, top + hh); g.fill();
    g.fillStyle = 'rgba(127,244,255,0.16)'; g.fillRect(x - 3, top - 3, HOLO.w + 6, hh + 6);
    g.fillStyle = 'rgba(10,30,60,0.6)'; g.fillRect(x, top, HOLO.w, hh);
    g.fillStyle = GLOW;
    g.fillRect(x, top, HOLO.w, 1); g.fillRect(x, top + hh - 1, HOLO.w, 1); g.fillRect(x, top, 1, hh); g.fillRect(x + HOLO.w - 1, top, 1, hh);
    g.save();
    g.beginPath(); g.rect(x, top, HOLO.w, hh); g.clip();
    var yy = y;
    // three steps
    [0, 1, 2].forEach(function (i) {
      r(g, x + 11 + i * 16, yy + 6, 6, 6, i === 0 ? GOLD : GLOW);
      if (i < 2) r(g, x + 17 + i * 16, yy + 8, 10, 1, GLOW);
    });
    // saved cards
    r(g, x + 6, yy + 17, HOLO.w - 12, 14, 'rgba(127,244,255,0.32)');
    r(g, x + 9, yy + 20, 12, 8, GOLD); r(g, x + 10, yy + 22, 10, 1, '#c8901a');
    r(g, x + 24, yy + 21, 22, 1, '#eaffff'); r(g, x + 24, yy + 25, 14, 1, '#bfefff');
    r(g, x + 6, yy + 33, HOLO.w - 12, 7, 'rgba(127,244,255,0.22)'); r(g, x + 9, yy + 35, 8, 3, PINK); r(g, x + 24, yy + 36, 18, 1, '#bfefff');
    // one big friendly button
    var pulse = w.reduced ? 0 : Math.round(Math.sin(t * 4));
    r(g, x + 6, yy + 45 - pulse, HOLO.w - 12, 12, GOLD);
    r(g, x + 6, yy + 56 - pulse, HOLO.w - 12, 1, '#c8901a');
    F.drawCentered(g, 'PAY', x + HOLO.w / 2, yy + 47 - pulse, '#2a1a40');
    for (var sy = top; sy < top + hh; sy += 3) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, sy, HOLO.w, 1); }
    g.restore();
  }

  // [ideas bloom]: a thought bubble over each citizen and dev turns into a tiny prototype.
  function bloomers(w) {
    return w.ids.filter(function (id) {
      var a = w.actors[id];
      var c = w.set.cast[id];
      return a.visible && id !== 'SAM' && c && c.groups && (c.groups.indexOf('CITIZENS') >= 0 || c.groups.indexOf('DEVS') >= 0);
    });
  }
  function drawBloom(g, w, camX, t) {
    var k = w.state.bloom || 0;
    if (!k) return;
    bloomers(w).forEach(function (id, i) {
      var a = w.actors[id];
      var x = Math.round(a.x - camX), head = Math.round(G + a.y - 52);
      if (x < -20 || x > W + 20) return;
      var e = k >= 1 ? 1 : Math.max(0, Math.min(1, (k - i * 0.06) / 0.76));
      var bob = w.reduced ? 0 : Math.round(Math.sin(t * 2 + i) * 1);
      var cx = x + (a.facing || 1) * 3, cy = head - 10 + bob;
      if (e < 0.6) {
        // the thought bubble pops up, then squeezes into a screen
        var s = Math.min(1, e / 0.25), sq = Math.max(0, (e - 0.35) / 0.25);
        var bw = Math.round(16 * s * (1 - sq * 0.4)), bh = Math.round(12 * s * (1 + sq * 0.2));
        if (bw < 2) return;
        r(g, cx - bw / 2 - 1, cy - bh / 2, bw + 2, bh, INK); r(g, cx - bw / 2, cy - bh / 2 - 1, bw, bh + 2, INK);
        r(g, cx - bw / 2, cy - bh / 2, bw, bh, '#ffffff');
        r(g, cx - (a.facing || 1) * 4, cy + bh / 2 + 2, 2, 2, '#ffffff'); r(g, cx - (a.facing || 1) * 6, cy + bh / 2 + 5, 1, 1, '#ffffff');
        if (s >= 1) { disc(g, cx, cy - 1, 3, GOLD); r(g, cx - 1, cy + 2, 3, 2, '#c8c0d8'); }
      } else {
        // a tiny working prototype: a phone-sized holo with a card and a button
        var u = Math.min(1, (e - 0.6) / 0.4);
        var pw = 10, ph = Math.max(2, Math.round(14 * u));
        g.fillStyle = 'rgba(127,244,255,0.22)'; g.fillRect(cx - pw / 2 - 2, cy - ph / 2 - 2, pw + 4, ph + 4);
        g.fillStyle = 'rgba(10,30,60,0.7)'; g.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
        r(g, cx - pw / 2, cy - ph / 2, pw, 1, GLOW); r(g, cx - pw / 2, cy + ph / 2 - 1, pw, 1, GLOW);
        if (u >= 1) {
          r(g, cx - 3, cy - 4, 6, 3, 'rgba(127,244,255,0.6)');
          r(g, cx - 3, cy + 1, 6, 3, (Math.floor(t * 2 + i) % 2 && !w.reduced) ? '#ffe9a0' : GOLD);
        }
      }
    });
  }

  // ------------------------------------------------------------ the research beat
  // The researcher's backlog is a mountain of sticky notes heaped over the kiosk. [the notes
  // sort] lifts it into three colour clusters that fold into a three-page draft report hanging
  // in a hologram right of the 'hologram' mark. [the report is checked] walks the researcher
  // along it, stamping every page CHECKED. [prototype appears] files the checked report beside
  // the prototype, and [tools rise] raises what the saved time built. All drawn from w.state.
  var U = MS.util;
  var PILE = { x: 1100, half: 36, h: 52 };
  var NOTE_INK = [['#ffe066', '#c89a2a', '#fff8c8'], ['#ff9ac8', '#c4568e', '#ffe0f0'], ['#8ef0b8', '#2fa874', '#e0fff0']];
  var PAGE = { xs: [1252, 1282, 1312], y: 103, w: 26, h: 36 };
  var BOARD = { x: 1246, y: 88, w: 98, h: 56 };
  var STAND = [1250, 1280, 1310]; // where the researcher stands to stamp each page
  var HOME = 1226;                // and steps back to afterwards, clear of the stamps
  var DOCK = { x: 1123, y: 52 };  // the filed report, pinned beside the prototype (clear of the HUD)
  var STAMP_INK = '#1e9a58', CHECK_GLOW = '#a8ffc8';
  var SORT = { lift: 0.2, fly: 0.46, fold: 0.7 }; // as fractions of the sort
  var CLUSTER_Y = 56;

  var NOTES = (function () {
    var rnd = U.rng(404), out = [];
    var rows = Math.floor(PILE.h / 4);
    for (var k = 0; k < rows; k++) { // bottom row first, so each note lies on the one below
      var hw = PILE.half * (1 - Math.pow(k / rows, 1.3));
      for (var x = -hw + (k % 2) * 2; x <= hw - 3; x += 4) {
        out.push({ px: Math.round(PILE.x + x + (rnd() - 0.5) * 2), py: Math.round(G - 4 - k * 4 + (rnd() - 0.5) * 2), mark: rnd() < 0.6, spin: rnd() * 6.283 });
      }
    }
    var cols = out.map(function (n, i) { return i % 3; });
    for (var i = cols.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), s = cols[i]; cols[i] = cols[j]; cols[j] = s; }
    var count = [0, 0, 0];
    out.forEach(function (n, i) {
      n.c = cols[i]; n.j = count[n.c]++;
      n.qx = PAGE.xs[n.c] + 1 + (n.j % 6) * 4;
      n.qy = CLUSTER_Y + Math.floor(n.j / 6) * 4;
    });
    // the top of the heap lifts first
    out.slice().sort(function (a, b) { return a.py - b.py || Math.abs(a.px - PILE.x) - Math.abs(b.px - PILE.x); })
      .forEach(function (n, o) { n.s = SORT.lift * o / out.length; });
    return out;
  })();

  function note(g, x, y, c, mark) {
    var k = NOTE_INK[c];
    r(g, x, y, 4, 3, k[0]); r(g, x, y + 3, 4, 1, k[1]); r(g, x, y, 1, 1, k[2]);
    if (mark) r(g, x + 1, y + 1, 2, 1, k[1]);
  }
  function foldOf(w) { return U.clamp(((w.state.sorted || 0) - SORT.fold) / (1 - SORT.fold), 0, 1); }
  function filedOf(w) { return Math.max(w.state.proto || 0, w.state.tools || 0); }
  function stampsOf(w) { return Math.round((w.state.checked || 0) * 3); }

  // The heap itself: a prop just in front of the kiosk, so the kiosk is buried until it sorts.
  props.push({ x: PILE.x, z: -0.5, draw: function (g, sx, w) {
    var k = w.state.sorted || 0;
    if (k >= 1) return;
    var off = sx - PILE.x;
    NOTES.forEach(function (n) { if (k <= n.s) note(g, n.px + off, n.py, n.c, n.mark); });
  } });

  // Notes in the air: up off the heap, a swirl, a neat grid per colour, then down into a page.
  function drawFlyingNotes(g, w, camX) {
    var k = w.state.sorted || 0;
    if (k <= 0 || k >= 1) return;
    var f = foldOf(w);
    if (f >= 0.5) return;
    var ef = U.ease['in'](f / 0.5);
    NOTES.forEach(function (n) {
      var u = U.clamp((k - n.s) / SORT.fly, 0, 1);
      if (u <= 0) return;
      var e = U.ease.inOut(u), arc = Math.sin(Math.PI * u), a = n.spin + u * 7;
      var x = U.lerp(n.px, n.qx, e) + Math.cos(a) * 14 * arc;
      var y = U.lerp(n.py, n.qy, e) - arc * 34 + Math.sin(a) * 9 * arc;
      if (f > 0) y = U.lerp(y, PAGE.y + 1 + Math.floor(n.j / 6) * 0.5, ef);
      note(g, Math.round(x - camX), Math.round(y), n.c, n.mark);
    });
  }

  // A 3x5 face for the stamp, so CHECKED fits a page.
  var TINY = {
    C: ['###', '#..', '#..', '#..', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'], E: ['###', '#..', '##.', '#..', '###'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], D: ['##.', '#.#', '#.#', '#.#', '##.']
  };
  function stampMark(g, cx, cy, ink) {
    var x0 = Math.round(cx) - 15, y0 = Math.round(cy) - 4;
    g.fillStyle = ink;
    function px(x, y) { g.fillRect(x0 + x, y0 + y - Math.floor(x / 11), 1, 1); } // a slightly skewed press
    for (var x = 0; x < 31; x++) { px(x, 0); px(x, 8); }
    for (var y = 1; y < 8; y++) { px(0, y); px(30, y); }
    'CHECKED'.split('').forEach(function (ch, i) {
      TINY[ch].forEach(function (row, yy) { for (var xx = 0; xx < 3; xx++) if (row[xx] === '#') px(2 + i * 4 + xx, 2 + yy); });
    });
  }

  function drawPage(g, x, y, i, hgt, stamped, age, calm) {
    if (hgt <= 0) return;
    var pw = PAGE.w, k = NOTE_INK[i];
    var jolt = stamped && !calm && age < 0.08 ? 1 : 0;
    y += jolt;
    r(g, x - 1, y - 1, pw + 2, hgt + 2, 'rgba(127,244,255,0.35)');
    r(g, x, y, pw, hgt, '#fbfaff');
    r(g, x + pw - 1, y, 1, hgt, STONE2); r(g, x, y + hgt - 1, pw, 1, STONE3);
    r(g, x, y, pw, Math.min(hgt, 5), k[0]); r(g, x, Math.min(hgt, 5) + y - 1, pw, 1, k[1]);
    if (hgt > 3) r(g, x + 2, y + 2, 10 + i * 3, 1, '#ffffff');
    function line(ry, len, col) { if (ry < hgt - 1) r(g, x + 3, y + ry, len, 1, col || '#a8a0c8'); }
    line(8, 19); line(11, 15); line(14, 18 - i * 2);
    if (i === 0) { if (hgt > 28) [[0, 4], [4, 7], [8, 5], [12, 9]].forEach(function (b) { r(g, x + 4 + b[0], y + 27 - b[1], 3, b[1], b[0] === 12 ? k[1] : '#c8c0e0'); }); }
    else if (i === 1) { line(18, 6, k[1]); line(18 + 3, 17); line(24, 12); line(27, 16); }
    else { [0, 1, 2].forEach(function (q) { if (19 + q * 5 < hgt - 2) { r(g, x + 3, y + 18 + q * 5, 3, 3, NOTE_INK[q][0]); line(19 + q * 5, 12); } }); }
    if (stamped && hgt >= PAGE.h) {
      var sy = y + [26, 22, 28][i];
      stampMark(g, x + pw / 2, sy, STAMP_INK);
      if (!calm && age < 0.2) { // the thunk: short impact lines
        var o = 18 + Math.round(age * 20);
        g.fillStyle = '#ffffff';
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) { g.fillRect(Math.round(x + pw / 2 + d[0] * o), Math.round(sy + d[1] * (6 + age * 10)), 2, 1); });
      }
    }
  }

  // The research hologram right of the 'hologram' mark: tall while the notes cluster on it
  // (dark glass, so the pastel notes read against the bright terraces), then it settles to
  // frame the draft report.
  var WALL_TOP = 42, SHOW_AT = 0.1;
  function drawBoard(g, w, camX, t) {
    var k = w.state.sorted || 0;
    if (k <= SHOW_AT || filedOf(w) > 0) return;
    var x = BOARD.x - camX;
    if (x > W + 10 || x + BOARD.w < -10) return;
    var f = foldOf(w), a = U.clamp((k - SHOW_AT) / 0.15, 0, 1), calm = w.reduced;
    var y = Math.round(U.lerp(WALL_TOP, BOARD.y, U.ease.inOut(f))), bh = BOARD.y + BOARD.h - y;
    var bw = Math.round(BOARD.w * U.ease.out(a)), bx = x + Math.round((BOARD.w - bw) / 2);
    g.fillStyle = 'rgba(127,244,255,0.16)'; g.fillRect(bx - 3, y - 3, bw + 6, bh + 6);
    g.fillStyle = 'rgba(10,30,60,0.62)'; g.fillRect(bx, y, bw, bh);
    r(g, bx, y, bw, 1, GLOW); r(g, bx, y + bh - 1, bw, 1, GLOW);
    if (a >= 1) {
      [[0, 0, 1], [BOARD.w - 5, 0, -1], [0, bh - 1, 1], [BOARD.w - 5, bh - 1, -1]].forEach(function (c, ci) {
        r(g, x + c[0], y + c[1], 5, 1, '#ffffff'); r(g, x + (c[2] > 0 ? 0 : BOARD.w - 1), y + c[1] + (ci < 2 ? 0 : -4), 1, 5, '#ffffff');
      });
    }
    for (var sy = y; sy < y + bh; sy += 3) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(bx, sy, bw, 1); }
    var n = stampsOf(w), fx = w.futureFx || {}, at = fx.stampAt || [];
    var unroll = f < 0.35 ? 0 : Math.max(5, Math.round(PAGE.h * U.ease.out(U.clamp((f - 0.45) / 0.55, 0, 1))));
    PAGE.xs.forEach(function (px, i) {
      drawPage(g, px - camX, PAGE.y, i, unroll, i < n, at[i] != null ? w.time - at[i] : 9, calm);
    });
    var title = a < 1 ? null : f < 0.3 ? 'AI CLUSTERING' : f < 0.8 ? null : (w.state.checked || 0) >= 1 ? 'HUMAN CHECKED ✓' : 'AI DRAFT';
    if (title) F.drawCentered(g, title, x + BOARD.w / 2, y + 4, title.charAt(0) === 'H' ? CHECK_GLOW : GLOW2);
  }

  // Once the prototype appears (or the tools rise) the checked report files itself beside it.
  function drawFiled(g, w, camX) {
    var u = filedOf(w);
    if (u <= 0 || (w.state.sorted || 0) < 1) return;
    var e = U.ease.inOut(u), n = stampsOf(w);
    if (e < 1) {
      g.save(); g.globalAlpha = 1 - e;
      g.fillStyle = 'rgba(127,244,255,0.16)'; g.fillRect(BOARD.x - camX - 3, BOARD.y - 3, BOARD.w + 6, BOARD.h + 6);
      g.restore();
    }
    for (var i = 2; i >= 0; i--) {
      var tx = DOCK.x + (2 - i) * 3, ty = DOCK.y + (2 - i) * 2;
      var x = Math.round(U.lerp(PAGE.xs[i], tx, e) - camX), y = Math.round(U.lerp(PAGE.y, ty, e) - Math.sin(Math.PI * e) * 14);
      if (x < -40 || x > W + 10) continue;
      var pw = Math.round(U.lerp(PAGE.w, 9, e)), ph = Math.round(U.lerp(PAGE.h, 12, e));
      r(g, x - 1, y - 1, pw + 2, ph + 2, INK);
      r(g, x, y, pw, ph, '#fbfaff');
      r(g, x, y, pw, Math.max(1, Math.round(5 * pw / PAGE.w)), NOTE_INK[i][0]);
      if (i < n) r(g, x + 1, y + Math.round(ph * 0.62), pw - 2, Math.max(1, Math.round(ph * 0.18)), STAMP_INK);
    }
    if (e >= 1 && n >= 3) F.draw(g, '✓', DOCK.x + 9 - camX, DOCK.y - 4, CHECK_GLOW, { shadow: INK });
  }

  // [tools rise]: glass towers push up out of the walk's back edge, team tools first.
  var TOOLS = [
    { label: 'TEAM TOOLS', x: 1258, from: 0, to: 0.34, ly: 98, col: GLOW, parts: [[-16, 10, 22, 'gear'], [-4, 11, 32, 'chart'], [9, 10, 18, 'pen']] },
    { label: 'HR TOOL', x: 1306, from: 0.3, to: 0.62, ly: 76, col: PINK, parts: [[-11, 22, 56, 'badge']] },
    { label: 'AR SALES TOOL', x: 1356, from: 0.5, to: 0.82, ly: 62, col: GOLD, parts: [[-13, 26, 70, 'cube']] },
    { label: '+ MORE', x: 1382, from: 0.78, to: 1, ly: 42, col: GOLD, more: true, parts: [[-6, 10, 44], [6, 10, 56]] }
  ];
  function riseOf(tool, k) { return U.clamp((k - tool.from) / (tool.to - tool.from), 0, 1); }

  function icon(g, kind, cx, y, col) {
    if (kind === 'gear') { disc(g, cx, y + 3, 3, GOLD); r(g, cx - 1, y + 2, 2, 2, '#2a3a6a'); }
    else if (kind === 'chart') { r(g, cx - 4, y + 4, 2, 3, GLOW); r(g, cx - 1, y + 2, 2, 5, GOLD); r(g, cx + 2, y, 2, 7, PINK); }
    else if (kind === 'pen') { for (var p = 0; p < 6; p++) r(g, cx - 2 + p, y + 5 - p, 1, 2, p < 2 ? INK : PINK); }
    else if (kind === 'badge') {
      r(g, cx - 5, y, 11, 13, '#ffffff'); r(g, cx - 5, y, 11, 3, col); r(g, cx - 1, y - 2, 3, 2, STONE3);
      disc(g, cx, y + 6, 2, '#c88a5c'); r(g, cx - 3, y + 9, 7, 2, col); r(g, cx - 3, y + 12, 7, 1, STONE3);
    } else if (kind === 'cube') {
      [[-8, -1], [7, -1]].forEach(function (b) { r(g, cx + b[0], y - 1, 2, 1, '#ffffff'); r(g, cx + b[0] + (b[0] < 0 ? 0 : 1), y - 1, 1, 3, '#ffffff'); r(g, cx + b[0], y + 12, 2, 1, '#ffffff'); r(g, cx + b[0] + (b[0] < 0 ? 0 : 1), y + 10, 1, 3, '#ffffff'); });
      r(g, cx - 4, y + 3, 7, 7, GOLD); r(g, cx - 3, y + 1, 7, 2, '#fff0b0'); r(g, cx + 3, y + 2, 2, 7, '#c8901a');
    }
  }

  function sign(g, text, cx, y, col, alpha) {
    var tw = F.measure(text), x = Math.round(cx - tw / 2) - 3;
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = 'rgba(20,30,70,0.78)'; g.fillRect(x, y - 2, tw + 6, 11);
    r(g, x, y - 2, tw + 6, 1, col); r(g, x, y + 8, tw + 6, 1, col);
    F.draw(g, text, x + 3, y, '#ffffff');
    g.restore();
  }

  function drawTools(g, w, camX, t) {
    var k = w.state.tools || 0;
    if (k <= 0) return;
    var calm = w.reduced;
    TOOLS.forEach(function (tool) {
      var p = riseOf(tool, k);
      if (p <= 0) return;
      var cx = tool.x - camX;
      if (cx < -60 || cx > W + 60) return;
      var grow = U.ease.outBack(p);
      tool.parts.forEach(function (pt) {
        var x = Math.round(cx + pt[0]), w2 = pt[1], h = Math.max(1, Math.round(pt[2] * Math.min(grow, 1.08)));
        var top = LIP - h;
        if (tool.more) { // the next departments, waiting in line: dashed outlines
          g.fillStyle = 'rgba(255,211,106,' + (0.35 + 0.4 * p) + ')';
          for (var dy = 0; dy < h; dy += 2) { g.fillRect(x, top + dy, 1, 1); g.fillRect(x + w2 - 1, top + dy, 1, 1); }
          for (var dx = 0; dx < w2; dx += 2) g.fillRect(x + dx, top, 1, 1);
          return;
        }
        // dark holo glass, like the report's hologram, so it reads against the bright terraces
        g.fillStyle = 'rgba(127,244,255,0.28)'; g.fillRect(x - 2, top - 2, w2 + 4, h + 2);
        g.fillStyle = 'rgba(16,34,80,0.84)'; g.fillRect(x, top, w2, h);
        for (var wy = top + 15; wy < LIP - 3; wy += 5) for (var wx = x + 2; wx < x + w2 - 3; wx += 3) {
          var lit = (wx * 3 + wy * 7) % 13;
          if (lit > 2) r(g, wx, wy, 2, 2, lit % 5 ? 'rgba(191,248,255,0.85)' : lit % 2 ? GOLD : tool.col);
        }
        r(g, x, top, 1, h, tool.col); r(g, x + w2 - 1, top, 1, h, tool.col);
        r(g, x, top, w2, 1, '#ffffff'); r(g, x + 1, top + 1, w2 - 2, 1, tool.col);
        if (h > 12) icon(g, pt[3], x + Math.floor(w2 / 2), top + 4, tool.col);
        if (p < 1 && !calm) { // a scan line rides the top while it rises
          r(g, x - 3, top - 1, w2 + 6, 1, '#ffffff');
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, top - 14, w2, 13);
        }
      });
      if (p >= 0.7) {
        var la = Math.min(1, (p - 0.7) / 0.3);
        if (tool.more) {
          var glow = calm ? 0.3 : 0.3 + 0.15 * Math.sin(t * Math.PI * 1.6); // a slow breathe, under 1 Hz
          g.fillStyle = 'rgba(255,211,106,' + (glow * la) + ')';
          var mw = F.measure(tool.label);
          g.fillRect(Math.round(cx - mw / 2) - 6, tool.ly - 5, mw + 12, 17);
        }
        sign(g, tool.label, cx, tool.ly + Math.round((1 - la) * 3), tool.col, la);
      }
    });
  }

  function drawFront(g, w, camX, t) { drawHolo(g, w, camX, t); drawFiled(g, w, camX); drawBloom(g, w, camX, t); drawFlyingNotes(g, w, camX); }

  function update(w, dt) {
    if (w.reduced) return;
    var fx = w.futureFx || (w.futureFx = { mote: 0 }); // cosmetic: kept out of w.state, which replay must match
    fx.mote -= dt;
    if (fx.mote <= 0) {
      fx.mote = 0.25;
      w.fx.particles.push({ x: w.camera.x + Math.random() * W, y: 60 + Math.random() * 90, vx: 3, vy: -6, g: 0, life: 3, color: Math.random() > 0.5 ? '#fff6c8' : '#bff8ff', size: 1, floor: false });
    }
  }

  MS.sets = MS.sets || {};
  MS.sets.future = {
    name: 'future', era: 'future', width: WIDTH, ground: G, camera: 0, entry: 64, bg: '#4a4aa8',
    music: 'future', crowd: 'CITIZENS', haze: '#f0cfe0',
    marks: {
      skybridge: M.skybridge, bridge: M.skybridge, plaza: M.plaza, fountain: M.fountain, garden: M.garden,
      kiosk: KIOSK, hologram: M.hologram, terraces: M.terraces, waterfall: M.terraces, overlook: M.overlook
    },
    // The citizens gather around the kiosk facing each other; DEV 1, DEV 2 and the General
    // wait off stage right until the script brings them in.
    cast: {
      SAM: { names: ['SAM'], costume: 'sam5', x: -40, visible: false },
      CITIZEN1: { names: ['CITIZEN 1'], costume: 'citizen1', x: 1050, groups: ['CITIZENS'] },
      CITIZEN2: { names: ['CITIZEN 2'], costume: 'citizen2', x: 1116, facing: -1, groups: ['CITIZENS'] },
      CITIZEN3: { names: ['CITIZEN 3'], costume: 'citizen3', x: 1144, facing: -1, groups: ['CITIZENS'] },
      DESIGNER: { names: ['DESIGNER', 'THE DESIGNER'], costume: 'designer2', x: 1172, facing: -1, groups: ['CITIZENS'] },
      // the researcher stands at the foot of their sticky-note mountain, answering CITIZEN 1
      RESEARCHER: { names: ['RESEARCHER', 'THE RESEARCHER'], costume: 'researcher', x: 1083, facing: -1, groups: ['CITIZENS'] },
      HRLEAD: { names: ['HR LEAD', 'THE HR LEAD'], costume: 'hrlead', x: WIDTH + 40, visible: false, facing: -1, groups: ['CITIZENS'] },
      SALESREP: { names: ['SALES REP', 'THE SALES REP'], costume: 'salesrep', x: WIDTH + 50, visible: false, facing: -1, groups: ['CITIZENS'] },
      DEV1: { names: ['DEV 1'], costume: 'dev1f', x: WIDTH + 60, visible: false, facing: -1, groups: ['DEVS'] },
      DEV2: { names: ['DEV 2'], costume: 'dev2f', x: WIDTH + 80, visible: false, facing: -1, groups: ['DEVS'] },
      GENERAL: { names: ['GENERAL BULLETPOINT', 'BULLETPOINT', 'THE GENERAL'], costume: 'generalf', x: WIDTH + 100, visible: false, facing: -1 }
    },
    events: [
      { id: 'proto', match: /^(?:the |a )?(?:prototype|hologram) (appears|vanishes|disappears)$/ },
      { id: 'bloom', match: /^(?:the |all the )?ideas? (?:bloom|blooms|blossom|blossoms|come to life|become prototypes)$/ },
      { id: 'sort', match: /^(?:the |all the )?(?:sticky )?notes? (?:sort|sorts|get sorted|are sorted|cluster|clusters|sort themselves)$/ },
      { id: 'check', match: /^(?:the )?(?:draft )?report (?:is |gets )?(?:checked|stamped|approved|reviewed)$/ },
      { id: 'tools', match: /^(?:the )?(?:new )?tools? (?:rise|rises|appear|appears|go up|goes up|get built|are built)$/ }
    ],
    eventsById: {
      proto: { run: function (w, args, Task) {
        var on = args[0] === 'appears';
        var played = false;
        return new Task(on ? 1.3 : 0.4, function (t) {
          w.state.proto = on ? Math.min(1, t / 1.3) : Math.max(0, 1 - t / 0.4);
          if (on && !played && !w.instant) { played = true; w.sfx('hologram'); }
        }, function () { w.state.proto = on ? 1 : 0; });
      } },
      bloom: { run: function (w, args, Task) {
        var played = false, popped = {};
        return new Task(1.6, function (t) {
          var k = w.state.bloom = Math.min(1, t / 1.6);
          if (w.instant) return;
          if (!played) { played = true; w.sfx('hologram'); }
          if (w.reduced) return;
          bloomers(w).forEach(function (id, i) {
            if (popped[id] || (k - i * 0.06) / 0.76 < 0.6) return;
            popped[id] = true;
            var a = w.actors[id];
            w.burst(a.x + (a.facing || 1) * 3, G + a.y - 62, 8, { kind: 'spark', colors: [GLOW, '#ffffff', GOLD], speed: 60, g: 0, spread: Math.PI * 2, life: 0.4, floor: false });
          });
        }, function () { w.state.bloom = 1; });
      } },
      // The heap lifts, swirls into three colour clusters, and they fold into a draft report.
      sort: { run: function (w, args, Task) {
        var D = 2.5, cue = {};
        return new Task(D, function (t) {
          var k = w.state.sorted = Math.min(1, t / D);
          if (w.instant) return;
          if (!cue.lift) { cue.lift = true; w.sfx('paper'); }
          if (!cue.grid && k >= SORT.fold - 0.03) { cue.grid = true; w.sfx('select'); }
          if (!cue.fold && k >= SORT.fold + 0.15) {
            cue.fold = true; w.sfx('hologram');
            if (!w.reduced) PAGE.xs.forEach(function (px, i) { w.burst(px + PAGE.w / 2, PAGE.y + 2, 6, { kind: 'spark', colors: [NOTE_INK[i][0], '#ffffff', GLOW], speed: 50, g: 0, spread: Math.PI * 2, life: 0.4, floor: false }); });
          }
        }, function () { w.state.sorted = 1; });
      } },
      // A human checks every finding: the researcher walks the report, stamping each page.
      check: { run: function (w, args, Task) {
        var a = w.actors.RESEARCHER;
        var who = a && a.visible ? a : null;
        var SPEED = 100, STAMP = 0.46, HIT = 0.22; // HIT: the 'throw' pose's forward frame
        var plan = [], at = 0, x = who ? who.x : STAND[0];
        STAND.forEach(function (sx, i) {
          var d = who ? Math.abs(sx - x) / SPEED : 0.15;
          plan.push({ walk: true, t0: at, t1: at + d, x0: x, x1: sx }); at += d; x = sx;
          plan.push({ i: i, t0: at, t1: at + STAMP }); at += STAMP;
        });
        if (who) { var back = Math.abs(x - HOME) / SPEED; plan.push({ walk: true, t0: at, t1: at + back, x0: x, x1: HOME }); at += back; }
        var D = at + 0.2, landed = [], cur = null;
        function land(i) {
          if (landed[i]) return;
          landed[i] = true;
          w.state.checked = Math.max(w.state.checked || 0, (i + 1) / 3);
          if (w.instant) return;
          var fx = w.futureFx || (w.futureFx = { mote: 0 });
          (fx.stampAt = fx.stampAt || [])[i] = w.time;
          w.sfx('stamp');
          if (!w.reduced) w.burst(PAGE.xs[i] + PAGE.w / 2, PAGE.y + 26, 6, { kind: 'spark', colors: [CHECK_GLOW, '#ffffff', STAMP_INK], speed: 55, g: 0, spread: Math.PI * 2, life: 0.3, floor: false });
        }
        function settle() {
          for (var i = 0; i < 3; i++) land(i);
          w.state.checked = 1;
          if (who) { who.x = HOME; who.y = 0; who.facing = -1; who.anim = 'idle'; who.held = null; }
        }
        return new Task(D, function (t) {
          plan.forEach(function (p) { if (!p.walk && t >= p.t0 + HIT) land(p.i); });
          if (!who) return;
          var p = null;
          for (var k = 0; k < plan.length; k++) if (t < plan[k].t1) { p = plan[k]; break; }
          if (!p) { who.anim = 'idle'; who.facing = -1; who.held = null; cur = null; return; } // done: turn back to the team
          who.held = 'stamp';
          if (p.walk) {
            who.x = Math.round(U.lerp(p.x0, p.x1, U.clamp((t - p.t0) / Math.max(0.01, p.t1 - p.t0), 0, 1)));
            if (p.x1 !== p.x0) who.facing = p.x1 > p.x0 ? 1 : -1;
            if (who.anim !== 'walk') { who.anim = 'walk'; who.t = 0; }
          } else if (cur !== p) {
            who.x = STAND[p.i]; who.facing = 1; who.anim = 'throw'; who.t = t - p.t0;
          }
          cur = p;
        }, settle);
      } },
      // The saved time, spent: team tools rise first, then tools for the rest of the company.
      tools: { run: function (w, args, Task) {
        var D = 2.6, started = [], risen = [];
        return new Task(D, function (t) {
          var k = w.state.tools = Math.min(1, t / D);
          if (w.instant) return;
          TOOLS.forEach(function (tool, i) {
            if (!started[i] && k > tool.from) { started[i] = true; w.sfx(tool.more ? 'sparkle' : 'build'); }
            if (!risen[i] && k >= tool.to) {
              risen[i] = true;
              if (!w.reduced) w.burst(tool.x, tool.ly + 4, 8, { kind: 'spark', colors: [tool.col, '#ffffff', GLOW], speed: 60, g: 0, spread: Math.PI * 2, life: 0.45, floor: false });
            }
          });
        }, function () { w.state.tools = 1; });
      } }
    },
    initState: function () { return { proto: 0, bloom: 0, sorted: 0, checked: 0, tools: 0 }; },
    layers: layers, props: props, drawBack: drawBack, drawFront: drawFront, update: update,
    level: { solids: SOLIDS, targets: TARGETS, spawn: spawn, onHit: onHit }
  };
})(typeof window !== 'undefined' ? window : globalThis);
