"use client";

import { useRef, useState } from "react";
import type { Figure } from "./data";

/**
 * A figure's image. Click it to see it larger: a native dialog (so Esc, focus and the
 * backdrop come for free) with the high-resolution copy, which is only fetched on open.
 * Tall images scroll inside the dialog rather than shrinking to fit the height.
 */
export default function FigureImage({ figure }: { figure: Figure }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className="cs-figure-open" onClick={show} aria-label={`Enlarge: ${figure.caption}`}>
        <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" />
      </button>
      <dialog
        ref={dialog}
        className="cs-lightbox"
        aria-label={figure.caption}
        onClose={() => setOpen(false)}
        onClick={close}
      >
        {open && (
          <>
            <button type="button" className="cs-lightbox-close" onClick={close} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <path d="m3 3 8 8M11 3l-8 8" />
              </svg>
            </button>
            <img src={figure.src.replace(".webp", "-large.webp")} alt={figure.alt} />
            <p>{figure.caption}</p>
          </>
        )}
      </dialog>
    </>
  );
}
