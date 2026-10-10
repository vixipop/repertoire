import * as THREE from 'three';

function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// The print spans the whole uncut sheet, so neighbouring pieces continue it.
// 1280 px wide is sharp at any size the board is drawn, and small enough to
// re-upload every frame while a solved picture animates.
export function printTexture(renderer, aspect) {
  const w = 1280;
  const h = Math.round(w / aspect);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let shown = null;
  // Paint a picture at time t; skips the upload when the frame hasn't changed.
  tex.userData.paint = (picture, t) => {
    const key = picture.frame(t);
    if (shown && shown.picture === picture && shown.key === key) return false;
    ctx.clearRect(0, 0, w, h);
    picture.draw(ctx, w, h, t);
    tex.needsUpdate = true;
    shown = { picture, key };
    return true;
  };
  return tex;
}

// Big, flat, slightly warm table with a gentle falloff to the edges.
export function tableTexture(center, edge) {
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, center);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  grain(ctx, s, s, 5);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A blurred silhouette of the piece, used as an alpha map under it.
// Drawn far off-canvas so only its canvas shadow lands — shadowBlur works
// everywhere, unlike ctx.filter.
export function shadowTexture(outline, size, blur) {
  const ppu = 72; // it's a blur — low resolution is invisible and keeps 24+ pieces light
  const px = Math.ceil(size * ppu);
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, px, px);
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = blur * ppu;
  ctx.shadowOffsetX = px * 2;
  ctx.beginPath();
  outline.forEach(([x, y], i) => {
    const cx = x * ppu + px / 2 - px * 2;
    const cy = -y * ppu + px / 2;
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

// The dotted outline of the assembly area: dots walked evenly round a rounded
// rectangle w × d (in table units), corners included, with `pad` of margin,
// in the given colour.
export function dottedFrameTexture(w, d, pad, colour) {
  const ppu = 160;
  const cv = document.createElement('canvas');
  cv.width = Math.round((w + pad * 2) * ppu);
  cv.height = Math.round((d + pad * 2) * ppu);
  const ctx = cv.getContext('2d');
  const r = 0.28;
  const [x0, z0, x1, z1] = [pad, pad, pad + w, pad + d];
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
  const gap = total / Math.round(total / 0.13);
  ctx.fillStyle = colour;
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
  return tex;
}

// A soft shaded patch, no outline, w × d table units, where the
// finished puzzle sits.
export function targetTexture(w, d, colour, strength = 0.28) {
  const ppu = 64;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * ppu);
  cv.height = Math.round(d * ppu);
  const ctx = cv.getContext('2d');
  const inset = 2;
  const r = 0.12 * ppu;
  ctx.beginPath();
  ctx.roundRect(inset, inset, cv.width - inset * 2, cv.height - inset * 2, r);
  ctx.globalAlpha = strength;
  ctx.fillStyle = colour;
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
