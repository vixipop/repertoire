// Every sound is synthesised: no files to fetch, nothing to decode.
// Foam doesn't click like card does — it goes "thup". So everything here is
// short, low-passed and quiet.

let ctx = null;
let out = null;
let noise = null;

export function wakeAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const jitter = (v, amt = 0.06) => v * (1 + (Math.random() - 0.5) * 2 * amt);

function burst(t, dur, type, freq, q, gain) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = jitter(1, 0.1);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = jitter(freq);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function thump(t, f0, f1, dur, gain) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(jitter(f0), t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function soundLift() {
  if (!ctx) return;
  const t = ctx.currentTime;
  burst(t, 0.06, 'bandpass', 1400, 0.8, 0.035);
}

export function soundLand(strength) {
  if (!ctx || strength < 0.05) return;
  const t = ctx.currentTime;
  const s = Math.min(1, strength);
  thump(t, 120, 55, 0.11, 0.22 * s);
  burst(t, 0.07, 'lowpass', 700, 0.7, 0.12 * s);
}

export function soundSnap() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // the knob pushing past the neck…
  burst(t, 0.03, 'bandpass', 900, 1.4, 0.1);
  // …and seating: a dull body thock with a little papery tick on top.
  thump(t + 0.028, 190, 95, 0.09, 0.32);
  burst(t + 0.028, 0.025, 'bandpass', 2600, 1.8, 0.16);
  burst(t + 0.03, 0.08, 'lowpass', 500, 0.7, 0.14);
}
