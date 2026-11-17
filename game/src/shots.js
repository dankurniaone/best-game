// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (fly toward
// the nearest shard, keep clear of asteroids and foes, fire at the nearest
// enemy), so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 4;
const PLAY_LIMIT_SECONDS = 150; // long enough to reach the busy late waves
const END_LIMIT_SECONDS = 600;
const SAMPLE_STEPS = 15; // sample the frame every 0.25 s

/** Entities per quadrant (split at the field centre): a frame whose action
 * lives in only one or two quadrants reads as half-empty, however busy it
 * is. Bottom-left was the emptiest quadrant in the last play shot. */
function quadrants(s) {
  const q = [0, 0, 0, 0];
  for (const e of [...s.drifters, ...s.spitters, ...s.asteroids, ...s.shards]) {
    q[(e.x < 480 ? 0 : 1) + (e.y < 326 ? 0 : 2)] += 1;
  }
  return q;
}

/** How readable/exciting a frame is: foes, shards, bolts and particles on
 * screen, plus real progress (salvage > 0, combo going) — and, since the
 * last pass, COMPOSITION: the ship must sit in a power zone (lower-left
 * third, room ahead of it to shoot into), never glued to an edge, and the
 * action must spread across the whole frame instead of piling up in the
 * top half while the bottom half sits empty. */
function frameScore(s) {
  const foes = s.drifters.length + s.spitters.length;
  const frac = s.salvage / s.quota;
  let aimBonus = 0;
  if (s.bolts.length) {
    // Prefer a frame where the ship is actually firing the way it faces:
    // a snapshot taken mid-turn (ship facing away from its own bolts) reads
    // as if the ship shoots backwards.
    let mx = 0;
    let my = 0;
    for (const b of s.bolts) { mx += b.vx; my += b.vy; }
    const ml = Math.hypot(mx, my) || 1;
    const dot = (Math.cos(s.player.angle) * mx + Math.sin(s.player.angle) * my) / ml;
    // Strong weight: a frame where the ship faces away from its own fire
    // must never win, however busy it is.
    if (dot > 0.7) aimBonus = 25;
    else if (dot < 0) aimBonus = -25;
  }
  // --- composition ---
  const px = s.player.x;
  const py = s.player.y;
  let comp = 0;
  // Power zone: lower-left third, clear of the HUD and the edges, with
  // open space ahead (to the right) to shoot into.
  if (px >= 200 && px <= 480 && py >= 280 && py <= 480) comp += 14;
  else if (px >= 160 && px <= 560 && py >= 220 && py <= 520) comp += 5;
  if (px < 150 || px > 820 || py < 170 || py > 530) comp -= 18; // glued to an edge
  // Spread: count everything visible across the three vertical bands.
  const all = [...s.drifters, ...s.spitters, ...s.shards, ...s.asteroids];
  const band = [0, 0, 0];
  for (const e of all) band[e.y < 220 ? 0 : e.y <= 420 ? 1 : 2] += 1;
  comp += 6 * band.filter((n) => n >= 2).length; // every populated band pays
  if (band[2] === 0) comp -= 12; // bottom third empty: half the frame dead
  if (band[0] > 0.75 * all.length) comp -= 10; // everything piled at the top
  // Quadrant spread: action in every quadrant, not one corner doing all
  // the work. Bottom-left was the emptiest quadrant in the last play shot.
  const quad = quadrants(s);
  if (quad.every((n) => n >= 1)) comp += 8;
  comp += 3 * quad.filter((n) => n >= 2).length;
  // Foes half-clipped by an edge read as a mistake in a poster frame.
  for (const f of [...s.drifters, ...s.spitters]) {
    if (f.x < 40 || f.x > 920 || f.y < 100 || f.y > 560) comp -= 3;
  }
  return foes * 3
    + s.shards.length * 2
    + Math.min(s.bolts.length, 10)
    + Math.min(s.particles.length, 60) * 0.35
    + (s.particles.length >= 60 ? 12 : 0) // a burst in progress: the frame has fire in it
    + (s.texts.length >= 3 ? 8 : 0) // several popups at once: the frame has payoff in it
    + (s.bolts.length >= 12 ? 8 : 0) // bullet-hell beat: the ship is pouring fire out
    + (s.novaFlash > 0 ? 15 : 0) // caught mid-Nova: the whole screen is answering
    + (s.salvage > 0 ? 20 : 0)
    + (frac >= 0.3 && frac <= 0.9 ? 8 : 0) // mid-wave: progress visible, not just cleared
    + (s.combo >= 2 ? 10 : 0)
    + (s.wave >= 6 ? 12 : s.wave >= 5 ? 6 : 0) // late waves are the battle, not the stroll
    + (s.wave >= 2 ? 5 : 0)
    + Math.min(s.texts.length, 4) * 2
    + aimBonus
    + (s.player.y < 140 ? -12 : 0) // keep the ship clear of the HUD bar
    + comp;
}
/** A frame only counts if a viewer can read the game in it: the player has
 * made progress, both enemy kinds are around, shards and bolts are visible,
 * the ship is inside the frame — not parked on an edge or under the HUD —
 * and the frame is DENSE: enough entities on screen at once, plus visible
 * juice — a real particle burst (a kill, not just the engine trail) or
 * floating score/damage popups. A sparse frame is rejected outright, however
 * well composed it is. The bar is high on purpose: a battle, not a stroll. */
function frameReadable(s) {
  const entities = s.drifters.length + s.spitters.length + s.asteroids.length
    + s.shards.length + s.bolts.length + s.orbs.length;
  return s.salvage > 0
    && s.drifters.length + s.spitters.length >= 2
    && s.shards.length >= 3
    && s.bolts.length >= 2
    && entities >= 16
    && (s.particles.length >= 35 || s.texts.length >= 2)
    && s.player.x > 160 && s.player.x < 820
    && s.player.y > 170 && s.player.y < 520;
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
  // Composition pull (play staging only — the end shot must keep the
  // original autopilot or its staged run dies too early): a gentle nudge
  // away from the very edges so the picked frame is balanced, not a ship
  // glued to a corner with an empty half-frame behind it. Small on purpose
  // (0.45): the picker itself rejects edge frames, and a strong pull fights
  // the shard-seeking and gets the staged ship killed early.
  if (careful) {
    if (p.x < 170) mx += 0.45;
    if (p.x > 790) mx -= 0.45;
    if (p.y < 190) my += 0.45;
    if (p.y > 510) my -= 0.45;
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
  // Prefer frames where the ship faces the way it fires: a busy frame where
  // the ship just turned away from its own bolts reads as if it shoots
  // backwards, however high it scores. If no aligned frame exists, fall
  // back to the best frame overall.
  let best = null;
  let bestAligned = null;
  // Nova peak (play shot only): one staged detonation. When the run reaches
  // a late wave (8+) with a Nova in hand, a crowd of foes and the ship in
  // the power zone, fire it once and sample the next 1.5 s frame by frame.
  // A peak frame only counts once foes have started coming back (the
  // respawn lands inside the window while the ring is still up and the
  // smoke still hangs), so the shot shows a battle mid-detonation, not an
  // empty field after one. The peak frame competes with the best normal
  // frame and only wins if it clearly beats it, so a dud Nova can never
  // steal the shot. End runs never touch this: the trigger is gated on
  // name === 'play', so the autopilot verification scores are byte-identical
  // to before.
  let novaFired = false;
  let peakUntil = -1;
  let bestPeak = null;
  // Multi-kill burst (play shot only): the last frame was a Nova aftermath
  // with one foe left, so the picker now hunts a window where >=2 foes die
  // close together AND >=3 foes are still alive — explosions plus a battle,
  // not one or the other. Kills are tracked by step index in a rolling
  // 30-step (0.5 s) window: that is the span in which two kill bursts are
  // both still burning on screen (burst particles live 0.25–1.1 s, score
  // popups 1.25 s). A 15-step (0.25 s) window was measured first and is
  // unreachable in real play — 0 occurrences across 5 seeds, because a foe
  // takes 2–3 bolt hits and kills spread out; the 0.5 s window occurs
  // naturally (seed 3, wave 8: two kills 15 steps apart, 13 bolts up).
  // A Nova's mass kill never counts: the log is cleared the step a Nova
  // fires, so a burst window is always bolt kills.
  let prevKills = 0;
  const killLog = [];
  let bestBurst = null;
  function aimAligned(s) {
    if (!s.bolts.length) return false;
    let mx = 0;
    let my = 0;
    for (const b of s.bolts) { mx += b.vx; my += b.vy; }
    const ml = Math.hypot(mx, my) || 1;
    const dot = (Math.cos(s.player.angle) * mx + Math.sin(s.player.angle) * my) / ml;
    return dot > 0.5;
  }
  for (let i = 0; i < limit / STEP; i += 1) {
    const pilot = autopilot(state, careful);
    let useNova = false;
    if (name === 'play' && !novaFired && state.novas > 0 && state.wave >= 8
      && state.drifters.length + state.spitters.length >= 5
      && state.player.x >= 200 && state.player.x <= 560
      && state.player.y >= 280 && state.player.y <= 480) {
      useNova = true;
      novaFired = true;
      peakUntil = i + 90;
    }
    const events = world.step(STEP, pilot.move, true, pilot.aim, useNova);
    if (events & EVENT_OVER) { over = true; break; }
    if (events & EVENT_VICTORY) { victory = true; break; }
    if (events & EVENT_WAVE_CLEAR) {
      // Take the first upgrade and keep playing, as a player would.
      const choices = world.rollUpgrades();
      world.applyUpgrade(choices[0]);
      world.startWave(state.wave + 1);
    }
    // Multi-kill burst tracking (play shot only): log each foe death by
    // step, drop entries older than 30 steps, and consider the frame only
    // while >=2 kills sit inside the window, >=3 foes are still alive,
    // >=10 bolts/orbs are flying, the ship is in frame, and the action
    // spreads across all four quadrants. The popup check is the visibility
    // proof: '+150'/'+250' are foe-kill scores, so >=2 of them on screen
    // means two bursts are actually burning in the frame right now, not
    // just logged recently. (A shard pickup at combo 3 also prints '+150',
    // so the popup count alone never proves a burst — the kill log does.)
    if (name === 'play') {
      const dk = state.kills - prevKills;
      prevKills = state.kills;
      if (useNova) killLog.length = 0;
      else for (let k = 0; k < dk; k += 1) killLog.push(i);
      while (killLog.length && killLog[0] <= i - 30) killLog.shift();
      const killPopups = state.texts.filter((t) => t.text === '+150' || t.text === '+250').length;
      const foes = state.drifters.length + state.spitters.length;
      const quad = quadrants(state);
      if (killLog.length >= 2 && killPopups >= 2 && foes >= 3
        && state.bolts.length + state.orbs.length >= 10
        && state.salvage > 0 && state.shards.length >= 2
        && state.player.x > 160 && state.player.x < 820
        && state.player.y > 170 && state.player.y < 520
        && quad.every((n) => n >= 1) && aimAligned(state)) {
        const burstScore = frameScore(state) + 40 + killLog.length * 10 + killPopups * 8
          + (state.novaFlash > 0 ? 25 : 0);
        if (!bestBurst || burstScore > bestBurst.score) {
          bestBurst = { score: burstScore, snap: structuredClone(state) };
        }
      }
    }
    if (name === 'play' && i <= peakUntil && peakUntil >= 0
      && state.drifters.length + state.spitters.length >= 1
      && state.particles.length >= 40
      && state.player.x > 160 && state.player.x < 820
      && state.player.y > 170 && state.player.y < 520) {
      const peakScore = frameScore(state)
        + Math.min(state.particles.length, 150) * 0.4
        + (state.novaFlash > 0 ? 100 : 0)
        + state.texts.length * 6;
      if (!bestPeak || peakScore > bestPeak.score) bestPeak = { score: peakScore, snap: structuredClone(state) };
    }
    if (name === 'play' && i % SAMPLE_STEPS === 0 && frameReadable(state)) {
      const score = frameScore(state);
      if (!best || score > best.score) best = { score, snap: structuredClone(state) };
      if (aimAligned(state) && (!bestAligned || score > bestAligned.score)) {
        bestAligned = { score, snap: structuredClone(state) };
      }
    }
  }
  if (victory) return { screen: SCREEN_VICTORY, best: state.score };
  if (over) {
    state.texts = []; // no stray "+400" ghosting over the stats line
    return { screen: SCREEN_OVER, best: state.score };
  }
  const normalBest = bestAligned ?? best;
  // Priority: a multi-kill burst frame (explosions AND live foes) beats a
  // Nova peak (explosions, foes cleared) and a normal dense frame (foes,
  // no burst). If no burst window ever qualified, fall back exactly as
  // before, so a seed without one still produces the best frame it has.
  let chosen = (bestPeak && bestPeak.score > (normalBest?.score ?? 0) + 10)
    ? bestPeak
    : normalBest;
  if (bestBurst) chosen = bestBurst;
  if (chosen) {
    // Restore the chosen frame in place (same object the renderer reads).
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, chosen.snap);
  }
  // A mid-wave frame, not the wave banner: the banner is transient, the play
  // screenshot should show the game itself.
  state.waveBanner = 0;
  return { screen: SCREEN_PLAY, best: state.score };
}
