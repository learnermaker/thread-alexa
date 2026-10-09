# Implementation Plan: mcp-tools

## Overview
Conformance tests, FileStore tests, latency, docs. The server code is already in place and verified.

## Tasks

- [x] 1. Test harness
  - [x] 1.1 Create `server/test/harness.ts` per design.md, and refactor `server/test/mcp.golden.test.ts` to use it (same 4 tests, same assertions)
    - **Done when:** `npx vitest run server/test/mcp.golden.test.ts` → 4 passed
    - _Requirements: 2.1_

- [x] 2. Conformance tests (`server/test/conformance.test.ts`)
  - [x] 2.1 Protocol `2025-11-25`; tools/list has the 8 names, titles, descriptions, annotations per Requirement 1.4, strict inputSchema, outputSchema, lens `_meta`; resources/read lens MIME
  - [x] 2.2 Voice summaries: replay the golden story and assert the first text content equals the design.md table for each listed step
  - [x] 2.3 Errors and validation: the s05/s09 shape (isError, sentence, JSON block with code, no structuredContent); unknown field → validation error; `within_days: 99` → validation error
  - [x] 2.4 Idempotency: report_change twice with the same key → identical structuredContent, and the core event count doesn't grow; respond_to_handoff repeated → same result
  - [x] 2.5 Auth boundary: no token → 401 and no WWW-Authenticate; `dev-unknown` → 401; query token → 400; sam calling confirm_action on maya's cf → WRONG_PRINCIPAL

- [x] 3. Checkpoint: `npm run verify`, then commit `test(mcp): conformance, voice, errors, idempotency, auth boundary (spec mcp-tools, tasks 1-2)`, then push
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 4. FileStore (`server/test/file-store.test.ts`)
  - Commit/load/version; stale version → `StoreConflictError` with the files unchanged; events appended as JSONL in order; a restart (new `fileStore(sameDir)` + new app) sees the same statuses; household id `../x` → throws. Use a temp dir under `os.tmpdir()` and clean it up with `fs.rmSync(dir, { recursive: true, force: true })`
  - **Done when:** `npx vitest run server/test/file-store.test.ts` passes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Latency script
  - Create `server/latency.ts` per design.md; add the `latency` npm script
  - **Done when:** with `npm run demo` running in another terminal, `npm run latency` prints the table and every p95 is < 200 ms. Put the printed table into `docs/latency.md` with the date and "local, Windows 11"
  - _Requirements: 5.1, 5.2_

- [x] 6. Docs
  - `docs/alexa-plus-readiness.md` and the 4 ADRs per design.md. A README section "Connect with MCP Inspector": `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, URL `http://localhost:8787/mcp`, header `Authorization: Bearer dev-maya`
  - **Done when:** the files exist and `npm run verify` passes
  - _Requirements: 5.3_

- [x] 7. Checkpoint: `npm run verify`, then commit `feat(mcp): FileStore tests, latency script, readiness doc, ADRs (spec mcp-tools, tasks 4-6)`, then push. Confirm CI is green (`gh run watch`)
  - _Requirements: 4.1, 5.1, 5.3_
