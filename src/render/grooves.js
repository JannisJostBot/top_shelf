// Blade grooves for the replay. They are rebuilt every frame straight from the replay recording (REC), so they
// need no extra game state and restart cleanly whenever the replay switches camera angle.
//
// Each skate only cuts while it pushes: one foot carves a curved stroke outward, lifts, and the other foot takes
// over, which leaves the alternating S-shaped marks of real skating. Goalies leave shorter shuffle marks in their
// crease. Older grooves fade, and each is drawn as a dark cut edge with a bright line beside it so it catches
// the light on the glossy replay ice.
import { H, K, W } from '../config';
import { REC, PF, G } from '../game/world';
import { players } from '../game/players';
import { view } from './canvas';

const HISTORY = 360, // frames of grooves kept before the current replay frame (6 s at 60 fps)
  BUCKETS = 6, // age buckets, each stroked at its own opacity
  MIN_SPEED = 12; // below this a blade glides without leaving a visible cut

export function skateGrooves() {
  const rp = G.rp;
  if (!rp || REC.length < 2) return;
  const cur = Math.min(REC.length - 1, Math.floor(rp.i)),
    from = Math.max(0, cur - HISTORY),
    flip = rp.angle.flip,
    cut = [],
    shine = [];
  for (let b = 0; b < BUCKETS; b++) {
    cut.push(new Path2D());
    shine.push(new Path2D());
  }
  players.forEach((p, k) => {
    if (p.benched) return;
    const o = k * PF,
      goalie = p.role === 'G';
    for (const side of [-1, 1]) {
      let drawing = false,
        bucket = -1,
        lx = 0,
        ly = 0;
      for (let f = from; f <= cur; f++) {
        const fr = REC[f],
          vx = fr[o + 4],
          vy = fr[o + 5],
          sp = Math.hypot(vx, vy),
          anim = fr[o + 6],
          // one stride cycle is two animation steps; this foot pushes during its half of the cycle
          phase = anim - 2 * Math.floor(anim / 2),
          pushing = side < 0 ? phase < 1 : phase >= 1;
        if (sp < MIN_SPEED || fr[o + 7] > 0 || !pushing) {
          drawing = false;
          continue;
        }
        const dx = vx / sp,
          dy = vy / sp,
          frac = phase % 1,
          // the blade starts under the body and sweeps outward through the push
          off = goalie ? side * 2.2 : side * (1 + 1.8 * Math.sin(frac * Math.PI * 0.85)),
          wx = fr[o] - dy * off,
          wy = fr[o + 1] + dx * off;
        let x = wx * K,
          y = wy * K;
        if (flip) {
          x = (W - wx) * K;
          y = (H - wy) * K;
        }
        const b = Math.min(BUCKETS - 1, Math.floor(((cur - f) / (HISTORY + 1)) * BUCKETS));
        if (!drawing || b !== bucket) {
          // start a new run (or continue into the next age bucket from the same point)
          const sx = drawing ? lx : x,
            sy = drawing ? ly : y;
          cut[b].moveTo(sx, sy);
          shine[b].moveTo(sx + 0.8, sy + 0.8);
          bucket = b;
          drawing = true;
        }
        cut[b].lineTo(x, y);
        shine[b].lineTo(x + 0.8, y + 0.8);
        lx = x;
        ly = y;
      }
    }
  });
  const g = view.ctx;
  g.save();
  g.lineWidth = 0.9;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let b = 0; b < BUCKETS; b++) {
    const a = 1 - b / BUCKETS;
    g.globalAlpha = 0.6 * a;
    g.strokeStyle = '#7f95ad';
    g.stroke(cut[b]);
    g.globalAlpha = 0.7 * a;
    g.strokeStyle = '#ffffff';
    g.stroke(shine[b]);
  }
  g.restore();
}
