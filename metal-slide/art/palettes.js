/* METAL SLIDE art: era palettes.
   The graphics improve mission by mission. The cave runs on 16 colors with ordered
   dithering; the kingdom on 32; the city and the future use full color. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var C = MS.color;

  var PALETTES = {
    // Cave: grimy rock, torchlight, sickly CRT teal, PowerPoint orange.
    stone: ['#0b0810', '#1d1420', '#33242c', '#4e3a3a', '#75574a', '#a07a5c', '#d6a77c', '#f2dcb0',
      '#fff6e0', '#3a4630', '#66783e', '#8e2f24', '#d9542a', '#ffb840', '#2f6e70', '#7fd0c0'],
    // Kingdom: a classic 32-color pixel-art palette (DawnBringer 32).
    medieval: ['#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
      '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
      '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
      '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30']
  };

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var luts = {};
  var rgbs = {};

  function rgbList(name) {
    if (!rgbs[name]) rgbs[name] = PALETTES[name].map(C.rgb);
    return rgbs[name];
  }

  // Perceptual-ish distance (weights favor green, like the eye does).
  function nearest(r, g, b, list) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var dr = r - p[0], dg = g - p[1], db = b - p[2];
      var rm = (r + p[0]) / 2;
      var d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // 32x32x32 lookup table: 5 bits per channel -> palette index.
  function lut(name) {
    if (luts[name]) return luts[name];
    var list = rgbList(name);
    var t = new Uint8Array(32768);
    for (var r = 0; r < 32; r++) for (var g = 0; g < 32; g++) for (var b = 0; b < 32; b++) {
      t[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4, list);
    }
    luts[name] = t;
    return t;
  }

  // Snap a canvas to an era palette. dither: 0 = none, 1 = full ordered dithering.
  // ox/oy shift the dither pattern so it stays locked to the world as layers scroll.
  // Alpha is made binary so pixel edges stay crisp.
  function quantize(canvas, name, dither, ox, oy) {
    if (!PALETTES[name]) return canvas;
    var g = canvas.getContext('2d', { willReadFrequently: true });
    var img;
    try { img = g.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { return canvas; }
    var d = img.data, w = canvas.width;
    var list = rgbList(name), t = lut(name);
    var amt = (dither || 0) * 36;
    ox = ox || 0; oy = oy || 0;
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      var x = p % w, y = (p / w) | 0;
      var bias = amt ? (BAYER[((y + oy) & 3) * 4 + ((x + ox) & 3)] / 16 - 0.47) * amt : 0;
      var r = Math.max(0, Math.min(255, d[i] + bias)) >> 3;
      var gg = Math.max(0, Math.min(255, d[i + 1] + bias)) >> 3;
      var b = Math.max(0, Math.min(255, d[i + 2] + bias)) >> 3;
      var c = list[t[(r << 10) | (gg << 5) | b]];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    g.putImageData(img, 0, 0);
    return canvas;
  }

  // Nearest palette color for a single hex value (used for UI and effects).
  function snap(hex, name) {
    if (!PALETTES[name]) return hex;
    var c = C.rgb(hex);
    return PALETTES[name][nearest(c[0], c[1], c[2], rgbList(name))];
  }

  MS.palettes = PALETTES;
  MS.palette = { quantize: quantize, snap: snap, BAYER: BAYER };
})(typeof window !== 'undefined' ? window : globalThis);
