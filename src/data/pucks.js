import { clock } from '../core/time';
import { settings } from '../settings';

export const FIRE = ['#c4161c', '#ff4d2e', '#ff9b2f', '#ffde59'];
const hueC = (o, l) => `hsl(${Math.floor(clock.now * 160 + o) % 360},90%,${l}%)`;
export const PUCKS = {
  classic: { name: 'Classic', b: '#14161c', h: '#5a6378', r: '#46f2ff' },
  white: { name: 'Snowball', b: '#eef1f5', h: '#ffffff', r: '#2f6bd8' },
  red: { name: 'Red', b: '#c4161c', h: '#ff6b71', r: '#ffc845' },
  blue: { name: 'Blue', b: '#1f4fd1', h: '#7d9be0', r: '#46f2ff' },
  green: { name: 'Green', b: '#137a43', h: '#4fd38a', r: '#c4f060' },
  orange: { name: 'Orange', b: '#e8650f', h: '#ffb070', r: '#2fa8ff' },
  gold: { name: 'Gold', b: '#c99a1e', h: '#fff3b0', r: '#6b3f00' },
  pink: { name: 'Pink', b: '#e0559c', h: '#ffb3d7', r: '#7a1048' },
  rainbow: {
    name: 'Rainbow',
    sp: 1,
    b: () => hueC(0, 52),
    h: () => hueC(120, 78),
    r: () => hueC(200, 62),
    tr: () => hueC(Math.random() * 360, 62),
    bg: 'linear-gradient(90deg,#ff3b3b,#ffb02e,#ffe14d,#3bd16f,#2fa8ff,#8a4dff,#ff3b3b)',
  },
  fire: {
    name: 'Fireball',
    sp: 1,
    b: () => FIRE[Math.floor(clock.now * 12) % 2],
    h: () => FIRE[3],
    r: () => FIRE[1 + (Math.floor(clock.now * 15) % 3)],
    tr: () => FIRE[Math.floor(Math.random() * 4)],
    bg: 'radial-gradient(circle,#ffde59 0 25%,#ff9b2f 45%,#c4161c 80%)',
  },
  plasma: {
    name: 'Plasma',
    sp: 1,
    b: '#1a0b2e',
    h: () => (Math.sin(clock.now * 9) > 0 ? '#ff4df0' : '#46f2ff'),
    r: () => `hsl(${Math.floor(240 + 60 * Math.sin(clock.now * 4))},95%,62%)`,
    tr: () => (Math.random() < 0.5 ? '#ff4df0' : '#46f2ff'),
    bg: 'radial-gradient(circle,#1a0b2e 0 35%,#ff4df0 55%,#46f2ff 85%)',
  },
  ghost: {
    name: 'Ghost',
    sp: 1,
    b: '#dfe8f5',
    h: '#ffffff',
    r: '#9fb6d6',
    a: () => 0.35 + 0.3 * (1 + Math.sin(clock.now * 3.2)),
    tr: () => '#dfe8f5',
    bg: 'radial-gradient(circle,rgba(255,255,255,.95) 0 35%,rgba(170,190,220,.5) 70%)',
  },
  galaxy: {
    name: 'Galaxy',
    sp: 1,
    b: () => (Math.sin(clock.now * 7) > 0.6 ? '#3a2a7a' : '#1b1240'),
    h: () => (Math.sin(clock.now * 11) > 0 ? '#ffffff' : '#c7a6ff'),
    r: '#9b5cff',
    tr: () => (Math.random() < 0.4 ? '#ffffff' : '#c7a6ff'),
    bg: 'radial-gradient(circle at 35% 35%,#fff 0 6%,#3a2a7a 10%,#1b1240 60%,#9b5cff 90%)',
  },
  disco: {
    name: 'Disco',
    sp: 1,
    b: '#b8c0cc',
    h: () => ['#ff3b3b', '#ffe14d', '#3bd16f', '#2fa8ff', '#ff4df0'][Math.floor(clock.now * 8) % 5],
    r: () => ['#2fa8ff', '#ff4df0', '#ffe14d', '#3bd16f'][Math.floor(clock.now * 6) % 4],
    tr: () => ['#ff3b3b', '#ffe14d', '#3bd16f', '#2fa8ff', '#ff4df0'][Math.floor(Math.random() * 5)],
    bg: 'repeating-conic-gradient(#e8ecf2 0 25%,#8e98a8 0 50%)',
  },
};
const pv = v => (typeof v === 'function' ? v() : v);
export function puckStyle(k) {
  const s = PUCKS[k || settings.puckKey] || PUCKS.classic;
  const b = pv(s.b);
  return { b, h: pv(s.h), r: pv(s.r), a: s.a ? s.a() : 1, dk: pkDark(pv(s.r)), sd: sideOf(b) };
}
/** The puck's edge (its side band, seen below the top face): a darker shade of the body colour. */
export function sideOf(c) {
  if (c[0] !== '#') return c.replace(/(\d+)%\)$/, (_, l) => Math.round(+l * 0.55) + '%)');
  const n = parseInt(c.slice(1), 16);
  return (
    '#' +
    [16, 8, 0]
      .map(o =>
        Math.floor(((n >> o) & 255) * 0.55)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function pkDark(c) {
  if (c[0] !== '#') return c.replace(/(\d+)%\)$/, '22%)');
  const n = parseInt(c.slice(1), 16);
  return (
    '#' +
    [16, 8, 0]
      .map(o =>
        Math.floor(((n >> o) & 255) * 0.33)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
