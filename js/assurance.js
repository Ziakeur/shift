// Assurance collective de l'industrie (MÉDIC Construction) : régime estimé d'après les heures
// travaillées pendant chaque période de référence, et période couverte. Fonctions pures, testées dans tests/.
// Les seuils et les dates viennent de `ASSURANCE` (js/grilles.js), lus sur ccq.org : rien n'est déduit ici.

// Régime obtenu avec ces heures : celui dont le seuil est le plus haut sans dépasser les heures. null : aucun.
export function regimePourHeures(heures, regimes) {
  return [...regimes].sort((a, b) => b.heures - a.heures).find((r) => heures >= r.heures) ?? null;
}

// Régime juste au-dessus : le plus petit seuil pas encore atteint. null : le meilleur régime est atteint.
export function regimeSuivant(heures, regimes) {
  return [...regimes].sort((a, b) => a.heures - b.heures).find((r) => heures < r.heures) ?? null;
}

// Les périodes d'assurance durent six mois : janvier à juin, juillet à décembre.
export function semestreAssurance(debut) {
  const a = Number(debut.slice(0, 4));
  return debut.slice(5, 7) <= '06'
    ? { debut: `${a}-01-01`, fin: `${a}-06-30`, suivant: `${a}-07-01`, precedent: `${a - 1}-07-01` }
    : { debut: `${a}-07-01`, fin: `${a}-12-31`, suivant: `${a + 1}-01-01`, precedent: `${a}-01-01` };
}

function etape(auj, debut, fin) {
  return auj < debut ? 'a-venir' : auj <= fin ? 'en-cours' : 'terminee';
}

const arrondi = (h) => Math.round(h * 100) / 100;

// Estimation pour chaque période publiée, de la plus ancienne à la plus récente.
//   heuresParJour : Map date -> heures travaillées ce jour-là
//   periodes      : [{ refDebut, refFin, assDebut, assFin }]
//   regimes       : [{ cle, heures }]
//   premiereFiche : date de la première journée saisie (avant elle, l'app ne connaît pas les heures)
//   carte         : ce que montre la carte de l'assuré, si elle est inscrite :
//                   { periode (début de la période d'assurance de la carte), regime ('A'… ou null), reserve (heures) }
// Pour chaque période :
//   heures, regimeHeures (par les heures seules), regime (estimation retenue), parReserve, reserveUtilisee,
//   suivant { cle, heures, manque }, reference et couverture ('a-venir' | 'en-cours' | 'terminee'), incomplet.
// La réserve ne sert que pour la période qui suit celle de la carte : elle permet le meilleur régime
// possible sans dépasser celui de la carte. Au-delà, la réserve n'est plus connue de l'app.
export function estimerAssurance({ heuresParJour, periodes, regimes, auj, premiereFiche = null, carte = null }) {
  const rang = (cle) => regimes.find((r) => r.cle === cle)?.heures ?? 0;
  const apresCarte = carte?.periode ? semestreAssurance(carte.periode).suivant : null;

  return [...periodes].sort((a, b) => a.assDebut.localeCompare(b.assDebut)).map((p) => {
    let heures = 0;
    for (const [d, h] of heuresParJour) if (d >= p.refDebut && d <= p.refFin) heures += h;
    heures = arrondi(heures);

    const regimeHeures = regimePourHeures(heures, regimes);
    let regime = regimeHeures;
    let reserveUtilisee = 0;
    const reserve = Number(carte?.reserve) || 0;
    if (p.assDebut === apresCarte && reserve > 0 && carte.regime) {
      const plafond = rang(carte.regime);
      const avecReserve = regimePourHeures(heures + reserve, regimes.filter((r) => r.heures <= plafond));
      if (avecReserve && avecReserve.heures > (regimeHeures?.heures ?? 0)) {
        regime = avecReserve;
        reserveUtilisee = arrondi(avecReserve.heures - heures);
      }
    }

    const prochain = regimeSuivant(heures, regimes);
    const reference = etape(auj, p.refDebut, p.refFin);
    return {
      ...p,
      heures,
      regimeHeures: regimeHeures?.cle ?? null,
      regime: regime?.cle ?? null,
      parReserve: reserveUtilisee > 0,
      reserveUtilisee,
      suivant: prochain ? { cle: prochain.cle, heures: prochain.heures, manque: arrondi(prochain.heures - heures) } : null,
      reference,
      couverture: etape(auj, p.assDebut, p.assFin),
      incomplet: reference !== 'a-venir' && (premiereFiche === null || premiereFiche > p.refDebut),
    };
  });
}

// Les trois périodes qui comptent aujourd'hui : celle qui couvre en ce moment, la prochaine couverture,
// et celle dont les heures s'accumulent en ce moment (souvent la même que la prochaine ou la suivante).
export function periodesCles(estimations) {
  return {
    enCours: estimations.find((e) => e.couverture === 'en-cours') ?? null,
    prochaine: estimations.find((e) => e.couverture === 'a-venir') ?? null,
    accumulation: estimations.find((e) => e.reference === 'en-cours') ?? null,
  };
}
