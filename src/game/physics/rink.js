import { NETS, RR, RX0, RX1, RY0, RY1 } from '../../config';
import { clamp, rnd } from '../../core/math';
import { goalScored } from '../match';
import { GK } from '../players';
import { grab } from '../puck';
import { G, puck } from '../world';
import { AIM_GAP } from '../aim';
import { netHit, S } from '../fx';

/* ---------- physics helpers ---------- */
/** Whether a world point lies on the ice inside the rounded boards. */
export function insideRinkW(x, y) {
  if (x < RX0 || x > RX1 || y < RY0 || y > RY1) return false;
  const cx = x < RX0 + RR ? RX0 + RR : x > RX1 - RR ? RX1 - RR : null,
    cy = y < RY0 + RR ? RY0 + RR : y > RY1 - RR ? RY1 - RR : null;
  return cx === null || cy === null || Math.hypot(x - cx, y - cy) <= RR;
}
export function rinkPush(o, rad, e) {
  const x0 = RX0 + rad,
    x1 = RX1 - rad,
    y0 = RY0 + rad,
    y1 = RY1 - rad,
    r = RR - rad;
  let nx = 0,
    ny = 0,
    hit = false,
    cx = null,
    cy = null;
  if (o.x < RX0 + RR && o.y < RY0 + RR) {
    cx = RX0 + RR;
    cy = RY0 + RR;
  } else if (o.x > RX1 - RR && o.y < RY0 + RR) {
    cx = RX1 - RR;
    cy = RY0 + RR;
  } else if (o.x < RX0 + RR && o.y > RY1 - RR) {
    cx = RX0 + RR;
    cy = RY1 - RR;
  } else if (o.x > RX1 - RR && o.y > RY1 - RR) {
    cx = RX1 - RR;
    cy = RY1 - RR;
  }
  if (cx !== null) {
    const dx = o.x - cx,
      dy = o.y - cy,
      d = Math.hypot(dx, dy);
    if (d > r) {
      nx = -dx / d;
      ny = -dy / d;
      o.x = cx - nx * r;
      o.y = cy - ny * r;
      hit = true;
    }
  } else {
    if (o.x < x0) {
      o.x = x0;
      nx = 1;
      hit = true;
    } else if (o.x > x1) {
      o.x = x1;
      nx = -1;
      hit = true;
    }
    if (o.y < y0) {
      o.y = y0;
      ny = 1;
      hit = true;
    } else if (o.y > y1) {
      o.y = y1;
      ny = -1;
      hit = true;
    }
  }
  if (hit) {
    const l = Math.hypot(nx, ny);
    nx /= l;
    ny /= l;
    const vn = o.vx * nx + o.vy * ny;
    if (vn < 0) {
      o.vx -= (1 + e) * vn * nx;
      o.vy -= (1 + e) * vn * ny;
      return -vn;
    }
  }
  return 0;
}
export function nearBoards(p) {
  return p.x < 16 || p.x > 144 || p.y < 16 || p.y > 240;
}
export function netPushBody(p, r) {
  for (const n of NETS) {
    const x0 = n.x0 - r,
      x1 = n.x1 + r,
      y0 = n.y0 - r,
      y1 = n.y1 + r;
    if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) {
      const pen = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y],
        m = Math.min(...pen),
        i = pen.indexOf(m);
      if (i === 0) {
        p.x = x0;
        p.vx = Math.min(p.vx, 0);
      } else if (i === 1) {
        p.x = x1;
        p.vx = Math.max(p.vx, 0);
      } else if (i === 2) {
        p.y = y0;
        p.vy = Math.min(p.vy, 0);
      } else {
        p.y = y1;
        p.vy = Math.max(p.vy, 0);
      }
    }
  }
}
// An own goal only counts for a hard shot by the defending team; passes, soft touches and carries are smothered.
function ownGoalAllowed(n) {
  if (puck.lastTeam !== n.def) return true;
  return !puck.owner && puck.hard && Math.hypot(puck.vx, puck.vy) > 140;
}
export function netPuck(px, py) {
  for (const n of NETS) {
    const ex0 = n.x0 - 1,
      ex1 = n.x1 + 1,
      ey0 = n.y0 - 1,
      ey1 = n.y1 + 1;
    if (!(puck.x > ex0 && puck.x < ex1 && puck.y > ey0 && puck.y < ey1)) continue;
    let side;
    if (px <= ex0) side = 'L';
    else if (px >= ex1) side = 'R';
    else if (py <= ey0) side = 'T';
    else if (py >= ey1) side = 'B';
    else side = 'I';
    const front = n.top ? 'B' : 'T';
    // aim trainer: a board covers the goal mouth except for a small gap
    if (side === front && G.aim && n.top && Math.abs(puck.x - G.aim.gap) > AIM_GAP / 2) {
      if (!puck.owner) {
        S('board', Math.hypot(puck.vx, puck.vy) / 220);
        puck.vy = Math.abs(puck.vy) * 0.45;
        puck.vx += rnd(-12, 12);
      }
      puck.y = ey1 + 0.01;
      return false;
    }
    if (side === front) {
      if (puck.x > n.x0 + 1.5 && puck.x < n.x1 - 1.5) {
        if (ownGoalAllowed(n)) {
          goalScored(n.scorer, n);
          return true;
        }
        if (puck.owner) {
          puck.y = n.top ? ey1 + 0.01 : ey0 - 0.01;
          return false;
        }
        if (GK[n.def].benched) {
          goalScored(n.scorer, n);
          return true;
        }
        grab(GK[n.def]);
        S('save', { kind: 'glove' });
        return true;
      }
      if (!puck.owner) {
        S('post');
        netHit(n, puck.x, 0.35);
      }
      puck.y = n.top ? ey1 + 0.01 : ey0 - 0.01;
      puck.vy = -puck.vy * 0.6;
      puck.vx += rnd(-20, 20);
      return false;
    }
    if (!puck.owner && Math.hypot(puck.vx, puck.vy) > 60)
      netHit(n, clamp(puck.x, n.x0, n.x1), 0.5, side === 'I' ? 1 : -1);
    if (side === 'L') {
      puck.x = ex0 - 0.01;
      puck.vx = -Math.abs(puck.vx) * 0.5;
    } else if (side === 'R') {
      puck.x = ex1 + 0.01;
      puck.vx = Math.abs(puck.vx) * 0.5;
    } else if (side === 'T') {
      puck.y = ey0 - 0.01;
      puck.vy = -Math.abs(puck.vy) * 0.5;
    } else if (side === 'B') {
      puck.y = ey1 + 0.01;
      puck.vy = Math.abs(puck.vy) * 0.5;
    } else {
      puck.y = n.top ? ey0 - 0.01 : ey1 + 0.01;
    }
  }
  return false;
}
