import { $ } from '../core/dom';
import { G } from '../game/world';
import { pad } from '../input/gamepad';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';

const KEYMAP = [
  [['↑', '↓', '←', '→'], 'Skate (relative to the aim arrow when using the mouse)'],
  [['W', 'A', 'S', 'D'], 'Also skate'],
  [['Space', 'J'], 'Shoot (hold to wind up) · Poke · Draw · Punch · Horn'],
  [['Shift', 'K'], 'Pass · Check · Dash · Block · Finish'],
  [['L', 'C'], 'Switch skater'],
  [
    ['Mouse'],
    'Steer: move the mouse to swing the aim arrow around your skater. W skates that way, S back, A/D strafe. A click traps the mouse in the game; Esc frees it',
  ],
  [['Left click'], 'Same as Space'],
  [['Right click'], 'Same as Shift'],
  [['Middle click'], 'Switch skater'],
  [['Enter'], 'Skip replay or celebration'],
  [['V'], 'Next replay angle'],
  [['G'], 'Online replay: vote to fight (both have to)'],
  [['1–6'], 'Online replay: emotes (hyped, nice, LOL, what?!, nooo, grrr)'],
  [['P', 'Esc'], 'Pause'],
  [['H', '?'], 'Show the key map'],
  [['F'], 'Fullscreen'],
];
// The pixel fonts have ↑ and ↓ but no ←, →, ☰ or ✚ (those fell back to whatever font the system has): the side
// arrows are a turned ↑, the controller's menu button and d-pad are drawn in pixels.
const ICON = {
  '☰': [
    'Menu',
    '<rect x="1" y="2" width="8" height="2"/><rect x="1" y="5" width="8" height="2"/><rect x="1" y="8" width="8" height="2"/>',
  ],
  '✚': ['D-pad', '<rect x="4" y="1" width="3" height="9"/><rect x="1" y="4" width="9" height="3"/>'],
};
const SIDE_ARROW = { '←': ['l', 'Left'], '→': ['r', 'Right'] };
/** One key cap; `cls` is its extra class (the controller button colours). */
function cap(k, cls = '') {
  const c = cls ? ' class="' + cls + '"' : '';
  if (SIDE_ARROW[k])
    return (
      '<kbd' +
      c +
      ' aria-label="' +
      SIDE_ARROW[k][1] +
      '"><i class="arw ' +
      SIDE_ARROW[k][0] +
      '">↑</i></kbd>'
    );
  if (ICON[k])
    return (
      '<kbd' +
      c +
      ' aria-label="' +
      ICON[k][0] +
      '"><svg class="kico" viewBox="0 0 11 11" shape-rendering="crispEdges" aria-hidden="true">' +
      ICON[k][1] +
      '</svg></kbd>'
    );
  return '<kbd' + c + '>' + k + '</kbd>';
}
export const keymapHTML = () =>
  KEYMAP.map(([ks, t]) => '<span>' + ks.map(k => cap(k)).join('') + '</span><span>' + t + '</span>').join('');
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
  replayNet: [
    ['Enter', 'Skip'],
    ['V', 'Angle'],
    ['1-6', 'Emote'],
  ],
  replayVote: [
    ['Enter', 'Skip'],
    ['G', 'Fight?'],
    ['1-6', 'Emote'],
  ],
  idle: [],
};
// keyboard hint keys as Xbox controller buttons
const PAD_GLYPH = {
  Space: 'A',
  Shift: 'B',
  L: 'X',
  Enter: 'View',
  V: 'Y',
  Arrows: 'LS',
  G: 'LT',
  '1-6': '✚',
};
const PADMAP = [
  [['LS', '✚'], 'Skate (stick gives analog speed)'],
  [['A', 'RT'], 'Shoot (hold to wind up) · Poke · Draw · Punch · Horn'],
  [['B', 'RB'], 'Pass · Check · Dash · Block · Finish'],
  [['X', 'LB'], 'Switch skater'],
  [['View'], 'Skip replay or celebration'],
  [['Y'], 'Next replay angle'],
  [['LT'], 'Online replay: vote to fight (both have to)'],
  [
    ['✚', 'L3', 'R3'],
    'Online replay: emotes (✚ up hyped, right nice, down nooo, left grrr · L3 LOL · R3 what?!)',
  ],
  [['☰'], 'Pause'],
  [['✚', 'A'], 'In menus: move and press · LB / RB change tab · B resume'],
];
export const padmapHTML = () =>
  PADMAP.map(
    ([ks, t]) =>
      '<span>' + ks.map(k => cap(k, 'pb pb-' + k.toLowerCase())).join('') + '</span><span>' + t + '</span>',
  ).join('');
/** One key cap: an Xbox button glyph when `padOn`, else a keyboard key. */
export const kbdHTML = (k, padOn) => cap(k, padOn ? 'pb pb-' + k.toLowerCase() : '');
/** The context hints of the current moment, also shown in the desktop side panel. */
export const hintNow = { list: [], pad: false, mode: 'idle' };
export function setHint(m) {
  const padOn = pad.active;
  let list = (HINTS[m] || []).map(h =>
    padOn
      ? [PAD_GLYPH[h[0]] || h[0], h[1]]
      : mouse.on
        ? [h[0] === 'Space' ? 'L-click' : h[0] === 'Shift' ? 'R-click' : h[0], h[1]]
        : h,
  );
  list = list.concat(
    padOn
      ? [['☰', 'Pause']]
      : [
          ['P', 'Pause'],
          ['H', 'Keys'],
        ],
  );
  hintNow.list = list;
  hintNow.pad = padOn;
  hintNow.mode = m;
  const el = $('keyhint');
  const show = !touchState.touchUI && !G.demo && !G.watch && G.state !== 'over';
  el.hidden = !show;
  if (!show) return;
  el.innerHTML = list.map(([k, t]) => '<span>' + kbdHTML(k, padOn) + t + '</span>').join('');
}
