# ADR 0004: Tool Schemas from thread-core; Errors Without structuredContent

## Context

Each tool maps 1:1 to a thread-core operation. Two decisions are tightly coupled: how to source schemas, and what to return on domain errors.

### Schemas

MCP requires `inputSchema` (`additionalProperties: false`) and `outputSchema` for each tool. Thread-core exports a Zod schema pair per operation via `operations[op].input` / `operations[op].output`.

### Error responses

The SDK client validates `structuredContent` against `outputSchema` even when `isError: true` (see `friction-log F6`). Domain errors from thread-core do not conform to the success output schema.

## Decisions

**Schemas:** Pass the **full Zod object** (`operations[op].input`, not `.shape`) to `registerAppTool`. Using `.shape` loses the strict-mode flag, causing `additionalProperties` to default to `true` (failing Alexa+ input validation requirements).

**Errors:** On domain error, return `{ isError: true, content: [sentence, JSON block] }` with **no `structuredContent`**. This avoids the SDK client throwing a `-32602` validation error against the output schema.

## Alternatives

- Hand-writing schemas: error-prone, diverges from core on updates.
- Including structuredContent on errors with a discriminated union output schema: complicates core schema design and was rejected by the architect.

## Consequences

Tool schemas stay in sync with core automatically. Error responses are always two text blocks (sentence + JSON) with no `structuredContent`, which is asserted in `conformance.test.ts`.
