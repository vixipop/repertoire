"use client";

import { useEffect } from "react";

/**
 * Interface sounds, synthesised with Web Audio (no files, no library).
 *
 * A press on a link or button makes a small "tick": a 22ms burst of band-passed noise
 * with a short 1.9kHz sine blip. Moving the mouse onto one makes a quieter, higher
 * version. The sounds follow the reference site's: same filters, pitches, lengths and
 * gains.
 *
 * Rules:
 *  - the AudioContext is created and unlocked on the first press/key/touch, because
 *    browsers keep audio silent before that (so hovers before it are silent too);
 *  - hover is for a fine mouse only, not touch; moving within one link does nothing, and
 *    hovers closer than 90ms apart are skipped, so sweeping a list doesn't buzz;
 *  - phones that support it also get an 8ms haptic tap on press.
 */
const BURST_PRESS = { len: 0.022, decay: 0.0022, freq: 4800, q: 1.4, noise: 0.18, tone: 1900, toneGain: 0.045, toneLen: 0.025, out: 0.42 };
const BURST_HOVER = { len: 0.014, decay: 0.0016, freq: 5400, q: 1.8, noise: 0.14, tone: 2600, toneGain: 0.018, toneLen: 0.012, out: 0.38 };
const HOVER_GAP_MS = 90;
const TARGET = "a, button";

type Voice = typeof BURST_PRESS;

function tick(ctx: AudioContext, v: Voice) {
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = v.out;
  out.connect(ctx.destination);

  // the click itself: a very short decaying burst of noise, band-passed
  const n = Math.floor(v.len * ctx.sampleRate);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const tau = v.decay * ctx.sampleRate;
  for (let i = 0; i < n; i++) data[i] = (2 * Math.random() - 1) * Math.exp(-i / tau);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = v.freq;
  band.Q.value = v.q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(v.noise, t);
  env.gain.exponentialRampToValueAtTime(1e-4, t + v.len + 0.006);
  src.connect(band).connect(env).connect(out);
  src.start(t);
  src.stop(t + v.len + 0.008);

  // a faint pitched blip on top, so it reads as a tick rather than static
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = v.tone;
  const oenv = ctx.createGain();
  oenv.gain.setValueAtTime(1e-4, t);
  oenv.gain.exponentialRampToValueAtTime(v.toneGain, t + 0.001);
  oenv.gain.exponentialRampToValueAtTime(1e-4, t + v.toneLen);
  osc.connect(oenv).connect(out);
  osc.start(t);
  osc.stop(t + v.toneLen + 0.005);
}

export default function UiSounds() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let unlocked = false;
    let hovered: Element | null = null;
    let lastHover = 0;

    const context = () => {
      if (ctx) return ctx;
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return Ctor ? (ctx = new Ctor()) : null;
    };

    // Play one silent sample inside a gesture so iOS lets later sounds through.
    const unlock = (c: AudioContext) => {
      if (unlocked) return Promise.resolve();
      unlocked = true;
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
      return c.state === "suspended" ? c.resume().catch(() => {}) : Promise.resolve();
    };

    const onFirstGesture = () => {
      const c = context();
      if (c) void unlock(c);
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
      window.removeEventListener("touchstart", onFirstGesture, true);
    };

    const onPress = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!(e.target as Element | null)?.closest?.(TARGET)) return;
      const c = context();
      if (c) {
        const play = () => c.state === "running" && tick(c, BURST_PRESS);
        if (c.state === "running") play();
        else
          void Promise.resolve(unlock(c))
            .then(() => (c.state === "suspended" ? c.resume() : undefined))
            .then(play)
            .catch(() => {});
      }
      if (typeof navigator.vibrate === "function") navigator.vibrate(8);
    };

    const onOver = (e: PointerEvent) => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.(TARGET);
      if (!el || el === hovered) return;
      const now = performance.now();
      const quick = now - lastHover < HOVER_GAP_MS;
      hovered = el;
      lastHover = now;
      if (quick) return;
      if (ctx && ctx.state === "running") tick(ctx, BURST_HOVER);
    };

    const onOut = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(TARGET) === hovered) hovered = null;
    };

    window.addEventListener("pointerdown", onFirstGesture, true);
    window.addEventListener("keydown", onFirstGesture, true);
    window.addEventListener("touchstart", onFirstGesture, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
      window.removeEventListener("touchstart", onFirstGesture, true);
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      void ctx?.close();
    };
  }, []);

  return null;
}
