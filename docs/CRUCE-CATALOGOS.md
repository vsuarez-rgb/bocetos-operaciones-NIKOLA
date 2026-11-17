# Cruce de catálogos · plantilla "Campos Autocad" vs. base EMAT

Generado por `scripts/extraer-catalogos.mjs` el 2026-11-17. No editar a mano: se vuelve a generar con el script.

- **Excel**: hojas *Equipos* y *Cables y canalización* de `Campos Autocad -.xlsm` → `data/catalogos/*.json`.
- **EMAT**: `js/equipos-emat.js` (SKU, medidas y datos de ficha que usa el dibujo).
- El cruce de inversores es por modelo (ignorando "TL" en el nombre, porque EMAT y Excel lo escriben distinto). El de paneles es por marca + Wp, porque el Excel usa nombres comerciales cortos.

## Resumen

| Catálogo | En el Excel | En EMAT | En ambos | Solo Excel | Solo EMAT |
|---|---|---|---|---|---|
| Inversores | 67 | 27 | 27 | 40 | 0 |
| Paneles | 18 | 6 | 4 | 14 | 2 |
| Baterías (configuraciones) | 6 | 4 módulos | — | — | — |
| Cargadores | 14 | 2 | 2 | 12 | 0 |
| Diferenciales | 11 | — |  |  |  |
| Termomagnéticos | 30 | — |  |  |  |
| Distribuidoras | 45 | — |  |  |  |
| Regiones / comunas | 16 / 346 | — |  |  |  |

## Inversores en ambos

Diferencias con tolerancia de 1 %. "Fase" en el Excel se deduce de P / Iac (el Excel no la guarda).
La corriente de salida se compara con **Imáx** (Equipos!F), que es lo que EMAT guarda como `iac` (máxima de ficha). La columna "Iac-nom" (Equipos!Q) es la nominal y en los trifásicos grandes es menor; no es una diferencia.
**Decisión (17-11-2026):** si un dato del Excel no coincide con EMAT, se usa el del Excel marcado con **\*** para verificarlo (`verificar` en el JSON; la Ficha muestra el asterisco).

| Modelo (Excel) | SKU EMAT | Fila Excel | Diferencias |
|---|---|---|---|
| SUN2000-2KTL-L1 | A02008004L006 | Equipos!4 | coincide |
| SUN2000-3KTL-L1 | A02008004L007 | Equipos!5 | coincide |
| SUN2000-4KTL-L1 | A02008004L008 | Equipos!6 | coincide |
| SUN2000-5KTL-L1 | A02008004L009 | Equipos!7 | coincide |
| SUN2000-6KTL-L1 | A02008004L010 | Equipos!8 | coincide |
| SUN2000-8K-LC0 | A02008004L011 | Equipos!9 | coincide |
| SUN2000-10K-LC0 | A02008004L005 | Equipos!10 | coincide |
| SUN2000-5KTL-M1 | A02008004L013 | Equipos!13 | coincide |
| SUN2000-6KTL-M1 | A02008004L003 | Equipos!14 | coincide |
| SUN2000-8KTL-M1 | A02008004L004 | Equipos!15 | coincide |
| SUN2000-10KTL-M1 | A02008004L001 | Equipos!16 | coincide |
| SUN2000-30KTL-M3 | A02008010L013 | Equipos!26 | coincide |
| SUN2000-36KTL-M3 | A02008010L014 | Equipos!27 | Imáx CA: Excel 57.2 **\*** / EMAT 58 |
| SUN2000-40KTL-M3 | A02008010L004 | Equipos!28 | coincide |
| SUN2000-50KTL-M3 | A02008010L005 | Equipos!29 | coincide |
| SUN2000-100KTL-M2 | A02008010L002 | Equipos!30 | coincide |
| SUN2000-150KTL-MG0 | A02008010L016 | Equipos!31 | coincide |
| SUN2000-6KTL-MAP0 | A02008010L017 | Equipos!33 | coincide |
| SUN2000-8KTL-MAP0 | A02008004L016 | Equipos!34 | coincide |
| SUN2000-10KTL-MAP0 | A02008004L017 | Equipos!35 | coincide |
| SUN2000-12KTL-MAP0 | A02008010L018 | Equipos!36 | coincide |
| SUN2000-15KTL-MB0 | A02008010L019 | Equipos!38 | coincide |
| SUN2000-20KTL-MB0 | A02008010L020 | Equipos!40 | coincide |
| SUN2000-25KTL-MB0 | A02008010L021 | Equipos!41 | coincide |
| SUN2000-4K-LB0 | A02008010L024 | Equipos!44 | coincide |
| SUN2000-5K-LB0 | A02008010L025 | Equipos!46 | coincide |
| SUN2000-6K-LB0 | A02008010L026 | Equipos!47 | coincide |

## Inversores solo en el Excel

Se usan desde el catálogo del Excel. Si se van a dibujar, hay que agregarlos a EMAT con medidas de ficha.

| Marca | Modelo | kW | Fase | Fila |
|---|---|---|---|---|
| Huawei | SUN2000-3KTL-M1 | 3 | Trifásico | Equipos!11 |
| Huawei | SUN2000-4KTL-M1 | 4 | Trifásico | Equipos!12 |
| Huawei | SUN2000-12KTL-M5 | 12 | Trifásico | Equipos!17 |
| Huawei | SUN2000-15KTL-M5 | 15 | Trifásico | Equipos!18 |
| Huawei | SUN2000-17KTL-M5 | 17 | Trifásico | Equipos!19 |
| Huawei | SUN2000-20KTL-M5 | 20 | Trifásico | Equipos!20 |
| Huawei | SUN2000-25KTL-M5 | 25 | Trifásico | Equipos!21 |
| Huawei | SUN2000-12KTL-M2 | 12 | Trifásico | Equipos!22 |
| Huawei | SUN2000-15KTL-M2 | 15 | Trifásico | Equipos!23 |
| Huawei | SUN2000-17KTL-M2 | 17 | Trifásico | Equipos!24 |
| Huawei | SUN2000-20KTL-M2 | 20 | Trifásico | Equipos!25 |
| Huawei | SUN2000-5KTL-MAP0 | 5 | Trifásico | Equipos!32 |
| Huawei | SUN2000-12KTL-MB0 | 12 | Trifásico | Equipos!37 |
| Huawei | SUN2000-17KTL-MB0 | 17 | Trifásico | Equipos!39 |
| Huawei | SUN2000-3K-LB0 | 3 | Monofásico | Equipos!42 |
| Huawei | SUN2000-3.68K-LB0 | 3.68 | Monofásico | Equipos!43 |
| Huawei | SUN2000-4.6K-LB0 | 4.6 | Monofásico | Equipos!45 |
| Fronius | Primo 3.0-1 | 3 | Monofásico | Equipos!52 |
| Fronius | Primo 4.0-1 | 4 | Monofásico | Equipos!53 |
| Fronius | Primo 5.0-1 | 5 | Monofásico | Equipos!54 |
| Fronius | Primo 6.0-1 | 6 | Monofásico | Equipos!55 |
| Fronius | Primo 8.2-1 | 8 | Monofásico | Equipos!56 |
| Fronius | Symo 3.0-3-S | 3 | Trifásico | Equipos!57 |
| Fronius | Symo 3.7-3-S | 3.7 | Trifásico | Equipos!58 |
| Fronius | Symo 4.5-3-S | 4.5 | Trifásico | Equipos!59 |
| Fronius | Symo 3.0-3-M | 3 | Trifásico | Equipos!60 |
| Fronius | Symo 3.7-3-M | 3.7 | Trifásico | Equipos!61 |
| Fronius | Symo 4.5-3-M | 4.5 | Trifásico | Equipos!62 |
| Fronius | Symo 5.0-3-M | 5 | Trifásico | Equipos!63 |
| Fronius | Symo 6.0-3-M | 6 | Trifásico | Equipos!64 |
| Fronius | Symo 7.0-3-M | 7 | Trifásico | Equipos!65 |
| Fronius | Symo 8.2-3-M | 8.2 | Trifásico | Equipos!66 |
| Fronius | Symo 10.0-3-M | 10 | Trifásico | Equipos!67 |
| Fronius | Symo 12.5-3-M | 12.5 | Trifásico | Equipos!68 |
| Fronius | Symo 15.0-3-M | 15 | Trifásico | Equipos!69 |
| Fronius | Symo 17.5-3-M | 17.5 | Trifásico | Equipos!70 |
| Fronius | Symo 20.0-3-M | 20 | Trifásico | Equipos!71 |
| Fronius | Eco 25.0-3-S | 25 | Trifásico | Equipos!72 |
| Fronius | Eco 27.0-3-S | 27 | Trifásico | Equipos!73 |
| Victron | MultiPlus 48/5000/70 | — | — | Equipos!91 |

## Inversores solo en EMAT

_(ninguno)_

## Paneles en ambos

| Panel (Excel) | EMAT | Fila Excel | Diferencias |
|---|---|---|---|
| JinkoSolar Tiger Neo54HL4R-B 445 | A02309000L002 (TIGER NEO JKM445N-54HL4R-B) | Equipos!106 | coincide |
| JinkoSolar Tiger Neo 72HL4-BDV 585 | A02309000L001 (TIGER NEO JKM585N-72HL4-V) | Equipos!108 | Voc: Excel 52.7 / EMAT 51.16; Isc: Excel 14.01 / EMAT 14.55; Vmp: Excel 44.02 / EMAT 42.52; Imp: Excel 13.29 / EMAT 13.76 |
| JinkoSolar Tiger Neo 72HL4-BDV 590 | A02309000L004 (TIGER NEO JKM590N-72HL4-BDV) | Equipos!109 | coincide |
| TrinaSolar TSM-NE21 710 (Vertex) | A04209000L012 (VERTEX N TSM-710NEG21C.20) | Equipos!119 | coincide |

## Paneles solo en el Excel

| Marca | Modelo | Wp | Fila |
|---|---|---|---|
| CanadianSolar | HiKu6 CS6W-550MS | 550 | Equipos!96 |
| CanadianSolar | TOPHiKu6 CS6W-590T | 590 | Equipos!97 |
| CanadianSolar | TOPBiHiKu7 CS7N-705TB-AG (0% Bifacialidad) | 705 | Equipos!98 |
| CanadianSolar | TOPBiHiKu7 CS7N-705TB-AG (5% Bifacialidad) | 740 | Equipos!99 |
| CanadianSolar | TOPBiHiKu7 CS7N-705TB-AG (10% Bifacialidad) | 776 | Equipos!100 |
| CanadianSolar | TOPHiKu6 CS6W-585T | 585 | Equipos!101 |
| JinkoSolar | Tiger Neo 48HL4M-DB 465 | 465 | Equipos!107 |
| ZNShine | ZXM7-UHLD144 585W | 585 | Equipos!113 |
| TrinaSolar | TSM-DE18M(II) 500 | 500 | Equipos!117 |
| TrinaSolar | TSM-DE18M 550 (Tallmax) | 550 | Equipos!118 |
| JASolar | JAM78S10-445W | 445 | Equipos!124 |
| JASolar | JAM72S20-455Wp | 455 | Equipos!125 |
| JASolar | JAM72S20-460Wp | 460 | Equipos!126 |
| TWSolar | TWMND-72HD590 | 590 | Equipos!130 |

## Paneles solo en EMAT

Paneles que se venden hoy pero que el Excel no tiene: la Ficha los tomará de EMAT.

| SKU | Modelo | Wp |
|---|---|---|
| A02309000L006 | TIGER NEO JKM730N-66HL5-BDV | 730 |
| A02309000L003 | VERTEX N TSM-720NEG21C.20 | 720 |

## Baterías

El Excel describe configuraciones (n módulos + módulo de potencia). EMAT tiene los módulos sueltos con su SKU.

| Configuración (Excel) | Módulo batería | SKU EMAT | Módulo potencia | SKU EMAT |
|---|---|---|---|---|
| LUNA2000-5-S0 | LUNA2000-5-E0 | A02001001L006 | LUNA2000-5kW-C0 | A02001001L007 |
| LUNA2000-10-S0 | LUNA2000-5-E0 | A02001001L006 | LUNA2000-5kW-C0 | A02001001L007 |
| LUNA2000-15-S0 | LUNA2000-5-E0 | A02001001L006 | LUNA2000-5kW-C0 | A02001001L007 |
| LUNA2000-7-S1 | LUNA2000-7-E1 | A02001001L011 | LUNA2000-10KW-C1 | A02001001L010 |
| LUNA2000-14-S1 | LUNA2000-7-E1 | A02001001L011 | LUNA2000-10KW-C1 | A02001001L010 |
| LUNA2000-21-S1 | LUNA2000-7-E1 | A02001001L011 | LUNA2000-10KW-C1 | A02001001L010 |

## Cargadores

| Marca (Excel) | Modelo | Datos | SKU EMAT |
|---|---|---|---|
| SAVE_Wallbox | Pulsar Plus 7,4 kW | 7.4 kW · 220 V | no está en EMAT |
| SAVE_Wallbox | Pulsar Plus 11 kW | 11 kW · 380 V | no está en EMAT |
| SAVE_Wallbox | Pulsar Plus 22 kW | 22 kW · 380 V | no está en EMAT |
| SAVE_Huawei | SCharger-7KS-S0 | 7.4 kW · 220 V | A02005000L001 |
| SAVE_Huawei | SCharger-22KT-S0 | 22 kW · 380 V | A02005000L002 |
| SAVE_Tesla | Tesla Wall Connector 7,4 kW | 7.4 kW · 220 V | no está en EMAT |
| SAVE_Tesla | Tesla Wall Connector 22 kW | 22 kW · 380 V | no está en EMAT |
| SAVE_Beny | BCP-A2N-P 7,4 kW (cable fijo) | 7.4 kW · 220 V | no está en EMAT |
| SAVE_Beny | BCP-B2N-P 7,4 kW (socket) | 7.4 kW · 220 V | no está en EMAT |
| SAVE_Beny | BCP-AT2N-P 22 kW (cable fijo) | 22 kW · 380 V | no está en EMAT |
| SAVE_Beny | BCP-BT2N-P 22 kW (socket) | 22 kW · 380 V | no está en EMAT |
| SAVE_BYD | EVA03K5I/XST0 | 3.3 kW · 220 V | no está en EMAT |
| SAVE_BYD | EVA007KI/XST0 | 7 kW · 220 V | no está en EMAT |
| SAVE_BYD | EVA0011KI/XST0 | 11 kW · 400 V | no está en EMAT |


## Problemas encontrados en la plantilla

- Equipos!K (Sección mín. cable de inversores) se calcula desde un libro externo (`Libro1.xlsx` en un OneDrive personal) que no está en la plantilla: la columna viene vacía. No la usa ninguna fórmula de "Información proyecto".
- Equipos!W16:AI41 (nombres de string de la UG B y C) dependen de un libro externo (una copia de la plantilla en el escritorio de otra persona): en la plantilla esas letras quedan vacías. La app los genera igual que la UG A cambiando la letra.
- El rango con nombre "Paneles" está roto (Equipos!#REF!). La lista de marcas de paneles se toma de Equipos!B96:B101.
- Baterías corregidas (arrastre de Excel en la serie S1, confirmado por Ops): LUNA2000-14-S2 → LUNA2000-14-S1 (Equipos!138); LUNA2000-21-S3 → LUNA2000-21-S1 (Equipos!139). **Hay que corregirlo también en la plantilla**, porque el Excel de un proyecto con 2 o 3 módulos escribiría "S2/S3" en el plano.
- Diferenciales sin marca ni ficha (posibles filas de prueba): Equipos!219.
- La región "Ñuble" (lista Equipos!A) no tiene rango de comunas con nombre: la lista desplegable de comunas no funciona para ella en el Excel.
- Comunas fuera de los rangos con nombre de su región: Chillán (Ñuble), Bulnes (Ñuble), Cobquecura (Ñuble), Coelemu (Ñuble), Coihueco (Ñuble), Chillán Viejo (Ñuble), El Carmen (Ñuble), Ninhue (Ñuble), Ñiquén (Ñuble), Pemuco (Ñuble), Pinto (Ñuble), Portezuelo (Ñuble) y 9 más.

## Datos personales

Los instaladores (9, con RUT, dirección, licencia, correo y teléfono) y la lista de proyectistas (10 nombres) se extraen a `../_privado/personas.json`, fuera del repositorio, como indica `docs/DECISIONES-PASO0.md`.
