/* ==========================================================================
   Conjuntos de equipos para empezar una zona de equipos (o cualquier hoja):
   equipos y canalizaciones ya ubicados, que después se mueven y editan uno a
   uno. Medidas en mm desde la esquina superior izquierda del conjunto.
   Equipo: { k, x, y (centro, mm), mods?, rotulo? }   Ruta: { k, pts: [[x,y]…] (mm) }
   Los de cada persona se guardan en el navegador (ajuste 'conjuntosEquipos').
   ========================================================================== */
import { escala, escalaSimbolos } from './geom.js';
import { uid } from './util.js';

/* En los conjuntos parten sin etiqueta las cajas y los tableros (ya rotulados por dentro); las canalizaciones también */
const SIN_ETQ = new Set(['cp', 'cdj', 'tfv', 'tg']);
export const CONJUNTOS_INCLUIDOS = [
  { id: 'cj-sg-frente', nombre: 'Instalación con SmartGuard (de frente)', vista: 'elevacion', detalle: 'Baterías, inversor, tablero FV, SmartGuard, cajas de paso y bandeja',
    equipos: [
      { k: 'bat', x: 335, y: 1060, mods: 3, rotulo: 'BATERÍAS' }, { k: 'cp', x: 790, y: 760 },
      { k: 'inv', x: 1300, y: 380, rotulo: 'INVERSOR' }, { k: 'cp', x: 1150, y: 1080 }, { k: 'cdj', x: 1480, y: 1080 },
      { k: 'tfv', x: 1980, y: 560, rotulo: 'TABLERO GENERAL FOTOVOLTAICO' }, { k: 'sg', x: 2620, y: 520, rotulo: 'SMART GUARD' },
      { k: 'bpc', x: 2250, y: 1080, rotulo: 'Bandeja porta conductores' }],
    rutas: [
      { k: 'cc', pts: [[1050, -250], [1050, 1080], [1075, 1080]] }, { k: 'cc', pts: [[790, 835], [790, 1130], [1075, 1130]] },
      { k: 'tie', pts: [[1225, 1080], [1380, 1080]] }, { k: 'ca', pts: [[1580, 1080], [1700, 1080]] }, { k: 'ca', pts: [[1760, -250], [1760, 1030]] }] },
  { id: 'cj-sg-esquema', nombre: 'Instalación con SmartGuard (esquema)', vista: 'elevacion', detalle: 'Inversor, TFV, SmartGuard y TG unidos en CA, con baterías',
    equipos: [
      { k: 'inv', x: 520, y: 330, rotulo: 'INVERSOR' }, { k: 'tfv', x: 1300, y: 270, rotulo: 'TFV' }, { k: 'sg', x: 2050, y: 330, rotulo: 'SMART GUARD' },
      { k: 'tg', x: 2850, y: 330, rotulo: 'TG' }, { k: 'cp', x: 420, y: 780 }, { k: 'cdj', x: 760, y: 780 },
      { k: 'cdj', x: 1950, y: 820 }, { k: 'cdj', x: 2300, y: 820 }, { k: 'bat', x: 470, y: 1650, mods: 2, rotulo: 'BATERÍAS' }],
    rutas: [
      { k: 'ca', pts: [[835, 780], [1300, 780], [1300, 420]] }, { k: 'ca', pts: [[1300, 780], [1875, 820]] },
      { k: 'ca', pts: [[2375, 820], [2850, 820], [2850, 580]] }, { k: 'ca', pts: [[2850, 820], [3500, 820]] },
      { k: 'cc', pts: [[420, 855], [420, 980]] }, { k: 'tie', pts: [[495, 780], [685, 780]] }] },
  { id: 'cj-inv-bat', nombre: 'Inversor + baterías', vista: 'elevacion', detalle: 'Inversor con su torre de baterías y caja de paso',
    equipos: [{ k: 'bat', x: 335, y: 900, mods: 3, rotulo: 'BATERÍAS' }, { k: 'inv', x: 1150, y: 500, rotulo: 'INVERSOR' }, { k: 'cp', x: 1150, y: 1050 }],
    rutas: [{ k: 'cc', pts: [[1150, 690], [1150, 975]] }, { k: 'cc', pts: [[670, 1050], [1075, 1050]] }] },
  { id: 'cj-inv-tfv', nombre: 'Inversor + tablero FV + medidor', vista: 'elevacion', detalle: 'Lo básico de una instalación sin baterías',
    equipos: [{ k: 'inv', x: 300, y: 400, rotulo: 'INVERSOR' }, { k: 'tfv', x: 1000, y: 380, rotulo: 'TFV' }, { k: 'med', x: 1650, y: 380, rotulo: 'MEDIDOR' }, { k: 'cp', x: 300, y: 900 }],
    rutas: [{ k: 'cc', pts: [[300, -250], [300, 825]] }, { k: 'ca', pts: [[375, 900], [1000, 900], [1000, 630]] }, { k: 'ca', pts: [[1000, 900], [1650, 900], [1650, 580]] }] },
  { id: 'cj-marca', nombre: 'Ubicación propuesta (marca roja)', vista: null, detalle: 'Rectángulo rojo para señalar dónde van los equipos en la foto del muro',
    equipos: [{ k: 'marca', x: 400, y: 400, rotulo: 'Ubicación propuesta' }], rutas: [] }
];

/* Pone un conjunto en la hoja p con su esquina superior izquierda en q (px de la foto) */
export function insertarConjunto(p, cj, q) {
  const kpx = 1 / escalaSimbolos(p) * (escala(p) ? 1 : (p.tamSimb || 1));
  const P = v => [q[0] + v[0] * kpx, q[1] + v[1] * kpx];
  const eqs = cj.equipos.map(e => { const [x, y] = P([e.x, e.y]); const n = { id: uid('e'), k: e.k, x, y, ang: e.ang || 0, modo: e.modo || 'real' }; if (e.mods) n.mods = e.mods; if (e.rotulo) n.rotulo = e.rotulo; if (e.modelo) n.modelo = e.modelo; if (e.mw) { n.mw = e.mw; n.mh = e.mh; } if (SIN_ETQ.has(e.k)) n.etq = { oculta: true }; return n; });
  const rts = (cj.rutas || []).map(r => ({ id: uid('r'), k: r.k, pts: r.pts.map(P), tramo: r.k === 'cc' || r.k === 'subcc' ? '' : ['tie', 'riel'].includes(r.k) ? '' : 'inv-tg', etq: { oculta: true } }));
  p.equipos.push(...eqs); p.rutas.push(...rts);
  return { equipos: eqs, rutas: rts };
}
/* Guarda los equipos y canalizaciones de la hoja como un conjunto propio (en mm, desde su esquina) */
export function conjuntoDeHoja(p, nombre) {
  const mm = escalaSimbolos(p) / (escala(p) ? 1 : (p.tamSimb || 1));
  const pts = [...p.equipos.map(e => [e.x, e.y]), ...p.rutas.flatMap(r => r.pts)]; if (!pts.length) return null;
  const x0 = Math.min(...pts.map(v => v[0])) - 300 / mm, y0 = Math.min(...pts.map(v => v[1])) - 300 / mm;
  const M = v => [Math.round((v[0] - x0) * mm), Math.round((v[1] - y0) * mm)];
  return { id: 'cj' + Date.now().toString(36), nombre, vista: p.vistaEquipos || null, detalle: `${p.equipos.length} equipos · ${p.rutas.length} canalizaciones`,
    equipos: p.equipos.map(e => { const [x, y] = M([e.x, e.y]); const o = { k: e.k, x, y }; ['mods', 'rotulo', 'modelo', 'mw', 'mh', 'ang'].forEach(k => { if (e[k] != null) o[k] = e[k]; }); return o; }),
    rutas: p.rutas.map(r => ({ k: r.k, pts: r.pts.map(M) })) };
}
