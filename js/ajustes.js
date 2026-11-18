/* ==========================================================================
   Ajustes guardados en este navegador (IndexedDB, base aparte de los proyectos):
   - 'plantilla': una plantilla "Campos Autocad" cargada a mano (reemplaza a la publicada)
   - 'personas': instaladores y proyectistas (datos privados: nunca se publican)
   Cuando exista Supabase, esto pasa a la cuenta de cada persona o de Ops.
   ========================================================================== */
const DB = 'nikola-diseno-ops-ajustes', ST = 'ajustes';
function abrir() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((res, rej) => { const t = db.transaction(ST, modo), q = fn(t.objectStore(ST)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); });
}
export const leerAjuste = clave => tx('readonly', s => s.get(clave)).catch(() => undefined);
export const guardarAjuste = (clave, valor) => tx('readwrite', s => s.put(valor, clave));
export const borrarAjuste = clave => tx('readwrite', s => s.delete(clave));
