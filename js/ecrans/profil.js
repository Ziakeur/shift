// Onglet « Profil » : ce qui concerne la personne. Une première page qui résume l'emploi, l'assurance et le
// carnet, puis une page par sujet : #/profil/emploi, horaires, chantiers, primes (dessinées par reglages.js),
// #/profil/assurance (ici) et #/profil/carnet (carnet.js).

import { etat, majReglages, toutesLesSemaines, aujourdhui } from '../etat.js';
import { formatDate } from '../temps.js';
import { profilPourDate, tauxDuProfil } from '../calcul.js';
import { SECTEURS, ECHELONS, ASSURANCE, CARNET } from '../grilles.js';
import { estimerAssurance, periodesCles, semestreAssurance } from '../assurance.js';
import { esc, argent, nombre, formulaire, toast } from '../ui.js';
import { rendreReglages, PAGES_TRAVAIL, titrePage, resumePage } from './reglages.js';
import { rendreCarnet, calculerCarnet } from './carnet.js';

export const PAGES_PROFIL = [...PAGES_TRAVAIL, 'assurance', 'carnet'];

const jourMois = (d) => formatDate(d, { jour: false });
const dateLongue = (d) => formatDate(d, { jour: false, annee: true });
const duAu = (a, b) => `${a.slice(0, 4) === b.slice(0, 4) ? jourMois(a) : dateLongue(a)} au ${dateLongue(b)}`;
const h = (n) => `${nombre(Math.round(n * 100) / 100)} h`;
const nomRegime = (cle) => (cle ? `Régime ${cle}` : 'Aucun régime');
const MAX_PALIERS = Math.max(...ASSURANCE.regimes.map((r) => r.heures));
const SEUIL_MIN = Math.min(...ASSURANCE.regimes.map((r) => r.heures));

// Heures travaillées par jour (une heure majorée compte pour une heure) et date de la première journée notée.
function heuresTravaillees() {
  const parJour = new Map();
  let total = 0;
  for (const s of toutesLesSemaines()) {
    for (const j of s.jours) {
      if (!j.minutes) continue;
      parJour.set(j.date, j.minutes / 60);
      total += j.minutes / 60;
    }
  }
  const premiere = etat.jours.size ? [...etat.jours.keys()].sort()[0] : null;
  return { parJour, total, premiere };
}

function calculerAssurance(auj, heures) {
  const a = etat.reglages.assurance;
  const carte = a.cartePeriode ? { periode: a.cartePeriode, regime: a.carteRegime || null, reserve: a.reserve } : null;
  const estimations = estimerAssurance({
    heuresParJour: heures.parJour, periodes: ASSURANCE.periodes, regimes: ASSURANCE.regimes, auj, premiereFiche: heures.premiere, carte,
  });
  return { estimations, carte, ...periodesCles(estimations) };
}

function htmlRegime(p, etiquette) {
  return `
    <div class="regime">
      <span class="regime-lettre ${p.regime ? '' : 'vide'}" aria-hidden="true">${esc(p.regime ?? '—')}</span>
      <span class="regime-corps">
        <small>${esc(etiquette)}</small>
        <strong>${esc(nomRegime(p.regime))}${p.regime ? ' estimé' : ''}</strong>
        <small>${esc(h(p.heures))} du ${esc(duAu(p.refDebut, p.refFin))}${p.parReserve ? `, plus ${esc(h(p.reserveUtilisee))} de ta réserve` : ''}</small>
      </span>
    </div>`;
}

// Les heures de la période sur l'échelle des régimes : un repère par seuil.
function htmlPaliers(p) {
  const pct = Math.min(100, (p.heures / MAX_PALIERS) * 100);
  const reperes = [...ASSURANCE.regimes].sort((a, b) => a.heures - b.heures);
  return `
    <div class="paliers" role="img" aria-label="${esc(h(p.heures))} sur l'échelle des régimes : ${reperes.map((r) => `${r.cle} à ${r.heures} h`).join(', ')}">
      <div class="paliers-barre"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="paliers-reperes" aria-hidden="true">
        ${reperes.map((r) => `<span class="${p.heures >= r.heures ? 'atteint' : ''}" style="left:${((r.heures / MAX_PALIERS) * 100).toFixed(1)}%"><b>${esc(r.cle)}</b><small>${r.heures} h</small></span>`).join('')}
      </div>
    </div>`;
}

function texteManque(p) {
  if (!p.suivant) return 'Le régime A, le plus complet, est atteint par les heures.';
  return p.reference === 'terminee'
    ? `Il a manqué ${h(p.suivant.manque)} pour le régime ${p.suivant.cle}.`
    : `Il manque ${h(p.suivant.manque)} pour le régime ${p.suivant.cle}.`;
}

function texteIncomplet(p, premiere) {
  if (!p.incomplet || !p.suivant) return '';
  if (!premiere) return 'Aucune journée saisie dans l\'app pour cette période.';
  if (premiere > p.refFin) return `Tes heures dans l'app commencent le ${dateLongue(premiere)}, après cette période : l'app ne peut pas l'estimer.`;
  return `Tes heures dans l'app commencent le ${dateLongue(premiere)} : celles d'avant ne sont pas comptées, l'estimation peut être trop basse.`;
}

// ---------------------------------------------------------------------------
// Première page

function htmlTete(auj, heures) {
  const p = profilPourDate(etat.reglages.profils, auj);
  const t = tauxDuProfil(p, auj, etat.grilles);
  const convention = `${SECTEURS[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`;
  return `
    <section class="carte profil-tete">
      <small>En ce moment</small>
      <strong class="profil-nom">${esc(p.employeur || 'Employeur non précisé')}</strong>
      <p class="sous">${esc(convention)} · ${esc(ECHELONS[p.echelon] ?? p.echelon)}</p>
      <div class="duo">
        <div class="duo-case"><small>Taux horaire</small><strong class="${t.taux === null ? 'texte-alerte' : ''}">${t.taux === null ? 'À vérifier' : esc(argent(t.taux))}</strong><small>${t.taux === null ? 'aucune grille vérifiée' : t.origine === 'perso' ? 'taux personnalisé' : `grille du ${esc(dateLongue(t.grille.dateEffet))}`}</small></div>
        <div class="duo-case"><small>Heures saisies</small><strong>${esc(nombre(Math.round(heures.total)))} h</strong><small>${heures.premiere ? `depuis le ${esc(dateLongue(heures.premiere))}` : 'rien pour l\'instant'}</small></div>
      </div>
      <button class="btn btn-large btn-principal" data-page="emploi">Voir ou changer mon emploi</button>
      <p class="aide centre">Employeur, convention, échelon, taux, heures supplémentaires, vacances.</p>
    </section>`;
}

function htmlCarteAssurance(ass, heures) {
  const { enCours, prochaine, accumulation } = ass;
  const corps = [];
  if (!heures.premiere) {
    corps.push('<p class="aide">Aucune heure saisie pour l\'instant. Le régime dépend des heures travaillées pendant six mois : il s\'affichera ici au fil de tes journées.</p>');
  } else {
    if (enCours) corps.push(htmlRegime(enCours, `En ce moment, jusqu'au ${dateLongue(enCours.assFin)}`));
    if (prochaine) corps.push(htmlRegime(prochaine, `Ensuite, du ${duAu(prochaine.assDebut, prochaine.assFin)}`));
    if (!enCours && !prochaine) corps.push(`<p class="aide">Les dates des périodes ne sont connues de l'app que jusqu'au ${esc(dateLongue(ASSURANCE.periodes.at(-1).assFin))} : à vérifier sur le site de la CCQ.</p>`);
    if (accumulation) {
      corps.push(`
        <div class="champ">
          <span>Heures en cours, pour la couverture du ${esc(duAu(accumulation.assDebut, accumulation.assFin))}</span>
          ${htmlPaliers(accumulation)}
          <small class="aide">${esc(h(accumulation.heures))} depuis le ${esc(dateLongue(accumulation.refDebut))}. ${esc(texteManque(accumulation))} Les heures comptent jusqu'au ${esc(dateLongue(accumulation.refFin))}.</small>
        </div>`);
    }
    const incomplet = [enCours, prochaine, accumulation].map((p) => (p ? texteIncomplet(p, heures.premiere) : '')).find(Boolean);
    if (incomplet) corps.push(`<p class="aide">${esc(incomplet)}</p>`);
  }
  return `
    <section class="carte">
      <h2>Mon assurance <span class="badge">estimation</span></h2>
      ${corps.join('')}
      <button class="btn btn-large" data-page="assurance">Voir le détail de mon assurance</button>
    </section>`;
}

function htmlCarteCarnet(auj) {
  const { configure, e, pct, prochainTexte } = calculerCarnet(auj);
  return `
    <section class="carte">
      <h2>Mon carnet d'apprentissage</h2>
      <div class="regime">
        <span class="regime-lettre" aria-hidden="true">${e.termine ? '✓' : e.periode}</span>
        <span class="regime-corps">
          <small>Charpentier-menuisier, ${CARNET.periodes} périodes de ${esc(nombre(CARNET.parPeriode))} h</small>
          <strong>${e.termine ? 'Terminé' : `Période ${e.periode} sur ${CARNET.periodes}`}</strong>
          <small>${esc(prochainTexte)}</small>
        </span>
      </div>
      <div class="barre" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${configure ? '' : '<p class="aide">Le décompte part de zéro : entre le solde de ton dossier CCQ dans le carnet.</p>'}
      <button class="btn btn-large" data-page="carnet">Ouvrir mon carnet</button>
    </section>`;
}

function htmlAccueilProfil(auj) {
  const heures = heuresTravaillees();
  return `
    <header class="entete"><div class="entete-titre"><strong>Profil</strong><small>Ton emploi, ton assurance, ton carnet</small></div></header>
    ${htmlTete(auj, heures)}
    ${htmlCarteAssurance(calculerAssurance(auj, heures), heures)}
    ${htmlCarteCarnet(auj)}
    <section class="menu-groupe">
      <h2 class="menu-titre">Mon travail</h2>
      <div class="liste">
        ${PAGES_TRAVAIL.filter((page) => page !== 'emploi').map((page) => `
          <button class="rangee" data-page="${page}">
            <span class="rangee-corps"><strong>${esc(titrePage(page))}</strong><small>${esc(resumePage(page, auj))}</small></span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>`).join('')}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Page « Mon assurance »

const BADGES = { 'en-cours': ['couverture en cours', 'badge-ok'], 'a-venir': ['à venir', ''], terminee: ['terminée', ''] };

function htmlPeriode(p, premiere, carte) {
  const [badge, classe] = BADGES[p.couverture];
  const reference = p.reference === 'a-venir'
    ? `Les heures de cette période compteront du ${duAu(p.refDebut, p.refFin)}.`
    : p.reference === 'en-cours'
      ? `Les heures comptent jusqu'au ${dateLongue(p.refFin)}. ${texteManque(p)}`
      : `Heures du ${duAu(p.refDebut, p.refFin)}. ${texteManque(p)}`;
  const incomplet = texteIncomplet(p, premiere);
  return `
    <section class="carte">
      <h2>Du ${esc(duAu(p.assDebut, p.assFin))} <span class="badge ${classe}">${badge}</span></h2>
      ${htmlRegime(p, p.reference === 'en-cours' ? 'À ce jour' : p.reference === 'a-venir' ? 'Pas encore commencé' : 'Selon tes heures')}
      ${htmlPaliers(p)}
      <p class="aide">${esc(reference)}</p>
      ${p.parReserve ? `<p class="note-info">Avec ${esc(h(p.reserveUtilisee))} de la réserve inscrite sur ta carte (${esc(nomRegime(carte.regime).toLowerCase())}, ${esc(h(carte.reserve))} en réserve). Par les heures seules : ${esc(nomRegime(p.regimeHeures).toLowerCase())}.</p>` : ''}
      ${incomplet ? `<p class="note-info">${esc(incomplet)}</p>` : ''}
    </section>`;
}

function htmlAssurance(auj) {
  const heures = heuresTravaillees();
  const { estimations, carte } = calculerAssurance(auj, heures);
  const ordre = { 'en-cours': 0, 'a-venir': 1, terminee: 2 };
  const liste = [...estimations].sort((a, b) => ordre[a.couverture] - ordre[b.couverture]
    || (a.couverture === 'terminee' ? b.assDebut.localeCompare(a.assDebut) : a.assDebut.localeCompare(b.assDebut)));
  const semCarte = carte ? semestreAssurance(carte.periode) : null;
  return `
    <header class="entete">
      <button class="btn-icone" data-act="retour" aria-label="Retour au profil">‹</button>
      <div class="entete-titre"><strong>Mon assurance</strong><small>MÉDIC Construction, régimes de base</small></div>
      <span class="entete-vide" aria-hidden="true"></span>
    </header>

    <section class="carte">
      <p>Ton régime (A, B, C ou D) dépend des heures travaillées pendant une période de six mois. Il vaut ensuite pour six mois de couverture.</p>
      <p class="aide"><strong>Estimation</strong> d'après les heures saisies dans l'app. C'est la CCQ qui établit ton régime, d'après les heures déclarées par ton employeur : ta carte MÉDIC Construction et ton avis d'assurabilité font foi.</p>
      <table class="tableau"><tbody>
        ${ASSURANCE.regimes.map((r) => `<tr><td>Régime ${esc(r.cle)}${r.heures === MAX_PALIERS ? '<small>le plus complet</small>' : r.heures === SEUIL_MIN ? '<small>couverture minimale</small>' : ''}</td><td class="montant">${r.heures} h</td></tr>`).join('')}
      </tbody></table>
    </section>

    ${liste.map((p) => htmlPeriode(p, heures.premiere, carte)).join('')}

    <section class="carte">
      <h2>Ma carte MÉDIC Construction</h2>
      ${carte
        ? `<table class="tableau"><tbody>
            <tr><td>Carte de la période</td><td class="montant">${esc(duAu(semCarte.debut, semCarte.fin))}</td></tr>
            <tr><td>Régime inscrit</td><td class="montant">${esc(carte.regime ?? 'aucun de A à D')}</td></tr>
            <tr><td>Heures en réserve</td><td class="montant">${typeof carte.reserve === 'number' ? esc(h(carte.reserve)) : '—'}</td></tr>
          </tbody></table>`
        : '<p class="aide">Facultatif. Ta carte indique ton régime et tes heures en réserve. Inscris-les ici : l\'estimation de la période suivante en tiendra compte.</p>'}
      <p class="aide">La réserve sert quand il manque des heures : elle permet le meilleur régime possible, sans dépasser celui de ta carte. L'app ne l'applique qu'à la période qui suit celle de ta carte ; pour les suivantes, elle ne connaît plus ta réserve et compte les heures seules.</p>
      <button class="btn btn-large ${carte ? '' : 'btn-principal'}" data-act="carte">${carte ? 'Modifier ma carte' : 'Inscrire ma carte'}</button>
    </section>

    <section class="carte">
      <h2>D'où viennent ces règles</h2>
      <ul class="sources">${ASSURANCE.sources.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="aide">Source : <a href="${esc(ASSURANCE.url)}" target="_blank" rel="noopener">page « Assurance de base » de la CCQ</a>, lue le ${esc(dateLongue(ASSURANCE.luLe))}. Le tableau de la CCQ donne les périodes jusqu'au ${esc(dateLongue(ASSURANCE.periodes.at(-1).assFin))}.</p>
      <p class="alerte"><strong>À vérifier.</strong> ${esc(ASSURANCE.aVerifier)}</p>
    </section>`;
}

async function editerCarte(auj, naviguer) {
  const a = etat.reglages.assurance;
  // Périodes dont la carte peut exister : celles déjà commencées, la suivante, et celle d'avant le tableau.
  const debuts = ASSURANCE.periodes.map((p) => p.assDebut);
  const connus = [semestreAssurance(debuts[0]).precedent, ...debuts];
  const prochaine = connus.find((d) => d > auj);
  const proposes = connus.filter((d) => d <= auj || d === prochaine);
  if (a.cartePeriode && !proposes.includes(a.cartePeriode)) proposes.push(a.cartePeriode);
  const libelle = (d) => { const s = semestreAssurance(d); return `Du ${duAu(s.debut, s.fin)}`; };
  const r = await formulaire({
    titre: 'Ma carte MÉDIC Construction',
    intro: 'Recopie ce qui est inscrit sur ta carte. Tout est facultatif : sans carte, l\'estimation compte les heures seules.',
    champs: [
      { nom: 'cartePeriode', label: 'Période d\'assurance de la carte', type: 'choix', valeur: a.cartePeriode ?? '', options: [{ valeur: '', label: 'Aucune carte inscrite' }, ...proposes.sort().map((d) => ({ valeur: d, label: libelle(d) }))] },
      { nom: 'carteRegime', label: 'Régime inscrit sur la carte', type: 'choix', valeur: a.carteRegime ?? '', options: [...ASSURANCE.regimes.map((x) => ({ valeur: x.cle, label: `Régime ${x.cle}` })), { valeur: '', label: 'Aucun de ces régimes' }] },
      { nom: 'reserve', label: 'Heures en réserve', type: 'nombre', valeur: a.reserve, placeholder: 'Ex. : 120', aide: 'Le nombre d\'heures en réserve est inscrit sur la carte.' },
    ],
    valider: (v) => (v.reserve !== null && v.reserve < 0 ? 'La réserve ne peut pas être négative.' : null),
  });
  if (r?.action !== 'ok') return;
  const v = r.valeurs;
  await majReglages((reg) => {
    reg.assurance = v.cartePeriode
      ? { cartePeriode: v.cartePeriode, carteRegime: v.carteRegime || null, reserve: v.reserve }
      : { cartePeriode: null, carteRegime: null, reserve: null };
  });
  toast(v.cartePeriode ? 'Carte enregistrée' : 'Carte retirée');
  naviguer('profil', 'assurance');
}

export function rendreProfil(racine, param, naviguer) {
  if (param === 'carnet') return rendreCarnet(racine, null, naviguer);
  if (PAGES_TRAVAIL.includes(param)) return rendreReglages(racine, param, naviguer, 'profil');

  const auj = aujourdhui();
  racine.innerHTML = param === 'assurance' ? htmlAssurance(auj) : htmlAccueilProfil(auj);
  racine.onchange = null;
  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return undefined;
    if (b.dataset.page) return naviguer('profil', b.dataset.page);
    if (b.dataset.act === 'retour') return naviguer('profil');
    if (b.dataset.act === 'carte') return editerCarte(auj, naviguer);
    return undefined;
  };
  return undefined;
}
