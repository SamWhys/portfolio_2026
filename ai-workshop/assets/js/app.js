/*
  app.js — the engine.

  Classic script (no modules). Reads the TALK and CASE_STUDIES globals defined
  in data.js. Wrapped in an IIFE so the engine adds nothing to the global scope
  beyond what data.js intentionally exposes.

  Nav model: hub-and-spoke.
    - Hub  = home screen with the three case-study cards.
    - Study = one case study, reached by clicking a card or pressing 1/2/3.
    - Home is always reachable (Esc / H / the persistent Home control).

  ONE TEMPLATE: renderCaseStudy(cs) renders every case study from a single data
  object — title bar, the STAR one-liner, and the ordered beats revealed one at
  a time. No per-case-study bespoke layout.

  RESET DISCIPLINE: entering a study always starts at beat 0, so leaving one
  (Esc, Home, or jumping to another) resets it — a mis-click never strands the
  presenter.
*/
(function () {
  'use strict';

  var root = document.getElementById('app');

  /* ---- single source of truth for what's on screen ---- */
  var state = {
    view: 'hub',     // 'hub' | 'study'
    studyId: null,   // id of the current case study when view === 'study'
    beatIndex: 0     // index of the deepest revealed beat
  };
  // Hub-only hook: the wrap-up's "reveal next" step, set by renderTakeaways so the
  // global key handler can advance it with Space / arrow-right. Null until rendered.
  var takeawayAdvance = null;
  // Hub-only hook: reveals the closing "Thank you" module, but only once the wrap-up
  // (finale included) is fully shown. Set by renderThanks; null until rendered.
  var thanksReveal = null;

  /* ---- tiny DOM helper ----
     h('div', {class:'x', text:'hi', onclick:fn}, child, [child, child], ...)
     - 'class'/'text' are special; 'on*' attach listeners; null values skip.
     - children may be nodes, strings, null, or arrays of those. */
  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      for (var key in props) {
        var val = props[key];
        if (val == null) continue;
        if (key === 'class') node.className = val;
        else if (key === 'text') node.textContent = val;
        else if (key.slice(0, 2) === 'on' && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
          node.setAttribute(key, val);
        }
      }
    }
    for (var i = 2; i < arguments.length; i++) appendChild(node, arguments[i]);
    return node;
  }
  function appendChild(node, child) {
    if (child == null) return;
    if (Array.isArray(child)) { child.forEach(function (c) { appendChild(node, c); }); return; }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function focusEl(el) {
    if (el && typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
  }

  // Calm scrolling — smooth normally, instant under prefers-reduced-motion.
  function scrollToTop() {
    try { window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  }
  function scrollIntoViewCalm(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try { el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' }); }
    catch (e) { el.scrollIntoView(); }
  }

  /* ---- data lookups ---- */
  function studyIndex(id) {
    for (var i = 0; i < CASE_STUDIES.length; i++) if (CASE_STUDIES[i].id === id) return i;
    return -1;
  }
  function studyById(id) {
    var i = studyIndex(id);
    return i === -1 ? null : CASE_STUDIES[i];
  }
  function lastBeatIndex() {
    var cs = studyById(state.studyId);
    var n = cs && cs.beats ? cs.beats.length : 0;
    return Math.max(0, n - 1);
  }

  /* ---- navigation ---- */
  function showHub() {
    state.view = 'hub';
    state.studyId = null;
    state.beatIndex = 0;
    renderHub();
  }

  function showStudy(id, direction) {
    if (!studyById(id)) return;
    state.view = 'study';
    state.studyId = id;
    state.beatIndex = 0;          // entry ALWAYS resets — the reset discipline
    renderStudy(direction || 'forward');
  }

  function setBeat(i, direction) {
    var clamped = Math.max(0, Math.min(i, lastBeatIndex()));
    // No-op at the ends (avoids re-animating); reset always re-renders.
    if (direction !== 'reset' && clamped === state.beatIndex) return;
    state.beatIndex = clamped;
    renderStudy(direction);
  }

  function nextBeat()  { if (state.view === 'study') setBeat(state.beatIndex + 1, 'forward'); }
  function prevBeat()  { if (state.view === 'study') setBeat(state.beatIndex - 1, 'back'); }
  function resetStudy(){ if (state.view === 'study') setBeat(0, 'reset'); }
  function jumpTo(n) {
    var idx = n - 1; // 1/2/3 -> 0/1/2
    if (idx >= 0 && idx < CASE_STUDIES.length) showStudy(CASE_STUDIES[idx].id, 'forward');
  }

  /* ---- hub view ---- */
  function renderHub() {
    root.innerHTML = '';

    // Dark hero band with the animated arc-reactor behind the title.
    var fx = h('canvas', { class: 'hero__fx', 'aria-hidden': 'true' });
    var hero = h('section', { class: 'hub__hero' },
      fx,
      h('div', { class: 'hero__inner' },
        h('h1', { class: 'hub__title', tabindex: '-1', text: TALK.title }),
        h('p', { class: 'hub__through-line', text: TALK.throughLine })
      )
    );

    var grid = h('ul', { class: 'hub__grid' });
    CASE_STUDIES.forEach(function (cs, i) { grid.appendChild(renderCard(cs, i)); });

    var body = h('div', { class: 'hub__body' },
      TALK.teamAI ? renderTeamAI(TALK.teamAI) : null,
      TALK.introHeading ? h('h2', { class: 'hub__section-title', text: TALK.introHeading }) : null,
      TALK.intro ? (Array.isArray(TALK.intro) ? TALK.intro : [TALK.intro]).map(function (para) {
        return h('p', { class: 'hub__overview', text: para });
      }) : null,
      (TALK.tools && TALK.tools.length) ? renderToolStrip(TALK.tools) : null,
      grid,
      h('p', { class: 'hub__hint', text: 'Click a case study, or press 1, 2, 3' }),
      TALK.takeaways ? renderTakeaways(TALK.takeaways) : null,
      TALK.thanks ? renderThanks(TALK.thanks) : null
    );

    root.appendChild(h('main', { class: 'hub' }, hero, body));
    startHeroFx(fx);
    focusEl(hero.querySelector('.hub__title'));
  }

  // Arc-reactor hero animation (canvas, offline). Calm continuous motion; under
  // prefers-reduced-motion it paints ONE static frame and never loops. The rAF
  // loop self-terminates when the canvas leaves the DOM (navigating off the hub).
  function startHeroFx(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var reduce = prefersReducedMotion();
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    function fit() {
      var w = canvas.clientWidth, hgt = canvas.clientHeight;
      var bw = Math.round(w * dpr), bh = Math.round(hgt * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      return { w: w, h: hgt };
    }
    function ring(r, lw, color) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    }
    function arcSeg(r, a0, a1, color, lw) {
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1);
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    }
    // Graduated tick ring; every `major`-th tick is longer + brighter.
    function tickRing(r, n, rot, major, inner, outer, minorColor) {
      ctx.save(); ctx.rotate(rot);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2, big = (i % major === 0);
        var r1 = r * outer, r2 = r * (big ? inner - 0.05 : inner);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.strokeStyle = big ? 'rgba(56,189,248,0.5)' : minorColor;
        ctx.lineWidth = big ? 1.6 : 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }
    // Ring drawn as `segs` arcs with a `gap` (radians) between them (HUD look).
    function gappedRing(r, lw, color, segs, gap) {
      var seg = (Math.PI * 2) / segs;
      for (var i = 0; i < segs; i++) {
        arcSeg(r, i * seg + gap / 2, (i + 1) * seg - gap / 2, color, lw);
      }
    }
    function polygon(sides, r, color, lw) {
      ctx.beginPath();
      for (var i = 0; i <= sides; i++) {
        var a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    }
    function nodeDot(x, y, rad, color) {
      ctx.save();
      ctx.shadowColor = 'rgba(56,189,248,0.9)'; ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Orbiting nodes joined into a faint constellation; the dots gently pulse.
    function orbit(r, count, rot, tt, alpha) {
      var pts = [], i;
      for (i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2 + rot;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      ctx.strokeStyle = 'rgba(120,190,255,' + (0.14 * alpha) + ')'; ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        var p = pts[i], q = pts[(i + 1) % pts.length];
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      for (i = 0; i < pts.length; i++) {
        var pl = reduce ? 1 : (0.7 + 0.3 * Math.sin(tt * 0.003 + i));
        nodeDot(pts[i][0], pts[i][1], 2.2 * pl, 'rgba(185,228,255,' + (0.9 * alpha) + ')');
      }
    }
    // Energy pulses: rings expanding out from the core and fading.
    function pulses(tt, r) {
      var period = 2600, p;
      for (p = 0; p < 2; p++) {
        var ph = ((tt + p * period * 0.5) % period) / period;
        var pr = r * 0.2 + ph * (r * 0.78);
        ring(pr, 1.5, 'rgba(56,189,248,' + (0.24 * (1 - ph)) + ')');
      }
    }

    function draw(t) {
      var dim = fit(), w = dim.w, hgt = dim.h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);

      var cx = w > 760 ? w * 0.80 : w * 0.5;
      var cy = hgt * 0.5;
      var R = Math.max(30, Math.min(hgt * 0.44, w * 0.27));
      var TT = reduce ? 0 : t;                        // frozen time under reduced motion

      ctx.save();
      ctx.translate(cx, cy);

      var pulse = reduce ? 1 : (1 + 0.06 * Math.sin(t * 0.002));
      var coreR = R * 0.24 * pulse;

      // rotating radar sweep (soft wedge + bright leading edge)
      ctx.save();
      ctx.rotate(TT * 0.00018);
      var sweep = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, R);
      sweep.addColorStop(0, 'rgba(56,189,248,0)');
      sweep.addColorStop(1, 'rgba(56,189,248,0.10)');
      ctx.fillStyle = sweep;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.97, -0.9, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,210,255,0.30)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.97, 0); ctx.stroke();
      ctx.restore();

      // outer ring + two counter-rotating graduated tick rings
      ring(R, 1, 'rgba(120,170,255,0.16)');
      tickRing(R, 84, TT * 0.00003, 6, 0.86, 0.94, 'rgba(120,170,255,0.2)');
      tickRing(R * 0.9, 120, -TT * 0.00002, 10, 0.9, 0.95, 'rgba(120,170,255,0.12)');

      // gapped HUD ring
      ctx.save(); ctx.rotate(TT * 0.00007);
      gappedRing(R * 0.82, 2, 'rgba(56,189,248,0.4)', 4, 0.16);
      ctx.restore();

      // dashed mid ring (counter-rotating)
      ctx.save();
      ctx.rotate(-TT * 0.00009);
      ctx.setLineDash([R * 0.1, R * 0.09]);
      ring(R * 0.66, 2, 'rgba(56,189,248,0.42)');
      ctx.setLineDash([]);
      ctx.restore();

      // slow-rotating hexagon frame
      ctx.save(); ctx.rotate(TT * 0.00005);
      polygon(6, R * 0.58, 'rgba(120,170,255,0.14)', 1);
      ctx.restore();

      // segmented HUD arcs at two radii, different speeds/directions
      ctx.save(); ctx.rotate(TT * 0.00014);
      arcSeg(R * 0.54, -0.2, 1.1, 'rgba(99,179,255,0.82)', 2.5);
      arcSeg(R * 0.54, Math.PI + 0.1, Math.PI + 1.0, 'rgba(99,179,255,0.82)', 2.5);
      ctx.restore();
      ctx.save(); ctx.rotate(-TT * 0.00011);
      arcSeg(R * 0.44, 0.6, 1.9, 'rgba(120,210,255,0.6)', 1.8);
      arcSeg(R * 0.44, Math.PI + 0.6, Math.PI + 1.7, 'rgba(120,210,255,0.6)', 1.8);
      ctx.restore();

      // orbiting nodes + constellation (two rings)
      orbit(R * 0.72, 6, TT * 0.00008, t, 1);
      orbit(R * 0.92, 3, -TT * 0.00005, t, 0.6);

      // energy pulses radiating from the core
      if (!reduce) pulses(t, R);

      // spokes from the core
      ctx.save();
      ctx.rotate(-TT * 0.00006);
      for (var s = 0; s < 8; s++) {
        var sa = (s / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * coreR * 1.15, Math.sin(sa) * coreR * 1.15);
        ctx.lineTo(Math.cos(sa) * R * 0.4, Math.sin(sa) * R * 0.4);
        ctx.strokeStyle = 'rgba(120,180,255,0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();

      // glowing core (gentle pulse) + hot flickering centre + inner ring
      var grad = ctx.createRadialGradient(0, 0, coreR * 0.1, 0, 0, coreR);
      grad.addColorStop(0, 'rgba(235,248,255,0.98)');
      grad.addColorStop(0.45, 'rgba(56,189,248,0.9)');
      grad.addColorStop(1, 'rgba(59,130,246,0.04)');
      ctx.save();
      ctx.shadowColor = 'rgba(56,189,248,0.9)';
      ctx.shadowBlur = reduce ? 20 : (20 + 7 * Math.sin(t * 0.002));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      var flick = reduce ? 1 : (0.85 + 0.15 * Math.sin(t * 0.017));
      ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * flick) + ')';
      ctx.beginPath(); ctx.arc(0, 0, coreR * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,235,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, coreR * 1.25, 0, Math.PI * 2); ctx.stroke();

      ctx.restore();
    }

    if (reduce) { draw(0); return; } // one static frame, no motion
    requestAnimationFrame(function loop(t) {
      if (!canvas.isConnected) return; // hub left the DOM — stop the loop
      draw(t);
      requestAnimationFrame(loop);
    });
  }

  // Final takeaways — a native <details> the presenter can expand at the foot of
  // the hub. Native disclosure = keyboard-accessible, offline, no extra JS.
  // Hub overview of how the team uses AI — heading, lead, four stat cards, and a
  // short reliability / what's-next note. Fully data-driven from TALK.teamAI.
  function renderTeamAI(t) {
    var sec = h('section', { class: 'teamai' });
    sec.appendChild(h('h2', { class: 'teamai__title', text: t.title }));
    if (t.lead) sec.appendChild(h('p', { class: 'teamai__lead', text: t.lead }));
    var grid = h('div', { class: 'teamai__grid' });
    (t.areas || []).forEach(function (a) {
      grid.appendChild(h('div', { class: 'teamai__card' },
        h('span', { class: 'teamai__ico' }, iconSvg(a.icon)),
        h('div', { class: 'teamai__stat', text: a.stat }),
        h('div', { class: 'teamai__label', text: a.label }),
        h('p', { class: 'teamai__text', text: a.text })
      ));
    });
    sec.appendChild(grid);
    if (t.note) sec.appendChild(h('p', { class: 'teamai__note', text: t.note }));
    if (t.next) sec.appendChild(h('p', { class: 'teamai__next', text: t.next }));
    return sec;
  }

  // The 4D framework for AI fluency: a full-width panel revealed as a step inside
  // the wrap-up. Brief intro + four competency cards (Delegation / Description /
  // Discernment / Diligence), each with an icon. Credited to Dakan & Feller.
  function renderFramework(f) {
    var panel = h('section', { class: 'framework' });
    panel.appendChild(h('h3', { class: 'framework__title', text: f.title }));
    if (f.intro) panel.appendChild(h('p', { class: 'framework__intro', text: f.intro }));
    var grid = h('div', { class: 'framework__grid' });
    (f.items || []).forEach(function (d) {
      grid.appendChild(h('div', { class: 'framework__card' },
        h('span', { class: 'framework__ico', 'aria-hidden': 'true' }, iconSvg(d.icon)),
        h('h4', { class: 'framework__d', text: d.title }),
        h('p', { class: 'framework__text', text: d.text })
      ));
    });
    panel.appendChild(grid);
    if (f.source) panel.appendChild(h('p', { class: 'framework__source', text: f.source }));
    return panel;
  }

  // Grand finale: a human (left) and an AI (right) wrapped in an animated figure-8
  // that flows between them, for the harmonious human-in-the-loop. Vertically stacked:
  // the animation, then the heading, then the closing line. The flowing comet is CSS
  // (frozen to the full loop under prefers-reduced-motion, see styles.css).
  function renderFinale(it) {
    // Figure-8 sized to wrap fully OUTSIDE both circles (centres 205 & 455, r70), crossing in the gap.
    // Each lobe's rounded end is a true circle of radius 115 centred on the halo (170/490,150),
    // so the r90 circle sits with an equal ~25px gap top/left/bottom; a tail tapers to the crossing.
    var loop = 'M330 150 C300 70 240 35 170 35 C106.5 35 55 86.5 55 150 C55 213.5 106.5 265 170 265 C240 265 300 230 330 150 C360 70 420 35 490 35 C553.5 35 605 86.5 605 150 C605 213.5 553.5 265 490 265 C420 265 360 230 330 150 Z';
    var grad = svgEl('linearGradient', { id: 'finaleGrad', x1: '0', y1: '0', x2: '1', y2: '0' },
      svgEl('stop', { offset: '0',    'stop-color': '#16c95f' }),   // bright green (human)
      svgEl('stop', { offset: '0.26', 'stop-color': '#06b6d4' }),   // cyan
      svgEl('stop', { offset: '0.5',  'stop-color': '#3b82f6' }),   // blue
      svgEl('stop', { offset: '0.74', 'stop-color': '#6366f1' }),   // indigo
      svgEl('stop', { offset: '1',    'stop-color': '#5a40c8' })    // purple (AI)
    );
    // Human: head + shoulders, nestled in the left lobe of the loop. Clipped to the
    // halo so the shoulders fill the circle (avatar style) instead of spilling past it.
    var human = svgEl('g', { 'class': 'finale__human', 'clip-path': 'url(#finaleClipH)' },
      svgEl('circle', { cx: 170, cy: 112, r: 34 }),
      svgEl('path', { d: 'M116 228 C116 164 224 164 224 228' })
    );
    // AI: antenna + head + shoulders (mirrors the human), nestled in the right lobe. Clipped to its halo.
    var ai = svgEl('g', { 'class': 'finale__ai', 'clip-path': 'url(#finaleClipA)' },
      svgEl('circle', { 'class': 'finale__ai-dot', cx: 490, cy: 70, r: 8 }),
      svgEl('line', { x1: 490, y1: 78, x2: 490, y2: 92 }),
      svgEl('rect', { x: 440, y: 92, width: 100, height: 74, rx: 18 }),
      svgEl('circle', { cx: 470, cy: 125, r: 9 }),
      svgEl('circle', { cx: 510, cy: 125, r: 9 }),
      svgEl('line', { x1: 471, y1: 150, x2: 509, y2: 150 }),
      svgEl('path', { d: 'M438 228 C438 164 542 164 542 228' })
    );
    var svg = svgEl('svg', { 'class': 'finale__svg', viewBox: '0 0 660 300', 'aria-hidden': 'true' },
      svgEl('defs', null, grad,
        svgEl('clipPath', { id: 'finaleClipH' }, svgEl('circle', { cx: 170, cy: 150, r: 90 })),
        svgEl('clipPath', { id: 'finaleClipA' }, svgEl('circle', { cx: 490, cy: 150, r: 90 }))
      ),
      svgEl('circle', { 'class': 'finale__halo--h', cx: 170, cy: 150, r: 90 }),
      svgEl('circle', { 'class': 'finale__halo--a', cx: 490, cy: 150, r: 90 }),
      svgEl('path', { 'class': 'finale__track', d: loop, pathLength: '100' }),
      svgEl('path', { 'class': 'finale__flow',  d: loop, pathLength: '100' }),
      human,
      ai
    );
    return h('div', { class: 'finale' },
      h('div', { class: 'finale__anim' }, svg),
      h('h3', { class: 'finale__title', text: it.title }),
      it.text ? h('p', { class: 'finale__text', text: it.text }) : null
    );
  }

  // Closing sign-off module, sits below the wrap-up as the last thing on the hub.
  function renderThanks(t) {
    var sec = h('section', { class: 'thanks is-pending' });
    sec.appendChild(h('h2', { class: 'thanks__title', text: t.title || 'Thank you' }));
    if (t.subtitle) sec.appendChild(h('p', { class: 'thanks__subtitle', text: t.subtitle }));
    // Revealed as the very last step, only after the wrap-up (finale included) is done.
    thanksReveal = function () {
      if (!sec.classList.contains('is-pending')) return false;
      sec.classList.remove('is-pending');
      sec.classList.add('is-in');
      sec.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      return true;
    };
    return sec;
  }

  function renderTakeaways(t) {
    var details = h('details', { class: 'takeaways' });
    details.appendChild(h('summary', { class: 'takeaways__summary' },
      h('div', { class: 'takeaways__head' },
        h('span', { class: 'takeaways__summary-text', text: t.title || 'Key takeaways' }),
        t.subtitle ? h('span', { class: 'takeaways__sub', text: t.subtitle }) : null
      ),
      h('span', { class: 'takeaways__chev', 'aria-hidden': 'true' }, '▾')
    ));
    var grid = h('div', { class: 'takeaways__grid' });
    var cards = [];
    (t.items || []).forEach(function (it) {
      var card;
      if (it.type === 'framework') {
        card = renderFramework(it);           // full-width 4D panel, revealed as one step
        card.classList.add('is-pending');
      } else if (it.type === 'finale') {
        card = renderFinale(it);              // full-width animated human + AI loop finale
        card.classList.add('is-pending');
      } else {
        card = h('div', { class: 'takeaway is-pending' + (it.wide ? ' takeaway--wide' : '') },
          h('span', { class: 'takeaway__ico' }, iconSvg(it.icon)),
          h('h3', { class: 'takeaway__title', text: it.title }),
          h('p', { class: 'takeaway__text', text: it.text })
        );
      }
      grid.appendChild(card);
      cards.push(card);
    });

    // Progressive disclosure: opening reveals the first card; clicking the body,
    // activating the "reveal next" button, or pressing Space / arrow-right on the
    // hub reveals the next (prefers-reduced-motion drops the fade, see CSS). Every
    // path funnels through reveal(); advance() is the presenter step wired to keys.
    var hint = h('button', { class: 'takeaways__hint', type: 'button', text: 'Reveal the next ▸' });
    var body = h('div', { class: 'takeaways__body' }, grid, hint);
    var shown = 0;
    function updateHint() { hint.style.display = (shown >= cards.length) ? 'none' : ''; }
    function reveal() {
      if (shown >= cards.length) return false;
      var el = cards[shown];
      el.classList.remove('is-pending');
      el.classList.add('is-in');
      shown++;
      updateHint();
      // Bring the newly revealed card into view (Space, click and the button all funnel here).
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      return true;
    }
    // First Space opens the panel (its toggle reveals card 1); each Space after
    // steps to the next. Returns true when it acted so the key handler can swallow
    // the page scroll; once all are shown it returns false and Space scrolls again.
    function advance() {
      if (!details.open) {
        details.open = true;
        return (shown === 0) ? reveal() : true;  // reveal card 1 now; the async toggle then no-ops
      }
      return reveal();
    }
    updateHint();
    details.addEventListener('toggle', function () { if (details.open && shown === 0) reveal(); });
    body.addEventListener('click', function () { if (!reveal() && thanksReveal) thanksReveal(); });
    takeawayAdvance = advance;   // hub Space / arrow-right hook (see onKeydown)

    details.appendChild(body);
    return details;
  }

  function renderCard(cs, index) {
    var num = String(index + 1).padStart(2, '0');
    return h('li', { class: 'hub__cell' },
      h('button', { class: 'card', type: 'button', 'data-id': cs.id,
                    onclick: function () { showStudy(cs.id, 'forward'); } },
        cs.icon ? h('span', { class: 'card__icon' }, iconSvg(cs.icon)) : null,
        h('span', { class: 'card__eyebrow', text: num + ' · ' + cs.id }),
        h('h2', { class: 'card__title', text: cs.title || 'Untitled case study' }),
        h('p', { class: 'card__one-liner', text: cs.oneLiner || '' })
      )
    );
  }

  // Hub "AI toolkit" strip — the tools actually used across the case studies.
  // Each chip pairs a hand-drawn inline-SVG mark with the tool name; dropping
  // assets/logos/<id>.svg (or .png) replaces the mark at runtime (file://-safe).
  function renderToolStrip(tools) {
    var chips = h('ul', { class: 'toolkit__chips' });
    tools.forEach(function (t) {
      var tool = (typeof t === 'string') ? { name: t } : t;
      chips.appendChild(h('li', { class: 'toolkit__chip' },
        renderLogo(tool),
        h('span', { class: 'toolkit__name', text: tool.name })
      ));
    });
    return h('div', { class: 'toolkit' },
      h('span', { class: 'toolkit__label', text: 'The AI toolkit' }),
      chips
    );
  }

  function renderLogo(tool) {
    var slot = h('span', { class: 'toolkit__logo', 'aria-hidden': 'true' });
    if (tool.logoSrc) {
      var img = new Image();
      img.className = 'toolkit__logo-img';
      img.alt = '';
      // If the file can't load (missing / blocked), fall back to the inline mark.
      img.onerror = function () {
        if (!slot.isConnected) return;
        slot.innerHTML = '';
        slot.appendChild((LOGOS[tool.logo] || LOGOS.generic)());
      };
      img.src = tool.logoSrc;
      slot.appendChild(img);
    } else {
      slot.appendChild((LOGOS[tool.logo] || LOGOS.generic)());
    }
    return slot;
  }

  // Hand-drawn inline-SVG brand marks (offline, no network) — simplified for
  // attribution. Replace any via assets/logos/<id>.(svg|png).
  var LOGOS = {
    figma: function () {
      return svgEl('svg', { viewBox: '0 0 38 57', 'class': 'logo', 'aria-hidden': 'true' },
        svgEl('path', { fill: '#0acf83', d: 'M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z' }),
        svgEl('path', { fill: '#a259ff', d: 'M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5z' }),
        svgEl('path', { fill: '#f24e1e', d: 'M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5z' }),
        svgEl('path', { fill: '#ff7262', d: 'M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z' }),
        svgEl('path', { fill: '#1abcfe', d: 'M38 28.5A9.5 9.5 0 1 1 19 28.5 9.5 9.5 0 0 1 38 28.5z' })
      );
    },
    openai: function () {
      var g = svgEl('g', { fill: 'none', stroke: '#0d0d0d', 'stroke-width': '1.4' });
      for (var i = 0; i < 6; i++) {
        g.appendChild(svgEl('ellipse', { cx: '12', cy: '6.6', rx: '2.4', ry: '5.4', transform: 'rotate(' + (i * 60) + ' 12 12)' }));
      }
      return svgEl('svg', { viewBox: '0 0 24 24', 'class': 'logo', 'aria-hidden': 'true' }, g);
    },
    gemini: function () {
      return svgEl('svg', { viewBox: '0 0 24 24', 'class': 'logo', 'aria-hidden': 'true' },
        svgEl('defs', {},
          svgEl('linearGradient', { id: 'geminiGrad', x1: '0', y1: '0', x2: '1', y2: '1' },
            svgEl('stop', { offset: '0%', 'stop-color': '#4285f4' }),
            svgEl('stop', { offset: '50%', 'stop-color': '#9b72cb' }),
            svgEl('stop', { offset: '100%', 'stop-color': '#d96570' })
          )
        ),
        svgEl('path', { fill: 'url(#geminiGrad)', d: 'M12 1C12 7 17 12 23 12C17 12 12 17 12 23C12 17 7 12 1 12C7 12 12 7 12 1Z' })
      );
    },
    claude: function () {
      var g = svgEl('g', { fill: '#cc785c' });
      for (var i = 0; i < 12; i++) {
        var len = (i % 2 === 0) ? 10 : 6.6;
        g.appendChild(svgEl('rect', { x: '11.05', y: String(12 - len), width: '1.9', height: String(len), rx: '0.95', transform: 'rotate(' + (i * 30) + ' 12 12)' }));
      }
      return svgEl('svg', { viewBox: '0 0 24 24', 'class': 'logo', 'aria-hidden': 'true' }, g);
    },
    generic: function () {
      return svgEl('svg', { viewBox: '0 0 24 24', 'class': 'logo', 'aria-hidden': 'true' },
        svgEl('rect', { x: '3', y: '3', width: '18', height: '18', rx: '5', fill: '#0b5fff' }));
    }
  };

  /* ---- case-study view: the ONE template all three flow through ---- */
  function renderStudy(direction) {
    var cs = studyById(state.studyId);
    if (!cs) { showHub(); return; }           // defensive: bad id -> safe home

    renderCaseStudy(cs, state.beatIndex, direction);
  }

  function renderCaseStudy(cs, beatIndex, direction) {
    var idx = studyIndex(cs.id);
    var num = String(idx + 1).padStart(2, '0');
    var beats = cs.beats || [];
    var total = beats.length;

    root.innerHTML = '';

    // Persistent Home affordance + live beat count.
    var bar = h('header', { class: 'study__bar' },
      h('button', { class: 'ctrl ctrl--home', type: 'button',
                    'aria-label': 'Return to hub (Esc)', onclick: showHub }, '⌂ Home'),
      h('span', { class: 'study__count',
                  text: total ? ('Beat ' + (beatIndex + 1) + ' of ' + total) : 'No beats' })
    );

    // Title bar + the STAR one-liner (always visible; not progressively disclosed).
    var title = h('div', { class: 'study__title' },
      h('p', { class: 'study__eyebrow', text: 'Case study ' + num + ' · ' + cs.id }),
      h('h1', { class: 'study__heading', tabindex: '-1', text: cs.title || 'Untitled case study' }),
      cs.oneLiner ? h('p', { class: 'study__oneliner', text: cs.oneLiner }) : null
    );

    // Beats: only 0..beatIndex are rendered — nothing ahead of the current beat.
    var beatsWrap = h('div', { class: 'study__beats' });
    for (var b = 0; b <= beatIndex && b < total; b++) {
      beatsWrap.appendChild(renderBeat(beats[b], (b === beatIndex), direction));
    }

    var controls = h('footer', { class: 'study__controls' },
      h('button', { class: 'ctrl', type: 'button', 'data-act': 'prev',
                    disabled: beatIndex === 0 ? '' : null, onclick: prevBeat }, '◀ Back'),
      h('button', { class: 'ctrl', type: 'button', 'data-act': 'next',
                    disabled: (total === 0 || beatIndex >= total - 1) ? '' : null, onclick: nextBeat }, 'Next ▶'),
      h('span', { class: 'study__progress', text: total ? ((beatIndex + 1) + ' / ' + total) : '0 / 0' }),
      // Reset kept as a small icon (R also works); "Back to home" is the primary
      // end-of-study action.
      h('button', { class: 'ctrl ctrl--reseticon', type: 'button', 'data-act': 'reset',
                    'aria-label': 'Reset to the first beat', title: 'Reset to first beat (R)', onclick: resetStudy }, '↺'),
      h('button', { class: 'ctrl ctrl--primary', type: 'button', 'data-act': 'home',
                    'aria-label': 'Back to home (Esc)', onclick: showHub }, '⌂ Back to home')
    );

    root.appendChild(h('main', { class: 'study' }, bar, title, beatsWrap, controls));

    // Focus + auto-scroll. Beat 0 -> heading + top of page; advancing/stepping
    // -> focus the current beat and scroll it fully into view (calm; instant
    // under reduced-motion) so the presenter never has to hand-scroll.
    var currentBeatEl = beatsWrap.lastChild;
    if (beatIndex === 0) {
      if (direction === 'forward') focusEl(title.querySelector('.study__heading'));
      else focusEl(currentBeatEl);
      scrollToTop();
    } else {
      focusEl(currentBeatEl);
      scrollIntoViewCalm(currentBeatEl);
    }
  }

  function renderBeat(beat, isCurrent, direction) {
    beat = beat || {};
    var cls = 'beat';
    if (isCurrent) cls += ' beat--current';
    if (isCurrent && direction === 'forward') cls += ' beat--entering'; // animate only the newest, only on advance
    var hasDial = (beat.blocks || []).some(function (b) { return b && b.type === 'stat'; });
    if (hasDial) cls += ' beat--dial';
    var node = h('section', { class: cls, tabindex: '-1' });
    var headingEl = beat.heading ? h('h2', { class: 'beat__heading', text: beat.heading }) : null;

    // A beat's body is an ordered list of content blocks, dispatched by type so
    // the SAME template serves every case study (text, media, the shared
    // two-lane diagram, a results headline). Back-compat: a beat with
    // {lines:[...]} is treated as a sequence of text blocks.
    var blocks = beat.blocks;
    if (!blocks) {
      var lines = beat.lines || (beat.body ? [beat.body] : []);
      blocks = lines.map(function (ln) {
        return (typeof ln === 'string') ? { type: 'text', text: ln } : assign({ type: 'text' }, ln);
      });
    }

    if (hasDial) {
      // Two-column results: heading + text blocks fill the left column; the dial
      // sits centered in the right column (never wrapping the text under it).
      var main = h('div', { class: 'beat__main' });
      if (headingEl) main.appendChild(headingEl);
      var dialEl = null;
      blocks.forEach(function (blk) {
        if (blk && blk.type === 'stat') { dialEl = renderBlock(blk); }
        else { var el = renderBlock(blk); if (el) main.appendChild(el); }
      });
      node.appendChild(main);
      if (dialEl) node.appendChild(dialEl);
    } else {
      if (headingEl) node.appendChild(headingEl);
      blocks.forEach(function (blk) {
        var el = renderBlock(blk);
        if (el) node.appendChild(el);
      });
    }
    return node;
  }

  function renderBlock(blk) {
    if (!blk) return null;
    switch (blk.type) {
      case 'text':     return renderText(blk);
      case 'lead':     return renderLead(blk);
      case 'media':    return renderMedia(blk);
      case 'diagram':  return renderTwoLane(blk);
      case 'headline': return renderHeadline(blk);
      case 'themes':   return renderThemes(blk);
      case 'sus':      return renderSus(blk);
      case 'stat':     return renderStat(blk);
      case 'kpis':     return renderKpis(blk);
      case 'actions':  return renderActions(blk);
      case 'callout':  return renderCallout(blk);
      case 'points':   return renderPoints(blk);
      case 'subhead':  return renderSubhead(blk);
      case 'breakdown': return renderBreakdown(blk);
      case 'gallery':  return renderGallery(blk);
      case 'wall':     return renderWall(blk);
      case 'roadmap':  return renderRoadmap(blk);
      default:         return blk.text ? renderText(blk) : null;
    }
  }

  function renderText(blk) {
    var p = h('p', { class: 'beat__text' });
    if (blk.tag) p.appendChild(h('span', { class: 'beat__tag', text: blk.tag }));
    p.appendChild(document.createTextNode(blk.text || ''));
    if (blk.evidence) p.appendChild(renderEvidence(blk.evidence));
    return p;
  }

  function renderHeadline(blk) {
    return h('div', { class: 'beat__headline' },
      h('span', { class: 'beat__headline-text', text: blk.text || '' }),
      blk.evidence ? renderEvidence(blk.evidence) : null
    );
  }

  // Small sub-heading inside a beat — e.g. titling an image below the bullets.
  function renderSubhead(blk) {
    return h('h3', { class: 'beat__subhead', text: blk.text || '' });
  }

  // Sequential "findings" stepper — reveals one finding at a time with prev/next +
  // dots. Click-driven (arrow keys stay bound to deck nav). CS1's before-analysis.
  function renderBreakdown(blk) {
    var steps = blk.steps || [];
    var wrap = h('div', { class: 'beat__breakdown' });
    if (blk.label) wrap.appendChild(h('p', { class: 'breakdown__label', text: blk.label }));

    var stage = h('div', { class: 'breakdown__stage', 'aria-live': 'polite' });
    wrap.appendChild(stage);

    var prevBtn = h('button', { class: 'breakdown__nav', type: 'button', 'aria-label': 'Previous finding' }, '‹');
    var nextBtn = h('button', { class: 'breakdown__nav', type: 'button', 'aria-label': 'Next finding' }, '›');
    var counter = h('span', { class: 'breakdown__counter' });
    var dotsWrap = h('div', { class: 'breakdown__dots' });
    var dots = steps.map(function (s, i) {
      var d = h('button', { class: 'breakdown__dot', type: 'button', 'aria-label': 'Finding ' + (i + 1) });
      d.addEventListener('click', function () { go(i); });
      dotsWrap.appendChild(d);
      return d;
    });
    wrap.appendChild(h('div', { class: 'breakdown__controls' }, prevBtn, dotsWrap, counter, nextBtn));

    function row(mod, label, text) {
      return h('div', { class: 'breakdown__row breakdown__row--' + mod },
        h('p', { class: 'breakdown__rowhead' },
          h('span', { class: 'breakdown__bullet breakdown__bullet--' + mod, 'aria-hidden': 'true' }),
          h('span', { class: 'breakdown__rowlabel', text: label })
        ),
        h('p', { class: 'breakdown__rowtext', text: text })
      );
    }
    // Pre-build a fixed-size image frame per step that has one (cached, so navigating
    // doesn't reload or flicker). The image lazy-swaps over a placeholder; a missing
    // file just keeps the placeholder — offline-safe.
    var stepImages = steps.map(function (s) {
      if (!s.img) return null;
      var frame = h('div', { class: 'breakdown__media' },
        h('div', { class: 'media__placeholder' },
          h('span', { class: 'media__placeholder-text', text: 'Screenshot' })));
      var img = new Image();
      img.className = 'breakdown__img';
      img.alt = s.imgAlt || s.title || '';
      img.addEventListener('load', function () {
        frame.innerHTML = '';
        frame.className = 'breakdown__media breakdown__media--filled';
        frame.appendChild(img);
      });
      img.src = s.img;
      return frame;
    });
    function buildCard(s, i) {
      var finding = h('div', { class: 'breakdown__finding' },
        h('span', { class: 'breakdown__step', text: 'Finding ' + (i + 1) + ' of ' + steps.length }),
        h('h4', { class: 'breakdown__title', text: s.title })
      );
      if (s.feedback) finding.appendChild(row('fb', blk.feedbackLabel || 'Feedback', s.feedback));
      if (s.recommendation) finding.appendChild(row('rec', blk.recommendationLabel || 'Recommendation', s.recommendation));
      var card = h('div', { class: 'breakdown__card is-in' + (stepImages[i] ? ' breakdown__card--media' : '') });
      if (stepImages[i]) card.appendChild(stepImages[i]);
      card.appendChild(finding);
      return card;
    }

    var idx = 0;
    function go(i) {
      idx = Math.max(0, Math.min(steps.length - 1, i));
      stage.innerHTML = '';
      stage.appendChild(buildCard(steps[idx], idx));
      counter.textContent = (idx + 1) + ' / ' + steps.length;
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === steps.length - 1;
      dots.forEach(function (d, di) { d.className = 'breakdown__dot' + (di === idx ? ' is-active' : ''); });
    }
    prevBtn.addEventListener('click', function () { go(idx - 1); });
    nextBtn.addEventListener('click', function () { go(idx + 1); });
    if (steps.length) go(0);
    return wrap;
  }

  // Sequential screenshot gallery — flip through images one at a time (prev/next +
  // dots + caption), reusing the breakdown nav controls. Each image lazy-swaps over
  // a placeholder, so a missing file degrades gracefully and stays offline-safe.
  function renderGallery(blk) {
    var items = blk.items || [];
    var wrap = h('div', { class: 'beat__gallery' });
    if (blk.label) wrap.appendChild(h('p', { class: 'breakdown__label', text: blk.label }));

    var stage = h('div', { class: 'gallery__stage', 'aria-live': 'polite' });
    wrap.appendChild(stage);
    var caption = h('p', { class: 'gallery__caption' });
    wrap.appendChild(caption);

    var prevBtn = h('button', { class: 'breakdown__nav', type: 'button', 'aria-label': 'Previous screen' }, '‹');
    var nextBtn = h('button', { class: 'breakdown__nav', type: 'button', 'aria-label': 'Next screen' }, '›');
    var counter = h('span', { class: 'breakdown__counter' });
    var dotsWrap = h('div', { class: 'breakdown__dots' });
    var dots = items.map(function (it, i) {
      var d = h('button', { class: 'breakdown__dot', type: 'button', 'aria-label': 'Screen ' + (i + 1) });
      d.addEventListener('click', function () { go(i); });
      dotsWrap.appendChild(d);
      return d;
    });
    wrap.appendChild(h('div', { class: 'breakdown__controls' }, prevBtn, dotsWrap, counter, nextBtn));

    // Pre-build one frame per image; the lazy load swaps the placeholder for the image.
    var frames = items.map(function (it) {
      var frame = h('div', { class: 'gallery__frame' },
        h('div', { class: 'media__placeholder' },
          h('span', { class: 'media__placeholder-text', text: it.placeholder || 'Screenshot to be added' })));
      var img = new Image();
      img.className = 'gallery__img';
      img.alt = it.alt || it.caption || '';
      img.addEventListener('load', function () {
        frame.innerHTML = '';
        frame.className = 'gallery__frame gallery__frame--filled';
        frame.appendChild(img);
      });
      img.src = it.src;
      return frame;
    });

    var idx = 0;
    function go(i) {
      idx = Math.max(0, Math.min(items.length - 1, i));
      stage.innerHTML = '';
      stage.appendChild(frames[idx]);
      caption.textContent = items[idx].caption || '';
      counter.textContent = (idx + 1) + ' / ' + items.length;
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === items.length - 1;
      dots.forEach(function (d, di) { d.className = 'breakdown__dot' + (di === idx ? ' is-active' : ''); });
    }
    prevBtn.addEventListener('click', function () { go(idx - 1); });
    nextBtn.addEventListener('click', function () { go(idx + 1); });
    if (items.length) go(0);
    return wrap;
  }

  // "Wall" of screenshots — boards shown next to each other to convey the sheer
  // volume of raw material (CS2's usability boards). Each image lazy-loads over a
  // placeholder; a slight pinned-to-the-wall tilt comes from CSS.
  function renderWall(blk) {
    var items = blk.items || [];
    var wrap = h('div', { class: 'beat__wall' });
    if (blk.label) wrap.appendChild(h('p', { class: 'wall__label', text: blk.label }));
    var row = h('div', { class: 'wall__row' });
    items.forEach(function (it) {
      var card = h('div', { class: 'wall__card' },
        h('div', { class: 'media__placeholder' },
          h('span', { class: 'media__placeholder-text', text: 'Board' })));
      var img = new Image();
      img.className = 'wall__img';
      img.alt = it.alt || '';
      img.addEventListener('load', function () {
        card.innerHTML = '';
        card.className = 'wall__card wall__card--filled';
        card.appendChild(img);
      });
      img.src = it.src;
      row.appendChild(card);
    });
    wrap.appendChild(row);
    if (blk.caption) wrap.appendChild(h('p', { class: 'wall__caption', text: blk.caption }));
    return wrap;
  }

  // Evidence chip: [Directional] / [Qualitative] / [Measured]. Colour is keyed
  // to the first word, so a label like "Directional estimate" still resolves.
  function renderEvidence(label) {
    var kind = String(label || '').trim().split(/\s+/)[0].toLowerCase();
    return h('span', { class: 'chip chip--' + kind, text: '[' + label + ']' });
  }

  // Shared two-lane "what AI did / what the human owned" diagram — data-driven,
  // reused by all three case studies via a 'diagram' block. One component.
  function renderTwoLane(blk) {
    var diagram = h('div', { class: 'twolane', role: 'group', 'aria-label': 'What the human owned versus what AI did' },
      renderLane('twolane__lane--human', 'human', 'What the human owned', blk.human || []),
      h('div', { class: 'twolane__divider', 'aria-hidden': 'true' }, h('span', { class: 'twolane__handoff', text: '⇄' })),
      renderLane('twolane__lane--ai', 'robot', 'What AI did', blk.ai || [])
    );
    var wrap = h('div', { class: 'beat__diagram' }, diagram);
    if (blk.caption) wrap.appendChild(h('p', { class: 'twolane__caption', text: blk.caption }));
    return wrap;
  }

  function renderLane(mod, icon, title, items) {
    var ul = h('ul', { class: 'twolane__items' });
    items.forEach(function (it) { ul.appendChild(h('li', { class: 'twolane__item', text: it })); });
    return h('div', { class: 'twolane__lane ' + mod },
      icon ? h('span', { class: 'twolane__ico' }, iconSvg(icon)) : null,
      h('p', { class: 'twolane__title', text: title }),
      ul
    );
  }

  // Media slot: an optimistic 16:9 placeholder that swaps in the real recording
  // ONLY if it actually loads (element-based, file://-safe — no fetch). Missing
  // file => placeholder stays. Drop the file in later and it appears, no code change.
  function renderMedia(blk) {
    var frame = h('div', { class: 'media__frame' });
    frame.style.aspectRatio = blk.ratio || '16 / 9';
    frame.appendChild(h('div', { class: 'media__placeholder' },
      h('span', { class: 'media__placeholder-text', text: blk.placeholder || 'Media to be added' })));

    var settled = false;
    function swap(node) {
      if (settled || !frame.isConnected) return;
      settled = true;
      frame.innerHTML = '';
      frame.className = 'media__frame media__frame--filled';
      frame.appendChild(node);
    }

    if (blk.video) {
      var v = document.createElement('video');
      v.className = 'media__el';
      v.controls = true; v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      if (blk.poster) v.poster = blk.poster;
      var source = document.createElement('source'); source.src = blk.video; v.appendChild(source);
      v.addEventListener('loadeddata', function () { swap(v); });
      try { v.load(); } catch (e) {}
    }
    if (blk.image) {
      var img = new Image();
      img.className = 'media__el';
      img.alt = blk.caption || '';
      img.addEventListener('load', function () { swap(img); });
      img.src = blk.image;
    }

    var fig = h('figure', { class: 'media' }, frame);
    if (blk.maxWidth) { fig.style.maxWidth = blk.maxWidth; fig.style.marginLeft = 'auto'; fig.style.marginRight = 'auto'; }
    if (blk.caption) fig.appendChild(h('figcaption', { class: 'media__caption', text: blk.caption }));
    return fig;
  }

  // Before/after theme clustering — pure CSS, no charting library. Raw feedback
  // (a scatter of neutral tiles) resolving into named, colour-coded theme chips.
  function renderThemes(blk) {
    var scatter = h('div', { class: 'themes__scatter', 'aria-hidden': 'true' });
    if (blk.raw && blk.raw.length) {
      // real (anonymised) feedback snippets — the messy input
      blk.raw.forEach(function (s) { scatter.appendChild(h('span', { class: 'themes__note', text: s })); });
    } else {
      var rawCount = blk.rawCount || 16;
      for (var i = 0; i < rawCount; i++) scatter.appendChild(h('span', { class: 'themes__dot' }));
    }
    var before = h('div', { class: 'themes__panel themes__panel--before' },
      h('p', { class: 'themes__panel-label', text: blk.beforeLabel || 'Raw feedback' }),
      scatter
    );
    var chips = h('ul', { class: 'themes__chips' });
    (blk.themes || []).forEach(function (t, i) {
      chips.appendChild(h('li', { class: 'themes__chip themes__chip--' + (i % 6), text: t }));
    });
    var after = h('div', { class: 'themes__panel themes__panel--after' },
      h('p', { class: 'themes__panel-label', text: blk.afterLabel || 'Clustered themes' }),
      chips
    );
    var wrap = h('div', { class: 'themes', role: 'group', 'aria-label': 'Raw feedback clustered into themes' },
      before,
      h('div', { class: 'themes__arrow', 'aria-hidden': 'true' }, '→'),
      after
    );
    var container = h('div', { class: 'beat__themes' }, wrap);
    if (blk.caption) container.appendChild(h('p', { class: 'themes__caption', text: blk.caption }));
    return container;
  }

  // SUS uplift — shape ONLY, deliberately no axis numbers or values. Two bars
  // (round 2 taller than round 1) + a rise arrow + a "measurable uplift" badge.
  // Bar heights are illustrative (set in CSS), not real figures.
  function renderSus(blk) {
    var before = blk.before || { label: 'Round 1' };
    var after = blk.after || { label: 'Round 2' };
    var chart = h('div', { class: 'sus__chart' },
      h('div', { class: 'sus__col' },
        h('div', { class: 'sus__bar sus__bar--before', 'aria-hidden': 'true' }),
        h('span', { class: 'sus__col-label', text: before.label })
      ),
      h('div', { class: 'sus__rise', 'aria-hidden': 'true' }, '↗'),
      h('div', { class: 'sus__col' },
        h('div', { class: 'sus__bar sus__bar--after', 'aria-hidden': 'true' }),
        h('span', { class: 'sus__col-label', text: after.label })
      )
    );
    var wrap = h('div', { class: 'beat__sus' }, chart);
    if (blk.badge) wrap.appendChild(h('span', { class: 'sus__badge', text: blk.badge }));
    if (blk.caption) wrap.appendChild(h('p', { class: 'sus__caption', text: blk.caption }));
    return wrap;
  }

  // ---- SVG + motion helpers (used by the stat dial) ----
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, props) {
    var node = document.createElementNS(SVGNS, tag);
    if (props) for (var k in props) { if (props[k] != null) node.setAttribute(k, props[k]); }
    for (var i = 2; i < arguments.length; i++) { if (arguments[i]) node.appendChild(arguments[i]); }
    return node;
  }
  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function formatNum(n) {
    // integers print clean; decimals print as-is (e.g. 2.5)
    return String(Math.round(n) === n ? n : n);
  }

  // Featured impact stat: a number that counts up while a ring sweeps to full.
  // ONE calm play; under prefers-reduced-motion it snaps to the final value with
  // the ring already full (no motion). Data-driven — reusable by any study.
  function renderStat(blk) {
    var target = (typeof blk.value === 'number') ? blk.value : (parseFloat(blk.value) || 0);
    var suffix = blk.suffix || '';
    // For a percentage, the ring fills to the value (e.g. 90%); otherwise it fills full.
    var fill = (suffix === '%') ? Math.max(0, Math.min(target, 100)) / 100 : 1;
    var isInt = Math.round(target) === target; // integer targets count without decimals
    var R = 52, C = 2 * Math.PI * R;

    var arc = svgEl('circle', { 'class': 'stat__ring-arc', cx: 60, cy: 60, r: R,
      'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': C.toFixed(2) });
    var ring = svgEl('svg', { 'class': 'stat__ring', viewBox: '0 0 120 120', 'aria-hidden': 'true' },
      svgEl('circle', { 'class': 'stat__ring-track', cx: 60, cy: 60, r: R }),
      arc);

    var prefixEl = blk.prefix ? h('span', { class: 'stat__prefix', text: blk.prefix }) : null;
    var numEl = h('span', { class: 'stat__num' });
    var unitEl = blk.unit ? h('span', { class: 'stat__unit', text: blk.unit }) : null;
    var dial = h('div', { class: 'stat__dial', role: 'img',
      'aria-label': (blk.prefix ? blk.prefix + ' ' : '') + (blk.text != null ? blk.text : formatNum(target) + suffix) + (blk.unit ? ' ' + blk.unit : '') },
      ring, h('div', { class: 'stat__readout' }, prefixEl, numEl, unitEl));

    function frame(p) {
      if (blk.text != null) {
        numEl.textContent = blk.text;              // static text value (e.g. a range) — only the ring animates
      } else {
        var val = (p >= 1) ? target : (isInt ? Math.round(target * p) : Math.round(target * p * 10) / 10);
        numEl.textContent = formatNum(val) + suffix;
      }
      arc.setAttribute('stroke-dashoffset', (C * (1 - p * fill)).toFixed(2));
    }

    if (prefersReducedMotion()) {
      frame(1); // instant final state, ring full — no motion
    } else {
      frame(0);
      var DUR = 1100, start = null, done = false;
      function finish() { if (!done) { done = true; frame(1); } }
      requestAnimationFrame(function step(ts) {
        if (done) return;
        if (!numEl.isConnected) { done = true; return; } // navigated away mid-count
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / DUR);
        frame(1 - Math.pow(1 - t, 3));                   // easeOutCubic
        if (t < 1) requestAnimationFrame(step); else done = true;
      });
      // Safety net: rAF is PAUSED on hidden/backgrounded tabs, so the count-up
      // could otherwise stall at 0. Timers still fire (throttled) — guarantee the
      // final value lands. Idempotent with the rAF completion above.
      setTimeout(function () { if (numEl.isConnected) finish(); }, DUR + 400);
    }

    // The dial is placed by renderBeat into the right column of a results beat;
    // the lead + bullet blocks fill the left column.
    return dial;
  }

  // Prominent multi-line intro for a results beat (the left-column lead-in).
  function renderLead(blk) {
    var wrap = h('div', { class: 'beat__lead' });
    var lines = blk.lines || (blk.text ? [blk.text] : []);
    lines.forEach(function (ln) { wrap.appendChild(h('p', { class: 'lead__line', text: ln })); });
    return wrap;
  }

  // Distilled KPI card (CS3) — a grid of big, projector-legible headline numbers.
  function renderKpis(blk) {
    var grid = h('div', { class: 'kpicard' });
    (blk.items || []).forEach(function (it) {
      grid.appendChild(h('div', { class: 'kpicard__tile' },
        h('div', { class: 'kpicard__n', text: it.n }),
        h('div', { class: 'kpicard__l', text: it.l })
      ));
    });
    var wrap = h('div', { class: 'beat__kpis' }, grid);
    if (blk.source) wrap.appendChild(h('p', { class: 'kpicard__source', text: blk.source }));
    return wrap;
  }

  // Action buttons that open the real, interactive dashboards in an in-deck
  // overlay (iframe) with a Back button — stays in one window for presenting.
  function renderActions(blk) {
    var row = h('div', { class: 'actions' });
    (blk.items || []).forEach(function (it) {
      var btn = h('button', { class: 'actionbtn', type: 'button',
        onclick: function () { openOverlay(it.href, it.sub || it.label); } },
        h('span', { class: 'actionbtn__label', text: it.label }));
      if (it.sub) btn.appendChild(h('span', { class: 'actionbtn__sub', text: it.sub }));
      row.appendChild(btn);
    });
    return h('div', { class: 'beat__actions' }, row);
  }

  /* ---- live-tool overlay (CS3): open a dashboard fork in-deck, with Back ---- */
  var overlayEl = null, overlayTrigger = null;
  function overlayOpen() { return !!overlayEl; }
  // Make the deck behind the overlay non-interactive so focus can't leak out of
  // the modal: `inert` removes it from tab order, aria-hidden from the a11y tree.
  // (The overlay lives on <body>, a sibling of #app, so it stays active.)
  function setDeckInert(on) {
    if (!root) return;
    if ('inert' in root) root.inert = on;
    if (on) root.setAttribute('aria-hidden', 'true'); else root.removeAttribute('aria-hidden');
  }
  function openOverlay(src, title) {
    closeOverlay();
    overlayTrigger = document.activeElement; // restore focus here on close
    var frame = h('iframe', { class: 'overlay__frame', src: src, title: title || 'Live tool' });
    var bar = h('div', { class: 'overlay__bar' },
      h('button', { class: 'ctrl overlay__back', type: 'button', onclick: closeOverlay }, '← Back to case study'),
      h('span', { class: 'overlay__title', text: title || '' }),
      h('a', { class: 'overlay__pop', href: src, target: '_blank', rel: 'noopener' }, 'Open in new tab ↗')
    );
    overlayEl = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Live tool' }, bar, frame);
    document.body.appendChild(overlayEl);
    setDeckInert(true);
    focusEl(overlayEl.querySelector('.overlay__back')); // so Esc closes immediately
  }
  function closeOverlay() {
    if (!overlayEl) return;
    var node = overlayEl;
    overlayEl = null;
    if (node.parentNode) node.parentNode.removeChild(node);
    setDeckInert(false);
    if (overlayTrigger && overlayTrigger.isConnected) focusEl(overlayTrigger); // return focus to the trigger
    overlayTrigger = null;
  }

  // Callout (CS3) — lifts the dashboard's Measured/Assessed/Not-measured legend
  // and frames it as the human-in-the-loop discipline.
  function renderCallout(blk) {
    var box = h('div', { class: 'callout' });
    if (blk.icon) {
      box.appendChild(h('div', { class: 'callout__head' },
        h('span', { class: 'callout__icon', 'aria-hidden': 'true' }, iconSvg(blk.icon)),
        blk.label ? h('p', { class: 'callout__label', text: blk.label }) : null));
    } else if (blk.label) {
      box.appendChild(h('p', { class: 'callout__label', text: blk.label }));
    }
    if (blk.tags && blk.tags.length) {
      var tagrow = h('div', { class: 'callout__tags' });
      blk.tags.forEach(function (t, i) {
        tagrow.appendChild(h('span', { class: 'callout__tag callout__tag--' + i, text: t }));
      });
      box.appendChild(tagrow);
    }
    (blk.lines || []).forEach(function (ln) { box.appendChild(h('p', { class: 'callout__line', text: ln })); });
    return box;
  }

  // ---- Icon registry: small inline-SVG line icons (offline-safe, scalable,
  // high-contrast). Stroke = currentColor so each icon inherits its colour. ----
  var ICONS = {
    clock:            [{ t: 'circle', a: { cx: 12, cy: 12, r: 9 } }, { t: 'polyline', a: { points: '12 7 12 12 15 14' } }],
    target:           [{ t: 'circle', a: { cx: 12, cy: 12, r: 9 } }, { t: 'circle', a: { cx: 12, cy: 12, r: 5 } }, { t: 'circle', a: { cx: 12, cy: 12, r: 1.5 } }],
    rotate:           [{ t: 'path', a: { d: 'M21 12a9 9 0 1 1-2.64-6.36' } }, { t: 'polyline', a: { points: '21 3 21 9 15 9' } }],
    star:             [{ t: 'polygon', a: { points: '12 2.5 14.6 9 21.5 9.3 16.2 13.8 18 20.5 12 16.7 6 20.5 7.8 13.8 2.5 9.3 9.4 9' } }],
    users:            [{ t: 'circle', a: { cx: 12, cy: 8, r: 4 } }, { t: 'path', a: { d: 'M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7' } }],
    check:            [{ t: 'circle', a: { cx: 12, cy: 12, r: 9 } }, { t: 'polyline', a: { points: '8 12.5 11 15.5 16.5 9' } }],
    layers:           [{ t: 'polygon', a: { points: '12 3 21 8 12 13 3 8' } }, { t: 'polyline', a: { points: '3 12.5 12 17.5 21 12.5' } }],
    search:           [{ t: 'circle', a: { cx: 11, cy: 11, r: 7 } }, { t: 'line', a: { x1: 16.5, y1: 16.5, x2: 21, y2: 21 } }],
    'trending-up':    [{ t: 'polyline', a: { points: '3 17 9 11 13 15 21 7' } }, { t: 'polyline', a: { points: '15 7 21 7 21 13' } }],
    compass:          [{ t: 'circle', a: { cx: 12, cy: 12, r: 9 } }, { t: 'polygon', a: { points: '16 8 13.5 13.5 8 16 10.5 10.5' } }],
    'arrow-up-right': [{ t: 'line', a: { x1: 7, y1: 17, x2: 17, y2: 7 } }, { t: 'polyline', a: { points: '8 7 17 7 17 16' } }],
    cursor:           [{ t: 'polygon', a: { points: '5 3 5 18 9 14 12 20.5 14 19.6 11 13.6 17 13.6' } }],
    'chart-bar':      [{ t: 'line', a: { x1: 4, y1: 20, x2: 20, y2: 20 } }, { t: 'line', a: { x1: 7.5, y1: 20, x2: 7.5, y2: 14 } }, { t: 'line', a: { x1: 12, y1: 20, x2: 12, y2: 10 } }, { t: 'line', a: { x1: 16.5, y1: 20, x2: 16.5, y2: 6 } }],
    sitemap:          [{ t: 'rect', a: { x: 9.5, y: 3, width: 5, height: 4, rx: 1 } }, { t: 'rect', a: { x: 3, y: 17, width: 5, height: 4, rx: 1 } }, { t: 'rect', a: { x: 9.5, y: 17, width: 5, height: 4, rx: 1 } }, { t: 'rect', a: { x: 16, y: 17, width: 5, height: 4, rx: 1 } }, { t: 'path', a: { d: 'M12 7v5M5.5 12h13M5.5 12v5M12 12v5M18.5 12v5' } }],
    robot:            [{ t: 'rect', a: { x: 4.5, y: 8, width: 15, height: 11, rx: 3 } }, { t: 'line', a: { x1: 12, y1: 8, x2: 12, y2: 4.5 } }, { t: 'circle', a: { cx: 12, cy: 3.3, r: 1.2 } }, { t: 'circle', a: { cx: 9, cy: 13, r: 1 } }, { t: 'circle', a: { cx: 15, cy: 13, r: 1 } }],
    human:            [{ t: 'circle', a: { cx: 12, cy: 7.5, r: 3.5 } }, { t: 'path', a: { d: 'M5.5 20a6.5 6.5 0 0 1 13 0' } }],
    bolt:             [{ t: 'polygon', a: { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' } }],
    chat:             [{ t: 'path', a: { d: 'M20 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v4l4-4h9a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z' } }],
    share:            [{ t: 'circle', a: { cx: 6, cy: 12, r: 2.3 } }, { t: 'circle', a: { cx: 18, cy: 6, r: 2.3 } }, { t: 'circle', a: { cx: 18, cy: 18, r: 2.3 } }, { t: 'line', a: { x1: 8.1, y1: 10.9, x2: 15.9, y2: 7.1 } }, { t: 'line', a: { x1: 8.1, y1: 13.1, x2: 15.9, y2: 16.9 } }],
    message:          [{ t: 'rect', a: { x: 3, y: 5, width: 18, height: 12, rx: 2 } }, { t: 'line', a: { x1: 7, y1: 9.5, x2: 17, y2: 9.5 } }, { t: 'line', a: { x1: 7, y1: 12.5, x2: 13, y2: 12.5 } }],
    eye:              [{ t: 'path', a: { d: 'M2 12s3.6-6.5 10-6.5 10 6.5 10 6.5-3.6 6.5-10 6.5S2 12 2 12z' } }, { t: 'circle', a: { cx: 12, cy: 12, r: 2.6 } }],
    shield:           [{ t: 'path', a: { d: 'M12 3 L5 5.5 L5 11 C5 15.3 8 18.4 12 20 C16 18.4 19 15.3 19 11 L19 5.5 Z' } }, { t: 'polyline', a: { points: '9 12 11.2 14.2 15 10' } }],
    dot:              [{ t: 'circle', a: { cx: 12, cy: 12, r: 3 } }]
  };
  function iconSvg(name) {
    var parts = ICONS[name] || ICONS.dot;
    var svg = svgEl('svg', { 'class': 'ico', viewBox: '0 0 24 24', 'aria-hidden': 'true',
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    parts.forEach(function (p) { svg.appendChild(svgEl(p.t, p.a)); });
    return svg;
  }

  // Icon points — Problem/Results beats render as icon + prose, each optionally
  // carrying an evidence chip. Data-driven; any case study can use it.
  function renderPoints(blk) {
    var wrap = h('div', { class: 'beat__points' });
    if (blk.label) wrap.appendChild(h('p', { class: 'points__label', text: blk.label }));
    var list = h('ul', { class: 'points' });
    (blk.items || []).forEach(function (it) {
      var body = h('div', { class: 'points__body' });
      if (it.evidence) body.appendChild(h('div', { class: 'points__meta' }, renderEvidence(it.evidence)));
      body.appendChild(h('p', { class: 'points__text', text: it.text || '' }));
      list.appendChild(h('li', { class: 'points__item' },
        h('span', { class: 'points__ico' }, iconSvg(it.icon)),
        body
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  // Roadmap / Gantt — data-driven CSS-grid timeline. Lanes × quarters, bars placed
  // via grid-column; a brace gathers the lanes into the end (consolidation) box.
  function renderRoadmap(blk) {
    var quarters = blk.quarters || [];
    var nq = quarters.length;
    var lanes = blk.lanes || [];
    var grid = h('div', { class: 'roadmap', role: 'img', 'aria-label': blk.aria || 'Roadmap' });
    grid.style.gridTemplateColumns = 'max-content repeat(' + nq + ', minmax(0, 1fr))';

    var col = 2;
    (blk.years || []).forEach(function (y) {
      var cell = h('span', { class: 'roadmap__year', text: y.label });
      cell.style.gridColumn = col + ' / span ' + y.span;
      cell.style.gridRow = '1';
      grid.appendChild(cell);
      col += y.span;
    });

    quarters.forEach(function (q, i) {
      var cell = h('span', { class: 'roadmap__q', text: q });
      cell.style.gridColumn = String(2 + i);
      cell.style.gridRow = '2';
      grid.appendChild(cell);
    });

    lanes.forEach(function (lane, li) {
      var row = String(3 + li);
      var label = h('span', { class: 'roadmap__lane-label', text: lane.label });
      label.style.gridColumn = '1';
      label.style.gridRow = row;
      if (lane.color) label.style.color = lane.color;
      grid.appendChild(label);
      (lane.bars || []).forEach(function (bar) {
        var b = h('span', { class: 'roadmap__bar', text: bar.text });
        b.style.gridColumn = (2 + (bar.start - 1)) + ' / span ' + bar.span;
        b.style.gridRow = row;
        b.style.background = bar.color || lane.color || '#888';
        if (bar.dark) b.style.color = '#1a2233';
        grid.appendChild(b);
      });
    });

    var con = blk.consolidation;
    if (con) {
      if (con.braceStart) {
        var brace = h('span', { class: 'roadmap__brace', 'aria-hidden': 'true' });
        brace.style.gridColumn = String(2 + con.braceStart - 1);
        brace.style.gridRow = '3 / span ' + lanes.length;
        grid.appendChild(brace);
      }
      (con.boxes || []).forEach(function (box) {
        var bx = h('span', { class: 'roadmap__endbox', text: box.text });
        bx.style.gridColumn = (2 + (con.boxStart - 1)) + ' / span ' + (con.boxSpan || 3);
        bx.style.gridRow = (2 + box.laneStart) + ' / span ' + (box.laneSpan || 2);
        grid.appendChild(bx);
      });
    }

    var wrap = h('div', { class: 'beat__roadmap' }, grid);
    if (blk.caption) wrap.appendChild(h('p', { class: 'roadmap__caption', text: blk.caption }));
    return wrap;
  }

  function assign(target, src) {
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    return target;
  }

  /* ---- keyboard ---- */
  function isEditable(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }

  // A focusable control that Space/Enter should activate natively (so the
  // presenter binding "Space = next beat" doesn't hijack a focused button/link/video).
  function isActivatable(el) {
    if (!el) return false;
    var t = el.tagName;
    if (t === 'BUTTON' || t === 'SUMMARY' || t === 'VIDEO' || t === 'AUDIO') return true;
    if (t === 'A' && el.hasAttribute('href')) return true;
    return el.getAttribute && el.getAttribute('role') === 'button';
  }

  function onKeydown(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    // The live-tool overlay swallows keys: Esc closes it; everything else is
    // left to the dashboard inside. Deck nav stays frozen behind it.
    if (overlayOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
      return;
    }
    if (isEditable(e.target)) return;
    var key = e.key;

    // 1/2/3 jump to a case study from anywhere (hub or study).
    if (key === '1' || key === '2' || key === '3') {
      e.preventDefault();
      jumpTo(parseInt(key, 10));
      return;
    }

    if (state.view === 'study') {
      switch (key) {
        case 'ArrowRight':
        case ' ':
        case 'Spacebar':            // older browsers
          // Don't steal Space from a focused control — let it activate natively.
          if (isActivatable(e.target)) break;
          e.preventDefault(); nextBeat(); break;
        case 'ArrowLeft':
        case 'Backspace':           // preventDefault stops browser "back"
          e.preventDefault(); prevBeat(); break;
        case 'Escape':
        case 'h': case 'H':
          e.preventDefault(); showHub(); break;
        case 'r': case 'R':
          e.preventDefault(); resetStudy(); break;
        default: break;
      }
    } else if (state.view === 'hub') {
      // Presenter: Space / arrow-right step through the wrap-up reveal, unless a
      // focused control (a case-study card or the reveal button) should get the
      // key natively. Once everything is revealed, advance() returns false and
      // Space falls through to its normal page scroll.
      if (key === ' ' || key === 'Spacebar' || key === 'ArrowRight') {
        if (isActivatable(e.target)) return;
        if (takeawayAdvance && takeawayAdvance()) e.preventDefault();
        else if (thanksReveal && thanksReveal()) e.preventDefault();
      }
    }
  }

  /* ---- boot ---- */
  function init() {
    if (typeof TALK === 'undefined' || typeof CASE_STUDIES === 'undefined') {
      root.textContent = 'Data failed to load. Check that assets/js/data.js loads before app.js.';
      return;
    }
    document.addEventListener('keydown', onKeydown);
    showHub();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
