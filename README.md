# Portfolio homepage scaffold

A Next.js (App Router) rebuild of the single-column portfolio homepage layout.

```bash
npm install
npm run dev     # http://localhost:3000
```

## Files

| File | What's in it |
|---|---|
| `app/page.tsx` | Homepage — section order and element hierarchy |
| `app/globals.css` | Design tokens, spacing, type scale, responsive rules |
| `app/layout.tsx` | Root shell, `next/font` setup, pre-paint theme script |
| `app/site-behaviour.tsx` | Scramble-on-hover + staggered entrance (client) |
| `app/dock.tsx` | Floating dock and theme toggle (client) |
| `app/copy-button.tsx` | Copy-to-clipboard button (client) |
| `app/swan-pond.tsx` | Interactive swan pond above the intro (client) |
| `app/swan-pond-engine.ts` | Pond engine — water + Monet paint shaders, swan steering, weeds, leaves |
| `app/swan-paint.ts` | How each swan is painted (proportions, plumage, wings, neck) |
| `app/swan-pond-tuner.ts` | Time-of-day + colour panel — shown in dev or with `?tune` in the URL |
| `app/swan-pond-recorder.ts` | Records the pond to a video (MP4, or WebM where MP4 isn't available), with the music |
| `app/swan-pond-music.ts` | Background music for the tuner, through Web Audio so one volume feeds the speakers and the recording. The track lives at `public/music/pond-song.mp3`, which is git-ignored |
| `app/swan-pond-time.ts` | Follows the visitor's clock: dawn, day, dusk, dark |
| `app/notes/[slug]/page.tsx` | Note detail route — stub, wire up to your own content |

## What was carried over exactly

These came from the reference stylesheet and are reproduced verbatim:

**Type** — one size for the entire page: `14px / 22px`, weight 400. Headings
(`h2`) are the same size as body copy, differentiated only by colour. This is
the most distinctive thing about the design; don't "fix" it.

**Column** — `540px` wide, `max-width: calc(100% - 60px)`, centred.

**Spacing**

| Token | Desktop | ≤720px |
|---|---|---|
| `.intro-section` padding | `120px 0 111px` | `64px 0 80px` |
| `.content` gap | `36px` | `26px` |
| `.stack` gap | `18px` | — |
| `.body-copy` gap | `14px` | `12px` |
| `.information` gap | `12px` | `10px` |
| `.link-groups` gap | `4px` | — |
| `.link-row` gap | `6px 16px` | — |

**Link rows** — `grid-template-columns: minmax(0, 1fr) auto` with
`align-items: baseline`, `min-height: 46px`. Name flexes, date hugs the right
edge, both sit on a shared baseline.

**Dividers** — `height: 0` with the rule drawn by a `::before`, so they never
contribute to layout height.

**Colours** — full light/dark token sets, including the `#fb5ab2` accent.

**Breakpoint** — a single one at `720px`.

## What's placeholder — replace this

- **All copy.** Every paragraph, project name, date and note title is a
  placeholder. The reference site's actual writing is its author's own content.
- **Avatar** — a CSS circle at the correct `40×40`. Drop in a square image.
- **Images** — none included. The reference site's photography, artwork and
  third-party brand logos aren't redistributable.
- **Social icons** — generic shapes in the dock; swap for real ones.

## Known gaps

**Fonts.** The reference self-hosts a variable Inter under the family name
`"Site Inter"`. Inter is open source (SIL OFL), so this uses `next/font/google`,
which self-hosts it at build time (no runtime CDN request) and exposes it as
`--font-inter`. `globals.css` feeds that into the `--font-sf` token, so the
stack resolves the same way.

**Scramble + entrance animations.** Driven by the reference site's compiled
JavaScript, not its CSS — so these are written from scratch. The behaviour
matches; exact timing/easing will differ. Tune the constants at the top of each
block in `app/site-behaviour.tsx`:

```js
var STAGGER_MS = 60;          // entrance stagger
var FRAME_MS = 28;            // scramble churn rate
var REVEAL_PER_FRAME = 0.34;  // scramble resolve speed
```

**Not built.** The reference homepage also has an image collage
(`.collage-item`, with separate light/dark variants), a footer collage, and a
dock toast. Those are stubbed out or omitted — the collage in particular needs
real images and a grid spec to be worth building. Say the word and I'll add it.

**Dependency audit.** `npm audit` reports two transitive `postcss` advisories
via Next 15. The only clean fix is Next 16, a breaking major, and the advisories
require attacker-controlled CSS — which doesn't apply to a site whose CSS you
author yourself. Left on 15 deliberately; upgrade when you're ready to take the
major.

## The pond as its own site

`pond-site/` is the pond on a page of its own: fullscreen-ish, with the time of day on the right, mute and share buttons on the top bar, and the music.

- Rebuild it with `node scripts/build-pond.mjs` (it bundles the engine from `app/` into `pond-site/index.html`). Your post links and email are in the `SITE` block of `scripts/build-pond.mjs`.
- Deploy on Vercel: New Project, import this repo, set **Root Directory** to `pond-site`, framework preset **Other**, leave the build command empty. Any static host works the same way.
