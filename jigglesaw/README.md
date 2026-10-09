# jigglesaw

A foam jigsaw of about 24 pieces. Pick a piece up and press it into its
neighbour, or drop it in its true place inside the dotted area, where it locks
until you scatter (R). Solve one and sparkles pop up round it and the picture
comes alive.

Live at https://vixipop.github.io/repertoire/jigglesaw/

```bash
npm install
npm run dev          # local
./deploy-pages.sh    # build and publish to GitHub Pages
```

Plain three.js + Vite, no framework.

## Pictures

Three presets, picked at the top: Swans, Tiger and Open Sky. Each is a short
video in `public/presets/` (VP9 WebM, with an MP4 fallback), listed in
`PRESETS` in `src/pictures.js`:

- `still`: the moment shown while the puzzle is in pieces (chosen by eye; a
  first frame can be a bad one). Once solved, playback picks up from there.
- `crop`: trims a border baked into the video, in source pixels per side.

`Use your own image` (top right), drag-and-drop or paste cuts a new puzzle in
that picture's shape; uploads are PNG or JPEG only. The grid and the dotted
area follow the picture's shape. Progress is kept per preset when you switch.

The eye (top right, beside the upload button) shows the finished picture in a
popup, so you know what you're building; tap anywhere or press Esc to go back.

`M` toggles the music; the sun/moon button switches light (default) and a
charcoal dark mode. `?debug` exposes internals for scripted tests.

## The paid feature

"Use your own image" shows a lock in place of its picture icon (which comes back once unlocked). Hovering it opens a popup (bottom right)
saying it's a paid feature "but for the dodo team", with the code blurred until
you hover it; hovering reveals `DODO` and types it in, then sparkles, "yay,
feature unlocked", and the lock goes away (`src/unlock.js`). Uploads by button,
drop and paste all wait for it. The unlocked flag lives in `sessionStorage`, so
a new tab starts locked again.

That is a showpiece, not a gate: the code is in the page. To make it real with
Dodo Payments, put the check behind a checkout:

1. A small server function (Vercel, Cloudflare Workers, anything with a secret
   store) holds the Dodo API key and creates a checkout session for the
   product, with the 100%-off discount applied server-side, and returns the
   `checkout_url`. The key must never ship in this static site.
2. The button sends the visitor to that `checkout_url`; Dodo sends them back to
   the session's `return_url` when they're done.
3. On return, the page asks your function whether that payment succeeded
   (Dodo can also call a webhook on your function), and only then unlocks.
   Trusting the query string on the return URL alone would be spoofable.

Check field names and the test-mode base URL against Dodo's API reference
(Checkout Sessions) before wiring it up.

## Files

| File | What's in it |
|---|---|
| `src/main.js` | Scene, board, scatter, snapping and locking, input, simulation, render loop, UI wiring |
| `src/cluster.js` | A group of pieces that move together |
| `src/shape.js` | The cut (classic Bézier tabs, each grid edge shared by both neighbours, rounded corners) and choosing a grid for a picture's shape |
| `src/materials.js` | Foam sides (procedural 3D pores that continue across seams) and the matte print |
| `src/pictures.js` | Presets (video) and uploads (still images) |
| `src/textures.js` | The print canvas, the table, piece shadows, the dotted area |
| `src/soften.js` | Finishing pass: MSAA, a barely-there blur everywhere and a stronger one on silhouettes, then tone mapping |
| `src/sparkles.js` | The solve sparkles: one point-sprite draw call |
| `src/audio.js` | Synthesised sounds (the snap modelled on a recording of a foam puzzle) and generative felt-piano music |
| `src/quality.js` | Steps the pixel ratio down if frames run long, back up when smooth |

## Feel knobs (top of `main.js`)

`THICK`, `ROUND_H`/`ROUND_W` foam depth and edge rounding · `GAP`/`CORNER`
how separate joined pieces look · `LIFT` how high a held piece floats ·
`SNAP_R`/`MAGNET_R` how forgiving the fit is · `GRAVITY` how hard it drops.
Spring constants for the lean and the squish live in `step()`.

## Performance

- Every piece is generated from its outline at load (no model files); all
  pieces share two materials and one print texture.
- Draws only while something moves; idle costs nothing.
- Shadows are pre-blurred silhouettes, not shadow maps.
- The foam shader runs only on the side walls; fine pores fade out when they'd shimmer.
- Video presets decode in the browser's media pipeline; the print is only
  re-uploaded when the video shows a new frame.
