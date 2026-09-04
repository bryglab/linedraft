export type NodeKind = "city" | "industry" | "warehouse" | "via";

export type CargoCategory = "liquid" | "bulk" | "flatbed" | "goods";

/** What an industry does in the supply chain. */
export type IndustryRole = "source" | "sink" | "both";

export interface DesignNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  note?: string;
  /** industry & warehouse: which of the 4 TF3 cargo categories */
  cargoCategory?: CargoCategory;
  /** industry only */
  role?: IndustryRole;
}

export type TransportMode = "rail" | "road" | "tram" | "ship" | "air";

export type LineKind = "passenger" | "cargo";

/** TF3 line priority: low waits at red, high gets longer reservation distance. */
export type LinePriority = "low" | "normal" | "high";

export interface Line {
  id: string;
  name: string;
  mode: TransportMode;
  kind: LineKind;
  color: string;
  /** ordered node ids */
  stops: string[];
  /** cargo lines only */
  cargoCategory?: CargoCategory;
  priority?: LinePriority;
  /** name is kept in sync with the route pattern until the user edits it */
  autoName?: boolean;
  note?: string;
  hidden?: boolean;
  /**
   * Manual platform position per stop: keyed by stop index, an offset in world
   * units from that stop's node centre. Overrides the auto-computed slot.
   */
  stopOverrides?: Record<string, { dx: number; dy: number }>;
}

export interface LayerState {
  passenger: boolean;
  cargo: boolean;
  rail: boolean;
  road: boolean;
  tram: boolean;
  ship: boolean;
  air: boolean;
  labels: boolean;
  corridors: boolean;
}

// Feature flags – vorerst deaktivierte Funktionen (Code bleibt jeweils drin).
export const CORRIDORS_ENABLED = false;
export const WAREHOUSES_ENABLED = false;
export const PRIORITY_ENABLED = false;
export const CARGO_CATEGORY_ENABLED = false;

export type CorridorKind = "road" | "rail" | "tram";

/** A free-drawn piece of physical infrastructure, independent of lines. */
export interface Corridor {
  id: string;
  kind: CorridorKind;
  name?: string;
  /** free world-coordinate points */
  points: { x: number; y: number }[];
  /** road only */
  lanes?: number;
  /** rail only */
  electrified?: boolean;
  note?: string;
}

export type RoutingMode = "direct" | "octilinear";

export interface Project {
  version: 1;
  name: string;
  nodes: DesignNode[];
  lines: Line[];
  corridors?: Corridor[];
  layers: LayerState;
  /** line routing style; defaults to "direct" for older files */
  routing: RoutingMode;
  /** name new lines automatically from their route */
  autoName?: boolean;
}

export interface ModeStyle {
  /** SVG stroke-dasharray, in world units; omitted = solid */
  dash?: string;
  /** base stroke width in world units */
  width: number;
  cap: "round" | "butt";
}

/** Visual line style per transport mode (see also cargo hatch in the canvas). */
export const MODE_STYLE: Record<TransportMode, ModeStyle> = {
  rail: { width: 4, cap: "round" }, // durchgezogen, kräftig
  tram: { width: 2.5, cap: "round" }, // durchgezogen, dünn
  road: { dash: "9 7", width: 4, cap: "butt" }, // gestrichelt
  ship: { dash: "0.1 6", width: 4.5, cap: "round" }, // gepunktet
  air: { dash: "1 7 14 7", width: 4, cap: "round" }, // Strich-Punkt
};

/** Cargo lines get this pale hatch on top of the colour, on any mode. */
export const CARGO_HATCH = { dash: "2.5 6.5", width: 2 };

export const LINE_PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#008080",
  "#9a6324",
  "#800000",
  "#808000",
  "#000075",
  "#f032e6",
  "#469990",
];
