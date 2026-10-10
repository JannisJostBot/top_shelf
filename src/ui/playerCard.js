import { $ } from '../core/dom';
import { clamp } from '../core/math';
import { kit } from '../game/kit';
import { G, puck } from '../game/world';

// player card: the skater you control, or the puck carrier when watching
const POS = { C: 'CENTER', W: 'WING', D: 'DEFENSE' };
let cardP = null;
function pips(v, lo, hi) {
  const n = clamp(Math.round(((v - lo) / (hi - lo)) * 4) + 1, 1, 5);
  let s = '<span class="pips">';
  for (let i = 1; i <= 5; i++) s += `<i class="pip${i <= n ? ' on' : ''}"></i>`;
  return s + '</span>';
}
export function updCard() {
  const live = !G.demo && (G.state === 'play' || G.state === 'faceoff');
  let p = null;
  if (live) {
    p = G.ai0 ? (puck.owner && puck.owner.role === 'S' ? puck.owner : cardP) : G.controlled;
  }
  const el = $('pcard');
  if (!p) {
    if (!el.hidden) el.hidden = true;
    cardP = null;
    return;
  }
  if (el.hidden) el.hidden = false;
  if (p === cardP) return;
  cardP = p;
  $('pcNum').textContent = '#' + p.num;
  $('pcName').textContent = p.name;
  $('pcPos').textContent = POS[p.slot] + (G.ai0 ? ' · ' + kit.TEAMS[p.team].name.toUpperCase() : '');
  $('pcStats').innerHTML =
    `<span class="stat"><span>SPD</span>${pips(p.st.spd, 0.88, 1.1)}</span><span class="stat"><span>SHT</span>${pips(p.st.sht, 0.8, 1.25)}</span>` +
    `<span class="stat"><span>HND</span>${pips(p.st.hnd, 0.8, 1.25)}</span><span class="stat"><span>CHK</span>${pips(p.st.chk, 0.8, 1.3)}</span>`;
}
