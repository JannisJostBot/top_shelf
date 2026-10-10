import { audioTick } from '../audio/sfx';
import { STEP } from '../config';
import { $ } from './dom';
import { clock } from './time';
import { update } from '../game/update';
import { render } from '../render/renderer';
import { updPad } from '../ui/pad';
import { updCard } from '../ui/playerCard';
import { drawLogo } from '../ui/logo';
import { drawPreview } from '../ui/preview';

let last = performance.now(),
  acc = 0;
export function frame(now) {
  clock.now = now / 1000;
  let d = (now - last) / 1000;
  last = now;
  if (d > 0.1) d = 0.1;
  acc += d;
  let n = 0;
  while (acc >= STEP && n < 8) {
    update(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 8) acc = 0;
  render();
  updPad();
  updCard();
  audioTick();
  if (!$('menu').hidden) {
    drawPreview();
    drawLogo();
  }
  requestAnimationFrame(frame);
}
