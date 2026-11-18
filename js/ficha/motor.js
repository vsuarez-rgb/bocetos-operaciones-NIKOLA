/* ==========================================================================
   Motor de la ficha (0.3)

   Calcula todo lo que hoy calcula el Excel "Campos Autocad", evaluando las
   fórmulas de la plantilla (data/plantilla/plantilla.json) con los datos del
   proyecto. No hay fórmulas escritas a mano aquí: si la plantilla cambia, el
   motor usa las nuevas.

   Orden de prioridad para cada celda (como en el Excel de un proyecto):
     1. sobrescrito: valor escrito a mano donde la plantilla tenía fórmula (✎)
     2. fila de ZonOS (Información proyecto R4:AY4) y entradas (celdas sin fórmula)
     3. fórmula de la plantilla (⚙)
     4. valor fijo de la plantilla (etiquetas, y valores por defecto en fichas nuevas)
   En las tablas (Equipos, Cables): los cambios del Excel del proyecto, luego
   los instaladores guardados en el navegador (datos privados) y la plantilla.

     const r = calcularFicha(plantilla, ficha, { personas, hoy });
     r.valor('Información proyecto', 'B35'); r.campos(dic); r.avisos; r.problemas
   ========================================================================== */
import { leerFormula, evaluar, esErr, ErrorExcel, ERR, colANum, numACol } from './formulas.js';

const HOJA_INFO = 'Información proyecto';
const cacheArboles = new Map();
function arbolDe(f) { let a = cacheArboles.get(f); if (!a) { try { a = leerFormula(f); } catch (e) { a = { k: 'err', v: ERR.NOMBRE, detalle: e.message }; } cacheArboles.set(f, a); } return a; }

export function calcularFicha(plantilla, ficha = {}, opciones = {}) {
  const t0 = Date.now();
  // Separador decimal al convertir números en texto: coma, como el Excel en español de Ops ("1x5,26 (F)")
  const op = { hoy: opciones.hoy ? new Date(opciones.hoy) : new Date(), separadorDecimal: opciones.separadorDecimal || ficha.ajustes?.separadorDecimal || ',' };
  const importada = ficha.origen?.tipo === 'campos-autocad';
  const memo = new Map(), enCurso = new Set(), problemas = [], noSoportadas = new Set();

  /* Celdas privadas (instaladores, proyectistas) desde los datos guardados en el navegador */
  const privadas = new Map();
  for (const [clave, def] of Object.entries(plantilla.privado || {})) {
    const lista = clave === 'proyectistas' ? (opciones.personas?.proyectistas || []).map(n => ({ nombre: n })) : (opciones.personas?.[clave] || []);
    def.filas.forEach((r, i) => { const p = lista[i]; if (!p) return; def.columnas.forEach((c, j) => { const v = p[def.campos[j]]; if (v != null && v !== '') privadas.set(`${def.hoja}!${c}${r}`, v); }); });
  }

  const esEntradaInfo = ref => /^[BDG]\d+$/.test(ref) && !(ref in plantilla.hojas[HOJA_INFO].formulas);
  const zonosCol = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); if (!m || +m[2] !== plantilla.zonos.fila) return null; const c = colANum(m[1]); return c >= colANum(plantilla.zonos.desde) && c <= colANum(plantilla.zonos.hasta) ? m[1] : null; };

  function origenDe(hoja, ref) {
    if (plantilla.hojas[hoja]) {
      const sob = hoja === HOJA_INFO ? ficha.sobrescritos?.[ref] : ficha.sobrescritosOtras?.[hoja]?.[ref];
      if (sob) return 'sobrescrito';
      if (hoja === HOJA_INFO) { if (zonosCol(ref)) return 'zonos'; if (ficha.entradas && ref in ficha.entradas) return 'entrada'; }
      if (ref in plantilla.hojas[hoja].formulas) return 'formula';
      return 'constante';
    }
    if (plantilla.tablas[hoja]) { if (ficha.tablasProyecto?.[hoja] && ref in ficha.tablasProyecto[hoja]) return 'proyecto'; if (privadas.has(`${hoja}!${ref}`)) return 'privado'; if (ref in plantilla.tablas[hoja].formulas) return 'formula'; return 'tabla'; }
    return 'desconocida';
  }

  function leer(hoja, c, r) {
    const ref = numACol(c) + r, k = `${hoja}!${ref}`;
    if (memo.has(k)) return memo.get(k);
    let v = null;
    const H = plantilla.hojas[hoja], T = plantilla.tablas[hoja];
    if (H) {
      const sob = hoja === HOJA_INFO ? ficha.sobrescritos?.[ref] : ficha.sobrescritosOtras?.[hoja]?.[ref];
      const zc = hoja === HOJA_INFO ? zonosCol(ref) : null;
      if (sob) v = sob.valor;
      else if (zc) v = ficha.zonos?.[zc] ?? null;
      else if (hoja === HOJA_INFO && ficha.entradas && ref in ficha.entradas) v = ficha.entradas[ref];
      else if (ref in H.formulas) v = calcular(hoja, ref, H.formulas[ref]);
      else if (ref in H.constantes) v = (importada && hoja === HOJA_INFO && esEntradaInfo(ref)) ? null : H.constantes[ref];
    } else if (T) {
      const pr = ficha.tablasProyecto?.[hoja];
      if (pr && ref in pr) v = pr[ref];
      else if (privadas.has(k)) v = privadas.get(k);
      else if (ref in T.formulas) v = calcular(hoja, ref, T.formulas[ref]);
      else v = T.valores[ref] ?? null;
    } else v = new ErrorExcel(ERR.REF, `la hoja "${hoja}" no está en la plantilla`);
    memo.set(k, v);
    return v;
  }

  function calcular(hoja, ref, f) {
    const k = `${hoja}!${ref}`;
    if (enCurso.has(k)) { problemas.push({ tipo: 'circular', celda: k }); return new ErrorExcel(ERR.CIRC, 'referencia circular'); }
    enCurso.add(k);
    try {
      const v = evaluar(arbolDe(f), { hoja, leer, opciones: op, noSoportada: fn => { if (!noSoportadas.has(fn)) { noSoportadas.add(fn); } problemas.push({ tipo: 'funcion-no-soportada', celda: k, detalle: fn }); } });
      return v === null ? 0 : v;        // en Excel, =A1 con A1 vacía muestra 0
    } finally { enCurso.delete(k); }
  }

  const leerRef = (hoja, ref) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? leer(hoja, colANum(m[1]), +m[2]) : null; };

  /* Calcular todas las fórmulas de las hojas de cálculo (así quedan los problemas a la vista) */
  for (const [hoja, H] of Object.entries(plantilla.hojas)) for (const ref of Object.keys(H.formulas)) leerRef(hoja, ref);

  /* Avisos: la columna D de Información proyecto tiene fórmulas que escriben advertencias
     ("Ppeak supera permitida", "Strings con orientaciones diferentes"…) junto al campo que las provoca. */
  const avisos = [];
  for (const ref of Object.keys(plantilla.hojas[HOJA_INFO].formulas)) {
    if (!/^D\d+$/.test(ref)) continue;
    const v = leerRef(HOJA_INFO, ref); if (typeof v !== 'string' || !v.trim()) continue;
    const fila = +ref.slice(1);
    avisos.push({ celda: ref, fila, campoCelda: `B${fila}`, texto: v.trim() });
  }

  return {
    ms: Date.now() - t0,
    valor: leerRef,
    leerCelda: leer,          // (hoja, col, fila) → valor; lo usan las listas desplegables
    origen: origenDe,
    avisos, problemas, funcionesNoSoportadas: [...noSoportadas],
    /* Valores por campo del diccionario (hoja Autocad) */
    campos(dic) {
      const out = [];
      for (const c of dic.campos) {
        if (c.tipo !== 'campo') continue;
        const v = leerRef(HOJA_INFO, c.celdaInfo);
        out.push({ fila: c.fila, id: c.id, valor: esErr(v) ? null : v, error: esErr(v) ? v.codigo : null, detalle: esErr(v) ? v.detalle : null, origen: origenDe(HOJA_INFO, c.celdaInfo), unidad: c.unidad || null });
      }
      return out;
    }
  };
}

/* Para guardar o comparar: los errores como texto (#N/A…) */
export const valorPlano = v => esErr(v) ? v.codigo : v;
