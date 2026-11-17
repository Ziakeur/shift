import test from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerPrenom, salutation, appliquerEmploi, erreurHoraire, appliquerHoraire, ID_HORAIRE_DEPART, PRENOM_MAX } from '../js/depart.js';
import { heureLocale } from '../js/temps.js';
import { FONDS } from '../js/decor.js';

const profil = (extra = {}) => ({ id: 'p1', dateEffet: '2025-01-01', employeur: '', secteur: 'ic', isole: false, gite: false, echelon: 'app1', tauxPerso: null, regles: null, vacancesPct: 13, ...extra });
const creerId = () => 'nouveau';

test('prénom : espaces retirés, longueur limitée, vide accepté', () => {
  assert.equal(nettoyerPrenom('  Alex  '), 'Alex');
  assert.equal(nettoyerPrenom('Jean   Marc'), 'Jean Marc');
  assert.equal(nettoyerPrenom(''), '');
  assert.equal(nettoyerPrenom(null), '');
  assert.equal(nettoyerPrenom(undefined), '');
  assert.equal(nettoyerPrenom('x'.repeat(80)).length, PRENOM_MAX);
});

test('salutation : formule selon l\'heure et le jour, avec ou sans prénom', () => {
  assert.equal(salutation('Alex', { heure: 7, jour: 2 }), 'Bon matin, Alex');
  assert.equal(salutation('Alex', { heure: 14, jour: 3 }), 'Bon après-midi, Alex');
  assert.equal(salutation('Alex', { heure: 19, jour: 3 }), 'Bonsoir, Alex');
  assert.equal(salutation('Alex', { heure: 2, jour: 3 }), 'Bonsoir, Alex');
  assert.equal(salutation('Alex', { heure: 6, jour: 1 }), 'Bonne semaine, Alex');
  assert.equal(salutation('Alex', { heure: 13, jour: 1 }), 'Bon après-midi, Alex');
  assert.equal(salutation('Alex', { heure: 9, jour: 5 }), 'Bon matin, Alex');
  assert.equal(salutation('Alex', { heure: 15, jour: 5 }), 'Bon vendredi, Alex');
  assert.equal(salutation('Alex', { heure: 10, jour: 6 }), 'Bonne fin de semaine, Alex');
  assert.equal(salutation('Alex', { heure: 10, jour: 0 }), 'Bonne fin de semaine, Alex');
  assert.equal(salutation('Alex', { heure: 20, jour: 6 }), 'Bonsoir, Alex');
  assert.equal(salutation('', { heure: 7, jour: 2 }), 'Bon matin');
  assert.equal(salutation('  ', { heure: 7, jour: 2 }), 'Bon matin');
});

test('heure locale : suit le fuseau de Toronto, été comme hiver', () => {
  assert.equal(heureLocale(new Date('2026-11-17T12:30:00Z')), 7);  // heure normale, UTC−5
  assert.equal(heureLocale(new Date('2026-07-02T03:30:00Z')), 23); // heure d'été, UTC−4
  assert.equal(heureLocale(new Date('2026-07-02T04:10:00Z')), 0);
});

test('emploi de départ : rien de fourni ou rien de différent, la liste ne bouge pas', () => {
  const profils = [profil()];
  assert.equal(appliquerEmploi(profils, {}, { auj: '2026-11-17', aDesJours: false, creerId }), profils);
  assert.equal(appliquerEmploi(profils, { secteur: 'ic', echelon: 'app1', employeur: '' }, { auj: '2026-11-17', aDesJours: true, creerId }), profils);
});

test('emploi de départ : sans journée saisie, le réglage en cours est corrigé sur place', () => {
  const profils = [profil()];
  const res = appliquerEmploi(profils, { employeur: 'Toitures Démo', secteur: 'res-leger', echelon: 'app2' }, { auj: '2026-11-17', aDesJours: false, creerId });
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], profil({ employeur: 'Toitures Démo', secteur: 'res-leger', echelon: 'app2' }));
  assert.equal(profils[0].secteur, 'ic', 'la liste d\'origine n\'est pas modifiée');
});

test('emploi de départ : avec des journées, le changement vaut à partir d\'aujourd\'hui et le passé reste', () => {
  const profils = [profil()];
  const res = appliquerEmploi(profils, { secteur: 'res-leger', echelon: 'app1' }, { auj: '2026-11-17', aDesJours: true, creerId });
  assert.equal(res.length, 2);
  assert.deepEqual(res[0], profil());
  assert.deepEqual(res[1], profil({ id: 'nouveau', dateEffet: '2026-11-17', secteur: 'res-leger' }));
  // Un deuxième changement le même jour complète la même période, sans en créer une autre.
  const encore = appliquerEmploi(res, { echelon: 'app3' }, { auj: '2026-11-17', aDesJours: true, creerId });
  assert.equal(encore.length, 2);
  assert.equal(encore[1].echelon, 'app3');
  assert.equal(encore[0].echelon, 'app1');
});

test('horaire de départ : contrôle de la saisie', () => {
  assert.equal(erreurHoraire({ debut: '', fin: '', pauseMin: null }), null);
  assert.equal(erreurHoraire({ debut: '07:00', fin: '15:30', pauseMin: 30 }), null);
  assert.equal(erreurHoraire({ debut: '22:00', fin: '06:00', pauseMin: 0 }), null, 'quart qui passe minuit accepté');
  assert.match(erreurHoraire({ debut: '07:00', fin: '', pauseMin: 30 }), /début et la fin/);
  assert.match(erreurHoraire({ debut: '', fin: '15:30', pauseMin: 30 }), /début et la fin/);
  assert.match(erreurHoraire({ debut: '07:00', fin: '15:30', pauseMin: -5 }), /pause/);
});

test('horaire de départ : ajouté en tête, mis à jour sans doublon, ignoré s\'il existe déjà', () => {
  const modeles = [{ id: 'a', nom: '8 h de jour', debut: '07:00', fin: '15:30', pauseMin: 30, jours: [1, 2, 3, 4, 5] }];
  assert.equal(appliquerHoraire(modeles, { debut: '', fin: '', pauseMin: 30, jours: [1] }), modeles);
  assert.equal(appliquerHoraire(modeles, { debut: '07:00', fin: '15:30', pauseMin: 30, jours: [1, 2] }), modeles, 'même horaire qu\'un horaire existant');

  const avec = appliquerHoraire(modeles, { debut: '06:30', fin: '17:00', pauseMin: 30, jours: [4, 1, 3, 2] });
  assert.equal(avec.length, 2);
  assert.deepEqual(avec[0], { id: ID_HORAIRE_DEPART, nom: 'Mon horaire', debut: '06:30', fin: '17:00', pauseMin: 30, jours: [1, 2, 3, 4] });
  assert.equal(avec[1], modeles[0]);

  const renomme = avec.map((m) => (m.id === ID_HORAIRE_DEPART ? { ...m, nom: 'Semaine de 4 jours' } : m));
  const refait = appliquerHoraire(renomme, { debut: '07:00', fin: '17:30', pauseMin: null, jours: [1, 2, 3, 4] });
  assert.equal(refait.length, 2);
  assert.deepEqual(refait[0], { id: ID_HORAIRE_DEPART, nom: 'Semaine de 4 jours', debut: '07:00', fin: '17:30', pauseMin: 0, jours: [1, 2, 3, 4] });
});

test('fonds de l\'app : six choix, clés uniques, « plan » et « uni » toujours là', () => {
  const cles = FONDS.map(([cle]) => cle);
  assert.equal(new Set(cles).size, cles.length);
  assert.ok(cles.includes('plan') && cles.includes('uni'));
  assert.equal(cles.length, 6);
  for (const [cle, nom] of FONDS) assert.ok(/^[a-z]+$/.test(cle) && nom.length > 0, cle);
});
