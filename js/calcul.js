// Calculs de la semaine et de la paie. Fonctions pures, testées dans tests/.

import { dureeQuart, jourSemaine, joursDeLaSemaine } from './temps.js';
import { grillePourDate, prereglage, VACANCES_PCT } from './grilles.js';

const arrondi = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// Profil en vigueur à une date : le plus récent dont la date d'effet est atteinte.
// Avant le premier profil, on prend le premier (il n'y a rien d'autre à appliquer).
export function profilPourDate(profils, date) {
  if (!profils?.length) return null;
  const tries = [...profils].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  let trouve = tries[0];
  for (const p of tries) if (p.dateEffet <= date) trouve = p;
  return trouve;
}

export function reglesDuProfil(profil) {
  return { ...prereglage(profil.secteur, profil.isole, profil.gite), ...(profil.regles ?? {}) };
}

// Taux horaire d'un profil à une date. Le taux personnalisé remplace la grille.
export function tauxDuProfil(profil, date, grilles) {
  if (typeof profil.tauxPerso === 'number' && profil.tauxPerso > 0) {
    return { taux: profil.tauxPerso, origine: 'perso', grille: null };
  }
  const grille = grillePourDate(grilles, profil.secteur, profil.isole, date);
  const taux = grille?.taux?.[profil.echelon];
  if (typeof taux !== 'number') return { taux: null, origine: 'manquant', grille: null };
  return { taux, origine: 'grille', grille };
}

function ajouter(tranches, mult, minutes) {
  if (minutes <= 0) return;
  const t = tranches.find((x) => x.mult === mult);
  if (t) t.minutes += minutes;
  else tranches.push({ mult, minutes });
}

// Répartit les minutes de chaque jour entre temps simple et temps majoré.
// `jours` : 7 entrées dans l'ordre de la semaine : { date, minutes, ferie, regles }.
// `feries` : dates fériées de la liste (réduisent le seuil de la semaine même sans travail ce jour-là).
export function classerSemaine(jours, feries = []) {
  // Le choix fait sur la journée (true ou false) l'emporte sur la liste.
  const liste = new Set(feries);
  const estFerie = (j) => (typeof j.ferie === 'boolean' ? j.ferie : liste.has(j.date));
  const feriesOuvrables = jours.filter((j) => estFerie(j) && jourSemaine(j.date) >= 1 && jourSemaine(j.date) <= 5).length;

  let normalesCumul = 0;
  let palier1Utilise = 0;

  return jours.map((j) => {
    const tranches = [];
    const minutes = Math.max(0, j.minutes || 0);
    if (!minutes || !j.regles) return { date: j.date, minutes, tranches, ferie: estFerie(j) };
    const r = j.regles;

    const parPaliers = (supp) => {
      const dispo = Math.max(0, (r.heuresPalier1 || 0) * 60 - palier1Utilise);
      const p1 = Math.min(supp, dispo);
      palier1Utilise += p1;
      ajouter(tranches, r.multPalier1, p1);
      ajouter(tranches, r.multPalier2, supp - p1);
    };
    const majore = (mult) => (typeof mult === 'number' ? ajouter(tranches, mult, minutes) : parPaliers(minutes));

    const dow = jourSemaine(j.date);
    if (estFerie(j)) majore(r.multFerie);
    else if (dow === 0) majore(r.multDimanche);
    else if (dow === 6) majore(r.multSamedi);
    else {
      const seuilSemaine = Math.max(0, (r.seuilSemaine - feriesOuvrables * (r.reductionFerie || 0)) * 60);
      const normales = Math.max(0, Math.min(minutes, r.seuilJour * 60, seuilSemaine - normalesCumul));
      normalesCumul += normales;
      ajouter(tranches, 1, normales);
      parPaliers(minutes - normales);
    }
    tranches.sort((a, b) => a.mult - b.mult);
    return { date: j.date, minutes, tranches, ferie: estFerie(j) };
  });
}

export function nomMultiplicateur(mult) {
  if (mult === 1) return 'Temps simple';
  if (mult === 1.5) return 'Temps et demi';
  if (mult === 2) return 'Temps double';
  return `Temps × ${String(mult).replace('.', ',')}`;
}

// Une prime s'applique-t-elle à ce jour travaillé ?
function primeActive(prime, jour) {
  if (prime.actif === false) return false;
  if (prime.debut && jour.date < prime.debut) return false;
  if (prime.fin && jour.date > prime.fin) return false;
  if (prime.chantierId && prime.chantierId !== jour.chantierId) return false;
  return true;
}

// Calcule une semaine complète.
//   debut     : premier jour de la semaine ('AAAA-MM-JJ')
//   saisies   : Map ou objet date -> { debut, fin, pauseMin, ferie, chantierId }
//   reglages  : { profils, primes, feries }
//   grilles   : grilles fusionnées (intégrées + personnelles)
export function calculerSemaine(debut, saisies, reglages, grilles) {
  const lire = (d) => (saisies instanceof Map ? saisies.get(d) : saisies?.[d]);
  const feries = reglages.feries ?? [];

  const jours = joursDeLaSemaine(debut).map((date) => {
    const s = lire(date);
    const profil = profilPourDate(reglages.profils, date);
    const duree = s?.debut && s?.fin ? dureeQuart({ date, debut: s.debut, fin: s.fin, pauseMin: s.pauseMin }) : null;
    return {
      date,
      saisie: s ?? null,
      profil,
      duree,
      minutes: duree?.travaillees ?? 0,
      ferie: typeof s?.ferie === 'boolean' ? s.ferie : null,
      chantierId: s?.chantierId ?? null,
      regles: profil ? reglesDuProfil(profil) : null,
      ...(profil ? tauxDuProfil(profil, date, grilles) : { taux: null, origine: 'manquant', grille: null }),
    };
  });

  const classes = classerSemaine(jours, feries);
  const lignes = new Map();
  const totaux = new Map();
  let tauxManquant = false;

  jours.forEach((j, i) => {
    j.tranches = classes[i].tranches;
    j.ferie = classes[i].ferie;
    j.montant = null;
    if (!j.minutes) return;
    if (j.taux === null) tauxManquant = true;
    for (const t of j.tranches) {
      totaux.set(t.mult, (totaux.get(t.mult) ?? 0) + t.minutes);
      if (j.taux === null) continue;
      const cle = `${j.taux}|${t.mult}`;
      const l = lignes.get(cle) ?? { taux: j.taux, mult: t.mult, minutes: 0 };
      l.minutes += t.minutes;
      lignes.set(cle, l);
    }
  });

  const lignesPaie = [...lignes.values()]
    .map((l) => ({ ...l, montant: arrondi((l.minutes / 60) * l.taux * l.mult) }))
    .sort((a, b) => a.mult - b.mult || a.taux - b.taux);
  for (const j of jours) {
    if (j.minutes && j.taux !== null) j.montant = arrondi(j.tranches.reduce((s, t) => s + (t.minutes / 60) * j.taux * t.mult, 0));
  }

  const travailles = jours.filter((j) => j.minutes > 0);
  const lignesPrimes = [];
  for (const prime of reglages.primes ?? []) {
    const concernes = travailles.filter((j) => primeActive(prime, j));
    if (!concernes.length) continue;
    const montantUnitaire = Number(prime.montant) || 0;
    let quantite;
    if (prime.unite === 'heure') quantite = concernes.reduce((s, j) => s + j.minutes, 0) / 60;
    else if (prime.unite === 'jour') quantite = concernes.length;
    else quantite = 1;
    lignesPrimes.push({ id: prime.id, nom: prime.nom, unite: prime.unite, quantite, montantUnitaire, dansSalaire: Boolean(prime.dansSalaire), montant: arrondi(quantite * montantUnitaire) });
  }

  const salaireHeures = arrondi(lignesPaie.reduce((s, l) => s + l.montant, 0));
  const primesSalaire = arrondi(lignesPrimes.filter((p) => p.dansSalaire).reduce((s, p) => s + p.montant, 0));
  const indemnites = arrondi(lignesPrimes.filter((p) => !p.dansSalaire).reduce((s, p) => s + p.montant, 0));
  const brut = arrondi(salaireHeures + primesSalaire);
  const dernierProfil = travailles.at(-1)?.profil ?? jours.at(-1).profil;
  const vacancesPct = typeof dernierProfil?.vacancesPct === 'number' ? dernierProfil.vacancesPct : VACANCES_PCT;
  const vacances = arrondi((brut * vacancesPct) / 100);

  const minutesTotal = jours.reduce((s, j) => s + j.minutes, 0);
  const minutesSimples = totaux.get(1) ?? 0;

  return {
    debut,
    jours,
    minutesTotal,
    minutesSimples,
    minutesMajorees: minutesTotal - minutesSimples,
    totaux: [...totaux.entries()].map(([mult, minutes]) => ({ mult, minutes })).sort((a, b) => a.mult - b.mult),
    lignesPaie,
    lignesPrimes,
    salaireHeures,
    primesSalaire,
    indemnites,
    brut,
    vacancesPct,
    vacances,
    tauxManquant,
  };
}
