/**
 * Painted swans — smooth, luminous, a little otherworldly.
 *
 * Each swan is a "look": its own proportions and pearl palette. Forms are
 * built from soft gradients rather than outlines: a lit core, a cool shadow
 * side, an inner rim of light on the sun side, and faint feather rows. The
 * water shader softens and blooms the whole layer afterwards, which is what
 * gives the glow.
 *
 * Units: one swan length = 1, facing +x. The caller sets up the transform.
 */

type RGB = [number, number, number];

type Plumage = { hi: RGB; mid: RGB; shade: RGB; deep: RGB; rim: RGB; mottle: RGB | null };

const PLUMAGE: Plumage[] = [
  // champagne pearl
  { hi: [255, 252, 245], mid: [243, 237, 226], shade: [200, 195, 200], deep: [150, 150, 168], rim: [255, 247, 228], mottle: null },
  // moon blue
  { hi: [253, 254, 255], mid: [235, 241, 247], shade: [188, 201, 216], deep: [128, 146, 176], rim: [236, 246, 255], mottle: null },
  // dusky lavender, a few taupe feathers left from youth
  { hi: [249, 245, 241], mid: [229, 223, 221], shade: [186, 178, 188], deep: [132, 124, 144], rim: [255, 241, 232], mottle: [164, 146, 132] },
];

const BEAKS: Array<[string, string, string]> = [
  ["#c9522a", "#ee8048", "#ffc7a0"],
  ["#d65f30", "#f39256", "#ffd3b0"],
  ["#bd4b28", "#e2733f", "#f6b08a"],
];

const css = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export type Look = {
  bw: number; // body half-width
  nose: number;
  rear: number;
  neckLen: number;
  neckW: number;
  headR: number;
  tailLen: number;
  wingLen: number;
  p: Plumage;
  beak: [string, string, string];
  rowJitter: number[];
  mottle: Array<{ x: number; y: number; r: number }>;
  tail: Array<{ a: number; len: number }>;
};

export type Pose = {
  spread: number; // 0 folded … 1 fully open
  jig: number; // tail rotation (rad)
  tailAmp: number;
  paddle: number;
  speedRatio: number;
  bend: number; // neck bend (rad)
  headTurn: number;
  stretch: number;
  sink: number; // 0 … 1 head under water
  lx: number; // sun direction in local space
  ly: number;
  px: number; // one CSS pixel in local units
};

export function makeLook(index: number, rnd: () => number = Math.random): Look {
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const nose = r(0.34, 0.39);
  const rear = r(-0.68, -0.62);
  const look: Look = {
    bw: [0.255, 0.228, 0.243][index % 3] + r(-0.008, 0.008),
    nose,
    rear,
    neckLen: r(0.44, 0.54),
    neckW: r(0.09, 0.11),
    headR: r(0.078, 0.09),
    tailLen: r(0.1, 0.16),
    wingLen: 0.15 - rear - 0.01,
    p: PLUMAGE[index % PLUMAGE.length],
    beak: BEAKS[index % BEAKS.length],
    rowJitter: Array.from({ length: 24 }, () => r(-1, 1)),
    mottle: [],
    tail: [],
  };
  if (look.p.mottle) {
    for (let i = 0; i < 7; i++) look.mottle.push({ x: r(-0.5, 0.05), y: r(-0.15, 0.15), r: r(0.04, 0.09) });
  }
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    look.tail.push({ a: u * r(0.28, 0.4), len: look.tailLen * (1 - Math.abs(u) * 0.3) });
  }
  return look;
}

/* --------------------------------------------------------------------------
   Shapes
   -------------------------------------------------------------------------- */

function bodyPath(l: Look): Path2D {
  const { bw, nose, rear } = l;
  const p = new Path2D();
  p.moveTo(nose, 0);
  p.bezierCurveTo(nose, bw * 0.86, 0.14, bw, -0.04, bw);
  p.bezierCurveTo(-0.26, bw * 0.98, -0.5, bw * 0.5, rear, 0);
  p.bezierCurveTo(-0.5, -bw * 0.5, -0.26, -bw * 0.98, -0.04, -bw);
  p.bezierCurveTo(0.14, -bw, nose, -bw * 0.86, nose, 0);
  p.closePath();
  return p;
}

function cubicPts(out: Array<[number, number]>, p0: number[], p1: number[], p2: number[], p3: number[], n: number) {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

/**
 * Wing outline in normalised wing space (b = 0 shoulder … 1 tip, backward;
 * o = outward). Folded it lies along the back with the tip crossing the
 * spine; opened, the trailing edge breaks into soft feather tips.
 */
function wingOutline(spread: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const tipO = -0.12 + spread * 0.42;
  const innerO = -0.24 - spread * 0.06;
  cubicPts(pts, [0, 0], [0.16, 1.05], [0.6, 1.0], [1, tipO], 20);
  const F = 7;
  for (let j = 0; j <= F * 2; j++) {
    const b = 1 - j / (F * 2);
    const base = innerO + (tipO - innerO) * Math.pow(b, 1.6);
    const notch = j % 2 === 1 ? spread * 0.2 * (0.4 + b) : 0;
    pts.push([b, base - notch]);
  }
  return pts;
}

/** Smooth closed curve through points (quadratic through midpoints). */
function smoothClosed(ctx: CanvasRenderingContext2D | Path2D, pts: Array<[number, number]>) {
  const n = pts.length;
  const m0x = (pts[n - 1][0] + pts[0][0]) / 2;
  const m0y = (pts[n - 1][1] + pts[0][1]) / 2;
  ctx.moveTo(m0x, m0y);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
}

/* --------------------------------------------------------------------------
   Painting
   -------------------------------------------------------------------------- */

export function paintSwan(ctx: CanvasRenderingContext2D, look: Look, pose: Pose) {
  const { p } = look;
  const lx = pose.lx;
  const ly = pose.ly;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const roll = 1 + Math.sin(pose.paddle) * 0.014 * Math.min(pose.speedRatio, 1.5);

  /* feet, seen faintly through the water */
  const footA = Math.min(0.32, 0.08 + pose.speedRatio * 0.26);
  for (const side of [1, -1]) {
    const ph = pose.paddle + (side > 0 ? 0 : Math.PI);
    const fx = -0.28 + Math.sin(ph) * 0.07;
    const fy = side * look.bw * 0.72;
    ctx.fillStyle = `rgba(30,34,40,${footA})`;
    ctx.beginPath();
    ctx.moveTo(fx + 0.1, fy * 0.85);
    ctx.quadraticCurveTo(fx - 0.04, fy + side * 0.1, fx - 0.13, fy + side * 0.09 * (0.5 + 0.5 * Math.cos(ph)));
    ctx.lineTo(fx - 0.12, fy - side * 0.035);
    ctx.closePath();
    ctx.fill();
  }

  /* tail tuft, peeking past the crossed wingtips */
  ctx.save();
  ctx.translate(look.rear + 0.07, 0);
  ctx.rotate(pose.jig);
  for (const f of look.tail) {
    const a = f.a * (1 + pose.tailAmp * 1.6);
    const ex = -Math.cos(a) * (f.len + 0.07);
    const ey = Math.sin(a) * (f.len + 0.07);
    const nx = -Math.sin(a) * 0.028;
    const ny = -Math.cos(a) * 0.028;
    const g = ctx.createLinearGradient(0, 0, ex, ey);
    g.addColorStop(0, css(p.mid));
    g.addColorStop(1, css(p.shade, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.quadraticCurveTo(ex * 0.55 + nx * 1.2, ey * 0.55 + ny * 1.2, ex, ey);
    ctx.quadraticCurveTo(ex * 0.55 - nx * 1.2, ey * 0.55 - ny * 1.2, -nx, -ny);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  /* body */
  const body = bodyPath(look);
  ctx.save();
  ctx.scale(1, roll);
  {
    const cx = -0.08 + lx * 0.14;
    const cy = ly * look.bw * 0.55;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.66);
    g.addColorStop(0, css(p.hi));
    g.addColorStop(0.42, css(p.mid));
    g.addColorStop(0.78, css(p.shade));
    g.addColorStop(1, css(p.deep));
    ctx.fillStyle = g;
    ctx.fill(body);

    ctx.save();
    ctx.clip(body);
    // cool shadow pooled on the far side, warm rim of light on the near side
    ctx.lineWidth = 0.06;
    ctx.translate(-lx * 0.03, -ly * 0.03);
    ctx.strokeStyle = css(p.rim, 0.75);
    ctx.stroke(body);
    ctx.translate(lx * 0.06, ly * 0.06);
    ctx.strokeStyle = css(p.deep, 0.35);
    ctx.lineWidth = 0.07;
    ctx.stroke(body);
    ctx.restore();

    for (const m of look.mottle) {
      const g2 = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      g2.addColorStop(0, css(p.mottle!, 0.22));
      g2.addColorStop(1, css(p.mottle!, 0));
      ctx.fillStyle = g2;
      ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
  }
  ctx.restore();

  /* wings */
  const spread = pose.spread;
  const outline = wingOutline(spread);
  for (const side of [1, -1]) {
    const theta = spread * 1.45;
    const len = look.wingLen + spread * 0.78;
    const cw = look.bw * 0.86 + spread * 0.08;
    const sx = 0.15;
    const sy = side * look.bw * 0.24;
    const c = Math.cos(-side * theta);
    const sn = Math.sin(-side * theta);
    const map = (b: number, o: number): [number, number] => {
      const x = -b * len;
      const y = side * o * cw;
      return [sx + x * c - y * sn, sy + x * sn + y * c];
    };
    const mapped = outline.map(([b, o]) => map(b, o));
    const wing = new Path2D();
    smoothClosed(wing, mapped);

    // the wing lifts off the back: a soft shadow beneath it, away from the sun
    ctx.save();
    ctx.translate(-lx * 0.022, -ly * 0.022);
    ctx.fillStyle = css(p.deep, 0.16 + spread * 0.08);
    ctx.fill(wing);
    ctx.restore();

    const [ccx, ccy] = map(0.45, 0.35);
    const gx = ccx + lx * cw * 0.6;
    const gy = ccy + ly * cw * 0.6;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, len * 0.75);
    g.addColorStop(0, css(p.hi));
    g.addColorStop(0.5, css(p.mid));
    g.addColorStop(0.9, css(p.shade));
    g.addColorStop(1, css(p.deep));
    ctx.fillStyle = g;
    ctx.fill(wing);

    ctx.save();
    ctx.clip(wing);
    // inner rim light
    ctx.translate(-lx * 0.016, -ly * 0.016);
    ctx.strokeStyle = css(p.rim, 0.6);
    ctx.lineWidth = 0.035;
    ctx.stroke(wing);
    ctx.translate(lx * 0.016, ly * 0.016);

    // covert rows: soft scallops, like overlapping felted feathers
    ctx.strokeStyle = css(p.shade, 0.1);
    ctx.lineWidth = 0.014;
    const rows = [0.16, 0.3, 0.44];
    rows.forEach((rb, ri) => {
      const k = 5 + ri;
      for (let i = 0; i < k; i++) {
        const o0 = -0.15 + (i / k) * 1.0;
        const o1 = o0 + 1 / k;
        const jb = rb + look.rowJitter[(ri * 8 + i) % 24] * 0.015;
        const [x0, y0] = map(jb, o0);
        const [x1, y1] = map(jb, o1);
        const [qx, qy] = map(jb + 0.07 + spread * 0.03, (o0 + o1) / 2);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(qx, qy, x1, y1);
        ctx.stroke();
      }
    });
    // long flight-feather lines sweeping to the tip
    ctx.strokeStyle = css(p.shade, 0.13);
    ctx.lineWidth = 0.014;
    for (let i = 0; i < 4; i++) {
      const o = 0.05 + i * 0.2;
      const [x0, y0] = map(0.55, o);
      const [qx, qy] = map(0.8, o * 0.7 + 0.02);
      const [x1, y1] = map(0.99, -0.1 + spread * 0.35 + i * 0.03);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(qx, qy, x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the valley between folded wings
  if (spread < 0.6) {
    ctx.strokeStyle = css(p.deep, 0.12 * (1 - spread / 0.6));
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(0.1, 0);
    ctx.quadraticCurveTo(-0.2, 0.004, look.rear + 0.12, 0);
    ctx.stroke();
  }

  /* breast, where the neck rises */
  {
    const g = ctx.createRadialGradient(0.26 + lx * 0.04, ly * 0.04, 0, 0.26, 0, 0.14);
    g.addColorStop(0, css(p.hi));
    g.addColorStop(0.7, css(p.mid));
    g.addColorStop(1, css(p.mid, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0.26, 0, 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  /* neck — a cubic from the breast to the head */
  const bend = pose.bend;
  const nl = look.neckLen * pose.stretch;
  const bx = 0.2;
  const reachA = bend * 0.85;
  const reach = nl * (1 - Math.min(0.25, Math.abs(bend) * 0.08));
  const hx = bx + Math.cos(reachA) * reach;
  const hy = Math.sin(reachA) * reach;
  const ha = bend * 1.15 + pose.headTurn;
  const p1x = bx + Math.cos(bend * 0.15) * nl * 0.42;
  const p1y = Math.sin(bend * 0.15) * nl * 0.42;
  const p2x = hx - Math.cos(ha) * nl * 0.38;
  const p2y = hy - Math.sin(ha) * nl * 0.38;
  const neckAt = (t: number) => {
    const u = 1 - t;
    const x = u * u * u * bx + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * hx;
    const y = 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * hy;
    const tx = 3 * u * u * (p1x - bx) + 6 * u * t * (p2x - p1x) + 3 * t * t * (hx - p2x);
    const ty = 3 * u * u * p1y + 6 * u * t * (p2y - p1y) + 3 * t * t * (hy - p2y);
    const tl = Math.hypot(tx, ty) || 1;
    return { x, y, nx: -ty / tl, ny: tx / tl, w: look.neckW * (1.25 - 0.6 * Math.sqrt(t)) };
  };
  const N = 18;
  const samples = Array.from({ length: N + 1 }, (_, i) => neckAt(i / N));
  const neck = new Path2D();
  samples.forEach((q, i) => {
    const x = q.x + q.nx * q.w;
    const y = q.y + q.ny * q.w;
    if (i === 0) neck.moveTo(x, y);
    else neck.lineTo(x, y);
  });
  for (let i = N; i >= 0; i--) {
    const q = samples[i];
    neck.lineTo(q.x - q.nx * q.w, q.y - q.ny * q.w);
  }
  neck.closePath();
  const neckFade = 1 - pose.sink * 0.5;
  ctx.globalAlpha = neckFade;
  ctx.fillStyle = css(p.mid);
  ctx.fill(neck);
  ctx.save();
  ctx.clip(neck);
  // highlight runs along whichever flank faces the sun
  const along = (sOf: (q: (typeof samples)[number]) => number, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    samples.forEach((q, i) => {
      const s = sOf(q);
      const x = q.x + q.nx * q.w * s;
      const y = q.y + q.ny * q.w * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  const facing = (q: (typeof samples)[number]) => Math.max(-1, Math.min(1, (q.nx * lx + q.ny * ly) * 2.2));
  along((q) => facing(q) * 0.45, css(p.hi, 0.85), look.neckW * 1.0);
  along((q) => -facing(q) * 1.05, css(p.deep, 0.32), look.neckW * 0.7);
  ctx.restore();
  ctx.globalAlpha = 1;

  /* head */
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ha);
  ctx.globalAlpha = 1 - pose.sink * 0.85;
  const hr = look.headR;
  const hlx = lx * Math.cos(-ha) - ly * Math.sin(-ha);
  const hly = lx * Math.sin(-ha) + ly * Math.cos(-ha);
  {
    const g = ctx.createRadialGradient(hlx * hr * 0.4, hly * hr * 0.4, 0, 0, 0, hr * 1.2);
    g.addColorStop(0, css(p.hi));
    g.addColorStop(0.6, css(p.mid));
    g.addColorStop(1, css(p.shade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0.01, 0, hr * 1.05, hr * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // beak: a soft tapering wedge, black knob and face, dark nail
  const b0 = hr * 0.8;
  const b1 = b0 + 0.16;
  const beak = ctx.createLinearGradient(b0, -0.03, b0, 0.03);
  beak.addColorStop(0, look.beak[0]);
  beak.addColorStop(0.45 - hly * 0.2, look.beak[1]);
  beak.addColorStop(1, look.beak[0]);
  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(b0, 0.032);
  ctx.bezierCurveTo(b0 + 0.07, 0.03, b1 - 0.03, 0.016, b1, 0.004);
  ctx.quadraticCurveTo(b1 + 0.01, 0, b1, -0.004);
  ctx.bezierCurveTo(b1 - 0.03, -0.016, b0 + 0.07, -0.03, b0, -0.032);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = look.beak[2] + "aa";
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(b0 + 0.04, -hly * 0.006);
  ctx.lineTo(b1 - 0.03, -hly * 0.004);
  ctx.stroke();
  ctx.fillStyle = "rgba(22,20,22,0.95)";
  ctx.beginPath();
  ctx.ellipse(b0 - 0.005, 0, 0.034, 0.036, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(12,12,14,1)";
  ctx.beginPath();
  ctx.ellipse(b0 + 0.018, 0, 0.026, 0.017, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(38,30,28,0.9)";
  ctx.beginPath();
  ctx.ellipse(b1 - 0.008, 0, 0.012, 0.009, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(14,14,16,0.9)";
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(hr * 0.42, s * hr * 0.58, 0.01, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  return { hx, hy, ha };
}
