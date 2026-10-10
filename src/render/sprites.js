/* ---------- sprites (canvas pixels, 2 per world unit) ---------- */
const LEGS_A = ['..OLLOOLLO..', '..OLLOOLLO..', '..OKKOOKKO..', '.OKKKOOKKKO.', '.BBBB..BBBB.'];
const LEGS_B = ['..OLLOOLLO..', '..OKKOOLLO..', '.OKKKOOKKO..', '.BBBBOOKKKO.', '.......BBBB.'];
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
const SIDE_LEGS_A = ['..OLLOLLO...', '..OLLOLLO...', '..OKKOKKO...', '.OKKKKKKKO..', '.BBBBBBBBB..'];
const SIDE_LEGS_B = ['..OLLO.OLLO.', '.OLLO...OLLO', '.OKKO...OKKO', 'OKKKO..OKKKO', 'BBBB....BBBB'];
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
    backA: [...BACK_TOP, ...LOWER, ...LEGS_A],
    backB: [...BACK_TOP, ...LOWER, ...LEGS_B],
    sideA: [...st, ...SIDE_LEGS_A],
    sideB: [...st, ...SIDE_LEGS_B],
  };
  // a sprawled skater: the side view rotated a quarter turn, head to the right
  const s = set.sideA,
    h = s.length,
    w = s[0].length;
  set.fallen = [];
  for (let c = 0; c < w; c++) {
    let row = '';
    for (let r = h - 1; r >= 0; r--) row += s[r][c];
    set.fallen.push(row);
  }
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
        for (let c = 0; c < 3; c++) if (DIGITS[d][r][c] === 'N') rows[8 + r][starts[i] + c] = 'N';
    });
    out = rows.map(r => r.join(''));
    byNum.set(num, out);
  }
  return out;
}
export const FACES = { eyes: faceSet('eyes'), visor: faceSet('visor'), cage: faceSet('cage') };
export const FACEV = { eyes: '#2a3140', visor: '#6ec2f2', cage: '#d5dce6' };
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
const stripe = m =>
  m.map(row => [...row].map((ch, c) => ('JjN'.includes(ch) ? (c % 2 ? 'J' : 'j') : ch)).join(''));
export const REFSET = {};
for (const k of ['frontA', 'frontB', 'backA', 'backB', 'sideA', 'sideB']) REFSET[k] = stripe(FACES.eyes[k]);
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
