// Écran « Relevé » : les heures d'une période, jour par jour, à imprimer ou à enregistrer en PDF depuis Chrome.
// Sert de trace en cas de désaccord sur des heures. Le calcul est dans `releve` (js/recap.js).

import { etat, semaine, debutSemaine, aujourdhui } from '../etat.js';
import { APP } from '../config.js';
import { ajouterJours, formatDate, formatDuree } from '../temps.js';
import { MOTIFS_ABSENCE, profilPourDate } from '../calcul.js';
import { SECTEURS, ECHELONS } from '../grilles.js';
import { releve } from '../recap.js';
import { esc, argent, toast } from '../ui.js';

// Ce qui est choisi reste affiché quand on revient sur l'écran.
let du = null;
let au = null;
let montants = true;

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const dateLongue = (d) => formatDate(d, { annee: true });
const heure = (hhmm) => `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3, 5)}`;

function plages(auj) {
  const debutMois = `${auj.slice(0, 7)}-01`;
  const finMoisPrec = ajouterJours(debutMois, -1);
  const premier = [...etat.jours.keys()].sort()[0] ?? auj;
  return {
    mois: { nom: 'Ce mois-ci', du: debutMois, au: auj },
    'mois-prec': { nom: 'Mois dernier', du: `${finMoisPrec.slice(0, 7)}-01`, au: finMoisPrec },
    annee: { nom: 'Cette année', du: `${auj.slice(0, 4)}-01-01`, au: auj },
    tout: { nom: 'Tout', du: premier < auj ? premier : auj, au: auj },
  };
}

// Réglages en vigueur sur la période : celui du premier jour, puis chaque changement daté dans la période.
function profilsDeLaPeriode() {
  const premier = profilPourDate(etat.reglages.profils, du);
  const suivants = etat.reglages.profils.filter((p) => p.dateEffet > du && p.dateEffet <= au).sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  return [premier, ...suivants].filter(Boolean).map((p, i) => ({
    depuis: i === 0 ? null : p.dateEffet,
    texte: [p.employeur, `${SECTEURS[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`, ECHELONS[p.echelon] ?? p.echelon].filter(Boolean).join(' · '),
  }));
}

function repartition(l) {
  return [[l.simples, 'temps simple'], [l.demi, 'temps et demi'], [l.double, 'temps double'], [l.autres, 'autre majoration']]
    .filter(([m]) => m > 0).map(([m, nom]) => `${nom} ${formatDuree(m)}`).join(', ');
}

function htmlJour(j) {
  const quart = j.debut && j.fin ? `${heure(j.debut)} à ${heure(j.fin)}${j.pauseMin ? `, pause ${j.pauseMin} min` : ''}` : '';
  const statut = j.absence ? `Pas travaillé : ${MOTIFS_ABSENCE[j.absence]?.nom ?? j.absence}` : quart || 'Sans heures';
  const majore = j.demi || j.double || j.autres ? repartition(j) : '';
  const details = [
    j.ferie ? 'Férié' : '',
    majore,
    j.chantier ? `${j.chantier.nom}${j.chantier.lieu ? ` (${j.chantier.lieu})` : ''}` : '',
    j.primes.length ? `Primes : ${j.primes.join(', ')}` : '',
    j.note,
  ].filter(Boolean);
  return `
    <div class="rl-jour">
      <div class="rl-tete">
        <strong>${esc(formatDate(j.date))}</strong>
        <span>${esc(statut)}</span>
        <b>${j.minutes ? esc(formatDuree(j.minutes)) : ''}</b>
      </div>
      ${details.length ? `<div class="rl-detail">${details.map(esc).join(' · ')}</div>` : ''}
    </div>`;
}

function htmlSemaine(s) {
  // Le talon couvre toute la semaine, même si la période n'en prend qu'une partie.
  const partielle = s.debut < du;
  const valeurs = montants && s.talon
    ? [s.talon.brutReel !== null ? `brut ${argent(s.talon.brutReel)}` : '', s.talon.netReel !== null ? `net reçu ${argent(s.talon.netReel)}` : ''].filter(Boolean).join(', ')
    : '';
  const talon = valeurs ? `${partielle ? 'talon de la semaine entière' : 'talon'} : ${valeurs}` : '';
  return `
    <section class="rl-sem">
      <h2>Semaine du ${esc(formatDate(s.debut, { jour: false }))} au ${esc(formatDate(s.fin, { jour: false, annee: true }))}</h2>
      ${s.jours.map(htmlJour).join('') || '<p class="aide">Aucune journée notée dans la période.</p>'}
      <p class="rl-total">Total : <b>${esc(formatDuree(s.minutes))}</b>${montants ? ` · brut estimé ${esc(argent(s.brut))}` : ''}${talon ? ` · ${esc(talon)}` : ''}</p>
    </section>`;
}

function htmlReleve(r, auj) {
  const t = r.total;
  const absences = Object.entries(t.absences).map(([m, n]) => `${MOTIFS_ABSENCE[m]?.nom ?? m} : ${n}`).join(', ');
  const lignes = [
    ['Heures travaillées', `${formatDuree(t.minutes)}${repartition(t) ? ` (${repartition(t)})` : ''}`],
    ['Jours travaillés', String(t.joursTravailles)],
    ...(absences ? [['Jours sans travail', absences]] : []),
    ...(montants ? [['Brut estimé', `${argent(t.brut)}${t.incomplet ? ' (incomplet : des heures n\'ont pas de taux)' : ''}`]] : []),
    ...(montants && t.brutReelNb ? [['Brut des talons', `${argent(t.brutReel)} (${pluriel(t.brutReelNb, 'semaine')})`]] : []),
    ...(montants && t.netNb ? [['Net reçu', `${argent(t.net)} (${pluriel(t.netNb, 'semaine')})`]] : []),
  ];
  return `
    <article class="rl">
      <h1>Relevé d'heures</h1>
      <p class="rl-periode">Du ${esc(dateLongue(r.du))} au ${esc(dateLongue(r.au))}</p>
      ${profilsDeLaPeriode().map((p) => `<p class="rl-profil">${p.depuis ? `À partir du ${esc(dateLongue(p.depuis))} : ` : ''}${esc(p.texte)}</p>`).join('')}
      <table class="tableau rl-resume"><tbody>
        ${lignes.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="montant">${esc(b)}</td></tr>`).join('')}
      </tbody></table>
      ${r.semaines.map(htmlSemaine).join('') || '<p class="aide">Aucune journée notée sur cette période.</p>'}
      <p class="rl-pied">Relevé établi le ${esc(dateLongue(auj))} avec ${esc(APP.nom)}, à partir de mes propres notes. Heures notées au jour le jour${montants ? ' ; montants estimés par l\'application, avant déductions' : ''}. ${esc(APP.mention)}</p>
    </article>`;
}

export function rendreReleve(racine, _param, naviguer) {
  const auj = aujourdhui();
  const choix = plages(auj);
  if (!du || !au) ({ du, au } = choix['mois-prec']);

  function dessiner() {
    const debuts = [];
    for (let d = debutSemaine(du); d <= au; d = ajouterJours(d, 7)) debuts.push(d);
    const r = releve(debuts.map((d) => semaine(d)), { du, au, talons: etat.semaines, chantiers: etat.reglages.chantiers, primes: etat.reglages.primes });
    racine.querySelector('#releve').innerHTML = htmlReleve(r, auj);
    for (const b of racine.querySelectorAll('[data-plage]')) {
      const actif = choix[b.dataset.plage].du === du && choix[b.dataset.plage].au === au;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', String(actif));
    }
  }

  racine.innerHTML = `
    <header class="entete rl-ecran">
      <button class="btn-icone" data-act="retour" aria-label="Retour à la sauvegarde">‹</button>
      <div class="entete-titre"><strong>Relevé d'heures</strong><small>à imprimer ou à garder en PDF</small></div>
    </header>
    <section class="carte rl-ecran">
      <div class="puces" role="group" aria-label="Période">
        ${Object.entries(choix).map(([cle, p]) => `<button class="puce" data-plage="${cle}">${esc(p.nom)}</button>`).join('')}
      </div>
      <div class="duo">
        <label class="champ"><span>Du</span><input type="date" id="rl-du" value="${du}"></label>
        <label class="champ"><span>Au</span><input type="date" id="rl-au" value="${au}"></label>
      </div>
      <label class="case"><input type="checkbox" id="rl-montants" ${montants ? 'checked' : ''}><span>Inclure les montants (brut estimé, talons)</span></label>
      <button class="btn btn-large btn-principal" data-act="imprimer">Imprimer ou enregistrer en PDF</button>
      <p class="aide">Dans la fenêtre qui s'ouvre, choisis « Enregistrer au format PDF » pour garder le fichier ou l'envoyer.</p>
    </section>
    <div id="releve"></div>
  `;

  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'retour') return naviguer('reglages', 'sauvegarde');
    if (b.dataset.act === 'imprimer') return window.print();
    if (b.dataset.plage) {
      ({ du, au } = choix[b.dataset.plage]);
      racine.querySelector('#rl-du').value = du;
      racine.querySelector('#rl-au').value = au;
      return dessiner();
    }
    return undefined;
  };

  racine.onchange = (ev) => {
    const t = ev.target;
    if (t.id === 'rl-montants') { montants = t.checked; return dessiner(); }
    if (t.id === 'rl-du' || t.id === 'rl-au') {
      const nDu = racine.querySelector('#rl-du').value;
      const nAu = racine.querySelector('#rl-au').value;
      if (!nDu || !nAu) return undefined;
      if (nAu < nDu) return toast('La date de fin est avant la date de début.', 'erreur');
      du = nDu;
      au = nAu;
      return dessiner();
    }
    return undefined;
  };

  dessiner();
}
