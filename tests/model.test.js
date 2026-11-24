import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldsFor, validate, notesToReport, hasNotes, validateAIReport, SECTIONS } from '../src/model.js';
import { buildPDF, filename } from '../src/pdf.js';
const sample = type => Object.fromEntries(fieldsFor(type).map(f => [f.key, f.type === 'number' ? '0' : f.type === 'select' ? f.options[0] : 'Ejemplo de prueba']));
test('Los tres tipos exigen sus campos específicos y aceptan un cero explícito', () => {
  assert.equal(fieldsFor('hundra').length, 8);
  assert.equal(fieldsFor('scouting').length, 12);
  assert.equal(fieldsFor('united').length, 14);
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
test('PDF de cada modalidad y paginación con observaciones extensas', () => {
  for (const type of ['hundra','scouting','united']) {
    const pdf = buildPDF(type,{data:{...sample(type),name:'María Muñoz Sáez'},report:notesToReport({general:'Observación de prueba. Buen control orientado.'})});
    assert.equal(pdf.getNumberOfPages(),1); assert.ok(pdf.output().startsWith('%PDF-'));
  }
  const pdf = buildPDF('united',{data:sample('united'),report:Object.fromEntries(SECTIONS.map(s=>[s.key,'Control y pase con precisión. '.repeat(250)]))});
  assert.ok(pdf.getNumberOfPages()>3); assert.equal(filename('María Muñoz / Sáez'),'Informe-Maria-Munoz-Saez.pdf');
});
