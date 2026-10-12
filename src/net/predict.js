// The guest's own skater, predicted. The guest plays the host's match back a tenth of a second behind, plus the
// trip there and back, which is far too slow for the skater it steers. So that one skater skates on this screen
// at once, by the same rule as on the host (game/human.js skate()), and is pulled gently toward where the host
// has it: each input step is numbered, the host's frames say which step they include, and the difference to
// where this screen had the skater after that step is worked off a little every step. A big difference (a
// check, a pile-up) is taken at once. Everything else on the ice stays the host's.
import { skate, stickOf } from '../game/human';
import { netPushBody, rinkPush } from '../game/physics/rink';
import { G, puck } from '../game/world';
import { input, readStick } from '../input/state';

const HIST = 128, // input steps remembered (about two seconds)
  BLEND = 0.12, // share of the difference to the host worked off each step
  SNAP = 24, // a difference larger than this (world units) is taken at once
  RELEASE = 0.8; // share of the lead kept each step while the host's skater is shown again

const pr = {
  /** the predicted skater (null: none) */
  p: null,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  fx: 0,
  fy: 1,
  /** where this screen had the skater after each input step: [n, x, y, vx, vy] by n % HIST */
  hist: /** @type {(number[] | null)[]} */ (new Array(HIST).fill(null)),
  /** predicting (false: start again from where the skater is shown) */
  on: false,
  /** how far the shown skater is ahead of the host's while easing back to it */
  ox: 0,
  oy: 0,
};

/** Forgets the prediction (a new match, a state the guest does not steer in). */
export function resetPrediction() {
  pr.p = null;
  pr.on = false;
  pr.ox = pr.oy = 0;
  pr.hist.fill(null);
}

/**
 * After the host's snapshot is on the ice: moves the guest's skater by this screen's stick for input step n,
 * corrected toward the host's after step ack (null: the host has not said). mode: 'steer' (the host takes the
 * stick), 'ease' (the host's skater is shown again, the lead easing out) or 'snap' (shown at once: a reset).
 */
export function predict(dt, n, ack, mode) {
  const p = G.controlled;
  if (!p || p.benched || mode === 'snap') return resetPrediction();
  const ax = p.x,
    ay = p.y,
    same = p === pr.p;
  if (mode === 'ease' || p.down > 0 || p.checkT > 0) {
    // (a check or a fall on the host: its skater, with the lead this screen made easing out)
    if (same && Math.hypot(pr.ox, pr.oy) < SNAP) {
      pr.ox *= RELEASE;
      pr.oy *= RELEASE;
      shift(p, pr.ox, pr.oy);
    } else pr.ox = pr.oy = 0;
    pr.p = p;
    pr.on = false;
    pr.hist.fill(null);
    return;
  }
  if (!same || !pr.on) {
    // from where the skater is shown now
    if (!same) pr.ox = pr.oy = 0;
    pr.p = p;
    pr.on = true;
    pr.hist.fill(null);
    pr.x = p.x + pr.ox;
    pr.y = p.y + pr.oy;
    pr.vx = p.vx;
    pr.vy = p.vy;
    pr.fx = p.fx;
    pr.fy = p.fy;
  }
  // worked off: the difference between the host's skater after step ack and this screen's after that step
  const h = ack === null ? null : pr.hist[ack % HIST];
  if (h && h[0] === ack) {
    const ex = p.x - h[1],
      ey = p.y - h[2],
      k = Math.hypot(ex, ey) > SNAP ? 1 : BLEND,
      evx = (p.vx - h[3]) * k,
      evy = (p.vy - h[4]) * k;
    pr.x += ex * k;
    pr.y += ey * k;
    pr.vx += evx;
    pr.vy += evy;
    // (so the same difference is not worked off twice)
    for (const e of pr.hist)
      if (e && e[0] >= ack) {
        e[1] += ex * k;
        e[2] += ey * k;
        e[3] += evx;
        e[4] += evy;
      }
  }
  // the step itself, on the skater (the host's values are put back on the snapshot's next blend anyway)
  p.x = pr.x;
  p.y = pr.y;
  p.vx = pr.vx;
  p.vy = pr.vy;
  p.fx = pr.fx;
  p.fy = pr.fy;
  // (the guest's screen keeps no boost of its own: the host's lunges come in as differences)
  p.boost = 0;
  readStick();
  const s = stickOf(p, input);
  skate(p, s.jx, s.jy, input.aim, s.receiving, dt);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  rinkPush(p, 3.5, 0.3);
  netPushBody(p, 3.5);
  rinkPush(p, 3.5, 0);
  pr.x = p.x;
  pr.y = p.y;
  pr.vx = p.vx;
  pr.vy = p.vy;
  pr.fx = p.fx;
  pr.fy = p.fy;
  pr.hist[n % HIST] = [n, p.x, p.y, p.vx, p.vy];
  pr.ox = p.x - ax;
  pr.oy = p.y - ay;
  // a puck on this skater's stick goes along with it
  if (puck.owner === p) {
    puck.x += pr.ox;
    puck.y += pr.oy;
  }
}
/** Shows the skater (and a puck on its stick) moved by dx, dy from the host's place. */
function shift(p, dx, dy) {
  p.x += dx;
  p.y += dy;
  if (puck.owner === p) {
    puck.x += dx;
    puck.y += dy;
  }
}
