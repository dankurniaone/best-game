// Rendering: everything the player sees, painted on one canvas. All game
// art is real raster sprites from Kenney's "Space Shooter Redux" (CC0),
// bundled locally in game/assets/ and loaded by assets.js — no more
// hand-drawn shapes. Every entity has a distinct, detailed sprite, so at a
// glance (and in a small screenshot) the player, each enemy type, shards and
// bullets are unmistakable. Text is always stroked so it stays sharp over
// the busy background. Collision radii and balance are untouched: sprites
// are drawn bigger than their collision circles (visual only).
//
// Design system (Tao Baryon GDD discipline): space black #0a0c10, ONE accent
// (gold) used sparingly, mono type for every number, sans for prose. Player
// fire is cold blue, enemy fire is warm red — never the same temperature.
// No purple-blue neon gradients: the field stays dark and the gold does the
// talking. The canvas renders at 2x supersampling (1920x1200 backing for a
// 960x600 logical field) so text and sprite edges stay razor-sharp in
// screenshots; gameplay coordinates never change.
import { FIELD, TOTAL_WAVES } from './config.js';
import { loadAssets } from './assets.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

// Two typefaces only: mono for all numbers, sans for prose.
const FONT_MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const FONT_SANS = 'system-ui, "Segoe UI", "Trebuchet MS", Verdana, sans-serif';
// Supersampling factor: backing store is SS x the logical field.
const SS = 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width * SS;
  canvas.height = FIELD.height * SS;

  let sprites = null;
  let bg = null;
  // Assets load async; main.js awaits `ready` before the first paint, so
  // draw() never runs before the sprites exist.
  const ready = loadAssets().then((s) => {
    sprites = s;
    bg = buildBackground(s.bg);
  });

  // Pre-rendered background: the Kenney starfield tile, pulled toward
  // space black (#0a0c10) with a dark overlay, two very dim clouds only —
  // no purple/magenta neon — and faint baked stars. Dim on purpose: the
  // field must never out-shout the gold accent or the sprites.
  function buildBackground(tile) {
    const c = document.createElement('canvas');
    c.width = FIELD.width * SS;
    c.height = FIELD.height * SS;
    const b = c.getContext('2d');
    b.setTransform(SS, 0, 0, SS, 0, 0);
    for (let x = 0; x < FIELD.width; x += tile.width) {
      for (let y = 0; y < FIELD.height; y += tile.height) b.drawImage(tile, x, y);
    }
    // Pull the blue tile toward space black.
    b.fillStyle = 'rgba(10, 12, 16, 0.55)';
    b.fillRect(0, 0, FIELD.width, FIELD.height);
    const cloud = (x, y, r, color) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(10, 12, 16, 0)');
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    };
    cloud(180, 120, 300, 'rgba(49, 46, 129, 0.22)');   // indigo, top-left
    cloud(820, 480, 320, 'rgba(8, 74, 110, 0.18)');   // teal, bottom-right
    const cols = ['#ffffff', '#fde68a', '#e2e8f0', '#cbd5e1'];
    for (let i = 0; i < 150; i += 1) {
      const x = ((i * 137.5) % FIELD.width);
      const y = ((i * 89.3) % FIELD.height);
      b.globalAlpha = 0.25 + ((i * 7) % 10) / 16;
      b.fillStyle = cols[i % cols.length];
      const r = 0.7 + ((i * 13) % 10) / 8;
      b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    }
    b.globalAlpha = 1;
    return c;
  }

  function panel(x, y, w, h, fill) {
    ctx.fillStyle = fill ?? 'rgba(10, 12, 16, 0.88)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }
  function pill(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill ?? 'rgba(10, 12, 16, 0.85)';
    ctx.strokeStyle = stroke ?? 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.stroke();
  }
  // Text with a dark outline under the fill: stays legible over any effect.
  // `mono` selects the mono face — every number on screen uses it.
  function text(str, x, y, size, color, align, weight, mono) {
    ctx.font = `${weight ?? 'bold'} ${size}px ${mono ? FONT_MONO : FONT_SANS}`;
    ctx.textAlign = align ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = 'rgba(10, 12, 16, 0.9)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  // Draw a sprite centred at (x, y), rotated so its nose (Kenney sprites
  // face up) points along `angle`. Width `w`; height follows the aspect.
  function sprite(img, x, y, angle, w) {
    const h = (w * img.height) / img.width;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // PLAYER — Kenney's orange playerShip1, drawn ~2.4x its collision radius
  // (visual only; collision stays at radius 16). A real engine flame flickers
  // behind it, animated from the pack's fire frames.
  function drawShip(x, y, angle, invulnerable, shield, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    // Engine flame: tail is local +y; the flame sprite points up, so flip it.
    // Drawn big with a warm glow, so the tail unmistakably reads as "engine on".
    const flick = 0.85 + 0.25 * Math.sin(time * 18);
    const flame = sprites.fire[Math.floor(time * 14) % sprites.fire.length];
    ctx.save();
    ctx.translate(0, 40);
    ctx.rotate(Math.PI);
    ctx.scale(flick, flick);
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 18;
    ctx.drawImage(flame, -13, -26, 26, 52);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.drawImage(sprites.player, -39, -29.5, 78, 59);
    ctx.restore();
    if (shield) {
      ctx.globalAlpha = 0.95;
      ctx.drawImage(sprites.shield, x - 52, y - 42, 104, 84);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Hull pips right under the ship (Zesix: vital info lives where the eyes
  // already are). Low alpha, small, gold — the top bar keeps the numbers.
  function drawHullPips(state) {
    const p = state.player;
    const n = state.maxHull;
    const w = n * 12 - 4;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < n; i += 1) {
      const cx = p.x - w / 2 + i * 12 + 4;
      const cy = p.y + 54;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      if (i < state.hull) { ctx.fillStyle = '#fbbf24'; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    // Top bar, ~9% of the screen (52 of 600 px), two rows — and NOTHING
    // below it. The playfield under the bar is never covered by UI: no pills
    // hanging into the action, no salvage bar floating mid-screen.
    // Row 1: score left, wave centre, hull right. Row 2: status left,
    // salvage centre, nova right. All numbers mono, all accents gold.
    // The bar stays 52 px tall on purpose: the world clamps the ship to
    // y >= 56 so it never slides under the bar, and that clamp is part of
    // the measured 4/5 autopilot win profile — a taller bar cost two wins.
    const grad = ctx.createLinearGradient(0, 0, 0, 52);
    grad.addColorStop(0, '#0a0c10');
    grad.addColorStop(1, '#10141f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 52, FIELD.width, 2);
    text(`SCORE  ${state.score}`, 24, 17, 20, '#fde68a', 'left', 'bold', true);
    text(`WAVE ${state.wave} / ${TOTAL_WAVES}`, FIELD.width / 2, 17, 20, '#f8fafc', 'center', 'bold', true);
    const hearts = '♥'.repeat(Math.max(0, state.hull)) + '♡'.repeat(Math.max(0, state.maxHull - state.hull));
    text(hearts, FIELD.width - 24, 17, 20, '#f87171', 'right');
    // Row 2, left: status chips as plain mono text, gold on black.
    let lx = 24;
    if (state.combo > 1) {
      const label = `COMBO x${state.combo}`;
      text(label, lx, 40, 14, '#fbbf24', 'left', 'bold', true);
      lx += ctx.measureText(label).width + 20;
    }
    if (state.shield) {
      text('SHIELD', lx, 40, 14, '#fbbf24', 'left', 'bold', true);
    }
    if (state.novas > 0) {
      text(`NOVA x${state.novas}  (Q)`, FIELD.width - 24, 40, 14, '#fbbf24', 'right', 'bold', true);
    }
    // Row 2, centre: salvage — label, thin gold bar, count. All mono.
    const bw = 220;
    const bx = FIELD.width / 2 - bw / 2;
    text('SALVAGE', bx - 10, 40, 13, '#e2e8f0', 'right', 'bold', true);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, 35, bw, 9);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, 35, bw, 9);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx + 2, 37, (bw - 4) * Math.min(1, state.salvage / state.quota), 5);
    text(`${state.salvage}/${state.quota}`, bx + bw + 10, 40, 13, '#fde68a', 'left', 'bold', true);
  }

  function meteorFor(a) {
    // Variant by size; a rock that shrinks when shot drops a size class.
    if (a.r >= 27) return sprites.meteorBig[Math.floor(a.r) % 2];
    if (a.r >= 19) return sprites.meteorMed[Math.floor(a.r) % 2];
    if (a.r >= 13) return sprites.meteorSmall[Math.floor(a.r) % 2];
    return sprites.meteorTiny[Math.floor(a.r) % 2];
  }

  function drawEntities(state, showShip) {
    ctx.drawImage(bg, 0, 0);
    // Twinkling field stars on top of the nebula.
    for (const s of state.stars) {
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(s.tw);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // SHARDS — Kenney's gold star, pulsing with a warm glow. The only gold
    // star on screen, so it reads instantly as a pickup.
    for (const s of state.shards) {
      const w = 30 * (1 + 0.12 * Math.sin(s.pulse));
      ctx.shadowColor = '#fde68a';
      ctx.shadowBlur = 14;
      ctx.drawImage(sprites.shard, s.x - w / 2, s.y - (w * sprites.shard.height / sprites.shard.width) / 2, w, w * sprites.shard.height / sprites.shard.width);
      ctx.shadowBlur = 0;
    }
    // ASTEROIDS — detailed Kenney grey meteors in four size classes,
    // rotating as they drift. Drawn a touch wider than the collision circle.
    for (const a of state.asteroids) {
      sprite(meteorFor(a), a.x, a.y, a.rot - Math.PI / 2, a.r * 2.1);
    }
    // DRIFTERS (chasers) — Kenney's red enemy ship, always facing the player.
    // Nothing else on screen is a red ship.
    for (const d of state.drifters) {
      const ang = Math.atan2(state.player.y - d.y, state.player.x - d.x);
      sprite(sprites.drifter, d.x, d.y, ang, 56);
    }
    // SPITTERS — Kenney's blue enemy ship tinted purple, a different
    // silhouette from the drifter, facing the player. The only purple ship.
    for (const s of state.spitters) {
      const ang = Math.atan2(state.player.y - s.y, state.player.x - s.x);
      sprite(sprites.spitter, s.x, s.y, ang, 62);
    }
    // BOLTS — gold laser bolts along their velocity, so the firing direction
    // reads at a glance.
    for (const b of state.bolts) {
      sprite(sprites.bolt, b.x, b.y, Math.atan2(b.vy, b.vx), 8);
    }
    // Enemy orbs — red starburst bolts, small but spiky and unmistakable.
    for (const o of state.orbs) {
      ctx.drawImage(sprites.orb, o.x - 11, o.y - 11, 22, 22);
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (showShip !== false) drawShip(state.player.x, state.player.y, state.player.angle, state.player.invulnerable, state.shield, state.time);
    if (showShip !== false) drawHullPips(state);
    // Floating score texts last, on top of everything, so the ship or a foe
    // can never cover half a number.
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      text(t.text, t.x, t.y, 20, t.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle(state, best) {
    drawEntities(state, false);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('LUMEN DRIFT', FIELD.width / 2, 130, 72, '#fde68a', 'center');
    text('— Starlight Salvage —', FIELD.width / 2, 190, 30, '#e2e8f0', 'center');
    panel(FIELD.width / 2 - 330, 222, 660, 224, 'rgba(10, 12, 16, 0.88)');
    text('Pilot your lantern-ship through the drifting dark.', FIELD.width / 2, 256, 22, '#e2e8f0', 'center');
    text('Collect star shards, blast drifters, clear 10 waves.', FIELD.width / 2, 288, 22, '#e2e8f0', 'center');
    text('WASD / Arrows — fly      Mouse — aim      Click / Space — fire', FIELD.width / 2, 330, 21, '#fde68a', 'center');
    text('Q — Nova Bomb      P — pause      M — mute', FIELD.width / 2, 362, 21, '#fde68a', 'center');
    text('Between waves, pick 1 of 3 upgrades.', FIELD.width / 2, 396, 20, '#94a3b8', 'center');
    text('Lose all hull and the dark wins.', FIELD.width / 2, 424, 20, '#94a3b8', 'center');
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 472, 24, '#fde68a', 'center', 'bold', true);
    text('▶  PRESS SPACE OR CLICK TO START', FIELD.width / 2, 522, 28, '#ffffff', 'center');
  }

  function drawUpgrade(state, choices) {
    drawEntities(state);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED!`, FIELD.width / 2, 90, 44, '#fde68a', 'center');
    text('Choose your upgrade — click a card, or press 1, 2 or 3', FIELD.width / 2, 140, 24, '#e2e8f0', 'center');
    choices.forEach((c, i) => {
      const x = 30 + i * 310;
      panel(x, 190, 280, 240, 'rgba(10, 12, 16, 0.92)');
      text(`[${i + 1}]`, x + 140, 225, 22, '#fbbf24', 'center', 'bold', true);
      text(c.name, x + 140, 265, 26, '#ffffff', 'center');
      // Word-wrap the description inside the card.
      const words = c.desc.split(' ');
      let line = '';
      let y = 310;
      ctx.font = `20px ${FONT_SANS}`;
      for (const w of words) {
        if (ctx.measureText(`${line} ${w}`.trim()).width > 240) { text(line.trim(), x + 140, y, 20, '#cbd5e1', 'center'); y += 28; line = w; }
        else line = `${line} ${w}`.trim();
      }
      if (line) text(line, x + 140, y, 20, '#cbd5e1', 'center');
    });
  }

  function drawEnd(state, best, victory) {
    drawEntities(state);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (victory) {
      text('★  STARLIGHT RESTORED!  ★', FIELD.width / 2, 170, 52, '#fde68a', 'center');
      text('You cleared all 10 waves. The drift is safe again.', FIELD.width / 2, 230, 24, '#e2e8f0', 'center');
    } else {
      text('GAME OVER', FIELD.width / 2, 170, 64, '#f87171', 'center');
      text('The dark swallowed your lantern… this time.', FIELD.width / 2, 230, 24, '#e2e8f0', 'center');
    }
    text(`SCORE  ${state.score}`, FIELD.width / 2, 300, 36, '#ffffff', 'center', 'bold', true);
    text(`BEST  ${Math.max(best, state.score)}`, FIELD.width / 2, 348, 26, '#fde68a', 'center', 'bold', true);
    text(`Waves cleared: ${victory ? 10 : state.wave - 1}    Foes destroyed: ${state.kills}    Shards: ${state.shardsCollected}`, FIELD.width / 2, 392, 22, '#e2e8f0', 'center', 'bold', true);
    text('▶  PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 470, 28, '#ffffff', 'center');
  }

  return {
    ready,
    draw(state, screen, best, choices) {
      if (!sprites || !bg) return;
      // Logical coordinates everywhere: the 2x transform maps them to the
      // supersampled backing store. (canvas.width resets the transform, so
      // re-apply it every frame.)
      ctx.setTransform(SS, 0, 0, SS, 0, 0);
      if (screen === SCREEN_TITLE) { drawTitle(state, best); return; }
      if (screen === SCREEN_UPGRADE) { drawUpgrade(state, choices ?? []); return; }
      if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) { drawEnd(state, best, screen === SCREEN_VICTORY); return; }
      drawEntities(state);
      drawHud(state, best);
      if (state.waveBanner > 0) {
        // Dark pill behind the banner so it reads over the action.
        pill(FIELD.width / 2 - 260, 185, 520, 110, 'rgba(10, 12, 16, 0.82)', 'rgba(245, 158, 11, 0.6)');
        text(`WAVE ${state.wave}`, FIELD.width / 2, 220, 54, '#fde68a', 'center');
        text(state.wave === TOTAL_WAVES ? 'THE FINAL STORM — clear it to win!' : 'Clear the salvage quota to advance', FIELD.width / 2, 270, 22, '#e2e8f0', 'center');
      }
      if (screen === SCREEN_PAUSED) {
        ctx.fillStyle = 'rgba(10, 12, 16, 0.6)';
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        text('PAUSED', FIELD.width / 2, 280, 56, '#ffffff', 'center');
        text('Press P or click to resume', FIELD.width / 2, 340, 24, '#e2e8f0', 'center');
      }
    },
  };
}
