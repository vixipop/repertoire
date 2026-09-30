"use client";

import { useEffect, useRef } from "react";
import { startPond } from "./swan-pond-engine";

/**
 * Interactive pond — swans drift in long loops; hovering stirs the water,
 * clicking startles them off-frame until they wander back.
 *
 * All the behaviour lives in swan-pond-engine.ts; this just mounts the two
 * canvases and hands them over.
 */
export default function SwanPond() {
  const hostRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const swansRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const water = waterRef.current;
    const swans = swansRef.current;
    if (!host || !water || !swans) return;
    return startPond(host, water, swans);
  }, []);

  return (
    <div
      className="pond appear"
      ref={hostRef}
      role="img"
      aria-label="A pond with swans gliding across it. Move over the water to ripple it; click to startle the swans."
    >
      <canvas className="pond-water" ref={waterRef} />
      <canvas className="pond-swans" ref={swansRef} />
    </div>
  );
}
