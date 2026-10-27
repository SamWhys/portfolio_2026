/* METAL SLIDE engine: draws the world each frame.
   Parallax layers (baked once per set), set props and actors sorted by depth,
   projectiles, particles, the supply crate, foreground layers, then the UI.
   Future-era bloom is drawn on a second, full-resolution canvas. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var W = MS.W, H = MS.H;

  function bake(set) {
    if (set._baked) return set._baked;
    set._baked = (set.layers || []).map(function (L) {
      var lw = Math.ceil(W + (set.width - W) * L.speed) + 2;
      var c = document.createElement('canvas');
      c.width = lw; c.height = H;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      L.paint(g, lw, H, set);
      if (set.haze && !L.front && L.speed < 1 && L.haze !== false) haze(c, set.haze, L.haze != null ? L.haze : (1 - L.speed) * 0.75);
      if (MS.palettes[set.era]) MS.palette.quantize(c, set.era, L.dither == null ? (set.era === 'stone' ? 1 : 0.45) : L.dither, 0, 0);
      return { canvas: c, speed: L.speed, front: !!L.front, after: L.after };
    });
    return set._baked;
  }

  // Push a background layer toward the haze color and lift its darks, so the sprites
  // (which keep the near-black outlines and full saturation) pop, as in Metal Slug.
  function haze(c, hex, k) {
    var g = c.getContext('2d');
    var img;
    try { img = g.getImageData(0, 0, c.width, c.height); } catch (e) { return; }
    var d = img.data, h = MS.color.rgb(hex);
    var floor = 70 * k;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      for (var j = 0; j < 3; j++) d[i + j] = Math.max(floor, d[i + j] + (h[j] - d[i + j]) * k);
    }
    g.putImageData(img, 0, 0);
  }

  function drawLayers(g, set, camX, front, w, t) {
    bake(set).forEach(function (L) {
      if (L.front !== front) return;
      g.drawImage(L.canvas, -Math.round(camX * L.speed), 0);
      if (L.after) L.after(g, w, camX, t);
    });
  }

  function drawActor(g, w, a, camX) {
    var cos = MS.costumes[a.costume];
    if (!cos) return;
    if (a.blinkT > 0 && Math.floor(w.time * 12) % 2) return; // hurt blink
    var L = w.ui.line;
    var talking = L && L.id === a.id && L.shown < L.total && Math.floor(w.time * 8) % 2 === 0;
    var anim = a.playAnim || a.anim;
    var blink = !talking && ((a.t + (MS.util.hash(a.id || '') % 7)) % 3.7) < 0.12;
    var cel = Math.floor(a.t * 30) / 30; // cels change at 30 Hz, Metal Slug's cadence
    var f = MS.rig.frame(a.costume, cos, anim, MS.rig.frameIndex(anim, cel), {
      expr: a.expr, talking: talking, chained: a.chained, tied: a.tied, era: MS.ui.paletteEra(w),
      armed: !!a.armed, upper: a.upper || null, blink: blink, held: a.held || null, squash: a.squashT > 0 ? 1 : 0
    });
    var sx = Math.round(a.x - camX), sy = Math.round(w.ground + a.y + (a.squashT > 0 ? 1 : 0));
    if (sx < -48 || sx > W + 48) return;
    if (a.y < -4 && !a.noShadow) { // only airborne characters get a contact shadow
      g.fillStyle = 'rgba(8,4,10,0.35)';
      g.fillRect(sx - 5, w.ground - 1, 10, 1);
    }
    if (a.facing < 0) {
      g.save(); g.translate(sx, 0); g.scale(-1, 1);
      g.drawImage(f.canvas, -f.ox, sy - f.oy);
      g.restore();
    } else {
      g.drawImage(f.canvas, sx - f.ox, sy - f.oy);
    }
    if (a.anim === 'itemget') {
      var letter = String(w.hud.arms || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0) || '?';
      var it = MS.props.item(letter);
      g.drawImage(it, sx - Math.floor(it.width / 2), sy - f.oy + f.headTop - it.height - 6 - (Math.floor(w.time * 4) % 2));
    }
  }

  // Play-segment extras (fleeing troopers and friends), drawn like actors, plus their barks.
  function drawExtras(g, w, camX) {
    var p = w.play;
    if (!p || !p.extras) return;
    p.extras.forEach(function (e) {
      if (!e.visible) return;
      drawActor(g, w, e, camX);
      var sx = Math.round(e.x - camX);
      if (e.say && Math.floor(e.say.t * 14) % 3) {
        MS.font.drawCentered(g, e.say.text, sx + e.facing * -6, Math.round(w.ground + e.y - 58 - e.say.t * 6), '#ffffff', { shadow: '#140c12' });
      }
      if (e.state === 'startle' && MS.props.emote) {
        var em = MS.props.emote('!');
        g.drawImage(em, sx - Math.floor(em.width / 2), Math.round(w.ground + e.y - 66));
      }
    });
  }

  function drawCrate(g, w, camX) {
    var c = w.state.crate;
    if (!c || c.gone) return;
    var letter = c.letter;
    var box = MS.props.crate(letter);
    var x = Math.round(c.x - camX - box.width / 2), y = Math.round(c.y - box.height);
    if (c.chute) {
      var ch = MS.props.chute();
      var sway = Math.round(Math.sin(w.time * 5) * 1.5);
      g.drawImage(ch, x - 4 + sway, y - ch.height + 6);
    }
    if (c.open > 0) {
      g.drawImage(box, 0, 4, box.width, box.height - 4, x, y + 4, box.width, box.height - 4);
      g.globalAlpha = Math.max(0, 1 - c.open);
      g.drawImage(box, 0, 0, box.width, 4, x - Math.round(c.open * 6), y - Math.round(c.open * 10), box.width, 4);
      g.globalAlpha = 1;
    } else {
      g.drawImage(box, x, y);
    }
    if (c.item) {
      var it = MS.props.item(letter);
      var k = c.item.k;
      var ix = MS.util.lerp(c.x, c.item.toX, k) - camX;
      var iy = y - 6 - Math.sin(k * Math.PI) * 26 - k * 20;
      g.drawImage(it, Math.round(ix - it.width / 2), Math.round(iy - it.height));
    }
  }

  function drawFx(g, w, camX) {
    w.fx.projectiles.forEach(function (p) {
      if (p.rest > 1.2 && Math.floor(p.rest * 12) % 2) return;
      var f = p.t >= p.dur ? 2 : [0, 1, 2, 1][Math.floor(p.rot) % 4];
      var img = MS.props.slide(f);
      g.drawImage(img, Math.round(p.x - camX - img.width / 2), Math.round(p.y - img.height + (p.t >= p.dur ? 4 : 0)));
    });
    w.fx.particles.forEach(function (p) {
      if (p.kind && p.kind !== 'dot' && MS.playfx && MS.playfx.particle) { MS.playfx.particle(g, p, camX, w); return; }
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x - camX), Math.round(p.y), p.size, p.size);
    });
  }

  function draw(g, director, game) {
    var w = director.world;
    if (!w) return;
    var set = w.set;
    var t = game.time;
    var shake = w.camera.shake > 0 ? w.camera.shakeAmp * (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    var camX = Math.round(w.camera.view != null ? w.camera.view : w.camera.x) + shake;
    g.save();
    if (shake) g.translate(0, Math.floor(t * 50) % 2 ? 1 : 0);
    g.fillStyle = set.bg || '#000';
    g.fillRect(-4, -4, W + 8, H + 8);
    drawLayers(g, set, camX, false, w, t);
    if (set.drawBack) set.drawBack(g, w, camX, t);

    var items = [];
    (set.props || []).forEach(function (p) { items.push({ z: p.z || 0, x: p.x, prop: p }); });
    w.ids.forEach(function (id) {
      var a = w.actors[id];
      if (a.visible) items.push({ z: a.z || 0, x: a.x, actor: a });
    });
    items.sort(function (a, b) { return a.z - b.z || a.x - b.x; });
    items.forEach(function (it) {
      if (it.actor) drawActor(g, w, it.actor, camX);
      else {
        var sx = Math.round(it.prop.x - camX);
        if (sx > -80 && sx < W + 80) it.prop.draw(g, sx, w, t);
      }
    });
    drawExtras(g, w, camX);
    drawCrate(g, w, camX);
    drawFx(g, w, camX);
    if (MS.playfx) MS.playfx.draw(g, w, camX, t);
    if (set.drawFront) set.drawFront(g, w, camX, t);
    drawLayers(g, set, camX, true, w, t);
    g.restore();
    if (w.fx.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (w.fx.flash * 0.85) + ')'; g.fillRect(0, 0, W, H); }
    MS.ui.draw(g, director, game);
  }

  // Bloom for the future era: bright pixels, blurred by downscaling, added on top.
  var small = null;
  function bloom(fx, source, strength) {
    var fg = fx.getContext('2d');
    fg.clearRect(0, 0, fx.width, fx.height);
    if (!strength) return;
    if (!small) { small = document.createElement('canvas'); small.width = 96; small.height = 54; }
    var sg = small.getContext('2d');
    sg.imageSmoothingEnabled = true;
    sg.clearRect(0, 0, 96, 54);
    sg.drawImage(source, 0, 0, 96, 54);
    var img = sg.getImageData(0, 0, 96, 54), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      var k = Math.max(0, Math.min(1, (l - 0.6) / 0.4));
      d[i + 3] = Math.round(k * 255); // only bright pixels glow; the rest is transparent
    }
    sg.putImageData(img, 0, 0);
    fg.save();
    fg.imageSmoothingEnabled = true;
    fg.globalAlpha = strength;
    fg.drawImage(small, 0, 0, fx.width, fx.height);
    fg.globalAlpha = strength * 0.6;
    fg.drawImage(small, -fx.width * 0.02, -fx.height * 0.02, fx.width * 1.04, fx.height * 1.04);
    fg.restore();
  }

  MS.render = { draw: draw, bloom: bloom, bake: bake };
})(typeof window !== 'undefined' ? window : globalThis);
