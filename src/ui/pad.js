import { $ } from '../core/dom';
import { net } from '../game/online';
import { G, puck } from '../game/world';
import { pad } from '../input/gamepad';
import { mouse } from '../input/state';
import { touchState } from '../input/touch';
import { setHint } from './keyhint';

const sb = $('shootBtn'),
  pb = $('passBtn'),
  swb = $('swBtn');
let lastMouseOn = false,
  lastPadOn = false;
export function updPad() {
  let m = 'off';
  if (!G.ai0) {
    if (G.state === 'zamboni') m = 'zam';
    else if (G.state === 'brawl') m = 'fight';
    else if (G.state === 'faceoff') m = 'fo';
    else if (G.state === 'play') {
      const o = puck.owner;
      if (o && o === G.controlled) m = 'off';
      else if (o && o.team === 1 && o.role === 'S') m = 'def';
      else m = 'loose';
    }
  }
  if (G.state === 'replay' && G.net) m = net.vote.open && !G.fought ? 'replayVote' : 'replayNet';
  else if (G.state === 'replay' || G.state === 'celebrate') m = 'replay';
  else if (!G.ai0 && (G.state === 'goal' || G.state === 'inter')) m = 'idle';
  if (m === touchState.padMode && mouse.on === lastMouseOn && pad.active === lastPadOn) return;
  touchState.padMode = m;
  lastMouseOn = mouse.on;
  lastPadOn = pad.active;
  setHint(m);
  if (m.startsWith('replay') || m === 'idle') return;
  const L = {
    zam: ['HORN', 'FINISH'],
    fight: ['PUNCH', 'BLOCK'],
    off: ['SHOOT', 'PASS'],
    fo: ['DRAW', 'PASS'],
    def: ['POKE', 'CHECK'],
    loose: ['POKE', 'DASH'],
  }[m];
  sb.textContent = L[0];
  pb.textContent = L[1];
  pb.classList.toggle('def', m === 'def' || m === 'loose');
  swb.classList.toggle('dim', m === 'off' || m === 'fo' || m === 'fight' || m === 'zam');
}
