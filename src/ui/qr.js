// A small QR code encoder for the invite link: byte mode, error correction level M, versions 1 to 10 (up to 213
// bytes, plenty for a URL with a code in it). It runs here, in the page, so the link is never sent anywhere to be
// turned into a picture. Follows ISO/IEC 18004; the layout of the steps borrows from Project Nayuki's encoder.

// level M per version: [EC codewords per block, blocks in group 1, data codewords each, blocks in group 2, data each]
const BLOCKS = [
  null,
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];
const ALIGN = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];
const dataCw = v => BLOCKS[v][1] * BLOCKS[v][2] + BLOCKS[v][3] * BLOCKS[v][4];

/* ---------- Reed-Solomon over GF(256), polynomial 0x11D ---------- */
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function divisor(n) {
  const r = new Array(n).fill(0);
  r[n - 1] = 1;
  let root = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      r[j] = mul(r[j], root);
      if (j + 1 < n) r[j] ^= r[j + 1];
    }
    root = mul(root, 2);
  }
  return r;
}
function remainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    for (let i = 0; i < r.length; i++) r[i] ^= mul(div[i], f);
  }
  return r;
}

/* ---------- the codewords: data, padding, error correction, interleaved ---------- */
function codewords(bytes, v) {
  const bits = [];
  const put = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(4, 4); // byte mode
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCw(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const [ec, n1, d1, n2, d2] = BLOCKS[v];
  const div = divisor(ec);
  const blocks = [];
  let k = 0;
  for (let b = 0; b < n1 + n2; b++) {
    const d = data.slice(k, (k += b < n1 ? d1 : d2));
    blocks.push([d, remainder(d, div)]);
  }
  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const [d] of blocks) if (i < d.length) out.push(d[i]);
  for (let i = 0; i < ec; i++) for (const [, e] of blocks) out.push(e[i]);
  return out;
}

/* ---------- the symbol ---------- */
const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function symbol(v, cw, mask) {
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    m[y][x] = dark;
    fn[y][x] = true;
  };
  // timing patterns, then the finders (with their separators) and the alignment patterns over them
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  const al = ALIGN[v];
  for (const ay of al)
    for (const ax of al) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // format information (level M is 00), both copies, and the dark module
  const fmt = mask; // (M's two bits are 0, so the data is just the mask number)
  let rem = fmt;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fb = ((fmt << 10) | rem) ^ 0x5412;
  const bit = (val, i) => ((val >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(fb, i));
  set(8, 7, bit(fb, 6));
  set(8, 8, bit(fb, 7));
  set(7, 8, bit(fb, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fb, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fb, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fb, i));
  set(8, size - 8, true);
  // version information (version 7 and up)
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vb = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(vb, i));
      set(b, a, bit(vb, i));
    }
  }
  // the codewords, in two-column strips zigzagging up and down from the bottom right, masked as they go
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = (right + 1) & 2 ? vert : size - 1 - vert;
        if (fn[y][x]) continue;
        const dark = i < cw.length * 8 && bit(cw[i >>> 3], 7 - (i & 7));
        i++;
        m[y][x] = dark !== MASKS[mask](x, y);
      }
  }
  return m;
}

/** The standard's penalty score: long runs, 2×2 blocks, finder look-alikes and an uneven dark/light balance. */
function penalty(m) {
  const size = m.length;
  let p = 0;
  let dark = 0;
  const lines = [];
  for (let y = 0; y < size; y++) {
    lines.push(m[y]);
    lines.push(m.map(row => row[y]));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) p += run - 2;
        run = 1;
      }
    }
    // (the quiet zone around the symbol is light too)
    const s = '0000' + line.map(d => (d ? '1' : '0')).join('') + '0000';
    p += 40 * (s.split('00001011101').length - 1 + s.split('10111010000').length - 1);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (m[y][x]) dark++;
      if (x && y && m[y][x] === m[y - 1][x] && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x - 1]) p += 3;
    }
  return p + Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
}

/** The QR code for a piece of text, as rows of booleans (true = dark), without the quiet zone around it; null when
 * the text is too long for version 10 (213 bytes). */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v <= 10 && bytes.length > dataCw(v) - (v < 10 ? 2 : 3)) v++;
  if (v > 10) return null;
  const cw = codewords(bytes, v);
  let best = null;
  let bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = symbol(v, cw, mask);
    const p = penalty(m);
    if (p < bestP) [best, bestP] = [m, p];
  }
  return best;
}

/** Draws the QR code for `text` into a canvas, `scale` pixels per module with the four-module quiet zone, dark on
 * white whatever the page's colors (scanners want the contrast). Returns false (and leaves the canvas empty) when
 * the text does not fit. */
export function drawQR(canvas, text, scale = 4) {
  const m = qrMatrix(text);
  if (!m) return false;
  const n = m.length + 8;
  canvas.width = canvas.height = n * scale;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, n * scale, n * scale);
  g.fillStyle = '#000';
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++)
      if (m[y][x]) g.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
  return true;
}
