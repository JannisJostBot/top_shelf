import { describe, expect, it } from 'vitest';
import { clearEvents } from '../src/core/events';
import { assignSlot, autoLineup, prepareLineup } from '../src/game/lineup';
import { startGame } from '../src/game/match';
import { SK } from '../src/game/players';
import { faceoff } from '../src/game/states/faceoff';

describe('line-up manager', () => {
  it('keeps the prepared roster and positions for the next match', () => {
    clearEvents();
    const sk: any[] = prepareLineup().slice();
    const names = sk.map(p => p.name).sort();
    const star = sk.find(p => p.slot === 'D'); // move the defenceman to centre
    assignSlot(star, 'C');
    expect(SK[0][0]).toBe(star); // C, W, D order: the centre comes first
    expect(new Set(SK[0].map((p: any) => p.slot))).toEqual(new Set(['C', 'W', 'D']));
    startGame(false);
    expect(SK[0].map((p: any) => p.name).sort()).toEqual(names); // the same players
    expect(star.slot).toBe('C');
    faceoff();
    expect(star.x).toBe(80); // and the centre takes the draw at centre ice
    // the match after that rolls a fresh roster again
    startGame(false);
    expect(SK[0].map((p: any) => p.name).sort()).not.toEqual(names);
  });

  it('auto fits skaters to the positions their ratings suit', () => {
    clearEvents();
    prepareLineup();
    const [a, b, c]: any[] = SK[0];
    Object.assign(a.st, { spd: 1, sht: 0.8, hnd: 0.8, chk: 1.3 });
    Object.assign(b.st, { spd: 1, sht: 0.8, hnd: 1.25, chk: 0.8 });
    Object.assign(c.st, { spd: 1, sht: 1.25, hnd: 0.8, chk: 0.8 });
    autoLineup(0);
    expect([a.slot, b.slot, c.slot]).toEqual(['D', 'C', 'W']);
  });
});
