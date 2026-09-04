import { useStore, lineVisible } from "../store";
import {
  CARGO_CATEGORY_ENABLED,
  CORRIDORS_ENABLED,
  LINE_PALETTE,
  PRIORITY_ENABLED,
  WAREHOUSES_ENABLED,
  type CargoCategory,
  type CorridorKind,
  type LayerState,
  type LineKind,
  type LinePriority,
  type NodeKind,
  type RoutingMode,
  type TransportMode,
} from "../types";
import {
  cargoLabel,
  corridorLabel,
  modeLabel,
  priorityLabel,
  useT,
  useUi,
  type Lang,
} from "../i18n";
import { CargoChains } from "./CargoChains";

const LAYER_KEYS: (keyof LayerState)[] = [
  "passenger",
  "cargo",
  "rail",
  "road",
  "tram",
  "ship",
  "air",
  ...(CORRIDORS_ENABLED ? (["corridors"] as (keyof LayerState)[]) : []),
  "labels",
];
const CARGO_KEYS: CargoCategory[] = ["liquid", "bulk", "flatbed", "goods"];
const MODE_KEYS: TransportMode[] = ["rail", "road", "tram", "ship", "air"];
const CORRIDOR_KEYS: CorridorKind[] = ["road", "rail", "tram"];

export function Sidebar() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const setLayer = useStore((s) => s.setLayer);
  const setRouting = useStore((s) => s.setRouting);
  const setProjectAutoName = useStore((s) => s.setProjectAutoName);
  const drawingLineId = useStore((s) => s.drawingLineId);
  const t = useT();
  const lang = useUi((s) => s.lang);

  const viaIds = new Set(
    project.nodes.filter((n) => n.kind === "via").map((n) => n.id)
  );
  const stopCount = (l: { stops: string[] }) =>
    l.stops.filter((s) => !viaIds.has(s)).length;

  const cityN = project.nodes.filter((n) => n.kind === "city").length;
  const indN = project.nodes.filter((n) => n.kind === "industry").length;
  const whN = project.nodes.filter((n) => n.kind === "warehouse").length;
  const passN = project.lines.filter((l) => l.kind === "passenger").length;
  const cargoN = project.lines.filter((l) => l.kind === "cargo").length;

  return (
    <div className="sidebar">
      <h3>{t("h.routing")}</h3>
      <select
        value={project.routing ?? "direct"}
        onChange={(e) => setRouting(e.target.value as RoutingMode)}
      >
        <option value="direct">{t("routing.direct")}</option>
        <option value="octilinear">{t("routing.octilinear")}</option>
      </select>
      <div className="checks" style={{ marginTop: 6 }}>
        <label>
          <input
            type="checkbox"
            checked={project.autoName ?? true}
            onChange={(e) => setProjectAutoName(e.target.checked)}
          />
          {t("autoNameNew")}
        </label>
      </div>

      <h3>{t("h.layers")}</h3>
      <div className="checks">
        {LAYER_KEYS.map((k) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={project.layers[k]}
              onChange={(e) => setLayer(k, e.target.checked)}
            />
            {t(`layer.${k}`)}
          </label>
        ))}
      </div>

      <h3>{t("h.lines", { n: project.lines.length })}</h3>
      {project.lines.length === 0 && (
        <p className="muted">{t("lines.empty")}</p>
      )}
      {project.lines.map((l) => (
        <div
          key={l.id}
          className={
            "line-list-item" +
            (selection?.kind === "line" && selection.id === l.id ? " selected" : "")
          }
          onClick={() => select({ kind: "line", id: l.id })}
        >
          <span className="swatch" style={{ background: l.color }} />
          <span style={{ flex: 1, opacity: lineVisible(l, project.layers) ? 1 : 0.4 }}>
            {PRIORITY_ENABLED &&
              (l.priority === "high" ? "▲ " : l.priority === "low" ? "▽ " : "")}
            {l.name}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {l.kind === "cargo" ? "▦" : "●"} {stopCount(l)}
          </span>
        </div>
      ))}

      {CORRIDORS_ENABLED && (project.corridors?.length ?? 0) > 0 && (
        <>
          <h3>{t("h.corridors", { n: project.corridors!.length })}</h3>
          {project.corridors!.map((c) => (
            <div
              key={c.id}
              className={
                "line-list-item" +
                (selection?.kind === "corridor" && selection.id === c.id
                  ? " selected"
                  : "")
              }
              onClick={() => select({ kind: "corridor", id: c.id })}
            >
              <span style={{ flex: 1 }}>
                {c.name || corridorLabel(lang, c.kind)}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                {corridorLabel(lang, c.kind)}
              </span>
            </div>
          ))}
        </>
      )}

      <h3>{t("h.properties")}</h3>
      {!selection && <p className="muted">{t("select.prompt")}</p>}
      {selection?.kind === "node" && <NodePanel id={selection.id} />}
      {selection?.kind === "line" && (
        <LinePanel id={selection.id} drawing={drawingLineId === selection.id} />
      )}
      {CORRIDORS_ENABLED && selection?.kind === "corridor" && (
        <CorridorPanel id={selection.id} />
      )}

      <CargoChains />

      <h3>{t("h.net")}</h3>
      <p className="muted" style={{ fontSize: 12 }}>
        {t("net.cities", { n: cityN })} · {t("net.industries", { n: indN })}
        {WAREHOUSES_ENABLED && ` · ${t("net.warehouses", { n: whN })}`} ·{" "}
        {t("net.lines", { p: passN, c: cargoN })}
      </p>
    </div>
  );
}

function NodePanel({ id }: { id: string }) {
  const node = useStore((s) => s.project.nodes.find((n) => n.id === id));
  const updateNode = useStore((s) => s.updateNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const t = useT();
  const lang = useUi((s) => s.lang);
  if (!node) return null;

  if (node.kind === "via") {
    return (
      <div>
        <p className="muted" style={{ fontSize: 12 }}>
          {t("via.desc")}
        </p>
        <div className="field">
          <label>{t("field.note")}</label>
          <textarea
            rows={2}
            value={node.note ?? ""}
            onChange={(e) => updateNode(id, { note: e.target.value })}
          />
        </div>
        <button
          className="mini"
          onClick={() =>
            updateNode(id, { kind: "city", name: t("via.stationName") })
          }
        >
          {t("via.toStation")}
        </button>
        <div style={{ height: 8 }} />
        <button className="danger" onClick={() => deleteNode(id)}>
          {t("via.remove")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="field">
        <label>{t("field.name")}</label>
        <input
          value={node.name}
          onChange={(e) => updateNode(id, { name: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{t("field.type")}</label>
        <select
          value={node.kind}
          onChange={(e) => {
            const kind = e.target.value as NodeKind;
            updateNode(id, {
              kind,
              ...((kind === "industry" || kind === "warehouse") &&
              !node.cargoCategory
                ? { cargoCategory: "goods" }
                : {}),
              ...(kind === "industry" && !node.role ? { role: "source" } : {}),
            });
          }}
        >
          <option value="city">{t("type.city")}</option>
          <option value="industry">{t("type.industry")}</option>
          {WAREHOUSES_ENABLED && (
            <option value="warehouse">{t("type.warehouse")}</option>
          )}
        </select>
      </div>
      {CARGO_CATEGORY_ENABLED &&
        (node.kind === "industry" || node.kind === "warehouse") && (
          <div className="field">
            <label>{t("field.cargoCat")}</label>
            <select
              value={node.cargoCategory ?? "goods"}
              onChange={(e) =>
                updateNode(id, {
                  cargoCategory: e.target.value as CargoCategory,
                })
              }
            >
              {CARGO_KEYS.map((k) => (
                <option key={k} value={k}>
                  {cargoLabel(lang, k)}
                </option>
              ))}
            </select>
          </div>
        )}
      {node.kind === "industry" && (
        <div className="field">
          <label>{t("field.role")}</label>
          <select
            value={node.role ?? "source"}
            onChange={(e) =>
              updateNode(id, { role: e.target.value as "source" | "sink" | "both" })
            }
          >
            <option value="source">{t("role.source")}</option>
            <option value="sink">{t("role.sink")}</option>
            <option value="both">{t("role.both")}</option>
          </select>
        </div>
      )}
      <div className="field">
        <label>{t("field.note")}</label>
        <textarea
          rows={2}
          value={node.note ?? ""}
          onChange={(e) => updateNode(id, { note: e.target.value })}
        />
      </div>
      <button className="danger" onClick={() => deleteNode(id)}>
        {t("btn.deleteNode")}
      </button>
    </div>
  );
}

function LinePanel({ id, drawing }: { id: string; drawing: boolean }) {
  const line = useStore((s) => s.project.lines.find((l) => l.id === id));
  const nodes = useStore((s) => s.project.nodes);
  const updateLine = useStore((s) => s.updateLine);
  const deleteLine = useStore((s) => s.deleteLine);
  const removeStop = useStore((s) => s.removeStop);
  const reorderStop = useStore((s) => s.reorderStop);
  const editLineStops = useStore((s) => s.editLineStops);
  const finishLine = useStore((s) => s.finishLine);
  const clearStopOverrides = useStore((s) => s.clearStopOverrides);
  const setLineAutoName = useStore((s) => s.setLineAutoName);
  const t = useT();
  const lang: Lang = useUi((s) => s.lang);
  if (!line) return null;

  const overrideCount = Object.keys(line.stopOverrides ?? {}).length;
  const nodeName = (nid: string) =>
    nodes.find((n) => n.id === nid)?.name ?? "?";
  const nodeKind = (nid: string) => nodes.find((n) => n.id === nid)?.kind;

  return (
    <div>
      <div className="field">
        <label>
          {t("field.name")}{" "}
          <button
            className="mini"
            title={
              line.autoName ? t("line.auto.titleOn") : t("line.auto.titleOff")
            }
            onClick={() => setLineAutoName(id, !line.autoName)}
            style={line.autoName ? { borderColor: "#2f6f4f" } : undefined}
          >
            {line.autoName ? t("line.autoOn") : t("line.auto")}
          </button>
        </label>
        <input
          value={line.name}
          onChange={(e) => updateLine(id, { name: e.target.value })}
        />
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>{t("field.mode")}</label>
          <select
            value={line.mode}
            onChange={(e) =>
              updateLine(id, { mode: e.target.value as TransportMode })
            }
          >
            {MODE_KEYS.map((k) => (
              <option key={k} value={k}>
                {modeLabel(lang, k)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{t("field.kind")}</label>
          <select
            value={line.kind}
            onChange={(e) => updateLine(id, { kind: e.target.value as LineKind })}
          >
            <option value="passenger">{t("kind.passenger")}</option>
            <option value="cargo">{t("kind.cargo")}</option>
          </select>
        </div>
      </div>
      {CARGO_CATEGORY_ENABLED && line.kind === "cargo" && (
        <div className="field">
          <label>{t("field.cargoCat")}</label>
          <select
            value={line.cargoCategory ?? "goods"}
            onChange={(e) =>
              updateLine(id, { cargoCategory: e.target.value as CargoCategory })
            }
          >
            {CARGO_KEYS.map((k) => (
              <option key={k} value={k}>
                {cargoLabel(lang, k)}
              </option>
            ))}
          </select>
        </div>
      )}
      {PRIORITY_ENABLED && (
        <div className="field">
          <label>{t("field.priority")}</label>
          <select
            value={line.priority ?? "normal"}
            onChange={(e) =>
              updateLine(id, { priority: e.target.value as LinePriority })
            }
          >
            {(["high", "normal", "low"] as LinePriority[]).map((p) => (
              <option key={p} value={p}>
                {priorityLabel(lang, p)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>{t("field.color")}</label>
        <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
          {LINE_PALETTE.map((c) => (
            <button
              key={c}
              className="mini"
              onClick={() => updateLine(id, { color: c })}
              style={{
                background: c,
                width: 20,
                height: 20,
                padding: 0,
                outline: line.color === c ? "2px solid #23201b" : "none",
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("field.noteVehicles")}</label>
        <textarea
          rows={2}
          value={line.note ?? ""}
          onChange={(e) => updateLine(id, { note: e.target.value })}
        />
      </div>

      <div className="field">
        <label>
          {t("stops.label", {
            n: line.stops.filter((s) => nodeKind(s) !== "via").length,
          })}
        </label>
        {line.stops.map((sid, i) => {
          const via = nodeKind(sid) === "via";
          return (
            <div className="stop-row" key={i}>
              <span className="muted">{via ? "·" : `${i + 1}.`}</span>
              <span
                className="stop-name"
                style={via ? { fontStyle: "italic", opacity: 0.7 } : undefined}
              >
                {via ? t("stop.waypoint") : nodeName(sid)}
              </span>
              <button
                className="mini"
                disabled={i === 0}
                onClick={() => reorderStop(id, i, i - 1)}
              >
                ↑
              </button>
              <button
                className="mini"
                disabled={i === line.stops.length - 1}
                onClick={() => reorderStop(id, i, i + 1)}
              >
                ↓
              </button>
              <button className="mini danger" onClick={() => removeStop(id, i)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        {t("linePanel.hint")}
        {overrideCount > 0 && (
          <>
            {" "}
            <button
              className="mini"
              onClick={() => clearStopOverrides(id)}
              style={{ marginTop: 4 }}
            >
              {t("resetOverrides", {
                n: overrideCount,
                s: overrideCount > 1 ? "e" : "",
              })}
            </button>
          </>
        )}
      </p>

      {drawing ? (
        <button className="active" onClick={() => finishLine()}>
          {t("btn.finishStops")}
        </button>
      ) : (
        <button onClick={() => editLineStops(id)}>{t("btn.editStops")}</button>
      )}
      <div style={{ height: 8 }} />
      <button className="danger" onClick={() => deleteLine(id)}>
        {t("btn.deleteLine")}
      </button>
    </div>
  );
}

function CorridorPanel({ id }: { id: string }) {
  const corridor = useStore((s) =>
    s.project.corridors?.find((c) => c.id === id)
  );
  const updateCorridor = useStore((s) => s.updateCorridor);
  const deleteCorridor = useStore((s) => s.deleteCorridor);
  const editCorridorPoints = useStore((s) => s.editCorridorPoints);
  const finishCorridor = useStore((s) => s.finishCorridor);
  const drawingCorridorId = useStore((s) => s.drawingCorridorId);
  const t = useT();
  const lang = useUi((s) => s.lang);
  if (!corridor) return null;
  const drawing = drawingCorridorId === id;

  return (
    <div>
      <div className="field">
        <label>{t("field.name")}</label>
        <input
          value={corridor.name ?? ""}
          placeholder={corridorLabel(lang, corridor.kind)}
          onChange={(e) => updateCorridor(id, { name: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{t("field.type")}</label>
        <select
          value={corridor.kind}
          onChange={(e) =>
            updateCorridor(id, { kind: e.target.value as CorridorKind })
          }
        >
          {CORRIDOR_KEYS.map((k) => (
            <option key={k} value={k}>
              {corridorLabel(lang, k)}
            </option>
          ))}
        </select>
      </div>
      {corridor.kind === "road" && (
        <div className="field">
          <label>{t("field.lanes")}</label>
          <select
            value={corridor.lanes ?? 2}
            onChange={(e) =>
              updateCorridor(id, { lanes: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
      {corridor.kind === "rail" && (
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={!!corridor.electrified}
              onChange={(e) =>
                updateCorridor(id, { electrified: e.target.checked })
              }
            />
            {t("corridor.electrified")}
          </label>
        </div>
      )}
      <div className="field">
        <label>{t("field.note")}</label>
        <textarea
          rows={2}
          value={corridor.note ?? ""}
          onChange={(e) => updateCorridor(id, { note: e.target.value })}
        />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        {t("corridor.pointsHint", { n: corridor.points.length })}
      </p>
      {drawing ? (
        <button className="active" onClick={() => finishCorridor()}>
          {t("btn.finishDraw")}
        </button>
      ) : (
        <button onClick={() => editCorridorPoints(id)}>
          {t("btn.appendPoints")}
        </button>
      )}
      <div style={{ height: 8 }} />
      <button className="danger" onClick={() => deleteCorridor(id)}>
        {t("btn.deleteCorridor")}
      </button>
    </div>
  );
}
