/**
 * A bowl of corn beside the pond. Click it to pick up a handful: the cursor
 * becomes a kernel, and clicks on the water throw corn for the swans.
 * Click the bowl again (or press Esc) to put it down.
 */

import type { PondController } from "./swan-pond-engine";

function paintBowl(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  let seed = 9;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const cx = w / 2;
  const cy = h * 0.5;
  const rx = w * 0.42;
  const ry = h * 0.36;

  // soft shadow on the ground
  const sh = ctx.createRadialGradient(cx + 3, cy + ry * 0.55, 0, cx + 3, cy + ry * 0.55, rx * 1.1);
  sh.addColorStop(0, "rgba(40,30,30,0.28)");
  sh.addColorStop(1, "rgba(40,30,30,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);

  // glazed bowl: outer body, then rim
  const body = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy + ry);
  body.addColorStop(0, "#c9d8d2");
  body.addColorStop(0.55, "#8faaa3");
  body.addColorStop(1, "#5d7a74");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.18, rx, ry * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9efe9";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.97, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  // inside of the bowl
  const inner = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 0, cx, cy, rx * 0.9);
  inner.addColorStop(0, "#7d9a92");
  inner.addColorStop(1, "#4c675f");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // a heap of kernels, brighter on top
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * 0.74 * d;
    const y = cy + 1 + Math.sin(a) * ry * 0.66 * d;
    const s = 2.1 + r() * 0.9;
    const hue = 40 + r() * 10;
    const light = 52 + (1 - d) * 16 + r() * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI);
    ctx.fillStyle = `hsl(${hue} 88% ${light}%)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,250,220,0.55)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.2, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // painterly finish: a few loose glaze strokes and a highlight on the rim
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.95, ry * 0.9, 0, Math.PI * 1.08, Math.PI * 1.55);
  ctx.stroke();
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(${r() > 0.5 ? "255,255,255" : "40,70,64"},${0.08 + r() * 0.1})`;
    ctx.lineWidth = 1 + r() * 1.5;
    const a = Math.PI * (0.1 + r() * 0.8);
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.18, rx * (0.93 + r() * 0.06), ry * (1.0 + r() * 0.04), 0, a, a + 0.3 + r() * 0.3);
    ctx.stroke();
  }
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
  paintBowl(art, 64, 46);
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
