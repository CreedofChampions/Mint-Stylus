---
title: "Willkommen!"
keywords:
  - Anleitung
  - Tutorial
  - Einführung
...

# Willkommen bei Mint Stylus!

 ![zettlr.png](./zettlr.png)

Vielen Dank, dass du dich für Mint Stylus entschieden hast! Wir haben diese kleine, interaktive Einführung für Mint Stylus für dich vorbereitet, damit du direkt einsteigen kannst, ohne das gesamte Online-Handbuch gelesen zu haben. Nichtsdestotrotz ist Mint Stylus weitaus mächtiger, als es diese kurze Einführung suggeriert, also empfehlen wir dir, bei Fragen zunächst [🔗 das ausführliche Handbuch](https://docs.zettlr.com/) zu konsultieren, welches in mehreren Sprachen zur Verfügung steht. Das Handbuch kannst du aus der App heraus jederzeit mittels der Taste `F1` oder über den entsprechenden Eintrag im Hilfe-Menü öffnen.

Doch nun: Los geht's!

> In dieser Einführung wirst du viele Weblinks finden. Wenn du einfach nur auf sie klickst, interpretiert Mint Stylus dies zunächst als Wunsch, den Link zu editieren. Wenn du allerdings `Cmd` oder `Strg` gedrückt hälst, während du auf den Link klickst, öffnet Mint Stylus ihn. Immer, wenn wir von `Cmd/Strg` sprechen, meinen wir übrigens, dass du auf macOS die `Cmd`-Taste benutzt, auf anderen Computern die `Strg`-Taste.

## Über diese Einführung 🎬

Viele Markdown-Editoren nutzen solche interaktiven Tutorials, um einen schnellen Einstieg in die Benutzung zu liefern. Im Fall von Mint Stylus haben wir dir ein Verzeichnis in deinen „Dokumente“-Ordner kopiert und ihn für dich geöffnet. Im Moment siehst du in der linken Seitenleiste – dem Dateimanager – den Inhalt dieses Ordners, und eines der darin enthaltenen Dokumente – `Willkommen.md` – liest du gerade durch.

Wie du sehen kannst, ist derzeit genau ein Ordner – nämlich das Tutorial - geladen. Solche Top-Level-Verzeichnisse heißen bei Mint Stylus „Arbeitsbereiche“ (engl. „Workspaces“). Mint Stylus ist um das Konzept solcher Arbeitsbereiche herum entwickelt worden, sodass du das beste Erlebnis erhältst, wenn du ein oder mehrere solcher Ordner verwendest, um deine Dokumente zu verwalten. Diese Arbeitsbereiche werden bei jedem Start der App wieder geladen, sodass du direkt dort weiter arbeiten kannst, wo du aufgehört hast.

Solche Arbeitsbereiche (sowie alleinstehende Dateien, welche, sobald du sie öffnest, über den Arbeitsbereichen angezeigt werden) kannst du sowohl schließen als auch löschen, indem du mit der rechten Maustaste auf sie klickst. Wenn du sie schließt, heißt das, dass sie aus der App entfernt werden, aber weiterhin auf deinem Computer bleiben. Löschen bedeutet (wie im Übrigen bei allen anderen Dateien und Ordnern ebenfalls), dass sie in den Papierkorb verschoben werden.

In den Einstellungen kannst du zwischen drei verschiedenen Modi des Dateimanagers wählen: Entweder zeigt dir der Dateimanager entweder nur die Dateiliste _oder_ den Verzeichnisbaum an; oder er zeigt dir beide nebeneinander an; oder er zeigt sowohl Dateien wie auch Verzeichnisse ineinander verwoben an.

> Auf einigen Linux-Distributionen kann es passieren, dass das Löschen nicht direkt funktioniert. Das liegt daran, dass Mint Stylus dazu auf Linux-Betriebssystemen eine bestimmte Bibliothek benötigt, die nicht immer installiert ist. Weitere Informationen findest du [in unseren häufig gestellten Fragen](https://docs.zettlr.com/de/faq/).

Wenn du schon einen Ordner angelegt hast, in welchem du deine Notizen speichern möchtest, oder gar schon Notizen hast, kannst du den Ordner nun als Arbeitsverzeichnis öffnen – entweder mittels des Toolbar-Buttons oder dem Tastaturkürzel `Cmd/Strg+O`.

## Wie du Markdown nutzt 📝

Mint Stylus ist zunächst ein einfacher Text-Editor, was bedeutet, dass er im Großen und Ganzen wie Microsoft Word, LibreOffice oder Apple Pages funktioniert. Doch anstatt, dass du dich durch hunderte Buttons klicken musst, kannst du Markdown-Dokumente mithilfe einfacher Zeichen strukturieren. Das heißt, um ein vollständiges Markdown-Dokument zu verfassen, musst du theoretisch nie die Hand von der Tastatur nehmen!

Zunächst die allerwichtigsten Elemente:

1. Du kannst Text **fett** und _kursiv_ darstellen, indem du ihn mit Sternchen oder Unterstrichen umgibst. Ob du Sternchen oder Unterstriche verwendest, ist dir selbst überlassen, wichtig ist nur: Ein Zeichen macht den Text kursiv, während zwei den Text fett darstellen. Drei Zeichen übrigens machen Text __*sowohl fett als auch kursiv*__.
2. Überschriften werden mithilfe des Raute-Zeichens (`#`) dargestellt. Die Anzahl der Raute-Zeichen steht dabei für die Überschriften-Ebene. Insgesamt gibt es sechs Ebenen von Haupt-Überschriften (`#`) bis zu kleinen Abschnittsüberschriften (`######`).
3. Listen erstellst du so, wie du sie in Messengerdiensten bestimmt schon erstellt hast: Stelle dazu jeder Zeile, die ein Listeneintrag werden soll, ein Sternchen `*`, Minus `-` oder Plus `+` voran. Nummerierte Listen erstellst du mit einer Zahl gefolgt von einem Punkt.
4. Zuletzt gibt es noch Blockzitate (mehrzeilige, meist eingerückte Absätze). Diese erstellst du so, wie dein Email-Programm bei einer Antwort auch die Ursprungs-Mail einrückt: Mit Größer-als-Zeichen (`>`).

Natürlich gibt es noch viele weitere Elemente – Fußnoten, zum Beispiel. Bewege deine Maus über die folgende Fußnote: [^1]. Während dieser Einführung wirst du auch von einigen speziellen Elementen erfahren, die Mint Stylus zum Beispiel fürs Wissens-Management nutzt.

## Verlinkungen ⛓

Während sie selten in akademischen Veröffentlichungen anzutreffen sind, stellen Verlinkungen ein mächtiges Werkzeug in der Markdown-Welt dar. Mint Stylus ist geschickt im Umgang mit Links. Kopiere beispielsweise den folgenden Link in die Zwischenablage: https://www.twitter.com/Zettlr

Nun markiere diesen Text, und drücke `Cmd/Strg+K`, also das Kürzel für das Erstellen eines Links. Mint Stylus erkennt, dass sich ein gültiger Link in der Zwischenablage befindet, und fügt ihn automatisch als Link-Ziel ein. Weiterhin stellt Mint Stylus den Link automatisch in einer lesbaren Form dar, sobald du mit dem Text-Cursor aus dem Link gehst. Den so dargestellten Link kannst du dann direkt öffnen.

> Wenn du einige der von Mint Stylus bereits dargestellten Elemente nicht magst, und lieber den Markdown-Code sehen möchtest, lassen sich alle einzelnen Elemente von Zitationen bis zu mathematischen Gleichungen in den Einstellungen ausschalten.

Mint Stylus unterstützt aber nicht nur gewöhnliche Weblinks. Wenn einer der Links auf eine Datei auf deinem Computer verweist, kann Mint Stylus diese auch direkt öffnen – je nachdem, wie dein Betriebssystem eingestellt ist, mit dem entsprechenden Programm.

## Die Seitenleiste 📎

Nachdem die Markdown-Grundlagen geschafft sind, ist es Zeit, noch ein hilfreiches Werkzeug von Mint Stylus vorzustellen: Die [Seitenleiste](https://docs.zettlr.com/de/core/attachments/). Die Seitenleiste öffnest du per Klick auf das rechte Toolbar-Icon, welches aussieht wie drei Spalten. Die Seitenleiste verfügt über vier Reiter mit kontextuellen Informationen.

Der erste Reiter enthält ein Inhaltsverzeichnis aller Überschriften im aktuellen Dokument. Mit einem Klick springst du direkt zum entsprechenden Absatz.

Der zweite Reiter ist besonders interessant für Wissenschaftler\*innen und Studierende: Er zeigt ein Literaturverzeichnis aller im aktuellen Dokument zitierten Werke an. Dies dient als eine Vorschau, damit du überprüfen kannst, ob alle Werke, die zitiert werden müssen, auch tatsächlich irgendwo zitiert werden.

> Dieses Literaturverzeichnis verwendet einen internen Zitationsstil zu Vorschauzwecken. Sobald du das Dokument exportierst, kümmert sich Mint Stylus darum, mit dem Stil deiner Wahl zu zitieren. Diesen Stil kannst du in den Export-Einstellungen auswählen.

Der dritte Reiter enthält eine Liste aller verwandten Dateien. Diese Dateien zeigt dir Mint Stylus an, weil es denkt, dass sie mit der aktuell geöffneten Datei in Verbindung stehen. Das macht Mint Stylus daran fest, welche Schlagworte die beiden Dateien enthalten. Ganz oben stehen die Dateien mit den meisten gemeinsamen Schlagworten, ganz unten die mit den wenigsten.

Der letzte Reiter zeigt alle nicht-Markdown-Dateien an, die sich im aktuell ausgewählten Verzeichnis befinden. Per Klick öffnest du sie mit ihrer Standard-App, und du kannst sie in den Editor ziehen. Du kannst dort gerade eine PDF-Datei sehen. Versuche, sie nun in deinem PDF-Programm zu öffnen!

## Interaktive Elemente ⏯

Bis hierhin hast du bereits viel über Mint Stylus und Markdown gelernt. Viele Elemente sind zusätzlich interaktiv, wie die folgenden Boxen:

- [ ] Mit dem Dateimanager umgehen lernen
- [ ] Erste Markdown-Elemente lernen
- [ ] LaTeX für das Exportieren von Dokumenten installiert

Auch Tabellen sind interaktiv. Wenn du mit der Maus über Tabellen fährst, werden dir einige Buttons angezeigt, mit welchen du die Tabelle bearbeiten kannst. Mit einem Klick in die einzelnen Tabellenzellen lässt sich ihr Inhalt bearbeiten.

| Datei                         | Zweck                                   | Dateiname       |
|-------------------------------|-----------------------------------------|-----------------|
| Willkommen!                   | Erster Überblick über Mint Stylus            | Willkommen.md   |
| Mit dem Zettelkasten arbeiten | Einführung in die Zettelkasten-Features | Zettelkasten.md |
| Zitieren mit Mint Stylus           | Zitieren mit Literaturdatenbanken       | Zitieren.md     |

Du kannst neue Zeilen und Spalten hinzufügen und entfernen sowie Spalten anordnen. Der Tabelleneditor arbeitet dabei Kontext-sensitiv. Das heißt, es wird bei einem Klick auf einen Ausrichtungs-Button immer die Spalte ausgerichtet, in der sich die aktive Zelle befindet. Genauso funktioniert auch das Löschen und Hinzufügen von Spalten und Zeilen.

> Wenn dir der Tabelleneditor nicht gefällt, kannst du ihn in den Editor-Einstellungen auch deaktivieren. Bitte beachte zudem, dass Markdown-Tabellen nicht für sehr komplexe Daten geeignet sind. Hierfür bietet es sich an, andere Dateiformate zu verwenden und erst beim Export in das Dokument einzupflegen.

## Weitere Informationen 📚

Dies war der erste Teil der Einführung. Wir haben nicht allzu viel behandelt, aber alles weitere kannst du [in unserer Dokumentation nachschlagen](https://docs.zettlr.com/de). Vielleicht interessiert dich ja der [Tag-Manager](https://docs.zettlr.com/en/pkms/tag-manager/) oder die [vielfältigen Suchoptionen](https://docs.zettlr.com/de/core/search/)?

Wenn du bereit bist, klicke mit gedrückter `Cmd/Strg`-Taste auf den folgenden Wiki-Link: [[zettelkasten]]

[^1]: Der Text dieser Fußnote befindet sich am Ende des Dokuments. Prinzipiell kannst du den Text allerdings positionieren, wo immer du willst. Das beste? Du musst nicht nach unten scrollen, um die Fußnote zu bearbeiten – klicke einfach auf den "Bearbeiten"-Knopf im Popup. An der Seite unten an der Fußnote findest du einen kleinen Knopf, mit dem du wieder zur Fußnote im Text zurück springen kannst.
