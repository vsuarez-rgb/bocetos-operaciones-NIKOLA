/* ==========================================================================
   EQUIPOS EMAT — base de equipos que usa Nikola, con medidas de ficha técnica.
   Origen de los nombres, SKU y datos eléctricos: hoja "Backend" del
   "Asistente de Cubicación - con EMAT V1.xlsm". Medidas físicas: fichas
   técnicas oficiales (Jinko, Trina, Huawei), revisadas el 17-11-2026.
   Medidas en mm. Para equipos de muro: ancho × alto × prof (prof = lo que
   sobresale del muro). En el plano de techumbre (vista desde arriba) se
   dibuja ancho × prof.
   confianza: "alta" = ficha oficial coincide; "media" = ficha con dudas
   de orden de ejes o versión; "baja" = dato de tienda/distribuidor.
   Para agregar un equipo: copia una fila y completa los datos de la ficha.
   ========================================================================== */

/* ---------- Paneles ----------
   largo = lado largo, ancho = lado corto (panel en vertical: ancho × largo). */
export const PANELES_EMAT = [
  { sku: 'A02309000L006', id: 'jk730', item: 'Jinko, Panel fotovoltaico bifacial 730Wp', corto: '730 W', marca: 'JINKOSOLAR', modelo: 'TIGER NEO JKM730N-66HL5-BDV', tipo: 'Monocristalina Bifacial', linea: 'Industrial', estetica: 'Estándar',
    wp: 730, voc: 49.36, isc: 18.81, vmp: 41.11, imp: 17.76, coefVoc: -0.25, vSistema: 1500, largo: 2384, ancho: 1303, espesor: 33, peso: 37.5, confianza: 'alta',
    fuente: 'https://www.vpsolar.com/download/catalog/Moduli/Jinko-Solar/Datasheet_Jinko_JKMxxxN-66HL5-BDV-710-735-Wp_EN.pdf' },
  { sku: 'A02309000L003', item: 'Trina Solar 720 W', corto: '720 W', marca: 'TRINA SOLAR', modelo: 'VERTEX N TSM-720NEG21C.20', tipo: 'Monocristalina Bifacial', linea: 'Industrial', estetica: 'Estándar',
    wp: 720, voc: 49.4, isc: 18.49, vmp: 41.3, imp: 17.44, coefVoc: -0.24, vSistema: 1500, largo: 2384, ancho: 1303, espesor: 33, peso: 38.3, confianza: 'media',
    nota: 'Es bifacial aunque el nombre EMAT no lo dice. Verificar Imp en la ficha.',
    fuente: 'https://www-cdn.trinasolar.com/wwwstorage/sites/17/DT-M-0085-Datasheet_VertexN_TSM-NEG21C.20_695-725W_2025_C.pdf' },
  { sku: 'A04209000L012', item: 'Trina Solar 710 W Bifacial', corto: '710 W', marca: 'TRINA SOLAR', modelo: 'VERTEX N TSM-710NEG21C.20', tipo: 'Monocristalina Bifacial', linea: 'Industrial', estetica: 'Estándar',
    wp: 710, voc: 49.0, isc: 18.4, vmp: 40.9, imp: 17.36, coefVoc: -0.24, vSistema: 1500, largo: 2384, ancho: 1303, espesor: 33, peso: 38.3, confianza: 'alta',
    fuente: 'https://www-cdn.trinasolar.com/wwwstorage/sites/17/DT-M-0085-Datasheet_VertexN_TSM-NEG21C.20_695-725W_2025_C.pdf' },
  { sku: 'A02309000L004', item: 'Jinko Solar 590 W Bifacial', corto: '590 W', marca: 'JINKOSOLAR', modelo: 'TIGER NEO JKM590N-72HL4-BDV', tipo: 'Monocristalina Bifacial', linea: 'Residencial', estetica: 'Estándar',
    wp: 590, voc: 52.9, isc: 14.07, vmp: 44.17, imp: 13.36, coefVoc: -0.25, vSistema: 1500, largo: 2278, ancho: 1134, espesor: 30, peso: 31.0, confianza: 'alta',
    fuente: 'https://www.vicoexport.com/wp-content/uploads/2024/04/EU-JKM570-590N-72HL4-BDV-F8-EN_Vico_Export_Solar_Energy.pdf' },
  { sku: 'A02309000L001', item: 'Jinko Solar 585 W', corto: '585 W', marca: 'JINKOSOLAR', modelo: 'TIGER NEO JKM585N-72HL4-V', tipo: 'Monocristalina', linea: 'Residencial', estetica: 'Estándar',
    wp: 585, voc: 51.16, isc: 14.55, vmp: 42.52, imp: 13.76, coefVoc: -0.25, vSistema: 1500, largo: 2278, ancho: 1134, espesor: 35, peso: 28.0, confianza: 'alta',
    nota: 'Marco de 35 mm en la ficha F4; lotes nuevos traen 30 mm.',
    fuente: 'https://solarproof.com.au/datasheets/panel_datasheet_JKM565-585N-72HL4-(V)-F4-EN.pdf' },
  { sku: 'A02309000L002', item: 'Jinko Solar 445 (Black)', corto: '445 W Black', marca: 'JINKOSOLAR', modelo: 'TIGER NEO JKM445N-54HL4R-B', tipo: 'Monocristalina Full Black', linea: 'Residencial', estetica: 'Black',
    wp: 445, voc: 39.77, isc: 13.87, vmp: 33.19, imp: 13.41, coefVoc: -0.25, vSistema: 1000, largo: 1762, ancho: 1134, espesor: 30, peso: 21.0, confianza: 'alta',
    fuente: 'https://www.jinkosolar.com/uploads/664b0f09/JKM430-455N-54HL4R-B-F8-EN.pdf' }
];

/* ---------- Inversores Huawei ----------
   mppt / cadenasPorMppt / dif / vdcMax / vmin / vmax / iscMppt / kw: Backend EMAT.
   imaxMppt: corriente máx. de entrada por MPPT (ficha; null si no se confirmó).
   iac: corriente máx. de salida AC (a 380 V en trifásicos). Medidas con placa de montaje.
   libre: espacio libre de montaje (mm) — pendiente de leer en el manual de cada familia. */
const L1 = { familia: 'SUN2000-KTL-L1', ancho: 365, alto: 365, prof: 156, peso: 12, imaxMppt: 12.5, fuente: 'https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs', confianza: 'alta', nota: 'Alto 365 mm según la ficha técnica (el folleto dice 375)' };
const LB0 = { familia: 'SUN2000-K-LB0', ancho: 425, alto: 376.5, prof: 150, peso: 15, imaxMppt: 16, fuente: 'https://solar.huawei.com/en/products/sun2000-3-368-4-46-5-6k-lb0/specs/', confianza: 'media' };
const LC0 = { familia: 'SUN2000-K-LC0', ancho: 425, alto: 376.5, prof: 150, peso: 14.5, imaxMppt: 16, fuente: 'https://solar.huawei.com/admin/asset/v1/pro/view/ada802421c674daa9047aeec9d28a710.pdf', confianza: 'alta' };
const M1 = { familia: 'SUN2000-KTL-M1', ancho: 525, alto: 470, prof: 146.5, peso: 17, imaxMppt: 11, fuente: 'https://solar.huawei.com/th/products/SUN2000-3-4-5-6-8-10KTL-M1/specs/', confianza: 'alta' };
const MAP0 = { familia: 'SUN2000-K-MAP0', ancho: 490, alto: 460, prof: 130, peso: 21, imaxMppt: null, fuente: 'https://solar.huawei.com/pk/products/sun2000-5-12k-map0/specs', confianza: 'media' };
const MB0 = { familia: 'SUN2000-K-MB0', ancho: 546, alto: 460, prof: 228, peso: 21, imaxMppt: null, fuente: 'https://solar.huawei.com/en/professionals/all-products/SUN2000-12-15-17-20-25K-MB0/specs', confianza: 'alta' };
const M3 = { familia: 'SUN2000-KTL-M3', ancho: 640, alto: 530, prof: 270, peso: 43, imaxMppt: null, fuente: 'https://www.photomate.eu/photomate-download/223', confianza: 'alta' };
const mono = { fase: 'Monofásico', vac: 220, vdcMax: 600 }, tri = { fase: 'Trifásico', vac: 380, vdcMax: 1100 };
const DIF = {
  m25: 'Interruptor Diferencial 2x25A 100mA Tipo A', m40: 'Interruptor Diferencial 2x40A 100mA Tipo A', m63: 'Legrand INT.DIF. INMUNIZADO 2x63A 300mA Tipo A',
  t25: 'Interruptor Diferencial 4x25A 30mA Tipo A', t40: 'Interruptor diferencial 4P 40A 300mA clase A', t63: 'Interruptor diferencial 4P 63A 300mA clase A'
};
export const INVERSORES_EMAT = [
  { sku: 'A02008004L006', modelo: 'SUN2000-2KTL-L1', kw: 2, ...mono, ...L1, mppt: 2, cadenasPorMppt: 1, vmin: 90, vmax: 560, iscMppt: 18, iac: 10, dif: DIF.m25 },
  { sku: 'A02008004L007', modelo: 'SUN2000-3KTL-L1', kw: 3, ...mono, ...L1, mppt: 2, cadenasPorMppt: 1, vmin: 90, vmax: 560, iscMppt: 18, iac: 15, dif: DIF.m25 },
  { sku: 'A02008004L008', modelo: 'SUN2000-4KTL-L1', kw: 4, ...mono, ...L1, mppt: 2, cadenasPorMppt: 1, vmin: 90, vmax: 560, iscMppt: 18, iac: 20, dif: DIF.m25 },
  { sku: 'A02008010L024', modelo: 'SUN2000-4K-LB0', kw: 4, ...mono, ...LB0, mppt: 2, cadenasPorMppt: 1, vmin: 40, vmax: 560, iscMppt: 20, iac: 20, dif: DIF.m25 },
  { sku: 'A02008004L009', modelo: 'SUN2000-5KTL-L1', kw: 5, ...mono, ...L1, mppt: 2, cadenasPorMppt: 1, vmin: 90, vmax: 560, iscMppt: 18, iac: 25, dif: DIF.m25 },
  { sku: 'A02008010L025', modelo: 'SUN2000-5K-LB0', kw: 5, ...mono, ...LB0, mppt: 2, cadenasPorMppt: 1, vmin: 40, vmax: 560, iscMppt: 20, iac: 25, dif: DIF.m40 },
  { sku: 'A02008004L010', modelo: 'SUN2000-6KTL-L1', kw: 6, ...mono, ...L1, mppt: 2, cadenasPorMppt: 1, vmin: 90, vmax: 560, iscMppt: 18, iac: 27.3, dif: DIF.m40 },
  { sku: 'A02008010L026', modelo: 'SUN2000-6K-LB0', kw: 6, ...mono, ...LB0, mppt: 2, cadenasPorMppt: 1, vmin: 40, vmax: 560, iscMppt: 20, iac: 30, dif: DIF.m40 },
  { sku: 'A02008004L011', id: 'hw8k', modelo: 'SUN2000-8K-LC0', kw: 8, ...mono, ...LC0, mppt: 3, cadenasPorMppt: 1, vmin: 40, vmax: 560, iscMppt: 20, iac: 40, dif: DIF.m40, nota: 'En EMAT figura como SUN2000-8KTL-LC0' },
  { sku: 'A02008004L005', modelo: 'SUN2000-10K-LC0', kw: 10, ...mono, ...LC0, peso: 15, mppt: 3, cadenasPorMppt: 1, vmin: 40, vmax: 560, iscMppt: 20, iac: 45.5, dif: DIF.m63, nota: 'En EMAT figura como SUN2000-10KTL-LC0' },
  { sku: 'A02008004L013', modelo: 'SUN2000-5KTL-M1', kw: 5, ...tri, ...M1, mppt: 2, cadenasPorMppt: 1, vmin: 140, vmax: 980, iscMppt: 19.5, iac: 8.5, dif: DIF.t25 },
  { sku: 'A02008004L003', modelo: 'SUN2000-6KTL-M1', kw: 6, ...tri, ...M1, mppt: 2, cadenasPorMppt: 1, vmin: 140, vmax: 980, iscMppt: 19.5, iac: 10.1, dif: DIF.t25 },
  { sku: 'A02008004L004', modelo: 'SUN2000-8KTL-M1', kw: 8, ...tri, ...M1, mppt: 2, cadenasPorMppt: 1, vmin: 140, vmax: 980, iscMppt: 19.5, iac: 13.5, dif: DIF.t25 },
  { sku: 'A02008004L001', id: 'hw10kt', modelo: 'SUN2000-10KTL-M1', kw: 10, ...tri, ...M1, mppt: 2, cadenasPorMppt: 1, vmin: 140, vmax: 980, iscMppt: 19.5, iac: 16.9, dif: DIF.t40 },
  { sku: 'A02008010L017', modelo: 'SUN2000-6K-MAP0', kw: 6, ...tri, ...MAP0, mppt: 2, cadenasPorMppt: 1, vmin: 160, vmax: 1000, iscMppt: 22, iac: 10.0, dif: DIF.t40 },
  { sku: 'A02008004L016', modelo: 'SUN2000-8K-MAP0', kw: 8, ...tri, ...MAP0, mppt: 2, cadenasPorMppt: 1, vmin: 160, vmax: 1000, iscMppt: 22, iac: 13.3, dif: DIF.t40 },
  { sku: 'A02008004L017', modelo: 'SUN2000-10K-MAP0', kw: 10, ...tri, ...MAP0, mppt: 2, cadenasPorMppt: 1, vmin: 160, vmax: 1000, iscMppt: 22, iac: 16.7, dif: DIF.t40 },
  { sku: 'A02008010L018', modelo: 'SUN2000-12K-MAP0', kw: 12, ...tri, ...MAP0, mppt: 2, cadenasPorMppt: 1, vmin: 160, vmax: 1000, iscMppt: 22, iac: 20.2, dif: DIF.t40 },
  { sku: 'A02008010L019', modelo: 'SUN2000-15K-MB0', kw: 15, ...tri, ...MB0, mppt: 2, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 25.2, dif: DIF.t40 },
  { sku: 'A02008010L020', modelo: 'SUN2000-20K-MB0', kw: 20, ...tri, ...MB0, mppt: 2, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 33.6, dif: DIF.t40 },
  { sku: 'A02008010L021', modelo: 'SUN2000-25K-MB0', kw: 25, ...tri, ...MB0, mppt: 2, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 42.0, dif: DIF.t40 },
  { sku: 'A02008010L013', modelo: 'SUN2000-30KTL-M3', kw: 30, ...tri, ...M3, mppt: 4, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 47.9, dif: DIF.t63 },
  { sku: 'A02008010L014', modelo: 'SUN2000-36KTL-M3', kw: 36, ...tri, ...M3, mppt: 4, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 58.0, dif: DIF.t63 },
  { sku: 'A02008010L004', modelo: 'SUN2000-40KTL-M3', kw: 40, ...tri, ...M3, mppt: 4, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 63.8, dif: DIF.t63 },
  { sku: 'A02008010L005', modelo: 'SUN2000-50KTL-M3', kw: 50, ...tri, ...M3, peso: 49, mppt: 4, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 79.8, dif: null, fuente: 'https://solar.huawei.com/admin/asset/v1/pro/view/4b99f6268ac4441b8e9286f26a186833.pdf', nota: 'Iac a 400 V. EMAT no define diferencial.' },
  { sku: 'A02008010L002', modelo: 'SUN2000-100KTL-M2', kw: 100, ...tri, familia: 'SUN2000-KTL-M2', ancho: 1035, alto: 700, prof: 365, peso: 93, imaxMppt: null, mppt: 10, cadenasPorMppt: 2, vmin: 200, vmax: 1000, iscMppt: 40, iac: 160.4, dif: null,
    libre: { abajo: 600 }, confianza: 'alta', fuente: 'https://cdn.shopify.com/s/files/1/0549/8073/9127/files/EN_Sheet_100KTL-M2.pdf', nota: 'Iac a 400 V. Dejar 600–730 mm libres por debajo.' },
  { sku: 'A02008010L016', modelo: 'SUN2000-150K-MG0', kw: 150, ...tri, familia: 'SUN2000-K-MG0', ancho: 1000, alto: 710, prof: 395, peso: 96, imaxMppt: null, mppt: 7, cadenasPorMppt: 3, vmin: 200, vmax: 1000, iscMppt: 66, iac: 253.2, dif: null,
    confianza: 'alta', fuente: 'https://solar.huawei.com/za/products/sun2000-150k-mg0/specs' }
];

/* ---------- Otros equipos (los que se dibujan en el paso Equipos) ----------
   k = tipo de símbolo en la app (ver EQUIPOS en catalogo.js). */
export const OTROS_EMAT = [
  // Baterías: la torre se arma con módulo de potencia arriba + n módulos de batería + base de piso.
  { k: 'bat', sku: 'A02001001L006', item: 'Huawei, Batería LUNA2000 5kWh', modelo: 'LUNA2000-5-E0 (serie S0)', ancho: 670, alto: 360, prof: 150, peso: 50, montaje: 'piso',
    torre: { 1: 600, 2: 960, 3: 1320 }, confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/LUNA2000-5-10-15-S0/specs/', nota: 'Torre = 240 (potencia) + 360 × n baterías, con base.' },
  { k: 'bat', sku: 'A02001001L011', item: 'Huawei, Batería LUNA2000 7kWh', modelo: 'LUNA2000-7-E1 (serie S1)', ancho: 590, alto: 360, prof: 255, peso: 68, montaje: 'piso',
    torre: { 1: 510, 2: 870, 3: 1230 }, confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/LUNA2000-7-14-21-S1/specs/', nota: 'No se mezcla con S0. Torre = 150 (potencia) + 360 × n.' },
  { k: 'dcdc', sku: 'A02001001L007', item: 'Huawei, Módulo DC/DC 5kW', modelo: 'LUNA2000-5KW-C0', ancho: 670, alto: 240, prof: 150, peso: 12, montaje: 'torre', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/LUNA2000-5-10-15-S0/specs/' },
  { k: 'dcdc', sku: 'A02001001L010', item: 'Huawei, Módulo DC/DC 10kW', modelo: 'LUNA2000-10KW-C1', ancho: 590, alto: 150, prof: 255, peso: 10, montaje: 'torre', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/LUNA2000-7-14-21-S1/specs/' },
  { k: 'bat', sku: 'A02001001L002', item: 'Huawei, LUNA2000 Wall Bracket 5kWh', modelo: 'Wall Mounting Bracket S0 (21155238)', ancho: 580, alto: 185, prof: 50, peso: 6.66, montaje: 'muro', confianza: 'baja', fuente: 'https://www.solaranlage-tipps.de/solar-zubehoer/luna2000-wall-mount.md', nota: 'Medida de tienda. Para dibujar usar el contorno de la torre S0.' },
  { k: 'bat', sku: 'A02001001L012', item: 'Huawei, LUNA2000 Wall Bracket 7kWh', modelo: 'Wall Mounting Bracket S1 (21156376)', ancho: null, alto: null, prof: null, peso: null, montaje: 'muro', confianza: 'baja', fuente: 'https://shop.krannich-solar.com/en-de/LUNA2000-S1-Wall-Mounting-Bracket/0156949', nota: 'Sin medidas publicadas. Usar el contorno de la torre S1.' },
  // Cargadores EV
  { k: 'ev', sku: 'A02005000L001', item: 'Huawei, SCharger-7KS-S0', modelo: 'SCharger-7KS-S0 (7,4 kW, 1F)', ancho: 180, alto: 335, prof: 145, peso: 3.0, montaje: 'muro', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/SCharger-7KS-S0-22KT-S0/specs/' },
  { k: 'ev', sku: 'A02005000L002', item: 'Huawei, SCharger-22KT-S0', modelo: 'SCharger-22KT-S0 (22 kW, 3F)', ancho: 180, alto: 335, prof: 145, peso: 3.1, montaje: 'muro', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/SCharger-7KS-S0-22KT-S0/specs/' },
  // SmartGuard (respaldo)
  { k: 'sg', sku: 'A02008004L015', item: 'Huawei, SmartGuard-63A-S0', modelo: 'SmartGuard-63A-S0 (1F)', ancho: 355, alto: 485, prof: 150, peso: 14, montaje: 'muro', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/HUAWEI-SmartGuard/specs/' },
  { k: 'sg', sku: 'A02008006L002', item: 'Huawei, SmartGuard-63A T0', modelo: 'SmartGuard-63A-T0 (3F)', ancho: 490, alto: 600, prof: 170, peso: 17, montaje: 'muro', confianza: 'alta', fuente: 'https://solar.huawei.com/ch/products/HUAWEI-SmartGuard-63A-T0-AUT0/specs/' },
  // Medidores (van dentro del tablero, en riel DIN)
  { k: 'sm', sku: 'A02008008L007', item: 'Huawei, Smart Power Sensor Monofásico, 100A', modelo: 'SmartPS-100A-S0 (DDSU666-H / DDSU71)', ancho: 36, alto: 100, prof: 66, peso: 0.2, montaje: 'riel DIN', modulosDin: 2, confianza: 'alta', fuente: 'https://solar.huawei.com/admin/asset/v1/pro/view/0965d912ee1b48c0ad60da1f7452b73b.pdf' },
  { k: 'sm', sku: 'A02008006L001', item: 'Huawei, Smart Power Sensor Trifásico, 250A', modelo: 'SmartPS-250A-T0 (DTSU666-H 250A/50mA)', ancho: 72, alto: 100, prof: 80, peso: 1.5, montaje: 'riel DIN', modulosDin: 4, confianza: 'alta', fuente: 'https://solar.huawei.com/admin/asset/v1/pro/view/0965d912ee1b48c0ad60da1f7452b73b.pdf' },
  // Dongles (van enchufados al inversor; no se dibujan aparte)
  { k: null, sku: 'A02008008L003', item: 'Huawei, Smart Dongle WLAN-FE', modelo: 'SDongleA-05', ancho: 146, alto: 48, prof: 33, peso: 0.09, montaje: 'inversor', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/CI-SmartDongle-WLAN-FE/specs/' },
  { k: null, sku: 'A02008008L001', item: 'Huawei, Smart Dongle 4G', modelo: 'SDongleB-06', ancho: 162, alto: 48, prof: 28, peso: null, montaje: 'inversor', confianza: 'alta', fuente: 'https://solar.huawei.com/en/products/SmartDongle-4G/specs' },
  // Optimizador (va bajo el panel)
  { k: null, sku: 'A00008001L001', item: 'Huawei, Smart PV Optimizer 600Wp', modelo: 'SUN2000-600W-P', ancho: 75, alto: 140, prof: 28, peso: 0.6, montaje: 'bajo panel', confianza: 'alta', fuente: 'https://solar.huawei.com/admin/asset/v1/pro/view/f288ad045bc345458c5f46fdb277b4a4.pdf' },
  // Tableros y cajas (medidas del nombre EMAT: ancho × alto × prof)
  { k: 'tg', sku: null, item: 'Tablero Metálico (c/ chasis) 400x300x200', modelo: 'Tablero metálico 400×300×200', ancho: 300, alto: 400, prof: 200, montaje: 'muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'tg', sku: null, item: 'Tablero Metálico (c/ chasis) 500x400x200', modelo: 'Tablero metálico 500×400×200', ancho: 400, alto: 500, prof: 200, montaje: 'muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'tg', sku: null, item: 'Tablero Metálico (c/ chasis) 600x600x300', modelo: 'Tablero metálico 600×600×300', ancho: 600, alto: 600, prof: 300, montaje: 'muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'tfv', sku: null, item: 'Tablero Exterior Sobrepuesto IP65 8 Circ', modelo: 'Tablero IP65 8 circuitos', ancho: null, alto: null, prof: null, montaje: 'muro', confianza: 'baja', fuente: 'Nombre EMAT', nota: 'Medidas según marca: completar con la ficha del proveedor.' },
  { k: 'tfv', sku: null, item: 'Tablero Exterior Sobrepuesto IP65 12 Circ', modelo: 'Tablero IP65 12 circuitos', ancho: null, alto: null, prof: null, montaje: 'muro', confianza: 'baja', fuente: 'Nombre EMAT', nota: 'Completar con la ficha del proveedor.' },
  { k: 'tfv', sku: null, item: 'Tablero Exterior Sobrepuesto IP65 15 Circ', modelo: 'Tablero IP65 15 circuitos', ancho: null, alto: null, prof: null, montaje: 'muro', confianza: 'baja', fuente: 'Nombre EMAT', nota: 'Completar con la ficha del proveedor.' },
  { k: 'tfv', sku: null, item: 'Tablero Exterior Sobrepuesto IP65 2x12 Circ', modelo: 'Tablero IP65 2×12 circuitos', ancho: null, alto: null, prof: null, montaje: 'muro', confianza: 'baja', fuente: 'Nombre EMAT', nota: 'Completar con la ficha del proveedor.' },
  { k: 'cdj', sku: null, item: 'Caja Pregalvanizada 100 x 100mm', modelo: 'Caja 100×100', ancho: 100, alto: 100, prof: 50, montaje: 'muro', confianza: 'media', fuente: 'Nombre EMAT (prof. estimada)' },
  { k: 'cdj', sku: null, item: 'Caja Pregalvanizada 150 x 150mm', modelo: 'Caja 150×150', ancho: 150, alto: 150, prof: 75, montaje: 'muro', confianza: 'media', fuente: 'Nombre EMAT (prof. estimada)' },
  { k: 'cdj', sku: null, item: 'Caja Pregalvanizada 200 x 200mm', modelo: 'Caja 200×200', ancho: 200, alto: 200, prof: 100, montaje: 'muro', confianza: 'media', fuente: 'Nombre EMAT (prof. estimada)' },
  // Infraestructura de techo (se dibujan como zonas o rutas)
  { k: 'pasillo', sku: 'A01306005L004', item: 'Pasarela de acero MAC, 3000×400', modelo: 'Pasillo técnico EMAT 2026', ancho: 400, alto: 3000, prof: null, montaje: 'techo', confianza: 'alta', fuente: 'Nombre EMAT / Calculadora pasillo EMAT' },
  { k: 'pasillo', sku: 'A00206005L003', item: 'AN, Pasillo Técnico (2,3x300mmx30x3000mm)', modelo: 'Pasillo técnico AN 300 mm', ancho: 300, alto: 3000, prof: 30, montaje: 'techo', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'bandeja', sku: 'A00206001L005', item: 'AN, Bandeja Lisa Con Tapa (1,5x200x50x3000mm)', modelo: 'Bandeja lisa 200×50', ancho: 200, alto: 3000, prof: 50, montaje: 'techo/muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'bandeja', sku: 'A00206001L001', item: 'AN, Bandeja Lisa Con Tapa (1,5x200x100x3000mm)', modelo: 'Bandeja lisa 200×100', ancho: 200, alto: 3000, prof: 100, montaje: 'techo/muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'bandeja', sku: 'A00206001L004', item: 'AN, Bandeja Ranurada Con Tapa (1,5x150x50x3000mm)', modelo: 'Bandeja ranurada 150×50', ancho: 150, alto: 3000, prof: 50, montaje: 'techo/muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'bandeja', sku: 'A00206001L002', item: 'AN, Bandeja Ranurada Con Tapa (1,5x200x50x3000mm)', modelo: 'Bandeja ranurada 200×50', ancho: 200, alto: 3000, prof: 50, montaje: 'techo/muro', confianza: 'alta', fuente: 'Nombre EMAT' },
  { k: 'bandeja', sku: 'A00206001L003', item: 'AN, Bandeja Ranurada Con Tapa (1,5x100x50x3000mm)', modelo: 'Bandeja ranurada 100×50', ancho: 100, alto: 3000, prof: 50, montaje: 'techo/muro', confianza: 'alta', fuente: 'Nombre EMAT' }
];
