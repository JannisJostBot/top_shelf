import { audio } from '../audio/engine';
import { endReplay } from '../game/replay';
import { endCelebration } from '../game/states/celebrate';
import { G } from '../game/world';
import { input, mouse, nudgeAim } from './state';
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
    // trap the mouse in the game while playing (Esc, pausing or the menu release it)
    if (!G.ai0 && !G.demo && document.pointerLockElement !== cv && cv.requestPointerLock) {
      try {
        const p = cv.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (err) {}
    }
    if (e.button === 0) {
      input.shootHeld = true;
      input.sp = true;
      input.spAt = performance.now();
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
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const locked = document.pointerLockElement === cv;
    if (!locked && e.target !== cv) return;
    const r = cv.getBoundingClientRect();
    mouse.sx = ((e.clientX - r.left) * view.CW) / r.width;
    mouse.sy = ((e.clientY - r.top) * view.CH) / r.height;
    const mv = Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    if (!mouse.on && mv > 2) mouse.on = true;
    if (mouse.on) nudgeAim(e.movementX || 0, e.movementY || 0);
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse' && document.pointerLockElement !== cv) mouse.on = false;
  });
}
