// Outils de dates et d'heures. Fonctions pures, utilisées par l'app et par les tests.
// Les dates sont des chaînes 'AAAA-MM-JJ', les heures des chaînes 'HH:MM' (24 h).

export const FUSEAU = 'America/Toronto';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function hhmmEnMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesEnHhmm(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 630 -> « 10 h 30 », 600 -> « 10 h »
export function formatDuree(minutes) {
  const signe = minutes < 0 ? '−' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${signe}${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}`;
}

// 630 -> « 10,50 »
export function formatHeuresDecimales(minutes) {
  return (minutes / 60).toFixed(2).replace('.', ',');
}

function versUTC(dateISO) {
  const [a, m, j] = dateISO.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

function depuisUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ajouterJours(dateISO, n) {
  return depuisUTC(versUTC(dateISO) + n * 86400000);
}

export function ecartJours(a, b) {
  return Math.round((versUTC(b) - versUTC(a)) / 86400000);
}

// 0 = dimanche … 6 = samedi
export function jourSemaine(dateISO) {
  return new Date(versUTC(dateISO)).getUTCDay();
}

export function nomJour(dateISO, court = false) {
  return (court ? JOURS_COURTS : JOURS)[jourSemaine(dateISO)];
}

export function formatDate(dateISO, { annee = false, jour = true } = {}) {
  const [a, m, j] = dateISO.split('-').map(Number);
  const base = `${j === 1 ? '1er' : j} ${MOIS[m - 1]}${annee ? ' ' + a : ''}`;
  return jour ? `${nomJour(dateISO)} ${base}` : base;
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// '2026-11' ou '2026-11-15' -> « novembre » ; court : « nov. »
export function nomMois(dateISO, court = false) {
  return (court ? MOIS_COURTS : MOIS)[Number(dateISO.slice(5, 7)) - 1];
}

// Premier jour de la semaine qui contient la date. debutSemaine : 0 = dimanche, 1 = lundi.
export function debutDeSemaine(dateISO, debutSemaine = 0) {
  const recul = (jourSemaine(dateISO) - debutSemaine + 7) % 7;
  return ajouterJours(dateISO, -recul);
}

export function joursDeLaSemaine(debutISO) {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(debutISO, i));
}

export function aujourdhui(maintenant = new Date(), fuseau = FUSEAU) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
}

// Heure d'horloge (0 à 23) dans le fuseau, à un instant donné.
export function heureLocale(maintenant = new Date(), fuseau = FUSEAU) {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, hour: '2-digit', hourCycle: 'h23' }).format(maintenant));
}

// Décalage (minutes) entre l'heure locale du fuseau et UTC à un instant donné.
function decalageFuseau(instantMs, fuseau) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const v = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  const local = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return Math.round((local - instantMs) / 60000);
}

// Instant réel (ms UTC) d'une heure d'horloge locale, en tenant compte de l'heure d'été.
export function instantLocal(dateISO, minutesDepuisMinuit, fuseau = FUSEAU) {
  const mur = versUTC(dateISO) + minutesDepuisMinuit * 60000;
  let instant = mur - decalageFuseau(mur, fuseau) * 60000;
  instant = mur - decalageFuseau(instant, fuseau) * 60000;
  return instant;
}

// Durée d'un quart, en minutes.
// - fin <= début : le quart passe minuit et se termine le lendemain.
// - la pause (non payée) est soustraite.
// - `reelles` tient compte du changement d'heure (une nuit de 23 h ou de 25 h).
export function dureeQuart({ date, debut, fin, pauseMin = 0 }, fuseau = FUSEAU) {
  const d = hhmmEnMinutes(debut);
  const f = hhmmEnMinutes(fin);
  if (d === null || f === null) return null;
  const passeMinuit = f <= d;
  const horloge = (passeMinuit ? f + 1440 : f) - d;
  const reelles = Math.round((instantLocal(passeMinuit ? ajouterJours(date, 1) : date, f, fuseau) - instantLocal(date, d, fuseau)) / 60000);
  const pause = Math.max(0, Number(pauseMin) || 0);
  return {
    passeMinuit,
    brutes: reelles,
    ajustementHeure: reelles - horloge,
    travaillees: Math.max(0, reelles - pause),
  };
}
