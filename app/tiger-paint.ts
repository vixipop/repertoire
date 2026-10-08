/**
 * A painted tiger, seen from above, wading. Same conventions as swan-paint:
 * one body length (rump to nose) = 1, facing +x, the caller sets up the
 * transform. Forms are soft gradients and tapered brush shapes rather than
 * outlines; the pond's paint pass does the rest.
 *
 * The walk is a slow four-beat gait. tigerFeet() says where each paw is, so
 * the pond can ripple the water where a paw comes down.
 */

type RGB = [number, number, number];
const tcss = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const FUR_HI: RGB = [244, 152, 62];
const FUR: RGB = [222, 116, 36];
const FUR_DEEP: RGB = [168, 72, 24];
const CREAM: RGB = [246, 230, 206];
const INK: RGB = [24, 16, 12];

type Stripe = { x: number; side: number; len: number; w: number; sweep: number; fork: number };
type Fleck = { x: number; y: number; len: number; a: number; light: boolean };

export type TigerLook = { stripes: Stripe[]; flecks: Fleck[]; legStripes: number[] };

export type TigerPose = {
  /** gait phase, 0..1 per stride */
  phase: number;
  /** sideways flex of the spine, -1..1 */
  bend: number;
  headTurn: number;
  /** tail sway phase */
  tail: number;
  /** light direction in the tiger's own frame */
  lx: number;
  ly: number;
};

export const STRIDE = 0.34; // body lengths covered per gait cycle
export const STANCE = 0.64;
const LEGS = [
  { front: false, side: -1, off: 0 },
  { front: true, side: -1, off: 0.25 },
  { front: false, side: 1, off: 0.5 },
  { front: true, side: 1, off: 0.75 },
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTigerLook(seed = 11): TigerLook {
  const r = rng(seed);
  const stripes: Stripe[] = [];
  // stripes run from the spine down each flank, a little irregular
  for (const side of [-1, 1]) {
    let x = -0.46;
    while (x < 0.25) {
      // thinner and closer over the shoulders, bolder over the haunches
      const hind = x < -0.15;
      stripes.push({
        x: x + (r() - 0.5) * 0.02,
        side,
        len: 0.5 + r() * 0.5,
        w: (hind ? 0.02 : 0.014) + r() * 0.014,
        sweep: 0.02 + r() * 0.05,
        fork: r() < 0.3 ? 0.4 + r() * 0.35 : 0,
      });
      x += (hind ? 0.055 : 0.045) + r() * 0.03;
    }
  }
  const flecks: Fleck[] = [];
  for (let i = 0; i < 90; i++) {
    flecks.push({ x: -0.5 + r() * 0.82, y: (r() - 0.5) * 0.26, len: 0.02 + r() * 0.03, a: (r() - 0.5) * 0.6, light: r() < 0.55 });
  }
  return { stripes, flecks, legStripes: [0.35, 0.55, 0.72].map((v) => v + (r() - 0.5) * 0.05) };
}

/** Half-width of the body at x along the spine. */
const SHAPE: Array<[number, number]> = [
  [-0.545, 0],
  [-0.515, 0.06],
  [-0.45, 0.112],
  [-0.35, 0.134],
  [-0.23, 0.116],
  [-0.07, 0.104],
  [0.07, 0.118],
  [0.17, 0.136],
  [0.25, 0.12],
  [0.31, 0.098],
  [0.38, 0.088],
];
function halfWidth(x: number): number {
  if (x <= SHAPE[0][0] || x >= SHAPE[SHAPE.length - 1][0]) return x <= SHAPE[0][0] ? 0 : SHAPE[SHAPE.length - 1][1];
  for (let i = 1; i < SHAPE.length; i++) {
    const [x1, w1] = SHAPE[i];
    const [x0, w0] = SHAPE[i - 1];
    if (x <= x1) {
      const u = (x - x0) / (x1 - x0);
      const s = u * u * (3 - 2 * u);
      return w0 + (w1 - w0) * s;
    }
  }
  return 0;
}

/** Where each paw is, in the tiger's frame; lift > 0 while it swings forward. */
export function tigerFeet(pose: TigerPose) {
  return LEGS.map((leg) => {
    const p = (((pose.phase + leg.off) % 1) + 1) % 1;
    let dx: number;
    let lift = 0;
    if (p < STANCE) {
      // planted: the paw stays put in the world while the body moves over it
      dx = STRIDE * (0.5 - p / STANCE);
    } else {
      const q = (p - STANCE) / (1 - STANCE);
      const s = q * q * (3 - 2 * q);
      dx = STRIDE * (-0.5 + s);
      lift = Math.sin(Math.PI * q);
    }
    const base = leg.front ? 0.19 : -0.31;
    const y = leg.side * ((leg.front ? 0.14 : 0.136) + lift * 0.012);
    return { x: base + dx, y, lift, front: leg.front, side: leg.side, p };
  });
}

export function paintTiger(ctx: CanvasRenderingContext2D, look: TigerLook, pose: TigerPose) {
  const { lx, ly } = pose;
  const spine = (x: number) => pose.bend * 0.055 * Math.sin(x * 3.3);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* ---- tail: curls in a slow S behind the rump ---- */
  {
    const N = 26;
    const len = 0.62;
    let x = -0.52;
    let y = spine(-0.52);
    let a = Math.PI + Math.atan(pose.bend * 0.18);
    const pts: Array<[number, number]> = [[x, y]];
    for (let i = 1; i <= N; i++) {
      const s = i / N;
      a += (Math.sin(pose.tail + s * 3.1) * 0.09 + 0.035) * (0.4 + s);
      x += Math.cos(a) * (len / N);
      y += Math.sin(a) * (len / N);
      pts.push([x, y]);
    }
    for (let i = 0; i < N; i++) {
      const s = i / N;
      const band = s > 0.84 || (s > 0.2 && (s * 8.5) % 1 > 0.58);
      ctx.strokeStyle = band ? tcss(INK, 0.95) : tcss(i % 2 ? FUR : FUR_HI);
      ctx.lineWidth = 0.044 * (1 - s * 0.3);
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
  }

  /* ---- legs: mostly under water; a lifted paw breaks the surface ---- */
  for (const f of tigerFeet(pose)) {
    const jx = f.front ? 0.2 : -0.3;
    const jy = f.side * 0.085 + spine(jx);
    const depth = 0.35 + 0.65 * f.lift; // how much of the leg shows above the surface
    const g = ctx.createLinearGradient(jx, jy, f.x, f.y);
    g.addColorStop(0, tcss(FUR));
    g.addColorStop(0.6, tcss(FUR_DEEP, 0.55 + 0.4 * depth));
    g.addColorStop(1, tcss(FUR_DEEP, 0.25 + 0.6 * depth));
    ctx.strokeStyle = g;
    ctx.lineWidth = f.front ? 0.066 : 0.074;
    ctx.beginPath();
    ctx.moveTo(jx, jy);
    ctx.quadraticCurveTo((jx + f.x) / 2 + (f.front ? 0.02 : -0.02), (jy + f.y) / 2 + f.side * 0.02, f.x, f.y);
    ctx.stroke();
    // a stripe or two across the leg
    ctx.strokeStyle = tcss(INK, 0.55 * depth + 0.2);
    ctx.lineWidth = 0.012;
    for (const t of look.legStripes) {
      const sx = jx + (f.x - jx) * t;
      const sy = jy + (f.y - jy) * t;
      ctx.beginPath();
      ctx.moveTo(sx - 0.03, sy - f.side * 0.004);
      ctx.lineTo(sx + 0.03, sy + f.side * 0.004);
      ctx.stroke();
    }
    // the paw: pale and soft, clearest when it's lifted clear of the water
    ctx.fillStyle = tcss(f.lift > 0.3 ? FUR_HI : FUR_DEEP, 0.15 + 0.7 * f.lift);
    ctx.beginPath();
    ctx.ellipse(f.x + 0.01, f.y, 0.036, 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- body ---- */
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  const shoulderRoll = Math.sin(pose.phase * Math.PI * 2) * 0.008;
  for (let i = 0; i <= 40; i++) {
    const x = -0.545 + (i / 40) * (0.38 + 0.545);
    let w = halfWidth(x);
    // shoulder blades and hips roll as each leg takes the weight
    w += Math.exp(-((x - 0.18) ** 2) / 0.004) * shoulderRoll;
    w -= Math.exp(-((x + 0.3) ** 2) / 0.004) * shoulderRoll;
    const c = spine(x);
    top.push([x, c - w]);
    bottom.push([x, c + w]);
  }
  const body = new Path2D();
  const outline = [...top, ...bottom.reverse()];
  body.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1];
    const b = outline[i];
    body.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  body.closePath();

  {
    const cx = -0.08 + lx * 0.12;
    const cy = ly * 0.06;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.62);
    g.addColorStop(0, tcss(FUR_HI));
    g.addColorStop(0.5, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.fill(body);
  }

  ctx.save();
  ctx.clip(body);
  // pale belly fur showing along the flanks
  ctx.strokeStyle = tcss(CREAM, 0.42);
  ctx.lineWidth = 0.05;
  ctx.stroke(body);
  // a deeper line down the back, where the stripes meet
  ctx.strokeStyle = tcss(FUR_DEEP, 0.55);
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const x = -0.5 + (i / 20) * 0.8;
    if (i === 0) ctx.moveTo(x, spine(x));
    else ctx.lineTo(x, spine(x));
  }
  ctx.stroke();
  // fur: short strokes, lighter on top, darker in the hollows
  for (const f of look.flecks) {
    const y = spine(f.x) + f.y;
    ctx.strokeStyle = f.light ? tcss(FUR_HI, 0.35) : tcss(FUR_DEEP, 0.25);
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x - Math.cos(f.a) * f.len, y - Math.sin(f.a) * f.len);
    ctx.stroke();
  }
  // stripes: thick where they leave the spine, tapering down the flank
  ctx.fillStyle = tcss(INK, 0.92);
  for (const s of look.stripes) {
    const w = halfWidth(s.x) + 0.02;
    const reach = w * s.len;
    const x0 = s.x;
    const y0 = spine(x0) + s.side * 0.004;
    const x1 = x0 - s.sweep;
    const y1 = spine(x1) + s.side * reach;
    const mx = x0 - s.sweep * 0.25;
    const my = spine(mx) + s.side * reach * 0.55;
    const ww = s.w;
    ctx.beginPath();
    ctx.moveTo(x0 + ww * 0.6, y0);
    ctx.quadraticCurveTo(mx + ww * 0.5, my, x1, y1);
    ctx.quadraticCurveTo(mx - ww * 0.5, my, x0 - ww * 0.6, y0);
    ctx.closePath();
    ctx.fill();
    if (s.fork) {
      const fx = x0 - s.sweep * s.fork * 0.5;
      const fy = spine(fx) + s.side * reach * s.fork;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + 0.02, fy + s.side * reach * 0.2, fx + 0.012, fy + s.side * reach * 0.42);
      ctx.lineTo(fx - 0.006, fy + s.side * 0.01);
      ctx.closePath();
      ctx.fill();
    }
  }
  // the near flank catches the light, the far one falls into shade
  {
    const g = ctx.createLinearGradient(-lx * 0.2, -ly * 0.2, lx * 0.2, ly * 0.2);
    g.addColorStop(0, "rgba(40,20,10,0.22)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(255,226,180,0.16)");
    ctx.fillStyle = g;
    ctx.fill(body);
  }
  ctx.restore();

  /* ---- head ---- */
  const nx = 0.33;
  const ny = spine(nx);
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(pose.headTurn + pose.bend * 0.12);
  ctx.scale(1.3, 1.3);
  ctx.translate(-nx - 0.035, 0);

  // cheek ruffs, flaring out behind the eyes
  for (const side of [-1, 1]) {
    ctx.fillStyle = tcss([240, 214, 180]);
    ctx.beginPath();
    ctx.ellipse(0.44, side * 0.07, 0.046, 0.036, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tcss(INK, 0.85);
    ctx.lineWidth = 0.008;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0.415 + i * 0.026, side * 0.066);
      ctx.quadraticCurveTo(0.425 + i * 0.026, side * 0.088, 0.412 + i * 0.026, side * 0.104);
      ctx.stroke();
    }
  }
  // skull
  {
    const g = ctx.createRadialGradient(0.44 + lx * 0.03, ly * 0.03, 0, 0.44, 0, 0.12);
    g.addColorStop(0, tcss(FUR_HI));
    g.addColorStop(0.75, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0.445, 0, 0.105, 0.082, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ears, seen from behind: small and rounded, dark-backed with a pale fleck
  for (const side of [-1, 1]) {
    ctx.fillStyle = tcss(FUR_DEEP);
    ctx.beginPath();
    ctx.ellipse(0.38, side * 0.066, 0.018, 0.028, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tcss(INK, 0.85);
    ctx.beginPath();
    ctx.ellipse(0.374, side * 0.07, 0.013, 0.022, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tcss(CREAM, 0.85);
    ctx.beginPath();
    ctx.arc(0.371, side * 0.077, 0.005, 0, Math.PI * 2);
    ctx.fill();
  }
  // forehead marks
  ctx.strokeStyle = tcss(INK, 0.9);
  ctx.lineWidth = 0.009;
  for (const [y, x0, x1] of [
    [0.012, 0.4, 0.46],
    [-0.012, 0.4, 0.46],
    [0.034, 0.395, 0.445],
    [-0.034, 0.395, 0.445],
    [0.056, 0.4, 0.43],
    [-0.056, 0.4, 0.43],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y * 1.4, x1, y * 0.6);
    ctx.stroke();
  }
  // pale patches over the eyes, then the eyes
  for (const side of [-1, 1]) {
    ctx.fillStyle = tcss(CREAM, 0.95);
    ctx.beginPath();
    ctx.ellipse(0.478, side * 0.046, 0.022, 0.017, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tcss(INK);
    ctx.beginPath();
    ctx.ellipse(0.488, side * 0.04, 0.012, 0.0075, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(214,170,60,0.95)";
    ctx.beginPath();
    ctx.ellipse(0.489, side * 0.04, 0.007, 0.0045, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // muzzle: white whisker pads, an orange bridge, a dark-tipped nose
  ctx.fillStyle = tcss(CREAM);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0.535, side * 0.024, 0.032, 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = tcss(FUR);
  ctx.beginPath();
  ctx.ellipse(0.5, 0, 0.045, 0.016, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150,70,70,0.95)";
  ctx.beginPath();
  ctx.moveTo(0.548, -0.014);
  ctx.lineTo(0.548, 0.014);
  ctx.lineTo(0.566, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tcss(INK, 0.6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0.53 + i * 0.008, side * (0.03 + i * 0.006), 0.0028, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
