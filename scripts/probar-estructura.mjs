/* Pruebas del tipo de montaje y de la estructura (js/geom.js: montajeDe, calcEstructura, cubicacionMontaje).
   Uso: node scripts/probar-estructura.mjs */
import { calcular, montajeDe, textoIncl, cubicacionMontaje, notaMontaje, rayoPoligono } from '../js/geom.js';
import { PANELES, MONTAJE_DEF } from '../js/catalogo.js';

let ok = 0, mal = 0;
const prueba = (nombre, cond, extra = '') => { if (cond) ok++; else { mal++; console.log(`✗ ${nombre} ${extra}`); } };
const cerca = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// Foto de 2000 px con escala 10 mm/px (20 m); un techo cuadrado de 10 m con un bloque manual
const P = PANELES[0];
const proyecto = (roof) => ({ w: 2000, h: 2000, ref: { a: [0, 0], b: [1000, 0], mm: 10000 }, zonas: [], strings: [], equipos: [], rutas: [], cotas: [], textos: [], figPaneles: [],
  roofs: [{ id: 't1', closed: true, poly: [[500, 500], [1500, 500], [1500, 1500], [500, 1500]], incl: 0, baja: 'abajo', modo: 'manual', setback: 0, ...roof }] });

// 1. Sin montaje: se deduce de los campos de siempre (proyectos guardados)
prueba('sin nada → riel', montajeDe({ incl: 20 }).tipo === 'riel');
prueba('con inclPan → fija', montajeDe({ incl: 0, inclPan: 10 }).tipo === 'fija');
prueba('rieles.modo perfil → perfil', montajeDe({ incl: 0, rieles: { modo: 'perfil', sob: 200 } }).tipo === 'perfil');
prueba('perfil viejo conserva lo que sobresale', montajeDe({ incl: 0, rieles: { modo: 'perfil', sob: 200 } }).sobresale === 200);
prueba('bloque con incl propia → fija', montajeDe({ incl: 0 }, { incl: 12 }).tipo === 'fija');
prueba('bloque riel no usa su incl', montajeDe({ incl: 5, inclPan: 20 }, { incl: 12, montaje: { tipo: 'riel' } }).ang === 5);
prueba('texto ajustable', textoIncl({ incl: 0, inclPan: 30, montaje: { tipo: 'ajustable', angMin: 15 } }) === '15–30º');
prueba('texto fija', textoIncl({ incl: 0, inclPan: 10 }) === '10º');

// 2. Riel: sin estructura
let p = proyecto({ bloques: [{ id: 'b1', x: 1000, y: 1000, f: 1, c: 3 }] });
let R = calcular(p);
prueba('riel: paneles', R.n === 3, `(${R.n})`);
prueba('riel: sin líneas de estructura', R.estructura.lineas.length === 0 && R.estructura.perfiles.length === 0);

// 3. Fija: 1 fila de 3 paneles verticales; bases cada sepBases + una en cada extremo
p = proyecto({ inclPan: 10, montaje: { tipo: 'fija', sepBases: 1000, sobresale: 150 }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 1, c: 3 }] });
R = calcular(p);
const largoFila = 3 * P.ancho + 2 * 20, nEsperado = Math.max(2, Math.ceil(largoFila / 1000) + 1);
prueba('fija: líneas por fila', R.estructura.lineas.length === nEsperado, `(${R.estructura.lineas.length} vs ${nEsperado})`);
prueba('fija: 2 bases por línea', R.estructura.bases.length === 2 * nEsperado);
prueba('fija: delanteras = traseras', R.estructura.porTecho[0].delanteras === nEsperado && R.estructura.porTecho[0].traseras === nEsperado);
prueba('fija: metros de perfil = (largo panel + 2 × sobresale) por línea', cerca(R.estructura.porTecho[0].mmPerfil, nEsperado * (P.largo + 300)), `(${R.estructura.porTecho[0].mmPerfil})`);
// baja 'abajo': la base delantera (lado que baja) queda más abajo en la foto que la trasera
const del = R.estructura.bases.find(b => b.pos === 'delantera'), tra = R.estructura.bases.find(b => b.pos === 'trasera');
prueba('fija: delantera abajo, trasera arriba', del.y > tra.y);
prueba('fija: anclajes = bases × anclajes por base', R.estructura.porTecho[0].anclajes === 2 * nEsperado * MONTAJE_DEF.anclajesPorBase);
prueba('flecha sube: hacia arriba si baja hacia abajo', R.estructura.flechas.length === 1 && R.estructura.flechas[0][1][1] < R.estructura.flechas[0][0][1]);

// 4. Dos filas: cada fila tiene su estructura
p = proyecto({ inclPan: 10, montaje: { tipo: 'fija', sepBases: 1000, sobresale: 150 }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 2, c: 3 }] });
R = calcular(p);
prueba('fija: 2 filas → el doble de líneas', R.estructura.lineas.length === 2 * nEsperado, `(${R.estructura.lineas.length})`);

// 5. Ajustable: la sombra usa el ángulo máximo (inclPan)
const pA = proyecto({ inclPan: 30, montaje: { tipo: 'ajustable', angMin: 15 }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 2, c: 1 }] });
const pF = proyecto({ inclPan: 30, montaje: { tipo: 'fija' }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 2, c: 1 }] });
const yFila = R2 => { const ys = R2.validos.map(pn => Math.min(...pn.q.map(q => q[1]))).sort((a, b) => a - b); return ys[1] - ys[0]; };
prueba('ajustable: misma separación de filas que fija al ángulo máximo', cerca(yFila(calcular(pA)), yFila(calcular(pF)), .01));

// 6. Perfil: 2 por fila, a lo largo de la fila, sobresalen
p = proyecto({ inclPan: 0, montaje: { tipo: 'perfil', sobresale: 150 }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 2, c: 3 }] });
R = calcular(p);
prueba('perfil: 2 por fila', R.estructura.perfiles.length === 4, `(${R.estructura.perfiles.length})`);
prueba('perfil: largo = fila + 2 × sobresale', cerca(R.estructura.porTecho[0].mmPerfil, 2 * 2 * (largoFila + 300), 2), `(${R.estructura.porTecho[0].mmPerfil})`);
prueba('perfil: horizontales (a lo largo de la fila)', R.estructura.perfiles.every(([a, b]) => cerca(a[1], b[1], .01)));
// largo 'techo': llegan al borde del techo (de x=500 a x=1500 px = 10 m)
p.roofs[0].montaje.largo = 'techo'; R = calcular(p);
prueba('perfil hasta el techo: 10 m cada uno', cerca(R.estructura.porTecho[0].mmPerfil, 4 * 10000, 2), `(${R.estructura.porTecho[0].mmPerfil})`);
// largo 'manual': no se ponen solos
p.roofs[0].montaje.largo = 'manual'; R = calcular(p);
prueba('perfil manual: sin perfiles automáticos', R.estructura.perfiles.length === 0);

// 7. Bloque con montaje propio en un techo con otro
p = proyecto({ inclPan: 10, montaje: { tipo: 'fija' }, bloques: [{ id: 'b1', x: 800, y: 800, f: 1, c: 1 }, { id: 'b2', x: 1200, y: 1200, f: 1, c: 1, montaje: { tipo: 'riel' } }] });
R = calcular(p);
const n1 = Math.max(2, Math.ceil(P.ancho / MONTAJE_DEF.sepBases) + 1);
prueba('bloque riel en techo fijo: solo el otro bloque lleva estructura', R.estructura.lineas.length === n1 && R.estructura.flechas.length === 1, `(${R.estructura.lineas.length} vs ${n1})`);

// 8. Cubicación y nota
p = proyecto({ inclPan: 30, montaje: { tipo: 'ajustable', angMin: 15, anclaje: 'perno doble hilo' }, bloques: [{ id: 'b1', x: 1000, y: 1000, f: 1, c: 2 }] });
R = calcular(p);
const C = cubicacionMontaje(p, R);
prueba('cubicación: un techo', C.techos.length === 1 && C.delanteras === R.estructura.porTecho[0].delanteras);
prueba('nota', notaMontaje(p, R) === 'Los paneles del techo 1 se instalan sobre estructura ajustable 15–30°, anclada con perno doble hilo.', notaMontaje(p, R));

// 9. Rayo contra un polígono
prueba('rayo', cerca(rayoPoligono([0, 0], [1, 0], [[5, -1], [5, 1], [-5, 1], [-5, -1]]), 5, 1e-9));
prueba('rayo sin cruce', rayoPoligono([10, 10], [1, 0], [[0, 0], [1, 0], [1, 1]]) === null);

console.log(`${ok} pruebas de estructura correctas, ${mal} con error.`);
if (mal) process.exit(1);
