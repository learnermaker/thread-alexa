# ADR 0003: Hono + Web-Standard Transport, One Service

## Context

The server must handle MCP, OAuth (spec auth), static SPA (spec thread-lens), and a health endpoint. It must run locally with Node and on Lambda without a build step.

## Decision

Use **Hono** 4.x as the HTTP framework with `@hono/node-server` for local dev and `hono/aws-lambda` for Lambda (spec aws-deploy). Use `WebStandardStreamableHTTPServerTransport` (the web-standard variant, not the Node-specific one) so the same transport works in both environments. All routes (`/mcp`, `/health`, and later `/oauth`, `/.well-known`, `/api`, static SPA) live in a single `buildHttpApp()`.

## Alternatives

- Express: no native web-standard Request/Response; needs an adapter for Lambda.
- Separate services (MCP + OAuth + SPA): more deployment complexity and cross-origin auth.
- Node-specific transport: ties the MCP handler to Node's `IncomingMessage`; incompatible with Lambda.

## Consequences

Hono's `c.req.raw` (a standard `Request`) passes directly to `transport.handleRequest()`. The same app object runs on both runtimes. Adding routes later (OAuth, SPA) is a `app.get/post()` call in `app.ts`.
