// LUMEN DRIFT — Starlight Salvage: tuning constants. One place for every number
// the game balances on, so tuning never means hunting through logic.
export const STEP = 1 / 60;
export const FIELD = { width: 960, height: 600 };
export const BEST_KEY = 'lumen-drift-best';

export const PLAYER = {
  radius: 16,
  speed: 300,
  fireInterval: 0.22,
  boltSpeed: 560,
  maxHull: 3,
  invulnerableSeconds: 1.2,
  magnetRadius: 90,
};

export const SHARD = {
  radius: 10,
  baseScore: 50,
  comboWindow: 3,
  maxCombo: 8,
  spawnInterval: 0.9,
  maxOnField: 9,
};

export const ASTEROID = { radiusMin: 14, radiusMax: 34, speedMin: 40, speedMax: 110 };
export const DRIFTER = { radius: 15, speed: 95, score: 150, hp: 2 };
export const SPITTER = { radius: 17, speed: 60, score: 250, hp: 3, fireInterval: 2.2, orbSpeed: 170 };

export const TOTAL_WAVES = 10;
/** Salvage quota (shards collected + enemies destroyed) to clear each wave. */
export function waveQuota(wave) {
  return 8 + wave * 3;
}
export function waveAsteroids(wave) {
  return 3 + wave * 2;
}
export function waveDrifters(wave) {
  return 1 + wave;
}
export function waveSpitters(wave) {
  return wave >= 3 ? wave - 2 : 0;
}

export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Lantern', desc: 'Fire 20% faster. Your bolts fly in a quicker stream.', apply: (p) => { p.fireInterval *= 0.8; } },
  { id: 'twin', name: 'Twin Beams', desc: '+1 bolt per shot, fanned out. More light, more hits.', apply: (p) => { p.boltCount += 1; } },
  { id: 'magnet', name: 'Star Magnet', desc: 'Shards drift toward you from 70% farther away.', apply: (p) => { p.magnetRadius *= 1.7; } },
  { id: 'plating', name: 'Hull Plating', desc: '+1 max hull and repair 1 hull right now.', apply: (p) => { p.maxHull += 1; p.hull = Math.min(p.maxHull, p.hull + 1); } },
  { id: 'sails', name: 'Swift Sails', desc: 'Move 15% faster. Outrun anything that chases you.', apply: (p) => { p.speed *= 1.15; } },
  { id: 'nova', name: 'Nova Bomb', desc: 'Gain a Nova Bomb (press Q). Clears every foe on screen.', apply: (p) => { p.novas += 1; } },
];
