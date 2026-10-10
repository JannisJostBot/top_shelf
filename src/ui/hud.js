import { $ } from '../core/dom';
import { loadRec } from '../core/storage';
import { LABEL, ORD } from '../data/difficulty';
import { G } from '../game/world';
import { settings } from '../settings';

/* ---------- HUD ---------- */
export function hud() {
  $('s0').textContent = G.score[0];
  $('s1').textContent = G.score[1];
  $('per').textContent = G.demo ? 'DEMO' : G.practice ? 'PRACTICE' : ORD[G.period];
  hudClock();
}
let lastClock = '';
export const clockText = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
export function hudClock() {
  let t;
  if (G.practice) t = 'FREE';
  else if (G.demo) t = clockText(settings.periodLen);
  else if (G.period > 3) t = 'SD';
  else {
    t = clockText(Math.max(0, Math.ceil(G.clock)));
  }
  if (t !== lastClock) {
    lastClock = t;
    $('clock').textContent = t;
  }
}
export function banner(t, cls, sub) {
  const b = $('banner'),
    bt = $('bt');
  bt.textContent = t;
  bt.className = cls || '';
  $('bs').textContent = sub || '';
  b.hidden = false;
  bt.style.animation = 'none';
  void bt.offsetWidth;
  bt.style.animation = '';
}
export function hideBanner() {
  $('banner').hidden = true;
}
export function showRec() {
  const r = loadRec()[settings.diffKey];
  $('rec').textContent = r
    ? 'Record vs ' + LABEL[settings.diffKey] + ': ' + r.w + ' W – ' + r.l + ' L'
    : 'No games yet vs ' + LABEL[settings.diffKey] + '.';
}
