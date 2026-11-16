// Écran « Carnet » : progression de l'apprentissage et comparaison avec les heures déclarées à la CCQ.

import { etat, majReglages, toutesLesSemaines, debutSemaine, nouvelId, aujourdhui } from '../etat.js';
import { formatDate } from '../temps.js';
import { etatCarnet, moyenneHebdo, dateEstimee, periodeRapportMensuel } from '../carnet.js';
import { CARNET, ECHELONS } from '../grilles.js';
import { profilPourDate } from '../calcul.js';
import { esc, nombre, formulaire, toast } from '../ui.js';

// Heures qui comptent au carnet, par jour : une heure majorée compte `facteurSupp` heure(s).
function heuresParJour(semaines, facteurSupp) {
  const map = new Map();
  for (const s of semaines) {
    for (const j of s.jours) {
      if (!j.minutes) continue;
      const simples = j.tranches.filter((t) => t.mult === 1).reduce((a, t) => a + t.minutes, 0);
      map.set(j.date, (simples + (j.minutes - simples) * facteurSupp) / 60);
    }
  }
  return map;
}

function somme(map, debut, fin) {
  let total = 0;
  for (const [d, h] of map) if ((!debut || d >= debut) && (!fin || d <= fin)) total += h;
  return total;
}

const h = (n) => `${nombre(Math.round(n * 100) / 100)} h`;

export function rendreCarnet(racine, _param, naviguer) {
  const auj = aujourdhui();
  const c = etat.reglages.carnet;
  const semaines = toutesLesSemaines();
  const parJour = heuresParJour(semaines, c.facteurSupp || 1);
  const configure = typeof c.heuresDepart === 'number';

  // Heures de l'app comptées après la date du solde lu au dossier.
  const depuis = c.dateDepart ? [...parJour].filter(([d]) => d > c.dateDepart) : [...parJour];
  const heuresApp = depuis.reduce((s, [, x]) => s + x, 0);
  const e = etatCarnet({ heuresDepart: c.heuresDepart ?? 0, heuresApp, credits: c.credits ?? 0, creditsUtilises: c.creditsUtilises ?? 0, parPeriode: CARNET.parPeriode, periodes: CARNET.periodes });

  const courante = debutSemaine(auj);
  const completes = semaines.filter((s) => s.debut < courante).map((s) => somme(heuresParJour([s], c.facteurSupp || 1)));
  const moyenne = moyenneHebdo(completes);
  const estimation = dateEstimee(auj, e.restant, moyenne);
  const pct = Math.min(100, Math.max(0, ((e.progression - e.debutPeriode) / (e.prochainSeuil - e.debutPeriode || 1)) * 100));

  const echelonProfil = profilPourDate(etat.reglages.profils, auj)?.echelon;
  const echelonCarnet = e.termine ? null : `app${e.periode}`;
  const incoherent = configure && echelonCarnet && echelonProfil && echelonProfil !== 'compagnon' && echelonProfil !== echelonCarnet;

  const prochainTexte = e.termine
    ? 'Heures d\'apprentissage complétées selon ce décompte.'
    : e.prochain === 'fin'
      ? `Reste ${h(e.restant)} avant la fin de l'apprentissage${e.reserve ? `, en comptant ta réserve de ${h(e.reserve)}` : ''}`
      : `Reste ${h(e.restant)} avant la période ${e.periode + 1}`;

  const declarations = [...etat.reglages.declarations].sort((a, b) => b.fin.localeCompare(a.fin));

  racine.innerHTML = `
    <header class="entete"><div class="entete-titre"><strong>Carnet d'apprentissage</strong><small>Charpentier-menuisier, ${CARNET.periodes} périodes de ${nombre(CARNET.parPeriode)} h</small></div></header>

    ${!configure ? '<p class="alerte">Entre d\'abord le solde lu dans ton dossier CCQ (bouton plus bas). En attendant, le décompte part de zéro.</p>' : ''}

    <section class="carte resume">
      <small>Période en cours</small>
      <div class="grand">${e.termine ? 'Terminé' : `Période ${e.periode}`}</div>
      <div class="barre" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>
      <p class="sous">${esc(prochainTexte)}</p>
      ${!e.termine ? `<p class="sous">${estimation
        ? `Passage estimé vers le <strong>${esc(formatDate(estimation, { annee: true }))}</strong>, au rythme de ${esc(nombre(Math.round(moyenne * 10) / 10))} h par semaine (moyenne des ${Math.min(4, completes.filter((x) => x > 0).length)} dernières semaines travaillées).`
        : 'Date estimée : pas encore assez de semaines complètes saisies.'}</p>` : ''}
    </section>

    ${e.simulation ? `<section class="carte">
      <h2>Ma réserve de crédits : ${esc(h(e.reserve))}</h2>
      <p class="aide">Non utilisée pour l'instant : tu avances seulement avec tes heures travaillées. C'est toi qui choisis si et quand l'utiliser.</p>
      <ul class="sources">
        ${e.simulation.pourPasser !== null ? `<li>Passer à la période ${e.periode + 1} dès aujourd'hui demanderait ${esc(h(e.simulation.pourPasser))} de ta réserve.</li>` : ''}
        <li>Si tu utilisais toute ta réserve aujourd'hui, tu serais en période ${e.simulation.periode}${e.simulation.periode === e.periode ? ' (pas de changement de période)' : ''}.</li>
        <li>Gardée jusqu'au bout, elle raccourcit la fin de l'apprentissage : il te reste ${esc(h(e.restantFin))} à travailler, au lieu de ${esc(h(e.restantFinSansReserve))} sans elle.</li>
      </ul>
      <p class="aide">Pour utiliser des crédits, appelle la CCQ (1 888 842-8282), puis inscris les heures versées dans « Modifier mon dossier ». Une réserve plus grande qu'une période peut te faire sauter un échelon : demande à la CCQ si tu peux n'en utiliser qu'une partie.</p>
    </section>` : ''}

    ${incoherent ? `<p class="alerte">Ton profil de paie est réglé sur « ${esc(ECHELONS[echelonProfil])} », mais ce décompte te place en période ${e.periode}. Vérifie ton dossier CCQ, puis ajuste le profil ou le carnet. Au changement de période, l'employeur doit ajuster ton taux, rétroactivement s'il a tardé.</p>` : ''}

    <section class="carte">
      <h2>Décompte</h2>
      <table class="tableau"><tbody>
        <tr><td>Solde lu au dossier CCQ<small>${c.dateDepart ? `en date du ${esc(formatDate(c.dateDepart, { jour: false, annee: true }))}` : 'date non précisée'}</small></td><td class="montant">${configure ? esc(h(c.heuresDepart)) : '—'}</td></tr>
        <tr><td>Heures saisies dans l'app${c.dateDepart ? ' depuis' : ''}</td><td class="montant">${esc(h(heuresApp))}</td></tr>
        <tr class="total"><td>Heures travaillées cumulées</td><td class="montant">${esc(h(e.travaillees))}</td></tr>
        ${e.creditsUtilises ? `<tr><td>Crédits de formation utilisés<small>versés au carnet à ta demande</small></td><td class="montant">${esc(h(e.creditsUtilises))}</td></tr>
        <tr class="total"><td>Heures au carnet</td><td class="montant">${esc(h(e.progression))}</td></tr>` : ''}
        <tr><td>Crédits en réserve<small>pas encore utilisés</small></td><td class="montant">${esc(h(e.reserve))}</td></tr>
        <tr><td>Reste à travailler avant la fin<small>${e.reserve ? 'en utilisant la réserve à la fin' : 'sans crédits en réserve'}</small></td><td class="montant">${esc(h(e.restantFin))}</td></tr>
      </tbody></table>
      <button class="btn btn-large btn-principal" data-act="dossier">${configure ? 'Modifier mon dossier' : 'Entrer mon solde CCQ'}</button>
    </section>

    <section class="carte">
      <h2>Heures déclarées à la CCQ</h2>
      <p class="aide">L'employeur déclare tes heures chaque mois. Entre ici ce que montre ton dossier CCQ pour comparer avec ton décompte. La mise à jour du dossier peut prendre environ deux mois.</p>
      ${declarations.length ? `<table class="tableau"><tbody>
        ${declarations.map((d) => {
          const app = somme(parJour, d.debut, d.fin);
          const ecart = Math.round((d.heures - app) * 100) / 100;
          return `<tr data-decl="${esc(d.id)}" class="cliquable">
            <td>${esc(formatDate(d.debut, { jour: false }))} au ${esc(formatDate(d.fin, { jour: false, annee: true }))}<small>CCQ ${esc(h(d.heures))} · app ${esc(h(app))}</small></td>
            <td class="montant ${Math.abs(ecart) < 0.01 ? 'ok' : ecart < 0 ? 'neg' : ''}">${Math.abs(ecart) < 0.01 ? 'égal' : `${ecart > 0 ? '+' : '−'}${esc(h(Math.abs(ecart)))}`}</td>
          </tr>`;
        }).join('')}
      </tbody></table>
      <p class="aide">Écart négatif : la CCQ a moins d'heures que toi. À signaler à ton employeur, puis à la CCQ si rien ne bouge.</p>` : ''}
      <button class="btn btn-large" data-act="declarer">Ajouter une déclaration</button>
    </section>

    <section class="carte">
      <h2>D'où viennent ces règles</h2>
      <ul class="sources">
        ${CARNET.sources.map((s) => `<li>${esc(s.texte)} <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a></li>`).join('')}
      </ul>
      <p class="alerte"><strong>À vérifier.</strong> ${esc(CARNET.aVerifier)}</p>
    </section>
  `;

  async function editerDossier() {
    const r = await formulaire({
      titre: 'Mon dossier CCQ',
      intro: 'Recopie ce que montre ton carnet dans les services en ligne de la CCQ.',
      champs: [
        { nom: 'heuresDepart', label: 'Heures travaillées inscrites', type: 'nombre', valeur: c.heuresDepart, requis: true, aide: 'Sans les crédits de formation. Zéro si tu commences.' },
        { nom: 'dateDepart', label: 'Solde en date du', type: 'date', valeur: c.dateDepart ?? auj, aide: 'Les heures saisies dans l\'app après cette date s\'ajoutent au solde.' },
        { nom: 'credits', label: 'Crédits de formation obtenus (heures)', type: 'nombre', valeur: c.credits, placeholder: 'DEP charpenterie-menuiserie : 2025', aide: 'Total des crédits, utilisés ou non. Laisse vide si tu n\'en as pas.' },
        { nom: 'creditsUtilises', label: 'Dont crédits déjà utilisés (heures)', type: 'nombre', valeur: c.creditsUtilises ?? 0, aide: 'Zéro tant que tu gardes tes crédits en réserve. Le jour où tu en fais verser à ton carnet, inscris ici le nombre d\'heures.' },
        { nom: 'facteurSupp', label: 'Une heure majorée compte pour', type: 'nombre', valeur: c.facteurSupp ?? 1, aide: 'En heures au carnet. 1 par défaut : à vérifier auprès de la CCQ.' },
      ],
      valider: (v) => {
        if (v.heuresDepart < 0) return 'Le solde ne peut pas être négatif.';
        if (v.credits !== null && (v.credits < 0 || v.credits > CARNET.plafondCredits)) return `Les crédits vont de 0 à ${CARNET.plafondCredits} h (plafond du métier).`;
        if ((v.creditsUtilises ?? 0) < 0 || (v.creditsUtilises ?? 0) > (v.credits ?? 0)) return 'Les crédits utilisés vont de 0 au total des crédits obtenus.';
        if (v.facteurSupp !== null && (v.facteurSupp < 1 || v.facteurSupp > 2)) return 'Le facteur doit être entre 1 et 2.';
        return null;
      },
    });
    if (r?.action !== 'ok') return;
    await majReglages((reg) => {
      reg.carnet = { ...reg.carnet, ...r.valeurs, dateDepart: r.valeurs.dateDepart || null, creditsUtilises: r.valeurs.creditsUtilises ?? 0, facteurSupp: r.valeurs.facteurSupp ?? 1 };
      delete reg.carnet.creditsMode;
    });
    toast('Dossier enregistré');
    naviguer('carnet');
  }

  async function editerDeclaration(existante) {
    const [a, m] = auj.split('-').map(Number);
    const defaut = periodeRapportMensuel(m === 1 ? a - 1 : a, m === 1 ? 12 : m - 1);
    const r = await formulaire({
      titre: existante ? 'Modifier la déclaration' : 'Heures déclarées à la CCQ',
      intro: 'Période proposée : du dimanche qui suit le dernier samedi du mois précédent au dernier samedi du mois. Ajuste les dates si ton dossier en montre d\'autres.',
      supprimer: Boolean(existante),
      champs: [
        { nom: 'debut', label: 'Du', type: 'date', valeur: existante?.debut ?? defaut.debut, requis: true },
        { nom: 'fin', label: 'Au', type: 'date', valeur: existante?.fin ?? defaut.fin, requis: true },
        { nom: 'heures', label: 'Heures déclarées', type: 'nombre', valeur: existante?.heures, requis: true },
      ],
      valider: (v) => (v.fin < v.debut ? 'La date de fin est avant la date de début.' : v.heures < 0 ? 'Les heures ne peuvent pas être négatives.' : null),
    });
    if (!r) return;
    await majReglages((reg) => {
      reg.declarations = reg.declarations.filter((d) => d.id !== existante?.id);
      if (r.action === 'ok') reg.declarations.push({ id: existante?.id ?? nouvelId(), ...r.valeurs });
    });
    naviguer('carnet');
  }

  racine.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (b?.dataset.act === 'dossier') return editerDossier();
    if (b?.dataset.act === 'declarer') return editerDeclaration(null);
    const ligne = ev.target.closest('tr[data-decl]');
    if (ligne) editerDeclaration(etat.reglages.declarations.find((d) => d.id === ligne.dataset.decl));
  };
}
