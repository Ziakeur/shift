// Verrou par NIP : les calculs seulement (ni écran ni stockage).
// Le NIP n'est jamais enregistré. On garde un sel tiré au hasard et une empreinte du NIP
// (PBKDF2, SHA-256), impossible à relire à l'envers.
// Limite assumée : c'est un verrou d'écran. Les données de l'app ne sont pas chiffrées.

export const NIP_MIN = 4;
export const NIP_MAX = 8;
const ITERATIONS = 150000;

export function nipValide(nip) {
  return typeof nip === 'string' && nip.length >= NIP_MIN && nip.length <= NIP_MAX && /^\d+$/.test(nip);
}

const versTexte = (octets) => btoa(String.fromCharCode(...octets));
const versOctets = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

async function empreinte(nip, sel, iterations) {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(nip), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, cle, 256);
  return new Uint8Array(bits);
}

// Fabrique ce qu'on enregistre à la place du NIP.
export async function creerVerrou(nip, { iterations = ITERATIONS } = {}) {
  if (!nipValide(nip)) throw new Error(`Le NIP doit faire de ${NIP_MIN} à ${NIP_MAX} chiffres.`);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return { version: 1, sel: versTexte(sel), empreinte: versTexte(await empreinte(nip, sel, iterations)), iterations, longueur: nip.length };
}

export async function verifierNip(nip, verrou) {
  if (!verrou || !nipValide(nip)) return false;
  const attendu = versOctets(verrou.empreinte);
  const obtenu = await empreinte(nip, versOctets(verrou.sel), verrou.iterations);
  let ecart = attendu.length ^ obtenu.length;
  for (let i = 0; i < attendu.length; i++) ecart |= attendu[i] ^ obtenu[i];
  return ecart === 0;
}

// Pause imposée après des NIP faux à la suite, en secondes : rien jusqu'à 4 essais, puis de plus en plus long.
export function attenteApresEchecs(echecs) {
  if (echecs < 5) return 0;
  return [30, 60, 300][echecs - 5] ?? 900;
}

// Secondes à attendre encore. `essais` : { echecs, dernier } (dernier = heure du dernier NIP faux, en millisecondes).
export function secondesRestantes(essais, maintenant) {
  if (!essais?.echecs) return 0;
  const fin = essais.dernier + attenteApresEchecs(essais.echecs) * 1000;
  return Math.max(0, Math.ceil((fin - maintenant) / 1000));
}
