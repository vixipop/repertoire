/**
 * Builds the swan pond as its own site: pond-site/index.html, next to the
 * moon icons and the music. Plain static files, no framework, so any static
 * host serves it as is (Vercel: set the project's Root Directory to
 * pond-site, framework "Other", no build command).
 *
 *   node scripts/build-pond.mjs                    -> pond-site/index.html
 *   node scripts/build-pond.mjs --fragment out.html -> a body-only copy (for previews)
 *
 * Edit the SITE block in PAGE_SCRIPT below for your links and email.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const app = (f) => fs.readFileSync(path.join(root, "app", f), "utf8");
const strip = (code) => code.replace(/^import [\s\S]*?;$/gm, "").replace(/^export (default )?/gm, "");
const engine = ["swan-paint.ts", "swan-pond-engine.ts", "swan-pond-time.ts", "swan-pond-music.ts"]
  .map((f) => strip(ts.transpileModule(app(f), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText))
  .join("\n");

// the pond's own styles from the site stylesheet (without the tuner panel)
const g = app("globals.css");
const from = g.indexOf("/* ==========================================================================\n   Swan pond");
const to = g.indexOf("/* pond-tuner:start");
if (from < 0 || to < 0) throw new Error("couldn't find the pond styles in globals.css");
const pondCss = g.slice(from, to);

const TITLE = "jahnavi";
const DESCRIPTION = "A little Monet pond: swans drift, sulk when you splash, and beg for corn.";

const PAGE_CSS = `
:root {
  --page: #f5f3ee; --ink: #2a2d2b; --muted: #8b8f8c; color-scheme: light;
  --pw: min(1180px, calc(100vw - 220px), calc((100svh - 150px) * 1.6));
}
html[data-time="dawn"] { --page: #f6ece9; --ink: #4b3a42; --muted: #9a8890; }
html[data-time="dusk"] { --page: #2a2237; --ink: #f0dcea; --muted: #a595b4; color-scheme: dark; }
html[data-time="dark"] { --page: #0b0d15; --ink: #d3dcf2; --muted: #7482a3; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--page); color: var(--ink); transition: background-color 1.6s ease, color 1.6s ease; }
body {
  min-height: 100svh;
  display: grid;
  grid-template-rows: auto 1fr;
  font: 14px/22px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  overflow-x: hidden;
}
.boot, .boot * { transition: none !important; }

.bar { width: var(--pw); margin: 0 auto; padding: 20px 0 0; height: 64px; display: flex; align-items: center; justify-content: space-between; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; letter-spacing: 0.02em; }
.moon { position: relative; width: 26px; height: 26px; flex: none; }
.moon img { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity 1.4s ease; }
.moon-glow { opacity: 0; }
html[data-time="dusk"] .moon-glow, html[data-time="dark"] .moon-glow { opacity: 1; }
html[data-time="dusk"] .moon-ink, html[data-time="dark"] .moon-ink { opacity: 0; }

.tools { display: flex; align-items: center; gap: 2px; margin-right: -8px; }
.tool { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--muted); cursor: pointer; transition: color 0.2s ease, background-color 0.2s ease; }
.tool:hover, .tool:focus-visible { color: var(--ink); }
.tool:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
.tool svg { width: 18px; height: 18px; display: block; }
.tool .solid { fill: currentColor; }
.tool .line { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
#mute .off, #mute[data-audible="false"] .on { display: none; }
#mute[data-audible="false"] .off { display: block; }

main { display: grid; place-items: center; padding-bottom: 24px; }
.pond { width: var(--pw); cursor: pointer; }

.corn { display: none; }
.times { position: fixed; right: 28px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.times button { font: inherit; font-size: 13px; letter-spacing: 0.04em; padding: 4px 0 4px 14px; border: 0; background: none; color: var(--muted); cursor: pointer; position: relative; transition: color 0.2s ease; }
.times button:hover, .times button:focus-visible { color: var(--ink); }
.times button[aria-pressed="true"] { color: var(--ink); }
.times button[aria-pressed="true"]::before { content: ""; position: absolute; left: 2px; top: 50%; width: 5px; height: 5px; margin-top: -2.5px; border-radius: 50%; background: currentColor; }

.toast { position: fixed; top: 76px; left: 50%; transform: translate(-50%, -6px); padding: 6px 14px; border-radius: 999px; background: var(--ink); color: var(--page); font-size: 13px; opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 5; }
.toast.show { opacity: 1; transform: translate(-50%, 0); }

@media (max-width: 760px) {
  :root { --pw: calc(100vw - 32px); }
  .pond { aspect-ratio: 4 / 3; }
  main { align-content: center; grid-template-rows: auto auto auto; gap: 18px; justify-items: center; }
  .corn { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 13px; letter-spacing: 0.04em; padding: 8px 16px; border-radius: 999px; border: 1px solid var(--muted); background: none; color: var(--ink); cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
  .corn svg { width: 14px; height: 14px; fill: #f2c94c; stroke: #b88a1e; stroke-width: 1.2; }
  .corn[aria-pressed="true"] { background: #f7e08a; border-color: #f7e08a; color: #2a2d2b; }
  .times { position: static; transform: none; flex-direction: row; justify-content: center; gap: 4px; width: var(--pw); }
  .times button { padding: 6px 12px; }
  .times button[aria-pressed="true"]::before { display: none; }
  .times button[aria-pressed="true"] { text-decoration: underline; text-underline-offset: 5px; }
}
`;

const ICON = {
  x: `<svg class="solid" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  linkedin: `<svg class="solid" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  link: `<svg class="line" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"/></svg>`,
  mail: `<svg class="line" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/></svg>`,
  on: `<svg class="line on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6"/><path d="M18 6.5a7.5 7.5 0 010 11"/></svg>`,
  off: `<svg class="line off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
};

const BODY = `<header class="bar">
  <span class="brand"><span class="moon"><img class="moon-ink" src="moon-ink.png" alt=""><img class="moon-glow" src="moon-glow.png" alt=""></span><span>jahnavi</span></span>
  <div class="tools">
    <a class="tool" id="x" href="https://x.com/vixenpspsps/status/2107388697327083537?s=20" target="_blank" rel="noopener" aria-label="Post on X">${ICON.x}</a>
    <a class="tool" id="in" href="https://lnkd.in/p/deyMy8i3" target="_blank" rel="noopener" aria-label="Post on LinkedIn">${ICON.linkedin}</a>
    <button class="tool" id="copy-link" type="button" aria-label="Copy link">${ICON.link}</button>
    <button class="tool" id="copy-mail" type="button" aria-label="Copy email address">${ICON.mail}</button>
    <button class="tool" id="mute" type="button" aria-label="Unmute music" data-audible="false">${ICON.on}${ICON.off}</button>
  </div>
</header>
<main>
  <div class="pond" id="pond" role="img" aria-label="A pond with swans gliding across it. Move over the water to ripple it; click to make a splash that startles the swans, or right-click to toss them some corn.">
    <canvas class="pond-water" id="water"></canvas>
    <canvas class="pond-swans" id="swans"></canvas>
  </div>
  <button class="corn" id="corn" type="button" aria-pressed="false" aria-label="Corn mode: tap the pond to toss corn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c3.6 2.6 5.5 6.4 5.5 10.2 0 4.2-2.4 7.6-5.5 8.8-3.1-1.2-5.5-4.6-5.5-8.8 0-3.8 1.9-7.6 5.5-10.2z"/></svg><span>corn</span></button>
  <nav class="times" id="times" aria-label="Time of day"></nav>
</main>
<div class="toast" id="toast" role="status"></div>`;

const PAGE_SCRIPT = `
(() => {
  // ---- edit these ----
  const SITE = {
    twitter: "https://x.com/vixenpspsps/status/2107388697327083537?s=20", // link to the post
    linkedin: "https://lnkd.in/p/deyMy8i3", // link to the post
    email: "jahnavijworks@gmail.com",
    music: "music.mp3",
    volume: 0.5,
  };
  // --------------------
  const root = document.documentElement;
  root.classList.add("boot");
  const $ = (id) => document.getElementById(id);
  $("x").href = SITE.twitter;
  $("in").href = SITE.linkedin;

  /* the pond, following the clock unless a time of day is picked */
  const looks = defaultLooks();
  const pond = $("pond");
  const ctl = startPond(pond, $("water"), $("swans"), lookAt(looks).params);
  let stopClock = followClock(ctl, () => looks, true);
  let mode = "auto";

  const times = $("times");
  const buttons = new Map();
  for (const name of TIME_NAMES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name.toLowerCase();
    b.addEventListener("click", () => {
      stopClock();
      if (mode === name) {
        mode = "auto";
        stopClock = followClock(ctl, () => looks, false);
      } else {
        mode = name;
        stopClock = () => {};
        ctl.setParams(looks[name]);
      }
      sync();
    });
    times.appendChild(b);
    buttons.set(name, b);
  }
  const sync = () => {
    const name = mode === "auto" ? lookAt(looks).name : mode;
    root.dataset.time = name.toLowerCase();
    for (const [n, b] of buttons) {
      b.setAttribute("aria-pressed", String(n === name));
      b.title = n === name && mode !== "auto" ? "click again to follow the clock" : "";
    }
  };
  sync();
  setInterval(sync, 30000);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("boot")));

  // remarks scale with the pond
  const fit = () => root.style.setProperty("--say-size", (20 * Math.pow(Math.max(0.6, pond.clientWidth / 680), 0.8)).toFixed(1) + "px");
  new ResizeObserver(fit).observe(pond);
  fit();

  /* corn mode, for phones: tap the pond to feed instead of splash */
  const corn = $("corn");
  corn.addEventListener("click", () => {
    const on = corn.getAttribute("aria-pressed") !== "true";
    corn.setAttribute("aria-pressed", String(on));
    ctl.setTapMode(on ? "feed" : "splash");
    toast(on ? "tap the pond to toss corn" : "tap the pond to splash");
  });
  // leaving a phone-sized window with corn on would leave left clicks feeding with no button to undo it
  matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
    if (e.matches && corn.getAttribute("aria-pressed") === "true") corn.click();
  });

  /* copy buttons */
  const toastEl = $("toast");
  let toastTimer = 0;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  };
  const copy = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch {}
      t.remove();
      if (!ok) return toast("couldn't copy");
    }
    toast(msg);
  };
  $("copy-link").addEventListener("click", () => copy(location.href, "link copied"));
  $("copy-mail").addEventListener("click", () => copy(SITE.email, "email copied"));

  /* music: starts with the first click or key (browsers require one), mute on the top right */
  const music = createMusic(SITE.music, SITE.volume);
  const mute = $("mute");
  let muted = false;
  try { muted = localStorage.getItem("pond-muted") === "1"; } catch {}
  const remember = () => { try { localStorage.setItem("pond-muted", muted ? "1" : "0"); } catch {} };
  const paintMute = () => {
    const audible = music.playing && !muted;
    mute.dataset.audible = String(audible);
    mute.setAttribute("aria-label", audible ? "Mute music" : "Unmute music");
  };
  music.onChange(paintMute);
  paintMute();
  const start = async () => {
    try {
      music.setVolume(muted ? 0 : SITE.volume);
      await music.play();
    } catch {
      /* still blocked: the next click or key tries again */
    }
    paintMute();
  };
  mute.addEventListener("click", () => {
    if (!music.playing) {
      muted = false;
      start();
    } else {
      muted = !muted;
      music.setVolume(muted ? 0 : SITE.volume);
    }
    remember();
    paintMute();
  });
  const gestures = ["pointerdown", "pointerup", "keydown", "touchend"];
  const onGesture = (e) => {
    if (e.target instanceof Node && mute.contains(e.target)) return;
    if (muted) return;
    start().then(() => {
      if (music.playing) gestures.forEach((t) => document.removeEventListener(t, onGesture, true));
    });
  };
  gestures.forEach((t) => document.addEventListener(t, onGesture, true));
  // and quiet while the tab is out of sight
  let resume = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (music.playing) { resume = true; music.pause(); }
    } else if (resume) {
      resume = false;
      if (!muted) start();
    }
  });
})();
`;

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&display=swap">`;
// the page rules come after the pond's own, so they win on size
const STYLE = `<style>${pondCss}\n${PAGE_CSS}</style>`;
const SCRIPT = `<script>\n${engine}\n${PAGE_SCRIPT}</script>`;

const fragmentAt = process.argv.indexOf("--fragment");
if (fragmentAt > 0) {
  // body-only copy: the host wraps it in its own document
  const out = process.argv[fragmentAt + 1];
  fs.writeFileSync(out, `<title>Swan Pond</title>\n${FONTS}\n${STYLE}\n${BODY}\n${SCRIPT}\n`);
  console.log(`${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
} else {
  const html = `<!doctype html>
<html lang="en" class="boot" data-time="day">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta name="theme-color" content="#f5f3ee">
<link rel="icon" type="image/png" href="moon-ink.png">
<link rel="icon" type="image/png" href="moon-ink.png" media="(prefers-color-scheme: light)">
<link rel="icon" type="image/png" href="moon-glow.png" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="moon-glow.png">
${FONTS}
${STYLE}
</head>
<body>
${BODY}
${SCRIPT}
</body>
</html>
`;
  fs.writeFileSync(path.join(root, "pond-site", "index.html"), html);
  console.log(`pond-site/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}
