import { AC, master, osc } from '../../audio/engine';
import { S } from '../../audio/sfx';
import { H, IH, IW, NETS, RX0, RX1, RY0, RY1, W } from '../../config';
import { clamp, rnd, toS } from '../../core/math';
import { FG, FH, FW, fctx, frost, rinkPathOn, wctx } from '../iceWear';
import { netPushBody, rinkPush } from '../physics/rink';
import { practiceOver } from '../practice';
import { faceoff } from './faceoff';
import { G, parts } from '../world';
import { vib } from '../../input/haptics';
import { input, readStick } from '../../input/state';
import { updCam } from '../../render/camera';
import { view } from '../../render/canvas';
import { bubbles, pops, rings } from '../../render/effects';
import { insideRinkW } from '../../render/mode7';
import { settings } from '../../settings';
import { banner, hideBanner } from '../../ui/hud';

const ZCELL = 4,
  ZW = W / ZCELL,
  ZH = H / ZCELL;
const COUNTDOWN = 3; // seconds of 3, 2, 1 before driving starts
export function startZamboni() {
  pops.length = 0;
  rings.length = 0;
  bubbles.length = 0;
  parts.length = 0;
  G.state = 'zamboni';
  // start at the side boards at centre ice, facing up the rink, so there is room to drive off
  G.zam = {
    x: 20,
    y: 150,
    a: 0,
    v: 0,
    t: 25,
    phase: 'count',
    cd: COUNTDOWN, // countdown before driving
    done: new Uint8Array(ZW * ZH),
    total: 0,
    count: 0,
    horn: 0,
    eng: null,
  };
  for (let j = 0; j < ZH; j++)
    for (let i = 0; i < ZW; i++) {
      const x = (i + 0.5) * ZCELL,
        y = (j + 0.5) * ZCELL;
      let ok = insideRinkW(x, y) && x > RX0 + 3 && x < RX1 - 3 && y > RY0 + 3 && y < RY1 - 3;
      for (const n of NETS) if (x > n.x0 - 2 && x < n.x1 + 2 && y > n.y0 - 2 && y < n.y1 + 2) ok = false;
      if (ok) G.zam.total++;
      else G.zam.done[j * ZW + i] = 2;
    }
  // the ice is chewed up after a period of hockey
  for (let i = 0; i < frost.length; i++) frost[i] = Math.max(frost[i], 0.7);
  fctx.save();
  rinkPathOn(fctx);
  fctx.clip();
  fctx.globalAlpha = 0.5;
  fctx.fillStyle = '#b9c6d4';
  fctx.fillRect(0, 0, IW, IH);
  // skate gouges: short diagonal scratches, light and dark
  for (let k = 0; k < 1800; k++) {
    const x = rnd(0, IW),
      y = rnd(0, IH),
      a = rnd(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI / 2),
      l = rnd(4, 14);
    fctx.globalAlpha = rnd(0.25, 0.6);
    fctx.strokeStyle = Math.random() < 0.55 ? '#ffffff' : '#8fa1b5';
    fctx.lineWidth = 1;
    fctx.beginPath();
    fctx.moveTo(x, y);
    fctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    fctx.stroke();
  }
  fctx.restore();
  fctx.globalAlpha = 1;
  hideBanner();
  banner('ICE RESURFACING', 'alert', 'Steer with the stick. Polish as much ice as you can.');
  S('tick'); // the first beat of the 3, 2, 1
  G.bannerT = 2.2;
  G.controlled = null;
  view.camZ = 1;
  updCam(0, true);
  if (AC && !settings.muted && !G.demo) {
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
      G.zam.eng = { o1, o2, g, lp };
    } catch (e) {}
  }
}
export function stopEngine() {
  const z = G.zam;
  if (!z || !z.eng || !AC) return;
  const t = AC.currentTime;
  try {
    z.eng.g.gain.cancelScheduledValues(t);
    z.eng.g.gain.setValueAtTime(z.eng.g.gain.value, t);
    z.eng.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    z.eng.o1.stop(t + 0.6);
    z.eng.o2.stop(t + 0.6);
  } catch (e) {}
  z.eng = null;
}
export function zamStep(dt) {
  const z = G.zam;
  if (z.phase === 'count') {
    // 3, 2, 1, GO! before the clock starts, so the player is ready to steer
    const before = Math.ceil(z.cd);
    z.cd -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (Math.ceil(z.cd) !== before) S(z.cd <= 0 ? 'go' : 'tick');
    if (z.cd <= 0) z.phase = 'drive';
    return;
  }
  if (z.phase === 'done') {
    z.end -= dt;
    input.sp = input.pp = input.swp = input.sr = false;
    if (z.end <= 0) {
      const pct = z.pct;
      G.zam = null;
      if (G.practice) {
        let b = 0;
        try {
          b = +localStorage.getItem('blb-zam') || 0;
        } catch (e) {}
        practiceOver(z.rating, pct + '% polished · best ' + Math.max(b, pct) + '%');
      } else faceoff();
    }
    return;
  }
  readStick();
  let jx = input.jx,
    jy = input.jy,
    m = Math.hypot(jx, jy);
  if (input.aim) {
    const k = input.keys,
      fwd = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    jx = input.aim.x;
    jy = input.aim.y;
    m = fwd;
  }
  if (m > 0.2 || input.aim) {
    const at = Math.atan2(jx, -jy);
    let da = ((at - z.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    z.a += clamp(da, -2.6 * dt, 2.6 * dt);
  }
  z.v += clamp(m * 38 - z.v, -45 * dt, 30 * dt);
  const hx = Math.sin(z.a),
    hy = -Math.cos(z.a);
  const o = { x: z.x + hx * z.v * dt, y: z.y + hy * z.v * dt, vx: hx * z.v, vy: hy * z.v };
  if (rinkPush(o, 8, 0) > 0) z.v *= 0.6;
  netPushBody(o, 8);
  z.x = o.x;
  z.y = o.y;
  // conditioner at the back: lay down fresh ice across a 10-unit strip
  const bx = z.x - hx * 4.5,
    by = z.y - hy * 4.5,
    px = -hy,
    py = hx;
  if (z.v > 3) {
    fctx.save();
    fctx.globalCompositeOperation = 'destination-out';
    wctx.globalAlpha = 0.3;
    wctx.fillStyle = '#8fd3ff';
    for (let k = -6.5; k <= 6.5; k += 1.3) {
      const sx = bx + px * k,
        sy = by + py * k;
      fctx.beginPath();
      fctx.arc(toS(sx), toS(sy), 3.6, 0, Math.PI * 2);
      fctx.fill();
      wctx.fillRect(toS(sx) - 2, toS(sy) - 2, 4, 4);
      const fi = clamp(Math.floor(sx / FG), 0, FW - 1) + clamp(Math.floor(sy / FG), 0, FH - 1) * FW;
      frost[fi] = 0;
      const ci = Math.floor(sx / ZCELL),
        cj = Math.floor(sy / ZCELL);
      if (ci >= 0 && cj >= 0 && ci < ZW && cj < ZH && z.done[cj * ZW + ci] === 0) {
        z.done[cj * ZW + ci] = 1;
        z.count++;
      }
    }
    fctx.restore();
    wctx.globalAlpha = 1;
    if (Math.random() < 0.4)
      parts.push({
        x: bx + px * rnd(-5, 5),
        y: by + py * rnd(-5, 5),
        vx: rnd(-6, 6),
        vy: rnd(-6, 6),
        life: rnd(0.2, 0.5),
        c: '#e6f6ff',
      });
  }
  if (z.eng) {
    const t = AC.currentTime;
    z.eng.o1.frequency.setTargetAtTime(52 + z.v * 1.1, t, 0.1);
    z.eng.o2.frequency.setTargetAtTime(104 + z.v * 2.2, t, 0.1);
    z.eng.lp.frequency.setTargetAtTime(420 + z.v * 14, t, 0.1);
  }
  if (input.sp && z.horn <= 0) {
    z.horn = 0.5;
    if (AC && !settings.muted) {
      const t = AC.currentTime;
      osc('square', 330, t, 0.38, 0.08);
      osc('square', 415, t, 0.38, 0.07);
    }
  }
  z.horn -= dt;
  z.t -= dt;
  const finish = input.pp;
  input.sp = input.pp = input.swp = input.sr = false;
  if (z.t <= 0 || finish || z.count >= z.total) finishZamboni();
}
function finishZamboni() {
  const z = G.zam;
  z.phase = 'done';
  z.end = 2.8;
  stopEngine();
  const pct = Math.round((z.count / Math.max(1, z.total)) * 100);
  const r = pct >= 92 ? 'SPOTLESS!' : pct >= 80 ? 'GLASS SMOOTH' : pct >= 55 ? 'NOT BAD' : 'BUMPY ICE';
  z.pct = pct;
  z.rating = r;
  banner(
    r,
    pct >= 80 ? 'home' : 'small',
    pct + '% of the ice polished' + (pct >= 80 && !G.practice ? ' · your team skates faster for 20s' : ''),
  );
  G.bannerT = 2.6;
  if (pct >= 80) {
    if (!G.practice) G.mom = { team: 0, t: 20 };
    S('cheer');
    vib([40, 30, 80]);
  } else S('ooh');
  try {
    const b = +localStorage.getItem('blb-zam') || 0;
    if (pct > b) localStorage.setItem('blb-zam', String(pct));
  } catch (e) {}
}
