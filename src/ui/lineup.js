// The line-up panel (menu): your next match's players drawn at their positions on a small rink (tap two skaters
// to swap them), then the skaters with their ratings, a C / W / D choice for each, an automatic best fit and a new
// roster. Optional: game/lineup.js keeps the roster for that match.
import { $ } from '../core/dom';
import { clamp } from '../core/math';
import { GK } from '../game/players';
import { SLOTS, assignSlot, autoLineup, prepareLineup, rerollLineup } from '../game/lineup';

const POS = { C: 'Centre', W: 'Wing', D: 'Defence' };
function pips(v, lo, hi) {
  const n = clamp(Math.round(((v - lo) / (hi - lo)) * 4) + 1, 1, 5);
  let s = '<span class="pips">';
  for (let i = 1; i <= 5; i++) s += `<i class="pip${i <= n ? ' on' : ''}"></i>`;
  return s + '</span>';
}
const stats = p =>
  `<span class="stat">SPD ${pips(p.st.spd, 0.88, 1.1)}</span><span class="stat">SHT ${pips(p.st.sht, 0.8, 1.25)}</span>` +
  `<span class="stat">HND ${pips(p.st.hnd, 0.8, 1.25)}</span><span class="stat">CHK ${pips(p.st.chk, 0.8, 1.3)}</span>`;

// where each position stands on the rink diagram (your net on the left, attacking to the right), in % of the rink
const SPOT = { G: [8, 50], D: [29, 70], C: [50, 46], W: [71, 24] };
let picked = null; // the skater tapped first on the rink, waiting for the one to swap with

function token(p, slot, swap) {
  const el = document.createElement(swap ? 'button' : 'span');
  el.className = 'lutok' + (p === picked ? ' on' : '');
  el.style.setProperty('--x', SPOT[slot][0] + '%');
  el.style.setProperty('--y', SPOT[slot][1] + '%');
  el.innerHTML = `<b>${slot}</b><i>${p.num}</i><span>${p.name}</span>`;
  if (swap) {
    el.setAttribute('aria-pressed', String(p === picked));
    el.setAttribute('aria-label', `${POS[slot]}: #${p.num} ${p.name}`);
    el.title =
      picked && picked !== p ? `Swap with ${picked.name}` : `${POS[slot]}: tap, then tap another to swap`;
    el.addEventListener('click', () => {
      if (!picked || picked === p) picked = picked ? null : p;
      else {
        assignSlot(picked, slot);
        picked = null;
      }
      renderLineup();
    });
  } else el.title = 'Goalie';
  return el;
}

export function renderLineup() {
  const sk = prepareLineup(),
    rink = $('luRink'),
    rows = $('luRows');
  if (picked && !sk.includes(picked)) picked = null; // a new roster
  rink.querySelectorAll('.lutok').forEach(t => t.remove());
  for (const p of sk) rink.appendChild(token(p, p.slot, true));
  rink.appendChild(token(GK[0], 'G', false));
  rows.innerHTML = '';
  for (const p of sk) {
    const row = document.createElement('div');
    row.className = 'lurow' + (p === picked ? ' on' : '');
    row.innerHTML =
      `<span class="luname"><i>#${p.num}</i>${p.name}</span>` +
      `<div class="seg three" role="radiogroup" aria-label="Position of ${p.name}">` +
      SLOTS.map(
        s =>
          `<button role="radio" data-s="${s}" aria-checked="${p.slot === s}" title="${POS[s]}">${s}</button>`,
      ).join('') +
      `</div><span class="lustats">${stats(p)}</span>`;
    row.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => {
        assignSlot(p, b.dataset.s);
        picked = null;
        renderLineup();
      }),
    );
    rows.appendChild(row);
  }
  const g = GK[0],
    gr = document.createElement('div');
  gr.className = 'lurow goalie';
  gr.innerHTML = `<span class="luname"><i>#${g.num}</i>${g.name}</span><span class="lupos">Goalie</span>`;
  rows.appendChild(gr);
}
export function initLineup() {
  $('luAuto').addEventListener('click', () => {
    picked = null;
    prepareLineup();
    autoLineup(0);
    renderLineup();
  });
  $('luRoll').addEventListener('click', () => {
    rerollLineup();
    renderLineup();
  });
}
