// Rendering: everything the player sees, painted on one canvas. Clarity first:
// every sprite has a distinct silhouette, a bright outline and a solid fill, so
// at a glance (and in a small screenshot) the player, each enemy type, shards
// and bullets are unmistakable. Text is always stroked so it stays sharp over
// the busy background.
import { FIELD, TOTAL_WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  // Pre-rendered background: deep navy with soft nebula clouds (kept dim so
  // sprites stay high-contrast) — painted once, blitted every frame.
  const bg = document.createElement('canvas');
  bg.width = FIELD.width;
  bg.height = FIELD.height;
  {
    const b = bg.getContext('2d');
    b.fillStyle = '#04081a';
    b.fillRect(0, 0, FIELD.width, FIELD.height);
    const cloud = (x, y, r, color) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(4, 8, 26, 0)');
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    };
    cloud(180, 120, 300, 'rgba(49, 46, 129, 0.5)');   // indigo, top-left
    cloud(820, 480, 320, 'rgba(8, 74, 110, 0.45)');   // teal, bottom-right
    cloud(780, 110, 240, 'rgba(76, 29, 149, 0.35)');  // violet, top-right
    cloud(120, 520, 220, 'rgba(134, 25, 143, 0.16)'); // magenta, bottom-left
    // Static faint stars baked in so the field never looks empty.
    const cols = ['#ffffff', '#fde68a', '#bae6fd', '#e2e8f0'];
    for (let i = 0; i < 150; i += 1) {
      const x = ((i * 137.5) % FIELD.width);
      const y = ((i * 89.3) % FIELD.height);
      b.globalAlpha = 0.25 + ((i * 7) % 10) / 16;
      b.fillStyle = cols[i % cols.length];
      const r = 0.7 + ((i * 13) % 10) / 8;
      b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    }
    b.globalAlpha = 1;
  }

  function panel(x, y, w, h, fill) {
    ctx.fillStyle = fill ?? 'rgba(8, 15, 40, 0.82)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }
  function pill(x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill ?? 'rgba(2, 6, 23, 0.8)';
    ctx.strokeStyle = stroke ?? 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.stroke();
  }
  // Text with a dark outline under the fill: stays legible over any effect.
  function text(str, x, y, size, color, align, weight) {
    ctx.font = `${weight ?? 'bold'} ${size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = align ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // PLAYER — a lantern-ship: long gold arrow hull, white-hot cockpit, twin
  // wings and an engine flame. Drawn ~1.5x its collision radius so it reads
  // as a ship, not a dot. Collision stays at radius 16 (fairness unchanged).
  function drawShip(x, y, angle, invulnerable, shield, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.scale(1.45, 1.45);
    // Engine flame (flickers with time).
    const flick = 10 + Math.sin(time * 18) * 3;
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-14, -5); ctx.lineTo(-14 - flick, 0); ctx.lineTo(-14, 5); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Wings.
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, -8); ctx.lineTo(-18, -20); ctx.lineTo(-14, -6); ctx.closePath();
    ctx.moveTo(-4, 8); ctx.lineTo(-18, 20); ctx.lineTo(-14, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Hull: long arrow with a bright rim so it pops off the dark field.
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 0); ctx.lineTo(-12, -13); ctx.lineTo(-6, 0); ctx.lineTo(-12, 13); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    // Cockpit: white-hot lantern core.
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(7, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (shield) {
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawHud(state, best) {
    // Top bar: score left, wave centre, hull right — always visible in play.
    const grad = ctx.createLinearGradient(0, 0, 0, 52);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.92)');
    grad.addColorStop(1, 'rgba(4, 10, 30, 0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 52, FIELD.width, 2);
    text(`SCORE  ${state.score}`, 16, 27, 26, '#fde68a', 'left');
    text(`WAVE ${state.wave} / ${TOTAL_WAVES}`, FIELD.width / 2, 27, 26, '#e0f2fe', 'center');
    const hearts = '♥'.repeat(Math.max(0, state.hull)) + '♡'.repeat(Math.max(0, state.maxHull - state.hull));
    text(hearts, FIELD.width - 16, 27, 26, '#f87171', 'right');
    // Combo / nova / shield as pills so they never collide with the bar text.
    if (state.combo > 1) {
      const label = `COMBO x${state.combo}`;
      ctx.font = 'bold 20px "Trebuchet MS", Verdana, sans-serif';
      const w = ctx.measureText(label).width + 24;
      pill(12, 62, w, 30, 'rgba(88, 28, 135, 0.88)', '#c084fc');
      text(label, 24, 78, 20, '#f0abfc', 'left');
    }
    if (state.novas > 0) {
      const label = `NOVA x${state.novas}  (Q)`;
      ctx.font = 'bold 19px "Trebuchet MS", Verdana, sans-serif';
      const w = ctx.measureText(label).width + 24;
      pill(FIELD.width - 12 - w, 62, w, 30, 'rgba(88, 28, 135, 0.88)', '#c084fc');
      text(label, FIELD.width - 24, 78, 19, '#f0abfc', 'right');
    }
    if (state.shield) {
      pill(12, 98, 128, 30, 'rgba(8, 74, 110, 0.88)', '#7dd3fc');
      text('SHIELD UP', 24, 114, 18, '#7dd3fc', 'left');
    }
    // Salvage progress: bordered bar with the numbers underneath, centred.
    const w = 240;
    const x = FIELD.width / 2 - w / 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, 62, w, 14);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, 62, w, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 2, 64, (w - 4) * Math.min(1, state.salvage / state.quota), 10);
    text(`SALVAGE ${state.salvage}/${state.quota}`, FIELD.width / 2, 90, 16, '#bae6fd', 'center');
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
    // SHARDS — bright gold diamonds with a white-hot core. The only gold
    // diamond on screen, so they read instantly as pickups.
    for (const s of state.shards) {
      const r = s.r + 2 + Math.sin(s.pulse) * 2;
      ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r * 0.72, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r * 0.72, s.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.45); ctx.lineTo(s.x + r * 0.32, s.y); ctx.lineTo(s.x, s.y + r * 0.45); ctx.lineTo(s.x - r * 0.32, s.y);
      ctx.closePath(); ctx.fill();
    }
    // ASTEROIDS — dark slate rocks with a thick pale rim and craters, so the
    // grey body is never lost against the dark field.
    for (const a of state.asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y); ctx.rotate(a.rot);
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const ang = (i / 9) * Math.PI * 2;
        const rr = a.r * (0.8 + 0.2 * Math.sin(i * 2.7 + 1));
        if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(-a.r * 0.3, -a.r * 0.2, a.r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(a.r * 0.35, a.r * 0.3, a.r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // DRIFTERS (chasers) — jagged red-orange maw-stars that always face the
    // player, with white eyes. Nothing else on screen is red or spiky.
    // Drawn bigger than the collision radius (visual only, fairness unchanged).
    for (const d of state.drifters) {
      const ang = Math.atan2(state.player.y - d.y, state.player.x - d.x);
      const R = d.r + 5;
      ctx.save();
      ctx.translate(d.x, d.y); ctx.rotate(ang);
      ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 === 0 ? R + 6 : R * 0.55;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath(); ctx.arc(6, -6, 3.5, 0, Math.PI * 2); ctx.arc(6, 6, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(7, -6, 1.8, 0, Math.PI * 2); ctx.arc(7, 6, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // SPITTERS — purple hexagons with a pale rim, a glowing core and a barrel
    // aimed at the player. The only purple hexagon: the ranged enemy.
    // Drawn slightly bigger than the collision radius (visual only).
    for (const s of state.spitters) {
      const ang = Math.atan2(state.player.y - s.y, state.player.x - s.x);
      const R = s.r + 3;
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(ang);
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#7e22ce';
      ctx.strokeStyle = '#e9d5ff'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
        else ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      // Barrel toward the player.
      ctx.fillStyle = '#c084fc';
      ctx.beginPath(); ctx.arc(R * 0.75, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fdf4ff';
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // BOLTS — bright streaks along their velocity, so the firing direction
    // reads at a glance. Gold core, white-hot centre.
    ctx.lineCap = 'round';
    for (const b of state.bolts) {
      const tx = b.x - b.vx * 0.045;
      const ty = b.y - b.vy * 0.045;
      ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10;
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // Enemy orbs — magenta balls with a white core and pale rim.
    for (const o of state.orbs) {
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#d946ef';
      ctx.strokeStyle = '#f5d0fe'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fdf4ff';
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (showShip !== false) drawShip(state.player.x, state.player.y, state.player.angle, state.player.invulnerable, state.shield, state.time);
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
    ctx.fillStyle = 'rgba(4, 10, 30, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('LUMEN DRIFT', FIELD.width / 2, 130, 72, '#fde68a', 'center');
    text('— Starlight Salvage —', FIELD.width / 2, 190, 30, '#bae6fd', 'center');
    panel(FIELD.width / 2 - 330, 230, 660, 200, 'rgba(8, 15, 40, 0.88)');
    text('Pilot your lantern-ship through the drifting dark.', FIELD.width / 2, 262, 22, '#e2e8f0', 'center');
    text('Collect star shards, blast drifters, clear 10 waves.', FIELD.width / 2, 294, 22, '#e2e8f0', 'center');
    text('WASD / Arrows — fly      Mouse — aim      Click / Space — fire', FIELD.width / 2, 336, 21, '#fde68a', 'center');
    text('Q — Nova Bomb      P — pause      M — mute', FIELD.width / 2, 368, 21, '#fde68a', 'center');
    text('Between waves, pick 1 of 3 upgrades. Lose all hull and the dark wins.', FIELD.width / 2, 398, 20, '#94a3b8', 'center');
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 452, 24, '#f0abfc', 'center');
    text('▶  PRESS SPACE OR CLICK TO START', FIELD.width / 2, 505, 28, '#ffffff', 'center');
  }

  function drawUpgrade(state, choices) {
    drawEntities(state);
    ctx.fillStyle = 'rgba(4, 10, 30, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED!`, FIELD.width / 2, 90, 44, '#fde68a', 'center');
    text('Choose your upgrade — click a card, or press 1, 2 or 3', FIELD.width / 2, 140, 24, '#e2e8f0', 'center');
    choices.forEach((c, i) => {
      const x = 40 + i * 320;
      panel(x, 190, 280, 240, 'rgba(8, 15, 40, 0.92)');
      text(`[${i + 1}]`, x + 140, 225, 22, '#38bdf8', 'center');
      text(c.name, x + 140, 265, 26, '#ffffff', 'center');
      // Word-wrap the description inside the card.
      const words = c.desc.split(' ');
      let line = '';
      let y = 310;
      ctx.font = '20px "Trebuchet MS", Verdana, sans-serif';
      for (const w of words) {
        if (ctx.measureText(`${line} ${w}`.trim()).width > 240) { text(line.trim(), x + 140, y, 20, '#bae6fd', 'center'); y += 28; line = w; }
        else line = `${line} ${w}`.trim();
      }
      if (line) text(line, x + 140, y, 20, '#bae6fd', 'center');
    });
  }

  function drawEnd(state, best, victory) {
    drawEntities(state);
    ctx.fillStyle = 'rgba(4, 10, 30, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (victory) {
      text('★  STARLIGHT RESTORED!  ★', FIELD.width / 2, 170, 52, '#fde68a', 'center');
      text('You cleared all 10 waves. The drift is safe again.', FIELD.width / 2, 230, 24, '#e2e8f0', 'center');
    } else {
      text('GAME OVER', FIELD.width / 2, 170, 64, '#f87171', 'center');
      text('The dark swallowed your lantern… this time.', FIELD.width / 2, 230, 24, '#e2e8f0', 'center');
    }
    text(`SCORE  ${state.score}`, FIELD.width / 2, 300, 36, '#ffffff', 'center');
    text(`BEST  ${Math.max(best, state.score)}`, FIELD.width / 2, 348, 26, '#f0abfc', 'center');
    text(`Waves cleared: ${victory ? 10 : state.wave - 1}    Foes destroyed: ${state.kills}    Shards: ${state.shardsCollected}`, FIELD.width / 2, 392, 22, '#bae6fd', 'center');
    text('▶  PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 470, 28, '#ffffff', 'center');
  }

  return {
    draw(state, screen, best, choices) {
      if (screen === SCREEN_TITLE) { drawTitle(state, best); return; }
      if (screen === SCREEN_UPGRADE) { drawUpgrade(state, choices ?? []); return; }
      if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) { drawEnd(state, best, screen === SCREEN_VICTORY); return; }
      drawEntities(state);
      drawHud(state, best);
      if (state.waveBanner > 0) {
        // Dark pill behind the banner so it reads over the action.
        pill(FIELD.width / 2 - 260, 185, 520, 110, 'rgba(2, 6, 23, 0.78)', 'rgba(245, 158, 11, 0.6)');
        text(`WAVE ${state.wave}`, FIELD.width / 2, 220, 54, '#fde68a', 'center');
        text(state.wave === TOTAL_WAVES ? 'THE FINAL STORM — clear it to win!' : 'Clear the salvage quota to advance', FIELD.width / 2, 270, 22, '#e2e8f0', 'center');
      }
      if (screen === SCREEN_PAUSED) {
        ctx.fillStyle = 'rgba(4, 10, 30, 0.6)';
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        text('PAUSED', FIELD.width / 2, 280, 56, '#ffffff', 'center');
        text('Press P or click to resume', FIELD.width / 2, 340, 24, '#bae6fd', 'center');
      }
    },
  };
}
