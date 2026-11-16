// Écran « Jour » : saisie rapide d'une journée. Tout s'enregistre tout seul à chaque changement.

import { etat, enregistrerJour, supprimerJour, dernierJourAvant, majReglages, nouvelId, chantier, debutSemaine, semaine, aujourdhui } from '../etat.js';
import { ajouterJours, dureeQuart, formatDate, formatDuree, hhmmEnMinutes, minutesEnHhmm, nomJour } from '../temps.js';
import { nomMultiplicateur } from '../calcul.js';
import { esc, toast, formulaire, confirmer, lienCarte } from '../ui.js';

const PAUSES = [0, 15, 30, 45, 60];

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

export function rendreJour(racine, date, naviguer) {
  const auj = aujourdhui();
  const existant = etat.jours.get(date);
  const precedent = dernierJourAvant(date);
  // Fiche de travail : celle du jour, ou une fiche vide avec le chantier de la veille déjà choisi.
  const fiche = existant ? { ...existant } : { date, debut: '', fin: '', pauseMin: 30, chantierId: null, note: '' };
  const chantierPropose = !existant ? (dernierJourAvant(date, { avecHeures: false })?.chantierId ?? null) : null;
  const dansListeFeries = etat.reglages.feries.includes(date);

  const hier = ajouterJours(date, -1);
  const libelleHier = precedent ? (precedent.date === hier ? 'Comme hier' : `Comme ${nomJour(precedent.date)}`) : null;

  const modeles = etat.reglages.modeles;
  const chantiersActifs = etat.reglages.chantiers.filter((c) => c.actif !== false || c.id === fiche.chantierId);

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

    <section class="carte resume" id="resume" aria-live="polite"></section>

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
      <label class="champ">
        <span>Chantier</span>
        <select id="chantier">
          <option value="">Aucun</option>
          ${chantiersActifs.map((c) => `<option value="${esc(c.id)}" ${(fiche.chantierId ?? chantierPropose) === c.id ? 'selected' : ''}>${esc(c.nom)}${c.ville ? ` (${esc(c.ville)})` : ''}</option>`).join('')}
          <option value="__nouveau">＋ Nouveau chantier…</option>
        </select>
      </label>
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

    <button class="btn btn-danger btn-large" data-act="effacer" id="effacer">Effacer cette journée</button>
  `;

  const $ = (sel) => racine.querySelector(sel);
  const champs = { debut: $('#debut'), fin: $('#fin'), pause: $('#pause'), chantier: $('#chantier'), ferie: $('#ferie'), note: $('#note') };
  champs.ferie.checked = typeof fiche.ferie === 'boolean' ? fiche.ferie : dansListeFeries;

  function lire() {
    const pause = Math.max(0, Math.round(Number(String(champs.pause.value).replace(',', '.')) || 0));
    const j = {
      date,
      debut: champs.debut.value || '',
      fin: champs.fin.value || '',
      pauseMin: pause,
      chantierId: champs.chantier.value && champs.chantier.value !== '__nouveau' ? champs.chantier.value : null,
      note: champs.note.value.trim(),
    };
    // On ne retient le choix « férié » que s'il diffère de la liste des fériés.
    if (champs.ferie.checked !== dansListeFeries) j.ferie = champs.ferie.checked;
    return j;
  }

  function afficher() {
    const j = lire();
    const aDesHeures = Boolean(j.debut && j.fin);
    for (const b of racine.querySelectorAll('[data-pause]')) b.classList.toggle('actif', Number(b.dataset.pause) === j.pauseMin);
    const ch = chantier(j.chantierId);
    const carte = lienCarte(ch);
    $('#info-chantier').innerHTML = ch
      ? `${esc([ch.adresse, ch.ville].filter(Boolean).join(', ') || 'Pas d\'adresse')}${carte ? ` · <a href="${esc(carte)}" target="_blank" rel="noopener">Voir sur la carte</a>` : ''}`
      : (etat.reglages.chantiers.length ? '' : 'Ajoute un chantier pour savoir où tu as travaillé chaque jour.');
    $('#effacer').hidden = !etat.jours.has(date);

    const resume = $('#resume');
    if (!aDesHeures) {
      const manque = j.debut ? 'Il manque l\'heure de fin.' : j.fin ? 'Il manque l\'heure de début.' : 'Aucune heure saisie.';
      resume.innerHTML = `<div class="grand discret">0 h</div><p class="aide">${manque}</p>`;
      return;
    }
    const d = dureeQuart(j);
    const jourCalcule = semaine(debutSemaine(date)).jours.find((x) => x.date === date);
    const tranches = etat.jours.has(date) && jourCalcule?.tranches.length
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
      if (message) toast('Enregistré');
    }).catch((e) => toast(`Échec de l'enregistrement : ${e.message}`, 'erreur'));
    return file;
  }

  function appliquer({ debut, fin, pauseMin, chantierId }) {
    champs.debut.value = debut;
    champs.fin.value = fin;
    champs.pause.value = pauseMin ?? 0;
    if (chantierId && [...champs.chantier.options].some((o) => o.value === chantierId)) champs.chantier.value = chantierId;
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
    if (r?.action !== 'ok') {
      champs.chantier.value = fiche.chantierId ?? '';
      return;
    }
    const id = nouvelId();
    await majReglages((reg) => { reg.chantiers.push({ id, ...r.valeurs, actif: true }); });
    const opt = new Option(`${r.valeurs.nom}${r.valeurs.ville ? ` (${r.valeurs.ville})` : ''}`, id);
    champs.chantier.insertBefore(opt, champs.chantier.querySelector('option[value="__nouveau"]'));
    champs.chantier.value = id;
    enregistrer({ message: true });
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
    if (b.dataset.act === 'hier' && precedent) return appliquer(precedent);
    if (b.dataset.modele) {
      const m = modeles.find((x) => x.id === b.dataset.modele);
      if (m) appliquer({ ...m, chantierId: champs.chantier.value || chantierPropose });
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
    if (b.dataset.act === 'effacer') {
      const ok = await confirmer({ titre: 'Effacer cette journée ?', texte: `Les heures, le chantier et la note du ${formatDate(date)} seront supprimés.`, oui: 'Effacer', danger: true });
      if (!ok) return;
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
    if (ev.target.id === 'chantier' && ev.target.value === '__nouveau') return nouveauChantier();
    if (['debut', 'fin', 'pause', 'chantier', 'ferie', 'note'].includes(ev.target.id)) enregistrer();
  };

  afficher();
}
