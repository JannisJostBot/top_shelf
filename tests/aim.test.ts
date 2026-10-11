import { describe, expect, it } from 'vitest';
import { GT, STEP } from '../src/config';
import { clearEvents } from '../src/core/events';
import { clock } from '../src/core/time';
import { goalScored, startGame } from '../src/game/match';
import { startPractice } from '../src/game/practice';
import { startBrawl } from '../src/game/states/brawl';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { settings } from '../src/settings';

const step = (n: number) => {
  for (let i = 0; i < n; i++) {
    clock.now += STEP;
    update(STEP);
  }
};
/** A loose puck sliding straight up into the top goal at x. */
function shootAt(x: number) {
  Object.assign(puck, { owner: null, x, y: GT + 6, z: 0, vx: 0, vy: -200, passTo: null, hard: true });
  puck.miss.clear();
  for (let i = 0; i < 20 && G.state === 'play'; i++) step(1);
}

describe('aim trainer', () => {
  it('blocks shots outside the gap, lets them in through it, then moves the gap', () => {
    clearEvents();
    startPractice({ mode: 'aim' });
    expect(G.aim).toBeTruthy();
    const gap = G.aim.gap,
      off = gap < 80 ? gap + 8 : gap - 8; // on the board, clear of the gap
    shootAt(off);
    expect(G.state).toBe('play');
    expect(G.score[0]).toBe(0);
    expect(puck.vy).toBeGreaterThan(0); // bounced back off the board
    shootAt(gap);
    expect(G.state).toBe('goal');
    expect(G.score[0]).toBe(1);
    expect(Math.abs(G.aim.gap - gap)).toBeGreaterThan(5);
  });

  it('ends after the minute with a result', () => {
    clearEvents();
    startPractice({ mode: 'aim' });
    G.aim.t = 0.05;
    step(10);
    expect(G.state).toBe('over');
    expect(G.aim).toBe(null);
  });
});

describe('fights', () => {
  it('happen at most once a match', () => {
    clearEvents();
    settings.fightsOn = true;
    startGame(false);
    G.state = 'play';
    let fights = 0;
    const g0: any = G; // brawlNext and br are set on the fly, outside the typed fields
    for (let g = 0; g < 8; g++) {
      G.fightP = 1; // a fight would be certain if one were still allowed
      G.state = 'play';
      goalScored(0, { top: true, x0: 67, x1: 93, scorer: 0, def: 1 } as any);
      if (g0.brawlNext) {
        fights++;
        g0.brawlNext = false;
        startBrawl();
        g0.br = null;
      }
    }
    expect(fights).toBe(1);
  });
});
