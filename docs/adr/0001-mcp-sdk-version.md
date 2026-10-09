# ADR 0001: MCP SDK 1.32.1 + ext-apps 1.7.5

## Context

The project requires the MCP protocol version `2025-11-25`, which is implemented in `@modelcontextprotocol/sdk` 1.x. The Alexa+ Thread Lens MCP App feature requires `@modelcontextprotocol/ext-apps` for `registerAppTool`, `registerAppResource`, and `RESOURCE_MIME_TYPE`.

## Decision

Pin `@modelcontextprotocol/sdk` at **1.32.1** and `@modelcontextprotocol/ext-apps` at **1.7.5**. Assert `transport.protocolVersion === "2025-11-25"` in tests.

## Alternatives

- ext-apps 2.x: requires SDK v2, which targets a newer protocol version not yet validated for Alexa+.
- Latest SDK 1.x: untested against the architect's verified spike; pinning avoids silent breakage.

## Consequences

Upgrades require explicit re-verification of the protocol assertion and all conformance tests. The architect controls version upgrades via the dependency allowlist.
