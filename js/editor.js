/* ==========================================================================
   Editor de un proyecto: pasos, herramientas, línea de comandos y capas.
   Pensado como un AutoCAD reducido: rueda = zoom, botón del medio o espacio
   = mover la vista, F3 refent., F7 rejilla, F8 orto, Esc cancela, Enter termina.
   ========================================================================== */
import { $, $$, esc, fmt, parseNum, uid, clone, dist, lerp, rotP, centroid, pointInPoly, distSeg, edgeAngle, anguloBordeCercano, ic, toast, descargar } from './util.js';
import { PANELES, INVERSORES, ZONAS, EQUIPOS, CANAL, CAPAS, ESTADOS, COLORES_STRING, GAP_FILA, MODELOS_EQUIPO } from './catalogo.js';
import { escala, droneGSD, calcular, calcStrings, calcCA, panelDe, inversorDe, zonaPoly, geomTecho, geomBloque, girarV, largoM, nombreString, medidaEquipo, tamEquipoPx, altoTextoPx } from './geom.js';
import { dibujar, cargarImg, imgDe, colorString, dibujarNorte, textoCota } from './render.js';
import { vistaUnilineal, panelUnilineal, accionUnilineal } from './unilineal.js';
import { nuevoTecho, guardar } from './store.js';
import { vistaLamina, panelLamina, accionLamina } from './lamina.js';
import { vistaFicha, panelFicha, accionFicha } from './ficha/ficha.js';
import { TIPOS_HOJA, TIPOS_PRINCIPAL, CLAVES_HOJA, tipoPrincipal, nombrePrincipal, nuevaHoja, vistaHoja } from './hojas.js';
import { vistaInforme, panelInforme, accionInforme } from './informe/informe.js';

export const PASOS = [
  ['ficha', 'Ficha', 'folder'], ['escala', 'Escala', 'ruler'], ['techos', 'Techos', 'roof'], ['elementos', 'Elementos', 'block'], ['paneles', 'Paneles', 'grid'],
  ['strings', 'Strings', 'string'], ['equipos', 'Equipos y canalización', 'plug'], ['etiquetas', 'Cotas, etiquetas y textos', 'text'], ['unilineal', 'Unilineal', 'sheet'], ['informe', 'Informe y planos', 'print']
];
const HERR_DEF = { ficha: 'sel', escala: 'ref', techos: 'roof', elementos: 'zona', paneles: 'sel', strings: 'str', equipos: 'sel', etiquetas: 'sel', unilineal: 'sel', lamina: 'sel', informe: 'sel' };

let E = null;          // estado del editor

/* ---------- Hojas de diseño: una por imagen ----------
   La hoja principal (techo, foto de dron) son los datos de siempre del proyecto.
   Las demás (canalización, zona de equipos, cargador…) viven en p.hojas, cada una con
   su foto, escala y dibujos. El editor trabaja con E.p = "la hoja activa vista como
   proyecto": las herramientas no cambian; lo que es de la hoja va a la hoja. */
const ICONO_HOJA = { principal: 'drone', canalizacion: 'pline', equipos: 'inverter', cargador: 'plug', empalme: 'block', otra: 'crop' };
const hojaActiva = () => E.hojaId ? (E.proyecto.hojas || []).find(h => h.id === E.hojaId) : null;
const hojaCorta = () => !!E.hojaId || tipoPrincipal(E.proyecto) !== 'techo';      // sin techos ni paneles: foto, dibujo e informe
const pasosVisibles = () => hojaCorta() ? PASOS.filter(([k]) => ['ficha', 'escala', 'equipos', 'etiquetas', 'unilineal', 'informe'].includes(k)) : PASOS;
const nombrePaso = (k, n) => hojaCorta() && k === 'equipos' ? 'Dibujo' : hojaCorta() && k === 'escala' ? 'Foto y escala' : n;
let alSalir = null;

export function abrirEditor(p, volver) {
  alSalir = volver;
  const hojaId = p._hoja && (p.hojas || []).some(h => h.id === p._hoja) ? p._hoja : null;
  E = { proyecto: p, hojaId, p: vistaHoja(p, hojaId), step: (p._paso === 'lamina' ? 'informe' : p._paso) || (p.ref ? (p.roofs.some(r => r.closed) ? 'paneles' : 'techos') : 'escala'), tool: null, sel: null, V: null, temp: null, D: null,
    orto: false, refent: true, rejilla: false, capas: new Set(CAPAS.map(c => c.id)), bloqueadas: new Set(), hist: [], fut: [], cmdLog: [],
    zonaK: 'obs', zonaForma: 'rect', figForma: 'grid', figFC: { f: 2, c: 5 }, eqK: 'inv', rutaK: 'cc', blk: { f: 2, c: 4 }, strAct: p.strings[0]?.id || null, selPanels: new Set(), mouse: null, snap: null,
    fotoAlpha: .85, guardado: true, R: null, SI: null };
  E.tool = HERR_DEF[E.step];
  render();
  cargarImg(E.p.img).then(() => { ajustarVista(); dibujarTodo(); });
  window.addEventListener('keydown', teclas);
  window.addEventListener('resize', onResize);
}
export function cerrarEditor() { window.removeEventListener('keydown', teclas); window.removeEventListener('resize', onResize); E = null; }
const esPagina = () => E && (E.step === 'lamina' || E.step === 'ficha' || E.step === 'informe' || E.step === 'unilineal');   // pasos sin canvas
const onResize = () => { if (E && !esPagina()) { dibujarTodo(); } };

/* ---------- Cambios, deshacer y guardado automático ---------- */
const snap = () => JSON.stringify(E.proyecto, (k, v) => k === 'img' ? undefined : v);
function antes() { E.hist.push(snap()); if (E.hist.length > 80) E.hist.shift(); E.fut = []; }
function despues(redibujarPanel = true) { E.guardado = false; recalcular(); if (redibujarPanel) panel(); dibujarTodo(); estadoGuardado(); programarGuardado(); }
function restaurar(json) {
  const P = E.proyecto, imgs = { _: P.img }; (P.hojas || []).forEach(h => { imgs[h.id] = h.img; });
  Object.keys(P).forEach(k => delete P[k]); Object.assign(P, JSON.parse(json), { img: imgs._ });
  (P.hojas || []).forEach(h => { if (h.id in imgs) h.img = imgs[h.id]; });
  if (E.hojaId && !(P.hojas || []).some(h => h.id === E.hojaId)) E.hojaId = null;
  E.p = vistaHoja(P, E.hojaId); E.sel = null; E.selPanels.clear(); despues(); render(); }
function deshacer() { if (!E.hist.length) return toast('Nada que deshacer'); E.fut.push(snap()); restaurar(E.hist.pop()); log('DESHACER'); }
function rehacer() { if (!E.fut.length) return toast('Nada que rehacer'); E.hist.push(snap()); restaurar(E.fut.pop()); log('REHACER'); }
let tGuardar = null;
function programarGuardado() { clearTimeout(tGuardar); tGuardar = setTimeout(guardarYa, 1200); }
async function guardarYa() {
  clearTimeout(tGuardar); if (!E) return;
  try { E.proyecto._paso = E.step; E.proyecto._hoja = E.hojaId; await guardar(E.proyecto); E.guardado = true; } catch (e) { toast('No se pudo guardar en este navegador: ' + e.message); }
  estadoGuardado();
}
function estadoGuardado() { const el = $('#guardEstado'); if (el) { el.textContent = E.guardado ? 'Guardado' : 'Guardando…'; el.classList.toggle('pend', !E.guardado); } }
function recalcular() { const base = esPagina() ? E.proyecto : E.p; E.R = calcular(base); E.SI = calcStrings(base, E.R); E.RP = E.hojaId ? calcular(E.proyecto) : E.R; }   // RP: totales del proyecto (hoja principal)

/* ---------- Estructura de la pantalla ---------- */
function render() {
  recalcular();
  const p = E.p, R = E.RP || E.R;
  document.body.className = 'modo-editor';
  $('#app').innerHTML = `
  <header class="ed-top">
    <button class="tb-btn" data-act="salir" title="Volver a proyectos">${ic('back')}</button>
    <img src="assets/nikola-logo-blanco.svg" alt="NIKOLA" class="ed-logo">
    <div class="ed-title"><b>${esc(p.codigo || 'Sin código')}</b><span>${esc(p.cliente || 'Proyecto sin nombre')}</span></div>
    <select class="tb-sel" data-campo="estado" aria-label="Estado">${Object.entries(ESTADOS).map(([k, n]) => `<option value="${k}" ${p.estado === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="tb-sp"></div>
    <div class="ed-kpi"><span><b id="kN">${R.n}</b> paneles</span><span><b id="kK">${fmt(R.kwp, 2)}</b> kWp</span><span><b id="kS">${E.proyecto.strings.length}</b> strings</span></div>
    <button class="tb-btn" data-act="undo" title="Deshacer (Ctrl+Z)">${ic('undo')}</button>
    <button class="tb-btn" data-act="redo" title="Rehacer (Ctrl+Y)">${ic('redo')}</button>
    <span id="guardEstado" class="guard">Guardado</span>
    <button class="tb-btn" data-act="exportar" title="Exportar proyecto (.json)">${ic('download')}</button>
  </header>
  <nav class="ribbon" aria-label="Pasos">${pasosVisibles().map(([k, n, i], idx) => `<button class="paso ${pasoOk(k) ? 'ok' : ''}" data-act="paso" data-k="${k}" aria-pressed="${E.step === k}"><i>${pasoOk(k) ? ic('check', 13) : idx + 1}</i>${ic(i, 16)}<span>${nombrePaso(k, n)}</span></button>`).join('')}</nav>
  <div class="ed-body ${esPagina() ? 'es-lamina' : ''}">
    ${esPagina() ? '' : `<aside class="tools" aria-label="Herramientas">${herramientas()}</aside>`}
    <main class="model" id="model">
      ${E.step === 'lamina' ? `<div id="laminaWrap" class="lamina-wrap"></div>` : E.step === 'ficha' ? `<div id="fichaWrap" class="ficha-wrap"></div>` : E.step === 'informe' ? `<div id="informeWrap" class="informe-wrap"></div>` : E.step === 'unilineal' ? `<div id="uniWrap" class="informe-wrap"></div>` : `<canvas id="cv" tabindex="0" aria-label="Espacio modelo"></canvas>
      <div class="ucs">${ic('move', 14)}<span>X</span></div>
      <div class="vctl"><button data-act="zin" title="Acercar">${ic('zoomin', 16)}</button><button data-act="zout" title="Alejar">${ic('zoomout', 16)}</button><button data-act="zext" title="Zoom extensión (Z)">${ic('ext', 16)}</button></div>
      <div class="hint" id="hint"></div>`}
    </main>
    <aside class="props" id="props"></aside>
  </div>
  ${esPagina() ? '' : barraHojas()}
  ${esPagina() ? '' : `<footer class="cmd">
    <div class="cmd-log" id="cmdLog">${E.cmdLog.slice(-3).map(l => `<div>${esc(l)}</div>`).join('')}</div>
    <label class="cmd-in"><span id="cmdPrompt">Comando:</span><input id="cmdIn" autocomplete="off" spellcheck="false" placeholder="Escribe un comando (AYUDA) o una distancia en metros"></label>
  </footer>
  <div class="status">
    <span id="coords">X 0,00  Y 0,00 m</span>
    <button data-act="tog" data-k="rejilla" aria-pressed="${E.rejilla}" title="Rejilla de 1 m (F7)">REJILLA</button>
    <button data-act="tog" data-k="orto" aria-pressed="${E.orto}" title="Modo orto (F8)">ORTO</button>
    <button data-act="tog" data-k="refent" aria-pressed="${E.refent}" title="Referencia a objetos (F3)">REFENT</button>
    <span class="st-sp"></span>
    <span>${escala(p) ? `1 px = ${fmt(escala(p), 1)} mm` : 'Sin escala'}</span>
    <label class="st-foto">Foto <input type="range" min="0" max="100" value="${Math.round(E.fotoAlpha * 100)}" data-campo="_fotoAlpha" aria-label="Opacidad de la foto"></label>
  </div>`}`;
  panel();
  if (E.step === 'lamina') { vistaLamina($('#laminaWrap'), E.proyecto, E.R, E.SI); return; }
  if (E.step === 'informe') { vistaInforme($('#informeWrap'), E.proyecto, { cambio: () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, panel: () => panel() }); return; }
  if (E.step === 'unilineal') { vistaUnilineal($('#uniWrap'), E.proyecto, { cambio: () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, panel: () => panel() }); return; }
  if (E.step === 'ficha') { vistaFicha($('#fichaWrap'), E.proyecto, { cambio: () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, panel: () => panel() }); return; }
  const cv = $('#cv');
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up);
  cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('dblclick', dbl);
  cv.addEventListener('contextmenu', ev => { ev.preventDefault(); terminar(); });
  cv.addEventListener('pointerleave', () => { E.mouse = null; dibujarTodo(); });
  $('#cmdIn').addEventListener('keydown', cmdKey);
  if (!E.V) ajustarVista(); dibujarTodo(); pista();
}
function herramientas() {
  const t = (k, icono, n, extra = '') => `<button class="tool" data-act="tool" data-k="${k}" aria-pressed="${E.tool === k}" title="${n}" ${extra}>${ic(icono, 20)}<span>${n}</span></button>`;
  const porPaso = { escala: t('ref', 'ruler', 'Referencia'), techos: t('roof', 'roof', 'Techo'), elementos: t('zona', 'block', 'Zona'), paneles: '', strings: t('str', 'string', 'Asignar'),
    equipos: t('equipo', 'inverter', 'Equipo') + t('ruta', 'pline', 'Canalización') + t('figpan', 'grid', 'Paneles') };
  return t('sel', 'cursor', 'Seleccionar') + t('pan', 'hand', 'Encuadre') + `<hr>` + (porPaso[E.step] || '') + `<hr>` + t('cota', 'dim', 'Cota') + t('texto', 'text', 'Texto') + t('norte', 'north', 'Norte');
}
function pasoOk(k) {
  const p = E.p, R = E.R || calcular(p);
  if (k === 'informe') return !!(p.informe && p.informe.paginas && p.informe.paginas.length);
  if (k === 'etiquetas') return !!E.proyecto.etqVisto;
  if (k === 'unilineal') return !!(E.proyecto.uni && Object.keys(E.proyecto.uni).length);
  if (k === 'ficha') return !!(p.ficha && (Object.keys(p.ficha.entradas || {}).length || Object.keys(p.ficha.zonos || {}).length));
  if (k === 'escala') return !!escala(p) || (!!p.img && !!p.sinEscala);
  if (k === 'techos') return p.roofs.some(r => r.closed);
  if (k === 'elementos') return p.zonas.length > 0 || !!p.sinElementos;
  if (k === 'paneles') return R.n > 0;
  if (k === 'strings') { const S = E.SI || calcStrings(p, R); return p.strings.length > 0 && !S.sinString && S.lista.every(x => x.ok); }
  if (k === 'equipos') return E.hojaId ? (p.rutas.length + p.equipos.length + p.cotas.length + p.textos.length + (p.figPaneles || []).length) > 0 : p.equipos.some(e => e.k === 'inv') && p.rutas.length > 0;
  if (k === 'lamina') return !!(p.lamina.jefe && p.lamina.ingeniero && p.codigo);
}
function log(t) { E.cmdLog.push(t); const el = $('#cmdLog'); if (el) el.innerHTML = E.cmdLog.slice(-3).map(l => `<div>${esc(l)}</div>`).join(''); }
function prompt(t) { const el = $('#cmdPrompt'); if (el) el.textContent = t; }

/* ---------- Vista ---------- */
function tam() { const m = $('#model'); return m ? [m.clientWidth, m.clientHeight] : [800, 600]; }
function ajustarVista() {
  const [W, H] = tam(), p = E.p; if (!p.w) { E.V = { k: 1, ox: 0, oy: 0 }; return; }
  const k = Math.min(W / p.w, H / p.h) * .94; E.V = { k, ox: -(W - p.w * k) / 2, oy: -(H - p.h * k) / 2 };
}
function zoom(f, sx, sy) { const V = E.V, k = Math.max(.05, Math.min(40, V.k * f)); f = k / V.k; V.ox = (sx + V.ox) * f - sx; V.oy = (sy + V.oy) * f - sy; V.k = k; dibujarTodo(); }
const aFoto = (sx, sy) => [(sx + E.V.ox) / E.V.k, (sy + E.V.oy) / E.V.k];
const aPant = q => [q[0] * E.V.k - E.V.ox, q[1] * E.V.k - E.V.oy];
function ptEv(ev) { const rc = $('#cv').getBoundingClientRect(); return [ev.clientX - rc.left, ev.clientY - rc.top]; }

/* ---------- Dibujo ---------- */
function dibujarTodo() {
  const cv = $('#cv'); if (!cv || !E) return;
  const [W, H] = tam(), dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = getComputedStyle(document.body).getPropertyValue('--modelo') || '#1E242B'; g.fillRect(0, 0, W, H);
  const p = E.p, s = escala(p);
  const selBloque = E.sel && E.sel.t === 'bloque' ? E.sel : null;
  E.hits = [];
  dibujar(g, p, E.V, { hits: E.hits, rotulos: E.step === 'etiquetas', capas: E.capas, sel: E.sel, step: E.step, R: E.R, SI: E.SI, fotoAlpha: E.fotoAlpha, selBloque, selPanels: E.step === 'strings' ? panelesDelActivo() : null, verRef: E.step === 'escala',
    temp: (g2, T) => temporal(g2, T) });
  if (E.rejilla && s) rejilla(g, W, H, s);
  cursor(g, W, H);
  const n = $('#kN'); if (n) { const RP = E.RP || E.R; n.textContent = RP.n; $('#kK').textContent = fmt(RP.kwp, 2); $('#kS').textContent = E.proyecto.strings.length; }   // totales del proyecto, en cualquier hoja
}
function panelesDelActivo() { const st = E.p.strings.find(x => x.id === E.strAct); return new Set(st ? st.panels : []); }
function rejilla(g, W, H, s) {
  const paso = 1000 / s, k = E.V.k; if (paso * k < 6) return;
  g.strokeStyle = 'rgba(160,190,210,.13)'; g.lineWidth = 1;
  const x0 = Math.floor(E.V.ox / k / paso) * paso, y0 = Math.floor(E.V.oy / k / paso) * paso;
  for (let x = x0; x * k - E.V.ox < W; x += paso) { const X = Math.round(x * k - E.V.ox) + .5; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, H); g.stroke(); }
  for (let y = y0; y * k - E.V.oy < H; y += paso) { const Y = Math.round(y * k - E.V.oy) + .5; g.beginPath(); g.moveTo(0, Y); g.lineTo(W, Y); g.stroke(); }
}
function cursor(g, W, H) {
  const m = E.mouse; if (!m || E.tool === 'pan') return;
  const q = E.snap ? aPant(E.snap) : m;
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, q[1] + .5); g.lineTo(q[0] - 6, q[1] + .5); g.moveTo(q[0] + 6, q[1] + .5); g.lineTo(W, q[1] + .5);
  g.moveTo(q[0] + .5, 0); g.lineTo(q[0] + .5, q[1] - 6); g.moveTo(q[0] + .5, q[1] + 6); g.lineTo(q[0] + .5, H); g.stroke();
  g.strokeRect(q[0] - 5.5, q[1] - 5.5, 11, 11);
  if (E.snap) { g.strokeStyle = '#FAB704'; g.lineWidth = 2; g.strokeRect(q[0] - 7, q[1] - 7, 14, 14); }
}
function temporal(g, T) {
  const t = E.temp, m = E.mouse ? cursorFoto() : null;
  const linea = (pts, col, dash = []) => { g.beginPath(); pts.forEach((q, i) => { const a = T(q); i ? g.lineTo(a[0], a[1]) : g.moveTo(a[0], a[1]); }); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); };
  const etiqueta = (a, b) => { const s = escala(E.p); if (!s) return; const q = T(lerp(a, b, .5)), txt = `${fmt(dist(a, b) * s / 1000, 2)} m`; g.font = "12px 'Archivo Narrow', Arial"; g.fillStyle = 'rgba(0,0,0,.75)'; const w = g.measureText(txt).width; g.fillRect(q[0] + 6, q[1] - 16, w + 8, 16); g.fillStyle = '#FAB704'; g.fillText(txt, q[0] + 10, q[1] - 4); };
  if (t && t.tipo === 'poly' && m) { const pts = [...t.pts, m]; linea(pts, t.col || '#FAB704', t.dash || [6, 4]); if (t.pts.length) etiqueta(t.pts[t.pts.length - 1], m); }
  if (t && t.tipo === 'linea' && m) { linea([t.a, m], '#FAB704', [6, 4]); etiqueta(t.a, m); }
  if (E.D && E.D.kind === 'ventana') { const a = T(E.D.a), b = T(E.D.b), izq = E.D.b[0] >= E.D.a[0]; g.fillStyle = izq ? 'rgba(61,123,255,.15)' : 'rgba(47,208,107,.15)'; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.setLineDash(izq ? [] : [6, 4]); g.strokeStyle = izq ? '#3D7BFF' : '#2FD06B'; g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); g.setLineDash([]); }
  if (E.D && E.D.kind === 'nuevaZona') { const z = zonaDeArrastre(E.D.a, E.D.b), pts = zonaPoly(z).map(T); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.strokeStyle = ZONAS[E.zonaK].c; g.setLineDash([5, 4]); g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); }
  // fantasma del bloque o equipo por poner
  if (m && E.step === 'paneles' && E.tool === 'sel' && !E.D) { const r = techoAct(); if (r && r.modo === 'manual' && pointInPoly(m, r.poly) && !bloqueEn(m) && !(E.sel && E.sel.t === 'bloque')) { const s = escala(E.p); if (s) { const G = geomTecho(E.p, r, s), b = { f: E.blk.f, c: E.blk.c }, gb = geomBloque(E.p, G, b); const q = [[-gb.BW / 2, -gb.BH / 2], [gb.BW / 2, -gb.BH / 2], [gb.BW / 2, gb.BH / 2], [-gb.BW / 2, gb.BH / 2]].map(v => { const w = girarV(v, gb.a); return [m[0] + w[0], m[1] + w[1]]; }); linea([...q, q[0]], 'rgba(47,208,107,.9)', [4, 4]); } } }
}

/* ---------- Refent / orto ---------- */
function puntosRef() {
  const p = E.p, pts = [];
  p.roofs.forEach(r => r.poly.forEach(q => pts.push(q)));
  p.rutas.forEach(r => r.pts.forEach(q => pts.push(q)));
  p.equipos.forEach(e => pts.push([e.x, e.y]));
  p.cotas.forEach(c => { pts.push(c.a); pts.push(c.b); });
  (p.figPaneles || []).forEach(f => f.pts.forEach(q => pts.push(q)));
  if (E.step === 'equipos' && E.R) E.R.validos.forEach(pn => pn.q.forEach(q => pts.push(q)));
  if (E.temp && E.temp.pts) E.temp.pts.forEach(q => pts.push(q));
  return pts;
}
function cursorFoto() {
  if (!E.mouse) return null;
  let q = aFoto(...E.mouse); E.snap = null;
  if (E.refent && ['ref', 'roof', 'ruta', 'cota', 'equipo', 'figpan'].includes(E.tool)) {
    let best = 10 / E.V.k, bq = null; puntosRef().forEach(v => { const d = dist(v, q); if (d < best) { best = d; bq = v; } });
    if (bq) { E.snap = bq; return [...bq]; }
  }
  const base = E.temp && (E.temp.pts ? E.temp.pts[E.temp.pts.length - 1] : E.temp.a);
  if (E.orto && base) q = Math.abs(q[0] - base[0]) > Math.abs(q[1] - base[1]) ? [q[0], base[1]] : [base[0], q[1]];
  return q;
}

/* ---------- Búsqueda de objetos bajo el cursor ---------- */
const tol = () => 7 / E.V.k;
const techoAct = () => { const s = E.sel; const id = s && (s.t === 'roof' ? s.id : s.rid); return E.p.roofs.find(r => r.id === id) || null; };
const techoEn = q => [...E.p.roofs].reverse().find(r => r.closed && pointInPoly(q, r.poly));
const panelEn = q => E.R.panels.find(pn => pointInPoly(q, pn.q));
const zonaEn = q => [...E.p.zonas].reverse().find(z => pointInPoly(q, zonaPoly(z)));
function equipoEn(q) { return [...E.p.equipos].reverse().find(e => { const Q = tamEquipoPx(E.p, e); const w = Math.max(Q.w, 14 / E.V.k), h = Math.max(Q.h, 14 / E.V.k); return Math.abs(q[0] - e.x) <= w / 2 + tol() && Math.abs(q[1] - e.y) <= h / 2 + tol(); }); }
const rutaEn = q => [...E.p.rutas].reverse().find(r => r.pts.some((v, i) => i && distSeg(q, r.pts[i - 1], v) < tol()));
const cotaEn = q => E.p.cotas.find(c => distSeg(q, c.a, c.b) < tol());
function textoEn(q) { return E.p.textos.find(t => { const h = Math.max(altoTextoPx(E.p, t), 7 / E.V.k); return q[0] >= t.p[0] - 3 / E.V.k && q[0] <= t.p[0] + t.s.length * h * .55 && q[1] <= t.p[1] + 3 / E.V.k && q[1] >= t.p[1] - h; }); }
const figEn = q => [...(E.p.figPaneles || [])].reverse().find(f => f.pts.length >= 3 && pointInPoly(q, f.pts));
const norteEn = q => E.p.norte && dist(q, [E.p.norte.x, E.p.norte.y]) < 36 / E.V.k;
function bloqueEn(q) { const B = E.R.bloques.find(b => pointInPoly(q, b.q)); return B ? { ...B, rid: E.p.roofs[B.ri].id } : null; }
function gripEn(q) {
  const s = E.sel; if (!s) return null; const d = 8 / E.V.k;
  if (s.t === 'roof') { const r = E.p.roofs.find(x => x.id === s.id); const i = r ? r.poly.findIndex(v => dist(v, q) < d) : -1; if (i >= 0) return { arr: r.poly, i }; }
  if (s.t === 'ruta') { const r = E.p.rutas.find(x => x.id === s.id); const i = r ? r.pts.findIndex(v => dist(v, q) < d) : -1; if (i >= 0) return { arr: r.pts, i }; }
  if (s.t === 'fig') { const f = (E.p.figPaneles || []).find(x => x.id === s.id); const i = f ? f.pts.findIndex(v => dist(v, q) < d) : -1; if (i >= 0) return { arr: f.pts, i }; }
  if (s.t === 'cota') { const c = E.p.cotas.find(x => x.id === s.id); if (c) { if (dist(c.a, q) < d) return { obj: c, k: 'a' }; if (dist(c.b, q) < d) return { obj: c, k: 'b' }; } }
  // sin escala, las esquinas de un equipo lo agrandan o achican
  if (s.t === 'equipo' && !escala(E.p)) { const e = E.p.equipos.find(x => x.id === s.id); if (e) { const Q = tamEquipoPx(E.p, e), w = Math.max(Q.w, 12 / E.V.k) / 2, h = Math.max(Q.h, 12 / E.V.k) / 2;
    if ([[-w, -h], [w, -h], [w, h], [-w, h]].some(v => dist([e.x + v[0], e.y + v[1]], q) < d)) return { eq: e, d0: Math.max(dist([e.x, e.y], q), 1e-6), f0: e.f || 1 }; } }
  if (s.t === 'ref' && E.p.ref) { if (dist(E.p.ref.a, q) < d) return { obj: E.p.ref, k: 'a' }; if (dist(E.p.ref.b, q) < d) return { obj: E.p.ref, k: 'b' }; }
  return null;
}
const listaEtq = of => of === 'equipo' ? E.p.equipos : of === 'string' ? E.p.strings : E.p.rutas;
const duenoEtq = s => s && s.t === 'etq' ? listaEtq(s.of).find(x => x.id === s.id) : null;
function etqEn(q) { const sq = aPant(q); return [...(E.hits || [])].reverse().find(h => sq[0] >= h.caja[0] && sq[0] <= h.caja[2] && sq[1] >= h.caja[1] && sq[1] <= h.caja[3]); }
function objetoEn(q) {
  if (E.step === 'etiquetas') { const et = etqEn(q); if (et) return { t: 'etq', of: et.of, id: et.id };
    if (norteEn(q)) return { t: 'norte' }; const tx = textoEn(q); if (tx) return { t: 'texto', id: tx.id }; const ct = cotaEn(q); if (ct) return { t: 'cota', id: ct.id }; return null; }
  const et = etqEn(q); if (et && ((et.of === 'equipo' && E.capas.has('equipos')) || (et.of === 'ruta'))) return { t: 'etq', of: et.of, id: et.id };
  if (E.capas.has('textos') && norteEn(q)) return { t: 'norte' };
  const tx = E.capas.has('textos') && textoEn(q); if (tx) return { t: 'texto', id: tx.id };
  const ct = E.capas.has('cotas') && cotaEn(q); if (ct) return { t: 'cota', id: ct.id };
  const eq = E.capas.has('equipos') && equipoEn(q); if (eq) return { t: 'equipo', id: eq.id };
  const rt = E.capas.has('canal') && rutaEn(q); if (rt) return { t: 'ruta', id: rt.id };
  if (E.step === 'elementos' || E.step === 'techos') { const z = E.capas.has('zonas') && zonaEn(q); if (z) return { t: 'zona', id: z.id }; }
  if (E.step === 'escala' && E.p.ref && distSeg(q, E.p.ref.a, E.p.ref.b) < tol()) return { t: 'ref' };
  const fg = E.capas.has('paneles') && figEn(q); if (fg) return { t: 'fig', id: fg.id };
  const r = E.capas.has('techos') && techoEn(q); if (r && E.step !== 'equipos') return { t: 'roof', id: r.id };
  return null;
}

/* ---------- Puntero ---------- */
function down(ev) {
  const cv = $('#cv'); try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* evento sintético */ } cv.focus({ preventScroll: true });
  const sp = ptEv(ev); E.mouse = sp;
  if (ev.button === 1 || E.tool === 'pan' || E.espacio) { E.D = { kind: 'pan', s: sp, o: [E.V.ox, E.V.oy] }; return; }
  if (ev.button !== 0) return;
  const q = cursorFoto(), raw = aFoto(...sp), p = E.p;
  // Herramientas de dibujo
  if (E.tool === 'ref') { if (!E.temp) { E.temp = { tipo: 'linea', a: q }; prompt('Precise el segundo punto de la referencia:'); } else { antes(); p.ref = { a: E.temp.a, b: q, mm: p.ref && p.ref.mm || null }; E.temp = null; E.tool = 'sel'; E.sel = { t: 'ref' }; despues(); render(); pedirMedidaRef(); } return; }
  if (E.tool === 'cota') { if (!E.temp) { E.temp = { tipo: 'linea', a: q }; prompt('COTA  Precise el segundo punto:'); } else { antes(); const c = { id: uid('c'), a: E.temp.a, b: q }; p.cotas.push(c); E.temp = null; E.sel = { t: 'cota', id: c.id }; despues();
      if (escala(p)) { log(`COTA  ${fmt(dist(c.a, c.b) * escala(p) / 1000, 2)} m`); prompt('COTA  Precise el primer punto (Esc para terminar):'); }
      else { E.esperando = 'cota'; prompt('COTA  Medida en metros (o un texto; Enter la deja con «?»):'); setTimeout(() => $('#cmdIn')?.focus(), 0); } } dibujarTodo(); return; }
  if (E.tool === 'texto') { const s = window.prompt('Texto:'); if (s) { antes(); const t = { id: uid('x'), p: q, s, h: 400 }; p.textos.push(t); E.sel = { t: 'texto', id: t.id }; E.tool = 'sel'; despues(); render(); } return; }
  if (E.tool === 'norte') { antes(); p.norte = { x: q[0], y: q[1], ang: p.norte ? p.norte.ang : 0 }; E.sel = { t: 'norte' }; E.tool = 'sel'; despues(); render(); return; }
  if (E.tool === 'roof') {
    if (!E.temp) { if (!q) return; E.temp = { tipo: 'poly', pts: [q], col: '#FFFFFF' }; prompt('TECHO  Precise el siguiente punto o [Cerrar] (Enter cierra):'); }
    else if (E.temp.pts.length >= 3 && dist(aPant(E.temp.pts[0]), sp) < 10) cerrarTecho();
    else E.temp.pts.push(q);
    dibujarTodo(); return;
  }
  if (E.tool === 'figpan') {
    if (!E.temp) { E.temp = { tipo: 'poly', pts: [q], col: '#2FD06B' }; prompt(E.figForma === 'poly' ? 'PANELES  Precise el siguiente punto (Enter cierra):' : 'PANELES  Esquinas en orden: arriba-izq, arriba-der, abajo-der, abajo-izq'); }
    else if (E.figForma === 'poly' && E.temp.pts.length >= 3 && dist(aPant(E.temp.pts[0]), sp) < 10) cerrarFigura();
    else { E.temp.pts.push(q); if (E.figForma !== 'poly' && E.temp.pts.length === 4) cerrarFigura(); }
    dibujarTodo(); return;
  }
  if (E.tool === 'ruta') {
    if (!E.temp) { E.temp = { tipo: 'poly', pts: [q], col: CANAL[E.rutaK].c, dash: CANAL[E.rutaK].dash }; prompt(`${CANAL[E.rutaK].corto}  Precise el siguiente punto (Enter o doble clic termina):`); }
    else E.temp.pts.push(q);
    dibujarTodo(); return;
  }
  if (E.tool === 'equipo') { antes(); const e = { id: uid('e'), k: E.eqK, x: q[0], y: q[1], ang: 0 }; p.equipos.push(e); E.sel = { t: 'equipo', id: e.id }; log(`EQUIPO  ${EQUIPOS[E.eqK].n}`); despues(); return; }
  if (E.tool === 'zona') { const z = zonaEn(raw); if (z) { E.sel = { t: 'zona', id: z.id }; E.D = { kind: 'mover', a: raw, last: raw, first: true }; panel(); dibujarTodo(); return; } E.D = { kind: 'nuevaZona', a: raw, b: raw }; return; }
  if (E.tool === 'str') {
    const pn = panelEn(raw);
    if (pn && !pn.off && !pn.bad) { E.D = { kind: 'clicPanel', pn, a: raw, b: raw }; }
    else E.D = { kind: 'ventana', a: raw, b: raw };
    return;
  }
  // Seleccionar
  const gr = gripEn(raw); if (gr) { antes(); E.D = { kind: 'grip', gr, first: false }; return; }
  if (E.step === 'paneles') return downPaneles(raw, ev);
  const o = objetoEn(raw);
  E.sel = o; if (o && o.t === 'roof' && E.step === 'equipos') E.sel = null;
  if (o && ['equipo', 'zona', 'texto', 'norte', 'ruta', 'cota', 'fig', 'etq'].includes(o.t)) E.D = { kind: 'mover', a: raw, last: raw, first: true };
  panel(); dibujarTodo();
}
function downPaneles(raw, ev) {
  const p = E.p, act = techoAct(), B = bloqueEn(raw);
  if (act && act.modo === 'manual') {
    if (B && E.sel && E.sel.t === 'bloque' && E.sel.ri === B.ri && E.sel.bi === B.bi) { E.D = { kind: 'moverBloque', a: raw, last: raw, first: true, B }; return; }
    if (B && p.roofs[B.ri].id === act.id) { E.sel = { t: 'bloque', ri: B.ri, bi: B.bi, rid: act.id }; E.D = { kind: 'moverBloque', a: raw, last: raw, first: true, B }; panel(); dibujarTodo(); return; }
    if (pointInPoly(raw, act.poly)) { const s = escala(p); if (!s) return; antes(); const ang = anguloBordeCercano(act.poly, raw); act.bloques.push({ id: uid('b'), x: raw[0], y: raw[1], f: E.blk.f, c: E.blk.c, ang }); E.sel = { t: 'bloque', ri: p.roofs.indexOf(act), bi: act.bloques.length - 1, rid: act.id }; log(`BLOQUE ${E.blk.f}×${E.blk.c}`); despues(); return; }
  }
  if (act && act.modo !== 'manual' && pointInPoly(raw, act.poly)) { const pn = panelEn(raw); if (pn && pn.rid === act.id) { antes(); act.off = act.off || []; const i = act.off.indexOf(pn.key); i >= 0 ? act.off.splice(i, 1) : act.off.push(pn.key); despues(); return; } }
  const et0 = etqEn(raw), r = techoEn(raw); E.sel = et0 ? { t: 'etq', of: et0.of, id: et0.id } : r ? { t: 'roof', id: r.id } : objetoEn(raw);
  if (E.sel && ['equipo', 'texto', 'norte', 'cota', 'ruta', 'etq'].includes(E.sel.t)) E.D = { kind: 'mover', a: raw, last: raw, first: true };
  panel(); dibujarTodo();
}
function move(ev) {
  const sp = ptEv(ev); E.mouse = sp;
  const q = aFoto(...sp), s = escala(E.p), c = $('#coords');
  if (c) c.textContent = s ? `X ${fmt(q[0] * s / 1000, 2)}  Y ${fmt((E.p.h - q[1]) * s / 1000, 2)} m` : `X ${fmt(q[0], 0)}  Y ${fmt(q[1], 0)} px`;
  const D = E.D;
  if (D) {
    if (D.kind === 'pan') { E.V.ox = D.o[0] - (sp[0] - D.s[0]); E.V.oy = D.o[1] - (sp[1] - D.s[1]); }
    else if (D.kind === 'grip' && D.gr.eq) { const e = D.gr.eq; e.f = Math.max(.1, Math.min(20, Math.round(D.gr.f0 * dist([e.x, e.y], q) / D.gr.d0 * 100) / 100)); }
    else if (D.kind === 'grip') { const qq = cursorFoto(); if (D.gr.arr) D.gr.arr[D.gr.i] = qq; else D.gr.obj[D.gr.k] = qq; recalcular(); }
    else if (D.kind === 'mover' || D.kind === 'moverBloque') {
      const dx = q[0] - D.last[0], dy = q[1] - D.last[1]; if (!dx && !dy) return;
      if (D.first) { antes(); D.first = false; } D.last = q; moverSel(dx, dy, D); recalcular();
    }
    else if (D.kind === 'nuevaZona' || D.kind === 'ventana' || D.kind === 'clicPanel') { D.b = q; if (D.kind === 'clicPanel' && dist(aPant(D.a), sp) > 6) D.kind = 'ventana'; }
  }
  // cursor del sistema según lo que hay debajo
  const cv = $('#cv'); cv.style.cursor = E.tool === 'pan' || (D && D.kind === 'pan') ? 'grab' : 'none';
  dibujarTodo();
}
function up(ev) {
  const D = E.D; E.D = null; if (!D) return;
  const p = E.p;
  if (D.kind === 'nuevaZona') {
    const z = zonaDeArrastre(D.a, D.b);
    if (z.w * E.V.k > 6 && z.h * E.V.k > 6) { antes(); z.id = uid('z'); p.zonas.push(z); E.sel = { t: 'zona', id: z.id }; log(`ZONA  ${ZONAS[z.k].n}`); despues(); }
    else { E.sel = null; panel(); dibujarTodo(); }
    return;
  }
  if (D.kind === 'clicPanel') { asignarPaneles([D.pn.key], ev.shiftKey); return; }
  if (D.kind === 'ventana') {
    const x0 = Math.min(D.a[0], D.b[0]), x1 = Math.max(D.a[0], D.b[0]), y0 = Math.min(D.a[1], D.b[1]), y1 = Math.max(D.a[1], D.b[1]), cruce = D.b[0] < D.a[0];
    const dentro = pn => cruce ? pn.q.some(v => v[0] >= x0 && v[0] <= x1 && v[1] >= y0 && v[1] <= y1) || pointInPoly([x0, y0], pn.q) : pn.q.every(v => v[0] >= x0 && v[0] <= x1 && v[1] >= y0 && v[1] <= y1);
    const keys = E.R.validos.filter(dentro).map(pn => pn.key);
    if (keys.length) asignarPaneles(keys, ev.shiftKey, true); else dibujarTodo();
    return;
  }
  if (D.kind === 'grip' || D.kind === 'mover' || D.kind === 'moverBloque') { if (D.kind !== 'grip' && D.first) { panel(); dibujarTodo(); return; } despues(); }
  dibujarTodo();
}
function wheel(ev) { ev.preventDefault(); const sp = ptEv(ev); zoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15, sp[0], sp[1]); }
function dbl() { if (E.tool === 'ruta' && E.temp) { E.temp.pts.pop(); terminar(); } }
function zonaDeArrastre(a, b) {
  const z = { k: E.zonaK, forma: E.zonaForma, ang: 0 };
  if (E.zonaForma === 'circ') { const r = dist(a, b); return { ...z, x: a[0] - r, y: a[1] - r, w: 2 * r, h: 2 * r }; }
  return { ...z, x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
}
function moverSel(dx, dy, D) {
  const s = E.sel, p = E.p; if (!s) return;
  if (s.t === 'equipo') { const e = p.equipos.find(x => x.id === s.id); e.x += dx; e.y += dy; }
  if (s.t === 'zona') { const z = p.zonas.find(x => x.id === s.id); z.x += dx; z.y += dy; }
  if (s.t === 'texto') { const t = p.textos.find(x => x.id === s.id); t.p = [t.p[0] + dx, t.p[1] + dy]; }
  if (s.t === 'norte') { p.norte.x += dx; p.norte.y += dy; }
  if (s.t === 'cota') { const c = p.cotas.find(x => x.id === s.id); c.a = [c.a[0] + dx, c.a[1] + dy]; c.b = [c.b[0] + dx, c.b[1] + dy]; }
  if (s.t === 'ruta') { const r = p.rutas.find(x => x.id === s.id); r.pts = r.pts.map(v => [v[0] + dx, v[1] + dy]); }
  if (s.t === 'etq') { const ow = duenoEtq(s); if (!ow) return; const et = (ow.etq ||= {}); if (et.fijo) return;
    if (et.dx == null) { const h = (E.hits || []).find(x => x.of === s.of && x.id === s.id); if (!h) return; et.dx = h.pos[0] - h.anchor[0]; et.dy = h.pos[1] - h.anchor[1]; }
    et.dx += dx; et.dy += dy; }
  if (s.t === 'fig') { const f = (p.figPaneles || []).find(x => x.id === s.id); if (f) f.pts = f.pts.map(v => [v[0] + dx, v[1] + dy]); }
  if (s.t === 'bloque') { const b = p.roofs[s.ri].bloques[s.bi]; b.x += dx; b.y += dy; }
}

/* ---------- Acciones de dibujo ---------- */
function cerrarTecho() {
  const t = E.temp; if (!t || t.pts.length < 3) return toast('Un techo necesita al menos 3 esquinas');
  antes(); const p = E.p, r = nuevoTecho(p, p.roofs[p.roofs.length - 1]); r.poly = t.pts; r.closed = true; r.ang = edgeAngle(r.poly);
  p.roofs.push(r); E.temp = null; E.sel = { t: 'roof', id: r.id };
  prompt('TECHO  Precise el primer punto del siguiente techo:'); despues();
  log(`TECHO ${p.roofs.length} cerrado · ${fmt(E.R.porTecho[p.roofs.length - 1].area, 1)} m²`);
}
/* Paneles dibujados (cualquier hoja, con o sin escala, también en perspectiva) */
function cerrarFigura() {
  const t = E.temp; if (!t || t.pts.length < 3) return;
  antes(); const f = { id: uid('f'), tipo: E.figForma === 'poly' || t.pts.length !== 4 ? 'poly' : 'grid', pts: t.pts, f: E.figFC.f, c: E.figFC.c };
  (E.p.figPaneles ||= []).push(f); E.p.figPaneles = E.p.figPaneles; E.temp = null; E.sel = { t: 'fig', id: f.id };
  log(`PANELES dibujados ${f.tipo === 'grid' ? `${f.f} × ${f.c}` : '(figura)'}`); prompt('Comando:'); despues();
}
function terminar() {
  const t = E.temp;
  if (E.tool === 'figpan' && t) { if (t.pts.length >= 3) cerrarFigura(); else { E.temp = null; dibujarTodo(); } return; }
  if (E.tool === 'roof' && t) { if (t.pts.length >= 3) cerrarTecho(); else { E.temp = null; dibujarTodo(); } return; }
  if (E.tool === 'ruta' && t) {
    if (t.pts.length >= 2) { antes(); const st = E.p.strings[0]; const r = { id: uid('r'), k: E.rutaK, pts: t.pts, tramo: CANAL[E.rutaK]?.dc ? (E.strAct || (st && st.id) || '') : ['tie', 'riel'].includes(E.rutaK) ? '' : 'inv-tg' }; E.p.rutas.push(r); E.sel = { t: 'ruta', id: r.id }; log(`CANALIZACIÓN ${CANAL[r.k].corto}  ${fmt(largoM(E.p, r.pts), 1)} m`); E.temp = null; despues(); }
    else { E.temp = null; dibujarTodo(); }
    prompt('Comando:'); return;
  }
  if (t) { E.temp = null; dibujarTodo(); }
  prompt('Comando:');
}
function cancelar() { E.temp = null; E.D = null; E.esperando = null; if (!['ref', 'roof', 'zona', 'str'].includes(E.tool)) E.tool = 'sel'; prompt('Comando:'); log('*Cancelar*'); render(); }
function asignarPaneles(keys, quitar, ventana) {
  const p = E.p; let st = p.strings.find(x => x.id === E.strAct);
  if (!st) { st = nuevoString(); }
  antes();
  const enOtro = k => p.strings.find(x => x !== st && x.panels.includes(k));
  if (!ventana && keys.length === 1 && st.panels.includes(keys[0])) quitar = true;
  keys.forEach(k => {
    if (quitar) { st.panels = st.panels.filter(x => x !== k); return; }
    const o = enOtro(k); if (o) o.panels = o.panels.filter(x => x !== k);
    if (!st.panels.includes(k)) st.panels.push(k);
  });
  despues();
}
function nuevoString() {
  const p = E.p, usados = new Set(p.strings.map(x => x.mppt)); let m = 1; while (usados.has(m)) m++;
  const inv = inversorDe(p); if (m > inv.mppt) m = 1;
  const st = { id: uid('s'), mppt: m, num: p.strings.filter(x => x.mppt === m).length + 1, panels: [], color: COLORES_STRING[p.strings.length % COLORES_STRING.length] };
  p.strings.push(st); E.strAct = st.id; return st;
}
/* Reparte los paneles sin string: por techo, en strings de igual tamaño dentro del rango MPPT. */
function autoStrings() {
  const p = E.p, R = E.R, inv = inversorDe(p), usados = new Set(p.strings.flatMap(s => s.panels));
  const libres = R.validos.filter(pn => !usados.has(pn.key)); if (!libres.length) return toast('Todos los paneles ya tienen string');
  antes();
  const P = panelDe(p), maxN = Math.floor(inv.vdcMax / (P.voc * (1 + (P.coefVoc / 100) * (-30)))), minN = Math.ceil(inv.vmin / P.vmp) || 1;
  const porTecho = new Map(); libres.forEach(pn => { if (!porTecho.has(pn.rid)) porTecho.set(pn.rid, []); porTecho.get(pn.rid).push(pn); });
  porTecho.forEach(lista => {
    // ordenar como se leen: por filas (y) y luego x, en el sistema del techo
    const r = p.roofs.find(x => x.id === lista[0].rid), a = (r.ang || 0) * Math.PI / 180, c = centroid(r.poly);
    lista.sort((A, B) => { const ca = rotP(centroid(A.q), c, -a), cb = rotP(centroid(B.q), c, -a); return Math.abs(ca[1] - cb[1]) > 5 ? ca[1] - cb[1] : ca[0] - cb[0]; });
    const nStr = Math.max(1, Math.ceil(lista.length / maxN)), tam = Math.ceil(lista.length / nStr);
    for (let i = 0; i < lista.length; i += tam) { const st = nuevoString(); st.panels = lista.slice(i, i + tam).map(pn => pn.key); }
  });
  log(`STRINGS automáticos: ${p.strings.length} (máx. ${maxN} paneles por string, mín. ${minN})`);
  despues(); render();
}
function pedirMedidaRef() { prompt('Largo real de la referencia en metros:'); const i = $('#cmdIn'); if (i) { E.esperando = 'ref'; i.focus(); } }

/* ---------- Teclado y línea de comandos ---------- */
function teclas(ev) {
  if (E && E.step === 'ficha' && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarYa().then(() => toast('Proyecto guardado')); return; }
  if (!E || esPagina()) return;
  const enInput = ev.target.matches('input, textarea, select') && ev.target.id !== 'cmdIn';
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { if (enInput) return; ev.preventDefault(); deshacer(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { if (enInput) return; ev.preventDefault(); rehacer(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarYa().then(() => toast('Proyecto guardado')); return; }
  if (ev.key === 'F3') { ev.preventDefault(); toggle('refent'); return; }
  if (ev.key === 'F7') { ev.preventDefault(); toggle('rejilla'); return; }
  if (ev.key === 'F8') { ev.preventDefault(); toggle('orto'); return; }
  if (enInput) return;
  if (ev.key === 'Escape') { ev.preventDefault(); if (E.temp || E.D) cancelar(); else { E.sel = null; E.esperando = null; panel(); dibujarTodo(); prompt('Comando:'); } return; }
  if (ev.key === ' ' && ev.target.id !== 'cmdIn') { ev.preventDefault(); if (!E.espacio) { E.espacio = true; } return; }
  if ((ev.key === 'Delete' || ev.key === 'Supr') && ev.target.id !== 'cmdIn') { borrarSel(); return; }
  if (ev.key === 'Enter' && ev.target.id !== 'cmdIn') { terminar(); return; }
  // como en AutoCAD: escribir con el foco en el dibujo va a la línea de comandos
  if (ev.target.id !== 'cmdIn' && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { const i = $('#cmdIn'); if (i) { i.focus(); } }
}
window.addEventListener('keyup', ev => { if (E && ev.key === ' ') E.espacio = false; });
function toggle(k) { E[k] = !E[k]; $$(`[data-act="tog"][data-k="${k}"]`).forEach(b => b.setAttribute('aria-pressed', E[k])); log(`<${k.toUpperCase()} ${E[k] ? 'activado' : 'desactivado'}>`); dibujarTodo(); }
const COMANDOS = {
  AYUDA: 'Comandos: TECHO (TE), ZONA (Z0), COTA (CO), TEXTO (T), NORTE, RUTA/CC/CA/SUB, EQUIPO (EQ), MEDIDAS (MED), BORRAR (B), ZOOM (Z), DESHACER (U), ORTO, REJILLA, REFENT, STRING (ST), AUTOSTRING, PASO 1-7. Escribe una distancia en metros para el siguiente punto.',
};
function cmdKey(ev) {
  if (ev.key === 'Escape') { ev.target.value = ''; ev.target.blur(); cancelar(); return; }
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const v = ev.target.value.trim(); if (ev.key === ' ' && !v) { ev.preventDefault(); terminar(); return; }
  if (ev.key === ' ' && E.esperando) return; // permitir espacios en respuestas
  ev.preventDefault(); ev.target.value = '';
  if (!v && E.esperando === 'cota') { E.esperando = null; prompt('COTA  Precise el primer punto (Esc para terminar):'); $('#cv')?.focus(); return; }
  if (!v) { terminar(); return; }
  ejecutar(v);
}
function ejecutar(v) {
  const p = E.p, n = parseNum(v);
  log(`Comando: ${v}`);
  if (E.esperando === 'cota') { const c = E.sel && E.sel.t === 'cota' && p.cotas.find(x => x.id === E.sel.id); E.esperando = null; if (c) { antes(); c.txt = n != null ? String(v).replace('.', ',') : v; log(`COTA  ${textoCota(p, c)}`); despues(); } prompt('COTA  Precise el primer punto (Esc para terminar):'); $('#cv')?.focus(); return; }
  if (E.esperando === 'ref') { if (n && n > 0) { antes(); p.ref.mm = n * 1000; E.esperando = null; log(`Referencia = ${fmt(n, 2)} m · 1 px = ${fmt(escala(p), 1)} mm`); prompt('Comando:'); despues(); render(); } else log('Escribe el largo en metros, por ejemplo 9,37'); return; }
  // distancia directa: siguiente punto en la dirección del cursor
  if (n != null && E.temp && E.mouse) {
    const s = escala(p); if (!s) return log('Primero define la escala');
    const base = E.temp.pts ? E.temp.pts[E.temp.pts.length - 1] : E.temp.a, m = cursorFoto(), d = dist(base, m) || 1, L = n * 1000 / s;
    const q = [base[0] + (m[0] - base[0]) / d * L, base[1] + (m[1] - base[1]) / d * L];
    if (E.temp.pts) E.temp.pts.push(q);
    else { const rc = $('#cv').getBoundingClientRect(), sp = aPant(q), rf = E.refent, ro = E.orto; E.refent = false; E.orto = false; down({ pointerId: -1, button: 0, clientX: rc.left + sp[0], clientY: rc.top + sp[1] }); E.refent = rf; E.orto = ro; }
    dibujarTodo(); return;
  }
  const c = v.toUpperCase().split(/\s+/), k = c[0];
  const herr = (t, paso) => { if (paso && E.step !== paso) irPaso(paso); E.tool = t; E.temp = null; render(); pista(); };
  if (k === 'AYUDA' || k === '?') return log(COMANDOS.AYUDA);
  if (['TECHO', 'TE', 'PL'].includes(k)) return herr('roof', 'techos');
  if (['ZONA', 'Z0', 'REC'].includes(k)) return herr('zona', 'elementos');
  if (['COTA', 'CO', 'DIM', 'ACOTAR'].includes(k)) return herr('cota');
  if (['TEXTO', 'T', 'TX'].includes(k)) return herr('texto');
  if (k === 'NORTE') return herr('norte');
  if (['RUTA', 'L', 'LINEA', 'CC', 'CA', 'SUB'].includes(k)) { if (['CC', 'CA', 'SUB'].includes(k)) E.rutaK = k.toLowerCase(); return herr('ruta', 'equipos'); }
  if (['EQUIPO', 'EQ', 'INV'].includes(k)) return herr('equipo', 'equipos');
  if (['BORRAR', 'B', 'E', 'SUPR'].includes(k)) return borrarSel();
  if (['ZOOM', 'Z', 'ZE'].includes(k)) { ajustarVista(); dibujarTodo(); return; }
  if (['DESHACER', 'U', 'H'].includes(k)) return deshacer();
  if (['REHACER', 'RH'].includes(k)) return rehacer();
  if (['MEDIDAS', 'MED'].includes(k)) { antes(); p.verMedidas = !p.verMedidas; log(`MEDIDAS de equipos ${p.verMedidas ? 'visibles' : 'ocultas'}`); despues(); return; }
  if (k === 'ORTO') return toggle('orto');
  if (k === 'REJILLA') return toggle('rejilla');
  if (k === 'REFENT') return toggle('refent');
  if (['STRING', 'ST'].includes(k)) { if (E.step !== 'strings') irPaso('strings'); nuevoString(); despues(); render(); return; }
  if (k === 'AUTOSTRING') { if (E.step !== 'strings') irPaso('strings'); return autoStrings(); }
  if (k === 'PASO' && c[1]) { const P = PASOS[+c[1] - 1]; if (P) return irPaso(P[0]); }
  if (k === 'C' && E.tool === 'roof') return terminar();
  log(`Comando desconocido "${v}". Escribe AYUDA.`);
}
function borrarSel() {
  const s = E.sel, p = E.p; if (!s) return toast('No hay nada seleccionado');
  if (s.t === 'etq') { const ow = duenoEtq(s); if (ow) { antes(); (ow.etq ||= {}).oculta = true; E.sel = null; log('ETIQUETA quitada'); despues(); } return; }
  antes();
  const quitar = (arr, id) => { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); };
  if (s.t === 'roof') { quitar(p.roofs, s.id); }
  else if (s.t === 'zona') quitar(p.zonas, s.id);
  else if (s.t === 'equipo') quitar(p.equipos, s.id);
  else if (s.t === 'ruta') quitar(p.rutas, s.id);
  else if (s.t === 'cota') quitar(p.cotas, s.id);
  else if (s.t === 'fig') quitar(p.figPaneles || [], s.id);
  else if (s.t === 'texto') quitar(p.textos, s.id);
  else if (s.t === 'norte') p.norte = null;
  else if (s.t === 'ref') p.ref = null;
  else if (s.t === 'bloque') p.roofs[s.ri].bloques.splice(s.bi, 1);
  log('BORRAR  1 objeto'); E.sel = null; despues();
}

/* ---------- Pasos ---------- */
function irPaso(k) { E.step = k; E.tool = HERR_DEF[k]; E.temp = null; E.D = null; if (k !== 'paneles' && E.sel && E.sel.t === 'bloque') E.sel = null; render(); pista(); programarGuardado(); }
function pista() {
  const h = $('#hint'); if (!h) return;
  const p = E.p, t = E.tool;
  const txt = {
    ref: p.ref ? 'Clic en dos puntos para trazar otra referencia' : 'Clic en los dos extremos de algo que mediste (un borde del techo)',
    roof: 'Clic en cada esquina · Enter o clic en la primera esquina cierra · escribe metros para un largo exacto',
    zona: E.zonaForma === 'circ' ? 'Arrastra desde el centro para un círculo · clic en una zona para editarla' : 'Arrastra para marcar la zona · clic en una zona para editarla',
    str: 'Clic en un panel lo agrega o quita del string activo · arrastra una ventana para varios (Shift quita)',
    equipo: `Clic donde va ${EQUIPOS[E.eqK].n.toLowerCase()}`, ruta: 'Clic en cada punto del recorrido · Enter o doble clic termina',
    cota: 'Clic en dos puntos para acotar', figpan: E.figForma === 'poly' ? 'Clic en cada esquina de la figura · Enter o clic en la primera cierra' : 'Clic en las 4 esquinas (arriba-izq, arriba-der, abajo-der, abajo-izq): sirve en perspectiva', texto: 'Clic donde va el texto', norte: 'Clic donde va el norte', pan: 'Arrastra para mover la vista',
    sel: E.step === 'etiquetas' ? 'Clic en una etiqueta, cota o texto para editarla · arrástrala para moverla · Supr la quita' : E.step === 'paneles' ? (techoAct() && techoAct().modo === 'manual' ? 'Clic en un lugar vacío del techo para poner un bloque · clic en un bloque para editarlo' : 'Clic en un techo para elegirlo · clic en un panel lo saca o devuelve') : 'Clic para seleccionar · arrastra para mover · Supr borra'
  }[t] || '';
  h.textContent = txt; h.hidden = !txt;
}

/* ---------- Hojas de diseño: pestañas, cambiar, crear, editar ---------- */
function barraHojas() {
  const P = E.proyecto, hs = P.hojas || [];
  const tab = (id, nombre, tipo, foto) => `<button class="hoja-tab" data-act="hoja" data-id="${id || ''}" aria-pressed="${(id || null) === E.hojaId}" title="${esc(nombre)}${foto ? '' : ' · sin foto'}">${ic(ICONO_HOJA[tipo] || 'crop', 14)}<span>${esc(nombre)}</span>${foto ? '' : '<em class="sin-foto" aria-hidden="true"></em>'}</button>`;
  return `<nav class="hojas-bar" aria-label="Hojas de diseño"><span class="hojas-t">Hojas</span>
    ${tab(null, nombrePrincipal(P), tipoPrincipal(P) === 'techo' ? 'principal' : tipoPrincipal(P), !!P.img)}${hs.map(h => tab(h.id, h.nombre, h.tipo, !!h.img)).join('')}
    <button class="hoja-mas" data-act="hoja-nueva" title="Agregar una hoja de diseño: otra foto con su escala y sus dibujos">${ic('plus', 14)}<span>Nueva hoja</span></button>
    <span class="tb-sp"></span><button class="hoja-ed" data-act="hoja-renombrar" title="Cambiar el nombre de la hoja activa (también: doble clic en la pestaña)">Cambiar nombre</button><button class="hoja-ed" data-act="hoja-duplicar" title="Hacer una copia de la hoja activa con su foto y sus dibujos">Duplicar hoja</button><button class="hoja-ed" data-act="hoja-editar" title="Tipo, nombre o borrar la hoja activa">Editar hoja</button></nav>`;
}
function renombrarHoja() {
  const h = hojaActiva(), P = E.proyecto, actual = h ? h.nombre : nombrePrincipal(P);
  const n = (window.prompt('Nombre de la hoja:', actual) || '').trim(); if (!n || n === actual) return;
  antes(); if (h) h.nombre = n; else P.nombreHojaPrincipal = n; despues(); render();
}
function duplicarHoja() {
  const P = E.proyecto, h = hojaActiva(), src = h || P, tipo = h ? h.tipo : (tipoPrincipal(P) === 'techo' ? 'otra' : tipoPrincipal(P));
  const copia = nuevaHoja(tipo, `${h ? h.nombre : nombrePrincipal(P)} (copia)`);
  CLAVES_HOJA.forEach(k => { if (src[k] !== undefined) copia[k] = k === 'img' ? src[k] : clone(src[k]); });
  antes(); const hs = (P.hojas ||= []), i = h ? hs.indexOf(h) + 1 : 0; hs.splice(i, 0, copia); despues(false);
  cambiarHoja(copia.id); toast('Hoja duplicada');
}
function cambiarHoja(id) {
  id = id || null; if (id === E.hojaId) return;
  E.hojaId = id; E.p = vistaHoja(E.proyecto, id);
  E.sel = null; E.temp = null; E.D = null; E.selPanels.clear(); E.V = null; E.strAct = E.p.strings[0]?.id || null;
  if (!pasosVisibles().some(([k]) => k === E.step)) E.step = E.p.img ? 'equipos' : 'escala';
  if (id && !['ficha', 'lamina'].includes(E.step) && !E.p.img) E.step = 'escala';
  E.tool = HERR_DEF[E.step];
  render(); pista(); programarGuardado();
  cargarImg(E.p.img).then(() => { if (!E) return; ajustarVista(); dibujarTodo(); });
}
function dialogoHoja(h) {
  const nueva = !h, principal = h === 'principal', P = E.proyecto;
  const tipoAct = nueva ? 'canalizacion' : principal ? tipoPrincipal(P) : h.tipo;
  const nombre = nueva ? TIPOS_HOJA.canalizacion : principal ? nombrePrincipal(P) : h.nombre;
  const TIPOS = principal ? TIPOS_PRINCIPAL : TIPOS_HOJA;
  const d = document.createElement('dialog'); d.className = 'dlg';
  d.innerHTML = `<form method="dialog"><h2>${nueva ? 'Nueva hoja de diseño' : 'Hoja de diseño'}</h2>
    <p class="mut">${nueva ? 'Cada hoja tiene su propia foto, escala y dibujos: el recorrido de la canalización, la zona de equipos, el cargador… Después eliges en el informe cuáles mostrar.' : principal ? 'La hoja principal es la primera foto del proyecto: el techo con paneles (foto de dron) en un proyecto fotovoltaico, o por ejemplo el cargador en un proyecto EXT. No se puede borrar.' : ''}</p>
    ${`<div class="f"><span>Tipo</span><div class="hoja-tipos">${Object.entries(TIPOS).map(([k, n]) => `<label><input type="radio" name="tipo" value="${k}" ${k === tipoAct ? 'checked' : ''}><span>${ic(ICONO_HOJA[k], 15)} ${n}</span></label>`).join('')}</div></div>`}
    <label class="f"><span>Nombre</span><input class="in" name="nombre" value="${esc(nombre)}" required maxlength="60"></label>
    <div class="row end">${!nueva && !principal ? '<button class="btn del" value="borrar" formnovalidate>Borrar hoja</button><span class="tb-sp"></span>' : ''}<button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn pri" value="ok">${nueva ? 'Crear hoja' : 'Guardar'}</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  const nom = d.querySelector('[name=nombre]'); let tocado = false; nom.addEventListener('input', () => { tocado = true; });
  d.querySelectorAll('[name=tipo]').forEach(r => r.addEventListener('change', () => { if ((nueva || principal) && !tocado) nom.value = r.value === 'techo' ? 'Techo (dron)' : TIPOS[r.value]; }));
  d.addEventListener('close', () => {
    const v = d.returnValue, fd = new FormData(d.querySelector('form')), n = String(fd.get('nombre') || '').trim();
    if (v === 'ok' && n) {
      antes();
      if (nueva) { const hh = nuevaHoja(fd.get('tipo') || 'otra', n); (P.hojas ||= []).push(hh); despues(false); cambiarHoja(hh.id); toast('Sube la foto de esta hoja y traza su escala'); }
      else if (principal) { P.nombreHojaPrincipal = n; P.tipoHojaPrincipal = fd.get('tipo') || 'techo'; if (!pasosVisibles().some(([k]) => k === E.step)) { E.step = 'escala'; E.tool = HERR_DEF.escala; } despues(); render(); }
      else { h.nombre = n; h.tipo = fd.get('tipo') || h.tipo; despues(); render(); }
    }
    if (v === 'borrar' && confirm(`¿Borrar la hoja "${h.nombre}" con su foto y sus dibujos?`)) { antes(); P.hojas = P.hojas.filter(x => x.id !== h.id); E.hojaId = '__borrada__'; cambiarHoja(null); despues(); }
    d.remove();
  });
}

/* ---------- Panel derecho ---------- */
function panel() {
  const el = $('#props'); if (!el || !E) return;
  if (E.step === 'ficha') { el.innerHTML = panelFicha(E.proyecto); return; }
  if (E.step === 'informe') { el.innerHTML = panelInforme(E.proyecto); return; }
  if (E.step === 'unilineal') { el.innerHTML = panelUnilineal(E.proyecto); return; }
  if (E.step === 'lamina') { el.innerHTML = panelLamina(E.proyecto, E.R, E.SI, { cambio: () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, rerender: () => panel() }); return; }
  const p = E.p, R = E.R, s = escala(p);
  let h = '';
  const sec = (titulo, cuerpo, abierto = true) => `<details class="pp" ${abierto ? 'open' : ''}><summary>${titulo}</summary><div class="pp-b">${cuerpo}</div></details>`;
  const num = (campo, val, unidad, extra = '') => `<label class="f"><span>${unidad.l}</span><span class="fi"><input class="in" data-campo="${campo}" value="${val ?? ''}" inputmode="decimal" ${extra}><em>${unidad.u}</em></span></label>`;
  const rango = (campo, val, min, max, l, u = '°') => `<label class="f"><span>${l}</span><span class="fr"><input type="range" min="${min}" max="${max}" step="1" value="${val}" data-campo="${campo}" data-u="${u}"><output>${val}${u}</output></span></label>`;
  const seg = (campo, val, ops) => `<div class="seg">${ops.map(([k, n]) => `<button data-act="set" data-campo="${campo}" data-v="${k}" aria-pressed="${String(val) === String(k)}">${n}</button>`).join('')}</div>`;

  // Propiedades de lo seleccionado (siempre arriba, como la paleta Propiedades)
  const sl = E.sel;
  if (sl) h += sec(`Propiedades · ${nombreSel(sl)}`, propsSel(sl, { num, rango, seg }));

  if (E.step === 'escala') {
    const gsd = droneGSD(p), dif = s && gsd ? Math.abs(gsd - s) / s * 100 : null;
    h += sec(hojaCorta() ? 'Foto y escala' : '1 · Escala de la foto', `
      <p class="mut">Traza una línea sobre algo que mediste en terreno y escribe su largo: con eso se miden distancias y los equipos quedan a su tamaño real. ${hojaCorta() ? 'Es opcional: sin referencia igual puedes dibujar equipos, canalización y textos (los equipos salen con un tamaño aproximado).' : ''}</p>
      ${!s ? `<label class="chk"><input type="checkbox" data-campo="_sinEscala" ${p.sinEscala ? 'checked' : ''}> Esta hoja no necesita escala</label>` : ''}
      <dl class="dl"><dt>Referencia</dt><dd>${p.ref && p.ref.mm ? fmt(p.ref.mm / 1000, 2) + ' m' : p.ref ? 'Falta el largo' : 'Sin trazar'}</dd><dt>Escala</dt><dd>${s ? `1 px = ${fmt(s, 1)} mm` : '—'}</dd></dl>
      ${p.ref ? num('ref.mm', p.ref.mm ? fmt(p.ref.mm / 1000, 2) : '', { l: 'Largo real', u: 'm' }) : ''}
      <button class="btn" data-act="tool" data-k="ref">${ic('ruler')} ${p.ref ? 'Trazar de nuevo' : 'Trazar referencia'}</button>
      <div class="sub">${ic('drone')} Datos del dron ${p.drone && p.drone.ejemplo ? '<span class="tag">ejemplo</span>' : ''}</div>
      ${p.drone && p.drone.alt ? `<dl class="dl"><dt>Altura de vuelo</dt><dd>${fmt(p.drone.alt, 1)} m</dd><dt>Focal 35 mm</dt><dd>${p.drone.f35} mm</dd><dt>Escala según dron</dt><dd>${gsd ? `1 px = ${fmt(gsd, 1)} mm` : '—'}</dd></dl>
        ${num('drone.roofH', fmt(p.drone.roofH || 0, 1), { l: 'Altura del techo', u: 'm' })}
        ${dif != null ? `<div class="aviso ${dif <= 8 ? 'ok' : 'warn'}">${ic(dif <= 8 ? 'check' : 'alert', 16)}<span>${dif <= 8 ? `Referencia y dron coinciden (diferencia ${fmt(dif, 0)} %).` : `Referencia y dron difieren ${fmt(dif, 0)} %. Revisa la medida o la altura del techo.`}</span></div>` : ''}
        ${!s && gsd ? `<button class="btn" data-act="usar-dron">Usar la escala del dron</button>` : ''}`
      : `<p class="mut">Sube la foto original del dron (sin pasar por WhatsApp) para leer la altura de vuelo y validar la escala.</p>`}
      <label class="btn pri">${ic('upload')} ${p.img ? 'Cambiar foto' : 'Subir foto'}${hojaCorta() ? '' : ' de dron'}<input type="file" accept="image/*" data-act="foto" hidden></label>`);
  }
  if (E.step === 'techos') {
    h += sec('2 · Techos', `
      <p class="mut">Dibuja cada agua por separado. Puedes escribir el largo de cada lado en metros (en la dirección del cursor) y activar ORTO (F8).</p>
      <div class="lista">${p.roofs.map((r, i) => `<button class="li" data-act="sel-roof" data-id="${r.id}" aria-pressed="${E.sel && E.sel.id === r.id}"><b>Techo ${i + 1}</b><span>${r.closed ? `${fmt(R.porTecho[i].area, 1)} m² · incl. ${r.incl}°` : 'sin cerrar'}</span></button>`).join('') || '<p class="mut">Sin techos todavía.</p>'}</div>
      <div class="row"><button class="btn" data-act="tool" data-k="roof">${ic('plus')} Dibujar techo</button>${E.temp && E.tool === 'roof' ? `<button class="btn" data-act="cerrar-techo">Cerrar (Enter)</button>` : ''}</div>
      <dl class="dl"><dt>Área total</dt><dd>${R.area ? fmt(R.area, 1) + ' m²' : '—'}</dd></dl>`);
  }
  if (E.step === 'elementos') {
    h += sec('3 · Elementos', `
      <p class="mut">Marca lo que no puede llevar paneles. Elige el tipo y arrastra sobre la foto.</p>
      ${seg('_zonaForma', E.zonaForma, [['rect', 'Rectángulo'], ['circ', 'Círculo']])}
      <div class="lista">${Object.entries(ZONAS).map(([k, Z]) => `<button class="li" data-act="zonaK" data-k="${k}" aria-pressed="${E.zonaK === k}"><i class="sw" style="border-color:${Z.c};background:${Z.c}33"></i><b>${Z.n}</b><span>${Z.d}</span><em>${p.zonas.filter(z => z.k === k).length || ''}</em></button>`).join('')}</div>
      ${!p.zonas.length ? `<label class="chk"><input type="checkbox" data-campo="sinElementos" ${p.sinElementos ? 'checked' : ''}> El techo no tiene obstáculos</label>` : ''}`);
  }
  if (E.step === 'paneles') {
    const r = techoAct();
    h += sec('4 · Paneles', `
      <div class="kpis"><div><b>${R.n}</b><span>paneles</span></div><div><b>${fmt(R.kwp, 2)}</b><span>kWp</span></div><div><b>${R.area ? fmt(R.area, 0) : '—'}</b><span>m²</span></div></div>
      ${R.rieles && (R.rieles.mm || p.rutas.some(x => x.k === 'riel')) ? `<dl class="dl"><dt>Metros de riel</dt><dd>${fmt((R.rieles.mm / 1000) + p.rutas.filter(x => x.k === 'riel').reduce((t, x) => t + largoRuta(p, x), 0), 1)} m${R.rieles.filas ? ` · ${R.rieles.filas} fila(s)` : ''}</dd></dl>` : ''}
      <div class="lista">${p.roofs.filter(t => t.closed).map(t => { const i = p.roofs.indexOf(t); return `<button class="li" data-act="sel-roof" data-id="${t.id}" aria-pressed="${r && r.id === t.id}"><b>Techo ${i + 1}</b><span>${R.porTecho[i].n} paneles · ${t.modo === 'manual' ? 'manual' : 'automático'}</span></button>`; }).join('') || '<p class="mut">Dibuja un techo primero.</p>'}</div>
      ${r ? `<div class="sub">Techo ${p.roofs.indexOf(r) + 1}</div>
        ${seg('roof.modo', r.modo || 'auto', [['auto', 'Automático'], ['manual', 'Manual (bloques)']])}
        <label class="f"><span>Panel</span><select class="in" data-campo="roof.panel">${PANELES.map(x => `<option value="${x.id}" ${panelDe(p, r).id === x.id ? 'selected' : ''}>${x.n}</option>`).join('')}</select></label>
        ${r.modo === 'manual' ? `<div class="f"><span>Bloque nuevo</span><span class="row">${stepper('blk.f', E.blk.f)} filas × ${stepper('blk.c', E.blk.c)} col.</span></div>` : `
        ${seg('roof.orient', r.orient || 'v', [['v', 'Vertical'], ['h', 'Horizontal']])}
        ${rango('roof.ang', r.ang || 0, -90, 90, 'Giro de los paneles')}
        <button class="btn sm" data-act="alinear">${ic('rot', 15)} Alinear con el borde más largo</button>
        ${num('roof.sepFila', fmt((r.sepFila ?? GAP_FILA) / 10, 0), { l: 'Espacio entre filas', u: 'cm' })}`}
        ${num('roof.setback', fmt((r.setback ?? 400) / 1000, 2), { l: 'Retiro al borde', u: 'm' })}
        <div class="sub">Rieles</div>
        ${seg('riel.modo', (r.rieles && r.rieles.modo) || 'no', [['no', 'Sin rieles'], ['perp', 'Perpendiculares'], ['paral', 'Paralelos']])}
        ${r.rieles && r.rieles.modo && r.rieles.modo !== 'no' ? num('riel.d', r.rieles.d ? fmt(r.rieles.d / 10, 0) : '', { l: 'Distancia entre los 2 rieles', u: 'cm' }, `placeholder="${fmt((r.rieles.modo === 'paral' ? panelDe(p, r).w : panelDe(p, r).h) / 20, 0)} (la mitad del panel)"`) : ''}
        ${R.rieles && R.rieles.porTecho[p.roofs.indexOf(r)] ? `<dl class="dl"><dt>Metros de riel (techo)</dt><dd>${fmt(R.rieles.porTecho[p.roofs.indexOf(r)] / 1000, 1)} m</dd></dl>` : ''}
        ${rango('roof.incl', r.incl || 0, 0, 45, 'Inclinación del techo')}
        <label class="f"><span>La pendiente baja hacia</span>${seg('roof.baja', r.baja || 'abajo', [['abajo', '↓'], ['arriba', '↑'], ['izq', '←'], ['der', '→']])}</label>
        ${(r.off || []).length ? `<button class="btn sm" data-act="devolver">Devolver ${r.off.length} panel(es) sacados</button>` : ''}
        ${r.modo === 'manual' && R.panels.some(pn => pn.rid === r.id && pn.bad) ? `<div class="aviso warn">${ic('alert', 16)}<span>Hay paneles en rojo (fuera del techo, en el retiro, sobre una zona o en sombra). No se cuentan.</span></div>` : ''}` : ''}`);
  }
  if (E.step === 'strings') {
    const S = E.SI, inv = S.inv;
    h += sec('5 · Strings', `
      <label class="f"><span>Inversor</span><select class="in" data-campo="inversor">${['Monofásico', 'Trifásico'].map(fa => `<optgroup label="${fa}s">${INVERSORES.filter(x => x.fase === fa).map(x => `<option value="${x.id}" ${inv.id === x.id ? 'selected' : ''}>${x.modelo} · ${x.kw} kW</option>`).join('')}</optgroup>`).join('')}</select></label>
      <dl class="dl"><dt>MPPT</dt><dd>${inv.mppt} · ${inv.vmin}–${inv.vmax} V</dd><dt>Potencia DC/AC</dt><dd>${fmt(S.pw / 1000, 2)} kWp / ${inv.kw} kW (${fmt(S.ratio * 100, 0)} %)</dd><dt>Sin string</dt><dd class="${S.sinString ? 'neg' : ''}">${S.sinString} paneles</dd></dl>
      <div class="lista">${S.lista.map(x => `<div class="str ${E.strAct === x.st.id ? 'on' : ''}">
        <button class="str-h" data-act="str-act" data-id="${x.st.id}"><i class="sw" style="background:${colorString(p, x.st)}"></i><b>String ${x.idx + 1}</b><span>${x.nombre} · ${x.n} mód.</span>${x.ok ? ic('check', 15) : ic('alert', 15)}</button>
        ${E.strAct === x.st.id ? `<div class="str-b">
          <div class="row"><label class="f mini"><span>MPPT</span><select class="in" data-campo="str.mppt">${Array.from({ length: inv.mppt }, (_, i) => `<option ${x.st.mppt === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
          <label class="f mini"><span>Largo CC</span><span class="fi"><input class="in" data-campo="str.largo" value="${x.largo}" inputmode="decimal"><em>m</em></span></label>
          <label class="f mini"><span>Sección</span><span class="fi"><input class="in" data-campo="str.seccion" value="${x.seccion}" inputmode="decimal"><em>mm²</em></span></label></div>
          <dl class="dl"><dt>Voc / Voc a ${-5}°C</dt><dd>${fmt(x.voc, 1)} / ${fmt(x.vocFrio, 1)} V</dd><dt>Vmp</dt><dd>${fmt(x.vmp, 1)} V</dd><dt>Potencia</dt><dd>${fmt(x.pw, 0)} W</dd><dt>Caída de tensión</dt><dd>${fmt(x.dv, 2)} V · ${fmt(x.dvp, 2)} %</dd></dl>
          ${x.av.map(a => `<div class="aviso warn">${ic('alert', 14)}<span>${a}</span></div>`).join('')}
          <div class="row"><button class="btn sm" data-act="str-vaciar">Quitar paneles</button><button class="btn sm del" data-act="str-del">${ic('trash', 14)} Borrar</button></div></div>` : ''}</div>`).join('') || '<p class="mut">Sin strings. Crea uno y haz clic en sus paneles, o usa “Armar automático”.</p>'}</div>
      <div class="row"><button class="btn" data-act="str-new">${ic('plus')} Nuevo string</button><button class="btn" data-act="str-auto">Armar automático</button></div>`);
  }
  if (E.step === 'etiquetas') {
    const grupo = (of, titulo, xs, nombre) => xs.length ? `<div class="sub">${titulo}</div><div class="lista etq-lista">${xs.map((x, i) => { const oc = x.etq && x.etq.oculta;
      return `<div class="etq-f${E.sel && E.sel.t === 'etq' && E.sel.id === x.id ? ' on' : ''}"><button class="etq-ojo" data-act="etq-ojo" data-of="${of}" data-id="${x.id}" title="${oc ? 'Mostrar' : 'Quitar'}">${ic(oc ? 'eyeoff' : 'eye', 14)}</button><button class="etq-n" data-act="etq-sel" data-of="${of}" data-id="${x.id}" ${oc ? 'disabled' : ''}>${esc(nombre(x, i))}</button></div>`; }).join('')}</div>` : '';
    const nEq = x => x.rotulo || EQUIPOS[x.k]?.n || 'Equipo', nRt = x => x.etqTxt || CANAL[x.k]?.corto || 'Canalización', nSt = (x, i) => x.etqTxt || `String ${i + 1}`;
    E.proyecto.etqVisto = true;
    h += sec('Etiquetas', `<p class="mut">Se ponen solas en cada equipo, canalización y string; aquí quitas las que no sirven y acomodas las demás. Solo se ven desde este paso (y en el informe y las láminas).</p>
      ${rango('hoja.tamEtq', Math.round((p.tamEtq || 1) * 100), 30, 300, 'Tamaño de todas las etiquetas', ' %')}
      ${p.strings.length ? `<label class="chk"><input type="checkbox" data-campo="hoja.encerrar" ${p.encerrarStrings !== false ? 'checked' : ''}> Encerrar los strings (contorno de color)</label>` : ''}
      <div class="row wrap"><button class="btn sm" data-act="etq-todas" data-k="ver">Mostrar todas</button><button class="btn sm" data-act="etq-todas" data-k="quitar">Quitar todas</button><button class="btn sm" data-act="etq-todas" data-k="lugar">Todas a su lugar</button></div>
      ${grupo('equipo', 'Equipos', p.equipos, nEq)}${grupo('ruta', 'Canalizaciones', p.rutas, nRt)}${grupo('string', 'Strings', p.strings, nSt)}
      ${!p.equipos.length && !p.rutas.length && !p.strings.length ? '<p class="mut">Esta hoja no tiene equipos, canalizaciones ni strings.</p>' : ''}`);
    h += sec('Cotas y textos', `<div class="row wrap"><button class="btn sm" data-act="tool" data-k="cota">${ic('dim', 14)} Cota</button><button class="btn sm" data-act="tool" data-k="texto">${ic('text', 14)} Texto</button><button class="btn sm" data-act="tool" data-k="norte">${ic('north', 14)} Norte</button></div>
      ${rango('hoja.tamCotas', Math.round((p.tamCotas || 1) * 100), 30, 300, 'Tamaño del texto de las cotas', ' %')}
      ${p.cotas.length ? `<div class="lista">${p.cotas.map(c => `<button class="li" data-act="sel-obj" data-t="cota" data-id="${c.id}" aria-pressed="${E.sel && E.sel.id === c.id}"><b>Cota</b><span>${esc(textoCota(p, c))}</span></button>`).join('')}</div>` : ''}
      ${p.textos.length ? `<div class="lista">${p.textos.map(t => `<button class="li" data-act="sel-obj" data-t="texto" data-id="${t.id}" aria-pressed="${E.sel && E.sel.id === t.id}"><b>Texto</b><span>${esc(t.s)}</span></button>`).join('')}</div>` : ''}`);
  }
  if (E.step === 'equipos') {
    h += sec('6 · Equipos', `
      <div class="grid2">${Object.entries(EQUIPOS).map(([k, Q]) => `<button class="li cmp" data-act="eqK" data-k="${k}" aria-pressed="${E.tool === 'equipo' && E.eqK === k}"><i class="sw" style="border-color:${Q.c}"></i><b>${Q.n}</b><em>${p.equipos.filter(e => e.k === k).length || ''}</em></button>`).join('')}</div>
      <label class="f"><span>Cantidad de inversores</span><input class="in" data-campo="cantInv" value="${p.cantInv || 1}" inputmode="numeric"></label>
      <label class="chk"><input type="checkbox" data-campo="hoja.verMedidas" ${p.verMedidas ? 'checked' : ''}> Mostrar las medidas de los equipos (ancho × profundidad, mm)</label>
      ${s ? '' : `${rango('hoja.tamSimb', Math.round((p.tamSimb || 1) * 100), 20, 400, 'Tamaño de los equipos y textos', ' %')}<p class="mut">Esta hoja no tiene escala: los equipos salen con un tamaño aproximado. Agrándalos o achícalos aquí (todos) o uno por uno arrastrando las esquinas del equipo seleccionado.</p>`}`);
    h += sec('Cotas y textos', `<div class="row wrap"><button class="btn sm" data-act="tool" data-k="cota">${ic('dim', 14)} Cota</button><button class="btn sm" data-act="tool" data-k="texto">${ic('text', 14)} Texto</button><button class="btn sm" data-act="tool" data-k="norte">${ic('north', 14)} Norte</button></div>
      <p class="mut">Cota: clic en dos puntos. ${s ? 'Mide sola con la escala de la hoja; puedes cambiar su texto en Propiedades.' : 'Como la hoja no tiene escala, escribe la medida en la línea de comandos al terminarla (o después, en Propiedades).'}</p>`);
    const largos = Object.keys(CANAL).map(k => [k, p.rutas.filter(r => r.k === k).reduce((t, r) => t + largoM(p, r.pts), 0)]);
    const figs = p.figPaneles || [], rielesL = p.rutas.filter(r => r.k === 'riel');
    h += sec('Paneles dibujados', `<p class="mut">Para hojas sin escala o en perspectiva: figuras con el mismo relleno de los paneles. No se suman al conteo de paneles del proyecto.</p>
      ${seg('_figForma', E.figForma, [['grid', 'Cuadrícula (4 esquinas)'], ['poly', 'Figura libre']])}
      ${E.figForma === 'grid' ? `<div class="f"><span>Nueva cuadrícula</span><span class="row">${stepper('fig.nf', E.figFC.f)} filas × ${stepper('fig.nc', E.figFC.c)} col.</span></div>` : ''}
      <button class="btn sm" data-act="tool" data-k="figpan">${ic('grid', 14)} Dibujar paneles</button>${figs.length ? `<p class="mut">${figs.length} figura(s) en esta hoja.</p>` : ''}`, figs.length > 0 || E.tool === 'figpan');
    h += sec('Rieles (dibujo libre)', `<p class="mut">Para casos en perspectiva o sin cálculo automático: dibuja cada riel como una línea. ${s ? 'Se miden solos con la escala.' : 'Sin escala, escribe su largo en Propiedades.'}</p>
      <button class="btn sm" data-act="rutaK" data-k="riel">${ic('pline', 14)} Dibujar riel</button>
      ${rielesL.length ? `<dl class="dl"><dt>Rieles dibujados</dt><dd>${rielesL.length}</dd><dt>Total aprox.</dt><dd>${fmt(rielesL.reduce((t, r) => t + largoRuta(p, r), 0), 1)} m</dd></dl>` : ''}`, rielesL.length > 0);
    h += sec('Canalización', `
      <div class="lista">${Object.entries(CANAL).map(([k, C]) => `<button class="li" data-act="rutaK" data-k="${k}" aria-pressed="${E.tool === 'ruta' && E.rutaK === k}"><i class="ln" style="border-top:3px ${C.dash.length ? 'dashed' : 'solid'} ${C.c}"></i><b>${C.n}</b><em>${fmt(largos.find(x => x[0] === k)[1], 1)} m</em></button>`).join('')}</div>
      <p class="mut">Elige un tipo y haz clic en cada punto del recorrido. Enter o doble clic termina. El largo de cada tramo se ve aquí (no en el dibujo) y pasa a los cuadros de la lámina.</p>
      ${p.rutas.filter(r => r.k !== 'riel').length ? `<div class="sub">Largo aprox. de cada canalización</div><div class="lista">${p.rutas.filter(r => r.k !== 'riel').map(r => { const C = CANAL[r.k] || CANAL.ca, tr = CANAL[r.k]?.dc ? (p.strings.findIndex(st => st.id === r.tramo) + 1 ? `String ${p.strings.findIndex(st => st.id === r.tramo) + 1}` : '') : { 'inv-tg': 'Inversor – TGFV', 'tg-emp': 'TG – Empalme' }[r.tramo] || '';
        return `<button class="li" data-act="sel-ruta" data-id="${r.id}" aria-pressed="${E.sel && E.sel.id === r.id}"><i class="ln" style="border-top:3px ${C.dash.length ? 'dashed' : 'solid'} ${C.c}"></i><b>${C.corto}${tr ? ' · ' + esc(tr) : ''}</b><em>${s ? fmt(largoM(p, r.pts), 1) + ' m' : '—'}</em></button>`; }).join('')}</div>` : ''}`);
  }
  // Capas (como el administrador de capas)
  h += sec(`${ic('layers', 15)} Capas`, `<div class="capas">${CAPAS.map(c => `<div class="capa"><button data-act="capa" data-k="${c.id}" aria-pressed="${E.capas.has(c.id)}" title="${E.capas.has(c.id) ? 'Ocultar' : 'Mostrar'}">${ic(E.capas.has(c.id) ? 'eye' : 'eyeoff', 15)}</button><i style="background:${c.c}"></i><span>${c.n}</span></div>`).join('')}</div>`, false);
  h += `<div class="pp-pie"><button class="btn pri" data-act="siguiente">Siguiente paso →</button></div>`;
  el.innerHTML = h;
}
const largoRuta = (p, r) => escala(p) ? largoM(p, r.pts) : (r.mManual || 0);
const stepper = (campo, val) => `<span class="stp"><button data-act="stp" data-campo="${campo}" data-d="-1">−</button><b>${val}</b><button data-act="stp" data-campo="${campo}" data-d="1">+</button></span>`;
function nombreSel(s) {
  const p = E.p;
  return { roof: () => `Techo ${p.roofs.findIndex(r => r.id === s.id) + 1}`, zona: () => 'Zona', equipo: () => EQUIPOS[(p.equipos.find(e => e.id === s.id) || {}).k]?.n || 'Equipo', ruta: () => 'Canalización',
    fig: () => 'Paneles dibujados', etq: () => 'Etiqueta', cota: () => 'Cota', texto: () => 'Texto', norte: () => 'Norte', ref: () => 'Referencia', bloque: () => 'Bloque de paneles' }[s.t]?.() || '';
}
function propsSel(s, { num, rango, seg }) {
  const p = E.p, del = `<button class="btn sm del" data-act="borrar">${ic('trash', 14)} Borrar</button>`;
  if (s.t === 'zona') { const z = p.zonas.find(x => x.id === s.id); if (!z) return '';
    return `<label class="f"><span>Tipo</span><select class="in" data-campo="zona.k">${Object.entries(ZONAS).map(([k, Z]) => `<option value="${k}" ${z.k === k ? 'selected' : ''}>${Z.n}</option>`).join('')}</select></label>
      ${seg('zona.forma', z.forma || 'rect', [['rect', 'Rectángulo'], ['circ', 'Círculo']])}${rango('zona.ang', Math.round(z.ang || 0), -90, 90, 'Giro')}
      <dl class="dl"><dt>Tamaño</dt><dd>${escala(p) ? `${fmt(z.w * escala(p) / 1000, 2)} × ${fmt(z.h * escala(p) / 1000, 2)} m` : '—'}</dd></dl>
      <input class="in" data-campo="zona.det" placeholder="Detalle (opcional)" value="${esc(z.det || '')}">${del}`; }
  if (s.t === 'equipo') { const e = p.equipos.find(x => x.id === s.id); if (!e) return '';
    return `<label class="f"><span>Tipo</span><select class="in" data-campo="eq.k">${Object.entries(EQUIPOS).map(([k, Q]) => `<option value="${k}" ${e.k === k ? 'selected' : ''}>${Q.n}</option>`).join('')}</select></label>
      ${e.k === 'inv' ? `<dl class="dl"><dt>Modelo</dt><dd>${esc(inversorDe(p).modelo)}</dd></dl><p class="mut">El modelo se elige en el paso Strings.</p>` : MODELOS_EQUIPO(e.k).length ? `<label class="f"><span>Modelo</span><select class="in" data-campo="eq.modelo"><option value="">Genérico</option>${MODELOS_EQUIPO(e.k).map(x => `<option value="${esc(x.sku || x.item)}" ${e.modelo === (x.sku || x.item) ? 'selected' : ''}>${esc(x.item)}</option>`).join('')}</select></label>` : ''}
      ${(() => { const base = medidaEquipo(p, { ...e, mw: 0, mh: 0 }); return `<div class="row"><label class="f mini"><span>Ancho</span><span class="fi"><input class="in" data-campo="eq.mw" value="${e.mw || ''}" placeholder="${fmt(base.w, 0)}" inputmode="numeric"><em>mm</em></span></label>
        <label class="f mini"><span>Profundidad</span><span class="fi"><input class="in" data-campo="eq.mh" value="${e.mh || ''}" placeholder="${fmt(base.h, 0)}" inputmode="numeric"><em>mm</em></span></label></div>
        <p class="mut">Medida en planta. Vacío = la del ${e.k === 'inv' || e.modelo ? 'modelo' : 'símbolo'} (${fmt(base.w, 0)} × ${fmt(base.h, 0)} mm).</p>`; })()}
      <label class="chk"><input type="checkbox" data-campo="eq.verMed" ${p.verMedidas && e.verMed !== false ? 'checked' : ''}> Mostrar sus medidas en el dibujo</label>
      ${escala(p) ? '' : rango('eq.f', Math.round((e.f || 1) * 100), 10, 500, 'Tamaño en el dibujo (sin escala)', ' %')}
      <label class="chk"><input type="checkbox" data-campo="eq.etqVer" ${!(e.etq && e.etq.oculta) ? 'checked' : ''}> Mostrar su etiqueta</label>
      <label class="f"><span>Rótulo</span><input class="in" data-campo="eq.rotulo" value="${esc(e.rotulo || '')}" placeholder="${esc(EQUIPOS[e.k].n)}"></label>${rango('eq.ang', Math.round(e.ang || 0), -180, 180, 'Giro')}${del}`; }
  if (s.t === 'ruta') { const r = p.rutas.find(x => x.id === s.id); if (!r) return '';
    const tramos = CANAL[r.k]?.dc ? p.strings.map((st, i) => [st.id, `String ${i + 1} (${nombreString(st)})`]) : ['tie', 'riel'].includes(r.k) ? [] : [['inv-tg', 'Inversor – TGFV'], ['tg-emp', 'TG – Empalme']];
    return `<label class="f"><span>Tipo</span><select class="in" data-campo="ruta.k">${Object.entries(CANAL).map(([k, C]) => `<option value="${k}" ${r.k === k ? 'selected' : ''}>${C.n}</option>`).join('')}</select></label>
      ${tramos.length ? `<label class="f"><span>Tramo</span><select class="in" data-campo="ruta.tramo"><option value="">—</option>${tramos.map(([k, n]) => `<option value="${k}" ${r.tramo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      <label class="chk"><input type="checkbox" data-campo="ruta.etqVer" ${!(r.etq && r.etq.oculta) ? 'checked' : ''}> Mostrar su etiqueta</label>
      ${r.k === 'riel' && !escala(p) ? num('ruta.mManual', r.mManual ?? '', { l: 'Largo real del riel', u: 'm' }) : ''}
      <dl class="dl"><dt>Largo</dt><dd>${escala(p) ? fmt(largoM(p, r.pts), 2) + ' m' : r.mManual ? fmt(r.mManual, 2) + ' m (escrito)' : '— (sin escala)'}</dd><dt>Vértices</dt><dd>${r.pts.length}</dd></dl><p class="mut">Arrastra los cuadros azules para mover vértices.</p>${del}`; }
  if (s.t === 'etq') { const ow = duenoEtq(s); if (!ow) return ''; const et = ow.etq || {};
    const txt = s.of === 'equipo' ? (ow.rotulo || '') : (ow.etqTxt || ''), ph = s.of === 'equipo' ? EQUIPOS[ow.k]?.n : s.of === 'string' ? `String ${p.strings.indexOf(ow) + 1}` : CANAL[ow.k]?.corto;
    return `<label class="f"><span>Texto</span><input class="in" data-campo="etq.txt" value="${esc(txt)}" placeholder="${esc(ph || '')}"></label>
      ${rango('etq.tam', Math.round((et.tam || 1) * 100), 40, 400, 'Tamaño', ' %')}
      <label class="chk"><input type="checkbox" data-campo="etq.fijo" ${et.fijo ? 'checked' : ''}> Fija (no se mueve con el mouse)</label>
      <label class="chk"><input type="checkbox" data-campo="etq.escala" ${et.escala ? 'checked' : ''}> Cambia de tamaño con el zoom (como parte del dibujo)</label>
      <p class="mut">Arrástrala para ponerla donde quieras; la línea guía la sigue.</p>
      <div class="row wrap">${et.dx != null ? '<button class="btn sm" data-act="etq-reset">Volver a su lugar</button>' : ''}<button class="btn sm del" data-act="etq-quitar">${ic('trash', 14)} Quitar etiqueta</button></div>`; }
  if (s.t === 'fig') { const f = (p.figPaneles || []).find(x => x.id === s.id); if (!f) return '';
    return `${f.pts.length === 4 ? seg('fig.tipo', f.tipo, [['grid', 'Cuadrícula'], ['poly', 'Figura entera']]) : ''}
      ${f.tipo === 'grid' ? `<div class="f"><span>Paneles</span><span class="row">${stepper('fig.f', f.f)} filas × ${stepper('fig.c', f.c)} col.</span></div>` : ''}
      <p class="mut">Arrastra los cuadros azules para ajustar las esquinas (en perspectiva también).</p>${del}`; }
  if (s.t === 'texto') { const t = p.textos.find(x => x.id === s.id); if (!t) return '';
    return `<label class="f"><span>Texto</span><input class="in" data-campo="tx.s" value="${esc(t.s)}"></label>${escala(p) ? num('tx.h', fmt((t.h || 400) / 1000, 2), { l: 'Altura', u: 'm' }) : rango('tx.f', Math.round((t.f || 1) * 100), 20, 600, 'Tamaño', ' %')}${del}`; }
  if (s.t === 'norte') return `${rango('norte.ang', Math.round(p.norte.ang), 0, 359, 'Giro del norte')}${del}`;
  if (s.t === 'cota') { const c = p.cotas.find(x => x.id === s.id); if (!c) return ''; const sc = escala(p), med = sc ? fmt(dist(c.a, c.b) * sc / 1000, 2) : '';
    return `${sc ? `<dl class="dl"><dt>Largo medido</dt><dd>${fmt(dist(c.a, c.b) * sc / 1000, 3)} m</dd></dl>` : ''}
      <label class="f"><span>Medida que se muestra</span><input class="in" data-campo="cota.txt" value="${esc(c.txt || '')}" placeholder="${sc ? med + ' (medida automática)' : 'Ej: 2,35 (en metros) o un texto'}"></label>
      <p class="mut">${sc ? 'Vacío = la medida automática según la escala.' : 'La hoja no tiene escala: escribe la medida real en metros.'}</p>
      ${!sc && parseNum(c.txt) > 0 ? `<button class="btn sm" data-act="cota-escala">${ic('ruler', 14)} Usar esta cota como escala de la hoja</button>` : ''}${del}`; }
  if (s.t === 'ref') return `<p class="mut">Arrastra los extremos para ajustar la línea.</p>${del}`;
  if (s.t === 'roof') { const r = p.roofs.find(x => x.id === s.id); if (!r) return ''; const i = p.roofs.indexOf(r);
    return `<dl class="dl"><dt>Área real</dt><dd>${fmt(E.R.porTecho[i].area, 1)} m²</dd><dt>Vértices</dt><dd>${r.poly.length}</dd><dt>Paneles</dt><dd>${E.R.porTecho[i].n}</dd></dl>${E.step !== 'paneles' ? '<p class="mut">Arrastra los vértices para corregir el contorno.</p>' : ''}${del}`; }
  if (s.t === 'bloque') { const r = p.roofs[s.ri], b = r && r.bloques[s.bi]; if (!b) return '';
    return `<div class="f"><span>Tamaño</span><span class="row">${stepper('b.f', b.f)} filas × ${stepper('b.c', b.c)} col.</span></div>
      ${rango('b.ang', Math.round(b.ang ?? r.ang ?? 0), -90, 90, 'Giro')}<button class="btn sm" data-act="blk-paralelo">Paralelo al borde más cercano</button>
      ${seg('b.orient', b.orient || r.orient || 'v', [['v', 'Vertical'], ['h', 'Horizontal']])}
      ${seg('riel.bModo', (b.rieles && b.rieles.modo) || 'hereda', [['hereda', 'Rieles del techo'], ['no', 'Sin'], ['perp', 'Perp.'], ['paral', 'Paral.']])}
      ${b.rieles && b.rieles.modo && b.rieles.modo !== 'no' ? num('riel.bD', b.rieles.d ? fmt(b.rieles.d / 10, 0) : '', { l: 'Distancia entre rieles', u: 'cm' }) : ''}
      ${rango('b.incl', b.incl ?? r.incl ?? 0, 0, 45, 'Inclinación (estructura)')}
      ${num('b.sep', fmt((b.sep ?? GAP_FILA) / 10, 0), { l: 'Entre filas', u: 'cm' })}
      <div class="row"><button class="btn sm" data-act="blk-rep" data-k="der">Repetir →</button><button class="btn sm" data-act="blk-rep" data-k="abajo">Repetir ↓</button></div>${del}`; }
  return '';
}

/* ---------- Eventos del panel (delegados) ---------- */
document.addEventListener('click', ev => {
  if (!E) return; const b = ev.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.act, k = b.dataset.k, p = E.p;
  if (E.step === 'ficha' && accionFicha(a, b)) return;
  if (E.step === 'informe' && accionInforme(a, b)) return;
  if (E.step === 'unilineal' && accionUnilineal(a, b)) return;
  if (E.step === 'informe' && a.startsWith('lam-') && accionLamina(a, b, E.proyecto, () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, () => panel())) return;   // cajetín de las láminas A1, dentro de Informe
  if (E.step === 'lamina' && accionLamina(a, b, E.proyecto, () => { E.guardado = false; estadoGuardado(); programarGuardado(); }, () => panel())) return;
  switch (a) {
    case 'salir': guardarYa().then(() => { cerrarEditor(); alSalir && alSalir(); }); break;
    case 'paso': irPaso(k); break;
    case 'siguiente': { const V = pasosVisibles(), i = V.findIndex(x => x[0] === E.step); if (V[i + 1]) irPaso(V[i + 1][0]); break; }
    case 'hoja': cambiarHoja(b.dataset.id || null); break;
    case 'hoja-nueva': dialogoHoja(); break;
    case 'hoja-editar': dialogoHoja(hojaActiva() || 'principal'); break;
    case 'undo': deshacer(); break; case 'redo': rehacer(); break;
    case 'exportar': descargar(`${(p.codigo || 'proyecto').replace(/\s+/g, '_')}.nikola.json`, JSON.stringify(E.proyecto), 'application/json'); break;
    case 'tool': E.tool = k; E.temp = null; E.D = null; if (k === 'cota') prompt('COTA  Precise el primer punto:'); else prompt('Comando:'); render(); pista(); break;
    case 'zin': { const [W, H] = tam(); zoom(1.25, W / 2, H / 2); break; }
    case 'zout': { const [W, H] = tam(); zoom(.8, W / 2, H / 2); break; }
    case 'zext': ajustarVista(); dibujarTodo(); break;
    case 'tog': toggle(k); break;
    case 'capa': E.capas.has(k) ? E.capas.delete(k) : E.capas.add(k); panel(); dibujarTodo(); break;
    case 'sel-ruta': E.sel = { t: 'ruta', id: b.dataset.id }; panel(); dibujarTodo(); break;
    case 'sel-roof': E.sel = { t: 'roof', id: b.dataset.id }; panel(); dibujarTodo(); pista(); break;
    case 'cerrar-techo': cerrarTecho(); break;
    case 'zonaK': E.zonaK = k; E.tool = 'zona'; panel(); pista(); render(); break;
    case 'eqK': E.eqK = k; E.tool = 'equipo'; render(); pista(); break;
    case 'rutaK': E.rutaK = k; E.tool = 'ruta'; E.temp = null; render(); pista(); break;
    case 'usar-dron': { const g = droneGSD(p); if (!g) break; antes(); const L = 300; p.ref = { a: [p.w / 2 - L / 2, p.h - 40], b: [p.w / 2 + L / 2, p.h - 40], mm: g * L }; despues(); render(); break; }
    case 'alinear': { const r = techoAct(); if (r) { antes(); r.ang = edgeAngle(r.poly); despues(); } break; }
    case 'devolver': { const r = techoAct(); if (r) { antes(); r.off = []; despues(); } break; }
    case 'set': aplicar(b.dataset.campo, b.dataset.v); break;
    case 'stp': { const c = b.dataset.campo, d = +b.dataset.d;
      if (c === 'fig.nf' || c === 'fig.nc') { const k2 = c === 'fig.nf' ? 'f' : 'c'; E.figFC[k2] = Math.max(1, E.figFC[k2] + d); panel(); break; }
      if (c === 'fig.f' || c === 'fig.c') { const f = (p.figPaneles || []).find(x => E.sel && x.id === E.sel.id); if (f) aplicar(c, Math.max(1, (f[c.slice(4)] || 1) + d)); break; }
      if (c.startsWith('blk.')) { E.blk[c.slice(4)] = Math.max(1, E.blk[c.slice(4)] + d); panel(); dibujarTodo(); } else { const bl = bloqueSel(); if (bl) { aplicar(c, Math.max(1, bl[c.slice(2)] + d)); } } break; }
    case 'blk-paralelo': { const bl = bloqueSel(), r = techoAct(); if (bl && r) { antes(); bl.ang = anguloBordeCercano(r.poly, [bl.x, bl.y]); despues(); } break; }
    case 'blk-rep': { const r = p.roofs[E.sel.ri], bl = bloqueSel(), s = escala(p); if (!bl || !s) break; antes(); const G = geomTecho(p, r, s), g = geomBloque(p, G, bl); const d = girarV(k === 'der' ? [g.BW + g.gx, 0] : [0, g.BH + g.sep], g.a); r.bloques.push({ ...clone(bl), id: uid('b'), x: bl.x + d[0], y: bl.y + d[1] }); E.sel = { ...E.sel, bi: r.bloques.length - 1 }; despues(); break; }
    case 'borrar': borrarSel(); break;
    case 'etq-sel': E.sel = { t: 'etq', of: b.dataset.of, id: b.dataset.id }; panel(); dibujarTodo(); break;
    case 'sel-obj': E.sel = { t: b.dataset.t, id: b.dataset.id }; panel(); dibujarTodo(); break;
    case 'etq-ojo': { const ow = listaEtq(b.dataset.of).find(x => x.id === b.dataset.id); if (!ow) break; antes(); const et = (ow.etq ||= {}); et.oculta = !et.oculta; if (!et.oculta && E.sel && E.sel.id === ow.id) E.sel = null; despues(); break; }
    case 'etq-todas': { antes(); const k2 = b.dataset.k; [...p.equipos, ...p.rutas, ...p.strings].forEach(x => { const et = (x.etq ||= {}); if (k2 === 'ver') delete et.oculta; if (k2 === 'quitar') et.oculta = true; if (k2 === 'lugar') { delete et.dx; delete et.dy; } }); E.sel = null; despues(); break; }
    case 'hoja-renombrar': renombrarHoja(); break;
    case 'hoja-duplicar': duplicarHoja(); break;
    case 'etq-reset': { const ow = duenoEtq(E.sel); if (ow && ow.etq) { antes(); delete ow.etq.dx; delete ow.etq.dy; despues(); } break; }
    case 'etq-quitar': borrarSel(); break;
    case 'cota-escala': { const c = E.sel && p.cotas.find(x => x.id === E.sel.id), m = c && parseNum(c.txt); if (!(m > 0)) break; antes(); p.ref = { a: [...c.a], b: [...c.b], mm: m * 1000 }; p.sinEscala = false; delete c.txt; log(`Escala desde la cota: 1 px = ${fmt(escala(p), 1)} mm`); despues(); render(); toast('La hoja ya tiene escala: ahora los equipos salen a su tamaño real'); break; }
    case 'str-new': antes(); nuevoString(); E.tool = 'str'; despues(); render(); break;
    case 'str-act': E.strAct = b.dataset.id; E.tool = 'str'; panel(); dibujarTodo(); break;
    case 'str-auto': autoStrings(); break;
    case 'str-vaciar': { const st = p.strings.find(x => x.id === E.strAct); if (st) { antes(); st.panels = []; despues(); } break; }
    case 'str-del': { antes(); p.strings = p.strings.filter(x => x.id !== E.strAct); E.strAct = p.strings[0]?.id || null; despues(); render(); break; }
  }
});
document.addEventListener('change', ev => {
  if (!E) return; const t = ev.target;
  if (t.dataset.act === 'foto' && t.files[0]) { subirFoto(t.files[0]); return; }
  if (esPagina()) return;
  if (t.dataset.campo) aplicar(t.dataset.campo, t.type === 'checkbox' ? t.checked : t.value, true);
});
document.addEventListener('input', ev => {
  if (!E) return; const t = ev.target; if (t.type !== 'range' || !t.dataset.campo) return;
  const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value + (t.dataset.u ?? (o.textContent.endsWith('°') ? '°' : ''));
  if (t.dataset.campo === '_fotoAlpha') { E.fotoAlpha = t.value / 100; dibujarTodo(); return; }
  aplicar(t.dataset.campo, t.value, false, true);
});
function bloqueSel() { const s = E.sel; return s && s.t === 'bloque' ? (E.p.roofs[s.ri] || {}).bloques?.[s.bi] : null; }
let enVivo = false;
function aplicar(campo, v, desdeChange, vivo) {
  const p = E.p, n = parseNum(v), r = techoAct(), s = E.sel;
  if (campo === '_zonaForma') { E.zonaForma = v; panel(); pista(); return; }
  if (campo === '_figForma') { E.figForma = v; E.tool = 'figpan'; E.temp = null; render(); pista(); return; }
  if (campo === '_sinEscala') { antes(); p.sinEscala = !!v; despues(); render(); return; }
  if (campo === '_fotoAlpha') return;
  if (vivo) { if (!enVivo) { antes(); enVivo = true; } } else { if (!enVivo) antes(); enVivo = false; }
  const obj = { zona: () => p.zonas.find(x => x.id === s.id), eq: () => p.equipos.find(x => x.id === s.id), ruta: () => p.rutas.find(x => x.id === s.id), tx: () => p.textos.find(x => x.id === s.id), str: () => p.strings.find(x => x.id === E.strAct), roof: () => r, b: () => bloqueSel(), norte: () => p.norte };
  const [pre, k] = campo.includes('.') ? campo.split('.') : [null, campo];
  if (pre === 'ref') { if (n > 0 && p.ref) p.ref.mm = n * 1000; }
  else if (pre === 'drone') { if (n != null) p.drone.roofH = n; }
  else if (pre === 'roof') { if (!r) return; if (k === 'setback') r.setback = (n ?? .4) * 1000; else if (k === 'sepFila') r.sepFila = (n ?? 2) * 10; else if (['ang', 'incl'].includes(k)) r[k] = n ?? 0; else { r[k] = v; if (k === 'modo' && v === 'manual' && !(r.bloques || []).length) r.bloques = []; } }
  else if (pre === 'b') { const bl = bloqueSel(); if (!bl) return; if (k === 'sep') bl.sep = (n ?? 2) * 10; else if (['f', 'c', 'ang', 'incl'].includes(k)) bl[k] = +v; else bl[k] = v; }
  else if (pre === 'zona') { const z = obj.zona(); if (!z) return; z[k] = k === 'ang' ? +v : v; }
  else if (pre === 'eq') { const e = obj.eq(); if (!e) return;
    if (k === 'etqVer') { (e.etq ||= {}).oculta = !v; }
    else if (k === 'mw' || k === 'mh') { if (n > 0) e[k] = Math.round(n); else delete e[k]; }
    else if (k === 'f') e.f = Math.max(.1, +v / 100);
    else if (k === 'verMed') { if (v) { delete e.verMed; if (!p.verMedidas) { p.verMedidas = true; p.equipos.forEach(x => { if (x !== e) x.verMed = false; }); } } else e.verMed = false; }
    else e[k] = k === 'ang' ? +v : v; }
  else if (pre === 'cota') { const c = s && p.cotas.find(x => x.id === s.id); if (!c) return; const t = String(v).trim(); if (t) c.txt = t; else delete c.txt; }
  else if (pre === 'hoja' && ['verMedidas', 'tamSimb'].includes(k)) { if (k === 'verMedidas') { p.verMedidas = !!v; if (v) p.equipos.forEach(x => delete x.verMed); } else if (k === 'tamSimb') p.tamSimb = Math.max(.2, +v / 100); }
  else if (pre === 'etq') { const ow = duenoEtq(s); if (!ow) return; const et = (ow.etq ||= {});
    if (k === 'txt') { const t = String(v).trim(); if (s.of === 'equipo') { if (t) ow.rotulo = t; else delete ow.rotulo; } else { if (t) ow.etqTxt = t; else delete ow.etqTxt; } }
    else if (k === 'tam') et.tam = Math.max(.2, +v / 100); else if (k === 'fijo') et.fijo = !!v; else if (k === 'escala') { if (v) et.escala = true; else delete et.escala; } }
  else if (pre === 'hoja' && ['tamEtq', 'tamCotas'].includes(k)) { p[k] = Math.max(.2, +v / 100); }
  else if (pre === 'hoja' && k === 'encerrar') { if (v) delete p.encerrarStrings; else p.encerrarStrings = false; }
  else if (pre === 'ruta' && k === 'etqVer') { const rt = obj.ruta(); if (!rt) return; (rt.etq ||= {}).oculta = !v; }
  else if (pre === 'eq' && k === 'etqVer') { const e = obj.eq(); if (!e) return; (e.etq ||= {}).oculta = !v; }
  else if (pre === 'ruta') { const rt = obj.ruta(); if (!rt) return; if (k === 'mManual') { if (n > 0) rt.mManual = n; else delete rt.mManual; } else rt[k] = v; }
  else if (pre === 'fig') { const f = (p.figPaneles || []).find(x => s && x.id === s.id); if (!f) return; if (k === 'tipo') f.tipo = v; else f[k] = Math.max(1, Math.round(+v || 1)); }
  else if (pre === 'riel') { const tgt = k.startsWith('b') ? bloqueSel() : r; if (!tgt) return; const kk = k.replace(/^b/, '').toLowerCase(); tgt.rieles ||= {}; if (kk === 'modo') { if (v === 'hereda') delete tgt.rieles; else tgt.rieles.modo = v; } else { if (n > 0) tgt.rieles.d = n * 10; else delete tgt.rieles.d; } }
  else if (pre === 'tx') { const t = obj.tx(); if (!t) return; if (k === 'h') t.h = (n || .4) * 1000; else if (k === 'f') t.f = Math.max(.1, +v / 100); else t.s = v; }
  else if (pre === 'norte') { p.norte.ang = +v; }
  else if (pre === 'str') { const st = obj.str(); if (!st) return; if (k === 'mppt') { st.mppt = +v; st.num = p.strings.filter(x => x !== st && x.mppt === +v).length + 1; } else if (k === 'largo') st.largo = n; else if (k === 'seccion') st.seccion = n || 6; }
  else if (k === 'estado') p.estado = v;
  else if (k === 'inversor') p.inversor = v;
  else if (k === 'cantInv') p.cantInv = Math.max(1, Math.round(n || 1));
  else if (k === 'sinElementos') p.sinElementos = !!v;
  despues(!vivo);
  if (desdeChange && ['roof.modo', 'estado'].includes(campo)) render();
}

/* ---------- Foto de dron ---------- */
async function subirFoto(file) {
  const p = E.p;
  let meta = null; try { if (window.exifr) meta = await window.exifr.parse(file, { xmp: true, tiff: true, exif: true }); } catch (e) { meta = null; }
  const url = URL.createObjectURL(file), im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  if (!im) return toast('No se pudo leer la imagen');
  const max = 2600, f = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * f), h = Math.round(im.naturalHeight * f);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
  const src = c.toDataURL('image/jpeg', .88); URL.revokeObjectURL(url);
  antes();
  const habia = !!p.img;
  p.img = src; p.w = w; p.h = h;
  const alt = meta && (meta.RelativeAltitude != null ? parseFloat(meta.RelativeAltitude) : null), f35 = meta && meta.FocalLengthIn35mmFormat;
  p.drone = alt && f35 ? { alt, f35, fullW: w, roofH: 0 } : null;
  if (habia) { p.ref = null; toast('Foto cambiada: vuelve a trazar la referencia'); }
  await cargarImg(src); ajustarVista(); despues(); render(); ajustarVista(); dibujarTodo();
  if (p.drone) log(`Foto de dron: altura ${fmt(alt, 1)} m · focal ${f35} mm`); else log('La foto no trae altura de vuelo del dron (usa la referencia).');
}
/* Doble clic en la pestaña de la hoja activa: cambiarle el nombre */
document.addEventListener('dblclick', ev => { if (!E) return; const t = ev.target.closest?.('.hoja-tab'); if (!t) return; if ((t.dataset.id || null) === E.hojaId) renombrarHoja(); });
