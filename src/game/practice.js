import { GB, GT, PERIOD_LEN } from '../config';
import { AMB } from '../data/colors';
import {
  audio,
  banner,
  chime,
  hideBanner,
  hud,
  pop,
  screen,
  setCrowd,
  showPad,
  stopSong,
  updCam,
  vib,
  zoom,
} from './fx';
import { clearIceWear } from './iceWear';
import { GK, SK, genRoster, players } from './players';
import { take } from './puck';
import { startBrawl } from './states/brawl';
import { faceoff } from './states/faceoff';
import { startZamboni, stopEngine } from './states/zamboni';
import { G, puck, ref } from './world';

/* ---------- practice modes ---------- */
export let pcfg = { opp: 'dummy', mates: false, goalie: 'cpu' };
export function resetRosterFlags() {
  for (const p of players) {
    p.benched = false;
    p.dummy = false;
  }
}
export function startPractice(cfg) {
  audio();
  G.practice = Object.assign({}, cfg);
  G.demo = false;
  G.watch = false;
  G.ai0 = false;
  G.controlled = null;
  G.mom = null;
  G.score = [0, 0];
  G.period = 1;
  G.clock = PERIOD_LEN;
  G.ignoreRelease = false;
  G.brawlNext = false;
  screen('practice');
  resetRosterFlags();
  genRoster();
  for (const p of players) {
    p.stride = p.lastStride = 0;
  }
  stopSong(0.2);
  clearIceWear();
  setCrowd(0.02);
  showPad(true);
  faceoff();
  hideBanner();
  if (cfg.mode === 'fight') {
    G.state = 'play';
    puck.z = 0;
    puck.owner = null;
    puck.x = 80;
    puck.y = 60;
    G.lastShooter = null;
    G.controlled = SK[0][0];
    G.fightP = 0;
    startBrawl();
    hud();
    return;
  }
  if (cfg.mode === 'zam') {
    startZamboni();
    hud();
    return;
  }
  const c = G.practice;
  SK[0][1].benched = SK[0][2].benched = !c.mates;
  GK[0].benched = !c.mates;
  for (const p of SK[1]) {
    p.benched = c.opp === 'none';
    p.dummy = c.opp === 'dummy';
  }
  GK[1].benched = c.goalie === 'none';
  GK[1].dummy = c.goalie === 'dummy';
  hud();
  practiceReset(true);
}
export function practiceReset(first) {
  const P = [
      [80, 176],
      [50, 196],
      [110, 204],
    ],
    D = [
      [56, 70],
      [104, 70],
      [80, 52],
    ];
  SK[0].forEach((p, i) => {
    p.x = P[i][0];
    p.y = P[i][1];
    p.vx = p.vy = 0;
    p.fx = 0;
    p.fy = -1;
    p.down = p.stun = p.cool = p.checkT = 0;
  });
  SK[1].forEach((p, i) => {
    p.x = D[i][0];
    p.y = D[i][1];
    p.vx = p.vy = 0;
    p.fx = 0;
    p.fy = 1;
    p.down = p.stun = p.cool = p.checkT = 0;
  });
  for (const g of GK) {
    g.x = 80;
    g.y = g.team ? GT + 4 : GB - 4;
    g.vx = g.vy = 0;
    g.hold = 0;
  }
  for (const p of players)
    if (p.benched) {
      p.x = -60;
      p.y = -60;
      p.vx = p.vy = 0;
    }
  Object.assign(puck, { z: 0, vx: 0, vy: 0, passTo: null, gchk: null, hard: false });
  puck.miss.clear();
  puck.trail.length = 0;
  G.state = 'play';
  G.controlled = SK[0][0];
  take(SK[0][0]);
  G.stillT = 0;
  Object.assign(ref, { x: 132, y: 128, vx: 0, vy: 0, fx: -1, fy: 0 });
  updCam(0, true);
  if (first) {
    banner('FREE SKATE', 'alert', 'No clock, no pressure. Pause to quit.');
    G.bannerT = 2;
  }
}
export function practiceGoal(team, n) {
  G.state = 'goal';
  G.timer = 1.3;
  G.goalRec = 0;
  if (team === 0) G.score[0]++;
  hud();
  pop(80, n.top ? GT + 12 : GB - 12, team === 0 ? 'GOAL!' : 'OWN GOAL', team === 0 ? AMB : '#ff8a80', true);
  chime();
  if (team === 0) vib([40, 30, 60]);
}
export function practiceOver(title, line) {
  G.state = 'over';
  hideBanner();
  stopEngine();
  zoom(1);
  screen('practiceOver', { title, line });
  showPad(false);
}
