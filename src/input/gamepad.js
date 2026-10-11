// Game controller support (standard / Xbox layout), polled once per frame from the main loop.
import { nextShot } from '../render/director';
//
// In game:   left stick / D-pad skate · A or RT shoot (hold to wind up) · B or RB pass · X or LB switch skater
//            Y next replay angle · View skip replay or celebration · Menu pause
// In menus:  D-pad / left stick move between buttons · A press · B back (resume) · LB / RB change tab
//            Menu start a game
import { $ } from '../core/dom';
import { togglePause } from '../game/match';
import { endReplay, nextAngle } from '../game/replay';
import { endCelebration } from '../game/states/celebrate';
import { G } from '../game/world';
import { input } from './state';
import { toggleWatchCam } from '../ui/menu';

// standard mapping button indices
const A = 0,
  B = 1,
  X = 2,
  Y = 3,
  LB = 4,
  RB = 5,
  RT = 7,
  VIEW = 8,
  MENU = 9,
  UP = 12,
  DOWN = 13,
  LEFT = 14,
  RIGHT = 15;
const DEAD = 0.22;

/** Shared with the rest of the game: whether the controller is the active input, and the stick reading. */
export const pad = { active: false, x: 0, y: 0 };
let prev = [],
  navDir = null,
  navNext = 0,
  shootHeld = false;

function stick(gp) {
  let x = gp.axes[0] || 0,
    y = gp.axes[1] || 0;
  const m = Math.hypot(x, y);
  if (m < DEAD) x = y = 0;
  else {
    const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; // radial dead zone, rescaled to full range
    x *= k;
    y *= k;
  }
  const btn = i => gp.buttons[i] && gp.buttons[i].pressed;
  if (btn(LEFT)) x = -1;
  if (btn(RIGHT)) x = 1;
  if (btn(UP)) y = -1;
  if (btn(DOWN)) y = 1;
  return [x, y];
}

function overlay() {
  for (const id of ['overOv', 'pauseOv', 'menu']) {
    const el = $(id);
    if (el && !el.hidden) return el;
  }
  return null;
}
function focusables(root) {
  return [...root.querySelectorAll('button')].filter(b => {
    if (b.disabled || b.closest('[hidden]')) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}
/** Move focus to the nearest button in the stick direction, measured between button centres. */
function moveFocus(root, dx, dy) {
  const list = focusables(root);
  if (!list.length) return;
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) return focus(root.querySelector('#startBtn:not([hidden])') || list[0]);
  const c = cur.getBoundingClientRect(),
    cx = c.left + c.width / 2,
    cy = c.top + c.height / 2;
  // prefer buttons inside a cone around the pressed direction; fall back to the nearest one that way at all
  let best = null,
    bs = Infinity,
    loose = null,
    ls = Infinity;
  for (const b of list) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect(),
      vx = r.left + r.width / 2 - cx,
      vy = r.top + r.height / 2 - cy,
      along = vx * dx + vy * dy,
      perp = Math.abs(vx * dy - vy * dx);
    if (along <= 4) continue;
    const score = along + perp * 2.5;
    if (perp <= along * 1.2 && score < bs) {
      bs = score;
      best = b;
    }
    if (score < ls) {
      ls = score;
      loose = b;
    }
  }
  best = best || (dx === 0 ? loose : null);
  if (best) focus(best);
}
function focus(el) {
  if (!el) return;
  document.body.classList.add('padnav');
  el.focus({ focusVisible: true });
  el.scrollIntoView({ block: 'nearest' });
}
function switchTab(step) {
  const tabs = [...document.querySelectorAll('.tabs button')],
    i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'),
    t = tabs[(i + step + tabs.length) % tabs.length];
  if (t) {
    t.click();
    focus(t);
  }
}

function menuInput(root, gp, down, now) {
  const [x, y] = stick(gp),
    dir =
      Math.abs(x) > 0.5 || Math.abs(y) > 0.5
        ? Math.abs(x) > Math.abs(y)
          ? [Math.sign(x), 0]
          : [0, Math.sign(y)]
        : null;
  const key = dir && dir.join();
  if (key !== navDir) {
    navDir = key;
    if (dir) {
      moveFocus(root, dir[0], dir[1]);
      navNext = now + 380;
    }
  } else if (dir && now >= navNext) {
    moveFocus(root, dir[0], dir[1]);
    navNext = now + 140;
  }
  if (down(A)) {
    const el = document.activeElement;
    if (el && root.contains(el) && el.tagName === 'BUTTON') el.click();
    else focus(focusables(root)[0]);
  }
  if (down(B) && root.id === 'pauseOv') togglePause();
  if (down(MENU)) {
    if (root.id === 'pauseOv') togglePause();
    else if (root.id === 'menu') $('startBtn').click();
    else if (root.id === 'overOv') $('againBtn').click();
  }
  if (root.id === 'menu') {
    if (down(LB)) switchTab(-1);
    if (down(RB)) switchTab(1);
  }
}

function gameInput(gp, down, now) {
  const b = i => gp.buttons[i] && gp.buttons[i].pressed;
  [pad.x, pad.y] = stick(gp);
  const shoot = b(A) || b(RT);
  if (shoot && !shootHeld) {
    input.shootHeld = true;
    input.sp = true;
  } else if (!shoot && shootHeld) {
    input.shootHeld = false;
    input.sr = true;
  }
  shootHeld = shoot;
  if (down(B) || down(RB)) input.pp = true;
  if (down(X) && G.watch) toggleWatchCam();
  else if (down(X) || down(LB)) input.swp = true;
  if (down(Y) && G.state === 'replay') nextAngle();
  else if (down(Y) && G.watch) nextShot();
  if (down(VIEW)) {
    if (G.state === 'replay') endReplay();
    else if (G.state === 'celebrate') endCelebration();
  }
  if (down(MENU)) togglePause();
}

/** Reads the first connected controller and feeds the game input or the menu focus. Called every frame. */
export function pollGamepad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of list) if (p && p.connected) gp = gp || p;
  if (!gp) {
    pad.x = pad.y = 0;
    prev = [];
    return;
  }
  const now = performance.now(),
    pressed = gp.buttons.map(b => b.pressed),
    down = i => pressed[i] && !prev[i];
  if (pressed.some(Boolean) || Math.abs(gp.axes[0] || 0) > DEAD || Math.abs(gp.axes[1] || 0) > DEAD)
    pad.active = true;
  const root = overlay();
  if (root) {
    pad.x = pad.y = 0;
    if (shootHeld) {
      shootHeld = false;
      input.shootHeld = false;
    }
    menuInput(root, gp, down, now);
  } else gameInput(gp, down, now);
  prev = pressed;
}

/** Rumble on controllers that support it (hits, checks). `ms` is the length, `strength` 0..1. */
export function padRumble(ms, strength) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of list) {
    const v = p && p.vibrationActuator;
    if (!v || !v.playEffect) continue;
    try {
      v.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
    } catch (e) {}
  }
}

// keyboard or mouse use hands the on-screen hints back from the controller
export function initGamepad() {
  const off = () => {
    pad.active = false;
    document.body.classList.remove('padnav');
  };
  addEventListener('keydown', off);
  addEventListener('mousemove', e => {
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) off();
  });
}
