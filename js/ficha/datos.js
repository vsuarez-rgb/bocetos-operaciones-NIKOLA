/* ==========================================================================
   Carga (una vez) lo que necesita la ficha:
   - diccionario de campos y catálogos de data/ (scripts/extraer-*.mjs)
   - la plantilla para el motor: la publicada (data/plantilla/plantilla.json)
     o, si en este navegador se cargó una versión nueva de Campos Autocad,
     esa (ver la página "Plantilla")
   - instaladores y proyectistas guardados en este navegador (privados)
   ========================================================================== */
import { leerAjuste } from '../ajustes.js';

let cache = null;
const leer = async n => { const r = await fetch(`data/${n}`); if (!r.ok) throw new Error(`No se pudo cargar data/${n} (${r.status})`); return r.json(); };

export function cargarDatosFicha() {
  if (!cache) cache = (async () => {
    const [dic, modulos, inversores, baterias, cargadores, publicada, local, personas] = await Promise.all([
      leer('campos.json'), leer('catalogos/modulos.json'), leer('catalogos/inversores.json'), leer('catalogos/baterias.json'), leer('catalogos/cargadores.json'),
      leer('plantilla/plantilla.json'), leerAjuste('plantilla'), leerAjuste('personas')
    ]);
    return {
      dic, catalogos: { modulos: modulos.modulos, inversores, baterias: baterias.baterias, cargadores: cargadores.cargadores },
      plantilla: local?.plantilla || publicada, plantillaPublicada: publicada, plantillaLocal: local || null,
      personas: personas || { instaladores: [], proyectistas: [] }
    };
  })().catch(e => { cache = null; throw e; });
  return cache;
}
/* Después de cambiar la plantilla o los instaladores, volver a cargar */
export const olvidarDatosFicha = () => { cache = null; };
export const cargarValidacion = () => leer('plantilla/validacion.json').catch(() => null);
