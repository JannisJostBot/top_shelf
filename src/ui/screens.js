// The screens around a match: the menu, the scoreboard names, the pause screen, the results card and the touch
// controls. The game announces screen changes (game/fx.js `screen`, `showPad`, `uiShow`); this shows them.
import { $ } from '../core/dom';
import { teamLabel, togglePause } from '../game/match';
import { G } from '../game/world';
import { input } from '../input/state';
import { knobAt, pad, touchState } from '../input/touch';
import { fit } from '../render/camera';
import { hideBanner } from './hud';

export function showPad(on) {
  touchState.padWanted = on;
  pad.hidden = !(on && touchState.touchUI);
  if (!on) {
    touchState.stickId = null;
    input.touch = false;
    input.tx = input.ty = 0;
    input.shootHeld = false;
    knobAt(0, 0);
  }
  fit();
}
/** Shows or hides a small HUD piece by id (the replay buttons, the player card). */
export function uiShow(id, visible) {
  $(id).hidden = !visible;
}
/** Shots on goal, saves and save percentage for both teams on the results card. */
function matchStats() {
  const s = G.stats,
    pct = t => (s.sog[1 - t] ? (s.saves[t] / s.sog[1 - t]).toFixed(3).replace(/^0/, '') : '–'),
    row = (label, a, b) =>
      '<span>' + a + '</span><span class="lbl">' + label + '</span><span>' + b + '</span>';
  return (
    '<span class="team">' +
    teamLabel(0) +
    '</span><span></span><span class="team">' +
    teamLabel(1) +
    '</span>' +
    row('SHOTS ON GOAL', s.sog[0], s.sog[1]) +
    row('SAVES', s.saves[0], s.saves[1]) +
    row('SAVE %', pct(0), pct(1))
  );
}
const SCREENS = {
  match({ watch }) {
    $('menu').hidden = true;
    $('overOv').hidden = true;
    $('pauseOv').hidden = true;
    $('pauseBtn').disabled = false;
    $('nm0').textContent = teamLabel(0);
    $('nm1').textContent = teamLabel(1);
    $('camBtn').hidden = !watch;
  },
  menu() {
    $('nm0').textContent = 'YOU';
    $('nm1').textContent = 'CPU';
    $('rpBar').hidden = true;
    $('pcard').hidden = true;
    $('overOv').hidden = true;
    $('pauseOv').hidden = true;
    $('menu').hidden = false;
    $('pauseBtn').disabled = true;
    $('camBtn').hidden = true;
  },
  over(r) {
    $('rpBar').hidden = true;
    $('pcard').hidden = true;
    $('overK').textContent = r.kicker;
    $('overT').textContent = r.title;
    $('overT').style.color = r.winner === 0 ? 'var(--home-ui)' : 'var(--away-ui)';
    $('overS').textContent = r.score;
    $('overStats').innerHTML = matchStats();
    $('overR').textContent = r.record;
    $('againBtn').textContent = r.again;
    // the result gets its moment before the results card comes up
    setTimeout(() => {
      if (G.state !== 'over') return;
      hideBanner();
      $('overOv').hidden = false;
    }, 1900);
    $('pauseBtn').disabled = true;
  },
  practice() {
    $('camBtn').hidden = true;
    $('menu').hidden = true;
    $('overOv').hidden = true;
    $('pauseOv').hidden = true;
    $('pauseBtn').disabled = false;
    $('nm0').textContent = 'GOALS';
    $('nm1').textContent = 'SHOTS';
  },
  practiceOver({ title, line }) {
    $('rpBar').hidden = true;
    $('pcard').hidden = true;
    $('overK').textContent = 'PRACTICE';
    $('overT').textContent = title;
    $('overT').style.color = 'var(--ink)';
    $('overS').textContent = '';
    $('overR').textContent = line;
    $('overStats').innerHTML = ''; // no match stats from an earlier game on a practice card
    $('againBtn').textContent = 'AGAIN';
    $('overOv').hidden = false;
    $('pauseBtn').disabled = true;
  },
  pause(on) {
    $('pauseOv').hidden = !on;
  },
};
export function showScreen(name, data) {
  SCREENS[name](data);
}
export function initScreens() {
  // leaving the tab pauses a match
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !G.demo && G.state !== 'paused' && G.state !== 'over') togglePause();
  });
}
