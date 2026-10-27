/* =====================================================================
   METAL SLIDE: THE SCRIPT
   Fourth draft: Sam's real story, from slide-deck briefs to livin' in the future,
   tightened so each chapter plays in a couple of minutes.
   It's yours to rewrite. Edit the text between the two lines of ===== below and
   refresh the page.

   HOW TO WRITE
   JOURNEY: name                 the world map's title (before the first MISSION)
   MISSION 1: TITLE              starts a mission (a title card plays first)
   BRIEF: one or two sentences   what the chapter is about, on its world map card
   [set cave]                    picks the art: cave, kingdom, city, siege, future
   NAME: line                    dialogue box with a portrait
   NAME (yelling): line          a mood changes the face: yelling, happy,
                                 shocked, sad. (bubble) shows a speech bubble
   CROWD: a | b | c              bubbles over several heads at once
   CROWD (DEVS): a | b           bubbles over one group only
   NARRATOR: line                narration, no portrait
   TALLY: label | value          a score row on the MISSION COMPLETE screen
                                 (values can use → ▲ ✓)
   CASE STUDY: label | link      a "read the case study" button on the
                                 MISSION COMPLETE screen (opens a new tab)
   *word*                        highlights a word
   // anything                   a comment, ignored

   STAGE DIRECTIONS go in [brackets], in plain English. These work:
     [Sam walks in from the left]   [Sam runs in from the right]
     [Sam walks to the General]     [Sam walks to the podium]   [Sam walks to 300]
     [the devs run out right]       [General exits left]        [PM runs to Sam]
     [Sam faces the devs]           [Sam turns around]
     [the devs cheer]  salute, wave, point, panic, clap, dance, shrug, think, bow...
     [Sam !]  [General ?]  [DEV 1 sweats]  [Sam is shocked]  [General is angry]
     [free the devs]   [General throws slides at the devs]
     [crate FIGMA]     (a supply crate drops and Sam grabs the power-up)
     [pan to the General]  [cut to Sam]  [camera follows Sam]
     [shake]  [big shake]  [flash]  [wait 1.5]  [pause]
     [complete]  (MISSION COMPLETE, then the TALLY rows)
     [the end]  or  [the end: a closing line]  (the final screen)
   GAMEPLAY: [play to the desks] hands Sam to the player until he reaches
   that place (run, jump, fire the spec blaster). If nobody plays, demo
   mode runs him there. Places per set:
     cave: entrance, piles, workshop, desks, podium, screen, exit
     kingdom: gate, well, market, square, scriptorium, tower, castle
     city: lobby, desks, board, kitchen, window
     siege: hq, street, barricade, arena, gate
     future: skybridge, plaza, garden, hologram, overlook
   Each set also has its own events: cave [slide 1] [slide 12] [slide 63]
   [slide 84] [staging review] [blast the layouts] [wireframe] [daylight]; kingdom
   [cursors appear] [scrolls merge]; city [buttons unify] [city builds]
   [the numbers climb] [sirens]; siege [the robot arrives] [the doors lock];
   future [the notes sort] [the report is checked] [prototype appears]
   [tools rise] [ideas bloom].
   Anything the game doesn't understand yet becomes a note instead of an
   error: press the backquote key while playing to see them.

   One rule: don't type the backtick character anywhere in the script.
   ===================================================================== */
window.MS_SCRIPT = String.raw`
// =====================================================================
TITLE: METAL SLIDE
SUBTITLE: From slide decks to the future
JOURNEY: How I transformed the company

MISSION 1: OPERATION EYEBALL IT
BRIEF: Bringing in UX design, a discipline the company never had: real wireframes with the padding on an 8-pixel grid, and a brand new role to own it.
[set cave]
NARRATOR: Deep beneath the org chart, the web team builds websites... from slide decks.
[pan to podium]
[slide 1]
GENERAL BULLETPOINT (yelling): LISTEN UP, DEVS! New website. The deck IS the brief!
[General throws slides at the devs]
[slide 12]
DEV 1: Sir... slide twelve just says PADDING: ???
GENERAL BULLETPOINT (yelling): Then EYEBALL IT!
[pan to desks]
[the devs sweat]
CROWD (DEVS): Zooming in to 800%... | Measuring with my thumb.
NARRATOR: Three weeks later the site goes up on staging. That's when the feedback arrives. All of it.
[staging review]
[General is angry]
GENERAL BULLETPOINT (yelling): WRONG! The spacing's WRONG!
DEV 2 (shocked): Wrong compared to what, sir? It wasn't in the deck!
GENERAL BULLETPOINT: Compared to how it makes me *feel*.
[pan to podium]
[slide 84]
GENERAL BULLETPOINT (yelling): And make the logo BIGGER!
DEV 4 (sad): Sir, it's already the whole slide.
GENERAL BULLETPOINT (yelling): THEN MAKE THE SLIDE BIGGER!
[shake]
[cut to entrance]
[Sam walks in from the left]
[camera follows Sam]
[play to piles]
TROOPER 1 (yelling): HALT! State your department!
SAM: UX design.
TROOPER 2 (shocked): We have one of those?!
[crate UX DESIGN]
SAM (yelling): UX DESIGN!
[play to desks]
[blast the layouts]
[flash]
[big shake]
[the troopers panic]
[the troopers exit right]
[free the devs]
[the devs cheer]
[wireframe]
SAM: No more decks. Meet UX design.
DEV 1 (shocked): Oh wow... an actual wireframe!
CROWD (DEVS): And it has PADDING! | An 8-pixel grid?! | Incredible!
GENERAL BULLETPOINT (angry): This isn't over! I still have the APPENDIX!
[General exits right]
[daylight]
NARRATOR: The company had never had UX design. So it made a brand new role: UX designer. Guess who got it.
[complete]
TALLY: Devs freed | 4
TALLY: Wireframes | Actual ones
TALLY: Spacing | 8-pixel grid
TALLY: New roles created | UX designer

MISSION 2: THE KINGDOM OF FINAL_FINAL_V9
BRIEF: Bringing in Figma: forty hand-copied versions become one live file, and feedback happens before anyone builds.
[set kingdom]
NARRATOR: The specs are written down now. All forty copies. By hand.
[pan to tower]
MASON (happy): Behold! The tower, built exactly to version three!
VILLAGER 1 (shocked): Three?! We're on version NINE!
CROWD (VILLAGERS): Mine says final_v7! | Mine says FINAL_final! | Mine's still drying!
[cut to gate]
[Sam walks in from the left]
[camera follows Sam]
[play to market]
[crate FIGMA]
SAM (yelling): FIGMA!
CROWD (VILLAGERS): Witchcraft! | A glowing scroll?! | Burn it! ...Can I try?
[cursors appear]
SAM: That's the whole team, in one file. Live.
[play to scriptorium]
[scrolls merge]
[flash]
SCRIBE (shocked): All forty copies... became one?
[MASON runs to Sam]
MASON (shocked): And I can click it and see the spacing?!
SAM: Every pixel. And the King leaves his notes before you lay a stone, not after.
MASON (happy): Feedback BEFORE we build? I could weep.
[the villagers cheer]
[complete]
TALLY: Copies of the plan | 40 → 1
TALLY: Feedback | Before the build
TALLY: People in one file | Everyone

MISSION 3: THE CITY OF 47 BLUES
BRIEF: Introducing a design system: one set of components and tokens, consistent pages built faster, and better results.
[set city]
NARRATOR: Centuries later. Everyone shares one file... and builds their own buttons.
[pan to desks]
DESIGNER: Quick question. Which blue is OUR blue?
DEVELOPER: We have forty-seven. Pick a favorite.
CROWD (WORKERS): Blue! | Bluer! | Slightly sadder blue!
DEVELOPER (sad): And I've built this date picker eleven times. It still breaks in February.
[cut to lobby]
[Sam walks in from the left]
[camera follows Sam]
[play to desks]
[crate DESIGN SYSTEM]
SAM (yelling): DESIGN SYSTEM!
CROWD (WORKERS): It's... organized?! | It has naming rules?! | Is it documented?!
[play to board]
[buttons unify]
[big shake]
DESIGNER (shocked): Forty-seven blues... just became one.
SAM: Tokens and components. Designed once, built once, used everywhere.
[city builds]
[the numbers climb]
PM (happy): Leads are up. Downloads are up. People are actually *staying* on the page.
SAM: Consistent pages are better pages.
[camera follows Sam]
[play to window]
[sirens]
NARRATOR: Then the news broke. New accessibility laws. Every site, every country.
SAM: Good thing we only have to fix each thing once.
[complete]
TALLY: Shades of blue | 1
TALLY: Leads | Up ▲
TALLY: Downloads | Up ▲
TALLY: Engagement | Up ▲
CASE STUDY: UNIVERSE: a launch site and design system | ../work/universe/

MISSION 4: THE SIEGE
BRIEF: Accessibility at scale: accessible components close every way in, with WCAG, the European Accessibility Act and the ADA covered.
[set siege]
NARRATOR: Midnight. Every page the company runs is a door. And something is checking the locks.
[pan to arena]
[the robot arrives]
[big shake]
[pan to street]
DESIGNER (shocked): It's legal risk. With legs.
DEVELOPER: It's looking for a way in. Missing alt text. Low contrast. A keyboard trap.
[cut to hq]
[Sam walks in from the left]
[camera follows Sam]
[crate ACCESSIBILITY]
SAM (yelling): ACCESSIBILITY!
[play to barricade]
[the doors lock]
DESIGNER (happy): We fixed the button once... and it's fixed on every site.
[sfx stomp]
[big shake]
DEVELOPER (shocked): It's still coming!
[camera follows Sam]
[play to gate]
[big shake]
NARRATOR: Every door shut. WCAG, the European Accessibility Act and the ADA: covered.
SAM: And every customer can use every page. That was always the point.
[complete]
TALLY: WCAG 2.2 AA | Pass ✓
TALLY: European Accessibility Act | Compliant ✓
TALLY: ADA | Compliant ✓
TALLY: Legal risk | Closed off

MISSION 5: TOMORROW, TODAY
BRIEF: Bringing in AI tools: faster research and redesigns, a human checking every finding, and the time saved spent building tools for the whole company.
[set future]
NARRATOR: The future. Every page is consistent, accessible and fast. Now: what do people really think?
[pan to plaza]
RESEARCHER (sad): Twelve usability sessions. Four hundred sticky notes. One of me.
CITIZEN 1: When's the report?
RESEARCHER (sad): Three weeks. Then two more for the redesign.
[cut to skybridge]
[Sam walks in from the left]
[camera follows Sam]
[crate A.I.]
SAM (yelling): A.I.!
[play to hologram]
[the notes sort]
SAM: It clusters the notes and drafts the report. Then a human checks every finding.
[RESEARCHER walks to the hologram]
[the report is checked]
RESEARCHER (happy): Checked. Every one. Raw data to report in a week, not three.
[prototype appears]
DESIGNER (happy): And the redesign is clickable already. A day or two, not weeks!
DESIGNER (whispering): Wait. Does it replace us?
SAM: No. It removes the waiting. You still decide what's good.
NARRATOR: The time they saved didn't vanish. They spent it building.
[tools rise]
[HR LEAD and SALES REP run in from the right]
HR LEAD (happy): Is this where we get an HR tool people can actually use?
SALES REP (happy): And an AR tool that puts the product in the customer's room?
SAM: First our own team. Then the whole company. The queue moves fast now.
[General runs in from the right to 1380]
GENERAL BULLETPOINT (happy): At ease, I'm retired. Can this A.I. make the logo bigger?
SAM: It can make five versions. Then we test which one works.
[camera follows Sam]
[play to overlook]
[the devs run in from the right]
DEV 2 (yelling): We're livin' in the future!
[the devs dance]
[Sam faces right]
SAM (yelling): So. Who's ready for the next adventure?!
CROWD (DEVS): READY! | Born ready!
[complete]
TALLY: Research to report | 3 weeks → 1 week
TALLY: Redesign turnaround | 2-3 weeks → 1-2 days
TALLY: Human checks | Every finding
TALLY: Tools built | Team + company
CASE STUDY: VISTA: an AI HR tool | ../work/vista-hr/
CASE STUDY: The AR sales tool | ../work/ar-sales-tool/
// The AI workshop study is still a draft on the site; restore this line when it's published:
// CASE STUDY: Leveraging AI: my team's workflows | ../work/ai-workshop/
[the end: Ready for the next adventure!]
// =====================================================================
`;
