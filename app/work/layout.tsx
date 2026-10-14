import Link from "next/link";
import WorkTabs from "./work-tabs";

/** Shell shared by every Work page: the site's column, a way back, and the tabs. */
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="stack">
            <div className="body-copy">
              <div className="greetings appear">
                <span>
                  <Link href="/" className="work-back">← back</Link>
                </span>
              </div>
              <h1 className="work-title appear">Work</h1>
            </div>
            <WorkTabs />
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
