import type { Metadata } from "next";
import { UI_PIECES } from "../../data";

export const metadata: Metadata = { title: "UI" };

/** A gallery of tiles; swap each placeholder tile for a screenshot, video or live canvas. */
export default function UIGallery() {
  return (
    <ul className="work-grid appear">
      {UI_PIECES.map((p) => (
        <li className="work-tile" key={p.name}>
          <div className="work-tile-art" aria-hidden="true" />
          <div className="work-tile-meta">
            <span>{p.name}</span>
            <span>{p.note}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
