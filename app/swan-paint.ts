/**
 * Painted swans.
 *
 * Each swan is a "look": its own silhouette proportions, plumage palette and
 * a few hundred brush dabs generated once at birth. Every frame the dabs are
 * mapped through the current pose (wing spread, neck curve, tail jiggle) and
 * re-shaded against the sun, so the strokes stay put on the bird while the
 * light moves over them as it turns.
 *
 * Units: one swan length = 1. The caller sets up translate/rotate/scale.
 */

type RGB = [number, number, number];

/** A brush stroke in its part's own coordinate space. */
type Dab = {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  w: number;
  tone: number; // -1..1 personal value jitter
  alpha: number;
};

type Plumage = { shadow: RGB; mid: RGB; hi: RGB; reflect: RGB; mottle: RGB | null };

const PLUMAGE: Plumage[] = [
  // warm, creamy old cob
  { shadow: [132, 140, 158], mid: [238, 232, 219], hi: [255, 250, 238], reflect: [150, 176, 152], mottle: null },
  // cool, bright pen
  { shadow: [118, 138, 158], mid: [229, 235, 237], hi: [252, 254, 255], reflect: [138, 170, 160], mottle: null },
  // dusky sub-adult with a few brownish feathers left over
  { shadow: [116, 118, 124], mid: [222, 217, 206], hi: [246, 241, 229], reflect: [146, 166, 146], mottle: [150, 132, 112] },
];

const BEAKS: Array<[string, string, string]> = [
  ["#e2652e", "#f08a4e", "#ffc39a"],
  ["#ef7a3c", "#f79a5c", "#ffd0aa"],
  ["#d9592b", "#e87842", "#f8b48a"],
];

export type Look = {
  bw: number;
  nose: number;
  rear: number;
  neckLen: number;
  neckW: number;
  headR: number;
  tailLen: number;
  wingLen: number;
  wingCw: number;
  ramp: string[]; // "rgba(r,g,b," prefixes, dark → light
  mottle: string | null;
  beak: [string, string, string];
  bodyDabs: Dab[];
  breastDabs: Dab[];
  wingDabs: Dab[];
  primaries: Dab[];
  mottleDabs: Dab[];
  neckDabs: Dab[]; // x = t along neck, y = s across (-1..1)
  headDabs: Dab[];
  tail: Array<{ a: number; len: number; w: number; tone: number }>;
  bodyEdge: Array<[number, number, number]>; // x, y, ink on/off (gaps make it hand-drawn)
  wingInk: number[]; // ink on/off per outline segment
};

export type Pose = {
  spread: number; // 0 folded … 1 fully open
  jig: number; // tail rotation (rad)
  tailAmp: number;
  paddle: number;
  speedRatio: number;
  bend: number; // neck bend (rad, + = toward +y)
  headTurn: number; // extra head rotation on top of the neck
  stretch: number; // neck length multiplier
  sink: number; // 0 … 1 head under water
  lx: number; // sun direction in local space
  ly: number;
  px: number; // one CSS pixel in local units
};

const RAMP_STEPS = 14;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function buildRamp(p: Plumage): string[] {
  const out: string[] = [];
  for (let i = 0; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    let c: RGB;
    if (t < 0.5) {
      // shadow side picks up green bounce light from the water
      const u = t / 0.5;
      c = mix(mix(p.shadow, p.reflect, 0.35 * (1 - u)), p.mid, Math.pow(u, 0.8));
    } else {
      c = mix(p.mid, p.hi, (t - 0.5) / 0.5);
    }
    out.push(`rgba(${c[0]},${c[1]},${c[2]},`);
  }
  return out;
}

function bodyPath(l: Pick<Look, "bw" | "nose" | "rear">, k = 1): Path2D {
  const { bw, nose, rear } = l;
  const p = new Path2D();
  p.moveTo(nose * k, 0);
  p.bezierCurveTo(nose * k, bw * 0.78 * k, 0.17 * k, bw * k, -0.05 * k, bw * k);
  p.bezierCurveTo(-0.3 * k, bw * 0.95 * k, rear * 0.88 * k, bw * 0.5 * k, rear * k, 0);
  p.bezierCurveTo(rear * 0.88 * k, -bw * 0.5 * k, -0.3 * k, -bw * 0.95 * k, -0.05 * k, -bw * k);
  p.bezierCurveTo(0.17 * k, -bw * k, nose * k, -bw * 0.78 * k, nose * k, 0);
  p.closePath();
  return p;
}

/** Wing outline in normalised wing space: b = 0..1 backward, o = outward. */
const WING_OUTLINE: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const bez = (p0: number[], p1: number[], p2: number[], p3: number[], n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  };
  bez([0, 0], [0.2, 1.15], [0.62, 1.05], [1, 0.3], 16);
  bez([1, 0.3], [0.9, -0.05], [0.6, -0.3], [0.35, -0.28], 8);
  bez([0.35, -0.28], [0.2, -0.27], [0.06, -0.2], [0, 0], 6);
  return pts;
})();

function inPolygon(pts: Array<[number, number]>, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function dab(x: number, y: number, a: number, len: number, w: number, bend: number, tone: number, alpha: number): Dab {
  const dx = Math.cos(a) * len * 0.5;
  const dy = Math.sin(a) * len * 0.5;
  return {
    x0: x - dx,
    y0: y - dy,
    x1: x + dx,
    y1: y + dy,
    cx: x - Math.sin(a) * bend,
    cy: y + Math.cos(a) * bend,
    w,
    tone,
    alpha,
  };
}

export function makeLook(index: number, rnd: () => number = Math.random): Look {
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const plumage = PLUMAGE[index % PLUMAGE.length];

  const look: Look = {
    bw: [0.27, 0.235, 0.255][index % 3] + r(-0.01, 0.01),
    nose: r(0.4, 0.46),
    rear: r(-0.6, -0.52),
    neckLen: r(0.46, 0.56),
    neckW: r(0.1, 0.128),
    headR: r(0.1, 0.12),
    tailLen: r(0.16, 0.26),
    wingLen: r(0.62, 0.72),
    wingCw: r(0.17, 0.21),
    ramp: buildRamp(plumage),
    mottle: plumage.mottle ? `rgba(${plumage.mottle.join(",")},` : null,
    beak: BEAKS[index % BEAKS.length],
    bodyDabs: [],
    breastDabs: [],
    wingDabs: [],
    primaries: [],
    mottleDabs: [],
    neckDabs: [],
    headDabs: [],
    tail: [],
    bodyEdge: [],
    wingInk: [],
  };

  // ink runs: long pencil passes with the odd lift, never even dashes
  const runs = (n: number, onOnly?: (i: number) => boolean) => {
    const out: number[] = [];
    let on = rnd() < 0.7;
    let left = 0;
    for (let i = 0; i < n; i++) {
      if (left <= 0) {
        on = !on;
        left = on ? 6 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 3);
      }
      left--;
      out.push(on && (!onOnly || onOnly(i)) ? 1 : 0);
    }
    return out;
  };
  // only the leading (outer) edge of the wing gets a line
  look.wingInk = runs(WING_OUTLINE.length, (i) => i < 17);

  // --- body: interior strokes follow the plumage, edge strokes break the outline
  const probe = document.createElement("canvas").getContext("2d")!;
  const body = bodyPath(look);
  const inBody = (x: number, y: number) => probe.isPointInPath(body, x, y);
  for (let n = 0; n < 900 && look.bodyDabs.length < 60; n++) {
    const x = r(look.rear, look.nose);
    const y = r(-look.bw, look.bw);
    if (!inBody(x, y)) continue;
    const flow = (y / look.bw) * 0.45 * (x > 0 ? -1 : 1);
    look.bodyDabs.push(dab(x, y, flow + r(-0.12, 0.12), r(0.16, 0.34), r(0.045, 0.085), r(-0.03, 0.03), r(-1, 1), r(0.22, 0.5)));
  }
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * Math.PI * 2 + r(-0.03, 0.03);
    const edge = (a: number) => {
      let rr = 0.05;
      while (rr < 0.8 && inBody(-0.05 + Math.cos(a) * rr, Math.sin(a) * rr)) rr += 0.006;
      return [-0.05 + Math.cos(a) * rr, Math.sin(a) * rr];
    };
    const [x, y] = edge(th);
    const [x2, y2] = edge(th + 0.05);
    const tangent = Math.atan2(y2 - y, x2 - x);
    const out = r(-0.022, 0.004); // some strokes overshoot the silhouette a hair
    const nx = Math.cos(th) * out;
    const ny = Math.sin(th) * out;
    look.bodyDabs.push(dab(x + nx, y + ny, tangent + r(-0.05, 0.05), r(0.1, 0.18), r(0.02, 0.04), r(-0.012, 0.012), r(-1, 0.4), r(0.5, 0.85)));
  }
  const bodyRuns = runs(72);
  for (let i = 0; i < 72; i++) {
    const th = (i / 72) * Math.PI * 2;
    let rr = 0.05;
    while (rr < 0.8 && inBody(-0.05 + Math.cos(th) * rr, Math.sin(th) * rr)) rr += 0.004;
    look.bodyEdge.push([-0.05 + Math.cos(th) * rr, Math.sin(th) * rr, bodyRuns[i]]);
  }

  // breast: where the neck rises, painted over the wing shoulders
  for (let i = 0; i < 22; i++) {
    const a = r(0, Math.PI * 2);
    const rr = Math.sqrt(rnd()) * 0.15;
    const x = 0.27 + Math.cos(a) * rr;
    const y = Math.sin(a) * rr * (look.bw / 0.26);
    look.breastDabs.push(dab(x, y, a + Math.PI / 2 + r(-0.3, 0.3), r(0.05, 0.11), r(0.025, 0.045), r(-0.015, 0.015), r(-0.6, 1), r(0.45, 0.8)));
  }

  // --- wing (normalised space, mirrored per side at draw time)
  for (let n = 0; n < 900 && look.wingDabs.length < 38; n++) {
    const b = r(0, 1);
    const o = r(-0.3, 1.15);
    if (!inPolygon(WING_OUTLINE, b, o)) continue;
    // coverts near the shoulder are short; flight feathers run long toward the tip
    const len = 0.16 + b * 0.32;
    look.wingDabs.push(dab(b, o, r(-0.1, 0.1) - o * 0.12, len, r(0.22, 0.4), r(-0.1, 0.1), r(-1, 1), r(0.22, 0.5)));
  }
  for (let i = 0; i < WING_OUTLINE.length; i += 2) {
    const [b, o] = WING_OUTLINE[i];
    const [b2, o2] = WING_OUTLINE[(i + 1) % WING_OUTLINE.length];
    const a = Math.atan2(o2 - o, b2 - b);
    look.wingDabs.push(dab((b + b2) / 2, (o + o2) / 2, a + r(-0.12, 0.12), Math.hypot(b2 - b, o2 - o) * r(2.4, 3.4), r(0.12, 0.22), r(-0.03, 0.03), r(-1, 0.3), r(0.55, 0.9)));
  }
  // primaries: long feathers off the trailing edge, fanning when spread
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    const b = 0.55 + u * 0.45;
    const o = 0.25 - u * 0.4 + r(-0.04, 0.04);
    look.primaries.push(dab(b + 0.1, o, -0.25 - u * 0.25 + r(-0.06, 0.06), r(0.26, 0.4), r(0.16, 0.24), r(-0.04, 0.04), r(-0.8, 0.6), r(0.6, 0.9)));
  }
  if (look.mottle) {
    for (let i = 0; i < 16; i++) {
      look.mottleDabs.push(dab(r(0.25, 0.95), r(0.05, 0.85), r(-0.3, 0.3), r(0.08, 0.18), r(0.14, 0.3), r(-0.05, 0.05), r(-1, 1), r(0.12, 0.3)));
    }
  }

  // --- neck: t along, s across
  for (let i = 0; i < 44; i++) {
    const t = r(0, 0.95);
    const s = r(-1, 1);
    look.neckDabs.push(dab(t, s * 0.8, r(-0.06, 0.06), r(0.2, 0.36), r(0.02, 0.036), r(-0.08, 0.08), r(-1, 1), r(0.3, 0.6)));
  }

  // --- head: small strokes wrapping the skull
  for (let i = 0; i < 16; i++) {
    const a = r(0, Math.PI * 2);
    const rr = Math.sqrt(rnd()) * look.headR * 0.95;
    look.headDabs.push(dab(Math.cos(a) * rr, Math.sin(a) * rr * 0.72, r(-0.4, 0.4), r(0.04, 0.08), r(0.018, 0.03), r(-0.01, 0.01), r(-1, 1), r(0.5, 0.85)));
  }

  // --- tail feathers: a fan, longer in the middle
  const nTail = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < nTail; i++) {
    const u = nTail === 1 ? 0 : (i / (nTail - 1)) * 2 - 1;
    look.tail.push({ a: u * r(0.3, 0.42), len: look.tailLen * (1 - Math.abs(u) * 0.35) * r(0.9, 1.1), w: r(0.035, 0.055), tone: r(-1, 1) });
  }

  return look;
}

/* --------------------------------------------------------------------------
   Drawing
   -------------------------------------------------------------------------- */

function shadeIndex(look: Look, pose: Pose, x: number, y: number, tone: number, lift: number) {
  const nx = (x + 0.05) / 0.5;
  const ny = y / (look.bw + 0.06);
  let v = 0.56 + 0.62 * (nx * pose.lx + ny * pose.ly) + tone * 0.12 + lift;
  v -= Math.max(0, -x - 0.35) * 0.4; // the stern sits low and darker
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return Math.round(v * (RAMP_STEPS - 1));
}

function strokeDab(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

const INK = "rgba(58,62,70,";

/** Broken pencil line along the shadow side of an outline. */
function inkLine(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  on: number[],
  pose: Pose,
  cx: number,
  cy: number,
  w: number,
  closed: boolean,
) {
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    if (!on[i]) continue;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    // outward normal ≈ direction from the part's centre
    const mx = (x0 + x1) / 2 - cx;
    const my = (y0 + y1) / 2 - cy;
    const ml = Math.hypot(mx, my) || 1;
    const shade = -((mx / ml) * pose.lx + (my / ml) * pose.ly);
    if (shade < -0.15) continue;
    ctx.strokeStyle = INK + (0.12 + Math.min(1, shade + 0.15) * 0.38).toFixed(3) + ")";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

export function paintSwan(ctx: CanvasRenderingContext2D, look: Look, pose: Pose) {
  const { ramp } = look;
  const minW = pose.px * 0.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const roll = 1 + Math.sin(pose.paddle) * 0.015 * Math.min(pose.speedRatio, 1.5);

  /* feet paddling below the surface */
  const footA = Math.min(0.42, 0.1 + pose.speedRatio * 0.35);
  for (const side of [1, -1]) {
    const ph = pose.paddle + (side > 0 ? 0 : Math.PI);
    const fx = -0.3 + Math.sin(ph) * 0.07;
    const fy = side * (look.bw * 0.68);
    ctx.fillStyle = `rgba(28,34,30,${footA})`;
    ctx.beginPath();
    ctx.moveTo(fx + 0.1, fy * 0.85);
    ctx.quadraticCurveTo(fx - 0.04, fy + side * 0.1, fx - 0.13, fy + side * 0.1 * (0.5 + 0.5 * Math.cos(ph)));
    ctx.lineTo(fx - 0.12, fy - side * 0.035);
    ctx.closePath();
    ctx.fill();
  }

  /* tail */
  ctx.save();
  ctx.translate(look.rear + 0.06, 0);
  ctx.rotate(pose.jig);
  for (const f of look.tail) {
    const a = f.a * (1 + pose.tailAmp * 1.6);
    const ex = -Math.cos(a) * f.len;
    const ey = Math.sin(a) * f.len;
    const idx = shadeIndex(look, pose, look.rear + ex * 0.5, ey * 0.5, f.tone, -0.05);
    strokeDab(ctx, 0, 0, ex * 0.5, ey * 0.5 + f.tone * 0.01, ex * 0.9, ey * 0.9, f.w * 1.3, ramp[idx] + "0.95)");
    strokeDab(ctx, ex * 0.3, ey * 0.3, ex * 0.6, ey * 0.6, ex * 0.95, ey * 0.95, f.w * 0.45, ramp[Math.min(RAMP_STEPS - 1, idx + 2)] + "0.6)");
  }
  ctx.restore();

  /* body */
  ctx.save();
  ctx.scale(1, roll);
  ctx.fillStyle = ramp[Math.round(RAMP_STEPS * 0.55)] + "1)";
  ctx.fill(bodyPath(look, 0.94));
  for (const d of look.bodyDabs) {
    const idx = shadeIndex(look, pose, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, d.tone, 0);
    strokeDab(ctx, d.x0, d.y0, d.cx, d.cy, d.x1, d.y1, Math.max(minW, d.w), ramp[idx] + d.alpha + ")");
  }
  inkLine(
    ctx,
    look.bodyEdge.map(([x, y]) => [x, y] as [number, number]),
    look.bodyEdge.map((e) => e[2]),
    pose,
    -0.05,
    0,
    pose.px * 1.1,
    true,
  );
  ctx.restore();

  /* wings */
  const spread = pose.spread;
  for (const side of [1, -1]) {
    const theta = spread * 1.45;
    const len = look.wingLen + spread * 0.8;
    const cw = look.wingCw + spread * 0.07;
    const sx = 0.2;
    const sy = side * look.bw * 0.34;
    const c = Math.cos(-side * theta);
    const sn = Math.sin(-side * theta);
    const map = (b: number, o: number): [number, number] => {
      const lx = -b * len;
      const ly = side * o * cw;
      return [sx + lx * c - ly * sn, sy + lx * sn + ly * c];
    };
    const lift = 0.07 + spread * 0.05;

    // the raised wing casts a soft shadow onto the back, away from the sun
    ctx.strokeStyle = ramp[1] + (0.22 + spread * 0.1) + ")";
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const [x, y] = map(WING_OUTLINE[i][0], WING_OUTLINE[i][1]);
      const ox = -pose.lx * 0.03;
      const oy = -pose.ly * 0.03;
      if (i === 0) ctx.moveTo(x + ox, y + oy);
      else ctx.lineTo(x + ox, y + oy);
    }
    ctx.stroke();

    // base wash so the strokes never show water through them
    ctx.fillStyle = ramp[Math.round(RAMP_STEPS * 0.62)] + "1)";
    ctx.beginPath();
    WING_OUTLINE.forEach(([b, o], i) => {
      const [x, y] = map(b * 0.97, o * 0.92);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();

    const drawSet = (set: Dab[], wMul: number, alphaMul: number, toneShift: number, color?: string) => {
      for (const d of set) {
        const [x0, y0] = map(d.x0, d.y0);
        const [x1, y1] = map(d.x1, d.y1);
        const [qx, qy] = map(d.cx, d.cy);
        const col = color ?? ramp[shadeIndex(look, pose, (x0 + x1) / 2, (y0 + y1) / 2, d.tone, lift + toneShift)];
        strokeDab(ctx, x0, y0, qx, qy, x1, y1, Math.max(minW, d.w * cw * wMul), col + d.alpha * alphaMul + ")");
      }
    };

    // primaries sit under the wing's trailing edge, lengthening as it opens
    const pr = look.primaries.map((d) => {
      const grow = 0.55 + spread * 0.9;
      return { ...d, x1: d.x0 + (d.x1 - d.x0) * grow, y1: d.y0 + (d.y1 - d.y0) * grow - spread * 0.15 };
    });
    drawSet(pr, 1, 1, -0.08);
    drawSet(look.wingDabs, 1, 1, 0);
    if (look.mottle) drawSet(look.mottleDabs, 1, 1, 0, look.mottle);

    const mapped = WING_OUTLINE.map(([b, o]) => map(b, o));
    const [wcx, wcy] = map(0.5, 0.35);
    inkLine(ctx, mapped, look.wingInk, pose, wcx, wcy, pose.px * 1.05, true);

    // feather separation marks, crisper once the wing is open
    if (spread > 0.05) {
      ctx.strokeStyle = `rgba(70,84,92,${0.18 * spread})`;
      ctx.lineWidth = minW;
      for (let i = 1; i <= 5; i++) {
        const b = 0.45 + i * 0.1;
        const [x0, y0] = map(b - 0.05, 0.55);
        const [x1, y1] = map(b + 0.1, -0.12);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
  }

  /* breast */
  ctx.fillStyle = ramp[shadeIndex(look, pose, 0.27, 0, 0, 0.08)] + "1)";
  ctx.beginPath();
  ctx.ellipse(0.27, 0, 0.14, 0.14 * (look.bw / 0.26), 0, 0, Math.PI * 2);
  ctx.fill();
  for (const d of look.breastDabs) {
    const idx = shadeIndex(look, pose, (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, d.tone, 0.08);
    strokeDab(ctx, d.x0, d.y0, d.cx, d.cy, d.x1, d.y1, Math.max(minW, d.w), ramp[idx] + d.alpha + ")");
  }

  /* neck — a cubic from the breast to the head */
  const bend = pose.bend;
  const nl = look.neckLen * pose.stretch;
  const bx = 0.2;
  const by = 0;
  const reachA = bend * 0.85;
  const reach = nl * (1 - Math.min(0.25, Math.abs(bend) * 0.08));
  const hx = bx + Math.cos(reachA) * reach;
  const hy = by + Math.sin(reachA) * reach;
  const ha = bend * 1.15 + pose.headTurn;
  const p1x = bx + Math.cos(bend * 0.15) * nl * 0.42;
  const p1y = by + Math.sin(bend * 0.15) * nl * 0.42;
  const p2x = hx - Math.cos(ha) * nl * 0.38;
  const p2y = hy - Math.sin(ha) * nl * 0.38;
  const neckAt = (t: number) => {
    const u = 1 - t;
    const x = u * u * u * bx + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * hx;
    const y = u * u * u * by + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * hy;
    const tx = 3 * u * u * (p1x - bx) + 6 * u * t * (p2x - p1x) + 3 * t * t * (hx - p2x);
    const ty = 3 * u * u * (p1y - by) + 6 * u * t * (p2y - p1y) + 3 * t * t * (hy - p2y);
    const tl = Math.hypot(tx, ty) || 1;
    return { x, y, nx: -ty / tl, ny: tx / tl, w: look.neckW * (1 - 0.42 * Math.sqrt(t)) };
  };
  const neckMap = (t: number, s: number): [number, number] => {
    const q = neckAt(Math.min(1, Math.max(0, t)));
    return [q.x + q.nx * q.w * s, q.y + q.ny * q.w * s];
  };

  const N = 14;
  ctx.fillStyle = ramp[shadeIndex(look, pose, (bx + hx) / 2, (by + hy) / 2, 0, 0.14)] + "1)";
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const [x, y] = neckMap(i / N, 0.92);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const [x, y] = neckMap(i / N, -0.92);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (const d of look.neckDabs) {
    const [x0, y0] = neckMap(d.x0, d.y0);
    const [x1, y1] = neckMap(d.x1, d.y1);
    const [qx, qy] = neckMap(d.cx, d.cy);
    const fade = d.x1 > 0.6 ? 1 - pose.sink * 0.85 : 1;
    const idx = shadeIndex(look, pose, (x0 + x1) / 2, (y0 + y1) / 2, d.tone, 0.14);
    strokeDab(ctx, x0, y0, qx, qy, x1, y1, Math.max(minW, d.w), ramp[idx] + d.alpha * fade + ")");
  }
  // edge strokes along both sides so the neck isn't a clean tube
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const t0 = 0.08 + i * 0.22;
      const [x0, y0] = neckMap(t0, s * 0.95);
      const [x1, y1] = neckMap(t0 + 0.24, s * 0.9);
      const [qx, qy] = neckMap(t0 + 0.12, s * 1.02);
      const idx = shadeIndex(look, pose, x0, y0, -0.5, 0.06);
      strokeDab(ctx, x0, y0, qx, qy, x1, y1, Math.max(minW, look.neckW * 0.22), ramp[idx] + "0.8)");
    }
  }

  const neckL: Array<[number, number]> = [];
  const neckR: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    neckL.push(neckMap(i / N, 1));
    neckR.push(neckMap(i / N, -1));
  }
  const neckOn = neckL.map((_, i) => (i > 2 && i % 5 !== 3 ? 1 : 0));
  const [ncx, ncy] = neckMap(0.5, 0);
  inkLine(ctx, neckL, neckOn, pose, ncx, ncy, pose.px, false);
  inkLine(ctx, neckR, neckOn, pose, ncx, ncy, pose.px, false);

  /* head */
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ha);
  ctx.globalAlpha = 1 - pose.sink * 0.82;
  const hr = look.headR;
  ctx.fillStyle = ramp[shadeIndex(look, pose, hx, hy, 0, 0.2)] + "1)";
  ctx.beginPath();
  ctx.ellipse(0.01, 0, hr, hr * 0.74, 0, 0, Math.PI * 2);
  ctx.fill();
  const hcos = Math.cos(ha);
  const hsin = Math.sin(ha);
  for (const d of look.headDabs) {
    const mx = (d.x0 + d.x1) / 2;
    const my = (d.y0 + d.y1) / 2;
    const idx = shadeIndex(look, pose, hx + mx * hcos - my * hsin, hy + mx * hsin + my * hcos, d.tone, 0.2);
    strokeDab(ctx, d.x0, d.y0, d.cx, d.cy, d.x1, d.y1, Math.max(minW, d.w), ramp[idx] + d.alpha + ")");
  }

  // black face and knob, then the beak in three loose strokes
  const bx0 = hr * 0.78;
  strokeDab(ctx, bx0 - 0.03, 0, bx0, 0.004, bx0 + 0.035, 0, 0.068, "rgba(24,24,22,0.95)");
  strokeDab(ctx, bx0 + 0.02, -0.03, bx0 + 0.11, -0.03, bx0 + 0.15, -0.006, 0.026, look.beak[0]);
  strokeDab(ctx, bx0 + 0.02, 0.03, bx0 + 0.11, 0.03, bx0 + 0.15, 0.006, 0.026, look.beak[0]);
  strokeDab(ctx, bx0 + 0.03, 0, bx0 + 0.1, 0, bx0 + 0.16, 0, 0.042, look.beak[1]);
  strokeDab(ctx, bx0 + 0.05, -0.004, bx0 + 0.09, -0.006, bx0 + 0.13, -0.004, 0.012, look.beak[2]);
  strokeDab(ctx, bx0 + 0.155, 0, bx0 + 0.165, 0, bx0 + 0.172, 0, 0.022, "rgba(36,30,26,0.95)");
  strokeDab(ctx, bx0 + 0.005, 0, bx0 + 0.025, 0, bx0 + 0.045, 0, 0.04, "rgba(16,16,15,1)");
  ctx.fillStyle = "rgba(14,14,13,0.95)";
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(hr * 0.42, s * hr * 0.6, 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return { hx, hy, ha };
}
