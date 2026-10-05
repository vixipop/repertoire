/**
 * Background music for the pond. The track plays through Web Audio so one
 * gain node sets the volume for both the speakers and the video recorder.
 * Browsers only allow sound after a click, so nothing starts until play().
 */

export type Music = {
  play(): Promise<void>;
  pause(): void;
  readonly playing: boolean;
  setVolume(v: number): void;
  /** Audio tracks to mix into a recording (empty until the music has started). */
  tracks(): MediaStreamTrack[];
  onChange(cb: () => void): () => void;
  destroy(): void;
};

export function createMusic(src: string, volume = 0.6): Music {
  const el = new Audio();
  el.src = src;
  el.loop = true;
  el.preload = "auto";
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let out: MediaStreamAudioDestinationNode | null = null;
  let level = volume;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((cb) => cb());
  el.addEventListener("play", changed);
  el.addEventListener("pause", changed);

  // wired up on the first play, inside the click that asked for it
  const wire = () => {
    if (ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const source = ctx.createMediaElementSource(el);
    gain = ctx.createGain();
    gain.gain.value = level;
    out = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(out);
  };

  return {
    async play() {
      wire();
      await ctx?.resume();
      await el.play();
    },
    pause() {
      el.pause();
    },
    get playing() {
      return !el.paused;
    },
    setVolume(v) {
      level = v;
      // ease it so dragging the slider doesn't click
      if (gain && ctx) gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    tracks() {
      return out ? out.stream.getAudioTracks() : [];
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    destroy() {
      el.pause();
      el.removeAttribute("src");
      void ctx?.close();
      listeners.clear();
    },
  };
}
