// Dessins au trait pour le décor « plan de chantier » : une ferme de toit et une ossature de maison.
// Du SVG écrit à la main, sans image externe. La couleur vient du style (`currentColor`).

const debut = (largeur, hauteur) => `<svg viewBox="0 0 ${largeur} ${hauteur}" aria-hidden="true" focusable="false">`;
const trait = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

// Ferme de toit : deux arbalétriers, un entrait, un poinçon et les contrefiches.
function ferme(x0, x1, yBas, ySommet) {
  const milieu = (x0 + x1) / 2;
  const quart = (x1 - x0) / 4;
  const yMi = (yBas + ySommet) / 2;
  return [
    trait(x0, yBas, milieu, ySommet), trait(milieu, ySommet, x1, yBas), trait(x0, yBas, x1, yBas),
    trait(milieu, ySommet, milieu, yBas),
    trait(milieu, yBas, x0 + quart, yMi), trait(milieu, yBas, x1 - quart, yMi),
    trait(x0 + quart, yMi, x0 + quart, yBas), trait(x1 - quart, yMi, x1 - quart, yBas),
  ].join('');
}

// La ferme seule : coiffe le nom de l'app sur l'accueil.
export function dessinFerme() {
  return `${debut(300, 62)}${ferme(6, 294, 56, 6)}</svg>`;
}

// Une maison en ossature de bois : ferme, sablières, montants, une fenêtre et une porte.
export function dessinOssature() {
  const haut = 74;   // dessous de la sablière double
  const bas = 146;   // lisse basse
  const montants = [];
  for (let x = 40; x <= 320; x += 28) {
    if (x === 124) { montants.push(trait(x, haut, x, 94), trait(x, 124, x, bas)); continue; } // fenêtre : montants nains
    if (x === 236) { montants.push(trait(x, haut, x, 94)); continue; }                         // porte : montant nain au-dessus
    montants.push(trait(x, haut, x, bas));
  }
  return `${debut(360, 152)}
    ${ferme(22, 338, 66, 8)}
    ${trait(34, 70, 326, 70)}${trait(34, haut, 326, haut)}
    ${montants.join('')}
    ${trait(96, 94, 152, 94)}${trait(96, 98, 152, 98)}${trait(96, 124, 152, 124)}
    ${trait(208, 94, 264, 94)}${trait(208, 98, 264, 98)}
    ${trait(40, bas, 208, bas)}${trait(264, bas, 320, bas)}
  </svg>`;
}
