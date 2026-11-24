/* Pruebas de los perfiles de losa plana (js/geom.js: calcRieles modo 'perfil', rayoPoligono).
   Uso: node scripts/probar-perfiles.mjs */
import { calcular, rayoPoligono } from '../js/geom.js';
import { PANELES, GAP_COL } from '../js/catalogo.js';

let ok = 0, mal = 0;
const prueba = (nombre, cond, extra = '') => { if (cond) ok++; else { mal++; console.log(`✗ ${nombre} ${extra}`); } };
const cerca = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// Foto con escala 10 mm/px; techo plano de 10 × 10 m con un bloque de 2 filas × 3 columnas
const P = PANELES[0];
const proyecto = rieles => ({ w: 2000, h: 2000, ref: { a: [0, 0], b: [1000, 0], mm: 10000 }, zonas: [], strings: [], equipos: [], rutas: [], cotas: [], textos: [], figPaneles: [],
  roofs: [{ id: 't1', closed: true, poly: [[500, 500], [1500, 500], [1500, 1500], [500, 1500]], incl: 0, baja: 'abajo', modo: 'manual', setback: 0, rieles, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 2, c: 3 }] }] });
const largoFila = 3 * P.ancho + 2 * GAP_COL;

let R = calcular(proyecto({ modo: 'perfil', sob: 150 }));
prueba('2 perfiles por fila', R.rieles.perfiles.length === 4, `(${R.rieles.perfiles.length})`);
prueba('a lo largo de la fila (horizontales)', R.rieles.perfiles.every(([a, b]) => cerca(a[1], b[1], .01)));
prueba('largo = fila + 2 × sobresale', cerca(R.rieles.mmPerfil, 4 * (largoFila + 300), 2), `(${R.rieles.mmPerfil})`);
prueba('no cuentan como riel', R.rieles.mm === 0 && R.rieles.lineas.length === 0);

R = calcular(proyecto({ modo: 'perfil', largo: 'techo' }));
prueba('hasta el techo: 10 m cada uno', cerca(R.rieles.mmPerfil, 4 * 10000, 2), `(${R.rieles.mmPerfil})`);

R = calcular(proyecto({ modo: 'perfil', largo: 'manual' }));
prueba('a mano: sin perfiles automáticos', R.rieles.perfiles.length === 0 && R.rieles.mmPerfil === 0);

R = calcular(proyecto({ modo: 'perp' }));
prueba('rieles perpendiculares siguen igual', R.rieles.lineas.length === 4 && cerca(R.rieles.mm, 4 * largoFila), `(${R.rieles.mm})`);

// Perfiles aparte de los rieles: se pueden poner los dos
let pr = proyecto({ modo: 'perp' }); pr.roofs[0].perfiles = { on: true };
R = calcular(pr);
prueba('rieles y perfiles juntos', R.rieles.lineas.length === 4 && R.rieles.perfiles.length === 4, `(${R.rieles.lineas.length} / ${R.rieles.perfiles.length})`);
pr = proyecto(undefined); pr.roofs[0].perfiles = { on: true, largo: 'techo' };
R = calcular(pr);
prueba('solo perfiles (campo nuevo)', R.rieles.lineas.length === 0 && cerca(R.rieles.mmPerfil, 4 * 10000, 2));
pr = proyecto({ modo: 'perp' }); pr.roofs[0].perfiles = { on: true }; pr.roofs[0].bloques[0].perfiles = { on: false };
R = calcular(pr);
prueba('bloque sin perfiles en techo con perfiles', R.rieles.perfiles.length === 0 && R.rieles.lineas.length === 4);

prueba('rayo', cerca(rayoPoligono([0, 0], [1, 0], [[5, -1], [5, 1], [-5, 1], [-5, -1]]), 5, 1e-9));
prueba('rayo sin cruce', rayoPoligono([10, 10], [1, 0], [[0, 0], [1, 0], [1, 1]]) === null);

console.log(`${ok} pruebas de perfiles correctas, ${mal} con error.`);
if (mal) process.exit(1);
