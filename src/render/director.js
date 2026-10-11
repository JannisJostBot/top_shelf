// Cinematic camera for Watch mode (CPU vs CPU): cuts between the top-down views and the 3D broadcast shots
// every few seconds. Goal replays keep their own angles. V (or Y on a controller) skips to the next shot.
import { clock } from '../core/time';
import { view } from './canvas';

const SHOTS = [
  { kind: '2d', zoom: 1, name: 'BROADCAST' },
  { kind: 'chase', name: 'CHASE CAM' },
  { kind: '2d', zoom: 2, name: 'TIGHT' },
  { kind: 'orbit', name: 'SKY CAM' },
  { kind: 'guest', name: 'FAN CAM' },
  { kind: 'net', name: 'NET CAM' },
  { kind: 'boards', name: 'RINKSIDE' },
];
const SHOT_LEN = 6;
const dir = { i: 0, t0: 0, fresh: true, toast: '', toastUntil: 0 };
/** Shows `text` in place of the shot caption for a moment (after switching cameras). */
export function camToast(text) {
  dir.toast = text;
  dir.toastUntil = clock.now + 1.8;
}
export const camToastOn = () => clock.now < dir.toastUntil;

/** The current shot; `fresh` is true on the first frame after a cut. */
export function directorShot() {
  if (clock.now - dir.t0 > SHOT_LEN) nextShot();
  const fresh = dir.fresh;
  dir.fresh = false;
  return { ...SHOTS[dir.i], fresh };
}
export function nextShot() {
  dir.i = (dir.i + 1) % SHOTS.length;
  dir.t0 = clock.now;
  dir.fresh = true;
}
export function resetDirector() {
  dir.i = 0;
  dir.t0 = clock.now;
  dir.fresh = true;
}
/** Small "LIVE" caption with the shot name, bottom left. */
export function liveLabel(name) {
  const g = view.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = '7px "Press Start 2P", monospace';
  g.textBaseline = 'middle';
  const label = camToastOn() ? dir.toast : 'LIVE · ' + name,
    w = Math.ceil(g.measureText(label).width) + 18,
    y = view.CH - 16;
  g.globalAlpha = 0.75;
  g.fillStyle = '#05070d';
  g.fillRect(6, y - 7, w, 14);
  g.globalAlpha = 1;
  g.fillStyle = Math.floor(clock.now * 2) % 2 ? '#ff3b3b' : '#8a1f1f';
  g.fillRect(10, y - 2, 4, 4);
  g.fillStyle = '#ffffff';
  g.fillText(label, 18, y + 1);
}
