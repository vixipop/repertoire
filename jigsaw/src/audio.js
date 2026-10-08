// Every sound is synthesised: no files to fetch, nothing to decode.
//
// The snap is modelled on a recording of someone assembling a foam puzzle.
// Measured there: a bright crack about a millisecond long (energy mostly
// 3–12 kHz, almost no low end), then a handful of quieter micro-clicks
// spread over the next 2–35 ms at 20–60% of its height, and nothing left
// after ~40 ms. Handling between snaps is a soft rustle: many tiny clicks
// over ~100 ms. Each sound is rendered fresh, so no two are identical.

let ctx = null;
let sfx = null;
let musicBus = null;
let noise = null;

export function wakeAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const rnd = (a, b) => a + Math.random() * (b - a);

// ─── Crunch: a buffer of clicks, rendered sample by sample ───────────────
// Each click is a sliver of noise plus a short ring (the card's tick).
function renderClicks(clicks, length) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.ceil(length * sr), sr);
  const out = buf.getChannelData(0);
  for (const c of clicks) {
    const start = Math.floor(c.at * sr);
    const n = Math.floor(c.len * sr);
    const tauN = c.len * 0.3 * sr;
    const tauR = c.ring * sr;
    const w = (2 * Math.PI * c.freq) / sr;
    const ringN = Math.min(out.length - start, Math.floor(tauR * 5));
    for (let i = 0; i < Math.max(n, ringN) && start + i < out.length; i++) {
      const grain = i < n ? (Math.random() * 2 - 1) * Math.exp(-i / tauN) : 0;
      const ring = Math.sin(w * i) * Math.exp(-i / tauR) * 0.6;
      out[start + i] += c.amp * (grain + ring);
    }
  }
  return buf;
}

function playBuffer(buf, { gain = 1, hp = 1800, lp = 13000, at = 0 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const h = ctx.createBiquadFilter();
  h.type = 'highpass';
  h.frequency.value = hp;
  h.Q.value = 0.6;
  const l = ctx.createBiquadFilter();
  l.type = 'lowpass';
  l.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(h).connect(l).connect(g).connect(sfx);
  src.start(ctx.currentTime + at);
}

function thump(t, f0, f1, dur, gain) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function soundSnap(strength = 1) {
  if (!ctx) return;
  const clicks = [];
  // The crack.
  clicks.push({ at: 0, len: rnd(0.0006, 0.0012), ring: rnd(0.0006, 0.0011), freq: rnd(4200, 7500), amp: 0.55 });
  // Sometimes a twin a millisecond before, as in the loudest one recorded.
  if (Math.random() < 0.3) clicks.push({ at: -0.001, len: 0.0005, ring: 0.0005, freq: rnd(6000, 9000), amp: 0.38 });
  // The crunch after it.
  const tail = rnd(0.012, 0.034);
  const count = 2 + Math.floor(Math.random() * 7);
  for (let i = 0; i < count; i++) {
    clicks.push({
      at: 0.0015 + Math.pow(Math.random(), 0.8) * tail,
      len: rnd(0.0003, 0.0009),
      ring: rnd(0.0003, 0.0008),
      freq: rnd(3500, 10000),
      amp: 0.55 * rnd(0.18, 0.6),
    });
  }
  clicks.forEach((c) => (c.at += 0.001));
  playBuffer(renderClicks(clicks, 0.06), { gain: 0.9 * strength, hp: rnd(1600, 2400) });
  // A whisper of body so it still feels like foam, not plastic.
  thump(ctx.currentTime + 0.001, 210, 120, 0.05, 0.05 * strength);
}

export function soundLift() {
  if (!ctx) return;
  const clicks = [];
  const n = 8 + Math.floor(Math.random() * 10);
  for (let i = 0; i < n; i++) {
    clicks.push({ at: Math.random() * 0.1, len: rnd(0.0002, 0.0006), ring: 0.0003, freq: rnd(6000, 11000), amp: rnd(0.03, 0.09) });
  }
  playBuffer(renderClicks(clicks, 0.12), { gain: 0.5, hp: 3500 });
}

export function soundLand(strength) {
  if (!ctx || strength < 0.05) return;
  const s = Math.min(1, strength);
  thump(ctx.currentTime, 130, 60, 0.08, 0.12 * s);
  const clicks = [{ at: 0.001, len: 0.0009, ring: 0.0007, freq: rnd(2500, 4000), amp: 0.18 * s }];
  for (let i = 0; i < 3; i++) clicks.push({ at: rnd(0.003, 0.02), len: 0.0004, ring: 0.0004, freq: rnd(4000, 8000), amp: 0.05 * s });
  playBuffer(renderClicks(clicks, 0.04), { gain: 0.7, hp: 1200, lp: 9000 });
}

// Last piece in: the board settles with a run of soft crunches.
export function soundDone() {
  if (!ctx) return;
  for (let i = 0; i < 4; i++) setTimeout(() => soundSnap(0.35 - i * 0.06), 220 + i * 90);
}

// ─── Music: a slow generative felt piano ─────────────────────────────────
// Like Eno's tape loops: each voice repeats one note on its own long cycle,
// and the cycles never line up the same way twice. Soft, low, lots of air.
const NOTES = [
  // D major pentatonic plus a 7th, spread over three octaves.
  146.83, 220.0, 293.66, 329.63, 369.99, 440.0, 493.88, 554.37, 587.33, 739.99,
];
const LOOPS = [17.3, 21.1, 19.7, 23.9, 29.3, 31.7, 26.3];
let reverb = null;
let playing = false;
let timers = [];

function makeReverb() {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 4.5);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  conv.connect(wet).connect(musicBus);
  return conv;
}

function pianoNote(freq, vel) {
  const t = ctx.currentTime + 0.02;
  const dur = 5 + Math.random() * 2;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vel, t + 0.012);
  out.gain.setTargetAtTime(vel * 0.35, t + 0.012, 0.35);
  out.gain.setTargetAtTime(0.0001, t + 0.8, dur / 4);
  // Felt: the hammer's brightness fades fast.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(Math.min(4200, freq * 9), t);
  tone.frequency.setTargetAtTime(freq * 2.2, t, 0.25);
  const partials = [
    [1, 1, 'sine'],
    [2, 0.32, 'sine'],
    [3, 0.1, 'triangle'],
    [4.01, 0.05, 'sine'],
  ];
  for (const [mult, amp, type] of partials) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    o.detune.value = (Math.random() - 0.5) * 6;
    const g = ctx.createGain();
    g.gain.value = amp;
    o.connect(g).connect(tone);
    o.start(t);
    o.stop(t + dur + 1);
  }
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) pan.pan.value = (Math.random() - 0.5) * 0.7;
  tone.connect(out);
  (pan ? out.connect(pan) : out).connect(reverb);
  (pan || out).connect(musicBus);
}

export function startMusic() {
  if (!ctx || playing) return;
  playing = true;
  reverb = reverb || makeReverb();
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.16, ctx.currentTime, 1.5); // quiet: the clicks stay on top
  LOOPS.forEach((period, i) => {
    const note = NOTES[(i * 3 + Math.floor(Math.random() * NOTES.length)) % NOTES.length];
    const play = () => {
      if (!playing) return;
      pianoNote(note * (Math.random() < 0.15 ? 2 : 1), 0.06 + Math.random() * 0.04);
      timers[i] = setTimeout(play, period * 1000);
    };
    timers[i] = setTimeout(play, (1.2 + i * 2.7 + Math.random() * 3) * 1000);
  });
}

export function stopMusic() {
  if (!ctx || !playing) return;
  playing = false;
  timers.forEach(clearTimeout);
  timers = [];
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
}
