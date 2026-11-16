// Fabrique une sauvegarde de démonstration : sauvegarde-fictive.json (jamais commitée, voir .gitignore).
// Tout est inventé : employeur, chantiers, heures, montants nets. Aucune donnée réelle.
// PowerShell, dans le dossier du projet :
//   node tools/donnees-fictives.mjs
// Puis dans l'app : Réglages, Sauvegarde, « Restaurer une sauvegarde », choisir le fichier.
// Attention : restaurer REMPLACE les données de l'app. Sauvegarder les vraies données avant.
import { writeFileSync } from 'node:fs';
import { calculerSemaine } from '../js/calcul.js';
import { fusionnerGrilles, FERIES } from '../js/grilles.js';
import { ajouterJours, jourSemaine, aujourdhui } from '../js/temps.js';

const DEBUT = '2025-09-07'; // un dimanche
const FIN = aujourdhui();

// Tirage « au hasard » mais toujours le même d'une fois à l'autre.
const hasard = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

const chantiers = [
  { id: 'ch-1', nom: 'Maisons en rangée du Coteau', adresse: '120, rue des Exemples', ville: 'Ville-Fictive' },
  { id: 'ch-2', nom: 'Duplex rue des Érables', adresse: '48, rue des Érables', ville: 'Saint-Exemple' },
  { id: 'ch-3', nom: 'Agrandissement chalet du Lac', adresse: '7, chemin du Lac', ville: 'Lac-Inventé' },
  { id: 'ch-4', nom: 'Immeuble à logements Bellevue', adresse: '300, boulevard Bellevue', ville: 'Ville-Fictive' },
  { id: 'ch-5', nom: 'Rénovation toiture école (démo)', adresse: '15, rue de l\'École', ville: 'Saint-Exemple' },
];
// Semaines sans travail : congés de la construction (hiver, été) et une semaine creuse.
const SEMAINES_VIDES = new Set(['2025-12-21', '2025-12-28', '2026-03-08', '2026-07-19', '2026-07-26']);

const jours = [];
const debutsSemaines = [];
for (let debut = DEBUT, s = 0; debut <= FIN; debut = ajouterJours(debut, 7), s++) {
  debutsSemaines.push(debut);
  if (SEMAINES_VIDES.has(debut)) continue;
  const chantierId = chantiers[Math.floor(s / 9) % chantiers.length].id;
  const longue = s % 3 === 1;                 // une semaine sur trois : quatre journées de 10 h
  const samedi = hasard(s + 500) < 0.14;      // un samedi de temps en temps
  for (let k = 0; k < 7; k++) {
    const date = ajouterJours(debut, k);
    if (date > FIN) break;
    const jour = jourSemaine(date);
    if (jour === 0) continue;
    if (jour === 6 && !samedi) continue;
    if (FERIES.includes(date)) continue;
    if (longue && jour === 5) continue;
    const recent = date >= ajouterJours(FIN, -10);                     // les derniers jours sont toujours remplis, aujourd'hui compris
    if (!recent && jour >= 1 && jour <= 5 && hasard(s * 7 + k) < 0.06) continue; // journée manquée (pluie, congé)
    const fin = jour === 6 ? '12:00' : longue ? '17:30' : hasard(s * 7 + k + 99) < 0.12 ? '16:30' : '15:30';
    jours.push({ date, debut: '07:00', fin, pauseMin: jour === 6 ? 0 : 30, chantierId, note: '' });
  }
}

const reglages = {
  debutSemaine: 0,
  theme: 'sombre',
  ecranOuverture: 'accueil',
  profils: [
    { id: 'pr-1', dateEffet: '2025-01-01', employeur: 'Constructions Exemple inc. (fictif)', secteur: 'res-leger', isole: false, gite: false, echelon: 'app1', tauxPerso: null, regles: null, vacancesPct: 13 },
    { id: 'pr-2', dateEffet: '2026-06-28', employeur: 'Constructions Exemple inc. (fictif)', secteur: 'res-leger', isole: false, gite: false, echelon: 'app2', tauxPerso: null, regles: null, vacancesPct: 13 },
  ],
  modeles: [
    { id: 'mo-1', nom: '8 h de jour', debut: '07:00', fin: '15:30', pauseMin: 30, jours: [1, 2, 3, 4, 5] },
    { id: 'mo-2', nom: '10 h de jour', debut: '07:00', fin: '17:30', pauseMin: 30, jours: [1, 2, 3, 4] },
  ],
  chantiers,
  primes: [],
  feries: [...FERIES],
  grillesPerso: [],
  carnet: { heuresDepart: null, dateDepart: null, credits: null, creditsUtilises: 0, facteurSupp: 1 },
  declarations: [],
  sauvegarde: { dernierExport: new Date().toISOString(), rappelJours: 7 },
};

// Talons : un net inventé (environ les trois quarts du brut estimé) pour la plupart des semaines passées.
// Ce n'est PAS une estimation des déductions : juste de quoi dessiner la courbe du net.
const saisies = new Map(jours.map((j) => [j.date, j]));
const grilles = fusionnerGrilles([]);
const semaines = [];
debutsSemaines.forEach((debut, s) => {
  const sem = calculerSemaine(debut, saisies, reglages, grilles);
  if (!sem.minutesTotal || ajouterJours(debut, 13) > FIN) return; // les deux dernières semaines : talon pas encore reçu
  if (hasard(s + 900) < 0.1) return;                               // un talon pas encore saisi, ici et là
  const net = Math.round(sem.brut * (0.73 + hasard(s + 300) * 0.03) * 100) / 100;
  const ecart = hasard(s + 700) < 0.08 ? -Math.round(sem.brut * 0.03 * 100) / 100 : 0; // parfois le talon ne colle pas
  semaines.push({ debut, brutReel: Math.round((sem.brut + ecart) * 100) / 100, netReel: net, note: '' });
});

const sauvegarde = { format: 'suivi-heures-chantier', versionFormat: 1, app: 'données fictives', exporteLe: new Date().toISOString(), jours, semaines, reglages };
writeFileSync('sauvegarde-fictive.json', JSON.stringify(sauvegarde, null, 1));
console.log(`sauvegarde-fictive.json : ${jours.length} journées, ${semaines.length} talons, ${chantiers.length} chantiers, du ${jours[0].date} au ${jours.at(-1).date}`);
