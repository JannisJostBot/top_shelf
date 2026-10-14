import { $ } from '../core/dom';

export const cv = $('c');
export const view = {
  ctx: cv.getContext('2d'),
  CW: 224,
  CH: 320,
  /** canvas pixels covered by the scoreboard bar floating over the top of the rink */
  topInset: 0,
  camZ: 1,
  sil: null,
  lastCtl: null,
  ctlFlash: 0,
  lamp: null,
  /** where the menu's 3D view is framed: rows y0..y1 (the window on phones) and/or the column cx to centre it
   * on (beside the program sheet on desktop); null for the whole canvas */
  frame: /** @type {any} */ (null),
  /** screen pixels per canvas pixel on the screen canvas: 1, or more in overdrive (see `low`) */
  ss: 1,
};
view.ctx.imageSmoothingEnabled = false;
// Overdrive shows the frame at `ss` times the canvas size: the game still draws its pixel art at CW x CH, into
// this canvas, and render/overdrive.js (odPresent) puts the frame together on the screen canvas, with the ice
// reflections in between at full resolution.
export const low = document.createElement('canvas');
export const pvc = $('pv'),
  pvx = pvc.getContext('2d');
pvx.imageSmoothingEnabled = false;

export const cam = { x: 24, y: 60 };
