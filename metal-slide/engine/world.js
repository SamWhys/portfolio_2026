/* METAL SLIDE engine: world state and commands.
   A World is one mission's live state: actors, camera, HUD and set-specific state.
   Commands change it. Each command returns a Task with update(dt) and finish().
   finish() always snaps to the exact end state, so skipping and rewinding never drift.
   Pure logic (no canvas), so it also runs in Node for tests. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var U = MS.util;
  var W = MS.W;

  var SPEED = { walk: 80, run: 160 }; // cutscene speeds (levels are wide now)

  // ---------------------------------------------------------------- World
  function World(set, entry) {
    this.set = set;
    this.era = set.era;
    this.width = Math.max(W, set.width || W);
    this.ground = set.ground || 156;
    this.camera = { x: U.clamp(set.camera || 0, 0, this.width - W), mode: 'fixed', follow: null, shake: 0, shakeAmp: 0 };
    this.camera.view = this.camera.x;
    this.actors = {};
    this.ids = [];
    var cast = set.cast || {};
    for (var id in cast) {
      var c = cast[id];
      this.actors[id] = {
        id: id, name: c.display || (c.names && c.names[0]) || id, costume: c.costume,
        x: c.x == null ? -60 : c.x, y: 0, facing: c.facing || 1, anim: c.anim || 'idle', t: (U.hash(id) % 997) / 311,
        visible: c.visible !== false, chained: !!c.chained, z: c.z || 0,
        voice: c.voice != null ? c.voice : (MS.costumes && MS.costumes[c.costume] && MS.costumes[c.costume].voice) || 0.5,
        expr: null
      };
      this.ids.push(id);
    }
    this.hud = { on: set.hud !== false, arms: entry ? entry.arms : 'NONE', saved: entry ? entry.saved : 0 };
    this.music = set.music || null;
    this.state = set.initState ? set.initState() : {};
    this.tally = null;
    this.ending = false;
    this.mode = 'scene';
    this.play = null;
    this.time = 0;
    this.reduced = false;
    this.ui = blankUI();
    this.fx = { particles: [], emotes: [], projectiles: [], flash: 0, callout: null, notes: [] };
    this.warnings = [];
  }

  function blankUI() { return { line: null, bubbles: [], banner: null, title: null, click: null, row: null }; }

  World.prototype.clearPresentation = function () { this.ui = blankUI(); };

  World.prototype.visibleIds = function () {
    var self = this;
    return this.ids.filter(function (id) { return self.actors[id].visible; });
  };

  World.prototype.resolve = function (ids) {
    var out = [];
    var self = this;
    (ids || []).forEach(function (id) {
      if (id === '*') self.visibleIds().forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
      else if (self.actors[id] && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  };

  World.prototype.warn = function (msg) { if (this.warnings.indexOf(msg) < 0) this.warnings.push(msg); };

  World.prototype.xOf = function (target) {
    if (!target) return null;
    var cam = this.camera.x;
    switch (target.kind) {
      case 'x': return target.x;
      case 'side': return target.side === 'left' ? cam + 48 : cam + W - 48;
      case 'center': return cam + W / 2;
      case 'actor': return this.actors[target.id] ? this.actors[target.id].x : null;
      case 'mark':
        var marks = this.set.marks || {};
        if (marks[target.name] != null) return marks[target.name];
        this.warn('Unknown place "' + target.name + '". Known places: ' + (Object.keys(marks).join(', ') || 'none') + '.');
        return cam + W / 2;
    }
    return null;
  };

  World.prototype.followX = function () {
    var a = this.actors[this.camera.follow];
    if (!a) return this.camera.x;
    var lead = a.facing > 0 ? W * 0.38 : W * 0.62;
    return U.clamp(Math.round(a.x - lead), 0, this.width - W);
  };

  // A following camera's logical position is always derived from the actor it follows,
  // in live play and in instant replay alike, so commands that read the camera agree.
  // Only the drawn view eases (see camera.view below).
  World.prototype.syncCamera = function () {
    if (this.camera.mode === 'follow' && this.actors[this.camera.follow]) this.camera.x = this.followX();
  };

  World.prototype.update = function (dt) {
    this.time += dt;
    var i;
    for (i = 0; i < this.ids.length; i++) this.actors[this.ids[i]].t += dt;
    var cam = this.camera;
    this.syncCamera();
    if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt);
    var f = this.fx;
    if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 4);
    f.emotes = f.emotes.filter(function (e) { e.t += dt; return e.t < e.dur; });
    f.notes = f.notes.filter(function (n) { n.t += dt; return n.t < n.dur; });
    if (f.callout) { f.callout.t += dt; if (f.callout.t > f.callout.dur) f.callout = null; }
    if (f.pops) f.pops = f.pops.filter(function (p) { p.t += dt; return p.t < 0.8; });
    if (f.flashes) f.flashes = f.flashes.filter(function (p) { p.t += dt; return p.t < 0.15; });
    if (f.blasts) f.blasts = f.blasts.filter(function (b) { b.t += dt; return b.t - b.delay < 1.6; });
    // The drawn camera eases toward the logical one (dialogue framing), except in play.
    if (cam.view == null || cam.mode === 'player' || this.reduced) cam.view = cam.x;
    else if (cam.view !== cam.x) {
      var dv = cam.x - cam.view, stepv = 400 * dt;
      cam.view = Math.abs(dv) <= stepv ? cam.x : cam.view + Math.sign(dv) * stepv;
    }
    var g = this.ground;
    f.particles = f.particles.filter(function (p) {
      p.life -= dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor !== false && p.y > g + (p.floorOff || 0)) { p.y = g + (p.floorOff || 0); p.vy *= -0.3; p.vx *= 0.6; }
      return p.life > 0;
    });
    f.projectiles = f.projectiles.filter(function (p) {
      p.t += dt;
      if (p.t < p.dur) {
        var k = p.t / p.dur;
        p.x = U.lerp(p.x0, p.x1, k);
        p.y = U.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * p.arc;
        p.rot += p.spin * dt;
      } else { p.y = p.y1; p.rest += dt; }
      return p.rest < 1.6;
    });
    this.ui.bubbles.forEach(function (b) { b.t += dt; });
    if (this.ui.title) this.ui.title.t += dt;
    if (this.ui.complete) this.ui.complete.t += dt;
    if (this.ui.endingT != null) this.ui.endingT += dt;
    if (this.ui.row) this.ui.row.t += dt;
    if (this.set.update) this.set.update(this, dt);
  };

  // Cosmetic effects: skipped entirely during instant replay.
  World.prototype.emote = function (id, kind) { this.fx.emotes.push({ id: id, kind: kind, t: 0, dur: 1.6 }); };
  World.prototype.burst = function (x, y, n, opts) {
    opts = opts || {};
    var rnd = U.rng(Math.floor(this.time * 1000) + n);
    for (var i = 0; i < n; i++) {
      var ang = (opts.angle == null ? -Math.PI / 2 : opts.angle) + (rnd() - 0.5) * (opts.spread || Math.PI);
      var sp = (opts.speed || 60) * (0.5 + rnd() * 0.8);
      this.fx.particles.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: opts.g == null ? 220 : opts.g,
        life: (opts.life || 0.7) * (0.6 + rnd() * 0.6), color: opts.colors ? opts.colors[i % opts.colors.length] : '#d8c8a8',
        size: opts.size || 1, kind: opts.kind || 'dot', floor: opts.floor
      });
    }
  };
  World.prototype.dust = function (x, y) {
    this.burst(x, y - 1, 3, { kind: 'dust', colors: ['#c8b89a', '#9a8a70'], speed: 26, g: -10, angle: -Math.PI / 2, spread: Math.PI * 1.6, life: 0.3, size: 2, floor: false });
  };
  World.prototype.smoke = function (x, y) {
    this.burst(x, y, 2, { kind: 'puff', colors: ['#787060', '#908878'], speed: 12, g: -18, angle: -Math.PI / 2, spread: 0.8, life: 1.2, size: 3, floor: false });
  };
  World.prototype.debris = function (x, y, colors, n) {
    this.burst(x, y, n || 6, { kind: 'chip', colors: colors || ['#a07a5c', '#75574a'], speed: 80, g: 450, life: 1.1, size: 2 });
  };
  World.prototype.sparks = function (x, y, dir) {
    this.burst(x, y, 5, { kind: 'spark', colors: ['#fff6e0', '#ffd84a'], speed: 100, g: 0, angle: dir < 0 ? Math.PI : 0, spread: Math.PI * 0.8, life: 0.16, floor: false });
  };
  // A Metal Slug explosion: staggered puffs (dark frame, white frame, fire, smoke).
  World.prototype.explode = function (x, y, size) {
    if (this.instant) return;
    var n = size === 'big' ? 7 : size === 'small' ? 3 : 5, r = size === 'big' ? 14 : size === 'small' ? 7 : 10;
    var rnd = U.rng(Math.floor(this.time * 997) + Math.round(x));
    var blasts = this.fx.blasts = this.fx.blasts || [];
    for (var i = 0; i < n; i++) {
      // only the first puff flashes white, and at most about 3 white frames a second overall
      var white = i === 0 && !this.reduced && this.time - (this.lastWhite == null ? -9 : this.lastWhite) > 0.34;
      if (white) this.lastWhite = this.time;
      blasts.push({ x: x + (rnd() - 0.5) * r * 1.6, y: y - i * r * 0.5 + (rnd() - 0.5) * 4, r: Math.round(r * (0.6 + rnd() * 0.5)), delay: i * 0.06, t: 0, white: white });
    }
    if (!this.reduced) { this.camera.shake = 0.3; this.camera.shakeAmp = 2; }
    this.sfx('boom');
  };
  World.prototype.sfx = function (name, o) { if (MS.audio && !this.instant) MS.audio.sfx(name, o); };
  World.prototype.jingle = function (name) { if (MS.audio && !this.instant) MS.audio.jingle(name); };

  // ---------------------------------------------------------------- Tasks
  function Task(dur, update, finish) {
    this.t = 0; this.dur = dur; this.done = false;
    this._update = update; this._finish = finish;
  }
  Task.prototype.update = function (dt) {
    if (this.done) return true;
    this.t += dt;
    if (this._update) this._update(this.t, dt);
    if (this.t >= this.dur) this.finish();
    return this.done;
  };
  Task.prototype.finish = function () {
    if (this.done) return;
    this.done = true;
    if (this._finish) this._finish();
  };
  function instantTask(fn) { return new Task(0, null, fn); }

  // Walk/run several actors to x positions. Arrival snaps them, faces them, and idles them.
  function moveTask(world, moves, run, after) {
    var speed = run ? SPEED.run : SPEED.walk;
    var dur = 0;
    moves.forEach(function (m) {
      var a = world.actors[m.id];
      m.x0 = a.x;
      m.d = Math.abs(m.x - a.x) / speed;
      m.delay = m.delay || 0;
      dur = Math.max(dur, m.delay + m.d);
      if (m.x !== a.x) a.facing = m.x > a.x ? 1 : -1;
    });
    function place(m, k) {
      var a = world.actors[m.id];
      a.x = U.lerp(m.x0, m.x, k);
    }
    return new Task(dur, function (t) {
      moves.forEach(function (m) {
        var a = world.actors[m.id];
        var k = m.d ? U.clamp((t - m.delay) / m.d, 0, 1) : 1;
        if (k <= 0) return;
        if (k < 1) {
          if (a.anim !== (run ? 'run' : 'walk')) { a.anim = run ? 'run' : 'walk'; }
          a.facing = m.x > m.x0 ? 1 : -1;
          place(m, k);
        } else if (!m.arrived) {
          m.arrived = true; place(m, 1); a.anim = 'idle';
          if (m.face) a.facing = m.face;
        }
      });
    }, function () {
      moves.forEach(function (m) {
        var a = world.actors[m.id];
        place(m, 1);
        if (m.x !== m.x0 || a.anim === 'walk' || a.anim === 'run') a.anim = 'idle';
        if (m.face) a.facing = m.face;
      });
      if (after) after();
    });
  }

  var MOOD = {
    shocked: ['shocked', '!'], angry: ['angry', 'anger'], sad: ['sad', '...'], happy: ['happy', 'sparkle'],
    confused: ['shrug', '?'], scared: ['panic', 'sweat'], nervous: [null, 'sweat']
  };

  // ---------------------------------------------------------------- Commands
  var C = {};

  C.enter = function (w, d) {
    var ids = w.resolve(d.actors);
    var cam = w.camera.x;
    var tx = w.xOf(d.target);
    var moves = ids.map(function (id, i) {
      var a = w.actors[id];
      a.visible = true;
      a.x = d.side === 'right' ? cam + W + 18 + i * 18 : cam - 18 - i * 18;
      a.facing = d.side === 'right' ? -1 : 1;
      var entry = w.set.entry || 70;
      var x = tx != null ? tx + (d.side === 'right' ? i * 22 : -i * 22) : (d.side === 'right' ? cam + W - entry - i * 22 : cam + entry + i * 22);
      return { id: id, x: Math.round(x), delay: i * 0.12 };
    });
    return moveTask(w, moves, d.run);
  };

  C.move = function (w, d) {
    var ids = w.resolve(d.actors);
    var tActor = d.target && d.target.kind === 'actor' ? w.actors[d.target.id] : null;
    var tx = w.xOf(d.target);
    if (tx == null) return instantTask();
    var moves = ids.filter(function (id) { return !tActor || id !== tActor.id; }).map(function (id, i) {
      var a = w.actors[id];
      var x = tx;
      var face = null;
      if (tActor) {
        var side = a.x <= tActor.x ? -1 : 1;
        x = tActor.x + side * (26 + i * 20);
        face = -side;
      } else {
        x = tx + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 20;
      }
      return { id: id, x: Math.round(x), face: face, delay: i * 0.1 };
    });
    return moveTask(w, moves, d.run);
  };

  C.step = function (w, d) {
    var ids = w.resolve(d.actors);
    var moves = ids.map(function (id) {
      var a = w.actors[id];
      var dx = d.dir === 'left' ? -64 : d.dir === 'right' ? 64 : d.dir === 'forward' ? 32 * a.facing :
        d.dir === 'back' ? -32 * a.facing : d.dir === 'closer' ? Math.sign(w.camera.x + W / 2 - a.x) * 32 : 0;
      if (d.dir === 'away') dx = -Math.sign(w.camera.x + W / 2 - a.x) * 48;
      var face = d.dir === 'back' ? a.facing : null;
      return { id: id, x: Math.round(a.x + dx), face: face };
    });
    return moveTask(w, moves, d.run);
  };

  C.exit = function (w, d) {
    var ids = w.resolve(d.actors);
    var cam = w.camera.x;
    var moves = ids.map(function (id, i) {
      var a = w.actors[id];
      var side = d.side || (a.x >= cam + W / 2 ? 'right' : 'left');
      return { id: id, x: Math.round(side === 'right' ? cam + W + 24 + i * 6 : cam - 24 - i * 6), delay: i * 0.1 };
    });
    return moveTask(w, moves, d.run, function () { ids.forEach(function (id) { w.actors[id].visible = false; }); });
  };

  C.face = function (w, d) {
    return instantTask(function () {
      w.resolve(d.actors).forEach(function (id) {
        var a = w.actors[id];
        if (d.target === 'flip') { a.facing = -a.facing; return; }
        if (d.target && d.target.kind === 'side') { a.facing = d.target.side === 'left' ? -1 : 1; return; }
        var x = w.xOf(d.target);
        if (x != null && x !== a.x) a.facing = x > a.x ? 1 : -1;
      });
    });
  };

  C.anim = function (w, d) {
    return instantTask(function () {
      w.resolve(d.actors).forEach(function (id) {
        var a = w.actors[id];
        a.anim = d.anim; a.t = 0;
        var x = d.target ? w.xOf(d.target) : null;
        if (x != null && x !== a.x) a.facing = x > a.x ? 1 : -1;
      });
    });
  };

  C.mood = function (w, d) {
    var m = MOOD[d.mood] || [null, null];
    return instantTask(function () {
      w.resolve(d.actors).forEach(function (id) {
        if (m[0]) { w.actors[id].anim = m[0]; w.actors[id].t = 0; }
        if (m[1] && !w.instant) w.emote(id, m[1]);
      });
      if (!w.instant) w.sfx('pop');
    });
  };

  C.emote = function (w, d) {
    return instantTask(function () {
      if (w.instant) return;
      w.resolve(d.actors).forEach(function (id) { w.emote(id, d.emote); });
      w.sfx('pop');
    });
  };

  C.jump = function (w, d) {
    var ids = w.resolve(d.actors);
    return new Task(0.55, function (t) {
      var k = Math.min(1, t / 0.55);
      ids.forEach(function (id) { w.actors[id].y = -Math.round(Math.sin(k * Math.PI) * 14); w.actors[id].anim = 'jump'; });
    }, function () {
      ids.forEach(function (id) { w.actors[id].y = 0; w.actors[id].anim = 'idle'; });
    });
  };

  C.free = function (w, d) {
    var ids = w.resolve(d.actors);
    var done = {};
    var by = d.by && w.actors[d.by];
    if (by && ids.length) {
      var tx = w.actors[ids[0]].x;
      if (tx !== by.x) by.facing = tx > by.x ? 1 : -1;
    }
    function release(id) {
      if (done[id]) return;
      done[id] = true;
      var a = w.actors[id];
      if (a.chained) w.hud.saved += 1;
      a.chained = false;
      a.anim = 'salute'; a.t = 0;
      if (!w.instant) {
        w.burst(a.x + 4 * a.facing, w.ground - 2, 8, { colors: ['#9aa0a8', '#c8ccd0', '#5a5e66'], speed: 70, g: 260 });
        w.ui.bubbles.push({ id: id, text: 'THANK YOU!', t: 0, delay: 0, auto: true });
        w.sfx('snap');
      }
    }
    var dur = ids.length ? 0.35 * (ids.length - 1) + 1.1 : 0;
    var jingled = false;
    return new Task(dur, function (t) {
      ids.forEach(function (id, i) { if (t >= i * 0.35) release(id); });
      if (!jingled && t > 0.15) { jingled = true; w.jingle('rescue'); }
    }, function () {
      ids.forEach(release);
    });
  };

  C['throw'] = function (w, d) {
    var ids = w.resolve(d.actors);
    var targets = d.targets ? w.resolve(d.targets) : [];
    var prev = {};
    ids.forEach(function (id) { prev[id] = w.actors[id].anim; });
    var thrown = 0;
    return new Task(1.0, function (t) {
      ids.forEach(function (id) {
        var a = w.actors[id];
        a.anim = 'throw';
        if (targets.length) { var tx = w.actors[targets[0]].x; if (tx !== a.x) a.facing = tx > a.x ? 1 : -1; }
        var want = Math.min(6, Math.floor(t / 0.12));
        while (!w.instant && thrown < want) {
          var tg = targets.length ? w.actors[targets[thrown % targets.length]] : null;
          var x1 = tg ? tg.x + (thrown % 3 - 1) * 6 : a.x + a.facing * (60 + thrown * 14);
          w.fx.projectiles.push({ kind: 'slide', x0: a.x + a.facing * 6, y0: w.ground - 30, x1: x1, y1: w.ground - 1,
            x: a.x, y: w.ground - 30, t: 0, dur: 0.55 + (thrown % 2) * 0.1, arc: 26 + (thrown % 3) * 8, rot: 0, spin: 9 + thrown, rest: 0, n: thrown });
          if (thrown % 2 === 0) w.sfx('throw');
          thrown++;
        }
      });
    }, function () {
      ids.forEach(function (id) { w.actors[id].anim = prev[id] === 'throw' ? 'idle' : prev[id]; });
      if (!w.instant) targets.forEach(function (id) { w.emote(id, 'sweat'); });
    });
  };

  C.hide = function (w, d) { return instantTask(function () { w.resolve(d.actors).forEach(function (id) { w.actors[id].visible = false; }); }); };
  C.show = function (w, d) { return instantTask(function () { w.resolve(d.actors).forEach(function (id) { w.actors[id].visible = true; }); }); };

  C.camera = function (w, d) {
    var cam = w.camera;
    var x0 = cam.x;
    var cx = w.xOf(d.target);
    if (cx == null) return instantTask();
    var x1 = U.clamp(Math.round(cx - W / 2), 0, w.width - W);
    cam.mode = 'fixed'; cam.follow = null;
    var dur = d.cut || w.reduced ? 0 : U.clamp(Math.abs(x1 - x0) / 220, 0.35, 1.6);
    return new Task(dur, function (t) { cam.x = U.lerp(x0, x1, U.ease.inOut(Math.min(1, t / dur))); }, function () { cam.x = x1; if (d.cut) cam.view = x1; });
  };

  C.follow = function (w, d) {
    return instantTask(function () {
      w.camera.mode = 'follow'; w.camera.follow = d.actor;
      w.syncCamera();
    });
  };

  C.shake = function (w, d) {
    return instantTask(function () {
      if (w.instant || w.reduced) return;
      w.camera.shake = d.size === 'big' ? 0.6 : d.size === 'small' ? 0.25 : 0.4;
      w.camera.shakeAmp = d.size === 'big' ? 4 : d.size === 'small' ? 1 : 2;
      w.sfx('boom');
    });
  };

  C.flash = function (w) { return instantTask(function () { if (!w.instant && !w.reduced) w.fx.flash = 1; }); };
  C.wait = function (w, d) { return new Task(w.instant ? 0 : d.seconds); };

  C.crate = function (w, d) {
    var sam = w.actors.SAM && w.actors.SAM.visible ? w.actors.SAM : null;
    var x = sam ? sam.x + sam.facing * 34 : w.camera.x + W / 2;
    var name = d.name;
    var crate = { x: Math.round(x), y: -40, letter: name.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?', open: 0, item: null, chute: true };
    var landed = false, given = false;
    var T = { fall: 0.9, pop: 1.25, give: 1.6, end: 3.1 };
    w.state.crate = crate;
    function giveItem() {
      if (given) return;
      given = true;
      w.hud.arms = name.toUpperCase();
      if (sam) { sam.anim = 'itemget'; sam.t = 0; }
      if (!w.instant) {
        w.fx.callout = { text: name.toUpperCase() + '!', t: 0, dur: 1.6 };
        w.jingle('pickup');
        w.burst(sam ? sam.x : crate.x, w.ground - 50, 14, { colors: ['#fff6b0', '#ffd84a', '#ffffff'], speed: 90, g: 40, life: 0.9, floor: false });
      }
    }
    return new Task(T.end, function (t) {
      if (t < T.fall) {
        crate.y = U.lerp(-40, w.ground, U.ease.in(t / T.fall));
      } else {
        crate.y = w.ground;
        crate.chute = false;
        if (!landed) {
          landed = true;
          if (!w.instant) { w.sfx('land'); w.burst(crate.x, w.ground - 1, 10, { colors: ['#c8b89a', '#9a8a70'], speed: 50, g: 120, angle: -Math.PI / 2, spread: Math.PI * 0.9 }); }
        }
      }
      if (t >= T.fall && t < T.give) crate.open = U.clamp((t - T.fall) / (T.pop - T.fall), 0, 1);
      if (t >= T.pop && t < T.give) crate.item = { k: (t - T.pop) / (T.give - T.pop), toX: sam ? sam.x : crate.x };
      if (t >= T.give) { crate.item = null; giveItem(); crate.gone = true; }
    }, function () {
      giveItem();
      delete w.state.crate;
      if (sam) sam.anim = 'idle';
    });
  };

  // A play segment: the player (or the demo autopilot) controls Sam until he reaches
  // the mark. It always ends by snapping Sam and the camera to the same place, and by
  // marking every target between start and mark as fixed, so replaying it instantly
  // gives exactly the state that playing it did.
  function canonCam(w, x) { return MS.player ? MS.player.canonCam(w, x) : U.clamp(Math.round(x - W * 0.46), 0, w.width - W); }
  function startOf(w, sam) { return sam.visible ? sam.x : Math.round(w.camera.x + 14); }

  C.play = function (w, d) {
    var sam = w.actors.SAM;
    if (!sam || !MS.player) return instantTask();
    var tx = w.xOf(d.target);
    if (tx == null) tx = w.width - 40;
    tx = Math.round(U.clamp(tx, 12, w.width - 12));
    var level = w.set.level || {};
    var startX = startOf(w, sam);
    var dir = tx >= startX ? 1 : -1;
    function settle() {
      var lo = Math.min(startX, tx), hi = Math.max(startX, tx);
      w.state.fixed = w.state.fixed || {};
      (level.targets || []).forEach(function (t) { if (t.x + t.w / 2 >= lo && t.x + t.w / 2 <= hi) w.state.fixed[t.id] = true; });
      sam.visible = true; sam.x = tx; sam.y = 0; sam.anim = 'idle'; sam.facing = dir;
      sam.armed = false; sam.upper = null; sam.blinkT = 0; sam.squashT = 0;
      sam.phys = null; // a fresh body next segment: no buffered jump, coyote or recoil carries over (and replay has none either)
      w.ids.forEach(function (id) { delete w.actors[id].playAnim; });
      w.camera.mode = 'fixed'; w.camera.follow = null;
      w.camera.x = canonCam(w, tx); w.camera.view = w.camera.x;
      w.play = null; w.mode = 'scene';
    }
    if (w.instant) return new Task(0, null, settle);
    if (!sam.visible) { sam.visible = true; sam.x = startX; sam.y = 0; sam.facing = 1; }
    w.mode = 'play';
    var dctl0 = w.director;
    if (dctl0 && dctl0.announce) {
      var where = d.target && d.target.kind === 'mark' ? 'the ' + d.target.name : d.target && d.target.kind === 'actor' && w.actors[d.target.id] ? w.actors[d.target.id].name || d.target.id : 'the end of the street';
      dctl0.announce(dctl0.autoplay ? 'Sam runs to ' + where + '.' :
        'Your turn: get Sam to ' + where + '. The arrow keys move, Up jumps and Enter fires the ' + MS.player.weapon(sam.costume).name + '. Or press Next to let Sam run there himself.');
    }
    w.state.fixed = w.state.fixed || {};
    var cam = Math.round(w.camera.x);
    w.play = {
      targetX: tx, goalX: tx, dir: dir, startX: startX, shots: [], thrown: [], t: 0, idleT: 0, auto: false, react: 0, wdX: startX, wdT: 0,
      camMin: dir > 0 ? Math.min(cam, canonCam(w, tx)) : canonCam(w, tx),
      camMax: dir > 0 ? canonCam(w, tx) : Math.max(cam, canonCam(w, tx)),
      // Only this stretch's targets can be fixed: a shot that flies past the mark can't fix
      // a target that a rewind (which settles the same stretch) wouldn't. The rest are
      // armored for now, so a bolt that reaches one sparks off it instead of passing through.
      targets: (level.targets || []).filter(function (t) { return !w.state.fixed[t.id]; }).map(function (t) {
        var c = {}; for (var k in t) c[k] = t[k]; c.hp = t.hp || 1; c.hitT = 0;
        var mid = t.x + t.w / 2;
        if (mid < Math.min(startX, tx) || mid > Math.max(startX, tx)) c.armored = true;
        return c;
      }),
      extras: []
    };
    w.play.extras = level.spawn ? (level.spawn(w, Math.min(startX, tx), Math.max(startX, tx)) || []) : [];
    w.camera.mode = 'player';
    var task = new Task(Infinity, function (t, dt) {
      var p = w.play;
      if (!p) return;
      p.t += dt;
      var dctl = w.director;
      var demo = !dctl || dctl.autoplay || !dctl.input;
      var hand = demo ? null : dctl.input();
      // After an auto-run (Next in play), a jump, a shot or a held direction takes Sam
      // back. A quick tap doesn't, so a clicker's second → tap still skips ahead.
      if (p.auto && hand) {
        p.handT = (hand.left || hand.right) && !hand.runner || hand.down ? (p.handT || 0) + dt : 0;
        if (hand.jumpPressed || hand.firePressed || p.handT > 0.2) p.auto = false;
      }
      var auto = demo || p.auto;
      var ctl = auto ? MS.player.autopilot(w, tx) : hand;
      // The touch runner never gets stuck: blocked for a moment, the HUD says SWIPE UP; still
      // blocked a few seconds later, he hops by himself (the game can't be lost).
      // Stuck means no new ground gained, so a knock-back from a thrown slide doesn't reset it.
      if (!auto && hand && hand.runner) {
        if (p.bestX == null || (sam.x - p.bestX) * dir > 1) { p.bestX = sam.x; p.stuckT = 0; }
        else p.stuckT = (p.stuckT || 0) + dt;
        if (p.stuckT > 3.5 && sam.phys && sam.phys.ground) { ctl = Object.assign({}, ctl, { jumpPressed: true }); p.stuckT = 2; }
      } else { p.stuckT = 0; p.bestX = null; }
      if (ctl.left || ctl.right || ctl.jumpPressed || ctl.fire) p.idleT = 0; else p.idleT += dt;
      MS.player.step(w, ctl, dt);
      MS.player.camera(w, dt);
      MS.player.shots(w, dt).forEach(function (hit) {
        w.state.fixed[hit.id] = true;
        if (level.onHit) level.onHit(w, hit);
        (w.fx.pops = w.fx.pops || []).push({ x: hit.x + hit.w / 2, y: (hit.y != null ? hit.y : w.ground - hit.h) - 2, t: 0, label: hit.label || '8PX', kind: hit.kind });
        w.sfx(hit.kind === 'chain' ? 'snap' : 'fix');
      });
      if (MS.enemies) MS.enemies.update(w, dt);
      if (level.update) level.update(w, dt, p);
      var arrived = dir > 0 ? sam.x >= tx - 2 : sam.x <= tx + 2; // within one frame's run
      if (arrived && (!sam.phys || sam.phys.ground)) { task.finish(); return; }
      // Watchdog: if the demo autopilot gets stuck, settle rather than hang the demo.
      if (auto) {
        if (Math.abs(sam.x - p.wdX) > 4) { p.wdX = sam.x; p.wdT = 0; }
        else if ((p.wdT += dt) > 3) task.finish();
      }
    }, settle);
    task.isPlay = true;
    return task;
  };

  // Metal Slug mission start: drop in from above the screen.
  C.drop = function (w, d) {
    var ids = w.resolve(d.actors).filter(function (id) { return !w.actors[id].visible || d.force; });
    if (!ids.length) return instantTask();
    var cam = w.camera.x;
    ids.forEach(function (id, i) { var a = w.actors[id]; a.visible = true; a.x = Math.round(cam + 60 - i * 20); a.facing = 1; a.anim = 'fall'; a.y = -120; });
    w.sfx('drop');
    return new Task(0.62, function (t) {
      var k = Math.min(1, t / 0.62);
      ids.forEach(function (id) { w.actors[id].y = -Math.round(120 * (1 - k * k)); });
    }, function () {
      ids.forEach(function (id) { var a = w.actors[id]; a.y = 0; a.anim = 'idle'; a.squashT = 0.1; });
      if (!w.instant) { w.sfx('land'); ids.forEach(function (id) { w.dust(w.actors[id].x, w.ground); }); }
    });
  };

  // Scripted volley from Sam's weapon: [blast the layouts]. Fixes the matching targets on screen.
  C.blast = function (w, d) {
    var sam = w.actors.SAM;
    var kind = String(d.what || '').toLowerCase().replace(/^(the|all|those|these) /, '').replace(/s$/, '');
    var all = ((w.set.level && w.set.level.targets) || []).filter(function (t) {
      return !kind || t.kind === kind || (t.label && t.label.toLowerCase().indexOf(kind) >= 0);
    });
    var cam = w.camera.x;
    var list = all.filter(function (t) { return t.x + t.w > cam && t.x < cam + W; });
    if (!list.length) list = all;
    w.state.fixed = w.state.fixed || {};
    var done = {};
    function fix(t) {
      if (done[t.id]) return;
      done[t.id] = true;
      w.state.fixed[t.id] = true;
      if (!w.instant) {
        var ty = t.y != null ? t.y : w.ground - t.h;
        w.sparks(t.x + t.w / 2, ty + t.h / 2, -1);
        (w.fx.pops = w.fx.pops || []).push({ x: t.x + t.w / 2, y: ty - 2, t: 0, label: t.label || '8PX', kind: t.kind });
        w.sfx('sparkle');
      }
    }
    if (sam && list.length) { var tx = list[0].x; if (tx !== sam.x) sam.facing = tx > sam.x ? 1 : -1; }
    var dur = list.length ? 0.25 + list.length * 0.18 : 0;
    var fired = 0;
    return new Task(dur, function (t) {
      if (sam) { sam.armed = true; sam.anim = 'idle'; }
      while (fired < list.length && t >= 0.12 + fired * 0.18) {
        var tg = list[fired++];
        if (sam && !w.instant) {
          var Wp = MS.player.weapon(sam.costume);
          var my = w.ground - Wp.muzzleY, mx = sam.x + sam.facing * Wp.muzzleX;
          if (Wp.flash !== false) (w.fx.flashes = w.fx.flashes || []).push({ x: mx, y: my, dir: sam.facing, t: 0, kind: Wp.shot });
          sam.upper = 'recoil';
          w.sfx('select');
        }
        fix(tg);
      }
    }, function () {
      list.forEach(fix);
      if (sam) { sam.armed = false; sam.upper = null; sam.anim = 'idle'; }
    });
  };

  C.arms = function (w, d) { return instantTask(function () { w.hud.arms = d.name.toUpperCase(); }); };
  C.hud = function (w, d) { return instantTask(function () { w.hud.on = d.on; }); };
  C.music = function (w, d) { return instantTask(function () { w.music = d.name; }); };
  C.sfx = function (w, d) { return instantTask(function () { w.sfx(d.name); }); };
  C.set = function () { return instantTask(); };
  C.note = function (w, d) {
    return instantTask(function () { if (!w.instant) w.fx.notes.push({ text: d.text, t: 0, dur: 3 }); });
  };
  C.event = function (w, d) {
    var ev = w.set.eventsById && w.set.eventsById[d.id];
    if (!ev) return instantTask();
    return ev.run(w, d.args || [], Task);
  };

  function start(world, desc, opts) {
    opts = opts || {};
    world.syncCamera();
    world.instant = !!opts.instant;
    var fn = C[desc.op];
    var task;
    try {
      task = fn ? fn(world, desc) : instantTask();
    } catch (err) {
      world.warn('Could not run [' + (desc.src || desc.op) + ']: ' + err.message);
      task = instantTask();
    }
    if (opts.instant) task.finish();
    world.instant = false;
    return task;
  }

  MS.World = World;
  MS.Task = Task;
  MS.commands = { start: start, table: C, SPEED: SPEED };
})(typeof window !== 'undefined' ? window : globalThis);
