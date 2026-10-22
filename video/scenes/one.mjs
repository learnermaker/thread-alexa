// Dry-run helper: record scenes on their own. node video/scenes/one.mjs <scene[,scene...]> [durations.json]
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scenes } from "../narration.mjs";
import { startServer } from "../lib/server.mjs";
import { recorders } from "./index.mjs";

const [, , ids = "sim", durFile = "video/out/tts/durations.json"] = process.argv;
const outDir = fileURLToPath(new URL("../out/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const durations = JSON.parse(readFileSync(durFile, "utf8"));
const texts = Object.fromEntries(scenes.flatMap((s) => s.segs).map((g) => [g.id, g.text]));
const wanted = ids.split(",");
const server = wanted.includes("sim") ? await startServer({ port: 8787, dataDir: ".data-video-one" }) : undefined;
const browser = await chromium.launch();
try {
  for (const id of wanted) {
    const stats = await recorders[id]({ browser, base: server?.base, durations, texts, outDir, workDir: `${outDir}frames-${id}/` });
    console.log(id, stats);
  }
} finally { await browser.close(); await server?.stop(); }
