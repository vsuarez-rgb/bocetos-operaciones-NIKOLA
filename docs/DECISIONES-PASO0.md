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
