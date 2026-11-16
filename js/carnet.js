// Carnet d'apprentissage : période en cours, heures restantes, estimation de la date de passage.
// Fonctions pures, testées dans tests/.

import { ajouterJours, jourSemaine } from './temps.js';

// Heures qui comptent au carnet pour une semaine calculée.
// facteurSupp = 1 : une heure travaillée compte pour une heure, majorée ou non (hypothèse à vérifier).
export function heuresCarnetSemaine(semaine, facteurSupp = 1) {
  return (semaine.minutesSimples + semaine.minutesMajorees * facteurSupp) / 60;
}

// État du carnet.
//   heuresDepart : heures travaillées inscrites au dossier CCQ (sans les crédits)
//   heuresApp    : heures comptées par l'app depuis la date du solde
//   credits      : crédits de formation (ex. 2 025 pour le DEP)
//   creditsMode  : 'fin'     = crédits en réserve à la dernière période (défaut CCQ)
//                  'devance' = crédits utilisés tout de suite (sur demande à la CCQ)
export function etatCarnet({ heuresDepart = 0, heuresApp = 0, credits = 0, creditsMode = 'fin', parPeriode = 2000, periodes = 3 }) {
  const total = parPeriode * periodes;
  const travaillees = (Number(heuresDepart) || 0) + (Number(heuresApp) || 0);
  const cr = Math.max(0, Number(credits) || 0);
  const aTravailler = Math.max(0, total - cr);

  const progression = creditsMode === 'devance' ? travaillees + cr : travaillees;
  const finA = creditsMode === 'devance' ? total : aTravailler;
  const termine = progression >= finA;
  const periode = Math.min(periodes, Math.floor(Math.min(progression, Math.max(0, finA - 0.0001)) / parPeriode) + 1);
  const seuilPeriode = periode * parPeriode;
  const prochainSeuil = Math.min(seuilPeriode, finA);
  const prochain = termine ? 'termine' : prochainSeuil >= finA ? 'fin' : 'periode';

  return {
    total,
    credits: cr,
    creditsMode,
    travaillees,
    progression,
    periode,
    debutPeriode: (periode - 1) * parPeriode,
    prochainSeuil,
    prochain,
    restant: Math.max(0, prochainSeuil - progression),
    restantFin: Math.max(0, aTravailler - travaillees),
    termine,
  };
}

// Moyenne d'heures par semaine sur les dernières semaines complètes où il y a eu du travail.
export function moyenneHebdo(heuresParSemaine, nb = 4) {
  const utiles = heuresParSemaine.filter((h) => h > 0).slice(-nb);
  if (!utiles.length) return null;
  return utiles.reduce((s, h) => s + h, 0) / utiles.length;
}

export function dateEstimee(aujourdhui, heuresRestantes, heuresParSemaine) {
  if (!heuresParSemaine || heuresParSemaine <= 0) return null;
  if (heuresRestantes <= 0) return aujourdhui;
  return ajouterJours(aujourdhui, Math.ceil((heuresRestantes / heuresParSemaine) * 7));
}

function dernierSamedi(annee, mois) {
  let d = new Date(Date.UTC(annee, mois, 0)).toISOString().slice(0, 10);
  while (jourSemaine(d) !== 6) d = ajouterJours(d, -1);
  return d;
}

// Période d'un rapport mensuel : du dimanche qui suit le dernier samedi du mois précédent
// au dernier samedi du mois. Déduit des dates de la convention résidentielle (art. 19.04 4)),
// proposé comme valeur de départ et modifiable.
export function periodeRapportMensuel(annee, mois) {
  const fin = dernierSamedi(annee, mois);
  const precedent = mois === 1 ? dernierSamedi(annee - 1, 12) : dernierSamedi(annee, mois - 1);
  return { debut: ajouterJours(precedent, 1), fin };
}
