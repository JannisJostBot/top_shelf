import './styles/base.css';
import { initSide } from './ui/side';
import './styles/hud.css';
import './styles/rink.css';
import './styles/menu.css';
import './styles/overlays.css';
import './styles/pad.css';
import './styles/motion.css';
import './styles/side.css';
import './styles/program.css';
import { audio } from './audio/engine';
import { chime, playSong } from './audio/music';
import { SFX } from './audio/sfx';
import { NETS } from './config';
import { $ } from './core/dom';
import { frame } from './core/loop';
import { loadPrefs } from './core/storage';
import { DIFF } from './data/difficulty';
import { PUCKS } from './data/pucks';
import { STICKS } from './data/sticks';
import { STADIUMS } from './data/stadiums';
import { COLORS } from './data/teams';
import { startGame, toMenu } from './game/match';
import { bindPresentation } from './bindings';
import { initScreens } from './ui/screens';
import { GK, SK, genRoster, players } from './game/players';
import { startPractice } from './game/practice';
import { passTo, shoot } from './game/puck';
import { ANGLES, beginAngle, endReplay, nextAngle } from './game/replay';
import { startBrawl } from './game/states/brawl';
import { endCelebration } from './game/states/celebrate';
import { faceoff } from './game/states/faceoff';
import { startZamboni } from './game/states/zamboni';
import { update } from './game/update';
import { G, puck, ref } from './game/world';
import { initGamepad } from './input/gamepad';
import { initFullscreen } from './ui/fullscreen';
import { initKeyboard } from './input/keyboard';
import { initMouse } from './input/mouse';
import { input, mouse } from './input/state';
import { applyInputMode, initTouch, touchState } from './input/touch';
import { fit, initCamera } from './render/camera';
import { cam } from './render/canvas';
import { arenaThumbs, drawThumb, ice } from './render/ice';
import { render3D } from './render/mode7';
import { render } from './render/renderer';
import { settings } from './settings';
import { applyColors, initCustomize, setArena, setPuck, setStick } from './ui/customize';
import { hud } from './ui/hud';
import { keymapHTML, padmapHTML } from './ui/keyhint';
import {
  PERIOD_LENGTHS,
  initMenu,
  setCel,
  setCpuStyle,
  setWatchCam,
  setDiff,
  setFights,
  setPeriodLen,
  setVib,
  setFps,
  setView,
  setZam,
  showTab,
} from './ui/menu';
import { drawPreview } from './ui/preview';
import { initReplayBar } from './ui/replayBar';

// the presentation listens to the simulation's events before anything can happen
bindPresentation();
initTouch();
initMouse();
initReplayBar();
initKeyboard();
initGamepad();
initFullscreen();
initScreens();
initCamera();
initSide();
initCustomize();
initMenu();

const pr = loadPrefs();
if (pr.color && COLORS[pr.color]) settings.colorKey = pr.color;
if (pr.diff && DIFF[pr.diff]) settings.diffKey = pr.diff;
if (['close', 'wide', 'arena'].includes(pr.view)) settings.viewMode = pr.view;
if (pr.cpu && (pr.cpu === 'auto' || COLORS[pr.cpu])) settings.cpuKey = pr.cpu;
setPuck(pr.puck && PUCKS[pr.puck] ? pr.puck : 'classic');
setVib(pr.vib !== false);
setFps(pr.fps === true);
setCel(pr.cel !== false);
setFights(pr.fights !== false);
setZam(pr.zam !== false);
setArena(pr.arena && STADIUMS[pr.arena] ? pr.arena : 'frost', false);
applyColors();
genRoster();
setDiff(settings.diffKey);
setPeriodLen(PERIOD_LENGTHS.includes(pr.len) ? pr.len : 60);
setCpuStyle(pr.style);
setWatchCam(pr.wcam);
setStick(0, STICKS[pr.stk0] ? pr.stk0 : 'wood');
setStick(1, STICKS[pr.stk1] ? pr.stk1 : 'wood');
setView(settings.viewMode);
$('keymapMenu').innerHTML = keymapHTML();
$('padmapMenu').innerHTML = padmapHTML();
$('pauseKeys').innerHTML = keymapHTML();
applyInputMode();
setTimeout(() => {
  try {
    if (!$('menu').hidden) arenaThumbs();
  } catch (e) {}
}, 700);
hud();
faceoff();
fit();
requestAnimationFrame(frame);
if (window.__BLB_TEST__)
  window.__BLB_TEST__({
    G,
    puck,
    players,
    SK,
    GK,
    input,
    update,
    render,
    startGame,
    toMenu,
    passTo,
    shoot,
    NETS,
    COLORS,
    applyColors,
    drawPreview,
    endReplay,
    showTab,
    startPractice,
    mouse,
    cam,
    drawThumb,
    iceCanvas: ice,
    arenaThumbs,
    setTouch: v => {
      touchState.touchUI = v;
      applyInputMode();
    },
    ref,
    startBrawl,
    render3D,
    ANGLES,
    startZamboni,
    beginAngle,
    NETSX: NETS,
    endCelebration,
    setCel: on => {
      settings.celOn = on;
    },
    nextAngle,
    setArena,
    setDiff,
    SFX,
    playSong,
    chime,
    audio,
    STADIUMS,
    PUCKS,
    setPuck,
    setCpu: k => {
      settings.cpuKey = k;
      applyColors();
    },
    setColor: k => {
      settings.colorKey = k;
      applyColors();
    },
  });
