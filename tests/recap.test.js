import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerSemaine } from '../js/calcul.js';
import { GRILLES, SECTEURS, ECHELONS } from '../js/grilles.js';
import { joursVentiles, recapituler, jalons, ligneDuTemps, suiteContinue, totaliser, cumuler } from '../js/recap.js';
import { graduations, indiceDepuisX, segmentsLisses } from '../js/graphique.js';

const profil = (extra = {}) => ({ id: 'p1', dateEffet: '2025-01-01', secteur: 'ic', isole: false, echelon: 'app1', tauxPerso: null, regles: null, vacancesPct: 13, ...extra });
const quart = (debut = '07:00', fin = '17:30', pauseMin = 30, extra = {}) => ({ debut, fin, pauseMin, ...extra });
const semaine = (debut, saisies, reglages = {}) => calculerSemaine(debut, saisies, { profils: [profil()], primes: [], feries: [], ...reglages }, GRILLES);
const cents = (jours) => jours.reduce((s, j) => s + j.brutCents, 0);

test('ventilation : la somme des jours redonne le brut de la semaine, primes comprises', () => {
  const s = semaine('2026-11-15', { '2026-11-16': quart(), '2026-11-17': quart('07:00', '12:00', 0) }, {
    primes: [{ id: 'x', nom: 'Prime', montant: 50, unite: 'semaine', dansSalaire: true }],
  });
  assert.equal(s.brut, 501.5);
  const jours = joursVentiles(s);
  assert.equal(cents(jours), 50150);
  // 301 $ d'heures + 2/3 de la prime ; 150,50 $ d'heures + 1/3 de la prime.
  assert.deepEqual(jours.map((j) => j.brutCents), [30100 + 3333, 15050 + 1667]);
});

test('ventilation : semaine avec heures supplémentaires, au cent près', () => {
  const saisies = Object.fromEntries(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((d) => [d, quart('06:45', '17:40', 25)]));
  const s = semaine('2026-11-15', saisies);
  const jours = joursVentiles(s);
  assert.equal(cents(jours), Math.round(s.brut * 100));
  assert.equal(jours.reduce((a, j) => a + j.simples + j.demi + j.double + j.autres, 0), s.minutesTotal);
});

test('récapitulatif : une semaine à cheval sur deux mois est partagée jour par jour', () => {
  const semaines = [
    semaine('2026-11-22', { '2026-11-23': quart(), '2026-11-24': quart(), '2026-11-25': quart(), '2026-11-26': quart() }),
    semaine('2026-11-29', { '2026-11-30': quart(), '2026-12-01': quart(), '2026-12-02': quart(), '2026-12-03': quart() }),
  ];
  const talons = new Map([
    ['2026-11-22', { debut: '2026-11-22', brutReel: 1204, netReel: 950 }],
    ['2026-11-29', { debut: '2026-11-29', brutReel: 1190, netReel: 900 }],
  ]);
  const r = recapituler(semaines, talons);

  assert.deepEqual(r.semaines.map((l) => l.cle), ['2026-11-29', '2026-11-22']);
  assert.equal(r.semaines[0].brut, 1204);
  assert.equal(r.semaines[0].net, 900);
  assert.equal(r.semaines[0].ecart, -14);
  assert.equal(r.semaines[0].fin, '2026-12-05');

  const [dec, nov] = r.mois;
  assert.equal(nov.cle, '2026-11');
  assert.equal(nov.minutes, 5 * 600);
  assert.equal(nov.brut, 1505);
  // Le talon de la semaine du 29 novembre est rattaché à décembre, où elle se termine.
  assert.deepEqual([nov.semaines, nov.netNb, nov.net, nov.brutReel, nov.ecart], [1, 1, 950, 1204, 0]);
  assert.equal(dec.cle, '2026-12');
  assert.equal(dec.minutes, 3 * 600);
  assert.equal(dec.brut, 903);
  assert.deepEqual([dec.semaines, dec.netNb, dec.net, dec.brutReel, dec.ecart], [1, 1, 900, 1190, -14]);

  assert.equal(r.annees.length, 1);
  assert.deepEqual([r.annees[0].minutes, r.annees[0].brut, r.annees[0].net, r.annees[0].semaines], [4800, 2408, 1850, 2]);
});

test('récapitulatif : le net n\'est jamais estimé, on compte les semaines où il est saisi', () => {
  const semaines = [
    semaine('2026-11-01', { '2026-11-02': quart() }),
    semaine('2026-11-08', { '2026-11-09': quart() }),
    semaine('2026-11-15', { '2026-11-16': quart() }),
  ];
  const r = recapituler(semaines, { '2026-11-08': { netReel: 240.5 } });
  const nov = r.mois[0];
  assert.deepEqual([nov.semaines, nov.netNb, nov.net], [3, 1, 240.5]);
  assert.deepEqual([nov.brutReelNb, nov.brutReel, nov.ecart], [0, null, null]);
  assert.equal(r.semaines.find((l) => l.cle === '2026-11-01').net, null);

  const sans = recapituler(semaines);
  assert.equal(sans.mois[0].net, null);
  assert.equal(sans.annees[0].netNb, 0);
});

test('récapitulatif : semaine à cheval sur deux années', () => {
  const r = recapituler([semaine('2026-12-27', { '2026-12-31': quart(), '2027-01-01': quart() })], { '2026-12-27': { netReel: 480 } });
  const [a2027, a2026] = r.annees;
  assert.deepEqual([a2026.cle, a2026.minutes, a2026.brut, a2026.semaines, a2026.net], ['2026', 600, 301, 0, null]);
  assert.deepEqual([a2027.cle, a2027.minutes, a2027.brut, a2027.semaines, a2027.net], ['2027', 600, 301, 1, 480]);
});

test('récapitulatif : taux manquant signalé, semaine sans heures ni talon ignorée', () => {
  const r = recapituler([
    semaine('2026-11-15', { '2026-11-16': quart() }, { profils: [profil({ secteur: 'gcv', isole: true })] }),
    semaine('2026-11-22', { '2026-11-23': { debut: '', fin: '', pauseMin: 0, note: 'congé' } }),
  ]);
  assert.equal(r.semaines.length, 1);
  assert.equal(r.semaines[0].incomplet, true);
  assert.equal(r.semaines[0].brut, 0);
  assert.equal(r.mois[0].incomplet, true);
});

test('jalons : première journée, nouveaux chantiers, changement de profil', () => {
  const profils = [profil({ employeur: 'A' }), profil({ id: 'p2', dateEffet: '2026-11-18', employeur: 'B', echelon: 'app2' })];
  const s = semaine('2026-11-15', {
    '2026-11-16': quart('07:00', '17:30', 30, { chantierId: 'c1' }),
    '2026-11-17': quart('07:00', '17:30', 30, { chantierId: 'c1' }),
    '2026-11-18': quart('07:00', '17:30', 30, { chantierId: 'c2' }),
    '2026-11-19': quart('07:00', '17:30', 30, { chantierId: 'c2' }),
  }, { profils });
  const liste = jalons([s], {
    profils, chantiers: [{ id: 'c1', nom: 'École' }, { id: 'c2', nom: 'Aréna' }], secteurs: SECTEURS, echelons: ECHELONS, auj: '2026-11-20', dernierExport: '2026-11-19',
  });
  assert.deepEqual(liste.map((j) => [j.date, j.genre, j.texte]), [
    ['2026-11-16', 'debut', 'Première journée saisie'],
    ['2026-11-16', 'chantier', 'Nouveau chantier : École'],
    ['2026-11-18', 'chantier', 'Nouveau chantier : Aréna'],
    ['2026-11-18', 'profil', 'Employeur : B · Échelon : Apprenti 2'],
    ['2026-11-19', 'sauvegarde', 'Dernière sauvegarde'],
  ]);
});

test('jalons : un profil à venir ou antérieur à la première journée n\'apparaît pas', () => {
  const profils = [profil({ dateEffet: '2024-01-01' }), profil({ id: 'p2', dateEffet: '2025-06-01', echelon: 'app2' }), profil({ id: 'p3', dateEffet: '2027-01-01', echelon: 'app3' })];
  const s = semaine('2026-11-15', { '2026-11-16': quart() }, { profils });
  assert.deepEqual(jalons([s], { profils, auj: '2026-11-20' }).map((j) => j.genre), ['debut']);
});

test('jalons : changement de taux de la grille au premier jour travaillé au nouveau taux', () => {
  const profils = [profil({ secteur: 'industriel' })];
  const liste = jalons([
    semaine('2027-04-18', { '2027-04-22': quart() }, { profils }),
    semaine('2027-04-25', { '2027-04-26': quart() }, { profils }),
  ], { profils });
  assert.deepEqual(liste.filter((j) => j.genre === 'taux'), [
    { date: '2027-04-26', genre: 'taux', texte: 'Nouveau taux de la grille : 30,10 $ → 31,60 $ l\'heure' },
  ]);
});

test('jalons : paliers d\'heures saisies', () => {
  const s = semaine('2026-11-15', { '2026-11-16': quart(), '2026-11-17': quart(), '2026-11-18': quart(), '2026-11-19': quart() });
  const liste = jalons([s], { pasCumul: 20 }).filter((j) => j.genre === 'cumul');
  assert.deepEqual(liste.map((j) => [j.date, j.texte]), [['2026-11-17', '20 h saisies'], ['2026-11-19', '40 h saisies']]);
  assert.equal(jalons([], {}).length, 0);
});

test('ligne du temps : de la plus récente à la plus ancienne, semaines vides regroupées', () => {
  const semaines = [
    semaine('2026-11-01', { '2026-11-02': quart() }),
    semaine('2026-11-22', { '2026-11-23': quart(), '2026-11-28': quart() }),
  ];
  const items = ligneDuTemps(semaines, [], { debutCourant: '2026-12-06' });
  assert.deepEqual(items.map((i) => [i.type, i.debut, i.nb ?? i.minutes]), [
    ['vide', '2026-11-29', 1],
    ['semaine', '2026-11-22', 1200],
    ['vide', '2026-11-08', 2],
    ['semaine', '2026-11-01', 600],
  ]);
  assert.equal(items[1].simples, 600);
  assert.equal(items[1].demi + items[1].double, 600);
  assert.equal(items[2].fin, '2026-11-21');

  // Un jalon dans une semaine sans heures la fait apparaître.
  const avecJalon = ligneDuTemps(semaines, [{ date: '2026-11-10', genre: 'profil', texte: 'x' }], { debutCourant: '2026-11-22' });
  assert.deepEqual(avecJalon.map((i) => [i.type, i.debut]), [['semaine', '2026-11-22'], ['vide', '2026-11-15'], ['semaine', '2026-11-08'], ['semaine', '2026-11-01']]);
  assert.equal(avecJalon[2].minutes, 0);
  assert.equal(avecJalon[2].jalons.length, 1);

  assert.deepEqual(ligneDuTemps([], []), []);
});

test('courbes : suite sans trou, une semaine sans heures vaut zéro', () => {
  const r = recapituler([
    semaine('2026-11-01', { '2026-11-02': quart() }),
    semaine('2026-11-22', { '2026-11-23': quart() }),
  ], { '2026-11-22': { netReel: 240 } });
  const suite = suiteContinue(r.semaines, 'semaines', { jusqua: '2026-11-29' });
  assert.deepEqual(suite.map((l) => [l.cle, l.minutes, l.brut, l.net]), [
    ['2026-11-01', 600, 301, null],
    ['2026-11-08', 0, 0, null],
    ['2026-11-15', 0, 0, null],
    ['2026-11-22', 600, 301, 240],
    ['2026-11-29', 0, 0, null],
  ]);
  assert.equal(suite[1].fin, '2026-11-14');
  assert.deepEqual(suiteContinue([], 'semaines'), []);
});

test('courbes : suite de mois, passage d\'année compris', () => {
  const r = recapituler([
    semaine('2026-11-01', { '2026-11-02': quart() }),
    semaine('2027-01-03', { '2027-01-04': quart() }),
  ]);
  const suite = suiteContinue(r.mois, 'mois', { jusqua: '2027-02' });
  assert.deepEqual(suite.map((l) => [l.cle, l.minutes]), [['2026-11', 600], ['2026-12', 0], ['2027-01', 600], ['2027-02', 0]]);
});

test('courbes : totaux et cumul, le net cumulé ne compte que les talons saisis', () => {
  const r = recapituler([
    semaine('2026-11-01', { '2026-11-02': quart() }),
    semaine('2026-11-08', { '2026-11-09': quart() }),
    semaine('2026-11-15', { '2026-11-16': quart() }),
  ], { '2026-11-08': { netReel: 240.1 }, '2026-11-15': { netReel: 240.2 } });
  const suite = suiteContinue(r.semaines, 'semaines');
  assert.deepEqual(totaliser(suite), { minutes: 1800, brut: 903, net: 480.3, netNb: 2, semaines: 3, incomplet: false });
  assert.deepEqual(cumuler(suite).map((l) => [l.cle, l.minutes, l.brut, l.net, l.netNb, l.semaines]), [
    ['2026-11-01', 600, 301, null, 0, 1],
    ['2026-11-08', 1200, 602, 240.1, 1, 2],
    ['2026-11-15', 1800, 903, 480.3, 2, 3],
  ]);
});

test('graphique : graduations rondes et point le plus proche du doigt', () => {
  assert.deepEqual(graduations(2091.95), [0, 1000, 2000, 3000]);
  assert.deepEqual(graduations(55), [0, 20, 40, 60]);
  assert.deepEqual(graduations(40), [0, 10, 20, 30, 40]);
  assert.deepEqual(graduations(0), [0, 1]);
  assert.equal(indiceDepuisX(0, 360, 10), 0);
  assert.equal(indiceDepuisX(360, 360, 10), 9);
  assert.equal(indiceDepuisX(46 + 300 / 2, 360, 11), 5);
  assert.equal(indiceDepuisX(100, 360, 1), 0);
});

test('graphique : la courbe lissée passe par les points sans jamais les dépasser', () => {
  // Semaines pleines, semaine à zéro, sommet, palier : les cas où une courbe ordinaire déborde.
  const xs = [0, 10, 20, 30, 40, 50, 60, 70];
  const ys = [40, 0, 0, 55, 42, 42, 10, 48];
  const segs = segmentsLisses(xs, ys);
  assert.equal(segs.length, xs.length - 1);
  segs.forEach((s, i) => {
    const bas = Math.min(ys[i], ys[i + 1]) - 1e-9;
    const haut = Math.max(ys[i], ys[i + 1]) + 1e-9;
    assert.equal(s.x, xs[i + 1]);
    assert.equal(s.y, ys[i + 1]);
    for (const v of [s.y1, s.y2]) assert.ok(v >= bas && v <= haut, `intervalle ${i} : ${v} sort de [${bas}, ${haut}]`);
    assert.ok(s.x1 > xs[i] && s.x1 < s.x2 && s.x2 < xs[i + 1]);
  });
  // Un palier reste plat, une valeur nulle reste à zéro.
  assert.equal(segs[1].y1, 0);
  assert.equal(segs[1].y2, 0);
  assert.equal(segs[4].y1, 42);
  assert.equal(segs[4].y2, 42);
  // Deux points : une droite. Un seul : rien à tracer.
  assert.deepEqual(segmentsLisses([0, 30], [10, 40]), [{ x1: 10, y1: 20, x2: 20, y2: 30, x: 30, y: 40 }]);
  assert.deepEqual(segmentsLisses([5], [5]), []);
});
