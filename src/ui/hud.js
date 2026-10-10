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
// `big` is for the key moments (goals, fight results, the final result): bars in the team colour slide in
// above and below, the letters fly in one by one, a shine sweeps across and the subtitle rises in.
let hideTimer = 0;
export function banner(t, cls, sub, big) {
  const b = $('banner'),
    bt = $('bt');
  clearTimeout(hideTimer);
  bt.className = (cls || '') + (big ? ' big' : '');
  if (big) {
    bt.innerHTML = '';
    [...t].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', String(i));
      s.textContent = ch === ' ' ? '\u00a0' : ch;
      bt.appendChild(s);
    });
  } else bt.textContent = t;
  const team = (cls || '').includes('home')
    ? 'var(--home-ui)'
    : (cls || '').includes('away')
      ? 'var(--away-ui)'
      : 'var(--led)';
  b.style.setProperty('--bc', team);
  b.classList.toggle('big', !!big);
  b.classList.remove('out');
  $('bs').textContent = sub || '';
  b.hidden = false;
  // restart the entrance animations
  for (const el of [b, bt, $('bs'), ...b.querySelectorAll('.bbar')]) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }
}
export function hideBanner() {
  const b = $('banner');
  if (b.hidden) return;
  if (!b.classList.contains('big')) {
    b.hidden = true;
    return;
  }
  // big banners slide back out
  b.classList.add('out');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    b.hidden = true;
    b.classList.remove('out');
  }, 300);
}
export function showRec() {
  const r = loadRec()[settings.diffKey];
  $('rec').textContent = r
    ? 'Record vs ' + LABEL[settings.diffKey] + ': ' + r.w + ' W – ' + r.l + ' L'
    : 'No games yet vs ' + LABEL[settings.diffKey] + '.';
}
