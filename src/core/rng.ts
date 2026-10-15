/* The simulation's dice. Everything in game/ that rolls draws from this one seeded stream (never Math.random), so
   the same seed and the same inputs play out the same match: AI tests can pin a seed and replay a bug exactly.
   Presentation (render/, audio/, ui/) keeps Math.random and core/math's rnd/pick: drawing runs once per frame, not
   per tick, so if it shared this stream the frame rate would change the match. */

let s = (Math.random() * 2 ** 32) >>> 0;

/** Restarts the stream; the same seed gives the same sequence. */
export function seedRng(seed: number) {
  s = seed >>> 0;
}

/** Uniform in [0, 1) (mulberry32). */
export function random() {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rnd = (a: number, b: number) => a + random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(random() * a.length)];
