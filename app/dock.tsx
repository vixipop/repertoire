"use client";

/**
 * Floating dock: theme toggle + social slots.
 * The toggle flips `data-theme` on <html> and persists the choice; the
 * pre-paint script in layout.tsx reads it back on the next load.
 */
export default function Dock() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage can be unavailable (private mode, blocked cookies) */
    }
  }

  return (
    <div className="floating-dock" role="toolbar" aria-label="Site controls">
      <button
        className="floating-dock-icon"
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle colour theme"
      >
        <svg
          className="theme-toggle-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>

      {/* Replace with your own icons/links */}
      <a className="floating-dock-icon dock-social" href="#" aria-label="Social link one">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      </a>
      <a className="floating-dock-icon dock-social" href="#" aria-label="Social link two">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      </a>
    </div>
  );
}
