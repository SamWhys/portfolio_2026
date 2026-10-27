/* METAL SLIDE art: the world map, "How I transformed the company".
   An overworld in the Super Mario World and Metal Slug mold: one landscape of sea, coast and
   hills, crossed by one road from the cave (bottom left) to the future (top right). Time runs
   along the road: a torchlit cave, a sunny kingdom and city, the siege at midnight, then
   sunrise over the future. The art improves along the way too: the cave is snapped to the
   16-color stone palette, the kingdom to 32 colors, and the rest is full color.

   The API is the contract engine/mapui.js relies on:

   MS.worldmap.places[n]   chapter n (1-5): { x, y, label } in game px (384x216). (x, y) is
                           where the chapter's HTML label button sits, centred under its
                           landmark. label is the short place name on that button.
   MS.worldmap.slots[n]    up to 3 { x, y } signpost spots for chapter n's case-study
                           pathways; the HTML link sits centred on each.
   MS.worldmap.draw(g, t, s)
     g  the 384x216 canvas context        t  seconds since the map opened
     s  { title, done: {n: true}, active: n|null (hovered or focused chapter),
          here: n (where Sam's marker stands), pathways: {n: count}, reduced }

   Layout: the title ribbon sits at y 24 to 42 (the strip above it is left clear for the
   game's menu buttons on small screens); places and labels sit below it. Each chapter's
   node (where Sam stands) is on the road 11px above its label, and its signposts hang in a
   column under the label, joined to the node by a dotted side trail.
   The static landscape is baked once into offscreen canvases; draw() adds only the moving
   parts. With s.reduced the frame is still: every animation is held at one moment. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var W = 384, H = 216;

  // ---------------------------------------------------------------- the contract
  var places = {
    1: { x: 52, y: 192, label: 'THE CAVE' },
    2: { x: 128, y: 123, label: 'THE KINGDOM' },
    3: { x: 198, y: 167, label: 'THE CITY' },
    4: { x: 272, y: 131, label: 'THE SIEGE' },
    5: { x: 342, y: 101, label: 'THE FUTURE' }
  };
  var slots = {
    1: [{ x: 52, y: 206 }],
    2: [{ x: 128, y: 142 }],
    3: [{ x: 198, y: 185 }, { x: 198, y: 204 }],
    4: [{ x: 272, y: 150 }],
    5: [{ x: 342, y: 120 }, { x: 342, y: 139 }, { x: 342, y: 158 }]
  };
  var NODE_UP = 11;
  function nodeOf(n) { return { x: places[n].x, y: places[n].y - NODE_UP }; }
  // The road's corners (rounded when painted). Every node sits on a straight run, and the
  // runs keep 2px or more clear of every label. Moving a place means moving its runs too.
  var ROUTE = [[44, 181], [88, 181], [88, 112], [170, 112], [170, 156], [231, 156], [231, 120], [300, 120], [300, 90], [362, 90]];
  var STILL_T = 2.35; // the moment a reduced-motion frame holds

  // ---------------------------------------------------------------- small helpers
  var BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bay(x, y) { return (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  function hash(x, y, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1103515245);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sm(a, b, v) { var t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var rgbs = {};
  function rgb(hex) {
    if (rgbs[hex]) return rgbs[hex];
    var h = hex.replace('#', '');
    var n = parseInt(h, 16);
    return (rgbs[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  function hexOf(c) { return '#' + c.map(function (v) { v = Math.round(clamp(v, 0, 255)); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function list(arr) { return arr.map(rgb); }

  var cache = {};
  function once(key, make) { return cache[key] || (cache[key] = make()); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ctx(c) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
  function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function disc(g, cx, cy, rad, c) {
    g.fillStyle = c;
    for (var y = -rad; y <= rad; y++) {
      var w = Math.round(Math.sqrt(Math.max(0, rad * rad - y * y)) * 2);
      if (w > 0) g.fillRect(Math.round(cx - w / 2), Math.round(cy + y), w, 1);
    }
  }
  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var y = -ry; y <= ry; y++) {
      var w = Math.round(Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) * rx * 2);
      if (w > 0) g.fillRect(Math.round(cx - w / 2), Math.round(cy + y), w, 1);
    }
  }
  // Crisp scanline polygon fill (no antialiasing).
  function poly(g, pts, c) {
    var y0 = Infinity, y1 = -Infinity, i, j;
    for (i = 0; i < pts.length; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
    g.fillStyle = c;
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var a = pts[i], b = pts[j];
        if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
        if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
      }
    }
  }
  function inPoly(pts, x, y) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function line(g, x0, y0, x1, y1, c, t) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    t = t || 1;
    g.fillStyle = c;
    for (var i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), t, t);
  }
  function lerpPts(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { var a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    }
    return pts[pts.length - 1][1];
  }
  function alphaMask(c) {
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, on = new Uint8Array(c.width * c.height);
    for (var i = 0; i < on.length; i++) on[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    return on;
  }
  // Ring everything painted on a canvas with a 1px dark outline, Metal Slug style.
  function outline(c, ink) {
    var g = c.getContext('2d'), cw = c.width, ch = c.height, on = alphaMask(c);
    g.fillStyle = ink;
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      var i = y * cw + x;
      if (on[i]) continue;
      if ((x > 0 && on[i - 1]) || (x < cw - 1 && on[i + 1]) || (y > 0 && on[i - cw]) || (y < ch - 1 && on[i + cw])) g.fillRect(x, y, 1, 1);
    }
    return c;
  }
  // A selection ring: the pixels just outside a sprite (a bright ring, then a gold one).
  function selectRing(c) {
    var cw = c.width, ch = c.height, on = alphaMask(c), out = canvas(cw, ch), g = ctx(out);
    var ring1 = new Uint8Array(cw * ch), x, y, i;
    function near(m, x, y) {
      var i = y * cw + x;
      return (x > 0 && m[i - 1]) || (x < cw - 1 && m[i + 1]) || (y > 0 && m[i - cw]) || (y < ch - 1 && m[i + cw]);
    }
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) { i = y * cw + x; if (!on[i] && near(on, x, y)) ring1[i] = 1; }
    var both = new Uint8Array(cw * ch);
    for (i = 0; i < both.length; i++) both[i] = on[i] | ring1[i];
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      i = y * cw + x;
      if (ring1[i]) px(g, x, y, '#fff6c8');
      else if (!both[i] && near(both, x, y)) px(g, x, y, '#ffb020');
    }
    return out;
  }
  function quantize(c, name, dither) { if (MS.palette && MS.palette.quantize) MS.palette.quantize(c, name, dither, 0, 0); return c; }

  // ---------------------------------------------------------------- time of day by place
  // Day over the cave, kingdom and city; midnight pooled over the siege; sunrise over the
  // future. The pools have soft, wobbly edges, crossed in four dithered steps.
  function wob(x, y) { return Math.sin(x * 0.09 + y * 0.05) * 0.5 + Math.sin(y * 0.13 - x * 0.045 + 1) * 0.5; }
  function landW(x, y) {
    var n0 = wob(x, y);
    var da = Math.sqrt(Math.pow((x - 364) / 62, 2) + Math.pow((y - 118) / 124, 2)) + n0 * 0.07;
    var wa = 1 - sm(0.82, 1.12, da);
    var dn = Math.sqrt(Math.pow((x - 272) / 44, 2) + Math.pow((y - 150) / 112, 2)) + n0 * 0.08;
    return [(1 - sm(0.8, 1.15, dn)) * (1 - wa), wa];
  }
  // Night and dawn weights snapped to quarter steps with ordered dithering.
  function steps(x, y) {
    var w = landW(x, y);
    var qa = Math.min(4, Math.floor(w[1] * 4 + bay(x + 1, y + 2))) / 4;
    var qn = Math.min(4, Math.floor(w[0] * 4 + bay(x + 3, y + 1))) / 4;
    if (qn + qa > 1) qn = 1 - qa;
    return [qn, qa];
  }
  function blend3(cd, cn, ca, q) {
    var d = 1 - q[0] - q[1];
    return [cd[0] * d + cn[0] * q[0] + ca[0] * q[1], cd[1] * d + cn[1] * q[0] + ca[1] * q[1], cd[2] * d + cn[2] * q[0] + ca[2] * q[1]];
  }
  function zone(x, y) { var b = bay(x + 1, y + 2), w = landW(x, y); return b < w[1] ? 2 : b < w[1] + w[0] ? 1 : 0; }
  var ZN = ['day', 'night', 'dawn'];

  // ---------------------------------------------------------------- geometry
  var HZ = 80;          // the sky gradient runs from y 0 to here
  var SEA_HZ = 70;      // the far sea's horizon (top left)
  var SUN = { x: 352, y: 74 };
  var MOON = { x: 256, y: 56 };
  var LT = [[0, 100], [14, 98], [28, 97], [42, 95], [54, 92], [64, 88], [76, 84], [90, 81], [110, 79], [150, 78], [200, 77], [384, 77]];
  function landTop(x) { return lerpPts(LT, x) + Math.sin(x * 0.7) * 0.5 + Math.sin(x * 0.23 + 1) * 0.8; }
  var CO = [[226, 224], [236, 213], [246, 201], [256, 191], [268, 183], [282, 178], [298, 176], [312, 179], [328, 182], [346, 183], [364, 182], [384, 181]];
  function coastY(x) { return x < 226 ? 999 : lerpPts(CO, x) + Math.sin(x * 0.5) * 0.7 + Math.sin(x * 0.17 + 1) * 1.1; }
  var LAKE = { x: 116, y: 172, rx: 15, ry: 6 };
  var FIELDS = [{ x: 96, y: 199, w: 40, h: 15, kind: 'wheat' }, { x: 140, y: 200, w: 24, h: 13, kind: 'rows' }];
  var MILL = { x: 152, y: 196 };     // windmill foot
  // Rolling hills for shading: [cx, cy, rx, ry, height]
  var HILLS = [
    [128, 100, 52, 26, 1.0], [24, 104, 28, 10, 0.5], [70, 96, 22, 10, 0.5], [118, 150, 26, 14, 0.45],
    [100, 200, 28, 12, 0.5], [158, 182, 26, 12, 0.4], [196, 90, 36, 12, 0.6], [160, 82, 30, 8, 0.4],
    [262, 150, 36, 16, 0.3], [214, 200, 26, 10, 0.4], [250, 86, 40, 10, 0.3], [340, 92, 40, 12, 0.3]
  ];
  function hillH(x, y) {
    var h = 0;
    for (var i = 0; i < HILLS.length; i++) {
      var k = HILLS[i], dx = (x - k[0]) / k[2], dy = (y - k[1]) / k[3];
      h += k[4] * Math.exp(-(dx * dx + dy * dy));
    }
    return h;
  }

  // ---------------------------------------------------------------- palettes
  var INK = '#140c18';
  var SKY = {
    day: list(['#2a5ac6', '#3672dc', '#4c8ce8', '#6aa6f0', '#8ec0f6', '#b6d8fa', '#dceeff']),
    dusk: list(['#1a1c5a', '#2c2c78', '#4a3a8e', '#74469a', '#a45496', '#d06a8a', '#f09080']),
    night: list(['#05061a', '#080a22', '#0c0e2c', '#111436', '#161a42', '#1c204e', '#24285c']),
    dawn: list(['#1a1650', '#33266c', '#58307e', '#8a3a88', '#c04c82', '#ea6a72', '#ff9668', '#ffc474', '#ffe6a6'])
  };
  var FARSEA = list(['#e4f4ff', '#a6d2f6', '#7ab6ee', '#5a9ae2', '#4884d4', '#3a72c4', '#3266b8']);
  var GRASS = {
    day: list(['#b2e46a', '#82cc44', '#58ae3e', '#3a8a40', '#276a3c']),
    night: list(['#3c5c74', '#2c4a64', '#203a54', '#162c44', '#0e2034']),
    dawn: list(['#e0f4b0', '#b4e494', '#82cc8c', '#5aac86', '#3c8a7c'])
  };
  var ROCK = list(['#a07a5c', '#75574a', '#4e3a3a', '#33242c', '#1d1420']);
  var PAVE = {
    day: list(['#f2f2ee', '#dcdcd6', '#c2c4c2', '#a2a6aa', '#83888e']),
    night: list(['#4c5078', '#3c4066', '#30345a', '#25294a', '#1a1d38']),
    dawn: list(['#fbf6ff', '#ece4f6', '#d8cdea', '#bfb4e0', '#a89ccc'])
  };
  var SAND = { day: list(['#f6e8b0', '#e2c888']), night: list(['#55587a', '#424564']), dawn: list(['#fff0dc', '#f4d2c0']) };
  var SEA = {
    day: { foam: rgb('#f0faff'), shallow: rgb('#62b8ea'), deep: list(['#4498dc', '#3480cc', '#286cb8']), cliff: list(['#b08860', '#80603e', '#5a4028']) },
    night: { foam: rgb('#6a78b0'), shallow: rgb('#22346a'), deep: list(['#1a2858', '#141e48', '#0e1638']), cliff: list(['#3e3e60', '#2c2c4a', '#1e1e36']) },
    dawn: { foam: rgb('#fff2ee'), shallow: rgb('#e8a2b2'), deep: list(['#c87ea6', '#a06a9e', '#7c5894']), cliff: list(['#f4c8b8', '#d8a0a0', '#b07a8c']) }
  };

  function bandPick(stops, t, x, y, sharp) {
    var n = stops.length - 1, p = clamp(t, 0, 1) * n, i = Math.floor(p), f = p - i;
    if (i >= n) return stops[n];
    f = sm(0.5 - sharp, 0.5 + sharp, f);
    return f > bay(x, y) ? stops[i + 1] : stops[i];
  }
  // The sky: day on the left, a pool of midnight (ringed by dusk) over the siege, and
  // sunrise spreading from the sun behind the future.
  function skyW(x, y) {
    var n0 = wob(x * 1.3, y * 1.3) * 0.06;
    var da = Math.sqrt(Math.pow((x - SUN.x) / 74, 2) + Math.pow((y - SUN.y) / 96, 2)) + n0;
    var wa = 1 - sm(0.74, 1.06, da);
    var dn = Math.sqrt(Math.pow((x - 262) / 60, 2) + Math.pow((y - 52) / 74, 2)) + n0;
    return [(1 - sm(0.5, 1.45, dn)) * (1 - wa * 0.6), wa];
  }
  function skySet(x, y) {
    var w = skyW(x, y);
    if (bay(x + 2, y + 1) < sm(0.25, 0.75, w[1])) return 'dawn';
    var lv = w[0] * 2.4 + (bay(x + 1, y + 3) - 0.5) * 0.55;
    return lv > 1.5 ? 'night' : lv > 0.5 ? 'dusk' : 'day';
  }
  function skyRGB(x, y) {
    var set = skySet(x, y), t = y / HZ;
    if (set === 'dawn') {
      var dx = x - SUN.x, dy = (y - SUN.y) * 1.5, dd = Math.sqrt(dx * dx + dy * dy);
      t += Math.max(0, 1 - dd / 86) * 0.5;
      var ang = Math.atan2(y - SUN.y, x - SUN.x);
      if (Math.floor((ang + 3.3) * 5.5) & 1) t += 0.07 * Math.max(0, 1 - dd / 150);
    }
    if (set === 'night' || set === 'dusk') {
      var mx = x - MOON.x, my = y - MOON.y, md = Math.sqrt(mx * mx + my * my);
      t += Math.max(0, 1 - md / 30) * 0.35;
    }
    return bandPick(SKY[set], t, x, y, 0.2);
  }

  // ---------------------------------------------------------------- the back layer
  // Sky, sun, moon, stars, the far sea and the far ridges. Clouds drift over it, and the
  // land (with its landmarks) is laid over that.
  function bakeBack() {
    var c = canvas(W, H), g = ctx(c);
    var img = g.createImageData(W, H), d = img.data, x, y, i, col;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = (y * W + x) * 4;
      if (y < SEA_HZ) col = skyRGB(x, y);
      else if (y === SEA_HZ) col = FARSEA[0];
      else col = bandPick(FARSEA, (y - SEA_HZ) / 30, x, y, 0.25);
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var R = rng(11);
    // far sea glints
    for (i = 0; i < 26; i++) {
      x = Math.floor(R() * 90); y = SEA_HZ + 2 + Math.floor(R() * 28);
      r(g, x, y, 1 + Math.floor(R() * 3), 1, R() > 0.5 ? '#ffffff' : '#c8e6ff');
    }
    // a far island on the horizon
    poly(g, [[8, 70], [12, 66], [16, 65], [20, 67], [24, 70]], '#86b6d0');
    r(g, 13, 66, 3, 1, '#a8d0e4');
    // stars (only where the sky is dark)
    for (i = 0; i < 150; i++) {
      x = 190 + Math.floor(R() * 140); y = Math.floor(R() * 74);
      var set = skySet(x, y);
      if (set !== 'night' && set !== 'dusk') continue;
      if (set === 'dusk' && R() > 0.4) continue;
      var k = R();
      px(g, x, y, k > 0.8 ? '#ffffff' : k > 0.45 ? '#c8d0ff' : '#6a72b0');
      if (k > 0.95) { px(g, x - 1, y, '#6a72b0'); px(g, x + 1, y, '#6a72b0'); px(g, x, y - 1, '#6a72b0'); px(g, x, y + 1, '#6a72b0'); }
    }
    // the moon, a little halo, and wisps across it
    for (y = -16; y <= 16; y++) for (x = -16; x <= 16; x++) {
      var dd = Math.sqrt(x * x + y * y);
      if (dd > 11.5 && dd < 16 && bay(MOON.x + x, MOON.y + y) < (16 - dd) / 9) px(g, MOON.x + x, MOON.y + y, '#2e3470');
    }
    disc(g, MOON.x, MOON.y, 11, '#f4f0da');
    for (y = -11; y <= 11; y++) for (x = -11; x <= 11; x++) {
      if (x * x + y * y > 121) continue;
      var sh = (x + y) / 16;
      if (sh > 0.25 && bay(MOON.x + x, MOON.y + y) < sh) px(g, MOON.x + x, MOON.y + y, '#d8d0b4');
    }
    disc(g, MOON.x - 4, MOON.y - 3, 2, '#d0c8aa'); disc(g, MOON.x + 3, MOON.y + 4, 3, '#cec6a8'); px(g, MOON.x + 5, MOON.y - 5, '#d0c8aa');
    r(g, MOON.x - 4, MOON.y - 4, 1, 1, '#c0b896');
    r(g, MOON.x - 22, MOON.y + 6, 30, 2, '#272a5c'); r(g, MOON.x - 20, MOON.y + 6, 24, 1, '#3e4284');
    r(g, MOON.x - 6, MOON.y + 10, 26, 2, '#22265a'); r(g, MOON.x - 4, MOON.y + 10, 18, 1, '#3a3e7e');
    // sunrise streaks over the future
    r(g, 300, 56, 30, 2, '#f0909e'); r(g, 302, 56, 24, 1, '#ffc0b0');
    r(g, 360, 50, 24, 2, '#f8a0a0'); r(g, 362, 50, 18, 1, '#ffd0c0');
    r(g, 318, 64, 22, 1, '#ffb8a0');
    // the sun, half risen behind the future
    for (y = -22; y <= 22; y++) for (x = -24; x <= 24; x++) {
      var sd = Math.sqrt(x * x + y * y * 1.2);
      if (sd < 12) px(g, SUN.x + x, SUN.y + y, '#fffbe6');
      else if (sd < 16 && bay(SUN.x + x, SUN.y + y) < (16 - sd) / 4) px(g, SUN.x + x, SUN.y + y, '#fff0b8');
      else if (sd < 22 && bay(SUN.x + x + 1, SUN.y + y) < (22 - sd) / 12) px(g, SUN.x + x, SUN.y + y, '#ffd890');
    }
    // far ridges: hazy hills by day, a dark skyline at night, pale spires at dawn
    var RA = { day: '#a8cce0', dusk: '#7a6a9a', night: '#151838', dawn: '#eab4c8' };
    var RB = { day: '#80b4c8', dusk: '#5a4a7a', night: '#0f122c', dawn: '#d898b8' };
    for (x = 50; x < W; x++) {
      var rise = sm(52, 92, x);
      var ya = SEA_HZ - (SEA_HZ - (66 + 3 * Math.sin(x * 0.045) + 2 * Math.sin(x * 0.11 + 2))) * rise;
      var yb = SEA_HZ + 4 - (SEA_HZ + 4 - (72 + 3 * Math.sin(x * 0.07 + 1) + 2 * Math.sin(x * 0.19))) * rise;
      for (y = Math.round(ya); y < 84; y++) px(g, x, y, (y >= Math.round(yb) ? RB : RA)[skySet(x, y)]);
      if (rise > 0.1) px(g, x, Math.round(ya), mix(RA[skySet(x, Math.round(ya))], '#ffffff', 0.25));
    }
    // the far city by night (behind the siege)
    var xx = 224;
    while (xx < 306) {
      var bw = 4 + Math.floor(R() * 8), bh = 6 + Math.floor(R() * 14), top = 80 - bh;
      for (var by = top; by < 82; by++) for (var bx = xx; bx < xx + bw; bx++) {
        var zs = skySet(bx, by);
        if (zs === 'night' || zs === 'dusk') px(g, bx, by, '#0d1026');
      }
      if (R() > 0.5 && skyW(xx, 70)[0] > 0.7) r(g, xx + Math.floor(bw / 2), top - 3, 1, 3, '#0d1026');
      for (var wy = top + 2; wy < 78; wy += 3) for (var wx = xx + 1; wx < xx + bw - 1; wx += 2) {
        if (R() < 0.18 && skyW(wx, wy)[0] > 0.7) px(g, wx, wy, R() > 0.5 ? '#c8a050' : '#6a78c0');
      }
      xx += bw + Math.floor(R() * 3);
    }
    // pale far spires at sunrise
    [[306, 62, 3], [312, 58, 2], [372, 60, 3], [380, 64, 2], [326, 66, 4], [366, 66, 3]].forEach(function (s) {
      for (var yy = s[1]; yy < 82; yy++) for (var xq = s[0]; xq < s[0] + s[2]; xq++) if (skyW(xq, yy)[1] > bay(xq, yy)) px(g, xq, yy, '#f2c2d6');
      px(g, s[0] + Math.floor(s[2] / 2), s[1] - 1, '#fff0f4');
    });
    return c;
  }

  // ---------------------------------------------------------------- the road
  function roadSamples() {
    return once('road:samples', function () {
      var RAD = 7, out = [], last = null, s = 0, pts = ROUTE, i, k;
      function push(x, y) { if (last) s += Math.hypot(x - last.x, y - last.y); last = { x: x, y: y, s: s }; out.push(last); }
      function run(x, y) {
        var n = Math.ceil(Math.hypot(x - last.x, y - last.y) * 2), x0 = last.x, y0 = last.y;
        for (var j = 1; j <= n; j++) push(x0 + (x - x0) * j / n, y0 + (y - y0) * j / n);
      }
      push(pts[0][0], pts[0][1]);
      for (i = 1; i < pts.length; i++) {
        var a = pts[i - 1], p = pts[i], q = pts[i + 1];
        var dx = p[0] - a[0], dy = p[1] - a[1], L = Math.hypot(dx, dy);
        if (!q) { run(p[0], p[1]); break; }
        var ex = p[0] - dx / L * RAD, ey = p[1] - dy / L * RAD;
        run(ex, ey);
        var qx = q[0] - p[0], qy = q[1] - p[1], M = Math.hypot(qx, qy);
        var sx = p[0] + qx / M * RAD, sy = p[1] + qy / M * RAD;
        for (k = 1; k <= 16; k++) {
          var t = k / 16, u = 1 - t;
          push(u * u * ex + 2 * u * t * p[0] + t * t * sx, u * u * ey + 2 * u * t * p[1] + t * t * sy);
        }
      }
      return out;
    });
  }
  // Distance from every pixel to the road's centerline (and how far along the road it is).
  function roadField() {
    return once('road:field', function () {
      var dist = new Float32Array(W * H).fill(99), along = new Float32Array(W * H), S = roadSamples();
      S.forEach(function (p) {
        for (var y = Math.floor(p.y - 4); y <= Math.ceil(p.y + 4); y++) for (var x = Math.floor(p.x - 4); x <= Math.ceil(p.x + 4); x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          var dd = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y), i = y * W + x;
          if (dd < dist[i]) { dist[i] = dd; along[i] = p.s; }
        }
      });
      var nodeS = {};
      for (var n = 1; n <= 5; n++) {
        var nd = nodeOf(n), best = 1e9;
        S.forEach(function (p) { var dd = Math.hypot(p.x - nd.x, p.y - nd.y); if (dd < best) { best = dd; nodeS[n] = p.s; } });
      }
      return { dist: dist, along: along, nodeS: nodeS };
    });
  }
  function bakeRoad() {
    var c = canvas(W, H), g = ctx(c), img = g.createImageData(W, H), d = img.data, F = roadField(), ns = F.nodeS;
    var DIRT = list(['#b8946a', '#d8b48a', '#8a6a48', '#33242c']);
    var COB = list(['#d6caac', '#9c8e74', '#efe4c6', '#4a3c30']);
    var ST = {
      day: list(['#8c94aa', '#ffffff', '#8c94aa', '#2e3248']),
      night: list(['#363a60', '#e8c040', '#363a60', '#0e1028']),
      dawn: list(['#e6faff', '#ffffff', '#ffffff', '#3cc8e8'])
    };
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, dd = F.dist[i];
      if (dd > 2.55) continue;
      var s = F.along[i], edge = dd > 1.6, col;
      if (s < ns[2] - 2) {
        col = edge ? DIRT[3] : hash(x, y, 3) < 0.1 ? DIRT[1] : hash(x, y, 4) < 0.1 ? DIRT[2] : DIRT[0];
      } else if (s < ns[3] - 2) {
        var joint = Math.floor(s) % 3 === 0 || (dd < 0.55 && Math.floor(s / 3) % 2 === 1);
        col = edge ? COB[3] : joint ? COB[1] : (hash(x, y, 5) < 0.08 ? COB[2] : COB[0]);
      } else {
        var k = edge ? 3 : dd < 0.6 && Math.floor(s / 4) % 2 === 0 ? 1 : dd > 1.1 ? 2 : 0;
        if (k === 2) k = 0;
        var kd = k === 0 && dd > 1.1 ? 2 : k;
        col = blend3(ST.day[k], ST.night[k], ST.dawn[kd], steps(x, y));
      }
      var o = i * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- the land
  // The future's hill: garden terraces in curved steps, centred under the plaza.
  var TER = { x: 342, y: 82, sx: 1.7, band: 13, max: 106 };
  function terraceLeft(y) { return 303 - 11 * Math.sin(clamp((y - 86) / 98, 0, 1) * Math.PI) + 1.5 * Math.sin(y * 0.37); }
  function terraceAt(x, y) {
    if (y < 87) return null;
    var xl = terraceLeft(y);
    if (x < xl) return null;
    var e = Math.sqrt(Math.pow((x - TER.x) / TER.sx, 2) + Math.pow(y - TER.y, 2));
    if (e > TER.max) return null;
    var f = (e - 8) / TER.band;
    return { e: e, k: Math.floor(f), fr: f - Math.floor(f), edge: x - xl < 2 };
  }
  function terraceRGB(x, y, T) {
    var fr = T.fr, side = (x - TER.x) / 60, col;
    if (T.edge) col = fr < 0.24 ? '#a89ccc' : '#dcd4f0';
    else if (fr < 0.08) col = '#ffd36a';
    else if (fr < 0.24) col = (x + T.k * 3) % 7 === 0 ? '#bfb4e0' : fr < 0.13 ? '#f6f2fc' : fr > 0.2 ? '#bfb4e0' : '#dcd4f0';
    else if (fr > 0.93) col = '#e4f8b8';
    else {
      var row = Math.floor(T.e * 1.5) % 3 === 0;
      col = row ? '#6cc48a' : side > 0.25 ? '#94d890' : '#a8e898';
      var h = hash(x, y, 31);
      if (!row && h > 0.97) col = h > 0.988 ? '#ffffff' : '#ff9ac8';
    }
    return rgb(col);
  }
  function bakeTerrain() {
    var c = canvas(W, H), g = ctx(c), img = g.createImageData(W, H), d = img.data;
    var LTc = new Float32Array(W), COc = new Float32Array(W), x, y, i;
    for (x = 0; x < W; x++) { LTc[x] = landTop(x); COc[x] = coastY(x); }
    var hf = new Float32Array(W * H);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) hf[y * W + x] = hillH(x, y);
    var mat = new Uint8Array(W * H), tone = new Uint8Array(W * H), zon = new Uint8Array(W * H);
    var NIGHT_INK = rgb('#0c1430');
    function put(x, y, col) { var o = (y * W + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x;
      var lt = LTc[x], cy = COc[x], q = steps(x, y);
      zon[i] = zone(x, y);
      if (y < lt) continue;
      if (y >= cy) {
        // the near sea: cliffs under the coast, foam, and the moon and sun reflected
        var dy = y - cy, cols = [SEA.day, SEA.night, SEA.dawn].map(function (S) {
          if (dy < 3) return S.cliff[Math.min(2, Math.floor(dy))];
          if (dy < 4.6) return hash(x >> 1, y, 9) < 0.7 ? S.foam : S.shallow;
          if (dy < 10) return S.shallow;
          return bandPick(S.deep, (dy - 10) / 30, x, y, 0.3);
        });
        var col = blend3(cols[0], cols[1], cols[2], q);
        var mr = 5 - (y - 178) / 10;
        if (dy > 6 && Math.abs(x - MOON.x - 4) < mr && y % 3 === 0 && hash(x, y, 2) < 0.6 && q[0] > 0.5) col = rgb(hash(x, y, 8) < 0.5 ? '#9aa4dc' : '#c8ccf0');
        var sr = 9 - (y - 182) / 6;
        if (dy > 5 && Math.abs(x - SUN.x) < sr && y % 2 === 0 && hash(x, y, 2) < 0.65) col = rgb(hash(x, y, 8) < 0.5 ? '#ffd890' : '#fff4c8');
        mat[i] = 7; put(x, y, col);
        continue;
      }
      var m = 1, pals = GRASS;
      var rockD = Math.sqrt(Math.pow((x - 36) / 70, 2) + Math.pow((y - 186) / 74, 2)) + wob(x * 2, y * 2) * 0.06;
      if (bay(x + 3, y + 1) < 1 - sm(0.82, 1.0, rockD)) { m = 2; }
      var wpd = sm(170, 176, x) * (1 - sm(228, 234, x)) * sm(146, 150, y) * (1 - sm(159, 162, y));
      var wpn = sm(232, 240, x) * (1 - sm(296, 302, x)) * sm(112, 118, y) * (1 - sm(140, 150, y + wob(x * 3, y) * 4));
      if (m === 1 && bay(x, y + 3) < Math.max(wpd, wpn)) { m = 3; pals = PAVE; }
      var lx = (x - LAKE.x) / LAKE.rx, ly = (y - LAKE.y) / LAKE.ry, ld = lx * lx + ly * ly;
      if (ld < 1) m = 5;
      else if (ld < 1.35 && m === 1) m = 4;
      for (var fi = 0; fi < FIELDS.length; fi++) { var f0 = FIELDS[fi]; if (m === 1 && x >= f0.x && x < f0.x + f0.w && y >= f0.y && y < f0.y + f0.h) m = f0.kind === 'wheat' ? 6 : 8; }
      var TT = m === 1 ? terraceAt(x, y) : null;
      if (TT && cy - y > 3) m = 9;
      if ((m === 1 || m === 3) && (cy - y < 2.6 || (x < 74 && y - lt < 2.2))) m = 4;
      mat[i] = m;
      var col2;
      if (m === 5) {
        var lr = ly < -0.4 ? '#9ad4f8' : ly < 0.1 ? '#6ab4ee' : '#4a96dc';
        if (hash(x >> 1, y, 4) < 0.08) lr = '#e4f6ff';
        col2 = rgb(lr);
      } else if (m === 4) {
        var si = hash(x, y, 6) < 0.25 ? 1 : 0;
        col2 = blend3(SAND.day[si], SAND.night[si], SAND.dawn[si], q);
      } else if (m === 6) {
        col2 = rgb((y - FIELDS[0].y) % 3 === 0 ? '#b88a30' : hash(x, y, 7) < 0.1 ? '#fff0a0' : '#e8c454');
      } else if (m === 8) {
        col2 = rgb((y - FIELDS[1].y) % 3 === 0 ? '#2f6e2a' : '#7cc44a');
      } else if (m === 9) {
        var tc = terraceRGB(x, y, TT);
        col2 = blend3(tc, blend3(tc, NIGHT_INK, NIGHT_INK, [0.72, 0]), tc, q);
      } else {
        var hx = hf[Math.min(H - 1, y + 1) * W + Math.min(W - 1, x + 1)], hy = hf[Math.max(0, y - 1) * W + Math.max(0, x - 1)];
        var slope = hx - hy;
        var v = 1.55 - slope * 12 + (hash(x >> 2, y >> 2, 1) - 0.5) * 0.7;
        if (y - lt < 7) v -= (7 - (y - lt)) * 0.12;          // haze toward the horizon
        if (m === 2) v += 0.4;
        v = clamp(v, 0, 4 - 0.001);
        var ti = Math.floor(v), ff = sm(0.3, 0.7, v - ti);
        if (ff > bay(x, y)) ti++;
        ti = Math.min(4, ti);
        tone[i] = ti;
        col2 = m === 2 ? ROCK[ti] : blend3(pals.day[ti], pals.night[ti], pals.dawn[ti], q);
      }
      put(x, y, col2);
    }
    // grass tufts and flowers, a dark rim on the horizon edge
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      i = y * W + x;
      var mm = mat[i], zz = ZN[zon[i]];
      if (mm === 1 && y > LTc[x] + 4) {
        var hsh = hash(x, y, 7);
        if (hsh < 0.035 && mat[i + W - 1] === 1 && mat[i + W + 1] === 1) {
          var dk = GRASS[zz][Math.min(4, tone[i] + 1)];
          put(x, y, dk); put(x - 1, y + 1, dk); put(x + 1, y + 1, dk);
        } else if (zz === 'day' && hsh > 0.996) put(x, y, rgb(hash(x, y, 3) < 0.5 ? '#ffffff' : '#ffe85a'));
        else if (zz === 'dawn' && hsh > 0.985) put(x, y, rgb(hash(x, y, 3) < 0.6 ? '#ff9ac8' : '#ffffff'));
      }
      if (mm === 2 && hash(x, y, 12) < 0.02) put(x, y, ROCK[4]);
      if (mm && mm !== 7 && y - LTc[x] < 1 && x > 74) put(x, y, rgb(zz === 'night' ? '#0c1426' : zz === 'dawn' ? '#9a7ab0' : '#3a6a5a'));
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- trees and bits
  function treeSprite(kind) {
    return once('tree:' + kind, function () {
      var c = canvas(15, 18), g = ctx(c);
      if (kind === 'oak' || kind === 'night' || kind === 'blossom') {
        var P = {
          oak: ['#b6e46a', '#6abe30', '#3a8a3a', '#2a6a34'],
          night: ['#4a6a88', '#2c4a64', '#1e3450', '#142640'],
          blossom: ['#ffe0ee', '#ff9ac8', '#e070a8', '#b0508a']
        }[kind];
        r(g, 6, 11, 3, 6, kind === 'night' ? '#2a2a40' : '#6a4a2a'); r(g, 6, 11, 1, 6, kind === 'night' ? '#3a3a58' : '#8a6438');
        disc(g, 7, 7, 5, P[2]); disc(g, 6, 6, 4, P[1]); disc(g, 5, 5, 2, P[0]);
        px(g, 9, 9, P[3]); px(g, 10, 8, P[3]); px(g, 8, 10, P[3]); px(g, 4, 9, P[2]);
        if (kind === 'blossom') { px(g, 8, 4, '#ffffff'); px(g, 3, 7, '#ffffff'); px(g, 10, 6, '#fff0f6'); }
      } else if (kind === 'pine' || kind === 'nightpine') {
        var Q = kind === 'pine' ? ['#6abe30', '#37946e', '#24604a'] : ['#2c4a64', '#1e3450', '#122438'];
        r(g, 7, 13, 2, 4, kind === 'pine' ? '#663931' : '#22223a');
        for (var k = 0; k < 3; k++) {
          var top = 1 + k * 4, w = 3 + k * 2;
          for (var yy = 0; yy < 5; yy++) {
            var ww = Math.max(1, Math.round(w * (yy + 1) / 5));
            r(g, 8 - Math.ceil(ww / 2) - 0, top + yy, ww, 1, Q[1]);
            r(g, 8 - Math.ceil(ww / 2), top + yy, Math.ceil(ww / 3), 1, Q[0]);
            px(g, 8 - Math.ceil(ww / 2) + ww - 1, top + yy, Q[2]);
          }
        }
      } else if (kind === 'palm') {
        line(g, 7, 17, 8, 7, '#a07040'); line(g, 8, 17, 9, 8, '#7a5030');
        line(g, 8, 7, 2, 9, '#3ab87a'); line(g, 8, 7, 14, 9, '#3ab87a'); line(g, 8, 6, 3, 4, '#5ad89a');
        line(g, 8, 6, 13, 4, '#5ad89a'); line(g, 8, 6, 8, 2, '#5ad89a'); px(g, 7, 8, '#ffd36a'); px(g, 9, 8, '#ffd36a');
      } else if (kind === 'dead') {
        line(g, 7, 17, 7, 6, '#4e3a3a', 2); line(g, 7, 9, 3, 5, '#4e3a3a'); line(g, 8, 8, 12, 3, '#4e3a3a'); line(g, 4, 6, 3, 3, '#4e3a3a');
        px(g, 7, 7, '#75574a'); px(g, 7, 11, '#75574a');
      } else if (kind === 'bush') {
        disc(g, 7, 13, 3, '#3a8a3a'); disc(g, 6, 12, 2, '#6abe30'); px(g, 5, 11, '#b6e46a');
      } else if (kind === 'rock') {
        poly(g, [[3, 17], [4, 13], [7, 11], [11, 12], [13, 17]], '#4e3a3a'); poly(g, [[4, 15], [5, 13], [7, 12], [9, 13]], '#75574a');
      }
      return outline(c, kind === 'night' || kind === 'nightpine' ? '#070a18' : INK);
    });
  }
  function plant(g, kind, x, y) { var s = treeSprite(kind); g.drawImage(s, Math.round(x - 8), Math.round(y - 17)); }
  var TREES = [
    // the left coast, behind the cave
    ['pine', 70, 99], ['pine', 78, 96], ['oak', 62, 100], ['pine', 84, 104],
    // the kingdom's hill and the valley
    ['oak', 92, 154], ['pine', 98, 160], ['oak', 140, 156], ['pine', 160, 150], ['oak', 162, 128], ['pine', 96, 132],
    ['oak', 136, 186], ['oak', 104, 190], ['bush', 92, 172], ['bush', 160, 168], ['pine', 166, 96], ['oak', 172, 100],
    ['pine', 180, 96], ['bush', 150, 160],
    // the city park
    ['oak', 172, 182], ['oak', 222, 180], ['oak', 176, 200], ['oak', 220, 198], ['bush', 230, 172], ['oak', 166, 212], ['bush', 226, 212],
    // the siege, at night
    ['nightpine', 252, 182], ['night', 300, 158], ['night', 238, 190], ['nightpine', 298, 172], ['night', 278, 178],
    // the cave's foreground
    ['dead', 97, 200], ['rock', 92, 213], ['rock', 9, 199], ['rock', 3, 215]
  ];
  function bakeDecor(g) {
    TREES.slice().sort(function (a, b) { return a[2] - b[2]; }).forEach(function (t) { plant(g, t[0], t[1], t[2]); });
    // village houses by the lake
    house(g, 100, 162, '#df7126'); house(g, 128, 158, '#ac3232'); house(g, 138, 166, '#df7126');
    // the windmill (its sails turn in draw())
    var mx = MILL.x, my = MILL.y;
    poly(g, [[mx - 5, my], [mx - 3, my - 16], [mx + 3, my - 16], [mx + 5, my]], '#eec39a');
    poly(g, [[mx + 1, my], [mx + 1, my - 16], [mx + 3, my - 16], [mx + 5, my]], '#d9a066');
    poly(g, [[mx - 4, my - 16], [mx, my - 21], [mx + 4, my - 16]], '#ac3232');
    r(g, mx - 1, my - 5, 2, 5, '#663931');
    // fence posts around the fields
    for (var fx = 96; fx < 164; fx += 4) r(g, fx, 197, 1, 2, '#8f563b');
    // the night district: little houses with lit windows, lamps and their pools of light
    var nh = canvas(W, H), ng = ctx(nh);
    [[232, 150, 9], [236, 177, 10], [248, 175, 9], [258, 168, 8], [270, 172, 10], [283, 168, 9], [226, 197, 8]].forEach(function (h, k) {
      var x = h[0], y = h[1], w = h[2];
      r(ng, x, y - 7, w, 7, '#232a52'); r(ng, x + w - 3, y - 7, 3, 7, '#181c3c');
      poly(ng, [[x - 1, y - 7], [x + w / 2, y - 11], [x + w + 1, y - 7]], k % 3 ? '#34305e' : '#3a2a4e');
      r(ng, x, y - 7, w, 1, '#3a4272');
      r(ng, x + 2, y - 5, 2, 2, '#ffd36a'); px(ng, x + 2, y - 5, '#fff2c0');
      if (w > 8) r(ng, x + w - 5, y - 5, 2, 2, k % 2 ? '#a8e0ff' : '#ffd36a');
      r(ng, x + Math.floor(w / 2) - 1, y - 3, 2, 3, '#0e1028');
    });
    outline(nh, '#07061a');
    g.drawImage(nh, 0, 0);
    [[240, 144], [294, 140], [244, 166], [266, 160], [290, 160]].forEach(function (l) {
      for (var yy = -4; yy <= 4; yy++) for (var xx = -8; xx <= 8; xx++) {
        var dd = Math.sqrt(xx * xx / 4 + yy * yy);
        if (dd < 4 && bay(l[0] + xx, l[1] + yy) < (4 - dd) / 5) px(g, l[0] + xx, l[1] + yy, '#4a5488');
      }
      r(g, l[0], l[1] - 9, 1, 9, '#5a5e80'); r(g, l[0] - 1, l[1] - 10, 3, 1, '#7a7ea0'); px(g, l[0], l[1] - 11, '#ffe8a0');
    });
    // a pier in the night harbor
    r(g, 280, 178, 3, 14, '#3a3050'); r(g, 280, 178, 3, 1, '#5a5070');
    for (var py = 182; py < 192; py += 4) r(g, 279, py, 5, 1, '#241c34');
  }
  function house(g, x, y, roof) {
    r(g, x, y - 5, 8, 5, '#eec39a'); r(g, x + 5, y - 5, 3, 5, '#d9a066');
    r(g, x, y - 5, 1, 5, '#663931'); r(g, x + 7, y - 5, 1, 5, '#663931'); r(g, x, y - 3, 8, 1, '#663931');
    r(g, x + 3, y - 3, 2, 3, '#45283c');
    poly(g, [[x - 1, y - 5], [x + 4, y - 9], [x + 9, y - 5]], roof);
    r(g, x + 1, y - 6, 3, 1, mix(roof, '#ffffff', 0.3));
  }

  // ---------------------------------------------------------------- 1. the cave
  // A dark rocky mountain with a mine-mouth, torches, a projector screen and piles of decks.
  var MOUNT = [[-2, 184], [-2, 122], [6, 116], [12, 110], [18, 108], [24, 102], [30, 98], [34, 94], [38, 97], [44, 102],
    [50, 106], [54, 110], [58, 107], [62, 110], [68, 118], [72, 126], [76, 136], [79, 148], [82, 162], [84, 174], [85, 184]];
  var MOUTH = { x: 52, y: 181, w: 24, h: 20 };
  function paintCave() {
    var c = canvas(W, H), g = ctx(c), x, y;
    var peaks = [[34, 94], [58, 107], [12, 110], [76, 136]];
    for (y = 90; y < 186; y++) for (x = 0; x < 88; x++) {
      if (!inPoly(MOUNT, x + 0.5, y + 0.5)) continue;
      var best = -1e9, pk = peaks[0];
      peaks.forEach(function (p) { var v = -Math.abs(x - p[0]) * 1.2 - (y < p[1] ? 999 : 0) - p[1] * 0.6; if (v > best) { best = v; pk = p; } });
      var wob = Math.sin(y * 0.35 + pk[0]) * 2 + Math.sin(y * 0.11) * 3;
      var lit = x < pk[0] + wob;
      var col;
      if (lit) {
        var nearRidge = pk[0] + wob - x < 3;
        col = nearRidge ? '#a07a5c' : '#75574a';
        if (hash(x >> 1, y >> 1, 2) < 0.25) col = '#4e3a3a';
      } else {
        col = hash(x >> 1, y >> 1, 3) < 0.2 ? '#33242c' : '#1d1420';
        if (x - (pk[0] + wob) < 1.5) col = '#4e3a3a';
      }
      if ((y + Math.floor(x * 0.4)) % 9 === 0 && hash(x, y, 5) < 0.8) col = lit ? '#4e3a3a' : '#0b0810';
      if (y > 172) col = mix(col, '#1d1420', 0.35);
      px(g, x, y, col);
    }
    // cracks
    var R = rng(5);
    for (var k = 0; k < 9; k++) {
      var cx = 8 + R() * 70, cy = 116 + R() * 50;
      for (var s = 0; s < 6; s++) { px(g, cx, cy, '#0b0810'); cx += (R() - 0.5) * 3; cy += 1 + R(); }
    }
    // torchlight warming the rock around the mouth (snapped to the palette with dithering)
    g.globalCompositeOperation = 'source-atop';
    [[36, 164], [68, 164]].forEach(function (t) {
      var gr = g.createRadialGradient(t[0], t[1], 0, t[0], t[1], 26);
      gr.addColorStop(0, 'rgba(255,190,90,0.75)'); gr.addColorStop(0.45, 'rgba(230,140,70,0.35)'); gr.addColorStop(1, 'rgba(230,140,70,0)');
      g.fillStyle = gr; g.fillRect(t[0] - 26, t[1] - 26, 52, 52);
    });
    var tg = g.createRadialGradient(52, 172, 0, 52, 172, 16);
    tg.addColorStop(0, 'rgba(127,208,192,0.5)'); tg.addColorStop(1, 'rgba(127,208,192,0)');
    g.fillStyle = tg; g.fillRect(36, 156, 32, 32);
    g.globalCompositeOperation = 'source-over';
    // the mouth: a black arch with a timber frame
    var m = MOUTH;
    for (y = m.y - m.h; y < m.y; y++) {
      var top = m.y - m.h + 6, hw = y < top ? m.w / 2 * Math.sqrt(Math.max(0, 1 - Math.pow((top - y) / 6, 2))) : m.w / 2;
      r(g, m.x - hw, y, hw * 2, 1, y < m.y - m.h + 3 ? '#1d1420' : '#0b0810');
    }
    r(g, m.x - 12, m.y - 15, 2, 15, '#75574a'); r(g, m.x + 10, m.y - 15, 2, 15, '#4e3a3a');
    r(g, m.x - 14, m.y - 17, 28, 3, '#75574a'); r(g, m.x - 14, m.y - 17, 28, 1, '#a07a5c'); r(g, m.x - 14, m.y - 15, 28, 1, '#4e3a3a');
    // an old CRT glowing teal inside
    r(g, m.x - 5, m.y - 10, 10, 8, '#33242c'); r(g, m.x - 4, m.y - 9, 8, 5, '#2f6e70'); r(g, m.x - 3, m.y - 8, 5, 3, '#7fd0c0');
    px(g, m.x - 3, m.y - 8, '#fff6e0'); r(g, m.x - 2, m.y - 2, 4, 1, '#33242c');
    // a title slide nailed over the mouth
    r(g, m.x - 9, m.y - 26, 18, 9, '#fff6e0'); r(g, m.x - 9, m.y - 26, 18, 3, '#d9542a');
    r(g, m.x - 7, m.y - 22, 9, 1, '#75574a'); r(g, m.x - 7, m.y - 20, 12, 1, '#a07a5c');
    px(g, m.x - 9, m.y - 26, '#a07a5c'); px(g, m.x + 8, m.y - 26, '#a07a5c');
    // torch posts (flames are drawn live)
    [36, 68].forEach(function (tx) { r(g, tx - 1, 166, 2, 15, '#4e3a3a'); r(g, tx - 2, 164, 4, 2, '#75574a'); r(g, tx - 2, 166, 4, 1, '#33242c'); });
    // a projector screen on a tripod, still showing slide 1 of 94
    r(g, 7, 148, 22, 15, '#f2dcb0'); r(g, 7, 148, 22, 3, '#d9542a'); r(g, 6, 147, 24, 1, '#33242c');
    [153, 156, 159].forEach(function (yy) { px(g, 9, yy, '#d9542a'); r(g, 11, yy, 9 + (yy % 4), 1, '#75574a'); });
    r(g, 23, 155, 4, 5, '#2f6e70');
    line(g, 18, 163, 12, 181, '#33242c'); line(g, 18, 163, 24, 181, '#33242c'); line(g, 18, 163, 18, 181, '#4e3a3a');
    // stacks of printed decks
    [[72, 181, 10], [74, 177, 8], [73, 174, 9], [76, 171, 6]].forEach(function (p) {
      r(g, p[0], p[1] - 3, p[2], 3, '#f2dcb0'); r(g, p[0], p[1] - 1, p[2], 1, '#a07a5c'); r(g, p[0] + 1, p[1] - 3, 3, 1, '#d9542a');
    });
    outline(c, '#0b0810');
    return quantize(c, 'stone', 1);
  }
  // Printed slides scattered flat on the ground (not part of the landmark's selection ring).
  function paintCaveGround() {
    var c = canvas(W, H), g = ctx(c);
    [[3, 190, 0], [9, 206, 1], [92, 189, 1], [100, 207, 0], [86, 214, 0], [2, 214, 1]].forEach(function (s) {
      var x = s[0], y = s[1], k = s[2];
      var pts = k ? [[x, y + 1], [x + 7, y], [x + 8, y + 3], [x + 1, y + 4]] : [[x + 1, y], [x + 8, y + 1], [x + 7, y + 4], [x, y + 3]];
      poly(g, pts, '#fff6e0');
      line(g, pts[0][0] + 1, pts[0][1] + 1, pts[1][0] - 1, pts[1][1] + 1, k ? '#2f6e70' : '#d9542a');
      px(g, x + 3, y + 3 - k, '#a07a5c');
    });
    outline(c, '#33242c');
    return quantize(c, 'stone', 1);
  }

  // ---------------------------------------------------------------- 2. the kingdom
  var K = { navy: '#222034', plum: '#45283c', brn0: '#663931', brn: '#8f563b', ora: '#df7126', tan: '#d9a066', tan2: '#eec39a',
    yel: '#fbf236', gb: '#9badb7', pale: '#cbdbfc', gry: '#847e87', gry0: '#696a6a', gry00: '#595652', red: '#ac3232', red2: '#d95763' };
  function stone(g, x, y, w, h) {
    r(g, x, y, w, h, K.gb);
    for (var yy = y + 2; yy < y + h; yy += 3) {
      r(g, x, yy, w, 1, K.gry);
      for (var xx = x + ((yy / 3) % 2 ? 1 : 3); xx < x + w; xx += 5) px(g, xx, yy + 1, K.gry);
    }
    r(g, x, y, w, 1, K.pale);
    r(g, x + Math.round(w * 0.68), y, Math.ceil(w * 0.32), h, K.gry0);
    for (yy = y + 2; yy < y + h; yy += 3) r(g, x + Math.round(w * 0.68), yy, Math.ceil(w * 0.32), 1, K.gry00);
  }
  function cone(g, cx, base, w, h) {
    poly(g, [[cx - w / 2, base], [cx, base - h], [cx + w / 2, base]], K.red);
    poly(g, [[cx - w / 2, base], [cx, base - h], [cx - w / 6, base]], K.red2);
    poly(g, [[cx + w / 5, base], [cx, base - h], [cx + w / 2, base]], K.plum);
    r(g, cx - w / 2 - 1, base, w + 2, 1, K.brn0);
  }
  function crenels(g, x, y, w) { for (var xx = x; xx < x + w - 1; xx += 4) { r(g, xx, y, 2, 2, K.gb); px(g, xx, y, K.pale); } }
  function paintKingdom() {
    var c = canvas(W, H), g = ctx(c);
    // the keep, behind the wall
    stone(g, 112, 74, 32, 26); crenels(g, 112, 72, 32);
    stone(g, 122, 58, 12, 18); cone(g, 128, 58, 16, 10);
    r(g, 128, 44, 1, 5, K.plum);                      // flag pole (the flag waves live)
    stone(g, 109, 64, 8, 12); cone(g, 113, 64, 11, 8);
    stone(g, 139, 64, 8, 12); cone(g, 143, 64, 11, 8);
    [[118, 80], [126, 80], [134, 80], [126, 64], [118, 88], [138, 88]].forEach(function (w, i) {
      r(g, w[0], w[1], 2, 3, i % 3 === 0 ? K.yel : K.navy); px(g, w[0], w[1] - 1, K.navy);
    });
    // banners
    [[115, 76], [139, 76]].forEach(function (b) {
      r(g, b[0], b[1], 4, 9, K.red); r(g, b[0], b[1], 1, 9, K.red2); px(g, b[0] + 1, b[1] + 3, K.yel); px(g, b[0] + 2, b[1] + 3, K.yel);
      px(g, b[0] + 1, b[1] + 9, K.red); px(g, b[0] + 3, b[1] + 9, K.red);
    });
    // the curtain wall and its gate
    stone(g, 104, 94, 48, 15); crenels(g, 104, 92, 48);
    r(g, 123, 97, 10, 12, K.navy);
    for (var y = 97; y < 101; y++) { var hw = 5 * Math.sqrt(1 - Math.pow((101 - y) / 4, 2)); r(g, 128 - hw, y, hw * 2, 1, K.navy); }
    for (var gx = 124; gx < 132; gx += 2) r(g, gx, 100, 1, 9, K.gry00);
    for (var gy = 102; gy < 109; gy += 3) r(g, 124, gy, 8, 1, K.gry00);
    r(g, 122, 95, 12, 1, K.tan); px(g, 128, 94, K.yel);
    // corner towers
    stone(g, 96, 80, 12, 29); cone(g, 102, 80, 16, 13);
    stone(g, 148, 80, 12, 29); cone(g, 154, 80, 16, 13);
    [[100, 86], [152, 86], [100, 96], [152, 96]].forEach(function (w, i) { r(g, w[0], w[1], 2, 3, i < 2 ? K.yel : K.navy); });
    // two town houses beside the walls
    house(g, 88, 108, K.ora);
    house(g, 161, 108, K.red);
    outline(c, K.navy);
    return quantize(c, 'medieval', 0.5);
  }

  // ---------------------------------------------------------------- 3. the city (day)
  function glass(g, x, y, w, h, tint) {
    var T = tint || ['#d8f0ff', '#9ccaf4', '#6aa4e6', '#4a80c8', '#34609e'];
    for (var xx = 0; xx < w; xx++) {
      var k = xx / w, col = k < 0.2 ? T[1] : k < 0.65 ? T[2] : T[3];
      r(g, x + xx, y, 1, h, col);
    }
    for (var yy = y + 2; yy < y + h; yy += 3) r(g, x, yy, w, 1, T[4]);
    for (var d = 0; d < h; d += 7) line(g, x + 1, y + d + 3, x + Math.min(w - 2, 4), y + d, T[0]);
    r(g, x, y, w, 1, T[0]);
  }
  function concrete(g, x, y, w, h) {
    r(g, x, y, w, h, '#e6ecf4'); r(g, x + Math.round(w * 0.7), y, Math.ceil(w * 0.3), h, '#c2cad8');
    for (var yy = y + 2; yy < y + h - 1; yy += 3) for (var xx = x + 1; xx < x + w - 1; xx += 3) r(g, xx, yy, 2, 2, (xx + yy) % 7 ? '#5a8ac8' : '#a8d4f8');
  }
  function paintCity() {
    var c = canvas(W, H), g = ctx(c);
    // a crane lifting a new component into place
    r(g, 178, 104, 2, 30, '#ffc83a'); for (var cy = 106; cy < 132; cy += 3) px(g, 179, cy, '#c08a10');
    r(g, 172, 104, 22, 2, '#ffc83a'); for (var cx = 173; cx < 193; cx += 3) px(g, cx, 105, '#c08a10');
    r(g, 172, 103, 4, 4, '#5a6070');
    r(g, 190, 106, 1, 6, '#3a3e52'); r(g, 187, 112, 7, 4, '#3a7ad8'); r(g, 188, 113, 3, 1, '#ffffff');
    // the towers: one design language, five buildings
    concrete(g, 174, 128, 11, 26);
    glass(g, 184, 110, 12, 44); r(g, 186, 106, 8, 4, '#e6ecf4'); r(g, 189, 98, 1, 8, '#8a90a6');
    glass(g, 195, 96, 15, 58, ['#e8f6ff', '#b0dcff', '#7ab8f4', '#4a88d8', '#2a5aa8']);
    r(g, 195, 96, 15, 2, '#f4f8ff'); r(g, 197, 92, 11, 4, '#f4f8ff'); r(g, 200, 84, 3, 8, '#e6ecf4'); r(g, 201, 80, 1, 4, '#c2cad8');
    // the design system's swatches on the tallest tower
    ['#3a7ad8', '#38c0a8', '#ffc83a', '#ff6a5a'].forEach(function (col, i) { r(g, 197 + i * 3, 100, 2, 2, col); });
    glass(g, 209, 116, 11, 38, ['#e0f4ff', '#a4d4f8', '#78b0ec', '#5288cc', '#3a68a8']);
    // a rooftop billboard showing UI components
    r(g, 207, 104, 15, 9, '#f4f8ff'); r(g, 209, 106, 6, 2, '#3a7ad8'); r(g, 216, 106, 4, 2, '#38c0a8'); r(g, 209, 109, 11, 1, '#c2cad8');
    r(g, 210, 113, 1, 3, '#5a6070'); r(g, 219, 113, 1, 3, '#5a6070');
    concrete(g, 219, 130, 10, 24);
    r(g, 222, 122, 6, 6, '#a87a50'); r(g, 222, 122, 6, 1, '#c89a6a'); r(g, 223, 128, 1, 2, '#5a4030'); r(g, 226, 128, 1, 2, '#5a4030');
    // shopfronts along the street
    [[174, '#ff6a5a'], [185, '#38c0a8'], [196, '#ffc83a'], [210, '#3a7ad8'], [220, '#ff6a5a']].forEach(function (s) {
      r(g, s[0], 147, 9, 2, s[1]); r(g, s[0] + 1, 149, 7, 5, '#2a3a5a'); r(g, s[0] + 2, 150, 2, 2, '#a8d4f8');
    });
    outline(c, '#1a2440');
    return c;
  }

  // ---------------------------------------------------------------- 4. the siege (midnight)
  // The paper robot, looming behind the district: dark against the night, edged in
  // moonlight, its wax-seal eye smoldering.
  function paintRobot(g) {
    var B = '#2a2852', B2 = '#34325e', SH = '#1c1a3a', RIM = '#8a8cd0', RIM2 = '#5a5c9e', PAPER = '#3c3a68', LN = '#4c4a80';
    // binder-clip shoulders, their wire handles up
    poly(g, [[254, 74], [290, 74], [296, 85], [248, 85]], SH); r(g, 254, 74, 36, 2, B);
    line(g, 258, 74, 253, 65, '#9a9ed8'); line(g, 253, 65, 263, 65, '#9a9ed8'); line(g, 263, 65, 262, 74, '#6a6ea8');
    line(g, 286, 74, 291, 65, '#6a6ea8'); line(g, 291, 65, 281, 65, '#9a9ed8'); line(g, 281, 65, 282, 74, '#6a6ea8');
    // the contract chest: a thick bound document
    r(g, 256, 85, 32, 34, PAPER); r(g, 280, 85, 8, 34, B);
    for (var y = 89; y < 118; y += 3) r(g, 259, y, 16 + ((y * 7) % 5), 1, LN);
    r(g, 256, 85, 32, 2, '#2f4f9a'); r(g, 256, 85, 32, 1, '#5a7ac8');
    disc(g, 268, 106, 3, '#7a1020'); px(g, 267, 105, '#c4202e');
    // the neck and the head: a box with two antennae
    r(g, 268, 70, 8, 4, SH);
    r(g, 262, 53, 20, 17, B); r(g, 274, 53, 8, 17, SH); r(g, 263, 66, 18, 1, SH);
    r(g, 265, 47, 1, 6, B2); r(g, 278, 47, 1, 6, B2); r(g, 264, 45, 3, 2, RIM); r(g, 277, 45, 3, 2, RIM2);
    // the left arm hangs, a fist of folders
    poly(g, [[248, 84], [255, 86], [252, 104], [245, 102]], SH);
    r(g, 242, 102, 10, 7, '#2f4f9a'); r(g, 242, 102, 10, 1, '#5a7ac8'); r(g, 244, 104, 6, 3, PAPER);
    // the right arm is raised, waving a notice
    poly(g, [[289, 84], [296, 86], [305, 63], [298, 60]], SH);
    r(g, 296, 46, 13, 15, '#d6cab0'); r(g, 296, 46, 13, 1, '#fffaf0'); r(g, 305, 46, 4, 15, '#ada08a');
    for (var ny = 49; ny < 57; ny += 2) r(g, 298, ny, 8, 1, '#8c8270');
    disc(g, 305, 57, 2, '#7a1020'); px(g, 305, 57, '#c4202e');
    // the wax-seal eye (it glows live)
    disc(g, 272, 61, 5, '#5a0c18'); disc(g, 272, 61, 4, '#a01828'); disc(g, 272, 61, 3, '#d8283a');
    r(g, 270, 59, 2, 2, '#ff8080'); px(g, 270, 59, '#ffe0e0');
    // moonlight on the edges facing the moon (up and left)
    r(g, 262, 53, 12, 1, RIM); r(g, 262, 53, 1, 16, RIM); r(g, 274, 53, 8, 1, RIM2);
    r(g, 254, 74, 20, 1, RIM); r(g, 274, 74, 16, 1, RIM2);
    r(g, 256, 87, 1, 32, RIM2); line(g, 248, 85, 254, 74, RIM); line(g, 245, 102, 248, 84, RIM2);
    line(g, 298, 60, 289, 84, RIM2);
  }
  function nightBlock(g, R, x, y, w, h, base) {
    r(g, x, y, w, h, base); r(g, x + Math.round(w * 0.72), y, Math.ceil(w * 0.28), h, mix(base, '#000000', 0.3));
    r(g, x, y, w, 1, mix(base, '#8a90d0', 0.35));
    for (var yy = y + 3; yy < y + h - 8; yy += 4) for (var xx = x + 2; xx < x + w - 2; xx += 3) {
      var on = R() < 0.42;
      r(g, xx, yy, 2, 2, on ? (R() < 0.75 ? '#ffd36a' : '#a8e0ff') : '#2a3058');
      if (on) px(g, xx, yy, '#fff2c0');
    }
  }
  function paintSiege() {
    var c = canvas(W, H), g = ctx(c), R = rng(41);
    paintRobot(g);
    nightBlock(g, R, 236, 100, 12, 18, '#1e2448');
    nightBlock(g, R, 247, 92, 15, 26, '#222a52');
    nightBlock(g, R, 261, 104, 16, 14, '#1c2244');
    nightBlock(g, R, 276, 94, 13, 24, '#242c56');
    nightBlock(g, R, 288, 102, 12, 16, '#1e2448');
    // rooftop searchlights (their beams sweep live)
    [[252, 92], [281, 94], [240, 100]].forEach(function (l) { r(g, l[0] - 2, l[1] - 3, 5, 3, '#6a6e90'); r(g, l[0] - 1, l[1] - 4, 3, 1, '#e8f0ff'); });
    // shopfronts: awnings and lit windows on the street
    [[237, '#c4202e'], [249, '#2f4f9a'], [263, '#c4202e'], [277, '#38a070'], [289, '#2f4f9a']].forEach(function (s) {
      r(g, s[0], 110, 10, 2, s[1]); r(g, s[0] + 1, 112, 8, 5, '#141834'); r(g, s[0] + 2, 113, 4, 3, '#ffc860'); px(g, s[0] + 2, 113, '#fff0c0');
    });
    outline(c, '#07061a');
    return c;
  }

  // ---------------------------------------------------------------- 5. the future (sunrise)
  var FU = { ink: '#2a1f45', s1: '#f6f2fc', s2: '#dcd4f0', s3: '#bfb4e0', glow: '#7ff4ff', glow2: '#bff8ff', gold: '#ffd36a',
    pink: '#ff8ab8', leaf: '#3ab87a', leaf2: '#5ad89a', leaf3: '#2a9a68' };
  function spire(g, cx, top, base, w) {
    for (var y = top; y < base; y++) {
      var k = (y - top) / (base - top), ww = Math.max(1, Math.round(w * Math.min(1, 0.25 + k * 1.4)));
      var x0 = Math.round(cx - ww / 2);
      r(g, x0, y, ww, 1, FU.s1);
      r(g, x0 + Math.ceil(ww * 0.55), y, Math.floor(ww * 0.45), 1, FU.s2);
      if (ww > 3) px(g, x0 + ww - 1, y, FU.s3);
    }
  }
  function garden(g, x, y, w) {
    r(g, x, y, w, 2, FU.leaf); r(g, x, y, w, 1, FU.leaf2);
    for (var xx = x; xx < x + w; xx += 2) { if (hash(xx, y, 3) < 0.6) r(g, xx, y + 2, 1, 1 + Math.floor(hash(xx, y, 4) * 4), FU.leaf3); }
    for (xx = x + 1; xx < x + w; xx += 3) if (hash(xx, y, 5) < 0.5) px(g, xx, y, FU.pink);
  }
  // Glass with a cyan glow, in floors.
  function glassF(g, x, y, w, h) {
    for (var yy = y; yy < y + h; yy++) {
      var band = (yy - y) % 4;
      r(g, x, yy, w, 1, band === 0 ? '#f6f2fc' : band === 1 ? '#bff8ff' : '#6ad8ec');
      if (band > 1) r(g, x + w - Math.max(1, Math.round(w * 0.3)), yy, Math.max(1, Math.round(w * 0.3)), 1, '#3cb4d8');
    }
  }
  function paintFuture() {
    var c = canvas(W, H), g = ctx(c), y;
    // the plaza the road arrives at: a curved deck with a light strip
    poly(g, [[306, 80], [384, 80], [384, 85], [346, 87], [306, 85]], FU.s2);
    r(g, 306, 80, 78, 1, FU.gold); r(g, 306, 81, 78, 1, FU.s1);
    for (var xx = 309; xx < 384; xx += 6) r(g, xx, 83, 3, 1, FU.glow);
    // far-right block with a garden roof
    r(g, 375, 64, 9, 16, FU.s1); r(g, 380, 64, 4, 16, FU.s3); glassF(g, 376, 67, 6, 12); garden(g, 374, 62, 10);
    // a slim tower on the left with hanging vines
    r(g, 306, 60, 9, 20, FU.s1); r(g, 312, 60, 3, 20, FU.s3); glassF(g, 307, 63, 6, 16);
    garden(g, 305, 58, 11); r(g, 309, 54, 3, 4, FU.s2); px(g, 310, 53, FU.gold);
    // the dome hall
    r(g, 316, 66, 18, 14, FU.s1); r(g, 328, 66, 6, 14, FU.s3);
    for (y = 0; y < 9; y++) {
      var hw = Math.round(Math.sqrt(81 - y * y));
      r(g, 325 - hw, 65 - y, hw * 2, 1, y > 6 ? '#ffffff' : y > 3 ? FU.glow2 : FU.glow);
      px(g, 325 + hw - 1, 65 - y, '#3cb4d8');
    }
    r(g, 320, 60, 2, 2, '#ffffff'); r(g, 324, 56, 2, 1, FU.gold);
    for (xx = 318; xx < 332; xx += 3) r(g, xx, 70, 2, 8, '#6ad8ec');
    garden(g, 315, 66, 20);
    // the main spire, ringed with gardens
    spire(g, 342, 46, 80, 13);
    r(g, 341, 52, 2, 26, FU.glow); r(g, 341, 52, 1, 26, FU.glow2);
    r(g, 342, 43, 1, 4, FU.gold); px(g, 342, 42, '#ffffff');
    garden(g, 335, 66, 15); garden(g, 337, 56, 11);
    // the leaf tower: a garden spiral
    spire(g, 360, 50, 80, 12);
    for (y = 56; y < 80; y += 5) { garden(g, 355, y, 11); }
    r(g, 360, 47, 1, 4, FU.gold);
    // a pink-flowered terrace block
    r(g, 366, 68, 10, 12, FU.s2); glassF(g, 367, 71, 7, 8);
    r(g, 365, 66, 12, 2, FU.pink); r(g, 365, 66, 12, 1, '#ffc0dc');
    // skybridges
    r(g, 315, 62, 4, 2, FU.glow2); r(g, 334, 70, 3, 2, FU.glow2); r(g, 348, 62, 6, 2, FU.glow2); r(g, 348, 62, 6, 1, '#ffffff');
    outline(c, FU.ink);
    // the halo ring around the spire, as light beyond the outline
    for (var a = 0; a < Math.PI * 2; a += 0.04) {
      var hx = 342 + Math.cos(a) * 15, hy = 60 + Math.sin(a) * 3;
      if (Math.sin(a) > 0 || Math.abs(hx - 342) > 7) px(g, hx, hy, Math.sin(a) > 0 ? '#ffffff' : FU.glow);
    }
    return c;
  }
  // Stairs, a stream and trees on the future's terraced hill (the hill itself is terrain).
  function paintFutureBits() {
    var c = canvas(W, H), g = ctx(c), y;
    for (y = 87; y < 184; y++) {
      if (y >= coastY(342) - 1) break;
      var T = terraceAt(342, y);
      if (!T) continue;
      var wall = T.fr < 0.24;
      r(g, 338, y, 9, 1, wall ? (y % 2 ? '#dcd4f0' : '#f6f2fc') : (y % 3 === 0 ? '#bfb4e0' : '#ece6f8'));
      px(g, 337, y, '#ffd36a'); px(g, 347, y, '#ffd36a');
    }
    for (y = 88; y < coastY(377) - 2; y++) {
      var T2 = terraceAt(377, y);
      r(g, 376, y, 3, 1, T2 && T2.fr < 0.24 ? '#ffffff' : '#7ff4ff');
      px(g, 377, y, T2 && T2.fr < 0.24 ? '#e8fcff' : '#bff8ff');
    }
    [['palm', 381, 120], ['blossom', 384, 150], ['palm', 366, 177], ['blossom', 320, 178], ['bush', 314, 112], ['bush', 381, 101], ['bush', 326, 175]].forEach(function (t) {
      plant(g, t[0], t[1], t[2]);
    });
    return c;
  }

  // ---------------------------------------------------------------- baking it all
  var baked = null;
  function bake() {
    if (baked) return baked;
    var back = bakeBack();
    var front = canvas(W, H), g = ctx(front);
    g.drawImage(bakeTerrain(), 0, 0);
    bakeDecor(g);
    var lm = { 1: paintCave(), 2: paintKingdom(), 3: paintCity(), 4: paintSiege(), 5: paintFuture() };
    g.drawImage(paintFutureBits(), 0, 0);
    g.drawImage(paintCaveGround(), 0, 0);
    // a soft dawn bloom behind the future, a cool night tint behind the siege
    g.save(); g.globalCompositeOperation = 'source-atop';
    var bl = g.createRadialGradient(342, 70, 0, 342, 70, 60);
    bl.addColorStop(0, 'rgba(255,236,190,0.35)'); bl.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = bl; g.fillRect(282, 10, 120, 120);
    g.restore();
    for (var n = 1; n <= 5; n++) g.drawImage(lm[n], 0, 0);
    g.drawImage(bakeRoad(), 0, 0);
    var rings = {};
    for (n = 1; n <= 5; n++) rings[n] = selectRing(lm[n]);
    baked = { back: back, front: front, rings: rings };
    return baked;
  }

  // Trails and signposts for the case-study pathways (baked per pathway count).
  function signsLayer(pathways) {
    var key = 'signs:' + [1, 2, 3, 4, 5].map(function (n) { return Math.min(slots[n].length, (pathways && pathways[n]) | 0); }).join('');
    return once(key, function () {
      var c = canvas(W, H), g = ctx(c), any = false;
      for (var n = 1; n <= 5; n++) {
        var k = Math.min(slots[n].length, (pathways && pathways[n]) | 0);
        if (!k) continue;
        any = true;
        var nd = nodeOf(n), last = slots[n][k - 1], z = n === 1 ? 'cave' : ZN[zone(nd.x, nd.y + 20)];
        var dot = { cave: ['#d6a77c', '#33242c'], day: ['#fff2c0', '#7a5a30'], night: ['#a8b0e8', '#1a1c3a'], dawn: ['#ffffff', '#b07aa0'] }[z];
        for (var y = nd.y + 4; y < last.y; y += 3) { r(g, nd.x - 1, y, 2, 2, dot[0]); px(g, nd.x, y + 1, dot[1]); }
        for (var i = 0; i < k; i++) {
          var sl = slots[n][i];
          var wood = z === 'night' ? ['#5a4a5a', '#3a2e44', '#7a6a80'] : ['#8a5a30', '#5a3a1e', '#b07a44'];
          [sl.x - 8, sl.x + 6].forEach(function (pxx) {
            r(g, pxx - 1, sl.y + 2, 4, 10, '#1a1010');
            r(g, pxx, sl.y + 2, 2, 9, wood[0]); r(g, pxx, sl.y + 2, 1, 9, wood[2]); r(g, pxx + 1, sl.y + 9, 1, 2, wood[1]);
          });
          r(g, sl.x - 11, sl.y + 11, 21, 1, 'rgba(10,8,20,0.45)');
        }
      }
      return any ? c : null;
    });
  }

  // Sam's map marker: swept-back brown hair, red headband, olive vest, tall boots.
  var SAM_ROWS = [
    'hhhh....',
    '.hhhhhh.',
    'rrrrrrrt',
    'hsssssh.t',
    '.sesse..',
    '.sssss..',
    '..vsv...',
    '.vvvvv..',
    'svvbvvs.',
    '.ppppp..',
    '.kk.kk..',
    '.kk.kk..'
  ];
  var SAM_COL = { h: '#6b4226', r: '#d0342c', t: '#a02420', s: '#d6a074', e: '#1a1020', v: '#5a6e34', b: '#3a2a18', p: '#7a6a48', k: '#2a2018' };
  function samSprite() {
    return once('sam', function () {
      var c = canvas(12, 15), g = ctx(c);
      SAM_ROWS.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) { var col = SAM_COL[row[x]]; if (col) px(g, x + 1, y + 1, col); }
      });
      px(g, 3, 1, '#8e5a34'); px(g, 5, 2, '#8e5a34'); px(g, 3, 4, '#ff6a5a');
      return outline(c, '#120a0e');
    });
  }
  function pointerSprite() {
    return once('pointer', function () {
      var c = canvas(9, 6), g = ctx(c);
      r(g, 1, 1, 7, 1, '#fff6c8'); r(g, 2, 2, 5, 1, '#ffd23a'); r(g, 3, 3, 3, 1, '#ffb020'); px(g, 4, 4, '#d07a1a');
      return outline(c, '#1a0c14');
    });
  }
  function flagSprite(frame) {
    return once('flag:' + frame, function () {
      var c = canvas(12, 14), g = ctx(c);
      r(g, 1, 1, 1, 12, '#5a4030'); px(g, 1, 0, '#ffd36a');
      for (var x = 0; x < 7; x++) {
        var dy = Math.round(Math.sin(frame * 1.6 - x * 0.9) * 0.7);
        r(g, 2 + x, 1 + dy, 1, 5, x % 2 ? '#2fb862' : '#3ad070');
        px(g, 2 + x, 5 + dy, '#1a8a44');
      }
      // a check mark
      px(g, 4, 3 + Math.round(Math.sin(frame * 1.6 - 2 * 0.9) * 0.7), '#ffffff');
      px(g, 5, 4 + Math.round(Math.sin(frame * 1.6 - 3 * 0.9) * 0.7), '#ffffff');
      px(g, 6, 3 + Math.round(Math.sin(frame * 1.6 - 4 * 0.9) * 0.7), '#ffffff');
      px(g, 7, 2 + Math.round(Math.sin(frame * 1.6 - 5 * 0.9) * 0.7), '#ffffff');
      return outline(c, '#120a0e');
    });
  }
  function cloudSprite(k) {
    return once('cloud:' + k, function () {
      var S = [[30, 10, [[8, 6, 5], [15, 4, 6], [22, 6, 5]]], [40, 12, [[9, 7, 6], [18, 5, 7], [27, 6, 6], [33, 8, 4]]], [22, 8, [[7, 5, 4], [14, 4, 5]]]][k];
      var c = canvas(S[0] + 2, S[1] + 2), g = ctx(c), lo = canvas(c.width, c.height), lg = ctx(lo);
      S[2].forEach(function (b) { disc(g, b[0], b[1] + 1, b[2], '#c4dcf4'); });
      S[2].forEach(function (b) { disc(g, b[0] - 1, b[1], b[2] - 1, '#ffffff'); });
      r(g, 3, S[1] - 1, S[0] - 6, 2, '#c4dcf4');
      // a dithered band of soft shade across the cloud's lower half (only over the white)
      for (var y = Math.ceil(S[1] * 0.55); y < c.height; y++) for (var x = 0; x < c.width; x++) if (bay(x, y) < 0.5) px(lg, x, y, '#e2eefc');
      g.globalCompositeOperation = 'source-atop';
      g.drawImage(lo, 0, 0);
      g.globalCompositeOperation = 'source-over';
      S[2].forEach(function (b) { for (var yy = -b[2]; yy <= b[2]; yy++) { var w = Math.round(Math.sqrt(Math.max(0, b[2] * b[2] - yy * yy)) * 2); if (b[1] + 1 + yy >= S[1] - 1 && w) r(g, b[0] - w / 2, b[1] + 1 + yy, w, 1, '#c4dcf4'); } });
      return c;
    });
  }

  // ---------------------------------------------------------------- the title ribbon
  function titleArt(text) {
    return once('title:' + text, function () {
      var F = MS.font;
      if (!F || !F.big) return null;
      var stops = ['#fffbe0', '#ffe066', '#ffb020', '#d0601a', '#ffcf5a'];
      var img = F.big(text, { scale: 2, stops: stops });
      if (img.width > 350) img = F.big(text, { scale: 1, bold: true, stops: stops });
      return img;
    });
  }
  // A ribbon banner (y 24 to 42) with swallowtail ends; the lettering sits on it.
  function ribbon(text) {
    return once('ribbon:' + text, function () {
      var img = titleArt(text);
      if (!img) return null;
      var w = Math.min(img.width, 340), tail = 14, pad = 8, bw = w + pad * 2, cw = bw + tail * 2, ch = 19;
      var c = canvas(cw, ch), g = ctx(c), t = canvas(cw, ch), tg = ctx(t);
      // the tails, notched, then outlined
      [0, cw - tail - 4].forEach(function (x0, k) {
        r(tg, x0, 4, tail + 4, 14, '#2a0c22');
        r(tg, x0, 4, tail + 4, 1, '#4a1a3a');
        var tip = k ? cw : 0, dir = k ? -1 : 1;
        tg.globalCompositeOperation = 'destination-out';
        poly(tg, [[tip, 4], [tip + dir * 6, 11], [tip, 18]], '#000');
        tg.globalCompositeOperation = 'source-over';
      });
      outline(t, INK);
      g.drawImage(t, 0, 0);
      // the body
      r(g, tail, 0, bw, ch, INK);
      r(g, tail + 1, 1, bw - 2, ch - 2, '#4a1632');
      r(g, tail + 1, 1, bw - 2, 1, '#7a2a52');
      r(g, tail + 1, ch - 2, bw - 2, 1, '#2e0c22');
      for (var x = tail + 3; x < tail + bw - 3; x += 6) { px(g, x, 2, '#5e1e42'); px(g, x + 3, ch - 3, '#3a1030'); }
      g.drawImage(img, 0, 0, img.width, img.height, tail + pad, 1, w, img.height);
      return c;
    });
  }
  function drawTitle(g, text) {
    var c = ribbon(text);
    if (c) g.drawImage(c, Math.round(192 - c.width / 2), 24);
  }

  // ---------------------------------------------------------------- live bits
  function torch(g, x, y, t, seed) {
    var f = Math.floor(t * 7 + seed) % 3;
    var shapes = [[[0, 0, 3, 3], [1, -2, 1, 2], [0, -1, 2, 1]], [[0, 0, 3, 3], [0, -2, 2, 2], [1, -3, 1, 1]], [[0, 0, 3, 3], [1, -2, 2, 2], [2, -3, 1, 1]]][f];
    g.save(); g.globalCompositeOperation = 'lighter';
    var a = 0.16 + 0.04 * Math.sin(t * 3.1 + seed * 2);
    var gr = g.createRadialGradient(x + 1, y, 0, x + 1, y, 14);
    gr.addColorStop(0, 'rgba(255,184,64,' + a + ')'); gr.addColorStop(1, 'rgba(255,184,64,0)');
    g.fillStyle = gr; g.fillRect(x - 13, y - 14, 28, 28);
    g.restore();
    shapes.forEach(function (s, i) { r(g, x + s[0] - 1, y + s[1] - 1, s[2] + 2, s[3] + 2, '#0b0810'); });
    shapes.forEach(function (s, i) { r(g, x + s[0], y + s[1], s[2], s[3], i ? '#ffb840' : '#d9542a'); });
    px(g, x + 1, y + 1, '#fff6e0');
  }
  function castleFlag(g, t) {
    for (var x = 0; x < 8; x++) {
      var dy = Math.round(Math.sin(t * 5 - x * 0.8) * (x / 7) * 1.2);
      r(g, 129 + x, 44 + dy, 1, 4, x === 0 ? '#45283c' : '#ac3232');
      px(g, 129 + x, 44 + dy, x ? '#d95763' : '#45283c');
      if (x === 3 || x === 4) px(g, 129 + x, 46 + dy, '#fbf236');
      px(g, 129 + x, 48 + dy, '#222034');
    }
    r(g, 128, 43, 1, 1, '#fbf236');
  }
  function millSails(g, t) {
    var hx = MILL.x, hy = MILL.y - 15, a0 = t * 0.9;
    for (var k = 0; k < 4; k++) {
      var a = a0 + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      line(g, hx, hy, hx + ca * 8, hy + sa * 8, '#663931');
      for (var j = 3; j <= 8; j++) px(g, hx + ca * j - sa * 1.5, hy + sa * j + ca * 1.5, '#eec39a');
    }
    r(g, hx - 1, hy - 1, 2, 2, '#45283c');
  }
  function searchlights(g, t) {
    g.save(); g.globalCompositeOperation = 'lighter';
    [[252, 88, 0.46, 0.62, 0], [281, 90, 0.5, 0.47, 2.1], [240, 96, 0.3, 0.8, 4]].forEach(function (L) {
      var ang = -Math.PI / 2 - 0.12 + Math.sin(t * L[3] + L[4]) * L[2], len = 104, spread = 0.085;
      var x1 = L[0] + Math.cos(ang - spread) * len, y1 = L[1] + Math.sin(ang - spread) * len;
      var x2 = L[0] + Math.cos(ang + spread) * len, y2 = L[1] + Math.sin(ang + spread) * len;
      var gr = g.createLinearGradient(L[0], L[1], (x1 + x2) / 2, (y1 + y2) / 2);
      gr.addColorStop(0, 'rgba(200,215,255,0.42)'); gr.addColorStop(0.6, 'rgba(200,215,255,0.16)'); gr.addColorStop(1, 'rgba(200,215,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(L[0], L[1]); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    });
    g.restore();
  }
  function sparkle(g, x, y, size, col) {
    if (size <= 0) return;
    px(g, x, y, '#ffffff');
    for (var k = 1; k <= size; k++) { var c = k === size ? col : '#ffffff'; px(g, x - k, y, c); px(g, x + k, y, c); px(g, x, y - k, c); px(g, x, y + k, c); }
  }
  var SPARKS = [[312, 54], [334, 50], [350, 46], [368, 58], [328, 76], [362, 74], [378, 62], [346, 64], [320, 96], [370, 120], [384 - 8, 150]];
  var TWINKLES = [[232, 48], [244, 70], [286, 52], [296, 72], [238, 60], [282, 46], [250, 76], [292, 64], [226, 66]];
  var GLINTS = [[12, 78], [30, 84], [46, 76], [22, 92], [60, 80], [8, 88], [40, 90]];
  var DAWN_GLINTS = [[330, 196], [348, 190], [362, 204], [376, 194], [340, 210], [318, 202]];
  // The stream down the future's hill: ripples run down it, foaming over each terrace wall.
  var STREAM = null;
  function waterfall(g, t) {
    if (!STREAM) { STREAM = []; for (var y = 88; y < coastY(377) - 2; y++) { var T = terraceAt(377, y); STREAM.push([y, !!(T && T.fr < 0.24)]); } }
    var sh = Math.floor(t * 16);
    STREAM.forEach(function (p) {
      var k = (p[0] - sh) & 3;
      if (p[1]) { if (k < 2) r(g, 376, p[0], 3, 1, '#ffffff'); else px(g, 375 + (k & 1) * 4, p[0], '#e8fcff'); }
      else if (k === 0) px(g, 377, p[0], '#ffffff');
    });
    var foot = Math.round(coastY(377)) + 3;
    px(g, 374 + (sh % 2) * 6, foot, '#ffffff'); r(g, 375, foot + 1, 5, 1, '#fff2ee');
  }

  // ---------------------------------------------------------------- draw
  function draw(g, t, s) {
    s = s || {};
    var B = bake(), still = !!s.reduced, T = still ? STILL_T : (t || 0), i, n;
    g.imageSmoothingEnabled = false;
    g.drawImage(B.back, 0, 0);

    // sky life: clouds, birds, twinkling stars
    [[34, 8, 0, 0.11, 0], [150, 3, 1, 0.08, 1.3], [96, 52, 1, 0.09, 2.2], [16, 50, 2, 0.13, 4], [176, 58, 2, 0.1, 0.6], [252, 4, 2, 0.07, 3]].forEach(function (cl) {
      var dx = Math.sin(T * cl[3] + cl[4]) * 12;
      if (cl[0] > 230) return; // the night keeps its own wisps
      g.drawImage(cloudSprite(cl[2]), Math.round(cl[0] + dx), cl[1]);
    });
    TWINKLES.forEach(function (st, k) {
      var v = Math.sin(T * 1.3 + k * 2.1);
      if (v > 0.55) sparkle(g, st[0], st[1], v > 0.85 ? 2 : 1, '#8890d0');
    });
    for (i = 0; i < 2; i++) {
      var bx = 70 + i * 26 + Math.sin(T * 0.21 + i) * 28, by = 60 + i * 4 + Math.sin(T * 0.5 + i * 2) * 2;
      var up = Math.floor(T * 4 + i * 2) % 2 && !still;
      px(g, bx, by, '#2a3a5a'); px(g, bx - 1, by - (up ? 1 : 0), '#2a3a5a'); px(g, bx + 1, by - (up ? 1 : 0), '#2a3a5a');
      px(g, bx - 2, by - (up ? 2 : 0), '#2a3a5a'); px(g, bx + 2, by - (up ? 2 : 0), '#2a3a5a');
    }
    // the sailboat on the far sea
    var sbx = Math.round(26 + Math.sin(T * 0.05) * 8), sby = 82 + (still ? 0 : Math.round(Math.sin(T * 2.2)));
    r(g, sbx - 4, sby, 9, 2, '#8f563b'); r(g, sbx - 3, sby + 2, 7, 1, '#663931'); r(g, sbx, sby - 8, 1, 8, '#663931');
    poly(g, [[sbx + 1, sby - 8], [sbx + 6, sby - 1], [sbx + 1, sby - 1]], '#ffffff'); poly(g, [[sbx - 1, sby - 6], [sbx - 1, sby - 1], [sbx - 4, sby - 1]], '#eec39a');
    r(g, sbx - 5, sby + 3, 11, 1, '#d8f0ff');
    GLINTS.forEach(function (gl, k) { if (Math.sin(T * 1.1 + k * 1.7) > 0.6) r(g, gl[0], gl[1], 2, 1, '#ffffff'); });

    g.drawImage(B.front, 0, 0);

    // land life
    torch(g, 35, 160, T, 0); torch(g, 67, 160, T, 1.4);
    castleFlag(g, T);
    millSails(g, T);
    if ((T % 1.6) < 0.8) { px(g, 201, 79, '#ff4a4a'); px(g, 189, 97, '#ff4a4a'); }
    waterfall(g, T);
    DAWN_GLINTS.forEach(function (gl, k) { if (Math.sin(T * 1.2 + k * 1.9) > 0.5) r(g, gl[0], gl[1], 3, 1, '#fff4c8'); });
    // a flying pod circling the spire
    var pa = T * 0.45, pxx = 342 + Math.cos(pa) * 32, pyy = 64 + Math.sin(pa) * 5;
    r(g, pxx - 3, pyy - 1, 7, 3, '#2a1f45'); r(g, pxx - 2, pyy - 1, 5, 2, '#f6f2fc'); px(g, pxx + 1, pyy - 1, '#7ff4ff');
    SPARKS.forEach(function (sp, k) {
      var ph = (T * 0.45 + k * 0.37) % 1, size = ph < 0.15 ? 1 : ph < 0.3 ? 2 : ph < 0.42 ? 1 : 0;
      sparkle(g, sp[0], sp[1], size, '#ffd36a');
    });
    // midnight: searchlights sweep and the robot's eye smolders
    searchlights(g, T);
    g.save(); g.globalCompositeOperation = 'lighter';
    var ea = 0.32 + 0.18 * Math.sin(T * 2.4);
    var eg = g.createRadialGradient(272, 61, 0, 272, 61, 9);
    eg.addColorStop(0, 'rgba(255,60,60,' + ea + ')'); eg.addColorStop(1, 'rgba(255,60,60,0)');
    g.fillStyle = eg; g.fillRect(262, 52, 20, 20);
    g.restore();

    // pathways: trails and signposts
    var sl = signsLayer(s.pathways);
    if (sl) g.drawImage(sl, 0, 0);

    // the active chapter: a soft glow and a bright ring around its landmark
    var act = s.active | 0;
    if (act >= 1 && act <= 5) {
      var pulse = still ? 1 : 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(T * 3.4));
      var nd0 = nodeOf(act), gc = { 1: [44, 150, 40], 2: [128, 80, 40], 3: [200, 124, 38], 4: [270, 92, 40], 5: [342, 66, 40] }[act];
      g.save(); g.globalCompositeOperation = 'lighter';
      var gg = g.createRadialGradient(gc[0], gc[1], 0, gc[0], gc[1], gc[2]);
      gg.addColorStop(0, 'rgba(255,220,120,' + (0.16 * pulse) + ')'); gg.addColorStop(1, 'rgba(255,220,120,0)');
      g.fillStyle = gg; g.fillRect(gc[0] - gc[2], gc[1] - gc[2], gc[2] * 2, gc[2] * 2);
      g.restore();
      g.save(); g.globalAlpha = pulse; g.drawImage(B.rings[act], 0, 0); g.restore();
      ellipse(g, nd0.x, nd0.y, 7, 3, 'rgba(255,230,140,' + (0.35 * pulse) + ')');
      // a little pointer bobbing over the chapter's stop (over Sam's head when he's there)
      var hop = still ? 0 : Math.round((Math.sin(T * 7) * 0.5 + 0.5) * 2);
      g.drawImage(pointerSprite(), nd0.x - 4, nd0.y - ((s.here | 0) === act ? 23 : 11) - hop);
    }

    // nodes: a stone pad on the road for each chapter, a planted flag once it's done
    var done = s.done || {};
    for (n = 1; n <= 5; n++) {
      var nd = nodeOf(n);
      ellipse(g, nd.x, nd.y, 4, 2, '#120a0e');
      ellipse(g, nd.x, nd.y, 3, 1, done[n] ? '#7ce08a' : '#ffd36a');
      px(g, nd.x - 1, nd.y - 1, '#ffffff');
      r(g, nd.x - 2, nd.y + 1, 5, 1, done[n] ? '#2a9a50' : '#d07a1a');
      if (done[n]) g.drawImage(flagSprite(still ? 0 : Math.floor(T * 4) % 4), nd.x + 6, nd.y - 13);
    }

    // Sam
    var here = s.here | 0;
    if (here >= 1 && here <= 5) {
      var nh = nodeOf(here), bob = still ? 0 : (Math.floor(T * 2) % 2);
      g.drawImage(samSprite(), nh.x - 5, nh.y - 13 - bob);
    }

    drawTitle(g, String(s.title || 'How I transformed the company').toUpperCase());
  }

  MS.worldmap = { places: places, slots: slots, draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
