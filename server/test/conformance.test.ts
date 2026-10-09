// MCP conformance tests: protocol, tools, voice, errors, idempotency, auth.
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createThreadApp, memoryStore } from "thread-core";
import { fakeCalendar, fakeServiceProvider, fixedClock } from "thread-core/testkit";
import { buildHttpApp } from "../app.ts";
import { devResolver } from "../auth/principal.ts";
import { TOOLS } from "../mcp/tools.ts";
import { startServer, type TestServer } from "./harness.ts";

const seed = JSON.parse(
  readFileSync(new URL("../../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"),
);
const story = JSON.parse(
  readFileSync(new URL("../../fixtures/golden/ripple-story.json", import.meta.url), "utf8"),
);
const toolFor = (op: string) => TOOLS.find((t) => t.op === op)?.name;

// ── Task 2.1: Protocol and discovery ─────────────────────────────────────────
describe("protocol and discovery", () => {
  let s: TestServer;
  let transport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    s = await startServer();
    // Create transport directly to inspect protocolVersion after connect
    transport = new StreamableHTTPClientTransport(new URL(`${s.base}/mcp`), {
      requestInit: { headers: { Authorization: "Bearer dev-maya" } },
    });
    const c = new Client({ name: "conformance", version: "0" });
    await c.connect(transport);
    await c.close();
  });
  afterAll(() => s.close());

  test("negotiated protocol is 2025-11-25", () => {
    expect(transport.protocolVersion).toBe("2025-11-25");
  });

  test("tools/list: exactly 8 tools with required fields", async () => {
    const { tools } = await (await s.client("maya")).listTools();
    expect(tools).toHaveLength(8);
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    for (const t of tools) {
      const def = TOOLS.find((d) => d.name === t.name);
      if (!def) throw new Error(`unexpected tool ${t.name}`);
      expect(t.title, t.name).toBe(def.title);
      expect(t.description, t.name).toBe(def.description);
      expect((t.inputSchema as any).additionalProperties, t.name).toBe(false);
      expect(t.outputSchema, t.name).toBeTruthy();
      expect((t._meta as any)?.ui?.resourceUri, t.name).toBe("ui://thread/lens");
    }
  });

  test("annotations: readOnly for reads, non-destructive idempotent for mutations", async () => {
    const { tools } = await (await s.client("maya")).listTools();
    const readOnly = ["list_threads", "get_thread"];
    for (const t of tools.filter((t) => readOnly.includes(t.name))) {
      expect((t.annotations as any)?.readOnlyHint, t.name).toBe(true);
    }
    for (const t of tools.filter((t) => !readOnly.includes(t.name))) {
      expect((t.annotations as any)?.destructiveHint, t.name).toBe(false);
      expect((t.annotations as any)?.idempotentHint, t.name).toBe(true);
    }
  });

  test("resources/read lens returns HTML with profile=mcp-app MIME", async () => {
    const { contents } = await (await s.client("maya")).readResource({ uri: "ui://thread/lens" });
    expect(contents).toHaveLength(1);
    const first = contents[0];
    expect(first).toBeTruthy();
    expect(first!.mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(typeof (first as any).text).toBe("string");
  });
});

// ── Task 2.2 & 2.3: Voice summaries and error shape ──────────────────────────
// One server; replay the golden story; capture MCP results for listed steps.
describe("voice summaries and error shape", () => {
  let s: TestServer;
  const mcpResults = new Map<string, any>();

  beforeAll(async () => {
    s = await startServer();
    for (const step of story.steps) {
      s.clock.set(step.at);
      const tool = toolFor(step.op);
      if (!tool) {
        const p = step.as === "system"
          ? { kind: "system", household_id: "hh_rivera" }
          : { kind: "person", household_id: "hh_rivera", person_id: step.as };
        await (s.core as any)[step.op](p, step.input);
        continue;
      }
      const r = await (await s.client(step.as)).callTool({ name: tool, arguments: step.input });
      mcpResults.set(step.id, r);
    }
  });
  afterAll(() => s.close());

  // Design.md verified summaries table (success steps)
  const summaries: Array<[string, string]> = [
    ["s01_weekend_overview", "You have 3 plans: Leo's Saturday Tournament (on track), Rosa's prescription refill (plan secured) and Family dinner (plan secured)."],
    ["s02_ripple", "This affects Leo's Saturday Tournament and Rosa's prescription refill. Family dinner is fine. Best option: Sam."],
    ["s03_handoff_to_sam", "I've asked Sam, sharing only what they need."],
    ["s06_sam_accepts", "Thanks. Leo's Saturday Tournament: plan secured."],
    ["s08_refill_rerank_to_service", "Pharmacy delivery, Saturday 10:00 AM–11:00 AM, $4.99. Want me to go ahead?"],
    ["s10_maya_approves_order", "Done. Rosa's prescription refill: plan secured."],
    ["s14_block_moved_to_0740", "Leo's Saturday Tournament: plan secured. Still open: arrived before check-in."],
    ["s15_sam_arrives", "Got it. Leo's Saturday Tournament: done."],
    ["s17_weekend_summary", "You have 3 plans: Leo's Saturday Tournament (done), Rosa's prescription refill (done) and Family dinner (plan secured)."],
  ];

  test("voice summaries match design.md table", () => {
    for (const [stepId, expected] of summaries) {
      const r = mcpResults.get(stepId)!;
      expect(r.isError, stepId).toBeFalsy();
      expect(r.content[0].text, stepId).toBe(expected);
    }
  });

  test("error shape: isError, sentence, JSON error block, no structuredContent (s05, s09)", () => {
    for (const [stepId, expectedText] of [
      ["s05_maya_cannot_accept_for_sam", "Only Sam can answer this handoff."],
      ["s09_sam_cannot_approve_mayas_purchase", "Only Maya can approve this."],
    ] as const) {
      const r = mcpResults.get(stepId)!;
      expect(r.isError, stepId).toBe(true);
      // First text block: sentence (may have "Next: ..." appended if there are next_steps)
      expect(r.content[0].text, `${stepId} sentence`).toBe(expectedText);
      // Second text block: JSON error object
      const errJson = JSON.parse(r.content[1].text);
      expect(errJson.error.code, stepId).toBe("WRONG_PRINCIPAL");
      // No structuredContent on errors
      expect(r.structuredContent, `${stepId} no structuredContent`).toBeFalsy();
    }
  });
});

// ── Task 2.3 continued: Unknown field and out-of-range validation ─────────────
describe("input validation errors", () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer(); });
  afterAll(() => s.close());

  test("get_thread with unknown field returns validation error", async () => {
    const r: any = await (await s.client("maya")).callTool({
      name: "get_thread",
      arguments: { thread_id: "thr_leo_tourney", extra: 1 },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/[Ii]nput validation error/);
    expect(r.content[0].text).toMatch(/extra|unrecognized/i);
  });

  test("list_threads with within_days: 99 returns validation error", async () => {
    const r: any = await (await s.client("maya")).callTool({
      name: "list_threads",
      arguments: { within_days: 99 },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/[Ii]nput validation error/);
  });
});

// ── Task 2.4: Idempotency ─────────────────────────────────────────────────────
describe("idempotency", () => {
  let s: TestServer;
  let store: ReturnType<typeof memoryStore>;

  beforeAll(async () => {
    // Inline setup so we can keep a reference to the store for event-count checks
    store = memoryStore();
    const clock = fixedClock("2026-10-08T19:00:00-07:00");
    const core = createThreadApp({
      store, clock, calendar: fakeCalendar(),
      providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
    });
    await core.initHousehold(seed);
    const app = buildHttpApp({
      core, lensHtml: async () => "",
      resolvePrincipal: devResolver("hh_rivera", ["maya", "sam", "rosa"]),
    });
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise<void>((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const clients = new Map<string, Client>();
    const clientFn = async (person: string) => {
      if (!clients.has(person)) {
        const c = new Client({ name: "idempotency", version: "0" });
        await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer dev-${person}` } },
        }));
        clients.set(person, c);
      }
      return clients.get(person)!;
    };
    s = {
      base, core, clock,
      client: clientFn,
      close: async () => { for (const c of clients.values()) await c.close(); server.close(); },
    };
  });
  afterAll(() => s.close());

  test("report_change: same idempotency_key → identical structuredContent and no new events", async () => {
    const input = {
      change: { type: "PERSON_UNAVAILABLE", person: "maya", start: "2026-10-10T07:00:00-07:00", end: "2026-10-10T13:00:00-07:00" },
      idempotency_key: "idem-test-1",
    };
    s.clock.set("2026-10-08T19:31:00-07:00");
    const r1: any = await (await s.client("maya")).callTool({ name: "report_change", arguments: input });
    expect(r1.isError).toBeFalsy();
    const count1 = (await store.events("hh_rivera")).length;

    s.clock.set("2026-10-08T19:32:00-07:00");
    const r2: any = await (await s.client("maya")).callTool({ name: "report_change", arguments: input });
    expect(r2.isError).toBeFalsy();
    const count2 = (await store.events("hh_rivera")).length;

    expect(r2.structuredContent).toEqual(r1.structuredContent);
    expect(count2).toBe(count1); // no new events appended
  });

  test("respond_to_handoff: repeated accept → same structuredContent", async () => {
    // Get to a state where a handoff exists: first do report_change then requestHandoff
    s.clock.set("2026-10-08T19:33:00-07:00");
    const hof: any = await (await s.client("maya")).callTool({
      name: "request_handoff",
      arguments: { thread_id: "thr_leo_tourney", responsibility_id: "r_transport" },
    });
    expect(hof.isError).toBeFalsy();
    const hoId = hof.structuredContent.handoff.id;

    const acceptInput = { handoff_id: hoId, accept: true, confirm_items: ["jersey"], add_to_calendar: true };
    s.clock.set("2026-10-08T19:34:00-07:00");
    const a1: any = await (await s.client("sam")).callTool({ name: "respond_to_handoff", arguments: acceptInput });
    expect(a1.isError).toBeFalsy();

    s.clock.set("2026-10-08T19:35:00-07:00");
    const a2: any = await (await s.client("sam")).callTool({ name: "respond_to_handoff", arguments: acceptInput });
    expect(a2.isError).toBeFalsy();

    expect(a2.structuredContent).toEqual(a1.structuredContent);
  });
});

// ── Task 2.5: Auth boundary ───────────────────────────────────────────────────
describe("auth boundary", () => {
  let s: TestServer;
  beforeAll(async () => { s = await startServer(); });
  afterAll(() => s.close());

  test("no token → 401 without WWW-Authenticate", async () => {
    const res = await fetch(`${s.base}/mcp`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBeNull();
  });

  test("dev-unknown token → 401", async () => {
    const res = await fetch(`${s.base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer dev-unknown" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  test("token in query string → 400", async () => {
    const res = await fetch(`${s.base}/mcp?access_token=dev-maya`, { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
  });

  test("sam calling confirm_action on maya's confirmation → WRONG_PRINCIPAL", async () => {
    // Set up: run story to s08 to get cf_1 via report_change + request_handoff
    s.clock.set("2026-10-08T19:31:00-07:00");
    await (await s.client("maya")).callTool({
      name: "report_change",
      arguments: {
        change: { type: "PERSON_UNAVAILABLE", person: "maya", start: "2026-10-10T07:00:00-07:00", end: "2026-10-10T13:00:00-07:00" },
        idempotency_key: "auth-test-ripple",
      },
    });
    // Sam accepts leo tourney handoff first (so sam becomes busy)
    s.clock.set("2026-10-08T19:32:00-07:00");
    const hof1: any = await (await s.client("maya")).callTool({
      name: "request_handoff",
      arguments: { thread_id: "thr_leo_tourney", responsibility_id: "r_transport" },
    });
    await (await s.client("sam")).callTool({
      name: "respond_to_handoff",
      arguments: { handoff_id: hof1.structuredContent.handoff.id, accept: true, confirm_items: ["jersey"], add_to_calendar: true },
    });
    // Now request handoff for refill → goes to service, creates confirmation
    s.clock.set("2026-10-08T19:34:00-07:00");
    const hof2: any = await (await s.client("maya")).callTool({
      name: "request_handoff",
      arguments: { thread_id: "thr_rosa_refill", responsibility_id: "r_pickup" },
    });
    const cfId = hof2.structuredContent?.requires_confirmation?.confirmation_id;
    expect(cfId, "confirmation_id from s08 setup").toBeTruthy();

    // Sam tries to approve maya's confirmation
    const r: any = await (await s.client("sam")).callTool({
      name: "confirm_action",
      arguments: { confirmation_id: cfId, approve: true },
    });
    expect(r.isError).toBe(true);
    const errJson = JSON.parse(r.content[1].text);
    expect(errJson.error.code).toBe("WRONG_PRINCIPAL");
  });
});
