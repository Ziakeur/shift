# Shift : suivi d'heures de chantier (PWA)

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
| `js/recap.js` | Totaux par semaine, mois et année, jalons et ligne du temps de l'accueil (pur) |
| `js/db.js`, `js/etat.js` | IndexedDB, état en mémoire, export / import |
| `js/graphique.js` | Dessin des courbes en SVG, sans bibliothèque |
| `js/ui.js` | Formats, fenêtres de saisie, messages |
| `js/verrou.js` | Verrou par NIP : empreinte du NIP, vérification, pause après des NIP faux (pur) |
| `js/nip.js` | Clavier du NIP plein écran, ouverture de l'app, activer / changer / désactiver |
| `js/decor.js` | Dessins au trait du décor « plan de chantier » (ferme de toit, ossature) |
| `js/ecrans/*.js` | Un fichier par écran : accueil, jour, semaine, paie, carnet, réglages (un menu et une page par sujet : `#/reglages/emploi`, `#/reglages/horaires`…) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Mode hors ligne et installation |
| `tests/*.test.js` | Tests automatiques des calculs |
| `tools/serve.mjs`, `tools/icons.mjs`, `tools/donnees-fictives.mjs` | Serveur local, génération des icônes, sauvegarde de démonstration (données inventées, fichier `sauvegarde-fictive.json` jamais commité) |

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

Les tests couvrent les calculs (durées, minuit, changement d'heure, seuils d'heures supplémentaires par convention, changement de taux en cours de semaine, changement de réglage à partir d'une date, primes, carnet, récapitulatif par période, suites et cumuls des courbes, lissage des courbes, graduations, jalons et ligne du temps, verrou par NIP). L'interface, l'import/export et le mode hors ligne se vérifient à la main dans Chrome.

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
5. Commit, puis mise en ligne avec l'accord de l'utilisateur. L'app est hébergée sur GitHub Pages : dépôt public `Ziakeur/shift`, branche `master`, adresse https://ziakeur.github.io/shift/. Publier = envoyer les commits (PowerShell, dans `C:\Dev\CCQ App`) : `git push`. Le site se met à jour en une à deux minutes. Tout ce qui est commité devient public : vérifier avant chaque envoi qu'il n'y a ni donnée personnelle ni sauvegarde.
6. Sur le téléphone : ouvrir l'app avec du réseau, toucher « Mettre à jour » dans le bandeau.

Une mise à jour ne touche jamais aux données (IndexedDB). Si le format des données change, augmenter `VERSION_FORMAT` dans `js/etat.js` et compléter `normaliser()` pour que les anciennes sauvegardes restent lisibles.

## Renommer l'app
Changer le nom à trois endroits : `nom` dans `js/config.js`, `<title>` dans `index.html`, `name` et `short_name` dans `manifest.webmanifest`. Puis publier une nouvelle version.

## Régénérer les icônes
Les icônes viennent de l'image `icons/source-shift.png` (ruban à mesurer marqué d'un « S », fournie par l'utilisateur). Seulement si cette image change. PowerShell, dans `C:\Dev\CCQ App` :
```powershell
npm install --no-save sharp
node tools/icons.mjs
```
Le script produit l'icône ordinaire (coins arrondis transparents, 48, 192 et 512 px) et l'icône « maskable » (fond noir plein, ruban dans le cercle central, pour qu'Android puisse la rogner). Les mesures de l'image (carré arrondi, cercle qui contient le ruban, noir du fond `#0d0d0d`) sont écrites en tête de `tools/icons.mjs` : les refaire si l'image est remplacée. `background_color` et `theme_color` du manifeste portent le même noir, pour que l'écran de démarrage d'Android se fonde avec l'icône.

## Choix de conception à connaître
- La semaine de paie va du dimanche au samedi, réglable (Réglages, Affichage et semaine : « Ma semaine de paie va du »). Source : guide de la CCQ pour remplir le rapport mensuel (PD5277F), « la semaine de travail débute à 0 h 01 le dimanche et se termine à 0 h le samedi suivant », la période mensuelle se termine le dernier samedi du mois. La semaine **normale** de travail, elle, est de 40 h du lundi au vendredi (conventions 2025-2029, résidentiel art. 18.02, IC section XX). Le réglage décide donc seulement dans quelle semaine tombent le samedi et le dimanche.
- Chantiers : un chantier sert uniquement à garder la trace de l'endroit où l'utilisateur a travaillé chaque jour (traçabilité en cas de problème). Pas de notion « en cours / terminé » (un champ `actif` peut traîner dans d'anciennes sauvegardes : il est ignoré). La page « Mes chantiers » affiche le nombre de journées et les dates de chaque chantier. Un chantier noté sur des journées ne peut pas être supprimé, seulement renommé.
- Verrou par NIP (Réglages, Verrouillage par NIP ; désactivé au départ) : 4 chiffres exactement (choix de l'utilisateur, `NIP_LONGUEUR`), demandé à l'ouverture et au retour dans l'app après plus d'une minute ailleurs (`DELAI_VERROU_MS` dans `js/app.js`). C'est un **verrou d'écran, pas un chiffrement** : les données d'IndexedDB et le fichier de sauvegarde restent lisibles. Ne jamais le présenter comme une protection des données. Le NIP n'est pas enregistré : seulement un sel et une empreinte (PBKDF2), dans `kv` sous la clé `verrou`, à part des réglages, donc jamais dans une sauvegarde ; restaurer une sauvegarde ne retire pas le verrou. Après 5 NIP faux à la suite : pause de 30 s, 1 min, 5 min, puis 15 min (compteur gardé même si l'app est fermée). NIP oublié : pas de récupération possible ; « NIP oublié ? » efface tout sur l'appareil après deux confirmations, puis l'utilisateur restaure sa sauvegarde. Tant que le NIP n'est pas entré, rien n'est rendu dans `#ecran`.
- Décor « plan de chantier » (réglable : Réglages, Affichage et semaine, « Fond de l'app », `reglages.fond` = `plan` ou `uni`) : quadrillage de plan en fond de page, ferme de toit au-dessus du nom sur l'accueil, ossature de maison sur l'écran du NIP. Tout est en CSS et en SVG écrit à la main, aucune image externe. Le décor reste hors des cartes : il ne passe jamais derrière un chiffre.
- Un quart qui passe minuit est compté en entier sur le jour où il commence.
- Le fuseau est `America/Toronto` : une nuit de changement d'heure dure 1 h de moins ou de plus.
- Heures supplémentaires : heures au-delà du seuil par jour ou par semaine (lundi au vendredi), samedi, dimanche, fériés. Le choix « férié » fait sur une journée l'emporte sur la liste des fériés.
- L'indemnité de vacances (13 %) est affichée à part : l'employeur la verse à la CCQ, elle n'est pas dans le net de la paie.
- Carnet : les crédits de formation (DEP) restent en réserve tant que l'apprenti ne les utilise pas. C'est lui qui choisit si et quand. Il inscrit les heures « déjà utilisées » ; le reste raccourcit la fin de l'apprentissage. Ne jamais appliquer les crédits d'office.
- Saisie rapide : rien de ce qui dure (employeur, convention, échelon, taux) ne se ressaisit chaque jour. Le chantier de la veille est repris, les chantiers récents et les modèles d'horaire se choisissent en un appui, et l'écran Jour permet de basculer vers un profil déjà utilisé (« Changer » crée un profil daté du jour affiché, le passé ne bouge pas).
- Effacer : toujours une confirmation, jamais de suppression en un seul appui (heures d'une journée, journée entière depuis Jour ou Semaine).
- Accueil : écran d'ouverture par défaut (réglable : Accueil ou Jour, dans Réglages, Affichage et semaine). En haut, le jour et la semaine en cours, avec un bâton par jour de la semaine (un appui ouvre la journée). Puis les courbes « Mes gains et mes heures » : montants (brut estimé, net reçu) et heures, par semaine, par mois ou en cumul, sur 3 mois, 1 an ou tout. Sous les courbes : le total de la plage affichée, puis le détail de la période choisie. Plus bas, repliés : « Tout le détail » (semaine, mois, année) et la ligne du temps.
- Courbes au doigt (usage principal : téléphone) : un appui choisit une période, un glissement de côté la fait suivre le doigt, un glissement de haut en bas reste un défilement de la page et ne change pas la sélection. Les chiffres de la période choisie sont dans un bandeau au-dessus des courbes, qui reste collé en haut de l'écran pendant le geste (le doigt cache le point). Les zones touchées (`#g-argent`, `#g-heures`) ne sont jamais remplacées pendant un geste, seul leur contenu est redessiné : sinon le téléphone coupe le glissement. Ne pas écrire « survol » ni « souris » dans l'interface.
- Courbes lissées par interpolation monotone (`segmentsLisses` dans `js/graphique.js`, testée) : la courbe passe par chaque point et reste entre deux points voisins, donc jamais sous zéro et sans sommet inventé. Ne pas la remplacer par un lissage ordinaire.
- Courbes : deux graphiques séparés, jamais deux unités sur le même axe. Une semaine sans heures vaut zéro, elle n'est pas sautée. Le net n'est **jamais estimé** : il n'est tracé que là où il est saisi ; un point vide signale un mois dont le net n'est saisi que pour une partie des semaines.
- Récapitulatif : heures et brut estimé comptés jour par jour (une semaine à cheval sur deux mois est partagée, les primes suivent les heures) ; un talon compte dans le mois où la semaine se termine.
- Ligne du temps (accueil) : un ruban à mesurer, une graduation par semaine, la plus récente en haut. Jalons factuels seulement : première journée, changements de profil à leur date d'effet, premier jour sur un chantier, changement de taux de la grille, paliers de 500 h saisies, dernière sauvegarde. Pas de jalon « passage de période » : la date où des crédits sont utilisés n'est pas connue de l'app, le changement d'échelon vient du profil.
- Réglages, « Mon emploi » : chaque ligne (employeur, convention, échelon, taux, heures supplémentaires, vacances) se change séparément, avec la date du changement. `changerProfils` (dans `js/calcul.js`) crée le profil daté et fait suivre le changement aux profils plus tardifs qui avaient encore l'ancienne valeur. La case « erreur de saisie » corrige le profil en cours sans créer de date. L'historique, en dessous, permet de corriger ou supprimer une période entière. Dans l'interface on dit « réglage » ou « période », jamais « profil ».
- Couleurs des barres d'heures (`--s1`, `--s15`, `--s2`) et des courbes (`--c-brut`, `--c-net`), dans `css/style.css` : vérifiées pour les daltoniens sur fond sombre et clair. Ne pas les remplacer par le jaune et l'orange des étiquettes, trop proches l'un de l'autre.

## Limites connues, non couvertes
- Réserve d'heures du résidentiel (art. 19.04), taux de nuit, industrie lourde, primes d'équipe.
- Taux 2027-2028 en institutionnel-commercial et en génie civil, annexe D-1 : non lus, absents.
- Un seul quart par jour.
- Poids d'une heure supplémentaire au carnet : hypothèse 1 h = 1 h, réglable, à vérifier auprès de la CCQ.

## Travail en cours
La liste des demandes en attente et des vérifications restantes est dans `A_FAIRE.md`. La lire avant de reprendre le travail.
