/* ==========================================================================
   Paso 0 · Ficha del proyecto (0.4)

   El Excel "Campos Autocad" dentro de la app: las mismas secciones y campos
   (data/campos.json), calculados por el motor con las fórmulas de la
   plantilla. Todo se puede editar siempre:
     - campos a mano (✎): se escriben o se eligen de la lista
     - campos calculados (⚙ cálculo, 📚 catálogo, 🔗 ZonOS): si se escribe
       encima quedan "reemplazados a mano" y se vuelve al cálculo con ↺
   Los avisos del Excel (columna D) salen junto al campo que los provoca.
   ========================================================================== */
import { esc, ic, toast } from '../util.js';
import { calcularFicha } from './motor.js';
import { opcionesLista } from './listas.js';
import { cargarDatosFicha, olvidarDatosFicha } from './datos.js';
import { guardarAjuste } from '../ajustes.js';
import { abrirLibroBytes } from '../xlsx/libro.js';

const HOJA = 'Información proyecto';
const S = { q: '', filtro: 'todos', abiertas: null, ult: null, el: null, p: null, cb: {} };

export const fichaNueva = () => ({ version: 1, origen: { tipo: 'app', creada: new Date().toISOString() }, ajustes: {}, zonos: {}, entradas: {}, sobrescritos: {} });

/* ---------- Valores ---------- */
const sepDec = () => ',';   // en pantalla siempre coma (Chile); el separador de los textos del plano es otro ajuste (ficha.ajustes)
function mostrar(v) {
  if (v == null) return '';
  if (typeof v === 'number') { const s = String(Math.round(v * 10000) / 10000); return sepDec() === ',' ? s.replace('.', ',') : s; }
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
}
function leerEntrada(raw, anterior) {
  const s = String(raw ?? '').trim();
  if (s === '') return null;
  if (/^-?\d+([.,]\d+)?$/.test(s) && (typeof anterior === 'number' || anterior == null || /^-?\d/.test(String(anterior)))) return Number(s.replace(',', '.'));
  return s;
}
const ORIGEN = {
  zonos: { i: '🔗', n: 'ZonOS', t: 'Viene de la fila pegada desde ZonOS' },
  catalogo: { i: '📚', n: 'Catálogo', t: 'Sale de los catálogos de la plantilla (Equipos, Cables)' },
  calculo: { i: '⚙', n: 'Cálculo', t: 'Lo calcula la fórmula de la plantilla' },
  entrada: { i: '✎', n: 'A mano', t: 'Se escribe o se elige' },
  defecto: { i: '✎', n: 'Por defecto', t: 'Valor por defecto de la plantilla; se puede cambiar' },
  sobrescrito: { i: '✎', n: 'Reemplazado', t: 'Tenía cálculo y se escribió a mano. ↺ vuelve al cálculo' }
};

/* ---------- Cálculo ---------- */
async function calcular() {
  const d = await cargarDatosFicha(), p = S.p;
  if (!p.ficha) p.ficha = fichaNueva();
  const r = calcularFicha(d.plantilla, p.ficha, { personas: d.personas });
  const formulas = d.plantilla.hojas[HOJA].formulas;
  const filas = d.dic.campos.filter(c => c.tipo === 'campo').map(c => {
    const v = r.valor(HOJA, c.celdaInfo), err = v && typeof v === 'object' && v.codigo ? v : null;
    const o = r.origen(HOJA, c.celdaInfo);
    const tipo = o === 'sobrescrito' ? 'sobrescrito' : o === 'entrada' ? 'entrada' : o === 'zonos' ? 'zonos' : o === 'constante' ? (c.celdaInfo in formulas ? 'calculo' : 'defecto')
      : (c.celdaInfo in formulas ? (c.origen === 'zonos' ? 'zonos' : c.origen === 'catalogo' ? 'catalogo' : 'calculo') : 'entrada');
    const manual = !(c.celdaInfo in formulas);
    return { c, v: err ? null : v, err, tipo, manual };
  });
  // Avisos de la columna D. No cuentan: D1 (resumen "Hay una alerta" de toda la hoja) ni los números
  // (en la columna D el Excel también guarda la sección en mm² de los calibres AWG).
  const avisos = r.avisos.filter(a => a.fila > 1 && !/^[-d.,s]+$/.test(a.texto)).map(a => ({ ...a, campo: filas.find(f => f.c.celdaInfo === a.campoCelda) || null }));
  // Dato a verificar (*): el inversor elegido tiene un valor del Excel distinto a su ficha técnica (EMAT)
  const modelo = String(filas.find(f => f.c.id === 'INVERSOR A Modelo')?.v ?? '');
  const inv = d.catalogos.inversores.inversores.find(x => x.modelo === modelo);
  S.ult = { d, r, filas, avisos, verificar: inv?.verificar ? { modelo, notas: Object.values(inv.verificar) } : null };
  return S.ult;
}

/* ---------- Vista principal ---------- */
export async function vistaFicha(el, p, cb = {}) {
  S.el = el; S.p = p; S.cb = cb;
  el.innerHTML = '<div class="fi-cargando">Calculando la ficha…</div>';
  try { await calcular(); } catch (e) { console.error(e); el.innerHTML = `<div class="fi-cargando">No se pudo cargar la ficha: ${esc(e.message)}</div>`; return; }
  pintar();
  cb.panel && cb.panel();
}

function pintar() {
  const { filas, avisos, verificar } = S.ult, el = S.el, scroll = el.querySelector('.fi-scroll')?.scrollTop || 0;
  const q = S.q.trim().toLowerCase();
  const avisoDe = new Map(avisos.filter(a => a.campo).map(a => [a.campo.c.celdaInfo, a.texto]));
  const vacioManual = f => f.manual && (f.v == null || f.v === '') && f.tipo !== 'sobrescrito';
  const pasa = f => (!q || f.c.id.toLowerCase().includes(q) || (f.c.seccion || '').toLowerCase().includes(q))
    && (S.filtro === 'todos' || (S.filtro === 'completar' && vacioManual(f)) || (S.filtro === 'mano' && (f.tipo === 'sobrescrito' || f.tipo === 'entrada')) || (S.filtro === 'avisos' && avisoDe.has(f.c.celdaInfo)));
  const secciones = []; for (const f of filas) { const n = f.c.seccion || 'Otros'; let s = secciones.find(x => x.n === n); if (!s) secciones.push(s = { n, filas: [] }); s.filas.push(f); }
  if (!S.abiertas) S.abiertas = new Set(secciones.slice(0, 4).map(s => s.n).concat(secciones.filter(s => s.filas.some(f => avisoDe.has(f.c.celdaInfo))).map(s => s.n)));
  const v = id => filas.find(f => f.c.id === id)?.v;
  const cuenta = { completar: filas.filter(vacioManual).length, mano: filas.filter(f => f.tipo === 'sobrescrito' || f.tipo === 'entrada').length, avisos: avisoDe.size, sobrescritos: filas.filter(f => f.tipo === 'sobrescrito').length };
  const chip = (k, n, c) => `<button class="fi-chip" data-act="fi-filtro" data-k="${k}" aria-pressed="${S.filtro === k}">${n}${c != null ? `<em>${c}</em>` : ''}</button>`;
  const filtradas = secciones.map(s => ({ ...s, vis: s.filas.filter(pasa) })).filter(s => s.vis.length);

  el.innerHTML = `<div class="fi-scroll"><div class="fi-in">
    <div class="fi-head">
      <div><div class="fi-eyebrow">Paso 0 · Ficha del proyecto</div><h2>Campos Autocad</h2></div>
      <div class="fi-kpis">
        <div><b>${esc(mostrar(v('POTENCIA Nominal')) || '—')}</b><span>kW nominal</span></div>
        <div><b>${esc(mostrar(v('POTENCIA Peak')) || '—')}</b><span>kWp peak</span></div>
        <div><b>${esc(mostrar(v('Módulos totales')) || '—')}</b><span>módulos</span></div>
        <div><b>${esc(mostrar(v('Cantidad de cadenas')) || '—')}</b><span>strings</span></div>
        <div class="fi-kpi-l"><b>${esc(mostrar(v('INVERSOR A Modelo')) || '—')}</b><span>inversor</span></div>
      </div>
    </div>
    <div class="fi-bar">
      <label class="fi-search">${ic('search', 15)}<input type="search" data-fi-q placeholder="Buscar un campo (p. ej. diferencial, largo, empalme)" value="${esc(S.q)}"></label>
      <div class="fi-chips">${chip('todos', 'Todos', filas.length)}${chip('completar', 'Por completar', cuenta.completar)}${chip('mano', 'Escritos a mano', cuenta.mano)}${chip('avisos', 'Con aviso', cuenta.avisos)}</div>
      <div class="fi-acc"><button class="btn sm" data-act="fi-abrir" data-k="1">Abrir todo</button><button class="btn sm" data-act="fi-abrir" data-k="0">Cerrar todo</button></div>
    </div>
    ${filtradas.length ? filtradas.map(s => seccion(s, avisoDe, verificar)).join('') : `<p class="fi-vacio">Ningún campo calza con ${S.q ? `"${esc(S.q)}"` : 'este filtro'}.</p>`}
  </div></div>`;
  el.querySelector('.fi-scroll').scrollTop = scroll;
}

function seccion(s, avisoDe, verificar) {
  const abierta = S.abiertas.has(s.n) || !!S.q || S.filtro !== 'todos';
  const nAv = s.vis.filter(f => avisoDe.has(f.c.celdaInfo)).length, nSob = s.vis.filter(f => f.tipo === 'sobrescrito').length;
  const ver = verificar && /INVERSOR/.test(s.n);
  return `<details class="fi-sec" data-sec="${esc(s.n)}" ${abierta ? 'open' : ''}>
    <summary><span class="fi-sec-n">${esc(capitalizar(s.n))}${ver ? ' <b class="fi-ast" title="Hay un dato a verificar">*</b>' : ''}</span>
      <span class="fi-sec-c">${nAv ? `<em class="b-av">${nAv} aviso${nAv > 1 ? 's' : ''}</em>` : ''}${nSob ? `<em class="b-sob">${nSob} reemplazado${nSob > 1 ? 's' : ''}</em>` : ''}<em>${s.vis.length}</em></span></summary>
    ${ver ? `<div class="fi-verif"><b>*</b> ${esc(verificar.modelo)}: ${verificar.notas.map(esc).join(' ')}</div>` : ''}
    <div class="fi-rows">${s.vis.map(f => fila(f, avisoDe.get(f.c.celdaInfo))).join('')}</div>
  </details>`;
}
const capitalizar = t => t.charAt(0) + t.slice(1).toLowerCase().replace(/\b(ug|tfv|tg|tgfv|save|ac|cc|inv|fv)\b/g, m => m.toUpperCase());

function fila(f, aviso) {
  const c = f.c, o = ORIGEN[f.tipo], id = `fi-${c.celdaInfo}`;
  const { d, r } = S.ult;
  let opciones = c.lista || d.plantilla.validaciones?.[c.celdaInfo] ? opcionesLista(d.plantilla, r, c.celdaInfo) : null;
  if (opciones && !opciones.length && c.celdaInfo === 'B9') opciones = comunasCatalogo(d, f);          // Ñuble no tiene rango de comunas en el Excel
  const val = mostrar(f.v);
  let control;
  if (opciones && opciones.length) {
    const ops = opciones.map(x => mostrar(x)); if (val && !ops.includes(val)) ops.unshift(val);
    control = `<select class="fi-ctl" id="${id}" data-fi="${c.celdaInfo}"><option value="">—</option>${ops.map(x => `<option ${x === val ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  } else {
    control = `<input class="fi-ctl" id="${id}" data-fi="${c.celdaInfo}" value="${esc(val)}" placeholder="${f.err ? esc(f.err.codigo === '#N/A' ? '—' : 'no se pudo calcular') : (f.manual ? 'Completar' : '—')}" ${f.err ? `title="${esc(f.err.detalle || f.err.codigo)}"` : ''} autocomplete="off">`;
  }
  const puedeVolver = f.tipo === 'sobrescrito' || (f.tipo === 'entrada' && S.p.ficha.origen?.tipo !== 'campos-autocad' && c.celdaInfo in (d.plantilla.hojas[HOJA].constantes || {}));
  return `<div class="fi-row t-${f.tipo}${aviso ? ' con-aviso' : ''}${f.err && f.err.codigo !== '#N/A' ? ' con-error' : ''}">
    <span class="fi-o" title="${esc(o.t)}">${o.i}</span>
    <label class="fi-n" for="${id}">${esc(c.id)}${f.tipo === 'sobrescrito' ? ' <em class="fi-tag">reemplazado</em>' : ''}</label>
    <span class="fi-v">${control}</span>
    <span class="fi-u">${esc(c.unidad || '')}</span>
    ${puedeVolver ? `<button class="fi-reset" data-act="fi-reset" data-celda="${c.celdaInfo}" title="${f.tipo === 'sobrescrito' ? 'Volver al cálculo' : 'Volver al valor por defecto'}">↺</button>` : '<span></span>'}
    ${aviso ? `<div class="fi-aviso">${ic('alert', 14)} ${esc(aviso)}</div>` : ''}
  </div>`;
}
function comunasCatalogo(d, f) {
  const region = String(S.ult.filas.find(x => x.c.celdaInfo === 'B8')?.v || ''); if (!region || !d.regiones) return [];
  const n = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const r = d.regiones.find(x => n(region).includes(n(x.nombre || x.clave)) || n(region).includes(n(x.clave)));
  return r ? r.comunas : [];
}

/* ---------- Cambios ---------- */
async function cambiar(celda, raw) {
  const p = S.p, F = p.ficha, f = S.ult.filas.find(x => x.c.celdaInfo === celda); if (!f) return;
  const v = leerEntrada(raw, f.v);
  if (f.manual) { if (v == null && S.p.ficha.origen?.tipo !== 'campos-autocad') delete F.entradas[celda]; else F.entradas[celda] = v; }
  else if (v == null && f.tipo !== 'sobrescrito') return;
  else F.sobrescritos[celda] = { valor: v, campo: f.c.id, editado: new Date().toISOString() };
  await recalcular();
}
async function volver(celda) {
  const F = S.p.ficha;
  if (F.sobrescritos?.[celda]) delete F.sobrescritos[celda]; else delete F.entradas?.[celda];
  await recalcular();
}
async function recalcular() { await calcular(); pintar(); S.cb.cambio && S.cb.cambio(); S.cb.panel && S.cb.panel(); }

/* ---------- Panel lateral ---------- */
export function panelFicha(p) {
  if (!S.ult) return '<details class="pp" open><summary>0 · Ficha</summary><div class="pp-b"><p class="mut">Calculando…</p></div></details>';
  const { d, avisos, r, filas } = S.ult, F = p.ficha || {};
  const sob = filas.filter(f => f.tipo === 'sobrescrito').length, mano = filas.filter(f => f.tipo === 'entrada').length;
  const otraPlantilla = F.origen?.plantilla && F.origen.plantilla !== d.plantilla.huella;
  const nInst = (d.personas.instaladores || []).length;
  return `<details class="pp" open><summary>0 · Ficha</summary><div class="pp-b">
      <p class="mut">${F.origen?.tipo === 'campos-autocad' ? `Importada de <b>${esc(F.origen.archivo || 'un Excel')}</b> el ${new Date(F.origen.importado).toLocaleDateString('es-CL')}.` : 'Creada en la app.'} Todo se puede editar: escribe encima de cualquier valor.</p>
      <div class="kpis"><div><b>${mano}</b><span>a mano</span></div><div><b>${sob}</b><span>reemplazados</span></div><div><b>${avisos.length}</b><span>avisos</span></div></div>
      ${otraPlantilla ? `<div class="aviso warn">${ic('alert', 16)}<span>Se importó con otra versión de la plantilla. Los cálculos usan la vigente.</span></div>` : ''}
      ${r.problemas.length ? `<div class="aviso warn">${ic('alert', 16)}<span>${r.problemas.length} celdas no se pueden calcular con esta plantilla: se llenan a mano. Detalle en Proyectos → Plantilla.</span></div>` : ''}
      ${(F.origen?.avisos || []).length ? `<details class="fi-imp-av"><summary>Avisos de la importación (${F.origen.avisos.length})</summary>${F.origen.avisos.map(a => `<p class="mut">${esc(a)}</p>`).join('')}</details>` : ''}
    </div></details>
    ${avisos.length ? `<details class="pp" open><summary>Avisos del Excel</summary><div class="pp-b">${avisos.map(a => `<button class="fi-av-l" data-act="fi-ir" data-celda="${a.campoCelda}">${ic('alert', 14)}<span><b>${esc(a.campo?.c.id || a.celda)}</b>${esc(a.texto)}</span></button>`).join('')}</div></details>` : ''}
    <details class="pp"><summary>Qué significa cada ícono</summary><div class="pp-b fi-ley">${Object.values(ORIGEN).map(o => `<div><span>${o.i}</span><b>${o.n}</b><em>${esc(o.t)}</em></div>`).join('')}</div></details>
    <details class="pp" ${nInst ? '' : 'open'}><summary>Instaladores</summary><div class="pp-b">
      <p class="mut">${nInst ? `${nInst} instaladores y ${(d.personas.proyectistas || []).length} proyectistas guardados en este navegador.` : 'No hay instaladores guardados en este navegador: sin ellos no se completan RUT, licencia ni contacto del instalador.'} Son datos personales: no se publican en el sitio.</p>
      <label class="btn sm">${ic('upload', 14)} Cargar desde Campos Autocad o .json<input type="file" accept=".xlsm,.xlsx,.json" data-fi-personas hidden></label>
    </div></details>
    <div class="pp-pie"><button class="btn pri" data-act="siguiente">Siguiente paso →</button></div>`;
}

/* ---------- Acciones (clics del editor) ---------- */
export function accionFicha(a, b) {
  if (!a.startsWith('fi-')) return false;
  if (a === 'fi-filtro') { S.filtro = b.dataset.k; pintar(); }
  if (a === 'fi-reset') volver(b.dataset.celda);
  if (a === 'fi-abrir') { S.abiertas = b.dataset.k === '1' ? new Set(S.ult.filas.map(f => f.c.seccion || 'Otros')) : new Set(); pintar(); }
  if (a === 'fi-ir') { S.filtro = 'todos'; S.q = ''; const sec = S.ult.filas.find(f => f.c.celdaInfo === b.dataset.celda)?.c.seccion; if (sec) S.abiertas.add(sec); pintar(); const x = document.getElementById('fi-' + b.dataset.celda); if (x) { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); x.focus({ preventScroll: true }); } }
  return true;
}

/* Eventos de los controles (delegados, solo dentro de la ficha) */
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.matches?.('[data-fi]') && S.el?.contains(t)) cambiar(t.dataset.fi, t.value);
  if (t.matches?.('[data-fi-personas]') && t.files[0]) { const f = t.files[0]; t.value = ''; cargarPersonas(f); }
});
document.addEventListener('keydown', ev => { const t = ev.target; if (ev.key === 'Enter' && t.matches?.('input[data-fi]') && S.el?.contains(t)) t.blur(); });
document.addEventListener('toggle', ev => { const d = ev.target; if (d.matches?.('.fi-sec') && S.abiertas) { d.open ? S.abiertas.add(d.dataset.sec) : S.abiertas.delete(d.dataset.sec); } }, true);
let tBusca = null;
document.addEventListener('input', ev => { const t = ev.target; if (!t.matches?.('[data-fi-q]')) return; clearTimeout(tBusca); tBusca = setTimeout(() => { S.q = t.value; const pos = t.selectionStart; pintar(); const i = S.el.querySelector('[data-fi-q]'); i.focus(); i.setSelectionRange(pos, pos); }, 180); });

/* Instaladores y proyectistas (privados): desde el .json de _privado o desde un Campos Autocad */
async function cargarPersonas(archivo) {
  try {
    let personas;
    if (/\.json$/i.test(archivo.name)) { const j = JSON.parse(await archivo.text()); personas = { instaladores: j.instaladores || [], proyectistas: j.proyectistas || [] }; }
    else {
      const { plantilla } = await cargarDatosFicha(), L = await abrirLibroBytes(await archivo.arrayBuffer()), EQ = L.hoja('Equipos'), pr = plantilla.privado;
      const fila = (def, r) => Object.fromEntries(def.columnas.map((c, j) => [def.campos[j], EQ.valor(c + r) == null ? null : String(EQ.valor(c + r)).trim()]));
      personas = { instaladores: pr.instaladores.filas.map(r => fila(pr.instaladores, r)).filter(x => x.nombre), proyectistas: pr.proyectistas.filas.map(r => EQ.valor('E' + r)).filter(Boolean).map(String) };
    }
    if (!personas.instaladores.length) throw new Error('El archivo no trae instaladores.');
    await guardarAjuste('personas', personas); olvidarDatosFicha();
    toast(`${personas.instaladores.length} instaladores guardados en este navegador`);
    await recalcular();
  } catch (e) { console.error(e); toast(e.message || 'No se pudieron leer los instaladores'); }
}
