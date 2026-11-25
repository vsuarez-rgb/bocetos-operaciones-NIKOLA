/* ==========================================================================
   Unilineal como dibujo editable (p.uni.libre = { elems: [...] }).
   Cuando se edita a mano, el unilineal base se "descompone" en elementos que
   se pueden seleccionar, mover, copiar, pegar y borrar, como en AutoCAD.
   Unidades: mm del unilineal (viewBox 336 × 240, horizontal como los planos de Ops, con el flujo de arriba hacia abajo;
   los dibujos a mano anteriores guardan su hoja en L.vb o usan la antigua 262 × 314).
     linea  { t:'l', pts:[[x,y]…], c, w, dash }
     rect   { t:'r', x, y, w, h, c, fill, sw, dash }
     texto  { t:'x', x, y, s, size, a, b, it, c }
     svg    { t:'s', svg, x, y }   símbolo o pieza (el svg está dibujado en torno a 0,0 + su x,y)
   Bloques guardados: conjuntos de elementos con su punto base en 0,0.
   ========================================================================== */
import { esc } from './util.js';

const FONT = "'Archivo Narrow','Arial Narrow',Arial,sans-serif";
export const VB_UNI = [336, 240];
export const vbLibre = L => (L && L.vb) || [262, 314];

/* Colores de línea (los de los planos) */
export const COLORES_LINEA = [
  { k: 'ca', n: 'CA (fase)', c: '#DD1111' }, { k: 'cc', n: 'CC', c: '#3D6BFF', dash: '1.5 1' }, { k: 'barra', n: 'Barra', c: '#2222BB', w: .4 },
  { k: 'tierra', n: 'Tierra', c: '#111111', dash: '2 1' }, { k: 'sub', n: 'Subterránea', c: '#FF8A00', dash: '.6 .9' }, { k: 'neg', n: 'Negro', c: '#111111' },
  { k: 'mag', n: 'Magenta', c: '#CC00CC' }, { k: 'ama', n: 'Amarillo', c: '#E6C200' }, { k: 'ver', n: 'Verde', c: '#1A8F3C' }, { k: 'cia', n: 'Cian', c: '#00AAAA' }, { k: 'gris', n: 'Gris', c: '#888888' }
];

/* ---------- Dibujo ---------- */
const attrsTexto = e => `font-size="${e.size || 1.6}" font-family="${FONT}" ${e.it !== false ? 'font-style="italic"' : ''} ${e.b ? 'font-weight="700"' : ''} text-anchor="${e.a || 'start'}" fill="${e.c || '#111'}"`;
export function svgElem(e) {
  if (e.t === 'l') return `<polyline points="${e.pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${e.c || '#111'}" stroke-width="${e.w || .3}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ''} stroke-linejoin="round"/>`;
  if (e.t === 'r') return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.rx || 0}" fill="${e.fill || 'none'}" stroke="${e.c || '#111'}" stroke-width="${e.sw || .3}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ''}/>`;
  if (e.t === 'x') return `<text x="${e.x}" y="${e.y}" ${attrsTexto(e)}>${esc(e.s)}</text>`;
  if (e.t === 's') return `<g transform="translate(${e.x || 0} ${e.y || 0})">${e.svg}</g>`;
  return '';
}
/* Para la lámina, el informe y la vista: el dibujo completo */
export const dibujoLibre = L => (L.elems || []).map(svgElem).join('');
/* En el editor: cada elemento con su índice, y un trazo ancho invisible para poder pincharlo */
export function dibujoLibreEditor(L, sel) {
  return (L.elems || []).map((e, i) => {
    const toque = e.t === 'l' ? `<polyline points="${e.pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="transparent" stroke-width="2.4"/>` : e.t === 'r' ? `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="transparent" stroke-width="2.4"/>` : '';
    return `<g data-i="${i}" class="ue${sel && sel.has(i) ? ' sel' : ''}">${svgElem(e)}${toque}</g>`;
  }).join('');
}

/* ---------- Pasar el unilineal generado (SVG) a elementos ---------- */
export function descomponer(svgTexto) {
  const doc = new DOMParser().parseFromString(svgTexto, 'image/svg+xml'), raiz = doc.documentElement, elems = [];
  const num = (el, a) => parseFloat(el.getAttribute(a)) || 0;
  [...raiz.children].forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    if (i === 0 && tag === 'rect' && el.getAttribute('fill') === '#fff') return;          // el fondo blanco
    if (tag === 'line') elems.push({ t: 'l', pts: [[num(el, 'x1'), num(el, 'y1')], [num(el, 'x2'), num(el, 'y2')]], c: el.getAttribute('stroke') || '#111', w: num(el, 'stroke-width') || .25, dash: el.getAttribute('stroke-dasharray') || undefined });
    else if (tag === 'rect') elems.push({ t: 'r', x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height'), c: el.getAttribute('stroke') || '#111', fill: el.getAttribute('fill') || 'none', sw: num(el, 'stroke-width') || .25, dash: el.getAttribute('stroke-dasharray') || undefined });
    else if (tag === 'text') { if (!el.textContent.trim()) return; elems.push({ t: 'x', x: num(el, 'x'), y: num(el, 'y'), s: el.textContent, size: num(el, 'font-size') || 1.6, a: el.getAttribute('text-anchor') || 'start', b: el.getAttribute('font-weight') === '700', it: el.getAttribute('font-style') === 'italic', c: el.getAttribute('fill') || '#111' }); }
    else { el.removeAttribute('data-u'); elems.push({ t: 's', x: 0, y: 0, svg: new XMLSerializer().serializeToString(el).replace(/ xmlns="[^"]*"/g, '') }); }
  });
  return elems;
}

/* ---------- Mover, copiar, caja ---------- */
export function mover(e, dx, dy) {
  if (e.t === 'l') e.pts = e.pts.map(q => [r2(q[0] + dx), r2(q[1] + dy)]);
  else { e.x = r2((e.x || 0) + dx); e.y = r2((e.y || 0) + dy); }
}
const r2 = v => Math.round(v * 100) / 100;
export const clonar = es => JSON.parse(JSON.stringify(es));
/* Lleva un conjunto a que su esquina superior izquierda quede en 0,0 (para guardarlo como bloque) */
export function normalizar(es, caja) { const c = clonar(es); c.forEach(e => mover(e, -caja.x, -caja.y)); return c; }

/* ---------- Símbolos (en torno a 0,0) ---------- */
const V = '#1A8F3C', MG = '#CC00CC';
const brk = `<path d="M0 -4v1.5M0 4v-1.5" stroke="#111" stroke-width=".3"/><path d="M0 2.5c-2 -1.5 -2 -3.5 0 -5" fill="none" stroke="${V}" stroke-width=".4"/><circle cx="0" cy="2.6" r=".6" fill="none" stroke="${V}" stroke-width=".25"/>`;
const txt = (x, y, s, size = 1.5, o = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-family="${FONT}" ${o.it === false ? '' : 'font-style="italic"'} ${o.b ? 'font-weight="700"' : ''} text-anchor="${o.a || 'start'}" fill="${o.c || '#111'}">${esc(s)}</text>`;
export const SIMBOLOS = {
  interruptor: { n: 'Interruptor', svg: brk },
  diferencial: { n: 'Diferencial', svg: `<rect x="-2.5" y="-2.5" width="5" height="5" fill="#fff" stroke="#111" stroke-width=".3"/><path d="M-2.5 2.5L2.5 -2.5" stroke="#111" stroke-width=".2"/>${txt(-1.9, -.4, 'P', 1.6, { it: false, b: true })}${txt(.4, 2, 'D', 1.6, { it: false, b: true })}` },
  inversor: { n: 'Inversor', svg: `<rect x="-5" y="-5" width="10" height="10" fill="#FCE5FC" stroke="${MG}" stroke-width=".3"/><path d="M-5 5L5 -5" stroke="${MG}" stroke-width=".3"/>${txt(-3, -1, '~', 3, { it: false, c: MG })}${txt(1, 4, '=', 2.6, { it: false, c: MG })}` },
  mppt: { n: 'MPPT', svg: `<rect x="-4" y="-3" width="8" height="6" fill="none" stroke="${MG}" stroke-width=".3"/>${txt(0, 0, 'MPPT', 1.4, { a: 'middle', it: false })}${txt(0, 2.2, '1', 1.4, { a: 'middle', it: false })}` },
  modulo: { n: 'Módulo FV', svg: `<rect x="-3.5" y="-3.5" width="7" height="7" fill="#E6F6EA" stroke="${V}" stroke-width=".3"/><path d="M-3.5 -3.5l3.5 4 3.5-4" fill="none" stroke="${V}" stroke-width=".3"/>` },
  tierra: { n: 'Tierra de servicio', svg: `<path d="M0 0v3M-3 3h6M-2 4.2h4M-1 5.4h2" stroke="#111" stroke-width=".3"/>` },
  tierraP: { n: 'Tierra de protección', svg: `<path d="M0 0v2M-3 2h6" stroke="#111" stroke-width=".3"/>` + Array.from({ length: 5 }, (_, i) => `<path d="M${-3 + i * 1.5} 2l-1 1.5" stroke="#111" stroke-width=".2"/>`).join('') },
  medidor: { n: 'Medidor', svg: `<rect x="-5" y="-5" width="10" height="10" fill="#C8F3F7" stroke="#00AAAA" stroke-width=".3"/>${txt(0, 1.6, 'M', 4, { a: 'middle', it: false, c: '#00AAAA' })}` },
  consumo: { n: 'Consumo', svg: `<circle r="1.5" fill="none" stroke="#111" stroke-width=".2"/>${txt(0, .6, 'C', 1.7, { a: 'middle', it: false })}` },
  cargador: { n: 'Cargador EV', svg: `<rect x="-6" y="0" width="12" height="15" rx="3" fill="#F2F2F2" stroke="#111" stroke-width=".3"/><circle cx="0" cy="6" r="3" fill="none" stroke="#111" stroke-width=".3"/>${txt(0, 6.9, 'EV', 2, { a: 'middle', it: false, b: true })}` },
  bateria: { n: 'Batería', svg: `<rect x="-10" y="-8" width="20" height="16" fill="#EAF6EE" stroke="#52A06F" stroke-width=".35"/>${txt(0, -1.5, 'BATERÍA', 1.7, { a: 'middle', b: true })}` },
  dcswitch: { n: 'DC switch (+ −)', svg: `<rect x="-6" y="-7" width="12" height="14" fill="none" stroke="${MG}" stroke-width=".3"/><path d="M-6 -1h12" stroke="${MG}" stroke-width=".3"/><path d="M-1 -2.5l2 -3" stroke="${V}" stroke-width=".35"/><circle cx="-1" cy="-2.5" r=".4" fill="${V}"/>${txt(-3.5, 3.5, '+', 3, { a: 'middle', it: false })}${txt(3.5, 3.5, '−', 3, { a: 'middle', it: false })}` },
  barraT: { n: 'Barra de tierra', svg: `<path d="M-6 0h12" stroke="#2222BB" stroke-width=".45"/><circle cx="-4" cy="0" r=".5" fill="#2222BB"/><circle cx="4" cy="0" r=".5" fill="#2222BB"/>` },
  fusible: { n: 'Fusible', svg: `<rect x="-1.2" y="-3" width="2.4" height="6" fill="none" stroke="#111" stroke-width=".3"/><path d="M0 -4.5v9" stroke="#111" stroke-width=".25"/>` },
  tablero: { n: 'Tablero (recuadro amarillo)', rect: { w: 60, h: 30, c: '#E6C200', sw: .4 } },
  caja: { n: 'Recuadro magenta', rect: { w: 50, h: 30, c: '#CC00CC', sw: .35 } },
  limite: { n: 'Límite del proyecto', rect: { w: 120, h: 90, c: '#888888', sw: .25 } }
};
/* Un símbolo como elementos: el dibujo + sus rótulos (textos sueltos, editables) */
export function elemsSimbolo(k, x, y) {
  const S = SIMBOLOS[k]; if (!S) return [];
  if (S.rect) return [{ t: 'r', x: x - S.rect.w / 2, y: y - S.rect.h / 2, w: S.rect.w, h: S.rect.h, c: S.rect.c, sw: S.rect.sw, fill: 'none' }];
  return [{ t: 's', x, y, svg: S.svg }];
}

/* ---------- Bloques incluidos (conjuntos que se repiten en los planos) ---------- */
const T = (x, y, s, size = 1.6, o = {}) => ({ t: 'x', x, y, s, size, a: o.a || 'start', b: !!o.b, it: o.it !== false, c: o.c || '#111' });
const L = (pts, c = '#DD1111', w = .3, dash) => ({ t: 'l', pts, c, w, ...(dash ? { dash } : {}) });
const R = (x, y, w, h, c, sw = .35, fill = 'none') => ({ t: 'r', x, y, w, h, c, sw, fill });
const S = (k, x, y) => ({ t: 's', x, y, svg: SIMBOLOS[k].svg });
const interruptorRot = (x, y, l1, l2, l3, l4) => [S('interruptor', x, y), ...[l1, l2, l3, l4].filter(Boolean).map((l, i) => T(x + 3, y - 2.5 + i * 2.1, l, 1.5))];
function smartGuard() {
  const e = [R(0, 0, 90, 46, '#CC00CC'), T(86, 42, 'Smart Guard', 3, { a: 'end', b: true }),
    L([[6, 14], [18, 14]], '#2222BB', .45), T(2, 9, 'Barra', 1, {}), T(2, 10.4, 'tierra de', 1), T(2, 11.8, 'protección', 1),
    L([[72, 14], [86, 14]], '#2222BB', .45), T(80, 9, 'Barra', 1), T(80, 10.4, 'tierra de', 1), T(80, 11.8, 'servicio', 1),
    L([[10, 30], [80, 30]], '#2222BB', .4)];
  [[25, 'Nader'], [48, 'Nader']].forEach(([x, n]) => e.push(L([[x, 30], [x, 18]], '#DD1111'), ...interruptorRot(x, 14, n, '—x63A', '— kA', 'Curva —')));
  e.push(L([[37, 30], [37, 40]], '#DD1111'), ...interruptorRot(37, 38, 'Nader', '—x63A', '— kA', 'Curva —'));
  return e;
}
function dcdc() {
  return [S('dcswitch', 6, 7), T(-1, 1, 'DC', 1.8, { a: 'end' }), T(-1, 3.4, 'SWITCH', 1.8, { a: 'end' }),
    ...['Módulo DC / DC ——', 'Baterías ——', 'Tecnología ——', 'E total = —— kWh', 'P máx = —— kW', 'P peak = —— kW / s.', 'V op = —— V'].map((l, i) => T(14, 1 + i * 2.6, l, 1.8))];
}
function tda() {
  const e = [R(0, 6, 128, 70, '#E6C200', .4), T(64, 0, 'TABLERO DE ALUMBRADO (TDA)', 2.4, { a: 'middle', b: true }), T(64, 3.2, '(existente)', 2, { a: 'middle' }),
    L([[8, -4], [8, 14]]), ...interruptorRot(8, 18, '1x40A', '6kA', 'Curva C'), L([[8, 22], [8, 30], [110, 30]])];
  const grupo = (x, hijos) => {
    e.push(L([[x, 30], [x, 34]]), S('diferencial', x, 36.5), T(x + 4, 34, '2x25A', 1.5), T(x + 4, 36.1, 'Tipo AC', 1.5), T(x + 4, 38.2, '30mA', 1.5), L([[x, 39], [x, 42]]));
    const xs = hijos.map((_, i) => x - 6 + i * 14); e.push(L([[xs[0], 42], [xs[xs.length - 1], 42]]));
    hijos.forEach((h, i) => e.push(L([[xs[i], 42], [xs[i], 44]]), ...interruptorRot(xs[i], 48, h, '6kA', 'Curva C'), L([[xs[i], 52], [xs[i], 55]]), S('consumo', xs[i], 56.5)));
  };
  grupo(22, ['1x10A', '1x10A']); grupo(54, ['1x32A', '1x25A']); grupo(88, ['1x16A', '1x16A', '1x25A']);
  e.push(R(6, 63, 26, 8, '#888888', .2), S('consumo', 10, 67), T(13, 67.6, 'Consumo', 1.8, { it: false }));
  e.push(L([[-14, -4], [-14, 6]]), T(-18, 9, 'VACANTE', 1.5));
  return e;
}
function stringFV() {
  return [L([[0, 0], [0, 14]], '#DD1111', .3, '1.5 1'), T(2, 4, 'L=— m', 1.5), T(2, 6.2, 'PV1-F 2x6 mm²', 1.5), S('modulo', 0, 17.5), T(5, 17, 'Pmáx=— Wp', 1.5), T(5, 19.2, 'Pmód=— Wp', 1.5),
    T(-5, 25, 'Str.A.1.1', 1.5, { a: 'end' }), T(-5, 27.2, '— módulos', 1.5, { a: 'end' }), L([[0, 21], [0, 28]], '#111111', .25, '1 .7'), S('tierraP', 0, 28), T(0, 34, 'T.P.', 1.4, { a: 'middle' })];
}
const desplazar = (es, dx, dy) => { es.forEach(e => mover(e, dx, dy)); return es; };
export const BLOQUES_INCLUIDOS = [
  { id: 'inc-sg', nombre: 'Smart Guard', elems: smartGuard() },
  { id: 'inc-dcdc', nombre: 'Módulo DC/DC + baterías', elems: desplazar(dcdc(), 8, 0) },
  { id: 'inc-tda', nombre: 'Tablero de alumbrado (TDA) existente', elems: desplazar(tda(), 20, 6) },
  { id: 'inc-int', nombre: 'Interruptor con rótulo', elems: desplazar(interruptorRot(0, 0, '2x40A', '6kA', 'Curva C'), 3, 5) },
  { id: 'inc-dif', nombre: 'Diferencial con rótulo', elems: desplazar([S('diferencial', 0, 0), T(4, -2, '2x25A', 1.5), T(4, .1, 'Tipo AC', 1.5), T(4, 2.2, '30mA', 1.5)], 3, 3) },
  { id: 'inc-str', nombre: 'String FV', elems: desplazar(stringFV(), 18, 1) }
];
