/* ==========================================================================
   Lámina A1 (841 × 594 mm) como en los planos de Ops:
   01 · Planta de techumbre + diagrama unilineal + simbología + notas + cajetín
   02 · Cuadros de carga (string CC, inversor CA, caída de tensión)
   Se dibuja en SVG (unidades = mm). "Imprimir / PDF" abre las dos láminas en
   tamaño A1 y "DXF" exporta la geometría en mm para abrirla en AutoCAD.
   ========================================================================== */
import { esc, fmt, ic, toast, descargar, dist, centroid, hull } from './util.js';
import { CANAL, EQUIPOS, PANELES } from './catalogo.js';
import { escala, panelDe, inversorDe, calcCA, zonaPoly, CAIDA_MAX, medidaEquipo } from './geom.js';
import { dibujar, cargarImg, colorString, vistaNitida, rectDe, esCerrada, textoCota } from './render.js';
import { hoy } from './store.js';
import { dibujoLibre, VB_UNI, vbLibre } from './uni-dibujo.js';

const W = 841, H = 594, M = 10;                // hoja y margen
const FONT = "'Archivo Narrow','Arial Narrow',Arial,sans-serif";
let cur = { p: null, R: null, SI: null, cambio: null, rerender: null, hoja: 1, zoom: 1 };

/* ---------- Helpers SVG ---------- */
const T = (x, y, s, size = 2.2, o = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-family="${o.ff || FONT}" ${o.it !== false ? 'font-style="italic"' : ''} ${o.b ? 'font-weight="700"' : ''} text-anchor="${o.a || 'start'}" ${o.fill ? `fill="${o.fill}"` : ''} ${o.base ? `dominant-baseline="${o.base}"` : ''} ${o.attr || ''}>${esc(s)}</text>`;
const Rc = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill || 'none'}" stroke="${o.st || '#111'}" stroke-width="${o.sw || .25}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`;
const Ln = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.st || '#111'}" stroke-width="${o.sw || .25}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`;
/* Tabla: cols = [{h:'Título', w}], filas = [[...]]; cab = alto cabecera */
function tabla(x, y, titulo, cols, filas, { cab = 7, fila = 5, fs = 1.7, tit = 3.2 } = {}) {
  const ancho = cols.reduce((t, c) => t + c.w, 0); let s = '', yy = y;
  if (titulo) { s += Rc(x, yy, ancho, tit + 3) + T(x + ancho / 2, yy + tit + .6, titulo, tit, { a: 'middle', it: false }); yy += tit + 3; }
  let xx = x; cols.forEach(c => { s += Rc(xx, yy, c.w, cab); String(c.h).split('\n').forEach((l, i, arr) => { s += T(xx + c.w / 2, yy + cab / 2 + (i - (arr.length - 1) / 2) * fs * 1.15 + fs * .35, l, fs, { a: 'middle', it: false }); }); xx += c.w; });
  yy += cab;
  filas.forEach(f => { xx = x; cols.forEach((c, i) => { s += Rc(xx, yy, c.w, fila); const v = f[i] ?? ''; String(v).split('\n').forEach((l, j, arr) => { s += T(xx + c.w / 2, yy + fila / 2 + (j - (arr.length - 1) / 2) * fs * 1.15 + fs * .35, l, fs, { a: 'middle', it: false }); }); xx += c.w; }); yy += fila; });
  return { svg: s, h: yy - y, w: ancho };
}

/* ---------- Datos que muestra la lámina ---------- */
function datos(p, R, SI) {
  const inv = inversorDe(p), P = panelDe(p, p.roofs.find(r => r.closed)), L = p.lamina, ca = calcCA(p);
  const kwp = SI.pw ? SI.pw / 1000 : R.kwp, kwn = inv.kw * (p.cantInv || 1);
  return { inv, P, L, ca, kwp, kwn, nMod: SI.pw ? SI.lista.reduce((t, x) => t + x.n, 0) : R.n, nStr: SI.lista.filter(x => x.n).length };
}

const disyDef = D => `${D.inv.fase === 'Trifásico' ? '4' : '2'}x${D.ca.prot} A Curva C`;
const difDef = D => D.inv.dif || `${D.inv.fase === 'Trifásico' ? '4' : '2'}x63 A 300 mA Tipo A`;

/* ---------- Cajetín y franja inferior (igual en las dos láminas) ---------- */
function franja(p, D, o) {
  if (typeof o === 'string') o = { n: o, total: '02', lista: [['01 DE 02', 'PLANTA DE TECHUMBRE Y DIAGRAMA UNILINEAL'], ['02 DE 02', 'CUADROS DE CARGA']], escala: o === '01' ? (D.L.escala || 'S/E') : 'NO A ESCALA' };
  const y0 = 476, h = H - M - y0, L = D.L; let s = '';
  // Revisiones + logo + firmas
  const revs = (L.revs || []).slice(-3);
  const cRev = [{ h: 'VERSIÓN', w: 14 }, { h: 'FECHA', w: 22 }, { h: 'DESCRIPCIÓN', w: 64 }];
  let ry = y0; const filas = [...Array(3 - revs.length).fill(['', '', '']), ...revs.map(r => [r.v, r.fecha, r.desc])].reverse();
  filas.reverse().forEach((f, i) => { let x = M + 2; cRev.forEach((c, j) => { s += Rc(x, ry, c.w, 5) + T(x + c.w / 2, ry + 3.5, f[j], 1.9, { a: 'middle' }); x += c.w; }); ry += 5; });
  let x = M + 2; cRev.forEach(c => { s += Rc(x, ry, c.w, 5) + T(x + c.w / 2, ry + 3.5, c.h, 1.9, { a: 'middle' }); x += c.w; }); ry += 5;
  s += Rc(M + 2, ry, 100, 22) + `<image href="assets/nikola-logo-oscuro.svg" x="${M + 22}" y="${ry + 3}" width="60" height="15"/>`; ry += 22;
  s += Rc(M + 2, ry, 50, 25) + Rc(M + 52, ry, 50, 25) + T(M + 4, ry + 3.4, 'JEFE DE PROYECTO', 1.8) + T(M + 54, ry + 3.4, 'INGENIERO EN TERRENO', 1.8);
  s += Ln(M + 8, ry + 17, M + 46, ry + 17) + T(M + 27, ry + 20.5, L.jefe || '', 1.9, { a: 'middle' }) + Ln(M + 58, ry + 17, M + 96, ry + 17) + T(M + 77, ry + 20.5, L.ingeniero || '', 1.9, { a: 'middle' });
  // Parámetros panel
  const P = D.P, pp = [['Pmáx.', `${P.wp} [Wp]`], ['Imp', `${P.imp} [A]`], ['Vmp', `${P.vmp} [V]`], ['Isc', `${P.isc} [A]`], ['Voc', `${P.voc} [V]`], ['MARCA', P.marca], ['MODELO', P.modelo]];
  const xp = M + 108; s += Rc(xp, y0, 72, 8) + T(xp + 36, y0 + 5.3, 'PARÁMETROS PANEL FOTOVOLTAICO', 2.3, { a: 'middle' });
  pp.forEach(([a, b], i) => { const yy = y0 + 8 + i * 7; s += Rc(xp, yy, 20, 7) + Rc(xp + 20, yy, 52, 7) + T(xp + 2, yy + 4.6, a, 2) + T(xp + 22, yy + 4.6, b, 2); });
  // Parámetros inversor
  const I = D.inv, pi = [['RANGO DE TENSIÓN MPP', `${I.vmin} – ${I.vmax} [V]`], ['CORRIENTE MÁXIMA\nENTRADA POR MPP', I.imax ? `${I.imax} [A]` : '—'], ['CORRIENTE\nCORTOCIRCUITO', `${I.isc} [A]`], ['POTENCIA NOMINAL', `${I.kw} [kW]`], ['MARCA', I.marca.toUpperCase()], ['MODELO', I.modelo]];
  const xi = xp + 78; s += Rc(xi, y0, 82, 8) + T(xi + 41, y0 + 5.3, 'PARÁMETROS INVERSOR', 2.3, { a: 'middle' });
  pi.forEach(([a, b], i) => { const yy = y0 + 8 + i * 8.17; s += Rc(xi, yy, 38, 8.17) + Rc(xi + 38, yy, 44, 8.17); a.split('\n').forEach((l, j, arr) => { s += T(xi + 2, yy + 4.6 + (j - (arr.length - 1) / 2) * 2.3, l, 1.8); }); s += T(xi + 40, yy + 4.9, b, 2); });
  // Parámetros de los interruptores (lámina del unilineal)
  if (o.int) {
    const disy = L.disyuntor || disyDef(D), dif = L.diferencial || difDef(D), num = (re, t, u) => { const m = re.exec(t); return m ? `${m[1]} [${u}]` : '—'; };
    const xq = xi + 92, wq = 62, bloque = (y, t1, t2, filas) => { s += Rc(xq, y, wq, 8) + T(xq + wq / 2, y + 3.4, t1, 1.9, { a: 'middle' }) + T(xq + wq / 2, y + 6.8, t2, 1.9, { a: 'middle' });
      filas.forEach(([a, b], i) => { const yy = y + 8 + i * 6; s += Rc(xq, yy, 20, 6) + Rc(xq + 20, yy, wq - 20, 6) + T(xq + 1.5, yy + 4, a, 1.8) + T(xq + 21.5, yy + 4, b, 1.6); }); };
    bloque(y0, 'PARÁMETROS INT.', 'TERMOMAGNÉTICO', [['Marca', L.marcaDisy || '—'], ['Modelo', disy], ['Capacidad', num(/(\d+)\s*A\b/i, disy, 'A')]]);
    bloque(y0 + 30, 'PARÁMETROS INT.', 'DIFERENCIAL', [['Marca', L.marcaDif || '—'], ['I máx. fuga', num(/(\d+)\s*mA/i, dif, 'mA')], ['Capacidad', num(/(\d+)\s*A\b/i, dif, 'A')]]);
  }
  // Cuadro resumen de láminas
  const xl = xi + 92 + (o.int ? 68 : 0), yl = y0 + 30; s += Rc(xl, yl, 120, 8) + T(xl + 60, yl + 5.3, 'CUADRO RESUMEN DE LÁMINAS', 2.3, { a: 'middle' });
  s += Rc(xl, yl + 8, 25, 6) + Rc(xl + 25, yl + 8, 95, 6) + T(xl + 12.5, yl + 12, 'N° DE LÁMINA', 1.8, { a: 'middle' }) + T(xl + 72, yl + 12, 'DESCRIPCIÓN', 1.8, { a: 'middle' });
  const rh = Math.min(9, (h - 46) / Math.max(1, o.lista.length));
  o.lista.forEach(([a, b], i) => { const yy = yl + 14 + i * rh; s += Rc(xl, yy, 25, rh) + Rc(xl + 25, yy, 95, rh) + T(xl + 12.5, yy + rh / 2 + .7, a, 1.9, { a: 'middle' }) + T(xl + 30, yy + rh / 2 + .7, b, 1.9); });
  // Croquis ubicación + inscripción
  const xc = 585; s += Rc(xc, y0, 70, h) + Rc(xc, y0, 70, 8) + T(xc + 35, y0 + 5.3, 'CROQUIS UBICACIÓN', 2.3, { a: 'middle' });
  if (L.croquis) { const id = `crq${o.n || ''}`; s += `<clipPath id="${id}"><circle cx="${xc + 35}" cy="${y0 + 52}" r="27"/></clipPath><image href="${L.croquis}" x="${xc + 8}" y="${y0 + 25}" width="54" height="54" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><circle cx="${xc + 35}" cy="${y0 + 52}" r="27" fill="none" stroke="#555" stroke-width=".25"/>`; }
  else s += `<circle cx="${xc + 35}" cy="${y0 + 52}" r="27" fill="#EEF2F4" stroke="#999" stroke-width=".25"/>` + Ln(xc + 10, y0 + 45, xc + 60, y0 + 60, { st: '#bbb', sw: 1.2 }) + Ln(xc + 22, y0 + 28, xc + 44, y0 + 78, { st: '#bbb', sw: 1.2 });
  s += `<path d="M${xc + 37} ${y0 + 46}c-2.4 0-4 1.8-4 4 0 3 4 7 4 7s4-4 4-7c0-2.2-1.6-4-4-4z" fill="#E5484D"/>`;
  s += T(xc + 4, y0 + h - 7, `LATITUD Y LONGITUD: ${L.latlon || '—'}`, 1.6) + T(xc + 4, y0 + h - 3.5, 'DATUM: WGS84', 1.6);
  s += `<g transform="translate(${xc + 7} ${y0 + 16})">${rosaSVG(5)}</g>`;
  const xn = xc + 70; s += Rc(xn, y0, 60, h) + Rc(xn, y0, 60, 8) + T(xn + 30, y0 + 5.3, 'INSCRIPCIÓN', 2.3, { a: 'middle' }) + T(xn + 3, y0 + h - 9, 'N°:', 1.9) + T(xn + 3, y0 + h - 4, 'FECHA:', 1.9);
  // Título
  const xt = xn + 60, wt = W - M - 2 - xt; s += Rc(xt, y0, wt, h);
  s += T(xt + wt / 2, y0 + 8, `PROYECTO FOTOVOLTAICO ${fmt(D.kwn, D.kwn % 1 ? 1 : 0)} kW`, 3.4, { a: 'middle' }) + T(xt + wt / 2, y0 + 13.5, `${p.codigo || 'ON ---'} — ${p.cliente || ''}`, 3.2, { a: 'middle' });
  s += Ln(xt, y0 + 17, xt + wt, y0 + 17);
  const yd = y0 + 21; [`DIRECCIÓN: ${p.direccion || ''}`, `COMUNA: ${p.comuna || ''}`, `REGIÓN: ${p.region || ''}`, `PROPIETARIO: ${L.propietario || ''}`, `RUT: ${L.rutProp || ''}`].forEach((l, i) => s += T(xt + 2, yd + i * 3, l.toUpperCase(), 1.7));
  const xr = xt + wt * .55; s += Rc(xr, y0 + 17, wt * .45, 7) + T(xr + wt * .225, y0 + 21.8, `LÁMINA ${o.n} DE ${o.total}`, 2, { a: 'middle' });
  s += Rc(xr, y0 + 24, wt * .2, 6) + T(xr + wt * .1, y0 + 28, `ESCALA ${o.escala || 'S/E'}`, 1.7, { a: 'middle' }) + Rc(xr + wt * .2, y0 + 24, wt * .25, 6) + T(xr + wt * .21, y0 + 26.5, (L.fechaLamina || hoy()).toUpperCase(), 1.6) + T(xr + wt * .21, y0 + 29.3, `FORMATO ${o.formato || 'A1'}`, 1.6);
  s += T(xr + 1, y0 + 33, `PROYECTISTA: ${(L.proyectista || '').toUpperCase()}`, 1.7);
  s += Ln(xt, y0 + 37, xt + wt, y0 + 37) + T(xr + 1, y0 + 40.5, `INSTALADOR: ${(L.instalador || '').toUpperCase()}`, 1.7) + T(xr + 1, y0 + 43.5, `RUT: ${L.rutInst || ''}`, 1.7);
  s += Ln(xt + 6, y0 + h - 12, xt + wt * .45 - 6, y0 + h - 12) + T(xt + wt * .225, y0 + h - 9, 'FIRMA PROPIETARIO', 1.8, { a: 'middle' });
  s += Ln(xr + 6, y0 + h - 12, xt + wt - 6, y0 + h - 12) + T(xr + wt * .225, y0 + h - 9, 'FIRMA INSTALADOR', 1.8, { a: 'middle' });
  return s;
}
function rosaSVG(r) { let s = `<circle r="${r * .45}" fill="none" stroke="#111" stroke-width=".2"/>`; for (let i = 0; i < 8; i++) { const a = i * 45, R = i % 2 ? r * .7 : r; s += `<g transform="rotate(${a})"><path d="M0 ${-R}L${r * .14} 0L0 0z" fill="#C0272D"/><path d="M0 ${-R}L${-r * .14} 0L0 0z" fill="#fff" stroke="#C0272D" stroke-width=".15"/></g>`; } return s + T(0, -r - 1.2, 'N', r * .5, { a: 'middle', b: true, it: false }); }

/* ---------- Unilineal (generado desde los datos) ----------
   Se edita en el paso "Unilineal" (js/unilineal.js), guardado en p.uni:
     base     · cuál de los unilineales base de Ops se usa (BASES_UNI); sin elegir = el sugerido por el inversor
     textos   · { clave: texto } reemplaza el texto generado (clic en el texto para escribirlo)
     consumo, tierra, dcSwitch · mostrar u ocultar esas partes (por defecto se muestran)
     extras   · { bat, sg, ev } agrega batería, SmartGuard y circuito del cargador EV
   Cada texto lleva data-u="clave" para poder editarlo con clic en el paso Unilineal. */
export const opcUni = p => ({ textos: {}, extras: {}, ...(p.uni || {}) });

/* Unilineales base: los mismos del DWG de planos de Ops (monofásicos, trifásicos, cargadores). */
const EV_BASE = (marca, kw, prot) => ({ marca, kw, prot });
export const BASES_UNI = [
  { id: 'mono-2a6-tfv', g: 'Monofásicos', n: '2ktl a 6ktl con TFV', fase: 'Monofásico', tfv: true, inv: /-(L1|LB0)$/ },
  { id: 'mono-8-tfv', g: 'Monofásicos', n: '8ktl con TFV', fase: 'Monofásico', tfv: true, inv: /-LC0$/ },
  { id: 'mono-2a6', g: 'Monofásicos', n: '2ktl a 6ktl sin TFV', fase: 'Monofásico', inv: /-(L1|LB0)$/ },
  { id: 'mono-8', g: 'Monofásicos', n: '8ktl sin TFV', fase: 'Monofásico', inv: /-LC0$/ },
  { id: 'mono-offgrid', g: 'Monofásicos', n: 'Off grid', fase: 'Monofásico', offgrid: true, bat: true },
  { id: 'mono-bess', g: 'Monofásicos', n: 'BESS', fase: 'Monofásico', bat: true, sg: true },
  { id: 'tri-m1-tfv', g: 'Trifásicos', n: 'M1/MAP0 con TFV', fase: 'Trifásico', tfv: true, inv: /-(M1|MAP0)$/ },
  { id: 'tri-m5-tfv', g: 'Trifásicos', n: 'M5/M2/MB0 con TFV', fase: 'Trifásico', tfv: true, inv: /-(M5|MB0)$/ },
  { id: 'tri-m3-tfv', g: 'Trifásicos', n: 'M3 con TFV', fase: 'Trifásico', tfv: true, inv: /-M3$/ },
  { id: 'tri-100', g: 'Trifásicos', n: '100kW M2', fase: 'Trifásico', inv: /100KTL-M2$/ },
  { id: 'tri-m1', g: 'Trifásicos', n: 'M1 sin TFV', fase: 'Trifásico', inv: /-(M1|MAP0)$/ },
  { id: 'tri-m5', g: 'Trifásicos', n: 'M5 sin TFV', fase: 'Trifásico', inv: /-(M5|MB0)$/ },
  { id: 'tri-m3', g: 'Trifásicos', n: 'M3 sin TFV', fase: 'Trifásico', inv: /-M3$/ },
  { id: 'tri-150', g: 'Trifásicos', n: '150kW MG0', fase: 'Trifásico', inv: /-MG0$/ },
  { id: 'ev-huawei', g: 'Cargadores', n: 'Huawei monofásico 7.4kW sin TS', fase: 'Monofásico', soloEV: EV_BASE('HUAWEI', '7,4', '2x40 A Curva C') },
  { id: 'ev-tesla', g: 'Cargadores', n: 'Tesla monofásico 7.4kW sin TS', fase: 'Monofásico', soloEV: EV_BASE('TESLA WALL CONNECTOR', '7,4', '2x40 A Curva C') },
  { id: 'ev-beny-fv', g: 'Cargadores', n: 'Beny monofásico 7kW sin TS en FV', fase: 'Monofásico', soloEV: EV_BASE('BENY', '7', '2x32 A Curva C'), enFV: true },
  { id: 'ev-beny-esp', g: 'Cargadores', n: 'Beny monofásico 7kW sin TS solo ESP', fase: 'Monofásico', soloEV: EV_BASE('BENY', '7', '2x32 A Curva C') },
  { id: 'sg-ev-bat', g: 'Especiales', n: 'SmartGuard + electromovilidad + batería', sg: true, bat: true, evTablero: true }
];
/* El sugerido según el inversor del proyecto (sin TFV, como el unilineal de siempre) */
export function baseSugerida(p) {
  const I = inversorDe(p);
  return BASES_UNI.find(b => !b.tfv && b.inv && b.inv.test(I.modelo)) || BASES_UNI.find(b => b.id === (I.fase === 'Trifásico' ? 'tri-m1' : 'mono-2a6'));
}
export const baseUni = p => BASES_UNI.find(b => b.id === p.uni?.base) || baseSugerida(p);

/* Estilo de los unilineales de Ops (ON 909 y «unilineal AC/DC nuevo»): flujo de arriba hacia abajo por un solo eje,
   sin rellenos, líneas finas y color por tipo (rojo conductores, azul barras, verde protecciones y módulos,
   magenta equipos, cian medidor, amarillo trazo-punto tableros, gris guías). Unidades: mm de la hoja del unilineal. */
const UC = { cond: '#E00000', barra: '#0000D0', prot: '#00A000', equipo: '#C800C8', med: '#009CA8', tab: '#D4B000', guia: '#808080', bat: '#FF7F00' };
const LW = .13, FU = 1.7, FT = 2.8, FSERIF = "'Times New Roman',Times,serif";
const anchoT = (s, f) => String(s).length * f * .47;     // ancho aproximado de un texto (para las guías)
const codo = (x1, y1, x2, y2, c = UC.cond) => { const r = 2, sx = Math.sign(x2 - x1) || 1; return `<path d="M${x1} ${y1}H${x2 - sx * r}Q${x2} ${y1} ${x2} ${y1 + r}V${y2}" fill="none" stroke="${c}" stroke-width="${LW}"/>`; };

/* E4 · Unilineal en dos láminas (AC y DC) solo en proyectos grandes, como el estándar «unilineal AC / DC nuevo».
   Grande = trifásico, algún MPPT con más de un string o más de 4 MPPT. p.uni.laminas: 'una' | 'dos' fuerza la elección. */
export function esGrande(p) {
  const I = inversorDe(p), porMppt = {};
  (p.strings || []).forEach(st => { porMppt[st.mppt || 1] = (porMppt[st.mppt || 1] || 0) + 1; });
  return I.fase === 'Trifásico' || Math.max(0, ...Object.values(porMppt)) > 1 || (I.mppt || 1) > 4;
}
export const unilinealEnDos = p => !p.uni?.libre && !baseUni(p).soloEV && (p.uni?.laminas === 'dos' || (p.uni?.laminas !== 'una' && esGrande(p)));

/* parte: undefined = todo en una lámina · 'ac' = empalme, tableros e inversor (lado AC) · 'dc' = inversor, strings y batería */
function unilineal(p, D, SI, x0, y0, w, h, parte) {
  if (p.uni?.libre) { const vb = vbLibre(p.uni.libre); return `<svg x="${x0}" y="${y0}" width="${w}" height="${h}" viewBox="0 0 ${vb[0]} ${vb[1]}" preserveAspectRatio="xMidYMid meet">${dibujoLibre(p.uni.libre)}</svg>`; }   // editado a mano: tal cual quedó
  const I = D.inv, ca = D.ca, L = D.L, C = UC, U = opcUni(p), B = baseUni(p), soloAC = parte === 'ac', soloDC = parte === 'dc';
  const X = { bat: B.bat || U.extras.bat, sg: B.sg || U.extras.sg, ev: !B.soloEV && !B.evTablero && U.extras.ev };
  const TU = (k, x, y, def, size, o = {}) => { const v = U.textos[k] != null ? U.textos[k] : def; return T(x, y, v, size, { ...o, attr: `data-u="${esc(k)}"${U.textos[k] != null ? ' data-mod="1"' : ''}` }); };
  const fase = B.fase || I.fase, polos = fase === 'Trifásico' ? '4' : '2';
  const ln = (x1, y1, x2, y2, c = C.cond, o = {}) => Ln(x1, y1, x2, y2, { st: c, sw: LW, ...o });
  const cx = x0 + w * .46;
  let s = '';

  /* Barra de tierra de protección (azul, dos puntos) y lazo de tierra/neutro punteado por arriba y por abajo del tablero */
  const barraT = (x, y, tw, th, k) => { const bx = x + 4, by = y + th * .32, d = `fill="none" stroke="#111" stroke-width="${LW}" stroke-dasharray="2.4 1.2"`;
    return TU(k + '.bt1', bx - 1, by - 2.4, 'Barra tierra de', .95) + TU(k + '.bt2', bx - 1, by - 1.2, 'protección', .95) + Ln(bx - 1, by, bx + 7, by, { st: C.barra, sw: LW }) +
      `<circle cx="${bx + 1}" cy="${by}" r=".35" fill="${C.barra}"/><circle cx="${bx + 5}" cy="${by}" r=".35" fill="${C.barra}"/>` +
      `<path d="M${bx + 5} ${by}V${y + 3.5}Q${bx + 5} ${y + 2} ${bx + 6.5} ${y + 2}H${x + tw - 3}" ${d}/><path d="M${bx + 1} ${by}V${y + th - 3.5}Q${bx + 1} ${y + th - 2} ${bx + 2.5} ${y + th - 2}H${x + tw - 3}" ${d}/>`; };
  /* Tablero: contorno amarillo trazo-punto, título serif negrita cursiva, barra de tierra y nota de 3 líneas con guía */
  const tablero = (x, y, tw, th, k, titulo, nota = true) => {
    let t = Rc(x, y, tw, th, { st: C.tab, sw: LW, dash: '3 .8 .4 .8' }) + TU(k + '.titulo', x + tw / 2, y - 2, titulo, FT, { a: 'middle', b: true, ff: FSERIF }) + barraT(x, y, tw, th, k);
    if (nota) { const sg = nota === 'izq' ? -1 : 1, nx = sg < 0 ? x : x + tw, ny = y + th * .4, o = sg < 0 ? { it: false, a: 'end' } : { it: false };   // la del tablero general va a la izquierda, como en los planos
      const ls = [['nota1', 'Tablero metálico'], ['nota2', 'Grado protección IP65'], ['nota3', (k === 'tg' && L.dimTablero) || 'Medidas (pendiente)']], largo = Math.max(...ls.map(([kk, d]) => anchoT(U.textos[k + '.' + kk] ?? d, 1.9)));
      t += `<circle cx="${nx}" cy="${ny}" r=".6" fill="#fff" stroke="${C.guia}" stroke-width="${LW}"/>` + `<path d="M${nx + sg * .4} ${ny - .4}l${sg * 5} -5h${sg * (largo + 1)}" fill="none" stroke="${C.guia}" stroke-width="${LW}"/>`;
      t += ls.map(([kk, d], i) => TU(`${k}.${kk}`, nx + sg * 6, ny - 6 + i * 2.6, d, 1.9, o)).join(''); }
    return t;
  };
  /* Rótulo de varias líneas como en los planos (marca / polos×In / kA / curva). Si el texto ya se cambió a mano
     con la clave antigua (una sola línea), se respeta. */
  const rotulo = (x, y, k, lineas, o = {}, claves = lineas.map((_, i) => `${k}.${i + 1}`)) => U.textos[k] != null ? TU(k, x, y + 2, lineas.join(' '), FU, o) : lineas.map((l, i) => TU(claves[i], x, y + i * 2.1, l, FU, o)).join('');
  const prot = (x, y, k, def) => breaker(x, y) + rotulo(x + 3, y - 2.6, k, lineasProt(def, L.marcaDisy, L.kA));   // interruptor + rótulo
  const difer = (x, y, k, def) => dif(x, y) + rotulo(x + 3, y + .9, k, lineasDif(def, L.marcaDif));          // diferencial (y = borde superior)
  const circuito = (Xc, yb, yfin, k, def, izq, num) => ln(Xc, yb, Xc, yb + 2) + breaker(Xc, yb + 6) + ln(Xc, yb + 10, Xc, yfin) +
    `<circle cx="${Xc}" cy="${yfin + 1.6}" r="1.6" fill="none" stroke="#111" stroke-width="${LW}"/>` + (num ? T(Xc, yfin + 2.25, num, 1.8, { a: 'middle', it: false, ff: FSERIF }) : TU(k, Xc + (izq ? -2.6 : 2.6), yfin + 2.2, def, FU, izq ? { a: 'end' } : {}));
  /* Circuito del cargador EV dentro del tablero general: interruptor + diferencial 30 mA Tipo A-SI y el cargador bajo el tablero */
  const circuitoEV = (Xc, yb, yBase) => ln(Xc, yb, Xc, yb + 2) + prot(Xc, yb + 6, 'ev.prot', U.extras.evProt || `${polos}x32 A Curva C`) + ln(Xc, yb + 10, Xc, yb + 12.5) +
    difer(Xc, yb + 12.5, 'ev.dif', U.extras.evDif || `${polos}x40 A 30 mA Tipo A-SI`) + ln(Xc, yb + 15.5, Xc, yBase + 4) + cargador(Xc, yBase + 4, 'ev.cg', U.extras.evMarca || 'Marca (pendiente)', U.extras.evKw || '—');
  /* Leyenda «① Consumo» a la izquierda del tablero general */
  const leyenda = (x, y, k, n, def) => Rc(x, y, 26, 7, { st: '#111', sw: LW }) + `<circle cx="${x + 3.4}" cy="${y + 3.5}" r="1.5" fill="none" stroke="#111" stroke-width="${LW}"/>` +
    T(x + 3.4, y + 4.15, n, 1.7, { a: 'middle', it: false, ff: FSERIF }) + TU(k, x + 6.2, y + 4.4, def, 2.4, { it: false, ff: FSERIF });
  const cargador = (Xc, yc, k, marca, kw) => `<g fill="none" stroke="#111" stroke-width="${LW}"><rect x="${Xc - 4}" y="${yc + 2}" width="8" height="10" rx="2"/><rect x="${Xc - 4}" y="${yc}" width="8" height="10" rx="2" fill="#fff"/><circle cx="${Xc}" cy="${yc + 3}" r="1.3"/></g>` +
    TU(k + '.1', Xc + 6, yc + 2.5, `Cargador Eléctrico ${fase === 'Trifásico' ? '3ø' : '1ø'}`, FU) + TU(k + '.2', Xc + 6, yc + 4.6, `${marca}`, FU) + TU(k + '.3', Xc + 6, yc + 6.7, `Potencia de Carga ${kw} kW`, FU) + TU(k + '.4', Xc, yc + 15, fase, 1.4, { a: 'middle' });

  /* ---- Empalme (arriba a la izquierda) y límites del proyecto ---- */
  const ew = 32, eh = 34, ex = x0 + 30, ey = y0 + 3, yE = ey + 16;
  if (!B.offgrid && !soloDC) {
    s += Rc(ex, ey, ew, eh, { st: C.equipo, sw: LW }) + Ln(ex, ey + 8, ex + ew, ey + 8, { st: C.equipo, sw: LW });
    s += TU('emp.titulo', ex + ew / 2, ey + 3.4, `EMPALME ${fase.toUpperCase()}`, 1.5, { a: 'middle', b: true, it: false, ff: FSERIF }) + TU('emp.tipo', ex + ew / 2, ey + 6.4, L.empalme || 'TIPO (pendiente)', 1.4, { a: 'middle', b: true, it: false, ff: FSERIF });
    s += Rc(ex + 4, yE - 4, 7, 8, { st: C.med, sw: LW }) + T(ex + 7.5, yE + 1.5, 'M', 4.2, { a: 'middle', it: false, b: true, fill: C.med, ff: FSERIF });
    s += TU('emp.med1', ex + 7.5, yE + 7, 'MEDIDOR', 1.15, { a: 'middle', it: false }) + TU('emp.med2', ex + 7.5, yE + 8.6, B.soloEV ? '' : 'BIDIRECCIONAL', 1.15, { a: 'middle', it: false }) + TU('emp.dist', ex + 7.5, yE + 10.2, (p.distrib || '').toUpperCase(), 1.15, { a: 'middle', it: false });
    s += ln(ex - 10, yE, ex + 4, yE) + ln(ex + 11, yE, ex + 17, yE) + `<g transform="rotate(-90 ${ex + 21} ${yE})">${breaker(ex + 21, yE)}</g>` + ln(ex + 25, yE, ex + ew, yE);
    s += [['emp.int1', L.marcaEmp || 'Marca (pendiente)'], ['emp.int2', `${polos === '4' ? '3' : '1'}x${D.ca.prot}A`], ['emp.int4', L.kAEmp ? `${String(L.kAEmp).replace(/\s*kA$/i, '')}kA` : 'kA (pendiente)'], ['emp.int3', 'Curva C']]
      .map(([k, d], i) => TU(k, ex + 21, yE + 4.6 + i * 1.75, d, 1.3, { a: 'middle' })).join('');
    // tarifa y N° de cliente, a la izquierda de la acometida (como en los planos)
    s += [['emp.tarifa', `TARIFA ${L.tarifa || '(pendiente)'}`], ['emp.exist', 'EXISTENTE'], ['emp.cli1', 'N° CLIENTE'], ['emp.cli2', L.nCliente || '(pendiente)']]
      .map(([k, d], i) => TU(k, ex - 11, yE - 2.9 + i * 1.9, d, 1.4, { a: 'end' })).join('');
    if (!B.soloEV) s += TU('emp.pot', ex + ew + 3, yE - 1.2, `${fmt(D.kwn, 0)} kW / ${I.vac} V`, FU);
    // límites: todo menos el empalme (con un escalón), rótulo arriba a la derecha
    const xa = ex + ew + 6, xb = x0 + w - 2, ya = y0 + 1, yb = y0 + h - 1, yc = ey + eh + 4, xl = x0 + 2;
    s += `<path d="M${xa} ${ya}H${xb}V${yb}H${xl}V${yc}H${xa}Z" fill="none" stroke="${C.guia}" stroke-width="${LW}"/>` + TU('limites', xb - 3, ya + 5, 'LÍMITES DEL PROYECTO', 2.4, { a: 'end' });
  } else if (!soloDC) s += TU('og.titulo', cx, ey + 4, 'SISTEMA AISLADO (OFF GRID) · SIN CONEXIÓN A LA RED', 2.4, { a: 'middle', b: true, ff: FSERIF });
  // tierra de servicio y protección: punto en el conductor, guía segmentada hasta los símbolos
  if (U.tierra !== false && !B.offgrid && !soloDC) { const tx0 = cx, ty0 = yE + 7, gx = cx + 28;
    s += `<circle cx="${tx0}" cy="${ty0}" r=".55" fill="#111"/>` + Ln(tx0, ty0, gx + 7, ty0, { st: '#111', sw: LW, dash: '3 1.2' }) + tierraP(gx, ty0) + tierra(gx + 7, ty0);
    const lt = [['tierra.1', 'Tierra de servicio y protección'], ['tierra.2', 'existente'], ['tierra.3', L.tierraCond || 'Evaflex 2x6 mm² (N+T)'], ['tierra.4', `L = ${L.tierraL || '—'} m`], ['tierra.5', `R = ${L.tierraR || '—'} Ω`], ['tierra.6', L.tierraMet || 'Método de pinza']];
    s += lt.map(([k, d], i) => TU(k, gx + 9, ty0 + 9 + i * 2.1, d, FU, { a: 'end' })).join(''); }

  /* ---- Alturas: bloques fijos y huecos repartidos (el dibujo llena la hoja) ---- */
  const conTFV = !!B.tfv;
  const hTG = B.soloEV ? 40 : conTFV ? (X.ev ? 38 : 30) : 44, hTFV = 28, hInv = soloAC ? 16 : conTFV ? 40 : 44, hStr = soloAC ? 0 : conTFV ? 46 : 50, hArr = B.offgrid ? 12 : ey + eh - y0 + 2;
  const nGap = B.soloEV ? 2 : conTFV ? 3 : 2;
  const gap = Math.max(18, Math.min(40, (h - hArr - hTG - (conTFV ? hTFV : 0) - (B.soloEV ? 30 : hInv + hStr)) / nGap));
  const tw = Math.min(w * .42, 120), tx = cx - tw / 2;
  const ty = y0 + hArr + gap;
  if (!B.offgrid && !soloDC) s += codo(ex + ew, yE, cx, ty) + cond(cx, ty - Math.max(14.5, gap * .62), ca.tramos[1], I, 'c2', TU, -1);

  /* ---- Solo cargador (electromovilidad, sin fotovoltaico) ---- */
  if (B.soloEV) {
    const E = B.soloEV;
    s += tablero(tx, ty, tw, hTG, 'tg', B.enFV ? 'TABLERO GENERAL y FOTOVOLTAICO (TGyFV)' : 'TABLERO GENERAL (TG)', 'izq');
    s += ln(cx, ty, cx, ty + 4) + prot(cx, ty + 8, 'tg.disy', `${L.disyuntor || `${polos}x${D.ca.prot} A Curva C`}`) + ln(cx, ty + 12, cx, ty + 16);
    s += ln(tx + 8, ty + 16, tx + tw - 8, ty + 16, C.barra) + TU('tg.barra', tx + tw - 9, ty + 15.2, 'Barra repartidora de cobre', 1.3, { a: 'end' });
    s += ln(cx, ty + 16, cx, ty + 18) + prot(cx, ty + 22, 'ev.prot', `${U.extras.evProt || E.prot}`) + ln(cx, ty + 26, cx, ty + 29) + difer(cx, ty + 29, 'tg.dif', `${L.diferencial || '2x40 A 30 mA Tipo A'}`);
    if (U.consumo !== false) s += circuito(cx + tw * .3, ty + 16, ty + hTG + 6, 'tg.consumo', 'Consumo', false, '1') + leyenda(tx - 36, ty + hTG - 10, 'tg.consumo', '1', 'Consumo');
    if (B.enFV) s += circuito(cx - tw * .3, ty + 16, ty + hTG + 6, 'tg.fv', 'Circuito FV existente', true);
    const cy = ty + hTG + gap; s += ln(cx, ty + 32, cx, cy) + TU('evc.0', cx - 2.6, ty + hTG + 8, `Conductor ${polos}x6 mm² + T`, FU, { a: 'end' }) + TU('evc.1', cx - 2.6, ty + hTG + 10.2, 'Tub. EMT Ø25 mm', FU, { a: 'end' });
    return s + cargador(cx, cy, 'ev.cg', E.marca, E.kw);
  }

  /* ---- Tablero(s): TGyFV (sin TFV) o TG + TFV separados ---- */
  let yFin;                                                   // donde baja la línea al inversor
  if (soloDC) {                                               // lámina DC: arriba solo la llegada desde el tablero (ver lámina AC)
    yFin = y0 + 13;
    s += Rc(cx - 24, y0 + 3, 48, 10, { st: C.cond, sw: LW }) + TU('dc.hacia1', cx, y0 + 7.2, conTFV ? 'HACIA TABLERO FOTOVOLTAICO' : 'HACIA TABLERO GENERAL Y FV', FU, { a: 'middle', it: false }) + TU('dc.hacia2', cx, y0 + 10.4, '(ver unilineal AC)', 1.4, { a: 'middle' });
  } else if (!conTFV) {
    s += tablero(tx, ty, tw, hTG, 'tg', B.offgrid ? 'TABLERO GENERAL (TG)' : 'TABLERO GENERAL y FOTOVOLTAICO (TGyFV)', 'izq');
    s += ln(cx, ty, cx, ty + 4) + prot(cx, ty + 8, 'tg.disy', `${L.disyuntor || disyDef(D)}`) + ln(cx, ty + 12, cx, ty + 16);
    s += ln(tx + 8, ty + 16, tx + tw - 8, ty + 16, C.barra) + TU('tg.barra', tx + tw - 9, ty + 15.2, 'Barra repartidora de cobre', 1.3, { a: 'end' });
    s += ln(cx, ty + 16, cx, ty + 18) + prot(cx, ty + 22, 'tg.fvp', `${L.disyuntor || disyDef(D)}`) + ln(cx, ty + 26, cx, ty + 29) + difer(cx, ty + 29, 'tg.dif', `${L.diferencial || difDef(D)}`);
    if (U.consumo !== false) s += circuito(cx + tw * .32, ty + 16, ty + hTG + 6, 'tg.consumo', 'Consumo', false, '1') + leyenda(tx - 36, ty + hTG - 10, 'tg.consumo', '1', 'Consumo');
    if (X.ev) s += circuitoEV(cx - tw * .32, ty + 16, ty + hTG);
    if (B.evTablero) s += tableroEV(ty + 16, ty);
    yFin = ty + 32;
  } else {
    s += tablero(tx, ty, tw, hTG, 'tg', 'TABLERO GENERAL (TG)', 'izq');
    s += ln(cx, ty, cx, ty + 3) + prot(cx, ty + 7, 'tg.gral', disyDef(D)) + ln(cx, ty + 11, cx, ty + 14);
    s += ln(tx + 8, ty + 14, tx + tw - 8, ty + 14, C.barra) + TU('tg.barra', tx + tw - 9, ty + 13.2, 'Barra repartidora de cobre', 1.3, { a: 'end' });
    s += ln(cx, ty + 14, cx, ty + 16) + prot(cx, ty + 20, 'tg.alim', disyDef(D));
    if (U.consumo !== false) s += circuito(cx + tw * .32, ty + 14, ty + hTG + 4, 'tg.consumo', 'Consumo', false, '1') + leyenda(tx - 36, ty + hTG - 10, 'tg.consumo', '1', 'Consumo');
    if (X.ev) s += circuitoEV(cx - tw * .32, ty + 14, ty + hTG);
    const t2 = ty + hTG + gap, tw2 = Math.min(tw * .6, 70);
    s += ln(cx, ty + 24, cx, t2) + `<circle cx="${cx}" cy="${ty + hTG + gap * .5}" r=".6" fill="#fff" stroke="${C.guia}" stroke-width="${LW}"/>` + TU('ctg.0', cx + (X.ev ? 2.6 : -2.6), ty + hTG + gap * .5 - .5, `RVK ${polos}x8,37 mm² · Tub. EMT Ø32 mm`, FU, X.ev ? {} : { a: 'end' });
    s += tablero(cx - tw2 / 2, t2, tw2, hTFV, 'tfv', 'TABLERO FOTOVOLTAICO (TFV)');
    s += ln(cx, t2, cx, t2 + 4) + prot(cx, t2 + 8, 'tg.disy', `${L.disyuntor || disyDef(D)}`) + ln(cx, t2 + 12, cx, t2 + 16) + difer(cx, t2 + 16, 'tg.dif', `${L.diferencial || difDef(D)}`);
    yFin = t2 + 19;
  }
  if (X.sg && !B.offgrid && !soloDC) s += smartGuard(conTFV ? ty + 14 : ty + 16);
  /* Smart Guard: tablero magenta propio arriba a la derecha (como en el ON 909). GRID desde la acometida,
     BACKUP → ② consumos con respaldo, NON BACKUP → ③ consumos sin respaldo, FV ↔ barra del tablero general. */
  function smartGuard(yB) {
    const sw = 72, sh = 26, gx = cx + 40, gy = yE + 8, xs = [gx + 6, gx + 24, gx + 42, gx + 62], yb = gy + 15, yJ = gy - 5, p63 = `${polos}x63 A Curva C`;
    const carga = (x, y, n, k, def) => `<circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="#111" stroke-width="${LW}"/>` + T(x, y + .65, n, 1.8, { a: 'middle', it: false, ff: FSERIF }) + TU(k, x + 2.6, y + .6, def, FU);
    let t = Rc(gx, gy, sw, sh, { st: C.equipo, sw: LW }) + TU('sg.titulo', gx + sw + 2, gy + 4, 'Smart Guard', FT, { b: true, ff: FSERIF }) + TU('sg.modelo', gx + sw + 2, gy + 7, U.extras.sgModelo || '', FU);
    t += ln(gx + 2, yb, gx + sw - 2, yb, C.barra);
    t += TU('sg.grid', xs[0] + .8, gy + 2.3, 'GRID', 1.3) + TU('sg.bk', xs[2] + .8, gy + 2.3, 'BACKUP', 1.3) + TU('sg.fv', xs[1] - .8, gy + sh - .8, 'FV', 1.3, { a: 'end' }) + TU('sg.nbk', xs[3] - .8, gy + sh - .8, 'NON BACKUP', 1.3, { a: 'end' });
    t += ln(xs[0], gy, xs[0], gy + 4) + prot(xs[0], gy + 8, 'sg.p1', p63) + ln(xs[0], gy + 12, xs[0], yb);              // GRID
    t += ln(xs[2], gy, xs[2], gy + 4) + prot(xs[2], gy + 8, 'sg.p2', p63) + ln(xs[2], gy + 12, xs[2], yb);              // BACKUP
    t += ln(xs[1], yb, xs[1], gy + 16) + prot(xs[1], gy + 20, 'sg.p3', p63) + ln(xs[1], gy + 24, xs[1], gy + sh);       // FV
    t += ln(xs[3], yb, xs[3], gy + sh);                                                                               // NON BACKUP
    t += codo(cx, yJ, xs[0], gy) + `<circle cx="${cx}" cy="${yJ}" r=".55" fill="#111"/>`;                              // desde la acometida
    t += ln(xs[2], gy, xs[2], gy - 3) + carga(xs[2], gy - 4.6, '2', 'sg.c2', 'Consumos con respaldo');
    t += ln(xs[3], gy + sh, xs[3], gy + sh + 3) + carga(xs[3], gy + sh + 4.6, '3', 'sg.c3', 'Consumos sin respaldo');
    const xb = tx + tw - 8;                                                                                          // FV baja a la barra del tablero general
    t += `<path d="M${xs[1]} ${gy + sh}V${yB - 2}Q${xs[1]} ${yB} ${xs[1] - 2} ${yB}H${xb}" fill="none" stroke="${C.cond}" stroke-width="${LW}"/><circle cx="${xb}" cy="${yB}" r=".55" fill="#111"/>`;
    return t;
  }
  // Tablero de electromovilidad (a la derecha, alimentado bajando desde la barra del tablero general)
  function tableroEV(yBarra, tyy) {
    const bw = 44, bx = Math.min(x0 + w - bw - 30, tx + tw + 40), by = tyy + 22, bh = 30;
    let t = codo(tx + tw - 8, yBarra, bx + bw / 2, by);
    t += tablero(bx, by, bw, bh, 'tev', 'TABLERO ELECTROMOVILIDAD', false);
    t += ln(bx + bw / 2, by, bx + bw / 2, by + 4) + prot(bx + bw / 2, by + 8, 'ev.prot', U.extras.evProt || '2x32 A Curva C') + ln(bx + bw / 2, by + 12, bx + bw / 2, by + 16) + difer(bx + bw / 2, by + 16, 'tev.dif', '2x40 A 30 mA Tipo A-SI') + ln(bx + bw / 2, by + 19, bx + bw / 2, by + bh + 14);
    return t + cargador(bx + bw / 2, by + bh + 14, 'ev.cg', 'EV', '7,4');
  }

  /* ---- Inversor: marco magenta, símbolo en el eje, MPPT y DC SWITCH ---- */
  const nIn = Math.max(1, I.strPorMppt || 1), nM = I.mppt;
  const iy = soloDC ? y0 + 30 : yFin + gap + (conTFV ? hTFV - 19 : hTG - 32), iw = soloDC ? Math.min(w * (X.bat ? .6 : .86), Math.max(110, nM * nIn * 26)) : Math.min(w * .62, Math.max(96, nM * 32)), ix = cx - iw / 2, ih = soloDC ? 44 : hInv;
  s += ln(cx, yFin, cx, iy + 4) + (soloDC ? '' : cond(cx, yFin + (iy - yFin) * .5, ca.tramos[0], I, 'c1', TU, 1));
  s += Rc(ix, iy, iw, ih, { st: C.equipo, sw: LW });
  s += TU('inv.1', ix + 2.5, iy + 3.6, B.offgrid ? 'INVERSOR HÍBRIDO (OFF GRID)' : 'INVERSOR', FU) + TU('inv.2', ix + 2.5, iy + 5.8, `${I.marca} ${I.modelo}${(p.cantInv || 1) > 1 ? ` (x${p.cantInv})` : ''}`, FU) + TU('inv.3', ix + 2.5, iy + 8, `POT. NOMINAL ${I.kw} kW`, FU) + TU('inv.4', ix + 2.5, iy + 10.2, 'Perfil de red: Chile (CL)', FU);
  s += Rc(cx - 3.5, iy + 4, 7, 7, { st: C.equipo, sw: LW }) + Ln(cx - 3.5, iy + 11, cx + 3.5, iy + 4, { st: C.equipo, sw: LW }) + T(cx - 2.7, iy + 6.6, '~', 2.2, { it: false, fill: C.equipo }) + T(cx + .6, iy + 10.4, '=', 2, { it: false, fill: C.equipo });
  if (soloAC) return s + TU('inv.verDC', cx + 6, iy + 9, 'Entradas DC, strings y batería: ver unilineal DC', FU);
  const paso = (iw - 14) / nM, sx = i => ix + 10 + paso * (i + .5), yBus = iy + 16;
  s += ln(cx, iy + 11, cx, yBus) + ln(sx(0) - 4, yBus, sx(nM - 1) + 4, yBus, C.barra);
  /* Entradas: cada MPPT con su sub-barra y una entrada por string (interruptor verde en el DC SWITCH);
     las que no tienen string salen como «VACANTE», como en el unilineal DC nuevo */
  const off = Math.min(14, paso / (nIn + .5)), xIn = (i, j) => sx(i) + j * off, yIn = nIn > 1 ? iy + 26.5 : iy + 24.4;
  const sy = iy + ih + 4, fs = nM > 5 ? 1.35 : FU, dcsw = U.dcSwitch !== false;
  const lista = SI.lista.length ? SI.lista : Array.from({ length: nM }, (_, i) => ({ st: { id: 'v' + i, mppt: i + 1, num: 1 }, vacio: true, nombre: `A.${i + 1}.1` }));
  const usadas = new Set(lista.map(x => `${Math.min(nM - 1, (x.st.mppt || 1) - 1)}:${(x.st.num || 1) - 1}`));
  for (let i = 0; i < nM; i++) { s += ln(sx(i), yBus, sx(i), iy + 19, C.equipo) + Rc(sx(i) - 3, iy + 19, 6, 5.4, { st: C.equipo, sw: LW }) + T(sx(i), iy + 21.3, 'MPPT', 1.3, { a: 'middle' }) + T(sx(i), iy + 23.4, String(i + 1), 1.3, { a: 'middle' });
    if (nIn > 1) s += ln(sx(i), iy + 24.4, sx(i), yIn) + ln(sx(i) - 2, yIn, xIn(i, nIn - 1) + 2, yIn, C.barra); }
  const yDC = iy + 31;
  if (dcsw) s += Rc(sx(0) - 6, yDC, xIn(nM - 1, nIn - 1) - sx(0) + 12, 5.6, { st: C.equipo, sw: LW }) + TU('inv.dcsw', sx(0) - 7.5, yDC + 2.3, 'DC SWITCH', FU, { a: 'end' }) + T(sx(0) - 7.5, yDC + 4.5, '1', FU, { a: 'end' });
  for (let i = 0; i < nM; i++) for (let j = 0; j < nIn; j++) { const x = xIn(i, j);
    s += ln(x, yIn, x, dcsw ? yDC + 1 : yIn) + (dcsw ? swDC(x, yDC + 1) : '');
    if (!usadas.has(`${i}:${j}`)) s += ln(x, dcsw ? yDC + 4.6 : yIn, x, sy - .5) + `<path d="M${x - .9} ${sy - 1.2}l1.8 -1M${x - .9} ${sy - .5}l1.8 -1" stroke="${C.cond}" stroke-width="${LW}"/>` + T(x, sy + 1.6, 'VACANTE', 1.2, { a: 'middle' }); }
  // Batería: a la derecha del inversor, desde el bus de CC, con su DC SWITCH arriba
  if (X.bat) { const bx = Math.min(ix + iw + 12, x0 + w - 40), by = iy + 22, E = U.extras;
    s += codo(sx(nM - 1) + 4, yBus, bx + 3, by) + Ln(cx + 3.5, iy + 7.5, bx + 7, iy + 7.5, { st: C.bat, sw: LW }) + Ln(bx + 7, iy + 7.5, bx + 7, by, { st: C.bat, sw: LW });
    s += Rc(bx, by, 9, 18, { st: C.equipo, sw: LW }) + Ln(bx, by + 5.6, bx + 9, by + 5.6, { st: C.equipo, sw: LW }) + swDC(bx + 3, by + 1) + TU('bat.dcsw', bx - 1.5, by + 3.4, 'DC SWITCH', 1.3, { a: 'end' });
    s += T(bx + 2.2, by + 10, '+', 2, { it: false }) + T(bx + 5.6, by + 10, '–', 2, { it: false });
    s += [['bat.titulo', 'Módulo DC/DC + batería'], ['bat.modelo', E.batModelo || 'LUNA2000'], ['bat.cap', `E total = ${E.batCap || '—'}`], ['bat.pmax', `P máx = ${E.batPmax || '—'}`], ['bat.vop', `V op = ${E.batV || '—'}`]]
      .map(([k, d], i) => TU(k, bx + 11, by + 2 + i * 2.2, d, FU)).join(''); }

  /* ---- Strings: rojo continuo, canalización común con un círculo en cada cruce, módulo vertical ---- */
  const xsDe = x => xIn(Math.min(nM - 1, (x.st.mppt || 1) - 1), Math.min(nIn - 1, (x.st.num || 1) - 1));
  const xs = lista.map(xsDe), xMin = Math.min(...xs), xMax = Math.max(...xs);
  s += Ln(xMin - 8, sy + 3, xMax + 8, sy + 3, { st: '#111', sw: LW }) + TU('str.ducto1', xMin - 10, sy + 2.2, 'Tub. EMT Ø32 mm', fs, { a: 'end' }) + TU('str.ducto2', xMin - 10, sy + 4.4, 'Tub. Metálica Flex. Heavy Duty Ø32 mm', fs, { a: 'end' });
  lista.forEach(x => {
    const Xs = xsDe(x), k = `s.${x.st.id}.`, ym = sy + 15;
    s += ln(Xs, dcsw ? yDC + 4.6 : yIn, Xs, ym) + `<circle cx="${Xs}" cy="${sy + 3}" r=".6" fill="#fff" stroke="#111" stroke-width="${LW}"/>`;
    s += Rc(Xs - 1.9, ym, 3.8, 5.4, { st: C.prot, sw: LW }) + `<path d="M${Xs - 1.9} ${ym}L${Xs} ${ym + 2.7}L${Xs + 1.9} ${ym}" fill="none" stroke="${C.prot}" stroke-width="${LW}"/>`;
    if (x.vacio) { s += T(Xs - 3, ym + 8, `Str.${x.nombre}`, fs, { a: 'end' }); return; }
    s += TU(k + 'largo', Xs + 1.2, sy + 9.6, `L=${fmt(x.largo, 0)} m`, fs) + TU(k + 'cond', Xs + 1.2, sy + 11.8, `PV1-F 2x${x.seccion} mm²`, fs);
    s += TU(k + 'pmax', Xs + 3, ym + 2.2, `Ptotal=${fmt(x.pw / 1000, 2)} kWp`, fs) + TU(k + 'pmod', Xs + 3, ym + 4.4, `Pmód=${x.P.wp} Wp`, fs);
    s += TU(k + 'nombre', Xs - 3, ym + 8, `Str.${x.nombre}`, fs, { a: 'end' }) + TU(k + 'mods', Xs - 3, ym + 10.2, `${x.n} módulos`, fs, { a: 'end' });
    s += `<circle cx="${Xs + 1.9}" cy="${ym + 5.4}" r=".45" fill="#111"/>` + Ln(Xs + 1.9, ym + 5.4, Xs + 3.2, ym + 5.4, { st: '#111', sw: LW }) + Ln(Xs + 3.2, ym + 5.4, Xs + 3.2, ym + 10, { st: '#111', sw: LW }) + tierraP(Xs + 3.2, ym + 10) + TU(k + 'tp', Xs + 3.2, ym + 15.6, 'T.P.', 1.3, { a: 'middle' });
    // bloque de tierra del string: conductor y resistencia medida, separados por una raya
    const ct = U.textos[k + 'tp2'] ?? (L.tierraStrCond || 'Evaflex 1x6 mm²'), an = anchoT(ct, 1.3) + 2;
    s += TU(k + 'tp2', Xs + 3.2, ym + 17.6, ct, 1.3, { a: 'middle' }) + Ln(Xs + 3.2 - an / 2, ym + 18.2, Xs + 3.2 + an / 2, ym + 18.2, { st: '#111', sw: LW }) + TU(k + 'tpR', Xs + 3.2, ym + 19.9, `R = ${L.tierraRstr || '—'} Ω`, 1.3, { a: 'middle' });
  });
  return s;
}
/* Líneas del rótulo de una protección a partir del texto «2x40 A Curva C» / «2x63 A 300 mA Tipo A».
   Marca y kA vienen de la ficha; si faltan se marcan «pendiente» (no se inventan datos de fabricante). */
const IN_RE = /(\d+)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*A(?![a-z])/i;
const MARCA = m => m || 'Marca (pendiente)';
export function lineasProt(def, marca, kA) {
  const m = IN_RE.exec(def), ka = kA ? `${String(kA).replace(/\s*kA$/i, '')}kA` : 'kA (pendiente)';
  if (!m) return [MARCA(marca), def, ka];
  const curva = /curva\s*([A-DK])(?![a-z])/i.exec(def), resto = (def.slice(0, m.index) + ' ' + def.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  return [MARCA(marca), `${m[1]}x${m[2]}A`, ka, ...(curva ? ['Curva ' + curva[1].toUpperCase()] : resto ? [resto] : [])];
}
export function lineasDif(def, marca) {
  const m = IN_RE.exec(def); if (!m) return [MARCA(marca), def];
  const ma = /(\d+)\s*mA/i.exec(def), tipo = /(tipo|clase)\s+[\w-]+/i.exec(def);
  return [MARCA(marca), `${m[1]}x${m[2]}A`, ...(ma ? [`${ma[1]}mA`] : []), ...(tipo ? [tipo[0]] : [])];
}
/* Interruptor termomagnético (vertical, centrado en x,y; el conductor llega a y−4 e y+4): un círculo en cada borne,
   arco hacia la derecha y la marca «=» como en los planos de Ops */
const breaker = (x, y, c = UC.prot) => { const a = 1.85; return `<g fill="none" stroke-width="${LW}"><path d="M${x} ${y - 4}V${y - a - .35}M${x} ${y + a + .35}V${y + 4}" stroke="${UC.cond}"/><circle cx="${x}" cy="${y - a}" r=".35" stroke="${c}"/><circle cx="${x}" cy="${y + a}" r=".35" stroke="${c}"/><path d="M${x + .3} ${y - a + .2}Q${x + 2.5} ${y} ${x + .3} ${y + a - .2}" stroke="${c}"/><path d="M${x + 1.25} ${y - .38}h.9M${x + 1.25} ${y + .38}h.9" stroke="${c}"/></g>`; };
/* Diferencial: cuadrado de 3 × 3 con diagonal y «P» / «D» (y = borde superior) */
const dif = (x, y) => `<g fill="none" stroke="#111" stroke-width="${LW}"><rect x="${x - 1.5}" y="${y}" width="3" height="3"/><path d="M${x - 1.5} ${y + 3}l3 -3"/></g>` + T(x - 1.25, y + 1.15, 'P', .95, { it: false, b: true, ff: FSERIF }) + T(x + .45, y + 2.85, 'D', .95, { it: false, b: true, ff: FSERIF });
/* Interruptor del DC SWITCH (verde): borne arriba en y, borne abajo en y + 3,6 y la cuchilla en diagonal */
const swDC = (x, y) => `<g fill="none" stroke="${UC.prot}" stroke-width="${LW}"><circle cx="${x}" cy="${y}" r=".3"/><circle cx="${x}" cy="${y + 3.6}" r=".3"/><path d="M${x} ${y + 3.3}l1.5 -2.7"/></g>`;
const tierra = (x, y) => `<path d="M${x} ${y}v2.4M${x - 2.4} ${y + 2.4}h4.8M${x - 1.6} ${y + 3.4}h3.2M${x - .8} ${y + 4.4}h1.6" stroke="#111" stroke-width="${LW}" stroke-dasharray=".6 .3"/>`;
const tierraP = (x, y) => '<g>' + `<path d="M${x} ${y}v1.4M${x - 2.6} ${y + 1.4}h5.2" stroke="#111" stroke-width="${LW}"/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${x - 2.4 + i * 1} ${y + 1.4}l-.8 1.1" stroke="#111" stroke-width="${LW}"/>`).join('') + '</g>';
/* Etiqueta de un conductor: círculo sobre el cable y guía gris que subraya la primera línea; lado −1 = a la izquierda */
function cond(x, y, t, I, k = 'c', TU = (kk, ...a) => T(...a), lado = 1) {
  const L = [`RVK Reviflex Monopolar ${I.fase === 'Trifásico' ? '3' : '1'}x8,37 mm² (F)`, 'RVK Reviflex Monopolar 1x8,37 mm² (N)', `Tub. ${t.ducto}`, `DISTANCIA = ${fmt(t.largo, 0)} m`, `Vp = ${fmt(t.dv, 2)} V / ${fmt(t.dvp, 2)} %`];
  const x1 = x + lado * 2.6, largo = anchoT(L[0], FU) + 1;
  const s = `<circle cx="${x}" cy="${y}" r=".6" fill="#fff" stroke="${UC.guia}" stroke-width="${LW}"/>` + Ln(x + lado * .6, y, x1 + lado * largo, y, { st: UC.guia, sw: LW });
  return s + L.map((l, i) => TU(`${k}.${i}`, x1, i ? y + .4 + i * 2.2 : y - .5, l, FU, lado < 0 ? { a: 'end' } : {})).join('');
}

/* ---------- Simbología y notas ---------- */
function simbologia(x, y, w, h) {
  let s = Rc(x, y, w, h) + T(x + w / 2, y + 4, 'SIMBOLOGÍA', 2.2, { a: 'middle', b: true }) + Ln(x + w / 2 - 10, y + 5, x + w / 2 + 10, y + 5);
  const it = [
    [`<rect x="-3" y="-3" width="6" height="6" fill="none" stroke="#00A000" stroke-width=".3"/><path d="M-3 -3l3 3.5 3-3.5" fill="none" stroke="#1A8F3C" stroke-width=".3"/>`, 'MÓDULO FOTOVOLTAICO'],
    [`<rect x="-3" y="-3" width="6" height="6" fill="none" stroke="#C800C8" stroke-width=".3"/><path d="M-3 3l6-6" stroke="#C0C" stroke-width=".3"/>`, 'INVERSOR'],
    [`<path d="M-4 0h8" stroke="#22B" stroke-width=".5"/>`, 'BARRA'],
    [tierraP(0, -2), 'TIERRA DE PROTECCIÓN'],
    [tierra(0, -3), 'TIERRA DE SERVICIO'],
    [`<path d="M-4 0h8" stroke="#3D6BFF" stroke-width=".5"/>`, 'LÍNEA CORRIENTE CONTINUA'],
    [`<path d="M-4 0h8" stroke="#D9A800" stroke-width=".5"/>`, 'LÍNEA CORRIENTE ALTERNA'],
    [`<path d="M-4 0h8" stroke="#E02020" stroke-width=".5" stroke-dasharray="1.6 1"/>`, 'SUBTERRÁNEA EN CC'],
    [`<path d="M-4 0h8" stroke="#E02020" stroke-width=".5"/>`, 'SUBTERRÁNEA EN CA'],
    [`<rect x="-3" y="-3" width="6" height="6" fill="none" stroke="#009CA8" stroke-width=".3"/>`, 'MEDIDOR'],
    [breaker(0, 0), 'INTERRUPTOR AUTOMÁTICO'], [dif(0, -1.5), 'DIFERENCIAL']
  ];
  it.forEach(([g, n], i) => { const col = i % 2, fila = Math.floor(i / 2), X = x + 8 + col * w / 2, Y = y + 12 + fila * ((h - 14) / Math.ceil(it.length / 2)); s += `<g transform="translate(${X} ${Y})">${g}</g>` + T(X + 7, Y + .8, n, 1.7); });
  return s;
}
function notas(p, D, x, y, w) {
  const extra = [`TIPO DE MÓDULO: ${D.P.tipo.toUpperCase()}.`, `CANTIDAD TOTAL DE MÓDULOS: ${D.nMod}.`, `CANTIDAD TOTAL DE STRINGS: ${D.nStr}.`, `POTENCIA DE CADA MÓDULO: ${D.P.wp} Wp.`, `POTENCIA PEAK DE LA PLANTA: ${fmt(D.kwp, 2)} kWp.`, `POTENCIA NOMINAL DE LA PLANTA: ${fmt(D.kwn, D.kwn % 1 ? 1 : 0)} kW.`];
  const lista = [...(D.L.notas || []), ...extra]; let s = T(x, y, 'NOTAS:', 2.4), yy = y + 5;
  const maxC = Math.floor(w / 1.12);
  lista.forEach((n, i) => { const pal = n.split(' '), lineas = []; let l = ''; pal.forEach(pp => { if ((l + ' ' + pp).length > maxC) { lineas.push(l); l = pp; } else l = l ? l + ' ' + pp : pp; }); lineas.push(l);
    s += T(x, yy, `${i + 1}.`, 1.9); lineas.forEach((ln, j) => { s += T(x + 5, yy + j * 2.6, ln, 1.9); }); yy += lineas.length * 2.6 + .9; });
  return s;
}

/* ---------- Imagen de la planta (render en modo plot) ---------- */
async function imagenPlanta(p, R, SI, vw, vh) {
  await cargarImg(p.img);
  const pts = [];
  p.roofs.forEach(r => pts.push(...r.poly)); p.equipos.forEach(e => pts.push([e.x, e.y])); p.rutas.forEach(r => pts.push(...r.pts)); (p.figuras || []).forEach(f => pts.push(...f.pts)); if (p.norte) pts.push([p.norte.x, p.norte.y]);
  let x0 = 0, y0 = 0, x1 = p.w || 1000, y1 = p.h || 750;
  if (pts.length > 1) { x0 = Math.min(...pts.map(q => q[0])); x1 = Math.max(...pts.map(q => q[0])); y0 = Math.min(...pts.map(q => q[1])); y1 = Math.max(...pts.map(q => q[1])); const m = Math.max(x1 - x0, y1 - y0) * .12; x0 -= m; x1 += m; y0 -= m; y1 += m; }
  // misma proporción que el viewport de la lámina
  const asp = vw / vh; let bw = x1 - x0, bh = y1 - y0; if (bw / bh > asp) { const nh = bw / asp; y0 -= (nh - bh) / 2; bh = nh; } else { const nw = bh * asp; x0 -= (nw - bw) / 2; bw = nw; }
  const im = vistaNitida(p, { x0, y0, bw }, vw, vh, Math.min(6000, Math.round(vw * 12)), { R, SI, fotoAlpha: .62 });
  const s = escala(p), mmPorMmHoja = s ? bw * s / vw : null;   // escala real del viewport
  return { url: im.foto, capa: im.capa, escalaReal: mmPorMmHoja };
}

/* ---------- Lámina 01 y 02 ---------- */
/* Solo el diagrama unilineal, como SVG independiente (bloque "Unilineal" del informe) */
/* parte: 'ac' | 'dc' para el unilineal en dos láminas (ver unilinealEnDos). La hoja DC es más chica
   (260 × 182, misma proporción) para que el inversor y los strings se vean más grandes. */
export function unilinealSVG(p, R, SI, parte) {
  const D = datos(p, R, SI), dc = parte === 'dc' && !p.uni?.libre, [w, h] = p.uni?.libre ? vbLibre(p.uni.libre) : dc ? VB_DC : VB_UNI;
  const dib = p.uni?.libre ? unilineal(p, D, SI, 0, 0, w, h) : dc ? unilineal(p, D, SI, 0, 24, w, h - 24, 'dc') : unilineal(p, D, SI, 0, 4, w, h - 4, parte === 'ac' ? 'ac' : undefined);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><rect width="${w}" height="${h}" fill="#fff"/>${dib}</svg>`;
}
export const VB_DC = [260, 182];
export async function lamina01(p, R, SI) {
  const D = datos(p, R, SI), vx = 400, vy = M + 2, vw = W - M - 2 - vx, vh = 340;
  const img = await imagenPlanta(p, R, SI, vw, vh);
  let s = marco();
  const ku = 1.45, uw = vx - M - 10, uh = 456;
  s += Rc(M + 4, M + 4, uw, uh, { st: '#666', sw: .2 }) + T(M + 7, M + 9, 'LÍMITES DEL PROYECTO', 1.8);
  s += `<g transform="translate(${M + 4} ${M + 4}) scale(${ku})">${unilineal(p, D, SI, 0, 4, uw / ku, uh / ku - 4)}</g>`;
  s += `<image href="${img.url}" x="${vx}" y="${vy}" width="${vw}" height="${vh}" preserveAspectRatio="none"/>` + (img.capa ? `<image href="${img.capa}" x="${vx}" y="${vy}" width="${vw}" height="${vh}" preserveAspectRatio="none"/>` : '') + Rc(vx, vy, vw, vh, { sw: .35 });
  if (img.escalaReal) { const e = Math.round(img.escalaReal / 10) * 10; s += T(vx + 3, vy + vh - 3, `PLANTA DE TECHUMBRE · ESCALA APROX. 1:${e}`, 2.2, { fill: '#111' }); }
  s += simbologia(vx, vy + vh + 6, 160, 62);
  s += notas(p, D, vx + 172, vy + vh + 12, W - M - 4 - (vx + 172));
  s += franja(p, D, '01');
  return svgHoja(s);
}
/* Cuadros de carga: t1 = generación CC (strings), t2 = generación CA (inversor), t3 = caída de tensión del alimentador.
   solo = cada tabla desde 0,0 (para los bloques «Cuadro» del informe). */
function cuadros(D, SI, solo = false) {
  const I = D.inv;
  const filasCC = SI.lista.map(x => ['A', x.nombre, x.P.tipo, x.P.wp, x.P.imp, x.P.voc, x.P.vmp, x.P.isc, '-', x.n, fmt(x.voc, 2), fmt(x.P.imp, 2), fmt(x.pw, 0), '-', '-', `${I.vmin} - ${I.vmax}`, I.isc, x.st.mppt, fmt(x.pw, 0), 'EMT\nFlex. Met.', '32\n32', 'PV1-F', x.seccion, 48, fmt(x.largo, 0), fmt(x.dv, 2), fmt(x.dvp, 2)]);
  while (filasCC.length < 4) filasCC.push(['', `A.${filasCC.length + 1}.1`, 'Libre', ...Array(24).fill('-')]);
  filasCC.push(['TOTAL', SI.lista.filter(x => x.n).length, '-', '-', '-', '-', '-', '-', '-', D.nMod, '-', '-', fmt(SI.pw, 0), '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', fmt(Math.max(0, ...SI.lista.map(x => x.dv)), 2), fmt(Math.max(0, ...SI.lista.map(x => x.dvp)), 2)]);
  const cc = [['UG\nN°', 12], ['N°\nString', 14], ['Tipo\nmódulo', 36], ['Pot. máx.\n[W]', 15], ['I oper.\n[A]', 15], ['Voc\n[V]', 15], ['V oper.\n[V]', 15], ['Icc\n[A]', 15], ['I máx.\ninversa', 15], ['Cant.\nmódulos', 15], ['Voc string\n[V]', 17], ['I máx.\n[A]', 15], ['P máx.\n[W]', 16], ['Fusible\n[A]', 14], ['Diodo\nbloqueo', 14], ['Tensión\nMPPT [V]', 18], ['Icc entrada\n[A]', 17], ['N° Tracker\n(MPPT)', 17], ['P entrada\n[W]', 16], ['Ducto\ntipo', 17], ['Ducto\nØ [mm]', 14], ['Aislación', 15], ['Sección\n[mm²]', 14], ['I máx.\n[A]', 13], ['Largo\n[m]', 13], ['ΔV\n[V]', 13], ['ΔV\n[%]', 13]].map(([h, w]) => ({ h, w }));
  const t1 = tabla(0, 0, 'CUADRO DE UNIDAD DE GENERACIÓN FOTOVOLTAICA / STRING - CC', cc, filasCC, { cab: 9, fila: 9, fs: 1.75, tit: 4 });
  const ca = D.ca, t0 = ca.tramos[0];
  const filasCA = SI.lista.map((x, i) => ['A', x.nombre, fmt(x.pw, 0), i ? '' : I.vac, i ? '' : 'Perfil de Red Chileno\nNo modificable por el usuario', i ? '' : `${I.marca}\n${I.modelo}`, i ? '' : (D.L.disyuntor || disyDef(D)), i ? '' : (D.L.diferencial || difDef(D)), i ? '' : 'EMT\nFlex. Met.', i ? '' : '32', i ? '' : 'RVK Reviflex', i ? '' : '3x8,37 (F)\n1x8,37 (N)', i ? '' : 59, i ? '' : fmt(t0.largo, 0), i ? '' : fmt(t0.dv, 2), i ? '' : fmt(t0.dvp, 2)]);
  filasCA.push(['TOTAL', SI.lista.filter(x => x.n).length, fmt(SI.pw, 0), I.vac, '-', '-', '-', '-', '-', '-', '-', '-', '-', fmt(t0.largo, 0), fmt(t0.dv, 2), fmt(t0.dvp, 2)]);
  const cca = [['UG\nN°', 14], ['N°\nString', 16], ['Potencia\nmáx. [W]', 20], ['Tensión\nalterna [V]', 20], ['Perfil de red', 60], ['Modelo y marca', 40], ['Disyuntor', 32], ['Diferencial', 36], ['Ducto tipo', 22], ['Ducto Ø\n[mm]', 16], ['Aislación', 26], ['Sección\n[mm²]', 26], ['I máx.\n[A]', 16], ['Largo\n[m]', 16], ['ΔV\n[V]', 16], ['ΔV\n[%]', 16]].map(([h, w]) => ({ h, w }));
  const t2 = tabla(solo ? 0 : (t1.w - 388) / 2, solo ? 0 : 12 + t1.h, 'CUADRO DE UNIDAD DE GENERACIÓN FOTOVOLTAICA / INVERSOR - CA', cca, filasCA, { cab: 9, fila: 9, fs: 1.8, tit: 4 });
  const peor = SI.lista.reduce((m, x) => x.dv > (m ? m.dv : -1) ? x : m, null);
  const fCaida = [
    ['UG - Inversor A', '-', peor ? fmt(peor.vmp, 2) : '-', '-', 'PV1-F', peor ? `2x${peor.seccion} (P) 2x${peor.seccion} (N)` : '-', 48, peor ? fmt(peor.largo, 0) : '-', 'EMT / Flex. Met.', 32, peor ? fmt(peor.dv, 2) : '-', peor ? fmt(peor.dvp, 2) : '-'],
    ...ca.tramos.map(t => [t.nombre, t.prot, '-', I.vac, 'RVK Reviflex Monopolar', '3x8,37 (F) 1x8,37 (N)', 59, fmt(t.largo, 0), t.ducto, 32, fmt(t.dv, 2), fmt(t.dvp, 2)]),
    ['TOTAL', '-', peor ? fmt(peor.vmp, 2) : '-', I.vac, '-', '-', '-', fmt(ca.tramos.reduce((a, t) => a + t.largo, 0), 0), '-', '-', fmt(ca.total, 2), fmt(ca.totalP + (peor ? peor.dvp : 0), 2)],
    ['MÁXIMO POR NORMATIVA', '-', '-', '-', '-', '-', '-', '-', '-', '-', fmt(I.vac * CAIDA_MAX / 100, 1), CAIDA_MAX]
  ];
  const cc3 = [['Tramos del alimentador', 46], ['Capacidad de\nprotección [A]', 26], ['Tensión UG\nen CC [V]', 24], ['Tensión UG\nen CA [V]', 24], ['Tipo de aislación', 36], ['Sección [mm²]', 40], ['I máx. de\ntransporte [A]', 26], ['Largo\n[m]', 16], ['Canalización', 36], ['Ø [mm]', 14], ['ΔV [V]', 16], ['ΔV [%]', 16]].map(([h, w]) => ({ h, w }));
  const t3 = tabla(solo ? 0 : (t1.w - 336) / 2, solo ? 0 : 24 + t1.h + t2.h, 'CUADRO DE CAÍDA DE TENSIÓN DEL ALIMENTADOR UG EN CA', cc3, fCaida, { cab: 9, fila: 8, fs: 1.8, tit: 4 });
  return { t1, t2, t3 };
}
export async function lamina02(p, R, SI) {
  const D = datos(p, R, SI); let s = marco();
  const { t1, t2, t3 } = cuadros(D, SI), tb = t1.svg + t2.svg + t3.svg;
  const kt = Math.min((W - 2 * M - 30) / t1.w, (440 - 20) / (24 + t1.h + t2.h + t3.h));
  s += `<g transform="translate(${(W - t1.w * kt) / 2} ${M + 14}) scale(${kt})">${tb}</g>`;
  const yN = M + 14 + (24 + t1.h + t2.h + t3.h) * kt + 10;
  if (yN < 440) s += notas(p, D, M + 20, yN, 420);
  s += franja(p, D, '02');
  return svgHoja(s);
}
const marco = () => `<rect width="${W}" height="${H}" fill="#fff"/>` + Rc(M, M, W - 2 * M, H - 2 * M, { sw: .5 });
const svgHoja = s => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" class="hoja">${s}</svg>`;

/* ---------- Piezas de lámina para los bloques del informe (unidades: mm de una hoja A1) ---------- */
const svgPieza = (vb, s, ajuste = 'xMidYMid meet') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="${ajuste}">${s}</svg>`;
/* Marco, título y cajetín de una lámina. o = { titulo, n, total, lista: [[n°, descripción]], int, escala, formato } */
export function cajetinSVG(p, R, SI, o) {
  const D = datos(p, R, SI);
  return svgPieza(`0 0 ${W} ${H}`, marco() + T(W / 2, M + 14, o.titulo, 8, { a: 'middle', attr: 'letter-spacing=".6"' }) + franja(p, D, o), 'none');
}
export const simbologiaSVG = (w, h) => svgPieza(`0 0 ${w} ${h}`, simbologia(.2, .2, w - .4, h - .4));
export function notasSVG(p, R, SI, w, h) { const D = datos(p, R, SI); return svgPieza(`0 0 ${w} ${h}`, notas(p, D, 1, 4, w - 2), 'xMinYMin meet'); }
export function cuadroSVG(p, R, SI, k = 'cc') {
  const t = cuadros(datos(p, R, SI), SI, true)[{ cc: 't1', ca: 't2', caida: 't3' }[k] || 't1'];
  return svgPieza(`-.5 -.5 ${t.w + 1} ${t.h + 1}`, t.svg, 'xMidYMin meet');
}

/* Croquis de ubicación desde las coordenadas (latitud ; longitud): mapa de OpenStreetMap con el punto
   del proyecto, como imagen guardada en el proyecto (después no necesita internet). */
export async function generarCroquis(latlon, z = 16) {
  const t = String(latlon || '').trim(), partes = t.includes(';') ? t.split(';') : t.split(/,\s+|\s+/);
  const [lat, lon] = partes.map(x => parseFloat(String(x).trim().replace(',', '.')));
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error('Las coordenadas no se entienden. Escríbelas como «-33,41 ; -70,57».');
  const n = 2 ** z, px = (lon + 180) / 360 * n * 256, r = lat * Math.PI / 180, py = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * 256;
  const S = 600, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#eee'; g.fillRect(0, 0, S, S);
  const x0 = px - S / 2, y0 = py - S / 2, tiles = [];
  for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + S) / 256); tx++) for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + S) / 256); ty++) tiles.push([tx, ty]);
  const carga = ([tx, ty]) => new Promise((ok, mal) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { g.drawImage(im, tx * 256 - x0, ty * 256 - y0); ok(); }; im.onerror = () => mal(new Error('No se pudo descargar el mapa (¿hay internet?)')); im.src = `https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png`; });
  await Promise.all(tiles.map(carga));
  g.fillStyle = '#E5484D'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, 11, 0, 7); g.fill(); g.stroke();
  g.font = '15px Arial'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(S - 150, S - 22, 150, 22); g.fillStyle = '#333'; g.fillText('© OpenStreetMap', S - 140, S - 6);
  return c.toDataURL('image/jpeg', .85);
}

/* ---------- Vista y panel del paso Lámina ---------- */
export async function vistaLamina(el, p, R, SI) {
  cur = { ...cur, p, R, SI };
  el.innerHTML = `<div class="lam-bar"><div class="seg"><button data-act="lam-hoja" data-k="1" aria-pressed="${cur.hoja === 1}">Lámina 01 · Planta y unilineal</button><button data-act="lam-hoja" data-k="2" aria-pressed="${cur.hoja === 2}">Lámina 02 · Cuadros de carga</button></div>
    <div class="lam-z"><button data-act="lam-z" data-k="-1">−</button><span>${Math.round(cur.zoom * 100)} %</span><button data-act="lam-z" data-k="1">+</button></div></div>
    <div class="lam-scroll"><div class="lam-papel" style="width:${cur.zoom * 100}%">Generando lámina…</div></div>`;
  const svg = cur.hoja === 1 ? await lamina01(p, R, SI) : await lamina02(p, R, SI);
  const pap = el.querySelector('.lam-papel'); if (pap) pap.innerHTML = svg;
}
export function panelLamina(p, R, SI, cb = {}) {
  cur = { ...cur, p, R, SI, cambio: cb.cambio || cur.cambio, rerender: cb.rerender || cur.rerender, repintar: cb.repintar || null }; const L = p.lamina, D = datos(p, R, SI);
  const f = (k, l, ph = '') => `<label class="f"><span>${l}</span><input class="in" data-lam="${k}" value="${esc(L[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  const fp = (k, l, ph = '') => `<label class="f"><span>${l}</span><input class="in" data-pro="${k}" value="${esc(p[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  const av = [];
  if (!escala(p)) av.push('Falta la escala (paso 1).'); if (!R.n) av.push('No hay paneles (paso 4).');
  if (SI.sinString) av.push(`${SI.sinString} paneles sin string (paso 5).`); SI.lista.filter(x => !x.ok).forEach(x => av.push(`String ${x.idx + 1}: ${x.av.join('; ')}`));
  if (!p.equipos.some(e => e.k === 'inv')) av.push('No se ubicó el inversor (paso 6).');
  return `<details class="pp"><summary>Lámina</summary><div class="pp-b">
    <div class="kpis"><div><b>${D.nMod}</b><span>módulos</span></div><div><b>${fmt(D.kwp, 2)}</b><span>kWp</span></div><div><b>${fmt(D.kwn, 0)}</b><span>kW nom.</span></div></div>
    ${av.length ? `<div class="aviso warn">${ic('alert', 16)}<span>${av.map(esc).join('<br>')}</span></div>` : `<div class="aviso ok">${ic('check', 16)}<span>Diseño completo y sin observaciones.</span></div>`}
    <button class="btn pri" data-act="lam-pdf">${ic('print')} Imprimir / guardar PDF (A1)</button>
    <button class="btn" data-act="lam-dxf">${ic('download')} Exportar DXF para AutoCAD</button>
    <button class="btn" data-act="lam-svg">${ic('download')} Descargar lámina (SVG)</button>
  </div></details>
  <details class="pp" open><summary>Proyecto</summary><div class="pp-b">
    ${fp('codigo', 'Código', 'ON 921')}${fp('cliente', 'Cliente', 'Nombre del cliente')}${fp('direccion', 'Dirección')}${fp('comuna', 'Comuna')}${fp('region', 'Región')}${fp('distrib', 'Distribuidora', 'ENEL, CGE…')}
    ${f('propietario', 'Propietario')}${f('rutProp', 'RUT propietario')}${f('latlon', 'Latitud y longitud', '-35.82 ; -71.57')}
    <div class="f"><span>Croquis de ubicación</span><div class="row wrap"><button class="btn sm" data-act="lam-croquis">${L.croquis ? 'Volver a generar' : 'Generar con las coordenadas'}</button><label class="btn sm">Subir imagen<input type="file" accept="image/*" data-lam-croquis hidden></label>${L.croquis ? '<button class="btn sm" data-act="lam-croquis-del">Quitar</button>' : ''}</div>
      ${L.croquis ? `<img src="${L.croquis}" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:50%;margin-top:6px">` : ''}<p class="mut">Se genera con el mapa de OpenStreetMap (necesita internet; al servicio de mapas solo se le piden las calles de esa zona). Queda guardado en el proyecto.</p></div>
  </div></details>
  <details class="pp"><summary>Cajetín y firmas</summary><div class="pp-b">
    ${f('jefe', 'Jefe de proyecto')}${f('ingeniero', 'Ingeniero en terreno')}${f('proyectista', 'Proyectista')}${f('instalador', 'Instalador')}${f('rutInst', 'RUT instalador')}
    ${f('escala', 'Escala de la lámina 01', '1:100')}${f('fechaLamina', 'Fecha', hoy())}
    <div class="sub">Revisiones</div>
    ${(L.revs || []).map((r, i) => `<div class="row rev"><input class="in" data-rev="${i}" data-k="v" value="${esc(r.v)}" style="width:44px"><input class="in" data-rev="${i}" data-k="fecha" value="${esc(r.fecha)}" style="width:96px"><input class="in" data-rev="${i}" data-k="desc" value="${esc(r.desc)}"><button class="btn sm del" data-act="lam-rev-del" data-i="${i}" title="Quitar">${ic('trash', 14)}</button></div>`).join('')}
    <button class="btn sm" data-act="lam-rev-add">${ic('plus', 14)} Nueva revisión</button>
  </div></details>
  <details class="pp"><summary>Protecciones y tierra</summary><div class="pp-b">
    ${f('disyuntor', 'Disyuntor', disyDef(D))}${f('marcaDisy', 'Marca del disyuntor', 'Schneider')}${f('diferencial', 'Diferencial', difDef(D))}${f('marcaDif', 'Marca del diferencial', 'CHINT')}${f('tierraR', 'Resistencia de tierra (Ω)', '18,3')}
    ${f('largo_inv-tg', 'Largo Inversor – TGFV (m)', `${fmt(D.ca.tramos[0].auto, 0)} según el dibujo`)}${f('largo_tg-emp', 'Largo TG – Empalme (m)', `${fmt(D.ca.tramos[1].auto, 0)} según el dibujo`)}
  </div></details>
  <details class="pp"><summary>Notas</summary><div class="pp-b">
    <textarea class="in" rows="9" data-lam="notas">${esc((L.notas || []).join('\n'))}</textarea>
    <p class="mut">Una nota por línea. Las de cantidad de módulos, strings y potencias se agregan solas.</p>
  </div></details>`;
}
let tVista = null;
/* Después de editar el cajetín: redibujar la lámina (paso antiguo) o la página del informe donde está */
function refrescarHoja() { clearTimeout(tVista); tVista = setTimeout(() => { const el = document.getElementById('laminaWrap'); if (el && cur.p) vistaLamina(el, cur.p, cur.R, cur.SI); else if (cur.repintar) cur.repintar(); }, 450); }
document.addEventListener('input', ev => {
  const t = ev.target; if (!cur.p || !(document.getElementById('laminaWrap') || document.getElementById('informeWrap'))) return;
  const p = cur.p, L = p.lamina;
  if (t.dataset.lam) { const k = t.dataset.lam; if (k === 'notas') L.notas = t.value.split('\n').map(x => x.trim()).filter(Boolean); else if (k.startsWith('largo_')) { const n = parseFloat(t.value.replace(',', '.')); if (isFinite(n)) L[k] = n; else delete L[k]; } else L[k] = t.value; }
  else if (t.dataset.pro) p[t.dataset.pro] = t.value;
  else if (t.dataset.rev != null) L.revs[+t.dataset.rev][t.dataset.k] = t.value;
  else return;
  cur.cambio && cur.cambio(); refrescarHoja();
});
/* Croquis subido como imagen (se achica a 600 px) */
document.addEventListener('change', async ev => {
  const t = ev.target; if (!t.matches?.('[data-lam-croquis]') || !t.files[0] || !cur.p) return;
  const url = URL.createObjectURL(t.files[0]), im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
  URL.revokeObjectURL(url); if (!im) return toast('No se pudo leer la imagen');
  const f = Math.min(1, 600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * f); c.height = Math.round(im.naturalHeight * f);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cur.p.lamina.croquis = c.toDataURL('image/jpeg', .85);
  cur.cambio && cur.cambio(); cur.rerender && cur.rerender(); refrescarHoja();
});
export function accionLamina(a, b, p, cambio, rerender) {
  cur.cambio = cambio; cur.rerender = rerender;
  if (a === 'lam-hoja') { cur.hoja = +b.dataset.k; refrescarHoja(); clearTimeout(tVista); vistaLamina(document.getElementById('laminaWrap'), cur.p, cur.R, cur.SI); return true; }
  if (a === 'lam-z') { cur.zoom = Math.max(.5, Math.min(4, cur.zoom * (+b.dataset.k > 0 ? 1.25 : .8))); vistaLamina(document.getElementById('laminaWrap'), cur.p, cur.R, cur.SI); return true; }
  if (a === 'lam-rev-add') { const L = p.lamina, ult = L.revs[L.revs.length - 1]; const sig = ult ? (isNaN(ult.v) ? (ult.v === 'A' ? 'B' : String.fromCharCode(ult.v.charCodeAt(0) + 1)) : String(+ult.v + 1)) : 'A'; L.revs.push({ v: sig, fecha: hoy(), desc: 'EMITIDO PARA REVISIÓN' }); cambio(); rerender(); return true; }
  if (a === 'lam-rev-del') { p.lamina.revs.splice(+b.dataset.i, 1); cambio(); rerender(); return true; }
  if (a === 'lam-pdf') { imprimir(p); return true; }
  if (a === 'lam-croquis') { toast('Generando el croquis…'); generarCroquis(p.lamina.latlon).then(u => { p.lamina.croquis = u; cambio(); rerender(); refrescarHoja(); toast('Croquis listo'); }).catch(e => toast(e.message)); return true; }
  if (a === 'lam-croquis-del') { delete p.lamina.croquis; cambio(); rerender(); refrescarHoja(); return true; }
  if (a === 'lam-svg') { (cur.hoja === 1 ? lamina01 : lamina02)(p, cur.R, cur.SI).then(s => descargar(`${nombreArch(p)}_lamina_0${cur.hoja}.svg`, s.replace('href="assets/nikola-logo-oscuro.svg"', `href="${location.origin}${location.pathname.replace(/[^/]*$/, '')}assets/nikola-logo-oscuro.svg"`), 'image/svg+xml')); return true; }
  if (a === 'lam-dxf') { descargar(`${nombreArch(p)}.dxf`, dxf(p, cur.R, cur.SI), 'application/dxf'); toast('DXF descargado: unidades en milímetros'); return true; }
  return false;
}
const nombreArch = p => (p.codigo || 'proyecto').replace(/\s+/g, '_') + (p.cliente ? '_' + p.cliente.replace(/\s+/g, '_') : '');

async function imprimir(p) {
  toast('Preparando las láminas…');
  const [a, b] = [await lamina01(p, cur.R, cur.SI), await lamina02(p, cur.R, cur.SI)];
  const w = window.open('', '_blank'); if (!w) return toast('El navegador bloqueó la ventana: permite ventanas emergentes');
  const base = location.href.replace(/[^/]*$/, '');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><title>${esc(nombreArch(p))} — Láminas</title>
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <style>@page{size:841mm 594mm;margin:0}html,body{margin:0;background:#666}svg{display:block;width:841mm;height:594mm;margin:0 auto 10mm;background:#fff}
    @media print{body{background:none}svg{margin:0;page-break-after:always}}.aviso{font:14px sans-serif;color:#fff;text-align:center;padding:10px}@media print{.aviso{display:none}}</style></head>
    <body><div class="aviso">En el diálogo de impresión elige “Guardar como PDF” y tamaño A1 (o “Tamaño real”).</div>${a}${b}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),600))<\/script></body></html>`);
  w.document.close();
}

/* ---------- DXF (AutoCAD R12, unidades mm, Y hacia arriba) ---------- */
function dxf(p, R, SI) {
  const s = escala(p) || 1, X = q => (q[0] * s).toFixed(1), Y = q => ((p.h - q[1]) * s).toFixed(1);
  const capas = [['TECHOS', 7], ['ZONAS', 1], ['PANELES', 3], ['STRINGS', 4], ['CANAL-CC', 5], ['CANAL-CA', 1], ['CANAL-SUB', 30], ['TIERRA', 8], ['EQUIPOS', 6], ['COTAS', 2], ['TEXTOS', 7], ['FIGURAS', 2]];
  let e = '';
  const poly = (pts, capa, cerrar = true, color) => { e += `0\nPOLYLINE\n8\n${capa}\n${color ? `62\n${color}\n` : ''}66\n1\n70\n${cerrar ? 1 : 0}\n`; pts.forEach(q => { e += `0\nVERTEX\n8\n${capa}\n10\n${X(q)}\n20\n${Y(q)}\n30\n0\n`; }); e += '0\nSEQEND\n'; };
  const txt = (q, h, t, capa, c = false, ang = 0) => { e += `0\nTEXT\n8\n${capa}\n10\n${X(q)}\n20\n${Y(q)}\n30\n0\n40\n${h}\n1\n${String(t).replace(/\n/g, ' ')}\n${ang ? `50\n${ang}\n` : ''}${c ? `72\n1\n11\n${X(q)}\n21\n${Y(q)}\n31\n0\n` : ''}`; };
  p.roofs.filter(r => r.closed).forEach(r => poly(r.poly, 'TECHOS'));
  p.zonas.forEach(z => poly(zonaPoly(z), 'ZONAS'));
  const strDe = new Map(); SI.lista.forEach(x => x.st.panels.forEach(k => strDe.set(k, x)));
  R.validos.forEach(pn => { poly(pn.q, 'PANELES'); const x = strDe.get(pn.key); if (x) txt(centroid(pn.q), 180, x.st.numTxt || x.etq, 'STRINGS', true); });
  const cols = [4, 6, 3, 2, 30, 5, 210, 130];
  SI.lista.forEach((x, i) => { const pts = x.st.panels.map(k => R.porKey.get(k)).filter(Boolean).flatMap(pn => pn.q); if (pts.length > 2) { const h = hull(pts); poly(h, 'STRINGS', true, cols[i % cols.length]); const top = h.reduce((m, q) => q[1] < m[1] ? q : m, h[0]); txt([top[0], top[1] - 400 / s], 300, `String ${i + 1}`, 'STRINGS'); } });
  p.rutas.forEach(r => poly(r.pts, { cc: 'CANAL-CC', ca: 'CANAL-CA', sub: 'CANAL-SUB', tie: 'TIERRA' }[r.k] || 'CANAL-CA', false));
  p.equipos.forEach(q => { const Q = EQUIPOS[q.k] || EQUIPOS.inv, md = medidaEquipo(p, q), w = md.w / s, h = md.h / s, a = (q.ang || 0) * Math.PI / 180; const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(v => [q.x + v[0] * Math.cos(a) - v[1] * Math.sin(a), q.y + v[0] * Math.sin(a) + v[1] * Math.cos(a)]); poly(pts, 'EQUIPOS'); txt([q.x + w / 2 + 100 / s, q.y], 200, q.rotulo || Q.n, 'EQUIPOS'); });
  (p.figuras || []).forEach(f => { if (f.pts.length < 2) return;
    if (f.f === 'circ') e += `0\nCIRCLE\n8\nFIGURAS\n10\n${X(f.pts[0])}\n20\n${Y(f.pts[0])}\n30\n0\n40\n${(dist(f.pts[0], f.pts[1]) * s).toFixed(1)}\n`;
    else poly(f.f === 'rect' ? rectDe(f.pts[0], f.pts[1]) : f.pts, 'FIGURAS', esCerrada(f)); });
  p.cotas.forEach(c => { poly([c.a, c.b], 'COTAS', false); txt([(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2], 200, textoCota(p, c), 'COTAS', true); });
  p.textos.forEach(t => { const h = t.h || 400, ang = t.guia ? 0 : (t.ang || 0), a = ang * Math.PI / 180, d = h / s * 1.45;   // un TEXT por renglón, con su giro
    String(t.s).split('\n').forEach((l, i) => txt([t.p[0] + i * d * Math.sin(a), t.p[1] + i * d * Math.cos(a)], h, l, 'TEXTOS', false, ang)); });
  const tabla = capas.map(([n, c]) => `0\nLAYER\n2\n${n}\n70\n0\n62\n${c}\n6\nCONTINUOUS\n`).join('');
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${capas.length}\n${tabla}0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${e}0\nENDSEC\n0\nEOF\n`;
}
