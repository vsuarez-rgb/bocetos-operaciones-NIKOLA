/* ==========================================================================
   Paso "Informe y planos": páginas armadas con bloques (texto, imagen, vistas
   de las hojas de diseño, tablas, unilineal, láminas A1), en dos secciones:
     · Informe            → documentos para el cliente (Propuesta de diseño…)
     · Láminas y planos   → láminas A1, planos para el contratista
   Cada página nace de una plantilla (incluida o guardada por la persona) y se
   edita libremente: las tablas se escriben en la misma página (doble clic en
   una celda) y las vistas se encuadran con el mouse, como una ventana gráfica
   de AutoCAD (doble clic, rueda para zoom, arrastrar para mover).
   ========================================================================== */
import { esc, ic, toast, uid } from '../util.js';
import { leerAjuste, guardarAjuste } from '../ajustes.js';
import { listaHojas, TIPOS_HOJA } from '../hojas.js';
import { calcular, calcStrings } from '../geom.js';
import { panelLamina } from '../lamina.js';
import { TAMANOS, TIPOS_BLOQUE, PLANTILLAS_INCLUIDAS, PAQUETES, SECCIONES, seccionDe, medida, copiarPagina, nuevoBloque, paginaEnBlanco, esFijo } from './modelo.js';
import { htmlPagina, datosInforme, CSS_PAGINA, MM, olvidarVistas, imagenHoja } from './pagina.js';

/* plantilla: { pg, id, mia } cuando se está editando una plantilla (no una página del proyecto) */
const S = { p: null, el: null, cb: {}, pag: null, sel: null, zoom: null, datos: null, mias: [], editadas: {}, plantilla: null, gen: 0, ventanas: {}, encuadre: null };
const informe = () => (S.p.informe ||= { paginas: [] });
const pagAct = () => S.plantilla ? S.plantilla.pg : informe().paginas.find(x => x.id === S.pag) || null;
const bloqueAct = () => pagAct()?.bloques.find(b => b.id === S.sel) || null;
/* Plantillas incluidas, con los cambios que les haya hecho la persona (guardados en el navegador) */
const incluida = id => S.editadas[id] || PLANTILLAS_INCLUIDAS.find(x => x.id === id);
let tPlantilla = null;
const cambio = () => {
  if (S.plantilla) { S.plantilla.sucio = true; clearTimeout(tPlantilla); tPlantilla = setTimeout(guardarPlantillaEditada, 400); return; }
  S.cb.cambio && S.cb.cambio();
};
const panel = () => { S.cb.panel && S.cb.panel(); };
const activo = () => !!S.el?.isConnected;

(function estilos() { if (document.getElementById('css-pagina')) return; const s = document.createElement('style'); s.id = 'css-pagina'; s.textContent = CSS_PAGINA; document.head.appendChild(s); })();

/* ---------- Vista principal ---------- */
export async function vistaInforme(el, p, cb = {}) {
  S.el = el; S.p = p; S.cb = cb; S.encuadre = null; S.plantilla = null; olvidarVistas();
  el.innerHTML = '<div class="inf-cargando">Preparando el informe…</div>';
  [S.datos, S.mias, S.editadas] = await Promise.all([datosInforme(p), leerAjuste('plantillasPagina').then(x => x || []), leerAjuste('plantillasEditadas').then(x => x || {})]);
  for (const pg of informe().paginas) pg.seccion ||= seccionDe(pg);
  if (!pagAct()) S.pag = informe().paginas[0]?.id || null;
  pintar();
}

/* Después de deshacer o rehacer (Ctrl+Z / Ctrl+Y): el proyecto cambió por dentro, se vuelve a pintar igual */
export function repintarInforme() {
  if (!activo()) return;
  if (!pagAct()) S.pag = informe().paginas[0]?.id || null;
  if (S.sel && !bloqueAct()) S.sel = null;
  pintar();
}
async function pintar() {
  const I = informe(), pg = pagAct(), gen = ++S.gen;
  const scPrev = S.el.querySelector('.inf-scroll'), scroll = scPrev && S.pagPintada === (S.plantilla ? 'pl:' + S.plantilla.id : S.pag) ? [scPrev.scrollLeft, scPrev.scrollTop] : null;
  S.pagPintada = S.plantilla ? 'pl:' + S.plantilla.id : S.pag;
  const grupo = sec => { const ps = I.paginas.filter(x => seccionDe(x) === sec); return `<div class="inf-grupo" data-sec="${sec}"><div class="inf-pags-t">${SECCIONES[sec]} <em>${ps.length}</em><button class="inf-mas" data-act="in-nueva" data-k="${sec}" title="Agregar página a ${SECCIONES[sec].toLowerCase()}">${ic('plus', 13)}</button></div>
      ${ps.map(x => `<button class="inf-pag" draggable="true" data-act="in-pag" data-id="${x.id}" aria-pressed="${!S.plantilla && x.id === S.pag}" title="Arrastra para cambiar el orden (también a la otra sección)"><b>${I.paginas.indexOf(x) + 1}</b><span>${esc(x.nombre || 'Página')}</span><em>${esc(x.tamano)} ${x.orientacion === 'horizontal' ? '↔' : '↕'}</em></button>`).join('') || `<p class="inf-sin">Sin páginas · arrastra una aquí</p>`}</div>`; };
  S.el.innerHTML = `<div class="inf">
    <aside class="inf-pags" aria-label="Páginas">${S.plantilla ? `<div class="inf-pl-ed">${ic('sheet', 15)}<div><b>Editando una plantilla</b><span>${esc(S.plantilla.pg.nombre)}</span></div>
        <p>Los cambios se guardan solos en la plantilla y se usan en las páginas nuevas que se armen con ella. Las páginas que ya están en los proyectos no cambian.</p>
        <button class="btn sm pri" data-act="in-pl-salir">Terminar</button>${!S.plantilla.mia && (S.editadas[S.plantilla.id] || S.plantilla.sucio) ? '<button class="btn sm" data-act="in-pl-original">Volver a la original</button>' : ''}</div>` : ''}${grupo('informe')}${grupo('planos')}</aside>
    <section class="inf-lienzo">
      ${pg ? `<div class="inf-bar">
          <span class="inf-bar-t">${S.plantilla ? 'Plantilla: ' : ''}${esc(pg.nombre || 'Página')} · ${esc(pg.tamano)} ${pg.orientacion}</span><span class="tb-sp"></span>
          <span class="inf-add">Agregar:</span>${Object.entries(TIPOS_BLOQUE).map(([k, n]) => `<button class="inf-btn" data-act="in-add" data-k="${k}" title="Agregar ${n.toLowerCase()}">${n.replace(' de hoja de diseño', '').replace(' (modo plano)', '')}</button>`).join('')}
          <span class="inf-zoom" title="Ctrl + rueda del mouse también hace zoom"><button data-act="in-zoom" data-k="-1" title="Alejar">−</button><button data-act="in-zoom" data-k="0" title="Ajustar la página a la pantalla" id="infZ">Ajustar</button><button data-act="in-zoom" data-k="1" title="Acercar">+</button></span>
        </div>
        <div class="inf-scroll"><div class="inf-hoja"><div class="pg-esc"><div class="inf-gen">Generando la página…</div></div></div></div>
        <div class="inf-ayuda" hidden></div>`
      : bienvenida()}
    </section></div>`;
  panel();
  if (!pg) return;
  S.ventanas = {};
  const html = await htmlPagina(pg, { p: S.p, datos: S.datos, editor: true, sel: S.sel, ventanas: S.ventanas });
  if (gen !== S.gen) return;                                   // se pidió otro dibujo mientras tanto
  S.el.querySelector('.pg-esc').innerHTML = html;
  ajustarZoom(); marcarEncuadre();
  if (scroll) { const sc = S.el.querySelector('.inf-scroll'); if (sc) { sc.scrollLeft = scroll[0]; sc.scrollTop = scroll[1]; } }
}
function bienvenida() {
  const paq = sec => PAQUETES.filter(q => q.seccion === sec).map(q => `<button class="inf-paq-b" data-act="in-paquete" data-k="${q.id}"><b>${esc(q.nombre)}</b><span>${esc(q.detalle)}</span></button>`).join('');
  return `<div class="inf-vacio"><h2>Informe y planos del proyecto</h2>
    <p>Elige con qué empezar. Después puedes cambiar todo: textos, tablas, imágenes, qué hojas de diseño se muestran y cómo se encuadran.</p>
    <div class="inf-vacio-g"><div><h3>Informe</h3><div class="inf-paq">${paq('informe')}</div></div><div><h3>Láminas y planos</h3><div class="inf-paq">${paq('planos')}</div></div></div>
    <button class="btn" data-act="in-nueva">${ic('plus', 14)} Agregar una página</button></div>`;
}
function ajustarZoom() {
  const pg = pagAct(), sc = S.el.querySelector('.inf-scroll'), hoja = S.el.querySelector('.inf-hoja'), cont = S.el.querySelector('.pg-esc'); if (!pg || !sc || !cont) return;
  const [W, H] = medida(pg);
  const fit = Math.max(.1, Math.min((sc.clientWidth - 48) / (W * MM), (sc.clientHeight - 48) / (H * MM))), z = S.zoom || fit;
  cont.style.transform = `scale(${z})`; hoja.style.width = `${W * MM * z}px`; hoja.style.height = `${H * MM * z}px`;
  S.z = z;
  const bz = S.el.querySelector('#infZ'); if (bz) bz.textContent = S.zoom ? `${Math.round(S.zoom / fit * 100)} %` : 'Ajustar';
}
/* Zoom de la página: la hoja queda fija en su lugar (no se arrastra ni se recorta); se recorre con las barras.
   (sx, sy) = punto de la pantalla que se queda quieto al hacer zoom. */
function zoomPagina(z, sx, sy) {
  const sc = S.el.querySelector('.inf-scroll'); if (!sc) return;
  const r = sc.getBoundingClientRect(); sx ??= r.left + sc.clientWidth / 2; sy ??= r.top + sc.clientHeight / 2;
  const hoja = S.el.querySelector('.inf-hoja'), hr = hoja.getBoundingClientRect(), z0 = S.z || 1;
  const fx = (sx - hr.left) / (hr.width || 1), fy = (sy - hr.top) / (hr.height || 1);
  S.zoom = z; ajustarZoom();
  const nr = hoja.getBoundingClientRect();
  sc.scrollLeft += (nr.left + fx * nr.width) - sx; sc.scrollTop += (nr.top + fy * nr.height) - sy;
}
document.addEventListener('wheel', ev => {
  if (!activo() || !(ev.ctrlKey || ev.metaKey)) return;
  if (!ev.target.closest?.('.inf-lienzo .inf-scroll')) return;
  ev.preventDefault();
  zoomPagina(Math.max(.1, Math.min(8, (S.z || 1) * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))), ev.clientX, ev.clientY);
}, { passive: false });
window.addEventListener('resize', () => { if (activo() && !S.zoom) ajustarZoom(); });

/* ---------- Panel lateral ---------- */
export function panelInforme(p) {
  if (!S.p) return '';
  const I = informe(), pg = pagAct(), b = bloqueAct();
  const sec = (t, c, abierto = true) => `<details class="pp" ${abierto ? 'open' : ''}><summary>${t}</summary><div class="pp-b">${c}</div></details>`;
  const n = s => I.paginas.filter(x => seccionDe(x) === s).length;
  const filaPl = (m, mia) => `<div class="row in-mia${S.plantilla && S.plantilla.id === m.id ? ' on' : ''}"><span>${esc(m.nombre)} <em>${esc(m.tamano)} ${m.orientacion === 'horizontal' ? '↔' : '↕'}${!mia && S.editadas[m.id] ? ' · editada' : ''}</em></span>
    <button class="btn sm" data-act="in-pl-editar" data-id="${m.id}" ${mia ? 'data-mia="1"' : ''} title="Editar el contenido de esta plantilla">Editar</button>${mia ? `<button class="btn sm del" data-act="in-mia-del" data-id="${m.id}" title="Borrar plantilla">${ic('trash', 14)}</button>` : ''}</div>`;
  const grupos = {}; for (const x of PLANTILLAS_INCLUIDAS) (grupos[x.grupo] ||= []).push(incluida(x.id));
  const plantillas = `${S.mias.length ? `<div class="sub">Mis plantillas</div>${S.mias.map(m => filaPl(m, true)).join('')}` : ''}
    ${Object.entries(grupos).map(([g, xs]) => `<div class="sub">${esc(g)}</div>${xs.map(m => filaPl(m, false)).join('')}`).join('')}`;
  let h = '';
  if (!S.plantilla) h += sec('Informe y planos', `<p class="mut">${n('informe')} páginas de informe y ${n('planos')} de láminas y planos. Arrastra las páginas de la lista para cambiar su orden. Guarda como plantilla las páginas que quieras reutilizar.</p>
    <div class="row wrap"><button class="btn pri" data-act="in-pdf" data-k="informe" ${n('informe') ? '' : 'disabled'}>${ic('print')} PDF informe</button><button class="btn pri" data-act="in-pdf" data-k="planos" ${n('planos') ? '' : 'disabled'}>${ic('print')} PDF planos</button></div>
    <button class="btn" data-act="in-nueva">${ic('plus')} Agregar página</button>`, !b);
  h += sec(S.plantilla ? 'Plantillas · editando' : 'Plantillas de página', `<p class="mut">Edita lo que traen las plantillas (textos, tablas, vistas, imágenes): se abren aquí mismo, con los datos de este proyecto de muestra.</p><div class="in-pls">${plantillas}</div>`, !!S.plantilla && !b);
  if (b) h += sec(`Bloque · ${TIPOS_BLOQUE[b.tipo]}`, propsBloque(b));
  if (pg && S.plantilla) h += sec('Página de la plantilla', `
    <label class="f"><span>Nombre</span><input class="in" data-in="pg.nombre" value="${esc(pg.nombre || '')}"></label>
    <div class="row"><label class="f"><span>Tamaño</span><select class="in" data-in="pg.tamano">${Object.keys(TAMANOS).map(k => `<option ${k === pg.tamano ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f"><span>Orientación</span><select class="in" data-in="pg.orientacion"><option value="vertical" ${pg.orientacion !== 'horizontal' ? 'selected' : ''}>Vertical</option><option value="horizontal" ${pg.orientacion === 'horizontal' ? 'selected' : ''}>Horizontal</option></select></label></div>
    <label class="f"><span>Sección</span><select class="in" data-in="pg.seccion">${Object.entries(SECCIONES).map(([k, v]) => `<option value="${k}" ${seccionDe(pg) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <button class="btn sm pri" data-act="in-pl-salir">Terminar de editar la plantilla</button>`, !b);
  if (pg && !S.plantilla) h += sec('Página', `
    <label class="f"><span>Nombre</span><input class="in" data-in="pg.nombre" value="${esc(pg.nombre || '')}"></label>
    <div class="row"><label class="f"><span>Tamaño</span><select class="in" data-in="pg.tamano">${Object.keys(TAMANOS).map(k => `<option ${k === pg.tamano ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f"><span>Orientación</span><select class="in" data-in="pg.orientacion"><option value="vertical" ${pg.orientacion !== 'horizontal' ? 'selected' : ''}>Vertical</option><option value="horizontal" ${pg.orientacion === 'horizontal' ? 'selected' : ''}>Horizontal</option></select></label></div>
    <label class="f"><span>Sección</span><select class="in" data-in="pg.seccion">${Object.entries(SECCIONES).map(([k, v]) => `<option value="${k}" ${seccionDe(pg) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="row wrap"><button class="btn sm" data-act="in-pg-plantilla">${ic('save', 14)} Guardar como plantilla</button><button class="btn sm" data-act="in-pg-dup">${ic('copy', 14)} Duplicar</button></div>
    ${pg.desde && (S.mias.some(x => x.id === pg.desde) || PLANTILLAS_INCLUIDAS.some(x => x.id === pg.desde)) ? `<button class="btn sm" data-act="in-pg-a-plantilla" title="La plantilla de la que salió esta página queda igual a como está ahora">${ic('save', 14)} Actualizar su plantilla con esta página</button>` : ''}
    <div class="row wrap"><button class="btn sm" data-act="in-pg-mover" data-k="-1">↑ Subir</button><button class="btn sm" data-act="in-pg-mover" data-k="1">↓ Bajar</button><button class="btn sm del" data-act="in-pg-del">${ic('trash', 14)} Borrar página</button></div>
    <p class="mut">Clic en un bloque para editarlo; arrástralo para moverlo y usa la esquina para el tamaño (Mayús = de a 5 mm). Los bloques no se salen de la hoja; los fijos (como la lámina A1) no se mueven. Ctrl + rueda = zoom. Doble clic en una tabla para escribir en sus celdas y en una vista para encuadrarla. Supr borra.</p>`, !b);
  // Láminas A1: los datos del cajetín, revisiones, notas y protecciones (antes era el paso "Lámina")
  const hayLamina = I.paginas.some(x => x.bloques.some(y => y.tipo === 'lamina'));
  if (pg && !S.plantilla && (seccionDe(pg) === 'planos' || hayLamina)) {
    const R = calcular(S.p), SI = calcStrings(S.p, R);
    h += `<div class="in-lam"><div class="in-lam-t">Datos de las láminas A1 (cajetín, firmas, notas)</div>${panelLamina(S.p, R, SI, { cambio, rerender: panel, repintar: repintarPagina }).replace(/<details class="pp" open>/g, '<details class="pp">')}</div>`;
  }
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
    const V = S.ventanas[b.id], esc1 = V && V.escala ? Math.round(V.bw * V.escala / b.w) : null;
    h += `${sel('hoja', 'Hoja de diseño', ops)}
      <label class="f"><span>Encuadre</span><select class="in" data-in-encuadre><option value="dibujo" ${!b.ventana && b.encuadre !== 'foto' ? 'selected' : ''}>Ajustado a lo dibujado</option><option value="foto" ${!b.ventana && b.encuadre === 'foto' ? 'selected' : ''}>Foto completa</option><option value="propio" ${b.ventana ? 'selected' : ''}>Propio (encuadrado con el mouse)</option></select></label>
      <button class="btn sm ${S.encuadre === b.id ? 'pri' : ''}" data-act="in-encuadrar">${ic('ext', 14)} ${S.encuadre === b.id ? 'Terminar encuadre' : 'Encuadrar con el mouse'}</button>
      ${V && V.escala ? `<label class="f"><span>Escala de la vista: 1 : (escribe el número)</span><input class="in" data-in-escala value="${esc1}" inputmode="numeric"></label>` : '<p class="mut">La hoja no tiene referencia de escala: la vista se encuadra libre.</p>'}
      <label class="f"><span>Foto (opacidad)</span><span class="fr"><input type="range" min="0" max="100" data-in="b.foto" value="${b.foto ?? 100}"><output>${b.foto ?? 100}%</output></span></label>
      ${chk('bn', 'Blanco y negro (todo el dibujo en negro, como un plot monocromo)')}`;
  }
  if (b.tipo === 'tabla') h += `<p class="mut">Doble clic en una celda de la página para escribir en ella (Enter guarda, Tab pasa a la siguiente, Esc cancela).</p>
    <div class="row wrap"><button class="btn sm" data-act="in-tb" data-k="fila+">+ Fila</button><button class="btn sm" data-act="in-tb" data-k="fila-">− Fila</button><button class="btn sm" data-act="in-tb" data-k="col+">+ Columna</button><button class="btn sm" data-act="in-tb" data-k="col-">− Columna</button></div>
    <label class="f"><span>Título</span><input class="in" data-in="b.titulo" value="${esc(b.titulo || '')}"></label>
    ${sel('tituloColor', 'Color del título', [['negro', 'Negro'], ['rojo', 'Rojo'], ['azul', 'Azul Nikola']])}
    <details class="in-filas"><summary>Editar como texto</summary><label class="f"><span>Una fila por línea, celdas separadas por |</span><textarea class="in mono" rows="7" data-in="b.filas">${esc((b.filas || []).map(f => f.join(' | ')).join('\n'))}</textarea></label>${campos}</details>
    <div class="row">${num('tam', 'Letra (pt)', .5)}<label class="f"><span>Ancho columnas (%)</span><input class="in" data-in="b.anchos" value="${esc(b.anchos || '')}" placeholder="35,30"></label></div>
    <div class="row wrap">${chk('cabecera', 'Primera fila es encabezado')}${chk('mayusculas', 'Datos en MAYÚSCULAS')}</div>${sel('cuerpo', 'Estilo', [['', 'Planos (cursiva, como AutoCAD)'], ['normal', 'Documento (texto normal)']])}`;
  if (b.tipo === 'lamina') h += sel('lamina', 'Lámina', [['01', 'Lámina 01 · Planta y unilineal'], ['02', 'Lámina 02 · Cuadros de carga']]) + '<p class="mut">El cajetín, las firmas y las notas se completan abajo, en «Datos de las láminas A1».</p>';
  if (b.tipo === 'unilineal') h += '<p class="mut">Es el unilineal del proyecto, el mismo de la lámina A1. Se edita en la pestaña «Unilineal» (datos, partes y cualquier texto con un clic).</p>';
  h += `<div class="row">${num('x', 'X (mm)')}${num('y', 'Y (mm)')}</div><div class="row">${num('w', 'Ancho (mm)')}${num('h', 'Alto (mm)')}</div>
    ${b.tipo !== 'lamina' ? chk('borde', 'Con marco') : ''}
    <label class="chk"><input type="checkbox" data-in="b.fijo" ${esFijo(b) ? 'checked' : ''}> Fijo en la página (el mouse no lo mueve)</label>
    <div class="row wrap"><button class="btn sm" data-act="in-b-orden" data-k="1">Al frente</button><button class="btn sm" data-act="in-b-orden" data-k="-1">Atrás</button><button class="btn sm" data-act="in-b-dup">${ic('copy', 14)} Duplicar</button><button class="btn sm del" data-act="in-b-del">${ic('trash', 14)} Borrar</button></div>`;
  return h;
}

/* ---------- Acciones ---------- */
export function accionInforme(a, el) {
  if (!a.startsWith('in-')) return false;
  const I = informe(), pg = pagAct(), b = bloqueAct();
  const repintar = () => { cambio(); pintar(); };
  switch (a) {
    case 'in-pag': if (S.arrastro) break; salirEncuadre(false); if (S.plantilla) { clearTimeout(tPlantilla); guardarPlantillaEditada(); S.plantilla = null; } S.pag = el.dataset.id; S.sel = null; S.zoom = null; pintar(); break;
    case 'in-nueva': dialogoNueva(el.dataset.k || (pg ? seccionDe(pg) : 'informe')); break;
    case 'in-paquete': agregarPaquete(el.dataset.k); break;
    case 'in-add': { const [W, H] = medida(pg), nb = nuevoBloque(el.dataset.k, 20, 20); if (nb.tipo === 'lamina') { nb.w = W; nb.h = H; nb.x = 0; nb.y = 0; } nb.x = Math.max(0, Math.round((W - nb.w) / 2)); nb.y = Math.max(0, Math.round((H - nb.h) / 2)); pg.bloques.push(nb); S.sel = nb.id; repintar(); break; }
    case 'in-zoom': { const k = +el.dataset.k; if (k === 0) { S.zoom = null; ajustarZoom(); } else zoomPagina(Math.max(.1, Math.min(8, (S.zoom || S.z || 1) * (k > 0 ? 1.25 : .8)))); break; }
    case 'in-pl-editar': editarPlantilla(el.dataset.id, !!el.dataset.mia); break;
    case 'in-pl-salir': salirPlantilla(); break;
    case 'in-pl-original': { const id = S.plantilla.id; if (!confirm('¿Volver la plantilla a como venía incluida? Se pierden tus cambios en ella.')) break; delete S.editadas[id]; guardarAjuste('plantillasEditadas', S.editadas); clearTimeout(tPlantilla); S.plantilla = null; S.sel = null; S.zoom = null; pintar(); toast('Plantilla original restaurada'); break; }
    case 'in-pg-a-plantilla': {
      const id = pg.desde, mia = S.mias.find(x => x.id === id), base = mia || incluida(id); if (!base) break;
      if (!confirm(`¿Reemplazar la plantilla «${base.nombre}» por esta página? Las páginas nuevas que se armen con ella saldrán así.`)) break;
      const nueva = { ...JSON.parse(JSON.stringify(pg)), id, nombre: base.nombre, grupo: base.grupo, incluida: !mia, seccion: base.seccion }; delete nueva.desde;
      if (mia) { S.mias = S.mias.map(x => x.id === id ? { ...nueva, guardada: new Date().toISOString() } : x); guardarAjuste('plantillasPagina', S.mias); }
      else { S.editadas[id] = nueva; guardarAjuste('plantillasEditadas', S.editadas); }
      toast('Plantilla actualizada'); panel(); break;
    }
    case 'in-pdf': imprimir(el.dataset.k); break;
    case 'in-pg-dup': { const c = copiarPagina(pg, { nombre: `${pg.nombre} (copia)` }); I.paginas.splice(I.paginas.indexOf(pg) + 1, 0, c); S.pag = c.id; repintar(); break; }
    case 'in-pg-mover': { const mismas = I.paginas.filter(x => seccionDe(x) === seccionDe(pg)), i = mismas.indexOf(pg), otra = mismas[i + +el.dataset.k]; if (!otra) break; const a1 = I.paginas.indexOf(pg), a2 = I.paginas.indexOf(otra); I.paginas[a1] = otra; I.paginas[a2] = pg; repintar(); break; }
    case 'in-pg-del': { if (!confirm(`¿Borrar la página «${pg.nombre}»?`)) break; const i = I.paginas.indexOf(pg); I.paginas.splice(i, 1); S.pag = I.paginas[Math.max(0, i - 1)]?.id || null; S.sel = null; repintar(); break; }
    case 'in-pg-plantilla': guardarPlantilla(pg); break;
    case 'in-mia-del': { const m = S.mias.find(x => x.id === el.dataset.id); if (m && confirm(`¿Borrar la plantilla «${m.nombre}»? Las páginas que ya la usan no cambian.`)) { S.mias = S.mias.filter(x => x !== m); guardarAjuste('plantillasPagina', S.mias); if (S.plantilla?.id === m.id) { clearTimeout(tPlantilla); S.plantilla = null; S.sel = null; pintar(); } else panel(); } break; }
    case 'in-b-del': borrarBloque(); break;
    case 'in-b-dup': { const c = { ...JSON.parse(JSON.stringify(b)), id: uid('b'), x: b.x + 5, y: b.y + 5 }; pg.bloques.push(c); S.sel = c.id; repintar(); break; }
    case 'in-b-orden': { const i = pg.bloques.indexOf(b); pg.bloques.splice(i, 1); if (+el.dataset.k > 0) pg.bloques.push(b); else pg.bloques.unshift(b); repintar(); break; }
    case 'in-img-quitar': b.src = null; repintar(); break;
    case 'in-encuadrar': if (S.encuadre === b.id) salirEncuadre(true); else entrarEncuadre(b); break;
    case 'in-tb': {
      const f = b.filas ||= [[]], n = Math.max(1, ...f.map(x => x.length));
      if (el.dataset.k === 'fila+') f.push(Array(n).fill(''));
      if (el.dataset.k === 'fila-' && f.length > 1) f.pop();
      if (el.dataset.k === 'col+') f.forEach(x => { while (x.length < n) x.push(''); x.push(''); });
      if (el.dataset.k === 'col-' && n > 1) f.forEach(x => { x.length = Math.min(x.length, n - 1); });
      cambio(); repintarPagina(); panel(); break;
    }
  }
  return true;
}
function borrarBloque() { const pg = pagAct(), b = bloqueAct(); if (!b) return; pg.bloques = pg.bloques.filter(x => x !== b); S.sel = null; cambio(); pintar(); }

/* ---------- Editar el contenido de una plantilla (incluida o propia) ---------- */
function editarPlantilla(id, mia) {
  const fuente = mia ? S.mias.find(x => x.id === id) : incluida(id); if (!fuente) return;
  if (S.plantilla) { clearTimeout(tPlantilla); guardarPlantillaEditada(); }
  salirEncuadre(false);
  S.plantilla = { id, mia, pg: JSON.parse(JSON.stringify(fuente)) }; S.sel = null; S.zoom = null; pintar();
}
async function guardarPlantillaEditada() {
  const P = S.plantilla; if (!P || !P.sucio) return;
  const pg = JSON.parse(JSON.stringify(P.pg));
  if (P.mia) { S.mias = S.mias.map(x => x.id === P.id ? { ...pg, guardada: new Date().toISOString() } : x); await guardarAjuste('plantillasPagina', S.mias); }
  else { S.editadas[P.id] = { ...pg, editada: new Date().toISOString() }; await guardarAjuste('plantillasEditadas', S.editadas); }
}
function salirPlantilla() {
  if (!S.plantilla) return; clearTimeout(tPlantilla); guardarPlantillaEditada();
  const guardo = S.plantilla.sucio; S.plantilla = null; S.sel = null; S.zoom = null; pintar(); if (guardo) toast('Plantilla guardada en este navegador');
}

function agregarPaquete(id) {
  const q = PAQUETES.find(x => x.id === id); if (!q) return;
  if (S.plantilla) salirPlantilla();
  const nuevas = q.paginas.map(pid => incluida(pid)).filter(Boolean).map(x => copiarPagina(x, { desde: x.id }));
  informe().paginas.push(...nuevas); S.pag = nuevas[0]?.id || S.pag; S.sel = null; cambio(); pintar();
  toast(`${nuevas.length} páginas de «${q.nombre}» agregadas`);
}
function dialogoNueva(seccion = 'informe') {
  const grupos = {}; for (const x of PLANTILLAS_INCLUIDAS) (grupos[x.grupo] ||= []).push(incluida(x.id));
  const item =(x, mia) => `<button class="dl-pl" data-pl="${x.id}" data-mia="${mia ? 1 : ''}"><b>${esc(x.nombre)}</b><span>${esc(x.tamano)} ${x.orientacion === 'horizontal' ? 'horizontal' : 'vertical'} · ${x.bloques.length} bloques</span></button>`;
  const d = document.createElement('dialog'); d.className = 'dlg dlg-pl';
  d.innerHTML = `<form method="dialog"><h2>Agregar página</h2>
    <label class="f"><span>Agregar a</span><select class="in" name="seccion">${Object.entries(SECCIONES).map(([k, v]) => `<option value="${k}" ${k === seccion ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="dl-sec"><h3>Conjunto completo</h3><div class="dl-grid">${PAQUETES.map(q => `<button class="dl-pl" data-paq="${q.id}"><b>${esc(q.nombre)}</b><span>${esc(q.detalle)}</span></button>`).join('')}</div></div>
    ${S.mias.length ? `<div class="dl-sec"><h3>Mis plantillas</h3><div class="dl-grid">${S.mias.map(x => item(x, true)).join('')}</div></div>` : ''}
    ${Object.entries(grupos).map(([g, xs]) => `<div class="dl-sec"><h3>${esc(g)}</h3><div class="dl-grid">${xs.map(x => item(x)).join('')}</div></div>`).join('')}
    <div class="dl-sec"><h3>En blanco</h3><div class="dl-grid">${[['A4', 'vertical'], ['A4', 'horizontal'], ['A3', 'horizontal'], ['A1', 'horizontal']].map(([t, o]) => `<button class="dl-pl" data-blanco="${t}|${o}"><b>${t} ${o}</b><span>Página vacía</span></button>`).join('')}</div></div>
    <div class="row end"><button class="btn" value="cancel">Cerrar</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('click', ev => {
    const t = ev.target.closest('.dl-pl'); if (!t) return; ev.preventDefault();
    if (t.dataset.paq) { d.close(); agregarPaquete(t.dataset.paq); return; }
    const sec = d.querySelector('[name=seccion]').value;
    let nueva;
    if (t.dataset.blanco) { const [ta, o] = t.dataset.blanco.split('|'); nueva = paginaEnBlanco(ta, o, sec); }
    else { const fuente = t.dataset.mia ? S.mias.find(x => x.id === t.dataset.pl) : incluida(t.dataset.pl); nueva = copiarPagina(fuente, { desde: fuente.id, seccion: sec }); }
    if (S.plantilla) { clearTimeout(tPlantilla); guardarPlantillaEditada(); S.plantilla = null; }
    const I = informe(), mismas = I.paginas.filter(x => seccionDe(x) === sec), ult = mismas[mismas.length - 1];
    I.paginas.splice(ult ? I.paginas.indexOf(ult) + 1 : (sec === 'informe' ? 0 : I.paginas.length), 0, nueva);
    S.pag = nueva.id; S.sel = null; d.close(); cambio(); pintar();
  });
  d.addEventListener('close', () => d.remove());
}
async function guardarPlantilla(pg) {
  const nombre = prompt('Nombre de la plantilla (para reutilizarla en otros proyectos):', pg.nombre || 'Mi página'); if (!nombre) return;
  const pl = copiarPagina(pg, { id: uid('pl'), nombre: nombre.trim(), grupo: 'Mis plantillas', incluida: false, guardada: new Date().toISOString() });
  delete pl.desde;
  S.mias = [...S.mias, pl]; await guardarAjuste('plantillasPagina', S.mias);
  toast('Plantilla guardada en este navegador'); panel();
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
  if (c === 'hoja') delete b.ventana;                         // otra hoja: el encuadre propio ya no aplica
  cambio(); pintar();
}
let tTexto = null;
document.addEventListener('input', ev => {
  const t = ev.target; if (!activo() || !t.matches?.('#props [data-in]')) return;
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
  const gen = ++S.gen, ventanas = {}, html = await htmlPagina(pg, { p: S.p, datos: S.datos, editor: true, sel: S.sel, ventanas }); if (gen !== S.gen) return;
  S.ventanas = ventanas; cont.innerHTML = html; ajustarZoom(); marcarEncuadre();
  const lista = S.el.querySelector(`.inf-pag[data-id="${pg.id}"] span`); if (lista) lista.textContent = pg.nombre || 'Página';
}
document.addEventListener('change', ev => {
  const t = ev.target; if (!activo()) return;
  if (t.matches?.('#props [data-in]')) { clearTimeout(tTexto); aplicar(t); }
  if (t.matches?.('#props [data-in-campo]') && t.value) {
    const area = document.querySelector('#props textarea[data-in="b.texto"], #props textarea[data-in="b.filas"]');
    if (area) { const ins = `{${t.value}}`, i = area.selectionStart ?? area.value.length; area.value = area.value.slice(0, i) + ins + area.value.slice(area.selectionEnd ?? i); aplicar(area); }
    t.value = '';
  }
  if (t.matches?.('[data-in-img]') && t.files[0]) { const f = t.files[0]; t.value = ''; subirImagen(f); }
  if (t.matches?.('#props [data-in-encuadre]')) {
    const b = bloqueAct(); if (!b) return;
    if (t.value === 'propio') { entrarEncuadre(b); return; }
    delete b.ventana; b.encuadre = t.value; cambio(); pintar();
  }
  if (t.matches?.('#props [data-in-escala]')) fijarEscala(t.value);
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

/* ---------- Tablas: escribir en la celda, en la misma página ---------- */
function editarCelda(td, b) {
  const pos = td.dataset.celda; if (!pos || td.isContentEditable) return;
  const [i, j] = pos === 't' ? [null, null] : pos.split(',').map(Number);
  const original = pos === 't' ? (b.titulo || '') : (b.filas?.[i]?.[j] ?? '');
  td.textContent = original;                                   // se edita el texto con sus {Campos}, no el valor
  td.contentEditable = 'plaintext-only'; if (td.contentEditable !== 'plaintext-only') td.contentEditable = 'true';
  td.classList.add('editando'); td.focus();
  const r = document.createRange(); r.selectNodeContents(td); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  let listo = false;
  const terminar = (guardar, siguiente) => {
    if (listo) return; listo = true;
    const texto = td.innerText.replace(/\n$/, '');
    td.contentEditable = 'false'; td.classList.remove('editando');
    if (guardar && texto !== original) {
      if (pos === 't') b.titulo = texto; else { b.filas ||= []; while (b.filas.length <= i) b.filas.push([]); b.filas[i][j] = texto; }
      cambio();
    }
    repintarPagina().then(() => {
      panel();
      if (siguiente) { const tds = [...S.el.querySelectorAll(`.bq[data-b="${b.id}"] [data-celda]`)], k = tds.findIndex(x => x.dataset.celda === pos), nx = tds[k + 1]; if (nx) editarCelda(nx, b); }
    });
  };
  td.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); terminar(true); }
    else if (ev.key === 'Tab') { ev.preventDefault(); terminar(true, true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); terminar(false); }
    ev.stopPropagation();
  });
  td.addEventListener('blur', () => terminar(true), { once: true });
}

/* ---------- Vistas: encuadrar con el mouse (como una ventana gráfica de AutoCAD) ---------- */
function entrarEncuadre(b) {
  const V = S.ventanas[b.id]; if (!V) { toast('Esta vista no tiene foto que encuadrar'); return; }
  S.encuadre = b.id; S.sel = b.id;
  if (!b.ventana) b.ventana = { x0: V.x0, y0: V.y0, bw: V.bw };
  marcarEncuadre(); panel();
}
function salirEncuadre(redibujar = true) {
  if (!S.encuadre) return; S.encuadre = null; marcarEncuadre();
  if (redibujar) { cambio(); repintarPagina().then(panel); }
}
function marcarEncuadre() {
  if (!S.el) return;
  S.el.querySelectorAll('.inf-lienzo .bq').forEach(x => x.classList.toggle('encuadrando', x.dataset.b === S.encuadre));
  const a = S.el.querySelector('.inf-ayuda');
  if (a) { a.hidden = !S.encuadre; a.textContent = 'Encuadrando la vista: rueda del mouse = zoom · arrastrar = mover · Enter, Esc o clic afuera = terminar'; }
}
let dibujando = false, pendiente = false;
async function refrescarVista() {    // dibujo rápido (borrador) mientras se encuadra
  const b = bloqueAct(); if (!b || S.encuadre !== b.id) return;
  if (dibujando) { pendiente = true; return; }
  dibujando = true;
  const V = S.ventanas[b.id], r = await imagenHoja(S.p, V.hojaId, b.w, b.h, { foto: b.foto, ventana: b.ventana, borrador: true });
  const img = S.el.querySelector(`.bq[data-b="${b.id}"] img`), capa = S.el.querySelector(`.bq[data-b="${b.id}"] .bq-capa`); if (r && img) { img.src = r.url; if (capa) capa.style.visibility = 'hidden'; }
  dibujando = false; if (pendiente) { pendiente = false; refrescarVista(); }
}
function fijarEscala(txt) {
  const b = bloqueAct(), V = b && S.ventanas[b.id], n = parseFloat(String(txt).replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!b || !V || !V.escala || !(n > 0)) return;
  const W = b.ventana || V, asp = b.w / b.h, cx = W.x0 + W.bw / 2, cy = W.y0 + W.bw / asp / 2, bw = n * b.w / V.escala;
  b.ventana = { x0: cx - bw / 2, y0: cy - bw / asp / 2, bw };
  cambio(); repintarPagina().then(panel);
}
document.addEventListener('wheel', ev => {
  if (!activo() || !S.encuadre) return;
  const bq = ev.target.closest?.(`.inf-lienzo .bq[data-b="${S.encuadre}"]`); if (!bq) return;
  ev.preventDefault();
  const b = bloqueAct(), W = b.ventana, r = bq.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
  const asp = b.w / b.h, bh = W.bw / asp, px = W.x0 + fx * W.bw, py = W.y0 + fy * bh, f = ev.deltaY < 0 ? 1 / 1.15 : 1.15, nbw = W.bw * f;
  b.ventana = { x0: px - fx * nbw, y0: py - fy * nbw / asp, bw: nbw };
  refrescarVista();
}, { passive: false });

/* ---------- Mover y redimensionar bloques con el mouse ---------- */
let D = null;
document.addEventListener('pointerdown', ev => {
  if (!activo()) return;
  if (ev.target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  const pgEl = ev.target.closest('.inf-lienzo .pg');
  const bq = pgEl && ev.target.closest('.bq');
  if (S.encuadre) {
    if (bq && bq.dataset.b === S.encuadre) {    // mover la foto dentro de la vista
      ev.preventDefault(); const b = bloqueAct();
      D = { b, el: bq, modo: 'pan', sx: ev.clientX, sy: ev.clientY, v: { ...b.ventana }, r: bq.getBoundingClientRect(), movio: false };
      return;
    }
    if (!ev.target.closest('#props')) salirEncuadre(true);
    if (!pgEl) return;
  }
  if (!pgEl) return;
  if (!bq) { if (S.sel) { S.sel = null; seleccionarVisual(); panel(); } return; }
  const b = pagAct()?.bloques.find(x => x.id === bq.dataset.b); if (!b) return;
  ev.preventDefault();
  if (S.sel !== b.id) { S.sel = b.id; seleccionarVisual(); panel(); }
  if (esFijo(b)) return;                                           // fijo: solo se selecciona
  const [PW, PH] = medida(pagAct());
  D = { b, el: bq, modo: ev.target.classList.contains('bq-h') ? 'tam' : 'mover', sx: ev.clientX, sy: ev.clientY, x: b.x, y: b.y, w: b.w, h: b.h, PW, PH, movio: false };
});
const entre = (v, a, b) => Math.max(a, Math.min(b, v));
document.addEventListener('pointermove', ev => {
  if (!D) return;
  if (D.modo === 'pan') {
    const W = D.v, asp = D.b.w / D.b.h, dx = (ev.clientX - D.sx) / D.r.width * W.bw, dy = (ev.clientY - D.sy) / D.r.height * (W.bw / asp);
    if (Math.abs(ev.clientX - D.sx) + Math.abs(ev.clientY - D.sy) > 2) D.movio = true;
    D.b.ventana = { x0: W.x0 - dx, y0: W.y0 - dy, bw: W.bw }; refrescarVista(); return;
  }
  const k = MM * (S.z || 1), dx = (ev.clientX - D.sx) / k, dy = (ev.clientY - D.sy) / k, paso = ev.shiftKey ? 5 : 1, r = v => Math.round(v / paso) * paso;
  if (Math.abs(dx) + Math.abs(dy) > .5) D.movio = true;
  // dentro de la hoja: un bloque no se puede sacar (ni agrandar) fuera del papel
  if (D.modo === 'mover') { D.b.x = entre(r(D.x + dx), 0, Math.max(0, D.PW - D.b.w)); D.b.y = entre(r(D.y + dy), 0, Math.max(0, D.PH - D.b.h)); D.el.style.left = D.b.x + 'mm'; D.el.style.top = D.b.y + 'mm'; }
  else { D.b.w = entre(r(D.w + dx), 3, Math.max(3, D.PW - D.b.x)); D.b.h = entre(r(D.h + dy), 3, Math.max(3, D.PH - D.b.y)); D.el.style.width = D.b.w + 'mm'; D.el.style.height = D.b.h + 'mm'; }
});
document.addEventListener('pointerup', () => {
  if (!D) return; const d = D; D = null;
  if (!d.movio || d.modo === 'pan') return;
  cambio(); panel();
  if (d.modo === 'tam' && ['vista', 'lamina', 'unilineal'].includes(d.b.tipo)) {   // las vistas se vuelven a dibujar al nuevo tamaño
    if (d.b.ventana) { const asp0 = d.w / d.h, asp1 = d.b.w / d.b.h, W = d.b.ventana, cy = W.y0 + W.bw / asp0 / 2; d.b.ventana = { x0: W.x0, y0: cy - W.bw / asp1 / 2, bw: W.bw }; }
    repintarPagina();
  }
});
document.addEventListener('dblclick', ev => {
  if (!activo()) return; const bq = ev.target.closest('.inf-lienzo .bq'); if (!bq) return;
  const b = pagAct()?.bloques.find(x => x.id === bq.dataset.b); if (!b) return;
  S.sel = b.id; seleccionarVisual();
  if (b.tipo === 'tabla') { const td = ev.target.closest('[data-celda]'); if (td) { editarCelda(td, b); panel(); return; } }
  if (b.tipo === 'vista') { entrarEncuadre(b); return; }
  if (b.tipo === 'imagen') { panel(); document.querySelector('#props [data-in-img]')?.click(); }
  if (b.tipo === 'texto') { panel(); document.querySelector('#props textarea')?.focus(); }
});
document.addEventListener('keydown', ev => {
  if (!activo() || ev.target.matches('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
  if (S.encuadre && (ev.key === 'Escape' || ev.key === 'Enter')) { ev.preventDefault(); salirEncuadre(true); return; }
  if (!S.sel) return;
  const b = bloqueAct(); if (!b) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); borrarBloque(); return; }
  const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
  if (m) { ev.preventDefault(); if (esFijo(b)) return toast('El bloque está fijo: desmárcalo en el panel para moverlo'); const p = ev.shiftKey ? 5 : 1, [PW, PH] = medida(pagAct()); b.x = entre(b.x + m[0] * p, 0, Math.max(0, PW - b.w)); b.y = entre(b.y + m[1] * p, 0, Math.max(0, PH - b.h)); const el = S.el.querySelector(`.bq[data-b="${b.id}"]`); if (el) { el.style.left = b.x + 'mm'; el.style.top = b.y + 'mm'; } cambio(); }
});
/* ---------- Ordenar páginas arrastrándolas en la lista (también de una sección a la otra) ---------- */
let arrastre = null;
const limpiarDrop = () => S.el?.querySelectorAll('.drop-antes, .drop-despues, .drop-grupo, .arrastrando').forEach(x => x.classList.remove('drop-antes', 'drop-despues', 'drop-grupo', 'arrastrando'));
function destinoDrop(ev) {
  const pag = ev.target.closest?.('.inf-pags .inf-pag'), grupo = ev.target.closest?.('.inf-pags .inf-grupo');
  if (pag && pag.dataset.id !== arrastre) { const r = pag.getBoundingClientRect(); return { el: pag, id: pag.dataset.id, despues: ev.clientY > r.top + r.height / 2, sec: pag.closest('.inf-grupo')?.dataset.sec }; }
  if (grupo && !pag) return { el: grupo, sec: grupo.dataset.sec };
  return null;
}
document.addEventListener('dragstart', ev => {
  const b = ev.target.closest?.('.inf-pags .inf-pag'); if (!activo() || !b) return;
  arrastre = b.dataset.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', b.dataset.id); } catch (e) { /* algunos navegadores */ }
  b.classList.add('arrastrando');
});
document.addEventListener('dragover', ev => {
  if (!arrastre || !activo()) return; const d = destinoDrop(ev); if (!d) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'move';
  S.el.querySelectorAll('.drop-antes, .drop-despues, .drop-grupo').forEach(x => x.classList.remove('drop-antes', 'drop-despues', 'drop-grupo'));
  d.el.classList.add(d.id ? (d.despues ? 'drop-despues' : 'drop-antes') : 'drop-grupo');
});
document.addEventListener('drop', ev => {
  if (!arrastre || !activo()) return; const d = destinoDrop(ev); if (!d) return;
  ev.preventDefault();
  const I = informe(), pg = I.paginas.find(x => x.id === arrastre); if (!pg) return;
  I.paginas.splice(I.paginas.indexOf(pg), 1);
  if (d.id) { const i = I.paginas.findIndex(x => x.id === d.id); I.paginas.splice(i + (d.despues ? 1 : 0), 0, pg); }
  else { const mismas = I.paginas.filter(x => seccionDe(x) === d.sec), ult = mismas[mismas.length - 1]; I.paginas.splice(ult ? I.paginas.indexOf(ult) + 1 : (d.sec === 'informe' ? 0 : I.paginas.length), 0, pg); }
  if (d.sec && d.sec !== seccionDe(pg)) pg.seccion = d.sec;
  arrastre = null; S.arrastro = true; setTimeout(() => { S.arrastro = false; }, 0);
  limpiarDrop(); S.cb.cambio && S.cb.cambio(); pintar();
});
document.addEventListener('dragend', () => { arrastre = null; limpiarDrop(); });

function seleccionarVisual() { S.el.querySelectorAll('.inf-lienzo .bq').forEach(x => x.classList.toggle('sel', x.dataset.b === S.sel)); }

/* ---------- Imprimir / PDF: una sección (o todo), cada página con su tamaño ---------- */
async function imprimir(seccion) {
  const ps = informe().paginas.filter(x => !seccion || seccionDe(x) === seccion); if (!ps.length) return;
  toast('Preparando el PDF…');
  const w = window.open('', '_blank'); if (!w) return toast('El navegador bloqueó la ventana: permite ventanas emergentes');
  w.document.write('<p style="font:14px sans-serif;padding:20px">Preparando…</p>');
  const html = await htmlImpresion(seccion);
  w.document.open(); w.document.write(html); w.document.close();
}
/* Documento HTML con las páginas, cada una con su tamaño de papel (@page con nombre) */
export async function htmlImpresion(seccion) {
  const ps = informe().paginas.filter(x => !seccion || seccionDe(x) === seccion);
  const paginas = []; for (const pg of ps) paginas.push({ pg, html: await htmlPagina(pg, { p: S.p, datos: S.datos, editor: false }) });
  const nombres = [...new Set(ps.map(pg => medida(pg).join('x')))];
  const css = nombres.map(n => { const [W, H] = n.split('x'); return `@page p${n.replace('.', '_')} { size: ${W}mm ${H}mm; margin: 0 }`; }).join('\n');
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const titulo = `${S.p.codigo || 'Proyecto'} — ${seccion ? SECCIONES[seccion] : 'Informe y planos'}`;
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><title>${esc(titulo)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <style>${CSS_PAGINA}${css}
      html, body { margin: 0; background: #6b7378; } .pg { margin: 0 auto 8mm; box-shadow: 0 2px 12px rgba(0,0,0,.3); }
      .aviso { font: 14px sans-serif; color: #fff; text-align: center; padding: 10px; }
      @media print { html, body { background: none; } .aviso { display: none; } .pg { margin: 0; box-shadow: none; break-after: page; } }</style></head>
    <body><div class="aviso">En el diálogo de impresión elige «Guardar como PDF». Cada página sale con su tamaño (${[...new Set(ps.map(p => `${p.tamano} ${p.orientacion}`))].join(', ')}).</div>
    ${paginas.map(({ pg, html }) => html.replace(/^(<div class="pg" data-pg="[^"]*" style=")/, `$1page:p${medida(pg).join('x').replace('.', '_')};`)).join('\n')}
    <script>Promise.all([document.fonts.ready, ...[...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))]).then(() => setTimeout(() => print(), 400))<\/script></body></html>`;
}
