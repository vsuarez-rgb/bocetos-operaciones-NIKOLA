/* ==========================================================================
   Cálculos: escala, paneles por techo (automático y por bloques), strings,
   largos de canalización y caídas de tensión.
   Todas las coordenadas del proyecto están en px de la foto; la escala
   (mm por px) sale de la línea de referencia del paso 1.
   ========================================================================== */
import { PANELES, INVERSORES, ZONAS, GAP_FILA, GAP_COL, SOL_MIN, T_MIN, CANAL, EQUIPOS, OTROS_EMAT } from './catalogo.js';
import { dist, rotP, centroid, polyArea, pointInPoly, convexOverlap, distSeg, lerp, polyLen } from './util.js';

export const escala = p => p.ref && p.ref.mm ? p.ref.mm / dist(p.ref.a, p.ref.b) : null;          // mm por px
export function droneGSD(p) { const d = p.drone; if (!d || !d.alt || !d.f35) return null; const H = (d.alt - (d.roofH || 0)) * 1000; if (H <= 0) return null; return H * 36 / (d.f35 * (d.fullW || p.w)); }
export const panelDe = (p, r) => PANELES.find(x => x.id === ((r && r.panel) || p.panel)) || PANELES[0];
export const inversorDe = p => INVERSORES.find(x => x.id === p.inversor) || INVERSORES[0];
export const bajaDe = r => r.baja || 'abajo';

/* Medida en planta (mm) de un equipo dibujado: la del modelo elegido o la del símbolo.
   El inversor usa el modelo del proyecto. En planta se ve ancho × prof (lo que sobresale del muro). */
/* Escala para dibujar los equipos: la real o, si la hoja no tiene referencia, una aproximada
   (la foto mide unos 6 m de ancho) para que los símbolos se vean de un tamaño razonable. */
export const escalaSimbolos = p => escala(p) || (p.w ? 6000 / p.w : 10);
export function medidaEquipo(p, e) {
  if (e.k === 'inv') { const I = inversorDe(p); return { w: I.ancho || EQUIPOS.inv.w, h: I.prof || EQUIPOS.inv.h, modelo: I.modelo }; }
  const M = e.modelo && OTROS_EMAT.find(x => (x.sku || x.item) === e.modelo);
  if (M && M.ancho) return { w: M.ancho, h: M.prof || M.alto, modelo: M.modelo };
  const Q = EQUIPOS[e.k] || EQUIPOS.inv; return { w: Q.w, h: Q.h, modelo: null };
}
/* Protección normalizada inmediatamente superior a una corriente. */
const STD = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
export const protStd = i => STD.find(x => x >= i - 1e-6) || Math.ceil(i);

/* Zona como polígono (rectángulo o elipse de 32 lados, girada en su centro). */
export function zonaPoly(e) {
  const c = [e.x + e.w / 2, e.y + e.h / 2], a = (e.ang || 0) * Math.PI / 180;
  const p = e.forma === 'circ'
    ? Array.from({ length: 32 }, (_, i) => { const t = i * Math.PI / 16; return [c[0] + Math.cos(t) * e.w / 2, c[1] + Math.sin(t) * e.h / 2]; })
    : [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]];
  return a ? p.map(q => rotP(q, c, a)) : p;
}

/* Medidas de un techo en su sistema girado (donde los paneles quedan derechos). La foto cenital
   "aplasta" el techo inclinado: en el sentido de la pendiente un panel se ve × cos(incl). */
export function geomTecho(p, r, s) {
  const P = panelDe(p, r), a = (r.ang || 0) * Math.PI / 180, c = centroid(r.poly), cs = Math.cos((r.incl || 0) * Math.PI / 180);
  const vert = ['abajo', 'arriba'].includes(bajaDe(r));
  const fx = vert ? s : s / cs, fy = vert ? s / cs : s;
  const o = r.orient || 'v', wmm = o === 'v' ? P.w : P.h, hmm = o === 'v' ? P.h : P.w;
  return { P, a, c, s, fx, fy, o, wmm, hmm, baja: bajaDe(r), pw: wmm / fx, ph: hmm / fy, gx: GAP_COL / fx };
}
/* Sombra entre filas inclinadas: d = b·sen(γ+β)/sen γ − b·cos β (redondeado al cm). */
export function sombraMm(b, beta, gamma) { const B = beta * Math.PI / 180, G = gamma * Math.PI / 180; return Math.ceil((b * Math.sin(G + B) / Math.sin(G) - b * Math.cos(B)) / 10) * 10; }
export function geomBloque(p, G, b) {
  const o = b.orient || G.o, otra = o !== G.o, wB = otra ? G.hmm : G.wmm, hB = otra ? G.wmm : G.hmm;
  const propia = b.incl != null, vert = ['abajo', 'arriba'].includes(b.baja || G.baja);
  let fx = G.fx, fy = G.fy;
  if (propia) { const cs = Math.cos(b.incl * Math.PI / 180); fx = vert ? G.s : G.s / cs; fy = vert ? G.s / cs : G.s; }
  const sombra = propia && b.incl > 0 && b.sombra !== false ? sombraMm(vert ? hB : wB, b.incl, p.solMin ?? SOL_MIN) : null;
  const pw = wB / fx, ph = hB / fy;
  const sep = (sombra != null && vert ? sombra : (b.sep ?? GAP_FILA)) / (propia ? G.s : fy);
  const gx = (sombra != null && !vert ? sombra : GAP_COL) / (propia ? G.s : fx);
  return { sep, pw, ph, o, gx, sombra, a: b.ang != null ? b.ang * Math.PI / 180 : G.a, BW: b.c * pw + (b.c - 1) * gx, BH: b.f * ph + (b.f - 1) * sep };
}
export const girarV = (d, a) => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];

/* Paneles de todo el proyecto. Cada panel: {q (4 esquinas), key, rid, ri, bi?, off, bad} */
export function calcular(p) {
  const out = { panels: [], bloques: [], sombras: [], filas: {}, porTecho: p.roofs.map(() => ({ n: 0, area: 0, wp: 0 })), n: 0, kwp: 0, area: 0 };
  const s = escala(p); if (!s) { out.validos = []; out.porKey = new Map(); return out; }   // sin escala (hojas que no la necesitan): listas vacías
  const bloquean = p.zonas.filter(z => (ZONAS[z.k] || ZONAS.obs).bloquea).map(zonaPoly);
  p.roofs.forEach((r, ri) => {
    if (!r.closed || r.poly.length < 3) return;
    const G = geomTecho(p, r, s), { a, c, fx, fy, pw, ph, gx, P } = G, ret = r.setback ?? 400, sx = ret / fx, sy = ret / fy;
    out.porTecho[ri].wp = P.wp;
    out.porTecho[ri].area = polyArea(r.poly.map(q => rotP(q, c, -a))) * fx * fy / 1e6;
    const off = new Set(r.off || []);
    if (r.modo === 'manual') {
      const rpx = ret / s, nb = r.poly.length;
      const lejos = pt => r.poly.every((v0, e) => distSeg(pt, v0, r.poly[(e + 1) % nb]) >= rpx - .01);
      const cabe = q => [...q, ...q.map((v, k) => lerp(v, q[(k + 1) % 4], .5))].every(pt => pointInPoly(pt, r.poly) && lejos(pt)) && !bloquean.some(o => convexOverlap(q, o));
      (r.bloques || []).forEach((b, bi) => {
        const g = geomBloque(p, G, b), C = [b.x, b.y], x0 = C[0] - g.BW / 2, y0 = C[1] - g.BH / 2, gira = pts => pts.map(v => rotP(v, C, g.a));
        for (let i = 0; i < b.f; i++) for (let j = 0; j < b.c; j++) {
          const x = x0 + j * (g.pw + g.gx), y = y0 + i * (g.ph + g.sep), key = `${r.id}:b${b.id || bi}:${i}:${j}`;
          const q = gira([[x, y], [x + g.pw, y], [x + g.pw, y + g.ph], [x, y + g.ph]]);
          const sac = off.has(key);
          out.panels.push({ q, key, rid: r.id, ri, bi, i, j, off: sac, bad: !sac && !cabe(q) });
        }
        out.bloques.push({ ri, bi, q: gira([[x0, y0], [x0 + g.BW, y0], [x0 + g.BW, y0 + g.BH], [x0, y0 + g.BH]]) });
        if (g.sombra != null) {
          const sp = g.sombra / G.s, x1 = x0 + g.BW, y1 = y0 + g.BH;
          const z = { abajo: [[x0, y0 - sp], [x1, y0 - sp], [x1, y0], [x0, y0]], arriba: [[x0, y1], [x1, y1], [x1, y1 + sp], [x0, y1 + sp]],
            izq: [[x1, y0], [x1 + sp, y0], [x1 + sp, y1], [x1, y1]], der: [[x0 - sp, y0], [x0, y0], [x0, y1], [x0 - sp, y1]] }[b.baja || G.baja];
          out.sombras.push({ ri, bi, q: gira(z) });
        }
      });
      return;
    }
    // Automático: llena el techo por filas, respetando el retiro y las zonas que bloquean.
    const poly = r.poly.map(q => rotP(q, c, -a)), obs = bloquean.map(z => z.map(q => rotP(q, c, -a)));
    const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sep = (r.sepFila ?? GAP_FILA) / fy;
    const valid = (x, y) => {
      const X0 = x - sx, Y0 = y - sy, X1 = x + pw + sx, Y1 = y + ph + sy, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
      for (const pt of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1], [cx, Y0], [cx, Y1], [X0, cy], [X1, cy]]) if (!pointInPoly(pt, poly)) return false;
      const q = [[x, y], [x + pw, y], [x + pw, y + ph], [x, y + ph]];
      return !obs.some(o => convexOverlap(q, o));
    };
    let y = minY + sy, row = 0;
    while (y + ph <= maxY - sy + .01 && row < 120) {
      let x = minX + sx;
      while (x + pw <= maxX - sx + .01) {
        if (valid(x, y)) {
          const key = `${r.id}:a:${row}:${Math.round((x - minX) * s / 10)}`;
          out.panels.push({ q: [[x, y], [x + pw, y], [x + pw, y + ph], [x, y + ph]].map(q => rotP(q, c, a)), key, rid: r.id, ri, off: off.has(key) });
          x += pw + gx;
        } else x += 3;
      }
      y += ph + sep; row++;
    }
  });
  // Paneles en la sombra de otro bloque o encima de otros: en rojo y sin contar.
  const chica = q => { const m = centroid(q); return q.map(v => lerp(m, v, .97)); };
  if (out.sombras.length) out.panels.forEach(pn => { if (pn.off || pn.bad) return; const q = chica(pn.q); if (out.sombras.some(z => !(z.ri === pn.ri && z.bi === pn.bi) && convexOverlap(q, z.q))) pn.bad = true; });
  const ocupado = [];
  out.panels.forEach(pn => { if (pn.bi == null && !pn.off) ocupado.push(chica(pn.q)); });
  out.panels.forEach(pn => { if (pn.bi == null || pn.off || pn.bad) return; const q = chica(pn.q); if (ocupado.some(o => convexOverlap(q, o))) pn.bad = true; else ocupado.push(q); });
  const vale = pn => !pn.off && !pn.bad;
  out.panels.forEach(pn => { if (vale(pn)) out.porTecho[pn.ri].n++; });
  out.n = out.panels.filter(vale).length;
  out.kwp = out.porTecho.reduce((t, x) => t + x.n * x.wp, 0) / 1000;
  out.area = out.porTecho.reduce((t, x) => t + x.area, 0);
  out.validos = out.panels.filter(vale);
  out.porKey = new Map(out.validos.map(pn => [pn.key, pn]));
  return out;
}

/* Largo real (m) de una polilínea de la foto */
export const largoM = (p, pts) => { const s = escala(p); return s ? polyLen(pts) * s / 1000 : 0; };
export function largoTramo(p, filtro) { return p.rutas.filter(filtro).reduce((t, r) => t + largoM(p, r.pts), 0); }

/* Resistividad del cobre (Ω·mm²/m) y caídas de tensión como en los cuadros de carga. */
export const RHO_CC = 0.0181, RHO_CA = 0.0188, CAIDA_MAX = 3;

export const nombreString = st => `A.${st.mppt}.${st.num || 1}`;

/* Strings: datos eléctricos y validación contra el inversor. */
export function calcStrings(p, R = calcular(p)) {
  const inv = inversorDe(p), usados = new Set();
  const lista = p.strings.map((st, idx) => {
    const pans = st.panels.filter(k => R.porKey.has(k) && !usados.has(k)); pans.forEach(k => usados.add(k));
    const roof = pans.length ? p.roofs.find(r => r.id === R.porKey.get(pans[0]).rid) : null;
    const P = panelDe(p, roof), n = pans.length;
    const mezcla = new Set(pans.map(k => panelDe(p, p.roofs.find(r => r.id === R.porKey.get(k).rid)).id)).size > 1;
    const voc = n * P.voc, vmp = n * P.vmp, vocFrio = voc * (1 + (P.coefVoc / 100) * (T_MIN - 25)), pw = n * P.wp;
    const largoAuto = largoTramo(p, r => r.k === 'cc' && (r.tramo === st.id));
    const largo = st.largo != null ? st.largo : Math.round(largoAuto);
    const seccion = st.seccion || 6;
    const dv = RHO_CC * largo * P.imp / seccion, dvp = vmp ? dv / vmp * 100 : 0;
    const av = [];
    if (n && vmp < inv.vmin) av.push(`Vmp ${vmp.toFixed(0)} V bajo el rango MPPT (${inv.vmin} V)`);
    if (n && vmp > inv.vmax) av.push(`Vmp ${vmp.toFixed(0)} V sobre el rango MPPT (${inv.vmax} V)`);
    if (n && vocFrio > inv.vdcMax) av.push(`Voc en frío ${vocFrio.toFixed(0)} V supera ${inv.vdcMax} V`);
    if (n && P.isc * (st.paralelo || 1) > inv.isc) av.push(`Isc ${P.isc} A supera ${inv.isc} A de cortocircuito por MPPT`);
    if (mezcla) av.push('Mezcla paneles de distinto modelo');
    if (dvp > CAIDA_MAX) av.push(`Caída de tensión ${dvp.toFixed(2)} % sobre ${CAIDA_MAX} %`);
    const mppts = p.strings.filter(x => x.mppt === st.mppt).length;
    if (st.mppt > inv.mppt) av.push(`El inversor tiene ${inv.mppt} MPPT`);
    if (mppts > (inv.strPorMppt || 1)) av.push(`MPPT ${st.mppt} tiene ${mppts} strings (máx. ${inv.strPorMppt || 1})`);
    if (!n) av.push('Sin paneles asignados');
    return { st, idx, n, P, voc, vmp, vocFrio, pw, largo, largoAuto, seccion, dv, dvp, av, ok: n > 0 && !av.length, nombre: nombreString(st), etq: `${st.mppt}.${st.num || 1}` };
  });
  const sinString = R.validos ? R.validos.filter(pn => !usados.has(pn.key)).length : 0;
  const pw = lista.reduce((t, x) => t + x.pw, 0);
  return { lista, sinString, pw, inv, ratio: pw / (inv.kw * 1000 * (p.cantInv || 1)) };
}

/* Tramos del alimentador en CA (para el cuadro de caída de tensión). */
export function calcCA(p) {
  const inv = inversorDe(p), I = inv.kw * 1000 * (p.cantInv || 1) / inv.vac, L = p.lamina || {};
  const tramo = (id, nombre) => {
    const auto = largoTramo(p, r => (r.k === 'ca' || r.k === 'sub') && r.tramo === id);
    const largo = L['largo_' + id] != null ? L['largo_' + id] : Math.round(auto);
    const ducto = [...new Set(p.rutas.filter(r => (r.k === 'ca' || r.k === 'sub') && r.tramo === id).map(r => CANAL[r.k].ducto))].join(' / ') || CANAL.ca.ducto;
    const S = 8.37, dv = 2 * largo * I * RHO_CA / S;
    return { id, nombre, largo, auto, dv, dvp: dv / inv.vac * 100, ducto, prot: protStd(inv.iac || I) };
  };
  const t = [tramo('inv-tg', 'Inversor - TGFV'), tramo('tg-emp', 'TG - Empalme')];
  return { tramos: t, I, prot: protStd(inv.iac || I), total: t.reduce((a, x) => a + x.dv, 0), totalP: t.reduce((a, x) => a + x.dvp, 0) };
}
