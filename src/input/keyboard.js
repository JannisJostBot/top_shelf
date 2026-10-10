import { audio } from '../audio/engine';
import { nextShot } from '../render/director';
import { togglePause } from '../game/match';
import { endReplay, nextAngle } from '../game/replay';
import { endCelebration } from '../game/states/celebrate';
import { G } from '../game/world';
import { input } from './state';
import { showTab } from '../ui/menu';

export function initKeyboard() {
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    audio();
    if (e.key === '?' || e.code === 'KeyH') {
      if (G.demo) {
        showTab('help');
      } else if (G.state !== 'paused' && G.state !== 'over') togglePause();
      return;
    }
    if (e.code === 'KeyV' && G.state === 'replay') {
      nextAngle();
      return;
    }
    if (e.code === 'KeyV' && G.watch) {
      nextShot();
      return;
    }
    if (e.code === 'Enter' && G.state === 'replay') {
      endReplay();
      return;
    }
    if (e.code === 'Enter' && G.state === 'celebrate') {
      endCelebration();
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyJ') {
      input.shootHeld = true;
      input.sp = true;
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK' || e.code === 'KeyX') {
      input.pp = true;
      return;
    }
    if (e.code === 'KeyL' || e.code === 'KeyC') {
      input.swp = true;
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
      return;
    }
    input.keys.add(e.code);
  });
  addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'KeyJ') {
      input.shootHeld = false;
      input.sr = true;
      return;
    }
    input.keys.delete(e.code);
  });
  addEventListener('blur', () => {
    input.keys.clear();
    if (input.shootHeld) {
      input.shootHeld = false;
      input.sr = true;
    }
  });
}
