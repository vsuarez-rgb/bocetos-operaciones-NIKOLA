# Paso 0 · Datos de partida (17-11-2026)

Los Excel reales y las filas de ZonOS están en `Proyecto Diseño OPS/_validacion-paso0/`, al lado de la carpeta `Git/` y **fuera del repositorio**. No se suben a git porque traen datos personales de clientes: nombres, RUT, correos y teléfonos.

## 1. Excel "Campos Autocad" para la validación (0.7)

Plantilla oficial: `Campos Autocad -.xlsm`, en *2 OPERACIONES / 00 Template Particulares* del Drive. Cada proyecto tiene una copia en su carpeta.

| Archivo en `_validacion-paso0/excel` | Caso | Inversor | Batería | Cargador (SAVE) | Planos PDF en Drive |
|---|---|---|---|---|---|
| ON 921 - monofasico simple | Monofásico 220 V | SUN2000-8K-LC0 | No | No | Sí ("ON 921 - Planos - Proyecto monofasico") |
| ON 936 - trifasico + cargador | Trifásico 380 V | SUN2000-12KTL-MAP0 | No | Huawei SCharger-7KS-S0 | No (solo la propuesta). Confirmar que el Excel está terminado |
| ON 909 - monofasico + bateria + cargador | Monofásico 220 V | SUN2000-8K-LC0 | LUNA2000-7-S1 (1 módulo, DC/DC 10KW-C1) | Huawei SCharger-7KS-S0 | Sí, más la Memoria TE6 y el Informe de ensayos en PDF |
| ESP 15 (archivo ON 502 NUEVO) | Monofásico, proyecto especial | SUN2000-5KTL-L1 | No | Wallbox Pulsar Plus 7,4 kW | — |

Otros proyectos que también sirven: ON 966 (monofásico, batería y cargador), ON 939 INV 1 y INV 2 (un proyecto con dos inversores, en dos Excel), ON 940 (cargador EVinka) y ON 943 / ON 957 (monofásicos simples). Entre los Excel revisados, ON 936 es el único trifásico.

### Lo que hay que saber de los Excel
- Hojas: Cuadro de carga (IMG), Cuadro de carga, Información proyecto, AAA M. Explicativa, **Autocad**, Equipos, Señaléticas, Cables y canalización, Template Procedimiento, Cubicación, EMAT, A. P., TE6, Informe de ensayos BT y MT.
- **Autocad** tiene 382 filas. La columna A es el nombre del campo, B el valor, C la unidad y, en algunos calibres AWG, D la sección en mm². En ON 921 hay 277 filas con nombre: las que faltan para llegar a 357 son strings y tramos que ese proyecto no usa.
- La hoja Autocad trae **errores heredados de la plantilla**: `#REF!` en las filas 6–8, 11 y 23–25, y `#N/A` / `#VALUE!` en los tramos que no se usan. Hay entre 9 y 22 por archivo. En la comparación del 0.7 hay que tratarlos como "vacío esperado", no como diferencia.
- El nombre del campo **SAVE** corresponde al cargador. La marca viene como `SAVE_Huawei`, `SAVE_Wallbox` o `SAVE_EVinka`, y `0` si no hay cargador. **Ojo:** "SAVE Modelo" queda en `SCharger-7KS-S0` aunque no haya cargador (pasa en ON 943 y ON 957). Para saber si hay cargador hay que mirar "SAVE Marca".
- ON 921: ZonOS dice 16 paneles × 720 Wp (11,520 kWp), pero el diseño final usa 730 Wp (11,68 kWp). Es decir, Ops corrige los datos de ZonOS, y eso confirma la idea de que cualquier campo se pueda sobrescribir.

## 2. Formato de la fila de ZonOS (0.5)

**Son 34 columnas, no 32.** Las dos últimas son UTM X y UTM Y. En el Excel se pegan en `Información proyecto!R4`, y los encabezados están en la fila 3 (columnas R → AY).

| # | Col. Excel | Encabezado | Ejemplo de formato (valores inventados) |
|---|---|---|---|
| 1 | R | Proyecto Nombre | `ON 921 - Nombre Apellido` |
| 2 | S | ON XX | `ON 921` · también `ESP 15` |
| 3 | T | Nombre Cliente Completo | texto |
| 4 | U | RUT Cliente (sin punto ni guion) | `"123456785"` (entre comillas en la fila cruda) · a veces viene con puntos y guion |
| 5 | V | Nombre Representante | vacío casi siempre |
| 6 | W | RUT Representante | vacío casi siempre |
| 7 | X | Vendedor | texto |
| 8 | Y | Region | `Región del Maule` / `Valparaíso` (sin "Región de") |
| 9 | Z | Comuna | texto |
| 10 | AA | Coordenadas | `"-35.1234567, -71.1234567"` · **punto decimal y coma con espacio entre lat y long** |
| 11 | AB | Potencia Nominal | `8 kW` |
| 12 | AC | Potencia Peak | `11.520 kWp` (el punto es decimal, con 3 decimales) |
| 13 | AD | Tipo de instalacion | `Techo - Zinc`, `On Grid en Techo - Zinc`, `Especial en Zinc` |
| 14 | AE | Inclinacion? | vacío casi siempre |
| 15 | AF | Baterias | `1` o vacío |
| 16 | AG | Marca de Inversores | texto libre: `Huawei SUN2000 LC0 8kW`, `Huawei SUN2000-(8-10KTL)-LC0`, `Huawei SUN2000 MAP0 12kW` |
| 17 | AH | Cantidad de Paneles | `16` |
| 18 | AI | Potencia Paneles | `720 Wp` |
| 19 | AJ | Tipo Empalme | `Monofásico` / `Trifásico` |
| 20 | AK | Tipo bateria y cantidad | `Huawei LUNA2000-7-E1 7kWh x2` |
| 21 | AL | Distribuidora | `CGE`, `LUZLINARES`, `ENEL DISTRIBUCION CHILE S.A.` |
| 22 | AM | N° Cliente | `"1234567"` o `123456-7` |
| 23 | AN | Direccion Calle | a veces trae el número y la comuna en el mismo campo |
| 24 | AO | Direccion Número | número o vacío |
| 25 | AP | Tarifa | `BT1`, `THRF` |
| 26 | AQ | N° Medidor | `"7654321"` |
| 27 | AR | Nombre Contacto | texto |
| 28 | AS | Correo Contacto | texto |
| 29 | AT | Teléfono Contacto | `"56912345678"` |
| 30 | AU | Latitud | `"-33.1234567"` |
| 31 | AV | Longitud | `"-70.1234567"` |
| 32 | AW | Comentarios | historial de mensajes en una sola línea, separado por ` \| ` |
| 33 | AX | UTMX | `345678.1234567890` |
| 34 | AY | UTMY | `6312345.123456789` |

Detalles del formato (sacados de la fila cruda `ON 938 - ... .txt` en *Proyecto Cubicacion EMAT/ejemplo ON 938* y de las filas pegadas en 5 Excel):
- Separador: **tabulación**. Fin de línea: **CRLF**. Codificación: UTF-8.
- Los números que deben quedar como texto (RUT, N° cliente, N° medidor, teléfono y coordenadas) vienen **entre comillas dobles**. Al pegar hay que quitar las comillas.
- Los decimales vienen con **punto**, no con coma.
- **Latitud y Longitud por separado (AU/AV) no son confiables.** Al pegarlas en un Excel configurado en español, se pierde el punto: en ON 936, ON 966 y ESP 15 quedó `-331234567` en vez de `-33.1234567`. Por eso la fórmula del Excel lee la columna **AA (Coordenadas)**. La app debe hacer lo mismo: separar AA por la coma y usar AU/AV solo para comprobar.
- La zona UTM (`19 H`) y el datum (`WGS84`) no vienen de ZonOS: son valores fijos del Excel.

Ejemplos reales en `_validacion-paso0/zonos/`: tres filas reconstruidas desde los Excel (ON 921, ON 936 y ON 909) y la fila cruda original de ON 938, copiada tal cual desde ZonOS.

## 3. Hojas que se dejan fuera por ahora

Memoria explicativa, TE6, Informe de ensayos y Señaléticas: se dejan fuera del paso 0. Al armar el diccionario (0.2) conviene anotar qué campos usa cada una de esas hojas, para que agregarlas después sea solo armar la plantilla de salida. En Drive ya existen PDF generados de ON 909 ("Memoria Explicativa TE6 - ON 909" e "Informe de Ensayos - ON 909") que sirven como referencia cuando toque.
