// État de l'app en mémoire, chargé une fois au démarrage, et écritures vers IndexedDB.

import * as db from './db.js';
import { APP } from './config.js';
import { FERIES, VACANCES_PCT, fusionnerGrilles } from './grilles.js';
import { calculerSemaine } from './calcul.js';
import { aujourdhui, debutDeSemaine, nomJour, formatHeuresDecimales } from './temps.js';

export const FORMAT = 'suivi-heures-chantier';
export const VERSION_FORMAT = 1;

export const etat = {
  jours: new Map(),
  semaines: new Map(),
  reglages: null,
  grilles: [],
};

export function nouvelId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function reglagesParDefaut() {
  return {
    debutSemaine: 0,
    theme: 'sombre',
    profils: [{
      id: nouvelId(), dateEffet: '2025-01-01', employeur: '', secteur: 'ic', isole: false, gite: false,
      echelon: 'app1', tauxPerso: null, regles: null, vacancesPct: VACANCES_PCT,
    }],
    modeles: [
      { id: nouvelId(), nom: '10 h de jour', debut: '07:00', fin: '17:30', pauseMin: 30, jours: [1, 2, 3, 4] },
      { id: nouvelId(), nom: '8 h de jour', debut: '07:00', fin: '15:30', pauseMin: 30, jours: [1, 2, 3, 4, 5] },
    ],
    chantiers: [],
    primes: [],
    feries: [...FERIES],
    grillesPerso: [],
    carnet: { heuresDepart: null, dateDepart: null, credits: null, creditsMode: 'fin', facteurSupp: 1 },
    declarations: [],
    sauvegarde: { dernierExport: null, rappelJours: 7 },
  };
}

// Complète des réglages anciens ou importés avec les champs apparus depuis.
function normaliser(r) {
  const d = reglagesParDefaut();
  const out = { ...d, ...(r ?? {}) };
  out.carnet = { ...d.carnet, ...(r?.carnet ?? {}) };
  out.sauvegarde = { ...d.sauvegarde, ...(r?.sauvegarde ?? {}) };
  for (const cle of ['profils', 'modeles', 'chantiers', 'primes', 'feries', 'grillesPerso', 'declarations']) {
    if (!Array.isArray(out[cle])) out[cle] = d[cle];
  }
  if (!out.profils.length) out.profils = d.profils;
  return out;
}

export async function charger() {
  const [jours, semaines, reglages] = await Promise.all([db.lireTout('jours'), db.lireTout('semaines'), db.lireCle('kv', 'reglages')]);
  etat.jours = new Map(jours.map((j) => [j.date, j]));
  etat.semaines = new Map(semaines.map((s) => [s.debut, s]));
  etat.reglages = normaliser(reglages);
  etat.grilles = fusionnerGrilles(etat.reglages.grillesPerso);
  if (!reglages) await db.ecrire('kv', etat.reglages, 'reglages');
}

export async function enregistrerJour(jour) {
  etat.jours.set(jour.date, jour);
  await db.ecrire('jours', jour);
}

export async function supprimerJour(date) {
  etat.jours.delete(date);
  await db.supprimer('jours', date);
}

export async function enregistrerSemaine(semaine) {
  etat.semaines.set(semaine.debut, semaine);
  await db.ecrire('semaines', semaine);
}

// Modifie les réglages puis les enregistre : majReglages((r) => { r.theme = 'clair'; })
export async function majReglages(modifier) {
  modifier(etat.reglages);
  etat.grilles = fusionnerGrilles(etat.reglages.grillesPerso);
  await db.ecrire('kv', etat.reglages, 'reglages');
}

export function semaine(debut) {
  return calculerSemaine(debut, etat.jours, etat.reglages, etat.grilles);
}

export function debutSemaine(date) {
  return debutDeSemaine(date, etat.reglages.debutSemaine);
}

// Toutes les semaines qui contiennent au moins une fiche, calculées, de la plus ancienne à la plus récente.
export function toutesLesSemaines() {
  const debuts = new Set([...etat.jours.keys()].map((d) => debutSemaine(d)));
  return [...debuts].sort().map((d) => semaine(d));
}

// Dernière fiche avec des heures avant une date (pour « comme hier » et « même chantier »).
export function dernierJourAvant(date, { avecHeures = true } = {}) {
  let trouve = null;
  for (const [d, j] of etat.jours) {
    if (d >= date) continue;
    if (avecHeures && !(j.debut && j.fin)) continue;
    if (!trouve || d > trouve.date) trouve = j;
  }
  return trouve;
}

export function chantier(id) {
  return etat.reglages.chantiers.find((c) => c.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Sauvegarde et restauration

export function exporterJSON() {
  return {
    format: FORMAT,
    versionFormat: VERSION_FORMAT,
    app: APP.version,
    exporteLe: new Date().toISOString(),
    jours: [...etat.jours.values()].sort((a, b) => a.date.localeCompare(b.date)),
    semaines: [...etat.semaines.values()].sort((a, b) => a.debut.localeCompare(b.debut)),
    reglages: etat.reglages,
  };
}

// Vérifie une sauvegarde avant de l'accepter. Lance une erreur lisible si elle n'est pas valide.
export function validerSauvegarde(donnees) {
  if (!donnees || typeof donnees !== 'object' || donnees.format !== FORMAT) {
    throw new Error('Ce fichier n\'est pas une sauvegarde de cette application.');
  }
  if (donnees.versionFormat > VERSION_FORMAT) {
    throw new Error('Cette sauvegarde vient d\'une version plus récente de l\'application. Mets l\'application à jour, puis réessaie.');
  }
  if (!Array.isArray(donnees.jours) || !Array.isArray(donnees.semaines) || typeof donnees.reglages !== 'object') {
    throw new Error('Sauvegarde incomplète : jours, semaines ou réglages manquants.');
  }
  const dateOk = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!donnees.jours.every((j) => j && dateOk(j.date))) throw new Error('Sauvegarde abîmée : une journée n\'a pas de date valide.');
  if (!donnees.semaines.every((s) => s && dateOk(s.debut))) throw new Error('Sauvegarde abîmée : une semaine n\'a pas de date valide.');
  return { jours: donnees.jours, semaines: donnees.semaines, reglages: normaliser(donnees.reglages) };
}

export async function importerJSON(donnees) {
  const propre = validerSauvegarde(donnees);
  await db.remplacerTout(propre);
  await charger();
  return { jours: propre.jours.length, semaines: propre.semaines.length };
}

function champCSV(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV lisible dans Excel en français : séparateur « ; », virgule décimale, BOM UTF-8.
export function exporterCSV() {
  const entete = ['Date', 'Jour', 'Début', 'Fin', 'Pause (min)', 'Heures', 'Temps simple', 'Temps et demi', 'Temps double', 'Autre majoration', 'Taux horaire', 'Montant estimé', 'Férié', 'Chantier', 'Ville', 'Note'];
  const lignes = [entete];
  const nb = (x) => (typeof x === 'number' ? x.toFixed(2).replace('.', ',') : '');
  for (const sem of toutesLesSemaines()) {
    for (const j of sem.jours) {
      if (!j.saisie) continue;
      const min = (m) => j.tranches.filter((t) => m(t.mult)).reduce((s, t) => s + t.minutes, 0);
      const ch = chantier(j.saisie.chantierId);
      lignes.push([
        j.date, nomJour(j.date), j.saisie.debut ?? '', j.saisie.fin ?? '', j.saisie.pauseMin ?? 0,
        formatHeuresDecimales(j.minutes),
        formatHeuresDecimales(min((m) => m === 1)), formatHeuresDecimales(min((m) => m === 1.5)), formatHeuresDecimales(min((m) => m === 2)),
        formatHeuresDecimales(min((m) => ![1, 1.5, 2].includes(m))),
        nb(j.taux), nb(j.montant), j.ferie ? 'oui' : '', ch?.nom ?? '', ch?.ville ?? '', j.saisie.note ?? '',
      ]);
    }
  }
  return '﻿' + lignes.map((l) => l.map(champCSV).join(';')).join('\r\n') + '\r\n';
}

export function joursDepuisSauvegarde(maintenant = new Date()) {
  const dernier = etat.reglages.sauvegarde.dernierExport;
  if (!dernier) return null;
  return Math.floor((maintenant.getTime() - new Date(dernier).getTime()) / 86400000);
}

export function sauvegardeEnRetard() {
  if (!etat.jours.size) return false;
  const n = joursDepuisSauvegarde();
  return n === null || n >= (etat.reglages.sauvegarde.rappelJours || 7);
}

export { aujourdhui };
