import { H, W } from '../config';
import { $ } from '../core/dom';
import { lerp, rnd } from '../core/math';
import { endGame } from './match';
import { players } from './players';
import { faceoff } from './states/faceoff';
import { G, PF, REC, REC_MAX, parts, puck, ref } from './world';
import { input } from '../input/state';
import { updCam } from '../render/camera';
import { view } from '../render/canvas';
import { bubbles, pops, rings } from '../render/effects';
import { upd3D } from '../render/mode7';
import { resetCloth } from '../render/net';
import { hideBanner } from '../ui/hud';

/* ---------- replay recorder ---------- */
export function recFrame() {
  const f = new Float32Array(players.length * PF + 10);
  let i = 0;
  for (const p of players) {
    f[i++] = p.x;
    f[i++] = p.y;
    f[i++] = p.fx;
    f[i++] = p.fy;
    f[i++] = p.vx;
    f[i++] = p.vy;
    f[i++] = p.anim;
    f[i++] = Math.max(0, p.down);
    f[i++] = Math.max(0, p.stun);
    f[i++] = p.fallDir;
  }
  f[i++] = puck.x;
  f[i++] = puck.y;
  f[i++] = puck.z;
  f[i++] = puck.owner ? players.indexOf(puck.owner) : -1;
  f[i++] = Math.hypot(puck.vx, puck.vy);
  f[i++] = ref.x;
  f[i++] = ref.y;
  f[i++] = ref.fx;
  f[i++] = ref.fy;
  f[i++] = ref.anim;
  REC.push(f);
  if (REC.length > REC_MAX) {
    REC.shift();
    G.goalFrame--;
  }
}
export const ANGLES = [
  { name: 'BROADCAST', z: 1, spd: 0.55 },
  { name: 'REVERSE ANGLE', z: 1, spd: 0.55, flip: true },
  { name: 'GOAL CAM', z: 2, spd: 0.5, goal: true },
  { name: 'TIGHT ZOOM', z: 2, spd: 0.38 },
  { name: 'PUCK CAM', z: 3, spd: 0.42, puck: true },
  { name: 'CHASE CAM 3D', z: 1, spd: 0.5, mode7: 'chase' },
  { name: 'NET CAM 3D', z: 1, spd: 0.5, mode7: 'net' },
];
let angleIdx = -1;
export function applyFrame(fi) {
  const i0 = Math.floor(fi),
    a = REC[i0],
    b = REC[Math.min(REC.length - 1, i0 + 1)],
    t = fi - i0;
  players.forEach((p, k) => {
    const o = k * PF;
    p.x = lerp(a[o], b[o], t);
    p.y = lerp(a[o + 1], b[o + 1], t);
    p.fx = a[o + 2];
    p.fy = a[o + 3];
    p.vx = a[o + 4];
    p.vy = a[o + 5];
    p.anim = lerp(a[o + 6], b[o + 6], t);
    p.down = a[o + 7];
    p.stun = a[o + 8];
    p.fallDir = a[o + 9];
  });
  const o = players.length * PF;
  ref.x = lerp(a[o + 5], b[o + 5], t);
  ref.y = lerp(a[o + 6], b[o + 6], t);
  ref.fx = a[o + 7];
  ref.fy = a[o + 8];
  ref.anim = lerp(a[o + 9], b[o + 9], t);
  ref.vx = (b[o + 5] - a[o + 5]) * 60;
  ref.vy = (b[o + 6] - a[o + 6]) * 60;
  puck.x = lerp(a[o], b[o], t);
  puck.y = lerp(a[o + 1], b[o + 1], t);
  puck.z = a[o + 2];
  puck.owner = a[o + 3] >= 0 ? players[a[o + 3]] : null;
  puck.trail.length = 0;
  if (a[o + 4] > 110 && !puck.owner)
    for (let j = 8; j >= 1; j--) {
      const f = REC[Math.max(0, i0 - j)];
      puck.trail.push({ x: f[o], y: f[o + 1] });
    }
  // reverse angle: view the play from the other end of the rink
  if (G.rp && G.rp.angle.flip) {
    for (const p of players) {
      p.x = W - p.x;
      p.y = H - p.y;
      p.fx = -p.fx;
      p.fy = -p.fy;
      p.vx = -p.vx;
      p.vy = -p.vy;
      p.fallDir = -p.fallDir;
    }
    puck.x = W - puck.x;
    puck.y = H - puck.y;
    for (const t of puck.trail) {
      t.x = W - t.x;
      t.y = H - t.y;
    }
    ref.x = W - ref.x;
    ref.y = H - ref.y;
    ref.fx = -ref.fx;
    ref.fy = -ref.fy;
    ref.vx = -ref.vx;
    ref.vy = -ref.vy;
  }
}
export function startReplay() {
  if (REC.length < 40) {
    afterGoal();
    return;
  }
  angleIdx = (angleIdx + 1 + Math.floor(rnd(0, 2))) % ANGLES.length;
  const i0 = Math.max(0, REC.length - 1 - 190);
  G.state = 'replay';
  G.rp = { i0, i: i0, end: REC.length - 1, angle: ANGLES[angleIdx] };
  parts.length = 0;
  pops.length = 0;
  rings.length = 0;
  bubbles.length = 0;
  hideBanner();
  $('rpBar').hidden = false;
  G.rp.fart = Math.random() < 0.03 ? rnd(0.25, 0.7) : null;
  $('pcard').hidden = true;
  input.sp = input.pp = input.swp = input.sr = false;
  beginAngle();
}
export function beginAngle() {
  G.rp.netHit = false;
  if (G.rp.fart === undefined) G.rp.fart = null;
  resetCloth();
  view.lamp = null;
  G.rp.i = G.rp.i0;
  view.camZ = G.rp.angle.z;
  applyFrame(G.rp.i);
  updCam(0, true);
  upd3D(true);
}
export function nextAngle() {
  if (G.state !== 'replay') return;
  angleIdx = (angleIdx + 1) % ANGLES.length;
  G.rp.angle = ANGLES[angleIdx];
  beginAngle();
}
export function endReplay() {
  if (G.state !== 'replay') return;
  view.camZ = 1;
  $('rpBar').hidden = true;
  afterGoal();
}
function afterGoal() {
  if (G.period > 3) endGame();
  else faceoff();
}
