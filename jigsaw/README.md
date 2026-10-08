# Foam

Two foam jigsaw pieces on a table. Pick one up, press it into the other.

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
| `src/audio.js` | Synthesised lift / land / snap sounds |
| `src/main.js` | Scene, drag, magnet, seat, foam squash, render loop |

## Feel knobs (top of `main.js`)

`THICK` foam depth · `LIFT` how high a held piece floats · `SNAP_R` / `MAGNET_R` how
forgiving the fit is · `GRAVITY` how hard it drops. Spring constants for the lean
and the squish live in `step()`.

## Performance

- Draws only while something moves; idle costs nothing.
- Shadows are pre-blurred silhouettes, not shadow maps.
- Pixel ratio capped at 2 and stepped down if frames run long, back up when smooth.
- The foam shader runs only on the side walls; fine pores fade out when they'd shimmer.
