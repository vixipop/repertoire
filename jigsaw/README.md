# Foam

A foam jigsaw of about 24 pieces. Pick a piece up, press it into its neighbour, or drop it in its true place inside the dotted area, where it locks until you press R to scatter.

`use your own image` (top right), drag-and-drop or paste cuts a new puzzle in that picture's shape (the grid and the dotted area follow it). `M` or the top-left button toggles the music. `?debug` exposes internals for scripted tests.

```bash
npm install
npm run dev
```

Plain three.js + Vite, no framework.

| File | What's in it |
|---|---|
| `src/shape.js` | The cut: classic Bézier tabs; each grid edge is generated once and shared by both neighbours |
| `src/materials.js` | Foam sides (procedural 3D pores, so they wrap the curves and continue across a seam) and the glossy laminated print |
| `src/textures.js` | Placeholder print art, the table, blurred piece silhouettes for shadows |
| `src/audio.js` | Synthesised sounds: the snap's crunch is modelled on a recording of a foam puzzle (a ~1 ms crack, then 2–8 micro-clicks over 35 ms, mostly 3–12 kHz); generative felt-piano music |
| `src/main.js` | Scene, drag, magnet, seat, foam squash, render loop |

## Feel knobs (top of `main.js`)

`THICK` foam depth · `LIFT` how high a held piece floats · `SNAP_R` / `MAGNET_R` how
forgiving the fit is · `GRAVITY` how hard it drops. Spring constants for the lean
and the squish live in `step()`.

## Performance

- Every piece is generated from its outline at load (no model files); all 24 share two materials and one print texture. About 100 draw calls and 50k triangles.
- Draws only while something moves; idle costs nothing.
- Shadows are pre-blurred silhouettes, not shadow maps.
- Renders at 2× on 1× screens to keep edges smooth; steps down in 30-frame windows if frames run long (ignoring compile and wake-up stalls) and back up after three smooth windows.
- The foam shader runs only on the side walls; fine pores fade out when they'd shimmer.
