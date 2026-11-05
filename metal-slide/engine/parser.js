/* METAL SLIDE engine: script parser.
   Turns the screenplay text in script.js into missions made of beats.
   Pure: no DOM, no canvas. Tested in Node (tests/parser.test.js). */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  var MISSION_RE = /^MISSION\s+(\d+(?:\.\d+)?[A-Z]?)\s*(?::\s*(.*))?$/i;
  // Speaker names are written in capitals, screenplay style: "DEV 1 (yelling): text".
  var SPEAKER_RE = /^([A-Z0-9][A-Z0-9 .'&-]*?)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;

  function clean(s) {
    return String(s)
      .replace(/[‘’‛′]/g, "'")
      .replace(/[“”″]/g, '"')
      .replace(/…/g, '...')
      .replace(/\s*[–—]\s*/g, ' - ')
      .replace(/ /g, ' ');
  }

  function parse(text) {
    var out = { title: null, subtitle: null, journey: null, missions: [], warnings: [] };
    var mission = null;
    var lastSpeaker = null;
    var lines = String(text || '').split(/\r?\n/);

    function warn(line, message) { out.warnings.push({ line: line, message: message }); }
    function push(beat) {
      if (!mission) { warn(beat.line, 'This line comes before the first MISSION, so it is skipped.'); return; }
      mission.beats.push(beat);
    }

    for (var i = 0; i < lines.length; i++) {
      var lineNo = i + 1;
      var raw = clean(lines[i]).trim();
      if (!raw || raw.indexOf('//') === 0) continue;

      var unhashed = raw.replace(/^#+\s*/, '');
      var mm = MISSION_RE.exec(unhashed);
      if (mm) {
        mission = { num: mm[1], title: (mm[2] || '').trim() || ('MISSION ' + mm[1]), line: lineNo, beats: [] };
        out.missions.push(mission);
        lastSpeaker = null;
        continue;
      }
      if (raw.charAt(0) === '#') continue; // a markdown-style comment or heading

      // Pull out every [stage direction]; they run before this line's dialogue.
      var dirs = [];
      var rest = raw.replace(/\[([^\]]*)\]/g, function (_, d) {
        if (d.trim()) dirs.push(d.trim());
        return ' ';
      }).replace(/\s+/g, ' ').trim();
      for (var d = 0; d < dirs.length; d++) push({ type: 'dir', text: dirs[d], line: lineNo });
      if (!rest) continue;

      var sm = SPEAKER_RE.exec(rest);
      if (sm) {
        var name = sm[1].trim();
        var mood = sm[2] ? sm[2].trim() : null;
        var body = sm[3].trim();
        var key = MS.util.norm(name);

        if (!mission) {
          if (key === 'TITLE') { out.title = body; continue; }
          if (key === 'SUBTITLE') { out.subtitle = body; continue; }
          if (key === 'JOURNEY') { out.journey = body; continue; } // the world map's title
        }
        if (key === 'BRIEF' && mission) { mission.brief = body; continue; } // the chapter card on the world map
        if (key === 'CROWD') {
          push({ type: 'crowd', target: mood, lines: body.split('|').map(function (s) { return s.trim(); }).filter(Boolean), line: lineNo });
          lastSpeaker = null;
        } else if (key === 'NARRATOR') {
          push({ type: 'narrate', text: body, line: lineNo });
          lastSpeaker = 'NARRATOR';
        } else if (key === 'CASESTUDY' || key === 'CASESTUDIES') {
          // A link out to a case study, shown on the mission's results screen. Not a beat.
          var cs = body.split('|');
          var url = (cs[1] || '').trim();
          if (!url) warn(lineNo, 'CASE STUDY needs a link after a | character, like: CASE STUDY: The tool | ../work/tool/');
          else if (/^\s*javascript:/i.test(url)) warn(lineNo, 'That CASE STUDY link is not a web address, so it is skipped.');
          else if (!mission) warn(lineNo, 'This line comes before the first MISSION, so it is skipped.');
          else (mission.links = mission.links || []).push({ label: cs[0].trim(), url: url, line: lineNo });
          lastSpeaker = null;
        } else if (key === 'TALLY') {
          var parts = body.split('|');
          push({ type: 'tally', label: parts[0].trim(), value: (parts[1] || '').trim(), line: lineNo });
          lastSpeaker = null;
        } else {
          if (body) push({ type: 'say', speaker: name, mood: mood, text: body, line: lineNo });
          lastSpeaker = { name: name, mood: mood };
        }
        continue;
      }

      // A plain line: more from the last speaker, or narration.
      if (lastSpeaker && lastSpeaker !== 'NARRATOR') {
        push({ type: 'say', speaker: lastSpeaker.name, mood: lastSpeaker.mood, text: rest, line: lineNo });
      } else {
        push({ type: 'narrate', text: rest, line: lineNo });
      }
    }
    return out;
  }

  MS.parser = { parse: parse, clean: clean };
})(typeof window !== 'undefined' ? window : globalThis);
