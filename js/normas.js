/* ==========================================================================
   Normas de instalación que se revisan en la vista de frente (zona de equipos).
   Solo dan advertencias: el ingeniero las revisa y, si está todo bien, marca
   "Revisado" y la advertencia desaparece (se guarda en la hoja: p.normasOk).
   Las alturas se miden desde el nivel de piso de la hoja (p.suelo, en px de la foto).
   Tipos de norma:
     alturaSup · altura del suelo a la PARTE DE ARRIBA del equipo, entre min y max (m)
     alturaInf · altura del suelo a la PARTE DE ABAJO del equipo, al menos min (m); ubic = armario | intemperie
     canalMin  · canalizaciones a por lo menos min (m) del suelo, salvo subterráneas o las marcadas "va a suelo"
   Las normas se editan y agregan en Configuración (rueda arriba a la derecha) y se
   guardan en el navegador (ajuste 'normas').
   ========================================================================== */
import { EQUIPOS, CANAL } from './catalogo.js';
import { escala, escalaSimbolos, tamEquipoPx, esReal } from './geom.js';
import { leerAjuste, guardarAjuste } from './ajustes.js';
import { fmt } from './util.js';

export const TIPOS_NORMA = { alturaSup: 'Altura hasta la parte de arriba del equipo', alturaInf: 'Altura mínima de la parte de abajo del equipo', canalMin: 'Altura mínima de las canalizaciones' };
export const NORMAS_BASE = [
  { id: 'n-alt-eq', nombre: 'Inversor y tableros: del suelo a la parte de arriba del equipo, entre 60 cm y 2 m', tipo: 'alturaSup', equipos: ['inv', 'tg', 'tfv'], min: 0.6, max: 2.0, activa: true },
  { id: 'n-tab-arm', nombre: 'Tableros en armario: al menos 30 cm del suelo', tipo: 'alturaInf', equipos: ['tg', 'tfv'], ubic: 'armario', min: 0.3, activa: true },
  { id: 'n-tab-int', nombre: 'Tableros a la intemperie: al menos 50 cm del suelo', tipo: 'alturaInf', equipos: ['tg', 'tfv'], ubic: 'intemperie', min: 0.5, activa: true },
  { id: 'n-canal', nombre: 'Canalizaciones: al menos 15 cm del suelo (salvo que vayan a suelo)', tipo: 'canalMin', canal: ['cc', 'ca', 'tie'], min: 0.15, activa: true }
];
export const cargarNormas = async () => (await leerAjuste('normas')) || JSON.parse(JSON.stringify(NORMAS_BASE));
export const guardarNormas = n => guardarAjuste('normas', n);

/* mm por px de la hoja: la escala real, o la aproximada con que se dibujan los equipos si no tiene */
const mmPx = p => escala(p) || escalaSimbolos(p) / (p.tamSimb || 1);

/* Advertencias de la hoja: [{ key, norma, t, id, texto, revisada }] */
export function revisarNormas(p, normas) {
  const out = []; if (p.suelo == null || !normas) return out;
  const k = mmPx(p) / 1000, alto = y => (p.suelo - y) * k, ok = p.normasOk || {};
  const m = v => `${fmt(v, 2)} m`;
  normas.filter(n => n.activa !== false).forEach(n => {
    if (n.tipo === 'alturaSup' || n.tipo === 'alturaInf') p.equipos.forEach(e => {
      if (!(n.equipos || []).includes(e.k) || !esReal(p, e)) return;
      if (n.ubic && (e.ubic || 'armario') !== n.ubic) return;
      const Q = tamEquipoPx(p, e), arriba = alto(e.y - Q.h / 2), abajo = alto(e.y + Q.h / 2), nom = e.rotulo || EQUIPOS[e.k]?.n || 'Equipo';
      let texto = null;
      if (n.tipo === 'alturaSup') { if (n.max != null && arriba > n.max + 1e-6) texto = `${nom}: la parte de arriba queda a ${m(arriba)} del suelo (máx. ${m(n.max)})`; else if (n.min != null && arriba < n.min - 1e-6) texto = `${nom}: la parte de arriba queda a ${m(arriba)} del suelo (mín. ${m(n.min)})`; }
      else if (n.min != null && abajo < n.min - 1e-6) texto = `${nom}: queda a ${m(abajo)} del suelo (mín. ${m(n.min)}${n.ubic ? `, ${n.ubic}` : ''})`;
      if (texto) { const key = `${n.id}:${e.id}`; out.push({ key, norma: n, t: 'equipo', id: e.id, texto, revisada: !!ok[key] }); }
    });
    if (n.tipo === 'canalMin') p.rutas.forEach(r => {
      const C = CANAL[r.k]; if (!C || C.riel || C.libre || r.aSuelo || r.k === 'sub' || r.k === 'subcc') return;
      if (n.canal && !n.canal.includes(r.k)) return;
      const bajo = Math.min(...r.pts.map(q => alto(q[1])));
      if (n.min != null && bajo < n.min - 1e-6) { const key = `${n.id}:${r.id}`; out.push({ key, norma: n, t: 'ruta', id: r.id, texto: `${C.corto}: pasa a ${m(Math.max(0, bajo))} del suelo (mín. ${m(n.min)}). Si va a suelo, márcalo en la canalización.`, revisada: !!ok[key] }); }
    });
  });
  return out;
}
