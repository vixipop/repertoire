/**
 * Time of day. The pond follows the viewer's local clock, blending between
 * the four looks around sunrise and sunset.
 */

import { TIMES, mixParams, type PondController, type PondParams, type TimeName } from "./swan-pond-engine";

export type Looks = Record<TimeName, PondParams>;

export const TIME_NAMES: TimeName[] = ["Dawn", "Day", "Dusk", "Dark"];

export const defaultLooks = (): Looks =>
  Object.fromEntries(TIMES.map((t) => [t.name, { ...t.params }])) as Looks;

// hour → look; between two different neighbours the looks crossfade
const KEYS: Array<[number, TimeName]> = [
  [0, "Dark"],
  [4.5, "Dark"],
  [5.8, "Dawn"],
  [7.4, "Dawn"],
  [8.5, "Day"],
  [16.8, "Day"],
  [18, "Dusk"],
  [19.6, "Dusk"],
  [20.8, "Dark"],
  [24, "Dark"],
];

export const TIME_HOURS: Record<TimeName, string> = {
  Dawn: "5–8am",
  Day: "8am–5pm",
  Dusk: "5–8pm",
  Dark: "8pm–5am",
};

export function lookAt(looks: Looks, date = new Date()): { params: PondParams; name: TimeName } {
  const h = date.getHours() + date.getMinutes() / 60;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, a] = KEYS[i];
    const [h1, b] = KEYS[i + 1];
    if (h >= h0 && h <= h1) {
      const u = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
      const t = u * u * (3 - 2 * u);
      return { params: a === b ? { ...looks[a] } : mixParams(looks[a], looks[b], t), name: t < 0.5 ? a : b };
    }
  }
  return { params: { ...looks.Day }, name: "Day" };
}

/** Keep the pond in step with the clock. Returns a function that stops it. */
export function followClock(ctl: PondController, getLooks: () => Looks, instant = true): () => void {
  ctl.setParams(lookAt(getLooks()).params, instant);
  const id = window.setInterval(() => ctl.setParams(lookAt(getLooks()).params), 30_000);
  return () => window.clearInterval(id);
}
