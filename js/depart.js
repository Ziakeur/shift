// Configuration de départ (écran de bienvenue) et salutation de l'accueil. Fonctions pures.
// Rien n'est obligatoire : une réponse vide ne change rien aux réglages.

import { profilPourDate, changerProfils } from './calcul.js';
import { hhmmEnMinutes } from './temps.js';

export const PRENOM_MAX = 30;
// L'horaire entré à la configuration de départ garde cet identifiant : la refaire le met à jour, sans doublon.
export const ID_HORAIRE_DEPART = 'horaire-depart';

export function nettoyerPrenom(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, PRENOM_MAX);
}

// Formule de l'accueil selon l'heure (0 à 23) et le jour (0 = dimanche … 6 = samedi), suivie du prénom s'il y en a un.
export function salutation(prenom, { heure, jour }) {
  let formule;
  if (heure >= 18 || heure < 4) formule = 'Bonsoir';
  else if (jour === 0 || jour === 6) formule = 'Bonne fin de semaine';
  else if (jour === 1 && heure < 12) formule = 'Bonne semaine';
  else if (jour === 5 && heure >= 12) formule = 'Bon vendredi';
  else if (heure < 12) formule = 'Bon matin';
  else formule = 'Bon après-midi';
  const nom = nettoyerPrenom(prenom);
  return nom ? `${formule}, ${nom}` : formule;
}

// Applique l'employeur, la convention et l'échelon choisis à la configuration de départ.
// Seuls les champs fournis et différents du réglage en cours comptent.
// - Aucune journée saisie : le réglage en cours est corrigé sur place (il n'y a pas de passé à protéger).
// - Des journées existent : le changement vaut à partir d'aujourd'hui, les journées d'avant gardent l'ancien réglage.
export function appliquerEmploi(profils, choix, { auj, aDesJours, creerId }) {
  const actif = profilPourDate(profils, auj);
  if (!actif) return profils;
  const changements = {};
  for (const cle of ['employeur', 'secteur', 'echelon']) {
    if (choix[cle] !== undefined && choix[cle] !== null && choix[cle] !== actif[cle]) changements[cle] = choix[cle];
  }
  if (!Object.keys(changements).length) return profils;
  if (!aDesJours) return profils.map((p) => (p.id === actif.id ? { ...p, ...changements } : p));
  return changerProfils(profils, changements, auj, creerId);
}

// Message d'erreur pour l'horaire habituel, ou null. Début et fin vides tous les deux : rien à enregistrer.
export function erreurHoraire({ debut, fin, pauseMin }) {
  if (!debut && !fin) return null;
  if (!debut || !fin) return 'Entre le début et la fin de ta journée, ou laisse les deux vides.';
  if (hhmmEnMinutes(debut) === null || hhmmEnMinutes(fin) === null) return 'Heure de début ou de fin illisible.';
  if (pauseMin !== null && pauseMin !== undefined && !(pauseMin >= 0)) return 'La pause ne peut pas être négative.';
  return null;
}

// Ajoute l'horaire habituel en tête des horaires (il sert à remplir une journée en un appui).
// Sans début ni fin, ou si un horaire identique existe déjà : la liste revient telle quelle.
export function appliquerHoraire(modeles, { debut, fin, pauseMin, jours }) {
  if (!debut || !fin) return modeles;
  const pause = Math.max(0, Number(pauseMin) || 0);
  const joursTries = [...(jours ?? [])].sort((a, b) => a - b);
  const existant = modeles.find((m) => m.id === ID_HORAIRE_DEPART);
  if (existant) {
    return modeles.map((m) => (m.id === ID_HORAIRE_DEPART ? { ...m, debut, fin, pauseMin: pause, jours: joursTries } : m));
  }
  if (modeles.some((m) => m.debut === debut && m.fin === fin && (m.pauseMin ?? 0) === pause)) return modeles;
  return [{ id: ID_HORAIRE_DEPART, nom: 'Mon horaire', debut, fin, pauseMin: pause, jours: joursTries }, ...modeles];
}
