import { audio } from '../audio/engine';
import { endReplay } from '../game/replay';
import { endCelebration } from '../game/states/celebrate';
import { G } from '../game/world';
import { input, mouse } from './state';
import { cv, view } from '../render/canvas';

export function initMouse() {
  cv.addEventListener('pointerdown', e => {
    if (G.state === 'replay') {
      endReplay();
      return;
    }
    if (G.state === 'celebrate') {
      endCelebration();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    audio();
    if (e.button === 0) {
      input.shootHeld = true;
      input.sp = true;
    } else if (e.button === 2) input.pp = true;
    else if (e.button === 1) {
      e.preventDefault();
      input.swp = true;
    }
  });
  addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse' && e.button === 0 && input.shootHeld && !input.touch) {
      input.shootHeld = false;
      input.sr = true;
    }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = cv.getBoundingClientRect();
    mouse.sx = ((e.clientX - r.left) * view.CW) / r.width;
    mouse.sy = ((e.clientY - r.top) * view.CH) / r.height;
    if (!mouse.on && Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 2) mouse.on = true;
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse') mouse.on = false;
  });
}
