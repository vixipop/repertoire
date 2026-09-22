# Portfolio homepage scaffold

A static rebuild of the single-column portfolio homepage layout. No build step —
open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Files

| File | What's in it |
|---|---|
| `index.html` | Document structure — section order and element hierarchy |
| `styles.css` | Design tokens, spacing, type scale, responsive rules |
| `main.js` | Scramble-on-hover, staggered entrance, theme toggle, copy button |

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
`"Site Inter"`. Inter is open source (SIL OFL), so this loads it from Google
Fonts and aliases it to the same family name, keeping the `--font-sf` stack
identical. To drop the CDN dependency, self-host `InterVariable.woff2` and
replace the `@font-face` block in `styles.css`.

**Scramble + entrance animations.** Driven by the reference site's compiled
JavaScript, not its CSS — so these are written from scratch. The behaviour
matches; exact timing/easing will differ. Tune the constants at the top of each
block in `main.js`:

```js
var STAGGER_MS = 60;          // entrance stagger
var FRAME_MS = 28;            // scramble churn rate
var REVEAL_PER_FRAME = 0.34;  // scramble resolve speed
```

**Not built.** The reference homepage also has an image collage
(`.collage-item`, with separate light/dark variants), a footer collage, and a
dock toast. Those are stubbed out or omitted — the collage in particular needs
real images and a grid spec to be worth building. Say the word and I'll add it.
