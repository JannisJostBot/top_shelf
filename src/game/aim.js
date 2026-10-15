// Aim trainer (a practice mode): a board covers the far goal except for a small gap. Score through the gap as
// often as you can in a minute (or for as long as you like, in endless mode); after every goal the gap moves and
// you shoot from a new spot. With a moving gap it also slides back and forth along the board all the time.
// Misses come back to your stick after a moment.
import { NETS } from '../config';
import { rnd } from '../core/rng';
import { loadAimBest, saveAimBest } from '../core/storage';
import { banner, hudClock } from './fx';
import { practiceOver, practiceReset } from './practice';
import { G, puck } from './world';

/** Width of the gap in the board, in world units (the goal mouth is about 23 wide). */
export const AIM_GAP = 5;
/** Length of a round, in seconds. */
export const AIM_LEN = 60;
// how long a missed shot may roll around before the puck comes back to your stick
const LOOSE_MAX = 1.8;
// a moving gap sweeps the whole board and back in this many seconds
const SWEEP = 3.6;

const net = NETS[0];
// where the gap's centre can be, keeping the whole gap inside the goal mouth
const lo = net.x0 + 1.5 + AIM_GAP / 2,
  hi = net.x1 - 1.5 - AIM_GAP / 2;
/** A new gap position, well away from the last one. */
function newGap(prev) {
  let g;
  do g = rnd(lo, hi);
  while (prev !== undefined && Math.abs(g - prev) < AIM_GAP * 1.4);
  return g;
}
const newSpot = () => ({ x: rnd(45, 115), y: rnd(85, 140) });

export function startAim(cfg) {
  G.aim = {
    t: AIM_LEN,
    endless: !!cfg.endless,
    moving: !!cfg.moving,
    gap: newGap(),
    ph: rnd(0, Math.PI * 2), // where a moving gap is in its sweep
    spot: newSpot(),
    loose: 0,
    moved: false,
  };
  if (G.aim.moving) slide(0);
}
/** Slides a moving gap along the board, easing at both ends. */
function slide(dt) {
  const a = G.aim;
  a.ph += (dt * Math.PI * 2) / SWEEP;
  a.gap = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(a.ph));
}
/** A goal through the gap: the gap moves now, and the next reset puts you on a new spot. */
export function aimGoal() {
  const a = G.aim;
  if (a.moving) a.ph = rnd(0, Math.PI * 2); // jumps to a new point of its sweep
  else a.gap = newGap(a.gap);
  a.moved = true;
}
/** Called from practiceReset: a new shooting spot after a goal, the same spot after a miss. */
export function aimSpot() {
  if (G.aim.moved) {
    G.aim.spot = newSpot();
    G.aim.moved = false;
  }
  G.aim.loose = 0;
  return G.aim.spot;
}
export function aimBanner() {
  const a = G.aim;
  banner(
    'AIM TRAINER',
    'alert',
    (a.moving ? 'Hit the moving gap. ' : 'Shoot through the gap. ') +
      (a.endless ? 'No clock: quit from the pause menu.' : AIM_LEN + ' seconds.'),
  );
  G.bannerT = 2;
}

/** Runs the round's clock and returns misses to your stick; true when it ended the frame's update. */
export function aimTick(dt) {
  const a = G.aim;
  if (a.moving && G.state === 'play') slide(dt);
  if (!a.endless) {
    a.t -= dt;
    hudClock();
  }
  if (!a.endless && a.t <= 0) {
    a.t = 0;
    const goals = G.score[0],
      shots = G.score[1],
      best = loadAimBest(a.moving),
      pct = shots ? Math.round((goals / shots) * 100) : 0;
    if (goals > best) saveAimBest(goals, a.moving);
    G.aim = null;
    practiceOver(
      goals > best ? 'NEW BEST!' : "TIME'S UP",
      goals + (goals === 1 ? ' goal' : ' goals') + ' from ' + shots + ' shots (' + pct + '%) · Best: ' + Math.max(best, goals),
    );
    return true;
  }
  if (G.state === 'play') {
    a.loose = puck.owner ? 0 : a.loose + dt;
    if (a.loose > LOOSE_MAX) {
      practiceReset(false);
      return true;
    }
  }
  return false;
}
