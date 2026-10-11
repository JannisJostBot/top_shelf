import { expect, it } from 'vitest';
import { STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { clock } from '../src/core/time';
import { DIFF } from '../src/data/difficulty';
import { startGame } from '../src/game/match';
import { GK, SK, SKATERS } from '../src/game/players';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { input, pad } from '../src/input/state';
import { settings } from '../src/settings';

const step = (n: number, each?: () => void) => {
  for (let i = 0; i < n; i++) {
    each?.();
    clock.now += STEP;
    update(STEP);
  }
};
// Receiving a pass: control jumps to the receiver while the stick is often still held the way the passer
// skated. The receiving assist should make those passes reliable, while steering across the pass line can still
// lose the puck (receiving takes a little skill).
it('passes are reliable to receive but can still be missed', () => {
  clearEvents();
  Object.assign(settings, { periodLen: 6000, fightsOn: false, zamOn: false, diffKey: 'pro', diff: DIFF.pro });
  startGame(false);
  step(200);
  const res: any = {};
  for (const hold of ['forward', 'sideways', 'none']) {
    let caught = 0,
      n = 0;
    for (let k = 0; k < 60; k++) {
      // no opponents: only the catch itself counts
      for (const p of SK[1] as any[]) {
        p.x = p.y = -500;
        p.vx = p.vy = 0;
        p.benched = true;
      }
      const a: any = SK[0][0],
        b: any = SK[0][1],
        c: any = SK[0][2];
      c.benched = true;
      c.x = c.y = -400;
      const ang = (k / 60) * Math.PI * 2,
        dist = 30 + (k % 4) * 15;
      Object.assign(a, {
        benched: false,
        x: 80,
        y: 150,
        vx: 0,
        vy: -40,
        fx: 0,
        fy: -1,
        cool: 0,
        down: 0,
        stun: 0,
        imm: 0,
        checkT: 0,
      });
      Object.assign(b, {
        benched: false,
        x: 80 + Math.cos(ang) * dist,
        y: 150 + Math.sin(ang) * dist * 0.8,
        vx: ((k % 3) - 1) * 30,
        vy: -30,
        fx: 0,
        fy: -1,
        cool: 0,
        down: 0,
        stun: 0,
        imm: 0,
        checkT: 0,
      });
      G.state = 'play';
      G.controlled = a;
      G.ai0 = false;
      puck.owner = a;
      puck.miss.clear();
      step(2, () => {
        pad.x = 0;
        pad.y = -1;
      });
      input.pp = true; // pass
      let got = false;
      step(90, () => {
        const me: any = G.controlled;
        if (hold === 'forward') {
          pad.x = 0;
          pad.y = -1;
        } else if (hold === 'none') {
          pad.x = pad.y = 0;
        } else if (hold === 'away') {
          const dx = me.x - puck.x,
            dy = me.y - puck.y,
            l = Math.hypot(dx, dy) || 1;
          pad.x = dx / l;
          pad.y = dy / l;
        } else {
          const l = Math.hypot(puck.vx, puck.vy) || 1;
          pad.x = -puck.vy / l;
          pad.y = puck.vx / l;
        } // across the pass line
        if (puck.owner === b) got = true;
      });
      n++;
      if (got) caught++;
    }
    res[hold] = caught / n;
  }
  pad.x = pad.y = 0;
  expect(res.forward).toBeGreaterThanOrEqual(0.85); // stick still held up the ice: caught
  expect(res.none).toBeGreaterThanOrEqual(0.95);
  expect(res.sideways).toBeLessThan(res.forward); // steering across the pass line costs catches
});
