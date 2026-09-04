# TF Line Designer

Ein schematischer Linien-Planer für **Transport Fever 3** (Release 29.09.2026).
Gedacht zum Vorplanen kompletter Netze im Sandbox-Modus: Städte & Industrien
setzen, Personen- und Güterlinien ziehen, beschriften, Ebenen ein-/ausblenden –
bevor im Spiel gebaut wird.

Kein Server, keine Cloud. Alles lokal, Autospeicherung im Browser (localStorage),
Im-/Export als JSON, Bild-Export als PNG.

**Sprache:** Englisch / Deutsch, Umschalter oben rechts (EN/DE). Beim ersten
Start wird die Browsersprache erkannt (Deutsch → DE, sonst EN); die Wahl wird
gemerkt (`localStorage: tfld:lang`). Strings in `src/i18n.ts`.

## Start

```bash
npm install
npm run dev      # http://localhost:5173 (oder nächster freier Port)
npm run build    # baut EINE Datei: dist/index.html (alles inline)
```

`dist/index.html` ist komplett self-contained (JS + CSS inline, `vite-plugin-singlefile`).
Läuft **standalone per Doppelklick** (`file://`, offline, kein Server) und genauso
gehostet – einfach die eine Datei irgendwo hinlegen.

## Bedienung

| Aktion | So |
|---|---|
| Schwenken | leere Fläche ziehen · **Leertaste + ziehen** (überall) · mittlere/rechte Maustaste · **Shift + Mausrad** (horizontal) |
| Zoomen | Mausrad / Pinch (zum Cursor) · Tasten **+ / −** · Buttons unten rechts |
| Alles einpassen | Button ⤢ oder Taste **0** (auch automatisch beim Laden) |
| Zoom fühlt sich falschherum an? | Button **⇅** unten rechts kehrt die Scroll-Richtung um (wird gemerkt) |
| Stadt / Industrie setzen | Werkzeug wählen, auf Fläche klicken |
| Knoten verschieben | im Werkzeug „Auswahl" ziehen |
| Linie zeichnen | „+ Linie", dann Knoten nacheinander anklicken, **Enter** oder Leerklick beendet |
| Halte einer Linie ändern | Linie wählen → „Halte anklicken / anhängen" |
| Eigenschaften bearbeiten | Element anklicken → rechte Leiste |
| Bahnsteig einer Linie verschieben | Linie wählen → weißen Halte-Ziehpunkt im Plan ziehen (Doppelklick = zurück) |
| Wegpunkt / Umleitung einfügen | Linie wählen → gestrichelten Segment-Ziehpunkt (Mitte) ins Plan ziehen. Betrifft nur diese Linie, ist kein Halt. Entfernen über die Wegpunkt-Leiste. |

Industrien haben eine Rolle (Produzent / Verbraucher / Beides). Die
**Güterketten**-Prüfung in der Seitenleiste zeigt pro Güterlinie, ob Start
liefert und Ziel abnimmt. Linien lassen sich per „Auto"-Knopf nach TF3-Muster
benennen.

Jeder Verkehrsmodus hat einen eigenen Linienstil: Schiene = durchgezogen,
Tram = dünn durchgezogen, Straße/Bus = gestrichelt, Schiff = gepunktet,
Flug = Strich-Punkt. Güterlinien bekommen zusätzlich eine helle Strichelung
über der Farbe.

Über Feature-Flags in `src/types.ts` sind derzeit deaktiviert: Trassen-/Straßen-
Ebene, Lager-Knoten, Linien-Priorität, Cargo-Kategorien. Der Code bleibt jeweils
erhalten – Flag auf `true` = wieder da.

Linien, die denselben Abschnitt benutzen, werden automatisch in gleichmäßige
parallele Spuren versetzt (Liniennetzplan-Look): abgerundete Ecken, weißes Casing
zwischen den Linien, Stations-Marker pro Knoten (Kapsel = Umstieg, Strich = ein
einzelner Halt). Die Slot-Reihenfolge im Bündel wird so gewählt, dass abzweigende
Linien die anderen möglichst nicht kreuzen.

**Linienführung** (Seitenleiste): *Direkt* = Luftlinie, *Oktilinear* = alles auf
0 / 45 / 90° gebogen wie in echten U-Bahn-Plänen.

## Stack

Vite + React + TypeScript, SVG-Zeichenfläche, Zustand für State. Keine Runtime-
Abhängigkeit zum Spiel – TF3-Savegames sind nicht extern beschreibbar.

## Status

Phase 1 (MVP). Roadmap siehe [PROJECT.md](PROJECT.md).
