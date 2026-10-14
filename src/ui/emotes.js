// Online replays: the emote button (it opens six pixel faces to send the other player) and the fight vote. Your
// emotes pop up on the left, theirs on the right. The vote button shows whether the other player wants the fight;
// when both do, it starts (the host's call, see game/replay.js). The networking is net/match.js, through
// net.castVote and net.emote.
import { S } from '../audio/sfx';
import { $ } from '../core/dom';
import { EMOTES, EMOTE_KEYS, emoteSVG } from '../data/emotes';
import { net } from '../game/online';
import { G } from '../game/world';

const tray = $('emoTray'),
  voteBtn = $('voteBtn'),
  voteSub = $('voteSub'),
  COOLDOWN = 1.2; // seconds between two of your own emotes
let shown = '',
  lastSent = -Infinity;
const hideT = [0, 0];

/** Whether the emotes (and maybe the vote) are offered right now. */
const live = () => !!G.net && G.state === 'replay' && !!net.emote;
const voteLive = () => live() && net.vote.open && !G.fought;

/** Sends emote `key` (keyboard 1 to 6, the controller's D-pad and stick clicks, or a tap on the tray). */
export function sendEmote(key) {
  if (!live() || !EMOTES[key]) return;
  const now = performance.now() / 1000;
  if (now - lastSent < COOLDOWN) return;
  lastSent = now;
  net.emote(key);
  showEmote(key, true);
}
/** Votes for the fight, or takes the vote back (G on the keyboard, LT on a controller, or the tray's button). */
export function toggleVote() {
  if (!voteLive() || !net.castVote) return;
  net.castVote(!net.vote.v[0]);
  refreshVote();
}

/** Pops emote `key` up on this player's side (mine) or the other player's. */
export function showEmote(key, mine) {
  if (!EMOTES[key]) return;
  const el = $(mine ? 'emoMine' : 'emoTheirs'),
    side = mine ? 0 : 1;
  el.innerHTML =
    emoteSVG(key) + '<b>' + EMOTES[key].label + '</b>' + (mine ? '' : '<span class="who"></span>');
  if (!mine) el.querySelector('.who').textContent = theirName();
  el.dataset.k = key;
  el.hidden = false;
  // restart the pop-in animation
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  S('emote', { k: key, mine });
  clearTimeout(hideT[side]);
  hideT[side] = setTimeout(() => (el.hidden = true), 2400);
}
const theirName = () => (G.net === 'guest' ? net.names[0] : net.names[1]) || 'THEM';

/** The vote button's state: not voted, voted (waiting), and whether the other player wants it. */
export function refreshVote() {
  const [me, them] = net.vote.v;
  voteBtn.setAttribute('aria-pressed', String(me));
  voteBtn.classList.toggle('hot', them);
  voteBtn.querySelector('span').textContent = me ? 'WAITING…' : them ? 'FIGHT BACK?' : 'FIGHT?';
  voteSub.textContent = them
    ? theirName() + ' wants to fight'
    : me
      ? 'Waiting for ' + theirName()
      : 'Both have to vote';
}

/** Called every frame: shows or hides the tray and the vote with the replay. */
export function updEmotes() {
  const k = live() ? (voteLive() ? 'vote' : 'emotes') : '';
  if (k === shown) return;
  shown = k;
  tray.hidden = !k;
  $('voteBox').hidden = k !== 'vote';
  if (k === 'vote') refreshVote();
  if (!k) {
    for (const id of ['emoMine', 'emoTheirs']) $(id).hidden = true;
    openPicker(false);
  }
}

/* The picker: one emote button that opens the six faces, big and well apart so a thumb cannot hit the wrong one
   (a tap outside closes it, without reaching the rink). */
let openedAt = 0;
function openPicker(on) {
  const btns = $('emoBtns');
  if (on === !btns.hidden) return;
  btns.hidden = !on;
  $('emoToggle').setAttribute('aria-expanded', String(on));
  tray.classList.toggle('picking', on);
  openedAt = performance.now();
}

export function initEmotes() {
  $('emoToggleFace').innerHTML = emoteSVG('happy');
  $('emoBtns').innerHTML = EMOTE_KEYS.map(
    (k, i) =>
      '<button class="emob" data-k="' +
      k +
      '" title="' +
      EMOTES[k].label +
      ' (' +
      (i + 1) +
      ')" aria-label="Emote: ' +
      EMOTES[k].label +
      '">' +
      emoteSVG(k) +
      '<b>' +
      EMOTES[k].label +
      '</b></button>',
  ).join('');
  // (pointerdown, so a tap on the tray never reaches the rink underneath and skips the replay)
  tray.addEventListener('pointerdown', e => e.stopPropagation());
  $('emoToggle').addEventListener('click', () => openPicker($('emoBtns').hidden));
  $('emoBtns').addEventListener('click', e => {
    const b = e.target.closest('.emob');
    // (a tap right after opening is the same thumb still on its way, not a choice)
    if (!b || performance.now() - openedAt < 250) return;
    sendEmote(b.dataset.k);
    openPicker(false);
  });
  // a tap anywhere else closes the picker and goes no further (it does not skip the replay)
  addEventListener(
    'pointerdown',
    e => {
      if ($('emoBtns').hidden || tray.contains(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
      openPicker(false);
    },
    true,
  );
  voteBtn.addEventListener('click', toggleVote);
}
