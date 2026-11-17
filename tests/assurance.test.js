import test from 'node:test';
import assert from 'node:assert/strict';
import { regimePourHeures, regimeSuivant, semestreAssurance, estimerAssurance, periodesCles } from '../js/assurance.js';
import { ASSURANCE } from '../js/grilles.js';
import { jourSemaine } from '../js/temps.js';

const { regimes, periodes } = ASSURANCE;
const heures = (liste) => new Map(liste);

test('assurance : valeurs lues sur la source (ccq.org, Assurance de base, 17 novembre 2026)', () => {
  assert.deepEqual(regimes.map((r) => [r.cle, r.heures]), [['A', 750], ['B', 600], ['C', 450], ['D', 300]]);
  assert.deepEqual(periodes, [
    { refDebut: '2025-08-31', refFin: '2026-02-28', assDebut: '2026-07-01', assFin: '2026-12-31' },
    { refDebut: '2026-03-01', refFin: '2026-08-29', assDebut: '2027-01-01', assFin: '2027-06-30' },
    { refDebut: '2026-08-30', refFin: '2027-02-27', assDebut: '2027-07-01', assFin: '2027-12-31' },
    { refDebut: '2027-02-28', refFin: '2027-08-28', assDebut: '2028-01-01', assFin: '2028-06-30' },
  ]);
});

test('assurance : les périodes de référence se suivent sans trou, du dimanche au samedi', () => {
  for (const [i, p] of periodes.entries()) {
    assert.equal(jourSemaine(p.refDebut), 0, `${p.refDebut} est un dimanche`);
    assert.equal(jourSemaine(p.refFin), 6, `${p.refFin} est un samedi`);
    if (i > 0) assert.equal(semestreAssurance(periodes[i - 1].assDebut).suivant, p.assDebut);
  }
});

test('assurance : régime selon les heures, aux seuils exacts', () => {
  assert.equal(regimePourHeures(299.99, regimes), null);
  assert.equal(regimePourHeures(300, regimes).cle, 'D');
  assert.equal(regimePourHeures(449.99, regimes).cle, 'D');
  assert.equal(regimePourHeures(450, regimes).cle, 'C');
  assert.equal(regimePourHeures(600, regimes).cle, 'B');
  assert.equal(regimePourHeures(749.99, regimes).cle, 'B');
  assert.equal(regimePourHeures(750, regimes).cle, 'A');
  assert.equal(regimePourHeures(1200, regimes).cle, 'A');
});

test('assurance : régime suivant et heures manquantes', () => {
  assert.equal(regimeSuivant(0, regimes).cle, 'D');
  assert.equal(regimeSuivant(300, regimes).cle, 'C');
  assert.equal(regimeSuivant(700, regimes).cle, 'A');
  assert.equal(regimeSuivant(750, regimes), null);
});

test('assurance : semestres de janvier à juin et de juillet à décembre', () => {
  assert.deepEqual(semestreAssurance('2026-07-01'), { debut: '2026-07-01', fin: '2026-12-31', suivant: '2027-01-01', precedent: '2026-01-01' });
  assert.deepEqual(semestreAssurance('2027-01-01'), { debut: '2027-01-01', fin: '2027-06-30', suivant: '2027-07-01', precedent: '2026-07-01' });
});

test('assurance : les heures sont comptées dans la période de référence, bornes comprises', () => {
  const e = estimerAssurance({
    heuresParJour: heures([
      ['2026-02-28', 100], // dernier jour de la 1re période de référence
      ['2026-03-01', 200], // premier jour de la 2e
      ['2026-08-29', 260], // dernier jour de la 2e
      ['2026-08-30', 10], // premier jour de la 3e
    ]),
    periodes, regimes, auj: '2026-11-17', premiereFiche: '2025-08-01',
  });
  assert.deepEqual(e.map((p) => p.heures), [100, 460, 10, 0]);
  assert.deepEqual(e.map((p) => p.regime), [null, 'C', null, null]);
  assert.deepEqual(e[1].suivant, { cle: 'B', heures: 600, manque: 140 });
});

test('assurance : étapes de la référence et de la couverture selon la date du jour', () => {
  const e = estimerAssurance({ heuresParJour: heures([]), periodes, regimes, auj: '2026-11-17', premiereFiche: '2025-01-01' });
  assert.deepEqual(e.map((p) => [p.reference, p.couverture]), [
    ['terminee', 'en-cours'],
    ['terminee', 'a-venir'],
    ['en-cours', 'a-venir'],
    ['a-venir', 'a-venir'],
  ]);
  const cles = periodesCles(e);
  assert.equal(cles.enCours.assDebut, '2026-07-01');
  assert.equal(cles.prochaine.assDebut, '2027-01-01');
  assert.equal(cles.accumulation.assDebut, '2027-07-01');
});

test('assurance : estimation incomplète si les heures de l\'app commencent après le début de la référence', () => {
  const base = { heuresParJour: heures([['2026-05-04', 8]]), periodes, regimes, auj: '2026-11-17' };
  const tard = estimerAssurance({ ...base, premiereFiche: '2026-05-04' });
  assert.deepEqual(tard.map((p) => p.incomplet), [true, true, false, false]);
  const tot = estimerAssurance({ ...base, premiereFiche: '2025-08-31' });
  assert.deepEqual(tot.map((p) => p.incomplet), [false, false, false, false]);
  const rien = estimerAssurance({ ...base, heuresParJour: heures([]), premiereFiche: null });
  assert.deepEqual(rien.map((p) => p.incomplet), [true, true, true, false]);
});

test('assurance : la réserve complète les heures, sans dépasser le régime de la carte', () => {
  const base = { heuresParJour: heures([['2026-04-01', 500]]), periodes, regimes, auj: '2026-11-17', premiereFiche: '2025-01-01' };
  // Carte de juillet à décembre 2026, régime B, 150 h en réserve : 500 + 150 = 650 h, donc B (100 h de réserve utilisées).
  const b = estimerAssurance({ ...base, carte: { periode: '2026-07-01', regime: 'B', reserve: 150 } })[1];
  assert.equal(b.regimeHeures, 'C');
  assert.equal(b.regime, 'B');
  assert.equal(b.parReserve, true);
  assert.equal(b.reserveUtilisee, 100);
  // Même réserve de 300 h, carte au régime B : 800 h en tout, mais pas plus haut que B.
  assert.equal(estimerAssurance({ ...base, carte: { periode: '2026-07-01', regime: 'B', reserve: 300 } })[1].regime, 'B');
  // Carte au régime A : la réserve peut mener jusqu'à A.
  assert.equal(estimerAssurance({ ...base, carte: { periode: '2026-07-01', regime: 'A', reserve: 300 } })[1].regime, 'A');
  // Carte au régime D : la réserve ne fait pas monter, les heures seules donnent déjà C.
  const d = estimerAssurance({ ...base, carte: { periode: '2026-07-01', regime: 'D', reserve: 300 } })[1];
  assert.equal(d.regime, 'C');
  assert.equal(d.parReserve, false);
  // Pas assuré sur la carte : la réserve ne sert pas.
  assert.equal(estimerAssurance({ ...base, carte: { periode: '2026-07-01', regime: null, reserve: 300 } })[1].regime, 'C');
});

test('assurance : la réserve ne vaut que pour la période qui suit celle de la carte', () => {
  const e = estimerAssurance({
    heuresParJour: heures([['2026-04-01', 500], ['2026-09-10', 500]]),
    periodes, regimes, auj: '2026-11-17', premiereFiche: '2025-01-01',
    carte: { periode: '2026-07-01', regime: 'A', reserve: 300 },
  });
  assert.deepEqual(e.map((p) => p.regime), [null, 'A', 'C', null]);
  assert.deepEqual(e.map((p) => p.parReserve), [false, true, false, false]);
  // Carte d'une période d'avant le tableau (janvier à juin 2026) : la réserve vaut pour juillet à décembre 2026.
  const avant = estimerAssurance({
    heuresParJour: heures([['2025-10-01', 400]]),
    periodes, regimes, auj: '2026-11-17', premiereFiche: '2025-01-01',
    carte: { periode: '2026-01-01', regime: 'C', reserve: 60 },
  });
  assert.equal(avant[0].regime, 'C');
  assert.equal(avant[0].reserveUtilisee, 50);
});
