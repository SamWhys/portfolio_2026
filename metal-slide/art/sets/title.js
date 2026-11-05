/* METAL SLIDE set: the title screen (and a blank stage for missions without a set). */
(function (root) {
  'use strict';
  var MS = root.MS;
  var P = MS.paint;
  var W = MS.W, H = MS.H;

  function skyline(g, rnd, w, base, col, minH, maxH, gap) {
    var x = 0;
    while (x < w) {
      var bw = 10 + rnd() * 22, bh = minH + rnd() * (maxH - minH);
      P.rect(g, x, base - bh, bw, bh + 40, col);
      if (rnd() > 0.6) P.rect(g, x + bw / 2 - 1, base - bh - 6 - rnd() * 8, 2, 10, col);
      x += bw + rnd() * gap;
    }
  }

  MS.sets = MS.sets || {};
  MS.sets.title = {
    name: 'title', era: 'title', width: W, ground: 168, camera: 0, bg: '#0a0614', hud: false, music: null,
    cast: {},
    layers: [{ speed: 0, paint: function (g, w, h) {
      var rnd = MS.util.rng(4);
      P.vgrad(g, 0, 0, w, h, [[0, '#0a0614'], [0.35, '#2a0e3a'], [0.62, '#8a1e3a'], [0.78, '#e2502a'], [0.9, '#ffb040'], [1, '#ffd890']]);
      for (var s = 0; s < 70; s++) P.rect(g, rnd() * w, rnd() * 70, 1, 1, rnd() > 0.7 ? '#ffffff' : '#9a8ac8');
      P.radial(g, w / 2, 168, 90, 'rgba(255,220,140,0.55)');
      var r = 34, cy = 172;
      for (var y = -r; y <= 0; y++) {
        var ww = Math.round(Math.sqrt(r * r - y * y) * 2);
        var band = y + r;
        var gap = band > 14 && (band % 5) >= 5 - Math.min(3, Math.floor((band - 14) / 5) + 1);
        if (!gap) P.rect(g, w / 2 - ww / 2, cy + y, ww, 1, y < -24 ? '#fff4b8' : y < -14 ? '#ffd86a' : '#ffa848');
      }
      skyline(g, rnd, w, 176, '#3a1030', 14, 46, 4);
      skyline(g, rnd, w, 186, '#1c0820', 8, 30, 10);
      P.rect(g, 0, 186, w, h - 186, '#0a0410');
    } }],
    drawBack: function (g, w, camX, t) {
      // the hero on the ridge, as a silhouette
      var f = MS.rig.frame('sam', MS.costumes.sam, 'idle', 0, {});
      if (!this._sil) {
        var c = document.createElement('canvas');
        c.width = f.canvas.width; c.height = f.canvas.height;
        var cg = c.getContext('2d');
        cg.drawImage(f.canvas, 0, 0);
        cg.globalCompositeOperation = 'source-in';
        cg.fillStyle = '#0a0410';
        cg.fillRect(0, 0, c.width, c.height);
        this._sil = c;
      }
      g.drawImage(this._sil, W - 70 - f.ox, 186 - f.oy);
    }
  };

  MS.sets['void'] = {
    name: 'void', era: 'modern', width: W, ground: 156, camera: 0, bg: '#14162a', cast: {
      SAM: { names: ['SAM'], costume: 'sam', x: -40, visible: false }
    },
    layers: [{ speed: 0, paint: function (g, w, h) {
      P.vgrad(g, 0, 0, w, h, [[0, '#14162a'], [0.7, '#2a2e52'], [1, '#14162a']]);
      P.rect(g, 0, 156, w, 1, '#4a5080');
    } }]
  };
})(typeof window !== 'undefined' ? window : globalThis);
