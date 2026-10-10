import { $ } from '../core/dom';
import { G } from '../game/world';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';

const KEYMAP = [
  [['↑', '↓', '←', '→'], 'Skate (relative to your aim when using the mouse)'],
  [['W', 'A', 'S', 'D'], 'Also skate'],
  [['Space', 'J'], 'Shoot (hold to wind up) · Poke · Draw · Punch · Horn'],
  [['Shift', 'K'], 'Pass · Check · Dash · Block · Finish'],
  [['L', 'C'], 'Switch skater'],
  [['Mouse'], 'Aim: your skater faces the cursor. W skates toward it, S back, A/D strafe'],
  [['Left click'], 'Same as Space'],
  [['Right click'], 'Same as Shift'],
  [['Middle click'], 'Switch skater'],
  [['Enter'], 'Skip replay or celebration'],
  [['V'], 'Next replay angle'],
  [['P', 'Esc'], 'Pause'],
  [['H', '?'], 'Show the key map'],
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
export function setHint(m) {
  const el = $('keyhint');
  const show = !touchState.touchUI && !G.demo && !G.watch && G.state !== 'over';
  el.hidden = !show;
  if (!show) return;
  let list = (HINTS[m] || []).map(h =>
    mouse.on ? [h[0] === 'Space' ? 'L-click' : h[0] === 'Shift' ? 'R-click' : h[0], h[1]] : h,
  );
  list = list.concat([
    ['P', 'Pause'],
    ['H', 'Keys'],
  ]);
  el.innerHTML = list.map(([k, t]) => '<span><kbd>' + k + '</kbd>' + t + '</span>').join('');
}
