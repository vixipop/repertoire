import { Fragment } from "react";
import Link from "next/link";
import CopyButton from "./copy-button";
import Tooltip from "./tooltip";
import PondHero from "./pond/pond-hero";
import HeroBar from "./hero-bar";
import { CASE_STUDIES } from "./work/data";

/**
 * Homepage.
 *
 * Structure and spacing follow the layout system in globals.css. The project
 * lists come from work/data.ts, so they stay in step with the Work pages.
 */
export default function Home() {
  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="hero">
            <HeroBar />
            <PondHero />
          </div>

          <div className="stack">
            <div className="body-copy">
              <div className="greetings appear">
                <span>jahnavi,</span>
                <Tooltip label="Hindi">
                  <span lang="hi">
                    जाह्नवी<span className="greetings-comma">,</span>
                  </span>
                </Tooltip>
                <Tooltip label="Sindhi">
                  <span lang="sd" dir="rtl">
                    جھانوي
                  </span>
                </Tooltip>
              </div>

              <div className="information">
                <p className="appear">I&apos;m Jahnavi, lingering somewhere between code snippets and human behaviour.</p>
                <p className="appear">
                  Amid shifting paradigms like AI, product design and design engineering, at my core I
                  aim to collect and build experiences that enrich my creative vision and taste. Code
                  and Claude are tools that often help me deliver those experiences to users.
                </p>
                <p className="appear">
                  Recently: an end-to-end revamp and automation for{" "}
                  <Link href="/work/case-studies/cloudverse-ai">
                    <span className="link-label">Cloudverse AI</span>
                  </Link>
                  . All my product design work lives{" "}
                  <Link href="/work/case-studies">
                    <span className="link-label">here</span>
                  </Link>
                  .
                </p>
                <p className="appear">
                  My chosen medium for{" "}
                  <Link href="/work/shaders">
                    <span className="link-label">playing around</span>
                  </Link>{" "}
                  with creative tech is GLSL shaders and three.js in the browser.
                </p>
                <p className="appear">
                  Outside of screens I enjoy reading, writing, and watching motorsport and tennis. I
                  also play badminton and video games regularly.
                </p>
                <p className="appear">
                  Explore my{" "}
                  <Link href="/work">
                    <span className="link-label">selected work</span>
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="link-groups">
              <div className="link-divider" />
              <LinkSection
                title="Projects"
                rows={CASE_STUDIES.map((c) => ({
                  name: c.name,
                  meta: "case study",
                  href: `/work/case-studies/${c.slug}`,
                }))}
              />

              <div className="link-divider" />
              <LinkSection
                title="Playground"
                rows={[
                  { name: "Shader gallery", meta: "glsl, three.js", href: "/work/shaders" },
                  { name: "UI gallery", meta: "interface", href: "/work/ui" },
                ]}
              />

              <div className="link-divider" />
            </div>

            <section className="connect-section appear" aria-labelledby="Connect-title">
              <h2 id="Connect-title">Connect</h2>
              <div className="connect-copy">
                <p>Collaborations start at $1000 and scale with scope.</p>
                <p>
                  I&apos;m always excited to meet interesting, fun and thoughtful people, and to
                  collaborate on ambitious projects. The best way to reach me is via{" "}
                  {/* TODO: point this at your own profile */}
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer">
                    <span className="link-label">X (Twitter)</span>
                  </a>
                  . You can also email me at{" "}
                  <a href="mailto:jahnavijworks@gmail.com">
                    <span className="link-label">jahnavijworks@gmail.com</span>
                  </a>
                  <CopyButton value="jahnavijworks@gmail.com" />
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-banner">
          <p className="footer-note">PLACEHOLDER — footer line.</p>
        </div>
      </footer>
    </main>
  );
}

type Row = { name: string; meta: string; href?: string; external?: boolean };

/** A titled group of name/date rows, e.g. Projects or Notes. */
function LinkSection({ title, rows }: { title: string; rows: Row[] }) {
  const id = `${title}-title`;
  return (
    <section className="link-section appear" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="link-row">
        {rows.map((row) => (
          <Fragment key={row.name}>
            <div className="names">
              {row.href && row.external ? (
                <a href={row.href} target="_blank" rel="noopener noreferrer">
                  <span className="link-label">{row.name}</span>
                </a>
              ) : row.href ? (
                <Link href={row.href}>
                  <span className="link-label">{row.name}</span>
                </Link>
              ) : (
                <span className="link-disabled">
                  <span className="link-label">{row.name}</span>
                </span>
              )}
            </div>
            <div className="dates">
              <span>{row.meta}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
