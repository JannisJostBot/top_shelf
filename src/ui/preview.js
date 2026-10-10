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

// menu preview: your skater from three sides plus your goalie, against a CPU skater
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
export function drawPreview() {
  const save = view.ctx;
  view.ctx = pvx;
  view.ctx.fillStyle = '#e8f0f7';
  view.ctx.fillRect(0, 0, 140, 36);
  view.ctx.fillStyle = '#d3e1ec';
  view.ctx.fillRect(0, 31, 140, 5);
  const { pal, cpal } = previewPals();
  const st = Math.floor(clock.now * 5) & 1,
    f = FACES.visor,
    y = 30;
  const spr = (map, p, x, flip) => {
    R(x, y + 1, 12, 2, SH);
    blit(map, p, x, y - 19, flip);
  };
  // every figure carries its team's selected stick
  const tape = PV_LOOK.tape;
  spr(st ? f.frontB : f.frontA, pal, 4);
  pixelStick(0, 15, y - 9, 17, y, tape);
  spr(st ? f.sideB : f.sideA, pal, 22);
  pixelStick(0, 33, y - 9, 37, y, tape);
  pixelStick(0, 51, y - 9, 53, y, tape); // drawn first: seen from behind, the body hides part of it
  spr(st ? f.backB : f.backA, pal, 40);
  R(57, y + 1, 18, 2, SH);
  blit(SPR.goalieF, pal, 57, y - 19, false);
  pixelStick(0, 71, y - 9, 69, y, tape, { x: 61, y: y + 1, w: 9 });
  view.ctx.fillStyle = '#5b6b80';
  view.ctx.font = '7px "Press Start 2P", monospace';
  view.ctx.textBaseline = 'middle';
  view.ctx.fillText('VS', 88, 14);
  kit.PS = puckStyle();
  R(94, 28, 7, 1, SH);
  if (kit.PS.a < 1) view.ctx.globalAlpha = kit.PS.a;
  puckPixels(97, 25);
  view.ctx.globalAlpha = 1;
  spr(st ? FACES.cage.frontA : FACES.cage.frontB, cpal, 112, false);
  pixelStick(1, 123, y - 9, 125, y, '#f2f4f7');
  view.ctx = save;
  const p2 = $('pv2');
  if (p2 && p2.getContext) {
    const x2 = p2.getContext('2d');
    x2.imageSmoothingEnabled = false;
    x2.drawImage(pvc, 0, 0);
  }
}
