import { describe, expect, it } from 'vitest';
import { clamp, dist, hash, lerp, pick, rnd, toS, wrapAngle } from '../src/core/math';
import { K } from '../src/config';

describe('core/math', () => {
  it('clamps into range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('interpolates linearly', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('wraps angles of any number of turns into [-π, π)', () => {
    for (const a of [0, 1, -1, 3, -3]) {
      for (const turns of [0, 1, -1, 3, -5]) {
        const w = wrapAngle(a + turns * Math.PI * 2);
        expect(w).toBeCloseTo(a, 9);
        expect(w).toBeGreaterThanOrEqual(-Math.PI);
        expect(w).toBeLessThan(Math.PI);
      }
    }
  });

  it('measures euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('keeps random helpers in range', () => {
    for (let i = 0; i < 200; i++) {
      const v = rnd(2, 3);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(3);
      expect(['a', 'b']).toContain(pick(['a', 'b']));
    }
  });

  it('hash is deterministic and in [0, 1)', () => {
    expect(hash(1.5, 2.5)).toBe(hash(1.5, 2.5));
    for (let i = 0; i < 50; i++) {
      const h = hash(i, i * 3);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('converts world units to screen pixels', () => {
    expect(toS(10)).toBe(10 * K);
  });
});
