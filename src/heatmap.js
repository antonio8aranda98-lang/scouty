import { reportTheme } from './brands.js';
import { HEATMAP_COLUMNS, HEATMAP_LANES, HEATMAP_LEVELS, HEATMAP_ZONES, normalizeHeatmap } from './heatmap-model.js';
export * from './heatmap-model.js';

export function heatmapColors(type) {
  const { card, accent } = reportTheme(type);
  return [0, .24, .52, .9].map(alpha => card.map((channel, i) => Math.round(channel + (accent[i] - channel) * alpha)));
}
export const pitchLines = `<rect x="10" y="10" width="400" height="260" rx="2"/><path d="M210 10v260M10 63h66v154H10M410 63h-66v154h66M10 105h26v70H10M410 105h-26v70h26M10 115H4v50h6M410 115h6v50h-6"/><circle cx="210" cy="140" r="34"/><circle cx="210" cy="140" r="2"/><circle cx="55" cy="140" r="2"/><circle cx="365" cy="140" r="2"/>`;

export function heatmapHTML(type, value, editable = false) {
  const map = normalizeHeatmap(value), colors = heatmapColors(type);
  const variables = colors.map((c, i) => `--map-${i}:rgb(${c.join(',')})`).join(';');
  return `<div class="heatmap-visual" style="${variables}">
    <div class="heatmap-direction"><span>PORTERÍA PROPIA</span><span>Sentido de ataque <b aria-hidden="true">→</b></span><span>PORTERÍA RIVAL</span></div>
    <div class="heatmap-columns">${HEATMAP_COLUMNS.map(c => `<span>${c}</span>`).join('')}</div>
    <div class="heatmap-layout"><div class="heatmap-lanes" aria-hidden="true">${HEATMAP_LANES.map(l => `<span>${l}</span>`).join('')}</div>
      <div class="heatmap-board" ${editable ? 'role="group" aria-label="Zonas de presencia del jugador" aria-describedby="heatmap-help"' : 'role="img" aria-label="Mapa de presencia orientativo. Ataque hacia la derecha."'}>
        <div class="heatmap-cells">${HEATMAP_ZONES.map(z => {
          const level = map[z.index], label = `${z.label}: ${HEATMAP_LEVELS[level]}`;
          return editable ? `<button type="button" class="heatmap-cell" data-zone="${z.index}" data-level="${level}" aria-label="${label}" aria-pressed="${level > 0}"><span>${level || '·'}</span></button>` : `<div class="heatmap-cell" data-level="${level}" aria-hidden="true"><span>${level || '·'}</span></div>`;
        }).join('')}</div>
        <svg class="heatmap-lines" viewBox="0 0 420 280" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">${pitchLines}</svg>
      </div>
    </div>
    <div class="heatmap-legend">${HEATMAP_LEVELS.map((label, i) => `<span><b style="background:var(--map-${i});color:${i === 3 ? '#02080e' : '#f1f8fd'}">${i || '·'}</b>${label}</span>`).join('')}</div>
    ${editable ? '' : `<span class="sr-only">${HEATMAP_ZONES.filter(z => map[z.index]).map(z => `${z.label}: ${HEATMAP_LEVELS[map[z.index]]}`).join('. ')}</span>`}
  </div>`;
}
