/* ==========================================================================
   Página "Plantilla Campos Autocad"

   Responde: ¿con qué versión de Campos Autocad está calculando la app?,
   ¿el motor puede calcular todas sus fórmulas?, ¿qué pasa si la plantilla
   cambia? Permite cargar una versión nueva (.xlsm), ver qué cambia y a qué
   proyectos afecta, y usarla en este navegador o descartarla.
   Lo que el motor no pueda calcular queda marcado: en la ficha ese campo
   se llena a mano.
   ========================================================================== */
import { $, esc, ic, toast } from '../util.js';
import { abrirLibroBytes } from '../xlsx/libro.js';
import { extraerPlantilla, compararPlantillas } from './plantilla.js';
import { calcularFicha, valorPlano } from './motor.js';
import { cargarDatosFicha, olvidarDatosFicha, cargarValidacion } from './datos.js';
import { guardarAjuste, borrarAjuste } from '../ajustes.js';
import { listar } from '../store.js';

let estado = { nueva: null, comparacion: null, impacto: null };

const fecha = s => s ? new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const nFormulas = p => Object.values(p.hojas).reduce((t, h) => t + Object.keys(h.formulas).length, 0);

/* Nombre legible de una celda: el campo del diccionario si existe */
function nombreCelda(celda, dic) {
  const [hoja, ref] = celda.split('!');
  if (hoja === 'Información proyecto') { const c = dic.campos.find(x => x.tipo === 'campo' && x.celdaInfo === ref); if (c) return `${c.id} (${ref})`; }
  return `${hoja} · ${ref}`;
}
const TIPO_PROBLEMA = { 'funcion-no-soportada': 'usa una función que la app no conoce', 'no-se-lee': 'la fórmula no se pudo leer', circular: 'referencia circular' };

export async function paginaPlantilla(volver) {
  document.body.className = 'modo-lista'; history.replaceState(null, '', '#plantilla');
  $('#app').innerHTML = `<header class="l-top"><button class="tb-btn" data-pl="volver" title="Volver a proyectos">${ic('back')}</button><img src="assets/nikola-logo-blanco.svg" alt="NIKOLA" class="l-logo"><span class="l-app">Diseño Ops</span></header>
    <main class="l-main pl-main"><p class="mut">Cargando…</p></main>`;
  $('[data-pl="volver"]').onclick = () => { estado = { nueva: null, comparacion: null, impacto: null }; volver(); };
  let d, val;
  try { [d, val] = await Promise.all([cargarDatosFicha(), cargarValidacion()]); }
  catch (e) { $('.pl-main').innerHTML = `<div class="aviso-l warn">${esc(e.message)}</div>`; return; }
  pintar(d, val);
}

function pintar(d, val) {
  const P = d.plantilla, local = d.plantillaLocal, dic = d.dic;
  const prob = P.problemas || [];
  const valOk = val && val.plantilla === P.huella;
  const main = $('.pl-main');
  main.innerHTML = `
    <div class="l-head"><div><div class="eyebrow">Ficha del proyecto · Motor de cálculo</div><h1>Plantilla Campos Autocad</h1></div></div>
    <p class="pl-intro">La app no tiene las fórmulas escritas a mano: calcula con las fórmulas de la plantilla <b>Campos Autocad</b>, igual que el Excel. Si la plantilla cambia, se carga aquí la versión nueva y la app muestra qué cambia y qué no puede calcular. Cualquier campo que no se pueda calcular se llena a mano en la ficha del proyecto.</p>
    ${local ? `<div class="aviso-l warn pl-local">${ic('alert', 16)} <span>Este navegador está usando una plantilla cargada a mano: <b>${esc(local.archivo || 'sin nombre')}</b> (${fecha(local.cargada)}). Los demás usan la publicada en el sitio.</span><button class="btn sm" data-pl="publicada">Volver a la publicada</button></div>` : ''}
    <section class="pl-grid">
      <article class="pl-card">
        <h2>En uso</h2>
        <dl class="pl-dl">
          <dt>Archivo</dt><dd>${esc(P.archivo || '—')}</dd>
          <dt>Extraída</dt><dd>${fecha(P.extraida)}</dd>
          <dt>Huella</dt><dd><code>${esc(P.huella)}</code></dd>
          <dt>Fórmulas</dt><dd>${Object.entries(P.hojas).map(([h, x]) => `${esc(h)}: <b>${Object.keys(x.formulas).length}</b>`).join(' · ')}</dd>
          <dt>Funciones</dt><dd>${P.funciones.length} distintas</dd>
          <dt>Origen</dt><dd>${local ? 'Cargada en este navegador' : 'Publicada en el sitio'}</dd>
        </dl>
      </article>
      <article class="pl-card">
        <h2>¿Se puede calcular todo?</h2>
        ${prob.length ? `<div class="aviso-l warn">${prob.length} celdas no se pueden calcular. En la ficha esos campos quedan para llenar a mano.</div>
          <ul class="pl-list">${prob.slice(0, 40).map(p => `<li><b>${esc(nombreCelda(p.celda, dic))}</b><span>${esc(TIPO_PROBLEMA[p.tipo] || p.tipo)}${p.detalle ? `: ${esc(p.detalle)}` : ''}</span></li>`).join('')}</ul>`
          : `<div class="pl-ok">${ic('check', 18)} El motor lee y calcula las ${nFormulas(P)} fórmulas.</div>`}
        <h3>Comparado con Excel reales</h3>
        ${val ? `${valOk ? '' : '<p class="mut">Esta comparación se hizo con otra versión de la plantilla.</p>'}
          <table class="pl-t"><thead><tr><th>Caso</th><th>Celdas</th><th>Iguales</th><th></th></tr></thead><tbody>
          ${val.proyectos.map(x => `<tr><td>${esc(x.caso)}</td><td>${x.comparadas}</td><td><b>${x.porcentaje.toLocaleString('es-CL')} %</b></td><td class="mut">${x.formulaAntiguaEnExcel ? `${x.formulaAntiguaEnExcel} por fórmula antigua en ese Excel` : ''}${x.distintas ? ` ${x.distintas} distintas` : ''}</td></tr>`).join('')}
          </tbody></table><p class="mut">${esc(val.nota)} (${fecha(val.fecha)})</p>` : '<p class="mut">Sin comparación registrada.</p>'}
      </article>
    </section>
    <section class="pl-card pl-nueva">
      <h2>¿Cambió Campos Autocad?</h2>
      <p>Carga la versión nueva del Excel. La app la compara con la que está en uso, te dice qué campos cambian, si hay fórmulas que no puede calcular y cómo cambiarían los proyectos guardados en este navegador. Nada cambia hasta que confirmes.</p>
      <label class="btn pri">${ic('upload')} Cargar plantilla nueva (.xlsm)<input type="file" accept=".xlsm,.xlsx" data-pl="cargar" hidden></label>
      <div class="pl-res">${estado.comparacion ? resultado(d) : ''}</div>
    </section>`;

  main.querySelector('[data-pl="cargar"]').onchange = async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) await cargarNueva(f, d, val); };
  main.querySelector('[data-pl="publicada"]')?.addEventListener('click', async () => { if (!confirm('¿Volver a la plantilla publicada en el sitio? La cargada a mano se descarta en este navegador.')) return; await borrarAjuste('plantilla'); olvidarDatosFicha(); toast('Se usa la plantilla publicada'); pintar(await cargarDatosFicha(), val); });
  main.querySelector('[data-pl="usar"]')?.addEventListener('click', async () => { await guardarAjuste('plantilla', { plantilla: estado.nueva, archivo: estado.nueva.archivo, cargada: new Date().toISOString() }); olvidarDatosFicha(); estado = { nueva: null, comparacion: null, impacto: null }; toast('Plantilla nueva en uso en este navegador'); pintar(await cargarDatosFicha(), val); });
  main.querySelector('[data-pl="descartar"]')?.addEventListener('click', () => { estado = { nueva: null, comparacion: null, impacto: null }; pintar(d, val); });
}

async function cargarNueva(archivo, d, val) {
  const res = $('.pl-res'); res.innerHTML = '<p class="mut">Leyendo la plantilla…</p>';
  try {
    const libro = await abrirLibroBytes(await archivo.arrayBuffer());
    const privados = [...(d.personas.instaladores || []).flatMap(i => [i.nombre, i.rut, i.correo, i.telefono, i.direccion]), ...(d.personas.proyectistas || [])].filter(Boolean);
    const { plantilla } = extraerPlantilla(libro, { archivo: archivo.name, nombresPrivados: privados });
    const comparacion = compararPlantillas(d.plantilla, plantilla, d.dic);
    // Impacto en los proyectos guardados que tienen ficha
    const impacto = [];
    for (const p of (await listar()).filter(p => p.ficha)) {
      const a = calcularFicha(d.plantilla, p.ficha, { personas: d.personas }).campos(d.dic), b = calcularFicha(plantilla, p.ficha, { personas: d.personas }).campos(d.dic);
      const cambian = a.filter((x, i) => String(valorPlano(x.valor ?? x.error)) !== String(valorPlano(b[i].valor ?? b[i].error)));
      impacto.push({ codigo: p.codigo || 'Sin código', cliente: p.cliente || '', cambian: cambian.map(x => x.id) });
    }
    estado = { nueva: plantilla, comparacion, impacto };
    pintar(d, val);
  } catch (e) { console.error(e); res.innerHTML = `<div class="aviso-l warn">${esc(e.message || 'No se pudo leer el archivo')}</div>`; }
}

function resultado(d) {
  const c = estado.comparacion, N = estado.nueva, fi = c.formulas;
  if (c.igual) return `<div class="pl-ok">${ic('check', 18)} <b>${esc(N.archivo)}</b> es igual a la plantilla en uso. No hay nada que cambiar.</div><div class="row"><button class="btn" data-pl="descartar">Cerrar</button></div>`;
  const tot = h => fi[h].nuevas.length + fi[h].eliminadas.length + fi[h].cambiadas.length;
  return `<h3>${esc(N.archivo)} comparada con la plantilla en uso</h3>
    <ul class="imp-k pl-k">
      <li><b>${tot('Información proyecto')}</b><span>fórmulas distintas en Información proyecto</span></li>
      <li><b>${tot('Cuadro de carga')}</b><span>fórmulas distintas en Cuadro de carga</span></li>
      <li><b>${c.autocad.length}</b><span>filas de la hoja Autocad cambiadas</span></li>
      <li><b>${(N.problemas || []).length}</b><span>celdas que el motor no puede calcular</span></li>
    </ul>
    ${c.problemasNuevos.length ? `<div class="aviso-l warn"><b>Ojo:</b> ${c.problemasNuevos.length} celdas nuevas no se pueden calcular. Si usas esta plantilla, esos campos se llenan a mano en la ficha.<ul class="pl-list">${c.problemasNuevos.slice(0, 20).map(p => `<li><b>${esc(nombreCelda(p.celda, d.dic))}</b><span>${esc(TIPO_PROBLEMA[p.tipo] || p.tipo)}${p.detalle ? `: ${esc(p.detalle)}` : ''}</span></li>`).join('')}</ul></div>` : ''}
    ${c.necesitaDiccionario ? `<div class="aviso-l warn"><b>La hoja Autocad cambió</b> (la que lee la macro de AutoCAD). Para que los nombres de los campos y la exportación queden al día, hay que regenerar el diccionario en el sitio (<code>npm run diccionario</code>). Mientras tanto, revisa estas filas:
      <table class="pl-t"><thead><tr><th>Fila</th><th>Cambio</th><th>Campo hoy</th><th>Celda antes → ahora</th></tr></thead><tbody>${c.autocad.slice(0, 40).map(x => `<tr><td>${x.fila}</td><td>${x.tipo}</td><td>${esc(x.campo || '—')}</td><td>${esc(x.antes || '—')} → ${esc(x.ahora || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${c.camposAfectados.length ? `<details><summary>Campos cuya fórmula cambia (${c.camposAfectados.length})</summary><table class="pl-t"><tbody>${c.camposAfectados.map(x => `<tr><td>${esc(x.campo)}</td><td class="mut">${esc(x.celda)}</td><td>${esc(x.cambio)}</td></tr>`).join('')}</tbody></table></details>` : ''}
    ${Object.values(c.tablas).some(Boolean) ? `<p class="mut">Tablas: ${Object.entries(c.tablas).map(([h, n]) => `${esc(h)} ${n} celdas distintas`).join(' · ')}.</p>` : ''}
    <h3>Proyectos guardados en este navegador</h3>
    ${estado.impacto.length ? `<table class="pl-t"><thead><tr><th>Proyecto</th><th>Campos que cambian</th></tr></thead><tbody>${estado.impacto.map(x => `<tr><td><b>${esc(x.codigo)}</b> <span class="mut">${esc(x.cliente)}</span></td><td>${x.cambian.length ? `${x.cambian.length}: <span class="mut">${esc(x.cambian.slice(0, 6).join(', '))}${x.cambian.length > 6 ? '…' : ''}</span>` : 'ninguno'}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">No hay proyectos con ficha en este navegador.</p>'}
    <div class="row end"><button class="btn" data-pl="descartar">Descartar</button><button class="btn pri" data-pl="usar">Usar esta plantilla en este navegador</button></div>
    <p class="mut">Para que todo Ops use la versión nueva, se publica en el sitio con <code>node scripts/extraer-plantilla.mjs</code> (y <code>npm run diccionario</code> si cambió la hoja Autocad).</p>`;
}
