/* METAL SLIDE engine: bitmap pixel font.
   5x7 capitals, x-height 5, 2-pixel descenders, proportional widths. Drawn from cached
   per-color atlases so text stays crisp at any scale. `*word*` highlights a word. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // Rows top to bottom, separated by "/". "#" is ink. Row 6 is the baseline row.
  var DEFS = [
    ['A', '.###./#...#/#...#/#####/#...#/#...#/#...#'], ['B', '####./#...#/#...#/####./#...#/#...#/####.'],
    ['C', '.###./#...#/#..../#..../#..../#...#/.###.'], ['D', '####./#...#/#...#/#...#/#...#/#...#/####.'],
    ['E', '#####/#..../#..../####./#..../#..../#####'], ['F', '#####/#..../#..../####./#..../#..../#....'],
    ['G', '.###./#...#/#..../#.###/#...#/#...#/.####'], ['H', '#...#/#...#/#...#/#####/#...#/#...#/#...#'],
    ['I', '###/.#./.#./.#./.#./.#./###'], ['J', '.###/...#/...#/...#/#..#/#..#/.##.'],
    ['K', '#...#/#..#./#.#../##.../#.#../#..#./#...#'], ['L', '#.../#.../#.../#.../#.../#.../####'],
    ['M', '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'], ['N', '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#'],
    ['O', '.###./#...#/#...#/#...#/#...#/#...#/.###.'], ['P', '####./#...#/#...#/####./#..../#..../#....'],
    ['Q', '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#'], ['R', '####./#...#/#...#/####./#.#../#..#./#...#'],
    ['S', '.###./#...#/#..../.###./....#/#...#/.###.'], ['T', '#####/..#../..#../..#../..#../..#../..#..'],
    ['U', '#...#/#...#/#...#/#...#/#...#/#...#/.###.'], ['V', '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..'],
    ['W', '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#'], ['X', '#...#/#...#/.#.#./..#../.#.#./#...#/#...#'],
    ['Y', '#...#/#...#/.#.#./..#../..#../..#../..#..'], ['Z', '#####/....#/...#./..#../.#.../#..../#####'],
    ['a', '//.###./....#/.####/#...#/.####'], ['b', '#..../#..../####./#...#/#...#/#...#/####.'],
    ['c', '//.###/#.../#.../#.../.###'], ['d', '....#/....#/.####/#...#/#...#/#...#/.####'],
    ['e', '//.###./#...#/#####/#..../.###.'], ['f', '..##/.#../####/.#../.#../.#../.#..'],
    ['g', '//.####/#...#/#...#/#...#/.####/....#/.###.'], ['h', '#..../#..../####./#...#/#...#/#...#/#...#'],
    ['i', '#//#/#/#/#/#'], ['j', '..#//..#/..#/..#/..#/..#/#.#/.#.'],
    ['k', '#.../#.../#..#/#.#./##../#.#./#..#'], ['l', '#./#./#./#./#./#./.#'],
    ['m', '//####./#.#.#/#.#.#/#.#.#/#.#.#'], ['n', '//####./#...#/#...#/#...#/#...#'],
    ['o', '//.###./#...#/#...#/#...#/.###.'], ['p', '//####./#...#/#...#/#...#/####./#..../#....'],
    ['q', '//.####/#...#/#...#/#...#/.####/....#/....#'], ['r', '//#.##/##../#.../#.../#...'],
    ['s', '//.####/#..../.###./....#/####.'], ['t', '.#../.#../####/.#../.#../.#../..##'],
    ['u', '//#...#/#...#/#...#/#...#/.####'], ['v', '//#...#/#...#/#...#/.#.#./..#..'],
    ['w', '//#...#/#...#/#.#.#/#.#.#/.#.#.'], ['x', '//#...#/.#.#./..#../.#.#./#...#'],
    ['y', '//#...#/#...#/#...#/#...#/.####/....#/.###.'], ['z', '//#####/...#./..#../.#.../#####'],
    ['0', '.###./#...#/#..##/#.#.#/##..#/#...#/.###.'], ['1', '.#./##./.#./.#./.#./.#./###'],
    ['2', '.###./#...#/....#/..##./.#.../#..../#####'], ['3', '.###./#...#/....#/..##./....#/#...#/.###.'],
    ['4', '...#./..##./.#.#./#..#./#####/...#./...#.'], ['5', '#####/#..../####./....#/....#/#...#/.###.'],
    ['6', '.###./#..../#..../####./#...#/#...#/.###.'], ['7', '#####/....#/...#./..#../.#.../.#.../.#...'],
    ['8', '.###./#...#/#...#/.###./#...#/#...#/.###.'], ['9', '.###./#...#/#...#/.####/....#/....#/.###.'],
    ['.', '//////#'], [',', '/////.#/.#/#.'], ['!', '#/#/#/#/#//#'], ['?', '.###./#...#/....#/...#./..#..//..#..'],
    ["'", '#/#'], ['"', '#.#/#.#'], [':', '///#///#'], [';', '///.#///.#/#.'], ['-', '////###'],
    ['_', '///////#####'], ['(', '..#/.#./#../#../#../.#./..#'], [')', '#../.#./..#/..#/..#/.#./#..'],
    ['/', '....#/....#/...#./..#../.#.../#..../#....'], ['&', '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#'],
    ['%', '##..#/##..#/...#./..#../.#.../#..##/#..##'], ['+', '/..#../..#../#####/..#../..#..'],
    ['=', '//####//####'], ['#', '/.#.#./#####/.#.#./#####/.#.#.'], ['$', '..#../.####/#.#../.###./..#.#/####./..#..'],
    ['<', '...#/..#./.#../#.../.#../..#./...#'], ['>', '#.../.#../..#./...#/..#./.#../#...'],
    ['[', '##/#./#./#./#./#./##'], [']', '##/.#/.#/.#/.#/.#/##'], ['@', '.###./#...#/#.###/#.#.#/#.###/#..../.###.'],
    ['|', '#/#/#/#/#/#/#'], ['^', '..#../.#.#./#...#'], ['→', '/..#../...#./#####/...#./..#..'],
    ['←', '/..#../.#.../#####/.#.../..#..'], ['♥', '/.#.#./#####/#####/.###./..#..'],
    ['▲', '//..#../.###./#####'], ['✓', '//....#/...#./#.#../.#...']
  ];
  var ALIAS = { '×': 'x', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-' };

  var ROWS = 9;      // 7 cap rows + 2 descender rows
  var LINE = 10;     // line advance
  var CELL = 6;      // atlas cell width (widest glyph is 5)
  var glyphs = {};
  var order = [];
  DEFS.forEach(function (d) {
    var rows = d[1].split('/');
    var w = 0;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    glyphs[d[0]] = { w: w, rows: rows, i: order.length };
    order.push(d[0]);
  });
  glyphs[' '] = { w: 2, rows: [], i: -1 };

  function glyph(ch) {
    if (glyphs[ch]) return glyphs[ch];
    if (ALIAS[ch] && glyphs[ALIAS[ch]]) return glyphs[ALIAS[ch]];
    return glyphs['?'];
  }

  function measure(text) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '*') continue;
      w += glyph(ch).w + 1;
    }
    return Math.max(0, w - 1);
  }

  // Word wrap. Highlight markers are kept balanced per line.
  function wrap(text, maxWidth) {
    var words = String(text).split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = '';
    words.forEach(function (word) {
      var test = cur ? cur + ' ' + word : word;
      if (measure(test) <= maxWidth) { cur = test; return; }
      if (cur) lines.push(cur);
      cur = '';
      while (measure(word) > maxWidth) {
        var cut = word.length - 1;
        while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut--;
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      cur = word;
    });
    if (cur) lines.push(cur);
    var open = false;
    return lines.map(function (line) {
      var l = (open ? '*' : '') + line;
      var stars = (l.match(/\*/g) || []).length;
      open = stars % 2 === 1;
      return open ? l + '*' : l;
    });
  }

  // Count of visible characters (ignores markup), for the typewriter.
  function visibleLength(text) { return String(text).replace(/\*/g, '').length; }

  var atlases = {};
  function atlas(color) {
    if (atlases[color]) return atlases[color];
    var c = document.createElement('canvas');
    c.width = order.length * CELL;
    c.height = ROWS;
    var g = c.getContext('2d');
    g.fillStyle = color;
    order.forEach(function (ch, idx) {
      var gl = glyphs[ch];
      for (var y = 0; y < gl.rows.length; y++) {
        var row = gl.rows[y];
        for (var x = 0; x < row.length; x++) if (row[x] === '#') g.fillRect(idx * CELL + x, y, 1, 1);
      }
    });
    atlases[color] = c;
    return c;
  }

  // Draws text with its top-left at (x, y). Returns the width drawn.
  // opts: { hl: highlight color, limit: visible chars to show, shadow: color }
  function draw(ctx, text, x, y, color, opts) {
    opts = opts || {};
    text = String(text);
    x = Math.round(x); y = Math.round(y);
    if (opts.shadow) draw(ctx, text, x + 1, y + 1, opts.shadow, { hl: opts.shadow, limit: opts.limit });
    var limit = opts.limit == null ? Infinity : opts.limit;
    var hl = false;
    var shown = 0;
    var cx = x;
    for (var i = 0; i < text.length && shown < limit; i++) {
      var ch = text[i];
      if (ch === '*') { hl = !hl; continue; }
      var gl = glyph(ch);
      if (gl.i >= 0) {
        ctx.drawImage(atlas(hl && opts.hl ? opts.hl : color), gl.i * CELL, 0, gl.w, ROWS, cx, y, gl.w, ROWS);
      }
      cx += gl.w + 1;
      shown++;
    }
    return cx - x - 1;
  }

  function drawCentered(ctx, text, cx, y, color, opts) {
    return draw(ctx, text, cx - Math.floor(measure(text) / 2), y, color, opts);
  }

  // Big arcade lettering: scaled, slanted, gradient filled, outlined, with a drop shadow.
  // opts: { scale, stops: [top..bottom colors], outline: px, outlineColor, shadowColor, italic }
  var bigCache = {};
  function big(text, opts) {
    opts = opts || {};
    var scale = opts.scale || 3;
    var stops = opts.stops || ['#fffbe0', '#ffe066', '#ffb020', '#d0601a', '#ffcf5a'];
    var ow = opts.outline == null ? 1 : opts.outline;
    var oc = opts.outlineColor || '#1b0e12';
    var sc = opts.shadowColor === undefined ? '#0b0508' : opts.shadowColor;
    var italic = opts.italic !== false;
    var bold = !!opts.bold;
    var key = [text, scale, stops.join(), ow, oc, sc, italic, bold].join('|');
    if (bigCache[key]) return bigCache[key];

    text = String(text);
    var gap = bold ? 2 : 1;
    var w1 = 1 + (bold ? 1 : 0);
    for (var n = 0; n < text.length; n++) w1 += glyph(text[n]).w + gap;
    var lean = italic ? 3 : 0;
    var mask = document.createElement('canvas');
    mask.width = w1 + lean; mask.height = ROWS;
    var mg = mask.getContext('2d');
    mg.fillStyle = '#fff';
    var cx = 0;
    for (var i = 0; i < text.length; i++) {
      var gl = glyph(text[i]);
      for (var y = 0; y < gl.rows.length; y++) {
        var shift = italic ? Math.floor((8 - y) / 3) : 0;
        var row = gl.rows[y];
        for (var x = 0; x < row.length; x++) if (row[x] === '#') mg.fillRect(cx + x + shift, y, bold ? 2 : 1, 1);
      }
      cx += gl.w + gap;
    }

    var sw = mask.width * scale, sh = ROWS * scale;
    // Paint the color first, then keep it only where the letters are.
    // (Filling row by row with 'source-in' would wipe the canvas outside each row.)
    function silhouette(color) {
      var c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (Array.isArray(color)) {
        var capH = 7 * scale;
        for (var yy = 0; yy < sh; yy++) {
          var idx = Math.min(color.length - 1, Math.floor((yy / capH) * color.length));
          g.fillStyle = color[idx];
          g.fillRect(0, yy, sw, 1);
        }
      } else {
        g.fillStyle = color;
        g.fillRect(0, 0, sw, sh);
      }
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0, sw, sh);
      return c;
    }

    var pad = ow;
    var shadowOff = sc ? Math.max(1, Math.round(scale / 2)) : 0;
    var out = document.createElement('canvas');
    out.width = sw + pad * 2 + shadowOff;
    out.height = sh + pad * 2 + shadowOff;
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    var outline = silhouette(oc);
    if (sc) {
      var sh2 = silhouette(sc);
      for (var dy = -ow; dy <= ow; dy++) for (var dx = -ow; dx <= ow; dx++) o.drawImage(sh2, pad + dx + shadowOff, pad + dy + shadowOff);
    }
    for (var ddy = -ow; ddy <= ow; ddy++) for (var ddx = -ow; ddx <= ow; ddx++) if (ddx || ddy) o.drawImage(outline, pad + ddx, pad + ddy);
    o.drawImage(silhouette(stops), pad, pad);
    bigCache[key] = out;
    return out;
  }

  MS.font = {
    LINE: LINE, ROWS: ROWS, CAP: 7,
    measure: measure, wrap: wrap, draw: draw, drawCentered: drawCentered, big: big,
    visibleLength: visibleLength, glyph: glyph
  };
})(typeof window !== 'undefined' ? window : globalThis);
