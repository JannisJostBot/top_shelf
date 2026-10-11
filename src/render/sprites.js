/* ---------- sprites (canvas pixels, 2 per world unit) ---------- */
const LEGS_A = ['..OLLOOLLO..', '..OLLOOLLO..', '..OKKOOKKO..', '.OKKKOOKKKO.', '.BBBB..BBBB.'];
const LEGS_B = ['..OLLOOLLO..', '..OKKOOLLO..', '.OKKKOOKKO..', '.BBBBOOKKKO.', '.......BBBB.'];
// the other foot pushing (mirror of B), so a stride alternates feet: A, B, A, C
const LEGS_C = ['..OLLOOLLO..', '..OLLOOKKO..', '..OKKOOKKKO.', '.OKKKOOBBBB.', '.BBBB.......'];
// hockey stop: legs wide, knees bent, edges dug in
const LEGS_STOP = ['.OLLO..OLLO.', 'OLLO....OLLO', 'OKKO....OKKO', 'OKKKO..OKKKO', 'BBBBB..BBBBB'];
// skating backwards: feet out and in (C-cuts)
const LEGS_VEE = ['..OLLOOLLO..', '.OLLO..OLLO.', '.OKKO..OKKO.', 'OKKKO..OKKKO', 'BBBB....BBBB'];
const LOWER = ['.OTTTTTTTTO.', '.OPPPPPPPPO.', '.OPpPPPPpPO.', '.OPPPOOPPPO.'];
const FRONT_TOP = [
  '....OOOO....',
  '...OHHHHO...',
  '..OHHHHHhO..',
  '..OHSSSSHO..',
  '..OSVSSVSO..',
  '..OOSSSSOO..',
  '.OJJJTTJJJO.',
  'OJJJJJJJJJJO',
  'OJjJJNNJJjJO',
  'OGjJJNNJJjGO',
  'OGOJJJJJJOGO',
];
const BACK_TOP = [
  '....OOOO....',
  '...OHHHHO...',
  '..OHHHHHhO..',
  '..OHHHHHhO..',
  '..OHHHHHHO..',
  '..OOSSSSOO..',
  '.OJJJJJJJJO.',
  'OJJJJJJJJJJO',
  'OJJNJJNNNJJO',
  'OGJNJJJJNJGO',
  'OGJNJJJNJJGO',
];
const SIDE_TOP = [
  '....OOOO....',
  '...OHHHHO...',
  '..OHHHHHhO..',
  '..OHHHSSSO..',
  '..OHHHSVSO..',
  '...OOSSSOO..',
  '..OJJJJJTO..',
  '.OJJJJJJJJO.',
  '.OjJJJJJJJO.',
  '.OjJJJJGGGO.',
  '.OjJJJJGGO..',
  '.OTTTTTTTO..',
  '.OPPPPPPPO..',
  '.OPpPPPPPO..',
  '..OPPPPPO...',
];
// Side view legs (the skater faces right): the boots point forward, toes ahead of the shin and the heel at the
// back of it, as skates do. A: gliding with the feet together. B: striding, the back leg pushing off behind.
const SIDE_LEGS_A = ['..OLLOLLO...', '..OLLOLLO...', '..OKKOKKO...', '..OKKKKKKKO.', '..BBBBBBBBB.'];
const SIDE_LEGS_B = ['..OLLO.OLLO.', '.OLLO..OLLO.', '.OKKO..OKKO.', '.OKKKO.OKKKO', '..BBBB..BBBB'];
// side view hockey stop: skates out in front, leaning back against the edges
const SIDE_LEGS_STOP = ['...OLLOLLO..', '...OLLOLLO..', '....OKKOKKO.', '...OKKKKKKKO', '...BBBBBBBBB'];
// the raised arm of a sprawled skater: [row, column, pixels] written over the rotated sprite
const FLUNG_ARM = [
  [0, 15, 'OGGO'],
  [1, 13, 'OJJGGO'],
  [2, 11, 'OJJJOO'],
  [3, 11, 'JJJO'],
];
// face styles: plain eyes, tinted visor, or a full metal cage
function faceSet(f) {
  const ft = FRONT_TOP.slice(),
    st = SIDE_TOP.slice();
  if (f === 'visor') {
    ft[4] = '..OVVVVVVO..';
    st[4] = '..OHHHVVVO..';
  }
  if (f === 'cage') {
    ft[3] = '..OHSVSVHO..';
    ft[4] = '..OVSVVSVO..';
    ft[5] = '..OOVSSVOO..';
    st[3] = '..OHHHVSVO..';
    st[4] = '..OHHHSVVO..';
  }
  const set = {
    frontA: [...ft, ...LOWER, ...LEGS_A],
    frontB: [...ft, ...LOWER, ...LEGS_B],
    frontC: [...ft, ...LOWER, ...LEGS_C],
    frontStop: [...ft, ...LOWER, ...LEGS_STOP],
    frontVee: [...ft, ...LOWER, ...LEGS_VEE],
    backA: [...BACK_TOP, ...LOWER, ...LEGS_A],
    backB: [...BACK_TOP, ...LOWER, ...LEGS_B],
    backC: [...BACK_TOP, ...LOWER, ...LEGS_C],
    backStop: [...BACK_TOP, ...LOWER, ...LEGS_STOP],
    backVee: [...BACK_TOP, ...LOWER, ...LEGS_VEE],
    sideA: [...st, ...SIDE_LEGS_A],
    sideB: [...st, ...SIDE_LEGS_B],
    sideStop: [...st, ...SIDE_LEGS_STOP],
  };
  // a sprawled skater: the striding side view rotated a quarter turn (head to the right, legs apart), with
  // one arm flung up over the helmet; two blank rows on top make room for the arm
  const s = set.sideB,
    h = s.length,
    w = s[0].length,
    rows = ['.'.repeat(h), '.'.repeat(h)];
  for (let c = 0; c < w; c++) {
    let row = '';
    for (let r = h - 1; r >= 0; r--) row += s[r][c];
    rows.push(row);
  }
  for (const [r, c, px] of FLUNG_ARM) rows[r] = rows[r].slice(0, c) + px + rows[r].slice(c + px.length);
  set.fallen = rows;
  return set;
}
// 3x3 pixel digits for jersey numbers on the back of the skater sprites (rows 8-10 of the back view).
const DIGITS = [
  ['NNN', 'N.N', 'NNN'],
  ['.N.', '.N.', '.N.'],
  ['NN.', '.N.', '.NN'],
  ['NNN', '.NN', 'NNN'],
  ['N.N', 'NNN', '..N'],
  ['.NN', '.N.', 'NN.'],
  ['N..', 'NNN', 'NNN'],
  ['NNN', '..N', '..N'],
  ['NN.', 'NNN', '.NN'],
  ['NNN', 'NNN', '..N'],
];
const numbered = new Map();
/** The back-view sprite `map` with the jersey number `num` (0-99) in place of the template's number. */
export function withNumber(map, num) {
  let byNum = numbered.get(map);
  if (!byNum) numbered.set(map, (byNum = new Map()));
  let out = byNum.get(num);
  if (!out) {
    const rows = map.map(r => [...r]),
      digits = String(num).split('').map(Number),
      starts = digits.length > 1 ? [2, 6] : [4];
    for (let r = 8; r <= 10; r++) for (let c = 2; c <= 9; c++) if (rows[r][c] === 'N') rows[r][c] = 'J';
    digits.forEach((d, i) => {
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) if (DIGITS[d][r][c] === 'N') rows[8 + r][starts[i] + c] = 'n';
    });
    out = rows.map(r => r.join(''));
    byNum.set(num, out);
  }
  return out;
}
export const FACES = { eyes: faceSet('eyes'), visor: faceSet('visor'), cage: faceSet('cage') };
export { FACEV } from '../data/faces';
const G_BODY = [
  '..OOOJJJJJJJJOOO..',
  '.OJJJJJJJJJJJJJJO.',
  'OCCOJJJTTTTJJJOWWO',
  'OCCCOJJJJJJJJOWWWO',
  'OCCCOjJJJJJJjOWWWO',
  '.OCCOjJJJJJJjOWWO.',
  '..OOOTTTTTTTTOOO..',
  '..OWWWWWOOWWWWWO..',
  '..OWJJWWOOWWJJWO..',
  '..OWWWWWOOWWWWWO..',
  '..OWJJWWOOWWJJWO..',
  '..OWWWWWOOWWWWWO..',
  '..OWWWWWOOWWWWWO..',
  '..OKKKKKOOKKKKKO..',
  '..BBBBBB..BBBBBB..',
];
export const SPR = {};
// Goalie mask: painted in the team colour with a helmet-colour stripe, a wire cage over the face (front) and a white
// backplate held by straps (back), the shape of a real goalie mask rather than a round helmet with a visor.
SPR.goalieF = [
  '......OOOOOO......',
  '.....OhhHHhhO.....',
  '.....OhMmmMhO.....',
  '.....OhmMMmhO.....',
  '......OhMMhO......',
  ...G_BODY,
];
SPR.goalieB = [
  '......OOOOOO......',
  '.....OhhHHhhO.....',
  '.....OhhhhhhO.....',
  '.....OhWWWWhO.....',
  '......OWWWWO......',
  ...G_BODY,
];
// Goalie shuffling sideways: the pads push apart (a T-push, low and wide) and come back together, so the
// goalie steps across the crease instead of sliding. Replaces the pad rows of the stance sprite.
const G_PADS_OPEN = [
  '.OWWWWWO..OWWWWWO.',
  '.OWJJWWO..OWWJJWO.',
  '.OWWWWWO..OWWWWWO.',
  '.OWJJWWO..OWWJJWO.',
  'OWWWWWO....OWWWWWO',
  'OWWWWWO....OWWWWWO',
  'OKKKKKO....OKKKKKO',
  'BBBBBB......BBBBBB',
];
const PAD_ROW = 12; // first pad row of the goalie sprites (5 mask rows + 7 body rows)
for (const k of ['goalieF', 'goalieB']) SPR[k + 'Open'] = [...SPR[k].slice(0, PAD_ROW), ...G_PADS_OPEN];
const goalieLeans = new Map();
/** Goalie sprite with mask and shoulders shifted one pixel toward `dir` (-1 or 1), leaning into a push. */
export function goalieLean(map, dir) {
  let pair = goalieLeans.get(map);
  if (!pair) goalieLeans.set(map, (pair = {}));
  return (pair[dir] ||= map.map((row, r) =>
    r > 6 ? row : dir > 0 ? '.' + row.slice(0, -1) : row.slice(1) + '.',
  ));
}
const stripe = m =>
  m.map(row => [...row].map((ch, c) => ('JjN'.includes(ch) ? (c % 2 ? 'J' : 'j') : ch)).join(''));
export const REFSET = {};
for (const k of ['frontA', 'frontB', 'backA', 'backB', 'sideA', 'sideB']) REFSET[k] = stripe(FACES.eyes[k]);
// Jersey numbers need to contrast with the base colour (trim colours can be close to it, and animated jerseys
// flicker), so they are white on dark jerseys and dark navy on light ones.
function numberColour(main) {
  const v = parseInt(main.slice(1), 16),
    lum = 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
  return lum > 150 ? '#13213f' : '#ffffff';
}
export function mkPal(c) {
  const J = c.J || c.main,
    j = c.j || c.dark;
  return {
    O: '#0b0f1a',
    H: c.helm,
    h: c.main,
    S: '#f0c197',
    V: '#2a3140',
    J,
    j,
    T: c.trim,
    N: c.trim,
    n: numberColour(c.main),
    G: c.dark,
    P: '#1b2030',
    p: '#3a4258',
    L: J,
    K: '#16181f',
    B: '#d9e2ec',
    W: '#f2f4f7',
    C: '#c9a46a',
    M: '#cfd6df',
    m: '#1c2230',
  };
}
export const REFPAL = Object.assign(
  mkPal({ main: '#f4f4f4', dark: '#151515', trim: '#151515', helm: '#151515' }),
  { h: '#3a3a3a', L: '#151515', P: '#151515', p: '#2c2c2c' },
);

// Variants made from a finished map at draw time (cached, so the sprite cache can reuse them):
const crouchCache = new Map(),
  leanCache = new Map();
/** Sprinting crouch: the body sits one pixel lower (a pants row is dropped and a blank row added on top). */
export function crouched(map) {
  let out = crouchCache.get(map);
  if (!out) {
    const drop = 12; // the second pants row, in both the front/back and the side layouts
    out = ['.'.repeat(map[0].length), ...map.slice(0, drop), ...map.slice(drop + 1)];
    crouchCache.set(map, out);
  }
  return out;
}
/** Side view leaning into a sprint: head and shoulders one pixel forward. */
export function leaned(map) {
  let out = leanCache.get(map);
  if (!out) {
    out = map.map((row, r) => (r < 7 ? '.' + row.slice(0, -1) : row));
    leanCache.set(map, out);
  }
  return out;
}
