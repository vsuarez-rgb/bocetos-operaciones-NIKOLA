# Pendientes

## En curso

- **Fase 2 · Material en el rótulo de la canalización.** Material, diámetro y n.º de tubos por tramo (`rt.material`, `rt.diam`, `rt.nTubos`) con el catálogo `MATERIALES_DUCTO`; rótulo "Conduit EMT 1xø32mm"; curvas propuestas en giros de más de 30°; cajas de paso y de derivación que tocan la ruta; cubicación por material y diámetro, que también llena la tabla "Resumen canalización".
- **Fase 3 · Frente del tablero automático.** Bloque de informe 'tablero' en SVG, armado desde el unilineal: caja con su medida, rieles DIN con las protecciones en orden y su ancho en módulos, barra repartidora y borneras, y notas en rojo. Reemplaza por defecto a la imagen "Layout del tablero" de la página con unilineal. Los anchos que falten en `equipos-emat.js` quedan configurables y marcados como pendientes. Referencia: los frentes de tablero de AutoCAD (Trifásico, Monofásico, con SAVE mono / tri).
- **Bases de estructuras fijas y ajustables:** la primera versión (tipo de montaje con bases, anclajes y flecha "sube") se quitó por compleja. El usuario va a pensar cómo agregarlas; no retomar sin su diseño.
- **Detalle de montaje** (corte lateral con el ángulo): queda para cuando se definan las bases.
- **Normas y restricciones:** se revisan al final, todas juntas.

## Después

4. Texto "IMPORTANTE" en rojo con flecha (directriz) que apunta a un punto de la foto, en cualquier hoja.
5. Botón "Acotar bloque": largo y ancho del bloque, distancia a los bloques vecinos y al borde del techo más cercano (como el plano ON 957).
6. Biblioteca de anclajes ligada a `r.tipoTecho` (teja chilena, teja de cemento, mediterráneo, zinc, asfáltica, emballetado, losa): perno doble hilo, anclaje L, abrazadera SFS, anclaje químico o lastre en losa. Dibujos esquemáticos propios en SVG, no imágenes de fabricantes.7. Equipo "Reserva futura" (rectángulo segmentado con texto, ej. "espacio para otra batería") y vista de frente de equipos sobre rieles RUC (revisar `conjuntos.js`).
8. Leyenda de colores en la planta, armada solo con lo que se usa en la hoja: CA artefactos, CA canalización, CA subterránea, CA medidor, CA tablero, CC artefactos, CC canalización, CC subterránea (segmentada) y CC panel fotovoltaico.
