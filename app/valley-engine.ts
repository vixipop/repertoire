/**
 * The valley: a girl with her back to us, looking out over a Himalayan valley
 * from a sunlit ledge, painted from nothing. Two full-screen shaders:
 *
 *  1. Scene: the sky, its drifting, billowing cumulus, the far snow peaks and
 *     the forested mountain are all procedural. Over them goes the foreground
 *     painted with brush dabs on 2D canvases (see valley-paint), pushed about
 *     by a gusting wind field, and the girl, redrawn each frame so her hair
 *     blows. The sun sits just out of frame, top right.
 *  2. Paint: the same impressionist pass as the swan pond. The frame is re-laid
 *     as overlapping brush dabs, each one colour picked up from beneath it.
 *     Here the dabs run along the forms (the scene pass writes a brush angle
 *     into alpha: radiating down the mountain's gullies, round the clouds,
 *     along leaves and twigs). Then bloom, Monet's violet shadows and warm
 *     lights, and canvas grain.
 *
 * Resolution adapts to keep the frame rate up, and can be pinned to a fixed
 * width for recording.
 */

import { GIRL_RECT, makeGirl, paintValley } from "./valley-paint";

export type ValleyParams = {
  /** brushwork, 0 = the bare underpainting, 1 = fully painted */
  paint: number;
  brush: number;
  bloom: number;
  /** sun haze and the glints off the leaves */
  light: number;
  wind: number;
  /** how fast the clouds sail */
  drift: number;
  /** colour saturation */
  vivid: number;
};

export const VALLEY_DEFAULTS: ValleyParams = {
  paint: 1,
  brush: 0.5,
  bloom: 0.55,
  light: 0.6,
  wind: 0.55,
  drift: 0.5,
  vivid: 0.6,
};

export type ValleyController = {
  setParams(p: Partial<ValleyParams>): void;
  getParams(): ValleyParams;
  size(): { width: number; height: number };
  onFrame(cb: () => void): () => void;
  /** Draw the current frame into a 2D context at the given size. */
  snapshot(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  /** Render at a fixed output width (for recording), or null to go back to adaptive. */
  setHighQuality(width: number | null): void;
  destroy(): void;
};

/** The picture is 3:4 portrait. */
export const VALLEY_ASPECT = 3 / 4;
/** The foreground is painted once at this size and stretched to fit. */
const FG_W = 900;
const FG_H = 1200;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const COMMON = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
// screen uv (y down) to picture uv: xy scale, zw offset
uniform vec4 uMap;
const float PI = 3.14159265;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

const SCENE_FRAG = `${COMMON}
uniform sampler2D uFg;
uniform sampler2D uInfo;
uniform sampler2D uGirl;
uniform vec4 uGirlRect;
uniform float uWind;
uniform float uDrift;
uniform float uLight;

float blob(vec2 q, vec2 c, float r) {
  vec2 d = (q - c) * vec2(0.75, 1.0);
  return exp(-dot(d, d) / (r * r));
}

float wisp(vec2 q, vec2 c, vec2 r) {
  vec2 d = (q - c) / r;
  return exp(-dot(d, d));
}

// a cumulus: heaped domes over a flat, shadowed base
float cumulus(vec2 q, vec2 c, float s) {
  float d = blob(q, c + vec2(-0.55, 0.12) * s, 0.5 * s) + blob(q, c + vec2(0.0, -0.12) * s, 0.68 * s)
          + blob(q, c + vec2(0.55, 0.05) * s, 0.52 * s) + blob(q, c + vec2(0.22, -0.4) * s, 0.42 * s)
          + blob(q, c + vec2(-0.25, -0.32) * s, 0.36 * s) + blob(q, c + vec2(-1.0, 0.32) * s, 0.32 * s)
          + blob(q, c + vec2(1.0, 0.3) * s, 0.3 * s);
  float base = c.y + 0.45 * s;
  return d * (1.0 - smoothstep(base - 0.35 * s, base + 0.08 * s, q.y));
}

// a soft puff: a few overlapping wisps, no hard base
float puff(vec2 q, vec2 c, float s) {
  return wisp(q, c, vec2(1.6, 0.55) * s) + wisp(q, c + vec2(0.9, -0.25) * s, vec2(1.0, 0.5) * s) * 0.8
       + wisp(q, c + vec2(-0.9, 0.15) * s, vec2(1.1, 0.45) * s) * 0.7 + wisp(q, c + vec2(0.3, -0.4) * s, vec2(0.7, 0.45) * s) * 0.6;
}

// the clouds sail slowly right, wrapping round out of sight, their edges
// always billowing
float clouds(vec2 uv, float t) {
  vec2 q = uv;
  q.x = mod(q.x - t * uDrift * 0.004 + 0.25, 1.7) - 0.25;
  float d = cumulus(q, vec2(0.17, 0.1), 0.15) + puff(q, vec2(0.33, 0.165), 0.035) + puff(q, vec2(0.44, 0.13), 0.03) + puff(q, vec2(0.71, 0.07), 0.04);
  d += cumulus(q, vec2(1.02, 0.13), 0.1) + puff(q, vec2(1.22, 0.22), 0.035) + puff(q, vec2(0.04, 0.255), 0.03) + puff(q, vec2(0.62, 0.2), 0.025);
  d += wisp(q, vec2(0.52, 0.312), vec2(0.045, 0.011)) + wisp(q, vec2(0.585, 0.297), vec2(0.03, 0.009));
  d += wisp(q, vec2(0.45, 0.336), vec2(0.026, 0.008)) + wisp(q, vec2(0.05, 0.385), vec2(0.045, 0.012));
  d += wisp(q, vec2(0.86, 0.26), vec2(0.05, 0.012)) + wisp(q, vec2(1.3, 0.1), vec2(0.06, 0.015));
  float n = fbm(q * vec2(11.0, 16.0) + vec2(t * 0.02, -t * 0.012));
  float n2 = noise(q * vec2(40.0, 55.0) + vec2(-t * 0.03, t * 0.02));
  return d + ((n - 0.5) * 0.8 + (n2 - 0.5) * 0.25) * smoothstep(0.02, 0.4, d);
}

// the big forested mountain, peak a third of the way across
float ridgeMain(float x) {
  float s = x - 0.33;
  float sa = sqrt(s * s + 0.00008) - 0.009;
  float y = s < 0.0 ? 0.362 + sa * 0.31 : 0.362 + sa * 0.55 + s * s * 1.2;
  y -= 0.012 * exp(-pow((x - 0.21) / 0.035, 2.0));
  y += (noise(vec2(x * 22.0, 1.0)) - 0.5) * 0.012 + (noise(vec2(x * 70.0, 3.0)) - 0.5) * 0.004;
  return y;
}

// the snow range behind it, and a far peak at the left edge
float ridgeFar(float x) {
  float y = 0.475;
  y -= 0.055 * exp(-pow((x - 0.47) / 0.028, 2.0));
  y -= 0.04 * exp(-pow((x - 0.535) / 0.03, 2.0));
  y -= 0.038 * exp(-pow((x - 0.6) / 0.035, 2.0));
  y -= 0.03 * exp(-pow((x - 0.67) / 0.03, 2.0));
  y -= 0.07 * exp(-pow(x / 0.05, 2.0));
  y += (noise(vec2(x * 45.0, 7.0)) - 0.5) * 0.01;
  return y;
}

// the wind: a slow sway travelling across the picture, gusting now and then,
// with smaller eddies riding on it
float gustAt(vec2 uv, float t) {
  return 0.5 + 0.5 * smoothstep(0.3, 0.75, fbm(vec2(t * 0.11, uv.x * 0.8 - t * 0.16)));
}
vec2 windAt(vec2 uv, float t) {
  vec2 sway = vec2(
    sin(t * 0.83 + uv.y * 3.1 - uv.x * 2.3) * 0.6 + sin(t * 1.61 + uv.x * 5.0 + uv.y * 2.0) * 0.3,
    sin(t * 1.27 + uv.x * 4.2) * 0.25);
  vec2 eddy = vec2(
    noise(uv * vec2(9.0, 7.0) + vec2(t * 0.9, t * 0.35)) - 0.5,
    noise(uv * vec2(8.0, 10.0) + vec2(-t * 0.7, t * 0.8) + 7.0) - 0.5);
  return (sway * 0.65 + eddy * 1.2) * gustAt(uv, t);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y) * uMap.xy + uMap.zw;
  float t = uTime;
  float ang = 0.12 * sin(uv.y * 14.0 + uv.x * 6.0);

  // ---- sky: deep cobalt overhead, paling to the horizon and the sun --------
  vec3 col = mix(vec3(0.13, 0.36, 0.84), vec3(0.58, 0.79, 0.98), smoothstep(0.0, 0.5, uv.y));
  float sunD = length((uv - vec2(1.02, -0.06)) * vec2(0.75, 1.0));
  col = mix(col, vec3(0.8, 0.9, 1.0), exp(-sunD * 2.6) * 0.55);

  if (uv.y < 0.5) {
    float c = clouds(uv, t);
    float a = smoothstep(0.26, 0.6, c);
    if (a > 0.0) {
      float cx = clouds(uv + vec2(0.008, 0.0), t);
      float cy = clouds(uv + vec2(0.0, 0.008), t);
      // lit where the cloud thins towards the sun (up and right), shadowed below
      float toSun = (cx - c) - (cy - c);
      float shade = clamp(0.45 + toSun * 3.0 + smoothstep(0.5, 1.4, c) * 0.25, 0.0, 1.0);
      vec3 lit = vec3(1.0, 0.985, 0.95);
      vec3 shd = vec3(0.64, 0.68, 0.84);
      // inner billows each have their own shadowed side
      float billow = fbm(uv * vec2(22.0, 30.0) + vec2(t * 0.015, 0.0));
      shade = clamp(shade + (billow - 0.5) * 0.7, 0.0, 1.0);
      vec3 cc = mix(lit, shd, smoothstep(0.35, 0.95, shade));
      // a warm rim where the sun skims the edges
      cc += vec3(0.05, 0.03, -0.02) * (1.0 - a) * 2.0;
      col = mix(col, cc, a);
      // brush round the cloud, along its contours
      ang = mix(ang, atan(cy - c, cx - c) + PI * 0.5, a);
    }
  }

  // ---- far snow peaks -------------------------------------------------------
  float rf = ridgeFar(uv.x);
  if (uv.y > rf) {
    float below = uv.y - rf;
    float streak = fbm(vec2(uv.x * 60.0, uv.y * 9.0));
    float snow = 1.0 - smoothstep(0.005, 0.03, below - (streak - 0.5) * 0.03);
    vec3 rock = vec3(0.52, 0.62, 0.76);
    vec3 snowLit = vec3(0.97, 0.97, 1.0);
    vec3 snowShd = vec3(0.7, 0.76, 0.92);
    // faces turned to the sun (right of each crest) are lit
    float face = smoothstep(0.35, 0.65, streak + (noise(vec2(uv.x * 30.0, 2.0)) - 0.5) * 0.6);
    vec3 m = mix(rock, mix(snowShd, snowLit, face), snow);
    col = mix(m, vec3(0.66, 0.78, 0.93), 0.35);
    ang = PI * 0.5 + (streak - 0.5) * 0.8;
  }

  // ---- the hazy slope across the valley, right ------------------------------
  float rr = 0.5 - (uv.x - 0.6) * 0.35 + (noise(vec2(uv.x * 20.0, 9.0)) - 0.5) * 0.02;
  if (uv.y > rr && uv.x > 0.52) {
    float n = fbm(uv * vec2(30.0, 40.0));
    col = mix(vec3(0.3, 0.48, 0.46), vec3(0.6, 0.72, 0.82), 0.45 + (n - 0.5) * 0.3);
    ang = 2.5;
  }

  // ---- the mountain: forest over gullies that radiate from the peak ---------
  float rm = ridgeMain(uv.x);
  if (uv.y > rm) {
    vec2 d = (uv - vec2(0.33, 0.362)) * vec2(0.75, 1.0);
    float th = atan(d.x, d.y);
    float depth = uv.y - rm;
    float warp = fbm(uv * 7.0) * 0.7;
    float n1 = fbm(vec2(th * 5.0 + warp, depth * 6.0 + 3.0));
    float n2 = fbm(vec2(th * 5.0 + warp + 0.1, depth * 6.0 + 3.0));
    // the sun is up to the right: slopes facing it light up yellow-green
    float lit = clamp(0.5 + (n2 - n1) * 4.0 + (th < 0.0 ? 0.08 : -0.12), 0.0, 1.0);
    vec3 shade = vec3(0.15, 0.3, 0.38);
    vec3 mid = vec3(0.22, 0.46, 0.36);
    vec3 sun = vec3(0.5, 0.68, 0.36);
    vec3 m = lit < 0.5 ? mix(shade, mid, lit * 2.0) : mix(mid, sun, lit * 2.0 - 1.0);
    // a forest of tiny trees
    float trees = noise(uv * vec2(280.0, 360.0));
    m *= 0.86 + 0.22 * trees;
    // aerial haze: thickest low in the valley and along the left
    float haze = 0.26 + 0.32 * smoothstep(0.42, 0.75, uv.y) + 0.12 * (1.0 - smoothstep(0.0, 0.25, uv.x)) + 0.08 * exp(-depth * 40.0);
    m = mix(m, vec3(0.62, 0.75, 0.88), haze);
    // cloud shadows sail across it
    float cs = smoothstep(0.5, 0.75, fbm(vec2(uv.x * 2.4 - t * uDrift * 0.012, uv.y * 3.2 + 1.7)));
    m *= 1.0 - 0.18 * cs;
    col = m;
    ang = atan(d.y, d.x);
  }

  // the valley floor far below
  col = mix(col, vec3(0.5, 0.66, 0.6), smoothstep(0.66, 0.74, uv.y) * 0.7);

  // ---- the painted foreground, moving in the wind ---------------------------
  vec4 inf = texture2D(uInfo, uv);
  float w = inf.r;
  vec2 wd = windAt(uv, t) * w * 0.0055 * uWind;
  vec4 f = texture2D(uFg, uv + wd);
  col = mix(col, f.rgb, f.a);
  float leafy = w * f.a;
  // leaves catch and lose the sun as they turn
  float flick = noise(uv * vec2(70.0, 60.0) + windAt(uv, t) * 6.0 + t * vec2(0.8, -0.6));
  col *= 1.0 + leafy * (flick - 0.5) * 0.25 * uLight;
  float lum = dot(f.rgb, vec3(0.299, 0.587, 0.114));
  float glint = pow(noise(uv * vec2(150.0, 130.0) + t * vec2(1.7, -1.3)), 7.0) * 2.2;
  col += vec3(1.0, 0.97, 0.86) * glint * smoothstep(0.45, 0.85, lum) * leafy * uLight * 0.7;
  if (f.a > 0.5) ang = inf.g * PI;

  // ---- the girl ---------------------------------------------------------------
  vec2 gu = (uv - uGirlRect.xy) / uGirlRect.zw;
  if (gu.x > 0.0 && gu.x < 1.0 && gu.y > 0.0 && gu.y < 1.0) {
    vec4 gc = texture2D(uGirl, gu);
    col = mix(col, gc.rgb, gc.a);
    if (gc.a > 0.5) ang = PI * 0.5;
  }

  // ---- the sun just out of frame, its haze and rays ---------------------------
  vec2 sp = (uv - vec2(1.02, -0.06)) * vec2(0.75, 1.0);
  float r = length(sp);
  float rays = pow(noise(vec2(atan(sp.y, sp.x) * 10.0, t * 0.1)), 3.0);
  vec3 sunCol = vec3(1.0, 0.95, 0.8);
  col += sunCol * (exp(-r * 3.4) * 0.22 + rays * exp(-r * 2.6) * 0.14) * uLight;
  col = mix(col, sunCol, exp(-r * 7.0) * 0.4 * uLight);

  gl_FragColor = vec4(col, fract(ang / PI));
}
`;

// Impressionist pass, as on the swan pond: the frame re-laid as overlapping
// brush dabs, each carrying one colour picked up from beneath it, nudged warm
// or cool, laid in the direction the scene asked for.
const POST_FRAG = `${COMMON}
uniform sampler2D uScene;
uniform float uPaint;
uniform float uBrush;
uniform float uBloom;
uniform float uVivid;

vec4 sceneA(vec2 p) {
  // the framebuffer stores rows bottom-up
  vec2 uv = vec2(p.x, uRes.y - p.y) / uRes;
  return texture2D(uScene, clamp(uv, 0.001, 0.999));
}
vec3 scene(vec2 p) { return sceneA(p).rgb; }

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
      vec4 under = sceneA(centre);
      float ang = under.a * PI + (hash(c + seed + 3.1) - 0.5) * 0.5;
      vec2 d = p - centre;
      vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
      float len = size * (1.1 + 0.9 * h.x);
      float wid = size * (0.32 + 0.2 * h.y);
      float m = 1.0 - length(r / vec2(len, wid));
      // bristle streaks along the stroke
      m += (hash(vec2(floor(r.y / size * 7.0), c.x + c.y * 31.0 + seed)) - 0.5) * 0.22;
      if (m > 0.0) {
        float pri = hash(c + seed + 9.7) + m * 0.5;
        if (pri > best) {
          best = pri;
          vec3 s = scene(centre + vec2(cos(ang), sin(ang)) * r.x * 0.35);
          // broken colour: some dabs lean violet-blue, some yellow-green
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

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 base = scene(p);

  float big = (4.0 + uBrush * 9.0) * uScale;
  float small = big * 0.42;
  vec4 d1 = dabs(p, big, 0.0);
  vec4 d2 = dabs(p + big * 0.5, big * 0.8, 31.0);
  vec4 d3 = dabs(p, small, 57.0);

  vec3 painted = base;
  painted = mix(painted, d2.rgb, d2.a);
  painted = mix(painted, d1.rgb, d1.a);

  // finer strokes wherever there is detail: her, the twigs, the ridges
  float e = 1.5 * uScale;
  float edge = length(scene(p + vec2(e, 0.0)) - scene(p - vec2(e, 0.0)))
             + length(scene(p + vec2(0.0, e)) - scene(p - vec2(0.0, e)));
  float detail = clamp(edge * 1.5, 0.0, 1.0);
  vec3 fine = mix(base, d3.rgb, d3.a * 0.85);
  painted = mix(painted, fine, detail);

  vec3 col = mix(base, painted, uPaint);

  // bloom and haze
  vec3 bl = vec3(0.0);
  vec3 hz = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398;
    vec2 o = vec2(cos(an), sin(an));
    vec3 a = scene(p + o * 6.0 * uScale);
    vec3 b = scene(p + o * 14.0 * uScale);
    bl += max(a - 0.78, 0.0) + max(b - 0.78, 0.0) * 0.6;
    hz += a * 0.5 + b * 0.5;
  }
  bl /= 8.0;
  hz /= 8.0;
  col = mix(col, hz, 0.1 * uBloom);
  col += bl * uBloom * 1.3;

  // Monet's palette: violet-blue in the shadows, a warm breath in the lights
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += vec3(0.05, 0.025, 0.09) * (1.0 - l) * uPaint;
  col *= mix(vec3(1.0), vec3(1.045, 1.0, 0.94), smoothstep(0.45, 1.0, l) * uPaint);
  col = mix(vec3(l), col, 1.0 + uVivid * 0.45);

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

function link(gl: WebGLRenderingContext, frag: string, names: string[]) {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Link failed: ${gl.getProgramInfoLog(prog)}`);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) u[n] = gl.getUniformLocation(prog, n);
  return { prog, u };
}

/** Most pixels we will paint across the canvas's width, whatever the screen. */
const MAX_WIDTH = 1400;

export function startValley(canvas: HTMLCanvasElement, initial: Partial<ValleyParams> = {}): ValleyController {
  const params: ValleyParams = { ...VALLEY_DEFAULTS, ...initial };
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL is not available");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const common = ["uRes", "uTime", "uScale", "uMap"];
  const scenePass = link(gl, SCENE_FRAG, [...common, "uFg", "uInfo", "uGirl", "uGirlRect", "uWind", "uDrift", "uLight"]);
  const postPass = link(gl, POST_FRAG, [...common, "uScene", "uPaint", "uBrush", "uBloom", "uVivid"]);

  const makeTex = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  // canvases hold premultiplied colour; have the browser hand it over straight
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  // the foreground is painted once, the girl every frame
  const layers = paintValley(FG_W, FG_H);
  const fgTex = makeTex();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layers.fg);
  const infoTex = makeTex();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layers.info);
  const girl = makeGirl(FG_W, FG_H);
  const girlTex = makeTex();

  const sceneTex = makeTex();
  const fbo = gl.createFramebuffer();
  let fboW = 0;
  let fboH = 0;

  // resolution: CSS size × device pixels × k, where k backs off when frames run slow
  let k = 1;
  let fixedWidth: number | null = null;
  const resize = () => {
    const cw = canvas.clientWidth || 600;
    const ch = canvas.clientHeight || 800;
    let w: number;
    let h: number;
    if (fixedWidth) {
      w = fixedWidth;
      h = Math.round((fixedWidth * ch) / cw / 2) * 2;
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = Math.min(dpr * k, MAX_WIDTH / cw);
      w = Math.max(2, Math.round(cw * s));
      h = Math.max(2, Math.round(ch * s));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (fboW !== w || fboH !== h) {
      fboW = w;
      fboH = h;
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };

  // the picture covers the canvas, cropped evenly if the canvas isn't 3:4
  const mapFor = (w: number, h: number): [number, number, number, number] => {
    const a = w / h;
    if (a > VALLEY_ASPECT) {
      const sy = VALLEY_ASPECT / a;
      return [1, sy, 0, (1 - sy) * 0.5];
    }
    const sx = a / VALLEY_ASPECT;
    return [sx, 1, (1 - sx) * 0.5, 0];
  };

  const start = performance.now();
  let lastNow = start;
  const draw = (now: number) => {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const t = (now - start) / 1000;
    const map = mapFor(w, h);
    const scale = h / 1000;

    // her hair answers the same gusts the trees do
    const gust = 0.5 + 0.5 * Math.sin(t * 0.5) * Math.sin(t * 0.23 + 1);
    girl.draw(t, gust * params.wind * 1.6);
    gl.bindTexture(gl.TEXTURE_2D, girlTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, girl.canvas);

    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.useProgram(scenePass.prog);
    const su = scenePass.u;
    gl.uniform2f(su.uRes, w, h);
    gl.uniform1f(su.uTime, t);
    gl.uniform1f(su.uScale, scale);
    gl.uniform4f(su.uMap, ...map);
    gl.uniform4f(su.uGirlRect, ...GIRL_RECT);
    gl.uniform1f(su.uWind, params.wind * 1.6);
    gl.uniform1f(su.uDrift, params.drift * 2);
    gl.uniform1f(su.uLight, params.light * 1.6);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fgTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, infoTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, girlTex);
    gl.uniform1i(su.uFg, 0);
    gl.uniform1i(su.uInfo, 1);
    gl.uniform1i(su.uGirl, 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(postPass.prog);
    const pu = postPass.u;
    gl.uniform2f(pu.uRes, w, h);
    gl.uniform1f(pu.uTime, t);
    gl.uniform1f(pu.uScale, scale);
    gl.uniform4f(pu.uMap, ...map);
    gl.uniform1f(pu.uPaint, params.paint);
    gl.uniform1f(pu.uBrush, params.brush);
    gl.uniform1f(pu.uBloom, params.bloom);
    gl.uniform1f(pu.uVivid, params.vivid);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(pu.uScene, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    // adapt: back off after a run of slow frames, creep back up after a run of quick ones
    if (prev && !fixedWidth) {
      const dt = now - prev;
      if (dt > 24) {
        slow++;
        fast = 0;
      } else if (dt < 18) {
        fast++;
        slow = 0;
      }
      if (slow > 20 && k > 0.45) {
        k *= 0.85;
        slow = 0;
      } else if (fast > 180 && k < 1) {
        k = Math.min(1, k * 1.08);
        fast = 0;
      }
    }
    prev = now;
  };
  draw(start);
  raf = requestAnimationFrame(tick);

  return {
    setParams(p) {
      Object.assign(params, p);
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
      // the drawing buffer isn't kept, so draw a frame and copy it straight away
      draw(lastNow);
      ctx.drawImage(canvas, 0, 0, width, height);
    },
    setHighQuality(width) {
      fixedWidth = width;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      listeners.clear();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
