# À faire

État au 16 novembre 2026 : version 0.3.0, nom « Shift ». Lots 1 à 3 faits, plus la sélection rapide, les boutons pour effacer, l'accueil avec courbes (essai, en attente de l'avis de l'utilisateur) et les réglages repensés (menu, « Mon emploi »). Hors-ligne et logo faits. Rien n'est publié.
Cocher et retirer les lignes au fur et à mesure. Règles du projet : voir `CLAUDE.md`.

## 0. Demandes du 16 novembre 2026, pas commencées (à faire en premier, dans cet ordre)

**a. Icône et écran de démarrage.** L'utilisateur a fourni une image : un ruban à mesurer jaune et noir marqué d'un « S », sur fond noir à coins arrondis. Elle est enregistrée dans `icons/source-shift.png` (1254 × 1254 px environ). S'en servir pour :
- l'icône du téléphone : `icons/icon-192.png`, `icons/icon-512.png` ;
- les icônes « maskable » (`maskable-192.png`, `maskable-512.png`) : fond noir uni jusqu'aux bords, le ruban dans les 80 % du centre, sinon Android le rogne ;
- l'écran de démarrage Android : il est fabriqué par Android à partir de `background_color`, de l'icône 512 et du nom dans `manifest.webmanifest`. Mettre `background_color` et `theme_color` au noir de l'image (le mesurer dans l'image, ne pas le deviner) ;
- l'icône d'onglet et `apple-touch-icon` dans `index.html` ; décider si `icons/logo.svg` (équerre-horloge) reste ou disparaît, et tenir `FICHIERS` de `sw.js` à jour ;
- adapter `tools/icons.mjs` (il part aujourd'hui des deux SVG ; `npm install --no-save sharp`).
Vérifier le rendu en petit (192 px, puis 48 px) : le « S » et le ruban doivent rester lisibles.

**b. Accueil, suite de l'essai des courbes.** « Améliore l'écran d'accueil, lisse les courbes. L'usage principal sera le téléphone : pas la souris sur la courbe, le doigt. »
- Courbes lissées dans `js/graphique.js` : interpolation monotone (la courbe ne doit ni dépasser les points ni descendre sous zéro), pas une simple courbe de Bézier.
- Pensé pour le doigt : zone tactile large, le doigt glisse le long de la courbe, la valeur lue s'affiche près du doigt ou dans un bandeau qui reste visible au-dessus du graphique (aujourd'hui le détail est sous les deux graphiques, donc souvent hors de l'écran pendant qu'on glisse). Garder le défilement vertical de la page. Retirer toute tournure pensée pour la souris.
- « Améliore » est ouvert : l'utilisateur veut du plus visuel. L'essai actuel n'a pas encore reçu d'avis détaillé ; montrer le résultat et demander ce qui plaît ou non.

**c. Chantiers : retirer la notion « en cours / terminé ».** Un chantier sert seulement à garder la trace de l'endroit où il a travaillé chaque jour, pour la traçabilité en cas de problème. À retirer : la case « Chantier en cours » du formulaire, le badge « terminé », le résumé « 6 chantiers en cours sur 6 » du menu Réglages, le filtre `actif` dans `js/ecrans/jour.js` (`chantiersParUsage`), le texte d'aide de la page « Mes chantiers ». Les anciennes sauvegardes peuvent contenir `actif: false` : l'ignorer, ne rien casser à l'import.

**d. Question posée : « Pourquoi tu dis que la semaine commence le dimanche ? Je ne comprends pas. »** Réponse donnée avant le compactage, non revérifiée sur source dans cette session : c'est la semaine de paie, sur laquelle se comptent les 40 h et donc les heures supplémentaires ; le rapport mensuel de l'employeur se termine le dernier samedi du mois. À faire : relire la source (convention, article sur la semaine normale de travail), puis reformuler le réglage pour qu'il se comprenne sans explication (par exemple « Ma semaine de paie va du … au … », avec une phrase sur l'effet). Si la source ne confirme pas, le dire et corriger.

Après chaque changement : `node --test`, version suivante (0.4.0) aux trois endroits, `FICHIERS` de `sw.js`, commit local. Rien n'est publié.

## 1. Lot 4, en attente de réponses
- **Nom** : « Shift », choisi par l'utilisateur le 16 novembre 2026. Beaucoup d'applications d'horaires portent un nom proche (Shiftboard, ShiftFox, Shift Calendar…) : sans importance pour un usage personnel, à revoir seulement si l'app est un jour proposée dans une boutique.
- **Hébergement** : GitHub Pages ou Vercel, au choix de l'utilisateur. Ne rien publier sans accord.
- Avant de publier : remplacer l'adresse neutre des commits par l'adresse « noreply » du compte GitHub choisi si besoin.

## 2. Vérifications restantes
- Sur un vrai téléphone Android : installation sur l'écran d'accueil, sélecteur d'heure, partage de la sauvegarde vers Drive, six onglets lisibles sur un petit écran.
- Passage d'une version installée plus ancienne à la 0.3.0 (bandeau « Nouvelle version prête ») : le mécanisme n'a pas changé depuis le test 0.1.0 vers 0.1.1, mais ce passage précis n'a pas été rejoué.
- Ouverture du CSV dans Excel.
- Courbes et ligne du temps avec plusieurs années d'historique (testées sur quatre mois de données fictives).
- Courbes au doigt sur un vrai téléphone (glisser sur la courbe sans gêner le défilement de la page).

## 3. Idées non demandées, à proposer avant de coder
- Jalon « crédits utilisés » sur la ligne du temps : il faudrait que l'app enregistre la date où les crédits sont versés.
- Vrai calendrier mensuel en grille (un carré par jour) en plus du récapitulatif par période.

## 4. Chiffres encore à vérifier sur source officielle
- Taux 2027-2028 en institutionnel-commercial (annexes C et C-1) et en génie civil ; annexe D-1.
- Poids d'une heure supplémentaire au carnet (hypothèse actuelle : 1 h = 1 h).
- Date d'effet exacte des colonnes 2027 et 2028 des annexes résidentielles.
