import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Corridor,
  DesignNode,
  Line,
  LineKind,
  NodeKind,
  Project,
  RoutingMode,
  TransportMode,
  LayerState,
} from "./types";
import { LINE_PALETTE } from "./types";
import { sampleProject } from "./lib/sampleProject";
import { autoLineName } from "./lib/naming";
import { useUi, tl } from "./i18n";

const lang = () => useUi.getState().lang;

const STORAGE_KEY = "tf-line-designer:project";

/** Drop waypoint (via) nodes no line references any more. */
function pruneOrphanVias(project: Project): Project {
  const used = new Set(project.lines.flatMap((l) => l.stops));
  const nodes = project.nodes.filter(
    (n) => n.kind !== "via" || used.has(n.id)
  );
  return nodes.length === project.nodes.length ? project : { ...project, nodes };
}

/** Refresh the name of every line whose name is pattern-linked. */
function withAutoNames(project: Project): Project {
  if (!project.lines.some((l) => l.autoName)) return project;
  const lg = lang();
  return {
    ...project,
    lines: project.lines.map((l) =>
      l.autoName ? { ...l, name: autoLineName(l, project, lg) } : l
    ),
  };
}

export type Tool =
  | "select"
  | "addCity"
  | "addIndustry"
  | "addWarehouse"
  | "drawLine"
  | "drawCorridor";

export interface Selection {
  kind: "node" | "line" | "corridor";
  id: string;
}

interface State {
  project: Project;
  tool: Tool;
  selection: Selection | null;
  /** id of the line currently being drawn (drawLine tool) */
  drawingLineId: string | null;
  /** id of the corridor currently being drawn */
  drawingCorridorId: string | null;

  setTool: (t: Tool) => void;
  select: (s: Selection | null) => void;

  addNode: (kind: NodeKind, x: number, y: number) => string;
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  deleteNode: (id: string) => void;

  startLine: () => void;
  editLineStops: (id: string) => void;
  appendStop: (nodeId: string) => void;
  finishLine: () => void;
  updateLine: (id: string, patch: Partial<Line>) => void;
  removeStop: (lineId: string, index: number) => void;
  reorderStop: (lineId: string, from: number, to: number) => void;
  /** insert a routing waypoint (via node) into a line's route, at segIndex */
  insertWaypoint: (lineId: string, segIndex: number, x: number, y: number) => string;
  deleteLine: (id: string) => void;
  setStopOverride: (lineId: string, stopIndex: number, dx: number, dy: number) => void;
  clearStopOverride: (lineId: string, stopIndex: number) => void;
  clearStopOverrides: (lineId: string) => void;

  setLineAutoName: (id: string, on: boolean) => void;
  setProjectAutoName: (on: boolean) => void;

  startCorridor: () => void;
  editCorridorPoints: (id: string) => void;
  appendCorridorPoint: (x: number, y: number) => void;
  moveCorridorPoint: (id: string, index: number, x: number, y: number) => void;
  finishCorridor: () => void;
  updateCorridor: (id: string, patch: Partial<Corridor>) => void;
  deleteCorridor: (id: string) => void;

  setLayer: (key: keyof LayerState, value: boolean) => void;
  setRouting: (routing: RoutingMode) => void;
  setProjectName: (name: string) => void;
  loadProject: (p: Project) => void;
  newProject: () => void;
  resetToSample: () => void;
}

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Project;
      if (parsed && parsed.version === 1) {
        if (parsed.routing !== "octilinear") parsed.routing = "direct";
        if (!parsed.corridors) parsed.corridors = [];
        if (parsed.layers && parsed.layers.corridors === undefined)
          parsed.layers.corridors = true;
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return sampleProject();
}

function emptyProject(): Project {
  return {
    version: 1,
    name: tl(lang(), "name.newNetwork"),
    routing: "octilinear",
    autoName: true,
    nodes: [],
    lines: [],
    corridors: [],
    layers: {
      passenger: true,
      cargo: true,
      rail: true,
      road: true,
      tram: true,
      ship: true,
      air: true,
      labels: true,
      corridors: true,
    },
  };
}

export const useStore = create<State>((set, get) => ({
  project: loadInitial(),
  tool: "select",
  selection: null,
  drawingLineId: null,
  drawingCorridorId: null,

  setTool: (t) => set({ tool: t, drawingLineId: null, drawingCorridorId: null }),
  select: (s) => set({ selection: s }),

  addNode: (kind, x, y) => {
    const id = nanoid(8);
    const count = get().project.nodes.filter((n) => n.kind === kind).length + 1;
    const baseName = tl(
      lang(),
      kind === "city"
        ? "name.city"
        : kind === "warehouse"
        ? "name.warehouse"
        : kind === "via"
        ? "name.via"
        : "name.industry"
    );
    const node: DesignNode = {
      id,
      kind,
      name: `${baseName} ${count}`,
      x,
      y,
      ...(kind === "industry"
        ? { cargoCategory: "goods", role: "source" }
        : kind === "warehouse"
        ? { cargoCategory: "goods" }
        : {}),
    };
    set((st) => ({
      project: { ...st.project, nodes: [...st.project.nodes, node] },
      selection: { kind: "node", id },
    }));
    return id;
  },

  updateNode: (id, patch) =>
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        nodes: st.project.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      }),
    })),

  moveNode: (id, x, y) =>
    set((st) => ({
      project: {
        ...st.project,
        nodes: st.project.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
    })),

  deleteNode: (id) =>
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        nodes: st.project.nodes.filter((n) => n.id !== id),
        lines: st.project.lines.map((l) => ({
          ...l,
          stops: l.stops.filter((s) => s !== id),
        })),
      }),
      selection: null,
    })),

  startLine: () => {
    const id = nanoid(8);
    const idx = get().project.lines.length;
    const auto = get().project.autoName ?? true;
    const line: Line = {
      id,
      name: `${tl(lang(), "name.line")} ${idx + 1}`,
      mode: "rail",
      kind: "passenger",
      color: LINE_PALETTE[idx % LINE_PALETTE.length],
      stops: [],
      priority: "normal",
      autoName: auto,
    };
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        lines: [...st.project.lines, line],
      }),
      tool: "drawLine",
      drawingLineId: id,
      selection: { kind: "line", id },
    }));
  },

  editLineStops: (id) =>
    set({ tool: "drawLine", drawingLineId: id, selection: { kind: "line", id } }),

  appendStop: (nodeId) => {
    const lineId = get().drawingLineId;
    if (!lineId) return;
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        lines: st.project.lines.map((l) =>
          l.id === lineId && l.stops[l.stops.length - 1] !== nodeId
            ? { ...l, stops: [...l.stops, nodeId] }
            : l
        ),
      }),
    }));
  },

  finishLine: () => {
    const lineId = get().drawingLineId;
    if (lineId) {
      // drop lines that ended up with fewer than 2 stops
      set((st) => ({
        project: withAutoNames({
          ...st.project,
          lines: st.project.lines.filter(
            (l) => l.id !== lineId || l.stops.length >= 2
          ),
        }),
      }));
    }
    set({ tool: "select", drawingLineId: null });
  },

  updateLine: (id, patch) =>
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        lines: st.project.lines.map((l) => {
          if (l.id !== id) return l;
          // typing in the name field detaches the line from the pattern
          const next = { ...l, ...patch };
          if (patch.name !== undefined) next.autoName = false;
          return next;
        }),
      }),
    })),

  removeStop: (lineId, index) =>
    set((st) => ({
      project: pruneOrphanVias(
        withAutoNames({
          ...st.project,
          lines: st.project.lines.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  stops: l.stops.filter((_, i) => i !== index),
                  stopOverrides: undefined,
                }
              : l
          ),
        })
      ),
    })),

  reorderStop: (lineId, from, to) =>
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        lines: st.project.lines.map((l) => {
          if (l.id !== lineId) return l;
          const stops = [...l.stops];
          const [moved] = stops.splice(from, 1);
          stops.splice(to, 0, moved);
          // stop indices changed → manual platform positions no longer valid
          return { ...l, stops, stopOverrides: undefined };
        }),
      }),
    })),

  insertWaypoint: (lineId, segIndex, x, y) => {
    const id = nanoid(8);
    const line = get().project.lines.find((l) => l.id === lineId);
    if (!line) return id;
    const count =
      get().project.nodes.filter((n) => n.kind === "via").length + 1;
    const node: DesignNode = {
      id,
      kind: "via",
      name: `${tl(lang(), "name.via")} ${count}`,
      x: Math.round(x),
      y: Math.round(y),
    };
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        nodes: [...st.project.nodes, node],
        lines: st.project.lines.map((l) => {
          if (l.id !== lineId) return l;
          const stops = [...l.stops];
          stops.splice(segIndex + 1, 0, id);
          return { ...l, stops, stopOverrides: undefined };
        }),
      }),
    }));
    return id;
  },

  deleteLine: (id) =>
    set((st) => ({
      project: pruneOrphanVias(
        withAutoNames({
          ...st.project,
          lines: st.project.lines.filter((l) => l.id !== id),
        })
      ),
      selection: null,
    })),

  setLineAutoName: (id, on) =>
    set((st) => ({
      project: withAutoNames({
        ...st.project,
        lines: st.project.lines.map((l) =>
          l.id === id ? { ...l, autoName: on } : l
        ),
      }),
    })),

  setProjectAutoName: (on) =>
    set((st) => ({ project: { ...st.project, autoName: on } })),

  startCorridor: () => {
    const id = nanoid(8);
    const corridor: Corridor = { id, kind: "road", points: [], lanes: 2 };
    set((st) => ({
      project: {
        ...st.project,
        corridors: [...(st.project.corridors ?? []), corridor],
      },
      tool: "drawCorridor",
      drawingCorridorId: id,
      selection: { kind: "corridor", id },
    }));
  },

  editCorridorPoints: (id) =>
    set({
      tool: "drawCorridor",
      drawingCorridorId: id,
      selection: { kind: "corridor", id },
    }),

  appendCorridorPoint: (x, y) => {
    const cid = get().drawingCorridorId;
    if (!cid) return;
    set((st) => ({
      project: {
        ...st.project,
        corridors: (st.project.corridors ?? []).map((c) =>
          c.id === cid
            ? { ...c, points: [...c.points, { x: Math.round(x), y: Math.round(y) }] }
            : c
        ),
      },
    }));
  },

  moveCorridorPoint: (id, index, x, y) =>
    set((st) => ({
      project: {
        ...st.project,
        corridors: (st.project.corridors ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                points: c.points.map((p, i) =>
                  i === index ? { x: Math.round(x), y: Math.round(y) } : p
                ),
              }
            : c
        ),
      },
    })),

  finishCorridor: () => {
    const cid = get().drawingCorridorId;
    if (cid) {
      set((st) => ({
        project: {
          ...st.project,
          corridors: (st.project.corridors ?? []).filter(
            (c) => c.id !== cid || c.points.length >= 2
          ),
        },
      }));
    }
    set({ tool: "select", drawingCorridorId: null });
  },

  updateCorridor: (id, patch) =>
    set((st) => ({
      project: {
        ...st.project,
        corridors: (st.project.corridors ?? []).map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      },
    })),

  deleteCorridor: (id) =>
    set((st) => ({
      project: {
        ...st.project,
        corridors: (st.project.corridors ?? []).filter((c) => c.id !== id),
      },
      selection: null,
    })),

  setStopOverride: (lineId, stopIndex, dx, dy) =>
    set((st) => ({
      project: {
        ...st.project,
        lines: st.project.lines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                stopOverrides: {
                  ...l.stopOverrides,
                  [stopIndex]: {
                    dx: Math.round(dx * 10) / 10,
                    dy: Math.round(dy * 10) / 10,
                  },
                },
              }
            : l
        ),
      },
    })),

  clearStopOverride: (lineId, stopIndex) =>
    set((st) => ({
      project: {
        ...st.project,
        lines: st.project.lines.map((l) => {
          if (l.id !== lineId || !l.stopOverrides) return l;
          const next = { ...l.stopOverrides };
          delete next[stopIndex];
          return {
            ...l,
            stopOverrides: Object.keys(next).length ? next : undefined,
          };
        }),
      },
    })),

  clearStopOverrides: (lineId) =>
    set((st) => ({
      project: {
        ...st.project,
        lines: st.project.lines.map((l) =>
          l.id === lineId ? { ...l, stopOverrides: undefined } : l
        ),
      },
    })),

  setLayer: (key, value) =>
    set((st) => ({
      project: { ...st.project, layers: { ...st.project.layers, [key]: value } },
    })),

  setRouting: (routing) =>
    set((st) => ({ project: { ...st.project, routing } })),

  setProjectName: (name) =>
    set((st) => ({ project: { ...st.project, name } })),

  loadProject: (p) =>
    set({
      project: {
        ...p,
        routing: p.routing === "octilinear" ? "octilinear" : "direct",
        corridors: p.corridors ?? [],
        layers: {
          ...p.layers,
          corridors: p.layers?.corridors ?? true,
        },
      },
      selection: null,
      tool: "select",
      drawingLineId: null,
      drawingCorridorId: null,
    }),

  newProject: () =>
    set({
      project: emptyProject(),
      selection: null,
      tool: "select",
      drawingLineId: null,
      drawingCorridorId: null,
    }),

  resetToSample: () =>
    set({
      project: sampleProject(),
      selection: null,
      tool: "select",
      drawingLineId: null,
      drawingCorridorId: null,
    }),
}));

// autosave to localStorage
useStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
  } catch {
    /* ignore quota / private mode */
  }
});

export const MODE_TO_LAYER: Record<TransportMode, keyof LayerState> = {
  rail: "rail",
  road: "road",
  tram: "tram",
  ship: "ship",
  air: "air",
};

export function lineVisible(
  line: { mode: TransportMode; kind: LineKind; hidden?: boolean },
  layers: LayerState
): boolean {
  if (line.hidden) return false;
  if (!layers[MODE_TO_LAYER[line.mode]]) return false;
  if (line.kind === "passenger" && !layers.passenger) return false;
  if (line.kind === "cargo" && !layers.cargo) return false;
  return true;
}
