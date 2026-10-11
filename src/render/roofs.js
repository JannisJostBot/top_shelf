// Arena ceilings for the 3D views. Each arena has its own roof (see `roof` in data/stadiums.js); a painter turns a
// point on the roof plane (rink coordinates) into a colour. `foot` is how many world units one screen pixel covers
// there: thin lines fade to their average instead of shimmering once they get thinner than a pixel, and the far
// roof settles into its base colour.
import { U32 } from './stands';

/** Height of the roof above the ice, in world units (the top seat row is at about 34). */
export const ROOF_H = 52;

const CX = 80,
  CY = 128;
const r8 = c => c & 255,
  g8 = c => (c >> 8) & 255,
  b8 = c => (c >> 16) & 255;
/** a mixed toward b by k (0..1), packed colours. */
function mix(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return (
    ((255 << 24) |
      ((b8(a) + (b8(b) - b8(a)) * k) << 16) |
      ((g8(a) + (g8(b) - g8(a)) * k) << 8) |
      (r8(a) + (r8(b) - r8(a)) * k)) >>>
    0
  );
}
const len = (a, b) => Math.sqrt(a * a + b * b);
/** Coverage (0..1) of lines `w` wide, every `s` units along p, for a pixel `foot` wide. */
function lines(p, s, w, foot) {
  const m = (((p % s) + s) % s) - s / 2, // -s/2..s/2, lines sit at the middle of each period
    half = Math.max(w, foot) / 2;
  return Math.abs(m) < half ? Math.min(1, w / foot) : 0;
}
/** Distance to the nearest point of a grid with spacing s, offset o. */
function toGrid(x, y, s, o) {
  const mx = (((x - o) % s) + s) % s,
    my = (((y - o) % s) + s) % s;
  return len(Math.min(mx, s - mx), Math.min(my, s - my));
}
/** A small lamp: solid core, soft glow around it (both scaled for the pixel size). */
function lamp(col, d, r, glow, light, foot) {
  const rr = Math.max(r, foot * 0.6);
  if (d < rr) return mix(col, light, Math.min(1, (r * r) / (rr * rr) + 0.3));
  if (d < glow) return mix(col, light, 0.35 * (1 - (d - rr) / (glow - rr)));
  return col;
}

// the dome's rings of lamps: radius and number of lamps
const RINGS = [
  [16, 12],
  [73, 36],
];
const PAINTERS = {
  /** Steel trusses in a square grid, with warm lights hanging between them. */
  truss(c) {
    const base = U32(c.base),
      truss = U32(c.line),
      light = U32(c.light);
    return (x, y, foot) => {
      let col = base;
      col = mix(col, truss, Math.max(lines(x, 24, 1.4, foot), lines(y, 24, 1.4, foot)));
      // thin cross bracing in every other bay
      if (Math.floor(x / 24) % 2 === Math.floor(y / 24) % 2) col = mix(col, truss, 0.6 * lines(x - y, 24, 0.5, foot));
      return lamp(col, toGrid(x, y, 48, 12), 1.5, 4.5, light, foot);
    };
  },
  /** A dome: ribs running out from a glowing oculus over centre ice, crossed by rings. */
  dome(c) {
    const base = U32(c.base),
      rib = U32(c.line),
      light = U32(c.light),
      eye = U32(c.accent);
    return (x, y, foot) => {
      const dx = x - CX,
        dy = y - CY,
        r = len(dx, dy);
      if (r < 13) return mix(eye, light, 0.25 * (1 - r / 13));
      let col = base;
      const a = Math.atan2(dy, dx),
        seg = (Math.PI * 2) / 28,
        da = (((a % seg) + seg) % seg) - seg / 2;
      col = mix(col, rib, lines(r - 13, 30, 1.2, foot));
      if (Math.abs(r * da) < Math.max(1.3, foot) / 2) col = mix(col, rib, Math.min(1, 1.3 / foot));
      // a ring of lights around the oculus and a fainter outer ring
      for (const [R, n] of RINGS) {
        // a lamp on this ring is at least |r - R| away, so only pixels near the ring can be lit by one
        if (Math.abs(r - R) >= 5) continue;
        const step = (Math.PI * 2) / n,
          k = Math.round(a / step) * step,
          d = len(dx - Math.cos(k) * R, dy - Math.sin(k) * R);
        if (d < 5) col = lamp(col, d, 1.3, 4, light, foot);
      }
      return col;
    };
  },
  /** A tent of fabric panels, with strings of little bulbs along the seams. */
  tent(c) {
    const a = U32(c.base),
      b = U32(c.alt),
      seam = U32(c.line),
      light = U32(c.light);
    return (x, y, foot) => {
      const i = Math.floor((x + 400) / 14);
      // each panel is shaded darker toward its seams, like fabric sagging between poles
      const m = (((x % 14) + 14) % 14) / 14,
        sag = 1 - Math.abs(m - 0.5) * 2;
      let col = mix(i % 2 ? a : b, seam, 0.35 * (1 - sag) * Math.min(1, 4 / foot));
      col = mix(col, seam, lines(x + 7, 14, 0.8, foot));
      // bulbs on the seams, every 6 units
      const sx = Math.abs((((x + 7) % 14) + 14) % 14 - 7),
        sy = Math.abs((((y % 6) + 6) % 6) - 3);
      return lamp(col, len(7 - sx, sy), 0.6, 2.4, light, foot);
    };
  },
  /** Black, criss-crossed by neon tubes in the arena's two colours. */
  neon(c) {
    const base = U32(c.base),
      a = U32(c.line),
      b = U32(c.alt);
    return (x, y, foot) => {
      let col = base;
      const la = lines(x + y, 34, 0.9, foot),
        lb = lines(x - y, 34, 0.9, foot);
      // a soft halo first, then the tube itself
      col = mix(col, a, 0.22 * lines(x + y, 34, 4, foot));
      col = mix(col, b, 0.22 * lines(x - y, 34, 4, foot));
      col = mix(col, a, la);
      return mix(col, b, lb);
    };
  },
  /** Wooden planks carried by big glulam beams, with lanterns hanging from the beams. */
  beams(c) {
    const a = U32(c.base),
      b = U32(c.alt),
      beam = U32(c.line),
      edge = U32(c.accent),
      light = U32(c.light);
    return (x, y, foot) => {
      let col = Math.floor((y + 400) / 3.2) % 2 ? a : b;
      if (foot > 2.5) col = mix(a, b, 0.5); // planks too small to see: their average
      col = mix(col, beam, lines(y, 30, 3, foot));
      col = mix(col, edge, 0.7 * lines(y + 1.4, 30, 0.5, foot)); // the lit underside edge of each beam
      const ly = (((y % 30) + 30) % 30) - 15,
        lx = (((x % 20) + 20) % 20) - 10;
      return lamp(col, len(lx, ly), 1.1, 3.6, light, foot);
    };
  },
  /** Corrugated iron on rusty girders, lit by orange sodium lamps. */
  girders(c) {
    const a = U32(c.base),
      b = U32(c.alt),
      girder = U32(c.line),
      light = U32(c.light);
    return (x, y, foot) => {
      let col = foot > 1.2 ? mix(a, b, 0.5) : Math.floor((y + 400) / 2.5) % 2 ? a : b;
      col = mix(col, girder, Math.max(lines(x, 36, 2.2, foot), lines(y, 36, 2.2, foot)));
      return lamp(col, toGrid(x, y, 36, 18), 1.5, 5, light, foot);
    };
  },
};

let cacheFor = null,
  cache = null;
/** The roof painter for a stadium (made once per stadium); returns (x, y, foot, dist) => packed colour. */
export function roofPainter(S) {
  if (cacheFor === S) return cache;
  const R = S.roof,
    paint = PAINTERS[R.kind](R),
    base = U32(R.base);
  cacheFor = S;
  // far away the roof settles into its base colour, as the light falls off
  cache = (x, y, foot, dist) => mix(paint(x, y, foot), base, Math.min(0.85, Math.max(0, (dist - 140) / 260)));
  return cache;
}

/* ---------- lamp positions, for the glares drawn over them (see drawGlares in mode7.js) ---------- */
// the roof stretches past the rink over the stands
const X0 = -60,
  X1 = 220,
  Y0 = -60,
  Y1 = 316;
function gridLamps(sx, sy, ox, oy, r, keep = (x, y) => true) {
  const out = [];
  for (let x = ox + Math.ceil((X0 - ox) / sx) * sx; x <= X1; x += sx)
    for (let y = oy + Math.ceil((Y0 - oy) / sy) * sy; y <= Y1; y += sy) if (keep(x, y)) out.push({ x, y, r });
  return out;
}
const LAMPS = {
  truss: () => gridLamps(48, 48, 12, 12, 1.5),
  dome: () => {
    const out = [];
    for (const [R, n] of [
      [16, 12],
      [73, 36],
    ])
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push({ x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, r: 1.3 });
      }
    return out;
  },
  // only every fourth bulb on the strings glints, or the roof would be all stars
  tent: () => gridLamps(14, 24, 0, 3, 0.6),
  // glints where the neon tubes cross
  neon: () => gridLamps(17, 17, 0, 0, 0.8, (x, y) => (((x + y - 17) % 34) + 34) % 34 === 0),
  beams: () => gridLamps(20, 30, 10, 15, 1.1),
  girders: () => gridLamps(36, 36, 18, 18, 1.5),
};
let lampsFor = null,
  lampList = null;
/** The roof's lamps for a stadium: world positions on the roof plane, size, twinkle phase and glare colour. */
export function roofLamps(S) {
  if (lampsFor !== S) {
    lampsFor = S;
    const col = S.roof.kind === 'neon' ? '#ffd6f2' : S.roof.light;
    lampList = LAMPS[S.roof.kind]().map((l, i) => ({ ...l, ph: ((i * 2654435761) >>> 0) / 4294967296 * 6.28, col }));
  }
  return lampList;
}
