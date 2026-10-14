// The connection to the other player: a direct WebRTC link through Trystero, found via public Nostr relays.
// There is no game server. What this does to keep your IP address between you and the person you invited:
//  - Nothing loads or connects until you host or join: single-player never talks to the network (dynamic import).
//  - Invite codes are 120 random bits. The code is also the password the connection offers (which contain IP
//    addresses) are encrypted with on their way through the relays, so a relay, or anyone without the code, sees
//    only a hash of the room and ciphertext, never an address.
//  - A room takes one guest. Anyone else who connects is turned away in the handshake, before they are let in, and
//    a guest only accepts the host (two guests that met in the room drop each other).
//  - The code works once: as soon as the guest is in, the host sends a fresh secret over the encrypted link, both
//    move to a private room named by it, and the host leaves the invite room. The code leads nowhere afterwards.
//  - Only one company's STUN server (needed to get through home routers, it sees your address like any website you
//    visit), no TURN: the match never runs through someone else's server. A few relays (not all of them) are used.
//  - Every message is size-limited, rate-limited and checked before the game uses it (net/proto.js).
// Two channels run over the one connection: Trystero's, reliable and in order, for everything that must arrive,
// and a second one of our own that neither resends nor waits (send fast()) for what is stale by the time a lost
// packet could be sent again: the host's snapshots and the guest's stick. A lost packet there costs that packet
// only, instead of holding up everything behind it until it is sent again.
// What it cannot hide: the relays see that your address uses the game, and the other player necessarily learns
// your address, as with any direct connection.
import { PROTO, bucket, cleanName, isSecret, newCode, newSecret, sameName } from './proto';

const APP_ID = 'top-shelf-hockey/online/1';
const BASE = {
  appId: APP_ID,
  relayConfig: { redundancy: 4, warnOnRelayFailure: false },
  rtcConfig: { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] },
  maxReceiveBytes: 256 * 1024,
};
const HANDSHAKE_MS = 8000,
  FIND_MS = 45000, // a guest gives up looking for the host after this
  MOVE_MS = 40000, // moving to the private room
  MAX_MSG = 16 * 1024, // bytes
  FAST_ID = 42, // the fast channel's number, agreed in advance on both sides (so it needs no extra signalling)
  FAST_MAX = 4 * 1024, // bytes: a snapshot is about 600
  FAST_TYPES = new Set(['f', 'i', 'h', 'H']); // all the fast channel carries (h: hello and H: its answer, see sendFast())

let lib = null;
const load = async () => (lib ??= await import('trystero'));

/** The live link: who we are, who is on the other end. */
export const link = {
  role: /** @type {null | 'host' | 'guest'} */ (null),
  me: '',
  peer: '',
  connected: false,
};
let invite = null, // the invite room (host: until the guest is in; guest: until the move)
  room = null, // the private room the match runs in
  peerId = null,
  sendRaw = null,
  fastCh = null,
  fastHeard = false, // something came in over the fast channel: the other side has it open too
  helloAt = 0,
  ev = {},
  pingTimer = 0,
  timer = 0,
  pending = null,
  secret = null,
  rtts = [],
  gen = 0; // bumps on every leave, so callbacks from an old attempt are ignored

/** Ends everything: both rooms left, timers stopped. */
export function leave() {
  gen++;
  clearInterval(pingTimer);
  clearTimeout(timer);
  for (const r of [invite, room])
    try {
      r && r.leave();
    } catch (e) {}
  invite = room = null;
  closeFast();
  peerId = sendRaw = pending = secret = null;
  link.role = null;
  link.peer = '';
  link.connected = false;
  rtts = [];
}
/** Leaves in a moment (so a goodbye just sent still goes out), unless something new started meanwhile. */
export function leaveSoon() {
  const g = gen;
  setTimeout(() => {
    if (g === gen) leave();
  }, 200);
}
/** Sends a message to the other player (dropped when not connected). */
export function send(msg) {
  if (!sendRaw || !peerId) return;
  try {
    sendRaw(msg, { target: peerId }).catch(() => {});
  } catch (e) {}
}
/** Sends a message that is worthless once late (a snapshot, the stick): over the fast channel, which drops it if
 * it gets lost, or over the reliable one until the fast one is open. */
export function sendFast(msg) {
  const ch = fastCh;
  if (!ch || ch.readyState !== 'open') return send(msg);
  // until the other side is heard on it, the reliable channel carries the message and the fast one a hello
  // (so a side that could not open the fast channel never misses anything)
  if (!fastHeard) {
    send(msg);
    const now = performance.now();
    if (now - helloAt < 300) return;
    helloAt = now;
    msg = { t: 'h' };
  }
  // (a channel this far behind is congested: a newer message will follow soon enough)
  if (ch.bufferedAmount > 8 * FAST_MAX) return;
  try {
    ch.send(JSON.stringify(msg));
  } catch (e) {}
}
// (a connection Trystero reuses keeps its fast channel: the same number cannot be opened twice on it)
const fastOf = new WeakMap();
function closeFast() {
  if (fastCh) fastCh.onmessage = null;
  fastCh = null;
  fastHeard = false;
  helloAt = 0;
}
/** The fast channel on the connection to the other player: unordered, never resent. Both sides open it with the
 * same number, so it is there as soon as the connection is (no offer and answer of its own). */
function openFast(g, id, accept) {
  closeFast();
  const pc = room && room.getPeers()[id];
  if (!pc || typeof pc.createDataChannel !== 'function') return;
  let ch = fastOf.get(pc);
  if (!ch || ch.readyState === 'closing' || ch.readyState === 'closed')
    try {
      ch = pc.createDataChannel('fast', { negotiated: true, id: FAST_ID, ordered: false, maxRetransmits: 0 });
      fastOf.set(pc, ch);
    } catch (e) {
      return;
    }
  fastCh = ch;
  ch.onmessage = e => {
    if (g !== gen || ch !== fastCh || typeof e.data !== 'string' || e.data.length > FAST_MAX) return;
    let data;
    try {
      data = JSON.parse(e.data);
    } catch (err) {
      return;
    }
    if (!data || typeof data !== 'object' || !FAST_TYPES.has(data.t)) return;
    fastHeard = true;
    if (data.t === 'h')
      try {
        ch.send('{"t":"H"}');
      } catch (err) {}
    accept(data, true);
  };
}
const fail = msg => {
  const f = ev.error;
  leave();
  if (f) f(msg);
};
const why = {
  full: 'That room already has two players.',
  name: 'That name is taken in this room. Pick another one.',
  badname: 'That name cannot be used.',
  version: 'The other player runs a different version of the game. Both reload the page and try again.',
};

/**
 * Hosts a room. `events`: code(code) once the code is ready, status(text), connected(peerName), lost(),
 * back(), message(msg), closed(), error(text).
 */
export async function host(name, events) {
  leave();
  const me = cleanName(name);
  if (!me) throw new Error(why.badname);
  const g = gen;
  const { joinRoom } = await load();
  if (g !== gen) return;
  ev = events;
  link.role = 'host';
  link.me = me;
  const code = newCode();
  invite = joinRoom({ ...BASE, password: code }, 'invite:' + code, {
    handshakeTimeoutMs: HANDSHAKE_MS,
    onJoinError: d => {
      if (pending && d && d.peerId === pending.id) pending = null;
    },
    onPeerHandshake: async (id, hsSend, receive) => {
      await hsSend({ v: PROTO, role: 'host', name: me });
      const { data: h } = await receive();
      if (!h || typeof h !== 'object' || h.role !== 'guest') throw new Error('not a guest');
      // turned away: say why, and give the guest a moment to read it before the connection closes
      const deny = async w => {
        await hsSend({ ok: false, why: w });
        await Promise.race([receive(), new Promise(r => setTimeout(r, 2000))]);
        throw new Error('denied: ' + w);
      };
      if (h.v !== PROTO) await deny('version');
      const nm = cleanName(h.name);
      if (!nm) await deny('badname');
      // one guest per room: whoever comes second (or later) is turned away
      if (pending || link.peer) await deny('full');
      if (sameName(nm, me)) await deny('name');
      pending = { id, name: nm };
      // (a guest that never finishes connecting does not keep the room locked)
      setTimeout(() => {
        if (g === gen && pending && pending.id === id && !link.peer) pending = null;
      }, HANDSHAKE_MS + 4000);
      secret = newSecret();
      await hsSend({ ok: true, host: me, secret });
    },
  });
  invite.onPeerJoin = id => {
    if (g !== gen || !pending || id !== pending.id) return;
    link.peer = pending.name;
    if (ev.status) ev.status(link.peer + ' found. Connecting privately…');
    // give the guest a moment to read the secret, then close the invite room for good
    setTimeout(() => {
      if (g !== gen) return;
      try {
        invite.leave();
      } catch (e) {}
      invite = null;
      openRoom(g);
    }, 400);
  };
  if (ev.code) ev.code(code);
}

/** Joins the room with this invite code (already normalised). Same events as host(). */
export async function join(code, name, events) {
  leave();
  const me = cleanName(name);
  if (!me) throw new Error(why.badname);
  const g = gen;
  const { joinRoom } = await load();
  if (g !== gen) return;
  ev = events;
  link.role = 'guest';
  link.me = me;
  let refusal = null;
  invite = joinRoom({ ...BASE, password: code }, 'invite:' + code, {
    handshakeTimeoutMs: HANDSHAKE_MS,
    onPeerHandshake: async (id, hsSend, receive) => {
      await hsSend({ v: PROTO, role: 'guest', name: me });
      const { data: h } = await receive();
      // only the host: another guest who found the room is dropped
      if (!h || typeof h !== 'object' || h.role !== 'host') throw new Error('not the host');
      if (h.v !== PROTO) {
        refusal = 'version';
        throw new Error('version');
      }
      const { data: v } = await receive();
      if (!v || v.ok !== true) {
        refusal = v && typeof v.why === 'string' && why[v.why] ? v.why : 'full';
        await hsSend({ ack: 1 }).catch(() => {});
        throw new Error('refused');
      }
      const hn = cleanName(v.host);
      if (!hn || !isSecret(v.secret)) throw new Error('bad answer');
      pending = { id, name: hn };
      secret = v.secret;
    },
    onJoinError: () => {
      if (g !== gen || !refusal) return;
      fail(why[refusal]);
    },
  });
  invite.onPeerJoin = id => {
    if (g !== gen || !pending || id !== pending.id) return;
    link.peer = pending.name;
    if (ev.status) ev.status('Found ' + link.peer + '. Connecting privately…');
    clearTimeout(timer);
    try {
      invite.leave();
    } catch (e) {}
    invite = null;
    openRoom(g);
  };
  if (ev.status) ev.status('Looking for the host…');
  timer = setTimeout(() => {
    if (g === gen && !link.connected && invite)
      fail('Nobody is hosting with that code right now. Check it, or ask for a new one.');
  }, FIND_MS);
}

/** The private room both move to: named by the secret only the two players have. */
async function openRoom(g) {
  const { joinRoom } = await load();
  if (g !== gen) return;
  const expect = pending.name,
    me = link.me,
    role = link.role;
  pending = null;
  room = joinRoom({ ...BASE, password: secret }, 'match:' + secret, {
    handshakeTimeoutMs: HANDSHAKE_MS,
    onPeerHandshake: async (id, hsSend, receive) => {
      await hsSend({ v: PROTO, role, name: me });
      const { data: h } = await receive();
      // the one player this room is for, and only one connection at a time
      if (!h || h.v !== PROTO || h.role === role || cleanName(h.name) !== expect)
        throw new Error('not expected');
      if (peerId && peerId !== id && room && room.getPeers()[peerId]) throw new Error('full');
    },
  });
  const [sendMsg, getMsg] = (() => {
    const a = room.makeAction('g', { onReceive: ({ byteLength }) => byteLength <= MAX_MSG });
    return [(d, o) => a.send(d, o), fn => (a.onMessage = fn)];
  })();
  sendRaw = sendMsg;
  // more than this many messages a second from the other side is not the game talking: they are dropped
  // (both channels together)
  const flood = bucket(240, 120);
  const accept = (data, fast) => {
    if (!flood.take()) return;
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.t !== 'string') return;
    if (ev.message) ev.message(data, fast);
  };
  getMsg((data, ctx) => {
    if (g !== gen || !ctx || ctx.peerId !== peerId) return;
    accept(data, false);
  });
  room.onPeerJoin = id => {
    if (g !== gen) return;
    const again = link.connected === false && peerId !== null;
    peerId = id;
    link.connected = true;
    openFast(g, id, accept);
    clearTimeout(timer);
    if (again) {
      if (ev.back) ev.back();
    } else if (ev.connected) ev.connected(expect);
  };
  room.onPeerLeave = id => {
    if (g !== gen || id !== peerId) return;
    link.connected = false;
    closeFast();
    if (ev.lost) ev.lost();
  };
  timer = setTimeout(() => {
    if (g === gen && !link.connected)
      fail(
        'Could not connect directly. A strict network (some offices, schools or mobile carriers) can block it.',
      );
  }, MOVE_MS);
  // round trips, for the face-off timing check: the worst of the last five, in seconds
  clearInterval(pingTimer);
  pingTimer = setInterval(async () => {
    if (g !== gen || !link.connected || !room) return;
    try {
      const ms = await room.ping(peerId);
      if (g !== gen || !(ms >= 0)) return;
      rtts.push(Math.min(0.6, ms / 1000));
      if (rtts.length > 5) rtts.shift();
      if (ev.rtt) ev.rtt(Math.max(...rtts));
    } catch (e) {}
  }, 2000);
}

// leaving the page leaves the rooms (stops announcing to the relays at once)
addEventListener('pagehide', leave);
