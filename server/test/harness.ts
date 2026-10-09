// Shared test harness: real Hono app on an ephemeral port, one SDK Client per person.
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createThreadApp, memoryStore } from "thread-core";
import { fakeCalendar, fakeServiceProvider, fixedClock } from "thread-core/testkit";
import { buildHttpApp } from "../app.ts";
import { devResolver } from "../auth/principal.ts";

const seed = JSON.parse(
  readFileSync(new URL("../../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"),
);

export interface TestServer {
  base: string;
  core: ReturnType<typeof createThreadApp>;
  clock: ReturnType<typeof fixedClock>;
  client(person: string): Promise<Client>;
  close(): Promise<void>;
}

export async function startServer(
  calls?: Array<{ tool: string; ms: number; ok: boolean; code?: string }>,
): Promise<TestServer> {
  const clock = fixedClock("2026-10-08T19:00:00-07:00");
  const core = createThreadApp({
    store: memoryStore(),
    clock,
    calendar: fakeCalendar(),
    providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
  });
  await core.initHousehold(seed);

  const app = buildHttpApp({
    core,
    lensHtml: async () => "<!doctype html><title>Thread Lens</title>",
    resolvePrincipal: devResolver("hh_rivera", ["maya", "sam", "rosa"]),
    ...(calls ? { onCall: (e) => calls.push(e) } : {}),
  });

  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const clients = new Map<string, Client>();

  return {
    base,
    core,
    clock,
    async client(person: string) {
      if (!clients.has(person)) {
        const c = new Client({ name: "test", version: "0" });
        await c.connect(
          new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer dev-${person}` } },
          }),
        );
        clients.set(person, c);
      }
      return clients.get(person)!;
    },
    async close() {
      for (const c of clients.values()) await c.close();
      server.close();
    },
  };
}
