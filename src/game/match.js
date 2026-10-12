import { rosterForMatch } from './lineup';
import { catchUp } from './ai/team';
import { clamp, dist, rnd } from '../core/math';
import { loadRec, saveRec } from '../core/storage';
import { clock } from '../core/time';
import { LABEL, ORD } from '../data/difficulty';
import { FIRE } from '../data/pucks';
import { COLORS } from '../data/teams';
import {
  S,
  audio,
  banner,
  bubble,
  feed,
  goalLamp,
  goalMusic,
  hideBanner,
  hud,
  netHit,
  resetDirector,
  resetSide,
  screen,
  setCrowd,
  showPad,
  showRec,
  showTab,
  startGoalFx,
  stopSong,
  vib,
  zoom,
} from './fx';
import { clearIceWear } from './iceWear';
import { kit } from './kit';
import { SK, players } from './players';
import { practiceGoal, resetRosterFlags } from './practice';
import { faceoff } from './states/faceoff';
import { endIntro, startIntro } from './states/intro';
import { startPost } from './states/post';
import { stopEngine } from './states/zamboni';
import { G, REC, parts, puck } from './world';
import { input } from '../input/state';
import { reduceMotion, settings } from '../settings';

/* ---------- flow ---------- */
export const freshStats = () => ({
  sog: [0, 0],
  saves: [0, 0],
  hits: [0, 0],
  fo: [0, 0],
  poss: [0, 0],
  /** goals per period, overtime last: the box score on the results card */
  gp: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
});
export function teamLabel(t) {
  return G.watch ? kit.TEAMS[t].name.toUpperCase() : t === 0 ? 'YOU' : 'CPU';
}
export function confetti(team) {
  const c = kit.TEAMS[team];
  if (c === COLORS.rainbow) return `hsl(${Math.floor(rnd(0, 360))},90%,60%)`;
  if (c === COLORS.inferno) return FIRE[Math.floor(rnd(0, 4))];
  return Math.random() < 0.5 ? c.main : c.trim;
}
export function goalScored(team, n) {
  const ix = clamp(puck.x, n.x0 + 3, n.x1 - 3);
  puck.owner = null;
  puck.vx = puck.vy = 0;
  puck.x = ix;
  puck.y = n.top ? n.y0 + 3 : n.y1 - 3;
  puck.trail.length = 0;
  netHit(n, ix, 1.5);
  startGoalFx(settings.puckKey, ix, puck.y, n.top);
  goalLamp({ n, until: clock.now + 3.2 });
  G.goalX = ix;
  G.goalFrame = REC.length;
  if (G.practice) {
    practiceGoal(team, n);
    return;
  }
  G.state = 'goal';
  G.charging = false;
  G.charge = 0;
  G.goalRec = 0.6;
  G.lastNet = n;
  G.lastTeam = team;
  if (G.demo) {
    G.timer = 1.4;
    return;
  }
  const behind = catchUp(1 - team);
  G.score[team]++;
  G.stats.sog[team]++; // every goal is a shot on goal
  G.stats.gp[team][Math.min(G.period, 4) - 1]++;
  // a computer team falling well behind changes its tactics: say so on the play-by-play
  const now = catchUp(1 - team);
  if (now > behind)
    feed(
      (G.watch ? teamLabel(1 - team) : 'CPU') +
        (now > 1 ? ' throws everything forward' : ' goes all out: pressing high, shooting from anywhere'),
      1 - team,
    );
  hud();
  G.timer = 1.8;
  if (team === 0 || G.watch) {
    S('horn');
    goalMusic(team);
  } else {
    S('groan');
    S('buzzer');
  }
  if (!G.ai0) vib(team === 0 ? [60, 40, 60, 40, 180] : [120]);
  // fights get likelier with every goal that passes without one, so they turn up about once a game (and never twice)
  G.brawlNext = false;
  if (!G.ai0 && team === 0 && settings.fightsOn && !G.fought) {
    if (Math.random() < G.fightP) {
      G.brawlNext = true;
      G.fightP = 0.1;
    } else G.fightP = Math.min(0.5, G.fightP + 0.12);
  }
  // a fight is brewing: the sore loser nearest the scorer lets off some (censored) steam, sometimes a teammate too
  if (G.brawlNext) {
    const sc = G.lastShooter && G.lastShooter.team === team ? G.lastShooter : SK[team][0],
      l = SK[1 - team].slice().sort((p, q) => dist(p, sc) - dist(q, sc));
    bubble(l[0], null, rnd(0.2, 0.6));
    if (Math.random() < 0.35) bubble(l[1], null, rnd(0.9, 1.4));
  }
  G.hype = team === 0 || G.watch ? 1 : 0.35;
  if (!reduceMotion) G.shake = 0.4;
  const scorer = G.lastShooter;
  banner(
    G.watch ? teamLabel(team) + ' SCORES' : team === 0 ? 'GOAL!' : 'CPU SCORES',
    team === 0 ? 'home' : 'away',
    scorer && scorer.team === team ? '#' + scorer.num + ' ' + scorer.name : '',
    true,
  );
  G.bannerT = 0;
  feed(
    'GOAL' +
      (scorer && scorer.team === team ? ' · ' + '#' + scorer.num + ' ' + scorer.name : '') +
      ' · ' +
      G.score[0] +
      '–' +
      G.score[1],
    team,
  );
  for (let i = 0; i < 46; i++)
    parts.push({
      x: 80,
      y: puck.y,
      vx: rnd(-90, 90),
      vy: rnd(-90, 90),
      life: rnd(0.6, 1.3),
      c: confetti(team),
    });
}

export function endPeriod() {
  S('buzzer');
  G.clock = 0;
  G.charging = false;
  G.charge = 0;
  G.zamNext = settings.zamOn && !G.ai0;
  if (G.period < 3) {
    banner('END OF ' + ORD[G.period], 'small', '');
    feed('END OF THE ' + ORD[G.period] + ' PERIOD');
    G.bannerT = 0;
    G.period++;
    G.clock = settings.periodLen;
    G.state = 'inter';
    G.timer = 2;
  } else if (G.score[0] === G.score[1]) {
    G.period = 4;
    G.state = 'inter';
    G.timer = 2.4;
    banner('OVERTIME', 'small', 'Next goal wins');
    feed('OVERTIME · next goal wins');
    G.bannerT = 0;
  } else endGame();
}
export function endGame() {
  feed('FINAL · ' + G.score[0] + '–' + G.score[1]);
  stopEngine();
  G.state = 'over';
  zoom(1);
  const w = G.score[0] > G.score[1] ? 0 : 1;
  startPost(w); // the winners celebrate behind the results card
  if (G.watch) {
    S('horn');
  } else if (w === 0) {
    S('organ');
    S('cheer');
  } else S('groan');
  setCrowd(0.015);
  let record;
  if (G.watch) record = 'CPU vs CPU exhibition. Your record is unchanged.';
  else {
    const r = loadRec();
    r[settings.diffKey] = r[settings.diffKey] || { w: 0, l: 0 };
    r[settings.diffKey][w === 0 ? 'w' : 'l']++;
    saveRec(r);
    record =
      'Record vs ' +
      LABEL[settings.diffKey] +
      ': ' +
      r[settings.diffKey].w +
      ' W – ' +
      r[settings.diffKey].l +
      ' L';
  }
  const title = G.watch ? teamLabel(w) + ' WINS' : w === 0 ? 'YOU WIN' : 'CPU WINS';
  // the results card (filled in now, shown after the result has had its moment)
  screen('over', {
    kicker:
      'FINAL' +
      (G.period > 3 ? ' / OT' : '') +
      (G.watch ? ' · EXHIBITION' : ' · ' + LABEL[settings.diffKey].toUpperCase()),
    title,
    winner: w,
    score: G.score[0] + ' – ' + G.score[1],
    record,
    again: G.watch ? 'WATCH AGAIN' : 'REMATCH',
  });
  banner(title, w === 0 ? 'home' : 'away', G.score[0] + ' – ' + G.score[1], true);
  showPad(false);
}
export function startGame(watch) {
  G.practice = null;
  G.post = null;
  G.aim = null;
  G.fought = false;
  resetRosterFlags();
  audio();
  G.demo = false;
  G.watch = !!watch;
  resetDirector();
  G.ai0 = G.watch;
  G.controlled = null;
  G.score = [0, 0];
  G.stats = freshStats();
  G.mom = null; // a boost from the last game does not carry over
  resetSide();
  G.period = 1;
  G.clock = settings.periodLen;
  G.ignoreRelease = false;
  screen('match', { watch: G.watch });
  rosterForMatch(); // the line-up you set (if you did), otherwise a fresh roster
  for (const p of players) {
    p.stride = p.lastStride = 0;
  }
  G.firstFO = true;
  G.fightP = 0.2;
  stopSong(0.2);
  clearIceWear();
  setCrowd(0.05);
  S('organ');
  showPad(!G.watch);
  hud();
  feed('PUCK DROP · ' + kit.TEAMS[0].name + ' vs ' + kit.TEAMS[1].name);
  startIntro(); // a short flight through the arena, then the opening face-off
}
export function toMenu() {
  stopEngine();
  showTab('play');
  G.practice = null;
  G.post = null;
  G.aim = null;
  resetRosterFlags();
  G.zam = null;
  clearIceWear();
  G.demo = true;
  G.watch = false;
  G.ai0 = true;
  G.controlled = null;
  G.score = [0, 0];
  G.mom = null;
  hideBanner();
  setCrowd(0);
  zoom(1);
  stopSong(0.3);
  screen('menu');
  showPad(false);
  showRec();
  hud();
  faceoff();
}
export function togglePause() {
  if (G.demo) return;
  // the arena intro is not paused: pause skips it, straight to the face-off
  if (G.state === 'intro') {
    endIntro();
    return;
  }
  if (G.state === 'paused') {
    G.state = G.resume;
    screen('pause', false);
    setCrowd(0.05);
  } else if (G.state !== 'over') {
    G.resume = G.state;
    G.state = 'paused';
    screen('pause', true);
    setCrowd(0.012);
    input.shootHeld = false;
    G.charging = false;
    G.charge = 0;
  }
}
