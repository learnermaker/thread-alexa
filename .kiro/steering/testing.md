---
inclusion: always
---
# Testing rules

- Vitest 5; tests in `server/test/`. Use `fixedClock` and the fakes from `thread-core/testkit` in tests.
- **The golden story over MCP** (`server/test/mcp.golden.test.ts`) replays `fixtures/golden/ripple-story.json` through real Streamable HTTP with per-person tokens. It must always pass. Never edit the fixture; never weaken an assertion; never skip a test. If you believe it's wrong, BLOCKED.md.
- Tests start the real Hono app on an ephemeral port (`serve({ fetch: app.fetch, port: 0 })`) and talk to it with the SDK `Client` + `StreamableHTTPClientTransport`. Don't mock MCP.
- A task is done only when its "Done when" command passes **and** `npm run verify` passes.
