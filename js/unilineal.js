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

const VB = [262, 314];                 // viewBox del unilineal (mm)
const S = { p: null, el: null, cb: {}, zoom: null, z: 1 };
const uni = () => (S.p.uni ||= {});
const activo = () => !!S.el?.isConnected;
const cambio = () => { S.cb.cambio && S.cb.cambio(); };

export function vistaUnilineal(el, p, cb = {}) {
  S.el = el; S.p = p; S.cb = cb;
  el.innerHTML = `<div class="uni">
    <div class="inf-bar"><span class="inf-bar-t">Unilineal · <span id="uniBase"></span></span><button class="inf-btn" data-act="uni-bases" style="margin-left:10px">Unilineales base…</button><span class="uni-ayuda">Clic en cualquier texto para cambiarlo · Ctrl + rueda = zoom</span><span class="tb-sp"></span>
      <span class="inf-zoom"><button data-act="uni-z" data-k="-1" title="Alejar">−</button><button data-act="uni-z" data-k="0" title="Ajustar a la pantalla" id="uniZ">Ajustar</button><button data-act="uni-z" data-k="1" title="Acercar">+</button></span></div>
    <div class="inf-scroll uni-scroll"><div class="uni-papel"></div></div></div>`;
  dibujarSVG();
}
function dibujarSVG() {
  const pap = S.el?.querySelector('.uni-papel'); if (!pap) return;
  const R = calcular(S.p), SI = calcStrings(S.p, R);
  pap.innerHTML = unilinealSVG(S.p, R, SI);
  const nb = S.el.querySelector('#uniBase'); if (nb) nb.textContent = baseUni(S.p).n;
  ajustar();
}
function ajustar() {
  const sc = S.el?.querySelector('.uni-scroll'), pap = S.el?.querySelector('.uni-papel'); if (!sc || !pap) return;
  const fit = Math.max(.5, Math.min((sc.clientWidth - 48) / VB[0], (sc.clientHeight - 48) / VB[1]));
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
  let h = sec('Unilineal base', `<label class="f"><span>Base</span><select class="in" data-uni="u.base"><option value="" ${!p.uni?.base ? 'selected' : ''}>Sugerido por el inversor: ${esc(sug.n)}</option>${grupos.map(g => `<optgroup label="${esc(g)}">${BASES_UNI.filter(b => b.g === g).map(b => `<option value="${b.id}" ${p.uni?.base === b.id ? 'selected' : ''}>${esc(b.n)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <button class="btn sm" data-act="uni-bases">Ver todos los unilineales base</button>
    ${(o => o ? `<div class="aviso warn">${ic('alert', 15)}<span>Esta base no calza con el inversor del proyecto (${esc(inv.modelo)}).</span></div><button class="btn sm" data-act="uni-inv" data-id="${o.id}">Cambiar el inversor a ${esc(o.modelo)}</button>` : '')(invDeBase(B, p))}`);
  h += sec('Unilineal', `<p class="mut">Se arma solo con los datos del proyecto. Cambia los datos aquí o haz clic en cualquier texto del diagrama para escribirlo a mano. Es el mismo unilineal de las láminas A1 y del bloque «Unilineal» del informe.</p>
    <div class="kpis"><div><b>${SI.lista.length}</b><span>strings</span></div><div><b>${inv.mppt}</b><span>MPPT</span></div><div><b>${fmt(inv.kw * (p.cantInv || 1), 1)}</b><span>kW nom.</span></div></div>`);
  h += sec('Inversor', `<label class="f"><span>Modelo</span><select class="in" data-uni="p.inversor">${['Monofásico', 'Trifásico'].map(fa => `<optgroup label="${fa}s">${INVERSORES.filter(x => x.fase === fa).map(x => `<option value="${x.id}" ${inv.id === x.id ? 'selected' : ''}>${esc(x.modelo)} · ${x.kw} kW</option>`).join('')}</optgroup>`).join('')}</select></label>
    ${inp('p.cantInv', 'Cantidad de inversores', p.cantInv || 1)}`);
  h += sec('Protecciones y tierra', `${inp('L.disyuntor', 'Disyuntor del tablero', L.disyuntor, disyDef)}${inp('L.diferencial', 'Diferencial', L.diferencial, difDef)}
    ${inp('L.tierraR', 'Resistencia de tierra', L.tierraR, '18,3', 'Ω')}${inp('p.distrib', 'Distribuidora (bajo el medidor)', p.distrib, 'ENEL, CGE…')}`);
  h += sec('Conductores en CA', `${inp('L.largo_inv-tg', 'Largo Inversor – TGFV', L['largo_inv-tg'], `${fmt(ca.tramos[0].auto, 0)} según el dibujo`, 'm')}${inp('L.largo_tg-emp', 'Largo TG – Empalme', L['largo_tg-emp'], `${fmt(ca.tramos[1].auto, 0)} según el dibujo`, 'm')}
    <dl class="dl"><dt>Caída total</dt><dd>${fmt(ca.totalP, 2)} %</dd></dl>`, false);
  h += sec('Strings', SI.lista.length ? `<div class="uni-str">${SI.lista.map(x => `<div class="uni-str-f"><b>${esc(x.nombre)}</b><span>${x.n} mód.</span>
      <label class="f mini"><span>MPPT</span><select class="in" data-uni="s.${x.st.id}.mppt">${Array.from({ length: inv.mppt }, (_, i) => `<option ${x.st.mppt === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label class="f mini"><span>Largo</span><span class="fi"><input class="in" data-uni="s.${x.st.id}.largo" value="${x.st.largo ?? ''}" placeholder="${fmt(x.largoAuto, 0)}" inputmode="decimal"><em>m</em></span></label>
      <label class="f mini"><span>Sección</span><span class="fi"><input class="in" data-uni="s.${x.st.id}.seccion" value="${x.seccion}" inputmode="decimal"><em>mm²</em></span></label></div>`).join('')}</div>` : '<p class="mut">Sin strings: se arman en el paso Strings.</p>', false);
  h += sec('Qué se muestra', `${chk('u.consumo', 'Circuito de consumo', U.consumo !== false)}${chk('u.tierra', 'Tierra de servicio', U.tierra !== false)}${chk('u.dcSwitch', 'DC switch del inversor', U.dcSwitch !== false)}
    <div class="sub">Agregar</div>
    ${chk('x.bat', 'Batería', U.extras.bat)}${U.extras.bat ? `<div class="row">${inp('x.batModelo', 'Modelo', U.extras.batModelo, 'LUNA2000')}${inp('x.batCap', 'Capacidad', U.extras.batCap, '10 kWh')}</div>` : ''}
    ${chk('x.sg', 'SmartGuard (respaldo)', U.extras.sg)}
    ${chk('x.ev', 'Circuito del cargador EV', U.extras.ev)}${U.extras.ev ? inp('x.evProt', 'Protección del cargador', U.extras.evProt, '2x32 A Curva C') : ''}`);
  h += sec(`Textos cambiados a mano${mods.length ? ` (${mods.length})` : ''}`, mods.length ? `<div class="uni-mods">${mods.map(([k, v]) => `<div class="row uni-mod"><span title="${esc(k)}">${esc(v.trim() ? v : '(oculto)')}</span><button class="btn sm" data-act="uni-reset" data-k="${esc(k)}" title="Volver al texto calculado">↺</button></div>`).join('')}</div>
    <button class="btn sm" data-act="uni-reset-all">Volver todos al texto calculado</button>` : '<p class="mut">Ninguno. Haz clic en un texto del diagrama para escribirlo (los cambiados se ven en azul aquí, no en el PDF). Déjalo vacío para volver al calculado; escribe un espacio para ocultarlo.</p>', mods.length > 0);
  return h;
}

/* ---------- Acciones y cambios ---------- */
export function accionUnilineal(a, b) {
  if (!a.startsWith('uni-')) return false;
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
    const otro = invDeBase(b, p), q = { ...p, inversor: otro ? otro.id : p.inversor, uni: { ...(p.uni || {}), base: b.id, textos: {} } };
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
    uni().base = t.dataset.base; d.close(); listo(); toast('Unilineal base: ' + BASES_UNI.find(b => b.id === t.dataset.base).n);
  });
  d.addEventListener('close', () => d.remove());
}
