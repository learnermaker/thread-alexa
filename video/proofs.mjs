// Runs the real proof commands against a fresh local server and saves what they printed (video/out/proofs.json).
// The terminal scenes replay this captured output; nothing in it is typed by hand.
//   - npm install / npm run demo start-up line
//   - MCP Inspector CLI: initialize, tools/list, tools/call (the same tool the simulator uses)
//   - video/proof-auth.mjs: OAuth and identity checks
// The Inspector is installed once into ../tools (outside the repo), like docs/evidence/inspector's run script.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { startServer } from "./lib/server.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const outDir = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const VERSION = "2.10.1";
const tools = resolve(repo, process.env.INSPECTOR_TOOLS ?? "../tools");
const bin = join(tools, "node_modules", "@modelcontextprotocol", "inspector", "clients", "launcher", "build", "index.js");
if (!existsSync(bin)) {
  mkdirSync(tools, { recursive: true });
  const r = spawnSync(`npm install --no-audit --no-fund --prefix "${tools}" @modelcontextprotocol/inspector@${VERSION}`, { stdio: "inherit", shell: true });
  if (r.status !== 0 || !existsSync(bin)) throw new Error("could not install MCP Inspector");
}

const npm = spawnSync("npm install --no-audit --no-fund", { cwd: repo, shell: true, encoding: "utf8" });
const npmLines = `${npm.stdout}${npm.stderr}`.split("\n").map((l) => l.trim()).filter((l) => l && !/^npm (warn|notice)/i.test(l));

const server = await startServer({ port: 8787, dataDir: ".data-video-proof" });
try {
  const url = `${server.base}/mcp`;
  const inspect = (method, extra = []) => {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, [bin, "--cli", url, "--transport", "http", "--header", "Authorization: Bearer dev-maya", "--method", method, ...extra, "--format", "json", "-q"], { encoding: "utf8", timeout: 120_000 });
    return { exit: r.status, ms: Math.round(performance.now() - t0), json: JSON.parse(r.stdout) };
  };
  const pretty = (j) => JSON.stringify(j, null, 2).split("\n");

  const init = inspect("initialize");
  const list = inspect("tools/list");
  const ripple = { change: { type: "PERSON_UNAVAILABLE", person: "maya", start: "2026-10-10T07:00:00-07:00", end: "2026-10-10T13:00:00-07:00" } };
  const call = inspect("tools/call", ["--tool-name", "report_change", "--tool-args-json", JSON.stringify(ripple)]);
  const auth = spawnSync(process.execPath, ["video/proof-auth.mjs", server.base], { cwd: repo, encoding: "utf8" });

  const names = (list.json.result?.tools ?? list.json.tools).map((t) => t.name);
  const out = {
    boot: { npm: npmLines.slice(-3), server: server.log().split("\n").filter(Boolean) },
    url,
    initialize: { exit: init.exit, ms: init.ms, lines: pretty(init.json) },
    list: { exit: list.exit, ms: list.ms, bytes: JSON.stringify(list.json).length, head: pretty(list.json).slice(0, 9), count: names.length, names },
    call: { exit: call.exit, ms: call.ms, args: JSON.stringify(ripple), lines: pretty(call.json) },
    auth: { exit: auth.status, lines: auth.stdout.split("\n").filter(Boolean) },
    inspector: VERSION,
  };
  writeFileSync(`${outDir}proofs.json`, JSON.stringify(out, null, 2));
  console.log(`PROOFS: initialize exit=${init.exit}, tools/list ${names.length} tools exit=${list.exit}, tools/call exit=${call.exit}, auth ${out.auth.lines.length} lines -> video/out/proofs.json`);
} finally {
  await server.stop();
}
