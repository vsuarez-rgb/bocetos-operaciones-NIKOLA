/* ==========================================================================
   Dibujo de una página del informe (en pantalla y para imprimir / PDF).
   Las páginas se arman en HTML con medidas en mm, así lo que se ve es lo que
   sale en el PDF.
   ========================================================================== */
import { esc } from '../util.js';
import { calcular, calcStrings } from '../geom.js';
import { dibujar, cargarImg } from '../render.js';
import { vistaHoja, resolverHoja, TIPOS_HOJA } from '../hojas.js';
import { lamina01, lamina02, unilinealSVG } from '../lamina.js';
import { cargarDatosFicha } from '../ficha/datos.js';
import { calcularFicha } from '../ficha/motor.js';
import { medida } from './modelo.js';

export const MM = 96 / 25.4;      // px por mm en pantalla (a escala 1)

/* ---------- Datos para los {Campos} ---------- */
export async function datosInforme(p) {
  const out = {}, sep = p.ficha?.ajustes?.separadorDecimal || ',';
  const fmt = v => typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', sep) : (v == null ? null : String(v));
  let dic = null;
  try {
    const d = await cargarDatosFicha(); dic = d.dic;
    if (p.ficha) {
      const r = calcularFicha(d.plantilla, p.ficha, { personas: d.personas }), campos = r.campos(d.dic), porFila = new Map(campos.map(c => [c.fila, c]));
      for (const c of campos) out[c.id] = c.error ? null : fmt(c.valor);
      /* Los nombres de las propiedades del DWG también sirven como {Campo}, con el mismo valor que escribe la macro
         de AutoCAD: si el tramo es AWG, la macro usa la sección en mm² (columna D) en vez del calibre. */
      for (const c of d.dic.campos) {
        if (c.tipo !== 'campo' || !c.macro) continue;
        for (const m of c.macro) {
          if (m.condicion) {
            const q = /^(NO \()?B(\d+) = "([^"]+)"\)?$/.exec(m.condicion); if (!q) continue;
            const cumple = String(porFila.get(+q[2])?.valor ?? '') === q[3]; if (q[1] ? cumple : !cumple) continue;
          }
          const v = m.celda.startsWith('D') && c.celdaMm2 ? r.valor('Información proyecto', c.celdaMm2) : porFila.get(c.fila)?.valor;
          out[m.propiedad] = v && typeof v === 'object' && v.codigo ? null : fmt(v);
        }
      }
    }
  } catch (e) { console.warn('Sin datos de la ficha para el informe:', e.message); }
  const R = calcular(p), L = p.lamina || {};
  const extra = {
    codigo: p.codigo, cliente: p.cliente, direccion: p.direccion, comuna: p.comuna, region: p.region, distribuidora: p.distrib,
    kWp: out['POTENCIA Peak'] ?? fmt(Math.round(R.kwp * 100) / 100), kW: out['POTENCIA Nominal'] ?? null, paneles: out['Módulos totales'] ?? String(R.n),
    proyectista: L.proyectista || out['PROYECTISTA'] || '', ingeniero: L.jefe || L.ingeniero || out['PROYECTISTA'] || '', instalador: L.instalador || out['INSTALADOR(A) Nombre'] || '',
    fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  };
  for (const [k, v] of Object.entries(extra)) if (!(k in out)) out[k] = v == null ? null : String(v);
  const conocidos = new Set([...Object.keys(out), ...(dic?.campos || []).filter(c => c.tipo === 'campo').flatMap(c => [c.id, ...(c.propiedadDWG || [])])]);
  return { valores: out, dic, extras: Object.keys(extra), conocidos };
}

/* Texto con {Campos} y un formato mínimo: **negrita**, [rojo](texto), líneas que empiezan con "• " */
export function rellenar(texto, datos, { editor = false, mayusculas = false } = {}) {
  let html = '';
  const partes = String(texto ?? '').split(/(\{[^{}\n]+\})/);
  for (const t of partes) {
    const m = /^\{([^{}\n]+)\}$/.exec(t);
    if (!m) { html += esc(mayusculas ? t.toUpperCase() : t); continue; }
    const k = m[1].trim(), v = datos.valores[k];
    if (v === undefined && !datos.conocidos?.has(k)) html += editor ? `<span class="ph-falta" title="No existe el campo «${esc(k)}»">${esc(t)}</span>` : '—';
    else if (v == null || v === '') html += editor ? `<span class="ph-vacio" title="El campo «${esc(k)}» está vacío en la ficha">${esc(t)}</span>` : '';
    else html += esc(mayusculas ? v.toUpperCase() : v);
  }
  return html.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>').replace(/\[(rojo|azul|gris)\]\(([\s\S]+?)\)/g, '<span class="c-$1">$2</span>').replace(/\n/g, '<br>');
}

/* ---------- Vista de una hoja de diseño (foto + dibujos) como imagen ---------- */
const cacheVistas = new Map();
export const olvidarVistas = () => cacheVistas.clear();
async function imagenHoja(p, id, wmm, hmm, encuadre, foto) {
  const v = id ? vistaHoja(p, id) : p;
  if (!v.img) return null;
  const clave = [id, Math.round(wmm), Math.round(hmm), encuadre, foto].join('|');
  if (cacheVistas.has(clave)) return cacheVistas.get(clave);
  await cargarImg(v.img);
  const R = calcular(v), SI = calcStrings(v, R);
  let x0 = 0, y0 = 0, x1 = v.w || 1000, y1 = v.h || 750;
  if (encuadre === 'dibujo') {
    const pts = [];
    (v.roofs || []).forEach(r => pts.push(...r.poly)); (v.equipos || []).forEach(e => pts.push([e.x, e.y])); (v.rutas || []).forEach(r => pts.push(...r.pts));
    (v.cotas || []).forEach(c => pts.push(c.a, c.b)); (v.textos || []).forEach(t => pts.push(t.p)); if (v.norte) pts.push([v.norte.x, v.norte.y]);
    if (pts.length > 1) { x0 = Math.min(...pts.map(q => q[0])); x1 = Math.max(...pts.map(q => q[0])); y0 = Math.min(...pts.map(q => q[1])); y1 = Math.max(...pts.map(q => q[1])); const m = Math.max(x1 - x0, y1 - y0) * .1; x0 -= m; x1 += m; y0 -= m; y1 += m; }
  }
  const asp = wmm / hmm; let bw = x1 - x0, bh = y1 - y0;
  if (bw / bh > asp) { const nh = bw / asp; y0 -= (nh - bh) / 2; bh = nh; } else { const nw = bh * asp; x0 -= (nw - bw) / 2; bw = nw; }
  const PX = Math.max(600, Math.min(2800, Math.round(wmm * 11))), k = PX / bw, c = document.createElement('canvas');
  c.width = PX; c.height = Math.round(PX / asp);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  dibujar(g, v, { k, ox: x0 * k, oy: y0 * k }, { plot: true, R, SI, u: PX / wmm * .3, step: 'lamina', fotoAlpha: (foto ?? 100) / 100 });
  const url = c.toDataURL('image/jpeg', .9);
  cacheVistas.set(clave, url);
  return url;
}

/* ---------- Bloques ---------- */
async function interior(b, ctx) {
  const { p, datos, editor } = ctx;
  switch (b.tipo) {
    case 'texto': {
      const est = `font-size:${b.tam || 10}pt;text-align:${b.justificar ? 'justify' : ({ izq: 'left', centro: 'center', der: 'right' }[b.alinear] || 'left')};${b.negrita ? 'font-weight:700;' : ''}${b.cursiva ? 'font-style:italic;' : ''}`;
      return `<div class="bq-tx c-${b.color || 'negro'}" style="${est}">${rellenar(b.texto, datos, { editor, mayusculas: b.mayusculas })}</div>`;
    }
    case 'imagen': {
      if (b.src) return `<img class="bq-img" src="${esc(b.src)}" alt="" style="object-fit:${b.ajuste === 'cubrir' ? 'cover' : 'contain'}">`;
      return editor ? `<div class="bq-vacio">Imagen${b.ayuda ? `<b>${rellenar(b.ayuda, datos, {})}</b>` : ''}<span>Doble clic para subir</span></div>` : '';
    }
    case 'vista': {
      const h = resolverHoja(p, b.hoja);
      if (!h.existe) return editor ? `<div class="bq-vacio">Vista de hoja<b>Falta la hoja «${esc(h.falta)}»</b><span>Créala en el editor o elige otra hoja</span></div>` : '';
      const url = await imagenHoja(p, h.id, b.w, b.h, b.encuadre, b.foto);
      if (!url) return editor ? `<div class="bq-vacio">Vista de hoja<b>La hoja no tiene foto</b><span>Súbela en el paso Escala de esa hoja</span></div>` : '';
      return `<img class="bq-img" src="${url}" alt="">`;
    }
    case 'tabla': {
      const filas = b.filas || [], n = Math.max(1, ...filas.map(f => f.length));
      const anchos = String(b.anchos || '').split(',').map(x => parseFloat(x)).filter(x => x > 0);
      const resto = Math.max(0, 100 - anchos.reduce((t, x) => t + x, 0)), libres = n - anchos.length;
      const col = Array.from({ length: n }, (_, i) => anchos[i] ?? (libres > 0 ? resto / libres : 0));
      const celda = (t, cab) => `<${cab ? 'th' : 'td'}>${rellenar(t, datos, { editor, mayusculas: b.mayusculas && !cab })}</${cab ? 'th' : 'td'}>`;
      return `<table class="bq-tb${b.cuerpo === 'normal' ? ' normal' : ''}" style="font-size:${b.tam || 8}pt"><colgroup>${col.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
        ${b.titulo ? `<thead><tr><th colspan="${n}" class="tb-tit c-${b.tituloColor || 'negro'}">${rellenar(b.titulo, datos, { editor })}</th></tr></thead>` : ''}
        <tbody>${filas.map((f, i) => `<tr>${Array.from({ length: n }, (_, j) => celda(f[j] ?? '', b.cabecera && i === 0)).join('')}</tr>`).join('')}</tbody></table>`;
    }
    case 'unilineal': { const R = calcular(p); return unilinealSVG(p, R, calcStrings(p, R)); }
    case 'lamina': {
      const R = calcular(p), SI = calcStrings(p, R);
      const svg = await (b.lamina === '02' ? lamina02 : lamina01)(p, R, SI);
      return svg.replace(/width="841mm" height="594mm"/, 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
    }
    case 'recuadro': return '';
  }
  return '';
}

export async function htmlPagina(pg, ctx) {
  const [W, H] = medida(pg);
  const bloques = [];
  for (const b of pg.bloques || []) {
    let dentro; try { dentro = await interior(b, ctx); } catch (e) { console.error(e); dentro = ctx.editor ? `<div class="bq-vacio">No se pudo dibujar<b>${esc(e.message)}</b></div>` : ''; }
    bloques.push(`<div class="bq bq-${b.tipo}${b.borde ? ' con-borde' : ''}${ctx.sel === b.id ? ' sel' : ''}" data-b="${b.id}" style="left:${b.x}mm;top:${b.y}mm;width:${b.w}mm;height:${b.h}mm">${dentro}${ctx.editor ? '<i class="bq-h" title="Arrastra para cambiar el tamaño"></i>' : ''}</div>`);
  }
  return `<div class="pg" data-pg="${pg.id}" style="width:${W}mm;height:${H}mm">${bloques.join('')}</div>`;
}

/* Estilos de la página: los mismos en pantalla y al imprimir */
export const CSS_PAGINA = `
.pg { position: relative; background: #fff; color: #111; overflow: hidden; font-family: Arial, 'Helvetica Neue', sans-serif; }
.pg .bq { position: absolute; box-sizing: border-box; }
.pg .con-borde { border: .3mm solid #111; }
.pg .bq-tx { width: 100%; height: 100%; line-height: 1.35; overflow: hidden; overflow-wrap: anywhere; }
.pg .bq-img { width: 100%; height: 100%; display: block; }
.pg .bq-unilineal svg, .pg .bq-lamina svg { display: block; width: 100%; height: 100%; }
.pg .bq-tb { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; font-family: 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; font-style: italic; }
.pg .bq-tb th, .pg .bq-tb td { border: .25mm solid #111; padding: .6mm 1.4mm; text-align: left; vertical-align: middle; font-weight: 400; overflow-wrap: anywhere; }
.pg .bq-tb th { text-align: center; font-style: normal; font-family: Arial, sans-serif; }
.pg .bq-tb .tb-tit { font-size: 1.35em; font-style: italic; font-family: 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif; letter-spacing: .04em; }
.pg .bq-tb.normal { font-style: normal; font-family: Arial, sans-serif; } .pg .bq-tb.normal td { vertical-align: top; padding: 1.5mm 2mm; }
.pg .bq-tb.normal .tb-tit { font-family: Arial, sans-serif; font-style: normal; font-weight: 700; font-size: 1.05em; letter-spacing: 0; }
.pg .c-rojo { color: #D7262E; } .pg .c-azul { color: #082537; } .pg .c-gris { color: #5b6770; }
`;
