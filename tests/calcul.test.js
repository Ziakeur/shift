import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSemaine, classerSemaine, profilPourDate, tauxDuProfil } from '../js/calcul.js';
import { GRILLES, fusionnerGrilles, grillePourDate, prereglage, ECHELONS } from '../js/grilles.js';
import { joursDeLaSemaine } from '../js/temps.js';

const profil = (extra = {}) => ({ id: 'p1', dateEffet: '2025-01-01', secteur: 'ic', isole: false, echelon: 'app1', tauxPerso: null, regles: null, vacancesPct: 13, ...extra });
const quart = (debut = '07:00', fin = '17:30', pauseMin = 30, extra = {}) => ({ debut, fin, pauseMin, ...extra });
const h = (semaine, mult) => (semaine.totaux.find((t) => t.mult === mult)?.minutes ?? 0) / 60;

// Semaine du dimanche 15 au samedi 21 novembre 2026.
const DIM = '2026-11-15';
const [, LUN, MAR, MER, JEU, VEN, SAM] = joursDeLaSemaine(DIM);

function semaine(saisies, reglages = {}, debut = DIM) {
  return calculerSemaine(debut, saisies, { profils: [profil()], primes: [], feries: [], ...reglages }, GRILLES);
}

test('grilles : toutes ont une date, une source et les quatre échelons', () => {
  for (const g of GRILLES) {
    assert.match(g.dateEffet, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(g.source && g.url, `source manquante : ${g.secteur} ${g.dateEffet}`);
    for (const e of Object.keys(ECHELONS)) assert.equal(typeof g.taux[e], 'number');
    assert.ok(g.taux.app1 < g.taux.app2 && g.taux.app2 < g.taux.app3 && g.taux.app3 < g.taux.compagnon);
  }
});

test('grilles : valeurs lues sur les sources', () => {
  assert.deepEqual(grillePourDate(GRILLES, 'ic', false, '2026-11-16').taux, { compagnon: 50.16, app1: 30.10, app2: 35.11, app3: 42.64 });
  assert.deepEqual(grillePourDate(GRILLES, 'ic', true, '2026-11-16').taux, { compagnon: 52.59, app1: 31.55, app2: 36.81, app3: 44.70 });
  assert.equal(grillePourDate(GRILLES, 'gcv', false, '2026-11-16').taux.app1, 30.14);
  assert.equal(grillePourDate(GRILLES, 'res-leger', false, '2026-11-16').taux.app1, 27.45);
  assert.equal(grillePourDate(GRILLES, 'res-lourd', false, '2026-11-16').taux.app1, 29.77);
  assert.equal(grillePourDate(GRILLES, 'industriel', false, '2027-04-24').taux.app1, 30.10);
  assert.equal(grillePourDate(GRILLES, 'industriel', false, '2027-04-25').taux.app1, 31.60);
});

test('grilles : rien d\'inventé quand la grille n\'existe pas', () => {
  assert.equal(grillePourDate(GRILLES, 'gcv', true, '2026-11-16'), null);
  assert.equal(grillePourDate(GRILLES, 'ic', false, '2026-04-25'), null);
  assert.equal(tauxDuProfil(profil({ secteur: 'gcv', isole: true }), '2026-11-16', GRILLES).taux, null);
});

test('une grille saisie à la main remplace la grille intégrée de même date', () => {
  const grilles = fusionnerGrilles([{ secteur: 'ic', isole: false, dateEffet: '2026-04-26', taux: { compagnon: 51, app1: 31, app2: 36, app3: 43 } }]);
  assert.equal(grillePourDate(grilles, 'ic', false, '2026-11-16').taux.app1, 31);
  assert.equal(grilles.length, GRILLES.length);
});

test('taux personnalisé : remplace la grille', () => {
  assert.deepEqual(tauxDuProfil(profil({ tauxPerso: 33.5 }), '2026-11-16', GRILLES), { taux: 33.5, origine: 'perso', grille: null });
});

test('semaine normale : 4 jours de 10 h, tout en temps simple', () => {
  const s = semaine({ [LUN]: quart(), [MAR]: quart(), [MER]: quart(), [JEU]: quart() });
  assert.equal(s.minutesTotal, 2400);
  assert.equal(h(s, 1), 40);
  assert.equal(s.minutesMajorees, 0);
  assert.equal(s.brut, 1204);
  assert.equal(s.vacances, 156.52);
});

test('IC : dépassement du seuil par jour (12 h un lundi)', () => {
  const s = semaine({ [LUN]: quart('06:00', '18:30', 30) });
  assert.equal(h(s, 1), 10);
  assert.equal(h(s, 1.5), 1);
  assert.equal(h(s, 2), 1);
  assert.equal(s.brut, 406.35);
});

test('IC : dépassement du seuil par semaine (5 jours de 10 h)', () => {
  const s = semaine({ [LUN]: quart(), [MAR]: quart(), [MER]: quart(), [JEU]: quart(), [VEN]: quart() });
  assert.equal(h(s, 1), 40);
  assert.equal(h(s, 1.5), 1);
  assert.equal(h(s, 2), 9);
  assert.deepEqual(s.jours[5].tranches, [{ mult: 1.5, minutes: 60 }, { mult: 2, minutes: 540 }]);
});

test('IC : « 10 h, 6 jours » donne 40 h simples, 1 h à temps et demi, 19 h à temps double', () => {
  const s = semaine({ [LUN]: quart(), [MAR]: quart(), [MER]: quart(), [JEU]: quart(), [VEN]: quart(), [SAM]: quart() });
  assert.equal(h(s, 1), 40);
  assert.equal(h(s, 1.5), 1);
  assert.equal(h(s, 2), 19);
  // 40 × 30,10 + 1 × 30,10 × 1,5 + 19 × 30,10 × 2
  assert.equal(s.brut, 1204 + 45.15 + 1143.8);
});

test('IC : le dimanche est à temps double dès la première heure et n\'utilise pas l\'heure à temps et demi', () => {
  const s = semaine({ [DIM]: quart('07:00', '11:00', 0), [LUN]: quart('06:00', '18:30', 30) });
  assert.deepEqual(s.jours[0].tranches, [{ mult: 2, minutes: 240 }]);
  assert.deepEqual(s.jours[1].tranches, [{ mult: 1, minutes: 600 }, { mult: 1.5, minutes: 60 }, { mult: 2, minutes: 60 }]);
});

test('IC : jour férié travaillé à temps double, et seuil de la semaine ramené à 32 h', () => {
  const s = semaine(
    { [LUN]: quart('07:00', '15:00', 0), [MAR]: quart(), [MER]: quart(), [JEU]: quart(), [VEN]: quart() },
    { feries: [LUN] },
  );
  assert.deepEqual(s.jours[1].tranches, [{ mult: 2, minutes: 480 }]);
  assert.equal(h(s, 1), 32);
  assert.equal(h(s, 1.5), 1);
  assert.equal(h(s, 2), 8 + 7);
});

test('férié décoché sur la journée : traité comme un jour normal', () => {
  const s = semaine({ [LUN]: quart('07:00', '15:00', 0, { ferie: false }) }, { feries: [LUN] });
  assert.deepEqual(s.jours[1].tranches, [{ mult: 1, minutes: 480 }]);
});

test('férié coché à la main hors liste', () => {
  const s = semaine({ [MER]: quart('07:00', '15:00', 0, { ferie: true }) });
  assert.deepEqual(s.jours[3].tranches, [{ mult: 2, minutes: 480 }]);
});

test('génie civil : toutes les heures supplémentaires à temps double', () => {
  const s = semaine({ [LUN]: quart('06:00', '18:30', 30), [SAM]: quart('07:00', '11:00', 0) }, { profils: [profil({ secteur: 'gcv' })] });
  assert.equal(h(s, 1), 10);
  assert.equal(h(s, 1.5), 0);
  assert.equal(h(s, 2), 6);
});

test('résidentiel léger : heures supplémentaires à temps et demi, dimanche compris', () => {
  const s = semaine({ [DIM]: quart('07:00', '11:00', 0), [LUN]: quart('06:00', '18:30', 30) }, { profils: [profil({ secteur: 'res-leger' })] });
  assert.equal(h(s, 1), 10);
  assert.equal(h(s, 1.5), 6);
  assert.equal(h(s, 2), 0);
});

test('résidentiel lourd : heures supplémentaires à temps double', () => {
  const s = semaine({ [LUN]: quart('06:00', '18:30', 30) }, { profils: [profil({ secteur: 'res-lourd' })] });
  assert.equal(h(s, 2), 2);
});

test('chantier isolé IC : 9 h par jour, 45 h, 5 premières heures à temps et demi', () => {
  const p = profil({ isole: true });
  const s = semaine({ [LUN]: quart(), [MAR]: quart(), [MER]: quart(), [JEU]: quart(), [VEN]: quart(), [SAM]: quart() }, { profils: [p] });
  assert.equal(h(s, 1), 45);
  assert.equal(h(s, 1.5), 5);
  assert.equal(h(s, 2), 10);
  assert.equal(s.jours[1].taux, 31.55);
});

test('chantier isolé avec gîte et couvert : 10 h par jour, 50 h', () => {
  const r = prereglage('ic', true, true);
  assert.equal(r.seuilJour, 10);
  assert.equal(r.seuilSemaine, 50);
});

test('règles personnalisées : seuil de 8 h par jour et samedi à temps et demi', () => {
  const p = profil({ regles: { seuilJour: 8, heuresPalier1: 0, multSamedi: 1.5 } });
  const s = semaine({ [LUN]: quart(), [SAM]: quart('07:00', '11:00', 0) }, { profils: [p] });
  assert.deepEqual(s.jours[1].tranches, [{ mult: 1, minutes: 480 }, { mult: 2, minutes: 120 }]);
  assert.deepEqual(s.jours[6].tranches, [{ mult: 1.5, minutes: 240 }]);
});

test('quart qui passe minuit : compté sur le jour du début', () => {
  const s = semaine({ [LUN]: quart('22:00', '06:00', 30) });
  assert.equal(s.jours[1].minutes, 450);
  assert.equal(s.jours[2].minutes, 0);
  assert.equal(s.jours[1].duree.passeMinuit, true);
});

test('semaine à cheval sur un changement de grille (25 avril 2027, industriel)', () => {
  // Semaine du dimanche 25 avril 2027 : le nouveau taux commence le dimanche, donc toute la semaine au nouveau taux.
  // Semaine précédente : ancien taux.
  const p = [profil({ secteur: 'industriel' })];
  const avant = calculerSemaine('2027-04-18', { '2027-04-19': quart() }, { profils: p }, GRILLES);
  const apres = calculerSemaine('2027-04-25', { '2027-04-26': quart() }, { profils: p }, GRILLES);
  assert.equal(avant.brut, 301);
  assert.equal(apres.brut, 316);
});

test('semaine à cheval sur un changement d\'échelon en milieu de semaine', () => {
  const profils = [profil(), profil({ id: 'p2', dateEffet: MER, echelon: 'app2' })];
  const s = semaine({ [LUN]: quart(), [MAR]: quart(), [MER]: quart(), [JEU]: quart(), [VEN]: quart() }, { profils });
  assert.equal(s.jours[2].taux, 30.10);
  assert.equal(s.jours[3].taux, 35.11);
  assert.deepEqual(s.lignesPaie, [
    { taux: 30.10, mult: 1, minutes: 1200, montant: 602 },
    { taux: 35.11, mult: 1, minutes: 1200, montant: 702.2 },
    { taux: 35.11, mult: 1.5, minutes: 60, montant: 52.67 },
    { taux: 35.11, mult: 2, minutes: 540, montant: 631.98 },
  ]);
  assert.equal(s.brut, 1988.85);
});

test('semaine à cheval sur un changement de taux personnalisé', () => {
  const profils = [profil({ tauxPerso: 30 }), profil({ id: 'p2', dateEffet: JEU, tauxPerso: 32 })];
  const s = semaine({ [MER]: quart('07:00', '15:00', 0), [JEU]: quart('07:00', '15:00', 0) }, { profils });
  assert.equal(s.brut, 8 * 30 + 8 * 32);
});

test('historique : une semaine passée garde son ancien profil', () => {
  const profils = [profil(), profil({ id: 'p2', dateEffet: '2027-01-04', secteur: 'res-leger', echelon: 'app2' })];
  assert.equal(profilPourDate(profils, '2026-12-01').id, 'p1');
  assert.equal(profilPourDate(profils, '2027-01-04').id, 'p2');
  assert.equal(profilPourDate(profils, '2020-01-01').id, 'p1');
  assert.equal(semaine({ [LUN]: quart() }, { profils }).jours[1].taux, 30.10);
});

test('taux manquant : pas de montant inventé', () => {
  const s = semaine({ [LUN]: quart() }, { profils: [profil({ secteur: 'gcv', isole: true })] });
  assert.equal(s.tauxManquant, true);
  assert.equal(s.brut, 0);
  assert.equal(s.jours[1].montant, null);
  assert.equal(s.minutesTotal, 600);
});

test('primes : par heure, par jour, par semaine, et vacances seulement sur le salaire', () => {
  const primes = [
    { id: 'a', nom: 'Équipement de sécurité', montant: 0.75, unite: 'heure', dansSalaire: false },
    { id: 'b', nom: 'Pension', montant: 50, unite: 'jour', dansSalaire: false },
    { id: 'c', nom: 'Prime de chantier', montant: 100, unite: 'semaine', dansSalaire: true },
    { id: 'd', nom: 'Désactivée', montant: 999, unite: 'jour', actif: false },
  ];
  const s = semaine({ [LUN]: quart(), [MAR]: quart() }, { primes });
  assert.deepEqual(s.lignesPrimes.map((p) => p.montant), [15, 100, 100]);
  assert.equal(s.salaireHeures, 602);
  assert.equal(s.brut, 702);
  assert.equal(s.indemnites, 115);
  assert.equal(s.vacances, 91.26);
});

test('primes : limitées à un chantier ou à une période', () => {
  const primes = [
    { id: 'a', nom: 'Pension Nord', montant: 80, unite: 'jour', chantierId: 'nord' },
    { id: 'b', nom: 'Ancienne', montant: 10, unite: 'jour', fin: LUN },
  ];
  const s = semaine({ [LUN]: quart('07:00', '17:30', 30, { chantierId: 'ville' }), [MAR]: quart('07:00', '17:30', 30, { chantierId: 'nord' }) }, { primes });
  assert.deepEqual(s.lignesPrimes.map((p) => [p.id, p.montant]), [['a', 80], ['b', 10]]);
});

test('semaine vide', () => {
  const s = semaine({});
  assert.equal(s.minutesTotal, 0);
  assert.equal(s.brut, 0);
  assert.deepEqual(s.lignesPaie, []);
});

test('classerSemaine : le seuil de la semaine coupe en plein milieu d\'une journée', () => {
  const regles = prereglage('ic');
  const jours = joursDeLaSemaine(DIM).map((date, i) => ({ date, regles, minutes: i >= 1 && i <= 5 ? 510 : 0 }));
  const c = classerSemaine(jours);
  assert.deepEqual(c[5].tranches, [{ mult: 1, minutes: 360 }, { mult: 1.5, minutes: 60 }, { mult: 2, minutes: 90 }]);
});
