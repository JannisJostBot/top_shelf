// Procedural arena crowd, rendered into AudioBuffers.
//
// A crowd is many separate people: each has their own pitch, says different vowels at their own rhythm and
// stands somewhere else in the building. So every sound here is built from individual voices:
//   voiced source - a softened sawtooth at the voice's pitch with slow drift, mixed with breath noise
//   vowel         - two formant resonators, retuned per syllable (chatter) or held (shouts)
//   placement     - per-voice level and stereo position, then the arena reverb (makeArenaReverb)
// Voices only need the range below 4 kHz, so they render at 16 kHz to keep start-up fast.
import { pick, rnd } from '../core/math';

const SR = 16000;
// first two formants (Hz) of the vowels a crowd makes
const VOWELS = {
  a: [800, 1200],
  e: [500, 1850],
  i: [330, 2250],
  o: [520, 880],
  u: [360, 800],
  ae: [680, 1650],
};
// shouts mostly use the requested vowel, with some neighbours mixed in
const NEAR = {
  a: ['a', 'a', 'ae', 'o'],
  e: ['e', 'e', 'ae', 'i'],
  o: ['o', 'o', 'u', 'a'],
  u: ['u', 'u', 'o'],
};

/** Two-pole resonator (constant peak gain), retunable while running. */
function resonator() {
  let b0 = 0,
    a1 = 0,
    a2 = 0,
    x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  return {
    tune(f, q) {
      const w = (2 * Math.PI * f) / SR,
        alpha = Math.sin(w) / (2 * q),
        a0 = 1 + alpha;
      b0 = alpha / a0;
      a1 = (-2 * Math.cos(w)) / a0;
      a2 = (1 - alpha) / a0;
    },
    run(x) {
      const y = b0 * (x - x2) - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    },
  };
}

/**
 * Adds one voice into the stereo arrays L/R.
 * @param {object} o
 * @param {number} o.f0          base pitch (Hz)
 * @param {(t:number)=>number} o.pitch  pitch multiplier over the voice's lifetime t (seconds)
 * @param {(t:number)=>number} o.amp    loudness envelope over t
 * @param {(t:number)=>string} o.vowel  vowel at time t (re-read at each syllable start)
 * @param {number} o.start, o.len  where the voice sits in the buffer (seconds)
 * @param {number} o.breath  share of breath noise (shouting is breathier)
 * @param {number} o.pan     -1..1
 */
function addVoice(L, R, o) {
  const s0 = Math.floor(o.start * SR),
    n = Math.min(L.length - s0, Math.floor(o.len * SR)),
    f1 = resonator(),
    f2 = resonator(),
    gl = Math.cos(((o.pan + 1) * Math.PI) / 4),
    gr = Math.sin(((o.pan + 1) * Math.PI) / 4),
    drift = rnd(0, 6.28),
    driftHz = rnd(0.3, 0.9);
  let ph = Math.random(),
    soft = 0,
    vowel = null;
  for (let i = 0; i < n; i++) {
    const t = i / SR,
      a = o.amp(t);
    if (a <= 0) {
      vowel = null;
      continue;
    }
    const v = o.vowel(t);
    if (v !== vowel) {
      vowel = v;
      const [F1, F2] = VOWELS[v];
      f1.tune(F1 * rnd(0.92, 1.08), 5);
      f2.tune(F2 * rnd(0.92, 1.08), 7);
    }
    const f = o.f0 * o.pitch(t) * (1 + 0.025 * Math.sin(drift + t * 2 * Math.PI * driftHz));
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    soft += 0.35 * (2 * ph - 1 - soft); // soften the sawtooth's buzz
    const src = soft * (1 - o.breath) + (Math.random() * 2 - 1) * o.breath,
      y = (f1.run(src) * 1.2 + f2.run(src) * 0.7) * a;
    L[s0 + i] += y * gl;
    R[s0 + i] += y * gr;
  }
}

function normalizeRms(chs, target) {
  let s = 0,
    n = 0;
  for (const d of chs)
    for (let i = 0; i < d.length; i++) {
      s += d[i] * d[i];
      n++;
    }
  const k = target / (Math.sqrt(s / n) || 1);
  for (const d of chs) for (let i = 0; i < d.length; i++) d[i] *= k;
}
function toBuffer(AC, L, R) {
  const b = AC.createBuffer(2, L.length, SR);
  b.getChannelData(0).set(L);
  b.getChannelData(1).set(R);
  return b;
}
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Seamless loop of the crowd chattering between plays: distant voices talking over each other. */
export function crowdBedBuffer(AC) {
  const len = 8,
    fade = 0.5,
    total = Math.ceil((len + fade) * SR),
    L = new Float32Array(total),
    R = new Float32Array(total);
  for (let v = 0; v < 40; v++) {
    // syllables: short bursts with gaps, grouped into phrases with pauses
    const syl = [];
    let t = rnd(0, 1.5);
    while (t < len + fade) {
      const words = Math.floor(rnd(3, 9));
      for (let k = 0; k < words && t < len + fade; k++) {
        const d = rnd(0.09, 0.24);
        syl.push([t, d, pick(Object.keys(VOWELS))]);
        t += d + rnd(0.02, 0.12);
      }
      t += rnd(0.4, 2.2);
    }
    // the voice is rendered with time only moving forward, so a running index finds the current syllable
    let cur = 0;
    const at = t => {
      while (cur < syl.length - 1 && syl[cur + 1][0] <= t) cur++;
      return syl[cur];
    };
    const female = Math.random() < 0.4,
      level = rnd(0.25, 1);
    addVoice(L, R, {
      f0: female ? rnd(180, 250) : rnd(95, 150),
      pitch: t => {
        const s = at(t);
        return 1 + 0.08 * Math.sin(((t - s[0]) / s[1]) * Math.PI); // a little intonation per syllable
      },
      amp: t => {
        const s = at(t),
          x = t - s[0];
        if (x < 0 || x > s[1]) return 0;
        return level * Math.min(1, x / 0.02) * Math.min(1, (s[1] - x) / 0.04);
      },
      vowel: t => at(t)[2],
      start: 0,
      len: len + fade,
      breath: 0.25,
      pan: rnd(-0.9, 0.9),
    });
  }
  // distance: roll off the top end, plus a faint low room rumble
  for (const d of [L, R]) {
    let a = 0,
      b = 0,
      r = 0;
    for (let i = 0; i < d.length; i++) {
      a += 0.45 * (d[i] - a);
      b += 0.45 * (a - b);
      r += 0.02 * (Math.random() * 2 - 1 - r);
      d[i] = b + r * 0.6;
    }
  }
  // fold the overhang into the start so the loop point is inaudible
  const n = len * SR,
    f = fade * SR,
    outL = L.slice(0, n),
    outR = R.slice(0, n);
  for (let i = 0; i < f; i++) {
    const k = i / f,
      a = Math.sin((k * Math.PI) / 2),
      b = Math.cos((k * Math.PI) / 2);
    outL[i] = L[i] * a + L[n + i] * b;
    outR[i] = R[i] * a + R[n + i] * b;
  }
  normalizeRms([outL, outR], 0.3);
  return toBuffer(AC, outL, outR);
}

const shoutCache = new Map();
/**
 * A crowd reaction: many people shouting a vowel together, each starting a little apart.
 * `drop` bends the pitch down over the reaction (a groan); cheers ('a' and 'e') also get whistles and applause.
 */
export function shoutBuffer(AC, vowel, dur, people, drop) {
  const key = [vowel, dur, people, drop || 1].join('|');
  let buf = shoutCache.get(key);
  if (buf) return buf;
  const tail = 0.6,
    total = Math.ceil((dur + tail) * SR),
    L = new Float32Array(total),
    R = new Float32Array(total),
    cheer = vowel === 'a' || vowel === 'e',
    voices = Math.max(8, people * 3);
  for (let v = 0; v < voices; v++) {
    const start = rnd(0, Math.min(0.35, dur * 0.25)),
      len = dur * rnd(0.6, 1) - start,
      atk = rnd(0.05, 0.18),
      female = Math.random() < 0.4,
      f0 = (female ? rnd(230, 380) : rnd(140, 240)) * (cheer ? 1.1 : 1),
      level = rnd(0.35, 1),
      vw = pick(NEAR[vowel] || [vowel]),
      rise = cheer ? rnd(0.05, 0.2) : rnd(0, 0.08);
    addVoice(L, R, {
      f0,
      pitch: t => {
        const x = t / len;
        return (
          (1 + rise * Math.sin(Math.min(1, x * 1.6) * Math.PI)) * (drop ? 1 + (drop - 1) * smooth(x) : 1)
        );
      },
      amp: t => (t > len ? 0 : level * smooth(t / atk) * Math.min(1, ((len - t) / len) * 2.2)),
      vowel: () => vw,
      start,
      len,
      breath: 0.45,
      pan: rnd(-0.95, 0.95),
    });
  }
  if (cheer) {
    // a few two-finger whistles
    for (let w = 0; w < 3; w++) {
      const st = rnd(0.1, dur * 0.5),
        ln = rnd(0.35, 0.7),
        f = rnd(1900, 2800),
        pan = rnd(-0.8, 0.8),
        gl = Math.cos(((pan + 1) * Math.PI) / 4),
        gr = Math.sin(((pan + 1) * Math.PI) / 4);
      let ph = 0;
      for (let i = 0; i < ln * SR; i++) {
        const t = i / SR,
          k = t / ln,
          fr = f * (1 + 0.12 * Math.sin(k * Math.PI)) * (k > 0.7 ? 1 - (k - 0.7) * 0.4 : 1);
        ph += fr / SR;
        const y = Math.sin(2 * Math.PI * ph) * 0.18 * smooth(k / 0.1) * smooth((1 - k) / 0.2),
          j = Math.floor((st + t) * SR);
        if (j < total) {
          L[j] += y * gl;
          R[j] += y * gr;
        }
      }
    }
    // applause builds in the second half: short band-limited claps
    const clap = resonator();
    clap.tune(1400, 1.2);
    for (let c = 0; c < dur * 120; c++) {
      const t = dur * 0.3 + Math.random() * (dur * 0.7 + tail * 0.6),
        j0 = Math.floor(t * SR),
        amp = rnd(0.2, 0.6) * Math.min(1, (t - dur * 0.3) / (dur * 0.3)),
        pan = rnd(-1, 1);
      for (let i = 0; i < SR * 0.012 && j0 + i < total; i++) {
        const y = clap.run((Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.0025))) * amp;
        L[j0 + i] += y * (1 - pan) * 0.5;
        R[j0 + i] += y * (1 + pan) * 0.5;
      }
    }
  }
  normalizeRms([L, R], 0.3);
  buf = toBuffer(AC, L, R);
  shoutCache.set(key, buf);
  return buf;
}

/* ---------- reactions built from groups of voices, claps and whistles ---------- */
const stereo = sec => {
  const n = Math.ceil(sec * SR);
  return [new Float32Array(n), new Float32Array(n)];
};
const voiceF0 = (female, lo, hi) => (female ? rnd(lo[1], hi[1]) : rnd(lo[0], hi[0]));

/** `n` people clapping once around time t (each a little early or late). */
function claps(L, R, t, n, spread, level) {
  const res = resonator();
  for (let c = 0; c < n; c++) {
    const j0 = Math.floor((t + rnd(-spread, spread)) * SR);
    if (j0 < 0) continue;
    const amp = level * rnd(0.4, 1),
      pan = rnd(-1, 1);
    res.tune(1400 * rnd(0.75, 1.3), 1.2);
    for (let i = 0; i < SR * 0.012 && j0 + i < L.length; i++) {
      const y = res.run((Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.0025))) * amp;
      L[j0 + i] += y * (1 - pan) * 0.5;
      R[j0 + i] += y * (1 + pan) * 0.5;
    }
  }
}
/** Free applause between t0 and t1: `rate` claps per second, fading in over `fadeIn` and out at the end. */
function applause(L, R, t0, t1, rate, level, fadeIn) {
  const res = resonator();
  for (let c = 0; c < (t1 - t0) * rate; c++) {
    const t = t0 + Math.random() * (t1 - t0),
      j0 = Math.floor(t * SR),
      amp = rnd(0.2, 0.6) * level * Math.min(1, (t - t0) / fadeIn) * Math.min(1, (t1 - t) / 0.6),
      pan = rnd(-1, 1);
    res.tune(1400 * rnd(0.8, 1.2), 1.2);
    for (let i = 0; i < SR * 0.012 && j0 + i < L.length; i++) {
      const y = res.run((Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.0025))) * amp;
      L[j0 + i] += y * (1 - pan) * 0.5;
      R[j0 + i] += y * (1 + pan) * 0.5;
    }
  }
}
/** Two-finger whistles from fans in the stands; some go up and come back down. */
function whistles(L, R, count, t0, t1, level = 0.18) {
  for (let w = 0; w < count; w++) {
    const st = rnd(t0, t1),
      ln = rnd(0.35, 0.7),
      f = rnd(1900, 2800),
      pan = rnd(-0.8, 0.8),
      gl = Math.cos(((pan + 1) * Math.PI) / 4),
      gr = Math.sin(((pan + 1) * Math.PI) / 4),
      wolf = Math.random() < 0.3;
    let ph = 0;
    for (let i = 0; i < ln * SR; i++) {
      const t = i / SR,
        k = t / ln,
        fr = wolf
          ? f * (0.8 + 0.4 * Math.sin(k * Math.PI))
          : f * (1 + 0.12 * Math.sin(k * Math.PI)) * (k > 0.7 ? 1 - (k - 0.7) * 0.4 : 1);
      ph += fr / SR;
      const y = Math.sin(2 * Math.PI * ph) * level * smooth(k / 0.1) * smooth((1 - k) / 0.2),
        j = Math.floor((st + t) * SR);
      if (j < L.length) {
        L[j] += y * gl;
        R[j] += y * gr;
      }
    }
  }
}
/**
 * Many people shouting together.
 * @param {object} o  voices; t0 and spread (start times); len, atk ([min, max] seconds); female (share);
 *   lo, hi ([male, female] pitch ranges); vowels (picked per voice); vowelAt(x, vowel) (optional, x = 0..1 through
 *   the voice); pitch(x, k) (multiplier, k = a random 0..1 per voice); breath; level; fall (how early it fades)
 */
function group(L, R, o) {
  for (let v = 0; v < o.voices; v++) {
    const start = (o.t0 || 0) + rnd(0, o.spread),
      len = rnd(o.len[0], o.len[1]),
      atk = rnd(o.atk[0], o.atk[1]),
      female = Math.random() < (o.female ?? 0.4),
      f0 = voiceF0(female, o.lo, o.hi),
      level = rnd(0.35, 1) * (o.level || 1),
      vw = pick(o.vowels),
      k = Math.random();
    addVoice(L, R, {
      f0,
      pitch: t => o.pitch(t / len, k),
      amp: t => (t > len ? 0 : level * smooth(t / atk) * Math.min(1, ((len - t) / len) * (o.fall || 2.2))),
      vowel: o.vowelAt ? t => o.vowelAt(t / len, vw) : () => vw,
      start,
      len,
      breath: o.breath ?? 0.45,
      pan: rnd(-0.95, 0.95),
    });
  }
}
/** A chanted line: every voice says the same syllables ([time, length, vowel, pitch]) on the beat, a little apart. */
function chantVoices(L, R, syllables, voices) {
  for (let v = 0; v < voices; v++) {
    const female = Math.random() < 0.35,
      f0 = voiceF0(female, [125, 230], [190, 320]),
      jit = syllables.map(() => rnd(-0.035, 0.035)),
      lv = rnd(0.4, 1);
    const at = t => {
      for (let i = syllables.length - 1; i >= 0; i--) if (t >= syllables[i][0] + jit[i]) return i;
      return -1;
    };
    addVoice(L, R, {
      f0,
      pitch: t => {
        const i = at(t);
        return i < 0 ? 1 : syllables[i][3];
      },
      amp: t => {
        const i = at(t);
        if (i < 0) return 0;
        const x = t - syllables[i][0] - jit[i],
          d = syllables[i][1];
        return x > d ? 0 : lv * Math.min(1, x / 0.025) * Math.min(1, (d - x) / 0.07);
      },
      vowel: t => syllables[Math.max(0, at(t))][2],
      start: 0,
      len: L.length / SR,
      breath: 0.4,
      pan: rnd(-0.95, 0.95),
    });
  }
}
/** Renders once per key and keeps it (every reaction below is fixed, so one take each is enough). */
const made = new Map();
function once(key, render) {
  let b = made.get(key);
  if (!b) made.set(key, (b = render()));
  return b;
}
function finish(AC, L, R) {
  normalizeRms([L, R], 0.3);
  return toBuffer(AC, L, R);
}

/** Goal: the whole arena jumps up at once. An instant roar, high yelling, whistles, thunderous applause. */
export const eruptionBuffer = AC =>
  once('eruption', () => {
    const [L, R] = stereo(4.6);
    group(L, R, {
      voices: 70,
      spread: 0.08,
      len: [2.6, 3.8],
      atk: [0.03, 0.08],
      lo: [180, 300],
      hi: [300, 480],
      vowels: ['a', 'a', 'ae', 'o', 'e'],
      pitch: (x, k) => 1 + (0.1 + k * 0.2) * Math.sin(Math.min(1, x * 1.4) * Math.PI),
      breath: 0.5,
    });
    whistles(L, R, 7, 0.1, 2.4);
    applause(L, R, 0.25, 4.4, 260, 1, 0.25);
    return finish(AC, L, R);
  });

/** Goal against: a deflated "awww" that sags all the way down, then a few scattered claps. */
export const awwBuffer = AC =>
  once('aww', () => {
    const [L, R] = stereo(2.6);
    group(L, R, {
      voices: 40,
      spread: 0.12,
      len: [1.4, 2],
      atk: [0.04, 0.12],
      lo: [150, 240],
      hi: [260, 380],
      vowels: ['a', 'o', 'a'],
      vowelAt: (x, v) => (x < 0.5 ? v : 'o'),
      pitch: x => 1.15 - 0.55 * smooth(x),
      breath: 0.5,
      fall: 1.6,
    });
    applause(L, R, 1.6, 2.6, 18, 0.8, 0.2);
    return finish(AC, L, R);
  });

/**
 * Near miss: an "oooh", then the crowd applauds the effort. `short` is the version after big hits: a quicker
 * "ooh" and only a little applause.
 */
export const oohApplauseBuffer = (AC, short) =>
  once(short ? 'oohShort' : 'ooh', () => {
    const k = short ? 0.75 : 1,
      [L, R] = stereo(2.6 * k);
    group(L, R, {
      voices: short ? 24 : 30,
      spread: 0.12,
      len: [0.9 * k, 1.2 * k],
      atk: [0.08, 0.18],
      lo: [140, 230],
      hi: [250, 380],
      vowels: ['o', 'o', 'u'],
      pitch: x => 1 + 0.12 * Math.sin(x * Math.PI),
      breath: 0.45,
    });
    applause(L, R, 0.7 * k, 2.5 * k, short ? 60 : 110, short ? 0.7 : 0.9, 0.4);
    return finish(AC, L, R);
  });

/** The crowd clapping the organ's "da-da da-da-da" back, twice; `beat` matches the organ riff. */
export const riffClapsBuffer = (AC, beat) =>
  once('riffClaps', () => {
    const [L, R] = stereo(8 * beat + 1);
    for (const bar of [4, 8]) for (const b of [0, 1, 2, 2.5, 3]) claps(L, R, (bar - 0.5 + b) * beat, 45, 0.025, 0.55);
    return finish(AC, L, R);
  });

/** "Let's go Blue!" (clap clap clap-clap-clap), twice. */
export const chantBuffer = AC =>
  once('chant', () => {
    const beat = 0.45,
      bar = 8 * beat,
      [L, R] = stereo(2 * bar + 1);
    const syl = [];
    for (const b0 of [0, bar]) {
      syl.push([b0, 0.22, 'e', 1], [b0 + beat, 0.28, 'o', 1.12], [b0 + 2 * beat, 0.45, 'u', 1]);
      for (const b of [4, 5, 6, 6.5, 7]) claps(L, R, b0 + b * beat, 40, 0.025, 0.5);
    }
    chantVoices(L, R, syl, 40);
    return finish(AC, L, R);
  });

/** Impulse response of a large arena: a short pre-delay, then a dense, darkening ~2.4 s decay. */
export function arenaImpulse(AC) {
  const sr = AC.sampleRate,
    len = Math.floor(sr * 2.4),
    pre = Math.floor(sr * 0.025),
    b = AC.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr,
        k = 0.6 * Math.exp(-t * 2.2) + 0.05; // high frequencies die away faster than the body of the tail
      lp += k * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp((-t * 6.9) / 2.4);
    }
  }
  return b;
}
