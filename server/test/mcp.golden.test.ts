// The golden ripple story replayed over REAL MCP (Streamable HTTP, SDK client, per-person bearer tokens).
// System steps (signals, ticks, inbox) call the shared core directly, as the watcher does in production.
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createThreadApp, memoryStore } from "thread-core";
import { fakeCalendar, fakeServiceProvider, fixedClock } from "thread-core/testkit";
import { buildHttpApp } from "../app.ts";
import { devResolver } from "../auth/principal.ts";
import { TOOLS } from "../mcp/tools.ts";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../fixtures/golden/${f}`, import.meta.url), "utf8"));
const seed = read("rivera-seed.json");
const story = read("ripple-story.json");
const clock = fixedClock("2026-10-08T19:00:00-07:00");
const core = createThreadApp({
  store: memoryStore(), clock, calendar: fakeCalendar(),
  providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
});
const calls: Array<{ tool: string; ms: number }> = [];
const app = buildHttpApp({
  core, lensHtml: async () => "<!doctype html><title>Thread Lens</title>",
  resolvePrincipal: devResolver("hh_rivera", ["maya", "sam", "rosa"]), onCall: (e) => calls.push(e),
});
let server: ReturnType<typeof serve>;
let base = "";
const clients = new Map<string, Client>();
async function client(person: string) {
  if (!clients.has(person)) {
    const c = new Client({ name: "golden", version: "0" });
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer dev-${person}` } } }));
    clients.set(person, c);
  }
  return clients.get(person)!;
}
const toolFor = (op: string) => TOOLS.find((t) => t.op === op)?.name;

beforeAll(async () => {
  await core.initHousehold(seed);
  server = serve({ fetch: app.fetch, port: 0 });
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  for (const c of clients.values()) await c.close();
  server.close();
});

describe("golden story over MCP", () => {
  test("all steps", async () => {
    for (const step of story.steps) {
      clock.set(step.at);
      const tool = toolFor(step.op);
      if (!tool) {
        const p = step.as === "system" ? { kind: "system", household_id: "hh_rivera" } : { kind: "person", household_id: "hh_rivera", person_id: step.as };
        const r = await (core as any)[step.op](p, step.input);
        expect(r, step.id).toMatchObject(step.expect);
        continue;
      }
      const r: any = await (await client(step.as)).callTool({ name: tool, arguments: step.input });
      if (step.expect.ok) {
        expect(r.isError, step.id).toBeFalsy();
        expect(r.structuredContent, step.id).toMatchObject(step.expect.data);
        expect(r.content[0].text.length, step.id).toBeGreaterThan(0);
      } else {
        expect(r.isError, step.id).toBe(true);
        expect(JSON.parse(r.content[1].text).error.code, step.id).toBe(step.expect.error.code);
      }
    }
  });
  test("tools/list: exactly 8 tools, strict schemas, lens meta", async () => {
    const { tools } = await (await client("maya")).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    for (const t of tools) {
      expect((t.inputSchema as any).additionalProperties, t.name).toBe(false);
      expect(t.outputSchema, t.name).toBeTruthy();
      expect((t._meta as any)?.ui?.resourceUri, t.name).toBe("ui://thread/lens");
    }
  });
  test("401 without WWW-Authenticate; token in query rejected", async () => {
    const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBeNull();
    const q = await fetch(`${base}/mcp?access_token=x`, { method: "POST", body: "{}" });
    expect(q.status).toBe(400);
  });
  test("latency: every MCP call under 200 ms locally", () => {
    expect(calls.length).toBeGreaterThan(5);
    for (const c of calls) expect(c.ms, c.tool).toBeLessThan(200);
  });
});
