export const HEATMAP_LEVELS = ['Sin marcar', 'Baja', 'Media', 'Alta'];
export const HEATMAP_COLUMNS = ['Defensa', 'Salida', 'Creación', 'Finalización'];
export const HEATMAP_LANES = ['Izquierda', 'Centro', 'Derecha'];
export const HEATMAP_ZONES = Array.from({ length: 12 }, (_, i) => ({
  index: i, row: Math.floor(i / 4), column: i % 4,
  label: `${HEATMAP_COLUMNS[i % 4]} · ${HEATMAP_LANES[Math.floor(i / 4)].toLowerCase()}`,
}));
export const emptyHeatmap = () => Array(12).fill(0);
export function normalizeHeatmap(value) {
  return Array.from({ length: 12 }, (_, i) => Array.isArray(value) && Number.isInteger(value[i]) && value[i] >= 0 && value[i] <= 3 ? value[i] : 0);
}
export const hasHeatmap = value => normalizeHeatmap(value).some(Boolean);
export const nextHeatmapLevel = level => (Number.isInteger(level) && level >= 0 && level < 3 ? level + 1 : 0);
