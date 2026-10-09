// npm run demo: zero-credential local run (FileStore, demo connectors, embedded OAuth server).
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createThreadApp } from "thread-core";
import { fakeCalendar, fakeServiceProvider } from "thread-core/testkit";
import { buildHttpApp } from "./app.ts";
import { anyOf, devResolver } from "./auth/principal.ts";
import { jwtResolver, type OAuthConfig } from "./auth/oauth.ts";
import { loadOrCreateKeys } from "./auth/keys.ts";
import { demoClock } from "./clock.ts";
import { fileStore } from "./store/file-store.ts";

const env = (k: string, d: string) => process.env[k] ?? d;
const port = Number(env("PORT", "8787"));
const base = env("PUBLIC_BASE_URL", `http://localhost:${port}`);
const dataDir = env("DATA_DIR", ".data");
const seed = JSON.parse(readFileSync(new URL("../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"));
const clock = demoClock(env("DEMO_START", "2026-10-08T19:30:00-07:00"));
const store = fileStore(dataDir);
const core = createThreadApp({
  store, clock, calendar: fakeCalendar(), // replaced by demo-world connectors in spec demo-world
  providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
});
if (!(await store.load(seed.household.id))) {
  const r = await core.initHousehold(seed);
  if (!r.ok) throw new Error(r.error.message);
}
const persons = seed.household.persons.filter((p: { has_account: boolean }) => p.has_account).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
const oauth: OAuthConfig = {
  issuer: base,
  resource: `${base}/mcp`,
  householdId: seed.household.id,
  persons,
  keys: await loadOrCreateKeys(dataDir),
  autoConsent: env("DEMO_MODE", "true") === "true",
  clients: [
    // The simulator (Alexa role). Local secret is a demo value; on AWS it comes from the environment.
    { client_id: "alexa-sim", client_secret: env("OAUTH_CLIENT_SECRET", "local-demo-secret"), redirect_uris: [`${base}/oauth/callback`], grants: ["client_credentials", "authorization_code", "refresh_token"] },
  ],
};
const devTokens = env("AUTH_DEV_TOKENS", "true") === "true";
const app = buildHttpApp({
  core, oauth,
  lensHtml: async () => "<!doctype html><title>Thread Lens</title><p>Lens arrives in spec thread-lens.</p>",
  resolvePrincipal: devTokens ? anyOf(jwtResolver(oauth), devResolver(seed.household.id, persons.map((p: { id: string }) => p.id))) : jwtResolver(oauth),
});
serve({ fetch: app.fetch, port }, () => console.log(`THREAD MCP server on ${base}/mcp (protocol 2025-11-25; OAuth at ${base}/.well-known/oauth-authorization-server; dev tokens ${devTokens ? "ON" : "off"})`));
