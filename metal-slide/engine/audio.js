/*
 * METAL SLIDE: sound module (engine/audio.js)
 *
 * Everything is synthesized live with the Web Audio API. No samples, no fetch,
 * no modules: a classic script that only defines window.MS.audio, so it also
 * runs from file:// by double-click. Every public call is wrapped so it can
 * never throw; without a usable AudioContext every call is a silent no-op.
 *
 * Public API
 *   MS.audio.unlock()           call from the first user gesture (safe to repeat)
 *   MS.audio.music(name)        'title' | 'cave' | 'kingdom' | 'city' | 'siege' | 'future' | 'ending' | null
 *   MS.audio.jingle(name)       'start' | 'complete' | 'pickup' | 'rescue' | 'coin'
 *   MS.audio.sfx(name, opts)    'blip' ({voice: 0..1}), 'select', 'land', 'snap', 'throw', 'boom',
 *                               'pop', 'sparkle', 'build', 'hologram', 'step',
 *                               gameplay: 'shot', 'jump', 'hit', 'fix', 'scream', 'hurt', 'drop',
 *                               weapons: 'sling', 'bow', 'mgun', 'laser' (the pistol uses 'shot'),
 *                               siege: 'siren', 'stomp', 'paper', 'stamp', 'lock'
 *   MS.audio.setMuted(bool), MS.audio.isMuted(), MS.audio.toggleMute(), MS.audio.onChange(fn)
 *
 * HOW TO EDIT A SONG (see the SONGS section further down)
 *   bpm    quarter notes per minute. spb: steps per quarter (4 = each step is a 16th note).
 *   bar    steps per bar (16 for 4/4, 12 for 6/8). Drum grooves are written one bar at a time.
 *   ch     channel name -> instrument preset (see INST), or {i: preset, ...overrides}.
 *   pat    named patterns. Each channel is a string of space separated steps:
 *            C5   a note (sharps C#5, flats Bb4)      -   hold the previous note one more step
 *            .    rest                                 |   bar line, ignored (for readability)
 *            C5*4 shorthand for "C5 - - -"             .*8 shorthand for eight rests
 *            ^E5  glide into E5 from the previous note  E5!  accented note
 *          Chord channels (pad, arp, stab presets) take chord symbols instead of notes:
 *            C Cm C7 Cmaj7 Cm7 C6 Cadd9 Cmaj9 Cm9 Csus2 Csus4 C7sus4 C9 C69 Cdim Caug
 *          '@B' as a channel value reuses that channel's line from pattern B.
 *          dr: 'beat*3 fill' lists drum grooves, one per bar (a groove may also span more bars).
 *   drums  named grooves. One string per voice, one character per step:
 *            . rest   o soft   x normal   X accent   r quick double hit (roll)
 *          voices: k kick, s snare, h closed hat, o open hat, c crash, t high tom, l low tom,
 *                  n anvil clank, b tambourine, p clap, w woodblock
 *   order  list of pattern names. loop: the order index to jump back to after the last pattern,
 *          so the patterns before it act as a one time intro.
 *   tr     transpose everything by this many semitones. swing: 0..0.3 delays every odd step.
 *   vol    overall level trim for the song (1 = as written), for balancing tracks against each other.
 *   echo   echo delay in steps (3 = dotted eighth). Channels opt in with echo:/rev: send levels.
 *   A line can be shorter than its pattern only by mistake: keep every line the same length.
 */
(function () {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : {};
  var MS = W.MS = W.MS || {};

  // ------------------------------------------------------------------ constants
  var LEVEL = { master: 0.5, music: 0.3, sfx: 0.55, jingle: 0.42 };
  var STORE_KEY = 'metalSlide.muted';
  var LOOKAHEAD = 0.12;   // seconds scheduled ahead of audioContext.currentTime
  var TICK_MS = 25;       // scheduler interval
  var XFADE = 0.6;        // crossfade between tracks
  var MUTE_RAMP = 0.04;   // mute must land within 50ms
  var DUCK_TO = 0.25;     // music level while a jingle plays
  var WARN = [];          // song authoring problems found at load time (read by tests only)

  function noop() {}
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function warn(msg) { if (WARN.length < 200) WARN.push(msg); }
  function owns(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function dis(node) { try { node.disconnect(); } catch (e) { /* already gone */ } }

  // ------------------------------------------------------------------ notes and chords
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function noteNum(s) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) return null;
    return PC[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0)) + (parseInt(m[3], 10) + 1) * 12;
  }

  var QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '5': [0, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14], '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
    m9: [0, 3, 7, 10, 14], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
    dim: [0, 3, 6], aug: [0, 4, 8], '69': [0, 4, 7, 9, 14], m11: [0, 3, 7, 10, 17]
  };

  function parseChord(s) {
    var m = /^([A-G])([#b]?)([^\/]*)(\/.*)?$/.exec(s);
    if (!m || !owns(QUAL, m[3])) return null;
    return { root: PC[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0)), iv: QUAL[m[3]] };
  }

  // Close voicing: every chord tone lands within a tritone of the channel's centre note,
  // which gives smooth voice leading between chords for free.
  function voiceChord(ch, center, tr) {
    var out = [], i, n;
    for (i = 0; i < ch.iv.length; i++) {
      n = ch.root + tr + ch.iv[i];
      n += 12 * Math.round((center - n) / 12);
      if (out.indexOf(n) < 0) out.push(n);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  // Arpeggio order for a chord. 'up' and 'updown' climb `span` octaves,
  // 'lute' is a broken chord: root, fifth, octave, tenth, twelfth, tenth.
  function arpSeq(ch, spec, tr) {
    var base, seq = [], i, k, n;
    if (spec.arp === 'lute') {
      n = ch.root + tr;
      n += 12 * Math.round((spec.center - 7 - n) / 12);
      var third = ch.iv[1] < 7 ? ch.iv[1] : 4;
      return [n, n + 7, n + 12, n + 12 + third, n + 19, n + 12 + third];
    }
    base = voiceChord(ch, spec.center, tr);
    for (k = 0; k < (spec.span || 2); k++) {
      for (i = 0; i < base.length; i++) seq.push(base[i] + 12 * k);
    }
    if (spec.arp === 'updown') {
      for (i = seq.length - 2; i > 0; i--) seq.push(seq[i]);
    }
    return seq;
  }

  // ------------------------------------------------------------------ pattern parsing
  function tokens(str) {
    var raw = String(str).replace(/\|/g, ' ').split(/\s+/), out = [], i, k, m, t;
    for (i = 0; i < raw.length; i++) {
      t = raw[i];
      if (!t) continue;
      m = /^(.+)\*(\d+)$/.exec(t);
      if (m) {
        out.push(m[1]);
        for (k = 1; k < +m[2]; k++) out.push(m[1] === '.' ? '.' : '-');
      } else {
        out.push(t);
      }
    }
    return out;
  }

  // Turns a token list into a sparse array of events {n|c, d (steps), v, g}.
  function lineEvents(toks, chordMode, where, tr) {
    var ev = new Array(toks.length), i, d, t, v, g, n, c;
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      if (t === '.' || t === '-') continue;
      d = 1;
      while (i + d < toks.length && toks[i + d] === '-') d++;
      v = 0.8; g = false;
      if (t.charAt(0) === '^') { g = true; t = t.slice(1); }
      if (t.charAt(t.length - 1) === '!') { v = 1; t = t.slice(0, -1); }
      if (chordMode) {
        c = parseChord(t);
        if (c) { c.root += tr; ev[i] = { c: c, d: d, v: v }; } else warn(where + ': bad chord "' + t + '"');
      } else {
        n = noteNum(t);
        if (n !== null) ev[i] = { n: n + tr, d: d, v: v, g: g }; else warn(where + ': bad note "' + t + '"');
      }
    }
    return ev;
  }

  var VEL = { o: 0.4, x: 0.75, X: 1, r: -1 };

  // Expands "beat*3 fill" into per-step hit lists: steps[i] = [[voice, velocity], ...]
  function drumSteps(song, list, where) {
    var names = String(list).split(/\s+/), steps = [], i, k, m, g, voice, str, j, len, base, ch;
    for (i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      m = /^(.+?)(?:\*(\d+))?$/.exec(names[i]);
      g = song.drums && song.drums[m[1]];
      if (!g) { warn(where + ': unknown groove "' + m[1] + '"'); continue; }
      for (k = 0; k < (m[2] ? +m[2] : 1); k++) {
        base = steps.length; len = 0;
        for (voice in g) {
          if (!owns(g, voice)) continue;
          str = String(g[voice]).replace(/[\s|]/g, '');
          if (len && str.length !== len) warn(where + ': groove "' + m[1] + '" voice ' + voice + ' has ' + str.length + ' steps');
          len = Math.max(len, str.length);
          for (j = 0; j < str.length; j++) {
            ch = str.charAt(j);
            while (steps.length <= base + j) steps.push(null);
            if (ch === '.') continue;
            if (!owns(VEL, ch)) { warn(where + ': bad drum char "' + ch + '"'); continue; }
            (steps[base + j] = steps[base + j] || []).push([voice, VEL[ch]]);
          }
        }
        while (steps.length < base + len) steps.push(null);
      }
    }
    return steps;
  }

  function lineFor(song, pn, cn, depth) {
    var p = song.pat[pn], line = p && p[cn];
    if (typeof line === 'string' && line.charAt(0) === '@' && depth < 5) return lineFor(song, line.slice(1), cn, depth + 1);
    return line;
  }

  // ------------------------------------------------------------------ instruments
  // w: wave ('p12' 'p25' 'p50' pulse duty, 'tri', 'saw', 'sine'), w2: wave for the second unison voice,
  // uni/det: unison voices and spread in cents, a d s r: envelope (s is a level, the rest seconds),
  // vol: peak level, vib: [rate Hz, depth cents, delay s], lp: lowpass Hz, env: lowpass sweep
  // [from Hz, to Hz, seconds], q: filter resonance, gate: fraction of the written length that sounds,
  // drop: semitones the pitch falls from at the attack (slap and pluck snap), glide: seconds,
  // echo/rev: send levels, pan: -1..1, sh: transpose this channel (semitones).
  // Chord instruments: kind 'pad' (all tones) or 'arp' (one tone per `rate` steps), center: MIDI note
  // the voicing gathers around, arp: 'up' | 'updown' | 'lute', span: octaves.
  var INST = {
    brass:    { w: 'p25', w2: 'p50', uni: 2, det: 9, a: 0.014, d: 0.3, s: 0.62, r: 0.09, vol: 0.2, vib: [5.6, 16, 0.16], lp: 3400, q: 1.1, echo: 0.2, rev: 0.12 },
    horn:     { w: 'p50', a: 0.012, d: 0.25, s: 0.55, r: 0.08, vol: 0.12, vib: [5.2, 10, 0.2], lp: 2200, pan: -0.3 },
    sneak:    { w: 'p12', uni: 2, det: 6, a: 0.004, d: 0.2, s: 0.5, r: 0.07, vol: 0.2, vib: [6, 12, 0.18], lp: 3000, echo: 0.3 },
    recorder: { w: 'tri', w2: 'p50', uni: 2, det: 4, a: 0.03, d: 0.2, s: 0.85, r: 0.08, vol: 0.2, vib: [5, 20, 0.2], lp: 2400, echo: 0.16, rev: 0.25 },
    funk:     { w: 'p25', uni: 2, det: 7, a: 0.003, d: 0.12, s: 0.45, r: 0.05, vol: 0.17, lp: 3800, env: [5200, 2200, 0.15], gate: 0.7, echo: 0.14 },
    soar:     { w: 'p25', w2: 'saw', uni: 2, det: 10, a: 0.04, d: 0.4, s: 0.8, r: 0.25, vol: 0.17, vib: [5.2, 18, 0.25], lp: 3000, echo: 0.3, rev: 0.35 },
    bell:     { w: 'sine', w2: 'tri', uni: 2, det: 3, a: 0.002, d: 0.5, s: 0, r: 0.4, vol: 0.2, echo: 0.3, rev: 0.4 },
    tribass:  { w: 'tri', a: 0.004, d: 0.1, s: 0.9, r: 0.04, vol: 0.55, gate: 0.9 },
    slap:     { w: 'p50', w2: 'tri', uni: 2, det: 2, a: 0.002, d: 0.16, s: 0.35, r: 0.05, vol: 0.34, lp: 1400, env: [3200, 600, 0.12], q: 3, gate: 0.85, drop: 3 },
    drone:    { w: 'p50', w2: 'saw', uni: 2, det: 7, a: 0.4, d: 1, s: 1, r: 0.6, vol: 0.12, lp: 380, q: 2, gate: 1 },
    pad:      { kind: 'pad', w: 'saw', w2: 'p25', uni: 2, det: 11, a: 0.8, d: 1, s: 1, r: 1.2, vol: 0.075, lp: 1500, center: 64, rev: 0.45, gate: 1 },
    stab:     { kind: 'pad', w: 'p50', a: 0.003, d: 0.09, s: 0.2, r: 0.05, vol: 0.075, lp: 2500, env: [4000, 1200, 0.08], center: 67, gate: 0.6 },
    lute:     { kind: 'arp', arp: 'lute', rate: 2, w: 'p25', a: 0.002, d: 0.22, s: 0, r: 0.1, vol: 0.13, lp: 2600, env: [4200, 1000, 0.18], center: 55, rev: 0.25 },
    shimmer:  { kind: 'arp', arp: 'up', rate: 1, span: 2, w: 'p12', w2: 'tri', uni: 2, det: 5, a: 0.002, d: 0.14, s: 0, r: 0.12, vol: 0.075, lp: 4200, center: 72, echo: 0.35, rev: 0.3, gate: 0.6 },
    chiparp:  { kind: 'arp', arp: 'up', rate: 1, span: 1, w: 'p25', a: 0.002, d: 0.08, s: 0.2, r: 0.03, vol: 0.07, center: 72, gate: 0.5 }
  };

  function mkSpec(def, where) {
    var name = typeof def === 'string' ? def : (def && def.i), p = INST[name], s = {}, k;
    if (!p) { warn(where + ': unknown instrument "' + name + '"'); p = INST.tribass; }
    for (k in p) if (owns(p, k)) s[k] = p[k];
    if (def && typeof def === 'object') for (k in def) if (owns(def, k) && k !== 'i') s[k] = def[k];
    s.kind = s.kind || 'mono';
    return s;
  }

  // ------------------------------------------------------------------ song compiler
  function compileSong(song, name) {
    var tr = song.tr || 0, spec = {}, P = {}, cn, pn, src, tracks, len, line, toks, drums, i, where;
    var stepDur = 60 / song.bpm / (song.spb || 4);
    for (cn in song.ch) if (owns(song.ch, cn)) spec[cn] = mkSpec(song.ch[cn], name + '.' + cn);
    for (pn in song.pat) {
      if (!owns(song.pat, pn)) continue;
      src = song.pat[pn]; tracks = []; len = 0;
      for (cn in src) {
        if (!owns(src, cn) || cn === 'dr') continue;
        where = name + '.' + pn + '.' + cn;
        if (!spec[cn]) { warn(where + ': no such channel'); continue; }
        line = lineFor(song, pn, cn, 0);
        if (typeof line !== 'string') { warn(where + ': missing line'); continue; }
        toks = tokens(line);
        tracks.push({ ch: cn, n: toks.length, ev: lineEvents(toks, spec[cn].kind !== 'mono', where, tr + (spec[cn].sh || 0)) });
        len = Math.max(len, toks.length);
      }
      drums = src.dr ? drumSteps(song, src.dr, name + '.' + pn + '.dr') : null;
      if (drums) len = Math.max(len, drums.length);
      for (i = 0; i < tracks.length; i++) {
        if (tracks[i].n !== len) warn(name + '.' + pn + '.' + tracks[i].ch + ': ' + tracks[i].n + ' steps, pattern has ' + len);
      }
      if (drums && drums.length !== len) warn(name + '.' + pn + '.dr: ' + drums.length + ' steps, pattern has ' + len);
      if (song.bar && len % song.bar) warn(name + '.' + pn + ': ' + len + ' steps is not a whole number of bars');
      P[pn] = { len: len, tracks: tracks, drums: drums };
    }
    for (i = 0; i < song.order.length; i++) if (!P[song.order[i]]) warn(name + ': order names unknown pattern ' + song.order[i]);
    song.C = {
      P: P, spec: spec, order: song.order, loopTo: song.loop || 0, stepDur: stepDur,
      swing: song.swing || 0, echoT: (song.echo || 3) * stepDur, echoFb: song.echoFb || 0.3,
      drumVol: song.drumVol || 1, vol: song.vol || 1
    };
  }

  // ------------------------------------------------------------------ synthesis helpers
  // Per-context caches live on the context itself, so offline renders get their own copies.
  function store(c) { return c.__msAudio || (c.__msAudio = { waves: {}, noise: null }); }

  function gainNode(c, v) { var g = c.createGain(); g.gain.value = v; return g; }

  // Band limited pulse wave from its Fourier series (cosine terms of a pulse of width `duty`).
  function pulseWave(c, duty, harm) {
    var s = store(c), key = duty + ':' + harm, re, im, k;
    if (s.waves[key]) return s.waves[key];
    re = new Float32Array(harm + 1); im = new Float32Array(harm + 1);
    for (k = 1; k <= harm; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return (s.waves[key] = c.createPeriodicWave(re, im));
  }

  function setWave(c, o, w, harm) {
    if (w === 'tri') o.type = 'triangle';
    else if (w === 'saw') o.type = 'sawtooth';
    else if (w === 'sine') o.type = 'sine';
    else o.setPeriodicWave(pulseWave(c, w === 'p12' ? 0.125 : (w === 'p25' ? 0.25 : 0.5), harm || 40));
  }

  // 15 bit LFSR noise, each bit held for two samples: the crunchy NES flavour of white noise.
  function noiseBuf(c) {
    var s = store(c), len, b, d, r = 1, i, fb;
    if (s.noise) return s.noise;
    len = 65534;
    b = c.createBuffer(1, len, c.sampleRate);
    d = b.getChannelData(0);
    for (i = 0; i < len; i++) {
      if (!(i & 1)) { fb = (r ^ (r >> 1)) & 1; r = (r >> 1) | (fb << 14); }
      d[i] = (r & 1) ? 0.5 : -0.5;
    }
    return (s.noise = b);
  }

  // One synth note. f: Hz, s: instrument spec, v: velocity, from: glide start Hz (optional).
  function tone(c, out, t, dur, f, s, v, from) {
    var a = s.a || 0.003, sus = s.s === undefined ? 0.7 : s.s, d = s.d || 0.1, r = s.r || 0.05;
    var n = s.uni || 1, peak, end, stop, g, pg, inp, flt = null, lfo = null, lg = null, i, o;
    if (dur < a + 0.012) dur = a + 0.012;
    peak = (s.vol || 0.2) * v / Math.sqrt(n);
    end = t + dur; stop = end + r * 2.5 + 0.02;   // 7.5 time constants: below -60 dB
    g = c.createGain(); pg = g.gain; inp = g;
    pg.setValueAtTime(0, t);
    pg.linearRampToValueAtTime(peak, t + a);
    if (sus < 1) pg.setTargetAtTime(peak * sus, t + a, d / 3);
    pg.setTargetAtTime(0, end, r / 3);
    if (s.lp) {
      flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = s.q || 0.8;
      if (s.env) {
        flt.frequency.setValueAtTime(s.env[0], t);
        flt.frequency.setTargetAtTime(s.env[1], t + 0.004, s.env[2] / 3);
      } else {
        flt.frequency.setValueAtTime(s.lp, t);
      }
      flt.connect(g); inp = flt;
    }
    g.connect(out);
    if (s.vib && dur > s.vib[2] + 0.06) {
      lfo = c.createOscillator(); lfo.frequency.value = s.vib[0];
      lg = c.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + s.vib[2]);
      lg.gain.linearRampToValueAtTime(s.vib[1], t + s.vib[2] + 0.25);
      lfo.connect(lg); lfo.start(t); lfo.stop(stop);
    }
    for (i = 0; i < n; i++) {
      o = c.createOscillator();
      setWave(c, o, (i % 2 && s.w2) ? s.w2 : s.w);
      if (n > 1) o.detune.setValueAtTime((i / (n - 1) * 2 - 1) * (s.det || 6), t);
      if (from && from !== f) {
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(f, t + (s.glide || 0.06));
      } else if (s.drop) {
        o.frequency.setValueAtTime(f * Math.pow(2, s.drop / 12), t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
      } else {
        o.frequency.setValueAtTime(f, t);
      }
      if (lg) lg.connect(o.detune);
      o.connect(inp);
      o.start(t); o.stop(stop);
    }
    o.onended = function () { dis(g); if (flt) dis(flt); if (lg) dis(lg); };
  }

  // Filtered noise burst with an exponential tail. Optional f2 sweeps the filter, att sets the attack.
  function burst(c, out, t, v, len, type, freq, q, rate, f2, att) {
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    att = att || 0.001;
    src.buffer = noiseBuf(c); src.loop = true; src.playbackRate.value = rate || 1;
    f.type = type; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + att);
    g.gain.exponentialRampToValueAtTime(0.0005, t + Math.max(len, att + 0.005));
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.2); src.stop(t + Math.max(len, att) + 0.03);
    src.onended = function () { dis(g); dis(f); };
  }

  // Pitched hit with a falling pitch (kicks, toms, woodblock).
  function thump(c, out, t, v, f0, f1, len, wave) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = wave || 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + len + 0.02);
    o.onended = function () { dis(g); };
  }

  // Inharmonic partials: a hammer on metal.
  function clank(c, out, t, v, base) {
    var g = c.createGain(), f = c.createBiquadFilter(), ratio = [1, 2.76, 4.07], i, o;
    base = (base || 560) * (0.97 + Math.random() * 0.06);
    f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.8;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
    f.connect(g); g.connect(out);
    for (i = 0; i < 3; i++) {
      o = c.createOscillator();
      setWave(c, o, i ? 'sine' : 'p25');
      o.frequency.value = base * ratio[i];
      o.connect(f); o.start(t); o.stop(t + 0.26);
    }
    o.onended = function () { dis(g); dis(f); };
    burst(c, out, t, v * 0.9, 0.025, 'highpass', 3200, 0.7, 1);
  }

  function drumHit(c, out, k, t, v, sd) {
    if (v < 0) { drumHit(c, out, k, t, 0.5, sd); drumHit(c, out, k, t + sd / 2, 0.68, sd); return; }
    switch (k) {
      case 'k': thump(c, out, t, v * 0.95, 150, 45, 0.3, 'sine'); burst(c, out, t, v * 0.16, 0.012, 'lowpass', 2400, 0.7, 1); break;
      case 's': burst(c, out, t, v * 0.42, 0.16, 'bandpass', 1900, 0.6, 1); thump(c, out, t, v * 0.28, 240, 160, 0.08, 'triangle'); break;
      case 'h': burst(c, out, t, v * 0.16, 0.04, 'highpass', 7500, 0.7, 1); break;
      case 'o': burst(c, out, t, v * 0.13, 0.24, 'highpass', 6800, 0.7, 1); break;
      case 'c': burst(c, out, t, v * 0.15, 1.3, 'highpass', 4500, 0.5, 1); burst(c, out, t, v * 0.08, 0.5, 'bandpass', 3000, 0.4, 0.5); break;
      case 't': thump(c, out, t, v * 0.55, 230, 150, 0.2, 'triangle'); break;
      case 'l': thump(c, out, t, v * 0.65, 150, 88, 0.26, 'triangle'); burst(c, out, t, v * 0.08, 0.05, 'lowpass', 900, 0.7, 0.5); break;
      case 'n': clank(c, out, t, v * 0.2); break;
      case 'b': burst(c, out, t, v * 0.15, 0.05, 'bandpass', 9000, 1.5, 1); burst(c, out, t + 0.012, v * 0.11, 0.09, 'highpass', 8000, 0.7, 1); break;
      case 'p':
        burst(c, out, t, v * 0.28, 0.018, 'bandpass', 1300, 0.9, 1);
        burst(c, out, t + 0.009, v * 0.28, 0.018, 'bandpass', 1300, 0.9, 1);
        burst(c, out, t + 0.019, v * 0.32, 0.13, 'bandpass', 1200, 0.8, 1);
        break;
      case 'w': thump(c, out, t, v * 0.3, 980, 900, 0.05, 'triangle'); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ songs
  // Chord line helpers. rep('. . X . ', ['C', 'F']) writes the rhythm once per chord (X becomes
  // the chord). held(['C', 'F'], 16) holds each chord for 16 steps. An element that already holds
  // spaces or a '*' (like 'Ab*8 Bb*8') is used as written.
  function custom(c) { return /[\s*]/.test(c); }
  function rep(rhythm, chords) {
    return chords.map(function (c) { return custom(c) ? c : rhythm.replace(/X/g, c); }).join(' | ');
  }
  function held(chords, n) {
    return chords.map(function (c) { return custom(c) ? c : c + '*' + n; }).join(' | ');
  }

  var OOMPAH = '.*4 X*2 .*6 X*2 . .';   // march "pah" on beats 2 and 4

  var SONGS = {};

  // TITLE: heroic arcade march in C major, 150 BPM.
  // A1/A1b is the hook, H1/H1b the same hook with a horn harmony and a bVI-bVII-I lift,
  // B1/B2 a rising bridge that rolls back into the hook. 'in' plays once.
  SONGS.title = {
    bpm: 150, bar: 16, echo: 3,
    ch: { lead: 'brass', harm: 'horn', stab: 'stab', bass: 'tribass' },
    drums: {
      march:  { k: 'x.......x.......', s: '....x..o....x.oo', h: 'x.x.x.x.x.x.x.x.' },
      marchC: { k: 'x.......x.......', s: '....x..o....x.oo', h: '..x.x.x.x.x.x.x.', c: 'X...............' },
      fill:   { k: 'x.......x.......', s: '....x...xoxoXrXr', h: 'x.x.x.x.........' },
      roll:   { k: 'x.......x.......', s: 'oooorrrrxrxrXrXr' },
      hits:   { k: 'X...X...X.......', s: 'X...X...X...xxXX', c: 'X...............' },
      push:   { k: 'X...X...X...X...', s: 'X...X...X...XrXr', h: '..x...x...x.....' },
      land:   { k: 'X...............', s: 'X...........oorr', c: 'X...............' }
    },
    pat: {
      'in': {
        lead: 'G4*16 | C5*2 . . C5*2 . . E5*2 . . G5*4',
        harm: 'D4*16 | G4*2 . . G4*2 . . C5*2 . . E5*4',
        bass: 'G2*2 G2*2 G2*2 G2*2 G2*2 G2*2 G2*2 G2*2 | C3*2 . . C3*2 . . C3*2 . . G2*4',
        dr: 'roll hits'
      },
      A1: {
        lead: 'C5*4 G4*2 C5*2 E5*8 | F5*2 E5*2 F5*4 A5*2 G5*2 F5*2 E5*2 | D5*4 B4*2 D5*2 G5*8 | A5*2 G5*2 E5*4 C5*2 D5*2 E5*2 G5*2',
        stab: rep(OOMPAH, ['C', 'F', 'G', 'C']),
        bass: 'C3*4 G2*4 C3*4 G2*4 | F2*4 C3*4 F2*4 A2*4 | G2*4 D3*4 G2*4 B2*4 | C3*4 G2*4 E2*2 F2*2 G2*2 G#2*2',
        dr: 'marchC march*2 fill'
      },
      A1b: {
        lead: 'E5*4 C5*2 E5*2 A5*8 | C6*2 B5*2 A5*4 G5*2 F5*2 E5*2 F5*2 | B5*3 A5 G5*2 F5*2 E5*2 D5*2 B4*2 D5*2 | C5*8 . . G4*2 A4*2 B4*2',
        stab: rep(OOMPAH, ['Am', 'F', 'G7', 'C']),
        bass: 'A2*4 E3*4 A2*4 E3*4 | F2*4 C3*4 F2*4 C3*4 | G2*4 D3*4 B2*4 G2*4 | C3*4 G2*4 C3*2 . . G2*2 B2*2',
        dr: 'march*3 fill'
      },
      H1: {
        lead: '@A1', stab: '@A1', bass: '@A1',
        harm: 'E4*8 G4*8 | A4*8 C5*8 | B4*8 D5*8 | E5*4 C5*4 G4*8',
        dr: 'marchC march*2 fill'
      },
      H1b: {
        lead: 'E5*4 C5*2 E5*2 A5*8 | C6*2 B5*2 A5*4 G5*2 F5*2 E5*2 F5*2 | C6*4 Ab5*2 C6*2 D6*4 Bb5*2 D6*2 | C6*12 . . . .',
        harm: 'C5*8 E5*8 | A5*4 F5*4 C5*8 | Ab5*4 Eb5*4 Bb5*4 F5*4 | G5*12 . . . .',
        stab: rep(OOMPAH, ['Am', 'F', 'Ab*2 . . Ab*2 . . Bb*2 . . Bb*2 . .', 'C*4 .*12']),
        bass: 'A2*4 E3*4 A2*4 E3*4 | F2*4 C3*4 F2*4 C3*4 | Ab2*2 Ab2*2 Ab2*2 Ab2*2 Bb2*2 Bb2*2 Bb2*2 Bb2*2 | C3*4 G2*4 C3*4 E2*4',
        dr: 'march march push land'
      },
      B1: {
        lead: 'A4*4 C5*4 E5*4 A5*4 | G5*6 F5*2 E5*4 D5*4 | F4*4 A4*4 C5*4 F5*4 | E5*6 D5*2 C5*2 B4*2 G#4*4',
        harm: 'E4*16 | D4*8 B3*8 | C4*16 | B3*8 G#3*8',
        stab: rep(OOMPAH, ['Am', 'G', 'F', 'E']),
        bass: 'A2*4 E3*4 A2*4 E3*4 | G2*4 D3*4 G2*4 D3*4 | F2*4 C3*4 F2*4 C3*4 | E2*4 B2*4 E2*4 G#2*4',
        dr: 'march*3 fill'
      },
      B2: {
        lead: 'A4*4 C5*4 E5*4 A5*4 | Bb5*6 A5*2 G5*4 F5*4 | A5*6 G5*2 F5*4 C5*4 | D5*2 E5*2 F5*2 G5*2 A5*2 B5*2 G5*4',
        harm: 'E4*16 | D4*8 F4*8 | F4*8 A4*8 | B4*8 D5*8',
        stab: rep(OOMPAH, ['Am', 'Bb', 'F', 'G']),
        bass: 'A2*4 E3*4 A2*4 E3*4 | Bb2*4 F2*4 Bb2*4 F2*4 | F2*4 C3*4 F2*4 A2*4 | G2*2 G2*2 G2*2 G2*2 G2*2 G2*2 G2*2 G2*2',
        dr: 'march*3 roll'
      }
    },
    order: ['in', 'A1', 'A1b', 'H1', 'H1b', 'B1', 'B2'], loop: 1
  };

  // ENDING: the title hook again, slower (132 BPM), up a whole step to D major, with a warm pad,
  // shimmering arpeggios and a gentle 4 bar tag before it loops.
  (function () {
    var T = SONGS.title.pat;
    var cA = ['C', 'F', 'G', 'C'], cAb = ['Am', 'F', 'G7', 'C'], cHb = ['Am', 'F', 'Ab*8 Bb*8', 'C'];
    var cTag = ['F', 'G', 'Em7*8 Am7*8', 'Dm7*8 G7*8'];
    SONGS.ending = {
      bpm: 132, bar: 16, tr: 2, echo: 3,
      ch: {
        lead: { i: 'brass', lp: 2800 }, harm: 'horn', pad: 'pad', bass: 'tribass',
        arp: { i: 'shimmer', rate: 2, vol: 0.06, center: 74 }
      },
      drums: {
        anthem:  { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
        anthemC: { k: 'x.......x.......', s: '....x.......x...', h: '..x.x.x.x.x.x.x.', c: 'x...............' },
        efill:   { k: 'x.......x.......', s: '....x.......xrXr', h: 'x.x.x.x.x.x.....' },
        push:    { k: 'X...X...X...X...', s: 'X...X...X...XrXr' },
        land:    { k: 'X...............', s: 'X...............', c: 'X...............' },
        soft:    { k: 'x.......x.......', h: 'o.o.o.o.o.o.o.o.' }
      },
      pat: {
        E1:  { lead: T.A1.lead, bass: T.A1.bass, pad: held(cA, 16), arp: held(cA, 16), dr: 'anthemC anthem*2 efill' },
        E1b: { lead: T.A1b.lead, bass: T.A1b.bass, pad: held(cAb, 16), arp: held(cAb, 16), dr: 'anthem*3 efill' },
        E2:  { lead: T.A1.lead, harm: T.H1.harm, bass: T.A1.bass, pad: held(cA, 16), arp: held(cA, 16), dr: 'anthemC anthem*2 efill' },
        E2b: { lead: T.H1b.lead, harm: T.H1b.harm, bass: T.H1b.bass, pad: held(cHb, 16), arp: held(cHb, 16), dr: 'anthem anthem push land' },
        tag: {
          lead: 'F5*4 C5*2 F5*2 A5*8 | G5*4 D5*2 G5*2 B5*8 | B5*4 G5*4 C6*4 A5*4 | A5*4 F5*4 D5*4 B4*4',
          harm: 'C5*16 | D5*16 | G4*8 E5*8 | F4*8 D5*8',
          bass: 'F2*8 C3*8 | G2*8 D3*8 | E2*8 A2*8 | D3*8 G2*8',
          pad: held(cTag, 16), arp: held(cTag, 16),
          dr: 'soft*3 efill'
        }
      },
      order: ['E1', 'E1b', 'E2', 'E2b', 'tag'], loop: 0
    };
  })();

  // CAVE (Mission 1): E phrygian, 104 BPM. A low drone, a chugging riff with a flat second,
  // hammer-on-metal clanks. A: sneaky lead. B: General Bulletpoint's march (power chords,
  // a pompous horn). C: a dripping breakdown. 'in' plays once.
  (function () {
    var R1 = 'E2 . E2 E2 F2 . E2 . E2 E2 G2 . F2 . D2 .';
    var R2 = 'E2 . E2 E2 F2 . E2 . Bb2 . A2 . G2 . F2 .';
    function oct(n) { var s = [], i; for (i = 0; i < 4; i++) s.push(n + '2*2 ' + n + '3*2'); return s.join(' '); }
    var HIT = 'X*2 .*4 X*2 . . X*2 .*4';
    SONGS.cave = {
      bpm: 104, bar: 16, echo: 3, echoFb: 0.38, vol: 1.5,
      ch: {
        drone: 'drone',
        bass: { i: 'slap', drop: 0, vol: 0.3, env: [2000, 450, 0.14], q: 2.5 },
        lead: 'sneak',
        gen: { i: 'horn', w: 'p25', vol: 0.15, pan: 0, lp: 2600, echo: 0.15 },
        pow: { i: 'stab', center: 52, vol: 0.09, lp: 1500, env: [2600, 800, 0.12], gate: 0.8 },
        drip: { i: 'bell', vol: 0.1, echo: 0.55, rev: 0.5 }
      },
      drums: {
        mine:   { n: 'x.......x...x...', l: 'x...............', h: '....o.......o...' },
        mine2:  { k: 'x.......x.......', n: '....x.......x...', h: 'o.o.o.o.o.o.o.o.', l: '......x.........' },
        stomp:  { k: 'x.....x.x.......', s: '....x.......x...', n: '..x.......x...x.', h: 'o.o.o.o.o.o.o.o.' },
        stomp2: { k: 'x.....x.x.....x.', s: '....x.......x.oo', n: '..x...x...x...x.', h: 'o.o.o.o.o.o.o.o.' },
        cfill:  { k: 'x.....x.x.......', s: '....x...........', t: '........x.x.....', l: '............x.xx', n: '..x.............' },
        bmarch: { k: 'x.....x.x.......', s: '....x.......x...', n: 'x...x...x...x...', h: '..o...o...o...o.' },
        bfill:  { k: 'x.....x.x.......', s: '....x...xxXXrrXX', n: 'x...x...........' }
      },
      pat: {
        'in': { drone: 'E2*32', bass: R1 + ' | ' + R2, dr: 'mine mine' },
        A1: {
          drone: 'E2*64', bass: [R1, R2, R1, R2].join(' | '),
          lead: 'E4*3 F4 G4*2 E4*2 . . B4*2 A4*2 G4*2 | F4*6 E4*2 .*8 | E4*3 F4 G4*2 B4*2 . . C5*2 B4*2 A4*2 | B4*6 A4*2 G4*2 F4*2 E4*4',
          dr: 'stomp stomp stomp2 cfill'
        },
        A2: {
          drone: '@A1', bass: '@A1',
          lead: 'E5*3 D5 C5*2 B4*2 . . C5*2 B4*2 A4*2 | Bb4*4 A4*4 G4*4 F4*4 | E4*2 G4*2 B4*2 E5*2 F5*6 E5*2 | E5*8 .*8',
          dr: 'stomp stomp stomp2 cfill'
        },
        B1: {
          drone: '@A1', bass: [oct('E'), oct('F'), oct('G'), oct('F')].join(' | '),
          pow: rep(HIT, ['E5', 'F5', 'G5', 'F5']),
          gen: 'B4*2 B4*2 B4*2 C5*2 B4*4 G4*4 | A4*2 A4*2 A4*2 C5*2 A4*4 F4*4 | B4*2 B4*2 B4*2 D5*2 E5*4 D5*4 | C5*6 B4 Bb4 A4*4 F4*4',
          dr: 'bmarch*3 bfill'
        },
        B2: {
          drone: '@A1', bass: [oct('E'), oct('G'), oct('F'), oct('E')].join(' | '),
          pow: rep(HIT, ['E5', 'G5', 'F5', 'E5']),
          gen: 'E5*2 E5*2 E5*2 F5*2 E5*4 B4*4 | G5*2 G5*2 G5*2 A5*2 G5*4 D5*4 | A5*2 A5*2 A5*2 Bb5*2 A5*4 F5*4 | G5*4 F5*4 E5*8',
          dr: 'bmarch*3 bfill'
        },
        C: {
          drone: '@A1', bass: '@A1',
          drip: 'E6*2 .*14 | .*8 B5*2 .*6 | E6*2 .*6 F6*2 .*6 | .*16',
          lead: '.*16 | .*16 | .*16 | .*8 E4*2 F4*2 G4*2 B4*2',
          dr: 'mine2*3 cfill'
        }
      },
      order: ['in', 'A1', 'A2', 'B1', 'B2', 'C'], loop: 1
    };
  })();

  // KINGDOM (Mission 2): D mixolydian (the flat seventh C gives the old-world colour), 6/8 at
  // quarter = 120, so a bar is 12 sixteenth steps (1.5 s). Recorder lead with vibrato, lute
  // broken chords, a bagpipe fifth, tabor and tambourine. B turns to E dorian for the wonder.
  (function () {
    var cA1 = ['D', 'D', 'C', 'G*6 A*6'], cA2 = ['D', 'G', 'C', 'D'];
    var cB1 = ['Em', 'A', 'Em', 'A'], cB2 = ['G', 'D', 'Em', 'A'];
    SONGS.kingdom = {
      bpm: 120, bar: 12, echo: 3, vol: 1.1,
      ch: {
        rec: 'recorder',
        rec2: { i: 'recorder', vol: 0.12, pan: 0.3, vib: [4.6, 14, 0.25] },
        lute: { i: 'lute', pan: -0.2 },
        bass: { i: 'tribass', vol: 0.45 },
        bag: { i: 'pad', w: 'p50', w2: 'p25', a: 0.3, r: 0.6, lp: 1100, vol: 0.05, center: 50, rev: 0.2 },
        bell: { i: 'bell', vol: 0.12, pan: 0.25 }
      },
      drums: {
        tin:   { b: '..o.o...o.o.' },
        lilt:  { l: 'x.....x.....', b: '..x.o...x.o.' },
        lilt2: { l: 'x.....x...x.', b: '..x.o...x.ox', k: 'x...........' },
        roll6: { l: 'x.....x.....', t: '......x.xxx.', b: '..x.x.......' }
      },
      pat: {
        'in': { lute: held(['D', 'D'], 12), bass: 'D3*12 | D3*12', bag: 'D5*24', dr: 'tin tin' },
        A1: {
          rec: 'A4*2 D5*2 E5*2 F#5*4 E5*2 | D5*2 E5 D5 A4*2 B4*4 A4*2 | G4*2 C5*2 D5*2 E5*4 D5*2 | B4*4 G4*2 A4*6',
          lute: held(cA1, 12), bag: 'D5*48',
          bass: 'D3*6 A2*6 | D3*6 F#2*6 | C3*6 G2*6 | G2*6 A2*6',
          dr: 'lilt*3 roll6'
        },
        A2: {
          rec: 'A4*2 D5*2 E5*2 F#5*4 A5*2 | B5*4 A5*2 G5*4 F#5*2 | E5*2 F#5 E5 D5*2 C5*4 E5*2 | D5*12',
          lute: held(cA2, 12), bag: '@A1',
          bass: 'D3*6 A2*6 | G2*6 D3*6 | C3*6 E3*6 | D3*6 A2*6',
          dr: 'lilt*3 roll6'
        },
        H1: {
          rec: '@A1', lute: '@A1', bag: '@A1', bass: '@A1',
          rec2: 'F#4*2 B4*2 C5*2 D5*4 C5*2 | F#4*2 G4 F#4 F#4*2 D4*4 F#4*2 | E4*2 G4*2 B4*2 C5*4 B4*2 | G4*4 D4*2 E4*6',
          dr: 'lilt2*3 roll6'
        },
        H2: {
          rec: '@A2', lute: '@A2', bag: '@A1', bass: '@A2',
          rec2: 'F#4*2 A4*2 C5*2 D5*4 F#5*2 | G5*4 F#5*2 D5*4 D5*2 | C5*2 D5 C5 B4*2 G4*4 C5*2 | F#4*6 A4*6',
          dr: 'lilt2*3 roll6'
        },
        B1: {
          rec: 'B4*4 E5*2 F#5*4 G5*2 | A5*4 G5*2 F#5*2 E5*2 C#5*2 | B4*4 E5*2 F#5*4 G5*2 | E5*6 C#5*6',
          lute: held(cB1, 12),
          bass: 'E3*6 B2*6 | A2*6 E3*6 | E3*6 B2*6 | A2*6 C#3*6',
          bell: '.*6 B5*6 | .*6 C#6*6 | .*6 B5*6 | .*6 E6*6',
          dr: 'lilt*3 roll6'
        },
        B2: {
          rec: 'B4*4 D5*2 G5*4 A5*2 | F#5*4 E5*2 D5*4 A4*2 | G5*4 F#5*2 E5*4 B4*2 | C#5*4 B4*2 A4*6',
          lute: held(cB2, 12),
          bass: 'G2*6 D3*6 | D3*6 A2*6 | E3*6 B2*6 | A2*6 E2*6',
          bell: '.*6 D6*6 | .*6 F#5*6 | .*6 G5*6 | .*6 E5*6',
          dr: 'lilt2*3 roll6'
        }
      },
      order: ['in', 'A1', 'A2', 'H1', 'H2', 'B1', 'B2'], loop: 1
    };
  })();

  // CITY (Mission 3): funk-pop in A minor (dorian vamp) that opens into a C major chorus, 124 BPM.
  // Slap bass with octave pops, four-on-the-floor, offbeat hats, clipped chord stabs.
  // A1/A2: the groove and a staccato riff. B1/B2: the chorus hook. C: a stripped breakdown.
  (function () {
    var FUNK = '. . X . . . X . . . X . . X . .';
    var AM = 'A2 . . A2 . . A3! . A2 . G2 . A2 . C3 C#3';
    var D9 = 'D3 . . D3 . . D4! . D3 . C3 . A2 . G2 G#2';
    var D9E = 'D3 . . D3 . . D4! . D3 . C3 . A2 . G2 E2';
    var FM = 'F2 . . F2 . . F3! . F2 . E2 . F2 . A2 C3';
    var E7 = 'E2 . . E2 . . E3! . E2 . D3 . B2 . G#2 E2';
    var cB1 = ['Fmaj7', 'G6', 'Em7', 'Am7'], cB2 = ['Dm7', 'G', 'Cmaj7', 'E7'];
    SONGS.city = {
      bpm: 124, bar: 16, echo: 3, swing: 0.06, vol: 1.4,
      ch: {
        bass: 'slap', lead: 'funk', stab: 'stab',
        hook: { i: 'brass', vol: 0.18, lp: 3000, rev: 0.15, vib: [5.8, 12, 0.2] },
        arp: { i: 'chiparp', vol: 0.055, pan: 0.3 }
      },
      drums: {
        four:  { k: 'x...x...x...x...', p: '....x.......x...', h: 'o.x.o.x.o.x.o.xo' },
        fourO: { k: 'x...x...x...x...', p: '....x.......x...', h: 'o.x.o.x.o.x.o...', o: '..............x.' },
        crash: { k: 'x...x...x...x...', p: '....x.......x...', h: '..x.o.x.o.x.o.x.', c: 'X...............' },
        cfill: { k: 'x...x...x...x...', p: '....x.......x...', s: '..........o.xrXr', h: 'o.x.o.x.o.x.....' },
        brk:   { k: 'x.........x.....', p: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' }
      },
      pat: {
        A1: {
          bass: [AM, D9, AM, D9].join(' | '),
          lead: 'E5 . G5 . A5 . . G5 . E5 . D5 E5 . . . | .*4 F#5 . E5 . D5 . . . C5 . A4 . | E5 . G5 . A5 . . G5 . E5 . D5 E5 . G5 A5 | C6 . A5 . . G5 . A5 . . F#5 . . E5 . .',
          stab: rep(FUNK, ['Am7', 'D9', 'Am7', 'D9']),
          dr: 'crash four fourO cfill'
        },
        A2: {
          bass: [AM, D9E, FM, E7].join(' | '),
          lead: 'E5 . G5 . A5 . . G5 . E5 . D5 E5 . . . | .*4 F#5 . E5 . D5 . . . C5 . A4 . | C5 . E5 . A5 . . G5 . E5 . C5 E5 . . . | .*4 G#4 . B4 . D5 . . . E5 . G#5 .',
          stab: rep(FUNK, ['Am7', 'D9', 'Fmaj7', 'E7']),
          dr: 'four fourO four cfill'
        },
        B1: {
          bass: [FM, 'G2 . . G2 . . G3! . G2 . F2 . G2 . B2 D3', 'E2 . . E2 . . E3! . E2 . D3 . E2 . G2 B2', AM].join(' | '),
          hook: 'C5 . C5 . E5 . G5*3 A5 . G5 . E5 . . | D5 . D5 . G5 . B5*3 C6 . B5 . G5 . . | B5*4 A5*2 G5*2 . . E5*2 G5*2 A5*2 | A5*6 G5*2 E5*8',
          stab: rep(FUNK, cB1), arp: held(cB1, 16),
          dr: 'crash four four fourO'
        },
        B2: {
          bass: ['D3 . . D3 . . D4! . D3 . C3 . A2 . F2 F#2', 'G2 . . G2 . . G3! . G2 . F2 . D2 . G2 B2', 'C3 . . C3 . . C4! . C3 . A2 . G2 . E2 G2', E7].join(' | '),
          hook: 'C5 . C5 . F5 . A5*3 C6 . A5 . F5 . . | B4 . B4 . D5 . G5*3 B5 . A5 . G5 . . | E5*4 G5*2 B5*2 . . C6*2 B5*2 G5*2 | G#5*6 E5*2 B4*4 D5*4',
          stab: rep(FUNK, cB2), arp: held(cB2, 16),
          dr: 'four four fourO cfill'
        },
        C: {
          bass: '@A1',
          lead: 'A5 . . . . . . . E5 . G5 . . . . . | . . . . . . F#5 . . . E5 . D5 . . . | A5 . . . . . . . E5 . G5 . A5 . C6 . | .*16',
          dr: 'brk*3 cfill'
        }
      },
      order: ['A1', 'A2', 'B1', 'B2', 'C'], loop: 0
    };
  })();

  // FUTURE (Mission 5): hopeful D major, 108 BPM. Slow-attack detuned pads on maj7, add9 and
  // m9 chords, two-octave 16th arpeggios with echo, a bell motif in the first half (A) and a
  // soaring lead in the second half (B) that resolves a sus4 into the loop point.
  (function () {
    var cA = ['Dmaj9', 'F#m7', 'Gmaj7', 'Aadd9'], cB = ['Bm9', 'F#m7', 'Gmaj9', 'A7sus4'];
    var cB2 = ['Bm9', 'F#m7', 'Gmaj9', 'A7sus4*12 A*4'];
    SONGS.future = {
      bpm: 108, bar: 16, echo: 3, echoFb: 0.35, vol: 1.1,
      ch: { pad: 'pad', arp: 'shimmer', bass: { i: 'tribass', vol: 0.5, gate: 0.95 }, bell: 'bell', soar: 'soar' },
      drums: {
        none:  { h: '................' },
        fa:    { k: 'x.........x.....', p: '........x.......', h: 'o...o...o...o...' },
        fb:    { k: 'x.........x.....', p: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' },
        fbC:   { k: 'x.........x.....', p: '....x.......x...', h: '..x.o.x.o.x.o.x.', c: 'x...............' },
        ffill: { k: 'x.........x.....', p: '....x.......x...', t: '........x.x.....', l: '............x.x.' }
      },
      pat: {
        A1: {
          pad: held(cA, 16), arp: held(cA, 16),
          bass: 'D2*6 D2*6 A2*4 | F#2*6 F#2*6 C#3*4 | G2*6 G2*6 D3*4 | A2*6 A2*6 E3*4',
          bell: 'A5*3 F#5*3 E5*2 .*8 | .*8 C#6*3 A5*3 E5*2 | B5*3 F#5*3 D5*2 .*8 | .*8 E5*3 B5*3 C#6*2',
          dr: 'none none fa fa'
        },
        A2: {
          pad: held(cB, 16), arp: held(cB, 16),
          bass: 'B2*6 B2*6 F#2*4 | F#2*6 F#2*6 C#3*4 | G2*6 G2*6 D3*4 | A2*6 A2*6 E2*4',
          bell: 'C#6*3 B5*3 F#5*2 .*8 | .*8 A5*3 E5*3 C#5*2 | B5*3 A5*3 F#5*2 .*8 | .*8 G5*3 E5*3 D5*2',
          dr: 'fa fa fa ffill'
        },
        B1: {
          pad: '@A1', arp: '@A1', bass: '@A1',
          soar: 'F#5*6 E5*2 F#5*4 A5*4 | C#6*8 B5*4 A5*4 | B5*6 A5*2 B5*4 D6*4 | C#6*12 B5*2 A5*2',
          dr: 'fbC fb fb fb'
        },
        B2: {
          pad: held(cB2, 16), arp: held(cB2, 16), bass: '@A2',
          soar: 'D6*6 C#6*2 B5*4 F#5*4 | A5*6 B5*2 A5*4 E5*4 | B5*6 C#6*2 D6*8 | E6*8 D6*4 C#6*4',
          dr: 'fb fb fb ffill'
        }
      },
      order: ['A1', 'A2', 'B1', 'B2'], loop: 0
    };
  })();

  // SIEGE (Mission 4 boss): D minor, 152 BPM. A giant robot made of legal paperwork marches on
  // the city. 'in' plays once: robot footsteps, a horn siren on the same A4 and D5 as the 'siren'
  // sting, then a climb to band hits on A. A1/A2: the boss riff over a galloping bass
  // (i, bVII, bVI, V). C1: a half-time breakdown with clanking machinery over a pedal D.
  // C2: the gallop returns and power chords climb Bb, B, C, C#. B1/B2: the title hook turned to
  // D minor, then the title's bVI, bVII lift landing on D major, which rolls back into the riff.
  (function () {
    // 16th note gallop (8th plus two 16ths) with an octave pop on beat 4.
    function gal(lo, hi) { return [lo, '.', lo, lo, lo, '.', lo, lo, lo, '.', lo, lo, hi, '.', lo, lo].join(' '); }
    // Half-time machine figure for the breakdown.
    function robo(lo, hi) { return [lo + '*2', '.', '.', lo, '.', lo + '*2', '.', '.', hi, '.', lo, '.', '.', '.'].join(' '); }
    // Straight 8ths: half a bar of a, half a bar of b.
    function eighths(a, b) { return [a, a, a, a, b, b, b, b].map(function (n) { return n + '*2'; }).join(' '); }
    var PUSH = 'X*3 . . . X*3 . . . X*3 .';      // power chord hits on 1, the "and" of 2, and 4
    var HITS = 'X*2 . . X*2 . . X*2 . . X*4';    // band hits on every beat
    SONGS.siege = {
      bpm: 152, bar: 16, echo: 3, vol: 1.3,
      ch: {
        lead: { i: 'brass', lp: 3600 },
        harm: { i: 'horn', vol: 0.13, glide: 0.11 },
        bass: { i: 'slap', drop: 0, vol: 0.3, env: [2600, 520, 0.1], q: 2.4, gate: 0.8 },
        pow: { i: 'stab', center: 55, vol: 0.09, lp: 1800, env: [3200, 900, 0.1], gate: 0.85 },
        arp: { i: 'chiparp', vol: 0.05, pan: 0.25, center: 74, echo: 0.2 },
        drone: { i: 'drone', vol: 0.13 }
      },
      drums: {
        stomp:  { k: 'X.......X.......', l: 'x.......x.......', n: 'x.......x.......', h: '....o.......o...' },
        stomp2: { k: 'X...x...X...x.x.', l: 'x.......x.......', s: '........oooorrrr', n: 'x.......x.......' },
        hits:   { k: 'X...X...X...X...', s: 'X...X...X...XrXr', h: '..x...x...x.....' },
        driveC: { k: 'x.....x.x.....x.', s: '....x.......x...', h: '..x.x.x.x.x.x.x.', c: 'X...............' },
        drive:  { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
        four:   { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
        fill:   { k: 'x.....x.x.......', s: '....x...........', t: '........x.xx....', l: '............x.xx' },
        brk:    { k: 'x.........x.....', s: '........X.......', n: '..x...x...x...x.', h: 'o.o.o.o.o.o.o.o.' },
        brk2:   { k: 'x.........x.x...', s: '........X...xrXr', n: '..x...x.........', h: 'o.o.o.o.o.o.....' },
        rise:   { k: 'x.x.x.x.x.x.x.x.', s: '....x...x.x.x.x.', h: 'x.x.x.x.x.x.x.x.' },
        roll:   { k: 'x...x...x...x...', s: 'oooorrrrxrxrXrXr' },
        push:   { k: 'X...X...X...X...', s: 'X...X...X...XrXr' },
        land:   { k: 'X...............', s: 'X...........oorr', c: 'X...............' }
      },
      pat: {
        'in': {
          drone: 'D2*32 .*32',
          harm: 'A4*8 ^D5*8 | ^A4*8 ^D5*8 | D5*8 E5*8 | E4*2 . . E4*2 . . A4*2 . . C#5*4',
          lead: '.*16 | .*16 | F5*8 G5*8 | A4*2 . . C#5*2 . . E5*2 . . A5*4',
          bass: '.*16 | .*16 | ' + eighths('Bb1', 'C2') + ' | A1*2 . . A1*2 . . A1*2 . . A1*4',
          pow: '.*16 | .*16 | ' + eighths('Bb5', 'C5') + ' | ' + rep(HITS, ['A5']),
          dr: 'stomp stomp stomp2 hits'
        },
        A1: {
          lead: 'D5*2 . . D5*2 F5*2 A5*6 G5*2 | F5*2 E5*2 C5*4 G5*4 E5*4 | D5*2 . . D5*2 F5*2 Bb5*6 A5*2 | A5*4 G5*2 F5*2 E5*4 C#5*4',
          bass: [gal('D2', 'D3'), gal('C2', 'C3'), gal('Bb1', 'Bb2'), gal('A1', 'A2')].join(' | '),
          pow: rep(PUSH, ['D5', 'C5', 'Bb5', 'A5']),
          dr: 'driveC drive drive fill'
        },
        A2: {
          lead: 'D6*2 . . D6*2 C6*2 A5*6 F5*2 | G5*2 A5*2 G5*2 E5*2 C5*4 E5*4 | F5*2 . . F5*2 G5*2 D5*6 Bb4*2 | A4*2 . . C#5*2 . . E5*2 . . A5*4',
          harm: 'A5*2 . . A5*2 A5*2 F5*6 D5*2 | E5*2 F5*2 E5*2 C5*2 G4*4 C5*4 | D5*2 . . D5*2 D5*2 Bb4*6 F4*2 | E4*2 . . E4*2 . . A4*2 . . C#5*4',
          bass: [gal('D2', 'D3'), gal('C2', 'C3'), gal('Bb1', 'Bb2'), 'A2*2 . . A2*2 . . A2*2 . . A1*4'].join(' | '),
          pow: rep(PUSH, ['D5', 'C5', 'Bb5']) + ' | ' + rep(HITS, ['A5']),
          dr: 'driveC four four hits'
        },
        C1: {
          drone: 'D2*48 A1*16',
          harm: 'A5*12 G5*2 F5*2 | F5*12 E5*2 D5*2 | D5*8 Bb4*8 | C#5*8 E5*8',
          bass: [robo('D2', 'D3'), robo('Bb1', 'Bb2'), robo('G2', 'G3'), robo('A1', 'A2')].join(' | '),
          pow: rep('X*4 .*12', ['D5', 'Bb5', 'G5', 'A5']),
          arp: held(['Dm', 'Bb', 'Gm', 'A'], 16),
          dr: 'brk brk brk brk2'
        },
        C2: {
          lead: 'A4*2 D5*2 F5*2 A5*4 G5*2 F5*2 E5*2 | F4*2 Bb4*2 D5*2 F5*4 E5*2 D5*2 C5*2 | F5*8 F#5*8 | G5*8 G#5*8',
          harm: '.*16 | .*16 | D5*8 D#5*8 | E5*8 F5*8',
          bass: [gal('D2', 'D3'), gal('Bb1', 'Bb2'), eighths('Bb1', 'B1'), eighths('C2', 'C#2')].join(' | '),
          pow: rep(PUSH, ['D5', 'Bb5']) + ' | ' + eighths('Bb5', 'B5') + ' | ' + eighths('C5', 'C#5'),
          dr: 'driveC four rise roll'
        },
        B1: {
          lead: 'D5*4 A4*2 D5*2 F5*8 | G5*2 F5*2 G5*4 Bb5*2 A5*2 G5*2 F5*2 | E5*4 C#5*2 E5*2 A5*8 | Bb5*2 A5*2 F5*4 D5*2 E5*2 F5*2 A5*2',
          harm: 'F4*8 A4*8 | Bb4*8 D5*8 | C#5*8 E5*8 | F5*4 D5*4 A4*8',
          bass: [gal('D2', 'D3'), gal('G2', 'G3'), gal('A1', 'A2'), gal('D2', 'D3')].join(' | '),
          pow: rep(PUSH, ['D5', 'G5', 'A5', 'D5']),
          arp: held(['Dm', 'Gm', 'A', 'Dm'], 16),
          dr: 'driveC drive drive fill'
        },
        B2: {
          lead: 'F5*4 D5*2 F5*2 Bb5*8 | D6*2 C6*2 Bb5*4 A5*2 G5*2 F5*2 G5*2 | D6*4 Bb5*2 D6*2 E6*4 C6*2 E6*2 | D6*12 . . . .',
          harm: 'D5*8 F5*8 | Bb5*4 G5*4 D5*8 | Bb5*4 F5*4 C6*4 G5*4 | F#5*12 . . . .',
          bass: [gal('Bb1', 'Bb2'), gal('G2', 'G3'), eighths('Bb1', 'C2'), 'D2*4 .*4 A1*2 A1*2 C2*2 C#2*2'].join(' | '),
          pow: rep(PUSH, ['Bb5', 'G5']) + ' | Bb*2 . . Bb*2 . . C*2 . . C*2 . . | D*4 .*12',
          arp: held(['Bb', 'Gm7', 'Bb*8 C*8', 'D'], 16),
          dr: 'drive four push land'
        }
      },
      order: ['in', 'A1', 'A2', 'C1', 'C2', 'B1', 'B2'], loop: 1
    };
  })();

  // ------------------------------------------------------------------ jingles
  // Same format as songs, played once (never looped) while the music ducks to 25%.
  var JINGLES = {
    // MISSION START: snare roll, then three punchy chord hits (bVI, bVII, I) and a held C.
    start: {
      bpm: 150, echo: 3,
      ch: {
        lead: { i: 'brass', vol: 0.24 }, harm: { i: 'horn', vol: 0.15, pan: -0.3 },
        low: { i: 'horn', vol: 0.13, pan: 0.3 }, bass: 'tribass'
      },
      drums: { go: { s: 'oorrrrX.X.X.........', k: '......X.X.X.........', c: '..........X.........' } },
      pat: {
        A: {
          lead: '.*6 Eb5*2 F5*2 G5*8 . .',
          harm: '.*6 C5*2 D5*2 E5*8 . .',
          low:  '.*6 Ab4*2 Bb4*2 C5*8 . .',
          bass: '.*6 Ab2*2 Bb2*2 C3*8 . .',
          dr: 'go'
        }
      },
      order: ['A']
    },

    // MISSION COMPLETE: rising C arpeggio, the same climb over Ab and Bb, then home on a held C.
    complete: {
      bpm: 144, echo: 3,
      ch: {
        lead: { i: 'brass', vol: 0.22 }, harm: { i: 'horn', vol: 0.14, pan: -0.3 },
        pad: { i: 'pad', a: 0.02, r: 0.5, vol: 0.08, center: 67 }, bass: 'tribass'
      },
      drums: {
        b1: { k: 'x...x...x...x...', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' },
        b2: { k: 'x.......x.......', s: 'x...x...x.xrXrXr' },
        b3: { k: 'X.......', s: 'X.......', c: 'X.......' }
      },
      pat: {
        A: {
          lead: 'G4 . C5 . E5 . G5*6 E5 . G5 . | Ab4 . C5 . Eb5 . Ab5*2 Bb4 . D5 . F5 . Bb5*2 | C6*8',
          harm: 'E4 . G4 . C5 . E5*6 C5 . E5 . | Eb4 . Ab4 . C5 . Eb5*2 F4 . Bb4 . D5 . F5*2 | G5*8',
          pad:  '.*16 | .*16 | C*8',
          bass: 'C3 . . . C3 . . . C3 . . . G2 . . . | Ab2 . . . Ab2 . . . Bb2 . . . Bb2 . . . | C3*8',
          dr: 'b1 b2 b3'
        }
      },
      order: ['A']
    },

    // POWER-UP: a bright two-octave climb that lands on a ringing chord.
    pickup: {
      bpm: 150, spb: 8, echo: 4,
      ch: { lead: { i: 'sneak', w: 'p25', vol: 0.4, gate: 0.85 }, bell: { i: 'bell', vol: 0.25 } },
      drums: { s: { c: '...........o............' } },
      pat: {
        A: {
          lead: 'G4 C5 E5 G5 C5 E5 G5 C6 E5 G5 C6 E6*6 .*7',
          bell: '.*11 C6*6 .*7',
          dr: 's'
        }
      },
      order: ['A']
    },

    // PRISONER FREED: a cheerful little "thank you!" with woodblock and tambourine.
    rescue: {
      bpm: 150, echo: 3,
      ch: { lead: { i: 'brass', vol: 0.28, w: 'p50', lp: 3000 }, harm: { i: 'bell', vol: 0.16 }, bass: 'tribass' },
      drums: { ty: { w: 'xxx.......', b: '.....x....' } },
      pat: {
        A: {
          lead: 'C5 E5 G5 . E5 C6*4 .',
          harm: '.*5 G5*4 .',
          bass: 'C3 . . . G2 C3*4 .',
          dr: 'ty'
        }
      },
      order: ['A']
    },

    // INSERT COIN: a coin clinks into the slot, then a quick credit arpeggio.
    coin: {
      bpm: 150, spb: 8, echo: 2,
      ch: { lead: { i: 'sneak', w: 'p25', vol: 0.34, gate: 0.9 }, bell: { i: 'bell', vol: 0.15 } },
      drums: { clink: { n: 'X.........' } },
      pat: {
        A: { lead: '. E5 G5 C6*5 . .', bell: '.*3 G6*4 .*3', dr: 'clink' }
      },
      order: ['A']
    }
  };

  // ------------------------------------------------------------------ sound effects
  // Each effect is function (ctx, out, time, opts): short, soft and cheap.
  function zap(c, out, t, f, f2, w, vol, len, harm) {
    var o = c.createOscillator(), g = c.createGain();
    setWave(c, o, w, harm || 16);
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + len * 0.85);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + len + 0.02);
    o.onended = function () { dis(g); };
  }

  var BLIP_STEPS = [-2, 0, 0, 2, 3, 5];   // random speech-like pitch wobble, in semitones

  var SFX = {
    // Typewriter tick. voice 0..1: deep and round (triangle) up to small and squeaky (thin pulse).
    blip: function (c, out, t, o) {
      var v = +o.voice, w, vol, f;
      if (!(v >= 0 && v <= 1)) v = 0.5;
      w = v < 0.25 ? 'tri' : (v < 0.55 ? 'p50' : (v < 0.8 ? 'p25' : 'p12'));
      vol = w === 'tri' ? 0.36 : (w === 'p50' ? 0.16 : 0.22);
      f = 150 * Math.pow(2, v * 2.5 + BLIP_STEPS[Math.floor(Math.random() * BLIP_STEPS.length)] / 12);
      zap(c, out, t, f, f * 0.94, w, vol, 0.045, 10);
    },
    select: function (c, out, t) {
      zap(c, out, t, 660, 0, 'p25', 0.18, 0.05);
      zap(c, out, t + 0.05, 990, 0, 'p25', 0.18, 0.09);
    },
    // Soft enough to play on every landing (also the crate thud).
    land: function (c, out, t) {
      thump(c, out, t, 0.22, 140, 50, 0.2, 'sine');
      burst(c, out, t, 0.12, 0.13, 'lowpass', 700, 0.8, 0.5);
      burst(c, out, t + 0.004, 0.05, 0.04, 'bandpass', 1600, 1.2, 1);
    },
    snap: function (c, out, t) {
      clank(c, out, t, 0.18, 980);
      clank(c, out, t + 0.045, 0.11, 1340);
      burst(c, out, t, 0.2, 0.06, 'highpass', 2600, 0.7, 1);
      zap(c, out, t + 0.1, 2640, 2500, 'sine', 0.05, 0.14);
      zap(c, out, t + 0.17, 3170, 3050, 'sine', 0.04, 0.12);
    },
    'throw': function (c, out, t) {
      var i;
      burst(c, out, t, 0.5, 0.4, 'bandpass', 450, 1.3, 0.7, 2800, 0.16);
      for (i = 0; i < 4; i++) burst(c, out, t + 0.05 + i * 0.055, 0.09, 0.025, 'bandpass', 3400, 2, 1);
    },
    boom: function (c, out, t) {
      thump(c, out, t, 0.56, 95, 32, 0.8, 'sine');
      burst(c, out, t, 0.45, 1.4, 'lowpass', 500, 0.9, 0.3, 60, 0.015);
      burst(c, out, t, 0.15, 0.25, 'bandpass', 900, 0.8, 0.6);
    },
    pop: function (c, out, t) {
      zap(c, out, t, 420, 980, 'sine', 0.26, 0.08);
      zap(c, out, t + 0.008, 840, 1900, 'tri', 0.05, 0.05);
    },
    sparkle: function (c, out, t) {
      var n = [84, 86, 88, 91, 93, 96, 98], walk = [0, 2, 1, 3, 2, 4], k = Math.floor(Math.random() * 3), i;
      for (i = 0; i < 6; i++) zap(c, out, t + i * 0.055, mtof(n[k + walk[i]]), 0, i % 2 ? 'sine' : 'tri', 0.13 - i * 0.012, 0.3);
    },
    build: function (c, out, t) {
      var i, tt;
      for (i = 0; i < 3; i++) {
        tt = t + i * 0.09;
        thump(c, out, tt, 0.35, 520 + i * 130, 380 + i * 100, 0.06, 'triangle');
        burst(c, out, tt, 0.2, 0.03, 'bandpass', 2300 + i * 350, 1.2, 1);
      }
      zap(c, out, t + 0.28, 1047, 0, 'p25', 0.06, 0.2, 12);
    },
    hologram: function (c, out, t) {
      var len = 0.95, g = c.createGain(), trem = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      var f = [659.3, 987.8, 1318.5], i, o;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.18);
      g.gain.setTargetAtTime(0, t + len - 0.35, 0.1);
      trem.gain.value = 0.65; lfo.frequency.value = 12; lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(trem.gain); trem.connect(g); g.connect(out);
      for (i = 0; i < 3; i++) {
        o = c.createOscillator(); o.type = i ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(f[i] * 0.75, t);
        o.frequency.exponentialRampToValueAtTime(f[i], t + 0.3);
        o.detune.value = (i - 1) * 8;
        o.connect(trem); o.start(t); o.stop(t + len + 0.05);
      }
      lfo.start(t); lfo.stop(t + len + 0.05);
      o.onended = function () { dis(g); dis(trem); dis(lg); };
      burst(c, out, t, 0.04, 0.7, 'bandpass', 1800, 3, 1, 7500, 0.2);
    },
    // ---- gameplay (cheap enough for rapid fire)
    // Spec blaster: a bright falling pew, about 60ms, pitch nudged a little each call.
    shot: function (c, out, t) {
      var k = 0.96 + Math.random() * 0.08;
      zap(c, out, t, 1900 * k, 520 * k, 'p25', 0.2, 0.06, 12);
    },
    // Slingshot: the band slaps back with a rubbery thwip, and the pebble whooshes off.
    sling: function (c, out, t) {
      var k = 0.96 + Math.random() * 0.08;
      zap(c, out, t, 420 * k, 140 * k, 'tri', 0.22, 0.09);
      burst(c, out, t, 0.16, 0.12, 'bandpass', 2400, 1.4, 1, 700);
    },
    // Bow: a low plucked string, then the arrow leaving.
    bow: function (c, out, t) {
      var k = 0.97 + Math.random() * 0.06;
      zap(c, out, t, 196 * k, 184 * k, 'p25', 0.16, 0.22, 10);
      zap(c, out, t, 392 * k, 370 * k, 'tri', 0.08, 0.12);
      burst(c, out, t + 0.01, 0.12, 0.14, 'bandpass', 1800, 1.1, 1, 900);
    },
    // Machine gun: a shorter, punchier pew with a click, made to repeat fast.
    mgun: function (c, out, t) {
      var k = 0.95 + Math.random() * 0.1;
      zap(c, out, t, 1300 * k, 360 * k, 'p12', 0.16, 0.045, 10);
      burst(c, out, t, 0.12, 0.03, 'highpass', 3000, 0.7, 1);
    },
    // Laser: a clean sine sweep down with a thin buzzing edge on top.
    laser: function (c, out, t) {
      var k = 0.98 + Math.random() * 0.04;
      zap(c, out, t, 2400 * k, 700 * k, 'sine', 0.2, 0.14);
      zap(c, out, t, 3600 * k, 1050 * k, 'p25', 0.06, 0.1, 12);
    },
    jump: function (c, out, t) {
      zap(c, out, t, 300, 720, 'p50', 0.14, 0.13, 10);
    },
    // A shot pops a target: two tiny high pings and a click.
    hit: function (c, out, t) {
      var k = 0.97 + Math.random() * 0.06;
      zap(c, out, t, 2093 * k, 0, 'tri', 0.15, 0.07);
      zap(c, out, t + 0.03, 3136 * k, 0, 'sine', 0.11, 0.08);
      burst(c, out, t, 0.09, 0.015, 'highpass', 4000, 0.7, 1);
    },
    // A layout snaps to the 8px grid: a click, a grace note, then a ringing ding.
    fix: function (c, out, t) {
      thump(c, out, t, 0.22, 1400, 1000, 0.03, 'triangle');
      burst(c, out, t, 0.1, 0.02, 'bandpass', 2600, 1.2, 1);
      zap(c, out, t + 0.03, 988, 0, 'p25', 0.07, 0.05, 12);
      zap(c, out, t + 0.07, 1319, 0, 'sine', 0.14, 0.3);
      zap(c, out, t + 0.07, 1319, 0, 'tri', 0.06, 0.24);
    },
    // Fleeing trooper: a fast falling, warbling AIIIEEE (about 0.4s), a little different each time.
    scream: function (c, out, t) {
      var len = 0.42, k = 0.92 + Math.random() * 0.16, g = c.createGain(), f = c.createBiquadFilter();
      var lfo = c.createOscillator(), lg = c.createGain(), i, o;
      f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.02);
      g.gain.setValueAtTime(0.1, t + len * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      lfo.frequency.value = 17; lg.gain.value = 70;
      lfo.connect(lg); f.connect(g); g.connect(out);
      for (i = 0; i < 2; i++) {
        o = c.createOscillator();
        setWave(c, o, i ? 'p25' : 'p12', 20);
        o.frequency.setValueAtTime(1350 * k, t);
        o.frequency.setValueAtTime(1350 * k, t + 0.06);
        o.frequency.exponentialRampToValueAtTime(430 * k, t + len);
        o.detune.value = i ? 12 : -12;
        lg.connect(o.detune); o.connect(f);
        o.start(t); o.stop(t + len + 0.02);
      }
      lfo.start(t); lfo.stop(t + len + 0.02);
      o.onended = function () { dis(g); dis(f); dis(lg); };
    },
    // A thrown slide bonks the hero: soft, round, no pain.
    hurt: function (c, out, t) {
      thump(c, out, t, 0.26, 560, 210, 0.16, 'triangle');
      thump(c, out, t + 0.01, 0.12, 1120, 600, 0.06, 'sine');
      burst(c, out, t, 0.06, 0.04, 'lowpass', 1200, 0.8, 0.7);
    },
    // Hero drops in: an airy falling whoosh with a faint whistle.
    drop: function (c, out, t) {
      burst(c, out, t, 0.42, 0.6, 'bandpass', 3200, 1.1, 0.8, 380, 0.22);
      zap(c, out, t + 0.02, 1100, 260, 'sine', 0.05, 0.55);
    },
    step: function (c, out, t) {
      burst(c, out, t, 0.22, 0.07, 'lowpass', 500 + Math.random() * 300, 0.8, 0.5);
      thump(c, out, t, 0.17, 120, 75, 0.07, 'sine');
    },
    // ---- Mission 4: the siege
    // End of Mission 3: a soft hi-lo siren sting (about 1.5s) on D5 and A4, the same two notes
    // the siege theme's horn plays. Triangle with a little square, low passed so it never pierces.
    siren: function (c, out, t) {
      var seg = 0.3, n = 4, len = seg * n + 0.3, hi = 587.33, lo = 440, ws = [], i, k, o, w;
      var g = c.createGain(), flt = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
      flt.type = 'lowpass'; flt.frequency.value = 1900; flt.Q.value = 0.7;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.095, t + 0.08);
      g.gain.setValueAtTime(0.095, t + seg * n - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      lfo.frequency.value = 5.5; lg.gain.value = 10;
      lfo.connect(lg); flt.connect(g); g.connect(out);
      for (i = 0; i < 2; i++) {
        o = c.createOscillator();
        if (i) setWave(c, o, 'p50', 10); else o.type = 'triangle';
        w = c.createGain(); w.gain.value = i ? 0.3 : 1; ws.push(w);
        o.frequency.setValueAtTime(hi, t);
        for (k = 1; k < n; k++) {
          o.frequency.setValueAtTime(k % 2 ? hi : lo, t + k * seg - 0.05);
          o.frequency.exponentialRampToValueAtTime(k % 2 ? lo : hi, t + k * seg);
        }
        o.frequency.exponentialRampToValueAtTime(lo * 0.93, t + len);   // winds down as it fades
        lg.connect(o.detune); o.connect(w); w.connect(flt);
        o.start(t); o.stop(t + len + 0.02);
      }
      lfo.start(t); lfo.stop(t + len + 0.02);
      o.onended = function () { dis(g); dis(flt); dis(lg); dis(ws[0]); dis(ws[1]); };
    },
    // The paperwork robot's footstep: a deep thud and rumble, then loose pages settling.
    stomp: function (c, out, t) {
      var k = 0.94 + Math.random() * 0.12, i;
      thump(c, out, t, 0.36, 105 * k, 36 * k, 0.5, 'sine');
      thump(c, out, t, 0.12, 250 * k, 90 * k, 0.12, 'triangle');
      burst(c, out, t, 0.23, 0.45, 'lowpass', 420, 0.9, 0.3, 90, 0.006);
      burst(c, out, t + 0.04, 0.06, 0.22, 'bandpass', 1500, 0.9, 1, 3200, 0.03);
      for (i = 0; i < 5; i++) {
        burst(c, out, t + 0.06 + i * 0.038 + Math.random() * 0.02, 0.09 - i * 0.012, 0.025, 'bandpass', 2400 + Math.random() * 1800, 1.6, 1);
      }
    },
    // Legal pages flutter (thrown notices, paper piles): a short swish and a crinkle of ticks.
    paper: function (c, out, t) {
      var tt = t, i;
      burst(c, out, t, 0.24, 0.22, 'bandpass', 1300, 0.9, 1, 3600, 0.035);
      for (i = 0; i < 7; i++) {
        tt += 0.016 + Math.random() * 0.026;
        burst(c, out, tt, 0.16 + Math.random() * 0.1, 0.018 + Math.random() * 0.022, i % 2 ? 'highpass' : 'bandpass', 2600 + Math.random() * 2800, 1.4, 1);
      }
    },
    // Rubber stamp comes down on the desk: a rubbery slap, a deep wooden THUNK, a tiny lift off.
    stamp: function (c, out, t) {
      thump(c, out, t, 0.37, 190, 62, 0.2, 'sine');
      thump(c, out, t, 0.19, 430, 230, 0.07, 'triangle');
      burst(c, out, t, 0.19, 0.06, 'lowpass', 1500, 0.8, 0.8);
      burst(c, out, t, 0.05, 0.012, 'highpass', 3200, 0.7, 1);
      burst(c, out, t + 0.17, 0.03, 0.03, 'bandpass', 2400, 1.2, 1);
    },
    // A door locks shut: the bolt slides, a crisp click, a heavier clack and a short metal ring.
    lock: function (c, out, t) {
      burst(c, out, t, 0.075, 0.06, 'bandpass', 2000, 1.5, 1, 3400, 0.02);
      thump(c, out, t + 0.07, 0.36, 1900, 1400, 0.025, 'triangle');
      burst(c, out, t + 0.07, 0.24, 0.014, 'highpass', 4500, 0.7, 1);
      thump(c, out, t + 0.11, 0.46, 900, 420, 0.05, 'triangle');
      burst(c, out, t + 0.11, 0.22, 0.03, 'bandpass', 2600, 1.3, 1);
      zap(c, out, t + 0.11, 3520, 3470, 'sine', 0.05, 0.16);
    }
  };

  // ------------------------------------------------------------------ compile everything once
  (function () {
    var k;
    for (k in SONGS) if (owns(SONGS, k)) { try { compileSong(SONGS[k], k); } catch (e) { warn(k + ': ' + e.message); } }
    for (k in JINGLES) if (owns(JINGLES, k)) { try { compileSong(JINGLES[k], 'jingle ' + k); } catch (e) { warn(k + ': ' + e.message); } }
  })();

  // ------------------------------------------------------------------ players
  // A player renders one song into its own fade gain, so two can overlap during a crossfade.
  function makePlayer(c, song, id, dest, revIn) {
    var C = song && song.C, p, dl, lp, fb, wet, cn, spec, bus, node, pan, es, rs;
    if (!C) return null;
    p = { c: c, id: id, C: C, bar: song.bar || 16, o: 0, s: 0, next: 0, stopAt: 0, ch: {}, nodes: [] };
    p.fade = gainNode(c, 0); p.fade.connect(dest);
    p.echoIn = gainNode(c, 1);
    dl = c.createDelay(2); dl.delayTime.value = Math.min(1.9, C.echoT);
    lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    fb = gainNode(c, C.echoFb); wet = gainNode(c, 0.5);
    p.echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(p.fade);
    p.nodes.push(p.fade, p.echoIn, dl, lp, fb, wet);
    if (revIn) { p.revFade = gainNode(c, 0); p.revFade.connect(revIn); p.nodes.push(p.revFade); }
    p.drums = gainNode(c, C.drumVol); p.drums.connect(p.fade); p.nodes.push(p.drums);
    for (cn in C.spec) {
      if (!owns(C.spec, cn)) continue;
      spec = C.spec[cn]; bus = gainNode(c, 1); node = bus; p.nodes.push(bus);
      if (spec.pan && c.createStereoPanner) {
        pan = c.createStereoPanner(); pan.pan.value = spec.pan; bus.connect(pan); node = pan; p.nodes.push(pan);
      }
      node.connect(p.fade);
      if (spec.echo) { es = gainNode(c, spec.echo); node.connect(es); es.connect(p.echoIn); p.nodes.push(es); }
      if (spec.rev && p.revFade) { rs = gainNode(c, spec.rev); node.connect(rs); rs.connect(p.revFade); p.nodes.push(rs); }
      p.ch[cn] = { spec: spec, bus: bus, last: 0, arp: null };
    }
    return p;
  }

  function renderStep(p, pat, s, t) {
    var C = p.C, c = p.c, sd = C.stepDur, i, tr, ch, ev, spec, j, hits, notes, a, rate;
    if (s & 1) t += C.swing * sd;
    for (i = 0; i < pat.tracks.length; i++) {
      tr = pat.tracks[i]; ch = p.ch[tr.ch]; ev = tr.ev[s]; spec = ch.spec;
      if (spec.kind === 'arp') {
        if (ev) ch.arp = { seq: arpSeq(ev.c, spec, 0), i: 0, k: 0, left: ev.d, v: ev.v };
        a = ch.arp; rate = spec.rate || 1;
        if (a && a.left > 0) {
          if (a.k % rate === 0) { tone(c, ch.bus, t, sd * rate * (spec.gate || 0.9), mtof(a.seq[a.i % a.seq.length]), spec, a.v); a.i++; }
          a.k++; a.left--;
        }
      } else if (ev && spec.kind === 'pad') {
        notes = voiceChord(ev.c, spec.center, 0);
        for (j = 0; j < notes.length; j++) {
          tone(c, ch.bus, t, ev.d * sd * (spec.gate || 0.92), mtof(notes[j]), spec, ev.v / Math.sqrt(notes.length / 2));
        }
      } else if (ev) {
        tone(c, ch.bus, t, ev.d * sd * (spec.gate || 0.92), mtof(ev.n), spec, ev.v, (ev.g && ch.last) ? mtof(ch.last) : 0);
        ch.last = ev.n;
      }
    }
    hits = pat.drums && pat.drums[s];
    if (hits) for (j = 0; j < hits.length; j++) drumHit(c, p.drums, hits[j][0], t, hits[j][1], sd);
  }

  // Advances first, renders second: a failing step can never stall the loop.
  function playStep(p) {
    var C = p.C, o = p.o, s = p.s, t = p.next, pat = C.P[C.order[o]];
    p.next += C.stepDur;
    p.s = s + 1;
    if (!pat || p.s >= pat.len) { p.s = 0; p.o = (o + 1 >= C.order.length) ? C.loopTo : o + 1; }
    if (pat && pat.len) { try { renderStep(p, pat, s, t); } catch (e) { /* skip this step */ } }
  }

  function rampParam(prm, v, t, time) {
    var cur = prm.value;
    prm.cancelScheduledValues(t);
    prm.setValueAtTime(cur, t);
    prm.linearRampToValueAtTime(v, t + time);
  }

  function fadePlayer(p, v, time) {
    var t = p.c.currentTime;
    rampParam(p.fade.gain, v, t, time);
    if (p.revFade) rampParam(p.revFade.gain, v, t, time);
  }

  function retire(p, ms) {
    setTimeout(function () { for (var i = 0; i < p.nodes.length; i++) dis(p.nodes[i]); }, ms || 4000);
  }

  // Schedules a whole short song (a jingle) at once and returns its length in seconds.
  function playOnce(c, song, t0, dest, revIn) {
    var p = makePlayer(c, song, '', dest, revIn), total = 0, i;
    if (!p) return 0;
    for (i = 0; i < p.C.order.length; i++) total += (p.C.P[p.C.order[i]] || { len: 0 }).len;
    p.fade.gain.value = p.C.vol;
    if (p.revFade) p.revFade.gain.value = p.C.vol;
    p.next = t0;
    for (i = 0; i < total; i++) playStep(p);
    retire(p, (total * p.C.stepDur + 3) * 1000);
    return total * p.C.stepDur;
  }

  // ------------------------------------------------------------------ engine state
  var ctx = null, nodes = null, unlocked = false, muted = readMuted();
  var hidden = !!(W.document && W.document.hidden);
  var wantTrack = null, current = null, players = [], resumeAt = {}, listeners = [];
  var timer = null, duckEnd = 0, lastAt = {};
  // Minimum spacing (seconds) for effects that get called in rapid bursts.
  var MIN_GAP = { blip: 0.028, shot: 0.045, mgun: 0.05, laser: 0.06, hit: 0.03, step: 0.05, land: 0.05, scream: 0.12, stomp: 0.25, paper: 0.06 };

  function readMuted() {
    try { var v = W.localStorage && W.localStorage.getItem(STORE_KEY); return v === '1' || v === 'true'; } catch (e) { return false; }
  }
  function writeMuted(b) {
    try { if (W.localStorage) W.localStorage.setItem(STORE_KEY, b ? '1' : '0'); } catch (e) { /* private mode */ }
  }

  function makeReverb(c, out) {
    var len = Math.floor(c.sampleRate * 1.6), buf = c.createBuffer(2, len, c.sampleRate), ch, d, i, conv, inp, hp, wet;
    for (ch = 0; ch < 2; ch++) {
      d = buf.getChannelData(ch);
      for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv = c.createConvolver(); conv.buffer = buf;
    inp = gainNode(c, 1);
    hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    wet = gainNode(c, 0.6);
    inp.connect(hp); hp.connect(conv); conv.connect(wet); wet.connect(out);
    return inp;
  }

  // master -> soft limiter -> speakers. The limiter is a transparent straight line below 0.6
  // and rounds off anything louder, so stacked jingles and sfx can never clip harshly.
  function buildGraph(c) {
    var n = {}, curve = new Float32Array(1024), i, x, a;
    for (i = 0; i < 1024; i++) {
      x = i / 1023 * 2 - 1; a = Math.abs(x);
      a = a < 0.6 ? a : 0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4);
      curve[i] = x < 0 ? -a : a;
    }
    n.limit = c.createWaveShaper(); n.limit.curve = curve; n.limit.oversample = '2x';
    n.master = gainNode(c, muted ? 0 : LEVEL.master);
    n.master.connect(n.limit); n.limit.connect(c.destination);
    n.music = gainNode(c, LEVEL.music); n.music.connect(n.master);
    n.duck = gainNode(c, 1); n.duck.connect(n.music);
    n.sfx = gainNode(c, LEVEL.sfx); n.sfx.connect(n.master);
    n.jingle = gainNode(c, LEVEL.jingle); n.jingle.connect(n.master);
    try { n.rev = makeReverb(c, n.duck); } catch (e) { n.rev = null; }
    return n;
  }

  function ensureContext() {
    var C;
    if (ctx) return true;
    C = W.AudioContext || W.webkitAudioContext;
    if (!C) return false;
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) {
      try { ctx = new C(); } catch (e2) { ctx = null; return false; }
    }
    try { nodes = buildGraph(ctx); } catch (e3) {
      try { ctx.close(); } catch (e4) { /* ignore */ }
      ctx = null; nodes = null; return false;
    }
    return true;
  }

  function resumeCtx() {
    try { var pr = ctx && ctx.resume && ctx.resume(); if (pr && pr.catch) pr.catch(noop); } catch (e) { /* blocked */ }
  }

  function ready() { return !!(ctx && nodes && unlocked && ctx.state !== 'closed'); }
  function canPlay() { return ready() && !muted && !hidden; }

  // ------------------------------------------------------------------ scheduler
  function tick() {
    var now, h, i, p;
    if (!ctx) { stopTimer(); return; }
    now = ctx.currentTime; h = now + LOOKAHEAD;
    for (i = players.length - 1; i >= 0; i--) {
      p = players[i];
      if (p.next < now - 0.25) p.next = now + 0.02;   // fell behind: resync rather than burst
      while (p.next < h && (!p.stopAt || p.next < p.stopAt)) playStep(p);
      if (p.stopAt && now >= p.stopAt) { players.splice(i, 1); retire(p); }
    }
    if (!players.length) stopTimer();
  }
  function safeTick() { try { tick(); } catch (e) { /* keep going */ } }
  function startTimer() { if (!timer) timer = setInterval(safeTick, TICK_MS); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function startTrack(name, fadeIn) {
    var p = makePlayer(ctx, SONGS[name], name, nodes.duck, nodes.rev), pos = resumeAt[name];
    if (!p) return;
    if (pos) { p.o = pos.o; p.s = pos.s; delete resumeAt[name]; }
    p.next = ctx.currentTime + 0.05;
    fadePlayer(p, p.C.vol, fadeIn);
    players.push(p); current = p;
    startTimer(); safeTick();
  }

  function stopPlayer(p, time) {
    fadePlayer(p, 0, time);
    p.stopAt = ctx.currentTime + time + 0.02;
  }

  // Mute and hidden tabs pause the track and remember the bar it was in.
  function pauseMusic() {
    if (!current) return;
    resumeAt[current.id] = { o: current.o, s: current.s - current.s % current.bar };
    stopPlayer(current, 0.05);
    current = null;
  }
  function resumeMusic() { if (canPlay() && wantTrack && !current) startTrack(wantTrack, 0.2); }

  function duck(len) {
    var now = ctx.currentTime, prm = nodes.duck.gain;
    duckEnd = Math.max(duckEnd, now + len);
    rampParam(prm, DUCK_TO, now, 0.06);
    prm.setValueAtTime(DUCK_TO, duckEnd);
    prm.linearRampToValueAtTime(1, duckEnd + 0.6);
  }

  function emit() {
    var list = listeners.slice(), i;
    for (i = 0; i < list.length; i++) { try { list[i](muted); } catch (e) { /* listener bug, ignore */ } }
  }

  // ------------------------------------------------------------------ public API
  var api = {
    unlock: function () {
      try {
        if (!ensureContext()) return;
        if (ctx.state !== 'running') resumeCtx();
        if (!unlocked) {
          unlocked = true;
          // iOS Safari: a silent buffer started inside the gesture fully opens the output.
          try {
            var b = ctx.createBufferSource();
            b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
            b.connect(ctx.destination); b.start(0);
          } catch (e) { /* optional */ }
        }
        resumeMusic();
      } catch (e) { /* never throw */ }
    },

    music: function (name) {
      try {
        if (name === undefined || name === '' || name === false) name = null;
        if (name !== null && !(typeof name === 'string' && owns(SONGS, name) && SONGS[name].C)) return;
        if (name === wantTrack) return;
        wantTrack = name;
        resumeAt = {};
        if (!canPlay()) return;
        if (current) {
          stopPlayer(current, XFADE); current = null;
          if (name) startTrack(name, XFADE);
        } else if (name) {
          startTrack(name, 0.03);
        }
      } catch (e) { /* never throw */ }
    },

    jingle: function (name) {
      try {
        var len;
        if (muted || !ready() || typeof name !== 'string' || !owns(JINGLES, name)) return;
        if (ctx.state !== 'running') resumeCtx();
        // No shared reverb here: its return is ducked with the music, jingles use their own echo.
        len = playOnce(ctx, JINGLES[name], ctx.currentTime + 0.03, nodes.jingle, null);
        if (len) duck(len + 0.15);
      } catch (e) { /* never throw */ }
    },

    sfx: function (name, opts) {
      try {
        var now;
        if (muted || !ready() || typeof name !== 'string' || !owns(SFX, name)) return;
        now = ctx.currentTime;
        if (owns(MIN_GAP, name)) {
          if (lastAt[name] !== undefined && now - lastAt[name] < MIN_GAP[name]) return;
          lastAt[name] = now;
        }
        if (ctx.state !== 'running') resumeCtx();
        SFX[name](ctx, nodes.sfx, now + 0.005, (opts && typeof opts === 'object') ? opts : {});
      } catch (e) { /* never throw */ }
    },

    setMuted: function (b) {
      try {
        b = !!b;
        if (b === muted) return;
        muted = b;
        writeMuted(b);
        if (ctx && nodes) {
          rampParam(nodes.master.gain, b ? 0 : LEVEL.master, ctx.currentTime, MUTE_RAMP);
          if (b) pauseMusic();
          else { if (unlocked && ctx.state !== 'running') resumeCtx(); resumeMusic(); }
        }
        emit();
      } catch (e) { /* never throw */ }
    },

    isMuted: function () { return muted; },

    toggleMute: function () { api.setMuted(!muted); return muted; },

    onChange: function (fn) {
      if (typeof fn !== 'function') return noop;
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }
  };

  try {
    if (W.document && W.document.addEventListener) {
      W.document.addEventListener('visibilitychange', function () {
        try {
          hidden = !!W.document.hidden;
          if (!ctx) return;
          if (hidden) pauseMusic();
          else { if (unlocked && !muted && ctx.state !== 'running') resumeCtx(); resumeMusic(); }
        } catch (e) { /* never throw */ }
      });
    }
  } catch (e) { /* no document */ }

  // Test hook: only when a harness defines window.__msAudioTest before loading this file.
  if (W.__msAudioTest && typeof W.__msAudioTest === 'object') {
    W.__msAudioTest.internals = {
      SONGS: SONGS, JINGLES: JINGLES, SFX: SFX, INST: INST, WARN: WARN, makePlayer: makePlayer,
      playStep: playStep, playOnce: playOnce, makeReverb: makeReverb, voiceChord: voiceChord,
      arpSeq: arpSeq, state: function () {
        return { ctx: ctx, nodes: nodes, unlocked: unlocked, muted: muted, hidden: hidden, wantTrack: wantTrack,
          current: current && current.id, players: players.length, timer: !!timer, resumeAt: resumeAt };
      }
    };
  }

  MS.audio = api;
})();
