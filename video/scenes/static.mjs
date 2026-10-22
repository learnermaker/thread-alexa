// Scenes built from local HTML pages (video/pages): title cards, terminal replays of real captured output,
// the code tour (excerpts read from the repo files themselves) and the architecture / honesty views.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startRecorder } from "../lib/recorder.mjs";
import { director } from "../lib/director.mjs";

const pages = fileURLToPath(new URL("../pages/", import.meta.url));
const repo = fileURLToPath(new URL("../../", import.meta.url));
const proofs = () => JSON.parse(readFileSync(fileURLToPath(new URL("../out/proofs.json", import.meta.url)), "utf8"));

async function open(browser, name, args, scene) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(`${pages}${name}.html`).href);
  await page.waitForTimeout(400);
  const rec = await startRecorder(page);
  const d = director({ rec, durations: args.durations, texts: args.texts, scene, outDir: args.outDir });
  const finish = async () => {
    await d.hold(0.4);
    const stats = await rec.stop(`${args.outDir}${scene}.mp4`, args.workDir);
    d.save(stats.seconds);
    await ctx.close();
    return stats;
  };
  return { page, d, finish, dur: (id) => args.durations[id] };
}

export async function recordHook(args) {
  const { page, d, finish, dur } = await open(args.browser, "hook", args, "hook");
  await d.hold(0.4);
  await d.seg("hook1", () => page.evaluate(() => window.step(1)), { tail: 0.5 });
  await d.seg("hook2", async () => {
    await page.evaluate(() => window.step(2));
    await d.hold(dur("hook2") * 0.52);
    await page.evaluate(() => window.step(3));
  }, { tail: 1.0 });
  return finish();
}

const CMD = "npx @modelcontextprotocol/inspector --cli http://localhost:8787/mcp --transport http --header \"Authorization: Bearer dev-maya\"";

export async function recordBoot(args) {
  const p = proofs();
  const { page, d, finish } = await open(args.browser, "terminal", args, "boot");
  await page.evaluate(() => window.T.setChip("One command", "npm install && npm run demo"));
  await d.hold(0.6);
  await d.seg("boot1", async () => {
    await page.evaluate(() => window.T.type("npm install && npm run demo", 38));
    await page.evaluate((l) => window.T.out(l, { gap: 150 }), p.boot.npm);
    await page.evaluate((l) => window.T.out(l, { gap: 0 }), ["", ...p.boot.server]);
    await d.hold(0.5);
    await page.evaluate(() => { window.T.blank(); window.T.ok("Open http://localhost:8787 and press Play the story"); });
  }, { tail: 1.2 });
  return finish();
}

export async function recordInspector(args) {
  const p = proofs();
  const { page, d, finish } = await open(args.browser, "terminal", args, "inspector");
  await page.evaluate((v) => window.T.setChip(`MCP Inspector CLI ${v}`, "Recorded run against the local server · output is real"), p.inspector);
  await d.hold(0.6);
  const type = (c) => page.evaluate(([x]) => window.T.type(x, 200), [c]);
  await d.seg("ins1", async () => { await type(`${CMD} --method initialize`); }, { tail: 0.3 });
  await d.seg("ins2", async () => {
    await page.evaluate((l) => window.T.out(l, { json: true, gap: 40 }), p.initialize.lines);
    await d.hold(0.4);
    await page.evaluate(() => window.T.mark("2025-11-25"));
  }, { tail: 1.6 });
  await d.seg("ins3", async () => {
    await page.evaluate(() => window.T.clear());
    await type(`${CMD} --method tools/list | node -p "r=JSON.parse(require('fs').readFileSync(0,'utf8')).result.tools;r.length+' tools: '+r.map(t=>t.name).join(', ')"`);
    await page.evaluate((t) => window.T.out([`${t.length} tools: ${t.join(", ")}`], { gap: 0 }), p.list.names);
    await d.hold(0.4);
    await page.evaluate((n) => window.T.mark(`${n} tools`), p.list.count);
  }, { tail: 1.8 });
  await d.seg("ins4", async () => {
    await page.evaluate(() => window.T.clear());
    await type(`${CMD} --method tools/call --tool-name report_change --tool-args-json '${p.call.args}'`);
    const head = p.call.lines.slice(0, 11);
    await page.evaluate((l) => window.T.out(l, { json: true, gap: 60 }), head);
    await page.evaluate((b) => window.T.dim(`  ... (${b} lines of structuredContent: threads, severities, proposals) ...`), p.call.lines.length - 11);
    await d.hold(0.4);
    await page.evaluate(() => window.T.mark("This affects Leo's Saturday Tournament and Rosa's prescription refill. Family dinner is fine. Best option: Sam."));
  }, { tail: 2.4 });
  return finish();
}

export async function recordAuth(args) {
  const p = proofs();
  const { page, d, finish } = await open(args.browser, "terminal", args, "auth");
  await page.evaluate(() => window.T.setChip("OAuth and identity checks", "Recorded run · no token or secret is printed"));
  await d.hold(0.6);
  await d.seg("auth1", async () => {
    await page.evaluate(() => window.T.type("node video/proof-auth.mjs", 40));
    for (const l of p.auth.lines) {
      await page.evaluate((x) => window.T.out([x], { gap: 0 }), l);
      await d.hold(0.85);
    }
    await page.evaluate(() => {
      for (const m of ["401", "400", "403 insufficient_scope", "Only Sam can answer this handoff."]) window.T.mark(m);
    });
  }, { tail: 2.0 });
  return finish();
}

const lines = (file) => readFileSync(`${repo}${file}`, "utf8").split(/\r?\n/);
// excerpt of `file` from the first line matching `startRe` (or an absolute line number) for `count` lines
function excerpt(file, start, count, hlRes = []) {
  const all = lines(file);
  const from = typeof start === "number" ? start : all.findIndex((l) => start.test(l)) + 1;
  if (from < 1) throw new Error(`excerpt: ${start} not found in ${file}`);
  const slice = all.slice(from - 1, from - 1 + count);
  const hl = slice.map((l, i) => (hlRes.some((re) => re.test(l)) ? from + i : 0)).filter(Boolean);
  return { file, from, lines: slice, hl };
}
export const codeBlocks = {
  code1: ["Official MCP SDK, Streamable HTTP transport", [
    excerpt("server/mcp/server.ts", /^import \{ McpServer/, 4, [/McpServer/, /ext-apps/]),
    excerpt("server/app.ts", /^import \{ WebStandardStreamableHTTPServerTransport/, 3, [/Streamable/]),
    excerpt("server/app.ts", /const server = buildMcpServer/, 4, [/Streamable/, /handleRequest/]),
  ]],
  code2: ["Tool schemas come straight from thread-core's operations", [
    excerpt("server/mcp/server.ts", /for \(const t of TOOLS\)/, 17, [/operations\[/, /inputSchema/, /outputSchema/, /deps\.core\[t\.op\]/]),
  ]],
  code3: ["The simulator's own MCP client", [
    excerpt("web/sim/src/mcp.ts", /^export async function mcpCall/, 10, [/\/mcp/, /Bearer/, /jsonrpc/]),
    excerpt("web/sim/src/mcp.ts", /^export async function mcpHandshake/, 6, [/2025-11-25/]),
  ]],
  cdk: ["infra/stack.ts: Lambda Function URL, DynamoDB, Bedrock access. Synthesized, not deployed.", [
    excerpt("infra/stack.ts", /new dynamodb\.Table/, 5, [/dynamodb\.Table/, /tableName/]),
    excerpt("infra/stack.ts", /new NodejsFunction/, 5, [/NodejsFunction/, /NODEJS_24_X/]),
    excerpt("infra/stack.ts", /Function URL \(auth NONE/, 5, [/addFunctionUrl/, /grantReadWriteData/]),
  ]],
  code4: ["The Agent Skill: when to call each tool", [
    excerpt("skills/thread/SKILL.md", /^## When to use THREAD/, 9, [/`list_threads`/, /`report_change`/, /`request_handoff`/]),
  ]],
};

export async function recordCode(args) {
  const { page, d, finish } = await open(args.browser, "code", args, "code");
  await page.evaluate(() => window.C.setChip("Code tour · all in the repo"));
  await d.hold(0.5);
  for (const id of ["code1", "code2", "code3", "code4"]) {
    const [note, blocks] = codeBlocks[id];
    await d.seg(id, () => page.evaluate(([n, b]) => window.C.show(n, b), [note, blocks]), { tail: 1.7 });
  }
  return finish();
}

export async function recordArch(args) {
  const { page, d, finish } = await open(args.browser, "arch", args, "arch");
  await page.evaluate(() => { window.A.view("diagram"); window.A.step(1); });
  await d.hold(0.4);
  await d.seg("arch1", () => d.hold(0.2), { tail: 2.2 });
  return finish();
}

export async function recordCdk(args) {
  const { page, d, finish } = await open(args.browser, "code", args, "cdk");
  await page.evaluate(() => window.C.setChip("AWS CDK stack · synthesized, not deployed"));
  await d.hold(0.4);
  await d.seg("arch2", () => page.evaluate(([n, b]) => window.C.show(n, b), codeBlocks.cdk), { tail: 1.8 });
  return finish();
}

export async function recordHonest(args) {
  const { page, d, finish, dur } = await open(args.browser, "arch", args, "honest");
  await page.evaluate(() => window.A.view("table"));
  await d.seg("arch3", async () => {
    for (let i = 1; i <= 7; i++) { await page.evaluate((n) => window.A.rows(n), i); await d.hold((dur("arch3") - 0.8) / 7); }
  }, { tail: 1.4 });
  await d.seg("arch4", () => page.evaluate(() => window.A.view("core")), { tail: 1.4 });
  return finish();
}

export async function recordClose(args) {
  const { page, d, finish, dur } = await open(args.browser, "close", args, "close");
  await d.hold(0.4);
  await d.seg("close1", async () => {
    await page.evaluate(() => window.step(1));
    await d.hold(dur("close1") * 0.6);
    await page.evaluate(() => window.step(2));
  }, { tail: 0.8 });
  await d.seg("close2", () => page.evaluate(() => window.step(3)), { tail: 1.8 });
  return finish();
}
