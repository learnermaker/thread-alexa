import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL("../dist-lens", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
  },
});
