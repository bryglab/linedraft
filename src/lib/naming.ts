import type { Line, Project } from "../types";
import { modePrefix, tl, type Lang } from "../i18n";

function prefixOf(line: Line, lang: Lang): string {
  return line.kind === "cargo"
    ? tl(lang, "prefix.cargo")
    : modePrefix(lang, line.mode);
}

/**
 * Auto line name in the TF3 style: "<Prefix> <Nr>  <Start> – <Ziel>".
 * The number is the line's position among lines sharing the same prefix.
 */
export function autoLineName(line: Line, project: Project, lang: Lang): string {
  const prefix = prefixOf(line, lang);
  const nodeName = (id: string) =>
    project.nodes.find((n) => n.id === id)?.name ?? "?";

  let n = 0;
  for (const l of project.lines) {
    if (prefixOf(l, lang) === prefix) n++;
    if (l.id === line.id) break;
  }

  const first = line.stops[0] ? nodeName(line.stops[0]) : null;
  const last =
    line.stops.length > 1 ? nodeName(line.stops[line.stops.length - 1]) : null;

  const route = first && last ? `  ${first} – ${last}` : first ? `  ${first}` : "";
  return `${prefix} ${n || 1}${route}`;
}
