import { describe, expect, it } from 'vitest';
import { STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { clock } from '../src/core/time';
import { startGame } from '../src/game/match';
import { GK, SK, SKATERS } from '../src/game/players';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { pad } from '../src/input/state';
import { settings } from '../src/settings';

const run = (seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds / STEP; i++) {
    each?.();
    clock.now += STEP;
    update(STEP);
  }
};
function freshMatch() {
  clearEvents();
  settings.periodLen = 600;
  settings.fightsOn = false;
  startGame(false);
  run(3); // through the face-off
  G.state = 'play';
  // only your skater on the ice
  for (const p of [...SKATERS, ...GK]) {
    p.x = p.y = -500;
    p.vx = p.vy = 0;
    p.benched = true;
  }
  const me = SK[0][0];
  Object.assign(me, { benched: false, cool: 0, down: 0, stun: 0, checkT: 0, x: 80, y: 150, vx: 0, vy: 0 });
  G.controlled = me;
  return me;
}

describe('picking up the puck', () => {
  it('works after a fast puck once slipped past the same skater', () => {
    const me = freshMatch();
    // a hard pass slid past this skater (it fumbled the catch), then the puck slowed down to a stop nearby
    Object.assign(puck, { owner: null, x: 80, y: 120, z: 0, vx: 0, vy: 0, passTo: null, hard: false });
    puck.miss.clear();
    puck.miss.add(me);
    let got = false;
    run(3, () => {
      if (puck.owner === me) got = true;
      const dx = puck.x - me.x,
        dy = puck.y - me.y,
        l = Math.hypot(dx, dy) || 1;
      pad.x = dx / l;
      pad.y = dy / l;
    });
    pad.x = pad.y = 0;
    expect(got || puck.owner === me).toBe(true);
  });
});

describe('standing still with the puck', () => {
  for (const style of ['classic', 'realistic'] as const)
    it(`gets challenged by the ${style} CPU`, () => {
      clearEvents();
      settings.periodLen = 600;
      settings.fightsOn = false;
      settings.cpuStyle = style;
      startGame(false);
      run(3);
      G.state = 'play';
      const me = SK[0][0];
      // you hold the puck at centre ice, facing your own net, and do nothing
      for (const p of SK[1]) Object.assign(p, { x: p.x, y: Math.min(p.y, 80) });
      Object.assign(me, { x: 80, y: 150, vx: 0, vy: 0, fx: 0, fy: 1, cool: 0, down: 0, stun: 0, imm: 0 });
      G.controlled = me;
      puck.owner = me;
      let lost = false;
      run(8, () => {
        pad.x = pad.y = 0;
        if (puck.owner !== me) lost = true;
      });
      settings.cpuStyle = 'classic';
      expect(lost).toBe(true);
    });
});
