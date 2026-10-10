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
  if (e.pointerId !== touchState.stickId) return;
  touchState.stickId = null;
  input.touch = false;
  input.tx = input.ty = 0;
  knobAt(0, 0);
  base.style.left = '50%';
  base.style.top = '50%';
}

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
    if (touchState.stickId !== null) return;
    touchState.stickId = e.pointerId;
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
  holdBtn(
    $('shootBtn'),
    () => {
      input.shootHeld = true;
      input.sp = true;
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
