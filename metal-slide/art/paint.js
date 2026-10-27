/* METAL SLIDE art: painting helpers for set backgrounds.
   Sets paint their layers once, in full color; the cave and kingdom eras then snap
   each layer to their palette with world-locked dithering. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var C = MS.color;

  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  // Vertical gradient. stops: [[0, '#hex'], [0.5, '#hex'], [1, '#hex']]
  function vgrad(g, x, y, w, h, stops) {
    var gr = g.createLinearGradient(0, y, 0, y + h);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }

  function radial(g, cx, cy, r, inner, outer) {
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer || 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // A ragged horizon: fills everything below a random-walk line.
  function ridge(g, rnd, x0, x1, base, amp, step, col, opts) {
    opts = opts || {};
    g.fillStyle = col;
    var y = base;
    for (var x = x0; x < x1; x += step) {
      y += (rnd() - 0.5) * amp;
      y = Math.max(base - amp * 2, Math.min(base + amp * 2, y));
      var top = Math.round(y);
      if (opts.ceiling) g.fillRect(x, 0, step, top);
      else g.fillRect(x, top, step, (opts.bottom || g.canvas.height) - top);
    }
  }

  // Pointy formations hanging down (stalactites) or standing up (stalagmites).
  function spike(g, x, y, w, h, col, down, lit) {
    for (var i = 0; i < h; i++) {
      var k = down ? 1 - i / h : i / h;
      var ww = Math.max(1, Math.round(w * k));
      var yy = down ? y + i : y + h - 1 - i;
      rect(g, x + (w - ww) / 2, yy, ww, 1, col);
      if (lit && ww > 2) rect(g, x + (w - ww) / 2, yy, 1, 1, lit);
    }
  }

  // Text in the bitmap font, for signs painted into the world.
  function sign(g, text, x, y, col) { MS.font.draw(g, text, x, y, col); }

  function bricks(g, rnd, x, y, w, h, bw, bh, base, line, vary) {
    rect(g, x, y, w, h, line);
    for (var r = 0; r * bh < h; r++) {
      var off = r % 2 ? bw / 2 : 0;
      for (var c = -1; c * bw < w + bw; c++) {
        var bx = x + c * bw + off, by = y + r * bh;
        var col = vary ? C.shade(base, (rnd() - 0.5) * vary) : base;
        g.fillStyle = col;
        g.fillRect(Math.round(bx + 1), Math.round(by + 1), bw - 1, bh - 1);
      }
    }
  }

  MS.paint = { rect: rect, vgrad: vgrad, radial: radial, ridge: ridge, spike: spike, sign: sign, bricks: bricks };
})(typeof window !== 'undefined' ? window : globalThis);
