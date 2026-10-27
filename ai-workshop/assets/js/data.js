/*
  data.js — the swappable content layer.

  Classic script: defines GLOBALS, no import/export. Loaded BEFORE app.js so
  that TALK and CASE_STUDIES exist when the engine runs. Content lives here so
  the engine (app.js) never needs to fork per case study — one engine, one
  template, this data array.

  NOTE: content ships as JS globals (not JSON) on purpose — that sidesteps
  fetch()/XHR, which browsers block for local files over file://.

  BEAT SHAPE (read by renderCaseStudy):
    { heading: 'string', blocks: [ ...content blocks... ] }
  A beat's body is an ORDERED list of blocks, each dispatched by `type` so the
  one template serves every case study without forking:
    { type: 'text', text: '...', tag?: 'Context', evidence?: 'Qualitative' }
    { type: 'headline', text: '~1–2 weeks → ~1 day', evidence: 'Directional estimate' }
    { type: 'media', video?, image?, ratio?, placeholder, caption? }
    { type: 'diagram', ai: [...], human: [...], caption? }   // shared two-lane
  (Back-compat: a beat may instead use { lines: ['...'] } — rendered as text.)

  The engine reveals beats one at a time, in order; nothing past the current
  beat is rendered. Real content is added per case study (CS1 below; CS2/CS3
  still placeholders until their prompts) — the engine does not change.
*/

const TALK = {
  title: "Leveraging AI: Transforming my team's workflows",
  throughLine: 'Efficiency without losing effectiveness, with the human in the loop.',
  // Section heading that bridges the setup overview into the case-study storytelling.
  introHeading: 'The stories behind the numbers',
  // Hub overview + the AI tools actually used across the three case studies.
  intro: [
    'Three implementations across key projects, one recurring pattern: we handed the time-consuming, repetitive work (generating, compiling, scraping) to AI, giving our team more time and bandwidth for what mattered: judgement, direction, alignment, and the final call.',
    'Here’s what changed in each case, and what we took away as a result.'
  ],
  // Real uploaded marks in assets/logos/; the inline `logo` key is the offline fallback.
  tools: [
    { name: 'Figma Make',    logoSrc: 'assets/logos/figma.svg',   logo: 'figma' },
    { name: 'Figma MCP',     logoSrc: 'assets/logos/figma.svg',   logo: 'figma' },
    { name: 'ChatGPT',       logoSrc: 'assets/logos/chatgpt.svg', logo: 'openai' },
    { name: 'Gemini',        logoSrc: 'assets/logos/gemini.svg',  logo: 'gemini' },
    { name: 'Claude',        logoSrc: 'assets/logos/claude.svg',  logo: 'claude' },
    { name: 'Claude Code',   logoSrc: 'assets/logos/claude.svg',  logo: 'claude' },
    { name: 'Claude Cowork', logoSrc: 'assets/logos/claude.svg',  logo: 'claude' },
    { name: 'Claude Design', logoSrc: 'assets/logos/claude.svg',  logo: 'claude' }
  ],
  // Final takeaways — an expandable set of cards at the foot of the hub.
  takeaways: {
    title: 'To Wrap Up: A Few Takeaways',
    subtitle: 'Practical starting points for bringing AI into your own workflow.',
    items: [
      { icon: 'bolt',   title: 'Just start',                 text: 'The best way in is to dive in. Pick a real task this week and try it. Momentum beats planning.' },
      { icon: 'target', title: 'Target the bottlenecks',     text: 'Find the slow, repetitive parts of your workflow. That’s where AI pays off first.' },
      { icon: 'chat',   title: 'Ask the AI itself',          text: 'Stuck? The tool is one of your best teachers. Ask it how, then iterate.' },
      // The 4D framework for AI fluency (Dakan & Feller). Introduced here as the
      // practical "how to get good" step, before the closing human-in-the-loop card.
      { type: 'framework',
        title: 'The 4D framework for AI fluency',
        intro: 'A practical way to sharpen how you work with AI. Developed through a research collaboration between Professor Rick Dakan (Ringling College of Art and Design) and Professor Joseph Feller (University College Cork), it identifies four core competencies that, used together, help you get the most from working with AI.',
        source: 'Framework: Prof. Rick Dakan (Ringling College of Art and Design) and Prof. Joseph Feller (University College Cork).',
        items: [
          { icon: 'share',   title: 'Delegation',  text: 'Decide what humans do, what AI does, and how to split the work between them.' },
          { icon: 'message', title: 'Description', text: 'Communicate clearly: define the output you want and how the AI should behave.' },
          { icon: 'eye',     title: 'Discernment', text: 'Evaluate what comes back critically for quality, accuracy and fit.' },
          { icon: 'shield',  title: 'Diligence',   text: 'Use AI responsibly: stay transparent and own the results of AI-assisted work.' }
        ]
      },
      { type: 'finale', title: 'Keep the human in the loop', text: 'AI isn’t here to replace you. If you leverage it in the right way, it can become a powerful partner to help level up your workflow.' }
    ]
  },
  // A brief closing sign-off, shown as its own module below the wrap-up.
  thanks: {
    title: 'Thank you',
    subtitle: 'Questions, or a workflow you want to rethink? Let’s talk.'
  },
  // Hub overview of how the team uses AI (sits below the hero).
  teamAI: {
    title: 'How my team uses AI',
    lead: 'AI has become part of how we work, speeding up research, design and delivery while we keep a firm hand on quality. The shape is always the same: AI takes the slow, repetitive lifting, and a person stays in the loop to validate, decide and refine.',
    areas: [
      { icon: 'search',    label: 'Research & synthesis', stat: '~35%',   text: 'less analysis time, turning analytics, competitor reviews and usability studies into actionable recommendations.' },
      { icon: 'chart-bar', label: 'Testing & reporting',  stat: '30–40%', text: 'faster qualitative analysis, report writing and survey design.' },
      { icon: 'layers',    label: 'Design',               stat: '60–90%', text: 'faster early concepts, wireframes and prototypes in Figma Make and Claude, so we iterate and align sooner.' },
      { icon: 'check',     label: 'Accessibility',        stat: '~80%',   text: 'more efficient WCAG audits, flagging issues on live pages and during design QA before handoff.' }
    ],
    note: 'We keep it trustworthy by cross-checking outputs across multiple AI tools and keeping a human in the loop, validating for consistency and guarding against bias or error.',
    next: 'And we’re just getting started: as we roll out Claude, we’re building our own tools, dashboards and task automation, with the potential to transform turnaround on always-on work like the long-tail design-system rollout and continuous page analysis.'
  }
};

const CASE_STUDIES = [
  {
    id: 'cs1',
    icon: 'cursor',
    title: 'Rapid Prototyping: HR Vista',
    oneLiner: 'From weeks of manual wiring to a clickable redesign in a day.',
    beats: [
      {
        heading: 'The problem',
        blocks: [
          { type: 'points', items: [
            { icon: 'clock', text: 'Expressing a design recommendation the old way meant manually wiring up screens and building each interaction by hand, and for anything complex that took up to 3 weeks before it was ready for stakeholder review.' },
            { icon: 'target', text: 'It also landed in a tight rollout planned with minimal manual onboarding, so the redesign HAD to be intuitive on its own to succeed, with no training budget to lean on.' }
          ]}
        ]
      },
      {
        heading: 'What we did',
        blocks: [
          { type: 'text', text: 'The dev team asked us, as the UX experts, to review their OKR-writing designs. We ran a heuristic evaluation, going through the flow against UX best practices and flagging where it was confusing or fell short, then used Figma Make to prototype our recommendations fast enough to hand the dev team a working redesign, not just a written spec.' },
          {
            type: 'breakdown',
            label: 'What we found',
            feedbackLabel: 'Issue',
            steps: [
              { img: 'assets/cs1/before/01-objective-form.png',
                title: 'Committed vs. Aspirational status is not obvious',
                feedback: 'It isn’t obvious that a committed OKR can be switched to aspirational; the control reads as a fixed label, not a choice.',
                recommendation: 'Make the status a toggle, and add hover tooltips that explain each label as you use it (progressive onboarding).' },
              { img: 'assets/cs1/before/01-objective-form.png',
                title: '“OKR Tag” meaning is unclear',
                feedback: 'The “OKR Tag” label isn’t self-explanatory, and nothing on the control hints at what it does.',
                recommendation: 'Add a tooltip or inline helper text explaining what OKR tags are and how they’re used.' },
              { img: 'assets/cs1/before/01-objective-form.png',
                title: 'The AI button is hard to find',
                feedback: 'The AI action is easy to miss: an icon-only button set apart from the natural flow of the form.',
                recommendation: 'Swap icon-only for text + icon (“✨ Validate with AI”), and move it directly below the OKR Tag block, following the natural form-completion flow.' },
              { img: 'assets/cs1/before/02-validation-feedback.png',
                title: 'Validation feedback lacks clear context',
                feedback: 'The AI’s feedback appears at the bottom of the Objective block, so each note has to be mapped back up to the field it refers to.',
                recommendation: 'Surface each validation note right beside the Objective or Key Result it refers to, instead of grouping it all at the bottom, keeping feedback close to what it evaluates.' },
              { img: 'assets/cs1/before/03-validation-state.png',
                title: 'The validation state is ambiguous',
                feedback: 'While the screen shows “Validating your OKR…”, the fields stay editable, so it’s unclear whether the AI is checking what’s on screen or an earlier version, and edits made mid-check can invalidate the result.' },
              { img: 'assets/cs1/before/04-validation-lock.png',
                title: 'The recommended fix',
                recommendation: 'Lock the inputs while validation runs, behind a centred “Validating…” alert that sets expectations (“this can take up to ~45s…”).' }
            ]
          },
          { type: 'subhead', text: 'The after: the working prototype' },
          {
            type: 'media',
            video: 'assets/cs1/prototype.mp4',
            poster: 'assets/cs1/prototype-poster.jpg',
            ratio: '1158 / 1236',
            maxWidth: '600px',
            placeholder: 'Prototype recording',
            caption: 'Figma Make prototype of the redesigned flow: a status toggle, a clearer “✨ Validate with AI” action, locked inputs during validation, and save-anytime. Shared straight with devs to show the changes, not describe them.'
          },
          { type: 'text', text: 'Devs saw exactly what we meant: no rounds of back-and-forth interpretation.' }
        ]
      },
      {
        heading: 'Human in the loop',
        blocks: [
          {
            type: 'diagram',
            ai: ['Generated the redesigned dashboard pages', 'New icon design, interaction patterns & task flows'],
            human: ['Created the designs', 'Reviewed with the Lead', 'Rapid modifications on the fly', 'Shared with devs', 'Owned the direction, judgement & the ship call']
          }
        ]
      },
      {
        heading: 'Results',
        blocks: [
          { type: 'lead', lines: [
            'Faster Turnaround on a complex prototype:',
            'Design time dropped from ~3 weeks to ~1–2 days.',
            'Allowing recommendations to be shared almost immediately with the development team:'
          ]},
          {
            // Before/after time frame: the ring sweeps to full while the centre shows
            // the range. Reads "3 WEEKS TO / 1–2 / DAYS". [Directional]
            type: 'stat',
            prefix: '3 weeks to',
            text: '1–2',
            unit: 'days'
          },
          { type: 'points', items: [
            { icon: 'rotate', text: 'Rework fell sharply: the dev team built the new direction in roughly one round, instead of cycling through interpretations.', evidence: 'Qualitative' },
            { icon: 'star', text: 'The proof point: it was the strength of that qualitative, expert read that got us invited back for the later stages, including the usability testing in Case Study 2.', evidence: 'Qualitative' }
          ]}
        ]
      }
    ]
  },
  {
    id: 'cs2',
    icon: 'chart-bar',
    title: 'Rapid Usability Analysis: HR Vista',
    oneLiner: 'Raw test data to a polished report in a week, not three.',
    beats: [
      {
        heading: 'Overview',
        blocks: [
          { type: 'points', items: [
            { icon: 'users', text: 'Three moderated, in-person usability rounds (roughly 10–12 participants a round): the first two on OKR writing, the third on AI upskilling, measuring SUS scores and open-ended feedback.' },
            { icon: 'clock', text: 'Turning all of that raw data into a polished, shareable report used to take around three weeks of manual analysis and write-up.' }
          ]}
        ]
      },
      {
        heading: 'What we did',
        blocks: [
          { type: 'text', text: 'Used AI (ChatGPT, Gemini) to: theme & cluster the qualitative feedback; score the SUS results per feature; draft Observations, Insights, and Recommendations.' },
          { type: 'subhead', text: 'Qualitative' },
          {
            type: 'wall',
            label: 'The raw feedback',
            items: [
              { src: 'assets/cs2/board-1.png', alt: 'Usability session affinity board: pain-point columns with clustered sticky notes' },
              { src: 'assets/cs2/board-2.png', alt: 'Usability session affinity board: pain-point columns with clustered sticky notes' },
              { src: 'assets/cs2/board-3.png', alt: 'Usability synthesis board: UI screens, dense sticky-note clusters and dot-voting' },
              { src: 'assets/cs2/board-4.png', alt: 'Usability synthesis board: UI screens, dense sticky-note clusters and dot-voting' }
            ],
            caption: 'Every session, mapped: three rounds of pain points and dot-voting. All of it distilled into the six themes below.'
          },
          {
            // Real themes consolidated from the Vista UXR reports (focus group +
            // usability rounds), anonymised and distilled for the projector.
            // `raw` = representative anonymised snippets — the messy input that
            // clusters into the six themes.
            type: 'themes',
            beforeLabel: 'Raw feedback',
            afterLabel: 'Clustered themes',
            raw: [
              'No onboarding', 'Output too general, not personalised', 'Unclear next step after the prompt',
              'Team lead vs IC R&R?', 'No context for the pillar labels', 'Let me prioritise by importance',
              'Tone too strict / harsh', 'When do I get the result?', 'No grading criteria',
              'Can’t retake the test', 'Coach gives prompts, not guidance', 'Output too text-heavy',
              'Text too light to read', 'R&R should use my OKR input', 'Can’t revisit the chat',
              'Pillar score reasoning unclear', 'Coach just adds more tasks', 'No clear end goal'
            ],
            themes: ['Onboarding & wayfinding', 'Output relevance', 'Scoring transparency', 'Readability & contrast', 'Input burden', 'Coach guidance'],
            caption: 'Eighteen raw comments clustered into six themes across the testing rounds.'
          },
          { type: 'subhead', text: 'Quantitative' },
          { type: 'text', text: 'We closed each session with a short survey, then used AI to crunch the quantitative responses into a System Usability Scale (SUS) score for each feature:' },
          {
            // SUS per feature: OKR writing improved 63 -> 65.8 across rounds 1-2 (a real
            // within-feature uplift); AI upskilling (round 3) held at 58. Both under 68.
            type: 'kpis',
            items: [
              { n: '63 → 65.8', l: 'SUS · OKR writing (rounds 1 & 2)' },
              { n: '58', l: 'SUS · AI upskilling (round 3)' }
            ],
            source: 'OKR writing rose from 63 to 65.8 as we acted on the round 1 feedback; AI upskilling scored 58 on its first pass. All still under the 68 industry benchmark, which is exactly what flagged where to focus.'
          },
          {
            // Positive close: benchmarking (esp. round 3) handed the dev team actionable
            // fixes before launch; they delivered; more testing would validate later.
            type: 'callout',
            icon: 'star',
            label: 'The value add',
            lines: [
              'The scores and themes did more than flag problems: they pointed straight at specific, actionable fixes, from onboarding and in-context guidance to making Vista the final step of the journey, AA-contrast text, and scannable output.',
              'Round 3 especially, the first read on AI upskilling, handed the dev team concrete improvements to action before launch, and they delivered on them impressively in the time they had, which is ultimately what made the rollout a success.',
              'A further round of testing would help validate these improvements, should timing allow in a future cycle.'
            ]
          }
        ]
      },
      {
        heading: 'Human in the loop',
        blocks: [
          {
            type: 'diagram',
            ai: ['Themed & clustered the feedback', 'Computed SUS scores', 'Drafted Observations, Insights & Recommendations'],
            human: ['Wrote the tests', 'Moderated them in person', 'Validated every theme', 'Edited the drafts', 'Made the final recommendation calls'],
            caption: 'AI took the repetitive load; humans owned the rigour and the judgement.'
          }
        ]
      },
      {
        heading: 'Results',
        blocks: [
          { type: 'lead', lines: [
            'Raw test data to a shareable insights report:',
            'Turnaround dropped from ~3 weeks to ~1 week.'
          ]},
          {
            // ~3 weeks → ~1 week ≈ 3× faster (directional). Full ring (not a %).
            type: 'stat',
            value: 3,
            suffix: '×',
            unit: 'faster'
          },
          { type: 'points', label: 'Learnings', items: [
            { icon: 'check', text: 'Quality and speed: the analysis got dramatically faster, yet every theme and recommendation was still validated and signed off by a person, so the depth of insight held.', evidence: 'Qualitative' },
            { icon: 'trending-up', text: 'The project underlined the value of usability testing itself: it surfaced what users actually struggled with, early enough to fix before rollout.', evidence: 'Qualitative' }
          ]}
          // SUS uplift figure to be added here later — Sam to provide the score increase.
          // (The 'sus' block type remains available in the engine for that.)
        ]
      }
    ]
  },
  {
    id: 'cs3',
    icon: 'sitemap',
    title: 'Site Intelligence: Design System Rollout, WCAG Compliance',
    oneLiner: 'Leveraging AI for ongoing site maintenance and improvement.',
    beats: [
      {
        heading: 'The problem',
        blocks: [
          { type: 'points', items: [
            { icon: 'layers', text: 'We are moving into phase 3 of our Design System rollout across the global site, sequenced around business priorities.' },
            { icon: 'target', text: 'We also have to keep every page compliant with WCAG 2.2, the Web Content Accessibility Guidelines (the AA-level standard for making the web usable by people with disabilities). That’s now a legal requirement, not just best practice: the EU’s new European Accessibility Act, in force since June 2025, means a non-compliant site can expose us to complaints and fines.' },
            { icon: 'search', text: 'Legacy and hardcoded country-level pages predate the system, and just FINDING them by hand is the blocker to finishing the rollout and ensuring overall compliance.' }
          ]},
          { type: 'subhead', text: 'Design System rollout roadmap' },
          {
            // Recreated from the team's "Design System Roadmap Overview": four
            // product-line lanes, phase one (2024) / phase two (2025), consolidating
            // into the web design system. start = 1-indexed quarter.
            type: 'roadmap',
            aria: 'Design System roadmap: Corporate, Business, Education and Consumer phases across 2024–2025; 2026 focuses on consolidation into the web design system and long-tail page rollout.',
            years: [{ label: '2024', span: 4 }, { label: '2025', span: 4 }, { label: '2026', span: 4 }],
            quarters: ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4'],
            lanes: [
              { label: 'Corporate', color: '#d8261f', bars: [
                { text: 'Corporate phase one', start: 1, span: 2, color: '#ee2b24' },
                { text: 'Corporate phase two', start: 5, span: 4, color: '#f5887f', dark: true }
              ]},
              { label: 'Business / workspace', color: '#2e4a8b', bars: [
                { text: 'Business phase one', start: 3, span: 2, color: '#2e4a8b' },
                { text: 'Business phase two', start: 6, span: 3, color: '#8a9dc9', dark: true }
              ]},
              { label: 'Education', color: '#8e3fa5', bars: [
                { text: 'EDU phase one', start: 3, span: 2, color: '#8e3fa5' },
                { text: 'EDU phase two', start: 6, span: 3, color: '#b58fd0', dark: true }
              ]},
              { label: 'Consumer', color: '#4a7a2a', bars: [
                { text: 'Gaming phase one', start: 2, span: 2, color: '#4a7a2a' },
                { text: 'Entertainment B2C (ColorPro, Projector) phase one/two', start: 5, span: 4, color: '#4a7a2a' }
              ]}
            ],
            consolidation: {
              braceStart: 9,            // brace sits at Q1 2026
              boxStart: 10, boxSpan: 3, // boxes span Q2–Q4 2026
              boxes: [
                { text: 'Web design system consolidation', laneStart: 1, laneSpan: 2 },
                { text: 'Long tail page implementation', laneStart: 3, laneSpan: 2 }
              ]
            },
            caption: 'In 2026 the focus shifts to consolidation into the web design system and long-tail page rollout.'
          }
        ]
      },
      {
        heading: 'What we built',
        blocks: [
          { type: 'text', text: 'We created a number of automated scraping tools to help identify areas for improvement and pages that require optimisation or updating.' },
          { type: 'text', text: 'Crafted the prompts with Claude, then used Claude Code + Claude Cowork to build and run a scraper and these dashboards.' },
          {
            // Distilled, projector-legible headline numbers pulled from the
            // business dashboard's OWN embedded data (consistent with the live tool).
            type: 'kpis',
            items: [
              { n: '18',     l: 'Pages scanned' },
              { n: '44%',    l: 'Avg rollout completeness' },
              { n: '5 / 18', l: 'Fully + near complete' },
              { n: '8',      l: 'Prioritised for rollout' }
            ],
            source: 'Pulled from the live dashboard’s own embedded data.'
          },
          {
            // The real, interactive tools — open in an in-deck overlay (iframe) via
            // openOverlay(); Back button / Esc closes. Relative paths, offline-safe.
            type: 'actions',
            items: [
              { label: 'View the live tool ▸', href: 'assets/cs3/business-ds-rollout-dashboard.html', sub: 'DS rollout dashboard' },
              { label: 'View the web review ▸', href: 'assets/cs3/web-review-dashboard.html', sub: 'Aggregate web review' }
            ]
          }
        ]
      },
      {
        heading: 'Human in the loop',
        blocks: [
          {
            type: 'diagram',
            ai: ['Built and ran the scraper', 'Produced the dashboards'],
            human: ['Interprets the data', 'Verifies results', 'Decides which design changes to make', 'Coordinates with stakeholders for execution']
          },
          {
            // Lifts the dashboard's own legend; framed as the human-in-the-loop discipline.
            type: 'callout',
            label: 'The metric discipline is the human in the loop, encoded in the tool',
            tags: ['Measured', 'Assessed', 'Not measured'],
            lines: ['No numbers estimated to fill a gap.']
          }
        ]
      },
      {
        heading: 'Results',
        blocks: [
          { type: 'points', items: [
            { icon: 'trending-up', text: 'Problems surface faster and far less of the work is manual hunting. Issues are caught sooner, and the rollout is more comprehensive as a result.', evidence: 'Qualitative' },
            { icon: 'compass', text: 'Coverage today spans the key pages across the Business and Education verticals and Support, with the rollout still continuing.', evidence: 'Directional' }
          ]}
        ]
      }
    ],
  }
];
