import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldsFor, validate, notesToReport, hasNotes, validateAIReport, combineNotes, emptyDraft, SECTIONS } from '../src/model.js';
import { buildPDF, filename } from '../src/pdf.js';
import { emptyHeatmap, normalizeHeatmap, hasHeatmap, nextHeatmapLevel, HEATMAP_ZONES } from '../src/heatmap-model.js';
const sample = type => Object.fromEntries(fieldsFor(type).map(f => [f.key, f.key === 'result' ? '2-1' : f.type === 'number' ? '0' : f.type === 'select' ? f.options[0] : 'Ejemplo de prueba']));
test('Los tres tipos exigen sus campos específicos y aceptan un cero explícito', () => {
  assert.equal(fieldsFor('hundra').length, 9);
  assert.equal(fieldsFor('scouting').length, 13);
  assert.equal(fieldsFor('united').length, 15);
  for (const type of ['hundra','scouting','united']) {
    const data = sample(type); assert.deepEqual(validate(type, data), []);
    for (const f of fieldsFor(type)) assert.ok(validate(type, {...data, [f.key]: ''}).includes(f.key));
  }
});
test('Rechaza notas fuera de rango, estadísticas negativas, fracciones y opciones inválidas', () => {
  const data = sample('united');
  for (const [key, value] of [['rating','10.1'],['rating','7.77'],['goals','-1'],['minutes','3.5'],['saves','NaN'],['starter','Otro'],['level','Muy alto']]) assert.ok(validate('united', {...data, [key]:value}).includes(key));
  assert.deepEqual(validate('united', {...data, rating:'7.5'}), []);
});
test('El borrador conserva las notas sin inventar observaciones', () => {
  const report = notesToReport({general:' Buen pase. ',tactics:'',strengths:'Sostiene la posesión.'});
  assert.equal(report.general,'Buen pase.'); assert.equal(report.physical,''); assert.ok(hasNotes(report)); assert.ok(!hasNotes({general:'  '}));
});
test('La respuesta de IA debe ser completa, textual y no vacía', () => {
  assert.throws(() => validateAIReport({general:'Texto'}));
  assert.throws(() => validateAIReport(notesToReport({})));
  const valid = notesToReport({general:'Informe observado.'}); assert.deepEqual(validateAIReport(valid), valid);
});
test('Las notas de borradores anteriores se reúnen sin perder contenido', () => {
  assert.equal(combineNotes({general:'Notas mezcladas',tactics:'Apoyos interiores',improvements:'Mirar antes'}), 'Notas mezcladas\n\nTÁCTICA\nApoyos interiores\n\nASPECTOS DE MEJORA\nMirar antes');
  assert.equal(combineNotes({general:'Todo junto'}),'Todo junto');
  assert.equal(combineNotes({}),'');
});
test('Mapa opcional: borradores antiguos, datos dañados y doce zonas sin valores inventados', () => {
  assert.deepEqual(normalizeHeatmap(undefined),emptyHeatmap());
  assert.deepEqual(normalizeHeatmap({0:3}),emptyHeatmap());
  assert.deepEqual(normalizeHeatmap([3,2,1,-1,4,'3',NaN,null]),[3,2,1,0,0,0,0,0,0,0,0,0]);
  assert.equal(hasHeatmap(emptyHeatmap()),false); assert.equal(hasHeatmap([0,2]),true);
  assert.equal(HEATMAP_ZONES.length,12);
  const a=emptyDraft(),b=emptyDraft(); a.heatmap[7]=3;
  assert.equal(b.heatmap[7],0); assert.equal(normalizeHeatmap(JSON.parse(JSON.stringify(a)).heatmap)[7],3);
  let level=0; for(const expected of [1,2,3,0]) { level=nextHeatmapLevel(level);assert.equal(level,expected); }
});
test('PDF de cada modalidad y paginación con observaciones extensas', () => {
  for (const type of ['hundra','scouting','united']) {
    const pdf = buildPDF(type,{data:{...sample(type),name:'María Muñoz Sáez'},report:notesToReport({general:'Observación de prueba. Buen control orientado.'})});
    assert.equal(pdf.getNumberOfPages(),1); assert.ok(pdf.output().startsWith('%PDF-'));
    const mapped = buildPDF(type,{data:{...sample(type),name:'María Muñoz Sáez'},heatmap:[0,1,3,2,0,0,1,3,0,1,2,0],report:notesToReport({general:'He observado un buen control orientado.'})});
    assert.equal(mapped.getNumberOfPages(),1); assert.ok(mapped.output().startsWith('%PDF-'));
  }
  const pdf = buildPDF('united',{data:sample('united'),report:Object.fromEntries(SECTIONS.map(s=>[s.key,'Control y pase con precisión. '.repeat(250)]))});
  assert.ok(pdf.getNumberOfPages()>3); assert.equal(filename('María Muñoz / Sáez'),'Informe-Maria-Munoz-Saez.pdf');
});
