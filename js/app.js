// Démarrage, navigation entre les écrans, rappel de sauvegarde, mode hors ligne.

import { etat, charger, debutSemaine, sauvegardeEnRetard, joursDepuisSauvegarde, aujourdhui } from './etat.js';
import { APP } from './config.js';
import { esc, toast } from './ui.js';
import { deverrouiller } from './nip.js';
import { rendreAccueil } from './ecrans/accueil.js';
import { rendreJour } from './ecrans/jour.js';
import { rendreSemaine } from './ecrans/semaine.js';
import { rendrePaie } from './ecrans/paie.js';
import { rendreCarnet } from './ecrans/carnet.js';
import { rendreReglages, PAGES_REGLAGES } from './ecrans/reglages.js';

const ECRANS = {
  accueil: { rendre: rendreAccueil },
  jour: { rendre: rendreJour, defaut: () => aujourdhui() },
  semaine: { rendre: rendreSemaine, defaut: () => debutSemaine(aujourdhui()), normaliser: (d) => debutSemaine(d) },
  paie: { rendre: rendrePaie, defaut: () => debutSemaine(aujourdhui()), normaliser: (d) => debutSemaine(d) },
  carnet: { rendre: rendreCarnet },
  reglages: { rendre: rendreReglages, pages: PAGES_REGLAGES },
};

const racine = document.getElementById('ecran');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DELAI_VERROU_MS = 60 * 1000; // absence après laquelle le NIP est redemandé
let dernier = { ecran: null, param: null };

// Sans adresse précise, on ouvre l'écran choisi dans les réglages (Accueil ou Jour).
function lireRoute() {
  const [, ecran, param] = location.hash.split('/');
  const ouverture = etat.reglages?.ecranOuverture === 'jour' ? 'jour' : 'accueil';
  const nom = ECRANS[ecran] ? ecran : ouverture;
  // Le paramètre est une date, ou le nom d'une page pour les écrans qui en ont (réglages).
  const valide = ECRANS[nom].pages ? ECRANS[nom].pages.includes(param) : DATE.test(param ?? '');
  return { ecran: nom, param: valide ? param : null };
}

// Va à un écran. Si on y est déjà, le redessine.
function naviguer(ecran, param) {
  const cible = `#/${ecran}${param ? `/${param}` : ''}`;
  if (location.hash === cible) afficher();
  else location.hash = cible;
}

function afficher() {
  const { ecran, param } = lireRoute();
  const def = ECRANS[ecran];
  let p = param ?? def.defaut?.() ?? null;
  if (p && def.normaliser) p = def.normaliser(p);

  const defilement = dernier.ecran === ecran && dernier.param === p ? window.scrollY : 0;
  racine.onclick = null;
  racine.onchange = null;
  racine.oninput = null;
  try {
    def.rendre(racine, p, naviguer);
  } catch (e) {
    console.error(e);
    racine.innerHTML = `<p class="alerte">Cet écran n'a pas pu s'afficher : ${esc(e.message)}. Tes données ne sont pas touchées. Recharge la page ; si le problème revient, fais une sauvegarde dans Réglages.</p>`;
  }
  dernier = { ecran, param: p };
  window.scrollTo(0, defilement);

  // Les onglets Semaine et Paie suivent la date qu'on regarde.
  const dateCourante = p && DATE.test(p) ? p : aujourdhui();
  for (const a of document.querySelectorAll('.onglets a')) {
    const o = a.dataset.onglet;
    a.classList.toggle('actif', o === ecran);
    if (o === ecran) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (o === 'semaine' || o === 'paie') a.href = `#/${o}/${debutSemaine(dateCourante)}`;
    if (o === 'jour') a.href = ecran === 'jour' || !DATE.test(param ?? '') ? '#/jour' : `#/jour/${dateCourante}`;
  }
  majBandeau();
}

function appliquerTheme() {
  const theme = etat.reglages.theme;
  const sombre = theme === 'sombre' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = sombre ? 'sombre' : 'clair';
  document.documentElement.dataset.fond = etat.reglages.fond === 'uni' ? 'uni' : 'plan';
  document.querySelector('meta[name="theme-color"]').content = sombre ? '#101214' : '#f4f2ec';
}

let nouvelleVersion = null;

function majBandeau() {
  const el = document.getElementById('bandeau');
  if (nouvelleVersion) {
    el.innerHTML = '<span>Nouvelle version prête.</span><button class="btn btn-principal" data-act="recharger">Mettre à jour</button>';
    el.hidden = false;
  } else if (sauvegardeEnRetard() && lireRoute().ecran !== 'reglages') {
    const n = joursDepuisSauvegarde();
    el.innerHTML = `<span>${n === null ? 'Aucune sauvegarde pour l\'instant.' : `Dernière sauvegarde il y a ${n} jours.`}</span><a class="btn btn-principal" href="#/reglages/sauvegarde">Sauvegarder</a>`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

async function installerHorsLigne() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const surveiller = (sw) => {
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) { nouvelleVersion = sw; majBandeau(); }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) { nouvelleVersion = reg.waiting; majBandeau(); }
    surveiller(reg.installing);
    reg.addEventListener('updatefound', () => surveiller(reg.installing));
    let recharge = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recharge) return;
      recharge = true;
      location.reload();
    });
  } catch (e) {
    console.warn('Mode hors ligne indisponible :', e);
  }
}

async function demarrer() {
  try {
    await charger();
  } catch (e) {
    console.error(e);
    racine.innerHTML = `<p class="alerte">Impossible d'ouvrir les données sur cet appareil : ${esc(e.message)}. Vérifie que Chrome n'est pas en navigation privée et qu'il reste de l'espace.</p>`;
    return;
  }
  document.title = APP.nom;
  appliquerTheme();
  // Verrou par NIP : rien ne s'affiche tant que le bon NIP n'est pas entré.
  if (etat.verrou) {
    racine.innerHTML = '';
    await deverrouiller();
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', appliquerTheme);
  window.addEventListener('hashchange', afficher);
  document.addEventListener('reglages-changes', appliquerTheme);
  document.addEventListener('sauvegarde-faite', majBandeau);
  document.getElementById('bandeau').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-act="recharger"]')) nouvelleVersion?.postMessage({ type: 'ACTIVER' });
  });
  // Si l'app reste ouverte jusqu'au lendemain, l'écran Jour suit la date.
  let jourAffiche = aujourdhui();
  let cacheDepuis = null;
  let verrouille = false;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') { cacheDepuis = Date.now(); return; }
    // De retour après plus d'une minute ailleurs : le NIP est redemandé.
    const absence = cacheDepuis === null ? 0 : Date.now() - cacheDepuis;
    cacheDepuis = null;
    if (etat.verrou && !verrouille && absence > DELAI_VERROU_MS) {
      verrouille = true;
      for (const d of document.querySelectorAll('dialog.feuille[open]')) d.close();
      racine.onclick = null;
      racine.onchange = null;
      racine.oninput = null;
      racine.innerHTML = '';
      await deverrouiller();
      verrouille = false;
      jourAffiche = aujourdhui();
      afficher();
      return;
    }
    if (verrouille) return;
    const auj = aujourdhui();
    if (auj !== jourAffiche) { jourAffiche = auj; if (!lireRoute().param) afficher(); }
  });
  afficher();
  installerHorsLigne();
  // Demande à Chrome de ne pas effacer les données quand le téléphone manque d'espace.
  navigator.storage?.persist?.().catch(() => {});
}

window.addEventListener('unhandledrejection', (ev) => {
  console.error(ev.reason);
  toast(`Erreur : ${ev.reason?.message ?? ev.reason}`, 'erreur');
});

demarrer();
