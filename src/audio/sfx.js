import { AC, crowdG, glideG, master, mixer, nz, osc, playBuf, stopBufs, strideBufs } from './engine';
import { clatter, crowdVoices, grunt, stickClatter, swell } from './voices';
import { BASE, K } from '../config';
import { clamp, pick, rnd } from '../core/math';
import { clock } from '../core/time';
import { SKATERS } from '../game/players';
import { G } from '../game/world';
import { cam, view } from '../render/canvas';
import { settings } from '../settings';

/** A random factor around 1, so puck and body sounds never repeat exactly. */
const vary = amt => rnd(1 - amt, 1 + amt);
/** The weight of a heavy body hit: a sub-bass drop and a long low boom (k scales it down for lighter hits). */
function heavyImpact(t, k) {
  const p = vary(0.08);
  osc('sine', 60 * p, t, 0.5 * k, 1 * k, 26, 0.002);
  osc('sine', 120 * p, t, 0.15, 0.5 * k, 55);
  nz(t, 0.35 * k, 0.7 * k, 'lowpass', 700, 120);
  nz(t + 0.03, 0.45 * k, 0.35 * k, 'lowpass', 300, 90);
}
/** Stick on puck for passes: a rounded wooden tock. */
function tock(k) {
  const t = AC.currentTime,
    p = vary(0.08);
  nz(t, 0.03, 0.45 * k, 'bandpass', 1250 * p, null, 4, 0.001);
  osc('sine', 620 * p, t, 0.05, 0.12 * k, 400);
}

export const SFX = {
  clack(v) {
    const t = AC.currentTime;
    v = v || 1;
    const p = vary(0.06);
    nz(t, 0.035, 0.6 * v, 'highpass', 2200 * p);
    osc('triangle', 1500 * p, t, 0.05, 0.25 * v, 450 * p);
  },
  // a modern composite stick: a sharp crack with a short ring, a thump, and the puck hissing away
  shot() {
    const t = AC.currentTime,
      p = vary(0.06);
    nz(t, 0.015, 0.9, 'highpass', 1800, null, 1, 0.0005);
    osc('sine', 1150 * p, t, 0.09, 0.18, 1100 * p, 0.001);
    osc('sine', 2950 * p, t, 0.06, 0.08, null, 0.001);
    osc('triangle', 140, t, 0.1, 0.4, 70, 0.002);
    nz(t + 0.01, 0.22, 0.07, 'bandpass', 800, 3000, 2, 0.03);
  },
  pass() {
    tock(1);
  },
  go() {
    const t = AC.currentTime;
    osc('square', 880, t, 0.35, 0.09);
    osc('square', 1320, t + 0.05, 0.3, 0.05);
  },
  tick() {
    osc('sine', 1250, AC.currentTime, 0.035, 0.06);
  },
  stride(v, pan) {
    playBuf(pick(strideBufs), 0.42 * v, rnd(0.94, 1.06), pan);
  },
  spray() {
    playBuf(pick(stopBufs), 0.55, rnd(0.95, 1.05));
  },
  board(v) {
    const t = AC.currentTime;
    v = clamp(v || 1, 0.25, 1);
    const p = vary(0.1);
    osc('sine', 105 * p, t, 0.22, 0.5 * v, 48);
    nz(t, 0.16, 0.35 * v, 'lowpass', 900, 300);
    nz(t + 0.01, 0.22, 0.08 * v, 'bandpass', 1800, 1200, 3);
  },
  post() {
    const t = AC.currentTime,
      p = vary(0.03);
    osc('sine', 1860 * p, t, 0.7, 0.14);
    osc('sine', 2790 * p, t, 0.5, 0.08);
    osc('sine', 4100 * p, t, 0.25, 0.04);
    SFX.clack(0.4);
    SFX.ooh();
  },
  // each kind of save sounds different, so you can hear what happened
  save(a) {
    const t = AC.currentTime,
      kind = (a && a.kind) || 'glove';
    if (kind === 'glove') {
      // leather thwap, then the snap of the glove closing
      nz(t, 0.07, 0.55, 'bandpass', 1300, 600, 1.4, 0.002);
      osc('sine', 150, t, 0.12, 0.35, 80);
      nz(t + 0.06, 0.03, 0.25, 'highpass', 2600, null, 1, 0.001);
    } else if (kind === 'deflect') {
      // hard plastic clack off the blocker and a ringing ricochet
      osc('square', 950, t, 0.05, 0.12, 600, 0.001);
      nz(t, 0.04, 0.5, 'highpass', 2400, null, 1, 0.001);
      osc('sine', 2300, t + 0.01, 0.16, 0.08, 1700);
    } else {
      // pad save: a dull padded thud and the rebound skittering away on the ice
      nz(t, 0.2, 0.6, 'lowpass', 420, 160);
      osc('sine', 110, t, 0.2, 0.4, 60);
      clatter(t + 0.08, 3, 0.18);
      playBuf(pick(strideBufs), 0.25, 1.3);
    }
  },
  steal() {
    tock(0.9);
    setTimeout(() => {
      if (AC && !settings.muted) tock(0.6);
    }, 55);
  },
  whiff() {
    nz(AC.currentTime, 0.16, 0.14, 'bandpass', 1400, 500, 2, 0.02);
  },
  dash() {
    playBuf(pick(strideBufs), 0.5, 1.1);
    setTimeout(() => {
      if (AC && !settings.muted) playBuf(pick(strideBufs), 0.45, 1.15);
    }, 110);
  },
  check(a) {
    const t = AC.currentTime,
      v = a && a.victim,
      by = a && a.by;
    heavyImpact(t, 1);
    grunt(v ? v.look.voice : 120, 0.01);
    if (by) grunt(by.look.voice * 1.1, 0, true);
    if (a && a.boards) {
      nz(t + 0.01, 0.4, 0.22, 'bandpass', 1500, 900, 3);
      nz(t + 0.02, 0.3, 0.1, 'highpass', 4000, 2500, 1);
    }
    crowdVoices(9, 'o', 1.1, 0.07);
    swell(mixer.crowdBase + 0.1, 0.1, 0.3, 0.9);
  },
  // body contact family: every outcome gets its own clearly different sound
  charge(a) {
    const t = AC.currentTime;
    playBuf(pick(strideBufs), 0.7, 1.05);
    setTimeout(() => {
      if (AC && !settings.muted) playBuf(pick(strideBufs), 0.65, 1.12);
    }, 95);
    nz(t, 0.32, 0.22, 'bandpass', 500, 2200, 1.6, 0.05);
    if (a && a.by) grunt(a.by.look.voice * 1.12, 0, true);
  },
  hitBig(a) {
    const t = AC.currentTime,
      v = a && a.victim,
      by = a && a.by;
    heavyImpact(t, 1);
    nz(t, 0.1, 0.5, 'bandpass', 900, 380, 1.2, 0.002);
    nz(t, 0.05, 0.5, 'highpass', 3200, null, 1, 0.001);
    clatter(t, 6, 0.4);
    if (v) grunt(v.look.voice, 0.02);
    if (by) grunt(by.look.voice * 1.1, 0, true);
    if (a && a.boards) {
      nz(t + 0.01, 0.6, 0.32, 'bandpass', 2700, 1700, 6, 0.002);
      osc('square', 190, t, 0.25, 0.05, 120);
      nz(t + 0.02, 0.4, 0.18, 'lowpass', 400, 120);
    }
    // knockdown signature: a second impact as the body lands on the ice
    osc('sine', 48, t + 0.2, 0.3, 0.7, 28, 0.003);
    nz(t + 0.2, 0.18, 0.45, 'lowpass', 320, 140, 1, 0.003);
    stickClatter(t + 0.26);
    crowdVoices(12, 'o', 1.3, 0.09);
    swell(mixer.crowdBase + 0.14, 0.08, 0.35, 1);
  },
  hitMed(a) {
    const t = AC.currentTime,
      v = a && a.victim;
    heavyImpact(t, 0.7);
    nz(t, 0.08, 0.4, 'bandpass', 850, 420, 1.3, 0.002);
    clatter(t, 3, 0.28);
    if (v) grunt(v.look.voice * 1.05, 0.01, true);
    playBuf(pick(stopBufs), 0.4, 1.1);
    // stumble signature: a skid and a couple of stagger steps to stay up
    setTimeout(() => {
      if (AC && !settings.muted) playBuf(pick(strideBufs), 0.35, 1.35);
    }, 140);
    setTimeout(() => {
      if (AC && !settings.muted) playBuf(pick(strideBufs), 0.3, 1.25);
    }, 260);
    crowdVoices(7, 'o', 0.8, 0.05);
  },
  hitSoft(a) {
    const t = AC.currentTime,
      by = a && a.by;
    const p = vary(0.08);
    osc('sine', 88 * p, t, 0.18, 0.4, 58, 0.002);
    nz(t, 0.1, 0.35, 'lowpass', 520, 200, 1, 0.002);
    // bounce-off signature: a springy rising boing
    osc('triangle', 210, t + 0.02, 0.18, 0.16, 430);
    clatter(t, 2, 0.22);
    if (by) grunt(by.look.voice * 1.15, 0.03, true);
    playBuf(pick(strideBufs), 0.4, 0.85);
    crowdVoices(5, 'a', 0.5, 0.03);
  },
  fart() {
    const t = AC.currentTime,
      dur = rnd(0.6, 1.15),
      f0 = rnd(68, 105);
    const o = AC.createOscillator(),
      lfo = AC.createOscillator(),
      lg = AC.createGain(),
      f = AC.createBiquadFilter(),
      am = AC.createOscillator(),
      ag = AC.createGain(),
      amg = AC.createGain(),
      g = AC.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
    lfo.type = 'square';
    lfo.frequency.value = rnd(18, 30);
    lg.gain.value = f0 * 0.35;
    lfo.connect(lg);
    lg.connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(330, t + dur);
    f.Q.value = 4;
    am.frequency.value = rnd(9, 15);
    ag.gain.value = 0.4;
    amg.gain.value = 0.6;
    am.connect(ag);
    ag.connect(amg.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.03);
    g.gain.setValueAtTime(0.45, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(amg);
    amg.connect(g);
    g.connect(master);
    for (const x of [o, lfo, am]) {
      x.start(t);
      x.stop(t + dur + 0.05);
    }
    nz(t, dur * 0.8, 0.12, 'bandpass', 300, 150, 2, 0.02);
    setTimeout(() => {
      if (AC && !settings.muted) crowdVoices(9, 'a', 0.9, 0.06);
    }, dur * 1000);
  },
  punch(a) {
    const t = AC.currentTime;
    osc('sine', 85, t, 0.15, 0.95, 48, 0.002);
    nz(t, 0.07, 0.85, 'bandpass', 1150, 600, 1.4, 0.001);
    nz(t, 0.03, 0.35, 'highpass', 3200, null, 1, 0.001);
    if (a && a.victim) grunt(a.victim.look.voice, 0.02, !a.big);
    swell(mixer.crowdBase + 0.12, 0.06, 0.2, 0.6);
  },
  block() {
    const t = AC.currentTime;
    osc('sine', 150, t, 0.09, 0.45, 90, 0.002);
    nz(t, 0.06, 0.4, 'lowpass', 900, 300, 1, 0.001);
  },
  grumble(a) {
    const v = a && a.look ? a.look.voice * 0.85 : 100;
    grunt(v, 0, true);
    grunt(v * 0.95, 0.17, true);
  },
  bell() {
    const t = AC.currentTime;
    for (const d of [0, 0.22, 0.44]) {
      osc('triangle', 880, t + d, 0.5, 0.12);
      osc('sine', 1320, t + d, 0.4, 0.05);
    }
    crowdVoices(14, 'a', 1.8, 0.1);
    swell(0.24, 0.2, 1.2, 1.5);
  },
  miss() {
    const t = AC.currentTime;
    nz(t, 0.3, 0.3, 'bandpass', 2400, 500, 1.6, 0.01);
    playBuf(pick(stopBufs), 0.5, 1);
  },
  bump(a) {
    const t = AC.currentTime;
    osc('sine', 95, t, 0.2, 0.45, 55);
    nz(t, 0.15, 0.3, 'lowpass', 650, 200);
    SFX.clack(0.2);
    if (a && a.victim) grunt(a.victim.look.voice, 0, true);
    if (!(a && a.soft)) crowdVoices(6, 'o', 0.7, 0.045);
  },
  whistle() {
    const t = AC.currentTime,
      o = AC.createOscillator(),
      l = AC.createOscillator(),
      lg = AC.createGain(),
      g = AC.createGain();
    o.type = 'sine';
    o.frequency.value = 2650;
    l.frequency.value = 32;
    lg.gain.value = 140;
    l.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.02);
    g.gain.setValueAtTime(0.1, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g);
    g.connect(master);
    o.start(t);
    l.start(t);
    o.stop(t + 0.45);
    l.stop(t + 0.45);
  },
  horn() {
    const t = AC.currentTime,
      lp = AC.createBiquadFilter(),
      g = AC.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.15, t + 0.06);
    g.gain.setValueAtTime(0.15, t + 1.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    lp.connect(g);
    g.connect(master);
    for (const f of [138.6, 174.6, 207.7, 277.2]) {
      const o = AC.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = rnd(-8, 8);
      o.connect(lp);
      o.start(t);
      o.stop(t + 2.45);
    }
    SFX.cheer();
  },
  cheer() {
    crowdVoices(14, 'a', 2.6, 0.11);
    crowdVoices(8, 'e', 2.2, 0.06);
    swell(0.22, 0.25, 1.6, 2);
  },
  groan() {
    crowdVoices(12, 'u', 1.5, 0.09, 0.72);
    swell(mixer.crowdBase + 0.06, 0.2, 0.4, 1);
  },
  ooh() {
    crowdVoices(10, 'o', 1.2, 0.08);
    swell(mixer.crowdBase + 0.08, 0.25, 0.3, 1);
  },
  buzzer() {
    const t = AC.currentTime;
    osc('square', 196, t, 1.1, 0.06, null, 0.01);
    osc('square', 199, t, 1.1, 0.05, null, 0.01);
  },
  drop() {
    SFX.clack(0.35);
    osc('sine', 900, AC.currentTime, 0.05, 0.05);
  },
  win() {
    const t = AC.currentTime;
    osc('square', 660, t, 0.07, 0.045);
    osc('square', 990, t + 0.07, 0.12, 0.045);
  },
  lose() {
    const t = AC.currentTime;
    osc('square', 330, t, 0.08, 0.045);
    osc('square', 220, t + 0.08, 0.16, 0.045);
  },
  organ() {
    const t = AC.currentTime + 0.05,
      N = [
        [392, 0, 0.14],
        [523, 0.16, 0.14],
        [659, 0.32, 0.14],
        [784, 0.48, 0.3],
        [659, 0.84, 0.14],
        [784, 1.0, 0.55],
      ];
    for (const [f, s, d] of N)
      for (const [m, v] of [
        [1, 0.07],
        [2, 0.035],
        [4, 0.014],
      ])
        osc('sine', f * m, t + s, d + 0.08, v, null, 0.01);
  },
};
export function S(n, a) {
  if (G.demo || settings.muted || !AC) return;
  try {
    SFX[n](a);
  } catch (e) {}
}
export function audioTick() {
  glideTick();
  if (!AC || !crowdG || settings.muted || mixer.crowdBase <= 0) return;
  const t = AC.currentTime;
  if (t > mixer.swellEnd && clock.now > mixer.wobT) {
    // the chatter already varies by itself; just let the overall level breathe slowly
    mixer.wobT = clock.now + rnd(1.5, 3);
    crowdG.gain.setTargetAtTime(mixer.crowdBase * rnd(0.88, 1.12), t, 0.9);
  }
}
export function strideSounds(dt) {
  G.stepCd -= dt;
  for (const p of SKATERS) {
    if (p.benched) continue;
    const sp = Math.hypot(p.vx, p.vy);
    p.stride += sp * dt * 0.045;
    const k = Math.floor(p.stride);
    if (k === p.lastStride) continue;
    p.lastStride = k;
    if (G.demo || !AC || settings.muted || sp < 22 || p.down > 0) continue;
    const me = p === G.controlled && !G.ai0;
    if (!me) {
      const vw = view.CW / K,
        vh = view.CH / K;
      if (G.stepCd > 0 || p.x < cam.x || p.x > cam.x + vw || p.y < cam.y || p.y > cam.y + vh) continue;
      G.stepCd = 0.09;
    }
    // alternate left/right foot; other skaters are also placed by where they are on screen
    p.foot = !p.foot;
    const pan =
      (p.foot ? -0.18 : 0.18) + (me ? 0 : clamp(((p.x - cam.x) / (view.CW / K) - 0.5) * 1.2, -0.6, 0.6));
    try {
      SFX.stride(clamp(sp / BASE, 0.35, 1.3) * (me ? 1 : 0.35), pan);
    } catch (e) {}
  }
}

// Continuous blade-on-ice glide under the strides, louder the faster the skaters on screen are moving.
let glideLevel = 0;
function glideTick() {
  if (!glideG) return;
  let target = 0;
  const st = G.state;
  if (
    !settings.muted &&
    !G.demo &&
    (st === 'play' || st === 'faceoff' || st === 'celebrate' || st === 'goal')
  ) {
    const vw = view.CW / K,
      vh = view.CH / K;
    for (const p of SKATERS) {
      if (p.benched || p.down > 0) continue;
      const me = p === G.controlled && !G.ai0;
      if (!me && (p.x < cam.x || p.x > cam.x + vw || p.y < cam.y || p.y > cam.y + vh)) continue;
      target += clamp((Math.hypot(p.vx, p.vy) - 10) / BASE, 0, 1.3) * (me ? 1 : 0.3);
    }
    target = Math.min(target, 1.4) * 0.08;
  }
  if (Math.abs(target - glideLevel) > 0.002) {
    glideLevel = target;
    glideG.gain.setTargetAtTime(target, AC.currentTime, 0.12);
  }
}
