import * as THREE from 'three';

// Little four-point stars that pop up around the finished board, drift
// upward, twinkle and fade. One draw call for all of them.

const MAX = 110;

function starTexture() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const c = s / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.18, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  // Four slender points with curved sides.
  ctx.moveTo(c, 2);
  ctx.quadraticCurveTo(c + 4, c - 4, s - 2, c);
  ctx.quadraticCurveTo(c + 4, c + 4, c, s - 2);
  ctx.quadraticCurveTo(c - 4, c + 4, 2, c);
  ctx.quadraticCurveTo(c - 4, c - 4, c, 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COLORS = ['#ffc94d', '#ffd77a', '#ffe7a3', '#ffb3c8', '#ffffff'].map((c) => new THREE.Color(c));

export function createSparkles(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: starTexture() }, scale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      attribute vec3 tint;
      varying float vAlpha;
      varying vec3 vColor;
      uniform float scale;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z;
        gl_Position = projectionMatrix * mv;
        vAlpha = alpha;
        vColor = tint;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        // A faint warm rim so white stars still read on a pale table.
        vec3 c = mix(vColor * 0.7, vColor, t.r);
        gl_FragColor = vec4(c, t.a * vAlpha);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  let parts = [];

  return {
    // Scatter stars around a w × d board centred at (cx, cz).
    burst(cx, cz, w, d, count = 100) {
      parts = [];
      for (let i = 0; i < Math.min(count, MAX); i++) {
        // Mostly along the edge, a few over the picture.
        const edge = Math.random() < 0.75;
        let x;
        let z;
        if (edge) {
          const k = Math.random() * 2 * (w + d);
          if (k < w) [x, z] = [k - w / 2, -d / 2];
          else if (k < w + d) [x, z] = [w / 2, k - w - d / 2];
          else if (k < 2 * w + d) [x, z] = [k - w - d - w / 2, d / 2];
          else [x, z] = [-w / 2, k - 2 * w - d - d / 2];
          x += (Math.random() - 0.5) * 0.5;
          z += (Math.random() - 0.5) * 0.5;
        } else {
          x = (Math.random() - 0.5) * w * 0.9;
          z = (Math.random() - 0.5) * d * 0.9;
        }
        parts.push({
          x: cx + x,
          z: cz + z,
          y: 0.3 + Math.random() * 0.4,
          vy: 0.25 + Math.random() * 0.5,
          drift: (Math.random() - 0.5) * 0.2,
          delay: Math.random() * 1.4,
          life: 1.1 + Math.random() * 1.3,
          size: 0.16 + Math.random() * 0.22, // world units
          spin: Math.random() * Math.PI * 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          age: 0,
        });
      }
    },
    clear() {
      parts = [];
      geo.setDrawRange(0, 0);
    },
    // Advance; returns true while anything is still visible.
    update(dt, pixelScale) {
      mat.uniforms.scale.value = pixelScale;
      let n = 0;
      for (const p of parts) {
        p.age += dt;
        const t = p.age - p.delay;
        if (t < 0 || t > p.life) continue;
        const k = t / p.life;
        p.y += p.vy * dt;
        p.x += p.drift * dt;
        pos[n * 3] = p.x;
        pos[n * 3 + 1] = p.y;
        pos[n * 3 + 2] = p.z;
        col[n * 3] = p.color.r;
        col[n * 3 + 1] = p.color.g;
        col[n * 3 + 2] = p.color.b;
        // Pop in, twinkle, shrink away.
        const pop = Math.min(1, t / 0.12);
        const twinkle = 0.75 + 0.25 * Math.sin(p.spin + t * 18);
        size[n] = p.size * pop * twinkle * (1 - k * 0.6);
        alpha[n] = pop * (1 - k * k);
        n++;
      }
      parts = parts.filter((p) => p.age < p.delay + p.life);
      geo.setDrawRange(0, n);
      for (const name of ['position', 'tint', 'size', 'alpha']) geo.attributes[name].needsUpdate = true;
      return parts.length > 0;
    },
  };
}
