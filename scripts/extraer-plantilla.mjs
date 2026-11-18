/* ==========================================================================
   0.3 · Fórmulas y tablas de la plantilla, como datos para el motor

   node scripts/extraer-plantilla.mjs [ruta-plantilla]

   El motor de la app (js/ficha/motor.js) no tiene las fórmulas escritas a
   mano: evalúa las de la plantilla. Si "Campos Autocad" cambia, se vuelve a
   correr este script (o se carga la plantilla nueva en la app) y el motor
   usa las fórmulas nuevas.

   Genera data/plantilla/plantilla.json con:
     hojas['Información proyecto' | 'Cuadro de carga']: { formulas, constantes }
     tablas['Equipos' | 'Cables y canalización']: { valores, formulas }
       (fórmulas solo si dependen de la ficha; las que apuntan a libros
        externos rotos se dejan con su último valor)
     privado: rangos de Equipos con datos de personas, que NO se publican
       (la app los completa con los instaladores guardados en el navegador)
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirLibro } from './leer-xlsx.mjs';
import { extraerPlantilla } from '../js/ficha/plantilla.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = resolve(process.argv[2] || resolve(RAIZ, '..', 'Campos Autocad -.xlsm'));
const libro = await abrirLibro(RUTA);

/* Nombres de personas conocidos (archivo privado) para no publicarlos aunque aparezcan como valor por defecto */
const PRIV = resolve(RAIZ, '..', '_privado', 'personas.json');
const personas = existsSync(PRIV) ? JSON.parse(readFileSync(PRIV, 'utf8')) : { instaladores: [], proyectistas: [] };
const nombresPrivados = [...personas.instaladores.flatMap(i => [i.nombre, i.rut, i.correo, i.telefono, i.direccion]), ...personas.proyectistas].filter(Boolean);

const { plantilla, informe } = extraerPlantilla(libro, { archivo: basename(RUTA), nombresPrivados });

/* Candado de privacidad (igual que en los catálogos) */
const s = JSON.stringify(plantilla);
for (const rx of [/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/, /[\w.+-]+@[\w-]+\.[\w.]+/, /\+?56\s*9[\s\d]{7,}/]) { const m = rx.exec(s); if (m) { console.error(`✗ La plantilla extraída contiene algo que parece un dato personal ("${m[0].slice(0, 5)}…"). No se escribió nada.`); process.exit(1); } }
for (const n of nombresPrivados) if (n.length > 5 && s.includes(n)) { console.error('✗ La plantilla extraída contiene el nombre o dato de una persona del archivo privado. No se escribió nada.'); process.exit(1); }

mkdirSync(resolve(RAIZ, 'data', 'plantilla'), { recursive: true });
writeFileSync(resolve(RAIZ, 'data', 'plantilla', 'plantilla.json'), JSON.stringify(plantilla) + '\n');
console.log(`Plantilla ${plantilla.archivo} · huella ${plantilla.huella}`);
for (const l of informe) console.log('  ' + l);
console.log(`→ data/plantilla/plantilla.json (${(s.length / 1024).toFixed(0)} KB)`);
