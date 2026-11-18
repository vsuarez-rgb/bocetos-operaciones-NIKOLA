/* ==========================================================================
   Mini calculadora de fórmulas de Excel.

   Evalúa las fórmulas de la plantilla "Campos Autocad" tal como están escritas,
   para que el motor no dependa de una traducción a mano: si la plantilla
   cambia, se cargan las fórmulas nuevas y listo.

   Soporta lo que usa la plantilla (y un poco más): operadores + - * / ^ & y
   comparaciones, referencias A1 / $A$1 / Hoja!A1 / 'Hoja con espacios'!A1:B2,
   y las funciones de FUNCIONES (abajo). Si una fórmula usa algo que no está,
   devuelve el error #NAME? y lo informa: la app muestra esa celda como
   "no se pudo calcular" y se puede llenar a mano.

   Semántica de Excel que se respeta:
   - celda vacía = 0 en cuentas y "" en texto; ISBLANK solo es verdadero si está vacía
   - el texto se compara sin distinguir mayúsculas; números < texto < lógicos
   - los errores (#N/A, #VALUE!…) se propagan; IF e IFERROR evalúan solo la rama necesaria
   - BUSCARV exacto no convierte "5" en 5 (como Excel)
   ========================================================================== */

export class ErrorExcel { constructor(codigo, detalle) { this.codigo = codigo; this.detalle = detalle; } toString() { return this.codigo; } }
export const esErr = v => v instanceof ErrorExcel;
const E = (c, d) => new ErrorExcel(c, d);
export const ERR = { NA: '#N/A', VALOR: '#VALUE!', REF: '#REF!', DIV0: '#DIV/0!', NOMBRE: '#NAME?', NUM: '#NUM!', CIRC: '#CIRC!' };

/* ---------- Referencias ---------- */
export const colANum = c => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
export const numACol = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/* ==========================================================================
   Lectura de la fórmula (tokens → árbol)
   ========================================================================== */
function tokens(f) {
  const t = []; let i = 0; const n = f.length;
  const REF = /^(?:(?:'((?:[^']|'')+)'|([A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ.]*))!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?/;
  while (i < n) {
    const c = f[i], resto = f.slice(i);
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') { let s = '', j = i + 1; for (; j < n; j++) { if (f[j] === '"') { if (f[j + 1] === '"') { s += '"'; j++; } else break; } else s += f[j]; } t.push({ k: 'str', v: s }); i = j + 1; continue; }
    if (c === '#') { const m = /^#(?:N\/A|VALUE!|REF!|DIV\/0!|NAME\?|NUM!|NULL!)/.exec(resto); if (m) { t.push({ k: 'err', v: m[0] }); i += m[0].length; continue; } }
    let m;
    if ((m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/i.exec(resto))) { t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }   // una referencia nunca empieza con dígito
    if ((m = REF.exec(resto)) && !/^[\w(]/.test(resto.slice(m[0].length))) {
      const hoja = m[1] ? m[1].replace(/''/g, "'") : (m[2] || null);
      const a = { c: colANum(m[4]), r: +m[6] };
      if (m[8]) t.push({ k: 'rango', hoja, c1: a.c, r1: a.r, c2: colANum(m[8]), r2: +m[10] });
      else t.push({ k: 'ref', hoja, c: a.c, r: a.r });
      i += m[0].length; continue;
    }
    if ((m = /^([A-Za-z_][A-Za-z0-9_.]*)\s*\(/.exec(resto))) { t.push({ k: 'fn', v: m[1].toUpperCase().replace(/^_XLFN\./, '') }); i += m[0].length; continue; }
    if ((m = /^(TRUE|FALSE)(?![\w(])/i.exec(resto))) { t.push({ k: 'bool', v: m[1].toUpperCase() === 'TRUE' }); i += m[0].length; continue; }
    if ((m = /^[A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ.]*/.exec(resto))) { t.push({ k: 'nombre', v: m[0] }); i += m[0].length; continue; }
    if ((m = /^(<>|<=|>=|[-+*/^&=<>%(),;])/.exec(resto))) { t.push({ k: 'op', v: m[1] === ';' ? ',' : m[1] }); i += m[1].length; continue; }
    throw new Error(`Carácter inesperado "${c}" en la posición ${i}`);
  }
  return t;
}

export function leerFormula(texto) {
  const t = tokens(texto.replace(/^=/, '')); let p = 0;
  const ver = (k, v) => t[p] && t[p].k === k && (v === undefined || t[p].v === v);
  const tomar = (k, v) => { if (!ver(k, v)) throw new Error(`Se esperaba ${v || k} en la posición ${p}`); return t[p++]; };
  // precedencia de Excel: comparación < & < + - < * / < ^ < signo < %
  const comparacion = () => { let a = concat(); while (ver('op') && ['=', '<>', '<', '>', '<=', '>='].includes(t[p].v)) { const op = t[p++].v; a = { k: 'bin', op, a, b: concat() }; } return a; };
  const concat = () => { let a = suma(); while (ver('op', '&')) { p++; a = { k: 'bin', op: '&', a, b: suma() }; } return a; };
  const suma = () => { let a = mult(); while (ver('op') && (t[p].v === '+' || t[p].v === '-')) { const op = t[p++].v; a = { k: 'bin', op, a, b: mult() }; } return a; };
  const mult = () => { let a = pot(); while (ver('op') && (t[p].v === '*' || t[p].v === '/')) { const op = t[p++].v; a = { k: 'bin', op, a, b: pot() }; } return a; };
  const pot = () => { let a = signo(); while (ver('op', '^')) { p++; a = { k: 'bin', op: '^', a, b: signo() }; } return a; };
  const signo = () => { if (ver('op', '-')) { p++; return { k: 'neg', a: signo() }; } if (ver('op', '+')) { p++; return signo(); } return pct(); };
  const pct = () => { let a = primario(); while (ver('op', '%')) { p++; a = { k: 'bin', op: '/', a, b: { k: 'num', v: 100 } }; } return a; };
  const primario = () => {
    const x = t[p];
    if (!x) throw new Error('La fórmula termina antes de tiempo');
    if (x.k === 'num' || x.k === 'str' || x.k === 'bool' || x.k === 'err' || x.k === 'ref' || x.k === 'rango' || x.k === 'nombre') { p++; return x; }
    if (x.k === 'op' && x.v === '(') { p++; const e = comparacion(); tomar('op', ')'); return e; }
    if (x.k === 'fn') {
      p++; const args = [];
      if (ver('op', ')')) { p++; return { k: 'fn', v: x.v, args }; }
      for (;;) {
        if (ver('op', ',') || ver('op', ')')) args.push({ k: 'vacio' }); else args.push(comparacion());
        if (ver('op', ',')) { p++; continue; }
        tomar('op', ')'); break;
      }
      return { k: 'fn', v: x.v, args };
    }
    throw new Error(`No entiendo "${x.v ?? x.k}" en la posición ${p}`);
  };
  const arbol = comparacion();
  if (p < t.length) throw new Error(`Sobra texto después de la posición ${p}`);
  return arbol;
}

/* Funciones que usa una fórmula (para avisar si alguna no está soportada) */
export function funcionesDe(arbol, out = new Set()) {
  if (!arbol || typeof arbol !== 'object') return out;
  if (arbol.k === 'fn') out.add(arbol.v);
  for (const k of ['a', 'b']) if (arbol[k]) funcionesDe(arbol[k], out);
  for (const x of arbol.args || []) funcionesDe(x, out);
  return out;
}
/* Celdas que lee una fórmula: [{hoja, c, r}] y rangos (para el grafo de dependencias) */
export function referenciasDe(arbol, out = []) {
  if (!arbol || typeof arbol !== 'object') return out;
  if (arbol.k === 'ref' || arbol.k === 'rango') out.push(arbol);
  for (const k of ['a', 'b']) if (arbol[k]) referenciasDe(arbol[k], out);
  for (const x of arbol.args || []) referenciasDe(x, out);
  return out;
}

/* ==========================================================================
   Evaluación
   ========================================================================== */
class Rango {
  constructor(hoja, c1, r1, c2, r2, leer) { Object.assign(this, { hoja, c1: Math.min(c1, c2), r1: Math.min(r1, r2), c2: Math.max(c1, c2), r2: Math.max(r1, r2), leer }); }
  get filas() { return this.r2 - this.r1 + 1; } get cols() { return this.c2 - this.c1 + 1; }
  v(i, j) { return this.leer(this.hoja, this.c1 + j, this.r1 + i); }           // i = fila, j = columna (desde 0)
  *valores() { for (let i = 0; i < this.filas; i++) for (let j = 0; j < this.cols; j++) yield this.v(i, j); }
}
const esVacio = v => v === null || v === undefined;
/* Matriz: un rango usado como valor (fórmulas matriciales, p. ej. MIN(IF(B100:B107>0,B100:B107))).
   Las operaciones y IF se aplican elemento a elemento; las funciones de agregado recorren sus elementos. */
class Matriz { constructor(vals) { this.vals = vals; } map(fn) { return new Matriz(this.vals.map(fn)); } }
const esMatriz = v => v instanceof Matriz;
const elem = (v, i) => esMatriz(v) ? (i < v.vals.length ? v.vals[i] : E(ERR.NA)) : v;   // una celda vacía es null, no "fuera de rango"
const largo = (...vs) => Math.max(...vs.map(v => esMatriz(v) ? v.vals.length : 1));

/* Conversión a número/texto/lógico como Excel */
function aNum(v) {
  if (esErr(v)) return v;
  if (esVacio(v)) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim(); if (s === '') return E(ERR.VALOR, 'texto vacío como número');
  const n = Number(s.replace(/,(?=\d{3}\b)/g, ''));
  return isFinite(n) ? n : E(ERR.VALOR, `"${s.slice(0, 20)}" no es un número`);
}
export function aTexto(v, op = {}) {
  if (esVacio(v)) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') { let s = numeroATexto(v); if (op.separadorDecimal && op.separadorDecimal !== '.') s = s.replace('.', op.separadorDecimal); return s; }
  return String(v);
}
/* Excel muestra hasta 15 cifras significativas al convertir un número a texto */
function numeroATexto(n) { if (Number.isInteger(n)) return String(n); const s = Number(n.toPrecision(15)); return String(s); }
function aBool(v) {
  if (esErr(v)) return v;
  if (esVacio(v)) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).toUpperCase(); if (s === 'TRUE') return true; if (s === 'FALSE') return false;
  return E(ERR.VALOR, 'texto donde se esperaba VERDADERO/FALSO');
}
/* Orden de Excel: números < texto < lógicos; vacío se compara como 0 o "" según el otro lado */
function comparar(a, b) {
  if (esVacio(a)) a = typeof b === 'string' ? '' : (typeof b === 'boolean' ? false : 0);
  if (esVacio(b)) b = typeof a === 'string' ? '' : (typeof a === 'boolean' ? false : 0);
  const tipo = x => typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : 2;
  if (tipo(a) !== tipo(b)) return tipo(a) - tipo(b);
  if (typeof a === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return a < b ? -1 : a > b ? 1 : 0;
}
const igualExacto = (a, b) => {          // para BUSCARV/COINCIDIR exactos: no mezcla número y texto
  if (esVacio(a) || esVacio(b)) return false;
  if (typeof a !== typeof b) return false;
  return typeof a === 'string' ? a.toLowerCase() === b.toLowerCase() : a === b;
};
const redondear = (x, d) => { const f = Math.pow(10, d); const y = Math.abs(x) * f; const r = Math.round(y + 1e-9 * Math.max(1, y)) / f; return x < 0 ? -r : r; };
/* Fecha serial de Excel (1 = 1900-01-01, con el error histórico del 29-02-1900) */
const fechaASerial = d => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
const serialAFecha = s => new Date(Date.UTC(1899, 11, 30) + Math.floor(s) * 86400000);

/* Criterio de CONTAR.SI: "<>0", ">5", "=texto", "texto" */
function criterio(c) {
  const s = esVacio(c) ? '' : String(c), m = /^(<>|<=|>=|=|<|>)?(.*)$/.exec(s), op = m[1] || '=', val = m[2];
  const vn = val !== '' && isFinite(Number(val)) ? Number(val) : null;
  return v => {
    if (esErr(v)) return false;
    if (vn !== null && typeof v === 'number') { const d = v - vn; return op === '=' ? d === 0 : op === '<>' ? d !== 0 : op === '<' ? d < 0 : op === '>' ? d > 0 : op === '<=' ? d <= 0 : d >= 0; }
    if (op === '<>') return vn !== null ? true : aTexto(v).toLowerCase() !== val.toLowerCase();
    if (op === '=') return vn === null && typeof v !== 'number' ? (val === '' ? esVacio(v) || v === '' : aTexto(v).toLowerCase() === val.toLowerCase()) : false;
    return false;
  };
}
/* TEXTO(valor; formato) con los formatos numéricos simples */
function texto(v, fmt, op) {
  const n = aNum(v); if (esErr(n)) return aTexto(v, op);
  const f = aTexto(fmt);
  const m = /^#?,?#*0*(?:\.(0+))?$/.exec(f.replace(/#,##/, '#,#'));
  if (!m && !/^0+$/.test(f)) return aTexto(v, op);
  const dec = m && m[1] ? m[1].length : 0;
  let s = redondear(n, dec).toFixed(dec);
  if (/,/.test(f)) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return op.separadorDecimal && op.separadorDecimal !== '.' ? s.replace(/[.,]/g, x => x === '.' ? op.separadorDecimal : '.') : s;
}
/* BUSCAR(V/H) aproximado: último valor <= buscado, recorriendo en orden (los datos de la plantilla vienen ordenados) */
function buscarAprox(valor, n, get) { let ult = -1; for (let i = 0; i < n; i++) { const x = get(i); if (esVacio(x) || esErr(x)) continue; const c = comparar(x, valor); if (c <= 0) ult = i; else break; } return ult; }
/* HALLAR/SEARCH sin distinguir mayúsculas, con comodines * y ? */
function hallar(busca, dentro, desde = 1) {
  const b = aTexto(busca), d = aTexto(dentro); const ini = Math.trunc(aNum(desde));
  if (ini < 1 || ini > d.length + 1) return E(ERR.VALOR, 'posición inicial fuera de rango');
  const rx = new RegExp(b.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/~\*/g, '\u0001').replace(/~\?/g, '\u0002').replace(/\*/g, '.*?').replace(/\?/g, '.').replace(/\u0001/g, '\\*').replace(/\u0002/g, '\\?'), 'i');
  const m = rx.exec(d.slice(ini - 1)); return m ? m.index + ini : E(ERR.VALOR, `no se encontró "${b}"`);
}
const plano = (args, ev) => { const out = []; for (const a of args) { const v = ev(a, true); if (v instanceof Rango) for (const x of v.valores()) out.push({ v: x, deRango: true }); else if (esMatriz(v)) for (const x of v.vals) out.push({ v: x, deRango: true }); else out.push({ v, deRango: false }); } return out; };
const numsDe = (args, ev) => { const out = []; for (const { v, deRango } of plano(args, ev)) { if (esErr(v)) return v; if (deRango) { if (typeof v === 'number') out.push(v); } else { const n = aNum(v); if (esErr(n)) return n; out.push(n); } } return out; };

/* ---------- Funciones ---------- */
export const FUNCIONES = {
  IF: (a, ev) => {
    const cond = ev(a[0]);
    const rama = (c, i) => { const r = c ? a[1] : a[2]; if (!r) return !!c; if (r.k === 'vacio') return 0; return r; };
    if (esMatriz(cond)) {   // IF matricial: se evalúa cada rama una vez y se toma elemento a elemento
      const si = a[1] && a[1].k !== 'vacio' ? ev(a[1]) : (a[1] ? 0 : true), no = a[2] ? (a[2].k === 'vacio' ? 0 : ev(a[2])) : false;
      return new Matriz(cond.vals.map((x, i) => { const c = aBool(x); return esErr(c) ? c : elem(c ? si : no, i); }));
    }
    const c = aBool(cond); if (esErr(c)) return c; const r = rama(c); return typeof r === 'object' && r !== null && r.k ? ev(r) : r;
  },
  IFERROR: (a, ev) => { const v = ev(a[0]); return esErr(v) ? ev(a[1]) : v; },
  AND: (a, ev) => { let algun = false; for (const { v, deRango } of plano(a, ev)) { if (esErr(v)) return v; if (deRango && (esVacio(v) || typeof v === 'string')) continue; const b = aBool(v); if (esErr(b)) return b; algun = true; if (!b) return false; } return algun ? true : E(ERR.VALOR); },
  OR: (a, ev) => { let algun = false, r = false; for (const { v, deRango } of plano(a, ev)) { if (esErr(v)) return v; if (deRango && (esVacio(v) || typeof v === 'string')) continue; const b = aBool(v); if (esErr(b)) return b; algun = true; r = r || b; } return algun ? r : E(ERR.VALOR); },
  NOT: (a, ev) => { const b = aBool(ev(a[0])); return esErr(b) ? b : !b; },
  VLOOKUP: (a, ev) => {
    const val = ev(a[0]), R = ev(a[1], true), col = aNum(ev(a[2])), aprox = a[3] && a[3].k !== 'vacio' ? aBool(ev(a[3])) : true;
    if (esErr(val)) return val; if (!(R instanceof Rango)) return E(ERR.VALOR, 'BUSCARV necesita un rango'); if (esErr(col)) return col; if (esErr(aprox)) return aprox;
    if (col < 1 || col > R.cols) return E(ERR.REF, 'columna fuera del rango');
    const i = aprox ? buscarAprox(val, R.filas, i => R.v(i, 0)) : (() => { for (let i = 0; i < R.filas; i++) if (igualExacto(R.v(i, 0), val)) return i; return -1; })();
    if (i < 0) return E(ERR.NA, `BUSCARV no encontró "${aTexto(val).slice(0, 30)}"`);
    const r = R.v(i, Math.trunc(col) - 1); return esVacio(r) ? 0 : r;
  },
  HLOOKUP: (a, ev) => {
    const val = ev(a[0]), R = ev(a[1], true), fila = aNum(ev(a[2])), aprox = a[3] && a[3].k !== 'vacio' ? aBool(ev(a[3])) : true;
    if (esErr(val)) return val; if (!(R instanceof Rango)) return E(ERR.VALOR, 'BUSCARH necesita un rango'); if (esErr(fila)) return fila; if (esErr(aprox)) return aprox;
    if (fila < 1 || fila > R.filas) return E(ERR.REF, 'fila fuera del rango');
    const j = aprox ? buscarAprox(val, R.cols, j => R.v(0, j)) : (() => { for (let j = 0; j < R.cols; j++) if (igualExacto(R.v(0, j), val)) return j; return -1; })();
    if (j < 0) return E(ERR.NA, `BUSCARH no encontró "${aTexto(val).slice(0, 30)}"`);
    const r = R.v(Math.trunc(fila) - 1, j); return esVacio(r) ? 0 : r;
  },
  MATCH: (a, ev) => {
    const val = ev(a[0]), R = ev(a[1], true), tipo = a[2] && a[2].k !== 'vacio' ? aNum(ev(a[2])) : 1;
    if (esErr(val)) return val; if (!(R instanceof Rango)) return E(ERR.VALOR); const n = Math.max(R.filas, R.cols), get = i => R.filas >= R.cols ? R.v(i, 0) : R.v(0, i);
    if (tipo === 0) { for (let i = 0; i < n; i++) if (igualExacto(get(i), val)) return i + 1; return E(ERR.NA); }
    const i = buscarAprox(val, n, get); return i < 0 ? E(ERR.NA) : i + 1;
  },
  COUNTIF: (a, ev) => { const R = ev(a[0], true), ok = criterio(ev(a[1])); if (!(R instanceof Rango)) return E(ERR.VALOR); let n = 0; for (const v of R.valores()) if (ok(v)) n++; return n; },
  SUM: (a, ev) => { const ns = numsDe(a, ev); return esErr(ns) ? ns : ns.reduce((t, x) => t + x, 0); },
  MAX: (a, ev) => { const ns = numsDe(a, ev); return esErr(ns) ? ns : (ns.length ? Math.max(...ns) : 0); },
  MIN: (a, ev) => { const ns = numsDe(a, ev); return esErr(ns) ? ns : (ns.length ? Math.min(...ns) : 0); },
  ROUND: (a, ev) => { const x = aNum(ev(a[0])), d = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(d)) return d; return redondear(x, Math.trunc(d)); },
  ROUNDUP: (a, ev) => { const x = aNum(ev(a[0])), d = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(d)) return d; const f = 10 ** d; return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9) / f; },
  ROUNDDOWN: (a, ev) => { const x = aNum(ev(a[0])), d = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(d)) return d; const f = 10 ** d; return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9) / f; },
  ABS: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.abs(x); },
  SQRT: (a, ev) => { const x = aNum(ev(a[0])); if (esErr(x)) return x; return x < 0 ? E(ERR.NUM) : Math.sqrt(x); },
  POWER: (a, ev) => { const x = aNum(ev(a[0])), y = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(y)) return y; return x ** y; },
  PI: () => Math.PI,
  MID: (a, ev) => { const s = ev(a[0]); if (esErr(s)) return s; const i = aNum(ev(a[1])), n = aNum(ev(a[2])); if (esErr(i)) return i; if (esErr(n)) return n; if (i < 1 || n < 0) return E(ERR.VALOR); return aTexto(s).substr(Math.trunc(i) - 1, Math.trunc(n)); },
  LEFT: (a, ev) => { const s = ev(a[0]); if (esErr(s)) return s; const n = a[1] ? aNum(ev(a[1])) : 1; if (esErr(n)) return n; return aTexto(s).slice(0, Math.max(0, Math.trunc(n))); },
  RIGHT: (a, ev) => { const s = ev(a[0]); if (esErr(s)) return s; const n = a[1] ? aNum(ev(a[1])) : 1; if (esErr(n)) return n; const t = aTexto(s); return n <= 0 ? '' : t.slice(-Math.trunc(n)); },
  LEN: (a, ev) => { const s = ev(a[0]); return esErr(s) ? s : aTexto(s).length; },
  TRIM: (a, ev) => { const s = ev(a[0]); return esErr(s) ? s : aTexto(s).replace(/ +/g, ' ').trim(); },
  UPPER: (a, ev) => { const s = ev(a[0]); return esErr(s) ? s : aTexto(s).toUpperCase(); },
  LOWER: (a, ev) => { const s = ev(a[0]); return esErr(s) ? s : aTexto(s).toLowerCase(); },
  SUBSTITUTE: (a, ev) => { const s = ev(a[0]), o = ev(a[1]), n = ev(a[2]); for (const x of [s, o, n]) if (esErr(x)) return x; const t = aTexto(s), vo = aTexto(o); return vo === '' ? t : t.split(vo).join(aTexto(n)); },
  SEARCH: (a, ev) => { const b = ev(a[0]), d = ev(a[1]); if (esErr(b)) return b; if (esErr(d)) return d; return hallar(b, d, a[2] && a[2].k !== 'vacio' ? ev(a[2]) : 1); },
  FIND: (a, ev) => { const b = aTexto(ev(a[0])), d = aTexto(ev(a[1])), i = a[2] ? aNum(ev(a[2])) : 1; const k = d.indexOf(b, i - 1); return k < 0 ? E(ERR.VALOR) : k + 1; },
  CONCATENATE: (a, ev, op) => { let s = ''; for (const x of a) { const v = ev(x); if (esErr(v)) return v; s += aTexto(v, op); } return s; },
  TEXT: (a, ev, op) => { const v = ev(a[0]), f = ev(a[1]); if (esErr(v)) return v; if (esErr(f)) return f; return texto(v, f, op); },
  VALUE: (a, ev) => aNum(ev(a[0])),
  ISBLANK: (a, ev) => esVacio(ev(a[0])),
  ISNUMBER: (a, ev) => typeof ev(a[0]) === 'number',
  ISTEXT: (a, ev) => typeof ev(a[0]) === 'string',
  ISERROR: (a, ev) => esErr(ev(a[0])),
  ISNA: (a, ev) => { const v = ev(a[0]); return esErr(v) && v.codigo === ERR.NA; },
  TODAY: (a, ev, op) => fechaASerial(op.hoy || new Date()),
  MONTH: (a, ev) => { const s = aNum(ev(a[0])); return esErr(s) ? s : serialAFecha(s).getUTCMonth() + 1; },
  YEAR: (a, ev) => { const s = aNum(ev(a[0])); return esErr(s) ? s : serialAFecha(s).getUTCFullYear(); },
  DAY: (a, ev) => { const s = aNum(ev(a[0])); return esErr(s) ? s : serialAFecha(s).getUTCDate(); },
  INT: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.floor(x); },
  TRUNC: (a, ev) => { const x = aNum(ev(a[0])), d = a[1] ? aNum(ev(a[1])) : 0; if (esErr(x)) return x; if (esErr(d)) return d; const f = 10 ** Math.trunc(d); return Math.trunc(x * f) / f; },
  MOD: (a, ev) => { const x = aNum(ev(a[0])), y = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(y)) return y; return y === 0 ? E(ERR.DIV0) : x - y * Math.floor(x / y); },
  // Trigonometría (la usa la conversión de coordenadas a UTM en "Cables y canalización")
  SIN: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.sin(x); },
  COS: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.cos(x); },
  TAN: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.tan(x); },
  ATAN: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.atan(x); },
  ATAN2: (a, ev) => { const x = aNum(ev(a[0])), y = aNum(ev(a[1])); if (esErr(x)) return x; if (esErr(y)) return y; return Math.atan2(y, x); },
  LN: (a, ev) => { const x = aNum(ev(a[0])); if (esErr(x)) return x; return x <= 0 ? E(ERR.NUM) : Math.log(x); },
  EXP: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : Math.exp(x); },
  RADIANS: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : x * Math.PI / 180; },
  DEGREES: (a, ev) => { const x = aNum(ev(a[0])); return esErr(x) ? x : x * 180 / Math.PI; }
};
FUNCIONES.SEARCHB = FUNCIONES.SEARCH; FUNCIONES.FINDB = FUNCIONES.FIND; FUNCIONES.MIDB = FUNCIONES.MID; FUNCIONES.LENB = FUNCIONES.LEN; FUNCIONES.LEFTB = FUNCIONES.LEFT;

/* ==========================================================================
   evaluar(arbol, contexto)
   contexto = { hoja: hoja de la fórmula, leer(hoja, c, r) → valor de la celda, opciones }
   ========================================================================== */
export function evaluar(arbol, ctx) {
  const op = ctx.opciones || {};
  const binario = (o, a, b) => {
    if (esErr(a)) return a; if (esErr(b)) return b;
    if (o === '&') return aTexto(a, op) + aTexto(b, op);
    if (['=', '<>', '<', '>', '<=', '>='].includes(o)) { const c = comparar(a, b); return o === '=' ? c === 0 : o === '<>' ? c !== 0 : o === '<' ? c < 0 : o === '>' ? c > 0 : o === '<=' ? c <= 0 : c >= 0; }
    const x = aNum(a), y = aNum(b); if (esErr(x)) return x; if (esErr(y)) return y;
    switch (o) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? E(ERR.DIV0) : x / y; case '^': return x ** y; }
    return E(ERR.VALOR);
  };
  const ev = (n, quiereRango = false) => {
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'bool': return n.v;
      case 'err': return E(n.v);
      case 'vacio': return null;
      case 'nombre': return E(ERR.NOMBRE, `nombre desconocido "${n.v}"`);
      case 'ref': { const h = n.hoja || ctx.hoja; const v = ctx.leer(h, n.c, n.r); return quiereRango ? new Rango(h, n.c, n.r, n.c, n.r, ctx.leer) : v; }
      case 'rango': {
        const R = new Rango(n.hoja || ctx.hoja, n.c1, n.r1, n.c2, n.r2, ctx.leer);
        if (quiereRango) return R;
        return R.filas === 1 && R.cols === 1 ? R.v(0, 0) : new Matriz([...R.valores()]);
      }
      case 'neg': { const v = ev(n.a); const f = y => { const x = aNum(y); return esErr(x) ? x : -x; }; return esMatriz(v) ? v.map(f) : f(v); }
      case 'bin': {
        const A = ev(n.a), B = ev(n.b);
        if (esMatriz(A) || esMatriz(B)) { const vals = []; for (let i = 0, L = largo(A, B); i < L; i++) vals.push(binario(n.op, elem(A, i), elem(B, i))); return new Matriz(vals); }
        return binario(n.op, A, B);
      }
      case 'fn': {
        const f = FUNCIONES[n.v];
        if (!f) { ctx.noSoportada && ctx.noSoportada(n.v); return E(ERR.NOMBRE, `la función ${n.v} no está soportada`); }
        try { return f(n.args, ev, op); } catch (e) { return E(ERR.VALOR, e.message); }
      }
    }
    return E(ERR.VALOR, 'nodo desconocido');
  };
  let v = ev(arbol);
  if (v instanceof Rango) v = v.filas === 1 && v.cols === 1 ? v.v(0, 0) : E(ERR.VALOR);
  if (esMatriz(v)) v = v.vals.length ? v.vals[0] : E(ERR.VALOR);      // una celda muestra el primer elemento
  return v;
}
