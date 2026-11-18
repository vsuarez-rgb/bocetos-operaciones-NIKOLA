/* ==========================================================================
   Plantilla "Campos Autocad" → datos para el motor.

   La usan scripts/extraer-plantilla.mjs (para data/plantilla/plantilla.json)
   y la app, cuando alguien carga una versión nueva de la plantilla. Así, si
   Campos Autocad cambia, no hay que reprogramar: se extraen las fórmulas
   nuevas y la app muestra qué cambió y qué no se puede calcular.
   ========================================================================== */
import { leerFormula, funcionesDe, referenciasDe, FUNCIONES, colANum, numACol } from './formulas.js';
import { esErrorExcel } from '../xlsx/libro.js';

export const HOJAS_CALCULO = ['Información proyecto', 'Cuadro de carga'];
export const HOJAS_TABLA = ['Equipos', 'Cables y canalización'];
export const VERSION_PLANTILLA = 1;
const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
const partir = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? { c: colANum(m[1]), r: +m[2], col: m[1] } : null; };

/* Huella corta (FNV-1a) para reconocer la versión de la plantilla */
export function huella(texto) { let h = 0x811c9dc5; for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

export function extraerPlantilla(libro, { archivo = null, nombresPrivados = [] } = {}) {
  const faltan = [...HOJAS_CALCULO, ...HOJAS_TABLA].filter(h => !libro.tieneHoja(h));
  if (faltan.length) throw new Error(`El archivo no es una plantilla "Campos Autocad": faltan las hojas ${faltan.join(', ')}.`);
  const privados = new Set(nombresPrivados.map(txt).filter(x => x.length > 3));
  const esPrivado = v => typeof v === 'string' && privados.has(txt(v));
  const informe = [], problemas = [];

  /* --- Hojas de cálculo: fórmulas y constantes --- */
  const hojas = {};
  for (const n of HOJAS_CALCULO) {
    const H = libro.hoja(n), formulas = {}, constantes = {};
    for (const [ref, c] of H.celdas) {
      if (c.f) formulas[ref] = c.f;
      else if (c.v != null && c.v !== '' && !esErrorExcel(c.v) && !esPrivado(c.v)) constantes[ref] = c.v;
    }
    hojas[n] = { formulas, constantes };
  }

  /* --- Rangos con datos de personas en Equipos (no se publican) --- */
  const EQ = libro.hoja('Equipos'), privado = {};
  {
    let r0 = null; for (let r = 1, m = EQ.maxFila(); r <= m; r++) if (txt(EQ.valor('E' + r)) === 'Instaladores') { r0 = r; break; }
    if (r0) { const filas = []; for (let r = r0 + 1; r < r0 + 60 && !/^Insertar Fila/i.test(txt(EQ.valor('A' + r))); r++) if (txt(EQ.valor('E' + r))) filas.push(r);
      privado.instaladores = { hoja: 'Equipos', filas, columnas: ['E', 'F', 'G', 'H', 'I', 'J', 'K'], campos: ['nombre', 'rut', 'direccion', 'licencia', 'telefono', 'correo', 'empresa'] }; }
    let rL = null; for (let r = 1, m = EQ.maxFila(); r <= m; r++) if (txt(EQ.valor('A' + r)) === 'Región' && /Proyectista/.test(txt(EQ.valor('E' + r)))) { rL = r; break; }
    if (rL) { const filas = []; for (let r = rL + 1; r < rL + 60; r++) { if (txt(EQ.valor('E' + r))) filas.push(r); else if (filas.length) break; } privado.proyectistas = { hoja: 'Equipos', filas, columnas: ['E'], campos: ['nombre'] }; }
  }
  const celdasPrivadas = new Set(Object.values(privado).flatMap(p => p.filas.flatMap(r => p.columnas.map(c => c + r))));

  /* --- Tablas: valores, y fórmulas internas (las que apuntan a otros libros quedan con su valor) --- */
  const tablas = {};
  for (const n of HOJAS_TABLA) {
    const H = libro.hoja(n), valores = {}, formulas = {};
    for (const [ref, c] of H.celdas) {
      if (n === 'Equipos' && celdasPrivadas.has(ref)) continue;
      if (c.f && !/\[\d+\]/.test(c.f) && !/#REF!/.test(c.f)) formulas[ref] = c.f;
      if (c.v != null && c.v !== '' && !esErrorExcel(c.v) && !esPrivado(c.v)) valores[ref] = c.v;
    }
    tablas[n] = { valores, formulas };
  }
  /* Solo quedan como fórmula las celdas de tabla que dependen (directa o indirectamente) de la ficha.
     Las demás no cambian entre proyectos: basta su valor. */
  {
    const refsDe = new Map();
    for (const n of HOJAS_TABLA) for (const [ref, f] of Object.entries(tablas[n].formulas)) {
      try { refsDe.set(`${n}!${ref}`, referenciasDe(leerFormula(f)).flatMap(x => { const h = x.hoja || n; if (x.k === 'ref') return [`${h}!${numACol(x.c)}${x.r}`]; const out = []; for (let r = x.r1; r <= x.r2; r++) for (let c = x.c1; c <= x.c2; c++) out.push(`${h}!${numACol(c)}${r}`); return out; })); }
      catch { refsDe.set(`${n}!${ref}`, []); }
    }
    const dinamica = new Set(); let cambio = true;
    while (cambio) { cambio = false; for (const [k, refs] of refsDe) if (!dinamica.has(k) && refs.some(r => HOJAS_CALCULO.some(h => r.startsWith(h + '!')) || dinamica.has(r))) { dinamica.add(k); cambio = true; } }
    for (const n of HOJAS_TABLA) for (const ref of Object.keys(tablas[n].formulas)) if (!dinamica.has(`${n}!${ref}`)) delete tablas[n].formulas[ref];
  }

  /* --- Listas desplegables y fila de ZonOS --- */
  const IP = libro.hoja('Información proyecto'), validaciones = {};
  for (const [ref, v] of IP.validaciones) if (v.lista) validaciones[ref] = v.ayuda ? { lista: v.lista, ayuda: v.ayuda } : v.lista;
  const encabezadosZonos = []; for (let c = colANum('R'); c <= colANum('AY'); c++) encabezadosZonos.push(txt(IP.valor(numACol(c) + '3')));

  /* --- Revisar que el motor pueda leer y calcular cada fórmula --- */
  const usadas = new Map();
  for (const [hoja, d] of [...Object.entries(hojas), ...Object.entries(tablas)]) for (const [ref, f] of Object.entries(d.formulas)) {
    try { for (const fn of funcionesDe(leerFormula(f))) { if (!usadas.has(fn)) usadas.set(fn, []); usadas.get(fn).push(`${hoja}!${ref}`); } }
    catch (e) { problemas.push({ tipo: 'no-se-lee', celda: `${hoja}!${ref}`, detalle: e.message }); }
  }
  for (const [fn, celdas] of usadas) if (!FUNCIONES[fn]) for (const c of celdas) problemas.push({ tipo: 'funcion-no-soportada', celda: c, detalle: fn });

  /* --- Estructura de la hoja Autocad (la que lee la macro): qué celda de la ficha va en cada fila.
     Sirve para detectar, al cargar una plantilla nueva, si se movieron o agregaron campos. --- */
  const autocad = {};
  if (libro.tieneHoja('Autocad')) {
    const AC = libro.hoja('Autocad');
    for (let r = 1, m = AC.maxFila(); r <= m; r++) {
      const fB = AC.formula('B' + r) || '', fA = AC.formula('A' + r) || '';
      const cel = (/'?Información proyecto'?!\$?([A-Z]+)\$?(\d+)/.exec(fB) || []).slice(1).join('');
      const nom = (/'?Información proyecto'?!\$?([A-Z]+)\$?(\d+)/.exec(fA) || []).slice(1).join('');
      if (cel || nom) autocad[r] = { celda: cel || null, celdaNombre: nom || null };
    }
  }

  const nF = h => Object.keys(hojas[h].formulas).length;
  const plantilla = {
    version: VERSION_PLANTILLA, archivo, extraida: new Date().toISOString().slice(0, 10),
    huella: huella(JSON.stringify([hojas, tablas])),
    hojas, tablas, privado, validaciones, autocad,
    // Nombres de rango del Excel (los usan las listas desplegables: "Regiones", INDIRECT($B$8)…)
    nombres: Object.fromEntries(libro.nombres.filter(n => !n.name.startsWith('_xl') && !n.hidden && !/#REF!/.test(n.ref) && n.localSheetId == null).map(n => [n.name, n.ref])),
    zonos: { hoja: 'Información proyecto', fila: 4, desde: 'R', hasta: 'AY', encabezados: encabezadosZonos },
    funciones: [...usadas.keys()].sort(), problemas
  };
  informe.push(`Fórmulas: ${HOJAS_CALCULO.map(h => `${h} ${nF(h)}`).join(' · ')} · tablas ${HOJAS_TABLA.map(h => `${h} ${Object.keys(tablas[h].formulas).length}`).join(', ')}`);
  informe.push(`Funciones usadas (${usadas.size}): ${[...usadas.keys()].sort().join(', ')}`);
  informe.push(problemas.length ? `⚠ ${problemas.length} fórmulas que el motor no puede calcular: ${problemas.slice(0, 5).map(p => `${p.celda} (${p.detalle})`).join('; ')}` : '✓ El motor puede leer y calcular todas las fórmulas.');
  informe.push(`Datos de personas apartados: ${Object.entries(privado).map(([k, p]) => `${k} (${p.filas.length} filas)`).join(', ') || 'ninguno'}`);
  return { plantilla, informe };
}

/* ==========================================================================
   Comparar dos versiones de la plantilla: qué cambió y a qué campos afecta.
   `dic` es el diccionario vigente (data/campos.json), para nombrar los campos.
   ========================================================================== */
export function compararPlantillas(actual, nueva, dic) {
  const campoPorCelda = new Map((dic?.campos || []).filter(c => c.tipo === 'campo').map(c => [c.celdaInfo, c]));
  const campoPorFila = new Map((dic?.campos || []).filter(c => c.tipo === 'campo').map(c => [c.fila, c]));
  const out = { igual: actual.huella === nueva.huella, formulas: {}, constantes: {}, tablas: {}, autocad: [], camposAfectados: [], problemasNuevos: [] };
  const norm = f => String(f).replace(/[\s$]/g, '').toUpperCase();
  for (const h of HOJAS_CALCULO) {
    const a = actual.hojas[h]?.formulas || {}, b = nueva.hojas[h]?.formulas || {};
    const nuevas = Object.keys(b).filter(r => !(r in a)), eliminadas = Object.keys(a).filter(r => !(r in b)), cambiadas = Object.keys(b).filter(r => r in a && norm(a[r]) !== norm(b[r]));
    out.formulas[h] = { nuevas, eliminadas, cambiadas };
    const ca = actual.hojas[h]?.constantes || {}, cb = nueva.hojas[h]?.constantes || {};
    out.constantes[h] = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].filter(r => String(ca[r] ?? '') !== String(cb[r] ?? ''));
  }
  for (const h of HOJAS_TABLA) {
    const a = actual.tablas[h]?.valores || {}, b = nueva.tablas[h]?.valores || {};
    out.tablas[h] = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(r => String(a[r] ?? '') !== String(b[r] ?? '')).length;
  }
  // Hoja Autocad: filas que ahora apuntan a otra celda, o que aparecen / desaparecen
  const filas = new Set([...Object.keys(actual.autocad || {}), ...Object.keys(nueva.autocad || {})].map(Number));
  for (const f of [...filas].sort((x, y) => x - y)) {
    const a = actual.autocad?.[f], b = nueva.autocad?.[f];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.autocad.push({ fila: f, antes: a?.celda || null, ahora: b?.celda || null, campo: campoPorFila.get(f)?.id || null, tipo: !a ? 'nueva' : !b ? 'eliminada' : 'movida' });
  }
  // Campos cuya fórmula cambió (en la ficha)
  const fi = out.formulas['Información proyecto'];
  for (const r of [...fi.cambiadas, ...fi.nuevas, ...fi.eliminadas]) { const c = campoPorCelda.get(r); if (c) out.camposAfectados.push({ celda: r, campo: c.id, cambio: fi.cambiadas.includes(r) ? 'formula cambiada' : fi.nuevas.includes(r) ? 'ahora se calcula' : 'ya no se calcula (queda manual)' }); }
  const vistos = new Set((actual.problemas || []).map(p => p.celda));
  out.problemasNuevos = (nueva.problemas || []).filter(p => !vistos.has(p.celda));
  out.necesitaDiccionario = out.autocad.length > 0;
  return out;
}
