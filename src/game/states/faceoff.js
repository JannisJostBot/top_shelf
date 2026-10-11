import { GB, GT } from '../../config';
import { rnd } from '../../core/math';
import { STADIUMS } from '../../data/stadiums';
import { GK, SK, players } from '../players';
import { take } from '../puck';
import { G, REC, puck, ref } from '../world';
import { input } from '../../input/state';
import { settings } from '../../settings';
import { banner, clearFx, feed, resetCloth, S, stopSong, uiShow, updCam, zoom } from '../fx';

/* ---------- face-off minigame ---------- */
export function faceoff() {
  const pos = [
    [
      [80, 135],
      [48, 144],
      [104, 176],
    ],
    [
      [80, 121],
      [112, 112],
      [56, 80],
    ],
  ];
  for (const t of [0, 1]) {
    SK[t].forEach((p, i) => {
      p.x = pos[t][i][0];
      p.y = pos[t][i][1];
      p.vx = p.vy = 0;
      p.fx = 0;
      p.fy = t ? 1 : -1;
      p.cool = p.stun = p.down = p.boost = p.imm = p.pokeCd = p.checkCd = p.checkT = 0;
      p.checkTgt = null;
    });
    const g = GK[t];
    g.x = 80;
    g.y = t ? GT + 4 : GB - 4;
    g.vx = g.vy = 0;
    g.hold = 0;
    g.cool = 0;
    g.passCd = 0;
    g.saveT = 0;
  }
  for (const p of players) {
    p.jump = 0;
    p.stickUp = false;
  }
  Object.assign(ref, { x: 88, y: 131, vx: 0, vy: 0, fx: -1, fy: 0 });
  uiShow('angleBtn', true);
  Object.assign(puck, {
    x: 80,
    y: 128,
    z: 9,
    vx: 0,
    vy: 0,
    owner: null,
    passTo: null,
    gchk: null,
    hard: false,
  });
  puck.miss.clear();
  puck.trail.length = 0;
  REC.length = 0;
  zoom(1);
  stopSong(0.8);
  clearFx();
  resetCloth();
  G.br = null;
  G.brawlNext = false;
  G.state = 'faceoff';
  G.charge = 0;
  G.charging = false;
  G.switchLock = 0;
  G.fo = {
    phase: 'set',
    t: 0,
    setT: G.demo ? 0.4 : 1.1,
    wait: G.ai0 ? 0.35 : rnd(0.5, 1.7),
    cpu: settings.diff.fo + rnd(-0.05, 0.06),
    early: false,
  };
  if (!G.ai0) G.controlled = SK[0][0];
  if (!G.demo) {
    const welcome = G.firstFO ? 'Live from ' + STADIUMS[settings.stadiumKey].name : '';
    G.firstFO = false;
    banner(
      'FACE-OFF',
      'small',
      G.ai0 ? welcome : (welcome ? welcome + ' · ' : '') + 'Tap DRAW when the puck drops',
    );
    G.bannerT = G.ai0 ? 1.4 : 0;
  }
  updCam(0, true);
}
export function foUpdate(dt) {
  const fo = G.fo;
  fo.t += dt;
  if (fo.phase === 'set') {
    if (fo.t >= fo.setT) {
      fo.phase = 'ready';
      fo.t = 0;
      if (!G.ai0) banner('READY', 'small alert', 'Wait for the drop…');
    }
  } else if (fo.phase === 'ready') {
    if (!G.ai0 && input.sp && !fo.early) {
      fo.early = true;
      banner('TOO EARLY', 'small away', 'CPU gets the draw');
      S('lose');
    }
    if (fo.t >= fo.wait) {
      fo.phase = 'drop';
      fo.t = 0;
      S('drop');
      if (!G.ai0 && !fo.early) banner('DROP!', 'alert', '');
    }
  } else {
    puck.z = Math.max(0, 9 - fo.t * 70);
    if (G.ai0) {
      if (fo.t >= 0.25) foResolve(Math.random() < 0.5 ? 0 : 1, null);
    } else if (fo.early) {
      if (fo.t >= 0.15) foResolve(1, null);
    } else if (input.sp && fo.t < fo.cpu) foResolve(0, fo.t);
    else if (fo.t >= fo.cpu) foResolve(1, null);
  }
  input.sp = input.sr = input.pp = input.swp = false;
}
function foResolve(team, rt) {
  puck.z = 0;
  puck.x = 80;
  puck.y = 128;
  const w = SK[team][0],
    l = SK[1 - team][0];
  G.state = 'play';
  take(w);
  G.stats.fo[team]++;
  feed('Faceoff won · ' + '#' + w.num + ' ' + w.name, team);
  l.stun = 0.35;
  if (input.shootHeld) G.ignoreRelease = true;
  if (!G.ai0) {
    if (team === 0) {
      S('win');
      banner('WON THE DRAW', 'small home', rt !== null ? rt.toFixed(2) + 's reaction' : '');
    } else {
      S('lose');
      banner(
        'LOST THE DRAW',
        'small away',
        G.fo.early ? '' : 'Too slow. CPU took ' + G.fo.cpu.toFixed(2) + 's',
      );
    }
    G.bannerT = 1.1;
  }
}
