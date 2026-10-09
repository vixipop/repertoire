// Steps the pixel ratio down when frames run long and back up when they're
// smooth. Judges 30-frame windows, skipping the first second and any gap
// after the render loop sleeps (shader compiles and wake-ups aren't a slow
// machine), and climbs back after three smooth windows. Those needn't be
// consecutive frames, since the loop stops whenever nothing moves.
//
// Returns a function to call with each frame's duration in ms.
export function createQualityGuard(max, apply, min = 1) {
  let ratio = max;
  let seen = 0;
  let winMs = 0;
  let winN = 0;
  let smooth = 0;
  const set = (r) => {
    ratio = r;
    apply(r);
  };
  return (ms) => {
    seen++;
    if (seen < 60 || ms > 200) return;
    winMs += ms;
    winN++;
    if (winN < 30) return;
    const avg = winMs / winN;
    winMs = 0;
    winN = 0;
    if (avg > 24 && ratio > min) {
      set(Math.max(min, ratio - 0.25));
      smooth = 0;
    } else if (avg < 18) {
      if (++smooth >= 3 && ratio < max) {
        set(Math.min(max, ratio + 0.25));
        smooth = 0;
      }
    } else {
      smooth = 0;
    }
  };
}
