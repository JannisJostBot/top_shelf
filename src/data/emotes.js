// The online emotes players send each other during a replay: round pixel-art faces, 14×14 pixels. Each face is a
// fill colour (with its shade and highlight) and its features as rects [x, y, w, h, colour].
// Colours: k outline / ink, w white, m inside of a mouth, t tongue and blush, b tears.
const INK = {
  k: '#0b0f1a',
  w: '#ffffff',
  m: '#7a1f2a',
  t: '#ff8a96',
  b: '#6fc3ff',
};
const YELLOW = ['#ffd25e', '#e09a2a', '#fff2b0'];

export const EMOTES = {
  hyped: {
    label: 'HYPED!',
    face: ['#ffb43c', '#e0661e', '#ffe7a0'],
    parts: [
      // squeezed-shut eyes ^ ^
      [3, 5, 1, 1, 'k'],
      [4, 4, 2, 1, 'k'],
      [6, 5, 1, 1, 'k'],
      [7, 5, 1, 1, 'k'],
      [8, 4, 2, 1, 'k'],
      [10, 5, 1, 1, 'k'],
      // a big open shout
      [3, 8, 8, 1, 'k'],
      [3, 9, 1, 2, 'k'],
      [10, 9, 1, 2, 'k'],
      [4, 9, 6, 2, 'm'],
      [5, 10, 4, 1, 't'],
      [4, 11, 6, 1, 'k'],
    ],
  },
  happy: {
    label: 'NICE!',
    face: YELLOW,
    parts: [
      [4, 4, 2, 3, 'k'],
      [8, 4, 2, 3, 'k'],
      [4, 4, 1, 1, 'w'],
      [8, 4, 1, 1, 'w'],
      [2, 7, 2, 1, 't'],
      [10, 7, 2, 1, 't'],
      [3, 8, 1, 1, 'k'],
      [10, 8, 1, 1, 'k'],
      [4, 9, 1, 1, 'k'],
      [9, 9, 1, 1, 'k'],
      [5, 10, 4, 1, 'k'],
    ],
  },
  lol: {
    label: 'LOL',
    face: YELLOW,
    parts: [
      // > <
      [3, 4, 1, 1, 'k'],
      [4, 5, 1, 1, 'k'],
      [3, 6, 1, 1, 'k'],
      [10, 4, 1, 1, 'k'],
      [9, 5, 1, 1, 'k'],
      [10, 6, 1, 1, 'k'],
      // laughing mouth
      [3, 8, 8, 1, 'k'],
      [3, 9, 1, 1, 'k'],
      [10, 9, 1, 1, 'k'],
      [4, 9, 6, 1, 'w'],
      [4, 10, 1, 1, 'k'],
      [9, 10, 1, 1, 'k'],
      [5, 10, 4, 1, 'm'],
      [5, 11, 4, 1, 'k'],
      // tears of joy
      [1, 6, 1, 3, 'b'],
      [12, 6, 1, 3, 'b'],
    ],
  },
  shocked: {
    label: 'WHAT?!',
    face: YELLOW,
    parts: [
      [3, 2, 3, 1, 'k'],
      [8, 2, 3, 1, 'k'],
      [3, 4, 3, 3, 'w'],
      [8, 4, 3, 3, 'w'],
      [4, 5, 1, 1, 'k'],
      [9, 5, 1, 1, 'k'],
      [5, 8, 4, 1, 'k'],
      [4, 9, 1, 2, 'k'],
      [9, 9, 1, 2, 'k'],
      [5, 9, 4, 2, 'm'],
      [5, 11, 4, 1, 'k'],
    ],
  },
  sad: {
    label: 'NOOO',
    face: ['#8fb8ff', '#5f86d8', '#d6e6ff'],
    parts: [
      // brows up in the middle
      [3, 4, 1, 1, 'k'],
      [4, 3, 2, 1, 'k'],
      [8, 3, 2, 1, 'k'],
      [10, 4, 1, 1, 'k'],
      [4, 5, 2, 2, 'k'],
      [8, 5, 2, 2, 'k'],
      [4, 7, 1, 2, 'b'],
      [5, 9, 4, 1, 'k'],
      [4, 10, 1, 1, 'k'],
      [9, 10, 1, 1, 'k'],
    ],
  },
  angry: {
    label: 'GRRR',
    face: ['#ff6b4a', '#c23a24', '#ffa585'],
    parts: [
      // brows down in the middle
      [2, 3, 2, 1, 'k'],
      [4, 4, 2, 1, 'k'],
      [8, 4, 2, 1, 'k'],
      [10, 3, 2, 1, 'k'],
      [4, 5, 2, 2, 'k'],
      [8, 5, 2, 2, 'k'],
      // gritted teeth
      [4, 9, 6, 1, 'k'],
      [3, 10, 1, 1, 'k'],
      [10, 10, 1, 1, 'k'],
      [4, 10, 6, 1, 'w'],
      [5, 10, 1, 1, 'k'],
      [8, 10, 1, 1, 'k'],
      [4, 11, 6, 1, 'k'],
    ],
  },
};
/** In the order of the number keys 1 to 6. */
export const EMOTE_KEYS = Object.keys(EMOTES);

// the round face: per row, the outlined span [from, to]
const ROWS = [
  [4, 9],
  [2, 11],
  [1, 12],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [1, 12],
  [2, 11],
  [4, 9],
];
/** An emote's face as inline SVG markup. */
export function emoteSVG(key) {
  const e = EMOTES[key],
    [fill, shade, hi] = e.face,
    r = (x, y, w, h, c) =>
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
  let s = '';
  ROWS.forEach(([a, b], y) => {
    if (y === 0 || y === 13) return void (s += r(a, y, b - a + 1, 1, INK.k));
    const edge = y === 1 || y === 12 ? 2 : 1;
    s += r(a, y, edge, 1, INK.k) + r(b - edge + 1, y, edge, 1, INK.k);
    s += r(a + edge, y, b - a + 1 - 2 * edge, 1, fill);
  });
  // a highlight top left, a shade along the bottom right
  s += r(4, 1, 2, 1, hi) + r(2, 2, 2, 1, hi) + r(1, 3, 1, 2, hi);
  s += r(12, 9, 1, 2, shade) + r(10, 11, 2, 1, shade) + r(6, 12, 4, 1, shade);
  for (const [x, y, w, h, c] of e.parts) s += r(x, y, w, h, INK[c]);
  return '<svg viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">' + s + '</svg>';
}
