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
