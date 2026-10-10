import { AC, master, noiseBuf } from './engine';
import { STADIUMS } from '../data/stadiums';
import { G } from '../game/world';
import { settings } from '../settings';

// Original goal songs: chiptune lead + triangle bass + noise drums, one per arena
export const SONGS = {
  snow: {
    name: 'Snowstorm',
    bpm: 152,
    wave: 'square',
    lead: 'E5:1 G5:1 B5:1 E6:2 D6:1 B5:1 G5:2 A5:1 B5:1 D6:1 E6:3 R:1 E6:1 D6:1 B5:1 G5:1 A5:2 B5:2 E6:4',
    bass: 'E3:2 E3:2 G3:2 G3:2 A3:2 A3:2 B2:2 B2:2 E3:2 E3:2 C3:2 D3:2 E3:4',
    drums: 'k.h.s.h.k.k.s.h.',
  },
  stomp: {
    name: 'Harbor Stomp',
    bpm: 132,
    wave: 'square',
    lead: 'D5:2 D5:1 F5:1 A5:2 G5:1 F5:1 D5:2 R:1 C5:1 D5:4 F5:1 G5:1 A5:2 C6:2 A5:1 G5:1 A5:4',
    bass: 'D3:4 D3:4 C3:4 D3:4 F3:4 C3:4 D3:4',
    drums: 'k.k.s...k.k.s.s.',
  },
  fanfare: {
    name: 'Summit Fanfare',
    bpm: 140,
    wave: 'sawtooth',
    lead: 'C5:1 C5:1 C5:1 G5:3 E5:1 G5:1 C6:4 R:2 A5:1 B5:1 C6:1 D6:1 E6:2 C6:2 G5:2 C6:4',
    bass: 'C3:4 C3:4 E3:4 G3:4 F3:4 G3:4 C3:4',
    drums: 'k...s...k.k.s.h.',
  },
  comet: {
    name: 'Comet Run',
    bpm: 160,
    wave: 'square',
    lead: 'A4:1 C5:1 E5:1 A5:1 G5:1 E5:1 C5:1 E5:1 F5:1 A5:1 C6:1 A5:1 G5:2 E5:2 A5:1 C6:1 E6:1 C6:1 B5:1 G5:1 E5:1 G5:1 A5:4',
    bass: 'A2:2 A3:2 A2:2 A3:2 F2:2 F3:2 G2:2 G3:2 A2:2 A3:2 E2:2 E3:2 A2:4',
    drums: 'khshkhsh',
  },
  visitors: {
    name: 'Visitors',
    bpm: 150,
    wave: 'square',
    lead: 'G4:1 C5:1 E5:1 G5:3 E5:1 G5:3',
    bass: 'C3:4 C3:6',
    drums: 'k.s.k.s.k.',
  },
};
const nn = s => {
  const m = /^([A-G])(#?)(\d)$/.exec(s);
  return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
};
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
let songOut = null;
export function stopSong(fade) {
  if (!songOut || !AC) return;
  const g = songOut.gain,
    t = AC.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.0001, t + (fade || 0.05));
  songOut = null;
}
export function playSong(key, delay) {
  const S = SONGS[key];
  if (!S || !AC) return;
  stopSong(0.05);
  const t0 = AC.currentTime + (delay || 0),
    e = 60 / S.bpm / 2,
    out = AC.createGain();
  out.gain.value = 1;
  out.connect(master);
  songOut = out;
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = S.wave === 'sawtooth' ? 2300 : 4200;
  lp.connect(out);
  const note = (f, t, d, type, vol, dest) => {
    const o = AC.createOscillator(),
      g = AC.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol * 0.8, t + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.97);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + d);
  };
  let t = t0,
    len = 0;
  for (const tok of S.lead.split(' ')) {
    const [n, dd] = tok.split(':'),
      d = +dd * e;
    if (n !== 'R') {
      const f = mf(nn(n));
      note(f, t, d, S.wave, 0.055, lp);
      note(f * 1.006, t, d, S.wave, 0.022, lp);
    }
    t += d;
    len += +dd;
  }
  t = t0;
  for (const tok of S.bass.split(' ')) {
    const [n, dd] = tok.split(':'),
      d = +dd * e;
    note(mf(nn(n)), t, d, 'triangle', 0.14, out);
    t += d;
  }
  for (let i = 0; i < len; i++) {
    const ch = S.drums[i % S.drums.length],
      tt = t0 + i * e;
    if (ch === 'k') {
      const o = AC.createOscillator(),
        g = AC.createGain();
      o.frequency.setValueAtTime(140, tt);
      o.frequency.exponentialRampToValueAtTime(45, tt + 0.13);
      g.gain.setValueAtTime(0.38, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.15);
      o.connect(g);
      g.connect(out);
      o.start(tt);
      o.stop(tt + 0.16);
    } else if (ch === 's' || ch === 'h') {
      const sn = ch === 's',
        src = AC.createBufferSource(),
        f = AC.createBiquadFilter(),
        g = AC.createGain();
      src.buffer = noiseBuf;
      f.type = 'highpass';
      f.frequency.value = sn ? 1400 : 7000;
      g.gain.setValueAtTime(sn ? 0.22 : 0.07, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (sn ? 0.13 : 0.04));
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(tt, Math.random());
      src.stop(tt + 0.15);
    }
  }
}
// goal light chime: three quick bell strikes
export function chime() {
  const t = AC.currentTime;
  [1568, 2093, 2637].forEach((f, i) => {
    const tt = t + i * 0.09;
    for (const [m, v] of [
      [1, 0.07],
      [2.76, 0.025],
      [5.4, 0.01],
    ]) {
      const o = AC.createOscillator(),
        g = AC.createGain();
      o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(v, tt + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
      o.connect(g);
      g.connect(master);
      o.start(tt);
      o.stop(tt + 0.95);
    }
  });
}
export function goalMusic(team) {
  if (G.demo || settings.muted || !AC) return;
  try {
    chime();
    playSong(G.watch && team === 1 ? 'visitors' : STADIUMS[settings.stadiumKey].song, 1.1);
  } catch (e) {}
}
