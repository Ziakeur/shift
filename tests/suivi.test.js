import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSemaine } from '../js/calcul.js';
import { GRILLES } from '../js/grilles.js';
import { joursVentiles, joursOublies, periodeVacances, paiesVacances, releve } from '../js/recap.js';

const profil = (extra = {}) => ({ id: 'p1', dateEffet: '2025-01-01', secteur: 'ic', isole: false, echelon: 'app1', tauxPerso: 30, regles: null, vacancesPct: 13, ...extra });
const quart = (extra = {}) => ({ debut: '07:00', fin: '15:30', pauseMin: 30, ...extra });
const semaine = (debut, saisies, reglages = {}) => calculerSemaine(debut, saisies, { profils: [profil()], primes: [], feries: [], ...reglages }, GRILLES);

// ----- Primes à cocher -----

const repas = { id: 'r', nom: 'Repas', montant: 17, unite: 'jour', dansSalaire: false, aCocher: true };

test('prime à cocher : comptée seulement les jours cochés', () => {
  const s = semaine('2026-11-15', {
    '2026-11-16': quart({ primes: ['r'] }),
    '2026-11-17': quart(),
    '2026-11-18': quart({ primes: ['r'] }),
  }, { primes: [repas] });
  const l = s.lignesPrimes.find((p) => p.id === 'r');
  assert.equal(l.quantite, 2);
  assert.equal(l.montant, 34);
  assert.equal(s.indemnites, 34);
});

test('prime à cocher : comptée même un jour sans heures', () => {
  const s = semaine('2026-11-15', { '2026-11-16': quart(), '2026-11-21': { primes: ['r'] } }, { primes: [repas] });
  assert.equal(s.lignesPrimes[0].quantite, 1);
});

test('prime ordinaire : inchangée, comptée tous les jours travaillés', () => {
  const pension = { id: 'p', nom: 'Pension', montant: 50, unite: 'jour', dansSalaire: false };
  const s = semaine('2026-11-15', { '2026-11-16': quart(), '2026-11-17': quart(), '2026-11-18': { note: 'pluie', absence: 'intemperie' } }, { primes: [pension] });
  assert.equal(s.lignesPrimes[0].quantite, 2);
});

test('prime à cocher : le filtre de chantier et les dates s\'appliquent', () => {
  const p = { ...repas, chantierId: 'A', debut: '2026-11-17' };
  const s = semaine('2026-11-15', {
    '2026-11-16': quart({ primes: ['r'], chantierId: 'A' }),
    '2026-11-17': quart({ primes: ['r'], chantierId: 'B' }),
    '2026-11-18': quart({ primes: ['r'], chantierId: 'A' }),
  }, { primes: [p] });
  assert.equal(s.lignesPrimes[0].quantite, 1);
});

test('ventilation : une prime salariale cochée dans une semaine sans heures n\'est pas perdue', () => {
  const prime = { id: 'x', nom: 'Prime', montant: 40, unite: 'jour', dansSalaire: true, aCocher: true };
  const s = semaine('2026-11-15', { '2026-11-16': { primes: ['x'] }, '2026-11-17': { primes: ['x'] } }, { primes: [prime] });
  assert.equal(s.brut, 80);
  const jours = joursVentiles(s);
  assert.deepEqual(jours.map((j) => j.brutCents), [4000, 4000]);
});

// ----- Jours oubliés -----

const fiches = (obj) => new Map(Object.entries(obj).map(([date, j]) => [date, { date, ...j }]));

test('jours oubliés : jours de semaine vides, du plus ancien au plus récent, aujourd\'hui exclu', () => {
  // Lundi 9 au vendredi 13 novembre 2026, puis lundi 16 et mardi 17 (aujourd'hui).
  const saisies = fiches({ '2026-11-09': quart(), '2026-11-11': quart(), '2026-11-13': { debut: '07:00' } });
  const r = joursOublies(saisies, { auj: '2026-11-17' });
  assert.deepEqual(r, [
    { date: '2026-11-10', incomplet: false },
    { date: '2026-11-12', incomplet: false },
    { date: '2026-11-13', incomplet: true },
    { date: '2026-11-16', incomplet: false },
  ]);
});

test('jours oubliés : un motif « pas travaillé » ou un férié ne sont pas signalés', () => {
  const saisies = fiches({ '2026-11-09': quart(), '2026-11-10': { absence: 'malade' }, '2026-11-12': { ferie: true } });
  const r = joursOublies(saisies, { auj: '2026-11-14', feries: ['2026-11-11'] });
  assert.deepEqual(r.map((x) => x.date), ['2026-11-13']);
});

test('jours oubliés : rien avant la première fiche, rien au-delà de la fenêtre, jours réglables', () => {
  const saisies = fiches({ '2026-10-01': quart() });
  const r = joursOublies(saisies, { auj: '2026-11-17', nbJours: 7 });
  assert.deepEqual(r.map((x) => x.date), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16']);
  const quatre = joursOublies(saisies, { auj: '2026-11-17', nbJours: 7, joursTravail: [1, 2, 3, 4] });
  assert.deepEqual(quatre.map((x) => x.date), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-16']);
  assert.deepEqual(joursOublies(fiches({ '2026-11-16': quart() }), { auj: '2026-11-17' }), []);
  assert.deepEqual(joursOublies(new Map(), { auj: '2026-11-17' }), []);
  assert.deepEqual(joursOublies(saisies, { auj: '2026-11-17', joursTravail: [] }), []);
});

// ----- Paies de vacances -----

test('vacances : semestres et dates de versement lus dans les conventions', () => {
  assert.deepEqual(periodeVacances('2026-06-30'), { cle: '2026-1', debut: '2026-01-01', fin: '2026-06-30', versement: { du: '2026-11-23', au: '2026-11-30' } });
  assert.deepEqual(periodeVacances('2026-07-01'), { cle: '2026-2', debut: '2026-07-01', fin: '2026-12-31', versement: { du: '2027-06-23', au: '2027-06-30' } });
});

test('vacances : une semaine à cheval sur le 30 juin est partagée jour par jour', () => {
  // Semaine du dimanche 28 juin 2026 : lundi 29 et mardi 30 juin, mercredi 1er juillet.
  const s = semaine('2026-06-28', { '2026-06-29': quart(), '2026-06-30': quart(), '2026-07-01': quart() });
  const r = paiesVacances([s], '2026-11-17');
  // 8 h × 30 $ = 240 $ par jour ; 13 % = 31,20 $.
  assert.deepEqual(r.map((p) => [p.cle, p.montant, p.statut]), [['2026-2', 31.2, 'en-cours'], ['2026-1', 62.4, 'a-venir']]);
});

test('vacances : statut selon la date du jour', () => {
  const s = semaine('2026-03-01', { '2026-03-02': quart() });
  assert.equal(paiesVacances([s], '2026-06-30')[0].statut, 'en-cours');
  assert.equal(paiesVacances([s], '2026-11-30')[0].statut, 'a-venir');
  assert.equal(paiesVacances([s], '2026-12-01')[0].statut, 'versee');
});

test('vacances : le pourcentage de la semaine est appliqué', () => {
  const s = calculerSemaine('2026-03-01', { '2026-03-02': quart() }, { profils: [profil({ vacancesPct: 10 })], primes: [], feries: [] }, GRILLES);
  assert.equal(paiesVacances([s], '2026-03-10')[0].montant, 24);
});

// ----- Relevé -----

test('relevé : seulement les jours de la période, talon si la semaine s\'y termine', () => {
  const chantiers = [{ id: 'A', nom: 'École', adresse: '1 rue X', ville: 'Laval' }];
  const s1 = semaine('2026-11-01', { '2026-11-02': quart({ chantierId: 'A' }), '2026-11-03': quart(), '2026-11-04': { absence: 'intemperie', note: 'pluie' } });
  const s2 = semaine('2026-11-08', { '2026-11-09': quart({ primes: ['r'] }), '2026-11-10': quart() }, { primes: [repas] });
  const talons = new Map([['2026-11-01', { brutReel: 480, netReel: 380 }], ['2026-11-08', { brutReel: 480, netReel: 370 }]]);
  const r = releve([s2, s1], { du: '2026-11-03', au: '2026-11-09', talons, chantiers, primes: [repas] });
  assert.deepEqual(r.semaines.map((s) => s.jours.map((j) => j.date)), [['2026-11-03', '2026-11-04'], ['2026-11-09']]);
  assert.deepEqual(r.semaines[0].talon, { brutReel: 480, netReel: 380 });
  assert.equal(r.semaines[1].talon, null);
  assert.equal(r.semaines[0].jours[1].absence, 'intemperie');
  assert.equal(r.semaines[0].jours[1].pauseMin, 0);
  assert.deepEqual(r.semaines[1].jours[0].primes, ['Repas']);
  assert.equal(r.total.minutes, 2 * 480);
  assert.equal(r.total.brut, 480);
  assert.equal(r.total.joursTravailles, 2);
  assert.deepEqual(r.total.absences, { intemperie: 1 });
  assert.equal(r.total.net, 380);
  assert.equal(r.total.netNb, 1);
});

test('relevé : chantier avec son lieu', () => {
  const chantiers = [{ id: 'A', nom: 'École', adresse: '1 rue X', ville: 'Laval' }];
  const s = semaine('2026-11-01', { '2026-11-02': quart({ chantierId: 'A' }) });
  const r = releve([s], { du: '2026-11-01', au: '2026-11-30', chantiers });
  assert.deepEqual(r.semaines[0].jours[0].chantier, { nom: 'École', lieu: '1 rue X, Laval' });
});
