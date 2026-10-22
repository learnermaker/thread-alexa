// Writes narration.md and shotlist.md from the recorded timeline (video/out/timeline.json), so the timestamps
// are the real ones. Usage: node video/docs.mjs <output dir>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const outDir = fileURLToPath(new URL("./out/", import.meta.url));
const dest = resolve(process.argv[2] ?? ".");
const { total, timeline } = JSON.parse(readFileSync(`${outDir}timeline.json`, "utf8"));
const t = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}.${Math.floor((sec % 1) * 10)}`;

// What each scene shows and where it comes from.
const SHOT = {
  hook: ["Animated title card: one change ripples into three commitments (ride, refill, dinner).", "video/pages/hook.html"],
  boot: ["Terminal: npm install && npm run demo, with the server's real start-up line.", "video/proofs.mjs (captured output), video/pages/terminal.html"],
  sim: ["The simulator in a browser: Echo Show (Maya) and Sam's phone, the Thread Lens card, the live last-MCP-call strip, and the Under the hood wire log opened on two beats (report_change as maya, respond_to_handoff as sam with an OAuth token). Camera zooms on the Lens and the wire log.", "npm run demo, then web/sim (video/scenes/sim.mjs drives it)"],
  inspector: ["Terminal: MCP Inspector CLI 2.10.1 against the local server: initialize (protocol 2025-11-25), tools/list (8 tools), tools/call report_change.", "video/proofs.mjs runs the real commands; video/scenes/static.mjs replays the captured output"],
  auth: ["Terminal: OAuth and identity checks: no token 401, token in query 400, service token lists tools but is refused on tools/call (403), Maya cannot answer Sam's handoff.", "node video/proof-auth.mjs"],
  code: ["Code tour, syntax-highlighted excerpts read from the repo: MCP SDK + Streamable HTTP transport, schemas from thread-core operations, the simulator's MCP client, the Agent Skill.", "server/mcp/server.ts, server/app.ts, web/sim/src/mcp.ts, skills/thread/SKILL.md"],
  arch: ["Architecture diagram: simulator, MCP server, thread-core, simulated connectors, MCP App, Agent Skill, optional live agent.", "video/pages/arch.html"],
  cdk: ["The AWS CDK stack source (DynamoDB table, Lambda, Function URL), captioned synthesized, not deployed.", "infra/stack.ts (npm run synth passes offline)"],
  honest: ["Real versus simulated table (matches the README), then the open-source thread-core card.", "video/pages/arch.html"],
  close: ["Closing card: Don't lose the thread, the two repo links, Built with Kiro.", "video/pages/close.html"],
};

const narration = [
  "# Narration script",
  "",
  `Total runtime ${t(total)}. Times are where each line starts in the final video. The captions (thread-final.srt) match this text exactly.`,
  "",
  "To use your own voice, record each line and drop it in at its timestamp (or replace the audio track with one read straight through at the same pace). The captions-only cut needs no voice.",
  "",
  "| Time | Scene | Line |", "|---|---|---|",
  ...timeline.flatMap((s) => s.marks.map((k) => `| ${t(k.gStart)} | ${s.title} | ${k.text} |`)),
  "",
];
writeFileSync(`${dest}/narration.md`, narration.join("\n"));

const shots = [
  "# Shot list", "", `Total runtime ${t(total)}. 1920x1080, 30 fps, captions burned in.`, "",
  "| # | Start | Length | On screen | Source |", "|---|---|---|---|---|",
  ...timeline.map((s, i) => `| ${i + 1} | ${t(s.start)} | ${s.seconds.toFixed(1)} s | **${s.title}.** ${SHOT[s.scene][0]} | ${SHOT[s.scene][1]} |`),
  "",
];
writeFileSync(`${dest}/shotlist.md`, shots.join("\n"));
console.log(`docs: narration.md and shotlist.md in ${dest}`);
