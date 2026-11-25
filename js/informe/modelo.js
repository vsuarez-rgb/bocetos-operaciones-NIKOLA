/* ==========================================================================
   Informe: páginas y plantillas de página.

   Una página es { nombre, tamano, orientacion, bloques[] }. Cada bloque tiene
   posición y tamaño en mm (x, y, w, h desde la esquina superior izquierda) y
   un tipo:
     texto     · texto libre; {Campo} se reemplaza por el valor de la ficha
     imagen    · logo, foto o detalle subido (o vacío, para subir después)
     vista     · una hoja de diseño (techo, canalización, equipos…) dibujada
     tabla     · filas y celdas, también con {Campo}
     unilineal · el diagrama unilineal del proyecto
     lamina    · una lámina A1 completa (el "modo plano" de siempre)
     cajetin   · marco, título y cajetín de una lámina (n° de lámina y cuadro resumen salen solos)
     simbologia, notas · las de las láminas
     cuadro    · un cuadro de carga: 'cc', 'ca' o 'caida'
     recuadro  · un marco
   Las plantillas incluidas salen de los informes reales de Ops (Propuesta de
   Diseño y Planos Contratista). Las que arma cada persona se guardan en el
   navegador para reutilizarlas.
   ========================================================================== */
import { uid } from '../util.js';

export const TAMANOS = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], Carta: [216, 279], Oficio: [216, 330] };
export const medida = pg => { const [a, b] = TAMANOS[pg.tamano] || TAMANOS.A4; return pg.orientacion === 'horizontal' ? [b, a] : [a, b]; };
export const TIPOS_BLOQUE = { texto: 'Texto', imagen: 'Imagen', vista: 'Vista de hoja de diseño', tabla: 'Tabla', unilineal: 'Unilineal', lamina: 'Lámina A1 (modo plano)', cajetin: 'Cajetín', simbologia: 'Simbología', notas: 'Notas', cuadro: 'Cuadro de carga', recuadro: 'Recuadro' };

/* Copia una plantilla (o página) con ids nuevos */
export function copiarPagina(pg, extra = {}) {
  const c = JSON.parse(JSON.stringify(pg));
  return { ...c, id: uid('pg'), bloques: (c.bloques || []).map(b => ({ ...b, id: uid('b') })), ...extra };
}
export const nuevoBloque = (tipo, x = 20, y = 20) => ({ id: uid('b'), tipo, x, y, ...DEF_BLOQUE[tipo]() });
const DEF_BLOQUE = {
  texto: () => ({ w: 120, h: 12, texto: 'Texto', tam: 10, alinear: 'izq' }),
  imagen: () => ({ w: 80, h: 55, src: null, ajuste: 'contener' }),
  vista: () => ({ w: 160, h: 100, hoja: 'principal', encuadre: 'dibujo', foto: 70, borde: true }),
  tabla: () => ({ w: 120, h: 40, titulo: 'TÍTULO', filas: [['Campo', '{PROYECTO Nombre}']], tam: 8, anchos: '35' }),
  unilineal: () => ({ w: 160, h: 190, borde: true }),
  lamina: () => ({ w: 297, h: 210, lamina: '01' }),
  cajetin: () => ({ w: 841, h: 594 }),
  simbologia: () => ({ w: 160, h: 62 }),
  notas: () => ({ w: 180, h: 90 }),
  cuadro: () => ({ w: 400, h: 120, cuadro: 'cc' }),
  recuadro: () => ({ w: 80, h: 40, borde: true })
};

/* ---------- Piezas que se repiten en las plantillas ---------- */
const T = (x, y, w, h, texto, o = {}) => ({ tipo: 'texto', x, y, w, h, texto, tam: 10, alinear: 'izq', ...o });
const encabezadoPropuesta = () => [
  { tipo: 'imagen', x: 148, y: 10, w: 48, h: 16, src: 'assets/nikola-logo-oscuro.svg', ajuste: 'contener' },
  T(15, 30, 180, 9, 'Propuesta de Diseño', { tam: 16, negrita: true, alinear: 'centro' }),
  T(15, 40, 180, 11, '{codigo} - {cliente} [{kWp} kWp]\nIng. de Proyecto: {ingeniero}', { tam: 10.5, alinear: 'centro' })
];
const titulo = (y, t) => T(15, y, 180, 6, t, { tam: 11, negrita: true });
const parrafo = (y, h, t) => T(18, y, 177, h, t, { tam: 10.5, justificar: true });
const canalizacion = (x, y, w, h, tam = 7.5) => ({ tipo: 'tabla', x, y, w, h, titulo: 'RESUMEN CANALIZACIÓN', cabecera: true, tam, anchos: '36,32', filas: [
  ['TRAMO', 'CALIBRE CONDUCTOR', 'DIÁMETRO CANALIZACIÓN'],
  ['PANELES – INVERSOR', '{Conductor UG - Inversor Calibre} [mm²]', '{Ducto UG - Inversor Diámetro A (exterior)} [mm]'],
  ['INVERSOR – TGFV', '{Conductor a TFV Calibre fase} [mm²]', '{Ducto Inversor - TFV Diámetro A (exterior)} [mm]'],
  ['TGFV – EMPALME', '{Conductor a EMPALME Calibre fase} [mm²]', '{Ducto TG - Empalme Diámetro A (exterior)} [mm]']] });
const paramPanel = (x, y, w, h) => ({ tipo: 'tabla', x, y, w, h, titulo: 'PARÁMETROS PANEL FOTOVOLTAICO', tam: 5.5, anchos: '28', filas: [
  ['Pmáx.', '{MÓDULO Pmáx} [Wp]'], ['Imp', '{MÓDULO Imp} [A]'], ['Vmp', '{MÓDULO Vmp} [V]'], ['Isc', '{MÓDULO Isc} [A]'], ['Voc', '{MÓDULO Voc} [V]'], ['MARCA', '{MÓDULO Marca}'], ['MODELO', '{MÓDULO Modelo}']], mayusculas: true });
const paramInversor = (x, y, w, h) => ({ tipo: 'tabla', x, y, w, h, titulo: 'PARÁMETROS INVERSOR', tam: 5.5, anchos: '50', filas: [
  ['RANGO DE TENSIÓN MPP', '{INVERSOR A Vmpp} [V]'], ['CORRIENTE MÁXIMA ENTRADA POR MPP', '{INVERSOR A Idc-máx} [A]'], ['CORRIENTE CORTOCIRCUITO', '{INVERSOR A Isc-max} [A]'],
  ['POTENCIA NOMINAL', '{POTENCIA Nominal} [kW]'], ['MARCA', '{INVERSOR A Marca}'], ['MODELO', '{INVERSOR A Modelo}']], mayusculas: true });
const fusionSolar = (x, y, w, h) => ({ tipo: 'tabla', x, y, w, h, titulo: 'EN FUSION SOLAR', tituloColor: 'rojo', tam: 10, anchos: '26', cuerpo: 'normal', filas: [['**Nombre Planta**', '**{PROYECTO Nombre}** **[rojo](EXACTAMENTE IGUAL)**']] });

/* Sección: 'informe' (documentos para el cliente) o 'planos' (láminas y planos para la obra) */
const pagina = (id, grupo, nombre, tamano, orientacion, bloques) => ({ id, grupo, nombre, tamano, orientacion, seccion: grupo === 'Propuesta de diseño' ? 'informe' : 'planos', incluida: true, bloques: bloques.map((b, i) => ({ id: `${id}-${i}`, ...b })) });

export const PLANTILLAS_INCLUIDAS = [
  /* ---------------- Propuesta de Diseño (A4 vertical) ---------------- */
  pagina('prop-general', 'Propuesta de diseño', 'Diagrama general y ubicación de paneles', 'A4', 'vertical', [
    ...encabezadoPropuesta(),
    titulo(60, 'Diagrama general del proyecto'),
    { tipo: 'vista', x: 20, y: 68, w: 170, h: 92, hoja: 'principal', encuadre: 'dibujo', foto: 75, borde: true },
    titulo(167, 'Ubicación de los paneles'),
    parrafo(174, 20, 'Los paneles se instalarán orientados en dirección al norte, según se muestra a continuación, utilizando estructuras que los inclinan en {INSTALACIÓN Inclinación string A.1.1} respecto a la horizontal, de manera de optimizar la producción de su planta.'),
    { tipo: 'vista', x: 20, y: 196, w: 170, h: 92, hoja: 'principal', encuadre: 'foto', foto: 85, borde: true }
  ]),
  pagina('prop-equipos', 'Propuesta de diseño', 'Ubicación de equipos y canalización', 'A4', 'vertical', [
    ...encabezadoPropuesta(),
    titulo(60, 'Ubicación de los equipos'),
    parrafo(67, 12, 'La ubicación idónea para el inversor y el tablero general fotovoltaico corresponde a la señalada a continuación.'),
    { tipo: 'vista', x: 35, y: 81, w: 140, h: 86, hoja: 'tipo:equipos', encuadre: 'foto', foto: 100, borde: true },
    titulo(174, 'Ruta y tipo de canalización'),
    parrafo(181, 18, 'La canalización será realizada con tuberías metálicas EMT y flexibles metálicos. En color azul se detallan las canalizaciones de corriente continua (CC), en amarillo las de corriente alterna (CA) y en rojo las canalizaciones subterráneas en CA.'),
    { tipo: 'vista', x: 15, y: 202, w: 87, h: 88, hoja: 'tipo:canalizacion#1', encuadre: 'dibujo', foto: 100, borde: true },
    { tipo: 'vista', x: 108, y: 202, w: 87, h: 88, hoja: 'tipo:canalizacion#2', encuadre: 'dibujo', foto: 100, borde: true }
  ]),
  pagina('prop-montaje', 'Propuesta de diseño', 'Montaje y tipo de anclaje', 'A4', 'vertical', [
    ...encabezadoPropuesta(),
    titulo(66, 'Montaje'),
    parrafo(73, 14, 'Los paneles serán fijados sobre la cubierta del techo con piezas de anclaje de aluminio, que se instalarán perforadas con el debido sellante de poliuretano.'),
    { tipo: 'imagen', x: 15, y: 92, w: 115, h: 68, src: null, ajuste: 'contener', borde: true, ayuda: 'Esquema de montaje' },
    { tipo: 'imagen', x: 138, y: 92, w: 57, h: 68, src: null, ajuste: 'cubrir', borde: true, ayuda: 'Foto del inversor' },
    titulo(168, 'Tipo de anclaje'),
    parrafo(175, 7, 'El anclaje a utilizar es el siguiente:'),
    { tipo: 'imagen', x: 55, y: 184, w: 100, h: 64, src: null, ajuste: 'contener', borde: true, ayuda: 'Detalle del anclaje' },
    T(18, 254, 177, 30, '• **Trabajos extra necesarios:** No se prevén trabajos extras necesarios.\n• **Trabajos a realizar por el cliente:** No se requiere.\n• **Tiempo estimado de obras civiles:** 5 días hábiles.', { tam: 10.5 })
  ]),

  /* ---------------- Planos Contratista (A4 horizontal) ---------------- */
  pagina('con-resumen', 'Planos contratista', 'Resumen de obra', 'A4', 'horizontal', [
    { tipo: 'tabla', x: 70, y: 12, w: 160, h: 92, titulo: 'RESUMEN OBRA', tam: 10.5, anchos: '25', mayusculas: true, filas: [
      ['Nombre proyecto', '{PROYECTO Nombre}'], ['Dirección', '{DIRECCIÓN Calle} {DIRECCIÓN Número}, {COMUNA}'], ['Propietario', '{PROPIETARIA/O Nombre}'],
      ['Paneles', '{Módulos totales} x {MÓDULO Marca} {MÓDULO Modelo}'], ['Inversor', '{INVERSOR A Marca} {INVERSOR A Modelo}'], ['Ppeak', '{POTENCIA Peak}']] },
    { tipo: 'tabla', x: 14, y: 112, w: 136, h: 52, titulo: 'DISTANCIAS', tam: 10, anchos: '45', mayusculas: true, filas: [
      ['Planta FV – Inversor', '{Conductor UG - Inversor A Distancia} metros'], ['Inversor – TGFV', '{Conductor Inversor - TFV Distancia} metros'], ['TGFV – Empalme', '{Conductor TG - Empalme Distancia} metros']] },
    canalizacion(155, 112, 128, 52, 8.5),
    fusionSolar(14, 176, 269, 22)
  ]),
  pagina('con-planta', 'Planos contratista', 'Planta general', 'A4', 'horizontal', [
    canalizacion(8, 8, 92, 34),
    { tipo: 'vista', x: 104, y: 8, w: 186, h: 42, hoja: 'principal', encuadre: 'dibujo', foto: 100, borde: true },
    { tipo: 'vista', x: 50, y: 56, w: 240, h: 147, hoja: 'principal', encuadre: 'foto', foto: 100, borde: true },
    paramPanel(6, 136, 42, 32), paramInversor(6, 172, 42, 31)
  ]),
  pagina('con-canalizacion', 'Planos contratista', 'Canalización y detalles', 'A4', 'horizontal', [
    canalizacion(8, 6, 88, 32),
    { tipo: 'imagen', x: 12, y: 44, w: 84, h: 84, src: null, ajuste: 'contener', borde: true, ayuda: 'Detalle de anclaje' },
    T(48, 136, 50, 66, '**INFORMACIÓN IMPORTANTE**\n\nEscribe aquí las indicaciones para el contratista (materiales, perforaciones, terminaciones…).', { tam: 7.5 }),
    paramPanel(6, 136, 40, 30), paramInversor(6, 170, 40, 30),
    { tipo: 'vista', x: 101, y: 6, w: 190, h: 122, hoja: 'principal', encuadre: 'foto', foto: 100, borde: true },
    { tipo: 'vista', x: 101, y: 132, w: 61, h: 72, hoja: 'tipo:equipos', encuadre: 'foto', foto: 100, borde: true },
    { tipo: 'vista', x: 166, y: 132, w: 61, h: 72, hoja: 'tipo:canalizacion#1', encuadre: 'foto', foto: 100, borde: true },
    { tipo: 'vista', x: 231, y: 132, w: 60, h: 72, hoja: 'tipo:canalizacion#2', encuadre: 'dibujo', foto: 100, borde: true }
  ]),
  pagina('con-unilineal', 'Planos contratista', 'Unilineal y tablero', 'A4', 'horizontal', [
    canalizacion(8, 6, 107, 40, 8.5),
    { tipo: 'imagen', x: 12, y: 54, w: 100, h: 104, src: null, ajuste: 'contener', borde: true, ayuda: 'Layout del tablero ({TG Dimensiones})' },
    paramPanel(8, 164, 52, 40), paramInversor(62, 164, 53, 40),
    { tipo: 'unilineal', x: 120, y: 6, w: 171, h: 198, borde: true }
  ]),
  pagina('con-comisionado', 'Planos contratista', 'Comisionado en Fusion Solar', 'A4', 'horizontal', [
    T(20, 10, 257, 9, 'Comisionado de los Equipos', { tam: 14, negrita: true, alinear: 'centro' }),
    { tipo: 'tabla', x: 20, y: 22, w: 257, h: 178, titulo: 'EN FUSION SOLAR', tituloColor: 'rojo', tam: 10, anchos: '22', cuerpo: 'normal', filas: [
      ['**Nombre Planta**', '**{PROYECTO Nombre}** **[rojo](EXACTAMENTE IGUAL)**'],
      ['**Ajustes Rápidos**', 'Seleccionar Zona Horaria de Santiago'],
      ['**Configuración Planta**', 'La planta debe quedar configurada para "LIMITACIÓN DE EXPORTACIÓN CERO":\n\n1. Desde el inicio de la APP de Fusion Solar (fuera del asistente de configuración) seleccionar la planta que se desea limitar.\n\n2. Abajo, presionar "dispositivos".\n\n3. Seleccionar el inversor (en caso de que exista dongle o SmartGuard, seleccionar estos últimos).\n\n4. Presionar los 4 puntos de la esquina superior derecha.\n\n5. Seleccionar ajustes de parámetros.\n\n6. En "Modo de control de potencia activa" elegir la opción "Limitación de exportación cero".\n\nEn plantas con SmartGuard, se debe grabar una prueba de conmutación y enviarla a la plataforma de registro fotográfico de Nikola.\n\nTodos los equipos deben quedar actualizados.']] }
  ]),

  /* ---------------- Juego de láminas A1 con cajetín (como los planos de Ops, ON 901) ----------------
     El cajetín llena la hoja (marco, título y franja de abajo); lo demás se mueve libre dentro del marco. */
  pagina('lam-planta', 'Láminas A1', 'Planta general en terreno', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594 },
    { tipo: 'vista', x: 16, y: 32, w: 520, h: 330, hoja: 'principal', encuadre: 'dibujo', foto: 80, borde: true },
    { tipo: 'vista', x: 546, y: 32, w: 285, h: 330, hoja: 'tipo:canalizacion#1', encuadre: 'foto', foto: 100, borde: true },
    { tipo: 'notas', x: 16, y: 370, w: 300, h: 100 },
    { tipo: 'simbologia', x: 660, y: 404, w: 160, h: 62 }
  ]),
  pagina('lam-unilineal', 'Láminas A1', 'Diagrama unilineal', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594, int: true, escala: 'NO A ESCALA' },
    { tipo: 'simbologia', x: 16, y: 32, w: 160, h: 62 },
    { tipo: 'unilineal', x: 190, y: 28, w: 640, h: 446 },
    { tipo: 'notas', x: 16, y: 300, w: 168, h: 170 }
  ]),
  // Proyectos grandes: el unilineal en dos láminas, como el estándar «unilineal AC / DC nuevo»
  pagina('lam-uni-ac', 'Láminas A1', 'Diagrama unilineal AC', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594, int: true, escala: 'NO A ESCALA' },
    { tipo: 'simbologia', x: 16, y: 32, w: 160, h: 62 },
    { tipo: 'unilineal', x: 190, y: 28, w: 640, h: 446, parte: 'ac' },
    { tipo: 'notas', x: 16, y: 300, w: 168, h: 170 }
  ]),
  pagina('lam-uni-dc', 'Láminas A1', 'Diagrama unilineal DC', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594, escala: 'NO A ESCALA' },
    { tipo: 'simbologia', x: 16, y: 32, w: 160, h: 62 },
    { tipo: 'unilineal', x: 190, y: 28, w: 640, h: 446, parte: 'dc' },
    { tipo: 'notas', x: 16, y: 300, w: 168, h: 170 }
  ]),
  pagina('lam-cc', 'Láminas A1', 'Cuadro de generación CC', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594, escala: 'NO A ESCALA' },
    { tipo: 'cuadro', x: 16, y: 40, w: 809, h: 260, cuadro: 'cc' },
    { tipo: 'notas', x: 16, y: 330, w: 400, h: 140 }
  ]),
  pagina('lam-ca', 'Láminas A1', 'Cuadro de generación CA', 'A1', 'horizontal', [
    { tipo: 'cajetin', x: 0, y: 0, w: 841, h: 594, escala: 'NO A ESCALA' },
    { tipo: 'cuadro', x: 40, y: 40, w: 760, h: 130, cuadro: 'ca' },
    { tipo: 'cuadro', x: 70, y: 190, w: 700, h: 120, cuadro: 'caida' },
    { tipo: 'notas', x: 16, y: 330, w: 400, h: 140 }
  ]),

  /* ---------------- Modo plano: láminas A1 de siempre ---------------- */
  pagina('a1-planta', 'Láminas A1 (modo plano)', 'Lámina 01 · Planta y unilineal', 'A1', 'horizontal', [{ tipo: 'lamina', x: 0, y: 0, w: 841, h: 594, lamina: '01' }]),
  pagina('a1-cuadros', 'Láminas A1 (modo plano)', 'Lámina 02 · Cuadros de carga', 'A1', 'horizontal', [{ tipo: 'lamina', x: 0, y: 0, w: 841, h: 594, lamina: '02' }])
];

/* Informes completos (conjuntos de páginas) */
export const PAQUETES = [
  { id: 'propuesta', seccion: 'informe', nombre: 'Propuesta de diseño', detalle: 'A4 vertical · 3 páginas para el cliente', paginas: ['prop-general', 'prop-equipos', 'prop-montaje'] },
  { id: 'contratista', seccion: 'planos', nombre: 'Planos contratista', detalle: 'A4 horizontal · 5 páginas para la obra', paginas: ['con-resumen', 'con-planta', 'con-canalizacion', 'con-unilineal', 'con-comisionado'] },
  { id: 'laminas4', seccion: 'planos', nombre: 'Juego de láminas A1', detalle: 'Con cajetín, como los planos de Ops · planta, unilineal, cuadro CC y CA', paginas: ['lam-planta', 'lam-unilineal', 'lam-cc', 'lam-ca'] },
  { id: 'laminas', seccion: 'planos', nombre: 'Láminas A1 (modo plano antiguo)', detalle: 'Planta y unilineal + cuadros de carga', paginas: ['a1-planta', 'a1-cuadros'] }
];
export const paginaEnBlanco = (tamano = 'A4', orientacion = 'vertical', seccion = 'informe') => ({ id: uid('pg'), nombre: 'Página en blanco', tamano, orientacion, seccion, bloques: [] });
export const SECCIONES = { informe: 'Informe', planos: 'Láminas y planos' };
export const seccionDe = pg => pg.seccion || ((pg.bloques || []).some(b => b.tipo === 'lamina') || ['A1', 'A2'].includes(pg.tamano) ? 'planos' : 'informe');
/* Bloques fijos: no se mueven ni cambian de tamaño con el mouse (la lámina A1 que llena la página lo es por defecto) */
export const esFijo = b => b.fijo ?? ['lamina', 'cajetin'].includes(b.tipo);
