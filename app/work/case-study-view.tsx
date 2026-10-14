import Link from "next/link";
import type { Block, Story } from "./data";
import CaseStudyIndex from "./case-study-index";

/** Renders one case study: index, header, sections of short prose and figures, callout, footnote. */
export default function CaseStudyView({ story }: { story: Story }) {
  return (
    <div className="cs-page">
      <CaseStudyIndex
        sections={story.sections.map(({ id, title }) => ({ id, title }))}
      />

      <div className="content">
        <article className="cs-article">
          <header className="cs-header appear">
            <h1 className="cs-title">{story.title}</h1>
            <p className="cs-meta">{story.meta}</p>
            <p className="cs-summary">{story.summary}</p>
          </header>

          <div className="link-divider" aria-hidden="true" />

          {story.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="cs-section appear"
              aria-labelledby={`${section.id}-title`}
            >
              <h2 id={`${section.id}-title`} className="cs-subhead">
                {section.title}
              </h2>
              <div className="cs-prose">
                {section.blocks.map((b, i) => renderBlock(b, i))}
              </div>
            </section>
          ))}

          <aside className="cs-callout appear">
            <p>{story.callout}</p>
            <Link href="mailto:jahnavijworks@gmail.com">
              <span className="link-label">Ask about this work</span>
            </Link>
          </aside>

          <footer className="cs-footnote appear">
            <p>{story.footnote}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function renderBlock(b: Block, i: number) {
  switch (b.kind) {
    case "p":
      return <p key={i}>{b.text}</p>;
    case "quote":
      return (
        <blockquote key={i} className="cs-quote">
          <p>{b.text}</p>
          <footer>{b.by}</footer>
        </blockquote>
      );
    case "list":
      return (
        <ul key={i} className="cs-list">
          {b.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "figure":
      return (
        <figure key={i} className="cs-figure">
          <div className="cs-figure-frame">
            {/* Static exports from /public, already resized for the column. */}
            <img
              src={b.figure.src}
              alt={b.figure.alt}
              width={b.figure.width}
              height={b.figure.height}
              loading="lazy"
            />
          </div>
          <figcaption>{b.figure.caption}</figcaption>
        </figure>
      );
  }
}
