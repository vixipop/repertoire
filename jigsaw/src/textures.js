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
// It starts as a painted lake and can be swapped for any image.
export function printTexture(renderer, aspect) {
  const w = 2048;
  const h = Math.round(w / aspect);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  paintLake(ctx, w, h);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Cover-crop an image onto the sheet, like a photo printed edge to edge.
  tex.userData.setImage = (img) => {
    const iw = img.width;
    const ih = img.height;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    tex.needsUpdate = true;
  };
  return tex;
}

function paintLake(ctx, w, h) {
  const horizon = h * 0.52;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5f8fc4');
  sky.addColorStop(0.55, '#a9c3dc');
  sky.addColorStop(1, '#f6d6ae');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  const sun = ctx.createRadialGradient(w * 0.66, horizon - h * 0.06, 0, w * 0.66, horizon - h * 0.06, h * 0.5);
  sun.addColorStop(0, 'rgba(255,240,205,1)');
  sun.addColorStop(0.08, 'rgba(255,226,170,0.95)');
  sun.addColorStop(0.35, 'rgba(255,205,150,0.25)');
  sun.addColorStop(1, 'rgba(255,205,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, horizon);

  const ridge = (base, amp, freq, seed, color) => {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 8) {
      const t = x / w;
      const y =
        base -
        amp * (0.55 * Math.sin(t * freq + seed) + 0.3 * Math.sin(t * freq * 2.3 + seed * 1.7) + 0.15 * Math.sin(t * freq * 5.1 + seed * 0.3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(horizon - h * 0.1, h * 0.08, 7, 1.2, '#8ea6c4');
  ridge(horizon - h * 0.05, h * 0.06, 11, 4.1, '#5f7f94');
  ridge(horizon - h * 0.01, h * 0.03, 17, 2.5, '#3f5f5a');

  const water = ctx.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#e9c9a2');
  water.addColorStop(0.25, '#8fb0c8');
  water.addColorStop(1, '#2f5675');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Glitter path under the sun.
  for (let i = 0; i < 520; i++) {
    const t = Math.random();
    const y = horizon + 4 + t * t * (h - horizon) * 0.9;
    const spread = 20 + t * w * 0.16;
    const x = w * 0.66 + (Math.random() - 0.5) * spread * 2;
    ctx.fillStyle = `rgba(255,236,200,${0.55 * (1 - t)})`;
    ctx.fillRect(x, y, 6 + Math.random() * 30 * (0.3 + t), 1.5 + t * 3);
  }
  // Ripple lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 90; i++) {
    const t = Math.random();
    const y = horizon + t * t * (h - horizon);
    const x = Math.random() * w;
    const len = 30 + t * 220;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  grain(ctx, w, h, 14);
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
