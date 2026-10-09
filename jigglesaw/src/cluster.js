import * as THREE from 'three';

// A cluster is whatever moves together: one loose piece, or several that
// have snapped. `root` slides on the table; `body` lifts and tilts. A cluster
// seated in its true place on the board is locked until the next scatter.
export class Cluster {
  constructor(scene, x, z) {
    this.scene = scene;
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
    this.locked = false;
    this.droppedAt = -1e9;
    this.foot = null; // cached footprint, cleared whenever pieces move
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

  // The layout point that this cluster's origin stands for. When the
  // cluster's position equals it, every piece is in its true place.
  ref() {
    const p = this.pieces[0];
    return p.layout.clone().sub(p.offset);
  }

  // Move the origin to the middle of the pieces, so it tilts about its centre.
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
    this.scene.remove(this.root);
  }
}
