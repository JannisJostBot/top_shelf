// The simulation's only way out: everything it wants seen, heard or felt is announced here as an event (see
// core/events.ts), and bindings.js connects the events to render/, audio/ and ui/. Game modules import these
// instead of the presentation modules, so the simulation runs headless (see tests/headless.test.ts).
// The names match the presentation functions they stand for, so call sites read the same as before.
import { emit } from '../core/events';

// Online, the host's events are also relayed to the guest (src/net/match.js sets `relay`). Some depend on who is
// watching ("GOAL!" for the scorer, "… SCORES" for the other side): such an argument is written as
// persp(v => …), worked out for the viewer on team v (0 here, and the host's team; 1 the guest's). A viewer that
// should not get the event at all gets SKIP.
const P = Symbol('persp');
export const SKIP = Symbol('skip');
/** An argument that depends on the viewer's team v. */
export const persp = fn => ({ [P]: fn });
const isP = a => a !== null && typeof a === 'object' && P in a;
const resolve = (args, v) => {
  const r = args.map(a => (isP(a) ? a[P](v) : a));
  return r.includes(SKIP) ? null : r;
};
let relay = null,
  quiet = 0;
/** Online host: every event is also handed to `fn(name, args)` for the guest (null stops it). */
export function setRelay(fn) {
  relay = fn;
}
/** Runs `fn` with the relay off: what it announces stays on this screen (the host's own face-off cues). */
export function hostOnly(fn) {
  quiet++;
  try {
    fn();
  } finally {
    quiet--;
  }
}
const out =
  name =>
  (...args) => {
    const has = args.some(isP),
      here = has ? resolve(args, 0) : args;
    if (here) emit(name, ...here);
    if (relay && !quiet) {
      const there = has ? resolve(args, 1) : args;
      if (there) relay(name, there);
    }
  };

/* sound and feel */
export const S = out('sound'); // S(name, opts): a sound effect
export const strideSounds = out('strides'); // skate strokes for this step
export const audio = out('audioUnlock'); // start the audio engine (first user action)
export const setCrowd = out('crowd'); // crowd volume
export const goalMusic = out('goalMusic');
export const stopSong = out('stopSong');
export const chime = out('chime');
export const vib = out('haptic'); // vibration / controller rumble pattern
export const zamEngine = out('zamEngine'); // 'start' | 'stop' | 'speed', v
export const zamHorn = out('zamHorn');
export const flash = out('flash'); // a white flash over the rink (a big hit you were in)

/* effects on the ice */
export const pop = out('pop'); // floating text
export const ring = out('ring');
export const bubble = out('bubble'); // a skater's speech bubble
export const clearFx = out('clearFx'); // drop all pop-ups, rings and bubbles
export const netHit = out('netHit');
export const clothStep = out('clothStep');
export const resetCloth = out('resetCloth');
export const startGoalFx = out('goalFx');
export const clearGoalFx = out('clearGoalFx');
export const goalLamp = out('goalLamp'); // { n, until } or null
export const iceClear = out('iceClear'); // wipe the drawn ice wear
export const iceScuff = out('iceScuff'); // [x, y, x, y, …] skate marks
export const iceChew = out('iceChew'); // the chewed-up ice before resurfacing
export const icePolish = out('icePolish'); // [x, y, …] spots the resurfacer polished

/* camera */
export const updCam = out('camera'); // (dt, snap)
export const upd3D = out('camera3d'); // (snap)
export const zoom = out('zoom'); // top-down zoom factor
export const resetDirector = out('resetDirector');
export const fit = out('layout');

/* HUD and screens */
export const banner = out('banner');
export const hideBanner = out('hideBanner');
export const hud = out('hud');
export const hudClock = out('hudClock');
export const showRec = out('showRec');
export const feed = out('feed'); // play-by-play line
export const resetSide = out('resetFeed');
export const showTab = out('showTab');
export const showPad = out('showPad'); // touch controls wanted or not
export const uiShow = out('uiShow'); // (id, visible): small HUD pieces such as the replay buttons
export const screen = out('screen'); // (name, data): match start, menu, results, practice, pause
/* online only: face-off cues and results the guest times and checks itself (src/net/match.js) */
export const foCue = out('foCue');
