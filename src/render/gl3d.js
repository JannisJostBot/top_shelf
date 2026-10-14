// The 3D view's per-pixel pass on the GPU (WebGL2). mode7.js works out, per screen column, where the ray meets
// the boards and which seat it lands on (cheap, and needed on the CPU anyway); this shader then colours every
// pixel of that column in parallel: the ice floor, the kick plate and boards, the tiered crowd behind the glass,
// the back wall and the roof. It follows the CPU pass in mode7.js step by step, so both look the same. Sprites,
// glares and the scoreboard are still drawn on top with the 2D canvas. Without WebGL2 the CPU pass is used.
import { IH, IW, K } from '../config';
import { FAN_ROWS, FAN_SEATS } from './stands';

const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
uniform vec2 uRes;            // canvas size
uniform vec3 uCam;            // camera x, y, eye height
uniform vec4 uFR;             // forward and right vectors (Fx, Fy, Rx, Ry)
uniform float uF, uHor, uCxs, uK, uNow, uHype;
uniform bool uCards, uOd;     // overdrive: card stunts in the stands, adverts on the ribbon board
uniform vec3 uCardA, uCardB;
uniform bool uOutside;
uniform sampler2D uIce;       // the painted rink (IW x IH)
uniform sampler2D uCols;      // per column: t (boards), tIn (near boards), seat position, u + 1000 * tiny
uniform sampler2D uFans;      // per fan: head, body, darker body (rows of FAN_ROWS); taken (head), card (body), phase in the alpha
uniform vec3 uKick, uBoard, uStand, uSeat, uNear1, uNear2, uArena, uRibbon, uSuite, uMid, uDark;
uniform int uRoof;            // roof kind
uniform vec3 uRB, uRA, uRL, uRC, uRLight;
const float ROWS = 18.0, D0 = 2.0, DD = 2.2, Z0 = 3.0, DZ = 1.7, ROOF_H = 52.0;
const int FROWS = ${FAN_ROWS};
const float FSEATS = ${FAN_SEATS}.0;
const vec2 ICE = vec2(${IW}.0, ${IH}.0);
const float TAU = 6.283185307;

float lines(float p, float s, float w, float foot) {
  float m = mod(p, s) - s * 0.5, hw = max(w, foot) * 0.5;
  return abs(m) < hw ? min(1.0, w / foot) : 0.0;
}
float toGrid(float x, float y, float s, float off) {
  float mx = mod(x - off, s), my = mod(y - off, s);
  return length(vec2(min(mx, s - mx), min(my, s - my)));
}
vec3 lamp(vec3 col, float d, float r, float glow, vec3 light, float foot) {
  float rr = max(r, foot * 0.6);
  if (d < rr) return mix(col, light, min(1.0, (r * r) / (rr * rr) + 0.3));
  if (d < glow) return mix(col, light, 0.35 * (1.0 - (d - rr) / (glow - rr)));
  return col;
}
float parity(float v) { return mod(v, 2.0); }
vec3 roof(float x, float y, float foot, float dist) {
  vec3 col = uRB;
  if (uRoof == 0) { // steel trusses
    col = mix(col, uRL, max(lines(x, 24.0, 1.4, foot), lines(y, 24.0, 1.4, foot)));
    if (parity(floor(x / 24.0)) == parity(floor(y / 24.0))) col = mix(col, uRL, 0.6 * lines(x - y, 24.0, 0.5, foot));
    col = lamp(col, toGrid(x, y, 48.0, 12.0), 1.5, 4.5, uRLight, foot);
  } else if (uRoof == 1) { // dome
    float dx = x - 80.0, dy = y - 128.0, r = length(vec2(dx, dy));
    if (r < 13.0) col = mix(uRC, uRLight, 0.25 * (1.0 - r / 13.0));
    else {
      float a = atan(dy, dx), seg = TAU / 28.0, da = mod(a, seg) - seg * 0.5;
      col = mix(col, uRL, lines(r - 13.0, 30.0, 1.2, foot));
      if (abs(r * da) < max(1.3, foot) * 0.5) col = mix(col, uRL, min(1.0, 1.3 / foot));
      for (int i = 0; i < 2; i++) {
        float R = i == 0 ? 16.0 : 73.0, n = i == 0 ? 12.0 : 36.0;
        if (abs(r - R) >= 5.0) continue;
        float st = TAU / n, k = floor(a / st + 0.5) * st,
          d = length(vec2(dx - cos(k) * R, dy - sin(k) * R));
        if (d < 5.0) col = lamp(col, d, 1.3, 4.0, uRLight, foot);
      }
    }
  } else if (uRoof == 2) { // tent
    float i = floor((x + 400.0) / 14.0), m = mod(x, 14.0) / 14.0, sag = 1.0 - abs(m - 0.5) * 2.0;
    col = mix(parity(i) > 0.5 ? uRB : uRA, uRL, 0.35 * (1.0 - sag) * min(1.0, 4.0 / foot));
    col = mix(col, uRL, lines(x + 7.0, 14.0, 0.8, foot));
    float sx = abs(mod(x + 7.0, 14.0) - 7.0), sy = abs(mod(y, 6.0) - 3.0);
    col = lamp(col, length(vec2(7.0 - sx, sy)), 0.6, 2.4, uRLight, foot);
  } else if (uRoof == 3) { // neon tubes
    col = mix(col, uRL, 0.22 * lines(x + y, 34.0, 4.0, foot));
    col = mix(col, uRA, 0.22 * lines(x - y, 34.0, 4.0, foot));
    col = mix(col, uRL, lines(x + y, 34.0, 0.9, foot));
    col = mix(col, uRA, lines(x - y, 34.0, 0.9, foot));
  } else if (uRoof == 4) { // timber beams
    col = parity(floor((y + 400.0) / 3.2)) > 0.5 ? uRB : uRA;
    if (foot > 2.5) col = mix(uRB, uRA, 0.5);
    col = mix(col, uRL, lines(y, 30.0, 3.0, foot));
    col = mix(col, uRC, 0.7 * lines(y + 1.4, 30.0, 0.5, foot));
    col = lamp(col, length(vec2(mod(x, 20.0) - 10.0, mod(y, 30.0) - 15.0)), 1.1, 3.6, uRLight, foot);
  } else { // iron girders
    col = foot > 1.2 ? mix(uRB, uRA, 0.5) : (parity(floor((y + 400.0) / 2.5)) > 0.5 ? uRB : uRA);
    col = mix(col, uRL, max(lines(x, 36.0, 2.2, foot), lines(y, 36.0, 2.2, foot)));
    col = lamp(col, toGrid(x, y, 36.0, 18.0), 1.5, 5.0, uRLight, foot);
  }
  return mix(col, uRB, min(0.85, max(0.0, (dist - 140.0) / 260.0)));
}
vec3 glass(vec3 c) { return floor((3.0 * c * 255.0 + vec3(205.0, 228.0, 240.0)) / 4.0) / 255.0; }
vec3 ice(float wx, float wy, vec3 outside) {
  ivec2 ip = ivec2(floor(wx * uK), floor(wy * uK));
  if (ip.x < 0 || ip.y < 0 || float(ip.x) >= ICE.x || float(ip.y) >= ICE.y) return outside;
  return texelFetch(uIce, ip, 0).rgb;
}
float rowY(float t, float r, float h) { return uHor + ((h - (Z0 + r * DZ)) * uF) / (t + D0 + r * DD); }

void main() {
  int xi = int(gl_FragCoord.x);
  float x = float(xi), y = uRes.y - 1.0 - floor(gl_FragCoord.y), h = uCam.z;
  vec4 cd = texelFetch(uCols, ivec2(xi, 0), 0);
  float t = cd.x, tIn = cd.y, seatF = cd.z, u = mod(cd.w, 1000.0);
  bool tiny = cd.w >= 1000.0;
  float k = (x - uCxs) / uF, dx = uFR.x + uFR.z * k, dy = uFR.y + uFR.w * k;
  float wb = uHor + (h * uF) / t, bt = uHor + ((h - 4.5) * uF) / t, gt = uHor + ((h - 10.0) * uF) / t,
    kick = wb - (wb - bt) * 0.22;
  vec3 col;
  if (y > wb) {
    float tt = (h * uF) / (y - uHor);
    col = ice(uCam.x + dx * tt, uCam.y + dy * tt, uArena);
  } else if (y >= kick) col = uKick;
  else if (y >= bt) col = ice(uCam.x + dx * (t + 1.2), uCam.y + dy * (t + 1.2), uBoard);
  else {
    // which seat row this pixel is in (as the CPU pass steps up through them)
    float r = 0.0;
    for (int kk = 1; kk <= 18; kk++) {
      if (y < rowY(t, float(kk), h)) r = float(kk); else break;
    }
    if (y < rowY(t, ROWS, h)) {
      float tW = t + D0 + ROWS * DD, wallTop = uHor + ((h - ROOF_H) * uF) / tW;
      if (y < wallTop) {
        float tc = ((ROOF_H - h) * uF) / (uHor - y);
        col = roof(uCam.x + dx * tc, uCam.y + dy * tc, max(tc / uF, (tc * tc) / (uF * (ROOF_H - h))), tc);
      } else {
        float z = h - ((y - uHor) * tW) / uF;
        if (z >= 36.0 && z < 37.6) {
          float ad = u + floor(uNow * 24.0), m = mod(ad, 24.0), seg = mod(floor(ad / 24.0), 3.0);
          col = !uOd ? uRibbon : (m >= 20.0 ? uDark : (seg < 1.0 ? uCardA : (seg < 2.0 ? uRibbon : uCardB)));
        } else col = z >= 40.0 && z < 44.0 && mod(u, 8.0) < 6.0 ? uSuite : uArena;
      }
    } else {
      float top = rowY(t, r + 1.0, h), bh = rowY(t, r, h) - top;
      int seat = int(mod(floor(seatF), FSEATS)), fr = int(mod(r, float(FROWS)));
      float xin = seatF - floor(seatF);
      vec4 fh = texelFetch(uFans, ivec2(seat, fr), 0), fb = texelFetch(uFans, ivec2(seat, fr + FROWS), 0),
        fd = texelFetch(uFans, ivec2(seat, fr + 2 * FROWS), 0);
      bool empty = fh.a < 0.5;
      float wave = sin(uNow * 11.0 + fd.a * TAU);
      bool card = uCards && fb.a > 0.5 && wave > -0.2;
      vec3 cardC = mod(floor(seatF / 6.0), 2.0) < 1.0 ? uCardA : uCardB;
      if (bh < 2.0 || tiny) {
        vec3 shade = parity(r) > 0.5 ? uDark : uMid;
        if (empty) col = shade;
        else {
          bool up = uHype > 0.05 && wave > 0.4, head = bh >= 1.5 && (y - top) / bh < 0.32;
          col = (floor((card ? cardC : (head || up ? fh.rgb : (xin > 0.6 ? fd.rgb : fb.rgb))) * 127.5) + floor(shade * 127.5)) / 255.0;
        }
      } else {
        float bob = uHype > 0.05 ? wave * uHype * 0.18 : 0.0, w = (y - top) / bh + bob;
        col = w >= 0.84 ? uSeat : uStand;
        if (!empty) {
          if (card && w >= 0.0 && w < 0.34 && xin >= 0.2 && xin <= 0.8) col = cardC;
          else if (w >= 0.02 && w < 0.3 && xin >= 0.32 && xin <= 0.68) col = fh.rgb;
          else if (w >= 0.3 && w < 0.84 && xin >= 0.14 && xin <= 0.86) col = xin > 0.68 ? fd.rgb : fb.rgb;
        }
      }
    }
    if (y >= gt) col = glass(col);
  }
  if (uOutside) {
    // the fan cam's near boards in front, and the glass above them over everything behind
    float nearTop = uHor + ((h - 4.5) * uF) / tIn, nearBase = uHor + (h * uF) / tIn,
      nearGlass = uHor + ((h - 10.0) * uF) / tIn, nearKick = nearBase - (nearBase - nearTop) * 0.22;
    if (y >= nearTop) col = y >= nearBase ? (parity(floor(y / 4.0)) > 0.5 ? uNear1 : uNear2) : (y >= nearKick ? uKick : uBoard);
    else if (y >= nearGlass) col = glass(col);
  }
  o = vec4(col, 1.0);
}`;

let gl = null,
  canvas = null,
  prog = null,
  U = {},
  tex = {},
  failed = false,
  iceFor = null,
  fansFor = null,
  cols = new Float32Array(0);

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}
function makeTex() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [p, v] of [
    [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
    [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, p, v);
  return t;
}
function init() {
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) throw new Error('no webgl2');
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const a = gl.getActiveUniform(prog, i);
      U[a.name] = gl.getUniformLocation(prog, a.name);
    }
    // one triangle over the whole canvas
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    tex.ice = makeTex();
    tex.cols = makeTex();
    tex.fans = makeTex();
    gl.uniform1i(U.uIce, 0);
    gl.uniform1i(U.uCols, 1);
    gl.uniform1i(U.uFans, 2);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      failed = true; // fall back to the CPU pass
    });
  } catch (e) {
    console.warn('3D view on the CPU (no GPU pass):', e && e.message);
    failed = true;
    gl = null;
  }
}
/** Whether the GPU pass can be used (sets it up the first time). */
export function gl3dReady() {
  if (!gl && !failed) init();
  return !!gl && !failed;
}
/** Room for the per-column data of a frame `w` columns wide: 4 floats per column. */
export function columnBuffer(w) {
  if (cols.length !== w * 4) cols = new Float32Array(w * 4);
  return cols;
}
const rgb = c => [(c & 255) / 255, ((c >> 8) & 255) / 255, ((c >> 16) & 255) / 255];
const hex = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const ROOFS = { truss: 0, dome: 1, tent: 2, neon: 3, beams: 4, girders: 5 };

/**
 * Draws the frame's background pass and returns the canvas holding it (or null on failure).
 * `a` holds the camera and projection, the colours and the rink and crowd data (see render3D in mode7.js).
 */
export function drawGL(a) {
  try {
    const W = a.W,
      H = a.H;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    gl.viewport(0, 0, W, H);
    // the painted rink, uploaded when it changes
    if (a.iceBuf && a.iceBuf !== iceFor) {
      iceFor = a.iceBuf;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex.ice);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, IW, IH, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(a.iceBuf.buffer));
    }
    // the crowd (head, body, darker body per fan, the phase of its cheering in the alpha), when it changes
    if (a.fanTab !== fansFor) {
      fansFor = a.fanTab;
      const d = new Uint8Array(FAN_SEATS * FAN_ROWS * 3 * 4);
      a.fanTab.forEach((fan, fi) => {
        const seat = Math.floor(fi / FAN_ROWS),
          row = fi % FAN_ROWS;
        [fan.head, fan.body, fan.bodyD].forEach((c, k) => {
          const i = ((row + k * FAN_ROWS) * FAN_SEATS + seat) * 4;
          d[i] = (c || 0) & 255;
          d[i + 1] = ((c || 0) >> 8) & 255;
          d[i + 2] = ((c || 0) >> 16) & 255;
          // (body row: whether this fan holds up a card)
          d[i + 3] = k === 0 ? (fan.empty ? 0 : 255) : k === 2 ? Math.round(((fan.ph % (Math.PI * 2)) / (Math.PI * 2)) * 255) : fan.card ? 255 : 0;
        });
      });
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tex.fans);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FAN_SEATS, FAN_ROWS * 3, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex.cols);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, 1, 0, gl.RGBA, gl.FLOAT, cols);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform3f(U.uCam, a.camX, a.camY, a.h);
    gl.uniform4f(U.uFR, a.Fx, a.Fy, a.Rx, a.Ry);
    gl.uniform1f(U.uF, a.f);
    gl.uniform1f(U.uHor, a.hor);
    gl.uniform1f(U.uCxs, a.cxs);
    gl.uniform1f(U.uK, K);
    gl.uniform1f(U.uNow, a.now);
    gl.uniform1f(U.uHype, a.hype);
    gl.uniform1i(U.uCards, a.cards ? 1 : 0);
    gl.uniform1i(U.uOd, a.od ? 1 : 0);
    gl.uniform1i(U.uOutside, a.outside ? 1 : 0);
    const c = a.colors;
    for (const k of ['uKick', 'uBoard', 'uStand', 'uSeat', 'uNear1', 'uNear2', 'uArena', 'uRibbon', 'uSuite', 'uMid', 'uDark', 'uCardA', 'uCardB'])
      gl.uniform3fv(U[k], rgb(c[k]));
    const R = a.roof;
    gl.uniform1i(U.uRoof, ROOFS[R.kind] ?? 0);
    gl.uniform3fv(U.uRB, hex(R.base));
    gl.uniform3fv(U.uRA, hex(R.alt || R.base));
    gl.uniform3fv(U.uRL, hex(R.line));
    gl.uniform3fv(U.uRC, hex(R.accent || R.line));
    gl.uniform3fv(U.uRLight, hex(R.light || R.line));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return canvas;
  } catch (e) {
    failed = true;
    return null;
  }
}
