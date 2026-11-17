/* ==========================================================================
   Guardado de proyectos en este navegador (IndexedDB).
   Cuando exista la tabla en Supabase, solo hay que cambiar listar/guardar/borrar.
   ========================================================================== */
import { uid, clone } from './util.js';
import { NOTAS_BASE } from './catalogo.js';

const DB = 'nikola-diseno-ops', ST = 'proyectos';
function abrir() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((res, rej) => { const t = db.transaction(ST, modo), s = t.objectStore(ST), out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); });
}
export const listar = () => tx('readonly', s => s.getAll());
export const guardar = p => { p.editado = new Date().toISOString(); return tx('readwrite', s => s.put(clone(p))); };
export const borrar = id => tx('readwrite', s => s.delete(id));

export function nuevoProyecto(datos = {}) {
  return {
    id: uid('p'), codigo: '', cliente: '', direccion: '', comuna: '', region: '', tipo: 'Residencial', distrib: '', estado: 'pendiente',
    creado: new Date().toISOString(), editado: null,
    img: null, w: 0, h: 0, ref: null, drone: null,
    panel: 'jk730', inversor: 'hw8k', cantInv: 1, solMin: 30,
    roofs: [], zonas: [], strings: [], equipos: [], rutas: [], cotas: [], textos: [], norte: null,
    lamina: { revs: [{ v: 'A', fecha: hoy(), desc: 'EMITIDO PARA REVISIÓN' }], jefe: '', ingeniero: '', proyectista: '', instalador: '', rutInst: '', propietario: '', rutProp: '', escala: '1:100', notas: [...NOTAS_BASE], latlon: '', tierraR: '' },
    ...datos
  };
}
export const hoy = () => new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function nuevoTecho(p, prev) {
  return { id: uid('t'), poly: [], closed: false, ang: prev ? prev.ang : 0, incl: prev ? prev.incl : 15, baja: prev ? prev.baja : 'abajo', modo: 'auto',
    panel: prev ? prev.panel : p.panel, orient: prev ? prev.orient : 'v', setback: prev ? prev.setback : 400, sepFila: 20, bloques: [], off: [] };
}

/* Proyecto de ejemplo: la misma foto de dron que usa la visita comercial. */
export function proyectoEjemplo() {
  const p = nuevoProyecto({ codigo: 'ON 000', cliente: 'Proyecto de ejemplo', direccion: 'Dirección de prueba 1240', comuna: 'Lo Barnechea', region: 'Metropolitana', distrib: 'ENEL', estado: 'diseno',
    img: 'assets/ejemplo-dron.jpg', w: 1400, h: 1050, ref: { a: [220, 412], b: [612, 377], mm: 9370 }, drone: { alt: 119.7, f35: 24, fullW: 7168, roofH: 6, ejemplo: true }, ejemplo: true });
  const t1 = nuevoTecho(p), t2 = nuevoTecho(p);
  Object.assign(t1, { poly: [[220, 412], [612, 377], [640, 725], [258, 762]], closed: true, ang: -5, incl: 5 });
  Object.assign(t2, { poly: [[612, 242], [1018, 214], [1048, 585], [640, 612]], closed: true, ang: -4, incl: 5 });
  p.roofs = [t1, t2];
  p.zonas = [{ id: uid('z'), k: 'obs', x: 384, y: 666, w: 44, h: 44 }, { id: uid('z'), k: 'obs', x: 474, y: 660, w: 44, h: 44 }, { id: uid('z'), k: 'obs', x: 444, y: 544, w: 48, h: 36 },
    { id: uid('z'), k: 'obs', x: 820, y: 212, w: 126, h: 152 }, { id: uid('z'), k: 'obs', x: 752, y: 222, w: 32, h: 172 }];
  p.equipos = [{ id: uid('e'), k: 'inv', x: 905, y: 850, ang: 0 }, { id: uid('e'), k: 'tg', x: 960, y: 850, ang: 0 }, { id: uid('e'), k: 'med', x: 1300, y: 960, ang: 0 }];
  p.norte = { x: 1290, y: 120, ang: 0 };
  p.lamina.jefe = 'Jefe de proyecto'; p.lamina.ingeniero = 'Ingeniero en terreno'; p.lamina.proyectista = 'Proyectista'; p.lamina.propietario = 'Cliente de ejemplo';
  return p;
}
