/* Utilidades generales: DOM, formato, geometría básica e íconos. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, d = 1) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
export const parseNum = s => { const n = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
export const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- Geometría (coordenadas en px de la foto) ---------- */
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
export function pointInPoly(pt, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
export function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; }
export function centroid(p) { let x = 0, y = 0; p.forEach(q => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
export function rotP(p, c, a) { const cs = Math.cos(a), sn = Math.sin(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; }
export function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/* ¿Se tocan dos polígonos convexos? (teorema del eje separador) */
export function convexOverlap(A, B) {
  for (const poly of [A, B]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], ny = p[0] - q[0];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of A) { const d = v[0] * nx + v[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of B) { const d = v[0] * nx + v[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
/* Envolvente convexa (monotone chain) */
export function hull(pts) {
  const p = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/* Ángulo de la línea más cercana a p, llevado a ±45° */
export function anguloBordeCercano(poly, p) {
  let best = Infinity, ang = 0;
  poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length], d = distSeg(p, a, b); if (d < best) { best = d; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; } });
  while (ang > 45) ang -= 90; while (ang <= -45) ang += 90; return Math.round(ang * 10) / 10;
}
export function edgeAngle(poly) {
  let best = 0, ang = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], L = dist(p, q); if (L > best) { best = L; ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; } });
  while (ang > 45) ang -= 90; while (ang <= -45) ang += 90; return Math.round(ang);
}
export const polyLen = pts => pts.reduce((t, p, i) => i ? t + dist(pts[i - 1], p) : 0, 0);

/* ---------- Íconos (trazo 1.6, 24×24) ---------- */
const IC = {
  back: '<path d="M15 5l-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', roof: '<path d="M3 12l9-7 9 7"/><path d="M6 10v9h12v-9"/>',
  block: '<rect x="4" y="4" width="16" height="16"/><path d="M4 4l16 16M12 4l8 8M4 12l8 8"/>', grid: '<rect x="3" y="4" width="18" height="16"/><path d="M3 12h18M9 4v16M15 4v16"/>',
  string: '<path d="M4 7h4v4H4zM10 7h4v4h-4zM16 7h4v4h-4z"/><path d="M6 11v4h12v-4"/>', plug: '<path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 01-10 0zM12 17v4"/>',
  sheet: '<rect x="3" y="4" width="18" height="16"/><path d="M13 14h8M13 14v6M3 14h6"/>', move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  zoomin: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M8 11h6M11 8v6"/>', zoomout: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M8 11h6"/>',
  ext: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', hand: '<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7s-5-2-7-6l-1-2a1.5 1.5 0 012.5-1.5L8 13"/>',
  cursor: '<path d="M5 3l13 8-6 1.5L9 19z"/>', text: '<path d="M5 6h14M12 6v13"/>', dim: '<path d="M4 8v8M20 8v8M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/>',
  pline: '<path d="M4 18l5-9 6 5 5-9"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="5" r="1.5"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 018 0v4"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 017.5-2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  north: '<path d="M12 3l4 14-4-3-4 3z"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  drone: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  crop: '<path d="M6 2v16h16M2 6h16v16"/>', folder: '<path d="M3 6h6l2 2h10v11H3z"/>', moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z"/>', inverter: '<rect x="4" y="4" width="16" height="16"/><path d="M4 20L20 4M7 8c1-1.5 2-1.5 3 0s2 1.5 3 0M13 16h5"/>',
  rot: '<path d="M20 12a8 8 0 11-3-6.2"/><path d="M20 4v5h-5"/>'
};
export const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

/* Aviso corto abajo de la pantalla */
let toastT = null;
export function toast(msg) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2800);
}
export function descargar(nombre, contenido, tipo = 'text/plain') {
  const b = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
