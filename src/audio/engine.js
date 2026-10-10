import { setCrowd } from './voices';
import { rnd } from '../core/math';
import { settings } from '../settings';

/* ---------- audio ---------- */
export const mixer = { crowdBase: 0, swellEnd: 0, wobT: 0 };
export let AC = null,
  master = null,
  crowdG = null,
  noiseBuf = null;
export let strideBufs = [],
  stopBufs = [];
// Pre-rendered blade scrapes. Steep high-pass + gentle low-pass keeps the body bright, a random (non-periodic)
// roughness envelope gives the grit, and two faint decaying partials add the glassy ring of steel on hard ice.
function makeScrape(dur, hp, lp, att, decay, grit, partials, pAmp) {
  const sr = AC.sampleRate,
    n = Math.floor(dur * sr),
    b = AC.createBuffer(1, n, sr),
    d = b.getChannelData(0);
  const ah = Math.exp((-2 * Math.PI * hp) / sr),
    al = 1 - Math.exp((-2 * Math.PI * lp) / sr),
    ph = partials.map(() => Math.random() * 6.28);
  let h1 = 0,
    h1x = 0,
    h2 = 0,
    h2x = 0,
    h3 = 0,
    h3x = 0,
    l1 = 0,
    l2 = 0,
    gr = 0.5,
    peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr,
      x = Math.random() * 2 - 1;
    h1 = ah * (h1 + x - h1x);
    h1x = x;
    h2 = ah * (h2 + h1 - h2x);
    h2x = h1;
    h3 = ah * (h3 + h2 - h3x);
    h3x = h2;
    l1 += al * (h3 - l1);
    l2 += al * (l1 - l2);
    gr += (Math.random() - gr) * grit;
    const env = t < att ? Math.sin(((t / att) * Math.PI) / 2) : Math.exp(-(t - att) * decay);
    let s = l2 * env * (0.3 + gr * 1.2);
    for (let k = 0; k < partials.length; k++)
      s += Math.sin(2 * Math.PI * partials[k] * t + ph[k]) * pAmp * env * Math.exp(-t * 14);
    d[i] = s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  for (let i = 0; i < n; i++) d[i] /= peak || 1;
  return b;
}
export function playBuf(b, vol, rate) {
  if (!b) return;
  const s = AC.createBufferSource(),
    g = AC.createGain();
  s.buffer = b;
  s.playbackRate.value = rate || 1;
  g.gain.value = vol;
  s.connect(g);
  g.connect(master);
  s.start();
}
export function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      master = AC.createGain();
      master.gain.value = settings.muted ? 0 : 0.9;
      master.connect(comp);
      comp.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // crowd bed sits in the 500 Hz–2 kHz range so phone speakers can actually reproduce it
      const s = AC.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      const b1 = AC.createBiquadFilter();
      b1.type = 'bandpass';
      b1.frequency.value = 650;
      b1.Q.value = 0.8;
      const b2 = AC.createBiquadFilter();
      b2.type = 'bandpass';
      b2.frequency.value = 1500;
      b2.Q.value = 1.1;
      const g2 = AC.createGain();
      g2.gain.value = 0.55;
      crowdG = AC.createGain();
      crowdG.gain.value = 0;
      s.connect(b1);
      s.connect(b2);
      b2.connect(g2);
      b1.connect(crowdG);
      g2.connect(crowdG);
      crowdG.connect(master);
      s.start(0);
      for (let i = 0; i < 5; i++)
        strideBufs.push(
          makeScrape(
            0.2,
            rnd(1500, 1900),
            rnd(6500, 8500),
            0.025,
            13,
            0.045,
            [rnd(2800, 3400), rnd(4300, 5200)],
            0.05,
          ),
        );
      for (let i = 0; i < 2; i++)
        stopBufs.push(makeScrape(0.5, 1100, 9500, 0.04, 5, 0.09, [rnd(2500, 3000)], 0.04));
      setCrowd(mixer.crowdBase);
    } catch (e) {
      AC = null;
    }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
export function osc(type, f, t, dur, vol, f2, a) {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (a || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
export function nz(t, dur, vol, type, f, f2, q, a) {
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  const fl = AC.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q || 1;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (a || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl);
  fl.connect(g);
  g.connect(master);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}
