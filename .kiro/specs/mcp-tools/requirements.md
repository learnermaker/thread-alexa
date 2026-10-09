# Requirements Document: mcp-tools

## Introduction
Harden and prove THREAD's **Alexa+-ready MCP server**: 8 intent-shaped tools mapped 1:1 to thread-core operations, schemas generated from core, annotations, voice-only summaries, the Thread Lens app resource, the FileStore, latency measurement and the MCP conformance checks Amazon recommends (MCP Inspector: schemas, valid/invalid calls, repeat calls for idempotency). (Master Spec §B6, §D8, §D11, §D13, §D14.)

## Glossary
- **MCP_Server**: `buildMcpServer()` in `server/mcp/server.ts`, served at `/mcp` by `buildHttpApp()`.
- **Tools**: the 8 entries of `server/mcp/tools.ts`.
- **Dev_Token**: `Authorization: Bearer dev-<person>` (local demo only; replaced by OAuth in spec auth).

## Requirements

### Requirement 1: Protocol and discovery
#### Acceptance Criteria
1. WHEN a client connects THE MCP_Server SHALL negotiate protocol `2025-11-25` over stateless Streamable HTTP with JSON responses.
2. WHEN `tools/list` is called THE MCP_Server SHALL return exactly the 8 Tools, each with a title, a description, `annotations`, an `inputSchema` with `additionalProperties: false`, an `outputSchema`, and `_meta.ui.resourceUri = "ui://thread/lens"`.
3. WHEN `resources/read` is called for `ui://thread/lens` THE MCP_Server SHALL return HTML with the MIME type `text/html;profile=mcp-app`.
4. THE `list_threads` and `get_thread` tools SHALL have `readOnlyHint: true`; mutating tools SHALL have `destructiveHint: false` and `idempotentHint: true`.

### Requirement 2: Behavior over MCP
#### Acceptance Criteria
1. WHEN the golden story is replayed over MCP with Dev_Tokens THE MCP_Server SHALL return `structuredContent` matching every step's expected data, and `isError` with the expected error code for error steps.
2. WHEN a tool succeeds THE MCP_Server SHALL return a non-empty voice summary as the first text content, equal to the verified lines in design.md for the golden steps.
3. WHEN a domain error occurs THE MCP_Server SHALL return `isError: true`, a human sentence with next steps, and a JSON text block `{"error":{code,message,unresolved,next_steps}}`, with no `structuredContent`.
4. WHEN input has an unknown field or an out-of-range value THE MCP_Server SHALL return `isError: true` with an input validation message.
5. WHEN a mutating call is repeated with the same `idempotency_key` THE MCP_Server SHALL return identical `structuredContent`.

### Requirement 3: Authentication boundary (pre-OAuth)
#### Acceptance Criteria
1. WHEN `/mcp` is called without a valid token THE server SHALL return 401 with a JSON body and no `WWW-Authenticate` header.
2. WHEN a token is supplied in the query string THE server SHALL return 400.
3. THE principal SHALL be derived only from the token. A Dev_Token for sam acting on maya's confirmation SHALL get `WRONG_PRINCIPAL`.

### Requirement 4: FileStore
#### Acceptance Criteria
1. WHEN state is committed THE FileStore SHALL atomically replace `<dir>/<household>.json` and append events to `<dir>/<household>.events.jsonl`.
2. IF the expected version is stale THEN THE FileStore SHALL throw `StoreConflictError` and change nothing.
3. WHEN the server restarts with the same DATA_DIR THE state SHALL be reloaded (the demo continues where it stopped).
4. IF a household id isn't a safe id THEN THE FileStore SHALL refuse it (no path traversal).

### Requirement 5: Latency and evidence
#### Acceptance Criteria
1. THE `npm run latency` script SHALL call each read tool 20 times and the ripple 5 times against a server URL (default local) and print p50/p95 per tool.
2. WHEN run locally THE p95 of every tool SHALL be below 200 ms (Alexa+ requires < 500 ms).
3. THE repo SHALL contain `docs/alexa-plus-readiness.md` mapping each Alexa+ MCP requirement to its implementation and test, with honest status (done / in progress / planned).
