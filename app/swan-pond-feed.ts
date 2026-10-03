/**
 * A bowl of corn beside the pond. Click it to pick up a handful: the cursor
 * becomes a kernel, and clicks on the water throw corn for the swans.
 * Click the bowl again (or press Esc) to put it down.
 */

import type { PondController } from "./swan-pond-engine";

/** The bowl as plain shapes: only an underpainting, repainted in dabs below. */
function underpainting(ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number) {
  const cx = w / 2;
  const cy = h * 0.48;
  const rx = w * 0.4;
  const ry = h * 0.34;

  // violet shadow pooling on the ground, Monet never painted grey ones
  const sh = ctx.createRadialGradient(cx + w * 0.05, cy + ry * 0.75, 0, cx + w * 0.05, cy + ry * 0.75, rx * 1.15);
  sh.addColorStop(0, "rgba(96,78,140,0.45)");
  sh.addColorStop(1, "rgba(96,78,140,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);

  // glazed earthenware: blue-green body, pale rim catching the light
  const body = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry * 1.3);
  body.addColorStop(0, "#b9d3d6");
  body.addColorStop(0.5, "#6f9aa6");
  body.addColorStop(1, "#3f5f7a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.2, rx, ry * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef0e2";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.97, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  const inner = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.35, 0, cx, cy, rx * 0.95);
  inner.addColorStop(0, "#86a9a6");
  inner.addColorStop(1, "#3e5866");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // the heap of corn: gold on top, ochre and orange in the hollows
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * 0.76 * d;
    const y = cy + 1 + Math.sin(a) * ry * 0.68 * d - (1 - d) * ry * 0.2;
    const s = (2.2 + r() * 1.2) * (w / 84);
    const hue = 36 + r() * 16;
    const light = 46 + (1 - d) * 22 + r() * 8;
    ctx.fillStyle = `hsl(${hue} 90% ${light}%)`;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.75, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Painted like the pond: a soft wash of the underpainting, then layers of
 * loose dabs that each carry one colour picked from beneath, nudged warm or
 * cool, with ragged edges and paper grain instead of outlines.
 */
function paintBowl(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  c.width = W;
  c.height = H;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  let seed = 9;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const base = document.createElement("canvas");
  base.width = W;
  base.height = H;
  const bctx = base.getContext("2d")!;
  bctx.scale(dpr, dpr);
  underpainting(bctx, w, h, r);
  const px = bctx.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number) => {
    const ix = Math.max(0, Math.min(W - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(H - 1, Math.round(y)));
    const o = (iy * W + ix) * 4;
    return [px[o], px[o + 1], px[o + 2], px[o + 3]];
  };

  const ctx = c.getContext("2d")!;
  // a thin wash first, so the dabs sit on colour rather than on nothing
  ctx.globalAlpha = 0.45;
  ctx.drawImage(base, 0, 0);
  ctx.globalAlpha = 1;

  const cx = W / 2;
  const cy = H * 0.48;
  const layers: Array<[number, number]> = [
    [5.2 * dpr * (w / 84), 0.75],
    [3.4 * dpr * (w / 84), 0.85],
    [2.2 * dpr * (w / 84), 0.9],
  ];
  for (const [size, opacity] of layers) {
    for (let gy = 0; gy < H; gy += size * 0.8) {
      for (let gx = 0; gx < W; gx += size * 0.8) {
        const x = gx + (r() - 0.5) * size;
        const y = gy + (r() - 0.5) * size;
        const [cr, cg, cb, ca] = at(x, y);
        if (ca < 24) continue;
        // strokes follow the curve of the bowl
        const ang = Math.atan2(y - cy, x - cx) + Math.PI / 2 + (r() - 0.5) * 0.7;
        const k = r();
        const shift = k < 0.3 ? [-10, -2, 16] : k > 0.72 ? [14, 10, -10] : [0, 0, 0];
        const v = 0.92 + r() * 0.16;
        const col = `rgba(${Math.round(cr * v + shift[0])},${Math.round(cg * v + shift[1])},${Math.round(cb * v + shift[2])},${((ca / 255) * opacity).toFixed(3)})`;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * (0.8 + r() * 0.6), size * (0.3 + r() * 0.2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // light catching the rim, laid on with two quick strokes
  ctx.strokeStyle = "rgba(255,248,226,0.7)";
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    ctx.lineWidth = (1.6 - i * 0.6) * dpr;
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.38, H * 0.31, 0, Math.PI * (1.05 + i * 0.08), Math.PI * (1.45 + i * 0.1));
    ctx.stroke();
  }

  // paper grain, only where there is paint
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < W * H * 0.04; i++) {
    ctx.fillStyle = r() > 0.5 ? "rgba(255,250,235,0.12)" : "rgba(40,30,60,0.1)";
    ctx.fillRect(r() * W, r() * H, dpr, dpr);
  }
  // let the painting fade out at its edges, never a hard border
  ctx.globalCompositeOperation = "destination-in";
  ctx.save();
  ctx.translate(cx, H * 0.52);
  ctx.scale(1, H / W);
  const fade = ctx.createRadialGradient(0, 0, W * 0.3, 0, 0, W * 0.5);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(-W, -W, W * 2, W * 2);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

/** A single kernel, drawn for the cursor. */
function kernelCursor(): string {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.translate(16, 16);
  ctx.rotate(-0.5);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(1.5, 2, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-3, -3, 0, 0, 0, 10);
  g.addColorStop(0, "#fff3b8");
  g.addColorStop(0.5, "#f2c13c");
  g.addColorStop(1, "#c4861a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-8, -1);
  ctx.quadraticCurveTo(-7, -7, 1, -6.5);
  ctx.quadraticCurveTo(8.5, -4, 8, 0);
  ctx.quadraticCurveTo(8.5, 4, 1, 6.5);
  ctx.quadraticCurveTo(-7, 7, -8, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,250,225,0.75)";
  ctx.beginPath();
  ctx.ellipse(-4, -0.5, 2.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  return `url(${c.toDataURL("image/png")}) 16 16, pointer`;
}

export function mountBowl(container: HTMLElement, pond: HTMLElement, ctl: PondController): () => void {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pond-bowl";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Pick up some corn to feed the swans");
  btn.title = "Feed the swans";
  const art = document.createElement("canvas");
  paintBowl(art, 84, 60);
  const label = document.createElement("span");
  label.className = "pond-bowl-label";
  label.textContent = "Feed the swans";
  btn.append(art, label);
  container.appendChild(btn);

  const cursor = kernelCursor();
  let on = false;
  const set = (v: boolean) => {
    on = v;
    ctl.setFeeding(v);
    btn.setAttribute("aria-pressed", String(v));
    btn.setAttribute("aria-label", v ? "Put the corn down" : "Pick up some corn to feed the swans");
    label.textContent = v ? "Click the water to throw" : "Feed the swans";
    pond.style.cursor = v ? cursor : "";
  };
  const onClick = () => set(!on);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && on) set(false);
  };
  btn.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);
  return () => {
    set(false);
    btn.removeEventListener("click", onClick);
    window.removeEventListener("keydown", onKey);
    btn.remove();
  };
}
