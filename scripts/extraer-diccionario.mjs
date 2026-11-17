/* ==========================================================================
   0.2 · Diccionario de campos

   node scripts/extraer-diccionario.mjs [ruta-plantilla] [ruta-Module1.bas]

   Recorre las 382 filas de la hoja "Autocad" de la plantilla y, para cada una,
   sigue la cadena  Autocad!B → Información proyecto!B → (ZonOS R4:AY4 |
   Equipos | Cables | celda escrita a mano | cálculo). Cruza con la macro
   (Module1.bas) para saber con qué nombre llega cada valor al DWG.

   Genera data/campos.json (lo lee la app) y docs/DICCIONARIO-CAMPOS.md.
   Solo lee la plantilla (sin datos de clientes).
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirLibro, partirRef, numACol, colANum } from './leer-xlsx.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLANTILLA = resolve(process.argv[2] || resolve(RAIZ, '..', 'Campos Autocad -.xlsm'));
const BAS = resolve(process.argv[3] || resolve(RAIZ, '..', 'macro-GetCampo', 'Module1.bas'));
const HOJA_INFO = 'Información proyecto';

const libro = abrirLibro(PLANTILLA);
const AC = libro.hoja('Autocad'), IP = libro.hoja(HOJA_INFO), CC = libro.hoja('Cuadro de carga');
const falla = m => { console.error('✗ ' + m); process.exit(1); };
const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
const esError = v => typeof v === 'string' && /^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL)!?/.test(v);

/* ---------- Referencias dentro de una fórmula ----------
   Devuelve [{hoja, ref}] (ref sin $; los rangos se expanden a su primera y última celda). */
function referencias(f, hojaPropia) {
  if (!f) return [];
  const out = [];
  const sinTexto = f.replace(/"(?:[^"]|"")*"/g, '""');
  // [hoja!]$COL$FILA[:$COL$FILA]. El nombre de hoja solo cuenta si va seguido de "!" (si no, "AN4" se leería como hoja "A" + celda N4).
  const rx = /(?:(?:'((?:[^']|'')+)'|([A-Za-zÁÉÍÓÚÑáéíóúñ_][\w.ÁÉÍÓÚÑáéíóúñ]*))(!))?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![\w(])/g;
  for (const m of sinTexto.matchAll(rx)) {
    const antes = sinTexto[m.index - 1];
    if (antes && /[\w.$]/.test(antes)) continue;                        // parte de otro nombre
    const hoja = m[3] ? (m[1] ? m[1].replace(/''/g, "'") : m[2]) : hojaPropia;
    const ini = `${m[4]}${m[5]}`;
    out.push({ hoja, ref: ini });
    if (m[6]) { const a = partirRef(ini), b = partirRef(`${m[6]}${m[7]}`); for (let r = a.fila; r <= b.fila; r++) for (let c = a.col; c <= b.col; c++) if (r !== a.fila || c !== a.col) out.push({ hoja, ref: numACol(c) + r, rango: true }); }
  }
  return out;
}
const enZonos = ref => { const p = partirRef(ref); return p && p.fila === 4 && p.col >= colANum('R') && p.col <= colANum('AY'); };

/* ---------- Encabezados de la fila ZonOS (Información proyecto R3:AY3) ---------- */
const zonos = [];
for (let c = colANum('R'); c <= colANum('AY'); c++) zonos.push({ n: zonos.length + 1, col: numACol(c), celda: `${numACol(c)}4`, encabezado: txt(IP.valor(numACol(c) + '3')) });
if (zonos.length !== 34 || zonos[0].encabezado !== 'Proyecto Nombre') falla(`La fila de encabezados de ZonOS (R3:AY3) no es la esperada: ${zonos.length} columnas, la primera es "${zonos[0]?.encabezado}".`);
if (!/^Pégame/.test(txt(IP.valor('Q4')))) console.warn('⚠ No encontré "Pégame en la celda de la derecha" en Q4: revisa que ZonOS se pegue en R4.');

/* ---------- Macro: qué celda lee y con qué nombre la escribe en el DWG ---------- */
const bas = readFileSync(BAS, 'utf8').split(/\r?\n/);
const macroAutocad = new Map();   // fila -> [{ propiedad, col, condicion }]
const macroCuadro = [];           // [{ propiedad, celda }]
let hojaMacro = null; const pilaIf = [];
for (const linea of bas) {
  const l = linea.trim(); if (l.startsWith("'")) continue;
  let m;
  if ((m = /Set xlSheet = xlWB\.Sheets\("([^"]+)"\)/.exec(l))) { hojaMacro = m[1]; continue; }
  if ((m = /^If (.+) Then$/i.exec(l))) { pilaIf.push(m[1].replace(/xlSheet\.Range\("([A-Z]+\d+)"\)\.Value/g, '$1')); continue; }
  if (/^Else$/i.test(l)) { pilaIf[pilaIf.length - 1] = `NO (${pilaIf[pilaIf.length - 1]})`; continue; }
  if (/^End If$/i.test(l)) { pilaIf.pop(); continue; }
  if ((m = /^WriteCustomProperty "([^"]+)",\s*xlSheet\.Range\("([A-Z]+)(\d+)"\)/.exec(l))) {
    const d = { propiedad: m[1], col: m[2], condicion: pilaIf.length ? pilaIf.join(' y ') : null };
    if (hojaMacro === 'Autocad') { const f = +m[3]; if (!macroAutocad.has(f)) macroAutocad.set(f, []); macroAutocad.get(f).push(d); }
    else if (hojaMacro === 'Cuadro de carga') macroCuadro.push({ propiedad: m[1], celda: m[2] + m[3] });
    else falla(`La macro escribe desde una hoja inesperada: ${hojaMacro}`);
  }
}
if (!macroAutocad.size) falla('No encontré llamadas WriteCustomProperty en Module1.bas.');

/* ---------- Qué otras hojas usan cada celda de "Información proyecto" ---------- */
const HOJAS_DOC = { 'AAA M. Explicativa': 'Memoria explicativa', 'TE6': 'TE6', 'Informe de ensayos BT': 'Informe de ensayos BT', 'Informe de ensayos MT': 'Informe de ensayos MT', 'Señaleticas': 'Señaléticas', 'A. P.': 'A. P.', 'Cubicación': 'Cubicación', 'Cuadro de carga': 'Cuadro de carga' };
const usosPorCelda = new Map();
for (const [hoja, alias] of Object.entries(HOJAS_DOC)) {
  let H; try { H = libro.hoja(hoja); } catch { continue; }
  for (const [, c] of H.celdas) for (const r of referencias(c.f, hoja)) if (r.hoja === HOJA_INFO) { if (!usosPorCelda.has(r.ref)) usosPorCelda.set(r.ref, new Set()); usosPorCelda.get(r.ref).add(alias); }
}

/* ---------- Origen de una celda de Información proyecto ---------- */
function origenDe(celda) {
  const f = IP.formula(celda), v = IP.valor(celda);
  if (!f) return { origen: 'manual', precedentes: [], hojasCatalogo: [] };
  const refs = referencias(f, HOJA_INFO);
  const zon = refs.filter(r => r.hoja === HOJA_INFO && enZonos(r.ref)).map(r => r.ref);
  const cat = [...new Set(refs.filter(r => r.hoja === 'Equipos' || r.hoja === 'Cables y canalización').map(r => r.hoja))];
  const otras = [...new Set(refs.filter(r => r.hoja !== HOJA_INFO && !cat.includes(r.hoja)).map(r => r.hoja))];
  // Precedentes: celdas de la ficha (incluye todas las de un rango) y de otras hojas de cálculo (p. ej. Cuadro de carga)
  const prec = [...new Set(refs.filter(r => r.hoja === HOJA_INFO && !enZonos(r.ref)).map(r => r.ref))];
  const precOtras = [...new Set(refs.filter(r => r.hoja !== HOJA_INFO && !cat.includes(r.hoja) && !r.rango).map(r => `${r.hoja}!${r.ref}`))];
  let origen = 'calculo';
  if (zon.length && !cat.length && !prec.length && !precOtras.length) origen = 'zonos';
  else if (cat.length) origen = 'catalogo';
  return { origen, zonos: zon.length ? [...new Set(zon)] : undefined, precedentes: prec, precedentesOtrasHojas: precOtras.length ? precOtras : undefined, hojasCatalogo: cat, otrasHojas: otras.length ? otras : undefined, usaHoy: /TODAY\(\)/i.test(f) || undefined };
}

/* ---------- Recorrer la hoja Autocad ---------- */
const CABECERA = /^(DATOS |CORRIENTE (CONTINUA|ALTERNA)|INTERRUPTOR |BARRA REPARTIDORA|UBICACIÓN$|DIFERENCIAL )/;
const maxFila = AC.maxFila();
if (maxFila !== 382) console.warn(`⚠ La hoja Autocad tiene ${maxFila} filas (se esperaban 382).`);
const campos = []; let seccion = null;
for (let fila = 1; fila <= maxFila; fila++) {
  const fA = AC.formula('A' + fila), fB = AC.formula('B' + fila), fC = AC.formula('C' + fila), fD = AC.formula('D' + fila);
  const vA = txt(AC.valor('A' + fila)), unidadPlantilla = txt(AC.valor('C' + fila));
  const refA = referencias(fA, 'Autocad')[0], refB = referencias(fB, 'Autocad')[0];
  const celdaInfo = refB?.hoja === HOJA_INFO ? refB.ref : null;
  const macro = macroAutocad.get(fila) || [];
  const base = { fila, nombre: vA || null };

  // Tipo de fila
  let tipo = 'campo';
  if (fila === 1) tipo = 'titulo';
  else if (/#REF!/.test(fA || '') || /#REF!/.test(fB || '')) tipo = 'roto';
  else if (vA && CABECERA.test(vA) && !macro.length) tipo = 'cabecera';
  else if (!fA && !fB && !vA) tipo = 'vacia';
  if (tipo === 'cabecera') seccion = vA;

  const c = { ...base, tipo, seccion: tipo === 'cabecera' ? vA : seccion };
  if (tipo === 'campo' || tipo === 'titulo') {
    const celdaA = refA?.hoja === HOJA_INFO ? refA.ref : null;
    const fAinfo = celdaA ? IP.formula(celdaA) : null;
    // Unidad: la de la plantilla, o la que escribe la fórmula de la columna C de Información proyecto ("[kW]")
    const refC = referencias(fC, 'Autocad')[0], fCinfo = refC?.hoja === HOJA_INFO ? IP.formula(refC.ref) : null;
    const unidad = (unidadPlantilla && unidadPlantilla !== '0' ? unidadPlantilla : null) || (fCinfo && (/"(\[[^"]+\])"/.exec(fCinfo) || [])[1]) || null;
    Object.assign(c, {
      nombreCondicional: !!(fAinfo && /\bIF\s*\(/i.test(fAinfo)) || undefined,
      propiedadDWG: macro.length ? [...new Set(macro.map(m => m.propiedad))] : null,
      macro: macro.length ? macro.map(m => ({ celda: `${m.col}${fila}`, propiedad: m.propiedad, ...(m.condicion ? { condicion: m.condicion } : {}) })) : undefined,
      unidad,
      celdaInfo,
      celdaNombre: celdaA,
      celdaUnidad: refC?.hoja === HOJA_INFO ? refC.ref : null,
      celdaMm2: fD ? referencias(fD, 'Autocad')[0]?.ref || null : undefined,
      lista: celdaInfo && IP.validaciones.get(celdaInfo)?.lista || undefined,
      ayudaExcel: celdaInfo && IP.validaciones.get(celdaInfo)?.ayuda || undefined,
      valorPlantilla: celdaInfo ? (esError(IP.valor(celdaInfo)) ? null : IP.valor(celdaInfo)) : null,
      ...(celdaInfo ? origenDe(celdaInfo) : { origen: 'sin-fuente' }),
      formula: celdaInfo ? IP.formula(celdaInfo) : null,
      formulaNombre: fAinfo || undefined,
      usadoEn: celdaInfo && usosPorCelda.has(celdaInfo) ? [...usosPorCelda.get(celdaInfo)].sort() : undefined
    });
    if (c.precedentes && !c.precedentes.length) delete c.precedentes;
    if (c.hojasCatalogo && !c.hojasCatalogo.length) delete c.hojasCatalogo;
    // Nombre: el de la plantilla; si la fila es condicional y en la plantilla sale vacía, el de la macro
    if (!c.nombre && c.propiedadDWG) c.nombre = c.propiedadDWG[0];
    if (!c.nombre) c.tipo = 'vacia';
  }
  campos.push(c);
}

/* ---------- Nombres condicionales ----------
   La columna A de la plantilla vacía muestra textos de relleno ("Seleccione un inversor",
   "POTENCIA un inversor", "Ingrese nombre de persona instaladora"…). Para el diccionario
   se necesita el nombre que tiene el campo en un proyecto lleno:
   1. Posiciones de string (dependen de A100:A107): nombre por posición, como la macro.
   2. Otras condicionales: el texto más común en la columna A de los Excel de proyectos
      reales (solo etiquetas; nunca se lee la columna B), si existen en ../_validacion-paso0.
   3. Si no: el texto literal de la rama "sí" de la fórmula, o el nombre de la macro. */
const RELLENO = /Seleccione|Ingrese|No incluye|Tramo no utilizado|un inversor|^$/i;
const etiquetaPos = []; for (let k = 0; k < 8; k++) { const p = (macroAutocad.get(44 + k) || [])[0]?.propiedad || ''; etiquetaPos[k] = (/A\.\d\.\d/.exec(p) || [`posición ${k + 1}`])[0]; }
const nombresProyectos = new Map();   // fila -> Map(nombre -> veces)
{
  const { readdirSync, existsSync } = await import('node:fs');
  const dir = resolve(RAIZ, '..', '_validacion-paso0', 'excel');
  if (existsSync(dir)) for (const f of readdirSync(dir).filter(f => /\.xls[xm]$/i.test(f))) {
    const H = abrirLibro(resolve(dir, f)).hoja('Autocad');
    for (let fila = 2; fila <= maxFila; fila++) { const v = txt(H.valor('A' + fila)); if (!v || esError(v) || RELLENO.test(v)) continue; if (!nombresProyectos.has(fila)) nombresProyectos.set(fila, new Map()); const m = nombresProyectos.get(fila); m.set(v, (m.get(v) || 0) + 1); }
  }
}
for (const c of campos) {
  if (c.tipo !== 'campo' || !c.nombreCondicional) { if (c.tipo === 'campo') c.nombreDesde = 'plantilla'; continue; }
  const f = c.formulaNombre || '';
  const slot = (() => { const m = /\bA(10[0-7])\b/.exec(f) || (/^A(10[0-7])$/.exec(c.celdaNombre || '')); return m ? +m[1] - 100 : null; })();
  if (slot != null) {
    const lit = (/^IF\([^,]+,\s*"[^"]*",\s*"([^"]+)"\s*&/.exec(f) || [])[1];
    c.nombre = lit ? `${lit}string ${etiquetaPos[slot]}` : (c.propiedadDWG?.[0] || `MÓDULOS string ${etiquetaPos[slot]}`);
    c.nombreDesde = 'posicion'; c.posicionString = slot + 1; continue;
  }
  if (!RELLENO.test(c.nombre || '')) { c.nombreDesde = 'plantilla'; continue; }
  const vistos = nombresProyectos.get(c.fila);
  if (vistos && vistos.size) { c.nombre = [...vistos].sort((a, b) => b[1] - a[1])[0][0]; c.nombreDesde = 'proyectos'; continue; }
  const rama = (/^IF\([^,]+,\s*"[^"]*",\s*"([^"]+)"\s*\)$/.exec(f) || [])[1];
  if (rama) { c.nombre = rama; c.nombreDesde = 'formula'; continue; }
  if (c.propiedadDWG) { c.nombre = c.propiedadDWG[0]; c.nombreDesde = 'macro'; continue; }
  c.nombreDesde = 'plantilla';
}

/* ---------- Nombres repetidos: el id estable es "fila + nombre" ---------- */
const porNombre = new Map(); for (const c of campos.filter(c => c.tipo === 'campo')) { const k = c.nombre; if (!porNombre.has(k)) porNombre.set(k, []); porNombre.get(k).push(c.fila); }
const repetidos = [...porNombre].filter(([, f]) => f.length > 1);
for (const c of campos) if (c.tipo === 'campo') c.id = porNombre.get(c.nombre).length > 1 ? `${c.nombre} #${c.fila}` : c.nombre;

/* ---------- Listas desplegables que dependen de otra celda (INDIRECT) ----------
   Se revisa que apunten a la celda que corresponde. Las anomalías conocidas se
   comprueban contra la plantilla: si alguien las corrige en el Excel, el aviso desaparece. */
const listasIndirectas = soloCamposDe(campos).filter(c => /INDIRECT/i.test(c.lista || '')).map(c => {
  const m = /INDIRECT\(\s*(?:"([^"]*)"\s*&\s*)?\$?([A-Z]+)\$?(\d+)\s*\)/i.exec(c.lista);
  return { fila: c.fila, nombre: c.nombre, celda: c.celdaInfo, lista: c.lista, prefijo: m?.[1] || '', depende: m ? `${m[2]}${m[3]}` : null };
});
const ANOMALIAS_LISTA = [
  { prueba: x => /^SAVE Modelo$/.test(x.nombre) && x.depende !== 'G300', texto: x => `"${x.nombre}" (${x.celda}) usa la lista ${x.lista}: apunta al sistema de medida de un cable en vez de la marca del cargador (G300). En el Excel ese desplegable muestra calibres. En la app se usa la marca del cargador.` },
  { prueba: x => /Calibre fase$/.test(x.nombre) && x.depende === 'B165' && x.celda !== 'B166', texto: x => `"${x.nombre}" (${x.celda}) usa ${x.lista}: toma el sistema de medida del tramo UG - Inversor (B165) y no el de su propio tramo. Si un tramo usa AWG y otro mm², la lista sale equivocada. En la app cada tramo usa su propio sistema.` }
];
const problemasListas = []; for (const x of listasIndirectas) for (const a of ANOMALIAS_LISTA) if (a.prueba(x)) problemasListas.push(a.texto(x));
function soloCamposDe(arr) { return arr.filter(c => c.tipo === 'campo'); }

/* ---------- Comprobaciones contra la macro ---------- */
const problemasMacro = [];
for (const [f, ms] of macroAutocad) {
  const c = campos[f - 1];
  if (!c || c.tipo !== 'campo') problemasMacro.push(`La macro lee la fila ${f} (${ms.map(m => m.propiedad).join(' / ')}), que en la plantilla es "${c?.tipo}"${c?.nombre ? ` ("${c.nombre}")` : ''}.`);
}
const noLeidos = campos.filter(c => c.tipo === 'campo' && !c.propiedadDWG);
const nombreDistinto = campos.filter(c => c.tipo === 'campo' && c.propiedadDWG && !c.nombreCondicional && !c.propiedadDWG.includes(c.nombre));

/* ---------- Cuadro de carga: celdas que lee la macro ---------- */
const cuadroDeCarga = macroCuadro.map(m => {
  const f = CC.formula(m.celda), refs = referencias(f, 'Cuadro de carga');
  const info = [...new Set(refs.filter(r => r.hoja === HOJA_INFO && !r.rango).map(r => r.ref))];
  return { celda: m.celda, propiedad: m.propiedad, formula: f, valorPlantilla: esError(CC.valor(m.celda)) ? null : CC.valor(m.celda), celdasInfo: info.length ? info : undefined, hojas: [...new Set(refs.map(r => r.hoja).filter(h => h !== 'Cuadro de carga'))] };
});
const bloquesCuadro = []; { let b = null; for (const line of bas) { const m = /' --- Cuadros de carga: (cuadro \d+[^-]*)---/.exec(line); if (m) bloquesCuadro.push(m[1].trim()); } }

/* ---------- Escribir data/campos.json ---------- */
const soloCampos = campos.filter(c => c.tipo === 'campo');
const cuenta = (arr, k) => arr.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {});
const salida = {
  generado: new Date().toISOString().slice(0, 10), plantilla: 'Campos Autocad -.xlsm', macro: 'macro-GetCampo/Module1.bas', script: 'scripts/extraer-diccionario.mjs',
  notas: [
    'Una fila por fila de la hoja "Autocad" (1 a 382). tipo: campo | cabecera | titulo | roto | vacia.',
    'id = nombre del campo; si el nombre se repite, "nombre #fila".',
    'propiedadDWG = nombre con el que la macro escribe el valor en el DWG (puede diferir del texto de la hoja). Es el que se usa en los textos {…} del unilineal.',
    'origen: zonos (sale de la fila pegada R4:AY4) | catalogo (búsqueda en Equipos o Cables) | calculo (fórmula sobre otras celdas) | manual (celda sin fórmula: se escribe o se elige de una lista).',
    'Los nombres condicionales cambian según el proyecto. nombreDesde: plantilla | posicion (strings, como la macro) | proyectos (texto de un proyecto lleno) | formula | macro.',
    'Las fórmulas originales de Excel no van aquí (son pesadas y la app no las usa): están en docs/referencia/formulas-plantilla.json, por fila y por celda.'
  ],
  resumen: { filas: campos.length, porTipo: cuenta(campos, 'tipo'), campos: soloCampos.length, porOrigen: cuenta(soloCampos, 'origen'), leidosPorMacro: soloCampos.filter(c => c.propiedadDWG).length, celdasCuadroDeCarga: cuadroDeCarga.length },
  zonos,
  campos: campos.map(({ formula, formulaNombre, ...c }) => c),
  cuadroDeCarga: cuadroDeCarga.map(({ formula, ...c }) => c)
};
const referencia = {
  generado: salida.generado, plantilla: salida.plantilla,
  nota: 'Fórmulas originales de la plantilla, para traducirlas al motor (0.3). No las lee la app.',
  informacionProyecto: Object.fromEntries([...IP.celdas].filter(([, c]) => c.f).map(([r, c]) => [r, c.f])),
  autocad: Object.fromEntries(campos.filter(c => c.formula || c.formulaNombre).map(c => [c.fila, { celdaInfo: c.celdaInfo, formula: c.formula, formulaNombre: c.formulaNombre }])),
  cuadroDeCarga: Object.fromEntries([...CC.celdas].filter(([, c]) => c.f).map(([r, c]) => [r, c.f]))
};
mkdirSync(resolve(RAIZ, 'data'), { recursive: true });
writeFileSync(resolve(RAIZ, 'data', 'campos.json'), JSON.stringify(salida, null, 1) + '\n');
mkdirSync(resolve(RAIZ, 'docs', 'referencia'), { recursive: true });
writeFileSync(resolve(RAIZ, 'docs', 'referencia', 'formulas-plantilla.json'), JSON.stringify(referencia, null, 1) + '\n');

/* ---------- docs/DICCIONARIO-CAMPOS.md ---------- */
const secciones = []; for (const c of soloCampos) { let s = secciones.find(x => x.nombre === (c.seccion || '(sin sección)')); if (!s) secciones.push(s = { nombre: c.seccion || '(sin sección)', campos: [] }); s.campos.push(c); }
const tabla = (cab, filas) => [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...filas.map(f => `| ${f.map(x => String(x ?? '—').replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');
const origenes = ['zonos', 'catalogo', 'calculo', 'manual', 'sin-fuente'];
const usos = {}; for (const c of soloCampos) for (const u of c.usadoEn || []) usos[u] = (usos[u] || 0) + 1;
const md = [
  '# Diccionario de campos · hoja "Autocad"', '',
  `Generado por \`scripts/extraer-diccionario.mjs\` el ${salida.generado} desde la plantilla vigente y \`Module1.bas\`. El detalle completo (fórmula original, precedentes, listas) está en \`data/campos.json\`.`, '',
  '## Resumen', '',
  tabla(['', 'Cantidad'], [
    ['Filas de la hoja Autocad', campos.length], ...Object.entries(salida.resumen.porTipo).map(([k, v]) => [`· ${k}`, v]),
    ['Campos leídos por la macro', salida.resumen.leidosPorMacro], ['Campos que la macro no lee', noLeidos.length],
    ['Celdas de "Cuadro de carga" que lee la macro', cuadroDeCarga.length]
  ]), '',
  '### Campos por origen', '',
  tabla(['Origen', 'Qué significa', 'Campos'], [
    ['🔗 zonos', 'Sale de la fila pegada desde ZonOS (R4:AY4)', salida.resumen.porOrigen.zonos || 0],
    ['📚 catalogo', 'Búsqueda en Equipos o Cables y canalización', salida.resumen.porOrigen.catalogo || 0],
    ['⚙ calculo', 'Fórmula sobre otras celdas de la ficha', salida.resumen.porOrigen.calculo || 0],
    ['✎ manual', 'Celda sin fórmula: se escribe o se elige de una lista', salida.resumen.porOrigen.manual || 0],
    ...(salida.resumen.porOrigen['sin-fuente'] ? [['? sin-fuente', 'La fila no apunta a Información proyecto', salida.resumen.porOrigen['sin-fuente']]] : [])
  ]), '',
  '### Campos por sección', '',
  tabla(['Sección', 'Campos', ...origenes.filter(o => salida.resumen.porOrigen[o])], secciones.map(s => [s.nombre, s.campos.length, ...origenes.filter(o => salida.resumen.porOrigen[o]).map(o => s.campos.filter(c => c.origen === o).length || '')])), '',
  '### Otras hojas que usan estos campos (no se implementan en el paso 0)', '',
  tabla(['Hoja', 'Campos que usa'], Object.entries(usos).sort((a, b) => b[1] - a[1])), '',
  '## Macro de AutoCAD', '',
  `- Lee \`Autocad!B\` por fila fija (${macroAutocad.size} filas) y ${cuadroDeCarga.length} celdas de \`Cuadro de carga\` (${bloquesCuadro.join(', ')}). En el Cuadro de carga, la propiedad del DWG se llama igual que la celda ("C9", "D12"…).`,
  `- En 4 tramos, si el sistema de medida es AWG, la macro lee la columna **D** (sección en mm²) en vez de la B. El diccionario lo guarda en \`macro[].condicion\`.`,
  `- Los nombres de string de la macro son **fijos por posición** ("POTENCIA string A.1.2" es siempre la 2ª posición), aunque en la hoja esa fila diga otro string según el inversor (con un 2/1, la 2ª posición es A.2.1). En el DWG manda la posición.`, '',
  problemasMacro.length ? '### Filas que lee la macro pero no son un campo en la plantilla\n\n' + problemasMacro.map(p => `- ${p}`).join('\n') + '\n' : '✓ Cada `Range("Bnn")` de la macro corresponde a un campo del diccionario.\n',
  nombreDistinto.length ? `### Campos cuyo nombre en el DWG es distinto al de la hoja (${nombreDistinto.length})\n\n` + tabla(['Fila', 'En la hoja Autocad', 'En el DWG (macro)'], nombreDistinto.map(c => [c.fila, c.nombre, c.propiedadDWG.join(' / ')])) + '\n' : '',
  `### Campos que la macro no lee (${noLeidos.length})`, '', 'Existen en la hoja pero no llegan al DWG. Se mantienen en la ficha (los usan otras hojas o son pasos intermedios del cálculo).', '',
  tabla(['Fila', 'Campo', 'Origen', 'Usado en'], noLeidos.map(c => [c.fila, c.nombre, c.origen, (c.usadoEn || []).join(', ')])), '',
  '## Listas desplegables', '',
  `${soloCampos.filter(c => c.lista).length} campos tienen lista en el Excel. Las que dependen de otra celda (INDIRECT):`, '',
  tabla(['Fila', 'Campo', 'Celda', 'Lista', 'Depende de'], listasIndirectas.map(x => [x.fila, x.nombre, x.celda, x.lista, x.depende])), '',
  problemasListas.length ? '### Problemas en las listas de la plantilla\n\n' + problemasListas.map(p => `- ${p}`).join('\n') + '\n' : '',
  '## Campos que se calculan en otra hoja', '',
  'Estos campos traen su valor desde "Cuadro de carga" (la caída de tensión se calcula ahí y vuelve a la ficha). El motor (0.3) debe traducir también esas fórmulas.', '',
  tabla(['Fila', 'Campo', 'Viene de'], soloCampos.filter(c => c.precedentesOtrasHojas).map(c => [c.fila, c.nombre, c.precedentesOtrasHojas.join(', ')])), '',
  repetidos.length ? `## Nombres repetidos\n\n${repetidos.map(([n, f]) => `- "${n}": filas ${f.join(', ')}`).join('\n')}\n` : '## Nombres repetidos\n\nNinguno en la plantilla vigente.\n',
  '## Filas sin campo', '', tabla(['Fila', 'Tipo', 'Texto'], campos.filter(c => c.tipo !== 'campo' && c.tipo !== 'cabecera').map(c => [c.fila, c.tipo, c.nombre])), '',
  '## Columnas de ZonOS (Información proyecto R3:AY3)', '',
  tabla(['#', 'Col.', 'Encabezado', 'Campos que la usan'], zonos.map(z => [z.n, z.col, z.encabezado, soloCampos.filter(c => (c.zonos || []).includes(z.celda)).map(c => c.nombre).join(', ')])), ''
];
writeFileSync(resolve(RAIZ, 'docs', 'DICCIONARIO-CAMPOS.md'), md.join('\n'));

console.log(`Filas ${campos.length} · ${Object.entries(salida.resumen.porTipo).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`Origen: ${Object.entries(salida.resumen.porOrigen).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`Macro: ${macroAutocad.size} filas de Autocad + ${cuadroDeCarga.length} celdas de Cuadro de carga · problemas ${problemasMacro.length} · nombre DWG distinto ${nombreDistinto.length} · no leídos ${noLeidos.length}`);
console.log(`Listas INDIRECT: ${listasIndirectas.length} · problemas en listas: ${problemasListas.length}`);
console.log(`Repetidos: ${repetidos.length ? repetidos.map(([n, f]) => `${n} (${f.join(',')})`).join('; ') : 'ninguno'}`);
