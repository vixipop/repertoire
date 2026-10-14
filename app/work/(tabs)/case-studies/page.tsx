import type { Metadata } from "next";
import Link from "next/link";
import { CASE_STUDIES } from "../../data";

export const metadata: Metadata = { title: "Case studies" };

export default function CaseStudies() {
  return (
    <div className="link-row work-list appear">
      {CASE_STUDIES.map((c) => (
        <div className="work-item" key={c.slug}>
          <div className="names">
            <Link href={`/work/case-studies/${c.slug}`}>
              <span className="link-label">{c.name}</span>
            </Link>
          </div>
          <div className="dates">
            <span>{c.blurb}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
