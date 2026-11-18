/* ==========================================================================
   Listas desplegables de la ficha, tal como las define la plantilla
   (validación de datos de "Información proyecto"):
     "Regiones"                         → rango con nombre
     "Equipos!$E$294:$E$306"            → rango directo
     "INDIRECT($B$8)"                   → rango cuyo nombre está en otra celda (comunas de la región)
     "INDIRECT(\"Dif_A_\"&$B$109)"      → nombre armado con texto + celda
   Se resuelven con el mismo motor (datos del proyecto, instaladores locales…).
   ========================================================================== */
import { leerFormula, evaluar, esErr, colANum } from './formulas.js';

const HOJA_INFO = 'Información proyecto';
const cache = new Map();
const arbol = t => { if (!cache.has(t)) { try { cache.set(t, leerFormula(t)); } catch { cache.set(t, null); } } return cache.get(t); };

/** Opciones (texto) de la lista de una celda de Información proyecto, o null si no tiene lista */
/* Listas rotas en la plantilla (ver docs/DICCIONARIO-CAMPOS.md). Solo se corrigen si la plantilla
   sigue trayendo la lista rota: si alguien la arregla en el Excel, se usa la del Excel. */
const CORRECCIONES = {
  G301: { rota: 'INDIRECT(B165)', bien: 'INDIRECT($G$300)', motivo: 'la lista de SAVE Modelo apuntaba al sistema de medida de un cable' },
  B200: { rota: 'INDIRECT(B165)', bien: 'INDIRECT($B$199)', motivo: 'usaba el sistema de medida del tramo UG - Inversor' },
  B234: { rota: 'INDIRECT(B165)', bien: 'INDIRECT($B$233)', motivo: 'usaba el sistema de medida del tramo UG - Inversor' },
  B268: { rota: 'INDIRECT(B165)', bien: 'INDIRECT($B$267)', motivo: 'usaba el sistema de medida del tramo UG - Inversor' },
  B302: { rota: 'INDIRECT(B165)', bien: 'INDIRECT($B$301)', motivo: 'usaba el sistema de medida del tramo UG - Inversor' }
};

export function opcionesLista(plantilla, motor, celda) {
  const def = plantilla.validaciones?.[celda]; if (!def) return null;
  let lista = typeof def === 'string' ? def : def.lista;
  const cor = CORRECCIONES[celda]; if (cor && lista.replace(/\s|\$/g, '') === cor.rota.replace(/\$/g, '')) lista = cor.bien;
  const valores = [];
  const leer = motor.leerCelda;
  const deArea = (hojaPorDefecto, n) => {
    if (!n) return;
    if (n.k === 'ref') valores.push(leer(n.hoja || hojaPorDefecto, n.c, n.r));
    else if (n.k === 'rango') for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) valores.push(leer(n.hoja || hojaPorDefecto, c, r));
  };
  const deNombre = nombre => {
    // Exacto, y si no, tolerante: "Región del Maule" → "Maule", "Región de La Araucanía" → "LaAraucanía"
    // (en el Excel esa lista queda vacía cuando la región viene escrita así desde ZonOS).
    const n = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
    const v = n(String(nombre).replace(/^\s*regi[oó]n\s+(del?\s+)?/i, ''));
    const ks = Object.keys(plantilla.nombres || {});
    const k = ks.find(x => x.toLowerCase() === String(nombre).trim().toLowerCase()) || ks.find(x => n(x) === v) || (v.length > 3 ? ks.find(x => n(x).length > 3 && v.includes(n(x))) : null);
    if (!k) return false;
    for (const area of plantilla.nombres[k].split(',')) deArea(HOJA_INFO, arbol(area));
    return true;
  };
  const n = arbol(lista); if (!n) return [];
  if (n.k === 'nombre') deNombre(n.v);
  else if (n.k === 'ref' || n.k === 'rango') deArea(HOJA_INFO, n);
  else if (n.k === 'fn' && n.v === 'INDIRECT' && n.args[0]) {
    const v = evaluar(n.args[0], { hoja: HOJA_INFO, leer, opciones: {} });
    if (!esErr(v) && v != null && v !== '') { if (!deNombre(v)) deArea(HOJA_INFO, arbol(String(v))); }
  }
  const vistos = new Set(), out = [];
  for (const v of valores) { if (v == null || esErr(v)) continue; const s = String(v).trim(); if (!s || vistos.has(s)) continue; vistos.add(s); out.push(typeof v === 'number' ? v : s); }
  return out;
}
export { colANum };
