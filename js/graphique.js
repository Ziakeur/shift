// Courbes en SVG, sans bibliothèque. Retourne du texte SVG ; l'écran s'occupe des appuis.
// Règles suivies : un seul axe par graphique, traits de 2 px, grille discrète, textes dans les couleurs de texte.

const MARGE = { gauche: 46, droite: 14, haut: 30, bas: 24 };

// Graduations « rondes » de 0 jusqu'au-dessus du maximum : 0, 500, 1 000, 1 500…
export function graduations(max, nb = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / nb;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].find((m) => m * puissance >= brut) * puissance;
  const liste = [];
  for (let v = 0; v < max + pas - 1e-9; v += pas) liste.push(Math.round(v * 1000) / 1000);
  return liste;
}

function positionsX(n, largeur) {
  const x0 = MARGE.gauche;
  const x1 = largeur - MARGE.droite;
  if (n <= 1) return [(x0 + x1) / 2];
  return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
}

// Indice du point le plus proche d'une position horizontale (en pixels dans le graphique).
export function indiceDepuisX(x, largeur, n) {
  if (n <= 1) return 0;
  const x0 = MARGE.gauche;
  const x1 = largeur - MARGE.droite;
  return Math.max(0, Math.min(n - 1, Math.round(((x - x0) / (x1 - x0)) * (n - 1))));
}

// Courbe lissée qui passe par tous les points sans jamais les dépasser (interpolation monotone) :
// entre deux points elle reste entre leurs deux valeurs, donc elle ne descend pas sous zéro
// et n'invente ni creux ni sommet. Retourne, pour chaque intervalle, les deux poignées de la courbe de Bézier.
export function segmentsLisses(xs, ys) {
  const n = xs.length;
  if (n < 2) return [];
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    d.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue; // sommet, creux ou palier : pente nulle
    const p = (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i]);
    m[i] = Math.sign(d[i]) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), Math.abs(p) / 2) * 2;
  }
  m[0] = n === 2 ? d[0] : (3 * d[0] - m[1]) / 2;
  m[n - 1] = n === 2 ? d[0] : (3 * d[n - 2] - m[n - 2]) / 2;
  return h.map((hi, i) => ({
    x1: xs[i] + hi / 3, y1: ys[i] + (m[i] * hi) / 3,
    x2: xs[i + 1] - hi / 3, y2: ys[i + 1] - (m[i + 1] * hi) / 3,
    x: xs[i + 1], y: ys[i + 1],
  }));
}

const f = (v) => v.toFixed(1);

function cheminLisse(xs, ys) {
  return `M${f(xs[0])} ${f(ys[0])}` + segmentsLisses(xs, ys).map((s) => ` C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}`).join('');
}

// Dessine un graphique.
//   id : identifiant unique dans la page (sert au dégradé sous la courbe)
//   largeur, hauteur : taille en pixels
//   series : [{ classe, points: [nombre ou null], creux: [booléen] (facultatif), aire: booléen }]
//            un point null coupe la courbe ; `creux` dessine un point vide (valeur partielle)
//   etiquettes : libellés de l'axe horizontal, un par point
//   formatY : valeur -> texte de la graduation
//   selection : indice du point mis en évidence (ou null) ; son libellé s'affiche en haut du repère
//   description : texte lu par un lecteur d'écran
export function courbes({ id = 'g', largeur, hauteur = 190, series, etiquettes, formatY, selection = null, description = '' }) {
  const n = etiquettes.length;
  const xs = positionsX(n, largeur);
  const max = Math.max(0, ...series.flatMap((s) => s.points.filter((v) => typeof v === 'number')));
  const grads = graduations(max);
  const haut = grads.at(-1);
  const y = (v) => MARGE.haut + (hauteur - MARGE.haut - MARGE.bas) * (1 - v / haut);
  const bas = y(0);
  const droite = largeur - MARGE.droite;

  const grille = grads.map((g) => `
    <line class="g-grille" x1="${MARGE.gauche}" x2="${f(droite)}" y1="${f(y(g))}" y2="${f(y(g))}"/>
    <text class="g-texte" x="${MARGE.gauche - 6}" y="${f(y(g) + 4)}" text-anchor="end">${formatY(g)}</text>`).join('');

  // Au plus cinq libellés sur l'axe du temps, répartis régulièrement.
  const nbLibelles = Math.min(n, largeur < 340 ? 4 : 5);
  const indices = nbLibelles <= 1 ? [0] : [...new Set(Array.from({ length: nbLibelles }, (_, i) => Math.round((i * (n - 1)) / (nbLibelles - 1))))];
  const axe = indices.map((i) => {
    const ancre = n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle';
    return `<text class="g-texte" x="${f(xs[i])}" y="${hauteur - 6}" text-anchor="${ancre}">${etiquettes[i]}</text>`;
  }).join('');

  const degrades = series.map((s, k) => (s.aire ? `
    <linearGradient id="${id}-d${k}" class="${s.classe}" x1="0" y1="0" x2="0" y2="1">
      <stop class="g-stop-haut" offset="0"/><stop class="g-stop-bas" offset="1"/>
    </linearGradient>` : '')).join('');

  const traces = series.map((s, k) => {
    const morceaux = [];
    let courant = [];
    s.points.forEach((v, i) => {
      if (typeof v === 'number') courant.push(i);
      else if (courant.length) { morceaux.push(courant); courant = []; }
    });
    if (courant.length) morceaux.push(courant);

    const lignes = morceaux.filter((m) => m.length > 1).map((m) => {
      const d = cheminLisse(m.map((i) => xs[i]), m.map((i) => y(s.points[i])));
      const aire = s.aire ? `<path class="g-aire" fill="url(#${id}-d${k})" d="${d} L${f(xs[m.at(-1)])} ${f(bas)} L${f(xs[m[0]])} ${f(bas)} Z"/>` : '';
      return `${aire}<path class="g-ligne" d="${d}"/>`;
    }).join('');

    // Points : tous quand ils sont peu nombreux, sinon seulement les points isolés et le dernier.
    const dernier = morceaux.at(-1)?.at(-1);
    const isoles = new Set(morceaux.filter((m) => m.length === 1).map((m) => m[0]));
    const points = s.points.map((v, i) => {
      if (typeof v !== 'number') return '';
      if (n > 16 && !isoles.has(i) && i !== dernier) return '';
      return `<circle class="g-point ${s.creux?.[i] ? 'g-creux' : ''}" cx="${f(xs[i])}" cy="${f(y(v))}" r="${n > 30 ? 3.5 : 4.5}"/>`;
    }).join('');

    const choisi = selection !== null && typeof s.points[selection] === 'number'
      ? `<circle class="g-point g-choisi ${s.creux?.[selection] ? 'g-creux' : ''}" cx="${f(xs[selection])}" cy="${f(y(s.points[selection]))}" r="7"/>`
      : '';
    return `<g class="${s.classe}">${lignes}${points}${choisi}</g>`;
  }).join('');

  // Repère de la période choisie : un trait sur toute la hauteur et son libellé au-dessus,
  // là où le doigt ne le cache pas.
  let trait = '';
  let bulle = '';
  if (selection !== null) {
    const texte = etiquettes[selection];
    const l = Math.max(44, texte.length * 7 + 16);
    const cx = Math.max(l / 2 + 1, Math.min(largeur - l / 2 - 1, xs[selection]));
    trait = `<line class="g-repere" x1="${f(xs[selection])}" x2="${f(xs[selection])}" y1="22" y2="${f(bas)}"/>`;
    bulle = `
      <rect class="g-bulle" x="${f(cx - l / 2)}" y="1" width="${l}" height="21" rx="10.5"/>
      <text class="g-bulle-texte" x="${f(cx)}" y="16" text-anchor="middle">${texte}</text>`;
  }

  return `<svg viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}" role="img" aria-label="${description}"><defs>${degrades}</defs>${grille}${axe}${trait}${traces}${bulle}</svg>`;
}
