"use client";

import { useEffect, useState } from "react";

/**
 * The jump links for a case study. On wide screens it sits fixed to the left of the
 * column (see `.cs-index` in globals.css); on narrow screens it becomes a row above the
 * text. The link for the section in view is marked as the current one.
 */
export default function CaseStudyIndex({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    // A section counts as "current" while it crosses the upper-middle of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="cs-index appear" aria-label="Contents">
      <a className="cs-index-back" href="/work/case-studies">
        ← back
      </a>
      <ol className="cs-index-list">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
