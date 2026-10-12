// Arena intro: a few seconds of 3D camera flight through the arena before the opening face-off, different in
// every arena (render/intro.js films it). Shoot, Pass, Switch, a tap or the SKIP button cut it short. Skipped for
// players who asked for reduced motion.
import { STADIUMS } from '../../data/stadiums';
import { clock } from '../../core/time';
import { input } from '../../input/state';
import { reduceMotion, settings } from '../../settings';
import { banner, hideBanner, setCrowd, uiShow } from '../fx';
import { faceoff } from './faceoff';
import { G } from '../world';

/** Length of an arena intro, in seconds. */
export const INTRO_LEN = 4.2;

/** Starts the arena intro (or goes straight to the face-off when intros are skipped). */
export function startIntro() {
  if (reduceMotion) {
    faceoff();
    return;
  }
  const S = STADIUMS[settings.stadiumKey] || STADIUMS.frost;
  faceoff(); // the players line up for the opening draw, and the intro films them there
  G.state = 'intro';
  input.sp = input.pp = input.swp = input.sr = false;
  G.intro = { t: 0, t0: clock.now, key: settings.stadiumKey };
  G.bannerT = 0;
  banner(S.name.toUpperCase(), 'alert', 'Home of the ' + S.team);
  G.bannerT = INTRO_LEN - 0.4;
  uiShow('rpBar', true);
  uiShow('angleBtn', false);
  setCrowd(0.09); // the crowd is up for the teams coming out
}
export function introStep(dt) {
  const I = G.intro;
  I.t += dt;
  // (the click or key that started the match must not skip its intro: input only counts after a moment)
  const skip = I.t > 0.4 && (input.sp || input.pp || input.swp);
  input.sp = input.pp = input.swp = input.sr = false;
  if (skip || I.t >= INTRO_LEN) endIntro();
}
export function endIntro() {
  if (G.state !== 'intro') return;
  G.intro = null;
  hideBanner();
  uiShow('rpBar', false);
  uiShow('angleBtn', true);
  setCrowd(0.05);
  faceoff();
}
