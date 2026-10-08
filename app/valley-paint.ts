/**
 * The valley's foreground, painted from nothing with brush dabs on 2D
 * canvases: the rock spur, the conifers, the sunlit bushes, the boulder ledge
 * and stony path, the big rhododendron on the right, the pine sprays at the
 * top, the dried-blossom branch hanging over it all, and the girl looking out.
 *
 * Everything but the girl is painted once into `fg`; alongside it `info`
 * records, per pixel, how much the wind moves it (red) and which way the
 * brush should run there (green, angle / π). The girl is redrawn every frame
 * so her hair can blow.
 *
 * Coordinates are fractions of the picture: u across, v down, on a 3:4 sheet.
 */

type RGB = [number, number, number];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** pick along a ramp of colours, t in 0..1 */
const ramp = (stops: RGB[], t: number): RGB => {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
};
const jitter = (c: RGB, rnd: () => number, amt: number): RGB => [
  c[0] + (rnd() - 0.5) * amt,
  c[1] + (rnd() - 0.5) * amt,
  c[2] + (rnd() - 0.5) * amt,
];

// value noise, for irregular edges and light
function makeNoise(seed: number) {
  const r = mulberry32(seed);
  const N = 256;
  const tab = new Float32Array(N * N);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const at = (x: number, y: number) => tab[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const n = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
  return (x: number, y: number) => n(x, y) * 0.55 + n(x * 2.1 + 17, y * 2.1 + 3) * 0.3 + n(x * 4.3 + 5, y * 4.3 + 41) * 0.15;
}

// palettes, after the photo but pushed towards Monet's: clean, high-key, warm lights and violet-blue shadows
const LEAF: RGB[] = ["#17352f", "#24513a", "#3b7a3c", "#6aa344", "#a7cc55", "#dcec8e"].map(hex);
const BUSH: RGB[] = ["#22473a", "#3a6e3e", "#5f9a45", "#93c255", "#c9e27c"].map(hex);
const PINE: RGB[] = ["#1b3434", "#2a4a40", "#3f6650", "#6f9468", "#a9c58c"].map(hex);
const CONIFER: RGB[] = ["#16302f", "#22433b", "#335d48", "#4f7c5a"].map(hex);
const ROCK: RGB[] = ["#5a5670", "#7d7c90", "#a8a2a2", "#cdc3b2", "#ece4d2"].map(hex);
const CLIFF: RGB[] = ["#3f3a4f", "#5c5464", "#7f6f6c", "#a38d7a", "#c4ae92"].map(hex);
const GRASS: RGB[] = ["#5d6a3a", "#8b8f48", "#b9ae62", "#ddd08c"].map(hex);
const BARK: RGB[] = ["#3a3240", "#5a4a48", "#7d6a5a", "#a89580"].map(hex);
const BLOSSOM: RGB[] = ["#7a5560", "#9c707a", "#b98d90", "#d4adac"].map(hex);

export type ValleyLayers = {
  /** the painted foreground, transparent where the sky and mountains show */
  fg: HTMLCanvasElement;
  /** wind weight (red) and brush angle (green), small and smooth */
  info: HTMLCanvasElement;
};

export function paintValley(W: number, H: number, seed = 11): ValleyLayers {
  const fg = document.createElement("canvas");
  fg.width = W;
  fg.height = H;
  const g = fg.getContext("2d")!;
  const inf = document.createElement("canvas");
  inf.width = W;
  inf.height = H;
  const ig = inf.getContext("2d")!;
  ig.fillStyle = "#000";
  ig.fillRect(0, 0, W, H);
  const rnd = mulberry32(seed);
  const noise = makeNoise(seed + 5);
  const S = W / 1000; // one unit of brush at the reference size
  const X = (u: number) => u * W;
  const Y = (v: number) => v * H;
  g.lineCap = "round";
  g.lineJoin = "round";
  ig.lineCap = "round";

  /** paint the info channels for a mark: how much the wind moves it, and its brush direction */
  const infoStyle = (wind: number, ang: number) => {
    const a = (((ang % Math.PI) + Math.PI) % Math.PI) / Math.PI;
    return `rgb(${Math.round(clamp01(wind) * 255)},${Math.round(a * 255)},0)`;
  };

  /** a soft oval dab of paint, len along `ang`, wid across */
  const dab = (u: number, v: number, len: number, wid: number, ang: number, col: RGB, alpha: number, wind: number) => {
    g.fillStyle = rgba(col, alpha);
    g.beginPath();
    g.ellipse(X(u), Y(v), len * S, wid * S, ang, 0, Math.PI * 2);
    g.fill();
    if (alpha > 0.35) {
      ig.fillStyle = infoStyle(wind, ang);
      ig.beginPath();
      ig.ellipse(X(u), Y(v), len * S, wid * S, ang, 0, Math.PI * 2);
      ig.fill();
    }
  };

  /** a pointed leaf from its stalk end */
  const leaf = (x: number, y: number, len: number, wid: number, ang: number, col: RGB, alpha: number, wind: number, vein?: RGB) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const L = len * S;
    const Wd = wid * S;
    const px = (a: number, b: number) => x + a * c - b * s;
    const py = (a: number, b: number) => y + a * s + b * c;
    g.fillStyle = rgba(col, alpha);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(px(L * 0.4, Wd), py(L * 0.4, Wd), px(L, 0), py(L, 0));
    g.quadraticCurveTo(px(L * 0.4, -Wd), py(L * 0.4, -Wd), x, y);
    g.fill();
    if (vein) {
      g.strokeStyle = rgba(vein, alpha * 0.5);
      g.lineWidth = Math.max(0.6, Wd * 0.18);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(px(L * 0.85, 0), py(L * 0.85, 0));
      g.stroke();
    }
    ig.fillStyle = infoStyle(wind, ang);
    ig.beginPath();
    ig.moveTo(x, y);
    ig.quadraticCurveTo(px(L * 0.4, Wd), py(L * 0.4, Wd), px(L, 0), py(L, 0));
    ig.quadraticCurveTo(px(L * 0.4, -Wd), py(L * 0.4, -Wd), x, y);
    ig.fill();
  };

  /** a tapering line of paint through points (in pixels) */
  const line = (pts: Array<[number, number]>, w0: number, w1: number, col: RGB, alpha: number, wind: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      const w = (w0 + (w1 - w0) * t) * S;
      g.strokeStyle = rgba(col, alpha);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.stroke();
      const ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
      ig.strokeStyle = infoStyle(wind, ang);
      ig.lineWidth = w + 2 * S;
      ig.beginPath();
      ig.moveTo(pts[i][0], pts[i][1]);
      ig.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ig.stroke();
    }
  };

  /** scatter dabs over everywhere inside(u, v) holds, on a jittered grid */
  const fill = (
    box: [number, number, number, number],
    step: number,
    inside: (u: number, v: number) => boolean,
    paint: (u: number, v: number) => void,
  ) => {
    const [u0, v0, u1, v1] = box;
    const du = (step * S) / W;
    const dv = (step * S) / H;
    const pts: Array<[number, number]> = [];
    for (let v = v0; v < v1; v += dv)
      for (let u = u0; u < u1; u += du) {
        const uu = u + (rnd() - 0.5) * du * 1.6;
        const vv = v + (rnd() - 0.5) * dv * 1.6;
        if (inside(uu, vv)) pts.push([uu, vv]);
      }
    // shuffle so no row of dabs sits on top of the next in order
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    for (const [u, v] of pts) paint(u, v);
  };

  const poly = (P: Array<[number, number]>) => (u: number, v: number) => {
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i];
      const [xj, yj] = P[j];
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  // ---- the valley floor beyond: far trees in the haze ----------------------
  for (let i = 0; i < 70; i++) {
    const u = 0.22 + rnd() * 0.36;
    const base = 0.66 + rnd() * 0.08 + (u - 0.4) * 0.05;
    const h = 0.018 + rnd() * 0.03;
    const haze = 0.35 + rnd() * 0.25;
    const col = mix(ramp(CONIFER, 0.6 + rnd() * 0.4), hex("#8fb1b8"), haze);
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      dab(u, base - h * t, (1 - t) * 6 + 1.5, 2.2, 0, jitter(col, rnd, 14), 0.7, 0.04);
    }
  }

  // ---- the rock spur behind her: a dark wedge, lit on its left face ----------
  const spurP: Array<[number, number]> = [
    [0.41, 0.9], [0.43, 0.84], [0.445, 0.805], [0.462, 0.79], [0.475, 0.75], [0.492, 0.725], [0.5, 0.69], [0.518, 0.668], [0.528, 0.64], [0.545, 0.615], [0.552, 0.59], [0.566, 0.578], [0.58, 0.592], [0.6, 0.63], [0.62, 0.7], [0.63, 0.9],
  ];
  const inSpur = poly(spurP);
  fill([0.38, 0.57, 0.66, 0.92], 7, (u, v) => inSpur(u, v), (u, v) => {
    // only a thin edge on the left catches the sun; the face is in shadow
    const leftEdge = 0.565 - (v - 0.585) * 0.62;
    const lit = clamp01(0.62 - (u - leftEdge) * 14) * 0.85 + (noise(u * 30, v * 30) - 0.5) * 0.35 + 0.12;
    let col = ramp(CLIFF, clamp01(lit));
    // scrub clinging to the rock
    if (noise(u * 22 + 9, v * 22) > 0.68) col = mix(col, ramp(CONIFER, 0.5), 0.7);
    col = jitter(mix(col, hex("#7f93a8"), clamp01((0.75 - v) * 2.5) * 0.35), rnd, 14);
    dab(u, v, 7 + rnd() * 8, 3 + rnd() * 2.5, -1.15 + (rnd() - 0.5) * 0.6, col, 0.88, 0.02);
  });
  // cracks down its face
  for (let i = 0; i < 26; i++) {
    let u = 0.48 + rnd() * 0.14;
    let v = 0.62 + rnd() * 0.22;
    if (!inSpur(u, v)) continue;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 6; k++) {
      pts.push([X(u), Y(v)]);
      u -= 0.006 + rnd() * 0.004;
      v += 0.012 + rnd() * 0.01;
    }
    line(pts, 1.6, 0.6, hex("#2f2a3c"), 0.45, 0.02);
  }

  // ---- the sunlit hillside of bushes on the left ----------------------------
  const hillTop = (u: number) => 0.475 + 0.62 * Math.pow(u, 1.35) + (noise(u * 18, 3) - 0.5) * 0.05;
  fill([0, 0.44, 0.47, 0.95], 6, (u, v) => v > hillTop(u) && u < 0.46 - (v - 0.7) * 0.2, (u, v) => {
    const n = noise(u * 22, v * 22);
    const depth = clamp01((v - 0.45) / 0.45);
    const lit = clamp01(0.35 + (n - 0.5) * 1.3 + (0.5 - depth) * 0.25 + (hillTop(u) + 0.04 > v ? 0.2 : 0));
    // the far part of the slope sinks into the valley haze
    const col = jitter(mix(ramp(BUSH, lit), hex("#8fb0a8"), clamp01((0.6 - v) * 4) * 0.55), rnd, 16);
    const ang = -0.6 + (rnd() - 0.5) * 1.6;
    dab(u, v, 4 + rnd() * 5, 2.2 + rnd() * 2, ang, col, 0.85, 0.35 + depth * 0.15);
  });
  // leafy sprigs catching the light along the hill
  for (let i = 0; i < 900; i++) {
    const u = rnd() * 0.46;
    const v = hillTop(u) + rnd() * 0.32;
    if (u > 0.46 - (v - 0.7) * 0.2) continue;
    const lit = clamp01(0.55 + (noise(u * 22, v * 22) - 0.5) * 1.2);
    const col = jitter(ramp(BUSH, lit), rnd, 18);
    leaf(X(u), Y(v), 6 + rnd() * 6, 1.6 + rnd() * 1.2, -Math.PI / 2 + (rnd() - 0.5) * 2.4, col, 0.9, 0.5);
  }
  // a few bare stems and grasses standing up out of it
  for (let i = 0; i < 40; i++) {
    const u = 0.05 + rnd() * 0.38;
    const v = hillTop(u) + 0.02 + rnd() * 0.25;
    const h = 0.02 + rnd() * 0.04;
    const lean = (rnd() - 0.5) * 0.4;
    line([[X(u), Y(v)], [X(u + lean * h * 0.5), Y(v - h * 0.5)], [X(u + lean * h), Y(v - h)]], 1.4, 0.5, mix(hex("#c9c08a"), hex("#7f8a52"), rnd()), 0.7, 0.6);
  }

  // ---- conifers at the foot of the spur ------------------------------------
  const conifer = (u: number, base: number, h: number, dark: number) => {
    const w = h * 0.22;
    const tiers = 13;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1); // 0 at the bottom
      const v = base - h * t;
      const half = w * (1 - t) * (0.85 + rnd() * 0.3) + 0.002;
      for (const side of [-1, 1]) {
        const lit = clamp01((side > 0 ? 0.55 : 0.2) + t * 0.3 - dark + rnd() * 0.15);
        const col = jitter(ramp(CONIFER, lit), rnd, 12);
        const reach = half * (0.6 + rnd() * 0.4);
        // boughs droop outwards from the trunk
        const ang = side > 0 ? 0.35 : Math.PI - 0.35;
        dab(u + (side * reach) / 2, v + 0.004, (reach * W) / S / 2 + 2, 2.6, ang, col, 0.92, 0.12 + t * 0.1);
      }
    }
    dab(u, base - h, 1.5, 6, Math.PI / 2, ramp(CONIFER, 0.3), 0.9, 0.2);
  };
  const trees: Array<[number, number, number, number]> = [
    [0.335, 0.86, 0.13, 0.1], [0.36, 0.84, 0.17, 0.05], [0.385, 0.86, 0.12, 0.1], [0.41, 0.83, 0.1, 0.15],
    [0.43, 0.86, 0.075, 0.2], [0.315, 0.84, 0.08, 0.2], [0.395, 0.81, 0.065, 0.25], [0.45, 0.88, 0.09, 0.2], [0.475, 0.87, 0.07, 0.3], [0.5, 0.9, 0.06, 0.25],
  ];
  for (const [u, b, h, d] of trees) conifer(u, b, h, d);

  // ---- dry grass and scrub on the slope under her --------------------------
  fill([0.2, 0.8, 0.66, 1.02], 5, (u, v) => v > 0.84 + (noise(u * 30, 1) - 0.5) * 0.04, (u, v) => {
    const lit = clamp01(0.55 + (noise(u * 35, v * 35) - 0.5) * 1.2);
    const col = jitter(ramp(GRASS, lit), rnd, 18);
    dab(u, v, 2 + rnd() * 2, 5 + rnd() * 4, Math.PI / 2 + (rnd() - 0.5) * 0.6, col, 0.85, 0.3);
  });

  // ---- the boulder ledge, bottom left ---------------------------------------
  const ledgeP: Array<[number, number]> = [
    [-0.02, 0.6], [0.035, 0.628], [0.06, 0.66], [0.1, 0.695], [0.155, 0.708], [0.19, 0.735], [0.215, 0.775], [0.24, 0.8], [0.252, 0.86], [0.262, 0.94], [0.27, 1.02], [-0.02, 1.02],
  ];
  const inLedge = poly(ledgeP);
  // the top edge of the ledge, for the lit cap
  const ledgeTop = (u: number) => {
    for (let i = 0; i < ledgeP.length - 2; i++) {
      const [x0, y0] = ledgeP[i];
      const [x1, y1] = ledgeP[i + 1];
      if (u >= x0 && u <= x1) return y0 + ((u - x0) / (x1 - x0)) * (y1 - y0);
    }
    return 0.9;
  };
  fill([-0.02, 0.63, 0.28, 1.02], 6, (u, v) => inLedge(u, v), (u, v) => {
    const fromTop = v - ledgeTop(Math.min(u, 0.244));
    const n = noise(u * 26, v * 26);
    // sunlit cap, a warm dusty top, then blue-violet faces in shadow
    // broken into flat planes, each turned a little more or less to the sun
    const facet = Math.floor(noise(u * 5 + 3, v * 4) * 6) / 5;
    let lit = fromTop < 0.03 ? 0.95 : 0.1 + facet * 0.95 - fromTop * 0.5 + (n - 0.5) * 0.15;
    lit += (u - 0.12) * 0.9;
    let col = ramp(ROCK, clamp01(lit));
    // the shadowed faces go cool and blue, the way Monet laid stone in shade
    if (fromTop > 0.04) col = mix(col, hex("#55607e"), clamp01(0.5 - lit) * 0.5);
    if (fromTop < 0.06) col = mix(col, hex("#d8c7a6"), 0.35);
    col = jitter(col, rnd, 14);
    const ang = fromTop < 0.05 ? 0.55 + (rnd() - 0.5) * 0.4 : 1.2 + facet * 1.4 + (rnd() - 0.5) * 0.4;
    dab(u, v, 8 + rnd() * 8, 3 + rnd() * 3, ang, col, 0.88, 0);
  });
  // scrub growing along the top of the ledge
  for (let i = 0; i < 260; i++) {
    const u = rnd() * 0.2;
    const v = ledgeTop(u) - rnd() * 0.03;
    const lit = clamp01(0.45 + (noise(u * 25, v * 25) - 0.5) * 1.2);
    leaf(X(u), Y(v), 6 + rnd() * 7, 1.8 + rnd(), -Math.PI / 2 + (rnd() - 0.5) * 2.2, jitter(ramp(BUSH, lit), rnd, 18), 0.9, 0.4);
  }
  // cracks and ledges in the boulder
  for (let i = 0; i < 34; i++) {
    let u = rnd() * 0.24;
    let v = ledgeTop(u) + 0.05 + rnd() * 0.2;
    const pts: Array<[number, number]> = [];
    const dir = rnd() < 0.5 ? 0.4 : 1.3;
    for (let k = 0; k < 5; k++) {
      if (!inLedge(u, v)) break;
      pts.push([X(u), Y(v)]);
      u += Math.cos(dir) * 0.015 + (rnd() - 0.5) * 0.008;
      v += Math.sin(dir) * 0.015;
    }
    if (pts.length > 1) line(pts, 2.6, 0.8, hex("#35314a"), 0.6, 0);
  }

  // ---- stones on the path at the very bottom -------------------------------
  for (let i = 0; i < 26; i++) {
    const u = 0.26 + rnd() * 0.48;
    const v = 0.925 + rnd() * 0.08;
    const r = 6 + rnd() * 12;
    for (let k = 0; k < 6; k++) {
      const lit = clamp01(0.5 + (k / 5) * 0.4 + (rnd() - 0.5) * 0.2);
      dab(u + (rnd() - 0.5) * 0.006, v - k * 0.0015, r * (1 - k * 0.1), r * 0.55 * (1 - k * 0.1), 0.2 + (rnd() - 0.5) * 0.4, jitter(ramp(ROCK, lit), rnd, 14), 0.9, 0);
    }
  }

  // ---- the rhododendron on the right -----------------------------------------
  const crown: Array<[number, number, number]> = [
    [0.8, 0.53, 0.16], [0.94, 0.5, 0.15], [0.7, 0.6, 0.11], [0.97, 0.75, 0.15], [0.86, 0.72, 0.12], [0.64, 0.7, 0.08],
    [0.76, 0.86, 0.1], [0.96, 0.93, 0.12], [0.69, 0.94, 0.08], [0.87, 0.38, 0.1], [0.77, 0.41, 0.08], [0.98, 0.33, 0.08],
  ];
  const crownAt = (u: number, v: number) => {
    let best = -10;
    for (const [cu, cv, r] of crown) {
      const du = u - cu;
      const dv = (v - cv) * 0.75;
      best = Math.max(best, 1 - Math.sqrt(du * du + dv * dv) / r);
    }
    return best + (noise(u * 14, v * 14) - 0.5) * 0.5 + (noise(u * 40 + 3, v * 40) - 0.5) * 0.35;
  };
  // the light comes from high on the right
  const sunOn = (u: number, v: number) => clamp01(0.5 + (u - 0.75) * 1.4 - (v - 0.45) * 1.1 + (noise(u * 9 + 4, v * 9) - 0.5) * 0.9);
  // deep interior first, so the crown reads as a mass and not a lace
  fill([0.5, 0.2, 1.02, 1.02], 9, (u, v) => crownAt(u, v) > 0.05, (u, v) => {
    const col = jitter(ramp(LEAF, sunOn(u, v) * 0.45), rnd, 14);
    dab(u, v, 9 + rnd() * 8, 6 + rnd() * 5, rnd() * Math.PI, col, 0.95, 0.4);
  });
  // trunk and limbs, seen between the leaves
  const limb = (pts: Array<[number, number]>, w0: number, w1: number) => {
    const P = pts.map(([u, v]) => [X(u), Y(v)] as [number, number]);
    line(P, w0, w1, BARK[0], 0.95, 0.08);
    line(P.map(([x, y]) => [x + w0 * 0.25 * S, y] as [number, number]), w0 * 0.55, w1 * 0.5, BARK[2], 0.8, 0.08);
    line(P.map(([x, y]) => [x + w0 * 0.38 * S, y] as [number, number]), w0 * 0.18, w1 * 0.2, BARK[3], 0.7, 0.08);
  };
  limb([[0.89, 1.02], [0.875, 0.92], [0.858, 0.82], [0.85, 0.72], [0.84, 0.62]], 34, 16);
  limb([[0.858, 0.82], [0.9, 0.74], [0.95, 0.66]], 18, 8);
  limb([[0.85, 0.72], [0.8, 0.66], [0.75, 0.62]], 15, 6);
  limb([[0.84, 0.62], [0.87, 0.52], [0.9, 0.45]], 13, 5);
  limb([[0.95, 1.02], [0.97, 0.9], [1.01, 0.82]], 22, 10);
  // rosettes of long glossy leaves
  const rosette = (u: number, v: number, size: number, lit: number) => {
    const n = 7 + Math.floor(rnd() * 5);
    const x = X(u);
    const y = Y(v);
    const turn = rnd() * Math.PI * 2;
    const tilt = 0.45 + rnd() * 0.35; // seen a little edge-on
    for (let k = 0; k < n; k++) {
      const a = turn + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      // the rosette is foreshortened: leaves pointing up and down look shorter
      const dx = Math.cos(a);
      const dy = Math.sin(a) * tilt;
      const ang = Math.atan2(dy, dx);
      const len = size * Math.hypot(dx, dy) * (0.8 + rnd() * 0.4);
      // the upper, sunward leaves are brightest
      const l = clamp01(lit + (-dy * 0.25 + dx * 0.1) + (rnd() - 0.5) * 0.25);
      const col = jitter(ramp(LEAF, l), rnd, 16);
      leaf(x, y, len, len * 0.24, ang, col, 0.96, 0.62, l > 0.6 ? LEAF[2] : LEAF[0]);
    }
  };
  for (let i = 0; i < 480; i++) {
    const u = 0.52 + rnd() * 0.5;
    const v = 0.22 + rnd() * 0.8;
    const c = crownAt(u, v);
    if (c < 0.02) continue;
    const lit = sunOn(u, v) * 0.85 + c * 0.15;
    rosette(u, v, 20 + rnd() * 16, lit);
  }
  // red blooms low in the tree, by her shoulder
  for (let i = 0; i < 22; i++) {
    const u = 0.74 + rnd() * 0.07;
    const v = 0.74 + rnd() * 0.12;
    if (crownAt(u, v) < 0.05) continue;
    for (let k = 0; k < 4; k++) dab(u + (rnd() - 0.5) * 0.008, v + (rnd() - 0.5) * 0.006, 2.4, 2, rnd() * 3, jitter(hex(k ? "#d2413f" : "#f07a68"), rnd, 20), 0.95, 0.6);
  }

  // ---- pine sprays in the top-right corner ---------------------------------
  const pineBranch = (u0: number, v0: number, ang: number, len: number, depth: number) => {
    const pts: Array<[number, number]> = [];
    let u = u0;
    let v = v0;
    let a = ang;
    const n = 8;
    for (let k = 0; k <= n; k++) {
      pts.push([X(u), Y(v)]);
      u += (Math.cos(a) * len) / n;
      v += ((Math.sin(a) * len) / n) * 0.75;
      a += (Math.PI / 2 - a) * 0.04 + (rnd() - 0.5) * 0.12; // droops as it goes
    }
    line(pts, 4 - depth, 1.2, BARK[0], 0.9, 0.5);
    // the dark mass of needles along it
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k];
      for (let m = 0; m < 3; m++)
        dab((x + (rnd() - 0.5) * 14 * S) / W, (y + (rnd() - 0.3) * 12 * S) / H, 9 + rnd() * 7, 6 + rnd() * 4, a + (rnd() - 0.5), jitter(ramp(PINE, 0.1 + rnd() * 0.25), rnd, 10), 0.85, 0.55);
    }
    // needle tufts along it, longer and brighter at the tips
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k];
      const t = k / (pts.length - 1);
      const tufts = 34;
      for (let m = 0; m < tufts; m++) {
        const na = a + (rnd() - 0.5) * 2.6 + (rnd() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5) * 0.6;
        const nl = (10 + rnd() * 14) * S;
        const lit = clamp01(0.25 + t * 0.35 + (rnd() - 0.5) * 0.4 + (y < Y(0.12) ? 0.15 : 0));
        g.strokeStyle = rgba(jitter(ramp(PINE, lit), rnd, 16), 0.85);
        g.lineWidth = 1.3 * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl);
        g.stroke();
        ig.strokeStyle = infoStyle(0.55 + t * 0.2, na);
        ig.lineWidth = 3 * S;
        ig.beginPath();
        ig.moveTo(x, y);
        ig.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl);
        ig.stroke();
      }
    }
    if (depth < 1)
      for (let k = 2; k < pts.length - 1; k += 2) {
        const [x, y] = pts[k];
        pineBranch(x / W, y / H, a + (rnd() < 0.5 ? -0.7 : 0.7), len * 0.45, depth + 1);
      }
  };
  pineBranch(1.03, 0.0, Math.PI - 0.2, 0.32, 0);
  pineBranch(1.03, 0.06, Math.PI - 0.1, 0.3, 0);
  pineBranch(1.03, 0.13, Math.PI - 0.02, 0.27, 0);
  pineBranch(1.03, 0.2, Math.PI + 0.08, 0.22, 0);
  pineBranch(1.03, 0.27, Math.PI + 0.12, 0.16, 0);
  pineBranch(0.92, -0.02, Math.PI * 0.6, 0.2, 0);
  pineBranch(0.8, -0.02, Math.PI * 0.55, 0.12, 0);

  // ---- the dried-blossom branch hanging across the top ---------------------
  const twig = (u: number, v: number, ang: number, len: number, w: number, depth: number, reach: number) => {
    const pts: Array<[number, number]> = [];
    let a = ang;
    const n = 7;
    for (let k = 0; k <= n; k++) {
      pts.push([X(u), Y(v)]);
      u += (Math.cos(a) * len) / n;
      v += ((Math.sin(a) * len) / n) * 0.75;
      // the weight of the flowers pulls the twigs down
      a += (Math.PI / 2 - a) * (0.05 + depth * 0.04) + (rnd() - 0.5) * 0.25;
    }
    const wind = clamp01(0.25 + reach * 0.9);
    line(pts, w, w * 0.55, hex("#4a3c42"), 0.95, wind);
    line(pts.map(([x, y]) => [x + w * 0.2 * S, y - w * 0.2 * S] as [number, number]), w * 0.35, w * 0.2, hex("#8d7a72"), 0.6, wind);
    if (depth < 3) {
      const kids = depth === 0 ? 4 : 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < kids; k++) {
        const at = 2 + Math.floor(rnd() * (n - 2));
        const [x, y] = pts[at];
        const side = rnd() < 0.5 ? -1 : 1;
        twig(x / W, y / H, ang + side * (0.5 + rnd() * 0.6) + 0.3, len * (0.45 + rnd() * 0.25), w * 0.6, depth + 1, reach + len * (at / n) * 2);
      }
    }
    // a cluster of dried flowers at the tip
    if (depth >= 2) {
      const [x, y] = pts[pts.length - 1];
      for (let k = 0; k < 16; k++) {
        const a2 = rnd() * Math.PI * 2;
        const r = rnd() * 9 * S;
        const col = jitter(ramp(BLOSSOM, rnd()), rnd, 18);
        dab((x + Math.cos(a2) * r) / W, (y + Math.sin(a2) * r * 1.4 + 4 * S) / H, 2.2 + rnd() * 1.6, 1.6 + rnd(), rnd() * 3, col, 0.92, wind);
      }
    }
  };
  twig(-0.02, 0.0, 0.22, 0.32, 9, 0, 0);
  twig(0.16, -0.01, 0.75, 0.22, 7, 0, 0.1);
  twig(0.4, -0.01, 1.1, 0.16, 5, 1, 0.1);
  // a few dark leaves where the branch comes in at the top-left
  for (let i = 0; i < 70; i++) {
    const u = rnd() * 0.16;
    const v = rnd() * 0.07;
    leaf(X(u), Y(v), 14 + rnd() * 12, 3.5 + rnd() * 2, Math.PI * 0.3 + (rnd() - 0.5) * 1.6, jitter(ramp(LEAF, 0.15 + rnd() * 0.45), rnd, 14), 0.95, 0.4, LEAF[0]);
  }

  // the info layer only needs to be smooth: keep it small
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(W / 6));
  small.height = Math.max(2, Math.round(H / 6));
  const sg = small.getContext("2d")!;
  sg.imageSmoothingQuality = "high";
  sg.drawImage(inf, 0, 0, small.width, small.height);
  return { fg, info: small };
}

// ---- the girl ---------------------------------------------------------------

/** Where her canvas sits on the picture: u, v, width, height. */
export const GIRL_RECT: [number, number, number, number] = [0.55, 0.62, 0.23, 0.39];

export type Girl = {
  canvas: HTMLCanvasElement;
  /** redraw her for this moment; wind is the gust strength, 0..1 */
  draw(t: number, wind: number): void;
};

export function makeGirl(W: number, H: number, seed = 3): Girl {
  const [ru, rv, rw, rh] = GIRL_RECT;
  const cw = Math.round(rw * W);
  const ch = Math.round(rh * H);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d")!;
  const S = W / 1000;
  const X = (u: number) => (u - ru) * W;
  const Y = (v: number) => (v - rv) * H;
  const rnd = mulberry32(seed);

  // her body is painted once; the hair is painted every frame
  const body = document.createElement("canvas");
  body.width = cw;
  body.height = ch;
  const b = body.getContext("2d")!;
  b.lineCap = "round";
  b.lineJoin = "round";

  /** a smooth closed outline through points given in picture fractions */
  const outline = (ctx: CanvasRenderingContext2D, P: Array<[number, number]>, ox = 0, oy = 0) => {
    const pts = P.map(([u, v]) => [X(u) + ox, Y(v) + oy]);
    const n = pts.length;
    ctx.beginPath();
    const mid = (i: number) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    const m0 = mid(n - 1);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(i);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  };
  /** fill a part with a side-lit gradient: shadow on her left, sun on her right */
  const part = (P: Array<[number, number]>, shadow: RGB, mid: RGB, lit: RGB, litAt = 0.75) => {
    let u0 = 1, u1 = 0;
    for (const [u] of P) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
    const gr = b.createLinearGradient(X(u0), 0, X(u1), 0);
    gr.addColorStop(0, rgba(shadow));
    gr.addColorStop(0.45, rgba(mid));
    gr.addColorStop(litAt, rgba(mix(mid, lit, 0.6)));
    gr.addColorStop(1, rgba(lit));
    b.fillStyle = gr;
    outline(b, P);
    b.fill();
  };
  /** brush texture over a part: short strokes of nearby colours, clipped to it */
  const texture = (P: Array<[number, number]>, cols: RGB[], ang: number, len: number, count: number, alpha = 0.35) => {
    b.save();
    outline(b, P);
    b.clip();
    let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
    for (const [u, v] of P) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    for (let i = 0; i < count; i++) {
      const u = u0 + rnd() * (u1 - u0);
      const v = v0 + rnd() * (v1 - v0);
      const a = ang + (rnd() - 0.5) * 0.5;
      const L = len * S * (0.6 + rnd() * 0.8);
      b.strokeStyle = rgba(cols[Math.floor(rnd() * cols.length)], alpha);
      b.lineWidth = (1 + rnd() * 1.6) * S;
      b.beginPath();
      b.moveTo(X(u) - Math.cos(a) * L, Y(v) - Math.sin(a) * L);
      b.lineTo(X(u) + Math.cos(a) * L, Y(v) + Math.sin(a) * L);
      b.stroke();
    }
    b.restore();
  };

  const SKIN = { sh: hex("#7a4a3a"), mid: hex("#b67b5a"), lit: hex("#eab48c") };
  const PANTS = { sh: hex("#2a3029"), mid: hex("#465140"), lit: hex("#7e8b69") };

  // ---- trousers: wide olive legs, the right one lit, a crease between ----
  const pants: Array<[number, number]> = [
    [0.597, 0.868], [0.665, 0.872], [0.734, 0.866], [0.741, 0.93], [0.75, 1.03], [0.668, 1.03], [0.664, 0.96], [0.66, 1.03], [0.585, 1.03], [0.59, 0.93],
  ];
  part(pants, PANTS.sh, PANTS.mid, PANTS.lit, 0.8);
  texture(pants, [PANTS.sh, PANTS.mid, hex("#5d6a50"), PANTS.lit], Math.PI / 2, 9, 260, 0.4);
  // the shadow between the legs, and a seam down each
  b.strokeStyle = rgba(hex("#1c211c"), 0.7);
  b.lineWidth = 3 * S;
  b.beginPath();
  b.moveTo(X(0.664), Y(0.93));
  b.lineTo(X(0.664), Y(1.03));
  b.stroke();
  b.strokeStyle = rgba(PANTS.lit, 0.35);
  b.lineWidth = 1.6 * S;
  for (const u of [0.705, 0.625]) {
    b.beginPath();
    b.moveTo(X(u), Y(0.9));
    b.quadraticCurveTo(X(u + 0.004), Y(0.96), X(u + 0.002), Y(1.03));
    b.stroke();
  }

  // ---- arms, hanging loose, hands tucked at her hips ----
  const leftArm: Array<[number, number]> = [
    [0.6, 0.722], [0.588, 0.728], [0.581, 0.76], [0.579, 0.8], [0.584, 0.84], [0.594, 0.855], [0.6, 0.84], [0.597, 0.8], [0.601, 0.76],
  ];
  const rightArm: Array<[number, number]> = [
    [0.722, 0.722], [0.737, 0.728], [0.746, 0.76], [0.751, 0.8], [0.747, 0.84], [0.736, 0.855], [0.73, 0.84], [0.734, 0.8], [0.728, 0.76],
  ];
  part(leftArm, SKIN.sh, SKIN.mid, mix(SKIN.mid, SKIN.lit, 0.5), 0.9);
  part(rightArm, SKIN.mid, mix(SKIN.mid, SKIN.lit, 0.4), SKIN.lit, 0.6);
  texture(leftArm, [SKIN.sh, SKIN.mid], Math.PI / 2, 5, 40, 0.3);
  texture(rightArm, [SKIN.mid, SKIN.lit], Math.PI / 2, 5, 40, 0.3);

  // ---- back: shoulders and shoulder blades, then the waist ----
  const back: Array<[number, number]> = [
    [0.6, 0.72], [0.63, 0.708], [0.664, 0.704], [0.698, 0.708], [0.724, 0.72], [0.729, 0.76], [0.727, 0.826], [0.664, 0.83], [0.6, 0.828], [0.598, 0.76],
  ];
  part(back, SKIN.sh, SKIN.mid, SKIN.lit, 0.82);
  // the hollow of the spine
  b.strokeStyle = rgba(SKIN.sh, 0.5);
  b.lineWidth = 2.4 * S;
  b.beginPath();
  b.moveTo(X(0.663), Y(0.792));
  b.lineTo(X(0.664), Y(0.83));
  b.stroke();

  // ---- the black bandeau, with thin straps over the shoulders ----
  const top: Array<[number, number]> = [[0.599, 0.748], [0.664, 0.745], [0.728, 0.748], [0.729, 0.79], [0.664, 0.794], [0.599, 0.792]];
  part(top, hex("#0b0a0d"), hex("#16141a"), hex("#3a3846"), 0.85);
  texture(top, [hex("#24222c"), hex("#0e0d12"), hex("#4a4858")], 0.03, 7, 60, 0.4);
  b.strokeStyle = rgba(hex("#0e0d12"));
  b.lineWidth = 2.2 * S;
  for (const [u0, u1] of [[0.614, 0.62], [0.714, 0.708]]) {
    b.beginPath();
    b.moveTo(X(u0), Y(0.749));
    b.lineTo(X(u1), Y(0.712));
    b.stroke();
  }

  // ---- the printed shirt knotted round her hips, sleeves hanging on the right ----
  const shirt: Array<[number, number]> = [
    [0.592, 0.822], [0.664, 0.818], [0.733, 0.815], [0.748, 0.85], [0.752, 0.9], [0.738, 0.922], [0.722, 0.9], [0.664, 0.892], [0.612, 0.89], [0.589, 0.874],
  ];
  part(shirt, hex("#8d8d95"), hex("#c9c8c7"), hex("#f1efe8"), 0.75);
  texture(shirt, [hex("#a9a9b0"), hex("#e6e4dd"), hex("#7b7b84")], -0.4, 8, 120, 0.4);
  // the print: big black brushy letters and blots
  b.save();
  outline(b, shirt);
  b.clip();
  for (let i = 0; i < 30; i++) {
    const u = 0.594 + rnd() * 0.155;
    const v = 0.825 + rnd() * 0.07;
    b.strokeStyle = rgba(hex(rnd() < 0.75 ? "#1c1b21" : "#55545e"), 0.85);
    b.lineWidth = (2 + rnd() * 3.5) * S;
    b.beginPath();
    b.moveTo(X(u), Y(v));
    b.quadraticCurveTo(X(u + (rnd() - 0.5) * 0.02), Y(v + (rnd() - 0.5) * 0.02), X(u + (rnd() - 0.5) * 0.03), Y(v + (rnd() - 0.5) * 0.02));
    b.stroke();
  }
  b.restore();
  // her hands, tucked into the knot at each hip
  for (const [u, v, l] of [[0.596, 0.846, 0], [0.733, 0.846, 1]] as Array<[number, number, number]>) {
    b.fillStyle = rgba(mix(SKIN.sh, SKIN.lit, 0.3 + l * 0.4));
    b.beginPath();
    b.ellipse(X(u), Y(v), 5 * S, 8 * S, 0.1, 0, Math.PI * 2);
    b.fill();
  }

  // ---- hair ----
  const HAIR: RGB[] = ["#0d0a0a", "#1b1414", "#2b201e", "#43332e", "#6b5650", "#8f7a70"].map(hex);
  type Strand = { a: number; len: number; wave: number; phase: number; w: number; col: RGB; alpha: number };
  const strands: Strand[] = [];
  for (let i = 0; i < 150; i++) {
    const a = rnd(); // 0 = her left edge, 1 = her right
    // the sun catches the right side and the crown
    const lit = clamp01(0.12 + a * 0.35 + (rnd() - 0.5) * 0.35);
    strands.push({ a, len: 0.07 + rnd() * 0.03, wave: 0.003 + rnd() * 0.004, phase: rnd() * 6.28, w: 1.4 + rnd() * 3, col: ramp(HAIR, lit), alpha: 0.55 + rnd() * 0.4 });
  }

  return {
    canvas,
    draw(t, wind) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      // she shifts her weight from foot to foot, and breathes
      const sway = Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.13 + 1) * 0.4;
      const breathe = Math.sin(t * 1.3) * 0.5;
      const feetX = X(0.665);
      const feetY = Y(1.0);
      g.translate(feetX, feetY);
      g.rotate(sway * 0.006);
      g.translate(-feetX, -feetY - breathe * 0.6 * S);
      g.drawImage(body, 0, 0);

      // the head turns a touch now and then, to look along the valley
      const look = Math.sin(t * 0.21) * Math.max(0, Math.sin(t * 0.07 + 0.5));
      const ox = look * 3 * S;
      const gust = wind * 8 * S;
      const flow = (k: number) => gust * k * k + Math.sin(t * 1.3 + k * 3) * 1.2 * S * k;
      // the fall of the hair: round over the crown, spilling past the shoulders
      const mass: Array<[number, number]> = [
        [0.656, 0.644], [0.684, 0.65], [0.7, 0.668], [0.703, 0.69], [0.708, 0.72], [0.712, 0.745], [0.7, 0.764], [0.683, 0.758], [0.666, 0.768], [0.648, 0.76], [0.63, 0.766], [0.614, 0.748], [0.612, 0.72], [0.611, 0.692], [0.614, 0.668], [0.63, 0.65],
      ];
      const pts = mass.map(([u, v]) => {
        const k = clamp01((v - 0.66) / 0.1);
        return [u + (ox + flow(k)) / W, v] as [number, number];
      });
      g.fillStyle = rgba(HAIR[1]);
      outline(g, pts);
      g.fill();
      // strands: falling from the crown in loose waves, ends lifted by the wind
      g.lineCap = "round";
      for (const s of strands) {
        const u0 = 0.618 + s.a * 0.076;
        const v0 = 0.66 - Math.sin(s.a * Math.PI) * 0.014;
        const x0 = X(u0) + ox;
        const y0 = Y(v0);
        const L = s.len * H;
        const fan = (s.a - 0.5) * 0.03 * W;
        const wave = s.wave * W * Math.sin(t * 0.9 + s.phase);
        g.strokeStyle = rgba(s.col, s.alpha);
        g.lineWidth = s.w * S;
        g.beginPath();
        g.moveTo(x0, y0);
        g.bezierCurveTo(
          x0 + fan * 0.5 + wave, y0 + L * 0.35,
          x0 + fan - wave + flow(0.7) * 0.6, y0 + L * 0.7,
          x0 + fan * 1.1 + flow(1) + wave * 0.5, y0 + L,
        );
        g.stroke();
      }
      // the shine where the sun skims the crown
      g.lineWidth = 2 * S;
      for (let i = 0; i < 9; i++) {
        const a = 0.25 + i * 0.07;
        g.strokeStyle = rgba(HAIR[5], 0.35);
        g.beginPath();
        g.arc(X(0.656) + ox, Y(0.676), 0.036 * W, Math.PI * (1.15 + a * 0.6), Math.PI * (1.22 + a * 0.6));
        g.stroke();
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
