/* ==========================================================================
   0.1 · Catálogos desde la plantilla "Campos Autocad -.xlsm"

   node scripts/extraer-catalogos.mjs [ruta-plantilla]

   Lee las hojas "Equipos" y "Cables y canalización" y genera:
     data/catalogos/*.json            (los lee la app; se publican)
     ../_privado/personas.json        (instaladores y proyectistas: NO se publican)
     docs/CRUCE-CATALOGOS.md          (cruce con js/equipos-emat.js)

   Cada registro lleva `fuente: "Hoja!Fila"` para poder volver a la celda.
   Los bloques se detectan por sus encabezados, no por fila fija, así que el
   script aguanta que se inserten filas ("Insertar Fila para agregar").
   Si la plantilla cambia de forma, el script falla con un mensaje claro en
   vez de generar datos a medias.
   ========================================================================== */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirLibro, numACol, colANum } from './leer-xlsx.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLANTILLA = resolve(process.argv[2] || resolve(RAIZ, '..', 'Campos Autocad -.xlsm'));
const SALIDA = resolve(RAIZ, 'data', 'catalogos');
const PRIVADO = resolve(RAIZ, '..', '_privado');

const libro = abrirLibro(PLANTILLA);
const EQ = libro.hoja('Equipos'), CB = libro.hoja('Cables y canalización');

/* ---------- utilidades ---------- */
const txt = v => v == null ? null : String(v).replace(/\s+/g, ' ').trim() || null;
const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return redondear(v); const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : redondear(n); };
const redondear = n => Math.round(n * 1e9) / 1e9;           // limpia 0.30000000000000004
const fila = (h, r, c0, c1) => { const o = {}; for (let c = colANum(c0); c <= colANum(c1); c++) o[numACol(c)] = h.valor(numACol(c) + r); return o; };
const esInsertar = (h, r) => /^Insertar Fila/i.test(String(h.valor('A' + r) || ''));
const fuente = (h, r) => `${h.nombre}!${r}`;
function falla(msg) { console.error('✗ ' + msg); process.exit(1); }
/* Filas donde la columna `col` tiene exactamente `texto` (primer encabezado de un bloque) */
const buscar = (h, col, prueba, desde = 1, hasta = h.maxFila()) => { const out = []; for (let r = desde; r <= hasta; r++) { const v = txt(h.valor(col + r)); if (v && prueba(v)) out.push(r); } return out; };
/* Recorre filas de datos desde r0 hasta la próxima "Insertar Fila…" o un encabezado nuevo */
function* datos(h, r0, { col = 'E', fin = r => esInsertar(h, r), max = 200 } = {}) {
  for (let r = r0; r < r0 + max && r <= h.maxFila(); r++) { if (fin(r)) return; if (txt(h.valor(col + r))) yield r; }
}
/* Rango con nombre (Equipos!$D$294:$D$297) → filas */
function rangoNombrado(nombre) {
  // Excel no distingue mayúsculas en los nombres ("Ohiggins" = "OHiggins")
  const n = libro.nombres.find(x => x.name.toLowerCase() === String(nombre).toLowerCase()); if (!n) return null;
  const m = /!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(n.ref); if (!m) return { roto: n.ref };
  return { col: m[1], desde: +m[2], hasta: +m[4] };
}

const avisos = [];   // problemas de la plantilla que conviene saber (van al informe)

/* ==========================================================================
   INVERSORES · bloques con F = "Imáx [A]" (Huawei, Fronius, Victron)
   La fila 1 de cada bloque numera las columnas: son los índices que usan los
   BUSCARV de "Información proyecto" (Equipos!$L$1 = 8, etc.).
   ========================================================================== */
const COLS_INV = {
  F: 'imax', G: 'imax125', H: 'idisCable', I: 'automatico', J: 'diferencial', K: 'seccionMinCable',
  L: 'idcMax', M: 'iscMax', N: 'pdcMaxKwp', O: 'pacNomKw', P: 'smaxKva', Q: 'iacNom', R: 'pKw',
  S: 'vmppMin', T: 'vmppMax', U: 'mppt', V: 'entradasPorMppt'
};
const inversores = [];
const bloquesInv = buscar(EQ, 'F', v => /^Imáx/.test(v));
if (bloquesInv.length < 2) falla('No encontré los bloques de inversores en Equipos (encabezado "Imáx [A]" en la columna F).');
for (const r0 of bloquesInv) {
  const marca = txt(EQ.valor('E' + r0));
  // Las filas de datos empiezan cuando E tiene modelo y F es número
  for (const r of datos(EQ, r0 + 1, { fin: r => esInsertar(EQ, r) || (r > r0 + 1 && bloquesInv.includes(r)) })) {
    const f = fila(EQ, r, 'C', 'AL'); if (typeof f.F !== 'number') continue;
    const o = { marca, modelo: txt(f.E), nombre: txt(f.C), ficha: txt(f.AL) };
    for (const [c, k] of Object.entries(COLS_INV)) o[k] = num(f[c]);
    // Fase: el Excel no la guarda. Se deduce de P / Iac: ~220 V → monofásico; ~660 (380·√3) → trifásico.
    o.fase = o.pKw && o.iacNom ? (o.pKw * 1000 / o.iacNom > 300 ? 'Trifásico' : 'Monofásico') : null;
    o.fuente = fuente(EQ, r);
    inversores.push(o);
  }
}
if (inversores.some(x => x.seccionMinCable == null)) avisos.push('Equipos!K (Sección mín. cable de inversores) se calcula desde un libro externo (`Libro1.xlsx` en un OneDrive personal) que no está en la plantilla: la columna viene vacía. No la usa ninguna fórmula de "Información proyecto".');

/* Tabla "Detalle de cadenas" (Equipos!W:AK): nombres de string por configuración MPPT/entradas.
   A100… de "Información proyecto" arma "MÓDULOS string A.1.1" con estas celdas. */
const configCadenas = [];
for (const r0 of bloquesInv) {
  const marca = txt(EQ.valor('E' + r0));
  const filaCab = buscar(EQ, 'W', v => /^\d+\/\d+$/.test(v), r0, r0 + 2)[0]; if (!filaCab) continue;
  for (let c = colANum('W'); c <= colANum('AK'); c += 3) {
    const cab = txt(EQ.valor(numACol(c) + filaCab)); if (!cab || !/^\d+\/\d+$/.test(cab)) continue;
    const [mppt, entradas] = cab.split('/').map(Number), slots = [];
    for (let r = filaCab + 1; r < filaCab + 1 + mppt * entradas; r++) {
      const ug = txt(EQ.valor(numACol(c) + r)), m = num(EQ.valor(numACol(c + 1) + r)), e = num(EQ.valor(numACol(c + 2) + r));
      if (ug && m && e) slots.push(`${ug}.${m}.${e}`);
    }
    configCadenas.push({ marca, config: cab, mppt, entradasPorMppt: entradas, strings: slots, fuente: `${EQ.nombre}!${numACol(c)}${filaCab}` });
  }
}
avisos.push('Equipos!W16:AI41 (nombres de string de la UG B y C) dependen de un libro externo (una copia de la plantilla en el escritorio de otra persona): en la plantilla esas letras quedan vacías. La app los genera igual que la UG A cambiando la letra.');

/* ==========================================================================
   MÓDULOS · bloques con F = "Pmáx [W]"
   ========================================================================== */
const modulos = [];
for (const r0 of buscar(EQ, 'F', v => /^Pmáx \[W\]/.test(v))) {
  const marca = txt(EQ.valor('E' + r0));
  for (const r of datos(EQ, r0 + 1)) {
    const f = fila(EQ, r, 'E', 'M'); if (typeof f.F !== 'number') continue;
    modulos.push({ marca, modelo: txt(f.E), pmax: num(f.F), vmp: num(f.G), imp: num(f.H), voc: num(f.I), isc: num(f.J), tecnologia: txt(f.K), clamp: txt(f.L), ficha: txt(f.M), fuente: fuente(EQ, r) });
  }
}
const marcasModulo = rangoNombrado('Paneles');
if (marcasModulo?.roto) avisos.push(`El rango con nombre "Paneles" está roto (${marcasModulo.roto}). La lista de marcas de paneles se toma de Equipos!B96:B101.`);
const listaMarcasModulo = []; for (let r = 96; r <= 101; r++) { const v = txt(EQ.valor('B' + r)); if (v) listaMarcasModulo.push(v); }

/* ==========================================================================
   BATERÍAS · bloque con B = "Baterías"
   ========================================================================== */
const baterias = [];
{
  const r0 = buscar(EQ, 'B', v => v === 'Baterías')[0]; if (!r0) falla('No encontré el bloque "Baterías" en Equipos.');
  const marca = txt(EQ.valor('E' + r0));
  // El bloque no siempre cierra con "Insertar Fila": termina cuando F (cantidad de módulos) deja de ser número.
  for (const r of datos(EQ, r0 + 1, { fin: r => esInsertar(EQ, r) || (txt(EQ.valor('E' + r)) && typeof EQ.valor('F' + r) !== 'number') })) {
    const f = fila(EQ, r, 'E', 'AH');
    baterias.push({
      marca, modelo: txt(f.E), modulos: num(f.F), moduloPotencia: txt(f.G), moduloBateria: txt(f.H), quimica: txt(f.I), energiaKwh: num(f.J), pmaxKw: num(f.K),
      ppeakTexto: txt(f.L), tensionOp1F: txt(f.M), tensionOp3F: txt(f.N), ppeakKw: num(f.O), ppeakSeg: num(f.P),
      tension1FMin: num(f.Q), tension1FMax: num(f.R), tension3FMin: num(f.S), tension3FMax: num(f.T), icargaMax1F: num(f.U), icargaMax3F: num(f.V), ficha: txt(f.AH), fuente: fuente(EQ, r)
    });
  }
  /* La serie S1 se arma con módulos LUNA2000-7-E1 y potencia LUNA2000-10KW-C1. En la plantilla, las filas de
     2 y 3 módulos dicen S2/E2/C2 y S3/E3/C3: es un arrastre de Excel (confirmado por Ops el 17-11-2026).
     Se corrigen aquí y se guarda lo que decía el Excel en `excelDecia`. */
  const corregidas = [];
  for (const b of baterias) {
    const antes = { modelo: b.modelo, moduloBateria: b.moduloBateria, moduloPotencia: b.moduloPotencia };
    if (!/LUNA2000-7-E\d$/.test(b.moduloBateria || '')) continue;
    b.modelo = b.modelo.replace(/-S[2-9]$/, '-S1'); b.moduloBateria = b.moduloBateria.replace(/-E[2-9]$/, '-E1'); b.moduloPotencia = (b.moduloPotencia || '').replace(/-C[2-9]$/, '-C1');
    if (b.modelo !== antes.modelo || b.moduloBateria !== antes.moduloBateria || b.moduloPotencia !== antes.moduloPotencia) { b.excelDecia = antes; corregidas.push(`${antes.modelo} → ${b.modelo} (${b.fuente})`); }
  }
  if (corregidas.length) avisos.push(`Baterías corregidas (arrastre de Excel en la serie S1, confirmado por Ops): ${corregidas.join('; ')}. **Hay que corregirlo también en la plantilla**, porque el Excel de un proyecto con 2 o 3 módulos escribiría "S2/S3" en el plano.`);
}

/* ==========================================================================
   CARGADORES (SAVE) · bloques con F = "Tipo" y E = "SAVE …"
   ========================================================================== */
const cargadores = [];
for (const r0 of buscar(EQ, 'E', v => /^SAVE[ _]/.test(v))) {
  if (txt(EQ.valor('F' + r0)) !== 'Tipo') continue;
  const marca = txt(EQ.valor('E' + r0)).replace(/^SAVE[ _]/, '');
  for (const r of datos(EQ, r0 + 1)) {
    const f = fila(EQ, r, 'E', 'L');
    cargadores.push({ marca, clave: `SAVE_${marca}`, modelo: txt(f.E), tipo: txt(f.F), tension: num(f.G), potenciaKw: num(f.H), imax: num(f.I), automatico: num(f.J), diferencial: num(f.K), tensionMax: num(f.L), fuente: fuente(EQ, r) });
  }
}
const marcasCargador = []; { const r0 = buscar(EQ, 'B', v => /^Cargadores/.test(v))[0]; if (r0) for (const r of datos(EQ, r0 + 1, { col: 'B' })) marcasCargador.push(txt(EQ.valor('B' + r))); }

/* ==========================================================================
   EMPALMES · monofásico (B = "Empalmes") y trifásico (E = "Trifásico" + F = "Interruptor")
   ========================================================================== */
const empalmes = { 'Monofásico': [], 'Trifásico': [] };
{
  const rM = buscar(EQ, 'B', v => v === 'Empalmes')[0], rT = buscar(EQ, 'E', v => v === 'Trifásico').find(r => /^Interruptor/.test(txt(EQ.valor('F' + r)) || ''));
  if (!rM || !rT) falla('No encontré las tablas de empalmes en Equipos.');
  for (let r = rM + 2; !esInsertar(EQ, r) && r < rM + 40; r++) { const f = fila(EQ, r, 'F', 'J'); if (typeof f.F !== 'number') continue; empalmes['Monofásico'].push({ interruptor: f.F, pnomKw: num(f.G), smaxKva: num(f.H), tipos: { 'Aéreo': txt(f.I), 'Subterráneo': txt(f.J) }, fuente: fuente(EQ, r) }); }
  const tiposT = ['I', 'J', 'K', 'L'].map(c => txt(EQ.valor(c + (rT + 1))));
  for (let r = rT + 2; !esInsertar(EQ, r) && r < rT + 40; r++) { const f = fila(EQ, r, 'F', 'L'); if (typeof f.F !== 'number') continue; const tipos = {}; ['I', 'J', 'K', 'L'].forEach((c, i) => { const v = txt(f[c]); tipos[tiposT[i]] = v === '-' ? null : v; }); empalmes['Trifásico'].push({ interruptor: f.F, pnomKw: num(f.G), smaxKva: num(f.H), tipos, fuente: fuente(EQ, r) }); }
}
const tramos = []; { const t = rangoNombrado('Tramos'); for (let r = t.desde; r <= t.hasta; r++) { const v = txt(EQ.valor(t.col + r)); if (v) tramos.push(v); } }

/* ==========================================================================
   CANALIZACIONES y CONDUCTORES
   ========================================================================== */
const canalizaciones = [];
{
  const r0 = buscar(EQ, 'E', v => v === 'Canalizaciones')[0]; let grupo = 'Exterior';
  for (let r = r0 + 1; !esInsertar(EQ, r) && r < r0 + 30; r++) {
    const f = fila(EQ, r, 'E', 'L'), n = txt(f.E); if (!n) continue;
    const acc = ['F', 'G', 'H', 'I', 'J', 'K', 'L'].map(c => txt(f[c])).filter(Boolean);
    if (!acc.length && n === 'Aérea') { grupo = n; continue; }        // "Aérea" es un separador de grupo
    canalizaciones.push({ nombre: n, grupo, accesorios: acc, fuente: fuente(EQ, r) });
  }
}
const conductores = [];
{
  const r0 = buscar(EQ, 'B', v => v === 'Conductores')[0]; let tipo = null;
  for (let r = r0 + 1; r < r0 + 20; r++) { const a = txt(EQ.valor('A' + r)), b = txt(EQ.valor('B' + r)); if (a === 'CC' || a === 'AC') tipo = a; if (esInsertar(EQ, r) && tipo === 'AC') break; if (b && tipo) conductores.push({ nombre: b, corriente: tipo === 'AC' ? 'CA' : 'CC', fuente: fuente(EQ, r) }); }
}

/* ==========================================================================
   PROTECCIONES · diferenciales (E = "Diferencial") y termomagnéticos (E = "Termomagnético")
   Las filas que empiezan con "_" son títulos de grupo (marca / serie / curva).
   ========================================================================== */
const diferenciales = [], termomagneticos = [];
{
  const rD = buscar(EQ, 'E', v => v === 'Diferencial')[0], rT = buscar(EQ, 'E', v => v === 'Termomagnético')[0];
  if (!rD || !rT) falla('No encontré las tablas de protecciones en Equipos.');
  let grupo = null;
  for (let r = rD + 1; r < rT; r++) { if (esInsertar(EQ, r)) break; const f = fila(EQ, r, 'E', 'M'), n = txt(f.E); if (!n) continue; if (n.startsWith('_')) { grupo = n.slice(1); continue; }
    diferenciales.push({ modelo: n, grupo, polos: num(f.F), in: num(f.G), codigoClase: txt(f.H), clase: txt(f.I), iccKa: num(f.J), sensibilidadMa: num(f.K), ficha: txt(f.L), marca: txt(f.M), fuente: fuente(EQ, r) }); }
  grupo = null;
  for (let r = rT + 1; r < rT + 80; r++) { if (esInsertar(EQ, r)) break; const f = fila(EQ, r, 'E', 'K'), n = txt(f.E); if (!n) continue; if (n.startsWith('_')) { grupo = n.slice(1); continue; }
    termomagneticos.push({ modelo: n, grupo, polos: num(f.F), in: num(f.G), curva: txt(f.H), poderCorteKa: num(f.I), ficha: txt(f.J), marca: txt(f.K), fuente: fuente(EQ, r) }); }
  const sinFicha = diferenciales.filter(d => !d.marca).map(d => d.fuente);
  if (sinFicha.length) avisos.push(`Diferenciales sin marca ni ficha (posibles filas de prueba): ${sinFicha.join(', ')}.`);
}
const listasProt = { marcas: [], curvas: [], corrientes: [] };
{ const r0 = buscar(EQ, 'B', v => v === 'Protecciones')[0]; for (let r = r0 + 1; r < r0 + 20; r++) { const b = txt(EQ.valor('B' + r)), d = EQ.valor('D' + r); if (b) listasProt.marcas.push(b); if (d != null) (typeof d === 'number' ? listasProt.corrientes : listasProt.curvas).push(typeof d === 'number' ? d : txt(d)); } }
const gruposProt = {};
for (const n of ['Dif_A_Monofásico', 'Dif_A_Trifásico', 'Termo_A_Monofásico', 'Termo_A_Trifásico']) {
  const def = libro.nombres.find(x => x.name === n); if (!def) continue;
  const filas = []; for (const parte of def.ref.split(',')) { const m = /!\$?[A-Z]+\$?(\d+)(?::\$?[A-Z]+\$?(\d+))?/.exec(parte); if (m) for (let r = +m[1]; r <= +(m[2] || m[1]); r++) filas.push(r); }
  gruposProt[n] = filas.map(r => txt(EQ.valor('E' + r))).filter(v => v && !v.startsWith('_'));
}

/* ==========================================================================
   LISTAS (bloque "Región | Nombre Región | …", fila ~292)
   Varias listas comparten columna (G = año y orientaciones; H = puesta a
   tierra e inclinaciones), así que se leen por tramos continuos.
   ========================================================================== */
const rL = buscar(EQ, 'A', v => v === 'Región')[0]; if (!rL) falla('No encontré el bloque de listas (A = "Región") en Equipos.');
const tramosCol = (col, desde = rL + 1, hasta = EQ.maxFila()) => { const out = []; let cur = null; for (let r = desde; r <= hasta + 1; r++) { const v = r <= hasta ? EQ.valor(col + r) : null; const ok = v != null && v !== ''; if (ok) { if (!cur) cur = { desde: r, valores: [] }; cur.valores.push(typeof v === 'number' ? redondear(v) : txt(v)); } else if (cur) { out.push(cur); cur = null; } } return out; };
const primerTramo = col => (tramosCol(col)[0] || { valores: [] }).valores;
const hastaLista = Math.min(...buscar(EQ, 'B', v => /^Cargadores/.test(v))) - 1;

// Regiones y comunas: cada región tiene un rango con nombre (Arica = Equipos!$D$294:$D$297)
const regiones = [];
for (const clave of tramosCol('A', rL + 1, hastaLista)[0].valores) {
  const rg = rangoNombrado(clave);
  if (!rg || rg.roto) { avisos.push(`La región "${clave}" (lista Equipos!A) no tiene rango de comunas con nombre: la lista desplegable de comunas no funciona para ella en el Excel.`); regiones.push({ clave, nombre: null, comunas: [], fuente: null }); continue; }
  const comunas = []; for (let r = rg.desde; r <= rg.hasta; r++) { const v = txt(EQ.valor(rg.col + r)); if (v) comunas.push(v); }
  regiones.push({ clave, nombre: txt(EQ.valor('B' + rg.desde)), comunas, fuente: `${EQ.nombre}!${rg.col}${rg.desde}:${rg.col}${rg.hasta}` });
}
// Comunas de la columna D que no caen en ningún rango con nombre
{
  const enRango = new Set(regiones.flatMap(x => x.comunas));
  const huerfanas = []; for (let r = rL + 1; r <= hastaLista; r++) { const d = txt(EQ.valor('D' + r)); if (d && !enRango.has(d)) huerfanas.push(`${d} (${txt(EQ.valor('B' + r))})`); }
  const nuble = regiones.find(x => /uble/.test(x.clave));
  if (nuble && !nuble.comunas.length) { const c = []; for (let r = rL + 1; r <= hastaLista; r++) if (/Ñuble/.test(txt(EQ.valor('B' + r)) || '')) c.push(txt(EQ.valor('D' + r))); if (c.length) { nuble.comunas = c; nuble.nombre = 'Ñuble'; nuble.nota = 'Comunas tomadas de la columna D (filas con región "Ñuble"); en el Excel no hay rango con nombre.'; } }
  if (huerfanas.length) avisos.push(`Comunas fuera de los rangos con nombre de su región: ${huerfanas.slice(0, 12).join(', ')}${huerfanas.length > 12 ? ` y ${huerfanas.length - 12} más` : ''}.`);
}

const distribuidoras = [];
for (let r = rL + 1; r <= hastaLista; r++) { const n = txt(EQ.valor('N' + r)); if (n) distribuidoras.push({ nombre: n, telefono: txt(EQ.valor('O' + r)), web: txt(EQ.valor('P' + r)), fuente: fuente(EQ, r) }); }

const tramosG = tramosCol('G', rL + 1, hastaLista), tramosH = tramosCol('H', rL + 1, hastaLista);
const listas = {
  meses: primerTramo('F'),
  anio: tramosG[0]?.valores || [],
  orientaciones: tramosG[1]?.valores || [],
  inclinaciones: tramosH[1]?.valores || [],
  puestaTierra: { tipo: tramosH[0]?.valores || [], tipoConductor: primerTramo('I'), calibreConductor: primerTramo('J'), tipoCanalizacion: primerTramo('K'), diametroCanalizacion: primerTramo('L') },
  zonaUtm: primerTramo('M'),
  materialTablero: primerTramo('Q'),
  dimensionesTablero: primerTramo('R'),
  gradoIp: primerTramo('S'),
  porcentajes: tramosCol('T', rL + 1, hastaLista)[0]?.valores || [],
  tramoSubterraneo: primerTramo('U'),
  tarifas: tramosCol('V', rL + 1, hastaLista)[0]?.valores || [],
  simuladores: tramosCol('W', rL + 1, hastaLista)[0]?.valores || [],
  proteccionesA: primerTramo('X'),
  tramos,
  tiposEmpalme: ['Monofásico', 'Trifásico'],
  marcasInversor: [...new Set(inversores.map(x => x.marca))],
  marcasModulo: listaMarcasModulo,
  marcasCargador,
  fuente: `${EQ.nombre}!A${rL}:X${hastaLista}`
};
const proyectistas = primerTramo('E');

/* ==========================================================================
   CABLES Y CANALIZACIÓN
   ========================================================================== */
/* Tabla de ductos por sección y cantidad de cables + capacidad de transporte por método */
function tablaCables(r0, { exterior = ['D', 'O'], subterraneo = null, capacidad, extras = {} }) {
  const metodos = []; for (let c = colANum(capacidad[0]); c <= colANum(capacidad[1]); c++) metodos.push(txt(CB.valor(numACol(c) + (r0 - 1))));
  const out = [];
  for (let r = r0; !esInsertar(CB, r) && r < r0 + 30; r++) {
    const s = CB.valor('C' + r); if (s == null || s === '') continue;
    const fila_ = { seccion: typeof s === 'number' ? redondear(s) : txt(s), ductoExterior: {}, ductoSubterraneo: subterraneo ? {} : undefined, capacidad: {}, fuente: fuente(CB, r) };
    for (let c = colANum(exterior[0]), i = 1; c <= colANum(exterior[1]); c++, i++) fila_.ductoExterior[i] = num(CB.valor(numACol(c) + r));
    if (subterraneo) for (let c = colANum(subterraneo[0]), i = 1; c <= colANum(subterraneo[1]); c++, i++) fila_.ductoSubterraneo[i] = num(CB.valor(numACol(c) + r));
    metodos.forEach((m, i) => { const v = CB.valor(numACol(colANum(capacidad[0]) + i) + r); fila_.capacidad[m] = v === '-' ? null : num(v); });
    for (const [k, c] of Object.entries(extras)) { const v = CB.valor(c + r); fila_[k] = typeof v === 'number' ? redondear(v) : txt(v); }
    out.push(fila_);
  }
  return out;
}
const rEva = buscar(CB, 'B', v => v === 'Evaflex')[0], rRv = buscar(CB, 'B', v => /^RV-K y PV1/.test(v));
if (!rEva || rRv.length < 2) falla('No encontré las tablas Evaflex / RV-K en "Cables y canalización".');
const cables = {
  evaflexMm2: tablaCables(rEva + 2, { capacidad: ['P', 'R'] }),
  rvkMm2: tablaCables(rRv[0] + 3, { subterraneo: ['P', 'AA'], capacidad: ['AB', 'AI'], extras: { diametroCable: 'AJ', areaCable: 'AK', equivalenteAwg: 'AL', bandejaExterior: 'AM', bandejaSubterranea: 'AN' } }),
  rvkAwg: tablaCables(rRv[1] + 3, { subterraneo: ['P', 'AA'], capacidad: ['AB', 'AI'], extras: { diametroCable: 'AJ', areaCable: 'AK', equivalenteMm2: 'AL', bandejaExterior: 'AM', bandejaSubterranea: 'AN' } }),
  fuente: `${CB.nombre}`
};
// Factor por cantidad de conductores en el ducto (el encabezado del Excel dice "temperatura", pero los valores son de agrupamiento)
const factorCantidad = [];
{ const r0 = buscar(CB, 'B', v => /^Cantidad de conductores/.test(v))[0]; for (let r = r0 + 1; r < r0 + 10; r++) { const d = num(CB.valor('B' + r)), h = num(CB.valor('C' + r)), f = num(CB.valor('D' + r)); if (d == null) break; factorCantidad.push({ desde: d, hasta: h, factor: f, fuente: fuente(CB, r) }); } }
const factorTemperatura = { columnas: {}, filas: [] };
{
  const r0 = buscar(CB, 'B', v => /^Temperatura ambiente/.test(v))[0];
  for (const c of ['D', 'E', 'F']) factorTemperatura.columnas[c] = { servicio: txt(CB.valor(c + r0)), metodos: txt(CB.valor(c + (r0 + 1))) };
  factorTemperatura.columnas.D.servicio ??= '70°C (Evaflex)'; factorTemperatura.columnas.F.servicio ??= factorTemperatura.columnas.E.servicio;
  for (let r = r0 + 2; r < r0 + 20; r++) { const h = num(CB.valor('C' + r)); if (h == null) break; factorTemperatura.filas.push({ desde: num(CB.valor('B' + r)), hasta: h, D: num(CB.valor('D' + r)), E: num(CB.valor('E' + r)), F: num(CB.valor('F' + r)), fuente: fuente(CB, r) }); }
}
const ocupacionDucto = []; { const r0 = buscar(CB, 'C', v => /^N° conductores/.test(v))[0]; for (const c of ['D', 'E', 'F']) ocupacionDucto.push({ conductores: num(CB.valor(c + r0)), porcentaje: num(CB.valor(c + (r0 + 1))) }); }
const calibres = [];
{ const r0 = buscar(CB, 'B', v => v === 'Calibre')[0]; let sist = null;
  for (let r = r0 + 1; r < r0 + 40; r++) { const a = txt(CB.valor('A' + r)); if (a) sist = a === 'mm2' ? 'mm²' : a; const b = CB.valor('B' + r); if (b == null || b === '') break;
    calibres.push({ sistema: sist, calibre: typeof b === 'number' ? b : txt(b), diametroCable: num(CB.valor('D' + r)), prensaestopa: txt(CB.valor('E' + r)), diametroPrensaestopa: num(CB.valor('F' + r)), fuente: fuente(CB, r) }); } }
const seccionesDucto = []; { const r0 = buscar(CB, 'B', v => v === 'Calibre')[0]; for (let r = r0 + 1; r < r0 + 40; r++) { const c = CB.valor('C' + r); if (c == null || c === '') break; seccionesDucto.push(typeof c === 'number' ? c : txt(c)); } }
const prensaestopas = []; { const r0 = buscar(CB, 'I', v => /^PG\/ST/.test(v))[0]; for (let r = r0 + 1; r < r0 + 20; r++) { const p = txt(CB.valor('I' + r)); if (!p) continue; prensaestopas.push({ tipo: p, diametro: num(CB.valor('L' + r)) }); } }
const utm = { datum: txt(CB.valor('B' + buscar(CB, 'A', v => /^DATUM/.test(v))[0])), a: num(CB.valor('B' + buscar(CB, 'A', v => /^a \(semi/.test(v))[0])), b: num(CB.valor('B' + buscar(CB, 'A', v => /^b \(semi/.test(v))[0])), hemisferio: txt(CB.valor('B' + buscar(CB, 'A', v => /^Hemisphere/.test(v))[0])), fuente: `${CB.nombre}!A107:W123` };

/* ==========================================================================
   Datos a verificar (decisión de Ops, 17-11-2026): cuando el Excel y EMAT no
   coinciden en la corriente de salida de un inversor, manda el Excel, pero el
   valor queda marcado con `verificar` para que la Ficha lo muestre con asterisco (*).
   Ojo: EMAT `iac` es la corriente MÁXIMA de ficha → se compara con Equipos!F
   ("Imáx"), no con Equipos!Q ("Iac-nom", la nominal).
   ========================================================================== */
const { PANELES_EMAT, INVERSORES_EMAT, OTROS_EMAT } = await import(pathToFileURL(resolve(RAIZ, 'js', 'equipos-emat.js')).href);
const norm = s => String(s || '').toUpperCase().replace(/[\s_]+/g, '').replace(/KTL/g, 'K');
const igual = (a, b, tol = 0.011) => a == null || b == null ? null : Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
for (const x of inversores) {
  const e = INVERSORES_EMAT.find(e => norm(e.modelo) === norm(x.modelo));
  if (e && igual(x.imax, e.iac) === false) {
    x.verificar = { imax: `Valor del Excel. EMAT (ficha) indica ${e.iac} A. Confirmar cuál corresponde.` };
  }
}

/* ==========================================================================
   Escribir
   ========================================================================== */
const meta = { generado: new Date().toISOString().slice(0, 10), plantilla: 'Campos Autocad -.xlsm', script: 'scripts/extraer-catalogos.mjs' };
const archivos = {
  'inversores.json': { ...meta, columnasExcel: Object.fromEntries(Object.entries(COLS_INV).map(([c, k]) => [k, { col: c, indice: num(EQ.valor(c + '1')) }])), inversores, configCadenas },
  'modulos.json': { ...meta, modulos },
  'baterias.json': { ...meta, baterias },
  'cargadores.json': { ...meta, cargadores },
  'empalmes.json': { ...meta, empalmes },
  'canalizaciones.json': { ...meta, canalizaciones, seccionesDucto, prensaestopas },
  'conductores.json': { ...meta, conductores, calibres, cables, factorCantidad, factorTemperatura, ocupacionDucto },
  'protecciones.json': { ...meta, diferenciales, termomagneticos, listas: listasProt, grupos: gruposProt },
  'distribuidoras.json': { ...meta, distribuidoras },
  'regiones.json': { ...meta, regiones, utm },
  'listas.json': { ...meta, ...listas }
};
/* Candado de privacidad: nada que parezca RUT, correo o teléfono chileno puede ir a data/ (se publica).
   Los teléfonos 800 de las distribuidoras son públicos y se permiten. */
const PRIVADOS = [/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/, /[\w.+-]+@[\w-]+\.[\w.]+/, /\+?56\s*9[\s\d]{7,}/];
for (const [n, d] of Object.entries(archivos)) {
  const s = JSON.stringify(d), m = PRIVADOS.map(rx => rx.exec(s)).find(Boolean);
  if (m) falla(`${n} contiene algo que parece un dato personal ("${m[0].slice(0, 6)}…"). No se escribió nada. Revisa qué bloque del Excel se está leyendo de más.`);
}
mkdirSync(SALIDA, { recursive: true });
for (const [n, d] of Object.entries(archivos)) writeFileSync(resolve(SALIDA, n), JSON.stringify(d, null, 1) + '\n');

/* Datos personales: fuera del repo */
const rI = buscar(EQ, 'E', v => v === 'Instaladores')[0];
const instaladores = []; for (const r of datos(EQ, rI + 1)) { const f = fila(EQ, r, 'E', 'K'); instaladores.push({ nombre: txt(f.E), rut: txt(f.F), direccion: txt(f.G), licencia: txt(f.H), telefono: txt(f.I), correo: txt(f.J), empresa: txt(f.K), fuente: fuente(EQ, r) }); }
mkdirSync(PRIVADO, { recursive: true });
writeFileSync(resolve(PRIVADO, 'personas.json'), JSON.stringify({ ...meta, aviso: 'Datos personales. No subir al repositorio ni publicar.', instaladores, proyectistas }, null, 1) + '\n');

/* ==========================================================================
   Cruce con js/equipos-emat.js → docs/CRUCE-CATALOGOS.md
   ========================================================================== */
const md = [];
const tablaMd = (cab, filas) => filas.length ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...filas.map(f => `| ${f.map(x => x ?? '—').join(' | ')} |`)].join('\n') : '_(ninguno)_';

// Inversores
const invPares = [], invSoloExcel = [], usadosEmat = new Set();
for (const x of inversores) {
  const e = INVERSORES_EMAT.find(e => norm(e.modelo) === norm(x.modelo));
  if (!e) { invSoloExcel.push(x); continue; }
  usadosEmat.add(e.sku);
  const comp = [['kW', x.pacNomKw, e.kw], ['MPPT', x.mppt, e.mppt], ['Entradas/MPPT', x.entradasPorMppt, e.cadenasPorMppt], ['Vmpp mín', x.vmppMin, e.vmin], ['Vmpp máx', x.vmppMax, e.vmax], ['Isc/MPPT', x.iscMax, e.iscMppt], ['Imáx CA', x.imax, e.iac], ['Fase', x.fase, e.fase]];
  const dif = comp.filter(([, a, b]) => typeof a === 'string' ? a !== b : igual(a, b) === false).map(([k, a, b]) => `${k}: Excel ${a}${k === 'Imáx CA' && x.verificar ? ' **\\***' : ''} / EMAT ${b}`);
  invPares.push([x.modelo, e.sku, x.fuente, dif.length ? dif.join('; ') : 'coincide']);
}
const invSoloEmat = INVERSORES_EMAT.filter(e => !usadosEmat.has(e.sku));
// Módulos: por marca + Wp
const marcaN = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').replace('SOLAR', '');
const modPares = [], modSoloExcel = [], modUsados = new Set();
for (const x of modulos) {
  const e = PANELES_EMAT.find(e => marcaN(e.marca) === marcaN(x.marca) && e.wp === x.pmax);
  if (!e) { modSoloExcel.push(x); continue; }
  modUsados.add(e.sku);
  const comp = [['Voc', x.voc, e.voc], ['Isc', x.isc, e.isc], ['Vmp', x.vmp, e.vmp], ['Imp', x.imp, e.imp]];
  const dif = comp.filter(([, a, b]) => igual(a, b) === false).map(([k, a, b]) => `${k}: Excel ${a} / EMAT ${b}`);
  modPares.push([`${x.marca} ${x.modelo}`, `${e.sku} (${e.modelo})`, x.fuente, dif.length ? dif.join('; ') : 'coincide']);
}
const modSoloEmat = PANELES_EMAT.filter(e => !modUsados.has(e.sku));
// Baterías y cargadores contra OTROS_EMAT
const otro = (k, prueba) => OTROS_EMAT.filter(e => e.k === k && prueba(e));
const batFilas = baterias.map(x => { const mb = otro('bat', e => norm(e.modelo).startsWith(norm(x.moduloBateria))), mp = otro('dcdc', e => norm(e.modelo).startsWith(norm(x.moduloPotencia))); return [x.modelo, x.moduloBateria, mb[0]?.sku || 'no está', x.moduloPotencia, mp[0]?.sku || 'no está']; });
const carFilas = cargadores.map(x => { const e = otro('ev', e => norm(e.modelo).startsWith(norm(x.modelo))); return [x.clave, x.modelo, `${x.potenciaKw} kW · ${x.tension} V`, e[0]?.sku || 'no está en EMAT']; });
const carSoloEmat = OTROS_EMAT.filter(e => e.k === 'ev' && !cargadores.some(x => norm(e.modelo).startsWith(norm(x.modelo))));

md.push(`# Cruce de catálogos · plantilla "Campos Autocad" vs. base EMAT`,
  ``, `Generado por \`scripts/extraer-catalogos.mjs\` el ${meta.generado}. No editar a mano: se vuelve a generar con el script.`,
  ``, `- **Excel**: hojas *Equipos* y *Cables y canalización* de \`Campos Autocad -.xlsm\` → \`data/catalogos/*.json\`.`,
  `- **EMAT**: \`js/equipos-emat.js\` (SKU, medidas y datos de ficha que usa el dibujo).`,
  `- El cruce de inversores es por modelo (ignorando "TL" en el nombre, porque EMAT y Excel lo escriben distinto). El de paneles es por marca + Wp, porque el Excel usa nombres comerciales cortos.`,
  ``, `## Resumen`, ``,
  tablaMd(['Catálogo', 'En el Excel', 'En EMAT', 'En ambos', 'Solo Excel', 'Solo EMAT'], [
    ['Inversores', inversores.length, INVERSORES_EMAT.length, invPares.length, invSoloExcel.length, invSoloEmat.length],
    ['Paneles', modulos.length, PANELES_EMAT.length, modPares.length, modSoloExcel.length, modSoloEmat.length],
    ['Baterías (configuraciones)', baterias.length, OTROS_EMAT.filter(e => e.k === 'bat').length + ' módulos', '—', '—', '—'],
    ['Cargadores', cargadores.length, OTROS_EMAT.filter(e => e.k === 'ev').length, carFilas.filter(f => f[3] !== 'no está en EMAT').length, carFilas.filter(f => f[3] === 'no está en EMAT').length, carSoloEmat.length],
    ['Diferenciales', diferenciales.length, '—', '', '', ''], ['Termomagnéticos', termomagneticos.length, '—', '', '', ''],
    ['Distribuidoras', distribuidoras.length, '—', '', '', ''], ['Regiones / comunas', `${regiones.length} / ${regiones.reduce((t, r) => t + r.comunas.length, 0)}`, '—', '', '', '']
  ]),
  ``, `## Inversores en ambos`, ``, `Diferencias con tolerancia de 1 %. "Fase" en el Excel se deduce de P / Iac (el Excel no la guarda).`,
  'La corriente de salida se compara con **Imáx** (Equipos!F), que es lo que EMAT guarda como `iac` (máxima de ficha). La columna "Iac-nom" (Equipos!Q) es la nominal y en los trifásicos grandes es menor; no es una diferencia.',
  '**Decisión (17-11-2026):** si un dato del Excel no coincide con EMAT, se usa el del Excel marcado con **\\*** para verificarlo (`verificar` en el JSON; la Ficha muestra el asterisco).', ``,
  tablaMd(['Modelo (Excel)', 'SKU EMAT', 'Fila Excel', 'Diferencias'], invPares),
  ``, `## Inversores solo en el Excel`, ``, `Se usan desde el catálogo del Excel. Si se van a dibujar, hay que agregarlos a EMAT con medidas de ficha.`, ``,
  tablaMd(['Marca', 'Modelo', 'kW', 'Fase', 'Fila'], invSoloExcel.map(x => [x.marca, x.modelo, x.pacNomKw, x.fase, x.fuente])),
  ``, `## Inversores solo en EMAT`, ``, tablaMd(['SKU', 'Modelo', 'kW'], invSoloEmat.map(e => [e.sku, e.modelo, e.kw])),
  ``, `## Paneles en ambos`, ``, tablaMd(['Panel (Excel)', 'EMAT', 'Fila Excel', 'Diferencias'], modPares),
  ``, `## Paneles solo en el Excel`, ``, tablaMd(['Marca', 'Modelo', 'Wp', 'Fila'], modSoloExcel.map(x => [x.marca, x.modelo, x.pmax, x.fuente])),
  ``, `## Paneles solo en EMAT`, ``, `Paneles que se venden hoy pero que el Excel no tiene: la Ficha los tomará de EMAT.`, ``, tablaMd(['SKU', 'Modelo', 'Wp'], modSoloEmat.map(e => [e.sku, e.modelo, e.wp])),
  ``, `## Baterías`, ``, `El Excel describe configuraciones (n módulos + módulo de potencia). EMAT tiene los módulos sueltos con su SKU.`, ``,
  tablaMd(['Configuración (Excel)', 'Módulo batería', 'SKU EMAT', 'Módulo potencia', 'SKU EMAT'], batFilas),
  ``, `## Cargadores`, ``, tablaMd(['Marca (Excel)', 'Modelo', 'Datos', 'SKU EMAT'], carFilas),
  carSoloEmat.length ? `\nSolo en EMAT: ${carSoloEmat.map(e => e.modelo).join(', ')}.` : '',
  ``, `## Problemas encontrados en la plantilla`, ``, ...avisos.map(a => `- ${a}`),
  ``, `## Datos personales`, ``, `Los instaladores (${instaladores.length}, con RUT, dirección, licencia, correo y teléfono) y la lista de proyectistas (${proyectistas.length} nombres) se extraen a \`../_privado/personas.json\`, fuera del repositorio, como indica \`docs/DECISIONES-PASO0.md\`.`, ``);
writeFileSync(resolve(RAIZ, 'docs', 'CRUCE-CATALOGOS.md'), md.join('\n'));

/* ---------- resumen en la terminal ---------- */
console.log(`Plantilla: ${relative(process.cwd(), PLANTILLA)}`);
console.log(`Inversores ${inversores.length} · configuraciones de strings ${configCadenas.length} · módulos ${modulos.length} · baterías ${baterias.length} · cargadores ${cargadores.length}`);
console.log(`Empalmes mono ${empalmes['Monofásico'].length} / tri ${empalmes['Trifásico'].length} · canalizaciones ${canalizaciones.length} · conductores ${conductores.length} · calibres ${calibres.length}`);
console.log(`Diferenciales ${diferenciales.length} · termomagnéticos ${termomagneticos.length} · distribuidoras ${distribuidoras.length} · regiones ${regiones.length} (${regiones.reduce((t, r) => t + r.comunas.length, 0)} comunas)`);
console.log(`Privado: ${instaladores.length} instaladores, ${proyectistas.length} proyectistas → ${relative(process.cwd(), resolve(PRIVADO, 'personas.json'))}`);
console.log(`Cruce: inversores ${invPares.length} en ambos, ${invSoloExcel.length} solo Excel, ${invSoloEmat.length} solo EMAT · paneles ${modPares.length} / ${modSoloExcel.length} / ${modSoloEmat.length}`);
console.log(`Avisos de la plantilla: ${avisos.length}`);
