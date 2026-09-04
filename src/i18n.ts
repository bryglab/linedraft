import { create } from "zustand";
import type { CargoCategory, CorridorKind, LinePriority, TransportMode } from "./types";

export type Lang = "en" | "de";

const LANG_KEY = "tfld:lang";

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "de") return saved;
  } catch {
    /* ignore */
  }
  const nav =
    typeof navigator !== "undefined" ? navigator.language?.toLowerCase() : "";
  return nav && nav.startsWith("de") ? "de" : "en";
}

interface UiState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

function applyHtmlLang(l: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export const useUi = create<UiState>((set) => ({
  lang: detectLang(),
  setLang: (l) => {
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
    applyHtmlLang(l);
    set({ lang: l });
  },
}));

applyHtmlLang(useUi.getState().lang);

type Dict = Record<string, string>;

const EN: Dict = {
  "app.projectName": "Project name",

  "tool.select": "Select",
  "tool.select.title": "Select / move / pan",
  "tool.addCity": "+ City",
  "tool.addIndustry": "+ Industry",
  "tool.addWarehouse": "+ Warehouse",
  "tool.addWarehouse.title": "Warehouse / transfer hub (buffers one cargo category)",
  "tool.drawLine": "+ Line",
  "tool.drawLine.title":
    "New line: click nodes in order; Enter/Esc or empty click finishes",
  "tool.drawCorridor": "+ Corridor",
  "tool.drawCorridor.title":
    "Draw a corridor/road freely: click points; Enter/Esc or double-click finishes",

  "btn.save": "Save (JSON)",
  "btn.load": "Load",
  "btn.png": "PNG",
  "btn.new": "New",
  "btn.example": "Example",
  "confirm.new": "New, empty network?",
  "confirm.example": "Load the example network? The current one is replaced.",
  "err.load": "Could not load file: ",

  "h.routing": "Line routing",
  "routing.direct": "Direct (straight line)",
  "routing.octilinear": "Octilinear (0 / 45 / 90°)",
  "autoNameNew": "Name new lines automatically",

  "h.layers": "Layers",
  "layer.passenger": "Passenger lines",
  "layer.cargo": "Freight lines",
  "layer.rail": "Rail",
  "layer.road": "Road / bus",
  "layer.tram": "Tram",
  "layer.ship": "Ship",
  "layer.air": "Air",
  "layer.corridors": "Corridors / roads",
  "layer.labels": "Labels",

  "h.lines": "Lines ({n})",
  "lines.empty": "No lines yet. Use “+ Line” above.",
  "h.corridors": "Corridors ({n})",

  "h.properties": "Properties",
  "select.prompt": "Select an element.",

  "h.net": "Network",
  "net.cities": "{n} cities",
  "net.industries": "{n} industries",
  "net.warehouses": "{n} warehouses",
  "net.lines": "{p} passenger / {c} freight lines",

  "via.desc":
    "Waypoint / detour – only shapes the line, not a stop. Drag on the plan to move.",
  "via.toStation": "Convert to station",
  "via.stationName": "New station",
  "via.remove": "Remove waypoint",

  "field.name": "Name",
  "field.type": "Type",
  "field.cargoCat": "Cargo category",
  "field.role": "Role in the chain",
  "field.note": "Note",
  "field.noteVehicles": "Note (vehicles, frequency …)",
  "field.mode": "Mode",
  "field.kind": "Kind",
  "field.priority": "Priority (right of way at junctions)",
  "field.color": "Colour",
  "field.lanes": "Lanes",

  "type.city": "City",
  "type.industry": "Industry",
  "type.warehouse": "Warehouse / hub",
  "role.source": "Producer",
  "role.sink": "Consumer",
  "role.both": "Both (processing)",
  "kind.passenger": "Passenger",
  "kind.cargo": "Freight",

  "btn.deleteNode": "Delete node",
  "btn.deleteLine": "Delete line",
  "btn.deleteCorridor": "Delete corridor",

  "line.auto": "Auto",
  "line.autoOn": "Auto ✓",
  "line.auto.titleOn": "Name follows the route (click to detach)",
  "line.auto.titleOff": "Generate name from route",

  "stops.label": "Stops ({n})",
  "stop.waypoint": "Waypoint",
  "linePanel.hint":
    "Drag a segment handle (dashed) on the plan = insert waypoint/detour. Drag a stop handle (white) = move the platform (double-click = reset).",
  "resetOverrides": "Reset {n} offset(s)",
  "btn.finishStops": "Finish editing stops (Enter)",
  "btn.editStops": "Click / append stops",

  "corridor.electrified": "electrified",
  "corridor.pointsHint": "{n} points · drag on the plan to adjust",
  "btn.finishDraw": "Finish drawing (Enter)",
  "btn.appendPoints": "Append points",

  "h.cargoChains": "Freight chains ({ok}/{n} ok)",
  "cargoChains.empty": "No freight lines yet.",
  "cargoChains.danglingProducers": "Producer with no outbound line: {names}",
  "cargoChains.danglingConsumers": "Consumer with no inbound line: {names}",

  "legend.title": "Legend",
  "legend.cargo": "Freight (pale dashes)",
  "legend.lines": "Lines",

  "hint.addCity": "Click on the canvas to place a city",
  "hint.addIndustry": "Click on the canvas to place an industry",
  "hint.addWarehouse": "Click on the canvas to place a warehouse",
  "hint.drawCorridor": "Click points · Enter or double-click finishes",
  "hint.drawLine": "Click nodes in order · Enter or empty click finishes",

  "zoom.invert": "Invert zoom direction (if scrolling zooms the wrong way)",
  "zoom.in": "Zoom in (+)",
  "zoom.out": "Zoom out (−)",
  "zoom.fit": "Fit everything (0)",

  // cargo-check messages
  "cc.noCategory": "no cargo category chosen",
  "cc.fewStops": "fewer than 2 stops",
  "cc.originNo": "Origin “{name}” produces no {what}",
  "cc.destNo": "Destination “{name}” takes no {what}",
  "cc.freight": "freight",

  // default entity names (become editable data)
  "name.city": "City",
  "name.industry": "Industry",
  "name.warehouse": "Warehouse",
  "name.via": "Waypoint",
  "name.line": "Line",
  "name.newNetwork": "New network",

  // mode / cargo / priority / corridor labels
  "mode.rail": "Rail",
  "mode.road": "Road / bus",
  "mode.tram": "Tram",
  "mode.ship": "Ship",
  "mode.air": "Air",
  "prefix.rail": "Train",
  "prefix.road": "Bus",
  "prefix.tram": "Tram",
  "prefix.ship": "Ferry",
  "prefix.air": "Flight",
  "prefix.cargo": "Freight",
  "cargo.liquid": "Liquid (tanker)",
  "cargo.bulk": "Bulk",
  "cargo.flatbed": "Flatbed (long goods)",
  "cargo.goods": "Goods (closed)",
  "prio.low": "Low",
  "prio.normal": "Normal",
  "prio.high": "High",
  "corridor.road": "Road",
  "corridor.rail": "Track",
  "corridor.tram": "Tram track",
};

const DE: Dict = {
  "app.projectName": "Projektname",

  "tool.select": "Auswahl",
  "tool.select.title": "Auswählen / verschieben / schwenken",
  "tool.addCity": "+ Stadt",
  "tool.addIndustry": "+ Industrie",
  "tool.addWarehouse": "+ Lager",
  "tool.addWarehouse.title": "Lager / Umschlag-Hub (puffert eine Cargo-Kategorie)",
  "tool.drawLine": "+ Linie",
  "tool.drawLine.title":
    "Neue Linie: Knoten nacheinander anklicken, Enter/Esc oder Leerklick beendet",
  "tool.drawCorridor": "+ Trasse",
  "tool.drawCorridor.title":
    "Trasse / Straße frei zeichnen: Punkte klicken, Enter/Esc oder Doppelklick beendet",

  "btn.save": "Speichern (JSON)",
  "btn.load": "Laden",
  "btn.png": "PNG",
  "btn.new": "Neu",
  "btn.example": "Beispiel",
  "confirm.new": "Neues, leeres Netz?",
  "confirm.example": "Beispielnetz laden? Aktuelles wird ersetzt.",
  "err.load": "Konnte Datei nicht laden: ",

  "h.routing": "Linienführung",
  "routing.direct": "Direkt (Luftlinie)",
  "routing.octilinear": "Oktilinear (0 / 45 / 90°)",
  "autoNameNew": "Neue Linien automatisch benennen",

  "h.layers": "Ebenen",
  "layer.passenger": "Personen-Linien",
  "layer.cargo": "Güter-Linien",
  "layer.rail": "Schiene",
  "layer.road": "Straße / Bus",
  "layer.tram": "Tram",
  "layer.ship": "Schiff",
  "layer.air": "Flug",
  "layer.corridors": "Trassen / Straßen",
  "layer.labels": "Beschriftungen",

  "h.lines": "Linien ({n})",
  "lines.empty": "Noch keine Linien. Oben „+ Linie“.",
  "h.corridors": "Trassen ({n})",

  "h.properties": "Eigenschaften",
  "select.prompt": "Ein Element auswählen.",

  "h.net": "Netz",
  "net.cities": "{n} Städte",
  "net.industries": "{n} Industrien",
  "net.warehouses": "{n} Lager",
  "net.lines": "{p} Personen- / {c} Güterlinien",

  "via.desc":
    "Wegpunkt / Umleitung – formt nur den Linienverlauf, kein Halt. Im Plan ziehen zum Verschieben.",
  "via.toStation": "In Station umwandeln",
  "via.stationName": "Neue Station",
  "via.remove": "Wegpunkt entfernen",

  "field.name": "Name",
  "field.type": "Typ",
  "field.cargoCat": "Cargo-Kategorie",
  "field.role": "Rolle in der Kette",
  "field.note": "Notiz",
  "field.noteVehicles": "Notiz (Fahrzeuge, Takt …)",
  "field.mode": "Modus",
  "field.kind": "Art",
  "field.priority": "Priorität (Vorrang an Kreuzungen)",
  "field.color": "Farbe",
  "field.lanes": "Spuren",

  "type.city": "Stadt",
  "type.industry": "Industrie",
  "type.warehouse": "Lager / Hub",
  "role.source": "Produzent",
  "role.sink": "Verbraucher",
  "role.both": "Beides (Weiterverarbeitung)",
  "kind.passenger": "Personen",
  "kind.cargo": "Güter",

  "btn.deleteNode": "Knoten löschen",
  "btn.deleteLine": "Linie löschen",
  "btn.deleteCorridor": "Trasse löschen",

  "line.auto": "Auto",
  "line.autoOn": "Auto ✓",
  "line.auto.titleOn": "Name folgt der Route (klicken zum Lösen)",
  "line.auto.titleOff": "Name aus Route erzeugen",

  "stops.label": "Halte ({n})",
  "stop.waypoint": "Wegpunkt",
  "linePanel.hint":
    "Segment-Punkt (gestrichelt) im Plan ziehen = Wegpunkt/Umleitung einfügen. Halte-Punkt (weiß) ziehen = Bahnsteig verschieben (Doppelklick = zurück).",
  "resetOverrides": "{n} Versatz{s} zurücksetzen",
  "btn.finishStops": "Halte-Bearbeitung beenden (Enter)",
  "btn.editStops": "Halte anklicken / anhängen",

  "corridor.electrified": "elektrifiziert",
  "corridor.pointsHint": "{n} Punkte · im Plan ziehen zum Anpassen",
  "btn.finishDraw": "Zeichnen beenden (Enter)",
  "btn.appendPoints": "Punkte anhängen",

  "h.cargoChains": "Güterketten ({ok}/{n} ok)",
  "cargoChains.empty": "Noch keine Güterlinien.",
  "cargoChains.danglingProducers": "Produzent ohne Abtransport: {names}",
  "cargoChains.danglingConsumers": "Verbraucher ohne Zulieferung: {names}",

  "legend.title": "Legende",
  "legend.cargo": "Güter (helle Strichelung)",
  "legend.lines": "Linien",

  "hint.addCity": "Klicke auf die Fläche, um eine Stadt zu setzen",
  "hint.addIndustry": "Klicke auf die Fläche, um eine Industrie zu setzen",
  "hint.addWarehouse": "Klicke auf die Fläche, um ein Lager zu setzen",
  "hint.drawCorridor": "Punkte klicken · Enter oder Doppelklick beendet",
  "hint.drawLine": "Knoten nacheinander anklicken · Enter oder Leerklick beendet",

  "zoom.invert": "Zoom-Richtung umkehren (falls Scrollen falschherum zoomt)",
  "zoom.in": "Vergrößern (+)",
  "zoom.out": "Verkleinern (−)",
  "zoom.fit": "Alles einpassen (0)",

  "cc.noCategory": "keine Cargo-Kategorie gewählt",
  "cc.fewStops": "weniger als 2 Halte",
  "cc.originNo": "Start „{name}“ liefert kein {what}",
  "cc.destNo": "Ziel „{name}“ nimmt kein {what} ab",
  "cc.freight": "Güter",

  "name.city": "Stadt",
  "name.industry": "Industrie",
  "name.warehouse": "Lager",
  "name.via": "Wegpunkt",
  "name.line": "Linie",
  "name.newNetwork": "Neues Netz",

  "mode.rail": "Schiene",
  "mode.road": "Straße / Bus",
  "mode.tram": "Tram",
  "mode.ship": "Schiff",
  "mode.air": "Flug",
  "prefix.rail": "Zug",
  "prefix.road": "Bus",
  "prefix.tram": "Tram",
  "prefix.ship": "Schiff",
  "prefix.air": "Flug",
  "prefix.cargo": "Güter",
  "cargo.liquid": "Liquid (Tanker)",
  "cargo.bulk": "Bulk (Schüttgut)",
  "cargo.flatbed": "Flatbed (Langgut)",
  "cargo.goods": "Goods (geschlossen)",
  "prio.low": "Niedrig",
  "prio.normal": "Normal",
  "prio.high": "Hoch",
  "corridor.road": "Straße",
  "corridor.rail": "Gleis",
  "corridor.tram": "Tramgleis",
};

const TABLES: Record<Lang, Dict> = { en: EN, de: DE };

function fmt(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

/** Translate for an explicit language (use in non-React code). */
export function tl(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  return fmt(TABLES[lang][key] ?? EN[key] ?? key, vars);
}

/** Hook: returns a `t` bound to the current language (re-renders on change). */
export function useT() {
  const lang = useUi((s) => s.lang);
  return (key: string, vars?: Record<string, string | number>) =>
    tl(lang, key, vars);
}

export const modeLabel = (lang: Lang, m: TransportMode) => tl(lang, `mode.${m}`);
export const modePrefix = (lang: Lang, m: TransportMode) => tl(lang, `prefix.${m}`);
export const cargoLabel = (lang: Lang, c: CargoCategory) => tl(lang, `cargo.${c}`);
export const priorityLabel = (lang: Lang, p: LinePriority) => tl(lang, `prio.${p}`);
export const corridorLabel = (lang: Lang, k: CorridorKind) =>
  tl(lang, `corridor.${k}`);
