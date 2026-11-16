// Régénère les icônes PNG à partir des deux SVG du dossier icons/.
// À lancer seulement si le logo change (PowerShell, dans le dossier du projet) :
//   npm install --no-save sharp
//   node tools/icons.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const cibles = [
  ['icons/logo.svg', 'icons/icon-192.png', 192],
  ['icons/logo.svg', 'icons/icon-512.png', 512],
  ['icons/logo-maskable.svg', 'icons/maskable-192.png', 192],
  ['icons/logo-maskable.svg', 'icons/maskable-512.png', 512],
];
for (const [source, sortie, taille] of cibles) {
  await sharp(await readFile(source), { density: 300 }).resize(taille, taille).png().toFile(sortie);
  console.log(`${sortie} (${taille} px)`);
}
