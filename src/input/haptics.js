import { G } from '../game/world';
import { settings } from '../settings';

/* ---------- feedback: vibration, floating labels, impact rings ---------- */

export function vib(pat) {
  if (!settings.vibOn || G.demo || G.ai0) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pat);
  } catch (e) {}
}
