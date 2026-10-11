// The centre-hung scoreboard for the 3D views: a box hanging high over centre ice (where arenas hang theirs),
// with a screen on each side showing the teams, the score, the period and the clock, LED rings in the arena's
// colour above and below the screens, and cables up to the roof.
import { G } from '../game/world';
import { kit } from '../game/kit';
import { STADIUMS } from '../data/stadiums';
import { settings } from '../settings';
import { ROOF_H } from './roofs';

const CX = 80,
  CY = 128,
  HX = 11, // half size across the rink (the end screens are 22 wide)
  HY = 17, // half size along the rink (the side screens are 34 wide)
  ZB = 28, // bottom of the box
  ZT = 43; // top of the box

// 3x5 pixel font
const F = {
  0: '111101101101111',
  1: '010110010010111',
  2: '111001111100111',
  3: '111001111001111',
  4: '101101111001001',
  5: '111100111001111',
  6: '111100111101111',
  7: '111001010010010',
  8: '111101111101111',
  9: '111101111001111',
  ':': '000010000010000',
  '-': '000000111000000',
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  ' ': '000000000000000',
};
/** Text in the 3x5 font at scale s; returns its width. */
function text(g, str, x, y, col, s = 1) {
  g.fillStyle = col;
  let cx = x;
  for (const ch of str) {
    const m = F[ch] || F[' '];
    for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
    cx += 4 * s;
  }
  return cx - x - s;
}
const width = (str, s = 1) => str.length * 4 * s - s;
const abbr = t => (kit.TEAMS[t].name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || (t ? 'AWY' : 'HOM');
const clockText = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

// the two screen faces: the long one for the sides, the short one for the ends
const LONG = { w: 60, h: 28 },
  SHORT = { w: 40, h: 28 };
for (const f of [LONG, SHORT]) {
  f.c = document.createElement('canvas');
  f.c.width = f.w;
  f.c.height = f.h;
  f.g = f.c.getContext('2d');
}
let shownKey = '';
/** Repaints the screens when anything on them changes. */
function paint() {
  const per = G.practice ? 'PRACTICE' : G.period > 3 ? 'OT' : 'P' + Math.max(1, G.period || 1),
    clk = G.practice
      ? ''
      : G.demo
        ? clockText(settings.periodLen)
        : G.period > 3
          ? 'SD'
          : clockText(Math.max(0, Math.ceil(G.clock || 0))),
    sc = G.score || [0, 0],
    S = STADIUMS[settings.stadiumKey],
    key = [per, clk, sc[0], sc[1], abbr(0), abbr(1), kit.TEAMS[0].main, kit.TEAMS[1].main, S.kick].join('|');
  if (key === shownKey) return;
  shownKey = key;
  for (const f of [LONG, SHORT]) {
    const g = f.g,
      W = f.w,
      H = f.h;
    g.fillStyle = '#1a1f2c'; // housing
    g.fillRect(0, 0, W, H);
    g.fillStyle = S.kick; // LED rings
    g.fillRect(0, 0, W, 2);
    g.fillRect(0, H - 2, W, 2);
    g.fillStyle = '#04060b'; // screen
    g.fillRect(1, 3, W - 2, H - 6);
    const s0 = String(sc[0]),
      s1 = String(sc[1]);
    if (f === LONG) {
      text(g, abbr(0), 4, 5, kit.TEAMS[0].main);
      text(g, s0, 4 + (11 - width(s0, 2)) / 2, 12, '#ffffff', 2);
      text(g, abbr(1), W - 15, 5, kit.TEAMS[1].main);
      text(g, s1, W - 15 + (11 - width(s1, 2)) / 2, 12, '#ffffff', 2);
      text(g, clk, (W - width(clk)) / 2, 6, '#ffc845');
      text(g, per.slice(0, 3), (W - width(per.slice(0, 3))) / 2, 14, '#8f9cc0');
    } else {
      const sc2 = s0 + '-' + s1;
      text(g, sc2, (W - width(sc2, 2)) / 2, 5, '#ffffff', 2);
      text(g, clk, (W - width(clk)) / 2, 17, '#ffc845');
    }
  }
}

/** Draws one screen face between world points A (left, seen from outside) and B, in vertical strips so the
 * perspective is right. */
function face(g, proj, f, ax, ay, bx, by) {
  const N = 14;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const u = i / N,
      x = ax + (bx - ax) * u,
      y = ay + (by - ay) * u,
      top = proj(x, y, ZT),
      bot = proj(x, y, ZB);
    if (!top || !bot) return;
    const cur = { x: top.x, t: top.y, b: bot.y };
    if (prev && cur.x > prev.x) {
      const sx = ((i - 1) / N) * f.w,
        x0 = Math.floor(prev.x),
        x1 = Math.ceil(cur.x),
        t = Math.min(prev.t, cur.t),
        b = Math.max(prev.b, cur.b);
      g.drawImage(f.c, sx, 0, f.w / N, f.h, x0, t, Math.max(1, x1 - x0), b - t);
    }
    prev = cur;
  }
}

/** Draws the scoreboard from camera C3 with the 3D view's projection. */
export function drawScoreboard(g, proj, C3) {
  const corners = [
    [CX - HX, CY - HY],
    [CX + HX, CY - HY],
    [CX + HX, CY + HY],
    [CX - HX, CY + HY],
  ];
  const bottom = corners.map(([x, y]) => proj(x, y, ZB));
  if (bottom.some(q => !q)) return;
  paint();
  g.save();
  g.imageSmoothingEnabled = false;
  // cables up to the roof
  g.strokeStyle = '#2a3040';
  g.lineWidth = 1;
  for (const [x, y] of corners) {
    const a = proj(x, y, ZT),
      b = proj(x + (x - CX) * 0.4, y + (y - CY) * 0.4, ROOF_H);
    if (!a || !b) continue;
    g.beginPath();
    g.moveTo(Math.round(a.x) + 0.5, Math.round(a.y));
    g.lineTo(Math.round(b.x) + 0.5, Math.round(b.y));
    g.stroke();
  }
  // the underside (the cameras are always below it), with a few lights
  g.fillStyle = '#0d111c';
  g.beginPath();
  bottom.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.closePath();
  g.fill();
  // the screens facing the camera; outward normal n, the left end (as seen from outside) is centre + n*d + L*w,
  // with L = (-n.y, n.x)
  for (const [nx, ny, d, w, f] of [
    [1, 0, HX, HY, LONG],
    [-1, 0, HX, HY, LONG],
    [0, 1, HY, HX, SHORT],
    [0, -1, HY, HX, SHORT],
  ]) {
    if ((C3.x - CX) * nx + (C3.y - CY) * ny <= d) continue;
    const lx = -ny,
      ly = nx;
    face(g, proj, f, CX + nx * d + lx * w, CY + ny * d + ly * w, CX + nx * d - lx * w, CY + ny * d - ly * w);
  }
  g.restore();
}
