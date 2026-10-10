// Fullscreen: the scoreboard button, the Setup row and the F key all toggle it. Browsers that allow it
// (desktop, Android, iPad) hide their own controls; iPhone Safari does not let pages go fullscreen, so there
// the Setup row explains how to add the game to the home screen, which opens it without browser bars.
import { $ } from '../core/dom';

const root = document.documentElement;
const supported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const current = () => document.fullscreenElement || document.webkitFullscreenElement;

export function toggleFullscreen() {
  try {
    if (current()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      const p = req && req.call(root, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
}

function show() {
  const on = !!current();
  $('fsBtn').setAttribute('aria-pressed', String(on));
  document
    .querySelectorAll('#fsSeg button')
    .forEach(b => b.setAttribute('aria-checked', String((b.dataset.v === 'on') === on)));
}

export function initFullscreen() {
  if (!supported()) {
    // iPhone: no fullscreen for web pages; installing the game gives the same result
    $('fsBtn').hidden = true;
    document.querySelector('#fsSeg').hidden = true;
    $('fsHint').textContent = 'On iPhone: Share, then Add to Home Screen, to play without the browser bars';
    return;
  }
  $('fsBtn').addEventListener('click', toggleFullscreen);
  document.querySelectorAll('#fsSeg button').forEach(b =>
    b.addEventListener('click', () => {
      if ((b.dataset.v === 'on') !== !!current()) toggleFullscreen();
    }),
  );
  addEventListener('keydown', e => {
    if (e.code === 'KeyF' && !e.repeat && !e.metaKey && !e.ctrlKey) toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', show);
  document.addEventListener('webkitfullscreenchange', show);
  show();
}
