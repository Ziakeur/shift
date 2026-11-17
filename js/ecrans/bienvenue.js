// Écran de bienvenue : la configuration de départ, à la première ouverture de l'app (ou relancée depuis Profil).
// Quatre étapes courtes : prénom, travail, semaine, apparence. Rien n'est obligatoire. Chaque étape est
// enregistrée quand on la quitte par « Continuer » ; « Plus tard » ferme l'écran à tout moment.
// Les règles (ce qui est écrit dans les réglages) sont dans js/depart.js.

import { etat, majReglages, nouvelId, aujourdhui } from '../etat.js';
import { APP } from '../config.js';
import { profilPourDate, tauxDuProfil } from '../calcul.js';
import { SECTEURS, ECHELONS } from '../grilles.js';
import { formatDate } from '../temps.js';
import { nettoyerPrenom, appliquerEmploi, appliquerHoraire, erreurHoraire, ID_HORAIRE_DEPART, PRENOM_MAX } from '../depart.js';
import { dessinOssature } from '../decor.js';
import { esc, argent, lireNombre } from '../ui.js';
import { htmlChoix, htmlChoixApparence } from './reglages.js';

const NB_ETAPES = 4;
const FIN = NB_ETAPES + 1;
const JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const JOURS_NOMS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

// Ce qui est en cours de saisie. Gardé tant que l'écran n'est pas fermé, pour ne rien perdre si l'app passe en arrière-plan.
let session = null;

function nouvelleSession(auj) {
  const r = etat.reglages;
  const actif = profilPourDate(r.profils, auj);
  const horaire = r.modeles.find((m) => m.id === ID_HORAIRE_DEPART);
  return {
    etape: 0,
    depart: r.configDepart,
    prenom: r.prenom,
    employeur: actif.employeur ?? '',
    secteur: actif.secteur,
    echelon: actif.echelon,
    jours: [...r.joursTravail],
    debut: horaire?.debut ?? '',
    fin: horaire?.fin ?? '',
    pause: String(horaire?.pauseMin ?? 30),
    erreur: '',
  };
}

function tauxPour(s, auj) {
  const actif = profilPourDate(etat.reglages.profils, auj);
  return tauxDuProfil({ ...actif, secteur: s.secteur, echelon: s.echelon }, auj, etat.grilles);
}

function texteTaux(s, auj) {
  const t = tauxPour(s, auj);
  if (t.taux === null) return 'Aucune grille vérifiée pour ce choix à cette date : tu pourras entrer ton taux dans Profil, Mon emploi.';
  if (t.origine === 'perso') return `Ton taux personnalisé reste en place : ${argent(t.taux)} l'heure.`;
  return `Taux de la grille : ${argent(t.taux)} l'heure, en vigueur depuis le ${formatDate(t.grille.dateEffet, { jour: false, annee: true })}.`;
}

function htmlTete(s) {
  return `
    <header class="depart-tete">
      <button class="btn-icone" data-act="retour" aria-label="Étape précédente">‹</button>
      <div class="depart-points" role="img" aria-label="Étape ${s.etape} sur ${NB_ETAPES}">
        ${Array.from({ length: NB_ETAPES }, (_, i) => `<i class="${i < s.etape ? 'fait' : ''}"></i>`).join('')}
      </div>
      <button class="lien" data-act="plus-tard">${s.depart === 'fait' ? 'Fermer' : 'Plus tard'}</button>
    </header>`;
}

const htmlPied = (s, texte = 'Continuer') => `
    <p class="erreur" role="alert" ${s.erreur ? '' : 'hidden'}>${esc(s.erreur)}</p>
    <div class="depart-pied"><button class="btn btn-principal btn-large" data-act="suite">${texte}</button></div>`;

function htmlAccueil(s) {
  const premiere = s.depart === 'a-faire';
  const decor = etat.reglages.fond !== 'uni';
  return `
    <div class="depart depart-accueil">
      ${decor ? `<div class="decor depart-dessin">${dessinOssature()}</div>` : ''}
      <h1>${premiere ? `Bienvenue dans ${esc(APP.nom)}` : 'Configuration de départ'}</h1>
      ${premiere ? '<p>Tes heures de chantier, ta paie estimée et ton carnet d\'apprentissage, dans ta poche.</p>' : ''}
      <p class="aide">On règle l'essentiel en une minute : ton prénom, ta convention, ton échelon, ta semaine. Rien n'est obligatoire, et tout se change plus tard.</p>
      <div class="depart-pied">
        <button class="btn btn-principal btn-large" data-act="suite">Commencer</button>
        <button class="btn btn-large" data-act="plus-tard">${s.depart === 'fait' ? 'Fermer' : 'Plus tard'}</button>
        ${premiere ? '<button class="lien" data-act="restaurer">J\'ai déjà une sauvegarde à restaurer</button>' : ''}
      </div>
      <p class="aide">Aucun compte, aucun serveur : tes données restent sur ce téléphone.</p>
      <p class="aide">${esc(APP.mention)}</p>
    </div>`;
}

function htmlToi(s) {
  return `
    <div class="depart">
      ${htmlTete(s)}
      <h1>Comment on t'appelle ?</h1>
      <section class="carte">
        <label class="champ"><span>Ton prénom ou ton surnom</span>
          <input type="text" id="d-prenom" maxlength="${PRENOM_MAX}" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="next" placeholder="Facultatif" value="${esc(s.prenom)}"></label>
        <p class="aide">Pour te saluer sur l'accueil. Il reste sur ce téléphone. Tu peux laisser vide.</p>
      </section>
      ${htmlPied(s)}
    </div>`;
}

function htmlTravail(s, auj) {
  const secteurs = Object.entries(SECTEURS).map(([cle, x]) => [cle, x.nom]);
  const echelons = Object.entries(ECHELONS);
  return `
    <div class="depart">
      ${htmlTete(s)}
      <h1>Ton travail</h1>
      <section class="carte">
        <p class="aide">Ta convention et ton échelon fixent ton taux horaire et les règles d'heures supplémentaires. Pas certain ? Regarde ton talon de paie, ou continue sans rien changer : ça se règle aussi dans Profil, Mon emploi.</p>
        <div class="champ"><span>Convention (secteur)</span>${htmlChoix('secteur', secteurs, s.secteur, 'choix-1 choix-texte')}</div>
        <div class="champ"><span>Échelon</span>${htmlChoix('echelon', echelons, s.echelon, 'choix-2 choix-texte')}</div>
        <p class="note-info" id="d-taux">${esc(texteTaux(s, auj))}</p>
        <label class="champ"><span>Employeur</span>
          <input type="text" id="d-employeur" maxlength="80" autocomplete="organization" enterkeyhint="next" placeholder="Facultatif" value="${esc(s.employeur)}"></label>
        ${etat.jours.size ? '<p class="aide">Tu as déjà des journées saisies : un changement fait ici vaut à partir d\'aujourd\'hui, celles d\'avant gardent l\'ancien réglage. Pour corriger le passé : Profil, Mon emploi.</p>' : ''}
      </section>
      ${htmlPied(s)}
    </div>`;
}

function htmlSemaine(s) {
  const prets = etat.reglages.modeles.filter((m) => m.id !== ID_HORAIRE_DEPART).map((m) => `« ${m.nom} »`);
  return `
    <div class="depart">
      ${htmlTete(s)}
      <h1>Ta semaine</h1>
      <section class="carte">
        <div class="champ"><span>Tes jours de travail habituels</span>
          <div class="jours-cases">${JOURS_COURTS.map((l, i) => `<label class="jour-case"><input type="checkbox" name="d-jours" value="${i}" aria-label="${JOURS_NOMS[i]}" ${s.jours.includes(i) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
          <small class="aide">L'accueil te signale ces jours-là quand tu oublies de noter tes heures.</small>
        </div>
      </section>
      <section class="carte">
        <h2>Ton horaire habituel <small>facultatif</small></h2>
        <div class="duo">
          <label class="champ"><span>Début</span><input type="time" id="d-debut" value="${esc(s.debut)}"></label>
          <label class="champ"><span>Fin</span><input type="time" id="d-fin" value="${esc(s.fin)}"></label>
        </div>
        <label class="champ"><span>Pause non payée (minutes)</span>
          <input type="text" inputmode="numeric" id="d-pause" autocomplete="off" value="${esc(s.pause)}"></label>
        <p class="aide">Il remplira une journée en un seul appui.${prets.length ? ` Déjà ${prets.length > 1 ? 'prêts' : 'prêt'} : ${esc(prets.join(', '))}.` : ''} Tout se change dans Profil, Mes horaires habituels.</p>
      </section>
      ${htmlPied(s)}
    </div>`;
}

function htmlApparence(s) {
  return `
    <div class="depart">
      ${htmlTete(s)}
      <h1>À ton goût</h1>
      <section class="carte">
        <p class="aide">Touche pour essayer : le changement se voit tout de suite.</p>
        ${htmlChoixApparence(etat.reglages)}
      </section>
      ${htmlPied(s, 'Terminer')}
    </div>`;
}

function htmlFin(auj) {
  const r = etat.reglages;
  const p = profilPourDate(r.profils, auj);
  const t = tauxDuProfil(p, auj, etat.grilles);
  const horaire = r.modeles.find((m) => m.id === ID_HORAIRE_DEPART);
  const jours = [...r.joursTravail].sort((a, b) => a - b).map((j) => JOURS_NOMS[j]).join(' ');
  const lignes = [
    ['Prénom', r.prenom || 'Non précisé'],
    ['Employeur', p.employeur || 'Non précisé'],
    ['Convention', `${SECTEURS[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`],
    ['Échelon', ECHELONS[p.echelon] ?? p.echelon],
    ['Taux horaire', t.taux === null ? 'À vérifier' : `${argent(t.taux)}${t.origine === 'perso' ? ' (personnalisé)' : ''}`],
    ['Jours de travail', jours || 'Aucun'],
    ...(horaire ? [['Horaire habituel', `${horaire.debut} à ${horaire.fin}, pause ${horaire.pauseMin ?? 0} min`]] : []),
  ];
  return `
    <div class="depart depart-fin">
      ${r.fond !== 'uni' ? `<div class="decor depart-dessin">${dessinOssature()}</div>` : ''}
      <h1 class="centre">C'est prêt${r.prenom ? `, ${esc(r.prenom)}` : ''}.</h1>
      <section class="carte">
        <table class="tableau"><tbody>
          ${lignes.map(([nom, valeur]) => `<tr><td>${esc(nom)}</td><td class="montant">${esc(valeur)}</td></tr>`).join('')}
        </tbody></table>
      </section>
      <p class="aide">Quand tu veux, dans l'onglet Profil : ton carnet d'apprentissage, ta carte d'assurance, tes primes et tes chantiers.</p>
      <div class="depart-pied">
        <button class="btn btn-principal btn-large" data-act="finir" data-vers="jour">Saisir ma journée</button>
        <button class="btn btn-large" data-act="finir" data-vers="accueil">Aller à l'accueil</button>
      </div>
    </div>`;
}

export function rendreBienvenue(racine, param, naviguer) {
  const auj = aujourdhui();
  session ??= nouvelleSession(auj);
  const s = session;

  // Quitte l'écran sans le laisser dans l'historique : le bouton retour du téléphone n'y ramène pas.
  function sortir(ecran, page) {
    session = null;
    const cible = `#/${ecran}${page ? `/${page}` : ''}`;
    if (location.hash.startsWith('#/bienvenue')) location.replace(cible);
    else naviguer(ecran, page);
  }

  async function remettre(ecran, page) {
    if (etat.reglages.configDepart === 'a-faire') await majReglages((r) => { r.configDepart = 'plus-tard'; });
    sortir(ecran, page);
  }

  function dessiner() {
    racine.innerHTML = s.etape === 0 ? htmlAccueil(s)
      : s.etape === 1 ? htmlToi(s)
        : s.etape === 2 ? htmlTravail(s, auj)
          : s.etape === 3 ? htmlSemaine(s)
            : s.etape === 4 ? htmlApparence(s)
              : htmlFin(auj);
    window.scrollTo(0, 0);
    // La touche Entrée du clavier passe à l'étape suivante.
    for (const champ of racine.querySelectorAll('input[type="text"]')) {
      champ.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        suite();
      });
    }
    if (s.etape === 1) racine.querySelector('#d-prenom')?.focus();
  }

  // Enregistre l'étape affichée. Retourne un message d'erreur, ou null.
  async function enregistrer() {
    if (s.etape === 1) {
      await majReglages((r) => { r.prenom = nettoyerPrenom(s.prenom); });
    } else if (s.etape === 2) {
      const choix = { employeur: s.employeur.trim(), secteur: s.secteur, echelon: s.echelon };
      await majReglages((r) => { r.profils = appliquerEmploi(r.profils, choix, { auj, aDesJours: etat.jours.size > 0, creerId: nouvelId }); });
    } else if (s.etape === 3) {
      const horaire = { debut: s.debut, fin: s.fin, pauseMin: lireNombre(s.pause), jours: s.jours };
      const erreur = erreurHoraire(horaire);
      if (erreur) return erreur;
      await majReglages((r) => {
        r.joursTravail = [...s.jours].sort((a, b) => a - b);
        r.modeles = appliquerHoraire(r.modeles, horaire);
      });
    } else if (s.etape === 4) {
      await majReglages((r) => { r.configDepart = 'fait'; });
    }
    return null;
  }

  let occupe = false;
  async function suite() {
    if (occupe) return;
    occupe = true;
    try {
      s.erreur = (await enregistrer()) ?? '';
      if (!s.erreur) s.etape += 1;
      // Terminé : la prochaine ouverture de cet écran repart du début.
      if (s.etape === FIN) session = null;
    } finally {
      occupe = false;
    }
    dessiner();
  }

  racine.oninput = (ev) => {
    const t = ev.target;
    if (t.id === 'd-prenom') s.prenom = t.value;
    else if (t.id === 'd-employeur') s.employeur = t.value;
    else if (t.id === 'd-debut') s.debut = t.value;
    else if (t.id === 'd-fin') s.fin = t.value;
    else if (t.id === 'd-pause') s.pause = t.value;
    else if (t.name === 'd-jours') s.jours = [...racine.querySelectorAll('input[name="d-jours"]:checked')].map((i) => Number(i.value));
  };

  racine.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return undefined;
    const d = b.dataset;
    if (d.act === 'suite') return suite();
    if (d.act === 'retour') { s.erreur = ''; s.etape = Math.max(0, s.etape - 1); return dessiner(); }
    if (d.act === 'plus-tard') return remettre(s.depart === 'fait' ? 'profil' : 'accueil');
    if (d.act === 'restaurer') return remettre('reglages', 'sauvegarde');
    if (d.act === 'finir') return sortir(d.vers === 'jour' ? 'jour' : 'accueil');
    if (d.regler) {
      // Un choix en un appui : la case touchée devient la case en cours de son groupe.
      for (const c of b.closest('.choix').querySelectorAll('.choix-case')) {
        c.classList.toggle('actif', c === b);
        c.setAttribute('aria-pressed', String(c === b));
      }
      if (d.regler === 'secteur' || d.regler === 'echelon') {
        s[d.regler] = d.valeur;
        racine.querySelector('#d-taux').textContent = texteTaux(s, auj);
      } else if (['theme', 'accent', 'fond'].includes(d.regler)) {
        await majReglages((r) => { r[d.regler] = d.valeur; });
        document.dispatchEvent(new CustomEvent('reglages-changes'));
      }
    }
    return undefined;
  };

  dessiner();
}
