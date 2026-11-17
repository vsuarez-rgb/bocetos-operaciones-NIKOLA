/* ==========================================================================
   Dibujo del "espacio modelo": foto + techos + paneles + strings + equipos…
   Se usa en el editor (fondo oscuro, como AutoCAD) y para la lámina
   (modo plot: fondo blanco, colores de impresión).
   ========================================================================== */
import { ZONAS, EQUIPOS, CANAL, COLORES_STRING } from './catalogo.js';
import { zonaPoly, escala, largoM, medidaEquipo } from './geom.js';
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

function texto(g, txt, x, y, { size = 12, color = '#fff', halo = null, align = 'left', base = 'alphabetic', bold = false, italic = false, font = null } = {}) {
  g.font = `${italic ? 'italic ' : ''}${bold ? '600 ' : '400 '}${size}px ${font || "'Archivo Narrow', 'Arial Narrow', Arial, sans-serif"}`;
  g.textAlign = align; g.textBaseline = base;
  if (halo) { g.lineWidth = Math.max(2, size / 4); g.strokeStyle = halo; g.lineJoin = 'round'; g.strokeText(txt, x, y); }
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
  // Foto
  const im = imgDe(p.img);
  if (im && vis('foto')) { g.save(); g.globalAlpha = o.fotoAlpha ?? (plot ? .55 : .85); g.drawImage(im, -V.ox, -V.oy, p.w * k, p.h * k); g.restore(); }
  else if (!im && !plot) { g.strokeStyle = '#3a4652'; g.setLineDash([6, 6]); g.strokeRect(-V.ox, -V.oy, p.w * k, p.h * k); g.setLineDash([]); }
  if (plot && im && vis('foto')) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-V.ox, -V.oy, p.w * k, p.h * k); }

  // Techos
  if (vis('techos')) p.roofs.forEach((r, i) => {
    if (!r.poly.length) return;
    const pts = r.poly.map(T), act = o.sel && o.sel.t === 'roof' && o.sel.id === r.id;
    path(g, pts, r.closed);
    if (r.closed && !plot) { g.fillStyle = act ? 'rgba(250,183,4,.10)' : 'rgba(255,255,255,.04)'; g.fill(); }
    g.lineWidth = (act ? 2.2 : 1.4) * u; g.strokeStyle = plot ? '#2b2b2b' : act ? '#FAB704' : '#FFFFFF'; g.stroke();
    if (!r.closed && !plot) pts.forEach((q, j) => { g.fillStyle = j ? '#FFFFFF' : '#FAB704'; g.fillRect(q[0] - 3, q[1] - 3, 6, 6); });
    if (r.closed && (o.step === 'techos' || o.step === 'paneles') && !plot) {
      const c = T(centroid(r.poly)); texto(g, `TECHO ${i + 1}`, c[0], c[1], { size: 12 * u, color: act ? '#FAB704' : '#fff', halo: 'rgba(0,0,0,.7)', align: 'center', base: 'middle', bold: true });
    }
    // Inclinación (como "15º" en los planos), junto al vértice de más a la izquierda
    if (r.closed && r.incl && (plot || o.step !== 'escala')) {
      const v = r.poly.reduce((m, q) => q[0] < m[0] ? q : m, r.poly[0]), q = T(v);
      texto(g, `${r.incl}º`, q[0] - 6 * u, q[1] - 4 * u, { size: 13 * u, color: plot ? '#111' : '#fff', halo: plot ? null : 'rgba(0,0,0,.7)', align: 'right' });
    }
  });

  // Zonas
  if (vis('zonas')) p.zonas.forEach(z => {
    const Z = ZONAS[z.k] || ZONAS.obs, pts = zonaPoly(z).map(T), sel = o.sel && o.sel.t === 'zona' && o.sel.id === z.id;
    g.save(); path(g, pts, true); g.fillStyle = Z.c + (plot ? '22' : '33'); g.fill(); g.clip();
    const bb = pts.reduce((b, q) => [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
    g.strokeStyle = Z.c + 'AA'; g.lineWidth = 1 * u; const H = bb[3] - bb[1];
    for (let d = -H; d < bb[2] - bb[0]; d += 7 * u) { g.beginPath(); g.moveTo(bb[0] + d, bb[3]); g.lineTo(bb[0] + d + H, bb[1]); g.stroke(); }
    g.restore(); path(g, pts, true); g.setLineDash([5 * u, 4 * u]); g.lineWidth = (sel ? 2.4 : 1.4) * u; g.strokeStyle = sel ? '#FAB704' : Z.c; g.stroke(); g.setLineDash([]);
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
    if (!plot && o.step === 'paneles' && o.selBloque) { const B = R.bloques.find(b => b.ri === o.selBloque.ri && b.bi === o.selBloque.bi); if (B) { path(g, B.q.map(T), true); g.setLineDash([6, 4]); g.lineWidth = 1.6; g.strokeStyle = '#FAB704'; g.stroke(); g.setLineDash([]); grips(g, B.q.map(T)); } }
  }

  // Strings: contorno de color alrededor de sus paneles + rótulo "String N"
  if (vis('strings') && R && o.SI) o.SI.lista.forEach((x, i) => {
    const pans = x.st.panels.map(k2 => R.porKey.get(k2)).filter(Boolean); if (!pans.length) return;
    const col = colorString(p, x.st), pad = s ? 180 / s : 6;
    // un contorno por techo, para que no cruce entre techos
    const porTecho = new Map(); pans.forEach(pn => { if (!porTecho.has(pn.rid)) porTecho.set(pn.rid, []); porTecho.get(pn.rid).push(...pn.q); });
    let top = null;
    porTecho.forEach(pts => {
      const h = orientCW(hull(pts)), poly = inflar(h, pad).map(T);
      path(g, poly, true); g.lineJoin = 'round'; g.lineWidth = 1.6 * u; g.strokeStyle = plot ? (col === '#FFE14D' ? '#C9A800' : col) : col; g.stroke();
      const tp = poly.reduce((m, q) => q[1] < m[1] ? q : m, poly[0]); if (!top || tp[1] < top[1]) top = tp;
    });
    if (top) {
      const lx = top[0] - 22 * u, ly = top[1] - 26 * u; g.strokeStyle = plot ? '#222' : '#fff'; g.lineWidth = .8 * u;
      g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(lx + 2, ly + 3); g.lineTo(lx - 54 * u, ly + 3); g.stroke();
      texto(g, `String ${i + 1}`, lx - 52 * u, ly, { size: 13 * u, color: plot ? '#111' : '#fff', halo: plot ? null : 'rgba(0,0,0,.75)' });
    }
  });

  // Canalización
  if (vis('canal')) p.rutas.forEach(rt => {
    const C = CANAL[rt.k] || CANAL.ca, pts = rt.pts.map(T), sel = o.sel && o.sel.t === 'ruta' && o.sel.id === rt.id; if (pts.length < 2) return;
    if (sel) { path(g, pts); g.lineWidth = 6; g.strokeStyle = 'rgba(250,183,4,.35)'; g.stroke(); }
    path(g, pts); g.setLineDash(C.dash.map(d => d * u)); g.lineWidth = 1.8 * u; g.strokeStyle = C.c; g.lineJoin = 'round'; g.stroke(); g.setLineDash([]);
    if (s && !plot) { const m = Math.floor((pts.length - 1) / 2), q = lerp(pts[m], pts[m + 1], .5); texto(g, `${fmt(largoM(p, rt.pts), 1)} m`, q[0] + 5, q[1] - 5, { size: 11, color: C.c, halo: 'rgba(0,0,0,.8)' }); }
    if (sel) grips(g, pts);
  });

  // Equipos (a escala, con rótulo al costado como en los planos)
  if (vis('equipos')) p.equipos.forEach(e => {
    const E = EQUIPOS[e.k] || EQUIPOS.inv, c = T([e.x, e.y]), sel = o.sel && o.sel.t === 'equipo' && o.sel.id === e.id;
    const md = medidaEquipo(p, e); let w = s ? md.w / s * k : 14, h = s ? md.h / s * k : 14; w = Math.max(w, 12 * u); h = Math.max(h, 12 * u);
    g.save(); g.translate(c[0], c[1]); g.rotate((e.ang || 0) * Math.PI / 180);
    g.fillStyle = plot ? '#fff' : 'rgba(10,20,28,.8)'; g.fillRect(-w / 2, -h / 2, w, h);
    g.lineWidth = 1.4 * u; g.strokeStyle = plot && E.c === '#FFFFFF' ? '#222' : E.c; g.strokeRect(-w / 2, -h / 2, w, h);
    if (e.k === 'inv') { g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, -h / 2); g.stroke(); g.beginPath(); g.moveTo(-w * .38, -h * .2); g.quadraticCurveTo(-w * .28, -h * .42, -w * .18, -h * .2); g.quadraticCurveTo(-w * .08, 0, w * .02, -h * .2); g.stroke(); g.beginPath(); g.moveTo(w * .05, h * .3); g.lineTo(w * .38, h * .3); g.stroke(); }
    else if (E.l) texto(g, E.l, 0, .5, { size: Math.min(h * .55, 11 * u), color: plot ? '#111' : E.c, align: 'center', base: 'middle', bold: true });
    g.restore();
    // marco de color y rótulo
    g.lineWidth = 1 * u; g.strokeStyle = plot ? '#00B7D4' : 'rgba(0,229,255,.7)'; g.strokeRect(c[0] - w / 2 - 5 * u, c[1] - h / 2 - 5 * u, w + 10 * u, h + 10 * u);
    if (o.rotulos !== false) {
      // inversor, batería y cargadores rotulan a la izquierda; tableros y medidor a la derecha (así no se tapan)
      const der = ['tg', 'tfv', 'med', 'cdj'].includes(e.k), sg = der ? 1 : -1, ex = c[0] + sg * (w / 2 + 5 * u), ey = c[1] - h / 2 - 5 * u;
      const tx = ex + sg * 4 * u, ty = ey - 12 * u; g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx, ty); g.lineTo(tx + sg * 40 * u, ty); g.strokeStyle = plot ? '#222' : '#fff'; g.lineWidth = .8 * u; g.stroke();
      texto(g, e.rotulo || E.n, tx + sg * 2 * u, ty - 3 * u, { size: 12 * u, color: plot ? '#111' : '#fff', halo: plot ? null : 'rgba(0,0,0,.75)', align: der ? 'left' : 'right' });
    }
    if (sel) grips(g, [[c[0] - w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] + h / 2], [c[0] - w / 2, c[1] + h / 2], c]);
  });

  // Cotas
  if (vis('cotas')) {
    const cota = (A, B, txt, col, ref) => {
      const a = T(A), b = T(B), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang) * 6 * u, ny = Math.cos(ang) * 6 * u;
      g.strokeStyle = col; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.moveTo(a[0] - nx, a[1] - ny); g.lineTo(a[0] + nx, a[1] + ny); g.moveTo(b[0] - nx, b[1] - ny); g.lineTo(b[0] + nx, b[1] + ny); g.stroke();
      // tics oblicuos estilo arquitectura
      [a, b].forEach(q => { g.beginPath(); g.moveTo(q[0] - 4 * u, q[1] + 4 * u); g.lineTo(q[0] + 4 * u, q[1] - 4 * u); g.stroke(); });
      const m = lerp(a, b, .5); let rot = ang; if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
      g.save(); g.translate(m[0] - nx * 1.2, m[1] - ny * 1.2); g.rotate(rot); texto(g, txt, 0, -2 * u, { size: 11.5 * u, color: plot ? '#111' : col, halo: plot ? null : 'rgba(0,0,0,.8)', align: 'center', base: 'bottom' }); g.restore();
    };
    if (p.ref && !plot && (o.step === 'escala' || o.verRef)) cota(p.ref.a, p.ref.b, p.ref.mm ? `${fmt(p.ref.mm / 1000, 2)} m · REF` : '? m', '#FAB704', true);
    p.cotas.forEach(ct => { const sel = o.sel && o.sel.t === 'cota' && o.sel.id === ct.id; cota(ct.a, ct.b, s ? `${fmt(dist(ct.a, ct.b) * s / 1000, 2)} m` : '?', sel ? '#FAB704' : (plot ? '#111' : '#FAB704')); if (sel) grips(g, [T(ct.a), T(ct.b)]); });
  }

  // Textos (alto en mm reales, como TEXT de AutoCAD)
  if (vis('textos')) p.textos.forEach(tx => {
    const q = T(tx.p), size = s ? Math.max(9, (tx.h || 400) / s * k) : 14, sel = o.sel && o.sel.t === 'texto' && o.sel.id === tx.id;
    texto(g, tx.s, q[0], q[1], { size, color: plot ? '#111' : (tx.c || '#fff'), halo: plot ? null : 'rgba(0,0,0,.7)' });
    if (sel) { g.font = `400 ${size}px 'Archivo Narrow', Arial`; const w = g.measureText(tx.s).width; g.strokeStyle = '#FAB704'; g.setLineDash([4, 3]); g.strokeRect(q[0] - 3, q[1] - size, w + 6, size + 5); g.setLineDash([]); grips(g, [q]); }
  });

  // Norte
  if (p.norte && (vis('textos') || plot)) dibujarNorte(g, T([p.norte.x, p.norte.y]), p.norte.ang, 34 * u, plot, o.sel && o.sel.t === 'norte');

  if (o.temp) o.temp(g, T);
}

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
