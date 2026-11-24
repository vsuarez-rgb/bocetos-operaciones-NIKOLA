# Base de equipos EMAT — medidas de ficha técnica

Fuente de nombres, SKU y datos eléctricos: hoja **Backend** del *Asistente de Cubicación - con EMAT V1.xlsm*. Medidas físicas: fichas técnicas oficiales (Jinko, Trina, Huawei), revisadas el 17-11-2026. Los datos que usa la app están en `js/equipos-emat.js`; este documento es la versión para leer.

Confianza: **alta** = ficha oficial y datos eléctricos coinciden · **media** = ficha con dudas (versión u orden de ejes) · **baja** = dato de tienda o distribuidor.

## Paneles

| SKU | Ítem EMAT | Modelo fabricante | Largo × ancho × espesor (mm) | Peso (kg) | Pmax | Voc | Isc | Vmp | Imp | Coef. Voc | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A02309000L006 | Jinko, Panel fotovoltaico bifacial 730Wp | TIGER NEO JKM730N-66HL5-BDV | 2384 × 1303 × 33 | 37.5 | 730 | 49.36 | 18.81 | 41.11 | 17.76 | -0.25 | [alta](https://www.vpsolar.com/download/catalog/Moduli/Jinko-Solar/Datasheet_Jinko_JKMxxxN-66HL5-BDV-710-735-Wp_EN.pdf) |
| A02309000L003 | Trina Solar 720 W | VERTEX N TSM-720NEG21C.20 | 2384 × 1303 × 33 | 38.3 | 720 | 49.4 | 18.49 | 41.3 | 17.44 | -0.24 | [media](https://www-cdn.trinasolar.com/wwwstorage/sites/17/DT-M-0085-Datasheet_VertexN_TSM-NEG21C.20_695-725W_2025_C.pdf) |
| A04209000L012 | Trina Solar 710 W Bifacial | VERTEX N TSM-710NEG21C.20 | 2384 × 1303 × 33 | 38.3 | 710 | 49 | 18.4 | 40.9 | 17.36 | -0.24 | [alta](https://www-cdn.trinasolar.com/wwwstorage/sites/17/DT-M-0085-Datasheet_VertexN_TSM-NEG21C.20_695-725W_2025_C.pdf) |
| A02309000L004 | Jinko Solar 590 W Bifacial | TIGER NEO JKM590N-72HL4-BDV | 2278 × 1134 × 30 | 31 | 590 | 52.9 | 14.07 | 44.17 | 13.36 | -0.25 | [alta](https://www.vicoexport.com/wp-content/uploads/2024/04/EU-JKM570-590N-72HL4-BDV-F8-EN_Vico_Export_Solar_Energy.pdf) |
| A02309000L001 | Jinko Solar 585 W | TIGER NEO JKM585N-72HL4-V | 2278 × 1134 × 35 | 28 | 585 | 51.16 | 14.55 | 42.52 | 13.76 | -0.25 | [alta](https://solarproof.com.au/datasheets/panel_datasheet_JKM565-585N-72HL4-(V)-F4-EN.pdf) |
| A02309000L002 | Jinko Solar 445 (Black) | TIGER NEO JKM445N-54HL4R-B | 1762 × 1134 × 30 | 21 | 445 | 39.77 | 13.87 | 33.19 | 13.41 | -0.25 | [alta](https://www.jinkosolar.com/uploads/664b0f09/JKM430-455N-54HL4R-B-F8-EN.pdf) |

## Inversores Huawei

Medidas con placa de montaje, en el orden de Huawei: ancho × alto × prof. Iac a 380 V en trifásicos (salvo nota).

| SKU | Modelo | kW | Fase | Ancho × alto × prof (mm) | Peso (kg) | MPPT × cadenas | MPPT (V) | Vdc máx | Isc/MPPT (A) | Iac máx (A) | Diferencial EMAT | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A02008004L006 | SUN2000-2KTL-L1 | 2 | Monofásico | 365 × 375 × 156 | 12 | 2 × 1 | 90–560 | 600 | 18 | 10 | Interruptor Diferencial 2x25A 100mA Tipo A | [alta](https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs) |
| A02008004L007 | SUN2000-3KTL-L1 | 3 | Monofásico | 365 × 375 × 156 | 12 | 2 × 1 | 90–560 | 600 | 18 | 15 | Interruptor Diferencial 2x25A 100mA Tipo A | [alta](https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs) |
| A02008004L008 | SUN2000-4KTL-L1 | 4 | Monofásico | 365 × 375 × 156 | 12 | 2 × 1 | 90–560 | 600 | 18 | 20 | Interruptor Diferencial 2x25A 100mA Tipo A | [alta](https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs) |
| A02008010L024 | SUN2000-4K-LB0 | 4 | Monofásico | 425 × 376.5 × 150 | 15 | 2 × 1 | 40–560 | 600 | 20 | 20 | Interruptor Diferencial 2x25A 100mA Tipo A | [media](https://solar.huawei.com/en/products/sun2000-3-368-4-46-5-6k-lb0/specs/) |
| A02008004L009 | SUN2000-5KTL-L1 | 5 | Monofásico | 365 × 375 × 156 | 12 | 2 × 1 | 90–560 | 600 | 18 | 25 | Interruptor Diferencial 2x25A 100mA Tipo A | [alta](https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs) |
| A02008010L025 | SUN2000-5K-LB0 | 5 | Monofásico | 425 × 376.5 × 150 | 15 | 2 × 1 | 40–560 | 600 | 20 | 25 | Interruptor Diferencial 2x40A 100mA Tipo A | [media](https://solar.huawei.com/en/products/sun2000-3-368-4-46-5-6k-lb0/specs/) |
| A02008004L010 | SUN2000-6KTL-L1 | 6 | Monofásico | 365 × 375 × 156 | 12 | 2 × 1 | 90–560 | 600 | 18 | 27.3 | Interruptor Diferencial 2x40A 100mA Tipo A | [alta](https://solar.huawei.com/id/products/SUN2000-3-4-5-6KTL-L1/specs) |
| A02008010L026 | SUN2000-6K-LB0 | 6 | Monofásico | 425 × 376.5 × 150 | 15 | 2 × 1 | 40–560 | 600 | 20 | 30 | Interruptor Diferencial 2x40A 100mA Tipo A | [media](https://solar.huawei.com/en/products/sun2000-3-368-4-46-5-6k-lb0/specs/) |
| A02008004L011 | SUN2000-8K-LC0 | 8 | Monofásico | 425 × 376.5 × 150 | 14.5 | 3 × 1 | 40–560 | 600 | 20 | 40 | Interruptor Diferencial 2x40A 100mA Tipo A | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/ada802421c674daa9047aeec9d28a710.pdf) |
| A02008004L005 | SUN2000-10K-LC0 | 10 | Monofásico | 425 × 376.5 × 150 | 15 | 3 × 1 | 40–560 | 600 | 20 | 45.5 | Legrand INT.DIF. INMUNIZADO 2x63A 300mA Tipo A | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/ada802421c674daa9047aeec9d28a710.pdf) |
| A02008004L013 | SUN2000-5KTL-M1 | 5 | Trifásico | 525 × 470 × 146.5 | 17 | 2 × 1 | 140–980 | 1100 | 19.5 | 8.5 | Interruptor Diferencial 4x25A 30mA Tipo A | [alta](https://solar.huawei.com/th/products/SUN2000-3-4-5-6-8-10KTL-M1/specs/) |
| A02008004L003 | SUN2000-6KTL-M1 | 6 | Trifásico | 525 × 470 × 146.5 | 17 | 2 × 1 | 140–980 | 1100 | 19.5 | 10.1 | Interruptor Diferencial 4x25A 30mA Tipo A | [alta](https://solar.huawei.com/th/products/SUN2000-3-4-5-6-8-10KTL-M1/specs/) |
| A02008004L004 | SUN2000-8KTL-M1 | 8 | Trifásico | 525 × 470 × 146.5 | 17 | 2 × 1 | 140–980 | 1100 | 19.5 | 13.5 | Interruptor Diferencial 4x25A 30mA Tipo A | [alta](https://solar.huawei.com/th/products/SUN2000-3-4-5-6-8-10KTL-M1/specs/) |
| A02008004L001 | SUN2000-10KTL-M1 | 10 | Trifásico | 525 × 470 × 146.5 | 17 | 2 × 1 | 140–980 | 1100 | 19.5 | 16.9 | Interruptor diferencial 4P 40A 300mA clase A | [alta](https://solar.huawei.com/th/products/SUN2000-3-4-5-6-8-10KTL-M1/specs/) |
| A02008010L017 | SUN2000-6K-MAP0 | 6 | Trifásico | 490 × 460 × 130 | 21 | 2 × 1 | 160–1000 | 1100 | 22 | 10 | Interruptor diferencial 4P 40A 300mA clase A | [media](https://solar.huawei.com/pk/products/sun2000-5-12k-map0/specs) |
| A02008004L016 | SUN2000-8K-MAP0 | 8 | Trifásico | 490 × 460 × 130 | 21 | 2 × 1 | 160–1000 | 1100 | 22 | 13.3 | Interruptor diferencial 4P 40A 300mA clase A | [media](https://solar.huawei.com/pk/products/sun2000-5-12k-map0/specs) |
| A02008004L017 | SUN2000-10K-MAP0 | 10 | Trifásico | 490 × 460 × 130 | 21 | 2 × 1 | 160–1000 | 1100 | 22 | 16.7 | Interruptor diferencial 4P 40A 300mA clase A | [media](https://solar.huawei.com/pk/products/sun2000-5-12k-map0/specs) |
| A02008010L018 | SUN2000-12K-MAP0 | 12 | Trifásico | 490 × 460 × 130 | 21 | 2 × 1 | 160–1000 | 1100 | 22 | 20.2 | Interruptor diferencial 4P 40A 300mA clase A | [media](https://solar.huawei.com/pk/products/sun2000-5-12k-map0/specs) |
| A02008010L019 | SUN2000-15K-MB0 | 15 | Trifásico | 546 × 460 × 228 | 21 | 2 × 2 | 200–1000 | 1100 | 40 | 25.2 | Interruptor diferencial 4P 40A 300mA clase A | [alta](https://solar.huawei.com/en/professionals/all-products/SUN2000-12-15-17-20-25K-MB0/specs) |
| A02008010L020 | SUN2000-20K-MB0 | 20 | Trifásico | 546 × 460 × 228 | 21 | 2 × 2 | 200–1000 | 1100 | 40 | 33.6 | Interruptor diferencial 4P 40A 300mA clase A | [alta](https://solar.huawei.com/en/professionals/all-products/SUN2000-12-15-17-20-25K-MB0/specs) |
| A02008010L021 | SUN2000-25K-MB0 | 25 | Trifásico | 546 × 460 × 228 | 21 | 2 × 2 | 200–1000 | 1100 | 40 | 42 | Interruptor diferencial 4P 40A 300mA clase A | [alta](https://solar.huawei.com/en/professionals/all-products/SUN2000-12-15-17-20-25K-MB0/specs) |
| A02008010L013 | SUN2000-30KTL-M3 | 30 | Trifásico | 640 × 530 × 270 | 43 | 4 × 2 | 200–1000 | 1100 | 40 | 47.9 | Interruptor diferencial 4P 63A 300mA clase A | [alta](https://www.photomate.eu/photomate-download/223) |
| A02008010L014 | SUN2000-36KTL-M3 | 36 | Trifásico | 640 × 530 × 270 | 43 | 4 × 2 | 200–1000 | 1100 | 40 | 58 | Interruptor diferencial 4P 63A 300mA clase A | [alta](https://www.photomate.eu/photomate-download/223) |
| A02008010L004 | SUN2000-40KTL-M3 | 40 | Trifásico | 640 × 530 × 270 | 43 | 4 × 2 | 200–1000 | 1100 | 40 | 63.8 | Interruptor diferencial 4P 63A 300mA clase A | [alta](https://www.photomate.eu/photomate-download/223) |
| A02008010L005 | SUN2000-50KTL-M3 | 50 | Trifásico | 640 × 530 × 270 | 49 | 4 × 2 | 200–1000 | 1100 | 40 | 79.8 | — | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/4b99f6268ac4441b8e9286f26a186833.pdf) |
| A02008010L002 | SUN2000-100KTL-M2 | 100 | Trifásico | 1035 × 700 × 365 | 93 | 10 × 2 | 200–1000 | 1100 | 40 | 160.4 | — | [alta](https://cdn.shopify.com/s/files/1/0549/8073/9127/files/EN_Sheet_100KTL-M2.pdf) |
| A02008010L016 | SUN2000-150K-MG0 | 150 | Trifásico | 1000 × 710 × 395 | 96 | 7 × 3 | 200–1000 | 1100 | 66 | 253.2 | — | [alta](https://solar.huawei.com/za/products/sun2000-150k-mg0/specs) |

## Otros equipos

| Tipo | SKU | Ítem EMAT | Modelo | Ancho × alto × prof (mm) | Peso (kg) | Montaje | Conf. | Nota |
|---|---|---|---|---|---|---|---|---|
| bat | A02001001L006 | Huawei, Batería LUNA2000 5kWh | LUNA2000-5-E0 (serie S0) | 670 × 360 × 150 | 50 | piso | [alta](https://solar.huawei.com/en/products/LUNA2000-5-10-15-S0/specs/) | Torre = 240 (potencia) + 360 × n baterías, con base. |
| bat | A02001001L011 | Huawei, Batería LUNA2000 7kWh | LUNA2000-7-E1 (serie S1) | 590 × 360 × 255 | 68 | piso | [alta](https://solar.huawei.com/en/products/LUNA2000-7-14-21-S1/specs/) | No se mezcla con S0. Torre = 150 (potencia) + 360 × n. |
| dcdc | A02001001L007 | Huawei, Módulo DC/DC 5kW | LUNA2000-5KW-C0 | 670 × 240 × 150 | 12 | torre | [alta](https://solar.huawei.com/en/products/LUNA2000-5-10-15-S0/specs/) |  |
| dcdc | A02001001L010 | Huawei, Módulo DC/DC 10kW | LUNA2000-10KW-C1 | 590 × 150 × 255 | 10 | torre | [alta](https://solar.huawei.com/en/products/LUNA2000-7-14-21-S1/specs/) |  |
| bat | A02001001L002 | Huawei, LUNA2000 Wall Bracket 5kWh | Wall Mounting Bracket S0 (21155238) | 580 × 185 × 50 | 6.66 | muro | [baja](https://www.solaranlage-tipps.de/solar-zubehoer/luna2000-wall-mount.md) | Medida de tienda. Para dibujar usar el contorno de la torre S0. |
| bat | A02001001L012 | Huawei, LUNA2000 Wall Bracket 7kWh | Wall Mounting Bracket S1 (21156376) | — × — × — | — | muro | [baja](https://shop.krannich-solar.com/en-de/LUNA2000-S1-Wall-Mounting-Bracket/0156949) | Sin medidas publicadas. Usar el contorno de la torre S1. |
| ev | A02005000L001 | Huawei, SCharger-7KS-S0 | SCharger-7KS-S0 (7,4 kW, 1F) | 180 × 335 × 145 | 3 | muro | [alta](https://solar.huawei.com/en/products/SCharger-7KS-S0-22KT-S0/specs/) |  |
| ev | A02005000L002 | Huawei, SCharger-22KT-S0 | SCharger-22KT-S0 (22 kW, 3F) | 180 × 335 × 145 | 3.1 | muro | [alta](https://solar.huawei.com/en/products/SCharger-7KS-S0-22KT-S0/specs/) |  |
| sg | A02008004L015 | Huawei, SmartGuard-63A-S0 | SmartGuard-63A-S0 (1F) | 355 × 485 × 150 | 14 | muro | [alta](https://solar.huawei.com/en/products/HUAWEI-SmartGuard/specs/) |  |
| sg | A02008006L002 | Huawei, SmartGuard-63A T0 | SmartGuard-63A-T0 (3F) | 490 × 600 × 170 | 17 | muro | [alta](https://solar.huawei.com/ch/products/HUAWEI-SmartGuard-63A-T0-AUT0/specs/) |  |
| sm | A02008008L007 | Huawei, Smart Power Sensor Monofásico, 100A | SmartPS-100A-S0 (DDSU666-H / DDSU71) | 36 × 100 × 66 | 0.2 | riel DIN | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/0965d912ee1b48c0ad60da1f7452b73b.pdf) |  |
| sm | A02008006L001 | Huawei, Smart Power Sensor Trifásico, 250A | SmartPS-250A-T0 (DTSU666-H 250A/50mA) | 72 × 100 × 80 | 1.5 | riel DIN | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/0965d912ee1b48c0ad60da1f7452b73b.pdf) |  |
| — | A02008008L003 | Huawei, Smart Dongle WLAN-FE | SDongleA-05 | 146 × 48 × 33 | 0.09 | inversor | [alta](https://solar.huawei.com/en/products/CI-SmartDongle-WLAN-FE/specs/) |  |
| — | A02008008L001 | Huawei, Smart Dongle 4G | SDongleB-06 | 162 × 48 × 28 | — | inversor | [alta](https://solar.huawei.com/en/products/SmartDongle-4G/specs) |  |
| — | A00008001L001 | Huawei, Smart PV Optimizer 600Wp | SUN2000-600W-P | 75 × 140 × 28 | 0.6 | bajo panel | [alta](https://solar.huawei.com/admin/asset/v1/pro/view/f288ad045bc345458c5f46fdb277b4a4.pdf) |  |
| tg | — | Tablero Metálico (c/ chasis) 400x300x200 | Tablero metálico 400×300×200 | 300 × 400 × 200 | — | muro | alta (Nombre EMAT) |  |
| tg | — | Tablero Metálico (c/ chasis) 500x400x200 | Tablero metálico 500×400×200 | 400 × 500 × 200 | — | muro | alta (Nombre EMAT) |  |
| tg | — | Tablero Metálico (c/ chasis) 600x600x300 | Tablero metálico 600×600×300 | 600 × 600 × 300 | — | muro | alta (Nombre EMAT) |  |
| tfv | — | Tablero Exterior Sobrepuesto IP65 8 Circ | Tablero IP65 8 circuitos | — × — × — | — | muro | baja (Nombre EMAT) | Medidas según marca: completar con la ficha del proveedor. |
| tfv | — | Tablero Exterior Sobrepuesto IP65 12 Circ | Tablero IP65 12 circuitos | — × — × — | — | muro | baja (Nombre EMAT) | Completar con la ficha del proveedor. |
| tfv | — | Tablero Exterior Sobrepuesto IP65 15 Circ | Tablero IP65 15 circuitos | — × — × — | — | muro | baja (Nombre EMAT) | Completar con la ficha del proveedor. |
| tfv | — | Tablero Exterior Sobrepuesto IP65 2x12 Circ | Tablero IP65 2×12 circuitos | — × — × — | — | muro | baja (Nombre EMAT) | Completar con la ficha del proveedor. |
| cdj | — | Caja Pregalvanizada 100 x 100mm | Caja 100×100 | 100 × 100 × 50 | — | muro | media (Nombre EMAT (prof. estimada)) |  |
| cdj | — | Caja Pregalvanizada 150 x 150mm | Caja 150×150 | 150 × 150 × 75 | — | muro | media (Nombre EMAT (prof. estimada)) |  |
| cdj | — | Caja Pregalvanizada 200 x 200mm | Caja 200×200 | 200 × 200 × 100 | — | muro | media (Nombre EMAT (prof. estimada)) |  |
| pasillo | A01306005L004 | Pasarela de acero MAC, 3000×400 | Pasillo técnico EMAT 2026 | 400 × 3000 × — | — | techo | alta (Nombre EMAT / Calculadora pasillo EMAT) |  |
| pasillo | A00206005L003 | AN, Pasillo Técnico (2,3x300mmx30x3000mm) | Pasillo técnico AN 300 mm | 300 × 3000 × 30 | — | techo | alta (Nombre EMAT) |  |
| bandeja | A00206001L005 | AN, Bandeja Lisa Con Tapa (1,5x200x50x3000mm) | Bandeja lisa 200×50 | 200 × 3000 × 50 | — | techo/muro | alta (Nombre EMAT) |  |
| bandeja | A00206001L001 | AN, Bandeja Lisa Con Tapa (1,5x200x100x3000mm) | Bandeja lisa 200×100 | 200 × 3000 × 100 | — | techo/muro | alta (Nombre EMAT) |  |
| bandeja | A00206001L004 | AN, Bandeja Ranurada Con Tapa (1,5x150x50x3000mm) | Bandeja ranurada 150×50 | 150 × 3000 × 50 | — | techo/muro | alta (Nombre EMAT) |  |
| bandeja | A00206001L002 | AN, Bandeja Ranurada Con Tapa (1,5x200x50x3000mm) | Bandeja ranurada 200×50 | 200 × 3000 × 50 | — | techo/muro | alta (Nombre EMAT) |  |
| bandeja | A00206001L003 | AN, Bandeja Ranurada Con Tapa (1,5x100x50x3000mm) | Bandeja ranurada 100×50 | 100 × 3000 × 50 | — | techo/muro | alta (Nombre EMAT) |  |

## Torres de batería (altura total con base de piso)

| Serie | 1 módulo | 2 módulos | 3 módulos | Regla |
|---|---|---|---|---|
| LUNA2000 S0 (5 kWh por módulo) | 600 mm | 960 mm | 1.320 mm | 240 (módulo de potencia) + 360 × n |
| LUNA2000 S1 (7 kWh por módulo) | 510 mm | 870 mm | 1.230 mm | 150 (módulo de potencia) + 360 × n |

## Actualización 24-11-2026 (fichas y manuales del Drive, 04. Información Técnica)

- **Espacios libres de montaje** (mm, de las figuras de los manuales) cargados en `libre`:
  - SUN2000-K-LB0: arriba 300, abajo 400, lados 350.
  - SUN2000-KTL-M3 (30–50 kW): arriba 500, abajo 600, lados 300, frente 1000.
  - SUN2000-100KTL-M2: arriba 200, abajo 600, lados 600, frente 1000.
  - Sin dato todavía: L1, LC0, M1, MAP0, MB0, MG0 (rige el mínimo de RGR N°02/2024: 15 cm a cada lado).
- **Imax por MPPT**: MAP0 16 A, M3 30 A, 100KTL-M2 30 A, 150K-MG0 48 A. Falta MB0.
- **50KTL-M3**: Iac 84,0 A a 380 V (antes 79,8 A, que era a 400 V).
- **150K-MG0**: 102 kg según la ficha del Drive.
- **Trina 720 W**: Imp 17,44 A confirmado.
- **Smart Power Sensor trifásico (DTSU666-H)**: 72 × 100 × 65,5 mm, 0,8 kg.
- **Torre de baterías**: el dibujo usa la torre tabulada del modelo (antes sumaba siempre 240 mm de potencia, que es S0; S1 lleva 150 mm).
- **Cargadores agregados** (no son de EMAT): Beny OCPP 7,4 / 22 kW (169 × 380 × 151), TeltoCharge EVC1 (170 × 341 × 97), GoodWe HCA (208 × 450 × 150), Duosida SES (237 × 343 × 115).

## Pendientes

1. Espacios libres de L1, LC0, M1, MAP0, MB0 y MG0 (manuales que no están en el Drive).
2. Medidas de Wallbox Pulsar Plus, Tesla Wall Connector y EVA (están en la plantilla Campos Autocad pero no hay ficha en el Drive): agregarlas en Configuración → Equipos.
3. Tableros IP65 / IP40 sobrepuestos: medida según la marca que compre EMAT.
4. Fichas de modelos que aparecen en la Coordinación EMAT y no están en la app: Canadian 590 / 705 W, Huawei M5 (12–25 kW).

## Mis equipos

Desde el 24-11-2026 Operaciones puede agregar equipos con su medida real sin tocar el código: en el dibujo («Guardar como equipo…» en las propiedades) o en Configuración → Equipos. Se guardan en el navegador (ajuste `equiposUsuario`) y cada equipo dibujado guarda una copia de sus medidas (`e.modeloDatos`), para que el proyecto se vea igual en otro navegador.

## Cómo se usa en la app

- `js/equipos-emat.js` exporta `PANELES_EMAT`, `INVERSORES_EMAT` y `OTROS_EMAT`.
- `js/catalogo.js` arma con esos datos `PANELES`, `INVERSORES` y `MODELOS_EQUIPO(k)`, que es la lista de modelos que se puede elegir para cada símbolo del paso 6.
- En el plano de techumbre (vista desde arriba) cada equipo de muro se dibuja con su **ancho × prof**. El inversor toma la medida del modelo elegido en el paso Strings (función `medidaEquipo` en `js/geom.js`).
- El diferencial que propone la lámina viene del campo `dif` del inversor (el mismo que usa el Backend de EMAT). El disyuntor es la protección normalizada inmediatamente superior a la Iac.

### Para agregar o corregir un equipo (o pedírselo a Claude en VS Code)

> "En `js/equipos-emat.js` agrega el inversor SKU XXXX modelo SUN2000-… con los datos de la ficha: ancho, alto, prof, peso, MPPT, cadenas por MPPT, rango MPPT, Vdc máx, Isc por MPPT, Iac, diferencial. Sigue el formato de las filas existentes y actualiza `docs/EQUIPOS-EMAT.md`."
