// npm run demo: zero-credential local run (FileStore, demo connectors, embedded OAuth server).
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createThreadApp } from "thread-core";
import { buildHttpApp } from "./app.ts";
import { anyOf, devResolver } from "./auth/principal.ts";
import { jwtResolver, type OAuthConfig } from "./auth/oauth.ts";
import { loadOrCreateKeys } from "./auth/keys.ts";
import { demoClock } from "./clock.ts";
import { fileStore } from "./store/file-store.ts";
import { demoCalendar, demoPharmacy, weatherSchedule, createWatcher } from "./world/index.ts";
import { mcpClients } from "./agent/mcp-client.ts";
import { mountAgent } from "./agent/handler.ts";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = (k: string, d: string) => process.env[k] ?? d;
const port = Number(env("PORT", "8787"));
const base = env("PUBLIC_BASE_URL", `http://localhost:${port}`);
const dataDir = env("DATA_DIR", ".data");
const seed = JSON.parse(readFileSync(new URL("../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"));
const DEMO_START = env("DEMO_START", "2026-10-08T19:30:00-07:00");

const clock = demoClock(DEMO_START);
const store = fileStore(dataDir);
const calendar = demoCalendar();
const pharmacy = demoPharmacy({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery }, clock);
const weather = weatherSchedule();

const core = createThreadApp({ store, clock, calendar, providers: [pharmacy] });

if (!(await store.load(seed.household.id))) {
  const r = await core.initHousehold(seed);
  if (!r.ok) throw new Error(r.error.message);
}

const watcher = createWatcher(core, seed.household.id, weather);
const calls: Array<{ tool: string; ms: number; ok: boolean; code?: string }> = [];

const persons = seed.household.persons
  .filter((p: { has_account: boolean }) => p.has_account)
  .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));

const oauth: OAuthConfig = {
  issuer: base,
  resource: `${base}/mcp`,
  householdId: seed.household.id,
  persons,
  keys: await loadOrCreateKeys(dataDir),
  autoConsent: env("DEMO_MODE", "true") === "true",
  clients: [
    { client_id: "alexa-sim", client_secret: env("OAUTH_CLIENT_SECRET", "local-demo-secret"), redirect_uris: [`${base}/oauth/callback`], grants: ["client_credentials", "authorization_code", "refresh_token"] },
  ],
};

const devTokens = env("AUTH_DEV_TOKENS", "true") === "true";
const lensPath = new URL("../web/dist-lens/index.html", import.meta.url);
const lensHtml = async () => {
  try {
    return readFileSync(lensPath, "utf8");
  } catch {
    return "<!doctype html><title>Thread Lens</title><p>Lens not built yet. Run `npm run build:lens`.</p>";
  }
};
const simPath = new URL("../web/dist/index.html", import.meta.url);
const simHtml = async () => {
  try {
    return readFileSync(simPath, "utf8");
  } catch {
    return "<!doctype html><title>Alexa+ experience simulator</title><p>Simulator not built yet. Run `npm run build:sim`.</p>";
  }
};
const app = buildHttpApp({
  core,
  oauth,
  lensHtml,
  simHtml,
  resolvePrincipal: devTokens ? anyOf(jwtResolver(oauth), devResolver(seed.household.id, persons.map((p: { id: string }) => p.id))) : jwtResolver(oauth),
  onCall: (e) => { calls.push(e); if (calls.length > 200) calls.splice(0, calls.length - 200); },
});

// --- Demo API routes (simulator-facing, no auth) ---

const PRESETS: Record<string, string> = {
  "Thu 19:30": "2026-10-08T19:30:00-07:00",
  "Sat 07:05": "2026-10-10T07:05:00-07:00",
  "Sat 08:21": "2026-10-10T08:21:00-07:00",
  "Sat 10:42": "2026-10-10T10:42:00-07:00",
};

app.get("/api/clock", (c) => c.json({ iso: clock.now(), presets: Object.keys(PRESETS) }));

app.get("/api/household", (c) => c.json({ household_id: seed.household.id, persons }));

app.post("/api/clock", async (c) => {
  const body = await c.req.json<{ preset?: string; iso?: string }>();
  const iso = body.preset ? PRESETS[body.preset] : body.iso;
  if (!iso) return c.json({ error: "provide preset or iso" }, 400);
  clock.set(iso);
  await watcher.onClockChange(clock.now());
  return c.json({ iso: clock.now(), presets: Object.keys(PRESETS) });
});

app.get("/api/inbox", async (c) => {
  const person = c.req.query("person");
  if (!person) return c.json({ error: "provide ?person=<id>" }, 400);
  const r = await core.inbox({ kind: "person", household_id: seed.household.id, person_id: person }, {});
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json(r.data);
});

app.post("/api/reset", async (c) => {
  // Clear file store by re-initialising (fileStore handles overwrite).
  calendar.reset();
  pharmacy.reset();
  weather.reset();
  calls.length = 0;
  clock.set(DEMO_START);
  // Re-seed: clear store data dir and re-create
  const freshStore = fileStore(dataDir);
  const freshCore = createThreadApp({ store: freshStore, clock, calendar, providers: [pharmacy] });
  const r = await freshCore.initHousehold(seed);
  if (!r.ok) return c.json({ error: r.error }, 500);
  return c.json({ ok: true });
});

app.get("/api/log", (c) => c.json(calls.slice(-50)));

// --- Agent (scripted + optional Bedrock live), story and voice assets ---

// Device -> person: Echo = Maya, phone = Sam, matching the simulator's own persona pick.
const pickId = (name: string) => persons.find((p: { name: string }) => p.name.toLowerCase().startsWith(name))?.id ?? persons[0]?.id;
const deviceToPerson = { echo: pickId("maya"), phone: pickId("sam") } as Record<string, string>;
const mcp = mcpClients(base); // dev tokens are on locally; the agent calls our own /mcp over real MCP
mountAgent(app, { mcp, deviceToPerson });

// The beat script drives "Play the story" and the e2e; served so the client reads the same source.
app.get("/api/story", (c) => c.json(JSON.parse(readFileSync(new URL("../story/story.json", import.meta.url), "utf8"))));

// Pre-rendered voice MP3s (npm run voices). Optional: absent files just 404 and playback falls back.
const voicesDir = fileURLToPath(new URL("../web/public/voices/", import.meta.url));
app.get("/voices/:file", (c) => {
  const file = c.req.param("file");
  if (!/^[a-z0-9_]+\.mp3$/.test(file)) return c.json({ error: "not found" }, 404);
  const path = voicesDir + file;
  if (!existsSync(path)) return c.json({ error: "not found" }, 404);
  const buf = readFileSync(path);
  return c.body(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 200, { "content-type": "audio/mpeg" });
});

serve({ fetch: app.fetch, port }, () =>
  console.log(`THREAD MCP server on ${base}/mcp (protocol 2025-11-25; OAuth at ${base}/.well-known/oauth-authorization-server; dev tokens ${devTokens ? "ON" : "off"}; demo APIs at ${base}/api/clock)`),
);
