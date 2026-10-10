// Stick styles, chosen per team in the Teams tab. `shaft` and `edge` are colours or functions of
// (i, n, t): pixel i of n along the shaft from the hands down to the blade, and the time in seconds, so
// sticks can be patterned or animated. `blade` overrides the player's own tape colour when set.
const FIRE = ['#c4161c', '#ff4d2e', '#ff9b2f', '#ffde59'];

export const STICKS = {
  wood: {
    name: 'Old-school wood',
    shaft: '#9a6a35',
    edge: '#5e3c1a',
    swatch: 'linear-gradient(135deg,#d9a35e,#9a6a35 60%,#5e3c1a)',
  },
  carbon: {
    name: 'Modern carbon',
    shaft: (i, n) => (i === Math.floor(n * 0.35) ? '#d8343f' : '#2a2f39'),
    edge: '#0f1116',
    swatch: 'linear-gradient(135deg,#4a5160,#22262f 60%,#0f1116)',
  },
  alloy: {
    name: 'Alloy',
    shaft: '#b9c3cf',
    edge: '#6b7790',
    swatch: 'linear-gradient(135deg,#eef2f6,#b9c3cf 60%,#6b7790)',
  },
  gold: {
    name: 'Gold',
    sp: true,
    shaft: (i, n, t) => ((i + Math.floor(t * 14)) % 9 === 0 ? '#fff6c8' : '#e2b13c'),
    edge: '#8a6514',
    swatch: 'linear-gradient(135deg,#fff3b0,#e2b13c 55%,#8a6514)',
  },
  neon: {
    name: 'Neon',
    sp: true,
    anim: true,
    shaft: (i, n, t) => `hsl(${Math.floor(t * 200 + i * 14) % 360},100%,62%)`,
    edge: (i, n, t) => `hsl(${Math.floor(t * 200 + i * 14) % 360},100%,34%)`,
    swatch: 'linear-gradient(135deg,#ff3fb4,#3ff0ff,#ffde59)',
  },
  ice: {
    name: 'Ice crystal',
    sp: true,
    shaft: i => (i % 4 === 0 ? '#ffffff' : '#a9e4ff'),
    edge: '#4fa8d8',
    blade: '#e9fbff',
    swatch: 'linear-gradient(135deg,#ffffff,#a9e4ff 50%,#4fa8d8)',
  },
  fire: {
    name: 'Fire',
    sp: true,
    anim: true,
    // hottest at the blade, flickering
    shaft: (i, n, t) => FIRE[Math.min(3, Math.floor((i / n) * 3 + (Math.sin(t * 22 + i) > 0.3 ? 1 : 0)))],
    edge: '#7a1010',
    blade: '#ffde59',
    swatch: 'linear-gradient(135deg,#ffde59,#ff7a2f 50%,#c4161c)',
  },
  candy: {
    name: 'Candy cane',
    sp: true,
    shaft: i => (Math.floor(i / 2) % 2 ? '#ffffff' : '#d8343f'),
    edge: i => (Math.floor(i / 2) % 2 ? '#c9d2de' : '#8f1f28'),
    blade: '#ffffff',
    swatch: 'repeating-linear-gradient(135deg,#d8343f 0 5px,#ffffff 5px 10px)',
  },
};
/** Colour of pixel i of n of a stick part at time t. */
export const stickCol = (c, i, n, t) => (typeof c === 'function' ? c(i, n, t) : c);
