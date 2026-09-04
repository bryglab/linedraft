import { useStore, lineVisible } from "../store";
import { MODE_STYLE, CARGO_HATCH, type TransportMode } from "../types";
import { modeLabel, useT, useUi } from "../i18n";

function StyleSwatch({
  mode,
  cargo,
  color = "#23201b",
}: {
  mode: TransportMode;
  cargo?: boolean;
  color?: string;
}) {
  const st = MODE_STYLE[mode];
  return (
    <svg width="30" height="12" style={{ flex: "0 0 auto" }}>
      <line
        x1="1"
        y1="6"
        x2="29"
        y2="6"
        stroke={color}
        strokeWidth={Math.max(st.width - 0.5, 2)}
        strokeLinecap={st.cap}
        strokeDasharray={st.dash}
      />
      {cargo && (
        <line
          x1="1"
          y1="6"
          x2="29"
          y2="6"
          stroke="#f7f5f0"
          strokeWidth={CARGO_HATCH.width}
          strokeDasharray={CARGO_HATCH.dash}
        />
      )}
    </svg>
  );
}

export function Legend() {
  const project = useStore((s) => s.project);
  const t = useT();
  const lang = useUi((s) => s.lang);
  const visibleLines = project.lines.filter((l) => lineVisible(l, project.layers));
  if (visibleLines.length === 0 && project.nodes.length === 0) return null;

  const usedModes = [...new Set(visibleLines.map((l) => l.mode))];
  const hasCargo = visibleLines.some((l) => l.kind === "cargo");

  return (
    <div className="legend">
      <strong>{t("legend.title")}</strong>

      {usedModes.map((m) => (
        <div className="legend-row" key={m}>
          <StyleSwatch mode={m} />
          <span>{modeLabel(lang, m)}</span>
        </div>
      ))}
      {hasCargo && (
        <div className="legend-row">
          <StyleSwatch mode="rail" cargo />
          <span>{t("legend.cargo")}</span>
        </div>
      )}

      <div className="legend-row muted" style={{ marginTop: 4 }}>
        {t("legend.lines")}
      </div>
      {visibleLines.map((l) => (
        <div className="legend-row" key={l.id}>
          <StyleSwatch mode={l.mode} cargo={l.kind === "cargo"} color={l.color} />
          <span>{l.name}</span>
        </div>
      ))}
    </div>
  );
}
