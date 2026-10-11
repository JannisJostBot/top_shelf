import { PERIOD_LEN } from '../config';

// the referee skates with the play but never touches the puck or the players
export const ref = { x: 88, y: 131, vx: 0, vy: 0, fx: -1, fy: 0, anim: 0 };
export const puck = {
  x: 80,
  y: 128,
  z: 0,
  vx: 0,
  vy: 0,
  /** the skater or goalie carrying the puck, the intended receiver of a pass, the goalie who last tried to stop it */
  owner: /** @type {any} */ (null),
  passTo: /** @type {any} */ (null),
  lastTeam: 0,
  hard: false,
  gchk: /** @type {any} */ (null),
  miss: new Set(),
  trail: [],
};
export const parts = [];
export const REC = [],
  REC_MAX = 300,
  PF = 10;

export const G = {
  /** per team: shots on goal (goals + saves) and saves made, reset each match */
  stats: { sog: [0, 0], saves: [0, 0], hits: [0, 0], fo: [0, 0], poss: [0, 0] },
  lastShooter: /** @type {any} */ (null),
  state: 'faceoff',
  demo: true,
  watch: false,
  ai0: true,
  score: [0, 0],
  period: 1,
  clock: PERIOD_LEN,
  timer: 0,
  controlled: /** @type {any} */ (null),
  switchLock: 0,
  charge: 0,
  charging: false,
  ignoreRelease: false,
  shake: 0,
  boardCd: 0,
  stepCd: 0,
  bannerT: 0,
  resume: /** @type {any} */ (null),
  padWorld: 0,
  goalRec: 0,
  practice: /** @type {any} */ (null),
  flash: 0,
  stillT: 0,
  holdT: 0, // seconds the puck carrier has stood still
  holder: /** @type {any} */ (null),
  /** a team's speed boost after a won fight or good resurfacing: { team, t, dur, src } */
  mom: /** @type {any} */ (null),
  /** the resurfacer minigame while it runs */
  zam: /** @type {any} */ (null),
  hype: 0,
  fightP: 0.15,
  /** whether this match has had its fight (there is at most one per match) */
  fought: false,
  /** the aim trainer while it runs: seconds left, where the gap in the board is, the shooting spot */
  aim: /** @type {any} */ (null),
  cam3: /** @type {any} */ (null),
  goalX: 80,
  goalFrame: 0,
  rp: /** @type {any} */ (null),
  lastNet: /** @type {any} */ (null),
  firstFO: false,
  hits: { down: 0, stumble: 0, bounce: 0 },
  fo: { phase: 'set', t: 0, setT: 1, wait: 1, cpu: 0.3, early: false },
};
