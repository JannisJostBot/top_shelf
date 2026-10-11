// Line-up manager (optional): before a match the player can look at the roster that will play and give each of
// their skaters a position. The centre takes the face-offs, the wing leads the rush, the defenceman hangs back;
// a skater keeps their own ratings whatever position they play. Without it, every match rolls a fresh roster.
import { genRoster, SK } from './players';
import { G } from './world';

export const SLOTS = ['C', 'W', 'D'];

/** The roster for the next match, rolled now if it has not been yet (and then kept until that match starts). */
export function prepareLineup() {
  if (!G.rosterReady) {
    genRoster();
    G.rosterReady = true;
  }
  return SK[0];
}
/** A brand-new roster for the next match. */
export function rerollLineup() {
  genRoster();
  G.rosterReady = true;
}
/** Keeps the team's skaters in C, W, D order: the face-off spots and the AI go by it. */
function order(t) {
  SK[t].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}
/** Puts skater p at `slot`; whoever played there takes p's old position. */
export function assignSlot(p, slot) {
  const t = p.team,
    other = SK[t].find(q => q !== p && q.slot === slot);
  if (other) other.slot = p.slot;
  p.slot = slot;
  order(t);
}
/** How well a skater's ratings suit a position (hands for a centre, shot for a wing, checking for defence). */
function fit(p, slot) {
  const s = p.st;
  return slot === 'C' ? s.hnd * 2 + s.spd : slot === 'W' ? s.sht * 2 + s.spd : s.chk * 2 + s.hnd * 0.5;
}
/** Gives the team's skaters the positions that suit their ratings best. */
export function autoLineup(t = 0) {
  const sk = SK[t];
  let best = null,
    bs = -1e9;
  for (const perm of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    const sc = perm.reduce((a, slotI, i) => a + fit(sk[i], SLOTS[slotI]), 0);
    if (sc > bs) {
      bs = sc;
      best = perm;
    }
  }
  sk.forEach((p, i) => (p.slot = SLOTS[best[i]]));
  order(t);
}
/** At the start of a match: the prepared roster plays (once); otherwise a fresh one is rolled. */
export function rosterForMatch() {
  if (!G.rosterReady) genRoster();
  G.rosterReady = false;
  order(0);
  order(1);
}
