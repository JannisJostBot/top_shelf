// Snapshots: what the host's match looks like right now, 30 times a second, as a flat list of numbers. The guest
// draws its screen from them, blended between the two around its playback time and mirrored into its own view.
// When the next one is late, the last one is carried on along its speeds for a moment instead of stopping.
import { H, W } from '../config';
import { clock } from '../core/time';
import { players } from '../game/players';
import { seat1 } from '../game/online';
import { G, puck, ref } from '../game/world';
import { fin, mirrorIdx } from './proto';

const SAVE_KINDS = ['pad', 'glove', 'block']; // a goalie's save, for the guest's animation (render/players.js)

const NP = 18, // numbers per player
  NK = 7, // puck
  NR = 7, // referee
  NG = 31, // match: score, clock, boost, team 1's wind-up and skater, shake, stats, goals per period
  NB = 14; // fight: fighters, phase, health, stamina, each fighter's move, winner
/** Where the two scores sit in a snapshot (host's team first). */
export const SCORE_AT = 8 * NP + NK + NR;
export const SNAP_LEN = 8 * NP + NK + NR + NG + NB;
const MOM_SRC = ['ice', 'fight'];
const PHASES = ['approach', 'fight', 'end'],
  MOVES = ['idle', 'wind', 'feint', 'open', 'recover'];
const NO_FIGHT = [-1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1];
const r2 = v => Math.round(v * 100) / 100;
const pos = v => r2(Math.max(0, v || 0));

/** Host: the match as it is now. */
export function packSnap() {
  const a = [];
  for (const p of players)
    a.push(
      r2(p.x),
      r2(p.y),
      r2(p.vx),
      r2(p.vy),
      r2(p.fx),
      r2(p.fy),
      r2(p.anim % 100),
      pos(p.down),
      pos(p.stun),
      p.fallDir < 0 ? -1 : 1,
      r2(p.jump || 0),
      (p.stickUp ? 1 : 0) | (p.benched ? 2 : 0),
      pos((p.followUntil || 0) - clock.now),
      pos(p.saveT),
      // the save's side and kind in one number: ±1 pad, ±2 glove, ±3 blocker
      (p.saveDir < 0 ? -1 : 1) * (1 + SAVE_KINDS.indexOf(p.saveKind || 'pad')),
      pos(p.checkCd),
      pos(p.checkT),
      pos(p.hurtT),
    );
  a.push(
    r2(puck.x),
    r2(puck.y),
    r2(puck.z),
    r2(puck.vx),
    r2(puck.vy),
    players.indexOf(puck.owner),
    players.indexOf(puck.passTo),
  );
  a.push(r2(ref.x), r2(ref.y), r2(ref.fx), r2(ref.fy), r2(ref.anim % 100), r2(ref.vx), r2(ref.vy));
  const m = G.mom && G.mom.t > 0 ? G.mom : null,
    s = G.stats,
    gp = s.gp || [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
  a.push(
    G.score[0],
    G.score[1],
    G.period,
    r2(G.clock),
    m ? m.team : -1,
    m ? r2(m.t) : 0,
    m ? m.dur : 0,
    m ? Math.max(0, MOM_SRC.indexOf(m.src)) : 0,
    r2(seat1.charge),
    seat1.charging ? 1 : 0,
    players.indexOf(seat1.controlled),
    r2(G.shake),
    r2(G.hype),
    ...s.sog,
    ...s.saves,
    ...s.hits,
    ...s.fo,
    r2(s.poss[0]),
    r2(s.poss[1]),
    ...gp[0],
    ...gp[1],
  );
  const B = G.state === 'brawl' && G.br && G.br.duel ? G.br : null,
    mv = f => [Math.max(0, MOVES.indexOf(f.st)), pos(f.punchT), pos(f.blockT)];
  if (B)
    a.push(
      players.indexOf(B.a),
      players.indexOf(B.b),
      Math.max(0, PHASES.indexOf(B.phase)),
      r2(B.hpA),
      r2(B.hpB),
      r2(B.stam),
      r2(B.stamB),
      ...mv(B.me),
      ...mv(B.opp),
      B.phase === 'end' && B.winner !== null ? B.winner : -1,
    );
  else a.push(...NO_FIGHT);
  return a;
}
/** Guest: a received snapshot is usable (right length, all numbers, positions on or near the ice). */
export function snapOk(a) {
  if (!Array.isArray(a) || a.length !== SNAP_LEN || !a.every(fin)) return false;
  for (let i = 0; i < 8; i++) {
    const o = i * NP;
    if (Math.abs(a[o] - W / 2) > W || Math.abs(a[o + 1] - H / 2) > H) return false;
  }
  const k = 8 * NP,
    f = SNAP_LEN - NB,
    idx = v => Number.isInteger(v) && v >= -1 && v < 8,
    move = v => Number.isInteger(v) && v >= 0 && v < MOVES.length;
  return (
    Math.abs(a[k] - W / 2) <= W &&
    Math.abs(a[k + 1] - H / 2) <= H &&
    a[k + 5] >= -1 &&
    a[k + 5] < 8 &&
    idx(a[f]) &&
    idx(a[f + 1]) &&
    Number.isInteger(a[f + 2]) &&
    a[f + 2] >= 0 &&
    a[f + 2] < PHASES.length &&
    move(a[f + 7]) &&
    move(a[f + 10]) &&
    [-1, 0, 1].includes(a[f + 13])
  );
}
const lerp = (a, b, k) => a + (b - a) * k;
// a jump between two snapshots (a face-off reset, the puck into the net) is not blended
const near = (a, b, d) => Math.abs(a - b) < d;
/**
 * Guest: puts the host's match into this view, blended a fraction k from snapshot a to snapshot b (b may be null:
 * then a, carried on ahead seconds along its speeds). Returns what changed that the screen needs to know:
 * { score, period }.
 */
export function applySnap(a, b, k, ahead = 0) {
  if (!b) {
    b = a;
    k = 0;
  } else ahead = 0;
  const L = (i, d = 20) => (near(a[i], b[i], d) ? lerp(a[i], b[i], k) : b[i]);
  for (let i = 0; i < 8; i++) {
    const o = i * NP,
      p = players[mirrorIdx(i)],
      // (discrete things come from the later snapshot once the blend is past halfway)
      c = k < 0.5 ? a : b;
    p.x = W - L(o);
    p.y = H - L(o + 1);
    p.vx = -L(o + 2, 400);
    p.vy = -L(o + 3, 400);
    p.fx = -L(o + 4, 0.8);
    p.fy = -L(o + 5, 0.8);
    p.anim = L(o + 6, 5);
    p.down = c[o + 7];
    p.stun = c[o + 8];
    p.fallDir = -c[o + 9];
    p.jump = L(o + 10, 10);
    p.stickUp = !!(c[o + 11] & 1);
    p.benched = !!(c[o + 11] & 2);
    p.followUntil = c[o + 12] > 0 ? clock.now + c[o + 12] : 0;
    p.saveT = c[o + 13];
    const sd = -c[o + 14];
    p.saveDir = sd < 0 ? -1 : 1;
    p.saveKind = SAVE_KINDS[Math.abs(sd) - 1] || 'pad';
    p.checkCd = c[o + 15];
    p.checkT = c[o + 16];
    p.hurtT = c[o + 17];
  }
  const q = 8 * NP,
    c = k < 0.5 ? a : b;
  puck.x = W - L(q);
  puck.y = H - L(q + 1);
  puck.z = L(q + 2, 10);
  puck.vx = -L(q + 3, 500);
  puck.vy = -L(q + 4, 500);
  puck.owner = c[q + 5] >= 0 ? players[mirrorIdx(c[q + 5])] : null;
  puck.passTo = c[q + 6] >= 0 ? players[mirrorIdx(c[q + 6])] : null;
  const r = q + NK;
  ref.x = W - L(r);
  ref.y = H - L(r + 1);
  ref.fx = -L(r + 2, 0.8);
  ref.fy = -L(r + 3, 0.8);
  ref.anim = L(r + 4, 5);
  ref.vx = -L(r + 5, 400);
  ref.vy = -L(r + 6, 400);
  if (ahead > 0) {
    // (a fallen skater lies still, a puck on a stick goes with its carrier)
    for (const p of players)
      if (!(p.down > 0)) {
        p.x += p.vx * ahead;
        p.y += p.vy * ahead;
      }
    const o = puck.owner;
    puck.x += (o ? (o.down > 0 ? 0 : o.vx) : puck.vx) * ahead;
    puck.y += (o ? (o.down > 0 ? 0 : o.vy) : puck.vy) * ahead;
    ref.x += ref.vx * ahead;
    ref.y += ref.vy * ahead;
  }
  const g = r + NR,
    score = [c[g + 1], c[g]],
    changed = { score: score[0] !== G.score[0] || score[1] !== G.score[1], period: c[g + 2] !== G.period };
  G.score = score;
  G.period = c[g + 2];
  G.clock = L(g + 3, 2);
  G.mom =
    c[g + 4] >= 0
      ? { team: 1 - c[g + 4], t: c[g + 5], dur: c[g + 6], src: MOM_SRC[c[g + 7]] || 'ice' }
      : null;
  // team 1's seat on the host is this player's
  G.charge = c[g + 8];
  G.charging = !!c[g + 9];
  G.controlled = c[g + 10] >= 0 ? players[mirrorIdx(c[g + 10])] : null;
  G.shake = Math.max(G.shake, c[g + 11] > 0.05 ? c[g + 11] : 0);
  G.hype = c[g + 12];
  const s = g + 13,
    pair = i => [c[i + 1], c[i]];
  G.stats = {
    sog: pair(s),
    saves: pair(s + 2),
    hits: pair(s + 4),
    fo: pair(s + 6),
    poss: pair(s + 8),
    gp: [c.slice(s + 14, s + 18), c.slice(s + 10, s + 14)],
  };
  // the fight (G.br is set up when the host says it started): this player's fighter is the host's second one
  const f = SNAP_LEN - NB,
    B = G.br;
  if (B && c[f] >= 0 && c[f + 1] >= 0) {
    const mv = (o, i) => {
      o.st = MOVES[c[i]];
      o.punchT = c[i + 1];
      o.blockT = c[i + 2];
    };
    B.a = players[mirrorIdx(c[f + 1])];
    B.b = players[mirrorIdx(c[f])];
    B.phase = PHASES[c[f + 2]];
    B.hpA = c[f + 4];
    B.hpB = c[f + 3];
    B.stam = c[f + 6];
    B.stamB = c[f + 5];
    mv(B.me, f + 10);
    mv(B.opp, f + 7);
    B.winner = c[f + 13] >= 0 ? 1 - c[f + 13] : null;
  }
  return changed;
}
