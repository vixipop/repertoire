import { parseGIF, decompressFrames } from 'gifuct-js';

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

// ─── Swan pond, from above ───────────────────────────────────────────────
const pondPads = (() => {
  const r = seeded(31);
  const pads = [];
  const corners = [
    [0.08, 0.1],
    [0.9, 0.12],
    [0.1, 0.86],
    [0.88, 0.88],
    [0.5, 0.06],
  ];
  for (const [cx, cy] of corners) {
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      pads.push({ x: cx + (r() - 0.5) * 0.16, y: cy + (r() - 0.5) * 0.16, r: 0.016 + r() * 0.02, a: r() * TAU, flower: r() < 0.45, bob: r() * TAU });
    }
  }
  return pads;
})();

const pondBase = cachedBase((ctx, w, h) => {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#6fa79a');
  g.addColorStop(0.6, '#4f8a80');
  g.addColorStop(1, '#2f5f5a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Soft light patches on the water.
  const r = seeded(5);
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (0.04 + r() * 0.12) * w;
    const p = ctx.createRadialGradient(x, y, 0, x, y, rad);
    p.addColorStop(0, `rgba(200,235,220,${0.05 + r() * 0.06})`);
    p.addColorStop(1, 'rgba(200,235,220,0)');
    ctx.fillStyle = p;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Weeds under the surface.
  ctx.strokeStyle = 'rgba(40,80,60,0.35)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = (0.04 + r() * 0.08) * w;
    const a = r() * TAU;
    ctx.lineWidth = (1 + r() * 2.5) * (w / 1280);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  grain(ctx, w, h, 10);
});

function drawPad(ctx, x, y, rad, a, flower) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(20,50,35,0.25)';
  ctx.beginPath();
  ctx.ellipse(rad * 0.08, rad * 0.1, rad, rad * 0.94, 0, 0.25, TAU - 0.05);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.fillStyle = '#5c8f4a';
  ctx.beginPath();
  ctx.ellipse(0, 0, rad, rad * 0.94, 0, 0.25, TAU - 0.05);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,70,40,0.35)';
  ctx.lineWidth = rad * 0.05;
  for (let i = 0; i < 6; i++) {
    const b = 0.6 + (i / 6) * (TAU - 0.9);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(b) * rad * 0.85, Math.sin(b) * rad * 0.8);
    ctx.stroke();
  }
  if (flower) {
    for (let i = 0; i < 7; i++) {
      const b = (i / 7) * TAU;
      ctx.fillStyle = i % 2 ? '#f2a7a0' : '#f7c1b6';
      ctx.beginPath();
      ctx.ellipse(Math.cos(b) * rad * 0.32 - rad * 0.2, Math.sin(b) * rad * 0.32, rad * 0.26, rad * 0.12, b, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f6d36b';
    ctx.beginPath();
    ctx.arc(-rad * 0.2, 0, rad * 0.12, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Each swan glides on a slow loop; a = heading.
const SWANS = [
  { cx: 0.32, cy: 0.3, rx: 0.16, ry: 0.1, speed: 0.07, phase: 0.3 },
  { cx: 0.62, cy: 0.52, rx: 0.2, ry: 0.13, speed: -0.055, phase: 2.2 },
  { cx: 0.4, cy: 0.74, rx: 0.14, ry: 0.08, speed: 0.08, phase: 4.1 },
];

function swanAt(s, t, w, h) {
  const p = s.phase + t * s.speed * TAU * 0.25;
  const x = (s.cx + Math.cos(p) * s.rx) * w;
  const y = (s.cy + Math.sin(p) * s.ry) * h;
  const dir = Math.sign(s.speed);
  const heading = Math.atan2(Math.cos(p) * s.ry * h * dir, -Math.sin(p) * s.rx * w * dir);
  return { x, y, heading };
}

function drawSwan(ctx, x, y, heading, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  // Shadow on the water.
  ctx.fillStyle = 'rgba(15,40,35,0.28)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.05, size * 0.12, size * 0.55, size * 0.3, 0, 0, TAU);
  ctx.fill();
  // Body: a teardrop, tail behind.
  ctx.fillStyle = '#fbf7f0';
  ctx.beginPath();
  ctx.moveTo(size * 0.45, 0);
  ctx.bezierCurveTo(size * 0.4, -size * 0.3, -size * 0.35, -size * 0.32, -size * 0.6, 0);
  ctx.bezierCurveTo(-size * 0.35, size * 0.32, size * 0.4, size * 0.3, size * 0.45, 0);
  ctx.fill();
  // Folded wing.
  ctx.fillStyle = '#ece6dc';
  ctx.beginPath();
  ctx.ellipse(-size * 0.1, 0, size * 0.32, size * 0.16, 0, 0, TAU);
  ctx.fill();
  // Neck, head and beak.
  ctx.strokeStyle = '#fbf7f0';
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.11;
  ctx.beginPath();
  ctx.moveTo(size * 0.35, 0);
  ctx.lineTo(size * 0.66, 0);
  ctx.stroke();
  ctx.fillStyle = '#fbf7f0';
  ctx.beginPath();
  ctx.arc(size * 0.7, 0, size * 0.09, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8873f';
  ctx.beginPath();
  ctx.moveTo(size * 0.77, -size * 0.04);
  ctx.lineTo(size * 0.9, 0);
  ctx.lineTo(size * 0.77, size * 0.04);
  ctx.fill();
  ctx.restore();
}

function drawPond(ctx, w, h, t) {
  ctx.drawImage(pondBase(w, h), 0, 0);
  const size = Math.min(w, h) * 0.13;
  for (const s of SWANS) {
    // Wake: two lines fanning out behind, along the path just swum, fading.
    ctx.lineCap = 'round';
    ctx.lineWidth = size * 0.04;
    for (const side of [-1, 1]) {
      let prev = null;
      for (let k = 0; k <= 10; k++) {
        const back = swanAt(s, t - k * 0.3, w, h);
        const spread = size * (0.12 + k * 0.07) * side;
        const pt = [
          back.x - Math.cos(back.heading) * size * 0.45 + Math.cos(back.heading + Math.PI / 2) * spread,
          back.y - Math.sin(back.heading) * size * 0.45 + Math.sin(back.heading + Math.PI / 2) * spread,
        ];
        if (prev) {
          ctx.strokeStyle = `rgba(230,250,245,${0.3 * (1 - k / 11)})`;
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(pt[0], pt[1]);
          ctx.stroke();
        }
        prev = pt;
      }
    }
    const now = swanAt(s, t, w, h);
    drawSwan(ctx, now.x, now.y, now.heading, size);
  }
  for (const p of pondPads) {
    const bob = t === 0 ? 0 : Math.sin(t * 0.8 + p.bob) * 0.04;
    drawPad(ctx, p.x * w, p.y * h, p.r * Math.min(w, h) * 2.2, p.a + bob, p.flower);
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

export const PRESETS = [
  procedural('Lake', 1.5, drawLake),
  procedural('Pond', 1, drawPond),
  procedural('Night', 1.6, drawNight),
];

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

// GIF frames are patches over the previous frame; composite them into full
// frames once, downscaled, and keep at most 150 of them.
function decodeGif(buffer) {
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  if (frames.length < 2) return null;
  const W = gif.lsd.width;
  const H = gif.lsd.height;
  const scale = Math.min(1, 1280 / Math.max(W, H));
  const full = canvas(W, H);
  const fctx = full.getContext('2d');
  const patch = canvas(1, 1);
  const pctx = patch.getContext('2d');
  const out = [];
  for (const f of frames.slice(0, 150)) {
    const { width, height, top, left } = f.dims;
    const before = f.disposalType === 3 ? fctx.getImageData(0, 0, W, H) : null;
    patch.width = width;
    patch.height = height;
    pctx.putImageData(new ImageData(f.patch, width, height), 0, 0);
    fctx.drawImage(patch, left, top);
    const snap = canvas(Math.round(W * scale), Math.round(H * scale));
    snap.getContext('2d').drawImage(full, 0, 0, snap.width, snap.height);
    out.push({ img: snap, delay: Math.max(20, f.delay || 100) / 1000 });
    if (f.disposalType === 2) fctx.clearRect(left, top, width, height);
    else if (before) fctx.putImageData(before, 0, 0);
  }
  return { frames: out, width: W, height: H };
}

export async function pictureFromFile(file) {
  if (file.type === 'image/gif') {
    try {
      const gif = decodeGif(await file.arrayBuffer());
      if (gif) {
        const total = gif.frames.reduce((s, f) => s + f.delay, 0);
        const starts = [];
        let acc = 0;
        for (const f of gif.frames) {
          starts.push(acc);
          acc += f.delay;
        }
        const frame = (t) => {
          const m = t % total;
          let i = starts.length - 1;
          while (i > 0 && starts[i] > m) i--;
          return i;
        };
        return {
          name: file.name,
          aspect: gif.width / gif.height,
          animated: true,
          frame,
          draw: (ctx, w, h, t) => cover(ctx, gif.frames[frame(t)].img, w, h),
        };
      }
    } catch {
      // Not a GIF we can read: fall through and treat it as a still.
    }
  }
  const img = await bitmapOf(file);
  return {
    name: file.name,
    aspect: img.width / img.height,
    animated: false,
    frame: () => 0,
    draw: (ctx, w, h) => cover(ctx, img, w, h),
  };
}
