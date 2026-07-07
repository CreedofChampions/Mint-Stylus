---
title: "Arbeiten mit Zettelkästen"
keywords:
  - Zettelkasten
  - Zettel
  - Knowledge Management
  - Niklas Luhmann
...

# Zettelkästen mit Mint Stylus 🗂

Was du soeben angeklickt hast ist ein „interner Link“ innerhalb von Mint Stylus. Diese erinnern stark an Wiki-Links, sind aber eigentlich ein mächtiges Feature von Mint Stylus, welches der App hilft, die Organisation deines Wissens nachzuvollziehen. Lass uns zunächst nachverfolgen, was passiert ist, nachdem du auf den Link geklickt hast.

Immer wenn du einem solchen internen Link folgst, passieren zwei Dinge: Mint Stylus startet eine Volltextsuche nach dem Inhalt des Links und versucht gleichzeitig, eine Datei gemäß der Link-Inhalte zu öffnen. Wie du sehen kannst, hat sich die Datei-Liste verändert und zeigt jetzt Suchergebnisse nach dem Wort „zettelkasten“ an und Mint Stylus hat die Datei „zettelkasten.md“ geöffnet.

Die Volltextsuche und der Dateimanager teilen sich die linke Seitenleiste. Du kannst zwischen beiden mit dem Dreiwege-Schalter oben links in der Werkzeugleiste wechseln.

## Dateien miteinander verlinken 🗄

Um Dateien innerhalb von Mint Stylus miteinander zu verlinken, gibt es grundsätzlich zwei Arten, wie das geschehen kann: entweder mit einer ID, oder mit dem Dateinamen (ohne Dateinamenerweiterung). Das heißt, wenn du eine Datei mit Namen „Zettelkasten.md“ in Mint Stylus geladen hast, kannst du mit `[[Zettelkasten]]` auf sie verweisen. Bei einem Klick mit gedrückter `Cmd` oder `Strg`-Taste auf einen solchen, internen Link versucht Mint Stylus, eine entsprechende Datei zu finden und sie zu öffnen.

> Bitte beachte, dass eine verlinkte Datei auch in Mint Stylus geladen sein muss. Mint Stylus durchsucht nicht deinen kompletten Computer nach solchen Dateien, weil das einerseits zu unerwünschtem Verhalten führen könnte und weil andererseits die interne Suche nach Dateien einige Dinge erfordert, die beim Laden der Dateien in Mint Stylus erfolgen.

Das funktioniert natürlich nur, solange sich die Dateinamen nicht verändern. Daher gibt es noch eine weitere, vermutlich bessere Methode, Dateien untereinander zu verlinken: Mittels einzigartiger IDs. IDs sind (gemäß der Standard-Einstellungen) eine Reihe von 14 aufeinanderfolgende Zahlen. Um eine neue ID zu erstellen, genügt es, in einer Datei `Cmd/Strg+L` zu drücken. Versuche das am besten hier hinter dem Doppelpunkt einmal:

Jetzt hat diese Datei eine ID, welche du zur Verlinkung verwenden kannst! Wenn du nun mit `[[` beginnst, einen internen Link zu erstellen, und diese Datei aus der Liste auswählst, sollte Mint Stylus automatisch die neu hinzugefügte ID verlinken und nicht mehr den Dateinamen.

> Du kannst die Art und Weise, wie Mint Stylus intern verlinkt, komplett anpassen, um auch bereits bestehende Systeme in Mint Stylus weiter zu benutzen. Weitere Informationen findest du in der [Dokumentation](https://docs.zettlr.com/de/academic/zkn-method/).

Interne Links sind aber natürlich noch weitaus mächtiger – so musst du nicht notwendigerweise auf existierende Dateien verweisen, sondern du kannst auch oft benutzte Suchanfragen darin verlinken. Denn selbst wenn Mint Stylus keine entsprechende Datei findet, führt die App zumindest die Suche aus. Du kannst also Dinge wie die folgenden machen:

- `[[#zettelkasten !Luhmann]]` würde eine Suche nach Dateien beginnen, die das Schlagwort „Zettelkasten“ enthalten, aber nicht das Wort Luhmann.
- `[["Knowledge Management" | Zettelkasten Luhmann #archiv]]` würde eine Suche nach Dateien beginnen, welche die Worte „Knowledge Management“ oder Zettelkasten, zusätzlich „Luhmann“ und das Schlagwort „archiv“ enthalten.

> Wenn du Wikilinks zum automatischen Suchen nutzen willst, solltest du darauf achten, dass die Option für das automatische Erstellen von Dateien ausgeschaltet ist, weil Mint Stylus ansonsten jedes Mal versuchen würde, eine Datei mit dem Inhalt als Dateinamen zu erstellen.

## Verschlagwortung 🏷

Während interne Links also direkte Beziehungen zwischen zwei konkreten Dateien herstellen, verfügt Mint Stylus aber auch über die Fähigkeit, mittels Verschlagwortung mehrere Dateien verschiedenen Kategorien zuzuordnen (ähnlich wie das beispielsweise auch in Zotero funktioniert). Solche Schlagworte funktionieren in Mint Stylus genauso wie beispielsweise auf Twitter: Sie beginnen mit einem Raute-Zeichen gefolgt vom Schlagwort selbst: `#Schlagwort`. Wenn du mit gedrückter `Cmd`- oder `Strg`-Taste auf sie klickst, startet Mint Stylus ähnlich wie bei internen Links eine Suche nach allen Dateien, die das entsprechende Schlagwort haben.

> Da ansonsten auch Überschriften als Schlagworte erkannt werden würden, kannst du in solchen Schlagworten keine Leerzeichen verwenden. Du kannst Leerzeichen aber beispielsweise mit einem Minus ersetzen: `#Ein-Schlagwort`. Wenn du aber nicht auf Leerzeichen verzichten willst, kannst du komplexere Schlagworte in einem YAML frontmatter verwenden. Mehr dazu findest du in der [Dokumentation](https://docs.zettlr.com/en/editor/yaml-frontmatter/).

## Abschließende Gedanken 💭

Jetzt weißt du die grundlegenden Dinge, die du benötigst, um dein Wissen mithilfe von Mint Stylus zu verwalten. Wir können hier nicht auf die eigentlichen Techniken eingehen, die vonnöten sind, um beispielsweise einen Zettelkasten zu erstellen, aber es gibt im Internet eine große Community von Menschen, die sich über solche Techniken austauschen. Hier ist eine kleine Liste guter Startpunkte hierfür:

- [Eine erste Einleitung findet sich im Mint Stylus-Handbuch](https://docs.zettlr.com/de/academic/zkn-method/)
- [Wir haben auch einen Blogpost dazu verfasst](https://zettlr.com/post/what-is-a-zettelkasten)
- [Auf zettelkasten.de findest du zahlreiche Tipps (englischsprachig)](https://zettelkasten.de/)
- [Auf Reddit gibt es einen ganzen Subreddit zum Thema](https://www.reddit.com/r/Zettelkasten)

**Bereit für mehr?** Dann schaue dir die finale Einführung zum Zitieren ([[citing]]) mit Mint Stylus an!
