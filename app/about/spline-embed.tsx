"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import StageTuner from "./stage-tuner"; // TEMPORARY — remove with the tuner

const VIEWER_SRC = "https://unpkg.com/@splinetool/viewer@2.0.55/build/spline-viewer.js";
const SCENE_URL = "https://prod.spline.design/uUFFhtz6UzQYnRGG/scene.splinecode";

/** `<spline-viewer>` is a custom element, so it isn't in React's JSX types. */
const SplineViewer = "spline-viewer" as unknown as ElementType;

type Status = "loading" | "ready" | "error";

/**
 * Spline's own web-component viewer.
 *
 * The player is fetched from a pinned CDN build rather than bundled — the
 * package is 19MB on disk (3.6MB for the script, the rest lazily-loaded wasm
 * for physics/boolean/navmesh), which doesn't belong in the repo.
 */
export default function SplineEmbed() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (customElements.get("spline-viewer")) {
      setStatus("ready");
      return;
    }

    // One module script for the page, however many viewers mount.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${VIEWER_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");

    const onLoad = () => setStatus("ready");
    const onError = () => setStatus("error");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (!existing) {
      script.type = "module";
      script.src = VIEWER_SRC;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  return (
    <div className="spline-stage" data-status={status} ref={hostRef}>
      {status === "ready" && (
        <SplineViewer url={SCENE_URL} events-target="local" loading-anim-type="none" />
      )}
      {status !== "ready" && (
        <p className="spline-fallback">
          {status === "loading" ? "Loading…" : "The 3D scene couldn’t load."}
        </p>
      )}
      <StageTuner />
    </div>
  );
}
