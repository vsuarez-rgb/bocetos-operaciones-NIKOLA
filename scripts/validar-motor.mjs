/* ==========================================================================
   Validar el motor contra Excel real.

   node scripts/validar-motor.mjs [archivo.xlsm …]    (por defecto, los de ../_validacion-paso0/excel)

   Para cada Excel: importa sus datos (igual que el botón de la app), calcula
   con el motor y compara CADA celda con fórmula de "Información proyecto" y
   "Cuadro de carga" con el valor que guardó Excel.

   En la terminal solo salen celdas y conteos. El detalle con valores (datos
   del cliente) queda en ../_validacion-paso0/resultados/, fuera del repo.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirLibro, esErrorExcel } from './leer-xlsx.mjs';
import { importarCamposAutocad } from '../js/ficha/importar.js';
import { calcularFicha } from '../js/ficha/motor.js';
import { esErr } from '../js/ficha/formulas.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(RAIZ, '..', '_validacion-paso0');
const json = p => JSON.parse(readFileSync(resolve(RAIZ, p), 'utf8'));
const dic = json('data/campos.json'), plantilla = json('data/plantilla/plantilla.json');
const catalogos = { modulos: json('data/catalogos/modulos.json').modulos, inversores: json('data/catalogos/inversores.json'), baterias: json('data/catalogos/baterias.json').baterias, cargadores: json('data/catalogos/cargadores.json').cargadores };
const PRIV = resolve(RAIZ, '..', '_privado', 'personas.json');
const personas = existsSync(PRIV) ? JSON.parse(readFileSync(PRIV, 'utf8')) : {};
const archivos = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(resolve(DIR, 'excel')).filter(f => /\.xls[xm]$/i.test(f)).map(f => resolve(DIR, 'excel', f));
const anon = s => s.replace(/(ON|ESP) \d+/g, '$1 ···');
const TOL = 0.01;

/* Igualdad para la comparación: errores con errores, vacío con "", números con tolerancia, texto sin espacios sobrantes */
function comparar(excel, motor) {
  const eErr = esErrorExcel(excel), mErr = esErr(motor);
  if (eErr || mErr) return eErr && mErr ? 'igual' : (eErr ? 'excel-error' : 'motor-error');
  const vacio = v => v == null || (typeof v === 'string' && v.trim() === '');
  if (vacio(excel) && vacio(motor)) return 'igual';
  if (typeof excel === 'number' || typeof motor === 'number') {
    const a = typeof excel === 'number' ? excel : Number(String(excel).replace(',', '.')), b = typeof motor === 'number' ? motor : Number(String(motor).replace(',', '.'));
    if (isFinite(a) && isFinite(b)) return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a)) * (Math.abs(a) > 100 ? 0.01 : 1) ? 'igual' : 'distinto';
  }
  if (typeof excel === 'boolean' || typeof motor === 'boolean') return String(excel).toUpperCase() === String(motor).toUpperCase() ? 'igual' : 'distinto';
  return String(excel).replace(/\s+/g, ' ').trim() === String(motor).replace(/\s+/g, ' ').trim() ? 'igual' : 'distinto';
}

mkdirSync(resolve(DIR, 'resultados'), { recursive: true });
const resumenes = [];
for (const ruta of archivos) {
  const libro = await abrirLibro(ruta);
  const { ficha } = importarCamposAutocad(libro, dic, { archivo: basename(ruta), catalogos, plantilla });
  // La fecha: TODAY() en el Excel se calculó el día que se guardó; no se puede reproducir. Esas celdas se informan aparte.
  const r = calcularFicha(plantilla, ficha, { personas });
  const filas = [], cuenta = {};
  for (const [hoja, H] of Object.entries(plantilla.hojas)) {
    const X = libro.hoja(hoja);
    for (const [ref, f] of Object.entries(H.formulas)) {
      const c = X.celdas.get(ref);
      let estado;
      if (!c?.f) estado = 'sobrescrito';                                       // en el Excel es un valor a mano o la borraron
      else if (/TODAY\(\)/i.test(f)) estado = 'fecha';
      else if (c?.f && c.f.replace(/[\s$]/g, '').toUpperCase() !== f.replace(/[\s$]/g, '').toUpperCase()) { const k = comparar(c?.v ?? null, r.valor(hoja, ref)); estado = k === 'igual' ? 'igual' : 'formula-distinta'; }
      else estado = comparar(c?.v ?? null, r.valor(hoja, ref));
      cuenta[estado] = (cuenta[estado] || 0) + 1;
      if (!['igual', 'sobrescrito'].includes(estado)) filas.push({ hoja, ref, estado, excel: c?.v ?? null, motor: esErr(r.valor(hoja, ref)) ? `${r.valor(hoja, ref).codigo} (${r.valor(hoja, ref).detalle || ''})` : r.valor(hoja, ref), formula: f });
    }
  }
  const total = Object.values(cuenta).reduce((t, x) => t + x, 0), comparables = total - (cuenta.sobrescrito || 0) - (cuenta.fecha || 0);
  const pct = ((cuenta.igual || 0) / comparables * 100).toFixed(1);
  resumenes.push({ archivo: anon(basename(ruta)), total, cuenta, pct, ms: r.ms, problemas: r.problemas.length });
  const base = basename(ruta).replace(/\.xls[xm]$/i, '');
  writeFileSync(resolve(DIR, 'resultados', `${base} - motor.md`), [
    `# Motor vs Excel · ${base}`, '', `Celdas con fórmula: ${total} · iguales ${cuenta.igual || 0} (${pct} % de las comparables) · ${JSON.stringify(cuenta)} · ${r.ms} ms`, '',
    '| Hoja | Celda | Estado | Excel | Motor | Fórmula |', '|---|---|---|---|---|---|',
    ...filas.map(x => `| ${x.hoja} | ${x.ref} | ${x.estado} | ${String(x.excel ?? '').replace(/\|/g, '/')} | ${String(x.motor ?? '').replace(/\|/g, '/')} | \`${x.formula.replace(/\s+/g, ' ').slice(0, 160).replace(/\|/g, '/')}\` |`)
  ].join('\n'));
  console.log(`${anon(basename(ruta))}: ${cuenta.igual || 0}/${comparables} iguales (${pct} %) · ${Object.entries(cuenta).filter(([k]) => k !== 'igual').map(([k, v]) => `${k} ${v}`).join(' · ')} · ${r.ms} ms`);
  const distintos = filas.filter(x => ['distinto', 'motor-error', 'excel-error'].includes(x.estado));
  if (distintos.length) console.log('   distintas: ' + distintos.slice(0, 40).map(x => `${x.hoja === 'Cuadro de carga' ? 'CC!' : ''}${x.ref}(${x.estado[0]})`).join(' '));
}

/* Resumen sin datos de clientes para la app (página "Plantilla"): solo el tipo de caso y los conteos */
const caso = a => a.replace(/\.xls[xm]$/i, '').replace(/^(ON|ESP) ···\s*(\(archivo[^)]*\))?\s*-\s*/i, '').trim();
writeFileSync(resolve(RAIZ, 'data', 'plantilla', 'validacion.json'), JSON.stringify({
  fecha: new Date().toISOString().slice(0, 10), plantilla: plantilla.huella,
  nota: 'Cada celda con fórmula de Información proyecto y Cuadro de carga, calculada por el motor y comparada con el valor que guardó Excel. Las sobrescritas a mano y las que dependen de la fecha de hoy no se comparan.',
  proyectos: resumenes.map(r => ({ caso: caso(r.archivo), comparadas: r.total - (r.cuenta.sobrescrito || 0) - (r.cuenta.fecha || 0), iguales: r.cuenta.igual || 0, porcentaje: +r.pct, formulaAntiguaEnExcel: (r.cuenta['formula-distinta'] || 0) + (r.cuenta['excel-error'] || 0), distintas: (r.cuenta.distinto || 0) + (r.cuenta['motor-error'] || 0) }))
}, null, 1) + '\n');
console.log('→ data/plantilla/validacion.json (sin datos de clientes)');
