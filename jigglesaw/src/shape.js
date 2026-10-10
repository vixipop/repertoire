// Piece outlines. Every edge of the grid is generated once, in a canonical
// direction, and each piece walks it forwards or backwards — so two
// neighbours share the exact same curve and fit with no gap.

// The classic tab as six cubic Béziers, in hundredths of an edge.
// Each row is [cp1, cp2, end]; y < 0 points out of the piece.
const TAB = [
  [0, 0, 35, 15, 37, 5],
  [37, 5, 40, 0, 38, -5],
  [38, -5, 20, -20, 50, -20],
  [50, -20, 80, -20, 62, -5],
  [62, -5, 60, 0, 63, 5],
  [63, 5, 65, 15, 100, 0],
];
const STEPS = 9; // samples per Bézier — smooth enough at any size we draw

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// Points from a to b (both included). sign: +1 tab out, -1 tab in, 0 flat.
// "Out" is the right-hand side of a→b, which is outside for a CCW piece.
function edge(a, b, sign, jit) {
  if (sign === 0) return [a, b];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = dy;
  const ny = -dx;
  const pts = [a];
  let prev = [0, 0];
  for (const [c1x, c1y, c2x, c2y, ex, ey] of TAB) {
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      let u = cubic(prev[0], c1x, c2x, ex, t) / 100;
      const w = (-cubic(prev[1], c1y, c2y, ey, t) / 100) * jit.size * sign;
      // Slide the knob along the edge without moving the corners.
      u += jit.shift * Math.sin(Math.PI * u);
      pts.push([a[0] + dx * u + nx * w, a[1] + dy * u + ny * w]);
    }
    prev = [ex, ey];
  }
  pts[pts.length - 1] = b;
  return pts;
}

// A cols × rows cut. With outerTabs, the border edges get knobs too, so even a
// two-piece puzzle looks like pieces from the middle of a big one.
export function cutPuzzle(cols, rows, { seed = 7, outerTabs = true, corner = 0 } = {}) {
  const rand = mulberry32(seed);
  const flip = () => (rand() < 0.5 ? -1 : 1);
  const jitter = () => ({ shift: (rand() - 0.5) * 0.1, size: 1.12 + (rand() - 0.5) * 0.14 });

  // h[r][c]: horizontal edge along y = r. sign > 0 → knob points +y.
  // v[r][c]: vertical edge along x = c.   sign > 0 → knob points +x.
  const h = [];
  const v = [];
  for (let r = 0; r <= rows; r++) {
    h.push([]);
    for (let c = 0; c < cols; c++) {
      const outer = r === 0 || r === rows;
      h[r].push({ sign: outer && !outerTabs ? 0 : flip(), jit: jitter() });
    }
  }
  for (let r = 0; r < rows; r++) {
    v.push([]);
    for (let c = 0; c <= cols; c++) {
      const outer = c === 0 || c === cols;
      v[r].push({ sign: outer && !outerTabs ? 0 : flip(), jit: jitter() });
    }
  }

  // Canonical directions: horizontals run +x (outside = -y, so a +y knob is
  // sign -1), verticals run +y (outside = +x).
  const hPts = (r, c) => edge([c, r], [c + 1, r], -h[r][c].sign, h[r][c].jit);
  const vPts = (r, c) => edge([c, r], [c, r + 1], v[r][c].sign, v[r][c].jit);
  const fwd = (pts) => pts.slice(0, -1);
  const back = (pts) => pts.slice().reverse().slice(0, -1);

  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sides = [fwd(hPts(r, c)), fwd(vPts(r, c + 1)), back(hPts(r + 1, c)), back(vPts(r, c))];
      pieces.push({ c, r, outline: roundCorners(sides, corner) });
    }
  }
  return pieces;
}

// Each side starts at a corner of the cell. Round those four corners with a
// small radius, so where pieces meet, their walls curve in to a visible seam
// instead of sitting flush like one block.
function roundCorners(sides, radius) {
  if (!radius) return sides.flat();
  const out = [];
  sides.forEach((side, i) => {
    const prev = sides[(i + 3) % 4];
    const corner = side[0];
    const far = (p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) > radius * 1.5;
    // The nearest points on either side that are clear of the curve.
    const before = [...prev].reverse().find(far) || prev[0];
    const after = side.find((p, j) => j > 0 && far(p)) || sides[(i + 1) % 4][0];
    const toward = (p) => {
      const d = Math.hypot(p[0] - corner[0], p[1] - corner[1]);
      return [corner[0] + ((p[0] - corner[0]) / d) * radius, corner[1] + ((p[1] - corner[1]) / d) * radius];
    };
    const a = toward(before);
    const b = toward(after);
    // Drop the tail of the previous side that falls inside the curve.
    while (out.length && Math.hypot(out[out.length - 1][0] - corner[0], out[out.length - 1][1] - corner[1]) <= radius * 1.5) out.pop();
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * corner[0] + t * t * b[0], u * u * a[1] + 2 * u * t * corner[1] + t * t * b[1]]);
    }
    for (let j = 1; j < side.length; j++) if (far(side[j])) out.push(side[j]);
  });
  // The first corner's lead-in sits at the end of the list; trim it there too.
  const c0 = sides[0][0];
  while (Math.hypot(out[out.length - 1][0] - c0[0], out[out.length - 1][1] - c0[1]) <= radius * 1.5) out.pop();
  return out;
}

// The grid for a picture: about `target` pieces, as many columns and rows as
// suit its shape, then each cell stretched a little so the board matches the
// picture exactly (real puzzle pieces aren't square either). Cells stay
// within 25% of square; a very wide picture gets cropped instead.
export function gridFor(aspect, target = 24) {
  let best = null;
  for (let rows = 2; rows <= 8; rows++) {
    for (let cols = 2; cols <= 10; cols++) {
      const n = cols * rows;
      if (n < target - 4 || n > target + 4) continue;
      const cost = Math.abs(Math.log(cols / rows / aspect)) * 4 + Math.abs(n - target) / target;
      if (!best || cost < best.cost) best = { cols, rows, cost };
    }
  }
  const stretch = Math.min(1.25, Math.max(0.8, aspect / (best.cols / best.rows)));
  const cw = Math.sqrt(stretch);
  return { cols: best.cols, rows: best.rows, cw, ch: 1 / cw };
}

// One pass of corner-cutting: every point is replaced by two, a quarter of the
// way along each neighbouring segment. Softens sharp kinks without moving the
// outline by more than a hair.
export function smooth(outline) {
  const out = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return out;
}

// True if any triangle of the extruded top face points the wrong way. The
// rounded edge pushes the outline inward, and at a tight kink that can turn a
// triangle inside out, which shows as a tilted sheet floating over the piece.
export function topFlipped(geo, z) {
  const p = geo.attributes.position;
  let up = 0;
  let down = 0;
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].some((k) => Math.abs(p.getZ(i + k) - z) > 1e-6)) continue;
    const area = (p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getX(i + 2) - p.getX(i)) * (p.getY(i + 1) - p.getY(i));
    if (area > 0) up++;
    else down++;
  }
  return up > 0 && down > 0;
}
