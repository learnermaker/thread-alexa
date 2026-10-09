# Alexa+ MCP Readiness Checklist

| Requirement (Alexa+ docs) | Our implementation | Test | Status |
|---|---|---|---|
| MCP 2025-11-25 | `WebStandardStreamableHTTPServerTransport` with `enableJsonResponse: true`; protocol negotiated per SDK | `conformance.test.ts: negotiated protocol is 2025-11-25` | Done |
| Streamable HTTP | Stateless per-request `WebStandardStreamableHTTPServerTransport`; no session ID | `conformance.test.ts: protocol and discovery` | Done |
| < 500 ms end-to-end | p95 ≤ 23 ms locally; see `docs/latency.md` | `mcp.golden.test.ts: latency`, `npm run latency` | Done |
| 401 without `WWW-Authenticate` | `buildHttpApp` returns `c.json({error:"unauthorized"}, 401)` with no `WWW-Authenticate` header | `conformance.test.ts: no token → 401 without WWW-Authenticate` | Done |
| No token in query string | Query string `access_token` param returns 400 before auth | `conformance.test.ts: token in query string → 400` | Done |
| PRM metadata (title, description, annotations) | Each tool has `title`, `description`, per-tool `annotations` from `TOOLS` in `mcp/tools.ts` | `conformance.test.ts: tools/list: exactly 8 tools with required fields` | Done |
| AS metadata (outputSchema) | `outputSchema: operations[op].output` full zod object from thread-core | `conformance.test.ts: tools/list: exactly 8 tools with required fields` | Done |
| Tier 1 `mcp:service` client\_credentials + resource | – | – | Planned (spec auth) |
| Tier 2 auth code + PKCE S256 + resource | – | – | Planned (spec auth) |
| No DCR/OIDC | Not implemented (not required) | – | N/A |
| One intent per tool | 8 tools, 1:1 with thread-core operations, single-intent descriptions | `conformance.test.ts: tools/list` | Done |
| Descriptions say when/why/what | Tool descriptions follow Alexa+ guidance: when to call, why, what it returns | `conformance.test.ts: tools/list: exactly 8 tools with required fields` | Done |
| Declared params are honored | `inputSchema` from core; `additionalProperties: false`; unknown fields return validation error | `conformance.test.ts: get_thread with unknown field returns validation error` | Done |
| Always a response | `McpServer` always returns a content array; errors return `isError: true` content | `conformance.test.ts: error shape`, `mcp.golden.test.ts: all steps` | Done |
| Idempotent repeats | `idempotency_key` on all mutating tools; repeated call returns identical `structuredContent` | `conformance.test.ts: idempotency` | Done |
| Output schemas | `outputSchema: operations[op].output` full zod object | `conformance.test.ts: tools/list` | Done |
| MCP Apps UI resource | `ui://thread/lens` registered with `RESOURCE_MIME_TYPE` (`text/html;profile=mcp-app`) | `conformance.test.ts: resources/read lens returns HTML with profile=mcp-app MIME` | Done |
| Voice-only summary | `speak()` in `mcp/speak.ts` returns ≤ ~25-word summary per operation | `conformance.test.ts: voice summaries match design.md table` | Done |

OAuth rows are **planned (spec auth)** and have not been marked done.
