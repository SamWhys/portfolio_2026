/* METAL SLIDE engine: core helpers.
   Classic script. Everything hangs off the single global `MS`. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // World canvas size in game pixels.
  MS.W = 384;
  MS.H = 216;

  var util = MS.util = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: {
      inOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
      out: function (t) { return 1 - (1 - t) * (1 - t); },
      in: function (t) { return t * t; },
      outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
    },
    // Small, fast, seedable PRNG (mulberry32). Returns a function giving [0, 1).
    rng: function (seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash: function (str) {
      var h = 2166136261 >>> 0;
      str = String(str);
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h;
    },
    // "Dev 1", "DEV1", "dev-1" all become "DEV1". Used to match names.
    norm: function (name) { return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
    // Lowercase, letters and digits split apart, articles dropped. Used for matching directions.
    words: function (s) {
      return String(s || '').toLowerCase()
        .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
        .replace(/[.!?]+$/g, '')
        .replace(/\s+/g, ' ').trim();
    }
  };

  var color = MS.color = {
    rgb: function (hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    hex: function (rgb) {
      return '#' + rgb.map(function (v) {
        v = Math.round(util.clamp(v, 0, 255));
        return (v < 16 ? '0' : '') + v.toString(16);
      }).join('');
    },
    mix: function (a, b, t) {
      var x = color.rgb(a), y = color.rgb(b);
      return color.hex([util.lerp(x[0], y[0], t), util.lerp(x[1], y[1], t), util.lerp(x[2], y[2], t)]);
    },
    // amt < 0 darkens toward a cool shadow, amt > 0 lightens toward a warm highlight.
    shade: function (hex, amt) {
      return amt < 0 ? color.mix(hex, '#1a1020', -amt) : color.mix(hex, '#fff4dc', amt);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MS;
})(typeof window !== 'undefined' ? window : globalThis);
