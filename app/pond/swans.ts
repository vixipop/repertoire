/**
 * Swan simulation — pure maths, no DOM.
 *
 * Carried over unchanged from the standalone pond. Each swan's heading is
 * steered by two slow sines, so a change of direction comes out as one long
 * committed arc (a loop) instead of a wobble or a pivot on the spot. Near an
 * edge it is pulled softly back toward the centre. The sprite's mirror is eased
 * through zero so a turn reads as the bird coming round. Whenever the heading is
 * changing fast enough to count as a turn, it reports a ripple impulse for the
 * wave sim to inject.
 *
 * Positions are fractions of the pond (0..1) so it behaves the same at any size.
 */

export type SwanKey = "adult" | "cygnet";

type Spec = {
  key: SwanKey;
  /** Sprite width as a percentage of the pond's width. */
  widthPct: number;
  seed: number;
  speed: number;
  turnRate: number;
  x: number;
  y: number;
};

// The standalone pond used 150px and 78px swans on a full-screen canvas; these
// percentages keep that ~1.9 : 1 ratio and scale with the box instead.
export const SWAN_SPECS: ReadonlyArray<Spec> = [
  { key: "adult", widthPct: 24, seed: 0.0, speed: 0.011, turnRate: 0.5, x: 0.42, y: 0.46 },
  { key: "cygnet", widthPct: 12.5, seed: 3.7, speed: 0.01, turnRate: 0.65, x: 0.58, y: 0.56 },
];

export type SwanFrame = {
  /** Left / top as percentages of the pond. */
  left: number;
  top: number;
  /** CSS transform for the sprite. */
  transform: string;
};

export type Impulse = { xFrac: number; yFrac: number; radiusFrac: number; strength: number };

type Swan = Spec & {
  heading: number;
  turnSignal: number;
  facing: number;
  facingTarget: number;
};

const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class SwanSim {
  private swans: Swan[];
  private lastT = 0;

  constructor(rand: () => number = Math.random) {
    this.swans = SWAN_SPECS.map((s) => ({
      ...s,
      heading: rand() * Math.PI * 2,
      turnSignal: 0,
      facing: 1,
      facingTarget: 1,
    }));
  }

  /** Advance to sim-time `t` (seconds) and return where each sprite goes. */
  step(t: number): SwanFrame[] {
    const dt = Math.max(0, Math.min(t - this.lastT, 0.1));
    this.lastT = t;

    return this.swans.map((s) => {
      // Only slow components on purpose: the turn signal holds one sign for many
      // seconds, so the swan sweeps round rather than wobbling.
      const wander = Math.sin(t * 0.055 + s.seed) + 0.55 * Math.sin(t * 0.019 + s.seed * 2.7);
      const turnDelta = wander * s.turnRate;

      // Boundary steering starts early and pulls softly, so turning away from an
      // edge is also a wide sweep rather than a hard bounce.
      const margin = 0.17;
      let steer = 0;
      if (s.x < margin || s.x > 1 - margin || s.y < margin || s.y > 1 - margin) {
        const toCenter = Math.atan2(0.5 - s.y, 0.5 - s.x);
        steer = wrapAngle(toCenter - s.heading) * 1.0;
      }
      const totalTurn = turnDelta + steer;
      s.heading += totalTurn * dt;
      s.turnSignal = Math.abs(totalTurn);

      s.x += Math.cos(s.heading) * s.speed * dt;
      s.y += Math.sin(s.heading) * s.speed * dt;
      s.x = Math.max(0.02, Math.min(0.98, s.x));
      s.y = Math.max(0.02, Math.min(0.98, s.y));

      // Ease the mirror through zero instead of snapping it: the sprite narrows,
      // passes edge-on, then opens out facing the other way.
      const dx = Math.cos(s.heading);
      if (Math.abs(dx) > 0.2) s.facingTarget = dx < 0 ? -1 : 1; // ignore near-perpendicular headings
      const flipRate = 1.6; // ~1.2s to come fully around
      const diff = s.facingTarget - s.facing;
      s.facing += Math.max(-flipRate * dt, Math.min(flipRate * dt, diff));
      const sx = Math.sign(s.facing || 1) * Math.max(0.16, Math.abs(s.facing)); // never fully vanish

      // Lean into the turn a little, the way a real bird banks.
      const bank = Math.max(-9, Math.min(9, totalTurn * 11));

      return {
        left: s.x * 100,
        top: s.y * 100,
        transform: `translate(-50%,-50%) rotate(${bank.toFixed(2)}deg) scaleX(${sx.toFixed(3)})`,
      };
    });
  }

  /** Ripple sources for this instant — one per swan that is actually turning. */
  impulses(): Impulse[] {
    const TURN_THRESHOLD = 0.35; // below this it's gentle drift, not a turn
    const out: Impulse[] = [];
    for (const s of this.swans) {
      if (s.turnSignal > TURN_THRESHOLD) {
        const strength = Math.min((s.turnSignal - TURN_THRESHOLD) * 1.4, 1.0) * 0.28;
        out.push({ xFrac: s.x, yFrac: 1 - s.y, radiusFrac: 0.05, strength });
      }
    }
    return out;
  }
}
