import { K } from '../config';

export interface Point {
  x: number;
  y: number;
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** Deterministic pseudo-random value in [0, 1) for a 2D coordinate. */
export const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
/** World units to screen pixels. */
export const toS = (v: number) => Math.round(v * K);
