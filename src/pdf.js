import { jsPDF } from 'jspdf';
import { TYPES, SECTIONS, fieldsFor } from './model.js';
// Standard PDF fonts support Spanish and Western European text. Normalize smart punctuation.
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\u0020-\u00ff\n]/g, '');
export const filename = name => `Informe-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'observacion'}.pdf`;
export function buildPDF(type, draft) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const brand = type === 'united' ? [30, 76, 132] : [21, 50, 63];
  const left = 20, width = 170, bottom = 273;
  let y = 46;
  doc.setProperties({ title: `Informe de ${clean(draft.data.name)}`, subject: TYPES[type].label, creator: 'Scouty' });
  function header(continuation = false) {
    doc.setFillColor(...brand); doc.rect(0, 0, 210, continuation ? 27 : 35, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(TYPES[type].brand, left, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(continuation ? 'INFORME DE OBSERVACION - CONTINUACION' : 'INFORME DE OBSERVACION', left, 23);
    doc.setFontSize(10); doc.text('scouty.', 190, 16, { align: 'right' });
    doc.setTextColor(30, 42, 54); y = continuation ? 39 : 46;
  }
  const ensure = h => { if (y + h > bottom) { doc.addPage(); header(true); } };
  function paragraph(text, size = 10, bold = false, indent = 0) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(text), width - indent);
    for (const line of lines) { ensure(5.5); doc.text(line, left + indent, y); y += size > 13 ? 8 : 5.5; }
  }
  header();
  paragraph(draft.data.name, 21, true); y += 1;
  paragraph(TYPES[type].label, 10); y += 2;
  paragraph(`Partido: ${draft.data.match}`, 11, true); y += 5;
  doc.setDrawColor(210, 218, 222); doc.line(left, y - 2, 190, y - 2);
  y += 4;
  const fields = fieldsFor(type).filter(f => !['name', 'match'].includes(f.key));
  for (let i = 0; i < fields.length; i += 2) {
    const pair = fields.slice(i, i + 2);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const cells = pair.map(f => doc.splitTextToSize(clean(`${f.label}: ${draft.data[f.key] ?? ''}`), 80));
    const h = Math.max(...cells.map(lines => lines.length)) * 4.5 + 4;
    ensure(h);
    cells.forEach((lines, j) => doc.text(lines, left + j * 87, y)); y += h;
  }
  y += 3;
  for (const s of SECTIONS) {
    const value = (draft.report[s.key] || '').trim();
    if (!value) continue;
    ensure(23); doc.setFillColor(239, 243, 244); doc.roundedRect(left, y - 4, width, 9, 1, 1, 'F');
    doc.setTextColor(...brand); paragraph(s.label.toUpperCase(), 10, true, 3); y += 3.5;
    doc.setTextColor(30, 42, 54); paragraph(value); y += 4;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(210, 218, 222); doc.line(left, 281, 190, 281);
    doc.setTextColor(100, 110, 120); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Observaciones de un partido · Documento de uso autorizado', left, 287);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 190, 287, { align: 'right' });
  }
  return doc;
}
