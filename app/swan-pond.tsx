"use client";

import { useEffect, useRef } from "react";
import { startPond } from "./swan-pond-engine";
import { defaultLooks, followClock, lookAt } from "./swan-pond-time";
import { initialParams, mountTuner } from "./swan-pond-tuner";

/**
 * Interactive pond — swans drift in long loops; hovering stirs the water,
 * clicking startles them off-frame until they wander back. The light follows
 * the visitor's clock: dawn, day, dusk and dark.
 *
 * The panel shows in development, or on any build with `?tune` in the URL.
 * Tune each time of day there, press "Copy settings", and paste the values
 * into TIMES in swan-pond-engine.ts to make them the defaults.
 */
export default function SwanPond() {
  const hostRef = useRef<HTMLDivElement>(null);
  const waterRef = useRef<HTMLCanvasElement>(null);
  const swansRef = useRef<HTMLCanvasElement>(null);
  const tunerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const water = waterRef.current;
    const swans = swansRef.current;
    if (!host || !water || !swans) return;

    const tune =
      process.env.NODE_ENV === "development" || new URLSearchParams(window.location.search).has("tune");
    const ctl = startPond(host, water, swans, tune ? initialParams() : lookAt(defaultLooks()).params);
    const stop =
      tune && tunerRef.current ? mountTuner(tunerRef.current, ctl) : followClock(ctl, defaultLooks);
    return () => {
      stop();
      ctl.destroy();
    };
  }, []);

  return (
    <>
      <div
        className="pond appear"
        ref={hostRef}
        role="img"
        aria-label="A pond with swans gliding across it. Move over the water to ripple it; click to startle the swans, or take corn from the hanging feeder and throw it in."
      >
        <canvas className="pond-water" ref={waterRef} />
        <canvas className="pond-swans" ref={swansRef} />
      </div>
      <div className="pond-tuner-slot" ref={tunerRef} />
    </>
  );
}
