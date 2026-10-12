import { GB, GT } from '../../config';
import { rnd } from '../../core/math';
import { STADIUMS } from '../../data/stadiums';
import { GK, SK, players } from '../players';
import { take } from '../puck';
import { G, REC, puck, ref } from '../world';
import { input } from '../../input/state';
import { settings } from '../../settings';
import {
  banner,
  clearFx,
  feed,
  foCue,
  hostOnly,
  persp,
  resetCloth,
  S,
  stopSong,
  uiShow,
  updCam,
  zoom,
} from '../fx';
import { MIN_REACTION, net, rinput, seat1 } from '../online';

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
  if (G.net) {
    seat1.controlled = SK[1][0];
    // each draw gets a number, so a late report about an earlier one cannot decide this one
    G.fo.id = G.foId = (G.foId || 0) + 1;
    G.fo.rt = [null, null];
    G.fo.early = [false, false];
    G.fo.wait = rnd(0.7, 1.9);
  }
  if (!G.demo) {
    const welcome = G.firstFO ? 'Live from ' + STADIUMS[settings.stadiumKey].name : '';
    G.firstFO = false;
    banner(
      'FACE-OFF',
      'small low',
      G.ai0 ? welcome : (welcome ? welcome + ' · ' : '') + 'Tap DRAW when the puck drops',
    );
    G.bannerT = G.ai0 ? 1.4 : 0;
  }
  updCam(0, true);
}
export function foUpdate(dt) {
  if (G.net) {
    foUpdateNet(dt);
    return;
  }
  const fo = G.fo;
  fo.t += dt;
  if (fo.phase === 'set') {
    if (fo.t >= fo.setT) {
      fo.phase = 'ready';
      fo.t = 0;
      if (!G.ai0) banner('READY', 'small alert low', 'Wait for the drop…');
    }
  } else if (fo.phase === 'ready') {
    if (!G.ai0 && input.sp && !fo.early) {
      fo.early = true;
      banner('TOO EARLY', 'small away low', 'CPU gets the draw');
      S('lose');
    }
    if (fo.t >= fo.wait) {
      fo.phase = 'drop';
      fo.t = 0;
      S('drop');
      if (!G.ai0 && !fo.early) banner('DROP!', 'alert low', '');
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
// Online face-off (host). Each player is timed on their own screen, from the moment the puck drops there to their
// press, so the network delay does not count against either of them. The host times itself; the guest reports its
// time (foReport). The host does not take that report on trust: the report cannot have taken less than a round
// trip (plus the guest's short playback delay) to arrive, so a claimed time much quicker than the arrival allows is
// raised to what the arrival allows. The guest gets both times and checks the call itself (src/net/match.js).
/** How long after a press the host waits for a quicker report from the guest that may still be on its way. */
const reportWindow = () => Math.min(0.7, net.rtt + 0.25);
function foUpdateNet(dt) {
  const fo = G.fo;
  fo.t += dt;
  const press = input.sp;
  input.sp = input.sr = input.pp = input.swp = false;
  rinput.sp = rinput.sr = rinput.pp = rinput.swp = false; // (the guest's draw comes as its own report)
  if (fo.phase === 'set') {
    if (fo.t >= fo.setT) {
      fo.phase = 'ready';
      fo.t = 0;
      banner('READY', 'small alert low', 'Wait for the drop…');
      foCue({ id: fo.id, ph: 'ready' });
    }
    return;
  }
  if (fo.phase === 'ready') {
    if (press && !fo.early[0]) {
      fo.early[0] = true;
      hostOnly(() => {
        banner('TOO EARLY', 'small away low', 'Jumped the draw');
        S('lose');
      });
    }
    if (fo.t >= fo.wait) {
      fo.phase = 'drop';
      fo.t = 0;
      fo.dropAt = performance.now();
      foCue({ id: fo.id, ph: 'drop' }); // the guest drops the puck (and starts its clock) when its screen gets here
      hostOnly(() => {
        S('drop');
        if (!fo.early[0]) banner('DROP!', 'alert low', '');
      });
    }
    return;
  }
  puck.z = Math.max(0, 9 - fo.t * 70);
  // (timed from the moment of the press, not the step that notices it, the same as the guest does)
  if (press && !fo.early[0] && fo.rt[0] === null) {
    const at = input.spAt > fo.dropAt ? input.spAt : performance.now(),
      rt = Math.min(fo.t, (at - fo.dropAt) / 1000);
    if (rt < MIN_REACTION) fo.early[0] = true;
    else fo.rt[0] = rt;
  }
  const [e0, e1] = fo.early,
    [r0, r1] = fo.rt;
  let w = -1;
  if (e0 && e1) w = fo.t >= 0.15 ? (Math.random() < 0.5 ? 0 : 1) : -1;
  else if (e0) w = fo.t >= 0.15 ? 1 : -1;
  else if (e1) w = fo.t >= 0.15 ? 0 : -1;
  else if (r0 !== null && r1 !== null) w = r0 < r1 ? 0 : r1 < r0 ? 1 : Math.random() < 0.5 ? 0 : 1;
  else if (r1 !== null)
    w = 1; // the guest's time is in and the host has not pressed yet: the host can only be slower
  else if (r0 !== null && fo.t >= r0 + reportWindow()) w = 0;
  else if (fo.t >= 2.5) w = Math.random() < 0.5 ? 0 : 1; // nobody drew: a scramble
  if (w >= 0) foResolve(w, null);
}
/** Host: the guest's report for draw `id`: its reaction time in seconds, or early. */
export function foReport(id, early, rt) {
  const fo = G.fo;
  if (G.state !== 'faceoff' || !fo || fo.id !== id || fo.early[1] || fo.rt[1] !== null) return;
  if (early) {
    if (fo.phase === 'set') return; // not even READY yet on this side: a stray press from before
    fo.early[1] = true;
    return;
  }
  if (fo.phase !== 'drop' || !(rt >= 0)) return;
  if (rt < MIN_REACTION) {
    fo.early[1] = true;
    return;
  }
  // it cannot be quicker than the time it took to get here, less a round trip and the guest's playback delay
  fo.claimed = rt;
  fo.rt[1] = Math.max(rt, fo.t - (net.rtt + 0.25));
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
  if (G.net) {
    if (rinput.shootHeld) seat1.ignoreRelease = true;
    const fo = G.fo,
      t = (r, e) => (e ? 'early' : r === null ? '–' : r.toFixed(2) + 's'),
      line = v =>
        'You ' + t(fo.rt[v], fo.early[v]) + ' · ' + net.names[1 - v] + ' ' + t(fo.rt[1 - v], fo.early[1 - v]);
    S(persp(v => (v === team ? 'win' : 'lose')));
    banner(
      persp(v => (v === team ? 'WON THE DRAW' : 'LOST THE DRAW')),
      persp(v => (v === team ? 'small home low' : 'small away low')),
      persp(line),
    );
    G.bannerT = 1.4;
    // the guest checks this call against both times (and its own report)
    foCue({ id: fo.id, ph: 'result', w: team, rt: fo.rt, early: fo.early, claimed: fo.claimed ?? null });
    return;
  }
  if (!G.ai0) {
    if (team === 0) {
      S('win');
      banner('WON THE DRAW', 'small home low', rt !== null ? rt.toFixed(2) + 's reaction' : '');
    } else {
      S('lose');
      banner(
        'LOST THE DRAW',
        'small away low',
        G.fo.early ? '' : 'Too slow. CPU took ' + G.fo.cpu.toFixed(2) + 's',
      );
    }
    G.bannerT = 1.1;
  }
}
