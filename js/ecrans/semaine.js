// Écran « Semaine » : totaux par catégorie de temps et détail par jour.

import { etat, semaine, debutSemaine, enregistrerJour, chantier, dernierJourAvant, aujourdhui } from '../etat.js';
import { ajouterJours, formatDate, formatDuree, jourSemaine, nomJour } from '../temps.js';
import { nomMultiplicateur } from '../calcul.js';
import { esc, toast, choisir } from '../ui.js';

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

  racine.innerHTML = `
    ${enteteSemaine(debut, courante)}
    <section class="carte resume">
      <div class="grand">${esc(formatDuree(s.minutesTotal))}</div>
      <p class="sous">${s.jours.filter((j) => j.minutes > 0).length} jour(s) travaillé(s)</p>
    </section>
    <section class="trio">
      ${[...cartes, ...autres].map((c) => `
        <div class="carte mini ${classeMult(c.mult)}">
          <small>${esc(nomMultiplicateur(c.mult))}</small>
          <strong>${esc(formatDuree(c.minutes))}</strong>
        </div>`).join('')}
    </section>
    <section class="liste">
      ${s.jours.map((j) => {
        const ch = chantier(j.chantierId);
        const quart = j.saisie?.debut && j.saisie?.fin ? `${j.saisie.debut} à ${j.saisie.fin}` : (j.saisie ? 'Sans heures' : '');
        return `
        <button class="rangee ${j.date === auj ? 'auj' : ''} ${j.minutes ? '' : 'vide'}" data-jour="${j.date}">
          <span class="rangee-jour"><strong>${esc(nomJour(j.date, true))}</strong><small>${Number(j.date.slice(8))}</small></span>
          <span class="rangee-corps">
            <span>${esc(quart || '—')}${j.ferie && j.saisie ? ' · férié' : ''}</span>
            <small>${esc([ch?.nom, j.saisie?.note].filter(Boolean).join(' · '))}</small>
            ${j.tranches.some((t) => t.mult !== 1) ? `<span class="etiquettes">${j.tranches.map((t) => `<span class="etiquette ${classeMult(t.mult)}">${esc(nomMultiplicateur(t.mult))} ${esc(formatDuree(t.minutes))}</span>`).join('')}</span>` : ''}
          </span>
          <span class="rangee-total">${j.minutes ? esc(formatDuree(j.minutes)) : ''}</span>
        </button>`;
      }).join('')}
    </section>
    <button class="btn btn-large" data-act="remplir">Remplir les jours vides avec un modèle</button>
    <p class="aide centre">Règles appliquées : ${esc(s.jours.at(-1).regles ? `${s.jours.at(-1).regles.seuilJour} h par jour, ${s.jours.at(-1).regles.seuilSemaine} h par semaine` : 'aucune')}. Modifiable dans Réglages, Profil.</p>
  `;

  racine.onchange = null;
  racine.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'prec') return naviguer('semaine', ajouterJours(debut, -7));
    if (b.dataset.act === 'suiv') return naviguer('semaine', ajouterJours(debut, 7));
    if (b.dataset.act === 'courante') return naviguer('semaine', courante);
    if (b.dataset.jour) return naviguer('jour', b.dataset.jour);
    if (b.dataset.act === 'remplir') {
      const modeles = etat.reglages.modeles.filter((m) => m.jours?.length);
      if (!modeles.length) return toast('Aucun modèle avec des jours cochés. Crée-en un dans les réglages.', 'erreur');
      const id = await choisir({
        titre: 'Remplir la semaine',
        texte: 'Seuls les jours sans heures sont remplis. Rien n\'est écrasé.',
        options: modeles.map((m) => ({ valeur: m.id, label: m.nom, detail: `${m.debut} à ${m.fin}, ${m.jours.length} jour(s)` })),
      });
      const m = modeles.find((x) => x.id === id);
      if (!m) return;
      const chantierId = dernierJourAvant(ajouterJours(debut, 7), { avecHeures: false })?.chantierId ?? null;
      let n = 0;
      for (const j of s.jours) {
        if (!m.jours.includes(jourSemaine(j.date))) continue;
        if (j.saisie?.debut || j.saisie?.fin) continue;
        await enregistrerJour({ ...(j.saisie ?? {}), date: j.date, debut: m.debut, fin: m.fin, pauseMin: m.pauseMin ?? 0, chantierId: j.saisie?.chantierId ?? chantierId, note: j.saisie?.note ?? '' });
        n += 1;
      }
      toast(n ? `${n} jour(s) rempli(s)` : 'Aucun jour vide à remplir');
      naviguer('semaine', debut);
    }
  };
}
