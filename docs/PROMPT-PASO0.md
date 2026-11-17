# Prompt para Claude Code (VS Code) · Paso 0 · Ficha del proyecto

Abre en VS Code la carpeta `Proyecto Diseño OPS/Git` y pega el texto de abajo.

---

Vamos a desarrollar el **Paso 0 · Ficha del proyecto** de NIKOLA Diseño Ops. Es el Excel "Campos Autocad", pero dentro de la app.

## Contexto
- La app es un sitio estático (HTML/CSS/JS con módulos ES, sin compilación) y se publica en Vercel. Lee primero `README.md`, `docs/EQUIPOS-EMAT.md` y `docs/PASO0-DATOS.md`. El último tiene todo lo que ya se averiguó del Excel y de ZonOS.
- Hoy los proyectos se guardan en IndexedDB (`js/store.js`). Más adelante pasarán a Supabase, así que deja el guardado detrás de las mismas funciones `listar / guardar / borrar`.
- Archivos de referencia, fuera del repo (una carpeta arriba):
  - `../Campos Autocad -.xlsm`: la plantilla oficial vacía. Es la **fuente de verdad** de fórmulas, catálogos y orden de campos.
  - `../_validacion-paso0/excel/`: 4 proyectos reales llenos (ON 921 monofásico, ON 936 trifásico con cargador, ON 909 con batería y cargador, ESP 15 con cargador Wallbox).
  - `../_validacion-paso0/zonos/`: filas de ZonOS (3 reconstruidas y 1 cruda, la ON938-fila-zonos-CRUDA.txt).
  - `../GetCampo-LastUpdate.dvb` y `../Planos - Proyecto - LastUpdate.dwg`: la macro y el DWG que hoy leen la hoja Autocad.
- **Privacidad:** los Excel de `_validacion-paso0` tienen datos personales de clientes. Nunca copies sus valores al repo: ni en fixtures, ni en tests, ni en commits. Los resultados de la validación se guardan solo en `../_validacion-paso0/resultados/`.

## Reglas
- Todo el texto de la interfaz va en español de Chile, sin jerga técnica innecesaria.
- Los nombres de campo se mantienen **idénticos** a la columna A de la hoja `Autocad` (mayúsculas, tildes y espacios incluidos). El identificador estable de cada campo es su nombre; si hay nombres repetidos (hay al menos 2), se distinguen con la fila.
- Usa Python (openpyxl) para leer el Excel. Los scripts van en `scripts/` (ya excluido de Vercel en `.vercelignore`) y generan archivos de datos en `data/`, que la app lee. Los datos tienen que poder regenerarse cuando cambie la plantilla.
- No dupliques catálogos: lo que ya está en `js/equipos-emat.js` (paneles, inversores, baterías, cargadores…) se cruza por SKU o modelo. Lo que solo exista en el Excel se agrega marcando de dónde viene.
- Avanza por subpasos. Al terminar cada uno, deja un commit con un mensaje claro y muéstrame un resumen antes de seguir.

## Subpasos

**0.1 Catálogos.** Escribe `scripts/extraer_catalogos.py`, que lea las hojas `Equipos` y `Cables y canalización` de la plantilla y genere `data/catalogos/*.json`: inversores, módulos, baterías, cargadores (SAVE), protecciones, conductores con ampacidad y diámetro, ductos con diámetro y área, distribuidoras con teléfono y web, e instaladores. Cruza con `js/equipos-emat.js` y deja un informe `docs/CRUCE-CATALOGOS.md` con lo que coincide, lo que falta en cada lado y las diferencias de datos.

**0.2 Diccionario de campos.** Escribe `scripts/extraer_diccionario.py`, que recorra las 382 filas de la hoja `Autocad` y, para cada campo, genere en `data/campos.json`: nombre exacto, fila, sección (las filas "DATOS DE …" son cabeceras), unidad (columna C), origen (`zonos` | `catalogo` | `calculo` | `manual`), la celda de origen en `Información proyecto` y su fórmula original. Para clasificar el origen, sigue la cadena de fórmulas: Autocad → Información proyecto → R4:AY4 (ZonOS) / Equipos / Cables / valor escrito a mano. Anota también qué campos usan las hojas Memoria explicativa, TE6, Informe de ensayos y Señaléticas (solo anotar; no se implementan). Entrega un resumen: cuántos campos hay por origen y por sección, y si son 357 o no.

**0.3 Motor de cálculo.** Crea `js/ficha/motor.js` con las fórmulas de `Información proyecto` traducidas a JavaScript, legibles y comentadas con la celda original:
- búsquedas en catálogos;
- potencias por string;
- 125 % de Isc;
- protecciones;
- ampacidad con factores de temperatura y cantidad;
- caída de tensión por tramo (V y %);
- llenado de ductos (razón de área útil);
- puesta a tierra;
- y los mismos avisos que muestra el Excel.

Debe ser una función pura: recibe los valores de entrada y los sobrescritos, y devuelve todos los campos más los avisos. Recalcula solo lo que depende de lo que cambió. Considera varios inversores (UG A, B…) aunque hoy el Excel use uno.

**0.4 Pantalla Ficha.** Agrega el paso **0 · Ficha** antes de Escala en la cinta del editor (`js/editor.js`), en módulos nuevos dentro de `js/ficha/`. Debe tener:
- las mismas secciones del Excel, en tarjetas plegables;
- un buscador de campos;
- listas desplegables donde el Excel tiene listas;
- un ícono por campo según su origen: 🔗 ZonOS, ⚙ calculado, ✎ manual;
- poder sobrescribir cualquier valor y volver al automático con un clic (↺);
- los avisos junto al campo que los provoca.

Usa el estilo oscuro del editor que ya existe (`css/app.css`). Los datos de la ficha se guardan dentro del proyecto (`p.ficha = { valores, sobrescritos }`). Los pasos que ya existen (strings, equipos, lámina) deben leer de la ficha lo que hoy sacan del catálogo: módulo, inversor, largos, protecciones, cajetín y notas. Así hay una sola fuente de datos.

**0.5 Pegar desde ZonOS.** Agrega un cuadro "Pega aquí la fila de ZonOS". Tiene que aceptar:
- **34 columnas** separadas por tabulación, en el orden R→AY de `docs/PASO0-DATOS.md`;
- fin de línea CRLF;
- comillas dobles alrededor de algunos valores, que hay que quitar;
- decimales con punto.

Las coordenadas se toman de la columna 10 ("Coordenadas"), separando por la coma, y **no** de Latitud/Longitud (columnas 30 y 31), que pueden venir sin punto. Antes de aplicar, muestra una tabla con cada campo de destino, su valor actual y el valor nuevo, y marca los que cambian y los que el usuario había sobrescrito. Pruébalo con las 4 filas de `../_validacion-paso0/zonos/`, sin copiarlas al repo.

**0.6 Exportar Excel de campos.** Agrega un botón "Exportar Excel de campos" que genere un `.xlsx` con una hoja `Autocad` idéntica en estructura a la de la plantilla: mismas 382 filas, mismo orden, columnas A, B, C y D, y título en A1. Usa SheetJS cargado desde CDN. Antes de programarlo, revisa cómo la macro (`GetCampo-LastUpdate.dvb`) encuentra el archivo, la hoja y las celdas: nombre de archivo, nombre de hoja, si busca por nombre de campo o por fila, y si necesita `.xlsm`. Si no puedes leer el .dvb, pregúntame antes de decidir el formato.

**0.7 Validación.** Escribe `scripts/validar_ficha.py` (o en Node, si te acomoda más). Para cada Excel de `../_validacion-paso0/excel/`:
1. toma solo los valores de **entrada**: la fila ZonOS R4:AY4 y las celdas escritas a mano en `Información proyecto`;
2. los pasa por `js/ficha/motor.js`;
3. compara los 357 campos con la hoja `Autocad` de ese Excel.

Reglas de la comparación:
- los números se comparan con tolerancia de 0,01;
- el texto se compara sin espacios sobrantes;
- `#REF!`, `#N/A` y `#VALUE!` cuentan como vacío esperado;
- "SAVE Modelo" se ignora cuando "SAVE Marca" es 0.

Deja el informe en `../_validacion-paso0/resultados/` (fuera del repo). En `docs/VALIDACION-PASO0.md` deja solo un resumen sin datos de clientes: % de coincidencia por proyecto y por sección, y la lista de campos que difieren con la causa. **El paso 0 no está terminado hasta que los 4 proyectos coincidan** o hasta que cada diferencia esté explicada y aceptada por mí.

## Antes de empezar
Revisa la plantilla y dime:
1. cuántos campos reales encuentras;
2. qué fórmulas te parecen ambiguas o rotas;
3. tu plan de archivos.

Después parte con 0.1.
