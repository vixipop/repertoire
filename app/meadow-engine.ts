/**
 * The meadow: a bright, cool day over rolling grassland. Fair-weather cumulus
 * drift overhead; their shadows sail across the hills; long grass bends in
 * waves of wind; white daisies grow in drifts; a few butterflies wander about
 * and settle on the flowers. The sun stands high to the front right, out of
 * frame, and its rays break through the gaps in the clouds.
 *
 * Passes:
 *  1. Clouds (reduced resolution): rays marched through a slab of 3D-noise
 *     cloud with light marched toward the sun, so tops glow and bases shade.
 *     Alpha carries how much open, sunlit sky each pixel sees, for the rays.
 *  2. Scene (full resolution, depth-tested): the cloud picture as backdrop,
 *     then the terrain mesh (rolling hills built once on the CPU, with ridge
 *     shadows marched toward the sun), ~60k instanced grass blades and flower
 *     stems bending in the wind, daisy heads and the butterflies. Ground and
 *     grass are darkened where cloud lies between them and the sun.
 *  3. Finish: soft upsample, bloom, light shafts (a radial blur of the open
 *     sky toward the sun), a clean grade, vignette, dither, and optionally the
 *     swan pond's brush dabs.
 *
 * Everything is in metres except the cloud slab, which is in kilometres.
 */

export type MeadowParams = {
  /** how much of the sky is cloud */
  cover: number;
  wind: number;
  /** how high the sun stands */
  sun: number;
  /** how golden the light is */
  warm: number;
  bloom: number;
  rays: number;
  /** the swan pond's brush dabs */
  paint: number;
  brush: number;
  /** how soft the paint is underneath the dabs */
  blur: number;
  /** how strongly the sunlit grass stands out from the shade */
  sunlight: number;
  /** fine grass strokes where the sun catches the grass */
  fuzz: number;
  /** how long those strokes are */
  blade: number;
  /** the blue of the sky overhead, as a colour (#rrggbb) */
  sky: string;
  skyDepth: number;
  /** how much rose the clouds catch */
  pink: number;
  /** the cows' own size, softening and brushwork */
  cowSize: number;
  cowBlur: number;
  cowPaint: number;
  /** sunlit grass: golden (0) to green (1) */
  grassSun: number;
  /** shaded grass: olive (0) to emerald (1) */
  grassShade: number;
  /** how rich the greens are */
  grassRich: number;
};

export const MEADOW_DEFAULTS: MeadowParams = {
  cover: 0.8,
  wind: 0.27,
  sun: 0.2,
  warm: 0.95,
  bloom: 0.15,
  rays: 0.45,
  paint: 0.6,
  brush: 0.23,
  blur: 0.3,
  sunlight: 0.2,
  fuzz: 0.87,
  blade: 1,
  sky: "#0a379f",
  skyDepth: 0.4,
  pink: 0.5,
  grassSun: 0.15,
  grassShade: 0.36,
  grassRich: 1,
  cowSize: 0.5,
  cowBlur: 0.35,
  cowPaint: 0.45,
};

export type MeadowController = {
  setParams(p: Partial<MeadowParams>): void;
  getParams(): MeadowParams;
  size(): { width: number; height: number };
  onFrame(cb: () => void): () => void;
  snapshot(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  setHighQuality(width: number | null): void;
  destroy(): void;
};

// ---- the camera and the land --------------------------------------------------

const EYE_HEIGHT = 1.6;
const PITCH = (1.5 * Math.PI) / 180;
const TAN_V = Math.tan((22 * Math.PI) / 180);
const NEAR = 0.3;
const FAR_CLIP = 9000;
/** the wind blows left to right, a little towards us */
const WIND_DIR: [number, number] = (() => {
  const x = 1;
  const z = -0.28;
  const l = Math.hypot(x, z);
  return [x / l, z / l];
})();

function hash2(x: number, z: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ground height in metres. The meadow falls gently away from us into a broad
 * hollow, a long ridge rises on the right, and low downs roll to the horizon. */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  let h = -9 * (1 - Math.exp(-Math.max(z, 0) / 220));
  // we stand on a low knoll, the meadow falling away in front
  h += 7 * Math.exp(-(r / 70) * (r / 70));
  h += 22 * (vnoise(x / 300 + 11.3, z / 300 + 4.1) - 0.5);
  h += 9 * (vnoise(x / 120 + 2.7, z / 120 + 9.2) - 0.5);
  h += 2.4 * (vnoise(x / 30 + 5.5, z / 30 + 1.9) - 0.5);
  h += 0.6 * (vnoise(x / 8 + 1.1, z / 8 + 7.7) - 0.5);
  // long banks lying across the sun's path: it lays bands of shadow behind them
  const bu = x * 0.78 - z * 0.63;
  const bv = x * 0.63 + z * 0.78;
  h += 3.6 * (vnoise(bu / 60 + 3.9, bv / 12 + 6.1) - 0.5) * smooth(4, 26, r);
  // the long ridge rising on the right, like a down seen end-on
  const across = (x - 150 - 0.45 * z) / 150;
  h += 55 * Math.exp(-across * across) * smooth(30, 360, z);
  // a rounded hill off to the left
  const lx = (x + 280 + 0.2 * z) / 220;
  const lz = (z - 750) / 420;
  h += 38 * Math.exp(-lx * lx - lz * lz);
  // the downs on the horizon
  h += 70 * (vnoise(x / 1400 + 3.3, z / 1400 + 8.8) - 0.3) * smooth(700, 2600, r);
  return h;
}

/** How far a grass blade's tip is pushed downwind, per metre of blade. */
function bendAt(x: number, z: number, t: number, rnd: number, amt: number) {
  const along = x * WIND_DIR[0] + z * WIND_DIR[1];
  const acrossW = x * -WIND_DIR[1] + z * WIND_DIR[0];
  const wave = 0.5 + 0.5 * Math.sin(along * 0.33 - t * 1.7) * (0.65 + 0.35 * Math.sin(acrossW * 0.07 + t * 0.3));
  return amt * (0.28 + 0.72 * wave) + 0.04 * Math.sin(t * 4.7 + rnd * 31);
}

// ---- shaders ------------------------------------------------------------------

const QUAD_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const TONE = `
vec3 tone(vec3 c) {
  c *= 0.95;
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}
`;

// the cloud field, shared by the sky and by every surface the clouds shade
const CLOUD_LIB = `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uWind;
uniform float uCover;
uniform vec3 uSunCol;
const float BASE = 1.5;
const float TOP = 3.3;
const float SIG = 20.0;

float n3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = p.xy + vec2(37.0, 17.0) * p.z + f.xy;
  vec2 rg = texture2D(uNoise, (uv + 0.5) / 256.0).xy;
  return mix(rg.x, rg.y, f.z);
}
float fbm3(vec3 p) {
  return n3(p) * 0.53 + n3(p * 2.02 + 3.1) * 0.29 + n3(p * 4.07 + 7.7) * 0.18;
}

// the big shapes only: where the clouds are, before their billows
float coarse(vec3 p, float h) {
  vec3 q = p + uWind;
  float clump = n3(vec3(q.x * 0.045, 1.7, q.z * 0.045));
  float cov = uCover + (clump - 0.5) * 0.55;
  float s = fbm3(q * vec3(0.42, 0.6, 0.42) + vec3(0.0, 0.0, uTime * 0.004));
  s += (1.0 - abs(n3(q * 1.1 + 2.0) * 2.0 - 1.0)) * 0.12 - 0.06;
  float d = s - (1.0 - cov) - h * h * 0.3;
  return d * smoothstep(0.0, 0.12, h);
}

float density(vec3 p, bool full) {
  float h = (p.y - BASE) / (TOP - BASE);
  if (h < 0.0 || h > 1.0) return 0.0;
  float d = coarse(p, h);
  if (d <= 0.0) return 0.0;
  if (full) {
    vec3 dq = (p + uWind) * 2.4 + vec3(uTime * 0.012, -uTime * 0.008, 0.0);
    float b1 = abs(n3(dq) * 2.0 - 1.0);
    float b2 = abs(n3(dq * 2.3 + 4.1) * 2.0 - 1.0);
    float b3 = abs(n3(dq * 5.1 + 9.3) * 2.0 - 1.0);
    float det = 1.0 - (b1 * 0.55 + b2 * 0.3 + b3 * 0.15);
    d = (d - det * (0.16 + 0.07 * h)) / (1.0 - det * 0.2);
  }
  return clamp(d * 5.5, 0.0, 1.0);
}

// how much sunlight gets through the clouds to a point on the ground (metres)
float cloudShadow(vec3 pw) {
  vec3 p = pw * 0.001;
  float od = 0.0;
  for (int i = 0; i < 2; i++) {
    float y = BASE + 0.35 + float(i) * 0.6;
    vec3 c = p + uSun * ((y - p.y) / uSun.y);
    // a soft edge, the penumbra of a cloud two kilometres up
    od += smoothstep(-0.03, 0.07, coarse(c, (y - BASE) / (TOP - BASE))) * 0.7;
  }
  // and the small puffs' shadows, chasing across the fields on the same wind
  vec2 sq = (p.xz + uSun.xz * (2.0 / uSun.y) + uWind.xz) * 1.6;
  float small = fbm3(vec3(sq.x, uTime * 0.01, sq.y));
  od += smoothstep(0.52, 0.62, small) * 0.8;
  return mix(0.24, 1.0, exp(-od * 2.6));
}
`;

const SKY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform float uTanV;
uniform float uAspect;
uniform vec3 uSkyTop;
uniform vec3 uSkyHor;
uniform float uPink;
${CLOUD_LIB}
${TONE}

float hg(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
}

vec3 skyCol(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 c = mix(uSkyHor, uSkyTop, pow(y, 0.45));
  float mu = max(dot(rd, uSun), 0.0);
  c += uSunCol * (pow(mu, 6.0) * 0.12 + pow(mu, 40.0) * 0.45);
  // the horizon pales, warming toward the sun
  vec3 hz = mix(vec3(0.82, 0.88, 0.96), uSunCol * vec3(1.0, 0.88, 0.8), pow(mu, 2.5) * 0.6);
  c = mix(c, hz, exp(-y * 16.0) * 0.5);
  return c;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uRight * ndc.x * uTanV * uAspect + uUp * ndc.y * uTanV + uFwd);
  vec3 sky = skyCol(rd);
  vec3 col = sky;
  float open = 1.0;
  if (rd.y > 0.004) {
    float t0 = BASE / rd.y;
    float t1 = min(TOP / rd.y, 260.0);
    if (t0 < 260.0) {
      const int N = 40;
      float ds = (t1 - t0) / float(N);
      // a scattered start for each pixel, so the steps leave no pattern
      vec2 jp = fract(gl_FragCoord.xy * vec2(0.1031, 0.1030));
      jp += dot(jp, jp.yx + 33.33);
      float jit = fract((jp.x + jp.y) * jp.x);
      float t = t0 + ds * jit;
      float mu = dot(rd, uSun);
      float phase = mix(hg(mu, 0.6), hg(mu, -0.2), 0.45);
      vec3 sunCol = uSunCol * 1.9;
      vec3 acc = vec3(0.0);
      vec3 accSun = vec3(0.0);
      float T = 1.0;
      float firstHit = -1.0;
      for (int i = 0; i < N; i++) {
        vec3 p = rd * t;
        float d = density(p, true);
        if (d > 0.003) {
          if (firstHit < 0.0) firstHit = t;
          float od = 0.0;
          vec3 lp = p;
          float ls = 0.1;
          for (int j = 0; j < 5; j++) {
            lp += uSun * ls;
            od += density(lp, j < 2) * ls;
            ls *= 1.6;
          }
          float h = (p.y - BASE) / (TOP - BASE);
          float direct = exp(-od * SIG) + exp(-od * SIG * 0.18) * 0.38;
          float powder = 1.0 - exp(-d * 6.0);
          vec3 amb = mix(vec3(0.5, 0.45, 0.62), vec3(0.66, 0.68, 0.88), smoothstep(0.0, 0.8, h)) * 0.95;
          vec3 Sd = sunCol * direct * phase * mix(0.55, 1.0, powder);
          vec3 S = Sd + amb;
          float a = 1.0 - exp(-d * SIG * ds);
          acc += T * a * S;
          accSun += T * a * Sd;
          T *= 1.0 - a;
          if (T < 0.02) break;
        }
        t += ds;
      }
      float far = firstHit < 0.0 ? t0 : firstHit;
      // only the clouds' light goes through the film curve: the blue stays deep
      vec3 cl = tone(acc);
      // where the sun strikes the cloud, it is gilded: golden, as the light is
      float gilt = clamp(dot(accSun, vec3(0.33)) / (dot(acc, vec3(0.33)) + 1e-3), 0.0, 1.0);
      float warmth = clamp((0.95 - uSunCol.b) / 0.6, 0.0, 1.0);
      vec3 peach = vec3(1.06, 0.72, 0.5);
      vec3 rose = vec3(1.07, 0.76, 0.8);
      vec3 gold = vec3(1.1, 0.88, 0.42);
      // gold where the sun strikes square, peach and rose where it glances
      vec3 tint = mix(mix(peach, rose, uPink), peach, smoothstep(0.35, 0.6, gilt));
      tint = mix(tint, gold, smoothstep(0.5, 0.88, gilt));
      cl *= mix(vec3(1.0), tint, smoothstep(0.2, 0.75, gilt) * warmth);
      // rose where the light glances: through the cloud's middle tones and on its rims
      float glance = smoothstep(0.08, 0.4, gilt) * (1.0 - smoothstep(0.65, 0.95, gilt));
      cl = mix(cl, cl * vec3(1.1, 0.8, 0.92) + vec3(0.03, 0.0, 0.02), uPink * (0.25 + 0.75 * glance));
      // the undersides go lavender in the warm light
      cl = mix(cl, cl * vec3(0.98, 0.92, 1.06), (1.0 - smoothstep(0.1, 0.5, gilt)) * warmth * 0.3);
      // a little air in front of the farther ones...
      float air = 1.0 - exp(-far * 0.02);
      cl = mix(cl, (1.0 - T) * mix(sky, vec3(0.9, 0.92, 0.97), 0.45), air * 0.45);
      // ...and past a certain distance they simply give way to clear sky,
      // rather than thinning into a hazy band along the horizon
      float vanish = smoothstep(12.0, 30.0, far);
      col = mix(sky * T + cl, sky, vanish);
      open = mix(T, 1.0, vanish);
    }
  }
  // alpha: open sky toward the sun, where the rays come from
  float glow = pow(max(dot(rd, uSun), 0.0), 1.6);
  gl_FragColor = vec4(col, 0.5 * open * glow);
}
`;

// the cloud picture, laid behind the land
const BACK_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform vec2 uSkyPx;
void main() {
  vec4 c = texture2D(uSky, vUv) * 0.4;
  c += texture2D(uSky, vUv + uSkyPx * vec2(1.1, 0.4)) * 0.15;
  c += texture2D(uSky, vUv + uSkyPx * vec2(-0.4, 1.1)) * 0.15;
  c += texture2D(uSky, vUv + uSkyPx * vec2(-1.1, -0.4)) * 0.15;
  c += texture2D(uSky, vUv + uSkyPx * vec2(0.4, -1.1)) * 0.15;
  gl_FragColor = c;
}
`;

const SURFACE_LIB = `
uniform vec3 uEye;
uniform sampler2D uShadow;
uniform vec4 uGrid;
uniform float uSunI;
uniform vec3 uHaze;

// the ridges' shadows, marched once on the CPU over a polar grid round the eye
float ridgeShadow(vec3 w) {
  vec2 d = w.xz - uEye.xz;
  float r = max(length(d), 0.5);
  float a = atan(d.x, d.y);
  vec2 uv = vec2((a - uGrid.x) / uGrid.y, (log(r) - uGrid.z) / uGrid.w);
  return texture2D(uShadow, clamp(uv, 0.0, 1.0)).r;
}

vec3 sunLight() { return uSunCol * uSunI; }
vec3 skyLight(float up) { return mix(vec3(0.26, 0.34, 0.48), vec3(0.36, 0.52, 0.8), up) * 0.55; }

// air between the eye and a point: pale blue haze, warm toward the sun
vec3 aerial(vec3 col, vec3 w) {
  vec3 v = w - uEye;
  float dist = length(v);
  vec3 rd = v / dist;
  float mu = max(dot(rd, uSun), 0.0);
  vec3 haze = mix(uHaze, uSunCol * 0.95, pow(mu, 4.0) * 0.55);
  float f = 1.0 - exp(-dist / 1500.0);
  return mix(col, haze, f * 0.9);
}
`;

const TERRAIN_VERT = `
attribute vec3 aPos;
attribute vec3 aNrm;
uniform mat4 uVP;
varying vec3 vW;
varying vec3 vN;
void main() {
  vW = aPos;
  vN = aNrm;
  gl_Position = uVP * vec4(aPos, 1.0);
}
`;

const TERRAIN_FRAG = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
uniform float uWindAmt;
uniform vec2 uWindDir;
uniform float uPix;
uniform vec3 uGrassSun;
uniform vec3 uGrassShade;
uniform float uFuzz;
uniform float uSunlight;
${CLOUD_LIB}
${SURFACE_LIB}

float h2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec3 N = normalize(vN);
  vec2 xz = vW.xz;
  float dist = length(vW - uEye);
  float foot = dist * uPix;
  // how much sun reaches this grass: the low sun picks out every slope
  float lam = clamp(dot(N, uSun) * 2.6 - 0.12, 0.0, 1.0);
  float light = lam * ridgeShadow(vW) * cloudShadow(vW);
  float lit = smoothstep(0.12, 0.5, light);

  // the grass is painted in two colours, sun and shade, each with its patches
  float patch = vn(xz * 0.022 + 3.0) * 0.6 + vn(xz * 0.1 + 7.0) * 0.4;
  vec3 sunG = uGrassSun * (0.88 + 0.28 * patch);
  // the low sun gilds the grass it reaches
  sunG = mix(sunG, sunG * vec3(1.08, 0.98, 0.7), clamp((0.95 - uSunCol.b) / 0.7, 0.0, 1.0) * 0.35);
  vec3 shadeG = uGrassShade * (0.82 + 0.36 * patch);
  // the wind's waves pass as a sheen over the sunlit grass
  float along = dot(xz, uWindDir);
  float across = dot(xz, vec2(-uWindDir.y, uWindDir.x));
  float wave = 0.5 + 0.5 * sin(along * 0.33 - uTime * 1.7) * (0.65 + 0.35 * sin(across * 0.07 + uTime * 0.3));
  sunG *= 1.0 + (wave - 0.5) * 0.22 * uWindAmt * 2.0;
  // how far the sun lifts the grass from its shade
  vec3 col = mix(shadeG, sunG, lit * (0.2 + 0.8 * uSunlight));
  // where the light just reaches, a faint warm edge
  col += uSunCol * 0.04 * uSunlight * lit * (1.0 - lit) * 4.0;

  // fuzz: only where the sun catches it, fading as it shrinks below a pixel
  float fur = vn(xz * 9.0 + 1.0) * 0.45 + vn(xz * 23.0 + 5.0) * 0.35 + vn(xz * 55.0) * 0.2;
  float fade = 1.0 - smoothstep(0.015, 0.2, foot);
  col *= 1.0 + (fur - 0.5) * 1.1 * uFuzz * lit * fade;
  // and backlit, the fur glows
  vec3 V = normalize(uEye - vW);
  float back = pow(max(dot(-V, uSun), 0.0), 3.0);
  col += uSunCol * 0.4 * back * lit * uFuzz * uSunlight * (0.25 + 0.5 * fur * fade);

  // drifts of small white flowers, specks while they're big enough, then a haze of white
  float drift = smoothstep(0.45, 0.75, vn(xz * 0.04 + 21.0));
  vec2 cell = floor(xz / 0.5);
  vec2 fp = (cell + vec2(h2(cell), h2(cell + 3.7))) * 0.5;
  float fsize = 0.04;
  float speck = (1.0 - smoothstep(fsize * 0.6, fsize + foot, length(xz - fp))) * step(h2(cell + 9.1), drift * 0.75 + 0.04);
  float flowers = mix(speck, drift * 0.08, smoothstep(fsize * 2.0, fsize * 6.0, foot));
  col = mix(col, mix(vec3(0.74, 0.78, 0.86), vec3(1.0, 0.98, 0.9), lit), flowers);

  // however strong the sun, lit grass stays grass: the brightest greens are
  // eased back toward a soft, warm light instead of clipping to neon
  float lumG = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, vec3(lumG) * vec3(1.02, 1.0, 0.88), smoothstep(0.55, 0.95, lumG) * 0.35);
  col = min(col, vec3(0.86, 0.9, 0.7));
  col = aerial(col, vW);
  // alpha above a half marks grass for the fuzz: how near, and how sunlit
  float near = 1.0 - smoothstep(150.0, 900.0, dist);
  gl_FragColor = vec4(col, 0.5 + 0.5 * near * (0.4 + 0.6 * lit));
}
`;

// daisy heads: little upturned discs, always facing us
const FLOWER_VERT = `
attribute vec2 aCorner;
attribute vec3 aRoot;
attribute vec4 aBlade;
uniform mat4 uVP;
uniform vec3 uEye;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindAmt;
varying vec2 vQ;
varying vec3 vW;
varying float vSeed;

float bendAt(vec2 xz, float t, float rnd) {
  float along = dot(xz, uWindDir);
  float across = dot(xz, vec2(-uWindDir.y, uWindDir.x));
  float wave = 0.5 + 0.5 * sin(along * 0.33 - t * 1.7) * (0.65 + 0.35 * sin(across * 0.07 + t * 0.3));
  return uWindAmt * (0.28 + 0.72 * wave) + 0.04 * sin(t * 4.7 + rnd * 31.0);
}

void main() {
  float h = aBlade.x;
  float ang = aBlade.z;
  float rnd = fract(aBlade.w);
  vec2 face = vec2(cos(ang), sin(ang));
  float b = bendAt(aRoot.xz, uTime, rnd);
  float lean = (0.1 + 0.3 * fract(rnd * 7.31)) * 0.3;
  vec2 off = (uWindDir * b + face * lean) * h;
  float y = h * (1.0 - 0.3 * dot(off, off) / (h * h + 1e-4));
  vec3 c = aRoot + vec3(off.x, y, off.y);
  float size = 0.04 + 0.025 * fract(rnd * 3.7);
  vec3 p = c + uCamRight * aCorner.x * size + uCamUp * aCorner.y * size * 0.62;
  vQ = aCorner;
  vW = c;
  vSeed = rnd;
  gl_Position = uVP * vec4(p, 1.0);
}
`;

const FLOWER_FRAG = `
precision highp float;
varying vec2 vQ;
varying vec3 vW;
varying float vSeed;
${CLOUD_LIB}
${SURFACE_LIB}
${TONE}
void main() {
  float r = length(vQ);
  float th = atan(vQ.y, vQ.x);
  float petals = 0.62 + 0.38 * pow(abs(cos(th * 4.5 + vSeed * 20.0)), 0.5);
  if (r > petals) discard;
  float sh = ridgeShadow(vW) * cloudShadow(vW);
  vec3 white = vec3(0.98, 0.97, 0.93) * mix(0.82, 1.0, smoothstep(0.2, 0.7, r));
  vec3 centre = vec3(0.95, 0.72, 0.12);
  vec3 alb = r < 0.24 ? centre : white;
  vec3 col = alb * (sunLight() * 0.9 * sh + skyLight(1.0));
  col = aerial(col, vW);
  gl_FragColor = vec4(tone(col), 0.0);
}
`;

// butterflies: wings as quads hinged on the body, shaped in the fragment shader
const FLY_VERT = `
attribute vec3 aPos;
attribute vec3 aInfo;
uniform mat4 uVP;
varying vec2 vQ;
varying float vKind;
varying vec3 vW;
void main() {
  vQ = aInfo.xy;
  vKind = aInfo.z;
  vW = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}
`;

const FLY_FRAG = `
precision highp float;
varying vec2 vQ;
varying float vKind;
varying vec3 vW;
${CLOUD_LIB}
${SURFACE_LIB}
${TONE}
void main() {
  // kind: 0..2 = a wing of butterfly 0..2, 10+ = a body
  if (vKind >= 10.0) {
    if (length(vQ * vec2(1.0, 0.25)) > 0.25) discard;
    gl_FragColor = vec4(tone(vec3(0.05, 0.045, 0.04) + skyLight(1.0) * 0.05), 0.0);
    return;
  }
  // x: out from the body, y: along it (front positive)
  vec2 q = vQ;
  float fore = length((q - vec2(0.52, 0.32)) / vec2(0.54, 0.4));
  float hind = length((q - vec2(0.38, -0.34)) / vec2(0.42, 0.36));
  float m = min(fore, hind);
  if (m > 1.0) discard;
  vec3 cream = vec3(0.98, 0.97, 0.9);
  vec3 lemon = vec3(0.98, 0.92, 0.52);
  vec3 base = vKind < 1.5 ? cream : lemon;
  if (vKind < 0.5) base = mix(cream, vec3(0.9, 0.94, 1.0), 0.4);
  // dusky wing tips and a soft dot, the way cabbage whites are marked
  float tipDark = smoothstep(0.55, 0.85, fore) * step(fore, 1.0) * smoothstep(0.45, 0.8, q.y);
  base = mix(base, vec3(0.32, 0.31, 0.33), tipDark * (vKind < 1.5 ? 0.7 : 0.15));
  float dotm = 1.0 - smoothstep(0.06, 0.09, length(q - vec2(0.55, 0.22)));
  base = mix(base, vec3(0.3, 0.3, 0.32), dotm * (vKind < 1.5 ? 0.6 : 0.0));
  base *= mix(0.86, 1.0, smoothstep(0.0, 0.4, q.x));
  float sh = ridgeShadow(vW) * cloudShadow(vW);
  vec3 V = normalize(uEye - vW);
  // the thin wings glow when the sun is behind them
  float trans = pow(max(dot(-V, uSun), 0.0), 2.0) * 0.6;
  vec3 col = base * (sunLight() * (0.75 + trans) * sh + skyLight(1.0) * 1.1);
  col = aerial(col, vW);
  gl_FragColor = vec4(tone(col), 0.0);
}
`;

// cows, far off on the hills: little figures painted in a billboard, standing
// upright on the ground, drawn into their own layer
const COW_VERT = `
attribute vec2 aCorner;
attribute vec3 aRoot;
attribute vec4 aCow;
uniform mat4 uVP;
uniform vec3 uCamRight;
uniform float uCowScale;
varying vec2 vQ;
varying vec4 vCow;
varying vec3 vW;
void main() {
  // the quad in a cow's metres: three wide, from just under the hooves to
  // above the back; drawn as large as asked
  vec2 q = vec2(aCorner.x * 1.5, mix(-0.25, 1.9, aCorner.y * 0.5 + 0.5));
  // facing in the sign, the cow's own scale (it grows with distance) in the size
  float sc = abs(aCow.x) * uCowScale;
  vec3 p = aRoot + (uCamRight * q.x + vec3(0.0, q.y, 0.0)) * sc;
  vQ = vec2(q.x * sign(aCow.x), q.y);
  vCow = aCow;
  vW = aRoot + vec3(0.0, 0.8 * sc, 0.0);
  gl_Position = uVP * vec4(p, 1.0);
}
`;

const COW_FRAG = `
precision highp float;
varying vec2 vQ;
varying vec4 vCow;
varying vec3 vW;
${CLOUD_LIB}
${SURFACE_LIB}
${TONE}
float cap(vec2 q, vec2 a, vec2 b, float r) {
  vec2 pa = q - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float h2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 q = vQ;
  float pose = vCow.y;
  float variant = vCow.z;
  float seed = vCow.w;
  // body, legs, neck and head (front of the cow is +x), a swishing tail
  float body = (length((q - vec2(0.0, 1.0)) / vec2(0.82, 0.36)) - 1.0) * 0.36;
  float legs = min(min(cap(q, vec2(0.52, 0.75), vec2(0.55, 0.0), 0.07), cap(q, vec2(0.36, 0.75), vec2(0.34, 0.0), 0.065)),
                   min(cap(q, vec2(-0.5, 0.75), vec2(-0.53, 0.0), 0.075), cap(q, vec2(-0.64, 0.8), vec2(-0.62, 0.0), 0.065)));
  vec2 head = mix(vec2(1.02, 0.3), vec2(1.1, 1.22), pose);
  float neck = cap(q, vec2(0.66, 1.05), head + vec2(-0.14, 0.04), mix(0.15, 0.17, pose));
  float hd = (length((q - head) / vec2(0.23, 0.15)) - 1.0) * 0.15;
  float ears = (length((q - head - vec2(-0.12, 0.14)) / vec2(0.09, 0.04)) - 1.0) * 0.04;
  float sway = sin(uTime * 2.3 + seed * 17.0) * 0.06;
  float tail = cap(q, vec2(-0.8, 1.18), vec2(-0.9 + sway, 0.5), 0.025);
  float d = min(min(min(body, legs), min(neck, hd)), min(ears, tail));
  float a = 1.0 - smoothstep(-0.035, 0.035, d);
  // hooves lost in the grass
  a *= smoothstep(0.0, 0.24, q.y + 0.06 * sin(q.x * 31.0 + seed * 11.0));

  // coat
  vec3 alb;
  if (variant < 1.0) alb = vn(q * 3.2 + seed * 13.0) > 0.52 ? vec3(0.07, 0.065, 0.07) : vec3(0.92, 0.9, 0.86);
  else if (variant < 2.0) alb = vec3(0.45, 0.26, 0.15);
  else if (variant < 3.0) alb = vec3(0.86, 0.79, 0.66);
  else alb = vec3(0.12, 0.1, 0.1);
  if (legs < 0.0 && body > 0.0) alb *= 0.8;
  // rounded: lit on the sunward top, shaded beneath
  vec2 n = (q - vec2(0.0, 1.0)) / vec2(0.82, 0.36);
  float round = clamp(0.55 + 0.45 * n.y + 0.2 * n.x * sign(uSun.x + 1e-4), 0.0, 1.0);
  float sh = ridgeShadow(vW) * cloudShadow(vW);
  vec3 col = alb * (sunLight() * mix(0.35, 1.0, round) * sh + skyLight(0.8) * 1.1);
  col = aerial(tone(col), vW);

  // the patch of shade the cow stands in
  float ground = (1.0 - smoothstep(0.3, 1.0, length(q / vec2(1.05, 0.13)))) * 0.32;
  float alpha = a + ground * (1.0 - a);
  gl_FragColor = vec4(col * a, alpha);
}
`;

// a soft separable blur, run at half size, for the paint to be picked up from
const BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uStep;
void main() {
  vec4 c = texture2D(uSrc, vUv) * 0.2270270;
  c += (texture2D(uSrc, vUv + uStep * 1.3846154) + texture2D(uSrc, vUv - uStep * 1.3846154)) * 0.3162162;
  c += (texture2D(uSrc, vUv + uStep * 3.2307692) + texture2D(uSrc, vUv - uStep * 3.2307692)) * 0.0702703;
  gl_FragColor = c;
}
`;

// The swan pond's impressionist pass: the frame re-laid as overlapping brush
// dabs, each one colour picked up from a softened copy of the picture, nudged
// warm or cool; then bloom, light shafts, Monet's palette and canvas grain.
const FINISH_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uSoftTex;
uniform vec2 uRes;
uniform vec2 uSunUv;
uniform float uBloom;
uniform float uRays;
uniform float uPaint;
uniform float uBrush;
uniform float uBlur;
uniform float uScale;
uniform float uTime;
uniform float uFuzz;
uniform float uBlade;
uniform sampler2D uCow;
uniform sampler2D uCowSoft;
uniform float uCowBlur;
uniform float uCowPaint;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 uvOf(vec2 p) { return clamp(vec2(p.x, uRes.y - p.y) / uRes, 0.001, 0.999); }
vec3 sharp(vec2 p) { return texture2D(uScene, uvOf(p)).rgb; }
vec3 softc(vec2 p) { return texture2D(uSoftTex, uvOf(p)).rgb; }
// what the brush picks up: the picture, softened as far as asked
vec3 src(vec2 p) { return mix(sharp(p), softc(p), uBlur); }

vec4 dabs(vec2 p, float size, float seed) {
  vec2 id = floor(p / size);
  float best = -1.0;
  vec3 col = vec3(0.0);
  float cover = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = id + vec2(float(i), float(j));
      vec2 h = vec2(hash(c + seed), hash(c + seed + 17.31));
      vec2 centre = (c + 0.5 + (h - 0.5) * 0.9) * size;
      // strokes run mostly level, swirling gently, as on the pond
      float ang = (hash(c + seed + 3.1) - 0.5) * 0.55 + sin(centre.y * 0.013 / uScale + centre.x * 0.004 / uScale) * 0.35;
      vec2 d = p - centre;
      vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
      float len = size * (1.1 + 0.9 * h.x);
      float wid = size * (0.32 + 0.2 * h.y);
      float m = 1.0 - length(r / vec2(len, wid));
      m += (hash(vec2(floor(r.y / size * 7.0), c.x + c.y * 31.0 + seed)) - 0.5) * 0.22;
      if (m > 0.0) {
        float pri = hash(c + seed + 9.7) + m * 0.5;
        if (pri > best) {
          best = pri;
          vec3 s = src(centre + vec2(cos(ang), sin(ang)) * r.x * 0.35);
          float k = hash(c + seed + 5.5);
          vec3 cool = vec3(-0.03, 0.0, 0.07);
          vec3 warm = vec3(0.05, 0.05, -0.04);
          s += k < 0.33 ? cool : (k > 0.72 ? warm : vec3(0.0));
          s *= 0.92 + 0.16 * hash(c + seed + 2.2);
          col = s;
          cover = smoothstep(0.0, 0.3, m);
        }
      }
    }
  }
  return vec4(col, cover);
}

// the cows' layer (colour premultiplied by alpha), softened as far as asked
vec4 cowAt(vec2 p) { vec2 uv = uvOf(p); return mix(texture2D(uCow, uv), texture2D(uCowSoft, uv), uCowBlur); }

// the cows get their own, smaller brush
vec4 cowDabs(vec2 p, float size) {
  vec2 id = floor(p / size);
  float best = -1.0;
  vec4 col = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = id + vec2(float(i), float(j));
      vec2 h = vec2(hash(c + 71.0), hash(c + 88.3));
      vec2 centre = (c + 0.5 + (h - 0.5) * 0.9) * size;
      float ang = (hash(c + 13.1) - 0.5) * 1.2;
      vec2 d = p - centre;
      vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
      float m = 1.0 - length(r / vec2(size * (0.9 + 0.6 * h.x), size * (0.4 + 0.2 * h.y)));
      if (m > 0.0) {
        float pri = hash(c + 19.7) + m * 0.5;
        if (pri > best) {
          best = pri;
          col = cowAt(centre + vec2(cos(ang), sin(ang)) * r.x * 0.35) * smoothstep(0.0, 0.3, m);
        }
      }
    }
  }
  return col;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 base = src(p);

  float big = (4.0 + uBrush * 9.0) * uScale;
  float small = big * 0.42;
  vec4 d1 = dabs(p, big, 0.0);
  vec4 d2 = dabs(p + big * 0.5, big * 0.8, 31.0);
  vec4 d3 = dabs(p, small, 57.0);
  vec3 painted = mix(mix(base, d2.rgb, d2.a), d1.rgb, d1.a);
  // finer strokes only where there are real edges (a butterfly, the horizon)
  float e = 1.5 * uScale;
  float edge = length(softc(p + vec2(e, 0.0)) - softc(p - vec2(e, 0.0))) + length(softc(p + vec2(0.0, e)) - softc(p - vec2(0.0, e)));
  float detail = smoothstep(0.08, 0.35, edge);
  painted = mix(painted, mix(base, d3.rgb, d3.a * 0.85), detail);
  vec3 col = mix(base, painted, uPaint);

  // grass fuzz: soft, tapering, gently curving blades leaning with the wind,
  // painted as a lighter or deeper shade of the grass they stand in; strongest
  // where the sun is on it, longer and broader toward us
  float ga = texture2D(uScene, uvOf(p)).a;
  float grassAmt = ga > 0.5 ? (ga - 0.5) * 2.0 : 0.0;
  if (uFuzz > 0.001 && grassAmt > 0.01) {
    float persp = mix(1.6, 0.75, vUv.y);
    float cell = 3.0 * uScale * persp;
    float len = cell * (0.8 + uBlade * 4.5);
    float lift = 0.0;
    float deep = 0.0;
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      vec2 off = vec2(0.37, 0.61) * cell * fl;
      vec2 gid = floor((p + off) / cell);
      for (int j = -6; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 c = gid + vec2(float(i), float(j));
          vec2 h = vec2(hash(c + 3.7 + fl * 11.0), hash(c + 8.1 + fl * 5.0));
          float h3 = hash(c + 2.9 + fl * 7.0);
          vec2 root = (c + h) * cell - off;
          // every blade leans downwind, each a little differently, and sways
          float lean = 0.32 + (h3 - 0.5) * 0.35 + sin(uTime * 1.6 + root.x * 0.05 + h.y * 6.0) * 0.1;
          vec2 dir = vec2(sin(lean), -cos(lean));
          vec2 perp = vec2(-dir.y, dir.x);
          vec2 d = p - root;
          float along = dot(d, dir);
          float bl = len * (0.45 + 0.55 * h.y);
          if (along > 0.0 && along < bl) {
            float u = along / bl;
            // it curves over as it rises
            float bend = (0.12 + 0.18 * h3) * bl * u * u;
            float across = abs(dot(d, perp) - bend);
            float w = mix(1.1, 0.25, u) * uScale * min(persp, 1.3);
            float m = (1.0 - smoothstep(0.0, w, across)) * smoothstep(0.0, 0.15, u) * (1.0 - 0.5 * u);
            if (h.x > 0.35) lift = max(lift, m * (0.4 + 0.6 * u));
            else deep = max(deep, m);
          }
        }
      }
    }
    float sunny = smoothstep(0.55, 0.95, grassAmt);
    float k = uFuzz * min(1.0, grassAmt * 2.0);
    // lighter blades: a paler, slightly warmer shade, never a hard white
    vec3 light = mix(col, col * vec3(1.12, 1.12, 0.95) + vec3(0.03, 0.04, 0.0), 0.5 + 0.5 * sunny);
    // deeper blades: the green between them, never black
    vec3 dark = col * vec3(0.82, 0.9, 0.85);
    col = mix(col, light, lift * k * 0.75);
    col = mix(col, dark, deep * k * 0.5);
  }

  // the cows, laid over the painted grass
  vec4 cow = cowAt(p);
  if (uCowPaint > 0.001) {
    vec4 cd = cowDabs(p, (2.2 + uBrush * 3.0) * uScale);
    cow = mix(cow, max(cow, cd), uCowPaint);
  }
  col = col * (1.0 - cow.a) + cow.rgb;

  // bloom and haze
  vec3 bl = vec3(0.0);
  vec3 hz = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398;
    vec2 o = vec2(cos(an), sin(an));
    vec3 a = softc(p + o * 6.0 * uScale);
    vec3 b = softc(p + o * 16.0 * uScale);
    bl += max(a - 0.72, 0.0) + max(b - 0.72, 0.0) * 0.7;
    hz += a * 0.5 + b * 0.5;
  }
  bl /= 8.0;
  hz /= 8.0;
  col = mix(col, hz, 0.06 * uBloom);
  col += bl * uBloom * 1.4;

  // light shafts: open sky toward the sun, drawn out along the lines from it
  vec2 uv = vUv;
  vec2 toSun = uSunUv - uv;
  float rays = 0.0;
  float jt = hash(gl_FragCoord.xy);
  for (int i = 0; i < 32; i++) {
    float s = (float(i) + jt) / 32.0;
    vec2 q = uv + toSun * s;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
    float ra = texture2D(uSoftTex, q).a;
    rays += (ra < 0.5 ? ra * 2.0 : 0.0) * (1.0 - s * 0.6);
  }
  rays /= 18.0;
  // two or three soft shafts, set at irregular angles and widths, leaning
  // slowly as the clouds that cut them drift by
  vec2 fromSun = (uv - uSunUv) * vec2(uRes.x / uRes.y, 1.0);
  float dist = length(fromSun);
  float ang = atan(fromSun.y, fromSun.x);
  vec2 toMid = (vec2(0.5) - uSunUv) * vec2(uRes.x / uRes.y, 1.0);
  float mid = atan(toMid.y, toMid.x);
  float beams = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a0 = mid + (hash(vec2(fi, 4.1)) - 0.5) * 0.75 + sin(uTime * 0.025 + fi * 2.3) * 0.04;
    float wdt = 0.03 + 0.06 * hash(vec2(fi, 7.3));
    float da = ang - a0;
    da = atan(sin(da), cos(da));
    beams += exp(-da * da / (wdt * wdt)) * (0.45 + 0.55 * hash(vec2(fi, 9.9)));
  }
  float reach = 1.0 - smoothstep(0.0, 1.9, dist);
  // a soft glow everywhere the open sky reaches, the shafts brighter within it
  col += mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.72, 0.4), 0.6) * rays * reach * (0.25 + beams * 0.9) * uRays * 0.7;

  // Monet's palette: violet-blue in the shadows, a warm breath in the lights
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += vec3(0.025, 0.012, 0.045) * (1.0 - l) * uPaint;
  col *= mix(vec3(1.0), vec3(1.045, 1.0, 0.94), smoothstep(0.45, 1.0, l) * uPaint);

  // canvas weave and grain
  vec2 q = p / uScale;
  float weave = sin(q.x * 2.3) * sin(q.y * 2.3);
  float grain = hash(floor(p * 1.5)) - 0.5;
  col *= 1.0 + uPaint * (weave * 0.025 + grain * 0.035);

  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.3;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---- GL plumbing ---------------------------------------------------------------

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return s;
}

type Prog = { prog: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
function link(gl: WebGLRenderingContext, vert: string, frag: string, attrs: string[], names: string[]): Prog {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  attrs.forEach((a, i) => gl.bindAttribLocation(prog, i, a));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Link failed: ${gl.getProgramInfoLog(prog)}`);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return { prog, u };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_WIDTH = 1800;
const CLOUD_UNIFORMS = ["uNoise", "uTime", "uSun", "uWind", "uCover", "uSunCol"];
const SURFACE_UNIFORMS = ["uEye", "uShadow", "uGrid", "uSunI", "uHaze"];

// the polar grid the land is built on
const ROWS = 230;
const COLS = 280;
const R0 = 1.0;
const R1 = 7000;
const A0 = -0.95;
const A1 = 0.95;

export function startMeadow(canvas: HTMLCanvasElement, initial: Partial<MeadowParams> = {}): MeadowController {
  const params: MeadowParams = { ...MEADOW_DEFAULTS, ...initial };
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL is not available");
  const inst = gl.getExtension("ANGLE_instanced_arrays");

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const sky = link(gl, QUAD_VERT, SKY_FRAG, ["aPos"], [...CLOUD_UNIFORMS, "uRight", "uUp", "uFwd", "uTanV", "uAspect", "uSkyTop", "uSkyHor", "uPink"]);
  const back = link(gl, QUAD_VERT, BACK_FRAG, ["aPos"], ["uSky", "uSkyPx"]);
  const surf = [...CLOUD_UNIFORMS, ...SURFACE_UNIFORMS, "uVP"];
  const terrain = link(gl, TERRAIN_VERT, TERRAIN_FRAG, ["aPos", "aNrm"], [...surf, "uWindAmt", "uWindDir", "uPix", "uGrassSun", "uGrassShade", "uFuzz", "uSunlight"]);
  const flowers = link(gl, FLOWER_VERT, FLOWER_FRAG, ["aCorner", "aRoot", "aBlade"], [...surf, "uWindAmt", "uWindDir", "uCamRight", "uCamUp"]);
  const flies = link(gl, FLY_VERT, FLY_FRAG, ["aPos", "aInfo"], surf);
  const cows = link(gl, COW_VERT, COW_FRAG, ["aCorner", "aRoot", "aCow"], [...surf, "uCamRight", "uCowScale"]);
  const blur = link(gl, QUAD_VERT, BLUR_FRAG, ["aPos"], ["uSrc", "uStep"]);
  const finish = link(gl, QUAD_VERT, FINISH_FRAG, ["aPos"], ["uScene", "uSoftTex", "uRes", "uSunUv", "uBloom", "uRays", "uPaint", "uBrush", "uBlur", "uScale", "uTime", "uFuzz", "uBlade", "uCow", "uCowSoft", "uCowBlur", "uCowPaint"]);

  // noise table for the clouds: red random, green the red one z-layer on
  const rnd = mulberry32(7);
  const N = 256;
  const base = new Uint8Array(N * N);
  for (let i = 0; i < base.length; i++) base[i] = Math.floor(rnd() * 256);
  const table = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      table[i] = base[y * N + x];
      table[i + 1] = base[((y + 17) & 255) * N + ((x + 37) & 255)];
      table[i + 3] = 255;
    }
  const tex = (filter: number, wrap: number) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  };
  const noiseTex = tex(gl.LINEAR, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, table);

  // ---- the land ----
  const eyeY = groundHeight(0, 0) + EYE_HEIGHT;
  const eye: [number, number, number] = [0, eyeY, 0];
  const lr0 = Math.log(R0);
  const lrr = Math.log(R1 / R0);
  const gridPos = new Float32Array(ROWS * COLS * 3);
  const gridNrm = new Float32Array(ROWS * COLS * 3);
  for (let i = 0; i < ROWS; i++) {
    const r = Math.exp(lr0 + (lrr * i) / (ROWS - 1));
    const e = Math.max(0.15, r * 0.012);
    for (let j = 0; j < COLS; j++) {
      const a = A0 + ((A1 - A0) * j) / (COLS - 1);
      const x = r * Math.sin(a);
      const z = r * Math.cos(a);
      const y = groundHeight(x, z);
      const k = (i * COLS + j) * 3;
      gridPos[k] = x;
      gridPos[k + 1] = y;
      gridPos[k + 2] = z;
      const dx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e);
      const dz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e);
      const l = Math.hypot(dx, 1, dz);
      gridNrm[k] = -dx / l;
      gridNrm[k + 1] = 1 / l;
      gridNrm[k + 2] = -dz / l;
    }
  }
  const idx = new Uint16Array((ROWS - 1) * (COLS - 1) * 6);
  // rows go from the horizon in toward us, so the land can be painted far to
  // near: a heightfield seen from its centre never hides itself any other way,
  // and the depth buffer is far too coarse kilometres out to sort it
  let n = 0;
  for (let i = ROWS - 2; i >= 0; i--)
    for (let j = 0; j < COLS - 1; j++) {
      const a = i * COLS + j;
      const b = a + 1;
      const c = a + COLS;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], n);
      n += 6;
    }
  const terrPos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, terrPos);
  gl.bufferData(gl.ARRAY_BUFFER, gridPos, gl.STATIC_DRAW);
  const terrNrm = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, terrNrm);
  gl.bufferData(gl.ARRAY_BUFFER, gridNrm, gl.STATIC_DRAW);
  const terrIdx = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, terrIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  // the ridges' shadows depend on where the sun is, so they're redone when it moves
  const shadowTex = tex(gl.LINEAR, gl.CLAMP_TO_EDGE);
  const shadowData = new Uint8Array(ROWS * COLS);
  let sunDir: [number, number, number] = [0, 1, 0];
  const sunFor = (s: number): [number, number, number] => {
    // low, and just past the right edge of the frame, so its rays reach in
    const elev = ((8 + s * 40) * Math.PI) / 180;
    const az = 0.68;
    return [Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)];
  };
  const bakeShadows = () => {
    sunDir = sunFor(params.sun);
    const [sx, sy, sz] = sunDir;
    for (let i = 0; i < ROWS; i++)
      for (let j = 0; j < COLS; j++) {
        const k = (i * COLS + j) * 3;
        const x = gridPos[k];
        const y = gridPos[k + 1] + 0.3;
        const z = gridPos[k + 2];
        let res = 1;
        let d = 1.5;
        for (let s = 0; s < 34; s++) {
          const px = x + sx * d;
          const pz = z + sz * d;
          const clear = y + sy * d - groundHeight(px, pz);
          res = Math.min(res, (5 * clear) / d);
          if (res < 0) break;
          d *= 1.2;
          if (d > 1500) break;
        }
        shadowData[i * COLS + j] = Math.round(Math.max(0.12, Math.min(1, res * 0.5 + 0.5 * Math.min(1, Math.max(0, res)))) * 255);
      }
    // smooth it, so shadow edges are soft and never step along the grid
    const tmp = new Float32Array(ROWS * COLS);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < ROWS; i++)
        for (let j = 0; j < COLS; j++) {
          let sum = 0;
          let n2 = 0;
          for (let di = -1; di <= 1; di++)
            for (let dj = -2; dj <= 2; dj++) {
              const ii = i + di;
              const jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= ROWS || jj >= COLS) continue;
              sum += shadowData[ii * COLS + jj];
              n2++;
            }
          tmp[i * COLS + j] = sum / n2;
        }
      for (let q = 0; q < tmp.length; q++) shadowData[q] = Math.round(tmp[q]);
    }
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, COLS, ROWS, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, shadowData);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  };
  bakeShadows();

  // ---- daisies, low in the grass ----
  const pr = mulberry32(21);
  const fieldNoise = (x: number, z: number) => vnoise(x * 0.04 + 21, z * 0.04 + 21);
  const DAISIES = inst ? 1800 : 0;
  const flowerData = new Float32Array(DAISIES * 7);
  const flowerSpots: Array<{ x: number; y: number; z: number; h: number; ang: number; rnd: number }> = [];
  let s = 0;
  while (s < DAISIES) {
    // log-uniform in distance: plenty close by, enough far off
    const r = 4 * Math.pow(40 / 4, pr());
    const a = (pr() - 0.5) * 1.5;
    const x = r * Math.sin(a);
    const z = r * Math.cos(a);
    // daisies grow in drifts
    if (fieldNoise(x, z) < 0.5 + pr() * 0.15) continue;
    const h = 0.05 + pr() * 0.1;
    const ang = pr() * Math.PI * 2;
    const rr = pr();
    const y = groundHeight(x, z);
    flowerData.set([x, y, z, h, 0, ang, rr], s * 7);
    if (r < 12) flowerSpots.push({ x, y, z, h, ang, rnd: rr });
    s++;
  }
  const flowerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, flowerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, flowerData, gl.STATIC_DRAW);
  const cornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  /** where a flower's head is right now (the same sway the shader gives it) */
  const headAt = (f: (typeof flowerSpots)[number], t: number): [number, number, number] => {
    const b = bendAt(f.x, f.z, t, f.rnd, 0.15 + params.wind * 0.55);
    const lean = (0.1 + 0.3 * ((f.rnd * 7.31) % 1)) * 0.3;
    const ox = (WIND_DIR[0] * b + Math.cos(f.ang) * lean) * f.h;
    const oz = (WIND_DIR[1] * b + Math.sin(f.ang) * lean) * f.h;
    const y = f.h * (1 - (0.3 * (ox * ox + oz * oz)) / (f.h * f.h));
    return [f.x + ox, f.y + y, f.z + oz];
  };

  // ---- a few cows grazing on the far slopes ----
  // only where we can actually see them: nothing between them and the eye
  const seen = (x: number, z: number) => {
    const gy = groundHeight(x, z) + 0.9;
    for (let i = 1; i < 48; i++) {
      const f = i / 48;
      const px = eye[0] + (x - eye[0]) * f;
      const pz = eye[2] + (z - eye[2]) * f;
      const py = eye[1] + (gy - eye[1]) * f;
      if (groundHeight(px, pz) > py - 0.15) return false;
    }
    return true;
  };
  type Cow = { x: number; y: number; z: number; face: number; pose: number; want: number; timer: number; variant: number; seed: number; step: number };
  const herd: Cow[] = [];
  {
    // the spots, picked on the painting (across, down, from its top-left),
    // where a cow or two should stand
    const SPOTS: Array<[number, number, number]> = [
      [0.18, 0.6, 2],
      [0.26, 0.645, 2],
      [0.77, 0.627, 2],
      [0.93, 0.512, 1],
    ];
    // follow the ray through that point of the picture down onto the land
    const landAt = (u: number, v: number): [number, number] | null => {
      const nx = (u * 2 - 1) * TAN_V * 1.6;
      const ny = (1 - v * 2) * TAN_V;
      const cp0 = Math.cos(PITCH);
      const sp0 = Math.sin(PITCH);
      let dx = nx;
      let dy = ny * cp0 + sp0;
      let dz = -ny * sp0 + cp0;
      const l = Math.hypot(dx, dy, dz);
      dx /= l;
      dy /= l;
      dz /= l;
      let prev = 0;
      for (let t = 2; t < 4000; t *= 1.03) {
        if (eye[1] + dy * t < groundHeight(eye[0] + dx * t, eye[2] + dz * t)) {
          let lo = prev;
          let hi = t;
          for (let i = 0; i < 24; i++) {
            const m = (lo + hi) / 2;
            if (eye[1] + dy * m < groundHeight(eye[0] + dx * m, eye[2] + dz * m)) hi = m;
            else lo = m;
          }
          return [eye[0] + dx * hi, eye[2] + dz * hi];
        }
        prev = t;
      }
      return null;
    };
    const cr = mulberry32(31);
    const variants = [0, 2, 0, 1, 0, 3, 0];
    for (const [u, v, n] of SPOTS) {
      const hit = landAt(u, v);
      if (!hit) continue;
      for (let k = 0; k < n; k++) {
        const r = Math.hypot(hit[0], hit[1]);
        // the second of a pair stands a few metres off, still in view
        let x = hit[0];
        let z = hit[1];
        for (let tries = 0; k > 0 && tries < 20; tries++) {
          const ox = hit[0] + (cr() - 0.5) * r * 0.12;
          const oz = hit[1] + (cr() - 0.5) * r * 0.06;
          if (seen(ox, oz)) {
            x = ox;
            z = oz;
            break;
          }
        }
        herd.push({ x, y: groundHeight(x, z), z, face: cr() < 0.5 ? -1 : 1, pose: cr() < 0.7 ? 0 : 1, want: 0, timer: 2 + cr() * 8, variant: variants[herd.length % variants.length] + 0.5, seed: cr(), step: 0 });
      }
    }
  }
  const cowData = new Float32Array(Math.max(1, herd.length) * 7);
  const cowBuf = gl.createBuffer();
  const cr2 = mulberry32(77);
  const stepCows = (dt: number) => {
    herd.forEach((c, i) => {
      c.timer -= dt;
      if (c.timer < 0) {
        const roll = cr2();
        if (c.want === 0 && roll < 0.55) {
          // lift the head and look about a while
          c.want = 1;
          c.timer = 2 + cr2() * 4;
        } else {
          c.want = 0;
          c.timer = 5 + cr2() * 10;
          // now and then, a step or two, or a turn
          if (roll > 0.8) c.step = 1.6;
          else if (roll > 0.7) c.face = -c.face;
        }
      }
      if (c.step > 0) {
        const mv = Math.min(c.step, dt) * 0.35;
        c.step -= dt;
        c.x += c.face * mv;
        c.y = groundHeight(c.x, c.z);
      }
      c.pose += (c.want - c.pose) * Math.min(1, dt * 1.8);
      // far cows are drawn larger, so they read as cows and not as specks
      const dist = Math.hypot(c.x - eye[0], c.z - eye[2]);
      const grow = Math.min(3, Math.max(0.8, dist * 0.013));
      cowData.set([c.x, c.y, c.z, c.face * grow, c.pose, c.variant, c.seed], i * 7);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, cowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cowData, gl.DYNAMIC_DRAW);
  };

  // ---- butterflies ----
  type Fly = {
    p: [number, number, number];
    yaw: number;
    mode: "fly" | "land" | "rest";
    timer: number;
    target: number;
    phase: number;
    seed: number;
    kind: number;
  };
  const br = mulberry32(5);
  const fliesState: Fly[] = [0, 1, 2].map((k) => {
    const x = (br() - 0.5) * 6;
    const z = 3.5 + br() * 5;
    return { p: [x, groundHeight(x, z) + 0.6 + br() * 0.6, z], yaw: br() * 6.28, mode: "fly", timer: 2 + br() * 5, target: -1, phase: br() * 6, seed: br() * 100, kind: k };
  });
  const flyBuf = gl.createBuffer();
  const flyVerts = new Float32Array(fliesState.length * 3 * 6 * 6);
  const wobble = (f: Fly, t: number, k: number) => Math.sin(t * 1.3 + f.seed * k) * 0.6 + Math.sin(t * 2.9 + f.seed * 1.7 * k) * 0.3 + Math.sin(t * 7.1 + f.seed * 3.1 * k) * 0.15;
  const stepFlies = (t: number, dt: number) => {
    for (const f of fliesState) {
      const [x, y, z] = f.p;
      const ground = groundHeight(x, z);
      if (f.mode === "fly") {
        // a butterfly's flight: wandering, jinking, bobbing with each beat
        f.yaw += wobble(f, t, 1) * 2.4 * dt;
        // drift back toward the patch of meadow in front of us
        const hx = -x * 0.15;
        const hz = (6 - z) * 0.15;
        const want = Math.atan2(hx, hz);
        let dy = want - f.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        f.yaw += dy * Math.min(1, Math.hypot(hx, hz)) * dt;
        const speed = 0.75 + 0.35 * wobble(f, t, 2);
        f.p[0] += Math.sin(f.yaw) * speed * dt;
        f.p[2] += Math.cos(f.yaw) * speed * dt;
        const lift = 1.3 + wobble(f, t, 3) * 0.4 - (y - ground);
        f.p[1] += (lift * 0.9 + Math.sin(t * 9 + f.seed) * 0.55) * dt;
        f.p[1] = Math.max(ground + 0.7, f.p[1]);
        f.timer -= dt;
        if (f.timer < 0 && flowerSpots.length) {
          // pick a flower near it to visit
          let best = -1;
          let bd = 1e9;
          for (let i = 0; i < flowerSpots.length; i++) {
            const s2 = flowerSpots[i];
            const d = Math.hypot(s2.x - x, s2.z - z) + br() * 2.5;
            if (d < bd && s2.z > 3) {
              bd = d;
              best = i;
            }
          }
          f.target = best;
          f.mode = "land";
          f.timer = 8;
        }
      } else if (f.mode === "land") {
        const [hx, hy, hz] = headAt(flowerSpots[f.target], t);
        const dx = hx - x;
        const dy = hy + 0.012 - y;
        const dz = hz - z;
        const d = Math.hypot(dx, dy, dz);
        const want = Math.atan2(dx, dz);
        let dyaw = want - f.yaw;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        f.yaw += dyaw * Math.min(1, dt * 3) + wobble(f, t, 1) * 0.8 * dt * Math.min(1, d);
        const sp = Math.min(0.8, d * 1.5 + 0.1);
        f.p[0] += (dx / d) * sp * dt;
        f.p[1] += (dy / d) * sp * dt + Math.sin(t * 9 + f.seed) * 0.2 * dt * Math.min(1, d);
        f.p[2] += (dz / d) * sp * dt;
        f.timer -= dt;
        if (d < 0.02) {
          f.mode = "rest";
          f.timer = 3 + br() * 5;
        } else if (f.timer < 0) {
          f.mode = "fly";
          f.timer = 3 + br() * 5;
        }
      } else {
        // perched: ride the flower as it sways
        const [hx, hy, hz] = headAt(flowerSpots[f.target], t);
        f.p = [hx, hy + 0.012, hz];
        f.timer -= dt;
        if (f.timer < 0) {
          f.mode = "fly";
          f.timer = 4 + br() * 6;
          f.p[1] += 0.05;
        }
      }
    }
  };
  const buildFlies = (t: number) => {
    let o = 0;
    const put = (p: number[], q0: number, q1: number, kind: number) => {
      flyVerts.set([p[0], p[1], p[2], q0, q1, kind], o);
      o += 6;
    };
    for (const f of fliesState) {
      const span = 0.05;
      // wings beat fast in flight; at rest they open and close slowly
      let open: number;
      // (the wings are held in a V, so we see them, not their edges)
      if (f.mode === "rest") open = 0.55 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.6 + f.seed));
      else open = 0.3 + 1.1 * (0.5 + 0.5 * Math.sin(t * 52 + f.seed));
      const fx = Math.sin(f.yaw);
      const fz = Math.cos(f.yaw);
      const rx = fz;
      const rz = -fx;
      for (const side of [-1, 1]) {
        const ca = Math.cos(open);
        const sa = Math.sin(open);
        // wing corners: out along the hinged span, along the body front to back
        const corner = (u: number, v: number) => [
          f.p[0] + side * rx * ca * u * span + fx * v * span * 0.75,
          f.p[1] + sa * u * span,
          f.p[2] + side * rz * ca * u * span + fz * v * span * 0.75,
        ];
        const A = corner(0, -1);
        const B = corner(1, -1);
        const C = corner(0, 1);
        const D = corner(1, 1);
        put(A, 0, -1, f.kind);
        put(B, 1, -1, f.kind);
        put(C, 0, 1, f.kind);
        put(B, 1, -1, f.kind);
        put(D, 1, 1, f.kind);
        put(C, 0, 1, f.kind);
      }
      // the body
      const bw = 0.004;
      const bl = span * 0.8;
      const P = (u: number, v: number) => [f.p[0] + rx * u * bw + fx * v * bl, f.p[1] + 0.001, f.p[2] + rz * u * bw + fz * v * bl];
      put(P(-1, -1), -1, -1, 10);
      put(P(1, -1), 1, -1, 10);
      put(P(-1, 1), -1, 1, 10);
      put(P(1, -1), 1, -1, 10);
      put(P(1, 1), 1, 1, 10);
      put(P(-1, 1), -1, 1, 10);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, flyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, flyVerts, gl.DYNAMIC_DRAW);
    return o / 6;
  };

  // ---- render targets ----
  const skyTex = tex(gl.LINEAR, gl.CLAMP_TO_EDGE);
  const skyFbo = gl.createFramebuffer();
  const sceneTex = tex(gl.LINEAR, gl.CLAMP_TO_EDGE);
  const sceneFbo = gl.createFramebuffer();
  const depth = gl.createRenderbuffer();
  const blurTex = [tex(gl.LINEAR, gl.CLAMP_TO_EDGE), tex(gl.LINEAR, gl.CLAMP_TO_EDGE)];
  const cowTex = tex(gl.LINEAR, gl.CLAMP_TO_EDGE);
  const cowFbo = gl.createFramebuffer()!;
  const cowBlurTex = [tex(gl.LINEAR, gl.CLAMP_TO_EDGE), tex(gl.LINEAR, gl.CLAMP_TO_EDGE)];
  const cowBlurFbo = [gl.createFramebuffer()!, gl.createFramebuffer()!];
  const blurFbo = [gl.createFramebuffer()!, gl.createFramebuffer()!];
  let blurW = 2;
  let blurH = 2;
  let skyW = 0;
  let skyH = 0;
  let sceneW = 0;
  let sceneH = 0;
  let k = 0.5;
  let fixedWidth: number | null = null;
  // A softly torn edge, like the deckled border of watercolour paper: the
  // swan pond's own, cut into the frame the canvas sits in.
  const host = canvas.parentElement;
  let edgeMask: HTMLCanvasElement | null = null;
  let edgeW = 0;
  let edgeH = 0;
  const featherEdge = (W: number, H: number) => {
    const scale = W / 680;
    const mw = Math.max(1, Math.round(W / 2));
    const mh = Math.max(1, Math.round(H / 2));
    const m = document.createElement("canvas");
    m.width = mw;
    m.height = mh;
    const mc = m.getContext("2d")!;
    const img = mc.createImageData(mw, mh);
    const r = mulberry32(5);
    const perm = Array.from({ length: 512 }, () => r());
    const n1 = (x: number) => {
      const i = Math.floor(x);
      const f = x - i;
      const u = f * f * (3 - 2 * f);
      return perm[i & 511] * (1 - u) + perm[(i + 1) & 511] * u;
    };
    // ragged profile along the edge: big bites, then fibres
    const rag = (t: number) => n1(t * 0.03) * 0.7 + n1(t * 0.1 + 40) * 0.24 + n1(t * 0.4 + 90) * 0.06;
    const k2 = 2;
    const inset = 9 * scale;
    const rad = 34 * scale;
    const depthE = 6 * scale;
    const soft = 7 * scale;
    for (let py = 0; py < mh; py++) {
      for (let px = 0; px < mw; px++) {
        const x = px * k2;
        const y = py * k2;
        const qx = Math.abs(x - W / 2) - (W / 2 - inset - rad);
        const qy = Math.abs(y - H / 2) - (H / 2 - inset - rad);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
        const d = -outside;
        const t = (Math.atan2(y - H / 2, x - W / 2) * (W + H) * 0.32) / scale;
        const edge = depthE * rag(t + 1000);
        let a = (d - edge) / soft;
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        a = a * a * (3 - 2 * a);
        let f = (d - edge) / (22 * scale);
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        a *= 0.55 + 0.45 * f;
        const o = (py * mw + px) * 4;
        img.data[o + 3] = Math.round(a * 255);
      }
    }
    mc.putImageData(img, 0, 0);
    edgeMask = m;
    if (!host) return;
    const url = `url(${m.toDataURL("image/png")})`;
    host.style.setProperty("-webkit-mask-image", url);
    host.style.setProperty("mask-image", url);
    host.style.setProperty("-webkit-mask-size", "100% 100%");
    host.style.setProperty("mask-size", "100% 100%");
    host.style.setProperty("-webkit-mask-repeat", "no-repeat");
    host.style.setProperty("mask-repeat", "no-repeat");
    host.style.setProperty("-webkit-mask-composite", "source-over");
    host.style.setProperty("mask-composite", "add");
    host.style.borderRadius = "0";
  };

  const resize = () => {
    const cw = canvas.clientWidth || 800;
    const ch = canvas.clientHeight || 500;
    if (cw !== edgeW || ch !== edgeH) {
      edgeW = cw;
      edgeH = ch;
      featherEdge(cw, ch);
    }
    let w: number;
    let h: number;
    if (fixedWidth) {
      w = fixedWidth;
      h = Math.round((fixedWidth * ch) / cw / 2) * 2;
    } else {
      const sc = Math.min(Math.min(window.devicePixelRatio || 1, 2), MAX_WIDTH / cw);
      w = Math.max(2, Math.round(cw * sc));
      h = Math.max(2, Math.round(ch * sc));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const kk = fixedWidth ? 0.75 : k;
    const sw = Math.max(2, Math.round(w * kk));
    const sh = Math.max(2, Math.round(h * kk));
    if (sw !== skyW || sh !== skyH) {
      skyW = sw;
      skyH = sh;
      gl.bindTexture(gl.TEXTURE_2D, skyTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, skyFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, skyTex, 0);
    }
    // the picture under the paint is soft anyway, so it's drawn at a fraction
    // of the screen's pixels, as on the pond
    const pk = 1;
    const pw = Math.max(2, Math.round(w * pk));
    const ph = Math.max(2, Math.round(h * pk));
    if (pw !== sceneW || ph !== sceneH) {
      sceneW = pw;
      sceneH = ph;
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, pw, ph);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      blurW = Math.max(2, Math.round(pw / 2));
      blurH = Math.max(2, Math.round(ph / 2));
      for (let i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, blurTex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blurW, blurH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurTex[i], 0);
        gl.bindTexture(gl.TEXTURE_2D, cowBlurTex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blurW, blurH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, cowBlurFbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cowBlurTex[i], 0);
      }
      // the cows share the land's depth, so a rise can hide them
      gl.bindTexture(gl.TEXTURE_2D, cowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, cowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cowTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  // ---- camera ----
  const cp = Math.cos(PITCH);
  const spitch = Math.sin(PITCH);
  const right = [1, 0, 0];
  const up = [0, cp, -spitch];
  const fwd = [0, spitch, cp];
  const viewProj = (aspect: number) => {
    const f = 1 / TAN_V;
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // view: rows right, up, -forward
    const V = [
      right[0], up[0], -fwd[0], 0,
      right[1], up[1], -fwd[1], 0,
      right[2], up[2], -fwd[2], 0,
      -dot(right, eye), -dot(up, eye), dot(fwd, eye), 1,
    ];
    const P = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (FAR_CLIP + NEAR) / (NEAR - FAR_CLIP), -1, 0, 0, (2 * FAR_CLIP * NEAR) / (NEAR - FAR_CLIP), 0];
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let m = 0; m < 4; m++) sum += P[m * 4 + r] * V[c * 4 + m];
        out[c * 4 + r] = sum;
      }
    return out;
  };

  // ---- colours, from the sliders ----
  const hsl = (h: number, sat: number, l: number): [number, number, number] => {
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const a = sat * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  };
  const lerp3 = (a: number[], b: number[], t2: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2, a[2] + (b[2] - a[2]) * t2];
  const toHsl = (hex: string): [number, number, number] => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const v = m ? parseInt(m[1], 16) : 0x0a379f;
    const r = ((v >> 16) & 255) / 255;
    const g = ((v >> 8) & 255) / 255;
    const b = (v & 255) / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    if (!d) return [0, 0, l];
    const sat = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return [h < 0 ? h + 360 : h, sat, l];
  };
  const colours = () => {
    // the picked blue is the sky overhead; Sky depth darkens or lightens it,
    // and the horizon is a paler, softer version of the same hue
    const [sh, ss, sl] = toHsl(params.sky);
    const rich = params.grassRich;
    const clampL = (x: number) => Math.min(0.92, Math.max(0.04, x));
    return {
      sun: lerp3([1, 0.96, 0.9], [1, 0.6, 0.26], params.warm),
      skyTop: hsl(sh, ss, clampL(sl + (0.4 - params.skyDepth) * 0.27)),
      skyHor: hsl(sh - 8, Math.min(0.7, ss * 0.7), clampL(0.74 - params.skyDepth * 0.08)),
      haze: lerp3(hsl(sh - 12, Math.min(0.55, ss * 0.55), 0.8), [0.95, 0.88, 0.76], params.warm * 0.35),
      grassSun: hsl(62 + params.grassSun * 55, 0.45 + 0.42 * rich, 0.5),
      grassShade: hsl(95 + params.grassShade * 60, 0.35 + 0.5 * rich, 0.17 + 0.05 * (1 - rich)),
    };
  };
  let C = colours();

  const setCloudUniforms = (p: Prog, t: number, wind: number[]) => {
    gl.uniform3f(p.u.uSunCol, C.sun[0], C.sun[1], C.sun[2]);
    gl.uniform1i(p.u.uNoise, 0);
    gl.uniform1f(p.u.uTime, t);
    gl.uniform3f(p.u.uSun, sunDir[0], sunDir[1], sunDir[2]);
    gl.uniform3f(p.u.uWind, wind[0], wind[1], wind[2]);
    gl.uniform1f(p.u.uCover, 0.2 + params.cover * 0.4);
  };
  const setSurface = (p: Prog, t: number, wind: number[], vp: Float32Array) => {
    gl.useProgram(p.prog);
    setCloudUniforms(p, t, wind);
    gl.uniform3f(p.u.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1i(p.u.uShadow, 1);
    gl.uniform4f(p.u.uGrid, A0, A1 - A0, lr0, lrr);
    gl.uniform1f(p.u.uSunI, 2.3);
    gl.uniform3f(p.u.uHaze, C.haze[0], C.haze[1], C.haze[2]);
    gl.uniformMatrix4fv(p.u.uVP, false, vp);
  };
  const attr = (buf: WebGLBuffer | null, loc: number, size: number, stride: number, offset: number, divisor: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    if (inst) inst.vertexAttribDivisorANGLE(loc, divisor);
  };
  const clearAttrs = () => {
    for (let i = 0; i < 4; i++) {
      if (inst) inst.vertexAttribDivisorANGLE(i, 0);
      gl.disableVertexAttribArray(i);
    }
  };

  const start = performance.now();
  let lastNow = start;
  let lastT = 0;
  const draw = (now: number) => {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const t = (now - start) / 1000;
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    const aspect = w / h;
    C = colours();
    const speed = 0.02 + params.wind * 0.16;
    const wind = [-t * speed, 0, t * speed * 0.25];
    const windAmt = 0.15 + params.wind * 0.55;
    const vp = viewProj(aspect);

    // 1. clouds
    gl.bindFramebuffer(gl.FRAMEBUFFER, skyFbo);
    gl.viewport(0, 0, skyW, skyH);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sky.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    setCloudUniforms(sky, t, wind);
    gl.uniform3f(sky.u.uRight, right[0], right[1], right[2]);
    gl.uniform3f(sky.u.uUp, up[0], up[1], up[2]);
    gl.uniform3f(sky.u.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform1f(sky.u.uTanV, TAN_V);
    gl.uniform1f(sky.u.uAspect, aspect);
    gl.uniform3f(sky.u.uSkyTop, C.skyTop[0], C.skyTop[1], C.skyTop[2]);
    gl.uniform3f(sky.u.uSkyHor, C.skyHor[0], C.skyHor[1], C.skyHor[2]);
    gl.uniform1f(sky.u.uPink, params.pink);
    attr(quadBuf, 0, 2, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. the scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.viewport(0, 0, sceneW, sceneH);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(back.prog);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, skyTex);
    gl.uniform1i(back.u.uSky, 2);
    gl.uniform2f(back.u.uSkyPx, 1 / skyW, 1 / skyH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    clearAttrs();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);

    setSurface(terrain, t, wind, vp);
    gl.uniform1f(terrain.u.uWindAmt, windAmt);
    gl.uniform2f(terrain.u.uWindDir, WIND_DIR[0], WIND_DIR[1]);
    gl.uniform1f(terrain.u.uPix, (2 * TAN_V) / sceneH);
    gl.uniform3f(terrain.u.uGrassSun, C.grassSun[0], C.grassSun[1], C.grassSun[2]);
    gl.uniform3f(terrain.u.uGrassShade, C.grassShade[0], C.grassShade[1], C.grassShade[2]);
    gl.uniform1f(terrain.u.uFuzz, 0.25);
    gl.uniform1f(terrain.u.uSunlight, params.sunlight);
    attr(terrPos, 0, 3, 0, 0, 0);
    attr(terrNrm, 1, 3, 0, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, terrIdx);
    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    gl.depthFunc(gl.LEQUAL);
    clearAttrs();

    if (inst) {
      setSurface(flowers, t, wind, vp);
      gl.uniform1f(flowers.u.uWindAmt, windAmt);
      gl.uniform2f(flowers.u.uWindDir, WIND_DIR[0], WIND_DIR[1]);
      gl.uniform3f(flowers.u.uCamRight, right[0], right[1], right[2]);
      gl.uniform3f(flowers.u.uCamUp, up[0], up[1], up[2]);
      attr(cornerBuf, 0, 2, 0, 0, 0);
      attr(flowerBuf, 1, 3, 28, 0, 1);
      attr(flowerBuf, 2, 4, 28, 12, 1);
      inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, DAISIES);
      clearAttrs();
    }

    stepFlies(t, dt);
    const nv = buildFlies(t);
    setSurface(flies, t, wind, vp);
    attr(flyBuf, 0, 3, 24, 0, 0);
    attr(flyBuf, 1, 3, 24, 12, 0);
    gl.drawArrays(gl.TRIANGLES, 0, nv);
    clearAttrs();

    gl.bindFramebuffer(gl.FRAMEBUFFER, cowFbo);
    gl.viewport(0, 0, sceneW, sceneH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (inst && herd.length) {
      stepCows(dt);
      gl.depthMask(false);
      setSurface(cows, t, wind, vp);
      gl.uniform3f(cows.u.uCamRight, right[0], right[1], right[2]);
      gl.uniform1f(cows.u.uCowScale, 0.5 + params.cowSize);
      attr(cornerBuf, 0, 2, 0, 0, 0);
      attr(cowBuf, 1, 3, 28, 0, 1);
      attr(cowBuf, 2, 4, 28, 12, 1);
      inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, herd.length);
      clearAttrs();
      gl.depthMask(true);
    }
    gl.disable(gl.DEPTH_TEST);

    // 3. finish
    // where the sun would be on screen, for the light shafts
    const sd = sunDir;
    const cz = sd[0] * fwd[0] + sd[1] * fwd[1] + sd[2] * fwd[2];
    const cx = sd[0] * right[0] + sd[1] * right[1] + sd[2] * right[2];
    const cy = sd[0] * up[0] + sd[1] * up[1] + sd[2] * up[2];
    const sunU = 0.5 + (cx / cz / (TAN_V * aspect)) * 0.5;
    const sunV = 0.5 + (cy / cz / TAN_V) * 0.5;
    // a softened copy of the picture, at half size, for the brush to load from
    gl.useProgram(blur.prog);
    attr(quadBuf, 0, 2, 0, 0, 0);
    gl.uniform1i(blur.u.uSrc, 0);
    gl.activeTexture(gl.TEXTURE0);
    const reach = 0.5 + params.blur * 1.4;
    for (const [src, dst, sx, sy] of [
      [sceneTex, blurFbo[0], 1 / sceneW, 0],
      [blurTex[0], blurFbo[1], 0, 1 / blurH],
      [blurTex[1], blurFbo[0], 1 / blurW, 0],
      [blurTex[0], blurFbo[1], 0, 1 / blurH],
    ] as Array<[WebGLTexture, WebGLFramebuffer, number, number]>) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
      gl.viewport(0, 0, blurW, blurH);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform2f(blur.u.uStep, sx * reach, sy * reach);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // the cows' own softening
    const cowReach = 0.4 + params.cowBlur * 1.2;
    for (const [src, dst, sx, sy] of [
      [cowTex, cowBlurFbo[0], 1 / sceneW, 0],
      [cowBlurTex[0], cowBlurFbo[1], 0, 1 / blurH],
    ] as Array<[WebGLTexture, WebGLFramebuffer, number, number]>) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
      gl.viewport(0, 0, blurW, blurH);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform2f(blur.u.uStep, sx * cowReach, sy * cowReach);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(finish.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(finish.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurTex[1]);
    gl.uniform1i(finish.u.uSoftTex, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, cowTex);
    gl.uniform1i(finish.u.uCow, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, cowBlurTex[1]);
    gl.uniform1i(finish.u.uCowSoft, 3);
    gl.uniform1f(finish.u.uCowBlur, params.cowBlur);
    gl.uniform1f(finish.u.uCowPaint, params.cowPaint);
    gl.uniform2f(finish.u.uRes, w, h);
    gl.uniform2f(finish.u.uSunUv, sunU, sunV);
    gl.uniform1f(finish.u.uBloom, params.bloom);
    gl.uniform1f(finish.u.uRays, params.rays);
    gl.uniform1f(finish.u.uPaint, params.paint);
    gl.uniform1f(finish.u.uBrush, params.brush);
    gl.uniform1f(finish.u.uBlur, params.blur);
    gl.uniform1f(finish.u.uTime, t);
    gl.uniform1f(finish.u.uFuzz, params.fuzz);
    gl.uniform1f(finish.u.uBlade, params.blade);
    // brush sizes are the pond's, measured against its 680px-wide frame
    gl.uniform1f(finish.u.uScale, (fixedWidth ? w / 2 : canvas.clientWidth || w) / 680);
    attr(quadBuf, 0, 2, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    clearAttrs();
    lastNow = now;
  };

  const listeners = new Set<() => void>();
  let dead = false;
  let raf = 0;
  let prev = 0;
  let slow = 0;
  let fast = 0;
  const tick = (now: number) => {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    draw(now);
    listeners.forEach((cb) => cb());
    if (prev && !fixedWidth) {
      const d = now - prev;
      if (d > 24) {
        slow++;
        fast = 0;
      } else if (d < 18) {
        fast++;
        slow = 0;
      }
      if (slow > 15 && k > 0.35) {
        k *= 0.85;
        slow = 0;
      } else if (fast > 180 && k < 0.6) {
        k = Math.min(0.6, k * 1.08);
        fast = 0;
      }
    }
    prev = now;
  };
  draw(start);
  raf = requestAnimationFrame(tick);

  let rebake = 0;
  return {
    setParams(p) {
      const sunMoved = p.sun !== undefined && p.sun !== params.sun;
      Object.assign(params, p);
      if (sunMoved) {
        // the ridge shadows take a moment to redo, so wait for the slider to settle
        sunDir = sunFor(params.sun);
        clearTimeout(rebake);
        rebake = window.setTimeout(bakeShadows, 150);
      }
    },
    getParams() {
      return { ...params };
    },
    size() {
      return { width: canvas.clientWidth, height: canvas.clientHeight };
    },
    onFrame(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot(ctx, width, height) {
      // the page behind shows through the torn edge, as on the pond
      draw(lastNow);
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, 0, width, height);
      if (edgeMask) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(edgeMask, 0, 0, width, height);
      }
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fafafa";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    },
    setHighQuality(width) {
      fixedWidth = width;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(rebake);
      listeners.clear();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
