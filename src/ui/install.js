// On a phone or tablet in the browser, the first visit (each session, until "Don't show again") explains how to add
// the game to the home screen: it then opens fullscreen like an app. Where the browser offers its own install
// prompt (Chrome on Android), an Install button opens it.
import { $ } from '../core/dom';

const KEY = 'blb-install',
  SEEN = 'blb-install-seen';
const ua = navigator.userAgent;
const ios = () => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const mobile = () => matchMedia('(pointer: coarse)').matches && (ios() || /Android|Mobile/i.test(ua));
const installed = () =>
  navigator.standalone === true ||
  matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;
function get(store, k) {
  try {
    return store.getItem(k);
  } catch (e) {
    return null;
  }
}
function set(store, k, v) {
  try {
    store.setItem(k, v);
  } catch (e) {}
}
// the share icon of Safari, drawn in pixels
const SHARE =
  '<svg class="ishare" viewBox="0 0 12 14" shape-rendering="crispEdges" aria-label="Share">' +
  '<rect x="5" y="0" width="2" height="9"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="1" width="1" height="1"/>' +
  '<rect x="7" y="1" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="0" y="5" width="4" height="1"/>' +
  '<rect x="8" y="5" width="4" height="1"/><rect x="0" y="5" width="1" height="9"/><rect x="11" y="5" width="1" height="9"/>' +
  '<rect x="0" y="13" width="12" height="1"/></svg>';

let deferred = null;
function show() {
  const steps = ios()
    ? [
        'Tap ' + SHARE + ' <b>Share</b>: at the bottom in Safari, or next to the address bar',
        'Scroll down and tap <b>Add to Home Screen</b>',
        'Open Top Shelf from your home screen',
      ]
    : [
        'Open the browser menu <b>⋮</b> (top right)',
        'Tap <b>Install app</b> or <b>Add to Home screen</b>',
        'Open Top Shelf from your home screen',
      ];
  $('installSteps').innerHTML = steps.map(t => '<li>' + t + '</li>').join('');
  $('installBtn').hidden = !deferred;
  $('installOv').hidden = false;
  set(sessionStorage, SEEN, '1');
}
function close() {
  if ($('installNever').checked) set(localStorage, KEY, 'off');
  $('installOv').hidden = true;
}
export function initInstallHint() {
  // Chrome's own install prompt, kept for the Install button
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    $('installBtn').hidden = false;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    $('installOv').hidden = true;
  });
  $('installOk').addEventListener('click', close);
  $('installBtn').addEventListener('click', async () => {
    if (!deferred) return;
    const d = deferred;
    deferred = null;
    try {
      await d.prompt();
      const r = await d.userChoice;
      if (r && r.outcome === 'accepted') $('installOv').hidden = true;
    } catch (e) {}
    $('installBtn').hidden = true;
  });
  // (not over an invite link: joining a friend comes first)
  if (!mobile() || installed() || /#join=/.test(location.hash)) return;
  if (get(localStorage, KEY) === 'off' || get(sessionStorage, SEEN)) return;
  setTimeout(() => {
    if (!installed()) show();
  }, 1200);
}
