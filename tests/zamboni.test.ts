import { describe, expect, it } from 'vitest';
import { NETS, RX0, RY0, STEP } from '../src/config';
import { clearEvents, on } from '../src/core/events';
import { togglePause } from '../src/game/match';
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

// The speed boost must be within reach: a good run (here an autopilot driving lanes up and down the rink) has
// to be able to polish the share of the ice it needs.
describe('resurfacer run', () => {
  it('can polish enough ice for the speed boost', () => {
    clearEvents();
    G.demo = false;
    startZamboni();
    const z = G.zam;
    while (z.phase === 'count') zamStep(STEP);
    const pts: number[][] = [];
    for (let i = 0, x = 12; x < 150; x += 20, i++) {
      pts.push([x, i % 2 ? 14 : 242], [x + 10, i % 2 ? 14 : 242]);
    }
    let w = 0;
    while (z.phase === 'drive') {
      const [tx, ty] = pts[Math.min(w, pts.length - 1)],
        dx = tx - z.x,
        dy = ty - z.y,
        l = Math.hypot(dx, dy) || 1;
      if (l < 9) w++;
      pad.x = dx / l;
      pad.y = dy / l;
      zamStep(STEP);
    }
    pad.x = pad.y = 0;
    input.sp = input.pp = false;
    expect(z.pct).toBeGreaterThanOrEqual(50);
  });
});

// The engine hum goes quiet while the game is paused and comes back on resume.
describe('resurfacer engine and pause', () => {
  it('pauses and resumes the engine with the game', () => {
    clearEvents();
    G.demo = false;
    G.net = null;
    const cmds: string[] = [];
    on('zamEngine', (c: string) => cmds.push(c));
    startZamboni();
    const z = G.zam;
    while (z.phase === 'count') zamStep(STEP);
    togglePause();
    expect(G.state).toBe('paused');
    togglePause();
    expect(G.state).toBe('zamboni');
    expect(cmds.filter(c => c === 'pause' || c === 'resume')).toEqual(['pause', 'resume']);
    // once this machine is done its engine is off: nothing to quiet
    z.phase = 'done';
    togglePause();
    togglePause();
    expect(cmds.filter(c => c === 'pause' || c === 'resume')).toEqual(['pause', 'resume']);
    clearEvents();
    G.zam = null;
    G.state = 'menu';
  });
});
