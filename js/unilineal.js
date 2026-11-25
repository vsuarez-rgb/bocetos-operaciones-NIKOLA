/* ==========================================================================
   Paso "Unilineal": el diagrama unilineal del proyecto, editable.
   Va entre "Dibujo" (equipos y canalización) e "Informe y planos".
     · Los datos (inversor, protecciones, largos, strings) se cambian en el panel.
     · Cualquier texto del diagrama se reescribe con un clic sobre él; queda
       guardado en p.uni.textos y se puede volver al texto calculado.
     · Partes opcionales: consumo, tierra de servicio, DC switch, batería,
       SmartGuard y circuito del cargador EV.
   Es el mismo unilineal de la lámina A1 y del bloque "Unilineal" del informe:
   lo que se cambia aquí sale en todos lados.
   ========================================================================== */
import { esc, fmt, ic, toast, parseNum } from './util.js';
import { INVERSORES } from './catalogo.js';
import { calcular, calcStrings, calcCA, inversorDe } from './geom.js';
import { unilinealSVG, opcUni, BASES_UNI, baseUni, baseSugerida } from './lamina.js';
import { leerAjuste, guardarAjuste } from './ajustes.js';
import { COLORES_LINEA, SIMBOLOS, BLOQUES_INCLUIDOS, dibujoLibreEditor, descomponer, mover, clonar, normalizar, elemsSimbolo, svgElem, VB_UNI, vbLibre } from './uni-dibujo.js';

const vbAct = () => libre() ? vbLibre(libre()) : VB_UNI;   // hoja del unilineal (mm)
/* Editor: tool = sel | linea | texto | sim | bloque; sel = índices elegidos; temp = línea en curso */
const S = { p: null, el: null, cb: {}, zoom: null, z: 1, tool: 'sel', color: 'ca', sim: 'interruptor', bloque: null, sel: new Set(), temp: null, hist: [], fut: [], orto: true, menu: null, bloques: [], ocultos: [], mouse: null, D: null };
const uni = () => (S.p.uni ||= {});
const libre = () => S.p.uni?.libre || null;
const activo = () => !!S.el?.isConnected;
const cambio = () => { S.cb.cambio && S.cb.cambio(); };

export function vistaUnilineal(el, p, cb = {}) {
  if (S.p !== p) { S.hist = []; S.fut = []; S.sel = new Set(); S.temp = null; }
  S.el = el; S.p = p; S.cb = cb; S.menu = null;
  el.innerHTML = `<div class="uni">
    <div class="inf-bar"><span class="inf-bar-t">Unilineal · <span id="uniBase"></span></span><button class="inf-btn" data-act="uni-bases" style="margin-left:10px">Unilineales base…</button><span class="uni-ayuda" id="uniAyuda"></span><span class="tb-sp"></span>
      <span class="inf-zoom"><button data-act="uni-z" data-k="-1" title="Alejar">−</button><button data-act="uni-z" data-k="0" title="Ajustar a la pantalla" id="uniZ">Ajustar</button><button data-act="uni-z" data-k="1" title="Acercar">+</button></span></div>
    <div class="uni-herr" id="uniHerr"></div>
    <div class="inf-scroll uni-scroll"><div class="uni-papel"></div></div></div>`;
  barra(); dibujarSVG();
  Promise.all([leerAjuste('bloquesUni'), leerAjuste('bloquesUniOcultos')]).then(([b, o]) => { S.bloques = b || []; S.ocultos = o || []; });
}
function dibujarSVG() {
  const pap = S.el?.querySelector('.uni-papel'); if (!pap) return;
  const L = libre();
  const VB = vbAct();
  if (L) pap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB[0]} ${VB[1]}" width="100%" height="100%" class="uni-ed"><rect width="${VB[0]}" height="${VB[1]}" fill="#fff"/>${dibujoLibreEditor(L, S.sel)}<g id="uniTemp"></g></svg>`;
  else { const R = calcular(S.p), SI = calcStrings(S.p, R); pap.innerHTML = unilinealSVG(S.p, R, SI).replace('</svg>', '<g id="uniTemp"></g></svg>'); }
  const nb = S.el.querySelector('#uniBase'); if (nb) nb.textContent = baseUni(S.p).n + (L ? ' (editado a mano)' : '');
  const ay = S.el.querySelector('#uniAyuda'); if (ay) ay.textContent = ayuda();
  temporal();
  ajustar();
}
function ayuda() {
  return { sel: libre() ? 'Clic o ventana para elegir · arrastra para mover · doble clic en un texto para escribirlo · Supr borra · Ctrl+C / Ctrl+V' : 'Clic en un texto para cambiarlo · usa la barra de arriba para dibujar, elegir y mover partes',
    linea: 'Clic en cada punto · Enter o doble clic termina · Esc cancela', texto: 'Clic donde va el texto', sim: `Clic donde va: ${SIMBOLOS[S.sim]?.n || ''} · Esc para terminar`, bloque: 'Clic donde va el bloque (esquina superior izquierda)' }[S.tool] || '';
}

/* ---------- Barra de herramientas del dibujo ---------- */
function barra() {
  const el = S.el?.querySelector('#uniHerr'); if (!el) return;
  const b = (act, k, txt, on, tit = '', dis = false) => `<button class="uh-b" data-act="${act}" ${k != null ? `data-k="${k}"` : ''} aria-pressed="${!!on}" title="${esc(tit)}" ${dis ? 'disabled' : ''}>${txt}</button>`;
  const col = COLORES_LINEA.find(c => c.k === S.color);
  const visibles = [...BLOQUES_INCLUIDOS.filter(x => !S.ocultos.includes(x.id)), ...S.bloques];
  el.innerHTML = `
    ${b('uni-tool', 'sel', `${ic('cursor', 15)} Seleccionar`, S.tool === 'sel', 'Elegir, mover, copiar y borrar partes')}
    <span class="uh-g">${b('uni-tool', 'linea', `${ic('pline', 15)} Línea`, S.tool === 'linea', 'Dibujar una línea (clic en cada punto)')}<span class="uh-cols">${COLORES_LINEA.map(c => `<button class="uh-col" data-act="uni-color" data-k="${c.k}" aria-pressed="${S.color === c.k}" title="${esc(c.n)}" style="--c:${c.c}${c.dash ? ';--d:dashed' : ''}"></button>`).join('')}</span></span>
    ${b('uni-tool', 'texto', `${ic('text', 15)} Texto`, S.tool === 'texto')}
    <span class="uh-dd">${b('uni-menu', 'sim', `${ic('inverter', 15)} Símbolo ▾`, S.tool === 'sim' || S.menu === 'sim', 'Interruptor, diferencial, inversor, MPPT, módulo, tierra…')}
      ${S.menu === 'sim' ? `<div class="uh-menu">${Object.entries(SIMBOLOS).map(([k, s]) => `<button data-act="uni-sim" data-k="${k}"><svg viewBox="-8 -8 16 16" width="22" height="22">${s.svg || '<rect x="-7" y="-5" width="14" height="10" fill="none" stroke="' + s.rect.c + '" stroke-width=".8"/>'}</svg>${esc(s.n)}</button>`).join('')}</div>` : ''}</span>
    <span class="uh-dd">${b('uni-menu', 'bloques', `${ic('block', 15)} Bloques ▾`, S.tool === 'bloque' || S.menu === 'bloques', 'Conjuntos guardados para insertar')}
      ${S.menu === 'bloques' ? `<div class="uh-menu uh-bloques">${visibles.map(x => `<div class="uh-bl"><button data-act="uni-bloque" data-k="${x.id}">${esc(x.nombre)}${x.id.startsWith('inc-') ? ' <em>incluido</em>' : ''}</button><button class="uh-del" data-act="uni-bloque-del" data-k="${x.id}" title="${x.id.startsWith('inc-') ? 'Quitar de la lista' : 'Borrar el bloque'}">${ic('trash', 13)}</button></div>`).join('') || '<p>Sin bloques.</p>'}
        <hr><button data-act="uni-bloque-crear" ${S.sel.size ? '' : 'disabled'}>${ic('plus', 13)} Crear bloque con lo seleccionado</button>${S.ocultos.length ? `<button data-act="uni-bloque-ver">Volver a mostrar los incluidos (${S.ocultos.length})</button>` : ''}</div>` : ''}</span>
    <span class="uh-sep"></span>
    ${b('uni-copiar', null, `${ic('copy', 15)}`, false, 'Copiar (Ctrl+C)', !S.sel.size)}${b('uni-pegar', null, 'Pegar', false, 'Pegar (Ctrl+V)', !leerClip())}
    ${b('uni-borrar', null, `${ic('trash', 15)}`, false, 'Borrar lo seleccionado (Supr)', !S.sel.size)}
    ${b('uni-undo', null, ic('undo', 15), false, 'Deshacer (Ctrl+Z)', !S.hist.length)}${b('uni-redo', null, ic('redo', 15), false, 'Rehacer (Ctrl+Y)', !S.fut.length)}
    <span class="uh-sep"></span>${b('uni-orto', null, 'ORTO', S.orto, 'Líneas solo horizontales y verticales')}
    <span class="tb-sp"></span>${libre() ? b('uni-regenerar', null, 'Volver a la base', false, 'Descarta el dibujo a mano y vuelve a armarlo con los datos') : `<span class="uh-nota" title="${esc(col ? col.n : '')}">Al dibujar o elegir partes, el unilineal pasa a dibujo editable</span>`}`;
}

/* ---------- Pasar a dibujo editable, historial, portapapeles ---------- */
function asegurarLibre() {
  if (libre()) return libre();
  const q = { ...S.p, uni: { ...(S.p.uni || {}) } }; delete q.uni.libre;
  const R = calcular(S.p), SI = calcStrings(S.p, R);
  antes(); uni().libre = { elems: descomponer(unilinealSVG(q, R, SI)), desde: baseUni(S.p).id, vb: [...VB_UNI] };
  toast('El unilineal pasó a dibujo editable. «Volver a la base» lo arma de nuevo con los datos.');
  S.cb.panel && S.cb.panel();
  return libre();
}
const foto = () => JSON.stringify(S.p.uni?.libre || null);
function antes() { S.hist.push(foto()); if (S.hist.length > 100) S.hist.shift(); S.fut = []; }
function restaurar(j) { const v = JSON.parse(j); if (v) uni().libre = v; else delete uni().libre; S.sel.clear(); listo(); barra(); }
function deshacer() { if (!S.hist.length) return; S.fut.push(foto()); restaurar(S.hist.pop()); }
function rehacer() { if (!S.fut.length) return; S.hist.push(foto()); restaurar(S.fut.pop()); }
function leerClip() { try { return JSON.parse(localStorage.getItem('nk-uni-clip') || 'null'); } catch (e) { return S.clip || null; } }
function copiar() {
  const L = libre(); if (!L || !S.sel.size) return;
  S.clip = clonar([...S.sel].sort((a, b) => a - b).map(i => L.elems[i]));
  try { localStorage.setItem('nk-uni-clip', JSON.stringify(S.clip)); } catch (e) { /* sin almacenamiento */ }
  toast(`${S.clip.length} parte(s) copiadas`); barra();
}
function pegar(en) {
  const c = leerClip() || S.clip; if (!c || !c.length) return;
  const L = asegurarLibre(); antes();
  const nuevos = clonar(c), cj = cajaElems(nuevos), dx = en ? en[0] - cj.x : 5, dy = en ? en[1] - cj.y : 5;
  nuevos.forEach(e => mover(e, dx, dy));
  const i0 = L.elems.length; L.elems.push(...nuevos);
  S.sel = new Set(nuevos.map((_, k) => i0 + k));
  try { localStorage.setItem('nk-uni-clip', JSON.stringify(nuevos)); } catch (e) { S.clip = nuevos; }
  listo(); barra();
}
function borrarSel() {
  const L = libre(); if (!L || !S.sel.size) return;
  antes(); L.elems = L.elems.filter((_, i) => !S.sel.has(i)); S.sel.clear(); listo(); barra();
}
/* Caja de unos elementos (sin dibujarlos en pantalla: se miden en un SVG oculto) */
let svgMedir = null;
function cajaElems(es) {
  if (!svgMedir) { svgMedir = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svgMedir.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:10px;height:10px'); document.body.appendChild(svgMedir); }
  svgMedir.innerHTML = `<g>${es.map(svgElem).join('')}</g>`;
  const b = svgMedir.firstChild.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/* ---------- Ratón sobre el dibujo ---------- */
function ptSVG(ev) {
  const svg = S.el.querySelector('.uni-papel svg'); if (!svg) return null;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y];
}
const red = v => Math.round(v * 2) / 2;                      // de a 0,5 mm
function ajustarPunto(q) {
  // engancha a extremos y vértices de líneas cercanas; si no, a la grilla de 0,5 mm; con ORTO, recto desde el punto anterior
  const L = libre(); let best = 1.6, bq = null;
  (L?.elems || []).forEach(e => { if (e.t === 'l') e.pts.forEach(v => { const d = Math.hypot(v[0] - q[0], v[1] - q[1]); if (d < best) { best = d; bq = v; } }); });
  let r = bq ? [...bq] : [red(q[0]), red(q[1])];
  const base = S.temp && S.temp[S.temp.length - 1];
  if (S.orto && base && !bq) r = Math.abs(r[0] - base[0]) > Math.abs(r[1] - base[1]) ? [r[0], base[1]] : [base[0], r[1]];
  return r;
}
function temporal() {
  const g = S.el?.querySelector('#uniTemp'); if (!g) return;
  let s = '';
  const col = COLORES_LINEA.find(c => c.k === S.color) || COLORES_LINEA[0];
  if (S.tool === 'linea' && S.temp) { const pts = S.mouse ? [...S.temp, ajustarPunto(S.mouse)] : S.temp; s += `<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${col.c}" stroke-width="${col.w || .3}" ${col.dash ? `stroke-dasharray="${col.dash}"` : ''} opacity=".8"/>`; }
  if (S.mouse && S.tool === 'sim') s += `<g opacity=".55">${elemsSimbolo(S.sim, red(S.mouse[0]), red(S.mouse[1])).map(svgElem).join('')}</g>`;
  if (S.mouse && S.tool === 'bloque') { const B = bloquePorId(S.bloque); if (B) s += `<g opacity=".5" transform="translate(${red(S.mouse[0])} ${red(S.mouse[1])})">${B.elems.map(svgElem).join('')}</g>`; }
  if (S.D && S.D.modo === 'caja') { const a = S.D.a, b = S.D.b, izq = b[0] >= a[0]; s += `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="${izq ? 'rgba(61,123,255,.12)' : 'rgba(47,208,107,.12)'}" stroke="${izq ? '#3D7BFF' : '#2FD06B'}" stroke-width=".3" ${izq ? '' : 'stroke-dasharray="1.5 1"'}/>`; }
  if (S.mouse && S.tool === 'linea') { const q = ajustarPunto(S.mouse); s += `<path d="M${q[0] - 1.5} ${q[1]}h3M${q[0]} ${q[1] - 1.5}v3" stroke="#FAB704" stroke-width=".3"/>`; }
  g.innerHTML = s;
}
const bloquePorId = id => BLOQUES_INCLUIDOS.find(x => x.id === id) || S.bloques.find(x => x.id === id);

document.addEventListener('pointerdown', ev => {
  if (!activo() || ev.button !== 0) return;
  if (!ev.target.closest('#uniHerr')) { if (S.menu && !ev.target.closest('.uh-menu')) { S.menu = null; barra(); } }
  const svg = ev.target.closest?.('.uni-papel svg'); if (!svg) return;
  const q = ptSVG(ev); if (!q) return;
  if (S.tool === 'sel' && !libre() && ev.target.closest('text[data-u]')) return;          // clic en un texto del unilineal generado: se escribe (ver 'click')
  ev.preventDefault();
  if (S.tool === 'linea') {
    const r = ajustarPunto(q);
    if (!S.temp) S.temp = [r]; else if (!(r[0] === S.temp[S.temp.length - 1][0] && r[1] === S.temp[S.temp.length - 1][1])) S.temp.push(r);
    temporal(); return;
  }
  if (S.tool === 'texto') { const L = asegurarLibre(); antes(); L.elems.push({ t: 'x', x: red(q[0]), y: red(q[1]), s: 'Texto', size: 1.6, a: 'start', b: false, it: true, c: '#111' }); const i = L.elems.length - 1; S.sel = new Set([i]); S.tool = 'sel'; listo(); barra(); editarTextoLibre(i, true); return; }
  if (S.tool === 'sim') { const L = asegurarLibre(); antes(); const es = elemsSimbolo(S.sim, red(q[0]), red(q[1])), i0 = L.elems.length; L.elems.push(...es); S.sel = new Set(es.map((_, k) => i0 + k)); listo(false); barra(); return; }
  if (S.tool === 'bloque') { const B = bloquePorId(S.bloque); if (!B) return; const L = asegurarLibre(); antes(); const es = clonar(B.elems); es.forEach(e => mover(e, red(q[0]), red(q[1]))); const i0 = L.elems.length; L.elems.push(...es); S.sel = new Set(es.map((_, k) => i0 + k)); S.tool = 'sel'; listo(); barra(); return; }
  // Seleccionar
  const eraLibre = !!libre();
  if (!eraLibre) { asegurarLibre(); dibujarSVG(); }           // el primer clic de selección descompone el unilineal generado
  const gEl = eraLibre ? ev.target.closest('[data-i]') : document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-i]');
  const gi = gEl ? +gEl.dataset.i : null;
  if (gi != null) {
    if (ev.shiftKey) { S.sel.has(gi) ? S.sel.delete(gi) : S.sel.add(gi); }
    else if (!S.sel.has(gi)) S.sel = new Set([gi]);
    S.D = { modo: 'mover', a: q, last: [0, 0], primero: true };
  } else { if (!ev.shiftKey) S.sel.clear(); S.D = { modo: 'caja', a: q, b: q }; }
  dibujarSVG(); barra(); S.cb.panel && S.cb.panel();
});
document.addEventListener('pointermove', ev => {
  if (!activo()) return;
  const enSvg = ev.target.closest?.('.uni-papel svg');
  if (!enSvg && !S.D) { if (S.mouse) { S.mouse = null; temporal(); } return; }
  const q = ptSVG(ev); if (!q) return; S.mouse = q;
  const D = S.D;
  if (D && D.modo === 'mover') {
    const d = [red(q[0] - D.a[0]), red(q[1] - D.a[1])], dx = d[0] - D.last[0], dy = d[1] - D.last[1];
    if (dx || dy) { if (D.primero) { antes(); D.primero = false; } const L = libre(); S.sel.forEach(i => mover(L.elems[i], dx, dy)); D.last = d; dibujarSVG(); }
    return;
  }
  if (D && D.modo === 'caja') D.b = q;
  temporal();
});
document.addEventListener('pointerup', ev => {
  const D = S.D; if (!D || !activo()) return; S.D = null;
  if (D.modo === 'mover') { if (!D.primero) listo(false); barra(); S.cb.panel && S.cb.panel(); return; }
  if (D.modo === 'caja') {
    const x0 = Math.min(D.a[0], D.b[0]), x1 = Math.max(D.a[0], D.b[0]), y0 = Math.min(D.a[1], D.b[1]), y1 = Math.max(D.a[1], D.b[1]), cruce = D.b[0] < D.a[0];
    if (x1 - x0 > .8 || y1 - y0 > .8) S.el.querySelectorAll('.uni-papel [data-i]').forEach(g => {
      const b = g.getBBox(), dentro = b.x >= x0 && b.y >= y0 && b.x + b.width <= x1 && b.y + b.height <= y1, toca = b.x <= x1 && b.x + b.width >= x0 && b.y <= y1 && b.y + b.height >= y0;
      if (cruce ? toca : dentro) S.sel.add(+g.dataset.i);
    });
    dibujarSVG(); barra(); S.cb.panel && S.cb.panel();
  }
});
document.addEventListener('dblclick', ev => {
  if (!activo()) return;
  if (S.tool === 'linea' && S.temp) { terminarLinea(); return; }
  const g = ev.target.closest?.('.uni-papel [data-i]'); if (!g || !libre()) return;
  const i = +g.dataset.i; if (libre().elems[i]?.t === 'x') editarTextoLibre(i);
});
function terminarLinea() {
  const pts = S.temp; S.temp = null;
  if (pts && pts.length >= 2) {
    const L = asegurarLibre(), c = COLORES_LINEA.find(x => x.k === S.color) || COLORES_LINEA[0]; antes();
    L.elems.push({ t: 'l', pts, c: c.c, w: c.w || .3, ...(c.dash ? { dash: c.dash } : {}) }); S.sel = new Set([L.elems.length - 1]); listo(false); barra();
  } else temporal();
}
function editarTextoLibre(i, nuevo) {
  const L = libre(), e = L?.elems[i], t = S.el.querySelector(`.uni-papel [data-i="${i}"] text`); if (!e || !t) return;
  document.querySelector('.uni-edit')?.remove();
  const r = t.getBoundingClientRect(), inp = document.createElement('input'); inp.className = 'uni-edit'; inp.value = nuevo ? '' : e.s;
  const fs = Math.max(12, r.height * .95);
  Object.assign(inp.style, { left: `${r.left - 4}px`, top: `${r.top + r.height / 2 - fs * .8}px`, width: `${Math.max(160, r.width + 40)}px`, fontSize: `${fs}px` });
  document.body.appendChild(inp); inp.focus(); inp.select();
  let hecho = false;
  const fin = ok => {
    if (hecho) return; hecho = true; inp.remove();
    const v = inp.value;
    if (nuevo && (!ok || !v.trim())) { L.elems.splice(i, 1); S.hist.pop(); S.sel.clear(); listo(false); barra(); return; }
    if (!ok || v === e.s) return;
    if (!nuevo) antes(); e.s = v; listo();
  };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); fin(true); } else if (ev.key === 'Escape') { ev.preventDefault(); fin(false); } ev.stopPropagation(); });
  inp.addEventListener('blur', () => fin(true));
}
document.addEventListener('keydown', ev => {
  if (!activo() || ev.target.matches?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  const k = ev.key.toLowerCase(), ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && k === 'z') { ev.preventDefault(); deshacer(); return; }
  if (ctrl && k === 'y') { ev.preventDefault(); rehacer(); return; }
  if (ctrl && k === 'c') { ev.preventDefault(); copiar(); return; }
  if (ctrl && k === 'x') { ev.preventDefault(); copiar(); borrarSel(); return; }
  if (ctrl && k === 'v') { ev.preventDefault(); pegar(); return; }
  if (ctrl && k === 'a') { const L = libre(); if (!L) return; ev.preventDefault(); S.sel = new Set(L.elems.map((_, i) => i)); dibujarSVG(); barra(); S.cb.panel && S.cb.panel(); return; }
  if (k === 'delete' || k === 'backspace') { ev.preventDefault(); borrarSel(); return; }
  if (k === 'enter' && S.temp) { ev.preventDefault(); terminarLinea(); return; }
  if (k === 'escape') { ev.preventDefault(); if (S.temp) { S.temp = null; temporal(); } else if (S.tool !== 'sel') { S.tool = 'sel'; barra(); dibujarSVG(); } else if (S.sel.size) { S.sel.clear(); dibujarSVG(); barra(); S.cb.panel && S.cb.panel(); } S.menu = null; return; }
  const fl = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  if (fl && S.sel.size && libre()) { ev.preventDefault(); const p = ev.shiftKey ? 5 : .5; antes(); S.sel.forEach(i => mover(libre().elems[i], fl[0] * p, fl[1] * p)); listo(false); }
});
function ajustar() {
  const sc = S.el?.querySelector('.uni-scroll'), pap = S.el?.querySelector('.uni-papel'); if (!sc || !pap) return;
  const VB = vbAct(), fit = Math.max(.5, Math.min((sc.clientWidth - 48) / VB[0], (sc.clientHeight - 48) / VB[1]));
  S.z = S.zoom || fit;
  pap.style.width = `${VB[0] * S.z}px`; pap.style.height = `${VB[1] * S.z}px`;
  const b = S.el.querySelector('#uniZ'); if (b) b.textContent = S.zoom ? `${Math.round(S.zoom / fit * 100)} %` : 'Ajustar';
}
window.addEventListener('resize', () => { if (activo() && !S.zoom) ajustar(); });

/* ---------- Panel ---------- */
export function panelUnilineal(p) {
  if (!S.p) S.p = p;
  const U = opcUni(p), L = p.lamina || {}, inv = inversorDe(p), R = calcular(p), SI = calcStrings(p, R), ca = calcCA(p);
  const sec = (t, c, abierto = true) => `<details class="pp" ${abierto ? 'open' : ''}><summary>${t}</summary><div class="pp-b">${c}</div></details>`;
  const inp = (k, l, v, ph = '', u = '') => `<label class="f"><span>${l}</span>${u ? `<span class="fi">` : ''}<input class="in" data-uni="${k}" value="${esc(v ?? '')}" placeholder="${esc(ph)}">${u ? `<em>${u}</em></span>` : ''}</label>`;
  const chk = (k, l, on) => `<label class="chk"><input type="checkbox" data-uni="${k}" ${on ? 'checked' : ''}> ${l}</label>`;
  const disyDef = `${inv.fase === 'Trifásico' ? '4' : '2'}x${ca.prot} A Curva C`, difDef = inv.dif || `${inv.fase === 'Trifásico' ? '4' : '2'}x63 A 300 mA Tipo A`;
  const mods = Object.entries(U.textos || {});
  const B = baseUni(p), sug = baseSugerida(p), grupos = [...new Set(BASES_UNI.map(b => b.g))];
  if (p.uni?.libre) return panelLibre(p, sec);
  let h = sec('Unilineal base', `<label class="f"><span>Base</span><select class="in" data-uni="u.base"><option value="" ${!p.uni?.base ? 'selected' : ''}>Sugerido por el inversor: ${esc(sug.n)}</option>${grupos.map(g => `<optgroup label="${esc(g)}">${BASES_UNI.filter(b => b.g === g).map(b => `<option value="${b.id}" ${p.uni?.base === b.id ? 'selected' : ''}>${esc(b.n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <button class="btn sm" data-act="uni-bases">Ver todos los unilineales base</button>
    ${(o => o ? `<div class="aviso warn">${ic('alert', 15)}<span>Esta base no calza con el inversor del proyecto (${esc(inv.modelo)}).</span></div><button class="btn sm" data-act="uni-inv" data-id="${o.id}">Cambiar el inversor a ${esc(o.modelo)}</button>` : '')(invDeBase(B, p))}`);
  h += sec('Unilineal', `<p class="mut">Se arma solo con los datos del proyecto. Cambia los datos aquí o haz clic en cualquier texto del diagrama para escribirlo a mano. Es el mismo unilineal de las láminas A1 y del bloque «Unilineal» del informe.</p>
    <div class="kpis"><div><b>${SI.lista.length}</b><span>strings</span></div><div><b>${inv.mppt}</b><span>MPPT</span></div><div><b>${fmt(inv.kw * (p.cantInv || 1), 1)}</b><span>kW nom.</span></div></div>`);
  h += sec('Inversor', `<label class="f"><span>Modelo</span><select class="in" data-uni="p.inversor">${['Monofásico', 'Trifásico'].map(fa => `<optgroup label="${fa}s">${INVERSORES.filter(x => x.fase === fa).map(x => `<option value="${x.id}" ${inv.id === x.id ? 'selected' : ''}>${esc(x.modelo)} · ${x.kw} kW</option>`).join('')}</optgroup>`).join('')}</select></label>
    ${inp('p.cantInv', 'Cantidad de inversores', p.cantInv || 1)}`);
  h += sec('Protecciones y tablero', `${inp('L.disyuntor', 'Disyuntor del tablero', L.disyuntor, disyDef)}<div class="row">${inp('L.marcaDisy', 'Marca de los interruptores', L.marcaDisy, 'Schneider…')}${inp('L.kA', 'Poder de corte', L.kA, '6', 'kA')}</div>
    ${inp('L.diferencial', 'Diferencial', L.diferencial, difDef)}${inp('L.marcaDif', 'Marca del diferencial', L.marcaDif, 'CHINT…')}${inp('L.dimTablero', 'Medidas del tablero general', L.dimTablero, '400 x 300 x 200 mm')}
    <p class="mut">Lo que quede vacío sale como «pendiente» en el unilineal.</p>`);
  h += sec('Empalme', `${inp('L.empalme', 'Tipo de empalme', L.empalme, 'S-9-40')}<div class="row">${inp('L.tarifa', 'Tarifa', L.tarifa, 'BT1')}${inp('L.nCliente', 'N° de cliente', L.nCliente, '')}</div>
    <div class="row">${inp('L.marcaEmp', 'Marca protección', L.marcaEmp, '')}${inp('L.kAEmp', 'Poder de corte', L.kAEmp, '10', 'kA')}</div>${inp('p.distrib', 'Distribuidora (bajo el medidor)', p.distrib, 'ENEL, CGE…')}`, false);
  h += sec('Tierra de servicio y protección', `${inp('L.tierraCond', 'Conductor', L.tierraCond, 'Evaflex 2x6 mm² (N+T)')}<div class="row">${inp('L.tierraL', 'Largo', L.tierraL, '', 'm')}${inp('L.tierraR', 'Resistencia', L.tierraR, '18,3', 'Ω')}</div>
    ${inp('L.tierraMet', 'Método de medición', L.tierraMet, 'Método de pinza')}
    <div class="sub">Tierra de los strings (T.P.)</div><div class="row">${inp('L.tierraStrCond', 'Conductor', L.tierraStrCond, 'Evaflex 1x6 mm²')}${inp('L.tierraRstr', 'Resistencia', L.tierraRstr, '', 'Ω')}</div>`, false);
  h += sec('Conductores en CA', `${inp('L.largo_inv-tg', 'Largo Inversor – TGFV', L['largo_inv-tg'], `${fmt(ca.tramos[0].auto, 0)} según el dibujo`, 'm')}${inp('L.largo_tg-emp', 'Largo TG – Empalme', L['largo_tg-emp'], `${fmt(ca.tramos[1].auto, 0)} según el dibujo`, 'm')}
    <dl class="dl"><dt>Caída total</dt><dd>${fmt(ca.totalP, 2)} %</dd></dl>`, false);
  h += sec('Strings', SI.lista.length ? `<div class="uni-str">${SI.lista.map(x => `<div class="uni-str-f"><b>${esc(x.nombre)}</b><span>${x.n} mód.</span>
      <label class="f mini"><span>MPPT</span><select class="in" data-uni="s.${x.st.id}.mppt">${Array.from({ length: inv.mppt }, (_, i) => `<option ${x.st.mppt === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label class="f mini"><span>Largo</span><span class="fi"><input class="in" data-uni="s.${x.st.id}.largo" value="${x.st.largo ?? ''}" placeholder="${fmt(x.largoAuto, 0)}" inputmode="decimal"><em>m</em></span></label>
      <label class="f mini"><span>Sección</span><span class="fi"><input class="in" data-uni="s.${x.st.id}.seccion" value="${x.seccion}" inputmode="decimal"><em>mm²</em></span></label></div>`).join('')}</div>` : '<p class="mut">Sin strings: se arman en el paso Strings.</p>', false);
  h += sec('Qué se muestra', `${chk('u.consumo', 'Circuito de consumo', U.consumo !== false)}${chk('u.tierra', 'Tierra de servicio', U.tierra !== false)}${chk('u.dcSwitch', 'DC switch del inversor', U.dcSwitch !== false)}
    <div class="sub">Agregar</div>
    ${chk('x.bat', 'Batería', U.extras.bat)}${U.extras.bat || B.bat ? `<div class="row">${inp('x.batModelo', 'Modelo', U.extras.batModelo, 'LUNA2000')}${inp('x.batCap', 'Energía total', U.extras.batCap, '10 kWh')}</div><div class="row">${inp('x.batPmax', 'Potencia máx.', U.extras.batPmax, '5 kW')}${inp('x.batV', 'Tensión de operación', U.extras.batV, '350–560 V')}</div>` : ''}
    ${chk('x.sg', 'SmartGuard (respaldo)', U.extras.sg)}${U.extras.sg || B.sg ? inp('x.sgModelo', 'Modelo del SmartGuard', U.extras.sgModelo, '') : ''}
    ${chk('x.ev', 'Circuito del cargador EV', U.extras.ev)}${U.extras.ev ? `<div class="row">${inp('x.evProt', 'Protección', U.extras.evProt, '2x32 A Curva C')}${inp('x.evDif', 'Diferencial', U.extras.evDif, '2x40 A 30 mA Tipo A-SI')}</div><div class="row">${inp('x.evMarca', 'Marca del cargador', U.extras.evMarca, '')}${inp('x.evKw', 'Potencia', U.extras.evKw, '7,4', 'kW')}</div>` : ''}`);
  h += sec(`Textos cambiados a mano${mods.length ? ` (${mods.length})` : ''}`, mods.length ? `<div class="uni-mods">${mods.map(([k, v]) => `<div class="row uni-mod"><span title="${esc(k)}">${esc(v.trim() ? v : '(oculto)')}</span><button class="btn sm" data-act="uni-reset" data-k="${esc(k)}" title="Volver al texto calculado">↺</button></div>`).join('')}</div>
    <button class="btn sm" data-act="uni-reset-all">Volver todos al texto calculado</button>` : '<p class="mut">Ninguno. Haz clic en un texto del diagrama para escribirlo (los cambiados se ven en azul aquí, no en el PDF). Déjalo vacío para volver al calculado; escribe un espacio para ocultarlo.</p>', mods.length > 0);
  return h;
}

/* ---------- Acciones y cambios ---------- */
export function accionUnilineal(a, b) {
  if (!a.startsWith('uni-')) return false;
  const cerrarMenu = () => { S.menu = null; };
  if (a === 'uni-tool') { S.tool = b.dataset.k; S.temp = null; cerrarMenu(); barra(); dibujarSVG(); }
  if (a === 'uni-color') { S.color = b.dataset.k; S.tool = 'linea'; barra(); dibujarSVG();
    const L = libre(), c = COLORES_LINEA.find(x => x.k === S.color);   // con líneas elegidas: les cambia el color
    if (L && S.sel.size && [...S.sel].some(i => L.elems[i]?.t === 'l')) { antes(); S.sel.forEach(i => { const e = L.elems[i]; if (e?.t === 'l') { e.c = c.c; e.w = c.w || .3; if (c.dash) e.dash = c.dash; else delete e.dash; } }); S.tool = 'sel'; listo(); barra(); } }
  if (a === 'uni-menu') { S.menu = S.menu === b.dataset.k ? null : b.dataset.k; barra(); }
  if (a === 'uni-sim') { S.sim = b.dataset.k; S.tool = 'sim'; cerrarMenu(); barra(); dibujarSVG(); }
  if (a === 'uni-bloque') { S.bloque = b.dataset.k; S.tool = 'bloque'; cerrarMenu(); barra(); dibujarSVG(); }
  if (a === 'uni-bloque-del') {
    const id = b.dataset.k, x = bloquePorId(id); if (!x) return true;
    if (id.startsWith('inc-')) { S.ocultos = [...S.ocultos, id]; guardarAjuste('bloquesUniOcultos', S.ocultos); }
    else if (confirm(`¿Borrar el bloque «${x.nombre}»?`)) { S.bloques = S.bloques.filter(y => y.id !== id); guardarAjuste('bloquesUni', S.bloques); }
    barra();
  }
  if (a === 'uni-bloque-ver') { S.ocultos = []; guardarAjuste('bloquesUniOcultos', []); barra(); }
  if (a === 'uni-bloque-crear') {
    const L = libre(); if (!L || !S.sel.size) return true;
    const nombre = prompt('Nombre del bloque (queda guardado en este navegador para usarlo en otros proyectos):', 'Mi bloque'); if (!nombre) return true;
    const es = [...S.sel].sort((x, y) => x - y).map(i => L.elems[i]), cj = cajaElems(es);
    S.bloques = [...S.bloques, { id: 'bl' + Date.now().toString(36), nombre: nombre.trim(), elems: normalizar(es, cj) }];
    guardarAjuste('bloquesUni', S.bloques); cerrarMenu(); barra(); toast(`Bloque «${nombre.trim()}» guardado`);
  }
  if (a === 'uni-copiar') copiar();
  if (a === 'uni-pegar') pegar();
  if (a === 'uni-borrar') borrarSel();
  if (a === 'uni-undo') deshacer();
  if (a === 'uni-redo') rehacer();
  if (a === 'uni-orto') { S.orto = !S.orto; barra(); }
  if (a === 'uni-regenerar') { if (confirm('¿Volver a armar el unilineal desde la base con los datos del proyecto? Se pierde lo dibujado a mano (se puede deshacer con Ctrl+Z).')) { antes(); delete uni().libre; S.sel.clear(); S.tool = 'sel'; listo(); barra(); } }
  if (a === 'uni-bases') galeria();
  if (a === 'uni-inv') { S.p.inversor = b.dataset.id; listo(); toast('Inversor cambiado; revisa los strings en el paso Strings'); }
  if (a === 'uni-z') { const k = +b.dataset.k, fit = S.zoom ? null : S.z; S.zoom = k === 0 ? null : Math.max(.3, Math.min(12, (S.zoom || fit || 1) * (k > 0 ? 1.25 : .8))); ajustar(); }
  if (a === 'uni-reset') { delete uni().textos?.[b.dataset.k]; listo(); }
  if (a === 'uni-reset-all') { if (confirm('¿Volver todos los textos del unilineal al texto calculado?')) { uni().textos = {}; listo(); } }
  return true;
}
function listo(panel = true) { cambio(); dibujarSVG(); if (panel) S.cb.panel && S.cb.panel(); }

document.addEventListener('change', ev => {
  const t = ev.target; if (!activo() || !t.matches?.('#props [data-uni]')) return;
  const k = t.dataset.uni, v = t.type === 'checkbox' ? t.checked : t.value, p = S.p, U = uni(), L = (p.lamina ||= {});
  const [pre, ...resto] = k.split('.'), campo = resto.join('.');
  if (pre === 'p') { if (campo === 'cantInv') p.cantInv = Math.max(1, Math.round(parseNum(v) || 1)); else p[campo] = v; }
  else if (pre === 'L') { if (campo.startsWith('largo_')) { const n = parseNum(v); if (n != null && isFinite(n)) L[campo] = n; else delete L[campo]; } else L[campo] = v; }
  else if (pre === 'u' && campo === 'base') { if (v) U.base = v; else delete U.base; }
  else if (pre === 'u') { if (v) delete U[campo]; else U[campo] = false; }
  else if (pre === 'x') { U.extras ||= {}; if (typeof v === 'boolean') { if (v) U.extras[campo] = true; else delete U.extras[campo]; } else if (String(v).trim()) U.extras[campo] = String(v).trim(); else delete U.extras[campo]; }
  else if (pre === 's') {
    const [id, c] = [resto[0], resto[1]], st = p.strings.find(x => x.id === id); if (!st) return;
    if (c === 'mppt') { st.mppt = +v; st.num = p.strings.filter(x => x !== st && x.mppt === +v).length + 1; }
    else if (c === 'largo') { const n = parseNum(v); if (n != null && isFinite(n)) st.largo = n; else delete st.largo; }
    else if (c === 'seccion') st.seccion = parseNum(v) || 6;
  }
  listo(typeof v === 'boolean' || k === 'u.base' ||['p.inversor', 'p.cantInv'].includes(k) || pre === 's' || pre === 'L');
});

/* ---------- Clic en un texto del diagrama: escribirlo ahí mismo ---------- */
document.addEventListener('click', ev => {
  if (!activo()) return;
  if (S.tool !== 'sel' || libre()) return;
  const t = ev.target.closest?.('.uni-papel text[data-u]'); if (!t) return;
  editarTexto(t);
});
function editarTexto(t) {
  document.querySelector('.uni-edit')?.remove();
  const k = t.dataset.u, r = t.getBoundingClientRect(), original = t.textContent, modificado = t.hasAttribute('data-mod');
  const inp = document.createElement('input'); inp.className = 'uni-edit'; inp.value = original;
  const fs = Math.max(12, r.height * .95);
  Object.assign(inp.style, { left: `${r.left - 4}px`, top: `${r.top + r.height / 2 - fs * .8}px`, width: `${Math.max(140, r.width + 40)}px`, fontSize: `${fs}px` });
  document.body.appendChild(inp); inp.focus(); inp.select();
  let hecho = false;
  const fin = guardar => {
    if (hecho) return; hecho = true; inp.remove();
    if (!guardar) return;
    const v = inp.value, U = uni(); U.textos ||= {};
    if (v === '') { if (!modificado) return; delete U.textos[k]; toast('Texto devuelto al calculado'); }
    else if (v === original) return;
    else U.textos[k] = v;
    listo();
  };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); fin(true); } else if (ev.key === 'Escape') { ev.preventDefault(); fin(false); } ev.stopPropagation(); });
  inp.addEventListener('blur', () => fin(true));
}

/* Ctrl + rueda: zoom del diagrama (la rueda sola desplaza) */
document.addEventListener('wheel', ev => {
  if (!activo() || !(ev.ctrlKey || ev.metaKey)) return;
  const sc = ev.target.closest?.('.uni-scroll'); if (!sc) return;
  ev.preventDefault();
  const r = sc.getBoundingClientRect(), mx = ev.clientX - r.left + sc.scrollLeft, my = ev.clientY - r.top + sc.scrollTop, z0 = S.z;
  S.zoom = Math.max(.3, Math.min(12, z0 * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); ajustar();
  const f = S.z / z0; sc.scrollLeft = mx * f - (ev.clientX - r.left); sc.scrollTop = my * f - (ev.clientY - r.top);
}, { passive: false });

/* Inversor que corresponde a una base cuando el del proyecto no calza (null si calza o no aplica) */
function invDeBase(b, p) {
  const I = inversorDe(p);
  if (b.soloEV || (b.inv ? b.inv.test(I.modelo) : (!b.fase || b.fase === I.fase))) return null;
  return INVERSORES.find(x => (b.inv ? b.inv.test(x.modelo) : true) && (!b.fase || x.fase === b.fase)) || null;
}
/* ---------- Galería de los unilineales base: todos a la vista, armados con este proyecto ---------- */
function galeria() {
  const p = S.p, R = calcular(p), SI = calcStrings(p, R), act = baseUni(p).id, sug = baseSugerida(p).id, grupos = [...new Set(BASES_UNI.map(b => b.g))];
  // cada base se muestra con un inversor que le calce (si el del proyecto no calza, con strings de muestra)
  const vista = b => {
    const otro = invDeBase(b, p), q = { ...p, inversor: otro ? otro.id : p.inversor, uni: { ...(p.uni || {}), base: b.id, textos: {}, libre: null } };
    return unilinealSVG(q, R, otro ? { ...calcStrings(q, R), lista: [] } : SI);
  };
  const tarjeta = b => `<button class="uni-gal-b${b.id === act ? ' on' : ''}" data-base="${b.id}"><div class="uni-gal-v">${vista(b)}</div><b>${esc(b.n)}</b>${b.id === sug ? '<em>Sugerido</em>' : ''}${b.id === act ? '<em class="act">En uso</em>' : ''}</button>`;
  const d = document.createElement('dialog'); d.className = 'dlg dlg-uni';
  d.innerHTML = `<form method="dialog"><h2>Unilineales base</h2><p class="mut">Los unilineales base de Ops, armados con los datos de este proyecto. Elige uno; después ajusta los datos y escribe cualquier texto con un clic.</p>
    ${grupos.map(g => `<div class="dl-sec"><h3>${esc(g)}</h3><div class="uni-gal">${BASES_UNI.filter(b => b.g === g).map(tarjeta).join('')}</div></div>`).join('')}
    <div class="row end"><button class="btn" value="cancel">Cerrar</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('click', ev => {
    const t = ev.target.closest('[data-base]'); if (!t) return; ev.preventDefault();
    if (libre() && !confirm('El unilineal está editado a mano. ¿Cambiarlo por esta base? (se puede deshacer con Ctrl+Z)')) return;
    antes(); delete uni().libre; S.sel.clear();
    uni().base = t.dataset.base; d.close(); listo(); barra(); toast('Unilineal base: ' + BASES_UNI.find(b => b.id === t.dataset.base).n);
  });
  d.addEventListener('close', () => d.remove());
}

/* ---------- Panel cuando el unilineal es un dibujo editable ---------- */
function panelLibre(p, sec) {
  const L = p.uni.libre, el = [...S.sel].map(i => L.elems[i]).filter(Boolean), tipos = new Set(el.map(e => e.t));
  const N = { l: 'línea', r: 'recuadro', x: 'texto', s: 'símbolo' };
  let h = sec('Dibujo editable', `<p class="mut">El unilineal «${esc(BASES_UNI.find(b => b.id === L.desde)?.n || baseUni(p).n)}» está como dibujo: elige partes con clic o ventana, muévelas, cópialas (Ctrl+C / Ctrl+V, también entre proyectos), bórralas (Supr) o agrega líneas, textos, símbolos y bloques con la barra de arriba. Doble clic en un texto para escribirlo.</p>
    <p class="mut">Los datos del proyecto (inversor, strings, largos) ya no cambian este dibujo solos.</p>
    <div class="row wrap"><button class="btn sm" data-act="uni-bases">Elegir otra base</button><button class="btn sm" data-act="uni-regenerar">Volver a la base</button></div>`);
  if (!el.length) return h + sec('Selección', '<p class="mut">Nada elegido. Clic en una parte, o arrastra una ventana: de izquierda a derecha toma lo que queda adentro; de derecha a izquierda, lo que toca.</p>');
  const v = (k, def) => { const xs = [...new Set(el.map(e => e[k]))]; return xs.length === 1 ? (xs[0] ?? def) : def; };
  let c = `<p class="mut">${el.length} parte(s): ${[...tipos].map(t => N[t]).join(', ')}.</p>`;
  if (tipos.has('l') || tipos.has('r')) {
    c += `<label class="f"><span>Color del trazo</span><select class="in" data-ued="c"><option value="">—</option>${COLORES_LINEA.map(x => `<option value="${x.c}" ${v('c') === x.c ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>
      <div class="row"><label class="f"><span>Grosor</span><select class="in" data-ued="w"><option value="">—</option>${[['.2', 'Fino'], ['.3', 'Normal'], ['.4', 'Grueso'], ['.6', 'Muy grueso']].map(([g, n]) => `<option value="${g}" ${String(v('w', v('sw'))) === g ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" data-ued="dash" ${v('dash') ? 'checked' : ''}> Punteada</label></div>`;
  }
  if (tipos.has('x')) {
    c += `${el.length === 1 ? `<label class="f"><span>Texto</span><input class="in" data-ued="s" value="${esc(el[0].s)}"></label>` : ''}
      <div class="row"><label class="f"><span>Tamaño</span><input class="in" data-ued="size" value="${v('size', '')}" inputmode="decimal"></label>
      <label class="f"><span>Alinear</span><select class="in" data-ued="a">${[['start', 'Izquierda'], ['middle', 'Centro'], ['end', 'Derecha']].map(([k, n]) => `<option value="${k}" ${v('a') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="row wrap"><label class="chk"><input type="checkbox" data-ued="b" ${v('b') ? 'checked' : ''}> Negrita</label><label class="chk"><input type="checkbox" data-ued="it" ${v('it') !== false ? 'checked' : ''}> Cursiva</label></div>
      <label class="f"><span>Color del texto</span><select class="in" data-ued="tc">${[['#111', 'Negro'], ['#DD1111', 'Rojo'], ['#2222BB', 'Azul'], ['#CC00CC', 'Magenta'], ['#1A8F3C', 'Verde']].map(([k, n]) => `<option value="${k}" ${v('c') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  }
  c += `<div class="row wrap"><button class="btn sm" data-act="uni-copiar">${ic('copy', 14)} Copiar</button><button class="btn sm" data-act="uni-bloque-crear">${ic('save', 14)} Guardar como bloque</button><button class="btn sm del" data-act="uni-borrar">${ic('trash', 14)} Borrar</button></div>`;
  return h + sec('Selección', c);
}
document.addEventListener('change', ev => {
  const t = ev.target; if (!activo() || !t.matches?.('#props [data-ued]')) return;
  const L = libre(); if (!L || !S.sel.size) return;
  const k = t.dataset.ued, v = t.type === 'checkbox' ? t.checked : t.value; antes();
  S.sel.forEach(i => {
    const e = L.elems[i]; if (!e) return;
    if ((e.t === 'l' || e.t === 'r') && k === 'c' && v) e.c = v;
    if (e.t === 'l' && k === 'w' && v) e.w = +v;
    if (e.t === 'r' && k === 'w' && v) e.sw = +v;
    if ((e.t === 'l' || e.t === 'r') && k === 'dash') { if (v) e.dash = e.t === 'l' ? '1.5 1' : '2 1'; else delete e.dash; }
    if (e.t === 'x') {
      if (k === 's') e.s = v;
      if (k === 'size') { const n = parseNum(v); if (n > 0) e.size = n; }
      if (k === 'a') e.a = v;
      if (k === 'b') e.b = v;
      if (k === 'it') e.it = v;
      if (k === 'tc') e.c = v;
    }
  });
  listo();
});
