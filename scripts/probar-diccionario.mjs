/* ==========================================================================
   Pruebas del diccionario (0.2) — node scripts/probar-diccionario.mjs
   Revisa data/campos.json contra la macro (Module1.bas) y contra sí mismo.
   Sale con código 1 si algo falla.
   ========================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(readFileSync(resolve(RAIZ, 'data', 'campos.json'), 'utf8'));
const BAS = resolve(RAIZ, '..', 'macro-GetCampo', 'Module1.bas');
let fallas = 0, ok = 0;
const prueba = (nombre, cond, detalle = '') => { if (cond) { ok++; } else { fallas++; console.error(`✗ ${nombre}${detalle ? `\n    ${detalle}` : ''}`); } };

const campos = D.campos.filter(c => c.tipo === 'campo');
const porFila = new Map(D.campos.map(c => [c.fila, c]));

prueba('La hoja Autocad tiene 382 filas', D.campos.length === 382, `tiene ${D.campos.length}`);
prueba('Las filas van de 1 a 382 sin saltos', D.campos.every((c, i) => c.fila === i + 1));
prueba('La fila de ZonOS tiene 34 columnas R→AY', D.zonos.length === 34 && D.zonos[0].col === 'R' && D.zonos[33].col === 'AY');
{ const ids = campos.map(c => c.id), rep = ids.filter((x, i) => ids.indexOf(x) !== i); prueba('Los id de campo son únicos', !rep.length, rep.join(', ')); }
{ const sin = campos.filter(c => !c.nombre || /Seleccione|Ingrese|un inversor|no utilizado/i.test(c.nombre)); prueba('Ningún campo queda con nombre de relleno', !sin.length, sin.map(c => `${c.fila}: ${c.nombre}`).join('; ')); }
{ const sin = campos.filter(c => !['zonos', 'catalogo', 'calculo', 'manual'].includes(c.origen)); prueba('Todos los campos tienen origen conocido', !sin.length, sin.map(c => `${c.fila}: ${c.origen}`).join('; ')); }
{ const sin = campos.filter(c => !c.celdaInfo); prueba('Todos los campos apuntan a una celda de Información proyecto', !sin.length, sin.map(c => c.fila).join(', ')); }

if (existsSync(BAS)) {
  const bas = readFileSync(BAS, 'utf8'); let hoja = null; const leidas = [], cuadro = [];
  for (const l of bas.split(/\r?\n/)) {
    const h = /Set xlSheet = xlWB\.Sheets\("([^"]+)"\)/.exec(l); if (h) hoja = h[1];
    const m = /^\s*WriteCustomProperty "([^"]+)",\s*xlSheet\.Range\("([A-Z]+)(\d+)"\)/.exec(l);
    if (m) (hoja === 'Autocad' ? leidas : cuadro).push({ prop: m[1], col: m[2], fila: +m[3] });
  }
  const malas = leidas.filter(x => porFila.get(x.fila)?.tipo !== 'campo');
  prueba(`Cada Range("Bnn") de la macro (${leidas.length}) corresponde a un campo del diccionario`, !malas.length, malas.map(x => `${x.col}${x.fila} "${x.prop}" → ${porFila.get(x.fila)?.tipo}`).join('; '));
  const sinProp = leidas.filter(x => !(porFila.get(x.fila)?.propiedadDWG || []).includes(x.prop));
  prueba('Cada propiedad de la macro está en propiedadDWG de su fila', !sinProp.length, sinProp.map(x => `${x.fila}: ${x.prop}`).join('; '));
  const deMas = campos.filter(c => c.propiedadDWG && !leidas.some(x => x.fila === c.fila));
  prueba('No hay propiedadDWG que la macro no escriba', !deMas.length, deMas.map(c => c.fila).join(', '));
  const celdasCuadro = new Set(D.cuadroDeCarga.map(c => c.celda));
  const faltan = cuadro.filter(x => !celdasCuadro.has(`${x.col}${x.fila}`));
  prueba(`Las ${cuadro.length} celdas de Cuadro de carga que lee la macro están en el diccionario`, !faltan.length, faltan.map(x => `${x.col}${x.fila}`).join(', '));
  prueba('Las propiedades del Cuadro de carga se llaman igual que su celda', cuadro.every(x => x.prop === `${x.col}${x.fila}`));
} else console.warn(`⚠ No encontré ${BAS}: se omiten las pruebas contra la macro.`);

console.log(`${ok} pruebas correctas, ${fallas} con error.`);
process.exit(fallas ? 1 : 0);
