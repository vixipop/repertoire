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
  const wiggle = Math.sin(t * 7) * 0.9;
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
      leg([-12, 11], [-17, 3], [-7, 1.5], 4.2),
      leg([10, 7], [12, 3], [19, 1.5], 3.3),
      leg([-13, 10], [-18, 2.5], [-8, 1.5], 4.4),
      leg([11, 6], [13, 2.5], [20, 1.5], 3.5),
    ],
    tail: { base: [-20, 11], dir: Math.PI - 0.1, curl: 0.3, sway: 0.22, speed: 2.5, ground: 0 },
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
  const hip: P = [-11 - 3 * ext, 17 + bob];
  const chest: P = [10 + 2.5 * ext, 18.5 + bob * 0.6];
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
      bentLeg([hip[0], hip[1] - 3], paw(bBase, phase + 0.58, reachB, liftB), 21, false, 4.2),
      bentLeg([chest[0], chest[1] - 4], paw(fBase, phase + 0.08, reachF, liftF), 19, true, 3.3),
      bentLeg([hip[0] - 1, hip[1] - 4], paw(bBase, phase + 0.5, reachB, liftB), 21, false, 4.5),
      bentLeg([chest[0] + 1, chest[1] - 5], paw(fBase, phase, reachF, liftF), 19, true, 3.5),
    ],
    tail: { base: [hip[0] - 9, hip[1] + 2], dir: Math.PI - 0.35, curl: 0.45, sway: 0.18, speed: 3, ground: 0 },
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
  return hullPts(pts);
}
function hullPts(pts: P[]): P[] {
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
  const S = H / 60; // pixels per centimetre: the canvas is 60 cm tall, as wide as it needs
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
  lit.addColorStop(1, "rgba(170,170,204,0.8)");
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
  softFur(g, off, fur, S);

  // the face in profile: one dot of an eye, a small pink nose
  const innerEar = (e: { baseA: P; baseB: P; tip: P }) => {
    const inA = lp(e.baseA, e.tip, 0.22);
    const inB = lp(e.baseB, e.tip, 0.22);
    const inT = lp(lp(e.baseA, e.baseB, 0.5), e.tip, 0.78);
    g.fillStyle = "rgba(240,176,186,0.8)";
    g.beginPath();
    g.moveTo(X(inA), Y(inA));
    g.lineTo(X(inT), Y(inT));
    g.lineTo(X(inB), Y(inB));
    g.closePath();
    g.fill();
  };
  void farEar;
  innerEar(nearEar);
  const eye = H2(hr * 0.5, 1.2);
  g.fillStyle = "rgba(40,42,44,0.95)";
  g.beginPath();
  g.ellipse(X(eye), Y(eye), 0.75 * S, (0.75 * (1 - pose.blink) + 0.12) * S, 0, 0, Math.PI * 2);
  g.fill();
  const nose = H2(hr * 0.95, -1.0);
  g.fillStyle = "rgba(236,150,162,1)";
  g.beginPath();
  g.arc(X(nose), Y(nose), 0.6 * S, 0, Math.PI * 2);
  g.fill();
}

/** The fur: the flat white shape laid over two soft, blurred copies of itself,
 * so its edge is a dense, even fluff with no gaps in it. */
function softFur(g: CanvasRenderingContext2D, off: HTMLCanvasElement, fur: number, S: number) {
  if ("filter" in g) {
    g.globalAlpha = 0.4 + fur * 0.3;
    g.filter = `blur(${((0.6 + fur * 1.8) * S).toFixed(1)}px)`;
    g.drawImage(off, 0, 0);
    g.globalAlpha = 0.85;
    g.filter = `blur(${((0.3 + fur * 0.7) * S).toFixed(1)}px)`;
    g.drawImage(off, 0, 0);
    g.filter = "none";
    g.globalAlpha = 1;
  }
  g.drawImage(off, 0, 0);
}

// ---- seen from behind -------------------------------------------------------------

/** The cat with its back to us, as it is when it's just sitting about:
 * sit 0 is lying down (a loaf from behind), 1 sitting up. turn swings the head
 * to look left or right, enough to show a cheek, an eye and its nose. */
export type BackPose = { sit: number; turn: number; t: number; ears: number; rest?: number };

export function paintCatBack(g: CanvasRenderingContext2D, pose: BackPose, look: CatLook) {
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
  const S = H / 60;
  const gx = W / 2;
  const gy = H - 10 * S;
  const X = (x: number) => gx + x * S;
  const Y = (y: number) => gy - y * S;
  const fur = look.fur;
  const fl = 0.8 + fur * 1.8;
  const k = pose.sit;
  const t = pose.t;
  const rest = pose.rest ?? 0;
  // asleep, it breathes slower and deeper
  const breathe = Math.sin(t * (1.4 - rest * 0.7)) * (0.35 + rest * 0.15);
  const turn = pose.turn;

  // bottom: wide and round on the grass; back: narrower above; head on top
  const seat = { x: 0, y: ln(10, 11, k), rx: ln(16, 13.5, k) + fl * 0.5, ry: ln(10, 11.5, k) + fl * 0.5 };
  const back = { x: 0, y: ln(12, 23, k) + breathe, rx: ln(12, 10, k) + fl * 0.5, ry: ln(7, 11, k) + fl * 0.5 };
  const ruff = { x: turn * 0.8, y: ln(17, 30.5, k) + breathe, rx: ln(8.5, 8.6, k) + fl * 0.5, ry: 6 + fl * 0.4 };
  // dozing, the head sinks down onto its paws
  const head = { x: turn * 3, y: ln(21.5, 36.5, k) + breathe - rest * 5, r: 8.3 + fl * 0.35 };

  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, W, H);
  const WHITE = "#fbfaf7";

  // the tail, lying on the grass round to the right, its tip lifting and swaying
  const N = 18;
  const tail: P[] = [[ln(3, 4, k), 2.5]];
  let a = -0.1;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    // the sitting sway as it was; only sleep calms it
    a += 0.11 + 0.32 * (1 - rest * 0.8) * Math.sin(t * 1.2 - s * 2.4) * s * 0.35;
    const prev = tail[i - 1];
    // it curls round toward us, so it rises a little on the page as it goes
    const lift = s > 0.7 ? (s - 0.7) * 10 * (1 - rest * 0.7) * (0.6 + 0.4 * Math.sin(t * 1.6)) : 0;
    tail.push([prev[0] + Math.cos(a) * 1.55, 2.4 + Math.sin(a) * 0.4 * s + lift]);
  }
  o.fillStyle = WHITE;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const r = 1.8 + 3.2 * Math.sin(Math.PI * (0.12 + 0.8 * s)) + fur * 1.5;
    o.beginPath();
    o.arc(X(tail[i][0]), Y(tail[i][1]), r * S, 0, Math.PI * 2);
    o.fill();
  }

  const oval = (c: { x: number; y: number; rx: number; ry: number }) => {
    o.beginPath();
    o.ellipse(X(c.x), Y(c.y), c.rx * S, c.ry * S, 0, 0, Math.PI * 2);
    o.fill();
  };
  // seat, back and ruff as one smooth pear, no waists between them
  {
    const pts: P[] = [];
    for (const c of [seat, back, ruff])
      for (let i = 0; i < 48; i++) {
        const an = (i / 48) * Math.PI * 2;
        pts.push([c.x + Math.cos(an) * c.rx, c.y + Math.sin(an) * c.ry]);
      }
    const poly = hullPts(pts);
    const n = poly.length;
    o.beginPath();
    const m = (i: number): P => [(X(poly[i % n][0]) + X(poly[(i + 1) % n][0])) / 2, (Y(poly[i % n][1]) + Y(poly[(i + 1) % n][1])) / 2];
    const s0 = m(n - 1);
    o.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) {
      const e = m(i);
      o.quadraticCurveTo(X(poly[i][0]), Y(poly[i][1]), e[0], e[1]);
    }
    o.closePath();
    o.fill();
  }
  void oval;
  // ears: from behind, their white backs, tilted the way the head is turned
  const ear = (side: number) => {
    const bx = head.x + side * 4.6 - turn * 1.2;
    const by = head.y + 4.5;
    const tip: P = [bx + side * 1.6 + turn * 0.8, by + 6 + pose.ears * 0.8];
    o.beginPath();
    o.moveTo(X(bx - 2.8), Y(by - 0.5));
    o.quadraticCurveTo(X(bx - 1.2 + side * 0.5), Y(by + 4), X(tip[0]), Y(tip[1]));
    o.quadraticCurveTo(X(bx + 1.8 + side * 0.5), Y(by + 3.5), X(bx + 3), Y(by - 0.5));
    o.closePath();
    o.fill();
  };
  ear(-1);
  ear(1);
  o.beginPath();
  o.arc(X(head.x), Y(head.y), head.r * S, 0, Math.PI * 2);
  o.fill();
  // a cheek showing on the side it's looking to
  if (Math.abs(turn) > 0.05) {
    o.beginPath();
    o.ellipse(X(head.x + turn * 4.5), Y(head.y - 2.2), 5.4 * S, 4.6 * S, 0, 0, Math.PI * 2);
    o.fill();
  }

  // light it as one soft volume: warm up and to the right, lavender below and left
  o.globalCompositeOperation = "source-atop";
  const lit = o.createLinearGradient(X(14), Y(head.y + 8), X(-12), Y(0));
  lit.addColorStop(0, "rgba(255,248,232,0.9)");
  lit.addColorStop(0.45, "rgba(250,249,247,0)");
  lit.addColorStop(1, "rgba(170,170,204,0.8)");
  o.fillStyle = lit;
  o.fillRect(0, 0, W, H);
  // the soft shade where the back meets the seat, and under the head
  const fold = o.createRadialGradient(X(0), Y(back.y - back.ry * 0.7), 0, X(0), Y(back.y - back.ry * 0.7), back.rx * S * 1.2);
  fold.addColorStop(0, "rgba(190,190,214,0)");
  fold.addColorStop(1, "rgba(190,190,214,0)");
  const under = o.createLinearGradient(0, Y(5), 0, Y(0));
  under.addColorStop(0, "rgba(160,162,190,0)");
  under.addColorStop(1, "rgba(160,162,190,0.35)");
  o.fillStyle = under;
  o.fillRect(0, 0, W, H);
  // modelling: the shade the head casts on the ruff, the fold where the
  // haunches swell out from the back, and the light on the crown
  const soft = (x: number, y: number, rx: number, ry: number, col: string, alpha: number) => {
    o.save();
    o.translate(X(x), Y(y));
    o.scale(1, ry / rx);
    const gr2 = o.createRadialGradient(0, 0, 0, 0, 0, rx * S);
    gr2.addColorStop(0, col + alpha + ")");
    gr2.addColorStop(1, col + "0)");
    o.fillStyle = gr2;
    o.beginPath();
    o.arc(0, 0, rx * S, 0, Math.PI * 2);
    o.fill();
    o.restore();
  };
  soft(head.x - 0.5, head.y - head.r * 0.95, head.r * 1.05, head.r * 0.45, "rgba(150,150,190,", 0.55);
  soft(-seat.rx * 0.62, seat.y + seat.ry * 0.25, seat.rx * 0.42, seat.ry * 0.75, "rgba(160,160,198,", 0.45);
  soft(seat.rx * 0.62, seat.y + seat.ry * 0.25, seat.rx * 0.38, seat.ry * 0.7, "rgba(170,170,204,", 0.25);
  soft(0, back.y - back.ry * 0.2, back.rx * 0.18, back.ry * 0.9, "rgba(176,176,208,", 0.3);
  soft(head.x + head.r * 0.35, head.y + head.r * 0.4, head.r * 0.7, head.r * 0.55, "rgba(255,250,236,", 0.85);
  soft(back.rx * 0.45, back.y + back.ry * 0.3, back.rx * 0.5, back.ry * 0.6, "rgba(255,250,236,", 0.6);
  o.globalCompositeOperation = "source-over";

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // its shade on the grass, thrown left by the sun on the right
  {
    const sx = X(-4);
    const rw = 22 * S;
    g.save();
    g.translate(sx, gy);
    g.scale(1, 0.16);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rw);
    gr.addColorStop(0, "rgba(20,38,24,0.34)");
    gr.addColorStop(1, "rgba(20,38,24,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rw, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  softFur(g, off, fur, S);
  // turned far enough, the face shows at the edge of the head: an eye, a nose
  if (Math.abs(turn) > 0.45) {
    const sd = Math.sign(turn);
    const show = Math.min(1, (Math.abs(turn) - 0.45) / 0.4);
    g.globalAlpha = show;
    g.fillStyle = "rgba(40,42,44,0.95)";
    g.beginPath();
    g.arc(X(head.x + sd * 6.2), Y(head.y + 0.6), 0.7 * S, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(236,150,162,1)";
    g.beginPath();
    g.arc(X(head.x + sd * 8.6), Y(head.y - 2.4), 0.55 * S, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  // the inner pink of an ear turned toward the side
  void fold;
}

// ---- a cat in the round ------------------------------------------------------------

/** The sitting or lying cat built from rounded volumes in 3D and seen from
 * any angle, so it can turn on the spot like the solid animal it is.
 * yaw: 0 its back to us, +π/2 side on facing right, −π/2 facing left.
 * head: how far the head is turned on top of that (radians).
 * sit: 0 lying (a loaf), 1 sitting up. rest: 0 awake, 1 asleep. */
// breath: the breathing phase, integrated by the caller so a changing rate never jumps it
export type RoundPose = { yaw: number; head: number; sit: number; rest: number; t: number; breath?: number };

type V3 = [number, number, number];
type Item = { depth: number; draw: () => void };

export function paintCatRound(g: CanvasRenderingContext2D, pose: RoundPose, look: { fur: number }) {
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
  // 66 cm of cat-space tall: headroom for the ears and their fur
  const S = H / 66;
  const gx = W / 2;
  const gy = H - 10 * S;
  const fur = look.fur;
  const fl = 0.8 + fur * 1.8;
  const k = pose.sit;
  const rest = pose.rest;
  const t = pose.t;
  const breathe = Math.sin(pose.breath ?? t * 1.4) * (0.35 + rest * 0.15);

  // cat space: x the way it faces, y up, z its left side; the camera looks along +depth
  const proj = (yaw: number) => {
    const sF = Math.sin(yaw);
    const cF = Math.cos(yaw);
    return (p: V3) => {
      const x = p[0] * sF - p[2] * cF;
      const d = p[0] * cF + p[2] * sF;
      return { x: gx + x * S, y: gy - p[1] * S, d };
    };
  };
  const P = proj(pose.yaw);
  // the head turns about the neck on top of the body's turn
  const neck: V3 = [ln(9, 6, k), ln(14, 30, k), 0];
  const headTurn = (p: V3): V3 => {
    const a = pose.head;
    const dx = p[0] - neck[0];
    const dz = p[2] - neck[2];
    return [neck[0] + dx * Math.cos(a) - dz * Math.sin(a), p[1], neck[2] + dx * Math.sin(a) + dz * Math.cos(a)];
  };
  const PH = (p: V3) => P(headTurn(p));
  const items: Item[] = [];
  // the tail lies out in front of the body, so it's painted after the body's shading, keeping its own white
  const tailDraws: Item[] = [];
  const tailShadows: Array<() => void> = [];

  // an ellipsoid with axes along the cat's own x, y, z, turned by the yaw
  const ell = (c: V3, r: V3, onHead = false, tone = 1) => {
    const yaw = pose.yaw + (onHead ? pose.head : 0);
    const q = onHead ? PH(c) : P(c);
    const rx = Math.hypot(r[0] * Math.sin(yaw), r[2] * Math.cos(yaw)) + fl * 0.45;
    const ry = r[1] + fl * 0.45;
    items.push({
      depth: q.d,
      draw: () => {
        // each volume is rounded by its own light, from up and to the right
        const gr = o.createRadialGradient(q.x + rx * S * 0.3, q.y - ry * S * 0.4, 0, q.x, q.y, Math.max(rx, ry) * S * 1.1);
        // only a gentle rounding, so the volumes melt into one cat rather than read as balls
        gr.addColorStop(0, `rgba(254,252,248,${tone})`);
        gr.addColorStop(0.75, `rgba(246,245,248,${tone})`);
        gr.addColorStop(1, "rgba(226,226,236,1)");
        o.fillStyle = gr;
        o.beginPath();
        o.ellipse(q.x, q.y, rx * S, ry * S, 0, 0, Math.PI * 2);
        o.fill();
      },
    });
  };
  const limb = (a: V3, b: V3, w: number) => {
    const A = P(a);
    const B = P(b);
    items.push({
      depth: (A.d + B.d) / 2,
      draw: () => {
        o.strokeStyle = "rgb(240,239,244)";
        o.lineCap = "round";
        o.lineWidth = (w + fl * 0.3) * S;
        o.beginPath();
        o.moveTo(A.x, A.y);
        o.lineTo(B.x, B.y);
        o.stroke();
      },
    });
  };

  // ---- the volumes, sitting (k = 1) or lying in a loaf (k = 0) ----
  ell([ln(-3, -6, k), ln(10, 11, k), 0], [ln(15, 12, k), ln(10, 11, k), ln(12, 12.5, k)]); // haunches / body
  ell([ln(7, 4, k), ln(10, 22, k) + breathe, 0], [ln(9.5, 8, k), ln(9, 11, k), ln(10, 8.5, k)]); // chest
  ell([ln(11, 6, k), ln(15, 29.5, k) + breathe, 0], [6.5, 6, 7.5]); // the ruff
  // front legs and paws, the hind paws peeking out by the haunches
  for (const side of [-1, 1]) {
    limb([ln(12, 5, k), ln(7, 19, k), side * 3], [ln(19, 8, k), 1.6, side * 3.2], 3.4);
    ell([ln(20, 9, k), 1.5, side * 3.2], [2.6, 1.4, 1.9]);
    ell([ln(-2, 5, k), 1.6, side * ln(9, 7.5, k)], [3.4, 1.5, 2.2]);
  }
  // head: round, full cheeks, a little muzzle, sinking down when asleep
  const hy = ln(19, 35.5, k) + breathe - rest * 5;
  const hx = ln(15, 8, k);
  ell([hx, hy, 0], [7.8, 7.6, 8.2], true);
  for (const side of [-1, 1]) ell([hx + 2.6, hy - 2.4, side * 3.8], [4.6, 4.4, 4.6], true);
  ell([hx + 6, hy - 2.4, 0], [2.2, 2, 2.6], true);
  // ears: triangles standing up from the crown. The tip's rounding is sized
  // by how much it trims (cut, from the corner), not by a fixed radius, so a
  // narrow ear only loses a sliver: the radius that trims cut is cut·tan(half the angle)
  const tipR = (a: { x: number; y: number }, tp: { x: number; y: number }, b: { x: number; y: number }, cut: number) => {
    const ang = Math.abs(Math.atan2(a.y - tp.y, a.x - tp.x) - Math.atan2(b.y - tp.y, b.x - tp.x));
    const th = ang > Math.PI ? Math.PI * 2 - ang : ang;
    return cut * Math.tan(th / 2);
  };
  const earTilt = rest * 0.6;
  for (const side of [-1, 1]) {
    // the base runs front to back as well as across, so turned away the ear
    // still shows as an ear rather than thinning to a needle
    const base1: V3 = [hx - 3.2, hy + 5.4, side * 2.2];
    const base2: V3 = [hx + 2.4, hy + 4.9, side * 6.9];
    const tip: V3 = [hx + 0.6 + earTilt * 2, hy + 14.6 - earTilt * 3.5, side * 5.7];
    const A = PH(base1);
    const B = PH(base2);
    const T = PH(tip);
    // an ear has some body to it: seen edge on, it never thins below this
    const minW = 4.2 * S;
    const span = B.x - A.x;
    if (Math.abs(span) < minW) {
      const mid = (A.x + B.x) / 2;
      const sgn = span < 0 ? -1 : 1;
      A.x = mid - (sgn * minW) / 2;
      B.x = mid + (sgn * minW) / 2;
    }
    // the inside of the ear faces the way the head does
    const front = Math.cos(pose.yaw + pose.head) < 0.15;
    items.push({
      depth: (A.d + B.d + T.d) / 3 + 0.5,
      draw: () => {
        // a big triangle, its tip softly rounded
        o.fillStyle = "rgb(246,245,248)";
        o.beginPath();
        o.moveTo(A.x, A.y);
        o.arcTo(T.x, T.y, B.x, B.y, tipR(A, T, B, 1.9 * S));
        o.lineTo(B.x, B.y);
        o.closePath();
        o.fill();
        if (front) {
          const m = (u: { x: number; y: number }, v: { x: number; y: number }, s: number) => ({ x: u.x + (v.x - u.x) * s, y: u.y + (v.y - u.y) * s });
          const a2 = m(A, T, 0.2);
          const b2 = m(B, T, 0.2);
          const t2 = m(m(A, B, 0.5), T, 0.78);
          o.fillStyle = "rgba(240,176,186,0.85)";
          o.beginPath();
          o.moveTo(a2.x, a2.y);
          o.arcTo(t2.x, t2.y, b2.x, b2.y, tipR(a2, t2, b2, 1.3 * S));
          o.lineTo(b2.x, b2.y);
          o.closePath();
          o.fill();
        }
      },
    });
  }
  // the tail: out from under the haunches and along the grass toward us,
  // swept slowly side to side like a wiper, the wave rolling down its length
  // so the tip curls the other way; asleep, it wraps round to its side. The
  // ground falls away down the picture as it comes toward us (TILT), the way
  // we look down on the meadow. One continuous stroke of fur, in three
  // lengths so each sits in the right place among the body's volumes
  {
    const N = 24;
    const L = 24;
    const TILT = 0.28;
    const calm = 1 - rest * 0.8;
    const smooth = (e0: number, e1: number, x: number) => {
      const c = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return c * c * (3 - 2 * c);
    };
    const pts: Array<{ x: number; y: number; d: number; r: number }> = [];
    const x0 = ln(-15, -14, k);
    let X = x0;
    let Z = 0;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const sweep = 0.7 * Math.sin(t * 0.9 - s * 2.4) + 0.28 * Math.sin(t * 0.41 + 2 - s * 1.8);
      const curl = 1.2 * Math.sin(t * 0.9 - 2.6) * smooth(0.6, 1, s);
      const th = (sweep * (0.35 + 0.65 * s) + curl) * calm + rest * 1.7 * s;
      if (i > 0) {
        X -= Math.cos(th) * (L / N);
        Z += Math.sin(th) * (L / N);
      }
      const lift = smooth(0.72, 1, s) * calm * 3.5 * (0.5 + 0.5 * Math.sin(t * 0.6 + 1));
      const r = 1.8 + 1.4 * Math.sin(Math.PI * (0.15 + 0.7 * s)) + fur * 1.2;
      const q = P([X, ln(2.8, 2.6, k) * (1 - s) + 1.4 * s + lift, Z]);
      pts.push({ x: q.x, y: q.y + (x0 - X) * TILT * S, d: q.d, r });
    }
    for (let part = 0; part < 3; part++) {
      const i0 = part * 8;
      const i1 = Math.min(N, i0 + 9);
      let dsum = 0;
      for (let i = i0; i <= i1; i++) dsum += pts[i].d;
      // a faint shadow where the tail lies against the body, so it reads
      // as its own soft rope of fur: laid only on fur already painted
      // (source-atop), each ring one unbroken stroke so it never builds up,
      // and all of it before any of the tail, so the tail never shades itself
      tailShadows.push(() => {
        o.lineCap = "round";
        o.lineJoin = "round";
        o.globalCompositeOperation = "source-atop";
        o.strokeStyle = "rgba(128,128,166,0.045)";
        let rAvg = 0;
        for (let i = i0; i <= i1; i++) rAvg += pts[i].r;
        rAvg /= i1 - i0 + 1;
        for (const grow of [2.0, 1.1]) {
          o.lineWidth = (rAvg + fl * 0.45 + grow) * 2 * S;
          o.beginPath();
          o.moveTo(pts[i0].x, pts[i0].y - 0.6 * S);
          for (let i = i0 + 1; i <= i1; i++) o.lineTo(pts[i].x, pts[i].y - 0.6 * S);
          o.stroke();
        }
      });
      tailDraws.push({
        depth: dsum / (i1 - i0 + 1),
        draw: () => {
          o.lineCap = "round";
          o.lineJoin = "round";
          o.globalCompositeOperation = "source-over";
          o.strokeStyle = "rgb(244,243,248)";
          for (let i = i0; i < i1; i++) {
            o.lineWidth = (pts[i].r + fl * 0.45) * 2 * S;
            o.beginPath();
            o.moveTo(pts[i].x, pts[i].y);
            o.lineTo(pts[i + 1].x, pts[i + 1].y);
            o.stroke();
          }
        },
      });
    }
  }

  // ---- paint, far parts first ----
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, W, H);
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) it.draw();
  // pull it together as one soft volume: warm up and right, lavender under
  o.globalCompositeOperation = "source-atop";
  const lit = o.createLinearGradient(gx + 14 * S, gy - 46 * S, gx - 14 * S, gy);
  lit.addColorStop(0, "rgba(255,248,232,0.55)");
  lit.addColorStop(0.5, "rgba(250,249,247,0)");
  lit.addColorStop(1, "rgba(170,170,204,0.45)");
  o.fillStyle = lit;
  o.fillRect(0, 0, W, H);
  const under = o.createLinearGradient(0, gy - 5 * S, 0, gy);
  under.addColorStop(0, "rgba(160,162,190,0)");
  under.addColorStop(1, "rgba(160,162,190,0.35)");
  o.fillStyle = under;
  o.fillRect(0, 0, W, H);
  o.globalCompositeOperation = "source-over";
  for (const sh of tailShadows) sh();
  o.globalCompositeOperation = "source-over";
  tailDraws.sort((a, b) => b.depth - a.depth);
  for (const it of tailDraws) it.draw();

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  {
    const rw = 22 * S;
    const sx = gx - 4 * S;
    g.save();
    g.translate(sx, gy);
    g.scale(1, 0.16);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rw);
    gr.addColorStop(0, "rgba(20,38,24,0.34)");
    gr.addColorStop(1, "rgba(20,38,24,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rw, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  softFur(g, off, fur, S);

  // the face, where it's turned toward us: dot eyes, a small pink nose
  const headC = PH([hx, hy, 0]);
  for (const side of [-1, 1]) {
    const e = PH([hx + 6.4, hy + 0.8, side * 3.1]);
    if (e.d < headC.d - 2.2) {
      const open = 1 - rest * 0.92;
      g.fillStyle = "rgba(40,42,44,0.95)";
      g.beginPath();
      g.ellipse(e.x, e.y, 0.75 * S, (0.75 * open + 0.1) * S, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const nose = PH([hx + 9.2, hy - 1.4, 0]);
  if (nose.d < headC.d - 1.5) {
    g.fillStyle = "rgba(236,150,162,1)";
    g.beginPath();
    g.arc(nose.x, nose.y, 0.6 * S, 0, Math.PI * 2);
    g.fill();
  }
}
