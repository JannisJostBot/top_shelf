import { clamp, rnd } from '../../core/math';
import { LABEL } from '../../data/difficulty';
import { nearest } from '../ai/team';
import { kit } from '../kit';
import { burst, faceTo, steer } from '../physics/motion';
import { integrate } from '../physics/step';
import { GK, SK, SKATERS, players } from '../players';
import { practiceOver } from '../practice';
import { startReplay } from '../replay';
import { G, ref } from '../world';
import { input } from '../../input/state';
import { reduceMotion, settings } from '../../settings';
import { banner, bubble, feed, hideBanner, persp, pop, S, SKIP, uiShow, vib, zoom } from '../fx';
import { inputOf, nameOf, net, rinput, seat } from '../online';
import { AMB, CY } from '../../data/colors';

/* ---------- brawl minigame ---------- */

const FIGHT = {
  rookie: { wind: 0.5, idle: [0.8, 1.4], guard: 0.3, counter: 0.3, dmg: [8, 12] },
  pro: { wind: 0.36, idle: [0.35, 0.8], guard: 0.45, counter: 0.55, dmg: [10, 15] },
  allstar: { wind: 0.29, idle: [0.2, 0.5], guard: 0.55, counter: 0.7, dmg: [12, 17] },
};
// Online the fight is between the two players (G.br.duel): no CPU, and both sides throw the same punch, a short
// wind-up (the red !) before it lands, so the other one can see it coming and block, even over the network.
// The host resolves everything from both players' buttons (input and rinput); the guest only draws it.
const DUEL = { wind: 0.42, block: 0.45, blockCd: 0.7, stun: 0.3 };
// The guest sees the host's match this far behind and its block takes half the round trip to arrive, so the
// host's own wind-up lasts that much longer: both players get the same time to react (capped, a slow link
// should not make the host's punches crawl).
const lagGrace = () => Math.min(0.3, net.playLag + net.rtt);
// A blocked punch leaves its fighter open long enough for the other to answer: a reaction, then the answer's
// wind-up (the longer host one, and the guest only sees the opening that much later).
const openFor = () => 0.25 + DUEL.wind + lagGrace();
/** The gloves and stick a fighter drops at (x, y). */
export const dropped = (f, x, y) => [
  // dropped gloves in the team's dark colour (the glove colour of the player palettes)
  { x: x - 2, y: y + 2, t: 'g', c: kit.TEAMS[f.team].dark },
  { x: x + 2, y: y + 3, t: 'g', c: kit.TEAMS[f.team].dark },
  { x, y: y + 4, t: 's', c: f.look.tape },
];
/** One fighter's state in a fight between two players (the same shape for both). */
export const duelist = () => ({
  st: 'idle',
  t: 0,
  punchT: 0,
  punchCd: 0,
  blockT: 0,
  blockCd: 0,
  stun: 0,
  pow: 1,
});
export function startBrawl() {
  const duel = G.net === 'host',
    a = duel
      ? seat(0).controlled || SK[0][0]
      : G.lastShooter && G.lastShooter.team === 0
        ? G.lastShooter
        : G.controlled || SK[0][0],
    b = duel ? seat(1).controlled || SK[1][0] : nearest(SK[1], a);
  const m = { x: clamp((a.x + b.x) / 2, 32, 128), y: clamp((a.y + b.y) / 2, 52, 204) };
  G.state = 'brawl';
  if (!G.practice) G.fought = true;
  G.br = {
    a,
    b,
    m,
    phase: 'approach',
    t: 0,
    hpA: 100,
    hpB: 100,
    stam: 100,
    litter: [],
    opp: duel ? duelist() : { st: 'idle', t: rnd(0.6, 1.1), punchT: 0, blockT: 0 },
    me: duel ? duelist() : { punchCd: 0, blockT: 0, blockCd: 0, stun: 0, punchT: 0 },
  };
  if (duel) Object.assign(G.br, { duel: true, stamB: 100, winner: null, at: [a.x, a.y, b.x, b.y] });
  for (const f of [a, b]) {
    f.jump = 0;
    f.stickUp = false;
    f.down = 0;
    f.stun = 0;
    f.checkT = 0;
    G.br.litter.push(...dropped(f, f.x, f.y));
  }
  zoom(settings.viewMode === 'close' ? 3 : 2);
  hideBanner();
  uiShow('rpBar', false);
  G.hype = 0.9;
  if (duel) {
    // (the side that was scored on starts it)
    bubble(G.lastTeam === 0 ? b : a, '?&!*#!', 0);
    banner(
      'GLOVES OFF!',
      'away',
      persp(v => {
        const o = v ? a : b;
        return '#' + o.num + ' ' + o.name + ' wants a piece of you';
      }),
    );
  } else {
    bubble(b, '?&!*#!', 0);
    banner('GLOVES OFF!', 'away', '#' + b.num + ' ' + b.name + ' wants a piece of you');
  }
  feed('GLOVES OFF · ' + '#' + a.num + ' ' + a.name + ' vs ' + '#' + b.num + ' ' + b.name);
  G.bannerT = 1.4;
  S('ooh');
  setTimeout(() => {
    if (G.state === 'brawl') S('ooh');
  }, 400);
}
function fighterHit(p, dmg, big) {
  p.hurtT = 0.18;
  burst(p.x, p.y - 8, big ? 10 : 6, '#ffffff', 45);
  burst(p.x, p.y - 8, big ? 5 : 3, '#ff6b71', 35);
  pop(p.x, p.y, big ? 'POW!' : '-' + dmg, big ? AMB : '#ffffff', big);
  S('punch', { victim: p, big });
  if (!reduceMotion) G.shake = Math.max(G.shake, big ? 0.16 : 0.08);
}
function playerPunch() {
  const B = G.br,
    me = B.me,
    o = B.opp,
    F = FIGHT[settings.diffKey];
  if (me.stun > 0 || me.punchCd > 0) return;
  me.punchCd = B.stam < 25 ? 0.6 : 0.36;
  me.punchT = 0.15;
  const pow = 0.35 + (0.65 * B.stam) / 100;
  B.stam = Math.max(0, B.stam - 24);
  let dmg,
    big = false;
  if (o.st === 'wind' && o.t > F.wind * 0.45) {
    dmg = Math.round(rnd(9, 13) * pow);
    o.st = 'recover';
    o.t = 0.5;
    pop(B.b.x, B.b.y - 6, 'INTERRUPT!', CY);
    big = true;
  } else if (o.st === 'wind') {
    dmg = Math.round(rnd(5, 8) * pow);
  } else if (o.st === 'open' || o.st === 'recover') {
    dmg = Math.round(rnd(11, 16) * pow);
    big = true;
  } else if (Math.random() < F.guard * (B.stam < 30 ? 1.3 : 1)) {
    o.blockT = 0.3;
    S('block');
    pop(B.b.x, B.b.y, 'BLOCKED', '#9aa6c4');
    me.stun = 0.35;
    if (Math.random() < F.counter) {
      o.st = 'wind';
      o.t = F.wind * 0.7;
    } else o.t = Math.min(o.t, 0.25);
    vib([10]);
    return;
  } else dmg = Math.round(rnd(7, 11) * pow);
  B.hpB -= dmg;
  fighterHit(B.b, dmg, big);
  vib(big ? [30, 20, 40] : [25]);
}
export function brawlStep(dt) {
  const B = G.br,
    { a, b, m } = B,
    F = FIGHT[settings.diffKey];
  B.t += dt;
  steer(a, m.x - 7, m.y, dt, 1, true);
  steer(b, m.x + 7, m.y, dt, 1, true);
  if (a.down <= 0) {
    a.fx = 1;
    a.fy = 0;
  }
  if (b.down <= 0) {
    b.fx = -1;
    b.fy = 0;
  }
  const ring = SKATERS.filter(p => p !== a && p !== b);
  ring.forEach((p, i) => {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    steer(
      p,
      clamp(m.x + Math.cos(ang) * 26, 12, 148),
      clamp(m.y + Math.sin(ang) * 16, 14, 242),
      dt,
      0.8,
      true,
    );
    faceTo(p, m.x, m.y, 0.2);
  });
  for (const g of GK) {
    g.vx = 0;
    g.vy = 0;
  }
  ref.vx += ((m.x - ref.x) * 2 - ref.vx) * dt * 3;
  ref.vy += ((m.y - 16 - ref.y) * 2 - ref.vy) * dt * 3;
  ref.x += ref.vx * dt;
  ref.y += ref.vy * dt;
  ref.fx = 0;
  ref.fy = 1;
  for (const p of [a, b]) {
    p.hurtT = (p.hurtT || 0) - dt;
  }
  integrate(dt);
  const me = B.me,
    o = B.opp;
  me.punchT -= dt;
  me.punchCd -= dt;
  me.blockT -= dt;
  me.blockCd -= dt;
  me.stun -= dt;
  o.punchT -= dt;
  o.blockT -= dt;
  if (B.phase === 'approach') {
    clearPresses();
    if (B.t > 1.2) {
      B.phase = 'fight';
      B.t = 0;
      banner(
        'FIGHT!',
        'alert',
        B.duel
          ? 'PUNCH winds up a swing · BLOCK when they wind up'
          : 'PUNCH to hit · BLOCK when they wind up',
      );
      G.bannerT = 1.3;
      S('bell');
    }
    return;
  }
  if (B.phase === 'end') {
    clearPresses();
    B.endT -= dt;
    const w = B.winner === 0 ? a : B.winner === 1 ? b : null;
    if (w) w.jump = Math.abs(Math.sin(B.t * 10)) * 4;
    if (B.endT <= 0) finishBrawl();
    return;
  }
  if (B.duel) {
    duelStep(dt);
    if (B.hpA <= 0 || B.hpB <= 0 || B.t > 22) endBrawl(B.hpB <= 0 ? 0 : B.hpA <= 0 ? 1 : null);
    return;
  }
  B.stam = Math.min(100, B.stam + 20 * dt);
  if (input.sp) playerPunch();
  if (input.pp && me.blockCd <= 0) {
    me.blockT = 0.42;
    me.blockCd = 0.6;
  }
  input.sp = input.pp = input.swp = input.sr = false;
  o.t -= dt;
  if (o.st === 'idle' && o.t <= 0) {
    if (Math.random() < 0.15) {
      o.st = 'feint';
      o.t = 0.22;
    } else {
      o.st = 'wind';
      o.t = F.wind;
    }
  } else if (o.st === 'feint' && o.t <= 0) {
    o.st = 'idle';
    o.t = rnd(0.3, 0.7);
  } else if (o.st === 'wind' && o.t <= 0) {
    o.punchT = 0.15;
    if (me.blockT > 0) {
      S('block');
      pop(a.x, a.y, 'BLOCKED', CY);
      o.st = 'open';
      o.t = 0.6;
      vib([15]);
    } else {
      const d = Math.round(rnd(F.dmg[0], F.dmg[1]));
      B.hpA -= d;
      me.stun = 0.3;
      fighterHit(a, d, false);
      vib([45]);
      o.st = 'recover';
      o.t = 0.45;
    }
  } else if ((o.st === 'recover' || o.st === 'open') && o.t <= 0) {
    o.st = 'idle';
    o.t = rnd(F.idle[0], F.idle[1]);
  }
  if (B.hpA <= 0 || B.hpB <= 0 || B.t > 22) endBrawl(B.hpB <= 0 ? 0 : B.hpA <= 0 ? 1 : null);
}
function clearPresses() {
  for (const inp of [input, rinput]) inp.sp = inp.pp = inp.swp = inp.sr = false;
}
/* the fight between two players: fighter 0 is B.a (the host's, B.me), fighter 1 is B.b (the guest's, B.opp) */
const HP = ['hpA', 'hpB'],
  STAM = ['stam', 'stamB'];
function duelStep(dt) {
  const B = G.br,
    F = [B.me, B.opp];
  // (B.me's timers already ran down in brawlStep, and B.opp's punch and block)
  B.opp.punchCd -= dt;
  B.opp.blockCd -= dt;
  B.opp.stun -= dt;
  for (const t of [0, 1]) {
    const f = F[t],
      inp = inputOf(t),
      free = f.st === 'idle' && f.stun <= 0;
    B[STAM[t]] = Math.min(100, B[STAM[t]] + 20 * dt);
    if (inp.sp && free && f.blockT <= 0 && f.punchCd <= 0) {
      // the wind-up: the punch lands when it is over (a tired one is weaker)
      f.st = 'wind';
      f.t = DUEL.wind + (t === 0 ? lagGrace() : 0);
      f.pow = 0.35 + (0.65 * B[STAM[t]]) / 100;
      B[STAM[t]] = Math.max(0, B[STAM[t]] - 24);
    } else if (inp.pp && free && f.blockCd <= 0) {
      f.blockT = DUEL.block;
      f.blockCd = DUEL.blockCd;
    }
    inp.sp = inp.pp = inp.swp = inp.sr = false;
  }
  for (const t of [0, 1]) {
    const f = F[t];
    f.t -= dt;
    if (f.st === 'wind' && f.t <= 0) land(t);
    else if ((f.st === 'recover' || f.st === 'open') && f.t <= 0) f.st = 'idle';
  }
}
/** Fighter t's punch arrives: blocked, or a hit (harder on a fighter who is winding up or left open). */
function land(t) {
  const B = G.br,
    f = t ? B.opp : B.me,
    o = t ? B.me : B.opp,
    v = t ? B.a : B.b;
  f.punchT = 0.15;
  if (o.blockT > 0) {
    S('block');
    pop(v.x, v.y, 'BLOCKED', CY);
    f.st = 'open';
    f.t = openFor();
    o.blockT = 0; // (the block has done its job: the blocker's hands are free to answer)
    vib(persp(w => (w === 1 - t ? [15] : SKIP)));
    return;
  }
  let lo = 7,
    hi = 11,
    big = false;
  if (o.st === 'wind') {
    // caught winding up: that punch never comes
    lo = 9;
    hi = 13;
    big = true;
    o.st = 'recover';
    o.t = 0.5;
    pop(v.x, v.y - 6, 'INTERRUPT!', CY);
  } else if (o.st === 'open' || o.st === 'recover') {
    lo = 11;
    hi = 16;
    big = true;
  }
  const dmg = Math.round(rnd(lo, hi) * f.pow);
  B[HP[1 - t]] -= dmg;
  o.stun = DUEL.stun;
  fighterHit(v, dmg, big);
  vib(persp(w => (w === 1 - t ? [45] : big ? [30, 20, 40] : [25])));
  f.st = 'recover';
  f.t = B[STAM[t]] < 25 ? 0.6 : 0.3;
}
function endBrawl(w) {
  const B = G.br;
  B.phase = 'end';
  B.endT = 2.6;
  B.winner = w;
  B.t = 0;
  const loser = w === 0 ? B.b : w === 1 ? B.a : null;
  if (loser) {
    loser.down = 2.4;
    loser.fallDir = loser === B.a ? -1 : 1;
    loser.vx = (loser === B.a ? -1 : 1) * 40;
    burst(loser.x, loser.y - 6, 12, '#ffffff', 60);
    if (!reduceMotion) G.shake = 0.25;
  }
  S('whistle');
  if (B.duel && w !== null) {
    const won = v => v === w;
    banner(
      persp(v => (won(v) ? 'YOU WIN THE FIGHT' : 'YOU LOST THE FIGHT')),
      persp(v => (won(v) ? 'home' : 'away')),
      persp(v =>
        won(v) ? 'Momentum: your team skates faster for 25s' : nameOf(w) + ' skates faster for 25s',
      ),
      true,
    );
    S(persp(v => (won(v) ? 'cheer' : 'groan')));
    vib(persp(v => (won(v) ? [60, 40, 120] : [150])));
  } else if (w === 0) {
    banner('YOU WIN THE FIGHT', 'home', 'Momentum: your team skates faster for 25s', true);
    S('cheer');
    vib([60, 40, 120]);
  } else if (w === 1) {
    banner('YOU LOST THE FIGHT', 'away', 'The CPU skates faster for 25s', true);
    S('groan');
    vib([150]);
  } else banner('BROKEN UP', 'small', 'The refs pull them apart');
  G.bannerT = 2.4;
  if (w !== null) G.mom = { team: w, t: 25, dur: 25, src: 'fight' };
  const fw = w === 0 ? B.a : w === 1 ? B.b : null;
  feed(
    fw ? '#' + fw.num + ' ' + fw.name + ' wins the fight · speed boost 25s' : 'Fight broken up by the refs',
    w ?? -1,
  );
}
function finishBrawl() {
  const B = G.br,
    w = B && B.winner;
  for (const p of players) {
    p.jump = 0;
    p.hurtT = 0;
  }
  zoom(1);
  G.br = null;
  if (G.practice) {
    practiceOver(
      w === 0 ? 'YOU WIN THE FIGHT' : w === 1 ? 'YOU LOST THE FIGHT' : 'BROKEN UP',
      B
        ? 'You ' +
            Math.max(0, Math.round(B.hpA)) +
            ' HP · CPU ' +
            Math.max(0, Math.round(B.hpB)) +
            ' HP · ' +
            LABEL[settings.diffKey]
        : '',
    );
    return;
  }
  startReplay();
}
