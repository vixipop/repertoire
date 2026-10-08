import { parseGIF, decompressFrame } from 'gifuct-js';

// A picture is what gets printed on the puzzle:
//   aspect        width / height
//   animated      whether it moves once the puzzle is solved
//   draw(ctx, w, h, t)   paint it at time t (seconds since solving; 0 = still)
//   frame(t)      which frame t falls on, so we only re-upload when it changes
//
// The presets are painted in code: a still base once, then a light overlay
// per frame, so animating them stays cheap.

const TAU = Math.PI * 2;

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Paint once per size, reuse every frame.
function cachedBase(paint) {
  let cache = null;
  return (w, h) => {
    if (!cache || cache.width !== w || cache.height !== h) {
      cache = canvas(w, h);
      paint(cache.getContext('2d'), w, h);
    }
    return cache;
  };
}

// ─── Lake at golden hour ─────────────────────────────────────────────────
const lakeBase = cachedBase((ctx, w, h) => {
  const horizon = h * 0.52;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5f8fc4');
  sky.addColorStop(0.55, '#a9c3dc');
  sky.addColorStop(1, '#f6d6ae');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  const sun = ctx.createRadialGradient(w * 0.66, horizon - h * 0.06, 0, w * 0.66, horizon - h * 0.06, h * 0.5);
  sun.addColorStop(0, 'rgba(255,240,205,1)');
  sun.addColorStop(0.08, 'rgba(255,226,170,0.95)');
  sun.addColorStop(0.35, 'rgba(255,205,150,0.25)');
  sun.addColorStop(1, 'rgba(255,205,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, horizon);
  const ridge = (base, amp, freq, seed, color) => {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 6) {
      const t = x / w;
      ctx.lineTo(x, base - amp * (0.55 * Math.sin(t * freq + seed) + 0.3 * Math.sin(t * freq * 2.3 + seed * 1.7) + 0.15 * Math.sin(t * freq * 5.1 + seed * 0.3)));
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(horizon - h * 0.1, h * 0.08, 7, 1.2, '#8ea6c4');
  ridge(horizon - h * 0.05, h * 0.06, 11, 4.1, '#5f7f94');
  ridge(horizon - h * 0.01, h * 0.03, 17, 2.5, '#3f5f5a');
  const water = ctx.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#e9c9a2');
  water.addColorStop(0.25, '#8fb0c8');
  water.addColorStop(1, '#2f5675');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, w, h - horizon);
  grain(ctx, w, h, 12);
});

const lakeGlints = (() => {
  const r = seeded(7);
  return Array.from({ length: 420 }, () => ({ t: r(), dx: r() - 0.5, len: r(), phase: r() * TAU, speed: 0.6 + r() * 2 }));
})();
const lakeRipples = (() => {
  const r = seeded(19);
  return Array.from({ length: 80 }, () => ({ t: r(), x: r(), len: r(), drift: 0.004 + r() * 0.01 }));
})();

function drawLake(ctx, w, h, t) {
  ctx.drawImage(lakeBase(w, h), 0, 0);
  const horizon = h * 0.52;
  // Ripple lines drift slowly towards you.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, w / 1000);
  for (const rp of lakeRipples) {
    const k = (rp.t + t * rp.drift) % 1;
    const y = horizon + k * k * (h - horizon);
    const x = ((rp.x + t * 0.003) % 1) * w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (20 + k * 180) * (w / 1280) * (0.5 + rp.len), y);
    ctx.stroke();
  }
  // Glitter under the sun, each glint breathing on its own clock.
  for (const g of lakeGlints) {
    const y = horizon + 3 + g.t * g.t * (h - horizon) * 0.9;
    const spread = (16 + g.t * w * 0.16) * 2;
    const x = w * 0.66 + g.dx * spread;
    const a = 0.55 * (1 - g.t) * (t === 0 ? 0.8 : 0.45 + 0.55 * Math.sin(g.phase + t * g.speed * 3));
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(255,236,200,${a})`;
    ctx.fillRect(x, y, (5 + g.len * 26 * (0.3 + g.t)) * (w / 1280), (1.2 + g.t * 2.5) * (w / 1280));
  }
}

// ─── Night meadow with fireflies ─────────────────────────────────────────
const nightStars = (() => {
  const r = seeded(43);
  return Array.from({ length: 220 }, () => ({ x: r(), y: Math.pow(r(), 1.4) * 0.6, s: 0.4 + r() * 1.4, phase: r() * TAU, speed: 0.5 + r() * 2 }));
})();
const fireflies = (() => {
  const r = seeded(77);
  return Array.from({ length: 36 }, () => ({ x: r(), y: 0.6 + r() * 0.36, ax: 0.01 + r() * 0.03, ay: 0.008 + r() * 0.02, phase: r() * TAU, speed: 0.15 + r() * 0.3, blink: r() * TAU }));
})();

const nightBase = cachedBase((ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0f1b3d');
  sky.addColorStop(0.5, '#28366b');
  sky.addColorStop(0.72, '#5b5a8c');
  sky.addColorStop(1, '#1a2333');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const mx = w * 0.74;
  const my = h * 0.2;
  const mr = Math.min(w, h) * 0.06;
  const glow = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 6);
  glow.addColorStop(0, 'rgba(240,235,210,0.35)');
  glow.addColorStop(1, 'rgba(240,235,210,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4efd9';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  const hill = (base, amp, freq, seed, color) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const t = x / w;
      ctx.lineTo(x, base * h - amp * h * (0.6 * Math.sin(t * freq + seed) + 0.4 * Math.sin(t * freq * 2.7 + seed * 2)));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  hill(0.66, 0.05, 5, 0.7, '#2a3358');
  hill(0.74, 0.04, 8, 2.9, '#1d2740');
  hill(0.84, 0.03, 13, 1.3, '#141c2c');
  // Grass blades along the front.
  const r = seeded(9);
  ctx.strokeStyle = '#0e1522';
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = r() * w;
    const len = (0.03 + r() * 0.07) * h;
    ctx.lineWidth = (1 + r() * 2) * (w / 1280);
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x + (r() - 0.5) * len * 0.4, h - len * 0.6, x + (r() - 0.5) * len * 0.6, h - len);
    ctx.stroke();
  }
  grain(ctx, w, h, 8);
});

function drawNight(ctx, w, h, t) {
  ctx.drawImage(nightBase(w, h), 0, 0);
  const k = w / 1280;
  for (const s of nightStars) {
    const a = t === 0 ? 0.7 : 0.45 + 0.55 * Math.sin(s.phase + t * s.speed);
    ctx.fillStyle = `rgba(255,250,235,${Math.max(0, a)})`;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.s * k, 0, TAU);
    ctx.fill();
  }
  for (const f of fireflies) {
    const p = f.phase + t * f.speed;
    const x = (f.x + Math.sin(p) * f.ax) * w;
    const y = (f.y + Math.sin(p * 1.7) * f.ay) * h;
    const on = t === 0 ? 0.7 : Math.max(0, Math.sin(f.blink + t * 1.6)) ** 2;
    const rad = 14 * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(235,255,170,${0.95 * on})`);
    g.addColorStop(0.25, `rgba(210,250,120,${0.45 * on})`);
    g.addColorStop(1, 'rgba(210,250,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const procedural = (name, aspect, draw) => ({
  name,
  aspect,
  animated: true,
  draw,
  frame: (t) => Math.floor(t * 24), // presets animate at 24 fps
});

// The pictures offered at the top. A file entry (a GIF plays once solved, a
// still stays still) lives in public/presets/; swap or add files there.
// Lake and Night are painted stand-ins until the real GIFs arrive.
// A video entry can name the moment to show as its still (`still`, seconds),
// chosen by eye, since a first frame can be a bad one; once solved it plays
// on from there. `crop` trims a baked-in border, in source pixels per side.
export const PRESETS = [
  { name: 'Swans', src: 'presets/swans.webp' },
  // WebM first (a quarter of the MP4's size, same look), MP4 for browsers without VP9.
  { name: 'Tiger', video: ['presets/tiger.webm', 'presets/tiger.mp4'], still: 9, crop: 48 },
  procedural('Night', 1.6, drawNight),
];
void drawLake; // kept as a spare painted preset

// Resolve a preset entry to a picture, loading its file the first time.
const loaded = new Map();
export function loadPreset(entry) {
  if (entry.draw) return Promise.resolve(entry);
  if (!loaded.has(entry)) {
    loaded.set(
      entry,
      entry.video
        ? pictureFromVideo(playable(entry.video), entry.name, entry)
        : fetch(entry.src)
            .then((r) => {
              if (!r.ok) throw new Error(`${entry.src}: ${r.status}`);
              return r.blob();
            })
            .then((blob) => pictureFromFile(blob, entry.name))
    );
  }
  return loaded.get(entry);
}

// ─── Uploads ─────────────────────────────────────────────────────────────
// Cover-crop, like a photo printed edge to edge.
function cover(ctx, img, w, h) {
  const iw = img.width;
  const ih = img.height;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
}

async function bitmapOf(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = reject;
      el.src = url;
    });
  }
}

// A GIF player that decodes frames as it reaches them, instead of holding
// every frame in memory. Memory stays at the file's size plus one frame, so a
// GIF of any length plays to the end. Each frame is a patch over the previous
// one; playing in order and honouring each frame's disposal rebuilds it.
function gifPlayer(buffer) {
  const gif = parseGIF(buffer);
  const raw = gif.frames.filter((f) => f.image);
  if (raw.length < 2) return null;
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  // Browsers treat delays under 20 ms as 100 ms; so do we.
  const delays = raw.map((f) => {
    const d = (f.gce?.delay ?? 10) * 10;
    return (d < 20 ? 100 : d) / 1000;
  });
  const starts = [];
  let total = 0;
  for (const d of delays) {
    starts.push(total);
    total += d;
  }

  const full = canvas(W, H);
  const fctx = full.getContext('2d');
  const patch = canvas(1, 1);
  const pctx = patch.getContext('2d');
  let index = -1;
  let prev = null; // { disposal, rect, saved }

  function next() {
    if (prev) {
      if (prev.disposal === 2) fctx.clearRect(...prev.rect);
      else if (prev.disposal === 3 && prev.saved) fctx.putImageData(prev.saved, 0, 0);
    }
    index++;
    const f = decompressFrame(raw[index], gif.gct, true);
    const { width, height, top, left } = f.dims;
    const saved = f.disposalType === 3 ? fctx.getImageData(0, 0, W, H) : null;
    patch.width = width;
    patch.height = height;
    pctx.putImageData(new ImageData(f.patch, width, height), 0, 0);
    fctx.drawImage(patch, left, top);
    prev = { disposal: f.disposalType, rect: [left, top, width, height], saved };
  }

  function seek(target) {
    if (target < index) {
      // Looped: start over from a clean canvas.
      fctx.clearRect(0, 0, W, H);
      index = -1;
      prev = null;
    }
    while (index < target) next();
  }

  const frame = (t) => {
    const m = t % total;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= m) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  return {
    width: W,
    height: H,
    frames: raw.length,
    frame,
    draw(ctx, w, h, t) {
      seek(frame(t));
      cover(ctx, full, w, h);
    },
  };
}

// The first source this browser says it can play.
function playable(sources) {
  const probe = document.createElement('video');
  const type = (src) => (/\.webm$/i.test(src) ? 'video/webm; codecs="vp9"' : 'video/mp4; codecs="avc1.640028"');
  return sources.find((src) => probe.canPlayType(type(src))) || sources[sources.length - 1];
}

// A video plays once solved, like a GIF, but far smaller for the same length
// and quality. Muted and inline, so browsers let it start on its own. The
// frame at `still` is kept as the picture shown while the puzzle is in
// pieces, and playback picks up from that same moment.
export async function pictureFromVideo(url, name, { still: at = 0, crop = 0 } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  await new Promise((resolve, reject) => {
    v.addEventListener('loadeddata', resolve, { once: true });
    v.addEventListener('error', () => reject(new Error(`can't play ${name}`)), { once: true });
  });
  const seek = (time) =>
    new Promise((resolve) => {
      if (Math.abs(v.currentTime - time) < 0.001) return resolve();
      v.addEventListener('seeked', resolve, { once: true });
      v.currentTime = time;
    });
  await seek(at);
  const sw = v.videoWidth - crop * 2;
  const sh = v.videoHeight - crop * 2;
  const still = canvas(sw, sh);
  still.getContext('2d').drawImage(v, crop, crop, sw, sh, 0, 0, sw, sh);
  const live = canvas(sw, sh);
  const lctx = live.getContext('2d');
  return {
    name,
    aspect: sw / sh,
    animated: true,
    // A new key whenever the video shows a new frame (or rewinds to the still).
    frame: (t) => (t === 0 ? -1 : Math.floor(v.currentTime * 60)),
    draw(ctx, w, h, t) {
      if (t === 0) {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - at) > 0.001) v.currentTime = at;
        cover(ctx, still, w, h);
        return;
      }
      if (v.paused) v.play().catch(() => {});
      lctx.drawImage(v, crop, crop, sw, sh, 0, 0, sw, sh);
      cover(ctx, live, w, h);
    },
  };
}

export async function pictureFromFile(file, name = file.name) {
  if (file.type === 'image/gif') {
    try {
      const gif = gifPlayer(await file.arrayBuffer());
      if (gif) {
        return {
          name,
          aspect: gif.width / gif.height,
          animated: true,
          frame: gif.frame,
          draw: gif.draw,
        };
      }
    } catch {
      // Not a GIF we can read: fall through and treat it as a still.
    }
  }
  const img = await bitmapOf(file);
  return {
    name,
    aspect: img.width / img.height,
    animated: false,
    frame: () => 0,
    draw: (ctx, w, h) => cover(ctx, img, w, h),
  };
}
