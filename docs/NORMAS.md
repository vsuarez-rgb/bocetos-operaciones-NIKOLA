# Normas de diseño en la app

Archivo generado desde `js/normas.js` (24-11-2026). Fuentes: carpeta *05. Legislación y Normativa* del Drive de Operaciones (RGR N°01, 02 y 06 de 2024; RIC N°01, 02, 04, 06, 15 (2024) y 18; manual TE6). Se eligieron solo las que afectan el diseño y el plano; los ajustes de protecciones, pruebas y trámites quedan fuera.

- **Se revisan en el dibujo**: alturas y espacio libre en la vista de frente (con nivel de piso) y largo de canalizaciones (con escala). Avisan en rojo y se marcan como revisadas.
- **Checklist**: no se pueden medir en el dibujo; se marcan por proyecto en el paso Equipos y canalización.
- Se editan en la app: lista de proyectos → **Configuración → Normas**.

## Se revisan en el dibujo (14)

| Activa | Norma | Proyectos | Origen | Fuente | Nota |
|---|---|---|---|---|---|
| ✔︎ | Inversor: borde inferior a 0,60 m o más y borde superior a 2,0 m o menos del piso | Todos los proyectos | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 12 Inversores · p. 30 | La norma no dice a qué borde se mide: se usa el criterio que RGR N°06/2024 da para el equipo de conversión (PCE). No aplica a microinversores, inversores en gabinete ni autosoportados. |
| ✔︎ | Inversor: 15 cm libres a cada lado, o lo que pida el fabricante si es más | Todos los proyectos | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 12 Inversores · p. 30 | El espacio del fabricante (arriba, abajo y lados) sale del manual de cada familia: se ve en Configuración → Equipos. |
| ✔︎ | Tableros: mandos entre 0,45 m y 2,0 m del piso | Todos los proyectos | Normativa SEC | Pliego RIC N°02 Tableros · pto. 6.1.22 · p. 10 | La norma mide a la base de cada dispositivo de comando; revisar el borde del tablero es más exigente. Para tableros IRVE lo repite RIC N°15 (2024) 8.6. |
| ✔︎ | Tableros a la intemperie: al menos 50 cm del suelo | Todos los proyectos | Criterio Nikola | Criterio interno Nikola | No aparece en la normativa revisada. Es más exigente que RIC N°02 (0,45 m). |
| ◻︎ | Tableros en armario: al menos 30 cm del suelo | Todos los proyectos | Criterio Nikola | Criterio interno Nikola | Desactivada: RIC N°02 6.1.22 pide 0,45 m a los mandos, que es más exigente. |
| ✔︎ | Baterías: altura de término de 2,2 m o menos | Todos los proyectos | Normativa SEC | RGR N°06/2024 (sistemas de almacenamiento) · Ubicación del BESS · p. 23-24 |  |
| ✔︎ | Cargador de muro: conector entre 1,0 m y 1,3 m del piso | Todos los proyectos | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 15.4 · p. 27 | Se toma el centro del cargador como altura del conector. Cargador tipo tótem: 0,6–1,3 m. |
| ✔︎ | Cargador: más de 10 cm sobre el piso | Todos los proyectos | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 15.2 · p. 27 | No aplica si el cargador trae una base de esa altura. |
| ◻︎ | Empalmes en recinto o armario: borde inferior a 0,80 m o más y superior a 2,10 m o menos | Todos los proyectos | Normativa SEC | Pliego RIC N°01 Empalmes · pto. 7.8.4 · p. 5 | Solo empalmes concentrados. RIC N°01 no fija altura para un medidor individual. |
| ✔︎ | Canalizaciones: al menos 15 cm del suelo (salvo que vayan a suelo) | Todos los proyectos | Criterio Nikola | Criterio interno Nikola |  |
| ◻︎ | Tubería a la vista: conveniente a 2,5 m o más | Todos los proyectos | Normativa SEC | Pliego RIC N°04 Conductores y canalizaciones · pto. 7.16.4.8 · p. 58 | La norma dice "conveniente", no obligatorio. Desactivada para no llenar de avisos las bajadas a los equipos. |
| ✔︎ | CC: 80 m o menos entre el inversor (AFCI) y el último módulo | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · pto. 12.4 · p. 29 | Salvo que el fabricante acredite más. Se revisa cada canalización dibujada. |
| ✔︎ | Inversor a más de 30 m del tablero: va un tablero FV junto al inversor | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · pto. 14.21 · p. 35 | Se revisan las canalizaciones marcadas como tramo «Inversor – TGFV». |
| ✔︎ | Tablero a más de 30 m del medidor: va un tablero general junto al medidor | Todos los proyectos | Normativa SEC | Pliego RIC N°02 Tableros · pto. 6.5.2 · p. 13 | Se revisan las canalizaciones marcadas como tramo «TG – Empalme». |

## Checklist del proyecto (25)

| Activa | Norma | Proyectos | Origen | Fuente | Nota |
|---|---|---|---|---|---|
| ✔︎ | CC sin tramos aéreos, sin compartir ducto con CA o comunicaciones (salvo separador) y sin pasar por tableros CA | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 10 y 11.2 · p. 23-24 |  |
| ✔︎ | Cable sin canalizar entre la canalización o caja y el inversor: 40 cm o menos (CC y CA) | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 9 · p. 20 y 23 — **verificar punto** |  |
| ✔︎ | Paneles y estructura no sobresalen del techo, y queda espacio para apoyar una escalera | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 6 · p. 15 — **verificar punto** |  |
| ✔︎ | 10 kW o más: acceso y cuerda de vida. 30 kW o más: además pasillo técnico y vía de tránsito (exento si el techo tiene 5° o menos, es rígido y transitable, y el plano marca las zonas de tránsito) | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · pto. 7.7 y 7.8 · p. 16-17 |  |
| ✔︎ | Un MPPT no mezcla modelos de panel ni orientaciones | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 8 · p. 18-19 |  |
| ✔︎ | Caída de tensión: CC bajo 1,5 %; CA bajo 3 % entre el empalme y la protección RI | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 11 · p. 26 | La app ya avisa en el paso Strings la caída CC sobre 1,5 %. |
| ✔︎ | Diferencial CA según la generación: hasta 5 kW 30 mA; 5–10 kW 100 mA; 10–30 kW 300 mA | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Protecciones CA — **verificar punto** |  |
| ✔︎ | Interruptor general FV en el tablero y otro de separación en el empalme | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · pto. 14.12 y 19.2 |  |
| ✔︎ | Tierra de protección de 4 mm² o más (2,5 mm² en ducto o multiconductor); estructura y pasillos técnicos a tierra | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 11 y 17 · p. 27 y 39 |  |
| ✔︎ | Placa junto al medidor (70 × 40 mm o más, letra de 5 mm): "PRECAUCIÓN ESTA PROPIEDAD CUENTA CON UN SISTEMA DE GENERACIÓN FOTOVOLTAICA" | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · pto. 18.2 a 18.4 · p. 41 |  |
| ✔︎ | Señalética cerca de los paneles (100 × 200 mm, anexo 7), apagado de emergencia junto al inversor, rótulo en cada caja CC y strings numerados | Fotovoltaico | Normativa SEC | RGR N°02/2024 (instalaciones FV conectadas a red) · Cap. 18 y anexo 7 · p. 42-43 |  |
| ✔︎ | Baterías fuera de: 600 mm a los lados de salidas, calefactores o aire acondicionado; 1200 mm bajo ellos; entretechos y bajo escaleras. 600 mm libres alrededor | Todos los proyectos | Normativa SEC | RGR N°06/2024 (sistemas de almacenamiento) · Ubicación del BESS · p. 21-24 |  |
| ✔︎ | Tableros y cajas a la intemperie con entradas por abajo. IP: interior IP41, bajo techo IP44, intemperie IP54 | Todos los proyectos | Normativa SEC | Pliego RIC N°02 Tableros · pto. 6.1.21 · p. 10 |  |
| ✔︎ | Frente libre de los tableros: 0,90 m (1,20 m frente a muro de hormigón o ladrillo; 1,50 m con partes vivas a ambos lados) | Todos los proyectos | Normativa SEC | Pliego RIC N°02 Tableros · pto. 5.4.2, tabla 2.1 · p. 6 |  |
| ✔︎ | Subterránea: tope del ducto a 0,45 m (peatonal) u 0,80 m (vehicular), ducto de 25 mm o más, mortero coloreado de 0,10 m y cinta; cámaras cada 90 m o menos | Todos los proyectos | Normativa SEC | Pliego RIC N°04 Conductores y canalizaciones · pto. 7.9.7 · p. 36-37 |  |
| ✔︎ | Tubería a la vista: soportes cada 1,5 m o menos (metálica), abrazadera a 0,4 m o menos de cajas y tableros, caja de registro cada 15 m o menos | Todos los proyectos | Normativa SEC | Pliego RIC N°04 Conductores y canalizaciones · pto. 7.16.4.4-5 y 7.16.1.7 · p. 57-58 |  |
| ✔︎ | Lámina: coordenadas WGS84 y 3 calles, lista de láminas "n de N", simbología, cuadro de generación, caídas de tensión por tramo, unilineal completo, escala preferente 1:50 | Todos los proyectos | Normativa SEC | Pliego RIC N°18 Presentación de proyectos; RGR N°01/2024 · pto. 5.7 y 6.3; cap. 7 |  |
| ✔︎ | Circuito exclusivo por cargador; diferencial tipo B, o tipo A de 30 mA más detección de 6 mA CC; magnetotérmico 2P (1F) o 4P (3F); 2,5 mm² o más | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 12.1, 12.4 y 12.5.4 · p. 19-20 |  |
| ✔︎ | Cargador exterior IP54 o más (IP44 en viviendas y edificios); interior IP44; IK08 | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 16.3.5 y 16.3.6 · p. 29 |  |
| ✔︎ | Cargador a 5 m o menos de la entrada de carga del vehículo; conector en el equipo o a menos de 1 m; cable de 3 a 8 m | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 15.3, 15.4 y 16.3 · p. 27-29 |  |
| ✔︎ | Donde circulan vehículos: tope de ruedas, barrera o columna anticolisión dibujada | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 15.8 y fig. 15.7.3 · p. 28 |  |
| ✔︎ | Tablero con puerta, cubre-equipos y placa "Alimentación de infraestructura de recarga de vehículos eléctricos IRVE" | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 8.3 · p. 14 |  |
| ✔︎ | Canalización en zona de vehículos con tubo de alta resistencia mecánica (tabla 15.2) | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 10.9 · p. 17 |  |
| ✔︎ | Conexión directa al empalme solo con un cargador de un conector a 3 m o menos del empalme | Solo cargador | Normativa SEC | Pliego RIC N°15 (2024) Recarga de vehículos eléctricos · pto. 14.1.4 · p. 22 |  |
| ✔︎ | Plano TE6: emplazamiento, ubicación de componentes, equipos con su certificación SEC y fabricante, detalle de protecciones; más memoria e informe de imágenes | Solo cargador | Normativa SEC | Manual de usuario TE6 (SEC) · Paso 8, adjunto 1 · p. 37 |  |

## Pendientes

- Confirmar en el PDF los puntos marcados "verificar" (el texto extraído de RGR N°02/2024 perdió parte de la numeración).
- Definir criterio Nikola para retiro a bordes, cumbrera y limatesa y para ancho de pasillo técnico: ninguna norma revisada lo fija.
- La Biblia Nikola dice 10 cm de separación con cañerías de agua; RIC N°04 7.9.9 pide 0,50 m (o 0,20 m con hormigón H15). Manda RIC N°04.
