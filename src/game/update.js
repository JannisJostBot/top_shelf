import { S, strideSounds } from '../audio/sfx';
import { NETS, W } from '../config';
import { pick, rnd } from '../core/math';
import { clock } from '../core/time';
import { goalieAI } from './ai/goalie';
import { refAI } from './ai/referee';
import { teamAI } from './ai/team';
import { checkStep } from './hits';
import { autoSwitch, humanUpdate, steals } from './human';
import { scuff } from './iceWear';
import { endPeriod } from './match';
import { coast, integrate, updatePuck } from './physics/step';
import { GK, SKATERS, players } from './players';
import { practiceReset } from './practice';
import { applyFrame, endReplay, recFrame, startReplay } from './replay';
import { brawlStep, startBrawl } from './states/brawl';
import { celebrateStep, endCelebration, startCelebration } from './states/celebrate';
import { faceoff, foUpdate } from './states/faceoff';
import { startZamboni, zamStep } from './states/zamboni';
import { G, parts, puck } from './world';
import { input } from '../input/state';
import { updCam } from '../render/camera';
import { view } from '../render/canvas';
import { pop } from '../render/effects';
import { upd3D } from '../render/mode7';
import { clothStep, netHit } from '../render/net';
import { settings } from '../settings';
import { banner, hideBanner, hud, hudClock } from '../ui/hud';

/* ---------- update ---------- */
export function update(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.93;
    p.vy *= 0.93;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - dt);
  G.flash = Math.max(0, G.flash - dt);
  G.boardCd -= dt;
  G.hype = Math.max(0, G.hype - dt * 0.3);
  if (G.state !== 'paused' && G.state !== 'over') clothStep();
  if (G.bannerT > 0) {
    G.bannerT -= dt;
    if (G.bannerT <= 0) hideBanner();
  }
  const st = G.state;
  if (st === 'replay') {
    if (input.sp || input.pp || input.swp) {
      input.sp = input.pp = input.swp = input.sr = false;
      endReplay();
      return;
    }
    G.rp.i += G.rp.angle.spd;
    if (G.rp.i >= G.rp.end) {
      endReplay();
      return;
    }
    if (G.rp.fart !== null && (G.rp.i - G.rp.i0) / Math.max(1, G.rp.end - G.rp.i0) >= G.rp.fart) {
      G.rp.fart = null;
      S('fart');
      const v = pick(SKATERS);
      pop(v.x, v.y, 'PFFRRT', '#a07a3a');
    }
    if (!G.rp.netHit && G.lastNet && G.rp.i >= G.goalFrame) {
      G.rp.netHit = true;
      const fl = G.rp.angle.flip,
        tn = fl ? NETS[G.lastNet === NETS[0] ? 1 : 0] : G.lastNet;
      netHit(tn, fl ? W - G.goalX : G.goalX, 1.5);
      view.lamp = { n: tn, until: clock.now + 2.6 };
    }
    applyFrame(G.rp.i);
    updCam(dt, false);
    upd3D(false);
    for (const p of SKATERS) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 46 && p.down <= 0 && Math.random() < 0.3)
        parts.push({
          x: p.x + rnd(-2, 2),
          y: p.y + rnd(0, 1),
          vx: -p.vx * 0.25 + rnd(-12, 12),
          vy: -p.vy * 0.25 + rnd(-12, 12),
          life: rnd(0.25, 0.5),
          c: '#ffffff',
        });
    }
    return;
  }
  if (st === 'brawl') {
    updCam(dt, false);
    brawlStep(dt);
    return;
  }
  if (st === 'zamboni') {
    zamStep(dt);
    updCam(dt, false);
    return;
  }
  if (st === 'celebrate') {
    if (input.sp || input.pp || input.swp) {
      input.sp = input.pp = input.swp = input.sr = false;
      endCelebration();
      return;
    }
    updCam(dt, false);
    celebrateStep(dt);
    G.timer -= dt;
    if (G.timer <= 0) endCelebration();
    return;
  }
  if (st !== 'play' && st !== 'faceoff') {
    input.sp = input.pp = input.swp = false;
    if (!input.shootHeld) input.sr = false;
  }
  if (st === 'paused' || st === 'over') return;
  updCam(dt, false);
  if (st === 'faceoff') {
    foUpdate(dt);
    return;
  }
  if (st === 'goal' || st === 'inter') {
    G.timer -= dt;
    coast(dt);
    if (st === 'goal' && G.goalRec > 0) {
      G.goalRec -= dt;
      recFrame();
    }
    if (st !== 'inter') refAI(dt);
    if (G.timer <= 0 && st === 'goal' && G.practice) {
      practiceReset(false);
      return;
    }
    if (G.timer <= 0) {
      if (st === 'goal' && !G.demo) {
        if (G.brawlNext) {
          G.brawlNext = false;
          startBrawl();
        } else if (settings.celOn) startCelebration();
        else {
          hideBanner();
          startReplay();
        }
      } else {
        hideBanner();
        if (st === 'inter' && G.zamNext) {
          G.zamNext = false;
          startZamboni();
        } else faceoff();
      }
    }
    return;
  }
  if (!G.demo && !G.practice) {
    G.clock -= dt;
    if (G.period <= 3 && G.clock <= 0) {
      hud();
      endPeriod();
      return;
    }
    hudClock();
  }
  if (G.mom) G.mom.t -= dt;
  for (const p of players) {
    p.saveT -= dt;
    p.cool -= dt;
    p.stun -= dt;
    p.down -= dt;
    p.boost -= dt;
    p.imm -= dt;
    p.pokeCd -= dt;
    p.checkCd -= dt;
    p.sprayCd -= dt;
    p.passCd -= dt;
  }
  if (!G.ai0) {
    autoSwitch(dt);
    humanUpdate(dt);
  }
  teamAI(0, dt);
  teamAI(1, dt);
  for (const p of SKATERS) if (p.checkT > 0) checkStep(p, dt);
  for (const g of GK) goalieAI(g, dt);
  refAI(dt);
  const owner0 = puck.owner;
  integrate(dt);
  strideSounds(dt);
  steals(dt);
  updatePuck(dt);
  if (!G.demo) scuff(dt);
  if (owner0 && owner0.role === 'S' && !puck.owner) G.lastShooter = owner0;
  if (G.state === 'play' && !puck.owner && Math.hypot(puck.vx, puck.vy) < 3) {
    G.stillT += dt;
    if (G.stillT > 5) {
      G.stillT = 0;
      S('whistle');
      if (G.practice) {
        practiceReset(false);
        return;
      }
      if (!G.demo) {
        banner('PUCK FROZEN', 'small', 'Face-off at center');
        G.bannerT = 1.2;
      }
      faceoff();
      return;
    }
  } else G.stillT = 0;
  if (G.state === 'play' || G.state === 'goal') recFrame();
}
