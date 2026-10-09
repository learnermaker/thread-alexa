// npm run demo: zero-credential local run (FileStore, demo connectors, dev tokens until spec auth).
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createThreadApp } from "thread-core";
import { fakeCalendar, fakeServiceProvider } from "thread-core/testkit";
import { buildHttpApp } from "./app.ts";
import { devResolver } from "./auth/principal.ts";
import { demoClock } from "./clock.ts";
import { fileStore } from "./store/file-store.ts";

const env = (k: string, d: string) => process.env[k] ?? d;
const seed = JSON.parse(readFileSync(new URL("../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"));
const clock = demoClock(env("DEMO_START", "2026-10-08T19:30:00-07:00"));
const store = fileStore(env("DATA_DIR", ".data"));
const core = createThreadApp({
  store, clock, calendar: fakeCalendar(), // replaced by demo-world connectors in spec demo-world
  providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
});
if (!(await store.load(seed.household.id))) {
  const r = await core.initHousehold(seed);
  if (!r.ok) throw new Error(r.error.message);
}
const app = buildHttpApp({
  core, lensHtml: async () => "<!doctype html><title>Thread Lens</title><p>Lens arrives in spec thread-lens.</p>",
  resolvePrincipal: devResolver(seed.household.id, ["maya", "sam", "rosa"]),
});
const port = Number(env("PORT", "8787"));
serve({ fetch: app.fetch, port }, () => console.log(`THREAD MCP server on http://localhost:${port}/mcp (protocol 2025-11-25, AUTH_MODE=dev)`));
