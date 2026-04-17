# Robustes Portfolio – Dashboard V4.4

**Bestehendes Portfolio importieren & Zuzahlungen planen**

---

## ✅ Voraussetzungen

Keine Installation erforderlich. Das Dashboard ist eine reine HTML-Webseite – kein Server, kein Cloud-Dienst, keine Internetverbindung notwendig (außer für die erste Anzeige von Schrift- und Symbol-CDNs).

| System | Empfohlener Browser |
|--------|---------------------|
| 🍎 macOS | Chrome, Safari, Firefox |
| 🪟 Windows | Chrome, Edge, Firefox |
| 🐧 Linux | Chrome, Firefox |

> **Datensicherheit:** Alle Daten bleiben ausschließlich lokal im Browser (LocalStorage). Es werden keine Daten ins Internet übertragen.

---

## 🚀 Dashboard öffnen

Die Datei **`index.html`** im Browser öffnen:

- **macOS:** Doppelklick auf `index.html`, oder Rechtsklick → „Öffnen mit" → gewünschter Browser  
- **Windows:** Doppelklick auf `index.html`, oder Rechtsklick → „Öffnen mit" → Chrome / Edge  

> **Tipp:** Bei wiederholtem Öffnen den Browser-Cache mit **Cmd+Shift+R** (macOS) bzw. **Strg+Shift+R** (Windows) leeren, damit Änderungen an `app_v4.4.js` sofort sichtbar werden.

---

## 📥 Bestehendes Depot laden – Schritt für Schritt

Der empfohlene Weg ist der **CSV-Export aus dem MLP-Portal**.

### ⭐ Empfohlen: Depot über CSV-Datei importieren

**CSV aus dem MLP-Portal exportieren:**

1. Im MLP-Portal einloggen und die Depotübersicht öffnen
2. Den **CSV-Export** (oder Excel-Export) herunterladen – die Datei enthält WKN-Nummern und investierte Beträge
3. Die Datei muss nicht umbenannt werden

**Depot ins Dashboard laden:**

1. Dashboard (`index.html`) im Browser öffnen  
2. Oben rechts auf den Button **„Depot laden (CSV / Excel)"** klicken  
3. Im Dateiauswahldialog die exportierte CSV- oder XLSX-Datei auswählen  
4. Ein **Import-Ergebnis-Fenster** erscheint mit einer Zusammenfassung:
   - **Anzahl erkannter Fonds** (direkt aus der VEM-Datenbank zugeordnet)
   - **Fonds mit eindeutiger Schicht** → werden automatisch in „Von Empfehlungsliste genommen" eingetragen
   - **Fonds mit unklarer Schicht** → werden als „Fonds delistet"-Badge gespeichert
5. Auf **„▶ Jetzt ins Portfolio laden"** klicken
6. Fertig – alle Fonds und Beträge sind eingetragen

> **Encodings:** Das Dashboard erkennt sowohl **UTF-8** als auch **Windows-1252 / Latin-1** (MLP-Portal-Standard) automatisch. Beides funktioniert.

---

### 📄 Alternative: JSON-Datei laden (Bibliothek)

Wenn ein Import bereits einmal gemacht und gespeichert wurde:

1. Auf den Button **„Bibliothek"** klicken  
2. Gespeicherte Portfolios anzeigen, per **„▶ Laden"** wiederherstellen  
3. Oder: eine `.json`-Datei per **„JSON-Datei importieren"** in die Bibliothek aufnehmen

> Die Bibliothek speichert Portfolios im Browser-LocalStorage und bleibt auch nach dem Schließen erhalten.

---

### 📋 Alternative: Setup-Datei laden (Panel-Buttons)

Im Panel „Mein Portfolio" (rechte Seite):

| Symbol | Funktion |
|--------|----------|
| ⬆ | **Setup laden** – eine gespeicherte `.json`-Datei importieren |
| ⬇ | **Setup speichern** – aktuelles Portfolio als `.json`-Datei sichern |
| ↺ | **Reset** – gesamtes Portfolio inkl. geladene Datei zurücksetzen |
| 🖨️ | Aktuelle Fondsliste drucken / als PDF exportieren |

---

### 📑 Fallback: PDF-Import

Maschinenlesbare PDFs (mit echter Textebene) werden ebenfalls unterstützt – einfach über **„Depot laden (CSV / Excel)"** auswählen, der Dialog akzeptiert auch PDF-Dateien.

> ⚠️ Eingescannte PDFs ohne Textebene können **nicht** automatisch gelesen werden. In diesem Fall bitte den CSV-Export aus dem MLP-Portal verwenden.

---

## 🗂️ Was passiert mit nicht erkannten Fonds?

Das Dashboard unterscheidet zwei Fälle:

### 1. Schicht eindeutig erkennbar (z. B. „Aktien Welt", „Vermögensverwalter ausgewogen")

Der Betrag wird automatisch in das Feld **„Von Empfehlungsliste genommen"** der passenden Schicht eingetragen. Dieses Feld erscheint am Ende jeder Schicht im Portfolio-Panel (nur wenn ein Betrag vorhanden ist) und ist editierbar.

Beim **Hovern über das Feld** erscheint ein Popup mit den einzelnen betroffenen Fonds:
- Fondsname
- WKN
- Anlageschwerpunkt aus der CSV
- Einmalbetrag / Sparrate

### 2. Schicht nicht eindeutig

Diese Fonds werden als **🔶 Fonds delistet**-Badge in der Kapitalreservefonds-Schicht angezeigt.  
Beim Überfahren mit der Maus erscheint ein Popup mit:
- Fondsname
- WKN
- Anlageschwerpunkt aus der CSV
- Einmalbetrag / Sparrate

---

## 📊 Anlageplanung & Budgetlogik nach dem Import

Nach einem erfolgreichen CSV-Import gilt folgende Logik:

| Feld | Inhalte |
|------|---------|
| **Anzulegendes Gesamtvermögen** | Wird automatisch auf die Summe der **direkt gematchten Fonds** gesetzt |
| **Einmal Verplant** | Identisch mit dem Gesamtvermögen → **Verbleibend = 0,00 €** |
| **Von Empfehlungsliste genommen** | Wird separat in der jeweiligen Schicht angezeigt, **fließt nicht ins Gesamtvermögen** ein |

**Workflow nach dem Import:**
1. Gesamtvermögen und Einmal Verplant sind deckungsgleich (Verbleibend = 0 €)
2. Das Gesamtvermögen kann manuell **erhöht** werden (z. B. um geplante Zuzahlungen)
3. Der entstehende Restbetrag (Verbleibend) kann dann auf neue Schichten verteilt werden

> **Hinweis zur Gesamtgewichtung:** Die prozentualen Anteile im Panel „Mein Portfolio" beziehen sich **nur auf die regulär zugeordneten Fonds** – die Empfehlungsliste-Beträge fließen nicht in die %-Berechnung ein, damit die Summe korrekt 100 % ergibt.

---

## 🔁 Deduplication beim Import

Einige Fonds sind sowohl in **Kapitalreservefonds** als auch in **Tagesgeld** hinterlegt (z. B. iShares iBonds, ZinsPlus, Basis-Fonds I Nachhaltig). Beim Import wird jede WKN **nur einmal** zugeordnet – der **Kapitalreservefonds hat Vorrang** vor Tagesgeld.

---

## 💾 Depot-Bibliothek

Die **Depot-Bibliothek** (Button oben rechts) ist eine Verwaltungs-Zentralstation für gespeicherte Portfolios:

| Funktion | Beschreibung |
|----------|-------------|
| **Laden** | Portfolio aus der Bibliothek ins Dashboard laden |
| **JSON** | Portfolio als `.json`-Datei herunterladen (z. B. für andere Geräte) |
| **🗑️** | Eintrag aus der Bibliothek löschen |
| **JSON-Datei importieren** | Eine auf einem anderen Gerät exportierte `.json`-Datei in die Bibliothek aufnehmen |

> Nach einem erfolgreichen CSV-Import kann das Portfolio direkt in der Bibliothek gespeichert werden – Name ist frei wählbar.

---

## 🏗️ Turm-Schichten (unten → oben)

| Schicht | Anlagestrategie |
|---------|-----------------|
| Tagesgeld | Kurzfristige Einlagen |
| Kapitalreservefonds | Kasse / Wertsicherung |
| Defensive Vermögensverwalter | Stabilitätsorientiert |
| Ausgewogene Vermögensverwalter | Balance aus Chance & Sicherheit |
| Dynamische Vermögensverwalter | Weites Benchmarking auf Aktien |
| Märkte | **Weites & Enges Benchmarking auf Aktien** |
| Spezialitäten / Themen | Immobilien, PE, Gold, Beteiligungen |

### Von Empfehlungsliste genommen

Jede Schicht enthält am Ende ein editierbares Feld **„Von Empfehlungsliste genommen"** (orangefarben). Das Feld erscheint **nur, wenn ein Betrag vorhanden ist** (entweder durch automatischen Import oder manuelle Eingabe).

Beim Hovern über das Feld erscheint ein **Popup mit den Einzelfonds**, die nicht mehr auf der VEM-Empfehlungsliste stehen – analog zur Darstellung im Import-Fenster.

---

## 🗂️ Dateien in diesem Ordner

| Datei | Beschreibung |
|-------|-------------|
| `index.html` | Hauptdatei – im Browser öffnen |
| `styles_v4.4.css` | Stylesheet / Design |
| `app_v4.4.js` | Anwendungslogik (Import, Bibliothek, Panel) |
| `fund_data.js` | Fondsdatenbank (WKN, Anlageklassen, Länderdaten) |
| `portfolio_import.json` | Beispiel-Portfolio (VEM AW, Stand 15.04.2026) |
| `crawler_server.py` | Hintergrundservice zum Aktualisieren von Ländergewichtungen |
| `README.md` | Diese Anleitung |

---

## ❓ Häufige Fragen

**F: Muss ich die CSV-Datei zuerst laden, bevor ich auf „Setup laden" klicke?**  
A: **Nein.** Beide Funktionen sind unabhängig. Der CSV-Import und der JSON-Setup-Import funktionieren jeweils für sich.

**F: Was bewirkt der Reset-Button (↺)?**  
A: Er löscht das gesamte Portfolio, alle eingetragenen Beträge und setzt den Upload-Button zurück. Ein Bestätigungs-Popup erscheint vorher.

**F: Warum erscheinen nach dem CSV-Import manche Fonds nicht im Portfolio?**  
A: Fonds, die nicht in der VEM-Datenbank sind, werden entweder als „Von Empfehlungsliste genommen" (wenn die Schicht eindeutig ist) oder als „Fonds delistet"-Badge (wenn die Schicht unklar ist) behandelt.

**F: Warum ist das Anzulegende Gesamtvermögen nach dem Import kleiner als die Depotgesamtsumme?**  
A: Das Gesamtvermögen enthält nur die direkt erkannten Fonds. Beträge aus „Von Empfehlungsliste genommen" sind separat ausgewiesen und können durch manuelles Erhöhen des Gesamtvermögens in die Planung einbezogen werden.

**F: Funktioniert das Dashboard auf Windows genauso wie auf dem Mac?**  
A: **Ja.** Es ist eine reine Webseite – im Browser öffnen, fertig. Kein Unterschied zwischen Betriebssystemen.

**F: Werden meine Daten gespeichert oder übertragen?**  
A: Alle Daten bleiben nur im **Browser-LocalStorage** des jeweiligen Geräts. Bei geleertem Browser-Cache gehen sie verloren – daher regelmäßig per ⬇ als JSON sichern oder in die Bibliothek speichern.

**F: Was ist der Unterschied zwischen Bibliothek speichern und Setup speichern (⬇)?**  
A:  
- **Bibliothek** = Speichert im Browser-LocalStorage, bleibt auf diesem Gerät erhalten, kein Download  
- **Setup speichern (⬇)** = Lädt eine `.json`-Datei herunter, portierbar auf andere Geräte

**F: Welche Datei-Formate werden beim Import unterstützt?**  
A: **CSV** (MLP-Portal-Export, UTF-8 und Latin-1/Windows-1252), **Excel (.xlsx/.xls)** und **PDF** (nur maschinenlesbare PDFs mit Textebene).

---

*Version 4.4 · April 2026 – Letzte Änderung: 17.04.2026*
