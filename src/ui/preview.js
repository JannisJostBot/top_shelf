import { $ } from '../core/dom';
import { pixelStick } from '../render/players';
import { clock } from '../core/time';
import { puckStyle } from '../data/pucks';
import { kit } from '../game/kit';
import { pvc, pvx, view } from '../render/canvas';
import { SH } from '../render/colors';
import { R, blit } from '../render/pixels';
import { puckPixels } from '../render/puck';
import { FACES, FACEV, SPR } from '../render/sprites';

// menu preview: a team's skater from three sides plus its goalie, against one skater of the other team
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
export function drawPreview() {
  const save = view.ctx;
  view.ctx = pvx;
  view.ctx.fillStyle = '#e8f0f7';
  view.ctx.fillRect(0, 0, 140, 36);
  view.ctx.fillStyle = '#d3e1ec';
  view.ctx.fillRect(0, 31, 140, 5);
  const { pal, cpal } = previewPals();
  const dt = Math.min(0.1, clock.now - (pv.last || clock.now));
  pv.last = clock.now;
  const prevK = pv.k;
  pv.k += Math.sign(pv.target - pv.k) * Math.min(Math.abs(pv.target - pv.k), dt / 1.1);
  const e = ease(pv.k),
    moving = pv.k !== prevK,
    dir = pv.target ? -1 : 1, // which way the line-ups skate while switching: left to the away view
    at = key => Math.round(LAYOUT[key][0] + (LAYOUT[key][1] - LAYOUT[key][0]) * e);
  const st = Math.floor(clock.now * (moving ? 9 : 5)) & 1,
    y = 30;
  const spr = (map, p, x, flip) => {
    R(x, y + 1, 12, 2, SH);
    blit(map, p, x, y - 19, flip);
  };
  // every figure carries its team's selected stick
  const tapeOf = team => (team ? '#f2f4f7' : PV_LOOK.tape);
  /** One skater: `pose` is front, side (facing `face`) or back; while the line-ups move they skate side-on. */
  const skater = (team, pose, x, face = 1) => {
    if (x < -14 || x > 142) return;
    const f = team ? FACES.cage : FACES.visor,
      p = team ? cpal : pal,
      tape = tapeOf(team);
    if (moving) pose = 'side';
    if (moving) face = dir;
    if (pose === 'front') {
      spr(st ? f.frontB : f.frontA, p, x);
      pixelStick(team, x + 11, y - 9, x + 13, y, tape);
    } else if (pose === 'side') {
      spr(st ? f.sideB : f.sideA, p, x, face < 0);
      if (face > 0) pixelStick(team, x + 11, y - 9, x + 15, y, tape);
      else pixelStick(team, x, y - 9, x - 4, y, tape, { x: x - 6, y, w: 4 });
    } else {
      pixelStick(team, x + 11, y - 9, x + 13, y, tape); // drawn first: seen from behind, the body hides part of it
      spr(st ? f.backB : f.backA, p, x);
    }
  };
  const goalie = (team, x) => {
    if (x < -20 || x > 142) return;
    R(x, y + 1, 18, 2, SH);
    blit(SPR.goalieF, team ? cpal : pal, x, y - 19, false);
    pixelStick(team, x + 14, y - 9, x + 12, y, tapeOf(team), { x: x + 4, y: y + 1, w: 9 });
  };
  skater(0, 'front', at('hF'));
  skater(0, 'side', at('hS'));
  skater(0, 'back', at('hB'));
  goalie(0, at('hG'));
  view.ctx.fillStyle = '#5b6b80';
  view.ctx.font = '7px "Press Start 2P", monospace';
  view.ctx.textBaseline = 'middle';
  view.ctx.fillText('VS', at('vs'), 14);
  kit.PS = puckStyle();
  const px = at('puck');
  R(px - 3, 28, 7, 1, SH);
  if (kit.PS.a < 1) view.ctx.globalAlpha = kit.PS.a;
  puckPixels(px, 25);
  view.ctx.globalAlpha = 1;
  goalie(1, at('aG'));
  skater(1, 'back', at('aB'));
  skater(1, 'side', at('aS'), -1);
  skater(1, 'front', at('aF'));
  view.ctx = save;
  const p2 = $('pv2');
  if (p2 && p2.getContext) {
    const x2 = p2.getContext('2d');
    x2.imageSmoothingEnabled = false;
    x2.drawImage(pvc, 0, 0);
  }
}
