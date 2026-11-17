/* ==========================================================================
   Carga (una vez) el diccionario de campos y los catálogos de data/.
   Se generan con scripts/extraer-diccionario.mjs y scripts/extraer-catalogos.mjs.
   ========================================================================== */
let cache = null;

export function cargarDatosFicha() {
  if (!cache) cache = (async () => {
    const leer = async n => { const r = await fetch(`data/${n}`); if (!r.ok) throw new Error(`No se pudo cargar data/${n} (${r.status})`); return r.json(); };
    const [dic, modulos, inversores, baterias, cargadores] = await Promise.all(['campos.json', 'catalogos/modulos.json', 'catalogos/inversores.json', 'catalogos/baterias.json', 'catalogos/cargadores.json'].map(leer));
    return { dic, catalogos: { modulos: modulos.modulos, inversores, baterias: baterias.baterias, cargadores: cargadores.cargadores } };
  })().catch(e => { cache = null; throw e; });
  return cache;
}
