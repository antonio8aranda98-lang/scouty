import { createIcons, Activity, BadgeCheck, Check, ChevronDown, ClipboardList, Download, FileDown, FilePenLine, Focus, Footprints, Globe2, HardDrive, Lightbulb, MonitorSmartphone, NotebookPen, Quote, ScanSearch, ShieldCheck, Sparkles, Trash2, TrendingUp, UserRound, Waypoints } from 'lucide';
import { TYPES, SECTIONS, fieldsFor, emptyDraft, validate, notesToReport, hasNotes, validateAIReport } from './model.js';
import './style.css';

const $ = s => document.querySelector(s);
const icons = { Activity, BadgeCheck, Check, ChevronDown, ClipboardList, Download, FileDown, FilePenLine, Focus, Footprints, Globe2, HardDrive, Lightbulb, MonitorSmartphone, NotebookPen, Quote, ScanSearch, ShieldCheck, Sparkles, Trash2, TrendingUp, UserRound, Waypoints };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const KEY = 'scouty-drafts-v1';
let drafts = {}, type = 'hundra', step = 0, errors = [], busy = false, saveTimer, storageFailed = false;
let accessCode = '', aiPhase = 'Conectando…';
try {
  const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const t of Object.keys(TYPES)) {
    const d = stored[t];
    if (d && typeof d.data === 'object' && d.data && typeof d.notes === 'object' && d.notes) {
      drafts[t] = { ...emptyDraft(), ...d, reviewed: false };
      for (const k of ['notes', 'report']) drafts[t][k] = Object.fromEntries(SECTIONS.map(s => [s.key, typeof d[k]?.[s.key] === 'string' ? d[k][s.key] : '']));
    }
  }
} catch { storageFailed = true; }
for (const t of Object.keys(TYPES)) drafts[t] ||= emptyDraft();
const current = () => drafts[type];
const endpoint = import.meta.env.VITE_AI_ENDPOINT?.trim();
function save() {
  current().date = new Date().toISOString();
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(drafts)); storageFailed = false; }
  catch { storageFailed = true; }
  const status = $('#save-state');
  if (status) status.textContent = storageFailed ? 'No se ha podido guardar en este navegador' : 'Borrador guardado en este dispositivo';
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 5500); }
function progress() {
  const fs = fieldsFor(type), n = fs.length - validate(type, current().data).length;
  return { n, total: fs.length, percent: Math.round(n / fs.length * 100) };
}
function field(f) {
  const value = current().data[f.key] ?? '', invalid = errors.includes(f.key);
  const attrs = `id="field-${f.key}" name="${f.key}" required aria-invalid="${invalid}" ${invalid ? `aria-describedby="error-${f.key}"` : ''}`;
  return `<div class="field ${f.wide ? 'wide' : ''}"><label for="field-${f.key}">${f.label}<span class="required" aria-hidden="true">*</span></label>${f.type === 'select' ? `<select ${attrs}><option value="">Seleccionar</option>${f.options.map(o => `<option ${value === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input ${attrs} type="${f.type}" value="${esc(value)}" ${f.type === 'number' ? `min="${f.min}" max="${f.max}" step="${f.step}" inputmode="${f.step === 1 ? 'numeric' : 'decimal'}" placeholder="—"` : `maxlength="250" placeholder="${f.placeholder}" autocomplete="off"`}>`}${invalid ? `<span class="error" id="error-${f.key}">Introduce ${f.type === 'number' ? `un valor válido entre ${f.min} y ${f.max}` : 'un valor válido'}.</span>` : ''}</div>`;
}
function detailsStep() {
  return `<div class="section-heading"><span class="eyebrow">EL CONTEXTO IMPORTA</span><h2>Los datos del partido</h2><p>Una ficha clara es el comienzo de un buen informe.</p></div><div class="form-caption">${icon('clipboard-list')} Todos los campos son obligatorios. Usa 0 si no hubo acciones.</div><form id="data-form" novalidate class="field-grid">${fieldsFor(type).map(field).join('')}</form><div class="panel-actions"><span class="muted">La nota se valora de 0 a 10.</span><button class="primary" data-action="next">Continuar con las notas ${icon('notebook-pen')}</button></div>`;
}
function notesStep() {
  return `<div class="section-heading"><span class="eyebrow">TU MIRADA, EN EL CAMPO</span><h2>Del partido al papel</h2><p>Escribe como te salga. Lo importante es lo que has observado.</p></div><div class="notes-tip">${icon('lightbulb')}<span>Incluye minutos y acciones concretas. Puedes pegar todas tus notas en <strong>Visión general</strong> o repartirlas por apartados.</span></div><div class="note-sections">${SECTIONS.map((s, i) => `<${i === 0 ? 'div' : 'details'} class="note-block" ${current().notes[s.key] && i ? 'open' : ''}>${i === 0 ? `<label class="note-title" for="notes-${s.key}">${icon(s.icon)} ${s.label}</label>` : `<summary>${icon(s.icon)} ${s.label}<span class="note-dot">${current().notes[s.key]?.trim() ? 'Con notas' : 'Opcional'}</span>${icon('chevron-down')}</summary>`}<div class="note-body"><label ${i === 0 ? 'class="sr-only"' : ''} for="notes-${s.key}">${s.hint}</label><textarea id="notes-${s.key}" data-note="${s.key}" rows="${i ? 4 : 7}" maxlength="12000" placeholder="${s.example || 'Anota lo que has visto…'}">${esc(current().notes[s.key])}</textarea></div></${i === 0 ? 'div' : 'details'}>`).join('')}</div><div class="ai-banner">${icon('sparkles')}<div><strong>${endpoint ? 'Redacción con IA disponible' : 'Redacción con IA · Próximamente'}</strong><p>${endpoint ? 'OpenAI redactará el informe a partir de tus notas. Revisa siempre el resultado. La primera conexión puede tardar algo más.' : 'La conexión está preparada. Por ahora, creamos un borrador con tus notas para que puedas revisarlo y exportarlo.'}</p></div></div><div class="panel-actions"><button class="text-button" data-action="back">Volver a los datos</button><div class="action-group"><button class="${endpoint ? 'secondary' : 'primary'}" data-action="draft" ${busy ? 'disabled' : ''}>${icon('file-pen-line')} Crear borrador con mis notas</button>${endpoint ? `<button class="primary" data-action="ai" ${busy ? 'disabled' : ''}>${icon('sparkles')} ${busy ? aiPhase : 'Generar con IA'}</button>` : ''}</div></div>`;
}
function reviewStep() {
  return `<div class="section-heading"><span class="eyebrow">EL ÚLTIMO VISTAZO</span><h2>Un informe con tu criterio</h2><p>Revisa y ajusta el texto. Tú conoces lo que pasó en el campo.</p></div><div class="review-origin">${icon(current().source === 'ai' ? 'sparkles' : 'file-pen-line')} ${current().source === 'ai' ? 'Borrador redactado con IA. Contrasta cada afirmación con tus notas.' : 'Borrador con tus notas originales, sin redacción con IA.'}</div>${current().stale ? `<div class="warning">Has cambiado las notas. Vuelve al paso anterior y crea un nuevo borrador para incorporarlas.</div>` : ''}<div class="report-sheet"><div class="report-top"><strong>${TYPES[type].brand}</strong><span>INFORME DE OBSERVACIÓN</span></div><h3>${esc(current().data.name)}</h3><p class="match-line">${esc(current().data.match)}</p><div class="report-stats">${['minutes','goals','assists','saves','rating'].map(k => `<div><b>${esc(current().data[k])}${k === 'rating' ? '<small>/10</small>' : ''}</b><span>${{minutes:'Minutos',goals:'Goles',assists:'Asistencias',saves:'Paradas',rating:'Nota media'}[k]}</span></div>`).join('')}</div>${SECTIONS.map(s => `<div class="report-section"><label for="report-${s.key}">${s.label}</label><textarea id="report-${s.key}" data-report="${s.key}" maxlength="15000" rows="${Math.max(2, Math.min(8, Math.ceil((current().report[s.key] || '').length / 80)))}" placeholder="Sin observaciones. Este apartado no aparecerá en el PDF.">${esc(current().report[s.key])}</textarea></div>`).join('')}</div><label class="review-check"><input id="reviewed" type="checkbox" ${current().reviewed ? 'checked' : ''}><span>He revisado los datos y el texto. El informe refleja mis observaciones del partido.</span></label><div class="panel-actions"><button class="text-button" data-action="back">Volver a mis notas</button><button class="primary" data-action="pdf" ${!current().reviewed || current().stale || busy ? 'disabled' : ''}>${icon('download')} Descargar informe PDF</button></div>`;
}
function render() {
  const p = progress();
  $('#app').innerHTML = `<header class="topbar"><a class="logo" href="./" aria-label="Scouty, inicio"><span class="logo-mark">${icon('focus')}</span>scouty<span class="logo-period">.</span></a><span class="header-purpose">El talento merece un buen informe.</span><span class="header-badge">HUNDRA <span>×</span> UNITED</span></header><main><section class="hero"><div class="hero-copy"><div class="eyebrow light">OBSERVAR. ENTENDER. ACOMPAÑAR.</div><h1>Tu mirada.<br>Su próximo paso<span>.</span></h1><p>Transforma lo que ves en el campo en un informe<br class="desktop-break"> que ayude a seguir creciendo.</p></div><div class="pitch" aria-hidden="true"><div class="pitch-outline"><div class="pitch-mid"></div><div class="pitch-circle"></div><div class="pitch-box top"></div><div class="pitch-box bottom"></div><span class="player p1"></span><span class="player p2"></span><span class="player p3"></span><span class="player p4"></span><span class="player p5"></span><span class="ball"></span><div class="pass-line"></div></div><span class="pitch-label">CADA DETALLE CUENTA</span></div><div class="hero-caption">De la banda al informe.<br>Sin perder el partido.</div></section><section class="workspace"><div class="workspace-title"><h2>¿A quién has venido a ver?</h2><span>Tres tipos de informe. Un mismo cuidado.</span></div><div class="type-grid" aria-label="Tipo de informe">${Object.entries(TYPES).map(([key,t]) => `<button class="type-card ${type === key ? 'selected' : ''}" data-type="${key}" aria-pressed="${type === key}" ${busy ? 'disabled' : ''}><span class="type-icon">${icon(t.icon)}</span><span class="type-copy"><span class="type-brand">${t.brand}</span><strong>${t.title}</strong><span class="type-subtitle">${t.subtitle}</span></span><span class="radio-mark">${type === key ? icon('check') : ''}</span></button>`).join('')}</div><div class="editor-layout"><div class="editor"><nav class="steps" aria-label="Pasos del informe">${['Datos del partido','Tus notas','Revisar y descargar'].map((s,i) => `<button data-step="${i}" class="step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}" ${busy ? 'disabled' : ''} ${i === step ? 'aria-current="step"' : ''}><span>${i < step ? icon('check') : i + 1}</span>${s}</button>`).join('')}</nav><section class="panel" aria-label="Editor del informe">${step === 0 ? detailsStep() : step === 1 ? notesStep() : reviewStep()}</section></div><aside class="sidebar"><div class="summary-card"><span class="eyebrow">TU INFORME, EN MARCHA</span><div class="summary-icon">${icon(TYPES[type].icon)}</div><h3>${TYPES[type].label}</h3><p class="summary-name" id="summary-name">${esc(current().data.name || 'El próximo talento tiene nombre.')}</p><div class="progress-label"><span>Datos completados</span><strong id="progress-count">${p.n}/${p.total}</strong></div><div class="progress-track"><span id="progress-bar" style="width:${p.percent}%"></span></div><div class="summary-feature">${icon('file-down')} PDF listo para compartir</div><div class="summary-feature">${icon('monitor-smartphone')} Desde el móvil o el ordenador</div><div class="save-state">${icon('hard-drive')}<span id="save-state">${storageFailed ? 'El guardado local no está disponible' : 'Borrador guardado en este dispositivo'}</span></div></div><div class="advice-card">${icon('quote')}<p>Un buen informe no solo cuenta lo que pasó. Ayuda a decidir qué trabajar después.</p><span>EL CRITERIO LO PONES TÚ.</span></div><button class="clear-button" data-action="clear">${icon('trash-2')} Borrar este borrador</button><p class="privacy-note">Tus borradores permanecen en este navegador. En un dispositivo compartido, bórralos al terminar.</p></aside></div></section></main><footer><span class="footer-brand">scouty.</span><span>Hecho para quienes ven más allá del resultado.</span><span>HUNDRA · United Sports Agency</span></footer><div id="toast" role="status" aria-live="polite"></div><dialog id="clear-dialog"><h2>¿Borrar este borrador?</h2><p>Se eliminarán los datos y notas de este tipo de informe en este navegador. Los otros tipos de informe se conservarán.</p><div class="action-group"><button class="secondary" data-action="cancel-clear">Conservar</button><button class="danger" data-action="confirm-clear">Borrar borrador</button></div></dialog>`;
  createIcons({ icons });
  bind();
  if (busy) document.querySelectorAll('button, textarea, input, select').forEach(el => { el.disabled = true; });
}
function validData() {
  errors = validate(type, current().data);
  if (!errors.length) return true;
  step = 0; render(); $(`#field-${errors[0]}`).focus(); toast('Revisa los campos señalados para continuar.'); return false;
}
function move(next) {
  if (busy) return;
  if (next > 0 && !validData()) return;
  if (next === 2 && !hasNotes(current().report)) { step = 1; render(); toast('Añade tus notas y crea primero un borrador.'); return; }
  step = next; render(); $('.steps').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function bind() {
  document.querySelectorAll('[data-type]').forEach(el => el.onclick = () => { if(busy) return; save(); type = el.dataset.type; step = 0; errors = []; render(); });
  document.querySelectorAll('[data-step]').forEach(el => el.onclick = () => move(Number(el.dataset.step)));
  $('#data-form')?.addEventListener('input', e => {
    if (!e.target.name) return;
    current().data[e.target.name] = e.target.value; current().reviewed = false; save();
    e.target.setAttribute('aria-invalid', 'false');
    const p = progress(); $('#progress-count').textContent = `${p.n}/${p.total}`; $('#progress-bar').style.width = p.percent + '%'; $('#summary-name').textContent = current().data.name || 'El próximo talento tiene nombre.';
  });
  document.querySelectorAll('[data-note]').forEach(el => el.oninput = () => { current().notes[el.dataset.note] = el.value; current().stale = true; current().reviewed = false; save(); });
  document.querySelectorAll('[data-report]').forEach(el => el.oninput = () => { current().report[el.dataset.report] = el.value; current().reviewed = false; $('#reviewed').checked = false; $('[data-action="pdf"]').disabled = true; save(); });
  $('#reviewed')?.addEventListener('change', e => { current().reviewed = e.target.checked; $('[data-action="pdf"]').disabled = !e.target.checked || current().stale || !hasNotes(current().report); save(); });
  document.querySelectorAll('[data-action]').forEach(el => el.onclick = async () => {
    const a = el.dataset.action;
    if (a === 'next') move(1);
    if (a === 'back') move(step - 1);
    if (a === 'draft' || a === 'ai') await makeReport(a === 'ai');
    if (a === 'pdf') await downloadPDF();
    if (a === 'clear') $('#clear-dialog').showModal();
    if (a === 'cancel-clear') $('#clear-dialog').close();
    if (a === 'confirm-clear') { drafts[type] = emptyDraft(); save(); step = 0; errors = []; render(); toast('Borrador eliminado.'); }
  });
}
async function makeReport(ai) {
  if (!validData()) return;
  if (!hasNotes(current().notes)) { toast('Añade al menos una observación del partido.'); $('#notes-general')?.focus(); return; }
  if (Object.values(current().notes).join('').length > 40000) { toast('Reduce las notas a un máximo de 40.000 caracteres en total.'); return; }
  if (hasNotes(current().report) && !confirm('Se sustituirá el texto del informe actual, incluidas tus ediciones. ¿Crear un nuevo borrador?')) return;
  busy = true;
  const draft = current();
  const payload = { version: 1, type, data: { ...draft.data }, notes: { ...draft.notes } };
  render();
  try {
    let report;
    if (ai) {
      if (!endpoint) throw new Error('La conexión con IA todavía no está configurada.');
      const url = new URL(endpoint, location.href);
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('El servicio de IA debe usar HTTPS.');
      const code = accessCode || await requestAccessCode();
      if (!code) return;
      accessCode = code;
      aiPhase = 'Conectando…'; render();
      const healthUrl = new URL('/health', url);
      const health = await fetch(healthUrl, { signal: AbortSignal.timeout(120000), credentials: 'omit', redirect: 'error' });
      if (!health.ok || !(await health.json()).aiReady) throw new Error('El servicio de IA aún no está activado. Antonio debe completar la configuración.');
      aiPhase = 'Redactando…'; render();
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${code}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000), credentials: 'omit', redirect: 'error' });
      if (!response.ok) {
        if (response.status === 401) accessCode = '';
        const detail = await response.json().catch(() => ({}));
        throw new Error(typeof detail.error === 'string' && detail.error.length < 300 ? detail.error : 'No se pudo generar el informe. Tus notas siguen guardadas.');
      }
      report = validateAIReport((await response.json()).report);
    } else { report = notesToReport(draft.notes); }
    draft.report = report; draft.source = ai ? 'ai' : 'notes'; draft.stale = false; draft.reviewed = false; save(); step = 2;
  } catch (error) { toast(error.name === 'TimeoutError' ? 'El servicio ha tardado demasiado. Tus notas siguen guardadas.' : error.message); }
  finally { busy = false; const message = $('#toast')?.textContent; render(); if(message) toast(message); }
}
function requestAccessCode() {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ai-access-dialog';
    dialog.innerHTML = '<form method="dialog"><h2>Acceso a la redacción con IA</h2><p>Introduce el código que te ha facilitado Antonio. Se conservará solo mientras esta página siga abierta.</p><label for="ai-access-code">Código de colaborador</label><input id="ai-access-code" type="password" autocomplete="off" required minlength="16" maxlength="200"><p>Al generar, se enviarán tus notas y datos deportivos a OpenAI mediante Scouty. Evita incluir información personal innecesaria en las notas.</p><div class="action-group"><button type="button" class="secondary" id="ai-access-cancel">Cancelar</button><button type="submit" class="primary">Generar informe</button></div></form>';
    document.body.append(dialog);
    dialog.querySelector('form').onsubmit = e => { e.preventDefault(); dialog.returnValue = dialog.querySelector('input').value; dialog.close(); };
    dialog.querySelector('#ai-access-cancel').onclick = () => { dialog.returnValue = ''; dialog.close(); };
    dialog.oncancel = () => { dialog.returnValue = ''; };
    dialog.onclose = () => { const code = dialog.returnValue; dialog.remove(); resolve(code); };
    dialog.showModal();
  });
}
async function downloadPDF() {
  if (!validData() || !current().reviewed || current().stale || !hasNotes(current().report) || busy) return;
  const draft = structuredClone(current()), reportType = type;
  busy = true; $('[data-action="pdf"]').disabled = true;
  try {
    const { buildPDF, filename } = await import('./pdf.js');
    buildPDF(reportType, draft).save(filename(draft.data.name));
    toast('PDF descargado. Tu borrador sigue guardado aquí.');
  } catch { toast('No se pudo crear el PDF. Tus datos se conservan. Vuelve a intentarlo.'); }
  finally { busy = false; $('[data-action="pdf"]').disabled = !current().reviewed || current().stale; }
}
render();
