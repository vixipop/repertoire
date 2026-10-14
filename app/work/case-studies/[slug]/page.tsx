import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_STUDIES } from "../../data";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: CASE_STUDIES.find((c) => c.slug === slug)?.name };
}

/** One case study. The structure is in place; each section's copy is a placeholder. */
export default async function CaseStudy({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const study = CASE_STUDIES.find((c) => c.slug === slug);
  if (!study) notFound();

  return (
    <article className="work-article">
      <h2 className="work-article-title appear">{study.name}</h2>
      <div className="information">
        <p className="appear">{study.blurb}</p>
        <p className="appear">PLACEHOLDER — the problem, in a sentence or two.</p>
        <p className="appear">PLACEHOLDER — what I did, and the decisions that mattered.</p>
        <p className="appear">PLACEHOLDER — what changed as a result.</p>
        <p className="appear">
          <Link href="/work/case-studies">
            <span className="link-label">All case studies</span>
          </Link>
        </p>
      </div>
    </article>
  );
}
