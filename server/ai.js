import { AI_INSTRUCTIONS, TYPES, SECTIONS, fieldsFor, validate, hasNotes, validateAIReport } from '../src/model.js';

export class PublicError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
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
    const max = s.key === 'general' ? 40000 : 12000;
    if (typeof v !== 'string' || v.length > max) throw new PublicError(400, `Las notas generales admiten 40.000 caracteres; los apartados anteriores, 12.000.`);
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
    instructions: `${AI_INSTRUCTIONS}
El colaborador pega todas sus notas mezcladas en un único campo: léelas en conjunto, identifica los hechos y organízalos tú en los siete apartados del esquema. No pidas que clasifique las notas.
Escribe un informe de observación con una lectura coherente del partido, no una transcripción de apuntes ni una cronología de acciones sueltas. Usa un tono de analista deportivo profesional, natural, preciso y constructivo, apto para compartir con la familia. Conecta observaciones relacionadas sin inventar explicaciones ni vínculos causales. Conserva minutos de juego cuando aporten evidencia.
Visión general debe sintetizar lo observado y sus matices en un párrafo fluido. No la conviertas en una lista de minutos, goles, asistencias, paradas y nota: esos datos ya aparecen en la ficha. No menciones paradas en la narrativa salvo que las notas describan acciones de portería.
Táctica, técnica, físico y actitud desarrollan cada dimensión con sus evidencias. Puntos fuertes prioriza lo mejor documentado; mejoras formula qué trabajar a partir de las limitaciones realmente anotadas, sin inventar ejercicios, diagnósticos o promesas. Evita repetir la misma acción en todos los apartados. No añadas títulos ni Markdown dentro de los valores: la plantilla visual ya los presenta.
El autor es el colaborador y el destinatario es ${payload.type === 'united' ? 'la jugadora' : 'el jugador'}: habla siempre de tú al destinatario y usa primera persona del singular para observaciones y recomendaciones. Ejemplos de voz, solo si hay evidencia: «He observado que te ofreces entre líneas», «Destacaría tu control orientado», «Te recomiendo mirar antes de recibir». No hables del autor desde fuera: evita «el colaborador detalla», «según las notas», «el observador considera» o «se observa». Tampoco describas al destinatario como «el jugador» o «la jugadora». Las notas pueden estar escritas en tercera persona: transforma la voz manteniendo su significado, sin inventar conversaciones ni experiencias. No empieces cada frase con «yo» o «quiero detallar»; varía la redacción con naturalidad. Mantén los límites en primera persona, por ejemplo «No dispongo de suficientes observaciones para valorar tu resistencia». Ajusta el género al destinatario cuando sea necesario.
Ajusta la extensión a la evidencia: unas pocas notas producen un informe breve; notas ricas permiten mayor desarrollo. Nunca rellenes para ocupar espacio. Si no hay evidencia para una dimensión, déjala vacía. Conserva expresiones de duda y límites de la observación. No copies datos biográficos, posiciones, trayectorias, contactos ni temporadas de ejemplos visuales.
Una clasificación de nivel aportada por el colaborador es su valoración, no una decisión automatizada sobre becas o fichajes.`,
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
export function createLimiter({ perHour = 10, perDay = 100, clock = Date.now } = {}) {
  let total = { day: '', hour: -1, daily: 0, hourly: 0 }, active = 0;
  return {
    reserve() {
      const now = clock(), day = new Date(now).toISOString().slice(0, 10), hour = Math.floor(now / 3600000);
      if (total.day !== day) total = { day, hour, daily: 0, hourly: 0 };
      if (total.hour !== hour) { total.hour = hour; total.hourly = 0; }
      if (total.daily >= perDay || total.hourly >= perHour) throw new PublicError(429, 'Se ha alcanzado el límite de generación. Conserva tus notas y vuelve a intentarlo más tarde.');
      if (active >= 2) throw new PublicError(429, 'Hay otros informes en proceso. Espera un momento y vuelve a intentarlo.');
      total.daily++; total.hourly++; active++;
      let released = false;
      return () => { if (!released) { active--; released = true; } };
    },
  };
}
