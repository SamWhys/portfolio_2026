/* METAL SLIDE art: the character rig.
   A paper doll drawn the Metal Slug way: chunky, crouched bodies (knees bent, hips low,
   shoulders hunched, head pushed forward) with big hands and boots, and 3/4-profile heads
   with a nose and a heavy brow. Heads are pixel templates (hair, hats, beards, faces);
   arms and legs are posed from joint angles, or reach for a point. Every material gets a
   4-tone hue-shifted ramp and every body part its own material-tinted outline, so parts
   read clearly over each other. With opts.armed the upper body holds the costume's weapon
   level while the legs run, jump or crouch. Frames are generated on demand and cached.
   Characters face right; the renderer mirrors. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  var C = MS.color;
  var PI = Math.PI, RAD = PI / 180;

  var SW = 64, SH = 62, OX = 24, OY = 60; // sprite canvas; (OX, OY) sits on the ground. The
                                          // extra width on the right is for the machine gun
  var ANKLE = OY - 4;                     // ankle row of a planted foot; soles end on OY-2

  // ------------------------------------------------------------------ colour ramps
  // Each material gets [d2, d1, base, l1, l2]. Shadows lean toward red-brown, highlights
  // toward warm yellow, the way Metal Slug's sprites are shaded.
  function hsl(hex) {
    var c = C.rgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function ch(t) {
      t = ((t % 1) + 1) % 1;
      return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p);
    }
    return C.hex([ch(h + 1 / 3), ch(h), ch(h - 1 / 3)]);
  }
  function toward(h, target, max) {
    var d = ((target - h + 540) % 360) - 180;
    return h + Math.max(-max, Math.min(max, d));
  }
  // Era palettes (the cave has 16 colours, the kingdom 32) collapse the ramps. Skin and
  // deep shadows snap along a warm neutral ladder by brightness, so faces never pick up
  // the palette's reds; highlights that would change hue fold back into the base.
  var ERA = '';
  var LADDER = {
    stone: ['#0b0810', '#1d1420', '#33242c', '#4e3a3a', '#75574a', '#a07a5c', '#d6a77c', '#f2dcb0', '#fff6e0'],
    medieval: ['#000000', '#222034', '#45283c', '#663931', '#8f563b', '#d9a066', '#eec39a']
  };
  function luma(hex) { var c = C.rgb(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function byLuma(hex, list) {
    var y = luma(hex), best = list[0], bd = Infinity;
    for (var i = 0; i < list.length; i++) { var d = Math.abs(luma(list[i]) - y); if (d < bd) { bd = d; best = list[i]; } }
    return best;
  }
  function sameHue(a, b) {
    var p = hsl(a), q = hsl(b);
    if (p[1] < 0.18 || q[1] < 0.18 || p[2] > 0.88 || q[2] > 0.88) return true;
    return Math.abs(((p[0] - q[0] + 540) % 360) - 180) < 40;
  }
  function snapRamp(r, skin) {
    var lad = LADDER[ERA];
    if (!lad || !MS.palette) return r;
    if (skin) return r.map(function (x) { return byLuma(x, lad); });
    var base = MS.palette.snap(r[2], ERA), yb = luma(base);
    var d1 = MS.palette.snap(r[1], ERA);
    if (luma(d1) >= yb || !sameHue(d1, base)) d1 = byLuma(r[1], lad);
    var d2 = byLuma(r[0], lad);
    var l1 = MS.palette.snap(r[3], ERA);
    if (luma(l1) <= yb || !sameHue(l1, base)) l1 = base;
    var l2 = MS.palette.snap(r[4], ERA);
    if (luma(l2) < luma(l1) || !sameHue(l2, base)) l2 = l1;
    return [d2, d1, base, l1, l2];
  }
  var ramps = {}, MAT = {};
  function ramp(hex, skin) {
    hex = String(hex).toLowerCase();
    var key = hex + (skin ? 's' : '') + ERA;
    if (ramps[key]) return ramps[key];
    var q = hsl(hex), h = q[0], s = q[1], l = q[2];
    var r = [
      fromHsl(toward(h, 20, 8), Math.min(1, s * 1.3 + 0.1), l * 0.3),
      fromHsl(toward(h, 20, 4), Math.min(1, s * 1.05), l * 0.64),
      hex,
      fromHsl(toward(h, 55, 10), Math.min(1, s * 1.1), l + (1 - l) * 0.36),
      fromHsl(toward(h, 55, 14), Math.min(1, s * 1.2 + 0.12), l + (1 - l) * 0.64)
    ];
    r = snapRamp(r, skin);
    r.forEach(function (col) { var n = rgbInt(col); if (!MAT[n]) MAT[n] = { base: hex, skin: !!skin }; });
    ramps[key] = r;
    return r;
  }
  // A darker version of a ramp, for the far arm and leg.
  function dim(R, skin) { return ramp(C.mix(R[2], R[1], 0.55), skin); }

  function rgbInt(hex) { var c = C.rgb(hex); return (c[0] << 16) | (c[1] << 8) | c[2]; }
  // Outline colour for a pixel: near-black tinted by its material; skin gets a dark brown.
  var inks = {};
  function inkFor(r, g, b, ink) {
    var n = (r << 16) | (g << 8) | b;
    var tab = inks[ink + ERA] || (inks[ink + ERA] = {});
    if (tab[n]) return tab[n];
    var m = MAT[n], hex = C.hex([r, g, b]);
    var out = m ? (m.skin ? C.mix(ramp(m.base, true)[0], ink, 0.3) : C.mix(ink, m.base, 0.14)) : C.mix(ink, hex, 0.2);
    if (LADDER[ERA]) out = byLuma(out, LADDER[ERA]);
    return (tab[n] = C.rgb(out));
  }
  // Snap a finished frame to the era palette; colours already in it stay exactly as they are.
  var snaps = {};
  function quantize(cv, era) {
    var list = MS.palettes && MS.palettes[era];
    if (!list || !MS.palette) return;
    var g = cv.getContext('2d', { willReadFrequently: true });
    var img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
    var map = snaps[era];
    if (!map) { map = snaps[era] = {}; list.forEach(function (x) { map[rgbInt(x)] = C.rgb(x); }); }
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      var n = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      var c = map[n] || (map[n] = C.rgb(MS.palette.snap(C.hex([d[i], d[i + 1], d[i + 2]]), era)));
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    g.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------------ bodies
  // x values are relative to the torso's left edge (or to OX for hips); rows come from
  // the ground up, so feet stay planted whatever the knees do.
  var BODIES = {
    commando: { thigh: 5, shin: 7, legW: 5, upper: 7, fore: 6, armW: 4, boot: 8, hips: [-3, 3], tuck: true,
      torso: { w: 15, h: 13 }, shs: [5, 8], head: 1, lean: 2, hx: 1,
      stance: { back: [6, -24], front: [38, -10] } },
    // Sam: the commando's arms on a slimmer, longer frame that stands taller, the head
    // stacked over the hips instead of pushed forward. aim lowers his hands by that much
    // when he holds a weapon, so its muzzle stays 23px up while his shoulders sit higher.
    hero: { thigh: 5, shin: 8, legW: 4, upper: 7, fore: 6, armW: 4, boot: 7, hips: [-2, 3], tuck: true,
      torso: { w: 13, h: 14 }, shs: [4, 7], head: 1, lean: 1, hx: 0, aim: 3,
      stance: { back: [4, -14], front: [24, -8] } },
    stout: { thigh: 5, shin: 7, legW: 5, upper: 7, fore: 6, armW: 4, boot: 8, hips: [-3, 3], tuck: true,
      torso: { w: 16, h: 13, belly: 2 }, shs: [5, 9], head: 1, lean: 1, hx: 1,
      stance: { back: [4, -18], front: [30, -8] } },
    normal: { thigh: 5, shin: 7, legW: 4, upper: 6, fore: 6, armW: 4, boot: 7, hips: [-2, 3],
      torso: { w: 13, h: 13 }, shs: [4, 7], head: 0, lean: 1, hx: 1,
      stance: { back: [2, -14], front: [24, -6] } },
    slim: { thigh: 5, shin: 7, legW: 4, upper: 6, fore: 5, armW: 3, boot: 6, hips: [-2, 2],
      torso: { w: 11, h: 13 }, shs: [3, 6], head: -1, lean: 1, hx: 1,
      stance: { back: [2, -12], front: [20, -6] } }
  };
  function legDrop(b, a) { return b.thigh * Math.cos(a[0] * RAD) + b.shin * Math.cos(a[1] * RAD); }

  // ------------------------------------------------------------------ poses
  // Angles in degrees: 0 points down, 90 forward, 180 up, negative is backward.
  // p.reach.front / back = [ref, dx, dy] makes an arm reach for a point instead; ref is
  // 'sh' (its own shoulder), 'fsh' (the front shoulder), 'head' (the skull's top left)
  // or 'hip' (the front hip).
  function basePose(b) {
    return {
      bob: 0, lift: 0, lean: b.lean, hx: b.hx, hy: 0, jx: 0, ujx: 0, seat: 0, air: false,
      legs: { back: b.stance.back.slice(), front: b.stance.front.slice() },
      arms: { back: [6, 24], front: [12, 34] }, reach: {},
      hand: 'fist', backHand: 'fist', item: null, backItem: null, itemFrame: 0, overhead: false,
      face: null, mouth: null, forceFace: false, look: 1, rope: false, smear: null
    };
  }
  function legCycle(p, ph, amp, bend, stance, crouch) {
    crouch = crouch || 0;
    function leg(phi) {
      var th = amp * Math.sin(phi), c = Math.cos(phi);
      var kb = c > 0 ? bend * c : stance * -c;
      return [th + crouch, th - kb - crouch];
    }
    p.legs.front = leg(ph);
    p.legs.back = leg(ph + PI);
  }
  function seat(p) { p.seat = 1; p.legs.back = [84, 2]; p.legs.front = [90, 0]; }
  function squat(p) { p.legs.front = [84, -16]; p.legs.back = [58, -48]; }
  // Arms up: the shoulders rise and the arms reach a little further. Raised arms angle
  // back past the ear, so they cover hair, never the face.
  function overhead(p) { p.shrug = 2; p.stretch = 1; }
  function scream(p, face) { p.face = face || 'pop'; p.mouth = 'scream'; p.forceFace = true; }

  // n frames, timed by fps or per-frame durations d (seconds). Once played, a loop restarts
  // at `from` (so anticipation frames play once and the last pose holds). lower: a legs
  // anim, so with opts.armed the upper body holds the blaster level instead.
  var ANIMS = {
    idle: { n: 6, d: [0.16, 0.12, 0.12, 0.12, 0.12, 0.12], lower: true, f: function (i, p) {
      var br = [0, 0, 1, 1, 1, 0][i];
      p.bob = br;
      if (br) { p.arms.front = [14, 37]; p.arms.back = [8, 26]; }
      if (i === 2 || i === 3) p.mouth = 'breath';
    } },
    talk: { n: 4, d: [0.2, 0.16, 0.2, 0.16], f: function (i, p) {
      p.bob = i % 2;
      if (i === 0) p.arms.front = [26, 70];
      if (i === 1) { p.arms.front = [50, 110]; p.hand = 'flat'; }
      if (i === 2) p.arms.front = [30, 80];
      if (i === 3) { p.arms.front = [18, 50]; p.arms.back = [36, 90]; }
    } },
    walk: { n: 8, fps: 11, lower: true, f: function (i, p) {
      var ph = i / 8 * PI * 2, s = Math.sin(ph);
      legCycle(p, ph, 26, 48, 6, 4);
      p.arms.front = [-24 * s + 6, -24 * s + 40];
      p.arms.back = [24 * s + 6, 24 * s + 40];
    } },
    run: { n: 10, fps: 16, lower: true, f: function (i, p, c, b) {
      var ph = i / 10 * PI * 2, s = Math.sin(ph);
      legCycle(p, ph, 40, 96, 10, 6);
      p.lean = b.lean + 2; p.hx = b.hx + 1;
      p.lift = Math.abs(s) > 0.8 ? 1 : 0;
      p.arms.front = [-36 * s + 30, -36 * s + 112];
      p.arms.back = [36 * s + 30, 36 * s + 112];
    } },
    jump: { n: 3, d: [0.06, 0.08, 0.3], from: 2, lower: true, f: function (i, p) {
      if (i === 0) { squat(p); p.legs.front = [60, -30]; p.legs.back = [36, -40]; p.bob = 1; p.arms.front = [-10, 20]; p.arms.back = [-20, 10]; return; }
      p.air = true;
      if (i === 1) { p.legs.front = [14, 4]; p.legs.back = [-14, -8]; p.arms.front = [150, 170]; p.arms.back = [120, 150]; return; }
      p.legs.front = [84, -24]; p.legs.back = [46, -64];
      p.arms.front = [146, 168]; p.arms.back = [112, 140]; p.hand = 'flat';
    } },
    fall: { n: 2, fps: 8, lower: true, f: function (i, p) {
      p.air = true;
      p.legs.front = [36, 6 - i * 4]; p.legs.back = [-6, -22 + i * 4];
      p.arms.front = [124 + i * 8, 150 + i * 6]; p.arms.back = [104 - i * 6, 132]; p.hand = 'flat';
    } },
    land: { n: 2, d: [0.06, 0.1], from: 1, lower: true, f: function (i, p) {
      if (i === 0) { squat(p); p.bob = 1; p.arms.front = [58, 90]; p.arms.back = [48, 80]; }
      else { p.legs.front = [54, -30]; p.legs.back = [24, -44]; p.arms.front = [30, 60]; p.arms.back = [24, 50]; }
    } },
    crouch: { n: 2, d: [0.5, 0.4], lower: true, f: function (i, p) {
      squat(p); p.bob = i; p.lean += 1;
      p.arms.front = [40, 80]; p.arms.back = [34, 70];
    } },
    aim: { n: 2, d: [0.4, 0.3], lower: true, armed: true, f: function (i, p) { p.bob = i; } },
    shoot: { n: 3, d: [0.05, 0.05, 0.12], from: 2, lower: true, armed: true, f: function (i, p) {
      if (i === 0) p.recoil = 1;
      if (i === 1) p.recoil = 0.5;
    } },
    hurt: { n: 2, d: [0.1, 0.12], lower: true, f: function (i, p, c, b) {
      p.lean = -1; p.hx = b.hx - 1; p.hy = -1 + i; p.jx = -1;
      p.legs.front = [26, -4]; p.legs.back = [-22, -30];
      p.arms.front = [-124 + i * 10, -156 + i * 12]; p.arms.back = [-74, -104]; p.hand = 'flat'; p.backHand = 'flat';
      scream(p, 'pop'); p.mouth = 'shocked';
    } },
    startle: { n: 2, d: [0.05, 0.25], from: 1, f: function (i, p) {
      if (i === 0) { squat(p); p.bob = 2; p.arms.front = [30, 60]; p.arms.back = [24, 50]; scream(p, 'shocked'); p.mouth = 'shocked'; return; }
      p.air = true; p.hy = -1; p.lean = -1; p.hx -= 1;
      p.legs.front = [30, 4]; p.legs.back = [-26, -10];
      p.arms.front = [-116, -150]; p.arms.back = [-94, -132]; p.hand = 'flat'; p.backHand = 'flat';
      scream(p);
    } },
    flee: { n: 8, fps: 12, f: function (i, p, c, b) {
      var ph = i / 8 * PI * 2, s = Math.sin(ph);
      legCycle(p, ph, 30, 70, 6, 4);
      p.lean = b.lean + 3; p.hx = b.hx + 2;
      p.lift = Math.abs(s) > 0.8 ? 1 : 0;
      p.arms.front = [82 + 10 * s, 98 + 12 * s]; p.arms.back = [86 - 10 * s, 104 - 12 * s];
      p.hand = 'flat'; p.backHand = 'flat';
      scream(p);
    } },
    panic: { n: 4, fps: 10, f: function (i, p) {
      p.arms.front = [[190, 214], [94, 106], [196, 226], [100, 116]][i];
      if (i % 2 === 0) overhead(p);
      p.arms.back = [[-110, -140], [-60, -90], [-130, -160], [-80, -110]][i];
      p.legs.front = i % 2 ? [30, -10] : [4, -6]; p.legs.back = i % 2 ? [-6, -10] : [20, -24];
      p.jx = i % 2 ? 1 : 0; p.hand = 'flat'; p.backHand = 'flat';
      p.face = 'pop'; p.mouth = 'scream';
    } },
    laughpoint: { n: 6, d: [0.12, 0.1, 0.12, 0.1, 0.12, 0.1], f: function (i, p, c, b) {
      var back = i === 1 || i === 2 || i === 4;
      p.arms.front = [84, 88]; p.hand = 'point';
      p.reach.back = ['hip', 4, -5]; p.backHand = 'flat';
      p.hy = back ? -1 : 0; p.hx = back ? b.hx - 1 : b.hx; p.bob = i % 2;
      scream(p, 'closed'); p.mouth = back ? 'scream' : 'laugh';
    } },
    cower: { n: 2, fps: 14, f: function (i, p, c, b) {
      squat(p); p.jx = i; p.lean = b.lean + 2; p.hx = b.hx + 1; p.hy = 2; p.bob = 1;
      p.reach.front = ['head', 10, 0]; p.reach.back = ['head', 5, 1]; p.hand = 'flat'; p.backHand = 'flat';
      scream(p, 'closed'); p.mouth = 'shocked';
    } },
    whiteflag: { n: 2, fps: 3, f: function (i, p) {
      p.arms.front = [192, 194]; p.arms.back = [2, 8]; p.lean = 0; overhead(p);
      p.item = 'flag'; p.itemFrame = i; p.bob = i;
      p.face = 'sad'; p.mouth = 'sad';
    } },
    gossip: { n: 12, d: [0.14, 0.11, 0.14, 0.11, 0.2, 0.16, 0.12, 0.11, 0.14, 0.11, 0.2, 0.16], f: function (i, p, c, b) {
      var k = i % 6;
      if (k < 4) {
        p.mouth = k % 2 ? 'talk' : 'neutral';
        if (i < 6) { p.arms.front = k % 2 ? [46, 120] : [24, 74]; p.hand = k % 2 ? 'flat' : 'fist'; }
        else { p.arms.front = [86, 88]; p.hand = 'point'; p.arms.back = k % 2 ? [40, 110] : [22, 60]; p.backHand = 'flat'; }
        p.bob = k % 2;
      } else {
        p.hy = -1; p.hx = b.hx - 1; p.reach.front = ['hip', 5, -4]; p.hand = 'flat';
        p.face = 'closed'; p.mouth = 'laugh'; p.bob = k === 4 ? 0 : 1;
      }
    } },
    work: { n: 4, fps: 5, f: function (i, p, c) {
      seat(p);
      if (c.work === 'chisel') {
        p.lean = 2;
        p.arms.back = [62, 96];
        p.arms.front = i % 2 ? [176, 204] : [74, 108];
        if (i % 2) p.shrug = 1;
        p.item = 'hammer'; p.backItem = 'chisel'; p.face = i % 2 ? 'neutral' : 'closed';
      } else if (c.work === 'quill') {
        p.lean = 2;
        p.arms.front = [58, 96 + (i % 2) * 6]; p.arms.back = [50, 92];
        p.item = 'quill';
      } else {
        p.lean = 2;
        p.arms.back = [46, 88 + (i % 2) * 4];
        p.arms.front = [44, 86 + ((i + 1) % 2) * 5];
      }
    } },
    struggle: { n: 2, fps: 4, f: function (i, p) { seat(p); p.lean = i ? 0 : 2; p.arms.front = [48 + i * 12, 70]; p.arms.back = [40 + i * 12, 64]; p.face = 'angry'; } },
    sit: { n: 2, fps: 1.4, f: function (i, p) { seat(p); p.bob = i; p.arms.front = [40, 78]; p.arms.back = [36, 74]; } },
    salute: { n: 2, d: [0.08, 1], from: 1, f: function (i, p) {
      p.legs.front = [10, -2]; p.legs.back = [-2, -6]; p.lean = 0; p.hx = 0;
      p.arms.back = [-2, 4];
      if (i === 0) { p.arms.front = [104, 170]; p.hand = 'flat'; }
      else { p.reach.front = ['head', 10, 3]; p.hand = 'flat'; }
    } },
    cheer: { n: 2, fps: 4, f: function (i, p) {
      p.arms.front = i ? [190, 198] : [196, 208]; p.arms.back = i ? [160, 172] : [150, 166]; p.lean = 0; p.hy = -1;
      overhead(p);
      p.lift = i ? 1 : 0; p.face = 'happy'; p.mouth = 'laugh';
    } },
    victory: { n: 7, fps: 10, f: function (i, p) {
      var k = [0, 1, 2, 2, 1, 0, 0][i];
      if (i === 0 || i === 6) { squat(p); p.legs.front = [56, -30]; p.legs.back = [30, -40]; }
      p.lift = k; p.lean = 1; p.hx = 0; p.hy = k ? -1 : 0;
      p.arms.front = [192 + k * 2, 196]; p.item = 'blasterUp'; overhead(p);
      p.arms.back = k ? [120, 150] : [40, 100]; p.backHand = 'fist';
      p.face = 'happy'; p.mouth = k ? 'laugh' : 'happy';
    } },
    dance: { n: 4, fps: 5, f: function (i, p) {
      var up = i % 2 === 0;
      p.arms.front = up ? [150, 175] : [40, 120]; p.arms.back = up ? [40, 120] : [150, 175];
      p.legs.front = i < 2 ? [30, -4] : [8, -14]; p.legs.back = i < 2 ? [-6, -24] : [-20, -4]; p.bob = i % 2 ? 0 : -1;
      p.face = 'happy';
    } },
    clap: { n: 2, fps: 6, f: function (i, p) {
      p.reach.front = ['fsh', i ? 7 : 8, 6]; p.reach.back = ['fsh', i ? 5 : 2, 6]; p.hand = 'flat'; p.backHand = 'flat';
      p.face = 'happy';
    } },
    laugh: { n: 2, fps: 5, f: function (i, p, c, b) {
      p.reach.front = ['hip', 5, -4]; p.reach.back = ['hip', 1, -3]; p.bob = i; p.hy = -1; p.hx = b.hx - 1;
      p.face = 'closed'; p.mouth = 'laugh';
    } },
    tremble: { n: 2, fps: 14, f: function (i, p, c, b) {
      p.jx = i; p.legs.front = [30, -16]; p.legs.back = [10, -26]; p.lean = b.lean + 1;
      p.reach.front = ['fsh', 5, 7]; p.reach.back = ['fsh', 3, 8];
    } },
    wave: { n: 2, fps: 4, f: function (i, p) { p.arms.front = [190, i ? 214 : 176]; p.hand = 'flat'; p.lean = 0; overhead(p); } },
    point: { n: 2, fps: 1.5, f: function (i, p) { p.arms.front = [86, 88]; p.hand = 'point'; p.bob = i; } },
    think: { n: 2, fps: 1, f: function (i, p) { p.reach.front = ['head', 11, 12]; p.reach.back = ['fsh', 4, 9]; p.bob = i; p.hy = 1; } },
    bow: { n: 1, fps: 1, f: function (i, p, c, b) { p.lean = b.lean + 3; p.hy = 2; p.hx = b.hx + 2; p.arms.front = [4, 4]; p.face = 'closed'; } },
    nod: { n: 2, fps: 3, f: function (i, p) { p.hy = i; } },
    shrug: { n: 2, d: [0.4, 0.8], f: function (i, p) {
      p.arms.front = [30 + i * 4, 120 + i * 6]; p.arms.back = [26 + i * 4, 112 + i * 6];
      p.bob = -i; p.hand = 'flat'; p.backHand = 'flat'; p.mouth = 'sad';
    } },
    sad: { n: 2, fps: 1, f: function (i, p, c, b) { p.arms.front = [2, 4]; p.arms.back = [-2, 2]; p.hy = 1; p.hx = b.hx + 1; p.bob = 1 + i; p.lean = b.lean + 1; } },
    shocked: { n: 1, fps: 1, f: function (i, p) { p.arms.front = [62, 152]; p.arms.back = [56, 140]; p.lean = 0; p.hand = 'flat'; p.backHand = 'flat'; p.face = 'pop'; p.mouth = 'shocked'; } },
    angry: { n: 2, fps: 8, f: function (i, p) { overhead(p); p.arms.front = [192, 200 + (i ? 10 : 0)]; p.arms.back = [-6, 12]; p.jx = i; p.face = 'angry'; p.mouth = 'angry'; } },
    happy: { n: 2, fps: 3, f: function (i, p) { p.arms.front = [14, 34]; p.arms.back = [10, 30]; p.lift = i; p.face = 'happy'; } },
    hold: { n: 2, fps: 1.5, f: function (i, p) { p.arms.front = [40, 86]; p.item = 'held'; p.bob = i; } },
    facepalm: { n: 1, fps: 1, f: function (i, p) { p.reach.front = ['head', 11, 6]; p.hy = 1; p.hand = 'flat'; p.face = 'closed'; } },
    'throw': { n: 4, d: [0.1, 0.12, 0.1, 0.2], f: function (i, p) {
      if (i === 0) { p.arms.front = [-40, -80]; p.arms.back = [30, 50]; p.bob = 1; p.item = 'slides'; }
      else if (i === 1) { p.arms.front = [-130, -170]; p.arms.back = [44, 70]; p.lean = 0; p.item = 'slides'; }
      else if (i === 2) { p.arms.front = [104, 96]; p.arms.back = [-24, -4]; p.lean = 4; p.hand = 'flat'; }
      else { p.arms.front = [70, 70]; p.arms.back = [-14, 4]; p.lean = 3; p.hand = 'flat'; }
    } },
    itemget: { n: 4, d: [0.08, 0.04, 0.25, 0.25], from: 2, f: function (i, p) {
      if (i === 0) { squat(p); p.legs.front = [56, -30]; p.legs.back = [30, -40]; p.bob = 1; p.arms.front = [20, 40]; p.arms.back = [16, 34]; return; }
      p.arms.front = [192, 196]; p.arms.back = [170, 178]; p.overhead = true; p.hand = 'flat'; p.backHand = 'flat'; p.lean = 0; p.hy = -1;
      overhead(p);
      p.lift = i === 1 ? 2 : i === 2 ? 1 : 0; p.face = 'happy'; p.mouth = 'laugh';
    } },
    tiedStruggle: { n: 8, d: [0.18, 0.18, 0.3, 0.3, 0.24, 0.12, 0.06, 0.06], f: function (i, p, c, b) {
      p.legs.front = [8, -4]; p.legs.back = [-4, -8]; p.lean = 0; p.rope = true;
      p.arms.back = [-30, -10];
      p.hx = [0, 1, 1, 1, 0, -1, 0, 1][i] + b.hx - 1;
      p.look = i === 2 || i === 3 ? -1 : 1;
      var waving = i < 2 || i === 4;
      p.arms.front = i === 0 ? [188, 200] : i === 1 ? [192, 228] : i === 4 ? [186, 210] : [-24, -10];
      p.hand = waving ? 'flat' : 'fist';
      if (waving) overhead(p);
      p.jx = i === 6 ? 1 : i === 7 ? -1 : 0;
      p.face = i === 2 || i === 3 ? 'sad' : 'shocked'; p.mouth = i === 0 || i === 4 ? 'talk' : i > 5 ? 'angry' : 'shocked';
      p.forceFace = true;
    } },
    rummage: { n: 4, d: [1.0, 0.12, 0.12, 0.12], f: function (i, p, c, b) {
      p.reach.front = ['hip', 3, [-1, 0, -2, 0][i]]; p.bob = 1; p.hy = 1; p.hx = b.hx + 1; p.lean = b.lean + 1;
      p.face = i ? 'neutral' : 'closed';
    } },
    yank: { n: 3, d: [0.04, 0.04, 0.6], from: 2, f: function (i, p) {
      p.face = 'happy'; p.mouth = 'laugh'; p.forceFace = true;
      if (i === 0) { p.arms.front = [96, 130]; p.smear = [40, 110]; return; }
      if (i === 1) { p.arms.front = [150, 172]; p.smear = [80, 160]; p.lift = 1; return; }
      p.arms.front = [190, 194]; p.item = 'boxers'; p.hand = 'fist'; p.lean = 0; overhead(p);
    } },
    runOffHolding: { n: 8, fps: 14, f: function (i, p, c, b) {
      var ph = i / 8 * PI * 2, s = Math.sin(ph);
      legCycle(p, ph, 34, 80, 8, 4);
      p.lean = b.lean + 2; p.hx = b.hx + 1; p.lift = Math.abs(s) > 0.8 ? 1 : 0;
      p.reach.back = ['hip', 1, -1];
      p.arms.front = [-44 * s + 26, -44 * s + 116];
      p.face = 'happy'; p.mouth = 'laugh';
    } }
  };
  // A squat by the campfire, a marshmallow on a stick held out over the flames.
  ANIMS.roast = { n: 2, d: [0.6, 0.5], f: function (i, p, c, b) {
    squat(p); p.bob = i; p.lean = b.lean + 1;
    p.arms.front = [60, 100 + i * 4]; p.arms.back = [40, 80]; p.item = 'marshmallow';
  } };
  // The General's battle cry: fists back, chest out, mouth wide.
  ANIMS.yell = { n: 2, fps: 8, f: function (i, p, c, b) {
    p.lean = -1; p.hy = -1; p.hx = b.hx + 1; p.jx = i;
    p.arms.front = [-40, -10]; p.arms.back = [-50, -20];
    scream(p, 'angry');
  } };

  // ------------------------------------------------------------------ heads
  // Template letters: S skin, s skin shadow, z skin deep shadow, L skin light, H hair,
  // h hair shadow, O hair seam, I hair light, J hair glint, A hat, a hat shadow, P hat light, Q hat
  // glint, B hat second colour, G gold, g gold shadow, K near-black, W warm white,
  // E eye, M mouth, m mouth dark, T steel, t steel shadow, X glow, x glow shadow,
  // C cloth, c cloth shadow, D cloth light.
  var SKULL = [
    '...sSSSSS.....',
    '.sSSSSSSSSL...',
    '.sSSSSSSSSSL..',
    'sSSSSSSSSSSSL.',
    'sSSSSSSSSSSSS.',
    'sSSSSSSSSSSSs.',
    'sSSSSSSSSSSSSL',
    'sSSSSSSSSSSSLS',
    'sSSSSSSSSSSSs.',
    'sSSSSSSSSSSSL.',
    '.sSSSSSSSSSS..',
    '.ssSSSSSSSSSL.',
    '..zssSSSSSSs..',
    '....zzzsss....'
  ];
  // Sam's skull: the eyes and mouth sit where SKULL's do, so every expression still fits,
  // but it is a pixel narrower at the back, the jaw runs in a straight line from under the
  // ear to a chin that juts forward, and the cheekbone catches the light. His hair covers
  // the back of it down to the nape, so only the face reads as skin.
  var SKULL_HERO = [
    '....sSSSS......',
    '..sSSSSSSSL....',
    '..sSSSSSSSSL...',
    '.sSSSSSSSSSSL..',
    '.sSSSSSSSSSSS..',
    '.sSSSSSSSSSSs..',
    '.sSSSSSSSSSSSL.',
    '.sSSSSSSSSSSLS.',
    '..sSSSSSSSSLs..',
    '...sSSSSSSSSS..',
    '....sSSSSSSSL..',
    '.....zsSSSSSL..',
    '......zsSSSLL..',
    '........zssz...'
  ];
  var SKULLS = { hero: SKULL_HERO };
  var EARS = { hero: ['.S.', 'SLz', 'sSz', '.s.'] }; // a lit rim round a shadowed hollow, so it reads as an ear
  var EAR = ['.s.', 'sLS', 'sSs', '.z.'];

  var HAIR = {
    none: null,
    spiky: { y: -3, rows: ['..H.HH..H....', '.HHHHHHIHH...', 'HHHHHIJHHHH..', 'HHHHIIHHHHHH.', 'HHHHHHHHHHHHh',
      'HHHHHHHHHhhhh', 'HHHHHHHHh.h..', 'HHHHHh.......', 'HHHHh........', 'HHHh.........', 'HHh..........',
      'Hh...........'] },
    short: { y: -2, rows: ['...HHHHHH....', '.HHIJHHHHHH..', 'HHIIHHHHHHHH.', 'HHHHHHHHHHHHh', 'HHHHHHHHHhhh.',
      'HHHHHHHh.h...', 'HHHHh........', 'HHHh.........', 'HHh..........', 'Hh...........'] },
    messy: { y: -3, rows: ['..H..H.H.....', '..HHHHHHHH...', '.HHHJIHHHHH..', 'HHHIIHHHHHHHH', 'HHHHHHHHHHHHh',
      'HHHHHHHHHhhH.', 'HHHHHh.h..h..', 'HHHHh........', 'HHHHh........', 'HHHh.........', 'HHHh.........',
      'HHh..........', 'HH...........', 'H............'] },
    long: { y: -2, rows: ['...HHHHHH....', '.HHIJHHHHHH..', 'HHIIHHHHHHHH.', 'HHHHHHHHHHHHh', 'HHHHHHHHHHhh.',
      'HHHHHHHhh....', 'HHHHHh.......', 'HHHHh........', 'HHHHh........', 'HHHHh........', 'HHHHh........',
      'HHHHh........', 'HHHh.........', 'HHHh.........', 'HHh..........', '.Hh..........'] },
    bun: { y: -4, rows: ['.HHH.........', 'HJIHH........', 'HHHHHHHHHH...', '.HHIJHHHHHH..', 'HHIIHHHHHHHH.',
      'HHHHHHHHHHHHh', 'HHHHHHHHHhhh.', 'HHHHHHh......', 'HHHHh........', 'HHHh.........', 'HHh..........'] },
    ponytail: { y: -2, x: -3, rows: ['......HHHHHH....', '....HHIJHHHHHH..', '...HHIIHHHHHHHH.', '...HHHHHHHHHHHHh',
      'HHHHHHHHHHHHhhh.', 'HHHHHHHHHHh.....', '.HHHHHHh........', '.HHHHHh.........', '..HHHh..........', '..HHh...........',
      '..Hh............'] },
    curly: { y: -4, x: -1, rows: ['...HHHHHHH....', '.HHHHIJHHHHH..', 'HHHIIHHHHHHHH.', 'HHHHHHHHHHHHHh', 'HHHHHHHHHHHHHh',
      'HHHHHHHHHHHhh.', 'HHHHHHHHh.h...', 'HHHHHh........', 'HHHHHh........', 'HHHHh.........', 'HHHh..........', '.Hh...........'] },
    bald: { y: 4, rows: ['HHh..........', 'HHh..........', 'Hh...........', 'H............'] },
    tonsure: { y: -1, rows: ['....SLLS.....', '..HHSSSSHH...', '.HHHHHHHHHHh.', 'HHHHHHHHHHHh.', 'HHHHh...h....',
      'HHHh.........', 'HHh..........', 'Hh...........'] },
    buzz: { y: -1, rows: ['..hhhhhhh....', '.hHhHhIhHh...', 'hHhHhHhHhHh..', 'hhhhhhhhhh...', 'hhhh.........', 'hhh..........'] },
    bob: { y: -2, rows: ['...HHHHHH....', '.HHIJHHHHHH..', 'HHIIHHHHHHHH.', 'HHHHHHHHHHHHh', 'HHHHHHHHHHhhh',
      'HHHHHHHHh.h..', 'HHHHHh.......', 'HHHHHh.......', 'HHHHHh.......', 'HHHHHh.......', 'HHHHh........', '.HHh.........'] },
    swoop: { y: -3, rows: ['....HHHHH....', '..HHIJIHHHH..', '.HHIIHHHHHHHH', 'HHHHHHHHHHHHH', 'HHHHHHHHHHHHh',
      'HHHHHHHHHhh..', 'HHHHh........', 'HHHh.........', 'HHh..........', 'Hh...........'] },
    // Sam's: parted on top and brushed smooth to each side. A low crown brushed back in one
    // long highlight; the part (O) runs forward and down, cutting off a fringe that curves
    // over the brow like a crescent and ends on the headband (`over` is stamped after the
    // hat). The back of the head is covered down to the nape, with a sideburn by the ear.
    brushed: { y: -3, x: -2, rows: [
      '.....hIJIh.hI...',
      '...hHHIIHHOHIJh.',
      '..hHIHHHHhhOHHI.',
      '..hIHHHHHHHhOHHI',
      '..IHHHHHHHHHhOHI',
      '..hHHHHHHHHHHhHh',
      '................',
      '................',
      '...hHh...h......',
      '...hHh...h......',
      '...hHh..........',
      '...hHh..........',
      '....hh..........'],
      over: { x: 12, y: 3, rows: ['Hh', 'h.'] } },
    // big clumps swept up and back to points, lit along their top edges, with a lock that
    // spills forward over the headband
    swept: { y: -6, x: -3, rows: [
      '......hHIIJ......',
      '....hHHHHIIIH....',
      '..hIIIJhHHHHIIH..',
      '.hIHHHHhOHHHHHIH.',
      'hHHHHhOhHhHHHHHI.',
      '.OhhhOhHHHOHHHHI.',
      '..hIIIJhHHHhHHHI.',
      '.hIHHHHhHHHHOHHI.',
      'hHHHHhhOHHHHHhIh.',
      '.................',
      '.................',
      '...HHHh..........',
      '...HHh...........',
      '...Hh............',
      '...h.............'],
      over: { x: 10, y: 2, rows: ['HIH', '.Hh', '..h'] } }
  };

  var HATS = {
    headband: { y: 3, x: -3, rows: ['...PAAAAAAAAAAAP', '..aAAaaaaaaaaaa.', '.aA.............', 'aA..............', 'a...............'] },
    officer: { y: -6, rows: ['..AAAPPQAA.....', '.AAAAAAPPAAAA..', 'AAAAAAAAAGGAAA.', 'AAAAAAAAAGgAAA.', 'aAAAAAAAAAAAAA.',
      'BBBBBBBBBBBBBB.', '.........KKKKKK', '..........KKK..'] },
    helmet: { y: -4, x: -1, rows: ['....AAAAAA.....', '..AAAAPQQAA....', '.AAAAAAPPPAA...', 'AAAAAAAAAPAAA..', 'aAAAAAAAAAAAAA.',
      'aaaaaaaaaaaaaaa', '....B..........', '....B..........', '.....B.........'] },
    knight: { y: -4, x: -1, rows: ['.....AAA.......', '...AAAAA.......', '..TTTTTTTTT....', '.TTTTTTTWTT...', 'TTTTTTTTTWTTT..',
      'TTTTTTTTTTTTTT.', 'TTTTTTTTTTTTTT.', 'TtTTTTTTTTTTTT.', 'TtTTTTTKKKKKKT.', 'TtTTTTTTTTTTTT.', 'TtTTTTTT.T.T.T.',
      'TtTTTTTTTTTTTT.', 'TttTTTTTTTTTTt.', '.ttTTTTTTTTTt..', '..ttttttttt....'] },
    hood: { y: -3, x: -1, rows: ['....CCCCCC.....', '..CCCCDDCCCC...', '.CCCCCCDDCCCC..', 'CCCCCCCCCCCCCc.', 'CCCCCCCCcc.....',
      'CCCCCCCc.......', 'CCCCCCc........', 'CCCCCCc........', 'CCCCCc.........', 'CCCCCc.........', 'CCCCCc.........',
      'CCCCc..........', 'cCCCc..........', 'ccCCcc.........', '.ccccccc.......'] },
    crown: { y: -6, x: 1, rows: ['G...W...G..', 'GG.GGG.GG..', 'GGGGGGGGGG.', 'GBGGAGGBGG.', 'gggggggggg.'] },
    cap: { y: -3, rows: ['...AAAAAA......', '.AAAAAPQAAA....', 'AAAAAAAPAAAA...', 'AAAAAAAAAAAAa..', 'aaaaaaaaaaaaaaa'] },
    beanie: { y: -4, rows: ['....AAAAA....', '..AAAAPQAAA..', '.AAAAAAPAAAA.', 'AAAAAAAAAAAAA', 'aBaBaBaBaBaBa', 'aaaaaaaaaaaa.'] },
    scarf: { y: -2, x: -1, rows: ['...CCCCCCC....', '.CCCCCDDCCCC..', 'CCCCCCCDCCCCC.', 'CCCCCCCCCCCcc.', 'CCCCCCcc......',
      'CCCCCc........', 'CCCCCc........', 'CCCCc.........', 'CCCCc.........', 'CCCc..........', 'cCCc..........',
      'cccc..........'] },
    headphones: { y: -3, x: 2, rows: ['..KKKKKK..', '.K......K.', 'K.......K.', 'K.........', 'K.........',
      'K.........', 'KA........', 'KAA.......', 'KAP.......', 'KA........'] },
    visor: { y: 4, x: 5, rows: ['KKKKKKKKK', 'XXXXXXWXK', 'xxxxxxxxK'] },
    beret: { y: -3, x: -1, rows: ['....AAAAAAA..', '.AAAAAPQAAAAA', 'AAAAAAAAAAAAa', '.aaaaaaaaaa..'] },
    hardhat: { y: -4, rows: ['....AAAAAA....', '..AAAAPQAAAA..', '.AAAAAAPAAAAA.', 'AAAAAAAAAAAAAA', 'aaaaaaaaaaaaaaa'] }
  };

  var BEARDS = {
    long: { y: 8, rows: ['........HHHHHH', '......HHHHHHHH', '.....HHHHHHHHH', '....HHHHHIHHHh', '....HHHHHHHHH.',
      '.....HHHHHHHh.', '.....HhHHHHHh.', '......HHHHHh..', '......HhHHh...', '.......HHHh...', '.......HhH....',
      '........H.....'] },
    full: { y: 8, rows: ['........HHHHHH', '......HHHHHHHH', '.....HHHHHIHHH', '.....HHHHHHHHh', '......HHHHHHh.', '.......hhhhh..'] },
    handlebar: { y: 8, rows: ['.......H.....H', '.......HHHHHHH', '........HHHHH.'] },
    mustache: { y: 9, rows: ['.........HHHH', '..........hh.'] },
    stubble: { y: 9, rows: ['......h.h.h..', '.....h.h.h.h.', '......h.h.h..'] },
    goatee: { y: 11, rows: ['..........HH.', '..........HH.', '...........h.'] }
  };

  // Faces: [x, y, letter] dots on the skull. B brow, W white, E pupil, s socket shade.
  // Mouths are separate so they can talk.
  var FACES = {
    neutral: [[8, 4, 'B'], [9, 4, 'B'], [10, 4, 'B'], [11, 4, 'B'], [12, 4, 'B'], [9, 5, 'W'], [9, 6, 'W'], [10, 5, 'E'], [10, 6, 'E'], [12, 5, 'E'], [12, 6, 'E']],
    happy: [[8, 4, 'B'], [9, 3, 'B'], [10, 3, 'B'], [11, 4, 'B'], [12, 3, 'B'], [9, 6, 'E'], [10, 5, 'E'], [11, 6, 'E'], [12, 5, 'E']],
    angry: [[8, 3, 'B'], [9, 3, 'B'], [10, 4, 'B'], [11, 5, 'B'], [12, 5, 'B'], [9, 6, 'W'], [10, 6, 'E'], [12, 6, 'E']],
    shocked: [[8, 2, 'B'], [9, 2, 'B'], [10, 2, 'B'], [12, 3, 'B'], [9, 4, 'W'], [10, 4, 'W'], [9, 5, 'W'], [10, 5, 'E'], [9, 6, 'W'], [10, 6, 'W'], [12, 5, 'E']],
    pop: [[8, 1, 'B'], [9, 1, 'B'], [10, 1, 'B'], [12, 2, 'B'], [9, 3, 'W'], [10, 3, 'W'], [9, 4, 'W'], [10, 4, 'E'], [9, 5, 'W'], [10, 5, 'E'], [9, 6, 'W'], [10, 6, 'W'],
      [12, 4, 'W'], [12, 5, 'E'], [12, 6, 'W']],
    sad: [[8, 4, 'B'], [9, 4, 'B'], [10, 3, 'B'], [11, 3, 'B'], [9, 6, 'W'], [10, 6, 'E'], [12, 6, 'E']],
    closed: [[8, 4, 'B'], [9, 4, 'B'], [10, 4, 'B'], [11, 4, 'B'], [12, 4, 'B'], [9, 6, 'E'], [10, 6, 'E'], [12, 6, 'E']]
  };
  var MOUTHS = {
    neutral: [[10, 10], [11, 10]],
    breath: [[10, 10], [11, 10, 'm']],
    talk: [[10, 10], [11, 10], [10, 11, 'm'], [11, 11, 'm']],
    happy: [[9, 9], [10, 10], [11, 10], [12, 9]],
    laugh: [[9, 9], [10, 9, 'W'], [11, 9, 'W'], [12, 9], [9, 10, 'm'], [10, 10, 'm'], [11, 10, 'm'], [12, 10, 'm'], [10, 11, 'M'], [11, 11, 'm']],
    angry: [[9, 10], [10, 10, 'W'], [11, 10, 'W'], [12, 10]],
    shocked: [[10, 10], [11, 10], [10, 11], [11, 11]],
    sad: [[9, 11], [10, 10], [11, 10], [12, 11]],
    scream: [[9, 9, 'W'], [10, 9, 'W'], [11, 9, 'W'], [12, 9, 'W'], [9, 10, 'm'], [10, 10, 'm'], [11, 10, 'm'], [12, 10, 'm'],
      [9, 11, 'm'], [10, 11, 'M'], [11, 11, 'M'], [12, 11, 'm'], [10, 12, 'm'], [11, 12, 'm']]
  };

  // ------------------------------------------------------------------ items
  // Pixel items. o in the template is where the hand grips (hand centre).
  var ITEMS = {
    // The spec blaster: a chunky stylus with a pen-nib emitter that glows cyan.
    blaster: { o: [4, 6], tip: [11, 3], rows: [
      '....kk......',
      '.llllllll...',
      'ObbbbbbbcNn.',
      'ObbOObbbcNNX',
      '.dddddddcNn.',
      '...gg.......',
      '...gg.......'] },
    flag: { rows: [] },
    slides: { o: [2, 4], rows: ['.WWWWW', 'ROOOOW', 'RWkkWW', 'RWWWWW', '.RRRR.'] },
    boxers: { rows: [
      'llllllllllllll',
      'vvvvvvvvvvvvvv',
      'uUluUluUluUluU',
      'uUluUlpUluUluU',
      'uUluUluUluUluU',
      'uUluUlpUluUluU',
      'uUluUl..luUluU',
      'uUluU....UluUl',
      'uUluU....UluUl',
      'vvvvv....vvvvv'] }
  };
  var ITEM_PAL = {
    k: '#2a2a34', l: '#f8f8e8', b: '#d8d2c2', d: '#8a8272', O: '#ff7a2a', c: '#2fb8d0', N: '#b8bec8', n: '#6a7080',
    X: '#7ff4ff', g: '#4a4452', W: '#f8f0dc', R: '#b8402a', u: '#2a4a98', U: '#3a6ac8', v: '#b8c4dc', p: '#e85a8a'
  };
  function rot90(rows) { // a quarter turn counter-clockwise: the tip points up
    var h = rows.length, w = rows[0].length, out = [];
    for (var x = w - 1; x >= 0; x--) {
      var s = '';
      for (var y = 0; y < h; y++) s += rows[y][x];
      out.push(s);
    }
    return out;
  }
  ITEMS.blasterUp = { o: [6, 12 - 4], tip: [3, 0], rows: rot90(ITEMS.blaster.rows) };

  // ------------------------------------------------------------------ weapons
  // One per mission, named by the costume's `weapon`: a slingshot in the cave, a bow in the
  // kingdom, a pistol in the city, a machine gun at the siege and a laser in the future.
  // Guns are held in both fists like the spec blaster (hold 'two'); the slingshot and the
  // bow are held out in the far fist while the near fist draws the band or the string back
  // (hold 'draw'). o: the grip (hand centre); tip: the muzzle; tips: where the string or
  // band is tied; out and pull: where the far and near fists go, from the near shoulder.
  // Muzzles sit 23px above the feet, where the blaster's did (the slingshot's, held up at
  // the shoulder, at 27). player.js WEAPONS repeats these points; tools/arsenal.html checks.
  var WOOD = { a: '#2e1a0e', b: '#55331c', c: '#82532e', d: '#b07c48', e: '#d8a86a' };
  var STEEL = { a: '#16161c', b: '#2c2e36', c: '#4a4c58', d: '#727684', e: '#a8acb8', f: '#dfe2ea', O: '#c4501c', P: '#ff8a34' };
  function pal(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }
  var WEAPONS = {
    // a forked stick and rubber bands; it lobs a pebble
    sling: { hold: 'draw', o: [4, 8], tips: [[0, 1], [8, 1]], tip: [4, 3], out: [10, 1], pull: [2, -3],
      band: '#3a2418', pal: WOOD, rows: [
        'de.....de',
        'cd.....cd',
        'cd.....cd',
        '.cd...cd.',
        '.bcd.dcb.',
        '..bcdcb..',
        '...bcd...',
        '...bcd...',
        '...bcd...',
        '...bcd...',
        '...abb...'] },
    // a recurve bow with a red leather grip; it shoots suction-cup arrows
    bow: { hold: 'draw', o: [3, 10], tips: [[1, 0], [0, 20]], tip: [6, 10], out: [9, 0], pull: [3, 1],
      band: '#f2ead2', pal: pal(WOOD, { r: '#5e1a12', R: '#9c2a1c' }), rows: [
        '.e...',
        'ce...',
        '.ce..',
        '.cd..',
        '..cd.',
        '..cd.',
        '..bcd',
        '..bcd',
        '..bcd',
        '..RRd',
        '..rRd',
        '..RRd',
        '..bcd',
        '..bcd',
        '..bcd',
        '..bd.',
        '..bd.',
        '.bd..',
        '.bd..',
        'bc...',
        '.b...'] },
    // a chunky cartoon pistol with an orange safety tip
    pistol: { hold: 'two', o: [3, 4], tip: [11, 1], pal: STEEL, rows: [
      'bdeeeeeeeefP',
      'bcddddddddOP',
      'abbbbbbbbbaa',
      '.abcc.a.....',
      '.abcca......',
      '.abca.......',
      '.aaa........'] },
    // a belt-fed machine gun with the siege's hi-vis stripe on the receiver and the ammo box
    mgun: { hold: 'two', o: [8, 7], tip: [24, 4], pal: pal(STEEL, { Y: '#d8ff3a', y: '#7e9a14' }), rows: [
      '........bbbbbb...........',
      '........b....b...........',
      '..bbccddeeeeeeeeb........',
      'bbcccYYYcccccccccdddddd..',
      'bcccbyyybbbbbbbbcefefefOP',
      'abbbbbbbbbbbbbbbcdddddddO',
      '.aaa...abcabYYYYa.aaaaaa.',
      '.......abcabyyyyb........',
      '.......abcabccccb........',
      '.......aaa.abbbba........'] },
    // a white and mint laser with a glowing emitter
    laser: { hold: 'two', o: [5, 6], tip: [19, 3], pal: { a: '#2e3444', b: '#7a8498', c: '#b8c0d0', d: '#e2e7f0', e: '#ffffff', g: '#1e8a5e', m: '#8affc0', n: '#e0fff0' }, rows: [
      '......gmmmg.........',
      '..bccdddddddddca....',
      '.bcdeeeeeeeeeedcbcc.',
      'bcdddddddddmmmmdcbmn',
      'bccccccccccggggcbbmn',
      '.bbbbbbbbbbbbbbbabm.',
      '..abbca..abbba.aaa..',
      '...abca...aba.......',
      '...abca.............',
      '...aaba.............'] }
  };
  // Held up in a victory pose, guns turn upright. A bow or a slingshot held high reads as
  // antlers, so those eras punch the air instead.
  function rotPt(pt, w) { return [pt[1], w - 1 - pt[0]]; }
  Object.keys(WEAPONS).forEach(function (k) {
    var W = WEAPONS[k], w = W.rows[0].length;
    W.weapon = k;
    ITEMS[k] = W;
    if (W.hold !== 'draw') ITEMS[k + 'Up'] = { weapon: k, pal: W.pal, o: rotPt(W.o, w), tip: rotPt(W.tip, w), rows: rot90(W.rows) };
  });

  // ------------------------------------------------------------------ drawing helpers
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  var layerPool = [];
  function layer() {
    var c = layerPool.pop() || canvas(SW, SH);
    var g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, SW, SH);
    g.imageSmoothingEnabled = false;
    return g;
  }
  function release(g) { layerPool.push(g.canvas); }

  // Stamps a pixel template. slope tilts it: column x moves (x - pivot) * slope rows.
  function stamp(g, tpl, x0, y0, pal, slope, pivot) {
    if (!tpl) return;
    var rows = tpl.rows || tpl;
    var ox = x0 + (tpl.x || 0), oy = y0 + (tpl.y || 0);
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.' || !pal[ch]) continue;
        g.fillStyle = pal[ch];
        g.fillRect(ox + x, oy + y + (slope ? Math.round((x - (pivot || 0)) * slope) : 0), 1, 1);
      }
    }
  }
  function dot(g, x, y, col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

  function seg(g, x0, y0, x1, y1, w, col) {
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2));
    g.fillStyle = col;
    var h = (w - 1) / 2;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      g.fillRect(Math.round(x0 + (x1 - x0) * t - h), Math.round(y0 + (y1 - y0) * t - h), w, w);
    }
  }
  // The perpendicular pointing away from the light (top front).
  function shadowSide(r) {
    var px = Math.cos(r), py = -Math.sin(r);
    return (px * 0.45 + py * -0.9) > 0 ? [-px, -py] : [px, py];
  }
  function edge(g, x0, y0, x1, y1, n, k, col) {
    seg(g, x0 + n[0] * k, y0 + n[1] * k, x1 + n[0] * k, y1 + n[1] * k, 1, col);
  }
  // Two-segment limb, shaded: a shadow edge away from the light, a lit edge toward it,
  // a crease at the joint. R1, R2: ramps of the two segments. Returns joint positions.
  function limb(g, x, y, a1, l1, a2, l2, w, R1, R2, glint) {
    var r1 = a1 * RAD, r2 = a2 * RAD;
    var ex = x + Math.sin(r1) * l1, ey = y + Math.cos(r1) * l1;
    var hx = ex + Math.sin(r2) * l2, hy = ey + Math.cos(r2) * l2;
    seg(g, x, y, ex, ey, w, R1[2]);
    seg(g, ex, ey, hx, hy, w, R2[2]);
    if (w >= 3) {
      var k = (w - 1) / 2;
      var p1 = shadowSide(r1), p2 = shadowSide(r2);
      edge(g, x, y, ex, ey, [-p1[0], -p1[1]], k, R1[3]);
      edge(g, ex, ey, hx, hy, [-p2[0], -p2[1]], k, R2[3]);
      edge(g, x, y, ex, ey, p1, k, R1[1]);
      edge(g, ex, ey, hx, hy, p2, k, R2[1]);
      if (w >= 6) { edge(g, x, y, ex, ey, p1, k - 1, R1[1]); edge(g, ex, ey, hx, hy, p2, k - 1, R2[1]); }
      // a crease at the joint, and a glint where it bends toward the light
      var cx = Math.round(ex + (p1[0] + p2[0]) * 0.5 * k), cy = Math.round(ey + (p1[1] + p2[1]) * 0.5 * k);
      if (Math.abs(a1 - a2) > 30) dot(g, cx, cy, R2[0]);
      if (glint) {
        var gx = Math.round(ex - (p1[0] + p2[0]) * 0.5 * k), gy = Math.round(ey - (p1[1] + p2[1]) * 0.5 * k);
        dot(g, gx, gy, R1[4]);
      }
    }
    return { ex: ex, ey: ey, hx: hx, hy: hy, r1: r1, r2: r2 };
  }
  // Two-bone reach: the angles that put the hand on (tx, ty); the elbow bends down.
  function ik(sx, sy, tx, ty, l1, l2) {
    var dx = tx - sx, dy = ty - sy;
    var d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.sqrt(dx * dx + dy * dy)));
    var th = Math.atan2(dx, dy);
    var al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    var a1 = th - al;
    var ex = sx + Math.sin(a1) * l1, ey = sy + Math.cos(a1) * l1;
    return [a1 / RAD, Math.atan2(tx - ex, ty - ey) / RAD];
  }

  // Each part gets a dark outline tinted by the material next to it.
  function outline(g, ink) {
    var img = g.getImageData(0, 0, SW, SH), d = img.data;
    var out = new Uint8ClampedArray(d);
    var row = SW * 4;
    for (var y = 0; y < SH; y++) for (var x = 0; x < SW; x++) {
      var i = (y * SW + x) * 4;
      if (d[i + 3] > 0) continue;
      var n = -1;
      if (x > 0 && d[i - 1] > 0) n = i - 4;
      else if (x < SW - 1 && d[i + 7] > 0) n = i + 4;
      else if (y > 0 && d[i - row + 3] > 0) n = i - row;
      else if (y < SH - 1 && d[i + row + 3] > 0) n = i + row;
      if (n < 0) continue;
      var o = inkFor(d[n], d[n + 1], d[n + 2], ink);
      out[i] = o[0]; out[i + 1] = o[1]; out[i + 2] = o[2]; out[i + 3] = 255;
    }
    img.data.set(out);
    g.putImageData(img, 0, 0);
  }

  // A scratch layer. Layers stay in CPU memory (willReadFrequently), because copying
  // between a GPU canvas and a CPU one costs far more than drawing the sprite.
  var shearTmp = null;
  function tmp() {
    if (!shearTmp) { shearTmp = canvas(SW, SH); shearTmp.getContext('2d', { willReadFrequently: true }); }
    return shearTmp.getContext('2d');
  }
  // Leans the top of a layer forward: row yTop moves by amt, row yBot stays put.
  function shear(g, yTop, yBot, amt) {
    if (!amt) return;
    var t = tmp();
    t.clearRect(0, 0, SW, SH);
    t.drawImage(g.canvas, 0, 0);
    g.clearRect(0, 0, SW, yBot);
    for (var y = 0; y < yBot; y++) {
      var off = y <= yTop ? amt : Math.round(amt * (yBot - y) / (yBot - yTop));
      g.drawImage(shearTmp, 0, y, SW, 1, off, y, SW, 1);
    }
  }
  function mirror(g, cx) {
    var t = tmp();
    t.clearRect(0, 0, SW, SH);
    t.drawImage(g.canvas, 0, 0);
    g.clearRect(0, 0, SW, SH);
    g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); g.drawImage(shearTmp, 0, 0); g.restore();
  }

  // ------------------------------------------------------------------ costume colours
  function paletteFor(c) {
    var skin = c.skin || '#d29a6c';
    var hair = (c.hair && c.hair.color) || '#4a3020';
    var hat = (c.hat && c.hat.color) || '#b8302a';
    var cloth = (c.hat && c.hat.cloth) || (c.hat && c.hat.color) || '#7a5a3a';
    var beard = (c.beard && c.beard.color) || hair;
    var glow = (c.hat && c.hat.glow) || '#7ff4ff';
    var Sk = ramp(skin, true), Hr = ramp(hair), Ht = ramp(hat), Cl = ramp(cloth), Bd = ramp(beard);
    return {
      skin: Sk, S: Sk[2], s: Sk[1], z: Sk[0], L: Sk[3],
      H: Hr[2], h: Hr[1], I: Hr[3], J: Hr[4], O: Hr[0],
      A: Ht[2], a: Ht[1], P: Ht[3], Q: Ht[4], B: (c.hat && c.hat.color2) || Ht[0],
      G: '#f0c848', g: '#a8782a', K: '#1c1a24', W: '#f8f8e8', E: '#1a1418', M: '#8a3a2e', m: '#3a1212',
      T: '#c8ccd6', t: '#868a96', X: glow, x: C.shade(glow, -0.35),
      C: Cl[2], c: Cl[1], D: Cl[3], beard: { H: Bd[2], h: Bd[1], I: Bd[3] }
    };
  }

  // ------------------------------------------------------------------ parts
  function drawHead(g, c, pal, x, y, face, mouth) {
    var hairStyle = c.hair ? c.hair.style : 'short';
    var hat = c.hat ? c.hat.style : null;
    var coversHead = hat === 'knight' || hat === 'hood' || hat === 'scarf';
    stamp(g, SKULLS[c.head] || SKULL, x, y, pal);
    stamp(g, EARS[c.head] || EAR, x + 4, y + 5, pal);
    if (!coversHead) stamp(g, HAIR[hairStyle] || null, x, y, pal);
    var F = FACES[face] || FACES.neutral;
    var bald = !c.hair || hairStyle === 'bald' || hairStyle === 'none';
    var fp = { B: bald ? pal.z : pal.h, W: pal.W, E: pal.E, s: pal.s };
    var lift = c.eyes === 'glasses' ? 1 : 0; // brows sit above the frames
    F.forEach(function (f) { dot(g, x + f[0], y + f[1] - (f[2] === 'B' ? lift : 0), fp[f[2]]); });
    if (face !== 'pop' && face !== 'shocked') dot(g, x + 11, y + 5, pal.s); // the brow's shadow
    var beard = c.beard ? BEARDS[c.beard.style] : null;
    var big = mouth === 'scream' || mouth === 'laugh';
    var hidesMouth = beard && (c.beard.style === 'long' || c.beard.style === 'full') && !big;
    if (beard) stamp(g, beard, x, y + (big && c.beard.style !== 'stubble' ? 1 : 0), pal.beard);
    var M = MOUTHS[mouth] || MOUTHS.neutral;
    if (!hidesMouth || mouth === 'talk') {
      M.forEach(function (m) { dot(g, x + m[0], y + m[1], m[2] === 'W' ? pal.W : m[2] === 'm' ? pal.m : m[2] === 'M' ? '#c85a5a' : pal.M); });
    }
    if (c.eyes === 'glasses') {
      var k = '#34303e';
      [[9, 4], [10, 4], [8, 5], [8, 6], [11, 5], [11, 6], [9, 7], [10, 7], [12, 5], [6, 5], [7, 5]].forEach(function (p) { dot(g, x + p[0], y + p[1], k); });
      dot(g, x + 9, y + 5, '#c8e8ff');
    } else if (c.eyes === 'shades' && c.lens) {
      // tinted lenses shaped to sit under a headband: a near lens with a rounded
      // bottom, a bridge, a sliver of the far lens, a thin arm back to the ear, a glint
      var lens = c.lens, deep = C.shade(lens, -0.5);
      rect(g, x + 6, y + 5, 2, 1, pal.K); dot(g, x + 11, y + 5, pal.K);
      rect(g, x + 8, y + 5, 3, 1, lens); rect(g, x + 8, y + 6, 3, 1, deep); rect(g, x + 9, y + 7, 2, 1, deep);
      rect(g, x + 12, y + 5, 2, 1, lens); rect(g, x + 12, y + 6, 2, 1, deep);
      dot(g, x + 9, y + 5, c.glint || '#ffffff'); dot(g, x + 8, y + 6, C.mix(lens, c.glint || '#ffffff', 0.5)); dot(g, x + 13, y + 5, C.mix(lens, c.glint || '#ffffff', 0.5));
    } else if (c.eyes === 'shades') {
      rect(g, x + 7, y + 4, 7, 3, pal.K); dot(g, x + 8, y + 4, '#8a9ab0'); dot(g, x + 9, y + 4, '#5a6a80'); rect(g, x + 4, y + 5, 3, 1, pal.K);
    }
    if (hat && HATS[hat]) stamp(g, HATS[hat], x, y, pal);
    var lock = !coversHead && HAIR[hairStyle] && HAIR[hairStyle].over;
    if (lock) stamp(g, lock, x, y, pal);
    if (c.headset) {
      // a radio earpiece over the ear, its boom mic along the cheek
      var Hs = ramp(c.headset);
      [[5, 4], [5, 3]].forEach(function (q) { dot(g, x + q[0], y + q[1], Hs[1]); }); // the band, lost in the hair above
      rect(g, x + 4, y + 5, 3, 3, Hs[2]); rect(g, x + 4, y + 5, 3, 1, Hs[3]); dot(g, x + 4, y + 7, Hs[1]);
      dot(g, x + 7, y + 8, Hs[1]); dot(g, x + 8, y + 9, Hs[1]); dot(g, x + 9, y + 9, Hs[3]);
    }
  }

  // Torso by costume style. x, y: top-left of the torso box (before the hunch).
  function drawTorso(g, c, pal, b, x, y) {
    var T = b.torso, w = T.w, h = T.h;
    var top = c.top || {};
    var style = top.style || 'tee';
    var R = ramp(top.color || '#6a6a6a');
    var skin = pal.skin;
    rect(g, x + 2, y, w - 4, 1, R[2]);
    rect(g, x + 1, y + 1, w - 2, 1, R[2]);
    rect(g, x, y + 2, w, h - 2, R[2]);
    if (T.belly) {
      rect(g, x + w, y + 4, T.belly, h - 6, R[2]); rect(g, x + w + T.belly, y + 6, 1, h - 10, R[2]);
      rect(g, x + w + T.belly - 1, y + 5, 1, 3, R[3]);
    }
    // form: the back in shadow, shoulder tops and the chest front catch the light
    rect(g, x, y + 2, 2, h - 2, R[1]); dot(g, x + 1, y + 1, R[1]);
    rect(g, x + Math.floor(w / 2), y, Math.ceil(w / 2) - 2, 1, R[3]);
    rect(g, x + w - 1, y + 2, 1, h - 6, R[3]);
    var creases = true;
    var cx = x + w - 4; // the front of the chest
    if (style === 'vest') {
      var U = ramp(top.under || '#2a2a30');
      rect(g, x + w - 6, y, 5, 9, U[2]); rect(g, x + w - 6, y, 1, 9, U[1]); rect(g, x + w - 2, y + 1, 1, 7, U[3]);
      rect(g, x + w - 5, y, 3, 1, skin[1]);
      rect(g, x + w - 1, y + 2, 1, h - 6, R[3]);
      rect(g, x + w - 7, y + 1, 1, h - 3, R[1]);
      // pockets with flaps
      rect(g, x + 3, y + 4, 4, 3, R[1]); rect(g, x + 3, y + 4, 4, 1, R[0]); dot(g, x + 5, y + 5, R[3]);
      rect(g, x + 3, y + 8, 4, 3, R[1]); rect(g, x + 3, y + 8, 4, 1, R[0]); dot(g, x + 5, y + 9, R[3]);
      rect(g, x + w - 6, y + 9, 5, 1, R[0]);
      creases = false;
    } else if (style === 'uniform') {
      rect(g, x + 2, y, w - 5, 2, R[1]); rect(g, x + w - 5, y, 3, 2, R[3]);
      for (var by = y + 3; by < y + h - 3; by += 3) dot(g, cx + 2, by, '#f0c848');
      rect(g, cx - 4, y + 4, 4, 3, R[1]); rect(g, cx - 4, y + 4, 4, 1, R[0]);
      if (top.medals) {
        ['#c83a3a', '#3a6ac8', '#f0c848'].forEach(function (m, i) { dot(g, x + 5 + i, y + 4, m); dot(g, x + 5 + i, y + 5, '#f0c848'); });
      }
      if (top.sash) drawSash(g, top.sash, x, y, w, h);
      rect(g, x + w - 5, y, 4, 1, '#f0c848');
    } else if (style === 'rags') {
      [[3, 4], [7, 7], [4, 10], [8, 3]].forEach(function (p) { if (p[0] < w - 1) { dot(g, x + p[0], y + p[1], skin[1]); dot(g, x + p[0] + 1, y + p[1], skin[2]); } });
      for (var rx = 0; rx < w; rx += 2) { dot(g, x + rx, y + h - 1, R[1]); dot(g, x + rx + 1, y + h, R[2]); }
      rect(g, x + w - 5, y, 3, 2, skin[2]);
      creases = false;
    } else if (style === 'robe' || style === 'tunic') {
      rect(g, x + w - 5, y, 3, 2, R[0]);
      var Bl = ramp(top.belt || '#c8a864');
      rect(g, x, y + h - 4, w, 2, Bl[2]); rect(g, x, y + h - 4, w, 1, Bl[3]); dot(g, x + w - 3, y + h - 4, Bl[1]);
    } else if (style === 'armor') {
      var A2 = ramp(top.color2 || '#c83a3a');
      rect(g, x + 2, y + 2, w - 4, h - 4, A2[2]); rect(g, x + 2, y + 2, 2, h - 4, A2[1]); rect(g, x + w - 3, y + 3, 1, h - 6, A2[3]);
      rect(g, x + 5, y + 5, 3, 4, '#f0c848'); dot(g, x + 6, y + 5, '#fff6c0');
      rect(g, x + 1, y, w - 2, 2, R[3]); dot(g, x + w - 4, y, R[4]);
      creases = false;
    } else if (style === 'hoodie') {
      rect(g, x, y, 4, 3, R[1]);
      rect(g, x + 3, y + h - 6, w - 4, 3, R[1]); rect(g, x + 3, y + h - 6, w - 4, 1, R[0]);
      dot(g, x + w - 4, y + 2, '#f0f0f0'); dot(g, x + w - 4, y + 3, '#f0f0f0');
    } else if (style === 'blazer') {
      var Sh = ramp(top.under || '#f0ece4');
      rect(g, x + w - 5, y, 4, 7, Sh[2]); rect(g, x + w - 5, y, 1, 7, Sh[1]);
      dot(g, x + w - 6, y + 1, R[1]); dot(g, x + w - 5, y + 3, R[0]); dot(g, x + w - 6, y + 5, R[1]);
      if (top.tie) rect(g, x + w - 3, y + 1, 1, 6, top.tie);
      dot(g, x + w - 2, y + 9, R[0]);
    } else if (style === 'shirt') {
      rect(g, x + w - 6, y, 4, 2, top.collar || '#f8f8e8');
      if (top.tie) rect(g, x + w - 4, y + 2, 1, h - 6, top.tie);
      else for (var bb = y + 3; bb < y + h - 3; bb += 3) dot(g, x + w - 3, bb, R[0]);
    } else if (style === 'turtleneck') {
      rect(g, x + w - 7, y - 1, 6, 2, R[2]);
      rect(g, x + w - 7, y, 6, 1, R[1]); dot(g, x + w - 3, y - 1, R[3]);
    } else if (style === 'jumpsuit') {
      var glow = top.glow || '#7ff4ff';
      rect(g, x + w - 3, y + 1, 1, h - 2, glow);
      rect(g, x, y + h - 4, w, 1, glow);
      rect(g, x + 2, y + 3, 3, 1, C.shade(glow, -0.3));
    } else if (style === 'coat') {
      rect(g, x + w - 4, y, 3, h - 2, top.under || '#e8e4f0');
      rect(g, x + w - 5, y, 1, h, R[1]);
      if (top.glow) rect(g, x + w - 5, y + 2, 1, h - 4, top.glow);
    } else if (style === 'hawaiian') {
      var f = ramp(top.color2 || '#ffe14a');
      [[2, 2], [6, 4], [3, 8], [8, 9], [10, 3], [5, 12], [9, 13], [12, 6], [13, 11]].forEach(function (p) {
        if (p[0] < w - 1 && p[1] < h) { dot(g, x + p[0], y + p[1], f[2]); dot(g, x + p[0] + 1, y + p[1], f[1]); dot(g, x + p[0], y + p[1] - 1, f[3]); }
      });
      rect(g, x + w - 5, y, 3, 3, skin[2]); dot(g, x + w - 5, y + 2, skin[1]);
      creases = false;
    } else if (style === 'apron') {
      var Ap = ramp(top.color2 || '#c8b090');
      rect(g, x + w - 7, y + 3, 6, h - 3, Ap[2]); rect(g, x + w - 7, y + 3, 6, 1, Ap[1]); rect(g, x + w - 2, y + 4, 1, h - 5, Ap[3]);
    } else if (style === 'tank') {
      rect(g, x + w - 5, y, 3, 2, skin[2]);
    } else {
      rect(g, x + w - 5, y, 3, 1, skin[2]);
    }
    if (creases) {
      // cloth folds from the armpit toward the belt
      dot(g, x + w - 6, y + 7, R[1]); dot(g, x + w - 5, y + 8, R[1]);
      dot(g, x + w - 8, y + 9, R[1]); dot(g, x + w - 7, y + 10, R[1]);
    }
    // optional kit over any style (the uniform draws its own sash above)
    if (top.sash && style !== 'uniform') drawSash(g, top.sash, x, y, w, h);
    if (top.stripe) {
      // a reflective band round the chest, in shadow at the back
      rect(g, x, y + 6, w, 1, top.stripe); rect(g, x, y + 7, w, 1, '#c8ccd6');
      rect(g, x, y + 6, 2, 2, C.shade(top.stripe, -0.3));
    }
    if (c.lanyard) {
      // a strap from the back of the neck down to an ID badge on the chest
      var Ly = ramp(c.lanyard);
      [[w - 7, 0], [w - 7, 1], [w - 8, 2], [w - 8, 3]].forEach(function (q) { dot(g, x + q[0], y + q[1], Ly[2]); });
      rect(g, x + w - 10, y + 4, 3, 4, '#f4f4f0'); rect(g, x + w - 10, y + 4, 3, 1, Ly[2]); dot(g, x + w - 9, y + 6, '#5a6a8a');
      dot(g, x + w - 10, y + 7, '#c8ccd6');
    }
    if (c.belt) {
      var Bt = ramp(c.belt);
      rect(g, x, y + h - 2, w + (T.belly || 0), 2, Bt[2]); rect(g, x, y + h - 2, w + (T.belly || 0), 1, Bt[3]);
      rect(g, x + w - 4 + (T.belly || 0), y + h - 2, 2, 2, '#e0c060'); dot(g, x + w - 4 + (T.belly || 0), y + h - 2, '#fff0a0');
      if (c.pouches) {
        [x + 1, x + 5].forEach(function (px) {
          rect(g, px, y + h - 3, 3, 3, Bt[1]); rect(g, px, y + h - 3, 3, 1, Bt[3]); dot(g, px + 1, y + h - 2, Bt[0]);
        });
      }
    }
  }

  // Kit that carries each era's ammo (costume `gear`), hung off the belt over the hips.
  function drawGear(g, c, b, x, y) {
    var w = b.torso.w, h = b.torso.h, R;
    if (c.gear === 'pouch') {
      // a leather pouch for the slingshot's pebbles, one peeking out of the flap
      R = ramp('#7a5236');
      rect(g, x + w - 9, y + h - 1, 4, 4, R[2]); rect(g, x + w - 9, y + h - 1, 1, 4, R[1]); rect(g, x + w - 6, y + h, 1, 3, R[3]);
      rect(g, x + w - 9, y + h - 1, 4, 1, R[0]);
      dot(g, x + w - 8, y + h - 2, '#e8e0d0'); dot(g, x + w - 7, y + h - 2, '#b8a890');
    } else if (c.gear === 'holster') {
      // the pistol's holster on the hip, its grip showing
      R = ramp('#2a2a30');
      rect(g, x + 3, y + h - 1, 3, 5, R[2]); rect(g, x + 3, y + h - 1, 1, 5, R[1]); rect(g, x + 5, y + h, 1, 3, R[3]);
      rect(g, x + 3, y + h - 3, 2, 2, '#4a4c58'); dot(g, x + 4, y + h - 3, '#727684');
    }
  }

  // A sash from the back shoulder down to the front hip.
  function drawSash(g, col, x, y, w, h) {
    var Sa = ramp(col);
    for (var s = 0; s < h - 3; s++) {
      var sx = x + 1 + Math.round(s * (w - 3) / (h - 3));
      dot(g, sx, y + 1 + s, Sa[2]); dot(g, sx + 1, y + 1 + s, Sa[3]); dot(g, sx - 1, y + 2 + s, Sa[1]);
    }
  }

  // Backpack (and bedroll) on the upper back.
  function drawPack(g, c, x, y) {
    var R = ramp(c.pack);
    rect(g, x + 1, y, 5, 1, R[2]);
    rect(g, x, y + 1, 6, 9, R[2]);
    rect(g, x, y + 1, 2, 9, R[1]); rect(g, x + 5, y + 1, 1, 8, R[3]); rect(g, x + 1, y, 3, 1, R[3]);
    rect(g, x + 1, y + 4, 5, 1, R[0]); rect(g, x + 1, y + 3, 5, 1, R[1]);
    dot(g, x + 3, y + 5, '#c8b070');
    rect(g, x - 1, y + 6, 2, 4, R[1]); dot(g, x - 1, y + 6, R[2]);
    rect(g, x, y + 9, 6, 1, R[0]);
    if (c.quiver) {
      // a quiver across the back, red-fletched arrows poking up past the shoulder
      var Qv = ramp(c.quiver);
      seg(g, x + 1, y - 2, x + 3, y + 8, 3, Qv[2]);
      seg(g, x, y - 2, x + 2, y + 8, 1, Qv[1]);
      rect(g, x, y - 2, 4, 1, Qv[3]);
      [[0, -5], [2, -6], [4, -5]].forEach(function (a) {
        dot(g, x + a[0], y + a[1], '#d0342c'); dot(g, x + a[0], y + a[1] + 1, '#f4f0e6'); dot(g, x + a[0], y + a[1] + 2, '#b07c48');
      });
    }
    if (c.cell) {
      // the laser's power cell clipped to the pack, glowing
      rect(g, x + 1, y + 5, 4, 4, '#1e8a5e'); rect(g, x + 2, y + 6, 2, 2, c.cell); dot(g, x + 2, y + 6, '#e0fff0');
    }
    if (c.roll) {
      var Q = ramp(c.roll);
      rect(g, x - 1, y - 3, 8, 3, Q[2]); rect(g, x - 1, y - 3, 8, 1, Q[3]); rect(g, x - 1, y - 1, 8, 1, Q[1]);
      dot(g, x + 6, y - 3, Q[4]);
      rect(g, x - 1, y - 2, 1, 1, Q[0]); dot(g, x + 2, y - 3, R[0]); dot(g, x + 2, y - 2, R[0]); dot(g, x + 2, y - 1, R[0]);
    }
  }

  // Robes, tunics, coats and dresses hang over the legs.
  function drawSkirt(g, c, b, x, y, pose) {
    var top = c.top || {};
    var kind = top.skirt;
    if (!kind) return;
    var R = ramp(top.skirtColor || top.color || '#6a5a4a');
    var T = b.torso;
    var y0 = y + T.h - 2;
    var len = kind === 'long' ? 13 : kind === 'knee' ? 9 : 5;
    var sway = Math.round((pose.legs.front[0] - pose.legs.back[0]) / 22);
    for (var i = 0; i < len; i++) {
      var spread = Math.floor(i / 3);
      var x0 = x - spread + (i > 3 ? Math.min(0, sway) : 0);
      var x1 = x + T.w + spread + (i > 3 ? Math.max(0, sway) : 0);
      rect(g, x0, y0 + i, x1 - x0, 1, R[2]);
      rect(g, x0, y0 + i, 2, 1, R[1]); dot(g, x1 - 1, y0 + i, R[3]);
      if (i > 2 && i % 4 === 1) dot(g, Math.round((x0 + x1) / 2), y0 + i, R[1]);
    }
    if (top.trim) rect(g, x - Math.floor((len - 1) / 3), y0 + len - 1, T.w + 2 * Math.floor((len - 1) / 3), 1, top.trim);
  }

  function drawLeg(g, c, b, hx, hy, ang, pal, dark, plant) {
    var pants = (c.pants && c.pants.color) || '#5a5a6a';
    var style = c.pants && c.pants.style;
    var Pn = ramp(pants), Sk = pal.skin;
    var R1 = style === 'bare' ? Sk : Pn, R2 = style === 'shorts' || style === 'bare' ? Sk : Pn;
    if (dark) { R1 = dim(R1, R1 === Sk); R2 = dim(R2, R2 === Sk); }
    var j = limb(g, hx, hy, ang[0], b.thigh, ang[1], b.shin, b.legW, R1, R2, !dark);
    var ax = Math.round(j.hx), ay = Math.round(j.hy);
    if (plant && Math.abs(ay - ANKLE) <= 2 && ay !== ANKLE) { seg(g, ax, ay, ax, ANKLE, b.legW, R2[2]); ay = ANKLE; }
    if (c.pants && c.pants.pads) {
      // knee pads, the lit edge toward the front
      var Kp = ramp(c.pants.pads);
      if (dark) Kp = dim(Kp);
      var kx0 = Math.round(j.ex) - 1, ky0 = Math.round(j.ey) - 1;
      rect(g, kx0, ky0, 4, 3, Kp[2]); rect(g, kx0, ky0, 4, 1, Kp[3]); rect(g, kx0, ky0 + 2, 4, 1, Kp[1]); dot(g, kx0 + 3, ky0 + 1, Kp[3]);
    }
    var bw = b.boot;
    if (c.shoes && c.shoes.style === 'bare') {
      var F = dark ? dim(Sk, true) : Sk;
      rect(g, ax - 2, ay, 5, 2, F[2]); rect(g, ax - 2, ay + 2, 6, 1, F[1]); dot(g, ax + 2, ay + 1, F[3]); dot(g, ax + 3, ay + 1, F[2]);
      dot(g, ax - 2, ay, F[1]);
      return { ax: ax, ay: ay };
    }
    var S = ramp((c.shoes && c.shoes.color) || '#4a3428');
    if (dark) S = dim(S);
    var tall = c.shoes && c.shoes.tall && style !== 'shorts' && style !== 'bare';
    var top = null;
    if (tall) {
      // a tall shaft up the shin, so the trousers tuck in high and blouse over it
      var kx = j.ex - j.hx, ky = j.ey - j.hy, kl = Math.sqrt(kx * kx + ky * ky) || 1, n = 3;
      kx /= kl; ky /= kl;
      var sx2 = ax + kx * n, sy2 = ay - 1 + ky * n, pk = shadowSide(j.r2), kk = (b.legW - 1) / 2;
      seg(g, ax, ay - 1, sx2, sy2, b.legW, S[2]);
      edge(g, ax, ay - 1, sx2, sy2, pk, kk, S[1]);
      edge(g, ax, ay - 1, sx2, sy2, [-pk[0], -pk[1]], kk, S[3]);
      top = [Math.round(ax + kx * (n + 1)), Math.round(ay - 1 + ky * (n + 1))];
    }
    // an 8x4 boot: shaft, toe cap with a highlight, a dark sole and a lace dot
    rect(g, ax - 2, ay - 1, 5, 1, S[2]);
    rect(g, ax - 2, ay, bw - 2, 1, S[2]);
    rect(g, ax - 2, ay + 1, bw, 1, S[2]);
    rect(g, ax - 2, ay + 2, bw, 1, S[0]);
    rect(g, ax - 2, ay - 1, 1, 3, S[1]);
    dot(g, ax + bw - 4, ay, S[3]); dot(g, ax + bw - 3, ay + 1, S[3]); dot(g, ax + bw - 4, ay + 1, S[4]);
    dot(g, ax + 1, ay, S[1]);
    if (top) {
      // the trousers puff over the boot top, with the fold's shadow on the boot below
      var bx = top[0] - Math.floor(b.legW / 2) - 1;
      rect(g, bx, top[1], b.legW + 2, 1, R2[2]); dot(g, bx, top[1], R2[1]); dot(g, bx + b.legW + 1, top[1], R2[3]);
      rect(g, bx + 1, top[1] + 1, b.legW, 1, c.pants && c.pants.cuff ? (dark ? C.shade(c.pants.cuff, -0.3) : c.pants.cuff) : S[0]);
    } else if (b.tuck && style !== 'shorts' && style !== 'bare') {
      // trousers bloused over the boot tops
      rect(g, ax - 3, ay - 2, b.legW + 2, 1, R2[2]); dot(g, ax - 3, ay - 2, R2[1]); dot(g, ax + b.legW - 2, ay - 2, R2[3]);
    }
    if (c.pants && c.pants.cuff && !top) rect(g, ax - 2, ay - 2, b.legW + 1, 1, c.pants.cuff);
    if (c.shoes && c.shoes.glow) rect(g, ax - 2, ay + 2, bw, 1, dark ? C.shade(c.shoes.glow, -0.35) : c.shoes.glow); // lit soles
    return { ax: ax, ay: ay };
  }

  function drawHand(g, x, y, R, kind, r2, dark) {
    if (kind === 'flat') {
      rect(g, x - 1, y - 1, 5, 3, R[2]); rect(g, x - 1, y - 1, 5, 1, R[3]); rect(g, x, y + 2, 3, 1, R[1]);
      dot(g, x + 3, y + 1, R[1]);
      return;
    }
    rect(g, x - 1, y - 1, 4, 4, R[2]);
    rect(g, x - 1, y - 1, 4, 1, R[3]); dot(g, x + 2, y - 1, dark ? R[3] : R[4]);
    rect(g, x - 1, y + 2, 4, 1, R[1]); dot(g, x - 1, y + 1, R[1]);
    dot(g, x + 1, y + 1, R[1]);
    if (kind === 'point') {
      var dx = Math.sin(r2), dy = Math.cos(r2);
      for (var k = 3; k <= 4; k++) dot(g, Math.round(x + 0.5 + dx * k), Math.round(y + 0.5 + dy * k), R[2]);
    }
  }

  function drawArm(g, c, b, sx, sy, ang, pal, dark, front, p, items) {
    var sleeve = c.sleeves || 'short';
    var Sk = pal.skin;
    var Cl = ramp((c.top && (c.top.sleeve || c.top.color)) || '#6a6a6a');
    var U = sleeve === 'bare' || sleeve === 'cut' || sleeve === 'none' ? Sk : Cl;
    var F = sleeve === 'long' ? Cl : Sk;
    var Hd = c.gloves ? ramp(c.gloves) : Sk;
    if (dark) { U = dim(U, U === Sk); F = dim(F, F === Sk); Hd = dim(Hd, Hd === Sk); }
    var j = limb(g, sx, sy, ang[0], b.upper, ang[1], b.fore, b.armW, U, F, front);
    if (sleeve === 'short') {
      // the sleeve ends halfway down the upper arm
      seg(g, sx, sy, sx + Math.sin(j.r1) * 3, sy + Math.cos(j.r1) * 3, b.armW, Cl[dark ? 1 : 2]);
      var r = j.r1;
      dot(g, Math.round(sx + Math.sin(r) * 3), Math.round(sy + Math.cos(r) * 3 + 1), Cl[dark ? 0 : 1]);
    }
    if (sleeve === 'cut') {
      var V = ramp((c.top && c.top.color) || '#5f7a3a');
      if (dark) V = dim(V);
      rect(g, Math.round(sx) - 2, Math.round(sy) - 1, 4, 3, V[2]); rect(g, Math.round(sx) - 1, Math.round(sy) - 1, 3, 1, V[3]);
      dot(g, Math.round(sx) - 2, Math.round(sy) + 1, V[1]);
    }
    var ux = Math.sin(j.r1), uy = Math.cos(j.r1), fx = Math.sin(j.r2), fy = Math.cos(j.r2);
    if (c.top && c.top.stripe) {
      // a reflective band round the upper arm
      var sk = (b.armW - 1) / 2, bx = sx + ux * 4, by = sy + uy * 4;
      seg(g, bx - uy * sk, by + ux * sk, bx + uy * sk, by - ux * sk, 1, dark ? C.shade(c.top.stripe, -0.3) : c.top.stripe);
    }
    if (c.bracers) {
      // leather guards on the forearm, up from the wrist
      var Bc = ramp(c.bracers);
      if (dark) Bc = dim(Bc);
      var f0 = b.fore - 4, f1 = b.fore - 1, pk = shadowSide(j.r2), kk = (b.armW - 1) / 2;
      var bx0 = j.ex + fx * f0, by0 = j.ey + fy * f0, bx1 = j.ex + fx * f1, by1 = j.ey + fy * f1;
      seg(g, bx0, by0, bx1, by1, b.armW, Bc[2]);
      edge(g, bx0, by0, bx1, by1, [-pk[0], -pk[1]], kk, Bc[3]);
      edge(g, bx0, by0, bx1, by1, pk, kk, Bc[1]);
      dot(g, Math.round(j.ex + fx * (f0 + 1.5)), Math.round(j.ey + fy * (f0 + 1.5)), Bc[0]); // the lacing
    }
    var hx = Math.round(j.hx), hy = Math.round(j.hy);
    if (items) items(g, hx, hy, j.r2, 'under');
    drawHand(g, hx, hy, Hd, front ? p.hand : p.backHand, j.r2, dark);
    if (c.gloves && !dark) { dot(g, hx + 2, hy, Sk[2]); dot(g, hx + 2, hy + 1, Sk[1]); }
    if (items) items(g, hx, hy, j.r2, 'over');
    return { hx: hx, hy: hy, r2: j.r2 };
  }

  // Returns the muzzle point for a weapon (and, for the bow and slingshot, where the string
  // or band is tied).
  function drawItem(g, kind, hx, hy, r2, phase, p) {
    if (!kind) return null;
    var tpl = ITEMS[kind];
    if (kind === 'blaster' || kind === 'blasterUp' || (tpl && tpl.weapon)) {
      if (phase !== 'under') return null;
      var slope = tpl.hold === 'draw' ? 0 : p.gunSlope || 0;
      var x0 = hx - tpl.o[0] + 1, y0 = hy - tpl.o[1] + 1;
      stamp(g, tpl.rows, x0, y0, tpl.pal || ITEM_PAL, slope, tpl.o[0]);
      var m = { x: x0 + tpl.tip[0], y: y0 + tpl.tip[1] + Math.round((tpl.tip[0] - tpl.o[0]) * slope) };
      if (tpl.tips) m.tips = tpl.tips.map(function (t) { return [x0 + t[0], y0 + t[1]]; });
      return m;
    }
    if (kind === 'slides') {
      if (phase === 'over') stamp(g, tpl.rows, hx - 2, hy - 4, ITEM_PAL);
      return null;
    }
    if (kind === 'flag') {
      if (phase === 'under') {
        seg(g, hx + 1, hy + 4, hx + 1, hy - 12, 1, '#8a5a30'); dot(g, hx + 1, hy - 13, '#f0c848');
        var wv = p.itemFrame % 2;
        for (var fx = 0; fx < 8; fx++) {
          var dy = wv ? Math.round(Math.sin(fx * 0.9) * 1) : Math.round(Math.sin(fx * 0.9 + 1.6) * 1);
          rect(g, hx + 2 + fx, hy - 12 + dy, 1, 5, fx % 3 === 2 ? '#d8d8c8' : '#f8f8e8');
          dot(g, hx + 2 + fx, hy - 8 + dy, '#b8b8a8');
        }
      }
      return null;
    }
    if (kind === 'boxers') {
      // giant striped boxer shorts, shown off overhead
      if (phase === 'over') stamp(g, tpl.rows, hx - 6, hy - 11, ITEM_PAL);
      return null;
    }
    if (kind === 'boxes') {
      // a cardboard box carried in front of the chest
      if (phase === 'over') {
        var Bx = ramp('#c8945a');
        rect(g, hx - 4, hy - 7, 9, 7, Bx[2]); rect(g, hx - 4, hy - 7, 9, 1, Bx[3]); rect(g, hx - 4, hy - 6, 2, 6, Bx[1]);
        rect(g, hx, hy - 7, 1, 7, '#e8d8a8'); dot(g, hx + 3, hy - 5, Bx[1]); dot(g, hx + 2, hy - 3, Bx[1]);
      }
      return null;
    }
    if (kind === 'stamp') {
      // a rubber stamp gripped by its knob, its inked face out along the forearm
      var sdx = Math.sin(r2), sdy = Math.cos(r2), spx = -sdy, spy = sdx;
      if (phase === 'under') {
        seg(g, hx + sdx, hy + sdy, hx + sdx * 3, hy + sdy * 3, 2, '#d8902a');
        dot(g, Math.round(hx + sdx * 2 + spx), Math.round(hy + sdy * 2 + spy), '#ffd36a');
      } else {
        var bx0 = hx + sdx * 4, by0 = hy + sdy * 4;
        seg(g, bx0 - spx * 3, by0 - spy * 3, bx0 + spx * 3, by0 + spy * 3, 1, '#f4f2fa');
        seg(g, bx0 + sdx - spx * 3, by0 + sdy - spy * 3, bx0 + sdx + spx * 3, by0 + sdy + spy * 3, 1, '#c8c0e0');
        seg(g, bx0 + sdx * 2 - spx * 2, by0 + sdy * 2 - spy * 2, bx0 + sdx * 2 + spx * 2, by0 + sdy * 2 + spy * 2, 1, '#1e9a58');
      }
      return null;
    }
    if (kind === 'arcube') {
      // a tiny AR product preview hovering over the open palm
      if (phase === 'over') {
        var cx0 = hx + 1, cy0 = hy - 9;
        rect(g, cx0 - 2, cy0 - 1, 5, 4, '#5ae0f0'); rect(g, cx0 + 3, cy0 - 1, 1, 4, '#2aa8c8');
        rect(g, cx0 - 1, cy0 - 2, 5, 1, '#d8fcff'); dot(g, cx0 - 2, cy0 - 1, '#d8fcff');
        dot(g, cx0, cy0, '#ffffff'); dot(g, cx0 + 1, cy0 + 4, '#7ff4ff'); dot(g, cx0 + 1, cy0 + 6, '#7ff4ff');
      }
      return null;
    }
    if (phase !== 'under') return null;
    if (kind === 'coffee') {
      rect(g, hx - 1, hy - 5, 4, 5, '#f8f8e8'); rect(g, hx - 1, hy - 5, 1, 5, '#c8c4b4'); rect(g, hx, hy - 5, 3, 1, '#6a4026');
      dot(g, hx + 3, hy - 4, '#c8c4b4'); dot(g, hx + 1, hy - 3, '#d9542a');
    } else if (kind === 'smoothie') {
      // a domed cup of green smoothie with a pink straw
      seg(g, hx + 2, hy - 7, hx + 3, hy - 10, 1, '#ff6aa8');
      rect(g, hx - 1, hy - 7, 5, 1, '#e8ffff');
      rect(g, hx - 1, hy - 6, 5, 6, '#8ad86a'); rect(g, hx - 1, hy - 6, 1, 6, '#5aa848'); dot(g, hx + 2, hy - 5, '#c8f8a8');
    } else if (kind === 'marshmallow') {
      var mx = hx + Math.sin(r2) * 8, my = hy + Math.cos(r2) * 8;
      seg(g, hx, hy, mx, my, 1, '#8a5a30');
      rect(g, Math.round(mx) - 1, Math.round(my) - 1, 3, 3, '#f8f8e8'); dot(g, Math.round(mx) + 1, Math.round(my) + 1, '#c8945a');
    } else if (kind === 'hammer') {
      seg(g, hx, hy, hx + Math.sin(r2) * 6, hy + Math.cos(r2) * 6, 1, '#8a5a30');
      var tx = Math.round(hx + Math.sin(r2) * 6), ty = Math.round(hy + Math.cos(r2) * 6);
      rect(g, tx - 1, ty - 1, 3, 3, '#8a8e96'); dot(g, tx - 1, ty - 1, '#e0e4ea');
    } else if (kind === 'chisel') {
      seg(g, hx, hy, hx + Math.sin(r2) * 5, hy + Math.cos(r2) * 5, 1, '#aab0b8');
    } else if (kind === 'quill') {
      seg(g, hx, hy, hx + 3, hy - 5, 1, '#f8f8e8'); dot(g, hx + 2, hy - 4, '#d8d0c0'); dot(g, hx + 3, hy - 6, '#f8f8e8');
    } else if (kind === 'clicker') {
      rect(g, hx - 1, hy - 3, 3, 4, '#22222a'); dot(g, hx, hy - 3, '#ff3030'); dot(g, hx + 1, hy - 2, '#5a5a6a');
    } else if (kind === 'held' || kind === 'tablet') {
      rect(g, hx - 1, hy - 5, 7, 6, '#2a2a34'); rect(g, hx, hy - 4, 5, 4, '#7ff4ff'); dot(g, hx + 4, hy - 4, '#e8ffff');
    } else if (kind === 'clipboard') {
      rect(g, hx - 1, hy - 5, 5, 6, '#8a5a30'); rect(g, hx, hy - 4, 3, 4, '#f6f2ea');
    } else if (kind === 'sword') {
      seg(g, hx, hy, hx + Math.sin(r2) * 11, hy + Math.cos(r2) * 11, 1, '#e0e4ec');
      rect(g, hx - 1, hy - 1, 4, 1, '#f0c848');
    }
    return null;
  }

  // A pale whoosh arc around the shoulder (dithered, so it survives the 16-colour palettes).
  function drawSmear(g, sx, sy, a0, a1, rad) {
    for (var a = a0; a <= a1; a += 4) {
      for (var k = 0; k < 2; k++) {
        var x = Math.round(sx + Math.sin(a * RAD) * (rad - k)), y = Math.round(sy + Math.cos(a * RAD) * (rad - k));
        if ((x + y) % 2 === 0) dot(g, x, y, '#f8f8e8');
      }
    }
  }

  function drawChain(g, ax, ay) {
    var bx = ax - 9, by = OY - 4;
    for (var i = 1; i < 4; i++) dot(g, Math.round(ax - i * 2.2), Math.round(ay + 1 + i * 0.4), i % 2 ? '#8a8e96' : '#5a5e66');
    rect(g, bx - 1, by - 1, 5, 4, '#3a3c44'); rect(g, bx, by - 2, 3, 1, '#3a3c44');
    dot(g, bx, by - 1, '#8a8e96'); dot(g, bx + 1, by - 1, '#6a6e76');
  }

  function drawPost(g, x, top) {
    var R = ramp('#7a5232');
    rect(g, x, top, 5, OY - 1 - top, R[2]);
    rect(g, x, top, 1, OY - 1 - top, R[1]); rect(g, x + 3, top, 1, OY - 1 - top, R[3]); rect(g, x + 4, top, 1, OY - 1 - top, R[1]);
    for (var y = top + 3; y < OY - 2; y += 5) dot(g, x + 2, y, R[0]);
    rect(g, x, top, 5, 1, R[4]);
  }

  // Rope wound round the chest and legs: light, dark, light bands.
  function drawRope(g, x, w, ty, hipY) {
    var R = ramp('#c8b090');
    [[ty + 4, 3], [hipY + 4, 2]].forEach(function (band) {
      var y = band[0];
      rect(g, x - 1, y, w + 2, 1, R[3]);
      if (band[1] > 2) rect(g, x - 1, y + 1, w + 2, 1, R[0]);
      rect(g, x - 1, y + band[1] - 1, w + 2, 1, R[3]);
      for (var k = 1; k < w; k += 3) dot(g, x + k, y, R[2]);
    });
    dot(g, x - 2, ty + 7, R[2]); dot(g, x - 2, ty + 8, R[3]); dot(g, x - 3, ty + 9, R[2]);
  }

  // ------------------------------------------------------------------ assembly
  var cache = {};

  function poseFor(anim, i, c, b) {
    var def = ANIMS[anim] || ANIMS.idle;
    var p = basePose(b);
    def.f(((i % def.n) + def.n) % def.n, p, c, b);
    return p;
  }

  // Frame index at time t, honouring per-frame durations; after one pass a loop restarts
  // at `from`, so anticipation frames play once.
  function frameIndex(anim, t) {
    var def = ANIMS[anim] || ANIMS.idle;
    t = Math.max(0, t || 0);
    if (!def.d) {
      var k = Math.floor(t * def.fps);
      var from = def.from || 0;
      return k < def.n ? k : from + (k - from) % (def.n - from);
    }
    var total = 0, i;
    for (i = 0; i < def.n; i++) total += def.d[i];
    if (t >= total) {
      var f0 = def.from || 0, loop = 0;
      for (i = f0; i < def.n; i++) loop += def.d[i];
      var pre = total - loop;
      t = pre + ((t - pre) % loop);
    }
    for (i = 0; i < def.n; i++) { t -= def.d[i]; if (t < 0) return i; }
    return def.n - 1;
  }

  // The bow's arrow or the slingshot's pebble, loaded in the near fist. Returns the muzzle.
  function nock(g, kind, at, hx, hy) {
    if (kind === 'bow') {
      // a suction-cup arrow from the near fist to just past the bow: fletching, shaft, red cup
      seg(g, hx - 2, hy, at.x, at.y, 1, '#b07c48');
      dot(g, hx - 3, hy - 1, '#d0342c'); dot(g, hx - 3, hy + 1, '#d0342c'); dot(g, hx - 2, hy - 1, '#f4f0e6');
      rect(g, at.x + 1, at.y - 1, 1, 3, '#c62a2a'); dot(g, at.x + 2, at.y, '#ff7a68'); dot(g, at.x + 1, at.y - 1, '#ff7a68');
      return { x: at.x + 2, y: at.y };
    }
    // a pebble in the pouch
    rect(g, hx + 2, hy - 1, 2, 2, '#e8e0d0'); dot(g, hx + 3, hy - 1, '#ffffff');
    return { x: at.x, y: at.y };
  }
  // The bowstring or the slingshot's bands, from where they're tied to the near fist (drawn)
  // or slack. Drawn after the outlines: a string inked on both sides would read as a rope.
  function strings(g, kind, at, band, fh, drawn) {
    var a = at.tips[0], b = at.tips[1], px = fh.hx - 1, py = fh.hy;
    if (kind === 'bow') {
      if (drawn) { seg(g, a[0], a[1], px, py, 1, band); seg(g, px, py, b[0], b[1], 1, band); }
      else seg(g, a[0], a[1], b[0], b[1], 1, band);
      return;
    }
    if (!drawn) { px = at.x - 2; py = at.y + 1; }
    seg(g, b[0], b[1], px, py, 1, C.shade(band, -0.25));
    seg(g, a[0], a[1], px, py, 1, band);
  }

  // The full sprite for one frame. opts: { expr, talking, chained, tied, era, armed, upper, blink, held, squash }
  // upper: 'recoil' | 'aim' | { anim, i } (that anim's arms over this anim's legs).
  function frame(id, c, anim, i, opts) {
    opts = opts || {};
    c = c || {};
    var up = opts.upper && typeof opts.upper === 'object' ? opts.upper : null;
    var upKey = up ? up.anim + ':' + (up.i || 0) : (opts.upper || '');
    var key = [id, anim, i, opts.expr || '', opts.talking ? 1 : 0, opts.chained ? 1 : 0, opts.tied ? 1 : 0, opts.era || '',
      opts.armed ? 1 : 0, upKey, opts.blink ? 1 : 0, opts.held || '', opts.squash || 0].join('|');
    if (cache[key]) return cache[key];
    ERA = opts.era && LADDER[opts.era] ? opts.era : '';
    var b = BODIES[c.body] || BODIES.normal;
    var def = ANIMS[anim] || ANIMS.idle;
    var p = poseFor(anim, i, c, b);
    if (up && ANIMS[up.anim]) {
      var q = poseFor(up.anim, up.i || 0, c, b);
      ['arms', 'reach', 'hand', 'backHand', 'item', 'backItem', 'itemFrame', 'overhead', 'hy', 'face', 'mouth', 'smear'].forEach(function (k) { p[k] = q[k]; });
    }
    var armed = !!(opts.armed || def.armed || opts.upper === 'aim' || opts.upper === 'recoil');
    var weapon = c.weapon && WEAPONS[c.weapon] ? c.weapon : 'blaster', Wp = WEAPONS[weapon];
    if (armed && (def.lower || def.armed)) {
      var rec = opts.upper === 'recoil' ? 1 : p.recoil || 0;
      var aim = b.aim || 0;
      if (Wp && Wp.hold === 'draw') {
        // held out in the far fist; the near fist draws back to the chest and lets go on a shot
        p.reach = { front: ['fsh', Wp.pull[0] + rec * 3, Wp.pull[1] + aim], back: ['fsh', Wp.out[0], Wp.out[1] + aim] };
        p.backItem = weapon; p.item = null; p.nock = !rec;
      } else {
        p.reach = { front: ['sh', 6 - rec, 3 + aim - Math.round(rec * 2)], back: ['fsh', 8 - rec, 4 + aim - rec] };
        p.item = weapon;
        p.gunSlope = rec ? -0.33 * rec : 0;
        if (rec >= 1) p.ujx = -1;
        if (def === ANIMS.idle && (i === 3)) p.gunDy = -1;
      }
      p.hand = 'fist'; p.backHand = 'fist';
    } else if (armed && !p.item) {
      p.item = weapon;
    }
    if (p.item === 'blasterUp') p.item = ITEMS[weapon + 'Up'] ? weapon + 'Up' : null;
    if (opts.held) p.item = opts.held;
    if (opts.squash) p.bob += opts.squash;

    var expr = opts.expr || null;
    var face = (p.forceFace && p.face) || expr || p.face || c.expr || 'neutral';
    var mouth = opts.talking ? (face === 'happy' ? 'happy' : 'talk') :
      (p.forceFace && p.mouth) || (expr ? (MOUTHS[expr] ? expr : 'neutral') : p.mouth || 'neutral');
    if (opts.blink && face !== 'pop' && face !== 'closed') face = 'closed';

    var pal = paletteFor(c);
    var ink = c.ink || '#140c12';
    var lx = p.jx;
    var hipY = p.air ? ANKLE - (b.thigh + b.shin) + 1 : Math.round(ANKLE - Math.max(legDrop(b, p.legs.back), legDrop(b, p.legs.front)));
    hipY -= p.lift;
    var T = b.torso;
    var tx = OX - Math.floor(T.w / 2) + lx;
    var ty = hipY + 2 - T.h + p.bob;
    var lean = p.lean, ujx = p.ujx || 0;
    var shY = ty + 2 - (p.shrug || 0);
    var shB = [tx + b.shs[0] + lean + ujx, shY], shF = [tx + b.shs[1] + lean + ujx, shY];
    var headX = tx + b.head + lean + p.hx + ujx, headY = ty - 13 + p.hy;
    var hipF = [OX + b.hips[1] + lx, hipY];
    function target(spec, sh) {
      var ref = spec[0] === 'head' ? [headX, headY] : spec[0] === 'hip' ? hipF : spec[0] === 'fsh' ? shF : sh;
      return [ref[0] + spec[1], ref[1] + spec[2]];
    }
    var ba = b;
    if (p.stretch) { // arms thrown overhead reach a little further, so fists clear the head
      ba = {};
      for (var bk in b) ba[bk] = b[bk];
      ba.upper += p.stretch; ba.fore += p.stretch;
    }
    function armAng(which, sh) {
      var spec = p.reach[which];
      if (!spec) return p.arms[which];
      var t = target(spec, sh);
      return ik(sh[0], sh[1], t[0], t[1], ba.upper, ba.fore);
    }
    var parts = [];
    var muzzle = null, fh = null;

    var gBackArm = layer();
    var held = null; // a bow or slingshot held out in the far fist
    var backHand = drawArm(gBackArm, c, ba, shB[0], shB[1], armAng('back', shB), pal, true, false, p, function (g, hx, hy, r2, phase) {
      if (p.backItem) { var m = drawItem(g, p.backItem, hx, hy, r2, phase, p); if (m && m.tips) held = m; }
    });
    parts.push(gBackArm);

    if (opts.tied) {
      var gPost = layer();
      drawPost(gPost, tx - 3, headY - 4);
      parts.push(gPost);
    }

    if (c.pack) {
      var gPack = layer();
      drawPack(gPack, c, tx - 5 + Math.round(lean * 0.7) + ujx, ty + 1);
      parts.push(gPack);
    }

    var gBackLeg = layer();
    var bl = drawLeg(gBackLeg, c, b, OX + b.hips[0] + lx, hipY, p.legs.back, pal, true, !p.air);
    if (opts.chained) drawChain(gBackLeg, bl.ax, bl.ay);
    parts.push(gBackLeg);

    var gFrontLeg = layer();
    drawLeg(gFrontLeg, c, b, hipF[0], hipY, p.legs.front, pal, false, !p.air);
    parts.push(gFrontLeg);

    var gTorso = layer();
    drawTorso(gTorso, c, pal, b, tx + ujx, ty);
    if (c.gear) drawGear(gTorso, c, b, tx + ujx, ty);
    shear(gTorso, ty, ty + T.h - 2, lean);
    parts.push(gTorso);

    if (c.top && c.top.skirt) {
      var gSkirt = layer();
      drawSkirt(gSkirt, c, b, tx, ty, p);
      parts.push(gSkirt);
    }

    var gHead = layer();
    drawHead(gHead, c, pal, headX, headY, face, mouth);
    if (p.look < 0) mirror(gHead, headX + 6.5);

    var gFrontArm = layer();
    if (p.smear) drawSmear(gFrontArm, shF[0], shF[1], p.smear[0], p.smear[1], b.upper + b.fore + 1);
    var item = p.item === 'held' ? (c.item || 'tablet') : p.item ||
      (anim === 'idle' || anim === 'talk' || anim === 'angry' ? c.item : null);
    var fa = armAng('front', shF);
    fh = drawArm(gFrontArm, c, ba, shF[0], shF[1], fa, pal, false, true, p, function (g, hx, hy, r2, phase) {
      var m = drawItem(g, item, hx, hy + (p.gunDy || 0), r2, phase, p);
      if (m) muzzle = m;
      if (held && phase === 'over') muzzle = p.nock ? nock(g, p.backItem, held, hx, hy) : { x: held.x, y: held.y };
    });
    // the near shoulder sits under the ear (3/4 view), so a raised arm covers the ear and
    // hair, not the face; p.behind tucks it behind the head instead
    var behind = !!p.behind;
    if (behind) parts.push(gFrontArm);
    parts.push(gHead);
    if (opts.tied || p.rope) {
      var gRope = layer();
      drawRope(gRope, tx + Math.round(lean / 2), T.w + (T.belly || 0), ty, hipY);
      parts.push(gRope);
    }
    if (!behind) parts.push(gFrontArm);

    var gAll = layer();
    parts.forEach(function (g) {
      outline(g, ink);
      gAll.drawImage(g.canvas, 0, 0);
      release(g);
    });
    if (held) strings(gAll, p.backItem, held, WEAPONS[p.backItem].band, fh, p.nock);
    if (opts.era && MS.palette) { if (LADDER[opts.era]) quantize(gAll.canvas, opts.era); else MS.palette.quantize(gAll.canvas, opts.era, 0); }
    ERA = '';
    var out = canvas(SW, SH);
    out.getContext('2d').drawImage(gAll.canvas, 0, 0);
    release(gAll);
    var hat = c.hat && c.hat.style;
    var tall = hat === 'officer' || hat === 'crown' || hat === 'knight';
    var res = {
      canvas: out, ox: OX, oy: OY,
      headTop: headY - (tall ? 6 : 4), headX: headX, headY: headY,
      hand: muzzle || { x: fh.hx, y: fh.hy }, backHand: { x: backHand.hx, y: backHand.hy }
    };
    cache[key] = res;
    return res;
  }

  // A 2x close-up of the head and shoulders for the dialogue box.
  var pcache = {};
  function portrait(id, c, opts) {
    opts = opts || {};
    var key = [id, opts.expr || '', opts.talking ? 1 : 0, opts.era || '', opts.blink ? 1 : 0].join('|');
    if (pcache[key]) return pcache[key];
    var f = frame(id, c, 'idle', 0, { expr: opts.expr, talking: opts.talking, era: opts.era, blink: opts.blink });
    var out = canvas(36, 36);
    var o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    // frame the face: a little hair above, the chin at the bottom, the nose off the edge
    var hat = c.hat && c.hat.style;
    var up = hat === 'officer' || hat === 'crown' ? 6 : hat === 'knight' || hat === 'helmet' || hat === 'beanie' || hat === 'hardhat' ? 5 : 4;
    if (c.hair && (c.hair.style === 'curly' || c.hair.style === 'bun')) up = Math.max(up, 5);
    o.drawImage(f.canvas, f.headX - 2, f.headY - up, 18, 18, 0, 0, 36, 36);
    pcache[key] = out;
    return out;
  }

  MS.rig = {
    SW: SW, SH: SH, OX: OX, OY: OY, ANIMS: ANIMS, BODIES: BODIES, FACES: FACES, MOUTHS: MOUTHS,
    frame: frame, frameIndex: frameIndex, portrait: portrait, ramp: ramp,
    clear: function () { cache = {}; pcache = {}; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
