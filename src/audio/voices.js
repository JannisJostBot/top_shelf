import { AC, crowdG, master, mixer, noiseBuf, nz, osc } from './engine';
import { pick, rnd } from '../core/math';

// voices: a buzzy source shaped by three vowel formants
const VOW = { a: [780, 1150, 2700], o: [480, 830, 2600], u: [380, 950, 2350], e: [450, 1750, 2550] };
function formants(F, dest) {
  return F.map((f, i) => {
    const b = AC.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = f;
    b.Q.value = 7;
    const g = AC.createGain();
    g.gain.value = [1.5, 0.85, 0.35][i] * 3;
    b.connect(g);
    g.connect(dest);
    return b;
  });
}
export function grunt(f0, delay, soft) {
  const t = AC.currentTime + (delay || 0),
    F = VOW[pick(['u', 'o', 'a'])],
    env = AC.createGain();
  env.connect(master);
  const peak = soft ? 0.22 : 0.42,
    len = soft ? 0.16 : 0.3;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.018);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const bank = formants(F, env),
    src = AC.createGain();
  src.gain.value = 0.6;
  bank.forEach(b => src.connect(b));
  const o = AC.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 1.18, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + len);
  o.connect(src);
  o.start(t);
  o.stop(t + len + 0.05);
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  const ng = AC.createGain();
  ng.gain.value = 0.4;
  s.connect(ng);
  ng.connect(src);
  s.start(t, Math.random());
  s.stop(t + len + 0.05);
}
export function crowdVoices(n, v, dur, vol, drop) {
  const t = AC.currentTime,
    env = AC.createGain();
  env.connect(master);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.25));
  env.gain.setValueAtTime(vol, t + dur * 0.5);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const bank = formants(VOW[v], env),
    bus = AC.createGain();
  bus.gain.value = 1 / Math.sqrt(n);
  bank.forEach(b => bus.connect(b));
  for (let i = 0; i < n; i++) {
    const st = t + rnd(0, 0.14),
      f = rnd(115, 320),
      o = AC.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, st);
    if (drop) o.frequency.exponentialRampToValueAtTime(f * drop, t + dur);
    const l = AC.createOscillator();
    l.frequency.value = rnd(4.5, 7.5);
    const lg = AC.createGain();
    lg.gain.value = f * 0.025;
    l.connect(lg);
    lg.connect(o.frequency);
    const g = AC.createGain();
    g.gain.value = rnd(0.4, 1);
    o.connect(g);
    g.connect(bus);
    o.start(st);
    l.start(st);
    o.stop(t + dur + 0.05);
    l.stop(t + dur + 0.05);
  }
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  const ng = AC.createGain();
  ng.gain.value = 0.6;
  s.connect(ng);
  ng.connect(bus);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}
export function clatter(t, n, vol) {
  for (let i = 0; i < n; i++)
    nz(t + rnd(0, 0.09), 0.028, vol * rnd(0.5, 1), 'bandpass', rnd(2200, 5200), null, 4, 0.001);
}
export function stickClatter(t) {
  [0, 0.13, 0.22].forEach((d, i) => {
    nz(t + d, 0.045, 0.32 / (i + 1), 'bandpass', rnd(1100, 1700), null, 6, 0.001);
    osc('triangle', rnd(700, 950), t + d, 0.06, 0.09 / (i + 1), 400);
  });
}
export function setCrowd(v) {
  mixer.crowdBase = v;
  if (AC && crowdG) {
    const t = AC.currentTime;
    crowdG.gain.cancelScheduledValues(t);
    crowdG.gain.setTargetAtTime(v, t, 0.4);
  }
}
export function swell(peak, up, hold, down) {
  if (!AC || !crowdG) return;
  const t = AC.currentTime,
    g = crowdG.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(peak, t + up);
  g.setValueAtTime(peak, t + up + hold);
  g.linearRampToValueAtTime(mixer.crowdBase, t + up + hold + down);
  mixer.swellEnd = t + up + hold + down;
}
