# Suivi d'heures de chantier (PWA)

## À quoi sert l'app
Application web installable sur Android (Chrome), utilisable sans réseau, pour un apprenti charpentier-menuisier au Québec :
1. noter ses heures chaque jour en quelques secondes ;
2. voir sa semaine (temps simple, temps et demi, temps double) ;
3. estimer sa paie brute et la comparer au talon ;
4. suivre son carnet d'apprentissage et le comparer aux heures déclarées à la CCQ.

Application **personnelle, non officielle**. Ne jamais utiliser le nom ni le logo de la CCQ dans le nom de l'app, l'icône ou la présentation. La mention « application personnelle, non officielle » (dans `js/config.js`, affichée dans Réglages, À propos) doit rester.

L'utilisateur n'est pas développeur : répondre en français, court et direct, et donner les commandes exactes à copier-coller en précisant où les lancer (PowerShell Windows).

## Règles du projet
- **Rien n'est figé.** Convention, échelon, taux, horaires, règles d'heures supplémentaires, primes, fériés, début de semaine : tout est un réglage modifiable dans l'app. Ne rien coder en dur qui dépende de l'employeur ou du contrat.
- **Historique.** Un changement (taux, échelon, convention, employeur) est un nouveau profil avec une date d'effet. Les semaines passées gardent leur ancien profil. Ne jamais modifier un calcul d'une façon qui réécrit le passé.
- **Aucun chiffre non vérifié.** Un taux, un seuil ou une règle n'entre dans `js/grilles.js` que s'il a été lu sur une source officielle (ccq.org, texte d'une convention collective 2025-2029, sqi.gouv.qc.ca, acq.org, apchq.com). Chaque grille porte sa date d'effet, sa source et un statut. Si ce n'est pas vérifié : laisser absent, l'app affiche « à vérifier » et demande un taux personnalisé. Ne jamais déduire un taux par pourcentage.
- **Pas d'estimation des déductions** (impôts, RRQ, AE, RQAP, cotisations) : l'utilisateur saisit son net.
- **Aucune donnée personnelle dans le dépôt** : ni nom, ni heures, ni sauvegarde. Les fichiers `sauvegarde-*.json` et `heures-*.csv` sont dans `.gitignore`.
- **Aucun serveur, aucun compte.** Les données restent dans IndexedDB sur le téléphone. Seuls les exports choisis par l'utilisateur sortent de l'appareil.
- **Code simple.** HTML, CSS et JavaScript (modules ES) sans framework ni étape de compilation. Pas de dépendance à l'exécution.
- **Ne rien publier sans accord explicite.**

## Organisation des fichiers
| Fichier | Rôle |
|---|---|
| `index.html`, `css/style.css` | Page unique et style (sombre par défaut, clair en option) |
| `js/config.js` | Nom, version, mention non officielle |
| `js/temps.js` | Dates, durées, quart qui passe minuit, changement d'heure (pur) |
| `js/grilles.js` | Grilles de taux sourcées, préréglages d'heures supplémentaires, fériés, règles du carnet |
| `js/calcul.js` | Répartition simple / majoré, paie de la semaine, primes (pur) |
| `js/carnet.js` | Périodes d'apprentissage, estimation, période du rapport mensuel (pur) |
| `js/db.js`, `js/etat.js` | IndexedDB, état en mémoire, export / import |
| `js/ui.js` | Formats, fenêtres de saisie, messages |
| `js/ecrans/*.js` | Un fichier par écran : jour, semaine, paie, carnet, réglages |
| `sw.js`, `manifest.webmanifest`, `icons/` | Mode hors ligne et installation |
| `tests/*.test.js` | Tests automatiques des calculs |
| `tools/serve.mjs`, `tools/icons.mjs` | Serveur local, génération des icônes |

Les fichiers marqués « pur » ne touchent ni à l'écran ni au stockage : toute nouvelle règle de calcul va là, avec son test.

## Lancer l'app en local
PowerShell, dans `C:\Dev\CCQ App` :
```powershell
node tools/serve.mjs
```
Puis ouvrir http://localhost:8080 dans Chrome. Format téléphone : F12, puis l'icône téléphone (Ctrl+Maj+M). Arrêt : Ctrl+C.

Après une modification, si l'ancienne version s'affiche encore : c'est le mode hors ligne qui la garde. Augmenter la version (voir « Publier ») ou, dans F12, Application, Service workers, cocher « Update on reload ».

## Lancer les tests
PowerShell, dans `C:\Dev\CCQ App` :
```powershell
node --test
```
Tout doit être vert avant un commit. Toute nouvelle logique de calcul vient avec son test dans `tests/`.

Les tests couvrent les calculs (durées, minuit, changement d'heure, seuils d'heures supplémentaires par convention, changement de taux en cours de semaine, primes, carnet). L'interface, l'import/export et le mode hors ligne se vérifient à la main dans Chrome.

## Mettre à jour une grille de taux
Deux façons.

**Dans l'app (sans toucher au code)** : Réglages, Grilles de taux, « Ajouter une grille » ou toucher une grille existante. La grille saisie remplace la grille intégrée de même secteur et de même date. Elle reste sur le téléphone et part dans la sauvegarde.

**Dans le code (pour tout le monde, durable)** :
1. Lire le taux sur une source officielle : outil « Salaire et taux » de la CCQ, annexe de la convention, ou tableau de la SQI. Noter l'URL et la date d'effet.
2. Dans `js/grilles.js`, ajouter une ligne à `GRILLES` :
   ```js
   g('ic', false, '2027-04-25', [compagnon, apprenti1, apprenti2, apprenti3], { source: '…', url: '…' }),
   ```
   Secteurs : `ic`, `industriel`, `gcv`, `res-leger`, `res-lourd`. Le 2e argument est `true` pour chantier isolé, Baie-James, nord du 55e.
3. Si la date d'effet n'est pas écrite dans la source, mettre `statut: 'date-a-verifier'` et une `note`.
4. Retirer la ligne correspondante de `GRILLES_MANQUANTES` et mettre à jour `PROCHAINE_HAUSSE`.
5. Ajouter la valeur lue au test « grilles : valeurs lues sur les sources » dans `tests/calcul.test.js`, puis `node --test`.
6. Publier une nouvelle version.

Même démarche pour les règles d'heures supplémentaires (`PREREGLAGES`, avec l'article de la convention dans `source`) et les jours fériés (`FERIES`).

## Publier une nouvelle version
1. `node --test` : tout vert.
2. Augmenter le numéro de version **aux deux endroits, avec la même valeur** : `version` dans `js/config.js` et `VERSION` dans `sw.js` (et `version` dans `package.json`). Sans cela, les téléphones gardent l'ancienne version hors ligne.
3. Si un fichier a été ajouté à l'app, l'ajouter à la liste `FICHIERS` de `sw.js`, sinon il manquera hors ligne.
4. Vérifier dans Chrome en local : l'app s'ouvre, le bandeau « Nouvelle version prête » apparaît, « Mettre à jour » recharge, les données sont intactes.
5. Commit, puis mise en ligne sur l'hébergement choisi (avec l'accord de l'utilisateur).
6. Sur le téléphone : ouvrir l'app avec du réseau, toucher « Mettre à jour » dans le bandeau.

Une mise à jour ne touche jamais aux données (IndexedDB). Si le format des données change, augmenter `VERSION_FORMAT` dans `js/etat.js` et compléter `normaliser()` pour que les anciennes sauvegardes restent lisibles.

## Renommer l'app
Changer le nom à trois endroits : `nom` dans `js/config.js`, `<title>` dans `index.html`, `name` et `short_name` dans `manifest.webmanifest`. Puis publier une nouvelle version.

## Régénérer les icônes
Seulement si `icons/logo.svg` ou `icons/logo-maskable.svg` change. PowerShell, dans `C:\Dev\CCQ App` :
```powershell
npm install --no-save sharp
node tools/icons.mjs
```

## Choix de conception à connaître
- La semaine va du dimanche au samedi (semaine de paie de la construction), réglable.
- Un quart qui passe minuit est compté en entier sur le jour où il commence.
- Le fuseau est `America/Toronto` : une nuit de changement d'heure dure 1 h de moins ou de plus.
- Heures supplémentaires : heures au-delà du seuil par jour ou par semaine (lundi au vendredi), samedi, dimanche, fériés. Le choix « férié » fait sur une journée l'emporte sur la liste des fériés.
- L'indemnité de vacances (13 %) est affichée à part : l'employeur la verse à la CCQ, elle n'est pas dans le net de la paie.
- Carnet : les crédits de formation (DEP) restent en réserve tant que l'apprenti ne les utilise pas. C'est lui qui choisit si et quand. Il inscrit les heures « déjà utilisées » ; le reste raccourcit la fin de l'apprentissage. Ne jamais appliquer les crédits d'office.
- Saisie rapide : rien de ce qui dure (employeur, convention, échelon, taux) ne se ressaisit chaque jour. Le chantier de la veille est repris, les chantiers récents et les modèles d'horaire se choisissent en un appui, et l'écran Jour permet de basculer vers un profil déjà utilisé.

## Limites connues, non couvertes
- Réserve d'heures du résidentiel (art. 19.04), taux de nuit, industrie lourde, primes d'équipe.
- Taux 2027-2028 en institutionnel-commercial et en génie civil, annexe D-1 : non lus, absents.
- Un seul quart par jour.
- Poids d'une heure supplémentaire au carnet : hypothèse 1 h = 1 h, réglable, à vérifier auprès de la CCQ.
