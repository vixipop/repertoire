"use client";

import { useEffect } from "react";
import { play, setEnabled } from "cuelume";
import { useAmbient } from "./audio-provider";

/**
 * UI sound for links: hovering one plays Cuelume's `select` cue in the `bubble`
 * theme. The theme is passed per play, so Cuelume's active theme is untouched.
 *
 * Cuelume's own advice is not to play on hover (bursts wear a sound out), and it has
 * no hover binding, so this is a handler of our own with guards against exactly that:
 *  - mouse and pen only: touch has no hover, and its synthetic pointer events would
 *    sound just before a tap;
 *  - moving between a link's own children (its label span, say) is not a new hover;
 *  - at most one sound per 80ms across all links, and the same link can't re-trigger
 *    for 400ms, so a quick sweep down a list reads as a ripple rather than a buzz.
 *
 * It follows the same sound preference as the music: mute that and this goes silent.
 * Browsers also keep all Web Audio silent until the visitor's first click or key, so
 * hovers before that make no sound.
 */

const CUE = "select";
const THEME = "bubble";
const MIN_GAP_MS = 80;
const REPEAT_GAP_MS = 400;

export default function UiSounds() {
  const { muted } = useAmbient();

  // Cuelume owns no preference of its own; ours decides.
  useEffect(() => {
    setEnabled(!muted);
  }, [muted]);

  useEffect(() => {
    let lastAt = -Infinity;
    let lastLink: Element | null = null;
    let lastLinkAt = -Infinity;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link) return;

      const from = e.relatedTarget as Node | null;
      if (from && link.contains(from)) return; // still inside the same link

      const now = performance.now();
      if (now - lastAt < MIN_GAP_MS) return;
      if (link === lastLink && now - lastLinkAt < REPEAT_GAP_MS) return;
      lastAt = now;
      lastLink = link;
      lastLinkAt = now;

      play(CUE, { theme: THEME });
    };

    document.addEventListener("pointerover", onOver, { passive: true });
    return () => document.removeEventListener("pointerover", onOver);
  }, []);

  return null;
}
