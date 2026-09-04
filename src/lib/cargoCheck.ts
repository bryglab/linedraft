import {
  CARGO_CATEGORY_ENABLED,
  type CargoCategory,
  type DesignNode,
  type Project,
} from "../types";
import { cargoLabel, tl, type Lang } from "../i18n";

export interface LineCheck {
  lineId: string;
  name: string;
  ok: boolean;
  issues: string[];
}

export interface CargoReport {
  lines: LineCheck[];
  /** producers with no cargo line taking their output away */
  danglingProducers: string[];
  /** consumers with no cargo line bringing their input */
  danglingConsumers: string[];
  hasCargo: boolean;
}

/** category matches, or category tracking is turned off */
const catMatch = (nodeCat: CargoCategory | undefined, cat?: CargoCategory) =>
  !CARGO_CATEGORY_ENABLED || !cat || nodeCat === cat;

function producesFor(node: DesignNode | undefined, cat?: CargoCategory): boolean {
  if (!node) return false;
  if (node.kind === "warehouse") return catMatch(node.cargoCategory, cat);
  if (node.kind === "industry")
    return (
      (node.role === "source" || node.role === "both") &&
      catMatch(node.cargoCategory, cat)
    );
  return false;
}

function consumesFor(node: DesignNode | undefined, cat?: CargoCategory): boolean {
  if (!node) return false;
  if (node.kind === "city") return true; // towns are final demand for anything
  if (node.kind === "warehouse") return catMatch(node.cargoCategory, cat);
  if (node.kind === "industry")
    return (
      (node.role === "sink" || node.role === "both") &&
      catMatch(node.cargoCategory, cat)
    );
  return false;
}

export function checkCargo(project: Project, lang: Lang): CargoReport {
  const nodeById = new Map(project.nodes.map((n) => [n.id, n] as const));
  const cargoLines = project.lines.filter((l) => l.kind === "cargo");

  const lines: LineCheck[] = cargoLines.map((line) => {
    const issues: string[] = [];
    const cat = CARGO_CATEGORY_ENABLED ? line.cargoCategory : undefined;
    if (CARGO_CATEGORY_ENABLED && !line.cargoCategory)
      issues.push(tl(lang, "cc.noCategory"));
    if (line.stops.length < 2) issues.push(tl(lang, "cc.fewStops"));

    if (line.stops.length >= 2 && (!CARGO_CATEGORY_ENABLED || cat)) {
      const a = nodeById.get(line.stops[0]);
      const b = nodeById.get(line.stops[line.stops.length - 1]);
      const what = cat
        ? cargoLabel(lang, cat).split(" ")[0]
        : tl(lang, "cc.freight");
      if (!producesFor(a, cat))
        issues.push(
          tl(lang, "cc.originNo", { name: a?.name ?? "?", what })
        );
      if (!consumesFor(b, cat))
        issues.push(tl(lang, "cc.destNo", { name: b?.name ?? "?", what }));
    }

    return { lineId: line.id, name: line.name, ok: issues.length === 0, issues };
  });

  const servesNode = (
    nodeId: string,
    cat: CargoCategory | undefined,
    asProducer: boolean
  ): boolean =>
    cargoLines.some((l) => {
      if (CARGO_CATEGORY_ENABLED && cat && l.cargoCategory !== cat) return false;
      const i = l.stops.indexOf(nodeId);
      if (i < 0) return false;
      return asProducer ? i < l.stops.length - 1 : i > 0;
    });

  const danglingProducers: string[] = [];
  const danglingConsumers: string[] = [];
  for (const n of project.nodes) {
    if (n.kind !== "industry") continue;
    if (CARGO_CATEGORY_ENABLED && !n.cargoCategory) continue;
    const cat = CARGO_CATEGORY_ENABLED ? n.cargoCategory : undefined;
    if (
      (n.role === "source" || n.role === "both") &&
      !servesNode(n.id, cat, true)
    ) {
      danglingProducers.push(n.name);
    }
    if (
      (n.role === "sink" || n.role === "both") &&
      !servesNode(n.id, cat, false)
    ) {
      danglingConsumers.push(n.name);
    }
  }

  return {
    lines,
    danglingProducers,
    danglingConsumers,
    hasCargo:
      cargoLines.length > 0 ||
      project.nodes.some((n) => n.kind === "industry" || n.kind === "warehouse"),
  };
}
