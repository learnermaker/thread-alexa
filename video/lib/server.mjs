// Start / stop a fresh local THREAD demo server (the same `server/local.ts` that `npm run demo` runs).
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));

export async function startServer({ port = 8787, dataDir = ".data-video-final" } = {}) {
  rmSync(`${repo}${dataDir}`, { recursive: true, force: true });
  const base = `http://localhost:${port}`;
  const log = [];
  const child = spawn(process.execPath, ["server/local.ts"], { cwd: repo, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, LIVE_AGENT: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => log.push(String(d)));
  child.stderr.on("data", (d) => log.push(String(d)));
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
    if (i === 79) throw new Error(`server did not start:\n${log.join("")}`);
  }
  return {
    base,
    log: () => log.join(""),
    async stop() {
      child.kill();
      await new Promise((r) => setTimeout(r, 500));
      rmSync(`${repo}${dataDir}`, { recursive: true, force: true });
    },
  };
}
