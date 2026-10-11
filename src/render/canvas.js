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
  /** canvas rows to frame the 3D view in (the menu's window on phones), or null for the whole canvas */
  frame: /** @type {any} */ (null),
};
view.ctx.imageSmoothingEnabled = false;
export const pvc = $('pv'),
  pvx = pvc.getContext('2d');
pvx.imageSmoothingEnabled = false;

export const cam = { x: 24, y: 60 };
