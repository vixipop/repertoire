"use client";

import { useEffect, useState } from "react";

/**
 * Text selection drawn as rounded rectangles instead of the browser's square highlight.
 *
 * On every selection change the selected text nodes are measured line by line; nearby
 * line boxes are merged, padded a little, and drawn as absolutely positioned spans
 * (styled in globals.css). While any are showing, the native highlight is made
 * transparent (`html.has-selection-highlight`). It stands down inside inputs, when the
 * page is pinch-zoomed or scrolled sideways, and if a box would leave the viewport, so
 * the native highlight is never lost without a replacement.
 */
type Box = { left: number; top: number; width: number; height: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const typing = () => {
  const el = document.activeElement;
  return (
    !!el &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      !!el.closest("[contenteditable]:not([contenteditable='false'])"))
  );
};

function textNodes(root: Node): Text[] {
  if (root.nodeType === Node.TEXT_NODE) return [root as Text];
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

function lineRects(range: Range): DOMRect[] {
  const out: DOMRect[] = [];
  for (const node of textNodes(range.commonAncestorContainer)) {
    if (!node.data.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest(".selection-highlight-overlay")) continue;
    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (!range.intersectsNode(node)) continue;
    const start = range.startContainer === node ? Math.min(range.startOffset, node.length) : 0;
    const end = range.endContainer === node ? Math.min(range.endOffset, node.length) : node.length;
    if (start >= end) continue;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, end);
    out.push(...Array.from(r.getClientRects()));
    r.detach();
  }
  return out;
}

const sameLine = (a: Rect, b: Rect) => {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const shorter = Math.min(a.bottom - a.top, b.bottom - b.top);
  const gap = Math.max(b.left - a.right, a.left - b.right, 0);
  return overlap > 0.5 * shorter && gap <= 32;
};

function measure(): Box[] | null {
  if (typing()) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return [];

  const rects: DOMRect[] = [];
  for (let i = 0; i < sel.rangeCount; i++) rects.push(...lineRects(sel.getRangeAt(i)));

  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  if (
    (vv && (Math.abs(vv.scale - 1) > 0.01 || Math.abs(vv.offsetLeft) > 0.5)) ||
    window.scrollX > 0.5 ||
    rects.some((r) => r.left < -2 || r.right > width + 2)
  ) {
    return null;
  }

  const ox = window.scrollX + (vv?.offsetLeft ?? 0);
  const oy = window.scrollY + (vv?.offsetTop ?? 0);
  const maxWidth = width * 0.92;
  const lines: Rect[] = [];
  for (const r of rects) {
    if (r.width <= 0.5 || r.height < 6 || r.height > 80 || r.width > maxWidth) continue;
    const box = { left: r.left + ox, top: r.top + oy, right: r.right + ox, bottom: r.bottom + oy };
    const hit = lines.find((l) => sameLine(l, box));
    if (hit) {
      hit.left = Math.min(hit.left, box.left);
      hit.top = Math.min(hit.top, box.top);
      hit.right = Math.max(hit.right, box.right);
      hit.bottom = Math.max(hit.bottom, box.bottom);
    } else lines.push(box);
  }
  return lines
    .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
    .slice(0, 80)
    .map((l) => {
      const left = Math.max(0, l.left - 3);
      const top = Math.max(0, l.top - 1);
      return { left, top, width: Math.max(0, l.right + 3 - left), height: Math.max(0, l.bottom + 1 - top) };
    })
    .filter((b) => b.width > 0.5 && b.height > 0.5);
}

const same = (a: Box[], b: Box[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i];
    return (
      !!y &&
      Math.abs(x.left - y.left) < 0.5 &&
      Math.abs(x.top - y.top) < 0.5 &&
      Math.abs(x.width - y.width) < 0.5 &&
      Math.abs(x.height - y.height) < 0.5
    );
  });

export default function SelectionHighlight() {
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const update = () => {
      raf = 0;
      try {
        const next = measure();
        if (!next || next.length === 0) {
          root.classList.remove("has-selection-highlight");
          setBoxes((prev) => (prev.length ? [] : prev));
          return;
        }
        root.classList.add("has-selection-highlight");
        setBoxes((prev) => (same(prev, next) ? prev : next));
      } catch {
        root.classList.remove("has-selection-highlight");
        setBoxes([]);
      }
    };
    const queue = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    const vv = window.visualViewport;
    document.addEventListener("selectionchange", queue);
    document.addEventListener("keyup", queue);
    document.addEventListener("pointerup", queue);
    document.addEventListener("touchend", queue);
    window.addEventListener("resize", queue, { passive: true });
    window.addEventListener("scroll", queue, { passive: true });
    vv?.addEventListener("resize", queue, { passive: true });
    vv?.addEventListener("scroll", queue, { passive: true });
    return () => {
      root.classList.remove("has-selection-highlight");
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", queue);
      document.removeEventListener("keyup", queue);
      document.removeEventListener("pointerup", queue);
      document.removeEventListener("touchend", queue);
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue);
      vv?.removeEventListener("resize", queue);
      vv?.removeEventListener("scroll", queue);
    };
  }, []);

  if (boxes.length === 0) return null;
  return (
    <div className="selection-highlight-overlay" aria-hidden="true">
      {boxes.map((b, i) => (
        <span
          key={`${i}-${b.left}-${b.top}`}
          className="selection-highlight-rect"
          style={
            {
              "--selection-x": `${b.left.toFixed(2)}px`,
              "--selection-y": `${b.top.toFixed(2)}px`,
              width: `${b.width.toFixed(2)}px`,
              height: `${b.height.toFixed(2)}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
