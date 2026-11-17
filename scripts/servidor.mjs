/* Servidor local para probar la app (sin instalar nada): npm run dev → http://localhost:5173
   Sirve solo los archivos de esta carpeta. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = +process.env.PORT || 5173;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ) || /[\\/](\.git|scripts|docs)[\\/]/.test(archivo.slice(RAIZ.length))) { res.writeHead(403).end(); return; }
    if (!(await stat(archivo)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(archivo));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); }
}).listen(PUERTO, () => console.log(`Diseño Ops en http://localhost:${PUERTO}  (Ctrl+C para detener)`));
