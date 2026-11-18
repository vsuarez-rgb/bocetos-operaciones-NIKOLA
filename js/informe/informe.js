/* ==========================================================================
   Paso Informe: páginas armadas con bloques (texto, imagen, vistas de las
   hojas de diseño, tablas con datos de la ficha, unilineal, láminas A1).
   Cada página nace de una plantilla (las incluidas o las guardadas por la
   persona) y se puede editar libremente en el proyecto.
   ========================================================================== */
import { esc, ic, toast, uid } from '../util.js';
import { leerAjuste, guardarAjuste } from '../ajustes.js';
import { listaHojas, TIPOS_HOJA } from '../hojas.js';
import { TAMANOS, TIPOS_BLOQUE, PLANTILLAS_INCLUIDAS, PAQUETES, medida, copiarPagina, nuevoBloque, paginaEnBlanco } from './modelo.js';
import { htmlPagina, datosInforme, CSS_PAGINA, MM, olvidarVistas } from './pagina.js';

const S = { p: null, el: null, cb: {}, pag: null, sel: null, zoom: null, datos: null, mias: [], gen: 0 };
const informe = () => (S.p.informe ||= { paginas: [] });
const pagAct = () => informe().paginas.find(x => x.id === S.pag) || null;
const bloqueAct = () => pagAct()?.bloques.find(b => b.id === S.sel) || null;
const cambio = () => { S.cb.cambio && S.cb.cambio(); };

(function estilos() { if (document.getElementById('css-pagina')) return; const s = document.createElement('style'); s.id = 'css-pagina'; s.textContent = CSS_PAGINA; document.head.appendChild(s); })();

/* ---------- Vista principal ---------- */
export async function vistaInforme(el, p, cb = {}) {
  S.el = el; S.p = p; S.cb = cb; olvidarVistas();
  el.innerHTML = '<div class="inf-cargando">Preparando el informe…</div>';
  [S.datos, S.mias] = await Promise.all([datosInforme(p), leerAjuste('plantillasPagina').then(x => x || [])]);
  if (!pagAct()) S.pag = informe().paginas[0]?.id || null;
  pintar();
}

async function pintar() {
  const I = informe(), pg = pagAct();
  const gen = ++S.gen;
  S.el.innerHTML = `<div class="inf">
    <aside class="inf-pags" aria-label="Páginas del informe">
      <div class="inf-pags-t">Páginas <em>${I.paginas.length}</em></div>
      ${I.paginas.map((x, i) => `<button class="inf-pag" data-act="in-pag" data-id="${x.id}" aria-pressed="${x.id === S.pag}"><b>${i + 1}</b><span>${esc(x.nombre || 'Página')}</span><em>${esc(x.tamano)} ${x.orientacion === 'horizontal' ? '↔' : '↕'}</em></button>`).join('')}
      <button class="btn sm pri" data-act="in-nueva">${ic('plus', 14)} Agregar página</button>
    </aside>
    <section class="inf-lienzo">
      ${pg ? `<div class="inf-bar">
          <span class="inf-bar-t">${esc(pg.nombre || 'Página')} · ${esc(pg.tamano)} ${pg.orientacion}</span><span class="tb-sp"></span>
          <span class="inf-add">Agregar:</span>${Object.entries(TIPOS_BLOQUE).filter(([k]) => k !== 'lamina').map(([k, n]) => `<button class="inf-btn" data-act="in-add" data-k="${k}" title="Agregar ${n.toLowerCase()}">${n.replace(' de hoja de diseño', '')}</button>`).join('')}
          <span class="inf-zoom"><button data-act="in-zoom" data-k="-1" title="Alejar">−</button><button data-act="in-zoom" data-k="0" title="Ajustar a la pantalla">${S.zoom ? Math.round(S.zoom * 100) + ' %' : 'Ajustar'}</button><button data-act="in-zoom" data-k="1" title="Acercar">+</button></span>
        </div>
        <div class="inf-scroll"><div class="inf-hoja"><div class="pg-esc"><div class="inf-gen">Generando la página…</div></div></div></div>`
      : bienvenida()}
    </section></div>`;
  S.cb.panel && S.cb.panel();
  if (!pg) return;
  const html = await htmlPagina(pg, { p: S.p, datos: S.datos, editor: true, sel: S.sel });
  if (gen !== S.gen) return;                                   // se pidió otro dibujo mientras tanto
  const cont = S.el.querySelector('.pg-esc'); cont.innerHTML = html;
  ajustarZoom();
}
function bienvenida() {
  return `<div class="inf-vacio"><h2>Arma el informe del proyecto</h2>
    <p>Elige un informe completo para empezar (después puedes cambiar todo: textos, imágenes, qué hojas de diseño se muestran) o agrega páginas una a una.</p>
    <div class="inf-paq">${PAQUETES.map(q => `<button class="inf-paq-b" data-act="in-paquete" data-k="${q.id}"><b>${esc(q.nombre)}</b><span>${esc(q.detalle)}</span></button>`).join('')}</div>
    <button class="btn" data-act="in-nueva">${ic('plus', 14)} Agregar una página</button></div>`;
}
function ajustarZoom() {
  const pg = pagAct(), sc = S.el.querySelector('.inf-scroll'), hoja = S.el.querySelector('.inf-hoja'), esc_ = S.el.querySelector('.pg-esc'); if (!pg || !sc || !esc_) return;
  const [W, H] = medida(pg);
  const z = S.zoom || Math.max(.1, Math.min((sc.clientWidth - 48) / (W * MM), (sc.clientHeight - 48) / (H * MM)));
  esc_.style.transform = `scale(${z})`; hoja.style.width = `${W * MM * z}px`; hoja.style.height = `${H * MM * z}px`;
  S.z = z;
}
window.addEventListener('resize', () => { if (S.el?.isConnected && !S.zoom) ajustarZoom(); });

/* ---------- Panel lateral ---------- */
export function panelInforme(p) {
  if (!S.p) return '';
  const I = informe(), pg = pagAct(), b = bloqueAct();
  const sec = (t, c, abierto = true) => `<details class="pp" ${abierto ? 'open' : ''}><summary>${t}</summary><div class="pp-b">${c}</div></details>`;
  let h = sec('Informe', `<p class="mut">${I.paginas.length ? `${I.paginas.length} páginas. Cada una se edita libremente; guarda como plantilla las que quieras reutilizar.` : 'Todavía no hay páginas.'}</p>
    <button class="btn pri" data-act="in-pdf" ${I.paginas.length ? '' : 'disabled'}>${ic('print')} Imprimir / guardar PDF</button>
    <button class="btn" data-act="in-nueva">${ic('plus')} Agregar página</button>
    ${S.mias.length ? `<details class="in-mias"><summary>Mis plantillas (${S.mias.length})</summary>${S.mias.map(m => `<div class="row in-mia"><span>${esc(m.nombre)} <em>${esc(m.tamano)} ${m.orientacion === 'horizontal' ? '↔' : '↕'}</em></span><button class="btn sm del" data-act="in-mia-del" data-id="${m.id}" title="Borrar plantilla">${ic('trash', 14)}</button></div>`).join('')}</details>` : ''}`);
  if (b) h += sec(`Bloque · ${TIPOS_BLOQUE[b.tipo]}`, propsBloque(b));
  if (pg) h += sec('Página', `
    <label class="f"><span>Nombre</span><input class="in" data-in="pg.nombre" value="${esc(pg.nombre || '')}"></label>
    <div class="row"><label class="f"><span>Tamaño</span><select class="in" data-in="pg.tamano">${Object.keys(TAMANOS).map(k => `<option ${k === pg.tamano ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f"><span>Orientación</span><select class="in" data-in="pg.orientacion"><option value="vertical" ${pg.orientacion !== 'horizontal' ? 'selected' : ''}>Vertical</option><option value="horizontal" ${pg.orientacion === 'horizontal' ? 'selected' : ''}>Horizontal</option></select></label></div>
    <div class="row wrap"><button class="btn sm" data-act="in-pg-plantilla">${ic('save', 14)} Guardar como plantilla</button><button class="btn sm" data-act="in-pg-dup">${ic('copy', 14)} Duplicar</button></div>
    <div class="row wrap"><button class="btn sm" data-act="in-pg-mover" data-k="-1">↑ Subir</button><button class="btn sm" data-act="in-pg-mover" data-k="1">↓ Bajar</button><button class="btn sm del" data-act="in-pg-del">${ic('trash', 14)} Borrar página</button></div>
    <p class="mut">Clic en un bloque para editarlo; arrástralo para moverlo y usa la esquina para el tamaño (Mayús = de a 5 mm). Supr lo borra.</p>`, !b);
  return h;
}
function propsBloque(b) {
  const num = (k, l, paso = 1) => `<label class="f"><span>${l}</span><input class="in" type="number" step="${paso}" data-in="b.${k}" value="${b[k] ?? ''}"></label>`;
  const chk = (k, l) => `<label class="chk"><input type="checkbox" data-in="b.${k}" ${b[k] ? 'checked' : ''}> ${l}</label>`;
  const sel = (k, l, ops) => `<label class="f"><span>${l}</span><select class="in" data-in="b.${k}">${ops.map(([v, n]) => `<option value="${esc(v)}" ${String(b[k] ?? '') === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  const campos = `<label class="f"><span>Insertar un campo de la ficha</span><select class="in" data-in-campo><option value="">Elegir…</option><optgroup label="Proyecto">${S.datos.extras.map(k => `<option>${esc(k)}</option>`).join('')}</optgroup>${S.datos.dic ? `<optgroup label="Ficha">${S.datos.dic.campos.filter(c => c.tipo === 'campo').map(c => `<option>${esc(c.id)}</option>`).join('')}</optgroup>` : ''}</select></label>`;
  let h = '';
  if (b.tipo === 'texto') h += `<label class="f"><span>Texto</span><textarea class="in" rows="6" data-in="b.texto">${esc(b.texto || '')}</textarea></label>${campos}
    <p class="mut">{Campo} se reemplaza por el dato del proyecto. **así** queda en negrita y [rojo](así) en rojo.</p>
    <div class="row">${num('tam', 'Letra (pt)', .5)}${sel('alinear', 'Alinear', [['izq', 'Izquierda'], ['centro', 'Centro'], ['der', 'Derecha']])}</div>
    <div class="row">${sel('color', 'Color', [['negro', 'Negro'], ['azul', 'Azul Nikola'], ['gris', 'Gris'], ['rojo', 'Rojo']])}</div>
    <div class="row wrap">${chk('negrita', 'Negrita')}${chk('cursiva', 'Cursiva')}${chk('justificar', 'Justificar')}${chk('mayusculas', 'MAYÚSCULAS')}</div>`;
  if (b.tipo === 'imagen') h += `<label class="btn sm">${ic('upload', 14)} ${b.src ? 'Cambiar imagen' : 'Subir imagen'}<input type="file" accept="image/*" data-in-img hidden></label>
    ${b.src ? '<button class="btn sm" data-act="in-img-quitar">Quitar imagen</button>' : ''}${sel('ajuste', 'Ajuste', [['contener', 'Completa (sin recortar)'], ['cubrir', 'Llenar el recuadro (recorta)']])}
    <label class="f"><span>Descripción (solo se ve mientras está vacía)</span><input class="in" data-in="b.ayuda" value="${esc(b.ayuda || '')}"></label>`;
  if (b.tipo === 'vista') {
    const hs = listaHojas(S.p), ops = hs.map(x => [x.id || 'principal', x.nombre]);
    if (b.hoja && !ops.some(o => o[0] === b.hoja)) { const m = /^tipo:(\w+)(?:#(\d+))?$/.exec(b.hoja); ops.push([b.hoja, m ? `La ${m[2] || 1}ª de tipo «${TIPOS_HOJA[m[1]] || m[1]}»` : 'Hoja borrada']); }
    h += `${sel('hoja', 'Hoja de diseño', ops)}${sel('encuadre', 'Encuadre', [['dibujo', 'Ajustado a lo dibujado'], ['foto', 'Foto completa']])}
      <label class="f"><span>Foto (opacidad)</span><span class="fr"><input type="range" min="20" max="100" data-in="b.foto" value="${b.foto ?? 100}"><output>${b.foto ?? 100}%</output></span></label>`;
  }
  if (b.tipo === 'tabla') h += `<label class="f"><span>Título</span><input class="in" data-in="b.titulo" value="${esc(b.titulo || '')}"></label>
    ${sel('tituloColor', 'Color del título', [['negro', 'Negro'], ['rojo', 'Rojo'], ['azul', 'Azul Nikola']])}
    <label class="f"><span>Filas (una por línea, celdas separadas por | )</span><textarea class="in mono" rows="7" data-in="b.filas">${esc((b.filas || []).map(f => f.join(' | ')).join('\n'))}</textarea></label>${campos}
    <div class="row">${num('tam', 'Letra (pt)', .5)}<label class="f"><span>Ancho columnas (%)</span><input class="in" data-in="b.anchos" value="${esc(b.anchos || '')}" placeholder="35,30"></label></div>
    <div class="row wrap">${chk('cabecera', 'Primera fila es encabezado')}${chk('mayusculas', 'Datos en MAYÚSCULAS')}</div>${sel('cuerpo', 'Estilo', [['', 'Planos (cursiva, como AutoCAD)'], ['normal', 'Documento (texto normal)']])}`;
  if (b.tipo === 'lamina') h += sel('lamina', 'Lámina', [['01', 'Lámina 01 · Planta y unilineal'], ['02', 'Lámina 02 · Cuadros de carga']]) + '<p class="mut">Los datos del cajetín se completan en el paso Lámina.</p>';
  if (b.tipo === 'unilineal') h += '<p class="mut">Es el unilineal del proyecto, el mismo de la lámina A1.</p>';
  h += `<div class="row">${num('x', 'X (mm)')}${num('y', 'Y (mm)')}</div><div class="row">${num('w', 'Ancho (mm)')}${num('h', 'Alto (mm)')}</div>
    ${['texto', 'imagen', 'vista', 'tabla', 'unilineal', 'recuadro'].includes(b.tipo) ? chk('borde', 'Con borde') : ''}
    <div class="row wrap"><button class="btn sm" data-act="in-b-orden" data-k="1">Al frente</button><button class="btn sm" data-act="in-b-orden" data-k="-1">Atrás</button><button class="btn sm" data-act="in-b-dup">${ic('copy', 14)} Duplicar</button><button class="btn sm del" data-act="in-b-del">${ic('trash', 14)} Borrar</button></div>`;
  return h;
}

/* ---------- Acciones ---------- */
export function accionInforme(a, el) {
  if (!a.startsWith('in-')) return false;
  const I = informe(), pg = pagAct(), b = bloqueAct();
  const repintar = () => { cambio(); pintar(); };
  switch (a) {
    case 'in-pag': S.pag = el.dataset.id; S.sel = null; S.zoom = null; pintar(); break;
    case 'in-nueva': dialogoNueva(); break;
    case 'in-paquete': agregarPaquete(el.dataset.k); break;
    case 'in-add': { const [W, H] = medida(pg), nb = nuevoBloque(el.dataset.k, 20, 20); nb.x = Math.max(0, Math.round((W - nb.w) / 2)); nb.y = Math.max(0, Math.round((H - nb.h) / 2)); pg.bloques.push(nb); S.sel = nb.id; repintar(); break; }
    case 'in-zoom': { const k = +el.dataset.k; S.zoom = k === 0 ? null : Math.max(.1, Math.min(4, (S.zoom || S.z || 1) * (k > 0 ? 1.25 : .8))); pintar(); break; }
    case 'in-pdf': imprimir(); break;
    case 'in-pg-dup': { const c = copiarPagina(pg, { nombre: `${pg.nombre} (copia)` }); I.paginas.splice(I.paginas.indexOf(pg) + 1, 0, c); S.pag = c.id; repintar(); break; }
    case 'in-pg-mover': { const i = I.paginas.indexOf(pg), j = i + +el.dataset.k; if (j < 0 || j >= I.paginas.length) break; I.paginas.splice(i, 1); I.paginas.splice(j, 0, pg); repintar(); break; }
    case 'in-pg-del': { if (!confirm(`¿Borrar la página «${pg.nombre}»?`)) break; const i = I.paginas.indexOf(pg); I.paginas.splice(i, 1); S.pag = I.paginas[Math.max(0, i - 1)]?.id || null; S.sel = null; repintar(); break; }
    case 'in-pg-plantilla': guardarPlantilla(pg); break;
    case 'in-mia-del': { const m = S.mias.find(x => x.id === el.dataset.id); if (m && confirm(`¿Borrar la plantilla «${m.nombre}»? Las páginas que ya la usan no cambian.`)) { S.mias = S.mias.filter(x => x !== m); guardarAjuste('plantillasPagina', S.mias); S.cb.panel && S.cb.panel(); } break; }
    case 'in-b-del': borrarBloque(); break;
    case 'in-b-dup': { const c = { ...JSON.parse(JSON.stringify(b)), id: uid('b'), x: b.x + 5, y: b.y + 5 }; pg.bloques.push(c); S.sel = c.id; repintar(); break; }
    case 'in-b-orden': { const i = pg.bloques.indexOf(b); pg.bloques.splice(i, 1); if (+el.dataset.k > 0) pg.bloques.push(b); else pg.bloques.unshift(b); repintar(); break; }
    case 'in-img-quitar': b.src = null; repintar(); break;
  }
  return true;
}
function borrarBloque() { const pg = pagAct(), b = bloqueAct(); if (!b) return; pg.bloques = pg.bloques.filter(x => x !== b); S.sel = null; cambio(); pintar(); }

function agregarPaquete(id) {
  const q = PAQUETES.find(x => x.id === id); if (!q) return;
  const nuevas = q.paginas.map(pid => PLANTILLAS_INCLUIDAS.find(x => x.id === pid)).filter(Boolean).map(x => copiarPagina(x, { desde: x.id }));
  informe().paginas.push(...nuevas); S.pag = nuevas[0]?.id || S.pag; S.sel = null; cambio(); pintar();
  toast(`${nuevas.length} páginas de «${q.nombre}» agregadas`);
}
function dialogoNueva() {
  const grupos = {}; for (const x of PLANTILLAS_INCLUIDAS) (grupos[x.grupo] ||= []).push(x);
  const item = (x, mia) => `<button class="dl-pl" data-pl="${x.id}" data-mia="${mia ? 1 : ''}"><b>${esc(x.nombre)}</b><span>${esc(x.tamano)} ${x.orientacion === 'horizontal' ? 'horizontal' : 'vertical'} · ${x.bloques.length} bloques</span></button>`;
  const d = document.createElement('dialog'); d.className = 'dlg dlg-pl';
  d.innerHTML = `<form method="dialog"><h2>Agregar página</h2>
    <div class="dl-sec"><h3>Informe completo</h3><div class="dl-grid">${PAQUETES.map(q => `<button class="dl-pl" data-paq="${q.id}"><b>${esc(q.nombre)}</b><span>${esc(q.detalle)}</span></button>`).join('')}</div></div>
    ${S.mias.length ? `<div class="dl-sec"><h3>Mis plantillas</h3><div class="dl-grid">${S.mias.map(x => item(x, true)).join('')}</div></div>` : ''}
    ${Object.entries(grupos).map(([g, xs]) => `<div class="dl-sec"><h3>${esc(g)}</h3><div class="dl-grid">${xs.map(x => item(x)).join('')}</div></div>`).join('')}
    <div class="dl-sec"><h3>En blanco</h3><div class="dl-grid">${[['A4', 'vertical'], ['A4', 'horizontal'], ['A3', 'horizontal'], ['A1', 'horizontal']].map(([t, o]) => `<button class="dl-pl" data-blanco="${t}|${o}"><b>${t} ${o}</b><span>Página vacía</span></button>`).join('')}</div></div>
    <div class="row end"><button class="btn" value="cancel">Cerrar</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('click', ev => {
    const t = ev.target.closest('.dl-pl'); if (!t) return; ev.preventDefault();
    if (t.dataset.paq) { d.close(); agregarPaquete(t.dataset.paq); return; }
    let nueva;
    if (t.dataset.blanco) { const [ta, o] = t.dataset.blanco.split('|'); nueva = paginaEnBlanco(ta, o); }
    else { const fuente = (t.dataset.mia ? S.mias : PLANTILLAS_INCLUIDAS).find(x => x.id === t.dataset.pl); nueva = copiarPagina(fuente, { desde: fuente.id }); }
    const I = informe(), i = I.paginas.indexOf(pagAct()); I.paginas.splice(i < 0 ? I.paginas.length : i + 1, 0, nueva);
    S.pag = nueva.id; S.sel = null; d.close(); cambio(); pintar();
  });
  d.addEventListener('close', () => d.remove());
}
async function guardarPlantilla(pg) {
  const nombre = prompt('Nombre de la plantilla (para reutilizarla en otros proyectos):', pg.nombre || 'Mi página'); if (!nombre) return;
  const pl = copiarPagina(pg, { id: uid('pl'), nombre: nombre.trim(), grupo: 'Mis plantillas', incluida: false, guardada: new Date().toISOString() });
  delete pl.desde;
  S.mias = [...S.mias, pl]; await guardarAjuste('plantillasPagina', S.mias);
  toast('Plantilla guardada en este navegador'); S.cb.panel && S.cb.panel();
}

/* ---------- Editar propiedades (panel) ---------- */
function aplicar(t) {
  const pg = pagAct(), b = bloqueAct(), k = t.dataset.in; if (!pg) return;
  const v = t.type === 'checkbox' ? t.checked : t.value;
  if (k.startsWith('pg.')) { pg[k.slice(3)] = v; S.zoom = null; cambio(); pintar(); return; }
  if (!b) return;
  const c = k.slice(2);
  if (c === 'filas') b.filas = String(v).split('\n').map(l => l.split('|').map(x => x.trim()));
  else if (['x', 'y', 'w', 'h', 'tam', 'foto'].includes(c)) { const n = parseFloat(String(v).replace(',', '.')); if (!isFinite(n)) return; b[c] = c === 'w' || c === 'h' ? Math.max(3, n) : n; }
  else b[c] = v;
  cambio(); pintar();
}
let tTexto = null;
document.addEventListener('input', ev => {
  const t = ev.target; if (!S.el?.isConnected || !t.matches?.('#props [data-in]')) return;
  if (t.type === 'range') { const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value + '%'; }
  if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'number', 'range'].includes(t.type))) { clearTimeout(tTexto); tTexto = setTimeout(() => aplicarSinPanel(t), 350); }
});
function aplicarSinPanel(t) {   // mientras se escribe: actualizar la página sin rehacer el panel (no se pierde el foco)
  const pg = pagAct(), b = bloqueAct(), k = t.dataset.in; if (!pg) return;
  if (k.startsWith('pg.')) pg[k.slice(3)] = t.value;
  else if (b) { const c = k.slice(2); if (c === 'filas') b.filas = t.value.split('\n').map(l => l.split('|').map(x => x.trim())); else b[c] = t.value; }
  cambio(); repintarPagina();
}
async function repintarPagina() {
  const pg = pagAct(), cont = S.el?.querySelector('.pg-esc'); if (!pg || !cont) return;
  const gen = ++S.gen, html = await htmlPagina(pg, { p: S.p, datos: S.datos, editor: true, sel: S.sel }); if (gen !== S.gen) return;
  cont.innerHTML = html; ajustarZoom();
  const lista = S.el.querySelector(`.inf-pag[data-id="${pg.id}"] span`); if (lista) lista.textContent = pg.nombre || 'Página';
}
document.addEventListener('change', ev => {
  const t = ev.target; if (!S.el?.isConnected) return;
  if (t.matches?.('#props [data-in]')) { clearTimeout(tTexto); aplicar(t); }
  if (t.matches?.('#props [data-in-campo]') && t.value) {
    const area = document.querySelector('#props textarea[data-in="b.texto"], #props textarea[data-in="b.filas"]');
    if (area) { const ins = `{${t.value}}`, i = area.selectionStart ?? area.value.length; area.value = area.value.slice(0, i) + ins + area.value.slice(area.selectionEnd ?? i); aplicar(area); }
    t.value = '';
  }
  if (t.matches?.('[data-in-img]') && t.files[0]) { const f = t.files[0]; t.value = ''; subirImagen(f); }
});
async function subirImagen(f) {
  const b = bloqueAct(); if (!b) return;
  const url = URL.createObjectURL(f), im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
  if (!im) return toast('No se pudo leer la imagen');
  const max = 2200, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  b.src = /png|svg/i.test(f.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .88); URL.revokeObjectURL(url);
  cambio(); pintar();
}

/* ---------- Mover y redimensionar bloques con el mouse ---------- */
let D = null;
document.addEventListener('pointerdown', ev => {
  if (!S.el?.isConnected) return;
  const pgEl = ev.target.closest('.inf-lienzo .pg'); if (!pgEl) return;
  const bq = ev.target.closest('.bq');
  if (!bq) { if (S.sel) { S.sel = null; seleccionarVisual(); S.cb.panel && S.cb.panel(); } return; }
  const b = pagAct()?.bloques.find(x => x.id === bq.dataset.b); if (!b) return;
  ev.preventDefault();
  if (S.sel !== b.id) { S.sel = b.id; seleccionarVisual(); S.cb.panel && S.cb.panel(); }
  D = { b, el: bq, modo: ev.target.classList.contains('bq-h') ? 'tam' : 'mover', sx: ev.clientX, sy: ev.clientY, x: b.x, y: b.y, w: b.w, h: b.h, movio: false };
  bq.setPointerCapture?.(ev.pointerId);
});
document.addEventListener('pointermove', ev => {
  if (!D) return;
  const k = MM * (S.z || 1), dx = (ev.clientX - D.sx) / k, dy = (ev.clientY - D.sy) / k, paso = ev.shiftKey ? 5 : 1, r = v => Math.round(v / paso) * paso;
  if (Math.abs(dx) + Math.abs(dy) > .5) D.movio = true;
  if (D.modo === 'mover') { D.b.x = r(D.x + dx); D.b.y = r(D.y + dy); D.el.style.left = D.b.x + 'mm'; D.el.style.top = D.b.y + 'mm'; }
  else { D.b.w = Math.max(3, r(D.w + dx)); D.b.h = Math.max(3, r(D.h + dy)); D.el.style.width = D.b.w + 'mm'; D.el.style.height = D.b.h + 'mm'; }
});
document.addEventListener('pointerup', () => {
  if (!D) return; const d = D; D = null;
  if (!d.movio) return;
  cambio(); S.cb.panel && S.cb.panel();
  if (d.modo === 'tam' && ['vista', 'lamina', 'unilineal'].includes(d.b.tipo)) repintarPagina();   // las vistas se vuelven a dibujar al nuevo tamaño
});
document.addEventListener('dblclick', ev => {
  if (!S.el?.isConnected) return; const bq = ev.target.closest('.inf-lienzo .bq'); if (!bq) return;
  const b = bloqueAct(); if (b?.tipo === 'imagen') document.querySelector('#props [data-in-img]')?.click();
  if (b?.tipo === 'texto' || b?.tipo === 'tabla') document.querySelector('#props textarea')?.focus();
});
document.addEventListener('keydown', ev => {
  if (!S.el?.isConnected || !S.sel || ev.target.matches('input, textarea, select')) return;
  const b = bloqueAct(); if (!b) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); borrarBloque(); return; }
  const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
  if (m) { ev.preventDefault(); const p = ev.shiftKey ? 5 : 1; b.x += m[0] * p; b.y += m[1] * p; const el = S.el.querySelector(`.bq[data-b="${b.id}"]`); if (el) { el.style.left = b.x + 'mm'; el.style.top = b.y + 'mm'; } cambio(); }
});
function seleccionarVisual() { S.el.querySelectorAll('.inf-lienzo .bq').forEach(x => x.classList.toggle('sel', x.dataset.b === S.sel)); }

/* ---------- Imprimir / PDF: todas las páginas, cada una con su tamaño ---------- */
async function imprimir() {
  const I = informe(); if (!I.paginas.length) return;
  toast('Preparando el informe…');
  const w = window.open('', '_blank'); if (!w) return toast('El navegador bloqueó la ventana: permite ventanas emergentes');
  w.document.write('<p style="font:14px sans-serif;padding:20px">Preparando el informe…</p>');
  const html = await htmlImpresion();
  w.document.open(); w.document.write(html); w.document.close();
}
/* Documento HTML con todas las páginas, cada una con su tamaño de papel (@page con nombre) */
export async function htmlImpresion() {
  const I = informe();
  const paginas = []; for (const pg of I.paginas) paginas.push({ pg, html: await htmlPagina(pg, { p: S.p, datos: S.datos, editor: false }) });
  const nombres = [...new Set(I.paginas.map(pg => medida(pg).join('x')))];
  const css = nombres.map(n => { const [W, H] = n.split('x'); return `@page p${n.replace('.', '_')} { size: ${W}mm ${H}mm; margin: 0 }`; }).join('\n');
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  return (`<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><title>${esc((S.p.codigo || 'Proyecto') + ' — Informe')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <style>${CSS_PAGINA}${css}
      html, body { margin: 0; background: #6b7378; } .pg { margin: 0 auto 8mm; box-shadow: 0 2px 12px rgba(0,0,0,.3); }
      .aviso { font: 14px sans-serif; color: #fff; text-align: center; padding: 10px; }
      @media print { html, body { background: none; } .aviso { display: none; } .pg { margin: 0; box-shadow: none; break-after: page; } }</style></head>
    <body><div class="aviso">En el diálogo de impresión elige «Guardar como PDF». Cada página sale con su tamaño (${[...new Set(I.paginas.map(p => `${p.tamano} ${p.orientacion}`))].join(', ')}).</div>
    ${paginas.map(({ pg, html }) => html.replace(/^(<div class="pg" data-pg="[^"]*" style=")/, `$1page:p${medida(pg).join('x').replace('.', '_')};`)).join('\n')}
    <script>Promise.all([document.fonts.ready, ...[...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))]).then(() => setTimeout(() => print(), 400))<\/script></body></html>`);
}
