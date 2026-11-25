# Paso 0 · Respuestas y decisiones (17-11-2026)

## 1. Plantilla vigente
`../Campos Autocad -.xlsm` es la versión del Drive (*00 Template Particulares*, modificada el 12-11-2026). La copia antigua quedó como `../Campos Autocad - (copia antigua ago 2026).xlsm`, y **no se usa**.
La plantilla vigente tiene una hoja nueva, **"Calculos y configuracion"**, que no está en los Excel de los proyectos. Hay que revisarla en 0.2 y 0.3.

## 2. Node y git
- Autorizado: instalar Node LTS con `winget install OpenJS.NodeJS.LTS` y correr `git init` en `Git/`.
- **El disco está casi lleno: quedan unos 7 GB libres de 476 GB.** Node ocupa unos 100 MB, así que cabe, pero:
  - no instales dependencias con npm dentro del repositorio: la app sigue sin compilación y SheetJS se carga desde CDN;
  - si un script necesita paquetes, instálalos de forma global o fuera de OneDrive, nunca en `node_modules` dentro de la carpeta (OneDrive intentaría sincronizarlos);
  - no generes archivos grandes de salida.

## 3. Datos de instaladores
La tabla `Equipos!E145:K154` tiene nombre, RUT, dirección, licencia, empresa, correo y teléfono de 9 personas. El sitio de Vercel es público, así que:
- **No van al repositorio** ni a ningún JSON que se publique.
- El script de 0.1 los extrae a `../_privado/instaladores.json`, fuera del repo.
- En la app, la lista de instaladores se carga en un ajuste ("Instaladores") que importa ese JSON o el Excel. Queda guardada en el navegador (IndexedDB), igual que los proyectos, hasta que exista Supabase con inicio de sesión.
- Dentro de cada proyecto sí se guardan los datos del instalador elegido, porque van impresos en el cajetín y en los documentos para la SEC.

## 4. Macro de AutoCAD (ya exportada)
El código está en `../macro-GetCampo/` (`Module1.bas`, `UserForm1.frm` y `ThisDrawing.cls`). Es idéntico al de la copia más reciente del Drive. Funciona así:
- Abre el archivo que el usuario elige con `GetOpenFilename`, que acepta `.xls`, `.xlsx` y `.xlsm`. **Basta con un `.xlsx`.**
- Lee la hoja **`Autocad`** (`xlWB.Sheets("Autocad")`).
- Lee **por celda fija** (`xlSheet.Range("B3")`, `B4`…), no por nombre. Hace unas 685 llamadas a `WriteCustomProperty "NOMBRE PROPIEDAD", Range("Bnn")`.
- **El nombre de la propiedad del DWG no siempre es igual al texto de la columna A.** Por ejemplo, `B9` → `"COORD UTM X"` (en la hoja dice "COORD Latitud"), y `B21` → `"PROPIETARIA(O) Nombre"` (en la hoja dice "PROPIETARIA/O Nombre").
- Los errores (`#N/A`, `#REF!`…) y las celdas vacías se escriben como "".

Por lo tanto, para el 0.6 y el diccionario:
- el `.xlsx` exportado debe tener cada valor **en la misma fila** de la columna B;
- el diccionario (`data/campos.json`) debe guardar también `propiedadDWG`, sacada del `.bas`, porque esos son los nombres de los campos `{…}` del DWG que se usarán en los textos del unilineal (paso 4);
- conviene un test que verifique que cada `Range("Bnn")` del `.bas` tiene su campo en el diccionario.

## 5. Nuevo subpaso: importar un "Campos Autocad" existente
Así los proyectos que hoy están a medias en Excel se pueden seguir en la app.
- Botón "Importar Campos Autocad (.xlsm)" en la lista de proyectos y en la Ficha. Usa SheetJS en el navegador.
- Lee la fila ZonOS (`Información proyecto!R4:AY4`) y los valores escritos a mano en `Información proyecto`, y los carga como entradas de la Ficha. El motor recalcula el resto.
- Lee además la hoja `Autocad` para mostrar las diferencias entre el resultado del motor y el del Excel, con la misma comparación del 0.7.
- **Caso guía: ON 921.** Están su Excel (`../_validacion-paso0/excel/`) y sus planos en PDF (`../_validacion-paso0/planos/`). Es el primer proyecto que se importa para ver cómo queda.

Orden: 0.1 → 0.2 → **importar (con ON 921)** → 0.3 → 0.4 → 0.5 → 0.6 → 0.7.

---

# Paneles: perfiles de losa plana y ajustes (24-11-2026)

## Se probó y se descartó: "tipo de montaje"
La Fase 1 agregó un "Montaje del techo" (rieles / fija / ajustable / perfiles) con bases delanteras y traseras, anclajes, flecha "sube", cubicación y nota `{MONTAJE Nota}`. **Se quitó entero**: quedó demasiado complejo. Las bases de las estructuras ajustables se van a pensar de nuevo más adelante (ver `docs/PENDIENTES.md`). La flecha "sube" no se usa.

## Perfiles de losa plana (lo que quedó)
- Van **aparte de los rieles**, porque el ingeniero puede poner los dos o solo uno: `r.perfiles = { on, largo, sob, d }` en el techo y `b.perfiles` en un bloque ("Del techo / Sin / Con perfiles"). Antes eran `rieles.modo = 'perfil'`: esos proyectos se leen igual (`perfilesDe` en `js/geom.js`) y pasan al campo nuevo cuando se editan sus rieles o perfiles.
- Ahora van **2 por fila**, a lo largo de la fila (antes eran 2 por columna), y se dibujan como un **rectángulo angosto**: aunque se vean 2 líneas, es un solo perfil.
- Largo (`perfiles.largo`): *sobresalen* del bloque (`sob`, 15 cm por defecto, como antes) o *hasta el borde del techo* (`'techo'`). La opción "a mano" se quitó porque no dibujaba nada; un `'manual'` guardado se lee como "sobresalen".
- Perfiles sueltos: herramienta **Perfil** (barra de arriba del paso Paneles, junto a Riel y Paneles a mano). Se dibujan con 2 clics, inicio y final, y se ven como rectángulo desde el primer clic.
- Los proyectos guardados con perfiles cambian de dibujo: de columnas a filas.

## Otros cambios de la misma tanda
- "Techo N: cómo es" (inclinación, pendiente y retiro) pasó del paso Paneles al paso **Techos**.
- Contorno de los techos más delgado y con opción de ocultarlo fuera del paso Techos (`p.ocultarContornos`, por hoja).
- Los elementos (obstáculos, zonas…) pueden mostrar su nombre desde el paso Cotas, etiquetas y textos; por defecto no lo muestran (`z.etq.ver`).
- Letra del dibujo más fina, parecida a la de AutoCAD (Roboto Condensed 300), y rótulos de inclinación en blanco en vez de amarillo.

# Pantalla del editor como AutoCAD (24-11-2026)
- **Barra superior** (la "cinta" del paso): todo lo que se dibuja o inserta en ese paso, con sus opciones al lado. Equipos y conjuntos van en el menú **Insertar**.
- **Barra lateral**: solo herramientas que sirven en cualquier paso: Seleccionar, Encuadre, Ajustar, **Medir** (DIST, dos clics, no deja nada dibujado) y Borrar. Nada del paso, para no repetir botones.
- **Panel derecho** (paleta Propiedades): secciones fijas, sin desplegar: resumen del paso y propiedades de lo elegido. El **bloque de paneles** se edita aquí (ya no hay ventana flotante sobre el dibujo).
- **Capas**: botón CAPAS en la barra de estado, con la lista flotante.
- La etiqueta de una canalización ya no se muestra u oculta desde sus propiedades: eso se hace solo en "Cotas, etiquetas y textos".
- El **bloque de paneles** se edita en su propia ventana, una columna fija entre el dibujo y el panel derecho (no flota sobre los bloques). Se cierra con ✕ o Esc.
- Elementos (zonas): opción "Nombre dentro del área, en su color" (`p.nombreDentro`, por hoja). El nombre va en hasta 3 líneas con el tamaño más grande que quepa; si no cabe, sale como etiqueta normal.
- **Todo a escala del dibujo, como el espacio modelo de AutoCAD:** textos, cotas, etiquetas, norte, nivel de piso, medidas de los equipos, letras de los símbolos, achurados y perfiles se miden en una "unidad de dibujo" proporcional a la foto (`UD` en `js/render.js`). Crecen y se achican con el zoom y salen del mismo tamaño en el informe y las láminas. Se quitó la opción "Cambia de tamaño con el zoom": siempre es así. Solo el **grosor de las líneas** sigue igual en pantalla, como las plumas de AutoCAD.
- **Perfiles:** se dibujan con su ancho en el dibujo: 40 mm si la hoja tiene escala (`ANCHO_PERFIL`, representación **pendiente** de confirmar con la ficha del perfil).
- **Ctrl+Z / Ctrl+Y en Informe y láminas** (y los botones ↶ ↷): cada cambio guarda el estado anterior; los cambios seguidos (arrastrar un bloque, escribir) se juntan en un solo paso. Dentro de un campo de texto, Ctrl+Z deshace la escritura de ese campo. Al editar una *plantilla* no hay deshacer (se guarda aparte).
- **Norte:** tamaño propio (`p.norte.tam`), a escala del dibujo como todo lo demás.
- **Cajas** de paso y de derivación: se estiran desde sus esquinas. En la barra de Equipos y canalización van en un menú **Caja ▾**; los colores de "Otra línea" en otro menú chico.
- La etiqueta de un equipo tampoco se muestra u oculta desde sus propiedades: solo en "Cotas, etiquetas y textos".

## Corregir equipos de la base EMAT (Configuración › Equipos y medidas)

- Cada inversor, panel y equipo de la base tiene **Editar**: medidas, peso, espacio libre (no en paneles), ficha técnica y nota.
- La corrección se guarda aparte en este navegador (ajuste `equiposCorr`, por SKU o modelo). `js/equipos-emat.js` no se toca, y la tabla la marca como «corregido».
- «Volver al dato original» borra la corrección. Los equipos ya dibujados conservan su medida; la corrección vale para los que se pongan después y para la norma de espacio libre.
- Las etiquetas ahora llegan al 800 % (todas) y al 1000 % (cada una).

## Planos profesionales · Fase A: nitidez y líneas finas

- Las vistas del informe y la planta de la lámina se arman en dos capas: la foto en JPEG y el dibujo en un PNG transparente encima (`vistaNitida` en render.js). Así las líneas y los textos quedan nítidos sin que el archivo pese mucho.
- Las vistas salen a unos 400 ppp (antes unos 280) y la planta de la lámina con 12 px por mm.
- Las líneas al imprimir son más finas: el grosor por mm de hoja (`GROSOR`) pasó de 0,30 a 0,22.
- Los paneles en los planos van con borde negro y achurado verde oscuro más tupido, como los planos de referencia.
- Las fotos nuevas se guardan hasta 4096 px (antes 2600) en JPEG de calidad 0,92. Las fotos ya subidas no cambian.

## Planos profesionales · Fase B: textos como en AutoCAD, burbuja de detalle y blanco y negro

- **Textos**:
  - pueden tener varias líneas (Enter en el cuadro de texto; interlineado 1,45);
  - se pueden girar (en grados, antihorario como en AutoCAD; no aplica a los textos con línea guía);
  - pueden tener color propio (`tx.c`).
  - Sin color, el texto es blanco en pantalla y negro al imprimir, como el color 7 de AutoCAD. Con color elegido sale de ese color en los dos.
  - En el DXF cada renglón es un TEXT con su giro.
- **Burbuja de detalle** (`p.detalles`, en cada hoja): `{ c: centro de lo que se amplía, p: centro de la burbuja, r: radio de la zona (px de la foto), z: aumento }`.
  - El círculo muestra esa zona ampliada (foto y dibujo), con una línea hasta el círculo chico del lugar.
  - Se crea con «Detalle» en Cotas, etiquetas y textos; el punto azul mueve la zona.
- **Vista en blanco y negro** (opción del bloque Vista del informe): todo el dibujo pasa a negro y lo blanco queda blanco. La foto no cambia. En las burbujas se ve solo el dibujo.
- **Norte**: al imprimir, la rosa de los vientos queda roja y negra, como en los planos de referencia.
- **Burbuja con aumento exacto** (25-11-2026): la burbuja guarda su propio radio `R` y el aumento `z`, que se escribe exacto (×2,5, ×5…). Cambiar uno no cambia el otro, y la zona ampliada mide R / z. Bajo la burbuja se escribe «DETALLE ×3». En informes y planos, si la hoja tiene escala, se escribe la escala real del detalle según la escala de cada vista («DETALLE ESC. 1:50»). Las burbujas antiguas (`r`) se leen igual y pasan a `R` al editarlas.

## Planos profesionales · Fase C: láminas con cajetín (como el ON 901)

- **Bloques nuevos en el informe**:
  - `cajetin`: marco, título y franja inferior de la lámina. Llena la página, es fijo y va al fondo.
  - `simbologia` y `notas`.
  - `cuadro`: `cc` (generación CC), `ca` (generación CA) o `caida` (caída del alimentador).
  - Todos se dibujan en mm de una hoja A1. En otra hoja (por ejemplo A3) el cajetín se ajusta al tamaño.
- **Número de lámina, total y cuadro resumen** salen solos de las páginas que tienen cajetín, en su orden («LÁMINA 02 DE 04»). El título por defecto es: nombre de la página – código – cliente – comuna, y se puede cambiar.
- **Lámina del unilineal**: la opción `int` agrega los parámetros del interruptor termomagnético y del diferencial. Las marcas se escriben en «Protecciones y tierra».
- **Croquis de ubicación**: se genera con las coordenadas de la ficha (`lamina.latlon`) con un mapa de OpenStreetMap (zoom 16, punto rojo, atribución) y queda guardado en el proyecto como imagen (`lamina.croquis`). También se puede subir una imagen. Necesita internet solo al generarlo; al servicio de mapas se le piden las teselas de la zona, no se envía otro dato.
- **Juego de láminas A1**: el paquete trae 01 Planta general en terreno, 02 Diagrama unilineal, 03 Cuadro de generación CC y 04 Cuadro de generación CA. Las láminas A1 de antes siguen funcionando como «modo plano antiguo».
- **Corrección**: el contenedor interno de la vista (Fase A) se llamaba `bq-vista`, igual que el bloque, y corría hacia abajo la segunda vista de una página. Ahora se llama `bq-vis`.

## Planos profesionales · Fase D: unilineal horizontal (estilo ON 901)

- El unilineal se dibuja en una hoja horizontal de 420 × 300 (antes 262 × 314 vertical). Es la misma lógica y los mismos textos editables (`p.uni.textos`); solo se reparte a lo ancho, como en los planos de Ops: tablero e inversor anchos y MPPT separados.
- Se agregó el rectángulo segmentado «LÍMITES DEL PROYECTO» (deja fuera el empalme) y los textos de cada conductor llevan una línea guía con un círculo sobre el cable.
- Los dibujos a mano (`p.uni.libre`) guardan su hoja en `vb`. Los anteriores siguen en 262 × 314 y se ven igual, dentro de cualquier recuadro. La lámina A1 antigua sigue con el unilineal vertical.
- En la lámina 02 del juego A1, el unilineal ocupa casi toda la hoja (640 × 446 mm), con la simbología y las notas a la izquierda.
- Los números de los strings dentro de los paneles miden 0,22 del lado del panel, así que salen igual en el dibujo, el informe y la lámina. Antes en la lámina tenían un tope fijo en mm y no se leían.

## Figuras libres (26-11-2026)

- Herramienta **Figura** en la barra izquierda, disponible en todos los pasos de dibujo. Mientras está activa, la barra de arriba muestra sus opciones: forma, color, segmentada, grosor (fino, medio o grueso) y relleno para las formas cerradas (pintado o achurado, igual que «Rellenar» de los equipos).
- Se guardan en `p.figuras` (también por hoja): `{ id, f, pts, col, dash?, gr?, rel? }`. `f` puede ser `linea` o `flecha` (puntos abiertos; la punta va en el último), `poly` (cerrada), `rect` (2 esquinas opuestas) o `circ` (centro y un punto del borde). Los campos son opcionales y los proyectos anteriores no cambian.
- Se seleccionan, mueven, estiran desde sus puntos y se editan en el panel derecho (forma, color, grosor, trazo, relleno y su medida si la hoja tiene escala). El blanco sale negro al imprimir. Capa nueva **FIGURAS**; en el DXF van en la capa FIGURAS (el círculo como CIRCLE).
- «Otra línea» del paso Equipos sigue igual (es una canalización libre con etiqueta).

## Edición rápida de textos y números (26-11-2026)

- **Doble clic** sobre cualquier texto o número del dibujo abre un cuadrito al lado con el texto y su **tamaño**. Enter guarda, Esc cancela (también deshace el tamaño) y «Automático» vuelve al valor calculado.
- Sirve para: etiquetas, cotas, textos libres (Mayús + Enter = otra línea), medidas de los equipos, números de string dentro de los paneles, rótulo de la burbuja y nivel de piso.
- Usa los mismos campos que el panel derecho. Campos nuevos, todos opcionales: `cota.tam` (tamaño propio de la cota, sobre el general de la hoja), `equipo.medW` / `medH` / `tamMed`, `string.numTxt` / `tamNum` (el círculo crece con el número), `detalle.rot` / `tamRot`, y en la hoja `pisoTxt` / `pisoTam`.
- Si no se cambia el texto, no se guarda nada: una cota sigue la medida real hasta que se escriba otra.
- El render deja la caja de cada texto en `o.hits` (con `t: 'txt'`) solo en el editor; la búsqueda de etiquetas filtra `t: 'etq'`. El DXF usa el texto de la cota y del string tal como se ve.
- El cuadrito tiene un botón para borrar: en una **etiqueta** la quita (queda oculta y se vuelve a mostrar desde el panel), en una **cota** borra la cota entera (línea y texto) y en un **texto** lo borra. Usa el mismo borrado que Supr, así que se deshace con Ctrl+Z.

## Unilineal como los planos de Ops · E1: estilo base y composición (26-11-2026)

- Referencias: los unilineales de Traspaso Contratista (Drive de Operaciones), en especial el ON 909 (con Smart Guard, batería y EV) y los nuevos «unilineal AC / DC» del ON 841. No se copia ningún dato de clientes.
- **Flujo de arriba hacia abajo por un solo eje**: empalme arriba a la izquierda (la línea sale a la derecha y baja con codo redondeado), tablero general (o TG + TFV), inversor y strings al fondo. Los huecos entre bloques se reparten para que el dibujo llene la hoja.
- **Sin rellenos, todo fino (0,13) y color por tipo**: rojo conductores, azul barras, verde protecciones y módulos, magenta equipos, cian medidor, amarillo trazo-punto tableros, gris guías y límites, naranja enlace inversor–batería.
- Hoja del unilineal: **336 × 240** (antes 420 × 300, misma proporción): todo se ve un 25 % más grande; en la lámina A1 los textos quedan de unos 3 mm. Los dibujos a mano guardan su propia hoja (`vb`) y no cambian.
- Títulos de tablero en serif negrita cursiva; nota del tablero con círculo y guía (la del tablero general a la izquierda); etiquetas de conductor con círculo sobre el cable y guía gris que subraya la primera línea; «LÍMITES DEL PROYECTO» como polilínea continua con escalón que deja fuera el empalme.
- Símbolos nuevos: interruptor con un círculo en cada borne, arco a la derecha y «=»; diferencial con «P / D»; módulo vertical con «V»; inversor en marco magenta con MPPT y DC SWITCH; strings en rojo continuo con canalización común.
- El tipo de empalme no está en la ficha: sale «TIPO (pendiente)» y se cambia con un clic.
- Siguen: E2 (tableros completos y rótulos de 4 líneas), E3 (lado DC, Smart Guard, batería y EV como en el ON 909), E4 (láminas AC + DC separadas, solo para proyectos grandes).

## Unilineal como los planos de Ops · E2: tableros, protecciones, empalme y tierra (26-11-2026)

- **Rótulo de 4 líneas en cada protección**, como en los planos: marca / polos×In / kA / curva (diferencial: marca / polos×In / mA / tipo). Se arma desde el texto del disyuntor y del diferencial (`lineasProt`, `lineasDif` en `js/lamina.js`). Si un rótulo ya se había cambiado a mano con la clave antigua (una línea), se respeta.
- **Campos nuevos en `p.lamina`, todos opcionales**: `kA` (poder de corte de los interruptores), `dimTablero` (medidas del tablero general), `tarifa`, `nCliente`, `marcaEmp`, `kAEmp` (empalme), `tierraCond`, `tierraL`, `tierraMet` (tierra). Se reutilizan `marcaDisy`, `marcaDif`, `empalme` y `tierraR`. Se cambian en el paso Unilineal (secciones «Protecciones y tablero», «Empalme» y «Tierra de servicio y protección»).
- Lo que falta sale como «(pendiente)»: no se inventan marcas, kA ni medidas.
- **Tableros**: barra de tierra de protección (azul, con dos puntos) y lazo punteado por arriba y por abajo; nota de 3 líneas (tablero metálico, IP65, medidas).
- **Empalme**: tarifa, «EXISTENTE» y N° de cliente a la izquierda de la acometida; la protección del empalme también con rótulo de 4 líneas. El N° de cliente vive solo en el proyecto del usuario, nunca en el repo.
- **Tierra de servicio y protección**: 6 líneas alineadas a la derecha bajo los símbolos (existente, conductor, L, R, método).
- **Consumo**: la carga lleva «1» dentro del círculo y una leyenda «① Consumo» a la izquierda del tablero general.

## Unilineal como los planos de Ops · E3: lado DC, Smart Guard, batería y EV (26-11-2026)

- **Entradas del inversor**: cada MPPT tiene su sub-barra (si admite más de un string) y una entrada por string, con su interruptor verde dentro del DC SWITCH. Las entradas sin string salen como «VACANTE» con la marca «//», como en el unilineal DC nuevo. Los strings se ubican en su entrada (MPPT y número).
- **Tierra de cada string**: T.P. / conductor / R, con una raya bajo el conductor. Campos opcionales `p.lamina.tierraStrCond` y `tierraRstr`.
- **Smart Guard**: tablero magenta propio arriba a la derecha (ya no cruza el tablero general). GRID desde la acometida, BACKUP → ② consumos con respaldo, NON BACKUP → ③ consumos sin respaldo y FV hacia la barra del tablero general; cada puerto con su protección y rótulo de 4 líneas. Es un esquema: los textos se cambian con un clic.
- **Batería**: DC SWITCH propio arriba, «+ / –» y 5 líneas (módulo, modelo, energía, potencia máx., tensión); lo que falta sale «—». Campos opcionales `uni.extras.batPmax`, `batV`.
- **EV en el tablero general**: interruptor + diferencial 30 mA Tipo A-SI + el cargador dibujado bajo el tablero (`extras.evDif`, `evMarca`, `evKw`). El tablero de electromovilidad se alimenta bajando desde la barra del tablero general.
- Las claves de texto antiguas se conservan donde se pudo (`ev.prot`, `sg.titulo`, `bat.*`).
