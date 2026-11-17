// Service worker : garde l'app en mémoire pour qu'elle s'ouvre sans réseau.
// À CHAQUE PUBLICATION : augmenter VERSION (même valeur que dans js/config.js).
// Si un fichier est ajouté à l'app, l'ajouter aussi à FICHIERS.

const VERSION = '0.7.0';
const CACHE = `heures-${VERSION}`;

const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/config.js',
  'js/db.js',
  'js/etat.js',
  'js/ui.js',
  'js/temps.js',
  'js/calcul.js',
  'js/carnet.js',
  'js/assurance.js',
  'js/grilles.js',
  'js/convention.js',
  'js/recap.js',
  'js/graphique.js',
  'js/verrou.js',
  'js/nip.js',
  'js/decor.js',
  'js/ecrans/accueil.js',
  'js/ecrans/jour.js',
  'js/ecrans/semaine.js',
  'js/ecrans/paie.js',
  'js/ecrans/carnet.js',
  'js/ecrans/profil.js',
  'js/ecrans/reglages.js',
  'js/ecrans/releve.js',
  'icons/icon-48.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', (ev) => {
  // `cache: 'reload'` : on prend les fichiers sur le réseau, pas dans le cache HTTP du navigateur.
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((k) => k.startsWith('heures-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// La nouvelle version attend que l'utilisateur touche « Mettre à jour ».
self.addEventListener('message', (ev) => {
  if (ev.data?.type === 'ACTIVER') self.skipWaiting();
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(req, { ignoreSearch: true });
    if (enCache) return enCache;
    try {
      return await fetch(req);
    } catch (e) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
      throw e;
    }
  })());
});
