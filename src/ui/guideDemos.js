// Little looping scenes in the Guide tab that show what each action does, drawn with the game's own sprites.
// Every scene is a pure function of the loop time, using stand-in copies of the real rosters.
import { K } from '../config';
import { $ } from '../core/dom';
import { clamp, lerp } from '../core/math';
import { clock } from '../core/time';
import { SK } from '../game/players';
import { blade } from '../game/physics/motion';
import { view } from '../render/canvas';
import { drawCtlBase, drawCtlTop } from '../render/overlays';
import { R, disc } from '../render/pixels';
import { drawSkater } from '../render/players';
import { puckPixels } from '../render/puck';

const LOOP = 2.6; // seconds per scene
const W = 64, // world units shown (the canvas is W*K by H*K pixels)
  H = 28;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** A stand-in skater: a copy of a real one (looks, palette, number) at a given spot and pose. */
function skater(team, i, x, y, o = {}) {
  return Object.assign({}, SK[team][i], {
    x,
    y,
    vx: 0,
    vy: 0,
    fx: 1,
    fy: 0,
    anim: 0,
    jump: 0,
    stickUp: false,
    down: 0,
    stun: 0,
    checkT: 0,
    fallDir: 1,
    ...o,
  });
}
const skating = (t, speed = 6) => ({ vx: 20, anim: t * speed });
function puckAt(x, y, lift = 0) {
  R(Math.round(x * K) - 3, Math.round(y * K) + 2, 7, 1, 'rgba(30,60,110,.28)');
  puckPixels(Math.round(x * K), Math.round((y - lift) * K));
}
function trail(x0, y0, x1, y1, k) {
  for (let i = 1; i <= 4; i++) {
    const kk = Math.max(0, k - i * 0.06);
    R(Math.round(lerp(x0, x1, kk) * K) - 1, Math.round(lerp(y0, y1, kk) * K), 3, 2, '#9fd7ff');
  }
}
function text(s, x, y, col) {
  const g = view.ctx;
  g.font = '6px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.fillStyle = '#0b0f1a';
  g.fillText(s, x * K + 1, y * K + 1);
  g.fillStyle = col;
  g.fillText(s, x * K, y * K);
  g.textAlign = 'left';
}
function miniNet(x, y) {
  R(x * K, (y - 7) * K, 2, 14, '#d8343f');
  R(x * K, (y - 7) * K, 8, 2, '#d8343f');
  for (let i = 2; i < 8; i += 2) R(x * K + i, (y - 7) * K + 2, 1, 12, '#c9d4e2');
}

const SCENES = {
  shoot(t) {
    const p = skater(0, 0, 14, 19, { stickUp: t < 0.9 });
    drawSkater(p);
    miniNet(58, 19);
    if (t < 0.9) {
      // wind-up meter filling
      R(10 * K, 4 * K, 16, 3, '#0b0f1a');
      R(10 * K + 1, 4 * K + 1, Math.round(14 * Math.min(1, t / 0.7)), 1, '#ffc845');
    }
    const b = blade(p);
    if (t < 0.9) puckAt(b.x, b.y);
    else if (t < 1.25) {
      const k = (t - 0.9) / 0.35;
      trail(b.x, b.y, 59, 17, k);
      puckAt(lerp(b.x, 59, k), lerp(b.y, 17, k));
    } else {
      puckAt(59.5, 17);
      if (Math.floor(t * 8) % 2) text('GOAL!', 50, 8, '#ff3b3b');
    }
  },
  pass(t) {
    const a = skater(0, 0, 12, 18),
      b = skater(0, 1, 50, 18, { fx: -1 }),
      k = clamp((t - 0.6) / 0.45, 0, 1),
      ba = blade(a),
      bb = blade(b);
    drawCtlBase(k < 1 ? a : b);
    drawSkater(a);
    drawSkater(b);
    if (k > 0 && k < 1) trail(ba.x, ba.y, bb.x, bb.y, k);
    puckAt(lerp(ba.x, bb.x, k), lerp(ba.y, bb.y, k));
    drawCtlTop(k < 1 ? a : b);
  },
  poke(t) {
    const lunge = ease((t - 0.7) / 0.2) - ease((t - 1.3) / 0.4);
    const c = skater(1, 0, 46 - Math.min(t, 0.9) * 8, 18, {
      fx: -1,
      ...skating(t),
      stun: t > 0.9 && t < 2 ? 1 : 0,
    });
    const d = skater(0, 0, 16 + lunge * 10, 18, { boost: 1 });
    drawSkater(c);
    drawSkater(d);
    if (t < 0.9) puckAt(blade(c).x, blade(c).y);
    else puckAt(blade(d).x, blade(d).y);
    if (t > 0.9 && t < 1.8) text('STOLEN!', 34, 6, '#46f2ff');
  },
  check(t) {
    const hit = 0.95,
      cx = 38 + Math.min(t, hit) * 3,
      dash = ease((t - 0.35) / (hit - 0.35));
    const c = skater(1, 1, t < hit ? cx : cx + ease((t - hit) / 0.3) * 8, 19, {
      fx: 1,
      down: t > hit && t < 2.2 ? 1 : 0,
      fallDir: 1,
      ...skating(t),
    });
    const d = skater(0, 2, lerp(6, cx - 9, dash), 19, { ...skating(t, 10) });
    drawSkater(d);
    drawSkater(c);
    if (t < hit) puckAt(blade(c).x, blade(c).y);
    else {
      const k = ease((t - hit) / 0.8);
      puckAt(cx + 6 + k * 14, 21 + k * 2);
      if (t < 1.7) text('HIT!', cx, 6, '#ff5a3c');
    }
  },
  switch(t) {
    const team = [skater(0, 0, 12, 19), skater(0, 1, 32, 19), skater(0, 2, 52, 19)],
      cur = team[Math.floor(t / (LOOP / 3)) % 3];
    drawCtlBase(cur);
    for (const p of team) drawSkater(p);
    drawCtlTop(cur);
  },
  faceoff(t) {
    const a = skater(0, 0, 24, 18),
      b = skater(1, 0, 40, 18, { fx: -1 }),
      drop = clamp((t - 0.5) / 0.35, 0, 1),
      win = clamp((t - 0.95) / 0.4, 0, 1);
    drawSkater(a);
    drawSkater(b);
    if (t < 0.95) puckAt(32, 18, (1 - drop) * 12);
    else puckAt(lerp(32, 18, ease(win)), 18 + win);
    if (t > 0.85 && t < 1.3) text('DROP!', 32, 6, '#ffc845');
  },
};

/** Draws every demo canvas in the Guide while that tab is open. Called once per frame from the main loop. */
export function drawGuideDemos() {
  const panel = $('p-guide');
  if (!panel || panel.hidden || !SK[0].length) return;
  const save = view.ctx,
    saveFlash = view.ctlFlash,
    t = clock.now % LOOP;
  view.ctlFlash = 0;
  for (const cv of panel.querySelectorAll('canvas[data-demo]')) {
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    view.ctx = g;
    R(0, 0, W * K, H * K, '#e8f0f7');
    R(0, 25 * K, W * K, 1, '#d3e1ec');
    disc(Math.round(W * K * 0.5), Math.round(H * K * 0.5), 1, 1, '#e3ecf4');
    try {
      SCENES[cv.dataset.demo](t);
    } catch (e) {}
  }
  view.ctx = save;
  view.ctlFlash = saveFlash;
}
