/* METAL SLIDE engine: the world map's HTML layer.
   The canvas paints the map (art/worldmap.js); this lays real buttons and links over it,
   positioned in game px so they scale with the stage. Each chapter is a button that opens
   a card (its brief, Play now, and pathways to the case studies behind it) on hover, focus
   or tap. Cards are hoverable, stay put while the pointer or focus is inside, and Escape
   closes them (WCAG 1.4.13). Left and right arrows move between chapters.
   main.js owns when the map shows; this file only builds and runs the overlay. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pct(v, of) { return (v / of * 100).toFixed(3) + '%'; }
  // "THE CITY OF 47 BLUES" -> "The City of 47 Blues" (small words stay small, except first).
  var SMALL = { a: 1, an: 1, and: 1, at: 1, by: 1, for: 1, in: 1, of: 1, on: 1, or: 1, the: 1, to: 1 };
  // Words like FINAL_FINAL_V9 are file names: they keep their capitals.
  function title(s) {
    return String(s || '').split(/(\s+)/).map(function (w, i) {
      if (/[_]/.test(w)) return w;
      var l = w.toLowerCase();
      return i && SMALL[l] ? l : l.charAt(0).toUpperCase() + l.slice(1);
    }).join('');
  }
  // A pathway sign's short name: "VISTA: an AI HR tool" -> "VISTA", "The AR sales tool" -> "AR sales tool".
  function shortName(label) { var s = String(label).split(':')[0].trim(); return s.replace(/^the\s+/i, ''); }

  // opts: { stage, host (the element the layer lives in, over the stage, so cards can
  // spill past a small stage instead of being cropped), missions (index 1..n are
  // chapters), journey, onPlay(n), onActive(n) }
  function create(opts) {
    var W = MS.W, H = MS.H, map = MS.worldmap;
    var stage = opts.stage, chapters = [], open = null, pinned = false, done = {};
    var box = el('div', 'map'); box.hidden = true;
    var head = el('h2', 'sr-only', title(opts.journey || 'The journey'));
    head.id = 'map-title';
    box.setAttribute('role', 'region'); box.setAttribute('aria-labelledby', 'map-title');
    box.appendChild(head);
    box.appendChild(el('p', 'sr-only', 'Choose a chapter to see what it is about, then Play now. Arrow keys move between chapters.'));
    var list = el('ol', 'map-chapters');
    var signs = el('ul', 'map-signs');
    box.appendChild(list); box.appendChild(signs);

    for (var n = 1; n < opts.missions.length && map.places[n]; n++) (function (n) {
      var M = opts.missions[n], P = map.places[n];
      var li = el('li', 'map-chapter');
      li.style.left = pct(P.x, W); li.style.top = pct(P.y, H);
      li.setAttribute('data-n', n);
      li.setAttribute('data-below', P.y < H / 2 ? '1' : '');
      if (P.y < H / 2) li.classList.add('below');
      var btn = el('button', 'map-place');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'map-card-' + n);
      btn.appendChild(el('span', 'map-num', String(n)));
      btn.appendChild(el('span', 'map-label', ' ' + P.label)); // on a small map only the number shows
      var tick = el('span', 'map-tick', ' ✓'); tick.hidden = true; btn.appendChild(tick);
      var sr = el('span', 'sr-only', ''); btn.appendChild(sr);
      var card = el('div', 'map-card'); card.id = 'map-card-' + n; card.hidden = true;
      card.appendChild(el('p', 'map-kicker', 'Chapter ' + n + (P.label ? ': ' + title(P.label) : '')));
      card.appendChild(el('h3', 'map-card-title', title(M.title)));
      if (M.brief) card.appendChild(el('p', 'map-brief', M.brief));
      var play = el('button', 'map-play', 'Play now');
      play.type = 'button';
      play.addEventListener('click', function () { close(); opts.onPlay(n); });
      card.appendChild(play);
      if (M.links && M.links.length) {
        var paths = el('p', 'map-paths');
        paths.appendChild(el('span', 'map-paths-label', 'Pathways: '));
        M.links.forEach(function (l, i) {
          if (i) paths.appendChild(document.createTextNode(', '));
          var a = el('a', '', l.label); a.href = l.url; a.target = '_top';
          a.appendChild(el('span', 'sr-only', ' (case study)'));
          paths.appendChild(a);
          var slot = map.slots && map.slots[n] && map.slots[n][i];
          if (slot) {
            var s = el('li', 'map-sign'); s.style.left = pct(slot.x, W); s.style.top = pct(slot.y, H);
            var sa = el('a', '', shortName(l.label)); sa.href = l.url; sa.target = '_top';
            sa.setAttribute('aria-label', 'Pathway to the case study: ' + l.label);
            s.appendChild(sa); signs.appendChild(s);
          }
        });
        card.appendChild(paths);
      }
      li.appendChild(btn); li.appendChild(card); list.appendChild(li);
      var c = { n: n, li: li, btn: btn, card: card, play: play, tick: tick, sr: sr, title: title(M.title), label: title(P.label) };
      chapters.push(c);

      // Hover opens, and the card stays while the pointer travels to it: an invisible
      // bridge spans the gap (CSS li::after), and leaving only closes it after a grace
      // period, so a diagonal path to Play now doesn't lose it. Hovering another
      // chapter switches at once. Focus opens too; a click or tap pins it open.
      li.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { cancelClose(); show(c, false); } });
      li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !pinned && !li.contains(document.activeElement)) closeSoon(c); });
      li.addEventListener('focusin', function () { if (open !== c) show(c, false); });
      li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget) && !pinned && open === c) close(); });
      btn.addEventListener('click', function () { if (open === c && pinned) close(); else show(c, true); });
    })(n);

    function place(c) {
      // Beside the chapter's label when there's room, so the card never hides its own
      // landmark (or Sam standing on it). Otherwise above or below, whichever fits,
      // nudged in from the sides. Always fully on screen.
      c.card.style.setProperty('--shift', '0px');
      c.card.style.setProperty('--vshift', '0px');
      c.card.style.maxHeight = '';
      c.li.classList.remove('side-left', 'side-right');
      var pad = 8, vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
      var at = c.btn.getBoundingClientRect(), w = c.card.offsetWidth, h = c.card.getBoundingClientRect().height;
      var right = vw - at.right - 8 - pad >= w, left = at.left - 8 - pad >= w;
      var leftHalf = (at.left + at.right) / 2 < vw / 2;
      var side = leftHalf ? (right ? 'right' : left ? 'left' : null) : (left ? 'left' : right ? 'right' : null);
      if (side && h <= vh - 2 * pad) {
        c.li.classList.add('side-' + side);
        // Inside the picture if it fits there, else inside the screen.
        var st = stage.getBoundingClientRect(), fitsStage = h <= st.height - 2 * pad;
        var top = fitsStage ? st.top + pad : pad, bottom = fitsStage ? st.bottom - pad : vh - pad;
        var sr = c.card.getBoundingClientRect();
        c.card.style.setProperty('--vshift', Math.round(sr.top < top ? top - sr.top : sr.bottom > bottom ? bottom - sr.bottom : 0) + 'px');
        return;
      }
      var above = at.top - 8 - pad, below = vh - at.bottom - 8 - pad;
      var natural = !!c.li.getAttribute('data-below');
      var down = natural ? below >= h || (above < h && below >= above) : !(above >= h || (below < h && above >= below));
      c.li.classList.toggle('below', down);
      var room = down ? below : above;
      if (h > room) c.card.style.maxHeight = Math.max(80, Math.floor(room)) + 'px'; // too tall either way: scroll inside
      var r = c.card.getBoundingClientRect();
      var shift = r.left < pad ? pad - r.left : r.right > vw - pad ? vw - pad - r.right : 0;
      c.card.style.setProperty('--shift', Math.round(shift) + 'px');
    }
    var closeTimer = null;
    function cancelClose() { clearTimeout(closeTimer); closeTimer = null; }
    function closeSoon(c) {
      cancelClose();
      closeTimer = setTimeout(function () {
        closeTimer = null;
        if (open === c && !pinned && !c.li.contains(document.activeElement) && !c.li.matches(':hover')) close();
      }, 700);
    }
    function show(c, pin) {
      cancelClose();
      var was = open === c && pinned;
      if (open && open !== c) close();
      open = c; pinned = !!pin || was;
      c.card.hidden = false; c.btn.setAttribute('aria-expanded', 'true'); c.li.classList.add('open');
      place(c);
      if (opts.onActive) opts.onActive(c.n);
    }
    function close() {
      cancelClose();
      if (!open) return;
      open.card.hidden = true; open.btn.setAttribute('aria-expanded', 'false'); open.li.classList.remove('open');
      open.li.classList.toggle('below', !!open.li.getAttribute('data-below')); // back to its natural side
      open.li.classList.remove('side-left', 'side-right');
      open = null; pinned = false;
      if (opts.onActive) opts.onActive(null);
    }

    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { var c = open; close(); c.btn.focus(); e.stopPropagation(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var i = chapters.findIndex(function (c) { return c.li.contains(document.activeElement); });
        var j = Math.max(0, Math.min(chapters.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowRight' ? 1 : -1)));
        chapters[j].btn.focus(); e.stopPropagation(); e.preventDefault();
      }
    });
    (opts.host || stage).appendChild(box);

    return {
      el: box,
      // here: the chapter to suggest. focus: 'place' | 'play' | null.
      show: function (state) {
        done = state.done || {};
        chapters.forEach(function (c) {
          c.tick.hidden = !done[c.n];
          c.sr.textContent = ', ' + c.title + (done[c.n] ? ', played' : '');
          c.li.classList.toggle('here', c.n === state.here);
        });
        box.hidden = false;
        var c = chapters[(state.here || 1) - 1];
        if (state.open && c) show(c, true);
        if (state.focus && c) (state.focus === 'play' && state.open ? c.play : c.btn).focus();
      },
      hide: function () { close(); box.hidden = true; },
      // Next on the map: first open the suggested chapter, then play it.
      next: function (here) {
        var c = chapters[(here || 1) - 1];
        if (!c) return;
        if (open === c) { close(); opts.onPlay(c.n); } else { show(c, true); c.play.focus(); }
      },
      place: function () { if (open) place(open); },
      // Lay the layer exactly over the stage (host coordinates), at the stage's scale.
      fit: function (px) {
        var host = (opts.host || stage).getBoundingClientRect(), r = stage.getBoundingClientRect();
        box.style.left = (r.left - host.left) + 'px'; box.style.top = (r.top - host.top) + 'px';
        box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
        box.style.setProperty('--px', px + 'px');
        // On a small map the signposts crowd under 24px apart (2.5.8); their links are
        // in each chapter's card too, so the signs step aside.
        box.classList.toggle('compact', px < 1.6);
        if (open) place(open);
      },
      visible: function () { return !box.hidden; }
    };
  }

  MS.mapui = { create: create, shortName: shortName };
})(typeof window !== 'undefined' ? window : globalThis);
