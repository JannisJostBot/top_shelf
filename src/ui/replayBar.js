import { $ } from '../core/dom';
import { endReplay, nextAngle } from '../game/replay';
import { endCelebration } from '../game/states/celebrate';
import { endIntro } from '../game/states/intro';
import { G } from '../game/world';

export function initReplayBar() {
  $('skipBtn').addEventListener('click', () => {
    if (G.state === 'replay') endReplay();
    else if (G.state === 'celebrate') endCelebration();
    else if (G.state === 'intro') endIntro();
  });
  $('angleBtn').addEventListener('click', nextAngle);
}
