// Régénère les icônes PNG à partir de l'image icons/source-shift.png.
// À lancer seulement si l'image change (PowerShell, dans le dossier du projet) :
//   npm install --no-save sharp
//   node tools/icons.mjs
//
// Mesures faites sur l'image (1254 × 1254 px). Si l'image est remplacée, les refaire.
import sharp from 'sharp';

const SOURCE = 'icons/source-shift.png';
const COTE = 1254;
const FOND = { r: 13, g: 13, b: 13, alpha: 1 };       // noir médian du carré : #0d0d0d (aussi dans manifest.webmanifest)
const CARRE = { x0: 70, y0: 77, x1: 1183, y1: 1177 }; // carré arrondi de l'image
const SUJET = { cx: 641.5, cy: 676, rayon: 506 };     // plus petit cercle qui contient le ruban

// 1. Image « pleine » : le carré arrondi de la source fondu dans un fond noir uni, sans coins visibles.
const retrait = 34;
const masque = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${COTE}" height="${COTE}">
  <rect x="${CARRE.x0 + retrait}" y="${CARRE.y0 + retrait}" width="${CARRE.x1 - CARRE.x0 - 2 * retrait}" height="${CARRE.y1 - CARRE.y0 - 2 * retrait}" rx="230" fill="#fff"/>
</svg>`)).blur(12).png().toBuffer();
const decoupe = await sharp(SOURCE).ensureAlpha().composite([{ input: masque, blend: 'dest-in' }]).png().toBuffer();
const pleine = await sharp({ create: { width: COTE, height: COTE, channels: 4, background: FOND } })
  .composite([{ input: decoupe }]).png().toBuffer();

// Découpe un carré centré sur (cx, cy), en complétant avec le fond si on sort de l'image.
async function carre(cx, cy, cote) {
  const gauche = Math.round(cx - cote / 2);
  const haut = Math.round(cy - cote / 2);
  const marge = Math.max(0, -gauche, -haut, gauche + cote - COTE, haut + cote - COTE);
  const etendue = await sharp(pleine)
    .extend({ top: marge, bottom: marge, left: marge, right: marge, background: FOND }).png().toBuffer();
  return sharp(etendue).extract({ left: gauche + marge, top: haut + marge, width: cote, height: cote }).png().toBuffer();
}

// 2. Icône « maskable » : Android la rogne (rond, carré arrondi…). Le ruban tient dans un cercle
//    de 76 % de la largeur, sous la zone garantie de 80 %.
const coteMasque = Math.round((SUJET.rayon * 2) / 0.76);
const maskable = await carre(SUJET.cx, SUJET.cy, coteMasque);

// 3. Icône ordinaire : le carré de l'image, coins arrondis transparents.
const coteIcone = 1090;
const brute = await carre((CARRE.x0 + CARRE.x1) / 2, (CARRE.y0 + CARRE.y1) / 2, coteIcone);
const coins = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${coteIcone}" height="${coteIcone}">
  <rect width="${coteIcone}" height="${coteIcone}" rx="${Math.round(coteIcone * 0.22)}" fill="#fff"/>
</svg>`);
const icone = await sharp(brute).composite([{ input: coins, blend: 'dest-in' }]).png().toBuffer();

const cibles = [
  [icone, 'icons/icon-192.png', 192],
  [icone, 'icons/icon-512.png', 512],
  [icone, 'icons/icon-48.png', 48],
  [maskable, 'icons/maskable-192.png', 192],
  [maskable, 'icons/maskable-512.png', 512],
];
for (const [image, sortie, taille] of cibles) {
  await sharp(image).resize(taille, taille, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(sortie);
  console.log(`${sortie} (${taille} px)`);
}
