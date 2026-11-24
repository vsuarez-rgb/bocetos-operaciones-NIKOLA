/* ==========================================================================
   Normas de diseño: cada una con su fuente (documento, punto y página).
   Dos clases:
   · Geométricas: se revisan solas en el dibujo y dan advertencias que el ingeniero
     puede marcar como revisadas (se guarda en la hoja: p.normasOk).
       montaje   · borde inferior ≥ min y borde superior ≤ max (m sobre el piso)
       alturaSup · borde superior entre min y max
       alturaInf · borde inferior ≥ min; ubic = armario | intemperie (solo tableros)
       altCentro · centro del equipo entre min y max (conector del cargador)
       libre     · espacio libre a los lados (min, m) y, si n.fabricante, el del manual
                   (arriba / abajo / lados) contra los otros equipos y el piso
       canalMin  · canalizaciones a ≥ min del piso (salvo subterráneas o "va a suelo")
       largoMax  · largo de cada canalización de esos tipos (y tramo) ≤ max (m)
     Las de altura se miden desde el nivel de piso de la hoja (p.suelo) y solo en
     equipos con medida real (de frente). largoMax necesita escala.
   · Checklist: no se pueden medir en el dibujo; se marcan a mano por proyecto
     (p.normasOk['chk:<id>'] en el proyecto) y quedan como respaldo de que se revisaron.
   Ámbito: 'fv' (proyectos con paneles), 'cargador' (solo cargador) o 'todos'.
   Condiciones opcionales (cond): kwMin, siCanal [tipos], siEquipo [tipos].
   Se editan en Configuración → Normas (lista de proyectos) y se guardan en este
   navegador (ajuste 'normas' = { v: 2, lista, borradas }).
   ========================================================================== */
import { EQUIPOS, CANAL } from './catalogo.js';
import { escala, escalaSimbolos, tamEquipoPx, esReal, largoM, inversorDe, calcular } from './geom.js';
import { leerAjuste, guardarAjuste } from './ajustes.js';
import { fmt } from './util.js';

export const TIPOS_NORMA = {
  montaje: 'Altura de montaje (borde inferior ≥ mín., borde superior ≤ máx.)',
  alturaSup: 'Altura de la parte de arriba del equipo',
  alturaInf: 'Altura mínima de la parte de abajo del equipo',
  altCentro: 'Altura del centro del equipo (conector)',
  libre: 'Espacio libre alrededor del equipo',
  canalMin: 'Altura mínima de las canalizaciones',
  largoMax: 'Largo máximo de una canalización',
  checklist: 'Checklist (se marca a mano en cada proyecto)'
};
export const AMBITOS = { todos: 'Todos los proyectos', fv: 'Fotovoltaico', cargador: 'Solo cargador' };
export const ORIGENES = { norma: 'Normativa SEC', fabricante: 'Fabricante', nikola: 'Criterio Nikola' };

const RGR02 = 'RGR N°02/2024 (instalaciones FV conectadas a red)', RGR06 = 'RGR N°06/2024 (sistemas de almacenamiento)', RGR01 = 'RGR N°01/2024';
const RIC = n => `Pliego RIC N°${n}`, RIC15 = 'Pliego RIC N°15 (2024) Recarga de vehículos eléctricos';
const RIC02 = RIC('02') + ' Tableros', RIC04 = RIC('04') + ' Conductores y canalizaciones';

export const NORMAS_BASE = [
  /* ---------- Geométricas: equipos ---------- */
  { id: 'n-inv-alt', nombre: 'Inversor: borde inferior a 0,60 m o más y borde superior a 2,0 m o menos del piso', tipo: 'montaje', equipos: ['inv'], min: 0.6, max: 2.0, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RGR02, punto: 'Cap. 12 Inversores', pag: '30' }, nota: 'La norma no dice a qué borde se mide: se usa el criterio que RGR N°06/2024 da para el equipo de conversión (PCE). No aplica a microinversores, inversores en gabinete ni autosoportados.' },
  { id: 'n-inv-libre', nombre: 'Inversor: 15 cm libres a cada lado, o lo que pida el fabricante si es más', tipo: 'libre', equipos: ['inv'], min: 0.15, fabricante: true, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RGR02, punto: 'Cap. 12 Inversores', pag: '30' }, nota: 'El espacio del fabricante (arriba, abajo y lados) sale del manual de cada familia: se ve en Configuración → Equipos.' },
  { id: 'n-tab-mando', nombre: 'Tableros: mandos entre 0,45 m y 2,0 m del piso', tipo: 'montaje', equipos: ['tg', 'tfv'], min: 0.45, max: 2.0, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC02, punto: '6.1.22', pag: '10' }, nota: 'La norma mide a la base de cada dispositivo de comando; revisar el borde del tablero es más exigente. Para tableros IRVE lo repite RIC N°15 (2024) 8.6.' },
  { id: 'n-tab-int', nombre: 'Tableros a la intemperie: al menos 50 cm del suelo', tipo: 'alturaInf', equipos: ['tg', 'tfv'], ubic: 'intemperie', min: 0.5, activa: true, ambito: 'todos', origen: 'nikola',
    fuente: { doc: 'Criterio interno Nikola', punto: '', pag: '' }, nota: 'No aparece en la normativa revisada. Es más exigente que RIC N°02 (0,45 m).' },
  { id: 'n-tab-arm', nombre: 'Tableros en armario: al menos 30 cm del suelo', tipo: 'alturaInf', equipos: ['tg', 'tfv'], ubic: 'armario', min: 0.3, activa: false, ambito: 'todos', origen: 'nikola',
    fuente: { doc: 'Criterio interno Nikola', punto: '', pag: '' }, nota: 'Desactivada: RIC N°02 6.1.22 pide 0,45 m a los mandos, que es más exigente.' },
  { id: 'n-bat-alt', nombre: 'Baterías: altura de término de 2,2 m o menos', tipo: 'alturaSup', equipos: ['bat', 'dcdc'], max: 2.2, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RGR06, punto: 'Ubicación del BESS', pag: '23-24' } },
  { id: 'n-ev-con', nombre: 'Cargador de muro: conector entre 1,0 m y 1,3 m del piso', tipo: 'altCentro', equipos: ['ev'], min: 1.0, max: 1.3, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC15, punto: '15.4', pag: '27' }, nota: 'Se toma el centro del cargador como altura del conector. Cargador tipo tótem: 0,6–1,3 m.' },
  { id: 'n-ev-piso', nombre: 'Cargador: más de 10 cm sobre el piso', tipo: 'alturaInf', equipos: ['ev'], min: 0.1, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC15, punto: '15.2', pag: '27' }, nota: 'No aplica si el cargador trae una base de esa altura.' },
  { id: 'n-med-conc', nombre: 'Empalmes en recinto o armario: borde inferior a 0,80 m o más y superior a 2,10 m o menos', tipo: 'montaje', equipos: ['med'], min: 0.8, max: 2.1, activa: false, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC('01') + ' Empalmes', punto: '7.8.4', pag: '5' }, nota: 'Solo empalmes concentrados. RIC N°01 no fija altura para un medidor individual.' },
  /* ---------- Geométricas: canalizaciones ---------- */
  { id: 'n-canal', nombre: 'Canalizaciones: al menos 15 cm del suelo (salvo que vayan a suelo)', tipo: 'canalMin', canal: ['cc', 'ca', 'tie'], min: 0.15, activa: true, ambito: 'todos', origen: 'nikola',
    fuente: { doc: 'Criterio interno Nikola', punto: '', pag: '' } },
  { id: 'n-canal-vista', nombre: 'Tubería a la vista: conveniente a 2,5 m o más', tipo: 'canalMin', canal: ['cc', 'ca'], min: 2.5, activa: false, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC04, punto: '7.16.4.8', pag: '58' }, nota: 'La norma dice "conveniente", no obligatorio. Desactivada para no llenar de avisos las bajadas a los equipos.' },
  { id: 'n-afci', nombre: 'CC: 80 m o menos entre el inversor (AFCI) y el último módulo', tipo: 'largoMax', canal: ['cc', 'subcc'], max: 80, activa: true, ambito: 'fv', origen: 'norma',
    fuente: { doc: RGR02, punto: '12.4', pag: '29' }, nota: 'Salvo que el fabricante acredite más. Se revisa cada canalización dibujada.' },
  { id: 'n-tfv-30', nombre: 'Inversor a más de 30 m del tablero: va un tablero FV junto al inversor', tipo: 'largoMax', canal: ['ca', 'sub'], tramo: 'inv-tg', max: 30, activa: true, ambito: 'fv', origen: 'norma',
    fuente: { doc: RGR02, punto: '14.21', pag: '35' }, nota: 'Se revisan las canalizaciones marcadas como tramo «Inversor – TGFV».' },
  { id: 'n-tg-30', nombre: 'Tablero a más de 30 m del medidor: va un tablero general junto al medidor', tipo: 'largoMax', canal: ['ca', 'sub'], tramo: 'tg-emp', max: 30, activa: true, ambito: 'todos', origen: 'norma',
    fuente: { doc: RIC02, punto: '6.5.2', pag: '13' }, nota: 'Se revisan las canalizaciones marcadas como tramo «TG – Empalme».' },
  /* ---------- Checklist: fotovoltaico ---------- */
  { id: 'c-cc-ruta', nombre: 'CC sin tramos aéreos, sin compartir ducto con CA o comunicaciones (salvo separador) y sin pasar por tableros CA', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 10 y 11.2', pag: '23-24' } },
  { id: 'c-cola', nombre: 'Cable sin canalizar entre la canalización o caja y el inversor: 40 cm o menos (CC y CA)', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 9', pag: '20 y 23' }, verificar: true },
  { id: 'c-perim', nombre: 'Paneles y estructura no sobresalen del techo, y queda espacio para apoyar una escalera', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 6', pag: '15' }, verificar: true },
  { id: 'c-pasillo', nombre: '10 kW o más: acceso y cuerda de vida. 30 kW o más: además pasillo técnico y vía de tránsito (exento si el techo tiene 5° o menos, es rígido y transitable, y el plano marca las zonas de tránsito)', tipo: 'checklist', activa: true, ambito: 'fv', cond: { kwMin: 10 }, origen: 'norma', fuente: { doc: RGR02, punto: '7.7 y 7.8', pag: '16-17' } },
  { id: 'c-mppt', nombre: 'Un MPPT no mezcla modelos de panel ni orientaciones', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 8', pag: '18-19' } },
  { id: 'c-dv', nombre: 'Caída de tensión: CC bajo 1,5 %; CA bajo 3 % entre el empalme y la protección RI', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 11', pag: '26' }, nota: 'La app ya avisa en el paso Strings la caída CC sobre 1,5 %.' },
  { id: 'c-dif', nombre: 'Diferencial CA según la generación: hasta 5 kW 30 mA; 5–10 kW 100 mA; 10–30 kW 300 mA', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Protecciones CA', pag: '' }, verificar: true },
  { id: 'c-desc', nombre: 'Interruptor general FV en el tablero y otro de separación en el empalme', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: '14.12 y 19.2', pag: '' } },
  { id: 'c-tierra', nombre: 'Tierra de protección de 4 mm² o más (2,5 mm² en ducto o multiconductor); estructura y pasillos técnicos a tierra', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 11 y 17', pag: '27 y 39' } },
  { id: 'c-sen-med', nombre: 'Placa junto al medidor (70 × 40 mm o más, letra de 5 mm): "PRECAUCIÓN ESTA PROPIEDAD CUENTA CON UN SISTEMA DE GENERACIÓN FOTOVOLTAICA"', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: '18.2 a 18.4', pag: '41' } },
  { id: 'c-sen-pv', nombre: 'Señalética cerca de los paneles (100 × 200 mm, anexo 7), apagado de emergencia junto al inversor, rótulo en cada caja CC y strings numerados', tipo: 'checklist', activa: true, ambito: 'fv', origen: 'norma', fuente: { doc: RGR02, punto: 'Cap. 18 y anexo 7', pag: '42-43' } },
  { id: 'c-bess', nombre: 'Baterías fuera de: 600 mm a los lados de salidas, calefactores o aire acondicionado; 1200 mm bajo ellos; entretechos y bajo escaleras. 600 mm libres alrededor', tipo: 'checklist', activa: true, ambito: 'todos', cond: { siEquipo: ['bat'] }, origen: 'norma', fuente: { doc: RGR06, punto: 'Ubicación del BESS', pag: '21-24' } },
  /* ---------- Checklist: todos ---------- */
  { id: 'c-entrada', nombre: 'Tableros y cajas a la intemperie con entradas por abajo. IP: interior IP41, bajo techo IP44, intemperie IP54', tipo: 'checklist', activa: true, ambito: 'todos', origen: 'norma', fuente: { doc: RIC02, punto: '6.1.21', pag: '10' } },
  { id: 'c-frente', nombre: 'Frente libre de los tableros: 0,90 m (1,20 m frente a muro de hormigón o ladrillo; 1,50 m con partes vivas a ambos lados)', tipo: 'checklist', activa: true, ambito: 'todos', origen: 'norma', fuente: { doc: RIC02, punto: '5.4.2, tabla 2.1', pag: '6' } },
  { id: 'c-sub', nombre: 'Subterránea: tope del ducto a 0,45 m (peatonal) u 0,80 m (vehicular), ducto de 25 mm o más, mortero coloreado de 0,10 m y cinta; cámaras cada 90 m o menos', tipo: 'checklist', activa: true, ambito: 'todos', cond: { siCanal: ['sub', 'subcc'] }, origen: 'norma', fuente: { doc: RIC04, punto: '7.9.7', pag: '36-37' } },
  { id: 'c-soportes', nombre: 'Tubería a la vista: soportes cada 1,5 m o menos (metálica), abrazadera a 0,4 m o menos de cajas y tableros, caja de registro cada 15 m o menos', tipo: 'checklist', activa: true, ambito: 'todos', origen: 'norma', fuente: { doc: RIC04, punto: '7.16.4.4-5 y 7.16.1.7', pag: '57-58' } },
  { id: 'c-lamina', nombre: 'Lámina: coordenadas WGS84 y 3 calles, lista de láminas "n de N", simbología, cuadro de generación, caídas de tensión por tramo, unilineal completo, escala preferente 1:50', tipo: 'checklist', activa: true, ambito: 'todos', origen: 'norma', fuente: { doc: RIC('18') + ' Presentación de proyectos; ' + RGR01, punto: '5.7 y 6.3; cap. 7', pag: '' } },
  /* ---------- Checklist: cargador ---------- */
  { id: 'e-circ', nombre: 'Circuito exclusivo por cargador; diferencial tipo B, o tipo A de 30 mA más detección de 6 mA CC; magnetotérmico 2P (1F) o 4P (3F); 2,5 mm² o más', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '12.1, 12.4 y 12.5.4', pag: '19-20' } },
  { id: 'e-ip', nombre: 'Cargador exterior IP54 o más (IP44 en viviendas y edificios); interior IP44; IK08', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '16.3.5 y 16.3.6', pag: '29' } },
  { id: 'e-dist', nombre: 'Cargador a 5 m o menos de la entrada de carga del vehículo; conector en el equipo o a menos de 1 m; cable de 3 a 8 m', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '15.3, 15.4 y 16.3', pag: '27-29' } },
  { id: 'e-choque', nombre: 'Donde circulan vehículos: tope de ruedas, barrera o columna anticolisión dibujada', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '15.8 y fig. 15.7.3', pag: '28' } },
  { id: 'e-tab', nombre: 'Tablero con puerta, cubre-equipos y placa "Alimentación de infraestructura de recarga de vehículos eléctricos IRVE"', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '8.3', pag: '14' } },
  { id: 'e-canal', nombre: 'Canalización en zona de vehículos con tubo de alta resistencia mecánica (tabla 15.2)', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '10.9', pag: '17' } },
  { id: 'e-directo', nombre: 'Conexión directa al empalme solo con un cargador de un conector a 3 m o menos del empalme', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: RIC15, punto: '14.1.4', pag: '22' } },
  { id: 'e-plano', nombre: 'Plano TE6: emplazamiento, ubicación de componentes, equipos con su certificación SEC y fabricante, detalle de protecciones; más memoria e informe de imágenes', tipo: 'checklist', activa: true, ambito: 'cargador', origen: 'norma', fuente: { doc: 'Manual de usuario TE6 (SEC)', punto: 'Paso 8, adjunto 1', pag: '37' } }
];
const IDS_ANTIGUAS = ['n-alt-eq', 'n-tab-arm', 'n-tab-int', 'n-canal'];
const copia = x => JSON.parse(JSON.stringify(x));

/* Lee las normas guardadas. Si son de la versión anterior (lista sin fuentes), se reemplazan
   por las nuevas y se conservan las que el usuario agregó. Las normas base nuevas se suman solas. */
export async function cargarNormas() {
  const g = await leerAjuste('normas');
  if (!g) return copia(NORMAS_BASE);
  if (Array.isArray(g)) return [...copia(NORMAS_BASE), ...g.filter(n => !IDS_ANTIGUAS.includes(n.id))];
  const lista = g.lista || [], borradas = new Set(g.borradas || []);
  NORMAS_BASE.forEach((b, i) => { if (!lista.some(n => n.id === b.id) && !borradas.has(b.id)) lista.splice(Math.min(i, lista.length), 0, copia(b)); });
  return lista;
}
export async function guardarNormas(lista) {
  const ids = new Set(lista.map(n => n.id));
  await guardarAjuste('normas', { v: 2, lista: copia(lista), borradas: NORMAS_BASE.map(n => n.id).filter(id => !ids.has(id)) });
}
export const restaurarNormas = () => copia(NORMAS_BASE);
export const esBase = n => NORMAS_BASE.some(b => b.id === n.id);
export const textoFuente = n => { const f = n.fuente || {}; return [f.doc, f.punto && (/^\d/.test(f.punto) ? `pto. ${f.punto}` : f.punto), f.pag && `p. ${f.pag}`].filter(Boolean).join(' · ') || 'Sin fuente'; };

/* Lo que importa del proyecto para elegir qué normas aplican */
export function contextoProyecto(P) {
  const hojas = [P, ...(P.hojas || [])];
  let kwp = 0; try { kwp = (P.tipoHojaPrincipal && P.tipoHojaPrincipal !== 'techo') ? 0 : calcular(P).kwp || 0; } catch (e) { }
  return { tipo: P.tipoHojaPrincipal === 'cargador' ? 'cargador' : 'fv', kwp,
    canales: new Set(hojas.flatMap(h => (h.rutas || []).map(r => r.k))), equipos: new Set(hojas.flatMap(h => (h.equipos || []).map(e => e.k))) };
}
export function aplica(n, ctx) {
  if (n.activa === false) return false;
  if (ctx && n.ambito && n.ambito !== 'todos' && n.ambito !== ctx.tipo) return false;
  const c = n.cond; if (!c || !ctx) return true;
  if (c.kwMin != null && ctx.kwp < c.kwMin) return false;
  if (c.siCanal && !c.siCanal.some(k => ctx.canales.has(k))) return false;
  if (c.siEquipo && !c.siEquipo.some(k => ctx.equipos.has(k))) return false;
  return true;
}
/* Checklist del proyecto: [{ norma, key, ok }] */
export function checklist(P, normas) {
  const ctx = contextoProyecto(P), ok = P.normasOk || {};
  return (normas || []).filter(n => n.tipo === 'checklist' && aplica(n, ctx)).map(n => ({ norma: n, key: 'chk:' + n.id, ok: !!ok['chk:' + n.id] }));
}

/* mm por px de la hoja: la escala real, o la aproximada con que se dibujan los equipos si no tiene */
const mmPx = p => escala(p) || escalaSimbolos(p) / (p.tamSimb || 1);
/* Espacio libre del fabricante para un equipo (mm): el del inversor del proyecto, o el del modelo guardado */
export function libreFabricante(p, e) {
  if (e.k === 'inv') return inversorDe(p).libre || null;
  return (e.modeloDatos && e.modeloDatos.libre) || null;
}

/* Advertencias de la hoja: [{ key, norma, t, id, texto, revisada }]
   ctx = contextoProyecto(proyecto) para filtrar por ámbito (opcional). */
export function revisarNormas(p, normas, ctx) {
  const out = []; if (!normas) return out;
  const ok = p.normasOk || {}, m = v => `${fmt(v, 2)} m`;
  const hayPiso = p.suelo != null, k = mmPx(p) / 1000, alto = y => (p.suelo - y) * k;
  const caja = e => { const Q = tamEquipoPx(p, e); return { x0: e.x - Q.w / 2, x1: e.x + Q.w / 2, y0: e.y - Q.h / 2, y1: e.y + Q.h / 2 }; };
  const nombre = e => e.rotulo || EQUIPOS[e.k]?.n || 'Equipo';
  const push = (n, t, id, texto) => { const key = `${n.id}:${id}`; out.push({ key, norma: n, t, id, texto, revisada: !!ok[key] }); };
  const reales = (p.equipos || []).filter(e => esReal(p, e) && !(EQUIPOS[e.k] || {}).soloRef);
  normas.filter(n => n.tipo !== 'checklist' && aplica(n, ctx)).forEach(n => {
    const deTipo = e => (n.equipos || []).includes(e.k);
    if (['montaje', 'alturaSup', 'alturaInf', 'altCentro'].includes(n.tipo) && hayPiso) reales.filter(deTipo).forEach(e => {
      if (n.ubic && (e.ubic || 'armario') !== n.ubic) return;
      const C = caja(e), arriba = alto(C.y0), abajo = alto(C.y1), centro = alto(e.y), nom = nombre(e); let texto = null;
      if (n.tipo === 'montaje') {
        if (n.min != null && abajo < n.min - 1e-6) texto = `${nom}: el borde inferior queda a ${m(abajo)} del piso (mín. ${m(n.min)})`;
        else if (n.max != null && arriba > n.max + 1e-6) texto = `${nom}: el borde superior queda a ${m(arriba)} del piso (máx. ${m(n.max)})`;
      } else if (n.tipo === 'alturaSup') {
        if (n.max != null && arriba > n.max + 1e-6) texto = `${nom}: la parte de arriba queda a ${m(arriba)} del piso (máx. ${m(n.max)})`;
        else if (n.min != null && arriba < n.min - 1e-6) texto = `${nom}: la parte de arriba queda a ${m(arriba)} del piso (mín. ${m(n.min)})`;
      } else if (n.tipo === 'altCentro') {
        if ((n.min != null && centro < n.min - 1e-6) || (n.max != null && centro > n.max + 1e-6)) texto = `${nom}: su centro (conector) queda a ${m(centro)} del piso (entre ${m(n.min ?? 0)} y ${m(n.max ?? 99)})`;
      } else if (n.min != null && abajo < n.min - 1e-6) texto = `${nom}: queda a ${m(abajo)} del piso (mín. ${m(n.min)}${n.ubic ? `, ${n.ubic}` : ''})`;
      if (texto) push(n, 'equipo', e.id, texto);
    });
    if (n.tipo === 'libre') reales.filter(deTipo).forEach(e => {
      const F = n.fabricante ? libreFabricante(p, e) || {} : {}, lad = Math.max((n.min || 0) * 1000, F.lados || 0), arr = F.arriba || 0, aba = F.abajo || 0;
      const C = caja(e), pk = mmPx(p), Z = { x0: C.x0 - lad / pk, x1: C.x1 + lad / pk, y0: C.y0 - arr / pk, y1: C.y1 + aba / pk }, nom = nombre(e);
      const choca = reales.filter(o => o !== e && !['cdj', 'cp', 'bpc', 'sm'].includes(o.k)).find(o => { const D = caja(o); return D.x0 < Z.x1 - 1e-6 && D.x1 > Z.x0 + 1e-6 && D.y0 < Z.y1 - 1e-6 && D.y1 > Z.y0 + 1e-6; });
      const req = [lad && `${fmt(lad, 0)} mm a los lados`, arr && `${fmt(arr, 0)} mm arriba`, aba && `${fmt(aba, 0)} mm abajo`].filter(Boolean).join(', ');
      if (choca) push(n, 'equipo', e.id, `${nom}: ${nombre(choca)} queda dentro de su espacio libre (${req})`);
      else if (hayPiso && aba && alto(C.y1) * 1000 < aba - 1) push(n, 'equipo', e.id, `${nom}: el fabricante pide ${fmt(aba, 0)} mm libres abajo y quedan ${fmt(alto(C.y1) * 1000, 0)} mm hasta el piso`);
    });
    if (n.tipo === 'canalMin' && hayPiso) (p.rutas || []).forEach(r => {
      const C = CANAL[r.k]; if (!C || C.riel || C.libre || r.aSuelo || r.k === 'sub' || r.k === 'subcc') return;
      if (n.canal && !n.canal.includes(r.k)) return;
      const bajo = Math.min(...r.pts.map(q => alto(q[1])));
      if (n.min != null && bajo < n.min - 1e-6) push(n, 'ruta', r.id, `${C.corto}: pasa a ${m(Math.max(0, bajo))} del suelo (mín. ${m(n.min)}). Si va a suelo, márcalo en la canalización.`);
    });
    if (n.tipo === 'largoMax' && escala(p)) (p.rutas || []).forEach(r => {
      const C = CANAL[r.k]; if (!C || (n.canal && !n.canal.includes(r.k)) || (n.tramo && r.tramo !== n.tramo)) return;
      const L = largoM(p, r.pts); if (n.max != null && L > n.max + 1e-6) push(n, 'ruta', r.id, `${C.corto}: mide ${fmt(L, 1)} m (máx. ${fmt(n.max, 0)} m)`);
    });
  });
  return out;
}
