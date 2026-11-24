import { jsPDF } from 'jspdf';
import { TYPES, SECTIONS, fieldsFor } from './model.js';
import { brandFor, drawBrandLogo } from './brands.js';
// Standard PDF fonts support Spanish and Western European text. Normalize smart punctuation.
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\u0020-\u00ff\n]/g, '');
export const filename = name => `Informe-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'observacion'}.pdf`;
export function buildPDF(type, draft) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const brand = brandFor(type);
  const left = 20, width = 170, bottom = 273;
  let y = 46;
  doc.setProperties({ title: `Informe de ${clean(draft.data.name)}`, subject: TYPES[type].label, creator: 'Scouty' });
  function header(continuation = false) {
    const size = continuation ? 13 : 21, top = continuation ? 7 : 9, rule = continuation ? 26 : 36;
    drawBrandLogo(doc, type, left, top, 22, size);
    doc.setTextColor(...brand.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(continuation ? 13 : 19);
    doc.text(type === 'united' ? 'UNITED' : 'HUNDRA', 48, continuation ? 14 : 19);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    if (type === 'united') doc.text('SPORTS AGENCY', 48, continuation ? 19 : 25);
    doc.setFontSize(8); doc.setTextColor(100, 105, 112);
    doc.text('INFORME DE OBSERVACION', 190, continuation ? 13 : 18, {align:'right'});
    doc.setFontSize(7); doc.text(continuation ? 'CONTINUACION' : type === 'hundra' ? 'SEGUIMIENTO' : 'CAPTACION', 190, continuation ? 19 : 24, {align:'right'});
    doc.setFillColor(...brand.primary); doc.rect(left, rule, width, 0.9, 'F');
    if (type === 'united') { doc.setFillColor(...brand.accent); doc.rect(162, rule, 28, 0.9, 'F'); }
    doc.setTextColor(...brand.ink); y = continuation ? 37 : 48;
  }
  const ensure = h => { if (y + h > bottom) { doc.addPage(); header(true); } };
  function paragraph(text, size = 10, bold = false, indent = 0) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(text), width - indent);
    for (const line of lines) { ensure(size > 13 ? 9 : 5.5); doc.text(line, left + indent, y); y += size > 13 ? 9 : 5.5; }
  }
  header();
  paragraph(draft.data.name, 23, true); y += 1;
  doc.setTextColor(106, 112, 120); paragraph(TYPES[type].label, 9); y += 2;
  doc.setTextColor(...brand.ink); paragraph(`Partido: ${draft.data.match}`, 10); y += 5;
  const stats = [['minutes','MINUTOS'], ['goals','GOLES'], ['assists','ASISTENCIAS'], ['saves','PARADAS'], ['rating','NOTA MEDIA']];
  ensure(24); doc.setFillColor(...brand.tint); doc.roundedRect(left, y - 3, width, 21, 1, 1, 'F');
  stats.forEach(([key,label], i) => {
    const center = left + width / stats.length * (i + .5);
    doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.setTextColor(...brand.primary);
    doc.text(clean(draft.data[key]) + (key === 'rating' ? '/10' : ''), center, y + 5, {align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100, 108, 117); doc.text(label, center, y + 12, {align:'center'});
    if(i < stats.length-1) { doc.setDrawColor(218, 223, 229); doc.line(left + width / stats.length * (i + 1), y + 2, left + width / stats.length * (i + 1), y + 12); }
  });
  y += 26;
  const fields = fieldsFor(type).filter(f => !['name', 'match', ...stats.map(s=>s[0])].includes(f.key));
  for (let i = 0; i < fields.length; i += 2) {
    const pair = fields.slice(i, i + 2);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    const cells = pair.map(f => doc.splitTextToSize(clean(draft.data[f.key] ?? ''), 80));
    const h = Math.max(...cells.map(lines => lines.length)) * 4.5 + 5.5;
    ensure(h);
    cells.forEach((lines, j) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(109, 114, 122); doc.text(clean(pair[j].label.toUpperCase()), left + j * 87, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...brand.ink); doc.text(lines, left + j * 87, y + 4.5);
    }); y += h;
  }
  y += 3;
  for (const s of SECTIONS) {
    const value = (draft.report[s.key] || '').trim();
    if (!value) continue;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    const firstLines = Math.min(2, doc.splitTextToSize(clean(value), width).length);
    ensure(12.5 + firstLines * 5.5); doc.setFillColor(...brand.tint); doc.rect(left, y - 4, width, 8, 'F');
    doc.setFillColor(...brand.accent); doc.rect(left, y - 4, 1.2, 8, 'F');
    doc.setTextColor(...brand.primary); paragraph(s.label.toUpperCase(), 9, true, 4); y += 3;
    doc.setTextColor(...brand.ink); paragraph(value); y += 4;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(...brand.primary); doc.setLineWidth(.25); doc.line(left, 281, 190, 281);
    if(type === 'united') { doc.setDrawColor(...brand.accent); doc.line(175,281,190,281); }
    doc.setTextColor(100, 110, 120); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`${type === 'united' ? 'United Sports Agency' : 'HUNDRA'} · Observaciones de un partido · Uso autorizado`, left, 287);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 190, 287, { align: 'right' });
  }
  return doc;
}
