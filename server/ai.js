import { createHash, timingSafeEqual } from 'node:crypto';
import { AI_INSTRUCTIONS, TYPES, SECTIONS, fieldsFor, validate, hasNotes, validateAIReport } from '../src/model.js';

export class PublicError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const digest = value => createHash('sha256').update(value).digest();
export function parseCodes(raw = '') {
  if (!raw) return [];
  let entries;
  try { entries = JSON.parse(raw); } catch { throw new Error('ACCESS_CODES debe ser un objeto JSON válido.'); }
  if (!object(entries) || !Object.keys(entries).length || Object.keys(entries).length > 100) throw new Error('ACCESS_CODES requiere de 1 a 100 accesos.');
  const seen = new Set();
  return Object.entries(entries).map(([id, code]) => {
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(id) || typeof code !== 'string' || code.length < 16 || code.length > 200 || seen.has(code)) throw new Error('Cada código de acceso debe ser único y tener entre 16 y 200 caracteres.');
    seen.add(code); return { id, hash: digest(code) };
  });
}
export function authenticate(header, codes) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ') || header.length > 210) return null;
  const supplied = digest(header.slice(7));
  let identity = null;
  for (const c of codes) if (timingSafeEqual(supplied, c.hash)) identity = c.id;
  return identity;
}
export function validatePayload(input) {
  if (!object(input) || input.version !== 1 || !Object.hasOwn(TYPES, input.type) || !object(input.data) || !object(input.notes)) throw new PublicError(400, 'La solicitud de informe no es válida.');
  const data = {}, notes = {};
  for (const f of fieldsFor(input.type)) {
    const v = input.data[f.key];
    if (!['string', 'number'].includes(typeof v) || String(v).length > 250) throw new PublicError(400, 'Revisa los datos del partido.');
    data[f.key] = String(v).trim();
  }
  if (validate(input.type, data).length) throw new PublicError(400, 'Revisa los campos obligatorios y sus valores.');
  for (const s of SECTIONS) {
    const v = input.notes[s.key] ?? '';
    if (typeof v !== 'string' || v.length > 12000) throw new PublicError(400, 'Cada apartado admite hasta 12.000 caracteres.');
    notes[s.key] = v.trim();
  }
  if (!hasNotes(notes) || Object.values(notes).join('').length > 40000) throw new PublicError(400, 'Añade observaciones, con un máximo de 40.000 caracteres en total.');
  return { type: input.type, data, notes };
}
export function providerPayload(payload, model) {
  // Names, clubs, studies and match identifiers are unnecessary for drafting the narrative.
  const allowed = ['category', 'starter', 'minutes', 'goals', 'assists', 'saves', 'rating', 'level'];
  const sportingData = Object.fromEntries(allowed.filter(k => Object.hasOwn(payload.data, k)).map(k => [k, payload.data[k]]));
  return {
    model, store: false, max_output_tokens: 3000, reasoning: { effort: 'none' },
    instructions: `${AI_INSTRUCTIONS} Redacta párrafos completos y bien conectados, sin enumeraciones repetitivas. No repitas la ficha estadística en todos los apartados. Refierete a la persona como ${payload.type === 'united' ? 'la jugadora' : 'el jugador'}. Si las notas son escasas, el informe será breve. Una clasificación de nivel aportada por el colaborador es su valoración, no una decisión automatizada sobre becas o fichajes.`,
    input: JSON.stringify({ reportType: TYPES[payload.type].label, data: sportingData, notes: payload.notes }),
    text: { format: { type: 'json_schema', name: 'scouty_report', strict: true, schema: {
      type: 'object', properties: { report: {
        type: 'object', properties: Object.fromEntries(SECTIONS.map(s => [s.key, { type: 'string' }])),
        required: SECTIONS.map(s => s.key), additionalProperties: false,
      } }, required: ['report'], additionalProperties: false,
    } } },
  };
}
export async function generateReport(payload, { apiKey, model, fetchImpl = fetch, signal, onProviderError = () => {} }) {
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(providerPayload(payload, model)), signal,
  });
  if (!response.ok) {
    // Never relay provider bodies: they can contain private data or configuration details.
    const detail = await response.json().catch(() => ({}));
    const code = typeof detail.error?.code === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(detail.error.code) ? detail.error.code : 'unspecified';
    const param = typeof detail.error?.param === 'string' && /^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(detail.error.param) ? detail.error.param : null;
    onProviderError({ status: response.status, code, param });
    if (response.status === 401) throw new PublicError(503, 'OpenAI no acepta la clave configurada. Antonio debe revisar OPENAI_API_KEY en el servidor.');
    if (response.status === 403 || response.status === 404) throw new PublicError(503, 'El proyecto de OpenAI no tiene acceso al modelo configurado. Antonio debe revisar los permisos y el modelo.');
    if (response.status === 429) throw new PublicError(503, 'OpenAI no puede atender la solicitud. Antonio debe revisar el saldo y los límites del servicio.');
    throw new PublicError(502, 'No se pudo redactar el informe con OpenAI. Tus notas se conservan.');
  }
  const result = await response.json();
  if (result.status !== 'completed') throw new PublicError(502, 'La redacción no se ha completado. Reduce las notas o vuelve a intentarlo.');
  const content = (Array.isArray(result.output) ? result.output : []).filter(i => i.type === 'message').flatMap(i => Array.isArray(i.content) ? i.content : []);
  if (content.some(c => c.type === 'refusal')) throw new PublicError(422, 'No se pudo redactar este contenido. Revisa las notas del partido.');
  const output = content.filter(c => c.type === 'output_text' && typeof c.text === 'string').map(c => c.text).join('');
  try { return validateAIReport(JSON.parse(output).report); }
  catch { throw new PublicError(502, 'OpenAI ha devuelto un formato no válido. Tus notas se conservan.'); }
}
export function createLimiter({ perHour = 10, perDay = 30, totalPerDay = 100, clock = Date.now } = {}) {
  const users = new Map(); let total = { day: '', count: 0 }, active = 0;
  return {
    reserve(id) {
      const now = clock(), day = new Date(now).toISOString().slice(0, 10), hour = Math.floor(now / 3600000);
      if (total.day !== day) { total = { day, count: 0 }; users.clear(); }
      const user = users.get(id) || { day, hour, daily: 0, hourly: 0 };
      if (user.hour !== hour) { user.hour = hour; user.hourly = 0; }
      if (user.daily >= perDay || user.hourly >= perHour || total.count >= totalPerDay) throw new PublicError(429, 'Se ha alcanzado el límite de generación. Conserva tus notas y vuelve a intentarlo más tarde.');
      if (active >= 2) throw new PublicError(429, 'Hay otros informes en proceso. Espera un momento y vuelve a intentarlo.');
      user.daily++; user.hourly++; total.count++; active++; users.set(id, user);
      let released = false;
      return () => { if (!released) { active--; released = true; } };
    },
  };
}
