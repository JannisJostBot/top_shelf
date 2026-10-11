import { BASE } from '../config';
import { clamp, rnd } from '../core/math';
import { blade, burst, faceTo } from './physics/motion';
import { nearBoards } from './physics/rink';
import { G, puck } from './world';
import { reduceMotion, settings } from '../settings';
import { feed, pop, ring, S, vib } from './fx';
import { AMB } from '../data/colors';

/* ---------- body checks (human and AI share this) ---------- */
export function startCheck(p, c) {
  p.checkCd = p === G.controlled && !G.ai0 ? 1.4 : 1.8;
  p.checkT = 0.38;
  p.checkTgt = c;
  c.ai.dodged = false;
  p.checkSpd = BASE * rnd(1.3, 1.62) * p.st.spd;
  const humanVictim = c === G.controlled && !G.ai0;
  c.ai.dodge =
    !humanVictim && Math.random() < (c.team === 1 && !G.ai0 ? settings.diff.dodge : 0.3) * c.st.hnd;
  S('charge', { by: p });
  if (isMe(p)) vib([12]);
}
export function checkStep(p, dt) {
  const c = p.checkTgt;
  if (!c || puck.owner !== c || p.down > 0) {
    p.checkT = 0;
    return;
  }
  const dx = c.x - p.x,
    dy = c.y - p.y,
    d = Math.hypot(dx, dy) || 1,
    s = p.checkSpd || BASE * 1.45;
  p.vx = (dx / d) * s;
  p.vy = (dy / d) * s;
  faceTo(p, c.x, c.y, 0.6);
  p.checkT -= dt;
  if (c.ai.dodge && d < 15) {
    c.ai.dodge = false;
    c.ai.dodged = true;
    const sd = Math.random() < 0.5 ? -1 : 1;
    c.vx += (-dy / d) * sd * 85;
    c.vy += (dx / d) * sd * 85;
    c.imm = Math.max(c.imm, 0.25);
  }
  if (d < 8) {
    p.checkT = 0;
    resolveHit(p, c, dx / d, dy / d);
  } else if (p.checkT <= 0) {
    p.stun = 0.55;
    S('miss');
    pop(p.x, p.y, c.ai.dodged ? 'DODGED' : 'MISSED', '#9aa6c4');
    if (isMe(p)) vib([12]);
  }
}
// Not every check lands clean: strength, angle and a bit of luck decide between a flattening hit,
// a stumble that may jar the puck loose, or the carrier shrugging the checker off.
const isMe = p => !G.ai0 && p === G.controlled;
function resolveHit(by, c, nx, ny) {
  const closing = clamp(Math.hypot(by.vx, by.vy) / (BASE * 1.45), 0.6, 1.1);
  const power = (by.st.chk / c.st.chk) * rnd(0.6, 1.2) * closing;
  if (power > 1) {
    G.hits.down++;
    knockDown(c, nx, ny, by, power);
  } else if (power > 0.73) {
    G.hits.stumble++;
    stumble(c, nx, ny, by);
  } else {
    G.hits.bounce++;
    bounceOff(by, c, nx, ny);
  }
}
function popPuck(c, nx, ny, by) {
  if (puck.owner !== c) return;
  const b = blade(c);
  puck.owner = null;
  puck.x = b.x;
  puck.y = b.y;
  puck.vx = c.vx * 0.4 + nx * 40 + rnd(-45, 45);
  puck.vy = c.vy * 0.4 + ny * 40 + rnd(-45, 45);
  puck.lastTeam = by.team;
  puck.hard = false;
  puck.miss.clear();
  puck.passTo = null;
  puck.gchk = null;
}
function knockDown(c, nx, ny, by, power) {
  popPuck(c, nx, ny, by);
  const pw = clamp(power, 1, 1.25);
  c.down = rnd(0.5, 0.95) * pw;
  c.fallDir = nx >= 0 ? 1 : -1;
  c.stun = c.down + rnd(0.2, 0.4);
  c.cool = c.down + 0.15;
  c.checkT = 0;
  const kb = rnd(50, 80) * pw;
  c.vx = nx * kb;
  c.vy = ny * kb;
  by.vx *= 0.3;
  by.vy *= 0.3;
  by.cool = 0.05;
  S('hitBig', { victim: c, by, boards: nearBoards(c) });
  burst(c.x, c.y - 5, 12, '#ffffff', 65);
  burst(c.x, c.y - 5, 6, AMB, 55);
  burst(c.x, c.y, 8, '#ffffff', 45);
  ring(c.x, c.y, '#ffffff', 1.2);
  pop(c.x, c.y, 'BIG HIT!', AMB, true);
  G.stats.hits[by.team]++;
  feed('BIG HIT · ' + '#' + by.num + ' ' + by.name + ' on ' + '#' + c.num + ' ' + c.name, by.team);
  G.hype = Math.max(G.hype, 0.5);
  if (isMe(by)) vib([35, 25, 70]);
  else if (isMe(c)) vib([90, 40, 140]);
  if (isMe(by) || isMe(c)) G.flash = 0.12;
  if (!reduceMotion) G.shake = Math.max(G.shake, 0.22);
}
function stumble(c, nx, ny, by) {
  G.stats.hits[by.team]++;
  if (Math.random() < 0.65) popPuck(c, nx, ny, by);
  c.stun = rnd(0.35, 0.55);
  const kb = rnd(28, 48);
  c.vx += nx * kb;
  c.vy += ny * kb;
  by.vx *= 0.4;
  by.vy *= 0.4;
  by.cool = 0.05;
  S('hitMed', { victim: c, by });
  burst(c.x, c.y - 5, 7, '#ffffff', 42);
  ring(c.x, c.y, '#ffffff', 0.8);
  pop(c.x, c.y, puck.owner === c ? 'STUMBLE' : 'JARRED LOOSE', '#ffffff');
  if (isMe(by) || isMe(c)) vib([40]);
  if (!reduceMotion) G.shake = Math.max(G.shake, 0.1);
}
function bounceOff(by, c, nx, ny) {
  by.stun = rnd(0.4, 0.6);
  const kb = rnd(25, 40);
  by.vx = -nx * kb;
  by.vy = -ny * kb;
  c.vx += nx * 15;
  c.vy += ny * 15;
  c.imm = Math.max(c.imm, 0.3);
  S('hitSoft', { victim: by, by });
  burst(by.x, by.y - 5, 5, '#ffffff', 30);
  ring(by.x, by.y, '#ff6b71', 0.7);
  pop(by.x, by.y, 'BOUNCED OFF', '#ff8a80');
  if (isMe(by)) vib([20, 30, 20]);
  else if (isMe(c)) vib([15]);
}
