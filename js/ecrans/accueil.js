// Écran « Accueil » : où j'en suis, courbes des gains et des heures au fil du temps, détail en dessous.
// Les calculs sont dans js/recap.js, le dessin des courbes dans js/graphique.js.
// Le net affiché est la somme des nets saisis depuis les talons : il n'est jamais estimé.

import { etat, semaine, debutSemaine, aujourdhui, enregistrerJour, majReglages } from '../etat.js';
import { APP } from '../config.js';
import { formatDate, formatDuree, nomMois, nomJour, jourSemaine, heureLocale } from '../temps.js';
import { salutation } from '../depart.js';
import { SECTEURS, ECHELONS } from '../grilles.js';
import { recapituler, joursVentiles, jalons, ligneDuTemps, suiteContinue, totaliser, cumuler, joursOublies } from '../recap.js';
import { MOTIFS_ABSENCE } from '../calcul.js';
import { courbes, indiceDepuisX } from '../graphique.js';
import { dessinFerme } from '../decor.js';
import { esc, argent, nombre, choisir, toast } from '../ui.js';

const MODES = { semaines: 'Semaines', mois: 'Mois', cumul: 'Cumul' };
const PLAGES = { '3m': { nom: '3 mois', semaines: 13, mois: 3 }, '1a': { nom: '1 an', semaines: 52, mois: 12 }, tout: { nom: 'Tout', semaines: Infinity, mois: Infinity } };
const VUES = {
  semaines: { nom: 'Semaine', limite: 8 },
  mois: { nom: 'Mois', limite: 12 },
  annees: { nom: 'Année', limite: Infinity },
};
const SEGMENTS = [['s1', 'simples', 'Temps simple'], ['s15', 'demi', 'Temps et demi'], ['s2', 'double', 'Temps double'], ['sx', 'autres', 'Autre majoration']];

// Ce qu'on regardait reste affiché quand on revient sur l'écran.
let mode = 'semaines';
let plage = '1a';
let selection = null;
let vue = 'semaines';
let tout = false;
const ouverts = new Set();
let observateur = null;

const argentRond = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const signe = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${argent(Math.abs(n))}`;
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Toutes les semaines qui ont des heures ou un talon saisi, calculées, de la plus ancienne à la plus récente.
function semainesDeLHistorique() {
  const debuts = new Set([...etat.jours.keys()].map((d) => debutSemaine(d)));
  for (const [d, t] of etat.semaines) {
    if ((typeof t.netReel === 'number' || typeof t.brutReel === 'number') && debutSemaine(d) === d) debuts.add(d);
  }
  return [...debuts].sort().map((d) => semaine(d));
}

function heureLisible(hhmm) {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h ${m}`;
}

function titreSemaineCourt(debut, fin) {
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  return `${Number(debut.slice(8))}${memeMois ? '' : ` ${nomMois(debut, true)}`} au ${Number(fin.slice(8))} ${nomMois(fin, true)} ${fin.slice(0, 4)}`;
}

function titrePeriode(l, type) {
  if (type === 'semaines') return titreSemaineCourt(l.debut, l.fin);
  if (type === 'mois') return `${nomMois(l.cle)} ${l.cle.slice(0, 4)}`;
  return l.cle;
}

// « du 5 juill. au 21 nov. 2026 », « de juillet à novembre 2026 » : l'année du début n'est écrite que si elle diffère.
function titreDeLaPlage(lignes, type) {
  const a = lignes[0];
  const b = lignes.at(-1);
  if (type === 'mois') {
    if (a.cle === b.cle) return `de ${nomMois(a.cle)} ${a.cle.slice(0, 4)}`;
    return `de ${nomMois(a.cle)}${a.cle.slice(0, 4) === b.cle.slice(0, 4) ? '' : ` ${a.cle.slice(0, 4)}`} à ${nomMois(b.cle)} ${b.cle.slice(0, 4)}`;
  }
  const annee = a.debut.slice(0, 4) === b.fin.slice(0, 4) ? '' : ` ${a.debut.slice(0, 4)}`;
  return `du ${Number(a.debut.slice(8))} ${nomMois(a.debut, true)}${annee} au ${Number(b.fin.slice(8))} ${nomMois(b.fin, true)} ${b.fin.slice(0, 4)}`;
}

// Barre empilée : simple, temps et demi, temps double. `echelle` = minutes qui remplissent toute la largeur.
function barre(l, echelle) {
  const segments = SEGMENTS.filter(([, champ]) => l[champ] > 0);
  if (!segments.length) return '<span class="barre-h" aria-hidden="true"></span>';
  const largeur = Math.min(100, (l.minutes / echelle) * 100);
  return `<span class="barre-h" aria-hidden="true"><span class="barre-h-plein" style="width:${largeur.toFixed(1)}%">${segments.map(([classe, champ]) => `<i class="${classe}" style="flex:${l[champ]}"></i>`).join('')}</span></span>`;
}

function repartition(l) {
  const noms = { simples: 'simple', demi: 'temps et demi', double: 'temps double', autres: 'autre majoration' };
  const texte = SEGMENTS.filter(([, champ]) => l[champ] > 0).map(([, champ]) => `${noms[champ]} ${formatDuree(l[champ])}`).join(' · ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function majorees(l) {
  const parts = [];
  if (l.demi) parts.push(`${formatDuree(l.demi)} à temps et demi`);
  if (l.double) parts.push(`${formatDuree(l.double)} à temps double`);
  if (l.autres) parts.push(`${formatDuree(l.autres)} à une autre majoration`);
  return parts.length ? `dont ${parts.join(', ')}` : '';
}

function lignesArgent(l, estSemaine) {
  let net;
  if (l.netNb) {
    const detail = estSemaine ? '' : `<small>saisi pour ${pluriel(l.netNb, 'semaine')} sur ${l.semaines}</small>`;
    net = `<span class="recap-argent"><span>Net reçu${detail}</span><b>${esc(argent(l.net))}</b></span>`;
  } else {
    const detail = estSemaine ? '' : `<small>${l.semaines ? `aucun net saisi pour ${pluriel(l.semaines, 'semaine')}` : 'aucune semaine de paie ne se termine ici'}</small>`;
    net = `<span class="recap-argent"><span>Net reçu${detail}</span><b class="discret">${estSemaine ? 'à saisir' : '—'}</b></span>`;
  }
  const talons = l.brutReelNb
    ? `<span class="recap-argent"><span>Brut des talons<small>${estSemaine ? '' : `${pluriel(l.brutReelNb, 'semaine')}, `}écart ${esc(signe(l.ecart))} avec l'estimation</small></span><b>${esc(argent(l.brutReel))}</b></span>`
    : '';
  return `
    <span class="recap-argent"><span>Brut estimé${l.incomplet ? '<small>incomplet : des heures n\'ont pas de taux</small>' : ''}</span><b>${esc(argent(l.brut))}</b></span>
    ${net}
    ${talons}`;
}

function corpsLigne(l, type, echelle) {
  return `
    <span class="recap-tete"><strong>${esc(titrePeriode(l, type))}</strong><strong class="recap-h">${esc(formatDuree(l.minutes))}</strong></span>
    ${barre(l, echelle)}
    ${l.minutes ? `<small>${esc(repartition(l))}</small>` : ''}
    ${lignesArgent(l, type === 'semaines')}`;
}

function htmlRecap(recap) {
  const lignes = recap[vue];
  const limite = tout ? Infinity : VUES[vue].limite;
  const visibles = lignes.slice(0, limite);
  const echelle = Math.max(1, ...lignes.map((l) => l.minutes));
  const balise = vue === 'semaines' ? 'button' : 'div';
  return `
    <div class="segments" role="group" aria-label="Période du détail">
      ${Object.entries(VUES).map(([cle, v]) => `<button class="puce ${cle === vue ? 'actif' : ''}" data-vue="${cle}" aria-pressed="${cle === vue}">${v.nom}</button>`).join('')}
    </div>
    <div class="recap">
      ${visibles.map((l) => `<${balise} class="recap-ligne" ${vue === 'semaines' ? `data-paie="${l.debut}"` : ''}>${corpsLigne(l, vue, echelle)}</${balise}>`).join('')}
    </div>
    ${lignes.length > visibles.length ? `<button class="btn btn-large" data-act="tout">Afficher tout (${lignes.length})</button>` : ''}
    <p class="aide">Brut estimé par l'application, avant déductions et sans l'indemnité de vacances. Le net n'est jamais estimé : c'est la somme de ce que tu as saisi depuis tes talons${vue === 'semaines' ? ' (touche une semaine pour le saisir)' : ''}.</p>
    ${vue !== 'semaines' ? `<p class="aide">Une semaine à cheval sur deux ${vue === 'mois' ? 'mois' : 'années'} est partagée jour par jour pour les heures et le brut estimé ; les primes suivent les heures. Le talon, lui, ne se découpe pas : il compte là où la semaine se termine.</p>` : ''}`;
}

function htmlRuban(items, auj) {
  const echelle = Math.max(50 * 60, ...items.filter((i) => i.type === 'semaine').map((i) => i.minutes));
  const lignes = [`<li class="r-bout"><span class="r-regle"></span><span class="r-corps"><small>Aujourd'hui, ${esc(formatDate(auj))}</small></span></li>`];
  let anneeAvant = null;
  for (const it of items) {
    const annee = it.debut.slice(0, 4);
    if (anneeAvant && annee !== anneeAvant) {
      lignes.push(`<li class="r-an"><span class="r-regle"><b>${anneeAvant}</b></span><span class="r-corps"><small>Début de ${anneeAvant}</small></span></li>`);
    }
    anneeAvant = annee;
    if (it.type === 'vide') {
      lignes.push(`<li class="r-vide"><span class="r-regle"></span><span class="r-corps"><small>${pluriel(it.nb, 'semaine')} sans heures</small></span></li>`);
      continue;
    }
    const detail = majorees(it);
    lignes.push(`
      <li class="r-sem"><button class="r-bouton" data-sem="${it.debut}" aria-label="Semaine du ${esc(titreSemaineCourt(it.debut, it.fin))} : ${esc(formatDuree(it.minutes))}. Ouvrir la semaine.">
        <span class="r-regle"><b>${Number(it.debut.slice(8))}</b><small>${esc(nomMois(it.debut, true))}</small></span>
        <span class="r-corps">
          <span class="r-tete">${barre(it, echelle)}<strong>${it.minutes ? esc(formatDuree(it.minutes)) : ''}</strong></span>
          ${detail ? `<small>${esc(detail)}</small>` : ''}
          ${[...it.jalons].reverse().map((j) => `<span class="r-jalon"><span>${esc(j.texte)}</span><small>${esc(formatDate(j.date, { jour: false }))}</small></span>`).join('')}
        </span>
      </button></li>`);
  }
  lignes.push('<li class="r-fin"><span class="r-regle"></span></li>');
  return `<ol class="ruban">${lignes.join('')}</ol>`;
}

// La semaine en cours, un bâton par jour. Un appui ouvre la journée.
function htmlJoursSemaine(sem, auj) {
  const ventiles = new Map(joursVentiles(sem).map((j) => [j.date, j]));
  const echelle = Math.max(10 * 60, ...sem.jours.map((j) => j.minutes));
  return `
    <div class="sem-jours" role="group" aria-label="Cette semaine, jour par jour">
      ${sem.jours.map((j) => {
        const v = ventiles.get(j.date);
        const segments = v ? SEGMENTS.filter(([, champ]) => v[champ] > 0) : [];
        const quand = j.date === auj ? 'auj' : j.date > auj ? 'futur' : '';
        return `
          <button class="sem-jour ${quand}" data-jour="${j.date}" aria-label="${esc(formatDate(j.date))} : ${j.minutes ? esc(formatDuree(j.minutes)) : j.saisie?.absence ? `pas travaillé, ${esc(MOTIFS_ABSENCE[j.saisie.absence]?.nom ?? '')}` : 'rien de saisi'}. Ouvrir la journée.">
            <span class="sem-baton" aria-hidden="true"><span style="height:${((j.minutes / echelle) * 100).toFixed(1)}%">${segments.map(([classe, champ]) => `<i class="${classe}" style="flex:${v[champ]}"></i>`).join('')}</span></span>
            <b>${esc(nomJour(j.date, true))}</b>
            <small>${j.minutes ? esc(formatDuree(j.minutes)) : esc(MOTIFS_ABSENCE[j.saisie?.absence]?.court ?? '·')}</small>
          </button>`;
      }).join('')}
    </div>`;
}

// Jours habituels de travail des deux dernières semaines où rien n'est noté. Un appui ouvre la journée.
function htmlOublies(oublies) {
  if (!oublies.length) return '';
  const vides = oublies.filter((o) => !o.incomplet);
  return `
    <section class="carte oublies">
      <h2>${oublies.length > 1 ? `${oublies.length} jours à compléter` : '1 jour à compléter'}</h2>
      <div class="puces">
        ${oublies.map((o) => `<button class="puce" data-jour="${o.date}" aria-label="${esc(formatDate(o.date))}${o.incomplet ? ', heure de début ou de fin manquante' : ''}">${esc(`${nomJour(o.date, true)} ${Number(o.date.slice(8))} ${nomMois(o.date, true)}`)}${o.incomplet ? ' · incomplet' : ''}</button>`).join('')}
      </div>
      ${vides.length > 1 ? `<button class="btn btn-large" data-act="oublies-motif">Je n'ai pas travaillé ces ${vides.length} jours…</button>` : ''}
      <p class="aide">Jours de travail habituels sans heures ni motif, sur les deux dernières semaines. Les jours se règlent dans Réglages, Préférences.</p>
    </section>`;
}

export function rendreAccueil(racine, _param, naviguer) {
  const auj = aujourdhui();
  const courante = debutSemaine(auj);
  const sCourante = semaine(courante);
  const jAuj = sCourante.jours.find((j) => j.date === auj);
  const quartAuj = jAuj?.saisie?.debut && jAuj?.saisie?.fin ? `${heureLisible(jAuj.saisie.debut)} à ${heureLisible(jAuj.saisie.fin)}` : 'Rien de saisi';

  const semaines = semainesDeLHistorique();
  const recap = recapituler(semaines, etat.semaines);
  const dernierExport = etat.reglages.sauvegarde.dernierExport;
  const listeJalons = jalons(semaines, {
    profils: etat.reglages.profils,
    chantiers: etat.reglages.chantiers,
    secteurs: SECTEURS,
    echelons: ECHELONS,
    auj,
    dernierExport: dernierExport ? aujourdhui(new Date(dernierExport)) : null,
  });
  const items = ligneDuTemps(semaines, listeJalons, { debutCourant: courante });
  const aDesAutres = items.some((i) => i.type === 'semaine' && i.autres > 0);
  const aDeLHistorique = recap.semaines.length > 0;
  const decor = etat.reglages.fond !== 'uni';
  const oublies = joursOublies(etat.jours, { auj, joursTravail: etat.reglages.joursTravail, feries: etat.reglages.feries });

  racine.innerHTML = `
    <header class="entete ${decor ? 'entete-toit' : ''}">
      ${decor ? `<div class="decor toit">${dessinFerme()}</div>` : ''}
      <div class="entete-titre">
        <strong>${esc(etat.reglages.prenom ? salutation(etat.reglages.prenom, { heure: heureLocale(), jour: jourSemaine(auj) }) : APP.nom)}</strong>
        <small>${esc(formatDate(auj, { annee: true }))}</small>
      </div>
    </header>

    <section class="carte">
      <div class="duo">
        <div class="duo-case"><small>Aujourd'hui</small><strong class="${jAuj?.minutes ? '' : 'discret'}">${esc(formatDuree(jAuj?.minutes ?? 0))}</strong><small>${esc(quartAuj)}</small></div>
        <div class="duo-case"><small>Cette semaine</small><strong class="${sCourante.minutesTotal ? '' : 'discret'}">${esc(formatDuree(sCourante.minutesTotal))}</strong><small>${esc(argent(sCourante.brut))} brut estimé</small></div>
      </div>
      ${htmlJoursSemaine(sCourante, auj)}
      <button class="btn btn-principal btn-large" data-act="jour">${jAuj?.minutes ? 'Modifier ma journée' : 'Saisir ma journée'}</button>
    </section>

    ${htmlOublies(oublies)}

    ${etat.reglages.configDepart === 'plus-tard' ? `
    <section class="carte rappel">
      <h2>Configuration de départ</h2>
      <p class="aide">Prénom, convention, échelon, semaine : une minute, et les montants estimés partent du bon taux.</p>
      <div class="duo">
        <button class="btn" data-act="depart-non">Ne plus afficher</button>
        <button class="btn btn-principal" data-act="depart">Configurer</button>
      </div>
    </section>` : ''}

    ${aDeLHistorique ? `
    <section class="carte" id="courbes"></section>

    <details class="carte section" data-section="detail" ${ouverts.has('detail') ? 'open' : ''}>
      <summary><span>Tout le détail</span><small>semaine, mois, année</small></summary>
      <div id="recap">${htmlRecap(recap)}</div>
    </details>

    <details class="carte section" data-section="ruban" ${ouverts.has('ruban') ? 'open' : ''}>
      <summary><span>Ligne du temps</span><small>${pluriel(listeJalons.length, 'jalon')}</small></summary>
      <p class="aide">Ton historique déroulé comme un ruban à mesurer : une graduation par semaine, la plus récente en haut. Touche une semaine pour l'ouvrir.</p>
      <div class="legende">
        ${SEGMENTS.filter(([classe]) => classe !== 'sx' || aDesAutres).map(([classe, , nom]) => `<span><i class="${classe}"></i>${nom}</span>`).join('')}
      </div>
      ${htmlRuban(items, auj)}
    </details>` : `
    <section class="carte">
      <p class="aide">Tes courbes de gains et d'heures apparaîtront ici dès ta première journée saisie.</p>
    </section>`}

    <p class="aide centre">${esc(APP.mention)}</p>
  `;

  for (const d of racine.querySelectorAll('details[data-section]')) {
    d.addEventListener('toggle', () => (d.open ? ouverts.add(d.dataset.section) : ouverts.delete(d.dataset.section)));
  }

  // ----- Courbes -----
  const zone = racine.querySelector('#courbes');
  observateur?.disconnect();
  observateur = null;

  // Les périodes affichées, de la plus ancienne à la plus récente, selon le mode et la plage choisis.
  function periodes() {
    const type = mode === 'mois' ? 'mois' : 'semaines';
    const suite = suiteContinue(recap[type], type, { jusqua: type === 'mois' ? auj.slice(0, 7) : courante });
    return { type, lignes: suite.slice(-PLAGES[plage][type]) };
  }

  function etiquetteAxe(l, type) {
    if (type === 'semaines') return `${Number(l.cle.slice(8))} ${nomMois(l.cle, true)}`;
    return `${nomMois(l.cle, true)}${l.cle.endsWith('-01') ? ` ${l.cle.slice(0, 4)}` : ''}`;
  }

  // Les chiffres de la période sous le doigt. Ce bandeau reste collé en haut de l'écran
  // pendant qu'on glisse sur une courbe ; il sert aussi de légende des couleurs.
  function htmlLu(l, type, cumul) {
    const v = cumul ?? l;
    const titre = cumul
      ? (type === 'mois' ? `Cumul à la fin de ${nomMois(l.cle)} ${l.cle.slice(0, 4)}` : `Cumul au ${formatDate(l.fin, { annee: true, jour: false })}`)
      : (type === 'mois' ? titrePeriode(l, type) : `Semaine du ${titrePeriode(l, type)}`);
    const montant = (n) => (n >= 10000 ? argentRond.format(n) : argent(n));
    return `
      <strong class="lu-titre">${esc(titre)}</strong>
      <span class="lu-valeurs">
        <span class="c-brut"><small><i class="cle"></i>Brut estimé</small><b>${esc(montant(v.brut))}</b></span>
        <span class="c-net"><small><i class="cle"></i>Net reçu</small><b class="${v.netNb ? '' : 'discret'}">${v.netNb ? esc(montant(v.net)) : '—'}</b></span>
        <span class="c-heures"><small><i class="cle"></i>Heures</small><b>${esc(formatDuree(v.minutes))}</b></span>
      </span>`;
  }

  function htmlLecture(l, type, cumul, echelle) {
    const dansPeriode = (j) => (type === 'mois' ? j.date.slice(0, 7) === l.cle : j.date >= l.debut && j.date <= l.fin);
    const js = listeJalons.filter(dansPeriode);
    return `
      <div class="lecture">
        ${corpsLigne(l, type, echelle)}
        ${cumul ? `
          <span class="lecture-titre">Cumul jusque-là, sur la période affichée</span>
          <span class="recap-argent"><span>Heures</span><b>${esc(formatDuree(cumul.minutes))}</b></span>
          <span class="recap-argent"><span>Brut estimé</span><b>${esc(argent(cumul.brut))}</b></span>
          <span class="recap-argent"><span>Net reçu<small>${cumul.netNb ? `saisi pour ${pluriel(cumul.netNb, 'semaine')} sur ${cumul.semaines}` : 'aucun net saisi'}</small></span><b>${cumul.netNb ? esc(argent(cumul.net)) : '—'}</b></span>` : ''}
        ${js.map((j) => `<span class="r-jalon"><span>${esc(j.texte)}</span><small>${esc(formatDate(j.date, { jour: false }))}</small></span>`).join('')}
        ${type === 'semaines' ? `
          <span class="ligne-effacer">
            <button class="btn btn-compact" data-sem="${l.debut}">Voir la semaine</button>
            <button class="btn btn-compact" data-paie="${l.debut}">${l.netNb ? 'Voir le talon' : 'Saisir le talon'}</button>
          </span>` : ''}
      </div>`;
  }

  // Monte le cadre (choix, zones des courbes, totaux), puis dessine. Quand le doigt glisse,
  // seul `dessiner` est rappelé : les zones touchées ne sont pas remplacées, le geste n'est pas coupé.
  function monterCourbes() {
    if (!zone) return;
    const { type, lignes } = periodes();
    const cumuls = mode === 'cumul' ? cumuler(lignes) : null;
    const source = cumuls ?? lignes;
    const n = lignes.length;
    let choisi = Math.max(0, Math.min(n - 1, selection ?? n - 1));
    const total = totaliser(lignes);
    const aDuNet = total.netNb > 0;
    const etiquettes = lignes.map((l) => esc(etiquetteAxe(l, type)));
    const echelle = Math.max(1, ...lignes.map((l) => l.minutes));
    const titrePlage = esc(titreDeLaPlage(lignes, type));
    const unite = type === 'mois' ? 'mois' : 'semaine';

    zone.innerHTML = `
      <h2>Mes gains et mes heures</h2>
      <div class="segments" role="group" aria-label="Type de courbe">
        ${Object.entries(MODES).map(([cle, nom]) => `<button class="puce ${cle === mode ? 'actif' : ''}" data-mode="${cle}" aria-pressed="${cle === mode}">${nom}</button>`).join('')}
      </div>
      <div class="segments" role="group" aria-label="Période affichée">
        ${Object.entries(PLAGES).map(([cle, p]) => `<button class="puce puce-petite ${cle === plage ? 'actif' : ''}" data-plage="${cle}" aria-pressed="${cle === plage}">${p.nom}</button>`).join('')}
      </div>

      <div class="lu" id="lu"></div>

      <div class="graphique-bloc">
        <small>${mode === 'cumul' ? 'Montants cumulés, en dollars' : `Montants par ${unite}, en dollars`}</small>
        <div class="graphique" id="g-argent" tabindex="0" aria-label="Courbe des montants. Flèches gauche et droite pour changer de ${unite}."></div>
      </div>
      <div class="graphique-bloc">
        <small>${mode === 'cumul' ? 'Heures cumulées' : `Heures par ${unite}`}</small>
        <div class="graphique" id="g-heures" tabindex="0" aria-label="Courbe des heures. Flèches gauche et droite pour changer de ${unite}."></div>
      </div>

      <p class="aide">Glisse ton doigt sur une courbe : les chiffres du haut suivent. ${aDuNet ? `Le net n'est tracé que là où tu l'as saisi ; il n'est jamais estimé.${mode === 'mois' && lignes.some((l) => l.netNb && l.netNb < l.semaines) ? ' Un point vide : le net de ce mois n\'est saisi que pour une partie des semaines.' : ''}` : 'Le net apparaîtra quand tu saisiras tes talons dans l\'écran Paie ; il n\'est jamais estimé.'}</p>

      <div class="total-plage">
        <small>Total ${titrePlage}</small>
        <div class="trio">
          <div class="carte mini"><small>Brut estimé</small><strong>${esc(argentRond.format(total.brut))}</strong><small>${total.incomplet ? 'incomplet' : 'avant déductions'}</small></div>
          <div class="carte mini"><small>Net reçu</small><strong class="${aDuNet ? '' : 'discret'}">${aDuNet ? esc(argentRond.format(total.net)) : '—'}</strong><small>${aDuNet ? `${total.netNb} sem. sur ${total.semaines}` : 'à saisir'}</small></div>
          <div class="carte mini"><small>Heures</small><strong>${esc(formatDuree(total.minutes))}</strong><small>${type === 'mois' ? `${n} mois` : pluriel(n, 'semaine')}</small></div>
        </div>
      </div>

      <div id="lecture"></div>`;

    const lu = zone.querySelector('#lu');
    const gArgent = zone.querySelector('#g-argent');
    const gHeures = zone.querySelector('#g-heures');
    const lecture = zone.querySelector('#lecture');
    const largeur = Math.max(240, Math.floor(gArgent.clientWidth));
    const dollarsAxe = (v) => (v >= 10000 ? `${nombre(v / 1000)} k` : nombre(v));
    const seriesArgent = [
      { classe: 'c-brut', points: source.map((l) => l.brut), aire: true },
      ...(aDuNet ? [{ classe: 'c-net', points: source.map((l) => (l.netNb ? l.net : null)), creux: cumuls ? null : lignes.map((l) => l.netNb < l.semaines) }] : []),
    ];
    const seriesHeures = [{ classe: 'c-heures', points: source.map((l) => l.minutes / 60), aire: true }];
    const parQuoi = mode === 'cumul' ? 'cumulés' : `par ${unite}`;

    const dessiner = () => {
      lu.innerHTML = htmlLu(lignes[choisi], type, cumuls?.[choisi] ?? null);
      gArgent.innerHTML = courbes({
        id: 'ga', largeur, etiquettes, selection: choisi, formatY: dollarsAxe, series: seriesArgent,
        description: `Brut estimé${aDuNet ? ' et net reçu' : ''} ${parQuoi}, ${titrePlage}`,
      });
      gHeures.innerHTML = courbes({
        id: 'gh', largeur, hauteur: 160, etiquettes, selection: choisi, formatY: (v) => nombre(v), series: seriesHeures,
        description: `Heures ${mode === 'cumul' ? 'cumulées' : `par ${unite}`}, ${titrePlage}`,
      });
      lecture.innerHTML = htmlLecture(lignes[choisi], type, cumuls?.[choisi] ?? null, echelle);
    };
    const choisir = (i) => {
      if (i === choisi) return;
      choisi = i;
      selection = i;
      dessiner();
    };

    for (const g of [gArgent, gHeures]) {
      const viser = (ev) => choisir(indiceDepuisX(ev.clientX - g.getBoundingClientRect().left, largeur, n));
      // Au doigt : un appui choisit la période ; un glissement horizontal la fait suivre le doigt.
      // Un glissement vertical reste un défilement de la page (le navigateur annule alors le geste)
      // et ne change rien à la sélection.
      let geste = null;
      g.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'mouse') return viser(ev);
        geste = { id: ev.pointerId, x: ev.clientX, glisse: false };
        try { g.setPointerCapture(ev.pointerId); } catch { /* le suivi continue sans capture */ }
      });
      g.addEventListener('pointermove', (ev) => {
        if (ev.pointerType === 'mouse') return viser(ev);
        if (!geste || geste.id !== ev.pointerId) return;
        if (!geste.glisse && Math.abs(ev.clientX - geste.x) < 6) return;
        geste.glisse = true;
        viser(ev);
      });
      g.addEventListener('pointerup', (ev) => {
        if (geste && geste.id === ev.pointerId && !geste.glisse) viser(ev);
        geste = null;
      });
      g.addEventListener('pointercancel', () => { geste = null; });
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); choisir(Math.max(0, choisi - 1)); }
        if (ev.key === 'ArrowRight') { ev.preventDefault(); choisir(Math.min(n - 1, choisi + 1)); }
      });
    }
    dessiner();
  }

  if (zone) {
    monterCourbes();
    // Si la largeur change (téléphone tourné, fenêtre redimensionnée), les courbes sont redessinées.
    let largeurVue = zone.clientWidth;
    observateur = new ResizeObserver(() => {
      if (zone.clientWidth === largeurVue) return;
      largeurVue = zone.clientWidth;
      monterCourbes();
    });
    observateur.observe(zone);
  }

  // Marque d'un coup les jours oubliés sans aucune heure (vacances de la construction, mise à pied…).
  async function motifPourOublies() {
    const vides = oublies.filter((o) => !o.incomplet);
    const motif = await choisir({
      titre: `Pas travaillé ces ${vides.length} jours`,
      texte: vides.map((o) => formatDate(o.date)).join(', '),
      options: Object.entries(MOTIFS_ABSENCE).map(([valeur, m]) => ({ valeur, label: m.nom })),
    });
    if (!motif) return;
    for (const o of vides) {
      const j = etat.jours.get(o.date);
      await enregistrerJour({ date: o.date, debut: '', fin: '', pauseMin: 30, chantierId: null, note: '', ...(j ?? {}), absence: motif });
    }
    toast(`${vides.length} jours notés : ${MOTIFS_ABSENCE[motif].nom}`);
    naviguer('accueil');
  }

  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'jour') return naviguer('jour', auj);
    if (b.dataset.act === 'depart') return naviguer('bienvenue');
    if (b.dataset.act === 'depart-non') return majReglages((r) => { r.configDepart = 'fait'; }).then(() => naviguer('accueil'));
    if (b.dataset.act === 'oublies-motif') return motifPourOublies();
    if (b.dataset.jour) return naviguer('jour', b.dataset.jour);
    if (b.dataset.sem) return naviguer('semaine', b.dataset.sem);
    if (b.dataset.paie) return naviguer('paie', b.dataset.paie);
    if (b.dataset.mode || b.dataset.plage) {
      if (b.dataset.mode) mode = b.dataset.mode;
      if (b.dataset.plage) plage = b.dataset.plage;
      selection = null;
      return monterCourbes();
    }
    if (b.dataset.vue) { vue = b.dataset.vue; tout = false; }
    else if (b.dataset.act === 'tout') tout = true;
    else return;
    racine.querySelector('#recap').innerHTML = htmlRecap(recap);
  };
}
