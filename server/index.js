import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { authenticate, parseCodes, validatePayload, generateReport, createLimiter, PublicError } from './ai.js';

export function configFromEnv(env = process.env) {
  const origins = (env.ALLOWED_ORIGINS || 'https://antonio8aranda98-lang.github.io').split(',').map(x => x.trim());
  if (origins.some(o => { try { return new URL(o).origin !== o; } catch { return true; } })) throw new Error('ALLOWED_ORIGINS requiere orígenes completos sin ruta.');
  const codes = parseCodes(env.ACCESS_CODES), apiKey = (env.OPENAI_API_KEY || '').trim();
  return { origins, codes, apiKey, model: env.OPENAI_MODEL || 'gpt-6.1-terra' };
}
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let length = 0, exceeded = false; const chunks = [];
    req.on('data', chunk => {
      length += chunk.length;
      if (length > 200000) {
        if (!exceeded) { exceeded = true; chunks.length = 0; reject(new PublicError(413, 'Las notas son demasiado largas.')); }
      } else if (!exceeded) chunks.push(chunk);
    });
    req.on('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new PublicError(400, 'La solicitud no contiene JSON válido.')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new PublicError(400, 'La solicitud se ha interrumpido.')));
  });
}
export function createApp({ config = configFromEnv(), fetchImpl = fetch, limiter = createLimiter(), timeoutMs = 50000 } = {}) {
  const ready = Boolean(config.apiKey && config.codes.length);
  const server = createServer(async (req, res) => {
    const path = req.url?.split('?')[0];
    if (path === '/health' && req.method === 'GET') {
      const origin = req.headers.origin;
      if (origin && config.origins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      send(res, 200, { ok: true, aiReady: ready }); return;
    }
    if (path !== '/reports') { send(res, 404, { error: 'Ruta no encontrada.' }); return; }
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin)) { send(res, 403, { error: 'Origen no permitido.' }); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store' }); res.end(); return;
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); send(res, 405, { error: 'Método no permitido.' }); return; }
    if (!ready) { send(res, 503, { error: 'El servicio de IA aún no está activado. Antonio debe completar la configuración.' }); return; }
    const identity = authenticate(req.headers.authorization, config.codes);
    if (!identity) { send(res, 401, { error: 'El código de acceso no es válido.' }); return; }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { send(res, 415, { error: 'El contenido debe enviarse en formato JSON.' }); return; }
    let release;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnected);
    let timeout;
    try {
      const input = validatePayload(await readBody(req));
      release = limiter.reserve(identity);
      timeout = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
      const report = await generateReport(input, { apiKey: config.apiKey, model: config.model, fetchImpl, signal: controller.signal, onProviderError: details => console.error(JSON.stringify({event:'openai_error', ...details})) });
      if (!res.destroyed) send(res, 200, { report });
    } catch (error) {
      if (res.destroyed) return;
      if (controller.signal.aborted) send(res, 504, { error: 'La IA ha tardado demasiado. Tus notas se conservan; puedes volver a intentarlo.' });
      else if (error instanceof PublicError) { if(error.status === 429) res.setHeader('Retry-After', '3600'); send(res, error.status, { error: error.message }); }
      else send(res, 502, { error: 'No se ha podido generar el informe. Tus notas se conservan.' });
    } finally { clearTimeout(timeout); release?.(); res.off('close', disconnected); }
  });
  server.requestTimeout = 65000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 30;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Scouty API listening on port ${port}`));
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 20000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
