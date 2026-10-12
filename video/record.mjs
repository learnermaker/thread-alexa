// npm run video (step 1): record "Play the story" at 1920x1080 and emit beat timestamps.
// Boots the real demo server (FileStore, scripted agent) on a loopback port — same pattern as
// playwright.config.ts — drives the built simulator SPA, and watches the stage's data-lens-mode
// to timestamp each beat into video/out/beats.json. One gallery PNG per distinct Lens mode goes
// to docs/gallery/ (committed). Chromium comes from @playwright/test.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repo = new URL("../", import.meta.url);
const outDir = fileURLToPath(new URL("out/", import.meta.url));
const galleryDir = fileURLToPath(new URL("../docs/gallery/", import.meta.url));
mkdirSync(outDir, { recursive: true });
mkdirSync(galleryDir, { recursive: true });

const PORT = Number(process.env.VIDEO_PORT ?? "8810");
const BASE = `http://127.0.0.1:${PORT}`;
const story = JSON.parse(readFileSync(new URL("story/story.json", repo), "utf8"));

// Start the demo server as a child, fresh data dir, scripted agent (LIVE_AGENT off).
const server = spawn(process.execPath, ["server/local.ts"], {
  cwd: fileURLToPath(repo),
  env: { ...process.env, PORT: String(PORT), PUBLIC_BASE_URL: BASE, DATA_DIR: ".data-video", LIVE_AGENT: "", DEMO_MODE: "true" },
  stdio: "ignore",
});

const waitForHealth = async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`demo server did not become healthy at ${BASE}/health`);
};

let browser;
try {
  await waitForHealth();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${BASE}/`);
  await page.waitForSelector('[data-testid="play-story"]:not([disabled])');

  // Record every data-lens-mode transition (evidence each expected mode was actually shown).
  await page.evaluate(() => {
    const w = window;
    w.__beats = [];
    const stage = document.querySelector(".stage");
    const t0 = performance.now();
    const push = () => {
      const m = stage.getAttribute("data-lens-mode") ?? "";
      const last = w.__beats[w.__beats.length - 1];
      if (m && (!last || last.mode !== m)) w.__beats.push({ mode: m, t: (performance.now() - t0) / 1000 });
    };
    push();
    new MutationObserver(push).observe(stage, { attributes: true, attributeFilter: ["data-lens-mode"] });
  });

  const started = Date.now();
  await page.getByTestId("play-story").click();

  // Snapshot a gallery frame the first time each distinct mode appears, while the story plays.
  const captured = new Set();
  const grab = async () => {
    const mode = await page.evaluate(() => document.querySelector(".stage")?.getAttribute("data-lens-mode") ?? "");
    if (mode && !captured.has(mode)) {
      captured.add(mode);
      await page.screenshot({ path: `${galleryDir}${mode}.png` });
    }
  };
  // Poll for mode changes until Play re-enables (play finished), ~90s.
  while (true) {
    await grab();
    const enabled = await page.getByTestId("play-story").isEnabled();
    if (enabled && Date.now() - started > 3000) break;
    if (Date.now() - started > 150_000) throw new Error("play did not finish within 150s");
    await page.waitForTimeout(400);
  }
  await grab();

  const transitions = await page.evaluate(() => window.__beats);
  const totalSec = (Date.now() - started) / 1000;

  // The player paces beats on a FIXED interval (max(800, 90000/beats.length) ms each), so even
  // division reproduces its timeline deterministically. The recorded data-lens-mode transitions
  // are kept in beats.json only as evidence that each expected mode was actually shown.
  const beats = story.beats;
  const perBeat = totalSec / beats.length;
  const shown = new Set(transitions.map((t) => t.mode));
  const timed = beats.map((b, i) => ({
    id: b.id,
    mode: b.expected_lens_mode,
    start: Number((i * perBeat).toFixed(3)),
    shown: shown.has(b.expected_lens_mode),
    spoken_line: b.spoken_line ?? "",
  }));

  writeFileSync(`${outDir}beats.json`, JSON.stringify({ duration: Number(totalSec.toFixed(3)), beats: timed }, null, 2) + "\n");
  console.log(`RECORD: ${timed.length} beats over ${totalSec.toFixed(1)}s -> video/out/beats.json`);
  console.log(`GALLERY: ${captured.size} mode(s) -> docs/gallery/ (${[...captured].join(", ")})`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
