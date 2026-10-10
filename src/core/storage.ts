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
      }),
    );
  } catch (e) {}
}
