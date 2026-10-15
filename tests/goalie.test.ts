import { beforeAll, describe, expect, it } from 'vitest';
import { GT, STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { clock } from '../src/core/time';
import { DIFF } from '../src/data/difficulty';
import { WIND, wobbleOf } from '../src/game/human';
import { startGame } from '../src/game/match';
import { GK, SK } from '../src/game/players';
import { shoot, take } from '../src/game/puck';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { settings } from '../src/settings';

const step = () => {
  clock.now += STEP;
  update(STEP);
};
let a: any, gk: any;
/** Team 0's skater a, alone with the CPU goalie, skates from x0 at speed vx (px/s) for t seconds, d px out from
 * the goal line, then shoots at x tx. Returns 'goal' or 'save' (anything else is reported as it is). */
function play(x0: number, vx: number, t: number, d: number, tx: number, spd: number) {
  for (const s of [0, 1])
    for (const p of SK[s] as any[]) if (p !== a) Object.assign(p, { benched: true, x: -500, y: -500 });
  GK[0].benched = true;
  Object.assign(gk, { x: 80, y: GT + 4, vx: 0, vy: 0, cool: 0, benched: false });
  let x = x0;
  for (let i = 0; i < Math.round(t / STEP); i++) {
    x += vx * STEP;
    Object.assign(a, {
      benched: false,
      x,
      y: GT + d,
      vx,
      vy: 0,
      fx: 0,
      fy: -1,
      cool: 0,
      down: 0,
      stun: 0,
      imm: 9,
    });
    G.controlled = a;
    G.state = 'play';
    if (puck.owner !== a) take(a);
    step();
  }
  const s0 = G.score[0];
  shoot(a, tx, GT - 2, spd, 0);
  for (let i = 0; i < 120 && G.state === 'play'; i++) {
    step();
    if (puck.owner === gk || puck.lastTeam === 1) break;
  }
  const res = G.score[0] > s0 ? 'goal' : puck.lastTeam === 1 ? 'save' : 'other';
  G.score[0] = s0;
  return res;
}

// Saves are not a dice roll: the goalie stops what passes within his reach, and whether he gets there in time
// is played out (his reaction time, then his push across). The same shot from the same play ends the same way.
describe('goalie saves', () => {
  beforeAll(() => {
    clearEvents();
    Object.assign(settings, {
      periodLen: 6000,
      fightsOn: false,
      zamOn: false,
      diffKey: 'pro',
      diff: DIFF.pro,
    });
    startGame(false);
    for (let i = 0; i < 400 && G.state !== 'play'; i++) step();
    a = SK[0][0];
    gk = GK[1];
    gk.st.glove = 1;
  });
  const results = (f: () => string) => new Set(Array.from({ length: 8 }, f));

  it('stops a shot straight at him, every time', () => {
    expect(results(() => play(80, 0, 1.5, 40, 80, 285))).toEqual(new Set(['save']));
  });
  it('stops a slow shot from far out, every time', () => {
    expect(results(() => play(40, 0, 1.5, 90, 89.5, 150))).toEqual(new Set(['save']));
  });
  it('is beaten by a hard shot back against a cut across the slot, every time', () => {
    expect(results(() => play(50, 55, 0.6, 30, 70.5, 220))).toEqual(new Set(['goal']));
  });
  it('stops the same shot sent on toward the side he is moving to', () => {
    expect(results(() => play(50, 55, 0.6, 30, 89.5, 285))).toEqual(new Set(['save']));
  });
});

describe('shot accuracy', () => {
  it('only starts to wobble when a full wind-up is held too long', () => {
    expect(wobbleOf(0.3)).toBe(0);
    expect(wobbleOf(WIND)).toBe(0);
    expect(wobbleOf(WIND + 0.25)).toBe(0);
    expect(wobbleOf(WIND + 0.55)).toBeGreaterThan(0);
    expect(wobbleOf(5)).toBe(1);
  });
});
