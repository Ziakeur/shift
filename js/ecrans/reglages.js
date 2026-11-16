// Écran « Réglages » : un menu, puis une page par sujet (#/reglages/emploi, #/reglages/horaires…).
// « Mon emploi » : chaque ligne (employeur, convention, échelon, taux…) se change séparément, à partir d'une date.

import { etat, majReglages, nouvelId, exporterJSON, exporterCSV, importerJSON, validerSauvegarde, joursDepuisSauvegarde, aujourdhui } from '../etat.js';
import { APP } from '../config.js';
import { ajouterJours, formatDate } from '../temps.js';
import { tauxDuProfil, reglesDuProfil, profilPourDate, changerProfils } from '../calcul.js';
import { SECTEURS, ECHELONS, GRILLES_MANQUANTES, PROCHAINE_HAUSSE, prereglage, cleGrille, VACANCES_PCT } from '../grilles.js';
import { esc, argent, nombre, toast, formulaire, confirmer, telecharger, partager } from '../ui.js';
import { activerNip, changerNip, desactiverNip } from '../nip.js';

const UNITES = { heure: 'par heure travaillée', jour: 'par jour travaillé', semaine: 'par semaine travaillée' };
const CHAMPS_REGLES = ['seuilJour', 'seuilSemaine', 'heuresPalier1', 'multPalier1', 'multPalier2', 'multSamedi', 'multDimanche', 'multFerie', 'reductionFerie'];
const dateCourte = (d) => formatDate(d, { jour: false, annee: true });
const fr = (n) => (typeof n === 'number' ? String(n).replace('.', ',') : '');
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Les pages, dans l'ordre du menu. `resume` : ce qui est réglé en ce moment, affiché sous le titre.
const GROUPES = [
  { titre: 'Mon travail', pages: ['emploi', 'horaires', 'chantiers', 'primes'] },
  { titre: 'Règles de calcul', pages: ['taux', 'feries'] },
  { titre: 'Application', pages: ['affichage', 'verrou', 'sauvegarde', 'apropos'] },
];
const TITRES = {
  emploi: 'Mon emploi',
  horaires: 'Mes horaires habituels',
  chantiers: 'Mes chantiers',
  primes: 'Primes et indemnités',
  taux: 'Taux horaires',
  feries: 'Jours fériés',
  affichage: 'Affichage et semaine',
  verrou: 'Verrouillage par NIP',
  sauvegarde: 'Sauvegarde',
  apropos: 'À propos',
};
export const PAGES_REGLAGES = Object.keys(TITRES);

function nomConvention(p) {
  return `${SECTEURS[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`;
}

function texteTaux(p, date) {
  const t = tauxDuProfil(p, date, etat.grilles);
  if (t.taux === null) return { valeur: 'À vérifier', detail: 'Aucune grille vérifiée pour cette convention à cette date : entre ton taux.', manquant: true };
  if (t.origine === 'perso') return { valeur: `${argent(t.taux)} l'heure`, detail: 'Taux personnalisé (remplace la grille)' };
  return { valeur: `${argent(t.taux)} l'heure`, detail: `Grille en vigueur depuis le ${dateCourte(t.grille.dateEffet)}` };
}

function resumeProfil(p, date) {
  return [p.employeur, nomConvention(p), ECHELONS[p.echelon] ?? p.echelon, texteTaux(p, date).valeur].filter(Boolean).join(' · ');
}

function resumeRegles(r) {
  const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const paliers = r.heuresPalier1 > 0 && r.multPalier1 !== r.multPalier2
    ? `${r.heuresPalier1 === 1 ? 'la 1re heure' : `les ${fr(r.heuresPalier1)} premières heures`} de la semaine × ${fr(r.multPalier1)}, ensuite × ${fr(r.multPalier2)}`
    : `× ${fr(r.multPalier2)}`;
  const jours = [['samedi', r.multSamedi], ['dimanche', r.multDimanche], ['férié', r.multFerie]];
  const fixes = jours.filter(([, m]) => typeof m === 'number').map(([nom, m]) => `${nom} × ${fr(m)}`);
  const comme = jours.filter(([, m]) => typeof m !== 'number').map(([nom]) => nom);
  return `${fr(r.seuilJour)} h par jour, ${fr(r.seuilSemaine)} h par semaine. Au-delà : ${paliers}.`
    + `${fixes.length ? ` ${majuscule(fixes.join(', '))}.` : ''}`
    + `${comme.length ? ` ${majuscule(comme.join(', '))} : comme les heures supplémentaires.` : ''}`;
}

function texteSauvegarde() {
  const n = joursDepuisSauvegarde();
  return n === null ? 'jamais' : n === 0 ? 'aujourd\'hui' : `il y a ${pluriel(n, 'jour')}`;
}

// Journées notées sur un chantier : combien, de quand à quand.
function usageChantier(id) {
  const dates = [...etat.jours.values()].filter((j) => j.chantierId === id).map((j) => j.date).sort();
  return { nb: dates.length, premier: dates[0] ?? null, dernier: dates.at(-1) ?? null };
}

function texteUsage(u) {
  if (!u.nb) return 'Aucune journée pour l\'instant';
  if (u.nb === 1) return `1 journée, le ${dateCourte(u.premier)}`;
  return `${u.nb} journées, du ${dateCourte(u.premier)} au ${dateCourte(u.dernier)}`;
}

function resumePage(page, auj) {
  const r = etat.reglages;
  if (page === 'emploi') return resumeProfil(profilPourDate(r.profils, auj), auj);
  if (page === 'horaires') return r.modeles.length ? r.modeles.map((m) => m.nom).join(', ') : 'Aucun horaire enregistré';
  if (page === 'chantiers') return r.chantiers.length ? `${pluriel(r.chantiers.length, 'chantier')} : où tu as travaillé, jour par jour` : 'Aucun chantier';
  if (page === 'primes') return r.primes.length ? r.primes.map((p) => p.nom).join(', ') : 'Aucune (pension, déplacement, équipement…)';
  if (page === 'taux') return 'Les grilles de salaire, avec leur date et leur source';
  if (page === 'feries') return `${pluriel(r.feries.length, 'date')} : heures majorées ces jours-là`;
  if (page === 'affichage') return `Thème ${r.theme === 'clair' ? 'clair' : r.theme === 'auto' ? 'comme le téléphone' : 'sombre'} · semaine de paie du ${r.debutSemaine === 1 ? 'lundi au dimanche' : 'dimanche au samedi'}`;
  if (page === 'verrou') return etat.verrou ? 'Activé : NIP demandé à l\'ouverture' : 'Désactivé';
  if (page === 'sauvegarde') return `Dernière sauvegarde : ${texteSauvegarde()}`;
  return `${APP.nom}, version ${APP.version}`;
}

function htmlMenu(auj) {
  return `
    <header class="entete"><div class="entete-titre"><strong>Réglages</strong><small>Touche une ligne pour voir ou changer</small></div></header>
    ${GROUPES.map((g) => `
      <section class="menu-groupe">
        <h2 class="menu-titre">${esc(g.titre)}</h2>
        <div class="liste">
          ${g.pages.map((page) => `
            <button class="rangee" data-page="${page}">
              <span class="rangee-corps"><strong>${esc(TITRES[page])}</strong><small>${esc(resumePage(page, auj))}</small></span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>`).join('')}
        </div>
      </section>`).join('')}`;
}

function entetePage(page) {
  return `
    <header class="entete">
      <button class="btn-icone" data-act="retour" aria-label="Retour aux réglages">‹</button>
      <div class="entete-titre"><strong>${esc(TITRES[page])}</strong><small>Réglages</small></div>
      <span class="entete-vide" aria-hidden="true"></span>
    </header>`;
}

function ligneValeur(cle, label, valeur, detail = '', alerte = false) {
  return `
    <button class="rangee" data-changer="${cle}">
      <span class="rangee-corps"><small>${esc(label)}</small><strong class="${alerte ? 'texte-alerte' : ''}">${esc(valeur)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>`;
}

function htmlEmploi(auj) {
  const profils = [...etat.reglages.profils].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  const actif = profilPourDate(profils, auj);
  const taux = texteTaux(actif, auj);
  const regles = reglesDuProfil(actif);
  const aVenir = profils.filter((p) => p.dateEffet > auj).at(-1);
  return `
    <section class="carte">
      <h2>En ce moment</h2>
      <p class="aide">Touche une ligne pour la changer. Tu choisis la date du changement : les journées d'avant gardent l'ancien réglage, et leur paie ne bouge pas.</p>
      <div class="liste">
        ${ligneValeur('employeur', 'Employeur', actif.employeur || 'Non précisé')}
        ${ligneValeur('convention', 'Convention (secteur)', nomConvention(actif), 'Fixe le taux et les règles d\'heures supplémentaires')}
        ${ligneValeur('echelon', 'Échelon', ECHELONS[actif.echelon] ?? actif.echelon)}
        ${ligneValeur('taux', 'Taux horaire', taux.valeur, taux.detail, taux.manquant)}
        ${ligneValeur('regles', 'Heures supplémentaires', actif.regles ? 'Règles personnalisées' : 'Règles de la convention', resumeRegles(regles))}
        ${ligneValeur('vacances', 'Indemnité de vacances', `${nombre(actif.vacancesPct ?? VACANCES_PCT)} %`, 'Versée à part par l\'employeur, pas dans le net de la paie')}
      </div>
      ${aVenir ? `<p class="note-info">Un changement est déjà prévu le ${esc(dateCourte(aVenir.dateEffet))} : ${esc(resumeProfil(aVenir, aVenir.dateEffet))}.</p>` : ''}
    </section>

    <section class="carte">
      <h2>Historique</h2>
      <p class="aide">Tes réglages au fil du temps. Chaque période garde son taux et ses règles. Touche une période pour la corriger ou la supprimer.</p>
      <div class="liste">
        ${profils.map((p, i) => {
          const fin = i > 0 ? ajouterJours(profils[i - 1].dateEffet, -1) : null;
          const periode = fin ? `Du ${dateCourte(p.dateEffet)} au ${dateCourte(fin)}` : `Depuis le ${dateCourte(p.dateEffet)}`;
          const quand = p.dateEffet > auj ? p.dateEffet : (fin && fin < auj ? fin : auj);
          return `
          <button class="rangee" data-profil="${esc(p.id)}">
            <span class="rangee-corps"><strong>${esc(p.dateEffet > auj ? `À partir du ${dateCourte(p.dateEffet)}` : periode)}</strong><small>${esc(resumeProfil(p, quand))}${p.regles ? ' · règles personnalisées' : ''}</small></span>
            ${p.id === actif.id ? '<span class="badge badge-ok">en cours</span>' : p.dateEffet > auj ? '<span class="badge">à venir</span>' : ''}
          </button>`;
        }).join('')}
      </div>
    </section>`;
}

function htmlGrilles() {
  const groupes = new Map();
  for (const g of etat.grilles) {
    const cle = `${g.secteur}|${g.isole ? 1 : 0}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(g);
  }
  const statut = { verifie: ['vérifié', 'badge-ok'], 'date-a-verifier': ['date à vérifier', ''], perso: ['saisie à la main', ''] };
  return `
    <section class="carte">
      <p class="aide">Taux horaires du charpentier-menuisier, lus sur des sources officielles. Ton taux est choisi tout seul selon ta convention, ton échelon et la date. Touche une grille pour la corriger.</p>
      <p class="aide">${esc(PROCHAINE_HAUSSE.note)}</p>
      <button class="btn btn-large" data-act="grille-nouvelle">Ajouter une grille</button>
    </section>
    ${[...groupes.entries()].map(([cle, liste]) => {
      const [secteur, isole] = cle.split('|');
      const s = SECTEURS[secteur];
      return `<section class="carte">
      <h2>${esc(s?.nom ?? secteur)}${isole === '1' ? ', chantier isolé' : ''} <small>annexe ${esc(isole === '1' ? s?.annexeIsole : s?.annexe)}</small></h2>
      <div class="liste">
        ${liste.map((g) => `<button class="rangee" data-grille="${esc(cleGrille(g))}">
          <span class="rangee-corps">
            <span><strong>${esc(dateCourte(g.dateEffet))}</strong> <span class="badge ${statut[g.statut]?.[1] ?? ''}">${esc(statut[g.statut]?.[0] ?? g.statut)}</span></span>
            <small>Compagnon ${esc(nombre(g.taux.compagnon, 2))} · App. 1 ${esc(nombre(g.taux.app1, 2))} · App. 2 ${esc(nombre(g.taux.app2, 2))} · App. 3 ${esc(nombre(g.taux.app3, 2))}</small>
            <small>${esc(g.source ?? 'Source non précisée')}${g.note ? ` ${esc(g.note)}` : ''}</small>
          </span>
        </button>`).join('')}
      </div></section>`;
    }).join('')}
    <section class="carte">
      <h2>Non intégré, à vérifier</h2>
      <ul class="sources">${GRILLES_MANQUANTES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="aide">Pour valider un taux : outil « Salaire et taux » de la CCQ, tableaux de la SQI, ou texte de la convention. En cas de différence, la convention officielle prime.</p>
    </section>`;
}

function htmlListe(items, attribut, ligne, vide) {
  if (!items.length) return `<p class="aide">${esc(vide)}</p>`;
  return `<div class="liste">${items.map((x) => `<button class="rangee" data-${attribut}="${esc(x.id)}"><span class="rangee-corps">${ligne(x)}</span><span class="chevron" aria-hidden="true">›</span></button>`).join('')}</div>`;
}

function htmlPage(page, auj) {
  const r = etat.reglages;
  const chantierNom = (id) => r.chantiers.find((c) => c.id === id)?.nom;
  if (page === 'emploi') return htmlEmploi(auj);
  if (page === 'taux') return htmlGrilles();
  if (page === 'horaires') return `
    <section class="carte">
      <p class="aide">Un horaire habituel remplit une journée en un seul appui dans l'écran Jour. Les jours cochés servent à « Remplir la semaine ». Touche un horaire pour le modifier.</p>
      ${htmlListe(r.modeles, 'modele', (m) => `<span><strong>${esc(m.nom)}</strong></span><small>${esc(m.debut)} à ${esc(m.fin)}, pause ${esc(m.pauseMin ?? 0)} min, ${pluriel((m.jours ?? []).length, 'jour')} par semaine</small>`, 'Aucun horaire enregistré.')}
      <button class="btn btn-large btn-principal" data-act="modele-nouveau">Ajouter un horaire</button>
    </section>`;
  if (page === 'chantiers') return `
    <section class="carte">
      <p class="aide">Un chantier sert à garder la trace de l'endroit où tu as travaillé chaque jour. Dans l'écran Jour, les derniers utilisés sont proposés en premier.</p>
      ${htmlListe(r.chantiers, 'chantier', (c) => `<span><strong>${esc(c.nom)}</strong></span><small>${esc([c.adresse, c.ville].filter(Boolean).join(', ') || 'Pas d\'adresse')}</small><small>${esc(texteUsage(usageChantier(c.id)))}</small>`, 'Aucun chantier. Ajoute-en un ici ou directement depuis l\'écran Jour.')}
      <button class="btn btn-large btn-principal" data-act="chantier-nouveau">Ajouter un chantier</button>
    </section>`;
  if (page === 'primes') return `
    <section class="carte">
      <p class="aide">Montants ajoutés à la paie en plus des heures : pension, déplacement, prime de chantier isolé, équipement de sécurité… Tu choisis si chaque ligne compte dans le salaire brut ou si c'est une indemnité à part.</p>
      ${htmlListe(r.primes, 'prime', (p) => `<span><strong>${esc(p.nom)}</strong>${p.actif === false ? ' <span class="badge">en pause</span>' : ''}</span><small>${esc(argent(p.montant))} ${UNITES[p.unite]}${p.dansSalaire ? ' · compte dans le salaire' : ' · indemnité'}${p.chantierId ? ` · ${esc(chantierNom(p.chantierId) ?? 'chantier supprimé')}` : ''}</small>`, 'Aucune prime.')}
      <button class="btn btn-large btn-principal" data-act="prime-nouvelle">Ajouter une prime ou une indemnité</button>
      <p class="aide">Exemple lu dans les exemples de paie du 26 avril 2026 : indemnité d'équipement de sécurité de 0,75 $ par heure en institutionnel-commercial (ACQ) et de 0,65 $ en résidentiel léger (APCHQ), non imposable.</p>
    </section>`;
  if (page === 'feries') return `
    <section class="carte">
      <p class="aide">Dates prévues aux conventions 2025-2029. Les heures faites ces jours-là sont majorées, et le seuil d'heures normales de la semaine baisse. Touche une date pour la retirer.</p>
      <div class="puces">${[...r.feries].sort().map((d) => `<button class="puce" data-ferie="${d}">${esc(dateCourte(d))} ✕</button>`).join('')}</div>
      <div class="ligne-ajout"><input type="date" id="ferie-date" aria-label="Date à ajouter"><button class="btn" data-act="ferie-ajouter">Ajouter</button></div>
    </section>`;
  if (page === 'affichage') return `
    <section class="carte">
      <label class="champ"><span>Thème</span><select id="theme">
        <option value="sombre" ${r.theme === 'sombre' ? 'selected' : ''}>Sombre</option>
        <option value="clair" ${r.theme === 'clair' ? 'selected' : ''}>Clair (plein soleil)</option>
        <option value="auto" ${r.theme === 'auto' ? 'selected' : ''}>Comme le téléphone</option>
      </select></label>
      <label class="champ"><span>Fond de l'app</span><select id="fond">
        <option value="plan" ${r.fond !== 'uni' ? 'selected' : ''}>Plan de chantier (quadrillage et charpente)</option>
        <option value="uni" ${r.fond === 'uni' ? 'selected' : ''}>Uni, sans décor</option>
      </select></label>
      <label class="champ"><span>À l'ouverture, afficher</span><select id="ecran-ouverture">
        <option value="accueil" ${r.ecranOuverture !== 'jour' ? 'selected' : ''}>L'accueil (gains, heures, historique)</option>
        <option value="jour" ${r.ecranOuverture === 'jour' ? 'selected' : ''}>La saisie du jour (un appui de moins)</option>
      </select></label>
    </section>
    <section class="carte">
      <label class="champ"><span>Ma semaine de paie va du</span><select id="debut-semaine">
        <option value="0" ${r.debutSemaine === 0 ? 'selected' : ''}>Dimanche au samedi</option>
        <option value="1" ${r.debutSemaine === 1 ? 'selected' : ''}>Lundi au dimanche</option>
      </select></label>
      <p class="aide">Ta semaine normale de travail reste du lundi au vendredi. Ce réglage décide dans quelle semaine tombent le samedi et le dimanche : les totaux de l'app suivent alors les mêmes dates que ton talon de paie, et les heures de fin de semaine sont comptées avec la bonne semaine.</p>
      <p class="aide">Dans la construction, les semaines sont comptées du dimanche au samedi : c'est le découpage du rapport que l'employeur remet chaque mois à la CCQ. Si les dates de ton talon vont du lundi au dimanche, change ce réglage.</p>
    </section>`;
  if (page === 'verrou') return `
    <section class="carte">
      <p><strong>${etat.verrou ? 'NIP activé.' : 'NIP désactivé.'}</strong> ${etat.verrou ? 'L\'app le demande à l\'ouverture, et quand tu y reviens après plus d\'une minute ailleurs.' : 'L\'app s\'ouvre directement.'}</p>
      ${etat.verrou ? `
        <button class="btn btn-large" data-act="nip-changer">Changer le NIP</button>
        <button class="btn btn-large btn-danger" data-act="nip-desactiver">Désactiver le NIP</button>` : `
        <button class="btn btn-large btn-principal" data-act="nip-activer">Activer un NIP</button>`}
    </section>
    <section class="carte">
      <h2>${etat.verrou ? 'À savoir' : 'À savoir avant de l\'activer'}</h2>
      <p class="aide"><strong>NIP oublié : les données de ce téléphone sont effacées.</strong> Le NIP n'est enregistré nulle part, personne ne peut te le renvoyer. Il faudra tout effacer, puis restaurer ta dernière sauvegarde. Dernière sauvegarde : <strong>${esc(texteSauvegarde())}</strong>.</p>
      <p class="aide">C'est un verrou d'écran : il empêche quelqu'un qui prend ton téléphone d'ouvrir l'app. Il ne chiffre pas les données et ne protège pas le fichier de sauvegarde, qui reste lisible par qui l'a entre les mains.</p>
      <p class="aide">Après 5 NIP faux à la suite, il faut attendre avant de réessayer : 30 secondes, puis de plus en plus longtemps.</p>
      <a class="btn btn-large" href="#/reglages/sauvegarde">Faire une sauvegarde</a>
    </section>`;
  if (page === 'sauvegarde') return `
    <section class="carte">
      <p class="aide">Tes données sont seulement sur ce téléphone. Une sauvegarde est un fichier que tu gardes ailleurs (Google Drive, courriel à toi-même). Dernière sauvegarde : <strong>${esc(texteSauvegarde())}</strong>.</p>
      <button class="btn btn-large btn-principal" data-act="export-json">Sauvegarder mes données</button>
      <button class="btn btn-large" data-act="import">Restaurer une sauvegarde</button>
      <input type="file" id="fichier-import" accept="application/json,.json" class="cache">
      <p class="aide" id="etat-stockage"></p>
    </section>
    <section class="carte">
      <button class="btn btn-large" data-act="export-csv">Exporter mes heures en CSV (Excel)</button>
      <label class="champ"><span>Me rappeler de sauvegarder tous les (jours)</span>
        <input type="text" inputmode="numeric" id="rappel-jours" value="${esc(r.sauvegarde.rappelJours)}"></label>
    </section>`;
  return `
    <section class="carte">
      <p><strong>${esc(APP.nom)}</strong> · version ${esc(APP.version)}</p>
      <p class="aide">${esc(APP.mention)}</p>
      <p class="aide">Aucun compte, aucun serveur : rien ne quitte ce téléphone, sauf les fichiers que tu exportes toi-même.</p>
    </section>`;
}

export function rendreReglages(racine, param, naviguer) {
  const r = etat.reglages;
  const auj = aujourdhui();
  const page = TITRES[param] ? param : null;

  racine.innerHTML = page ? `${entetePage(page)}${htmlPage(page, auj)}` : htmlMenu(auj);

  const $ = (sel) => racine.querySelector(sel);
  const rafraichir = () => naviguer('reglages', page);

  if (page === 'sauvegarde' && navigator.storage?.persisted) {
    navigator.storage.persisted().then((ok) => {
      const el = $('#etat-stockage');
      if (el) el.textContent = ok
        ? 'Stockage protégé : Chrome ne supprimera pas tes données pour libérer de l\'espace.'
        : 'Stockage non protégé : Chrome peut effacer les données si le téléphone manque d\'espace. Installe l\'app sur l\'écran d\'accueil et sauvegarde régulièrement.';
    }).catch(() => {});
  }

  // ----- Mon emploi : changer une seule chose, à partir d'une date -----
  const actif = profilPourDate(r.profils, auj);

  const champsRegles = () => [
    { nom: 'reglesPerso', label: 'Personnaliser les règles', type: 'case', valeur: Boolean(actif.regles), aide: 'Décoché : règles de ta convention, remplies toutes seules.' },
    { nom: 'seuilJour', label: 'Heures normales par jour', type: 'nombre' },
    { nom: 'seuilSemaine', label: 'Heures normales par semaine', type: 'nombre' },
    { nom: 'heuresPalier1', label: 'Premières heures supplémentaires de la semaine (nombre)', type: 'nombre', aide: '0 = pas de premier palier.' },
    { nom: 'multPalier1', label: 'Multiplicateur de ces premières heures', type: 'nombre' },
    { nom: 'multPalier2', label: 'Multiplicateur des heures suivantes', type: 'nombre' },
    { nom: 'multSamedi', label: 'Samedi : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
    { nom: 'multDimanche', label: 'Dimanche : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
    { nom: 'multFerie', label: 'Férié : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
    { nom: 'reductionFerie', label: 'Heures retirées du seuil de la semaine par férié', type: 'nombre' },
  ];

  // Remplit ou grise les champs des règles selon la case « Personnaliser ».
  function suivreRegles(form, p, lireConvention) {
    const perso = form.elements.reglesPerso.checked;
    const pre = prereglage(...lireConvention(form));
    const initial = form.dataset.pret !== '1';
    for (const c of CHAMPS_REGLES) {
      const el = form.elements[c];
      if (!perso) el.value = fr(pre[c]);
      else if (initial) el.value = fr((p.regles ?? {})[c] ?? pre[c]);
      el.disabled = !perso;
    }
    form.dataset.pret = '1';
  }

  function validerRegles(v) {
    if (!v.reglesPerso) return null;
    if (!(v.seuilJour > 0) || !(v.seuilSemaine > 0)) return 'Les seuils par jour et par semaine doivent être plus grands que zéro.';
    if (!(v.multPalier2 >= 1) || (v.heuresPalier1 > 0 && !(v.multPalier1 >= 1))) return 'Les multiplicateurs doivent être d\'au moins 1.';
    for (const c of ['multSamedi', 'multDimanche', 'multFerie']) if (v[c] !== null && v[c] < 1) return 'Les multiplicateurs doivent être d\'au moins 1.';
    return null;
  }

  const lireRegles = (v) => (v.reglesPerso ? {
    seuilJour: v.seuilJour, seuilSemaine: v.seuilSemaine, heuresPalier1: v.heuresPalier1 ?? 0,
    multPalier1: v.multPalier1 ?? v.multPalier2, multPalier2: v.multPalier2,
    multSamedi: v.multSamedi, multDimanche: v.multDimanche, multFerie: v.multFerie, reductionFerie: v.reductionFerie ?? 0,
  } : null);

  const CHANGEMENTS = {
    employeur: {
      titre: 'Changer d\'employeur',
      champs: () => [{ nom: 'employeur', label: 'Nom de l\'employeur', valeur: actif.employeur, placeholder: 'Facultatif' }],
      lire: (v) => ({ employeur: v.employeur }),
    },
    convention: {
      titre: 'Changer de convention',
      intro: `La convention (le secteur) fixe ton taux et les règles d'heures supplémentaires. Si tu ne sais pas laquelle s'applique, regarde ton talon de paie ou demande à ton employeur.${actif.regles ? ' Tes règles d\'heures supplémentaires personnalisées restent en place : vérifie-les ensuite.' : ''}`,
      champs: () => [
        { nom: 'secteur', label: 'Convention (secteur)', type: 'choix', valeur: actif.secteur, options: Object.entries(SECTEURS).map(([valeur, s]) => ({ valeur, label: s.nom })) },
        { nom: 'isole', label: 'Chantier isolé, Baie-James ou nord du 55e', type: 'case', valeur: actif.isole },
        { nom: 'gite', label: 'Gîte et couvert fournis (chantier isolé)', type: 'case', valeur: actif.gite },
      ],
      suivre: (form) => { form.elements.gite.disabled = !form.elements.isole.checked; },
      lire: (v) => ({ secteur: v.secteur, isole: v.isole, gite: v.isole && v.gite }),
    },
    echelon: {
      titre: 'Changer d\'échelon',
      intro: 'Ton taux suit la grille de ta convention pour le nouvel échelon. C\'est ton employeur qui applique le changement sur ta paie.',
      champs: () => [{ nom: 'echelon', label: 'Échelon', type: 'choix', valeur: actif.echelon, options: Object.entries(ECHELONS).map(([valeur, label]) => ({ valeur, label })) }],
      lire: (v) => ({ echelon: v.echelon }),
    },
    taux: {
      titre: 'Changer le taux horaire',
      intro: 'Laisse vide pour suivre la grille de ta convention : les hausses prévues s\'appliquent alors toutes seules. Entre un montant seulement si ton employeur te paie un autre taux.',
      champs: () => {
        const grille = tauxDuProfil({ ...actif, tauxPerso: null }, auj, etat.grilles).taux;
        return [{ nom: 'tauxPerso', label: 'Taux personnalisé ($ l\'heure)', type: 'nombre', valeur: actif.tauxPerso, placeholder: grille === null ? 'Aucune grille : entre ton taux' : `Vide = grille (${argent(grille)})` }];
      },
      valider: (v) => (v.tauxPerso !== null && v.tauxPerso <= 0 ? 'Le taux doit être plus grand que zéro.' : null),
      lire: (v) => ({ tauxPerso: v.tauxPerso }),
    },
    regles: {
      titre: 'Heures supplémentaires',
      intro: 'Les règles de ta convention sont déjà remplies. Coche « Personnaliser » seulement si ton contrat prévoit autre chose.',
      champs: champsRegles,
      suivre: (form) => suivreRegles(form, actif, () => [actif.secteur, actif.isole, actif.gite]),
      valider: validerRegles,
      lire: (v) => ({ regles: lireRegles(v) }),
    },
    vacances: {
      titre: 'Indemnité de vacances',
      intro: `${VACANCES_PCT} % dans les conventions 2025-2029. Affichée à part : l'employeur la verse à la CCQ, elle n'est pas dans le net de la paie.`,
      champs: () => [{ nom: 'vacancesPct', label: 'Indemnité de vacances (%)', type: 'nombre', valeur: actif.vacancesPct ?? VACANCES_PCT, requis: true }],
      valider: (v) => (v.vacancesPct < 0 || v.vacancesPct > 30 ? 'L\'indemnité de vacances doit être entre 0 et 30 %.' : null),
      lire: (v) => ({ vacancesPct: v.vacancesPct }),
    },
  };

  async function changer(cle) {
    const def = CHANGEMENTS[cle];
    if (!def) return;
    const res = await formulaire({
      titre: def.titre,
      intro: def.intro ?? '',
      champs: [
        ...def.champs(),
        { type: 'titre', label: 'À partir de quand ?' },
        { nom: 'depuis', label: 'Date du changement', type: 'date', valeur: auj, aide: 'Les journées d\'avant cette date gardent l\'ancien réglage.' },
        { nom: 'correction', label: 'C\'était une erreur de saisie : corriger aussi les journées passées', type: 'case', valeur: false, aide: `Remplace le réglage en cours, en place depuis le ${dateCourte(actif.dateEffet)}. Les paies estimées de cette période seront recalculées.` },
      ],
      surChangement: (form) => {
        form.elements.depuis.disabled = form.elements.correction.checked;
        def.suivre?.(form);
      },
      valider: (v) => {
        if (!v.correction && !v.depuis) return 'Choisis la date du changement.';
        return def.valider?.(v) ?? null;
      },
    });
    if (res?.action !== 'ok') return;
    const v = res.valeurs;
    const changements = def.lire(v);
    await majReglages((reg) => {
      if (v.correction) Object.assign(reg.profils.find((p) => p.id === actif.id), changements);
      else reg.profils = changerProfils(reg.profils, changements, v.depuis, nouvelId);
    });
    toast(v.correction ? 'Réglage corrigé' : v.depuis > auj ? `Changement prévu le ${dateCourte(v.depuis)}` : `Changement enregistré à partir du ${dateCourte(v.depuis)}`);
    rafraichir();
  }

  // ----- Historique : corriger ou supprimer une période entière -----
  async function editerProfil(p) {
    const res = await formulaire({
      titre: 'Corriger cette période',
      intro: 'Tout ce qui est changé ici vaut pour toute la période, à partir de sa date de début. Les paies estimées de cette période seront recalculées.',
      supprimer: r.profils.length > 1,
      champs: [
        { nom: 'dateEffet', label: 'Début de la période', type: 'date', valeur: p.dateEffet, requis: true },
        { nom: 'employeur', label: 'Employeur', valeur: p.employeur, placeholder: 'Facultatif' },
        { nom: 'secteur', label: 'Convention (secteur)', type: 'choix', valeur: p.secteur, options: Object.entries(SECTEURS).map(([valeur, s]) => ({ valeur, label: s.nom })) },
        { nom: 'isole', label: 'Chantier isolé, Baie-James ou nord du 55e', type: 'case', valeur: p.isole },
        { nom: 'gite', label: 'Gîte et couvert fournis (chantier isolé)', type: 'case', valeur: p.gite },
        { nom: 'echelon', label: 'Échelon', type: 'choix', valeur: p.echelon, options: Object.entries(ECHELONS).map(([valeur, label]) => ({ valeur, label })) },
        { nom: 'tauxPerso', label: 'Taux personnalisé ($ l\'heure)', type: 'nombre', valeur: p.tauxPerso, placeholder: 'Vide = taux de la grille', aide: 'Remplace la grille (entente avec l\'employeur).' },
        { nom: 'vacancesPct', label: 'Indemnité de vacances (%)', type: 'nombre', valeur: p.vacancesPct ?? VACANCES_PCT },
        { type: 'titre', label: 'Heures supplémentaires' },
        ...champsRegles().map((c) => (c.nom === 'reglesPerso' ? { ...c, valeur: Boolean(p.regles) } : c)),
      ],
      surChangement: (form) => {
        form.elements.gite.disabled = !form.elements.isole.checked;
        suivreRegles(form, p, (f) => [f.elements.secteur.value, f.elements.isole.checked, f.elements.gite.checked]);
      },
      valider: (v) => {
        if (v.tauxPerso !== null && v.tauxPerso <= 0) return 'Le taux personnalisé doit être plus grand que zéro.';
        if (v.vacancesPct === null || v.vacancesPct < 0 || v.vacancesPct > 30) return 'L\'indemnité de vacances doit être entre 0 et 30 %.';
        if (r.profils.some((x) => x.id !== p.id && x.dateEffet === v.dateEffet)) return 'Une autre période commence déjà à cette date. Modifie-la plutôt.';
        return validerRegles(v);
      },
    });
    if (!res) return;
    if (res.action === 'supprimer') {
      const ok = await confirmer({ titre: 'Supprimer cette période ?', texte: 'Ses journées seront recalculées avec le réglage de la période précédente.', oui: 'Supprimer', danger: true });
      if (!ok) return;
      await majReglages((reg) => { reg.profils = reg.profils.filter((x) => x.id !== p.id); });
      return rafraichir();
    }
    const v = res.valeurs;
    const profil = { id: p.id, dateEffet: v.dateEffet, employeur: v.employeur, secteur: v.secteur, isole: v.isole, gite: v.isole && v.gite, echelon: v.echelon, tauxPerso: v.tauxPerso, vacancesPct: v.vacancesPct, regles: lireRegles(v) };
    await majReglages((reg) => { reg.profils = [...reg.profils.filter((x) => x.id !== p.id), profil]; });
    toast('Période corrigée');
    rafraichir();
  }

  // ----- Grilles -----
  async function editerGrille(g) {
    const estPerso = g?.statut === 'perso';
    const res = await formulaire({
      titre: g ? 'Corriger une grille' : 'Ajouter une grille',
      intro: 'N\'entre que des taux lus sur une source officielle (CCQ, convention collective, SQI). Une grille saisie ici remplace la grille intégrée de même secteur et de même date.',
      supprimer: estPerso,
      champs: [
        { nom: 'secteur', label: 'Secteur', type: 'choix', valeur: g?.secteur ?? 'ic', options: Object.entries(SECTEURS).map(([valeur, s]) => ({ valeur, label: s.nom })) },
        { nom: 'isole', label: 'Chantier isolé, Baie-James ou nord du 55e', type: 'case', valeur: g?.isole },
        { nom: 'dateEffet', label: 'Date d\'effet', type: 'date', valeur: g?.dateEffet, requis: true },
        { nom: 'compagnon', label: 'Compagnon ($ l\'heure)', type: 'nombre', valeur: g?.taux.compagnon, requis: true },
        { nom: 'app1', label: 'Apprenti 1', type: 'nombre', valeur: g?.taux.app1, requis: true },
        { nom: 'app2', label: 'Apprenti 2', type: 'nombre', valeur: g?.taux.app2, requis: true },
        { nom: 'app3', label: 'Apprenti 3', type: 'nombre', valeur: g?.taux.app3, requis: true },
        { nom: 'source', label: 'Source', valeur: estPerso ? g.source : '', requis: true, placeholder: 'Ex. : outil des taux CCQ, consulté le…' },
      ],
      valider: (v) => ([v.compagnon, v.app1, v.app2, v.app3].some((x) => !(x > 0)) ? 'Tous les taux doivent être plus grands que zéro.' : null),
    });
    if (!res) return;
    await majReglages((reg) => {
      if (estPerso) reg.grillesPerso = reg.grillesPerso.filter((x) => cleGrille(x) !== cleGrille(g));
      if (res.action === 'ok') {
        const v = res.valeurs;
        const nouvelle = { secteur: v.secteur, isole: v.isole, dateEffet: v.dateEffet, taux: { compagnon: v.compagnon, app1: v.app1, app2: v.app2, app3: v.app3 }, source: v.source };
        reg.grillesPerso = [...reg.grillesPerso.filter((x) => cleGrille(x) !== cleGrille(nouvelle)), nouvelle];
      }
    });
    toast(res.action === 'ok' ? 'Grille enregistrée' : 'Grille supprimée');
    rafraichir();
  }

  // ----- Listes simples : horaires, chantiers, primes -----
  async function editerElement(cle, existant, definition) {
    const res = await formulaire({ ...definition, supprimer: Boolean(existant) && definition.supprimer !== false });
    if (!res) return;
    await majReglages((reg) => {
      reg[cle] = reg[cle].filter((x) => x.id !== existant?.id);
      if (res.action === 'ok') reg[cle].push({ id: existant?.id ?? nouvelId(), ...res.valeurs });
    });
    rafraichir();
  }

  const defModele = (m) => ({
    titre: m ? 'Modifier l\'horaire' : 'Nouvel horaire habituel',
    champs: [
      { nom: 'nom', label: 'Nom', valeur: m?.nom, requis: true, placeholder: 'Ex. : 10 h, 6 jours' },
      { nom: 'debut', label: 'Début', type: 'time', valeur: m?.debut ?? '07:00', requis: true },
      { nom: 'fin', label: 'Fin', type: 'time', valeur: m?.fin ?? '17:30', requis: true, aide: 'Une fin avant le début = quart qui passe minuit.' },
      { nom: 'pauseMin', label: 'Pause non payée (minutes)', type: 'nombre', valeur: m?.pauseMin ?? 30 },
      { nom: 'jours', label: 'Jours de la semaine', type: 'jours', valeur: m?.jours ?? [1, 2, 3, 4, 5] },
    ],
    valider: (v) => (v.pauseMin !== null && v.pauseMin < 0 ? 'La pause ne peut pas être négative.' : null),
  });

  // Un chantier noté sur des journées ne se supprime pas : c'est la trace de l'endroit où le travail a été fait.
  const defChantier = (c) => {
    const usage = c ? usageChantier(c.id) : { nb: 0 };
    return {
      titre: c ? 'Modifier le chantier' : 'Nouveau chantier',
      intro: usage.nb ? `${texteUsage(usage)}. Tu peux le renommer ou corriger son adresse. Il ne peut pas être supprimé tant que des journées y sont notées : c'est ta trace.` : '',
      supprimer: !usage.nb,
      champs: [
        { nom: 'nom', label: 'Nom du chantier', valeur: c?.nom, requis: true },
        { nom: 'adresse', label: 'Rue ou adresse', valeur: c?.adresse, placeholder: 'Facultatif' },
        { nom: 'ville', label: 'Ville', valeur: c?.ville, placeholder: 'Facultatif' },
      ],
    };
  };

  const defPrime = (p) => ({
    titre: p ? 'Modifier la prime' : 'Nouvelle prime ou indemnité',
    champs: [
      { nom: 'nom', label: 'Nom', valeur: p?.nom, requis: true, placeholder: 'Pension, déplacement, prime…' },
      { nom: 'montant', label: 'Montant ($)', type: 'nombre', valeur: p?.montant, requis: true },
      { nom: 'unite', label: 'Versée', type: 'choix', valeur: p?.unite ?? 'jour', options: Object.entries(UNITES).map(([valeur, label]) => ({ valeur, label })) },
      { nom: 'dansSalaire', label: 'Compte dans le salaire brut (et les vacances)', type: 'case', valeur: p?.dansSalaire, aide: 'Coché pour une prime salariale. Décoché pour un remboursement ou une indemnité (pension, kilométrage, équipement).' },
      { nom: 'chantierId', label: 'Seulement sur ce chantier', type: 'choix', valeur: p?.chantierId ?? '', options: [{ valeur: '', label: 'Tous les chantiers' }, ...r.chantiers.map((c) => ({ valeur: c.id, label: c.nom }))] },
      { nom: 'debut', label: 'À partir du', type: 'date', valeur: p?.debut },
      { nom: 'fin', label: 'Jusqu\'au', type: 'date', valeur: p?.fin },
      { nom: 'actif', label: 'Active', type: 'case', valeur: p ? p.actif !== false : true },
    ],
    valider: (v) => (v.montant < 0 ? 'Le montant ne peut pas être négatif.' : v.debut && v.fin && v.fin < v.debut ? 'La date de fin est avant la date de début.' : null),
  });

  // ----- Sauvegarde -----
  async function marquerSauvegarde() {
    await majReglages((reg) => { reg.sauvegarde.dernierExport = new Date().toISOString(); });
    document.dispatchEvent(new CustomEvent('sauvegarde-faite'));
  }

  async function sauvegarder() {
    // La date de sauvegarde est inscrite dans le fichier, mais n'est retenue par l'app qu'une fois le fichier remis.
    const donnees = exporterJSON();
    donnees.reglages = { ...donnees.reglages, sauvegarde: { ...donnees.reglages.sauvegarde, dernierExport: donnees.exporteLe } };
    const contenu = JSON.stringify(donnees, null, 2);
    const nom = `sauvegarde-heures-${aujourdhui()}.json`;
    const etatPartage = await partager(nom, contenu, 'application/json', 'Sauvegarde de mes heures');
    if (etatPartage === 'annule') return toast('Sauvegarde annulée');
    if (etatPartage === 'indisponible') telecharger(nom, contenu, 'application/json');
    await marquerSauvegarde();
    toast(etatPartage === 'partage' ? 'Sauvegarde partagée' : 'Sauvegarde enregistrée dans Téléchargements');
    rafraichir();
  }

  async function restaurer(fichier) {
    let donnees;
    try {
      donnees = JSON.parse(await fichier.text());
      validerSauvegarde(donnees);
    } catch (e) {
      return toast(e instanceof SyntaxError ? 'Fichier illisible : ce n\'est pas un fichier JSON valide.' : e.message, 'erreur');
    }
    const ok = await confirmer({
      titre: 'Remplacer toutes les données ?',
      texte: `La sauvegarde du ${formatDate(donnees.exporteLe ? aujourdhui(new Date(donnees.exporteLe)) : aujourdhui(), { annee: true })} contient ${donnees.jours.length} journée(s). Les ${etat.jours.size} journée(s) et les réglages actuels de ce téléphone seront remplacés.`,
      oui: 'Remplacer', danger: true,
    });
    if (!ok) return;
    try {
      const bilan = await importerJSON(donnees);
      toast(`Restauration terminée : ${bilan.jours} journée(s)`);
      document.dispatchEvent(new CustomEvent('reglages-changes'));
      rafraichir();
    } catch (e) {
      toast(`Restauration impossible, rien n'a été modifié : ${e.message}`, 'erreur');
    }
  }

  racine.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.page) return naviguer('reglages', d.page);
    if (d.act === 'retour') return naviguer('reglages');
    if (d.changer) return changer(d.changer);
    if (d.profil) return editerProfil(r.profils.find((p) => p.id === d.profil));
    if (d.grille) return editerGrille(etat.grilles.find((g) => cleGrille(g) === d.grille));
    if (d.act === 'grille-nouvelle') return editerGrille(null);
    if (d.modele) return editerElement('modeles', r.modeles.find((x) => x.id === d.modele), defModele(r.modeles.find((x) => x.id === d.modele)));
    if (d.act === 'modele-nouveau') return editerElement('modeles', null, defModele(null));
    if (d.chantier) return editerElement('chantiers', r.chantiers.find((x) => x.id === d.chantier), defChantier(r.chantiers.find((x) => x.id === d.chantier)));
    if (d.act === 'chantier-nouveau') return editerElement('chantiers', null, defChantier(null));
    if (d.prime) return editerElement('primes', r.primes.find((x) => x.id === d.prime), defPrime(r.primes.find((x) => x.id === d.prime)));
    if (d.act === 'prime-nouvelle') return editerElement('primes', null, defPrime(null));
    if (d.ferie) {
      await majReglages((reg) => { reg.feries = reg.feries.filter((x) => x !== d.ferie); });
      return rafraichir();
    }
    if (d.act === 'ferie-ajouter') {
      const date = $('#ferie-date').value;
      if (!date) return toast('Choisis d\'abord une date.', 'erreur');
      await majReglages((reg) => { if (!reg.feries.includes(date)) reg.feries.push(date); });
      return rafraichir();
    }
    if (d.act === 'export-json') return sauvegarder();
    if (d.act === 'export-csv') {
      const contenu = exporterCSV();
      const nom = `heures-${aujourdhui()}.csv`;
      if (await partager(nom, contenu, 'text/csv', 'Mes heures') === 'indisponible') telecharger(nom, contenu, 'text/csv;charset=utf-8');
      return undefined;
    }
    if (d.act === 'import') return $('#fichier-import').click();
    if (d.act === 'nip-activer') return (await activerNip()) && rafraichir();
    if (d.act === 'nip-changer') return (await changerNip()) && rafraichir();
    if (d.act === 'nip-desactiver') return (await desactiverNip()) && rafraichir();
    return undefined;
  };

  racine.onchange = async (ev) => {
    const t = ev.target;
    if (t.id === 'theme') {
      await majReglages((reg) => { reg.theme = t.value; });
      document.dispatchEvent(new CustomEvent('reglages-changes'));
    } else if (t.id === 'fond') {
      await majReglages((reg) => { reg.fond = t.value; });
      document.dispatchEvent(new CustomEvent('reglages-changes'));
    } else if (t.id === 'ecran-ouverture') {
      await majReglages((reg) => { reg.ecranOuverture = t.value; });
      toast('Écran d\'ouverture modifié');
    } else if (t.id === 'debut-semaine') {
      await majReglages((reg) => { reg.debutSemaine = Number(t.value); });
      toast('Découpage des semaines modifié');
    } else if (t.id === 'rappel-jours') {
      const n = Math.max(1, Math.round(Number(t.value) || 7));
      await majReglages((reg) => { reg.sauvegarde.rappelJours = n; });
      t.value = n;
      document.dispatchEvent(new CustomEvent('sauvegarde-faite'));
    } else if (t.id === 'fichier-import' && t.files?.[0]) {
      await restaurer(t.files[0]);
      t.value = '';
    }
  };
}
