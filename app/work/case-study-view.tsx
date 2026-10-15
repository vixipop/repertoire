import Link from "next/link";
import type { Block, Story } from "./data";
import CaseStudyIndex from "./case-study-index";
import FigureImage from "./figure-image";
import CompareSlider from "./compare-slider";

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
        <blockquote key={i} className="cs-note">
          <p>{withBold(b.text, b.bold)}</p>
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
    case "compare":
      return <CompareSlider key={i} before={b.before} after={b.after} />;
    case "figure":
      return (
        <figure key={i} className="cs-figure">
          <div className="cs-figure-frame">
            <FigureImage figure={b.figure} />
          </div>
          <figcaption>{b.figure.caption}</figcaption>
        </figure>
      );
  }
}

/** Wraps each phrase in `bold` in <strong>, the way key words are marked on the sticky notes. */
function withBold(text: string, bold: string[] = []) {
  if (bold.length === 0) return text;
  const escaped = bold.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.split(new RegExp(`(${escaped.join("|")})`)).map((part, i) =>
    bold.includes(part) ? <strong key={i}>{part}</strong> : part,
  );
}
