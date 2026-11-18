# Diccionario de campos · hoja "Autocad"

Generado por `scripts/extraer-diccionario.mjs` el 2026-11-18 desde la plantilla vigente y `Module1.bas`. El detalle completo (fórmula original, precedentes, listas) está en `data/campos.json`.

## Resumen

|  | Cantidad |
|---|---|
| Filas de la hoja Autocad | 382 |
| · titulo | 1 |
| · cabecera | 30 |
| · campo | 344 |
| · roto | 7 |
| Campos leídos por la macro | 188 |
| Campos que la macro no lee | 156 |
| Celdas de "Cuadro de carga" que lee la macro | 489 |

### Campos por origen

| Origen | Qué significa | Campos |
|---|---|---|
| 🔗 zonos | Sale de la fila pegada desde ZonOS (R4:AY4) | 13 |
| 📚 catalogo | Búsqueda en Equipos o Cables y canalización | 92 |
| ⚙ calculo | Fórmula sobre otras celdas de la ficha | 125 |
| ✎ manual | Celda sin fórmula: se escribe o se elige de una lista | 114 |

### Campos por sección

| Sección | Campos | zonos | catalogo | calculo | manual |
|---|---|---|---|---|---|
| DATOS DEL MEDIDOR | 13 | 9 | 3 |  | 1 |
| DATOS DE CLIENTA O CLIENTE | 4 | 4 |  |  |  |
| DATOS DE PLANO | 3 |  |  | 1 | 2 |
| DATOS DE EMPRESA INSTALADORA | 7 |  | 6 |  | 1 |
| DATOS DE POTENCIA DE PLANTA | 11 |  | 1 | 9 | 1 |
| DATOS DE MÓDULOS | 9 |  | 6 | 1 | 2 |
| DATOS DE INSTALACIÓN | 18 |  |  | 15 | 3 |
| DATOS DE INVERSORES | 11 |  | 7 | 1 | 3 |
| DATOS DE BATERÍAS | 10 |  | 8 |  | 2 |
| DATOS DE CADENAS | 10 |  |  | 2 | 8 |
| DATOS DE EMPALME | 10 |  | 3 | 2 | 5 |
| DATOS TABLERO FOTOVOLTAICO | 3 |  |  |  | 3 |
| DATOS TABLERO GENERAL | 3 |  |  |  | 3 |
| INTERRUPTOR TERMOMAGNÉTICO FOTOVOLTAICO | 6 |  | 3 | 1 | 2 |
| INTERRUPTOR DIFERENCIAL FOTOVOLTAICO | 7 |  | 3 | 2 | 2 |
| BARRA REPARTIDORA | 3 |  |  | 3 |  |
| INTERRUPTOR TERMOMAGNÉTICO GENERAL | 6 |  | 2 | 2 | 2 |
| DATOS DE CANALIZACIÓN Y CABLEADO | 8 |  |  | 8 |  |
| CORRIENTE CONTINUA (UG - INV) | 33 |  | 7 | 18 | 8 |
| CORRIENTE ALTERNA (Tramo AC de inversor a TFV) | 33 |  | 9 | 13 | 11 |
| CORRIENTE ALTERNA (Tramo AC a TG o TGFV) | 33 |  | 9 | 13 | 11 |
| CORRIENTE ALTERNA (Tramo AC hacia el EMPALME) | 33 |  | 7 | 13 | 13 |
| CORRIENTE ALTERNA (Tramo TG a SAVE) | 33 |  | 7 | 14 | 12 |
| DATOS DE PUESTA A TIERRA | 15 |  |  | 5 | 10 |
| UBICACIÓN | 2 |  |  |  | 2 |
| DATOS DE SAVE | 7 |  | 5 |  | 2 |
| INTERRUPTOR TERMOMAGNÉTICO SAVE | 6 |  | 3 | 1 | 2 |
| INTERRUPTOR DIFERENCIAL SAVE | 7 |  | 3 | 1 | 3 |

### Otras hojas que usan estos campos (no se implementan en el paso 0)

| Hoja | Campos que usa |
|---|---|
| Cuadro de carga | 121 |
| Memoria explicativa | 114 |
| Informe de ensayos BT | 57 |
| Informe de ensayos MT | 41 |
| Señaléticas | 31 |
| Cubicación | 26 |
| TE6 | 11 |
| A. P. | 8 |

## Macro de AutoCAD

- Lee `Autocad!B` por fila fija (188 filas) y 489 celdas de `Cuadro de carga` (cuadro 1, cuadro 2, cuadro 3, cuadro 4 (caída de tensión del SAVE en CA)). En el Cuadro de carga, la propiedad del DWG se llama igual que la celda ("C9", "D12"…).
- En 4 tramos, si el sistema de medida es AWG, la macro lee la columna **D** (sección en mm²) en vez de la B. El diccionario lo guarda en `macro[].condicion`.
- Las posiciones de string son **fijas**, en la hoja y en la macro: la 1ª es A.1.1, la 2ª A.1.2, la 3ª A.2.1, la 4ª A.2.2… Si el inversor tiene una sola entrada por MPPT, las posiciones ".2" quedan vacías (un 3/1 usa las posiciones 1, 3 y 5: A.1.1, A.2.1 y A.3.1).

✓ Cada `Range("Bnn")` de la macro corresponde a un campo del diccionario.

### Campos cuyo nombre en el DWG es distinto al de la hoja (5)

| Fila | En la hoja Autocad | En el DWG (macro) |
|---|---|---|
| 9 | COORD Latitud | COORD UTM X |
| 10 | COORD Longitud | COORD UTM Y |
| 17 | NÚMERO DE CLIENTA/E | NÚMERO DE CLIENTE |
| 21 | PROPIETARIA/O Nombre | PROPIETARIA(O) Nombre |
| 22 | PROPIETARIA/O RUT | PROPIETARIA(O) RUT |

### Campos que la macro no lee (156)

Existen en la hoja pero no llegan al DWG. Se mantienen en la ficha (los usan otras hojas o son pasos intermedios del cálculo).

| Fila | Campo | Origen | Usado en |
|---|---|---|---|
| 18 | EMPRESA DISTRIBUIDORA Teléfono | catalogo |  |
| 19 | EMPRESA DISTRIBUIDORA Página web | catalogo |  |
| 26 | REPRESENTANTE Nombre completo | zonos |  |
| 27 | REPRESENTANTE RUT | zonos |  |
| 41 | Sistema de simulación | manual |  |
| 60 | MÓDULO 125%Isc | calculo | Memoria explicativa |
| 63 | INSTALACIÓN Tipo | manual |  |
| 64 | INSTALACIÓN Descripción | manual |  |
| 65 | INSTALACIÓN Orientación Azimut string A.1.1 | manual | Informe de ensayos BT |
| 66 | INSTALACIÓN Inclinación string A.1.1 | calculo | Informe de ensayos BT |
| 67 | INSTALACIÓN Orientación Azimut string A.1.2 | calculo | Informe de ensayos BT |
| 68 | INSTALACIÓN Inclinación string A.1.2 | calculo | Informe de ensayos BT |
| 69 | INSTALACIÓN Orientación Azimut string A.2.1 | calculo | Informe de ensayos BT |
| 70 | INSTALACIÓN Inclinación string A.2.1 | calculo | Informe de ensayos BT |
| 71 | INSTALACIÓN Orientación Azimut string A.2.2 | calculo | Informe de ensayos BT |
| 72 | INSTALACIÓN Inclinación string A.2.2 | calculo | Informe de ensayos BT |
| 73 | INSTALACIÓN Orientación Azimut string A.3.1 | calculo | Informe de ensayos BT |
| 74 | INSTALACIÓN Inclinación string A.3.1 | calculo | Informe de ensayos BT |
| 75 | INSTALACIÓN Orientación Azimut string A.3.2 | calculo | Informe de ensayos BT |
| 76 | INSTALACIÓN Inclinación string A.3.2 | calculo | Informe de ensayos BT |
| 77 | INSTALACIÓN Orientación Azimut string A.4.1 | calculo | Informe de ensayos BT |
| 78 | INSTALACIÓN Inclinación string A.4.1 | calculo | Informe de ensayos BT |
| 79 | INSTALACIÓN Orientación Azimut string A.4.2 | calculo | Informe de ensayos BT |
| 80 | INSTALACIÓN Inclinación string A.4.2 | calculo | Informe de ensayos BT |
| 82 | INVERSOR Cantidad | manual | Cuadro de carga |
| 88 | INVERSOR A Pdc-máx GEN. PV | catalogo |  |
| 90 | INVERSOR A Smáx | catalogo |  |
| 91 | INVERSOR A Iac-nom | catalogo | Cuadro de carga, Informe de ensayos BT, Informe de ensayos MT, Memoria explicativa |
| 92 | INVERSOR A Iac-max | calculo | Memoria explicativa, Señaléticas |
| 118 | EMPALME Condición | manual | Memoria explicativa |
| 120 | EMPALME Corriente máxima | calculo | Memoria explicativa |
| 121 | EMPALME Curva protección | manual |  |
| 125 | EMPALME Potencia máxima | catalogo |  |
| 144 | PROT DIF FV Modelo | manual |  |
| 147 | PROT DIF FV Clase | catalogo | Informe de ensayos BT, Informe de ensayos MT, Memoria explicativa |
| 156 | PROT GRAL Modelo | manual |  |
| 159 | PROT GRAL Corriente de cortocircuito | catalogo |  |
| 160 | PROT GRAL Polos | calculo |  |
| 171 | Tramo 0 | manual | Cuadro de carga |
| 172 | Conductor UG - Inversor Sistema de medida | calculo | Cuadro de carga |
| 175 | Conductor UG - Inversor Método de instalación | calculo |  |
| 176 | Conductor UG - Inversor Temperatura ambiente | calculo |  |
| 177 | Conductor UG - Inversor Resistividad | catalogo | Cuadro de carga |
| 178 | Conductor UG - Inversor Factor temperatura | catalogo |  |
| 179 | Conductor UG - Inversor Cantidad por tubería | calculo | Memoria explicativa |
| 180 | Conductor UG - Inversor Factor cantidad | catalogo |  |
| 181 | Conductor UG - Inversor Capacidad | catalogo | Cuadro de carga, Informe de ensayos BT, Informe de ensayos MT, Memoria explicativa |
| 182 | Conductor UG - Inversor Ampacidad | calculo |  |
| 183 | Conductor UG - Inversor Cantidad mínima módulos | calculo |  |
| 184 | Conductor UG - Inversor VP-máx | calculo |  |
| 187 | Conductor UG - Inversor Tensión nominal | calculo | Informe de ensayos BT, Informe de ensayos MT |
| 188 | Conductor UG - Inversor Diámetro | catalogo | Memoria explicativa |
| 189 | Conductor UG - Inversor Área transversal | catalogo |  |
| 193 | Ducto UG - Inversor Área transversal A (exterior) | calculo |  |
| 194 | Ducto UG - Inversor Razón área útil A (exterior) | calculo | Memoria explicativa |
| 197 | Ducto UG - Inversor Área transversal B (exterior) | calculo |  |
| 198 | Ducto UG - Inversor Razón área útil B (exterior) | calculo | Memoria explicativa |
| 201 | Ducto UG - Inversor Área transversal C (exterior) | calculo |  |
| 202 | Ducto UG - Inversor Razón área útil C (exterior) | calculo | Memoria explicativa |
| 203 | Subtramos UG - Inversor Cantidad | calculo |  |
| 205 | Tramo AC de inversor a TFV | manual | Cuadro de carga, Cubicación, Memoria explicativa |
| 206 | Conductor Inversor - TFV Sistema de medida | manual | Cuadro de carga, Cubicación |
| 210 | Conductor Inversor - TFV Método de instalación | manual | Memoria explicativa |
| 211 | Conductor Inversor - TFV Temperatura ambiente | calculo |  |
| 212 | Conductor Inversor - TFV Resistividad | catalogo | Cuadro de carga |
| 213 | Conductor Inversor - TFV Factor temperatura | catalogo |  |
| 214 | Conductor Inversor - TFV Cantidad por tubería | calculo | Cuadro de carga |
| 215 | Conductor Inversor - TFV Factor cantidad | catalogo |  |
| 216 | Conductor Inversor - TFV Capacidad | catalogo | Cuadro de carga, Memoria explicativa |
| 217 | Conductor Inversor - TFV Ampacidad | calculo |  |
| 218 | Conductor Inversor - TFV Vp-máx | calculo |  |
| 221 | Conductor Inversor - TFV Diámetro fase | catalogo |  |
| 222 | Conductor Inversor - TFV Diámetro neutro | catalogo |  |
| 223 | Conductor Inversor - TFV Área transversal | catalogo |  |
| 227 | Ducto Inversor - TFV Área transversal A (exterior) | calculo |  |
| 228 | Ducto Inversor - TFV Razón área útil A (exterior) | calculo | Memoria explicativa |
| 231 | Ducto Inversor - TFV Área transversal B (exterior) | calculo |  |
| 232 | Ducto Inversor - TFV Razón área útil B (exterior) | calculo | Memoria explicativa |
| 235 | Ducto Inversor - TFV Área transversal C (exterior) | calculo |  |
| 236 | Ducto Inversor - TFV Razón área útil C (exterior) | calculo | Memoria explicativa |
| 237 | Ducto Inversor - TFV Cantidad de tipos | calculo |  |
| 239 | Tramo AC a TG o TGFV | manual | Cuadro de carga, Cubicación, Memoria explicativa |
| 240 | Conductor TFV - TG Sistema de medida | manual | Cuadro de carga, Cubicación |
| 244 | Conductor TFV - TG Método de instalación | manual | Memoria explicativa |
| 245 | Conductor TFV - TG Temperatura ambiente | calculo |  |
| 246 | Conductor TFV - TG Resistividad | catalogo | Cuadro de carga |
| 247 | Conductor TFV - TG Factor temperatura | catalogo |  |
| 248 | Conductor TFV - TG Cantidad por tubería | calculo | Cuadro de carga |
| 249 | Conductor TFV - TG Factor cantidad | catalogo |  |
| 250 | Conductor TFV - TG Capacidad | catalogo | Cuadro de carga, Memoria explicativa |
| 251 | Conductor TFV - TG Ampacidad | calculo |  |
| 252 | Conductor TFV - TG Vp-máx | calculo |  |
| 255 | Conductor TFV - TG Diámetro fase | catalogo |  |
| 256 | Conductor TFV - TG Diámetro neutro | catalogo |  |
| 257 | Conductor TFV - TG Área transversal | catalogo |  |
| 261 | Ducto TFV - TG Área transversal A (exterior) | calculo |  |
| 262 | Ducto TFV - TG Razón área útil A (exterior) | calculo | Memoria explicativa |
| 265 | Ducto TFV - TG Área transversal B (exterior) | calculo |  |
| 266 | Ducto TFV - TG Razón área útil B (exterior) | calculo | Memoria explicativa |
| 269 | Ducto TFV - TG Área transversal C (exterior) | calculo |  |
| 270 | Ducto TFV - TG Razón área útil C (exterior) | calculo | Memoria explicativa |
| 271 | Ducto TFV - TG Cantidad de tipos | calculo |  |
| 273 | Tramo AC hacia el EMPALME | manual | Cuadro de carga, Cubicación, Memoria explicativa |
| 274 | Conductor TG - Empalme Sistema de medida | manual | Cuadro de carga, Cubicación |
| 278 | Conductor TG - Empalme Método de instalación | manual | Memoria explicativa |
| 279 | Conductor TG - Empalme Temperatura ambiente | calculo |  |
| 280 | Conductor TG - Empalme Resistividad | catalogo | Cuadro de carga |
| 281 | Conductor TG - Empalme Factor temperatura | catalogo |  |
| 282 | Conductor TG - Empalme Cantidad por tubería | calculo | Cuadro de carga |
| 283 | Conductor TG - Empalme Factor cantidad | catalogo |  |
| 284 | Conductor TG - Empalme Capacidad | catalogo | Cuadro de carga, Memoria explicativa |
| 285 | Conductor TG - Empalme Ampacidad | calculo |  |
| 286 | Conductor TG - Empalme Vp-máx | calculo |  |
| 289 | Conductor TG - Empalme Diámetro fase | catalogo |  |
| 290 | Conductor TG - Empalme Diámetro neutro | catalogo |  |
| 291 | Conductor TG - Empalme Área transversal | catalogo |  |
| 295 | Ducto TG - Empalme Área transversal A (exterior) | calculo |  |
| 296 | Ducto TG - Empalme Razón área útil A (exterior) | calculo | Memoria explicativa |
| 299 | Ducto TG - Empalme Área transversal B (exterior) | calculo |  |
| 300 | Ducto TG - Empalme Razón área útil B (exterior) | calculo | Memoria explicativa |
| 303 | Ducto TG - Empalme Área transversal C (exterior) | calculo |  |
| 304 | Ducto TG - Empalme Razón área útil C (exterior) | calculo | Memoria explicativa |
| 305 | Ducto TG - Empalme Cantidad de tipos | calculo |  |
| 307 | Tramo TG a SAVE | manual | Cuadro de carga, Cubicación, Memoria explicativa |
| 308 | Conductor TG - SAVE Sistema de medida | manual | Cuadro de carga, Cubicación, Memoria explicativa |
| 312 | Conductor TG - SAVE Método de instalación | manual | Memoria explicativa |
| 313 | Conductor TG - SAVE Temperatura ambiente | calculo |  |
| 314 | Conductor TG - SAVE Resistividad | catalogo | Cuadro de carga |
| 315 | Conductor TG - SAVE Factor temperatura | catalogo |  |
| 316 | Conductor TG - SAVE Cantidad por tubería | calculo | Cuadro de carga |
| 317 | Conductor TG - SAVE Factor cantidad | catalogo |  |
| 318 | Conductor TG - SAVE Capacidad | catalogo | Cuadro de carga, Memoria explicativa |
| 319 | Conductor TG - SAVE Ampacidad | calculo |  |
| 320 | Conductor TG - SAVE Vp-máx | calculo |  |
| 323 | Conductor TG - SAVE Diámetro fase | catalogo |  |
| 324 | Conductor TG - SAVE Diámetro neutro | catalogo |  |
| 325 | Conductor TG - SAVE Área transversal | catalogo |  |
| 329 | Ducto TG - SAVE Área transversal A (exterior) | calculo |  |
| 330 | Ducto TG - SAVE Razón área útil A (exterior) | calculo | Memoria explicativa |
| 333 | Ducto TG - SAVE Área transversal B (exterior) | calculo |  |
| 334 | Ducto TG - SAVE Razón área útil B (exterior) | calculo | Memoria explicativa |
| 337 | Ducto TG - SAVE Área transversal C (exterior) | calculo |  |
| 338 | Ducto TG - SAVE Razón área útil C (exterior) | calculo | Memoria explicativa |
| 339 | Ducto TG - SAVE Cantidad de tipos | calculo |  |
| 343 | Puesta a tierra Largo | calculo |  |
| 344 | Puesta a tierra Ancho | calculo |  |
| 345 | Puesta a tierra Área | calculo |  |
| 346 | Puesta a tierra Profundidad | calculo |  |
| 347 | Puesta a tierra Resistividad equivalente | manual |  |
| 348 | Puesta a tierra Cantidad de retículos | calculo |  |
| 349 | Conductor Puesta a tierra Sistema de medida | manual |  |
| 350 | Conductor fase Calibre | manual | Cubicación |
| 354 | Ducto Puesta a tierra Diámetro | manual |  |
| 355 | Ducto Puesta a tierra Tipo | manual |  |
| 357 | Ubicación planta fotovoltaica | manual | Cuadro de carga |
| 358 | Ubicación inversor | manual | Cuadro de carga |

## Listas desplegables

121 campos tienen lista en el Excel. Las que dependen de otra celda (INDIRECT):

| Fila | Campo | Celda | Lista | Depende de |
|---|---|---|---|---|
| 13 | COMUNA | B9 | INDIRECT($B$8) | B8 |
| 54 | MÓDULO Modelo | B47 | INDIRECT($B$46) | B46 |
| 84 | INVERSOR A Modelo | B77 | INDIRECT($B$76) | B76 |
| 119 | EMPALME Protección | B112 | INDIRECT($B$109) | B109 |
| 144 | PROT DIF FV Modelo | B137 | INDIRECT("Dif_A_"&$B$109) | B109 |
| 173 | Conductor UG - Inversor Calibre | B166 | INDIRECT(B165) | B165 |
| 207 | Conductor Inversor - TFV Calibre fase | B200 | INDIRECT(B165) | B165 |
| 208 | Conductor Inversor - TFV Calibre neutro | B201 | INDIRECT(B199) | B199 |
| 241 | Conductor TFV - TG Calibre fase | B234 | INDIRECT(B165) | B165 |
| 242 | Conductor TFV - TG Calibre neutro | B235 | INDIRECT(B199) | B199 |
| 275 | Conductor TG - Empalme Calibre fase | B268 | INDIRECT(B165) | B165 |
| 276 | Conductor TG - Empalme Calibre neutro | B269 | INDIRECT(B199) | B199 |
| 309 | Conductor TG - SAVE Calibre fase | B302 | INDIRECT(B165) | B165 |
| 310 | Conductor TG - SAVE Calibre neutro | B303 | INDIRECT(B199) | B199 |
| 361 | SAVE Modelo | G301 | INDIRECT(B165) | B165 |
| 377 | PROT DIF SAVE Modelo | G320 | INDIRECT("Dif_A_"&$B$109) | B109 |

### Problemas en las listas de la plantilla

- "Conductor Inversor - TFV Calibre fase" (B200) usa INDIRECT(B165): toma el sistema de medida del tramo UG - Inversor (B165) y no el de su propio tramo. Si un tramo usa AWG y otro mm², la lista sale equivocada. En la app cada tramo usa su propio sistema.
- "Conductor TFV - TG Calibre fase" (B234) usa INDIRECT(B165): toma el sistema de medida del tramo UG - Inversor (B165) y no el de su propio tramo. Si un tramo usa AWG y otro mm², la lista sale equivocada. En la app cada tramo usa su propio sistema.
- "Conductor TG - Empalme Calibre fase" (B268) usa INDIRECT(B165): toma el sistema de medida del tramo UG - Inversor (B165) y no el de su propio tramo. Si un tramo usa AWG y otro mm², la lista sale equivocada. En la app cada tramo usa su propio sistema.
- "Conductor TG - SAVE Calibre fase" (B302) usa INDIRECT(B165): toma el sistema de medida del tramo UG - Inversor (B165) y no el de su propio tramo. Si un tramo usa AWG y otro mm², la lista sale equivocada. En la app cada tramo usa su propio sistema.
- "SAVE Modelo" (G301) usa la lista INDIRECT(B165): apunta al sistema de medida de un cable en vez de la marca del cargador (G300). En el Excel ese desplegable muestra calibres. En la app se usa la marca del cargador.

## Campos que se calculan en otra hoja

Estos campos traen su valor desde "Cuadro de carga" (la caída de tensión se calcula ahí y vuelve a la ficha). El motor (0.3) debe traducir también esas fórmulas.

| Fila | Campo | Viene de |
|---|---|---|
| 185 | Conductor UG - Inversor VP-V | Cuadro de carga!AA33 |
| 186 | Conductor UG - Inversor VP-% | Cuadro de carga!AB33 |
| 219 | Conductor Inversor - TFV Vp-V | Cuadro de carga!T60 |
| 220 | Conductor Inversor - TFV Vp-% | Cuadro de carga!U60 |
| 253 | Conductor TFV - TG Vp-V | Cuadro de carga!T63 |
| 254 | Conductor TFV - TG Vp-% | Cuadro de carga!U63 |
| 287 | Conductor TG - Empalme Vp-V | Cuadro de carga!T66 |
| 288 | Conductor TG - Empalme Vp-% | Cuadro de carga!U66 |
| 321 | Conductor TG - SAVE Vp-V | Cuadro de carga!T69 |
| 322 | Conductor TG - SAVE Vp-% | Cuadro de carga!U69 |

## Nombres repetidos

Ninguno en la plantilla vigente.

## Filas sin campo

| Fila | Tipo | Texto |
|---|---|---|
| 1 | titulo | 0 - 0 [#0] |
| 6 | roto | #REF! |
| 7 | roto | #REF! |
| 8 | roto | #REF! |
| 11 | roto | #REF! |
| 23 | roto | #REF! |
| 24 | roto | #REF! |
| 25 | roto | #REF! |

## Columnas de ZonOS (Información proyecto R3:AY3)

| # | Col. | Encabezado | Campos que la usan |
|---|---|---|---|
| 1 | R | Proyecto Nombre | PROYECTO Nombre |
| 2 | S | ON XX |  |
| 3 | T | Nombre Cliente Completo | PROPIETARIA/O Nombre, REPRESENTANTE Nombre completo |
| 4 | U | RUT Cliente (sin punto ni guion) | PROPIETARIA/O RUT, REPRESENTANTE RUT |
| 5 | V | Nombre Representante | PROPIETARIA/O Nombre, REPRESENTANTE Nombre completo |
| 6 | W | RUT Representante | PROPIETARIA/O RUT, REPRESENTANTE RUT |
| 7 | X | Vendedor |  |
| 8 | Y | Region | REGIÓN |
| 9 | Z | Comuna | COMUNA |
| 10 | AA | Coordenadas | COORD Latitud, COORD Longitud |
| 11 | AB | Potencia Nominal |  |
| 12 | AC | Potencia Peak |  |
| 13 | AD | Tipo de instalacion |  |
| 14 | AE | Inclinacion? |  |
| 15 | AF | Baterias |  |
| 16 | AG | Marca de Inversores |  |
| 17 | AH | Cantidad de Paneles |  |
| 18 | AI | Potencia Paneles |  |
| 19 | AJ | Tipo Empalme |  |
| 20 | AK | Tipo bateria y cantidad |  |
| 21 | AL | Distribuidora | EMPRESA DISTRIBUIDORA |
| 22 | AM | N° Cliente | NÚMERO DE CLIENTA/E |
| 23 | AN | Direccion Calle | DIRECCIÓN Calle |
| 24 | AO | Direccion Número | DIRECCIÓN Número |
| 25 | AP | Tarifa |  |
| 26 | AQ | N° Medidor |  |
| 27 | AR | Nombre Contacto |  |
| 28 | AS | Correo Contacto |  |
| 29 | AT | Teléfono Contacto |  |
| 30 | AU | Latitud |  |
| 31 | AV | Longitud |  |
| 32 | AW | Comentarios |  |
| 33 | AX | UTMX |  |
| 34 | AY | UTMY |  |
