// Écran « Jour » : saisie rapide d'une journée. Tout s'enregistre tout seul à chaque changement.
// Ce qui dure (employeur, convention, échelon, taux) vient du profil en vigueur et ne se ressaisit pas.

import { etat, enregistrerJour, supprimerJour, dernierJourAvant, majReglages, nouvelId, chantier, debutSemaine, semaine, aujourdhui } from '../etat.js';
import { ajouterJours, dureeQuart, formatDate, formatDuree, hhmmEnMinutes, minutesEnHhmm, nomJour } from '../temps.js';
import { nomMultiplicateur, profilPourDate, tauxDuProfil } from '../calcul.js';
import { SECTEURS, ECHELONS } from '../grilles.js';
import { esc, argent, toast, formulaire, confirmer, choisir, lienCarte } from '../ui.js';

const PAUSES = [0, 15, 30, 45, 60];
const PAUSE_DEFAUT = 30;
const NB_CHANTIERS_RAPIDES = 4;

function heureLisible(hhmm) {
  const m = hhmmEnMinutes(hhmm);
  if (m === null) return '';
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

function resumeQuart(j) {
  return j?.debut && j?.fin ? `${heureLisible(j.debut)} à ${heureLisible(j.fin)}` : '';
}

function estVide(j) {
  return !j.debut && !j.fin && !j.note && !j.chantierId && typeof j.ferie !== 'boolean';
}

// « Employeur · Convention · Échelon »
function resumeProfil(p) {
  return [p.employeur, `${SECTEURS[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`, ECHELONS[p.echelon] ?? p.echelon].filter(Boolean).join(' · ');
}

function texteTaux(p, date) {
  const t = tauxDuProfil(p, date, etat.grilles);
  return t.taux === null ? 'taux à vérifier' : `${argent(t.taux)} l'heure${t.origine === 'perso' ? ' (personnalisé)' : ''}`;
}

// Deux profils qui donnent la même paie ont la même signature (la date d'effet ne compte pas).
function signature(p) {
  return JSON.stringify([p.employeur ?? '', p.secteur, Boolean(p.isole), Boolean(p.gite), p.echelon, p.tauxPerso ?? null, p.regles ?? null, p.vacancesPct ?? null]);
}

export function rendreJour(racine, date, naviguer) {
  const auj = aujourdhui();
  const existant = etat.jours.get(date);
  const precedent = dernierJourAvant(date);
  // Fiche de travail : celle du jour, ou une fiche vide avec le chantier de la veille déjà choisi.
  const fiche = existant ? { ...existant } : { date, debut: '', fin: '', pauseMin: PAUSE_DEFAUT, chantierId: null, note: '' };
  const chantierPropose = !existant ? (dernierJourAvant(date, { avecHeures: false })?.chantierId ?? null) : null;
  const dansListeFeries = etat.reglages.feries.includes(date);
  let chantierId = fiche.chantierId ?? chantierPropose;
  if (chantierId && !chantier(chantierId)) chantierId = null;

  const hier = ajouterJours(date, -1);
  const libelleHier = precedent ? (precedent.date === hier ? 'Comme hier' : `Comme ${nomJour(precedent.date)}`) : null;

  const modeles = etat.reglages.modeles;
  const profil = profilPourDate(etat.reglages.profils, date);

  racine.innerHTML = `
    <header class="entete">
      <button class="btn-icone" data-act="prec" aria-label="Jour précédent">‹</button>
      <button class="entete-titre" data-act="date">
        <strong>${esc(formatDate(date))}</strong>
        <small>${date === auj ? 'Aujourd\'hui' : date === ajouterJours(auj, -1) ? 'Hier' : esc(date.slice(0, 4))}</small>
      </button>
      <button class="btn-icone" data-act="suiv" aria-label="Jour suivant">›</button>
      <input type="date" class="cache" id="choix-date" value="${date}" aria-label="Choisir une date">
    </header>
    ${date !== auj ? '<button class="lien retour-auj" data-act="auj">Revenir à aujourd\'hui</button>' : ''}

    ${profil ? `<button class="contexte" data-act="profil" aria-label="Changer d'employeur, de convention ou d'échelon">
      <span class="contexte-texte">${esc(resumeProfil(profil))} · ${esc(texteTaux(profil, date))}</span>
      <span class="contexte-action">Changer</span>
    </button>` : ''}

    <section class="carte resume" id="resume" aria-live="polite"></section>

    <div class="ligne-effacer" id="zone-effacer" hidden>
      <button class="btn btn-compact btn-danger" data-act="effacer-heures" id="effacer-heures">Effacer les heures</button>
      <button class="btn btn-compact btn-danger" data-act="effacer" id="effacer">Effacer la journée</button>
    </div>

    <section class="rapides" aria-label="Saisie rapide">
      ${libelleHier ? `<button class="btn btn-rapide" data-act="hier"><strong>${esc(libelleHier)}</strong><small>${esc(resumeQuart(precedent))}</small></button>` : ''}
      ${modeles.map((m) => `<button class="btn btn-rapide" data-modele="${esc(m.id)}"><strong>${esc(m.nom)}</strong><small>${esc(resumeQuart(m))}</small></button>`).join('')}
      ${!modeles.length && !libelleHier ? '<p class="aide">Crée un modèle d\'horaire dans les réglages pour saisir une journée en un seul appui.</p>' : ''}
    </section>

    <section class="carte">
      <div class="ligne-heure">
        <label for="debut">Début</label>
        <button class="btn-pas" data-pas="debut" data-delta="-15" aria-label="Début 15 minutes plus tôt">−15</button>
        <input type="time" id="debut" value="${esc(fiche.debut)}">
        <button class="btn-pas" data-pas="debut" data-delta="15" aria-label="Début 15 minutes plus tard">+15</button>
      </div>
      <div class="ligne-heure">
        <label for="fin">Fin</label>
        <button class="btn-pas" data-pas="fin" data-delta="-15" aria-label="Fin 15 minutes plus tôt">−15</button>
        <input type="time" id="fin" value="${esc(fiche.fin)}">
        <button class="btn-pas" data-pas="fin" data-delta="15" aria-label="Fin 15 minutes plus tard">+15</button>
      </div>
      <div class="champ">
        <span>Pause non payée (minutes)</span>
        <div class="puces" id="pauses">
          ${PAUSES.map((p) => `<button class="puce" data-pause="${p}">${p}</button>`).join('')}
          <input type="text" inputmode="numeric" id="pause" class="puce-saisie" aria-label="Autre durée de pause" value="${esc(fiche.pauseMin ?? 0)}">
        </div>
      </div>
    </section>

    <section class="carte">
      <div class="champ">
        <span>Chantier</span>
        <div class="puces" id="chantiers"></div>
      </div>
      <p class="aide" id="info-chantier"></p>
      <label class="case">
        <input type="checkbox" id="ferie">
        <span>Jour férié ou congé obligatoire (heures majorées)</span>
      </label>
      <label class="champ">
        <span>Note</span>
        <textarea id="note" rows="2" placeholder="Tâche, météo, retard, témoin…">${esc(fiche.note ?? '')}</textarea>
      </label>
    </section>
  `;

  const $ = (sel) => racine.querySelector(sel);
  const champs = { debut: $('#debut'), fin: $('#fin'), pause: $('#pause'), ferie: $('#ferie'), note: $('#note') };
  champs.ferie.checked = typeof fiche.ferie === 'boolean' ? fiche.ferie : dansListeFeries;

  function lire() {
    const pause = Math.max(0, Math.round(Number(String(champs.pause.value).replace(',', '.')) || 0));
    const j = {
      date,
      debut: champs.debut.value || '',
      fin: champs.fin.value || '',
      pauseMin: pause,
      chantierId,
      note: champs.note.value.trim(),
    };
    // On ne retient le choix « férié » que s'il diffère de la liste des fériés.
    if (champs.ferie.checked !== dansListeFeries) j.ferie = champs.ferie.checked;
    return j;
  }

  // Chantiers, du plus récemment utilisé au plus ancien ; les jamais utilisés ensuite, le dernier créé d'abord.
  // La journée affichée ne compte pas : les pastilles ne changent pas de place quand on en touche une.
  function chantiersParUsage() {
    const dernier = new Map();
    for (const [d, j] of etat.jours) {
      if (d !== date && j.chantierId && d > (dernier.get(j.chantierId) ?? '')) dernier.set(j.chantierId, d);
    }
    return etat.reglages.chantiers
      .map((c, i) => ({ c, i, d: dernier.get(c.id) ?? '' }))
      .sort((a, b) => b.d.localeCompare(a.d) || b.i - a.i)
      .map((x) => x.c);
  }

  function afficherChantiers() {
    const tous = chantiersParUsage();
    const visibles = tous.slice(0, NB_CHANTIERS_RAPIDES);
    const choisi = tous.find((c) => c.id === chantierId);
    if (choisi && !visibles.includes(choisi)) visibles.splice(-1, 1, choisi);
    $('#chantiers').innerHTML = `
      ${visibles.map((c) => `<button class="puce puce-nom ${c.id === chantierId ? 'actif' : ''}" data-chantier="${esc(c.id)}" aria-pressed="${c.id === chantierId}">${esc(c.nom)}</button>`).join('')}
      ${tous.length > visibles.length ? '<button class="puce" data-act="chantiers-autres">Autres…</button>' : ''}
      <button class="puce" data-act="chantier-nouveau">＋ Nouveau</button>`;
    const ch = chantier(chantierId);
    const carte = lienCarte(ch);
    $('#info-chantier').innerHTML = ch
      ? `${esc([ch.adresse, ch.ville].filter(Boolean).join(', ') || 'Pas d\'adresse')}${carte ? ` · <a href="${esc(carte)}" target="_blank" rel="noopener">Voir sur la carte</a>` : ''}`
      : (etat.reglages.chantiers.length ? 'Aucun chantier choisi pour cette journée.' : 'Ajoute un chantier pour savoir où tu as travaillé chaque jour.');
  }

  function afficher() {
    const j = lire();
    const aDesHeures = Boolean(j.debut && j.fin);
    for (const b of racine.querySelectorAll('[data-pause]')) b.classList.toggle('actif', Number(b.dataset.pause) === j.pauseMin);
    afficherChantiers();
    const enregistre = etat.jours.has(date);
    $('#effacer').hidden = !enregistre;
    $('#effacer-heures').hidden = !(j.debut || j.fin);
    $('#zone-effacer').hidden = $('#effacer').hidden && $('#effacer-heures').hidden;

    const resume = $('#resume');
    if (!aDesHeures) {
      const manque = j.debut ? 'Il manque l\'heure de fin.' : j.fin ? 'Il manque l\'heure de début.' : 'Aucune heure saisie.';
      resume.innerHTML = `<div class="grand discret">0 h</div><p class="aide">${manque}</p>`;
      return;
    }
    const d = dureeQuart(j);
    const jourCalcule = semaine(debutSemaine(date)).jours.find((x) => x.date === date);
    const tranches = enregistre && jourCalcule?.tranches.length
      ? jourCalcule.tranches.map((t) => `<span class="etiquette m${String(t.mult).replace('.', '-')}">${esc(nomMultiplicateur(t.mult))} : ${esc(formatDuree(t.minutes))}</span>`).join('')
      : '';
    const infos = [];
    if (d.passeMinuit) infos.push('Le quart se termine le lendemain.');
    if (d.ajustementHeure) infos.push(`Changement d'heure cette nuit-là : ${d.ajustementHeure > 0 ? '+' : '−'}${Math.abs(d.ajustementHeure) / 60} h.`);
    if (d.travaillees > 16 * 60) infos.push('Plus de 16 h : vérifie le début et la fin.');
    resume.innerHTML = `
      <div class="grand">${esc(formatDuree(d.travaillees))}</div>
      <p class="sous">${esc(resumeQuart(j))}${j.pauseMin ? ` · pause ${j.pauseMin} min` : ''}</p>
      ${tranches ? `<div class="etiquettes">${tranches}</div>` : ''}
      ${infos.map((t) => `<p class="note-info">${esc(t)}</p>`).join('')}`;
  }

  let file = Promise.resolve();
  function enregistrer({ message = false } = {}) {
    const j = lire();
    file = file.then(async () => {
      if (estVide(j)) {
        if (etat.jours.has(date)) await supprimerJour(date);
      } else {
        await enregistrerJour(j);
      }
      afficher();
      if (message) toast(typeof message === 'string' ? message : 'Enregistré');
    }).catch((e) => toast(`Échec de l'enregistrement : ${e.message}`, 'erreur'));
    return file;
  }

  function appliquer({ debut, fin, pauseMin, chantierId: id }) {
    champs.debut.value = debut;
    champs.fin.value = fin;
    champs.pause.value = pauseMin ?? 0;
    if (id && chantier(id)) chantierId = id;
    enregistrer({ message: true });
  }

  async function nouveauChantier() {
    const r = await formulaire({
      titre: 'Nouveau chantier',
      champs: [
        { nom: 'nom', label: 'Nom du chantier', requis: true, placeholder: 'École, immeuble, client…' },
        { nom: 'adresse', label: 'Rue ou adresse', placeholder: 'Facultatif' },
        { nom: 'ville', label: 'Ville', placeholder: 'Facultatif' },
      ],
    });
    if (r?.action !== 'ok') return;
    const id = nouvelId();
    await majReglages((reg) => { reg.chantiers.push({ id, ...r.valeurs }); });
    chantierId = id;
    enregistrer({ message: true });
  }

  async function autresChantiers() {
    const id = await choisir({
      titre: 'Choisir un chantier',
      options: chantiersParUsage().map((c) => ({ valeur: c.id, label: c.nom, detail: [c.adresse, c.ville].filter(Boolean).join(', ') })),
    });
    if (!id) return;
    chantierId = id;
    enregistrer();
  }

  // Bascule vers un réglage déjà utilisé (autre employeur, autre convention, autre échelon).
  // Crée un profil daté du jour affiché : les journées d'avant gardent leur réglage.
  async function changerProfil() {
    const profils = [...etat.reglages.profils].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
    const vus = new Set([signature(profil)]);
    const autres = [];
    for (const p of profils) {
      if (vus.has(signature(p))) continue;
      vus.add(signature(p));
      autres.push(p);
    }
    const premier = profils.at(-1).dateEffet;
    const suivant = profils.filter((p) => p.dateEffet > date).at(-1)?.dateEffet ?? null;
    const portee = date < premier
      ? `Ce réglage deviendra le premier de ton historique : il vaudra aussi pour les journées d'avant le ${formatDate(date, { jour: false, annee: true })}.`
      : `Le choix vaut à partir du ${formatDate(date, { annee: true })}${suivant ? `, jusqu'au réglage suivant (${formatDate(suivant, { jour: false, annee: true })})` : ''}. Les journées d'avant ne changent pas.`;
    const choix = await choisir({
      titre: 'Changer de réglage',
      texte: `${autres.length ? '' : 'Aucun autre réglage dans ton historique pour l\'instant. '}${portee}`,
      options: [
        ...autres.map((p) => ({ valeur: p.id, label: resumeProfil(p), detail: texteTaux(p, date) })),
        { valeur: '__reglages', label: 'Autre réglage…', detail: 'Nouvel employeur, convention, échelon ou taux' },
      ],
    });
    if (!choix) return;
    if (choix === '__reglages') return naviguer('reglages', 'emploi');
    const modele = profils.find((p) => p.id === choix);
    if (!modele) return;
    await file;
    await majReglages((reg) => {
      const memeDate = reg.profils.find((p) => p.dateEffet === date);
      const copie = { ...modele, id: memeDate?.id ?? nouvelId(), dateEffet: date };
      reg.profils = [...reg.profils.filter((p) => p.dateEffet !== date), copie];
    });
    toast('Réglage changé à partir de ce jour');
    naviguer('jour', date);
  }

  racine.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'prec') return naviguer('jour', ajouterJours(date, -1));
    if (b.dataset.act === 'suiv') return naviguer('jour', ajouterJours(date, 1));
    if (b.dataset.act === 'auj') return naviguer('jour', auj);
    if (b.dataset.act === 'date') {
      const input = $('#choix-date');
      if (input.showPicker) input.showPicker(); else input.focus();
      return;
    }
    if (b.dataset.act === 'profil') return changerProfil();
    if (b.dataset.act === 'hier' && precedent) return appliquer(precedent);
    if (b.dataset.modele) {
      const m = modeles.find((x) => x.id === b.dataset.modele);
      if (m) appliquer({ ...m, chantierId });
      return;
    }
    if (b.dataset.pas) {
      const champ = champs[b.dataset.pas];
      const autre = b.dataset.pas === 'debut' ? null : hhmmEnMinutes(champs.debut.value);
      const base = hhmmEnMinutes(champ.value) ?? (autre !== null ? autre + 480 - Number(b.dataset.delta) : 420 - Number(b.dataset.delta));
      champ.value = minutesEnHhmm(base + Number(b.dataset.delta));
      return enregistrer();
    }
    if (b.dataset.pause !== undefined) {
      champs.pause.value = b.dataset.pause;
      return enregistrer();
    }
    if (b.dataset.chantier) {
      // Un appui sur le chantier déjà choisi le retire.
      chantierId = b.dataset.chantier === chantierId ? null : b.dataset.chantier;
      return enregistrer();
    }
    if (b.dataset.act === 'chantiers-autres') return autresChantiers();
    if (b.dataset.act === 'chantier-nouveau') return nouveauChantier();
    if (b.dataset.act === 'effacer-heures') {
      const ok = await confirmer({ titre: 'Effacer les heures ?', texte: `Le début, la fin et la pause du ${formatDate(date)} seront vidés. Le chantier et la note restent.`, oui: 'Effacer les heures', danger: true });
      if (!ok) return;
      champs.debut.value = '';
      champs.fin.value = '';
      champs.pause.value = PAUSE_DEFAUT;
      return enregistrer({ message: 'Heures effacées' });
    }
    if (b.dataset.act === 'effacer') {
      const ok = await confirmer({ titre: 'Effacer cette journée ?', texte: `Les heures, le chantier et la note du ${formatDate(date)} seront supprimés.`, oui: 'Effacer la journée', danger: true });
      if (!ok) return;
      await file;
      await supprimerJour(date);
      toast('Journée effacée');
      naviguer('jour', date);
    }
  };

  racine.onchange = (ev) => {
    if (ev.target.id === 'choix-date') {
      if (ev.target.value) naviguer('jour', ev.target.value);
      return;
    }
    if (['debut', 'fin', 'pause', 'ferie', 'note'].includes(ev.target.id)) enregistrer();
  };

  afficher();
}
