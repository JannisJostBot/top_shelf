import { $ } from '../core/dom';
import { G } from '../game/world';
import { pad } from '../input/gamepad';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';

const KEYMAP = [
  [['↑', '↓', '←', '→'], 'Skate (relative to the aim ring when using the mouse)'],
  [['W', 'A', 'S', 'D'], 'Also skate'],
  [['Space', 'J'], 'Shoot (hold to wind up) · Poke · Draw · Punch · Horn'],
  [['Shift', 'K'], 'Pass · Check · Dash · Block · Finish'],
  [['L', 'C'], 'Switch skater'],
  [
    ['Mouse'],
    'Steer: move the mouse to swing the aim ring around your skater. W skates that way, S back, A/D strafe. A click traps the mouse in the game; Esc frees it',
  ],
  [['Left click'], 'Same as Space'],
  [['Right click'], 'Same as Shift'],
  [['Middle click'], 'Switch skater'],
  [['Enter'], 'Skip replay or celebration'],
  [['V'], 'Next replay angle'],
  [['P', 'Esc'], 'Pause'],
  [['H', '?'], 'Show the key map'],
  [['F'], 'Fullscreen'],
];
export const keymapHTML = () =>
  KEYMAP.map(
    ([ks, t]) => '<span>' + ks.map(k => '<kbd>' + k + '</kbd>').join('') + '</span><span>' + t + '</span>',
  ).join('');
const HINTS = {
  off: [
    ['Space', 'Shoot'],
    ['Shift', 'Pass'],
    ['L', 'Switch'],
  ],
  def: [
    ['Space', 'Poke'],
    ['Shift', 'Check'],
    ['L', 'Switch'],
  ],
  loose: [
    ['Space', 'Poke'],
    ['Shift', 'Dash'],
    ['L', 'Switch'],
  ],
  fo: [['Space', 'Draw']],
  fight: [
    ['Space', 'Punch'],
    ['Shift', 'Block'],
  ],
  zam: [
    ['Arrows', 'Steer'],
    ['Space', 'Horn'],
    ['Shift', 'Finish'],
  ],
  replay: [
    ['Enter', 'Skip'],
    ['V', 'Angle'],
  ],
  idle: [],
};
// keyboard hint keys as Xbox controller buttons
const PAD_GLYPH = { Space: 'A', Shift: 'B', L: 'X', Enter: 'View', V: 'Y', Arrows: 'LS' };
const PADMAP = [
  [['LS', '✚'], 'Skate (stick gives analog speed)'],
  [['A', 'RT'], 'Shoot (hold to wind up) · Poke · Draw · Punch · Horn'],
  [['B', 'RB'], 'Pass · Check · Dash · Block · Finish'],
  [['X', 'LB'], 'Switch skater'],
  [['View'], 'Skip replay or celebration'],
  [['Y'], 'Next replay angle'],
  [['☰'], 'Pause'],
  [['✚', 'A'], 'In menus: move and press · LB / RB change tab · B resume'],
];
export const padmapHTML = () =>
  PADMAP.map(
    ([ks, t]) =>
      '<span>' +
      ks.map(k => '<kbd class="pb pb-' + k.toLowerCase() + '">' + k + '</kbd>').join('') +
      '</span><span>' +
      t +
      '</span>',
  ).join('');
export function setHint(m) {
  const el = $('keyhint');
  const show = !touchState.touchUI && !G.demo && !G.watch && G.state !== 'over';
  el.hidden = !show;
  if (!show) return;
  if (pad.active) {
    const list = (HINTS[m] || []).map(([k, t]) => [PAD_GLYPH[k] || k, t]).concat([['☰', 'Pause']]);
    el.innerHTML = list
      .map(([k, t]) => '<span><kbd class="pb pb-' + k.toLowerCase() + '">' + k + '</kbd>' + t + '</span>')
      .join('');
    return;
  }
  let list = (HINTS[m] || []).map(h =>
    mouse.on ? [h[0] === 'Space' ? 'L-click' : h[0] === 'Shift' ? 'R-click' : h[0], h[1]] : h,
  );
  list = list.concat([
    ['P', 'Pause'],
    ['H', 'Keys'],
  ]);
  el.innerHTML = list.map(([k, t]) => '<span><kbd>' + k + '</kbd>' + t + '</span>').join('');
}
