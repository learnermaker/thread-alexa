# Requirements Document: auth

## Introduction
An embedded, offline-capable OAuth authorization server plus resource-server checks that implement the **Alexa+ MCP auth checklist** (Master Spec §B6, §D12). Local runs still need no cloud account. Dev tokens stay available for tests and the Inspector proof, and are disabled on AWS.

## Glossary
- **AS**: the authorization server (`server/auth/oauth.ts`). **RS**: the `/mcp` endpoint.
- **Tier 1**: `client_credentials` token, scope `mcp:service`. **Tier 2**: `authorization_code` + PKCE token, scopes `mcp:tools` / `mcp:resources`.
- **RESOURCE**: the canonical MCP URL, `${PUBLIC_BASE_URL}/mcp`.

## Requirements
### Requirement 1: Discovery
1. THE AS SHALL serve `/.well-known/oauth-authorization-server` with `grant_types_supported` ⊇ {authorization_code, client_credentials, refresh_token}, `response_types_supported: ["code"]`, `code_challenge_methods_supported: ["S256"]`, and no OIDC fields.
2. THE RS SHALL serve RFC 9728 metadata at `/.well-known/oauth-protected-resource` (and `/.well-known/oauth-protected-resource/mcp`) with `resource` = RESOURCE and `authorization_servers` = [issuer].
3. THE AS SHALL serve its public signing key at `/oauth/jwks` (ES256), with no private fields.

### Requirement 2: Tier 1
1. WHEN `client_credentials` is requested with valid client auth (HTTP Basic or POST body) and `resource` = RESOURCE THE AS SHALL return a Bearer token with `expires_in` ≤ 3600, scope `mcp:service`, and no refresh token.
2. IF `resource` is missing or different THEN THE AS SHALL return 400 `invalid_target`. IF the client secret is wrong THEN 401 `invalid_client`. IF a scope other than `mcp:service` is requested THEN 400 `invalid_scope`.
3. WHEN a Tier 1 token calls `initialize` or `tools/list` THE RS SHALL allow it. WHEN it calls `tools/call` or `resources/read` THE RS SHALL return 403 `insufficient_scope`.

### Requirement 3: Tier 2
1. WHEN `/oauth/authorize` gets a valid request (registered client + exact redirect_uri, `response_type=code`, S256 challenge, `resource` = RESOURCE, Tier 2 scopes) THE AS SHALL show a person picker, or with DEMO_MODE `login_hint=<person>` redirect immediately with `code` and `state`.
2. WHEN the code is exchanged with the matching `code_verifier`, `redirect_uri` and `resource` THE AS SHALL return an access token (aud = RESOURCE, sub = person) and a refresh token. A wrong verifier, a reused code from another client, or an expired code SHALL give 400 `invalid_grant`.
3. WHEN a refresh token is exchanged THE AS SHALL return a new access token for the same person and scopes.
4. A code or refresh token SHALL never be accepted as an access token at the RS.

### Requirement 4: Resource server
1. WHEN `/mcp` gets no token, an expired token, a token for another audience, or a malformed token THE RS SHALL return 401 with no `WWW-Authenticate` header.
2. WHEN a token is sent in the query string THE RS SHALL return 400.
3. WHEN a Tier 2 token calls tools THE golden story SHALL behave exactly as with dev tokens (identity from `sub`).
4. WHEN `AUTH_DEV_TOKENS` is not `true` THE RS SHALL reject `Bearer dev-*` tokens.
