// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (fly toward
// the nearest shard, keep clear of asteroids and foes, fire at the nearest
// enemy), so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 4;
const PLAY_LIMIT_SECONDS = 75;
const END_LIMIT_SECONDS = 600;
const SAMPLE_STEPS = 15; // sample the frame every 0.25 s

/** How readable/exciting a frame is: foes, shards, bolts and particles on
 * screen, plus real progress (salvage > 0, combo going). */
function frameScore(s) {
  const foes = s.drifters.length + s.spitters.length;
  const frac = s.salvage / s.quota;
  return foes * 3
    + s.shards.length * 2
    + Math.min(s.bolts.length, 10)
    + Math.min(s.particles.length, 20) * 0.3
    + (s.salvage > 0 ? 20 : 0)
    + (frac >= 0.3 && frac <= 0.9 ? 8 : 0) // mid-wave: progress visible, not just cleared
    + (s.combo >= 2 ? 10 : 0)
    + (s.wave >= 2 ? 5 : 0)
    + Math.min(s.texts.length, 4) * 2
    + (s.player.y < 140 ? -12 : 0); // keep the ship clear of the HUD bar
}
/** A frame only counts if a viewer can read the game in it: the player has
 * made progress, both enemy kinds are around, shards and bolts are visible. */
function frameReadable(s) {
  return s.salvage > 0
    && s.drifters.length + s.spitters.length >= 2
    && s.shards.length >= 3
    && s.bolts.length >= 2;
}

function nearest(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Steer toward the nearest shard, away from the nearest threat. Returns {x, y} move and an aim point. */
function autopilot(state, careful) {
  const p = state.player;
  const shard = nearest(state.shards, p.x, p.y);
  const threat = nearest([...state.asteroids, ...state.drifters, ...state.spitters], p.x, p.y);
  let mx = 0;
  let my = 0;
  if (shard) {
    mx += (shard.x - p.x) / (Math.hypot(shard.x - p.x, shard.y - p.y) || 1);
    my += (shard.y - p.y) / (Math.hypot(shard.x - p.x, shard.y - p.y) || 1);
  }
  if (threat && careful) {
    const d = Math.hypot(threat.x - p.x, threat.y - p.y);
    if (d < 160) {
      mx -= ((threat.x - p.x) / (d || 1)) * 1.6;
      my -= ((threat.y - p.y) / (d || 1)) * 1.6;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  const foe = nearest([...state.drifters, ...state.spitters], p.x, p.y);
  return { move: { x: mx / len, y: my / len }, aim: foe ?? shard ?? { x: FIELD.width / 2, y: 100 } };
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, null, false);
    state.texts = []; // no stray "+50" peeking out from behind the title panel
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const careful = name === 'play';
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_LIMIT_SECONDS;
  let over = false;
  let victory = false;
  // Play shot: scan the run and keep the most readable, action-packed frame
  // (a fixed timestamp kept landing on a fresh wave with salvage 0/20 and an
  // empty field). The seed makes the scan deterministic, so the frame is
  // reproducible. End shot: play until the run ends, as before.
  let best = null;
  for (let i = 0; i < limit / STEP; i += 1) {
    const pilot = autopilot(state, careful);
    const events = world.step(STEP, pilot.move, true, pilot.aim, false);
    if (events & EVENT_OVER) { over = true; break; }
    if (events & EVENT_VICTORY) { victory = true; break; }
    if (events & EVENT_WAVE_CLEAR) {
      // Take the first upgrade and keep playing, as a player would.
      const choices = world.rollUpgrades();
      world.applyUpgrade(choices[0]);
      world.startWave(state.wave + 1);
    }
    if (name === 'play' && i % SAMPLE_STEPS === 0 && frameReadable(state)) {
      const score = frameScore(state);
      if (!best || score > best.score) best = { score, snap: structuredClone(state) };
    }
  }
  if (victory) return { screen: SCREEN_VICTORY, best: state.score };
  if (over) return { screen: SCREEN_OVER, best: state.score };
  if (best) {
    // Restore the chosen frame in place (same object the renderer reads).
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, best.snap);
  }
  // A mid-wave frame, not the wave banner: the banner is transient, the play
  // screenshot should show the game itself.
  state.waveBanner = 0;
  return { screen: SCREEN_PLAY, best: state.score };
}
