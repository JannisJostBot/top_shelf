// Films the arena intro (game/states/intro.js): a camera flight with the 3D renderer, different in every arena,
// with an effect of its own drawn over it, between letterbox bars. Timed by the real clock so it moves smoothly.
import { clock } from '../core/time';
import { rnd } from '../core/math';
import { INTRO_LEN } from '../game/states/intro';
import { G } from '../game/world';
import { reduceMotion } from '../settings';
import { view } from './canvas';
import { render3D } from './mode7';

const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
/** Aims the 3D camera from (x, y, h) at the point (tx, ty). */
function aim(x, y, h, tx, ty) {
  const C = G.cam3 || (G.cam3 = { x, y, yaw: 0, h });
  C.x = x;
  C.y = y;
  C.h = h;
  C.yaw = Math.atan2(ty - y, tx - x);
  C.guest = false;
}

// screen-space particles of the current intro (snow, embers, sparks)
let parts = [],
  partsFor = null;
function spawn(n, make) {
  for (let i = 0; i < n; i++) parts.push(make());
}

/** One camera path and one overlay per arena; u runs 0..1 over the intro. */
const SHOTS = {
  // a crane shot sinking from high above the end boards toward centre ice, through falling snow
  frost(u, g, W, H) {
    const k = ease(u);
    aim(80, lerp(262, 196, k), lerp(34, 9, k), 80, lerp(150, 110, k));
    render3D(g, false);
    if (Math.random() < 0.9)
      spawn(2, () => ({
        x: rnd(0, W),
        y: -2,
        vx: rnd(-4, 4),
        vy: rnd(10, 22),
        s: Math.random() < 0.3 ? 2 : 1,
        c: '#ffffff',
      }));
  },
  // rising from the ice while circling, with light rippling as if under water
  harbor(u, g, W, H) {
    const k = ease(u),
      a = lerp(-2.4, -1.2, k);
    aim(80 + Math.cos(a) * 64, 128 + Math.sin(a) * 96, lerp(2.5, 14, k), 80, 128); // around the players, not through them
    render3D(g, false);
    g.globalAlpha = 0.18 * (1 - k * 0.7);
    g.fillStyle = '#1fb5a8';
    for (let y = 0; y < H; y += 4) {
      const w = Math.sin(y * 0.09 + clock.now * 3) * 0.5 + 0.5;
      g.fillRect(0, y, W, Math.round(1 + w * 2));
    }
    g.globalAlpha = 1;
  },
  // a low, bobbing glide along the boards, with orange spotlights sweeping the ice
  penguin(u, g, W, H) {
    const k = ease(u),
      bob = Math.abs(Math.sin(clock.now * 7)) * 0.7;
    aim(lerp(34, 58, k), lerp(222, 162, k), 4 + bob, 80, lerp(150, 118, k));
    render3D(g, false);
    g.globalAlpha = 0.12;
    g.fillStyle = '#ffb000';
    for (let i = 0; i < 2; i++) {
      const cx = W * (0.5 + 0.4 * Math.sin(clock.now * 1.3 + i * 2.6)),
        cy = H * (0.72 + 0.08 * Math.cos(clock.now * 1.7 + i));
      g.beginPath();
      g.ellipse(cx, cy, W * 0.13, H * 0.06, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  },
  // in the dark, the lights flicker on bank by bank, then a slow push in on centre ice
  neon(u, g, W, H) {
    const k = ease(u);
    aim(80, lerp(214, 170, k), lerp(11, 8, k), 80, 118);
    render3D(g, false);
    const on =
      u < 0.15 ? 0 : u < 0.45 ? (Math.floor(clock.now * 14) % 3 ? 0.6 : 0.2) * ((u - 0.15) / 0.3) + 0.2 : 1;
    if (on < 1) {
      g.globalAlpha = 1 - on;
      g.fillStyle = '#05020c';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    // a magenta and a cyan scan line sweeping down
    const y = ((clock.now * 70) % (H + 40)) - 20;
    g.globalAlpha = 0.35 * on;
    g.fillStyle = '#ff3fb4';
    g.fillRect(0, y, W, 2);
    g.fillStyle = '#22b8e6';
    g.fillRect(0, H - y, W, 2);
    g.globalAlpha = 1;
  },
  // warm darkness slowly lit, circling the rink while embers drift up
  timber(u, g, W, H) {
    const k = ease(u),
      a = lerp(0.6, 1.5, k);
    aim(80 + Math.cos(a) * 60, 128 + Math.sin(a) * 84, lerp(16, 10, k), 80, 128);
    render3D(g, false);
    g.globalAlpha = Math.max(0, 0.6 * (1 - u * 1.6));
    g.fillStyle = '#1a0d04';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    if (Math.random() < 0.7)
      spawn(1, () => ({
        x: rnd(0, W),
        y: H + 2,
        vx: rnd(-6, 6),
        vy: rnd(-26, -14),
        s: 1,
        c: Math.random() < 0.5 ? '#ffb347' : '#ff7a2a',
      }));
  },
  // pushing in from the end with a slight shake, sparks raining down, a forge glow at the edges
  iron(u, g, W, H) {
    const k = ease(u),
      sh = (1 - k) * 0.5;
    aim(80 + rnd(-sh, sh), lerp(30, 70, k), lerp(12, 8, k) + rnd(-sh, sh), 80, 150);
    render3D(g, false);
    const glow = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    if (glow) {
      glow.addColorStop(0, 'rgba(255,90,31,0)');
      glow.addColorStop(1, 'rgba(255,90,31,0.28)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
    }
    if (Math.random() < 0.9)
      spawn(3, () => ({
        x: rnd(0, W),
        y: -2,
        vx: rnd(-14, 14),
        vy: rnd(40, 80),
        s: 1,
        c: Math.random() < 0.5 ? '#ffde59' : '#ff9b2f',
      }));
  },
};

let lastNow = 0;
/** Draws the current frame of the arena intro. */
export function drawIntro(g) {
  const I = G.intro,
    W = view.CW,
    H = view.CH,
    u = Math.min(1, (clock.now - I.t0) / INTRO_LEN),
    shot = SHOTS[I.key] || SHOTS.frost;
  if (partsFor !== I) {
    parts = [];
    partsFor = I;
    lastNow = clock.now;
  }
  const dt = Math.min(0.05, Math.max(0, clock.now - lastNow));
  lastNow = clock.now;
  shot(u, g, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > H + 4 || p.y < -6) {
      parts.splice(i, 1);
      continue;
    }
    g.fillStyle = p.c;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
  }
  // letterbox bars that open up at the end, and a fade in from black at the start
  const bar = Math.round(H * 0.09 * (1 - ease((u - 0.85) / 0.15)));
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, bar);
  g.fillRect(0, H - bar, W, bar);
  if (u < 0.12 && !reduceMotion) {
    g.globalAlpha = 1 - u / 0.12;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}
