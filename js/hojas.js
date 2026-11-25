/* ==========================================================================
   Hojas de diseño: una por imagen.
   La hoja principal (techo, foto de dron) son los datos de siempre del proyecto.
   Las demás (canalización, zona de equipos, cargador…) viven en p.hojas, cada una
   con su foto, escala y dibujos. vistaHoja() muestra una hoja "como si fuera el
   proyecto", así el editor y el informe usan las mismas funciones de dibujo.
   ========================================================================== */
import { uid } from './util.js';

export const CLAVES_HOJA = ['img', 'w', 'h', 'ref', 'drone', 'roofs', 'zonas', 'strings', 'equipos', 'rutas', 'cotas', 'textos', 'detalles', 'figuras', 'pisoTxt', 'pisoTam', 'norte', 'sinElementos', 'sinEscala', 'tamSimb', 'verMedidas', 'figPaneles', 'tamEtq', 'tamCotas', 'encerrarStrings', 'ocultarContornos', 'nombreDentro','vistaEquipos', 'fotoOpac', 'suelo', 'normasOk'];
export const TIPOS_HOJA = { canalizacion: 'Recorrido de canalización', equipos: 'Zona de equipos', cargador: 'Cargador', empalme: 'Empalme y medidor', otra: 'Otra' };
/* La hoja principal puede ser el techo con paneles (proyecto fotovoltaico) o cualquier otra, p. ej. un proyecto EXT de solo cargador */
export const TIPOS_PRINCIPAL = { techo: 'Techo con paneles (foto de dron)', ...TIPOS_HOJA };
export const tipoPrincipal = p => p.tipoHojaPrincipal || 'techo';
export const nombrePrincipal = p => p.nombreHojaPrincipal || (tipoPrincipal(p) === 'techo' ? 'Techo (dron)' : TIPOS_HOJA[tipoPrincipal(p)]);

export function nuevaHoja(tipo = 'otra', nombre) {
  return { id: uid('h'), tipo, nombre: nombre || TIPOS_HOJA[tipo] || 'Hoja', img: null, w: 0, h: 0, ref: null, drone: null, roofs: [], zonas: [], strings: [], equipos: [], rutas: [], cotas: [], textos: [], norte: null, figPaneles: [] };
}
export function vistaHoja(pr, id) {
  if (!id) return pr;
  const hoja = t => (t.hojas || []).find(x => x.id === id);
  return new Proxy(pr, {
    get(t, k) { const h = hoja(t); if (h && k === '_esHoja') return true; if (h && k === 'vistaEquipos') return h.vistaEquipos || (h.tipo === 'equipos' ? 'elevacion' : 'planta'); return h && CLAVES_HOJA.includes(k) ? h[k] : t[k]; },
    set(t, k, v) { const h = hoja(t); if (h && CLAVES_HOJA.includes(k)) h[k] = v; else t[k] = v; return true; },
    deleteProperty(t, k) { const h = hoja(t); if (h && CLAVES_HOJA.includes(k)) delete h[k]; else delete t[k]; return true; }
  });
}
/* Todas las hojas del proyecto, la principal primero: [{ id (null = principal), nombre, tipo }] */
export const listaHojas = p => [{ id: null, nombre: nombrePrincipal(p), tipo: 'principal' }, ...(p.hojas || []).map(h => ({ id: h.id, nombre: h.nombre, tipo: h.tipo }))];
/* Referencia a una hoja desde una plantilla: "principal", un id, o "tipo:canalizacion#2" (la 2ª de ese tipo) */
export function resolverHoja(p, ref) {
  if (!ref || ref === 'principal') return { id: null, existe: true };
  const m = /^tipo:(\w+)(?:#(\d+))?$/.exec(ref);
  if (m) { const de = (p.hojas || []).filter(h => h.tipo === m[1]); const h = de[(+m[2] || 1) - 1]; return h ? { id: h.id, existe: true } : { id: null, existe: false, falta: `${TIPOS_HOJA[m[1]] || m[1]}${m[2] > 1 ? ' ' + m[2] : ''}` }; }
  return (p.hojas || []).some(h => h.id === ref) ? { id: ref, existe: true } : { id: null, existe: false, falta: 'hoja borrada' };
}
