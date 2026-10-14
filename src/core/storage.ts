import { settings } from '../settings';

export type Records = Record<string, { w: number; l: number }>;

export function loadRec(): Records {
  try {
    return JSON.parse(localStorage.getItem('blb-rec') || '{}') || {};
  } catch (e) {
    return {};
  }
}
export function saveRec(r: Records) {
  try {
    localStorage.setItem('blb-rec', JSON.stringify(r));
  } catch (e) {}
}

/** Best share of the ice polished in the resurfacer minigame, in percent. */
export function loadBest(): number {
  try {
    return +(localStorage.getItem('blb-zam') || 0) || 0;
  } catch (e) {
    return 0;
  }
}
export function saveBest(pct: number) {
  try {
    localStorage.setItem('blb-zam', String(pct));
  } catch (e) {}
}
/** Best number of goals in one minute of the aim trainer, kept apart for the still and the moving gap. */
export function loadAimBest(moving = false): number {
  try {
    return +(localStorage.getItem(moving ? 'blb-aim-moving' : 'blb-aim') || 0) || 0;
  } catch (e) {
    return 0;
  }
}
export function saveAimBest(n: number, moving = false) {
  try {
    localStorage.setItem(moving ? 'blb-aim-moving' : 'blb-aim', String(n));
  } catch (e) {}
}
export function loadPrefs(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('blb-prefs') || '{}') || {};
  } catch (e) {
    return {};
  }
}
export function savePrefs() {
  try {
    localStorage.setItem(
      'blb-prefs',
      JSON.stringify({
        color: settings.colorKey,
        cpu: settings.cpuKey,
        diff: settings.diffKey,
        view: settings.viewMode,
        arena: settings.stadiumKey,
        vib: settings.vibOn,
        cel: settings.celOn,
        fights: settings.fightsOn,
        zam: settings.zamOn,
        puck: settings.puckKey,
        len: settings.periodLen,
        style: settings.cpuStyle,
        stk0: settings.sticks[0],
        stk1: settings.sticks[1],
        wcam: settings.watchCam,
        fps: settings.fps,
        od: settings.overdrive,
        muted: settings.muted,
      }),
    );
  } catch (e) {}
}
