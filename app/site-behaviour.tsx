"use client";

import { useEffect } from "react";

/**
 * Behaviour layer.
 *
 * The scramble-on-hover and the staggered entrance are written from scratch —
 * the reference site drives both from compiled JS rather than its stylesheet,
 * so there was nothing to transcribe. Behaviour matches; exact timing will not.
 * Tune the constants below.
 */

const STAGGER_MS = 60; // gap between successive .appear elements
const BASE_DELAY_MS = 40; // delay before the first one
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const FRAME_MS = 28; // how fast glyphs churn
const REVEAL_PER_FRAME = 0.34; // characters locked in per frame

type ScrambleHost = HTMLElement & { _raf?: number | null };

export default function SiteBehaviour() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- staggered entrance -------------------------------------------------
    document.querySelectorAll<HTMLElement>(".appear").forEach((el, i) => {
      el.style.setProperty("--appear-delay", `${BASE_DELAY_MS + i * STAGGER_MS}ms`);
    });

    if (reduceMotion) return;

    // --- character scramble on hover ---------------------------------------
    function scramble(host: ScrambleHost) {
      if (host._raf) return; // already running

      let original = host.dataset.original;
      if (original === undefined) {
        const src = host.querySelector(".scramble-original");
        original = src?.textContent ?? host.textContent ?? "";
        host.dataset.original = original;
      }

      // Lock the box so the row can't reflow while characters change.
      const rect = host.getBoundingClientRect();
      if (rect.width) host.style.minWidth = `${rect.width}px`;

      const target = (host.querySelector(".scramble-original") as HTMLElement) ?? host;
      const text = original;
      let revealed = 0;
      let last = 0;

      const tick = (now: number) => {
        if (now - last >= FRAME_MS) {
          last = now;
          revealed += REVEAL_PER_FRAME;
          let out = "";
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            out +=
              i < Math.floor(revealed) || ch === " "
                ? ch
                : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          target.textContent = out;
          if (revealed >= text.length) {
            target.textContent = text;
            host._raf = null;
            host.style.minWidth = "";
            return;
          }
        }
        host._raf = requestAnimationFrame(tick);
      };
      host._raf = requestAnimationFrame(tick);
    }

    const cleanups: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>(".scramble-text").forEach((node) => {
      const host = node as ScrambleHost;
      const trigger = (host.closest("a") as HTMLElement) ?? host;
      const run = () => scramble(host);
      trigger.addEventListener("mouseenter", run);
      trigger.addEventListener("focus", run);
      cleanups.push(() => {
        trigger.removeEventListener("mouseenter", run);
        trigger.removeEventListener("focus", run);
        if (host._raf) cancelAnimationFrame(host._raf);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
