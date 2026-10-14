import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { qrMatrix } from '../src/ui/qr';

/** Renders a matrix (with the quiet zone) into RGBA pixels and reads it back with an independent decoder. */
function decode(m: boolean[][], scale = 4) {
  const n = (m.length + 8) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++)
      if (m[y][x])
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + 4) * scale + dy) * n + (x + 4) * scale + dx) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  return jsQR(px, n, n);
}

describe('QR code', () => {
  it('round-trips invite links of every length up to version 10', () => {
    const base = 'https://example.github.io/top_shelf/#join=7KQ2-ABCD-EFGH-JKMN-PQRS-TVWX';
    for (const len of [
      1, 10, 14, 15, 26, 27, 42, 43, 62, 63, 84, 85, 106, 107, 122, 123, 152, 153, 180, 181, 213,
    ]) {
      const text = (base + '/'.repeat(len)).slice(0, len);
      const m = qrMatrix(text)!;
      expect(m).not.toBeNull();
      const r = decode(m);
      expect(r?.data, 'length ' + len).toBe(text);
    }
  });
  it('picks the smallest version and gives up past version 10', () => {
    expect(qrMatrix('x'.repeat(14))!.length).toBe(21);
    expect(qrMatrix('x'.repeat(15))!.length).toBe(25);
    expect(qrMatrix('x'.repeat(213))!.length).toBe(57);
    expect(qrMatrix('x'.repeat(214))).toBeNull();
  });
  it('handles non-ASCII text as UTF-8 bytes', () => {
    expect(decode(qrMatrix('Größe ✓')!)?.data).toBe('Größe ✓');
  });
});
