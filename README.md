# NIKOLA · Diseño Ops

Herramienta web para que Operaciones diseñe proyectos fotovoltaicos sin AutoCAD: se parte de la foto de dron, se dibujan techos, paneles, strings, equipos y canalización, y sale la lámina A1 (planta de techumbre + unilineal + cuadros de carga) lista para PDF, o un DXF para seguir en AutoCAD si hace falta.

Es un sitio **estático**: HTML, CSS y JavaScript sin compilación. No hay que instalar nada para editarlo.

## Pasos del diseño

| Paso | Qué se hace |
|---|---|
| 0 · Ficha | El Excel "Campos Autocad" dentro de la app: los 344 campos por sección, calculados con las fórmulas de la plantilla. Todo se puede editar: los campos calculados se reemplazan a mano y se vuelve al cálculo con ↺. Avisos del Excel junto al campo, listas desplegables (comunas según la región, modelos según la marca…), búsqueda y filtros (por completar, escritos a mano, con aviso). Los instaladores se cargan en el navegador (no se publican). |
| Hojas de diseño | Cada proyecto tiene varias hojas, una por imagen (pestañas abajo, como Modelo / Presentación en AutoCAD): la principal es el techo (foto de dron, paneles y strings) y se agregan otras —recorrido de canalización, zona de equipos, cargador, empalme— cada una con su foto, su escala y sus dibujos (equipos, canalización, cotas, textos). |
| Tipo de proyecto | La primera foto puede ser cualquiera: fotovoltaico (techo con paneles, foto de dron) o, por ejemplo, un EXT de solo cargador. La referencia de escala es opcional: sin ella se dibujan equipos (a tamaño aproximado), canalización y textos. |
| 1 · Escala | Se sube la foto de dron y se traza una medida conocida. Si la foto trae altura de vuelo (EXIF/XMP del dron), se compara con la escala. |
| 2 · Techos | Cada agua se dibuja como polilínea. Se puede escribir el largo de cada lado en metros (en la dirección del cursor). Al elegir un techo se define cómo es: inclinación, hacia dónde baja la pendiente y retiro al borde. El contorno es delgado y se puede ocultar fuera de este paso. |
| 3 · Elementos | Obstáculos, zonas no utilizables, objetos que se retiran y pasillos. |
| 4 · Paneles | Automático (llena el techo respetando retiro y zonas) o manual por bloques filas × columnas, como un arreglo de AutoCAD. Rieles por techo o por bloque (perpendiculares o paralelos) y, aparte, **perfiles** (rojos, 2 por fila, a lo largo de la fila: sobresalen del bloque, llegan hasta el borde del techo o se dibujan a mano); se pueden poner los dos. Rieles y perfiles también se pueden dibujar a mano. |
| 5 · Strings | Se asignan paneles a cada MPPT con clic o ventana. Calcula Voc, Voc en frío, Vmp, potencia y caída de tensión, y avisa si algo se sale del rango del inversor. |
| 6 · Equipos y canalización | Inversor, tableros, medidor, baterías, etc. a escala, y recorridos CC / CA / subterráneo / tierra con su largo. |
| Unilineal | Se arma solo con los datos del proyecto, con el estilo de los planos de Ops (tableros, protecciones con rótulo de 4 líneas, Smart Guard, batería, EV, entradas DC con VACANTE). Cualquier texto se cambia con un clic. En proyectos grandes (trifásico, más de un string por MPPT o más de 4 MPPT) va en dos láminas: AC y DC. |
| Informe y planos | Dos secciones de páginas: **Informe** (para el cliente) y **Láminas y planos** (A1 de siempre, planos para el contratista); el cajetín, firmas y notas de las láminas se editan ahí mismo. Páginas armadas con bloques que se mueven y cambian de tamaño: texto (con {Campos} de la ficha o del DWG), imagen, vista de cualquier hoja de diseño, tablas, unilineal y láminas A1 (modo plano). Tamaño y orientación por página. Tablas editables en la misma página (doble clic en una celda) y vistas encuadradas con el mouse como una ventana gráfica de AutoCAD (doble clic, rueda = zoom, arrastrar = mover, escala 1:N), con o sin marco. Plantillas incluidas a partir de los informes reales (Propuesta de diseño, Planos contratista, Láminas A1) y plantillas propias guardadas para reutilizar. PDF de todas las páginas, cada una con su tamaño. |

## Atajos (estilo AutoCAD)

- Rueda del mouse: zoom en el cursor · botón del medio o barra espaciadora: mover la vista
- **F3** referencia a objetos · **F7** rejilla de 1 m · **F8** orto
- **Enter** termina / cierra · **Esc** cancela · **Supr** borra lo seleccionado
- **Doble clic** sobre cualquier texto o número del dibujo (etiqueta, cota, medida, número de string, rótulo): se edita ahí mismo, con su tamaño al lado; desde el mismo cuadrito se quita la etiqueta o se borra la cota o el texto entero
- **Ctrl+Z / Ctrl+Y** deshacer / rehacer · **Ctrl+S** guardar
- Pantalla como AutoCAD: **barra superior** = lo que se dibuja o inserta en cada paso (techo, tipos de zona, rieles y perfiles a mano, strings, Insertar equipos o conjuntos, canalizaciones, cotas y textos); **barra lateral** = Seleccionar, Encuadre, Ajustar, Medir (DIST), **Figura** (línea, flecha, rectángulo, círculo o figura libre, con color, trazo, grosor y relleno, en cualquier paso) y Borrar; **panel derecho** = resumen del paso y propiedades de lo elegido (también del bloque de paneles); **CAPAS** en la barra de estado.
- Línea de comandos: `TECHO`, `ZONA`, `COTA`, `DIST`, `TEXTO`, `NORTE`, `CC`, `CA`, `SUB`, `EQUIPO`, `BORRAR`, `ZOOM`, `STRING`, `AUTOSTRING`, `PASO 1-7`, `AYUDA`. Mientras dibujas, escribe un número (en metros) para el siguiente punto.

## Estructura

```
index.html          Página única
css/app.css         Estilos (marca Nikola + interfaz oscura tipo AutoCAD)
js/app.js           Lista de proyectos, crear / importar / duplicar
js/editor.js        Editor: pasos, herramientas, línea de comandos, capas, propiedades
js/render.js        Dibujo del espacio modelo (editor y lámina)
js/geom.js          Cálculos: escala, paneles, strings, caídas de tensión
js/lamina.js        Lámina A1 en SVG, unilineal, cuadros de carga, PDF y DXF
js/equipos-emat.js  ← Base de equipos EMAT (SKU, datos eléctricos y medidas de ficha técnica)
js/catalogo.js      ← Colores, capas, símbolos y notas; arma paneles e inversores desde equipos-emat.js
docs/EQUIPOS-EMAT.md  Las mismas medidas en tablas, con fuentes y pendientes
js/store.js         Guardado en el navegador (IndexedDB) y proyecto de ejemplo
js/xlsx/libro.js    Lector de Excel (.xlsx/.xlsm) sin dependencias: lo usan la app y los scripts
js/ficha/           Ficha del proyecto (paso 0): importar Campos Autocad, datos y catálogos
js/util.js          Utilidades e íconos
assets/             Logos y foto de dron de ejemplo
data/catalogos/     Catálogos sacados de la plantilla "Campos Autocad" (se regeneran con scripts/)
scripts/            Herramientas en Node (no se publican): leer la plantilla y generar data/
docs/               Decisiones, datos del paso 0 y cruce de catálogos (no se publican)
```

### Regenerar los catálogos (paso 0)

Requiere Node (sin paquetes: el lector de Excel está en `scripts/leer-xlsx.mjs`). Con la plantilla vigente en la carpeta de arriba:

```
node scripts/extraer-catalogos.mjs            # usa ../Campos Autocad -.xlsm
node scripts/extraer-catalogos.mjs ruta.xlsm  # otra plantilla
```

Escribe `data/catalogos/*.json` y `docs/CRUCE-CATALOGOS.md`.

El diccionario de campos (las 382 filas de la hoja Autocad, cruzadas con la macro `../macro-GetCampo/Module1.bas`):

```
npm run diccionario   # → data/campos.json, docs/DICCIONARIO-CAMPOS.md, docs/referencia/formulas-plantilla.json
npm test              # comprueba el diccionario contra la macro
```

### Motor de cálculo y plantilla

La app **no tiene las fórmulas escritas a mano**: `js/ficha/motor.js` evalúa las fórmulas de la plantilla Campos Autocad (`data/plantilla/plantilla.json`) con una calculadora de Excel propia (`js/ficha/formulas.js`, 27 funciones). Así, si la plantilla cambia:

1. En la app, **Plantilla** (arriba en la lista de proyectos) → *Cargar plantilla nueva*: compara con la que está en uso, muestra qué campos cambian, qué fórmulas no puede calcular y cómo cambian los proyectos guardados. Se puede usar en ese navegador o descartar.
2. Para que todo Ops la use, se publica: `npm run plantilla` (y `npm run diccionario` si cambió la hoja Autocad), y después `npm run validar`.

Lo que el motor no pueda calcular queda marcado y ese campo se llena a mano en la ficha.

```
npm run plantilla   # ../Campos Autocad -.xlsm → data/plantilla/plantilla.json (sin datos de personas)
npm run validar     # motor vs. los Excel reales de ../_validacion-paso0 (detalle solo en esa carpeta)
npm test            # pruebas de la calculadora, del diccionario y de los perfiles
```

Validación al 18-11-2026: 3 proyectos con el 100 % de las celdas iguales al Excel y 1 con el 99,6 % (las 4 restantes son una fórmula antigua de ese Excel).

### Importar un "Campos Autocad" de un proyecto en curso

En la lista de proyectos, **Importar Campos Autocad** lee el `.xlsm` en el navegador (no se sube a ningún servidor) y crea un proyecto con su ficha: la fila de ZonOS, lo que Ops escribió o eligió a mano, las fórmulas que se reemplazaron a mano y los equipos que ese Excel agregó a su hoja *Equipos*. Lo mismo desde la terminal, con el mismo código (`js/ficha/importar.js`):

```
node scripts/importar-campos.mjs "../_validacion-paso0/excel/ON 921 - monofasico simple.xlsm"
```

El informe queda en `../_validacion-paso0/resultados/`, fuera del repositorio, porque trae datos del cliente. Los instaladores y proyectistas (datos personales) van a `../_privado/personas.json`, **fuera del repositorio**. Si algo con forma de RUT, correo o celular llega a `data/`, el script se detiene sin escribir.

### Cambios típicos

- **Agregar un panel, inversor u otro equipo:** `js/equipos-emat.js` (ver `docs/EQUIPOS-EMAT.md`).
- **Cambiar notas por defecto de la lámina:** `NOTAS_BASE` en `js/catalogo.js`.
- **Cajetín o tablas de la lámina:** funciones `franja()`, `lamina01()` y `lamina02()` en `js/lamina.js` (unidades en mm de la hoja A1).
- **Colores de strings o canalización:** `COLORES_STRING` y `CANAL` en `js/catalogo.js`.

## Correr en tu computador

Los módulos de JavaScript necesitan un servidor local (no funciona con doble clic en `index.html`):

- En VS Code con la extensión **Live Server**: clic derecho en `index.html` → *Open with Live Server*, o
- En la terminal: `npm run dev` y abre http://localhost:5173 (servidor local sin instalar nada: `scripts/servidor.mjs`)

## Publicar en Vercel

1. Crea un repositorio en GitHub y sube esta carpeta (en VS Code: *Source Control* → *Initialize Repository* → commit → *Publish Branch*).
2. En vercel.com → **Add New… → Project** → importa el repositorio.
3. Framework Preset: **Other**. Build Command: vacío. Output Directory: vacío (la raíz). → **Deploy**.
4. Cada `git push` publica la versión nueva sola.

## Guardado (prototipo)

Por ahora los proyectos se guardan en el navegador de cada persona (IndexedDB). Para compartir un proyecto se usa el botón de exportar (.json) y en la lista **Importar .json**. El siguiente paso natural es mover `listar / guardar / borrar` de `js/store.js` a Supabase (como el resto de las apps de Nikola) para que todo Ops vea los mismos proyectos.

## Pendientes sugeridos

- Guardar en Supabase con usuarios de Ops.
- Importar la cubicación de la visita comercial (techos, zonas y paneles ya marcados).
- Mapa real en el croquis de ubicación.
- Varios inversores (UG B, C…) en los cuadros de carga.
