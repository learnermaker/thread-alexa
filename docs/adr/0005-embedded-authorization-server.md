# ADR 0005: Embedded authorization server (hand-rolled with jose)

## Context

The Alexa+ MCP auth checklist (Master Spec §B6, §D12) requires a full OAuth 2.1 flow: Tier 1 `client_credentials` for service identity and Tier 2 `authorization_code` + PKCE for a signed-in household member, plus RFC 8414 AS metadata and RFC 9728 protected-resource metadata. The server must also run **locally with no cloud account** and deploy to **AWS Lambda** (stateless, see ADR 0002). Dev bearer tokens must still work for tests and the MCP Inspector proof.

## Decision

Hand-roll a minimal authorization server (`server/auth/oauth.ts`) using only [`jose`](https://github.com/panva/jose) for ES256 JWTs. Authorization codes, refresh tokens and access tokens are all **signed JWTs** distinguished by a `typ` claim (`code` / `rt` / `at`); the resource server accepts only `typ: "at"` with `aud` = the canonical MCP URL. No persistent token store is needed, so the same code path works on Lambda.

## Alternatives

- **Amazon Cognito**: requires an AWS account and online configuration — breaks the zero-credential local run, and adds a hosted dependency for a demo.
- **`oidc-provider` (node-oidc-provider)**: a full OIDC implementation, far larger than the checklist needs (we deliberately ship no DCR and no OIDC), and it expects a backing adapter/store.

## Consequences

- Stateless and Lambda-safe: no session or token database; keys load from `OAUTH_PRIVATE_JWK` (env) → `<DATA_DIR>/oauth-key.json` → generated.
- Public clients may use only `authorization_code` + PKCE, never `client_credentials`; 401 responses carry no `WWW-Authenticate` header (Alexa+ requirement).
- **Limitation:** because refresh tokens are stateless signed JWTs, they **cannot be revoked before they expire** (30 days). Acceptable for a demo AS; the upgrade is a store-backed denylist keyed by `jti`.
- Conformance is pinned by `server/test/auth.test.ts` (A1–A21).
