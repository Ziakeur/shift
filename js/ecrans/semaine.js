// Écran « Semaine » (onglet Shift, vue Semaine) : totaux par catégorie de temps, brut estimé et détail par jour.

import { etat, semaine, debutSemaine, enregistrerJour, supprimerJour, chantier, dernierJourAvant, aujourdhui } from '../etat.js';
import { ajouterJours, formatDate, formatDuree, jourSemaine, nomJour } from '../temps.js';
import { nomMultiplicateur, MOTIFS_ABSENCE } from '../calcul.js';
import { esc, argent, toast, choisir, confirmer } from '../ui.js';

// Bascule de l'onglet Shift : la saisie du jour, ou la semaine entière.
export function htmlVueShift(vue) {
  const b = (cle, nom) => `<button class="puce puce-petite ${cle === vue ? 'actif' : ''}" data-vue="${cle}" aria-pressed="${cle === vue}">${nom}</button>`;
  return `<div class="segments segments-2 vue-shift" role="group" aria-label="Vue">${b('jour', 'Jour')}${b('semaine', 'Semaine')}</div>`;
}

export function titreSemaine(debut) {
  const fin = ajouterJours(debut, 6);
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  const d = formatDate(debut, { jour: false });
  return `${memeMois ? d.split(' ')[0] : d} au ${formatDate(fin, { jour: false, annee: true })}`;
}

export function enteteSemaine(debut, courante) {
  return `
    <header class="entete">
      <button class="btn-icone" data-act="prec" aria-label="Semaine précédente">‹</button>
      <div class="entete-titre">
        <strong>Semaine du ${esc(titreSemaine(debut))}</strong>
        <small>${debut === courante ? 'Cette semaine' : debut === ajouterJours(courante, -7) ? 'Semaine dernière' : ''}</small>
      </div>
      <button class="btn-icone" data-act="suiv" aria-label="Semaine suivante">›</button>
    </header>
    ${debut !== courante ? '<button class="lien retour-auj" data-act="courante">Revenir à cette semaine</button>' : ''}`;
}

export function classeMult(mult) {
  return `m${String(mult).replace('.', '-')}`;
}

export function rendreSemaine(racine, debut, naviguer) {
  const auj = aujourdhui();
  const courante = debutSemaine(auj);
  const s = semaine(debut);
  const cartes = [1, 1.5, 2].map((m) => ({ mult: m, minutes: s.totaux.find((t) => t.mult === m)?.minutes ?? 0 }));
  const autres = s.totaux.filter((t) => ![1, 1.5, 2].includes(t.mult));

  const nbJours = s.jours.filter((j) => j.minutes > 0).length;

  racine.innerHTML = `
    ${htmlVueShift('semaine')}
    ${enteteSemaine(debut, courante)}
    <section class="carte resume">
      <div class="grand">${esc(formatDuree(s.minutesTotal))}</div>
      <p class="sous">${nbJours} jour${nbJours > 1 ? 's' : ''} travaillé${nbJours > 1 ? 's' : ''}</p>
    </section>
    <section class="trio">
      ${[...cartes, ...autres].map((c) => `
        <div class="carte mini ${classeMult(c.mult)}">
          <small>${esc(nomMultiplicateur(c.mult))}</small>
          <strong>${esc(formatDuree(c.minutes))}</strong>
        </div>`).join('')}
    </section>
    <button class="rangee" data-act="paie">
      <span class="rangee-corps"><small>Salaire brut estimé de la semaine</small><strong>${s.minutesTotal ? esc(argent(s.brut)) : '—'}</strong>${s.tauxManquant ? '<small class="texte-alerte">Incomplet : des heures n\'ont pas de taux</small>' : '<small>Détail, vacances et talon dans Paie</small>'}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>
    <section class="liste">
      ${s.jours.map((j) => {
        const ch = chantier(j.chantierId);
        const quart = j.saisie?.debut && j.saisie?.fin ? `${j.saisie.debut} à ${j.saisie.fin}` : j.saisie?.absence ? `Pas travaillé : ${MOTIFS_ABSENCE[j.saisie.absence]?.nom ?? j.saisie.absence}` : (j.saisie ? 'Sans heures' : '');
        return `
        <div class="rangee-groupe">
          <button class="rangee ${j.date === auj ? 'auj' : ''} ${j.minutes ? '' : 'vide'}" data-jour="${j.date}">
            <span class="rangee-jour"><strong>${esc(nomJour(j.date, true))}</strong><small>${Number(j.date.slice(8))}</small></span>
            <span class="rangee-corps">
              <span>${esc(quart || '—')}${j.ferie && j.saisie ? ' · férié' : ''}</span>
              <small>${esc([ch?.nom, j.saisie?.note].filter(Boolean).join(' · '))}</small>
              ${j.tranches.some((t) => t.mult !== 1) ? `<span class="etiquettes">${j.tranches.map((t) => `<span class="etiquette ${classeMult(t.mult)}">${esc(nomMultiplicateur(t.mult))} ${esc(formatDuree(t.minutes))}</span>`).join('')}</span>` : ''}
            </span>
            <span class="rangee-total">${j.minutes ? esc(formatDuree(j.minutes)) : ''}</span>
          </button>
          ${j.saisie ? `<button class="btn-suppr" data-effacer="${j.date}" aria-label="Effacer ${esc(formatDate(j.date))}">✕</button>` : ''}
        </div>`;
      }).join('')}
    </section>
    <button class="btn btn-large" data-act="remplir">Remplir les jours vides avec un horaire habituel</button>
    <p class="aide centre">Règles appliquées : ${esc(s.jours.at(-1).regles ? `${s.jours.at(-1).regles.seuilJour} h par jour, ${s.jours.at(-1).regles.seuilSemaine} h par semaine` : 'aucune')}. Modifiable dans Profil, Mon emploi.</p>
  `;

  racine.onchange = null;
  racine.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.vue === 'jour') {
      // Aujourd'hui si on regarde cette semaine ; sinon la première journée notée de la semaine.
      const fin = ajouterJours(debut, 6);
      return naviguer('jour', auj >= debut && auj <= fin ? auj : (s.jours.find((j) => j.saisie)?.date ?? debut));
    }
    if (b.dataset.vue) return;
    if (b.dataset.act === 'paie') return naviguer('paie', debut);
    if (b.dataset.act === 'prec') return naviguer('semaine', ajouterJours(debut, -7));
    if (b.dataset.act === 'suiv') return naviguer('semaine', ajouterJours(debut, 7));
    if (b.dataset.act === 'courante') return naviguer('semaine', courante);
    if (b.dataset.effacer) {
      const d = b.dataset.effacer;
      const ok = await confirmer({ titre: 'Effacer cette journée ?', texte: `Les heures, le chantier et la note du ${formatDate(d)} seront supprimés.`, oui: 'Effacer la journée', danger: true });
      if (!ok) return;
      await supprimerJour(d);
      toast('Journée effacée');
      return naviguer('semaine', debut);
    }
    if (b.dataset.jour) return naviguer('jour', b.dataset.jour);
    if (b.dataset.act === 'remplir') {
      const modeles = etat.reglages.modeles.filter((m) => m.jours?.length);
      if (!modeles.length) return toast('Aucun horaire habituel avec des jours cochés. Crée-en un dans Profil, Mes horaires habituels.', 'erreur');
      const id = await choisir({
        titre: 'Remplir la semaine',
        texte: 'Seuls les jours sans heures ni motif « pas travaillé » sont remplis. Rien n\'est écrasé.',
        options: modeles.map((m) => ({ valeur: m.id, label: m.nom, detail: `${m.debut} à ${m.fin}, ${m.jours.length} jour(s)` })),
      });
      const m = modeles.find((x) => x.id === id);
      if (!m) return;
      const chantierId = dernierJourAvant(ajouterJours(debut, 7), { avecHeures: false })?.chantierId ?? null;
      let n = 0;
      for (const j of s.jours) {
        if (!m.jours.includes(jourSemaine(j.date))) continue;
        if (j.saisie?.debut || j.saisie?.fin || j.saisie?.absence) continue;
        await enregistrerJour({ ...(j.saisie ?? {}), date: j.date, debut: m.debut, fin: m.fin, pauseMin: m.pauseMin ?? 0, chantierId: j.saisie?.chantierId ?? chantierId, note: j.saisie?.note ?? '' });
        n += 1;
      }
      toast(n ? `${n} jour(s) rempli(s)` : 'Aucun jour vide à remplir');
      naviguer('semaine', debut);
    }
  };
}
