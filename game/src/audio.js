// Sound, synthesized live with WebAudio: no audio files to ship, nothing to
// download. Every effect is a short oscillator blip, so the game stays silent
// until the player first presses a key or clicks (browsers demand a gesture).
export function createAudio() {
  let context = null;
  let muted = false;
  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || ctx.state === 'suspended') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    shoot() { tone(720, 0.07, 'square', 0.05, 340); },
    pickup(combo) { const f = 520 + Math.min(combo, 8) * 60; tone(f, 0.12, 'sine', 0.12, f * 1.5); },
    hit() { tone(160, 0.25, 'sawtooth', 0.16, 60); },
    explosion() { tone(220, 0.35, 'triangle', 0.14, 40); },
    waveClear() { tone(523, 0.14, 'sine', 0.12); setTimeout(() => tone(659, 0.14, 'sine', 0.12), 130); setTimeout(() => tone(784, 0.22, 'sine', 0.12), 260); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.12), i * 160)); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 180)); },
    upgrade() { tone(880, 0.15, 'sine', 0.1, 1320); },
    nova() { tone(120, 0.5, 'sawtooth', 0.18, 1200); },
  };
}
