// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, play, paused, upgrade choice, game
// over, victory.
//
// ?seed=N fixes the random pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); }
  catch { /* Storage can be off: best lasts this visit only. */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, []);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let choices = [];
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }
  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Wave 1. ${world.state.maxHull} hull.`);
  }
  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    if (victory) audio.victory(); else audio.gameOver();
    announce(`${victory ? 'Victory' : 'Game over'}. Score ${world.state.score}. Best ${best}.`);
  }
  function openUpgrade() {
    choices = world.rollUpgrades();
    screen = SCREEN_UPGRADE;
    audio.waveClear();
    announce('Wave cleared. Choose an upgrade: 1, 2 or 3, or click a card.');
  }
  function pickUpgrade(index) {
    if (index < 0 || index >= choices.length) return;
    world.applyUpgrade(choices[index]);
    audio.upgrade();
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) startGame();
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (actions & ACTION_NOVA && screen === SCREEN_PLAY) {
      const before = world.state.novas;
      world.step(0, { x: 0, y: 0 }, false, null, true);
      if (world.state.novas < before) audio.nova();
    }
    if (screen === SCREEN_UPGRADE) {
      const card = input.takeClickedCard();
      const key = input.takeChoice();
      if (card >= 0) pickUpgrade(card);
      else if (key >= 0) pickUpgrade(key);
    }
    if (input.takeClicked() && screen === SCREEN_TITLE) startGame();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null, false);
      return;
    }
    const events = world.step(STEP, input.direction(), input.firing(), input.aim(), false);
    if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_VICTORY) endGame(true);
    else if (events & EVENT_WAVE_CLEAR) openUpgrade();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, choices);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });

  announce('Lumen Drift. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
