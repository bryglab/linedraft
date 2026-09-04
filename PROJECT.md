# TF Line Designer – Projektplan

## Ziel

Werkzeug zum Vorplanen kompletter Transport-Fever-3-Netze im Sandbox-Modus.
Schematisch (Metro-Style), ohne echten Kartenmaßstab. Lokale Web-App.

## Kontext aus der Recherche (Stand Sept. 2026)

- **Release:** 29.09.2026 (PC/Mac/Linux, PS5, Xbox Series X|S).
- **Line Manager** in TF3 überarbeitet: In-Welt-Editing, Drag&Drop-Halte,
  automatische Linien-Benennung nach Mustern.
- **4 Cargo-Kategorien:** Liquid, Bulk, Flatbed, Goods. Modulare Lagerhäuser als
  Umschlag-Hubs. Neu: **Cargo-Time** – zu lange Transport-/Lagerzeiten machen
  Endkunden unzufrieden.
- **Rail:** Linien-Prioritäten, mehrere Gleistypen, Tram unterirdisch.
- **Roads:** „lanes first", freie Splits/Merges, Bushaltestellen als Constructions.
- **Modding:** Lua + mod.io, Script-Hot-Reload. **Kein dokumentierter externer
  Savegame-Zugriff** → kein direkter Export ins Spiel; Tool bleibt Planungshilfe.
- Community-Lücke seit TF1/TF2: es gab nie ein Routen-Planungstool.

## Datenmodell

- **DesignNode** – `city` | `industry`; Industrie zusätzlich `cargoCategory` +
  `role` (source/sink/both).
- **Line** – geordnete `stops[]`, `mode` (rail/road/tram/ship/air),
  `kind` (passenger/cargo), `color`, `cargoCategory?`, `note`.
- **Project** – nodes, lines, layers. Version 1. JSON-Dateiendung `.tfld.json`.

## Roadmap

### Phase 1 – MVP ✅
- [x] Pan/Zoom-SVG-Canvas mit Raster
- [x] Städte & Industrien setzen, benennen, verschieben, löschen
- [x] Multi-Stop-Linien zeichnen, Modus + Personen/Güter + Farbe
- [x] Halte umsortieren / entfernen / anhängen
- [x] Ebenen-Toggles (Personen / Güter / je Modus / Beschriftung) + Legende
- [x] Autospeicherung localStorage, JSON Im-/Export, PNG-Export

### Phase 2 – Planungshilfen
- [x] Liniennetzplan-Rendering (`src/lib/geometry.ts`):
  - Linien, die ein Segment teilen, laufen in gleichmäßig versetzten parallelen
    Spuren (Slot = Position in der Linienliste, stabil über das ganze Bündel)
  - abgerundete Ecken an Knicken (`roundedPath`, quadratische Béziers)
  - weißes Casing um jede Linie → klare Trennung paralleler Linien
  - Stations-Marker pro Knoten (`computeStations`): abgerundetes Rechteck quer
    zur Gleisrichtung. Länge = Spreizung der Linien quer, Breite = Spreizung
    längs → bei sauberem Bündel eine dünne Kapsel, bei auffächernden Linien
    (Endbahnhof mit mehreren Richtungen) ein rundlicher Klecks. Umstieg =
    weiß mit Rand, Einzelhalt = dunkel.
  - Plattform-Punkt pro Linie an jedem Halt: kleiner dunkler Punkt am
    Anschlusspunkt jeder Linie → jede Linie hat sichtbar ihre eigene „Node"
    im Bahnhof, auch wenn sie mittig andockt.
- [x] Wegpunkte / Umleitungen (`NodeKind "via"`): bei ausgewählter Linie liegt
      an jeder Segmentmitte ein gestrichelter Ziehpunkt. Ziehen ruft
      `insertWaypoint(lineId, segIndex, x, y)` – erzeugt einen via-Knoten und
      schiebt ihn in `line.stops`, danach wird er als normaler Knoten gezogen.
      via-Knoten: kleiner hohler Kreis, kein Label, kein Stations-Marker
      (`computeStations` überspringt `kind === "via"`), kein Plattform-Punkt,
      nicht als „Halt" gezählt. Betreffen nur ihre eine Linie (eigene Kante,
      Bündel bleibt unberührt). Orphan-Cleanup via `pruneOrphanVias`. Panel:
      „In Station umwandeln" / „Wegpunkt entfernen".
- [x] Bahnsteige manuell verschiebbar: bei ausgewählter Linie werden die
      Plattform-Punkte zu großen Ziehpunkten. Ziehen setzt `stopOverrides[i]`
      (Weltversatz vom Knoten, geklemmt ±60), die Geometrie routet die Linie
      durch den Punkt (`ovr()` in `computeLineGeometry`), der Stations-Marker
      passt sich an. Doppelklick oder Seitenleisten-Button setzt zurück.
      Overrides werden bei Halte-Umsortierung/-Löschung verworfen.
- [x] Oktilineare Linienführung (0/45/90°): Umschalter „Linienführung"
      (Direkt | Oktilinear) in der Seitenleiste, `project.routing`. Jede Kante
      wird einmal kanonisch geroutet (gerade, wenn schon nahe 0/45/90°, sonst
      Diagonale + Achsensegment), alle Linien der Kante nutzen dieselbe
      Mittellinie mit Parallelversatz (`octiRoute` in `geometry.ts`).
- [x] Kreuzungs-Reduktion im Bündel: Slot-Reihenfolge pro Kante wird nach der
      Richtung sortiert, in die jede Linie an beiden Kantenenden weiterläuft
      (`orderLinesOnEdge`) – eine abzweigende Linie bleibt im gemeinsamen
      Abschnitt auf „ihrer" Seite und kreuzt die anderen nicht.
      Bug behoben: das `beforeA`-Ende nutzte die Vorwärts- statt der
      Herkunftsrichtung → Linien, die aus einem Nebenast in ein größeres Bündel
      einfädelten, landeten auf der falschen Seite und kreuzten das ganze Bündel.
- [x] Bündel-Übergang verallgemeinert: nicht nur bei Solo↔Bündel, sondern bei
      *jedem* Wechsel der Bündelbreite an einem Halt (`cIn !== cOut`) wird der
      Stop-Vertex an die Spur des *größeren* Bündels gepinnt; der dünnere Ast
      gleicht den Seitenversatz über seine Länge aus. Verhindert, dass zwei
      unterschiedlich breite Bündel an einem Knoten ihre Spuren mitteln und
      Linien übereinander zu liegen kommen.
- [x] Eigene Spur pro Linie pro Station (kein Kollaps auf den Knotenmittelpunkt):
      wechselt eine Linie an einem Halt zwischen Solo- und Bündelabschnitt, wird
      der Stop-Vertex auf die Bündelspur gelegt statt auf die Knotenmitte – die
      Linie läuft durchgehend auf ihrer parallelen Spur durch die Station, der
      Seitenversatz wird über die Länge des Solo-Abschnitts ausgeglichen
      (`Math.min(cIn,cOut)===1`-Zweig in `computeLineGeometry`).
- [x] Stations-Marker: Bug behoben – Endstationen lieferten Richtung (0,0), dadurch
      stand der Marker schief und traf die Spuren nicht. Jetzt nutzt ein Terminus
      die Richtung seiner einzigen Kante → Marker steht senkrecht zum Gleisbündel
      und spannt sauber über alle Spuren.
- [x] Oktilinear: Snap-Toleranz 7° → 12°, damit fast waagerechte/senkrechte
      Kanten nicht als 45°-Zacke gebrochen werden.
- [x] Linienstil pro Verkehrsmodus (`MODE_STYLE` in `types.ts`): Schiene
      durchgezogen, Tram dünn, Straße/Bus gestrichelt, Schiff gepunktet, Flug
      Strich-Punkt. Güter = zusätzlich helle Strichelung (`CARGO_HATCH`) über der
      Farbe. Casing-Breite modusabhängig. Legende zeigt die genutzten Modi.
      (Nebenbei Bug behoben: `.canvas-wrap svg` überschrieb auch die Legenden-
      Swatches auf 100 % Breite → jetzt `.canvas-wrap > svg`.)
- [x] Auto-Linienbenennung nach TF3-Muster (`lib/naming.ts`): „‹Prefix› ‹Nr›
      ‹Start› – ‹Ziel›", Prefix je Modus (Zug/Bus/Tram/Schiff/Flug) bzw. „Güter".
      `Line.autoName` hält den Namen synchron bis der Nutzer ihn editiert;
      `Project.autoName` steuert neue Linien; „Auto"-Button pro Linie. Namen
      werden bei Halte-/Modus-/Knotennamen-Änderung neu erzeugt (`withAutoNames`).
- [x] Linien-Priorität (`Line.priority` low/normal/high, TF3 Vorrang an
      Kreuzungen): Feld in der Linien-Leiste, ▲/▽-Glyph in der Liste,
      höhere Priorität rendert zuletzt (liegt oben) via `orderedLines`.
      **UI aktuell deaktiviert** über `PRIORITY_ENABLED = false`.
- [x] Lager-/Hub-Knoten (`NodeKind "warehouse"`, Rauten-Symbol nach
      Cargo-Kategorie eingefärbt) – Puffer/Umschlag für eine der 4 Kategorien.
      **Aktuell deaktiviert** über `WAREHOUSES_ENABLED = false`.
- [x] Güterketten-Check (`lib/cargoCheck.ts` + `CargoChains`): pro Güterlinie
      ✅/⚠ ob Start liefert / Ziel abnimmt; listet Produzenten ohne Abtransport
      und Verbraucher ohne Zulieferung. Kategorie-Abgleich nur wenn
      `CARGO_CATEGORY_ENABLED` – aktuell aus, dann reine Produzent→Verbraucher-
      Prüfung (Industrie-Rolle + Stadt).
- [x] Trassen-/Straßen-Ebene (`Corridor`, `project.corridors`): frei gezeichnete
      Infrastruktur unabhängig von Linien. Werkzeug „+ Trasse" (Punkte klicken,
      Enter/Doppelklick beendet), Typ Straße/Gleis/Tramgleis, Spuren bzw.
      elektrifiziert, Vertizes im Plan ziehbar. Rendert als graues/braunes Band
      unter den Linien; eigene Ebene „Trassen / Straßen".
      **Aktuell deaktiviert** über `CORRIDORS_ENABLED = false` in `types.ts` –
      der ganze Code (Store-Actions, Rendering, Panels) bleibt drin, nur die
      UI-Einstiege sind ausgeblendet. Flag auf `true` = wieder da.
- [x] Zoom & Pan überarbeitet (`Canvas.tsx`): Fit-to-content beim Laden und per
      Button ⤢ / Taste 0; Zoom-Buttons + / − und Tasten +/−; Zoom immer zum
      Cursor, pro Event gedeckelt (ruhiger bei Pinch/schnellem Rad); Schwenken
      zusätzlich per Leertaste+Ziehen (überall), mittlerer/rechter Maustaste und
      Shift+Rad; Zoom-%-Anzeige; ⇅-Button kehrt die Scroll-Richtung um
      (localStorage `tfld:invertZoom`). Nebenbei: solider Hintergrund-Rect fürs
      Theme.
- [ ] Distanz-Proxy + grobe Fahrzeit/Takt-/Fahrzeug-Schätzung pro Linie
- [ ] Cargo-Time-Risiko (Umstiegs-Zähler / Weglänge) pro Güterlinie
- [ ] Bau-Reihenfolge / abhakbare Checkliste

### i18n
- [x] Zweisprachig EN/DE (`src/i18n.ts`): `useUi`-Store (zustand) mit
      `lang`/`setLang`, persistiert unter `tfld:lang`. Auto-Detect beim ersten
      Start (`navigator.language` „de*" → DE, sonst EN), Umschalter in der
      Toolbar. `useT()`-Hook liefert reaktives `t(key, vars)`; nicht-React-Code
      (`store`, `naming`, `cargoCheck`, `sampleProject`) nutzt `tl(lang, …)`.
      Label-Maps (Modus/Cargo/Priorität/Trasse/Prefix) aus `types.ts` nach
      `i18n.ts` verschoben. Beispielnetz zweisprachig (englische Ortsnamen).
      `<html lang>` wird mitgesetzt.

### Phase 3 – Ausbau
- [ ] Vorlagen (Metro, Fernverkehr, Güterhub)
- [ ] Teilen per Datei/Link, mehrere Projekte
- [ ] Desktop-Paket (Tauri)
- [ ] evtl. Companion-Mod: Plan-JSON als In-Game-Overlay

## Entscheidungen

- Geometrie: **abstraktes Schema**, kein Maßstab (Nutzerwahl).
- Plattform: **lokale Web-App** im Browser (Nutzerwahl).
- Stack: Vite + React + TS + SVG + Zustand, keine Backend-Komponente.
