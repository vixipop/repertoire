/**
 * Swan pond engine.
 *
 * Two stacked canvases:
 *  - water: a WebGL fragment shader — refracted pond bed, caustics, dappled
 *    leaf shade and an analytic ripple field (clicks, hover, swan wakes).
 *  - swans: 2D canvas on top — swans, their shadows and V-shaped wakes.
 *
 * Everything is sized in "pond units": the pond is designed at 680px wide and
 * `scale` = actual width / 680, so it behaves identically at any size.
 */

const MAX_RIPPLES = 32;
const DESIGN_WIDTH = 680;
const SWAN_COUNT = 3;

type Ripple = { x: number; y: number; t: number; a: number };

type TrailPoint = { x: number; y: number; h: number; v: number; t: number };

type SwanState = "glide" | "flee" | "away" | "return";

type Swan = {
  x: number;
  y: number;
  h: number; // heading (rad)
  w: number; // angular velocity (rad/s)
  v: number; // speed (px/s)
  size: number;
  pace: number; // per-swan speed personality
  state: SwanState;
  tx: number;
  ty: number;
  targetTimer: number;
  loopTime: number;
  loopDir: number;
  fleeAt: number;
  fleeX: number;
  fleeY: number;
  awayUntil: number;
  flapT: number; // -1 when not flapping
  flapDur: number;
  flapBeats: number;
  nextFlap: number;
  tailPhase: number;
  tailAmp: number;
  paddle: number;
  headYaw: number;
  headYawTarget: number;
  nextLook: number;
  trail: TrailPoint[];
  lastTrail: number;
  nextRipple: number;
  lastBeat: number;
};

/* --------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (x: number) => x * x * (3 - 2 * x);

/* --------------------------------------------------------------------------
   Water shader
   -------------------------------------------------------------------------- */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBed;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec4 uRipples[${MAX_RIPPLES}];

const float TAU = 6.28318530718;

// Returns slope of the surface (normalised so a unit-amplitude wave has
// slope ~1) — ripples are summed analytically, no simulation texture.
vec2 slope(vec2 p) {
  float lambda = 17.0 * uScale;
  float k = TAU / lambda;
  float c = 92.0 * uScale;
  float w = 24.0 * uScale;
  float fall = 85.0 * uScale;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 5.5) continue;
    vec2 dv = p - r.xy;
    float d = length(dv) + 0.0001;
    float x = d - c * age;
    float env = exp(-x * x / (w * w)) * exp(-age * 0.9) * r.w / (1.0 + d / fall);
    // fade the very centre in so the drop point isn't a hard spike
    env *= smoothstep(0.0, 6.0 * uScale, d);
    float dh = env * (k * cos(x * k) - sin(x * k) * 2.0 * x / (w * w));
    g += dh * dv / d;
  }
  // slow ambient swell so the surface is never glassy-still
  vec2 q = p / uScale;
  g.x += 0.05 * cos(q.x * 0.021 + uTime * 0.7) * sin(q.y * 0.017 - uTime * 0.5) * 0.021 * uScale;
  g.y += 0.05 * sin(q.x * 0.021 + uTime * 0.7) * cos(q.y * 0.017 - uTime * 0.5) * 0.017 * uScale;
  g.x += 0.03 * cos(q.x * 0.043 - q.y * 0.02 + uTime * 1.1) * 0.043 * uScale;
  return g / k;
}

// Classic iterative caustic pattern.
float caustic(vec2 uv, float t) {
  vec2 p = uv * TAU - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

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

// Dappled shade from overhanging leaves — swaying, never still.
float shade(vec2 p, float t) {
  vec2 q = p / (150.0 * uScale);
  vec2 sway = vec2(sin(t * 0.23) * 0.18 + sin(t * 0.61) * 0.05, cos(t * 0.19) * 0.12);
  float n = fbm(q + sway + vec2(3.1, 0.0));
  n += 0.18 * fbm(q * 3.1 - sway * 2.0);
  // heavier canopy along the top-right, like an overhanging tree
  float canopy = smoothstep(1.1, 0.1, distance(p / uRes, vec2(0.95, -0.05)));
  return smoothstep(0.52, 0.72, n + canopy * 0.22) * (0.35 + canopy * 0.65);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 g = slope(p);

  // refract the bed through the surface
  vec2 off = g * 9.0 * uScale;
  vec2 buv = clamp((p + off) / uRes, vec2(0.001), vec2(0.999));
  vec3 bed = texture2D(uBed, buv).rgb;

  float sh = shade(p + off * 0.5, uTime);

  // caustics dance on the bed, bent further by the ripples
  vec2 cp = (p + off * 2.4) / (300.0 * uScale);
  float ca = caustic(cp, uTime * 0.3 + 23.0);
  ca = ca * 0.75 + 0.35 * caustic(cp * 1.7 + 3.7, uTime * 0.25 + 11.0);
  ca = min(ca, 1.6);

  vec3 deep = vec3(0.10, 0.27, 0.19);
  vec3 col = mix(bed, deep, 0.22);
  col += vec3(0.78, 1.0, 0.80) * ca * 0.38 * (1.0 - sh * 0.85);
  col *= 1.0 - sh * 0.5;

  // ripple lighting: faces tilted toward the sun (top-left) catch light
  float lit = dot(-g, normalize(vec2(-0.55, -0.83)));
  col += vec3(0.85, 1.0, 0.92) * max(lit, 0.0) * 0.16 * (1.0 - sh * 0.6);
  col -= vec3(0.05, 0.06, 0.05) * max(-lit, 0.0) * 0.9;

  // sparkles where the surface bends sharply in the sun
  float glint = smoothstep(0.55, 1.0, lit) * (1.0 - sh);
  col += glint * 0.25;

  // sky sheen, stronger toward the far (top) edge
  col += vec3(0.06, 0.09, 0.07) * smoothstep(0.35, 1.0, vUv.y);

  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;

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

/* --------------------------------------------------------------------------
   Pond bed — painted once per size into an offscreen canvas, used as texture
   -------------------------------------------------------------------------- */

function paintBed(W: number, H: number, scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(W));
  c.height = Math.max(1, Math.round(H));
  const ctx = c.getContext("2d")!;
  const r = mulberry32(7);

  // base: mossy green, lighter in the shallows toward the bottom-left
  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  base.addColorStop(0, "#3f6650");
  base.addColorStop(0.55, "#5b8460");
  base.addColorStop(1, "#7e9c6c");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // soft mottling — silt, moss, algae
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (12 + r() * 60) * scale;
    const light = r() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, light ? "rgba(170,190,130,0.10)" : "rgba(15,40,28,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // grain
  for (let i = 0; i < 2600; i++) {
    const x = r() * W;
    const y = r() * H;
    ctx.fillStyle = r() > 0.5 ? "rgba(210,220,170,0.07)" : "rgba(10,30,20,0.09)";
    ctx.fillRect(x, y, 1.3 * scale, 1.3 * scale);
  }

  // stones: clustered along the edges, a few scattered mid-pond
  const stonePalette = ["#7b8570", "#8a927c", "#697562", "#959b83", "#737c66", "#a1a58c"];
  const clusters: Array<[number, number, number, number]> = [
    [0.88, 0.86, 9, 0.14],
    [0.08, 0.9, 7, 0.1],
    [0.93, 0.18, 6, 0.1],
    [0.1, 0.12, 4, 0.08],
    [0.52, 0.94, 5, 0.1],
    [0.4, 0.45, 2, 0.05],
    [0.7, 0.55, 1, 0.02],
  ];
  const stones: Array<{ x: number; y: number; rx: number; ry: number; a: number; col: string }> = [];
  for (const [cx, cy, n, spread] of clusters) {
    for (let i = 0; i < n; i++) {
      const rx = (7 + r() * 22) * scale * (r() > 0.85 ? 1.7 : 1);
      stones.push({
        x: (cx + (r() - 0.5) * spread * 2) * W,
        y: (cy + (r() - 0.5) * spread * 2 * (W / H) * 0.6) * H,
        rx,
        ry: rx * (0.55 + r() * 0.35),
        a: r() * Math.PI,
        col: stonePalette[Math.floor(r() * stonePalette.length)],
      });
    }
  }
  stones.sort((a, b) => a.y - b.y);
  const blob = (rx: number, ry: number, seed: number[]) => {
    const n = seed.length;
    const pts = seed.map((j, i) => {
      const a = (i / n) * Math.PI * 2;
      return [Math.cos(a) * rx * j, Math.sin(a) * ry * j];
    });
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = pts[i % n];
      const b = pts[(i + 1) % n];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(a[0], a[1], mx, my);
    }
    ctx.closePath();
  };
  for (const s of stones) {
    const seed = Array.from({ length: 9 }, () => 0.82 + r() * 0.3);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    // contact shadow, falling down-right
    ctx.save();
    ctx.translate(s.rx * 0.18, s.ry * 0.32);
    ctx.fillStyle = "rgba(10,30,18,0.4)";
    blob(s.rx * 1.06, s.ry * 1.08, seed);
    ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(-s.rx * 0.8, -s.ry, s.rx * 0.8, s.ry);
    g.addColorStop(0, "rgba(190,196,170,1)");
    g.addColorStop(0.3, s.col);
    g.addColorStop(1, "#2f3d31");
    ctx.fillStyle = g;
    blob(s.rx, s.ry, seed);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // pitted texture + moss
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() > 0.5 ? "rgba(30,40,30,0.18)" : "rgba(220,225,200,0.12)";
      ctx.fillRect((r() - 0.5) * s.rx * 2, (r() - 0.5) * s.ry * 2, 1.6 * scale, 1.6 * scale);
    }
    ctx.fillStyle = "rgba(80,115,55,0.3)";
    ctx.beginPath();
    ctx.ellipse(s.rx * 0.35, s.ry * 0.3, s.rx * 0.7, s.ry * 0.55, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // submerged weeds swaying from the corners
  const weed = (bx: number, by: number, dir: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const len = (40 + r() * 70) * scale;
      const ang = dir + (r() - 0.5) * 1.1;
      const bend = (r() - 0.5) * 0.9;
      const ex = bx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len;
      const mx = bx + Math.cos(ang + bend) * len * 0.55;
      const my = by + Math.sin(ang + bend) * len * 0.55;
      const wdt = (2.2 + r() * 2.5) * scale;
      const nx = -Math.sin(ang) * wdt;
      const ny = Math.cos(ang) * wdt;
      ctx.fillStyle = r() > 0.5 ? "rgba(24,58,34,0.75)" : "rgba(40,82,44,0.7)";
      ctx.beginPath();
      ctx.moveTo(bx + nx, by + ny);
      ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey);
      ctx.quadraticCurveTo(mx - nx, my - ny, bx - nx, by - ny);
      ctx.closePath();
      ctx.fill();
    }
  };
  weed(W * 0.02, H * 0.98, -0.7, 22);
  weed(W * 0.98, H * 0.05, 2.3, 16);
  weed(W * 0.99, H * 0.7, 3.0, 10);

  // a few fallen leaves on the bed
  for (let i = 0; i < 7; i++) {
    ctx.save();
    ctx.translate(r() * W, r() * H);
    ctx.rotate(r() * Math.PI * 2);
    ctx.fillStyle = r() > 0.5 ? "rgba(150,120,60,0.55)" : "rgba(120,110,55,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 * scale, 2.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return c;
}

/* --------------------------------------------------------------------------
   Engine
   -------------------------------------------------------------------------- */

export function startPond(
  host: HTMLElement,
  waterCanvas: HTMLCanvasElement,
  swanCanvas: HTMLCanvasElement,
): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = reduceMotion ? 0.55 : 1;

  /* ---------- sizing ---------- */

  let W = host.clientWidth || DESIGN_WIDTH;
  let H = host.clientHeight || DESIGN_WIDTH * 0.62;
  let scale = W / DESIGN_WIDTH;
  let L = 78 * scale; // nominal swan length

  /* ---------- WebGL water ---------- */

  const gl = waterCanvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
  let uRes: WebGLUniformLocation | null = null;
  let uTime: WebGLUniformLocation | null = null;
  let uScale: WebGLUniformLocation | null = null;
  let uRipples: WebGLUniformLocation | null = null;
  let bedTex: WebGLTexture | null = null;

  if (gl) {
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(prog, "uRes");
      uTime = gl.getUniformLocation(prog, "uTime");
      uScale = gl.getUniformLocation(prog, "uScale");
      uRipples = gl.getUniformLocation(prog, "uRipples");
      gl.uniform1i(gl.getUniformLocation(prog, "uBed"), 0);

      bedTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bedTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (err) {
      console.warn("[swan-pond] water shader unavailable, using flat water", err);
      bedTex = null;
    }
  }
  const hasWater = !!(gl && bedTex);
  host.dataset.water = hasWater ? "shader" : "flat";

  const ctx = swanCanvas.getContext("2d")!;
  let dpr = 1;

  const resize = () => {
    const nw = host.clientWidth;
    const nh = host.clientHeight;
    if (!nw || !nh) return;
    const sx = nw / W;
    const sy = nh / H;
    for (const s of swans) {
      s.x *= sx;
      s.y *= sy;
      s.tx *= sx;
      s.ty *= sy;
      s.trail.length = 0;
    }
    for (const r of ripples) {
      r.x *= sx;
      r.y *= sy;
    }
    W = nw;
    H = nh;
    scale = W / DESIGN_WIDTH;
    L = 78 * scale;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    swanCanvas.width = Math.round(W * dpr);
    swanCanvas.height = Math.round(H * dpr);

    if (hasWater && gl) {
      // the shader is the heavy part; cap its resolution a little lower
      const wd = Math.min(window.devicePixelRatio || 1, 1.5);
      waterCanvas.width = Math.round(W * wd);
      waterCanvas.height = Math.round(H * wd);
      gl.viewport(0, 0, waterCanvas.width, waterCanvas.height);
      gl.bindTexture(gl.TEXTURE_2D, bedTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintBed(W, H, scale));
    }
  };

  /* ---------- ripples ---------- */

  const ripples: Ripple[] = [];
  const rippleData = new Float32Array(MAX_RIPPLES * 4);
  let clock = 0;

  const addRipple = (x: number, y: number, a: number, delay = 0) => {
    if (ripples.length >= MAX_RIPPLES) {
      // replace the oldest — it's the faintest
      let oldest = 0;
      for (let i = 1; i < ripples.length; i++) if (ripples[i].t < ripples[oldest].t) oldest = i;
      ripples.splice(oldest, 1);
    }
    ripples.push({ x, y, t: clock + delay, a });
  };

  /* ---------- swans ---------- */

  const swans: Swan[] = [];
  const glideSpeed = (s: Swan) => 0.55 * L * s.pace * motion;

  const inner = (m: number) => ({ x0: m, y0: m, x1: W - m, y1: H - m });

  const pickWaypoint = (s: Swan) => {
    const b = inner(1.7 * L);
    // favour distant points, so paths become long sweeping arcs
    let best = { x: W / 2, y: H / 2 };
    let bestD = -1;
    for (let i = 0; i < 4; i++) {
      const x = rand(b.x0, b.x1);
      const y = rand(b.y0, b.y1);
      const d = Math.hypot(x - s.x, y - s.y);
      if (d > bestD) {
        best = { x, y };
        bestD = d;
      }
      if (d > W * 0.35 && Math.random() < 0.6) break;
    }
    s.tx = best.x;
    s.ty = best.y;
    s.targetTimer = rand(9, 16);
  };

  const makeSwan = (i: number): Swan => {
    const s: Swan = {
      x: W * (0.25 + 0.25 * i) + rand(-30, 30) * scale,
      y: H * rand(0.3, 0.7),
      h: rand(-Math.PI, Math.PI),
      w: 0,
      v: 0,
      size: [1.06, 0.94, 1][i % 3],
      pace: rand(0.85, 1.1),
      state: "glide",
      tx: 0,
      ty: 0,
      targetTimer: 0,
      loopTime: 0,
      loopDir: 1,
      fleeAt: -1,
      fleeX: 0,
      fleeY: 0,
      awayUntil: 0,
      flapT: -1,
      flapDur: 2,
      flapBeats: 3,
      nextFlap: rand(6, 18),
      tailPhase: rand(0, 10),
      tailAmp: 0.05,
      paddle: rand(0, 10),
      headYaw: 0,
      headYawTarget: 0,
      nextLook: rand(1, 4),
      trail: [],
      lastTrail: 0,
      nextRipple: rand(0, 2),
      lastBeat: 0,
    };
    s.v = glideSpeed(s);
    pickWaypoint(s);
    return s;
  };
  for (let i = 0; i < SWAN_COUNT; i++) swans.push(makeSwan(i));

  const startFlap = (s: Swan, quick: boolean) => {
    if (s.flapT >= 0) return;
    s.flapT = 0;
    s.flapDur = quick ? rand(1.1, 1.4) : rand(1.8, 2.6);
    s.flapBeats = quick ? 3 : Math.random() < 0.35 ? 1 : rand(2, 4);
    s.lastBeat = 0;
  };

  const flapSpread = (s: Swan) => {
    if (s.flapT < 0) return 0;
    const u = clamp(s.flapT / s.flapDur, 0, 1);
    const env = smooth(Math.sin(Math.PI * u));
    const beat = 0.5 + 0.5 * Math.cos(u * s.flapBeats * Math.PI * 2);
    return env * (0.55 + 0.45 * beat);
  };

  const spawnReturn = (s: Swan) => {
    const b = inner(2.2 * L);
    s.tx = rand(b.x0 + W * 0.1, b.x1 - W * 0.1);
    s.ty = rand(b.y0, b.y1);
    const perim = 2 * (W + H);
    const pos = Math.random() * perim;
    const out = 1.3 * L * s.size;
    const along = (t: number, len: number) => len * (0.15 + 0.7 * t);
    if (pos < W) {
      s.x = along(pos / W, W);
      s.y = -out;
    } else if (pos < W + H) {
      s.x = W + out;
      s.y = along((pos - W) / H, H);
    } else if (pos < 2 * W + H) {
      s.x = along((pos - W - H) / W, W);
      s.y = H + out;
    } else {
      s.x = -out;
      s.y = along((pos - 2 * W - H) / H, H);
    }
    s.h = Math.atan2(s.ty - s.y, s.tx - s.x) + rand(-0.45, 0.45);
    s.w = 0;
    s.v = glideSpeed(s) * 1.6;
    s.state = "return";
    s.trail.length = 0;
    s.flapT = -1;
    s.headYawTarget = 0;
  };

  /* ---------- pointer ---------- */

  let pointer: { x: number; y: number } | null = null;
  let lastHover = { x: -1e9, y: -1e9, t: -1 };

  const local = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onMove = (e: PointerEvent) => {
    const p = local(e);
    pointer = p;
    const d = Math.hypot(p.x - lastHover.x, p.y - lastHover.y);
    if (d > 20 * scale && clock - lastHover.t > 0.05) {
      addRipple(p.x, p.y, clamp(0.12 + d / (160 * scale), 0.14, 0.34));
      lastHover = { x: p.x, y: p.y, t: clock };
    }
  };
  const onLeave = () => {
    pointer = null;
  };
  const onDown = (e: PointerEvent) => {
    const p = local(e);
    addRipple(p.x, p.y, 1.0);
    addRipple(p.x, p.y, 0.45, 0.22);
    for (const s of swans) {
      if (s.state === "away" || s.state === "flee" || s.fleeAt >= 0) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      // nearer swans notice first
      s.fleeAt = clock + 0.1 + d / (W * 1.4) + rand(0, 0.25);
      s.fleeX = p.x;
      s.fleeY = p.y;
    }
  };

  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerdown", onDown);

  /* ---------- simulation ---------- */

  const update = (s: Swan, dt: number) => {
    if (s.state === "away") {
      if (clock >= s.awayUntil) spawnReturn(s);
      else return;
    }

    const sz = L * s.size;
    const dirX = Math.cos(s.h);
    const dirY = Math.sin(s.h);

    if (s.fleeAt >= 0 && clock >= s.fleeAt) {
      s.fleeAt = -1;
      s.state = "flee";
      s.loopTime = 0;
      let ax = s.x - s.fleeX;
      let ay = s.y - s.fleeY;
      const d = Math.hypot(ax, ay);
      if (d < 1) {
        ax = dirX;
        ay = dirY;
      } else {
        ax /= d;
        ay /= d;
      }
      // don't flee straight back; blend with current heading so the turn is a sweep
      const bx = ax * 0.8 + dirX * 0.35;
      const by = ay * 0.8 + dirY * 0.35;
      const bl = Math.hypot(bx, by) || 1;
      s.tx = s.x + (bx / bl) * (W + H);
      s.ty = s.y + (by / bl) * (W + H);
      s.headYawTarget = 0;
      if (Math.random() < 0.6) startFlap(s, true);
    }

    let vTarget = glideSpeed(s);
    let maxTurn = 0.36;
    let angAcc = 0.45;
    let accel = 0.8;
    let loopOverride: number | null = null;

    let dx = s.tx - s.x;
    let dy = s.ty - s.y;
    let dl = Math.hypot(dx, dy) || 1;
    let wantX = dx / dl;
    let wantY = dy / dl;

    if (s.state === "glide") {
      s.targetTimer -= dt;
      if (dl < 1.8 * sz || s.targetTimer <= 0) pickWaypoint(s);

      // steer back in if the path ahead would leave the pond
      const m = 1.4 * L;
      const lx = s.x + dirX * 2.6 * L;
      const ly = s.y + dirY * 2.6 * L;
      let edge = false;
      if (lx < m || lx > W - m || ly < m || ly > H - m) {
        edge = true;
        const cx = W / 2 - s.x;
        const cy = H / 2 - s.y;
        const cl = Math.hypot(cx, cy) || 1;
        wantX += (cx / cl) * 1.6;
        wantY += (cy / cl) * 1.6;
      }

      // occasional lazy full loop, only where there's room
      if (s.loopTime > 0) {
        if (edge) s.loopTime = 0;
        else {
          s.loopTime -= dt;
          loopOverride = s.loopDir * maxTurn * 0.85;
        }
      } else if (!edge && Math.random() < dt * 0.035) {
        const rad = s.v / (maxTurn * 0.85);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const cx = s.x - dirY * dir * rad;
        const cy = s.y + dirX * dir * rad;
        const room = rad + 1.5 * L;
        if (cx > room && cx < W - room && cy > room && cy < H - room) {
          s.loopDir = dir;
          s.loopTime = ((Math.PI * 2) / (maxTurn * 0.85)) * rand(0.75, 1.15);
        }
      }

      s.nextFlap -= dt;
      if (s.nextFlap <= 0) {
        startFlap(s, false);
        s.nextFlap = rand(10, 24);
      }
    } else if (s.state === "flee") {
      vTarget = glideSpeed(s) * 2.3;
      maxTurn = 0.95;
      angAcc = 1.7;
      accel = 1.6;
      const out = 1.4 * sz;
      if (s.x < -out || s.x > W + out || s.y < -out || s.y > H + out) {
        s.state = "away";
        s.awayUntil = clock + rand(1.6, 4.4);
        s.trail.length = 0;
        return;
      }
    } else if (s.state === "return") {
      vTarget = glideSpeed(s) * 1.15;
      maxTurn = 0.5;
      angAcc = 0.7;
      accel = 0.5;
      const m = 1.3 * L;
      if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) {
        s.state = "glide";
        s.targetTimer = rand(6, 12);
        s.nextFlap = rand(4, 14);
      }
    }

    // keep personal space
    for (const o of swans) {
      if (o === s || o.state === "away") continue;
      const ox = s.x - o.x;
      const oy = s.y - o.y;
      const od = Math.hypot(ox, oy);
      const R = 2.5 * L;
      if (od > 0 && od < R) {
        const f = ((R - od) / R) * 1.8;
        wantX += (ox / od) * f;
        wantY += (oy / od) * f;
      }
    }

    // shy of the cursor, gently
    if (pointer && s.state !== "flee") {
      const px = s.x - pointer.x;
      const py = s.y - pointer.y;
      const pd = Math.hypot(px, py);
      const R = 1.9 * L;
      if (pd > 0 && pd < R) {
        const f = ((R - pd) / R) * 1.4;
        wantX += (px / pd) * f;
        wantY += (py / pd) * f;
        vTarget *= 1 + f * 0.25;
        loopOverride = null;
        s.loopTime = 0;
      }
    }

    // flapping pushes them along a little
    const spread = flapSpread(s);
    vTarget *= 1 + spread * 0.35;

    const desired = Math.atan2(wantY, wantX);
    const diff = wrapAngle(desired - s.h);
    const targetW = loopOverride ?? clamp(diff * 0.9, -maxTurn, maxTurn);
    s.w += clamp(targetW - s.w, -angAcc * dt, angAcc * dt);
    s.h = wrapAngle(s.h + s.w * dt);
    s.v += (vTarget - s.v) * (1 - Math.exp(-dt * accel));

    s.x += Math.cos(s.h) * s.v * dt;
    s.y += Math.sin(s.h) * s.v * dt;

    /* ---- animation state ---- */
    const speedRatio = s.v / L;
    const fleeing = s.state === "flee";
    const ampTarget = 0.04 + speedRatio * 0.03 + (fleeing ? 0.34 : 0) + spread * 0.12;
    s.tailAmp += (ampTarget - s.tailAmp) * (1 - Math.exp(-dt * 4));
    s.tailPhase += dt * (2.5 + speedRatio * 5 + (fleeing ? 8 : 0));
    s.paddle += dt * (1.8 + speedRatio * 4.5);

    if (s.flapT >= 0) {
      const prev = s.flapT;
      s.flapT += dt;
      // a light splash at the wingtips on each downstroke
      const beatLen = s.flapDur / s.flapBeats;
      if (Math.floor(s.flapT / beatLen) > Math.floor(prev / beatLen) && s.flapT < s.flapDur) {
        const reach = (0.4 + spread * 0.9) * sz;
        addRipple(s.x - dirY * reach, s.y + dirX * reach, 0.16);
        addRipple(s.x + dirY * reach, s.y - dirX * reach, 0.16);
      }
      if (s.flapT >= s.flapDur) s.flapT = -1;
    }

    s.nextLook -= dt;
    if (s.nextLook <= 0 && !fleeing) {
      s.headYawTarget = Math.random() < 0.3 ? 0 : rand(-0.55, 0.55);
      s.nextLook = rand(2.5, 7);
    }
    if (fleeing) s.headYawTarget = 0;
    s.headYaw += (s.headYawTarget - s.headYaw) * (1 - Math.exp(-dt * 1.6));

    if (clock - s.lastTrail > 0.09) {
      s.trail.push({ x: s.x, y: s.y, h: s.h, v: s.v, t: clock });
      s.lastTrail = clock;
    }
    while (s.trail.length && clock - s.trail[0].t > 2.6) s.trail.shift();

    s.nextRipple -= dt;
    if (s.nextRipple <= 0) {
      addRipple(s.x + dirX * 0.4 * sz, s.y + dirY * 0.4 * sz, fleeing ? 0.2 : 0.11);
      s.nextRipple = fleeing ? rand(0.3, 0.45) : rand(1.3, 2.3);
    }
  };

  /* ---------- drawing ---------- */

  const drawWake = (s: Swan) => {
    const tr = s.trail;
    if (tr.length < 2) return;
    const life = 2.6;
    const sz = L * s.size;
    ctx.lineCap = "round";
    for (const arm of [1, -1]) {
      for (const [k, alphaMul] of [
        [1, 1],
        [0.62, 0.45],
      ] as const) {
        let px = 0;
        let py = 0;
        for (let i = tr.length - 1; i >= 0; i--) {
          const p = tr[i];
          const age = clock - p.t;
          const lat = (0.2 * sz + 0.36 * p.v * age) * k;
          const nx = -Math.sin(p.h) * lat * arm;
          const ny = Math.cos(p.h) * lat * arm;
          // push the start back along the body so arms leave from the chest
          const x = p.x + nx + Math.cos(p.h) * 0.25 * sz;
          const y = p.y + ny + Math.sin(p.h) * 0.25 * sz;
          if (i < tr.length - 1) {
            const fade = 1 - age / life;
            const strength = clamp(p.v / (0.5 * L), 0.35, 1.6);
            ctx.strokeStyle = `rgba(225,245,235,${0.2 * fade * fade * strength * alphaMul})`;
            ctx.lineWidth = (1.1 + age * 0.9) * scale;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          px = x;
          py = y;
        }
      }
    }
  };

  const drawShadow = (s: Swan) => {
    const sz = L * s.size;
    const spread = flapSpread(s);
    ctx.save();
    ctx.translate(s.x + 0.14 * sz, s.y + 0.2 * sz);
    ctx.rotate(s.h);
    ctx.scale(1, 0.5 + spread * 0.9);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.62 * sz);
    g.addColorStop(0, "rgba(4,22,14,0.38)");
    g.addColorStop(0.6, "rgba(4,22,14,0.18)");
    g.addColorStop(1, "rgba(4,22,14,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 0.62 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // light comes from the top-left in world space
  const LIGHT = { x: -0.55, y: -0.83 };

  const drawSwan = (s: Swan) => {
    const sz = L * s.size;
    const speedRatio = s.v / L;
    const sway = Math.sin(s.paddle) * 0.018 * Math.min(speedRatio, 2);
    const rot = s.h + sway;
    const px = 1 / sz; // one CSS pixel in local units

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(rot);
    ctx.scale(sz, sz);

    // light direction in local space
    const lx = LIGHT.x * Math.cos(-rot) - LIGHT.y * Math.sin(-rot);
    const ly = LIGHT.x * Math.sin(-rot) + LIGHT.y * Math.cos(-rot);
    const shadeGrad = (r: number, cx = 0, cy = 0) => {
      const g = ctx.createLinearGradient(cx + lx * r, cy + ly * r, cx - lx * r, cy - ly * r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#f3f5f2");
      g.addColorStop(1, "#cfd6d0");
      return g;
    };
    const outline = "rgba(20,45,35,0.22)";

    // feet, paddling under water
    const footA = clamp(speedRatio * 0.5, 0.12, 0.45);
    for (const side of [1, -1]) {
      const ph = s.paddle + (side > 0 ? 0 : Math.PI);
      const fx = -0.28 + Math.sin(ph) * 0.07;
      const fy = side * 0.17;
      ctx.fillStyle = `rgba(20,24,22,${footA})`;
      ctx.beginPath();
      ctx.moveTo(fx + 0.1, fy * 0.8);
      ctx.lineTo(fx - 0.12, fy + side * 0.1 * (0.6 + 0.4 * Math.cos(ph)));
      ctx.lineTo(fx - 0.12, fy - side * 0.03);
      ctx.closePath();
      ctx.fill();
    }

    // tail — the jiggle lives here
    const jig = Math.sin(s.tailPhase) * s.tailAmp + Math.sin(s.tailPhase * 2.3 + 1) * s.tailAmp * 0.3;
    ctx.save();
    ctx.translate(-0.47, 0);
    ctx.rotate(jig);
    for (const [ang, len] of [
      [0.32, 0.15],
      [-0.32, 0.15],
      [0.14, 0.2],
      [-0.14, 0.2],
      [0, 0.23],
    ] as const) {
      const a = ang * (1 + s.tailAmp * 1.5);
      const ex = -Math.cos(a) * len;
      const ey = Math.sin(a) * len;
      const nx = -Math.sin(a) * 0.045;
      const ny = -Math.cos(a) * 0.045;
      ctx.fillStyle = shadeGrad(0.2);
      ctx.strokeStyle = outline;
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(nx * 0.5, ny * 0.5);
      ctx.quadraticCurveTo(ex * 0.5 + nx, ey * 0.5 + ny, ex, ey);
      ctx.quadraticCurveTo(ex * 0.5 - nx, ey * 0.5 - ny, -nx * 0.5, -ny * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // body
    ctx.fillStyle = shadeGrad(0.4);
    ctx.strokeStyle = outline;
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(0.44, 0);
    ctx.bezierCurveTo(0.44, 0.19, 0.18, 0.26, -0.04, 0.26);
    ctx.bezierCurveTo(-0.3, 0.25, -0.5, 0.15, -0.55, 0);
    ctx.bezierCurveTo(-0.5, -0.15, -0.3, -0.25, -0.04, -0.26);
    ctx.bezierCurveTo(0.18, -0.26, 0.44, -0.19, 0.44, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // wings
    const spread = flapSpread(s);
    for (const side of [1, -1]) {
      const theta = spread * 1.45;
      const len = 0.68 + spread * 0.8;
      const cw = 0.19 + spread * 0.07;
      ctx.save();
      ctx.translate(0.2, side * 0.09);
      ctx.rotate(-side * theta);
      // local wing frame: backward = -x, outward = side * y
      const P = (b: number, o: number): [number, number] => [-b, side * o];

      ctx.fillStyle = shadeGrad(0.35, -len * 0.5, side * cw * 0.3);
      ctx.strokeStyle = "rgba(20,45,35,0.14)";
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(...P(0, 0));
      ctx.bezierCurveTo(...P(0.2 * len, cw * 1.15), ...P(0.62 * len, cw * 1.0), ...P(len, cw * 0.28));
      // trailing edge: scalloped feather tips back to the shoulder
      const tips = 6;
      for (let i = 1; i <= tips; i++) {
        const u = 1 - i / (tips + 1);
        const b = u * len;
        const o = -0.045 + (1 - u) * 0.02;
        const next = P(b, o);
        // folded, the tips lie flat; opened, each primary shows
        const ctl = P(b + len * 0.11, o - 0.012 - spread * 0.045);
        ctx.quadraticCurveTo(ctl[0], ctl[1], next[0], next[1]);
      }
      ctx.quadraticCurveTo(...P(0.02, -0.04), ...P(0, 0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // feather lines
      ctx.strokeStyle = `rgba(40,60,50,${0.03 + spread * 0.12})`;
      ctx.lineWidth = px * 0.9;
      for (let i = 1; i <= 4; i++) {
        const u = 0.35 + i * 0.13;
        ctx.beginPath();
        ctx.moveTo(...P(u * len * 0.7, cw * 0.7));
        ctx.lineTo(...P(u * len, -0.02));
        ctx.stroke();
      }
      ctx.restore();
    }

    // neck — bends into the turn, stretches when fleeing
    const fleeing = s.state === "flee";
    const bend = clamp(s.w * 0.9 + s.headYaw * 0.55, -0.9, 0.9);
    const nl = fleeing ? 0.42 : 0.36;
    const bx = 0.2;
    const hx = bx + Math.cos(bend) * nl;
    const hy = Math.sin(bend) * nl;
    const cx = bx + 0.26;
    const cy = 0;
    const pts: Array<[number, number, number]> = [];
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * hx;
      const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * cy + t * t * hy;
      pts.push([x, y, 0.125 - 0.06 * Math.sqrt(t)]);
    }
    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl;
      const ny = tx / tl;
      left.push([pts[i][0] + nx * pts[i][2], pts[i][1] + ny * pts[i][2]]);
      right.push([pts[i][0] - nx * pts[i][2], pts[i][1] - ny * pts[i][2]]);
    }
    // soft breast where the neck rises out of the body — no outline, so the
    // join reads as one continuous form over the wing shoulders
    ctx.fillStyle = shadeGrad(0.4);
    ctx.beginPath();
    ctx.ellipse(0.27, 0, 0.17, 0.165, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeGrad(0.4);
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    // outline only the upper neck; the lower part melts into the breast
    ctx.strokeStyle = outline;
    ctx.lineWidth = px;
    for (const edge of [left, right]) {
      ctx.beginPath();
      ctx.moveTo(edge[4][0], edge[4][1]);
      for (let i = 5; i < edge.length; i++) ctx.lineTo(edge[i][0], edge[i][1]);
      ctx.stroke();
    }

    // head + beak
    const ha = bend * 1.25 + s.headYaw * 0.4;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ha);
    ctx.fillStyle = shadeGrad(0.1);
    ctx.strokeStyle = outline;
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.ellipse(0.015, 0, 0.115, 0.082, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // black facial mask + knob
    ctx.fillStyle = "#1c1d1b";
    ctx.beginPath();
    ctx.ellipse(0.105, 0, 0.04, 0.052, 0, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = "#e9763c";
    ctx.beginPath();
    ctx.moveTo(0.105, 0.038);
    ctx.quadraticCurveTo(0.23, 0.032, 0.285, 0.009);
    ctx.quadraticCurveTo(0.296, 0, 0.285, -0.009);
    ctx.quadraticCurveTo(0.23, -0.032, 0.105, -0.038);
    ctx.closePath();
    ctx.fill();
    // highlight along the ridge
    ctx.strokeStyle = "rgba(255,200,160,0.55)";
    ctx.lineWidth = px * 1.1;
    ctx.beginPath();
    ctx.moveTo(0.14, 0);
    ctx.lineTo(0.26, 0);
    ctx.stroke();
    // nail
    ctx.fillStyle = "#2a2622";
    ctx.beginPath();
    ctx.ellipse(0.28, 0, 0.015, 0.011, 0, 0, Math.PI * 2);
    ctx.fill();
    // knob on top
    ctx.fillStyle = "#151614";
    ctx.beginPath();
    ctx.ellipse(0.115, 0, 0.03, 0.021, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = "#0d0d0c";
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.arc(0.055, side * 0.066, 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  };

  /* ---------- loop ---------- */

  let raf = 0;
  let last = performance.now();
  let visible = true;
  let pageVisible = !document.hidden;

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    for (const s of swans) update(s, dt * motion);

    // drop ripples that have fully faded
    for (let i = ripples.length - 1; i >= 0; i--) if (clock - ripples[i].t > 5.5) ripples.splice(i, 1);

    if (hasWater && gl) {
      rippleData.fill(0);
      ripples.forEach((r, i) => {
        rippleData[i * 4] = r.x;
        rippleData[i * 4 + 1] = r.y;
        rippleData[i * 4 + 2] = r.t;
        rippleData[i * 4 + 3] = r.a;
      });
      gl.uniform2f(uRes, W, H);
      gl.uniform1f(uTime, clock);
      gl.uniform1f(uScale, scale);
      gl.uniform4fv(uRipples, rippleData);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const live = swans.filter((s) => s.state !== "away");
    for (const s of live) drawWake(s);
    for (const s of live) drawShadow(s);
    // draw back-to-front so overlapping swans stack sensibly
    live.sort((a, b) => a.y - b.y);
    for (const s of live) drawSwan(s);

    scheduleFromFrame();
  };

  const schedule = () => {
    if (!raf && visible && pageVisible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  // `last` is reset on resume so a paused pond doesn't jump forward
  const scheduleFromFrame = () => {
    if (!raf && visible && pageVisible) raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  io.observe(host);

  const onVis = () => {
    pageVisible = !document.hidden;
    schedule();
  };
  document.addEventListener("visibilitychange", onVis);

  const ro = new ResizeObserver(() => resize());
  ro.observe(host);

  resize();
  schedule();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("pointerdown", onDown);
    const lose = gl?.getExtension("WEBGL_lose_context");
    lose?.loseContext();
  };
}
