/* METAL SLIDE engine: play-segment extras, Metal Slug style.
   Extras are NPCs that exist only while a play segment runs (set.level.spawn makes them).
   They loaf (a gag pose), notice Sam or a shot landing near them, hop and scream, then
   flee off screen. Throwers lob slides at Sam, which stagger him but never hurt him.
   Nothing here touches story state, so rewind stays exact. Pure logic, Node-testable. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var U = MS.util;

  var E = MS.enemyTuning = {
    notice: 130,     // Sam within this distance in front of them...
    shotNear: 24,    // ...or a shot passing this close: they notice
    startle: 0.25,   // the hop-and-scream before they run
    flee: 126,       // 1.5x Sam's speed
    throwRange: 220,
    throwEvery: 1.8, throwJitter: 0.4, flight: 0.9, arc: 30
  };

  // Make an extra. opts: { costume, x, facing, loaf (anim), thrower, held }
  function make(id, opts) {
    return {
      id: id, costume: opts.costume || 'trooper', x: opts.x, y: 0, facing: opts.facing || -1,
      anim: opts.loaf || 'idle', loaf: opts.loaf || 'idle', t: (U.hash(id) % 97) / 40, state: 'loaf', st: 0,
      thrower: !!opts.thrower, throwT: 0.8 + (U.hash(id) % 10) / 10, held: opts.held || null, visible: true,
      line: opts.line || null
    };
  }

  function update(w, dt) {
    var p = w.play;
    if (!p) return;
    var sam = w.actors.SAM;
    var rnd = p.rnd || (p.rnd = U.rng(U.hash((w.set.name || '') + ':' + Math.round(p.startX) + ':' + Math.round(p.targetX))));
    (p.extras || []).forEach(function (e) {
      if (e.state === 'gone') return;
      e.t += dt; e.st += dt;
      if (e.say) { e.say.t += dt; if (e.say.t > 1.1) e.say = null; }
      var dx = sam.x - e.x;
      if (e.state === 'loaf') {
        e.anim = e.loaf;
        var seesSam = Math.abs(dx) < E.notice && (Math.sign(dx) === e.facing || Math.abs(dx) < 40);
        var shotNear = (p.shots || []).some(function (s) { return Math.abs(s.x - e.x) < E.shotNear && s.y > w.ground - 50; });
        if (e.thrower && Math.abs(dx) < E.throwRange && !shotNear) {
          e.facing = dx >= 0 ? 1 : -1;
          e.throwT -= dt;
          if (e.throwT <= 0) {
            e.throwT = E.throwEvery + (rnd() - 0.5) * 2 * E.throwJitter;
            lob(w, e, sam);
          }
          e.anim = e.throwT > E.throwEvery - 0.25 ? 'throw' : 'idle';
          if (shotNear || Math.abs(dx) < 34) notice(w, e, sam);
        } else if (seesSam || shotNear) {
          notice(w, e, sam);
        }
      } else if (e.state === 'startle') {
        e.anim = 'startle';
        e.y = -Math.round(Math.sin(Math.min(1, e.st / E.startle) * Math.PI) * 5);
        if (e.st >= E.startle) { e.state = 'flee'; e.st = 0; e.t = 0; e.y = 0; e.facing = dx >= 0 ? -1 : 1; }
      } else if (e.state === 'flee') {
        e.anim = 'flee';
        e.x += e.facing * E.flee * dt;
        var cam = w.camera.x;
        if (e.x < cam - 40 || e.x > cam + MS.W + 40) { e.state = 'gone'; e.visible = false; }
        if (!w.instant && Math.floor(e.st * 3.3) !== Math.floor((e.st - dt) * 3.3) && w.burst) {
          w.burst(e.x - e.facing * 4, w.ground - 34, 2, { kind: 'sweat', colors: ['#c8e8ff'], speed: 50, g: 200, life: 0.4, angle: e.facing > 0 ? Math.PI * 1.15 : -Math.PI * 0.15, spread: 0.6 });
        }
      }
    });
    // thrown slides
    p.thrown = (p.thrown || []).filter(function (th) {
      if (th.dead) return false;
      th.t += dt;
      th.vy += th.g * dt;
      th.x += th.vx * dt; th.y += th.vy * dt;
      var feet = w.ground + sam.y;
      if (Math.abs(th.x - sam.x) < 7 && th.y > feet - 40 && th.y < feet) {
        if (MS.player) MS.player.hurt(w);
        if (!w.instant && w.burst) w.burst(th.x, th.y, 6, { kind: 'confetti', colors: ['#f8f0dc', '#d9542a'], speed: 50, g: 160, life: 0.7 });
        return false;
      }
      if (th.y >= w.ground - 1) {
        if (!w.instant && w.burst) w.burst(th.x, w.ground - 2, 4, { kind: 'confetti', colors: ['#f8f0dc', '#d9542a'], speed: 40, g: 200, life: 0.6 });
        return false;
      }
      return true;
    });
  }

  function notice(w, e, sam) {
    e.state = 'startle'; e.st = 0; e.t = 0;
    e.facing = sam.x >= e.x ? 1 : -1; // turn to look, then run the other way
    e.say = { text: e.line || 'AIIIEEE!', t: 0 };
    if (!w.instant) {
      if (e.held && w.debris) w.debris(e.x + e.facing * 6, w.ground - 20, ['#f8f0dc', '#d9542a'], 4);
      w.sfx('scream');
    }
    e.held = null;
  }

  function lob(w, e, sam) {
    var T = E.flight;
    var x0 = e.x + e.facing * 8, y0 = w.ground - 30;
    var vx = U.clamp((sam.x - x0) / T, -150, 150);
    var g = 8 * E.arc / (T * T);
    var vy = -4 * E.arc / T + (w.ground - 12 - y0) / T;
    w.play.thrown.push({ x: x0, y: y0, vx: vx, vy: vy, g: g, t: 0, dead: false });
    if (w.sfx) w.sfx('throw');
  }

  MS.enemies = { make: make, update: update, notice: notice, E: E };
})(typeof window !== 'undefined' ? window : globalThis);
