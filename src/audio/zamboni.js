// The resurfacer's diesel hum (rising with its speed) and its horn.
import { settings } from '../settings';
import { AC, master, osc } from './engine';

let eng = null;
/** 'start' when it sets off, 'speed' with the current speed while driving, 'pause' / 'resume' around a pause
 * (quiet, then back at the same note), 'stop' when it is done. */
export function zamEngine(cmd, v) {
  if (cmd === 'start') {
    if (!AC || settings.muted) return;
    try {
      const t = AC.currentTime,
        o1 = AC.createOscillator(),
        o2 = AC.createOscillator(),
        lp = AC.createBiquadFilter(),
        g = AC.createGain();
      o1.type = 'sawtooth';
      o2.type = 'triangle';
      o1.frequency.value = 52;
      o2.frequency.value = 104;
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.4);
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(master);
      o1.start(t);
      o2.start(t);
      eng = { o1, o2, g, lp };
    } catch (e) {}
  } else if (cmd === 'speed') {
    if (!eng) return;
    const t = AC.currentTime;
    eng.o1.frequency.setTargetAtTime(52 + v * 1.1, t, 0.1);
    eng.o2.frequency.setTargetAtTime(104 + v * 2.2, t, 0.1);
    eng.lp.frequency.setTargetAtTime(420 + v * 14, t, 0.1);
  } else if (cmd === 'pause' || cmd === 'resume') {
    if (!eng || !AC) return;
    const t = AC.currentTime;
    try {
      eng.g.gain.cancelScheduledValues(t);
      eng.g.gain.setValueAtTime(eng.g.gain.value, t);
      eng.g.gain.linearRampToValueAtTime(cmd === 'pause' ? 0.0001 : 0.09, t + (cmd === 'pause' ? 0.15 : 0.3));
    } catch (e) {}
  } else if (cmd === 'stop') {
    if (!eng || !AC) return;
    const t = AC.currentTime;
    try {
      eng.g.gain.cancelScheduledValues(t);
      eng.g.gain.setValueAtTime(eng.g.gain.value, t);
      eng.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      eng.o1.stop(t + 0.6);
      eng.o2.stop(t + 0.6);
    } catch (e) {}
    eng = null;
  }
}
export function zamHorn() {
  if (!AC || settings.muted) return;
  const t = AC.currentTime;
  osc('square', 330, t, 0.38, 0.08);
  osc('square', 415, t, 0.38, 0.07);
}
