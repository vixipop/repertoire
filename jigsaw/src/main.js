import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { cutPuzzle } from './shape.js';
import { foamMaterial, printMaterial } from './materials.js';
import { printTexture, tableTexture, shadowTexture } from './textures.js';
import { wakeAudio, soundLift, soundLand, soundSnap } from './audio.js';

// ─── Tunables ────────────────────────────────────────────────────────────
const COLS = 2;
const ROWS = 1;
const THICK = 0.34; // foam body, in piece widths
const BEVEL = 0.009; // soft cut edge
const HEIGHT = THICK + 2 * BEVEL;
const CARD_T = 0.011; // printed card on top
const BACK_T = 0.008; // backing card underneath
const PAD = 0.35; // print bleed around the sheet, for the outer knobs
const LIFT = 0.42; // how high a held piece floats
const HOVER = 0.025;
const SNAP_R = 0.24; // how close counts as "it fits"
const MAGNET_R = 0.42; // where the pull starts while you're still holding it
const GRAVITY = 26;
const LIGHT = new THREE.Vector3(-2.4, 6, 2.2); // key light; shadows fall away from it
const TABLE = { center: '#f3f2ee', edge: '#e2e0da' };

// ─── Renderer, scene, camera ─────────────────────────────────────────────
const canvas = document.getElementById('scene');
const hint = document.getElementById('hint');
const again = document.getElementById('again');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

let maxDpr = Math.min(window.devicePixelRatio || 1, 2);
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

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const ELEV = THREE.MathUtils.degToRad(52);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ map: tableTexture(TABLE.center, TABLE.edge), toneMapped: false })
);
table.rotation.x = -Math.PI / 2;
table.scale.setScalar(0.5);
scene.add(table);

// ─── Pieces ──────────────────────────────────────────────────────────────
const print = printTexture(renderer, (COLS + 2 * PAD) / (ROWS + 2 * PAD));
const topMat = printMaterial(print);
const sideMat = foamMaterial({
  top: HEIGHT,
  cardT: CARD_T,
  backT: BACK_T,
  print,
  sheet: new THREE.Vector2(COLS + 2 * PAD, ROWS + 2 * PAD),
  pad: PAD,
});
const shadowTint = new THREE.Color('#2b2418');

const uvGen = {
  generateTopUV(_g, v, a, b, c) {
    return [a, b, c].map(
      (i) => new THREE.Vector2((v[i * 3] + PAD) / (COLS + 2 * PAD), (v[i * 3 + 1] + PAD) / (ROWS + 2 * PAD))
    );
  },
  generateSideWallUV() {
    return [0, 0, 0, 0].map(() => new THREE.Vector2());
  },
};

// Where piece (c, r) sits in the finished puzzle. Sheet y runs away from you.
const layoutOf = (c, r) => new THREE.Vector3(c + 0.5, 0, -(r + 0.5));

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
    bevelSegments: 3,
    UVGenerator: uvGen,
  });
  geo.translate(-cx, -cy, BEVEL);
  geo.rotateX(-Math.PI / 2);
  // Smooth the curved walls but keep the cap edges crisp. The helper hashes
  // positions to 0.01, so run it at 100× to keep the bevel rings apart.
  geo.scale(100, 100, 100);
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(50));
  geo.scale(0.01, 0.01, 0.01);

  // Where this piece was in the uncut foam slab, so the pores line up.
  const layout = layoutOf(c, r);
  const slab = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < slab.length; i += 3) {
    slab[i] = layout.x;
    slab[i + 2] = layout.z;
  }
  geo.setAttribute('slab', new THREE.BufferAttribute(slab, 3));

  const mesh = new THREE.Mesh(geo, [topMat, sideMat]);

  const local = outline.map(([x, y]) => [x - cx, y - cy]);
  const size = 2.2;
  const plane = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  const shadowOf = (blur, opacity) =>
    new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        color: shadowTint,
        alphaMap: shadowTexture(local, size, blur),
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
  const soft = shadowOf(0.12, 0.42);
  const contact = shadowOf(0.035, 0.75);
  soft.renderOrder = 1;
  contact.renderOrder = 2;

  const piece = { c, r, mesh, soft, contact, layout, offset: new THREE.Vector3(), cluster: null };
  mesh.userData.piece = piece;
  return piece;
}

// A cluster is whatever moves together: one loose piece, or several that
// have snapped. root slides on the table; body lifts, tilts and squashes.
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
    this.squash = 0;
    this.squashV = 0;
    this.held = false;
    this.snap = null;
    this.droppedAt = 0;
  }
  add(piece, offset) {
    piece.cluster = this;
    piece.offset.copy(offset);
    this.pieces.push(piece);
    this.body.add(piece.mesh);
    this.shadows.add(piece.soft, piece.contact);
    piece.mesh.position.copy(offset);
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
  }
  dispose() {
    scene.remove(this.root);
  }
}

const cut = cutPuzzle(COLS, ROWS, { seed: 11 });
const pieces = cut.map(buildPiece);
let clusters = [];

function scatter(pop = false) {
  clusters.forEach((cl) => cl.dispose());
  const spots = [
    [-1.05, 0.25],
    [1.0, -0.3],
  ];
  clusters = pieces.map((p, i) => {
    const [x, z] = spots[i % spots.length];
    const prev = p.cluster;
    const cl = new Cluster(x, z);
    if (pop && prev) {
      // Fly from where the piece is now.
      const world = new THREE.Vector3(prev.pos.x, 0, prev.pos.y).add(p.offset);
      cl.pos.set(world.x, world.z);
      cl.liftV = 2.6;
      cl.squashV = -2;
    }
    cl.add(p, new THREE.Vector3());
    return cl;
  });
  setDone(false);
  wake();
}
scatter();

// ─── Sizing ──────────────────────────────────────────────────────────────
const bounds = { x: 2, zNear: 1.4, zFar: -1.4 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

function onPlane(nx, ny, y) {
  ndc.set(nx, ny);
  raycaster.setFromCamera(ndc, camera);
  plane.constant = -y;
  return raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Fit roughly 4.6 × 3.2 of table, whichever way the screen is turned.
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const needH = 3.3;
  const needW = 4.8;
  const distH = needH / 2 / Math.tan(vfov / 2);
  const distW = needW / 2 / Math.tan(vfov / 2) / camera.aspect;
  const dist = Math.max(distH, distW) * 1.05;
  camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const near = onPlane(0, -0.82, 0);
  const far = onPlane(0, 0.7, 0);
  const side = onPlane(0.86, 0, 0);
  if (near && far && side) {
    bounds.zNear = near.z;
    bounds.zFar = far.z;
    bounds.x = side.x;
  }
  wake();
}
window.addEventListener('resize', resize);
resize();

// ─── Snapping ────────────────────────────────────────────────────────────
const byCell = new Map(pieces.map((p) => [`${p.c},${p.r}`, p]));
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
      if (!best || dist < best.dist) best = { other, want, dist };
    }
  }
  return best;
}

function merge(from, into) {
  const ref = into.ref();
  for (const p of from.pieces) into.add(p, p.layout.clone().sub(ref));
  from.dispose();
  clusters = clusters.filter((c) => c !== from);
  into.recenter();
  into.squashV -= 3.2;
  into.tiltV.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2);
  soundSnap();
  navigator.vibrate?.(12);
  if (clusters.length === 1) setDone(true);
}

// ─── Input ───────────────────────────────────────────────────────────────
let held = null;
let hovered = null;
const grab = new THREE.Vector2();
let pointerId = null;

function pointerNdc(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
}

function pick(e) {
  const [x, y] = pointerNdc(e);
  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pieces.map((p) => p.mesh), false);
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
  cl.squashV -= 2.4; // pinched
  // Keep the exact spot you grabbed under your finger.
  const [x, y] = pointerNdc(e);
  const p = onPlane(x, y, LIFT);
  if (p) grab.set(cl.pos.x - p.x, cl.pos.y - p.z);
  soundLift();
  document.body.classList.add('grabbing');
  hideHint();
  wake();
});

canvas.addEventListener('pointermove', (e) => {
  if (held && e.pointerId === pointerId) {
    const [x, y] = pointerNdc(e);
    const p = onPlane(x, y, LIFT);
    if (p) {
      held.target.set(
        THREE.MathUtils.clamp(p.x + grab.x, -bounds.x, bounds.x),
        THREE.MathUtils.clamp(p.z + grab.y, bounds.zFar, bounds.zNear)
      );
    }
    wake();
    return;
  }
  if (e.pointerType === 'mouse') {
    const cl = pick(e);
    if (cl !== hovered) {
      if (hovered) hovered.liftTo = 0;
      hovered = cl;
      if (cl) cl.liftTo = HOVER;
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
  cl.droppedAt = performance.now();
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
      to = tmp2.copy(cl.target).lerp(fit.want, pull);
    }
  } else if (cl.snap) {
    const d = cl.ref().sub(cl.snap.other.ref());
    cl.snap.want.set(cl.snap.other.pos.x + d.x, cl.snap.other.pos.y + d.z);
    to = cl.snap.want;
    cl.target.copy(to);
  }
  const prevX = cl.pos.x;
  const prevZ = cl.pos.y;
  const follow = 1 - Math.exp(-dt * (cl.snap ? 22 : 26));
  cl.pos.lerp(to, follow);
  const vx = (cl.pos.x - prevX) / dt;
  const vz = (cl.pos.y - prevZ) / dt;
  cl.vel.lerp(tmp2.set(vx, vz), 1 - Math.exp(-dt * 20));

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
        cl.squashV -= impact * 0.9;
        soundLand(impact / 6);
      }
      cl.liftV = impact > 0.8 ? impact * 0.1 : 0; // foam barely bounces
    }
  }

  // Lean into the motion, more the higher it's held.
  const air = THREE.MathUtils.clamp(cl.lift / LIFT, 0, 1);
  const tx = THREE.MathUtils.clamp(cl.vel.y * 0.07, -0.32, 0.32) * air;
  const tz = THREE.MathUtils.clamp(-cl.vel.x * 0.07, -0.32, 0.32) * air;
  [cl.tilt.x, cl.tiltV.x] = spring(cl.tilt.x, cl.tiltV.x, tx, 170, 0.42, dt);
  [cl.tilt.y, cl.tiltV.y] = spring(cl.tilt.y, cl.tiltV.y, tz, 170, 0.42, dt);

  // Foam squish.
  [cl.squash, cl.squashV] = spring(cl.squash, cl.squashV, 0, 520, 0.32, dt);

  // Seat it.
  if (cl.snap && cl.lift === 0 && cl.pos.distanceTo(cl.snap.want) < 0.004) {
    cl.pos.copy(cl.snap.want);
    const into = cl.snap.other;
    cl.snap = null;
    merge(cl, into);
  }
}

// Pieces dropped on top of each other slide apart instead of clipping.
function separate(dt) {
  const MIN = 1.16;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];
      if (a.held || b.held || a.snap || b.snap || a.lift > 0.05 || b.lift > 0.05) continue;
      const mover = a.droppedAt > b.droppedAt ? a : b;
      const still = mover === a ? b : a;
      for (const p of mover.pieces) {
        for (const q of still.pieces) {
          const px = mover.pos.x + p.offset.x;
          const pz = mover.pos.y + p.offset.z;
          const qx = still.pos.x + q.offset.x;
          const qz = still.pos.y + q.offset.z;
          let dx = px - qx;
          let dz = pz - qz;
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
          mover.target.x = THREE.MathUtils.clamp(mover.target.x + dx * push, -bounds.x, bounds.x);
          mover.target.y = THREE.MathUtils.clamp(mover.target.y + dz * push, bounds.zFar, bounds.zNear);
        }
      }
    }
  }
}

function apply(cl) {
  cl.root.position.set(cl.pos.x, 0, cl.pos.y);
  cl.body.position.y = cl.lift;
  cl.body.rotation.set(cl.tilt.x, 0, cl.tilt.y);
  const s = cl.squash;
  cl.body.scale.set(1 - s * 0.3, 1 + s, 1 - s * 0.3);
  // Shadows: tight and dark on the table, wide and faint in the air.
  // Even at rest the top edge throws a little shadow away from the light.
  const h = cl.lift + HEIGHT * 0.45;
  const sx = (-LIGHT.x / LIGHT.y) * h;
  const sz = (-LIGHT.z / LIGHT.y) * h;
  const contact = 1 - THREE.MathUtils.smoothstep(cl.lift, 0, 0.06);
  for (const p of cl.pieces) {
    p.soft.position.set(p.offset.x + sx, 0.002, p.offset.z + sz);
    p.soft.scale.setScalar(1.02 + cl.lift * 0.3);
    p.soft.material.opacity = 0.42 - cl.lift * 0.3;
    p.contact.position.set(p.offset.x + sx * 0.25, 0.003, p.offset.z + sz * 0.25);
    p.contact.material.opacity = 0.75 * contact;
    p.contact.visible = contact > 0.01;
  }
}

function settled(cl) {
  return (
    !cl.held &&
    !cl.snap &&
    Math.abs(cl.lift - cl.liftTo) < 1e-4 &&
    Math.abs(cl.liftV) < 1e-3 &&
    cl.pos.distanceTo(cl.target) < 1e-4 &&
    cl.vel.lengthSq() < 1e-6 &&
    Math.abs(cl.squash) < 1e-4 &&
    Math.abs(cl.squashV) < 1e-3 &&
    cl.tilt.lengthSq() < 1e-7 &&
    cl.tiltV.lengthSq() < 1e-6
  );
}

// ─── Loop: only draws while something is moving ─────────────────────────
let running = false;
let last = 0;
let slowFrames = 0;
let fastFrames = 0;

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
  const n = Math.ceil(dt / (1 / 240));
  for (let i = 0; i < n; i++) {
    separate(dt / n);
    clusters.forEach((cl) => step(cl, dt / n));
  }
  clusters.forEach(apply);
  renderer.render(scene, camera);
  adapt(elapsed);

  if (held || !clusters.every(settled)) requestAnimationFrame(frame);
  else running = false;
}

// If frames run long, render fewer pixels; climb back once it's smooth.
function adapt(ms) {
  if (ms > 24) slowFrames++;
  else slowFrames = Math.max(0, slowFrames - 1);
  if (ms < 18) fastFrames++;
  else fastFrames = 0;
  if (slowFrames > 20 && dpr > 1) {
    dpr = Math.max(1, dpr - 0.25);
    renderer.setPixelRatio(dpr);
    slowFrames = 0;
  } else if (fastFrames > 240 && dpr < maxDpr) {
    dpr = Math.min(maxDpr, dpr + 0.25);
    renderer.setPixelRatio(dpr);
    fastFrames = 0;
  }
}

// ─── Words ───────────────────────────────────────────────────────────────
function hideHint() {
  hint.classList.add('gone');
}
function setDone(done) {
  again.classList.toggle('shown', done);
}
again.addEventListener('click', () => scatter(true));
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') scatter(true);
});

document.fonts?.ready.then(() => document.body.classList.add('ready'));
setTimeout(() => document.body.classList.add('ready'), 400);
