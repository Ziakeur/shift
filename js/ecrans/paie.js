// Écran « Paie » : brut estimé de la semaine, vacances à part, primes, puis comparaison au talon.

import { etat, semaine, debutSemaine, enregistrerSemaine, aujourdhui, toutesLesSemaines } from '../etat.js';
import { paiesVacances } from '../recap.js';
import { ajouterJours, formatDate, formatHeuresDecimales } from '../temps.js';
import { nomMultiplicateur, profilPourDate } from '../calcul.js';
import { ECHELONS, SECTEURS, VACANCES_SOURCE, PROCHAINE_HAUSSE } from '../grilles.js';
import { esc, argent, nombre, lireNombre, toast } from '../ui.js';
import { enteteSemaine } from './semaine.js';

const UNITES = { heure: 'h', jour: 'jour(s)', semaine: 'semaine' };
const STATUTS = { 'en-cours': 'en cours', 'a-venir': 'à venir', versee: 'déjà versée' };

// Semestres pas encore versés, plus le dernier versé (pour comparer avec l'avis de paiement de la CCQ).
function htmlVacances(auj) {
  const toutes = paiesVacances(toutesLesSemaines(), auj);
  const visibles = [...toutes.filter((v) => v.statut !== 'versee'), ...toutes.filter((v) => v.statut === 'versee').slice(0, 1)];
  if (!visibles.length) return '';
  const titre = (v) => `${v.cle.endsWith('-1') ? 'Janvier à juin' : 'Juillet à décembre'} ${v.debut.slice(0, 4)}`;
  return `
    <section class="carte">
      <h2>Mes paies de vacances</h2>
      <table class="tableau"><tbody>
        ${visibles.map((v) => `
          <tr>
            <td>${esc(titre(v))} <span class="badge">${STATUTS[v.statut]}</span>
              <small>Versée par la CCQ entre le ${esc(formatDate(v.versement.du, { jour: false }))} et le ${esc(formatDate(v.versement.au, { jour: false, annee: true }))}${v.statut === 'en-cours' ? ', montant à ce jour' : ''}${v.incomplet ? " · incomplet : des heures n'ont pas de taux" : ''}</small></td>
            <td class="montant">${esc(argent(v.montant))}</td>
          </tr>`).join('')}
      </tbody></table>
      <p class="aide">Estimation : le pourcentage de vacances appliqué au brut estimé de chaque jour, rangé dans son semestre. Le montant exact est sur l'avis de paiement, dans les services en ligne de la CCQ.</p>
    </section>`;
}

function descriptionTaux(s) {
  const vus = new Map();
  for (const j of s.jours) {
    if (!j.minutes) continue;
    const cle = `${j.profil?.id}|${j.taux}|${j.origine}`;
    if (!vus.has(cle)) vus.set(cle, j);
  }
  if (!vus.size) {
    const p = profilPourDate(etat.reglages.profils, s.debut);
    return p ? [`<p class="aide">Profil : ${esc(SECTEURS[p.secteur]?.nom ?? p.secteur)}${p.isole ? ', chantier isolé' : ''}, ${esc(ECHELONS[p.echelon])}.</p>`] : [];
  }
  return [...vus.values()].map((j) => {
    const p = j.profil;
    const base = `${esc(SECTEURS[p.secteur]?.nom ?? p.secteur)}${p.isole ? ', chantier isolé' : ''}, ${esc(ECHELONS[p.echelon])}`;
    if (j.origine === 'perso') return `<p class="aide"><strong>${esc(argent(j.taux))} l'heure</strong>, taux personnalisé (${base}).</p>`;
    if (j.origine === 'manquant') return `<p class="alerte">Aucun taux vérifié pour ${base} à cette date. Entre un taux personnalisé ou ajoute une grille dans les réglages.</p>`;
    const g = j.grille;
    return `<p class="aide"><strong>${esc(argent(j.taux))} l'heure</strong> : ${base}, grille en vigueur le ${esc(formatDate(g.dateEffet, { jour: false, annee: true }))}${g.statut === 'date-a-verifier' ? ' <span class="badge">date à vérifier</span>' : ''}${g.statut === 'perso' ? ' <span class="badge">saisie à la main</span>' : ''}.</p>`;
  });
}

export function rendrePaie(racine, debut, naviguer) {
  const courante = debutSemaine(aujourdhui());
  const s = semaine(debut);
  const talon = etat.semaines.get(debut) ?? { debut, brutReel: null, netReel: null, note: '' };
  const total = s.brut + s.indemnites;

  racine.innerHTML = `
    ${enteteSemaine(debut, courante)}
    <section class="carte resume">
      <small>Salaire brut estimé</small>
      <div class="grand">${esc(argent(s.brut))}</div>
      <p class="sous">${esc(formatHeuresDecimales(s.minutesTotal))} h travaillées, avant déductions</p>
    </section>

    ${s.tauxManquant ? '<p class="alerte">Des heures n\'ont pas de taux : le montant est incomplet. Voir « Taux utilisé » plus bas.</p>' : ''}

    <section class="carte">
      <h2>Détail</h2>
      <table class="tableau">
        <tbody>
          ${s.lignesPaie.map((l) => `
            <tr>
              <td>${esc(nomMultiplicateur(l.mult))}<small>${esc(formatHeuresDecimales(l.minutes))} h × ${esc(argent(l.taux))}${l.mult !== 1 ? ` × ${esc(nombre(l.mult))}` : ''}</small></td>
              <td class="montant">${esc(argent(l.montant))}</td>
            </tr>`).join('') || '<tr><td colspan="2" class="discret">Aucune heure payable cette semaine.</td></tr>'}
          ${s.lignesPrimes.filter((p) => p.dansSalaire).map((p) => `
            <tr>
              <td>${esc(p.nom)}<small>${esc(nombre(p.quantite))} ${UNITES[p.unite]} × ${esc(argent(p.montantUnitaire))}</small></td>
              <td class="montant">${esc(argent(p.montant))}</td>
            </tr>`).join('')}
          <tr class="total"><td>Salaire brut</td><td class="montant">${esc(argent(s.brut))}</td></tr>
          ${s.lignesPrimes.filter((p) => !p.dansSalaire).map((p) => `
            <tr>
              <td>${esc(p.nom)} <span class="badge">indemnité</span><small>${esc(nombre(p.quantite))} ${UNITES[p.unite]} × ${esc(argent(p.montantUnitaire))}</small></td>
              <td class="montant">${esc(argent(p.montant))}</td>
            </tr>`).join('')}
          ${s.indemnites ? `<tr class="total"><td>Brut + indemnités</td><td class="montant">${esc(argent(total))}</td></tr>` : ''}
        </tbody>
      </table>
    </section>

    <section class="carte a-part">
      <table class="tableau">
        <tbody>
          <tr><td>Indemnité de vacances (${esc(nombre(s.vacancesPct))} %)<small>Versée à la CCQ par l'employeur, payée fin novembre et fin juin. Pas dans le net de cette paie.</small></td><td class="montant">${esc(argent(s.vacances))}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="carte">
      <h2>Mon talon de paie</h2>
      <label class="champ"><span>Salaire brut du talon ($)</span><input type="text" inputmode="decimal" id="brut-reel" autocomplete="off" value="${talon.brutReel ?? ''}" placeholder="Sans l'indemnité de vacances"></label>
      <div id="ecart"></div>
      <label class="champ"><span>Net reçu ($)</span><input type="text" inputmode="decimal" id="net-reel" autocomplete="off" value="${talon.netReel ?? ''}" placeholder="Montant déposé"></label>
      <label class="champ"><span>Note</span><input type="text" id="note-talon" value="${esc(talon.note ?? '')}" placeholder="Numéro du talon, remarque…"></label>
      <p class="aide">Les déductions (impôts, RRQ, assurance-emploi, RQAP, cotisation syndicale, retraite, assurance) ne sont pas estimées : elles dépendent de ta situation et de ton syndicat. Entre le net tel qu'il est sur ton talon.</p>
    </section>

    ${htmlVacances(aujourdhui())}

    <section class="carte">
      <h2>Taux utilisé</h2>
      ${descriptionTaux(s).join('')}
      <p class="aide">${esc(PROCHAINE_HAUSSE.note)}</p>
      <details><summary>Pourquoi les vacances sont à part</summary><p class="aide">${esc(VACANCES_SOURCE)}</p></details>
    </section>
  `;

  const $ = (sel) => racine.querySelector(sel);

  function afficherEcart() {
    const reel = lireNombre($('#brut-reel').value);
    const zone = $('#ecart');
    if (reel === null) { zone.innerHTML = ''; return; }
    const ecart = Math.round((reel - s.brut) * 100) / 100;
    if (Math.abs(ecart) < 0.005) {
      zone.innerHTML = '<p class="ok">Aucun écart : le talon correspond à l\'estimation.</p>';
    } else {
      zone.innerHTML = `<p class="${ecart < 0 ? 'alerte' : 'note-info'}"><strong>Écart : ${ecart > 0 ? '+' : '−'}${esc(argent(Math.abs(ecart)))}</strong> (talon ${ecart > 0 ? 'plus élevé' : 'plus bas'} que l'estimation). À vérifier : heures comptées, taux, primes, période de paie.</p>`;
    }
  }

  async function enregistrer() {
    const brutReel = lireNombre($('#brut-reel').value);
    const netReel = lireNombre($('#net-reel').value);
    try {
      await enregistrerSemaine({ debut, brutReel, netReel, note: $('#note-talon').value.trim() });
      afficherEcart();
      toast('Enregistré');
    } catch (e) {
      toast(`Échec de l'enregistrement : ${e.message}`, 'erreur');
    }
  }

  racine.onchange = (ev) => {
    if (['brut-reel', 'net-reel', 'note-talon'].includes(ev.target.id)) enregistrer();
  };
  racine.oninput = (ev) => { if (ev.target.id === 'brut-reel') afficherEcart(); };
  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'prec') naviguer('paie', ajouterJours(debut, -7));
    if (b.dataset.act === 'suiv') naviguer('paie', ajouterJours(debut, 7));
    if (b.dataset.act === 'courante') naviguer('paie', courante);
  };

  afficherEcart();
}
