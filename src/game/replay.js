import { H, NETS, W } from '../config';
import { lerp, pick, rnd } from '../core/math';
import { clock } from '../core/time';
import { endGame } from './match';
import { SKATERS, players } from './players';
import { startBrawl } from './states/brawl';
import { faceoff } from './states/faceoff';
import { G, PF, REC, REC_MAX, parts, puck, ref } from './world';
import { input } from '../input/state';
import { settings } from '../settings';
import {
  S,
  clearFx,
  clearGoalFx,
  goalLamp,
  hideBanner,
  netHit,
  pop,
  resetCloth,
  startGoalFx,
  uiShow,
  upd3D,
  updCam,
  zoom,
} from './fx';
import { net } from './online';

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
  { name: 'FAN CAM 3D', z: 1, spd: 0.5, mode7: 'guest' },
];
let angleIdx = -1,
  replayN = 0;
/** The camera angle the replay is filmed from (online, the guest is told so both see the same shot). */
export const replayAngle = () => angleIdx;
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
/** Starts the goal replay; `angle` picks the camera angle (online, the guest films it like the host). */
export function startReplay(angle) {
  if (REC.length < 40) {
    if (G.net !== 'guest') afterGoal();
    return;
  }
  angleIdx =
    angle >= 0 && angle < ANGLES.length ? angle : (angleIdx + 1 + Math.floor(rnd(0, 2))) % ANGLES.length;
  const i0 = Math.max(0, REC.length - 1 - 190);
  G.state = 'replay';
  G.rp = { i0, i: i0, end: REC.length - 1, angle: ANGLES[angleIdx], n: ++replayN, votes: null };
  if (fightVoteOpen()) G.rp.votes = [false, false];
  parts.length = 0;
  clearFx();
  hideBanner();
  uiShow('rpBar', true);
  G.rp.fart = Math.random() < 0.03 ? rnd(0.25, 0.7) : null;
  uiShow('pcard', false);
  input.sp = input.pp = input.swp = input.sr = false;
  beginAngle();
}
/** One step of the replay. */
export function replayStep(dt) {
  G.rp.i += G.rp.angle.spd;
  if (G.rp.i >= G.rp.end) {
    // online, the guest holds the last frame until the host says the replay is over
    if (G.net !== 'guest') {
      endReplay();
      return;
    }
    G.rp.i = G.rp.end;
  }
  if (G.rp.fart !== null && (G.rp.i - G.rp.i0) / Math.max(1, G.rp.end - G.rp.i0) >= G.rp.fart) {
    G.rp.fart = null;
    S('fart');
    const v = pick(SKATERS);
    pop(v.x, v.y, 'PFFRRT', '#a07a3a');
  }
  if (!G.rp.netHit && G.lastNet && G.rp.i >= G.goalFrame) {
    G.rp.netHit = true;
    const fl = G.rp.angle.flip,
      tn = fl ? NETS[G.lastNet === NETS[0] ? 1 : 0] : G.lastNet;
    netHit(tn, fl ? W - G.goalX : G.goalX, 1.5);
    startGoalFx(settings.puckKey, fl ? W - G.goalX : G.goalX, tn.top ? tn.y0 + 3 : tn.y1 - 3, tn.top);
    goalLamp({ n: tn, until: clock.now + 2.6 });
  }
  applyFrame(G.rp.i);
  updCam(dt, false);
  upd3D(false);
  for (const p of SKATERS) {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 46 && p.down <= 0 && Math.random() < 0.3)
      parts.push({
        x: p.x + rnd(-2, 2),
        y: p.y + rnd(0, 1),
        vx: -p.vx * 0.25 + rnd(-12, 12),
        vy: -p.vy * 0.25 + rnd(-12, 12),
        life: rnd(0.25, 0.5),
        c: '#ffffff',
      });
  }
}
export function beginAngle() {
  G.rp.netHit = false;
  if (G.rp.fart === undefined) G.rp.fart = null;
  resetCloth();
  clearGoalFx();
  goalLamp(null);
  G.rp.i = G.rp.i0;
  zoom(G.rp.angle.z);
  applyFrame(G.rp.i);
  updCam(0, true);
  upd3D(true);
}
export function nextAngle() {
  // online, the guest asks the host, whose match it is
  if (G.net === 'guest') {
    if (net.send) net.send({ t: 'angle' });
    return;
  }
  if (G.state !== 'replay') return;
  angleIdx = (angleIdx + 1) % ANGLES.length;
  G.rp.angle = ANGLES[angleIdx];
  beginAngle();
  if (G.net === 'host') net.stateDirty = true; // the guest switches to the same angle
}
export function endReplay() {
  // online, the guest asks the host, whose match it is
  if (G.net === 'guest') {
    if (net.send) net.send({ t: 'skip' });
    return;
  }
  if (G.state !== 'replay') return;
  zoom(1);
  uiShow('rpBar', false);
  // a reverse angle left everyone mirrored: put them back where the goal left them (after an overtime winner the
  // teams celebrate from there, see states/post.js)
  if (G.rp.angle.flip) {
    G.rp.angle = ANGLES[0];
    applyFrame(REC.length - 1);
  }
  afterGoal();
}
/* ---------- the fight vote (online) ----------
   Online there are no random fights: during each replay both players may vote to drop the gloves, and when both
   want it the fight starts at once. Once a match had its fight the vote is not offered again. */
const fightVoteOpen = () =>
  G.net === 'host' && settings.fightsOn && !G.fought && !G.practice && G.period <= 3;
/** Host: team t's player wants the fight (on) or takes it back. */
export function voteFight(t, on) {
  if (G.state !== 'replay' || !G.rp || !G.rp.votes || G.fought) return;
  G.rp.votes[t] = !!on;
  if (G.rp.votes[0] && G.rp.votes[1]) fightNow();
}
function fightNow() {
  // everyone back where the goal left them (the replay moved them around, maybe from the other end)
  G.rp = null;
  applyFrame(REC.length - 1);
  zoom(1);
  uiShow('rpBar', false);
  clearGoalFx();
  goalLamp(null);
  resetCloth();
  startBrawl(true);
}
export function afterGoal() {
  if (G.period > 3) endGame();
  else faceoff();
}
