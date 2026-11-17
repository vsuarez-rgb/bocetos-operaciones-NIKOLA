/* ==========================================================================
   Lector mínimo de .xlsx / .xlsm sin dependencias (solo Node).
   Lee el zip, las hojas, los textos compartidos, las fórmulas y los nombres
   definidos. No evalúa fórmulas: entrega el último valor que guardó Excel.

   Uso:
     import { abrirLibro } from './leer-xlsx.mjs';
     const libro = abrirLibro('../Campos Autocad -.xlsm');
     const h = libro.hoja('Equipos');
     h.valor('E3'); h.formula('B14'); h.celdas  // Map 'E3' -> { v, f, t }
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/* ---------- Zip ---------- */
function leerZip(buf) {
  // Fin del directorio central: firma 0x06054b50, buscando desde el final
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('No es un archivo zip válido (.xlsx/.xlsm)');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  const archivos = new Map();
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central dañado');
    const metodo = buf.readUInt16LE(p + 10), tamComp = buf.readUInt32LE(p + 20), lNom = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + lNom);
    archivos.set(nombre, { metodo, tamComp, local });
    p += 46 + lNom + lExtra + lCom;
  }
  return nombre => {
    const a = archivos.get(nombre); if (!a) return null;
    const ini = a.local + 30 + buf.readUInt16LE(a.local + 26) + buf.readUInt16LE(a.local + 28);
    const datos = buf.subarray(ini, ini + a.tamComp);
    return (a.metodo === 0 ? datos : inflateRawSync(datos)).toString('utf8');
  };
}

/* ---------- XML (lo justo para SpreadsheetML) ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const desescapar = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m))
  .replace(/_x([0-9A-F]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const attrs = s => { const o = {}; for (const m of s.matchAll(/([\w:]+)="([^"]*)"/g)) o[m[1]] = desescapar(m[2]); return o; };
/* Texto de un <si> o <is>: concatena los <t>, ignorando la fonética <rPh> */
const textoRico = x => [...x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)].map(m => desescapar(m[1] || '')).join('');

/* ---------- Referencias ---------- */
export const colANum = c => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
export const numACol = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
export const partirRef = ref => { const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref); return m ? { col: colANum(m[1]), fila: +m[2] } : null; };

/* Desplaza las referencias relativas de una fórmula compartida (A1 → B1 al copiar a la derecha) */
function desplazarFormula(f, dc, df) {
  if (!dc && !df) return f;
  // No tocar texto entre comillas ni nombres de hoja entre apóstrofos
  return f.split(/("(?:[^"]|"")*")/).map((trozo, i) => i % 2 ? trozo : trozo.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, dcA, col, dfA, fil, off, str) => {
    const antes = str[off - 1]; if (antes && /[A-Za-z0-9_.]/.test(antes)) return m;
    return (dcA ? '$' + col : '' + numACol(colANum(col) + dc)) + (dfA ? '$' + fil : '' + (+fil + df));
  })).join('');
}

/* ---------- Libro ---------- */
export function abrirLibro(ruta) {
  const leer = leerZip(readFileSync(ruta));
  const wb = leer('xl/workbook.xml'), rels = leer('xl/_rels/workbook.xml.rels') || '';
  const destinos = {}; for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) { const a = attrs(m[1]); destinos[a.Id] = a.Target.replace(/^\/?xl\//, ''); }
  const hojas = [...wb.matchAll(/<sheet\b([^>]*)\/>/g)].map(m => { const a = attrs(m[1]); return { nombre: a.name, oculta: a.state === 'hidden' || a.state === 'veryHidden', archivo: 'xl/' + destinos[a['r:id']] }; });
  const nombres = [...wb.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)].map(m => ({ ...attrs(m[1]), ref: desescapar(m[2]) }));
  const ssXml = leer('xl/sharedStrings.xml') || '';
  const textos = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(m => m[1] ? textoRico(m[1]) : '');
  const cache = new Map();

  function hoja(nombre) {
    if (cache.has(nombre)) return cache.get(nombre);
    const h = hojas.find(x => x.nombre === nombre); if (!h) throw new Error(`No existe la hoja "${nombre}". Hojas: ${hojas.map(x => x.nombre).join(', ')}`);
    const xml = leer(h.archivo), celdas = new Map(), maestras = new Map();
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(m[1]), cuerpo = m[2] || ''; const ref = a.r;
      const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(cuerpo), vm = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
      let v = vm ? desescapar(vm[1]) : null, f = null;
      if (a.t === 's' && v != null) v = textos[+v];
      else if (a.t === 'inlineStr') v = textoRico(cuerpo);
      else if (a.t === 'b' && v != null) v = v === '1';
      else if ((a.t === 'n' || !a.t) && v != null && v !== '') v = +v;
      if (fm) {
        const fa = attrs(fm[1] || ''); f = fm[2] != null ? desescapar(fm[2]) : '';
        if (fa.t === 'shared') { if (f) maestras.set(fa.si, { f, ...partirRef(ref) }); else { const ms = maestras.get(fa.si), p = partirRef(ref); f = ms ? desplazarFormula(ms.f, p.col - ms.col, p.fila - ms.fila) : null; } }
      }
      if (v == null && f == null) continue;
      celdas.set(ref, { v, f, t: a.t === 'e' ? 'error' : (typeof v) });
    }
    /* Listas desplegables (validación de datos). Excel las guarda en dos formatos:
       <dataValidation sqref="B8"><formula1>Regiones</formula1> y, si apuntan a otra hoja,
       <x14:dataValidation><xm:f>Equipos!$E$294:$E$306</xm:f><xm:sqref>B24</xm:sqref>. */
    const validaciones = new Map();
    const agregarVal = (sqref, v) => { for (const parte of sqref.trim().split(/\s+/)) { const [a, b] = parte.split(':'); const pa = partirRef(a), pb = b ? partirRef(b) : pa; if (!pa || !pb) continue; for (let r = pa.fila; r <= pb.fila; r++) for (let c = pa.col; c <= pb.col; c++) validaciones.set(numACol(c) + r, v); } };
    for (const m of xml.matchAll(/<dataValidation\b([^>]*)>([\s\S]*?)<\/dataValidation>/g)) { const a = attrs(m[1]); const f1 = /<formula1>([\s\S]*?)<\/formula1>/.exec(m[2]); if (a.sqref) agregarVal(a.sqref, { tipo: a.type || null, lista: f1 ? desescapar(f1[1]) : null, ayuda: a.prompt || null }); }
    for (const m of xml.matchAll(/<x14:dataValidation\b([^>]*)>([\s\S]*?)<\/x14:dataValidation>/g)) { const a = attrs(m[1]); const f = /<xm:f>([\s\S]*?)<\/xm:f>/.exec(m[2]), sq = /<xm:sqref>([\s\S]*?)<\/xm:sqref>/.exec(m[2]); if (sq) agregarVal(sq[1], { tipo: a.type || null, lista: f ? desescapar(f[1]) : null, ayuda: a.prompt || null }); }
    const out = {
      nombre, oculta: h.oculta, celdas, validaciones,
      valor: ref => celdas.get(ref)?.v ?? null,
      formula: ref => celdas.get(ref)?.f ?? null,
      /* Filas como arreglos desde la columna c0 hasta c1 (letras), fila f0..f1 */
      rango(c0, f0, c1, f1) { const out = []; for (let r = f0; r <= f1; r++) { const fila = []; for (let c = colANum(c0); c <= colANum(c1); c++) fila.push(celdas.get(numACol(c) + r)?.v ?? null); out.push(fila); } return out; },
      maxFila() { let m = 0; for (const k of celdas.keys()) m = Math.max(m, partirRef(k).fila); return m; }
    };
    cache.set(nombre, out); return out;
  }
  return { hojas, nombres, hoja };
}

/* CLI de exploración: node scripts/leer-xlsx.mjs archivo.xlsm "Hoja" [desdeFila] [hastaFila]
   Solo para mirar en la terminal. No guarda nada. */
if (process.argv[1] && process.argv[1].endsWith('leer-xlsx.mjs') && process.argv[2]) {
  const [, , ruta, nombre, d = 1, hst = 1e6] = process.argv;
  const L = abrirLibro(ruta);
  if (!nombre) { console.log(L.hojas.map(h => `${h.nombre}${h.oculta ? ' (oculta)' : ''}`).join('\n')); process.exit(0); }
  for (const [ref, c] of L.hoja(nombre).celdas) { const f = partirRef(ref).fila; if (f >= +d && f <= +hst) console.log(`${ref}\t${String(c.v ?? '').replace(/\r?\n/g, ' / ')}${c.f ? '\t=' + c.f.replace(/\s*\r?\n\s*/g, ' ') : ''}`); }
}
