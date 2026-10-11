// Animated title for the menu, drawn in the game's own pixel style: a side view into the arena (crowd, glass,
// boards in the selected arena's colours, ice), jersey-style lettering, and a skater in your team's colours who
// winds up and slaps the puck onto the "top shelf", where it lands on top of the word TOP and the crowd jumps.
import { $ } from '../core/dom';
import { clock } from '../core/time';
import { STICKS, stickCol } from '../data/sticks';
import { STADIUMS } from '../data/stadiums';
import { kit } from '../game/kit';
import { settings } from '../settings';

const W = 168,
  H = 76,
  OUT = '#0b0f1a';
// 5x7 glyphs, scaled up when drawn
const GLYPHS = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
};

let g = null;
/** Blend hex colour a toward b by k (0..1). */
function mix(a, b, k) {
  const p = parseInt(a.slice(1), 16),
    q = parseInt(b.slice(1), 16),
    ch = s => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}
function px(x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
/** A word in the pixel font, lettered like a jersey: fill in three bands, an inner and an outer outline and a
 *  soft shadow. */
function word(text, x0, y0, s, fill, inner, outer) {
  const cells = [];
  let x = x0;
  for (const ch of text) {
    const gl = GLYPHS[ch];
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++) if (gl[r][c] === '1') cells.push([x + c * s, y0 + r * s, r]);
    x += 6 * s;
  }
  g.globalAlpha = 0.45;
  for (const [cx, cy] of cells) px(cx, cy + 4, s + 2, s, '#000000');
  g.globalAlpha = 1;
  for (const [cx, cy] of cells) px(cx - 2, cy - 2, s + 4, s + 4, outer);
  for (const [cx, cy] of cells) px(cx - 1, cy - 1, s + 2, s + 2, inner);
  for (const [cx, cy, r] of cells) px(cx, cy, s, s, r < 2 ? fill[0] : r < 5 ? fill[1] : fill[2]);
}

let letters = null,
  lettersFor = '';
function lettering(kick) {
  if (lettersFor !== kick) {
    letters = letters || Object.assign(document.createElement('canvas'), { width: W, height: H });
    const main = g;
    g = letters.getContext('2d');
    g.clearRect(0, 0, W, H);
    word('TOP', 12, 9, 4, ['#ffffff', '#e6f0f9', '#bcd3e9'], kick, OUT);
    word('SHELF', 12, 42, 3, [mix(kick, '#ffffff', 0.3), kick, mix(kick, '#000000', 0.3)], '#ffffff', OUT);
    g = main;
    lettersFor = kick;
  }
  return letters;
}

/* ---------- the arena behind it ---------- */
const BOARDS_Y = 34,
  KICK_Y = 52,
  ICE_Y = 57;
const FANS = [];
for (let y = 3; y < 28; y += 6)
  for (let x = 2 + ((y / 6) % 2) * 3; x < W; x += 6) {
    const h = Math.abs(Math.sin(x * 12.99 + y * 78.23) * 43758.55) % 1;
    FANS.push({
      x,
      y,
      empty: h > 0.88,
      shirt: Math.floor(h * 5),
      ph: h * 6.28,
    });
  }
function arena(t, cheer) {
  const S = STADIUMS[settings.stadiumKey] || STADIUMS.frost,
    shirts = [S.lc[0], S.lc[2], S.kick, '#e9edf3', '#2a2f3d']; // home fans wear the arena's colours
  px(0, 0, W, BOARDS_Y, '#141a2c');
  for (const f of FANS) {
    if (f.empty) continue;
    const jump = cheer > 0 ? Math.round(Math.max(0, Math.sin(t * 14 + f.ph)) * 2 * cheer) : 0;
    px(f.x, f.y + 2 - jump, 3, 3, shirts[f.shirt]);
    px(f.x + 1, f.y - jump, 2, 2, '#e8b48a');
  }
  // glass: a bright top edge and a faint sheen over the crowd
  g.globalAlpha = 0.12;
  px(0, 8, W, BOARDS_Y - 8, '#bfe3ff');
  g.globalAlpha = 1;
  px(0, 7, W, 1, '#9fb8cc');
  // boards with the arena's kick plate, then the ice
  px(0, BOARDS_Y, W, KICK_Y - BOARDS_Y, '#f3f5f8');
  px(0, BOARDS_Y, W, 1, '#c9d2de');
  px(0, KICK_Y, W, ICE_Y - KICK_Y, S.kick);
  px(0, ICE_Y, W, H - ICE_Y, '#e9f1f8');
  px(0, ICE_Y, W, 1, '#c5d6e6');
  // a few skate scratches
  for (let i = 0; i < 14; i++) px((i * 37) % W, 59 + ((i * 5) % 14), 6 + (i % 4) * 3, 1, '#d3e1ec');
}

/* ---------- the skater ---------- */
// The figure is painted onto a coarse grid (2x2 screen pixels per cell) from simple shapes, then outlined
// automatically, so it reads like an enlarged game sprite. Coordinates below are for a skater facing right;
// the grid is mirrored when drawn so the skater faces the wordmark.
const GW = 40,
  GH = 34,
  CELL = 2,
  GX = 88,
  GY = 4;
const grid = new Array(GW * GH);
let pal = null;
const col = (c, x, y) => {
  const v = pal[c] !== undefined ? pal[c] : c;
  return typeof v === 'function' ? v(y, x) : v;
};
function dot(x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < GW && y < GH) grid[y * GW + x] = col(c, x, y);
}
function disc(cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) dot(x, y, c);
}
function limb(x0, y0, x1, y1, w, c) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
  for (let i = 0; i <= n; i++) disc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w / 2, c);
}

// stick poses: top hand position and the direction the shaft points from it
const POSES = {
  ready: { hx: 15, hy: 16, a: Math.atan2(0.84, 0.55) },
  windup: { hx: 13, hy: 10, a: Math.atan2(-0.62, -0.78) },
  strike: { hx: 16, hy: 16, a: Math.atan2(0.94, 0.35) },
  follow: { hx: 18, hy: 11, a: Math.atan2(-0.32, 0.95) },
};
const STICK = 15;
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function blendPose(p, q, k) {
  let da = q.a - p.a;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  return { hx: p.hx + (q.hx - p.hx) * k, hy: p.hy + (q.hy - p.hy) * k, a: p.a + da * k };
}
// one shot every CYCLE seconds: glide, wind up, strike, follow through, recover
const CYCLE = 3.6,
  T_WIND = 0.7,
  T_STRIKE = 1.2,
  T_HIT = 1.3,
  T_FOLLOW = 1.7,
  T_BACK = 2.4;
function poseAt(c) {
  if (c < T_WIND) return POSES.ready;
  if (c < T_STRIKE) return blendPose(POSES.ready, POSES.windup, ease((c - T_WIND) / (T_STRIKE - T_WIND)));
  if (c < T_HIT) return blendPose(POSES.windup, POSES.strike, (c - T_STRIKE) / (T_HIT - T_STRIKE));
  if (c < T_FOLLOW) return blendPose(POSES.strike, POSES.follow, ease((c - T_HIT) / (T_FOLLOW - T_HIT)));
  if (c < T_BACK) return blendPose(POSES.follow, POSES.ready, ease((c - T_FOLLOW) / (T_BACK - T_FOLLOW)));
  return POSES.ready;
}
const bladeEnd = p => [p.hx + Math.cos(p.a) * STICK, p.hy + Math.sin(p.a) * STICK];

function paintSkater(pose) {
  grid.fill(null);
  // back leg: thigh, sock with a stripe, skate
  limb(11, 22, 8, 26, 3.4, 'P');
  limb(8, 26, 5, 29, 3, 'L');
  limb(7.2, 27, 6, 28, 3, 'W');
  for (let x = 2; x <= 7; x++) for (let y = 29; y <= 30; y++) dot(x, y, 'K');
  for (let x = 1; x <= 8; x++) dot(x, 31, 'B');
  // pants
  disc(13, 21, 3.8, 'P');
  disc(11.2, 21.5, 1.8, 'p');
  // torso, leaning forward, shaded along the back, trim at the hem
  limb(13, 19, 17, 11.5, 7, 'J');
  limb(10.6, 18.5, 14.2, 10.6, 2, 'j');
  limb(10, 19.6, 16.4, 18.4, 1.6, 'T');
  // front leg: thigh bent forward, shin, skate
  limb(15, 22, 19, 25, 4, 'P');
  limb(19, 25, 18, 29, 3, 'L');
  limb(18.6, 26.6, 18.4, 27.4, 3, 'W');
  for (let x = 16; x <= 22; x++) for (let y = 29; y <= 30; y++) dot(x, y, 'K');
  for (let x = 15; x <= 23; x++) dot(x, 31, 'B');
  // head: helmet with a highlight, visor and face at the front
  disc(19, 6, 3.8, 'H');
  disc(17.6, 4.4, 1.3, 'h');
  for (let x = 21; x <= 22; x++) dot(x, 6, 'VIS');
  for (let x = 21; x <= 22; x++) dot(x, 7, 'VIS');
  for (let x = 20; x <= 22; x++) dot(x, 8, 'SKIN');
  dot(21, 9, 'SKIN');
  // arms to the hands on the stick, gloves
  const hx = pose.hx,
    hy = pose.hy,
    dx = Math.cos(pose.a),
    dy = Math.sin(pose.a),
    bx = hx + dx * 4.5,
    by = hy + dy * 4.5;
  limb(16.4, 12, hx, hy, 2.6, 'J');
  limb(17.6, 12.6, bx, by, 2.6, 'J');
  limb(16.8, 12.2, 17.4, 13, 2.6, 'T');
  // stick: shaft, then a short blade turned forward along the ice, with white tape
  const [ex, ey] = bladeEnd(pose);
  limb(hx, hy, ex, ey, 1.5, 'WOOD');
  const ba = pose.a - 1.25;
  limb(ex, ey, ex + Math.cos(ba) * 3.2, ey + Math.sin(ba) * 3.2, 1.6, 'TAPE');
  disc(hx, hy, 1.5, 'G');
  disc(bx, by, 1.5, 'G');
}
const EXTRA = { WOOD: '#9a6a35', TAPE: '#f2f4f7', VIS: '#6ec2f2', SKIN: '#e8b48a' };
function drawSkater(pose) {
  // the logo skater carries your team's stick
  const st = STICKS[settings.sticks[0]] || STICKS.wood;
  pal = Object.assign({}, kit.PAL[0] || {}, EXTRA, {
    WOOD: stickCol(st.shaft, 5, 10, clock.now),
    TAPE: st.blade || EXTRA.TAPE,
  });
  paintSkater(pose);
  // ice shadow under the skates
  g.globalAlpha = 0.35;
  px(GX + (GW - 24) * CELL, GY + 32 * CELL, 23 * CELL, CELL, '#000000');
  g.globalAlpha = 1;
  // outline: every empty cell touching the figure
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      if (grid[y * GW + x]) continue;
      const near =
        (x > 0 && grid[y * GW + x - 1]) ||
        (x < GW - 1 && grid[y * GW + x + 1]) ||
        (y > 0 && grid[(y - 1) * GW + x]) ||
        (y < GH - 1 && grid[(y + 1) * GW + x]);
      if (near) px(GX + (GW - 1 - x) * CELL, GY + y * CELL, CELL, CELL, OUT);
    }
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const c = grid[y * GW + x];
      if (c) px(GX + (GW - 1 - x) * CELL, GY + y * CELL, CELL, CELL, c);
    }
}
// grid cell (facing right) to screen pixel, mirrored like the figure
const toScreen = (x, y) => [GX + (GW - 1 - x) * CELL + 1, GY + y * CELL + 1];

/* ---------- the puck ---------- */
const REST = [44, 6], // on top of the O in TOP
  T_LAND = 1.75,
  T_FADE = 3.2;
function puckPx(x, y, a) {
  g.globalAlpha = a;
  px(Math.round(x) - 3, Math.round(y) - 2, 6, 4, OUT);
  px(Math.round(x) - 2, Math.round(y) - 2, 4, 1, '#5a6378');
  g.globalAlpha = 1;
}
function puck(c) {
  const [sx, sy] = toScreen(...bladeEnd(POSES.strike)),
    [rx, ry] = REST;
  if (c < T_HIT) return puckPx(sx, sy + 1, 1); // waiting on the ice at the blade
  if (c < T_LAND) {
    // flight: a high arc up and over onto the letters, with a short trail
    const at = k => {
      const cx = (sx + rx) / 2,
        cy = -14;
      return [
        (1 - k) ** 2 * sx + 2 * (1 - k) * k * cx + k * k * rx,
        (1 - k) ** 2 * sy + 2 * (1 - k) * k * cy + k * k * ry,
      ];
    };
    const k = (c - T_HIT) / (T_LAND - T_HIT);
    for (let i = 1; i <= 4; i++) {
      const [tx, ty] = at(Math.max(0, k - i * 0.05));
      g.globalAlpha = 0.45 - i * 0.09;
      px(Math.round(tx) - 1, Math.round(ty) - 1, 3, 2, '#9fd7ff');
    }
    g.globalAlpha = 1;
    const [x, y] = at(k);
    return puckPx(x, y, 1);
  }
  // a small bounce on landing, then rest and fade out before the next shot
  const b = c - T_LAND,
    hop = b < 0.25 ? Math.sin((b / 0.25) * Math.PI) * 4 : 0,
    a = c < T_FADE ? 1 : Math.max(0, 1 - (c - T_FADE) / (CYCLE - T_FADE));
  puckPx(rx, ry - hop, a);
  if (b < 0.4) {
    const r = 3 + b * 24;
    for (let i = 0; i < 6; i++) {
      const an = (i / 6) * Math.PI * 2 + 0.4;
      px(
        Math.round(rx + Math.cos(an) * r),
        Math.round(ry + Math.sin(an) * r * 0.6),
        2,
        2,
        i % 2 ? '#ffde59' : '#ffffff',
      );
    }
  }
}

export function drawLogo() {
  const cv = $('logo');
  if (!cv) return;
  g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const t = clock.now,
    c = t % CYCLE;
  arena(t, c > T_LAND && c < T_LAND + 1.2 ? 1 - (c - T_LAND) / 1.2 : 0);
  drawSkater(poseAt(c));
  // lettering takes the selected arena's accent colour, so it changes with the arena; it is the same every
  // frame, so it is drawn once per colour onto its own layer and copied in
  const kick = (STADIUMS[settings.stadiumKey] || STADIUMS.frost).kick;
  g.drawImage(lettering(kick), 0, 0);
  puck(c);
}
