import { describe, expect, it, vi } from 'vitest';
import { GB, GT, H, NETS, STEP, W } from '../src/config';
import { clearEvents, on } from '../src/core/events';
import { clock } from '../src/core/time';
import { COLORS } from '../src/data/teams';
import { STICKS } from '../src/data/sticks';
import { STADIUMS } from '../src/data/stadiums';
import { PUCKS } from '../src/data/pucks';
import { FACEV } from '../src/data/faces';
import { setRelay } from '../src/game/fx';
import { goalScored, startGame } from '../src/game/match';
import { net, rinput, seat1 } from '../src/game/online';
import { players, SK } from '../src/game/players';
import { duelist } from '../src/game/states/brawl';
import { foReport } from '../src/game/states/faceoff';
import { zamRemote, zamRemoteDone, ZAM_ONLINE } from '../src/game/states/zamboni';
import { voteFight } from '../src/game/replay';
import { update } from '../src/game/update';
import { G as world, puck } from '../src/game/world';
import { input, pad } from '../src/input/state';
import { settings } from '../src/settings';
import {
  bucket,
  cleanName,
  decodeEvent,
  encodeArg,
  fmtCode,
  newCode,
  normCode,
  packInput,
  readConfig,
  readInput,
  mirrorIdx,
  relayed,
  sameName,
} from '../src/net/proto';
import { SCORE_AT, SNAP_LEN, applySnap, packSnap, snapOk } from '../src/net/snap';

const G: any = world; // (inferred from plain JS, which knows nothing of the online fields)

describe('invite codes and names', () => {
  it('makes long random codes and reads them back however they are typed', () => {
    const a = newCode(),
      b = newCode();
    expect(a).toHaveLength(24);
    expect(a).not.toBe(b);
    expect(normCode(a)).toBe(a);
    expect(normCode(fmtCode(a).toLowerCase())).toBe(a);
    expect(normCode(' ' + fmtCode(a).replace(/-/g, ' ') + ' ')).toBe(a);
    expect(normCode('https://example.org/game/#join=' + fmtCode(a))).toBe(a);
    // O for zero and I or L for one are forgiven
    expect(normCode('O'.repeat(24))).toBe('0'.repeat(24));
    expect(normCode('il'.repeat(12))).toBe('1'.repeat(24));
    // too short, too long, or letters that are not in the alphabet
    expect(normCode(a.slice(1))).toBeNull();
    expect(normCode(a + 'A')).toBeNull();
    expect(normCode('U'.repeat(24))).toBeNull();
    expect(normCode(42 as any)).toBeNull();
  });
  it('only lets plain names through', () => {
    expect(cleanName('  ice   cold ')).toBe('ICE COLD');
    expect(cleanName('jo')).toBe('JO');
    expect(cleanName('j')).toBeNull();
    expect(cleanName('thirteen chars')).toBeNull();
    expect(cleanName('<b>hi</b>')).toBeNull();
    expect(cleanName('a"b')).toBeNull();
    expect(cleanName('-dash')).toBeNull();
    expect(cleanName(null as any)).toBeNull();
    expect(sameName('Hosty', ' hOSTY ')).toBe(true);
    expect(sameName('Hosty', 'Guesty')).toBe(false);
  });
});

describe('messages from the other player', () => {
  it('mirrors the stick into the host view and clamps it', () => {
    const inp = {
      jx: 3,
      jy: 4,
      aim: { x: 0, y: -1 },
      shootHeld: true,
      sp: true,
      sr: false,
      pp: false,
      swp: true,
      touch: false,
    };
    const r = readInput(packInput(inp, true))!;
    expect(Math.hypot(r.jx, r.jy)).toBeCloseTo(1);
    expect(r.jx).toBeCloseTo(-0.6);
    expect(r.jy).toBeCloseTo(-0.8);
    expect(r.aim).toEqual({ x: -0, y: 1 });
    expect([r.shootHeld, r.sp, r.sr, r.pp, r.swp, r.mouseAim]).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(readInput([0, 0, 0, 0, 999])).toBeNull();
    expect(readInput([NaN, 0, 0, 0, 0])).toBeNull();
    expect(readInput('nope' as any)).toBeNull();
  });
  it('relays only known events, mirrored, and drops malformed ones', () => {
    const refs = { players, nets: NETS };
    const pop = decodeEvent(['pop', [10, 20, 'BIG HIT!', '#ffffff', true]], refs)!;
    expect(pop[1].slice(0, 2)).toEqual([W - 10, H - 20]);
    expect(decodeEvent(['feed', ['GOAL', 0]], refs)![1]).toEqual(['GOAL', 1]);
    expect(decodeEvent(['bubble', [{ $p: 0 }, null, 0.2]], refs)![1][0]).toBe(players[4]);
    expect(decodeEvent(['netHit', [{ $n: 0 }, 70, 1.5]], refs)![1][0]).toBe(NETS[1]);
    expect(decodeEvent(['layout', []], refs)).toBeNull(); // not relayed
    expect(decodeEvent(['banner', ['x'.repeat(500)]], refs)).toBeNull();
    expect(decodeEvent(['pop', [1, 2, 'x', 'url(javascript:1)']], refs)).toBeNull();
    expect(decodeEvent(['screen', ['menu']], refs)).toBeNull();
    expect(decodeEvent(['sound', [{ $p: 99 }]], refs)).toBeNull();
    expect(decodeEvent({} as any, refs)).toBeNull();
  });
  it('checks the match setup field by field', () => {
    const known = {
      colors: COLORS,
      sticks: STICKS,
      arenas: STADIUMS,
      pucks: PUCKS,
      lengths: [30, 60, 120, 180, 300],
      faces: Object.keys(FACEV),
    };
    const roster = players.map((p, i) => ({
      name: 'PLAYER ' + i,
      num: 10 + i,
      slot: i % 4 === 3 ? 'G' : 'CWD'[i % 4],
      st: { spd: 1, sht: 1, hnd: 1, chk: 1, acc: 1, glove: 1 },
      look: { skin: '#f3cfae', face: 'eyes', tape: '#15171d', skate: '#16181f', voice: 120 },
    }));
    const ok = {
      names: ['Hosty', 'Guesty'],
      colors: ['blue', 'red'],
      sticks: ['wood', 'wood'],
      arena: 'frost',
      puck: 'classic',
      len: 60,
      style: 'classic',
      cel: true,
      zam: true,
      roster,
    };
    expect(readConfig(ok, known)!.names).toEqual(['HOSTY', 'GUESTY']);
    expect(readConfig({ ...ok, colors: ['blue', 'blue'] }, known)).toBeNull();
    expect(readConfig({ ...ok, arena: '__proto__' }, known)).toBeNull();
    expect(readConfig({ ...ok, len: 7 }, known)).toBeNull();
    expect(readConfig({ ...ok, names: ['<img>', 'x'] }, known)).toBeNull();
    expect(readConfig({ ...ok, roster: roster.slice(1) }, known)).toBeNull();
    const bad = roster.map(r => ({ ...r, st: { ...r.st, spd: 9 } }));
    expect(readConfig({ ...ok, roster: bad }, known)).toBeNull();
    const evil = roster.map(r => ({ ...r, look: { ...r.look, skin: 'red;background:url(x)' } }));
    expect(readConfig({ ...ok, roster: evil }, known)).toBeNull();
    expect(
      readConfig({ ...ok, roster: roster.map(r => ({ ...r, name: '<script>x' })) }, known)!.roster[0].name,
    ).toBe('SCRIPTX');
  });
  it('rate-limits a flood', () => {
    let t = 0;
    const b = bucket(10, 5, () => t);
    let n = 0;
    for (let i = 0; i < 100; i++) if (b.take()) n++;
    expect(n).toBe(5);
    t = 1;
    for (let i = 0; i < 100; i++) if (b.take()) n++;
    expect(n).toBe(10);
  });
});

// The host runs a whole online match in Node against a scripted guest: the guest's stick comes in through rinput,
// its face-off times through foReport, its resurfacing through zamRemote/zamRemoteDone, and every event the host
// relays must survive the trip to the guest's decoder.
describe('online match on the host', () => {
  it('plays a full match with a second human on team 1', () => {
    expect(typeof document).toBe('undefined');
    clearEvents();
    const screens: string[] = [];
    on('screen', (n: string) => screens.push(n));
    settings.periodLen = 30;
    settings.zamOn = true;
    settings.celOn = true;
    net.names = ['HOSTY', 'GUESTY'];
    net.rtt = 0.05;
    let sent = 0,
      undecodable: string[] = [];
    const refs = { players, nets: NETS };
    setRelay((name: string, args: any[]) => {
      if (!relayed(name, args)) return;
      sent++;
      if (name === 'goalLamp' && args[0]) args = [{ n: args[0].n, dt: 1 }];
      const e = [name, args.map(a => JSON.parse(JSON.stringify(encodeArg(a, refs))))];
      if (!decodeEvent(e, refs)) undecodable.push(name);
    });
    startGame(false, true);
    expect(G.net).toBe('host');
    let rnd = 7;
    const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    let reported = -1,
      draws = 0,
      zamSent = false,
      zamE = 0,
      sawZam = false,
      seat1Moved = 0;
    const lastPos = new Map();
    for (let i = 0; i < Math.floor(900 / STEP) && G.state !== 'over'; i++) {
      clock.now += STEP;
      // both players: chase the puck, carry it at the other net and shoot (the host's through its own input)
      if (G.state === 'play') {
        for (const t of [0, 1]) {
          const st: any = t ? seat1 : G,
            inp: any = t ? rinput : input,
            me = st.controlled;
          if (!me) continue;
          const gy = t ? GB : GT;
          let tx = puck.x,
            ty = puck.y;
          if (puck.owner === me) {
            tx = 80;
            ty = gy;
            const near = Math.abs(me.y - gy) < 70;
            if (near && !inp.shootHeld && r() < 0.1) {
              inp.shootHeld = true;
              inp.sp = true;
            } else if (inp.shootHeld && r() < 0.15) {
              inp.shootHeld = false;
              inp.sr = true;
            }
          } else {
            inp.shootHeld = false;
            if (r() < 0.03) inp.sp = true;
            if (r() < 0.01) inp.pp = true;
          }
          const dx = tx - me.x,
            dy = ty - me.y,
            d = Math.hypot(dx, dy) || 1;
          if (t) {
            rinput.jx = dx / d;
            rinput.jy = dy / d;
          } else {
            pad.x = dx / d;
            pad.y = dy / d;
          }
        }
        const me: any = seat1.controlled;
        const lp = lastPos.get(me);
        if (me && lp && Math.hypot(me.x - lp.x, me.y - lp.y) > 0.01) seat1Moved++;
        lastPos.set(me, { x: me && me.x, y: me && me.y });
      }
      // its face-off: a quick, a slow or an early press
      if (G.state === 'faceoff' && G.fo.id !== reported) {
        if (G.fo.phase === 'drop' && G.fo.t > 0.05) {
          reported = G.fo.id;
          draws++;
          const k = draws % 3;
          foReport(G.fo.id, k === 2, k === 0 ? 0.18 : 0.4);
        }
      }
      // its resurfacing: lawnmower lines across its half, then the count it claims (a little more than its path)
      if (G.state === 'zamboni') {
        sawZam = true;
        if (G.zam && G.zam.phase === 'drive' && !zamSent) {
          zamE += STEP;
          if (i % 3 === 0) {
            const lane = Math.floor(zamE / 3.4),
              u = (zamE % 3.4) / 3.4,
              x = 16 + u * 128,
              y = 140 + lane * 16;
            zamRemote({
              x: lane % 2 ? 160 - x : x,
              y: Math.min(240, y),
              a: lane % 2 ? -Math.PI / 2 : Math.PI / 2,
              v: 40,
              e: zamE,
            });
          }
          if (zamE >= ZAM_ONLINE.time) {
            zamSent = true;
            zamRemoteDone(G.zam2.count + 400); // claims far more than its path showed
          }
        }
      } else {
        zamSent = false;
        zamE = 0;
      }
      update(STEP);
    }
    setRelay(null);
    pad.x = pad.y = 0;
    expect(G.state).toBe('over');
    expect(screens.at(-1)).toBe('over');
    expect(seat1Moved).toBeGreaterThan(50); // the guest steered its skater
    expect(draws).toBeGreaterThanOrEqual(3);
    expect(G.stats.fo[1]).toBeGreaterThan(0); // its quick draws won
    expect(G.stats.fo[0]).toBeGreaterThan(0); // its slow and early ones lost
    expect(sawZam).toBe(true);
    expect(net.disputes).toBeGreaterThan(0); // the inflated resurfacing claim was not believed
    expect(sent).toBeGreaterThan(50);
    expect(undecodable).toEqual([]);
    // a snapshot of the final state is well-formed and mirrors onto the other end of the rink
    const s = packSnap();
    expect(s).toHaveLength(SNAP_LEN);
    expect(snapOk(s)).toBe(true);
    expect([s[SCORE_AT], s[SCORE_AT + 1]]).toEqual(G.score); // (where the guest reads each frame's score)
    const before = players.map(p => ({ x: p.x, y: p.y })),
      score = G.score.slice();
    applySnap(s, null, 0);
    players.forEach((p, i) => {
      const o = before[(i + 4) % 8];
      expect(p.x).toBeCloseTo(W - o.x, 1);
      expect(p.y).toBeCloseTo(H - o.y, 1);
    });
    expect(G.score).toEqual([score[1], score[0]]);
    expect(SK[1]).toHaveLength(3);
    clearEvents();
  });
});

// A fight online: after a goal by either side, the two players fight each other. The host's script blocks every
// wind-up it sees and punishes an open guest; the guest's swings at random and blocks now and then.
describe('online fight', () => {
  it('starts when both players vote for it during the replay, lets both punch and block, and boosts the winner', () => {
    clearEvents();
    // (the same match every run: damage and the CPU teams roll dice)
    let seed = 5;
    const rand = vi
      .spyOn(Math, 'random')
      .mockImplementation(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
    const banners: string[] = [],
      guestBanners: string[] = [];
    on('banner', (t: string) => banners.push(t));
    const refs = { players, nets: NETS };
    setRelay((name: string, args: any[]) => {
      if (!relayed(name, args)) return;
      if (name === 'goalLamp' && args[0]) args = [{ n: args[0].n, dt: 1 }];
      const d = decodeEvent([name, args.map(a => JSON.parse(JSON.stringify(encodeArg(a, refs))))], refs);
      expect(d).not.toBeNull();
      if (name === 'banner') guestBanners.push(d![1][0]);
    });
    settings.fightsOn = true;
    settings.celOn = true;
    settings.periodLen = 120;
    net.names = ['HOSTY', 'GUESTY'];
    net.rtt = 0.08;
    startGame(false, true);
    // into play (the guest's face-off times reported as they come)
    for (let i = 0; i < 4000 && G.state !== 'play'; i++) {
      clock.now += STEP;
      if (G.state === 'faceoff' && G.fo.phase === 'drop') foReport(G.fo.id, false, 0.3);
      update(STEP);
    }
    expect(G.state).toBe('play');
    const host = G.controlled,
      guest = seat1.controlled;
    // (a second of play, so the replay has something to show)
    for (let i = 0; i < 60 && G.state === 'play'; i++) {
      clock.now += STEP;
      update(STEP);
    }
    // the guest scores: no random fight online, the replay offers the vote instead
    G.fightP = 1;
    goalScored(1, NETS[0]);
    expect(G.brawlNext).toBe(false);
    for (let i = 0; i < 2000 && G.state !== 'replay'; i++) {
      clock.now += STEP;
      update(STEP);
    }
    expect(G.state).toBe('replay');
    expect(G.rp.votes).toEqual([false, false]);
    // one vote is not enough, and a vote can be taken back
    voteFight(1, true);
    voteFight(1, false);
    voteFight(0, true);
    expect(G.state).toBe('replay');
    voteFight(1, true);
    expect(G.state).toBe('brawl');
    const B = G.br;
    expect(B.duel).toBe(true);
    expect(B.voted).toBe(true);
    expect([B.a, B.b]).toEqual([host, guest]);
    let rnd = 11;
    const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    let blocked = 0,
      guestBlocks = 0,
      guestHits = 0,
      snap: number[] | null = null,
      hp = [100, 100];
    for (let i = 0; i < Math.floor(30 / STEP) && G.state === 'brawl'; i++) {
      clock.now += STEP;
      if (B.phase === 'fight') {
        if (B.opp.st === 'wind') input.pp = true;
        else if (B.opp.st === 'open' || B.opp.st === 'recover' || r() < 0.04) input.sp = true;
        if (B.me.st === 'wind' && r() < 0.08) rinput.pp = true;
        else if (r() < 0.015) rinput.sp = true;
      }
      const st = [B.me.st, B.opp.st];
      update(STEP);
      if (st[1] === 'wind' && B.opp.st === 'open') blocked++;
      if (st[0] === 'wind' && B.me.st === 'open') guestBlocks++;
      if (B.hpA < hp[0]) guestHits++;
      hp = [B.hpA, B.hpB];
      if (!snap && B.phase === 'fight' && B.hpB < 100) snap = packSnap();
    }
    // both block (the host every swing it sees coming), and both land punches
    expect(blocked).toBeGreaterThan(0);
    expect(guestBlocks).toBeGreaterThan(0);
    expect(guestHits).toBeGreaterThan(0);
    expect(B.hpB).toBeLessThanOrEqual(0);
    expect(B.winner).toBe(0);
    expect(G.mom).toMatchObject({ team: 0, t: expect.any(Number), src: 'fight' });
    expect(G.mom.t).toBeGreaterThan(20);
    expect(G.state).toBe('faceoff'); // (the replay was already shown: on to the face-off)
    expect(G.br).toBeNull();
    // each side reads its own result
    expect(banners).toContain('YOU WIN THE FIGHT');
    expect(guestBanners).toContain('YOU LOST THE FIGHT');
    expect(guestBanners).not.toContain('YOU WIN THE FIGHT');
    setRelay(null);
    // the fight in a snapshot, mirrored for the guest: its own fighter (the host's second) is fighter a there
    expect(snap).not.toBeNull();
    expect(snapOk(snap)).toBe(true);
    const gb: any = { me: duelist(), opp: duelist() };
    G.br = gb;
    applySnap(snap, null, 0);
    expect(gb.a).toBe(players[mirrorIdx(players.indexOf(guest))]);
    expect(gb.b).toBe(players[mirrorIdx(players.indexOf(host))]);
    expect(gb.phase).toBe('fight');
    expect(gb.hpA).toBeLessThan(100); // the guest's own health, hit by the host
    expect(gb.hpB).toBe(100);
    G.br = null;
    // once a match: the next replay offers no vote
    const goalAndReplay = () => {
      for (let i = 0; i < 4000 && G.state !== 'play'; i++) {
        clock.now += STEP;
        if (G.state === 'faceoff' && G.fo.phase === 'drop') foReport(G.fo.id, false, 0.3);
        update(STEP);
      }
      for (let i = 0; i < 60 && G.state === 'play'; i++) {
        clock.now += STEP;
        update(STEP);
      }
      goalScored(0, NETS[1]);
      for (let i = 0; i < 2000 && G.state !== 'replay'; i++) {
        clock.now += STEP;
        update(STEP);
      }
      expect(G.state).toBe('replay');
    };
    goalAndReplay();
    expect(G.rp.votes).toBeNull();
    // and none with fights turned off
    startGame(false, true);
    settings.fightsOn = false;
    goalAndReplay();
    expect(G.rp.votes).toBeNull();
    settings.fightsOn = true;
    rand.mockRestore();
    clearEvents();
  });
});
