export const W = 160,
  H = 256,
  K = 2,
  STEP = 1 / 60,
  BASE = 56,
  ACC = 250,
  PERIOD_LEN = 60;
export const RX0 = 4,
  RY0 = 4,
  RX1 = 156,
  RY1 = 252,
  RR = 24;
export const GT = 26,
  GB = 230,
  ND = 7;
export const NETS = [
  { x0: 67, x1: 93, y0: GT - ND, y1: GT, top: true, scorer: 0, def: 1 },
  { x0: 67, x1: 93, y0: GB, y1: GB + ND, top: false, scorer: 1, def: 0 },
];
export const HARD_SHOT = 165;

/* ---------- rink prerender (2x) ---------- */
export const IW = W * K,
  IH = H * K;
