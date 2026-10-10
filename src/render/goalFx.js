// Goal effects for the special pucks. A goal scored with one of them sets off its own little show at the net;
// plain pucks keep the normal celebration. Everything is computed from the time since the goal, so the effect
// needs no per-frame state and plays the same in the replay.
import { K } from '../config';
import { rnd } from '../core/math';
import { clock } from '../core/time';
import { view } from './canvas';
import { R, disc } from './pixels';

const LEN = 2.4; // seconds
const FX = { disco: disco, fire: fire, rainbow: rainbow, plasma: plasma, ghost: ghost, galaxy: galaxy };
let fx = null;

/** Starts the effect for puck `key` at world (x, y); `top` is true for the goal at the top of the rink. */
export function startGoalFx(key, x, y, top) {
  if (!FX[key]) return;
  // random parts are rolled once at the start so the effect is stable while it plays
  const bits = [...Array(60)].map(() => ({
    a: rnd(0, Math.PI * 2),
    s: rnd(0.35, 1),
    r: Math.random(),
    q: Math.random(),
  }));
  fx = { key, x: x * K, y: y * K + (top ? 8 : -8), dir: top ? 1 : -1, t0: clock.now, bits };
}
export function clearGoalFx() {
  fx = null;
}
/** Draws the running effect in world pixels (call with the camera transform applied). */
export function drawGoalFx() {
  if (!fx) return;
  const t = clock.now - fx.t0;
  if (t < 0 || t > LEN) {
    if (t > LEN) fx = null;
    return;
  }
  const g = view.ctx;
  g.save();
  FX[fx.key](g, t, fx);
  g.restore();
  g.globalAlpha = 1;
}

const easeOut = k => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
const fade = t => Math.max(0, 1 - t / LEN);
const sq = (x, y, s, c) => R(Math.round(x - s / 2), Math.round(y - s / 2), s, s, c);

/** Mirror ball bursts: rotating coloured light beams sweep out, shards of mirror fly away and sparkle. */
function disco(g, t, f) {
  const L = 110 * easeOut(t / 0.3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 1.6,
      w = 0.11;
    g.globalAlpha = 0.5 * fade(t);
    g.fillStyle = `hsl(${(i * 30 + t * 220) % 360},95%,55%)`;
    g.beginPath();
    g.moveTo(f.x, f.y);
    g.lineTo(f.x + Math.cos(a - w) * L, f.y + Math.sin(a - w) * L);
    g.lineTo(f.x + Math.cos(a + w) * L, f.y + Math.sin(a + w) * L);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = fade(t);
  for (const b of f.bits.slice(0, 30)) {
    const d = 70 * b.s * easeOut(t / 0.8);
    sq(
      f.x + Math.cos(b.a) * d,
      f.y + Math.sin(b.a) * d,
      2,
      Math.floor((t + b.r) * 12) % 2 ? '#5a6378' : '#c9d4e2',
    );
  }
  // the ball itself, glittering, until it shatters
  if (t < 0.35) {
    disc(Math.round(f.x), Math.round(f.y), 6, 5, '#aab6c4');
    for (let i = 0; i < 8; i++) sq(f.x + rnd(-5, 5), f.y + rnd(-4, 4), 1, '#ffffff');
  }
}

/** A fireball: a pixel explosion with a bright core, flames flying out and rising, then smoke. */
function fire(g, t, f) {
  const k = t / 0.5,
    r = k < 1 ? 6 + 30 * easeOut(k) : 36 * Math.max(0, 1 - (t - 0.5) / 0.7);
  if (r > 1) {
    g.globalAlpha = 0.9;
    disc(Math.round(f.x), Math.round(f.y), Math.round(r), Math.round(r * 0.8), '#c4161c');
    disc(Math.round(f.x), Math.round(f.y), Math.round(r * 0.78), Math.round(r * 0.62), '#ff4d2e');
    disc(Math.round(f.x), Math.round(f.y), Math.round(r * 0.55), Math.round(r * 0.44), '#ff9b2f');
    disc(Math.round(f.x), Math.round(f.y), Math.round(r * 0.3), Math.round(r * 0.24), '#ffde59');
  }
  for (const b of f.bits) {
    const life = 0.5 + b.r * 1.2;
    if (t > life) continue;
    const d = 60 * b.s * easeOut(t / 0.6),
      x = f.x + Math.cos(b.a) * d,
      y = f.y + Math.sin(b.a) * d * 0.7 - t * t * 30,
      p = t / life;
    g.globalAlpha = 1 - p;
    sq(
      x,
      y,
      p < 0.3 ? 4 : p < 0.6 ? 3 : 2,
      p < 0.25 ? '#ffde59' : p < 0.5 ? '#ff9b2f' : p < 0.75 ? '#ff4d2e' : '#c4161c',
    );
  }
  // smoke puffs drifting up after the blast
  if (t > 0.5) {
    for (const b of f.bits.slice(0, 10)) {
      const s = t - 0.5;
      g.globalAlpha = Math.max(0, 0.35 - s * 0.2);
      disc(
        Math.round(f.x + Math.cos(b.a) * 16 * b.s),
        Math.round(f.y - 6 - s * 24 * b.s),
        Math.round(4 + s * 6),
        Math.round(3 + s * 5),
        '#5a6170',
      );
    }
  }
}

/** Rings of rainbow colour ripple out, with star confetti. */
function rainbow(g, t, f) {
  const cols = ['#ff3b3b', '#ff9b2f', '#ffde59', '#4fd38a', '#3d7bff', '#9b5cff'];
  g.lineWidth = 3;
  for (let i = 0; i < cols.length; i++) {
    const r = easeOut(t / 1.2) * 80 - i * 5;
    if (r <= 0) continue;
    g.globalAlpha = 0.8 * fade(t);
    g.strokeStyle = cols[i];
    g.beginPath();
    g.ellipse(f.x, f.y, r, r * 0.7, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = fade(t);
  for (const b of f.bits.slice(0, 36)) {
    const d = 75 * b.s * easeOut(t / 0.9),
      x = f.x + Math.cos(b.a) * d,
      y = f.y + Math.sin(b.a) * d * 0.75 + t * 12;
    const c = cols[Math.floor(b.r * cols.length)];
    sq(x, y, 3, c);
    if (b.q > 0.5) {
      sq(x - 2, y, 1, c);
      sq(x + 2, y, 1, c);
    }
  }
}

/** Crackling lightning bolts shoot out of the net with an electric shockwave. */
function plasma(g, t, f) {
  const r = easeOut(t / 0.7) * 90;
  g.globalAlpha = 0.7 * fade(t);
  g.strokeStyle = '#00b4e6';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(f.x, f.y, r, r * 0.7, 0, 0, Math.PI * 2);
  g.stroke();
  const seed = Math.floor(t * 14); // bolts re-strike 14 times a second
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * Math.PI * 2 + seed * 0.7,
      x = f.x,
      y = f.y;
    g.globalAlpha = (0.9 - t / LEN) * (seed % 2 ? 1 : 0.6);
    g.strokeStyle = i % 2 ? '#7b2cff' : '#0096d6';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      a += Math.sin(seed * 3.1 + i * 7.7 + s * 2.3) * 0.6;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9 * 0.75;
      g.lineTo(Math.round(x), Math.round(y));
    }
    g.stroke();
  }
  if (t < 0.25) {
    g.globalAlpha = 1 - t / 0.25;
    disc(Math.round(f.x), Math.round(f.y), 14, 10, '#7fe3ff');
  }
}

/** Little ghosts float up out of the net in a purple mist. */
function ghost(g, t, f) {
  g.globalAlpha = 0.25 * fade(t);
  disc(Math.round(f.x), Math.round(f.y), Math.round(20 + t * 25), Math.round(14 + t * 16), '#9b5cff');
  for (let i = 0; i < 5; i++) {
    const b = f.bits[i],
      s = t - i * 0.12;
    if (s < 0) continue;
    const x = f.x + (i - 2) * 14 + Math.sin(s * 5 + i) * 5,
      y = f.y - s * 38 * (0.7 + b.s * 0.5);
    g.globalAlpha = Math.min(1, s * 4) * fade(t);
    // a ghost: round head, wavy hem, two eyes, with a dark outline so it shows on white ice
    const gx = Math.round(x),
      gy = Math.round(y),
      w = Math.floor(s * 8) % 2,
      body = (ox, oy, c) => {
        R(gx - 4 + ox, gy - 6 + oy, 8, 8, c);
        R(gx - 3 + ox, gy - 7 + oy, 6, 1, c);
        for (let k = 0; k < 4; k++) R(gx - 4 + k * 2 + ox, gy + 2 + oy, 2, (k + w) % 2 ? 2 : 1, c);
      };
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      body(ox, oy, '#3b2463');
    body(0, 0, '#f4f0ff');
    R(gx - 2, gy - 4, 1, 2, '#1b2030');
    R(gx + 1, gy - 4, 1, 2, '#1b2030');
  }
  if (t > 0.3 && t < 1.6) {
    g.globalAlpha = fade(t);
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.fillStyle = '#1b2030';
    g.fillText('BOO!', Math.round(f.x) + 1, Math.round(f.y - 34 - t * 10) + 1);
    g.fillStyle = '#c38bff';
    g.fillText('BOO!', Math.round(f.x), Math.round(f.y - 34 - t * 10));
    g.textAlign = 'left';
  }
}

/** A spiral of stars swirls out of a dark centre. */
function galaxy(g, t, f) {
  // a dark nebula grows so the stars show up on white ice
  const neb = easeOut(t / 1.2);
  g.globalAlpha = 0.55 * fade(t);
  disc(Math.round(f.x), Math.round(f.y), Math.round(12 + neb * 60), Math.round(9 + neb * 42), '#2a1650');
  g.globalAlpha = 0.7 * fade(t);
  disc(Math.round(f.x), Math.round(f.y), Math.round(6 + neb * 14), Math.round(5 + neb * 10), '#0b0718');
  for (let i = 0; i < f.bits.length; i++) {
    const b = f.bits[i],
      arm = i % 3,
      d = (6 + b.s * 70) * easeOut(t / 1.4),
      a = (arm / 3) * Math.PI * 2 + d * 0.06 + t * 2.4;
    g.globalAlpha = fade(t) * (0.5 + b.q * 0.5);
    sq(
      f.x + Math.cos(a) * d,
      f.y + Math.sin(a) * d * 0.7,
      b.r > 0.85 ? 3 : 2,
      b.r > 0.7 ? '#ffffff' : b.r > 0.35 ? '#c38bff' : '#7aa6ff',
    );
  }
}
