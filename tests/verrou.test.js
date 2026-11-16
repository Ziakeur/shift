import test from 'node:test';
import assert from 'node:assert/strict';
import { nipValide, creerVerrou, verifierNip, attenteApresEchecs, secondesRestantes } from '../js/verrou.js';

test('NIP : 4 à 8 chiffres, rien d\'autre', () => {
  for (const ok of ['1234', '0000', '012345', '12345678']) assert.equal(nipValide(ok), true, ok);
  for (const non of ['', '123', '123456789', '12a4', '12 34', '１２３４', 1234, null, undefined]) assert.equal(nipValide(non), false, String(non));
});

test('verrou : le bon NIP ouvre, un autre non, et le NIP n\'est pas enregistré', async () => {
  const verrou = await creerVerrou('0420', { iterations: 1000 });
  assert.equal(verrou.longueur, 4);
  assert.equal(JSON.stringify(verrou).includes('0420'), false);
  assert.equal(await verifierNip('0420', verrou), true);
  assert.equal(await verifierNip('0421', verrou), false);
  assert.equal(await verifierNip('420', verrou), false);
  assert.equal(await verifierNip('04200', verrou), false);
  assert.equal(await verifierNip('0420', null), false);
  // Le verrou survit à un aller-retour par le stockage (texte simple).
  assert.equal(await verifierNip('0420', JSON.parse(JSON.stringify(verrou))), true);
});

test('verrou : deux fois le même NIP ne donnent pas la même empreinte', async () => {
  const a = await creerVerrou('123456', { iterations: 1000 });
  const b = await creerVerrou('123456', { iterations: 1000 });
  assert.notEqual(a.sel, b.sel);
  assert.notEqual(a.empreinte, b.empreinte);
  assert.equal(await verifierNip('123456', a), true);
  assert.equal(await verifierNip('123456', b), true);
  await assert.rejects(() => creerVerrou('12'), /4 à 8 chiffres/);
});

test('verrou : pause de plus en plus longue après des NIP faux', () => {
  assert.deepEqual([0, 1, 4, 5, 6, 7, 8, 20].map(attenteApresEchecs), [0, 0, 0, 30, 60, 300, 900, 900]);
  const t = 1_000_000;
  assert.equal(secondesRestantes(null, t), 0);
  assert.equal(secondesRestantes({ echecs: 3, dernier: t }, t), 0);
  assert.equal(secondesRestantes({ echecs: 5, dernier: t }, t), 30);
  assert.equal(secondesRestantes({ echecs: 5, dernier: t }, t + 12_400), 18);
  assert.equal(secondesRestantes({ echecs: 5, dernier: t }, t + 30_000), 0);
  assert.equal(secondesRestantes({ echecs: 6, dernier: t }, t + 30_000), 30);
});
