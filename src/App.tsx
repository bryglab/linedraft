import { useRef } from "react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { Legend } from "./components/Legend";
import { useStore } from "./store";
import { useT } from "./i18n";

export function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const tool = useStore((s) => s.tool);
  const drawingLineId = useStore((s) => s.drawingLineId);
  const drawingCorridorId = useStore((s) => s.drawingCorridorId);
  const t = useT();

  const hint =
    tool === "addCity"
      ? t("hint.addCity")
      : tool === "addIndustry"
      ? t("hint.addIndustry")
      : tool === "addWarehouse"
      ? t("hint.addWarehouse")
      : drawingCorridorId
      ? t("hint.drawCorridor")
      : drawingLineId
      ? t("hint.drawLine")
      : null;

  return (
    <div className="app">
      <Toolbar svgRef={svgRef} />
      <div className="main">
        <div className="canvas-wrap">
          <Canvas svgRef={svgRef} />
          {hint && <div className="hint">{hint}</div>}
          <Legend />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
