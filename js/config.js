/* ==========================================================================
   Página "Configuración" (se abre desde la lista de proyectos, junto a Plantilla,
   o desde la rueda del editor). Dos pestañas:
   · Normas: todas las normas con su fuente (documento, punto, página), si se
     revisan solas en el dibujo o son de checklist, y para qué proyectos aplican.
   · Equipos y medidas: Mis equipos (los que guarda Ops, también desde el dibujo)
     y la base de equipos con medidas reales y espacios libres del fabricante.
   Todo se guarda en este navegador (cuando exista Supabase, pasa a la cuenta de Ops).
   ========================================================================== */
import { $, esc, fmt, ic, toast, parseNum } from './util.js';
import { EQUIPOS, CANAL, INVERSORES, PANELES, OTROS_EMAT, EQUIPOS_USUARIO, cargarEquiposUsuario, guardarEquiposUsuario, guardarCorreccion, datoOriginal } from './catalogo.js';
import { cargarNormas, guardarNormas, restaurarNormas, TIPOS_NORMA, AMBITOS, ORIGENES, textoFuente, esBase } from './normas.js';

const C = { tab: 'normas', normas: null, filtro: { ambito: 'todos', clase: 'todas' }, volver: null };
const TIPOS_EQ = () => Object.entries(EQUIPOS).filter(([k, Q]) => !Q.soloRef && k !== 'inv');
const mm = v => v == null || v === '' ? '—' : fmt(v, 0);
const med = x => `${mm(x.ancho)} × ${mm(x.alto)} × ${mm(x.prof)}`;
const libreTxt = L => L ? ['arriba', 'abajo', 'lados', 'frente'].filter(k => L[k]).map(k => `${k} ${fmt(L[k], 0)}`).join(' · ') : '—';

export async function paginaConfig(volver, tab = 'normas') {
  C.volver = volver; C.tab = tab;
  document.body.className = 'modo-lista'; history.replaceState(null, '', '#config');
  $('#app').innerHTML = `<header class="l-top"><button class="tb-btn" data-cf="volver" title="Volver">${ic('back')}</button><img src="assets/nikola-logo-blanco.svg" alt="NIKOLA" class="l-logo"><span class="l-app">Diseño Ops</span></header>
    <main class="l-main cf-main"><p class="mut">Cargando…</p></main>`;
  [C.normas] = await Promise.all([cargarNormas(), cargarEquiposUsuario()]);
  pintar();
}

function pintar() {
  const main = $('.cf-main'); if (!main) return;
  main.innerHTML = `<div class="l-head"><div><div class="eyebrow">Diseño Ops · Ajustes de Operaciones</div><h1>Configuración</h1></div></div>
    <nav class="cf-tabs" role="tablist">${[['normas', 'Normas'], ['equipos', 'Equipos y medidas']].map(([k, n]) => `<button role="tab" class="cf-tab" data-cf="tab" data-k="${k}" aria-selected="${C.tab === k}">${n}</button>`).join('')}</nav>
    <section class="cf-body">${C.tab === 'normas' ? vistaNormas() : vistaEquipos()}</section>`;
}

/* ---------------- Normas ---------------- */
function vistaNormas() {
  const N = C.normas, f = C.filtro;
  const vis = N.filter(n => (f.ambito === 'todos' || (n.ambito || 'todos') === f.ambito || (n.ambito || 'todos') === 'todos') && (f.clase === 'todas' || (f.clase === 'chk') === (n.tipo === 'checklist')));
  const cnt = { sec: N.filter(n => n.origen === 'norma').length, nik: N.filter(n => n.origen === 'nikola').length, ver: N.filter(n => n.verificar).length, act: N.filter(n => n.activa !== false).length };
  const geo = vis.filter(n => n.tipo !== 'checklist'), chk = vis.filter(n => n.tipo === 'checklist');
  const chip = (g, k, n) => `<button class="chip" data-cf="filtro" data-g="${g}" data-k="${k}" aria-pressed="${f[g] === k}">${n}</button>`;
  return `<p class="pl-intro">Cada norma dice de dónde sale: documento, punto y página. Las <b>geométricas</b> se revisan solas en el dibujo (vista de frente con nivel de piso, o largo de las canalizaciones) y avisan en rojo. Las de <b>checklist</b> no se pueden medir en el dibujo: se marcan en cada proyecto y quedan como respaldo de la revisión. Se eligieron solo las que afectan el diseño; los ajustes de protecciones y los trámites quedan fuera.</p>
    <div class="cf-resumen"><span><b>${cnt.act}</b> activas</span><span><b>${cnt.sec}</b> con fuente SEC</span><span><b>${cnt.nik}</b> criterio Nikola</span>${cnt.ver ? `<span class="warn"><b>${cnt.ver}</b> con punto por verificar</span>` : ''}</div>
    <div class="row wrap cf-filtros"><div class="chips">${chip('ambito', 'todos', 'Todos los proyectos')}${chip('ambito', 'fv', 'Fotovoltaico')}${chip('ambito', 'cargador', 'Solo cargador')}</div>
      <div class="chips">${chip('clase', 'todas', 'Todas')}${chip('clase', 'geo', 'Se revisan en el dibujo')}${chip('clase', 'chk', 'Checklist')}</div></div>
    ${geo.length ? `<h2 class="cf-h">Se revisan en el dibujo <em>${geo.length}</em></h2><div class="cf-lista">${geo.map(tarjeta).join('')}</div>` : ''}
    ${chk.length ? `<h2 class="cf-h">Checklist del proyecto <em>${chk.length}</em></h2><div class="cf-lista">${chk.map(tarjeta).join('')}</div>` : ''}
    <div class="row wrap"><button class="btn" data-cf="n-nueva">${ic('plus', 15)} Agregar norma</button><button class="btn" data-cf="n-base">Volver a las normas iniciales</button></div>`;
}
function tarjeta(n) {
  const i = C.normas.indexOf(n), base = esBase(n), tipo = n.tipo;
  const eqs = TIPOS_EQ().concat([['inv', EQUIPOS.inv]]), cans = Object.entries(CANAL).filter(([, X]) => !X.riel && !X.libre);
  const usaMin = ['montaje', 'alturaSup', 'alturaInf', 'altCentro', 'libre', 'canalMin'].includes(tipo), usaMax = ['montaje', 'alturaSup', 'altCentro', 'largoMax'].includes(tipo);
  const num = (k, l, u) => `<label class="f mini"><span>${l}</span><span class="fi"><input class="in" data-nn="${k}" value="${n[k] ?? ''}" inputmode="decimal"><em>${u}</em></span></label>`;
  return `<article class="cf-n${n.activa === false ? ' off' : ''}" data-i="${i}">
    <div class="cf-n-top"><label class="sw" title="Activa"><input type="checkbox" data-nn="activa" ${n.activa !== false ? 'checked' : ''}><i></i></label>
      <div class="cf-n-t"><b>${esc(n.nombre)}</b>
        <div class="cf-badges"><span class="bd o-${n.origen || 'nikola'}">${ORIGENES[n.origen] || 'Criterio Nikola'}</span><span class="bd">${AMBITOS[n.ambito || 'todos']}</span>${n.verificar ? '<span class="bd warn" title="El punto se dedujo del texto: confirmarlo en el PDF">Verificar punto</span>' : ''}${n.cond?.kwMin ? `<span class="bd">desde ${n.cond.kwMin} kW</span>` : ''}${n.cond?.siCanal ? '<span class="bd">si hay subterránea</span>' : ''}${n.cond?.siEquipo ? '<span class="bd">si hay baterías</span>' : ''}</div>
        <div class="cf-fuente">${ic('sheet', 13)} ${esc(textoFuente(n))}</div>${n.nota ? `<div class="mut sm">${esc(n.nota)}</div>` : ''}</div></div>
    <details class="cf-ed"><summary>Editar</summary>
      <label class="f"><span>Nombre</span><input class="in" data-nn="nombre" value="${esc(n.nombre)}"></label>
      <div class="row wrap"><label class="f"><span>Qué revisa</span><select class="in" data-nn="tipo">${Object.entries(TIPOS_NORMA).map(([k, t]) => `<option value="${k}" ${tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="f"><span>Proyectos</span><select class="in" data-nn="ambito">${Object.entries(AMBITOS).map(([k, t]) => `<option value="${k}" ${(n.ambito || 'todos') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="f"><span>Origen</span><select class="in" data-nn="origen">${Object.entries(ORIGENES).map(([k, t]) => `<option value="${k}" ${(n.origen || 'nikola') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${tipo !== 'checklist' ? `<div class="row wrap">${usaMin ? num('min', tipo === 'libre' ? 'A los lados' : 'Mínimo', 'm') : ''}${usaMax ? num('max', 'Máximo', 'm') : ''}
        ${tipo === 'alturaInf' ? `<label class="f mini"><span>Solo tableros</span><select class="in" data-nn="ubic"><option value="">Cualquiera</option><option value="armario" ${n.ubic === 'armario' ? 'selected' : ''}>En armario</option><option value="intemperie" ${n.ubic === 'intemperie' ? 'selected' : ''}>A la intemperie</option></select></label>` : ''}
        ${tipo === 'libre' ? `<label class="chk"><input type="checkbox" data-nn="fabricante" ${n.fabricante ? 'checked' : ''}> Usar también el espacio del fabricante</label>` : ''}
        ${tipo === 'largoMax' ? `<label class="f mini"><span>Tramo</span><select class="in" data-nn="tramo"><option value="">Todos</option><option value="inv-tg" ${n.tramo === 'inv-tg' ? 'selected' : ''}>Inversor – TGFV</option><option value="tg-emp" ${n.tramo === 'tg-emp' ? 'selected' : ''}>TG – Empalme</option></select></label>` : ''}</div>
      <div class="cfg-chips">${['canalMin', 'largoMax'].includes(tipo) ? cans.map(([k, X]) => `<label><input type="checkbox" data-lista="canal" value="${k}" ${(n.canal || []).includes(k) ? 'checked' : ''}> ${esc(X.corto)}</label>`).join('') : eqs.map(([k, Q]) => `<label><input type="checkbox" data-lista="equipos" value="${k}" ${(n.equipos || []).includes(k) ? 'checked' : ''}> ${esc(Q.n)}</label>`).join('')}</div>` : ''}
      <div class="row wrap"><label class="f"><span>Documento</span><input class="in" data-fu="doc" value="${esc(n.fuente?.doc || '')}" placeholder="RGR N°02/2024"></label><label class="f mini"><span>Punto</span><input class="in" data-fu="punto" value="${esc(n.fuente?.punto || '')}"></label><label class="f mini"><span>Página</span><input class="in" data-fu="pag" value="${esc(n.fuente?.pag || '')}"></label></div>
      <label class="f"><span>Nota</span><input class="in" data-nn="nota" value="${esc(n.nota || '')}"></label>
      <div class="row end">${base ? '<span class="mut sm">Norma inicial: si la borras puedes recuperarla con «Volver a las normas iniciales».</span>' : ''}<button class="btn sm del" data-cf="n-borrar">${ic('trash', 14)} Borrar</button></div>
    </details></article>`;
}
let tGuardar = null;
const guardarLuego = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => guardarNormas(C.normas).then(() => toast('Normas guardadas')), 500); };
function leerTarjeta(el) {
  const n = C.normas[+el.dataset.i]; if (!n) return;
  el.querySelectorAll('[data-nn]').forEach(i => { const k = i.dataset.nn;
    if (i.type === 'checkbox') n[k] = i.checked;
    else if (k === 'min' || k === 'max') { const v = parseNum(i.value); if (v != null) n[k] = v; else delete n[k]; }
    else if (['ubic', 'tramo', 'nota'].includes(k)) { if (i.value) n[k] = i.value; else delete n[k]; }
    else n[k] = i.value; });
  const f = {}; el.querySelectorAll('[data-fu]').forEach(i => { f[i.dataset.fu] = i.value.trim(); }); if (el.querySelector('[data-fu]')) n.fuente = f;
  const ls = el.querySelectorAll('[data-lista]'); if (ls.length) n[ls[0].dataset.lista] = [...ls].filter(x => x.checked).map(x => x.value);
}

/* ---------------- Equipos ---------------- */
function vistaEquipos() {
  const U = EQUIPOS_USUARIO, otros = OTROS_EMAT.filter(x => x.k && x.ancho);
  const grupos = {}; otros.forEach(x => { (grupos[x.k] ||= []).push(x); });
  return `<p class="pl-intro">Medidas reales en mm (ancho × alto × profundidad, de frente). En la vista de frente el equipo se dibuja con ancho × alto; en planta con ancho × profundidad. El <b>espacio libre</b> es el que pide el manual del fabricante y lo usa la norma de espacio libre del inversor.</p>
    <article class="pl-card"><div class="row"><h2>Mis equipos</h2><span class="tb-sp"></span><button class="btn sm pri" data-cf="eq-nuevo">${ic('plus', 14)} Agregar equipo</button></div>
      <p class="mut">Los que agrega Operaciones: desde aquí o desde el dibujo, con «Guardar como equipo» en las propiedades de un equipo. Aparecen como modelo en el dibujo.</p>
      ${U.length ? `<div class="cf-tw"><table class="cf-t"><thead><tr><th>Equipo</th><th>Tipo</th><th>Ancho × alto × prof.</th><th>Peso</th><th>Espacio libre</th><th>Fuente</th><th></th></tr></thead><tbody>
        ${U.map((x, i) => `<tr><td><b>${esc(x.item)}</b>${x.nota ? `<div class="mut sm">${esc(x.nota)}</div>` : ''}</td><td>${esc(EQUIPOS[x.k]?.n || x.k)}</td><td class="nm">${med(x)}</td><td class="nm">${x.peso ? fmt(x.peso, 1) + ' kg' : '—'}</td><td class="sm">${libreTxt(x.libre)}</td><td class="sm">${esc(x.fuente || '—')}</td>
          <td class="nw"><button class="btn sm" data-cf="eq-ed" data-i="${i}" title="Editar">Editar</button><button class="btn sm del" data-cf="eq-del" data-i="${i}" title="Borrar">${ic('trash', 13)}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">Todavía no hay equipos propios.</p>'}
    </article>
    <article class="pl-card"><h2>Inversores</h2><p class="mut">Base EMAT con medidas de ficha técnica. El espacio libre sale de las figuras de instalación de los manuales; donde no está, rige el mínimo de RGR N°02/2024 (15 cm a cada lado).</p>
      <div class="cf-tw"><table class="cf-t"><thead><tr><th>Modelo</th><th>kW</th><th>Fase</th><th>Ancho × alto × prof.</th><th>Peso</th><th>Espacio libre (mm)</th><th>Confianza</th><th></th></tr></thead><tbody>
      ${INVERSORES.map(x => `<tr><td><b>${esc(x.modelo)}</b>${x.nota ? `<div class="mut sm">${esc(x.nota)}</div>` : ''}</td><td class="nm">${fmt(x.kw, 0)}</td><td>${esc(x.fase)}</td><td class="nm">${med(x)}</td><td class="nm">${x.peso ? fmt(x.peso, 1) + ' kg' : '—'}</td><td class="sm">${libreTxt(x.libre)}</td><td>${conf(x)}</td><td class="nw">${fuenteLink(x.fuente)}${btnEd('inv', INVERSORES.indexOf(x))}</td></tr>`).join('')}</tbody></table></div></article>
    ${Object.entries(grupos).map(([k, xs]) => `<article class="pl-card"><h2>${esc(EQUIPOS[k]?.n || ({ pasillo: 'Pasillos técnicos', bandeja: 'Bandejas' })[k] || k)}</h2>
      <div class="cf-tw"><table class="cf-t"><thead><tr><th>Equipo</th><th>Ancho × alto × prof.</th><th>Peso</th><th>Montaje</th><th>Confianza</th><th></th></tr></thead><tbody>
      ${xs.map(x => `<tr><td><b>${esc(x.item)}</b>${x.nota ? `<div class="mut sm">${esc(x.nota)}</div>` : ''}${x.torre ? `<div class="mut sm">Torre: ${Object.entries(x.torre).map(([n, h]) => `${n} mód. ${fmt(h, 0)} mm`).join(' · ')}</div>` : ''}</td><td class="nm">${med(x)}</td><td class="nm">${x.peso ? fmt(x.peso, 1) + ' kg' : '—'}</td><td>${esc(x.montaje || '—')}</td><td>${conf(x)}</td><td class="nw">${fuenteLink(x.fuente)}${btnEd('otro', OTROS_EMAT.indexOf(x))}</td></tr>`).join('')}</tbody></table></div></article>`).join('')}
    <article class="pl-card"><h2>Paneles</h2><div class="cf-tw"><table class="cf-t"><thead><tr><th>Panel</th><th>Largo × ancho × espesor</th><th>Peso</th><th>Wp</th><th>Confianza</th><th></th></tr></thead><tbody>
      ${PANELES.map(x => `<tr><td><b>${esc(x.n)}</b><div class="mut sm">${esc(x.modelo || '')}</div></td><td class="nm">${mm(x.largo)} × ${mm(x.ancho)} × ${mm(x.espesor)}</td><td class="nm">${x.peso ? fmt(x.peso, 1) + ' kg' : '—'}</td><td class="nm">${x.wp}</td><td>${conf(x)}</td><td class="nw">${fuenteLink(x.fuente)}${btnEd('panel', PANELES.indexOf(x))}</td></tr>`).join('')}</tbody></table></div></article>
    <article class="pl-card"><h2>Símbolos genéricos</h2><p class="mut">Medida que toma un equipo cuando no se elige modelo (ancho × alto de frente × prof. en planta).</p>
      <div class="cf-tw"><table class="cf-t"><tbody>${Object.entries(EQUIPOS).filter(([, Q]) => !Q.soloRef).map(([k, Q]) => `<tr><td>${esc(Q.n)}</td><td class="nm">${mm(Q.w)} × ${mm(Q.a)} × ${mm(Q.h)}</td></tr>`).join('')}</tbody></table></div></article>`;
}
const conf = x => (x.confianza ? `<span class="bd c-${x.confianza}">${x.confianza}</span>` : '—') + (x.corregido ? ' <span class="bd warn" title="Corregido por Operaciones">corregido</span>' : '');
const btnEd = (g, i) => ` <button class="btn sm" data-cf="emat-ed" data-g="${g}" data-i="${i}" title="Corregir medidas o cambiar la ficha">Editar</button>`;
const LISTA_EMAT = { inv: INVERSORES, otro: OTROS_EMAT, panel: PANELES };
const fuenteLink = f => !f ? '' : /^https?:/.test(f) ? `<a href="${esc(f)}" target="_blank" rel="noopener" class="sm">Ficha</a>` : `<span class="mut sm">${esc(f)}</span>`;

/* Diálogo para crear o editar un equipo de Mis equipos. inicial: datos que se proponen.
   Devuelve el equipo guardado o null. Lo usa también el editor («Guardar como equipo»). */
export function dialogoEquipo(inicial = {}, { titulo = 'Guardar como equipo', tipos = null } = {}) {
  return new Promise(res => {
    const x = { k: 'otro', montaje: 'muro', ...inicial }, L = x.libre || {};
    const ks = tipos || TIPOS_EQ().map(([k]) => k);
    const d = document.createElement('dialog'); d.className = 'dlg dlg-eq';
    const n = (k, l, v, u = 'mm') => `<label class="f mini"><span>${l}</span><span class="fi"><input class="in" name="${k}" value="${v ?? ''}" inputmode="decimal"><em>${u}</em></span></label>`;
    d.innerHTML = `<form method="dialog"><h2>${esc(titulo)}</h2>
      <p class="mut">Escribe la medida real de la ficha técnica o medida en terreno. Queda en Mis equipos para todos los proyectos de este navegador.</p>
      <label class="f"><span>Nombre</span><input class="in" name="item" value="${esc(x.item || '')}" placeholder="Ej. Tablero IP65 12 circuitos Legrand" required></label>
      <div class="row"><label class="f"><span>Tipo de equipo</span><select class="in" name="k">${ks.map(k => `<option value="${k}" ${x.k === k ? 'selected' : ''}>${esc(EQUIPOS[k]?.n || k)}</option>`).join('')}</select></label>
        <label class="f"><span>Montaje</span><select class="in" name="montaje">${['muro', 'piso', 'riel DIN', 'poste', 'techo'].map(m => `<option ${x.montaje === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <div class="f"><span>Medida real</span><div class="row">${n('ancho', 'Ancho', x.ancho)}${n('alto', 'Alto', x.alto)}${n('prof', 'Profundidad', x.prof)}${n('peso', 'Peso', x.peso, 'kg')}</div></div>
      <details ${L.arriba || L.abajo || L.lados ? 'open' : ''}><summary>Espacio libre que pide el fabricante (opcional)</summary><div class="row">${n('l_arriba', 'Arriba', L.arriba)}${n('l_abajo', 'Abajo', L.abajo)}${n('l_lados', 'Lados', L.lados)}${n('l_frente', 'Frente', L.frente)}</div></details>
      <label class="f"><span>Fuente de la medida</span><input class="in" name="fuente" value="${esc(x.fuente || '')}" placeholder="Ficha técnica, manual o medida en terreno"></label>
      <label class="f"><span>Nota</span><input class="in" name="nota" value="${esc(x.nota || '')}"></label>
      <p class="aviso-l warn" data-err hidden>Falta el ancho, el alto o la profundidad.</p>
      <div class="row end"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn pri" value="ok">Guardar equipo</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    const leer = () => { const fd = new FormData(d.querySelector('form')), g = k => parseNum(fd.get(k));
      const libre = {}; ['arriba', 'abajo', 'lados', 'frente'].forEach(k => { const v = g('l_' + k); if (v > 0) libre[k] = v; });
      return { ...x, id: x.id || 'mq' + Date.now().toString(36), item: String(fd.get('item')).trim(), k: fd.get('k'), montaje: fd.get('montaje'), modelo: String(fd.get('item')).trim(),
        ancho: g('ancho'), alto: g('alto'), prof: g('prof'), peso: g('peso') || null, libre: Object.keys(libre).length ? libre : undefined, fuente: String(fd.get('fuente')).trim(), nota: String(fd.get('nota')).trim(), creado: x.creado || new Date().toISOString() }; };
    d.querySelector('button[value="ok"]').addEventListener('click', ev => { const r = leer(); if (!(r.ancho > 0 && r.alto > 0 && r.prof > 0)) { ev.preventDefault(); d.querySelector('[data-err]').hidden = false; } });
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'ok') { d.remove(); return res(null); }
      const r = leer(); d.remove();
      await cargarEquiposUsuario();
      const lista = [...EQUIPOS_USUARIO], i = lista.findIndex(q => q.id === r.id);
      if (i >= 0) lista[i] = r; else lista.push(r);
      await guardarEquiposUsuario(lista); toast(`«${r.item}» guardado en Mis equipos`); res(r);
    });
  });
}

/* Diálogo para corregir un equipo de la base EMAT. Guarda solo lo que cambió respecto
   al dato original; «Volver al dato original» borra la corrección. */
function dialogoCorreccion(x, g) {
  return new Promise(res => {
    const O = datoOriginal(x), L = x.libre || {}, panel = g === 'panel';
    const d = document.createElement('dialog'); d.className = 'dlg dlg-eq';
    const n = (k, l, v, u = 'mm') => `<label class="f mini"><span>${l}</span><span class="fi"><input class="in" name="${k}" value="${v ?? ''}" inputmode="decimal"><em>${u}</em></span></label>`;
    d.innerHTML = `<form method="dialog"><h2>Editar ${esc(x.modelo || x.item || x.n)}</h2>
      <p class="mut">Corrige la medida o cambia la ficha técnica. El cambio vale para los equipos que pongas desde ahora; los ya dibujados conservan su medida.</p>
      <div class="f"><span>Medida real</span><div class="row">${panel ? n('largo', 'Largo', x.largo) + n('ancho', 'Ancho', x.ancho) + n('espesor', 'Espesor', x.espesor) + n('wp', 'Potencia', x.wp, 'Wp')
        : n('ancho', 'Ancho', x.ancho) + n('alto', 'Alto', x.alto) + n('prof', 'Profundidad', x.prof)}${n('peso', 'Peso', x.peso, 'kg')}</div></div>
      ${panel ? '' : `<details ${L.arriba || L.abajo || L.lados || L.frente ? 'open' : ''}><summary>Espacio libre que pide el fabricante</summary><div class="row">${n('l_arriba', 'Arriba', L.arriba)}${n('l_abajo', 'Abajo', L.abajo)}${n('l_lados', 'Lados', L.lados)}${n('l_frente', 'Frente', L.frente)}</div></details>`}
      <label class="f"><span>Ficha técnica (enlace o nombre del documento)</span><input class="in" name="fuente" value="${esc(x.fuente || '')}"></label>
      <label class="f"><span>Nota</span><input class="in" name="nota" value="${esc(x.nota || '')}"></label>
      ${x.corregido ? `<p class="mut sm">Dato original: ${panel ? `${mm(O.largo)} × ${mm(O.ancho)} × ${mm(O.espesor)}` : med(O)} mm${O.peso ? ` · ${fmt(O.peso, 1)} kg` : ''}</p>` : ''}
      <div class="row end">${x.corregido ? '<button class="btn" value="orig" formnovalidate>Volver al dato original</button><span class="tb-sp"></span>' : ''}<button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn pri" value="ok">Guardar</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', async () => {
      const v = d.returnValue, fd = new FormData(d.querySelector('form')); d.remove();
      if (v === 'orig') { await guardarCorreccion(x, null); toast('Volvió al dato original'); return res(true); }
      if (v !== 'ok') return res(false);
      const nuevo = {}, num = k => { const t = fd.get(k); return t == null ? undefined : (parseNum(t) ?? null); };
      (panel ? ['largo', 'ancho', 'espesor', 'wp', 'peso'] : ['ancho', 'alto', 'prof', 'peso']).forEach(k => { nuevo[k] = num(k); });
      if (!panel) { const lb = {}; ['arriba', 'abajo', 'lados', 'frente'].forEach(k => { const w = num('l_' + k); if (w > 0) lb[k] = w; }); nuevo.libre = Object.keys(lb).length ? lb : undefined; }
      nuevo.fuente = String(fd.get('fuente')).trim() || undefined; nuevo.nota = String(fd.get('nota')).trim() || undefined;
      const corr = {}; Object.entries(nuevo).forEach(([k, w]) => { if (JSON.stringify(w ?? null) !== JSON.stringify(O[k] ?? null)) corr[k] = w ?? null; });
      await guardarCorreccion(x, Object.keys(corr).length ? corr : null); toast(Object.keys(corr).length ? 'Equipo corregido' : 'Sin cambios'); res(true);
    });
  });
}

/* ---------------- Eventos ---------------- */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-cf]'); if (!b || !$('.cf-main')) return;
  const a = b.dataset.cf;
  if (a === 'volver') { const v = C.volver; C.volver = null; v && v(); return; }
  if (a === 'tab') { C.tab = b.dataset.k; pintar(); return; }
  if (a === 'filtro') { C.filtro[b.dataset.g] = b.dataset.k; pintar(); return; }
  if (a === 'n-nueva') { C.normas.push({ id: 'n' + Date.now().toString(36), nombre: 'Nueva norma', tipo: 'montaje', equipos: ['inv'], min: 0.6, max: 2, activa: true, ambito: 'todos', origen: 'nikola', fuente: { doc: '', punto: '', pag: '' } }); C.filtro = { ambito: 'todos', clase: 'todas' }; pintar(); guardarLuego();
    const ult = [...document.querySelectorAll('.cf-n')].pop(); if (ult) { ult.querySelector('details').open = true; ult.scrollIntoView({ block: 'center' }); } return; }
  if (a === 'n-base') { if (!confirm('¿Volver a las normas iniciales? Se pierden las que agregaste o cambiaste.')) return; C.normas = restaurarNormas(); pintar(); guardarLuego(); return; }
  if (a === 'n-borrar') { const el = b.closest('.cf-n'), n = C.normas[+el.dataset.i]; if (!n || !confirm(`¿Borrar «${n.nombre}»?`)) return; C.normas.splice(+el.dataset.i, 1); pintar(); guardarLuego(); return; }
  if (a === 'emat-ed') { const x = LISTA_EMAT[b.dataset.g]?.[+b.dataset.i]; if (!x) return; if (await dialogoCorreccion(x, b.dataset.g)) pintar(); return; }
  if (a === 'eq-nuevo') { const r = await dialogoEquipo({}, { titulo: 'Agregar equipo' }); if (r) pintar(); return; }
  if (a === 'eq-ed') { const x = EQUIPOS_USUARIO[+b.dataset.i]; if (!x) return; const r = await dialogoEquipo(x, { titulo: 'Editar equipo' }); if (r) pintar(); return; }
  if (a === 'eq-del') { const x = EQUIPOS_USUARIO[+b.dataset.i]; if (!x || !confirm(`¿Borrar «${x.item}» de Mis equipos? Los proyectos que lo usan conservan su medida.`)) return; await guardarEquiposUsuario(EQUIPOS_USUARIO.filter(q => q !== x)); pintar(); return; }
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('.cf-n'); if (!el || !$('.cf-main')) return;
  leerTarjeta(el); guardarLuego();
  if (ev.target.dataset.nn === 'tipo' || ev.target.dataset.nn === 'activa') { const abierto = el.querySelector('details')?.open, i = el.dataset.i; pintar(); if (abierto) { const nuevo = document.querySelector(`.cf-n[data-i="${i}"] details`); if (nuevo) nuevo.open = true; } }
});
