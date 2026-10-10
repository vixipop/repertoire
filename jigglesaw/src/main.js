import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { cutPuzzle, gridFor, smooth, topFlipped } from './shape.js';
import { Cluster } from './cluster.js';
import { createQualityGuard } from './quality.js';
import { THEMES, savedTheme, saveTheme } from './theme.js';
import { createUnlock } from './unlock.js';
import { foamMaterial, printMaterial } from './materials.js';
import { printTexture, tableTexture, shadowTexture, dottedFrameTexture, targetTexture } from './textures.js';
import { PRESETS, loadPreset, pictureFromImage } from './pictures.js';
import { createSparkles } from './sparkles.js';
import { createSoften } from './soften.js';
import { wakeAudio, soundLift, soundLand, soundSnap, soundDone, startMusic, stopMusic } from './audio.js';

// ─── Tunables ────────────────────────────────────────────────────────────
const PIECES = 24; // roughly; the grid follows the picture's shape
const THICK = 0.25; // straight foam wall, in piece widths
// A soft round-over on every edge, top and bottom: taller than it is deep, so
// it reads as rounded from above without opening wide grooves at the seams.
const ROUND_H = 0.075;
const ROUND_W = 0.035;
// Neighbours don't sit flush: each piece is pulled in by a hair and its
// corners are rounded, so joined pieces still read as separate on the sides.
const GAP = 0.007;
const CORNER = 0.035;
const HEIGHT = THICK + 2 * ROUND_H;
const CARD_T = 0.035; // the print wraps the top half of the round-over; foam shows the rest
const BACK_T = 0.05; // backing card around the rounded bottom edge
const LIFT = 0.42; // how high a held piece floats
const HOVER = 0.025;
const SNAP_R = 0.24; // how close counts as "it fits"
const MAGNET_R = 0.42; // where the pull starts while you're still holding it
const GRAVITY = 26;
const SPREAD = 3.3; // table area per loose piece, in piece widths²
const LIGHT = new THREE.Vector3(-2.4, 6, 2.2); // key light; shadows fall away from it

// ─── Renderer, scene, camera ─────────────────────────────────────────────
const canvas = document.getElementById('scene');
const hint = document.getElementById('hint');
const fileInput = document.getElementById('file');
const musicButton = document.getElementById('music');
const themeButton = document.getElementById('theme');
const uploadButton = document.getElementById('upload');
const presetBar = document.getElementById('presets');
const scatterButton = document.getElementById('scatter');

// Antialiasing happens in the softening pass's multisampled target instead.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;

// On 1× screens render at 1.5× and let the browser scale down, on top of
// MSAA and the softening pass. The quality guard backs off if a machine
// can't keep up.
const native = window.devicePixelRatio || 1;
const maxDpr = native < 1.5 ? 1.5 : Math.min(native, 2);
renderer.setPixelRatio(maxDpr);
const soften = createSoften(renderer);
const quality = createQualityGuard(maxDpr, (ratio) => {
  renderer.setPixelRatio(ratio);
  soften.resize();
});

const scene = new THREE.Scene();
let theme = savedTheme();
scene.background = new THREE.Color(THEMES[theme].table.edge);

// Soft, even light: a dim environment for gentle shading, a broad sky fill,
// and one warm key for direction. Nothing strong enough to glint.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fbf8f2', '#d8d2c6', 0.7));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.copy(LIGHT);
scene.add(key);
const fill = new THREE.DirectionalLight('#dfe8ff', 0.35);
fill.position.set(3, 2, 4);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const ELEV = THREE.MathUtils.degToRad(52);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshBasicMaterial({ map: tableTexture(THEMES[theme].table.center, THEMES[theme].table.edge), toneMapped: false })
);
table.rotation.x = -Math.PI / 2;
scene.add(table);

// ─── The board ───────────────────────────────────────────────────────────
// The current puzzle's grid: columns, rows, cell size and overall size.
const board = { cols: 6, rows: 4, cw: 1, ch: 1, w: 6, d: 4 };

let print = printTexture(renderer, 1.5);
let picture = null;
let solvedAt = null; // performance.now() when the last piece went in
const sparkles = createSparkles(scene);
const topMat = printMaterial(print);
const sideMat = foamMaterial({ top: HEIGHT, cardT: CARD_T, backT: BACK_T, print, sheet: new THREE.Vector2(6, 4), pad: 0 });
const shadowTint = new THREE.Color(THEMES[theme].shadow);
let shadowPlane = null;
let shadowSize = 2.2;

const uvGen = {
  generateTopUV(_g, v, a, b, c) {
    return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / board.w, v[i * 3 + 1] / board.d));
  },
  generateSideWallUV() {
    return [0, 0, 0, 0].map(() => new THREE.Vector2());
  },
};

// Where piece (c, r) sits in the finished puzzle, centred on the table.
// Sheet y runs away from you.
const layoutOf = (c, r) =>
  new THREE.Vector3((c + 0.5) * board.cw - board.w / 2, 0, -((r + 0.5) * board.ch - board.d / 2));

function buildPiece({ c, r, outline }) {
  const cx = (c + 0.5) * board.cw;
  const cy = (r + 0.5) * board.ch;
  const extrude = (pts) =>
    new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), {
      depth: THICK,
      bevelEnabled: true,
      bevelThickness: ROUND_H,
      bevelSize: ROUND_W,
      bevelOffset: -ROUND_W - GAP,
      bevelSegments: 8,
      UVGenerator: uvGen,
    });
  let geo = extrude(outline);
  // A few cuts have a kink the rounded edge can't follow; soften it and retry.
  for (let tries = 0, pts = outline; tries < 3 && topFlipped(geo, THICK + ROUND_H); tries++) {
    pts = smooth(pts);
    geo.dispose();
    geo = extrude(pts);
  }
  geo.translate(-cx, -cy, ROUND_H);
  geo.rotateX(-Math.PI / 2);
  // Smooth the curved walls but keep the cap edges crisp. The helper hashes
  // positions to 0.01, so run it at 100× to keep the bevel rings apart.
  geo.scale(100, 100, 100);
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(40));
  geo.scale(0.01, 0.01, 0.01);

  // Where this piece was in the uncut foam slab, so pores line up at seams.
  const slab = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < slab.length; i += 3) {
    slab[i] = cx;
    slab[i + 2] = -cy;
  }
  geo.setAttribute('slab', new THREE.BufferAttribute(slab, 3));

  const mesh = new THREE.Mesh(geo, [topMat, sideMat]);

  const local = outline.map(([x, y]) => [x - cx, y - cy]);
  const shadowOf = (blur, order) => {
    const m = new THREE.Mesh(
      shadowPlane,
      new THREE.MeshBasicMaterial({
        color: shadowTint,
        alphaMap: shadowTexture(local, shadowSize, blur),
        transparent: true,
        depthWrite: false,
      })
    );
    m.renderOrder = order;
    return m;
  };

  const piece = {
    c,
    r,
    mesh,
    soft: shadowOf(0.12, 1),
    contact: shadowOf(0.035, 2),
    layout: layoutOf(c, r),
    offset: new THREE.Vector3(),
    cluster: null,
    // Foam squish lives on each piece, so a big slab ripples instead of stretching.
    squash: 0,
    squashV: 0,
    kicks: [],
  };
  mesh.userData.piece = piece;
  return piece;
}

function disposePiece(p) {
  p.mesh.geometry.dispose();
  for (const s of [p.soft, p.contact]) {
    s.material.alphaMap.dispose();
    s.material.dispose();
  }
}

let pieces = [];
let meshes = [];
let byCell = new Map();
let clusters = [];
let simTime = 0;

// ─── The dotted area ─────────────────────────────────────────────────────
// Where the finished puzzle goes, a little bigger than it. Loose pieces lie
// in a ring around it.
const ZONE_PAD = 0.45;
const RING = 1.7; // loose pieces keep this far outside the dotted line
const zone = { w: 0, d: 0, z: 0, mesh: null };
let reach = 0.7; // a piece's half-width including its knobs

function buildZone() {
  if (zone.mesh) {
    scene.remove(zone.mesh);
    zone.mesh.geometry.dispose();
    zone.mesh.material.map.dispose();
    zone.mesh.material.dispose();
    const old = zone.mesh.children[0];
    old.geometry.dispose();
    old.material.map.dispose();
    old.material.dispose();
  }
  // Seen from above at an angle, the board's top face sits further up the
  // screen than its footprint. Give the far side that much extra room so
  // the padding looks even all round.
  const lean = HEIGHT / Math.tan(ELEV);
  zone.w = board.w + ZONE_PAD * 2;
  zone.d = board.d + ZONE_PAD * 2 + lean;
  zone.z = -lean / 2;
  const pad = 0.1;
  const tex = dottedFrameTexture(zone.w, zone.d, pad, THEMES[theme].dots);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  zone.mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(zone.w + pad * 2, zone.d + pad * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
  );
  zone.mesh.position.set(0, 0.001, zone.z);
  // The spot the finished picture fills: a soft shaded patch, so nobody takes
  // the dotted line for the place to build.
  const target = new THREE.Mesh(
    new THREE.PlaneGeometry(board.w, board.d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: targetTexture(board.w, board.d, THEMES[theme].dots, theme === 'dark' ? 0.1 : 0.28), transparent: true, depthWrite: false, toneMapped: false })
  );
  target.position.set(0, 0.0005, -zone.z);
  zone.mesh.add(target);
  scene.add(zone.mesh);
}

// ─── Building a puzzle ───────────────────────────────────────────────────
// Cuts a new puzzle in the picture's shape and prints the picture on it.
function buildPuzzle(pic) {
  picture = pic;
  solvedAt = null;
  sparkles.clear();
  Object.assign(board, gridFor(pic.aspect, PIECES));
  board.w = board.cols * board.cw;
  board.d = board.rows * board.ch;
  reach = 0.5 * Math.max(board.cw, board.ch) + 0.2;

  clusters.forEach((cl) => cl.dispose());
  clusters = [];
  pieces.forEach(disposePiece);
  shadowPlane?.dispose();
  shadowSize = 2.2 * Math.max(board.cw, board.ch);
  shadowPlane = new THREE.PlaneGeometry(shadowSize, shadowSize).rotateX(-Math.PI / 2);

  const old = print;
  print = printTexture(renderer, board.w / board.d);
  print.userData.paint(pic, 0);
  topMat.map = print;
  sideMat.userData.uniforms.uPrint.value = print;
  sideMat.userData.uniforms.uSheet.value.set(board.w, board.d);
  old?.dispose();

  const cut = cutPuzzle(board.cols, board.rows, { seed: 11 + Math.floor(Math.random() * 1000), outerTabs: false, corner: CORNER });
  pieces = cut.map(({ c, r, outline }) =>
    buildPiece({ c, r, outline: outline.map(([x, y]) => [x * board.cw, y * board.ch]) })
  );
  meshes = pieces.map((p) => p.mesh);
  byCell = new Map(pieces.map((p) => [`${p.c},${p.r}`, p]));
  hint.textContent = `${pieces.length} pieces · build it inside the dots`;

  buildZone();
  fitCamera();
  scatter();
}

// ─── Light and dark ──────────────────────────────────────────────────────
// Light is the default. Switching repaints the table, the shadows and the
// dotted area, including the puzzles parked behind other pictures.
function applyTheme(name) {
  theme = name;
  const t = THEMES[name];
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.browser);
  themeButton.setAttribute('aria-label', name === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');

  scene.background.set(t.table.edge);
  table.material.map.dispose();
  table.material.map = tableTexture(t.table.center, t.table.edge);
  table.material.needsUpdate = true;

  shadowTint.set(t.shadow);
  const everyPiece = [pieces, ...[...parked.values()].map((k) => k.pieces)].flat();
  for (const p of everyPiece) {
    p.soft.material.color.copy(shadowTint);
    p.contact.material.color.copy(shadowTint);
  }
  if (zone.mesh) buildZone();
  wake();
}
themeButton.addEventListener('click', () => {
  const next = theme === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  applyTheme(next);
});

// ─── Keeping each picture's puzzle ───────────────────────────────────────
// Switching pictures parks the current puzzle as it is (pieces where they
// lie, joined groups, locks, solved or not) and brings it back on return.
// Uploads aren't kept: switching away from one, or uploading another, drops it.
const parked = new Map();
const presetPictures = new Set();

function discard(k) {
  k.clusters.forEach((cl) => cl.dispose());
  k.pieces.forEach(disposePiece);
  k.shadowPlane?.dispose();
  k.print?.dispose();
}

function park() {
  if (!picture) return;
  held = null;
  hovered = null;
  pointerId = null;
  document.body.classList.remove('grabbing', 'can-grab');
  for (const cl of clusters) {
    if (cl.held) {
      cl.held = false;
      cl.liftTo = 0;
    }
    scene.remove(cl.root);
  }
  const keep = {
    board: { ...board },
    pieces,
    meshes,
    byCell,
    clusters,
    print,
    reach,
    shadowPlane,
    shadowSize,
    solvedFor: solvedAt === null ? null : performance.now() - solvedAt,
  };
  if (presetPictures.has(picture)) parked.set(picture, keep);
  else discard(keep);
  pieces = [];
  meshes = [];
  byCell = new Map();
  clusters = [];
  print = null;
  shadowPlane = null;
}

// Show a picture's puzzle: the parked one if there is one, else a fresh cut.
function show(pic) {
  park();
  sparkles.clear();
  const k = parked.get(pic);
  if (!k) {
    buildPuzzle(pic);
    return;
  }
  parked.delete(pic);
  picture = pic;
  Object.assign(board, k.board);
  ({ pieces, meshes, byCell, clusters, print, reach, shadowPlane, shadowSize } = k);
  clusters.forEach((cl) => scene.add(cl.root));
  topMat.map = print;
  sideMat.userData.uniforms.uPrint.value = print;
  sideMat.userData.uniforms.uSheet.value.set(board.w, board.d);
  solvedAt = k.solvedFor === null ? null : performance.now() - k.solvedFor;
  buildZone();
  fitCamera();
  clusters.forEach((cl) => {
    if (cl.locked) return;
    keepOnScreen(cl, cl.target);
    keepOnScreen(cl, cl.pos);
  });
  setDone(clusters.length === 1);
  wake();
}

// ─── Camera and what's on screen ─────────────────────────────────────────
// The table takes the screen's shape, then the camera backs off until all of
// it is in frame.
const area = { w: 8, d: 6 };
const corner = new THREE.Vector3();

function fitCamera() {
  const total = zone.w * zone.d + pieces.length * SPREAD;
  const a = THREE.MathUtils.clamp(camera.aspect * 1.05, 0.75, 2.2);
  area.w = Math.max(Math.sqrt(total * a), zone.w + 2 * RING);
  area.d = Math.max(total / area.w, zone.d + 2 * RING);

  const fits = (dist) => {
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corner.set((sx * area.w) / 2, 0, (sz * area.d) / 2).project(camera);
        if (Math.abs(corner.x) > 0.94 || corner.y > 0.8 || corner.y < -0.84) return false;
      }
    }
    return true;
  };
  let lo = 2;
  let hi = 120;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  fits(hi);
  measureView();
}

// What the screen shows of a horizontal plane at height h: a trapezoid,
// narrow at the back. Stored as far/near z and the right edge as a line
// x = a + b·z (the view is symmetric, so the left edge is its mirror).
const view = { low: null, high: null };
const viewRay = new THREE.Raycaster();
const viewHit = new THREE.Vector3();
function planeAt(nx, ny, h) {
  viewRay.setFromCamera(new THREE.Vector2(nx, ny), camera);
  viewRay.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), viewHit);
  return viewHit.clone();
}
function trapezoid(h) {
  // A small margin, plus room for the words at top and bottom.
  const far = planeAt(0.97, 0.8, h);
  const near = planeAt(0.97, -0.86, h);
  const b = (near.x - far.x) / (near.z - far.z);
  return { zFar: far.z, zNear: near.z, a: far.x - far.z * b, b };
}
function measureView() {
  view.low = trapezoid(0);
  view.high = trapezoid(LIFT + HEIGHT + 0.05);
}

// The footprint of a cluster around its origin, knobs included.
function footprint(cl) {
  const f = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of cl.pieces) {
    f.x0 = Math.min(f.x0, p.offset.x - reach);
    f.x1 = Math.max(f.x1, p.offset.x + reach);
    f.z0 = Math.min(f.z0, p.offset.z - reach);
    f.z1 = Math.max(f.z1, p.offset.z + reach);
  }
  return f;
}

// Keep a whole cluster on screen, whether it's lying down or held up high:
// its far edge under the top of the screen, its near edge above the bottom,
// and its sides inside the narrowing left and right edges.
function keepOnScreen(cl, v) {
  const f = cl.foot || (cl.foot = footprint(cl));
  for (const t of [view.low, view.high]) {
    const zMin = t.zFar - f.z0;
    const zMax = t.zNear - f.z1;
    v.y = zMin > zMax ? (zMin + zMax) / 2 : THREE.MathUtils.clamp(v.y, zMin, zMax);
    // The far corners are the tightest: the screen is narrowest there.
    const half = t.a + t.b * (v.y + f.z0);
    const xMin = -half - f.x0;
    const xMax = half - f.x1;
    v.x = xMin > xMax ? (xMin + xMax) / 2 : THREE.MathUtils.clamp(v.x, xMin, xMax);
  }
  return v;
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  soften.resize();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  fitCamera();
  clusters.forEach((cl) => {
    if (cl.locked) return;
    keepOnScreen(cl, cl.target);
    keepOnScreen(cl, cl.pos);
  });
  wake();
}

// ─── Scatter ─────────────────────────────────────────────────────────────
// Random spots around the dotted area (dart throwing): far enough apart,
// outside the ring, and fully on screen. Loosens the spacing if the screen
// is tight rather than ever piling pieces up.
function slots(n) {
  const probe = { foot: { x0: -reach, x1: reach, z0: -reach, z1: reach } };
  const v = new THREE.Vector2();
  const outsideZone = (x, z) => Math.abs(x) > zone.w / 2 + RING * 0.75 || Math.abs(z - zone.z) > zone.d / 2 + RING * 0.75;
  let best = [];
  for (let gap = 1.6; gap >= 1.15; gap -= 0.05) {
    const out = [];
    for (let tries = 0; tries < 6000 && out.length < n; tries++) {
      v.set((Math.random() - 0.5) * area.w * 1.3, (Math.random() - 0.5) * area.d * 1.3);
      const x = v.x;
      const z = v.y;
      keepOnScreen(probe, v);
      if (v.x !== x || v.y !== z) continue; // would poke off screen
      if (!outsideZone(x, z)) continue;
      if (out.every(([ox, oz]) => Math.hypot(x - ox, z - oz) >= gap)) out.push([x, z]);
    }
    if (out.length === n) return out;
    if (out.length > best.length) best = out;
  }
  // Last resort on a very small screen: whatever fits, the rest on the rim.
  while (best.length < n) {
    const a = Math.random() * Math.PI * 2;
    v.set(Math.cos(a) * area.w, Math.sin(a) * area.d);
    keepOnScreen(probe, v);
    best.push([v.x, v.y]);
  }
  return best;
}

function scatter(pop = false) {
  const spots = slots(pieces.length);
  const from = pieces.map((p) =>
    p.cluster && !p.cluster.dead ? new THREE.Vector2(p.cluster.pos.x + p.offset.x, p.cluster.pos.y + p.offset.z) : null
  );
  clusters.forEach((cl) => cl.dispose());
  clusters = pieces.map((p, i) => {
    const [x, z] = spots[i];
    const cl = new Cluster(scene, x, z);
    if (pop && from[i]) {
      cl.pos.copy(from[i]);
      cl.liftV = 2.2 + Math.random() * 1.2;
      p.squashV = -2;
    }
    p.kicks = [];
    cl.add(p, new THREE.Vector3());
    return cl;
  });
  held = null;
  hovered = null;
  document.body.classList.remove('grabbing', 'can-grab');
  solvedAt = null;
  sparkles.clear();
  print.userData.paint(picture, 0);
  setDone(false);
  wake();
}

// ─── Snapping ────────────────────────────────────────────────────────────
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// The nearest place this cluster would fit, measured from `at`: against a
// neighbouring cluster, or in its own true place on the board.
function findFit(cl, at, { board = true } = {}) {
  const own = cl.ref();
  let best = null;
  if (board) {
    best = { board: true, other: null, want: new THREE.Vector2(own.x, own.z), mine: cl.pieces[0] };
    best.dist = best.want.distanceTo(at);
  }
  for (const p of cl.pieces) {
    for (const [dc, dr] of NEIGHBOURS) {
      const q = byCell.get(`${p.c + dc},${p.r + dr}`);
      if (!q || q.cluster === cl) continue;
      const other = q.cluster;
      const d = cl.ref().sub(other.ref());
      const want = new THREE.Vector2(other.pos.x + d.x, other.pos.y + d.z);
      const dist = want.distanceTo(at);
      if (!best || dist < best.dist) best = { board: false, other, want, dist, mine: p, theirs: q };
    }
  }
  return best;
}

// A squish that travels outward from `origin`, one piece at a time.
function ripple(cl, origin, strength, speed, delay = 0) {
  for (const p of cl.pieces) {
    const d = p.offset.distanceTo(origin);
    const amount = -strength * Math.max(0.25, Math.exp(-d * 0.55));
    p.kicks.push({ at: simTime + delay + d / speed, amount });
  }
}

function absorb(from, into) {
  const ref = into.ref();
  for (const p of from.pieces) into.add(p, p.layout.clone().sub(ref));
  from.pieces = [];
  from.dead = true;
  from.dispose();
  clusters = clusters.filter((c) => c !== from);
  into.locked = into.locked || from.locked;
  into.recenter();
}

// A cluster has just come to rest in a fit: join it up, take in anything
// that now lines up with it, and lock it if it sits in its true place.
function seat(cl, fit) {
  let into = cl;
  if (!fit.board) {
    // The still cluster absorbs the moving one, so the board doesn't jump.
    into = fit.other;
    absorb(cl, into);
  }
  for (;;) {
    const more = findFit(into, into.pos, { board: false });
    if (!more || more.dist > 0.03) break;
    absorb(more.other, into);
  }
  const own = into.ref();
  if (into.pos.distanceTo(tmp2.set(own.x, own.z)) < 0.03) into.locked = true;
  const seam = fit.mine.offset.clone();
  ripple(into, seam, 3.2, 14);
  into.tiltV.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
  if (into.locked) {
    into.liftTo = 0;
    into.target.copy(into.pos);
  }
  soundSnap();
  navigator.vibrate?.(12);
  if (clusters.length === 1) {
    // Finished: one slow wave across the whole board.
    ripple(into, seam, 1.6, 6, 0.18);
    soundDone();
    sparkles.burst(into.pos.x, into.pos.y, board.w, board.d);
    // Animated pictures come alive; stills stay still.
    if (picture.animated) solvedAt = performance.now();
    setDone(true);
  }
}

// ─── Input ───────────────────────────────────────────────────────────────
let held = null;
let hovered = null;
let pointerId = null;
const grab = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function pointerNdc(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
}

function onPlane(x, y, height) {
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  plane.constant = -height;
  return raycaster.ray.intersectPlane(plane, hit);
}

// The loose cluster under the pointer. Pieces locked into the board are
// solid but can't be picked up, so a click on them does nothing.
function pick(e) {
  const [x, y] = pointerNdc(e);
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const cl = hits[0].object.userData.piece.cluster;
  return cl.locked ? null : cl;
}

canvas.addEventListener('pointerdown', (e) => {
  wakeAudio();
  if (musicOn) startMusic();
  if (held) return;
  const cl = pick(e);
  if (!cl) return;
  held = cl;
  pointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  cl.held = true;
  cl.snap = null;
  cl.liftTo = LIFT;
  // Pinched where you grabbed it.
  const [x, y] = pointerNdc(e);
  const p = onPlane(x, y, LIFT);
  if (p) grab.set(cl.pos.x - p.x, cl.pos.y - p.z);
  const g = p ? new THREE.Vector3(p.x - cl.pos.x, 0, p.z - cl.pos.y) : new THREE.Vector3();
  ripple(cl, g, 2.4, 18);
  soundLift();
  document.body.classList.add('grabbing');
  hint.classList.add('gone');
  wake();
});

canvas.addEventListener('pointermove', (e) => {
  if (held && e.pointerId === pointerId) {
    const [x, y] = pointerNdc(e);
    const p = onPlane(x, y, LIFT);
    if (p) keepOnScreen(held, held.target.set(p.x + grab.x, p.z + grab.y));
    wake();
    return;
  }
  if (e.pointerType === 'mouse') {
    const cl = pick(e);
    if (cl !== hovered) {
      if (hovered && !hovered.held && !hovered.snap) hovered.liftTo = 0;
      hovered = cl;
      if (cl && !cl.snap) cl.liftTo = HOVER;
      document.body.classList.toggle('can-grab', !!cl);
      wake();
    }
  }
});

function release(e) {
  if (!held || e.pointerId !== pointerId) return;
  const cl = held;
  held = null;
  pointerId = null;
  cl.held = false;
  cl.liftTo = cl === hovered ? HOVER : 0;
  cl.droppedAt = simTime;
  // Judge by where the piece actually is (the magnet may have moved it).
  const fit = findFit(cl, cl.pos);
  if (fit && fit.dist < SNAP_R) {
    cl.snap = fit;
    cl.liftTo = 0; // seating means pressing it all the way down
  }
  document.body.classList.remove('grabbing');
  wake();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ─── Simulation ──────────────────────────────────────────────────────────
function spring(x, v, to, k, zeta, dt) {
  const c = 2 * zeta * Math.sqrt(k);
  v += (k * (to - x) - c * v) * dt;
  return [x + v * dt, v];
}

const tmp2 = new THREE.Vector2();

function wantOf(cl, fit) {
  if (fit.board) {
    const own = cl.ref();
    return fit.want.set(own.x, own.z);
  }
  const d = cl.ref().sub(fit.other.ref());
  return fit.want.set(fit.other.pos.x + d.x, fit.other.pos.y + d.z);
}

function step(cl, dt) {
  // Slide.
  let to = cl.target;
  if (cl.held) {
    // Within reach of a fit, lean the piece towards it so you feel the pull.
    const fit = findFit(cl, cl.target);
    if (fit && fit.dist < MAGNET_R) {
      const pull = Math.pow(1 - fit.dist / MAGNET_R, 2) * 0.55;
      to = keepOnScreen(cl, tmp2.copy(cl.target).lerp(fit.want, pull));
    }
  } else if (cl.snap) {
    to = wantOf(cl, cl.snap);
    cl.target.copy(to);
  }
  const prevX = cl.pos.x;
  const prevZ = cl.pos.y;
  cl.pos.lerp(to, 1 - Math.exp(-dt * (cl.snap ? 22 : 26)));
  tmp2.set((cl.pos.x - prevX) / dt, (cl.pos.y - prevZ) / dt);
  cl.vel.lerp(tmp2, 1 - Math.exp(-dt * 20));

  // Lift: a spring going up, gravity coming down.
  if (cl.liftTo > cl.lift || cl.held) {
    [cl.lift, cl.liftV] = spring(cl.lift, cl.liftV, cl.liftTo, 240, 0.78, dt);
  } else {
    cl.liftV -= GRAVITY * dt;
    cl.lift += cl.liftV * dt;
    if (cl.lift <= cl.liftTo) {
      const impact = -cl.liftV;
      cl.lift = cl.liftTo;
      if (impact > 0.5 && cl.liftTo === 0) {
        for (const p of cl.pieces) p.squashV -= impact * 0.9;
        if (!cl.snap) soundLand(impact / 6);
      }
      cl.liftV = impact > 0.8 ? impact * 0.1 : 0; // foam barely bounces
    }
  }

  // Lean into the motion, more the higher it's held; big slabs lean less.
  const air = THREE.MathUtils.clamp(cl.lift / LIFT, 0, 1);
  const lean = 0.07 / Math.sqrt(cl.pieces.length);
  const tx = THREE.MathUtils.clamp(cl.vel.y * lean, -0.32, 0.32) * air;
  const tz = THREE.MathUtils.clamp(-cl.vel.x * lean, -0.32, 0.32) * air;
  [cl.tilt.x, cl.tiltV.x] = spring(cl.tilt.x, cl.tiltV.x, tx, 170, 0.42, dt);
  [cl.tilt.y, cl.tiltV.y] = spring(cl.tilt.y, cl.tiltV.y, tz, 170, 0.42, dt);

  // Foam squish, per piece.
  for (const p of cl.pieces) {
    if (p.kicks.length) {
      p.kicks = p.kicks.filter((k) => {
        if (k.at > simTime) return true;
        p.squashV += k.amount;
        return false;
      });
    }
    [p.squash, p.squashV] = spring(p.squash, p.squashV, 0, 520, 0.32, dt);
  }

  // Seat it.
  if (cl.snap && cl.lift === 0 && cl.pos.distanceTo(cl.snap.want) < 0.004) {
    cl.pos.copy(cl.snap.want);
    const fit = cl.snap;
    cl.snap = null;
    seat(cl, fit);
  }
}

// A piece dropped on top of another slides off instead of clipping through.
// Only freshly dropped clusters get pushed, so the cost stays tiny.
function separate(dt) {
  const MIN = 1.16 * Math.sqrt(board.cw * board.ch);
  for (const mover of clusters) {
    if (mover.held || mover.snap || mover.locked || mover.lift > 0.05 || simTime - mover.droppedAt > 1.2) continue;
    for (const still of clusters) {
      if (still === mover || still.lift > 0.05 || still.snap) continue;
      for (const p of mover.pieces) {
        for (const q of still.pieces) {
          let dx = mover.pos.x + p.offset.x - (still.pos.x + q.offset.x);
          let dz = mover.pos.y + p.offset.z - (still.pos.y + q.offset.z);
          const d = Math.hypot(dx, dz);
          if (d >= MIN) continue;
          if (d < 1e-4) {
            dx = 1;
            dz = 0;
          } else {
            dx /= d;
            dz /= d;
          }
          const push = (MIN - d) * Math.min(1, dt * 10);
          mover.target.x += dx * push;
          mover.target.y += dz * push;
          keepOnScreen(mover, mover.target);
        }
      }
    }
  }
}

function apply(cl) {
  cl.root.position.set(cl.pos.x, 0, cl.pos.y);
  cl.body.position.y = cl.lift;
  cl.body.rotation.set(cl.tilt.x, 0, cl.tilt.y);
  // Shadows: tight and dark on the table, wide and faint in the air. Even at
  // rest the top edge throws a little shadow away from the light.
  const h = cl.lift + HEIGHT * 0.45;
  const sx = (-LIGHT.x / LIGHT.y) * h;
  const sz = (-LIGHT.z / LIGHT.y) * h;
  const contact = 1 - THREE.MathUtils.smoothstep(cl.lift, 0, 0.06);
  for (const p of cl.pieces) {
    const s = p.squash;
    p.mesh.scale.set(1 - s * 0.3, 1 + s, 1 - s * 0.3);
    p.soft.position.set(p.offset.x + sx, 0.002, p.offset.z + sz);
    p.soft.scale.setScalar(1.02 + cl.lift * 0.3);
    p.soft.material.opacity = 0.42 - cl.lift * 0.3;
    p.contact.position.set(p.offset.x + sx * 0.25, 0.003, p.offset.z + sz * 0.25);
    p.contact.material.opacity = 0.75 * contact;
    p.contact.visible = contact > 0.01;
  }
}

function settled(cl) {
  if (
    cl.held ||
    cl.snap ||
    Math.abs(cl.lift - cl.liftTo) > 1e-4 ||
    Math.abs(cl.liftV) > 1e-3 ||
    cl.pos.distanceTo(cl.target) > 1e-4 ||
    cl.vel.lengthSq() > 1e-6 ||
    cl.tilt.lengthSq() > 1e-7 ||
    cl.tiltV.lengthSq() > 1e-6
  )
    return false;
  return cl.pieces.every((p) => !p.kicks.length && Math.abs(p.squash) < 1e-4 && Math.abs(p.squashV) < 1e-3);
}

// ─── Loop: only draws while something is moving ─────────────────────────
let running = false;
let last = 0;
const bufSize = new THREE.Vector2();

function wake() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  const elapsed = now - last;
  const dt = Math.min(elapsed / 1000, 1 / 30);
  last = now;
  // Fixed substeps keep the springs stable on 30Hz and 144Hz alike.
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  for (let i = 0; i < n; i++) {
    simTime += dt / n;
    separate(dt / n);
    // Copy: a merge mid-step removes clusters from the live list.
    for (const cl of clusters.slice()) if (!cl.dead) step(cl, dt / n);
  }
  clusters.forEach(apply);
  if (solvedAt !== null) print.userData.paint(picture, (now - solvedAt) / 1000);
  const sparkling = sparkles.update(dt, renderer.getDrawingBufferSize(bufSize).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
  soften.render(scene, camera);
  quality(elapsed);

  if (held || sparkling || solvedAt !== null || !clusters.every(settled)) requestAnimationFrame(frame);
  else running = false;
}

// "Use your own image" starts locked (see unlock.js); uploads of every kind
// (button, drop, paste) wait until the code is in.
const paywall = createUnlock(uploadButton, () => {
  hint.textContent = 'unlocked · any PNG or JPEG';
  hint.classList.remove('gone');
});

// ─── Your own image ──────────────────────────────────────────────────────
// A new picture cuts a new puzzle in its shape. Uploads are stills only:
// PNG or JPEG. (Animated pictures are presets.)
const UPLOADABLE = ['image/png', 'image/jpeg'];
async function useImage(file) {
  if (!file) return;
  if (paywall.isLocked()) {
    paywall.open();
    return;
  }
  if (!UPLOADABLE.includes(file.type)) {
    hint.textContent = 'use a PNG or JPEG';
    hint.classList.remove('gone');
    return;
  }
  const pic = await pictureFromImage(file).catch(() => null);
  if (!pic) return;
  show(pic);
  markPreset(-1);
}
fileInput.addEventListener('change', () => {
  useImage(fileInput.files[0]);
  fileInput.value = '';
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dropping');
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dropping');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dropping');
  useImage(e.dataTransfer?.files?.[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => UPLOADABLE.includes(i.type));
  if (item) useImage(item.getAsFile());
});

// ─── Peek at the finished picture ────────────────────────────────────────
// The eye shows what they're supposed to build. Tap anywhere (or Esc) to go back.
const peek = document.getElementById('peek');
const peekCanvas = document.getElementById('peek-canvas');
const peekButton = document.getElementById('peek-open');

function openPeek() {
  if (!picture || !peek.hidden) return;
  // The still, at the board's own shape, however far the puzzle has got.
  const w = 1280;
  peekCanvas.width = w;
  peekCanvas.height = Math.round(w * (board.d / board.w));
  picture.drawStill(peekCanvas.getContext('2d'), peekCanvas.width, peekCanvas.height);
  peekCanvas.style.aspectRatio = `${board.w} / ${board.d}`;
  peek.hidden = false;
  requestAnimationFrame(() => peek.classList.add('is-open'));
}

function closePeek() {
  if (peek.hidden) return;
  peek.classList.remove('is-open');
  setTimeout(() => {
    if (!peek.classList.contains('is-open')) peek.hidden = true;
  }, 230);
  peekButton.focus({ preventScroll: true });
}

peekButton.addEventListener('click', openPeek);
peek.addEventListener('click', closePeek);
window.addEventListener('keydown', (e) => e.key === 'Escape' && closePeek());

// ─── Music ───────────────────────────────────────────────────────────────
// On by default, starting with the first touch (browsers won't play sound
// before one). The choice is remembered on this device.
let musicOn = true;
try {
  musicOn = localStorage.getItem('foam-music') !== 'off';
} catch {}
function showMusic() {
  musicButton.setAttribute('aria-pressed', String(musicOn));
  musicButton.setAttribute('aria-label', musicOn ? 'Music on. Turn off (M)' : 'Music off. Turn on (M)');
  musicButton.title = musicOn ? 'Music on (M)' : 'Music off (M)';
}
function toggleMusic() {
  musicOn = !musicOn;
  try {
    localStorage.setItem('foam-music', musicOn ? 'on' : 'off');
  } catch {}
  wakeAudio();
  if (musicOn) startMusic();
  else stopMusic();
  showMusic();
}
musicButton.addEventListener('click', toggleMusic);
showMusic();

// ─── Words and keys ──────────────────────────────────────────────────────
function setDone(done) {
  if (done) {
    hint.textContent = 'solved · R scatters it again';
    hint.classList.remove('gone');
  } else {
    hint.textContent = `${pieces.length} pieces · build it inside the dots`;
  }
}
scatterButton.addEventListener('click', () => scatter(true));

// Three pictures to choose from, each with a thumbnail painted from itself.
PRESETS.forEach((entry, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset';
  b.setAttribute('aria-pressed', 'false');
  const thumb = document.createElement('canvas');
  thumb.height = 88;
  thumb.width = 132;
  const label = document.createElement('span');
  label.textContent = entry.name;
  b.append(thumb, label);
  loadPreset(entry)
    .then((pic) => {
      presetPictures.add(pic);
      thumb.width = Math.round(44 * pic.aspect) * 2;
      pic.draw(thumb.getContext('2d'), thumb.width, thumb.height, 0);
    })
    .catch(() => b.remove());
  b.addEventListener('click', async () => {
    const pic = await loadPreset(entry).catch(() => null);
    if (!pic || picture === pic) return;
    show(pic);
    markPreset(i);
  });
  presetBar.append(b);
});
function markPreset(index) {
  [...presetBar.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
}
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') scatter(true);
  if (e.key === 'm' || e.key === 'M') toggleMusic();
});

// ─── Start ───────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
applyTheme(theme);
renderer.setSize(window.innerWidth, window.innerHeight, false);
soften.resize();
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
// Start on the first preset; if its file can't load, the next one.
(async () => {
  for (let i = 0; i < PRESETS.length; i++) {
    const pic = await loadPreset(PRESETS[i]).catch(() => null);
    if (!pic) continue;
    presetPictures.add(pic);
    show(pic);
    markPreset(i);
    return;
  }
})();
document.fonts?.ready.then(() => document.body.classList.add('ready'));
setTimeout(() => document.body.classList.add('ready'), 400);

// ?debug exposes internals for scripted tests.
if (new URLSearchParams(location.search).has('debug')) {
  window.__foam = {
    THREE,
    camera,
    LIFT,
    HEIGHT,
    pieces: () => pieces,
    clusters: () => clusters,
    stats: () => renderer.info.render,
    dpr: () => renderer.getPixelRatio(),
    picture: () => picture,
    solvedAt: () => solvedAt,
    sparkle: () => {
      sparkles.burst(0, 0, board.w, board.d);
      wake();
    },
  };
}
