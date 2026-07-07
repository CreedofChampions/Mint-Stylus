---
title: "Les références avec Mint Stylus"
author:
  - The Mint Stylus Team
  - Framatophe (trad.)
date: 2020-07-04
keywords:
  - Zotero
  - JabRef
  - CSL JSON
  - BibTex
  - Reference Management
...

# Les références avec Mint Stylus 💬

Dans ce dernier guide, nous nous plongerons dans l'art de citer des références automatiquement en utilisant Mint Stylus ! Si vous avez déjà utilisé le plugin Zotero pour Word (ou même le plugin Citavi), rassurez-vous : cela fonctionne presque de la même manière, vous avez simplement beaucoup plus de liberté pour adapter les références à vos besoins !

Pour commencer à citer avec Mint Stylus, vous devrez mettre en place une base de données de références, [que nous décrivons dans notre documentation](https://docs.zettlr.com/fr/academic/citations/). Pour les besoins de ce tutoriel, nous avons déjà préparé une petite base de données qui couvrira tout ce dont vous avez besoin de savoir ! Chargeons-la ! Dans le répertoire du tutoriel, il y a un petit fichier appelé "references.json". Il contient quelques références que Mint Stylus peut citer. Pour le charger, allez d'abord dans les préférences et dans l'onglet « Citations ». Une fois là, naviguez vers le fichier en utilisant le navigateur de fichiers du champ « Fichier de références bibliographqiues », et enregistrez les préférences.

## Votre première référence 🎓

Mint Stylus chargera immédiatement le fichier et vous pourrez utiliser les références bibliographiques. Examinons la citation suivante, qui a certainement besoin d'être référencée :

> Il y a donc ici une antinomie, droit contre droit, tous deux portent le sceau de la loi qui règle l'échange des marchandises. **Entre deux droits égaux qui décide ? La Force.** Voilà pourquoi la réglementation de la journée de travail se présente dans l'histoire de la production capitaliste comme une lutte séculaire pour les limites de la journée de travail, lutte entre le capitaliste, c'est-à-dire la classe capitaliste, et le travailleur, c'est-à-dire la classe ouvrière.

C'est la fameuse citation de Karl Marx « entre deux droits égaux, la force décide » tirée de son _Capital_, volume 1. Ajoutons maintenant cette référence. Pour ce faire, tapez simplement le symbole `@` là où vous désirez ajouter la référence. Il y a trois moyens d'entrer une référence :

* Citer le nom de l'auteur dans le texte : `@clefdecitation` deviendra alors `Auteur (Année)`
* Citer le nom de l'auteur dans le texte avec une indication de page : `@clefdecitation [p. 123]`, ce qui deviendra ` Auteur (Année, p. 123)`
* Ou faire une citaiton complète : `[@clefdecitation, p. 123]`, ce qui donnera `(Auteur Année, p. 123)`

Revenons à notre citation, qui a toujours besoin d'être référencée : à la suite, pouvez-vous tenter d'ajouter une référence qui ressemble à `(Marx 1962, 23: 249)` ?

> Vous pouvez choisir la façon dont Mint Stylus complète automatiquement votre
> citation en fonction de vos besoins. Si vous utilisez régulièrement des
> notes de bas de page, le choix de la citation entre crochets devrait
> être votre choix par défaut. Si vous citez souvent le nom de famille
> de l'auteur dans le texte, l'autocomplétion des clés de
> citation `@clefdecitation []` fonctionne bien. Si, en plus, vous avez
> besoin de numéros de page ou d'autres informations,
> l'autocomplétion `@CiteKey []` fonctionne bien aussi. Si vous utilisez
> un style de citation en note de bas de page, il placera tout ce qui
> est placé entre crochets dans une note de bas de page - ainsi, en
> utilisant `@CiteKey`, seule la référence sera placée dans une note
> de bas de page, tandis que le nom de famille de l'auteur restera
> dans le texte.


Au cœur de Mint Stylus, il y a un puissant moteur capable de décortiquer ce que vous écrivez et d'en extraire des segments communs tels que les pages (`p.` et `pp.`), les chapitres (`chapter`) et les sections (`sec.` ou `§`), même en plusieurs langues !



## Les listes de références bibliographiques 💻

Dès lors que vous écrivez des articles longs ou même des livres, vous risquez d'oublier ce que vous avez déjà cité et ce qui doit encore l'être. Mint Stylus est capable d'afficher la liste complète de vos références dans la barre latérale. Ouvrez-la maintenant en cliquant à nouveau sur l'icône, et jetez un coup d'œil à la section « Références ». Vous remarquerez que le livre y est visible — et au fur et à mesure que vous continuerez à inclure des références, cette liste s'allongera !

> Si vous exportez un fichier à l'aide de Mint Stylus, celui-ci ajoutera
> automatiquement une liste de références sous le contenu du fichier.
> Vous pouvez l'en empêcher en utilisant
> l'[en-tête YAML](https://docs.zettlr.com/fr/core/yaml-frontmatter/).
> Il suffit d'ajouter la propriété `suppress-bibliography : true`. Vous
> pouvez également [personnaliser cette liste de références](https://docs.zettlr.com/fr/academic/citations/#formatage-de-la-liste-des-references).



## Réflexions finales 🔥

Ceci conclut notre brève introduction à Mint Stylus. Vous êtes prêt-e !

Une dernière chose que nous aimerions mentionner est la grande communauté de Mint Stylus. Nous ne pourrions jamais maintenir un outil aussi formidable sans l'aide de dizaines de personnes très motivées, qui accueillent les nouveaux venus, répondent aux questions et suggèrent des changements à l'application elle-même. Pensez à rejoindre la communauté sur autant de plateformes que possible et faites-vous entendre ! Une chose que vous pouvez certainement vérifier, c'est si ce tutoriel que vous venez de terminer est bon ou s'il nécessite quelques modifications. Si vous avez des suggestions d'amélioration, nous serons toujours ravis de vous écouter !

Vous pouvez rejoindre notre communauté ici :

- [Sur Discord](https://discord.gg/PcfS3DM9Xj)
- [Sur notre subreddit](https://www.reddit.com/r/Zettlr/)
- [Sur GitHub](https://github.com/Zettlr/Zettlr/)

Enfin, si vous le désirez, vous pouvez aussi soutenir Mint Stylus sur [Patreon](https://www.patreon.com/zettlr) ou via [PayPal](https://www.paypal.me/hendrikerz)!

Nous en avons maintenant terminé avec cette petite introduction et **nous vous souhaitons un agréable travail avec Mint Stylus !**

![zettlr.png](./zettlr.png)
