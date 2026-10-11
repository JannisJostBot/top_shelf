import { clamp, pick, rnd } from '../core/math';
import { NAMES, ROLE_BASE, SKINS, TAPES } from '../data/roster';
import { kit } from './kit';
import { FACEV } from '../data/faces';

/* ---------- entities & rosters ---------- */
export const live = p => !p.benched;
function mk(team, role, slot) {
  return {
    team,
    role,
    slot,
    benched: false,
    dummy: false,
    x: 80,
    y: 128,
    vx: 0,
    vy: 0,
    saveT: 0,
    saveDir: 1,
    jump: 0,
    stickUp: false,
    fx: 0,
    fy: team ? 1 : -1,
    cool: 0,
    stun: 0,
    down: 0,
    fallDir: 1,
    boost: 0,
    imm: 0,
    pokeCd: 0,
    checkCd: 0,
    checkT: 0,
    checkTgt: null,
    checkSpd: 0,
    sprayCd: 0,
    passCd: 0,
    hold: 0,
    anim: 0,
    stride: 0,
    lastStride: 0,
    st: { spd: 1, sht: 1, hnd: 1, chk: 1, acc: 1, glove: 1 },
    look: { skin: '#f0c197', face: 'eyes', tape: '#15171d', skate: '#16181f', voice: 120 },
    name: '',
    num: 0,
    pal: null,
    ai: { dec: 0, lane: 0, dodge: false },
  };
}
export const players = [],
  SK = [[], []],
  GK = [];
for (const t of [0, 1]) {
  for (const s of ['C', 'W', 'D']) {
    const p = mk(t, 'S', s);
    players.push(p);
    SK[t].push(p);
  }
  const g = mk(t, 'G', 'G');
  players.push(g);
  GK[t] = g;
}
export const SKATERS = players.filter(p => p.role === 'S');
export function genRoster() {
  const usedN = new Set(),
    usedNum = new Set();
  for (const p of players) {
    let nm;
    do {
      nm = pick(NAMES);
    } while (usedN.has(nm));
    usedN.add(nm);
    p.name = nm.toUpperCase();
    let num;
    do {
      num = p.role === 'G' ? pick([1, 29, 30, 31, 35, 39, 40]) : 2 + Math.floor(rnd(0, 96));
    } while (usedNum.has(p.team + '-' + num));
    usedNum.add(p.team + '-' + num);
    p.num = num;
    const b = ROLE_BASE[p.slot];
    p.st = {
      spd: clamp(b.spd * rnd(0.94, 1.06), 0.88, 1.1),
      sht: clamp(b.sht * rnd(0.88, 1.12), 0.8, 1.25),
      hnd: clamp(b.hnd * rnd(0.88, 1.12), 0.8, 1.25),
      chk: clamp(b.chk * rnd(0.88, 1.12), 0.8, 1.3),
      acc: rnd(0.8, 1.2),
      glove: rnd(0.95, 1.05),
    };
    p.look = {
      skin: pick(SKINS),
      face: p.role === 'G' ? 'eyes' : pick(['eyes', 'visor', 'visor', 'cage']),
      tape: pick(TAPES),
      skate: Math.random() < 0.75 ? '#16181f' : '#eef1f5',
      voice: rnd(92, 150),
    };
  }
  buildPals();
}
export function buildPals() {
  for (const p of players)
    p.pal = Object.assign({}, kit.PAL[p.team], { S: p.look.skin, V: FACEV[p.look.face], K: p.look.skate });
}
