import { useRef } from "react";
import { useStore } from "../store";
import { CORRIDORS_ENABLED, KOFI_USERNAME, WAREHOUSES_ENABLED } from "../types";
import { useT, useUi } from "../i18n";
import { downloadProject, readProjectFile, exportSvgToPng } from "../lib/io";

interface Props {
  svgRef: React.RefObject<SVGSVGElement>;
}

export function Toolbar({ svgRef }: Props) {
  const project = useStore((s) => s.project);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const startLine = useStore((s) => s.startLine);
  const startCorridor = useStore((s) => s.startCorridor);
  const setProjectName = useStore((s) => s.setProjectName);
  const loadProject = useStore((s) => s.loadProject);
  const newProject = useStore((s) => s.newProject);
  const resetToSample = useStore((s) => s.resetToSample);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);

  return (
    <div className="toolbar">
      <input
        className="title-input"
        value={project.name}
        onChange={(e) => setProjectName(e.target.value)}
        aria-label={t("app.projectName")}
      />
      <span className="sep" />
      <button
        className={tool === "select" ? "active" : ""}
        onClick={() => setTool("select")}
        title={t("tool.select.title")}
      >
        {t("tool.select")}
      </button>
      <button
        className={tool === "addCity" ? "active" : ""}
        onClick={() => setTool("addCity")}
      >
        {t("tool.addCity")}
      </button>
      <button
        className={tool === "addIndustry" ? "active" : ""}
        onClick={() => setTool("addIndustry")}
      >
        {t("tool.addIndustry")}
      </button>
      {WAREHOUSES_ENABLED && (
        <button
          className={tool === "addWarehouse" ? "active" : ""}
          onClick={() => setTool("addWarehouse")}
          title={t("tool.addWarehouse.title")}
        >
          {t("tool.addWarehouse")}
        </button>
      )}
      <button
        className={tool === "drawLine" ? "active" : ""}
        onClick={() => startLine()}
        title={t("tool.drawLine.title")}
      >
        {t("tool.drawLine")}
      </button>
      {CORRIDORS_ENABLED && (
        <button
          className={tool === "drawCorridor" ? "active" : ""}
          onClick={() => startCorridor()}
          title={t("tool.drawCorridor.title")}
        >
          {t("tool.drawCorridor")}
        </button>
      )}

      <span className="grow" />

      <button onClick={() => downloadProject(project)}>{t("btn.save")}</button>
      <button onClick={() => fileRef.current?.click()}>{t("btn.load")}</button>
      <button
        onClick={() => svgRef.current && exportSvgToPng(svgRef.current, project.name)}
      >
        {t("btn.png")}
      </button>
      <span className="sep" />
      <button onClick={() => confirm(t("confirm.new")) && newProject()}>
        {t("btn.new")}
      </button>
      <button
        onClick={() => confirm(t("confirm.example")) && resetToSample()}
      >
        {t("btn.example")}
      </button>
      <span className="sep" />
      <button
        onClick={() => setLang(lang === "en" ? "de" : "en")}
        title="English / Deutsch"
      >
        {lang === "en" ? "DE" : "EN"}
      </button>
      {KOFI_USERNAME && (
        <>
          <span className="sep" />
          <a
            className="kofi-link"
            href={`https://ko-fi.com/${KOFI_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            title={t("support.kofi.title")}
          >
            {t("support.kofi")}
          </a>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            loadProject(await readProjectFile(f));
          } catch (err) {
            alert(t("err.load") + (err as Error).message);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
