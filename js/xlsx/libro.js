/* ==========================================================================
   Lector mínimo de .xlsx / .xlsm, sin dependencias. Funciona igual en el
   navegador (botón "Importar Campos Autocad") y en Node (scripts/), para que
   lo que se valida en la terminal sea exactamente lo que corre en la app.

   Lee el zip, las hojas, los textos compartidos, las fórmulas, los nombres
   definidos y las listas desplegables. No evalúa fórmulas: entrega el último
   valor que guardó Excel.

     const libro = await abrirLibroBytes(bytes);          // Uint8Array / ArrayBuffer
     const h = libro.hoja('Equipos');
     h.valor('E3'); h.formula('B14'); h.celdas; h.validaciones

   En el navegador descomprime con DecompressionStream('deflate-raw'). En Node
   se le pasa `inflar` (zlib.inflateRawSync), ver scripts/leer-xlsx.mjs.
   ========================================================================== */

const utf8 = new TextDecoder('utf-8');

async function inflarNavegador(datos) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede leer archivos Excel (falta DecompressionStream). Usa Chrome, Edge o Firefox actualizados.');
  const s = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/* ---------- Zip: solo se descomprimen las partes XML que importan ---------- */
async function leerZip(bytes, inflar) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El archivo no es un Excel válido (.xlsx o .xlsm).');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const entradas = [];
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('El archivo Excel está dañado (directorio del zip).');
    const metodo = dv.getUint16(p + 10, true), tamComp = dv.getUint32(p + 20, true), lNom = dv.getUint16(p + 28, true), lExtra = dv.getUint16(p + 30, true), lCom = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    entradas.push({ nombre: utf8.decode(u8.subarray(p + 46, p + 46 + lNom)), metodo, tamComp, local });
    p += 46 + lNom + lExtra + lCom;
  }
  const textos = new Map();
  await Promise.all(entradas.filter(e => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(e.nombre)).map(async e => {
    const ini = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
    const datos = u8.subarray(ini, ini + e.tamComp);
    textos.set(e.nombre, utf8.decode(e.metodo === 0 ? datos : await inflar(datos)));
  }));
  return nombre => textos.get(nombre) ?? null;
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
export const esErrorExcel = v => typeof v === 'string' && /^#(REF|N\/A|VALUE|DIV\/0|NAME|NUM|NULL)[!?]?/.test(v);

/* Desplaza las referencias relativas de una fórmula compartida (A1 → B1 al copiar a la derecha) */
function desplazarFormula(f, dc, df) {
  if (!dc && !df) return f;
  return f.split(/("(?:[^"]|"")*")/).map((trozo, i) => i % 2 ? trozo : trozo.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, dcA, col, dfA, fil, off, str) => {
    const antes = str[off - 1]; if (antes && /[A-Za-z0-9_.]/.test(antes)) return m;
    return (dcA ? '$' + col : '' + numACol(colANum(col) + dc)) + (dfA ? '$' + fil : '' + (+fil + df));
  })).join('');
}

/* ---------- Libro ---------- */
export async function abrirLibroBytes(bytes, { inflar = inflarNavegador } = {}) {
  const leer = await leerZip(bytes, inflar);
  const wb = leer('xl/workbook.xml'); if (!wb) throw new Error('El archivo no parece un libro de Excel (no tiene xl/workbook.xml).');
  const rels = leer('xl/_rels/workbook.xml.rels') || '';
  const destinos = {}; for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) { const a = attrs(m[1]); destinos[a.Id] = a.Target.replace(/^\/?xl\//, ''); }
  const hojas = [...wb.matchAll(/<sheet\b([^>]*)\/>/g)].map(m => { const a = attrs(m[1]); return { nombre: a.name, oculta: a.state === 'hidden' || a.state === 'veryHidden', archivo: 'xl/' + destinos[a['r:id']] }; });
  const nombres = [...wb.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)].map(m => ({ ...attrs(m[1]), ref: desescapar(m[2]) }));
  const ssXml = leer('xl/sharedStrings.xml') || '';
  const textos = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(m => m[1] ? textoRico(m[1]) : '');
  const cache = new Map();

  function hoja(nombre) {
    if (cache.has(nombre)) return cache.get(nombre);
    const h = hojas.find(x => x.nombre === nombre); if (!h) throw new Error(`No existe la hoja "${nombre}". Hojas: ${hojas.map(x => x.nombre).join(', ')}`);
    const xml = leer(h.archivo) || '', celdas = new Map(), maestras = new Map();
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(m[1]), cuerpo = m[2] || ''; const ref = a.r;
      // <v>…</v>, <v xml:space="preserve">…</v> (textos con saltos de línea) y <v/> (texto vacío)
      const fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(cuerpo), vm = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>|<v(?:\s[^>]*)?\/>/.exec(cuerpo);
      let v = vm ? desescapar(vm[1] ?? '') : null, f = null;
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
  return { hojas, nombres, hoja, tieneHoja: n => hojas.some(h => h.nombre === n) };
}
