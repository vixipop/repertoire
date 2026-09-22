"use client";

import dynamic from "next/dynamic";

/**
 * Keeps three.js out of the server bundle and off the initial payload — it
 * only downloads once /about is open, and never runs during SSR (WebGL needs
 * a real document).
 */
const SplineScene = dynamic(() => import("./spline-scene"), {
  ssr: false,
  loading: () => <div className="spline-stage" data-status="loading" />,
});

export default function SplineMount() {
  return <SplineScene />;
}
