// Online matches over the link in net/session.js.
// Host: runs the match (game/), takes the guest's stick and buttons, and 30 times a second sends a frame: a
// snapshot of the rink, the events of those steps (sounds, banners, the play-by-play…) and any change of state.
// Frames with events or a state go over the reliable channel, plain snapshots over the fast one (net/session.js);
// the guest's stick goes over the fast one too, each packet repeating the three before it, so one lost packet
// loses no button press.
// Guest: runs no simulation. It plays the frames back a little behind (net/buffer.js), blended between snapshots and
// mirrored into its own view, times its own face-offs, drives its own resurfacer, and checks what it can: each
// goal against where it saw the puck, each face-off call against both times, the resurfacing call against the
// host's path. What does not add up is noted on the play-by-play and the results card.
import { NETS, STEP } from '../config';
import { emit } from '../core/events';
import { clamp } from '../core/math';
import { clock } from '../core/time';
import { FACEV } from '../data/faces';
import { PUCKS } from '../data/pucks';
import { STADIUMS } from '../data/stadiums';
import { STICKS } from '../data/sticks';
import { COLORS } from '../data/teams';
import { scuff, clearIceWear } from '../game/iceWear';
import { kit } from '../game/kit';
import { freshStats, startGame, toMenu, togglePause } from '../game/match';
import { MIN_REACTION, net, rinput } from '../game/online';
import {
  endReplay,
  nextAngle,
  recFrame,
  replayStep,
  startReplay,
  beginAngle,
  voteFight,
  ANGLES,
} from '../game/replay';
import { EMOTES } from '../data/emotes';
import { endCelebration } from '../game/states/celebrate';
import { endIntro } from '../game/states/intro';
import { foReport } from '../game/states/faceoff';
import { dropped, duelist } from '../game/states/brawl';
import { SK, players } from '../game/players';
import { stepParts } from '../game/update';
import { G, PF, REC, parts, puck } from '../game/world';
import {
  S,
  banner,
  clothStep,
  feed,
  hideBanner,
  hud,
  hudClock,
  resetDirector,
  resetSide,
  screen,
  setRelay,
  showPad,
  strideSounds,
  uiShow,
  updCam,
  zoom,
} from '../game/fx';
import {
  onZamResult,
  startZamboni,
  stopEngine,
  zamRemote,
  zamRemoteDone,
  zamRemoteHorn,
  zamStep,
  zamVerify,
} from '../game/states/zamboni';
import { input, mouse, readStick } from '../input/state';
import { reduceMotion, settings } from '../settings';
import { applyColors, setArena, setPuck, setStick } from '../ui/customize';
import { refreshVote, showEmote } from '../ui/emotes';
import { PERIOD_LENGTHS, setPeriodLen } from '../ui/menu';
import {
  bucket,
  decodeEvent,
  IN_KEEP,
  encodeArg,
  fin,
  isColor,
  mirrorIdx,
  otherTeam,
  packInput,
  readConfig,
  readInputs,
  readReport,
  readZamPos,
  relayed,
} from './proto';
import { addFrame, advance, frameBuffer, nextFrame } from './buffer';
import { predict, resetPrediction } from './predict';
import { SCORE_AT, applySnap, packSnap, snapOk } from './snap';
import * as session from './session';

const LOST_MS = 30000; // a dropped connection gets this long to come back
const STATES = [
  'intro',
  'faceoff',
  'play',
  'goal',
  'inter',
  'celebrate',
  'replay',
  'brawl',
  'zamboni',
  'paused',
  'over',
];
const refs = { players, nets: NETS };
const known = {
  colors: COLORS,
  sticks: STICKS,
  arenas: STADIUMS,
  pucks: PUCKS,
  lengths: PERIOD_LENGTHS,
  faces: Object.keys(FACEV),
};

/** The online page's callbacks (ui/online.js): status(text), code(code), lobby(), error(text), ended(text), again(state). */
let ui = {};
const mp = {
  inMatch: false,
  /** the guest's jersey and sticks (host) */
  guestKit: null,
  /** rematch wanted: [this side, the other side] */
  again: [false, false],
  /** the settings a match changed, put back afterwards */
  saved: null,
  lostTimer: 0,
  leaving: false,
  /** the match's number (bumped by the host for each one), so a late packet from the last one is not taken in */
  g: 0,
};

/* ---------- starting and leaving ---------- */
function events() {
  return {
    code: c => ui.code && ui.code(c),
    status: t => ui.status && ui.status(t),
    connected: peer => {
      net.names = session.link.role === 'host' ? [session.link.me, peer] : [peer, session.link.me];
      net.send = session.send;
      // tell the host which jersey and sticks to wear (the host picks a different jersey if they clash)
      if (session.link.role === 'guest')
        session.send({ t: 'me', color: settings.colorKey, stick: settings.sticks[0] });
      if (ui.lobby) ui.lobby();
    },
    message: onMessage,
    lost: onLost,
    back: onBack,
    rtt: s => (net.rtt = clamp(s, 0.02, 0.6)),
    error: t => {
      endMatch();
      if (ui.error) ui.error(t);
    },
  };
}
export async function hostOnline(name, callbacks) {
  ui = callbacks;
  mp.guestKit = null;
  mp.again = [false, false];
  await session.host(name, events());
}
export async function joinOnline(code, name, callbacks) {
  ui = callbacks;
  mp.again = [false, false];
  await session.join(code, name, events());
}
export const onlineLink = () => session.link;
/** Leaves for good (both rooms); the other player is told. */
export function leaveOnline() {
  if (mp.leaving) return;
  mp.leaving = true;
  session.send({ t: 'bye' });
  session.leaveSoon(); // (a moment for the goodbye to go out before the connection closes)
  endMatch();
  mp.leaving = false;
}
/** Back to single-player: hooks off, the settings the match borrowed put back. */
function endMatch() {
  clearTimeout(mp.lostTimer);
  setRelay(null);
  net.pre = net.post = net.guestStep = null;
  net.send = null;
  resetVote();
  mp.inMatch = false;
  restoreSettings();
  if (G.net) {
    mp.leaving = true;
    try {
      toMenu();
    } finally {
      mp.leaving = false;
    }
  }
}
net.onMenu = () => {
  // the menu (or quit) during an online match: leave the room, the other player is told
  if (mp.leaving) return;
  session.send({ t: 'bye' });
  session.leaveSoon();
  setRelay(null);
  net.pre = net.post = net.guestStep = null;
  net.send = null;
  resetVote();
  mp.inMatch = false;
  clearTimeout(mp.lostTimer);
  restoreSettings();
  if (ui.ended) ui.ended('');
};
function saveSettings() {
  if (mp.saved) return;
  mp.saved = {
    colorKey: settings.colorKey,
    cpuKey: settings.cpuKey,
    sticks: settings.sticks.slice(),
    stadiumKey: settings.stadiumKey,
    puckKey: settings.puckKey,
    periodLen: settings.periodLen,
  };
}
function restoreSettings() {
  const s = mp.saved;
  if (!s) return;
  mp.saved = null;
  settings.colorKey = s.colorKey;
  settings.cpuKey = s.cpuKey;
  setStick(0, s.sticks[0]);
  setStick(1, s.sticks[1]);
  if (settings.stadiumKey !== s.stadiumKey) setArena(s.stadiumKey, false);
  setPuck(s.puckKey);
  setPeriodLen(s.periodLen);
  applyColors();
}

/* ---------- messages ---------- */
const inputBurst = bucket(130, 40),
  ctlBurst = bucket(4, 4),
  zamBurst = bucket(60, 30),
  voteBurst = bucket(4, 6),
  emoBurst = bucket(1.5, 3);
function onMessage(m, fast) {
  const host = session.link.role === 'host';
  switch (m.t) {
    case 'me':
      if (
        host &&
        typeof m.color === 'string' &&
        Object.hasOwn(COLORS, m.color) &&
        typeof m.stick === 'string' &&
        Object.hasOwn(STICKS, m.stick)
      )
        mp.guestKit = { color: m.color, stick: m.stick };
      return;
    case 'bye':
      return peerLeft();
    case 'again':
      return wantAgain(1);
    case 'cfg':
      if (!host) guestStart(m);
      return;
    case 'f':
      if (!host && mp.inMatch) guestFrame(m, fast);
      return;
    case 'i':
      if (host && mp.inMatch && inputBurst.take()) hostInput(m);
      return;
    case 'rt': {
      const r = host && mp.inMatch && readReport(m);
      if (r) foReport(r.id, r.early, r.rt);
      return;
    }
    case 'skip':
      if (!host || !mp.inMatch || !ctlBurst.take()) return;
      if (G.state === 'replay') endReplay();
      else if (G.state === 'celebrate') endCelebration();
      else if (G.state === 'intro') endIntro();
      return;
    case 'angle':
      if (host && mp.inMatch && ctlBurst.take()) nextAngle();
      return;
    case 'pause':
      // (not resumed from the other side while this tab is hidden: the match only runs while it is shown)
      if (!host || !mp.inMatch || !ctlBurst.take() || G.state === 'over') return;
      if (G.state === 'paused' && document.hidden) return;
      togglePause(1);
      return;
    case 'zp': {
      const p = mp.inMatch && zamBurst.take() && readZamPos(m);
      if (p) zamRemote(p);
      return;
    }
    case 'zh':
      if (mp.inMatch && ctlBurst.take()) zamRemoteHorn();
      return;
    case 'zd':
      if (mp.inMatch && Number.isInteger(m.n) && m.n >= 0 && m.n < 5000) zamRemoteDone(m.n);
      return;
    case 'vote':
      if (host && mp.inMatch && voteBurst.take()) voteFight(1, m.on === true);
      return;
    case 'fv':
      if (!host && mp.inMatch) guestVote(m);
      return;
    case 'emo':
      if (mp.inMatch && typeof m.k === 'string' && Object.hasOwn(EMOTES, m.k) && emoBurst.take())
        showEmote(m.k, false);
      return;
  }
}
function peerLeft() {
  const name = session.link.peer || 'The other player';
  buf.q.length = 0; // (the guest's screen stops where it is)
  // on the results card: it stays up (no rematch now); back to the program is this player's own click
  if (mp.inMatch && G.state === 'over') {
    session.leave();
    if (ui.gone) ui.gone(name);
    return;
  }
  if (mp.inMatch) {
    banner(name + ' LEFT', 'small away', 'The match is over');
    G.bannerT = 2.4;
  }
  session.leave();
  setTimeout(
    () => {
      endMatch();
      if (ui.ended) ui.ended(name + ' left.');
    },
    mp.inMatch ? 2200 : 0,
  );
}
function onLost() {
  const name = session.link.peer;
  if (mp.inMatch) {
    if (G.net === 'host' && G.state !== 'paused' && G.state !== 'over') togglePause(-1);
    banner('CONNECTION LOST', 'small away', 'Waiting for ' + name + '…');
    G.bannerT = 0;
  } else if (ui.status) ui.status('Lost the connection to ' + name + '. Waiting for them to come back…');
  clearTimeout(mp.lostTimer);
  mp.lostTimer = setTimeout(() => {
    session.leave();
    endMatch();
    if (ui.ended) ui.ended('Lost the connection to ' + name + '.');
  }, LOST_MS);
}
function onBack() {
  clearTimeout(mp.lostTimer);
  if (mp.inMatch) {
    hideBanner();
    if (G.net === 'guest') guestResync();
  } else if (ui.lobby) ui.lobby();
}

/* ---------- rematch ---------- */
net.again = () => wantAgain(0);
function wantAgain(side) {
  if (!session.link.connected || mp.again[side]) return;
  mp.again[side] = true;
  if (side === 0) session.send({ t: 'again' });
  else if (G.state === 'over') feed(session.link.peer + ' wants a rematch');
  if (ui.again) ui.again(mp.again);
  if (mp.again[0] && mp.again[1] && session.link.role === 'host') hostStart();
}

/* ---------- the fight vote and emotes (during replays) ---------- */
// The host keeps the votes (game/replay.js) and tells the guest whenever they change; the guest shows its own
// vote at once and takes the host's word for the other one. Emotes go straight to the other player.
let voteKey = '',
  voteN = 0,
  myVoteAt = -Infinity;
function resetVote() {
  net.vote = { open: false, v: [false, false] };
  voteKey = '';
  voteN = 0;
}
net.castVote = on => {
  if (G.net === 'host') voteFight(0, on);
  else if (G.net === 'guest' && net.vote.open) {
    net.vote.v[0] = !!on;
    myVoteAt = performance.now();
    session.send({ t: 'vote', on: !!on });
  }
};
net.emote = k => session.send({ t: 'emo', k });
/** Host: the votes of the replay on screen, sent to the guest when they change (the replay's number tells a new
 * vote from an old one). */
function hostVote() {
  const rp = G.state === 'replay' && G.rp && G.rp.votes ? G.rp : null,
    v = rp ? rp.votes : [false, false],
    k = (rp ? rp.n : 0) + ':' + +v[0] + +v[1];
  if (k === voteKey) return;
  voteKey = k;
  net.vote = { open: !!rp, v: [v[0], v[1]] };
  refreshVote();
  session.send({ t: 'fv', n: rp ? rp.n : 0, v: [v[0], v[1]] });
}
function guestVote(m) {
  if (!Number.isInteger(m.n) || m.n < 0 || !Array.isArray(m.v) || m.v.length !== 2) return;
  if (m.n !== voteN) {
    voteN = m.n;
    net.vote.v[0] = false;
  }
  net.vote.open = m.n > 0;
  net.vote.v[1] = m.v[0] === true;
  // this player's own vote as the host has it, unless a click of theirs is still on its way
  if (performance.now() - myVoteAt > 1500) net.vote.v[0] = m.v[1] === true;
  refreshVote();
}

/* ---------- host ---------- */
let hostT = 0,
  tick = 0,
  lastSt = '',
  ack = -1, // the guest's newest input step the match has taken (sent back for its prediction, net/predict.js)
  lastIn = 0, // the guest's newest input step that came in
  relN = 0, // frames sent over the reliable channel
  outEvents = [],
  outParts = [];
const inq = [];
/** Host: starts the match (from the online page's ticket, or a rematch both wanted). */
export function hostStart() {
  if (session.link.role !== 'host' || !session.link.connected) return;
  saveSettings();
  mp.again = [false, false];
  if (ui.again) ui.again(mp.again);
  // the guest wears their own jersey (or, if it is the same as the host's, one that contrasts)
  const gk = mp.guestKit || { color: 'red', stick: 'wood' };
  settings.cpuKey = gk.color;
  applyColors();
  setStick(1, gk.stick);
  setRelay(relay);
  net.pre = hostPre;
  net.post = hostPost;
  net.send = session.send;
  hostT = tick = 0;
  lastSt = '';
  ack = -1;
  lastIn = 0;
  relN = 0;
  mp.g = (mp.g + 1) % 1e6;
  outEvents = [];
  outParts = [];
  inq.length = 0;
  resetVote();
  mp.inMatch = true;
  startGame(false, true);
  for (const p of parts) p.$s = 1;
  const keyOf = c => Object.keys(COLORS).find(k => COLORS[k] === c);
  session.send({
    t: 'cfg',
    g: mp.g,
    names: net.names,
    colors: [keyOf(kit.TEAMS[0]), keyOf(kit.TEAMS[1])],
    sticks: settings.sticks.slice(),
    arena: settings.stadiumKey,
    puck: settings.puckKey,
    len: settings.periodLen,
    style: settings.cpuStyle,
    cel: settings.celOn,
    zam: settings.zamOn,
    roster: players.map(p => ({ name: p.name, num: p.num, slot: p.slot, st: p.st, look: p.look })),
  });
}
function relay(name, args) {
  if (!relayed(name, args) || outEvents.length >= 96) return;
  // the goal lamp's time is this screen's clock: send how long it stays on instead
  if (name === 'goalLamp' && args[0]) args = [{ n: args[0].n, dt: Math.max(0, args[0].until - clock.now) }];
  outEvents.push([name, args.map(a => encodeArg(a, refs))]);
}
onZamResult(res => {
  if (G.net === 'host') outEvents.push(['zamRes', [encodeArg(res, refs)]]);
});
function hostInput(m) {
  if (m.g !== mp.g) return;
  const pks = readInputs(m.a, m.n, lastIn);
  if (!pks) return;
  for (const pk of pks) inq.push(pk);
  if (pks.length) lastIn = pks[pks.length - 1].n;
  // how far behind the guest plays the match back (the fight's grace for a block, states/brawl.js)
  if (Number.isInteger(m.l) && m.l >= 0 && m.l <= 300) net.playLag = m.l / 1000;
  // never more than a few behind: older packets are folded together (their button presses kept)
  while (inq.length > 4) {
    const o = inq.shift();
    for (const k of ['sp', 'sr', 'pp', 'swp']) inq[0][k] = inq[0][k] || o[k];
  }
}
/** Before each step: the next of the guest's input packets (one per step, so presses keep their timing). */
function hostPre() {
  const pk = inq.shift();
  if (!pk) return;
  rinput.jx = pk.jx;
  rinput.jy = pk.jy;
  rinput.aim = pk.aim;
  rinput.mouseAim = pk.mouseAim;
  rinput.touch = pk.touch;
  rinput.shootHeld = pk.shootHeld;
  if (pk.n > ack) ack = pk.n;
  for (const k of ['sp', 'sr', 'pp', 'swp']) if (pk[k]) rinput[k] = true;
}
const r2 = v => Math.round(v * 100) / 100;
/** What the guest needs to know about a new state besides its name. */
function stateMsg(s) {
  const m = { s };
  if (s === 'faceoff') m.id = G.fo.id || 0;
  else if (s === 'goal') Object.assign(m, { n: NETS.indexOf(G.lastNet), x: r2(G.goalX), team: G.lastTeam });
  else if (s === 'celebrate' && G.cel)
    Object.assign(m, { team: G.cel.team, mx: r2(G.cel.meet.x), my: r2(G.cel.meet.y), type: G.cel.type });
  else if (s === 'replay') m.a = ANGLES.indexOf(G.rp.angle);
  else if (s === 'brawl' && G.br && G.br.duel)
    Object.assign(m, {
      a: players.indexOf(G.br.a),
      b: players.indexOf(G.br.b),
      mx: r2(G.br.m.x),
      my: r2(G.br.m.y),
      at: G.br.at.map(r2),
    });
  else if (s === 'over' && G.post)
    Object.assign(m, { w: G.post.winner, mx: r2(G.post.meet.x), my: r2(G.post.meet.y) });
  else if (s === 'paused') m.r = G.resume;
  return m;
}
/** After each step: every other step (or at once when the state changed) a frame goes to the guest. */
function hostPost(dt, force) {
  hostT += dt;
  hostVote();
  let st = null;
  if (G.state !== lastSt || net.stateDirty) {
    st = stateMsg(G.state);
    lastSt = G.state;
    net.stateDirty = false;
  }
  for (const p of parts)
    if (!p.$s) {
      p.$s = 1;
      // (the guest films its own replays)
      if (G.state !== 'replay' && outParts.length < 40 && isColor(p.c))
        outParts.push([r2(p.x), r2(p.y), r2(p.vx), r2(p.vy), r2(p.life), p.c]);
    }
  if (++tick % 2 && !st && !force) return;
  const f = { t: 'f', g: mp.g, ts: Math.round(hostT * 1000) / 1000, s: packSnap(), r: relN };
  if (ack > 0) f.n = ack;
  if (outParts.length) f.pt = outParts;
  outParts = [];
  // events and states must arrive (numbered, so the snapshots after them wait for them); a snapshot alone is
  // replaced by the next one 33 ms later, so a lost one is not sent again
  if (st || outEvents.length) {
    if (st) f.st = st;
    if (outEvents.length) f.ev = outEvents;
    outEvents = [];
    f.r = ++relN;
    session.send(f);
  } else session.sendFast(f);
}

/* ---------- guest ---------- */
let buf = frameBuffer(),
  playT = null,
  inSeq = 0, // this screen's input steps, numbered (see net/predict.js)
  sentIn = [], // the last few input packets sent, newest first (each packet repeats them)
  fo = null,
  goalRec = 0,
  skipAsked = '';
function guestStart(m) {
  const c = readConfig(m, known);
  if (!c) return;
  saveSettings();
  mp.g = Number.isInteger(m.g) ? m.g : 0;
  net.names = c.names;
  // this screen is the host's match from the other end: the guest's team is team 0 here
  settings.colorKey = c.colors[1];
  settings.cpuKey = c.colors[0];
  setStick(0, c.sticks[1]);
  setStick(1, c.sticks[0]);
  if (settings.stadiumKey !== c.arena) setArena(c.arena, false);
  setPuck(c.puck);
  setPeriodLen(c.len);
  c.roster.forEach((r, i) => Object.assign(players[mirrorIdx(i)], r));
  for (const t of [0, 1]) SK[t].sort((a, b) => 'CWD'.indexOf(a.slot) - 'CWD'.indexOf(b.slot));
  applyColors();
  mp.again = [false, false];
  if (ui.again) ui.again(mp.again);
  // the match, as far as this screen keeps it
  Object.assign(G, {
    net: 'guest',
    demo: false,
    watch: false,
    ai0: false,
    practice: null,
    post: null,
    aim: null,
    rp: null,
    cel: null,
    zam: null,
    zam2: null,
    br: null,
    score: [0, 0],
    stats: freshStats(),
    mom: null,
    period: 1,
    clock: c.len,
    // (the host's match opens with the arena intro; until its first frame is here, so does this screen)
    state: reduceMotion ? 'inter' : 'intro',
    intro: reduceMotion ? null : { t: 0, t0: clock.now, key: c.arena },
    controlled: null,
    charge: 0,
    charging: false,
  });
  net.disputes = 0;
  net.send = session.send;
  net.guestStep = guestStep;
  resetVote();
  buf = frameBuffer();
  net.playLag = buf.lag;
  playT = null;
  frameScore = -1;
  goalSince = false;
  inSeq = 0;
  sentIn = [];
  resetPrediction();
  fo = null;
  REC.length = 0;
  parts.length = 0;
  mp.inMatch = true;
  resetDirector();
  resetSide();
  clearIceWear();
  screen('match', { watch: false });
  showPad(true);
  hud();
}
/** After a dropped connection came back: catch up with the newest frame instead of replaying the gap. */
function guestResync() {
  playT = null;
}
function guestFrame(m, fast) {
  if (m.g !== mp.g || !fin(m.ts) || m.ts < 0 || !Number.isInteger(m.r) || m.r < 0 || !snapOk(m.s)) return;
  const essential = m.st !== undefined || m.ev !== undefined;
  // (events and states only count from the reliable channel)
  if (essential && fast) return;
  if (m.ev !== undefined && (!Array.isArray(m.ev) || m.ev.length > 128)) return;
  if (m.pt !== undefined && (!Array.isArray(m.pt) || m.pt.length > 64)) return;
  if (m.st !== undefined && (!m.st || !STATES.includes(m.st.s))) return;
  if (m.n !== undefined && !(Number.isInteger(m.n) && m.n > 0)) return;
  const got = addFrame(buf, m, essential, performance.now() / 1000);
  net.playLag = buf.lag;
  // (it waited too long: the screen has moved on, but what happened in it still counts)
  if (got === 'late') playFrame(m, true, true);
  // far behind (this tab was in the background): the old frames are applied at once, silently
  while (buf.q.length > 600) {
    const n = nextFrame(buf, Infinity);
    if (n) playFrame(n.f, true, false, n.early);
  }
}
// events that only make sense live (a sound from twenty seconds ago is noise)
const LIVE_ONLY = new Set([
  'sound',
  'haptic',
  'pop',
  'ring',
  'bubble',
  'netHit',
  'goalFx',
  'goalLamp',
  'flash',
  'chime',
]);
// Each frame's score against the one before, in order (so a guest catching up after a stall, which skips through
// many frames at once, still sees the goal state that came with each change of score).
// (late: a reliable frame that came after newer snapshots were shown; early: a snapshot shown without a reliable
// frame before it, which may still come. Neither is checked, and after an early one the check starts afresh.)
let frameScore = -1,
  goalSince = false;
function playFrame(f, stale, late = false, early = false) {
  if (f.st) guestState(f.st);
  if (early) frameScore = -1;
  else if (!late) {
    if (f.st && f.st.s === 'goal') goalSince = true;
    const sc = f.s[SCORE_AT] + f.s[SCORE_AT + 1];
    if (frameScore >= 0 && sc > frameScore) {
      // a goal counted without a goal being scored
      if (!goalSince) dispute('a change to the score');
      goalSince = false;
    }
    frameScore = sc;
  }
  if (f.ev)
    for (const e of f.ev) {
      const d = decodeEvent(e, refs);
      if (d && !(stale && LIVE_ONLY.has(d[0]))) fire(d[0], d[1]);
    }
  if (f.pt && !stale)
    for (const p of f.pt)
      if (
        Array.isArray(p) &&
        p.length === 6 &&
        p.slice(0, 5).every(fin) &&
        isColor(p[5]) &&
        parts.length < 600
      )
        parts.push({ x: 160 - p[0], y: 256 - p[1], vx: -p[2], vy: -p[3], life: Math.min(2, p[4]), c: p[5] });
}
function fire(name, args) {
  switch (name) {
    case 'goalLamp':
      emit(name, args[0] ? { n: args[0].n, until: clock.now + args[0].dt } : null);
      return;
    case 'foCue':
      guestFoCue(args[0]);
      return;
    case 'zamRes': {
      const r = args[0];
      if (
        !r ||
        !Array.isArray(r.p) ||
        r.p.length !== 2 ||
        !r.p.every(v => Number.isInteger(v) && v >= 0 && v <= 100)
      )
        return;
      if (!Number.isInteger(r.w) || r.w < -1 || r.w > 1 || !Number.isInteger(r.hostN)) return;
      if (!zamVerify(r)) dispute('the resurfacing result');
      return;
    }
    case 'zoom':
      if (G.state === 'replay' || G.state === 'brawl') return; // the replay and the fight here set their own
      break;
    case 'screen':
      if (args[0] === 'over') args[1].record = disputeLine();
      break;
  }
  emit(name, ...args);
}
function disputeLine() {
  return net.disputes
    ? 'This screen could not confirm ' +
        net.disputes +
        (net.disputes === 1 ? ' call' : ' calls') +
        ' (see the play-by-play).'
    : 'Online match. Every face-off, goal and resurfacing checked out on this screen.';
}
function dispute(what) {
  net.disputes++;
  feed('Could not confirm ' + what + ' on this screen', -1);
}
/** A new state from the host, set up the way this screen shows it. */
function guestState(st) {
  const s = st.s,
    prev = G.state;
  if (s === 'paused') {
    if (prev !== 'paused') G.resume = prev;
    G.state = 'paused';
    return;
  }
  // back from a pause into the same state: nothing to set up again
  if (prev === 'paused' && s === G.resume && s !== 'replay') {
    G.state = s;
    return;
  }
  // leaving what this screen ran by itself
  if (prev === 'replay' && s !== 'replay') {
    zoom(1);
    uiShow('rpBar', false);
  }
  if (prev === 'intro' && s !== 'intro') {
    G.intro = null;
    uiShow('rpBar', false);
    uiShow('angleBtn', true);
  }
  if (prev === 'celebrate' && s !== 'celebrate') {
    for (const p of players) {
      p.jump = 0;
      p.stickUp = false;
    }
    uiShow('angleBtn', true);
  }
  if (prev === 'brawl' && s !== 'brawl') {
    G.br = null;
    for (const p of players) {
      p.jump = 0;
      p.hurtT = 0;
    }
    zoom(1); // (a replay sets its own)
  }
  if ((prev === 'zamboni' || G.zam) && s !== 'zamboni') {
    stopEngine();
    G.zam = G.zam2 = null;
  }
  skipAsked = '';
  switch (s) {
    case 'intro':
      // (reduced motion here: no camera flight, just the rink)
      G.state = reduceMotion ? 'inter' : 'intro';
      if (reduceMotion) return;
      if (prev !== 'intro' || !G.intro) G.intro = { t: 0, t0: clock.now, key: settings.stadiumKey };
      uiShow('rpBar', true);
      uiShow('angleBtn', false);
      return;
    case 'faceoff':
      G.state = 'faceoff';
      REC.length = 0;
      fo = Number.isInteger(st.id) ? { id: st.id, phase: 'set', done: false, rt: null, early: false } : null;
      uiShow('angleBtn', true);
      return;
    case 'goal':
      G.state = 'goal';
      if ((st.n === 0 || st.n === 1) && fin(st.x)) {
        G.lastNet = NETS[1 - st.n];
        G.goalX = 160 - st.x;
        G.lastTeam = otherTeam(st.team);
        G.goalFrame = REC.length;
        checkGoal();
      }
      goalRec = 0.6;
      return;
    case 'celebrate':
      G.state = 'celebrate';
      if (fin(st.mx) && fin(st.my))
        G.cel = {
          team: otherTeam(st.team),
          meet: { x: 160 - st.mx, y: 256 - st.my },
          type: String(st.type),
          t: 0,
        };
      uiShow('rpBar', true);
      uiShow('angleBtn', false);
      return;
    case 'replay': {
      const a = Number.isInteger(st.a) && st.a >= 0 && st.a < ANGLES.length ? st.a : 0;
      if (prev === 'replay' && G.rp) {
        G.rp.angle = ANGLES[a];
        beginAngle();
      } else startReplay(a);
      return;
    }
    case 'brawl':
      G.state = 'brawl';
      guestBrawl(st);
      return;
    case 'zamboni':
      startZamboni();
      return;
    case 'over':
      G.state = 'over';
      if (fin(st.mx) && fin(st.my) && (st.w === 0 || st.w === 1))
        G.post = { winner: 1 - st.w, meet: { x: 160 - st.mx, y: 256 - st.my }, t: 0 };
      showPad(false);
      return;
    default:
      G.state = s;
  }
}
/** The fight the host started, set up the way this screen shows it: this player's fighter (the host's second) on
 * the left. Health, stamina and moves come with every frame (net/snap.js). */
function guestBrawl(st) {
  const ix = v => Number.isInteger(v) && v >= 0 && v < 8;
  if (!ix(st.a) || !ix(st.b) || !fin(st.mx) || !fin(st.my)) return;
  if (!Array.isArray(st.at) || st.at.length !== 4 || !st.at.every(fin)) return;
  const a = players[mirrorIdx(st.b)],
    b = players[mirrorIdx(st.a)],
    [hx, hy, gx, gy] = st.at;
  G.br = {
    a,
    b,
    m: { x: 160 - st.mx, y: 256 - st.my },
    phase: 'approach',
    t: 0,
    hpA: 100,
    hpB: 100,
    stam: 100,
    stamB: 100,
    litter: [...dropped(a, 160 - gx, 256 - gy), ...dropped(b, 160 - hx, 256 - hy)],
    me: duelist(),
    opp: duelist(),
    duel: true,
    winner: null,
  };
  // (this player's own zoom, not the host's)
  zoom(settings.viewMode === 'close' ? 3 : 2);
}
/** A goal the host announced: the puck must have been at that net shortly before, on this screen too. */
function checkGoal() {
  const n = G.lastNet,
    o = players.length * PF; // where the puck sits in a recorded frame (see game/replay.js)
  let seen = false;
  for (let i = Math.max(0, REC.length - 40); i < REC.length && !seen; i++) {
    const x = REC[i][o],
      y = REC[i][o + 1];
    seen = x > n.x0 - 8 && x < n.x1 + 8 && y > n.y0 - 26 && y < n.y1 + 26;
  }
  if (!seen && REC.length > 10) dispute('that goal (the puck was not near the net here)');
}
/* the guest's face-off: timed on this screen, from the drop it shows to the press */
function guestFoCue(c) {
  if (!c || !Number.isInteger(c.id)) return;
  if (c.ph === 'ready') {
    if (!fo || fo.id !== c.id) fo = { id: c.id, done: false, rt: null, early: false };
    fo.phase = 'ready';
  } else if (c.ph === 'drop') {
    if (!fo || fo.id !== c.id) fo = { id: c.id, done: false, rt: null, early: false };
    fo.phase = 'drop';
    fo.dropAt = performance.now();
    S('drop');
    if (!fo.early) banner('DROP!', 'alert low', '');
  } else if (c.ph === 'result') checkDraw(c);
}
function guestDraw() {
  if (!input.sp) return;
  input.sp = false;
  if (!fo || fo.done || !fo.phase || fo.phase === 'set') return;
  fo.done = true;
  if (fo.phase === 'ready') {
    fo.early = true;
    session.send({ t: 'rt', id: fo.id, e: 1 });
    banner('TOO EARLY', 'small away low', 'Jumped the draw');
    S('lose');
  } else {
    // from the press itself (not the step that noticed it) to the drop this screen showed
    fo.rt = ((input.spAt > fo.dropAt ? input.spAt : performance.now()) - fo.dropAt) / 1000;
    session.send({ t: 'rt', id: fo.id, rt: Math.round(fo.rt * 1000) / 1000 });
  }
}
/** The host's face-off call, checked against both times (in the host's view: index 0 the host, 1 this player). */
function checkDraw(c) {
  const rt = Array.isArray(c.rt) ? c.rt : [],
    early = Array.isArray(c.early) ? c.early : [],
    hr = rt[0],
    gr = rt[1],
    he = early[0] === true,
    ge = early[1] === true,
    w = c.w,
    mine = fo && fo.id === c.id ? fo : null;
  let ok = true;
  // a host "reaction" quicker than anyone can react
  if (!he && fin(hr) && hr < MIN_REACTION) ok = false;
  // the winner has to be the quicker of the two published times
  if (!he && !ge && fin(hr) && fin(gr) && hr !== gr && (hr < gr ? 0 : 1) !== w) ok = false;
  // the host jumped it and this player did not: this player wins
  if (he && !ge && w !== 1) ok = false;
  if (mine && !mine.early && mine.rt !== null && mine.rt >= MIN_REACTION) {
    // a clean press here, called early there
    if (ge) ok = false;
    // a press quicker than the host's that never counted
    if (gr === null && fin(hr) && mine.rt < hr && w === 0) ok = false;
    // slowed down by the lag check (fair, but worth saying)
    if (fin(gr) && gr > mine.rt + 0.03)
      feed(
        'Your draw counted as ' +
          gr.toFixed(2) +
          's after the lag check (pressed in ' +
          mine.rt.toFixed(2) +
          's)',
        -1,
      );
  }
  if (!ok) dispute('that face-off call');
}
/** The guest's step: play the host's match back, mirrored, and send the stick and buttons. */
function guestStep(dt) {
  stepParts(dt);
  G.shake = Math.max(0, G.shake - dt);
  G.flash = Math.max(0, G.flash - dt);
  if (G.bannerT > 0) {
    G.bannerT -= dt;
    if (G.bannerT <= 0) hideBanner();
  }
  // the playback clock runs a little behind the newest frame (net/buffer.js)
  playT = advance(buf, playT, dt);
  let n;
  while (playT !== null && (n = nextFrame(buf, playT))) playFrame(n.f, playT - n.f.ts > 0.5, false, n.early);
  const prevF = buf.last;
  const st = G.state;
  if (st === 'paused') return;
  if (st === 'intro') {
    if (G.intro) G.intro.t += dt;
    askSkip();
  }
  if (st === 'replay' && G.rp) {
    resetPrediction();
    replayStep(dt);
    askSkip();
    return;
  }
  if (st === 'zamboni') {
    resetPrediction();
    zamStep(dt);
    updCam(dt, false);
    return;
  }
  if (!prevF) return;
  const sends = st === 'play' || st === 'faceoff' || st === 'goal' || st === 'inter' || st === 'brawl';
  if (sends) inSeq++;
  // blended toward the next snapshot; with none here yet, carried on along the last speeds for a moment
  const next = buf.q[0],
    k = next ? clamp((playT - prevF.ts) / Math.max(0.001, next.ts - prevF.ts), 0, 1) : 0,
    ch = applySnap(prevF.s, next ? next.s : null, k, next ? 0 : clamp(playT - prevF.ts, 0, 0.05));
  // the skater this player steers: moved here at once, pulled toward the host's (net/predict.js); in a fight
  // ('snap') the host's places are shown as they are and the prediction starts again afterwards
  predict(dt, inSeq, ackAt(prevF, next, k), st === 'play' ? 'steer' : st === 'goal' ? 'ease' : 'snap');
  if (ch.score || ch.period) hud();
  hudClock();
  if (st === 'celebrate') askSkip();
  if (st !== 'over') clothStep();
  if (st === 'intro') return;
  updCam(dt, false);
  strideSounds(dt);
  if (st === 'play' || st === 'faceoff' || st === 'goal') scuff(dt);
  trail();
  if (st === 'play' || (st === 'goal' && (goalRec -= dt) > 0)) recFrame();
  if (st === 'faceoff') guestDraw();
  if (sends) sendInput();
}
/** The guest's newest input step the host had taken at the blend between frames a and b (null: not said). */
function ackAt(a, b, k) {
  if (!a.n) return null;
  return b && b.n ? Math.round(a.n + (b.n - a.n) * k) : a.n;
}
/** The puck's streak at speed (worked out here from where it is drawn). */
function trail() {
  const sp = Math.hypot(puck.vx, puck.vy);
  if (!puck.owner && sp > 140) {
    puck.trail.push({ x: puck.x, y: puck.y });
    if (puck.trail.length > 5) puck.trail.shift();
  } else puck.trail.length = 0;
}
/** Skip (replay, celebration, intro) is the host's call: ask once per state. */
function askSkip() {
  if (!(input.sp || input.pp || input.swp)) return;
  input.sp = input.pp = input.swp = input.sr = false;
  if (skipAsked === G.state) return;
  skipAsked = G.state;
  session.send({ t: 'skip' });
}
function sendInput() {
  readStick();
  const mouseAim = mouse.on && !input.touch;
  sentIn.unshift(packInput(input, mouseAim));
  if (sentIn.length > IN_KEEP) sentIn.length = IN_KEEP;
  session.sendFast({ t: 'i', g: mp.g, a: sentIn, n: inSeq, l: Math.round(buf.lag * 1000) });
  input.sp = input.sr = input.pp = input.swp = false;
}
