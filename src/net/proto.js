// The online protocol's pure parts: invite codes, player names, checks on every incoming message, and the mirror
// between the two players' views of the rink. No browser or network needed (tests/online.test.ts).
//
// The guest sees the match from the other end: everything the host sends is turned half a turn (x → W - x,
// y → H - y) and the teams swap (team t → 1 - t, player i → (i + 4) % 8, net n → 1 - n). The same mirror takes
// the guest's stick back into the host's view.
import { H, W } from '../config';

/** Bumped whenever the messages change, so old and new versions of the game do not try to play each other. */
export const PROTO = 1;

/* ---------- invite codes and secrets ---------- */
// Crockford's base32: no I, L, O or U, so a code read out loud or typed from a screenshot is hard to get wrong.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Invite codes are 24 characters: 120 random bits, far too many to guess or try out. */
export const CODE_LEN = 24;
function randomB32(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += B32[b & 31]; // 256 is a multiple of 32, so every character is equally likely
  return s;
}
/** A fresh invite code (also the password that encrypts the connection offers, see net/session.js). */
export const newCode = () => randomB32(CODE_LEN);
/** A fresh secret for the private room the two players move to once they found each other (160 bits). */
export const newSecret = () => randomB32(32);
/** A typed or pasted code as the canonical 24 characters, or null if it is not one. Forgiving: any case, spaces
 * and dashes, O for 0 and I or L for 1. Also accepts an invite link (the code after #join=). */
export function normCode(s) {
  if (typeof s !== 'string' || s.length > 300) return null;
  const m = s.match(/#join=([^&\s]+)/);
  if (m) s = m[1];
  const c = s.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return c.length === CODE_LEN && [...c].every(ch => B32.includes(ch)) ? c : null;
}
/** A code in groups of four, easier to read and compare: 7KQ2-…. */
export const fmtCode = c => c.match(/.{1,4}/g).join('-');
export const isSecret = s => typeof s === 'string' && s.length === 32 && [...s].every(ch => B32.includes(ch));

/* ---------- player names ---------- */
export const NAME_MAX = 12;
/** A player name as it is shown (capitals), or null when it is not a valid one: 2 to 12 letters, digits, spaces,
 * dots, dashes or underscores. Nothing else gets through, so a name can never carry markup. */
export function cleanName(s) {
  if (typeof s !== 'string') return null;
  const n = s.trim().replace(/\s+/g, ' ').toUpperCase();
  return /^[A-Z0-9][A-Z0-9 ._-]{1,11}$/.test(n) ? n : null;
}
/** Two names that would look the same on the scoreboard. */
export const sameName = (a, b) => cleanName(a) !== null && cleanName(a) === cleanName(b);

/* ---------- small checks ---------- */
export const fin = v => typeof v === 'number' && Number.isFinite(v);
export const inRange = (v, lo, hi) => fin(v) && v >= lo && v <= hi;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const COLOR = /^(#[0-9a-f]{3,8}|hsla?\([0-9., %]{5,40}\)|rgba?\([0-9., %]{5,40}\))$/i;
export const isColor = v => typeof v === 'string' && v.length <= 48 && COLOR.test(v);

/* ---------- the mirror ---------- */
export const mx = x => W - x;
export const my = y => H - y;
/** Player index in the other view: the teams swap and each keeps its slot order (3 skaters, then the goalie). */
export const mirrorIdx = i => (i >= 0 && i < 8 ? (i + 4) % 8 : -1);
export const otherTeam = t => (t === 0 || t === 1 ? 1 - t : t);

/* ---------- the guest's stick and buttons ---------- */
// [jx, jy, aimX, aimY, flags], in the sender's own view; flags: 1 shoot held, 2 shoot pressed, 4 shoot released,
// 8 pass, 16 switch, 32 aiming (aimX/Y valid), 64 mouse aim, 128 touch
export function packInput(inp, mouseAim) {
  const r = v => Math.round(v * 1000) / 1000,
    a = inp.aim;
  return [
    r(inp.jx),
    r(inp.jy),
    a ? r(a.x) : 0,
    a ? r(a.y) : 0,
    (inp.shootHeld ? 1 : 0) |
      (inp.sp ? 2 : 0) |
      (inp.sr ? 4 : 0) |
      (inp.pp ? 8 : 0) |
      (inp.swp ? 16 : 0) |
      (a ? 32 : 0) |
      (mouseAim ? 64 : 0) |
      (inp.touch ? 128 : 0),
  ];
}
/** A received input packet, checked and turned into the receiver's view; null if malformed. */
export function readInput(a) {
  if (!Array.isArray(a) || a.length !== 5 || !a.every(fin)) return null;
  let [jx, jy, ax, ay, f] = a;
  if (!isInt(f, 0, 255)) return null;
  // the stick is a direction with a strength of at most 1, the aim a direction
  const m = Math.hypot(jx, jy);
  if (m > 1) {
    jx /= m;
    jy /= m;
  }
  const am = Math.hypot(ax, ay);
  const aim = f & 32 && am > 0.01 ? { x: -ax / am, y: -ay / am } : null;
  return {
    jx: -jx,
    jy: -jy,
    aim,
    shootHeld: !!(f & 1),
    sp: !!(f & 2),
    sr: !!(f & 4),
    pp: !!(f & 8),
    swp: !!(f & 16),
    mouseAim: !!(f & 64),
    touch: !!(f & 128),
  };
}

/* ---------- the host's events, relayed to the guest ---------- */
// Only these go over; everything else (camera, layout, HUD refreshes, the menu) each side does for itself.
export const RELAY = new Set([
  'sound',
  'crowd',
  'goalMusic',
  'stopSong',
  'chime',
  'haptic',
  'pop',
  'ring',
  'bubble',
  'clearFx',
  'netHit',
  'resetCloth',
  'goalFx',
  'clearGoalFx',
  'goalLamp',
  'zoom',
  'banner',
  'hideBanner',
  'feed',
  'flash',
  'screen',
  'foCue',
  'zamRes',
]);
/** Whether the host sends this event to the guest (of the screens, only pause and the results card). */
export const relayed = (name, args) =>
  RELAY.has(name) && (name !== 'screen' || args[0] === 'pause' || args[0] === 'over');
/** One event argument for the wire: players and nets go as their index, the rest as plain data. */
export function encodeArg(a, refs, depth = 0) {
  if (a === null || a === undefined) return null;
  const t = typeof a;
  if (t === 'number') return fin(a) ? Math.round(a * 1000) / 1000 : 0;
  if (t === 'string' || t === 'boolean') return a;
  if (t !== 'object' || depth > 3) return null;
  const pi = refs.players.indexOf(a);
  if (pi >= 0) return { $p: pi };
  const ni = refs.nets.indexOf(a);
  if (ni >= 0) return { $n: ni };
  if (Array.isArray(a)) return a.slice(0, 64).map(v => encodeArg(v, refs, depth + 1));
  const o = {};
  for (const k of Object.keys(a).slice(0, 16)) {
    if (typeof a[k] === 'function') continue;
    o[k] = encodeArg(a[k], refs, depth + 1);
  }
  return o;
}
/** The reverse on the guest, mirrored: a player or net index becomes the matching one in this view. */
function decodeArg(a, refs, depth = 0) {
  if (a === null || typeof a !== 'object') return a;
  if (depth > 4) return null;
  if (Array.isArray(a)) return a.slice(0, 64).map(v => decodeArg(v, refs, depth + 1));
  if ('$p' in a) return isInt(a.$p, 0, 7) ? refs.players[mirrorIdx(a.$p)] : null;
  if ('$n' in a) return isInt(a.$n, 0, 1) ? refs.nets[1 - a.$n] : null;
  const o = {};
  for (const k of Object.keys(a).slice(0, 16))
    if (k !== '__proto__' && k !== 'constructor') o[k] = decodeArg(a[k], refs, depth + 1);
  return o;
}
const okText = (v, max = 160) => v === null || v === undefined || isStr(v, max);
const okNum = v => v === null || v === undefined || fin(v);
/**
 * A relayed event checked and put into the guest's view: [name, args] or null to drop it.
 * Positions are mirrored and team numbers swapped; anything of the wrong shape is dropped.
 */
export function decodeEvent(e, refs) {
  if (
    !Array.isArray(e) ||
    e.length !== 2 ||
    typeof e[0] !== 'string' ||
    !RELAY.has(e[0]) ||
    !Array.isArray(e[1])
  )
    return null;
  const name = e[0];
  if (e[1].length > 6) return null;
  const a = e[1].map(v => decodeArg(v, refs));
  switch (name) {
    case 'pop': // (x, y, text, colour, big)
      if (!fin(a[0]) || !fin(a[1]) || !okText(a[2], 40) || !(a[3] == null || isColor(a[3]))) return null;
      return [name, [mx(a[0]), my(a[1]), a[2], a[3], !!a[4]]];
    case 'ring': // (x, y, colour, size)
      if (!fin(a[0]) || !fin(a[1]) || !(a[2] == null || isColor(a[2])) || !okNum(a[3])) return null;
      return [name, [mx(a[0]), my(a[1]), a[2], a[3]]];
    case 'bubble': // (skater, text, delay)
      if (!a[0] || !okText(a[1], 40) || !okNum(a[2])) return null;
      return [name, [a[0], a[1], a[2]]];
    case 'netHit': // (net, x, power)
      if (!a[0] || !fin(a[1]) || !okNum(a[2])) return null;
      return [name, [a[0], mx(a[1]), a[2]]];
    case 'goalFx': // (puck style, x, y, top)
      if (!isStr(a[0], 24) || !fin(a[1]) || !fin(a[2])) return null;
      return [name, [a[0], mx(a[1]), my(a[2]), !a[3]]];
    case 'goalLamp': // ({ n, dt }) or null; dt is seconds from now
      if (a[0] === null) return [name, [null]];
      if (!a[0] || !a[0].n || !inRange(a[0].dt, 0, 10)) return null;
      return [name, [{ n: a[0].n, dt: a[0].dt }]];
    case 'feed': // (text, team)
      if (!isStr(a[0], 160) || !(a[1] === undefined || a[1] === null || isInt(a[1], -1, 1))) return null;
      return [name, [a[0], otherTeam(a[1] ?? -1)]];
    case 'banner': // (text, class, subtitle, big)
      if (!isStr(a[0], 60) || !okText(a[1], 40) || !okText(a[2], 120)) return null;
      return [name, [a[0], a[1], a[2], !!a[3]]];
    case 'sound': // (name, options): options may name skaters (already mapped) and plain values
      if (!isStr(a[0], 24) || !(a[1] === undefined || a[1] === null || typeof a[1] === 'object' || fin(a[1])))
        return null;
      return [name, [a[0], a[1]]];
    case 'haptic':
      if (!(fin(a[0]) || (Array.isArray(a[0]) && a[0].length <= 12 && a[0].every(v => inRange(v, 0, 1000)))))
        return null;
      return [name, [a[0]]];
    case 'crowd':
    case 'stopSong':
    case 'zoom':
    case 'flash':
      if (!okNum(a[0])) return null;
      return [name, [a[0]]];
    case 'goalMusic': // (team) – the guest's own goal song plays
      return [name, [otherTeam(a[0])]];
    case 'screen': // only the pause screen and the results card come over
      if (a[0] === 'pause' && (typeof a[1] === 'boolean' || (a[1] && typeof a[1] === 'object')))
        return [
          name,
          [
            'pause',
            typeof a[1] === 'boolean' ? a[1] : { on: !!a[1].on, by: isStr(a[1].by, 16) ? a[1].by : '' },
          ],
        ];
      if (a[0] === 'over' && a[1] && typeof a[1] === 'object') {
        const r = a[1];
        if (![r.kicker, r.title, r.score, r.again].every(v => isStr(v, 80)) || !isInt(r.winner, 0, 1))
          return null;
        return [
          name,
          [
            'over',
            {
              kicker: r.kicker,
              title: r.title,
              winner: r.winner,
              score: r.score,
              record: '',
              again: r.again,
            },
          ],
        ];
      }
      return null;
    case 'foCue':
    case 'zamRes':
      return a[0] && typeof a[0] === 'object' ? [name, [a[0]]] : null;
    default:
      return [name, a.map(v => (v && typeof v === 'object' ? null : v))];
  }
}

/* ---------- other messages ---------- */
/** The match setup the host sends the guest: checked field by field against what this game knows. */
export function readConfig(c, known) {
  if (!c || typeof c !== 'object') return null;
  const names = Array.isArray(c.names) && c.names.length === 2 ? c.names.map(cleanName) : null;
  if (!names || !names[0] || !names[1]) return null;
  const pairOf = (v, table) =>
    Array.isArray(v) && v.length === 2 && v.every(k => typeof k === 'string' && Object.hasOwn(table, k));
  if (!pairOf(c.colors, known.colors) || c.colors[0] === c.colors[1] || !pairOf(c.sticks, known.sticks))
    return null;
  if (typeof c.arena !== 'string' || !Object.hasOwn(known.arenas, c.arena)) return null;
  if (typeof c.puck !== 'string' || !Object.hasOwn(known.pucks, c.puck)) return null;
  if (!known.lengths.includes(c.len) || !['classic', 'realistic'].includes(c.style)) return null;
  if (!Array.isArray(c.roster) || c.roster.length !== 8) return null;
  const roster = [];
  for (let i = 0; i < 8; i++) {
    const r = c.roster[i];
    if (!r || typeof r !== 'object' || !r.st || !r.look) return null;
    const goalie = i % 4 === 3,
      name =
        typeof r.name === 'string'
          ? r.name
              .toUpperCase()
              .replace(/[^A-Z0-9 '.-]/g, '')
              .slice(0, 18)
          : '';
    if (!name || !isInt(r.num, 0, 99)) return null;
    if (goalie ? r.slot !== 'G' : !['C', 'W', 'D'].includes(r.slot)) return null;
    const st = {};
    for (const k of ['spd', 'sht', 'hnd', 'chk', 'acc', 'glove']) {
      if (!inRange(r.st[k], 0.5, 1.5)) return null;
      st[k] = r.st[k];
    }
    const L = r.look;
    if (
      !isColor(L.skin) ||
      !isColor(L.tape) ||
      !isColor(L.skate) ||
      !known.faces.includes(L.face) ||
      !inRange(L.voice, 40, 260)
    )
      return null;
    roster.push({
      name,
      num: r.num,
      slot: r.slot,
      st,
      look: { skin: L.skin, face: L.face, tape: L.tape, skate: L.skate, voice: L.voice },
    });
  }
  return {
    names,
    colors: c.colors,
    sticks: c.sticks,
    arena: c.arena,
    puck: c.puck,
    len: c.len,
    style: c.style,
    cel: !!c.cel,
    zam: !!c.zam,
    roster,
  };
}
/** Draw report from the guest: { id, early } or { id, rt }. */
export function readReport(m) {
  if (!isInt(m.id, 1, 1e9)) return null;
  if (m.e === 1) return { id: m.id, early: true, rt: null };
  return inRange(m.rt, 0, 10) ? { id: m.id, early: false, rt: m.rt } : null;
}
/** A resurfacer position: x, y, heading, speed and seconds into the run. */
export function readZamPos(m) {
  return ['x', 'y', 'a', 'v', 'e'].every(k => fin(m[k])) && Math.abs(m.a) < 1e4 && inRange(m.v, -1, 200)
    ? { x: m.x, y: m.y, a: m.a, v: m.v, e: m.e }
    : null;
}

/* ---------- rate limiting ---------- */
/** A token bucket: up to `burst` messages at once, `rate` a second on average. take() is false when over. */
export function bucket(rate, burst, now = () => performance.now() / 1000) {
  let tokens = burst,
    last = now();
  return {
    take() {
      const t = now();
      tokens = Math.min(burst, tokens + (t - last) * rate);
      last = t;
      if (tokens < 1) return false;
      tokens--;
      return true;
    },
  };
}
