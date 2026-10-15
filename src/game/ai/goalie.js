import { GB, GT, NETS } from '../../config';
import { clamp, rnd } from '../../core/math';
import { GK, SK } from '../players';
import { grab, openness, passTo } from '../puck';
import { G, puck } from '../world';
import { settings } from '../../settings';
import { feed, pop, S } from '../fx';
import { cpuSide } from '../online';

/* A save is not a dice roll. The puck is stopped when it passes within the goalie's reach, and whether he got
 * there in time is played out on the ice: he only starts for a shot (or a pass) once his reaction time has passed,
 * then slides across at his lateral speed. So a quick release from close in, a shot to the side he has to cross to,
 * or a pass that pulls him over beats him; a slow shot from far out does not. Only the outermost sliver of his
 * reach, the fingertips, is a matter of luck.
 */
/** How far off the net's centre a goalie positions himself at most (the posts are 13 out), how far he shades
 * toward the puck's side (puck far out, puck close in), and how much faster than his skating he pushes across
 * once he has read a shot. */
const POST = 7,
  SHADE = 0.35,
  SHADE_CLOSE = 0.5,
  PUSH = 1.7,
  // how deep (either side of the line 2 px in front of him) he can stop the puck
  DEPTH = 2;
/** How much further than his reach a goalie can get a fingertip to the puck (the save chance fades to 0 across it). */
export const FINGERTIPS = 1.5;
/** A goalie's reaction time (s) to a shot or pass, lateral speed (px/s) and solid reach either side of his centre. */
export function gkAbility(g) {
  const cpu = cpuSide(g.team),
    skill = g.dummy ? 0.45 : cpu ? settings.diff.goalie : 0.76;
  return {
    delay: cpu ? settings.diff.gkDelay : 0.15,
    speed: cpu ? settings.diff.react : 50,
    reach: (4.25 + 4 * skill) * g.st.glove,
  };
}
export function goalieAI(g, dt) {
  if (g.benched) return;
  const t = g.team,
    gy = t ? GT + 4 : GB - 4;
  g.fx = 0;
  g.fy = t ? 1 : -1;
  if (g.dummy && puck.owner !== g) {
    g.vx = (80 - g.x) * 4;
    g.vy = (gy - g.y) * 6;
    return;
  }
  if (puck.owner === g) {
    g.hold -= dt;
    g.vx *= 0.8;
    g.vy = (gy - g.y) * 6;
    if (g.hold <= 0) {
      let best = null,
        bo = -1;
      for (const m of SK[t]) {
        if (m.down > 0) continue;
        const o = openness(m, t);
        if (o > bo) {
          bo = o;
          best = m;
        }
      }
      if (best) passTo(g, best);
      else g.hold = 0.3;
    }
    return;
  }
  const ab = gkAbility(g),
    // until he has reacted to a shot or pass he still plays the puck where it left the stick
    seen = !puck.owner && puck.age < ab.delay,
    px = seen ? puck.rx : puck.x,
    close = Math.abs(puck.y - gy) < 45;
  let tx = 80 + (px - 80) * (close ? SHADE_CLOSE : SHADE),
    sp = ab.speed;
  if (!puck.owner && !seen && (t ? puck.vy < -20 : puck.vy > 20)) {
    const tt = (gy - puck.y) / puck.vy;
    if (tt > 0 && tt < 1.2) {
      tx = puck.x + puck.vx * tt;
      sp *= PUSH;
    }
  }
  tx = clamp(tx, 80 - POST, 80 + POST);
  g.vx = clamp((tx - g.x) * 8, -sp, sp);
  g.vy = (gy - g.y) * 6;
}
/** Whether the loose puck, as it is moving now, would cross goalie g's goal line inside the goal mouth. */
function onNet(g) {
  const n = NETS[1 - g.team],
    ly = n.top ? n.y1 : n.y0;
  if (n.top ? puck.vy >= 0 : puck.vy <= 0) return false;
  const cx = puck.x + (puck.vx * (ly - puck.y)) / puck.vy;
  return cx > n.x0 + 1.5 && cx < n.x1 - 1.5;
}
export function goalieCheck() {
  for (const g of GK) {
    if (g.benched || g.cool > 0 || (g.passCd > 0 && puck.lastTeam === g.team)) continue;
    const reach = gkAbility(g).reach;
    const dx = puck.x - g.x,
      dy = puck.y - (g.y - 2),
      adx = Math.abs(dx);
    if (adx < reach + FINGERTIPS && Math.abs(dy) < DEPTH) {
      const sp = Math.hypot(puck.vx, puck.vy);
      if (puck.gchk === g && sp >= 70) continue;
      // Inside his reach the puck is stopped. Past it a fingertip gets there, less often the further out: the
      // luck (puck.tip) is drawn once per shot, so a puck that misses the fingertips can still hit his body.
      const tip = adx > reach;
      if (tip && puck.tip >= 1 - (adx - reach) / FINGERTIPS) continue;
      puck.gchk = g;
      if (sp < 70 || (puck.lastTeam === g.team && !puck.hard)) {
        grab(g);
        return true;
      }
      const shooter = puck.lastTeam, // noted before the save hands the puck to the goalie's team
        counts = shooter !== g.team && onNet(g),
        r = Math.random(),
        out = g.team ? 1 : -1,
        side = Math.abs(dx) > 1 ? Math.sign(dx) : Math.random() < 0.5 ? -1 : 1;
      let kind;
      if (!tip && r < (sp < 120 ? 0.7 : 0.4)) {
        grab(g);
        kind = 'GLOVE SAVE';
      } else {
        if (tip) {
          // just touched: the puck is knocked wide
          puck.vx = side * rnd(70, 120);
          puck.vy = out * rnd(15, 40);
          kind = 'FINGERTIPS';
        } else if (r < 0.75) {
          puck.vx = side * rnd(90, 150);
          puck.vy = out * rnd(25, 70);
          kind = 'DEFLECTED';
        } else {
          puck.vy = out * Math.abs(puck.vy) * rnd(0.3, 0.5);
          puck.vx = puck.vx * 0.3 + rnd(-70, 70);
          kind = 'PAD SAVE';
        }
        g.cool = 0.15;
        puck.miss.clear();
        puck.passTo = null;
        puck.hard = false;
        puck.lastTeam = g.team;
        puck.trail.length = 0;
        puck.age = 0;
        puck.rx = puck.x;
        puck.tip = Math.random();
      }
      if (counts) {
        // an opponent's shot on target stopped: a save, and a shot on goal for the shooting team
        G.stats.saves[g.team]++;
        G.stats.sog[1 - g.team]++;
        feed(kind + ' · ' + '#' + g.num + ' ' + g.name, g.team);
      }
      g.saveT = 0.32;
      g.saveDir = side;
      // how the save looks (render/players.js): the glove (also at full stretch for the fingertips), the blocker
      // for a deflection, the butterfly for a pad save
      g.saveKind = kind === 'GLOVE SAVE' || tip ? 'glove' : kind === 'DEFLECTED' ? 'block' : 'pad';
      S('save', { kind: kind === 'GLOVE SAVE' ? 'glove' : kind === 'PAD SAVE' ? 'pad' : 'deflect' });
      if (sp > 200) S('ooh');
      if (tip) pop(g.x, g.y, 'FINGERTIPS!', '#ffffff');
      else if (sp > 170) pop(g.x, g.y, kind, '#ffffff');
      return true;
    } else if (puck.gchk === g && (Math.abs(dx) > reach + FINGERTIPS + 1.5 || Math.abs(dy) > DEPTH + 2))
      puck.gchk = null;
  }
  return false;
}
