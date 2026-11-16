import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hhmmEnMinutes, minutesEnHhmm, formatDuree, dureeQuart, debutDeSemaine, joursDeLaSemaine,
  ajouterJours, jourSemaine, formatDate, aujourdhui,
} from '../js/temps.js';

test('conversion des heures', () => {
  assert.equal(hhmmEnMinutes('07:30'), 450);
  assert.equal(hhmmEnMinutes('24:00'), null);
  assert.equal(hhmmEnMinutes(''), null);
  assert.equal(minutesEnHhmm(450), '07:30');
  assert.equal(minutesEnHhmm(-15), '23:45');
  assert.equal(minutesEnHhmm(1450), '00:10');
  assert.equal(formatDuree(630), '10 h 30');
  assert.equal(formatDuree(600), '10 h');
  assert.equal(formatDuree(5), '0 h 05');
});

test('quart de jour avec pause', () => {
  const d = dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '17:30', pauseMin: 30 });
  assert.equal(d.travaillees, 600);
  assert.equal(d.passeMinuit, false);
  assert.equal(d.ajustementHeure, 0);
});

test('quart sans pause, pause absente ou invalide', () => {
  assert.equal(dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '15:00' }).travaillees, 480);
  assert.equal(dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '15:00', pauseMin: -20 }).travaillees, 480);
  assert.equal(dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '' }), null);
});

test('pause plus longue que le quart : jamais négatif', () => {
  assert.equal(dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '07:30', pauseMin: 60 }).travaillees, 0);
});

test('quart qui passe minuit', () => {
  const d = dureeQuart({ date: '2026-11-16', debut: '22:00', fin: '06:00', pauseMin: 30 });
  assert.equal(d.passeMinuit, true);
  assert.equal(d.travaillees, 450);
});

test('début et fin identiques : quart de 24 h', () => {
  assert.equal(dureeQuart({ date: '2026-11-16', debut: '07:00', fin: '07:00' }).travaillees, 1440);
});

test('changement d\'heure de mars 2027 : la nuit dure 1 h de moins', () => {
  // Nuit du samedi 13 au dimanche 14 mars 2027 : à 2 h il est 3 h.
  const d = dureeQuart({ date: '2027-03-13', debut: '22:00', fin: '06:00' });
  assert.equal(d.brutes, 420);
  assert.equal(d.ajustementHeure, -60);
});

test('changement d\'heure de novembre 2027 : la nuit dure 1 h de plus', () => {
  // Nuit du samedi 6 au dimanche 7 novembre 2027 : à 2 h il est 1 h.
  const d = dureeQuart({ date: '2027-11-06', debut: '22:00', fin: '06:00', pauseMin: 30 });
  assert.equal(d.brutes, 540);
  assert.equal(d.ajustementHeure, 60);
  assert.equal(d.travaillees, 510);
});

test('un quart de jour le dimanche du changement d\'heure n\'est pas touché', () => {
  assert.equal(dureeQuart({ date: '2027-03-14', debut: '07:00', fin: '17:00' }).ajustementHeure, 0);
  assert.equal(dureeQuart({ date: '2027-11-07', debut: '07:00', fin: '17:00' }).ajustementHeure, 0);
});

test('semaines', () => {
  assert.equal(jourSemaine('2026-11-15'), 0);
  assert.equal(debutDeSemaine('2026-11-18', 0), '2026-11-15');
  assert.equal(debutDeSemaine('2026-11-15', 0), '2026-11-15');
  assert.equal(debutDeSemaine('2026-11-15', 1), '2026-11-09');
  assert.equal(debutDeSemaine('2026-11-18', 1), '2026-11-16');
  assert.deepEqual(joursDeLaSemaine('2026-11-15').at(-1), '2026-11-21');
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
  assert.equal(ajouterJours('2028-02-28', 1), '2028-02-29');
});

test('affichage des dates en français', () => {
  assert.equal(formatDate('2026-11-16'), 'lundi 16 novembre');
  assert.equal(formatDate('2027-03-01', { annee: true, jour: false }), '1er mars 2027');
});

test('aujourd\'hui suit le fuseau du Québec, pas celui de l\'appareil', () => {
  assert.equal(aujourdhui(new Date('2026-11-16T03:30:00Z')), '2026-11-15');
  assert.equal(aujourdhui(new Date('2026-11-16T06:30:00Z')), '2026-11-16');
});
