import test from 'node:test';
import assert from 'node:assert/strict';
import { etatCarnet, moyenneHebdo, dateEstimee, periodeRapportMensuel, heuresCarnetSemaine } from '../js/carnet.js';

test('sans crédits : trois périodes de 2 000 h', () => {
  assert.equal(etatCarnet({ heuresDepart: 0 }).periode, 1);
  assert.equal(etatCarnet({ heuresDepart: 1999 }).periode, 1);
  assert.equal(etatCarnet({ heuresDepart: 2000 }).periode, 2);
  assert.equal(etatCarnet({ heuresDepart: 4000 }).periode, 3);
  const fin = etatCarnet({ heuresDepart: 6000 });
  assert.equal(fin.termine, true);
  assert.equal(fin.periode, 3);
});

test('crédits du DEP en réserve à la dernière période (défaut)', () => {
  const debut = etatCarnet({ heuresDepart: 0, credits: 2025, creditsMode: 'fin' });
  assert.equal(debut.periode, 1);
  assert.equal(debut.restant, 2000);
  assert.equal(debut.prochain, 'periode');
  assert.equal(debut.restantFin, 3975);

  const p2 = etatCarnet({ heuresDepart: 1500, heuresApp: 600, credits: 2025, creditsMode: 'fin' });
  assert.equal(p2.periode, 2);
  assert.equal(p2.prochainSeuil, 3975);
  assert.equal(p2.prochain, 'fin');
  assert.equal(p2.restant, 1875);

  assert.equal(etatCarnet({ heuresDepart: 3975, credits: 2025, creditsMode: 'fin' }).termine, true);
});

test('crédits du DEP devancés : période 2 dès le départ', () => {
  const debut = etatCarnet({ heuresDepart: 0, credits: 2025, creditsMode: 'devance' });
  assert.equal(debut.periode, 2);
  assert.equal(debut.progression, 2025);
  assert.equal(debut.restant, 1975);
  assert.equal(debut.restantFin, 3975);

  const p3 = etatCarnet({ heuresDepart: 1975, credits: 2025, creditsMode: 'devance' });
  assert.equal(p3.periode, 3);
  assert.equal(p3.prochain, 'fin');
  assert.equal(etatCarnet({ heuresDepart: 3975, credits: 2025, creditsMode: 'devance' }).termine, true);
});

test('les heures de l\'app s\'ajoutent au solde de départ', () => {
  const e = etatCarnet({ heuresDepart: 1950, heuresApp: 60 });
  assert.equal(e.travaillees, 2010);
  assert.equal(e.periode, 2);
});

test('moyenne par semaine : ignore les semaines sans travail, garde les 4 dernières', () => {
  assert.equal(moyenneHebdo([]), null);
  assert.equal(moyenneHebdo([0, 0]), null);
  assert.equal(moyenneHebdo([10, 40, 0, 40, 50, 30]), 40);
});

test('date estimée de passage', () => {
  assert.equal(dateEstimee('2026-11-16', 400, 40), '2027-01-25');
  assert.equal(dateEstimee('2026-11-16', 400, null), null);
  assert.equal(dateEstimee('2026-11-16', 0, 40), '2026-11-16');
});

test('période du rapport mensuel : se termine le dernier samedi du mois', () => {
  // Dates données par la convention résidentielle (art. 19.04 4)) : 29 mars 2026 au 27 mars 2027.
  assert.equal(periodeRapportMensuel(2026, 3).fin, '2026-03-28');
  assert.equal(periodeRapportMensuel(2026, 4).debut, '2026-03-29');
  assert.equal(periodeRapportMensuel(2027, 3).fin, '2027-03-27');
  assert.deepEqual(periodeRapportMensuel(2026, 11), { debut: '2026-11-01', fin: '2026-11-28' });
  assert.deepEqual(periodeRapportMensuel(2027, 1), { debut: '2026-12-27', fin: '2027-01-30' });
});

test('heures au carnet : facteur réglable pour les heures majorées', () => {
  const semaine = { minutesSimples: 2400, minutesMajorees: 600 };
  assert.equal(heuresCarnetSemaine(semaine), 50);
  assert.equal(heuresCarnetSemaine(semaine, 2), 60);
});
