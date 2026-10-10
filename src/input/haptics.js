import { G } from '../game/world';
import { padRumble } from './gamepad';
import { settings } from '../settings';

/* ---------- feedback: vibration, floating labels, impact rings ---------- */

export function vib(pat) {
  if (!settings.vibOn || G.demo || G.ai0) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pat);
  } catch (e) {}
  // controllers rumble for the total length of the pattern
  const ms = Array.isArray(pat) ? pat.reduce((a, b) => a + b, 0) : pat;
  padRumble(Math.min(ms, 400), 0.7);
}
