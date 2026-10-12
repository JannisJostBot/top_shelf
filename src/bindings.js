// Connects the simulation's events (game/fx.js) to the presentation: sounds, effects, camera, HUD and screens.
// Called once at startup; a headless run simply never calls it.
import { audio, AC } from './audio/engine';
import { chime, goalMusic, stopSong } from './audio/music';
import { S, strideSounds } from './audio/sfx';
import { setCrowd } from './audio/voices';
import { zamEngine, zamHorn } from './audio/zamboni';
import { on } from './core/events';
import { vib } from './input/haptics';
import { fit, updCam } from './render/camera';
import { view } from './render/canvas';
import { resetDirector } from './render/director';
import { bubble, bubbles, pop, pops, ring, rings } from './render/effects';
import { clearGoalFx, startGoalFx } from './render/goalFx';
import { clearIceDrawing, drawChewedIce, drawPolish, drawScuffs } from './render/iceWear';
import { upd3D } from './render/mode7';
import { clothStep, netHit, resetCloth } from './render/net';
import { settings } from './settings';
import { G } from './game/world';
import { banner, hideBanner, hud, hudClock, showRec } from './ui/hud';
import { showTab } from './ui/menu';
import { showScreen, showPad, uiShow } from './ui/screens';
import { feed, resetSide } from './ui/side';

export function bindPresentation() {
  // sound and feel
  on('sound', S);
  on('strides', strideSounds);
  on('audioUnlock', audio);
  on('crowd', setCrowd);
  on('goalMusic', goalMusic);
  on('stopSong', stopSong);
  on('chime', () => {
    if (AC && !settings.muted)
      try {
        chime();
      } catch (e) {}
  });
  on('haptic', vib);
  on('zamEngine', zamEngine);
  on('zamHorn', zamHorn);
  on('flash', f => (G.flash = f));
  // effects on the ice
  on('pop', pop);
  on('ring', ring);
  on('bubble', bubble);
  on('clearFx', () => {
    pops.length = 0;
    rings.length = 0;
    bubbles.length = 0;
  });
  on('netHit', netHit);
  on('clothStep', clothStep);
  on('resetCloth', resetCloth);
  on('goalFx', startGoalFx);
  on('clearGoalFx', clearGoalFx);
  on('goalLamp', l => (view.lamp = l));
  on('iceClear', clearIceDrawing);
  on('iceScuff', drawScuffs);
  on('iceChew', drawChewedIce);
  on('icePolish', drawPolish);
  // camera
  on('camera', updCam);
  on('camera3d', upd3D);
  on('zoom', z => (view.camZ = z));
  on('resetDirector', resetDirector);
  on('layout', fit);
  // HUD and screens
  on('banner', banner);
  on('hideBanner', hideBanner);
  on('hud', hud);
  on('hudClock', hudClock);
  on('showRec', showRec);
  on('feed', feed);
  on('resetFeed', resetSide);
  on('showTab', showTab);
  on('showPad', showPad);
  on('uiShow', uiShow);
  on('screen', showScreen);
}
