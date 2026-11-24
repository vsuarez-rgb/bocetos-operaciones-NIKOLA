/* ==========================================================================
   Dibujo del "espacio modelo": foto + techos + paneles + strings + equipos…
   Se usa en el editor (fondo oscuro, como AutoCAD) y para la lámina
   (modo plot: fondo blanco, colores de impresión).
   ========================================================================== */
import { ZONAS, EQUIPOS, CANAL, COLORES_STRING } from './catalogo.js';
import { zonaPoly, escala, largoM, tamEquipoPx, altoTextoPx, esReal, inclPanelesDe } from './geom.js';
import { hull, centroid, lerp, dist, fmt } from './util.js';

const imgs = new Map();
export function cargarImg(src) {
  return new Promise(res => {
    if (!src) return res(null); if (imgs.has(src)) return res(imgs.get(src));
    const im = new Image(); im.onload = () => { imgs.set(src, im); res(im); }; im.onerror = () => res(null); im.src = src;
  });
}
export const imgDe = src => imgs.get(src);
export const colorString = (p, st) => st.color || COLORES_STRING[p.strings.indexOf(st) % COLORES_STRING.length];

/* Polígono agrandado hacia afuera (para el contorno de cada string). */
function inflar(poly, d) {
  const n = poly.length; if (n < 3) return poly;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
    const n1 = norm([p[1] - a[1], a[0] - p[0]]), n2 = norm([b[1] - p[1], p[0] - b[0]]);
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]), cos = m[0] * n1[0] + m[1] * n1[1] || 1;
    return [p[0] + m[0] * d / cos, p[1] + m[1] * d / cos];
  });
}
const norm = v => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };
function orientCW(poly) { let s = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += (q[0] - p[0]) * (q[1] + p[1]); }); return s > 0 ? poly.slice().reverse() : poly; }

/* Letra del dibujo: fina y angosta, parecida a la de AutoCAD (romans) */
export const FUENTE_CAD = "'Roboto Condensed', 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif";
const fuente = size => `300 ${size}px ${FUENTE_CAD}`;
function texto(g, txt, x, y, { size = 12, color = '#fff', halo = null, align = 'left', base = 'alphabetic', bold = false, italic = false, font = null } = {}) {
  g.font = `${italic ? 'italic ' : ''}${bold ? '600 ' : '300 '}${size}px ${font || FUENTE_CAD}`;
  g.textAlign = align; g.textBaseline = base;
  if (halo) { g.lineWidth = Math.max(1.5, size / 6); g.strokeStyle = halo; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
  g.fillStyle = color; g.fillText(txt, x, y);
}
const path = (g, pts, close) => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); if (close) g.closePath(); };

/**
 * g: contexto 2D ya transformado de forma que 1 unidad = 1 px de pantalla, con origen en la vista.
 * V = {k, ox, oy}: pantalla = foto·k − (ox, oy). u = multiplicador de grosores/textos.
 * o = {plot, capas:Set de visibles, sel:{t,id}, step, R (resultado de calcular), strings info, temp(g,T)}
 */
export function dibujar(g, p, V, o) {
  const k = V.k, T = q => [q[0] * k - V.ox, q[1] * k - V.oy], u = o.u || 1, plot = !!o.plot, R = o.R, vis = id => !o.capas || o.capas.has(id);
  const s = escala(p);
  /* Unidad de las etiquetas: si cambian de tamaño con el zoom (lo normal), su lugar por defecto también es parte del
     dibujo (proporcional a la foto), así salen en el mismo lugar en el editor, el informe y las láminas */
  const uE = et => et && et.escala === false ? u : (p.w || 1000) / 1210 * k;
  // Foto
  const im = imgDe(p.img);
  if (im && vis('foto')) { g.save(); g.globalAlpha = o.fotoAlpha ?? (plot ? .55 : .85); g.drawImage(im, -V.ox, -V.oy, p.w * k, p.h * k); g.restore(); }
  else if (!im && !plot) { g.strokeStyle = '#3a4652'; g.setLineDash([6, 6]); g.strokeRect(-V.ox, -V.oy, p.w * k, p.h * k); g.setLineDash([]); }
  if (plot && im && vis('foto')) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-V.ox, -V.oy, p.w * k, p.h * k); }

  // Techos
  if (vis('techos')) p.roofs.forEach((r, i) => {
    if (!r.poly.length) return;
    const pts = r.poly.map(T), act = esSel(o, 'roof', r.id);
    // Contorno delgado; con p.ocultarContornos no se dibuja (salvo mientras se dibuja el techo o si está elegido)
    const oculto = p.ocultarContornos && r.closed && !act && o.step !== 'techos';
    path(g, pts, r.closed);
    if (r.closed && !plot && !oculto) { g.fillStyle = act ? 'rgba(250,183,4,.10)' : 'rgba(255,255,255,.04)'; g.fill(); }
    if (!oculto) { g.lineWidth = (act ? 1.6 : .8) * u; g.strokeStyle = plot ? '#2b2b2b' : act ? '#FAB704' : '#FFFFFF'; g.stroke(); }
    if (!r.closed && !plot) pts.forEach((q, j) => { g.fillStyle = j ? '#FFFFFF' : '#FAB704'; g.fillRect(q[0] - 3, q[1] - 3, 6, 6); });
    if (r.closed && (o.step === 'techos' || o.step === 'paneles') && !plot) {
      const c = T(centroid(r.poly)); texto(g, `TECHO ${i + 1}`, c[0], c[1], { size: 12 * u, color: act ? '#FAB704' : '#fff', halo: 'rgba(0,0,0,.7)', align: 'center', base: 'middle', bold: true });
    }
    // Inclinación (como "15º" en los planos), junto al vértice de más a la izquierda
    // Inclinación junto al vértice de más a la izquierda: la del techo mientras se dibuja; después, la de los paneles
    // (en manual, cada bloque muestra la suya junto a él)
    const iv = ['techos', 'elementos'].includes(o.step) ? (r.incl || 0) : r.modo === 'manual' ? null : inclPanelesDe(r);
    const vI = r.poly.length ? r.poly.reduce((m, q) => q[0] < m[0] ? q : m, r.poly[0]) : null;
    if (r.closed && iv && (plot || o.rotulos)) { const q = T(vI); etiqueta(g, o, { p, of: 'incl', id: r.id, et: r.etq, txt: r.etqTxt || `${iv}º`, anchorF: vI, attach: () => q, def: [q[0] - 6 * uE(r.etq), q[1] - 4 * uE(r.etq)], izqDef: true, k, V, u, plot, color: plot ? '#111' : '#fff' }); }
    else if (r.closed && iv && ['techos', 'elementos', 'paneles'].includes(o.step)) {
      const q = T(vI);
      texto(g, `${iv}º`, q[0] - 6 * u, q[1] - 4 * u, { size: 13 * u, color: plot ? '#111' : '#fff', halo: plot ? null : 'rgba(0,0,0,.7)', align: 'right' });
    }
  });

  // Zonas
  if (vis('zonas')) p.zonas.forEach(z => {
    const Z = ZONAS[z.k] || ZONAS.obs, pts = zonaPoly(z).map(T), sel = esSel(o, 'zona', z.id);
    g.save(); path(g, pts, true); g.fillStyle = Z.c + (plot ? '22' : '33'); g.fill(); g.clip();
    const bb = pts.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
    g.strokeStyle = Z.c + 'AA'; g.lineWidth = 1 * u; const H = bb[3] - bb[1];
    for (let d = -H; d < bb[2] - bb[0]; d += 7 * u) { g.beginPath(); g.moveTo(bb[0] + d, bb[3]); g.lineTo(bb[0] + d + H, bb[1]); g.stroke(); }
    g.restore(); path(g, pts, true); g.setLineDash([5 * u, 4 * u]); g.lineWidth = (sel ? 2.4 : 1.4) * u; g.strokeStyle = sel ? '#FAB704' : Z.c; g.stroke(); g.setLineDash([]);
    // Nombre del elemento: solo si se pidió en el paso Cotas, etiquetas y textos (z.etq.ver)
    if (z.etq && z.etq.ver && (plot || o.rotulos !== false)) { const cF = [z.x + z.w / 2, z.y + z.h / 2], cP = T(cF);
      if (!(p.nombreDentro && nombreDentro(g, z.etqTxt || Z.n, z, cP, k, Z.c, p, plot))) etiqueta(g, o, { p, of: 'zona', id: z.id, et: z.etq, txt: z.etqTxt || Z.n, anchorF: cF, attach: () => cP, def: [cP[0] + 10 * uE(z.etq), cP[1] - 12 * uE(z.etq)], k, V, u, plot, color: plot ? '#111' : '#fff' }); }
  });

  // Paneles (achurados verdes como en los planos)
  const stringDe = new Map(); (o.SI ? o.SI.lista : []).forEach(x => x.st.panels.forEach(k2 => { if (!stringDe.has(k2)) stringDe.set(k2, x); }));
  if (vis('paneles') && R) {
    if (!plot) R.sombras.forEach(z => { path(g, z.q.map(T), true); g.fillStyle = 'rgba(120,140,160,.18)'; g.fill(); });
    R.panels.forEach(pn => {
      const pts = pn.q.map(T), sel = o.selPanels && o.selPanels.has(pn.key);
      if (pn.off) { if (plot) return; path(g, pts, true); g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]); return; }
      const bad = pn.bad, verde = plot ? '#1d6b33' : '#2FD06B';
      path(g, pts, true); g.fillStyle = bad ? 'rgba(255,70,70,.30)' : plot ? 'rgba(47,160,90,.18)' : 'rgba(47,208,107,.16)'; g.fill();
      // achurado
      g.save(); path(g, pts, true); g.clip(); g.strokeStyle = bad ? 'rgba(255,90,90,.7)' : (plot ? 'rgba(29,107,51,.75)' : 'rgba(47,208,107,.55)'); g.lineWidth = .7 * u;
      const c = centroid(pts), L = Math.max(dist(pts[0], pts[2]), 4);
      const ax = norm([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]), ay = norm([pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]]), dd = norm([ax[0] + ay[0], ax[1] + ay[1]]), pp = [-dd[1], dd[0]];
      const paso = Math.max(4 * u, L / 9);
      for (let t = -L; t <= L; t += paso) { g.beginPath(); g.moveTo(c[0] + pp[0] * t - dd[0] * L, c[1] + pp[1] * t - dd[1] * L); g.lineTo(c[0] + pp[0] * t + dd[0] * L, c[1] + pp[1] * t + dd[1] * L); g.stroke(); }
      g.restore();
      path(g, pts, true); g.lineWidth = (sel ? 2.4 : 1.3) * u; g.strokeStyle = sel ? '#FAB704' : bad ? '#FF5A5A' : verde; g.stroke();
      // etiqueta del string dentro del panel ("1.1")
      const si = stringDe.get(pn.key), lado = Math.min(dist(pts[0], pts[1]), dist(pts[0], pts[3]));
      if (si && vis('strings') && lado > 14 * u) {
        const r = Math.min(lado * .28, 9 * u); g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.fillStyle = plot ? '#fff' : 'rgba(10,20,28,.85)'; g.fill(); g.lineWidth = .9 * u; g.strokeStyle = plot ? '#222' : colorString(p, si.st); g.stroke();
        texto(g, si.etq, c[0], c[1] + .5, { size: r * 1.05, color: plot ? '#111' : '#fff', align: 'center', base: 'middle' });
      }
    });
    if (R.bloques && (plot || o.rotulos || o.step === 'paneles')) R.bloques.forEach(B => {
      const r = p.roofs[B.ri], bl = r && (r.bloques || [])[B.bi]; if (!bl) return; const iv = bl.incl != null ? bl.incl : inclPanelesDe(r); if (!iv) return;
      const q = B.q.map(T), v = q.reduce((m, x) => x[0] + x[1] < m[0] + m[1] ? x : m, q[0]), vf = B.q.reduce((m, x) => x[0] + x[1] < m[0] + m[1] ? x : m, B.q[0]);
      if ((plot || o.rotulos) && bl.id) etiqueta(g, o, { p, of: 'inclb', id: bl.id, et: bl.etq, txt: bl.etqTxt || `${iv}º`, anchorF: vf, attach: () => v, def: [v[0] - 4 * uE(bl.etq), v[1] - 4 * uE(bl.etq)], izqDef: true, k, V, u, plot, color: plot ? '#111' : '#fff' });
      else if (!plot && o.step === 'paneles') texto(g, `${iv}º`, v[0] - 4 * u, v[1] - 4 * u, { size: 12 * u, color: '#fff', halo: 'rgba(0,0,0,.75)', align: 'right' });
    });
    if (!plot && o.step === 'paneles' && o.selBloque) { const B = R.bloques.find(b => b.ri === o.selBloque.ri && b.bi === o.selBloque.bi); if (B) { path(g, B.q.map(T), true); g.setLineDash([6, 4]); g.lineWidth = 1.6; g.strokeStyle = '#FAB704'; g.stroke(); g.setLineDash([]); grips(g, B.q.map(T)); } }
  }

  // Paneles dibujados a mano (sin escala o en perspectiva): misma apariencia que los paneles
  if (vis('paneles')) (p.figPaneles || []).forEach(f => {
    const sel = esSel(o, 'fig', f.id), pts = f.pts.map(T);
    if (f.tipo === 'poly' || f.pts.length !== 4) { panelDibujo(g, pts, { plot, u, sel }); }
    else celdasFigura(f).forEach(c => panelDibujo(g, c.map(T), { plot, u, sel }));
    if (sel) { path(g, pts, true); g.setLineDash([5, 4]); g.lineWidth = 1.4; g.strokeStyle = '#FAB704'; g.stroke(); g.setLineDash([]); grips(g, pts); }
  });

  // Rieles (naranjos): los calculados sobre los paneles
  if (vis('rieles') && R && R.rieles) (R.rieles.perfiles || []).forEach(([a, b]) => lineaDoble(g, [T(a), T(b)], plot ? '#D11' : '#FF3B3B', u));
  if (vis('rieles') && R && R.rieles) R.rieles.lineas.forEach(([a, b]) => { const A = T(a), B = T(b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineWidth = 1.3 * u; g.strokeStyle = plot ? '#E07B00' : '#FF9E3D'; g.stroke(); });

  // Strings: contorno de color alrededor de sus paneles + rótulo "String N"
  if (vis('strings') && R && o.SI) o.SI.lista.forEach((x, i) => {
    const pans = x.st.panels.map(k2 => R.porKey.get(k2)).filter(Boolean); if (!pans.length) return;
    const col = colorString(p, x.st), pad = s ? 180 / s : 6;
    // un contorno por techo, para que no cruce entre techos
    const porTecho = new Map(); pans.forEach(pn => { if (!porTecho.has(pn.rid)) porTecho.set(pn.rid, []); porTecho.get(pn.rid).push(...pn.q); });
    let top = null;
    porTecho.forEach(pts => {
      const h = orientCW(hull(pts)), poly = inflar(h, pad).map(T);
      if (p.encerrarStrings !== false) { path(g, poly, true); g.lineJoin = 'round'; g.lineWidth = 1.6 * u; g.strokeStyle = plot ? (col === '#FFE14D' ? '#C9A800' : col) : col; g.stroke(); }
      const tp = poly.reduce((m, q) => q[1] < m[1] ? q : m, poly[0]); if (!top || tp[1] < top[1]) top = tp;
    });
    if (top && o.rotulos !== false) {
      const tf = [(top[0] + V.ox) / k, (top[1] + V.oy) / k];
      etiqueta(g, o, { p, of: 'string', id: x.st.id, et: x.st.etq, txt: x.st.etqTxt || `String ${i + 1}`, anchorF: tf, attach: () => top, def: [top[0] - 20 * uE(x.st.etq), top[1] - 23 * uE(x.st.etq)], izqDef: true, k, V, u, plot, color: plot ? '#111' : '#fff' });
    }
  });

  // Canalización
  p.rutas.forEach(rt => {
    const C = CANAL[rt.k] || CANAL.ca, pts = rt.pts.map(T), sel = esSel(o, 'ruta', rt.id); if (pts.length < 2) return;
    if (!vis(C.riel ? 'rieles' : 'canal')) return;
    if (sel) { path(g, pts); g.lineWidth = 6; g.strokeStyle = 'rgba(250,183,4,.35)'; g.stroke(); }
    const colR = C.libre ? (rt.color || C.c) : C.c, dashR = C.libre ? (rt.dash ? [10, 6] : []) : C.dash;
    if (C.doble) { lineaDoble(g, pts, plot ? '#D11' : colR, u); if (sel) grips(g, pts); return; }
    path(g, pts); g.setLineDash(dashR.map(d => d * u)); g.lineWidth = 1.8 * u; g.strokeStyle = plot && C.libre && colR === '#FFFFFF' ? '#222' : plot && C.cPlot ? C.cPlot : colR; g.lineJoin = 'round'; g.stroke(); g.setLineDash([]);
    if (sel) grips(g, pts);
    // etiqueta propia (se mueve, cambia de tamaño, se fija o se quita)
    if (o.rotulos !== false) { const m = Math.floor((rt.pts.length - 1) / 2), mid = lerp(rt.pts[m], rt.pts[m + 1], .5), a = T(mid);
      etiqueta(g, o, { p, of: 'ruta', id: rt.id, et: rt.etq, txt: rt.etqTxt || C.corto, anchorF: mid, attach: () => a, def: [a[0] + 8 * uE(rt.etq), a[1] - 10 * uE(rt.etq)], k, V, u, plot, color: plot ? (C.cPlot || C.c) : C.c }); }
  });

  // Equipos (a escala, con rótulo al costado como en los planos)
  if (vis('equipos')) p.equipos.forEach(e => {
    const E = EQUIPOS[e.k] || EQUIPOS.inv, c = T([e.x, e.y]), sel = esSel(o, 'equipo', e.id);
    const tp = tamEquipoPx(p, e), md = tp.md; let w = tp.w * k, h = tp.h * k; w = Math.max(w, 2); h = Math.max(h, 2);   // a su tamaño, igual en el editor que en informes y planos
    g.save(); g.translate(c[0], c[1]); g.rotate((e.ang || 0) * Math.PI / 180);
    // Medidas del equipo (ancho × profundidad en mm), como cotas pegadas al símbolo
    const real = esReal(p, e);
    if (real && (e.verMed === true || (e.verMed !== false && p.verMedidas))) {
      const col = plot ? '#111' : '#FAB704', off = 9 * u, tk = 3 * u, fs = 9.5 * u;
      g.strokeStyle = col; g.lineWidth = .8 * u; g.beginPath();
      g.moveTo(-w / 2, -h / 2 - off); g.lineTo(w / 2, -h / 2 - off); g.moveTo(-w / 2, -h / 2 - off - tk); g.lineTo(-w / 2, -h / 2 - 2 * u); g.moveTo(w / 2, -h / 2 - off - tk); g.lineTo(w / 2, -h / 2 - 2 * u);
      g.moveTo(w / 2 + off, -h / 2); g.lineTo(w / 2 + off, h / 2); g.moveTo(w / 2 + 2 * u, -h / 2); g.lineTo(w / 2 + off + tk, -h / 2); g.moveTo(w / 2 + 2 * u, h / 2); g.lineTo(w / 2 + off + tk, h / 2);
      g.stroke();
      [[-w / 2, -h / 2 - off], [w / 2, -h / 2 - off], [w / 2 + off, -h / 2], [w / 2 + off, h / 2]].forEach(q => { g.beginPath(); g.moveTo(q[0] - 2 * u, q[1] + 2 * u); g.lineTo(q[0] + 2 * u, q[1] - 2 * u); g.stroke(); });
      texto(g, `${fmt(md.w, 0)}`, 0, -h / 2 - off - 2 * u, { size: fs, color: col, halo: plot ? null : 'rgba(0,0,0,.8)', align: 'center', base: 'bottom' });
      g.save(); g.translate(w / 2 + off + 2 * u, 0); g.rotate(Math.PI / 2); texto(g, `${fmt(md.h, 0)}`, 0, 0, { size: fs, color: col, halo: plot ? null : 'rgba(0,0,0,.8)', align: 'center', base: 'bottom' }); g.restore();
    }
    const frente = real;
    if (frente) equipoFrente(g, e, E, md, w, h, plot, u);
    else equipoPlanta(g, e, E, w, h, plot, u);
    if (e.relleno) { const sq = !frente && !['marca', 'libre'].includes(e.k), aw = sq ? Math.min(w, h) : w, ah = sq ? Math.min(w, h) : h;
      let col = e.k === 'libre' ? (e.color || '#FFFFFF') : e.k === 'marca' ? '#FF2B2B' : E.c; if (plot && col === '#FFFFFF') col = '#222'; if (plot && col === '#FFE14D') col = '#C9A800';
      rellenoArea(g, e.relleno, aw, ah, col, u); }
    g.restore();
    // marco de color y rótulo
    if (o.rotulos !== false) {
      // por defecto: inversor, batería y cargadores rotulan a la izquierda; tableros y medidor a la derecha (así no se tapan)
      const ue = uE(e.etq), der = ['tg', 'tfv', 'med', 'cdj'].includes(e.k), sg = der ? 1 : -1, ex = c[0] + sg * (w / 2 + 5 * ue), ey = c[1] - h / 2 - 5 * ue;
      const caja = [c[0] - w / 2 - 5 * ue, c[1] - h / 2 - 5 * ue, c[0] + w / 2 + 5 * ue, c[1] + h / 2 + 5 * ue];
      const abajo = e.k === 'bpc' || e.k === 'marca';
      etiqueta(g, o, { p, of: 'equipo', id: e.id, et: e.etq, txt: e.rotulo || E.n, anchorF: [e.x, e.y], def: abajo ? [c[0] - 30 * ue, c[1] + h / 2 + 22 * ue] : [ex + sg * 4 * ue, ey - 12 * ue], izqDef: abajo ? false : !der, k, V, u, plot, color: plot ? '#111' : '#fff',
        attach: L => [L[0] < c[0] ? caja[0] : caja[2], L[1] < c[1] ? caja[1] : caja[3]] });
    }
    if (sel) grips(g, [[c[0] - w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] + h / 2], [c[0] - w / 2, c[1] + h / 2], c]);
  });

  // Nivel de piso (para medir alturas en la vista de frente)
  if (p.suelo != null) { const y = p.suelo * k - V.oy, x0 = -V.ox, x1 = (p.w || 1000) * k - V.ox;
    g.setLineDash([10 * u, 5 * u]); g.lineWidth = 1.2 * u; g.strokeStyle = plot ? '#555' : 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
    texto(g, 'NIVEL DE PISO ±0,00', x0 + 6 * u, y - 4 * u, { size: 10 * u, color: plot ? '#333' : '#fff', halo: plot ? null : 'rgba(0,0,0,.75)' }); }

  // Cotas
  if (vis('cotas')) {
    const cota = (A, B, txt, col, ref) => {
      const a = T(A), b = T(B), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang) * 6 * u, ny = Math.cos(ang) * 6 * u;
      g.strokeStyle = col; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.moveTo(a[0] - nx, a[1] - ny); g.lineTo(a[0] + nx, a[1] + ny); g.moveTo(b[0] - nx, b[1] - ny); g.lineTo(b[0] + nx, b[1] + ny); g.stroke();
      // tics oblicuos estilo arquitectura
      [a, b].forEach(q => { g.beginPath(); g.moveTo(q[0] - 4 * u, q[1] + 4 * u); g.lineTo(q[0] + 4 * u, q[1] - 4 * u); g.stroke(); });
      const m = lerp(a, b, .5); let rot = ang; if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
      g.save(); g.translate(m[0] - nx * 1.2, m[1] - ny * 1.2); g.rotate(rot); texto(g, txt, 0, -2 * u, { size: (plot ? 9 : 11.5) * u * (p.tamCotas || 1), color: plot ? '#111' : col, halo: plot ? null : 'rgba(0,0,0,.8)', align: 'center', base: 'bottom' }); g.restore();
    };
    if (p.ref && !plot && (o.step === 'escala' || o.verRef)) cota(p.ref.a, p.ref.b, p.ref.mm ? `${fmt(p.ref.mm / 1000, 2)} m · REF` : '? m', '#FAB704', true);
    p.cotas.forEach(ct => { const sel = esSel(o, 'cota', ct.id); cota(ct.a, ct.b, textoCota(p, ct), sel ? '#FAB704' : (plot ? '#111' : '#FFFFFF')); if (sel) grips(g, [T(ct.a), T(ct.b)]); });
  }

  // Textos (alto en mm reales, como TEXT de AutoCAD)
  if (vis('textos')) p.textos.forEach(tx => {
    const q = T(tx.p), size = Math.max(plot ? 4 : 7, altoTextoPx(p, tx) * k), sel = esSel(o, 'texto', tx.id);
    if (tx.guia) {                                         // línea de referencia: del elemento al texto, subrayándolo
      g.font = fuente(size); const wt = g.measureText(tx.s).width, A = T(tx.guia), izq = A[0] > q[0] + wt / 2;
      const xb = izq ? q[0] + wt + 3 * u : q[0] - 3 * u, yb = q[1] + 3 * u;
      g.strokeStyle = plot ? '#222' : (tx.c || '#fff'); g.lineWidth = .9 * u; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(xb, yb); g.lineTo(izq ? q[0] - 3 * u : q[0] + wt + 3 * u, yb); g.stroke();
      g.beginPath(); g.arc(A[0], A[1], 2.2 * u, 0, Math.PI * 2); g.fillStyle = plot ? '#222' : (tx.c || '#fff'); g.fill();
    }
    texto(g, tx.s, q[0], q[1], { size, color: plot ? '#111' : (tx.c || '#fff'), halo: plot ? null : 'rgba(0,0,0,.7)' });
    if (sel) { g.font = fuente(size); const w = g.measureText(tx.s).width; g.strokeStyle = '#FAB704'; g.setLineDash([4, 3]); g.strokeRect(q[0] - 3, q[1] - size, w + 6, size + 5); g.setLineDash([]); grips(g, [q]); }
  });

  // Norte
  if (p.norte && (vis('textos') || plot)) dibujarNorte(g, T([p.norte.x, p.norte.y]), p.norte.ang, 34 * u, plot, o.sel && o.sel.t === 'norte');

  if (o.temp) o.temp(g, T);
}

/* Perfil de estructura: rectángulo angosto por tramo (se lee como un riel; es un solo perfil) */
export function lineaDoble(g, pts, col, u = 1) {
  const sep = 2.2 * u; g.strokeStyle = col; g.lineWidth = 1 * u; g.setLineDash([]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * sep, ny = (b[0] - a[0]) / L * sep;
    g.beginPath(); g.moveTo(a[0] + nx, a[1] + ny); g.lineTo(b[0] + nx, b[1] + ny); g.lineTo(b[0] - nx, b[1] - ny); g.lineTo(a[0] - nx, a[1] - ny); g.closePath(); g.stroke();
  }
}
/* Relleno de un área (centrada en 0,0): 'solido' = pintada con su color más transparente;
   'diag' / 'cruz' / 'horiz' = achurado (sombreado, como el Hatch de AutoCAD) */
export const RELLENOS = { solido: 'Pintar (tarro)', diag: 'Achurado diagonal', cruz: 'Achurado cruzado', horiz: 'Achurado horizontal' };
export function rellenoArea(g, tipo, w, h, col, u = 1) {
  g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip();
  if (tipo === 'solido') { g.globalAlpha = .3; g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); return; }
  g.strokeStyle = col; g.globalAlpha = .75; g.lineWidth = .8 * u;
  const paso = Math.max(4 * u, Math.min(w, h) / 8, 3), L = w + h;
  g.beginPath();
  if (tipo === 'diag' || tipo === 'cruz') for (let t = -L; t <= L; t += paso) { g.moveTo(-w / 2 + t, h / 2); g.lineTo(-w / 2 + t + h, -h / 2); }
  if (tipo === 'cruz') for (let t = -L; t <= L; t += paso) { g.moveTo(-w / 2 + t, -h / 2); g.lineTo(-w / 2 + t + h, h / 2); }
  if (tipo === 'horiz') for (let y = -h / 2 + paso / 2; y < h / 2; y += paso) { g.moveTo(-w / 2, y); g.lineTo(w / 2, y); }
  g.stroke(); g.restore();
}
/* Etiqueta de un equipo o una canalización: texto subrayado con línea guía hasta su dueño.
   et = { dx, dy (posición propia, px de la foto, desde el ancla), tam, fijo, oculta }. Sin dx/dy va en su lugar por defecto.
   En el editor deja su caja en o.hits para poder elegirla y arrastrarla. */
function etiqueta(g, o, { p, of, id, et = {}, txt, anchorF, def, izqDef, attach, k, V, u, plot, color }) {
  et = et || {}; if (et.oculta || !txt) return;
  const gen = (p && p.tamEtq) || 1, Tp = q => [q[0] * k - V.ox, q[1] * k - V.oy];
  const size = et.escala !== false ? Math.max(3, ((p && p.w) || 1000) / 110 * k * (et.tam || 1) * gen) : (plot ? 8 : 11) * u * (et.tam || 1) * gen;
  const L = et.dx != null ? Tp([anchorF[0] + et.dx, anchorF[1] + et.dy]) : def;
  g.font = fuente(size);
  const ue = et.escala !== false ? ((p && p.w) || 1000) / 1210 * k : u;   // márgenes del texto, en la misma unidad que el texto
  const wt = g.measureText(txt).width + 4 * ue, A = attach(L), izq = et.dx != null ? L[0] < A[0] : !!izqDef;
  const x0 = izq ? L[0] - wt : L[0], x1 = izq ? L[0] : L[0] + wt;
  g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(L[0], L[1]); g.lineTo(izq ? x0 : x1, L[1]); g.strokeStyle = plot ? '#222' : '#fff'; g.lineWidth = .8 * u; g.stroke();
  texto(g, txt, izq ? x1 - 2 * ue : x0 + 2 * ue, L[1] - 3 * ue, { size, color, halo: plot ? null : 'rgba(0,0,0,.75)', align: izq ? 'right' : 'left' });
  const caja = [x0 - 2, L[1] - size - 4 * ue, x1 + 2, L[1] + 3];
  if (o.hits) o.hits.push({ t: 'etq', of, id, caja, anchor: anchorF, pos: [(L[0] + V.ox) / k, (L[1] + V.oy) / k] });
  if (!plot && o.sel && o.sel.t === 'etq' && o.sel.of === of && o.sel.id === id) { g.setLineDash([4, 3]); g.strokeStyle = et.fijo ? '#9DB0BD' : '#FAB704'; g.lineWidth = 1; g.strokeRect(caja[0], caja[1], caja[2] - caja[0], caja[3] - caja[1]); g.setLineDash([]); }
}
/* Nombre de un elemento (zona) escrito dentro de su área, en su color, en hasta 3 líneas. Busca el tamaño más
   grande que quepa (desde el de las etiquetas hasta menos de la mitad); si no cabe, devuelve false (va como etiqueta). */
function nombreDentro(g, txt, z, c, k, color, p, plot) {
  const fc = z.forma === 'circ' ? .7 : .9, W = z.w * k * fc, H = z.h * k * fc;
  const base = Math.max(3, (p.w || 1000) / 110 * k * (p.tamEtq || 1) * ((z.etq && z.etq.tam) || 1)), pal = String(txt).split(/\s+/).filter(Boolean);
  for (let size = base; size >= Math.max(3, base * .45); size *= .9) {
    g.font = fuente(size); const lineas = []; let l = '';
    pal.forEach(w => { const t = l ? l + ' ' + w : w; if (l && g.measureText(t).width > W) { lineas.push(l); l = w; } else l = t; }); if (l) lineas.push(l);
    if (lineas.length > 3 || lineas.length * size * 1.15 > H || lineas.some(x => g.measureText(x).width > W)) continue;
    g.save(); g.translate(c[0], c[1]); g.rotate((z.ang || 0) * Math.PI / 180);
    lineas.forEach((x, i) => texto(g, x, 0, (i - (lineas.length - 1) / 2) * size * 1.15, { size, color, halo: plot ? null : 'rgba(0,0,0,.55)', align: 'center', base: 'middle', bold: true }));
    g.restore(); return true;
  }
  return false;
}
/* Un panel (o una figura) con el relleno y achurado verde de los paneles */
export function panelDibujo(g, pts, { plot, u = 1, sel } = {}) {
  if (pts.length < 3) return;
  path(g, pts, true); g.fillStyle = plot ? 'rgba(47,160,90,.18)' : 'rgba(47,208,107,.16)'; g.fill();
  g.save(); path(g, pts, true); g.clip(); g.strokeStyle = plot ? 'rgba(29,107,51,.75)' : 'rgba(47,208,107,.55)'; g.lineWidth = .7 * u;
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const L = Math.max(x1 - x0, y1 - y0), paso = Math.max(4 * u, Math.min(L / 9, 14 * u));
  for (let t = -L; t <= L * 2; t += paso) { g.beginPath(); g.moveTo(x0 + t, y1); g.lineTo(x0 + t + (y1 - y0), y0); g.stroke(); }
  g.restore();
  path(g, pts, true); g.lineWidth = 1.3 * u; g.strokeStyle = sel ? '#FAB704' : plot ? '#1d6b33' : '#2FD06B'; g.stroke();
}
/* Celdas de una figura de 4 esquinas (filas × columnas), repartidas en perspectiva */
export function celdasFigura(f) {
  const [A, B, C, D] = f.pts, nf = Math.max(1, f.f || 1), nc = Math.max(1, f.c || 1), sep = f.sep ?? .04;
  const P = (s, t) => { const top = lerp(A, B, s), bot = lerp(D, C, s); return lerp(top, bot, t); };
  const out = [];
  for (let i = 0; i < nf; i++) for (let j = 0; j < nc; j++) {
    const s0 = (j + sep / 2) / nc, s1 = (j + 1 - sep / 2) / nc, t0 = (i + sep / 2) / nf, t1 = (i + 1 - sep / 2) / nf;
    out.push([P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)]);
  }
  return out;
}
/* Texto de una cota: el escrito a mano (sirve en hojas sin escala) o el largo medido */
export function textoCota(p, ct) {
  if (ct.txt) return /^[\d.,]+$/.test(ct.txt.trim()) ? `${ct.txt.trim()} m` : ct.txt;
  const s = escala(p); return s ? `${fmt(dist(ct.a, ct.b) * s / 1000, 2)} m` : '?';
}
/* ¿Está elegido? (uno solo, o dentro de una selección múltiple) */
const esSel = (o, t, id) => !!o.sel && ((o.sel.t === t && o.sel.id === id) || (o.sel.t === 'multi' && o.sel.items.some(x => x.t === t && x.id === id)));
export function grips(g, pts) { pts.forEach(q => { g.fillStyle = '#3D7BFF'; g.fillRect(q[0] - 4, q[1] - 4, 8, 8); g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(q[0] - 4, q[1] - 4, 8, 8); }); }

export function dibujarNorte(g, c, angDeg, L, plot, sel) {
  const a = angDeg * Math.PI / 180, r = L * .32;
  g.save(); g.translate(c[0], c[1]); g.rotate(a);
  const col = plot ? '#C0272D' : '#FF4D4D';
  g.strokeStyle = sel ? '#FAB704' : (plot ? '#222' : '#fff'); g.lineWidth = 1.1;
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4 - Math.PI / 2, R = i % 2 ? r * .9 : r * 1.5, t1 = t - Math.PI / 8, t2 = t + Math.PI / 8;
    g.beginPath(); g.moveTo(Math.cos(t) * R, Math.sin(t) * R); g.lineTo(Math.cos(t1) * r * .25, Math.sin(t1) * r * .25); g.lineTo(0, 0); g.closePath(); g.fillStyle = col; g.fill();
    g.beginPath(); g.moveTo(Math.cos(t) * R, Math.sin(t) * R); g.lineTo(Math.cos(t2) * r * .25, Math.sin(t2) * r * .25); g.lineTo(0, 0); g.closePath(); g.fillStyle = plot ? '#fff' : '#2a1010'; g.fill(); g.strokeStyle = col; g.lineWidth = .8; g.stroke();
  }
  g.strokeStyle = sel ? '#FAB704' : (plot ? '#222' : '#fff'); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -r * 1.5); g.lineTo(0, -L); g.stroke();
  g.restore();
  const tl = [c[0] + Math.sin(a) * (L + 9), c[1] - Math.cos(a) * (L + 9)];
  texto(g, 'N', tl[0], tl[1], { size: L * .38, color: plot ? '#111' : '#fff', halo: plot ? null : 'rgba(0,0,0,.7)', align: 'center', base: 'middle', bold: true });
  return { c, tip: [c[0] + Math.sin(a) * L, c[1] - Math.cos(a) * L], r, L };
}

/* ---------- Equipos dibujados (en el sistema del equipo: centro en 0,0, ya girado) ---------- */
const SIN_MARCO = new Set(['bpc', 'marca', 'cp']);
const rrect = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
/* Logo tipo Huawei: pétalos en abanico (contorno, como en los bloques de AutoCAD) */
function logoHuawei(g, cx, cy, r, col, lw) {
  g.save(); g.strokeStyle = col; g.lineWidth = lw;
  for (let i = 0; i < 8; i++) {
    const a = (-168 + i * 22.3) * Math.PI / 180;
    g.save(); g.translate(cx, cy + r * .45); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, -r * .5, r * .13, r * .5, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  g.restore();
}
/* Pastilla del frente (donde va el logo y las luces) */
function pastilla(g, w, h, y, col, lw, u) {
  const pw = Math.min(w * .42, h * 2.6), ph = Math.max(pw * .3, 3 * u);
  rrect(g, -pw / 2, y - ph / 2, pw, ph, ph / 2); g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  logoHuawei(g, 0, y - ph * .12, ph * .42, col, lw * .7);
}
function equipoLibre(g, e, w, h, plot, u, relleno) {
  let col = e.color || '#FFFFFF'; if (plot && col === '#FFFFFF') col = '#222';
  g.fillStyle = relleno; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = col; g.lineWidth = 1.3 * u; g.strokeRect(-w / 2, -h / 2, w, h);
  if (e.txt) textoMultilinea(g, e.txt, w * .9, h * .9, col, u);
}
function textoMultilinea(g, txt, w, h, col, u) {
  const lineas = String(txt).split(/\||\n/), size = Math.max(5, Math.min(h / (lineas.length + 1.5), w / (Math.max(...lineas.map(l => l.length)) * .55), 13 * u));
  lineas.forEach((l, i) => texto(g, l, 0, (i - (lineas.length - 1) / 2) * size * 1.2, { size, color: col, align: 'center', base: 'middle', italic: true }));
}
export function equipoFrente(g, e, E, md, w, h, plot, u) {
  const col = plot ? (E.c === '#FFE14D' ? '#C9A800' : E.c === '#FF3DFF' ? '#C000C0' : E.c === '#00E5FF' ? '#0097A7' : E.c === '#FFFFFF' ? '#222' : E.c) : E.c;
  const lw = 1.3 * u, relleno = plot ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.08)';
  g.strokeStyle = col; g.lineWidth = lw;
  const caja = (r = 0) => { rrect(g, -w / 2, -h / 2, w, h, r); g.fillStyle = relleno; g.fill(); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
  switch (e.k) {
    case 'inv': caja(Math.min(w, h) * .12); pastilla(g, w, h, -h * .12, col, lw, u);
      g.strokeRect(-w * .09, h / 2, w * .18, Math.max(2, h * .035)); break;                      // conectores abajo
    case 'sg': caja(Math.min(w, h) * .14); logoHuawei(g, 0, -h * .1, Math.min(w, h) * .07, col, lw * .7); break;
    case 'bat': {
      const mods = md.mods || 3;
      const top = -h / 2, hTop = h * 240 / (240 + mods * 360), hMod = (h - hTop) / mods;
      g.fillStyle = relleno; g.fillRect(-w / 2, top, w, h); g.strokeRect(-w / 2, top, w, h);
      g.beginPath(); for (let i = 0; i < mods; i++) { const y = top + hTop + i * hMod; g.moveTo(-w / 2, y); g.lineTo(w / 2, y); } g.stroke();
      // rieles laterales (bracket) y patas
      g.beginPath(); [-1, 1].forEach(sg => { const x = sg * (w / 2 - w * .03); g.moveTo(x, top); g.lineTo(x, top + h); }); g.stroke();
      g.beginPath(); g.moveTo(-w * .45, top + h); g.lineTo(-w * .42, top + h + h * .02); g.lineTo(w * .42, top + h + h * .02); g.lineTo(w * .45, top + h); g.stroke();
      pastilla(g, w, hTop, top + hTop * .5, col, lw, u); break; }
    case 'dcdc': caja(); pastilla(g, w, h, 0, col, lw, u); break;
    case 'tg': case 'tfv': caja(); textoMultilinea(g, E.frente || E.n, w * .9, h * .9, col, u); break;
    case 'med': caja(); g.strokeRect(-w * .3, -h * .32, w * .6, h * .22); g.beginPath(); g.arc(0, h * .15, Math.min(w, h) * .14, 0, Math.PI * 2); g.stroke(); break;
    case 'ev': caja(Math.min(w, h) * .25); g.beginPath(); g.arc(0, -h * .15, w * .28, 0, Math.PI * 2); g.stroke(); texto(g, 'EV', 0, -h * .15, { size: Math.min(w * .25, 11 * u), color: col, align: 'center', base: 'middle', bold: true }); break;
    case 'bc': caja(); g.beginPath(); g.arc(w * .15, 0, h * .35, 0, Math.PI * 2); g.stroke(); g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(w * .15, 0); g.lineTo(w * .15 + Math.cos(a) * h * .3, Math.sin(a) * h * .3); } g.stroke(); break;
    case 'libre': equipoLibre(g, e, w, h, plot, u, relleno); break;
    case 'marca': g.lineWidth = 2.6 * u; g.strokeStyle = plot ? '#E00000' : '#FF2B2B'; g.strokeRect(-w / 2, -h / 2, w, h); break;
    case 'bpc': g.fillStyle = relleno; g.fillRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2, -h / 2, w, h); break;
    case 'cp': g.fillStyle = plot ? 'rgba(0,183,212,.22)' : 'rgba(0,229,255,.32)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2, -h / 2, w, h); break;   // caja de paso: área celeste
    case 'cdj': g.fillStyle = plot ? 'rgba(192,0,192,.18)' : 'rgba(255,61,255,.28)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeRect(-w / 2, -h / 2, w, h); break;
    default: caja(); if (E.l) texto(g, E.l, 0, 0, { size: Math.min(h * .4, 11 * u), color: col, align: 'center', base: 'middle', bold: true });
  }
}
/* Símbolo de un equipo de referencia en planta: un cuadrado de lado a con su dibujo, sin rectángulo alrededor */
function simboloPlanta(g, e, E, a, col, plot, u) {
  const x = -a / 2, y = -a / 2, lw = 1.3 * u;
  g.fillStyle = plot ? 'rgba(255,255,255,.85)' : 'rgba(10,20,28,.55)'; g.fillRect(x, y, a, a);
  g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(x, y, a, a);
  if (e.k === 'inv') {
    g.beginPath(); g.moveTo(x, y + a); g.lineTo(x + a, y); g.stroke();
    g.beginPath(); g.moveTo(x + a * .12, y + a * .3); g.quadraticCurveTo(x + a * .22, y + a * .08, x + a * .32, y + a * .3); g.quadraticCurveTo(x + a * .42, y + a * .52, x + a * .52, y + a * .3); g.stroke();
    g.beginPath(); g.moveTo(x + a * .55, y + a * .72); g.lineTo(x + a * .88, y + a * .72); g.moveTo(x + a * .55, y + a * .84); g.lineTo(x + a * .88, y + a * .84); g.stroke();
  } else if (e.k === 'bat' || e.k === 'dcdc') {
    const bw = a * .62, bh = a * .34; g.strokeRect(-bw / 2, -bh / 2, bw, bh); g.fillStyle = col; g.fillRect(bw / 2, -bh * .2, bw * .07, bh * .4);
    g.beginPath(); for (let i = 1; i < 4; i++) { const xx = -bw / 2 + bw * i / 4; g.moveTo(xx, -bh * .3); g.lineTo(xx, bh * .3); } g.stroke();
    if (e.k === 'dcdc') texto(g, 'DC/DC', 0, a * .33, { size: a * .14, color: col, align: 'center', base: 'middle', bold: true });
  } else if (e.k === 'sg') logoHuawei(g, 0, -a * .06, a * .3, col, lw * .8);
  else if (e.k === 'ev') { g.beginPath(); g.arc(0, 0, a * .3, 0, Math.PI * 2); g.stroke(); texto(g, 'EV', 0, 0, { size: a * .26, color: col, align: 'center', base: 'middle', bold: true }); }
  else if (e.k === 'med') { g.beginPath(); g.arc(0, 0, a * .3, 0, Math.PI * 2); g.stroke(); texto(g, 'M', 0, 0, { size: a * .32, color: col, align: 'center', base: 'middle', bold: true }); }
  else texto(g, E.l || '', 0, .5, { size: a * (String(E.l || '').length > 2 ? .26 : .34), color: col, align: 'center', base: 'middle', bold: true });
}
export function equipoPlanta(g, e, E, w, h, plot, u) {
  const col = plot && E.c === '#FFFFFF' ? '#222' : plot && E.c === '#FFE14D' ? '#C9A800' : E.c;
  if (e.k === 'marca') { g.lineWidth = 2.6 * u; g.strokeStyle = plot ? '#E00000' : '#FF2B2B'; g.strokeRect(-w / 2, -h / 2, w, h); return; }
  if (e.k === 'libre') { equipoLibre(g, e, w, h, plot, u, plot ? '#fff' : 'rgba(10,20,28,.6)'); return; }
  return simboloPlanta(g, e, E, Math.min(w, h), col, plot, u);   // de referencia: solo el símbolo
  g.fillStyle = plot ? '#fff' : 'rgba(10,20,28,.8)'; g.fillRect(-w / 2, -h / 2, w, h);
  g.lineWidth = 1.4 * u; g.strokeStyle = col; g.strokeRect(-w / 2, -h / 2, w, h);
  if (e.k === 'inv') {                                             // símbolo del inversor (~ / =) en un cuadrado al centro, sin estirarlo
    const a = Math.min(w, h) * .82, x = -a / 2, y = -a / 2; g.lineWidth = 1 * u; g.strokeRect(x, y, a, a); g.beginPath(); g.moveTo(x, y + a); g.lineTo(x + a, y); g.stroke();
    g.beginPath(); g.moveTo(x + a * .12, y + a * .3); g.quadraticCurveTo(x + a * .22, y + a * .08, x + a * .32, y + a * .3); g.quadraticCurveTo(x + a * .42, y + a * .52, x + a * .52, y + a * .3); g.stroke();
    g.beginPath(); g.moveTo(x + a * .55, y + a * .72); g.lineTo(x + a * .88, y + a * .72); g.moveTo(x + a * .55, y + a * .84); g.lineTo(x + a * .88, y + a * .84); g.stroke(); }
  else if (e.k === 'bat' || e.k === 'dcdc') {                                       // símbolo de batería: celdas + borne
    const bw = w * .5, bh = Math.min(h * .55, bw * .5); g.lineWidth = 1 * u; g.strokeRect(-bw / 2, -bh / 2, bw, bh); g.fillStyle = col; g.fillRect(bw / 2, -bh * .2, bw * .07, bh * .4);
    g.beginPath(); for (let i = 1; i < 4; i++) { const x = -bw / 2 + bw * i / 4; g.moveTo(x, -bh * .3); g.lineTo(x, bh * .3); } g.stroke();
    if (e.k === 'dcdc') texto(g, 'DC', -w * .38, 0, { size: Math.min(h * .4, 9 * u), color: col, align: 'center', base: 'middle', bold: true });
  }
  else if (e.k === 'sg') { logoHuawei(g, 0, -h * .08, Math.min(w, h) * .28, col, .8 * u); }
  else if (E.l) texto(g, E.l, 0, .5, { size: Math.min(h * .55, 11 * u), color: plot ? '#111' : col, align: 'center', base: 'middle', bold: true });
}
