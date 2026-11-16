// The world: everything that moves, collides and scores, advanced in fixed
// 1/60 s steps. Pure logic — no drawing, no sound — so the screenshot scenes
// can play it forward with an autopilot and get the exact same frame.
import { ASTEROID, DRIFTER, FIELD, PLAYER, SHARD, SPITTER, TOTAL_WAVES, UPGRADES, waveAsteroids, waveDrifters, waveQuota, waveSpitters } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_VICTORY = 8;
export const EVENT_PICKUP = 16;
export const EVENT_KILL = 32;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function createWorld(random) {
  const state = {
    score: 0, best: 0, wave: 1, hull: PLAYER.maxHull, maxHull: PLAYER.maxHull,
    combo: 0, comboTimer: 0, salvage: 0, quota: waveQuota(1),
    shield: false, novas: 0, boltCount: 1, fireInterval: PLAYER.fireInterval,
    speed: PLAYER.speed, magnetRadius: PLAYER.magnetRadius,
    player: { x: FIELD.width / 2, y: FIELD.height - 90, vx: 0, vy: 0, angle: -Math.PI / 2, invulnerable: 0, fireTimer: 0, radius: PLAYER.radius },
    shards: [], asteroids: [], drifters: [], spitters: [], bolts: [], orbs: [],
    particles: [], texts: [], stars: [],
    shardTimer: 0, spawnQueue: [], time: 0, kills: 0, shardsCollected: 0,
    waveBanner: 0,
  };

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 90; i += 1) {
      state.stars.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height), r: random.range(0.6, 2.2), tw: random.range(0, Math.PI * 2) });
    }
  }
  function spawnAsteroid() {
    const edge = random.int(0, 3);
    const a = { x: 0, y: 0, vx: 0, vy: 0, r: random.range(ASTEROID.radiusMin, ASTEROID.radiusMax), rot: random.range(0, 6.28), vr: random.range(-1.5, 1.5), kind: 'rock' };
    if (edge === 0) { a.x = random.range(0, FIELD.width); a.y = -a.r; a.vy = random.range(ASTEROID.speedMin, ASTEROID.speedMax); a.vx = random.range(-30, 30); }
    else if (edge === 1) { a.x = random.range(0, FIELD.width); a.y = FIELD.height + a.r; a.vy = -random.range(ASTEROID.speedMin, ASTEROID.speedMax); a.vx = random.range(-30, 30); }
    else if (edge === 2) { a.x = -a.r; a.y = random.range(0, FIELD.height); a.vx = random.range(ASTEROID.speedMin, ASTEROID.speedMax); a.vy = random.range(-20, 20); }
    else { a.x = FIELD.width + a.r; a.y = random.range(0, FIELD.height); a.vx = -random.range(ASTEROID.speedMin, ASTEROID.speedMax); a.vy = random.range(-20, 20); }
    state.asteroids.push(a);
  }
  function spawnDrifter() {
    state.drifters.push({ x: random.pick([0, FIELD.width]), y: random.range(40, FIELD.height - 40), hp: DRIFTER.hp, r: DRIFTER.radius, vx: 0, vy: 0 });
  }
  function spawnSpitter() {
    state.spitters.push({ x: random.range(80, FIELD.width - 80), y: random.range(40, 140), hp: SPITTER.hp, r: SPITTER.radius, fireTimer: random.range(1, 2), vx: random.pick([-40, 40]) });
  }
  function spawnShard(x, y) {
    state.shards.push({ x: x ?? random.range(40, FIELD.width - 40), y: y ?? random.range(40, FIELD.height - 40), r: SHARD.radius, pulse: random.range(0, 6.28) });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(40, 220);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.7), max: 0.7, color, r: random.range(2, 5) });
    }
  }
  function floatText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 1 });
  }

  function startWave(wave) {
    state.wave = wave;
    state.quota = waveQuota(wave);
    state.salvage = 0;
    state.waveBanner = 2.2;
    state.spawnQueue = [];
    for (let i = 0; i < waveAsteroids(wave); i += 1) state.spawnQueue.push('asteroid');
    for (let i = 0; i < waveDrifters(wave); i += 1) state.spawnQueue.push('drifter');
    for (let i = 0; i < waveSpitters(wave); i += 1) state.spawnQueue.push('spitter');
    for (let i = 0; i < 4; i += 1) spawnShard();
    // Every third wave the lantern's ward rekindles: start it shielded.
    if (wave % 3 === 0) {
      state.shield = true;
      floatText(state.player.x, state.player.y - 40, 'SHIELD UP', '#7dd3fc');
    }
  }

  function reset() {
    state.score = 0; state.wave = 1; state.hull = PLAYER.maxHull; state.maxHull = PLAYER.maxHull;
    state.combo = 0; state.comboTimer = 0; state.salvage = 0; state.shield = false; state.novas = 0;
    state.boltCount = 1; state.fireInterval = PLAYER.fireInterval; state.speed = PLAYER.speed;
    state.magnetRadius = PLAYER.magnetRadius; state.time = 0; state.kills = 0; state.shardsCollected = 0;
    state.player.x = FIELD.width / 2; state.player.y = FIELD.height - 90; state.player.invulnerable = 0; state.player.fireTimer = 0;
    state.shards = []; state.asteroids = []; state.drifters = []; state.spitters = [];
    state.bolts = []; state.orbs = []; state.particles = []; state.texts = [];
    makeStars();
    startWave(1);
  }

  function hurtPlayer() {
    if (state.player.invulnerable > 0) return 0;
    if (state.shield) { state.shield = false; state.player.invulnerable = PLAYER.invulnerableSeconds; burst(state.player.x, state.player.y, '#7dd3fc', 14); return EVENT_HIT; }
    state.hull -= 1;
    state.combo = 0;
    state.player.invulnerable = PLAYER.invulnerableSeconds;
    burst(state.player.x, state.player.y, '#f87171', 20);
    if (state.hull <= 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function collectShard(shard) {
    state.combo = Math.min(SHARD.maxCombo, state.combo + 1);
    state.comboTimer = SHARD.comboWindow;
    const gained = SHARD.baseScore * state.combo;
    state.score += gained;
    state.salvage += 1;
    state.shardsCollected += 1;
    floatText(shard.x, shard.y - 14, `+${gained}`, '#fde68a');
    burst(shard.x, shard.y, '#fde68a', 8);
    return EVENT_PICKUP;
  }

  function fireNova() {
    if (state.novas <= 0) return 0;
    state.novas -= 1;
    for (const d of state.drifters) { state.score += DRIFTER.score; state.kills += 1; state.salvage += 1; burst(d.x, d.y, '#f0abfc', 16); }
    for (const s of state.spitters) { state.score += SPITTER.score; state.kills += 1; state.salvage += 1; burst(s.x, s.y, '#f0abfc', 16); }
    for (const a of state.asteroids) burst(a.x, a.y, '#e2e8f0', 10);
    state.drifters = []; state.spitters = []; state.asteroids = []; state.orbs = [];
    burst(state.player.x, state.player.y, '#f0abfc', 40);
    floatText(state.player.x, state.player.y - 30, 'NOVA!', '#f0abfc');
    return EVENT_KILL;
  }

  function step(dt, move, firing, aim, useNova) {
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.comboTimer > 0) { state.comboTimer -= dt; if (state.comboTimer <= 0) state.combo = 0; }
    if (p.invulnerable > 0) p.invulnerable -= dt;

    // Spawn the wave's queue, one foe every 0.7 s.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer = (state.spawnTimer ?? 0) - dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = 0.7;
        const next = state.spawnQueue.shift();
        if (next === 'asteroid') spawnAsteroid();
        else if (next === 'drifter') spawnDrifter();
        else spawnSpitter();
      }
    }
    // Shards keep appearing.
    state.shardTimer -= dt;
    if (state.shardTimer <= 0 && state.shards.length < SHARD.maxOnField) {
      state.shardTimer = SHARD.spawnInterval;
      spawnShard();
    }

    // Player movement + aim.
    p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + move.x * state.speed * dt));
    p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + move.y * state.speed * dt));
    if (aim) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

    // Fire bolts.
    p.fireTimer -= dt;
    if (firing && p.fireTimer <= 0) {
      p.fireTimer = state.fireInterval;
      const n = state.boltCount;
      for (let i = 0; i < n; i += 1) {
        const spread = (i - (n - 1) / 2) * 0.16;
        const a = p.angle + spread;
        state.bolts.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * PLAYER.boltSpeed, vy: Math.sin(a) * PLAYER.boltSpeed, r: 4 });
      }
    }
    if (useNova) events |= fireNova();

    // Shards drift toward the player inside the magnet radius.
    for (const s of state.shards) {
      s.pulse += dt * 4;
      const d = dist(s, p);
      if (d < state.magnetRadius) {
        const pull = 260 * (1 - d / state.magnetRadius) + 60;
        s.x += ((p.x - s.x) / (d || 1)) * pull * dt;
        s.y += ((p.y - s.y) / (d || 1)) * pull * dt;
      }
      if (d < p.radius + s.r) {
        events |= collectShard(s);
        s.dead = true;
      }
    }
    state.shards = state.shards.filter((s) => !s.dead);

    // Asteroids drift and wrap around the edges.
    for (const a of state.asteroids) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.vr * dt;
      if (a.x < -60) a.x = FIELD.width + 50; if (a.x > FIELD.width + 60) a.x = -50;
      if (a.y < -60) a.y = FIELD.height + 50; if (a.y > FIELD.height + 60) a.y = -50;
      if (dist(a, p) < a.r + p.radius - 4) events |= hurtPlayer();
    }

    // Drifters chase the player; spitters strafe and shoot orbs.
    for (const d of state.drifters) {
      const dx = p.x - d.x; const dy = p.y - d.y; const dd = Math.hypot(dx, dy) || 1;
      d.vx = (dx / dd) * DRIFTER.speed; d.vy = (dy / dd) * DRIFTER.speed;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (dist(d, p) < d.r + p.radius - 2) { events |= hurtPlayer(); d.hp = 0; d.dead = true; burst(d.x, d.y, '#fb923c', 12); }
    }
    for (const s of state.spitters) {
      s.x += s.vx * dt;
      if (s.x < 60 || s.x > FIELD.width - 60) s.vx *= -1;
      s.fireTimer -= dt;
      if (s.fireTimer <= 0) {
        s.fireTimer = SPITTER.fireInterval;
        const a = Math.atan2(p.y - s.y, p.x - s.x);
        state.orbs.push({ x: s.x, y: s.y + 10, vx: Math.cos(a) * SPITTER.orbSpeed, vy: Math.sin(a) * SPITTER.orbSpeed, r: 6 });
      }
      if (dist(s, p) < s.r + p.radius - 2) events |= hurtPlayer();
    }

    // Bolts fly and hit foes and asteroids.
    for (const b of state.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) { b.dead = true; continue; }
      for (const d of state.drifters) {
        if (!d.dead && dist(b, d) < d.r + b.r) { d.hp -= 1; b.dead = true; burst(b.x, b.y, '#fdba74', 5); if (d.hp <= 0) { d.dead = true; state.score += DRIFTER.score; state.kills += 1; state.salvage += 1; floatText(d.x, d.y, `+${DRIFTER.score}`, '#fdba74'); burst(d.x, d.y, '#fb923c', 14); events |= EVENT_KILL; } break; }
      }
      if (b.dead) continue;
      for (const s of state.spitters) {
        if (!s.dead && dist(b, s) < s.r + b.r) { s.hp -= 1; b.dead = true; burst(b.x, b.y, '#c084fc', 5); if (s.hp <= 0) { s.dead = true; state.score += SPITTER.score; state.kills += 1; state.salvage += 1; floatText(s.x, s.y, `+${SPITTER.score}`, '#c084fc'); burst(s.x, s.y, '#a855f7', 16); events |= EVENT_KILL; } break; }
      }
      if (b.dead) continue;
      for (const a of state.asteroids) {
        if (dist(b, a) < a.r + b.r) { b.dead = true; a.r -= 6; burst(b.x, b.y, '#e2e8f0', 4); if (a.r < 8) { a.dead = true; state.score += 25; burst(a.x, a.y, '#e2e8f0', 12); } break; }
      }
    }
    state.bolts = state.bolts.filter((b) => !b.dead);
    state.drifters = state.drifters.filter((d) => !d.dead);
    state.spitters = state.spitters.filter((s) => !s.dead);
    state.asteroids = state.asteroids.filter((a) => !a.dead);

    // Enemy orbs fly and can hurt the player.
    for (const o of state.orbs) {
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) { o.dead = true; continue; }
      if (dist(o, p) < o.r + p.radius - 2) { o.dead = true; events |= hurtPlayer(); }
    }
    state.orbs = state.orbs.filter((o) => !o.dead);

    // Particles and floating texts fade.
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const t of state.texts) { t.y -= 30 * dt; t.life -= dt * 0.8; }
    state.texts = state.texts.filter((t) => t.life > 0);
    for (const s of state.stars) s.tw += dt;

    if (events & EVENT_OVER) return events;
    // Wave cleared: quota met and no foes left (asteroids keep drifting, they are scenery now).
    if (state.salvage >= state.quota && state.drifters.length === 0 && state.spitters.length === 0 && state.spawnQueue.length === 0) {
      if (state.wave >= TOTAL_WAVES) return events | EVENT_VICTORY;
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  return {
    state, reset, startWave, step,
    /** Pick 3 distinct upgrades for the between-wave choice. */
    rollUpgrades() {
      const pool = [...UPGRADES];
      const picks = [];
      for (let i = 0; i < 3; i += 1) picks.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
      return picks;
    },
    applyUpgrade(upgrade) { upgrade.apply(state); },
    grantShield() { state.shield = true; },
  };
}
