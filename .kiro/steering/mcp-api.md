---
inclusion: fileMatch
fileMatchPattern: ["server/mcp/**", "server/app.ts", "server/test/**"]
---
# MCP API card (verified by executed spikes; use exactly these patterns)

- **Stateless Streamable HTTP + JSON responses:** a new `McpServer` and a new `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })` **per request**; `await server.connect(transport); return transport.handleRequest(c.req.raw);`
- Imports: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`; the transport from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`; `registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server`; the client side uses `Client` (`sdk/client/index.js`) + `StreamableHTTPClientTransport` (`sdk/client/streamableHttp.js`).
- **Schemas:** `inputSchema: operations[op].input`, `outputSchema: operations[op].output`. Use the **full zod object, never `.shape`** (`.shape` loses strict mode, so `additionalProperties: false` disappears).
- **Success:** `{ content: [{ type: "text", text: speak(op, data) }], structuredContent: data }`.
- **Domain error:** `{ isError: true, content: [{ type: "text", text: "<message> Next: <steps>." }, { type: "text", text: JSON.stringify({ error }) }] }`, with **NO structuredContent** (the SDK client validates it against outputSchema even when isError is true and throws -32602).
- Invalid input: the SDK itself returns `isError: true` ("Input validation error"). Don't pre-validate.
- Every tool gets `_meta: { ui: { resourceUri: "ui://thread/lens" } }` via `registerAppTool`. The resource is served with `mimeType: RESOURCE_MIME_TYPE` (`text/html;profile=mcp-app`).
- The negotiated protocol must be `2025-11-25` (assert `transport.protocolVersion` in tests).
