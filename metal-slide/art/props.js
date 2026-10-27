/* METAL SLIDE art: small shared props. Emote icons, the supply crate and parachute,
   power-up items (the spec blaster among them), tumbling slides, multiplayer cursors,
   and the Metal Slug HUD bits: the GO! arrow and the POW icon. All drawn from pixel templates. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Stamp a template into a new canvas, with a 1px dark outline around it.
  function sprite(rows, pal, ink) {
    var w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var c = canvas(w + 2, rows.length + 2);
    var g = c.getContext('2d');
    var filled = {};
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = col; g.fillRect(x + 1, y + 1, 1, 1);
        filled[(x + 1) + ',' + (y + 1)] = 1;
      }
    });
    if (ink !== null) {
      g.fillStyle = ink || '#160c12';
      for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
        if (filled[x + ',' + y]) continue;
        if (filled[(x - 1) + ',' + y] || filled[(x + 1) + ',' + y] || filled[x + ',' + (y - 1)] || filled[x + ',' + (y + 1)]) g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  var cache = {};
  function cached(key, make) { return cache[key] || (cache[key] = make()); }

  // Metal Slug gold: the same metallic ramp the big arcade lettering uses.
  var GOLD = ['#fffbe0', '#ffe066', '#ffb020', '#d0601a', '#ffcf5a'];

  var EMOTES = {
    sweat: { rows: ['.b..', '.bb.', 'bbbb', 'bWbb', 'bbbb', '.bb.'], pal: { b: '#6ac8ff', W: '#ffffff' } },
    anger: { rows: ['.r...r.', 'rr...rr', '.......', '.......', 'rr...rr', '.r...r.'], pal: { r: '#ff3a3a' }, ink: '#5a0a10' },
    heart: { rows: ['.rr.rr.', 'rWrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], pal: { r: '#ff4a72', W: '#ffd0dc' } },
    sparkle: { rows: ['...y...', '...y...', '..yyy..', 'yyyWyyy', '..yyy..', '...y...', '...y...'], pal: { y: '#ffe25a', W: '#ffffff' } },
    music: { rows: ['...mmm', '...m.m', '...m.m', '...m..', '.mmm..', 'mmmm..', '.mm...'], pal: { m: '#b07aff' } },
    idea: { rows: ['.yyy.', 'yyyyy', 'yyWyy', 'yyyyy', '.yyy.', '.ggg.', '..g..'], pal: { y: '#ffe25a', W: '#ffffff', g: '#a0a4ac' } }
  };

  function emote(kind) {
    return cached('emote:' + kind, function () {
      var e = EMOTES[kind];
      if (e) return sprite(e.rows, e.pal, e.ink);
      var text = kind === 'zzz' ? 'z Z' : kind;
      return MS.font.big(text, { scale: 1, outline: 1, italic: false, stops: ['#fff6c0', '#ffd23a', '#ff9a2a'], shadowColor: null });
    });
  }

  // A Metal Slug item letter: gold, outlined in red, on a dark tile. Drawn into g at (x, y);
  // returns the tile width. The tile is the glyph width + 4 wide and 11 tall.
  function letterTile(g, letter, x, y) {
    var gl = MS.font.glyph(letter);
    var tw = gl.w + 4;
    g.fillStyle = '#0b0810'; g.fillRect(x, y, tw, 11);
    g.fillStyle = '#2a1c26'; g.fillRect(x + 1, y + 1, tw - 2, 9);
    g.fillStyle = '#3a2a32'; g.fillRect(x + 1, y + 1, tw - 2, 1);
    var ramp = ['#fff6c0', '#ffe066', '#ffd23a', '#ffb840', '#ffb840', '#ff9a2a', '#e8761e'];
    var lx = x + 2, ly = y + 2;
    g.fillStyle = '#d9342a';
    gl.rows.forEach(function (row, ry) {
      for (var rx = 0; rx < row.length; rx++) {
        if (row[rx] !== '#') continue;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = rx + dx, ny = ry + dy;
          var on = ny >= 0 && ny < gl.rows.length && gl.rows[ny][nx] === '#';
          if (!on) g.fillRect(lx + nx, ly + ny, 1, 1);
        }
      }
    });
    gl.rows.forEach(function (row, ry) {
      g.fillStyle = ramp[Math.min(ramp.length - 1, ry)];
      for (var rx = 0; rx < row.length; rx++) if (row[rx] === '#') g.fillRect(lx + rx, ly + ry, 1, 1);
    });
    return tw;
  }

  // Supply crate, Metal Slug style: a wooden box with a gold letter on a dark tile.
  // Rows 0-3 are the lid (render lifts them off when the crate opens).
  function crate(letter) {
    return cached('crate:' + letter, function () {
      var W = 20, H = 18;
      var c = canvas(W, H);
      var g = c.getContext('2d');
      function r(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
      r(0, 0, W, H, '#1a0f0c');
      // lid
      r(1, 1, W - 2, 3, '#c88a3c'); r(1, 1, W - 2, 1, '#ecc070'); r(1, 3, W - 2, 1, '#8a5420');
      r(4, 2, 1, 1, '#8a5420'); r(15, 2, 1, 1, '#8a5420');
      r(1, 4, W - 2, 1, '#3a200e');
      // body: planks, corner posts, a bottom band
      r(1, 5, W - 2, 12, '#a0642a');
      for (var x = 2; x < W - 2; x += 4) r(x + 2, 5, 1, 12, '#7a4418');
      r(1, 5, 3, 12, '#c88a3c'); r(16, 5, 3, 12, '#c88a3c');
      r(1, 5, 1, 12, '#ecc070'); r(3, 5, 1, 12, '#8a5420'); r(18, 5, 1, 12, '#8a5420');
      r(1, 5, W - 2, 1, '#ecc070');
      r(1, 15, W - 2, 2, '#7a4418'); r(1, 16, W - 2, 1, '#5a3010');
      // rivets
      r(2, 7, 1, 1, '#fff2c8'); r(17, 7, 1, 1, '#fff2c8'); r(2, 13, 1, 1, '#fff2c8'); r(17, 13, 1, 1, '#fff2c8');
      var tw = MS.font.glyph(letter).w + 4;
      letterTile(g, letter, Math.floor((W - tw) / 2), 5);
      return c;
    });
  }

  // Parachute: a red and cream canopy with scalloped gores and shading, lines that meet
  // the crate's top corners. Drawn at (crateX - 4, crateY - height + 6) by render.
  function chute() {
    return cached('chute', function () {
      var W = 28, H = 20, CH = 9, cx = W / 2;
      var c = canvas(W, H);
      var g = c.getContext('2d');
      var RAMP = { W: ['#fff6e0', '#f2dcb0', '#c8a47c'], R: ['#f07040', '#d9542a', '#8e2f24'] };
      var on = {};
      function inside(x, y) {
        var u = (x + 0.5 - cx) / (W / 2 - 0.5), v = (CH - 0.5 - y) / (CH - 0.5);
        if (u * u + v * v > 1) return false;
        // scalloped hem: each gore's bottom edge curves up between the line points
        var gore = (Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 5;
        var f = gore - Math.floor(gore);
        return y < CH - Math.round(Math.sin(f * Math.PI));
      }
      for (var y = 0; y < CH; y++) for (var x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        on[x + ',' + y] = 1;
        var u = (x + 0.5 - cx) / (W / 2), v = (CH - 0.5 - y) / CH;
        var gi = Math.floor((Math.asin(Math.max(-1, Math.min(1, u))) / Math.PI + 0.5) * 5);
        var ramp = gi % 2 ? RAMP.W : RAMP.R;
        var s = v * 0.9 - u * 0.45;
        var tone = s > 0.55 ? 0 : s > 0.05 ? 1 : 2;
        g.fillStyle = ramp[tone]; g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = '#2a1a20';
      for (var yy = 0; yy < CH + 1; yy++) for (var xx = 0; xx < W; xx++) {
        if (on[xx + ',' + yy]) continue;
        if (on[(xx - 1) + ',' + yy] || on[(xx + 1) + ',' + yy] || on[xx + ',' + (yy - 1)] || on[xx + ',' + (yy + 1)]) g.fillRect(xx, yy, 1, 1);
      }
      // suspension lines from the hem to the crate's top corners
      g.fillStyle = '#d6c4a0';
      [[2, 4], [10, 4], [17, 23], [25, 23]].forEach(function (l) {
        var y0 = CH - 1, n = H - 1 - y0;
        for (var k = 0; k <= n; k++) g.fillRect(Math.round(l[0] + (l[1] - l[0]) * k / n), y0 + k, 1, 1);
      });
      return c;
    });
  }

  // The power-ups. Generic icons, no real product logos.
  function item(letter) {
    return cached('item:' + letter, function () {
      var t;
      if (letter === 'S') {
        // The spec blaster: a chunky toy blaster with a ruler for a barrel and a cyan spec cell.
        t = { rows: [
          '..ll............',
          '.lLLLLLLL....k..',
          '.BccWcBBYkYkYkYCC',
          '.BcWccBBYYYYYYYCw',
          '.BBBBBBByyyyyyyCC',
          '.SSSSSSSS.......',
          '..GgG.t.........',
          '..GgG.tt........',
          '.GgG............',
          '.GGG............'],
        pal: { l: '#8a96ac', L: '#5a6478', B: '#3a4152', S: '#262a38', c: '#2ab0d0', W: '#ffffff', Y: '#ffd84a', y: '#d08a1e',
          k: '#5a3a10', C: '#7ff4ff', w: '#ffffff', G: '#2a2e3a', g: '#4a5266', t: '#3a4152' } };
      } else if (letter === 'F') {
        // A design canvas: a tablet with a vector curve and handles.
        t = { rows: ['kkkkkkkkkkkk', 'kSSSSSSSSSSk', 'kSSSSSSSySSk', 'kSSSSSyySSSk', 'kSnSyySSSSSk', 'kSSySSSSSSSk',
          'kSySSSSSSnSk', 'kSySSSSSSSSk', 'kSSyyyySSSSk', 'kkkkkkkkkkkk'], pal: { k: '#1e1a2a', S: '#f4f0ff', y: '#b04aff', n: '#2a8aff' } };
      } else if (letter === 'D') {
        // Stacked building blocks: components.
        t = { rows: ['....rrrr....', '....rRRr....', '....rrrr....', '..bbbbyyyy..', '..bBBbyYYy..', '..bbbbyyyy..',
          'ggggbbbbrrrr', 'gGGgbBBbrRRr', 'ggggbbbbrrrr'], pal: { r: '#ef4444', R: '#ff9a9a', b: '#3a7af0', B: '#9ac0ff', y: '#f5c32a', Y: '#fff0a0', g: '#22c27a', G: '#9ff0c8' } };
      } else if (letter === 'A') {
        // A spark of light.
        t = { rows: ['.....c.....', '.....c.....', '....cWc....', '...cWWWc...', 'cccWWWWWccc', '...cWWWc...', '....cWc....',
          '.....c.....', '.....c.....'], pal: { c: '#5fe8ff', W: '#ffffff' } };
      }
      if (t) return sprite(t.rows, t.pal, '#120c1a');
      // Anything else: the Metal Slug letter tile.
      var tw = MS.font.glyph(letter).w + 4;
      var c = canvas(tw, 11);
      letterTile(c.getContext('2d'), letter, 0, 0);
      return c;
    });
  }

  // A PowerPoint-style slide, tumbling: frame 0 face-on, 1 turning, 2 edge-on.
  function slide(f) {
    return cached('slide:' + f, function () {
      var w = [7, 4, 1][f];
      var c = canvas(w + 2, 7);
      var g = c.getContext('2d');
      g.fillStyle = '#20141a'; g.fillRect(0, 0, w + 2, 7);
      g.fillStyle = '#f8f0dc'; g.fillRect(1, 1, w, 5);
      g.fillStyle = '#d9542a'; g.fillRect(1, 1, w, 1);
      if (w > 3) { g.fillStyle = '#9a8e80'; g.fillRect(2, 3, w - 2, 1); g.fillRect(2, 5, w - 3, 1); }
      return c;
    });
  }

  // Multiplayer cursor with a name tag, like a shared design file.
  function cursor(color, name) {
    return cached('cursor:' + color + name, function () {
      var arrow = sprite(['c.....', 'cc....', 'ccc...', 'cccc..', 'ccccc.', 'cccccc', 'ccc...', 'c.cc..', '...c..'], { c: color }, '#ffffff');
      var tw = MS.font.measure(name) + 4;
      var c = canvas(Math.max(arrow.width, 5 + tw), arrow.height + 9);
      var g = c.getContext('2d');
      g.drawImage(arrow, 0, 0);
      g.fillStyle = color; g.fillRect(5, arrow.height - 1, tw, 10);
      MS.font.draw(g, name, 7, arrow.height, '#ffffff');
      return c;
    });
  }

  function hand() {
    return cached('hand', function () {
      return sprite(['..ww....', '..ww....', '..wwwww.', 'wwwwwwww', 'wwwwwwww', '.wwwwwww', '..wwwww.', '..wwwww.'], { w: '#ffffff' });
    });
  }

  // A pixel mask in the big arcade lettering style: scaled, gold, outlined, drop-shadowed.
  // Matches MS.font.big so a shape sits beside its letters (upright, no slant).
  function bigShape(rows, scale) {
    var mw = 0;
    rows.forEach(function (r) { mw = Math.max(mw, r.length); });
    var mask = canvas(mw, 9);
    var mg = mask.getContext('2d');
    mg.fillStyle = '#fff';
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] === '#') mg.fillRect(x, y, 1, 1);
    });
    var sw = mask.width * scale, sh = 9 * scale;
    function silhouette(color) {
      var c = canvas(sw, sh);
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (Array.isArray(color)) {
        for (var yy = 0; yy < sh; yy++) {
          g.fillStyle = color[Math.min(color.length - 1, Math.floor((yy / (7 * scale)) * color.length))];
          g.fillRect(0, yy, sw, 1);
        }
      } else { g.fillStyle = color; g.fillRect(0, 0, sw, sh); }
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0, sw, sh);
      return c;
    }
    var off = Math.max(1, Math.round(scale / 2));
    var out = canvas(sw + 2 + off, sh + 2 + off);
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    var shadow = silhouette('#0b0508'), line = silhouette('#1b0e12');
    var dx, dy;
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) o.drawImage(shadow, 1 + dx + off, 1 + dy + off);
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) if (dx || dy) o.drawImage(line, 1 + dx, 1 + dy);
    o.drawImage(silhouette(GOLD), 1, 1);
    return out;
  }

  // Metal Slug's GO sign: big gold slanted letters and a chunky arrow, about 52x21.
  // goArrow(-1) or goArrow('left') points left with the letters still readable (don't mirror
  // the canvas); goArrow('arrow') gives the arrow alone. The UI blinks it at 1 Hz.
  function goArrow(opt) {
    var left = opt === -1 || opt === 'left';
    return cached('go:' + (left ? 'left' : opt || ''), function () {
      var rows = ['....##...', '....###..', '########.', '#########', '########.', '....###..', '....##...'];
      if (left) rows = rows.map(function (r) { return r.split('').reverse().join(''); });
      var arrow = bigShape(rows, 2);
      if (opt === 'arrow') return arrow;
      var text = MS.font.big('GO', { scale: 2, outline: 1, stops: GOLD });
      var c = canvas(text.width + arrow.width - 3, Math.max(text.height, arrow.height));
      var g = c.getContext('2d');
      if (left) { g.drawImage(arrow, 0, 0); g.drawImage(text, arrow.width - 3, 0); }
      else { g.drawImage(arrow, text.width - 3, 0); g.drawImage(text, 0, 0); }
      return c;
    });
  }

  // A freed prisoner for the HUD: a tiny gold figure, 5x8 plus its outline. The outline
  // fills the empty row under the head, so the head reads apart from the shoulders.
  function powIcon() {
    return cached('pow', function () {
      return sprite(['.Hhh.', '.HHh.', '.HHh.', '.....', 'BBBBb', '.BBb.', '.B.b.', '.B.b.'],
        { H: '#fff2b0', h: '#ffd23a', B: '#ffb020', b: '#d0601a' }, '#1b0e12');
    });
  }

  MS.props = {
    emote: emote, crate: crate, chute: chute, item: item, slide: slide, cursor: cursor, hand: hand, sprite: sprite,
    goArrow: goArrow, powIcon: powIcon, letterTile: letterTile
  };
})(typeof window !== 'undefined' ? window : globalThis);
