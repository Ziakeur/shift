// Petit serveur local pour essayer l'app sur ce PC : node tools/serve.mjs  (puis http://localhost:8080)
// Aucune dépendance. Sert uniquement les fichiers de ce dossier.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = normalize(join(RACINE, chemin));
    if (fichier !== RACINE && !fichier.startsWith(RACINE + sep)) throw Object.assign(new Error('interdit'), { code: 403 });
    const contenu = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(contenu);
  } catch (e) {
    const code = e.code === 403 ? 403 : 404;
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(code === 403 ? 'Interdit' : 'Introuvable');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`App disponible sur http://localhost:${PORT}  (Ctrl+C pour arrêter)`);
});
