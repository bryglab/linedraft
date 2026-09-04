import { useMemo } from "react";
import { useStore } from "../store";
import { checkCargo } from "../lib/cargoCheck";
import { useT, useUi } from "../i18n";

export function CargoChains() {
  const project = useStore((s) => s.project);
  const select = useStore((s) => s.select);
  const t = useT();
  const lang = useUi((s) => s.lang);
  const report = useMemo(() => checkCargo(project, lang), [project, lang]);

  if (!report.hasCargo) return null;

  const okCount = report.lines.filter((l) => l.ok).length;

  return (
    <>
      <h3>
        {t("h.cargoChains", { ok: okCount, n: report.lines.length })}
      </h3>

      {report.lines.length === 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          {t("cargoChains.empty")}
        </p>
      )}

      {report.lines.map((l) => (
        <div
          key={l.lineId}
          className="line-list-item"
          onClick={() => select({ kind: "line", id: l.lineId })}
          style={{ alignItems: "flex-start" }}
        >
          <span style={{ flex: "0 0 auto" }}>{l.ok ? "✅" : "⚠️"}</span>
          <span style={{ flex: 1 }}>
            {l.name}
            {l.issues.map((iss, k) => (
              <span
                key={k}
                className="muted"
                style={{ display: "block", fontSize: 11 }}
              >
                {iss}
              </span>
            ))}
          </span>
        </div>
      ))}

      {report.danglingProducers.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
          {t("cargoChains.danglingProducers", {
            names: report.danglingProducers.join(", "),
          })}
        </p>
      )}
      {report.danglingConsumers.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {t("cargoChains.danglingConsumers", {
            names: report.danglingConsumers.join(", "),
          })}
        </p>
      )}
    </>
  );
}
