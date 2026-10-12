import { initLineup, renderLineup } from './lineup';
import { AC, audio, master } from '../audio/engine';
import { $ } from '../core/dom';
import { savePrefs, loadAimBest } from '../core/storage';
import { startGame, toMenu, togglePause } from '../game/match';
import { aimCfg, pcfg, startPractice } from '../game/practice';
import { G } from '../game/world';
import { net } from '../game/online';
import { leaveRoom } from './online';
import { fit, updCam } from '../render/camera';
import { view } from '../render/canvas';
import { camToast, resetDirector } from '../render/director';
import { arenaThumbs } from '../render/ice';
import { reduceMotion, settings } from '../settings';
import { DIFF, LABEL } from '../data/difficulty';
import { STADIUMS } from '../data/stadiums';
import { clockText, hudClock, showRec } from './hud';

// menu tabs
// the Setup tab's Sound row mirrors the scoreboard's SFX button (which is hidden while the menu is open)
function showSound() {
  document
    .querySelectorAll('#sndSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'off') === settings.muted)));
}
// The menu is a matchday program (see styles/program.css): the home page with the rink, and one page per section.
// Picking a section slides the puck to its spot on the rink, inks the circle in and grows the page out of it; back,
// the page shrinks into its circle and the puck returns to centre ice.
const PAGES = ['play', 'match', 'watch', 'train', 'teams', 'lineup', 'arena', 'options', 'help', 'guide', 'online'];
let page = 'play';
const spotFor = name => document.querySelector('.rinkmenu [data-goto="' + name + '"]');
const animated = () => !reduceMotion && !$('menu').hidden;
/** Slides the rink's puck to a section's spot (or back to the centre dot). */
function puckTo(btn) {
  const pk = $('rpuck'),
    rm = pk.parentElement.getBoundingClientRect(),
    b = (btn || spotFor('match')).getBoundingClientRect(),
    // at centre ice it rests low in the circle, under the match summary rather than on it
    k = btn ? 0.5 : 0.8;
  pk.style.setProperty('--px', b.left + b.width / 2 - rm.left + 'px');
  pk.style.setProperty('--py', b.top + b.height * k - rm.top - 18 + 'px');
}
/** The page's grow and shrink start from its spot on the rink (or the top right for the rulebook). */
function originAt(el, btn) {
  const st = $('prog').querySelector('.pstack').getBoundingClientRect(),
    b = btn ? btn.getBoundingClientRect() : { left: st.right - 30, top: st.top, width: 0, height: 0 };
  el.style.setProperty('--ox', b.left + b.width / 2 - st.left + 'px');
  el.style.setProperty('--oy', b.top + b.height / 2 - st.top + 'px');
}
function play(el, cls, ms, done) {
  el.classList.add(cls);
  setTimeout(() => {
    el.classList.remove(cls);
    if (done) done();
  }, ms);
}
export function showTab(name) {
  if (!PAGES.includes(name)) name = 'play';
  const from = page,
    prog = $('prog');
  if (name === from) return;
  page = name;
  prog.dataset.page = name;
  const fromEl = $('p-' + from),
    toEl = $('p-' + name),
    anim = animated();
  document.querySelectorAll('.rinkmenu .on').forEach(b => b.classList.remove('on'));
  if (name === 'play') {
    // back to the rink
    toEl.hidden = false;
    originAt(fromEl, spotFor(from));
    puckTo(null);
    if (anim) play(fromEl, 'out', 220, () => (fromEl.hidden = true));
    else fromEl.hidden = true;
  } else if (from === 'play') {
    // a section opens from its spot on the rink
    const spot = spotFor(name);
    if (spot) spot.classList.add('on');
    if (spot) puckTo(spot);
    originAt(toEl, spot);
    const open = () => {
      if (page !== name) return;
      toEl.hidden = false;
      fromEl.hidden = true;
      if (anim) play(toEl, 'in', 260);
      if (document.body.classList.contains('padnav')) toEl.querySelector('.pback').focus();
    };
    if (anim && spot) setTimeout(open, 200);
    else open();
  } else {
    // from page to page (keys and guide link to each other)
    fromEl.hidden = true;
    toEl.hidden = false;
  }
  if (name === 'train') {
    let b = 0;
    try {
      b = +localStorage.getItem('blb-zam') || 0;
    } catch (e) {}
    $('zamBest').textContent = b ? 'Your best: ' + b + '%.' : '';
    showAimBest();
  }
  if (name === 'arena') arenaThumbs();
  if (name === 'lineup') renderLineup();
}
/** The best one-minute score for the chosen gap (endless rounds keep no best). */
/** Back to the rink from a section page; true when there was a page to leave. */
export function menuBack() {
  if (page === 'play' || $('menu').hidden) return false;
  showTab('play');
  return true;
}
/** Drop the puck: the ticket stub tears off and the program turns away, then `go` starts the game. */
function dropPuck(go) {
  const prog = $('prog');
  if (!animated()) return go();
  prog.classList.add('tear');
  setTimeout(() => {
    go();
    prog.classList.remove('tear');
  }, 420);
}
/** The match settings at a glance: on the rink's centre circle and on the ticket. */
export function updSummary() {
  const per = clockText(settings.periodLen),
    lvl = LABEL[settings.diffKey];
  $('matchSum').textContent = lvl + ' · 3×' + per;
  $('tkSub').textContent = STADIUMS[settings.stadiumKey].short + ' · ' + lvl + ' · 3 × ' + per;
}
function showAimBest() {
  const a = aimCfg.endless ? 0 : loadAimBest(aimCfg.moving);
  $('aimBest').textContent = a ? 'Your best' + (aimCfg.moving ? ' (moving gap): ' : ': ') + a + (a === 1 ? ' goal.' : ' goals.') : '';
}
export function setDiff(k) {
  settings.diffKey = k;
  settings.diff = DIFF[k];
  document
    .querySelectorAll('#diffSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.d === k)));
  showRec();
  updSummary();
}
export const PERIOD_LENGTHS = [30, 60, 120, 180, 300];
export function setPeriodLen(sec) {
  settings.periodLen = sec;
  document
    .querySelectorAll('#lenSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(+x.dataset.v === sec)));
  $('kicker').textContent = '3-ON-3 · 3 PERIODS × ' + clockText(sec);
  hudClock();
  updSummary();
}
export function setCpuStyle(v) {
  settings.cpuStyle = v === 'realistic' ? 'realistic' : 'classic';
  document
    .querySelectorAll('.styleSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.v === settings.cpuStyle)));
}
/** Watch mode camera: 'cine' (directed shots) or 'classic' (the normal top-down view). */
export function setWatchCam(v) {
  settings.watchCam = v === 'classic' ? 'classic' : 'cine';
  document
    .querySelectorAll('#wcamSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.v === settings.watchCam)));
  $('camBtn').setAttribute('aria-pressed', String(settings.watchCam === 'cine'));
  $('camLbl').textContent = settings.watchCam === 'cine' ? 'CINEMATIC' : 'CLASSIC';
  $('camBtn').setAttribute(
    'aria-label',
    'Camera: ' + $('camLbl').textContent.toLowerCase() + '. Switch camera',
  );
  if (settings.watchCam === 'cine') resetDirector();
  else {
    // cut straight to the normal view instead of gliding out of a zoomed shot
    view.camZ = 1;
    updCam(0, true);
  }
}
/** In-game toggle (camera button, C, or X on a controller), with a short caption naming the new camera. */
export function toggleWatchCam() {
  if (!G.watch) return;
  setWatchCam(settings.watchCam === 'cine' ? 'classic' : 'cine');
  savePrefs();
  camToast(settings.watchCam === 'cine' ? 'CINEMATIC CAMERA' : 'CLASSIC CAMERA');
}
export function setView(v) {
  settings.viewMode = v;
  document
    .querySelectorAll('#camSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.v === v)));
  fit();
}
export function setZam(on) {
  settings.zamOn = on;
  document
    .querySelectorAll('#zamSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'on') === on)));
}
export function setFights(on) {
  settings.fightsOn = on;
  document
    .querySelectorAll('#fightSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'on') === on)));
}
export function setCel(on) {
  settings.celOn = on;
  document
    .querySelectorAll('#celSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'on') === on)));
}
export function setFps(on) {
  settings.fps = on;
  $('fps').hidden = !on;
  document
    .querySelectorAll('#fpsSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'on') === on)));
}
export function setVib(on) {
  settings.vibOn = on;
  document
    .querySelectorAll('#vibSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'on') === on)));
}
function segPick(id, attr, cb) {
  document.querySelectorAll('#' + id + ' button').forEach(b =>
    b.addEventListener('click', () => {
      document
        .querySelectorAll('#' + id + ' button')
        .forEach(x => x.setAttribute('aria-checked', String(x === b)));
      cb(b.dataset[attr]);
    }),
  );
}
export function initMenu() {
  initLineup();
  // the puck stays on its spot when the layout changes size
  addEventListener('resize', () => puckTo(page === 'play' ? null : spotFor(page)));
  new ResizeObserver(() => puckTo(page === 'play' ? null : spotFor(page))).observe(document.querySelector('.rinkmenu'));
  document
    .querySelectorAll('[data-goto]')
    .forEach(b => b.addEventListener('click', () => showTab(b.dataset.goto)));
  document.querySelectorAll('#diffSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setDiff(b.dataset.d);
      savePrefs();
    }),
  );
  document.querySelectorAll('#lenSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setPeriodLen(+b.dataset.v);
      savePrefs();
    }),
  );
  document.querySelectorAll('.styleSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setCpuStyle(b.dataset.v);
      savePrefs();
    }),
  );
  document.querySelectorAll('#wcamSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setWatchCam(b.dataset.v);
      savePrefs();
    }),
  );
  $('camBtn').addEventListener('click', toggleWatchCam);
  document.querySelectorAll('#camSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setView(b.dataset.v);
      savePrefs();
    }),
  );
  document.querySelectorAll('#zamSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setZam(b.dataset.v === 'on');
      savePrefs();
    }),
  );
  document.querySelectorAll('#fightSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setFights(b.dataset.v === 'on');
      savePrefs();
    }),
  );
  document.querySelectorAll('#celSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setCel(b.dataset.v === 'on');
      savePrefs();
    }),
  );
  document.querySelectorAll('#fpsSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setFps(b.dataset.v === 'on');
      savePrefs();
    }),
  );
  document.querySelectorAll('#vibSeg button').forEach(b =>
    b.addEventListener('click', () => {
      setVib(b.dataset.v === 'on');
      savePrefs();
      if (settings.vibOn)
        try {
          navigator.vibrate && navigator.vibrate(30);
        } catch (e) {}
    }),
  );
  // (a single-player game closes an online room left open)
  $('startBtn').addEventListener('click', () => dropPuck(() => (leaveRoom(), startGame(false))));
  $('watchBtn').addEventListener('click', () => dropPuck(() => (leaveRoom(), startGame(true))));
  $('againBtn').addEventListener('click', () =>
    G.net ? net.again && net.again() : G.practice ? startPractice(G.practice) : startGame(G.watch),
  );
  segPick('opSeg', 'v', v => (pcfg.opp = v));
  segPick('tmSeg', 'v', v => (pcfg.mates = v === 'on'));
  segPick('gkSeg', 'v', v => (pcfg.goalie = v));
  $('pFree').addEventListener('click', () => (leaveRoom(), startPractice(Object.assign({ mode: 'free' }, pcfg))));
  $('pFight').addEventListener('click', () => (leaveRoom(), startPractice({ mode: 'fight' })));
  $('pZam').addEventListener('click', () => (leaveRoom(), startPractice({ mode: 'zam' })));
  segPick('aimLenSeg', 'v', v => {
    aimCfg.endless = v === 'endless';
    showAimBest();
  });
  segPick('aimGapSeg', 'v', v => {
    aimCfg.moving = v === 'moving';
    showAimBest();
  });
  $('pAim').addEventListener('click', () => (leaveRoom(), startPractice(Object.assign({ mode: 'aim' }, aimCfg))));
  $('menuBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', togglePause);
  $('quitBtn').addEventListener('click', toMenu);
  $('pauseBtn').addEventListener('click', togglePause);
  document.querySelectorAll('#sndSeg button').forEach(b =>
    b.addEventListener('click', () => {
      if ((b.dataset.v === 'off') !== settings.muted) $('muteBtn').click();
    }),
  );
  $('muteBtn').addEventListener('click', () => {
    settings.muted = !settings.muted;
    $('muteBtn').setAttribute('aria-pressed', String(settings.muted));
    showSound();
    audio();
    if (master) master.gain.setTargetAtTime(settings.muted ? 0 : 0.9, AC.currentTime, 0.02);
  });
}
