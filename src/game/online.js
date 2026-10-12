// Online play, the simulation's side of it (no networking in here; that is src/net/).
// One player hosts: their browser runs the whole match, exactly like a game against the CPU, except that team 1 is
// steered by the other player instead of the CPU. Team 0 is the host's, team 1 the guest's. The guest's browser
// runs no simulation; it shows the host's match from its own end of the rink (rotated half a turn, with the teams
// swapped, so both players attack upwards) and sends its stick and buttons back.
// A few things are decided by both sides instead of the host alone: each player times their own face-off reaction
// and drives their own resurfacer, and the other side checks the result (see states/faceoff.js, states/zamboni.js).
import { input } from '../input/state';
import { G } from './world';

/** The connection's hooks and the shared match facts. src/net/match.js fills in the functions. */
export const net = {
  /** both teams' player names, by team as the host sees them: [host, guest] */
  names: ['', ''],
  /** sends a message to the other player (null while not connected) */
  send: null,
  /** host: called before and after every simulation step */
  pre: null,
  post: null,
  /** guest: runs instead of the simulation step */
  guestStep: null,
  /** worst recent round trip to the other player, in seconds */
  rtt: 0.1,
  /** how far behind the newest frame the guest plays the host's match back, in seconds */
  playLag: 0.1,
  /** results this side checked and could not confirm (shown on the play-by-play and the results card) */
  disputes: 0,
  /** host: tell the guest the current state again (the replay angle changed) */
  stateDirty: false,
  /** leaving an online match from the menu, and asking for a rematch */
  onMenu: null,
  again: null,
};

/** The guest's stick and buttons as they arrive on the host, in the host's view of the rink. */
export const rinput = {
  jx: 0,
  jy: 0,
  aim: null,
  /** aiming with the mouse (shots go where the aim points) */
  mouseAim: false,
  touch: false,
  shootHeld: false,
  sp: false,
  sr: false,
  pp: false,
  swp: false,
};
/** Team 1's human seat on the host: the same fields G keeps for team 0's (controlled skater, shot wind-up). */
export const seat1 = { controlled: null, charge: 0, charging: false, ignoreRelease: false, switchLock: 0 };

/** The seat (controlled skater and wind-up) of team t: G itself for team 0. */
export const seat = t => (t ? seat1 : G);
/** Where team t's human input comes from. */
export const inputOf = t => (t ? rinput : input);
/** Whether a person steers team t in this match. */
export const humanTeam = t => (t === 0 ? !G.ai0 : G.net === 'host');
/** The skater a person steers on team t (null for a computer team). */
export const ctlOf = t => (humanTeam(t) ? seat(t).controlled : null);
export const isHuman = p => !!p && ctlOf(p.team) === p;
/** Team t is the computer opponent, the one the difficulty setting applies to. */
export const cpuSide = t => t === 1 && !G.ai0 && !G.net;
/** Whether skater p is the one the viewer on team v steers (for feedback such as rumble). */
export const mine = (p, v) => isHuman(p) && p.team === v;
/** A team's name for this screen: the players' names online. */
export const nameOf = t => (G.net === 'guest' ? net.names[1 - t] : net.names[t]);
/** Mirrors a host-side team index onto the guest's view (and back). */
export const other = t => (t === 0 || t === 1 ? 1 - t : t);

// A reaction faster than this is a guess, not a reaction: it counts as jumping the draw (the same rule both ways,
// and each side checks the other's time against it).
export const MIN_REACTION = 0.1;

/** Resets the human seats for a new match. */
export function resetSeats() {
  seat1.controlled = null;
  seat1.charge = 0;
  seat1.charging = false;
  seat1.ignoreRelease = false;
  seat1.switchLock = 0;
  for (const k of ['sp', 'sr', 'pp', 'swp', 'shootHeld', 'mouseAim', 'touch']) rinput[k] = false;
  rinput.jx = rinput.jy = 0;
  rinput.aim = null;
}
