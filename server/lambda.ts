// Lambda entry: the same Hono app on AWS Lambda via Function URL.
// Store: DynamoStore when TABLE_NAME is set, else FileStore on /tmp.
// OAuth keys from OAUTH_JWK_JSON env (injected by CDK from SSM at deploy time).
// Dev tokens are always disabled on Lambda.
import { handle } from "hono/aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createThreadApp } from "thread-core";
import { fakeCalendar, fakeServiceProvider } from "thread-core/testkit";
import { buildHttpApp } from "./app.ts";
import { jwtResolver, type OAuthConfig } from "./auth/oauth.ts";
import { loadOrCreateKeys } from "./auth/keys.ts";
import { demoClock } from "./clock.ts";
import { dynamoStore } from "./store/dynamo-store.ts";
import { fileStore } from "./store/file-store.ts";
import seedJson from "../fixtures/golden/rivera-seed.json" with { type: "json" }; // bundled by esbuild (no runtime file read on Lambda)

// The fixture is demo data; treat it untyped exactly as local.ts does with JSON.parse.
const seed = seedJson as unknown as {
  household: { id: string; persons: Array<{ id: string; name: string; has_account: boolean }> };
  providers: { svc_pharmacy_delivery: Record<string, unknown> };
};

const env = (k: string, d: string) => process.env[k] ?? d;
const tableName = process.env["TABLE_NAME"];
const base = env("PUBLIC_BASE_URL", "https://localhost");

const clock = demoClock(env("DEMO_START", "2026-10-08T19:30:00-07:00"));

const store = tableName
  ? dynamoStore(tableName, DynamoDBDocumentClient.from(new DynamoDBClient({})))
  : fileStore("/tmp/.data");

const core = createThreadApp({
  store, clock, calendar: fakeCalendar(),
  providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery } as Parameters<typeof fakeServiceProvider>[0])],
});

// Keys loaded once at cold start (OAUTH_JWK_JSON is an env var from SSM).
const keysPromise = loadOrCreateKeys("/tmp/.data", process.env["OAUTH_JWK_JSON"]);

const persons = seed.household.persons.filter((p) => p.has_account).map((p) => ({ id: p.id, name: p.name }));

const appPromise = keysPromise.then(async (keys) => {
  const oauth: OAuthConfig = {
    issuer: base,
    resource: `${base}/mcp`,
    householdId: seed.household.id,
    persons,
    keys,
    autoConsent: env("DEMO_MODE", "true") === "true",
    clients: [{
      client_id: "alexa-sim",
      client_secret: env("OAUTH_CLIENT_SECRET", ""),
      redirect_uris: [`${base}/oauth/callback`],
      grants: ["client_credentials", "authorization_code", "refresh_token"],
    }],
  };
  // Seed the household if it's the first call
  if (!(await store.load(seed.household.id))) {
    const r = await core.initHousehold(seed);
    if (!r.ok) console.error("seed failed:", r.error.message);
  }
  return buildHttpApp({
    core, oauth,
    lensHtml: async () => "<!doctype html><title>Thread Lens</title><p>Lens placeholder.</p>",
    simHtml: async () => "<!doctype html><title>Alexa+ experience simulator</title><p>Simulator placeholder (bundle served from the deployed asset).</p>",
    resolvePrincipal: jwtResolver(oauth),
  });
});

export const handler = handle(await appPromise);
