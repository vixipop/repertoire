/**
 * A painted tiger wading, seen from above. Same conventions as swan-paint:
 * one body length (rump to neck) ≈ 1, facing +x, the caller sets up the
 * transform.
 *
 * Everything on the body is laid out in spine coordinates (u along the
 * spine, v across it) and mapped through a spine that flexes as it walks, so
 * the outline, the fur and every stripe bend with the body. A slow wave runs
 * from the shoulders back through the hips into the tail with each stride;
 * the shoulder blades and haunches roll as the weight shifts. The legs stay
 * under the water: tigerFeet() only says where the paws come down, so the
 * pond can ring the water there.
 */

type RGB = [number, number, number];
const tcss = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const FUR_HI: RGB = [238, 146, 58];
const FUR: RGB = [208, 104, 34];
const FUR_DEEP: RGB = [140, 58, 22];
const CREAM: RGB = [244, 232, 214];
const INK: RGB = [18, 12, 10];

type Stripe = { u: number; side: number; gap: number; reach: number; w: number; sweep: number; wob: number; fork: number };
type Fleck = { u: number; v: number; len: number; light: boolean };

export type TigerLook = { stripes: Stripe[]; flecks: Fleck[] };

export type TigerPose = {
  /** gait phase, 0..1 per stride */
  phase: number;
  /** how much the whole body arcs into a turn, -1..1 */
  curve: number;
  headTurn: number;
  /** light direction in the tiger's own frame */
  lx: number;
  ly: number;
};

export const STRIDE = 0.34; // body lengths covered per stride
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
  for (const side of [-1, 1]) {
    let u = -0.5;
    while (u < 0.34) {
      const hind = u < -0.12;
      const fore = u > 0.14;
      const w = (hind ? 0.011 : fore ? 0.0065 : 0.0085) + r() * 0.005;
      const stripe = {
        u: u + (r() - 0.5) * 0.02,
        side,
        gap: 0.004 + r() * 0.018,
        reach: 0.6 + r() * 0.4,
        w,
        sweep: 0.008 + r() * 0.03,
        wob: (r() - 0.5) * 0.022,
        fork: r() < 0.12 ? 0.45 + r() * 0.25 : 0,
      };
      stripes.push(stripe);
      // tigers' stripes often run in close pairs
      if (r() < 0.3) stripes.push({ ...stripe, u: stripe.u - 0.016 - r() * 0.006, w: w * 0.6, reach: stripe.reach * (0.45 + r() * 0.3), gap: stripe.gap + 0.01, fork: 0 });
      u += (hind ? 0.06 : fore ? 0.045 : 0.052) + r() * 0.025;
    }
  }
  const flecks: Fleck[] = [];
  for (let i = 0; i < 140; i++) {
    flecks.push({ u: -0.52 + r() * 0.9, v: (r() - 0.5) * 0.26, len: 0.015 + r() * 0.025, light: r() < 0.5 });
  }
  return { stripes, flecks };
}

/* ---------- the spine ---------- */

const U0 = -0.56; // rump
const U1 = 0.4; // where the neck meets the head

const SHAPE: Array<[number, number]> = [
  [-0.56, 0],
  [-0.54, 0.07],
  [-0.48, 0.135],
  [-0.38, 0.162],
  [-0.25, 0.148],
  [-0.09, 0.136],
  [0.05, 0.148],
  [0.15, 0.168],
  [0.25, 0.152],
  [0.33, 0.118],
  [0.4, 0.1],
];
function baseWidth(u: number): number {
  if (u <= SHAPE[0][0]) return 0;
  for (let i = 1; i < SHAPE.length; i++) {
    const [u1, w1] = SHAPE[i];
    const [u0, w0] = SHAPE[i - 1];
    if (u <= u1) {
      const t = (u - u0) / (u1 - u0);
      return w0 + (w1 - w0) * t * t * (3 - 2 * t);
    }
  }
  return SHAPE[SHAPE.length - 1][1];
}

/** How much weight a leg is carrying right now, 0..1 (peaks mid-stance). */
function load(phase: number, off: number) {
  const p = (((phase + off) % 1) + 1) % 1;
  return p < STANCE ? Math.sin((Math.PI * p) / STANCE) : 0;
}

function makeSpine(pose: TigerPose) {
  const ph = pose.phase * Math.PI * 2;
  // a slow wave travelling back along the body, one swing per stride,
  // strongest through the middle and the haunches; plus the arc of a turn
  const lateral = (u: number) => {
    const env = 0.55 + 0.45 * Math.cos((u - U0) * 2.2);
    return 0.03 * env * Math.sin(u * 5.4 + ph) + pose.curve * 0.5 * (u - 0.4) * (u - 0.4) - pose.curve * 0.08;
  };
  const e = 0.004;
  const at = (u: number, v: number): [number, number] => {
    const y = lateral(u);
    const dy = (lateral(u + e) - lateral(u - e)) / (2 * e);
    const l = Math.hypot(1, dy);
    return [u - (dy / l) * v, y + (1 / l) * v];
  };
  const angle = (u: number) => Math.atan((lateral(u + e) - lateral(u - e)) / (2 * e));
  // shoulder blades and haunches rise on the side carrying the weight
  const width = (u: number, side: number) => {
    const front = side < 0 ? load(pose.phase, 0.25) : load(pose.phase, 0.75);
    const hind = side < 0 ? load(pose.phase, 0) : load(pose.phase, 0.5);
    return (
      baseWidth(u) +
      Math.exp(-((u - 0.17) ** 2) / 0.0035) * (front - 0.5) * 0.018 +
      Math.exp(-((u + 0.36) ** 2) / 0.005) * (hind - 0.5) * 0.016
    );
  };
  return { at, angle, width, lateral };
}

/** Where each paw comes down, in the tiger's frame (the legs themselves stay under water). */
export function tigerFeet(pose: TigerPose) {
  return LEGS.map((leg) => {
    const p = (((pose.phase + leg.off) % 1) + 1) % 1;
    let dx: number;
    let lift = 0;
    if (p < STANCE) {
      dx = STRIDE * (0.5 - p / STANCE);
    } else {
      const q = (p - STANCE) / (1 - STANCE);
      dx = STRIDE * (-0.5 + q * q * (3 - 2 * q));
      lift = Math.sin(Math.PI * q);
    }
    const base = leg.front ? 0.17 : -0.34;
    return { x: base + dx, y: leg.side * 0.11, lift, front: leg.front, side: leg.side, p };
  });
}

/* ---------- painting ---------- */

const polygon = (ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  const z = pts[pts.length - 1];
  ctx.lineTo(z[0], z[1]);
  ctx.closePath();
};

export function paintTiger(ctx: CanvasRenderingContext2D, look: TigerLook, pose: TigerPose) {
  const sp = makeSpine(pose);
  const { lx, ly } = pose;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ph = pose.phase * Math.PI * 2;

  /* ---- tail: carries on the body's wave, a beat behind, the tip curling ---- */
  {
    const [bx, by] = sp.at(U0 + 0.012, 0);
    const a0 = sp.angle(U0) + Math.PI;
    const N = 30;
    const len = 0.66;
    const mid: Array<[number, number]> = [];
    const nrm: Array<[number, number]> = [];
    let x = bx;
    let y = by;
    let a = a0;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      mid.push([x, y]);
      nrm.push([-Math.sin(a), Math.cos(a)]);
      a += (Math.sin(ph - 1.1 - s * 3.2) * 0.11 + Math.sin(ph * 0.5 + 2) * 0.03 + 0.03 * s) * (0.5 + s);
      x += Math.cos(a) * (len / N);
      y += Math.sin(a) * (len / N);
    }
    const wAt = (s: number) => 0.03 * (1 - s * 0.35);
    const strip = (s0: number, s1: number) => {
      const i0 = Math.round(s0 * N);
      const i1 = Math.round(s1 * N);
      const L: Array<[number, number]> = [];
      const R: Array<[number, number]> = [];
      for (let i = i0; i <= i1; i++) {
        const w = wAt(i / N);
        L.push([mid[i][0] + nrm[i][0] * w, mid[i][1] + nrm[i][1] * w]);
        R.push([mid[i][0] - nrm[i][0] * w, mid[i][1] - nrm[i][1] * w]);
      }
      return [...L, ...R.reverse()];
    };
    ctx.fillStyle = tcss(FUR);
    polygon(ctx, strip(0, 1));
    ctx.fill();
    ctx.fillStyle = tcss(INK, 0.92);
    for (let s = 0.22; s < 0.82; s += 0.115) {
      polygon(ctx, strip(s, s + 0.05));
      ctx.fill();
    }
    polygon(ctx, strip(0.86, 1));
    ctx.fill();
    // round the tip
    const tip = mid[N];
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], wAt(1), 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---- body ---- */
  const S = 56;
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i <= S; i++) {
    const u = U0 + ((U1 - U0) * i) / S;
    left.push(sp.at(u, -sp.width(u, -1)));
    right.push(sp.at(u, sp.width(u, 1)));
  }
  const outline = [...left, ...right.reverse()];
  const body = new Path2D();
  body.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const a = outline[i - 1];
    const b = outline[i];
    body.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  body.closePath();

  {
    const [cx, cy] = sp.at(-0.08, 0);
    const g = ctx.createRadialGradient(cx + lx * 0.1, cy + ly * 0.06, 0, cx, cy, 0.6);
    g.addColorStop(0, tcss(FUR_HI));
    g.addColorStop(0.55, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.fill(body);
  }

  ctx.save();
  ctx.clip(body);
  // the back runs deeper in colour than the flanks
  const band = (v: number): Array<[number, number]> => {
    const L: Array<[number, number]> = [];
    const R: Array<[number, number]> = [];
    for (let i = 0; i <= 24; i++) {
      const u = U0 + 0.03 + ((U1 - U0 - 0.03) * i) / 24;
      L.push(sp.at(u, -v));
      R.push(sp.at(u, v));
    }
    return [...L, ...R.reverse()];
  };
  ctx.fillStyle = tcss(FUR_DEEP, 0.28);
  polygon(ctx, band(0.05));
  ctx.fill();
  ctx.fillStyle = tcss(FUR_DEEP, 0.2);
  polygon(ctx, band(0.022));
  ctx.fill();
  // pale fur where the flanks turn under, toward the water
  ctx.strokeStyle = tcss(CREAM, 0.32);
  ctx.lineWidth = 0.04;
  ctx.stroke(body);
  // fur lies back along the body
  ctx.lineWidth = 0.007;
  for (const f of look.flecks) {
    const w = sp.width(f.u, Math.sign(f.v) || 1);
    if (Math.abs(f.v) > w) continue;
    const a = sp.at(f.u, f.v);
    const b = sp.at(f.u - f.len, f.v * 1.04);
    ctx.strokeStyle = f.light ? tcss(FUR_HI, 0.32) : tcss(FUR_DEEP, 0.22);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  // stripes, laid out across the spine and carried by it: they bend as it bends
  ctx.fillStyle = tcss(INK, 0.93);
  for (const st of look.stripes) {
    const reach = (sp.width(st.u, st.side) + 0.02) * st.reach;
    const n = 14;
    const L: Array<[number, number]> = [];
    const R: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = st.u - st.sweep * Math.pow(t, 1.3) + st.wob * Math.sin(t * Math.PI);
      const v = st.side * (st.gap + (reach - st.gap) * t);
      // tapered at both ends, fullest a little way down from the spine
      const hw = st.w * Math.sin(Math.PI * (0.08 + 0.92 * t)) * (1.15 - 0.55 * t) + 0.001;
      L.push(sp.at(u + hw, v));
      R.push(sp.at(u - hw, v));
    }
    polygon(ctx, [...L, ...R.reverse()]);
    ctx.fill();
    if (st.fork) {
      const t0 = st.fork;
      const u0 = st.u - st.sweep * Math.pow(t0, 1.3);
      const v0 = st.side * (st.gap + (reach - st.gap) * t0);
      const F: Array<[number, number]> = [];
      const G: Array<[number, number]> = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const u = u0 - 0.025 * t;
        const v = v0 + st.side * reach * 0.3 * t;
        const hw = st.w * 0.6 * Math.sin(Math.PI * (0.1 + 0.9 * t)) + 0.0008;
        F.push(sp.at(u + hw, v));
        G.push(sp.at(u - hw, v));
      }
      polygon(ctx, [...F, ...G.reverse()]);
      ctx.fill();
    }
  }
  // light from above one shoulder, shade falling across the other flank
  {
    const g = ctx.createLinearGradient(-lx * 0.18, -ly * 0.18, lx * 0.18, ly * 0.18);
    g.addColorStop(0, "rgba(30,14,8,0.26)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(255,224,176,0.14)");
    ctx.fillStyle = g;
    ctx.fill(body);
  }
  ctx.restore();

  /* ---- head: steadier than the body, as a cat's is ---- */
  const [hx, hy] = sp.at(U1 - 0.035, 0);
  const ha = sp.angle(U1) * 0.35 + pose.headTurn;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ha);
  ctx.scale(1.15, 1.15);
  ctx.translate(Math.sin(ph * 2) * 0.004, 0);

  // ruff where the neck meets the head
  ctx.fillStyle = tcss(FUR);
  ctx.beginPath();
  ctx.ellipse(-0.015, 0, 0.09, 0.108, 0, 0, Math.PI * 2);
  ctx.fill();

  const half: Array<[number, number]> = [
    [-0.04, 0],
    [-0.03, 0.07],
    [0.02, 0.098],
    [0.085, 0.118],
    [0.14, 0.104],
    [0.18, 0.078],
    [0.208, 0.052],
    [0.228, 0.026],
    [0.236, 0],
  ];
  const headPts: Array<[number, number]> = [
    ...half.map(([x, y]) => [x, -y] as [number, number]),
    ...half.slice(0, -1).reverse().map(([x, y]) => [x, y] as [number, number]),
  ];
  const head = new Path2D();
  head.moveTo(headPts[0][0], headPts[0][1]);
  for (let i = 1; i < headPts.length; i++) {
    const a = headPts[i - 1];
    const b = headPts[i];
    head.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  head.closePath();
  {
    const g = ctx.createRadialGradient(0.08 + lx * 0.02, ly * 0.02, 0, 0.09, 0, 0.16);
    g.addColorStop(0, tcss(FUR_HI));
    g.addColorStop(0.65, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.fill(head);
  }

  ctx.save();
  ctx.clip(head);
  for (const s of [-1, 1]) {
    // white cheeks and ruff along the sides of the face
    ctx.fillStyle = tcss(CREAM, 0.95);
    polygon(ctx, [
      [0.05, s * 0.084],
      [0.11, s * 0.08],
      [0.165, s * 0.066],
      [0.2, s * 0.044],
      [0.226, s * 0.022],
      [0.23, s * 0.13],
      [0.04, s * 0.14],
    ]);
    ctx.fill();
    // cheek stripes, sweeping back
    ctx.strokeStyle = tcss(INK, 0.9);
    for (const [x0, y0, x1, y1, w] of [
      [0.085, 0.084, 0.045, 0.118, 0.009],
      [0.12, 0.084, 0.08, 0.124, 0.008],
      [0.155, 0.072, 0.13, 0.11, 0.006],
    ]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, s * y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 0.01, (s * (y0 + y1)) / 2, x1, s * y1);
      ctx.stroke();
    }
    // the dark line running back from the eye
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    ctx.moveTo(0.134, s * 0.054);
    ctx.quadraticCurveTo(0.115, s * 0.068, 0.094, s * 0.078);
    ctx.stroke();
    // forehead marks: broken, sweeping back and out from the centre
    for (const [x0, y0, x1, y1, w] of [
      [0.03, 0.018, -0.005, 0.062, 0.0075],
      [0.06, 0.022, 0.03, 0.07, 0.006],
      [0.088, 0.024, 0.07, 0.056, 0.0045],
      [0.012, 0.03, -0.02, 0.048, 0.005],
    ]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, s * y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 0.006, (s * (y0 + y1)) / 2 + s * 0.004, x1, s * y1);
      ctx.stroke();
    }
    // pale brow over each eye
    ctx.fillStyle = tcss(CREAM, 0.9);
    ctx.beginPath();
    ctx.ellipse(0.13, s * 0.05, 0.02, 0.01, -s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // short marks down the middle of the brow
  ctx.strokeStyle = tcss(INK, 0.85);
  ctx.lineWidth = 0.006;
  for (const [x0, x1, y] of [
    [0.0, 0.05, 0.007],
    [0.0, 0.05, -0.007],
    [0.07, 0.1, 0.0],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y * 0.4);
    ctx.stroke();
  }
  // the bridge of the nose catches the light
  ctx.fillStyle = tcss(FUR_HI, 0.85);
  ctx.beginPath();
  ctx.ellipse(0.188, 0, 0.042, 0.019, 0, 0, Math.PI * 2);
  ctx.fill();
  // whisker pads
  for (const s of [-1, 1]) {
    ctx.fillStyle = tcss(CREAM);
    ctx.beginPath();
    ctx.ellipse(0.214, s * 0.028, 0.026, 0.023, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tcss(INK, 0.35);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(0.206 + i * 0.009, s * (0.024 + row * 0.007 + i * 0.002), 0.0012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // nose leather
  ctx.fillStyle = "rgba(146,80,74,1)";
  ctx.beginPath();
  ctx.moveTo(0.214, -0.013);
  ctx.quadraticCurveTo(0.226, -0.012, 0.234, 0);
  ctx.quadraticCurveTo(0.226, 0.012, 0.214, 0.013);
  ctx.quadraticCurveTo(0.209, 0, 0.214, -0.013);
  ctx.fill();
  ctx.strokeStyle = tcss(INK, 0.3);
  ctx.lineWidth = 0.002;
  ctx.stroke();

  // eyes: narrow, dark-rimmed, amber, both fixed straight ahead
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(0.152, s * 0.043);
    ctx.rotate(-s * 0.45);
    ctx.fillStyle = tcss(INK);
    ctx.beginPath();
    ctx.moveTo(-0.022, 0);
    ctx.quadraticCurveTo(0, -0.014, 0.018, 0.0);
    ctx.quadraticCurveTo(0, 0.01, -0.022, 0);
    ctx.fill();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.011);
    g.addColorStop(0, "rgba(236,206,96,1)");
    g.addColorStop(1, "rgba(196,132,40,1)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.016, 0);
    ctx.quadraticCurveTo(0, -0.0098, 0.014, 0.0);
    ctx.quadraticCurveTo(0, 0.0068, -0.016, 0);
    ctx.fill();
    ctx.restore();
    // pupils sit in the same place in both eyes, so the gaze is level
    ctx.fillStyle = tcss(INK);
    ctx.beginPath();
    ctx.ellipse(0.153, s * 0.0425, 0.0036, 0.0046, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,250,235,0.85)";
    ctx.beginPath();
    ctx.arc(0.1515, s * 0.0425 - 0.0024, 0.0011, 0, Math.PI * 2);
    ctx.fill();
  }

  // ears: short and rounded, set back on the skull, dark along the back edge
  for (const s of [-1, 1]) {
    ctx.fillStyle = tcss(FUR_DEEP);
    ctx.beginPath();
    ctx.moveTo(0.012, s * 0.05);
    ctx.quadraticCurveTo(-0.05, s * 0.06, -0.038, s * 0.1);
    ctx.quadraticCurveTo(-0.004, s * 0.108, 0.026, s * 0.092);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tcss(INK, 0.85);
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.moveTo(-0.03, s * 0.066);
    ctx.quadraticCurveTo(-0.048, s * 0.088, -0.034, s * 0.102);
    ctx.stroke();
    ctx.strokeStyle = tcss(CREAM, 0.5);
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.moveTo(0.004, s * 0.068);
    ctx.quadraticCurveTo(-0.014, s * 0.08, -0.018, s * 0.094);
    ctx.stroke();
  }
  ctx.restore();
}
