import { describe, expect, it, vi } from 'vitest';
import { STEP } from '../src/config';
import { clearEvents, on } from '../src/core/events';
import { clock } from '../src/core/time';
import { startGame } from '../src/game/match';
import { update } from '../src/game/update';
import { G } from '../src/game/world';
import { settings } from '../src/settings';

// The simulation runs without a browser: no DOM, no canvas, no audio. It only announces what happened as
// events, so here a whole CPU vs CPU match plays out in Node and the test listens to what it announced.
describe('headless simulation', () => {
  it('plays a full CPU vs CPU match without any presentation attached', () => {
    expect(typeof document).toBe('undefined'); // really no browser here
    clearEvents();
    const heard: Record<string, number> = {};
    for (const name of ['sound', 'banner', 'feed', 'camera', 'screen'])
      on(name, () => (heard[name] = (heard[name] || 0) + 1));
    const screens: string[] = [];
    on('screen', (name: string) => screens.push(name));

    settings.periodLen = 30;
    settings.zamOn = false;
    startGame(true);
    expect(G.watch).toBe(true);
    expect(G.state).toBe('intro'); // the arena intro plays before the opening face-off

    // three 30 s periods plus breaks, replays and celebrations fit easily in 10 simulated minutes
    const steps = Math.floor(600 / STEP);
    for (let i = 0; i < steps && G.state !== 'over'; i++) {
      clock.now += STEP;
      update(STEP);
    }
    expect(G.state).toBe('over');
    expect(G.period).toBeGreaterThanOrEqual(3);
    expect(G.score[0]).not.toBe(G.score[1]);
    // every goal is a shot on goal, and the goalies stopped some
    expect(G.stats.sog[0]).toBeGreaterThanOrEqual(G.score[0]);
    expect(G.stats.sog[1]).toBeGreaterThanOrEqual(G.score[1]);
    expect(G.stats.sog[0] + G.stats.sog[1]).toBeGreaterThan(0);
    // and it told the presentation all about it
    expect(heard.sound).toBeGreaterThan(0);
    expect(heard.feed).toBeGreaterThan(0);
    expect(heard.camera).toBeGreaterThan(0);
    expect(screens[0]).toBe('match');
    expect(screens.at(-1)).toBe('over');
    clearEvents();
  });

  it('plays the same match again from the same seed', async () => {
    // the dice come from core/rng, so a seed and the same inputs reproduce a match tick for tick. Each run loads
    // the game fresh, like a new page: a match leaves its players' timers and AI notes behind for the next one.
    const play = async (seed: number) => {
      vi.resetModules();
      const { clearEvents, on } = await import('../src/core/events');
      const { seedRng } = await import('../src/core/rng');
      const { clock } = await import('../src/core/time');
      const { startGame } = await import('../src/game/match');
      const { update } = await import('../src/game/update');
      const { G } = await import('../src/game/world');
      const { settings } = await import('../src/settings');
      const feed: string[] = [];
      on('feed', (t: string) => feed.push(t));
      settings.periodLen = 30;
      settings.zamOn = false;
      seedRng(seed);
      startGame(true);
      const steps = Math.floor(600 / STEP);
      for (let i = 0; i < steps && G.state !== 'over'; i++) {
        clock.now += STEP;
        update(STEP);
      }
      clearEvents();
      return { score: [...G.score], stats: JSON.parse(JSON.stringify(G.stats)), feed };
    };
    const a = await play(2024);
    expect(a.feed.length).toBeGreaterThan(1);
    expect(await play(2024)).toEqual(a);
    expect(await play(7)).not.toEqual(a);
  });
});
