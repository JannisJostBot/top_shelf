import { describe, expect, it } from 'vitest';
import { pick, random, rnd, seedRng } from '../src/core/rng';

describe('core/rng', () => {
  it('repeats the same sequence for the same seed', () => {
    seedRng(42);
    const a = Array.from({ length: 20 }, random);
    seedRng(42);
    expect(Array.from({ length: 20 }, random)).toEqual(a);
    seedRng(43);
    expect(Array.from({ length: 20 }, random)).not.toEqual(a);
  });

  it('stays in range', () => {
    seedRng(1);
    for (let i = 0; i < 1000; i++) {
      const r = random();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      const v = rnd(2, 3);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(3);
      expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c']));
    }
  });

  // the simulation draws only from the seeded stream, or a seed would not pin a match
  it('is the only source of randomness in game/', () => {
    const sources = import.meta.glob<string>('../src/game/**/*.{js,ts}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    const offenders = Object.keys(sources).filter(
      f =>
        /Math\.random/.test(sources[f]) ||
        /import \{[^}]*\b(rnd|pick)\b[^}]*\} from '[./]*core\/math'/.test(sources[f]),
    );
    expect(offenders).toEqual([]);
  });
});
