// Auth conformance harness: an in-process app (Hono app.request) wired like local.ts but with
// memoryStore, fixedClock and freshly loaded ES256 keys. The OAuth client is alexa-sim / test-secret,
// redirect http://localhost/cb. PKCE helpers (verifier/challenge) are here; b64sha256 is reused from oauth.ts.
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createThreadApp, memoryStore } from "thread-core";
import { fakeCalendar, fakeServiceProvider, fixedClock } from "thread-core/testkit";
import { buildHttpApp } from "../app.ts";
import { anyOf, devResolver } from "../auth/principal.ts";
import { b64sha256, jwtResolver, type OAuthConfig } from "../auth/oauth.ts";
import { loadOrCreateKeys } from "../auth/keys.ts";

const seed = JSON.parse(readFileSync(new URL("../../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"));

export const BASE = "http://localhost";
export const RESOURCE = `${BASE}/mcp`;
export const REDIRECT = "http://localhost/cb";
export const CLIENT_ID = "alexa-sim";
export const CLIENT_SECRET = "test-secret";

export interface AuthHarness {
  app: ReturnType<typeof buildHttpApp>;
  oauth: OAuthConfig;
  core: ReturnType<typeof createThreadApp>;
  clock: ReturnType<typeof fixedClock>;
  persons: Array<{ id: string; name: string }>;
}

/** verifier is 43 base64url chars (RFC 7636 min); challenge = b64url(sha256(verifier)). */
export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: b64sha256(verifier) };
}

export async function startAuthHarness(opts?: { devTokens?: boolean }): Promise<AuthHarness> {
  const clock = fixedClock("2026-10-08T19:00:00-07:00");
  const dataDir = mkdtempSync(join(process.env["KIROCREW_SCRATCH"] ?? tmpdir(), "oauth-key-"));
  const core = createThreadApp({
    store: memoryStore(),
    clock,
    calendar: fakeCalendar(),
    providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
  });
  await core.initHousehold(seed);
  const persons = seed.household.persons
    .filter((p: { has_account: boolean }) => p.has_account)
    .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
  const oauth: OAuthConfig = {
    issuer: BASE,
    resource: RESOURCE,
    householdId: seed.household.id,
    persons,
    keys: await loadOrCreateKeys(dataDir, undefined),
    autoConsent: true,
    clients: [
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uris: [REDIRECT], grants: ["client_credentials", "authorization_code", "refresh_token"] },
    ],
  };
  const devTokens = opts?.devTokens ?? true;
  const app = buildHttpApp({
    core,
    oauth,
    lensHtml: async () => "<!doctype html><title>Thread Lens</title>",
    resolvePrincipal: devTokens
      ? anyOf(jwtResolver(oauth), devResolver(seed.household.id, persons.map((p: { id: string }) => p.id)))
      : jwtResolver(oauth),
  });
  return { app, oauth, core, clock, persons };
}

/** POST form helper for /oauth/token and /oauth/authorize. */
export function form(fields: Record<string, string>, headers: Record<string, string> = {}): RequestInit {
  return { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(fields).toString() };
}
