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

test('crédits du DEP en réserve, non utilisés : on avance aux heures travaillées', () => {
  const debut = etatCarnet({ heuresDepart: 0, credits: 2025 });
  assert.equal(debut.periode, 1);
  assert.equal(debut.reserve, 2025);
  assert.equal(debut.restant, 2000);
  assert.equal(debut.prochain, 'periode');
  assert.equal(debut.restantFin, 3975);
  assert.equal(debut.restantFinSansReserve, 6000);

  const p2 = etatCarnet({ heuresDepart: 1500, heuresApp: 600, credits: 2025 });
  assert.equal(p2.periode, 2);
  assert.equal(p2.prochainSeuil, 3975);
  assert.equal(p2.prochain, 'fin');
  assert.equal(p2.restant, 1875);

  assert.equal(etatCarnet({ heuresDepart: 3975, credits: 2025 }).termine, true);
  assert.equal(etatCarnet({ heuresDepart: 3974, credits: 2025 }).termine, false);
});

test('simulation : ce que la réserve changerait si elle était utilisée maintenant', () => {
  const debut = etatCarnet({ heuresDepart: 0, credits: 2025 });
  assert.deepEqual(debut.simulation, { periode: 2, pourPasser: 2000 });

  const milieuP2 = etatCarnet({ heuresDepart: 3000, credits: 2025 });
  assert.equal(milieuP2.periode, 2);
  assert.equal(milieuP2.simulation.periode, 3);

  // Petite réserve, insuffisante pour changer de période tout de suite.
  const petite = etatCarnet({ heuresDepart: 500, credits: 300 });
  assert.deepEqual(petite.simulation, { periode: 1, pourPasser: null });

  assert.equal(etatCarnet({ heuresDepart: 500 }).simulation, null);
});

test('crédits utilisés en cours de route : pour passer d\'apprenti 2 à apprenti 3', () => {
  // 2 600 h travaillées, puis 1 400 h de crédits versées : 4 000 h au carnet, période 3.
  const e = etatCarnet({ heuresDepart: 2600, credits: 2025, creditsUtilises: 1400 });
  assert.equal(e.progression, 4000);
  assert.equal(e.periode, 3);
  assert.equal(e.reserve, 625);
  assert.equal(e.prochain, 'fin');
  assert.equal(e.restantFin, 1375);
  assert.equal(e.restantFinSansReserve, 2000);
});

test('crédits tous utilisés dès le départ : période 2 tout de suite', () => {
  const debut = etatCarnet({ heuresDepart: 0, credits: 2025, creditsUtilises: 2025 });
  assert.equal(debut.periode, 2);
  assert.equal(debut.progression, 2025);
  assert.equal(debut.reserve, 0);
  assert.equal(debut.restant, 1975);
  assert.equal(debut.restantFin, 3975);
  assert.equal(etatCarnet({ heuresDepart: 1975, credits: 2025, creditsUtilises: 2025 }).periode, 3);
  assert.equal(etatCarnet({ heuresDepart: 3975, credits: 2025, creditsUtilises: 2025 }).termine, true);
});

test('crédits utilisés : jamais plus que les crédits obtenus', () => {
  const e = etatCarnet({ heuresDepart: 0, credits: 2025, creditsUtilises: 5000 });
  assert.equal(e.creditsUtilises, 2025);
  assert.equal(e.reserve, 0);
});


