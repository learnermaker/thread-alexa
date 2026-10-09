---
inclusion: always
---
# Repository structure (one npm package; no workspaces)

```text
server/                 the Hono service (runs with plain `node`)
  app.ts                buildHttpApp(deps): /health, /mcp (later /oauth, /.well-known, /api, static SPA)
  local.ts              `npm run demo` entry: FileStore + demo clock + seed + node-server
  clock.ts              DEMO_MODE clock (settable)
  mcp/tools.ts          the 8 tool definitions (name ↔ core operation, descriptions, annotations)
  mcp/server.ts         buildMcpServer(deps, principal): registers tools + the Thread Lens resource
  mcp/speak.ts          voice-only text summaries
  auth/principal.ts     bearer token → principal (dev resolver now; JWT in spec auth)
  store/file-store.ts   thread-core Store port on local files
  test/                 vitest tests (golden over MCP, conformance, store, speak)
web/                    (later) simulator SPA + Thread Lens single-file build
infra/                  (later) AWS CDK
fixtures/golden/        rivera-seed.json, ripple-story.json   [ARCHITECT-OWNED, same as thread-core's]
docs/                   kiro-log.md (auto), friction-log, ADRs, readiness checklist
skills/thread/SKILL.md  (later) Agent Skill
```
## Rules
- Business logic belongs in **thread-core**. If a tool needs new behavior, write BLOCKED.md (the architect changes core and releases it).
- `server/mcp/**` may import from `thread-core`, `./tools.ts` and `./speak.ts`, never from `server/store` or `server/auth`.
- Test names describe behavior: `"report_change over MCP: dinner is NONE (not affected)"`.
