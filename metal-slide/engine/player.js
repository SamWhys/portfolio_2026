/* METAL SLIDE engine: the player controller.
   Metal Slug movement: one on-foot speed, instant start and stop, instant turning, a
   fixed jump of about one body height with a short hang at the apex, crouch.
   Fair-play extras: coyote time, a jump buffer, partial air steering.
   Collides with the set's solids (boxes standing on the ground). Sam's weapon changes with
   the mission (WEAPONS): its shots pop targets and thrown slides, and never touch a person.
   Also the demo-mode autopilot and the forward-locked camera.
   Pure logic (no canvas), tested in Node (tests/play.test.js, tests/player.test.js). */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var U = MS.util;

  // Tuning, in game pixels and seconds (canvas 384x216, characters ~44px tall).
  // Measured from Metal Slug footage frame by frame (3 native px per 30 Hz tick walking,
  // faster in the air, a 1.5-body-height jump with a 3-tick apex hang), scaled to our canvas.
  var P = MS.playerTuning = {
    speed: 100,        // the one on-foot speed: instant start, stop and turn
    airSpeed: 130,     // in the air you move a little faster than walking...
    airAccel: 1000,    // ...and can steer; with no input the arc keeps its speed
    jumpV: 315,        // takeoff speed
    gravity: 880,
    apexBand: 60,      // |vy| below this counts as the apex...
    apexScale: 0.5,    // ...where gravity eases for the hang
    maxFall: 360,
    coyote: 0.08,      // you can still jump this long after walking off an edge
    buffer: 0.10,      // a jump pressed this early before landing still happens
    halfW: 5,          // half the body width for collisions
    tapCooldown: 0.07, // tapping fires this fast...
    cooldown: 0.15,    // ...holding repeats this fast (each weapon can set its own)
    maxShots: 5,
    crouchDrop: 4,     // crouching lowers the muzzle this much (WEAPONS has the muzzles)
    margin: 10,        // keep Sam this far inside the screen edges
    follow: 0.385,     // the camera starts following past this fraction of the screen...
    followGain: 4.3,   // ...at (overshoot x gain) px/s, capped at Sam's speed
    hold: 0.46,        // where that leaves Sam while walking; also the canonical camera
    catchup: 168,      // catch-up speed when a cutscene left Sam off screen
    stagger: 0.35, knock: 50, blink: 0.8
  };

  function phys(a) {
    if (!a.phys) a.phys = { vx: 0, vy: 0, ground: true, crouch: false, since: 9, coyote: 0, buffer: 0, hurt: 0, airT: 0 };
    return a.phys;
  }

  // Top of the highest solid under x, as a y offset (0 is the ground, -h a box top).
  function floorAt(solids, x, halfW) {
    var top = 0;
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (x + halfW > s.x && x - halfW < s.x + s.w) top = Math.min(top, -s.h);
    }
    return top;
  }

  function blockedX(solids, x, y, halfW) {
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (x + halfW > s.x && x - halfW < s.x + s.w && y > -s.h + 1) return s;
    }
    return null;
  }

  function canonCam(w, x) { return U.clamp(Math.round(x - MS.W * P.hold), 0, w.width - MS.W); }

  // Sam's weapon in each mission, named by his costume (costumes.js) and drawn by rig.js.
  // muzzleX/muzzleY: where a shot leaves, ahead of his centre and above his feet, matching
  // the rig's muzzle (tools/arsenal.html marks both). speed in px/s. lob and gravity make
  // a shot arc; tap and rate are the cooldowns when tapping and holding; max caps the shots
  // in the air; spread nudges each shot up or down a pixel in turn. Every one is harmless:
  // shots fizzle before a person, and the ammo is a pebble, a suction cup or a spec bolt.
  var WEAPONS = {
    blaster: { name: 'spec blaster', shot: 'bolt', muzzleX: 18, muzzleY: 23, speed: 360, sound: 'shot' },
    sling: { name: 'slingshot', shot: 'pebble', muzzleX: 13, muzzleY: 27, speed: 250, lob: 70, gravity: 300,
      tap: 0.14, rate: 0.24, recoil: 0.16, sound: 'sling', flash: false },
    bow: { name: 'bow', shot: 'arrow', muzzleX: 18, muzzleY: 23, speed: 400, tap: 0.14, rate: 0.24, recoil: 0.16, sound: 'bow', flash: false },
    pistol: { name: 'pistol', shot: 'bolt', muzzleX: 18, muzzleY: 23, speed: 360, sound: 'shot' },
    mgun: { name: 'machine gun', shot: 'round', muzzleX: 26, muzzleY: 23, speed: 440, tap: 0.065, rate: 0.065, max: 14,
      spread: [0, -1, 1, 0, 1, -1], sound: 'mgun' },
    laser: { name: 'laser', shot: 'laser', muzzleX: 24, muzzleY: 23, speed: 620, sound: 'laser' }
  };
  function weapon(costume) {
    var c = MS.costumes && MS.costumes[costume];
    return (c && WEAPONS[c.weapon]) || WEAPONS.blaster;
  }
  // How far a shot has risen (negative) or dropped by the time it has flown dx pixels.
  function drop(W, dx) {
    if (!W.gravity) return 0;
    var t = Math.max(0, dx) / W.speed;
    return -W.lob * t + 0.5 * W.gravity * t * t;
  }

  // One physics step. c: { left, right, down, jump, jumpPressed, fire, firePressed }
  function step(w, c, dt) {
    var a = w.actors.SAM;
    if (!a) return;
    var s = phys(a);
    var solids = solidsOf(w);
    var play = w.play || {};
    var dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (s.hurt > 0) { s.hurt = Math.max(0, s.hurt - dt); dir = 0; }

    s.crouch = !!c.down && s.ground && s.hurt === 0;
    if (s.ground) s.vx = s.crouch ? 0 : dir * P.speed;
    else if (dir) s.vx = U.clamp(s.vx + dir * P.airAccel * dt, -P.airSpeed, P.airSpeed);
    if (s.hurt > 0) s.vx = -a.facing * P.knock;
    if (dir && s.hurt === 0) a.facing = dir;

    // jump, with a buffer before landing and coyote time after leaving a ledge
    if (c.jumpPressed) s.buffer = P.buffer;
    else s.buffer = Math.max(0, s.buffer - dt);
    s.coyote = s.ground ? P.coyote : Math.max(0, s.coyote - dt);
    if (s.buffer > 0 && s.coyote > 0 && !s.crouch && s.hurt === 0) {
      s.vy = -P.jumpV; s.ground = false; s.coyote = 0; s.buffer = 0; s.airT = 0;
      if (w.sfx) w.sfx('jump');
    }

    // horizontal move, stopped by solids we're not above, kept on screen
    if (s.vx) {
      var nx = a.x + s.vx * dt;
      var minX = play.minX != null ? play.minX : -Infinity, maxX = play.maxX != null ? play.maxX : Infinity;
      // the mark is a wall: a jump can't carry Sam past it
      if (play.goalX != null) { if (play.dir > 0) maxX = Math.min(maxX, play.goalX); else minX = Math.max(minX, play.goalX); }
      nx = U.clamp(nx, minX, maxX);
      var hit = blockedX(solids, nx, a.y, P.halfW);
      if (hit) nx = s.vx > 0 ? hit.x - P.halfW : hit.x + hit.w + P.halfW;
      a.x = nx;
    }

    // vertical
    var floor = floorAt(solids, a.x, P.halfW);
    if (!s.ground || a.y < floor) {
      s.ground = false;
      var g = P.gravity * (Math.abs(s.vy) < P.apexBand ? P.apexScale : 1);
      s.vy = Math.min(P.maxFall, s.vy + g * dt);
      a.y += s.vy * dt;
      s.airT += dt;
      if (a.y >= floor && s.vy >= 0) {
        a.y = floor; s.vy = 0; s.ground = true; a.squashT = 0.1;
        if (s.airT > 0.15 && w.dust && !w.instant) { w.dust(a.x, w.ground + a.y); if (w.sfx) w.sfx('land'); }
      }
    } else {
      a.y = floor;
    }
    if (a.squashT > 0) a.squashT = Math.max(0, a.squashT - dt);
    if (a.blinkT > 0) a.blinkT = Math.max(0, a.blinkT - dt);

    // fire: tapping fires fast, holding repeats a little slower
    s.since += dt;
    var shots = play.shots || (play.shots = []);
    var W = weapon(a.costume);
    var ready = (c.firePressed && s.since >= (W.tap || P.tapCooldown)) || (c.fire && s.since >= (W.rate || P.cooldown));
    if (ready && shots.length < (W.max || P.maxShots) && s.hurt === 0) {
      var my = w.ground + a.y - W.muzzleY + (s.crouch ? P.crouchDrop : 0);
      if (W.spread) { s.shotN = (s.shotN || 0) + 1; my += W.spread[s.shotN % W.spread.length]; }
      var mx = a.x + a.facing * W.muzzleX;
      shots.push({ x: mx, y: my, y0: my, t: 0, vx: a.facing * W.speed, kind: W.shot, lob: W.lob || 0, g: W.gravity || 0, life: 1.4 });
      s.since = 0;
      a.upper = 'recoil'; s.recoil = W.recoil || 0.1;
      if (w.fx && !w.instant && W.flash !== false) (w.fx.flashes = w.fx.flashes || []).push({ x: mx, y: my, dir: a.facing, t: 0, kind: W.shot });
      if (w.sfx) w.sfx(W.sound);
    }
    if (s.recoil > 0) { s.recoil -= dt; if (s.recoil <= 0) a.upper = null; }

    a.armed = true;
    var anim = s.hurt > 0 ? 'hurt' : !s.ground ? (s.vy < 0 ? 'jump' : 'fall') : s.crouch ? 'crouch' : s.vx ? 'run' : 'idle';
    if (anim !== a.anim) { a.anim = anim; a.t = 0; } // restart, so anticipation frames show
  }

  // A thrown slide hit Sam: stagger and blink. No damage, no game over.
  function hurt(w) {
    var a = w.actors.SAM, s = phys(a);
    if (s.hurt > 0 || a.blinkT > 0) return;
    s.hurt = P.stagger; a.blinkT = P.blink;
    if (w.sfx) w.sfx('hurt');
  }

  // Move shots; pop targets and thrown slides. Returns the targets fixed this step.
  function shots(w, dt) {
    var play = w.play;
    if (!play || !play.shots) return [];
    var targets = play.targets || [];
    var thrown = play.thrown || [];
    var hits = [];
    var camX = w.camera.x;
    var people = [];
    (play.extras || []).forEach(function (e) { if (e.visible && e.state !== 'gone') people.push(e); });
    w.ids.forEach(function (id) { var a = w.actors[id]; if (id !== 'SAM' && a.visible) people.push(a); });
    play.shots = play.shots.filter(function (sh) {
      var x0 = sh.x;
      sh.x += sh.vx * dt;
      sh.life -= dt;
      if (sh.g) {
        // a lobbed pebble: worked out from launch, so the autopilot's drop() agrees exactly
        sh.t += dt;
        sh.y = sh.y0 - sh.lob * sh.t + 0.5 * sh.g * sh.t * sh.t;
        if (sh.y >= w.ground - 1) { if (!w.instant && w.dust) w.dust(sh.x, w.ground); return false; }
      }
      // Spec bolts never touch a person: they fizzle just before, and an extra notices.
      for (var q = 0; q < people.length; q++) {
        var pp = people[q];
        var feet = w.ground + (pp.y || 0);
        if (Math.abs(sh.x - pp.x) < 9 && sh.y > feet - 46 && sh.y < feet) {
          if (!w.instant && w.burst) w.burst(sh.x - Math.sign(sh.vx) * 2, sh.y, 3, { kind: 'spark', colors: FIZZ[sh.kind] || FIZZ.bolt, speed: 40, g: 0, life: 0.12, floor: false });
          if (pp.state && MS.enemies && pp.state === 'loaf') MS.enemies.notice(w, pp, w.actors.SAM);
          return false;
        }
      }
      for (var j = 0; j < thrown.length; j++) {
        var th = thrown[j];
        if (th.dead) continue;
        if (Math.abs(sh.x - th.x) < 7 && Math.abs(sh.y - th.y) < 6) {
          th.dead = true;
          if (!w.instant && w.burst) w.burst(th.x, th.y, 8, { kind: 'confetti', colors: ['#f8f0dc', '#d9542a', '#9a8e80'], speed: 60, g: 160, life: 0.8 });
          (w.fx.pops = w.fx.pops || []).push({ x: th.x, y: th.y - 4, t: 0, label: 'NOPE', kind: 'slide' });
          return false;
        }
      }
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (t.dead) continue;
        var ty = t.y != null ? t.y : w.ground - t.h;
        // swept, so a fast laser bolt can't step clean over a narrow target
        if (Math.max(x0, sh.x) > t.x && Math.min(x0, sh.x) < t.x + t.w && inBand(sh.y, ty, t)) {
          if (!t.armored) t.hp = (t.hp || 1) - 1;
          t.hitT = 0.08;
          if (w.sfx) w.sfx('hit');
          if (!w.instant && w.sparks) w.sparks(sh.x, sh.y, sh.vx > 0 ? -1 : 1);
          if (t.hp <= 0) { t.dead = true; hits.push(t); }
          return false;
        }
      }
      return sh.life > 0 && sh.x > camX - 16 && sh.x < camX + MS.W + 16;
    });
    targets.forEach(function (t) { if (t.hitT > 0) t.hitT = Math.max(0, t.hitT - dt); });
    return hits;
  }

  // The level's solids, plus any gate still shut. A gate ({ x, w, h, until: [target ids] })
  // is a wall that stands until every target it names is fixed: a boss blocks the way
  // until its weak points are shut. Fixed state is story state, so replay agrees.
  function gateOpen(w, gt) {
    var fixed = w.state.fixed || {};
    return (gt.until || []).every(function (id) { return fixed[id]; });
  }
  function solidsOf(w) {
    var level = w.set.level || {};
    var list = level.solids || [];
    if (!level.gates || !level.gates.length) return list;
    var out = list.slice();
    level.gates.forEach(function (gt) { if (!gateOpen(w, gt)) out.push(gt); });
    return out;
  }

  // A bolt at height y hits a target whose top is ty. shots() and the autopilot share
  // this, so the demo never fires at something a bolt would miss.
  function inBand(y, ty, t) { return y > ty - 3 && y < ty + t.h + 3; }
  // A shot that fizzles by a person puffs in its own colours.
  var FIZZ = { bolt: ['#bff8ff', '#ffffff'], round: ['#bff8ff', '#ffffff'], laser: ['#8affc0', '#ffffff'],
    pebble: ['#a08a70', '#d8c8a8'], arrow: ['#ff7a68', '#f4f0e6'] };

  // Demo-mode driver: run to the mark, hop solids and incoming slides, blast what's ahead.
  function autopilot(w, targetX) {
    var a = w.actors.SAM;
    var s = phys(a);
    var solids = solidsOf(w);
    var play = w.play || {};
    var dir = targetX > a.x + 0.5 ? 1 : targetX < a.x - 0.5 ? -1 : 0;
    var c = { left: dir < 0, right: dir > 0, down: false, jump: false, jumpPressed: false, fire: false, firePressed: false };
    if (dir && s.ground) {
      var ahead = a.x + dir * (P.halfW + 17);
      if (blockedX(solids, ahead, a.y, P.halfW) || floorAt(solids, ahead, P.halfW) < a.y - 1) c.jumpPressed = true;
      (play.thrown || []).forEach(function (th) {
        if (!th.dead && th.vy > -20 && Math.abs(th.x - a.x) < 48 && Math.sign(th.x - a.x) === dir) c.jumpPressed = true;
      });
    }
    // react: how long a target has been in range, so the demo takes a beat before firing
    play.react = (play.react || 0) + 1 / 60;
    var targets = play.targets || [], near = false;
    var W = weapon(a.costume), face = a.facing || 1;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.dead || t.armored) continue;
      var dx = (t.x + t.w / 2) - a.x;
      if (Math.abs(dx) < 160 && Math.sign(dx) === face) {
        near = true;
        var ty = t.y != null ? t.y : w.ground - t.h;
        var my = w.ground + a.y - W.muzzleY;
        // where the shot will be when it reaches the target's near edge (a pebble arcs)
        var edge = (face > 0 ? t.x : t.x + t.w) - (a.x + face * W.muzzleX);
        if (inBand(my + drop(W, edge * face), ty, t)) { if (play.react > 0.25) c.fire = true; break; }
        if (ty + t.h < my && s.ground && Math.abs(dx) < 60 && dx * dir > 0) c.jumpPressed = true;
      }
    }
    if (!near) play.react = 0;
    return c;
  }

  // Camera, as measured in Metal Slug: it starts following once Sam passes 38.5% of the
  // screen, at (overshoot x 4.3) px/s capped at his speed, so he settles near 46%; it stops
  // dead when he stops and never scrolls back. It never passes where the segment will
  // settle, so there is no pop at the end.
  function camera(w, dt) {
    var a = w.actors.SAM, cam = w.camera, p = w.play;
    if (!p) return;
    var s = phys(a);
    var fwd = p.dir > 0 ? 1 : -1;
    var sx = a.x - cam.x;
    var line = fwd > 0 ? MS.W * P.follow : MS.W * (1 - P.follow);
    var over = fwd > 0 ? sx - line : line - sx;
    var moving = s.vx * fwd > 0;
    if (sx < P.margin || sx > MS.W - P.margin) {
      // a cutscene left Sam off screen: catch up steadily
      var want = a.x - MS.W * (fwd > 0 ? P.hold : 1 - P.hold);
      cam.x += U.clamp(want - cam.x, -P.catchup * dt, P.catchup * dt);
    } else if (moving && over > 0) {
      cam.x += fwd * Math.min(Math.abs(s.vx), over * P.followGain) * dt;
    }
    cam.x = U.clamp(cam.x, Math.min(p.camMin, p.camMax), Math.max(p.camMin, p.camMax));
    if (fwd > 0) p.camMin = Math.max(p.camMin, Math.floor(cam.x));
    else p.camMax = Math.min(p.camMax, Math.ceil(cam.x));
    p.minX = cam.x + P.margin;
    p.maxX = Math.min(cam.x + MS.W - P.margin, w.width - P.margin);
  }

  MS.player = { solidsOf: solidsOf, gateOpen: gateOpen, step: step, shots: shots, hurt: hurt, autopilot: autopilot, camera: camera, canonCam: canonCam, floorAt: floorAt, blockedX: blockedX, phys: phys, P: P,
    WEAPONS: WEAPONS, weapon: weapon, drop: drop };
})(typeof window !== 'undefined' ? window : globalThis);
