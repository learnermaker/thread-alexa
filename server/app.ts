// One Hono app for everything: /mcp, /health (and later /oauth, /.well-known, /api, static SPA).
// Runs locally with @hono/node-server (server/local.ts) and on Lambda with hono/aws-lambda (spec aws-deploy).
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, type McpDeps } from "./mcp/server.ts";
import type { ResolvePrincipal } from "./auth/principal.ts";

export interface AppDeps extends McpDeps {
  resolvePrincipal: ResolvePrincipal;
}

export function buildHttpApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true, protocol: "2025-11-25" }));
  app.all("/mcp", async (c) => {
    if (new URL(c.req.url).searchParams.has("access_token")) return c.json({ error: "token_in_query_not_allowed" }, 400);
    const principal = await deps.resolvePrincipal(c.req.header("authorization"));
    // Alexa+ requirement: 401 WITHOUT a WWW-Authenticate header.
    if (!principal) return c.json({ error: "unauthorized" }, 401);
    const server = buildMcpServer(deps, principal);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return app;
}
