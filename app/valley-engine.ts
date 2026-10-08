/**
 * The valley: a photograph of a girl looking out over a Himalayan valley,
 * repainted every frame on the GPU. Two passes, both full-screen shaders:
 *
 *  1. Scene: the photo is the underpainting. Its foliage, hanging branch and
 *     hair are pushed about by a wind field (weighted by a painted mask), the
 *     sky is swapped for a cleaned plate of the same sky that drifts and
 *     billows behind the branches, cloud shadows cross the mountain, and the
 *     sun glints off the leaves from the top right.
 *  2. Paint: the frame is re-laid as overlapping brush dabs, each one colour
 *     picked up from beneath it, laid along the forms of the picture (a flow
 *     field taken from the photo's structure), finer where there is detail,
 *     then bloom, Monet's violet shadows and warm lights, and canvas grain.
 *
 * Resolution adapts to keep the frame rate up, and can be pinned to a fixed
 * width for recording.
 */

export type ValleyParams = {
  /** brushwork, 0 = the photo, 1 = fully painted */
  paint: number;
  /** brush size */
  brush: number;
  bloom: number;
  /** sun glow and leaf glints */
  light: number;
  wind: number;
  /** cloud drift speed */
  drift: number;
  /** how far the colour is lifted towards Monet's airy pastel */
  airy: number;
};

export const VALLEY_DEFAULTS: ValleyParams = {
  paint: 1,
  brush: 0.55,
  bloom: 0.6,
  light: 0.6,
  wind: 0.6,
  drift: 0.5,
  airy: 0.55,
};

/** Image URLs (or data URIs) for the photo and the textures made from it. */
export type ValleyAssets = { photo: string; mask: string; flow: string; sky: string };

export type ValleyController = {
  setParams(p: Partial<ValleyParams>): void;
  getParams(): ValleyParams;
  size(): { width: number; height: number };
  onFrame(cb: () => void): () => void;
  /** Draw the current frame into a 2D context at the given size. */
  snapshot(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  /** Render at a fixed output width (for recording), or null to go back to adaptive. */
  setHighQuality(width: number | null): void;
  /** Resolves once every texture has loaded and the first frame is drawn. */
  ready: Promise<void>;
  destroy(): void;
};

/** The photo is 3:4 portrait. */
export const VALLEY_ASPECT = 3 / 4;
/** The sky plate covers the top of the photo down to this fraction of its height. */
const PLATE_H = 640 / 1500;

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
// screen uv (y down) to image uv: xy scale, zw offset
uniform vec4 uMap;

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
uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform sampler2D uSky;
uniform float uWind;
uniform float uDrift;
uniform float uLight;
uniform float uAiry;

// the wind: a slow sway that travels across the picture, gusting now and
// then, with smaller eddies riding on it
vec2 windAt(vec2 uv, float t) {
  float gust = 0.55 + 0.45 * smoothstep(0.35, 0.75, fbm(vec2(t * 0.11, uv.x * 0.8 - t * 0.16)));
  vec2 sway = vec2(
    sin(t * 0.83 + uv.y * 3.1 - uv.x * 2.3) * 0.6 + sin(t * 1.61 + uv.x * 5.0 + uv.y * 2.0) * 0.3,
    sin(t * 1.27 + uv.x * 4.2) * 0.22);
  vec2 eddy = vec2(
    noise(uv * vec2(9.0, 7.0) + vec2(t * 0.9, t * 0.35)) - 0.5,
    noise(uv * vec2(8.0, 10.0) + vec2(-t * 0.7, t * 0.8) + 7.0) - 0.5);
  return (sway * 0.6 + eddy * 1.3) * gust;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y) * uMap.xy + uMap.zw;
  float t = uTime;
  vec3 m = texture2D(uMask, uv).rgb;

  // leaves and branches sway; the hair lifts and settles
  vec2 d = windAt(uv, t) * m.g * 0.0065;
  vec2 hairWind = vec2(sin(t * 1.1 + uv.y * 30.0) * 0.6 + sin(t * 2.3 + uv.y * 55.0) * 0.25 + 0.35,
                       sin(t * 0.9 + uv.x * 40.0) * 0.2);
  d += hairWind * m.b * 0.0045;
  vec2 uv2 = uv + d * uWind;

  vec3 photo = texture2D(uPhoto, uv2).rgb;
  float sky = texture2D(uMask, uv2).r;

  // the sky drifts and billows behind the trees
  vec2 su = vec2(uv.x - t * uDrift * 0.0035, uv.y / ${PLATE_H.toFixed(5)});
  su += (vec2(fbm(su * 2.6 + vec2(t * 0.025, 0.0)), fbm(su * 2.6 + vec2(5.2, -t * 0.02))) - 0.5) * 0.03;
  su.x = 1.0 - abs(1.0 - mod(su.x, 2.0));
  vec3 skyCol = texture2D(uSky, clamp(su, vec2(0.002), vec2(0.998))).rgb;
  vec3 col = mix(photo, skyCol, sky);

  // cloud shadows sail across the mountain
  float mtn = (1.0 - sky) * smoothstep(0.35, 0.39, uv.y) * (1.0 - smoothstep(0.6, 0.78, uv.y)) * (1.0 - smoothstep(0.1, 0.4, m.g));
  float shade = smoothstep(0.48, 0.72, fbm(vec2(uv.x * 2.4 - t * uDrift * 0.012, uv.y * 3.2 + 1.7)));
  col *= 1.0 - 0.2 * shade * mtn;

  // sunlight: leaves catch and lose it as they turn
  float lum = dot(photo, vec3(0.299, 0.587, 0.114));
  float flick = noise(uv * vec2(70.0, 60.0) + windAt(uv, t) * 6.0 + t * vec2(0.8, -0.6));
  col *= 1.0 + m.g * (flick - 0.5) * 0.22 * uLight;
  float glint = pow(max(noise(uv * vec2(150.0, 130.0) + t * vec2(1.7, -1.3)), 0.0), 7.0) * 2.0;
  col += vec3(1.0, 0.97, 0.86) * glint * smoothstep(0.42, 0.85, lum) * m.g * uLight * 0.7;

  // the sun just out of frame, top right, its haze and rays
  vec2 sp = (uv - vec2(1.02, -0.06)) * vec2(1.0, 1.33);
  float r = length(sp);
  float rays = pow(noise(vec2(atan(sp.y, sp.x) * 9.0, t * 0.12)), 3.0);
  vec3 sunCol = vec3(1.0, 0.95, 0.82);
  col += sunCol * (exp(-r * 3.2) * 0.32 + rays * exp(-r * 2.4) * 0.16) * uLight;
  col = mix(col, sunCol, exp(-r * 6.0) * 0.35 * uLight);

  // Monet's air: lift the darks, soften the contrast, lean the shadows violet
  vec3 airy = col * 0.82 + vec3(0.1, 0.1, 0.12);
  float l = dot(airy, vec3(0.299, 0.587, 0.114));
  airy += vec3(0.04, 0.0, 0.07) * (1.0 - smoothstep(0.15, 0.6, l));
  airy = mix(vec3(l), airy, 1.08);
  col = mix(col, airy, uAiry);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Impressionist pass: the frame is re-laid as overlapping brush dabs, each
// carrying one colour picked up from beneath it, nudged warm or cool, and
// laid along the forms of the picture.
const POST_FRAG = `${COMMON}
uniform sampler2D uScene;
uniform sampler2D uFlow;
uniform float uPaint;
uniform float uBrush;
uniform float uBloom;

vec3 scene(vec2 p) {
  // the framebuffer stores rows bottom-up
  vec2 uv = vec2(p.x, uRes.y - p.y) / uRes;
  return texture2D(uScene, clamp(uv, 0.001, 0.999)).rgb;
}

vec3 flowAt(vec2 p) {
  return texture2D(uFlow, (p / uRes) * uMap.xy + uMap.zw).rgb;
}

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
      // strokes follow the forms; where there are none, they run level
      vec2 f = flowAt(centre).rg * 2.0 - 1.0;
      f += vec2(0.18, 0.0);
      float ang = 0.5 * atan(f.y, f.x) + (hash(c + seed + 3.1) - 0.5) * 0.45;
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

  // finer strokes wherever there is detail: the girl, the twigs, the ridge
  float e = 1.5 * uScale;
  float edge = length(scene(p + vec2(e, 0.0)) - scene(p - vec2(e, 0.0)))
             + length(scene(p + vec2(0.0, e)) - scene(p - vec2(0.0, e)));
  float detail = clamp(max(edge * 1.4, flowAt(p).b * 0.9), 0.0, 1.0);
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

  // canvas weave and grain
  vec2 q = p / uScale;
  float weave = sin(q.x * 2.3) * sin(q.y * 2.3);
  float grain = hash(floor(p * 1.5)) - 0.5;
  col *= 1.0 + uPaint * (weave * 0.025 + grain * 0.035);

  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.35;
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** Most pixels we will paint across the canvas's width, whatever the screen. */
const MAX_WIDTH = 1500;

export function startValley(canvas: HTMLCanvasElement, assets: ValleyAssets, initial: Partial<ValleyParams> = {}): ValleyController {
  const params: ValleyParams = { ...VALLEY_DEFAULTS, ...initial };
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL is not available");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const common = ["uRes", "uTime", "uScale", "uMap"];
  const scenePass = link(gl, SCENE_FRAG, [...common, "uPhoto", "uMask", "uSky", "uWind", "uDrift", "uLight", "uAiry"]);
  const postPass = link(gl, POST_FRAG, [...common, "uScene", "uFlow", "uPaint", "uBrush", "uBloom"]);

  const makeTex = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tex = { photo: makeTex(), mask: makeTex(), flow: makeTex(), sky: makeTex() };
  const sceneTex = makeTex();
  const fbo = gl.createFramebuffer();
  let fboW = 0;
  let fboH = 0;

  let loaded = false;
  const ready = Promise.all((["photo", "mask", "flow", "sky"] as const).map((k) => loadImage(assets[k]).then((img) => [k, img] as const))).then((imgs) => {
    if (dead) return;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const [k, img] of imgs) {
      gl.bindTexture(gl.TEXTURE_2D, tex[k]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    }
    loaded = true;
    draw(performance.now());
  });

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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };

  // the photo covers the canvas, cropped evenly if the canvas isn't 3:4
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
  const draw = (now: number) => {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const t = (now - start) / 1000;
    const map = mapFor(w, h);
    const scale = w / 750;
    if (!loaded) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.86, 0.88, 0.9, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.viewport(0, 0, w, h);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.useProgram(scenePass.prog);
    const su = scenePass.u;
    gl.uniform2f(su.uRes, w, h);
    gl.uniform1f(su.uTime, t);
    gl.uniform1f(su.uScale, scale);
    gl.uniform4f(su.uMap, ...map);
    gl.uniform1f(su.uWind, params.wind * 1.6);
    gl.uniform1f(su.uDrift, params.drift * 2);
    gl.uniform1f(su.uLight, params.light * 1.6);
    gl.uniform1f(su.uAiry, params.airy);
    (["photo", "mask", "sky"] as const).forEach((n, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex[n]);
    });
    gl.uniform1i(su.uPhoto, 0);
    gl.uniform1i(su.uMask, 1);
    gl.uniform1i(su.uSky, 2);
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex.flow);
    gl.uniform1i(pu.uScene, 0);
    gl.uniform1i(pu.uFlow, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lastNow = now;
  };

  const listeners = new Set<() => void>();
  let dead = false;
  let raf = 0;
  let lastNow = start;
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
    if (prev && loaded && !fixedWidth) {
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
    ready,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      listeners.clear();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
