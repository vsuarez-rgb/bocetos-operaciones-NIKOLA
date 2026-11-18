# NIKOLA · Diseño Ops

Herramienta web para que Operaciones diseñe proyectos fotovoltaicos sin AutoCAD: se parte de la foto de dron, se dibujan techos, paneles, strings, equipos y canalización, y sale la lámina A1 (planta de techumbre + unilineal + cuadros de carga) lista para PDF, o un DXF para seguir en AutoCAD si hace falta.

Es un sitio **estático**: HTML, CSS y JavaScript sin compilación. No hay que instalar nada para editarlo.

## Pasos del diseño

| Paso | Qué se hace |
|---|---|
| 0 · Ficha | El Excel "Campos Autocad" dentro de la app: los 344 campos por sección, calculados con las fórmulas de la plantilla. Todo se puede editar: los campos calculados se reemplazan a mano y se vuelve al cálculo con ↺. Avisos del Excel junto al campo, listas desplegables (comunas según la región, modelos según la marca…), búsqueda y filtros (por completar, escritos a mano, con aviso). Los instaladores se cargan en el navegador (no se publican). |
| 1 · Escala | Se sube la foto de dron y se traza una medida conocida. Si la foto trae altura de vuelo (EXIF/XMP del dron), se compara con la escala. |
| 2 · Techos | Cada agua se dibuja como polilínea. Se puede escribir el largo de cada lado en metros (en la dirección del cursor). |
| 3 · Elementos | Obstáculos, zonas no utilizables, objetos que se retiran y pasillos. |
| 4 · Paneles | Automático (llena el techo respetando retiro y zonas) o manual por bloques filas × columnas, como un arreglo de AutoCAD. |
| 5 · Strings | Se asignan paneles a cada MPPT con clic o ventana. Calcula Voc, Voc en frío, Vmp, potencia y caída de tensión, y avisa si algo se sale del rango del inversor. |
| 6 · Equipos y canalización | Inversor, tableros, medidor, baterías, etc. a escala, y recorridos CC / CA / subterráneo / tierra con su largo. |
| 7 · Lámina | Cajetín, revisiones, notas, protecciones. Imprimir / PDF en A1, exportar DXF (mm) o SVG. |

## Atajos (estilo AutoCAD)

- Rueda del mouse: zoom en el cursor · botón del medio o barra espaciadora: mover la vista
- **F3** referencia a objetos · **F7** rejilla de 1 m · **F8** orto
- **Enter** termina / cierra · **Esc** cancela · **Supr** borra lo seleccionado
- **Ctrl+Z / Ctrl+Y** deshacer / rehacer · **Ctrl+S** guardar
- Línea de comandos: `TECHO`, `ZONA`, `COTA`, `TEXTO`, `NORTE`, `CC`, `CA`, `SUB`, `EQUIPO`, `BORRAR`, `ZOOM`, `STRING`, `AUTOSTRING`, `PASO 1-7`, `AYUDA`. Mientras dibujas, escribe un número (en metros) para el siguiente punto.

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
npm test            # pruebas de la calculadora y del diccionario
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
