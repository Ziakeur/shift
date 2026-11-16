// Grilles de taux, préréglages d'heures supplémentaires et jours fériés.
//
// RÈGLE : aucun chiffre ici qui n'ait été lu sur une source officielle.
// Chaque grille porte sa date d'effet, sa source et un statut :
//   'verifie'        : montants et date lus sur la source
//   'date-a-verifier': montants lus, date d'effet déduite (la source ne donne que l'année)
// Un taux absent reste absent : l'app affiche « à vérifier » et demande un taux personnalisé.
// Pour mettre une grille à jour : voir CLAUDE.md, section « Mettre à jour une grille de taux ».

export const METIER = 'Charpentier-menuisier';

export const SECTEURS = {
  ic: { nom: 'Institutionnel-commercial', annexe: 'C', annexeIsole: 'C-1' },
  industriel: { nom: 'Industriel', annexe: 'B', annexeIsole: 'B-1' },
  gcv: { nom: 'Génie civil et voirie', annexe: 'D', annexeIsole: 'D-1' },
  'res-leger': { nom: 'Résidentiel léger', annexe: 'R', annexeIsole: 'R-2' },
  'res-lourd': { nom: 'Résidentiel lourd', annexe: 'R-1', annexeIsole: 'R-2' },
};

export const ECHELONS = {
  app1: 'Apprenti 1',
  app2: 'Apprenti 2',
  app3: 'Apprenti 3',
  compagnon: 'Compagnon',
};

const SRC = {
  sqiC: {
    source: 'SQI, tableau des taux horaires, secteur institutionnel-commercial, annexe C, taux en vigueur le 26 avril 2026',
    url: 'https://sqi.gouv.qc.ca/fileadmin/faire_affaire_avec_la_sqi/outils_partenaires/tableaux_des_taux_horaires_applicables/2026/sqi_taux_institutionnelcommercial_c__2026-04-26.pdf',
  },
  sqiC1: {
    source: 'SQI, tableau des taux horaires, secteur institutionnel-commercial, annexe C-1, taux en vigueur le 26 avril 2026',
    url: 'https://sqi.gouv.qc.ca/fileadmin/faire_affaire_avec_la_sqi/outils_partenaires/tableaux_des_taux_horaires_applicables/2026/sqi_taux_institutionnelcommercial_c1__2026-04-26.pdf',
  },
  ccInd: {
    source: 'Convention collective 2025-2029, secteur industriel, annexe B (taux de jour, 7 h à 19 h)',
    url: 'https://www.acq.org/wp-content/uploads/2025/04/cc-industriel-2025-2029-vf-22avril2025.pdf',
  },
  sqiB1: {
    source: 'SQI, tableau des taux horaires, secteur industriel, annexe B-1, taux en vigueur le 26 avril 2026',
    url: 'https://sqi.gouv.qc.ca/fileadmin/faire_affaire_avec_la_sqi/outils_partenaires/tableaux_des_taux_horaires_applicables/2026/sqi_taux_industriel_b1__2026-04-26.pdf',
  },
  sqiD: {
    source: 'SQI, tableau des taux horaires, secteur génie civil et voirie, annexe D, taux en vigueur le 26 avril 2026',
    url: 'https://sqi.gouv.qc.ca',
  },
  ccRes: {
    source: 'Convention collective 2025-2029, secteur résidentiel (CCQ)',
    url: 'https://www.ccq.org/-/media/Project/Ccq/Ccq-Website/PDF/ConventionsCollectives/2025-2029/110455-110439-PD5147.pdf',
  },
};

const NOTE_DATE_RES = 'L\'annexe indique seulement l\'année. La date d\'effet reprend celle des autres montants de la même convention (25 avril 2027, 30 avril 2028) : à confirmer.';

function g(secteur, isole, dateEffet, [compagnon, app1, app2, app3], src, extra = {}) {
  return { secteur, isole, dateEffet, taux: { compagnon, app1, app2, app3 }, statut: 'verifie', ...src, ...extra };
}

export const GRILLES = [
  // Institutionnel-commercial
  g('ic', false, '2026-04-26', [50.16, 30.10, 35.11, 42.64], SRC.sqiC),
  g('ic', true, '2026-04-26', [52.59, 31.55, 36.81, 44.70], SRC.sqiC1),

  // Industriel (hors industrie lourde, annexe B-2 non intégrée)
  g('industriel', false, '2025-04-27', [47.77, 28.66, 33.44, 40.60], SRC.ccInd),
  g('industriel', false, '2026-04-26', [50.16, 30.10, 35.11, 42.64], SRC.ccInd),
  g('industriel', false, '2027-04-25', [52.67, 31.60, 36.87, 44.77], SRC.ccInd),
  g('industriel', false, '2028-04-30', [54.78, 32.87, 38.35, 46.56], SRC.ccInd),
  g('industriel', true, '2026-04-26', [52.59, 31.55, 36.81, 44.70], SRC.sqiB1),

  // Génie civil et voirie
  g('gcv', false, '2026-04-26', [50.24, 30.14, 35.17, 42.70], SRC.sqiD),

  // Résidentiel léger (annexe R)
  g('res-leger', false, '2025-07-27', [43.37, 26.02, 30.36, 36.87], SRC.ccRes, { annexe: 'R' }),
  g('res-leger', false, '2026-04-26', [45.76, 27.45, 32.03, 38.90], SRC.ccRes, { annexe: 'R', note: 'Date du 26 avril 2026 confirmée par l\'exemple de paie de l\'APCHQ.' }),
  g('res-leger', false, '2027-04-25', [48.28, 28.97, 33.79, 41.03], SRC.ccRes, { annexe: 'R', statut: 'date-a-verifier', note: NOTE_DATE_RES }),
  g('res-leger', false, '2028-04-30', [50.45, 30.27, 35.31, 42.88], SRC.ccRes, { annexe: 'R', statut: 'date-a-verifier', note: NOTE_DATE_RES }),

  // Résidentiel lourd (annexe R-1)
  g('res-lourd', false, '2025-07-27', [47.25, 28.35, 33.08, 40.16], SRC.ccRes, { annexe: 'R-1' }),
  g('res-lourd', false, '2026-04-26', [49.61, 29.77, 34.73, 42.17], SRC.ccRes, { annexe: 'R-1', statut: 'date-a-verifier', note: 'L\'annexe indique seulement « 2026 ». Date du 26 avril 2026 reprise du résidentiel léger : à confirmer.' }),
  g('res-lourd', false, '2027-04-25', [52.09, 31.26, 36.47, 44.28], SRC.ccRes, { annexe: 'R-1', statut: 'date-a-verifier', note: NOTE_DATE_RES }),
  g('res-lourd', false, '2028-04-30', [54.18, 32.51, 37.92, 46.05], SRC.ccRes, { annexe: 'R-1', statut: 'date-a-verifier', note: NOTE_DATE_RES }),

  // Résidentiel, chantier isolé, Baie-James, Nunavik (annexe R-2, léger et lourd)
  ...['res-leger', 'res-lourd'].flatMap((s) => [
    g(s, true, '2025-07-27', [45.98, 27.59, 32.18, 39.08], SRC.ccRes, { annexe: 'R-2' }),
    g(s, true, '2026-04-26', [48.51, 29.11, 33.96, 41.23], SRC.ccRes, { annexe: 'R-2', statut: 'date-a-verifier', note: 'L\'annexe indique seulement « 2026 » : date à confirmer.' }),
    g(s, true, '2027-04-25', [51.18, 30.71, 35.82, 43.50], SRC.ccRes, { annexe: 'R-2', statut: 'date-a-verifier', note: NOTE_DATE_RES }),
    g(s, true, '2028-04-30', [53.48, 32.09, 37.44, 45.46], SRC.ccRes, { annexe: 'R-2', statut: 'date-a-verifier', note: NOTE_DATE_RES }),
  ]),
];

// Ce qui manque, dit clairement dans l'app.
export const GRILLES_MANQUANTES = [
  'Institutionnel-commercial (C et C-1) : taux du 25 avril 2027 et du 30 avril 2028 non lus (annexe en image dans le PDF).',
  'Génie civil et voirie : annexe D-1 (chantier isolé) et taux 2027-2028 non lus.',
  'Industriel : annexe B-1 pour 2027-2028 et taux de nuit (19 h à 7 h) non intégrés.',
];

export const PROCHAINE_HAUSSE = {
  date: '2027-04-25',
  note: 'Prochaine hausse prévue aux conventions 2025-2029 : 25 avril 2027, puis 30 avril 2028.',
};

export function cleGrille(gr) {
  return `${gr.secteur}|${gr.isole ? 1 : 0}|${gr.dateEffet}`;
}

// Fusionne les grilles intégrées et celles saisies à la main (qui ont priorité).
export function fusionnerGrilles(perso = []) {
  const map = new Map(GRILLES.map((gr) => [cleGrille(gr), gr]));
  for (const gr of perso) map.set(cleGrille(gr), { ...gr, statut: 'perso' });
  return [...map.values()].sort((a, b) => cleGrille(a).localeCompare(cleGrille(b)));
}

// Grille en vigueur à une date : la plus récente dont la date d'effet est atteinte.
export function grillePourDate(grilles, secteur, isole, date) {
  let trouve = null;
  for (const gr of grilles) {
    if (gr.secteur !== secteur || Boolean(gr.isole) !== Boolean(isole)) continue;
    if (gr.dateEffet <= date && (!trouve || gr.dateEffet > trouve.dateEffet)) trouve = gr;
  }
  return trouve;
}

// ---------------------------------------------------------------------------
// Heures supplémentaires : préréglages par convention (charpentier-menuisier).
// Tout est modifiable dans le profil.
//
//  seuilJour / seuilSemaine : heures normales (lundi au vendredi)
//  heuresPalier1 × multPalier1 : premières heures supplémentaires de la semaine
//  multPalier2 : heures supplémentaires suivantes
//  multSamedi / multDimanche / multFerie : multiplicateur fixe, ou null = « suit les paliers »
//  reductionFerie : heures retirées du seuil de la semaine par férié tombant du lundi au vendredi
// ---------------------------------------------------------------------------

const BASE = { seuilJour: 10, seuilSemaine: 40, reductionFerie: 8, multSamedi: null };

export const PREREGLAGES = {
  ic: {
    ...BASE, heuresPalier1: 1, multPalier1: 1.5, multPalier2: 2, multDimanche: 2, multFerie: 2,
    source: 'Convention IC 2025-2029, art. 20.03 4) (40 h par semaine, 10 h par jour) et 21.02 (1re heure supplémentaire de la semaine à 150 %, ensuite 200 % ; dimanche et fériés à 200 %).',
  },
  industriel: {
    ...BASE, heuresPalier1: 1, multPalier1: 1.5, multPalier2: 2, multDimanche: 2, multFerie: 2,
    source: 'Convention industrielle 2025-2029, art. 20.03 4) et 21.02 (mêmes règles que l\'IC). Industrie lourde non couverte.',
  },
  gcv: {
    ...BASE, heuresPalier1: 0, multPalier1: 2, multPalier2: 2, multDimanche: 2, multFerie: 2,
    source: 'Convention génie civil et voirie 2025-2029, art. 21.05 19) (40 h, 10 h par jour en horaire flexible) et 22.02 (heures supplémentaires à 200 %). Certains travaux (routes, aqueduc, asphalte) ont une semaine de 45 ou 50 h : ajuster au besoin.',
  },
  'res-leger': {
    ...BASE, heuresPalier1: 0, multPalier1: 1.5, multPalier2: 1.5, multDimanche: null, multFerie: null,
    source: 'Convention résidentielle 2025-2029, art. 18.02 2) (40 h, maximum 10 h par jour) et 19.02 2) (heures supplémentaires à 150 %). La réserve d\'heures (art. 19.04, jusqu\'à 80 h mises en banque) n\'est pas calculée.',
  },
  'res-lourd': {
    ...BASE, heuresPalier1: 0, multPalier1: 2, multPalier2: 2, multDimanche: null, multFerie: null,
    source: 'Convention résidentielle 2025-2029, art. 18.02 1) (40 h, 10 h par jour pour le charpentier-menuisier) et 19.02 1) (heures supplémentaires à 200 %). La réserve d\'heures (art. 19.04) n\'est pas calculée.',
  },
};

const ISOLE = {
  seuilJour: 9, seuilSemaine: 45, reductionFerie: 0, multSamedi: null,
  heuresPalier1: 5, multPalier1: 1.5, multPalier2: 2, multDimanche: 2, multFerie: null,
};

export const PREREGLAGES_ISOLE = {
  ic: { ...ISOLE, source: 'Convention IC, art. 20.05 (45 h, 9 h par jour ; 50 h et 10 h si gîte et couvert fournis) et 21.03 3) (5 premières heures supplémentaires à 150 %, ensuite 200 %, dimanche à 200 %). Fériés : à vérifier.' },
  industriel: { ...ISOLE, source: 'Convention industrielle, art. 20.05 et 21.03 3) (mêmes règles que l\'IC en chantier isolé). Fériés : à vérifier.' },
  gcv: { ...ISOLE, heuresPalier1: 0, multPalier1: 2, multFerie: 2, source: 'Convention génie civil et voirie, art. 21.08 (45 h ; 50 h si gîte et couvert) et 22.02 (200 %).' },
  'res-leger': { ...ISOLE, source: 'Convention résidentielle, annexe B (45 h, 9 h par jour ; 50 h et 10 h avec chambre et pension ; 5 premières heures supplémentaires à 150 %, ensuite et le dimanche 200 %).' },
  'res-lourd': { ...ISOLE, source: 'Convention résidentielle, annexe B (mêmes règles que le résidentiel léger en chantier isolé).' },
};

// Règles applicables à un profil. `gite` : gîte et couvert fournis en chantier isolé (50 h, 10 h par jour).
export function prereglage(secteur, isole = false, gite = false) {
  const base = (isole ? PREREGLAGES_ISOLE : PREREGLAGES)[secteur] ?? PREREGLAGES.ic;
  if (isole && gite) return { ...base, seuilJour: 10, seuilSemaine: 50 };
  return { ...base };
}

export const VACANCES_PCT = 13;
export const VACANCES_SOURCE = 'Indemnité de congés annuels, jours fériés et maladie : 13 % du salaire gagné (6 % + 5,5 % + 1,5 %). L\'employeur la verse à la CCQ, qui la paie dans les 8 derniers jours de novembre (gains de janvier à juin) et de juin (gains de juillet à décembre). Elle n\'est donc pas dans le net de la paie. Source : conventions 2025-2029, art. 19.05 (IC) et 24.02 (résidentiel).';

// Jours fériés chômés prévus aux conventions 2025-2029 (dates communes aux quatre secteurs à partir de 2027).
// Noël et le jour de l'An tombent dans le congé annuel d'hiver. Liste modifiable dans les réglages.
export const FERIES = [
  '2026-12-25', '2027-01-01',
  '2027-03-26', '2027-03-29', '2027-05-24', '2027-06-24', '2027-07-02', '2027-09-06', '2027-10-11', '2027-11-12', '2027-12-25',
  '2028-01-01', '2028-04-14', '2028-04-17', '2028-05-22', '2028-06-23', '2028-06-30', '2028-09-04', '2028-10-09', '2028-11-10', '2028-12-25',
  '2029-01-01', '2029-03-30', '2029-04-02',
];

export const CARNET = {
  parPeriode: 2000,
  periodes: 3,
  creditsDep: 2025,
  plafondCredits: 4200,
  seuilAvis: 1600,
  sources: [
    { texte: 'Charpentier-menuisier : 3 périodes de 2 000 h (6 000 h).', url: 'https://www.ccq.org/-/media/Project/Ccq/Ccq-Website/PDF/Attraction/3647_CCQ_Fiche_metier_Charpentier-menuisier_2025.pdf' },
    { texte: 'DEP en charpenterie-menuiserie : 2 025 h de crédits, plafond de 4 200 h.', url: 'https://www.ccq.org/annexes/credits-heures' },
    { texte: 'Un crédit de formation est « automatiquement placé en réserve à la dernière période » du carnet ; pour le devancer, appeler la CCQ au 1 888 842-8282. La FAQ ne nomme pas le DEP : à confirmer dans ton dossier.', url: 'https://fiersetcompetents.ccq.org/fr-ca/faq' },
    { texte: 'Les heures du carnet sont celles que l\'employeur déclare à la CCQ ; un avis est posté à 1 600 h ; au changement de période, l\'employeur doit ajuster le taux, rétroactivement s\'il a tardé.', url: 'https://www.ccq.org/fr-CA/qualification-acces-industrie/certificat-competence/apprenti' },
  ],
  aVerifier: 'Aucune source lue ne dit si une heure supplémentaire compte pour plus d\'une heure au carnet. L\'app compte 1 h travaillée = 1 h (réglable). À valider : comparer une semaine avec heures supplémentaires à ton relevé CCQ, ou appeler la CCQ.',
};
