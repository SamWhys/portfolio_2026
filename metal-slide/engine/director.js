/* METAL SLIDE engine: the director.
   Compiles parsed missions into steps (one click each), then plays them.
   A step = some commands that run in order, then one thing that waits for a click
   (a line of dialogue, crowd bubbles, a title card, a tally row...).
   Going back rebuilds the mission and replays earlier steps instantly. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};
  MS.sets = MS.sets || {};

  var DEFAULT_SETS = ['cave', 'kingdom', 'city', 'future'];
  var WAIT_OPS = { pause: 1, complete: 1, banner: 1, ending: 1, click: 1 };
  // Must match the dialogue box layout in ui.js.
  var BOX = { textW: 314, narrW: 352, lines: 3 };
  var CPS = 55;

  var EXPR = [
    [/yell|shout|angr|furious|mad|annoy|rage|scream/, 'angry'],
    [/happy|excit|cheer|proud|smil|laugh|thrill|delight|grin|joy/, 'happy'],
    [/shock|surpris|amaz|gasp|stun|scared|terrif|panic|afraid/, 'shocked'],
    [/sad|tired|defeat|cry|sigh|exhaust|sob|glum/, 'sad']
  ];
  function exprFor(mood) {
    mood = String(mood || '').toLowerCase();
    for (var i = 0; i < EXPR.length; i++) if (EXPR[i][0].test(mood)) return EXPR[i][1];
    return null;
  }

  function fallbackSet(name) {
    return { name: name, era: name === 'title' ? 'title' : 'modern', width: MS.W, ground: 156, cast: {}, marks: {} };
  }
  function getSet(name) { return MS.sets[name] || null; }

  function paginate(text, width) {
    var lines = MS.font.wrap(text, width);
    var pages = [];
    for (var i = 0; i < lines.length; i += BOX.lines) pages.push(lines.slice(i, i + BOX.lines));
    return pages.length ? pages : [['']];
  }

  function Director(story, opts) {
    this.story = story;
    this.opts = opts || {};
    this.reduced = !!this.opts.reduced;
    this.warnings = (story.warnings || []).slice();
    this.missions = [];
    this.mi = 0; this.si = 0;
    this.phase = 'idle';
    this.queue = []; this.task = null;
    this.fade = 0;
    this.lastMusic = undefined;
    this.listeners = [];
    this.autoplay = false; // demo mode: the game plays itself
    this.input = null;     // function returning the player's controls (set by main.js)
    this.waitT = 0;
    this.build();
  }

  Director.prototype.build = function () {
    var self = this;
    var titleSet = getSet('title') || fallbackSet('title');
    this.missions.push({
      num: '0', title: this.story.title || 'METAL SLIDE', setName: 'title', set: titleSet, isTitle: true,
      steps: [{ cmds: [], wait: { type: 'coin' }, line: 0 }, { cmds: [], wait: { type: 'start' }, line: 0 }]
    });
    (this.story.missions || []).forEach(function (m, i) { self.missions.push(self.compile(m, i)); });
    this.computeEntries();
  };

  Director.prototype.compile = function (m, index) {
    var self = this;
    var setName = null;
    m.beats.some(function (b) {
      var mm = b.type === 'dir' && /^\s*set\s+(\S+)\s*$/i.exec(b.text);
      if (mm) setName = mm[1].toLowerCase();
      return !!mm;
    });
    if (!setName) setName = DEFAULT_SETS[index] || 'void';
    var set = getSet(setName);
    if (!set) {
      this.warnings.push({ line: m.line, message: 'No art set called "' + setName + '", using a blank stage.' });
      set = getSet('void') || fallbackSet('void');
    }
    var ctx = set._ctx || (set._ctx = MS.directions.context(set));
    var steps = [];
    var cmds = [];
    function close(wait, line) { steps.push({ cmds: cmds, wait: wait, line: line }); cmds = []; }

    close({ type: 'title', num: m.num, title: m.title }, m.line);
    m.beats.forEach(function (b) {
      if (b.type === 'dir') {
        var d = MS.directions.compile(b.text, ctx);
        d.src = b.text; d.line = b.line;
        if (d.op === 'set' || d.op === 'title') return;
        if (d.op === 'note') self.warnings.push({ line: b.line, message: 'Not wired up yet: [' + b.text + ']' });
        if (WAIT_OPS[d.op]) {
          close(d.op === 'click' ? { type: 'click', target: d.target } :
            d.op === 'banner' ? { type: 'banner', bannerText: d.text } :
            d.op === 'ending' ? { type: 'ending', endingText: d.text || null } : { type: d.op }, b.line);
          return;
        }
        cmds.push(d);
      } else if (b.type === 'say' || b.type === 'narrate') {
        var id = b.type === 'say' ? MS.directions.actorFor(b.speaker, ctx) : null;
        if (b.type === 'say' && id && /^(bubble|aside|whisper|thinks?)$/i.test(b.mood || '')) {
          close({ type: 'crowd', bubbles: [{ id: id, text: b.text }] }, b.line);
          return;
        }
        if (b.type === 'say' && !id) self.warnings.push({ line: b.line, message: '"' + b.speaker + '" is not in this scene, so they talk from off screen.' });
        var pages = paginate(b.text, b.type === 'say' ? BOX.textW : BOX.narrW);
        pages.forEach(function (lines, p) {
          close({ type: b.type, speaker: b.speaker || null, id: id, mood: b.mood || null, lines: lines, page: p, pages: pages.length }, b.line);
        });
      } else if (b.type === 'crowd') {
        close({ type: 'crowd', target: b.target, lines: b.lines }, b.line);
      } else if (b.type === 'tally') {
        close({ type: 'tally', label: b.label, value: b.value }, b.line);
      }
    });
    if (cmds.length) close({ type: 'end' }, m.line);
    return { num: m.num, title: m.title, setName: setName, set: set, ctx: ctx, steps: steps, line: m.line, links: m.links || [], brief: m.brief || '' };
  };

  Director.prototype.makeWorld = function (mi) {
    var M = this.missions[mi];
    var w = new MS.World(M.set, M.entry);
    w.reduced = this.reduced;
    w.director = this;
    return w;
  };

  // Persistent effects of a step's waiting beat (kept when replaying).
  Director.prototype.persist = function (w, wait) {
    w.syncCamera();
    this.frame(w, wait);
    switch (wait.type) {
      case 'start': w.state.credits = 1; w.music = 'title'; break;
      case 'complete': w.tally = { rows: [] }; break;
      case 'tally': if (!w.tally) w.tally = { rows: [] }; w.tally.rows.push({ label: wait.label, value: wait.value }); break;
      case 'ending': w.ending = true; w.endingText = wait.endingText || null; w.music = 'ending'; break;
    }
  };

  // Keep the speaker (or the crowd) on screen once levels scroll. Changes the logical
  // camera deterministically; the drawn camera eases there (world.camera.view).
  Director.prototype.frame = function (w, wait) {
    var ids = [];
    if (wait.type === 'say' && wait.id) ids = [wait.id];
    else if (wait.type === 'crowd') {
      if (wait.bubbles) ids = wait.bubbles.map(function (b) { return b.id; });
      else {
        var ctx = w.set._ctx; // the world's own set: this.mi is stale during replay
        var g = wait.target && ctx ? MS.directions.groupFor(wait.target, ctx) : null;
        ids = g || [];
      }
    }
    var xs = ids.map(function (id) { return w.actors[id]; }).filter(function (a) { return a && a.visible; }).map(function (a) { return a.x; });
    if (!xs.length) return;
    var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
    var cam = w.camera.x;
    if (lo >= cam + 16 && hi <= cam + MS.W - 16) return;
    w.camera.mode = 'fixed'; w.camera.follow = null;
    w.camera.x = MS.util.clamp(Math.round((lo + hi) / 2 - MS.W / 2), 0, w.width - MS.W);
  };

  Director.prototype.replay = function (w, step) {
    step.cmds.forEach(function (c) { MS.commands.start(w, c, { instant: true }); });
    this.persist(w, step.wait);
  };

  Director.prototype.computeEntries = function () {
    var first = this.missions[1];
    var entry = { arms: (first && first.set.arms) || 'NONE', saved: 0 };
    this.missions[0].entry = { arms: 'NONE', saved: 0 };
    for (var i = 1; i < this.missions.length; i++) {
      var M = this.missions[i];
      M.entry = { arms: entry.arms, saved: entry.saved };
      var w = this.makeWorld(i);
      for (var s = 0; s < M.steps.length; s++) this.replay(w, M.steps[s]);
      var self = this;
      w.warnings.forEach(function (msg) { self.warnings.push({ line: M.line, message: msg }); });
      entry = { arms: w.hud.arms, saved: w.hud.saved };
    }
  };

  // ------------------------------------------------------------ playback
  Director.prototype.current = function () {
    var M = this.missions[this.mi];
    return { mission: M, step: M.steps[this.si], world: this.world, mi: this.mi, si: this.si };
  };

  Director.prototype.goto = function (mi, si, mode, continuing) {
    mi = Math.max(0, Math.min(this.missions.length - 1, mi));
    var M = this.missions[mi];
    si = Math.max(0, Math.min(M.steps.length - 1, si));
    var fresh = !continuing || !this.world || mi !== this.mi;
    if (fresh) {
      this.world = this.makeWorld(mi);
      for (var k = 0; k < si; k++) this.replay(this.world, M.steps[k]);
      this.fade = mode === 'play' && si === 0 ? 1 : 0;
    }
    this.mi = mi; this.si = si;
    this.world.clearPresentation();
    var w = this.world;
    w.ids.forEach(function (id) { w.actors[id].expr = null; });
    var step = M.steps[si];
    this.task = null;
    if (mode === 'instant') {
      step.cmds.forEach(function (c) { MS.commands.start(w, c, { instant: true }); });
      this.queue = [];
      this.enterWait(true);
    } else {
      this.queue = step.cmds.slice();
      this.phase = 'cmds';
      this.update(0);
    }
    // A jump (Back, a mission key, a rewind) cuts straight there: no sweep across the level.
    if (fresh || mode === 'instant') { w.syncCamera(); w.camera.view = w.camera.x; }
    this.changed();
  };

  Director.prototype.enterWait = function (instant) {
    var w = this.world;
    var wait = this.current().step.wait;
    this.phase = 'wait';
    this.waitT = 0;
    this.persist(w, wait);
    var ui = w.ui;
    switch (wait.type) {
      case 'title':
        ui.title = { num: wait.num, title: wait.title, t: instant || this.reduced ? 9 : 0 };
        if (!instant && MS.audio) MS.audio.jingle('start');
        this.announce('Mission ' + wait.num + ': ' + wait.title);
        break;
      case 'say':
      case 'narrate':
        var total = MS.font.visibleLength(wait.lines.join(' '));
        ui.line = {
          type: wait.type, id: wait.id, speaker: wait.speaker, mood: wait.mood, lines: wait.lines,
          total: total, shown: instant || this.reduced ? total : 0, more: wait.page < wait.pages - 1,
          angry: exprFor(wait.mood) === 'angry'
        };
        if (wait.id && w.actors[wait.id]) w.actors[wait.id].expr = exprFor(wait.mood);
        this.announce((wait.speaker ? wait.speaker + ': ' : '') + wait.lines.join(' ').replace(/\*/g, ''));
        break;
      case 'crowd':
        ui.bubbles = this.crowdBubbles(wait, instant);
        if (!instant && MS.audio) MS.audio.sfx('pop');
        this.announce('Crowd: ' + ui.bubbles.map(function (b) { return b.text; }).join(' '));
        break;
      case 'tally':
        ui.row = { index: w.tally.rows.length - 1, t: instant || this.reduced ? 9 : 0 };
        if (!instant && MS.audio) MS.audio.sfx('select');
        this.announce(wait.label + (wait.value ? ': ' + wait.value : ''));
        break;
      case 'complete':
        ui.complete = { t: instant ? 9 : 0 };
        if (!instant && MS.audio) MS.audio.jingle('complete');
        this.announce('Mission complete!');
        break;
      case 'banner':
        ui.banner = { text: wait.bannerText || '', t: instant ? 9 : 0 };
        this.announce(wait.bannerText || '');
        break;
      case 'ending':
        ui.endingT = instant ? 9 : 0;
        this.announce('The end. ' + (wait.endingText ? wait.endingText + ' ' : '') + 'Thank you for playing.');
        break;
      case 'click':
        ui.click = { target: wait.target };
        break;
      case 'start':
        if (!instant && MS.audio) MS.audio.jingle('coin');
        this.announce('Credit 1. Press start.');
        break;
      case 'coin':
        this.announce((this.story.title || 'Metal Slide') + '. Insert coin: click, tap or press the right arrow to begin.');
        break;
    }
    this.syncMusic();
  };

  Director.prototype.crowdBubbles = function (wait, instant) {
    var w = this.world;
    if (wait.bubbles) return wait.bubbles.map(function (b) { return { id: b.id, text: b.text, t: instant ? 9 : 0, delay: 0 }; });
    var ctx = this.current().mission.ctx;
    var pool = [];
    var group = wait.target ? MS.directions.groupFor(wait.target, ctx) : null;
    if (!group && w.set.crowd && ctx.groups[w.set.crowd]) group = ctx.groups[w.set.crowd];
    if (group) pool = group.filter(function (id) { return w.actors[id] && w.actors[id].visible; });
    if (!pool.length) pool = w.visibleIds().filter(function (id) { return id !== 'SAM'; });
    if (!pool.length) pool = w.visibleIds();
    pool.sort(function (a, b) { return w.actors[a].x - w.actors[b].x; });
    // Spread the lines across the crowd, left to right, without reusing a head until we must.
    var picks = [];
    var n = wait.lines.length;
    for (var i = 0; i < n; i++) {
      var idx = pool.length ? Math.floor((i + 0.5) * pool.length / n) % pool.length : -1;
      picks.push(idx);
    }
    return wait.lines.map(function (text, i) {
      return { id: picks[i] >= 0 ? pool[picks[i]] : null, slot: i, text: text, t: instant ? 9 : 0, delay: i * 0.22 };
    });
  };

  Director.prototype.update = function (dt) {
    var w = this.world;
    if (!w) return;
    w.update(dt);
    if (this.phase === 'cmds') {
      if (this.task) {
        this.task.update(dt);
        if (this.task.done) { if (this.task.isPlay) this.guard = 0.3; this.task = null; }
      }
      var guard = 200;
      while (!this.task && this.phase === 'cmds' && guard-- > 0) {
        if (!this.queue.length) { this.enterWait(false); break; }
        this.task = MS.commands.start(w, this.queue.shift(), {});
        this.task.update(0);
        if (this.task.done) this.task = null;
      }
    } else if (this.phase === 'wait') {
      if (this.autoplay) {
        var Lw = w.ui.line;
        if (!Lw || Lw.shown >= Lw.total) this.waitT += dt; // read after it's typed
        if (this.waitT >= this.readingTime()) { this.waitT = 0; this.finishBeat(); this.advance(); return; }
      }
      var L = w.ui.line;
      if (L && L.shown < L.total) {
        var before = Math.floor(L.shown);
        L.shown = Math.min(L.total, L.shown + dt * CPS);
        var now = Math.floor(L.shown);
        if (now !== before && now % 2 === 0 && MS.audio) {
          var a = L.id && w.actors[L.id];
          MS.audio.sfx('blip', { voice: a ? a.voice : 0.5 });
        }
      }
    }
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 2.2);
    if (this.guard > 0) this.guard = Math.max(0, this.guard - dt);
    if (w.music !== this.lastMusic) this.syncMusic();
  };

  // How long demo mode lingers on the current beat before moving on.
  Director.prototype.readingTime = function () {
    var wait = this.current().step.wait;
    switch (wait.type) {
      case 'say': case 'narrate': return Math.min(7, 1.4 + 0.045 * MS.font.visibleLength(wait.lines.join(' ')));
      case 'crowd': return 1.8 + 0.03 * (wait.lines || wait.bubbles.map(function (b) { return b.text; })).join(' ').length;
      case 'title': return 2.6;
      case 'complete': return 2.2;
      case 'tally': return 1.3;
      case 'banner': return 2.2;
      case 'ending': return 6;
      case 'coin': case 'start': return 2.5;
      case 'end': return 0.4;
      default: return 1.4;
    }
  };

  // Snap any half-finished presentation (typing, title slide-in, tally count-up) to done.
  Director.prototype.finishBeat = function () {
    var ui = this.world && this.world.ui;
    if (!ui) return;
    if (ui.line) ui.line.shown = ui.line.total;
    if (ui.title) ui.title.t = 9;
    if (ui.row) ui.row.t = 9;
    ui.bubbles.forEach(function (b) { b.t = Math.max(b.t, b.delay + 9); });
  };

  Director.prototype.isPlaying = function () { return !!(this.phase === 'cmds' && this.task && this.task.isPlay); };

  Director.prototype.setAutoplay = function (on) {
    on = !!on;
    if (on === this.autoplay) return;
    this.autoplay = on;
    this.waitT = 0;
    this.emit('autoplay', on);
    this.announce(on ? 'Demo mode. Press any key to take control.' : 'You have control.');
  };

  Director.prototype.syncMusic = function () {
    var m = this.world ? this.world.music : null;
    if (m === this.lastMusic) return;
    this.lastMusic = m;
    if (MS.audio) MS.audio.music(m || null);
  };

  // Click / Space / right arrow.
  Director.prototype.next = function () {
    var w = this.world;
    if (this.guard > 0) return; // a habitual tap right after a segment shouldn't skip a line unread
    // In a play segment the first press lets Sam run there himself; the second skips.
    if (this.isPlaying() && w.play && !w.play.auto) { w.play.auto = true; this.announce('Sam runs there himself. Next again skips ahead.'); return; }
    if (this.phase === 'cmds') {
      if (this.task) this.task.finish();
      this.task = null;
      // Skip the cutscene, but never skip past the start of a play segment: hand over.
      while (this.queue.length && this.queue[0].op !== 'play') MS.commands.start(w, this.queue.shift(), { instant: true });
      if (this.queue.length) { this.update(0); this.changed(); return; }
      this.enterWait(true);
      this.changed();
      return;
    }
    var ui = w.ui;
    if (ui.line && ui.line.shown < ui.line.total) { ui.line.shown = ui.line.total; return; }
    if (ui.title && ui.title.t < 1.4) { ui.title.t = 9; return; }
    if (ui.row && ui.row.t < 0.9) { ui.row.t = 9; return; }
    var popping = ui.bubbles.some(function (b) { return b.t < b.delay + 0.15; });
    if (popping) { ui.bubbles.forEach(function (b) { b.t = Math.max(b.t, b.delay + 9); }); return; }
    this.advance();
  };

  Director.prototype.advance = function () {
    var M = this.missions[this.mi];
    if (this.si + 1 < M.steps.length) this.goto(this.mi, this.si + 1, 'play', true);
    else if (this.onMissionEnd && this.onMissionEnd(this.mi)) return; // the world map takes over (main.js)
    else if (this.mi + 1 < this.missions.length) this.goto(this.mi + 1, 0, 'play');
    else this.goto(0, 1, 'play');
  };

  Director.prototype.back = function () {
    if (this.guard > 0) return;
    if (this.si > 0) this.goto(this.mi, this.si - 1, 'instant');
    else if (this.mi > 0) {
      var pm = this.mi - 1;
      this.goto(pm, this.missions[pm].steps.length - 1, 'instant');
    }
  };

  Director.prototype.jump = function (mi) {
    if (mi >= 0 && mi < this.missions.length) this.goto(mi, mi === 0 && this.world && this.world.state.credits ? 1 : 0, 'play');
  };

  Director.prototype.setReduced = function (on) {
    this.reduced = !!on;
    if (this.world) this.world.reduced = this.reduced;
  };

  Director.prototype.announce = function (text) { this.lastAnnounce = text; this.emit('announce', text); };
  Director.prototype.changed = function () { this.emit('change'); };
  Director.prototype.on = function (fn) { this.listeners.push(fn); };
  Director.prototype.emit = function (type, data) { this.listeners.forEach(function (fn) { fn(type, data); }); };

  MS.Director = Director;
  MS.director = { BOX: BOX, exprFor: exprFor, paginate: paginate };
})(typeof window !== 'undefined' ? window : globalThis);
