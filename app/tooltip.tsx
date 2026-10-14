"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Hover tooltip.
 *
 * The label floats in a portal on the body and follows the pointer, sitting just above
 * it, so it never covers the line of text being pointed at. A short delay on leave stops
 * it flickering. Touch toggles it where you tapped; focus (keyboard) shows it above the
 * element. The trigger carries the label as `aria-description` for screen readers.
 */
const LEAVE_DELAY_MS = 120;
const GAP = 14; // between the pointer and the label's bottom edge

export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => window.clearTimeout(timer.current);
  }, []);

  const place = useCallback((x: number, y: number) => {
    const el = tip.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y - GAP}px`;
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisible(true);
  }, []);
  const hide = useCallback(() => {
    timer.current = window.setTimeout(() => setVisible(false), LEAVE_DELAY_MS);
  }, []);

  // A tap elsewhere dismisses a tooltip opened by touch.
  useEffect(() => {
    if (!visible) return;
    const away = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!(e.target as Element | null)?.closest?.(".cv-tooltip-wrap")) setVisible(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [visible]);

  return (
    <span
      className="cv-tooltip-wrap"
      tabIndex={0}
      aria-description={label}
      onMouseEnter={(e) => {
        place(e.clientX, e.clientY);
        show();
      }}
      onMouseMove={(e) => place(e.clientX, e.clientY)}
      onMouseLeave={hide}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        place(r.left + r.width / 2, r.top);
        show();
      }}
      onBlur={hide}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) place(t.clientX, t.clientY - 10);
        setVisible((v) => !v);
      }}
    >
      {children}
      {mounted
        ? createPortal(
            <span
              ref={tip}
              className={`cv-tooltip${visible ? " cv-tooltip-visible" : ""}`}
              role="tooltip"
              style={{ transform: "translate(-4px, -100%)" }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
