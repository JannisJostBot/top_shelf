// Fans light hand-held flares in the stands near the end of a game: the last seconds of the third period,
// overtime and the final result. They stay in the stands: nothing is thrown, the drawing is clipped to the area
// outside the boards, and the smoke drifts away from the rink (in 3D it rises).
import { H, K, W } from '../config';
import { clock } from '../core/time';
import { G } from '../game/world';
import { view } from './canvas';
import { R } from './pixels';

// flare spots in the stands (world units) with the direction their smoke drifts
const SPOTS = [
  ...[40, 88, 136, 184, 226].map((y, i) => ({ x: i % 2 ? -12.5 : -8, y, ox: -1, oy: 0 })),
  ...[62, 110, 158, 206].map((y, i) => ({ x: W + (i % 2 ? 8 : 12.5), y, ox: 1, oy: 0 })),
  { x: 46, y: -8, ox: 0, oy: -1 },
  { x: 116, y: H + 8, ox: 0, oy: 1 },
];
const END_SECONDS = 20;

export function pyroActive() {
  if (G.demo || G.practice) return false;
  return (G.period === 3 && G.clock < END_SECONDS) || G.period > 3 || G.state === 'over';
}
const flicker = (i, f) =>
  0.75 + 0.25 * Math.sin(clock.now * f + i * 1.7) * Math.sin(clock.now * f * 0.37 + i);

/** Top-down: drawn with the camera transform applied, right after the stands. */
export function drawPyro() {
  if (!pyroActive()) return;
  const g = view.ctx;
  g.save();
  // only ever outside the rink
  g.beginPath();
  g.rect(-40 * K, -40 * K, (W + 80) * K, (H + 80) * K);
  g.rect(0, 0, W * K, H * K);
  g.clip('evenodd');
  SPOTS.forEach((s, i) => {
    const x = s.x * K,
      y = s.y * K,
      a = flicker(i, 17);
    // red light on the crowd around the flare
    const gr = g.createRadialGradient(x, y, 0, x, y, 30);
    gr.addColorStop(0, `rgba(255,90,40,${0.5 * a})`);
    gr.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = gr;
    g.fillRect(x - 30, y - 30, 60, 60);
    // smoke drifting out of the arena, away from the ice
    for (let k = 0; k < 8; k++) {
      const age = (clock.now * 0.5 + k / 8 + i * 0.13) % 1,
        d = age * 34,
        wob = Math.sin(age * 6 + k) * 4,
        sx = x + s.ox * d + s.oy * wob,
        sy = y + s.oy * d + s.ox * wob,
        r = Math.round(2 + age * 6);
      g.globalAlpha = (1 - age) * 0.4;
      R(Math.round(sx - r), Math.round(sy - r), r * 2, r * 2, '#8a8f9c');
    }
    // the flare itself
    g.globalAlpha = 1;
    R(Math.round(x) - 2, Math.round(y) - 2, 4, 4, '#ff5a2f');
    R(Math.round(x) - 1, Math.round(y) - 1, 2, 2, a > 0.8 ? '#fffbe0' : '#ffd36a');
  });
  g.restore();
  g.globalAlpha = 1;
}

/** 3D shots: glow and rising smoke at each flare, using the renderer's projection. */
export function drawPyro3D(proj) {
  if (!pyroActive()) return;
  const g = view.ctx;
  SPOTS.forEach((s, i) => {
    const q = proj(s.x, s.y, 7);
    if (!q || q.s < 0.3) return;
    const a = flicker(i, 17),
      r = Math.max(6, q.s * 10);
    g.globalAlpha = 0.45 * a;
    g.fillStyle = '#ff5a2f';
    g.beginPath();
    g.arc(q.x, q.y, r, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 6; k++) {
      const age = (clock.now * 0.5 + k / 6 + i * 0.13) % 1,
        p = proj(s.x + s.ox * age * 6, s.y + s.oy * age * 6, 7 + age * 14);
      if (!p) continue;
      g.globalAlpha = (1 - age) * 0.35;
      g.fillStyle = '#8a8f9c';
      const pr = Math.max(3, p.s * (1.5 + age * 4));
      g.fillRect(p.x - pr, p.y - pr, pr * 2, pr * 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = a > 0.8 ? '#fffbe0' : '#ffb347';
    const fr = Math.max(2, q.s * 1.1);
    g.fillRect(q.x - fr, q.y - fr, fr * 2, fr * 2);
  });
  g.globalAlpha = 1;
}
