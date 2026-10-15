"use client";

import { useRef, useState } from "react";
import type { Figure } from "./data";

/**
 * Before / after: two images of the same size stacked, with a draggable divider.
 * The "before" side is on the left and is revealed by clipping, so both images stay
 * perfectly aligned. Works by dragging anywhere on the image, by tapping, and from the
 * keyboard (arrows, Home, End) on the handle. Vertical scrolling still works on touch.
 */
export default function CompareSlider({ before, after }: { before: Figure; after: Figure }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // % of the width showing "before"
  const [dragging, setDragging] = useState(false);

  const moveTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <figure className="cs-figure">
      <div
        ref={box}
        className={`cs-compare${dragging ? " is-dragging" : ""}`}
        style={{ aspectRatio: `${after.width} / ${after.height}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => dragging && moveTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <img className="cs-compare-img" src={after.src} alt={after.alt} draggable={false} />
        <img
          className="cs-compare-img"
          src={before.src}
          alt={before.alt}
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span className="cs-compare-tag cs-compare-tag-before">Before</span>
        <span className="cs-compare-tag cs-compare-tag-after">After</span>

        <div className="cs-compare-line" style={{ left: `${pos}%` }}>
          <button
            type="button"
            className="cs-compare-handle"
            role="slider"
            aria-label="Drag to compare before and after"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
              else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
              else if (e.key === "Home") setPos(0);
              else if (e.key === "End") setPos(100);
              else return;
              e.preventDefault();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" />
            </svg>
          </button>
        </div>
      </div>
      <figcaption>{after.caption}</figcaption>
    </figure>
  );
}
