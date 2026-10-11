import { describe, expect, it } from 'vitest';
import { NETS, RX0, RY0, STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { startZamboni, zamStep } from '../src/game/states/zamboni';
import { G } from '../src/game/world';
import { input, pad } from '../src/input/state';

// The resurfacer is steered into the left boards and the stick kept pushing into them: the boards should guide
// it along instead of pinning it in place.
describe('resurfacer at the boards', () => {
  it('slides along the boards when steered into them', () => {
    clearEvents();
    G.demo = false;
    startZamboni();
    const z = G.zam;
    // skip the 3, 2, 1
    while (z.phase === 'count') zamStep(STEP);
    z.x = RX0 + 14;
    z.y = 140;
    z.a = -Math.PI / 2 + 0.2; // facing the left boards, nose slightly up the rink
    z.v = 30;
    pad.x = -1; // stick hard left, straight into the boards
    pad.y = 0;
    const y0 = z.y;
    for (let i = 0; i < Math.round(2 / STEP); i++) zamStep(STEP);
    pad.x = pad.y = 0;
    input.sp = input.pp = false;
    expect(z.x).toBeGreaterThanOrEqual(RX0 + 5.9); // held off the boards
    expect(Math.abs(z.y - y0)).toBeGreaterThan(20); // but moving along them
    expect(z.v).toBeGreaterThan(10); // and not stalled
  });

  it('drives through behind a goal', () => {
    clearEvents();
    G.demo = false;
    startZamboni();
    const z = G.zam;
    while (z.phase === 'count') zamStep(STEP);
    // left of the top goal, in the gap between its back and the end boards, heading right
    z.x = 50;
    z.y = (RY0 + NETS[0].y0) / 2;
    z.a = Math.PI / 2;
    z.v = 30;
    pad.x = 1;
    pad.y = 0;
    for (let i = 0; i < Math.round(2 / STEP); i++) zamStep(STEP);
    pad.x = pad.y = 0;
    input.sp = input.pp = false;
    expect(z.x).toBeGreaterThan(NETS[0].x1 + 5); // came out on the other side
    expect(z.y).toBeLessThan(NETS[0].y0); // still behind the goal line
  });
});
