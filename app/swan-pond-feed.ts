/**
 * Corn for the swans. The hanging feeder lives in the pond itself (see
 * swan-pond-engine.ts); this is the kernel your cursor becomes when you take
 * one from it.
 */

/** A single kernel, drawn for the cursor. */
export function kernelCursor(): string {
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
