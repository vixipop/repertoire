# Repertoire design system: handoff

This is the complete design system of my portfolio site ("Repertoire"). Use it to rebuild the same look and feel in a single-file HTML artifact. Every value below is taken from the live code. Appendices A and B at the end hold the full stylesheet and the behaviour code, word for word. When this spec and the appendices disagree, the appendices win.

## How to build it

- The site is Next.js and React. The artifact is one HTML file, so port the React components to plain JavaScript. The behaviour must stay identical.
- **Fonts:** load from Google Fonts: Inter (400, 500), Noto Sans Devanagari (400), Noto Naskh Arabic (400), Gaegu (700). Set `--font-inter`, `--font-devanagari`, `--font-arabic` and `--font-hand` to those families.
- **Dark mode:** the site switches on `data-theme="dark"` on `<html>`. In the artifact, also apply the dark tokens under `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, so it follows the viewer's system theme when nothing is stored.
- **Leave out:** the swan pond hero (its own WebGL engine) and the 3D Spline scene. Use a plain placeholder box at the same size if you need one.

## Principles

1. **One type size.** Almost everything is 14px on a 22px line. Hierarchy comes from colour (strong, body, muted), never from size or weight.
2. **One narrow column.** Everything sits in a 540px column. Nothing is full-bleed except the case-study contents, which floats in the left margin.
3. **Quiet until touched.** Links show no underline at rest. It wipes in on hover. Icons sit at 55% opacity until hovered.
4. **Small, physical motion.** Short durations, soft ease-out curves, 6px entrance lifts. Everything respects `prefers-reduced-motion`.
5. **Sound is tiny.** A soft tick on press and a fainter one on hover, both synthesised. Never loud, never on touch hover.

## Colour tokens

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--page` | `#fafafa` | `#0e0e0e` | page background |
| `--bg-surface` | `#fff` | `#111` | dock, figure frames |
| `--bg-icon` | `#f9f9f9` | `#171717` | icon buttons, active tab, tiles |
| `--bg-icon-hover` | `#efefef` | `#1f1f1f` | icon hover |
| `--text` | `#000` | `#b0b0b0` | body copy |
| `--text-strong` | `#000` | `#fff` | links, titles, active states |
| `--text-muted` | `#9f9f9f` | `#6e6e6e` | headings, dates, captions, meta |
| `--border-soft` | `#e4e4e4` | `#1c1c1c` | frames, rules |
| `--border-faint` | `#f5f5f5` | `#141414` | the section dividers |
| `--selection-bg` | `#0000000d` | `#ffffff14` | text selection |
| `--button-bg` | `#000` | `#fff` | tooltip background |
| `--button-text` | `#fafafa` | `#0a0a0a` | tooltip text |
| `--dock-shadow` | `0 2px 2px 0 #00000014, 0 12px 20px 0 #0000001f` | none (inset 1px `--border-soft` ring) | floating dock |
| `--accent` | `#fb5ab2` (pink) | same | **focus ring only** |

Sticky note (case-study quote): background `#ffe398`, text `#2b2410`, attribution `#6f5f2e`. The same in both themes.

## Typography

Font stack: `Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`. Use `-webkit-font-smoothing: antialiased`.

| Role | Size / line | Weight | Colour |
|---|---|---|---|
| Everything by default (body, links, headings, dates) | 14 / 22 | 400 | `--text`, links `--text-strong`, headings `--text-muted` |
| Case-study prose, summary, callout | 14 / 24 | 400 | `--text` |
| Small UI (tooltip, captions, contents links, quote attribution) | 12 / 18 | 400 | per component |
| Before/after tags | 11 / 18 | 400 | `#fafafa` |
| Footnote | 11 / 18 | 400 | `--text-muted` |
| Sticky-note quote | 14 / 22 | 400, key phrases 600 | `#2b2410` |
| Swan speech (pond only) | 17px (15px mobile), line-height 1.5 | 700 | Gaegu |

- Headings (`h1`, `h2`) look exactly like body text: 14/22, weight 400, coloured `--text-muted`. The case-study title is the exception, in `--text-strong`.
- Numbers that tick, such as the clock, use `font-variant-numeric: tabular-nums`.
- The greeting line mixes scripts: "jahnavi," in Inter, the Hindi in Noto Sans Devanagari, the Sindhi in Noto Naskh Arabic (`dir="rtl"`).

## Layout and spacing

**Column:** `width: 540px; max-width: calc(100% - 60px); margin: 0 auto`. At ≤720px: `width: calc(100% - 40px); max-width: 560px`, giving a 20px gutter. The single breakpoint is **720px**. The case-study contents uses a second one at **1100px**.

**Vertical rhythm (desktop, with ≤720px in brackets):**

| Where | Value |
|---|---|
| Homepage top padding | 56px (32px) |
| Homepage bottom padding | 111px (80px) |
| Gap between top-level blocks in the column | 36px (26px) |
| `.stack` gap | 18px |
| `.body-copy` gap (greeting to paragraphs) | 14px (12px) |
| `.information` gap between paragraphs | 12px (10px) |
| Link section: heading to rows | 14px |
| Link section: bottom margin | 24px |
| `.link-groups` gap | 4px |
| Link row grid gap | 6px row, 16px column; each row at least 46px tall |
| Connect section: heading to copy | 14px; between paragraphs 12px |
| Footer banner | padding 48px 20px 0; note margin-bottom 48px |
| Case-study page top padding | 196px (130px) |
| Case-study page bottom padding | 111px (80px) |

**Radii:** pills `999px`. Figure frames and the lightbox image `12px`. Tiles `8px`. Tooltip `6px`. Selection rectangles `5px`. Sticky note `2px`. Focus ring corners `2px`.

**Dividers:** a zero-height element whose `::before` draws a `1px solid var(--border-faint)` rule, so it never shifts layout.

## Motion

| Name | Curve | Used for |
|---|---|---|
| out-expo-ish | `cubic-bezier(.22, 1, .36, 1)` | underline wipe (.38s), external arrow (.42s), slider handle (.2s), toggle press (.22s) |
| soft-out | `cubic-bezier(.16, 1, .3, 1)` | theme toggle opacity (.28s), colour (.24s), icon crossfade (.36s) and spin (.64s) |
| tooltip | `cubic-bezier(.25, .46, .45, .94)` | tooltip fade (.15s) |
| entrance | `cubic-bezier(.22, .61, .36, 1)` | `.appear` (.5s) |
| plain | linear/ease, `.16s` | link and icon colour changes |

- **Entrance:** every `.appear` element starts at `opacity: 0; transform: translateY(6px)` and animates to rest over .5s. Delays stagger in DOM order: `40ms + index × 60ms`.
- **Reduced motion:** `.appear` shows instantly, all transitions drop to .001ms, and the theme icons only crossfade.
- **Theme switch:** add `is-theme-switching` to `<html>` for one tick while swapping `data-theme`. That freezes every transition except the toggle's own icon crossfade, so the whole palette changes at once instead of animating.

## Components

### Links (inline and in rows)
- The colour is `--text-strong` with no underline at rest. The label is wrapped in `.link-label`.
- **Hover:** a 1px underline in `--text-strong` wipes in from the left (`transform: scaleX(0 → 1)`, origin left, .38s out-expo-ish). Keyboard focus shows the same underline at 2px.
- **External links** (`target="_blank"`) also show an 11×11 arrow (↗) 5px to the right of the label, 4px from the top. At rest it sits at opacity 0, nudged (-3px, 3px). On hover it moves to opacity .8 at position 0, with opacity over .24s and transform over .42s. The arrow is a CSS mask of `arrow.svg`, filled with `--text-strong`.
- **Disabled entries** (e.g. "soon") are `--text-muted` with no underline.

### Link rows (Projects / Playground)
- A two-column grid: the name flexes, the date or meta hugs the right edge, and both share a baseline.
- Names are `--text-strong`. Dates are `--text-muted`, right-aligned and unwrapped.
- Each section is a muted 14px heading, then the rows. Sections are separated by faint dividers.

### Greeting line
- `display: flex; align-items: flex-end; gap: 6px; color: --text-muted; white-space: nowrap; margin-left: -1px`.
- Hovering the Hindi or Sindhi name shows a tooltip reading "Hindi" or "Sindhi".

### Tooltip
- **Look:** `--button-bg` background, `--button-text` text, 12/18, padding 4px 10px, radius 6px, no shadow. It fades in over .15s. Wraps at max 260px on mobile.
- **Behaviour:** it follows the pointer, sitting just above it, so it never covers the line being pointed at.
  - On each mouse move: `left = clientX`, `top = clientY - 14`, `transform: translate(-4px, -100%)`.
  - It shows on mouse enter and hides 120ms after mouse leave.
  - Keyboard focus shows it above the element's centre.
  - On touch, a tap toggles it at the tap point (10px higher), and a tap elsewhere closes it.
  - It lives in a fixed layer on `<body>`.

### Copy button
- An inline text button reading "copy", 14/22 `--text-muted`, 6px left of the email. It turns `--text-strong` on hover.
- On click it writes the value to the clipboard and reads "copied" for 1400ms.

### Theme toggle
- Fixed top-right, 16px from the edges (plus safe-area insets). A 24×24 round button, transparent, `--text-muted` at opacity .55.
- **Hover/focus:** `--text-strong`, opacity 1. **Press:** `scale(.92)`.
- Two 15px stroked icons (sun and moon, stroke 1.8) share one grid cell. Light shows the sun; dark shows the moon.
- On switch, the outgoing icon fades and spins 360°, and the incoming one spins in from -360°, with .36s opacity and .64s rotation.
- The choice is stored in `localStorage` (`theme`). A script in `<head>` applies it before paint, falling back to the system theme.

### Floating dock
- Fixed bottom-centre, 20px above the bottom (plus safe area). A pill with padding 6px and gap 6px, `--bg-surface` background, `--dock-shadow`. In dark mode it has a 1px inset `--border-soft` ring instead of the shadow.
- Icons are 32px circles in `--bg-icon`, hovering to `--bg-icon-hover`.

### Time strip (above the hero)
- Reads `bangalore, ka | 02:24pm` in 14/22 `--text-muted`. The clock is Asia/Kolkata, 12-hour, lowercase am/pm, tabular numbers, and updates every second.

### Work tabs
- A row of text pills: padding 3px 10px, radius 999px, 14/22 `--text-muted`, gap 4px. The row is pulled left by 10px so the first label lines up with the column.
- Hover is `--text-strong`. The active tab is `--text-strong` on `--bg-icon`.

### Gallery tiles
- A two-column grid (one column at ≤480px), gap 20px 16px. Each tile is a 4:3 box in `--bg-icon` with a 1px inset `--border-soft` ring and radius 8px.
- Under each tile is a meta row in 12/18 `--text-muted`, name left and type right, 8px above.

### Text selection
- Selections are drawn as **rounded rectangles** instead of the browser's square highlight. The native highlight goes transparent while these show.
  - On every selection change (throttled to one animation frame), measure each selected text node's line boxes.
  - Merge boxes on the same line: vertical overlap over half the shorter box and a horizontal gap of 32px or less.
  - Pad each merged box by 3px sideways and 1px vertically, then draw it in `--selection-bg` with radius 5px.
- **Fallback:** it stands down and leaves the native highlight in place inside inputs, when the page is pinch-zoomed or scrolled sideways, or if a box would leave the viewport.
- **Skipped boxes:** under 6px tall, over 80px tall, or wider than 92% of the viewport. At most 80 boxes are drawn.

### Focus
- `:focus-visible` is a `2px solid var(--accent)` (pink) outline, offset 2px, radius 2px. This is the only place the accent appears.

## Case-study page

- **Shell:** the same 540px column. Top padding is 196px (130px mobile) and bottom padding 111px (80px).
- **Contents:**
  - At ≥1100px it's fixed to the viewport at `top: 196px; left: 64px`, 200px wide, level with the title.
  - It shows a 14px return-arrow icon linking back, then the section links, 14px gap between the two parts.
  - Links are 12/18 `--text-muted`, 24px apart (6px gap). The current section turns `--text-strong`, with no underline. It's tracked by an IntersectionObserver with rootMargin `-25% 0px -60% 0px`.
  - Below 1100px the contents becomes a wrapping row above the title, with gaps of 4px and 16px and 28px below it.
- **Header:** title 14/22 `--text-strong`, meta 14/22 `--text-muted`, summary 14/24 `--text` with 10px above it. Gap 8px. A faint divider follows.
- **Sections:** 40px apart. Each has a muted 14/22 heading, then the prose 14px below it. Prose blocks are 16px apart, and paragraphs are 14/24 with `text-wrap: pretty`.
- **Lists:** items 4px apart, each with an 18px indent and a muted "–" marker. A lead-in line directly above a list sits 8px from it, not the usual 16px.
- **Quote as a sticky note:**
  - Background `#ffe398`, padding 22px 22px 18px, radius 2px, rotated -0.7°.
  - Shadow `0 1px 1px #00000020, 0 14px 22px -10px #00000066`.
  - Spacing: margin 12px above and 14px below (with the 16px gap, about 28px and 30px).
  - Text 14/22 `#2b2410` with key phrases at weight 600. Attribution 12/18 `#6f5f2e`, 12px below the text.
- **Figures:**
  - A frame with `1px dashed var(--border-soft)`, radius 12px, `--bg-surface` background, overflow hidden. The image fills the width at its natural height.
  - Caption 12/18 `--text-muted`, centred, `text-wrap: balance`, 10px below. 14px above each figure.
  - The cursor is `zoom-in`.
- **Lightbox:** clicking a figure opens a native `<dialog>` covering the viewport.
  - Background is `--page` at 98% opacity, padding 56px 24px 40px.
  - The large copy of the image is centred at `max-width: min(100%, 1400px)` with radius 12px, and the caption sits 14px below it. Tall images scroll inside the dialog.
  - A 32px round close button sits fixed at the top right (20px, 20px), in `--bg-icon`.
  - Esc, clicking anywhere or the × closes it. The page behind can't scroll. The cursor is `zoom-out`.
- **Before/after slider:**
  - Two same-size images stacked: "after" underneath, "before" on top, clipped with `clip-path: inset(0 X% 0 0)`.
  - **Divider:** a 2px white line with a 1px dark hairline shadow. In its middle is a 36px white circular handle with a left/right chevron icon and shadow `0 2px 2px #00000014, 0 8px 18px #00000040`. The handle scales to 1.08 while dragging.
  - **Tags:** "Before" and "After" pills in the top corners, 10px in, 11/18 `#fafafa` on `#141414b8`.
  - **Input:** drag anywhere or tap to jump. Arrow keys move it 2% (10% with Shift), and Home and End jump to the ends. `touch-action: pan-y` so pages still scroll. The cursor is `ew-resize`.
- **Callout:** 40px below the last section, one line in 14/24 `--text`. An "Ask about this work" link sits 8px below it.
- **Footnote:** 28px of padding above it, with a 96px-wide 1px `--border-soft` rule at the top-left. Text is 11/18 `--text-muted`.

## Sounds

There are no audio files and no library: everything is synthesised with the Web Audio API. Each sound is a short burst of decaying white noise through a band-pass filter, plus a faint sine blip. Both feed one output gain.

| | Press (link or button) | Hover (link or button) |
|---|---|---|
| Noise length | 22ms | 14ms |
| Noise decay constant τ (`exp(-i/τ)`) | 2.2ms | 1.6ms |
| Band-pass frequency / Q | 4800Hz / 1.4 | 5400Hz / 1.8 |
| Noise envelope | 0.18, exponential to 0.0001 over length + 6ms | 0.14, same shape |
| Sine blip | 1900Hz, peak 0.045 at 1ms, exponential to 0.0001 by 25ms | 2600Hz, peak 0.018 at 1ms, to 0.0001 by 12ms |
| Output gain | 0.42 | 0.38 |

Rules:
- **Unlocking:** create the AudioContext on the user's first `pointerdown`, `keydown` or `touchstart`, and play one silent 1-sample buffer then so iOS allows later sounds. Before that, everything is silent.
- **Press:** fires on `pointerdown` with the primary button on any `a` or `button`. Phones that support it also get an 8ms haptic tap (`navigator.vibrate(8)`).
- **Hover:** fires on `pointerover` only for a fine mouse (`(hover: hover) and (pointer: fine)`, pointerType mouse). Moving within the same element doesn't repeat it, and hovers less than 90ms apart are skipped, so sweeping a list doesn't buzz.

## Appendix A: the full stylesheet

The site's `globals.css`, exactly as it is. The pond and Spline sections can be ignored in the artifact.

```css
/* ==========================================================================
   Design tokens
   Palette, type scale and spacing transcribed from the reference stylesheet.
   ========================================================================== */

:root {
  --pink-400: #fb5ab2;
  --accent: var(--pink-400);

  /* --font-inter is injected by next/font (self-hosted, no CDN request).
     Kept under the --font-sf name so the token matches the reference stack. */
  --font-sf: var(--font-inter), -apple-system, BlinkMacSystemFont,
             "Helvetica Neue", Arial, sans-serif;

  /* light */
  --page: #fafafa;
  --bg-surface: #fff;
  --bg-icon: #f9f9f9;
  --bg-icon-hover: #efefef;
  --text: #000;
  --text-strong: #000;
  --text-muted: #9f9f9f;
  --border-soft: #e4e4e4;
  --border-faint: #f5f5f5;
  --selection-bg: #0000000d;
  --button-bg: #000;
  --button-text: #fafafa;
  --dock-shadow: 0 2px 2px 0 #00000014, 0 12px 20px 0 #0000001f;
}

[data-theme="dark"] {
  --page: #0e0e0e;
  --bg-surface: #111;
  --bg-icon: #171717;
  --bg-icon-hover: #1f1f1f;
  --text: #b0b0b0;
  --text-strong: #fff;
  --text-muted: #6e6e6e;
  --border-soft: #1c1c1c;
  --border-faint: #141414;
  --selection-bg: #ffffff14;
  --button-bg: #fff;
  --button-text: #0a0a0a;
  --dock-shadow: none;
}

/* ==========================================================================
   Base
   ========================================================================== */

*, *::before, *::after { box-sizing: border-box; }

html, body {
  background: var(--page);
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
  max-width: 100%;
  min-height: 100%;
  margin: 0;
}

body {
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection { background: var(--selection-bg); color: inherit; text-shadow: none; }

/* Text selection is drawn as rounded rectangles by selection-highlight.tsx; the native
   highlight is hidden while that is active (inputs keep the native one). */
html.has-selection-highlight ::selection { color: inherit; background: transparent; }
html.has-selection-highlight input::selection,
html.has-selection-highlight textarea::selection { background: var(--selection-bg); color: inherit; }
.selection-highlight-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  z-index: 2147483646;
  pointer-events: none;
}
.selection-highlight-rect {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--selection-bg);
  border-radius: 5px;
  transform: translate3d(var(--selection-x), var(--selection-y), 0);
}

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }

/* ==========================================================================
   Shell / intro section
   ========================================================================== */

.site {
  width: 100%;
  min-width: 320px;
  overflow-x: clip;
}

.intro-section {
  width: 100%;
  min-height: 742px;
  padding: 56px 0 111px;
  position: relative;
}

/* The single narrow column everything sits in. */
.content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 36px;
  width: 540px;
  max-width: calc(100% - 60px);
  min-height: 0;
  margin: 0 auto;
  position: relative;
}

.stack,
.body-copy,
.information,
.link-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stack,
.body-copy,
.information,
.link-groups,
.link-section,
.link-row,
.names,
.dates { height: auto; }

.stack,
.body-copy,
.information,
.link-section,
.link-row,
.names { min-width: 0; }

.stack { gap: 18px; width: 100%; }

.link-section {
  flex: none;
  gap: 14px;          /* space between the h2 and its rows */
  width: 100%;
  min-height: 70px;
  margin-bottom: 24px;
}

.body-copy {
  flex: none;
  gap: 14px;
  width: 100%;
  position: relative;
}

/* ==========================================================================
   Greetings + intro copy
   ========================================================================== */

.greetings {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  margin-left: -1px;
  padding: 0;
  color: var(--text-muted);
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  position: relative;
}

.greetings [lang="hi"] { font-family: var(--font-devanagari), var(--font-sf); }
.greetings [lang="sd"] { font-family: var(--font-arabic), var(--font-sf); }
.greetings-comma { margin-left: 0; }

/* ==========================================================================
   Pond hero
   ========================================================================== */

/* Same width as the rest of the column: it sits inside .content, so it takes the
   540px measure (or the mobile gutter) with no override of its own. The engine
   scales everything to the frame, so only the aspect ratio is set here.
   Its torn, feathered edge is drawn by the engine as a mask. */
.pond-hero {
  position: relative;
  flex: none;
  /* The engine's torn, feathered edge sits ~2.8% inside the box (measured: the
     water is half-opaque ~15px in on the 540px column, ~10px on the 350px mobile
     one, and slightly deeper on the left than the right because the tear is
     uneven). Growing the box by that much puts the *visible* edge on the column. */
  width: 105.2%;
  margin-left: -2.8%;
  aspect-ratio: 16 / 10;
  background: #2c4e3f; /* shown only if WebGL is unavailable */
  cursor: pointer;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.pond-hero canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
@media (max-width: 720px) {
  .pond-hero { aspect-ratio: 4 / 3; --say-size: 15px; }
}

/* Long-press on a touch screen shouldn't open the browser's callout over the pond. */
.pond-hero { -webkit-touch-callout: none; --say-size: 17px; }

/* The strip above the pond: Bangalore time.
   The pond box is wider than the column (see above), so this sits in a wrapper
   that keeps the strip on the column's own edges. */
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: none;
  width: 100%;
}
.hero-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 24px;
  margin-bottom: -2px; /* the pond's visible edge starts a little inside its box */
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: var(--text-muted);
}
.time-widget { white-space: nowrap; }
.time-widget-clock { font-variant-numeric: tabular-nums; }

/* The swans' handwritten remarks, lifted from the artifact. The engine creates the
   overlay and places each remark over its swan's head; the ink colour follows the hour. */
.pond-talk { position: absolute; inset: 0; pointer-events: none; overflow: visible; z-index: 2; }
.pond-say {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  font-family: var(--say-font, var(--font-hand, "Gaegu")), cursive;
  font-size: var(--say-size, 20px);
  font-style: var(--say-style, normal);
  line-height: 1.5;
  white-space: nowrap;
}
.pond-say > span {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -100%) rotate(var(--tilt, 0deg));
  animation: pond-say linear forwards;
}
.pond-say b { font-weight: var(--say-weight, 700); }
.pond-say i { display: inline-block; font-style: inherit; }
.pond-say svg {
  display: block;
  margin: 1px 0 0 -12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
}
/* cross: every letter trembles */
.pond-say.is-cross i { animation: pond-shake 0.09s steps(2) infinite alternate; }
@keyframes pond-say {
  0% { opacity: 0; }
  12% { opacity: 1; }
  78% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes pond-shake {
  0% { transform: translate(-0.5px, 0.3px) rotate(-4deg); }
  100% { transform: translate(0.5px, -0.4px) rotate(4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .pond-say i { animation: none !important; }
}

/* ==========================================================================
   3D stage
   ========================================================================== */

/* How far the viewer is grown past the stage, to push Spline's corner badge
   out of the clipped area. Raise it if any of the pill still shows. */
.spline-stage { --badge-clip: 160px; }

.spline-stage {
  position: relative;
  /* Breaks out of the 540px text column so the scene has room, while the
     copy below it keeps the column. Capped so it stays a block on the page
     rather than going full-bleed. */
  /* 968 x 787, sized against the scene by eye. Width clamps on narrow
     viewports; height is fixed rather than viewport-relative because the
     scene's own copy needs the room — scaling it crops the text. */
  width: min(968px, calc(100vw - 48px));
  margin-left: 50%;
  transform: translateX(-50%);
  height: 787px;
  border-radius: 8px;
  overflow: hidden;
  /* A faint plate so the box reads as deliberate while the scene loads. */
  background: var(--border-faint);
  transition: background .32s cubic-bezier(.16, 1, .3, 1);
}
.spline-stage[data-status="ready"] { background: none; }

/* The viewer is taller than its frame and pulled up by half the difference:
   the scene stays optically centred, and the badge anchored to the viewer's
   bottom edge falls outside the stage's overflow: hidden. */
.spline-stage spline-viewer {
  display: block;
  width: 100%;
  height: calc(100% + var(--badge-clip));
  margin-top: calc(var(--badge-clip) / -2);
}
/* The viewer takes pointer gestures on its canvas; keep vertical page
   scrolling working over the top of it. */
.spline-stage canvas { display: block; touch-action: pan-y !important; }

.spline-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 22px;
}

@media (max-width: 720px) {
  .spline-stage {
    width: calc(100vw - 40px); /* matches the column's gutter */
    /* Keep as much of the 787px as the screen allows — the scene's text needs
       height — without the stage running past a phone viewport. */
    height: min(787px, 76vh);
    --badge-clip: 120px;
  }
}

/* ==========================================================================
   Tooltip
   ========================================================================== */

.cv-tooltip-wrap {
  display: inline-block;
  cursor: default;
  outline: none;
}

/* A floating label that follows the pointer (placed by tooltip.tsx, portalled to the body). */
.cv-tooltip {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--button-bg);
  color: var(--button-text);
  font-family: var(--font-sf);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s cubic-bezier(.25, .46, .45, .94);
}
.cv-tooltip-visible {
  opacity: 1;
  will-change: opacity, transform;
}
@media (max-width: 720px) {
  .cv-tooltip { white-space: normal; max-width: 260px; }
}

.information {
  flex: none;
  gap: 12px;
  width: 100%;
}

.information p,
.names {
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  /* Link rows sit at full strength, brighter than body copy (--text).
     `.names a` inherits this. */
  color: var(--text-strong);
}

.information p {
  width: 100%;
  max-width: 100%;
  margin: 0;
  color: var(--text);
  hyphens: none;
  overflow-wrap: break-word;
  letter-spacing: 0;
  flex: none;
}

.information a,
.connect-copy a {
  color: var(--text-strong);
  text-decoration: none;
  transition: color .16s;
  position: relative;
}

.information a:hover,
.information a:focus-visible,
.connect-copy a:hover,
.connect-copy a:focus-visible { outline: none; }

/* Underline wipes in from the left on hover — it is not present at rest. */
.link-label::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--text-strong);
  transform: scaleX(0);
  transform-origin: 0;
  transition: transform .38s cubic-bezier(.22, 1, .36, 1);
  pointer-events: none;
  backface-visibility: hidden;
  will-change: transform;
}

.names a:hover .link-label::after,
.names a:focus-visible .link-label::after,
.information a:hover .link-label::after,
.information a:focus-visible .link-label::after,
.connect-copy a:hover .link-label::after,
.connect-copy a:focus-visible .link-label::after { transform: scaleX(1); }

/* Keyboard focus gets a heavier rule than hover. */
a[href]:focus-visible .link-label::after { height: 2px; transform: scaleX(1); }

/* Non-links (e.g. "soon") never underline. */
.link-disabled .link-label::after { display: none; }

/* ==========================================================================
   Link groups (Projects / Playground / Notes)
   ========================================================================== */

.link-groups {
  display: flex;
  flex-direction: column;
  flex: none;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  min-height: 176px;
  padding: 0;
}

.link-section h2,
.connect-section h2 {
  margin: 0;
  color: var(--text-muted);
  font-family: var(--font-sf);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
}

/* Two-column rows: name flexes, date hugs right, both on a shared baseline. */
.link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px 16px;
  width: 100%;
  min-height: 46px;
  font-size: 14px;
  line-height: 22px;
}

.names a {
  width: fit-content;
  color: inherit;
  text-decoration: none;
  text-underline-offset: 3px;
  line-height: 22px;
  transition: color .16s;
  position: relative;
}
.names a:hover,
.names a:focus-visible { outline: none; }

/* Arrow shown only on links that open in a new tab. Masked rather than
   inlined so it inherits the themed --text-strong colour. */
.names a[target="_blank"]::after {
  content: "";
  display: block;
  position: absolute;
  top: 4px;
  left: calc(100% + 5px);
  width: 11px;
  height: 11px;
  background-color: var(--text-strong);
  opacity: 0;
  transform: translate(-3px, 3px);
  transform-origin: 50%;
  transition: opacity .24s, transform .42s cubic-bezier(.22, 1, .36, 1);
  will-change: opacity, transform;
  -webkit-mask-image: url(/arrow.svg);
  mask-image: url(/arrow.svg);
  -webkit-mask-position: 50%;
  mask-position: 50%;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
.names a[target="_blank"]:hover::after,
.names a[target="_blank"]:focus-visible::after { opacity: .8; transform: translate(0); }

.dates {
  color: var(--text-muted);
  font-family: var(--font-sf);
  text-align: right;
  white-space: nowrap;
}

.link-label {
  display: inline-block;
  line-height: 22px;
  position: relative;
}

.link-disabled { color: var(--text-muted); cursor: default; }

/* Zero-height rule drawn by a pseudo-element, so it never affects layout. */
.link-divider {
  flex: none;
  width: 100%;
  height: 0;
  position: relative;
}
.link-divider::before {
  content: "";
  border-top: 1px solid var(--border-faint);
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* ==========================================================================
   Connect + footer
   ========================================================================== */

.connect-section { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.connect-copy { display: flex; flex-direction: column; gap: 12px; }
.connect-copy p { margin: 0; color: var(--text); }

.copy-button {
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: var(--text-muted);
  background: none;
  border: 0;
  padding: 0 0 0 6px;
  cursor: pointer;
  transition: color .16s;
}
.copy-button:hover { color: var(--text-strong); }

.footer-banner {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 48px 20px 0;
  position: relative;
}

.footer-note {
  margin: 0 0 48px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 22px;
}

/* ==========================================================================
   Theme toggle (top-right anchor)
   ========================================================================== */

.theme-toggle-anchor {
  position: fixed;
  top: max(16px, calc(16px + env(safe-area-inset-top, 0px)));
  right: max(16px, calc(16px + env(safe-area-inset-right, 0px)));
  z-index: 51;
  pointer-events: auto;
}

.theme-toggle-anchor .theme-toggle {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  color: var(--text-muted);
  opacity: .55;
  cursor: pointer;
  transition: opacity .28s cubic-bezier(.16, 1, .3, 1),
              color .24s cubic-bezier(.16, 1, .3, 1),
              background-color .32s cubic-bezier(.16, 1, .3, 1),
              transform .22s cubic-bezier(.22, 1, .36, 1);
}
.theme-toggle-anchor .theme-toggle:hover,
.theme-toggle-anchor .theme-toggle:focus-visible {
  color: var(--text-strong);
  opacity: 1;
  outline: none;
}
.theme-toggle-anchor .theme-toggle:active {
  transform: scale(.92);
  transition: color 90ms, transform .14s cubic-bezier(.22, 1, .36, 1);
}

/* Both glyphs share one grid cell and cross-fade. */
.theme-toggle-icon {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  will-change: transform, opacity;
  transition: opacity .36s cubic-bezier(.16, 1, .3, 1),
              transform .64s cubic-bezier(.16, 1, .3, 1);
}
.theme-toggle-invert-1 { opacity: 1; transform: rotate(0); }
.theme-toggle-invert-2 { opacity: 0; transform: rotate(-360deg); }
[data-theme="dark"] .theme-toggle-invert-1 { opacity: 0; transform: rotate(360deg); }
[data-theme="dark"] .theme-toggle-invert-2 { opacity: 1; transform: rotate(0); }

@media (prefers-reduced-motion: reduce) {
  .theme-toggle-icon {
    transition: opacity .18s linear;
    transform: none !important;
  }
}

/* Freeze every transition while the palette swaps over. */
html.is-theme-switching,
html.is-theme-switching *,
html.is-theme-switching *::before,
html.is-theme-switching *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
/* ...except the toggle itself, whose crossfade is the feedback for the click. */
html.is-theme-switching .theme-toggle-icon {
  transition-duration: .36s, .64s !important;
}

/* ==========================================================================
   Floating dock
   ========================================================================== */

.floating-dock {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 999px;
  background: var(--bg-surface);
  box-shadow: var(--dock-shadow);
  z-index: 20;
}
[data-theme="dark"] .floating-dock { box-shadow: inset 0 0 0 1px var(--border-soft); }

.floating-dock-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--bg-icon);
  color: var(--text-strong);
  cursor: pointer;
  transition: background .16s;
}
.floating-dock-icon:hover { background: var(--bg-icon-hover); }

/* ==========================================================================
   Entrance animation
   ========================================================================== */

.appear {
  opacity: 0;
  transform: translateY(6px);
  animation: appear .5s cubic-bezier(.22,.61,.36,1) forwards;
  animation-delay: var(--appear-delay, 0ms);
}
@keyframes appear {
  to { opacity: 1; transform: translateY(0); }
}

/* ==========================================================================
   Responsive — breakpoint and values from the reference stylesheet
   ========================================================================== */

@media (max-width: 720px) {
  .intro-section {
    height: auto;
    min-height: 0;
    padding: 32px 0 80px;
  }
  .content {
    gap: 26px;
    width: calc(100% - 40px);
    max-width: 560px;
    height: auto;
    margin: 0 auto;
    position: relative;
    top: auto;
    left: auto;
    transform: none;
  }
  .body-copy { gap: 12px; }
  .information { gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .appear {
    opacity: 1;
    transform: none;
    animation: none;
  }
  * { transition-duration: .001ms !important; }
}

/* ==========================================================================
   Work pages
   ========================================================================== */

.work-title {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--text-strong);
}

.work-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-left: -10px; /* the first tab's text lines up with the column */
}
.work-tab {
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color .16s, background-color .16s;
}
.work-tab:hover { color: var(--text-strong); }
.work-tab[aria-current="page"] { color: var(--text-strong); background: var(--bg-icon); }

.work-list { margin-top: 4px; }
.work-item { display: contents; }

.work-article { display: flex; flex-direction: column; gap: 14px; width: 100%; }
.work-article-title {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--text-muted);
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.work-tile-art {
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  background: var(--bg-icon);
  box-shadow: inset 0 0 0 1px var(--border-soft);
}
.work-tile-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-family: var(--font-sf);
  font-size: 12px;
  line-height: 18px;
  color: var(--text-muted);
}
@media (max-width: 480px) {
  .work-grid { grid-template-columns: minmax(0, 1fr); }
}

.work-back { color: var(--text-muted); text-decoration: none; transition: color .16s; }
.work-back:hover,
.work-back:focus-visible { color: var(--text-strong); }

/* ==========================================================================
   Case study pages (layout after Juliette's case studies)
   ========================================================================== */

.cs-page {
  width: 100%;
  padding: 196px 0 111px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
}
@media (max-width: 720px) {
  .cs-page { padding: 130px 0 80px; }
  .cs-index { width: calc(100% - 40px); margin: 0 auto 28px; }
}

/* Contents: a row above the text on narrow screens; a fixed column on the left
   of the text column on wide ones, so it never takes up the reading width. */
.cs-index {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 28px;
  font-family: var(--font-sf);
  font-size: 12px;
  line-height: 18px;
}
.cs-index-back { display: inline-flex; align-items: center; color: var(--text-muted); text-decoration: none; transition: color .2s; }
.cs-index-back:hover,
.cs-index-back:focus-visible { color: var(--text-strong); outline: none; }
.cs-index-list { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; padding: 0; list-style: none; }
.cs-index-list a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color .2s;
}
.cs-index-list a:hover,
.cs-index-list a:focus-visible { color: var(--text-strong); outline: none; }
.cs-index-list a[aria-current="location"] { color: var(--text-strong); }

@media (min-width: 1100px) {
  .cs-index {
    position: fixed;
    top: 196px; /* level with the title */
    left: 64px;
    width: 200px;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    margin: 0;
    z-index: 5;
  }
  .cs-index-list { flex-direction: column; gap: 6px; } /* 24px between links */
}

.cs-article {
  display: flex;
  flex-direction: column;
  gap: 40px;
  width: 100%;
}

.cs-header { display: flex; flex-direction: column; gap: 8px; }
.cs-title {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--text-strong);
}
.cs-meta {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: var(--text-muted);
}
.cs-summary {
  margin: 10px 0 0;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 24px;
  color: var(--text);
  text-wrap: pretty;
}

.cs-section { display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 96px; }
.cs-subhead {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--text-muted);
}
.cs-prose { display: flex; flex-direction: column; gap: 16px; }
.cs-prose > p,
.cs-list li {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 24px;
  color: var(--text);
  text-wrap: pretty;
}

/* The quote sits on a sticky note, like the ones from discovery (same yellow). */
.cs-note {
  margin: 12px 0 14px; /* with the 16px gap: 28px above and 30px below */
  padding: 22px 22px 18px;
  background: #ffe398;
  color: #2b2410;
  border-radius: 2px;
  box-shadow: 0 1px 1px #00000020, 0 14px 22px -10px #00000066;
  transform: rotate(-.7deg);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cs-note p {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 22px;
  color: #2b2410;
  text-wrap: pretty;
}
.cs-note strong { font-weight: 600; }
.cs-note footer {
  font-family: var(--font-sf);
  font-size: 12px;
  line-height: 18px;
  color: #6f5f2e;
}

.cs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-list li { position: relative; padding-left: 18px; }
/* a lead-in line belongs to the list under it: 8px, not the usual 16px */
.cs-prose > p + .cs-list { margin-top: -8px; }
.cs-list li::before {
  content: "–";
  position: absolute;
  left: 0;
  color: var(--text-muted);
}

.cs-figure { margin: 14px 0 0; width: 100%; }
.cs-figure-frame {
  border: 1px dashed var(--border-soft);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-surface);
}
.cs-figure img {
  display: block;
  width: 100%;
  height: auto;
}
.cs-figure figcaption {
  margin-top: 10px;
  font-family: var(--font-sf);
  font-size: 12px;
  line-height: 18px;
  color: var(--text-muted);
  text-align: center;
  text-wrap: balance;
}

.cs-callout {
  margin-top: 40px;
  font-family: var(--font-sf);
  font-size: 14px;
  line-height: 24px;
  color: var(--text);
}
.cs-callout p { margin: 0; }
.cs-callout a {
  display: inline-block;
  margin-top: 8px;
  color: var(--text-strong);
  text-decoration: none;
  line-height: 22px;
}
.cs-callout a:hover,
.cs-callout a:focus-visible { outline: none; }

.cs-footnote {
  position: relative;
  width: 100%;
  padding-top: 28px;
}
.cs-footnote::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 96px;
  height: 1px;
  background: var(--border-soft);
}
.cs-footnote p {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 11px;
  line-height: 18px;
  color: var(--text-muted);
}

/* Figures open larger on click. */
.cs-figure-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
}
.cs-figure-open:focus-visible { outline-offset: -2px; }

.cs-lightbox {
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 56px 24px 40px;
  border: 0;
  background: color-mix(in srgb, var(--page) 98%, transparent);
  color: var(--text-muted);
  overflow: auto;
  cursor: zoom-out;
}
.cs-lightbox[open] { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.cs-lightbox::backdrop { background: transparent; }
.cs-lightbox img {
  display: block;
  width: auto;
  max-width: min(100%, 1400px);
  height: auto;
  border-radius: 12px;
  /* a wide image fits the width; a tall one scrolls */
}
.cs-lightbox p {
  margin: 0;
  font-family: var(--font-sf);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.cs-lightbox-close {
  position: fixed;
  top: 20px;
  right: 20px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--bg-icon);
  color: var(--text-strong);
  cursor: pointer;
}
.cs-lightbox-close:hover { background: var(--bg-icon-hover); }
body:has(.cs-lightbox[open]) { overflow: hidden; }

/* Before / after slider */
.cs-compare {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px dashed var(--border-soft);
  border-radius: 12px;
  background: var(--bg-surface);
  cursor: ew-resize;
  touch-action: pan-y; /* a horizontal drag moves the divider; vertical still scrolls */
  user-select: none;
  -webkit-user-select: none;
}
.cs-compare-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.cs-compare-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #fff;
  box-shadow: 0 0 0 1px #00000026;
  pointer-events: none;
}
.cs-compare-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #141414;
  box-shadow: 0 2px 2px #00000014, 0 8px 18px #00000040;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
  pointer-events: auto;
  transition: transform .2s cubic-bezier(.22, 1, .36, 1);
}
.cs-compare.is-dragging .cs-compare-handle { transform: translate(-50%, -50%) scale(1.08); }
.cs-compare-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.cs-compare-tag {
  position: absolute;
  top: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #141414b8;
  color: #fafafa;
  font-family: var(--font-sf);
  font-size: 11px;
  line-height: 18px;
  pointer-events: none;
}
.cs-compare-tag-before { left: 10px; }
.cs-compare-tag-after { right: 10px; }
```

## Appendix B: behaviour code

The React and TypeScript sources for every interactive piece. Port each one to plain JavaScript in the artifact and keep the logic the same.

### `app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Naskh_Arabic, Gaegu } from "next/font/google";
import "./globals.css";
import SiteBehaviour from "./site-behaviour";
import SelectionHighlight from "./selection-highlight";
import UiSounds from "./ui-sounds";
import Dock from "./dock";
import ThemeToggle from "./theme-toggle";

// Self-hosted at build time — no runtime CDN request. Exposed as --font-inter,
// which globals.css feeds into the --font-sf token.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-inter",
});

// Inter has no Devanagari or Arabic coverage, so the name in those scripts
// would otherwise fall back to whatever the OS happens to have.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400"],
  display: "swap",
  variable: "--font-devanagari",
});

const arabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-arabic",
});

// The swans' handwritten remarks in the pond (--font-hand, picked up by .pond-say).
const hand = Gaegu({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "Portfolio — Homepage",
  description: "Single-column portfolio homepage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
};

// Runs before first paint so there's no flash of the wrong palette.
const themeInit = `
(function(){
  try{
    var s = localStorage.getItem('theme');
    var m = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = (s === 'light' || s === 'dark') ? s : (m ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${devanagari.variable} ${arabic.variable} ${hand.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeToggle />
        {children}
        <Dock />
        <SiteBehaviour />
        <SelectionHighlight />
        <UiSounds />
      </body>
    </html>
  );
}
```

### `app/site-behaviour.tsx`

```tsx
"use client";

import { useEffect } from "react";

/**
 * Behaviour layer.
 *
 * Just the staggered entrance now — each `.appear` element gets an increasing
 * `--appear-delay` so the page resolves top to bottom instead of all at once.
 */

const STAGGER_MS = 60; // gap between successive .appear elements
const BASE_DELAY_MS = 40; // delay before the first one

export default function SiteBehaviour() {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".appear").forEach((el, i) => {
      el.style.setProperty("--appear-delay", `${BASE_DELAY_MS + i * STAGGER_MS}ms`);
    });
  }, []);

  return null;
}
```

### `app/ui-sounds.tsx`

```tsx
"use client";

import { useEffect } from "react";

/**
 * Interface sounds, synthesised with Web Audio (no files, no library).
 *
 * A press on a link or button makes a small "tick": a 22ms burst of band-passed noise
 * with a short 1.9kHz sine blip. Moving the mouse onto one makes a quieter, higher
 * version. The sounds follow the reference site's: same filters, pitches, lengths and
 * gains.
 *
 * Rules:
 *  - the AudioContext is created and unlocked on the first press/key/touch, because
 *    browsers keep audio silent before that (so hovers before it are silent too);
 *  - hover is for a fine mouse only, not touch; moving within one link does nothing, and
 *    hovers closer than 90ms apart are skipped, so sweeping a list doesn't buzz;
 *  - phones that support it also get an 8ms haptic tap on press.
 */
const BURST_PRESS = { len: 0.022, decay: 0.0022, freq: 4800, q: 1.4, noise: 0.18, tone: 1900, toneGain: 0.045, toneLen: 0.025, out: 0.42 };
const BURST_HOVER = { len: 0.014, decay: 0.0016, freq: 5400, q: 1.8, noise: 0.14, tone: 2600, toneGain: 0.018, toneLen: 0.012, out: 0.38 };
const HOVER_GAP_MS = 90;
const TARGET = "a, button";

type Voice = typeof BURST_PRESS;

function tick(ctx: AudioContext, v: Voice) {
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = v.out;
  out.connect(ctx.destination);

  // the click itself: a very short decaying burst of noise, band-passed
  const n = Math.floor(v.len * ctx.sampleRate);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const tau = v.decay * ctx.sampleRate;
  for (let i = 0; i < n; i++) data[i] = (2 * Math.random() - 1) * Math.exp(-i / tau);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = v.freq;
  band.Q.value = v.q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(v.noise, t);
  env.gain.exponentialRampToValueAtTime(1e-4, t + v.len + 0.006);
  src.connect(band).connect(env).connect(out);
  src.start(t);
  src.stop(t + v.len + 0.008);

  // a faint pitched blip on top, so it reads as a tick rather than static
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = v.tone;
  const oenv = ctx.createGain();
  oenv.gain.setValueAtTime(1e-4, t);
  oenv.gain.exponentialRampToValueAtTime(v.toneGain, t + 0.001);
  oenv.gain.exponentialRampToValueAtTime(1e-4, t + v.toneLen);
  osc.connect(oenv).connect(out);
  osc.start(t);
  osc.stop(t + v.toneLen + 0.005);
}

export default function UiSounds() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let unlocked = false;
    let hovered: Element | null = null;
    let lastHover = 0;

    const context = () => {
      if (ctx) return ctx;
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return Ctor ? (ctx = new Ctor()) : null;
    };

    // Play one silent sample inside a gesture so iOS lets later sounds through.
    const unlock = (c: AudioContext) => {
      if (unlocked) return Promise.resolve();
      unlocked = true;
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
      return c.state === "suspended" ? c.resume().catch(() => {}) : Promise.resolve();
    };

    const onFirstGesture = () => {
      const c = context();
      if (c) void unlock(c);
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
      window.removeEventListener("touchstart", onFirstGesture, true);
    };

    const onPress = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!(e.target as Element | null)?.closest?.(TARGET)) return;
      const c = context();
      if (c) {
        const play = () => c.state === "running" && tick(c, BURST_PRESS);
        if (c.state === "running") play();
        else
          void Promise.resolve(unlock(c))
            .then(() => (c.state === "suspended" ? c.resume() : undefined))
            .then(play)
            .catch(() => {});
      }
      if (typeof navigator.vibrate === "function") navigator.vibrate(8);
    };

    const onOver = (e: PointerEvent) => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.(TARGET);
      if (!el || el === hovered) return;
      const now = performance.now();
      const quick = now - lastHover < HOVER_GAP_MS;
      hovered = el;
      lastHover = now;
      if (quick) return;
      if (ctx && ctx.state === "running") tick(ctx, BURST_HOVER);
    };

    const onOut = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(TARGET) === hovered) hovered = null;
    };

    window.addEventListener("pointerdown", onFirstGesture, true);
    window.addEventListener("keydown", onFirstGesture, true);
    window.addEventListener("touchstart", onFirstGesture, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPress);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
      window.removeEventListener("touchstart", onFirstGesture, true);
      document.removeEventListener("pointerdown", onPress);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      void ctx?.close();
    };
  }, []);

  return null;
}
```

### `app/tooltip.tsx`

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Hover tooltip.
 *
 * The label floats in a portal on the body and follows the pointer, sitting just above
 * it, so it never covers the line of text being pointed at. A short delay on leave stops
 * it flickering. Touch toggles it where you tapped; focus (keyboard) shows it above the
 * element. The trigger carries the label as `aria-description` for screen readers.
 */
const LEAVE_DELAY_MS = 120;
const GAP = 14; // between the pointer and the label's bottom edge

export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => window.clearTimeout(timer.current);
  }, []);

  const place = useCallback((x: number, y: number) => {
    const el = tip.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y - GAP}px`;
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisible(true);
  }, []);
  const hide = useCallback(() => {
    timer.current = window.setTimeout(() => setVisible(false), LEAVE_DELAY_MS);
  }, []);

  // A tap elsewhere dismisses a tooltip opened by touch.
  useEffect(() => {
    if (!visible) return;
    const away = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (!(e.target as Element | null)?.closest?.(".cv-tooltip-wrap")) setVisible(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [visible]);

  return (
    <span
      className="cv-tooltip-wrap"
      tabIndex={0}
      aria-description={label}
      onMouseEnter={(e) => {
        place(e.clientX, e.clientY);
        show();
      }}
      onMouseMove={(e) => place(e.clientX, e.clientY)}
      onMouseLeave={hide}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        place(r.left + r.width / 2, r.top);
        show();
      }}
      onBlur={hide}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) place(t.clientX, t.clientY - 10);
        setVisible((v) => !v);
      }}
    >
      {children}
      {mounted
        ? createPortal(
            <span
              ref={tip}
              className={`cv-tooltip${visible ? " cv-tooltip-visible" : ""}`}
              role="tooltip"
              style={{ transform: "translate(-4px, -100%)" }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
```

### `app/selection-highlight.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Text selection drawn as rounded rectangles instead of the browser's square highlight.
 *
 * On every selection change the selected text nodes are measured line by line; nearby
 * line boxes are merged, padded a little, and drawn as absolutely positioned spans
 * (styled in globals.css). While any are showing, the native highlight is made
 * transparent (`html.has-selection-highlight`). It stands down inside inputs, when the
 * page is pinch-zoomed or scrolled sideways, and if a box would leave the viewport, so
 * the native highlight is never lost without a replacement.
 */
type Box = { left: number; top: number; width: number; height: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const typing = () => {
  const el = document.activeElement;
  return (
    !!el &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      !!el.closest("[contenteditable]:not([contenteditable='false'])"))
  );
};

function textNodes(root: Node): Text[] {
  if (root.nodeType === Node.TEXT_NODE) return [root as Text];
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

function lineRects(range: Range): DOMRect[] {
  const out: DOMRect[] = [];
  for (const node of textNodes(range.commonAncestorContainer)) {
    if (!node.data.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest(".selection-highlight-overlay")) continue;
    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (!range.intersectsNode(node)) continue;
    const start = range.startContainer === node ? Math.min(range.startOffset, node.length) : 0;
    const end = range.endContainer === node ? Math.min(range.endOffset, node.length) : node.length;
    if (start >= end) continue;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, end);
    out.push(...Array.from(r.getClientRects()));
    r.detach();
  }
  return out;
}

const sameLine = (a: Rect, b: Rect) => {
  const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const shorter = Math.min(a.bottom - a.top, b.bottom - b.top);
  const gap = Math.max(b.left - a.right, a.left - b.right, 0);
  return overlap > 0.5 * shorter && gap <= 32;
};

function measure(): Box[] | null {
  if (typing()) return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return [];

  const rects: DOMRect[] = [];
  for (let i = 0; i < sel.rangeCount; i++) rects.push(...lineRects(sel.getRangeAt(i)));

  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  if (
    (vv && (Math.abs(vv.scale - 1) > 0.01 || Math.abs(vv.offsetLeft) > 0.5)) ||
    window.scrollX > 0.5 ||
    rects.some((r) => r.left < -2 || r.right > width + 2)
  ) {
    return null;
  }

  const ox = window.scrollX + (vv?.offsetLeft ?? 0);
  const oy = window.scrollY + (vv?.offsetTop ?? 0);
  const maxWidth = width * 0.92;
  const lines: Rect[] = [];
  for (const r of rects) {
    if (r.width <= 0.5 || r.height < 6 || r.height > 80 || r.width > maxWidth) continue;
    const box = { left: r.left + ox, top: r.top + oy, right: r.right + ox, bottom: r.bottom + oy };
    const hit = lines.find((l) => sameLine(l, box));
    if (hit) {
      hit.left = Math.min(hit.left, box.left);
      hit.top = Math.min(hit.top, box.top);
      hit.right = Math.max(hit.right, box.right);
      hit.bottom = Math.max(hit.bottom, box.bottom);
    } else lines.push(box);
  }
  return lines
    .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top))
    .slice(0, 80)
    .map((l) => {
      const left = Math.max(0, l.left - 3);
      const top = Math.max(0, l.top - 1);
      return { left, top, width: Math.max(0, l.right + 3 - left), height: Math.max(0, l.bottom + 1 - top) };
    })
    .filter((b) => b.width > 0.5 && b.height > 0.5);
}

const same = (a: Box[], b: Box[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i];
    return (
      !!y &&
      Math.abs(x.left - y.left) < 0.5 &&
      Math.abs(x.top - y.top) < 0.5 &&
      Math.abs(x.width - y.width) < 0.5 &&
      Math.abs(x.height - y.height) < 0.5
    );
  });

export default function SelectionHighlight() {
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const update = () => {
      raf = 0;
      try {
        const next = measure();
        if (!next || next.length === 0) {
          root.classList.remove("has-selection-highlight");
          setBoxes((prev) => (prev.length ? [] : prev));
          return;
        }
        root.classList.add("has-selection-highlight");
        setBoxes((prev) => (same(prev, next) ? prev : next));
      } catch {
        root.classList.remove("has-selection-highlight");
        setBoxes([]);
      }
    };
    const queue = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    const vv = window.visualViewport;
    document.addEventListener("selectionchange", queue);
    document.addEventListener("keyup", queue);
    document.addEventListener("pointerup", queue);
    document.addEventListener("touchend", queue);
    window.addEventListener("resize", queue, { passive: true });
    window.addEventListener("scroll", queue, { passive: true });
    vv?.addEventListener("resize", queue, { passive: true });
    vv?.addEventListener("scroll", queue, { passive: true });
    return () => {
      root.classList.remove("has-selection-highlight");
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", queue);
      document.removeEventListener("keyup", queue);
      document.removeEventListener("pointerup", queue);
      document.removeEventListener("touchend", queue);
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue);
      vv?.removeEventListener("resize", queue);
      vv?.removeEventListener("scroll", queue);
    };
  }, []);

  if (boxes.length === 0) return null;
  return (
    <div className="selection-highlight-overlay" aria-hidden="true">
      {boxes.map((b, i) => (
        <span
          key={`${i}-${b.left}-${b.top}`}
          className="selection-highlight-rect"
          style={
            {
              "--selection-x": `${b.left.toFixed(2)}px`,
              "--selection-y": `${b.top.toFixed(2)}px`,
              width: `${b.width.toFixed(2)}px`,
              height: `${b.height.toFixed(2)}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
```

### `app/theme-toggle.tsx`

```tsx
"use client";

/**
 * Theme toggle, anchored top-right.
 *
 * Both icons are always in the DOM stacked in one grid cell; `[data-theme]`
 * decides which is visible. That's how the reference does it — crossfading two
 * static glyphs means no icon swap on hydration and nothing to re-render.
 */
export default function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    // Suppress transitions for the duration of the swap so every themed
    // property doesn't animate at once.
    root.classList.add("is-theme-switching");
    root.setAttribute("data-theme", next);
    window.setTimeout(() => root.classList.remove("is-theme-switching"), 0);

    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage can be unavailable (private mode, blocked cookies) */
    }
  }

  return (
    <div className="theme-toggle-anchor">
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle colour theme"
      >
        {/* light: sun */}
        <span className="theme-toggle-icon theme-toggle-invert-1" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
          </svg>
        </span>

        {/* dark: moon */}
        <span className="theme-toggle-icon theme-toggle-invert-2" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.9 6.9 0 0 0 10.8 10.8Z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
```

### `app/copy-button.tsx`

```tsx
"use client";

import { useState } from "react";

/** Copies a value to the clipboard and briefly confirms. */
export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked (insecure context, denied permission) */
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={copy}
      aria-label={`Copy ${value}`}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
```

### `app/hero-bar.tsx`

```tsx
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
```

### `app/work/case-study-index.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * The jump links for a case study. On wide screens it sits fixed to the left of the
 * column (see `.cs-index` in globals.css); on narrow screens it becomes a row above the
 * text. The link for the section in view is marked as the current one.
 */
export default function CaseStudyIndex({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    // A section counts as "current" while it crosses the upper-middle of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="cs-index appear" aria-label="Contents">
      <a className="cs-index-back" href="/work/case-studies" aria-label="Back to case studies">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.5 1.5v3.2A2.8 2.8 0 0 1 7.7 7.5H1.8" />
          <path d="M4.2 5.1 1.8 7.5l2.4 2.4" />
        </svg>
      </a>
      <ol className="cs-index-list">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### `app/work/figure-image.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import type { Figure } from "./data";

/**
 * A figure's image. Click it to see it larger: a native dialog (so Esc, focus and the
 * backdrop come for free) with the high-resolution copy, which is only fetched on open.
 * Tall images scroll inside the dialog rather than shrinking to fit the height.
 */
export default function FigureImage({ figure }: { figure: Figure }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button type="button" className="cs-figure-open" onClick={show} aria-label={`Enlarge: ${figure.caption}`}>
        <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" />
      </button>
      <dialog
        ref={dialog}
        className="cs-lightbox"
        aria-label={figure.caption}
        onClose={() => setOpen(false)}
        onClick={close}
      >
        {open && (
          <>
            <button type="button" className="cs-lightbox-close" onClick={close} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <path d="m3 3 8 8M11 3l-8 8" />
              </svg>
            </button>
            <img src={figure.src.replace(".webp", "-large.webp")} alt={figure.alt} />
            <p>{figure.caption}</p>
          </>
        )}
      </dialog>
    </>
  );
}
```

### `app/work/compare-slider.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import type { Figure } from "./data";

/**
 * Before / after: two images of the same size stacked, with a draggable divider.
 * The "before" side is on the left and is revealed by clipping, so both images stay
 * perfectly aligned. Works by dragging anywhere on the image, by tapping, and from the
 * keyboard (arrows, Home, End) on the handle. Vertical scrolling still works on touch.
 */
export default function CompareSlider({ before, after }: { before: Figure; after: Figure }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // % of the width showing "before"
  const [dragging, setDragging] = useState(false);

  const moveTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <figure className="cs-figure">
      <div
        ref={box}
        className={`cs-compare${dragging ? " is-dragging" : ""}`}
        style={{ aspectRatio: `${after.width} / ${after.height}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => dragging && moveTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <img className="cs-compare-img" src={after.src} alt={after.alt} draggable={false} />
        <img
          className="cs-compare-img"
          src={before.src}
          alt={before.alt}
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span className="cs-compare-tag cs-compare-tag-before">Before</span>
        <span className="cs-compare-tag cs-compare-tag-after">After</span>

        <div className="cs-compare-line" style={{ left: `${pos}%` }}>
          <button
            type="button"
            className="cs-compare-handle"
            role="slider"
            aria-label="Drag to compare before and after"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
              else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
              else if (e.key === "Home") setPos(0);
              else if (e.key === "End") setPos(100);
              else return;
              e.preventDefault();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" />
            </svg>
          </button>
        </div>
      </div>
      <figcaption>{after.caption}</figcaption>
    </figure>
  );
}
```

### `public/arrow.svg` (external-link arrow, used as a CSS mask)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none"
     stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 9 L9 3"/>
  <path d="M4.2 3 H9 V7.8"/>
</svg>
```
