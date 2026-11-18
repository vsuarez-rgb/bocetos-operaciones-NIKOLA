/* ==========================================================================
   CATÁLOGOS — acá se editan paneles, inversores, equipos, capas y colores.
   Todo lo demás de la app los lee desde este archivo.
   ========================================================================== */

import { PANELES_EMAT, INVERSORES_EMAT, OTROS_EMAT } from './equipos-emat.js';
export { PANELES_EMAT, INVERSORES_EMAT, OTROS_EMAT };

/* Paneles (salen de js/equipos-emat.js). w = ancho y h = largo en mm, con el panel en vertical. */
export const PANELES = PANELES_EMAT.map(x => ({ ...x, id: x.id || x.sku, n: `${x.item.replace(/^\s+/, '')}`, w: x.ancho, h: x.largo }));

/* Inversores (salen de js/equipos-emat.js). vmin/vmax = rango MPPT; vdcMax = tensión máx. de entrada;
   imax = corriente máx. de entrada por MPPT; isc = cortocircuito máx. por MPPT; iac = salida AC. */
export const INVERSORES = INVERSORES_EMAT.map(x => ({ ...x, id: x.id || x.sku, marca: 'Huawei', imax: x.imaxMppt, isc: x.iscMppt, strPorMppt: x.cadenasPorMppt }));

/* Temperatura mínima de diseño (°C) para la Voc en frío. */
export const T_MIN = -5;

/* Zonas que se marcan en el paso Elementos. bloquea = ahí no van paneles. */
export const ZONAS = {
  obs: { n: 'Obstáculo o sombra', corto: 'Obstáculo', d: 'Chimeneas, claraboyas, antenas, sombra de árboles.', bloquea: true, c: '#FF5A5A' },
  nou: { n: 'Zona no utilizable', corto: 'No utilizable', d: 'Filtraciones, estructura inestable u otro motivo.', bloquea: true, c: '#C9A2FF' },
  mov: { n: 'Se retira', corto: 'Se retira', d: 'Objetos que se sacan antes de instalar. Encima sí van paneles.', bloquea: false, c: '#5BC0EB' },
  pas: { n: 'Pasillo de mantención', corto: 'Pasillo', d: 'Franja libre para caminar sobre el techo.', bloquea: true, c: '#FFD166' },
  eqz: { n: 'Zona de equipos', corto: 'Equipos', d: 'Donde van el inversor, tableros o baterías. Ahí no van paneles.', bloquea: true, c: '#FF3DFF' }
};

/* Cada equipo se dibuja de uno de dos modos (e.modo): 'real' = de frente con su medida real (ancho × alto del
   modelo), o 'ref' = símbolo de referencia que solo muestra dónde va y se agranda o achica libremente.
   soloReal: cajas y bandeja (siempre a su medida). soloRef: ubicación propuesta y equipo libre.
   Símbolos de equipos (paso Equipos y canalización). w/h = medida en planta (ancho × prof) en mm,
   por defecto; cada equipo puede elegir un modelo de OTROS_EMAT (equipos-emat.js) con su medida real.
   El inversor toma la medida del modelo elegido en el paso Strings. */
export const EQUIPOS = {
  inv: { n: 'Inversor', l: '', w: 425, h: 150, a: 470, c: '#FF3DFF', huawei: true },
  tg: { n: 'Tablero General', l: 'TG', w: 400, h: 200, a: 500, c: '#FFE14D', frente: 'TABLERO|GENERAL' },
  tfv: { n: 'Tablero FV', l: 'TFV', w: 400, h: 200, a: 500, c: '#FFE14D', frente: 'TABLERO|GENERAL|FOTOVOLTAICO' },
  med: { n: 'Medidor', l: 'M', w: 300, h: 200, a: 400, c: '#35D0FF' },
  bat: { n: 'Batería', l: 'BAT', w: 670, h: 150, a: 360, c: '#FF3DFF', huawei: true },
  dcdc: { n: 'Módulo DC/DC', l: 'DC', w: 670, h: 150, a: 240, c: '#FF3DFF', huawei: true },
  sg: { n: 'SmartGuard', l: 'SG', w: 355, h: 150, a: 485, c: '#FF3DFF', huawei: true },
  sm: { n: 'Smart Power Sensor', l: 'SM', w: 72, h: 80, a: 100, c: '#35D0FF' },
  cdj: { n: 'Caja de derivación', l: 'CD', w: 100, h: 50, a: 100, c: '#FF3DFF', soloReal: true },
  cp: { n: 'Caja de paso', l: '', w: 150, h: 75, a: 150, c: '#00E5FF', soloReal: true },
  ev: { n: 'Cargador EV', l: 'EV', w: 180, h: 145, a: 335, c: '#52C892' },
  bc: { n: 'Bomba de calor', l: 'BC', w: 1000, h: 400, a: 800, c: '#2BB3A3' },
  bpc: { n: 'Bandeja porta conductores', l: '', w: 1500, h: 100, a: 100, c: '#FFE14D', soloReal: true },
  marca: { n: 'Ubicación propuesta', l: '', w: 800, h: 60, a: 800, c: '#FF2B2B', soloRef: true },
  libre: { n: 'Equipo libre (con texto)', l: '', w: 400, h: 200, a: 300, c: '#FFFFFF', libre: true, soloRef: true }
};
/* Modelos que se pueden elegir para cada símbolo (los que tienen medida). */
export const MODELOS_EQUIPO = k => OTROS_EMAT.filter(x => x.k === (k === 'bpc' ? 'bandeja' : k) && x.ancho);

/* Tipos de canalización: colores de la simbología de los planos. */
export const CANAL = {
  cc: { n: 'Línea corriente continua (CC)', corto: 'CC', c: '#3D6BFF', dash: [], cond: 'PV1-F 2x6 mm²', ducto: 'EMT 32 / Flex. Met. 32', dc: true },
  ca: { n: 'Línea corriente alterna (CA)', corto: 'CA', c: '#FFD21F', cPlot: '#D9A800', dash: [], cond: 'RVK 3x8,37 mm²', ducto: 'EMT 32 / Flex. Met. 32' },
  subcc: { n: 'Subterránea en CC', corto: 'Subterránea CC', c: '#FF3B3B', dash: [10, 6], cond: 'PV1-F 2x6 mm²', ducto: 'PVC 32', dc: true },
  sub: { n: 'Subterránea en CA', corto: 'Subterránea CA', c: '#FF3B3B', dash: [], cond: 'RVK 3x8,37 mm²', ducto: 'PVC 32' },
  tie: { n: 'Línea de tierra', corto: 'Tierra', c: '#9DB0BD', dash: [], cond: 'Cu desnudo 16 mm²', ducto: '—' },
  otra: { n: 'Otra línea (color a elección)', corto: 'Línea', c: '#FFFFFF', dash: [], cond: '—', ducto: '—', libre: true },
  perfil: { n: 'Perfil de estructura (losa plana)', corto: 'Perfil', c: '#FF3B3B', dash: [], cond: '—', ducto: '—', riel: true, doble: true },
  riel: { n: 'Riel (dibujo libre)', corto: 'Riel', c: '#FF9E3D', dash: [], cond: '—', ducto: '—', riel: true }
};

/* Colores de strings (como en AutoCAD: cian, magenta, verde, amarillo…). */
export const COLORES_STRING = ['#00E5FF', '#FF3DFF', '#7CFF4D', '#FFE14D', '#FF8A00', '#8FA8FF', '#FF6B9A', '#4DFFC3'];

/* Capas. El orden es el de dibujo (de abajo hacia arriba). */
export const CAPAS = [
  { id: 'foto', n: 'FOTO-DRON', c: '#9DB0BD' },
  { id: 'techos', n: 'TECHOS', c: '#FFFFFF' },
  { id: 'zonas', n: 'ZONAS', c: '#FF5A5A' },
  { id: 'paneles', n: 'PANELES', c: '#2FD06B' },
  { id: 'rieles', n: 'RIELES', c: '#FF9E3D' },
  { id: 'strings', n: 'STRINGS', c: '#00E5FF' },
  { id: 'canal', n: 'CANALIZACION', c: '#3D6BFF' },
  { id: 'equipos', n: 'EQUIPOS', c: '#FF3DFF' },
  { id: 'cotas', n: 'COTAS', c: '#FAB704' },
  { id: 'textos', n: 'TEXTOS', c: '#FFFFFF' }
];

/* Notas que se precargan en la lámina (se pueden editar en el paso Lámina). */
export const NOTAS_BASE = [
  'LOS MATERIALES QUE REQUIEREN CERTIFICACIÓN PARA SU USO, CUMPLEN CON ESTE REQUISITO.',
  'NOMBRE DEL PERFIL DEL INVERSOR: CL.',
  'EL INVERSOR PERMITE MOSTRAR LA CONFIGURACIÓN DE AJUSTES A TRAVÉS DE SU APLICACIÓN.',
  'LA PROTECCIÓN RI INTEGRADA EN EL INVERSOR SE ENCUENTRA CONFIGURADA EN CONFORMIDAD A LA "NORMA TÉCNICA DE CONEXIÓN Y OPERACIÓN DE EQUIPAMIENTO DE GENERACIÓN EN B.T."',
  'EL DISEÑO ELÉCTRICO DEL PROYECTO CUMPLE CON LOS PLIEGOS TÉCNICOS NORMATIVOS RIC, EL PROCEDIMIENTO DE PUESTA EN SERVICIO RGR N°01/2020 Y LA INSTRUCCIÓN TÉCNICA N°02/2020 ASOCIADAS AL NET BILLING.'
];

export const ESTADOS = { pendiente: 'Pendiente', diseno: 'En diseño', revision: 'En revisión', aprobado: 'Aprobado' };
export const GAP_FILA = 20;     // mm entre filas por defecto
export const GAP_COL = 20;      // mm entre columnas
export const SOL_MIN = 30;      // altura mínima del sol para separar filas inclinadas
