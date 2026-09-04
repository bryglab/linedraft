import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, lineVisible } from "../store";
import type { Corridor, DesignNode } from "../types";
import { MODE_STYLE, CARGO_HATCH, CORRIDORS_ENABLED } from "../types";
import { useT } from "../i18n";
import {
  computeLineGeometry,
  computeStations,
  roundedPath,
} from "../lib/geometry";

const CORRIDOR_STYLE: Record<
  Corridor["kind"],
  { stroke: string; width: number; overlay?: string }
> = {
  road: { stroke: "#cbc4b5", width: 11 },
  rail: { stroke: "#a2937d", width: 8, overlay: "#5f5445" },
  tram: { stroke: "#bcb5a7", width: 5 },
};

type View = { x: number; y: number; k: number };

const MIN_K = 0.1;
const MAX_K = 5;

interface Props {
  svgRef: React.RefObject<SVGSVGElement>;
}

export function Canvas({ svgRef }: Props) {
  const t = useT();
  const project = useStore((s) => s.project);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const drawingLineId = useStore((s) => s.drawingLineId);
  const addNode = useStore((s) => s.addNode);
  const moveNode = useStore((s) => s.moveNode);
  const select = useStore((s) => s.select);
  const appendStop = useStore((s) => s.appendStop);
  const finishLine = useStore((s) => s.finishLine);
  const setStopOverride = useStore((s) => s.setStopOverride);
  const clearStopOverride = useStore((s) => s.clearStopOverride);
  const insertWaypoint = useStore((s) => s.insertWaypoint);
  const drawingCorridorId = useStore((s) => s.drawingCorridorId);
  const appendCorridorPoint = useStore((s) => s.appendCorridorPoint);
  const moveCorridorPoint = useStore((s) => s.moveCorridorPoint);
  const finishCorridor = useStore((s) => s.finishCorridor);

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const nodeById = useMemo(() => {
    const m = new Map<string, DesignNode>();
    project.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [project.nodes]);

  const geometry = useMemo(
    () => computeLineGeometry(project),
    [project.lines, project.nodes, project.routing]
  );

  const linePaths = useMemo(() => {
    const m = new Map<string, string>();
    geometry.forEach((geom, id) => m.set(id, roundedPath(geom.points)));
    return m;
  }, [geometry]);

  const stations = useMemo(
    () => computeStations(project, geometry),
    [project, geometry]
  );

  const visibleLines = project.lines.filter((l) =>
    lineVisible(l, project.layers)
  );

  // higher-priority lines render last (on top), matching TF3's right-of-way
  const PRIO_RANK: Record<string, number> = { low: 0, normal: 1, high: 2 };
  const orderedLines = [...visibleLines].sort(
    (a, b) =>
      (PRIO_RANK[a.priority ?? "normal"] ?? 1) -
      (PRIO_RANK[b.priority ?? "normal"] ?? 1)
  );

  const selectedLine =
    selection?.kind === "line"
      ? project.lines.find((l) => l.id === selection.id) ?? null
      : null;
  const selectedLineGeom = selectedLine
    ? geometry.get(selectedLine.id) ?? null
    : null;

  const dragState = useRef<
    | { type: "pan"; startX: number; startY: number; ox: number; oy: number }
    | { type: "node"; id: string; dx: number; dy: number }
    | { type: "platform"; lineId: string; stopIndex: number; nodeId: string }
    | { type: "corridorPoint"; id: string; index: number }
    | null
  >(null);

  const selectedCorridor =
    selection?.kind === "corridor"
      ? project.corridors?.find((c) => c.id === selection.id) ?? null
      : null;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  };

  /** zoom by `factor`, keeping the screen point (sx,sy) fixed */
  const zoomAt = (factor: number, sx: number, sy: number) => {
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const wx = (sx - v.x) / v.k;
      const wy = (sy - v.y) / v.k;
      return { x: sx - wx * k, y: sy - wy * k, k };
    });
  };

  /** +/- buttons: zoom around the centre of the viewport */
  const zoomStep = (factor: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    zoomAt(factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  };

  /** fit all nodes into view */
  const fitView = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || project.nodes.length === 0) {
      setView({ x: 0, y: 0, k: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of project.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    const pad = 100; // room for node labels
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const k = Math.min(MAX_K, Math.max(MIN_K, Math.min(rect.width / w, rect.height / h)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ x: rect.width / 2 - cx * k, y: rect.height / 2 - cy * k, k });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    // deltaMode: 0 = pixels, 1 = lines, 2 = pages
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;

    // Shift+wheel (or a horizontal trackpad swipe) pans; everything else zooms
    // toward the cursor. Pinch on a trackpad arrives as ctrlKey+wheel.
    if (e.shiftKey && !e.ctrlKey) {
      setView((v) => ({ ...v, x: v.x - (dx || dy), y: v.y }));
      return;
    }
    // scroll up = zoom in, scroll down = zoom out (invertible), toward the cursor
    const zd = Math.max(-50, Math.min(50, dy)); // cap one event's zoom step
    const dir = invertZoom ? 1 : -1;
    zoomAt(Math.exp(dir * zd * 0.0016), e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDownBg = (e: React.PointerEvent) => {
    // middle-mouse / right-mouse, or Space-held left drag → pan, even over elements
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const w = toWorld(e.clientX, e.clientY);
    if (
      tool === "addCity" ||
      tool === "addIndustry" ||
      tool === "addWarehouse"
    ) {
      addNode(
        tool === "addCity"
          ? "city"
          : tool === "addIndustry"
          ? "industry"
          : "warehouse",
        w.x,
        w.y
      );
      return;
    }
    if (tool === "drawLine") {
      // clicking empty space finishes the line
      finishLine();
      return;
    }
    if (tool === "drawCorridor") {
      // each click drops a free point; Enter / Esc / double-click finishes
      appendCorridorPoint(w.x, w.y);
      return;
    }
    select(null);
    startPan(e);
  };

  const onPointerDownNode = (e: React.PointerEvent, node: DesignNode) => {
    // let middle-mouse / space-drag pan bubble to the bg
    if (e.button !== 0 || spaceHeld.current) return;
    e.stopPropagation();
    if (tool === "drawLine") {
      appendStop(node.id);
      return;
    }
    if (tool === "drawCorridor") {
      // snap the corridor point to the node centre
      appendCorridorPoint(node.x, node.y);
      return;
    }
    if (tool !== "select") return;
    select({ kind: "node", id: node.id });
    if (tool === "select") {
      const w = toWorld(e.clientX, e.clientY);
      dragState.current = {
        type: "node",
        id: node.id,
        dx: node.x - w.x,
        dy: node.y - w.y,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    if (ds.type === "pan") {
      setView((v) => ({
        ...v,
        x: ds.ox + (e.clientX - ds.startX),
        y: ds.oy + (e.clientY - ds.startY),
      }));
    } else if (ds.type === "node") {
      const w = toWorld(e.clientX, e.clientY);
      moveNode(ds.id, Math.round(w.x + ds.dx), Math.round(w.y + ds.dy));
    } else if (ds.type === "corridorPoint") {
      const w = toWorld(e.clientX, e.clientY);
      moveCorridorPoint(ds.id, ds.index, w.x, w.y);
    } else {
      // platform dot: offset relative to the stop's node, clamped
      const w = toWorld(e.clientX, e.clientY);
      const nd = nodeById.get(ds.nodeId);
      if (!nd) return;
      const clamp = (v: number) => Math.max(-60, Math.min(60, v));
      setStopOverride(
        ds.lineId,
        ds.stopIndex,
        clamp(w.x - nd.x),
        clamp(w.y - nd.y)
      );
    }
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  /** pointer-down on a line/corridor overlay: select it, or drop a corridor
      point when the corridor tool is active. */
  const overlayDown = (e: React.PointerEvent, onSelect: () => void) => {
    if (e.button !== 0 || spaceHeld.current) return; // let pan bubble to the bg
    if (tool === "drawCorridor") {
      e.stopPropagation();
      const w = toWorld(e.clientX, e.clientY);
      appendCorridorPoint(w.x, w.y);
      return;
    }
    if (tool !== "select") {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    onSelect();
  };

  const fitViewRef = useRef(fitView);
  fitViewRef.current = fitView;
  const spaceHeld = useRef(false);
  const [spacePan, setSpacePan] = useState(false);

  // per-user preference: some setups want scroll-up = zoom-out
  const [invertZoom, setInvertZoom] = useState(() => {
    try {
      return localStorage.getItem("tfld:invertZoom") === "1";
    } catch {
      return false;
    }
  });
  const toggleInvertZoom = () =>
    setInvertZoom((v) => {
      const nv = !v;
      try {
        localStorage.setItem("tfld:invertZoom", nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });

  // fit the whole network into view on first load
  useEffect(() => {
    fitViewRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === "Enter") && drawingLineId) finishLine();
      if ((e.key === "Escape" || e.key === "Enter") && drawingCorridorId)
        finishCorridor();

      if (isField(e.target)) return;
      if (e.key === " ") {
        spaceHeld.current = true;
        setSpacePan(true);
        e.preventDefault();
      } else if (e.key === "+" || e.key === "=") zoomStep(1.25);
      else if (e.key === "-" || e.key === "_") zoomStep(1 / 1.25);
      else if (e.key === "0") fitViewRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceHeld.current = false;
        setSpacePan(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingLineId, finishLine, drawingCorridorId, finishCorridor]);

  const startPan = (e: React.PointerEvent) => {
    dragState.current = {
      type: "pan",
      startX: e.clientX,
      startY: e.clientY,
      ox: view.x,
      oy: view.y,
    };
    // capture so a fast drag that briefly leaves the svg keeps panning
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const drawingLine = project.lines.find((l) => l.id === drawingLineId);
  const drawingCorridor = project.corridors?.find(
    (c) => c.id === drawingCorridorId
  );
  const corridors = project.corridors ?? [];
  const corridorsVisible =
    CORRIDORS_ENABLED && project.layers.corridors !== false;

  const cursor = spacePan
    ? "grab"
    : tool === "addCity" || tool === "addIndustry" || tool === "addWarehouse"
    ? "crosshair"
    : tool === "drawLine" || tool === "drawCorridor"
    ? "copy"
    : "grab";

  return (
    <>
    <div className="zoom-ctl">
      <button
        onClick={toggleInvertZoom}
        className={invertZoom ? "active" : ""}
        title={t("zoom.invert")}
      >
        ⇅
      </button>
      <button onClick={() => zoomStep(1.25)} title={t("zoom.in")}>
        +
      </button>
      <button onClick={() => zoomStep(1 / 1.25)} title={t("zoom.out")}>
        −
      </button>
      <button onClick={() => fitView()} title={t("zoom.fit")}>
        ⤢
      </button>
      <span className="zoom-pct">{Math.round(view.k * 100)}%</span>
    </div>
    <svg
      ref={svgRef}
      onWheel={onWheel}
      onPointerDown={onPointerDownBg}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={() => {
        if (drawingCorridorId) finishCorridor();
      }}
      style={{ cursor, touchAction: "none" }}
    >
      <defs>
        <pattern
          id="grid"
          width={40 * view.k}
          height={40 * view.k}
          patternUnits="userSpaceOnUse"
          x={view.x}
          y={view.y}
        >
          <path
            d={`M ${40 * view.k} 0 L 0 0 0 ${40 * view.k}`}
            fill="none"
            stroke="#e4e0d6"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="var(--bg)" />
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#grid)"
        pointerEvents="all"
      />

      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {/* infrastructure corridors (below the lines) */}
        {corridorsVisible &&
          corridors.map((c) => {
            if (c.points.length < 2) return null;
            const cs = CORRIDOR_STYLE[c.kind];
            const d = roundedPath(c.points, 10);
            const isSel =
              selection?.kind === "corridor" && selection.id === c.id;
            return (
              <g key={c.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={cs.width + 12}
                  strokeLinecap="round"
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) =>
                    overlayDown(e, () =>
                      select({ kind: "corridor", id: c.id })
                    )
                  }
                />
                <path
                  d={d}
                  fill="none"
                  stroke={isSel ? "#2f6f4f" : "#23201b"}
                  strokeWidth={cs.width + (isSel ? 3 : 2)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                  opacity={0.35}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={cs.stroke}
                  strokeWidth={cs.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
                {cs.overlay && (
                  <path
                    d={d}
                    fill="none"
                    stroke={cs.overlay}
                    strokeWidth={cs.width}
                    strokeDasharray="1.5 6"
                    strokeLinecap="butt"
                    pointerEvents="none"
                  />
                )}
                {c.kind === "road" && (c.lanes ?? 1) >= 2 && (
                  <path
                    d={d}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={1}
                    strokeDasharray="6 6"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

        {/* in-progress corridor */}
        {drawingCorridor && drawingCorridor.points.length > 0 && (
          <polyline
            points={drawingCorridor.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#2f6f4f"
            strokeWidth={2}
            strokeDasharray="5 4"
            pointerEvents="none"
          />
        )}

        {/* line casings (white gap between parallel lines) */}
        {orderedLines.map((line) => {
          const d = linePaths.get(line.id);
          if (!d) return null;
          return (
            <path
              key={"case-" + line.id}
              d={d}
              fill="none"
              stroke="var(--bg)"
              strokeWidth={MODE_STYLE[line.mode].width + 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          );
        })}

        {/* line strokes */}
        {orderedLines.map((line) => {
          const d = linePaths.get(line.id);
          if (!d) return null;
          const isSel = selection?.kind === "line" && selection.id === line.id;
          const st = MODE_STYLE[line.mode];
          return (
            <g key={line.id}>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ cursor: "pointer" }}
                onPointerDown={(e) =>
                  overlayDown(e, () => select({ kind: "line", id: line.id }))
                }
              />
              <path
                d={d}
                fill="none"
                stroke={line.color}
                strokeWidth={isSel ? st.width + 2 : st.width}
                strokeLinecap={st.cap}
                strokeLinejoin="round"
                strokeDasharray={st.dash}
                pointerEvents="none"
              />
              {line.kind === "cargo" && (
                <path
                  d={d}
                  fill="none"
                  stroke="var(--bg)"
                  strokeWidth={CARGO_HATCH.width}
                  strokeLinecap="butt"
                  strokeDasharray={CARGO_HATCH.dash}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* station markers: rounded bar across the tracks, squarer where lines fan */}
        {stations.map((st, i) => {
          const deg = (st.angle * 180) / Math.PI;
          const t = `translate(${st.x} ${st.y}) rotate(${deg})`;
          return (
            <rect
              key={"st" + i}
              transform={t}
              x={-st.halfLen}
              y={-st.halfWid}
              width={st.halfLen * 2}
              height={st.halfWid * 2}
              rx={st.halfWid}
              fill={st.interchange ? "#fff" : "#23201b"}
              stroke="#23201b"
              strokeWidth={st.interchange ? 2 : 0}
              pointerEvents="none"
            />
          );
        })}

        {/* per-line platform dot at every stop (non-selected lines) */}
        {visibleLines.map((line) => {
          if (selection?.kind === "line" && selection.id === line.id) return null;
          const g = geometry.get(line.id);
          if (!g) return null;
          return g.stopPoints.map((p, i) => {
            if (nodeById.get(line.stops[i])?.kind === "via") return null;
            return (
              <circle
                key={line.id + "-dot" + i}
                cx={p.x}
                cy={p.y}
                r={2.4}
                fill={line.stopOverrides?.[i] ? line.color : "#23201b"}
                stroke="var(--bg)"
                strokeWidth={1}
                pointerEvents="none"
              />
            );
          });
        })}

        {/* in-progress line rubber band already covered above; highlight its stops */}
        {drawingLine && (
          <polyline
            points={drawingLine.stops
              .map((id) => nodeById.get(id))
              .filter((n): n is DesignNode => !!n)
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
            fill="none"
            stroke={drawingLine.color}
            strokeWidth={3}
            strokeDasharray="4 4"
            pointerEvents="none"
          />
        )}

        {/* nodes */}
        {project.nodes.map((n) => {
          const isSel = selection?.kind === "node" && selection.id === n.id;
          const inDrawing = drawingLine?.stops.includes(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onPointerDown={(e) => onPointerDownNode(e, n)}
              style={{ cursor: tool === "select" ? "move" : "pointer" }}
            >
              {/* invisible hit target */}
              <circle r={14} fill="transparent" />
              {n.kind === "via" ? (
                <circle
                  r={isSel ? 4 : 3}
                  fill="#f7f5f0"
                  stroke={isSel ? "#2f6f4f" : "#8a8378"}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
              ) : n.kind === "city" ? (
                <circle
                  r={isSel ? 4.5 : 3.5}
                  fill={isSel ? "#2f6f4f" : "#23201b"}
                />
              ) : n.kind === "warehouse" ? (
                <g
                  transform="rotate(45)"
                  stroke={isSel ? "#2f6f4f" : "#23201b"}
                  strokeWidth={isSel ? 3 : 2}
                >
                  <rect
                    x={-6}
                    y={-6}
                    width={12}
                    height={12}
                    fill={cargoColor(n.cargoCategory)}
                  />
                </g>
              ) : (
                <rect
                  x={-7}
                  y={-7}
                  width={14}
                  height={14}
                  fill={cargoColor(n.cargoCategory)}
                  stroke={isSel ? "#2f6f4f" : "#23201b"}
                  strokeWidth={isSel ? 3 : 2}
                />
              )}
              {inDrawing && (
                <circle r={16} fill="none" stroke={drawingLine!.color} strokeWidth={1.5} />
              )}
              {project.layers.labels && n.kind !== "via" && (
                <text
                  x={n.kind === "city" ? 8 : 11}
                  y={n.kind === "city" ? -8 : 4}
                  fontSize={12}
                  fontWeight={n.kind === "city" ? 700 : 400}
                  fill="#23201b"
                  style={{ paintOrder: "stroke", stroke: "#f7f5f0", strokeWidth: 3.5 }}
                >
                  {n.name}
                </text>
              )}
            </g>
          );
        })}

        {/* selected line: segment handles (drag out a routing waypoint) */}
        {selectedLineGeom &&
          selectedLine &&
          selectedLineGeom.stopPoints.slice(0, -1).map((p, i) => {
            const q = selectedLineGeom.stopPoints[i + 1];
            const mx = (p.x + q.x) / 2;
            const my = (p.y + q.y) / 2;
            return (
              <g key={"seg" + i} style={{ cursor: "grab" }}>
                <circle
                  cx={mx}
                  cy={my}
                  r={9}
                  fill="transparent"
                  onPointerDown={(e) => {
                    if (e.button !== 0 || spaceHeld.current) return;
                    e.stopPropagation();
                    const w = toWorld(e.clientX, e.clientY);
                    const id = insertWaypoint(selectedLine.id, i, w.x, w.y);
                    dragState.current = { type: "node", id, dx: 0, dy: 0 };
                    try {
                      svgRef.current?.setPointerCapture(e.pointerId);
                    } catch {
                      /* ignore */
                    }
                  }}
                />
                <circle
                  cx={mx}
                  cy={my}
                  r={4}
                  fill="#f7f5f0"
                  stroke="#8a8378"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  pointerEvents="none"
                />
              </g>
            );
          })}

        {/* draggable platform handles for the selected line (on top of nodes) */}
        {selectedLineGeom &&
          selectedLine &&
          selectedLineGeom.stopPoints.map((p, i) => {
            if (nodeById.get(selectedLine.stops[i])?.kind === "via") return null;
            return (
              <circle
                key={"handle" + i}
                cx={p.x}
                cy={p.y}
                r={5}
                fill={
                  selectedLine.stopOverrides?.[i] ? selectedLine.color : "#fff"
                }
                stroke="#23201b"
                strokeWidth={2}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || spaceHeld.current) return;
                  e.stopPropagation();
                  dragState.current = {
                    type: "platform",
                    lineId: selectedLine.id,
                    stopIndex: i,
                    nodeId: selectedLine.stops[i],
                  };
                  (e.target as Element).setPointerCapture(e.pointerId);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  clearStopOverride(selectedLine.id, i);
                }}
              />
            );
          })}

        {/* draggable vertex handles for the selected corridor */}
        {selectedCorridor &&
          selectedCorridor.points.map((p, i) => (
            <circle
              key={"cpt" + i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill="#fff"
              stroke="#2f6f4f"
              strokeWidth={2}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                if (e.button !== 0 || spaceHeld.current) return;
                e.stopPropagation();
                dragState.current = {
                  type: "corridorPoint",
                  id: selectedCorridor.id,
                  index: i,
                };
                (e.target as Element).setPointerCapture(e.pointerId);
              }}
            />
          ))}
      </g>
    </svg>
    </>
  );
}

function cargoColor(c?: string) {
  switch (c) {
    case "liquid":
      return "#7fb3d5";
    case "bulk":
      return "#d7b47a";
    case "flatbed":
      return "#b0a99f";
    case "goods":
      return "#a3c9a8";
    default:
      return "#ccc";
  }
}
