// Stockage sur l'appareil (IndexedDB). Trois magasins :
//   jours    : une fiche par date ('AAAA-MM-JJ')
//   semaines : brut et net réels du talon, par premier jour de semaine
//   kv       : réglages (clé 'reglages'), verrou par NIP (clés 'verrou' et 'verrou-essais')

const NOM = 'suivi-heures';
const VERSION = 1;
let ouverture = null;

function ouvrir() {
  if (ouverture) return ouverture;
  ouverture = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('jours')) db.createObjectStore('jours', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('semaines')) db.createObjectStore('semaines', { keyPath: 'debut' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de données bloquée par un autre onglet.'));
  });
  return ouverture;
}

async function transaction(magasins, mode, action) {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(magasins, mode);
    let resultat;
    tx.oncomplete = () => resolve(resultat);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Écriture annulée.'));
    resultat = action(tx);
  });
}

const demande = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function lireTout(magasin) {
  const db = await ouvrir();
  return demande(db.transaction(magasin).objectStore(magasin).getAll());
}

export async function lireCle(magasin, cle) {
  const db = await ouvrir();
  return demande(db.transaction(magasin).objectStore(magasin).get(cle));
}

export function ecrire(magasin, valeur, cle) {
  return transaction(magasin, 'readwrite', (tx) => { tx.objectStore(magasin).put(valeur, cle); });
}

export function supprimer(magasin, cle) {
  return transaction(magasin, 'readwrite', (tx) => { tx.objectStore(magasin).delete(cle); });
}

// Remplace tout le contenu en une seule transaction : soit tout passe, soit rien ne change.
// Le verrou par NIP (autres clés de `kv`) reste en place : restaurer une sauvegarde ne l'enlève pas.
export function remplacerTout({ jours, semaines, reglages }) {
  return transaction(['jours', 'semaines', 'kv'], 'readwrite', (tx) => {
    const sj = tx.objectStore('jours');
    const ss = tx.objectStore('semaines');
    sj.clear();
    ss.clear();
    for (const j of jours) sj.put(j);
    for (const s of semaines) ss.put(s);
    tx.objectStore('kv').put(reglages, 'reglages');
  });
}

// Efface tout ce que l'app garde sur cet appareil : journées, talons, réglages et verrou.
export function viderTout() {
  return transaction(['jours', 'semaines', 'kv'], 'readwrite', (tx) => {
    for (const magasin of ['jours', 'semaines', 'kv']) tx.objectStore(magasin).clear();
  });
}
