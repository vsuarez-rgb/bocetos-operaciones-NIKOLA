# Pendientes

## En curso

- **Fase 2 · Material en el rótulo de la canalización.** Material, diámetro y n.º de tubos por tramo (`rt.material`, `rt.diam`, `rt.nTubos`) con el catálogo `MATERIALES_DUCTO`; rótulo "Conduit EMT 1xø32mm"; curvas propuestas en giros de más de 30°; cajas de paso y de derivación que tocan la ruta; cubicación por material y diámetro, que también llena la tabla "Resumen canalización".
- **Fase 3 · Frente del tablero automático.** Bloque de informe 'tablero' en SVG, armado desde el unilineal: caja con su medida, rieles DIN con las protecciones en orden y su ancho en módulos, barra repartidora y borneras, y notas en rojo. Reemplaza por defecto a la imagen "Layout del tablero" de la página con unilineal. Los anchos que falten en `equipos-emat.js` quedan configurables y marcados como pendientes. Referencia: los frentes de tablero de AutoCAD (Trifásico, Monofásico, con SAVE mono / tri).
- **Fase 1 · extra:** bloque de informe "Detalle de montaje" (corte lateral: triángulo con el ángulo y altura trasera = largo del panel × sen(ángulo)).
- **Normas y restricciones de la estructura:** revisar los valores por defecto pendientes (`docs/EQUIPOS-EMAT.md`, pendiente 6).

## Después

4. Texto "IMPORTANTE" en rojo con flecha (directriz) que apunta a un punto de la foto, en cualquier hoja.
5. Botón "Acotar bloque": largo y ancho del bloque, distancia a los bloques vecinos y al borde del techo más cercano (como el plano ON 957).
6. Biblioteca de anclajes ligada a `r.tipoTecho` (teja chilena, teja de cemento, mediterráneo, zinc, asfáltica, emballetado, losa): perno doble hilo, anclaje L, abrazadera SFS, anclaje químico o lastre en losa. Dibujos esquemáticos propios en SVG, no imágenes de fabricantes. Hoy el anclaje de cada techo es un texto libre (`r.montaje.anclaje`) que se usa en la nota de montaje; la biblioteca lo reemplazará por un id.
7. Equipo "Reserva futura" (rectángulo segmentado con texto, ej. "espacio para otra batería") y vista de frente de equipos sobre rieles RUC (revisar `conjuntos.js`).
8. Leyenda de colores en la planta, armada solo con lo que se usa en la hoja: CA artefactos, CA canalización, CA subterránea, CA medidor, CA tablero, CC artefactos, CC canalización, CC subterránea (segmentada) y CC panel fotovoltaico.
