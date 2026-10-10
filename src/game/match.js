import { audio } from '../audio/engine';
import { resetDirector } from '../render/director';
import { startGoalFx } from '../render/goalFx';
import { goalMusic, stopSong } from '../audio/music';
import { S } from '../audio/sfx';
import { setCrowd } from '../audio/voices';
import { $ } from '../core/dom';
import { clamp, rnd } from '../core/math';
import { loadRec, saveRec } from '../core/storage';
import { clock } from '../core/time';
import { LABEL, ORD } from '../data/difficulty';
import { FIRE } from '../data/pucks';
import { COLORS } from '../data/teams';
import { clearIceWear } from './iceWear';
import { kit } from './kit';
import { SK, genRoster, players } from './players';
import { practiceGoal, resetRosterFlags } from './practice';
import { faceoff } from './states/faceoff';
import { stopEngine } from './states/zamboni';
import { G, REC, parts, puck } from './world';
import { vib } from '../input/haptics';
import { input } from '../input/state';
import { knobAt, pad, touchState } from '../input/touch';
import { fit } from '../render/camera';
import { view } from '../render/canvas';
import { bubble } from '../render/effects';
import { netHit } from '../render/net';
import { reduceMotion, settings } from '../settings';
import { banner, hideBanner, hud, showRec } from '../ui/hud';
import { showTab } from '../ui/menu';

/* ---------- flow ---------- */
function teamLabel(t) {
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
  view.lamp = { n, until: clock.now + 3.2 };
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
  G.score[team]++;
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
  // the team that conceded lets off some (censored) steam
  if ((G.watch || team === 0) && Math.random() < 0.55) {
    const l = SK[1 - team].slice().sort(() => Math.random() - 0.5);
    bubble(l[0], null, rnd(0.2, 0.6));
    if (Math.random() < 0.35) bubble(l[1], null, rnd(0.9, 1.4));
  }
  // fights get likelier with every goal that passes without one, so they turn up about once a game
  G.brawlNext = false;
  if (!G.ai0 && team === 0 && settings.fightsOn) {
    if (Math.random() < G.fightP) {
      G.brawlNext = true;
      G.fightP = 0.1;
    } else G.fightP = Math.min(0.5, G.fightP + 0.12);
  }
  G.hype = team === 0 || G.watch ? 1 : 0.35;
  if (!reduceMotion) G.shake = 0.4;
  const scorer = G.lastShooter;
  banner(
    G.watch ? teamLabel(team) + ' SCORES' : team === 0 ? 'GOAL!' : 'CPU SCORES',
    team === 0 ? 'home' : 'away',
    scorer && scorer.team === team ? '#' + scorer.num + ' ' + scorer.name : '',
  );
  G.bannerT = 0;
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
    G.bannerT = 0;
  } else endGame();
}
export function showPad(on) {
  touchState.padWanted = on;
  pad.hidden = !(on && touchState.touchUI);
  if (!on) {
    touchState.stickId = null;
    input.touch = false;
    input.tx = input.ty = 0;
    input.shootHeld = false;
    knobAt(0, 0);
  }
  fit();
}
export function endGame() {
  stopEngine();
  G.state = 'over';
  hideBanner();
  $('rpBar').hidden = true;
  $('pcard').hidden = true;
  view.camZ = 1;
  const w = G.score[0] > G.score[1] ? 0 : 1;
  if (G.watch) {
    S('horn');
  } else if (w === 0) {
    S('organ');
    S('cheer');
  } else S('groan');
  setCrowd(0.015);
  $('overK').textContent =
    'FINAL' +
    (G.period > 3 ? ' / OT' : '') +
    (G.watch ? ' · EXHIBITION' : ' · ' + LABEL[settings.diffKey].toUpperCase());
  $('overT').textContent = G.watch ? teamLabel(w) + ' WINS' : w === 0 ? 'YOU WIN' : 'CPU WINS';
  $('overT').style.color = w === 0 ? 'var(--home-ui)' : 'var(--away-ui)';
  $('overS').textContent = G.score[0] + ' – ' + G.score[1];
  if (G.watch) {
    $('overR').textContent = 'CPU vs CPU exhibition. Your record is unchanged.';
  } else {
    const r = loadRec();
    r[settings.diffKey] = r[settings.diffKey] || { w: 0, l: 0 };
    r[settings.diffKey][w === 0 ? 'w' : 'l']++;
    saveRec(r);
    $('overR').textContent =
      'Record vs ' +
      LABEL[settings.diffKey] +
      ': ' +
      r[settings.diffKey].w +
      ' W – ' +
      r[settings.diffKey].l +
      ' L';
  }
  $('againBtn').textContent = G.watch ? 'WATCH AGAIN' : 'REMATCH';
  $('overOv').hidden = false;
  showPad(false);
  $('pauseBtn').disabled = true;
}
export function startGame(watch) {
  G.practice = null;
  resetRosterFlags();
  audio();
  G.demo = false;
  G.watch = !!watch;
  resetDirector();
  G.ai0 = G.watch;
  G.controlled = null;
  G.score = [0, 0];
  G.period = 1;
  G.clock = settings.periodLen;
  G.ignoreRelease = false;
  $('menu').hidden = true;
  $('overOv').hidden = true;
  $('pauseOv').hidden = true;
  $('pauseBtn').disabled = false;
  $('nm0').textContent = teamLabel(0);
  $('nm1').textContent = teamLabel(1);
  genRoster();
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
  faceoff();
}
export function toMenu() {
  stopEngine();
  showTab('play');
  G.practice = null;
  resetRosterFlags();
  G.zam = null;
  clearIceWear();
  G.demo = true;
  G.watch = false;
  G.ai0 = true;
  G.controlled = null;
  G.score = [0, 0];
  hideBanner();
  setCrowd(0);
  $('nm0').textContent = 'YOU';
  $('nm1').textContent = 'CPU';
  $('rpBar').hidden = true;
  view.camZ = 1;
  stopSong(0.3);
  $('pcard').hidden = true;
  $('overOv').hidden = true;
  $('pauseOv').hidden = true;
  $('menu').hidden = false;
  $('pauseBtn').disabled = true;
  showPad(false);
  showRec();
  hud();
  faceoff();
}
export function togglePause() {
  if (G.demo) return;
  if (G.state === 'paused') {
    G.state = G.resume;
    $('pauseOv').hidden = true;
    setCrowd(0.05);
  } else if (G.state !== 'over') {
    G.resume = G.state;
    G.state = 'paused';
    $('pauseOv').hidden = false;
    setCrowd(0.012);
    input.shootHeld = false;
    G.charging = false;
    G.charge = 0;
  }
}
export function initMatch() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !G.demo && G.state !== 'paused' && G.state !== 'over') togglePause();
  });
}
