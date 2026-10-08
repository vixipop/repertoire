// Every sound is synthesised: no files to fetch, nothing to decode.
//
// The snap's rhythm is modelled on a recording of someone assembling a foam
// puzzle: one main tick, then a few quieter ones over the next ~30 ms. Its
// colour is deliberately softer than the recording's — muffled and smeared —
// so it sounds like foam settling, not tape tearing. Each sound is rendered
// fresh, so no two are identical.

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

// ─── Crunch: a buffer of soft ticks, rendered sample by sample ───────────
// Each tick is a smear of noise with a gentle attack and a few ms of decay:
// no tonal ring (that read as sticky tape), and the whole thing is muffled
// and given a little room, so it lands as a soft, blurred crunch.
function renderTicks(ticks, length) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.ceil(length * sr), sr);
  const out = buf.getChannelData(0);
  for (const c of ticks) {
    const start = Math.max(0, Math.floor(c.at * sr));
    const att = Math.max(1, c.attack * sr);
    const tau = c.decay * sr;
    const n = Math.min(out.length - start, Math.floor(att + tau * 6));
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const env = i < att ? i / att : Math.exp(-(i - att) / tau);
      // A one-pole low-pass per tick takes the fizz off each grain.
      lp += ((Math.random() * 2 - 1) - lp) * c.soft;
      out[start + i] += c.amp * env * lp;
    }
  }
  return buf;
}

let room = null;
function makeRoom() {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.35);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  conv.connect(wet).connect(sfx);
  return conv;
}

function playBuffer(buf, { gain = 1, hp = 250, lp = 3200 } = {}) {
  room = room || makeRoom();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const h = ctx.createBiquadFilter();
  h.type = 'highpass';
  h.frequency.value = hp;
  h.Q.value = 0.5;
  const l = ctx.createBiquadFilter();
  l.type = 'lowpass';
  l.frequency.value = lp;
  l.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(h).connect(l).connect(g);
  g.connect(sfx);
  g.connect(room);
  src.start(ctx.currentTime);
}

function thump(t, f0, f1, dur, gain) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function soundSnap(strength = 1) {
  if (!ctx) return;
  // The seat: one soft, full tick…
  const ticks = [{ at: 0.002, attack: rnd(0.0008, 0.0015), decay: rnd(0.003, 0.005), soft: rnd(0.35, 0.5), amp: 0.7 }];
  // …and a short, quiet crunch after it, like the foam settling.
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    ticks.push({ at: rnd(0.008, 0.03), attack: 0.001, decay: rnd(0.002, 0.004), soft: rnd(0.3, 0.45), amp: rnd(0.15, 0.3) });
  }
  playBuffer(renderTicks(ticks, 0.08), { gain: 0.85 * strength, lp: rnd(2600, 3400) });
  // Body: the foam's weight.
  thump(ctx.currentTime + 0.002, 180, 110, 0.07, 0.07 * strength);
}

export function soundLift() {
  if (!ctx) return;
  const ticks = [];
  const n = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    ticks.push({ at: Math.random() * 0.09, attack: 0.002, decay: 0.004, soft: 0.25, amp: rnd(0.03, 0.07) });
  }
  playBuffer(renderTicks(ticks, 0.12), { gain: 0.6, lp: 2400 });
}

export function soundLand(strength) {
  if (!ctx || strength < 0.05) return;
  const s = Math.min(1, strength);
  thump(ctx.currentTime, 120, 60, 0.09, 0.12 * s);
  const ticks = [{ at: 0.001, attack: 0.002, decay: 0.006, soft: 0.2, amp: 0.25 * s }];
  playBuffer(renderTicks(ticks, 0.05), { gain: 0.7, lp: 1600 });
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
