/* ==========================================================================
   Lector de Excel para los scripts de Node. Usa el mismo código que la app
   (js/xlsx/libro.js); aquí solo se le da el archivo y la descompresión zlib.

     import { abrirLibro } from './leer-xlsx.mjs';
     const libro = await abrirLibro('../Campos Autocad -.xlsm');
     libro.hoja('Equipos').valor('E3');

   CLI de exploración (solo muestra en la terminal, no guarda nada):
     node scripts/leer-xlsx.mjs archivo.xlsm "Hoja" [desdeFila] [hastaFila]
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { abrirLibroBytes, partirRef } from '../js/xlsx/libro.js';
export { desescapar, colANum, numACol, partirRef, esErrorExcel } from '../js/xlsx/libro.js';

export const abrirLibro = ruta => abrirLibroBytes(readFileSync(ruta), { inflar: d => inflateRawSync(d) });

if (process.argv[1] && process.argv[1].endsWith('leer-xlsx.mjs') && process.argv[2]) {
  const [, , ruta, nombre, d = 1, hst = 1e6] = process.argv;
  const L = await abrirLibro(ruta);
  if (!nombre) { console.log(L.hojas.map(h => `${h.nombre}${h.oculta ? ' (oculta)' : ''}`).join('\n')); process.exit(0); }
  for (const [ref, c] of L.hoja(nombre).celdas) { const f = partirRef(ref).fila; if (f >= +d && f <= +hst) console.log(`${ref}\t${String(c.v ?? '').replace(/\r?\n/g, ' / ')}${c.f ? '\t=' + c.f.replace(/\s*\r?\n\s*/g, ' ') : ''}`); }
}
