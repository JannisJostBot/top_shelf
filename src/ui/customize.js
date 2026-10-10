import { audio } from '../audio/engine';
import { STICKS } from '../data/sticks';
import { SONGS, chime, playSong } from '../audio/music';
import { $ } from '../core/dom';
import { savePrefs } from '../core/storage';
import { PUCKS, puckStyle } from '../data/pucks';
import { STADIUMS } from '../data/stadiums';
import { COLORS } from '../data/teams';
import { kit } from '../game/kit';
import { buildPals } from '../game/players';
import { buildIce, drawThumb, ice } from '../render/ice';
import { mkPal } from '../render/sprites';
import { buildFans } from '../render/stands';
import { settings } from '../settings';

export function applyColors() {
  const u = COLORS[settings.colorKey],
    ck =
      settings.cpuKey !== 'auto' && COLORS[settings.cpuKey] && settings.cpuKey !== settings.colorKey
        ? settings.cpuKey
        : ['red', 'orange', 'inferno', 'maroon', 'pink'].includes(settings.colorKey)
          ? 'blue'
          : 'red',
    cpu = COLORS[ck];
  kit.TEAMS = [u, cpu];
  kit.PAL = [mkPal(u), mkPal(cpu)];
  buildPals();
  buildFans();
  const st = document.documentElement.style;
  st.setProperty('--home', u.bg || u.main);
  st.setProperty('--home-ink', u.ink);
  st.setProperty('--home-ui', u.ui);
  st.setProperty('--away', cpu.main);
  st.setProperty('--away-ink', cpu.ink);
  st.setProperty('--away-ui', cpu.ui);
  $('cpuLine').textContent =
    (u.special ? u.name + ' is a special jersey. ' : '') + 'CPU plays in ' + cpu.name + '.';
  $('matchLine').textContent = u.name + ' vs ' + cpu.name;
  document
    .querySelectorAll('#swatches button')
    .forEach(b => b.setAttribute('aria-checked', String(b.dataset.c === settings.colorKey)));
  document.querySelectorAll('#cpuSwatches button').forEach(b => {
    b.setAttribute(
      'aria-checked',
      String(b.dataset.c === (settings.cpuKey === settings.colorKey ? 'auto' : settings.cpuKey)),
    );
    b.setAttribute('aria-disabled', String(b.dataset.c === settings.colorKey));
  });
}
const sw = $('swatches');
const csw = $('cpuSwatches');
const psw = $('puckSwatches');
export function setStick(team, k) {
  if (!STICKS[k]) return;
  settings.sticks[team] = k;
  document
    .querySelectorAll('#stickSwatches' + team + ' button')
    .forEach(b => b.setAttribute('aria-checked', String(b.dataset.s === k)));
  const name = t => STICKS[settings.sticks[t]].name + (STICKS[settings.sticks[t]].sp ? ' (special)' : '');
  $('stickLine').textContent = 'Sticks: ' + name(0) + ' vs ' + name(1);
}
export function setPuck(k) {
  if (!PUCKS[k]) return;
  settings.puckKey = k;
  kit.PS = puckStyle();
  const s = PUCKS[k];
  document
    .querySelectorAll('#puckSwatches button')
    .forEach(b => b.setAttribute('aria-checked', String(b.dataset.c === k)));
  $('puckLine').textContent = 'Puck: ' + s.name + (s.sp ? ' (special)' : '');
}
const aseg = $('arenaSeg');
export function setArena(k, preview) {
  settings.stadiumKey = k;
  buildIce();
  const S = STADIUMS[k];
  document.documentElement.style.setProperty('--kick', S.kick);
  document
    .querySelectorAll('#arenaSeg button')
    .forEach(x => x.setAttribute('aria-checked', String(x.dataset.a === k)));
  $('arenaLine').textContent = 'Home of the ' + S.team + ' · Goal song: ' + SONGS[S.song].name;
  $('paName').textContent = S.name;
  $('paTeam').textContent = 'Home of the ' + S.team;
  drawThumb(ice, $('pvArena'), k);
  if (preview && !settings.muted && audio()) {
    try {
      chime();
      playSong(S.song, 0.3);
    } catch (e) {}
  }
}
export function initCustomize() {
  for (const k of Object.keys(COLORS)) {
    const c = COLORS[k],
      b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.id = 'c-' + k;
    b.dataset.c = k;
    b.setAttribute('aria-label', c.name);
    b.title = c.name;
    b.style.background =
      c.bg || `linear-gradient(to bottom,${c.main} 0 55%,${c.trim} 55% 70%,${c.main} 70% 100%)`;
    if (c.anim) b.classList.add('anim');
    b.addEventListener('click', () => {
      settings.colorKey = k;
      applyColors();
      savePrefs();
    });
    sw.appendChild(b);
  }
  for (const k of ['auto', ...Object.keys(COLORS)]) {
    const c = COLORS[k],
      b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.id = 'cc-' + k;
    b.dataset.c = k;
    b.setAttribute('aria-label', k === 'auto' ? 'Automatic contrast' : c.name);
    b.title = k === 'auto' ? 'Auto' : c.name;
    if (k === 'auto') {
      b.classList.add('auto');
      b.textContent = 'A';
    } else {
      b.style.background =
        c.bg || `linear-gradient(to bottom,${c.main} 0 55%,${c.trim} 55% 70%,${c.main} 70% 100%)`;
      if (c.anim) b.classList.add('anim');
    }
    b.addEventListener('click', () => {
      if (k === settings.colorKey) return;
      settings.cpuKey = k;
      applyColors();
      savePrefs();
    });
    csw.appendChild(b);
  }
  for (const k of Object.keys(PUCKS)) {
    const s = PUCKS[k],
      b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.id = 'pk-' + k;
    b.dataset.c = k;
    b.setAttribute('aria-label', s.name + ' puck');
    b.title = s.name;
    if (s.bg) {
      b.style.background = s.bg;
      if (k === 'rainbow' || k === 'disco') b.classList.add('anim');
    } else {
      b.style.background = s.b;
      b.style.setProperty('--pr', s.r);
    }
    b.addEventListener('click', () => {
      setPuck(k);
      savePrefs();
    });
    psw.appendChild(b);
  }
  for (const team of [0, 1])
    for (const k of Object.keys(STICKS)) {
      const st = STICKS[k],
        b = document.createElement('button');
      b.setAttribute('role', 'radio');
      b.dataset.s = k;
      b.setAttribute('aria-label', st.name + ' sticks');
      b.title = st.name;
      b.style.background = st.swatch;
      if (st.anim) b.classList.add('anim');
      b.addEventListener('click', () => {
        setStick(team, k);
        savePrefs();
      });
      $('stickSwatches' + team).appendChild(b);
    }
  for (const k of Object.keys(STADIUMS)) {
    const S = STADIUMS[k],
      b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.id = 'a-' + k;
    b.dataset.a = k;
    b.className = 'acard';
    b.innerHTML =
      '<canvas id="th-' +
      k +
      '" width="120" height="82" aria-hidden="true"></canvas><b>' +
      S.name +
      '</b><span>' +
      S.team +
      ' · ' +
      SONGS[S.song].name +
      '</span>';
    b.addEventListener('click', () => {
      setArena(k, true);
      savePrefs();
    });
    aseg.appendChild(b);
  }
}
