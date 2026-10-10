import { AC, audio, master } from '../audio/engine';
import { $ } from '../core/dom';
import { savePrefs } from '../core/storage';
import { DIFF } from '../data/difficulty';
import { startGame, toMenu, togglePause } from '../game/match';
import { pcfg, startPractice } from '../game/practice';
import { G } from '../game/world';
import { fit } from '../render/camera';
import { arenaThumbs } from '../render/ice';
import { settings } from '../settings';
import { clockText, hudClock, showRec } from './hud';

// menu tabs
// the Setup tab's Sound row mirrors the scoreboard's SFX button (which is hidden while the menu is open)
function showSound() {
  document
    .querySelectorAll('#sndSeg button')
    .forEach(x => x.setAttribute('aria-checked', String((x.dataset.v === 'off') === settings.muted)));
}
export function showTab(name) {
  document
    .querySelectorAll('.tabs button')
    .forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  for (const t of ['play', 'train', 'teams', 'arena', 'options', 'help', 'guide'])
    $('p-' + t).hidden = t !== name;
  if (name === 'train') {
    let b = 0;
    try {
      b = +localStorage.getItem('blb-zam') || 0;
    } catch (e) {}
    $('zamBest').textContent = b ? 'Your best: ' + b + '%.' : '';
  }
  if (name === 'arena') arenaThumbs();
}
export function setDiff(k) {
  settings.diffKey = k;
  settings.diff = DIFF[k];
  document
    .querySelectorAll('#diffSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.d === k)));
  showRec();
}
export const PERIOD_LENGTHS = [30, 60, 120, 180, 300];
export function setPeriodLen(sec) {
  settings.periodLen = sec;
  document
    .querySelectorAll('#lenSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(+x.dataset.v === sec)));
  $('kicker').textContent = '3-ON-3 · 3 PERIODS × ' + clockText(sec);
  hudClock();
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
  document
    .querySelectorAll('.tabs button')
    .forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
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
  $('startBtn').addEventListener('click', () => startGame(false));
  $('watchBtn').addEventListener('click', () => startGame(true));
  $('againBtn').addEventListener('click', () =>
    G.practice ? startPractice(G.practice) : startGame(G.watch),
  );
  segPick('opSeg', 'v', v => (pcfg.opp = v));
  segPick('tmSeg', 'v', v => (pcfg.mates = v === 'on'));
  segPick('gkSeg', 'v', v => (pcfg.goalie = v));
  $('pFree').addEventListener('click', () => startPractice(Object.assign({ mode: 'free' }, pcfg)));
  $('pFight').addEventListener('click', () => startPractice({ mode: 'fight' }));
  $('pZam').addEventListener('click', () => startPractice({ mode: 'zam' }));
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
