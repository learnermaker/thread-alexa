// The golden ripple story replayed over REAL MCP (Streamable HTTP, SDK client, per-person bearer tokens).
// System steps (signals, ticks, inbox) call the shared core directly, as the watcher does in production.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TOOLS } from "../mcp/tools.ts";
import { startServer, type TestServer } from "./harness.ts";

const story = JSON.parse(
  readFileSync(new URL("../../fixtures/golden/ripple-story.json", import.meta.url), "utf8"),
);
const toolFor = (op: string) => TOOLS.find((t) => t.op === op)?.name;

const calls: Array<{ tool: string; ms: number; ok: boolean; code?: string }> = [];
let s: TestServer;

beforeAll(async () => {
  s = await startServer(calls);
});
afterAll(async () => {
  await s.close();
});

describe("golden story over MCP", () => {
  test("all steps", async () => {
    for (const step of story.steps) {
      s.clock.set(step.at);
      const tool = toolFor(step.op);
      if (!tool) {
        const p =
          step.as === "system"
            ? { kind: "system", household_id: "hh_rivera" }
            : { kind: "person", household_id: "hh_rivera", person_id: step.as };
        const r = await (s.core as any)[step.op](p, step.input);
        expect(r, step.id).toMatchObject(step.expect);
        continue;
      }
      const r: any = await (await s.client(step.as)).callTool({ name: tool, arguments: step.input });
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
    const { tools } = await (await s.client("maya")).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    for (const t of tools) {
      expect((t.inputSchema as any).additionalProperties, t.name).toBe(false);
      expect(t.outputSchema, t.name).toBeTruthy();
      expect((t._meta as any)?.ui?.resourceUri, t.name).toBe("ui://thread/lens");
    }
  });

  test("401 without WWW-Authenticate; token in query rejected", async () => {
    const res = await fetch(`${s.base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBeNull();
    const q = await fetch(`${s.base}/mcp?access_token=x`, { method: "POST", body: "{}" });
    expect(q.status).toBe(400);
  });

  test("latency: p95 MCP call under 500 ms locally", () => {
    expect(calls.length).toBeGreaterThan(5);
    // Drop the first call as warm-up (cold SDK/transport paths), then p95 over the rest.
    const samples = calls.slice(1).map((c) => c.ms).sort((a, b) => a - b);
    const p95 = samples[Math.max(0, Math.ceil(0.95 * samples.length) - 1)]!;
    expect(p95).toBeLessThan(500);
  });
});
