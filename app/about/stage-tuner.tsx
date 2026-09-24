"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * TEMPORARY — drag-to-size controls for the 3D stage.
 *
 * Renders resize handles on the stage and writes the result to CSS custom
 * properties, so you can find the right dimensions by eye. The readout gives
 * you the values to hand back; once they're baked into globals.css this whole
 * file and its `.stage-tuner` styles come out.
 *
 * Visible in dev, or anywhere with ?tune=1 on the URL.
 */

const KEY = "stage-tuner";
const MIN_W = 240;
const MIN_H = 160;

type Values = { w: number; h: number; clip: number };

export default function StageTuner() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [v, setV] = useState<Values | null>(null);

  // Decide visibility and seed from either storage or the current layout.
  useEffect(() => {
    const tune = new URLSearchParams(window.location.search).has("tune");
    if (process.env.NODE_ENV === "production" && !tune) return;
    setOn(true);

    let saved: Values | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      /* unparseable or unavailable storage — fall back to measuring */
    }

    const stage = rootRef.current?.parentElement;
    const r = stage?.getBoundingClientRect();
    setV(
      saved ?? {
        w: Math.round(r?.width ?? 1100),
        h: Math.round(r?.height ?? 447),
        clip: 96,
      },
    );
  }, []);

  // Push values onto the stage and remember them.
  useEffect(() => {
    const stage = rootRef.current?.parentElement;
    if (!stage || !v) return;
    stage.style.setProperty("--stage-w", `${v.w}px`);
    stage.style.setProperty("--stage-h", `${v.h}px`);
    stage.style.setProperty("--badge-clip", `${v.clip}px`);
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* storage can be unavailable; the live values still apply */
    }
  }, [v]);

  const drag = useCallback(
    (axis: "x" | "y" | "both") => (e: React.PointerEvent) => {
      e.preventDefault();
      const stage = rootRef.current?.parentElement;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const w0 = r.width;
      const h0 = r.height;

      const move = (ev: PointerEvent) => {
        setV((prev) =>
          prev
            ? {
                ...prev,
                // The stage is centred, so the edge moves at half the rate the
                // width grows — double the delta to track the pointer.
                w: axis === "y" ? prev.w : Math.max(MIN_W, Math.round(w0 + (ev.clientX - x0) * 2)),
                h: axis === "x" ? prev.h : Math.max(MIN_H, Math.round(h0 + (ev.clientY - y0))),
              }
            : prev,
        );
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [],
  );

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
    const stage = rootRef.current?.parentElement;
    stage?.style.removeProperty("--stage-w");
    stage?.style.removeProperty("--stage-h");
    stage?.style.removeProperty("--badge-clip");
    const r = stage?.getBoundingClientRect();
    setV({ w: Math.round(r?.width ?? 1100), h: Math.round(r?.height ?? 447), clip: 96 });
  }

  if (!on || !v) return <div ref={rootRef} hidden />;

  const snippet = `width: ${v.w}px; height: ${v.h}px; --badge-clip: ${v.clip}px;`;

  return (
    <div className="stage-tuner" ref={rootRef}>
      <span className="stage-handle stage-handle-e" onPointerDown={drag("x")} title="Drag to set width" />
      <span className="stage-handle stage-handle-w" onPointerDown={drag("x")} title="Drag to set width" />
      <span className="stage-handle stage-handle-s" onPointerDown={drag("y")} title="Drag to set height" />
      <span className="stage-handle stage-handle-se" onPointerDown={drag("both")} title="Drag to set both" />

      <div className="stage-readout">
        <code>
          {v.w} × {v.h}
        </code>
        <label>
          badge clip
          <input
            type="range"
            min={0}
            max={220}
            step={4}
            value={v.clip}
            onChange={(e) => setV({ ...v, clip: Number(e.target.value) })}
          />
          <code>{v.clip}px</code>
        </label>
        <div className="stage-readout-actions">
          <button type="button" onClick={() => navigator.clipboard?.writeText(snippet)}>
            copy
          </button>
          <button type="button" onClick={reset}>
            reset
          </button>
        </div>
      </div>
    </div>
  );
}
