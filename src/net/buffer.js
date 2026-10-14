// The guest's frame buffer: the host's frames in time order, waiting to be played back a little behind the newest.
// Frames come over two channels (net/session.js): the few with events or a change of state over the reliable one,
// numbered (r); the plain snapshots over the fast one, which can lose them or swap their order, each carrying the
// number of the last reliable frame sent before it. So a snapshot never overtakes the goal or the face-off it
// follows: it waits for that frame, or, if it does not come within HOLD, plays without it.
// How far behind it plays (lag) follows the connection: how unevenly the frames have been arriving lately.
// No browser or network in here (tests/online.test.ts).
import { clamp } from '../core/math';

export const LAG_MIN = 0.07, // two frames: one lost snapshot is blended over instead of stopping the picture
  LAG_MAX = 0.25,
  LAG_START = 0.1,
  HOLD = 0.3, // seconds a snapshot waits for a reliable frame before it plays without it
  FRAME = 1 / 30, // the host sends 30 frames a second
  WINDOW = 150; // arrivals the lag is worked out from (five seconds)

export function frameBuffer() {
  return {
    /** frames still to play, in time order */
    q: [],
    /** the frame played last (null: none yet) */
    last: null,
    /** the newest reliable frame's number that came in */
    rel: 0,
    /** the newest frame time received (null: none yet) */
    newest: null,
    /** how far behind the newest frame to play, in seconds */
    lag: LAG_START,
    /** recent arrival time minus frame time, for each frame */
    offs: [],
  };
}

/**
 * Takes a frame in (already checked). essential: it came over the reliable channel with events or a state.
 * Returns 'ok' (queued), 'late' (an essential frame older than what is already on screen: play its events and
 * state at once, its snapshot is old) or 'drop' (an old or repeated snapshot). now: the arrival time in seconds.
 */
export function addFrame(b, f, essential, now) {
  if (essential) b.rel = Math.max(b.rel, f.r);
  if (b.last && f.ts <= b.last.ts) return essential ? 'late' : 'drop';
  let i = b.q.length;
  while (i > 0 && b.q[i - 1].ts > f.ts) i--;
  if (!essential && i > 0 && b.q[i - 1].ts === f.ts) return 'drop';
  b.q.splice(i, 0, f);
  if (b.newest === null || f.ts > b.newest) b.newest = f.ts;
  // the lag: a frame of headroom plus the spread of the recent arrivals; up at once, down slowly
  b.offs.push(now - f.ts);
  if (b.offs.length > WINDOW) b.offs.shift();
  if (b.offs.length >= 10) {
    let lo = Infinity,
      hi = -Infinity;
    for (const o of b.offs) {
      if (o < lo) lo = o;
      if (o > hi) hi = o;
    }
    const target = clamp(FRAME + hi - lo + 0.01, LAG_MIN, LAG_MAX);
    b.lag = target > b.lag ? target : b.lag + (target - b.lag) * 0.02;
  }
  return 'ok';
}

/**
 * The next frame due at playback time t, taken off the queue; null when none is. early: it played without a
 * reliable frame that was sent before it (that frame is given up on; if it still comes it is 'late').
 */
export function nextFrame(b, t) {
  const f = b.q[0];
  if (!f || f.ts > t) return null;
  const early = f.r > b.rel;
  if (early && t - f.ts < HOLD) return null;
  b.q.shift();
  if (early) b.rel = f.r;
  b.last = f;
  return { f, early };
}

/** The playback clock: a little behind the newest frame, a touch faster or slower to stay there, and allowed to
 * run on a little past it (the picture then carries on along the last speeds, see net/snap.js). */
export function advance(b, t, dt) {
  if (b.newest === null) return t;
  if (t === null || b.newest - t > 0.6) return b.newest - b.lag;
  return Math.min(b.newest + 0.05, t + dt * clamp(1 + (b.newest - t - b.lag) * 1.5, 0.9, 1.1));
}
