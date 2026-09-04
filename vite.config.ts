import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build` bundles everything into a single self-contained dist/index.html
// that also runs standalone (double-click / file://), no server needed.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
