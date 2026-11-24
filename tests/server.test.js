import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseCodes, authenticate, validatePayload, providerPayload, generateReport, createLimiter } from '../server/ai.js';
import { createApp, configFromEnv } from '../server/index.js';
import { fieldsFor, notesToReport } from '../src/model.js';

const code = 'test-only-access-code-123456';
const codes = parseCodes(JSON.stringify({ tester: code }));
const fixture = type => ({ version: 1, type, data: Object.fromEntries(fieldsFor(type).map(f => [f.key, f.type === 'number' ? '0' : f.type === 'select' ? f.options[0] : 'Dato ficticio'])), notes: { general: 'En el minuto 23 superó una línea con un pase. Después del descanso perdió presencia.' } });
const report = notesToReport({ general: 'Participó en la elaboración y completó un pase que superó una línea en el minuto 23.' });
const success = () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ report }) }] }] }), { status: 200 });

test('Códigos revocables, únicos y comparados por su hash', () => {
  assert.equal(authenticate('Bearer ' + code, codes), 'tester');
  assert.equal(authenticate('Bearer incorrecto', codes), null);
  assert.equal(authenticate(undefined, codes), null);
  assert.throws(() => parseCodes('{broken'));
  assert.throws(() => parseCodes('{"test":"short"}'));
  assert.throws(() => parseCodes(JSON.stringify({ a: code, b: code })));
  assert.ok(!JSON.stringify(codes).includes(code));
});
test('Validación del servidor en las tres modalidades y rechazo de tipos manipulados', () => {
  for (const type of ['hundra', 'scouting', 'united']) assert.equal(validatePayload(fixture(type)).type, type);
  for (const type of ['__proto__', 'constructor', 'inventado']) assert.throws(() => validatePayload({ ...fixture('hundra'), type }));
  const data = fixture('united');
  assert.throws(() => validatePayload({ ...data, data: { ...data.data, minutes: [] } }));
  assert.throws(() => validatePayload({ ...data, data: { ...data.data, rating: '11' } }));
  assert.throws(() => validatePayload({ ...data, notes: { general: 123 } }));
  assert.equal(validatePayload({ ...data, notes: { general: 'x'.repeat(40000) } }).notes.general.length, 40000);
  assert.throws(() => validatePayload({ ...data, notes: { general: 'x'.repeat(40001) } }));
  assert.throws(() => validatePayload({ ...data, notes: { tactics: 'x'.repeat(12001) } }));
  assert.throws(() => validatePayload({ ...data, notes: { general: ' ' } }));
  assert.throws(() => validatePayload({ ...data, notes: { general: 'x'.repeat(11000), tactics: 'x'.repeat(11000), technique: 'x'.repeat(11000), physical: 'x'.repeat(11000) } }));
});
test('La petición a OpenAI omite identidad de la ficha y desactiva almacenamiento de respuestas', () => {
  const payload = fixture('united'); payload.data.name = 'Nombre que no se debe enviar'; payload.data.studies = 'Estudios privados';
  const request = providerPayload(validatePayload(payload), 'gpt-6.1-terra');
  assert.equal(request.store, false); assert.equal(request.max_output_tokens, 3000);
  assert.ok(!request.input.includes(payload.data.name)); assert.ok(!request.input.includes(payload.data.studies));
  assert.equal(request.text.format.strict, true); assert.equal(request.text.format.schema.additionalProperties, false);
  assert.ok(request.input.includes(payload.notes.general));
});
test('Respuestas correctas, negativas, incompletas y errores del proveedor', async () => {
  const options = { apiKey: 'fake-key', model: 'gpt-6.1-terra', fetchImpl: async () => success() };
  assert.deepEqual(await generateReport(validatePayload(fixture('hundra')), options), report);
  for (const result of [
    { status: 'incomplete' },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }] },
  ]) await assert.rejects(generateReport(validatePayload(fixture('hundra')), { ...options, fetchImpl: async () => new Response(JSON.stringify(result)) }));
  await assert.rejects(generateReport(validatePayload(fixture('hundra')), { ...options, fetchImpl: async () => new Response('SECRET PROVIDER DETAILS', {status: 401}) }), err => !err.message.includes('SECRET'));
});
test('Límites por colaborador, día y concurrencia; los intentos con fallo también consumen cuota', () => {
  let now = Date.UTC(2026, 10, 24, 10);
  const limiter = createLimiter({ perHour: 2, perDay: 3, totalPerDay: 4, clock: () => now });
  const a = limiter.reserve('a'), b = limiter.reserve('b');
  assert.throws(() => limiter.reserve('c')); a(); a(); b();
  limiter.reserve('a')(); assert.throws(() => limiter.reserve('a'));
  now += 3600000; limiter.reserve('a')(); assert.throws(() => limiter.reserve('a')); assert.throws(() => limiter.reserve('b'));
  now += 24 * 3600000; limiter.reserve('a')();
});
test('HTTP: autenticación, CORS, datos inválidos, errores, timeout y éxito real del adaptador', async t => {
  let calls = 0;
  const config = { origins: ['https://scouty.example'], codes, apiKey: 'fake-test-key', model: 'gpt-6.1-terra' };
  const app = createApp({ config, fetchImpl: async () => { calls++; return success(); } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening'); t.after(() => app.close());
  const url = `http://127.0.0.1:${app.address().port}`, headers = { Authorization: 'Bearer ' + code, 'Content-Type': 'application/json', Origin: 'https://scouty.example' };
  assert.deepEqual(await (await fetch(url + '/health')).json(), {ok: true, aiReady: true});
  let response = await fetch(url + '/reports', {method: 'OPTIONS', headers: { Origin: 'https://scouty.example' }});
  assert.equal(response.status,204); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://scouty.example');
  response = await fetch(url + '/reports', {method:'POST', headers: {'Content-Type':'application/json'}, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,401);
  response = await fetch(url + '/reports', {method:'POST', headers:{...headers,Origin:'https://untrusted.example'}, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,403);
  response = await fetch(url + '/reports', {method:'POST', headers, body:'{broken'}); assert.equal(response.status,400);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify({notes:'x'.repeat(200000)})}); assert.equal(response.status,413);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify({...fixture('hundra'),data:{}})}); assert.equal(response.status,400);
  assert.equal(calls,0);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,200); assert.deepEqual(await response.json(),{report}); assert.equal(calls,1);
  const timeoutApp = createApp({config,timeoutMs:5,fetchImpl: async (_,options) => { await once(options.signal,'abort'); throw options.signal.reason; }});
  timeoutApp.listen(0,'127.0.0.1'); await once(timeoutApp,'listening'); t.after(()=>timeoutApp.close());
  response = await fetch(`http://127.0.0.1:${timeoutApp.address().port}/reports`,{method:'POST',headers,body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,504);
  const inactive = createApp({config:configFromEnv({})}); inactive.listen(0,'127.0.0.1'); await once(inactive,'listening'); t.after(()=>inactive.close());
  response = await fetch(`http://127.0.0.1:${inactive.address().port}/reports`,{method:'POST',headers:{...headers,Origin:'https://antonio8aranda98-lang.github.io'},body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,503);
});
