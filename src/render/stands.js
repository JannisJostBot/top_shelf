import { H, K, W } from '../config';
import { hash, rnd, toS } from '../core/math';
import { clock } from '../core/time';
import { kit } from '../game/kit';
import { G } from '../game/world';
import { settings } from '../settings';
import { viewRect } from './atmosphere';
import { R } from './pixels';

/* ---------- fans ---------- */
export const M = 14,
  FAN_SEATS = 128,
  FAN_ROWS = 48;
export let fanTab = [];
/** Share of seats taken during practice: a training session draws only a handful of onlookers. */
export const PRACTICE_FILL = 0.05;
let fansSparse = false;
export const U32 = h =>
  ((255 << 24) |
    (parseInt(h.slice(5, 7), 16) << 16) |
    (parseInt(h.slice(3, 5), 16) << 8) |
    parseInt(h.slice(1, 3), 16)) >>>
  0;
const shade = (h, k) =>
  '#' +
  [1, 3, 5]
    .map(i =>
      Math.round(parseInt(h.slice(i, i + 2), 16) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export function buildFans() {
  const extra = ['#e9edf3', '#2a2f3d', '#f2b632', '#5a6a7d', '#d8343f', '#3d7bff'],
    skins = ['#f3cfae', '#e8b48a', '#c98d5f', '#9a633d', '#6e4329'];
  fansSparse = !!G.practice;
  fanTab = [];
  for (let s = 0; s < FAN_SEATS; s++)
    for (let r = 0; r < FAN_ROWS; r++) {
      const h = hash(s * 1.7 + 0.3, r * 3.1 + 0.7);
      const body =
          h < 0.55
            ? kit.TEAMS[0].main
            : h < 0.75
              ? kit.TEAMS[1].main
              : extra[Math.floor(hash(s, r) * extra.length)],
        head = skins[Math.floor(hash(r, s * 2) * skins.length)];
      fanTab.push({
        empty: h > 0.93 || (fansSparse && hash(s * 0.37 + 5.1, r * 1.3 + 2.9) > PRACTICE_FILL),
        bodyHex: body,
        headHex: head,
        body: U32(body),
        bodyD: U32(shade(body, 0.7)),
        head: U32(head),
        ph: hash(r * 2, s) * 6.28,
        // holds up a card when the crowd gets loud (overdrive)
        card: hash(s * 0.71 + 1.3, r * 0.53 + 4.1) < 0.35,
      });
    }
}
/** Rebuild the crowd when play switches between a match (full stands) and practice (nearly empty). */
export function syncFans() {
  if (!!G.practice !== fansSparse) buildFans();
}
/** The crowd's mood: overdrive keeps them a little livelier, and on their feet for a fight. */
export function crowdHype() {
  if (!settings.overdrive) return G.hype;
  return Math.max(G.hype, G.state === 'brawl' ? 0.85 : G.practice ? 0 : 0.12);
}
// The card stunt: sections of fans hold up cards in the home colour and white, block by block.
export const cardCol = section => (section & 1 ? '#ffffff' : kit.TEAMS[0].main);
export const FAN2D = [];
for (const side of [-1, 1])
  for (let c = 0; c < 3; c++)
    for (let y = 8; y <= 248; y += 5)
      FAN2D.push({
        x: side < 0 ? -3.5 - c * 4.5 : W + 3.5 + c * 4.5,
        y: y + (c % 2) * 2.5,
        ph: rnd(0, 6.28),
      });
for (const side of [-1, 1])
  for (let r = 0; r < 3; r++)
    for (let x = 8; x <= 152; x += 5)
      FAN2D.push({
        x: x + (r % 2) * 2.5,
        y: side < 0 ? -3.5 - r * 4.5 : H + 3.5 + r * 4.5,
        ph: rnd(0, 6.28),
      });
export function drawStands(g) {
  const v = viewRect();
  if (v.x >= 0 && v.x + v.w <= W && v.y >= 0 && v.y + v.h <= H) return;
  R(g, -M * K, -M * K, (W + 2 * M) * K, (H + 2 * M) * K, '#141a2c');
  const hype = crowdHype(),
    cards = settings.overdrive && hype > 0.4;
  for (let i = 0; i < FAN2D.length; i++) {
    const f = FAN2D[i];
    if (f.x < v.x - 3 || f.x > v.x + v.w + 3 || f.y < v.y - 3 || f.y > v.y + v.h + 3) continue;
    const t = fanTab[i % fanTab.length];
    if (!t || t.empty) continue;
    const bob = Math.round(Math.sin(clock.now * (4 + hype * 8) + f.ph) * (0.4 + hype * 2)),
      x = toS(f.x),
      y = toS(f.y) - bob;
    R(g, x - 3, y - 1, 6, 4, t.bodyHex);
    R(g, x - 2, y - 4, 4, 3, t.headHex);
    if (cards && t.card && Math.sin(clock.now * 6 + f.ph) > -0.2) {
      R(g, x - 3, y - 9, 6, 5, '#0b0f1a');
      R(g, x - 2, y - 8, 4, 3, cardCol(Math.floor((f.x + f.y + 40) / 24)));
    } else if (hype > 0.4 && Math.sin(clock.now * 6 + f.ph) > 0) {
      R(g, x - 4, y - 7, 1, 4, t.headHex);
      R(g, x + 3, y - 7, 1, 4, t.headHex);
    }
  }
}
