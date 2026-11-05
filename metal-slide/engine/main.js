/* METAL SLIDE engine: boot. Reads the script, builds the director, sizes the stage,
   runs the frame loop, and keeps the screen-reader live region and buttons in sync. */
(function () {
  'use strict';
  var MS = window.MS;
  var W = MS.W, H = MS.H;
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('world');
  var fx = document.getElementById('fx');
  var controls = document.getElementById('controls');
  var live = document.getElementById('live');
  var soundBtn = controls.querySelector('[data-act="sound"]');
  var fullBtn = controls.querySelector('[data-act="full"]');
  var g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  function fail(err) {
    var box = document.getElementById('error');
    box.hidden = false;
    box.textContent = 'Metal Slide could not start: ' + (err && err.message ? err.message : err);
    if (window.console) console.error(err);
  }

  var director;
  if (typeof window.MS_SCRIPT !== 'string') {
    fail('script.js could not be read. The most likely cause is a backtick character somewhere in the script; remove it and refresh.');
    return;
  }
  try {
    var story = MS.parser.parse(window.MS_SCRIPT);
    if (!story.missions.length) throw new Error('script.js has no MISSION lines yet. Start a mission with a line like "MISSION 1: THE CAVE".');
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    director = new MS.Director(story, { reduced: !!(mq && mq.matches) });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { applyPrefs(); });
  } catch (err) { fail(err); return; }

  if (director.warnings.length && window.console) {
    console.info('[Metal Slide] script notes (press the ` key in the game to see them on screen):\n' +
      director.warnings.map(function (w) { return '  line ' + w.line + ': ' + w.message; }).join('\n'));
  }

  var game = {
    director: director, time: 0, debug: false, showHint: true, advances: 0, idle: 0, paused: false,
    touch: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
    lastDevice: 'key', presenter: /present/.test(location.hash), idleLimit: 30,
    // Any input resets the idle clock. Returns true if it woke the game from demo mode,
    // in which case the caller should swallow the input. After a hand-back the demo
    // waits longer before taking over again, so a slow reader isn't hijacked.
    wake: function () {
      this.idle = 0;
      if (director.autoplay) { director.setAutoplay(false); this.attract = false; this.idleLimit = 45; return true; }
      return false;
    },
    toggleWatch: function () {
      this.idle = 0;
      if (director.autoplay) { director.setAutoplay(false); this.attract = false; this.idleLimit = 45; }
      else director.setAutoplay(true);
      syncWatch();
    },
    next: function () {
      if (this.screen === 'map') { if (mapUI) mapUI.next(mapHere); return; }
      this.advances++;
      if (this.advances > 4) this.showHint = false;
      director.next();
    },
    back: function () { if (this.screen !== 'map') director.back(); },
    jump: function (n) {
      if (this.screen === 'map') { if (n === 0) { closeMap(); director.goto(0, 0, 'play'); } else playChapter(n); return; }
      director.jump(n);
    },
    openMap: function () { openMap(director.mi >= 1 ? director.mi : nextChapter(), { open: true }); },
    toggleDebug: function () { this.debug = !this.debug; },
    toggleMute: function () { if (MS.audio) MS.audio.toggleMute(); syncSound(); },
    fullscreen: function () {
      var d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else {
        var el = document.getElementById('app');
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) req.call(el);
      }
    },
    poke: function () {
      var app = document.getElementById('app');
      app.classList.add('awake');
      clearTimeout(this._sleep);
      this._sleep = setTimeout(function () { app.classList.remove('awake'); }, 2500);
    }
  };

  function syncSound() {
    var muted = MS.audio ? MS.audio.isMuted() : true;
    soundBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    soundBtn.classList.toggle('muted', muted);
  }
  if (MS.audio && MS.audio.onChange) MS.audio.onChange(syncSound);
  syncSound();
  var watchBtn = controls.querySelector('[data-act="watch"]');
  function syncWatch() { if (watchBtn) watchBtn.setAttribute('aria-pressed', director.autoplay ? 'true' : 'false'); }
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) fullBtn.hidden = true;

  director.on(function (type, data) {
    if (type === 'announce') live.textContent = data;
    if (type === 'change' && director.world) stage.setAttribute('data-era', director.world.era);
  });

  // Fit the stage to the window: crisp integer scaling unless that wastes >10% of the space.
  function viewport() {
    var vv = window.visualViewport;
    var de = document.documentElement;
    return [Math.min(window.innerWidth, de.clientWidth || Infinity, vv ? vv.width : Infinity),
      Math.min(window.innerHeight, de.clientHeight || Infinity, vv ? vv.height : Infinity)];
  }

  // Safe-area insets (notches), read off #safe, whose padding is env(safe-area-inset-*).
  function insets() {
    var el = document.getElementById('safe');
    var cs = el ? window.getComputedStyle(el) : null;
    var px = function (k) { return cs ? parseFloat(cs[k]) || 0 : 0; };
    return { t: px('paddingTop'), r: px('paddingRight'), b: px('paddingBottom'), l: px('paddingLeft') };
  }
  var HUD_GAP = [179, 312]; // game px between the TIME digits and PRESS START, where 'over' buttons go

  // Buttons go below the game when there's room (phones in portrait), in the side
  // margin when there's room there (phones in landscape), otherwise over the top edge.
  function placeControls(vw, vh) {
    var r = stage.getBoundingClientRect();
    var below = vh - r.bottom, side = r.left;
    var touch = document.getElementById('app').classList.contains('touch');
    controls.classList.remove('below', 'side', 'over', 'stack');
    controls.style.removeProperty('--b'); controls.style.removeProperty('--g');
    if (below >= 60) {
      controls.classList.add('below');
      controls.style.left = (vw / 2) + 'px'; controls.style.top = (r.bottom + 10) + 'px';
    } else if (side >= 60 && touch) {
      // The touch pad owns the bottom of both margins, so the buttons stack two wide at
      // the top of the right one, clear of JUMP and FIRE.
      controls.classList.add('side', 'stack');
      controls.style.left = (r.right + side / 2) + 'px'; controls.style.top = Math.max(r.top, insets().t + 8) + 'px';
    } else if (side >= 60) {
      controls.classList.add('side');
      controls.style.left = (r.right + side / 2) + 'px'; controls.style.top = (r.top + r.height / 2) + 'px';
    } else {
      // over the picture: in the HUD's free gap between the TIME digits and PRESS START,
      // with the buttons shrunk (never under 24px) when the game is drawn small
      controls.classList.add('over');
      var k = r.width / W, n = 0;
      Array.prototype.forEach.call(controls.children, function (b) { if (!b.hidden) n++; });
      var gap = k < 1.6 ? 4 : 8;
      var b = Math.max(24, Math.min(40, Math.floor(((HUD_GAP[1] - HUD_GAP[0]) * k - 8 - gap * (n - 1)) / n)));
      if (b < 40) { controls.style.setProperty('--b', b + 'px'); controls.style.setProperty('--g', gap + 'px'); }
      controls.style.left = (r.left + k * (HUD_GAP[0] + HUD_GAP[1]) / 2) + 'px'; controls.style.top = (r.top + 6) + 'px';
    }
  }

  function fit() {
    var v = viewport(), vw = v[0], vh = v[1];
    var s = Math.min(vw / W, vh / H);
    var si = Math.floor(s);
    var scale = si >= 1 && si / s >= 0.9 ? si : s;
    // Touch play is gestures on the picture itself, so phones get the biggest game that
    // fits inside the notches: no thumb margins to reserve.
    var appEl = document.getElementById('app');
    if (appEl && appEl.classList.contains('touch')) {
      var ins = insets();
      scale = Math.min(scale, (vw - ins.l - ins.r) / W, (vh - ins.t - ins.b) / H);
    }
    var cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    stage.style.setProperty('--px', scale + 'px');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fx.width = Math.max(1, Math.round(cw * dpr / 2));
    fx.height = Math.max(1, Math.round(ch * dpr / 2));
    placeControls(vw, vh);
    if (linksEl && !linksEl.hidden) placeLinks();
    if (mapUI) mapUI.fit(scale);
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();

  MS.input.bind(game, stage, controls);
  director.input = MS.input.controls;
  stage.addEventListener('pointermove', function () { game.poke(); });

  // Touch: gestures on the stage (input.js); main.js only flags touch and fits the stage.
  var app = document.getElementById('app');
  if (game.touch) { app.classList.add('touch'); fit(); }

  // Options (Escape or the gear button), remembered in this browser. reduced: null means
  // follow the system's reduce-motion setting.
  var PREFS_KEY = 'metalSlide.prefs';
  var prefs = { idleDemo: true, reduced: null, letterKeys: true };
  try {
    var saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}');
    Object.keys(prefs).forEach(function (k) { if (saved && saved[k] !== undefined) prefs[k] = saved[k]; });
  } catch (e) { /* private mode or blocked storage: defaults */ }
  function savePrefs() { try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* not remembered */ } }
  function reducedNow() { return prefs.reduced == null ? !!(mq && mq.matches) : !!prefs.reduced; }
  function applyPrefs() {
    director.setReduced(reducedNow());
    app.classList.toggle('reduced', reducedNow());
    MS.input.setLetterKeys(prefs.letterKeys);
    game.idle = 0;
  }
  applyPrefs();

  // The game pauses while the dialog is open. Focus goes back where it was (the gear,
  // when it was opened from the keyboard).
  var dialog = document.getElementById('options');
  var opt = { idleDemo: document.getElementById('opt-demo'), reduced: document.getElementById('opt-motion'), letterKeys: document.getElementById('opt-keys') };
  var returnFocus = null;
  game.openOptions = function () {
    if (!dialog || dialog.open) return;
    opt.idleDemo.checked = !!prefs.idleDemo; opt.reduced.checked = reducedNow(); opt.letterKeys.checked = !!prefs.letterKeys;
    var a = document.activeElement;
    returnFocus = a && a !== document.body && controls.contains(a) ? a : null;
    game.paused = true;
    MS.input.release();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  };
  if (dialog) {
    Object.keys(opt).forEach(function (k) {
      opt[k].addEventListener('change', function () { prefs[k] = opt[k].checked; savePrefs(); applyPrefs(); });
    });
    dialog.addEventListener('click', function (e) { // a click or tap outside the panel closes it
      var r = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
    dialog.addEventListener('close', function () {
      game.paused = false; game.idle = 0;
      if (returnFocus) returnFocus.focus();
      returnFocus = null;
    });
  }

  // Case-study links (CASE STUDY: lines) sit under a mission's results, from MISSION
  // COMPLETE until the next mission. Real links: Tab reaches them, they open a new tab.
  var linksEl = document.getElementById('links');
  var linksFor = null;
  var ARROW = '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M3 0h5v5H7V2H6v1H5v1H4v1H3v1H2v1H1V6h1V5h1V4h1V3h1V2H3z"/></svg>';
  function syncLinks() {
    if (!linksEl) return;
    var M = director.missions[director.mi], w = director.world;
    var show = !!(M && M.links && M.links.length && w && w.tally);
    var key = show ? director.mi : null;
    if (key === linksFor) { if (show) placeLinks(); return; }
    linksFor = key;
    linksEl.textContent = '';
    linksEl.hidden = !show;
    if (!show) return;
    var cap = document.createElement('span');
    cap.className = 'cap'; cap.setAttribute('aria-hidden', 'true');
    cap.textContent = M.links.length > 1 ? 'Read the case studies' : 'Read the case study';
    linksEl.appendChild(cap);
    M.links.forEach(function (l) {
      var a = document.createElement('a');
      a.href = l.url; a.target = '_top'; // a pathway: on the site the nav bar brings you back
      a.innerHTML = ARROW;
      a.insertBefore(document.createTextNode(l.label + ' '), a.firstChild);
      var sr = document.createElement('span');
      sr.className = 'sr-only'; sr.textContent = '(case study)';
      a.appendChild(sr);
      linksEl.appendChild(a);
    });
    placeLinks();
  }
  function placeLinks() {
    var r = stage.getBoundingClientRect();
    linksEl.style.left = (r.left + r.width / 2) + 'px';
    linksEl.style.top = (r.bottom - r.height * (4 / H)) + 'px';
    linksEl.style.maxWidth = Math.round(r.width - 16) + 'px';
  }

  // ---------------------------------------------------------------- the world map
  // "How I transformed the company": where the title leads and every chapter returns,
  // so players can jump to any chapter. Chapters are the missions after the title.
  // Which chapters were played is remembered in this browser.
  var PROGRESS_KEY = 'metalSlide.progress';
  var progress = {};
  try { (JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '{}').done || []).forEach(function (n) { progress[n] = true; }); } catch (e) { /* not remembered */ }
  function saveProgress() { try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ done: Object.keys(progress).map(Number) })); } catch (e) { /* not remembered */ } }
  var chapterCount = director.missions.length - 1;
  var mapT = 0, mapHere = 1, mapActive = null, mapAuto = 0;
  var mapUI = MS.worldmap && MS.mapui ? MS.mapui.create({
    stage: stage, host: document.getElementById('app'), missions: director.missions, journey: director.story.journey,
    onPlay: function (n) { playChapter(n); },
    onActive: function (n) { mapActive = n; }
  }) : null;
  if (mapUI) mapUI.fit(stage.getBoundingClientRect().width / W);
  var pathwayCounts = {};
  director.missions.forEach(function (M, i) { if (i && M.links) pathwayCounts[i] = M.links.length; });
  function nextChapter() { for (var n = 1; n <= chapterCount; n++) if (!progress[n]) return n; return 0; }
  function openMap(here, how) {
    if (!mapUI) return false;
    game.screen = 'map'; mapT = 0; mapAuto = 0; mapActive = null;
    mapHere = here || nextChapter() || chapterCount;
    app.classList.add('on-map'); app.classList.remove('playing'); wasPlaying = false;
    MS.input.release();
    stage.setAttribute('data-era', 'map');
    if (MS.audio) MS.audio.music('title');
    director.lastMusic = 'title'; // so the chapter's own track starts again when it plays
    if (linksEl) { linksEl.hidden = true; linksFor = null; }
    mapUI.show({ done: progress, here: mapHere, open: how && how.open, focus: how && how.focus });
    var played = Object.keys(progress).length;
    live.textContent = (director.story.journey || 'The journey') + '. World map: ' + chapterCount + ' chapters' +
      (played ? ', ' + played + ' played' : '') + '. Choose one to see what it is about, then Play now.';
    placeControls(viewport()[0], viewport()[1]);
    return true;
  }
  function closeMap() {
    if (!mapUI || game.screen !== 'map') return;
    mapUI.hide(); game.screen = 'game'; app.classList.remove('on-map');
  }
  function playChapter(n) {
    if (!mapUI || n < 1 || n > chapterCount) return;
    closeMap();
    director.goto(n, 0, 'play');
    stage.setAttribute('data-era', director.world.era);
    placeControls(viewport()[0], viewport()[1]);
  }
  // A chapter (or the title) has ended: back to the map, suggesting what comes next. The
  // title's attract demo plays one chapter, then returns to the title.
  director.onMissionEnd = function (mi) {
    if (!mapUI) return false;
    if (game.attract && mi >= 1) { director.setAutoplay(false); game.attract = false; director.goto(0, 0, 'play'); return true; }
    if (mi >= 1 && !progress[mi]) { progress[mi] = true; saveProgress(); }
    var next = mi >= 1 && mi < chapterCount ? mi + 1 : nextChapter() || (mi >= 1 ? mi : 1);
    return openMap(next, { open: true, focus: director.autoplay ? null : 'play' });
  };
  director.on(function (type) {
    if (type !== 'change' || director.mi < 1) return;
    var w = director.current().step.wait;
    if (w && w.type === 'complete' && !progress[director.mi]) { progress[director.mi] = true; saveProgress(); }
  });
  function mapTick(dt) {
    mapT += dt;
    if (director.autoplay) { // the demo lingers on the map, then plays the suggested chapter
      mapAuto += dt;
      if (mapAuto > 3.5) playChapter(mapHere);
    }
  }
  function drawMap() {
    MS.worldmap.draw(g, mapT, {
      title: director.story.journey || 'The journey', done: progress, active: mapActive, here: mapHere,
      pathways: pathwayCounts, reduced: director.reduced
    });
  }

  // Demo mode: 30s idle (45s after a hand-back). On the title it runs as an arcade
  // attract loop: plays mission 1, then back to the title.
  var wasPlaying = null, wasDemo = null;
  function syncModes() {
    var playing = game.screen !== 'map' && director.isPlaying(), demo = director.autoplay;
    if (playing !== wasPlaying) {
      app.classList.toggle('playing', playing); wasPlaying = playing;
      MS.input.dropPresses(); // no stale jump/fire presses across the switch; held directions carry over
    }
    if (demo !== wasDemo) { app.classList.toggle('demo', demo); wasDemo = demo; syncWatch(); }
  }
  function idleTick(dt) {
    if (director.autoplay) {
      if (game.attract && director.mi >= 2) { director.setAutoplay(false); game.attract = false; director.goto(0, 0, 'play'); }
      return;
    }
    if (MS.input.any() || !prefs.idleDemo) { game.idle = 0; return; } // Options can turn the idle demo off
    game.idle += dt;
    var onTitle = director.mi === 0 && game.screen !== 'map';
    if (game.idle >= game.idleLimit) {
      game.attract = onTitle;
      director.setAutoplay(true);
    }
  }

  var bloomOn = false;
  function render() {
    if (game.screen === 'map') {
      drawMap();
      if (bloomOn) { MS.render.bloom(fx, canvas, 0); bloomOn = false; }
      return;
    }
    MS.render.draw(g, director, game);
    var want = director.world && director.world.era === 'future' && !director.current().mission.isTitle;
    if (want) { MS.render.bloom(fx, canvas, 0.5); bloomOn = true; }
    else if (bloomOn) { MS.render.bloom(fx, canvas, 0); bloomOn = false; }
  }

  // One fixed 60 Hz step: jump arcs come out the same on 60, 120 and 144 Hz screens.
  var STEP = 1 / 60;
  function step(dt) {
    game.time += dt;
    MS.input.pollGamepad();
    idleTick(dt);
    if (game.screen === 'map') { mapTick(dt); syncModes(); return; }
    // The touch runner: in a play section a touch player's Sam runs toward the mark by himself.
    var p = director.world && director.world.play;
    MS.input.setRunner(p && director.isPlaying() && game.lastDevice === 'touch' ? p.dir : 0);
    director.update(dt);
    syncModes();
    syncLinks();
  }

  var last = null, acc = 0;
  function frame(now) {
    if (last == null) last = now;
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      var n = 0;
      while (acc >= STEP && n++ < 5) { if (!MS.debug.paused && !game.paused) step(STEP); acc -= STEP; }
      if (n >= 5) acc = 0;
      render();
    } catch (err) { fail(err); return; }
    requestAnimationFrame(frame);
  }

  director.goto(0, 0, 'play');
  stage.setAttribute('data-era', director.world.era);
  // Deep links: #map opens the world map, #chapter-3 opens it on chapter 3's card.
  var deep = /^#(map|chapter-(\d+))$/i.exec(location.hash || '');
  if (deep) openMap(deep[2] ? Number(deep[2]) : nextChapter() || 1, deep[2] ? { open: true, focus: 'play' } : null);
  requestAnimationFrame(frame);

  // Hooks for testing (the preview tab can run hidden, where animation frames pause).
  MS.debug = {
    director: director, game: game, paused: false,
    goto: function (mi, si, mode) { closeMap(); director.goto(mi, si || 0, mode || 'instant'); render(); return director.current().step.wait; },
    map: function (here) { openMap(here || 1, { open: true }); render(); return game.screen; },
    tick: function (seconds) { var n = Math.round((seconds || 0) * 60); for (var i = 0; i < n; i++) step(1 / 60); render(); return director.phase; },
    next: function () { game.next(); render(); return [director.mi, director.si, director.phase]; },
    render: render,
    autoplay: function (on) { director.setAutoplay(on); return director.autoplay; },
    mode: function () { return director.isPlaying() ? 'play' : 'scene'; },
    warnings: function () { return director.warnings; }
  };
})();
