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
const STEPS = 12; // samples per Bézier

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
export function cutPuzzle(cols, rows, { seed = 7, outerTabs = true } = {}) {
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
      const outline = [
        ...fwd(hPts(r, c)),
        ...fwd(vPts(r, c + 1)),
        ...back(hPts(r + 1, c)),
        ...back(vPts(r, c)),
      ];
      pieces.push({ c, r, outline });
    }
  }
  return pieces;
}
