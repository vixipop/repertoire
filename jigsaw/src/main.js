import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { cutPuzzle } from './shape.js';
import { foamMaterial, printMaterial } from './materials.js';
import { printTexture, tableTexture, shadowTexture } from './textures.js';
import { wakeAudio, soundLift, soundLand, soundSnap, soundDone } from './audio.js';

// ─── Tunables ────────────────────────────────────────────────────────────
const COLS = 6;
const ROWS = 4;
const THICK = 0.34; // foam body, in piece widths
const BEVEL = 0.009; // soft cut edge
const HEIGHT = THICK + 2 * BEVEL;
const CARD_T = 0.011; // printed card on top
const BACK_T = 0.008; // backing card underneath
const LIFT = 0.42; // how high a held piece floats
const HOVER = 0.025;
const SNAP_R = 0.24; // how close counts as "it fits"
const MAGNET_R = 0.42; // where the pull starts while you're still holding it
const GRAVITY = 26;
const SPREAD = 3.3; // table area per piece when scattered, in piece widths²
const LIGHT = new THREE.Vector3(-2.4, 6, 2.2); // key light; shadows fall away from it
const TABLE = { center: '#f3f2ee', edge: '#e2e0da' };

// ─── Renderer, scene, camera ─────────────────────────────────────────────
const canvas = document.getElementById('scene');
const hint = document.getElementById('hint');
const again = document.getElementById('again');
const fileInput = document.getElementById('file');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;

// On 1× screens render at 2× and let the browser scale down: MSAA alone
// leaves thin bright edges stepped. The quality guard below backs off if a
// machine can't keep up.
const native = window.devicePixelRatio || 1;
const maxDpr = native < 1.5 ? 2 : Math.min(native, 2);
let dpr = maxDpr;
renderer.setPixelRatio(dpr);

const scene = new THREE.Scene();
scene.background = new THREE.Color(TABLE.edge);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
pmrem.dispose();

const key = new THREE.DirectionalLight('#fff6ea', 2.1);
key.position.copy(LIGHT);
scene.add(key);
const fill = new THREE.DirectionalLight('#dfe8ff', 0.5);
fill.position.set(3, 2, 4);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const ELEV = THREE.MathUtils.degToRad(52);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshBasicMaterial({ map: tableTexture(TABLE.center, TABLE.edge), toneMapped: false })
);
table.rotation.x = -Math.PI / 2;
scene.add(table);

// ─── Pieces ──────────────────────────────────────────────────────────────
// Every piece is generated from its outline at load: no model files. The
// whole puzzle shares two materials and one print texture.
const print = printTexture(renderer, COLS / ROWS);
const topMat = printMaterial(print);
const sideMat = foamMaterial({
  top: HEIGHT,
  cardT: CARD_T,
  backT: BACK_T,
  print,
  sheet: new THREE.Vector2(COLS, ROWS),
  pad: 0,
});
const shadowTint = new THREE.Color('#2b2418');
const shadowPlane = new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2);

const uvGen = {
  generateTopUV(_g, v, a, b, c) {
    return [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / COLS, v[i * 3 + 1] / ROWS));
  },
  generateSideWallUV() {
    return [0, 0, 0, 0].map(() => new THREE.Vector2());
  },
};

// Where piece (c, r) sits in the finished puzzle, centred on the table.
// Sheet y runs away from you.
const layoutOf = (c, r) => new THREE.Vector3(c + 0.5 - COLS / 2, 0, -(r + 0.5 - ROWS / 2));

function buildPiece({ c, r, outline }) {
  const cx = c + 0.5;
  const cy = r + 0.5;
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: THICK,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 2,
    UVGenerator: uvGen,
  });
  geo.translate(-cx, -cy, BEVEL);
  geo.rotateX(-Math.PI / 2);
  // Smooth the curved walls but keep the cap edges crisp. The helper hashes
  // positions to 0.01, so run it at 100× to keep the bevel rings apart.
  geo.scale(100, 100, 100);
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(50));
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
        alphaMap: shadowTexture(local, 2.2, blur),
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

// A cluster is whatever moves together: one loose piece, or several that
// have snapped. root slides on the table; body lifts and tilts.
class Cluster {
  constructor(x, z) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.shadows = new THREE.Group();
    this.root.add(this.shadows, this.body);
    scene.add(this.root);
    this.pieces = [];
    this.pos = new THREE.Vector2(x, z);
    this.target = this.pos.clone();
    this.vel = new THREE.Vector2();
    this.lift = 0;
    this.liftV = 0;
    this.liftTo = 0;
    this.tilt = new THREE.Vector2(); // x: about the x axis, y: about z
    this.tiltV = new THREE.Vector2();
    this.held = false;
    this.snap = null;
    this.droppedAt = -1e9;
  }
  add(piece, offset) {
    piece.cluster = this;
    piece.offset.copy(offset);
    this.pieces.push(piece);
    this.body.add(piece.mesh);
    this.shadows.add(piece.soft, piece.contact);
    piece.mesh.position.copy(offset);
    this.foot = null;
  }
  // The layout point that this cluster's origin stands for.
  ref() {
    const p = this.pieces[0];
    return p.layout.clone().sub(p.offset);
  }
  recenter() {
    const m = new THREE.Vector3();
    this.pieces.forEach((p) => m.add(p.offset));
    m.divideScalar(this.pieces.length);
    this.pieces.forEach((p) => {
      p.offset.sub(m);
      p.mesh.position.copy(p.offset);
    });
    this.pos.x += m.x;
    this.pos.y += m.z;
    this.target.x += m.x;
    this.target.y += m.z;
    this.foot = null;
  }
  dispose() {
    scene.remove(this.root);
  }
}

const pieces = cutPuzzle(COLS, ROWS, { seed: 11, outerTabs: false }).map(buildPiece);
const byCell = new Map(pieces.map((p) => [`${p.c},${p.r}`, p]));
let clusters = [];
let simTime = 0;

// ─── Table, assembly area and camera ─────────────────────────────────────
// The finished puzzle sits in a dotted area in the middle; loose pieces lie
// in a ring around it. The table takes the screen's shape, then the camera
// backs off until all of it is in frame.
const ZONE = { w: COLS + 0.9, d: ROWS + 0.9 }; // dotted area, a little bigger than the puzzle
const RING = 1.7; // loose pieces keep this far outside the dotted line
const REACH = 0.7; // a piece's half-width including its knobs
const area = { w: 8, d: 6 };
const corner = new THREE.Vector3();

const zone = (() => {
  const ppu = 160;
  const cv = document.createElement('canvas');
  const pad = 0.1;
  cv.width = Math.round((ZONE.w + pad * 2) * ppu);
  cv.height = Math.round((ZONE.d + pad * 2) * ppu);
  const ctx = cv.getContext('2d');
  // Dots walked along a rounded rectangle, evenly spaced, corners included.
  const r = 0.28;
  const x0 = pad;
  const z0 = pad;
  const x1 = pad + ZONE.w;
  const z1 = pad + ZONE.d;
  const path = [];
  const arc = (cx, cz, a0) => {
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * (Math.PI / 2);
      path.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  };
  arc(x1 - r, z0 + r, -Math.PI / 2);
  arc(x1 - r, z1 - r, 0);
  arc(x0 + r, z1 - r, Math.PI / 2);
  arc(x0 + r, z0 + r, Math.PI);
  path.push(path[0]);
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const count = Math.round(total / 0.13);
  const gap = total / count;
  ctx.fillStyle = 'rgba(120, 112, 98, 0.32)';
  let next = 0;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const len = Math.hypot(bx - ax, bz - az);
    while (next <= walked + len && next < total - gap / 2) {
      const t = (next - walked) / len;
      ctx.beginPath();
      ctx.arc((ax + (bx - ax) * t) * ppu, (az + (bz - az) * t) * ppu, 0.017 * ppu, 0, Math.PI * 2);
      ctx.fill();
      next += gap;
    }
    walked += len;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ZONE.w + pad * 2, ZONE.d + pad * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
  );
  mesh.position.y = 0.001;
  scene.add(mesh);
  return mesh;
})();

function fitCamera() {
  const total = ZONE.w * ZONE.d + pieces.length * SPREAD;
  const a = THREE.MathUtils.clamp(camera.aspect * 1.05, 0.75, 2.2);
  area.w = Math.max(Math.sqrt(total * a), ZONE.w + 2 * RING);
  area.d = Math.max(total / area.w, ZONE.d + 2 * RING);

  const fits = (dist) => {
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corner.set(sx * area.w / 2, 0, sz * area.d / 2).project(camera);
        if (Math.abs(corner.x) > 0.94 || corner.y > 0.86 || corner.y < -0.84) return false;
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
  const mx = 0.97;
  const top = 0.86;
  const bottom = -0.86;
  const far = planeAt(mx, top, h);
  const near = planeAt(mx, bottom, h);
  return { zFar: far.z, zNear: near.z, a: far.x - far.z * ((near.x - far.x) / (near.z - far.z)), b: (near.x - far.x) / (near.z - far.z) };
}
function measureView() {
  view.low = trapezoid(0);
  view.high = trapezoid(LIFT + HEIGHT + 0.05);
}

// The footprint of a cluster around its origin, knobs included.
function footprint(cl) {
  const f = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of cl.pieces) {
    f.x0 = Math.min(f.x0, p.offset.x - REACH);
    f.x1 = Math.max(f.x1, p.offset.x + REACH);
    f.z0 = Math.min(f.z0, p.offset.z - REACH);
    f.z1 = Math.max(f.z1, p.offset.z + REACH);
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitCamera();
  clusters.forEach((cl) => {
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
  const probe = { foot: { x0: -REACH, x1: REACH, z0: -REACH, z1: REACH } };
  const v = new THREE.Vector2();
  const outsideZone = (x, z) => Math.abs(x) > ZONE.w / 2 + RING * 0.75 || Math.abs(z) > ZONE.d / 2 + RING * 0.75;
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
  const from = pieces.map((p) => (p.cluster ? new THREE.Vector2(p.cluster.pos.x + p.offset.x, p.cluster.pos.y + p.offset.z) : null));
  clusters.forEach((cl) => cl.dispose());
  clusters = pieces.map((p, i) => {
    const [x, z] = spots[i];
    const cl = new Cluster(x, z);
    if (pop && from[i]) {
      cl.pos.copy(from[i]);
      cl.liftV = 2.2 + Math.random() * 1.2;
      p.squashV = -2;
    }
    cl.add(p, new THREE.Vector3());
    return cl;
  });
  held = null;
  hovered = null;
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

// Nearest place this cluster would fit against any neighbour, measured from `at`.
function findFit(cl, at) {
  let best = null;
  for (const p of cl.pieces) {
    for (const [dc, dr] of NEIGHBOURS) {
      const q = byCell.get(`${p.c + dc},${p.r + dr}`);
      if (!q || q.cluster === cl) continue;
      const other = q.cluster;
      const d = cl.ref().sub(other.ref());
      const want = new THREE.Vector2(other.pos.x + d.x, other.pos.y + d.z);
      const dist = want.distanceTo(at);
      if (!best || dist < best.dist) best = { other, want, dist, mine: p, theirs: q };
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

function merge(from, into, at) {
  const ref = into.ref();
  for (const p of from.pieces) into.add(p, p.layout.clone().sub(ref));
  from.pieces = [];
  from.dead = true;
  from.dispose();
  clusters = clusters.filter((c) => c !== from);
  into.recenter();
  const seam = at.offset.clone();
  ripple(into, seam, 3.2, 14);
  into.tiltV.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);

  // Seating one piece can line up another cluster that was already sitting
  // in the right place: take those in too.
  const more = findFit(into, into.pos);
  if (more && more.dist < 0.03) {
    merge(more.other, into, more.theirs);
    return;
  }

  soundSnap();
  navigator.vibrate?.(12);
  if (clusters.length === 1) {
    // Finished: one slow wave across the whole board.
    ripple(into, seam, 1.6, 6, 0.18);
    soundDone();
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
const meshes = pieces.map((p) => p.mesh);

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

function pick(e) {
  const [x, y] = pointerNdc(e);
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length ? hits[0].object.userData.piece.cluster : null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (held) return;
  wakeAudio();
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
    const d = cl.ref().sub(cl.snap.other.ref());
    cl.snap.want.set(cl.snap.other.pos.x + d.x, cl.snap.other.pos.y + d.z);
    to = cl.snap.want;
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
        soundLand(impact / 6);
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
    const { other, mine } = cl.snap;
    cl.snap = null;
    // The still cluster absorbs the moving one, so the board doesn't jump.
    merge(cl, other, mine);
  }
}

// A piece dropped on top of another slides off instead of clipping through.
// Only freshly dropped clusters get pushed, so the cost stays tiny.
function separate(dt) {
  const MIN = 1.16;
  for (const mover of clusters) {
    if (mover.held || mover.snap || mover.lift > 0.05 || simTime - mover.droppedAt > 1.2) continue;
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
  renderer.render(scene, camera);
  adapt(elapsed);

  if (held || !clusters.every(settled)) requestAnimationFrame(frame);
  else running = false;
}

// Quality guard. Judges 30-frame windows, skips the first second and any
// gap after the loop sleeps (shader compile and wake-up stalls aren't a slow
// machine), and climbs back after three smooth windows — they don't need to
// be consecutive frames, since the loop stops whenever nothing moves.
let seen = 0;
let winMs = 0;
let winN = 0;
let smooth = 0;
function adapt(ms) {
  seen++;
  if (seen < 60 || ms > 200) return;
  winMs += ms;
  winN++;
  if (winN < 30) return;
  const avg = winMs / winN;
  winMs = 0;
  winN = 0;
  if (avg > 24 && dpr > 1) {
    dpr = Math.max(1, dpr - 0.25);
    renderer.setPixelRatio(dpr);
    smooth = 0;
  } else if (avg < 18) {
    if (++smooth >= 3 && dpr < maxDpr) {
      dpr = Math.min(maxDpr, dpr + 0.25);
      renderer.setPixelRatio(dpr);
      smooth = 0;
    }
  } else {
    smooth = 0;
  }
}

// ─── Your own image (debug) ──────────────────────────────────────────────
async function useImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const img = await createImageBitmap(file);
    print.userData.setImage(img);
    img.close?.();
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      print.userData.setImage(img);
      URL.revokeObjectURL(url);
      wake();
    };
    img.src = url;
  }
  wake();
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
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) useImage(item.getAsFile());
});

// ─── Words ───────────────────────────────────────────────────────────────
function setDone(done) {
  again.classList.toggle('shown', done);
}
again.addEventListener('click', () => scatter(true));
window.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) scatter(true);
});

// ─── Start ───────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
resize();
scatter();
document.fonts?.ready.then(() => document.body.classList.add('ready'));
setTimeout(() => document.body.classList.add('ready'), 400);

// ?debug exposes internals for scripted tests.
if (new URLSearchParams(location.search).has('debug')) {
  window.__foam = { THREE, camera, pieces, LIFT, HEIGHT, clusters: () => clusters, stats: () => renderer.info.render, dpr: () => dpr };
}
