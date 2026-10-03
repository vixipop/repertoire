/**
 * Time-of-day look for the pond: dawn, day, dusk, dark.
 *
 * Each phase is a water palette (the two colours the caustics shader mixes
 * between) plus how brightly the swan sprites should read against it. The
 * clock walks through them continuously — colours are interpolated in linear
 * light between neighbouring keyframes, so there is never a visible step.
 *
 * "Day" is the pond exactly as it was tuned standalone (#0a1611 / #b0c58f);
 * the other three are derived from it.
 */

export type Phase = "dawn" | "day" | "dusk" | "dark";

type Look = {
  deep: string; // water colour where there are no caustics
  bright: string; // caustic highlights
  swanBrightness: number; // sprites are white photo cutouts — dim them to match the light
  swanSepia: number; // and warm them at the horizon hours
  light: number; // diffuse light on the water: 1 = as tuned (day), lower = darker floor
};

export const LOOKS: Record<Phase, Look> = {
  dark: { deep: "#04080c", bright: "#3f5d70", swanBrightness: 0.62, swanSepia: 0, light: 0.2 },
  dawn: { deep: "#0d2226", bright: "#f0b4ab", swanBrightness: 0.9, swanSepia: 0.12, light: 0.7 },
  day: { deep: "#0a1611", bright: "#b0c58f", swanBrightness: 1, swanSepia: 0, light: 1 },
  dusk: { deep: "#190f12", bright: "#e39455", swanBrightness: 0.82, swanSepia: 0.3, light: 0.7 },
};

/**
 * Keyframes on the 24h local clock. A phase "holds" between two entries with
 * the same name (day is flat 09:00–16:30, dark is flat 20:30–04:30) and eases
 * to the next phase between entries with different names.
 */
const KEYS: ReadonlyArray<{ hour: number; phase: Phase }> = [
  { hour: 0, phase: "dark" },
  { hour: 4.5, phase: "dark" },
  { hour: 6.5, phase: "dawn" },
  { hour: 9, phase: "day" },
  { hour: 16.5, phase: "day" },
  { hour: 18.5, phase: "dusk" },
  { hour: 20.5, phase: "dark" },
  { hour: 24, phase: "dark" },
];

/** Hours used by `?time=` so each phase can be previewed without waiting. */
const PREVIEW_HOUR: Record<Phase, number> = { dawn: 6.5, day: 12.5, dusk: 18.5, dark: 23 };

export type Resolved = {
  phase: Phase; // whichever keyframe is closer, for labelling
  deep: [number, number, number]; // linear RGB, as the shader expects
  bright: [number, number, number];
  swanBrightness: number;
  swanSepia: number;
  light: number;
  /** Plain CSS colour approximating what the shader will show for `deep`. */
  plate: string;
};

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Local hour as a fraction, honouring `?hour=18.5` and `?time=dusk` for previews. */
export function currentHour(search = ""): number {
  const params = new URLSearchParams(search);
  const forced = params.get("hour");
  if (forced !== null && forced.trim() !== "" && Number.isFinite(Number(forced))) {
    return ((Number(forced) % 24) + 24) % 24;
  }
  const named = params.get("time") as Phase | null;
  if (named && named in PREVIEW_HOUR) return PREVIEW_HOUR[named];
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function resolveLook(hour: number): Resolved {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(Math.min(1, Math.max(0, (hour - a.hour) / (b.hour - a.hour))));

  const la = LOOKS[a.phase];
  const lb = LOOKS[b.phase];
  const lerp3 = (x: string, y: string): [number, number, number] => {
    const p = hexToLinear(x);
    const q = hexToLinear(y);
    return [mix(p[0], q[0], t), mix(p[1], q[1], t), mix(p[2], q[2], t)];
  };

  const deep = lerp3(la.deep, lb.deep);
  const light = mix(la.light, lb.light, t);
  // What the shader actually shows for flat water: `deep` plus the ambient lift
  // (0.09 * the flat-surface diffuse term, 0.8018), through its sqrt() gamma.
  const lift = 0.09 * 0.8018 * light;
  const to8 = (v: number) => Math.round(Math.sqrt(Math.max(0, v + lift)) * 255);

  return {
    phase: t < 0.5 ? a.phase : b.phase,
    deep,
    bright: lerp3(la.bright, lb.bright),
    swanBrightness: mix(la.swanBrightness, lb.swanBrightness, t),
    swanSepia: mix(la.swanSepia, lb.swanSepia, t),
    light,
    plate: `rgb(${to8(deep[0])} ${to8(deep[1])} ${to8(deep[2])})`,
  };
}
