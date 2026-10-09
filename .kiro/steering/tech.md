---
inclusion: always
---
# Tech stack (pinned; do not change)

| What | Exact |
|---|---|
| Node | 24 LTS. **The server runs TypeScript directly** (`node server/local.ts`, Node type stripping). There's no server build step |
| TypeScript | 5.9.3 (type-check only, `noEmit`) |
| MCP | `@modelcontextprotocol/sdk` **1.32.1** + `@modelcontextprotocol/ext-apps` **1.7.5** (do NOT upgrade: ext-apps 2.x needs SDK v2) |
| HTTP | `hono` 4.13.13 + `@hono/node-server` 2.1.4 (Lambda later via `hono/aws-lambda`) |
| Core | `thread-core` from its GitHub release tarball (see package.json) |
| Validation | `zod` 4.6.5 (the same copy thread-core uses) |
| Tests | `vitest` 5.0.3 |

**Never add, remove or upgrade a dependency.** `npm run verify` enforces the list. Later specs add dependencies through the architect.

## Commands
- `npm run demo`: local server on http://localhost:8787 (MCP at `/mcp`)
- `npm run verify`: THE green check (contract, deps, secrets, typecheck, tests)
- `npx vitest run server/test/mcp.golden.test.ts`: one test file

## Code rules
- ESM, relative imports end in `.ts`, `import type` for types. `erasableSyntaxOnly`: no enums, namespaces or parameter properties.
- Data from core is snake_case; keep it unchanged in tool outputs.
- MCP patterns: see `.kiro/steering/mcp-api.md` (loaded for `server/mcp/**`).
- Paths with `new URL(..., import.meta.url)` or `node:path`; never hard-coded backslashes.
