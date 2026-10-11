// The line-up panel (menu): the skaters of your next match with their ratings, a C / W / D choice for each, an
// automatic best fit and a new roster. Optional: game/lineup.js keeps the roster for that match.
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

export function renderLineup() {
  const sk = prepareLineup(),
    rows = $('luRows');
  rows.innerHTML = '';
  for (const p of sk) {
    const row = document.createElement('div');
    row.className = 'lurow';
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
    prepareLineup();
    autoLineup(0);
    renderLineup();
  });
  $('luRoll').addEventListener('click', () => {
    rerollLineup();
    renderLineup();
  });
}
