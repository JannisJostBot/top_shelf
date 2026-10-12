import { audio } from '../audio/engine';
import { $ } from '../core/dom';
import { clamp } from '../core/math';
import { input } from './state';
import { fit } from '../render/camera';

export const zone = $('zone'),
  base = $('base'),
  knob = $('knob'),
  pad = $('pad');
// on-screen controls only where there is a touchscreen; switch them on the moment someone touches
export const touchState = {
  touchUI:
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window,
  padWanted: false,
  stickId: null,
  padMode: '',
};

export function applyInputMode() {
  pad.hidden = !(touchState.padWanted && touchState.touchUI);
  $('touchHelp').hidden = !touchState.touchUI;
  $('keysLbl').textContent = touchState.touchUI ? 'WITH A KEYBOARD' : 'KEYBOARD';
  touchState.padMode = '';
  fit();
}
let bcx = 0,
  bcy = 0;
export function knobAt(dx, dy) {
  knob.style.transform = `translate(${dx}px,${dy}px)`;
}
function moveStick(e) {
  const r = zone.getBoundingClientRect(),
    R = base.offsetWidth / 2 - 6;
  let dx = e.clientX - r.left - bcx,
    dy = e.clientY - r.top - bcy;
  const l = Math.hypot(dx, dy);
  if (l > R) {
    dx *= R / l;
    dy *= R / l;
  }
  knobAt(dx, dy);
  const m = Math.min(l, R) / R;
  if (m < 0.12) {
    input.tx = input.ty = 0;
  } else {
    input.tx = (dx / (Math.hypot(dx, dy) || 1)) * m;
    input.ty = (dy / (Math.hypot(dx, dy) || 1)) * m;
  }
}
function endStick(e) {
  if (e.pointerId === touchState.stickId) releaseStick();
}
/** Lets go of the stick: centred knob, no steering. */
function releaseStick() {
  touchState.stickId = null;
  input.touch = false;
  input.tx = input.ty = 0;
  knobAt(0, 0);
  base.style.left = '50%';
  base.style.top = '50%';
}

// release handlers of the held buttons, so a lost release can be made up for when no finger is left
const releasers = [];
function holdBtn(el, down, up) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    audio();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
    el.classList.add('down');
    down();
  });
  const u = () => {
    if (!el.classList.contains('down')) return;
    el.classList.remove('down');
    up();
  };
  releasers.push(u);
  el.addEventListener('pointerup', u);
  el.addEventListener('pointercancel', u);
  el.addEventListener('lostpointercapture', u);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
export function initTouch() {
  addEventListener(
    'pointerdown',
    e => {
      if (e.pointerType === 'touch' && !touchState.touchUI) {
        touchState.touchUI = true;
        applyInputMode();
      }
    },
    true,
  );
  zone.addEventListener('pointerdown', e => {
    e.preventDefault();
    audio();
    // A new touch on the stick always takes it over. If the previous finger's release got lost (a gesture the
    // browser took over, the app going to the background), the stick would otherwise stay stuck to it.
    const old = touchState.stickId;
    touchState.stickId = e.pointerId;
    if (old !== null && old !== e.pointerId)
      try {
        zone.releasePointerCapture(old);
      } catch (_) {}
    try {
      zone.setPointerCapture(e.pointerId);
    } catch (_) {}
    const r = zone.getBoundingClientRect(),
      hw = base.offsetWidth / 2;
    bcx = clamp(e.clientX - r.left, hw, Math.max(hw, r.width - hw));
    bcy = clamp(e.clientY - r.top, hw, Math.max(hw, r.height - hw));
    base.style.left = bcx + 'px';
    base.style.top = bcy + 'px';
    input.touch = true;
    moveStick(e);
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId === touchState.stickId) moveStick(e);
  });
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  zone.addEventListener('lostpointercapture', endStick);
  // safety nets for releases the stick area itself never hears about
  addEventListener('pointerup', endStick, true);
  addEventListener('pointercancel', endStick, true);
  // no finger left on the screen: nothing can still be held
  const noFingers = e => {
    if (e.touches.length) return;
    if (touchState.stickId !== null) releaseStick();
    for (const u of releasers) u();
  };
  addEventListener('touchend', noFingers, true);
  addEventListener('touchcancel', noFingers, true);
  addEventListener('blur', () => touchState.stickId !== null && releaseStick());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && touchState.stickId !== null) releaseStick();
  });
  holdBtn(
    $('shootBtn'),
    () => {
      input.shootHeld = true;
      input.sp = true;
      input.spAt = performance.now();
    },
    () => {
      input.shootHeld = false;
      input.sr = true;
    },
  );
  holdBtn(
    $('passBtn'),
    () => {
      input.pp = true;
    },
    () => {},
  );
  holdBtn(
    $('swBtn'),
    () => {
      input.swp = true;
    },
    () => {},
  );
}
