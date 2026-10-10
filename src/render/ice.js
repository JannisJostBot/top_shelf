import { GB, GT, IH, IW, K, RR, RX0, RX1, RY0, RY1 } from '../config';
import { $ } from '../core/dom';
import { hash, rnd } from '../core/math';
import { STADIUMS } from '../data/stadiums';
import { settings } from '../settings';

export const ice = document.createElement('canvas');
ice.width = IW;
ice.height = IH;
// fictional club crest, drawn small with hard edges and scaled up so it reads as pixel art on the ice
function drawLogo(g, S, cx, cy, sc) {
  const N = 24,
    cvs = document.createElement('canvas');
  cvs.width = cvs.height = N;
  const x = cvs.getContext('2d');
  const [a, b, c] = S.lc;
  const circ = (X, Y, r, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(X, Y, r, 0, Math.PI * 2);
    x.fill();
  };
  const poly = (pts, col) => {
    x.fillStyle = col;
    x.beginPath();
    pts.forEach(([X, Y], i) => (i ? x.lineTo(X, Y) : x.moveTo(X, Y)));
    x.closePath();
    x.fill();
  };
  const ln = (x0, y0, x1, y1, w, col) => {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();
  };
  circ(12, 12, 11.6, a);
  circ(12, 12, 9.8, '#ffffff');
  if (S.logo === 'flake') {
    for (let k = 0; k < 6; k++) {
      const an = (k * Math.PI) / 3 + Math.PI / 6,
        ex = 12 + Math.cos(an) * 8,
        ey = 12 + Math.sin(an) * 8;
      ln(12, 12, ex, ey, 1.8, a);
      const bx = 12 + Math.cos(an) * 5,
        by = 12 + Math.sin(an) * 5;
      ln(bx, by, bx + Math.cos(an + 0.8) * 2.6, by + Math.sin(an + 0.8) * 2.6, 1.4, a);
      ln(bx, by, bx + Math.cos(an - 0.8) * 2.6, by + Math.sin(an - 0.8) * 2.6, 1.4, a);
    }
    circ(12, 12, 2.2, c);
  }
  if (S.logo === 'kraken') {
    for (let k = 0; k < 4; k++) {
      const sx = 8.4 + k * 2.4,
        dir = k < 2 ? -1 : 1;
      x.strokeStyle = a;
      x.lineWidth = 1.7;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(sx, 13);
      x.quadraticCurveTo(sx + dir * 3.2, 17, sx + dir * 0.8, 20.5);
      x.stroke();
    }
    circ(12, 9.6, 5.4, a);
    circ(9.9, 9.6, 1.6, '#ffffff');
    circ(14.1, 9.6, 1.6, '#ffffff');
    circ(10.2, 10, 0.8, c);
    circ(14.4, 10, 0.8, c);
  }
  if (S.logo === 'penguin') {
    // a penguin standing on the ice: black body and head, white belly and eyes, orange beak and feet
    poly(
      [
        [6.4, 11],
        [4.6, 17.4],
        [7.6, 15.4],
      ],
      a,
    );
    poly(
      [
        [17.6, 11],
        [19.4, 17.4],
        [16.4, 15.4],
      ],
      a,
    );
    x.fillStyle = a;
    x.beginPath();
    x.ellipse(12, 13.6, 6, 7.2, 0, 0, Math.PI * 2);
    x.fill();
    circ(12, 8.2, 4.6, a);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.ellipse(12, 15, 3.9, 5.2, 0, 0, Math.PI * 2);
    x.fill();
    circ(10.1, 7.6, 1.3, '#ffffff');
    circ(13.9, 7.6, 1.3, '#ffffff');
    circ(10.4, 7.9, 0.65, a);
    circ(13.6, 7.9, 0.65, a);
    poly(
      [
        [10.4, 9.3],
        [13.6, 9.3],
        [12, 11.4],
      ],
      c,
    );
    poly(
      [
        [8, 21],
        [11.4, 21],
        [9.8, 19.4],
      ],
      c,
    );
    poly(
      [
        [12.6, 21],
        [16, 21],
        [14.2, 19.4],
      ],
      c,
    );
  }
  if (S.logo === 'pine') {
    // three-tier pine with a timber trunk and crossed axes behind it
    ln(5.4, 18.6, 18.6, 7.4, 1.5, c);
    ln(18.6, 18.6, 5.4, 7.4, 1.5, c);
    poly(
      [
        [12, 3.4],
        [7.6, 9.6],
        [16.4, 9.6],
      ],
      a,
    );
    poly(
      [
        [12, 6.4],
        [6.2, 13.4],
        [17.8, 13.4],
      ],
      a,
    );
    poly(
      [
        [12, 9.6],
        [4.9, 17.4],
        [19.1, 17.4],
      ],
      a,
    );
    x.fillStyle = c;
    x.fillRect(10.6, 17.2, 2.8, 3.4);
  }
  if (S.logo === 'anvil') {
    // anvil with a glowing ingot and flying sparks
    poly(
      [
        [3, 9.8],
        [18.8, 9.8],
        [18.8, 12.6],
        [15.4, 12.6],
        [14, 14.6],
        [15.8, 16.6],
        [17.6, 16.6],
        [17.6, 19],
        [6.4, 19],
        [6.4, 16.6],
        [8.2, 16.6],
        [10, 14.6],
        [8.6, 12.6],
        [7.4, 12.6],
      ],
      a,
    );
    ln(9.6, 8.4, 14.6, 8.4, 1.8, c);
    circ(12, 5, 1.1, c);
    circ(15.6, 4.4, 0.95, c);
    circ(8.4, 4.8, 0.95, c);
    circ(17.6, 6.6, 0.8, c);
    circ(6.4, 6.8, 0.8, c);
  }
  if (S.logo === 'comet') {
    ln(4.2, 19.8, 12, 12, 3.2, b);
    ln(6.2, 21, 13, 14.4, 1.5, a);
    ln(3, 16.6, 10.4, 9.8, 1.5, a);
    const st = k => {
      const r = k % 2 ? 2.5 : 5.8,
        an = -Math.PI / 2 + (k * Math.PI) / 5;
      return [15 + Math.cos(an) * r, 9 + Math.sin(an) * r];
    };
    poly(
      [...Array(10)].map((_, k) => {
        const [X, Y] = st(k);
        return [15 + (X - 15) * 1.3, 9 + (Y - 9) * 1.3];
      }),
      a,
    );
    poly(
      [...Array(10)].map((_, k) => st(k)),
      c,
    );
  }
  const id = x.getImageData(0, 0, N, N);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 110 ? 255 : 0;
  x.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 0.92;
  g.drawImage(cvs, Math.round(cx - (N * sc) / 2), Math.round(cy - (N * sc) / 2), N * sc, N * sc);
  g.globalAlpha = 1;
}
export function buildIce(key, target) {
  key = key || settings.stadiumKey;
  target = target || ice;
  const S = STADIUMS[key];
  const g = target.getContext('2d'),
    img = g.createImageData(IW, IH),
    d = img.data;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = {
    ice: hex(S.ice),
    iceEdge: hex(S.edge),
    ice2: hex(S.ice2),
    ice3: hex('#f8fbfd'),
    tint: hex(S.tint),
    red: hex('#d8343f'),
    blue: hex('#2f6bd8'),
    crease: hex('#a9d4f5'),
    board: hex('#f3f5f8'),
    boardS: hex('#c4cbd6'),
    kick: hex(S.kick),
    glass: hex(S.glass),
    arena: hex(S.arena),
    ad1: hex(S.lc[0]),
    ad2: hex(S.lc[2] === '#ffffff' ? S.kick : S.lc[2]),
  };
  function inside(x, y, ins) {
    const x0 = RX0 + ins,
      x1 = RX1 - ins,
      y0 = RY0 + ins,
      y1 = RY1 - ins,
      r = RR - ins;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : null,
      cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : null;
    if (cx !== null && cy !== null) return Math.hypot(x - cx, y - cy) <= r;
    return true;
  }
  const ring = (px, py, cx, cy, r) => Math.abs(Math.hypot(px - cx, py - cy) - r) < 0.32;
  const dot = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) < r;
  const endC = [
      [44, 60],
      [116, 60],
      [44, 196],
      [116, 196],
    ],
    neu = [
      [44, 108],
      [116, 108],
      [44, 148],
      [116, 148],
    ];
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) {
      const px = (x + 0.5) / K,
        py = (y + 0.5) / K;
      let c;
      if (!inside(px, py, 0)) {
        const band = inside(px, py, -1.6);
        c = inside(px, py, -0.8)
          ? C.kick
          : band
            ? C.board
            : inside(px, py, -2.2)
              ? C.boardS
              : inside(px, py, -4.2)
                ? C.glass
                : C.arena;
        // sponsor panels along the straight runs of the boards
        const corner = (px < RX0 + RR || px > RX1 - RR) && (py < RY0 + RR || py > RY1 - RR);
        if (band && !corner) {
          const along = py < RY0 + RR || py > RY1 - RR ? px : py,
            seg = Math.floor(along / 12) % 4;
          if (seg === 1) c = C.ad1;
          else if (seg === 3) c = C.ad2;
        }
      } else {
        const n = Math.random();
        c = n < 0.06 ? C.ice2 : n > 0.97 ? C.ice3 : inside(px, py, 4) ? C.ice : C.iceEdge;
        if (Math.hypot(px - 80, py - 128) < 17.6) c = n < 0.06 ? C.ice2 : C.tint;
        const ct = Math.hypot(px - 80, py - GT),
          cb = Math.hypot(px - 80, py - GB);
        if (py > GT && ct < 10) c = ct > 9.5 ? C.red : C.crease;
        if (py < GB && cb < 10) c = cb > 9.5 ? C.red : C.crease;
        for (const [cx, cy] of endC) {
          if (ring(px, py, cx, cy, 13) || dot(px, py, cx, cy, 1.8)) c = C.red;
          if (Math.abs(Math.abs(px - cx) - 13.5) < 1 && Math.abs(Math.abs(py - cy) - 2) < 0.3) c = C.red;
        }
        for (const [cx, cy] of neu) {
          if (dot(px, py, cx, cy, 1.5)) c = C.red;
        }
        if (ring(px, py, 80, 128, 18) || dot(px, py, 80, 128, 1.6)) c = C.blue;
        if ((py >= 95 && py < 97) || (py >= 159 && py < 161)) c = C.blue;
        if (py >= 127 && py < 129) c = py >= 127.5 && py < 128.5 && (x >> 2) % 3 === 0 ? C.ice3 : C.red;
        if ((py >= GT && py < GT + 0.5) || (py >= GB && py < GB + 0.5)) c = C.red;
      }
      const i = (y * IW + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.3;
  g.fillStyle = '#c6d7e6';
  for (let k = 0; k < 140; k++) {
    let x = rnd(28, 292),
      y = rnd(28, 484),
      a = rnd(0, 6.28),
      l = rnd(6, 22);
    for (let s = 0; s < l; s++) {
      const xx = Math.round(x + Math.cos(a) * s),
        yy = Math.round(y + Math.sin(a) * s);
      if (xx > 16 && xx < 304) g.fillRect(xx, yy, 1, 1);
    }
  }
  g.globalAlpha = 1;
  drawLogo(g, S, IW / 2, IH / 2, 2);
  if (target === ice) refreshIceBuf();
}
// arena thumbnails: the middle of each rink, crest and blue lines included
export function drawThumb(src, c, k) {
  if (!c || !c.getContext) return;
  const x = c.getContext('2d'),
    S = STADIUMS[k],
    w = c.width,
    h = c.height;
  x.imageSmoothingEnabled = false;
  x.fillStyle = S.arena;
  x.fillRect(0, 0, w, h);
  // center ice, zoomed so the crest reads
  x.drawImage(src, IW / 2 - 100, IH / 2 - 58, 200, 116, 0, 10, w, h - 20);
  // crowd rows above and below in the arena's colors, with the kick plate in between
  const fans = [S.lc[0], S.lc[2], '#e9edf3', S.kick, '#5a6a7d'];
  for (const y0 of [1, h - 9])
    for (let i = 0; i < w; i += 4) {
      x.fillStyle = fans[Math.floor(hash(i, y0) * fans.length)];
      x.fillRect(i + 1, y0 + (hash(y0, i) < 0.5 ? 0 : 2), 2, 3);
      x.fillStyle = '#e8b48a';
      x.fillRect(i + 1, y0 + (hash(y0, i) < 0.5 ? 0 : 2) - 1, 2, 1);
    }
  x.fillStyle = S.kick;
  x.fillRect(0, 9, w, 1);
  x.fillRect(0, h - 10, w, 1);
}
let thumbsDone = false;
export function arenaThumbs() {
  if (thumbsDone) return;
  thumbsDone = true;
  const tmp = document.createElement('canvas');
  tmp.width = IW;
  tmp.height = IH;
  for (const k of Object.keys(STADIUMS)) {
    buildIce(k, tmp);
    drawThumb(tmp, $('th-' + k), k);
  }
}
export let iceBuf = null;
function refreshIceBuf() {
  try {
    const d = ice.getContext('2d').getImageData(0, 0, IW, IH);
    iceBuf = d && d.data ? new Uint32Array(d.data.buffer) : null;
  } catch (e) {
    iceBuf = null;
  }
}
