/* ---------- sprites (canvas pixels, 2 per world unit) ---------- */
const LEGS_A = ['..OLLOOLLO..', '..OTTOOTTO..', '..OKKOOKKO..', '.OKKKOOKKKO.', '.BBBB..BBBB.'];
// A stride from the front pushes a foot out to the side on the ice and slides it back (rather than stepping):
// out a pixel, out to full extension, mirrored for the other foot.
const LEGS_ROUT = ['..OLLOOLLO..', '..OTTO.OTTO.', '..OKKO.OKKO.', '.OKKKO.OKKKO', '.BBBB...BBBB'];
const LEGS_RFAR = ['..OLLOOLLO..', '..OTTO.OTTO.', '..OKKO..OKKO', '.OKKKO..OKKO', '.BBBB....BBB'];
const mirrorRows = rows => rows.map(r => [...r].reverse().join(''));
const LEGS_LOUT = mirrorRows(LEGS_ROUT);
const LEGS_LFAR = mirrorRows(LEGS_RFAR);
// feet wide and planted, for a shot taken side-on
const LEGS_WIDE = ['.OLLO..OLLO.', '.OTTO..OTTO.', '.OKKO..OKKO.', 'OKKKO..OKKKO', 'BBBB....BBBB'];
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
  '...OHhHHO...',
  '..OHhHHHHO..',
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
  '...OHhHHO...',
  '..OHhHHHHO..',
  '..OHHHHHHO..',
  '..OHHHHHHO..',
  '..OOSSSSOO..',
  '.OJJJJJJJJO.',
  'OJJJJJJJJJJO',
  'OJjJJJJJJjJO',
  'OGjJJJJJJjGO',
  'OGOJJJJJJOGO',
];
// torso rows (6-10) with the gloves swung a pixel: the glove on the side of the gliding leg comes up
const TORSO_F_LEFT = ['.OJJJTTJJJO.', 'OJJJJJJJJJJO', 'OGjJJNNJJjJO', 'OGOJJNNJJjGO', '.OOJJJJJJOGO'];
const TORSO_F_RIGHT = ['.OJJJTTJJJO.', 'OJJJJJJJJJJO', 'OJjJJNNJJjGO', 'OGjJJNNJJOGO', 'OGOJJJJJJOO.'];
const TORSO_B_LEFT = ['.OJJJJJJJJO.', 'OJJJJJJJJJJO', 'OGjJJJJJJjJO', 'OGOJJJJJJjGO', '.OOJJJJJJOGO'];
const TORSO_B_RIGHT = ['.OJJJJJJJJO.', 'OJJJJJJJJJJO', 'OJjJJJJJJjGO', 'OGjJJJJJJOGO', 'OGOJJJJJJOO.'];
// arms tucked away, for poses whose arms are drawn separately (shot, celebration)
const TORSO_F_BARE = ['.OJJJTTJJJO.', 'OJJJJJJJJJJO', 'OJjJJNNJJjJO', 'OJjJJNNJJjJO', '.OOJJJJJJOO.'];
const TORSO_B_BARE = ['.OJJJJJJJJO.', 'OJJJJJJJJJJO', 'OJjJJJJJJjJO', 'OJjJJJJJJjJO', '.OOJJJJJJOO.'];
const SIDE_TOP = [
  '....OOOO....',
  '...OhHHHO...',
  '..OHhHHHHO..',
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
// Side view stride (the skater faces right). The legs take turns and every push goes back and out to the side;
// seen from the side "out" is toward or away from the viewer, so the near foot ends a pixel lower on screen and the
// far foot a pixel higher. PUSH is the start of either push.
const SIDE_LEGS_PUSH = ['..OLLOLLO...', '.OLLO.OLLO..', '.OKKO.OKKO..', '.OKKKOOKKKO.', '..BBBB.BBBB.'];
const SIDE_LEGS_NEAR = [
  '..OLLO.OLLO.',
  '.OLLO..OLLO.',
  '.OLLO..OKKO.',
  '.OKKO..OKKKO',
  '.OKKKO..BBBB',
  '..BBBB......',
];
const SIDE_LEGS_FAR = ['..OLLO.OLLO.', '.OKKO..OLLO.', '.OKKKO.OKKO.', '..BBBB.OKKKO', '........BBBB'];
// side view hockey stop: skates out in front, leaning back against the edges
const SIDE_LEGS_STOP = ['...OLLOLLO..', '...OLLOLLO..', '....OKKOKKO.', '...OKKKKKKKO', '...BBBBBBBBB'];
const SIDE_LEGS = { glide: SIDE_LEGS_A, push: SIDE_LEGS_PUSH, near: SIDE_LEGS_NEAR, far: SIDE_LEGS_FAR };
// Stride cycles. Each holds two pushes; render/players.js steps through them by distance skated, so the legs keep
// pace with the ground (a push every 40 world units at the chosen cadence). Timing does the smoothing: the glide is
// held for two frames, and at full extension the foot, the lean and the gloves change together.
// front/back: [legs, torso (glove swing), sway]
const STRIDE_FRONT = [
  ['both', 'mid', 0],
  ['both', 'mid', 0],
  ['rOut', 'mid', 0],
  ['rFar', 'left', -1],
  ['rFar', 'left', -1],
  ['rOut', 'mid', 0],
  ['both', 'mid', 0],
  ['both', 'mid', 0],
  ['lOut', 'mid', 0],
  ['lFar', 'right', 1],
  ['lFar', 'right', 1],
  ['lOut', 'mid', 0],
];
// side: [legs, free arm swung back]
const STRIDE_SIDE = [
  ['glide', 0],
  ['glide', 0],
  ['push', 0],
  ['near', 1],
  ['near', 1],
  ['push', 0],
  ['glide', 0],
  ['glide', 0],
  ['push', 0],
  ['far', 1],
  ['far', 1],
  ['push', 0],
];
// the quick starting strides from the front/back: [legs, torso]
const STRIDE_START = [
  ['rOut', 'left'],
  ['both', 'mid'],
  ['lOut', 'right'],
  ['both', 'mid'],
];
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
  // the free arm swung back (side view, at full extension of a push)
  const stArm = st.map((r, i) => (i === 9 ? 'OGjJJJJJJJO.' : i === 10 ? 'OGOJJJJJJO..' : r));
  const frontTorso = { mid: ft.slice(6), left: TORSO_F_LEFT, right: TORSO_F_RIGHT, bare: TORSO_F_BARE };
  const backTorso = { mid: BACK_TOP.slice(6), left: TORSO_B_LEFT, right: TORSO_B_RIGHT, bare: TORSO_B_BARE };
  const LEGS = {
    both: LEGS_A,
    rOut: LEGS_ROUT,
    rFar: LEGS_RFAR,
    lOut: LEGS_LOUT,
    lFar: LEGS_LFAR,
    wide: LEGS_WIDE,
  };
  const frontRows = (legs, torso, sway, back) =>
    shiftRows(
      [
        ...(back ? BACK_TOP : ft).slice(0, 6),
        ...(back ? backTorso : frontTorso)[torso],
        ...LOWER,
        ...LEGS[legs],
      ],
      sway,
      14,
    );
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
    // the remaster's strides, built from the face-styled rows (see STRIDE_FRONT and STRIDE_SIDE)
    frontStride: STRIDE_FRONT.map(([l, t, sw]) => frontRows(l, t, sw, false)),
    // from behind the jersey number goes on before the sway (render/players.js: withNumber, then swayed)
    backStride: STRIDE_FRONT.map(([l, t]) => frontRows(l, t, 0, true)),
    sideStride: STRIDE_SIDE.map(([l, arm]) => [...(arm ? stArm : st), ...SIDE_LEGS[l]]),
    // the first strides from slow: short and quick, a pixel lower, the head leaning forward
    // (render/players.js crouches these a pixel, after the number goes on the back)
    frontStart: STRIDE_START.map(([l, t]) => frontRows(l, t, 0, false)),
    backStart: STRIDE_START.map(([l, t]) => frontRows(l, t, 0, true)),
    sideStart: ['push', 'glide', 'push', 'glide'].map(l =>
      crouchRows(shiftRows([...st, ...SIDE_LEGS[l]], 1, 5)),
    ),
    // stopping from the side: the body leans back against the edges
    sideStopLean: shiftRows([...st, ...SIDE_LEGS_STOP], -1, 6),
    // shot (front view, side-on to the target) and celebration: arms drawn separately (render/players.js)
    frontShot: frontRows('wide', 'bare', 0, false),
    frontBare: frontRows('both', 'bare', 0, false),
    backBare: frontRows('both', 'bare', 0, true),
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
/** rows 0..upTo shifted dx pixels sideways (a sway or a lean) */
function shiftRows(rows, dx, upTo) {
  return rows.map((r, i) =>
    i > upTo || !dx ? r : dx > 0 ? '.'.repeat(dx) + r.slice(0, -dx) : r.slice(-dx) + '.'.repeat(-dx),
  );
}
/** a pixel lower: the second pants row drops out and a blank row goes on top (as crouched(), but built once) */
function crouchRows(rows) {
  return ['.'.repeat(rows[0].length), ...rows.slice(0, 12), ...rows.slice(13)];
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
/** the sideways sway of each front/back stride frame (the back view applies it after the number) */
export const STRIDE_SWAY = STRIDE_FRONT.map(s => s[2]);
const swayCache = new Map();
/** rows 0-14 of a front/back map shifted dx pixels (cached, so the sprite cache can reuse it) */
export function swayed(map, dx) {
  if (!dx) return map;
  let pair = swayCache.get(map);
  if (!pair) swayCache.set(map, (pair = {}));
  return (pair[dx] ||= shiftRows(map, dx, 14));
}
export const FACES = { eyes: faceSet('eyes'), visor: faceSet('visor'), cage: faceSet('cage') };
export { FACEV } from '../data/faces';
// Goalie, drawn against a photo of an NHL goalie. The mask is a rounded white shell with a team stripe, a bright
// cage with dark eyes behind it, and a throat guard hanging below. He catches left: from the front the catcher
// (white, team-coloured pocket) is on the right of the picture and the blocker, which holds the stick, on the left.
const G_MASK_F = [
  '......OOOOOO......',
  '.....OWWhhWWO.....',
  '.....OMOMOMMO.....',
  '.....OMMMMMMO.....',
  '......OMMMMO......',
];
const G_MASK_B = [
  '......OOOOOO......',
  '.....OWWhhWWO.....',
  '.....OWWhhWWO.....',
  '.....OWWWWWWO.....',
  '......OHHHHO......',
];
// torso rows 5-11: blocker (W) left, catcher (C) right, throat guard (MM) on top of the front view
const G_TORSO = [
  '..OOOJJJMMJJJOOO..',
  '.OJJJJJJJJJJJJJJO.',
  'OWWOJJJTTTTJJJOCCO',
  'OWWWOJJJJJJJJOCJCO',
  'OWWWOjJJJJJJjOCCCO',
  '.OWWOjJJJJJJjOCCO.',
  '..OOOTTTTTTTTOOO..',
];
const G_TORSO_BACK = ['..OOOJJJJJJJJOOO..', ...G_TORSO.slice(1)];
// one hand freed for a save; the arm is drawn by render/players.js
const G_TORSO_NOCATCH = [
  '..OOOJJJMMJJJOOO..',
  '.OJJJJJJJJJJJJJJO.',
  'OWWOJJJTTTTJJJOO..',
  'OWWWOJJJJJJJJJO...',
  'OWWWOjJJJJJJjJO...',
  '.OWWOjJJJJJJjJO...',
  '..OOOTTTTTTTTOOO..',
];
const G_TORSO_NOBLOCK = [
  '..OOOJJJMMJJJOOO..',
  '.OJJJJJJJJJJJJJJO.',
  '..OOJJJTTTTJJJOCCO',
  '...OJJJJJJJJJOCJCO',
  '...OjJJJJJJJjOCCCO',
  '...OjJJJJJJJjOCCO.',
  '..OOOTTTTTTTTOOO..',
];
const backOf = rows => ['..OOOJJJJJJJJOOO..', ...rows.slice(1)];
const G_PADS = {
  closed: [
    '..OWWWWWOOWWWWWO..',
    '..OWJJWWOOWWJJWO..',
    '..OWWWWWOOWWWWWO..',
    '..OWJJWWOOWWJJWO..',
    '..OWWWWWOOWWWWWO..',
    '..OWWWWWOOWWWWWO..',
    '..OKKKKKOOKKKKKO..',
    '..BBBBBB..BBBBBB..',
  ],
  // T-push: the lead pad turns out, then both are apart while the push leg drives
  half: [
    '..OWWWWWO.OWWWWWO.',
    '..OWJJWWO.OWWJJWO.',
    '..OWWWWWO.OWWWWWO.',
    '..OWJJWWO.OWWJJWO.',
    '..OWWWWWO..OWWWWWO',
    '..OWWWWWO..OWWWWWO',
    '..OKKKKKO..OKKKKKO',
    '..BBBBBB....BBBBBB',
  ],
  open: [
    '.OWWWWWO..OWWWWWO.',
    '.OWJJWWO..OWWJJWO.',
    '.OWWWWWO..OWWWWWO.',
    '.OWJJWWO..OWWJJWO.',
    'OWWWWWO....OWWWWWO',
    'OWWWWWO....OWWWWWO',
    'OKKKKKO....OKKKKKO',
    'BBBBBB......BBBBBB',
  ],
  // dropping into the butterfly: knees bend, the pads start to turn out (two rows shorter)
  drop: [
    '..OWWWWWOOWWWWWO..',
    '.OWJJWWWOOWWWJJWO.',
    '.OWWWWWWOOWWWWWWO.',
    'OWWJJWWO..OWWJJWWO',
    'OKWWWWO....OWWWWKO',
    '.BBBB........BBBB.',
  ],
  // butterfly: knees together in the middle, pads flaring out flat on the ice in a wide V (four rows shorter)
  fly: [
    '....OOWWOOWWOO....',
    '..OOWWJWOOWJWWOO..',
    '.OWWWJWWOOWWJWWWO.',
    'OKWWJWWWOOWWWJWWKO',
    'BOOOOOOO..OOOOOOOB',
  ],
};
export const SPR = {};
SPR.goalieF = [...G_MASK_F, ...G_TORSO, ...G_PADS.closed];
SPR.goalieB = [...G_MASK_B, ...G_TORSO_BACK, ...G_PADS.closed];
for (const pads of ['half', 'open', 'drop', 'fly']) {
  const k = pads[0].toUpperCase() + pads.slice(1);
  SPR['goalieF' + k] = [...G_MASK_F, ...G_TORSO, ...G_PADS[pads]];
  SPR['goalieB' + k] = [...G_MASK_B, ...G_TORSO_BACK, ...G_PADS[pads]];
}
// saves: the catcher or the blocker comes off the body (on half-open pads, as the goalie steps into it)
SPR.goalieFNoCatch = [...G_MASK_F, ...G_TORSO_NOCATCH, ...G_PADS.half];
SPR.goalieFNoBlock = [...G_MASK_F, ...G_TORSO_NOBLOCK, ...G_PADS.half];
SPR.goalieBNoCatch = [...G_MASK_B, ...backOf(G_TORSO_NOCATCH), ...G_PADS.half];
SPR.goalieBNoBlock = [...G_MASK_B, ...backOf(G_TORSO_NOBLOCK), ...G_PADS.half];
/** A save pose: the map padded GPAD columns each side, with an arm (3-pixel sleeve to a glove or blocker) and its
 * outline drawn over it. Arms stay short: the elbow keeps near the body and the glove or blocker moves out. */
export const GPAD = 4;
function withArm(map, sleeve, hand) {
  const w = map[0].length + GPAD * 2,
    rows = map.map(r => [...('.'.repeat(GPAD) + r + '.'.repeat(GPAD))]),
    px = new Map();
  const put = (x, y, c) => px.set(x + GPAD + ',' + y, c);
  const [x0, y0, x1, y1] = sleeve,
    n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let d = 0; d < 3; d++)
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + d + (y1 - y0) * t), 'J');
    }
  for (const [x, y, c] of hand) put(x, y, c);
  for (const k of px.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const kk = x + dx + ',' + (y + dy);
      if (!px.has(kk) && y + dy >= 0 && y + dy < rows.length && x + dx >= 0 && x + dx < w)
        rows[y + dy][x + dx] = 'O';
    }
  }
  for (const [k, c] of px) {
    const [x, y] = k.split(',').map(Number);
    if (y >= 0 && y < rows.length) rows[y][x] = c;
  }
  return rows.map(r => r.join(''));
}
// glove save: the catcher rises beside the mask (k = 1, 2); blocker save: the blocker punches out to the side
const catcher = (hx, hy) =>
  [...Array(16)].map((_, i) => [
    hx + (i % 4),
    hy - 1 + ((i / 4) | 0),
    (i % 4 === 1 || i % 4 === 2) && ((i / 4) | 0) === 1 ? 'J' : 'C',
  ]);
const blocker = (hx, hy) => [...Array(15)].map((_, i) => [hx - 2 + (i % 3), hy - 2 + ((i / 3) | 0), 'W']);
for (const [v, nc, nb] of [
  ['F', SPR.goalieFNoCatch, SPR.goalieFNoBlock],
  ['B', SPR.goalieBNoCatch, SPR.goalieBNoBlock],
])
  for (const k of [1, 2]) {
    SPR['goalie' + v + 'Glove' + k] = withArm(nc, [13, 7, 15, 8 - k * 2], catcher(15, 7 - k * 2));
    SPR['goalie' + v + 'Block' + k] = withArm(nb, [4, 7, 2 - k, 8 - k], blocker(1 - k, 8 - k));
  }
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
    C: '#eef2f6', // the goalie's catcher: white, with a pocket in the team colour
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
