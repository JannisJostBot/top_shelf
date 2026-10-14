import { $ } from '../core/dom';
import { pixelStick } from '../render/players';
import { clock } from '../core/time';
import { puckStyle } from '../data/pucks';
import { kit } from '../game/kit';
import { pvx } from '../render/canvas';
import { SH } from '../render/colors';
import { R, blit } from '../render/pixels';
import { puckPixels } from '../render/puck';
import { FACES, FACEV, SPR } from '../render/sprites';

// menu previews: on Teams a team's skater from three sides plus its goalie, against one skater of the other team;
// on the home page both full line-ups
const PV_LOOK = { skin: '#e8b48a', face: 'visor', tape: '#15171d', skate: '#16181f' };
// Rebuilt only when the team palettes change, so the sprite cache can reuse the preview sprites.
let pals = null;
function previewPals() {
  if (!pals || pals.home !== kit.PAL[0] || pals.away !== kit.PAL[1])
    pals = {
      home: kit.PAL[0],
      away: kit.PAL[1],
      pal: Object.assign({}, kit.PAL[0], { S: PV_LOOK.skin, V: FACEV.visor }),
      cpal: Object.assign({}, kit.PAL[1], { S: '#c98d5f', V: FACEV.cage }),
    };
  return pals;
}
// Which team the Teams tab is customising. The preview shows that team's line-up (three views of a skater and the
// goalie) against one skater of the other team; switching skates one line-up out to the left and the other in.
const pv = { target: 0, k: 0, last: 0 };
export function setPreviewTeam(t) {
  pv.target = t ? 1 : 0;
}
const ease = k => k * k * (3 - 2 * k);
// x of every figure in the home view (k = 0) and the away view (k = 1); off-screen spots are where they skate to
const LAYOUT = {
  hF: [4, 16],
  hS: [22, -84],
  hB: [40, -62],
  hG: [57, -40],
  vs: [88, 34],
  puck: [97, 43],
  aG: [150, 65],
  aB: [172, 88],
  aS: [194, 106],
  aF: [112, 124],
};
// every figure carries its team's selected stick
const tapeOf = team => (team ? '#f2f4f7' : PV_LOOK.tape);
/** The ice the figures stand on, and the figures, drawn into `g` (the 140×36 preview). */
const Y = 30;
function ice(g) {
  g.fillStyle = '#e8f0f7';
  g.fillRect(0, 0, 140, 36);
  g.fillStyle = '#d3e1ec';
  g.fillRect(0, 31, 140, 5);
}
function spr(g, map, p, x, flip) {
  R(g, x, Y + 1, 12, 2, SH);
  blit(g, map, p, x, Y - 19, flip);
}
/** One skater: `pose` is front, side (facing `face`) or back; `st` picks the stride frame. */
function skater(g, team, pose, x, face, st) {
  if (x < -14 || x > 142) return;
  const { pal, cpal } = previewPals(),
    f = team ? FACES.cage : FACES.visor,
    p = team ? cpal : pal,
    tape = tapeOf(team);
  if (pose === 'front') {
    spr(g, st ? f.frontB : f.frontA, p, x);
    pixelStick(g, team, x + 11, Y - 9, x + 13, Y, tape);
  } else if (pose === 'side') {
    spr(g, st ? f.sideB : f.sideA, p, x, face < 0);
    if (face > 0) pixelStick(g, team, x + 11, Y - 9, x + 15, Y, tape);
    else pixelStick(g, team, x, Y - 9, x - 4, Y, tape, { x: x - 6, y: Y, w: 4 });
  } else {
    pixelStick(g, team, x + 11, Y - 9, x + 13, Y, tape); // drawn first: seen from behind, the body hides part of it
    spr(g, st ? f.backB : f.backA, p, x);
  }
}
function goalie(g, team, x) {
  if (x < -20 || x > 142) return;
  const { pal, cpal } = previewPals();
  R(g, x, Y + 1, 18, 2, SH);
  blit(g, SPR.goalieF, team ? cpal : pal, x, Y - 19, false);
  pixelStick(g, team, x + 14, Y - 9, x + 12, Y, tapeOf(team), { x: x + 4, y: Y + 1, w: 9 });
}
function vsAndPuck(g, vx, px) {
  g.fillStyle = '#5b6b80';
  g.font = '7px "Press Start 2P", monospace';
  g.textBaseline = 'middle';
  g.fillText('VS', vx, 14);
  kit.PS = puckStyle();
  R(g, px - 3, 28, 7, 1, SH);
  if (kit.PS.a < 1) g.globalAlpha = kit.PS.a;
  puckPixels(g, px, 25);
  g.globalAlpha = 1;
}
/** The Teams page: the chosen team from every side against one skater of the other team. */
function drawTeamsPreview(g) {
  ice(g);
  const dt = Math.min(0.1, clock.now - (pv.last || clock.now));
  pv.last = clock.now;
  const prevK = pv.k;
  pv.k += Math.sign(pv.target - pv.k) * Math.min(Math.abs(pv.target - pv.k), dt / 1.1);
  const e = ease(pv.k),
    moving = pv.k !== prevK,
    dir = pv.target ? -1 : 1, // which way the line-ups skate while switching: left to the away view
    at = key => Math.round(LAYOUT[key][0] + (LAYOUT[key][1] - LAYOUT[key][0]) * e),
    st = Math.floor(clock.now * (moving ? 9 : 5)) & 1,
    // while the line-ups move they skate side-on
    sk = (team, pose, x, face = 1) =>
      moving ? skater(g, team, 'side', x, dir, st) : skater(g, team, pose, x, face, st);
  sk(0, 'front', at('hF'));
  sk(0, 'side', at('hS'));
  sk(0, 'back', at('hB'));
  goalie(g, 0, at('hG'));
  vsAndPuck(g, at('vs'), at('puck'));
  goalie(g, 1, at('aG'));
  sk(1, 'back', at('aB'));
  sk(1, 'side', at('aS'), -1);
  sk(1, 'front', at('aF'));
}
/** The home page's matchup: both line-ups, a goalie and three skaters a side, facing each other. */
function drawMatchup(g) {
  ice(g);
  const st = Math.floor(clock.now * 5) & 1;
  goalie(g, 0, 1);
  for (const x of [20, 33, 46]) skater(g, 0, 'side', x, 1, st);
  vsAndPuck(g, 63, 70);
  for (const x of [82, 95, 108]) skater(g, 1, 'side', x, -1, st);
  goalie(g, 1, 121);
}
export function drawPreview() {
  drawTeamsPreview(pvx);
  const p2 = $('pv2');
  if (p2 && p2.getContext && p2.offsetParent) {
    const g = p2.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawMatchup(g);
  }
}
