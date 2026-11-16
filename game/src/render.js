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
  // space black (#0a0c10) with a dark overlay, warm amber clouds only — no
  // purple/blue nebula — a large ringed planet low on the horizon for depth,
  // and faint baked stars. Dim on purpose: the field must never out-shout
  // the gold accent or the sprites.
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
    // A distant ringed planet, mostly below the horizon: a dark disc with a
    // thin gold-lit rim and a faint ring, so the void has somewhere to be.
    // It sits low enough that the playfield stays clean, high enough that
    // the rim and ring read in the bottom-right of a still frame.
    const px = 830;
    const py = 615;
    const pr = 200;
    b.save();
    b.beginPath(); b.arc(px, py, pr, 0, Math.PI * 2); b.clip();
    const pg = b.createRadialGradient(px - 60, py - 90, 20, px, py, pr);
    pg.addColorStop(0, '#232c42');
    pg.addColorStop(0.7, '#161d2e');
    pg.addColorStop(1, '#0a0c10');
    b.fillStyle = pg;
    b.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    // Banding, barely there: darker horizontal stripes across the disc.
    b.fillStyle = 'rgba(10, 12, 16, 0.25)';
    for (let i = 0; i < 4; i += 1) b.fillRect(px - pr, py - 70 + i * 46, pr * 2, 14);
    b.restore();
    b.strokeStyle = 'rgba(253, 230, 138, 0.5)';
    b.lineWidth = 2;
    b.beginPath(); b.arc(px, py, pr, Math.PI * 1.05, Math.PI * 1.95); b.stroke();
    // The ring: a tilted ellipse, gold, faint — only the arc that clears
    // the horizon is visible.
    b.strokeStyle = 'rgba(251, 191, 36, 0.38)';
    b.lineWidth = 5;
    b.beginPath(); b.ellipse(px, py, pr * 1.45, pr * 0.32, -0.35, Math.PI * 1.08, Math.PI * 1.92); b.stroke();
    const cloud = (x, y, r, color) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(10, 12, 16, 0)');
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    };
    cloud(180, 120, 300, 'rgba(245, 158, 11, 0.10)');   // amber, top-left
    cloud(820, 480, 320, 'rgba(251, 146, 60, 0.08)');   // orange, bottom-right
    cloud(700, 110, 220, 'rgba(253, 230, 138, 0.05)');  // faint gold, top-right
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
  // Three-layer parallax starfield, driven by game time (deterministic for
  // staged shots): far stars tiny and slow, near stars bigger, brighter and
  // faster, a few gold. The field drifts downward, so even a still frame
  // reads as motion. Positions are a fixed hash of the index — no RNG, no
  // state — so the layers cost nothing and can never desync a replay.
  function parallax(time) {
    const layers = [
      { n: 70, r: 1.0, speed: 6, alpha: 0.35 },
      { n: 40, r: 1.7, speed: 16, alpha: 0.6 },
      { n: 18, r: 2.6, speed: 30, alpha: 0.9 },
    ];
    for (let li = 0; li < layers.length; li += 1) {
      const L = layers[li];
      for (let i = 0; i < L.n; i += 1) {
        const x = (i * 97.31 + li * 211.7) % FIELD.width;
        const y = ((i * 57.73 + li * 131.1) + time * L.speed) % FIELD.height;
        ctx.globalAlpha = L.alpha * (0.7 + 0.3 * Math.sin(time * 2 + i));
        ctx.fillStyle = i % 9 === 0 ? '#fde68a' : '#e2e8f0';
        ctx.beginPath(); ctx.arc(x, y, L.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  // Hit-flash: a warm glow blooming over a foe the moment a bolt lands.
  function flashOverlay(x, y, r, flash) {
    if (!flash || flash <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flash * 6);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // A keyboard key cap: dark chip, gold edge, mono label. Used on the
  // title screen so the controls read as real keys, not a line of prose.
  function keyCap(x, y, label) {
    ctx.font = `bold 15px ${FONT_MONO}`;
    const w = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y - 13, w, 26, 6);
    ctx.fill();
    ctx.stroke();
    text(label, x + w / 2, y + 1, 15, '#fde68a', 'center', 'bold', true);
    return w;
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
    // The background canvas is supersampled (1920x1200) while the context
    // already carries the 2x transform: blit it into the logical rect, or
    // only its top-left quarter would ever show (a real bug the planet
    // exposed — it lives in the bottom-right quadrant of the bg canvas).
    ctx.drawImage(bg, 0, 0, FIELD.width, FIELD.height);
    // Parallax starfield over the baked background, then the twinkling
    // field stars the world owns.
    parallax(state.time);
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
      flashOverlay(a.x, a.y, a.r, a.flash);
    }
    // DRIFTERS (chasers) — Kenney's red enemy ship, always facing the player.
    // Nothing else on screen is a red ship.
    for (const d of state.drifters) {
      const ang = Math.atan2(state.player.y - d.y, state.player.x - d.x);
      sprite(sprites.drifter, d.x, d.y, ang, 56);
      flashOverlay(d.x, d.y, d.r, d.flash);
    }
    // SPITTERS — Kenney's blue enemy ship tinted gold, a different
    // silhouette from the drifter, facing the player. The only gold ship
    // besides the player's own lantern.
    for (const s of state.spitters) {
      const ang = Math.atan2(state.player.y - s.y, state.player.x - s.x);
      sprite(sprites.spitter, s.x, s.y, ang, 62);
      flashOverlay(s.x, s.y, s.r, s.flash);
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
    // Particles: sparks glow ('lighter' composite) and smoke swells grey as
    // it fades; engine-trail embers are dimmer and smaller so they read as
    // exhaust, not explosions.
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.max);
      const r = pt.grow ? pt.r * (1 + (1 - a) * 1.6) : pt.r;
      if (pt.smoke) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a * 0.35;
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pt.trail ? a * 0.7 : a;
      }
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (showShip !== false) drawShip(state.player.x, state.player.y, state.player.angle, state.player.invulnerable, state.shield, state.time);
    if (showShip !== false) drawHullPips(state);
    // Muzzle flash: a gold starburst at the gun tip for the split second a
    // volley leaves the ship, so firing reads even in a still frame.
    if (showShip !== false && state.muzzle > 0) {
      const p = state.player;
      const gx = p.x + Math.cos(p.angle) * 36;
      const gy = p.y + Math.sin(p.angle) * 36;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = state.muzzle / 0.06;
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      for (let k = 0; k < 4; k += 1) {
        const ang = p.angle + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(ang) * 4, gy + Math.sin(ang) * 4);
        ctx.lineTo(gx + Math.cos(ang) * 17, gy + Math.sin(ang) * 17);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Floating score texts last, on top of everything, so the ship or a foe
    // can never cover half a number. Damage numbers ride at their own size.
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      text(t.text, t.x, t.y, t.size ?? 20, t.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle(state, best) {
    drawEntities(state, false);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('LUMEN DRIFT', FIELD.width / 2, 96, 76, '#fde68a', 'center');
    // A thin gold rule under the title: the whole screen hangs off it.
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(FIELD.width / 2 - 180, 128, 360, 2);
    text('— Starlight Salvage —', FIELD.width / 2, 156, 30, '#e2e8f0', 'center');
    // The ship, showcased: big, centre stage, flame lit, inside a thin
    // gold ring — the title screen is a poster, and the poster has a hero.
    const cx = FIELD.width / 2;
    const cy = 246;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 96, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const flick = 0.85 + 0.25 * Math.sin(state.time * 18);
    const flame = sprites.fire[Math.floor(state.time * 14) % sprites.fire.length];
    ctx.save();
    ctx.translate(cx, cy + 62);
    ctx.rotate(Math.PI);
    ctx.scale(flick, flick);
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 18;
    ctx.drawImage(flame, -13, -26, 26, 52);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.drawImage(sprites.player, cx - 65, cy - 49, 130, 98);
    panel(FIELD.width / 2 - 330, 356, 660, 148, 'rgba(10, 12, 16, 0.88)');
    text('Pilot your lantern-ship through the drifting dark.', FIELD.width / 2, 386, 22, '#e2e8f0', 'center');
    text('Collect star shards, blast drifters, clear 10 waves.', FIELD.width / 2, 416, 22, '#e2e8f0', 'center');
    // Controls as real key caps, two rows, centred as a group.
    const row1 = [['WASD', 'fly'], ['MOUSE', 'aim'], ['CLICK / SPACE', 'fire']];
    const row2 = [['Q', 'nova'], ['P', 'pause'], ['M', 'mute']];
    function capRow(items, y) {
      const widths = items.map(([k]) => {
        ctx.font = `bold 15px ${FONT_MONO}`;
        return ctx.measureText(k).width + 18;
      });
      const labels = items.map(([, l]) => l);
      const labelW = labels.map((l) => {
        ctx.font = `bold 15px ${FONT_SANS}`;
        return ctx.measureText(l).width;
      });
      let total = 0;
      for (let i = 0; i < items.length; i += 1) total += widths[i] + 8 + labelW[i] + 26;
      total -= 26;
      let x = FIELD.width / 2 - total / 2;
      for (let i = 0; i < items.length; i += 1) {
        x += keyCap(x, y, items[i][0]);
        text(items[i][1], x + 8, y + 1, 15, '#cbd5e1', 'left');
        x += 8 + labelW[i] + 26;
      }
    }
    capRow(row1, 452);
    capRow(row2, 484);
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 528, 24, '#fde68a', 'center', 'bold', true);
    text('▶  PRESS SPACE OR CLICK TO START', FIELD.width / 2, 564, 28, '#ffffff', 'center');
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
      text('★  STARLIGHT RESTORED!  ★', FIELD.width / 2, 130, 52, '#fde68a', 'center');
      text('You cleared all 10 waves. The drift is safe again.', FIELD.width / 2, 186, 24, '#e2e8f0', 'center');
    } else {
      text('GAME OVER', FIELD.width / 2, 130, 64, '#f87171', 'center');
      text('The dark swallowed your lantern… this time.', FIELD.width / 2, 186, 24, '#e2e8f0', 'center');
    }
    // The stats pop in over the first 16 frames on this screen (the
    // screenshot runner paints 24 frames, so a staged end shot always
    // catches them fully in). BEST gets its own gold-framed panel.
    const ease = Math.min(1, screenFrames / 16);
    const rise = (1 - ease) * 12;
    ctx.save();
    ctx.globalAlpha = ease;
    text(`SCORE  ${state.score}`, FIELD.width / 2, 246 + rise, 40, '#ffffff', 'center', 'bold', true);
    panel(FIELD.width / 2 - 150, 272 + rise, 300, 56, 'rgba(245, 158, 11, 0.14)');
    text(`BEST  ${Math.max(best, state.score)}`, FIELD.width / 2, 301 + rise, 26, '#fde68a', 'center', 'bold', true);
    const stats = [
      ['WAVES CLEARED', String(victory ? 10 : state.wave - 1)],
      ['FOES DESTROYED', String(state.kills)],
      ['SHARDS', String(state.shardsCollected)],
    ];
    stats.forEach(([label, value], i) => {
      const x = 60 + i * 300;
      panel(x, 356 + rise, 280, 96, 'rgba(10, 12, 16, 0.92)');
      text(label, x + 140, 388 + rise, 15, '#94a3b8', 'center', 'bold', true);
      text(value, x + 140, 424 + rise, 34, '#fde68a', 'center', 'bold', true);
    });
    ctx.restore();
    text('▶  PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 512, 28, '#ffffff', 'center');
  }

  // Frames spent on the current screen: the end screen's stats pop in over
  // its first 16 frames. Render-side only — it never touches world state,
  // so it cannot desync a replay or a staged shot.
  let screenFrames = 0;
  let lastScreen = null;

  return {
    ready,
    draw(state, screen, best, choices) {
      if (!sprites || !bg) return;
      if (screen !== lastScreen) { screenFrames = 0; lastScreen = screen; }
      screenFrames += 1;
      // Logical coordinates everywhere: the 2x transform maps them to the
      // supersampled backing store. (canvas.width resets the transform, so
      // re-apply it every frame.)
      ctx.setTransform(SS, 0, 0, SS, 0, 0);
      if (screen === SCREEN_TITLE) { drawTitle(state, best); return; }
      if (screen === SCREEN_UPGRADE) { drawUpgrade(state, choices ?? []); return; }
      if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) { drawEnd(state, best, screen === SCREEN_VICTORY); return; }
      // Screen shake, play screens only: a short deterministic wobble while
      // the shake timer runs (hit or Nova). Time-driven, so a staged frame
      // is reproducible. It must not apply to title/end — time is frozen
      // there, so the offset would stick instead of decaying.
      if (state.shake > 0) {
        ctx.translate(Math.sin(state.time * 91) * 14 * state.shake, Math.cos(state.time * 83) * 14 * state.shake);
      }
      drawEntities(state);
      // Nova flash: a gold bloom centred on the ship, fading with the timer.
      if (state.novaFlash > 0) {
        const g = ctx.createRadialGradient(state.player.x, state.player.y, 0, state.player.x, state.player.y, 420);
        g.addColorStop(0, `rgba(251, 191, 36, ${0.4 * state.novaFlash})`);
        g.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
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
