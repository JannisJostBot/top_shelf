// The Online page of the program: your name, host a room (and share its code) or join one, then the lobby. The
// networking (net/) is only loaded when you host or join, so the rest of the game never touches the network.
import { $ } from '../core/dom';
import { cleanName, fmtCode, linkToken, normCode } from '../net/proto';
import { showTab } from './menu';
import { drawQR } from './qr';

const NAME_KEY = 'blb-name';
let mod = null;
const load = async () => (mod ??= await import('../net/match'));
let code = '';

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch (e) {
    return '';
  }
}
function saveName(n) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch (e) {}
}
const status = t => ($('olStatus').textContent = t);
function err(t) {
  $('olErr').textContent = t || '';
  $('olErr').hidden = !t;
}
/** 'setup' (name, host or join) or 'room' (the code, the status, the lobby). */
function stage(s) {
  $('olSetup').hidden = s !== 'setup';
  $('olRoom').hidden = s !== 'room';
  $('olName').disabled = s !== 'setup';
  if (s === 'setup') {
    $('olCodeBox').hidden = true;
    $('olLobby').hidden = true;
    ready('');
    status('');
    ticket('Host or join a room above');
  }
}
/** The ticket on this page: you against your friend, and what the match is waiting for. */
function ticket(sub, peer) {
  const me = cleanName($('olName').value) || 'You';
  $('olTkLine').textContent = me + ' vs ' + (peer || 'a friend');
  $('olTkSub').textContent = sub;
}
/** The ticket's Play button on this page: the host's start, once the guest is in. */
function ready(v) {
  $('prog').dataset.ol = v;
  $('olStart').disabled = v !== 'host';
  $('olStart').textContent = v === 'guest' ? 'Waiting' : 'Play';
}
const callbacks = {
  code(c) {
    code = c;
    $('olCodeTxt').textContent = fmtCode(c);
    $('olLinkTxt').textContent = inviteLink();
    $('olQr').hidden = !drawQR($('olQrImg'), inviteLink());
    $('olCodeBox').hidden = false;
    status(
      'Waiting for your friend. Send them the code or the link, or let them scan the QR code; it lets one person in.',
    );
    ticket('Waiting for your friend');
  },
  status,
  lobby() {
    const l = mod.onlineLink();
    $('olCodeBox').hidden = true;
    $('olLobby').hidden = false;
    $('olMe').textContent = l.me;
    $('olPeer').textContent = l.peer;
    $('olWho').textContent =
      l.role === 'host'
        ? 'Your settings are used. Drop the puck with the ticket below when you are both ready.'
        : 'Waiting for ' + l.peer + ' to drop the puck.';
    status('Connected directly to ' + l.peer + '. The invite code no longer works.');
    ready(l.role);
    // the host's settings are used: the host's ticket prints them, the guest's says whose they are
    ticket(l.role === 'host' ? $('tkSub').textContent : l.peer + "'s arena and settings", l.peer);
  },
  error(t) {
    stage('setup');
    err(t);
    showTab('online');
  },
  ended(t) {
    stage('setup');
    if (!t) return;
    err(t);
    showTab('online');
  },
  gone(name) {
    $('againBtn').disabled = true;
    $('againSub').textContent = name + ' left the room.';
  },
  again(a) {
    $('againBtn').disabled = false;
    $('againBtn').textContent = a[0] ? 'WAITING…' : 'REMATCH';
    const l = mod && mod.onlineLink();
    $('againSub').textContent = a[1]
      ? (l ? l.peer : 'They') + ' wants a rematch'
      : 'Same opponent, fresh rosters. Both have to agree.';
  },
};
function myName() {
  const n = cleanName($('olName').value);
  if (!n) {
    err('Pick a name first: 2 to 12 letters, digits, spaces, dots or dashes.');
    $('olName').focus();
    return null;
  }
  $('olName').value = n;
  saveName(n);
  return n;
}
async function hostRoom() {
  err('');
  const n = myName();
  if (!n) return;
  stage('room');
  status('Opening a room…');
  ticket('Opening a room…');
  try {
    await (await load()).hostOnline(n, callbacks);
  } catch (e) {
    callbacks.error((e && e.message) || 'Could not open a room.');
  }
}
async function joinRoom() {
  err('');
  const n = myName();
  if (!n) return;
  const c = normCode($('olCode').value);
  if (!c) {
    err('That is not a whole invite code: 24 letters and digits (dashes optional).');
    $('olCode').focus();
    return;
  }
  $('olCode').value = fmtCode(c);
  stage('room');
  status('Connecting…');
  ticket('Connecting…');
  try {
    await (await load()).joinOnline(c, n, callbacks);
  } catch (e) {
    callbacks.error((e && e.message) || 'Could not join.');
  }
}
// the code rides in the link's #fragment, which browsers never send to the web server, and scrambled, so it cannot
// be read off a link or QR code shown on a stream
const inviteLink = () => location.origin + location.pathname + '#j=' + linkToken(code);
async function copy(text, btn) {
  const was = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch (e) {
    btn.textContent = 'Select and copy it';
  }
  setTimeout(() => (btn.textContent = was), 1400);
}
export function initOnline() {
  $('olName').value = loadName();
  $('olName').addEventListener('input', () => $('olSetup').hidden || ticket('Host or join a room above'));
  $('olHost').addEventListener('click', hostRoom);
  $('olJoin').addEventListener('click', joinRoom);
  $('olCode').addEventListener('keydown', e => e.key === 'Enter' && joinRoom());
  $('olLeave').addEventListener('click', () => {
    if (mod) mod.leaveOnline();
    stage('setup');
  });
  $('olStart').addEventListener('click', () => mod && mod.hostStart());
  $('olCopy').addEventListener('click', e => copy(fmtCode(code), e.currentTarget));
  $('olLink').addEventListener('click', e => copy(inviteLink(), e.currentTarget));
  stage('setup');
  // opened from an invite link: straight to the Online page with the code filled in (and the code taken back out
  // of the address bar and the history entry)
  const invited = /^#j(oin)?=/.test(location.hash);
  const c = invited ? normCode(location.hash) : null;
  if (invited) history.replaceState(null, '', location.pathname + location.search);
  if (c) {
    $('olCode').value = fmtCode(c);
    setTimeout(() => {
      showTab('online');
      (cleanName($('olName').value) ? $('olJoin') : $('olName')).focus();
    }, 0);
  }
}
/** Leaves an open room (before a single-player game starts). */
export function leaveRoom() {
  if (mod && mod.onlineLink().role) {
    mod.leaveOnline();
    stage('setup');
  }
}
