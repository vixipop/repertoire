import type { Metadata } from "next";
import { SHADERS } from "../../data";

export const metadata: Metadata = { title: "Shaders" };

/** A gallery of tiles; swap each placeholder tile for a screenshot, video or live canvas. */
export default function ShadersGallery() {
  return (
    <ul className="work-grid appear">
      {SHADERS.map((p) => (
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
