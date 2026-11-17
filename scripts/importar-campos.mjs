/* ==========================================================================
   Importar un "Campos Autocad" desde la terminal, con el mismo código que usa
   el botón de la app (js/ficha/importar.js).

   node scripts/importar-campos.mjs "../_validacion-paso0/excel/ON 921 - ….xlsm"

   El resultado tiene datos del cliente, así que SOLO se escribe en
   ../_validacion-paso0/resultados/ (fuera del repositorio).
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirLibro } from './leer-xlsx.mjs';
import { importarCamposAutocad, datosProyectoDesdeFicha } from '../js/ficha/importar.js';
import { PANELES, INVERSORES } from '../js/catalogo.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ruta = process.argv[2]; if (!ruta) { console.error('Uso: node scripts/importar-campos.mjs archivo.xlsm'); process.exit(1); }
const SALIDA = resolve(RAIZ, '..', '_validacion-paso0', 'resultados');
const json = n => JSON.parse(readFileSync(resolve(RAIZ, 'data', n), 'utf8'));
const dic = json('campos.json');
const catalogos = { modulos: json('catalogos/modulos.json').modulos, inversores: json('catalogos/inversores.json'), baterias: json('catalogos/baterias.json').baterias, cargadores: json('catalogos/cargadores.json').cargadores };

const t0 = Date.now();
const libro = await abrirLibro(ruta);
const { ficha, resumen } = importarCamposAutocad(libro, dic, { archivo: basename(ruta), catalogos });
const { datos, faltan } = datosProyectoDesdeFicha(ficha, dic, { paneles: PANELES, inversores: INVERSORES });

const base = basename(ruta).replace(/\.xls[xm]$/i, '');
mkdirSync(SALIDA, { recursive: true });
writeFileSync(resolve(SALIDA, `${base} - importacion.json`), JSON.stringify({ ficha, datosProyecto: datos, faltan }, null, 1));

const campoPorCelda = new Map(dic.campos.filter(c => c.tipo === 'campo').map(c => [c.celdaInfo, c]));
const md = [
  `# Importación · ${base}`, '', `Archivo: \`${basename(ruta)}\` · ${new Date().toLocaleString('es-CL')} · ${Date.now() - t0} ms`, '',
  '| | Cantidad |', '|---|---|',
  `| Columnas de ZonOS con dato | ${resumen.zonos} de ${dic.zonos.length} |`,
  `| Celdas escritas o elegidas a mano | ${resumen.entradas} |`,
  `| Fórmulas reemplazadas a mano (sobrescritos) | ${resumen.sobrescritos} |`,
  `| Campos de la hoja Autocad con valor | ${resumen.camposExcel} |`,
  `| Celdas del Cuadro de carga con valor | ${resumen.celdasCuadro} |`,
  `| Equipos que el archivo agregó a su hoja Equipos | ${resumen.equiposNuevos} |`, '',
  '## Avisos', '', ...(resumen.avisos.length ? resumen.avisos.map(a => `- ${a}`) : ['Ninguno.']), '',
  '## Sobrescritos (fórmula de la plantilla reemplazada por un valor)', '',
  '| Celda | En este Excel | Campo del diccionario | Valor |', '|---|---|---|---|',
  ...Object.entries(ficha.sobrescritos).map(([c, s]) => `| ${c} | ${s.etiqueta || s.campo || '(paso intermedio)'} | ${s.campo || '(paso intermedio, no está en la hoja Autocad)'} | ${s.valor} |`), '',
  '## Equipos del archivo que no están en la plantilla', '',
  ...Object.entries(ficha.equiposProyecto).flatMap(([k, arr]) => arr.map(x => `- **${k}**: ${x.marca || x.clave || ''} ${x.modelo} (${x.fuente})`)), ...(resumen.equiposNuevos ? [] : ['Ninguno.']), '',
  '## Datos que toma la app (cajetín y equipos)', '', '```json', JSON.stringify(datos, null, 2), '```', '',
  ...(faltan.length ? ['Faltan para dibujar:', ...faltan.map(f => `- ${f}`), ''] : []),
  '## Entradas por campo de la hoja Autocad', '', '| Celda | Campo | Valor |', '|---|---|---|',
  ...Object.entries(ficha.entradas).filter(([c]) => campoPorCelda.has(c)).map(([c, v]) => `| ${c} | ${campoPorCelda.get(c).id} | ${String(v).replace(/\|/g, '/')} |`), '',
  `Otras ${Object.keys(ficha.entradas).filter(c => !campoPorCelda.has(c)).length} entradas son pasos intermedios (no están en la hoja Autocad): ${Object.keys(ficha.entradas).filter(c => !campoPorCelda.has(c)).join(', ')}.`
];
writeFileSync(resolve(SALIDA, `${base} - importacion.md`), md.join('\n'));

// En la terminal: solo conteos (sin datos del cliente)
console.log(`${basename(ruta).replace(/^(ON|ESP) \d+/, '$1 ···')}: ZonOS ${resumen.zonos}/34 · entradas ${resumen.entradas} · sobrescritos ${resumen.sobrescritos} · Autocad ${resumen.camposExcel} · Cuadro ${resumen.celdasCuadro} · equipos nuevos ${resumen.equiposNuevos} · avisos ${resumen.avisos.length} · ${Date.now() - t0} ms`);
console.log(`  panel → ${datos.panel || '—'} · inversor → ${datos.inversor || '—'} · cantInv ${datos.cantInv ?? '—'}${faltan.length ? ' · falta: ' + faltan.join('; ') : ''}`);
for (const a of resumen.avisos) console.log('  ⚠ ' + a);
console.log(`  Informe: ../_validacion-paso0/resultados/${base} - importacion.md`);
