// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start, pause, nova, upgrade choices) are reported once per press.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let pointer = { x: 480, y: 300, down: false, clicked: false };
  let clickedCard = -1;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (!event.repeat) pressed.add(event.key.toLowerCase());
    held.add(event.key.toLowerCase());
  }
  function onKeyUp(event) {
    held.delete(event.key.toLowerCase());
  }
  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 960;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 600;
  }
  function onPointerDown(event) {
    onPointerMove(event);
    pointer.down = true;
    pointer.clicked = true;
    if (event.target === canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 960;
      const y = ((event.clientY - rect.top) / rect.height) * 600;
      // Upgrade cards live in the lower half of the screen.
      if (y > 300) {
        const card = Math.floor(x / 320);
        if (card >= 0 && card < 3) clickedCard = card;
      }
    }
  }
  function onPointerUp() { pointer.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** Steering direction from held keys, normalized. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('a') || held.has('arrowleft')) x -= 1;
      if (held.has('d') || held.has('arrowright')) x += 1;
      if (held.has('w') || held.has('arrowup')) y -= 1;
      if (held.has('s') || held.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    firing() { return pointer.down || held.has(' '); },
    aim() { return pointer; },
    takeClickedCard() { const c = clickedCard; clickedCard = -1; return c; },
    takeClicked() { const c = pointer.clicked; pointer.clicked = false; return c; },
    /** The one-shot presses since the last call, as ACTION_* flags. Digit keys are left for takeChoice(). */
    takeActions() {
      let actions = 0;
      if (pressed.has(' ') || pressed.has('enter')) actions |= ACTION_CONFIRM;
      if (pressed.has('p') || pressed.has('escape')) actions |= ACTION_PAUSE;
      if (pressed.has('q')) actions |= ACTION_NOVA;
      if (pressed.has('m')) actions |= ACTION_MUTE;
      for (const key of [...pressed]) {
        if (key !== '1' && key !== '2' && key !== '3') pressed.delete(key);
      }
      return actions;
    },
    /** Upgrade choice keys 1/2/3 pressed since the last call, or -1. */
    takeChoice() {
      for (const key of ['1', '2', '3']) {
        if (pressed.has(key)) { pressed.delete(key); return Number(key) - 1; }
      }
      return -1;
    },
  };
}
