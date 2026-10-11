import { expect, it } from 'vitest';
import { NETS, RX0, RX1, RY0, RY1, STEP, GT, GB } from '../src/config';
import { clearEvents, on } from '../src/core/events';
import { clock } from '../src/core/time';
import { DIFF } from '../src/data/difficulty';
import { startGame } from '../src/game/match';
import { GK, SK, SKATERS, players } from '../src/game/players';
import { update } from '../src/game/update';
import { G, puck } from '../src/game/world';
import { input, pad } from '../src/input/state';
import { settings } from '../src/settings';

const STATES = new Set([
  'intro',
  'faceoff',
  'play',
  'goal',
  'celebrate',
  'replay',
  'inter',
  'brawl',
  'zamboni',
  'over',
  'paused',
]);
const bad = (v: number) => !Number.isFinite(v);

/** A scripted human: chases the puck, carries it toward the net, shoots, passes, checks, sometimes idles. */
function bot(rnd: () => number) {
  const me = G.controlled;
  pad.x = pad.y = 0;
  input.sp = input.sr = input.pp = input.swp = false;
  if (G.state === 'zamboni' && G.zam) {
    pad.x = Math.sin(clock.now * 0.7);
    pad.y = Math.cos(clock.now * 0.5);
    return;
  }
  if (G.state === 'brawl') {
    if (rnd() < 0.2) input.sp = true;
    if (rnd() < 0.05) input.pp = true;
    return;
  }
  if (G.state === 'faceoff') {
    if (rnd() < 0.03) input.sp = true;
    return;
  }
  if (!me || G.state !== 'play') return;
  const mode = Math.floor(clock.now / 7) % 5; // switch behaviour every 7 s
  if (mode === 4) return; // stand still
  let tx = puck.x,
    ty = puck.y;
  if (puck.owner === me) {
    tx = 80;
    ty = GT + 20;
    const d = Math.hypot(80 - me.x, GT - me.y);
    if (d < 50 && rnd() < 0.04) {
      input.shootHeld = true;
      input.sp = true;
    } else if (input.shootHeld && rnd() < 0.2) {
      input.shootHeld = false;
      input.sr = true;
    }
    if (rnd() < 0.008) input.pp = true;
  } else if (puck.owner && puck.owner.team === 1) {
    if (rnd() < 0.02) input.sp = true; // poke
    if (rnd() < 0.01) input.pp = true; // check
  }
  if (rnd() < 0.005) input.swp = true;
  const dx = tx - me.x,
    dy = ty - me.y,
    l = Math.hypot(dx, dy) || 1;
  pad.x = dx / l;
  pad.y = dy / l;
}

// Plays whole matches (Watch mode and a scripted human, both CPU styles, fights and resurfacing on) and checks
// every frame that nothing impossible happens: no NaN, nobody and no puck outside the rink, no stuck state,
// the score only goes up, the puck carrier is never down or benched, and every match ends.
it('whole matches keep the game rules intact', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const problems: Record<string, any[]> = {};
  const note = (k: string, v: any) => {
    (problems[k] ||= []).length < 5 && problems[k].push(v);
    (problems[k] as any).count = ((problems[k] as any).count || 0) + 1;
  };
  let games = 0,
    totalGoals = 0,
    totalTime = 0;
  const shots = [0, 0],
    goals = [0, 0];
  for (const watch of [true, false])
    for (const style of ['classic', 'realistic'] as const)
      for (const diff of [watch ? 'pro' : 'allstar'] as const)
        for (let rep = 0; rep < 1; rep++) {
          clearEvents();
          const banners: string[] = [];
          on('banner', (t: string) => banners.push(t));
          Object.assign(settings, {
            periodLen: 60,
            zamOn: true,
            fightsOn: true,
            cpuStyle: style,
            diffKey: diff,
            diff: DIFF[diff],
          });
          startGame(watch);
          let t = 0,
            lastScore = '0-0',
            stateT = 0,
            lastState = G.state;
          for (; t < 60 * 25 && G.state !== 'over'; t += STEP) {
            if (!watch) bot(rnd);
            clock.now += STEP;
            try {
              update(STEP);
            } catch (e: any) {
              note('exception', {
                msg: String(e && e.stack)
                  .split('\n')
                  .slice(0, 3)
                  .join(' | '),
                state: G.state,
              });
              break;
            }
            if (!STATES.has(G.state)) note('unknownState', G.state);
            if (G.state === lastState) stateT += STEP;
            else {
              lastState = G.state;
              stateT = 0;
            }
            if (stateT > 40 && G.state !== 'play') note('stuckState', { state: G.state, t: +t.toFixed(1) });
            if (stateT > 40) stateT = -1e9;
            for (const p of players) {
              if (p.benched) continue;
              if (bad(p.x) || bad(p.y) || bad(p.vx) || bad(p.vy))
                note('nanPlayer', { slot: p.slot, team: p.team, state: G.state });
              if (G.state !== 'zamboni' && (p.x < RX0 - 1 || p.x > RX1 + 1 || p.y < RY0 - 1 || p.y > RY1 + 1))
                note('playerOut', { x: p.x, y: p.y, role: p.role, state: G.state });
              if (Math.hypot(p.vx, p.vy) > 400)
                note('playerFast', { v: Math.hypot(p.vx, p.vy), state: G.state });
            }
            if (bad(puck.x) || bad(puck.y) || bad(puck.vx) || bad(puck.vy))
              note('nanPuck', { state: G.state });
            if (
              !puck.owner &&
              G.state === 'play' &&
              (puck.x < RX0 - 0.5 || puck.x > RX1 + 0.5 || puck.y < RY0 - 0.5 || puck.y > RY1 + 0.5)
            )
              note('puckOut', { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
            if (puck.owner && (puck.owner.benched || (puck.owner.down > 0 && puck.owner.role === 'S')))
              note('ownerDownOrBenched', { state: G.state, down: puck.owner.down });
            const sc = G.score.join('-');
            if (sc !== lastScore) {
              const [a, b] = lastScore.split('-').map(Number);
              if (G.score[0] < a || G.score[1] < b) note('scoreDown', { from: lastScore, to: sc });
              lastScore = sc;
            }
            if (G.state === 'play' && !puck.owner) {
              for (const n of NETS)
                if (puck.x > n.x0 + 1 && puck.x < n.x1 - 1 && puck.y > n.y0 + 0.5 && puck.y < n.y1 - 0.5)
                  note('puckInNetNoGoal', { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
            }
          }
          games++;
          totalTime += t;
          if (G.state !== 'over')
            note('neverEnded', { watch, style, diff, state: G.state, period: G.period, t });
          totalGoals += G.score[0] + G.score[1];
          shots[0] += G.stats.sog[0];
          shots[1] += G.stats.sog[1];
          goals[0] += G.score[0];
          goals[1] += G.score[1];
          const frozen = banners.filter(b => b === 'PUCK FROZEN').length;
          if (frozen) note('stalls', { watch, style, diff, frozen });
        }
  pad.x = pad.y = 0;
  expect(games).toBe(4);
  expect(problems).toEqual({});
});
