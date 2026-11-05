/* METAL SLIDE engine: everything drawn on top of the world.
   Dialogue box (four era styles), crowd bubbles, emotes, the Metal Slug HUD, the
   MISSION START and MISSION COMPLETE lettering, callouts, banners, the results box,
   the ending, the title screen text, demo-mode labels and the control hints.
   Blinks stay at 2 Hz or slower (steady when motion is reduced); nothing strobes. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var F = MS.font;
  var W = MS.W, H = MS.H;

  var BOX = { x: 6, y: 164, w: 372, h: 46 };
  var GOLD = ['#fffbe0', '#ffe066', '#ffb020', '#d0601a', '#ffcf5a'];
  var SILVER = ['#ffffff', '#e8ecf4', '#bcc4d0', '#7a8494', '#d8dee8'];
  var RED = ['#fff0e0', '#ff9a5a', '#ff5a2a', '#c02a1a', '#ff7a4a'];
  var CYAN = ['#ffffff', '#d0fbff', '#7ff4ff', '#2ab0d0', '#b0f8ff'];
  // HUD gradients, after the Metal Slug screen: lavender silver score, fire-colored TIME.
  var CHROME = ['#ffffff', '#eceefa', '#c6c8ea', '#9c9ed2', '#dcdcf4'];
  var BLAZE = ['#fff6a0', '#ffe040', '#ffa020', '#ff6010', '#e03a10'];
  var LEMON = ['#ffffd0', '#fff070', '#ffd828', '#e8a010', '#fff08a'];
  var WHITE = ['#ffffff', '#ffffff', '#eef0f8', '#d4d8e6', '#ffffff'];
  var INK = '#0b0810';
  var LAVENDER = '#b0a0ff';

  // One look per era. text/hl: body and highlight; tagBg/tagFg: the name tag.
  var STYLES = {
    metal: { text: '#f2dcb0', hl: '#ffb840', tagBg: '#8e2f24', tagFg: '#fff6e0', portraitBg: '#2f6e70', narr: '#d6a77c', arrow: '#ffb840' },
    parchment: { text: '#45283c', hl: '#3f3f74', tagBg: '#663931', tagFg: '#eec39a', portraitBg: '#d9a066', narr: '#663931', arrow: '#ac3232' },
    card: { text: '#1d2130', hl: '#c8261e', tagBg: '#1d2130', tagFg: '#ffffff', portraitBg: '#e9ecf3', narr: '#3a4152', arrow: '#c8261e' },
    glass: { text: '#eaf8ff', hl: '#ffd36a', tagBg: '#7ff4ff', tagFg: '#06202a', portraitBg: '#0e2a44', narr: '#bfe9ff', arrow: '#7ff4ff' },
    arcade: { text: '#ffffff', hl: '#ffd23a', tagBg: '#2a4ad0', tagFg: '#ffffff', portraitBg: '#1a1f3a', narr: '#c8d0ff', arrow: '#ffd23a' }
  };
  var ERA_STYLE = { stone: 'metal', medieval: 'parchment', modern: 'card', future: 'glass', title: 'arcade' };

  function styleOf(world) { return STYLES[ERA_STYLE[world.era] || 'arcade']; }
  function styleName(world) { return ERA_STYLE[world.era] || 'arcade'; }

  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function stroke(g, x, y, w, h, c) { rect(g, x, y, w, 1, c); rect(g, x, y + h - 1, w, 1, c); rect(g, x, y, 1, h, c); rect(g, x + w - 1, y, 1, h, c); }

  // On for half of each cycle, `hz` cycles a second. Steady when motion is reduced.
  function blink(t, hz, reduced) { return reduced || Math.floor(t * hz * 2) % 2 === 0; }

  // ------------------------------------------------------------------ floating text
  // HUD text is gradient lettering with a 1px outline and a drop shadow, no plate,
  // which is how Metal Slug keeps it readable over bright skies.
  function hudText(text, stops, opts) {
    opts = opts || {};
    return F.big(String(text), { scale: opts.scale || 1, stops: stops, italic: false, bold: !!opts.bold });
  }
  // F.big images carry a 1px outline: put the ink's top-left at (x, y).
  function put(g, img, x, y) { g.drawImage(img, Math.round(x) - 1, Math.round(y) - 1); }
  // Right-align upright, non-bold big text so its last ink column sits at x.
  function putRight(g, img, x, y, scale) { g.drawImage(img, Math.round(x - (img.width - 3 - 2 * scale)), Math.round(y) - 1); }
  // Small outlined label in one color. Returns the ink width.
  function say(g, text, x, y, color) {
    put(g, F.big(String(text), { scale: 1, stops: [color || '#ffffff'], italic: false }), x, y);
    return F.measure(String(text));
  }

  // Glyphs the font lacks, drawn here: '#' is ink, rows line up with the font's cap rows.
  var EXTRA = {
    '↑': ['', '..#..', '.###.', '#.#.#', '..#..', '..#..'],
    '↓': ['', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
    '∞': ['', '.##...##.', '#..#.#..#', '#...#...#', '#..#.#..#', '.##...##.'],
    // The ARMS box's infinity, as tall and heavy as the arcade's ammo numerals.
    'INF': ['.###.....###.', '##.##...##.##', '#...##.##...#', '#....###....#', '#...##.##...#', '##.##...##.##', '.###.....###.']
  };
  function glyphW(ch) {
    var e = EXTRA[ch];
    if (!e) return F.measure(ch);
    var w = 0;
    e.forEach(function (r) { w = Math.max(w, r.length); });
    return w;
  }
  function inkW(text) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += glyphW(text.charAt(i)) + 1;
    return Math.max(0, w - 1);
  }
  function ink(g, text, x, y, color) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), e = EXTRA[ch];
      if (e) {
        g.fillStyle = color;
        e.forEach(function (row, ry) { for (var rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect(cx + rx, y + ry, 1, 1); });
      } else F.draw(g, ch, cx, y, color);
      cx += glyphW(ch) + 1;
    }
  }
  // An extra glyph as HUD lettering (gradient, outline, shadow), same look as hudText.
  var sprites = {};
  function glyphSprite(ch, stops) {
    var key = ch + stops.join();
    if (sprites[key]) return sprites[key];
    var rows = EXTRA[ch];
    var c = document.createElement('canvas');
    c.width = glyphW(ch) + 3; c.height = rows.length + 3;
    var cg = c.getContext('2d');
    function each(fn) { rows.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (row[x] === '#') fn(x, y); }); }
    cg.fillStyle = '#0b0508'; each(function (x, y) { cg.fillRect(x + 1, y + 1, 3, 3); });
    cg.fillStyle = '#1b0e12'; each(function (x, y) { cg.fillRect(x, y, 3, 3); });
    each(function (x, y) { cg.fillStyle = stops[Math.min(stops.length - 1, Math.floor(y / 7 * stops.length))]; cg.fillRect(x + 1, y + 1, 1, 1); });
    return (sprites[key] = c);
  }

  // ------------------------------------------------------------------ key caps and pad buttons
  // A light key with a dark glyph and a dark rim: reads as "a key" on any background.
  function keycap(g, label, x, y) {
    var w = inkW(label) + 6;
    rect(g, x, y - 1, w, 13, INK); rect(g, x - 1, y, w + 2, 11, INK);
    rect(g, x, y, w, 11, '#8e8ab8');
    rect(g, x, y, w, 9, '#f4f2ff');
    ink(g, label, x + 3, y + 1, '#1d1430');
    return w;
  }
  // A round gamepad face button (standard mapping colors).
  var CIRCLE = [[3, 7], [1, 9], [1, 9], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [1, 9], [1, 9], [3, 7]];
  var FACE = { A: ['#7ae08e', '#2fa84f'], B: ['#ff9a7a', '#d8402a'], X: ['#8ab8ff', '#2f6fd8'], Y: ['#ffe080', '#d8a018'] };
  function padButton(g, letter, x, y) {
    var c = FACE[letter] || ['#c0c0d0', '#606070'];
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) {
      CIRCLE.forEach(function (s, r) { rect(g, x + s[0] + o[0], y + r + o[1], s[1] - s[0] + 1, 1, INK); });
    });
    CIRCLE.forEach(function (s, r) { rect(g, x + s[0], y + r, s[1] - s[0] + 1, 1, r < 2 ? c[0] : c[1]); });
    F.draw(g, letter, x + 3, y + 2, '#ffffff');
    return 11;
  }
  // A tiny d-pad cross.
  function cross(g, x, y) {
    var arms = [[x + 4, y, 3, 11], [x, y + 4, 11, 3]];
    arms.forEach(function (a) { rect(g, a[0] - 1, a[1] - 1, a[2] + 2, a[3] + 2, INK); });
    arms.forEach(function (a) { rect(g, a[0], a[1], a[2], a[3], '#dfe2f0'); });
    rect(g, x + 5, y + 5, 1, 1, '#6a6e88');
    return 11;
  }
  // A row of hint parts: ['cap', '←'], ['btn', 'A'], ['cross'], ['txt', 'MOVE'], ['gap'].
  function partW(p) {
    switch (p[0]) {
      case 'cap': return inkW(p[1]) + 6;
      case 'btn': case 'cross': return 11;
      case 'txt': return F.measure(p[1]);
      default: return 9;
    }
  }
  function spacing(p, next) {
    if (!next || p[0] === 'gap' || next[0] === 'gap') return 0;
    return p[0] === 'txt' || next[0] === 'txt' ? 4 : 3;
  }
  function stripW(parts) {
    var w = 0;
    parts.forEach(function (p, i) { w += partW(p) + spacing(p, parts[i + 1]); });
    return w;
  }
  function strip(g, parts, x, y, color) {
    var cx = Math.round(x);
    parts.forEach(function (p, i) {
      if (p[0] === 'cap') keycap(g, p[1], cx, y);
      else if (p[0] === 'btn') padButton(g, p[1], cx, y);
      else if (p[0] === 'cross') cross(g, cx, y);
      else if (p[0] === 'txt') say(g, p[1], cx, y + 2, color);
      cx += partW(p) + spacing(p, parts[i + 1]);
    });
  }

  // Whether the letter-key shortcuts are on (Options can turn them off).
  function letters() { return !MS.input || !MS.input.letterKeys || MS.input.letterKeys(); }

  // Which controls to name: the last device used ('key' | 'pad' | 'touch').
  function device(game) {
    var d = game.lastDevice;
    if (d === 'touch' || d === 'pad' || d === 'key') return d;
    return game.touch ? 'touch' : 'key';
  }
  var MOVE_HINT = {
    key: [['cap', '←'], ['cap', '→'], ['txt', 'MOVE'], ['gap'], ['cap', '↑'], ['txt', 'JUMP'], ['gap'], ['cap', 'Z'], ['txt', 'FIRE']],
    plain: [['cap', '←'], ['cap', '→'], ['txt', 'MOVE'], ['gap'], ['cap', '↑'], ['txt', 'JUMP'], ['gap'], ['cap', 'ENTER'], ['txt', 'FIRE']], // letter keys off
    pad: [['cross'], ['txt', 'MOVE'], ['gap'], ['btn', 'A'], ['txt', 'JUMP'], ['gap'], ['btn', 'X'], ['txt', 'FIRE']],
    touch: [['txt', 'TAP: FIRE'], ['gap'], ['txt', 'SWIPE UP: JUMP'], ['gap'], ['txt', 'SWIPE DOWN: DUCK']] // the runner
  };

  // ------------------------------------------------------------------ letter-by-letter lettering
  // Big lettering split into letters that line up exactly with the whole word, so each
  // can stamp in or fly off on its own.
  var spells = {};
  function spell(text, scale, stops) {
    var key = text + '|' + scale + '|' + stops.join();
    if (spells[key]) return spells[key];
    var o = { scale: scale, stops: stops, bold: true };
    var whole = F.big(text, o);
    var list = [], adv = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch !== ' ') list.push({ i: i, ch: ch, x: adv * scale, img: F.big(ch, o) });
      adv += F.glyph(ch).w + 2;
    }
    return (spells[key] = { w: whole.width, h: whole.height, list: list, scale: scale, stops: stops });
  }
  // Letter i lands at i*step, drawn one size bigger for its first 0.05s (the stamp).
  // From `out` on, the letters scatter for 0.4s and fade out (a fade, never a blink).
  function drawSpell(g, S, left, top, t, step, out, alpha) {
    alpha = alpha == null ? 1 : alpha;
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    S.list.forEach(function (L, n) {
      var at = L.i * step;
      if (t < at) return;
      var x = left + L.x, y = top;
      if (out != null && t >= out) {
        var s = t - out;
        if (s >= 0.4) return;
        var r = MS.util.rng(977 + n * 7919 + S.list.length);
        var vx = (r() * 2 - 1) * 120, vy = -80 + r() * 160;
        g.globalAlpha = alpha * (1 - s / 0.4);
        g.drawImage(L.img, Math.round(x + vx * s), Math.round(y + vy * s + 160 * s * s));
        g.globalAlpha = alpha;
        return;
      }
      if (t - at < 0.05) {
        var big = F.big(L.ch, { scale: S.scale + 1, stops: S.stops, bold: true });
        g.drawImage(big, Math.round(x + (L.img.width - big.width) / 2), Math.round(y + (L.img.height - big.height) / 2));
      } else g.drawImage(L.img, x, y);
    });
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ boxes
  function frameBox(g, name, x, y, w, h) {
    if (name === 'metal') {
      rect(g, x, y, w, h, '#0b0810');
      rect(g, x + 1, y + 1, w - 2, h - 2, '#4e3a3a');
      rect(g, x + 1, y + 1, w - 2, 1, '#75574a');
      rect(g, x + 1, y + h - 2, w - 2, 1, '#1d1420');
      rect(g, x + 3, y + 3, w - 6, h - 6, '#0b0810');
      rect(g, x + 4, y + 4, w - 8, h - 8, '#1d1420');
      [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]].forEach(function (p) { rect(g, p[0], p[1], 1, 1, '#a07a5c'); });
    } else if (name === 'parchment') {
      rect(g, x, y, w, h, '#222034');
      rect(g, x + 1, y + 1, w - 2, h - 2, '#663931');
      rect(g, x + 1, y + 1, w - 2, 1, '#8f563b');
      rect(g, x + 3, y + 3, w - 6, h - 6, '#45283c');
      rect(g, x + 4, y + 4, w - 8, h - 8, '#eec39a');
      rect(g, x + 4, y + 4, w - 8, 1, '#d9a066');
      rect(g, x + 4, y + 4, 1, h - 8, '#d9a066');
    } else if (name === 'card') {
      g.fillStyle = 'rgba(10,14,30,0.35)'; g.fillRect(x + 2, y + 3, w, h);
      rect(g, x + 1, y, w - 2, h, '#cfd4df');
      rect(g, x, y + 1, w, h - 2, '#cfd4df');
      rect(g, x + 1, y + 1, w - 2, h - 2, '#ffffff');
      rect(g, x + 1, y + 1, 2, h - 2, '#c8261e');
    } else if (name === 'glass') {
      g.fillStyle = 'rgba(127,244,255,0.18)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = 'rgba(6,18,38,0.86)'; g.fillRect(x, y, w, h);
      rect(g, x, y, w, 1, '#7ff4ff'); rect(g, x, y + h - 1, w, 1, '#3aa8c8');
      rect(g, x, y, 1, h, '#7ff4ff'); rect(g, x + w - 1, y, 1, h, '#3aa8c8');
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 1, y + 1, w - 2, 4);
    } else {
      rect(g, x, y, w, h, '#ffffff');
      rect(g, x + 1, y + 1, w - 2, h - 2, '#141832');
      rect(g, x + 2, y + 2, w - 4, h - 4, '#1e2448');
    }
  }

  function nameTag(g, s, name, x, y) {
    var w = F.measure(name) + 10;
    rect(g, x, y, w, 11, '#0b0810');
    rect(g, x + 1, y + 1, w - 2, 10, s.tagBg);
    F.draw(g, name, x + 5, y + 2, s.tagFg);
    return w;
  }

  function arrowDown(g, x, y, col) {
    rect(g, x, y, 5, 1, col); rect(g, x + 1, y + 1, 3, 1, col); rect(g, x + 2, y + 2, 1, 1, col);
  }

  // ------------------------------------------------------------------ dialogue
  function drawLine(g, world, L, t, reduced) {
    var sname = styleName(world);
    var s = STYLES[sname];
    var jx = L.angry && L.shown < L.total && !reduced ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
    var bx = BOX.x + jx;
    frameBox(g, sname, bx, BOX.y, BOX.w, BOX.h);
    var portrait = L.type === 'say';
    var tx = portrait ? bx + 47 : bx + 8;
    if (portrait) {
      var actor = L.id && world.actors[L.id];
      var costumeId = actor ? actor.costume : null;
      var costume = costumeId && MS.costumes[costumeId];
      rect(g, bx + 5, BOX.y + 5, 36, 36, s.portraitBg);
      if (costume) {
        var talking = L.shown < L.total && Math.floor(t * 8) % 2 === 0;
        var p = MS.rig.portrait(costumeId, costume, { expr: actor.expr || null, talking: talking, era: paletteEra(world) });
        g.drawImage(p, bx + 5, BOX.y + 5);
      } else {
        F.drawCentered(g, (L.speaker || '?').charAt(0), bx + 23, BOX.y + 19, s.hl);
      }
      if (sname === 'metal') { rect(g, bx + 4, BOX.y + 4, 38, 1, '#75574a'); }
    }
    if (L.speaker && portrait) nameTag(g, s, L.speaker, bx + 4, BOX.y - 9);
    var left = Math.floor(L.shown);
    var col = L.type === 'narrate' ? s.narr : s.text;
    for (var i = 0; i < L.lines.length; i++) {
      var vis = F.visibleLength(L.lines[i]);
      F.draw(g, L.lines[i], tx, BOX.y + 6 + i * 11, col, { hl: s.hl, limit: Math.max(0, left) });
      left -= vis + 1;
    }
    if (L.shown >= L.total && Math.floor(t * 2.5) % 2 === 0) arrowDown(g, bx + BOX.w - 13, BOX.y + BOX.h - 8, s.arrow);
  }

  function paletteEra(world) { return MS.palettes && MS.palettes[world.era] ? world.era : ''; }

  // ------------------------------------------------------------------ bubbles
  function bubbleBox(g, text, cx, bottom, s) {
    var lines = F.wrap(text, 92);
    var tw = 0;
    lines.forEach(function (l) { tw = Math.max(tw, F.measure(l)); });
    var w = tw + 8, h = lines.length * 10 + 5;
    var x = Math.round(Math.max(2, Math.min(W - w - 2, cx - w / 2)));
    var y = Math.round(bottom - h - 4);
    rect(g, x + 1, y, w - 2, h, '#140c12'); rect(g, x, y + 1, w, h - 2, '#140c12');
    rect(g, x + 1, y + 1, w - 2, h - 2, '#fffdf6');
    var tx = Math.max(x + 3, Math.min(x + w - 5, Math.round(cx)));
    rect(g, tx - 1, y + h - 1, 3, 2, '#fffdf6'); rect(g, tx - 2, y + h - 1, 1, 2, '#140c12'); rect(g, tx + 2, y + h - 1, 1, 2, '#140c12');
    rect(g, tx, y + h + 1, 1, 2, '#140c12'); rect(g, tx - 1, y + h + 1, 1, 1, '#140c12'); rect(g, tx + 1, y + h + 1, 1, 1, '#140c12');
    lines.forEach(function (l, i) { F.draw(g, l, x + 4, y + 3 + i * 10, '#1d1420', { hl: '#c8261e' }); });
    return { x: x, y: y, w: w, h: h };
  }

  function headY(world, a) {
    var cos = MS.costumes[a.costume];
    var f = MS.rig.frame(a.costume, cos, a.anim, MS.rig.frameIndex(a.anim, a.t), { era: paletteEra(world), chained: a.chained });
    return world.ground - (f.oy - f.headTop) + a.y;
  }

  function drawBubbles(g, world, camX) {
    var placed = [];
    var list = world.ui.bubbles.filter(function (b) { return b.t >= b.delay; });
    list.forEach(function (b, n) {
      var a = b.id && world.actors[b.id];
      var cx, bottom;
      if (a && a.visible) { cx = Math.round(a.x - camX); bottom = headY(world, a) - 2; }
      else { cx = 60 + (n * 97) % (W - 120); bottom = 60 + (n % 2) * 16; }
      // lift a bubble that would overlap one already placed
      for (var k = 0; k < placed.length; k++) {
        var p = placed[k];
        if (Math.abs(p.cx - cx) < 70 && Math.abs(p.bottom - bottom) < 14) bottom = p.bottom - 15;
      }
      if (b.auto) bottom -= 2;
      var r = bubbleBox(g, b.text, cx, bottom, null);
      placed.push({ cx: cx, bottom: r.y + r.h });
    });
  }

  function drawEmotes(g, world, camX) {
    world.fx.emotes.forEach(function (e) {
      var a = world.actors[e.id];
      if (!a || !a.visible) return;
      if (e.t < 0.12) return;
      var img = MS.props.emote(e.kind);
      var y = headY(world, a) - img.height - 2 - Math.round(Math.sin(Math.min(1, e.t / 0.25) * Math.PI) * 3);
      g.globalAlpha = e.t > e.dur - 0.25 ? Math.max(0, (e.dur - e.t) / 0.25) : 1; // fade out, no blinking
      g.drawImage(img, Math.round(a.x - camX - img.width / 2 + a.facing * 3), y);
      g.globalAlpha = 1;
    });
  }

  function drawSpeakerMark(g, world, camX, t) {
    var L = world.ui.line;
    if (!L || !L.id) return;
    var a = world.actors[L.id];
    if (!a || !a.visible) return;
    var x = Math.round(a.x - camX) - 2;
    if (x < -4 || x > W) return;
    var y = headY(world, a) - 7 - (Math.floor(t * 3) % 2);
    var s = styleOf(world);
    rect(g, x - 1, y - 1, 7, 4, '#140c12');
    arrowDown(g, x, y, s.arrow === '#7ff4ff' ? '#7ff4ff' : '#ffd23a');
  }

  // ------------------------------------------------------------------ overlays
  function dim(g, a) { g.fillStyle = 'rgba(6,4,10,' + a + ')'; g.fillRect(0, 0, W, H); }

  function centered(g, img, cx, y) { g.drawImage(img, Math.round(cx - img.width / 2), Math.round(y)); }

  function fitScale(text, maxW, scale) {
    var s = scale;
    while (s > 1 && (F.measure(text) + text.length + 5) * s > maxW) s--;
    return s;
  }
  function bigFit(text, maxW, scale, stops) {
    return F.big(text, { scale: fitScale(text, maxW, scale), stops: stops, bold: true });
  }

  // MISSION n stamps in letter by letter, then START!, a hold, then every letter
  // scatters. The mission title stays as a caption until the click. Reduced motion
  // shows the whole card at once and keeps it.
  var CARD = { step: 0.07, hold: 1.8 };
  function drawTitleCard(g, T, reduced) {
    var t = reduced ? 9 : T.t;
    var out = reduced ? null : CARD.hold;
    // The dim eases off as the letters fly, leaving the mission name as a caption.
    var lift = out == null ? 0 : MS.util.clamp((t - out) / 0.4, 0, 1);
    dim(g, (0.32 - 0.14 * lift) * Math.min(1, t / 0.2));
    var head = 'MISSION ' + T.num;
    var m = spell(head, 3, GOLD);
    drawSpell(g, m, Math.round(W / 2 - m.w / 2), 42, t, CARD.step, out);
    var at = CARD.step * head.length + 0.2;
    if (t >= at) {
      var st = spell('START!', 3, RED);
      drawSpell(g, st, Math.round(W / 2 - st.w / 2), 74, t - at, 0, out == null ? null : out - at);
    }
    var subAt = at + 0.15;
    if (t > subAt) {
      var sub = bigFit(String(T.title).toUpperCase(), W - 24, 2, SILVER);
      g.globalAlpha = Math.min(1, (t - subAt) / 0.25);
      centered(g, sub, W / 2, 114);
      g.globalAlpha = 1;
    }
  }

  function drawCallout(g, world, reduced, lower) {
    var c = world.fx.callout;
    if (!c) return;
    var stops = world.era === 'future' ? CYAN : GOLD;
    var S = spell(c.text, fitScale(c.text, W - 20, 3), stops);
    var fade = c.t > c.dur - 0.3 ? Math.max(0, (c.dur - c.t) / 0.3) : 1;
    drawSpell(g, S, Math.round(W / 2 - S.w / 2), lower ? 68 : 34, reduced ? 9 : c.t, 0.045, null, fade);
  }

  function drawBanner(g, world, B) {
    dim(g, 0.45);
    var img = bigFit(B.text, W - 20, 3, world.era === 'future' ? CYAN : GOLD);
    centered(g, img, W / 2, 72);
  }

  // ------------------------------------------------------------------ mission complete
  function countUp(val, k) {
    val = String(val);
    if (k >= 1) return val;
    var m = /^(\d+)(.*)$/.exec(val);
    if (m) return String(Math.round(Number(m[1]) * k)) + m[2];
    return val.slice(0, Math.ceil(val.length * k));
  }

  function resultsBox(g, x, y, w, h) {
    g.fillStyle = 'rgba(24,14,58,0.84)'; g.fillRect(x, y, w, h);
    stroke(g, x - 1, y - 1, w + 2, h + 2, INK);
    stroke(g, x, y, w, h, LAVENDER);
    stroke(g, x + 1, y + 1, w - 2, h - 2, '#4a3c8c');
  }

  // [complete]: MISSION COMPLETE! builds letter by letter over the victory pose.
  // TALLY rows: the RECAPTURED PRISONER results box, rows counting up, then GREAT!
  function drawTally(g, director, w, M, ui, t, reduced) {
    var rows = w.tally.rows;
    var title = 'MISSION COMPLETE!';
    var sc = fitScale(title, W - 16, 3);
    var S = spell(title, sc, GOLD);
    if (!rows.length) {
      dim(g, 0.22);
      var ct = ui.complete ? completeT(ui.complete, t) : 9;
      drawSpell(g, S, Math.round(W / 2 - S.w / 2), 50, reduced ? 9 : ct, 0.07, null);
      return;
    }
    dim(g, 0.55);
    centered(g, F.big(title, { scale: sc, stops: GOLD, bold: true }), W / 2, 6);
    centered(g, F.big('RECAPTURED PRISONER', { scale: 1, stops: SILVER, bold: true }), W / 2, 40);
    var rowH = rows.length > 6 ? 11 : 13;
    var px = 44, pw = W - 88, py = 55;
    var ph = 31 + rows.length * rowH + 3;
    resultsBox(g, px, py, pw, ph);
    // 1P, one POW per rescued dev, and the score
    put(g, hudText('1P', LEMON, { scale: 2, bold: true }), px + 8, py + 6);
    var pow = powImg();
    var n = Math.min(14, w.hud.saved || 0);
    for (var i = 0; i < n; i++) g.drawImage(pow, px + 38 + i * (pow.width + 1), py + 20 - pow.height);
    putRight(g, hudText(scoreOf(w, M), CHROME), px + pw - 9, py + 11, 1);
    rect(g, px + 6, py + 26, pw - 12, 1, '#4a3c8c');
    rows.forEach(function (r, i) {
      var y = py + 31 + i * rowH;
      var isNew = ui.row && ui.row.index === i;
      var k = isNew ? Math.min(1, ui.row.t / 0.8) : 1;
      var label = String(r.label).toUpperCase();
      F.draw(g, label, px + 10, y, '#e4dcff', { shadow: INK });
      var shown = countUp(r.value, k).toUpperCase();
      var vw = F.measure(shown);
      if (shown) putRight(g, hudText(shown, GOLD), px + pw - 9, y, 1);
      for (var dx = px + 14 + F.measure(label); dx < px + pw - 14 - vw; dx += 4) rect(g, dx, y + 6, 1, 1, '#6a5cb0');
    });
    // GREAT! once the last row has counted up
    var total = 0;
    M.steps.forEach(function (s) { if (s.wait && s.wait.type === 'tally') total++; });
    var counted = !ui.row || ui.row.t >= 0.9;
    if (rows.length >= total && counted) {
      var gt = ui.row ? ui.row.t - 0.9 : 9;
      var G = spell('GREAT!', 3, RED);
      drawSpell(g, G, px + pw - G.w + 14, py + ph - 7, reduced ? 9 : gt, 0.05, null); // hangs off the box's bottom edge
    }
  }

  // links: the mission ends with case-study links (main.js puts them at the bottom), so
  // the replay prompt moves up into the band, clear of them.
  // A closing line ([the end: Ready for the next adventure!]) stamps in under THE END,
  // letter by letter, once the title has landed.
  function drawEnding(g, world, t, reduced, demo, links, et) {
    var line = world.endingText ? String(world.endingText).toUpperCase() : null;
    var top = line ? 24 : 30;
    dim(g, 0.3);
    rect(g, 0, top, W, (line ? 26 : 0) + (links ? 90 : 74), 'rgba(6,4,14,0.55)');
    centered(g, F.big('THE END', { scale: 4, stops: world.era === 'future' ? CYAN : GOLD, bold: true }), W / 2, top + 6);
    var y = 88;
    if (line) {
      var S = spell(line, fitScale(line, W - 20, 2), GOLD);
      drawSpell(g, S, Math.round(W / 2 - S.w / 2), 66, reduced ? 9 : (et == null ? 9 : et - 0.8), 0.045, null);
      y = 92;
    }
    F.drawCentered(g, 'THANK YOU FOR PLAYING', W / 2, y, '#ffffff');
    if (!demo && blink(t, 1, reduced)) centered(g, F.big('PRESS START TO PLAY AGAIN', { scale: 1, stops: GOLD, bold: true }), W / 2, links ? y + 16 : 182);
  }

  // ------------------------------------------------------------------ HUD
  // Score comes from world state only, so rewinding and jumping always agree:
  // 1000 per rescued dev, 100 per fixed target, 500 per mission number.
  function scoreOf(w, M) {
    var fixed = (w.state && w.state.fixed) || {};
    var n = 0;
    for (var k in fixed) if (fixed[k]) n++;
    return (w.hud.saved || 0) * 1000 + n * 100 + (parseInt(M && M.num, 10) || 0) * 500;
  }

  // Clocks the HUD needs: TIME counts from when the mission's title card ends, and the
  // MISSION COMPLETE build times itself if the world doesn't tick ui.complete.t.
  var clock = { mi: -1, t0: 0, done: null, doneT0: 0 };
  function tickClocks(director, w, t) {
    if (director.mi !== clock.mi || director.si === 0) { clock.mi = director.mi; clock.t0 = t; }
    var c = w.ui.complete;
    if (c && c !== clock.done) { clock.done = c; clock.doneT0 = t - (c.t || 0); }
  }
  function completeT(c, t) { return Math.max(c.t || 0, t - clock.doneT0); }
  // Purely cosmetic: 60, minus one every 4 seconds, never below 0.
  function timeLeft(t) { return Math.max(0, 60 - Math.floor((t - clock.t0) / 4)); }

  var fallbackPow = null;
  function powImg() {
    if (MS.props && typeof MS.props.powIcon === 'function') {
      try { var p = MS.props.powIcon(); if (p) return p; } catch (e) { /* use the fallback */ }
    }
    if (!fallbackPow) {
      var rows = ['.###.', '.###.', '..#..', '#####', '..#..', '.#.#.', '#...#'];
      fallbackPow = document.createElement('canvas');
      fallbackPow.width = 7; fallbackPow.height = 9;
      var pg = fallbackPow.getContext('2d');
      rows.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] === '#') { pg.fillStyle = INK; pg.fillRect(x, y, 3, 3); }
      });
      rows.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] === '#') { pg.fillStyle = GOLD[Math.min(4, Math.floor(y / 7 * 4))]; pg.fillRect(x + 1, y + 1, 1, 1); }
      });
    }
    return fallbackPow;
  }

  function armsLetter(arms) {
    if (!arms || arms === 'NONE') return '';
    return String(arms).replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase();
  }

  // The ARMS box: a 1px grey-blue frame (dark edges so it holds up on bright skies),
  // transparent inside, the tool's crate letter icon and an infinity sign.
  function armsBox(g, w, x, y) {
    var bw = 62, bh = 24;
    stroke(g, x - 1, y - 1, bw + 2, bh + 2, 'rgba(11,8,16,0.75)');
    stroke(g, x, y, bw, bh, '#8a94b0');
    stroke(g, x + 1, y + 1, bw - 2, bh - 2, 'rgba(11,8,16,0.75)');
    put(g, hudText('ARMS', WHITE), x + 5, y + 4);
    put(g, glyphSprite('INF', GOLD), x + 5, y + 13);
    var letter = armsLetter(w.hud.arms);
    if (letter && MS.props && MS.props.item) {
      var it = MS.props.item(letter);
      g.drawImage(it, x + bw - 5 - it.width, y + Math.round((bh - it.height) / 2));
    }
  }

  function drawHud(g, director, w, M, t, reduced) {
    var demo = !!director.autoplay;
    // Top left: the score, then 1UP=∞ (Sam can't lose).
    putRight(g, hudText(scoreOf(w, M), CHROME), 72, 6, 1);
    put(g, hudText('1UP=', GOLD), 18, 17);
    put(g, glyphSprite('∞', GOLD), 19 + F.measure('1UP='), 17);
    armsBox(g, w, 76, 4);
    // TIME: two big digits, no label.
    var tl = timeLeft(t);
    put(g, hudText((tl < 10 ? '0' : '') + tl, BLAZE, { scale: 2, bold: true }), 142, 5);
    // The 2P side.
    // scale 1 leaves the gap between TIME and this prompt for the on-screen buttons
    if (blink(t, 1, reduced)) putRight(g, hudText(demo ? 'INSERT COIN' : 'PRESS START', SILVER, { scale: 1 }), W - 7, 8, 2);
    // Bottom row: skipped while the dialogue box would cut it in half, or the touch pad covers it.
    if (w.ui.line) return;
    var pow = powImg();
    var n = Math.min(14, w.hud.saved || 0);
    for (var i = 0; i < n; i++) g.drawImage(pow, 14 + i * (pow.width + 1), H - 3 - pow.height);
    putRight(g, hudText('CREDITS 0' + (demo ? 0 : 1), SILVER), W - 8, H - 11, 1);
  }

  // ------------------------------------------------------------------ title screen
  function drawTitleScreen(g, director, world, game, t, reduced) {
    var title = (director.story.title || 'METAL SLIDE').toUpperCase().split(' ');
    var top = title.length > 1 ? title.slice(0, -1).join(' ') : '';
    var main = title[title.length - 1];
    var bob = reduced ? 0 : Math.round(Math.sin(t * 2) * 1.5);
    if (top) centered(g, F.big(top, { scale: 4, stops: SILVER, outline: 2, bold: true }), W / 2 - 46, 24 + bob);
    centered(g, F.big(main, { scale: 6, stops: RED, outline: 2, bold: true }), W / 2 + 14, 56 + bob);
    var sub = (director.story.subtitle || '').toUpperCase();
    if (sub) {
      var sw = F.measure(sub) + 12;
      rect(g, W / 2 - sw / 2, 122, sw, 13, 'rgba(10,8,20,0.7)');
      F.drawCentered(g, sub, W / 2, 125, '#ffe9a8');
    }
    var credits = world.state.credits ? 1 : 0;
    var prompt = credits ? 'PRESS START' : 'INSERT COIN';
    putRight(g, hudText('CREDITS 0' + credits, SILVER), W - 8, H - 11, 1);
    if (director.autoplay) {
      // Attract mode: the prompt and DEMO PLAY take turns in the same slot.
      if (reduced || !blink(t, 1, false)) centered(g, F.big('DEMO PLAY', { scale: 2, stops: GOLD, bold: true, outline: 2 }), W / 2, 145);
      else centered(g, F.big(prompt, { scale: 2, stops: SILVER, italic: false, bold: true }), W / 2, 146);
      var msg = game.touch || game.lastDevice === 'touch' ? 'TAP TO PLAY' : 'PRESS ANY KEY';
      say(g, msg, Math.round(W / 2 - F.measure(msg) / 2), 174, '#ffffff');
      return;
    }
    if (blink(t, 1, reduced)) centered(g, F.big(prompt, { scale: 2, stops: credits ? GOLD : SILVER, italic: false, bold: true }), W / 2, 146);
    var dev = game.lastDevice === 'pad' ? 'pad' : (game.touch || game.lastDevice === 'touch') ? 'touch' : 'key';
    var start = dev === 'touch' ? [['txt', 'TAP TO START']] : dev === 'pad' ? [['txt', 'PRESS'], ['btn', 'A']] : [['txt', 'CLICK OR PRESS'], ['cap', '→']];
    strip(g, start, W / 2 - stripW(start) / 2, 172, '#c8d0ff');
    // A small controls legend, bottom left.
    var legend = dev === 'key' ? (letters() ? MOVE_HINT.key.concat([['gap'], ['cap', 'M'], ['txt', 'SOUND'], ['gap'], ['cap', 'F'], ['txt', 'FULLSCREEN']]) : MOVE_HINT.plain) :
      dev === 'pad' ? MOVE_HINT.pad : null;
    if (legend) strip(g, legend, 8, H - 14, '#c8d0ff');
  }

  function drawNotes(g, world, director) {
    var y = 30;
    world.fx.notes.forEach(function (n) {
      var lines = F.wrap('NOTE: ' + n.text, 200);
      rect(g, W - 214, y, 208, lines.length * 10 + 6, '#ffe873');
      lines.forEach(function (l, i) { F.draw(g, l, W - 210, y + 3 + i * 10, '#3a2a10'); });
      y += lines.length * 10 + 9;
    });
  }

  function drawDebug(g, director) {
    var c = director.current();
    var info = 'M' + c.mission.num + ' STEP ' + (c.si + 1) + '/' + c.mission.steps.length + '  LINE ' + (c.step.line || '-');
    rect(g, 0, H - 11, F.measure(info) + 8, 11, 'rgba(0,0,0,0.75)');
    F.draw(g, info, 4, H - 10, '#7fff9a');
  }

  // ------------------------------------------------------------------ play segments and demo
  // Metal Slug's GO arrow, blinking once the player has stood still for 3 seconds.
  function drawGo(g, dir) {
    var img = null;
    if (MS.props && typeof MS.props.goArrow === 'function') {
      try { img = MS.props.goArrow(dir); } catch (e) { img = null; } // drawn facing dir, letters readable
    }
    if (!img) img = F.big(dir > 0 ? 'GO →' : '← GO', { scale: 2, stops: GOLD, bold: true });
    g.drawImage(img, dir > 0 ? W - img.width - 8 : 8, 64);
  }

  function drawPlayHints(g, w, director, game, t, reduced) {
    var p = w.play;
    if (director.autoplay || p.auto) return;
    if (p.idleT < p.t - 0.05) game.moved = true;
    // The first segment teaches the controls for the device in hand, until the player
    // moves. Touch: Sam runs by himself, so the gestures show for the first few seconds of
    // the first section played.
    var dev = device(game);
    if (dev === 'touch') {
      if (!game.touchTaught && p.t < 5) strip(g, MOVE_HINT.touch, W / 2 - stripW(MOVE_HINT.touch) / 2, H - 24);
      else if (p.t >= 5) game.touchTaught = true;
      if (p.stuckT > 1 && blink(t, 1.5, reduced)) {
        // Blocked by a gate (the robot: shoot its weak points) or by something to jump.
        var sam = w.actors.SAM, gates = (w.set.level && w.set.level.gates) || [];
        var gated = MS.player && gates.some(function (gt) {
          var face = (p.dir || 1) > 0 ? gt.x : gt.x + gt.w;
          return !MS.player.gateOpen(w, gt) && Math.abs(face - sam.x) < 40;
        });
        centered(g, F.big(gated ? 'TAP TO FIRE!' : 'SWIPE UP!', { scale: 2, stops: GOLD, bold: true }), W / 2, 64);
      }
      return;
    }
    var hint = dev === 'key' && !letters() ? MOVE_HINT.plain : MOVE_HINT[dev];
    if (!game.moved && hint) strip(g, hint, W / 2 - stripW(hint) / 2, H - 24);
    if (p.idleT > 3 && blink(t, 2, reduced)) drawGo(g, p.dir || 1);
  }

  function drawDemo(g, game, t, reduced, y) {
    if (blink(t, 1, reduced)) centered(g, F.big('DEMO PLAY', { scale: 2, stops: GOLD, bold: true, outline: 2 }), W / 2, y - 1);
    var msg = game.touch || game.lastDevice === 'touch' ? 'TAP TO PLAY' : 'PRESS ANY KEY';
    say(g, msg, Math.round(W / 2 - F.measure(msg) / 2), y + 23, '#ffffff');
  }

  // "Click to continue", for the first few lines only (main.js clears game.showHint).
  function drawNextHint(g, game) {
    var dev = device(game);
    var parts = dev === 'touch' ? [['txt', 'TAP TO CONTINUE']] : dev === 'pad' ? [['btn', 'A'], ['txt', 'NEXT']] : [['txt', 'CLICK OR PRESS'], ['cap', '→']];
    strip(g, parts, BOX.x + BOX.w - 4 - stripW(parts), BOX.y - 14);
  }

  // ------------------------------------------------------------------ entry point
  function draw(g, director, game) {
    var w = director.world;
    if (!w) return;
    var t = game.time;
    var camX = Math.round(w.camera.view != null ? w.camera.view : w.camera.x); // the drawn camera
    var ui = w.ui;
    var M = director.current().mission;
    var reduced = director.reduced;
    var demo = !!director.autoplay;
    var hud = false;
    tickClocks(director, w, t);

    if (M.isTitle) {
      drawTitleScreen(g, director, w, game, t, reduced);
    } else {
      var bare = !ui.title && !w.tally && !w.ending;
      drawEmotes(g, w, camX);
      if (bare) drawSpeakerMark(g, w, camX, t);
      drawBubbles(g, w, camX);
      if (bare && w.hud.on) { drawHud(g, director, w, M, t, reduced); hud = true; }
      drawCallout(g, w, reduced, demo && hud);
      if (ui.click && ui.click.target && ui.click.target.kind === 'actor') {
        var a = w.actors[ui.click.target.id];
        if (a && a.visible) {
          var hand = MS.props.hand();
          g.drawImage(hand, Math.round(a.x - camX - 4), headY(w, a) - 16 - (Math.floor(t * 3) % 2) * 2);
          F.drawCentered(g, device(game) === 'touch' ? 'TAP!' : 'CLICK!', Math.round(a.x - camX), headY(w, a) - 26, '#ffffff', { shadow: '#140c12' });
        }
      }
      if (w.tally && !w.ending) drawTally(g, director, w, M, ui, t, reduced);
      if (ui.banner) drawBanner(g, w, ui.banner);
      if (ui.line) drawLine(g, w, ui.line, t, reduced);
      if (ui.title) drawTitleCard(g, ui.title, reduced);
      if (w.ending) drawEnding(g, w, t, reduced, demo, !!(M && M.links && M.links.length), ui.endingT);
      if (w.mode === 'play' && w.play) drawPlayHints(g, w, director, game, t, reduced);
    }
    if (demo && !M.isTitle) drawDemo(g, game, t, reduced, (w.tally || w.ending) ? H - 40 : hud ? 32 : 8);
    if (game.debug) { drawNotes(g, w, director); drawDebug(g, director); }
    if (game.showHint && !demo && director.phase === 'wait' && !M.isTitle && ui.line && ui.line.shown >= ui.line.total) drawNextHint(g, game);
    if (director.fade > 0) { g.fillStyle = 'rgba(0,0,0,' + Math.min(1, director.fade) + ')'; g.fillRect(0, 0, W, H); }
  }

  MS.ui = {
    draw: draw, BOX: BOX, STYLES: STYLES, styleName: styleName, headY: headY, paletteEra: paletteEra,
    score: scoreOf, GOLD: GOLD, SILVER: SILVER, RED: RED, CYAN: CYAN, CHROME: CHROME
  };
})(typeof window !== 'undefined' ? window : globalThis);
