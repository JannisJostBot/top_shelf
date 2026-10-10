// Procedural ice-skate sounds, rendered once into AudioBuffers when audio starts.
//
// A real blade on ice is not a tone and not plain hiss. It is a dense stream of tiny cracks as the edge shaves
// ice crystals (bright, crunchy, irregular), on top of a smoother friction hiss, with a soft knock when the blade
// lands. Every sound here mixes those three layers:
//   grains - sparse random impulses through two resonant band-passes (the "crunch")
//   hiss   - band-limited noise whose brightness follows blade pressure
//   knock  - a short low-passed burst at touchdown
import { rnd } from '../core/math';

/** RBJ band-pass biquad, run sample by sample. */
function bandpass(sr, f, q) {
  const w = (2 * Math.PI * f) / sr,
    alpha = Math.sin(w) / (2 * q),
    a0 = 1 + alpha,
    b0 = alpha / a0,
    b2 = -alpha / a0,
    a1 = (-2 * Math.cos(w)) / a0,
    a2 = (1 - alpha) / a0;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  return x => {
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}
// The band-passes pass little energy from single-sample impulses; this brings the crunch up to the hiss level.
const CRUNCH_GAIN = 7;
const onePoleCoef = (sr, f) => 1 - Math.exp((-2 * Math.PI * f) / sr);

/**
 * @param {object} o
 * @param {number} o.dur      length in seconds
 * @param {(t:number)=>number} o.env  blade pressure 0..1 over time
 * @param {number} o.grains   crack density (impulses per second at full pressure)
 * @param {number[]} o.bands  two centre frequencies for the crunch resonances
 * @param {number} o.hiss     level of the friction hiss
 * @param {number[]} o.bright low-pass cutoff of the hiss at zero and full pressure
 * @param {number} o.knock    level of the touchdown knock
 * @param {boolean} [o.raw]  skip peak normalization (for measuring layer levels while tuning)
 */
export function renderBlade(AC, o) {
  const sr = AC.sampleRate,
    n = Math.floor(o.dur * sr),
    buf = AC.createBuffer(1, n, sr),
    d = buf.getChannelData(0);
  const bp1 = bandpass(sr, o.bands[0] * rnd(0.9, 1.1), 2.2),
    bp2 = bandpass(sr, o.bands[1] * rnd(0.9, 1.1), 3),
    hpA = onePoleCoef(sr, 1400),
    knockA = onePoleCoef(sr, 900);
  let lo = 0,
    lp1 = 0,
    lp2 = 0,
    kn = 0,
    rough = 0.5,
    grain = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr,
      e = o.env(t);
    // crunch: impulses arrive more often and harder as pressure rises
    if (Math.random() < (o.grains * e) / sr)
      grain = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() ** 2);
    const g = grain;
    grain *= 0.35;
    const crunch = (bp1(g) * 0.9 + bp2(g) * 0.6) * CRUNCH_GAIN;
    // hiss: high-passed noise, low-pass opens up with pressure, slow random roughness
    const x = Math.random() * 2 - 1;
    lo += hpA * (x - lo);
    const h = x - lo,
      lpA = onePoleCoef(sr, o.bright[0] + (o.bright[1] - o.bright[0]) * e);
    lp1 += lpA * (h - lp1);
    lp2 += lpA * (lp1 - lp2);
    rough += (Math.random() - rough) * 0.02;
    const hiss = lp2 * o.hiss * (0.55 + rough * 0.9);
    // knock: first ~15 ms only
    let knock = 0;
    if (t < 0.03) {
      kn += knockA * (x - kn);
      knock = kn * o.knock * Math.exp(-t * 160);
    }
    d[i] = (crunch + hiss) * e + knock;
  }
  if (!o.raw) normalize(d, 0.9);
  return buf;
}
function normalize(d, peak) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
}
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** One push of a stride: pressure builds through the push, then the blade lifts off quickly. */
export function strideBuffer(AC) {
  const dur = rnd(0.24, 0.3),
    push = dur * rnd(0.55, 0.7),
    peak = rnd(0.85, 1);
  return renderBlade(AC, {
    dur,
    env: t => (t < push ? 0.25 + 0.75 * smooth(t / push) : Math.exp(-(t - push) * 38)) * peak,
    grains: rnd(900, 1300),
    bands: [rnd(1900, 2500), rnd(3800, 4600)],
    hiss: 1,
    bright: [3000, 7000],
    knock: 5,
  });
}

/** Hockey stop: the blades bite sideways and throw a spray of shavings that tails off. */
export function stopBuffer(AC) {
  const dur = 0.62;
  return renderBlade(AC, {
    dur,
    env: t => (t < 0.025 ? t / 0.025 : t < 0.2 ? 1 - (t - 0.025) * 0.9 : 0.84 * Math.exp(-(t - 0.2) * 9)),
    grains: 3200,
    bands: [rnd(1800, 2200), rnd(4200, 5000)],
    hiss: 1.4,
    bright: [2600, 10000],
    knock: 6,
  });
}

/** Continuous glide hiss, made seamless so it can loop under a skater in motion. */
export function glideBuffer(AC) {
  const sr = AC.sampleRate,
    len = 2,
    fade = 0.15,
    raw = renderBlade(AC, {
      dur: len + fade,
      env: () => 0.5,
      grains: 260,
      bands: [2600, 5200],
      hiss: 1.6,
      bright: [4500, 4500],
      knock: 0,
    }).getChannelData(0),
    n = Math.floor(len * sr),
    f = Math.floor(fade * sr),
    buf = AC.createBuffer(1, n, sr),
    d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = raw[i];
  // equal-power crossfade of the overhang into the start, so the loop point is inaudible
  for (let i = 0; i < f; i++) {
    const k = i / f;
    d[i] = raw[i] * Math.sin((k * Math.PI) / 2) + raw[n + i] * Math.cos((k * Math.PI) / 2);
  }
  return buf;
}
