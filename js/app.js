/* ==========================================================================
   Entrada de la app: lista de proyectos, crear/importar y abrir el editor.
   ========================================================================== */
import { $, esc, fmt, ic, toast, uid, clone } from './util.js';
import { ESTADOS, COLORES_STRING } from './catalogo.js';
import { listar, guardar, borrar, nuevoProyecto, proyectoEjemplo } from './store.js';
import { calcular, calcStrings } from './geom.js';
import { cargarImg, dibujar } from './render.js';
import { abrirEditor } from './editor.js';
import { PANELES, INVERSORES } from './catalogo.js';
import { abrirLibroBytes } from './xlsx/libro.js';
import { importarCamposAutocad, datosProyectoDesdeFicha } from './ficha/importar.js';
import { cargarDatosFicha } from './ficha/datos.js';
import { paginaPlantilla } from './ficha/pagina-plantilla.js';

const L = { proyectos: [], q: '', filtro: 'todos' };

/* Tema claro/oscuro (mismo valor que el resto de las apps de Nikola) */
function tema(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('nk-theme', t); } catch (e) { } }

async function boot() {
  try { L.proyectos = await listar(); } catch (e) { L.proyectos = []; toast('Este navegador no deja guardar datos (¿modo privado?)'); }
  if (!L.proyectos.length) { const p = await armarEjemplo(); L.proyectos = [p]; }
  if (location.hash === '#plantilla') return paginaPlantilla(() => lista());
  const id = new URLSearchParams(location.hash.slice(1)).get('p');
  const p = id && L.proyectos.find(x => x.id === id);
  if (p) abrir(p); else lista();
}
window.addEventListener('hashchange', () => { if (!location.hash && document.body.classList.contains('modo-editor')) location.reload(); });

async function armarEjemplo() {
  const p = proyectoEjemplo(); await cargarImg(p.img);
  // strings y canalización de ejemplo
  const R = calcular(p); const t1 = R.validos.filter(pn => pn.rid === p.roofs[0].id).map(pn => pn.key), t2 = R.validos.filter(pn => pn.rid === p.roofs[1].id).map(pn => pn.key);
  p.strings = [{ id: uid('s'), mppt: 1, num: 1, panels: t1, color: COLORES_STRING[0] }, { id: uid('s'), mppt: 2, num: 1, panels: t2, color: COLORES_STRING[1] }];
  p.rutas = [
    { id: uid('r'), k: 'cc', tramo: p.strings[0].id, pts: [[600, 700], [690, 760], [690, 850], [880, 850]] },
    { id: uid('r'), k: 'cc', tramo: p.strings[1].id, pts: [[1000, 560], [1060, 640], [1060, 780], [905, 780], [905, 830]] },
    { id: uid('r'), k: 'ca', tramo: 'inv-tg', pts: [[925, 850], [945, 850]] },
    { id: uid('r'), k: 'sub', tramo: 'tg-emp', pts: [[960, 870], [960, 960], [1285, 960]] }
  ];
  try { await guardar(p); } catch (e) { }
  return p;
}

function lista() {
  document.body.className = 'modo-lista'; history.replaceState(null, '', location.pathname);
  const q = L.q.trim().toLowerCase(), f = L.filtro;
  const ps = L.proyectos.filter(p => (f === 'todos' || p.estado === f) && (!q || `${p.codigo} ${p.cliente} ${p.direccion} ${p.comuna}`.toLowerCase().includes(q)))
    .sort((a, b) => String(b.editado || b.creado).localeCompare(String(a.editado || a.creado)));
  const oscuro = document.documentElement.dataset.theme === 'dark';
  $('#app').innerHTML = `
  <header class="l-top"><img src="assets/nikola-logo-blanco.svg" alt="NIKOLA" class="l-logo"><span class="l-app">Diseño Ops</span><div class="tb-sp"></div>
    <button class="tb-btn tb-txt" data-l="plantilla" title="Con qué versión de Campos Autocad calcula la app, y qué pasa si cambia">${ic('sheet')}<span>Plantilla</span></button>
    <button class="tb-btn" data-l="tema" title="${oscuro ? 'Modo claro' : 'Modo oscuro'}">${ic(oscuro ? 'sun' : 'moon')}</button></header>
  <div class="proto"><b>PROTOTIPO</b> Los proyectos se guardan en este navegador. Exporta el .json para compartirlos.</div>
  <main class="l-main">
    <div class="l-head"><div><div class="eyebrow">Operaciones · Diseño fotovoltaico</div><h1>Proyectos</h1></div>
      <div class="row"><label class="btn" title="Crea un proyecto desde el Excel Campos Autocad de un proyecto en curso">${ic('upload')} Importar Campos Autocad<input type="file" accept=".xlsm,.xlsx" data-l="importar-xls" hidden></label><label class="btn">${ic('upload')} Importar .json<input type="file" accept=".json,application/json" data-l="importar" hidden></label><button class="btn pri" data-l="nuevo">${ic('plus')} Nuevo proyecto</button></div></div>
    <div class="l-filtros"><label class="search">${ic('search', 16)}<input id="lq" type="search" placeholder="Buscar código, cliente o dirección" value="${esc(L.q)}"></label>
      <div class="chips">${[['todos', 'Todos'], ...Object.entries(ESTADOS)].map(([k, n]) => `<button class="chip" data-l="filtro" data-k="${k}" aria-pressed="${f === k}">${n}<em>${k === 'todos' ? L.proyectos.length : L.proyectos.filter(p => p.estado === k).length}</em></button>`).join('')}</div></div>
    <div class="cards">${ps.map(card).join('') || '<p class="mut">No hay proyectos con este filtro.</p>'}</div>
    <section class="flujo"><h2>Cómo se diseña</h2><ol>${['Escala: traza una medida conocida sobre la foto de dron', 'Techos: dibuja cada agua', 'Elementos: marca obstáculos y zonas no utilizables', 'Paneles: automático o por bloques (filas × columnas)', 'Strings: asigna paneles a cada MPPT y revisa tensiones', 'Equipos y canalización: inversor, tableros, medidor y recorridos', 'Lámina: cajetín, unilineal y cuadros listos para PDF A1 o DXF'].map(t => `<li>${t}</li>`).join('')}</ol></section>
  </main>`;
  $('#lq').addEventListener('input', ev => { L.q = ev.target.value; const pos = ev.target.selectionStart; lista(); const i = $('#lq'); i.focus(); i.setSelectionRange(pos, pos); });
  ps.forEach(miniatura);
}
function card(p) {
  const R = calcular(p);
  return `<article class="card"><button class="card-img" data-l="abrir" data-id="${p.id}" aria-label="Abrir ${esc(p.codigo)}"><canvas data-mini="${p.id}" width="480" height="300"></canvas></button>
    <div class="card-b"><div class="card-t"><b>${esc(p.codigo || 'Sin código')}</b><span class="pill e-${p.estado}">${ESTADOS[p.estado] || p.estado}</span></div>
      <div class="card-c">${esc(p.cliente || 'Sin cliente')}</div><div class="mut sm">${esc([p.direccion, p.comuna].filter(Boolean).join(', ') || 'Sin dirección')}</div>
      <div class="card-k"><span><b>${R.n}</b> paneles</span><span><b>${fmt(R.kwp, 2)}</b> kWp</span><span><b>${p.strings.length}</b> strings</span>${p.hojas?.length ? `<span><b>${p.hojas.length + 1}</b> hojas</span>` : ""}</div>
      <div class="card-a"><button class="btn sm pri" data-l="abrir" data-id="${p.id}">Abrir</button><button class="btn sm" data-l="duplicar" data-id="${p.id}" title="Duplicar">${ic('copy', 15)}</button><button class="btn sm del" data-l="borrar" data-id="${p.id}" title="Borrar">${ic('trash', 15)}</button></div></div></article>`;
}
async function miniatura(p) {
  const c = document.querySelector(`[data-mini="${p.id}"]`); if (!c) return;
  await cargarImg(p.img); const g = c.getContext('2d'); g.fillStyle = '#1E242B'; g.fillRect(0, 0, c.width, c.height);
  if (!p.w) { g.fillStyle = '#698090'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Sin foto de dron', c.width / 2, c.height / 2); return; }
  const k = Math.max(c.width / p.w, c.height / p.h), R = calcular(p);
  dibujar(g, p, { k, ox: (p.w * k - c.width) / 2, oy: (p.h * k - c.height) / 2 }, { R, SI: calcStrings(p, R), u: .6, step: 'mini', rotulos: false });
}

function abrir(p) { history.replaceState(null, '', '#p=' + p.id); abrirEditor(p, async () => { L.proyectos = await listar(); lista(); }); }

function nuevo() {
  const d = document.createElement('dialog'); d.className = 'dlg';
  d.innerHTML = `<form method="dialog"><h2>Nuevo proyecto</h2>
    <div class="f"><span>Tipo de proyecto</span><div class="hoja-tipos">${[['techo', 'Fotovoltaico (techo con paneles)'], ['cargador', 'Solo cargador (EXT)'], ['otra', 'Otro']].map(([k, n], i) => `<label><input type="radio" name="tipo" value="${k}" ${i ? '' : 'checked'}><span>${n}</span></label>`).join('')}</div></div>
    <label class="f"><span>Código</span><input class="in" name="codigo" placeholder="ON 921" required></label>
    <label class="f"><span>Cliente</span><input class="in" name="cliente" placeholder="Nombre del cliente"></label>
    <label class="f"><span>Dirección</span><input class="in" name="direccion"></label>
    <div class="row"><label class="f"><span>Comuna</span><input class="in" name="comuna"></label><label class="f"><span>Región</span><input class="in" name="region"></label></div>
    <label class="f"><span>Distribuidora</span><input class="in" name="distrib" placeholder="ENEL, CGE…"></label>
    <p class="mut">La primera foto (de dron o cualquier otra) se sube en el paso de la foto. La referencia de escala es opcional.</p>
    <div class="row end"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn pri" value="ok">Crear y abrir</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', async () => {
    if (d.returnValue === 'ok') { const fd = new FormData(d.querySelector('form')), tipo = fd.get('tipo'); fd.delete('tipo'); const p = nuevoProyecto(Object.fromEntries(fd)); p.estado = 'diseno'; if (tipo && tipo !== 'techo') p.tipoHojaPrincipal = tipo; await guardar(p); L.proyectos.push(p); abrir(p); }
    d.remove();
  });
}

document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-l]'); if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.l, id = b.dataset.id, p = L.proyectos.find(x => x.id === id);
  if (a === 'abrir' && p) abrir(p);
  if (a === 'nuevo') nuevo();
  if (a === 'plantilla') paginaPlantilla(() => lista());
  if (a === 'filtro') { L.filtro = b.dataset.k; lista(); }
  if (a === 'tema') { tema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); lista(); }
  if (a === 'duplicar' && p) { const c = clone(p); c.id = uid('p'); c.codigo = (p.codigo || '') + ' (copia)'; c.creado = new Date().toISOString(); await guardar(c); L.proyectos.push(c); lista(); toast('Proyecto duplicado'); }
  if (a === 'borrar' && p) { if (!confirm(`¿Borrar ${p.codigo || 'el proyecto'}? No se puede deshacer.`)) return; await borrar(p.id); L.proyectos = L.proyectos.filter(x => x.id !== id); lista(); }
});
/* ---------- Importar un "Campos Autocad" (.xlsm) de un proyecto en curso ---------- */
async function importarExcel(archivo) {
  toast('Leyendo el Excel…');
  let r;
  try {
    const [{ dic, catalogos, plantilla }, bytes] = await Promise.all([cargarDatosFicha(), archivo.arrayBuffer()]);
    const libro = await abrirLibroBytes(bytes);
    const { ficha, resumen } = importarCamposAutocad(libro, dic, { archivo: archivo.name, catalogos, plantilla });
    r = { ficha, resumen, dic, ...datosProyectoDesdeFicha(ficha, dic, { paneles: PANELES, inversores: INVERSORES }) };
  } catch (e) { console.error(e); toast(e.message || 'No se pudo leer el archivo'); return; }
  const { ficha, resumen, datos, faltan, dic } = r;
  const nombreCampo = new Map(dic.campos.filter(c => c.tipo === 'campo').map(c => [c.celdaInfo, c.id]));
  const repetido = L.proyectos.find(p => datos.codigo && p.codigo === datos.codigo);
  const nuevosEq = Object.values(ficha.equiposProyecto).flat();
  const d = document.createElement('dialog'); d.className = 'dlg dlg-imp';
  d.innerHTML = `<form method="dialog"><h2>Importar Campos Autocad</h2>
    <p class="mut">${esc(archivo.name)}</p>
    <div class="imp-p"><b>${esc(datos.codigo || 'Sin código')}</b> · ${esc(datos.cliente || 'Sin cliente')}<br><span class="mut">${esc([datos.direccion, datos.comuna, datos.region].filter(Boolean).join(', '))}</span></div>
    <ul class="imp-k">
      <li><b>${resumen.zonos}</b><span>datos de ZonOS</span></li>
      <li><b>${resumen.entradas}</b><span>escritos o elegidos a mano</span></li>
      <li><b>${resumen.sobrescritos}</b><span>fórmulas reemplazadas a mano</span></li>
      <li><b>${resumen.camposExcel}</b><span>campos con valor</span></li>
    </ul>
    ${resumen.sobrescritos ? `<details><summary>Fórmulas reemplazadas a mano (${resumen.sobrescritos})</summary><p class="mut">En la plantilla se calculan; en este Excel alguien escribió el valor. En la ficha quedan marcadas como valor manual (✎).</p>
      <table class="imp-t">${Object.entries(ficha.sobrescritos).map(([c, s]) => `<tr><td>${esc(s.etiqueta || nombreCampo.get(c) || 'Paso intermedio · ' + c)}</td><td>${esc(s.valor)}</td></tr>`).join('')}</table></details>` : ''}
    ${nuevosEq.length ? `<div class="aviso-l info">Este Excel agregó a su catálogo: ${nuevosEq.map(x => `<b>${esc([x.marca, x.modelo].filter(Boolean).join(' '))}</b>`).join(', ')}. Se guarda dentro del proyecto.</div>` : ''}
    ${faltan.length ? `<div class="aviso-l warn">${faltan.map(esc).join('<br>')}</div>` : ''}
    ${resumen.avisos.length ? `<div class="aviso-l warn">${resumen.avisos.map(esc).join('<br>')}</div>` : ''}
    ${repetido ? `<div class="aviso-l warn">Ya tienes un proyecto ${esc(datos.codigo)}. Se creará uno nuevo; el existente no se toca.</div>` : ''}
    <p class="mut">Se crea un proyecto nuevo con estos datos. La foto de dron y el diseño se agregan después en el editor.</p>
    <div class="row end"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn pri" value="ok">Crear proyecto</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', async () => {
    if (d.returnValue === 'ok') {
      const base = nuevoProyecto();
      const p = nuevoProyecto({ ...datos, lamina: { ...base.lamina, ...Object.fromEntries(Object.entries(datos.lamina).filter(([, v]) => v)) }, ficha, estado: 'diseno', _paso: 'ficha' });
      await guardar(p); L.proyectos.push(p); toast('Proyecto creado desde el Excel'); abrir(p);
    }
    d.remove();
  });
}

document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.dataset.l === 'importar-xls' && t.files[0]) { const f = t.files[0]; t.value = ''; importarExcel(f); return; }
  if (t.dataset.l !== 'importar' || !t.files[0]) return;
  try { const p = JSON.parse(await t.files[0].text()); if (!p.roofs || !p.id) throw new Error('formato'); const base = nuevoProyecto(); const q = { ...base, ...p, lamina: { ...base.lamina, ...(p.lamina || {}) } };
    if (L.proyectos.some(x => x.id === q.id) && !confirm('Ya existe este proyecto. ¿Reemplazarlo?')) q.id = uid('p');
    await guardar(q); L.proyectos = await listar(); lista(); toast('Proyecto importado'); }
  catch (e) { toast('El archivo no es un proyecto válido de Diseño Ops'); }
});

boot();
