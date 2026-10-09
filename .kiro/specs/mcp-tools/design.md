# Design Document: mcp-tools

## Overview
`server/` already contains the **architect's verified reference** (Oct 8): `app.ts`, `mcp/server.ts`, `mcp/tools.ts`, `mcp/speak.ts`, `auth/principal.ts`, `store/file-store.ts`, `clock.ts`, `local.ts`, and `test/mcp.golden.test.ts` (4/4 passing: golden over MCP, tools/list, 401, latency). Your job: add the remaining conformance tests, the FileStore tests, the latency script, the readiness doc and the ADRs. Fix only real bugs, and note them in commits.

## Architecture
```text
MCP client (simulator agent / MCP Inspector / Claude)
   │ POST /mcp  Authorization: Bearer <token>        (stateless Streamable HTTP, JSON responses)
   ▼
buildHttpApp ── resolvePrincipal(token) ──401 (no WWW-Authenticate) if missing/invalid
   │ new McpServer + transport per request, bound to the principal
   ▼
8 tools ── 1:1 ──▶ thread-core app.<op>(principal, args)  ──▶ Store (FileStore locally)
           success → speak(op,data) + structuredContent ; error → isError + text + JSON (no structuredContent)
```

## Verified voice summaries (golden steps, exact)
| Step | Summary |
|---|---|
| s01 | `You have 3 plans: Leo's Saturday Tournament (on track), Rosa's prescription refill (plan secured) and Family dinner (plan secured).` |
| s02 | `This affects Leo's Saturday Tournament and Rosa's prescription refill. Family dinner is fine. Best option: Sam.` |
| s03 | `I've asked Sam, sharing only what they need.` |
| s05 (error) | `Only Sam can answer this handoff.` |
| s06 | `Thanks. Leo's Saturday Tournament: plan secured.` |
| s08 | `Pharmacy delivery, Saturday 10:00 AM–11:00 AM, $4.99. Want me to go ahead?` |
| s09 (error) | `Only Maya can approve this.` |
| s10 | `Done. Rosa's prescription refill: plan secured.` |
| s14 | `Leo's Saturday Tournament: plan secured. Still open: arrived before check-in.` |
| s15 | `Got it. Leo's Saturday Tournament: done.` |
| s17 | `You have 3 plans: Leo's Saturday Tournament (done), Rosa's prescription refill (done) and Family dinner (plan secured).` |

Other verified facts: the negotiated protocol is `2025-11-25`; `resources/read ui://thread/lens` returns `text/html;profile=mcp-app`; a repeated `report_change` with the same `idempotency_key` returns identical structuredContent; `get_thread` with `extra: 1` gives `isError: true` with "Input validation error: … Unrecognized key: \"extra\"".

## Test harness pattern
Reuse the setup at the top of `server/test/mcp.golden.test.ts`: `createThreadApp` with `memoryStore`, `fixedClock`, `fakeCalendar`, `fakeServiceProvider`; `buildHttpApp` with `devResolver`; `serve({ fetch: app.fetch, port: 0 })`; one SDK `Client` per person. Put the shared setup in `server/test/harness.ts` (exporting `startServer()` → `{ base, core, clock, client(person), close() }`) and refactor the golden test to use it.

## Latency script (`server/latency.ts`, run by `npm run latency`)
```text
usage: node server/latency.ts [baseUrl=http://localhost:8787] [token=dev-maya]
connects one SDK client; warms up once; then:
  list_threads ×20, get_thread(thr_leo_tourney) ×20, report_change (unrelated Sunday change, a new idempotency_key each call) ×5
prints a table: tool | n | p50 ms | p95 ms   and exits 1 if any p95 ≥ 500
```
Add `"latency": "node server/latency.ts"` to package.json scripts (scripts are yours to add; dependencies are not).

## Readiness doc (`docs/alexa-plus-readiness.md`)
A table with columns Requirement (Alexa+ docs) | Our implementation | Test | Status. Rows: MCP 2025-11-25 · Streamable HTTP · < 500 ms · 401 without WWW-Authenticate · no token in query · PRM metadata · AS metadata · Tier 1 client_credentials + resource · Tier 2 auth code + PKCE S256 + resource · no DCR/OIDC · one intent per tool · descriptions say when/why/what · declared params are honored · always a response · idempotent repeats · output schemas · MCP Apps UI resource · voice-only summary. OAuth rows are **planned (spec auth)**; never mark them done early.

## ADRs (`docs/adr/0001-…md`, short: context, decision, alternatives, consequences)
1. MCP SDK 1.32.1 + ext-apps 1.7.5 (not v2), assert 2025-11-25
2. Stateless Streamable HTTP with JSON responses (Lambda-friendly)
3. Hono + the web-standard transport; one service for MCP, OAuth, API, SPA
4. Tool schemas generated from thread-core (full zod objects); errors without structuredContent (SDK client validation, friction-log F6)

## Don'ts
- Don't add tools, parameters or business logic. Don't change the tool descriptions (the architect owns their wording; propose changes via BLOCKED.md).
- Don't log tokens or argument values (only tool, ms, ok, code).
