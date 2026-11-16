# À faire

État au 15 novembre 2026 : version 0.1.2, lots 1 à 3 faits et testés, hors-ligne et logo faits. Rien n'est publié.
Cocher et retirer les lignes au fur et à mesure. Règles du projet : voir `CLAUDE.md`.

## 1. Sélection rapide sur l'écran Jour (demandé, pas commencé)
But : ne jamais ressaisir ce qui dure (employeur, convention, échelon, taux). Horaire et chantier en un appui.
- Chantier : remplacer la liste déroulante par des pastilles, les 4 chantiers les plus récents d'abord, puis « Autres… » et « ＋ Nouveau ». Appui sur la pastille active = aucun chantier.
- Ligne de contexte sous la date : « Employeur · Convention · Échelon · taux », avec « Changer ».
- « Changer » ouvre la liste des combinaisons déjà utilisées (profils de l'historique, sans doublon). Le choix crée un profil daté du jour affiché : il vaut pour ce jour et les suivants, pas pour le passé. Dernière option : « Autre réglage… » vers Réglages.
- Les modèles d'horaire et « Comme hier » existent déjà.

## 2. Effacer plus vite (demandé)
- Écran Jour : un bouton « Effacer les heures » près des champs début/fin (vide début, fin et pause, garde chantier et note), avec confirmation.
- Écran Jour : le bouton « Effacer cette journée » existe déjà, tout en bas, avec confirmation. Le rendre accessible sans défiler.
- Écran Semaine : effacer une journée directement depuis la liste (bouton sur la rangée), avec confirmation.
- Toujours une confirmation, jamais de suppression en un seul appui.

## 3. Page d'accueil (demandé, liberté de conception)
Nouvel écran d'ouverture, avant « Jour ». Ajouter l'onglet et le fichier `js/ecrans/accueil.js` (à inscrire dans `FICHIERS` de `sw.js`).

**Ligne du temps originale** de tout l'historique, de la première journée saisie à aujourd'hui. Idées à développer :
- un fil vertical qu'on fait défiler, un repère par semaine, dont la taille ou la couleur suit le nombre d'heures (simple, temps et demi, double) ;
- des jalons posés sur le fil : premier jour, changement d'employeur, de convention, d'échelon ou de taux (dates d'effet des profils), nouveau chantier, hausse de grille, passage de période au carnet, crédits utilisés, sauvegardes ;
- un appui sur un repère ouvre la semaine ou la journée ;
- thème du métier possible (mètre ruban, cernes du bois, charpente qui se monte), sans rien emprunter à la CCQ.

**Calendrier récapitulatif** : heures par semaine, par mois et par année, avec pour chaque ligne :
- heures totales, et répartition simple / temps et demi / temps double ;
- brut estimé en dollars canadiens (somme des semaines calculées) ;
- net en dollars canadiens : **somme des nets saisis depuis les talons seulement**. Ne pas estimer le net. Si des semaines de la période n'ont pas de net saisi, l'afficher (« net saisi pour 3 semaines sur 4 »).
- brut réel du talon quand il est saisi, pour voir l'écart cumulé.

Points à trancher en codant :
- une semaine à cheval sur deux mois : ventiler par jour pour les heures et le brut estimé ; le net d'un talon ne se découpe pas, le rattacher au mois où la semaine se termine et le dire à l'écran ;
- garder les calculs dans un module pur (`js/recap.js`) avec ses tests.

## 4. Lot 4, en attente de réponses
- **Nom** : Varlope, Madrier ou Colombage (aucune application connue trouvée sous ces noms, recherche rapide et non exhaustive). Nom provisoire : « Heures chantier ». Marche à suivre : `CLAUDE.md`, « Renommer l'app ».
- **Hébergement** : présenter GitHub Pages et Vercel avec leurs avantages, attendre le choix. Ne rien publier sans accord.
- Avant de publier : remplacer l'adresse neutre des commits par l'adresse « noreply » du compte GitHub choisi si besoin.

## 5. Vérifications restantes
- Revoir l'écran Carnet dans le navigateur depuis le passage à la réserve de crédits (seuls les calculs sont testés).
- Sur un vrai téléphone Android : installation sur l'écran d'accueil, sélecteur d'heure, partage de la sauvegarde vers Drive.
- Thème clair ; ouverture du CSV dans Excel.

## 6. Chiffres encore à vérifier sur source officielle
- Taux 2027-2028 en institutionnel-commercial (annexes C et C-1) et en génie civil ; annexe D-1.
- Poids d'une heure supplémentaire au carnet (hypothèse actuelle : 1 h = 1 h).
- Date d'effet exacte des colonnes 2027 et 2028 des annexes résidentielles.
