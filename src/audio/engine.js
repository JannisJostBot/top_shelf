import { setCrowd } from './voices';
import { glideBuffer, stopBuffer, strideBuffer } from './skates';
import { settings } from '../settings';

/* ---------- audio ---------- */
export const mixer = { crowdBase: 0, swellEnd: 0, wobT: 0 };
export let AC = null,
  master = null,
  crowdG = null,
  noiseBuf = null,
  glideG = null;
export let strideBufs = [],
  stopBufs = [];
export function playBuf(b, vol, rate, pan) {
  if (!b) return;
  const s = AC.createBufferSource(),
    g = AC.createGain();
  s.buffer = b;
  s.playbackRate.value = rate || 1;
  g.gain.value = vol;
  s.connect(g);
  if (pan && AC.createStereoPanner) {
    const p = AC.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(master);
  } else g.connect(master);
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
      for (let i = 0; i < 6; i++) strideBufs.push(strideBuffer(AC));
      for (let i = 0; i < 3; i++) stopBufs.push(stopBuffer(AC));
      // blade glide: a looping hiss whose level follows skating speed (see glideTick)
      const gl = AC.createBufferSource();
      gl.buffer = glideBuffer(AC);
      gl.loop = true;
      glideG = AC.createGain();
      glideG.gain.value = 0;
      gl.connect(glideG);
      glideG.connect(master);
      gl.start(0);
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
