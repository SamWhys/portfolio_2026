/* METAL SLIDE art: costumes. One entry per character look.
   Colors are full color; the cave and kingdom eras snap them to their palettes. */
(function (root) {
  'use strict';
  var MS = root.MS = root.MS || {};

  var SKIN = { pale: '#f0c8a8', light: '#e8b898', tan: '#d6a074', olive: '#c88a5c', brown: '#9a6a48', deep: '#7a4a34' };

  MS.costumes = {
    // ---- the hero. His kit levels up with each mission's era; the face, the brushed, parted hair, the
    // red headband and the build never change, so he reads as one person. `sam` is the cave
    // look, and the portfolio's invite sprite and the title silhouette use it. `weapon` is
    // what he fires in play (rig.js draws it, player.js fires it): it levels up too.
    sam: {
      body: 'hero', head: 'hero', skin: SKIN.tan, hair: { style: 'brushed', color: '#6b4226' }, hat: { style: 'headband', color: '#d0342c' },
      top: { style: 'vest', color: '#5f7a3a', under: '#2a2a30' }, sleeves: 'cut',
      pants: { color: '#b89a68' }, shoes: { color: '#5a3a24', tall: true }, belt: '#4a3626', pouches: true, gloves: '#34343c',
      pack: '#7a6a46', roll: '#5a6a3a', voice: 0.55, weapon: 'sling', gear: 'pouch'
    },
    // Mission 2, the kingdom: a jade tunic over his green shirt, a royal blue sash, leather
    // bracers, belt and gloves, cuffed boots, and a satchel with a rolled cloak. Colours are
    // DawnBringer 32 picks; the jade keeps him off the market's brown timber.
    sam2: {
      body: 'hero', head: 'hero', skin: SKIN.tan, hair: { style: 'brushed', color: '#6b4226' }, hat: { style: 'headband', color: '#d0342c' },
      top: { style: 'tunic', color: '#37946e', skirt: 'short', belt: '#663931', sash: '#5b6ee1', sleeve: '#4b692f' }, sleeves: 'short',
      bracers: '#663931', gloves: '#45283c',
      pants: { color: '#524b24', cuff: '#8f563b' }, shoes: { color: '#663931', tall: true },
      pack: '#8a6f30', quiver: '#663931', voice: 0.55, weapon: 'bow'
    },
    // Mission 3, the city: an olive bomber over a white tee, a design-system-blue lanyard and
    // ID badge, slate trousers, white sneakers and a day pack.
    sam3: {
      body: 'hero', head: 'hero', skin: SKIN.tan, hair: { style: 'brushed', color: '#6b4226' }, hat: { style: 'headband', color: '#d0342c' },
      top: { style: 'blazer', color: '#55643c', under: '#f4f4f0' }, sleeves: 'long', lanyard: '#3a7ae8',
      pants: { color: '#4a5060' }, shoes: { color: '#f2f2f2' }, belt: '#2a2a30',
      pack: '#30343e', voice: 0.55, weapon: 'pistol', gear: 'holster'
    },
    // Mission 4, the siege at midnight: a slate tactical vest with a hi-vis band across the
    // chest and round the arms, a radio headset, black gloves and boots.
    sam4: {
      body: 'hero', head: 'hero', skin: SKIN.tan, hair: { style: 'brushed', color: '#6b4226' }, hat: { style: 'headband', color: '#d0342c' },
      top: { style: 'vest', color: '#3a4454', under: '#1e222c', sleeve: '#2c3240', stripe: '#d8ff3a' }, sleeves: 'long',
      headset: '#2a2c34', gloves: '#18181e',
      pants: { color: '#2c3240', pads: '#6a7488' }, shoes: { color: '#1c1c22', tall: true }, belt: '#1e2028', pouches: true,
      pack: '#3a4454', voice: 0.55, weapon: 'mgun'
    },
    // Mission 5, the future: the final form. A sleek suit in his old olive, gone deep green,
    // with mint glow trim, white gloves and a white pack, fresh boots with lit soles, and cool
    // shades with a glint.
    sam5: {
      body: 'hero', head: 'hero', skin: SKIN.tan, hair: { style: 'brushed', color: '#6b4226' }, hat: { style: 'headband', color: '#d0342c' },
      eyes: 'shades', lens: '#1a1e2a', glint: '#ffffff',
      top: { style: 'jumpsuit', color: '#2e4a38', glow: '#8affc0' }, sleeves: 'long', gloves: '#f0f2fa',
      pants: { color: '#2e4a38' }, shoes: { color: '#e8eee8', glow: '#8affc0', tall: true },
      pack: '#dfe4ee', cell: '#8affc0', voice: 0.55, weapon: 'laser'
    },

    // ---- Mission 1: the cave
    general: {
      body: 'stout', pouches: true, skin: '#e2a888', hair: { style: 'bald', color: '#9a9590' }, beard: { style: 'handlebar', color: '#8a847e' },
      hat: { style: 'officer', color: '#4f5e36', color2: '#262420' },
      top: { style: 'uniform', color: '#56663a', medals: true, sash: '#c8302a' }, sleeves: 'long',
      pants: { color: '#46512f' }, shoes: { color: '#1e1e22' }, belt: '#2a2420', item: 'clicker', voice: 0.12
    },
    trooper: {
      body: 'commando', skin: SKIN.light, hair: { style: 'short', color: '#3a2a20' }, hat: { style: 'helmet', color: '#5a6a3a', color2: '#3a3a2a' },
      top: { style: 'uniform', color: '#5a6a3a' }, sleeves: 'long', pants: { color: '#4a5634' }, shoes: { color: '#2a2420' },
      belt: '#2a2420', pouches: true, pack: '#4a5634', item: 'slides', voice: 0.3
    },
    trooper2: {
      body: 'commando', skin: SKIN.brown, hair: { style: 'short', color: '#1a1410' }, hat: { style: 'helmet', color: '#5a6a3a', color2: '#3a3a2a' },
      top: { style: 'uniform', color: '#5a6a3a' }, sleeves: 'long', pants: { color: '#4a5634' }, shoes: { color: '#2a2420' },
      belt: '#2a2420', pouches: true, pack: '#4a5634', item: 'slides', voice: 0.35
    },
    pow1: {
      body: 'slim', skin: SKIN.pale, hair: { style: 'messy', color: '#b8b0a8' }, beard: { style: 'long', color: '#c8c0b8' }, eyes: 'glasses',
      top: { style: 'rags', color: '#c8c0a8' }, sleeves: 'short', pants: { color: '#6a5e4a' }, shoes: { style: 'bare' }, work: 'chisel', voice: 0.7
    },
    pow2: {
      skin: SKIN.deep, hair: { style: 'messy', color: '#2a2420' }, beard: { style: 'long', color: '#2a2420' },
      top: { style: 'rags', color: '#b0a890' }, sleeves: 'short', pants: { color: '#5a4e3c' }, shoes: { style: 'bare' }, work: 'chisel', voice: 0.42
    },
    pow3: {
      skin: SKIN.light, hair: { style: 'messy', color: '#c8642a' }, beard: { style: 'long', color: '#c8642a' },
      top: { style: 'rags', color: '#bcb49a' }, sleeves: 'short', pants: { color: '#665a46' }, shoes: { style: 'bare' }, work: 'chisel', voice: 0.6
    },
    pow4: {
      body: 'slim', skin: SKIN.olive, hair: { style: 'long', color: '#3a2a24' },
      top: { style: 'rags', color: '#c0b8a0' }, sleeves: 'short', pants: { color: '#5e5240' }, shoes: { style: 'bare' }, work: 'chisel', voice: 0.82
    },

    // ---- Mission 2: the kingdom
    scribe: {
      skin: SKIN.light, hair: { style: 'tonsure', color: '#5a4030' },
      top: { style: 'robe', color: '#6a4a32', skirt: 'long', belt: '#c8a864' }, sleeves: 'long',
      pants: { color: '#6a4a32' }, shoes: { color: '#7a5030' }, work: 'quill', item: 'quill', voice: 0.62
    },
    scribe2: {
      skin: SKIN.brown, hair: { style: 'tonsure', color: '#2a1e18' },
      top: { style: 'robe', color: '#5a4a3a', skirt: 'long', belt: '#c8a864' }, sleeves: 'long',
      pants: { color: '#5a4a3a' }, shoes: { color: '#7a5030' }, work: 'quill', item: 'quill', voice: 0.5
    },
    mason: {
      skin: SKIN.olive, hair: { style: 'short', color: '#3a2a20' }, beard: { style: 'full', color: '#3a2a20' },
      top: { style: 'apron', color: '#7a6a4a', color2: '#c0a882' }, sleeves: 'short',
      pants: { color: '#5a4a38' }, shoes: { color: '#4a3428' }, item: 'hammer', voice: 0.32
    },
    knight: {
      skin: SKIN.light, hat: { style: 'knight', color: '#c8302a' },
      top: { style: 'armor', color: '#b8bcc4', color2: '#3a5ac8', skirt: 'short', skirtColor: '#8a8e96', sleeve: '#9a9ea8' }, sleeves: 'long',
      pants: { color: '#8a8e96' }, shoes: { color: '#5a5e66' }, item: 'sword', voice: 0.28
    },
    king: {
      body: 'stout', skin: SKIN.pale, hair: { style: 'short', color: '#e0dcd4' }, beard: { style: 'full', color: '#e8e4dc' },
      hat: { style: 'crown', color: '#c8302a', color2: '#3a6ac8' },
      top: { style: 'robe', color: '#a82a3a', skirt: 'long', trim: '#f6f2ea', belt: '#f0c848' }, sleeves: 'long',
      pants: { color: '#a82a3a' }, shoes: { color: '#3a2a20' }, voice: 0.22
    },
    villager1: {
      skin: SKIN.tan, hair: { style: 'short', color: '#5a3a24' }, hat: { style: 'hood', cloth: '#8a6a4a' },
      top: { style: 'tunic', color: '#6a8a4a', skirt: 'short', belt: '#5a4030' }, sleeves: 'long',
      pants: { color: '#6a5a4a' }, shoes: { color: '#5a3a24' }, voice: 0.45
    },
    villager2: {
      skin: SKIN.pale, hat: { style: 'scarf', cloth: '#c8a050' },
      top: { style: 'tunic', color: '#8a3a4a', skirt: 'long', belt: '#5a4030' }, sleeves: 'long',
      pants: { color: '#8a3a4a' }, shoes: { color: '#5a3a24' }, voice: 0.78
    },
    villager3: {
      skin: SKIN.deep, hair: { style: 'curly', color: '#2a1a14' },
      top: { style: 'tunic', color: '#4a6a8a', skirt: 'short', belt: '#6a4a2a' }, sleeves: 'short',
      pants: { color: '#5a4a3a' }, shoes: { color: '#4a3020' }, voice: 0.52
    },

    // ---- Mission 3: the city
    designer: {
      body: 'slim', skin: SKIN.light, hair: { style: 'bun', color: '#2a2020' }, eyes: 'glasses',
      top: { style: 'turtleneck', color: '#26262c' }, sleeves: 'long', pants: { color: '#3a3a46' }, shoes: { color: '#ececec' }, voice: 0.74
    },
    developer: {
      skin: SKIN.pale, hair: { style: 'swoop', color: '#c8903a' }, hat: { style: 'headphones', color: '#d0342c' },
      top: { style: 'hoodie', color: '#4a6ab0' }, sleeves: 'long', pants: { color: '#34445e' }, shoes: { color: '#f0f0f0' }, work: 'type', voice: 0.48
    },
    pm: {
      skin: SKIN.brown, hair: { style: 'short', color: '#1e1814' },
      top: { style: 'blazer', color: '#3a4a6a', under: '#f0ece4' }, sleeves: 'long',
      pants: { color: '#2a2a34' }, shoes: { color: '#1a1a1e' }, item: 'tablet', voice: 0.38
    },
    worker1: {
      skin: SKIN.pale, hair: { style: 'ponytail', color: '#8a4a2a' },
      top: { style: 'shirt', color: '#e6e6ee', collar: '#ffffff' }, sleeves: 'short', pants: { color: '#5a5a6a' }, shoes: { color: '#3a3a44' }, work: 'type', voice: 0.8
    },
    worker2: {
      skin: SKIN.deep, hair: { style: 'buzz', color: '#1a1a1a' },
      top: { style: 'tee', color: '#e8a83a' }, sleeves: 'short', pants: { color: '#3a3a44' }, shoes: { color: '#f0f0f0' }, work: 'type', voice: 0.35
    },
    worker3: {
      skin: SKIN.olive, hair: { style: 'curly', color: '#2a1a14' }, eyes: 'glasses',
      top: { style: 'shirt', color: '#6a8ac8' }, sleeves: 'long', pants: { color: '#2e3240' }, shoes: { color: '#2a2a30' }, work: 'type', voice: 0.58
    },

    // ---- Mission 5: the future
    citizen1: {
      skin: SKIN.tan, hair: { style: 'swoop', color: '#e8e0f8' }, hat: { style: 'visor', glow: '#7ff4ff' },
      top: { style: 'jumpsuit', color: '#f2f0fa', glow: '#5fe8ff' }, sleeves: 'long', pants: { color: '#dcd8ec' }, shoes: { color: '#ffffff' }, voice: 0.6
    },
    citizen2: {
      skin: SKIN.deep, hair: { style: 'bob', color: '#ff8ab8' },
      top: { style: 'coat', color: '#2a3a5a', under: '#f8f4ff', glow: '#ffb0f0', skirt: 'knee' }, sleeves: 'long',
      pants: { color: '#2a2a3a' }, shoes: { color: '#ffffff' }, voice: 0.76
    },
    citizen3: {
      skin: SKIN.light, hair: { style: 'curly', color: '#3a2a6a' },
      top: { style: 'jumpsuit', color: '#3a2e5a', glow: '#ffd36a' }, sleeves: 'long', pants: { color: '#2e2648' }, shoes: { color: '#f0f0ff' }, voice: 0.44
    },
    designer2: {
      body: 'slim', skin: SKIN.light, hair: { style: 'bun', color: '#2a2020' }, eyes: 'glasses',
      top: { style: 'coat', color: '#f4f2fa', under: '#26262c', glow: '#7ff4ff', skirt: 'knee' }, sleeves: 'long',
      pants: { color: '#3a3a46' }, shoes: { color: '#ffffff' }, voice: 0.74
    },
    dev1f: {
      body: 'slim', skin: SKIN.pale, hair: { style: 'short', color: '#b8b0a8' }, beard: { style: 'goatee', color: '#c8c0b8' }, eyes: 'glasses',
      top: { style: 'jumpsuit', color: '#3a4a6a', glow: '#7ff4ff' }, sleeves: 'long', pants: { color: '#2e3a54' }, shoes: { color: '#ffffff' }, voice: 0.7
    },
    dev2f: {
      skin: SKIN.deep, hair: { style: 'buzz', color: '#2a2420' }, beard: { style: 'stubble', color: '#2a2420' },
      top: { style: 'coat', color: '#f0eef8', under: '#3a3a4a', glow: '#ffd36a', skirt: 'knee' }, sleeves: 'long',
      pants: { color: '#3a3a4a' }, shoes: { color: '#ffffff' }, voice: 0.42
    },
    generalf: {
      body: 'stout', skin: '#e2a888', hair: { style: 'bald', color: '#9a9590' }, beard: { style: 'handlebar', color: '#8a847e' }, eyes: 'shades',
      top: { style: 'hawaiian', color: '#e8584a', color2: '#ffe14a' }, sleeves: 'short',
      pants: { color: '#d8c49a', style: 'shorts' }, shoes: { color: '#8a5a30' }, voice: 0.12
    },
    // the usability researcher: a teal lab coat and a tablet of session notes
    researcher: {
      skin: SKIN.olive, hair: { style: 'ponytail', color: '#c8642a' }, eyes: 'glasses',
      top: { style: 'coat', color: '#3ab8a8', under: '#f8f6ff', glow: '#ffd36a', skirt: 'knee' }, sleeves: 'long',
      pants: { color: '#3a4660' }, shoes: { color: '#ffffff' }, item: 'tablet', voice: 0.66
    },
    hrlead: {
      skin: SKIN.brown, hair: { style: 'long', color: '#3a2418' },
      top: { style: 'blazer', color: '#e86a7a', under: '#fff6ee' }, sleeves: 'long',
      pants: { color: '#3a3446' }, shoes: { color: '#ffffff' }, item: 'clipboard', voice: 0.72
    },
    salesrep: {
      skin: SKIN.light, hair: { style: 'short', color: '#2a1e18' }, hat: { style: 'visor', glow: '#ff8ab8' },
      top: { style: 'blazer', color: '#3a4a9a', under: '#f6f2ea', tie: '#ffd36a' }, sleeves: 'long',
      pants: { color: '#2a3058' }, shoes: { color: '#ffffff' }, item: 'arcube', voice: 0.4
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
