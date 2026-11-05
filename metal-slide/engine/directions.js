/* METAL SLIDE engine: stage directions.
   Turns "[Sam walks in from the left]" into a command descriptor, using the set's cast to find
   names. Anything it can't understand becomes a director's note instead of an error.
   Pure: no DOM. Tested in Node (tests/directions.test.js). */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  // Lowercase, keep !, ? and ... as their own tokens, split "dev1" into "dev 1".
  function tokenize(text) {
    return String(text || '').toLowerCase()
      .replace(/…/g, '...')
      .replace(/\.{3,}/g, ' ... ')
      .replace(/([!?]+)/g, ' $1 ')
      .replace(/([a-z])\.(?=\s|$)/g, '$1 ')
      .replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/,/g, ' , ').replace(/&/g, ' and ')
      .replace(/\s+/g, ' ').trim()
      .split(' ').filter(Boolean);
  }

  function context(def) {
    var phrases = [];
    var groups = {};
    var cast = def.cast || {};
    Object.keys(cast).forEach(function (id) {
      var a = cast[id];
      [id].concat(a.names || []).forEach(function (n) { phrases.push({ words: tokenize(n), ids: [id] }); });
      (a.groups || []).forEach(function (g) { (groups[g] = groups[g] || []).push(id); });
    });
    Object.keys(groups).forEach(function (g) { phrases.push({ words: tokenize(g), ids: groups[g] }); });
    if (def.crowd && groups[def.crowd]) phrases.push({ words: ['crowd'], ids: groups[def.crowd] });
    phrases.sort(function (a, b) { return b.words.length - a.words.length; });
    var marks = {};
    Object.keys(def.marks || {}).forEach(function (m) { marks[tokenize(m).join(' ')] = m; });
    return { phrases: phrases, groups: groups, marks: marks, events: def.events || [] };
  }

  function matchAt(words, i, ctx) {
    for (var p = 0; p < ctx.phrases.length; p++) {
      var w = ctx.phrases[p].words;
      if (!w.length || i + w.length > words.length) continue;
      var ok = true;
      for (var k = 0; k < w.length; k++) if (words[i + k] !== w[k]) { ok = false; break; }
      if (ok) return { ids: ctx.phrases[p].ids, end: i + w.length };
    }
    return null;
  }

  var EVERYONE = { everyone: 1, everybody: 1 };

  // Reads "Sam", "DEV 1, DEV 2 and the General", "all devs", "everyone" from the front.
  function takeActors(words, ctx) {
    var ids = [];
    var i = 0;
    var found = false;
    while (i < words.length) {
      var save = i;
      while (words[i] === 'the' || words[i] === 'both') i++;
      if (EVERYONE[words[i]]) {
        ids.push('*'); i++;
      } else if (words[i] === 'all') {
        var j = i + 1;
        if (words[j] === 'the') j++;
        var g = matchAt(words, j, ctx);
        if (g) { ids = ids.concat(g.ids); i = g.end; } else { ids.push('*'); i++; }
      } else {
        var m = matchAt(words, i, ctx);
        if (!m) { i = save; break; }
        ids = ids.concat(m.ids); i = m.end;
      }
      found = true;
      if (words[i] === ',') { i++; if (words[i] === 'and') i++; continue; }
      if (words[i] === 'and') {
        var look = i + 1;
        while (words[look] === 'the') look++;
        if (EVERYONE[words[look]] || words[look] === 'all' || matchAt(words, look, ctx)) { i++; continue; }
      }
      break;
    }
    if (!found) return null;
    var seen = {};
    ids = ids.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
    return { ids: ids, rest: words.slice(i) };
  }

  function target(words, ctx) {
    words = words.filter(function (w) { return w !== ','; });
    while (words[0] === 'the') words = words.slice(1);
    if (!words.length) return null;
    var s = words.join(' ');
    if (/^-?\d+$/.test(s)) return { kind: 'x', x: Number(s) };
    if (s === 'left' || s === 'right') return { kind: 'side', side: s };
    if (/^(center|centre|middle|center stage)$/.test(s)) return { kind: 'center' };
    var m = matchAt(words, 0, ctx);
    if (m && m.end === words.length && m.ids.length) return { kind: 'actor', id: m.ids[0] };
    if (ctx.marks[s]) return { kind: 'mark', name: ctx.marks[s] };
    return { kind: 'mark', name: s };
  }

  // Verbs that just change a character's pose. Key: base verb, value: animation name.
  var ANIMS = {
    salute: 'salute', cheer: 'cheer', celebrate: 'cheer', 'pump': 'cheer', dance: 'dance', clap: 'clap', applaud: 'clap',
    laugh: 'laugh', giggle: 'laugh', panic: 'panic', flail: 'panic', scream: 'panic', cower: 'panic',
    tremble: 'tremble', shiver: 'tremble', shake: 'tremble', quake: 'tremble',
    work: 'work', type: 'work', chisel: 'work', hammer: 'work', code: 'work', toil: 'work', build: 'work',
    struggle: 'struggle', strain: 'struggle', wave: 'wave', point: 'point', think: 'think', ponder: 'think',
    idle: 'idle', stand: 'idle', wait: 'idle', rest: 'idle', relax: 'idle', stare: 'idle', breathe: 'idle',
    sit: 'sit', kneel: 'sit', crouch: 'sit', sleep: 'sit', bow: 'bow', nod: 'nod', shrug: 'shrug',
    cry: 'sad', sob: 'sad', sigh: 'sad', slump: 'sad', mope: 'sad', gasp: 'shocked', yell: 'angry',
    shout: 'angry', rage: 'angry', fume: 'angry', stomp: 'angry', talk: 'talk', hold: 'hold',
    facepalm: 'facepalm', smile: 'happy', grin: 'happy', beam: 'happy', present: 'point', gesture: 'point'
  };
  function baseForms(w) {
    var f = [w];
    if (/ies$/.test(w)) f.push(w.slice(0, -3) + 'y');
    if (/es$/.test(w)) f.push(w.slice(0, -2));
    if (/s$/.test(w)) f.push(w.slice(0, -1));
    return f;
  }
  function animFor(w) {
    var f = baseForms(w);
    for (var i = 0; i < f.length; i++) if (ANIMS[f[i]]) return ANIMS[f[i]];
    return null;
  }

  var MOODS = {
    shocked: 'shocked', surprised: 'shocked', amazed: 'shocked', stunned: 'shocked', astonished: 'shocked',
    angry: 'angry', furious: 'angry', mad: 'angry', annoyed: 'angry',
    sad: 'sad', tired: 'sad', exhausted: 'sad',
    happy: 'happy', excited: 'happy', proud: 'happy', thrilled: 'happy', relieved: 'happy', inspired: 'happy', delighted: 'happy',
    confused: 'confused', puzzled: 'confused', scared: 'scared', terrified: 'scared', afraid: 'scared',
    nervous: 'nervous', embarrassed: 'nervous'
  };
  var EMOTES = {
    '!': '!', '!!': '!', '?': '?', '??': '?', '...': '...', '!?': '!?', '?!': '!?',
    sweat: 'sweat', sweats: 'sweat', 'sweat drop': 'sweat', anger: 'anger', heart: 'heart', hearts: 'heart',
    love: 'heart', sparkle: 'sparkle', sparkles: 'sparkle', music: 'music', zzz: 'zzz', idea: 'idea',
    lightbulb: 'idea', 'light bulb': 'idea', 'has an idea': 'idea', 'gets an idea': 'idea'
  };

  var RUNNY = /^(run|runs|rush|rushes|dash|dashes|sprint|sprints|charge|charges|burst|bursts|hurry|hurries|flee|flees|escape|escapes)$/;

  function compile(text, ctx) {
    var original = String(text || '').trim();
    var all = tokenize(original);
    var plain = all.slice();
    while (plain.length && /^[!?.]+$/.test(plain[plain.length - 1])) plain.pop();
    var s = plain.join(' ').replace(/ , /g, ', ');
    var m;

    // Set-specific events first ("slide 63", "cursors appear", ...).
    for (var e = 0; e < ctx.events.length; e++) {
      m = ctx.events[e].match.exec(s);
      if (m) return { op: 'event', id: ctx.events[e].id, args: m.slice(1).filter(function (x) { return x !== undefined; }) };
    }

    // Global directions.
    if ((m = /^set (\S+)$/.exec(s))) return { op: 'set', name: m[1] };
    if ((m = /^(?:sam )?(?:blasts?|fix(?:es)?|zaps?|snaps?) (.+)$/.exec(s))) return { op: 'blast', what: m[1].replace(/^(?:the|all|those|these) /, '') };
    if ((m = /^(?:play|you play|player plays|take control|you take control)(?: (?:to|until|till|up to) (.+))?$/.exec(s))) {
      return { op: 'play', target: m[1] ? target(m[1].split(' '), ctx) : null };
    }
    if ((m = /^camera (?:follows?|tracks?) (.+)$/.exec(s))) {
      var f = takeActors(tokenize(m[1]), ctx);
      if (f && f.ids.length) return { op: 'follow', actor: f.ids[0] };
    }
    if ((m = /^(camera|pan|cut)(?: (?:to|on|over to|back to))? (.+)$/.exec(s))) {
      return { op: 'camera', target: target(m[2].split(' '), ctx), cut: m[1] === 'cut' };
    }
    if ((m = /^(?:(big|small|little|huge|tiny) )?(?:screen ?)?shake$/.exec(s)) || /^(?:the )?(?:screen|ground|cave|room|floor) shakes$/.test(s)) {
      var size = m && m[1] ? (/big|huge/.test(m[1]) ? 'big' : 'small') : (m ? 'normal' : 'big');
      return { op: 'shake', size: size };
    }
    if (/^(?:white )?flash$|^(?:the )?screen flashes$/.test(s)) return { op: 'flash' };
    if ((m = /^wait(?: for)?(?: (\d+(?:\.\d+)?))?(?: ?(?:s|sec|secs|second|seconds))?$/.exec(s))) {
      return { op: 'wait', seconds: m[1] ? Number(m[1]) : 1 };
    }
    if (/^(?:pause|beat|long pause|silence)$/.test(s)) return { op: 'pause' };
    if ((m = /^crate\s+(.+?)\s*$/i.exec(original))) return { op: 'crate', name: m[1] };
    if ((m = /^(?:an? |the )?(\S+(?: \S+)?) crate (?:drops|falls|lands|appears)(?: from the sky)?\s*$/i.exec(original))) return { op: 'crate', name: m[1] };
    if ((m = /^arms\s+(.+?)\s*$/i.exec(original))) return { op: 'arms', name: m[1] };
    if (/^(?:mission )?complete$|^mission accomplished$/.test(s)) return { op: 'complete' };
    if ((m = /^banner\s+(.+?)\s*$/i.exec(original))) return { op: 'banner', text: m[1] };
    if ((m = /^(?:the )?end\s*[:|]\s*(.+?)\s*$/i.exec(original))) return { op: 'ending', text: m[1] }; // [the end: Ready for the next adventure!]
    if (/^(?:the )?end$|^ending$|^fin$/.test(s)) return { op: 'ending' };
    if (/^title(?: card)?$/.test(s)) return { op: 'title' };
    if ((m = /^hud (on|off)$/.exec(s))) return { op: 'hud', on: m[1] === 'on' };
    if ((m = /^(hide|show) (?:the )?hud$/.exec(s))) return { op: 'hud', on: m[1] === 'show' };
    if ((m = /^(?:play )?music (.+)$/.exec(s))) return { op: 'music', name: /^(off|stop|none)$/.test(m[1]) ? null : m[1] };
    if (/^stop (?:the )?music$/.test(s)) return { op: 'music', name: null };
    if ((m = /^(?:sfx|sound) (.+)$/.exec(s))) return { op: 'sfx', name: m[1] };
    if ((m = /^click(?: on)? (.+)$/.exec(s))) return { op: 'click', target: target(m[1].split(' '), ctx) };
    if ((m = /^(?:free|rescue|release|unchain|untie) (.+)$/.exec(s))) {
      var fr = takeActors(tokenize(m[1]), ctx);
      if (fr && !fr.rest.length) return { op: 'free', actors: fr.ids, by: null };
    }
    if ((m = /^(hide|show) (.+)$/.exec(s))) {
      var hs = takeActors(tokenize(m[2]), ctx);
      if (hs && !hs.rest.length) return { op: m[1], actors: hs.ids };
    }

    // "<actors> <verb phrase>"
    var who = takeActors(all, ctx);
    if (who && who.ids.length) {
      var ids = who.ids;
      var restAll = who.rest.filter(function (w) { return w !== ','; });
      var rest = restAll.slice();
      while (rest.length && /^[!?.]+$/.test(rest[rest.length - 1])) rest.pop();
      var r = rest.join(' ');

      if (!r && restAll.length) {
        var em = EMOTES[restAll.join(' ')];
        if (em) return { op: 'emote', actors: ids, emote: em };
      }
      if (EMOTES[r]) return { op: 'emote', actors: ids, emote: EMOTES[r] };

      if ((m = /^(enters?|(?:walk|come|step|run|rush|charge|dash|sprint|march|sneak|burst)(?:s|es)? in)(?: from)?(?: the)?(?: stage)?(?: (left|right))?(?: side)?(?: (?:to|over to|up to) (.+))?$/.exec(r))) {
        return { op: 'enter', actors: ids, side: m[2] || 'left', run: RUNNY.test(m[1].split(' ')[0]), target: m[3] ? target(m[3].split(' '), ctx) : null };
      }
      if ((m = /^(walks?|runs?|moves?|goes|go|heads?|rushes|rush|steps?|dashes|dash|marches|march|sneaks?|sprints?|charges?|strolls?|hurries|hurry|wanders?|creeps?)(?: (?:over|back|up|across|straight))? to (.+)$/.exec(r))) {
        return { op: 'move', actors: ids, run: RUNNY.test(m[1]), target: target(m[2].split(' '), ctx) };
      }
      if ((m = /^approach(?:es)? (.+)$/.exec(r))) return { op: 'move', actors: ids, run: false, target: target(m[1].split(' '), ctx) };
      if ((m = /^(walks?|runs?|moves?|steps?) (left|right|forward|back|backward|backwards|closer|away)$/.exec(r))) {
        return { op: 'step', actors: ids, dir: m[2].replace(/wards?$/, ''), run: RUNNY.test(m[1]) };
      }
      if ((m = /^(exits?|leaves?|(?:walk|run|dash|rush|march|storm)(?:s|es)? (?:out|off|away)|flees|flee|retreats?|escapes?)(?: (?:to )?(?:the )?(left|right))?(?: side)?$/.exec(r))) {
        return { op: 'exit', actors: ids, side: m[2] || null, run: RUNNY.test(m[1].split(' ')[0]) };
      }
      if (/^turns? around$/.test(r)) return { op: 'face', actors: ids, target: 'flip' };
      if ((m = /^(?:faces?|turns? to(?: face)?|turns? towards?|looks? at|looks? towards?|looks?)(?: the)? (.+)$/.exec(r))) {
        return { op: 'face', actors: ids, target: target(m[1].split(' '), ctx) };
      }
      if (/^(?:jumps?|hops?|leaps?)(?: (?:for joy|up|up and down|in the air))?$/.test(r)) return { op: 'jump', actors: ids };
      if (/^(?:drops?|parachutes?|falls?) in$/.test(r)) return { op: 'drop', actors: ids };
      if (/^(?:is|gets|breaks|break) (?:freed|free)$|^breaks free$/.test(r)) return { op: 'free', actors: ids, by: null };
      if ((m = /^(?:frees|free|rescues|rescue|releases|release|unchains|unchain|unties|untie) (.+)$/.exec(r))) {
        var t = takeActors(tokenize(m[1]), ctx);
        if (t && !t.rest.length) return { op: 'free', actors: t.ids, by: ids[0] };
      }
      if ((m = /^(?:throws?|hurls?|tosses|toss|flings?)(?: (?:the|a|some|more|his|her|their))?(?: (?:stack|pile) of)? (?:slides?|papers?|decks?|ppts?|powerpoints?)(?: (?:at|to|toward|towards) (.+))?$/.exec(r))) {
        var tg = m[1] ? takeActors(tokenize(m[1]), ctx) : null;
        return { op: 'throw', actors: ids, targets: tg && tg.ids.length ? tg.ids : null };
      }
      if (/^(?:hides?|disappears?|vanishes|vanish)$/.test(r)) return { op: 'hide', actors: ids };
      if (/^(?:appears?|shows? up|reappears?|pops? up)$/.test(r)) return { op: 'show', actors: ids };
      if ((m = /^(?:is |looks |gets |seems |feels |becomes |goes )?([a-z]+)$/.exec(r)) && MOODS[m[1]]) {
        return { op: 'mood', actors: ids, mood: MOODS[m[1]] };
      }
      var first = rest[0] ? animFor(rest[0]) : null;
      var two = rest.length > 1 ? ANIMS[rest[0].replace(/s$/, '') + ' ' + rest[1]] : null;
      var anim = two || first;
      if (anim) {
        var tm = /(?:^| )(?:at|to|toward|towards) (.+)$/.exec(r);
        return { op: 'anim', actors: ids, anim: anim, target: tm ? target(tm[1].split(' '), ctx) : null };
      }
    }

    return { op: 'note', text: original };
  }

  // The single actor a speaker name refers to ("GENERAL BULLETPOINT" -> GENERAL), or null.
  function actorFor(name, ctx) {
    var words = tokenize(name);
    var m = matchAt(words, 0, ctx);
    return m && m.end === words.length && m.ids.length === 1 ? m.ids[0] : null;
  }

  // The actors a group name refers to ("DEVS", "the villagers"), or null.
  function groupFor(name, ctx) {
    var words = tokenize(name);
    while (words[0] === 'the' || words[0] === 'all') words = words.slice(1);
    if (words.length === 1 && EVERYONE[words[0]]) return null;
    var m = matchAt(words, 0, ctx);
    return m && m.end === words.length ? m.ids.slice() : null;
  }

  MS.directions = { context: context, compile: compile, tokenize: tokenize, actorFor: actorFor, groupFor: groupFor };
})(typeof window !== 'undefined' ? window : globalThis);
