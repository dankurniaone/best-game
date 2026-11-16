// Sprite art: Kenney "Space Shooter Redux" (CC0, kenney.nl — see
// game/assets/LICENSE-kenney.txt). Real raster art, bundled locally under
// game/assets/ — the game makes no network request at runtime.
// Kenney sprites face UP (-y), so the renderer rotates them by angle + PI/2.
// Importing this module in Node is safe: nothing touches `document` until
// loadAssets() runs (the headless world tests import render.js in Node).
const FILES = {
  player: 'assets/playerShip1_orange.png',
  drifter: 'assets/enemyRed1.png',
  spitter: 'assets/enemyBlue3.png',
  shard: 'assets/star_gold.png',
  boltBlue: 'assets/laserBlue01.png',
  orb: 'assets/laserRed08.png',
  shield: 'assets/shield1.png',
  fire: ['assets/fire06.png', 'assets/fire12.png'],
  bg: 'assets/bg-blue.png',
  meteorBig: ['assets/meteorGrey_big1.png', 'assets/meteorGrey_big3.png'],
  meteorMed: ['assets/meteorGrey_med1.png', 'assets/meteorGrey_med2.png'],
  meteorSmall: ['assets/meteorGrey_small1.png', 'assets/meteorGrey_small2.png'],
  meteorTiny: ['assets/meteorGrey_tiny1.png', 'assets/meteorGrey_tiny2.png'],
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/** Recolour a sprite once, at load time, on an offscreen canvas. */
function tint(img, filter) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.filter = filter;
  g.drawImage(img, 0, 0);
  return c;
}

export async function loadAssets() {
  const all = Object.values(FILES).flat();
  const loaded = await Promise.all(all.map((src) => loadImage(src).then((img) => [src, img])));
  const bySrc = Object.fromEntries(loaded);
  const get = (src) => bySrc[src];
  const list = (arr) => arr.map(get);
  return {
    player: get(FILES.player),
    // Red ship with boosted saturation so the chaser reads as clearly red,
    // not brown, against the dark field.
    drifter: tint(get(FILES.drifter), 'saturate(1.7)'),
    // Blue ship, slightly desaturated — a different silhouette from the
    // red drifter, and its orbs stay warm red.
    spitter: tint(get(FILES.spitter), 'hue-rotate(80deg) saturate(1.2)'),
    shard: get(FILES.shard),
    // Cold blue bolt, untinted: player fire is COLD, enemy fire is WARM
    // (red orbs) — the two are never confused, even in a busy frame.
    bolt: get(FILES.boltBlue),
    orb: get(FILES.orb),
    // Shield tinted gold: the one disciplined accent, not a second blue.
    shield: tint(get(FILES.shield), 'hue-rotate(195deg) saturate(1.4)'),
    fire: list(FILES.fire),
    bg: get(FILES.bg),
    meteorBig: list(FILES.meteorBig),
    meteorMed: list(FILES.meteorMed),
    meteorSmall: list(FILES.meteorSmall),
    meteorTiny: list(FILES.meteorTiny),
  };
}
