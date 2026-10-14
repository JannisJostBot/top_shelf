import { describe, expect, it } from 'vitest';
import { FACES, withNumber } from '../src/render/sprites';

const numberRows = (map: string[]) => map.slice(8, 11).map(r => r.slice(2, 10));
const digitCells = (map: string[]) => numberRows(map).join('').split('n').length - 1;

describe('jersey numbers', () => {
  const back: string[] = FACES.eyes.backA;

  it('keeps the sprite size and leaves rows outside the number untouched', () => {
    const m = withNumber(back, 47);
    expect(m.length).toBe(back.length);
    m.forEach((row: string, r: number) => {
      expect(row.length).toBe(back[r].length);
      if (r < 8 || r > 10) expect(row).toBe(back[r]);
    });
  });

  it('draws a different pattern for every number', () => {
    const seen = new Set<string>();
    for (let n = 2; n <= 97; n++) seen.add(numberRows(withNumber(back, n)).join('|'));
    expect(seen.size).toBe(96);
  });

  it('draws the digits in the contrasting number colour', () => {
    expect(digitCells(withNumber(back, 11))).toBe(6);
    expect(numberRows(withNumber(back, 11)).join('')).not.toContain('N');
  });

  it('returns the same array for the same number so the sprite cache can reuse it', () => {
    expect(withNumber(back, 9)).toBe(withNumber(back, 9));
  });
});

describe('remastered skater frames', () => {
  for (const face of ['eyes', 'visor', 'cage'] as const) {
    const set = (FACES as any)[face];
    it(`${face}: every stride frame is 12 wide and at least 20 tall`, () => {
      for (const k of ['frontStride', 'backStride', 'sideStride', 'frontStart', 'backStart', 'sideStart']) {
        const frames: string[][] = set[k];
        expect(frames.length).toBe(k.endsWith('Start') ? 4 : 12);
        for (const m of frames) {
          expect(m.length).toBeGreaterThanOrEqual(20);
          for (const row of m) expect(row.length).toBe(12);
        }
      }
    });
  }
  it('keeps the face style in the new frames', () => {
    expect((FACES as any).visor.frontStride[0][4]).toBe((FACES as any).visor.frontA[4]);
    expect((FACES as any).cage.sideStride[3][3]).toBe((FACES as any).cage.sideA[3]);
  });
  it('numbers the back-view stride like the old back view', () => {
    const m = withNumber((FACES as any).eyes.backStride[3], 17);
    expect(digitCells(m)).toBeGreaterThan(0);
  });
});
