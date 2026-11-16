// Écran « Accueil » : où j'en suis, récapitulatif par semaine, mois et année, ligne du temps de l'historique.
// Les calculs sont dans js/recap.js. Le net affiché est la somme des nets saisis : il n'est jamais estimé.

import { etat, semaine, debutSemaine, aujourdhui } from '../etat.js';
import { APP } from '../config.js';
import { formatDate, formatDuree, nomMois } from '../temps.js';
import { SECTEURS, ECHELONS } from '../grilles.js';
import { recapituler, jalons, ligneDuTemps } from '../recap.js';
import { esc, argent } from '../ui.js';

const VUES = {
  semaines: { nom: 'Semaine', limite: 8 },
  mois: { nom: 'Mois', limite: 12 },
  annees: { nom: 'Année', limite: Infinity },
};
const SEGMENTS = [['s1', 'simples', 'Temps simple'], ['s15', 'demi', 'Temps et demi'], ['s2', 'double', 'Temps double'], ['sx', 'autres', 'Autre majoration']];

// Ce qu'on regardait reste affiché quand on revient sur l'écran.
let vue = 'semaines';
let tout = false;

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

function titreLigne(l) {
  if (vue === 'semaines') return titreSemaineCourt(l.debut, l.fin);
  if (vue === 'mois') return `${nomMois(l.cle)} ${l.cle.slice(0, 4)}`;
  return l.cle;
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

const signe = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${argent(Math.abs(n))}`;
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function lignesArgent(l) {
  const estSemaine = vue === 'semaines';
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

function htmlRecap(recap) {
  const lignes = recap[vue];
  const limite = tout ? Infinity : VUES[vue].limite;
  const visibles = lignes.slice(0, limite);
  const echelle = Math.max(1, ...lignes.map((l) => l.minutes));
  const balise = vue === 'semaines' ? 'button' : 'div';
  return `
    <div class="segments" role="group" aria-label="Période du récapitulatif">
      ${Object.entries(VUES).map(([cle, v]) => `<button class="puce ${cle === vue ? 'actif' : ''}" data-vue="${cle}" aria-pressed="${cle === vue}">${v.nom}</button>`).join('')}
    </div>
    <div class="recap">
      ${visibles.map((l) => `
        <${balise} class="recap-ligne" ${vue === 'semaines' ? `data-paie="${l.debut}"` : ''}>
          <span class="recap-tete"><strong>${esc(titreLigne(l))}</strong><strong class="recap-h">${esc(formatDuree(l.minutes))}</strong></span>
          ${barre(l, echelle)}
          ${l.minutes ? `<small>${esc(repartition(l))}</small>` : ''}
          ${lignesArgent(l)}
        </${balise}>`).join('')}
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

export function rendreAccueil(racine, _param, naviguer) {
  const auj = aujourdhui();
  const courante = debutSemaine(auj);
  const sCourante = semaine(courante);
  const jAuj = sCourante.jours.find((j) => j.date === auj);
  const quartAuj = jAuj?.saisie?.debut && jAuj?.saisie?.fin ? `${heureLisible(jAuj.saisie.debut)} à ${heureLisible(jAuj.saisie.fin)}` : 'Rien de saisi';

  const semaines = semainesDeLHistorique();
  const recap = recapituler(semaines, etat.semaines);
  const dernierExport = etat.reglages.sauvegarde.dernierExport;
  const items = ligneDuTemps(semaines, jalons(semaines, {
    profils: etat.reglages.profils,
    chantiers: etat.reglages.chantiers,
    secteurs: SECTEURS,
    echelons: ECHELONS,
    auj,
    dernierExport: dernierExport ? aujourdhui(new Date(dernierExport)) : null,
  }), { debutCourant: courante });
  const aDesAutres = items.some((i) => i.type === 'semaine' && i.autres > 0);

  racine.innerHTML = `
    <header class="entete">
      <div class="entete-titre">
        <strong>${esc(APP.nom)}</strong>
        <small>${esc(formatDate(auj, { annee: true }))}</small>
      </div>
    </header>

    <section class="carte">
      <div class="duo">
        <div class="duo-case"><small>Aujourd'hui</small><strong class="${jAuj?.minutes ? '' : 'discret'}">${esc(formatDuree(jAuj?.minutes ?? 0))}</strong><small>${esc(quartAuj)}</small></div>
        <div class="duo-case"><small>Cette semaine</small><strong class="${sCourante.minutesTotal ? '' : 'discret'}">${esc(formatDuree(sCourante.minutesTotal))}</strong><small>${esc(argent(sCourante.brut))} brut estimé</small></div>
      </div>
      <button class="btn btn-principal btn-large" data-act="jour">${jAuj?.saisie ? 'Modifier ma journée' : 'Saisir ma journée'}</button>
    </section>

    ${recap.semaines.length ? `
    <section class="carte">
      <h2>Récapitulatif</h2>
      <div id="recap">${htmlRecap(recap)}</div>
    </section>` : ''}

    ${items.length ? `
    <section class="carte">
      <h2>Ligne du temps</h2>
      <p class="aide">Ton historique déroulé comme un ruban à mesurer : une graduation par semaine, la plus récente en haut. Touche une semaine pour l'ouvrir.</p>
      <div class="legende">
        ${SEGMENTS.filter(([classe]) => classe !== 'sx' || aDesAutres).map(([classe, , nom]) => `<span><i class="${classe}"></i>${nom}</span>`).join('')}
      </div>
      ${htmlRuban(items, auj)}
    </section>` : `
    <section class="carte">
      <p class="aide">Ton récapitulatif et ta ligne du temps apparaîtront ici dès ta première journée saisie.</p>
    </section>`}

    <p class="aide centre">${esc(APP.mention)}</p>
  `;

  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'jour') return naviguer('jour', auj);
    if (b.dataset.sem) return naviguer('semaine', b.dataset.sem);
    if (b.dataset.paie) return naviguer('paie', b.dataset.paie);
    if (b.dataset.vue) { vue = b.dataset.vue; tout = false; }
    else if (b.dataset.act === 'tout') tout = true;
    else return;
    racine.querySelector('#recap').innerHTML = htmlRecap(recap);
  };
}
