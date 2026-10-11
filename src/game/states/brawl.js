import { S } from '../../audio/sfx';
import { $ } from '../../core/dom';
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
import { vib } from '../../input/haptics';
import { input } from '../../input/state';
import { view } from '../../render/canvas';
import { AMB, CY } from '../../render/colors';
import { bubble, pop } from '../../render/effects';
import { reduceMotion, settings } from '../../settings';
import { banner, hideBanner } from '../../ui/hud';

/* ---------- brawl minigame ---------- */

const FIGHT = {
  rookie: { wind: 0.5, idle: [0.8, 1.4], guard: 0.3, counter: 0.3, dmg: [8, 12] },
  pro: { wind: 0.36, idle: [0.35, 0.8], guard: 0.45, counter: 0.55, dmg: [10, 15] },
  allstar: { wind: 0.29, idle: [0.2, 0.5], guard: 0.55, counter: 0.7, dmg: [12, 17] },
};
export function startBrawl() {
  const a = G.lastShooter && G.lastShooter.team === 0 ? G.lastShooter : G.controlled || SK[0][0],
    b = nearest(SK[1], a);
  const m = { x: clamp((a.x + b.x) / 2, 32, 128), y: clamp((a.y + b.y) / 2, 52, 204) };
  G.state = 'brawl';
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
    opp: { st: 'idle', t: rnd(0.6, 1.1), punchT: 0, blockT: 0 },
    me: { punchCd: 0, blockT: 0, blockCd: 0, stun: 0, punchT: 0 },
  };
  for (const f of [a, b]) {
    f.jump = 0;
    f.stickUp = false;
    f.down = 0;
    f.stun = 0;
    f.checkT = 0;
    G.br.litter.push(
      { x: f.x - 2, y: f.y + 2, t: 'g', c: kit.PAL[f.team].G },
      { x: f.x + 2, y: f.y + 3, t: 'g', c: kit.PAL[f.team].G },
      { x: f.x, y: f.y + 4, t: 's', c: f.look.tape },
    );
  }
  view.camZ = settings.viewMode === 'close' ? 3 : 2;
  hideBanner();
  $('rpBar').hidden = true;
  G.hype = 0.9;
  bubble(b, '?&!*#!', 0);
  banner('GLOVES OFF!', 'away', '#' + b.num + ' ' + b.name + ' wants a piece of you');
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
    input.sp = input.pp = input.swp = input.sr = false;
    if (B.t > 1.2) {
      B.phase = 'fight';
      B.t = 0;
      banner('FIGHT!', 'alert', 'PUNCH to hit · BLOCK when they wind up');
      G.bannerT = 1.3;
      S('bell');
    }
    return;
  }
  if (B.phase === 'end') {
    input.sp = input.pp = input.swp = input.sr = false;
    B.endT -= dt;
    const w = B.winner === 0 ? a : B.winner === 1 ? b : null;
    if (w) w.jump = Math.abs(Math.sin(B.t * 10)) * 4;
    if (B.endT <= 0) finishBrawl();
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
  if (w === 0) {
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
}
function finishBrawl() {
  const B = G.br,
    w = B && B.winner;
  for (const p of players) {
    p.jump = 0;
    p.hurtT = 0;
  }
  view.camZ = 1;
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
