# À faire

État au 17 novembre 2026 : version 0.6.0 en ligne (voir section 0) ; avant elle, version 0.5.2 (aide-mémoire « Convention collective », mention de l'auteur) en ligne depuis le 17 novembre 2026 sur https://ziakeur.github.io/shift/, nom « Shift ». Faits : lots 1 à 3, sélection rapide, boutons pour effacer, accueil avec courbes lissées et lecture au doigt, réglages repensés, icône tirée de l'image fournie, chantiers sans « en cours / terminé », réglage « Ma semaine de paie va du ».
Cocher et retirer les lignes au fur et à mesure. Règles du projet : voir `CLAUDE.md`.

## 0. Version 0.6.0 en ligne le 17 novembre 2026 (accord de l'utilisateur)
- Demandée par l'utilisateur (propositions 2, 5, 6, 7) : jours oubliés et motif « pas travaillé », primes à cocher par jour, relevé imprimable en PDF, paies de vacances par semestre (écran Paie).
- Vérifié dans un Chrome de test au format téléphone (390 px), données fictives : carte des jours à compléter, marquage en lot, motif sur l'écran Jour avec confirmation si des heures existent, Semaine, prime cochée comptée dans Paie, carte des vacances, relevé à l'écran sans défilement de côté et en mode impression.
- Pas vu sur un vrai téléphone : impression depuis l'app installée (`window.print()` en mode application Android non vérifié).
- Dates de versement des vacances lues sur ccq.org le 17 novembre 2026 (résidentiel 24.02, IC et industriel 19.05) ; article du génie civil non trouvé (adresse en 404), la page générale « Paies de vacances » de la CCQ couvre tout le monde.

## 0 ter. Fait le 17 novembre 2026 : version 0.5.2 en ligne (accord de l'utilisateur)
- **Version 0.5.2** : mention « Idée originale et conception : Aurélien Vincent » et adresse de contact (`auteur`, `contact` dans `js/config.js`), dans Réglages, À propos seulement (choix de l'utilisateur, qui accepte que son nom soit public).
- **Réglages, Aide-mémoire, « Convention collective »** (`js/convention.js`) : 4 onglets (résidentiel, IC, industriel, génie civil), s'ouvre sur le secteur du réglage en cours (★), 19 sujets repliables par secteur avec article et lien vers ccq.org. Taux repris de `GRILLES`. Textes lus le 17 novembre 2026 dans les conventions officielles ; chiffres clés recontrôlés dans le texte (déplacement, pension, repas, bottes et casque, préavis, présence).
- Vérifié dans un Chromium de test au format téléphone (390 px) : pas de défilement de côté, onglets, sujets repliables, entrée du menu. Pas vu sur un vrai téléphone.
- **À vérifier, signalé dans l'app** : « Temps d'attente » en résidentiel, IC et industriel (aucun article trouvé).
- **Doutes notés dans l'app, à lever si l'utilisateur le souhaite** : samedi en IC et industriel (pas de règle à part, traité comme heure supplémentaire ordinaire) ; gants de sécurité en IC et industriel (art. 25.05 1) et 4) b) se contredisent) ; 17 $ de repas pour une simple journée de 10 h en IC et industriel ; liste d'outils du génie civil (annexe I) et annexes de taux D non lues ; congés de maladie de la Loi sur les normes du travail (annexes M, Q, Z-10) non lus.

## 0 bis. En attente de l'avis de l'utilisateur
- **Version 0.5.0 en ligne** depuis le 16 novembre 2026, avec l'accord de l'utilisateur. Vérifié sur le site public dans un Chrome de test : passage 0.4.0 vers 0.5.0 par le bandeau « Mettre à jour », NIP hors ligne. Toute nouvelle publication demande de nouveau son accord.
- **NIP** : testé dans un Chrome de test (activer, ouvrir, NIP faux, blocage après 5 essais, retour après une absence, NIP oublié, hors ligne). Pas testé sur un vrai téléphone : bouton retour d'Android sur l'écran du NIP, retour dans l'app après une minute.
- **Fond** : la demande était « peut-être un fond en rapport avec la construction ». Fait : quadrillage de plan, ferme de toit sur l'accueil, ossature sur l'écran du NIP. À faire valider ; se coupe dans Réglages, Affichage et semaine.
- **Accueil** (version 0.4.0) : courbes lissées, bandeau de chiffres qui suit le doigt, bâtons de la semaine en cours. C'est toujours un essai : demander ce qui plaît ou non avant d'aller plus loin.
- **Icône** : faite à partir de `icons/source-shift.png`. À voir sur le téléphone une fois l'app installée (icône ronde ou carrée selon le téléphone, écran de démarrage).
- **Chantiers** : ajout non demandé, à confirmer : un chantier noté sur des journées ne peut plus être supprimé (seulement renommé), pour ne pas perdre la trace. Si ça gêne, retirer `supprimer: !usage.nb` dans `defChantier` (`js/ecrans/reglages.js`).

## 1. Lot 4 : publié le 16 novembre 2026
- **Nom** : « Shift », choisi par l'utilisateur. Beaucoup d'applications d'horaires portent un nom proche (Shiftboard, ShiftFox, Shift Calendar…) : sans importance pour un usage personnel, à revoir seulement si l'app est un jour proposée dans une boutique.
- **Hébergement** : GitHub Pages, choisi par l'utilisateur. Dépôt public `Ziakeur/shift`, adresse https://ziakeur.github.io/shift/. Vérifié en ligne dans un Chrome de test : ouverture, HTTPS forcé, installable, hors ligne, app vide au départ.
- Chaque nouvelle publication (`git push`) demande l'accord de l'utilisateur.
- La branche locale `avant-publication` garde l'historique d'avant la signature des commits avec l'adresse anonyme du compte ; elle n'est pas envoyée et peut être supprimée.
- À faire par l'utilisateur : installer l'app sur son téléphone, activer la validation en deux étapes sur son compte GitHub (non vérifiable d'ici).

## 2. Vérifications restantes
- Sur un vrai téléphone Android : installation sur l'écran d'accueil, icône et écran de démarrage, sélecteur d'heure, partage de la sauvegarde vers Drive, six onglets lisibles sur un petit écran.
- Courbes au doigt sur un vrai téléphone. Testé seulement dans Chrome sur PC avec un doigt simulé (appui, glissement de côté, défilement vertical, bandeau collé en haut).
- Ouverture du CSV dans Excel.
- Courbes et ligne du temps avec plusieurs années d'historique (testées sur quatre mois de données fictives).
- Fait le 16 novembre 2026 dans un Chrome de test : passage 0.3.0 vers 0.4.0 (bandeau « Nouvelle version prête », « Mettre à jour », données intactes) et ouverture hors ligne.

## 3. Idées non demandées, à proposer avant de coder
- Jalon « crédits utilisés » sur la ligne du temps : il faudrait que l'app enregistre la date où les crédits sont versés.
- Vrai calendrier mensuel en grille (un carré par jour) en plus du récapitulatif par période.
- Liste « où j'étais, jour par jour » pour un chantier (aujourd'hui : nombre de journées et dates de début et de fin ; le détail par jour est dans l'export CSV).

## 4. Chiffres encore à vérifier sur source officielle
- Taux 2027-2028 en institutionnel-commercial (annexes C et C-1) et en génie civil ; annexe D-1.
- Poids d'une heure supplémentaire au carnet (hypothèse actuelle : 1 h = 1 h).
- Date d'effet exacte des colonnes 2027 et 2028 des annexes résidentielles.
- Semaine de paie : la CCQ compte les semaines du dimanche au samedi pour le rapport mensuel (guide PD5277F, lu le 16 novembre 2026). Que la paie de chaque employeur suive ce découpage n'est pas vérifié : l'utilisateur le voit sur son talon.
