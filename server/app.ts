// One Hono app for everything: /mcp, /health, OAuth (/oauth/*, /.well-known/*), later /api and the static SPA.
// Runs locally with @hono/node-server (server/local.ts) and on Lambda with hono/aws-lambda (spec aws-deploy).
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, type McpDeps } from "./mcp/server.ts";
import type { ResolvePrincipal } from "./auth/principal.ts";
import { oauthRoutes, type OAuthConfig } from "./auth/oauth.ts";
import { privacyHtml, termsHtml } from "./legal.ts";

/** One raw JSON-RPC exchange on /mcp, for the simulator's "Under the hood" drawer. Never holds the bearer token. */
export interface WireEntry {
  at: string; request: string; rpc: string; tool?: string; status: number; ms: number;
  as: string; via: string; req_text: string; res_text: string; res_bytes: number;
}

export interface AppDeps extends McpDeps {
  onWire?: (e: WireEntry) => void; // when set, every /mcp exchange is reported (method, tool, status, ms, who, JSON bodies)
  resolvePrincipal: ResolvePrincipal;
  oauth?: OAuthConfig; // when set, the embedded authorization server is mounted
  simHtml?: () => Promise<string>; // when set, the simulator SPA is served at "/" and the Lens at "/lens"
}

// JSON-RPC methods a Tier 1 (service) token may call. Everything else needs a Tier 2 person token.
const SERVICE_METHODS = new Set(["initialize", "notifications/initialized", "tools/list", "ping"]);

export function buildHttpApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true, protocol: "2025-11-25" }));
  // Legal pages (D18.10): the add-on manifest points at these HTTPS URLs.
  app.get("/privacy", (c) => c.html(privacyHtml()));
  app.get("/terms", (c) => c.html(termsHtml()));
  if (deps.oauth) oauthRoutes(app, deps.oauth);
  if (deps.simHtml) {
    // The simulator SPA at "/" and the Lens at "/lens" (same origin, so the Lens iframe's
    // PostMessageTransport(window.parent, window.parent) talks to the simulator host directly).
    app.get("/", async (c) => c.html(await deps.simHtml!()));
    app.get("/lens", async (c) => c.html(await deps.lensHtml()));
  }
  const wireAs = new WeakMap<Request, string>(); // who the bearer token resolved to, for the wire log
  if (deps.onWire) {
    const MAX = 12_000;
    app.use("/mcp", async (c, next) => {
      const started = performance.now();
      const reqText = c.req.method === "POST" ? await c.req.raw.clone().text() : "";
      await next();
      const resText = await c.res.clone().text();
      let rpc: { method?: string; params?: { name?: string } } = {};
      try { rpc = JSON.parse(reqText) as typeof rpc; } catch { /* not JSON (e.g. GET) */ }
      const auth = c.req.header("authorization") ?? "";
      deps.onWire!({
        at: new Date().toISOString(), request: `${c.req.method} /mcp`, rpc: rpc.method ?? "(no body)", tool: rpc.params?.name,
        status: c.res.status, ms: Math.round(performance.now() - started),
        as: wireAs.get(c.req.raw) ?? "no token",
        via: !auth ? "no Authorization header" : /^Bearer dev-/.test(auth) ? "dev token" : "OAuth access token",
        req_text: reqText.slice(0, MAX), res_text: resText.slice(0, MAX), res_bytes: resText.length,
      });
    });
  }
  app.all("/mcp", async (c) => {
    if (new URL(c.req.url).searchParams.has("access_token")) return c.json({ error: "token_in_query_not_allowed" }, 400);
    const principal = await deps.resolvePrincipal(c.req.header("authorization"));
    // Alexa+ requirement: 401 WITHOUT a WWW-Authenticate header.
    if (!principal) return c.json({ error: "unauthorized" }, 401);
    wireAs.set(c.req.raw, principal.kind === "person" ? principal.person_id : "service client");
    if (principal.kind === "service") {
      const body: unknown = c.req.method === "POST" ? await c.req.raw.clone().json().catch(() => undefined) : undefined;
      const methods = (Array.isArray(body) ? body : [body]).map((m) => (m as { method?: string } | undefined)?.method);
      if (methods.some((m) => !m || !SERVICE_METHODS.has(m))) return c.json({ error: "insufficient_scope", error_description: "this call needs a user token (mcp:tools)" }, 403);
    }
    const server = buildMcpServer(deps, principal.kind === "person" ? principal : undefined);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return app;
}
