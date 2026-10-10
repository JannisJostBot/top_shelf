import { $ } from '../core/dom';
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
export function drawPreview() {
  const save = view.ctx;
  view.ctx = pvx;
  view.ctx.fillStyle = '#e8f0f7';
  view.ctx.fillRect(0, 0, 140, 36);
  view.ctx.fillStyle = '#d3e1ec';
  view.ctx.fillRect(0, 31, 140, 5);
  const pal = Object.assign({}, kit.PAL[0], { S: PV_LOOK.skin, V: FACEV.visor }),
    cpal = Object.assign({}, kit.PAL[1], { S: '#c98d5f', V: FACEV.cage });
  const st = Math.floor(clock.now * 5) & 1,
    f = FACES.visor,
    y = 30;
  const spr = (map, p, x, flip) => {
    R(x, y + 1, 12, 2, SH);
    blit(map, p, x, y - 19, flip);
  };
  spr(st ? f.frontB : f.frontA, pal, 4);
  spr(st ? f.sideB : f.sideA, pal, 22);
  spr(st ? f.backB : f.backA, pal, 40);
  R(57, y + 1, 18, 2, SH);
  blit(SPR.goalieF, pal, 57, y - 19, false);
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
  view.ctx = save;
  const p2 = $('pv2');
  if (p2 && p2.getContext) {
    const x2 = p2.getContext('2d');
    x2.imageSmoothingEnabled = false;
    x2.drawImage(pvc, 0, 0);
  }
}
