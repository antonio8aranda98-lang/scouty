import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { validatePayload, providerPayload, generateReport, createLimiter } from '../server/ai.js';
import { createApp, configFromEnv } from '../server/index.js';
import { fieldsFor, notesToReport } from '../src/model.js';

const fixture = type => ({ version: 1, type, data: Object.fromEntries(fieldsFor(type).map(f => [f.key, f.key === 'result' ? '2-1' : f.type === 'number' ? '0' : f.type === 'select' ? f.options[0] : 'Dato ficticio'])), notes: { general: 'En el minuto 23 superó una línea con un pase. Después del descanso perdió presencia.' } });
const report = notesToReport({ general: 'He observado que participaste en la elaboración y completaste un pase que superó una línea en el minuto 23.' });
const success = () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ report }) }] }] }), { status: 200 });

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
  assert.match(request.instructions, /primera persona del singular/);
  assert.match(request.instructions, /segunda persona del singular/);
  assert.ok(!request.instructions.includes('Refiérete a la persona como'));
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
test('Cuotas públicas compartidas por hora y día; concurrencia y reinicio del día', () => {
  let now = Date.UTC(2026, 10, 24, 10);
  const limiter = createLimiter({ perHour: 4, perDay: 5, clock: () => now });
  const a = limiter.reserve(), b = limiter.reserve();
  assert.throws(() => limiter.reserve(), /otros informes/); a(); a(); b();
  limiter.reserve()(); limiter.reserve()(); assert.throws(() => limiter.reserve(), /límite de generación/);
  now += 3600000; limiter.reserve()(); assert.throws(() => limiter.reserve(), /límite de generación/);
  now += 24 * 3600000; limiter.reserve()();
});
test('HTTP público sin código: CORS, datos inválidos, cuota, timeout y éxito del adaptador', async t => {
  let calls = 0;
  const config = { origins: ['https://scouty.example'], apiKey: 'fake-test-key', model: 'gpt-6.1-terra' };
  const app = createApp({ config, fetchImpl: async () => { calls++; return success(); } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening'); t.after(() => app.close());
  const url = `http://127.0.0.1:${app.address().port}`, headers = { 'Content-Type': 'application/json', Origin: 'https://scouty.example' };
  assert.deepEqual(await (await fetch(url + '/health')).json(), {ok: true, aiReady: true});
  let response = await fetch(url + '/reports', {method: 'OPTIONS', headers: { Origin: 'https://scouty.example' }});
  assert.equal(response.status,204); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://scouty.example');
  response = await fetch(url + '/reports', {method:'POST', headers: {'Content-Type':'application/json'}, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,200); assert.equal(calls,1);
  response = await fetch(url + '/reports', {method:'POST', headers:{...headers,Origin:'https://untrusted.example'}, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,403);
  response = await fetch(url + '/reports', {method:'POST', headers, body:'{broken'}); assert.equal(response.status,400);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify({notes:'x'.repeat(200000)})}); assert.equal(response.status,413);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify({...fixture('hundra'),data:{}})}); assert.equal(response.status,400);
  assert.equal(calls,1);
  response = await fetch(url + '/reports', {method:'POST', headers, body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,200); assert.deepEqual(await response.json(),{report}); assert.equal(calls,2);
  const limitedApp = createApp({config, limiter:createLimiter({perHour:1}), fetchImpl:async()=>success()});
  limitedApp.listen(0,'127.0.0.1'); await once(limitedApp,'listening'); t.after(()=>limitedApp.close());
  const limitedUrl=`http://127.0.0.1:${limitedApp.address().port}/reports`;
  assert.equal((await fetch(limitedUrl,{method:'POST',headers,body:JSON.stringify(fixture('hundra'))})).status,200);
  response=await fetch(limitedUrl,{method:'POST',headers,body:JSON.stringify(fixture('united'))}); assert.equal(response.status,429);
  assert.equal(response.headers.get('Retry-After'),'3600');
  const timeoutApp = createApp({config,timeoutMs:5,fetchImpl: async (_,options) => { await once(options.signal,'abort'); throw options.signal.reason; }});
  timeoutApp.listen(0,'127.0.0.1'); await once(timeoutApp,'listening'); t.after(()=>timeoutApp.close());
  response = await fetch(`http://127.0.0.1:${timeoutApp.address().port}/reports`,{method:'POST',headers,body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,504);
  const inactive = createApp({config:configFromEnv({})}); inactive.listen(0,'127.0.0.1'); await once(inactive,'listening'); t.after(()=>inactive.close());
  response = await fetch(`http://127.0.0.1:${inactive.address().port}/reports`,{method:'POST',headers:{...headers,Origin:'https://antonio8aranda98-lang.github.io'},body:JSON.stringify(fixture('hundra'))}); assert.equal(response.status,503);
});
