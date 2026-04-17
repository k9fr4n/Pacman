// =============================================================
// audio.js — WebAudio synthwave SFX (no external samples).
// =============================================================

let ctx = null;
let master = null;
let muted = false;
let chompToggle = false;

function ensure() {
  if (ctx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

export function resume() {
  ensure();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function setMuted(v) {
  muted = v;
  if (master) master.gain.value = v ? 0 : 0.22;
}
export function toggleMute() { setMuted(!muted); return muted; }
export function isMuted() { return muted; }

function blip({ freq = 440, type = "square", dur = 0.08, gain = 0.5, slideTo = null }) {
  ensure();
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo != null) {
    o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  }
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export function chomp() {
  chompToggle = !chompToggle;
  blip({ freq: chompToggle ? 520 : 380, type: "square", dur: 0.055, gain: 0.32 });
}
export function power()    { blip({ freq: 180, slideTo: 720, type: "sawtooth", dur: 0.45, gain: 0.4 }); }
export function eatGhost() {
  blip({ freq: 220, slideTo: 880, type: "triangle", dur: 0.35, gain: 0.5 });
  setTimeout(() => blip({ freq: 880, slideTo: 1400, type: "triangle", dur: 0.25, gain: 0.4 }), 120);
}
export function death() {
  ensure();
  if (!ctx || muted) return;
  const notes = [600, 520, 440, 360, 280, 200, 140, 90];
  notes.forEach((f, i) => setTimeout(() => blip({ freq: f, type: "sawtooth", dur: 0.18, gain: 0.5 }), i * 120));
}
export function win() {
  [440, 554, 659, 880].forEach((f, i) =>
    setTimeout(() => blip({ freq: f, type: "triangle", dur: 0.2, gain: 0.45 }), i * 100)
  );
}
export function uiBlip() { blip({ freq: 880, type: "square", dur: 0.05, gain: 0.2 }); }
