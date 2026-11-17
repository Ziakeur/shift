// Récapitulatifs par semaine, mois et année, et ligne du temps de l'historique.
// Fonctions pures, testées dans tests/. Les montants sont additionnés en cents pour éviter les erreurs d'arrondi.

import { ajouterJours, jourSemaine } from './temps.js';

const enCents = (x) => Math.round(((Number(x) || 0) + Number.EPSILON) * 100);
const dollars = (n) => `${n.toFixed(2).replace('.', ',')} $`;
const milliers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function minutesPar(tranches, garder) {
  return tranches.filter((t) => garder(t.mult)).reduce((s, t) => s + t.minutes, 0);
}

// Répartit une semaine calculée entre ses jours travaillés.
// Brut du jour = heures du jour à leur taux + part des primes de la semaine, au prorata des heures.
// La somme des jours redonne exactement le brut de la semaine.
// Une semaine sans heures mais avec une prime cochée la répartit à parts égales entre les jours cochés.
export function joursVentiles(sem) {
  const avecHeures = sem.jours.filter((j) => j.minutes > 0);
  const travailles = avecHeures.length ? avecHeures : sem.jours.filter((j) => j.saisie?.primes?.length);
  const total = travailles.reduce((s, j) => s + j.minutes, 0);
  const poids = (j) => (total ? j.minutes / total : 1 / travailles.length);
  const bases = travailles.map((j) => enCents(j.montant));
  const reste = enCents(sem.brut) - bases.reduce((a, b) => a + b, 0);
  const parts = travailles.map((j) => Math.round(reste * poids(j)));
  if (parts.length) parts[parts.length - 1] += reste - parts.reduce((a, b) => a + b, 0);
  return travailles.map((j, i) => ({
    date: j.date,
    minutes: j.minutes,
    simples: minutesPar(j.tranches, (m) => m === 1),
    demi: minutesPar(j.tranches, (m) => m === 1.5),
    double: minutesPar(j.tranches, (m) => m === 2),
    autres: minutesPar(j.tranches, (m) => ![1, 1.5, 2].includes(m)),
    brutCents: bases[i] + parts[i],
    sansTaux: j.taux === null,
  }));
}

function ligneVide(cle) {
  return {
    cle, minutes: 0, simples: 0, demi: 0, double: 0, autres: 0, brutCents: 0, incomplet: false,
    semaines: 0, netNb: 0, netCents: 0, brutReelNb: 0, brutReelCents: 0, ecartCents: 0,
  };
}

function ajouterJour(ligne, jour) {
  for (const c of ['minutes', 'simples', 'demi', 'double', 'autres', 'brutCents']) ligne[c] += jour[c];
  if (jour.sansTaux) ligne.incomplet = true;
}

function ajouterTalon(ligne, brutEstimeCents, net, brutReel) {
  ligne.semaines += 1;
  if (net !== null) { ligne.netNb += 1; ligne.netCents += net; }
  if (brutReel !== null) { ligne.brutReelNb += 1; ligne.brutReelCents += brutReel; ligne.ecartCents += brutReel - brutEstimeCents; }
}

function sortie(l) {
  return {
    cle: l.cle,
    minutes: l.minutes, simples: l.simples, demi: l.demi, double: l.double, autres: l.autres,
    brut: l.brutCents / 100,
    incomplet: l.incomplet,
    semaines: l.semaines,
    netNb: l.netNb,
    net: l.netNb ? l.netCents / 100 : null,
    brutReelNb: l.brutReelNb,
    brutReel: l.brutReelNb ? l.brutReelCents / 100 : null,
    ecart: l.brutReelNb ? l.ecartCents / 100 : null,
  };
}

// Totaux par semaine, par mois et par année, du plus récent au plus ancien.
//   semaines : semaines calculées (résultats de calculerSemaine)
//   talons   : Map ou objet début de semaine -> { brutReel, netReel }
// Heures et brut estimé : comptés jour par jour, donc une semaine à cheval sur deux mois est partagée.
// Net et brut du talon : un talon ne se découpe pas, il est rattaché au mois et à l'année où la semaine se termine.
// Le net n'est jamais estimé : `net` est la somme des nets saisis, `netNb` le nombre de semaines où il est saisi,
// `semaines` le nombre de semaines (avec des heures ou un talon) qui se terminent dans la période.
export function recapituler(semaines, talons = new Map()) {
  const lireTalon = (d) => (talons instanceof Map ? talons.get(d) : talons?.[d]);
  const parSemaine = [];
  const mois = new Map();
  const annees = new Map();
  const groupe = (map, cle) => {
    if (!map.has(cle)) map.set(cle, ligneVide(cle));
    return map.get(cle);
  };

  for (const sem of semaines) {
    const fin = ajouterJours(sem.debut, 6);
    const talon = lireTalon(sem.debut);
    const net = typeof talon?.netReel === 'number' ? enCents(talon.netReel) : null;
    const brutReel = typeof talon?.brutReel === 'number' ? enCents(talon.brutReel) : null;
    if (!sem.minutesTotal && net === null && brutReel === null) continue;

    const ligne = ligneVide(sem.debut);
    for (const jour of joursVentiles(sem)) {
      ajouterJour(ligne, jour);
      ajouterJour(groupe(mois, jour.date.slice(0, 7)), jour);
      ajouterJour(groupe(annees, jour.date.slice(0, 4)), jour);
    }
    const estime = enCents(sem.brut);
    ajouterTalon(ligne, estime, net, brutReel);
    ajouterTalon(groupe(mois, fin.slice(0, 7)), estime, net, brutReel);
    ajouterTalon(groupe(annees, fin.slice(0, 4)), estime, net, brutReel);
    parSemaine.push({ ...sortie(ligne), debut: sem.debut, fin });
  }

  const trier = (liste) => liste.sort((a, b) => b.cle.localeCompare(a.cle));
  return {
    semaines: trier(parSemaine),
    mois: trier([...mois.values()].map(sortie)),
    annees: trier([...annees.values()].map(sortie)),
  };
}

function moisSuivant(cle) {
  const [a, m] = cle.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

// Suite sans trou pour tracer une courbe : de la première période à la dernière (ou à `jusqua`),
// de la plus ancienne à la plus récente. Une période sans heures vaut zéro, elle n'est pas sautée.
//   lignes : `semaines` ou `mois` d'un récapitulatif ; type : 'semaines' ou 'mois'
//   jusqua : début de la semaine en cours, ou mois en cours ('AAAA-MM')
export function suiteContinue(lignes, type, { jusqua = null } = {}) {
  if (!lignes.length) return [];
  const parCle = new Map(lignes.map((l) => [l.cle, l]));
  const cles = [...parCle.keys()].sort();
  const fin = jusqua && jusqua > cles.at(-1) ? jusqua : cles.at(-1);
  const suivante = type === 'mois' ? moisSuivant : (cle) => ajouterJours(cle, 7);
  const suite = [];
  for (let cle = cles[0]; cle <= fin; cle = suivante(cle)) {
    suite.push(parCle.get(cle) ?? { ...sortie(ligneVide(cle)), ...(type === 'mois' ? {} : { debut: cle, fin: ajouterJours(cle, 6) }) });
  }
  return suite;
}

// Totaux d'une suite de lignes (pour les chiffres au-dessus des courbes).
export function totaliser(lignes) {
  const t = { minutes: 0, brutCents: 0, netCents: 0, netNb: 0, semaines: 0, incomplet: false };
  for (const l of lignes) {
    t.minutes += l.minutes;
    t.brutCents += enCents(l.brut);
    t.netCents += enCents(l.net);
    t.netNb += l.netNb;
    t.semaines += l.semaines;
    if (l.incomplet) t.incomplet = true;
  }
  return { minutes: t.minutes, brut: t.brutCents / 100, net: t.netNb ? t.netCents / 100 : null, netNb: t.netNb, semaines: t.semaines, incomplet: t.incomplet };
}

// Cumul au fil du temps : chaque point additionne tout ce qui précède dans la suite.
// Le net cumulé est celui des talons saisis jusque-là (`netNb` semaines sur `semaines`).
export function cumuler(lignes) {
  return lignes.map((l, i) => ({ cle: l.cle, ...totaliser(lignes.slice(0, i + 1)) }));
}

function changementsDeProfil(avant, p, secteurs, echelons) {
  const textes = [];
  if ((p.employeur ?? '') !== (avant.employeur ?? '')) textes.push(p.employeur ? `Employeur : ${p.employeur}` : 'Employeur retiré');
  if (p.secteur !== avant.secteur || Boolean(p.isole) !== Boolean(avant.isole)) {
    textes.push(`Convention : ${secteurs[p.secteur]?.nom ?? p.secteur}${p.isole ? ', chantier isolé' : ''}`);
  }
  if (p.echelon !== avant.echelon) textes.push(`Échelon : ${echelons[p.echelon] ?? p.echelon}`);
  if ((p.tauxPerso ?? null) !== (avant.tauxPerso ?? null)) {
    textes.push(typeof p.tauxPerso === 'number' && p.tauxPerso > 0 ? `Taux personnalisé : ${dollars(p.tauxPerso)} l'heure` : 'Retour au taux de la grille');
  }
  return textes.length ? textes.join(' · ') : 'Réglages de paie modifiés';
}

// Jalons de l'historique, du plus ancien au plus récent : { date, genre, texte }.
// Rien d'estimé : première journée, changements de profil (à leur date d'effet), premier jour sur un chantier,
// changement de taux de la grille (premier jour travaillé au nouveau taux), paliers d'heures saisies, dernière sauvegarde.
export function jalons(semaines, { profils = [], chantiers = [], secteurs = {}, echelons = {}, auj = null, dernierExport = null, pasCumul = 500 } = {}) {
  const jours = [...semaines]
    .sort((a, b) => a.debut.localeCompare(b.debut))
    .flatMap((s) => s.jours)
    .filter((j) => j.minutes > 0);
  if (!jours.length) return [];
  const premier = jours[0].date;
  const liste = [{ date: premier, genre: 'debut', texte: 'Première journée saisie' }];

  const chantiersVus = new Set();
  let cumul = 0;
  let avant = null;
  for (const j of jours) {
    if (j.chantierId && !chantiersVus.has(j.chantierId)) {
      chantiersVus.add(j.chantierId);
      const ch = chantiers.find((c) => c.id === j.chantierId);
      if (ch) liste.push({ date: j.date, genre: 'chantier', texte: `Nouveau chantier : ${ch.nom}` });
    }
    const memeProfil = avant && avant.profil && j.profil
      && avant.profil.secteur === j.profil.secteur && Boolean(avant.profil.isole) === Boolean(j.profil.isole) && avant.profil.echelon === j.profil.echelon;
    if (memeProfil && avant.origine === 'grille' && j.origine === 'grille' && avant.grille.dateEffet !== j.grille.dateEffet && avant.taux !== j.taux) {
      liste.push({ date: j.date, genre: 'taux', texte: `Nouveau taux de la grille : ${dollars(avant.taux)} → ${dollars(j.taux)} l'heure` });
    }
    const paliersAvant = Math.floor(cumul / (pasCumul * 60));
    cumul += j.minutes;
    const paliers = Math.floor(cumul / (pasCumul * 60));
    if (paliers > paliersAvant) liste.push({ date: j.date, genre: 'cumul', texte: `${milliers(paliers * pasCumul)} h saisies` });
    avant = j;
  }

  const tries = [...profils].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  for (let i = 1; i < tries.length; i += 1) {
    const p = tries[i];
    if (p.dateEffet <= premier || (auj && p.dateEffet > auj)) continue;
    liste.push({ date: p.dateEffet, genre: 'profil', texte: changementsDeProfil(tries[i - 1], p, secteurs, echelons) });
  }

  if (dernierExport && dernierExport >= premier) liste.push({ date: dernierExport, genre: 'sauvegarde', texte: 'Dernière sauvegarde' });

  return liste.sort((a, b) => a.date.localeCompare(b.date));
}

// Ligne du temps : une entrée par semaine, de la plus récente à la plus ancienne.
//   { type: 'semaine', debut, fin, minutes, simples, demi, double, autres, brut, jalons }
//   { type: 'vide', nb, debut, fin } : semaines de suite sans heures ni jalon, regroupées
// `debutCourant` : début de la semaine en cours, pour que la ligne aille jusqu'à aujourd'hui.
export function ligneDuTemps(semaines, listeJalons = [], { debutCourant = null } = {}) {
  const avecHeures = semaines.filter((s) => s.minutesTotal > 0).sort((a, b) => a.debut.localeCompare(b.debut));
  if (!avecHeures.length) return [];
  const parDebut = new Map(avecHeures.map((s) => [s.debut, s]));
  const premier = avecHeures[0].debut;
  let dernier = avecHeures.at(-1).debut;
  if (debutCourant && debutCourant > dernier) dernier = debutCourant;

  const items = [];
  let vide = null;
  for (let d = premier; d <= dernier; d = ajouterJours(d, 7)) {
    const fin = ajouterJours(d, 6);
    const s = parDebut.get(d);
    const js = listeJalons.filter((j) => j.date >= d && j.date <= fin);
    if (!s && !js.length) {
      // La semaine en cours, pas encore commencée, n'est pas une semaine « sans heures ».
      if (d === debutCourant) continue;
      if (vide) { vide.nb += 1; vide.fin = fin; } else { vide = { type: 'vide', nb: 1, debut: d, fin }; items.push(vide); }
      continue;
    }
    vide = null;
    const totaux = { minutes: 0, simples: 0, demi: 0, double: 0, autres: 0 };
    if (s) for (const jour of joursVentiles(s)) for (const c of Object.keys(totaux)) totaux[c] += jour[c];
    items.push({ type: 'semaine', debut: d, fin, ...totaux, brut: s?.brut ?? 0, incomplet: Boolean(s?.tauxManquant), jalons: js });
  }
  return items.reverse();
}

// Jours habituels de travail des `nbJours` derniers jours (aujourd'hui exclu) où rien n'est noté :
// ni quart complet, ni motif « pas travaillé ». Les fériés sont ignorés, et rien n'est signalé
// avant la première fiche de l'historique. Du plus ancien au plus récent : { date, incomplet }.
// `incomplet` : un début ou une fin est saisi, mais pas les deux.
export function joursOublies(saisies, { auj, joursTravail = [1, 2, 3, 4, 5], feries = [], nbJours = 14 } = {}) {
  if (!saisies.size || !joursTravail.length) return [];
  const premier = [...saisies.keys()].sort()[0];
  const liste = new Set(feries);
  const depuis = ajouterJours(auj, -nbJours);
  const out = [];
  for (let d = depuis < premier ? premier : depuis; d < auj; d = ajouterJours(d, 1)) {
    if (!joursTravail.includes(jourSemaine(d))) continue;
    const j = saisies.get(d);
    if (typeof j?.ferie === 'boolean' ? j.ferie : liste.has(d)) continue;
    if (j?.absence || (j?.debut && j?.fin)) continue;
    out.push({ date: d, incomplet: Boolean(j?.debut || j?.fin) });
  }
  return out;
}

// Semestre de l'indemnité de vacances (conventions 2025-2029, résidentiel art. 24.02, IC et industriel art. 19.05) :
// janvier à juin, versé dans les 8 derniers jours de novembre ; juillet à décembre, dans les 8 derniers jours de juin suivant.
export function periodeVacances(date) {
  const a = Number(date.slice(0, 4));
  return date.slice(5, 7) <= '06'
    ? { cle: `${a}-1`, debut: `${a}-01-01`, fin: `${a}-06-30`, versement: { du: `${a}-11-23`, au: `${a}-11-30` } }
    : { cle: `${a}-2`, debut: `${a}-07-01`, fin: `${a}-12-31`, versement: { du: `${a + 1}-06-23`, au: `${a + 1}-06-30` } };
}

// Indemnité de vacances estimée par semestre, du plus récent au plus ancien.
// Comptée jour par jour (une semaine à cheval sur le 30 juin est partagée), au pourcentage de la semaine.
// statut : 'en-cours' (le semestre n'est pas fini), 'a-venir' (fini, pas encore versé), 'versee'.
export function paiesVacances(semaines, auj) {
  const periodes = new Map();
  for (const sem of semaines) {
    for (const j of joursVentiles(sem)) {
      const p = periodeVacances(j.date);
      if (!periodes.has(p.cle)) periodes.set(p.cle, { ...p, cents: 0, minutes: 0, incomplet: false });
      const l = periodes.get(p.cle);
      l.cents += Math.round((j.brutCents * sem.vacancesPct) / 100);
      l.minutes += j.minutes;
      if (j.sansTaux) l.incomplet = true;
    }
  }
  return [...periodes.values()]
    .sort((a, b) => b.cle.localeCompare(a.cle))
    .map(({ cents, ...p }) => ({
      ...p,
      montant: cents / 100,
      statut: auj <= p.fin ? 'en-cours' : auj <= p.versement.au ? 'a-venir' : 'versee',
    }));
}

// Relevé d'une période, jour par jour, groupé par semaine (pour l'imprimer).
//   semaines : semaines calculées qui couvrent [du, au]
//   talons   : début de semaine -> { brutReel, netReel } ; un talon compte si sa semaine se termine dans la période
// Seules les journées notées (heures, motif, chantier ou note) apparaissent.
export function releve(semaines, { du, au, talons = new Map(), chantiers = [], primes = [] } = {}) {
  const lireTalon = (d) => (talons instanceof Map ? talons.get(d) : talons?.[d]);
  const total = { minutes: 0, simples: 0, demi: 0, double: 0, autres: 0, brutCents: 0, joursTravailles: 0, absences: {}, netNb: 0, netCents: 0, brutReelNb: 0, brutReelCents: 0, incomplet: false };
  const liste = [];
  for (const sem of [...semaines].sort((a, b) => a.debut.localeCompare(b.debut))) {
    const fin = ajouterJours(sem.debut, 6);
    if (fin < du || sem.debut > au) continue;
    const ventiles = new Map(joursVentiles(sem).map((v) => [v.date, v]));
    const jours = [];
    const st = { minutes: 0, brutCents: 0 };
    for (const j of sem.jours) {
      if (j.date < du || j.date > au || !j.saisie) continue;
      const v = ventiles.get(j.date);
      const ch = chantiers.find((c) => c.id === j.saisie.chantierId);
      const ligne = {
        date: j.date,
        debut: j.saisie.debut || '',
        fin: j.saisie.fin || '',
        pauseMin: j.saisie.debut && j.saisie.fin ? (j.saisie.pauseMin ?? 0) : 0,
        minutes: j.minutes,
        simples: v?.simples ?? 0, demi: v?.demi ?? 0, double: v?.double ?? 0, autres: v?.autres ?? 0,
        brut: (v?.brutCents ?? 0) / 100,
        sansTaux: Boolean(v?.sansTaux),
        ferie: Boolean(j.ferie),
        absence: j.saisie.absence ?? null,
        chantier: ch ? { nom: ch.nom, lieu: [ch.adresse, ch.ville].filter(Boolean).join(', ') } : null,
        primes: (j.saisie.primes ?? []).map((id) => primes.find((p) => p.id === id)?.nom).filter(Boolean),
        note: j.saisie.note ?? '',
      };
      jours.push(ligne);
      st.minutes += ligne.minutes;
      st.brutCents += v?.brutCents ?? 0;
      for (const c of ['minutes', 'simples', 'demi', 'double', 'autres']) total[c] += ligne[c];
      total.brutCents += v?.brutCents ?? 0;
      if (ligne.minutes) total.joursTravailles += 1;
      if (ligne.sansTaux) total.incomplet = true;
      if (ligne.absence) total.absences[ligne.absence] = (total.absences[ligne.absence] ?? 0) + 1;
    }
    const t = fin >= du && fin <= au ? lireTalon(sem.debut) : null;
    const talon = t && (typeof t.brutReel === 'number' || typeof t.netReel === 'number')
      ? { brutReel: typeof t.brutReel === 'number' ? t.brutReel : null, netReel: typeof t.netReel === 'number' ? t.netReel : null }
      : null;
    if (talon && talon.netReel !== null) { total.netNb += 1; total.netCents += enCents(talon.netReel); }
    if (talon && talon.brutReel !== null) { total.brutReelNb += 1; total.brutReelCents += enCents(talon.brutReel); }
    if (!jours.length && !talon) continue;
    liste.push({ debut: sem.debut, fin, jours, minutes: st.minutes, brut: st.brutCents / 100, talon });
  }
  return {
    du, au,
    semaines: liste,
    total: {
      minutes: total.minutes, simples: total.simples, demi: total.demi, double: total.double, autres: total.autres,
      brut: total.brutCents / 100,
      incomplet: total.incomplet,
      joursTravailles: total.joursTravailles,
      absences: total.absences,
      netNb: total.netNb, net: total.netNb ? total.netCents / 100 : null,
      brutReelNb: total.brutReelNb, brutReel: total.brutReelNb ? total.brutReelCents / 100 : null,
    },
  };
}
