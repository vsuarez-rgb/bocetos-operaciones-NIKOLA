/* ==========================================================================
   Importar un "Campos Autocad" (.xlsm/.xlsx) de un proyecto que ya existe.

   Funciona igual en el navegador y en Node (scripts/importar-campos.mjs).
   No toca el DOM ni guarda nada: recibe el libro ya abierto y el diccionario
   (data/campos.json) y devuelve la ficha del proyecto:

     ficha.zonos          fila pegada desde ZonOS (Información proyecto R4:AY4)
     ficha.entradas       celdas sin fórmula en la plantilla (lo que Ops escribe o elige)
     ficha.sobrescritos   celdas que en la plantilla tienen fórmula, pero en este
                          Excel Ops reemplazó por un valor escrito a mano
     ficha.excel          lo que calculó el Excel (hoja Autocad y Cuadro de carga),
                          para mostrarlo mientras no exista el motor y para comparar
     ficha.equiposProyecto  paneles/inversores/baterías/cargadores que este Excel
                          agregó a su hoja Equipos y que la plantilla no tiene
   ========================================================================== */
import { partirRef, numACol, colANum, esErrorExcel } from '../xlsx/libro.js';

const HOJA_INFO = 'Información proyecto';
export const VERSION_FICHA = 1;
const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
const limpio = v => (v == null || v === '' || esErrorExcel(v)) ? null : (typeof v === 'string' ? v.trim() : v);
const norm = s => String(s || '').toUpperCase().replace(/[\s_\-]+/g, '').replace(/KTL/g, 'K');

/** @returns {{ ficha, resumen }} */
export function importarCamposAutocad(libro, dic, { archivo = null, catalogos = {} } = {}) {
  const avisos = [];
  for (const h of [HOJA_INFO, 'Autocad']) if (!libro.tieneHoja(h)) throw new Error(`El archivo no es un "Campos Autocad": falta la hoja "${h}".`);
  const IP = libro.hoja(HOJA_INFO), AC = libro.hoja('Autocad');
  const CC = libro.tieneHoja('Cuadro de carga') ? libro.hoja('Cuadro de carga') : null;
  if (!CC) avisos.push('El archivo no tiene la hoja "Cuadro de carga": no se importan sus valores.');

  /* --- ¿Es la misma versión de la plantilla? La hoja Autocad debe apuntar a las mismas celdas. --- */
  const campos = dic.campos.filter(c => c.tipo === 'campo');
  const distintas = campos.filter(c => { const f = AC.formula('B' + c.fila); return !f || f.replace(/\$/g, '') !== `'${HOJA_INFO}'!${c.celdaInfo}`; });
  if (distintas.length) avisos.push(`La hoja Autocad de este archivo no coincide con la plantilla vigente en ${distintas.length} filas (${distintas.slice(0, 6).map(c => c.fila).join(', ')}${distintas.length > 6 ? '…' : ''}). Puede ser una versión antigua: revisa esos campos.`);

  /* --- Fila ZonOS --- */
  const zonos = {};
  for (const z of dic.zonos) { const v = limpio(IP.valor(z.celda)); if (v != null) zonos[z.col] = typeof v === 'number' ? v : String(v); }
  if (!Object.keys(zonos).length) avisos.push('La fila de ZonOS (Información proyecto R4) está vacía.');

  /* --- Entradas y sobrescritos --- */
  const conFormula = new Set(dic.celdasConFormulaInfo);
  const campoDe = new Map(campos.map(c => [c.celdaInfo, c]));
  const entradas = {}, sobrescritos = {};
  for (const [ref, c] of IP.celdas) {
    const p = partirRef(ref); if (!p || p.fila < 2) continue;
    if (p.fila === 4 && p.col >= colANum('R')) continue;              // la fila de ZonOS va aparte
    // Columnas de valor: B (ficha principal), D (sección en mm² de calibres AWG) y G (SAVE y protecciones).
    // A, E y F son etiquetas; C y H son unidades.
    if (!/^[BDG]$/.test(numACol(p.col))) continue;
    const v = limpio(c.v);
    if (conFormula.has(ref)) {
      // etiqueta = el texto que muestra ESTE Excel junto a la celda (A para B/D, F para G). Puede diferir del
      // nombre del diccionario en los tramos (p. ej. "Inversor - TGFV" si el proyecto eligió ese tramo).
      if (!c.f && v != null) sobrescritos[ref] = { valor: v, campo: campoDe.get(ref)?.id || null, etiqueta: txt(IP.valor((numACol(p.col) === 'G' ? 'F' : 'A') + p.fila)) || null };
    } else if (!c.f && v != null) {
      entradas[ref] = v;
    }
  }

  /* --- Lo que calculó el Excel --- */
  const autocad = {};
  for (const c of campos) { const v = limpio(AC.valor('B' + c.fila)); if (v != null) autocad[c.fila] = v; }
  const cuadro = {};
  if (CC) for (const c of dic.cuadroDeCarga) { const v = limpio(CC.valor(c.celda)); if (v != null) cuadro[c.celda] = v; }

  /* --- Equipos que el proyecto agregó a su hoja Equipos --- */
  const equiposProyecto = libro.tieneHoja('Equipos') ? equiposNuevos(libro.hoja('Equipos'), IP, catalogos, avisos) : {};

  const ficha = {
    version: VERSION_FICHA,
    origen: { tipo: 'campos-autocad', archivo, importado: new Date().toISOString(), versionPlantillaDistinta: distintas.length || 0, avisos },
    zonos, entradas, sobrescritos,
    excel: { autocad, cuadroDeCarga: cuadro },
    equiposProyecto
  };
  const resumen = {
    zonos: Object.keys(zonos).length, entradas: Object.keys(entradas).length, sobrescritos: Object.keys(sobrescritos).length,
    camposExcel: Object.keys(autocad).length, celdasCuadro: Object.keys(cuadro).length,
    equiposNuevos: Object.values(equiposProyecto).reduce((t, a) => t + a.length, 0), avisos
  };
  return { ficha, resumen };
}


/* --- Equipos del proyecto que no están en el catálogo de la plantilla ---
   Solo se buscan los equipos que el proyecto usa (módulo B47, inversor B77, batería B88, cargador G301). */
function equiposNuevos(EQ, IP, cat, avisos) {
  const out = {};
  const filaDe = (modelo, desde = 1) => { const m = txt(modelo); if (!m) return null; for (let r = desde, n = EQ.maxFila(); r <= n; r++) if (txt(EQ.valor('E' + r)) === m && typeof EQ.valor('F' + r) !== 'string') return r; return null; };
  const num = v => typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : (v == null || v === '' ? null : (isNaN(+v) ? null : +v));
  const fuente = r => `Equipos!${r} (archivo del proyecto)`;

  const modelo = txt(IP.valor('B47'));
  if (modelo && cat.modulos && !cat.modulos.some(x => x.modelo === modelo)) {
    const r = filaDe(modelo);
    if (r) (out.modulos = []).push({ marca: txt(IP.valor('B46')) || null, modelo, pmax: num(EQ.valor('F' + r)), vmp: num(EQ.valor('G' + r)), imp: num(EQ.valor('H' + r)), voc: num(EQ.valor('I' + r)), isc: num(EQ.valor('J' + r)), tecnologia: txt(EQ.valor('K' + r)) || null, clamp: txt(EQ.valor('L' + r)) || null, ficha: txt(EQ.valor('M' + r)) || null, fuente: fuente(r) });
    else avisos.push(`El módulo "${modelo}" no está en el catálogo ni en la hoja Equipos del archivo.`);
  }
  const inv = txt(IP.valor('B77'));
  if (inv && cat.inversores && !cat.inversores.inversores.some(x => x.modelo === inv)) {
    const r = filaDe(inv);
    if (r) { const o = { marca: txt(IP.valor('B76')) || null, modelo: inv, fuente: fuente(r) }; for (const [k, d] of Object.entries(cat.inversores.columnasExcel || {})) o[k] = num(EQ.valor(d.col + r)); (out.inversores = []).push(o); }
    else avisos.push(`El inversor "${inv}" no está en el catálogo ni en la hoja Equipos del archivo.`);
  }
  const bat = txt(IP.valor('B88'));
  if (bat && cat.baterias && !cat.baterias.some(x => x.modelo === bat || x.excelDecia?.modelo === bat)) {
    const r = filaDe(bat);
    if (r) (out.baterias = []).push({ marca: txt(IP.valor('B87')) || null, modelo: bat, modulos: num(EQ.valor('F' + r)), moduloPotencia: txt(EQ.valor('G' + r)) || null, moduloBateria: txt(EQ.valor('H' + r)) || null, energiaKwh: num(EQ.valor('J' + r)), fuente: fuente(r) });
  }
  const car = txt(IP.valor('G301')), marcaCar = txt(IP.valor('G300'));
  if (car && marcaCar && marcaCar !== '0' && cat.cargadores && !cat.cargadores.some(x => x.modelo === car)) {
    const r = filaDe(car);
    if (r) (out.cargadores = []).push({ clave: marcaCar, modelo: car, tipo: txt(EQ.valor('F' + r)) || null, tension: num(EQ.valor('G' + r)), potenciaKw: num(EQ.valor('H' + r)), imax: num(EQ.valor('I' + r)), automatico: num(EQ.valor('J' + r)), diferencial: num(EQ.valor('K' + r)), tensionMax: num(EQ.valor('L' + r)), fuente: fuente(r) });
  }
  return out;
}

/* ==========================================================================
   Valores de la ficha por nombre de campo. Mientras no exista el motor (0.3),
   el valor es: sobrescrito > entrada > lo que calculó el Excel.
   ========================================================================== */
export function valorCampo(ficha, dic, id) {
  const c = dic.campos.find(x => x.tipo === 'campo' && (x.id === id || x.nombre === id)); if (!c) return null;
  const s = ficha.sobrescritos?.[c.celdaInfo]; if (s) return s.valor;
  if (ficha.entradas && c.celdaInfo in ficha.entradas) return ficha.entradas[c.celdaInfo];
  return ficha.excel?.autocad?.[c.fila] ?? null;
}

/* ==========================================================================
   Datos del proyecto (los que ya usa la app: cajetín, equipos) a partir de la ficha.
   Devuelve solo lo que encontró; el resto queda como esté.
   ========================================================================== */
export function datosProyectoDesdeFicha(ficha, dic, { paneles = [], inversores = [] } = {}) {
  const v = id => { const x = valorCampo(ficha, dic, id); return x == null ? null : x; };
  const z = ficha.zonos || {};
  const s = x => x == null ? '' : String(x).trim();
  const coord = s(z.AA).replace(/^"|"$/g, '');
  const d = {
    codigo: s(z.S) || s(v('PROYECTO Nombre')).split(' - ')[0],
    cliente: s(z.T) || s(v('PROPIETARIA/O Nombre')),
    direccion: [s(v('DIRECCIÓN Calle')), s(v('DIRECCIÓN Número'))].filter(Boolean).join(' '),
    comuna: s(v('COMUNA')), region: s(v('REGIÓN')), distrib: s(v('EMPRESA DISTRIBUIDORA')),
    lamina: {
      propietario: s(v('PROPIETARIA/O Nombre')), rutProp: s(v('PROPIETARIA/O RUT')), escala: s(v('ESCALA')) || '1:100',
      proyectista: s(v('PROYECTISTA')), instalador: s(v('INSTALADOR(A) Nombre')), rutInst: s(v('INSTALADOR(A) RUT')),
      latlon: coord ? coord.replace(/\s*,\s*/, ' ; ') : '', tierraR: s(v('Puesta a tierra Medición de resistencia'))
    }
  };
  const nInv = +v('INVERSOR Cantidad'); if (nInv > 0) d.cantInv = nInv;
  const mInv = norm(v('INVERSOR A Modelo')), inv = mInv && inversores.find(x => norm(x.modelo) === mInv);
  if (inv) d.inversor = inv.id;
  const wp = +v('MÓDULO Pmáx'), marca = norm(v('MÓDULO Marca')).replace('SOLAR', '');
  const pn = wp && paneles.find(x => x.wp === wp && norm(x.marca).replace('SOLAR', '') === marca);
  if (pn) d.panel = pn.id;
  const faltan = [];
  if (!inv && v('INVERSOR A Modelo')) faltan.push(`inversor ${v('INVERSOR A Modelo')} (no está en EMAT: no se puede dibujar a escala)`);
  if (!pn && wp) faltan.push(`panel ${v('MÓDULO Marca') || ''} ${wp} Wp (no está en EMAT)`);
  return { datos: d, faltan };
}
