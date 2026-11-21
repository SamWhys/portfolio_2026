/* METAL SLIDE art: gameplay visuals, drawn every frame after the world (scenes and play).
   Blastable level targets in their broken and fixed looks, each weapon's shots, muzzle
   flashes, thrown slides, hit pops ("8PX!"), Metal Slug explosions and typed particles.
   Numbers follow the Metal Slug study: a 3-frame muzzle flash at 0.05s a frame; each blast
   puff is a dark frame, a white frame, fireballs on the fire ramp, then rising smoke thinned
   with a Bayer mask, plus embers. Everything here is cosmetic and reads the world only. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var K = '#0b0810';

  // ------------------------------------------------------------------ colour
  // Effects snap to the era palette, so the cave keeps its 16 colors. A few fire tones
  // would snap to a dull peach in the kingdom's 32, so they are steered to yellow first.
  var STEER = {
    medieval: { '#f8f090': '#fbf236', '#f8d060': '#fbf236', '#f0b040': '#fbf236', '#fff6e0': '#ffffff', '#ffb840': '#fbf236' },
    stone: { '#c8ccd0': '#d6a77c', '#9aa0a8': '#a07a5c', '#5a5e66': '#4e3a3a' }
  };
  var era = '';
  var snapped = {};
  function col(hex) {
    if (!era || typeof hex !== 'string' || hex.charAt(0) !== '#' || !MS.palettes || !MS.palettes[era] || !MS.palette) return hex;
    var m = snapped[era] || (snapped[era] = {});
    if (!m[hex]) m[hex] = MS.palette.snap((STEER[era] && STEER[era][hex]) || hex, era);
    return m[hex];
  }
  function mix(a, b, k) { return MS.color ? MS.color.mix(a, b, Math.max(0, Math.min(1, k))) : (k < 0.5 ? a : b); }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }
  function outBack(k) { var c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
  function hash(s) { return MS.util ? MS.util.hash(s) : 7; }
  function rng(seed) { return MS.util.rng(seed); }
  // A stable 0..1 value per (seed, i), for deterministic sparkle and debris.
  function nth(seed, i) { var v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); }

  // ------------------------------------------------------------------ pixels
  function rect(g, x, y, w, h, c) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }

  // A filled pixel circle, row by row. Radius can be fractional so things grow smoothly.
  function disc(g, cx, cy, r, c) {
    if (r <= 0) return;
    cx = Math.round(cx); cy = Math.round(cy);
    g.fillStyle = c;
    var rr = r * r + r, top = Math.floor(Math.sqrt(rr));
    for (var dy = -top; dy <= top; dy++) {
      var hw = Math.floor(Math.sqrt(rr - dy * dy));
      g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }

  // The same circle thinned by the 4x4 Bayer matrix: cover 0..1 is how much of it shows.
  // Pixel art has no partial alpha, so smoke and dust fade by losing pixels. Cached.
  var dcache = {}, dcount = 0;
  function ddisc(g, cx, cy, r, c, cover) {
    var lv = Math.round(clamp(cover, 0, 1) * 16);
    if (lv <= 0 || r <= 0) return;
    if (lv >= 16) { disc(g, cx, cy, r, c); return; }
    r = Math.round(r * 2) / 2;
    var key = r + c + lv;
    var cv = dcache[key];
    var top = Math.floor(Math.sqrt(r * r + r));
    if (!cv) {
      if (dcount > 800) { dcache = {}; dcount = 0; }
      cv = document.createElement('canvas');
      cv.width = cv.height = top * 2 + 1;
      var dg = cv.getContext('2d');
      dg.fillStyle = c;
      for (var dy = -top; dy <= top; dy++) {
        var hw = Math.floor(Math.sqrt(r * r + r - dy * dy));
        for (var dx = -hw; dx <= hw; dx++) {
          var x = dx + top, y = dy + top;
          if (BAYER[(y & 3) * 4 + (x & 3)] < lv) dg.fillRect(x, y, 1, 1);
        }
      }
      dcache[key] = cv; dcount++;
    }
    g.drawImage(cv, Math.round(cx) - top, Math.round(cy) - top);
  }

  // A tiny 3x5 font for labels painted onto targets (V7, OK, 12/84).
  var TINY = {
    '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '###/..#/###/#../###', '3': '###/..#/.##/..#/###',
    '4': '#.#/#.#/###/..#/..#', '5': '###/#../###/..#/###', '6': '###/#../###/#.#/###', '7': '###/..#/.#./.#./.#.',
    '8': '###/#.#/###/#.#/###', '9': '###/#.#/###/..#/###', 'A': '.#./#.#/###/#.#/#.#', 'B': '##./#.#/##./#.#/##.',
    'C': '.##/#../#../#../.##', 'D': '##./#.#/#.#/#.#/##.', 'E': '###/#../##./#../###', 'F': '###/#../##./#../#..',
    'G': '.##/#../#.#/#.#/.##', 'H': '#.#/#.#/###/#.#/#.#', 'I': '###/.#./.#./.#./###', 'J': '..#/..#/..#/#.#/.#.',
    'K': '#.#/#.#/##./#.#/#.#', 'L': '#../#../#../#../###', 'M': '#.#/###/###/#.#/#.#', 'N': '##./#.#/#.#/#.#/#.#',
    'O': '.#./#.#/#.#/#.#/.#.', 'P': '##./#.#/##./#../#..', 'Q': '.#./#.#/#.#/##./.##', 'R': '##./#.#/##./#.#/#.#',
    'S': '.##/#../.#./..#/##.', 'T': '###/.#./.#./.#./.#.', 'U': '#.#/#.#/#.#/#.#/###', 'V': '#.#/#.#/#.#/#.#/.#.',
    'W': '#.#/#.#/###/###/#.#', 'X': '#.#/#.#/.#./#.#/#.#', 'Y': '#.#/#.#/.#./.#./.#.', 'Z': '###/..#/.#./#../###',
    '_': '.../.../.../.../###', '.': './././.#', '!': '#/#/#/./#', '?': '##./..#/.#./.../.#.', '-': '.../.../###/.../...',
    '/': '..#/..#/.#./#../#..', '%': '#.#/..#/.#./#../#.#', '#': '#.#/###/#.#/###/#.#'
  };
  var tinyRows = {};
  function tinyGlyph(ch) {
    ch = String(ch).toUpperCase();
    if (!TINY[ch]) return null;
    return tinyRows[ch] || (tinyRows[ch] = TINY[ch].split('/'));
  }
  function tinyWidth(s) {
    var w = 0;
    String(s).split('').forEach(function (ch) { var gl = tinyGlyph(ch); w += (gl ? gl[0].length : 2) + 1; });
    return Math.max(0, w - 1);
  }
  // jitter(i) can push each letter up or down: a broken baseline.
  function tiny(g, s, x, y, c, jitter) {
    g.fillStyle = c;
    String(s).split('').forEach(function (ch, i) {
      var gl = tinyGlyph(ch);
      var oy = jitter ? jitter(i) : 0;
      if (gl) for (var ry = 0; ry < gl.length; ry++) for (var rx = 0; rx < gl[ry].length; rx++) {
        if (gl[ry][rx] === '#') g.fillRect(Math.round(x + rx), Math.round(y + ry + oy), 1, 1);
      }
      x += (gl ? gl[0].length : 2) + 1;
    });
  }
  // The longest piece of a label that fits: 'final_v7' becomes 'V7' on a narrow scroll.
  // big: measure in the 5x7 game font instead of the tiny one.
  function labelFit(label, max, big) {
    if (!label) return '';
    if (big && !(MS.font && MS.font.measure)) return '';
    var measure = big ? MS.font.measure : tinyWidth;
    var s = String(label).toUpperCase();
    if (measure(s) <= max) return s;
    var parts = s.split(/[_\s-]+/).filter(Boolean);
    var last = parts.length ? parts[parts.length - 1] : '';
    return measure(last) <= max ? last : '';
  }
  function fitLabel(label, max) { return labelFit(label, max, false); }

  // ------------------------------------------------------------------ targets
  // Each look draws a target at (x, y) as broken (k < 0) or fixed (k 0..1 is the snap
  // into place, 1 is settled). t is the clock, for idle motion.
  var LOOKS = {};
  var SNAP = { layout: 0.32, slide: 0.45, chain: 0.4, scroll: 0.45, button: 0.3, bubble: 0.55, sign: 0.32, crate: 0.45 };

  // A cramped web layout on a billboard. Broken: a giant logo spilling off the corner,
  // a header that misses the edges, boxes and text at uneven gaps. Fixed: an even grid.
  function layoutPlan(T, bw, bh, fixed) {
    var ix = 2, iy = 2, iw = bw - 4, ih = bh - 4;
    var hh = ih >= 18 ? 3 : 2;
    var n = iw >= 34 ? 3 : 2, gut = 2;
    var cw = Math.floor((iw - 2 - gut * (n - 1)) / n);
    var x0 = ix + 1 + Math.floor((iw - 2 - (cw * n + gut * (n - 1))) / 2);
    var y1 = iy + hh + 3;
    var boxH = Math.max(3, Math.floor((ih - hh - 4) * 0.5));
    var items = [];
    items.push({ x: ix + 1, y: iy + 1, w: iw - 2, h: hh, c: '#d9542a' });
    for (var i = 0; i < n; i++) items.push({ x: x0 + i * (cw + gut), y: y1, w: cw, h: boxH, c: i % 2 ? '#75574a' : '#a07a5c' });
    var ly = y1 + boxH + 2;
    for (var j = 0; j < n; j++) for (var l = 0; l < 3; l++) {
      if (ly + l * 2 > iy + ih - 1) break;
      items.push({ x: x0 + j * (cw + gut), y: ly + l * 2, w: l === 2 ? Math.max(2, cw - 4) : cw, h: 1, c: '#75574a', line: 1 });
    }
    var logo = { x: ix + 2, y: iy + 1, w: hh, h: hh, logo: 1 };
    if (!fixed) {
      var r = rng(hash(T.id || T.x));
      items.forEach(function (it, k) {
        if (k === 0) { it.x += 2; it.y += 1; it.w += 3; return; }
        it.x += Math.round((r() - 0.5) * (it.line ? 7 : 6)) + (it.line ? 0 : k - 2);
        it.y += Math.round((r() - 0.4) * (it.line ? 2 : 4));
        it.w = Math.max(2, it.w + Math.round((r() - 0.5) * (it.line ? 10 : 6)));
        if (!it.line) it.h = Math.max(2, it.h + Math.round((r() - 0.5) * 4));
      });
      var s = Math.max(6, Math.round(Math.min(bw, bh) * 0.62));
      logo = { x: -3, y: -4, w: s, h: s, logo: 1 };
    }
    items.push(logo);
    return items;
  }

  LOOKS.layout = function (g, T, x, y, t, k) {
    var grounded = T.y == null;
    var w = T.w, bh = T.h - (grounded && T.h >= 20 ? 4 : 0);
    if (grounded && bh < T.h) {
      rect(g, x + 3, y + bh, 3, T.h - bh, col(K)); rect(g, x + w - 6, y + bh, 3, T.h - bh, col(K));
      rect(g, x + 4, y + bh, 1, T.h - bh, col('#75574a')); rect(g, x + w - 5, y + bh, 1, T.h - bh, col('#75574a'));
    }
    rect(g, x, y, w, bh, col(K));
    rect(g, x + 1, y + 1, w - 2, bh - 2, col('#75574a'));
    rect(g, x + 2, y + 2, w - 4, bh - 4, col('#f2dcb0'));
    rect(g, x + 2, y + bh - 3, w - 4, 1, col('#d6a77c'));
    var A = layoutPlan(T, w, bh, false), B = layoutPlan(T, w, bh, true);
    var e = k < 0 ? 0 : outBack(clamp(k, 0, 1));
    // the face clips the content, except the broken logo, which spills off the corner
    g.save();
    g.beginPath(); g.rect(x + 2, y + 2, w - 4, bh - 4); g.clip();
    for (var i = 0; i < A.length - 1; i++) {
      var a = A[i], b = B[i];
      rect(g, x + a.x + (b.x - a.x) * e, y + a.y + (b.y - a.y) * e, a.w + (b.w - a.w) * e, a.h + (b.h - a.h) * e, col(a.c));
    }
    if (k >= 0 && k < 1) {
      // the snap: the grid's column guides light up for a moment
      var cols = B.filter(function (it) { return !it.line && !it.logo; }).slice(1);
      cols.forEach(function (c) {
        rect(g, x + c.x - 1, y + 2, 1, bh - 4, col('#7fd0c0'));
        rect(g, x + c.x + c.w, y + 2, 1, bh - 4, col('#7fd0c0'));
      });
    }
    g.restore();
    var la = A[A.length - 1], lb = B[B.length - 1];
    var ls = la.w + (lb.w - la.w) * e;
    var lx = x + la.x + (lb.x - la.x) * e + ls / 2, ly = y + la.y + (lb.y - la.y) * e + ls / 2;
    var lr = Math.max(1, ls / 2 - 0.5);
    disc(g, lx, ly, lr + 1, col(K));
    disc(g, lx, ly, lr, col('#8e2f24'));
    disc(g, lx - 0.5, ly - 0.5, Math.max(0.5, lr - 1), col('#ffb840'));
    if (lr >= 5) {
      // the brand mark: a bold triangle
      var th = Math.round(lr * 0.9), tx0 = Math.round(lx), ty0 = Math.round(ly - th * 0.45);
      for (var q = 0; q < th; q++) rect(g, tx0 - Math.floor(q * 0.6), ty0 + q, Math.floor(q * 0.6) * 2 + 1, 1, col('#8e2f24'));
    }
    if (lr >= 3) disc(g, lx - lr * 0.4, ly - lr * 0.45, Math.max(0.5, lr * 0.2), col('#fff6e0'));
    if (k >= 1) {
      // spec'd: teal corner ticks stay on the fixed board
      var tc = col('#7fd0c0');
      rect(g, x + 1, y + 1, 3, 1, tc); rect(g, x + 1, y + 1, 1, 3, tc);
      rect(g, x + w - 4, y + bh - 2, 3, 1, tc); rect(g, x + w - 2, y + bh - 4, 1, 3, tc);
    }
  };

  // Paper bits flying out from a target that is fixed by going away.
  function scatter(g, cx, cy, k, seed, colors, n, reach) {
    if (k >= 1) return;
    for (var i = 0; i < n; i++) {
      var ang = nth(seed, i) * Math.PI * 2, sp = (0.5 + nth(seed, i + 9) * 0.5) * reach;
      var bx = cx + Math.cos(ang) * sp * easeOut(k), by = cy + Math.sin(ang) * sp * easeOut(k) + k * k * 10;
      var sz = k < 0.6 ? 2 : 1;
      rect(g, bx, by, sz, (i + Math.floor(k * 8)) % 2 ? sz : 1, col(colors[i % colors.length]));
    }
  }

  // A floating PowerPoint slide. Fixed: it tears into paper bits and is gone.
  LOOKS.slide = function (g, T, x, y, t, k, seed, reduced) {
    var w = T.w, h = T.h;
    if (k >= 0) { scatter(g, x + w / 2, y + h / 2, k, seed, ['#f8f0dc', '#d9542a', '#f8f0dc', '#9a8e80'], 12, Math.max(w, h) * 0.8); return; }
    var bob = reduced ? 0 : Math.round(Math.sin(t * 2.4 + seed % 7) * 1.5);
    y += bob;
    rect(g, x + 2, y + 2, w, h, col('#1d1420'));
    rect(g, x, y, w, h, col('#20141a'));
    rect(g, x + 1, y + 1, w - 2, h - 2, col('#f8f0dc'));
    var tb = h >= 14 ? 3 : 2;
    rect(g, x + 1, y + 1, w - 2, tb, col('#d9542a'));
    rect(g, x + 3, y + 2, Math.max(2, Math.floor(w * 0.45)), 1, col('#fff6e0'));
    var cy = y + tb + 3, art = w >= 22 ? Math.floor(w * 0.3) : 0;
    for (var row = 0; cy + row * 3 < y + h - 3; row++) {
      rect(g, x + 3, cy + row * 3, 1, 1, col('#d9542a'));
      rect(g, x + 5, cy + row * 3, Math.max(2, w - 9 - art - (row % 2) * 4), 1, col('#9a8e80'));
    }
    var num = w >= 30 && h >= 18 ? (seed % 83 + 1) + '/84' : '';
    if (art) {
      // clip art: a little bar chart going up and to the right
      var ax = x + w - art - 2, base = y + h - 3 - (num ? 6 : 0), ah = base - (y + tb + 3);
      for (var b = 0; b < 3; b++) {
        var bh = Math.max(1, Math.round(ah * (0.4 + b * 0.3)));
        rect(g, ax + b * Math.max(2, Math.floor(art / 3)), base - bh, Math.max(1, Math.floor(art / 3) - 1), bh, col(['#d9542a', '#ffb840', '#2f6e70'][b]));
      }
    }
    if (num) tiny(g, num, x + w - 2 - tinyWidth(num), y + h - 7, col('#9a8e80'));
  };

  // POW chains: chunky links down to a padlock. Fixed: snapped, the top swinging, the rest
  // fallen in a heap on the floor with the lock sprung open.
  var LINK_V = { face: ['.KKK.', 'KhmdK', 'KhKdK', 'KhKdK', 'KmddK', '.KKK.'], edge: ['.K.', 'KhK', 'KmK', 'KmK', 'KdK', '.K.'] };
  var LINK_H = { face: ['.KKKK.', 'KhhhmK', 'KmKKdK', 'KmdddK', '.KKKK.'], edge: ['.KKKK.', 'KhhmdK', '.KKKK.'] };
  function pattern(g, rows, x, y, pal) {
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) {
      var c = pal[rows[r][i]];
      if (c) px(g, x + i, y + r, c);
    }
  }
  function steel() { return { K: col(K), h: col('#c8ccd0'), m: col('#9aa0a8'), d: col('#5a5e66') }; }
  // Link i of a chain: even links face on, odd ones edge on. Centered on (cx, cy).
  function link(g, i, cx, cy, horiz, pal) {
    var set = horiz ? LINK_H : LINK_V, rows = i % 2 ? set.edge : set.face;
    pattern(g, rows, Math.round(cx - rows[0].length / 2), Math.round(cy - rows.length / 2), pal);
  }
  function padlock(g, x, y, open) {
    var k = col(K), m = col('#9aa0a8');
    // shackle: an arch, lifted and swung aside when open
    var sx = x + (open ? 3 : 1), sy = y - (open ? 5 : 3);
    rect(g, sx, sy, 5, 4, k); rect(g, sx + 1, sy + 1, 3, 3, m); rect(g, sx + 2, sy + 2, 1, 2, k);
    rect(g, x, y, 7, 6, k);
    rect(g, x + 1, y + 1, 5, 4, col('#ffb840'));
    rect(g, x + 1, y + 1, 5, 1, col('#fff6e0'));
    rect(g, x + 5, y + 2, 1, 3, col('#d9542a'));
    rect(g, x + 3, y + 2, 1, 2, k);
  }
  LOOKS.chain = function (g, T, x, y, t, k) {
    var w = T.w, h = T.h, horiz = w > h, pal = steel();
    var len = horiz ? w : h, n = Math.max(2, Math.floor((len - 2) / 4));
    var lockAt = Math.floor(n * 0.6);
    var cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
    var i;
    if (k < 0) {
      rect(g, horiz ? x - 1 : cx - 3, horiz ? cy - 3 : y - 1, horiz ? 2 : 7, horiz ? 7 : 2, col('#33242c'));
      for (i = 0; i < n; i++) {
        if (horiz) link(g, i, x + 3 + i * 4, cy, true, pal);
        else link(g, i, cx, y + 3 + i * 4, false, pal);
      }
      if (horiz) padlock(g, x + 3 + lockAt * 4 - 3, cy + 2, false);
      else padlock(g, cx - 3, y + 3 + lockAt * 4 + 2, false);
      return;
    }
    var keep = Math.max(1, Math.floor(n * 0.4));
    var swing = k < 1 ? Math.sin(k * 14) * 2.5 * (1 - k) : 0;
    var fall = clamp(k * 1.5, 0, 1);
    fall *= fall;
    var floor = y + h - 3;
    if (horiz) {
      rect(g, x - 1, cy - 3, 2, 7, col('#33242c'));
      for (i = 0; i < keep; i++) link(g, i, x + 3, cy + 1 + i * 4, false, pal);
    } else {
      rect(g, cx - 3, y - 1, 7, 2, col('#33242c'));
      for (i = 0; i < keep; i++) link(g, i, cx + Math.round(swing * (i + 1) / keep), y + 3 + i * 4, false, pal);
    }
    // the rest drops to the floor of the target box and lies in a heap
    var heap = n - keep, hx0 = cx - Math.floor(heap * 4 / 2) + 2;
    for (var j = 0; j < heap; j++) {
      var sx = horiz ? x + 3 + (keep + j) * 4 : cx, sy = horiz ? cy : y + 3 + (keep + j) * 4;
      var hx = hx0 + j * 4, hy = floor - (j % 3 === 1 ? 1 : 0);
      link(g, j, sx + (hx - sx) * fall, sy + (hy - sy) * fall, horiz || fall > 0.6, pal);
    }
    var ly0 = horiz ? cy + 2 : y + 3 + lockAt * 4 + 2;
    padlock(g, Math.round(cx - 3 + (hx0 + heap * 4 + 1 - cx) * fall), Math.round(ly0 + (floor - 3 - ly0) * fall), true);
  };

  // A hand-copied scroll labelled like final_v7. Fixed: it rolls itself up and is gone.
  LOOKS.scroll = function (g, T, x, y, t, k, seed, reduced) {
    var w = T.w, h = T.h;
    var roll = k < 0 ? 0 : easeOut(clamp(k / 0.7, 0, 1));
    var bodyH = Math.round((h - 6) * (1 - roll));
    if (k >= 0.7) {
      // the last of it: a puff where it was
      var p = (k - 0.7) / 0.3;
      for (var i = 0; i < 4; i++) ddisc(g, x + w / 2 + (i - 1.5) * 4 * (0.5 + p), y + 2 - p * 4, 2 + p * 2, col('#d9a066'), 1 - p);
      return;
    }
    var sway = k < 0 && !reduced ? Math.round(Math.sin(t * 1.6 + seed % 5) * 0.6) : 0;
    x += sway;
    // body
    if (bodyH > 0) {
      rect(g, x + 1, y + 3, w - 2, bodyH, col('#663931'));
      rect(g, x + 2, y + 3, w - 4, bodyH, col('#eec39a'));
      rect(g, x + w - 4, y + 3, 1, bodyH, col('#d9a066'));
      if (k < 0) {
        // the version label in red ink, in the big font when it fits, lines of copying around it
        var big = labelFit(T.label, w - 5, true), lab = big || labelFit(T.label, w - 5, false);
        var lh = big ? 7 : lab ? 5 : 0, top = y + 3, labY = top + Math.floor((bodyH - 4 - lh) * 0.6);
        var r = rng(seed);
        for (var ly = top + 3; ly < top + bodyH - 6; ly += 2) {
          var lw = Math.max(2, Math.round((w - 9) * (0.5 + r() * 0.5))), lx = Math.round(r() * 1), wob = r() > 0.7 ? 1 : 0;
          if (lab && ly + wob >= labY - 1 && ly + wob <= labY + lh) continue;
          rect(g, x + 4 + lx, ly + wob, lw, 1, col('#8f563b'));
        }
        if (big) MS.font.draw(g, big, x + Math.floor((w - MS.font.measure(big)) / 2), labY, col('#ac3232'));
        else if (lab) tiny(g, lab, x + Math.floor((w - tinyWidth(lab)) / 2), labY, col('#ac3232'));
        // wax seal
        disc(g, x + Math.floor(w / 2), y + 3 + bodyH - 3, 2, col('#663931'));
        disc(g, x + Math.floor(w / 2), y + 3 + bodyH - 3, 1, col('#ac3232'));
        px(g, x + Math.floor(w / 2) - 1, y + 3 + bodyH - 4, col('#d95763'));
      }
      // bottom curl
      rect(g, x, y + 3 + bodyH - 1, w, 3, col('#663931'));
      rect(g, x + 1, y + 3 + bodyH, w - 2, 1, col('#d9a066'));
    }
    // top rod with knobs
    rect(g, x - 1, y, w + 2, 4, col('#45283c'));
    rect(g, x, y + 1, w, 2, col('#8f563b'));
    rect(g, x, y + 1, w, 1, col('#d9a066'));
    rect(g, x - 1, y + 1, 1, 2, col('#df7126')); rect(g, x + w, y + 1, 1, 2, col('#df7126'));
  };

  // City buttons: 47 blues, every one different. Fixed: the one component, identical to the
  // BUTTON v1.0 board (blue, rounded, a white text line).
  var BLUES = ['#3a7af0', '#2a5ad0', '#5a9aff', '#1f4fa0', '#6ab0ff', '#3050c0', '#4a8ae0', '#2a6ab8', '#7a8aff'];
  // A rect with its corners cut back by rad pixels, filled row by row.
  function rrect(g, x, y, w, h, rad, c) {
    for (var row = 0; row < h; row++) {
      var e = Math.min(row, h - 1 - row);
      var n = e < rad ? rad - e : 0;
      rect(g, x + n, y + row, w - n * 2, 1, c);
    }
  }
  function button(g, x, y, w, h, fill, o) {
    var rad = o.radius || 0, b = o.border ? 1 : 0;
    if (o.shadow) rrect(g, x + o.shadow, y + o.shadow, w, h, rad, '#14161e');
    if (b) rrect(g, x, y, w, h, rad, o.border);
    rrect(g, x + b, y + b, w - b * 2, h - b * 2, Math.max(0, rad - b), fill);
    rrect(g, x + b, y + b, w - b * 2, 1, Math.max(0, rad - b), mix(fill, '#ffffff', 0.35));
    rrect(g, x + b, y + h - b - 1, w - b * 2, 1, Math.max(0, rad - b), mix(fill, '#0a1840', 0.4));
  }
  LOOKS.button = function (g, T, x, y, t, k, seed) {
    var r = rng(seed);
    var bw = Math.max(8, T.w - Math.floor(r() * 7)), bh = Math.max(5, T.h - Math.floor(r() * 4));
    var bx = x + Math.round((T.w - bw) / 2 + (r() - 0.5) * 4), by = y + Math.round((T.h - bh) / 2 + (r() - 0.5) * 3);
    var fill = BLUES[Math.floor(r() * BLUES.length)];
    var style = { shadow: [0, 1, 2][Math.floor(r() * 3)], border: [null, '#14306a', '#cbdbfc'][Math.floor(r() * 3)] };
    var label = ['OK', 'GO', 'SEND', 'BTN', 'CLICK', 'YES'][Math.floor(r() * 6)];
    var ink = ['#ffffff', '#ffe25a', '#14161e'][Math.floor(r() * 3)];
    var rad = [0, 1, 2][Math.floor(r() * 3)];
    var fw = Math.min(T.w, 24), fh = Math.min(T.h, 9);
    var fx = x + Math.floor((T.w - fw) / 2), fy = y + Math.floor((T.h - fh) / 2);
    var e = k < 0 ? 0 : outBack(clamp(k, 0, 1));
    var cx = Math.round(bx + (fx - bx) * e), cy = Math.round(by + (fy - by) * e);
    var cw = Math.round(bw + (fw - bw) * e), ch = Math.round(bh + (fh - bh) * e);
    var c = k < 0 ? fill : mix(fill, '#3a7af0', k * 1.6);
    var o = k < 0.5 ? style : { radius: 1, border: '#1f4fa0' };
    if (k < 0.5) o.radius = rad;
    button(g, cx, cy, cw, ch, c, o);
    if (k < 0.4) {
      var lw = tinyWidth(label);
      if (lw <= cw - 2) tiny(g, label, cx + Math.floor((cw - lw) / 2) + Math.round((r() - 0.5) * 3), cy + Math.max(1, Math.floor((ch - 5) / 2)), ink);
      else rect(g, cx + 2, cy + Math.floor(ch / 2), cw - 4, 1, ink);
    } else {
      rect(g, cx + 4, cy + Math.floor(ch / 2), Math.max(2, cw - 8), 1, '#ffffff');
    }
    if (k >= 0.7 && k < 1) {
      px(g, cx - 1, cy - 1, '#ffffff'); px(g, cx + cw, cy - 1, '#ffffff');
      px(g, cx - 1, cy + ch, '#ffffff'); px(g, cx + cw, cy + ch, '#ffffff');
    }
  };

  // Future: an idea bubble. Fixed: it pops, and a tiny working prototype card takes its place.
  function cloud(g, x, y, w, h, c, grow) {
    var r = Math.max(3, Math.floor(h * 0.32)) + grow;
    var bubbles = [[0.22, 0.55, 1], [0.42, 0.35, 1.15], [0.65, 0.4, 1.05], [0.8, 0.62, 0.9], [0.5, 0.66, 1.1], [0.28, 0.72, 0.85]];
    bubbles.forEach(function (b) { disc(g, x + w * b[0], y + h * 0.82 * b[1], r * b[2], c); });
  }
  LOOKS.bubble = function (g, T, x, y, t, k, seed, reduced) {
    var w = T.w, h = T.h;
    if (k < 0.35) {
      var bob = k < 0 && !reduced ? Math.round(Math.sin(t * 2 + seed % 6) * 1.5) : 0;
      var grow = k < 0 ? 0 : Math.round(k / 0.35 * 2);
      y += bob;
      var ink = col('#3a4a8a');
      cloud(g, x, y, w, h, ink, grow + 1);
      cloud(g, x, y + 1, w, h, col('#bff8ff'), grow);
      cloud(g, x, y, w, h - 1, col('#ffffff'), grow - 0.5);
      // the trail of little thought dots
      disc(g, x + w * 0.2, y + h - 3, 1.5, ink); disc(g, x + w * 0.2, y + h - 3, 0.6, col('#ffffff'));
      disc(g, x + w * 0.08, y + h - 0.5, 0.6, ink);
      if (k < 0) {
        var bulb = MS.props && MS.props.emote ? MS.props.emote('idea') : null;
        var cx = x + Math.floor(w / 2), cy = y + Math.floor(h * 0.42);
        if (bulb) g.drawImage(bulb, cx - Math.floor(bulb.width / 2) - 3, cy - Math.floor(bulb.height / 2));
        tiny(g, '?', cx + 3, cy - 3, ink);
      }
      return;
    }
    // the card scales in from the bubble's middle
    var e = outBack(clamp((k - 0.35) / 0.65, 0, 1));
    var fw = Math.max(12, Math.min(w, 26)), fh = Math.max(10, Math.min(h, 18));
    var cw = Math.max(2, Math.round(fw * e)), ch = Math.max(2, Math.round(fh * e));
    var cx0 = x + Math.round((w - cw) / 2), cy0 = y + Math.round((h - ch) / 2);
    rect(g, cx0 - 1, cy0 - 1, cw + 2, ch + 2, col('#2ab0d0'));
    rect(g, cx0, cy0, cw, ch, col('#7ff4ff'));
    rect(g, cx0 + 1, cy0 + 1, cw - 2, ch - 2, col('#1a2050'));
    if (k < 1 || cw < 10) return;
    var ix = cx0 + 2, iw = cw - 4;
    rect(g, ix, cy0 + 2, 2, 1, col('#ffd84a'));
    rect(g, ix + 3, cy0 + 2, Math.max(1, iw - 3), 1, col('#7ff4ff'));
    // image block with a sun and a hill
    var ih = Math.max(2, ch - 10);
    rect(g, ix, cy0 + 4, iw, ih, col('#3a4a8a'));
    px(g, ix + iw - 3, cy0 + 5, col('#ffd84a'));
    rect(g, ix + 1, cy0 + 3 + ih, Math.max(1, Math.floor(iw / 2)), 1, col('#5fa86a'));
    // the working bits: a progress bar that fills and a button that breathes at 1 Hz
    var by = cy0 + ch - 5;
    var prog = reduced ? 1 : (t * 0.6 + (seed % 10) / 10) % 1;
    rect(g, ix, by, iw, 1, col('#3a4a8a'));
    rect(g, ix, by, Math.max(1, Math.round(iw * prog)), 1, col('#7ff4ff'));
    var on = reduced || Math.floor(t) % 2 === 0;
    rect(g, ix, by + 2, iw, 2, col(on ? '#ffd84a' : '#d08a1e'));
    rect(g, ix + Math.floor(iw / 2) - 2, by + 2, 4, 1, col(on ? '#fff6c0' : '#ffd84a'));
  };

  // A generic sign: crooked with a jumbled label, fixed straight and aligned.
  LOOKS.sign = function (g, T, x, y, t, k, seed) {
    var w = T.w, h = T.h, grounded = T.y == null;
    var bh = grounded ? Math.max(8, h - 6) : h;
    var tilt = k < 0 ? 1 : 1 - outBack(clamp(k, 0, 1));
    if (grounded) {
      rect(g, x + Math.floor(w / 2) - 2, y + bh - 1, 4, h - bh + 1, col(K));
      rect(g, x + Math.floor(w / 2) - 1, y + bh - 1, 2, h - bh + 1, col('#8f563b'));
    }
    for (var row = 0; row < bh; row++) {
      var sh = Math.round(tilt * (row - bh / 2) / 4);
      var edge = row === 0 || row === bh - 1;
      rect(g, x + sh, y + row, w, 1, col(K));
      if (!edge) rect(g, x + sh + 1, y + row, w - 2, 1, col(row === 1 ? '#d9a066' : row === bh - 2 ? '#8f563b' : '#c88a3c'));
    }
    var big = bh >= 11 ? labelFit(T.label, w - 5, true) : '', lab = big || fitLabel(T.label, w - 4);
    var r = rng(seed);
    var jit = [];
    for (var i = 0; i < 12; i++) jit.push(Math.round((r() - 0.5) * 3));
    var ty = y + Math.floor((bh - (big ? 7 : 5)) / 2);
    var ink = col('#2a1a10');
    if (big) {
      // each letter on its own wobbly baseline until it's fixed
      var lx = x + Math.floor((w - MS.font.measure(big)) / 2);
      big.split('').forEach(function (ch, n) {
        var sh = Math.round(tilt * (ty + 3 - y - bh / 2) / 4);
        lx += MS.font.draw(g, ch, lx + sh, ty + Math.round(jit[n % jit.length] * tilt), ink) + 1;
      });
    } else if (lab) {
      tiny(g, lab, x + Math.floor((w - tinyWidth(lab)) / 2), ty, ink, function (i) { return Math.round(jit[i % jit.length] * tilt); });
    } else {
      rect(g, x + 3 + Math.round(tilt * jit[0]), ty + 1, w - 8, 1, col('#5a3010'));
      rect(g, x + 3 + Math.round(tilt * jit[1]), ty + 3, w - 11, 1, col('#5a3010'));
    }
  };

  // A wooden crate. Fixed: smashed flat, planks on the floor.
  LOOKS.crate = function (g, T, x, y, t, k, seed) {
    var w = T.w, h = T.h;
    if (k < 0) {
      rect(g, x, y, w, h, col(K));
      rect(g, x + 1, y + 1, w - 2, h - 2, col('#a0642a'));
      rect(g, x + 1, y + 1, w - 2, 1, col('#ecc070'));
      rect(g, x + 1, y + h - 2, w - 2, 1, col('#7a4418'));
      for (var px0 = x + 4; px0 < x + w - 3; px0 += 4) rect(g, px0, y + 2, 1, h - 4, col('#7a4418'));
      // the cross brace
      for (var i = 0; i < w - 4; i++) {
        var yy = Math.round((h - 5) * i / (w - 5));
        rect(g, x + 2 + i, y + 2 + yy, 1, 1, col('#ecc070'));
        rect(g, x + w - 3 - i, y + 2 + yy, 1, 1, col('#c88a3c'));
      }
      return;
    }
    var floor = y + h - 2;
    for (var p = 0; p < 4; p++) {
      var e = easeOut(clamp(k * 1.3, 0, 1));
      var lift = Math.sin(clamp(k, 0, 1) * Math.PI) * (6 + nth(seed, p) * 8);
      var dx = (nth(seed, p + 4) - 0.5) * w * 0.9 * e;
      var len = Math.max(3, Math.floor(w * (0.35 + nth(seed, p + 8) * 0.3)));
      var plx = x + Math.floor(w / 2) - len / 2 + dx, ply = floor - p % 2 - (1 - e) * (h - 4) * (1 - p / 4) - lift;
      rect(g, plx - 1, ply - 1, len + 2, 3, col(K));
      rect(g, plx, ply, len, 1, col(p % 2 ? '#c88a3c' : '#a0642a'));
    }
  };

  LOOKS.default = LOOKS.crate;

  // The white silhouette of a target on the frame it's hit (Metal Slug's hit flash).
  var scratch = null;
  function flashed(g, fn, x, y, w, h) {
    var pad = 16;
    var sw = w + pad * 2, sh = h + pad * 2;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width < sw || scratch.height < sh) { scratch.width = Math.max(scratch.width, sw); scratch.height = Math.max(scratch.height, sh); }
    var sg = scratch.getContext('2d');
    sg.clearRect(0, 0, scratch.width, scratch.height);
    fn(sg, pad, pad);
    sg.globalCompositeOperation = 'source-atop';
    sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, sw, sh);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, 0, 0, sw, sh, x - pad, y - pad, sw, sh);
  }

  // When a target turns fixed while on screen, remember when, so the snap can play.
  var seen = {};
  function fixAge(key, fixed, now) {
    var s = seen[key];
    if (!s) { seen[key] = { fixed: fixed, at: -99 }; return 99; }
    if (fixed && !s.fixed) s.at = now;
    s.fixed = fixed;
    var age = now - s.at;
    return age < 0 ? 99 : age;
  }

  function drawTarget(g, w, T, clone, camX, now) {
    var src = clone || T;
    var fixed = !!((w.state && w.state.fixed && w.state.fixed[T.id]) || (clone && clone.dead));
    var tw = src.w || 16, th = src.h || 16;
    var x = Math.round(src.x - camX), y = Math.round(src.y != null ? src.y : w.ground - th);
    if (x + tw < -48 || x > MS.W + 48) return;
    var age = fixAge((w.set && w.set.name || '') + ':' + T.id, fixed, now);
    var kind = LOOKS[src.kind] ? src.kind : 'default';
    var k = fixed ? (w.reduced ? 1 : clamp(age / (SNAP[kind] || 0.35), 0, 1)) : -1;
    var seed = hash(T.id != null ? T.id : T.x);
    var shape = { id: T.id, kind: kind, x: src.x, y: src.y, w: tw, h: th, label: src.label };
    var look = LOOKS[kind];
    var hitT = clone && clone.hitT || 0;
    if (hitT > 0 && !fixed) x += Math.floor(hitT * 100) % 2 ? 1 : -1;
    if (hitT > 0.04 && !fixed) flashed(g, function (sg, ox, oy) { look(sg, shape, ox, oy, now, k, seed, w.reduced); }, x, y, tw, th);
    else look(g, shape, x, y, now, k, seed, w.reduced);
  }

  function drawTargets(g, w, camX, now) {
    var level = w.set && w.set.level;
    var list = (level && level.targets) || [];
    var live = {}, done = {};
    var clones = (w.play && w.play.targets) || [];
    clones.forEach(function (c) { if (c && c.id != null) live[c.id] = c; });
    list.forEach(function (T) { if (T) { done[T.id] = 1; drawTarget(g, w, T, live[T.id], camX, now); } });
    clones.forEach(function (c) { if (c && !done[c.id]) drawTarget(g, w, c, c, camX, now); });
  }

  // ------------------------------------------------------------------ shots
  // A spec bolt: a bright pill with a cyan tail ending in a tiny bracket, |----O
  function shot(g, x, y, dir) {
    x = Math.round(x); y = Math.round(y);
    var d = dir < 0 ? -1 : 1;
    var hx = d > 0 ? x - 1 : x - 2;
    rect(g, hx - 1, y - 2, 5, 5, col('#14306a'));
    rect(g, hx - 2, y - 1, 7, 3, col('#14306a'));
    rect(g, hx - 1, y - 1, 5, 3, col('#7ff4ff'));
    rect(g, hx, y - 1, 3, 3, col('#ffffff'));
    rect(g, d > 0 ? hx - 1 : hx + 3, y, 1, 1, col('#ffffff'));
    for (var i = 2; i <= 8; i++) px(g, x - d * i, y, col(i < 5 ? '#7ff4ff' : '#2ab0d0'));
    rect(g, x - d * 9, y - 1, 1, 3, col('#2ab0d0'));
  }

  // A run of n pixels from x back along the shot (d is the direction of travel).
  function back(g, x, y, from, n, d, c) { for (var i = from; i < from + n; i++) px(g, x - d * i, y, c); }

  // The machine gun's round: a short spec bolt, white head, cyan body.
  function round(g, x, y, d) {
    rect(g, d > 0 ? x - 5 : x - 1, y - 1, 7, 3, col('#14306a'));
    back(g, x, y, 0, 2, d, col('#ffffff'));
    back(g, x, y, 2, 3, d, col('#7ff4ff'));
    px(g, x - d * 5, y, col('#2ab0d0'));
  }

  // The slingshot's pebble: a pale stone (a grey one vanished into the cave's browns), with
  // a two-pixel trail along its arc.
  function pebble(g, x, y, d, vy) {
    var k = vy / 250; // the trail leans with the arc
    px(g, x - d * 4, Math.round(y - k * 4), col('#d8c8a8'));
    px(g, x - d * 6, Math.round(y - k * 6), col('#a08a70'));
    rect(g, x - 1, y - 3, 4, 6, col(K)); rect(g, x - 2, y - 2, 6, 4, col(K));
    rect(g, x - 1, y - 2, 4, 4, col('#e8e0d0'));
    rect(g, x - 1, y + 1, 4, 1, col('#b8a890')); px(g, x + 2, y, col('#b8a890'));
    px(g, x, y - 2, col('#ffffff')); px(g, x + 1, y - 2, col('#ffffff'));
  }

  // A suction-cup arrow: red fletching, a wooden shaft and a red rubber cup on the front.
  function arrow(g, x, y, d) {
    var lo = d > 0 ? x - 12 : x + 1;
    rect(g, lo, y - 1, 12, 3, col(K));
    rect(g, d > 0 ? x - 2 : x - 1, y - 2, 4, 5, col(K));
    back(g, x, y, 2, 9, d, col('#b07c48'));
    back(g, x, y, 10, 2, d, col('#d0342c'));
    px(g, x - d * 10, y - 1, col('#d0342c')); px(g, x - d * 11, y + 1, col('#d0342c'));
    px(g, x - d * 12, y, col('#f4f0e6'));
    rect(g, x - d, y - 1, 1, 3, col('#8a1c16'));
    rect(g, x, y - 1, 1, 3, col('#c62a2a'));
    px(g, x, y, col('#ff7a68'));
  }

  // The laser: a long white-hot streak in a mint glow, thinning to a tail.
  function laser(g, x, y, d) {
    rect(g, d > 0 ? x - 17 : x - 1, y - 2, 19, 5, col('#1e8a5e'));
    back(g, x, y - 1, 0, 15, d, col('#8affc0'));
    back(g, x, y + 1, 0, 15, d, col('#8affc0'));
    back(g, x, y, 0, 13, d, col('#ffffff'));
    back(g, x, y, 13, 4, d, col('#e0fff0'));
  }

  function shotOf(g, s, camX) {
    var x = Math.round(s.x - camX), y = Math.round(s.y), d = s.vx < 0 ? -1 : 1;
    if (s.kind === 'pebble') pebble(g, x, y, d, -(s.lob || 0) + (s.g || 0) * (s.t || 0));
    else if (s.kind === 'arrow') arrow(g, x, y, d);
    else if (s.kind === 'round') round(g, x, y, d);
    else if (s.kind === 'laser') laser(g, x, y, d);
    else shot(g, x, y, d);
  }

  // ------------------------------------------------------------------ thrown slides
  // An 11x8 slide spinning about its vertical axis: face, edge, grey back, edge, face.
  function thrownSlide(g, th, camX) {
    if (th.look === 'notice') { thrownNotice(g, th, camX); return; }
    var spin = (th.t || 0) * 11 * (th.vx < 0 ? -1 : 1);
    var c = Math.cos(spin);
    var w = Math.max(1, Math.round(11 * Math.abs(c))), h = 8;
    var x = Math.round(th.x - camX - w / 2), y = Math.round(th.y - h / 2);
    if (w <= 2) { rect(g, x, y - 1, 2, h + 2, col(K)); rect(g, x, y, 1, h, col('#f8f0dc')); return; }
    rect(g, x - 1, y - 1, w + 2, h + 2, col(K));
    if (c >= 0) {
      rect(g, x, y, w, h, col('#f8f0dc'));
      rect(g, x, y, w, 2, col('#d9542a'));
      if (w >= 6) { rect(g, x + 1, y + 3, w - 2, 1, col('#9a8e80')); rect(g, x + 1, y + 5, w - 4, 1, col('#9a8e80')); }
    } else {
      rect(g, x, y, w, h, col('#e8dcc8'));
      rect(g, x, y + h - 2, w, 2, col('#c8bca8'));
    }
  }

  // A legal notice (the siege robot throws them): a folded 10x12 letter, fine print and a red
  // wax seal on the front, plain back, spinning about its vertical axis a little slower.
  function thrownNotice(g, th, camX) {
    var spin = (th.t || 0) * 8 * (th.vx < 0 ? -1 : 1);
    var c = Math.cos(spin);
    var w = Math.max(1, Math.round(10 * Math.abs(c))), h = 12;
    var x = Math.round(th.x - camX - w / 2), y = Math.round(th.y - h / 2);
    if (w <= 2) { rect(g, x, y - 1, 2, h + 2, col(K)); rect(g, x, y, 1, h, col('#fffaf0')); return; }
    rect(g, x - 1, y - 1, w + 2, h + 2, col(K));
    if (c >= 0) {
      rect(g, x, y, w, h, col('#fffaf0'));
      rect(g, x, y + 4, w, 1, col('#d6cab0'));
      if (w >= 6) {
        rect(g, x + 1, y + 1, w - 3, 1, col('#5a5470'));
        rect(g, x + 1, y + 6, w - 2, 1, col('#ada08a')); rect(g, x + 1, y + 8, w - 4, 1, col('#ada08a'));
        rect(g, x + w - 4, y + h - 4, 3, 3, col('#c4202e')); px(g, x + w - 4, y + h - 4, col('#ff7070'));
      }
    } else {
      rect(g, x, y, w, h, col('#e6dcc6'));
      rect(g, x, y + 4, w, 1, col('#c8bca2'));
    }
  }

  // ------------------------------------------------------------------ muzzle flash
  // Three frames, 0.05s each: a red-orange blob, a yellow-white star, then a streak.
  var FLASH1 = ['.oo..', 'oRRo.', 'oRRRo', '.oo..'];
  var FLASH2 = ['....y....', '..y.y.y..', '...yWy...', 'yyyWWWyyy', '...yWy...', '..y.y.y..', '....y....'];
  function stamp(g, rows, x, y, d, pal) {
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) {
      var c = pal[rows[r][i]];
      if (c) px(g, d > 0 ? x + i : x - i, y + r, c);
    }
  }
  var GLOW1 = ['.mm..', 'mWWm.', 'mWWWm', 'mWWm.', '.mm..'];
  var GLOW2 = ['..m.....', 'm..m.m..', '.mmWWmmm', 'm..m.m..', '..m.....'];
  function muzzle(g, f, camX) {
    var d = f.dir < 0 ? -1 : 1, x = Math.round(f.x - camX), y = Math.round(f.y), t = f.t || 0;
    if (f.kind === 'laser') { // a mint glow instead of fire
      if (t < 0.05) stamp(g, GLOW1, x, y - 2, d, { m: col('#8affc0'), W: col('#ffffff') });
      else if (t < 0.1) stamp(g, GLOW2, x - d, y - 2, d, { m: col('#8affc0'), W: col('#e0fff0') });
      return;
    }
    if (t < 0.05) stamp(g, FLASH1, x, y - 2, d, { o: col('#d9542a'), R: col('#ffb840') });
    else if (t < 0.1) stamp(g, FLASH2, x - d, y - 3, d, { y: col('#ffd84a'), W: col('#fff6e0') });
    else if (t < 0.15) {
      rect(g, d > 0 ? x + 3 : x - 8, y, 6, 1, col('#ffd84a'));
      px(g, d > 0 ? x + 8 : x - 8, y, col('#fff6e0'));
      px(g, x + d, y - 1, col('#a07a5c'));
    }
  }

  // ------------------------------------------------------------------ pops
  var POP_CYAN = ['#ffffff', '#c8fbff', '#7ff4ff', '#2ab0d0', '#7ff4ff'];
  var POP_GOLD = ['#fffbe0', '#ffe066', '#ffb020', '#d0601a', '#ffcf5a'];
  function pop(g, p, camX, reduced) {
    if (!MS.font || !MS.font.big) return;
    var t = p.t || 0;
    var text = String(p.label || '8PX');
    if (!/[!?]$/.test(text)) text += '!';
    var stops = (p.kind === 'chain' ? POP_GOLD : POP_CYAN).map(col);
    if (t < 0.05 && !reduced) stops = stops.map(function () { return '#ffffff'; });
    var img = MS.font.big(text, { scale: 1, outline: 1, stops: stops, shadowColor: '#0b0508' });
    var rise = easeOut(Math.min(1, t / 0.22)) * 12 + Math.max(0, t - 0.22) * 6;
    var x = Math.round(p.x - camX - img.width / 2), y = Math.round(p.y - img.height - rise);
    g.save();
    if (t > 0.6) g.globalAlpha = t > 0.7 ? 0.35 : 0.7;
    g.drawImage(img, x, y);
    g.restore();
  }

  // ------------------------------------------------------------------ explosions
  var FIRE = { dark: '#201800', white: '#f8f8f8', core: '#f8f090', hi: '#f8d060', mid: '#f0b040', body: '#e08830', low: '#c86020', under: '#983010', deep: '#680000', ash: '#380000' };
  var SMOKE = ['#383020', '#585040', '#787060', '#908878', '#b0a898'];

  // At most one white frame every third of a second, across all blasts (flash safety).
  var whiteAt = -9;
  var whiteSeen = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function whiteOk(b, now, a, reduced) {
    if (reduced) return false;
    if (whiteSeen && whiteSeen.has(b)) return whiteSeen.get(b);
    var start = now - (a - 0.033);
    if (start < whiteAt - 0.5) whiteAt = -9; // the clock went back (rewind, reload)
    var ok = start - whiteAt >= 0.34;
    if (ok) whiteAt = start;
    if (whiteSeen) whiteSeen.set(b, ok);
    return ok;
  }

  // One step of the fire ramp over a disc, light from the top left. heat 1 is white hot.
  // Steps go darkest to hottest; drawing each step for every puff before the next one
  // melts a cluster of puffs into one fireball.
  function fireStep(g, x, y, R, h, step) {
    if (R <= 0) return;
    if (step === 0) disc(g, x, y, R, col(FIRE.under));
    else if (step === 1) disc(g, x, y - 1, R - 1, col(FIRE.low));
    else if (step === 2 && h > 0.1) disc(g, x - 0.5, y - 1, R * 0.82, col(FIRE.body));
    else if (step === 3 && h > 0.25) disc(g, x - 1, y - 1.5, R * (0.4 + 0.3 * h), col(FIRE.mid));
    else if (step === 4 && h > 0.4) disc(g, x - 1, y - 2, R * (0.15 + 0.45 * h), col(FIRE.hi));
    else if (step === 5 && h > 0.55) disc(g, x - 1.5, y - 2.5, R * 0.35 * h, col(FIRE.core));
  }

  // A pillowy smoke ball: dark edge, body, a lighter top-left, all thinned together.
  function smokeBall(g, x, y, r, shade, cover) {
    var i = clamp(Math.floor(shade), 0, 3);
    ddisc(g, x, y, r + 1, col(SMOKE[0]), cover);
    ddisc(g, x, y, r, col(SMOKE[i]), cover);
    ddisc(g, x - r * 0.3, y - r * 0.35, r * 0.55, col(SMOKE[i + 1]), cover);
  }

  // One puff of an explosion, drawn in layers so a cluster of puffs reads as one blast:
  // 0 smoke gathering behind, 1 the dark edge of the fire, 2-7 the fire ramp, 8 the smoke
  // that rolls up over the dying fire, 9 new puffs' dark and white frames, and embers.
  var ROLL = 8, TOP = 9;
  function blastLayer(g, b, camX, now, reduced, layer) {
    var a = (b.t || 0) - (b.delay || 0);
    if (a < 0) return;
    var r = b.r || 8, x = b.x - camX, y = b.y;
    if (x < -r * 4 || x > MS.W + r * 4) return;
    var seed = Math.abs(Math.round(b.x * 7 + b.y * 13 + r * 31));
    var i;
    if (a < 0.066) {
      if (layer !== TOP) return;
      // the first puff flashes full size; later ones smaller, so they read as pops, not holes
      var first = !(b.delay > 0);
      if (a < 0.033) disc(g, x, y, r * (first ? 0.8 : 0.55), col(FIRE.dark));
      else disc(g, x, y, r * (first ? 0.9 : 0.7), col(whiteOk(b, now, a, reduced) ? FIRE.white : FIRE.hi));
      return;
    }
    if (layer === TOP) {
      // embers: dark-red sparks flung out and drifting up, a hot one or two early on
      for (i = 0; i < (reduced ? 3 : 5); i++) {
        var life = 0.6 + nth(seed, i) * 0.6;
        if (a > life) continue;
        var ang = -Math.PI * (0.1 + nth(seed, i + 3) * 0.8), sp = 30 + nth(seed, i + 6) * 30;
        var ex = x + Math.cos(ang) * sp * easeOut(Math.min(1, a / life)) * 0.9;
        var ey = y + Math.sin(ang) * sp * a * 0.8 - a * 12;
        var hot = a < 0.35 && i < 2;
        px(g, ex, ey, col(hot ? FIRE.mid : (Math.floor(now * 15 + i) % 2 ? FIRE.deep : FIRE.under)));
      }
      return;
    }
    var shrink = a > 0.33 ? 1 - 0.75 * clamp((a - 0.33) / 0.27, 0, 1) : 1;
    if (layer === 0) {
      if (a > 0.12 && a < 0.6) {
        // a ring of smoke balls gathers behind the fire as it cools
        var sm = clamp((a - 0.12) / 0.18, 0, 1), R0 = r * Math.max(0.6, shrink);
        for (i = 0; i < 5; i++) {
          var sa = nth(seed, i + 20) * Math.PI * 2;
          smokeBall(g, x + Math.cos(sa) * R0 * 0.9, y + Math.sin(sa) * R0 * 0.7 - sm * 4, R0 * 0.55 * sm + 1, a > 0.35 ? 1 : 0, 1);
        }
      }
      return;
    }
    if (layer === ROLL) {
      var s = a - 0.38;
      if (s <= 0) return;
      // the smoke rolls up over the dying fire as three balls, rising 20px/s in a little
      // wind, lightening and thinning out
      var cover = 1 - clamp((s - 0.45) / 0.7, 0, 1);
      for (i = 0; i < 3; i++) {
        var ox = (nth(seed, i + 30) - 0.5) * r * 0.9, oy = (nth(seed, i + 33) - 0.5) * r * 0.5;
        var rr = r * (0.3 + 0.45 * Math.min(1, s * 2)) * (0.8 + nth(seed, i + 36) * 0.4);
        smokeBall(g, x + ox + s * 7, y + oy - s * 20 - i * 2, rr, 1 + s * 2, cover);
      }
      if (s > 0.55) {
        // the cloud breaks into speckled dust
        var dk = clamp((s - 0.55) / 0.6, 0, 1);
        for (i = 0; i < 10; i++) {
          if (nth(seed, i + 50) < dk * 0.9) continue;
          var dx = (nth(seed, i + 40) - 0.5) * r * 2.4 * (0.6 + dk), dy = (nth(seed, i + 60) - 0.5) * r * 1.6 - s * 22;
          px(g, x + dx + s * 7, y + dy, col(SMOKE[2 + (i % 2)]));
        }
      }
      return;
    }
    if (a >= 0.6) return;
    // the fire: grows from 0.4r to r in 0.1s, burns, then shrinks to a dull red knot as smoke takes over
    var f = a - 0.066, heat = 1 - Math.pow(f / 0.43, 1.4);
    var R = r * (0.4 + 0.6 * easeOut(Math.min(1, f / 0.1))) * shrink;
    // a second, smaller lobe makes each puff lumpy instead of round
    var la = nth(seed, 70) * Math.PI * 2, lx = x + Math.cos(la) * R * 0.55, ly = y + Math.sin(la) * R * 0.45 - 1, lr = R * 0.62;
    if (layer === 1) {
      disc(g, x, y, R + 1, col(FIRE.dark));
      disc(g, lx, ly, lr + 1, col(FIRE.dark));
    } else {
      fireStep(g, x, y, R, heat, layer - 2);
      fireStep(g, lx, ly, lr, heat - 0.12, layer - 2);
    }
  }
  function blast(g, b, camX, now, reduced) { for (var L = 0; L <= TOP; L++) blastLayer(g, b, camX, now, reduced, L); }
  function blasts(g, list, camX, now, reduced) {
    for (var L = 0; L <= TOP; L++) for (var i = 0; i < list.length; i++) blastLayer(g, list[i], camX, now, reduced, L);
  }

  // ------------------------------------------------------------------ particles
  // render.js hands typed particles to particle() under the targets; draw() paints them
  // again over targets and blasts (drawing one twice is harmless), so sparks and chips stay on top.
  var born = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function ageOf(p) {
    if (p.age != null) return { age: p.age, life0: p.age + p.life };
    if (!born) return { age: 0, life0: p.life || 1 };
    if (!born.has(p)) born.set(p, p.life);
    var l0 = born.get(p);
    return { age: Math.max(0, l0 - p.life), life0: l0 || 1 };
  }

  function particle(g, p, camX, w) {
    if (!p) return;
    if (w && w.era != null) era = MS.palettes && MS.palettes[w.era] ? w.era : '';
    var x = Math.round(p.x - (camX || 0)), y = Math.round(p.y);
    if (x < -24 || x > MS.W + 24) return;
    var c = col(p.color || '#d8c8a8'), size = p.size || 1;
    var A = ageOf(p), k = clamp(A.age / A.life0, 0, 1);
    switch (p.kind) {
      case 'spark': {
        // a hot head with a short streak behind it
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        var len = k < 0.5 ? 3 : 2;
        for (var i = 1; i <= len; i++) px(g, x - p.vx / sp * i, y - p.vy / sp * i, col(i === 1 ? '#ffd84a' : '#d9542a'));
        px(g, x, y, c);
        return;
      }
      case 'chip': {
        // a 3x2 chunk tumbling through four frames, blinking out in its last 0.4s
        if (p.life < 0.4 && !reduced() && Math.floor(p.life * 12) % 2) return;
        var f = Math.floor(A.age * 16) % 4;
        var dark = mix(p.color || '#a07a5c', '#1a1020', 0.45);
        if (f === 0) { rect(g, x, y, 3, 2, c); px(g, x + 2, y + 1, col(dark)); }
        else if (f === 1) { rect(g, x, y, 2, 2, c); px(g, x + 1, y + 1, col(dark)); }
        else if (f === 2) { rect(g, x, y, 2, 3, c); px(g, x + 1, y + 2, col(dark)); }
        else { px(g, x, y, c); px(g, x + 1, y + 1, c); px(g, x + 1, y, col(dark)); }
        return;
      }
      case 'puff': {
        var pr = size * (1 + k * 1.2);
        var cover = 1 - clamp((k - 0.4) / 0.6, 0, 1);
        ddisc(g, x, y, pr + 1, col(SMOKE[0]), cover);
        ddisc(g, x, y, pr, c, cover);
        ddisc(g, x - pr * 0.3, y - pr * 0.35, pr * 0.5, col(mix(p.color || '#908878', '#fff6e0', 0.3)), cover);
        return;
      }
      case 'dust': {
        var dr = Math.max(1, size * (0.7 + k * 0.8));
        ddisc(g, x, y, dr, c, 1 - k * k);
        return;
      }
      case 'ember':
        px(g, x, y, Math.floor((p.x + p.y) * 0.5 + k * 20) % 2 ? c : col('#8e2f24'));
        return;
      case 'drop':
        px(g, x, y, col('#ffffff')); px(g, x, y + 1, col(p.color || '#c8e8ff'));
        return;
      case 'sweat': {
        var sc = col(p.color || '#6ac8ff');
        px(g, x, y, sc); rect(g, x - 1, y + 1, 2, 2, sc); px(g, x - 1, y + 1, col('#ffffff'));
        return;
      }
      case 'casing':
        // a spent shell (optional flavor): 2x1 brass, flipping end over end every 0.06s
        if (Math.floor(A.age / 0.06) % 2) rect(g, x, y, 1, 2, col(p.color || '#f0c848'));
        else rect(g, x, y, 2, 1, col(p.color || '#f0c848'));
        return;
      case 'confetti': {
        // a slide scrap fluttering: wide, square, tall, square
        var cf = Math.floor(A.age * 14 + (p.x + p.y) * 0.1) % 4;
        if (cf === 0) rect(g, x - 1, y, 3, 1, c);
        else if (cf === 2) rect(g, x, y - 1, 1, 2, c);
        else { rect(g, x, y, 2, 1, c); px(g, x + 1, y + 1, col(mix(p.color || '#f8f0dc', '#1a1020', 0.35))); }
        return;
      }
      default:
        rect(g, x, y, size, size, c);
    }
  }
  var lastReduced = false;
  function reduced() { return lastReduced; }

  // ------------------------------------------------------------------ draw
  function draw(g, w, camX, t) {
    if (!w) return;
    era = MS.palettes && MS.palettes[w.era] ? w.era : '';
    lastReduced = !!w.reduced;
    var now = t || 0;
    var fx = w.fx || {};
    var play = w.play;
    drawTargets(g, w, camX, now);
    if (play && play.thrown) play.thrown.forEach(function (th) { if (th && !th.dead) thrownSlide(g, th, camX); });
    if (fx.blasts && fx.blasts.length) blasts(g, fx.blasts, camX, now, w.reduced);
    (fx.particles || []).forEach(function (p) { if (p && p.kind && p.kind !== 'dot') particle(g, p, camX); });
    if (play && play.shots) play.shots.forEach(function (s) { shotOf(g, s, camX); });
    (fx.flashes || []).forEach(function (f) { muzzle(g, f, camX); });
    (fx.pops || []).forEach(function (p) { pop(g, p, camX, w.reduced); });
  }

  MS.playfx = {
    draw: draw, particle: particle, drawTargets: drawTargets, shot: shot, blast: blast, blasts: blasts, muzzle: muzzle,
    looks: LOOKS, tiny: tiny, tinyWidth: tinyWidth
  };
})(typeof window !== 'undefined' ? window : globalThis);
