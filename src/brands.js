import { HUNDRA_LOGO, UNITED_LOGO } from './brand-assets.js';

const HUNDRA = {
  name: 'HUNDRA', primary: [0, 0, 0], accent: [0, 0, 0], tint: [245, 245, 245], ink: [26, 26, 26],
  logo: HUNDRA_LOGO, width: 2350, height: 2042, bounds: [530, 225, 1289, 1591],
};
const UNITED = {
  name: 'United Sports Agency', primary: [0, 45, 98], accent: [201, 0, 0], tint: [241, 245, 250], ink: [27, 42, 62],
  logo: UNITED_LOGO, width: 2998, height: 2706, bounds: [308, 160, 2425, 2424],
};
export const brandFor = type => type === 'united' ? UNITED : HUNDRA;
export const reportTheme = type => type === 'united' ? {
  bg:[3,10,23],card:[8,27,49],border:[47,82,122],accent:[244,99,111],secondary:[201,0,0],muted:[164,186,209],text:[239,246,255],
} : {
  bg:[2,8,14],card:[7,25,39],border:[45,107,132],accent:[105,209,242],secondary:[105,209,242],muted:[159,184,201],text:[241,248,253],
};
export function brandLogo(type) {
  const b = brandFor(type);
  // The viewBox removes only empty canvas margins. The original bitmap is intact.
  return `<svg class="report-brand-logo" viewBox="${b.bounds.join(' ')}" role="img" aria-label="Logo de ${b.name}"><image href="${b.logo}" width="${b.width}" height="${b.height}" /></svg>`;
}
export function drawBrandLogo(doc, type, x, y, maxWidth, maxHeight) {
  const b = brandFor(type), [bx, by, bw, bh] = b.bounds;
  const scale = Math.min(maxWidth / bw, maxHeight / bh);
  const offsetX = (maxWidth - bw * scale) / 2, offsetY = (maxHeight - bh * scale) / 2;
  doc.addImage(b.logo, 'PNG', x + offsetX - bx * scale, y + offsetY - by * scale, b.width * scale, b.height * scale, type === 'united' ? 'united-logo' : 'hundra-logo', 'FAST');
}
