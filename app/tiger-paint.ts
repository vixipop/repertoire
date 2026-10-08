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

/**
 * Paint the tiger into its own (cleared) layer: the caller composites it
 * over the pond. Parts that sit under the surface are thinned out of the
 * layer, so the real water shows through them.
 */
export function paintTiger(ctx: CanvasRenderingContext2D, look: TigerLook, pose: TigerPose) {
  const sp = makeSpine(pose);
  const { lx, ly } = pose;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ph = pose.phase * Math.PI * 2;

  // a band down the body, from -v to +v across the spine (v as a fraction of the half-width)
  const band = (f0: number, f1: number, shift = 0): Array<[number, number]> => {
    const L: Array<[number, number]> = [];
    const R: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      const u = U0 + 0.004 + ((U1 - U0 - 0.004) * i) / 40;
      const wl = sp.width(u, -1);
      const wr = sp.width(u, 1);
      L.push(sp.at(u, -wl * f1 + shift * wl));
      R.push(sp.at(u, wr * f0 + shift * wr));
    }
    return [...L, ...R.reverse()];
  };
  const pathOf = (pts: Array<[number, number]>) => {
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
  // the light side of the back is the side facing the sun
  const lit = ly < 0 ? -1 : 1;

  /* ---- tail: floats behind on the body's wave, dipping under mid-way ---- */
  const tailPts: Array<[number, number]> = [];
  const tailNrm: Array<[number, number]> = [];
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
      a += (Math.sin(ph - 1.1 - s * 3.2) * 0.11 + Math.sin(ph * 0.5 + 2) * 0.03 + 0.035 * s) * (0.5 + s);
      x += Math.cos(a) * (len / TN);
      y += Math.sin(a) * (len / TN);
    }
  }
  const tailW = (s: number) => 0.033 * (1 - s * 0.35);
  const tailStrip = (s0: number, s1: number) => {
    const i0 = Math.round(s0 * TN);
    const i1 = Math.round(s1 * TN);
    const L: Array<[number, number]> = [];
    const R: Array<[number, number]> = [];
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
  for (let i = 0; i < TN; i += 1) {
    // a lit ridge along the top of the tail
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
    const under = Math.max(0, Math.sin(((s - 0.28) / 0.42) * Math.PI)) * (0.55 + 0.15 * Math.sin(ph + s * 4));
    if (under <= 0.02 || s < 0.28 || s > 0.7) continue;
    ctx.fillStyle = `rgba(0,0,0,${under.toFixed(3)})`;
    polygon(ctx, tailStrip(s, s + 1 / TN));
    ctx.fill();
  }
  ctx.restore();

  /* ---- body ---- */
  const full = pathOf(band(1, 1));
  {
    const [cx, cy] = sp.at(-0.08, 0);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.62);
    g.addColorStop(0, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.fill(full);
  }
  ctx.save();
  ctx.clip(full);
  // round the back: deeper down the flanks, warm through the middle, a lit ridge
  ctx.fillStyle = tcss(FUR, 0.9);
  ctx.fill(pathOf(band(0.8, 0.8, lit * 0.06)));
  ctx.fillStyle = tcss(FUR_HI, 0.55);
  ctx.fill(pathOf(band(0.52, 0.52, lit * 0.12)));
  ctx.fillStyle = tcss([248, 176, 92], 0.35);
  ctx.fill(pathOf(band(0.24, 0.24, lit * 0.2)));
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
  ctx.fill(pathOf(band(0.07, 0.07)));
  // fur, lying back along the body
  ctx.lineWidth = 0.006;
  for (const light of [true, false]) {
    ctx.strokeStyle = light ? tcss(FUR_HI, 0.3) : tcss(FUR_DEEP, 0.2);
    ctx.beginPath();
    for (const f of look.flecks) {
      if (f.light !== light) continue;
      const side = Math.sign(f.v) || 1;
      const frac = Math.abs(f.v) / 0.13;
      if (frac > 0.95) continue;
      const w = sp.width(f.u, side);
      const v = side * w * Math.sin(frac * Math.PI * 0.5);
      const a = sp.at(f.u, v);
      const b = sp.at(f.u - f.len, v * 1.03);
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
    const L: Array<[number, number]> = [];
    const R: Array<[number, number]> = [];
    const surf = (u: number, arc: number) => {
      const w = sp.width(u, st.side);
      return st.side * w * Math.sin(Math.min(1, arc) * Math.PI * 0.5);
    };
    const reach = 0.55 + st.reach * 0.55; // in quarter-turns round the body; past 1 it's under the water
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
      const F: Array<[number, number]> = [];
      const G: Array<[number, number]> = [];
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
  ctx.restore();

  // the flanks go down into the water: thin them out of the layer so the pond
  // shows through, more the deeper they go
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const [f0, a] of [
    [0.7, 0.18],
    [0.8, 0.2],
    [0.88, 0.22],
    [0.95, 0.25],
  ] as const) {
    const ring = new Path2D();
    ring.addPath(full);
    ring.addPath(pathOf(band(f0, f0)));
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fill(ring, "evenodd");
  }
  ctx.restore();
  // where fur meets water: a thin bright line, broken by the ripple of the surface
  ctx.strokeStyle = tcss([236, 246, 244], 0.32);
  ctx.lineWidth = 0.006;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const u = U0 + 0.05 + ((U1 - U0 - 0.06) * i) / 36;
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
    const under: Array<[number, number]> = [];
    const under2: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) {
      const u = U0 + 0.02 + ((U1 - U0) * i) / 40;
      const legs = Math.exp(-((u - 0.17) ** 2) / 0.006) * 0.05 + Math.exp(-((u + 0.36) ** 2) / 0.008) * 0.06;
      under.push(sp.at(u, -(sp.width(u, -1) * 1.22 + legs)));
      under2.push(sp.at(u, sp.width(u, 1) * 1.22 + legs));
    }
    ctx.fillStyle = "rgba(70,44,30,0.32)";
    polygon(ctx, [...under, ...under2.reverse()]);
    ctx.fill();
  }
  ctx.restore();

  /* ---- head, from above: the broad crown, ears behind, the muzzle forward ---- */
  const [hx, hy] = sp.at(U1 - 0.035, 0);
  const ha = sp.angle(U1) * 0.35 + pose.headTurn;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ha);
  ctx.scale(1.15, 1.15);
  ctx.translate(Math.sin(ph * 2) * 0.004, 0);

  // ears, laid back behind the crown: fur-coloured, dark only along the back edge
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-0.03, s * 0.082);
    ctx.rotate(s * 0.55);
    ctx.fillStyle = tcss(FUR_DEEP);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.02, 0.026, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tcss(INK, 0.75);
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.018, 0.024, 0, Math.PI * 0.75, Math.PI * 1.35);
    ctx.stroke();
    ctx.restore();
  }
  // cheek ruffs: pale fur fanning out from the sides of the face
  for (const s of [-1, 1]) {
    const ruff: Array<[number, number]> = [
      [0.0, s * 0.096],
      [0.03, s * 0.13],
      [0.055, s * 0.12],
      [0.075, s * 0.146],
      [0.1, s * 0.13],
      [0.125, s * 0.138],
      [0.15, s * 0.11],
      [0.17, s * 0.08],
      [0.1, s * 0.09],
    ];
    ctx.fillStyle = tcss([238, 224, 204]);
    polygon(ctx, ruff);
    ctx.fill();
    ctx.strokeStyle = tcss(INK, 0.85);
    ctx.lineWidth = 0.006;
    for (const [x0, y0, x1, y1] of [
      [0.06, 0.1, 0.03, 0.125],
      [0.1, 0.1, 0.075, 0.135],
      [0.13, 0.096, 0.115, 0.125],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x0, s * y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 0.008, (s * (y0 + y1)) / 2, x1, s * y1);
      ctx.stroke();
    }
  }
  // the crown and muzzle
  const half: Array<[number, number]> = [
    [-0.05, 0],
    [-0.045, 0.07],
    [0.0, 0.104],
    [0.06, 0.118],
    [0.11, 0.108],
    [0.15, 0.088],
    [0.19, 0.06],
    [0.218, 0.034],
    [0.232, 0.012],
    [0.236, 0],
  ];
  const headPts: Array<[number, number]> = [
    ...half.map(([x, y]) => [x, -y] as [number, number]),
    ...half.slice(0, -1).reverse(),
  ];
  const head = pathOf(headPts);
  {
    const g = ctx.createRadialGradient(0.06 + lx * 0.02, ly * 0.025, 0, 0.08, 0, 0.15);
    g.addColorStop(0, tcss([246, 166, 80]));
    g.addColorStop(0.55, tcss(FUR));
    g.addColorStop(1, tcss(FUR_DEEP));
    ctx.fillStyle = g;
    ctx.fill(head);
  }
  ctx.save();
  ctx.clip(head);
  // forehead stripes, sweeping back and out from the middle of the brow
  ctx.strokeStyle = tcss(INK, 0.9);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const x = 0.115 - k * 0.03;
      ctx.lineWidth = 0.004 + k * 0.0012;
      ctx.beginPath();
      ctx.moveTo(x, s * (0.012 + k * 0.002));
      ctx.quadraticCurveTo(x - 0.004, s * (0.045 + k * 0.004), x - 0.03, s * (0.07 + k * 0.006));
      ctx.stroke();
    }
    // the dark line back from each eye
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(0.122, s * 0.078);
    ctx.quadraticCurveTo(0.1, s * 0.09, 0.075, s * 0.096);
    ctx.stroke();
  }
  ctx.lineWidth = 0.005;
  for (const [x0, x1, y] of [
    [0.02, 0.09, 0.006],
    [0.02, 0.09, -0.006],
    [0.1, 0.135, 0],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y * 0.5);
    ctx.stroke();
  }
  // the long bridge of the nose catches the light
  ctx.fillStyle = tcss([248, 178, 96], 0.7);
  ctx.beginPath();
  ctx.ellipse(0.19, 0, 0.046, 0.022, 0, 0, Math.PI * 2);
  ctx.fill();
  // brows: pale fur over each eye
  ctx.fillStyle = tcss(CREAM, 0.85);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0.124, s * 0.062, 0.016, 0.008, -s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // eyes, seen from above: only a hooded amber slit at the side of the head
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(0.142, s * 0.074);
    ctx.rotate(-s * 0.55);
    ctx.fillStyle = tcss(INK);
    ctx.beginPath();
    ctx.moveTo(-0.017, 0);
    ctx.quadraticCurveTo(0, -s * 0.007, 0.014, 0);
    ctx.quadraticCurveTo(0, s * 0.005, -0.017, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(222,170,60,0.95)";
    ctx.beginPath();
    ctx.moveTo(-0.01, s * 0.0005);
    ctx.quadraticCurveTo(0, s * 0.0035, 0.009, s * 0.0005);
    ctx.quadraticCurveTo(0, -s * 0.0012, -0.01, s * 0.0005);
    ctx.fill();
    ctx.restore();
  }
  // whisker pads at the sides of the muzzle, whiskers, the tip of the nose
  for (const s of [-1, 1]) {
    ctx.fillStyle = tcss(CREAM, 0.95);
    ctx.beginPath();
    ctx.ellipse(0.206, s * 0.034, 0.022, 0.015, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(250,248,240,0.55)";
    ctx.lineWidth = 0.0022;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0.205, s * (0.04 + i * 0.003));
      ctx.quadraticCurveTo(0.19, s * (0.08 + i * 0.012), 0.15 - i * 0.012, s * (0.12 + i * 0.016));
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(140,76,72,1)";
  ctx.beginPath();
  ctx.moveTo(0.219, -0.012);
  ctx.quadraticCurveTo(0.23, -0.011, 0.238, 0);
  ctx.quadraticCurveTo(0.23, 0.011, 0.219, 0.012);
  ctx.quadraticCurveTo(0.214, 0, 0.219, -0.012);
  ctx.fill();
  ctx.restore();
}
