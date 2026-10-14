import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_STUDIES } from "../../../data";
import CaseStudyView from "../../../case-study-view";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: CASE_STUDIES.find((c) => c.slug === slug)?.name };
}

/** A case study. Studies with a `story` get the full layout; the rest are still placeholders. */
export default async function CaseStudy({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const study = CASE_STUDIES.find((c) => c.slug === slug);
  if (!study) notFound();

  if (study.story) return <CaseStudyView story={study.story} />;

  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="stack">
            <div className="body-copy">
              <div className="information">
                <p className="appear">{study.name}</p>
                <p className="appear">
                  <Link href="/work/case-studies">
                    <span className="link-label">All case studies</span>
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
