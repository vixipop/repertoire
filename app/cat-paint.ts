/**
 * A white fluffy cat, painted on a 2D canvas each frame from a simple rig:
 * haunch and chest, head, four legs, and a tail whose curve travels from
 * base to tip so it sways the way a cat's does. Poses for lounging (a loaf),
 * sitting, crouching to pounce, galloping and leaping blend into each other.
 *
 * Cat space is in centimetres: x forward (the way the cat faces), y up, the
 * ground at y = 0. The light comes from the right of the picture whichever
 * way the cat faces.
 */

type P = [number, number];
type Leg = { root: P; knee: P; paw: P; w: number };
export type CatPose = {
  hip: P;
  hipR: number;
  chest: P;
  chestR: number;
  head: P;
  headR: number;
  /** the head's tilt: positive lifts the nose */
  tilt: number;
  /** ears: 0 relaxed, 1 pricked forward */
  ears: number;
  /** far back, far front, near back, near front */
  legs: [Leg, Leg, Leg, Leg];
  tail: { base: P; dir: number; curl: number; sway: number; speed: number; ground: number };
  /** whole-body tilt, radians, about the middle of the body (leaps) */
  pitch: number;
  blink: number;
};

const lp = (a: P, b: P, k: number): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const ln = (a: number, b: number, k: number) => a + (b - a) * k;

export function lerpPose(a: CatPose, b: CatPose, k: number): CatPose {
  return {
    hip: lp(a.hip, b.hip, k),
    hipR: ln(a.hipR, b.hipR, k),
    chest: lp(a.chest, b.chest, k),
    chestR: ln(a.chestR, b.chestR, k),
    head: lp(a.head, b.head, k),
    headR: ln(a.headR, b.headR, k),
    tilt: ln(a.tilt, b.tilt, k),
    ears: ln(a.ears, b.ears, k),
    legs: a.legs.map((l, i) => ({
      root: lp(l.root, b.legs[i].root, k),
      knee: lp(l.knee, b.legs[i].knee, k),
      paw: lp(l.paw, b.legs[i].paw, k),
      w: ln(l.w, b.legs[i].w, k),
    })) as CatPose["legs"],
    tail: {
      base: lp(a.tail.base, b.tail.base, k),
      dir: ln(a.tail.dir, b.tail.dir, k),
      curl: ln(a.tail.curl, b.tail.curl, k),
      sway: ln(a.tail.sway, b.tail.sway, k),
      speed: ln(a.tail.speed, b.tail.speed, k),
      ground: ln(a.tail.ground, b.tail.ground, k),
    },
    pitch: ln(a.pitch, b.pitch, k),
    blink: ln(a.blink, b.blink, k),
  };
}

const leg = (root: P, knee: P, paw: P, w: number): Leg => ({ root, knee, paw, w });

/** a slow blink now and then */
const blinkAt = (t: number) => {
  const c = t % 4.7;
  return c < 0.16 ? Math.sin((c / 0.16) * Math.PI) : 0;
};

/** curled up in a loaf, head up, tail wrapped round and its tip flicking */
export function poseLounge(t: number): CatPose {
  const breathe = Math.sin(t * 1.4) * 0.35;
  const look = Math.sin(t * 0.23) * 0.08;
  return {
    hip: [-9, 11 + breathe * 0.5],
    hipR: 11.5,
    chest: [7, 9.5 + breathe],
    chestR: 9.2,
    head: [17 + look * 4, 19 + breathe * 0.6],
    headR: 8.4,
    tilt: look,
    ears: 0.3,
    legs: [
      leg([-12, 8], [-5, 4], [1, 2], 4),
      leg([9, 8], [14, 3], [20, 1.8], 3.4),
      leg([-13, 7], [-6, 3], [0, 1.6], 4.3),
      leg([10, 7], [15, 2.6], [21.5, 1.7], 3.6),
    ],
    tail: { base: [-19, 5], dir: Math.PI + 0.15, curl: 2.2, sway: 0.28, speed: 1.3, ground: 1 },
    pitch: 0,
    blink: blinkAt(t),
  };
}

/** sitting up, front paws together, tail round its feet, looking about */
export function poseSit(t: number, look = 0): CatPose {
  const breathe = Math.sin(t * 1.5) * 0.3;
  return {
    hip: [-5, 11],
    hipR: 12.5,
    chest: [4, 23 + breathe],
    chestR: 8.8,
    head: [7 + look * 1.5, 35 + breathe],
    headR: 8.4,
    tilt: 0.05 + look * 0.15,
    ears: 0.5 + look * 0.3,
    legs: [
      leg([-7, 9], [-1, 5], [5, 1.6], 4.5),
      leg([5, 19], [6, 10], [6.5, 1.5], 3.2),
      leg([-8, 8], [-2, 4], [4, 1.5], 4.8),
      leg([6, 18], [7.5, 9], [8.5, 1.5], 3.4),
    ],
    tail: { base: [-16, 4], dir: Math.PI + 0.35, curl: 2.6, sway: 0.34, speed: 1.1, ground: 1 },
    pitch: 0,
    blink: blinkAt(t + 1.3),
  };
}

/** low and coiled, haunches wiggling, eyes on the prize */
export function poseCrouch(t: number): CatPose {
  const wiggle = Math.sin(t * 13) * 1.2;
  return {
    hip: [-12, 13 + wiggle * 0.5],
    hipR: 9.6,
    chest: [10, 9],
    chestR: 8.6,
    head: [22, 13],
    headR: 8,
    tilt: -0.1,
    ears: 1,
    legs: [
      leg([-12, 11], [-6, 6], [-3, 1.5], 4.2),
      leg([10, 7], [15, 4], [19, 1.5], 3.3),
      leg([-13, 10], [-7, 5], [-4, 1.5], 4.4),
      leg([11, 6], [16, 3.5], [20, 1.5], 3.5),
    ],
    tail: { base: [-20, 11], dir: Math.PI - 0.1, curl: 0.3, sway: 0.5, speed: 5, ground: 0 },
    pitch: 0,
    blink: 0,
  };
}

/** a paw's path through one stride: planted and sweeping back, then lifted and swung forward */
function stride(phase: number, reach: number, lift: number): P {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.42) {
    const k = p / 0.42;
    return [reach * (1 - 2 * k), 0];
  }
  const k = (p - 0.42) / 0.58;
  const e = 0.5 - 0.5 * Math.cos(k * Math.PI);
  return [reach * (-1 + 2 * e), Math.sin(k * Math.PI) * lift];
}

/** a leg from root to paw, the joint bending forward (back legs) or back (front legs) */
function bentLeg(root: P, paw: P, length: number, kneeForward: boolean, w: number): Leg {
  const dx = paw[0] - root[0];
  const dy = paw[1] - root[1];
  const d = Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, length * length - d * d)) / 2;
  const nx = -dy / (d || 1);
  const ny = dx / (d || 1);
  const s = kneeForward ? -1 : 1;
  return leg(root, [root[0] + dx / 2 + nx * bend * s, root[1] + dy / 2 + ny * bend * s], paw, w);
}

/** the gallop (amp 1) or a trot (amp ~0.45): the spine flexing and stretching, legs in turn */
export function poseRun(phase: number, amp = 1): CatPose {
  const a = phase * Math.PI * 2;
  const ext = Math.sin(a) * amp;
  const bob = Math.cos(a) * 1.6 * amp;
  const hip: P = [-14 - 3.5 * ext, 17 + bob];
  const chest: P = [13 + 2.5 * ext, 18.5 + bob * 0.6];
  const reachF = 9 + 5 * amp;
  const reachB = 8 + 5 * amp;
  const liftF = 5 + 6 * amp;
  const liftB = 4 + 6 * amp;
  const paw = (base: P, ph: number, reach: number, lift: number): P => {
    const [sx, sy] = stride(ph, reach, lift);
    return [base[0] + sx, 1.5 + sy];
  };
  const fBase: P = [chest[0] + 3, 0];
  const bBase: P = [hip[0] + 4, 0];
  return {
    hip,
    hipR: 9,
    chest,
    chestR: 8.3,
    head: [chest[0] + 11, chest[1] + 6 + Math.sin(a + 1) * 1.2 * amp],
    headR: 8,
    tilt: 0.08 * Math.sin(a + 0.5) * amp,
    ears: 0.8,
    legs: [
      bentLeg([hip[0], hip[1] - 3], paw(bBase, phase + 0.58, reachB, liftB), 21, true, 4.2),
      bentLeg([chest[0], chest[1] - 4], paw(fBase, phase + 0.08, reachF, liftF), 19, false, 3.3),
      bentLeg([hip[0] - 1, hip[1] - 4], paw(bBase, phase + 0.5, reachB, liftB), 21, true, 4.5),
      bentLeg([chest[0] + 1, chest[1] - 5], paw(fBase, phase, reachF, liftF), 19, false, 3.5),
    ],
    tail: { base: [hip[0] - 9, hip[1] + 2], dir: Math.PI - 0.35, curl: 0.45, sway: 0.35, speed: 7, ground: 0 },
    pitch: 0,
    blink: 0,
  };
}

/** the leap: stretched out full length, nose up as it springs, down as it lands */
export function poseLeap(k: number): CatPose {
  const stretched = poseRun(0.25, 1);
  return {
    ...stretched,
    legs: [
      leg([-15, 15], [-24, 12], [-33, 9], 4.2),
      leg([15, 15], [24, 17], [32, 18], 3.3),
      leg([-16, 14], [-25, 10], [-34, 7], 4.5),
      leg([16, 14], [25, 15], [33, 15], 3.5),
    ],
    tail: { ...stretched.tail, dir: Math.PI - 0.2, curl: 0.2, sway: 0.15 },
    pitch: 0.45 * (1 - 2 * k),
  };
}

// ---- painting ------------------------------------------------------------------

export type CatLook = { fur: number; facing: number };

/** stable pseudo-random numbers, so the fur doesn't shimmer from frame to frame */
const h1 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Circle = [number, number, number]; // x, y, r (cat space)

/** the outline round a group of circles (their convex hull), as a smooth polygon */
function hullOf(cs: Circle[]): P[] {
  const pts: P[] = [];
  for (const [x, y, r] of cs) for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// offscreen layers, kept per output canvas
const layers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

export function paintCat(g: CanvasRenderingContext2D, pose: CatPose, look: CatLook, t: number) {
  const W = g.canvas.width;
  const H = g.canvas.height;
  let off = layers.get(g.canvas);
  if (!off || off.width !== W || off.height !== H) {
    off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    layers.set(g.canvas, off);
  }
  const o = off.getContext("2d")!;
  const S = W / 96; // pixels per centimetre
  const gx = W / 2;
  const gy = H - 10 * S;
  const f = look.facing < 0 ? -1 : 1;
  const fur = look.fur;
  const fluff = 0.8 + fur * 1.8; // extra roundness the fur adds, cm

  // a leap pitches the whole body about its middle
  const mid: P = [(pose.hip[0] + pose.chest[0]) / 2, (pose.hip[1] + pose.chest[1]) / 2];
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  const rot = (p: P): P => {
    if (!pose.pitch) return p;
    const dx = p[0] - mid[0];
    const dy = p[1] - mid[1];
    return [mid[0] + dx * cp - dy * sp, mid[1] + dx * sp + dy * cp];
  };
  const X = (p: P) => gx + f * rot(p)[0] * S;
  const Y = (p: P) => gy - rot(p)[1] * S;
  const path = (ctx: CanvasRenderingContext2D, poly: P[]) => {
    const n = poly.length;
    ctx.beginPath();
    const m = (i: number): P => [(X(poly[i % n]) + X(poly[(i + 1) % n])) / 2, (Y(poly[i % n]) + Y(poly[(i + 1) % n])) / 2];
    const s0 = m(n - 1);
    ctx.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) {
      const e = m(i);
      ctx.quadraticCurveTo(X(poly[i]), Y(poly[i]), e[0], e[1]);
    }
    ctx.closePath();
  };

  // ---- the white shape, drawn flat into its own layer ----
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, W, H);
  o.lineCap = "round";
  o.lineJoin = "round";
  const WHITE = "#fbfaf7";
  const FAR = "#dcdbe6";

  // tail: a plume, slim at the root, full through the middle, round at the tip
  const tl = pose.tail;
  const N = 18;
  const TL = 27;
  const tail: P[] = [tl.base];
  let a = tl.dir;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    // the curve travels from root to tip, so it sways rather than swings
    a += (tl.curl / N) * (1 + s) * 0.66 + tl.sway * Math.sin(t * tl.speed - s * 2.6) * s * 0.42 + tl.sway * 0.4 * Math.sin(t * tl.speed * 0.37 + 1.7 - s * 1.5) * s * 0.3;
    const prev = tail[i - 1];
    const nx = prev[0] + Math.cos(a) * (TL / N);
    let ny = prev[1] + Math.sin(a) * (TL / N);
    if (tl.ground > 0) {
      // lying on the grass, only the tip lifts
      const floor = 2.2 + (s > 0.72 ? (s - 0.72) * 16 * (0.55 + 0.45 * Math.sin(t * tl.speed * 1.3)) : 0);
      ny = ln(ny, floor, tl.ground);
    }
    tail.push([nx, ny]);
  }
  const tailR = (s: number) => 1.6 + 3.4 * Math.sin(Math.PI * (0.12 + 0.8 * s)) + fur * 1.6;
  o.fillStyle = WHITE;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    o.beginPath();
    o.arc(X(tail[i]), Y(tail[i]), tailR(s) * S, 0, Math.PI * 2);
    o.fill();
  }

  // legs: thick at the top, tapering, small oval paws
  const limb = (l: Leg, col: string) => {
    o.strokeStyle = col;
    o.fillStyle = col;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const k0 = i / steps;
      const k1 = (i + 1) / steps;
      const q = (k: number): P => {
        const u = 1 - k;
        return [u * u * l.root[0] + 2 * u * k * l.knee[0] + k * k * l.paw[0], u * u * l.root[1] + 2 * u * k * l.knee[1] + k * k * l.paw[1]];
      };
      const A = q(k0);
      const B = q(k1);
      o.lineWidth = (l.w * (1.25 - 0.45 * k0) + fluff * 0.35) * S;
      o.beginPath();
      o.moveTo(X(A), Y(A));
      o.lineTo(X(B), Y(B));
      o.stroke();
    }
    o.beginPath();
    o.ellipse(X(l.paw) + f * 0.8 * S, Y(l.paw), (l.w * 0.75 + 0.5) * S, l.w * 0.48 * S, 0, 0, Math.PI * 2);
    o.fill();
  };
  limb(pose.legs[0], FAR);
  limb(pose.legs[1], FAR);

  // the body: one soft bean from haunch to chest, the belly hanging a little
  const bodyMid: P = [(pose.hip[0] + pose.chest[0]) / 2, (pose.hip[1] + pose.chest[1]) / 2 - 1.2];
  const bodyCircles: Circle[] = [
    [pose.hip[0], pose.hip[1], pose.hipR + fluff * 0.5],
    [bodyMid[0], bodyMid[1], (pose.hipR + pose.chestR) * 0.47 + fluff * 0.5],
    [pose.chest[0], pose.chest[1], pose.chestR + fluff * 0.5],
    // the curve of the back, so it rounds over rather than running flat
    [bodyMid[0] - 2, bodyMid[1] + 3.5, (pose.hipR + pose.chestR) * 0.36 + fluff * 0.5],
  ];
  o.fillStyle = WHITE;
  path(o, hullOf(bodyCircles));
  o.fill();

  limb(pose.legs[2], WHITE);
  limb(pose.legs[3], WHITE);

  // the neck ruff joins head to chest; the head is round with full cheeks
  const hp = pose.head;
  const hr = pose.headR;
  const tilt = pose.tilt;
  const H2 = (dx: number, dy: number): P => [hp[0] + dx * Math.cos(tilt) - dy * Math.sin(tilt), hp[1] + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
  const neck: Circle[] = [
    [pose.chest[0] + 1.5, pose.chest[1] + 1, pose.chestR * 0.82 + fluff * 0.5],
    [hp[0] - 1.5, hp[1] - 2, hr * 0.9 + fluff * 0.4],
  ];
  path(o, hullOf(neck));
  o.fill();
  // ears, far one first
  const ear = (side: number, col: string) => {
    const baseA = H2(-2.6 + side * 2.4, hr * 0.55);
    const baseB = H2(2.2 + side * 2.4, hr * 0.72);
    const prick = 0.75 + pose.ears * 0.35;
    const tip = H2(-0.2 + side * 2.4 + pose.ears * 0.8, hr * 0.7 + 5.4 * prick);
    o.fillStyle = col;
    o.beginPath();
    o.moveTo(X(baseA), Y(baseA));
    o.quadraticCurveTo(X(lp(baseA, tip, 0.55)) - f * 0.5 * S, Y(lp(baseA, tip, 0.55)), X(tip), Y(tip));
    o.quadraticCurveTo(X(lp(baseB, tip, 0.55)) + f * 0.5 * S, Y(lp(baseB, tip, 0.55)), X(baseB), Y(baseB));
    o.closePath();
    o.fill();
    return { baseA, baseB, tip };
  };
  const farEar = ear(-1, FAR);
  const head: Circle[] = [
    [hp[0], hp[1], hr + fluff * 0.35],
    [H2(-0.8, -2.6)[0], H2(-0.8, -2.6)[1], hr * 0.82 + fluff * 0.45],
    [H2(2.6, -2.4)[0], H2(2.6, -2.4)[1], hr * 0.7 + fluff * 0.35],
  ];
  o.fillStyle = WHITE;
  path(o, hullOf(head));
  o.fill();
  const nearEar = ear(1, WHITE);

  // ---- light it as one soft volume: warm and bright up and to the right,
  // cool lavender underneath and on the far side ----
  o.globalCompositeOperation = "source-atop";
  const top = Math.min(Y(pose.head), Y(pose.hip)) - hr * S * 1.5;
  const lit = o.createLinearGradient(W * 0.75, top, W * 0.3, gy);
  lit.addColorStop(0, "rgba(255,248,232,0.9)");
  lit.addColorStop(0.45, "rgba(250,249,247,0)");
  lit.addColorStop(1, "rgba(184,184,210,0.55)");
  o.fillStyle = lit;
  o.fillRect(0, 0, W, H);
  // the underside, nearest the grass, deepest
  const under = o.createLinearGradient(0, gy - 6 * S, 0, gy);
  under.addColorStop(0, "rgba(160,162,190,0)");
  under.addColorStop(1, "rgba(160,162,190,0.35)");
  o.fillStyle = under;
  o.fillRect(0, 0, W, H);
  o.globalCompositeOperation = "source-over";

  // ---- onto the picture: shade on the grass, a soft halo of fur, the cat ----
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  {
    const xs = [X(pose.hip), X(pose.chest), X(hp)];
    const x0 = Math.min(...xs) - 8 * S;
    const x1 = Math.max(...xs) + 6 * S;
    const lift = Math.max(0, Math.min(pose.hip[1], pose.chest[1]) - 14);
    const sx = (x0 + x1) / 2 - 3 * S;
    const rw = (x1 - x0) / 2;
    const al = 0.34 * Math.max(0.2, 1 - lift / 25);
    g.save();
    g.translate(sx, gy);
    g.scale(1, 0.15);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rw);
    gr.addColorStop(0, `rgba(20,38,24,${al})`);
    gr.addColorStop(1, "rgba(20,38,24,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rw, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // fluff: the cat blurred a little, under itself, so every edge is soft
  const halo = (0.6 + fur * 2.4) * S;
  if ("filter" in g) {
    g.filter = `blur(${halo.toFixed(1)}px)`;
    g.globalAlpha = 0.9;
    g.drawImage(off, 0, 0);
    g.filter = "none";
    g.globalAlpha = 1;
  }
  g.drawImage(off, 0, 0);

  // wisps of fur along the outline, lying the way fur lies: back along the
  // body, down over the chest, out along the tail
  g.lineCap = "round";
  const wisps = (poly: P[], dirOf: (p: P) => number, seed: number, count: number) => {
    const n = poly.length;
    for (let i = 0; i < count; i++) {
      const p = poly[Math.floor(h1(seed + i) * n)];
      const ang = dirOf(p) + (h1(seed + i * 3.3) - 0.5) * 0.7;
      const len = (0.8 + fur * 2.2) * (0.5 + h1(seed + i * 5.1)) * S;
      const x = X(p);
      const y = Y(p);
      const ex = x + Math.cos(ang) * len * f;
      const ey = y - Math.sin(ang) * len;
      const lightness = (ex - x) * f * 0 + (y < gy - 14 * S ? 1 : 0);
      g.strokeStyle = lightness ? `rgba(255,252,246,${0.35 + 0.3 * h1(seed + i)})` : `rgba(206,206,224,${0.3 + 0.3 * h1(seed + i)})`;
      g.lineWidth = (0.25 + 0.25 * h1(seed + i * 7.7)) * S;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang + 0.3) * len * 0.6 * f, y - Math.sin(ang + 0.3) * len * 0.6, ex, ey);
      g.stroke();
    }
  };
  const nW = Math.round(30 + fur * 90);
  wisps(hullOf(bodyCircles), (p) => Math.atan2(p[1] - bodyMid[1], p[0] - bodyMid[0]) * 0.4 + Math.PI * 0.85, 11, nW);
  wisps(hullOf(neck), () => -Math.PI / 2 - 0.3, 23, Math.round(nW * 0.4));
  wisps(hullOf(head), (p) => Math.atan2(p[1] - hp[1], p[0] - hp[0]), 37, Math.round(nW * 0.35));
  for (let i = 2; i < N; i += 2) {
    const s = i / N;
    const along = Math.atan2(tail[i + 1][1] - tail[i - 1][1], tail[i + 1][0] - tail[i - 1][0]);
    const r = tailR(s);
    for (let k = 0; k < 3 + fur * 5; k++) {
      const side = h1(i * 13 + k) < 0.5 ? 1 : -1;
      const p: P = [tail[i][0] - Math.sin(along) * r * side, tail[i][1] + Math.cos(along) * r * side];
      wisps([p], () => along + side * 0.5, 50 + i * 7 + k, 1);
    }
  }

  // ---- the face: pink inner ears, almond eyes, a small pink nose ----
  const innerEar = (e: { baseA: P; baseB: P; tip: P }, alpha: number) => {
    const inA = lp(e.baseA, e.tip, 0.2);
    const inB = lp(e.baseB, e.tip, 0.2);
    const inT = lp(lp(e.baseA, e.baseB, 0.5), e.tip, 0.8);
    g.fillStyle = `rgba(238,172,182,${alpha})`;
    g.beginPath();
    g.moveTo(X(inA), Y(inA));
    g.quadraticCurveTo(X(lp(inA, inT, 0.5)), Y(lp(inA, inT, 0.5)), X(inT), Y(inT));
    g.lineTo(X(inB), Y(inB));
    g.closePath();
    g.fill();
  };
  innerEar(farEar, 0.45);
  innerEar(nearEar, 0.85);
  const eye = (dx: number, dy: number, r: number) => {
    const e = H2(dx, dy);
    const open = 1 - pose.blink;
    const ex = X(e);
    const ey = Y(e);
    g.save();
    g.translate(ex, ey);
    g.rotate(-f * 0.25);
    // almond: pointed at both corners
    g.fillStyle = "rgba(150,186,170,1)";
    g.beginPath();
    g.moveTo(-r * S, 0);
    g.quadraticCurveTo(0, -r * 0.75 * open * S, r * S, 0);
    g.quadraticCurveTo(0, r * 0.75 * open * S, -r * S, 0);
    g.fill();
    if (open > 0.3) {
      g.fillStyle = "rgba(30,36,34,0.9)";
      g.beginPath();
      g.ellipse(f * 0.1 * r * S, 0, r * 0.18 * S, r * 0.5 * open * S, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "rgba(120,110,120,0.7)";
    g.lineWidth = 0.22 * S;
    g.beginPath();
    g.moveTo(-r * S, 0);
    g.quadraticCurveTo(0, -r * 0.75 * open * S, r * S, 0);
    g.stroke();
    g.restore();
  };
  eye(hr * 0.5, 0.9, 1.05);
  eye(hr * -0.05, 1.1, 0.85);
  const nose = H2(hr * 0.92, -1.1);
  g.fillStyle = "rgba(232,150,160,1)";
  g.beginPath();
  g.ellipse(X(nose), Y(nose), 0.75 * S, 0.5 * S, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 0.15 * S;
  for (let i = -1; i <= 1; i++) {
    const w0 = H2(hr * 0.85, -1.9 + i * 0.35);
    const w1 = H2(hr * 0.85 + 5.5, -1.9 + i * 1.2 - 0.6);
    g.beginPath();
    g.moveTo(X(w0), Y(w0));
    g.lineTo(X(w1), Y(w1));
    g.stroke();
  }
}
