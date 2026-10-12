import { teamAIRealistic } from './ai/realistic';
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
import { introStep } from './states/intro';
import { postStep } from './states/post';
import { aimTick } from './aim';
import { endReplay, recFrame, replayStep, startReplay } from './replay';
import { brawlStep, startBrawl } from './states/brawl';
import { celebrateStep, endCelebration, startCelebration } from './states/celebrate';
import { faceoff, foUpdate } from './states/faceoff';
import { startZamboni, zamStep } from './states/zamboni';
import { G, parts, puck } from './world';
import { input } from '../input/state';
import { settings } from '../settings';
import { banner, clothStep, hideBanner, hud, hudClock, S, strideSounds, updCam } from './fx';
import { isHuman, net, rinput } from './online';

/* ---------- update ---------- */
/** One fixed simulation step. Online, the host also talks to the guest around it, and the guest (which runs
 * no simulation) shows the host's match instead (src/net/match.js). */
export function update(dt) {
  if (G.net === 'guest') {
    if (net.guestStep) net.guestStep(dt);
    return;
  }
  if (G.net === 'host' && net.pre) net.pre(dt);
  step(dt);
  if (G.net === 'host' && net.post) net.post(dt);
}
/** Moves the loose particles (sparks, snow, confetti). */
export function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.93;
    p.vy *= 0.93;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function step(dt) {
  stepParts(dt);
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
  if (st === 'intro') {
    introStep(dt);
    return;
  }
  if (st === 'replay') {
    if (input.sp || input.pp || input.swp) {
      input.sp = input.pp = input.swp = input.sr = false;
      endReplay();
      return;
    }
    replayStep(dt);
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
  if (st !== 'play' && st !== 'faceoff')
    for (const inp of [input, rinput]) {
      inp.sp = inp.pp = inp.swp = false;
      if (!inp.shootHeld) inp.sr = false;
    }
  if (st === 'over' && G.post) {
    postStep(dt);
    return;
  }
  if (st === 'paused' || st === 'over') return;
  updCam(dt, false);
  if (G.aim && (st === 'play' || st === 'goal') && aimTick(dt)) return;
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
  if (G.state === 'play' && puck.owner) G.stats.poss[puck.owner.team] += dt;
  // how long the puck carrier has been standing (nearly) still: the defence closes in on a dawdling carrier
  const c = puck.owner;
  // (a human carrier pushing the stick is trying to get away, not waiting it out)
  if (c && c.role === 'S' && c === G.holder && Math.hypot(c.vx, c.vy) < 14 && !(isHuman(c) && c.pushing))
    G.holdT += dt;
  else G.holdT = 0;
  G.holder = c;
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
  // online, the guest steers team 1
  if (G.net === 'host') {
    autoSwitch(dt, 1);
    humanUpdate(dt, 1);
  }
  // CPU skaters (and your AI teammates) use the behaviour chosen in Setup
  const ai = settings.cpuStyle === 'realistic' ? teamAIRealistic : teamAI;
  ai(0, dt);
  ai(1, dt);
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
