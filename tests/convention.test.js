import test from 'node:test';
import assert from 'node:assert/strict';
import { ONGLETS, GROUPES_SUJETS, CONVENTIONS, ongletPourSecteur } from '../js/convention.js';
import { SECTEURS } from '../js/grilles.js';

test('convention : chaque secteur des réglages ouvre son onglet', () => {
  assert.equal(ongletPourSecteur('res-leger'), 'res');
  assert.equal(ongletPourSecteur('res-lourd'), 'res');
  assert.equal(ongletPourSecteur('ic'), 'ic');
  assert.equal(ongletPourSecteur('industriel'), 'industriel');
  assert.equal(ongletPourSecteur('gcv'), 'gcv');
  assert.equal(ongletPourSecteur(undefined), 'ic');
  for (const s of Object.keys(SECTEURS)) assert.ok(ONGLETS[ongletPourSecteur(s)].secteurs.includes(s), s);
});

test('convention : chaque texte connu a un sujet, un article, un lien et un statut', () => {
  const sujets = new Set(GROUPES_SUJETS.flatMap((g) => g.sujets.map(([cle]) => cle)));
  for (const [onglet, textes] of Object.entries(CONVENTIONS)) {
    assert.ok(ONGLETS[onglet], onglet);
    for (const [cle, e] of Object.entries(textes)) {
      assert.ok(sujets.has(cle), `${onglet}.${cle} : sujet inconnu`);
      assert.ok(['lu', 'a-verifier'].includes(e.statut), `${onglet}.${cle} : statut`);
      assert.ok(e.texte && e.articles, `${onglet}.${cle} : texte et article`);
      assert.match(e.url, /^https:\/\/(www\.)?(ccq\.org|acq\.org)\//, `${onglet}.${cle} : lien officiel`);
    }
  }
});

test('convention : les quatre secteurs ont tous les sujets', () => {
  const sujets = GROUPES_SUJETS.flatMap((g) => g.sujets.map(([cle]) => cle));
  for (const onglet of Object.keys(ONGLETS)) {
    for (const cle of sujets) assert.ok(CONVENTIONS[onglet]?.[cle], `${onglet}.${cle} manquant`);
  }
});
