import { PERIOD_LEN } from '../config';

// the referee skates with the play but never touches the puck or the players
export const ref = { x: 88, y: 131, vx: 0, vy: 0, fx: -1, fy: 0, anim: 0 };
export const puck = {
  x: 80,
  y: 128,
  z: 0,
  vx: 0,
  vy: 0,
  owner: null,
  passTo: null,
  lastTeam: 0,
  hard: false,
  gchk: null,
  miss: new Set(),
  trail: [],
};
export const parts = [];
export const REC = [],
  REC_MAX = 300,
  PF = 10;

export const G = {
  lastShooter: null,
  state: 'faceoff',
  demo: true,
  watch: false,
  ai0: true,
  score: [0, 0],
  period: 1,
  clock: PERIOD_LEN,
  timer: 0,
  controlled: null,
  switchLock: 0,
  charge: 0,
  charging: false,
  ignoreRelease: false,
  shake: 0,
  boardCd: 0,
  stepCd: 0,
  bannerT: 0,
  resume: null,
  padWorld: 0,
  goalRec: 0,
  practice: null,
  flash: 0,
  stillT: 0,
  hype: 0,
  fightP: 0.15,
  cam3: null,
  goalX: 80,
  goalFrame: 0,
  rp: null,
  lastNet: null,
  firstFO: false,
  hits: { down: 0, stumble: 0, bounce: 0 },
  fo: { phase: 'set', t: 0, setT: 1, wait: 1, cpu: 0.3, early: false },
};
