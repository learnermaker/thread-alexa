# ADR 0002: Stateless Streamable HTTP with JSON responses

## Context

Alexa+ requires MCP over Streamable HTTP. The deployment target is AWS Lambda, which is stateless and does not support long-lived SSE connections between invocations.

## Decision

Use `WebStandardStreamableHTTPServerTransport` with `{ sessionIdGenerator: undefined, enableJsonResponse: true }`. A new transport instance is created **per request** (no session state between calls).

## Alternatives

- SSE transport: requires a persistent connection; incompatible with Lambda's stateless invocation model.
- Stateful Streamable HTTP (with session IDs): adds state management complexity with no benefit for single-turn tool calls.

## Consequences

Every request goes through a fresh MCP initialization handshake. This is a small, acceptable overhead (< 5 ms locally) and avoids all session-affinity problems. JSON responses (not SSE) are returned, which simplifies Lambda's response handling.
