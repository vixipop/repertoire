/**
 * The sky: a bright, cool, sunny day, fair-weather cumulus drifting past.
 *
 * Two passes:
 *  1. Clouds (at reduced resolution): each pixel's ray climbs into a slab of
 *     cloud between 1.5 and 3.3 km and is marched through a 3D noise density.
 *     At every step a few more samples run toward the sun, so the light that
 *     reaches each bit of cloud is computed, not painted: tops and sunward
 *     sides glow, bases fall into soft blue-grey shadow, thin edges go silver.
 *     Distant clouds sink into the horizon haze.
 *  2. Finish (full resolution): a soft upsample, bloom where the sunlit tops
 *     are brightest, a gentle grade, vignette and dither, and optionally the
 *     swan pond's brush dabs.
 *
 * Resolution adapts to keep the frame rate up, and can be pinned to a fixed
 * width for recording.
 */

export type SkyParams = {
  /** how much of the sky is cloud */
  cover: number;
  /** how fast the clouds pass */
  wind: number;
  /** how high the sun stands */
  sun: number;
  bloom: number;
  /** how much the image is softened */
  soft: number;
  /** brush dabs over everything, as on the pond */
  paint: number;
};

export const SKY_DEFAULTS: SkyParams = {
  cover: 0.45,
  wind: 0.5,
  sun: 0.6,
  bloom: 0.5,
  soft: 0.35,
  paint: 0,
};

export type SkyController = {
  setParams(p: Partial<SkyParams>): void;
  getParams(): SkyParams;
  size(): { width: number; height: number };
  onFrame(cb: () => void): () => void;
  /** Draw the current frame into a 2D context at the given size. */
  snapshot(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  /** Render at a fixed output width (for recording), or null to go back to adaptive. */
  setHighQuality(width: number | null): void;
  destroy(): void;
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const CLOUD_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uWind;
uniform float uCover;
uniform float uTanV;
uniform float uAspect;
uniform float uPitch;

const float BASE = 1.5;
const float TOP = 3.3;
const float SIG = 20.0;
const float FAR = 90.0;

// 3D value noise from a 2D table whose green channel is the red one shifted
// a layer along z
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
float fbm2(vec3 p) {
  return n3(p) * 0.62 + n3(p * 2.11 + 5.3) * 0.38;
}

// cloud density at a point (km); 'full' adds the billowing detail
float density(vec3 p, bool full) {
  float h = (p.y - BASE) / (TOP - BASE);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = p + uWind;
  // clouds come in loose groups with open sky between
  float clump = n3(vec3(q.x * 0.045, 1.7, q.z * 0.045));
  float cov = uCover + (clump - 0.5) * 0.55;
  float s = fbm3(q * vec3(0.42, 0.6, 0.42) + vec3(0.0, 0.0, uTime * 0.004));
  s += (1.0 - abs(n3(q * 1.1 + 2.0) * 2.0 - 1.0)) * 0.12 - 0.06;
  // rounded tops (the threshold rises with height), flat bases
  float d = s - (1.0 - cov) - h * h * 0.3;
  d *= smoothstep(0.0, 0.12, h);
  if (d <= 0.0) return 0.0;
  if (full) {
    // cauliflower billows, finer and stronger near the tops
    // billow noise: |2n - 1| makes rounded puffs with creases between them
    vec3 dq = q * 2.4 + vec3(uTime * 0.012, -uTime * 0.008, 0.0);
    float b1 = abs(n3(dq) * 2.0 - 1.0);
    float b2 = abs(n3(dq * 2.3 + 4.1) * 2.0 - 1.0);
    float b3 = abs(n3(dq * 5.1 + 9.3) * 2.0 - 1.0);
    float det = 1.0 - (b1 * 0.55 + b2 * 0.3 + b3 * 0.15);
    // erode the edges into billows, leaving the cores whole
    d = (d - det * (0.16 + 0.07 * h)) / (1.0 - det * 0.2);
  }
  return clamp(d * 5.5, 0.0, 1.0);
}

float hg(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
}

vec3 skyCol(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 zen = vec3(0.1, 0.32, 0.78);
  vec3 hor = vec3(0.58, 0.76, 0.94);
  vec3 c = mix(hor, zen, pow(y, 0.5));
  float mu = max(dot(rd, uSun), 0.0);
  // the glow round the sun, out of frame above
  c += vec3(1.0, 0.95, 0.86) * (pow(mu, 5.0) * 0.16 + pow(mu, 40.0) * 0.35);
  // a pale, luminous band of haze along the horizon
  c = mix(c, vec3(0.84, 0.9, 0.97), exp(-y * 14.0) * 0.55);
  return c;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(vec3(ndc.x * uTanV * uAspect, ndc.y * uTanV, 1.0));
  float cp = cos(uPitch);
  float sp = sin(uPitch);
  rd = vec3(rd.x, rd.y * cp + rd.z * sp, -rd.y * sp + rd.z * cp);
  vec3 sky = skyCol(rd);
  vec3 col = sky;

  if (rd.y > 0.015) {
    float t0 = BASE / rd.y;
    float t1 = min(TOP / rd.y, FAR);
    if (t0 < FAR) {
      const int N = 40;
      float ds = (t1 - t0) / float(N);
      // a fixed per-pixel offset hides the step banding; the finish pass smooths it
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float t = t0 + ds * jit;
      float mu = dot(rd, uSun);
      float phase = mix(hg(mu, 0.6), hg(mu, -0.2), 0.45);
      vec3 sunCol = vec3(1.0, 0.97, 0.92) * 2.3;
      vec3 acc = vec3(0.0);
      float T = 1.0;
      float firstHit = -1.0;
      for (int i = 0; i < N; i++) {
        vec3 p = rd * t;
        float d = density(p, true);
        if (d > 0.003) {
          if (firstHit < 0.0) firstHit = t;
          // how much cloud lies between here and the sun
          float od = 0.0;
          vec3 lp = p;
          float ls = 0.1;
          for (int j = 0; j < 5; j++) {
            lp += uSun * ls;
            // the first step sees the billows, so each one is lit and shadowed
            od += density(lp, j < 2) * ls;
            ls *= 1.6;
          }
          float h = (p.y - BASE) / (TOP - BASE);
          // direct light, plus a softer term standing in for light bounced
          // around inside the cloud, so shadows stay luminous
          float direct = exp(-od * SIG) + exp(-od * SIG * 0.2) * 0.25;
          // light the cloud's edges leak towards the eye
          float powder = 1.0 - exp(-d * 6.0);
          vec3 amb = mix(vec3(0.32, 0.38, 0.52), vec3(0.6, 0.72, 0.94), smoothstep(0.0, 0.8, h)) * 0.92;
          vec3 S = sunCol * direct * phase * mix(0.55, 1.0, powder) + amb;
          float a = 1.0 - exp(-d * SIG * ds);
          acc += T * a * S;
          T *= 1.0 - a;
          if (T < 0.02) break;
        }
        t += ds;
      }
      // the farther the cloud, the more it melts into the haze
      float far = firstHit < 0.0 ? t0 : firstHit;
      float fog = 1.0 - exp(-far * 0.022);
      vec3 haze = mix(sky, vec3(0.86, 0.91, 0.97), 0.4);
      col = sky * T + mix(acc, haze * (1.0 - T), fog);
    }
  }

  // filmic curve, keeping the whites soft
  col *= 0.95;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const FINISH_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSky;
uniform vec2 uSkyRes;
uniform vec2 uRes;
uniform float uBloom;
uniform float uSoft;
uniform float uPaint;
uniform float uScale;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 tap(vec2 uv) { return texture2D(uSky, clamp(uv, 0.0, 1.0)).rgb; }

// the pond's brush dabs, in screen pixels
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
      float ang = (hash(c + seed + 3.1) - 0.5) * 0.5 + sin(centre.y * 0.01 / uScale + centre.x * 0.004 / uScale) * 0.3;
      vec2 d = p - centre;
      vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
      float m = 1.0 - length(r / vec2(size * (1.1 + 0.9 * h.x), size * (0.32 + 0.2 * h.y)));
      m += (hash(vec2(floor(r.y / size * 7.0), c.x + c.y * 31.0 + seed)) - 0.5) * 0.22;
      if (m > 0.0) {
        float pri = hash(c + seed + 9.7) + m * 0.5;
        if (pri > best) {
          best = pri;
          vec2 sp = centre + vec2(cos(ang), sin(ang)) * r.x * 0.35;
          vec3 s = tap(vec2(sp.x, uRes.y - sp.y) / uRes);
          float k = hash(c + seed + 5.5);
          s += k < 0.33 ? vec3(-0.03, 0.0, 0.06) : (k > 0.72 ? vec3(0.04, 0.035, -0.03) : vec3(0.0));
          col = s * (0.95 + 0.1 * hash(c + seed + 2.2));
          cover = smoothstep(0.0, 0.3, m);
        }
      }
    }
  }
  return vec4(col, cover);
}

void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / uSkyRes;
  // a soft upsample: four bilinear taps spread over the cloud buffer's pixels
  vec3 sharp = tap(uv);
  vec3 soft = (tap(uv + px * vec2(-0.75, -0.75)) + tap(uv + px * vec2(0.75, -0.75))
             + tap(uv + px * vec2(-0.75, 0.75)) + tap(uv + px * vec2(0.75, 0.75))) * 0.25;
  vec3 col = mix(sharp, soft, uSoft);

  if (uPaint > 0.001) {
    vec2 p = vec2(uv.x, 1.0 - uv.y) * uRes;
    float big = 9.0 * uScale;
    vec4 d1 = dabs(p, big, 0.0);
    vec4 d2 = dabs(p + big * 0.5, big * 0.8, 31.0);
    vec3 painted = mix(mix(col, d2.rgb, d2.a), d1.rgb, d1.a);
    col = mix(col, painted, uPaint);
  }

  // bloom: the sunlit tops spill a little light into the blue around them,
  // and a wide, faint glow lifts the whole sky
  vec3 bl = vec3(0.0);
  vec3 wide = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float an = float(i) * 0.5236 + 0.26;
    vec2 o = vec2(cos(an), sin(an) * uRes.x / uRes.y);
    vec3 a = tap(uv + o * px * 2.5);
    vec3 b = tap(uv + o * px * 7.0);
    vec3 c = tap(uv + o * px * 16.0);
    bl += max(a - 0.7, 0.0) + max(b - 0.7, 0.0) * 0.7;
    wide += max(c - 0.6, 0.0);
  }
  col += (bl / 12.0) * uBloom * 1.4 + (wide / 12.0) * uBloom * 0.9;
  // and a soft overall glow, the air full of light
  col = mix(col, soft + 0.02, 0.06 * uBloom);

  // grade: clear, cool shadows; warm, clean highlights
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, 1.08);
  col += vec3(-0.01, 0.0, 0.02) * (1.0 - l);
  col *= mix(vec3(1.0), vec3(1.02, 1.0, 0.97), smoothstep(0.6, 1.0, l));

  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.22;
  // dither, so the long gradients don't band
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * 1.5;
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

/** Most pixels across the canvas's width, whatever the screen. */
const MAX_WIDTH = 1800;

export function startSky(canvas: HTMLCanvasElement, initial: Partial<SkyParams> = {}): SkyController {
  const params: SkyParams = { ...SKY_DEFAULTS, ...initial };
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL is not available");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const cloudPass = link(gl, CLOUD_FRAG, ["uNoise", "uRes", "uTime", "uSun", "uWind", "uCover", "uTanV", "uAspect", "uPitch"]);
  const finishPass = link(gl, FINISH_FRAG, ["uSky", "uSkyRes", "uRes", "uBloom", "uSoft", "uPaint", "uScale"]);

  // the noise table: red is random, green is red read one z-layer on
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
  const noiseTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noiseTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, table);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  const skyTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, skyTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  let skyW = 0;
  let skyH = 0;

  // the clouds are soft, so they're marched at a fraction of the screen's
  // pixels; that fraction backs off when frames run slow
  let k = 0.5;
  let fixedWidth: number | null = null;
  const resize = () => {
    const cw = canvas.clientWidth || 800;
    const ch = canvas.clientHeight || 500;
    let w: number;
    let h: number;
    if (fixedWidth) {
      w = fixedWidth;
      h = Math.round((fixedWidth * ch) / cw / 2) * 2;
    } else {
      const s = Math.min(Math.min(window.devicePixelRatio || 1, 2), MAX_WIDTH / cw);
      w = Math.max(2, Math.round(cw * s));
      h = Math.max(2, Math.round(ch * s));
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
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, skyTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };

  const start = performance.now();
  let lastNow = start;
  const draw = (now: number) => {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const t = (now - start) / 1000;

    // the sun: high and a little to the right, behind the viewer's brow
    const elev = (35 + params.sun * 35) * (Math.PI / 180);
    const az = 1.95;
    const sun = [Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az)];
    // a cool breeze carries the clouds across, a little towards us
    const speed = 0.02 + params.wind * 0.16;
    const wind = [-t * speed, 0, t * speed * 0.25];

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, skyW, skyH);
    gl.useProgram(cloudPass.prog);
    const cu = cloudPass.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(cu.uNoise, 0);
    gl.uniform2f(cu.uRes, skyW, skyH);
    gl.uniform1f(cu.uTime, t);
    gl.uniform3f(cu.uSun, sun[0], sun[1], sun[2]);
    gl.uniform3f(cu.uWind, wind[0], wind[1], wind[2]);
    gl.uniform1f(cu.uCover, 0.2 + params.cover * 0.4);
    gl.uniform1f(cu.uTanV, Math.tan((22 * Math.PI) / 180));
    gl.uniform1f(cu.uAspect, w / h);
    gl.uniform1f(cu.uPitch, (23 * Math.PI) / 180);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(finishPass.prog);
    const fu = finishPass.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyTex);
    gl.uniform1i(fu.uSky, 0);
    gl.uniform2f(fu.uSkyRes, skyW, skyH);
    gl.uniform2f(fu.uRes, w, h);
    gl.uniform1f(fu.uBloom, params.bloom);
    gl.uniform1f(fu.uSoft, params.soft);
    gl.uniform1f(fu.uPaint, params.paint);
    gl.uniform1f(fu.uScale, w / 1000);
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
    if (prev && !fixedWidth) {
      const dt = now - prev;
      if (dt > 24) {
        slow++;
        fast = 0;
      } else if (dt < 18) {
        fast++;
        slow = 0;
      }
      if (slow > 15 && k > 0.25) {
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
