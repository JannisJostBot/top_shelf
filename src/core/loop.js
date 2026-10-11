import { audioTick } from '../audio/sfx';
import { G } from '../game/world';
import { STEP } from '../config';
import { $ } from './dom';
import { clock } from './time';
import { update } from '../game/update';
import { pollGamepad } from '../input/gamepad';
import { render } from '../render/renderer';
import { beforeStep, blendIn, blendOut } from '../render/interp';
import { updPad } from '../ui/pad';
import { updCard } from '../ui/playerCard';
import { hudBuff } from '../ui/hud';
import { updSide } from '../ui/side';
import { drawGuideDemos } from '../ui/guideDemos';
import { drawLogo } from '../ui/logo';
import { drawPreview } from '../ui/preview';

let last = performance.now(),
  acc = 0;
export function frame(now) {
  clock.now = now / 1000;
  pollGamepad();
  // menus and the pause screen need the mouse pointer back
  if (document.pointerLockElement && (G.demo || G.state === 'paused' || G.state === 'over'))
    document.exitPointerLock();
  let d = (now - last) / 1000;
  last = now;
  if (d > 0.1) d = 0.1;
  acc += d;
  let n = 0;
  while (acc >= STEP && n < 8) {
    beforeStep();
    update(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 8) acc = 0;
  // drawn between the last two steps (see render/interp.js); the simulation's values are back right after
  blendIn(Math.min(1, acc / STEP));
  try {
    render();
  } finally {
    blendOut();
  }
  updPad();
  updCard();
  hudBuff();
  updSide();
  audioTick();
  if (!$('menu').hidden) {
    drawPreview();
    drawLogo();
    drawGuideDemos();
  }
  requestAnimationFrame(frame);
}
