// Petits outils d'interface : échappement HTML, formats, messages, fenêtres de saisie.

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmtArgent = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
const fmtNombre = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 });

export const argent = (n) => (typeof n === 'number' && Number.isFinite(n) ? fmtArgent.format(n) : '—');
export const nombre = (n, dec) => (typeof n === 'number' && Number.isFinite(n)
  ? (dec === undefined ? fmtNombre.format(n) : new Intl.NumberFormat('fr-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n))
  : '—');

// « 30,5 » ou « 30.5 » -> 30.5 ; vide ou invalide -> null
export function lireNombre(v) {
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

let minuterieToast = null;
export function toast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { el.hidden = true; }, type === 'erreur' ? 6000 : 2500);
}

function ouvrirDialogue(html) {
  const d = document.createElement('dialog');
  d.className = 'feuille';
  d.innerHTML = html;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

// Demande de confirmation. Retourne une promesse : true ou false.
export function confirmer({ titre, texte = '', oui = 'Confirmer', non = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const d = ouvrirDialogue(`
      <form method="dialog" class="feuille-corps">
        <h2>${esc(titre)}</h2>
        ${texte ? `<p>${esc(texte)}</p>` : ''}
        <div class="actions">
          <button value="non" class="btn">${esc(non)}</button>
          <button value="oui" class="btn ${danger ? 'btn-danger' : 'btn-principal'}">${esc(oui)}</button>
        </div>
      </form>`);
    d.addEventListener('close', () => resolve(d.returnValue === 'oui'));
  });
}

const JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function champHTML(c) {
  const id = `f-${c.nom}`;
  const aide = c.aide ? `<small class="aide">${esc(c.aide)}</small>` : '';
  const attrs = `id="${id}" name="${esc(c.nom)}" ${c.requis ? 'required' : ''} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}`;
  if (c.type === 'titre') return `<h3 class="sous-titre">${esc(c.label)}</h3>${aide}`;
  if (c.type === 'case') {
    return `<label class="case"><input type="checkbox" ${attrs} ${c.valeur ? 'checked' : ''}><span>${esc(c.label)}</span></label>${aide}`;
  }
  if (c.type === 'choix') {
    const opts = c.options.map((o) => `<option value="${esc(o.valeur)}" ${String(o.valeur) === String(c.valeur ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<label class="champ"><span>${esc(c.label)}</span><select ${attrs}>${opts}</select>${aide}</label>`;
  }
  if (c.type === 'jours') {
    const sel = new Set(c.valeur ?? []);
    const cases = JOURS_COURTS.map((l, i) => `<label class="jour-case"><input type="checkbox" name="${esc(c.nom)}" value="${i}" ${sel.has(i) ? 'checked' : ''}><span>${l}</span></label>`).join('');
    return `<div class="champ"><span>${esc(c.label)}</span><div class="jours-cases">${cases}</div>${aide}</div>`;
  }
  if (c.type === 'texte-long') {
    return `<label class="champ"><span>${esc(c.label)}</span><textarea ${attrs} rows="3">${esc(c.valeur ?? '')}</textarea>${aide}</label>`;
  }
  const type = c.type === 'nombre' ? 'text' : (c.type ?? 'text');
  const extra = c.type === 'nombre' ? 'inputmode="decimal" autocomplete="off"' : '';
  const valeur = c.type === 'nombre' && typeof c.valeur === 'number' ? String(c.valeur).replace('.', ',') : (c.valeur ?? '');
  return `<label class="champ"><span>${esc(c.label)}</span><input type="${type}" ${extra} ${attrs} value="${esc(valeur)}">${aide}</label>`;
}

function lireChamps(form, champs) {
  const out = {};
  for (const c of champs) {
    if (c.type === 'titre') continue;
    if (c.type === 'case') out[c.nom] = form.elements[c.nom].checked;
    else if (c.type === 'jours') out[c.nom] = [...form.querySelectorAll(`input[name="${c.nom}"]:checked`)].map((i) => Number(i.value));
    else if (c.type === 'nombre') out[c.nom] = lireNombre(form.elements[c.nom].value);
    else out[c.nom] = form.elements[c.nom].value.trim();
  }
  return out;
}

// Fenêtre de saisie. Retourne une promesse :
//   { action: 'ok', valeurs } | { action: 'supprimer' } | null (annulé)
// `valider(valeurs)` peut retourner un message d'erreur à afficher.
// `surChangement(form)` est appelé à chaque modification (pour griser ou préremplir des champs).
export function formulaire({ titre, intro = '', champs, supprimer = false, valider, surChangement, ok = 'Enregistrer' }) {
  return new Promise((resolve) => {
    const d = ouvrirDialogue(`
      <form class="feuille-corps" novalidate>
        <h2>${esc(titre)}</h2>
        ${intro ? `<p class="aide">${esc(intro)}</p>` : ''}
        ${champs.map(champHTML).join('')}
        <p class="erreur" hidden></p>
        <div class="actions">
          ${supprimer ? '<button type="button" class="btn btn-danger" data-act="supprimer">Supprimer</button>' : ''}
          <button type="button" class="btn" data-act="annuler">Annuler</button>
          <button type="submit" class="btn btn-principal">${esc(ok)}</button>
        </div>
      </form>`);
    const form = d.querySelector('form');
    const erreur = d.querySelector('.erreur');
    let resultat = null;
    if (surChangement) {
      form.addEventListener('input', () => surChangement(form));
      surChangement(form);
    }
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const valeurs = lireChamps(form, champs);
      const manquant = champs.find((c) => c.requis && (valeurs[c.nom] === '' || valeurs[c.nom] === null));
      const message = manquant ? `Il manque : ${manquant.label}.` : valider?.(valeurs);
      if (message) {
        erreur.textContent = message;
        erreur.hidden = false;
        return;
      }
      resultat = { action: 'ok', valeurs };
      d.close();
    });
    d.querySelector('[data-act="annuler"]').addEventListener('click', () => d.close());
    d.querySelector('[data-act="supprimer"]')?.addEventListener('click', () => { resultat = { action: 'supprimer' }; d.close(); });
    d.addEventListener('close', () => resolve(resultat));
  });
}

// Choix dans une liste de gros boutons. Retourne la valeur choisie ou null.
export function choisir({ titre, texte = '', options }) {
  return new Promise((resolve) => {
    const d = ouvrirDialogue(`
      <div class="feuille-corps">
        <h2>${esc(titre)}</h2>
        ${texte ? `<p class="aide">${esc(texte)}</p>` : ''}
        <div class="pile">
          ${options.map((o, i) => `<button type="button" class="btn btn-large" data-i="${i}">${esc(o.label)}${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}
        </div>
        <div class="actions"><button type="button" class="btn" data-act="annuler">Annuler</button></div>
      </div>`);
    let resultat = null;
    d.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.i !== undefined) resultat = options[Number(b.dataset.i)].valeur;
      d.close();
    });
    d.addEventListener('close', () => resolve(resultat));
  });
}

// Enregistre un fichier sur l'appareil.
export function telecharger(nomFichier, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Propose le partage Android (Drive, courriel…) si l'appareil le permet.
// Retourne 'partage', 'annule' (l'utilisateur a fermé la fenêtre) ou 'indisponible'.
export async function partager(nomFichier, contenu, type, titre) {
  try {
    const fichier = new File([contenu], nomFichier, { type });
    if (!navigator.canShare?.({ files: [fichier] })) return 'indisponible';
    await navigator.share({ files: [fichier], title: titre });
    return 'partage';
  } catch (e) {
    return e?.name === 'AbortError' ? 'annule' : 'indisponible';
  }
}

export function lienCarte(ch) {
  const q = [ch?.adresse, ch?.ville].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + ', Québec')}` : null;
}
