// Écran « Réglages » : profil et historique, grilles, modèles, chantiers, primes, fériés, sauvegarde.

import { etat, majReglages, nouvelId, exporterJSON, exporterCSV, importerJSON, validerSauvegarde, joursDepuisSauvegarde, aujourdhui } from '../etat.js';
import { APP } from '../config.js';
import { formatDate } from '../temps.js';
import { tauxDuProfil, reglesDuProfil } from '../calcul.js';
import { SECTEURS, ECHELONS, GRILLES_MANQUANTES, PROCHAINE_HAUSSE, prereglage, cleGrille, VACANCES_PCT } from '../grilles.js';
import { esc, argent, nombre, toast, formulaire, confirmer, telecharger, partager } from '../ui.js';

const ouverts = new Set(['profil']);
const UNITES = { heure: 'par heure travaillée', jour: 'par jour travaillé', semaine: 'par semaine travaillée' };
const CHAMPS_REGLES = ['seuilJour', 'seuilSemaine', 'heuresPalier1', 'multPalier1', 'multPalier2', 'multSamedi', 'multDimanche', 'multFerie', 'reductionFerie'];
const dateCourte = (d) => formatDate(d, { jour: false, annee: true });
const fr = (n) => (typeof n === 'number' ? String(n).replace('.', ',') : '');

function section(id, titre, contenu, compteur = '') {
  return `<details class="carte section" data-section="${id}" ${ouverts.has(id) ? 'open' : ''}>
    <summary><span>${esc(titre)}</span>${compteur !== '' ? `<small>${esc(compteur)}</small>` : ''}</summary>
    ${contenu}
  </details>`;
}

function resumeRegles(r) {
  const m = (x) => (typeof x === 'number' ? `× ${fr(x)}` : 'comme les autres heures supplémentaires');
  const paliers = r.heuresPalier1 > 0 && r.multPalier1 !== r.multPalier2
    ? `${fr(r.heuresPalier1)} première(s) heure(s) supplémentaire(s) de la semaine × ${fr(r.multPalier1)}, ensuite × ${fr(r.multPalier2)}`
    : `heures supplémentaires × ${fr(r.multPalier2)}`;
  return `${fr(r.seuilJour)} h par jour, ${fr(r.seuilSemaine)} h par semaine ; ${paliers} ; samedi ${m(r.multSamedi)} ; dimanche ${m(r.multDimanche)} ; férié ${m(r.multFerie)}.`;
}

function htmlProfils() {
  const auj = aujourdhui();
  const profils = [...etat.reglages.profils].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
  const actif = profils.find((p) => p.dateEffet <= auj) ?? profils.at(-1);
  return `
    <p class="aide">Chaque changement (taux, échelon, convention, employeur) s'applique à partir de sa date. Les semaines d'avant gardent l'ancien réglage.</p>
    <div class="liste">
      ${profils.map((p) => {
        const t = tauxDuProfil(p, p.dateEffet > auj ? p.dateEffet : auj, etat.grilles);
        const taux = t.taux === null ? 'taux à vérifier' : `${argent(t.taux)} l'heure${t.origine === 'perso' ? ' (personnalisé)' : ''}`;
        return `<button class="rangee" data-profil="${esc(p.id)}">
          <span class="rangee-corps">
            <span><strong>${esc(SECTEURS[p.secteur]?.nom ?? p.secteur)}${p.isole ? ', chantier isolé' : ''}</strong> · ${esc(ECHELONS[p.echelon])}</span>
            <small>Depuis le ${esc(dateCourte(p.dateEffet))}${p.employeur ? ` · ${esc(p.employeur)}` : ''} · ${esc(taux)}${p.regles ? ' · règles personnalisées' : ''}</small>
          </span>
          ${p.id === actif.id ? '<span class="badge badge-ok">en cours</span>' : p.dateEffet > auj ? '<span class="badge">à venir</span>' : ''}
        </button>`;
      }).join('')}
    </div>
    <button class="btn btn-large btn-principal" data-act="profil-nouveau">Ajouter un changement</button>
    <p class="aide"><strong>Heures supplémentaires en cours :</strong> ${esc(resumeRegles(reglesDuProfil(actif)))}</p>
    <p class="aide">${esc(reglesDuProfil(actif).source ?? '')}</p>`;
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
    <p class="aide">Taux horaires du charpentier-menuisier. Chaque grille porte sa date d'effet et sa source. Touche une grille pour la corriger.</p>
    <p class="aide">${esc(PROCHAINE_HAUSSE.note)}</p>
    ${[...groupes.entries()].map(([cle, liste]) => {
      const [secteur, isole] = cle.split('|');
      const s = SECTEURS[secteur];
      return `<h3 class="sous-titre">${esc(s?.nom ?? secteur)}${isole === '1' ? ', chantier isolé' : ''} <small>annexe ${esc(isole === '1' ? s?.annexeIsole : s?.annexe)}</small></h3>
      <div class="liste">
        ${liste.map((g) => `<button class="rangee" data-grille="${esc(cleGrille(g))}">
          <span class="rangee-corps">
            <span><strong>${esc(dateCourte(g.dateEffet))}</strong> <span class="badge ${statut[g.statut]?.[1] ?? ''}">${esc(statut[g.statut]?.[0] ?? g.statut)}</span></span>
            <small>Compagnon ${esc(nombre(g.taux.compagnon, 2))} · App. 1 ${esc(nombre(g.taux.app1, 2))} · App. 2 ${esc(nombre(g.taux.app2, 2))} · App. 3 ${esc(nombre(g.taux.app3, 2))}</small>
            <small>${esc(g.source ?? 'Source non précisée')}${g.note ? ` ${esc(g.note)}` : ''}</small>
          </span>
        </button>`).join('')}
      </div>`;
    }).join('')}
    <h3 class="sous-titre">Non intégré, à vérifier</h3>
    <ul class="sources">${GRILLES_MANQUANTES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="aide">Pour valider un taux : outil « Salaire et taux » de la CCQ, tableaux de la SQI, ou texte de la convention. En cas de différence, la convention officielle prime.</p>
    <button class="btn btn-large" data-act="grille-nouvelle">Ajouter une grille</button>`;
}

function htmlListe(items, attribut, ligne, vide) {
  if (!items.length) return `<p class="aide">${esc(vide)}</p>`;
  return `<div class="liste">${items.map((x) => `<button class="rangee" data-${attribut}="${esc(x.id)}"><span class="rangee-corps">${ligne(x)}</span></button>`).join('')}</div>`;
}

function htmlSauvegarde() {
  const n = joursDepuisSauvegarde();
  const quand = n === null ? 'jamais' : n === 0 ? 'aujourd\'hui' : `il y a ${n} jour(s)`;
  return `
    <p class="aide">Tes données sont seulement sur ce téléphone. Une sauvegarde est un fichier que tu gardes ailleurs (Google Drive, courriel à toi-même). Dernière sauvegarde : <strong>${esc(quand)}</strong>.</p>
    <button class="btn btn-large btn-principal" data-act="export-json">Sauvegarder mes données</button>
    <button class="btn btn-large" data-act="export-csv">Exporter mes heures en CSV (Excel)</button>
    <button class="btn btn-large" data-act="import">Restaurer une sauvegarde</button>
    <input type="file" id="fichier-import" accept="application/json,.json" class="cache">
    <label class="champ"><span>Me rappeler de sauvegarder tous les (jours)</span>
      <input type="text" inputmode="numeric" id="rappel-jours" value="${esc(etat.reglages.sauvegarde.rappelJours)}"></label>
    <p class="aide" id="etat-stockage"></p>`;
}

export function rendreReglages(racine, _param, naviguer) {
  const r = etat.reglages;
  const chantierNom = (id) => r.chantiers.find((c) => c.id === id)?.nom;

  racine.innerHTML = `
    <header class="entete"><div class="entete-titre"><strong>Réglages</strong><small>Rien n'est figé : tout se modifie ici</small></div></header>

    ${section('profil', 'Profil et historique', htmlProfils())}

    ${section('modeles', 'Modèles d\'horaire', `
      <p class="aide">Un modèle remplit une journée en un appui. Les jours cochés servent à « Remplir la semaine ».</p>
      ${htmlListe(r.modeles, 'modele', (m) => `<span><strong>${esc(m.nom)}</strong></span><small>${esc(m.debut)} à ${esc(m.fin)}, pause ${esc(m.pauseMin ?? 0)} min, ${(m.jours ?? []).length} jour(s) par semaine</small>`, 'Aucun modèle.')}
      <button class="btn btn-large" data-act="modele-nouveau">Ajouter un modèle</button>`, r.modeles.length)}

    ${section('chantiers', 'Chantiers', `
      ${htmlListe(r.chantiers, 'chantier', (c) => `<span><strong>${esc(c.nom)}</strong>${c.actif === false ? ' <span class="badge">terminé</span>' : ''}</span><small>${esc([c.adresse, c.ville].filter(Boolean).join(', ') || 'Pas d\'adresse')}</small>`, 'Aucun chantier. Ajoute-en un ici ou directement depuis l\'écran Jour.')}
      <button class="btn btn-large" data-act="chantier-nouveau">Ajouter un chantier</button>`, r.chantiers.length)}

    ${section('primes', 'Primes et indemnités', `
      <p class="aide">Lignes libres : pension, déplacement, prime de chantier isolé, équipement de sécurité… Exemple lu dans les exemples de paie du 26 avril 2026 : indemnité d'équipement de sécurité de 0,75 $ par heure en institutionnel-commercial (ACQ) et de 0,65 $ en résidentiel léger (APCHQ), non imposable.</p>
      ${htmlListe(r.primes, 'prime', (p) => `<span><strong>${esc(p.nom)}</strong>${p.actif === false ? ' <span class="badge">en pause</span>' : ''}</span><small>${esc(argent(p.montant))} ${UNITES[p.unite]}${p.dansSalaire ? ' · compte dans le salaire' : ' · indemnité'}${p.chantierId ? ` · ${esc(chantierNom(p.chantierId) ?? 'chantier supprimé')}` : ''}</small>`, 'Aucune prime.')}
      <button class="btn btn-large" data-act="prime-nouvelle">Ajouter une prime</button>`, r.primes.length)}

    ${section('grilles', 'Grilles de taux', htmlGrilles())}

    ${section('feries', 'Jours fériés', `
      <p class="aide">Dates prévues aux conventions 2025-2029. Les heures faites ces jours-là sont majorées, et le seuil de la semaine baisse. Touche une date pour la retirer.</p>
      <div class="puces">${[...r.feries].sort().map((d) => `<button class="puce" data-ferie="${d}">${esc(dateCourte(d))} ✕</button>`).join('')}</div>
      <div class="ligne-ajout"><input type="date" id="ferie-date" aria-label="Date à ajouter"><button class="btn" data-act="ferie-ajouter">Ajouter</button></div>`, r.feries.length)}

    ${section('affichage', 'Affichage et semaine', `
      <label class="champ"><span>Thème</span><select id="theme">
        <option value="sombre" ${r.theme === 'sombre' ? 'selected' : ''}>Sombre</option>
        <option value="clair" ${r.theme === 'clair' ? 'selected' : ''}>Clair (plein soleil)</option>
        <option value="auto" ${r.theme === 'auto' ? 'selected' : ''}>Comme le téléphone</option>
      </select></label>
      <label class="champ"><span>À l'ouverture, afficher</span><select id="ecran-ouverture">
        <option value="accueil" ${r.ecranOuverture !== 'jour' ? 'selected' : ''}>L'accueil (récapitulatif et ligne du temps)</option>
        <option value="jour" ${r.ecranOuverture === 'jour' ? 'selected' : ''}>La saisie du jour (un appui de moins)</option>
      </select></label>
      <label class="champ"><span>La semaine commence le</span><select id="debut-semaine">
        <option value="0" ${r.debutSemaine === 0 ? 'selected' : ''}>Dimanche (semaine de paie de la construction)</option>
        <option value="1" ${r.debutSemaine === 1 ? 'selected' : ''}>Lundi</option>
      </select><small class="aide">Change le découpage des semaines, donc le calcul des heures supplémentaires. Regarde les dates de ta période de paie sur ton talon.</small></label>`)}

    ${section('sauvegarde', 'Sauvegarde et restauration', htmlSauvegarde())}

    ${section('apropos', 'À propos', `
      <p><strong>${esc(APP.nom)}</strong> · version ${esc(APP.version)}</p>
      <p class="aide">${esc(APP.mention)}</p>
      <p class="aide">Aucun compte, aucun serveur : rien ne quitte ce téléphone, sauf les fichiers que tu exportes toi-même.</p>`)}
  `;

  const $ = (sel) => racine.querySelector(sel);
  const rafraichir = () => naviguer('reglages');

  for (const d of racine.querySelectorAll('details[data-section]')) {
    d.addEventListener('toggle', () => (d.open ? ouverts.add(d.dataset.section) : ouverts.delete(d.dataset.section)));
  }

  if (navigator.storage?.persisted) {
    navigator.storage.persisted().then((ok) => {
      const el = $('#etat-stockage');
      if (el) el.textContent = ok
        ? 'Stockage protégé : Chrome ne supprimera pas tes données pour libérer de l\'espace.'
        : 'Stockage non protégé : Chrome peut effacer les données si le téléphone manque d\'espace. Installe l\'app sur l\'écran d\'accueil et sauvegarde régulièrement.';
    }).catch(() => {});
  }

  // ----- Profil -----
  async function editerProfil(p, nouveau) {
    const res = await formulaire({
      titre: nouveau ? 'Nouveau changement' : 'Modifier le profil',
      intro: nouveau ? 'S\'applique à partir de la date choisie. Les semaines d\'avant ne changent pas.' : '',
      supprimer: !nouveau && r.profils.length > 1,
      champs: [
        { nom: 'dateEffet', label: 'À partir du', type: 'date', valeur: p.dateEffet, requis: true },
        { nom: 'employeur', label: 'Employeur', valeur: p.employeur, placeholder: 'Facultatif' },
        { nom: 'secteur', label: 'Convention (secteur)', type: 'choix', valeur: p.secteur, options: Object.entries(SECTEURS).map(([valeur, s]) => ({ valeur, label: s.nom })) },
        { nom: 'isole', label: 'Chantier isolé, Baie-James ou nord du 55e', type: 'case', valeur: p.isole },
        { nom: 'gite', label: 'Gîte et couvert fournis (chantier isolé)', type: 'case', valeur: p.gite },
        { nom: 'echelon', label: 'Échelon', type: 'choix', valeur: p.echelon, options: Object.entries(ECHELONS).map(([valeur, label]) => ({ valeur, label })) },
        { nom: 'tauxPerso', label: 'Taux personnalisé ($ l\'heure)', type: 'nombre', valeur: p.tauxPerso, placeholder: 'Vide = taux de la grille', aide: 'Remplace la grille (entente avec l\'employeur).' },
        { nom: 'vacancesPct', label: 'Indemnité de vacances (%)', type: 'nombre', valeur: p.vacancesPct ?? VACANCES_PCT },
        { type: 'titre', label: 'Heures supplémentaires' },
        { nom: 'reglesPerso', label: 'Personnaliser les règles', type: 'case', valeur: Boolean(p.regles), aide: 'Décoché : préréglage de la convention choisie.' },
        { nom: 'seuilJour', label: 'Heures normales par jour', type: 'nombre' },
        { nom: 'seuilSemaine', label: 'Heures normales par semaine', type: 'nombre' },
        { nom: 'heuresPalier1', label: 'Premières heures supplémentaires de la semaine (nombre)', type: 'nombre', aide: '0 = pas de premier palier.' },
        { nom: 'multPalier1', label: 'Multiplicateur de ces premières heures', type: 'nombre' },
        { nom: 'multPalier2', label: 'Multiplicateur des heures suivantes', type: 'nombre' },
        { nom: 'multSamedi', label: 'Samedi : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
        { nom: 'multDimanche', label: 'Dimanche : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
        { nom: 'multFerie', label: 'Férié : multiplicateur', type: 'nombre', placeholder: 'Vide = comme les autres heures supp.' },
        { nom: 'reductionFerie', label: 'Heures retirées du seuil de la semaine par férié', type: 'nombre' },
      ],
      surChangement: (form) => {
        const perso = form.elements.reglesPerso.checked;
        const pre = prereglage(form.elements.secteur.value, form.elements.isole.checked, form.elements.gite.checked);
        form.elements.gite.disabled = !form.elements.isole.checked;
        const initial = form.dataset.pret !== '1';
        for (const c of CHAMPS_REGLES) {
          const el = form.elements[c];
          if (!perso) el.value = fr(pre[c]);
          else if (initial) el.value = fr((p.regles ?? {})[c] ?? pre[c]);
          el.disabled = !perso;
        }
        form.dataset.pret = '1';
      },
      valider: (v) => {
        if (v.tauxPerso !== null && v.tauxPerso <= 0) return 'Le taux personnalisé doit être plus grand que zéro.';
        if (v.vacancesPct === null || v.vacancesPct < 0 || v.vacancesPct > 30) return 'L\'indemnité de vacances doit être entre 0 et 30 %.';
        if (r.profils.some((x) => x.id !== p.id && x.dateEffet === v.dateEffet)) return 'Un autre réglage commence déjà à cette date. Modifie-le plutôt.';
        if (v.reglesPerso) {
          if (!(v.seuilJour > 0) || !(v.seuilSemaine > 0)) return 'Les seuils par jour et par semaine doivent être plus grands que zéro.';
          if (!(v.multPalier2 >= 1) || (v.heuresPalier1 > 0 && !(v.multPalier1 >= 1))) return 'Les multiplicateurs doivent être d\'au moins 1.';
          for (const c of ['multSamedi', 'multDimanche', 'multFerie']) if (v[c] !== null && v[c] < 1) return 'Les multiplicateurs doivent être d\'au moins 1.';
        }
        return null;
      },
    });
    if (!res) return;
    if (res.action === 'supprimer') {
      const ok = await confirmer({ titre: 'Supprimer ce réglage ?', texte: 'Les semaines concernées seront recalculées avec le réglage précédent.', oui: 'Supprimer', danger: true });
      if (!ok) return;
      await majReglages((reg) => { reg.profils = reg.profils.filter((x) => x.id !== p.id); });
      return rafraichir();
    }
    const v = res.valeurs;
    const regles = v.reglesPerso ? {
      seuilJour: v.seuilJour, seuilSemaine: v.seuilSemaine, heuresPalier1: v.heuresPalier1 ?? 0,
      multPalier1: v.multPalier1 ?? v.multPalier2, multPalier2: v.multPalier2,
      multSamedi: v.multSamedi, multDimanche: v.multDimanche, multFerie: v.multFerie, reductionFerie: v.reductionFerie ?? 0,
    } : null;
    const profil = { id: p.id, dateEffet: v.dateEffet, employeur: v.employeur, secteur: v.secteur, isole: v.isole, gite: v.isole && v.gite, echelon: v.echelon, tauxPerso: v.tauxPerso, vacancesPct: v.vacancesPct, regles };
    await majReglages((reg) => { reg.profils = [...reg.profils.filter((x) => x.id !== p.id), profil]; });
    toast('Profil enregistré');
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

  // ----- Listes simples : modèles, chantiers, primes -----
  async function editerElement(cle, existant, definition) {
    const res = await formulaire({ ...definition, supprimer: Boolean(existant) });
    if (!res) return;
    await majReglages((reg) => {
      reg[cle] = reg[cle].filter((x) => x.id !== existant?.id);
      if (res.action === 'ok') reg[cle].push({ id: existant?.id ?? nouvelId(), ...res.valeurs });
    });
    rafraichir();
  }

  const defModele = (m) => ({
    titre: m ? 'Modifier le modèle' : 'Nouveau modèle',
    champs: [
      { nom: 'nom', label: 'Nom', valeur: m?.nom, requis: true, placeholder: 'Ex. : 10 h, 6 jours' },
      { nom: 'debut', label: 'Début', type: 'time', valeur: m?.debut ?? '07:00', requis: true },
      { nom: 'fin', label: 'Fin', type: 'time', valeur: m?.fin ?? '17:30', requis: true, aide: 'Une fin avant le début = quart qui passe minuit.' },
      { nom: 'pauseMin', label: 'Pause non payée (minutes)', type: 'nombre', valeur: m?.pauseMin ?? 30 },
      { nom: 'jours', label: 'Jours de la semaine', type: 'jours', valeur: m?.jours ?? [1, 2, 3, 4, 5] },
    ],
    valider: (v) => (v.pauseMin !== null && v.pauseMin < 0 ? 'La pause ne peut pas être négative.' : null),
  });

  const defChantier = (c) => ({
    titre: c ? 'Modifier le chantier' : 'Nouveau chantier',
    champs: [
      { nom: 'nom', label: 'Nom du chantier', valeur: c?.nom, requis: true },
      { nom: 'adresse', label: 'Rue ou adresse', valeur: c?.adresse, placeholder: 'Facultatif' },
      { nom: 'ville', label: 'Ville', valeur: c?.ville, placeholder: 'Facultatif' },
      { nom: 'actif', label: 'Chantier en cours (proposé dans l\'écran Jour)', type: 'case', valeur: c ? c.actif !== false : true },
    ],
  });

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
    if (d.profil) return editerProfil(r.profils.find((p) => p.id === d.profil), false);
    if (d.act === 'profil-nouveau') {
      const auj = aujourdhui();
      const base = [...r.profils].sort((a, c) => a.dateEffet.localeCompare(c.dateEffet)).filter((p) => p.dateEffet <= auj).at(-1) ?? r.profils[0];
      return editerProfil({ ...base, id: nouvelId(), dateEffet: auj }, true);
    }
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
    return undefined;
  };

  racine.onchange = async (ev) => {
    const t = ev.target;
    if (t.id === 'theme') {
      await majReglages((reg) => { reg.theme = t.value; });
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
