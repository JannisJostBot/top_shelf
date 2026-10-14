import { describe, expect, it } from 'vitest';
import { STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { clock } from '../src/core/time';
import { startGame } from '../src/game/match';
import { GK, SK, SKATERS } from '../src/game/players';
import { take } from '../src/game/puck';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { input } from '../src/input/state';
import { settings } from '../src/settings';

const run = (seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) {
    clock.now += STEP;
    update(STEP);
  }
};

describe('shot wind-up', () => {
  it('starts over when a check jars the puck loose and the carrier picks it straight back up', () => {
    clearEvents();
    settings.periodLen = 600;
    settings.fightsOn = false;
    startGame(false);
    run(3); // through the face-off
    G.state = 'play';
    // only your skater on the ice, carrying the puck at centre ice
    for (const p of [...SKATERS, ...GK]) {
      p.x = p.y = -500;
      p.vx = p.vy = 0;
      p.benched = true;
    }
    const me: any = SK[0][0];
    Object.assign(me, { benched: false, cool: 0, down: 0, stun: 0, checkT: 0, x: 80, y: 150, vx: 0, vy: 0 });
    G.controlled = me;
    puck.owner = me;
    G.ignoreRelease = false;

    input.shootHeld = true;
    run(0.4);
    expect(G.charging).toBe(true);
    expect(G.charge).toBeGreaterThan(0.3);

    // a stumbling check knocks the puck off the stick and the carrier wins it back within the same step
    puck.owner = null;
    take(me);
    expect(G.charging).toBe(false);
    expect(G.charge).toBe(0);

    // the held button does not keep winding up; letting go does not shoot, and the next press starts from zero
    run(0.2);
    expect(G.charge).toBe(0);
    input.shootHeld = false;
    input.sr = true;
    run(STEP);
    expect(puck.owner).toBe(me);
    input.shootHeld = true;
    run(0.1);
    expect(G.charge).toBeGreaterThan(0);
    expect(G.charge).toBeLessThan(0.15);
    input.shootHeld = false;
  });
});
