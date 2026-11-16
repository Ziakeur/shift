// Verrou par NIP : le clavier plein écran, l'ouverture de l'app, et les gestes des réglages
// (activer, changer, désactiver). Les calculs sont dans js/verrou.js.

import { etat, enregistrerVerrou, retirerVerrou, noterEssai, effacerToutesLesDonnees } from './etat.js';
import { APP } from './config.js';
import { NIP_MIN, NIP_MAX, creerVerrou, verifierNip, secondesRestantes } from './verrou.js';
import { dessinOssature } from './decor.js';
import { esc, confirmer, toast } from './ui.js';

// Clavier de chiffres plein écran. Retourne une promesse : le NIP saisi, ou null si annulé.
//   longueur : nombre de chiffres attendu (validation automatique) ; null = au choix, avec un bouton « Valider »
//   verifier(nip) : retourne true, ou un message d'erreur à afficher (la saisie est alors vidée)
//   attente() : secondes pendant lesquelles le clavier reste bloqué (trop de NIP faux)
//   annulable : montre « Annuler » ; sinon l'écran ne peut pas être fermé
//   surOubli : si fourni, montre « NIP oublié ? »
export function clavierNip({ titre, texte, longueur = null, verifier = null, attente = null, annulable = true, surOubli = null }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'verrou';
    d.setAttribute('aria-label', titre);
    const touche = (c) => `<button type="button" data-chiffre="${c}">${c}</button>`;
    const coin = annulable
      ? '<button type="button" class="touche-texte" data-act="annuler">Annuler</button>'
      : surOubli ? '<button type="button" class="touche-texte" data-act="oubli">NIP oublié ?</button>' : '<span></span>';
    d.innerHTML = `
      <div class="verrou-corps">
        <div class="verrou-haut">
          <div class="decor verrou-dessin">${dessinOssature()}</div>
          <h1>${esc(titre)}</h1>
          <p class="verrou-texte">${esc(texte)}</p>
          <div class="verrou-points" role="status"></div>
          <p class="verrou-erreur" role="alert"></p>
        </div>
        <div class="verrou-bas">
          <div class="verrou-clavier">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(touche).join('')}
            ${coin}${touche(0)}<button type="button" class="touche-texte" data-act="effacer" aria-label="Effacer le dernier chiffre">⌫</button>
          </div>
          ${longueur === null ? '<button type="button" class="btn btn-principal btn-large" data-act="valider" disabled>Valider</button>' : ''}
        </div>
      </div>`;
    document.body.append(d);

    const points = d.querySelector('.verrou-points');
    const erreur = d.querySelector('.verrou-erreur');
    const boutonValider = d.querySelector('[data-act="valider"]');
    const max = longueur ?? NIP_MAX;
    let saisie = '';
    let occupe = false;
    let fini = false;
    let minuterie = null;

    const bloque = () => (attente ? attente() : 0);
    const dessiner = () => {
      const nb = longueur ?? Math.max(NIP_MIN, saisie.length);
      points.innerHTML = Array.from({ length: nb }, (_, i) => `<i class="${i < saisie.length ? 'plein' : ''}"></i>`).join('');
      points.setAttribute('aria-label', `${saisie.length} chiffre${saisie.length > 1 ? 's' : ''} sur ${longueur ?? `${NIP_MIN} à ${NIP_MAX}`}`);
      if (boutonValider) boutonValider.disabled = saisie.length < NIP_MIN;
    };
    const terminer = (valeur) => {
      fini = true;
      clearInterval(minuterie);
      d.close();
      d.remove();
      resolve(valeur);
    };
    // Trop de NIP faux : le clavier attend, avec un décompte.
    const surveillerAttente = () => {
      clearInterval(minuterie);
      const maj = () => {
        const s = bloque();
        d.classList.toggle('bloque', s > 0);
        if (s > 0) erreur.textContent = `Trop d'essais. Réessaie dans ${s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`}.`;
        else { clearInterval(minuterie); if (erreur.textContent.startsWith('Trop')) erreur.textContent = ''; }
      };
      maj();
      if (bloque() > 0) minuterie = setInterval(maj, 1000);
    };
    const valider = async () => {
      if (occupe || bloque() > 0) return;
      if (!verifier) return terminer(saisie);
      occupe = true;
      const resultat = await verifier(saisie);
      occupe = false;
      if (resultat === true) return terminer(saisie);
      saisie = '';
      dessiner();
      erreur.textContent = resultat;
      d.classList.remove('secoue');
      void d.offsetWidth; // relance l'animation
      d.classList.add('secoue');
      surveillerAttente();
      return undefined;
    };
    const taper = (chiffre) => {
      if (occupe || bloque() > 0 || saisie.length >= max) return;
      if (!erreur.textContent.startsWith('Trop')) erreur.textContent = '';
      saisie += chiffre;
      dessiner();
      if (longueur !== null && saisie.length === longueur) valider();
    };
    const effacer = () => { if (!occupe) { saisie = saisie.slice(0, -1); dessiner(); } };

    d.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.chiffre) return taper(b.dataset.chiffre);
      if (b.dataset.act === 'effacer') return effacer();
      if (b.dataset.act === 'valider') return valider();
      if (b.dataset.act === 'annuler') return terminer(null);
      if (b.dataset.act === 'oubli') return surOubli();
      return undefined;
    });
    d.addEventListener('keydown', (ev) => {
      if (/^\d$/.test(ev.key)) { ev.preventDefault(); taper(ev.key); }
      else if (ev.key === 'Backspace') { ev.preventDefault(); effacer(); }
      else if (ev.key === 'Enter' && longueur === null && saisie.length >= NIP_MIN) { ev.preventDefault(); valider(); }
    });
    // Échap ou le bouton retour du téléphone : annule si c'est permis, sinon l'écran reste.
    d.addEventListener('cancel', (ev) => { ev.preventDefault(); if (annulable) terminer(null); });
    d.addEventListener('close', () => { if (!fini) d.showModal(); });

    dessiner();
    d.showModal();
    surveillerAttente();
  });
}

// Vérifie le NIP de l'app en comptant les essais ratés.
async function verifierNipDeLApp(nip) {
  const bon = await verifierNip(nip, etat.verrou);
  await noterEssai(bon);
  return bon || 'NIP incorrect.';
}

const attente = () => secondesRestantes(etat.essais, Date.now());

async function nipOublie() {
  const premier = await confirmer({
    titre: 'NIP oublié',
    texte: 'Personne ne peut retrouver ton NIP : il n\'est enregistré nulle part. La seule façon d\'entrer est d\'effacer tout ce que l\'app garde sur ce téléphone (heures, talons, réglages), puis de restaurer ta dernière sauvegarde.',
    oui: 'Effacer les données',
    danger: true,
  });
  if (!premier) return;
  const second = await confirmer({
    titre: 'Tout effacer sur ce téléphone ?',
    texte: 'Dernière vérification. Sans fichier de sauvegarde, tes heures seront perdues pour de bon.',
    oui: 'Oui, tout effacer',
    danger: true,
  });
  if (!second) return;
  await effacerToutesLesDonnees();
  location.reload();
}

// À l'ouverture de l'app : ne rend la main qu'avec le bon NIP.
export function deverrouiller() {
  return clavierNip({
    titre: APP.nom,
    texte: 'Entre ton NIP',
    longueur: etat.verrou.longueur,
    verifier: verifierNipDeLApp,
    attente,
    annulable: false,
    surOubli: nipOublie,
  });
}

// Dans les réglages : redemande le NIP en place avant de le changer ou de l'enlever.
function demanderNipActuel() {
  return clavierNip({ titre: 'NIP actuel', texte: 'Entre ton NIP actuel', longueur: etat.verrou.longueur, verifier: verifierNipDeLApp, attente });
}

async function choisirNouveauNip() {
  const premier = await clavierNip({ titre: 'Nouveau NIP', texte: `Choisis ${NIP_MIN} à ${NIP_MAX} chiffres, puis « Valider »` });
  if (!premier) return null;
  return clavierNip({
    titre: 'Encore une fois',
    texte: 'Entre le même NIP pour le confirmer',
    longueur: premier.length,
    verifier: async (nip) => nip === premier || 'Ce n\'est pas le même NIP. Réessaie.',
  });
}

export async function activerNip() {
  const nip = await choisirNouveauNip();
  if (!nip) return false;
  await enregistrerVerrou(await creerVerrou(nip));
  toast('NIP activé');
  return true;
}

export async function changerNip() {
  if (!await demanderNipActuel()) return false;
  const nip = await choisirNouveauNip();
  if (!nip) return false;
  await enregistrerVerrou(await creerVerrou(nip));
  toast('NIP changé');
  return true;
}

export async function desactiverNip() {
  if (!await demanderNipActuel()) return false;
  await retirerVerrou();
  toast('NIP désactivé');
  return true;
}
