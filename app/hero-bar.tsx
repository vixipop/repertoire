"use client";

import { useEffect, useState } from "react";

/**
 * The strip directly above the pond: the time in Bangalore.
 */
export default function HeroBar() {
  return (
    <div className="hero-bar appear">
      <TimeWidget />
    </div>
  );
}

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** "02:24 PM" -> "02:24pm" */
const clock = () => FORMAT.format(new Date()).replace(/\s?(AM|PM)/i, (_, ap: string) => ap.toLowerCase());

function TimeWidget() {
  // Empty until mounted: the server has no idea what time it is where it matters, and
  // rendering one here would mismatch on hydration. The placeholder holds the width.
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(clock());
    const id = window.setInterval(() => setNow((prev) => {
      const next = clock();
      return next === prev ? prev : next;
    }), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="time-widget">
      bangalore, ka | <span className="time-widget-clock">{now || "00:00am"}</span>
    </span>
  );
}
