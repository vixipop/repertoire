"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "./data";

/** The three Work tabs. Each is its own route, so a tab can be linked to directly. */
export default function WorkTabs() {
  const path = usePathname();
  return (
    <nav className="work-tabs appear" aria-label="Work">
      {TABS.map((t) => {
        const on = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} className="work-tab" aria-current={on ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
