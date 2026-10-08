/**
 * A painted tiger wading, seen from above. Same conventions as swan-paint:
 * one body length (rump to neck) ≈ 1, facing +x, the caller sets up the
 * transform. The head is part of the same silhouette as the body, so the
 * neck flows into the crown with no seam.
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
  /** seconds, running continuously (for slow motions not tied to the stride) */
  time: number;
  /** how furry the coat looks, 0..1: hair strokes over it and soft fur at the edges */
  fur: number;
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
  for (let i = 0; i < 700; i++) {
    flecks.push({ u: -0.52 + r() * 0.9, v: (r() - 0.5) * 0.26, len: 0.012 + r() * 0.022, light: r() < 0.5 });
  }
  return { stripes, flecks };
}

/* ---------- the spine ---------- */

const U0 = -0.56; // rump
const U1 = 0.4; // where the neck meets the head
const UN = 0.668; // tip of the nose

// half-width along the spine: haunches, waist, shoulders, a thick neck,
// then the back of the skull, the cheeks and the muzzle
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
  [0.33, 0.122],
  [0.385, 0.104],
  [0.43, 0.118],
  [0.48, 0.14],
  [0.52, 0.142],
  [0.56, 0.125],
  [0.595, 0.098],
  [0.625, 0.07],
  [0.648, 0.048],
  [0.662, 0.026],
  [UN, 0],
];
function baseWidth(u: number): number {
  if (u <= SHAPE[0][0] || u >= UN) return 0;
  for (let i = 1; i < SHAPE.length; i++) {
    const [u1, w1] = SHAPE[i];
    const [u0, w0] = SHAPE[i - 1];
    if (u <= u1) {
      const t = (u - u0) / (u1 - u0);
      return w0 + (w1 - w0) * t * t * (3 - 2 * t);
    }
  }
  return 0;
}

/** How much weight a leg is carrying right now, 0..1 (peaks mid-stance). */
function load(phase: number, off: number) {
  const p = (((phase + off) % 1) + 1) % 1;
  return p < STANCE ? Math.sin((Math.PI * p) / STANCE) : 0;
}

const ease = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeSpine(pose: TigerPose) {
  const ph = pose.phase * Math.PI * 2;
  // a slow wave travelling back along the body, one swing per stride,
  // strongest through the middle and the haunches, the head held steady;
  // plus the arc of a turn, and the head turning on the neck
  const lateral = (u: number) => {
    const env = (0.55 + 0.45 * Math.cos((u - U0) * 2.2)) * (1 - 0.75 * ease(0.3, 0.6, u));
    const neck = Math.max(0, u - 0.34);
    return 0.03 * env * Math.sin(u * 5.4 + ph) + pose.curve * 0.5 * (u - 0.4) * (u - 0.4) - pose.curve * 0.08 + pose.headTurn * neck * neck * 2.6;
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
    // slow breathing swells the ribcage
    const breath = 1 + 0.016 * Math.sin(pose.time * 1.4) * Math.exp(-(u * u) / 0.06);
    return (
      baseWidth(u) * breath +
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

type Pt = [number, number];

const polygon = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
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
const pathOf = (pts: Pt[]) => {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  p.closePath();
  return p;
};

/**
 * Paint the tiger into its own (cleared) layer: the caller composites it
 * over the pond. Parts that sit under the surface are thinned out of the
 * layer, so the real water shows through them.
 */
export function paintTiger(ctx: CanvasRenderingContext2D, look: TigerLook, pose: TigerPose) {
  const sp = makeSpine(pose);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ph = pose.phase * Math.PI * 2;
  // the side of the back facing the sun
  const lit = pose.ly < 0 ? -1 : 1;

  // a strip along the spine from uA to uB, its edges at fl(u) and fr(u) of
  // the half-width on each side, nudged sideways by `shift`
  const strip = (fl: (u: number) => number, fr: (u: number) => number, uA = U0 + 0.003, uB = UN - 0.001, shift = 0, n = 48): Pt[] => {
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = uA + ((uB - uA) * i) / n;
      const wl = sp.width(u, -1);
      const wr = sp.width(u, 1);
      L.push(sp.at(u, -wl * fl(u) + shift * wl));
      R.push(sp.at(u, wr * fr(u) + shift * wr));
    }
    return [...L, ...R.reverse()];
  };
  const k = (f: number) => () => f;
  // a line laid on the body in spine coordinates
  const line = (pts: Pt[], width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([u, v], i) => {
      const [x, y] = sp.at(u, v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  const blob = (u: number, v: number, rx: number, ry: number, color: string) => {
    const [x, y] = sp.at(u, v);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, sp.angle(u), 0, Math.PI * 2);
    ctx.fill();
  };

  /* ---- tail: floats behind on the body's wave, dipping under mid-way ---- */
  const tailPts: Pt[] = [];
  const tailNrm: Pt[] = [];
  const TN = 30;
  {
    const [bx, by] = sp.at(U0 + 0.012, 0);
    let a = sp.angle(U0) + Math.PI;
    let x = bx;
    let y = by;
    const len = 0.68;
    for (let i = 0; i <= TN; i++) {
      const s = i / TN;
      tailPts.push([x, y]);
      tailNrm.push([-Math.sin(a), Math.cos(a)]);
      // a lazy, wandering sway of its own: slow motions at unrelated speeds,
      // travelling down the tail, so it never settles into one repeating
      // loop; only a light echo of the stride
      const t = pose.time - s * 1.4;
      const wander = 0.6 * Math.sin(t * 0.53 + 1.3) + 0.45 * Math.sin(t * 0.97 + 4.1) + 0.3 * Math.sin(t * 1.71 + 2.2) + 0.35 * Math.sin(t * 0.29 + 0.4);
      a += (wander * 0.075 + Math.sin(ph - 1.1 - s * 3.2) * 0.03 + 0.03 * s) * (0.5 + s);
      x += Math.cos(a) * (len / TN);
      y += Math.sin(a) * (len / TN);
    }
  }
  const tailW = (s: number) => 0.033 * (1 - s * 0.35);
  const tailStrip = (s0: number, s1: number): Pt[] => {
    const i0 = Math.round(s0 * TN);
    const i1 = Math.round(s1 * TN);
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = i0; i <= i1; i++) {
      const w = tailW(i / TN);
      L.push([tailPts[i][0] + tailNrm[i][0] * w, tailPts[i][1] + tailNrm[i][1] * w]);
      R.push([tailPts[i][0] - tailNrm[i][0] * w, tailPts[i][1] - tailNrm[i][1] * w]);
    }
    return [...L, ...R.reverse()];
  };
  ctx.fillStyle = tcss(FUR);
  polygon(ctx, tailStrip(0, 1));
  ctx.fill();
  ctx.fillStyle = tcss(FUR_HI, 0.6);
  for (let i = 0; i < TN; i++) {
    const w = tailW(i / TN) * 0.35;
    ctx.beginPath();
    ctx.arc(tailPts[i][0] + tailNrm[i][0] * w * lit, tailPts[i][1] + tailNrm[i][1] * w * lit, w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = tcss(INK, 0.92);
  for (let s = 0.2; s < 0.82; s += 0.11) {
    polygon(ctx, tailStrip(s, s + 0.045));
    ctx.fill();
  }
  polygon(ctx, tailStrip(0.86, 1));
  ctx.fill();
  {
    const tip = tailPts[TN];
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], tailW(1), 0, Math.PI * 2);
    ctx.fill();
  }
  // mid-way it slips under the surface
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < TN; i++) {
    const s = i / TN;
    if (s < 0.28 || s > 0.7) continue;
    const under = Math.sin(((s - 0.28) / 0.42) * Math.PI) * (0.55 + 0.15 * Math.sin(pose.time * 1.3 + s * 4));
    if (under <= 0.02) continue;
    ctx.fillStyle = `rgba(0,0,0,${under.toFixed(3)})`;
    polygon(ctx, tailStrip(s, s + 1 / TN));
    ctx.fill();
  }
  ctx.restore();

  /* ---- cheek ruffs: pale fur fanning out from the sides of the face ---- */
  for (const s of [-1, 1]) {
    const ruff: Pt[] = (
      [
        [0.455, 0.12],
        [0.472, 0.166],
        [0.497, 0.158],
        [0.518, 0.182],
        [0.543, 0.164],
        [0.565, 0.17],
        [0.585, 0.134],
        [0.6, 0.104],
        [0.55, 0.11],
        [0.5, 0.12],
      ] as Pt[]
    ).map(([u, v]) => sp.at(u, s * v));
    ctx.fillStyle = tcss([236, 222, 202]);
    polygon(ctx, ruff);
    ctx.fill();
    line([[0.49, s * 0.13], [0.5, s * 0.152], [0.49, s * 0.168]], 0.008, tcss(INK, 0.85));
    line([[0.53, s * 0.13], [0.54, s * 0.15], [0.532, s * 0.164]], 0.007, tcss(INK, 0.85));
  }

  /* ---- ears: soft and rounded, like a big cat's, standing out at the sides ---- */
  for (const s of [-1, 1]) {
    const P = (u: number, v: number) => sp.at(u, s * v);
    const [b1x, b1y] = P(0.472, 0.108);
    const [c1x, c1y] = P(0.468, 0.16);
    const [tx, ty] = P(0.44, 0.176);
    const [c2x, c2y] = P(0.41, 0.164);
    const [b2x, b2y] = P(0.402, 0.106);
    ctx.fillStyle = tcss(FUR);
    ctx.beginPath();
    ctx.moveTo(b1x, b1y);
    ctx.quadraticCurveTo(c1x, c1y, tx, ty);
    ctx.quadraticCurveTo(c2x, c2y, b2x, b2y);
    ctx.closePath();
    ctx.fill();
    // a soft, slightly darker rim toward the tip
    ctx.strokeStyle = tcss(FUR_DEEP, 0.55);
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    const [r1x, r1y] = P(0.463, 0.15);
    const [r2x, r2y] = P(0.418, 0.152);
    ctx.moveTo(r1x, r1y);
    ctx.quadraticCurveTo(tx, ty, r2x, r2y);
    ctx.stroke();
    // the fluffy pale inside
    const [i1x, i1y] = P(0.458, 0.114);
    const [ic1x, ic1y] = P(0.455, 0.15);
    const [itx, ity] = P(0.44, 0.16);
    const [ic2x, ic2y] = P(0.423, 0.15);
    const [i2x, i2y] = P(0.418, 0.112);
    ctx.fillStyle = "rgba(246,218,204,0.92)";
    ctx.beginPath();
    ctx.moveTo(i1x, i1y);
    ctx.quadraticCurveTo(ic1x, ic1y, itx, ity);
    ctx.quadraticCurveTo(ic2x, ic2y, i2x, i2y);
    ctx.closePath();
    ctx.fill();
  }

  /* ---- body and head, one silhouette ---- */
  const full = pathOf(strip(k(1), k(1)));
  ctx.fillStyle = tcss(FUR_DEEP);
  ctx.fill(full);
  ctx.save();
  ctx.clip(full);
  // round the back and the crown: deeper down the sides, warm through the middle, a lit ridge
  ctx.fillStyle = tcss(FUR, 0.92);
  ctx.fill(pathOf(strip(k(0.8), k(0.8), undefined, undefined, lit * 0.06)));
  ctx.fillStyle = tcss(FUR_HI, 0.55);
  ctx.fill(pathOf(strip(k(0.52), k(0.52), undefined, undefined, lit * 0.12)));
  ctx.fillStyle = tcss([248, 176, 92], 0.35);
  ctx.fill(pathOf(strip(k(0.24), k(0.24), undefined, UN - 0.03, lit * 0.2)));
  // shoulder blades and haunches catch the light as they roll
  for (const [u, off] of [
    [0.17, 0.25],
    [-0.36, 0.0],
  ] as const) {
    for (const side of [-1, 1]) {
      const w = sp.width(u, side);
      const loadNow = load(pose.phase, side < 0 ? off : off + 0.5);
      const [x, y] = sp.at(u, side * w * 0.42);
      const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.6);
      g.addColorStop(0, tcss([250, 182, 100], 0.18 + 0.22 * loadNow));
      g.addColorStop(1, tcss([250, 182, 100], 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
    }
  }
  // the spine: a darker seam where the stripes meet
  ctx.fillStyle = tcss(FUR_DEEP, 0.3);
  ctx.fill(pathOf(strip(k(0.07), k(0.07), U0 + 0.02, 0.42)));
  // fur, lying back along the body: more strokes, and longer, the furrier the coat
  const furN = Math.round(look.flecks.length * pose.fur);
  ctx.lineWidth = 0.0045 + 0.002 * pose.fur;
  for (const light of [true, false]) {
    ctx.strokeStyle = light ? tcss(FUR_HI, 0.32) : tcss(FUR_DEEP, 0.24);
    ctx.beginPath();
    for (let i = 0; i < furN; i++) {
      const f = look.flecks[i];
      if (f.light !== light || f.u > 0.38) continue;
      const side = Math.sign(f.v) || 1;
      const frac = Math.abs(f.v) / 0.13;
      if (frac > 0.95) continue;
      const w = sp.width(f.u, side);
      const v = side * w * Math.sin(frac * Math.PI * 0.5);
      const a = sp.at(f.u, v);
      const b = sp.at(f.u - f.len * (0.6 + pose.fur), v * 1.03);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  // stripes wrap round the barrel of the body: laid out along its surface,
  // so they crowd together as they turn down the flanks
  ctx.fillStyle = tcss(INK, 0.92);
  for (const st of look.stripes) {
    const n = 16;
    const L: Pt[] = [];
    const R: Pt[] = [];
    const surf = (u: number, arc: number) => st.side * sp.width(u, st.side) * Math.sin(Math.min(1, arc) * Math.PI * 0.5);
    const reach = 0.55 + st.reach * 0.55; // quarter-turns round the body; past 1 it's under the water
    const gap = st.gap / 0.13;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = st.u - st.sweep * Math.pow(t, 1.3) + st.wob * Math.sin(t * Math.PI);
      const arc = gap + (reach - gap) * t;
      const hw = st.w * Math.sin(Math.PI * (0.08 + 0.92 * t)) * (1.15 - 0.45 * t) + 0.001;
      L.push(sp.at(u + hw, surf(u, arc)));
      R.push(sp.at(u - hw, surf(u, arc)));
    }
    polygon(ctx, [...L, ...R.reverse()]);
    ctx.fill();
    if (st.fork) {
      const t0 = st.fork;
      const u0 = st.u - st.sweep * Math.pow(t0, 1.3);
      const a0 = gap + (reach - gap) * t0;
      const F: Pt[] = [];
      const G: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const u = u0 - 0.025 * t;
        const arc = a0 + 0.3 * t;
        const hw = st.w * 0.6 * Math.sin(Math.PI * (0.1 + 0.9 * t)) + 0.0008;
        F.push(sp.at(u + hw, surf(u, arc)));
        G.push(sp.at(u - hw, surf(u, arc)));
      }
      polygon(ctx, [...F, ...G.reverse()]);
      ctx.fill();
    }
  }

  /* ---- the face, from above ---- */
  // neck stripes running up onto the back of the head
  for (const s of [-1, 1]) {
    line([[0.4, s * 0.02], [0.405, s * 0.06], [0.392, s * 0.1]], 0.008, tcss(INK, 0.9));
    line([[0.428, s * 0.016], [0.434, s * 0.05], [0.424, s * 0.08]], 0.006, tcss(INK, 0.9));
  }
  // the long bridge of the nose, lit
  ctx.fillStyle = tcss([248, 178, 96], 0.6);
  ctx.fill(pathOf(strip(k(0.3), k(0.3), 0.565, UN - 0.012, 0, 12)));
  // forehead: stripes sweeping back and out from the middle of the brow
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const u = 0.585 - i * 0.03;
      line([[u, s * 0.012], [u - 0.008, s * 0.042], [u - 0.032, s * (0.07 + i * 0.006)]], 0.0055 + i * 0.0014, tcss(INK, 0.92));
    }
  }
  line([[0.47, 0.007], [0.53, 0.004]], 0.005, tcss(INK, 0.85));
  line([[0.47, -0.007], [0.53, -0.004]], 0.005, tcss(INK, 0.85));
  line([[0.545, 0], [0.575, 0]], 0.005, tcss(INK, 0.85));
  for (const s of [-1, 1]) {
    // a pale brow, then the eye: a hooded amber slit at the side of the head
    blob(0.59, s * 0.05, 0.009, 0.0055, tcss(CREAM, 0.85));
    line([[0.6, s * 0.06], [0.588, s * 0.071], [0.572, s * 0.078]], 0.009, tcss(INK));
    line([[0.596, s * 0.063], [0.584, s * 0.071]], 0.0035, "rgba(224,172,62,0.95)");
    // and the dark line running back from it across the cheek
    line([[0.572, s * 0.08], [0.545, s * 0.093], [0.515, s * 0.1]], 0.006, tcss(INK, 0.9));
  }
  // the nose leather at the very tip
  {
    const tip: Pt[] = ([
      [0.652, -0.013],
      [0.667, 0],
      [0.652, 0.013],
      [0.648, 0],
    ] as Pt[]).map(([u, v]) => sp.at(u, v));
    ctx.fillStyle = "rgba(138,74,70,1)";
    polygon(ctx, tip);
    ctx.fill();
  }
  ctx.restore();

  /* ---- soft fur breaking the edge of the silhouette ---- */
  if (pose.fur > 0.02) {
    const len = 0.022 * pose.fur;
    ctx.lineWidth = 0.004;
    for (const light of [false, true]) {
      ctx.strokeStyle = light ? tcss(FUR_HI, 0.55 * pose.fur) : tcss(FUR, 0.7 * pose.fur);
      ctx.beginPath();
      for (const side of [-1, 1]) {
        for (let u = U0 + 0.03; u < UN - 0.03; u += 0.0045) {
          const h = Math.sin(u * 912.7 + side * 37.1) * 43758.5453;
          const rnd = h - Math.floor(h);
          if (light !== rnd > 0.6) continue;
          const w = sp.width(u, side);
          const a = sp.at(u, side * w * 0.9);
          const b = sp.at(u - len * (0.5 + rnd), side * (w + len * (0.4 + rnd * 0.8)));
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
      ctx.stroke();
    }
  }

  /* ---- where the body goes into the water ---- */
  // the flanks are thinned out of the layer so the pond shows through, more
  // the deeper they go; it eases off toward the neck, which rides above
  const toNeck = (f: number) => (u: number) => f + (1 - f) * ease(0.28, 0.44, u);
  const bodyOnly = (fl: (u: number) => number) => pathOf(strip(fl, fl, U0 + 0.003, 0.46));
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const outer = bodyOnly(k(1));
  for (const [f0, a] of [
    [0.7, 0.18],
    [0.8, 0.2],
    [0.88, 0.22],
    [0.95, 0.25],
  ] as const) {
    const ring = new Path2D();
    ring.addPath(outer);
    ring.addPath(bodyOnly(toNeck(f0)));
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fill(ring, "evenodd");
  }
  ctx.restore();
  // the wet line where fur meets water, broken by the ripple of the surface
  ctx.strokeStyle = tcss([236, 246, 244], 0.32);
  ctx.lineWidth = 0.006;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const u = U0 + 0.05 + ((0.36 - U0 - 0.05) * i) / 36;
      const f = 0.84 + 0.04 * Math.sin(u * 40 + ph * 2 + side);
      const [x, y] = sp.at(u, side * sp.width(u, side) * f);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // under the surface: the bulk of the body and legs, dim and water-dark
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  {
    const a: Pt[] = [];
    const b: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = U0 + 0.02 + ((0.44 - U0 - 0.02) * i) / 40;
      const legs = Math.exp(-((u - 0.17) ** 2) / 0.006) * 0.05 + Math.exp(-((u + 0.36) ** 2) / 0.008) * 0.06;
      const taper = 1 - ease(0.34, 0.44, u) * 0.6;
      a.push(sp.at(u, -(sp.width(u, -1) * 1.22 + legs) * taper));
      b.push(sp.at(u, (sp.width(u, 1) * 1.22 + legs) * taper));
    }
    ctx.fillStyle = "rgba(70,44,30,0.32)";
    polygon(ctx, [...a, ...b.reverse()]);
    ctx.fill();
  }
  ctx.restore();
}
