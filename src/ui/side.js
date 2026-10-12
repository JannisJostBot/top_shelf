// Desktop side panels: on landscape screens with room beside the rink, a match panel on the left (live stats and a
// play-by-play feed) and a status panel on the right (your skater, boosts, shot power and the controls), with
// team banners and an arena backdrop around them. Phones in portrait (and any narrow window) never show them.
import { $ } from '../core/dom';
import { clock } from '../core/time';
import { ORD } from '../data/difficulty';
import { kit } from '../game/kit';
import { G } from '../game/world';
import { nameOf } from '../game/online';
import { hintNow, kbdHTML } from './keyhint';
import { clockText } from './hud';
import { fit } from '../render/camera';

const WIDE = matchMedia('(orientation: landscape) and (min-width: 1060px) and (min-height: 560px)');
export const isWide = () => WIDE.matches;

/* ---------- play-by-play ---------- */
const FEED_MAX = 40;
const feedItems = [];
let feedDirty = true;
/** Adds a line to the play-by-play: `team` (0, 1 or -1 for neutral) colours its marker. */
export function feed(text, team = -1) {
  if (G.demo || G.practice) return;
  const when = G.period > 3 ? 'OT' : ORD[G.period] + ' ' + clockText(Math.max(0, Math.ceil(G.clock)));
  feedItems.unshift({ text, team, when });
  if (feedItems.length > FEED_MAX) feedItems.pop();
  feedDirty = true;
}
export function resetSide() {
  feedItems.length = 0;
  feedDirty = true;
}
// the panels refresh a few times a second; the page is only touched when something actually changed
const shown = new Map();
function setHTML(el, html) {
  if (shown.get(el) === html) return;
  shown.set(el, html);
  el.innerHTML = html;
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function drawFeed() {
  feedDirty = false;
  $('sdFeed').innerHTML = feedItems.length
    ? feedItems
        .map(
          f =>
            `<li class="${f.team === 0 ? 'home' : f.team === 1 ? 'away' : ''}"><time>${f.when}</time>${esc(f.text)}</li>`,
        )
        .join('')
    : '<li class="empty">The big moments of the game show up here.</li>';
}

/* ---------- stats ---------- */
const ROWS = [
  ['SHOTS', s => s.sog],
  ['SAVES', s => s.saves],
  ['HITS', s => s.hits],
  ['FACEOFFS', s => s.fo],
];
function drawStats() {
  const s = G.stats;
  let html = '';
  for (const [label, get] of ROWS) {
    const [a, b] = get(s),
      k = a + b ? a / (a + b) : 0.5;
    html += `<div class="srow"><b>${a}</b><span>${label}</span><b>${b}</b><i class="sbar" style="--k:${k}"></i></div>`;
  }
  const pa = s.poss[0],
    pb = s.poss[1],
    k = pa + pb ? pa / (pa + pb) : 0.5;
  html += `<div class="srow"><b>${Math.round(k * 100)}%</b><span>POSSESSION</span><b>${Math.round((1 - k) * 100)}%</b><i class="sbar" style="--k:${k}"></i></div>`;
  setHTML($('sdStats'), html);
}

/* ---------- status: boosts, shot power, controls ---------- */
function drawBoost() {
  const m = G.mom,
    on = m && m.t > 0 && !G.demo;
  const el = $('sdBoost');
  if (!on) {
    el.className = 'boost';
    setHTML(el, '<span class="bi off"></span><span>No boost active</span>');
    return;
  }
  const name = m.src === 'fight' ? 'Fight won' : 'Fresh ice';
  el.className = 'boost ' + (m.team === 0 ? 'home' : 'away') + (m.t < 4 ? ' ending' : '');
  setHTML(
    el,
    `<span class="bi"></span><span><b>${esc(kit.TEAMS[m.team].name.toUpperCase())} · SPEED</b>` +
      `<small>${name} · ${Math.ceil(m.t)}s left</small></span><i class="sbar" style="--k:${m.t / (m.dur || 20)}"></i>`,
  );
}
const WATCH_KEYS = [
  ['V', 'Next shot'],
  ['C', 'Switch camera'],
  ['P', 'Pause'],
  ['F', 'Fullscreen'],
];
const WATCH_PAD = [
  ['Y', 'Next shot'],
  ['X', 'Switch camera'],
  ['☰', 'Pause'],
];
const ALWAYS_KEYS = [
  ['WASD', 'Skate (or arrows)'],
  ['F', 'Fullscreen'],
  ['H', 'All keys'],
];
const ALWAYS_PAD = [
  ['LS', 'Skate'],
  ['LB', 'Also switch skater'],
];
let lastKeys = '';
function drawKeys() {
  const padOn = hintNow.pad,
    now = G.watch ? (padOn ? WATCH_PAD : WATCH_KEYS) : hintNow.list,
    always = G.watch ? [] : padOn ? ALWAYS_PAD : ALWAYS_KEYS,
    key = JSON.stringify([now, always, padOn]);
  if (key === lastKeys) return;
  lastKeys = key;
  const row = ([k, t]) => `<li>${kbdHTML(k, padOn)}<span>${t}</span></li>`;
  $('sdNow').innerHTML = now.map(row).join('');
  $('sdAlways').innerHTML = always.map(row).join('');
  $('sdAlwaysH').hidden = !always.length;
}

/* ---------- banners ---------- */
function drawBanners() {
  for (const t of [0, 1]) {
    const T = kit.TEAMS[t],
      el = $('sdBan' + t);
    const txt = G.demo
      ? T.name.toUpperCase()
      : G.net && t
        ? nameOf(t) + ' · ' + T.name.toUpperCase()
        : G.watch || t
          ? T.name.toUpperCase()
          : 'YOU · ' + T.name.toUpperCase();
    if (el.textContent !== txt) el.textContent = txt;
  }
}

/* ---------- layout switch and per-frame update ---------- */
let lastT = 0,
  lastShot = -1;
function applyLayout() {
  const on = WIDE.matches;
  document.body.classList.toggle('wide', on);
  $('sideL').hidden = !on;
  $('sideR').hidden = !on;
  // the player card moves from the corner of the rink into the status panel
  const card = $('pcard');
  (on ? $('sdCard') : $('stage')).appendChild(card);
  // the scoreboard leaves the top of the rink: both scores and the clock become one jumbotron in the left column
  // and the buttons go to the right one (the elements keep their ids, so the HUD code updates them anywhere)
  const hud = $('hud'),
    home = hud.querySelector('.team.home'),
    sc0 = $('s0').parentElement,
    sc1 = $('s1').parentElement,
    mid = $('clock').closest('.mid');
  if (on) {
    $('sdBoard').append(sc0, mid, sc1);
    $('sdBtns').append(...hud.querySelector('.hudbtns').children, $('pauseBtn'));
  } else if (!home.contains(sc0)) {
    $('nm0').after(sc0);
    $('nm1').before(sc1);
    home.after(mid);
    const btns = hud.querySelector('.hudbtns');
    for (const id of ['muteBtn', 'fsBtn']) btns.append($(id));
    hud.append($('pauseBtn'));
  }
  fit();
  lastT = 0;
  lastKeys = '';
}
export function initSide() {
  WIDE.addEventListener('change', applyLayout);
  applyLayout();
}
/** Refreshes the panels a few times a second (the shot meter every frame). Called from the main loop. */
export function updSide() {
  if (!WIDE.matches) return;
  const match = !G.demo;
  // the side bars slide in for a game and out for the menu (CSS transitions on this class)
  if (document.body.classList.contains('inmatch') !== match) document.body.classList.toggle('inmatch', match);
  // the shot meter follows the wind-up every frame, but only touches the page when it changed
  const k = G.charging && !G.ai0 ? Math.min(1, G.charge / 0.7) : 0;
  if (k !== lastShot) {
    lastShot = k;
    const ch = $('sdShot');
    ch.style.setProperty('--k', String(k));
    ch.classList.toggle('full', k > 0.95);
  }
  if (clock.now - lastT < 0.25) return;
  lastT = clock.now;
  drawBanners();
  if (!match) return;
  drawStats();
  drawBoost();
  drawKeys();
  if (feedDirty) drawFeed();
  setHTML(
    $('sdTeams'),
    `<span class="home">${esc(G.watch ? kit.TEAMS[0].name.toUpperCase() : 'YOU')}</span>` +
      `<span class="away">${esc(G.watch ? kit.TEAMS[1].name.toUpperCase() : G.net ? nameOf(1) : 'CPU')}</span>`,
  );
}
