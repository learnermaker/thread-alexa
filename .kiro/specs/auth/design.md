# Design Document: auth

## Overview
The architect wrote the implementation (it type-checks against the current server). **Copy these files from `../thread-prep/kiro/reference/thread-alexa-ref/` into this repo, overwriting:**
| Reference file | Purpose |
|---|---|
| `server/auth/oauth.ts` | AS: discovery, `/oauth/authorize` (picker + DEMO login_hint), `/oauth/token` (3 grants), `jwtResolver()` |
| `server/auth/keys.ts` | ES256 key: `OAUTH_PRIVATE_JWK` env → `<DATA_DIR>/oauth-key.json` → generate |
| `server/auth/principal.ts` | `Principal` = person (with scopes) or service; `devResolver`, `anyOf` |
| `server/app.ts` | mounts the AS; Tier 1 gate (only initialize / notifications/initialized / tools/list / ping) → 403 otherwise |
| `server/mcp/server.ts` | accepts `principal: undefined` for service tokens |
| `server/local.ts` | wires OAuth (client `alexa-sim`, `OAUTH_CLIENT_SECRET`, `PUBLIC_BASE_URL`, `DEMO_MODE`, `AUTH_DEV_TOKENS`) |
Then `npm install --save-exact jose@6.2.12` (already in the allowlist). Your work is the **tests** and any fixes they reveal.

## Key decisions (don't change)
- Codes and refresh tokens are **signed JWTs** with a `typ` claim (`code`, `rt`, `at`): stateless, so they work on Lambda. The RS accepts only `typ: "at"` with `aud` = RESOURCE.
- Public clients (no secret) may use only authorization_code + PKCE, never client_credentials.
- No DCR, no OIDC, no `WWW-Authenticate` on any 401.

## Test helper (`server/test/oauth-harness.ts`)
Build the app like `local.ts`, but with `memoryStore`, `fixedClock`, and keys from `loadOrCreateKeys(<temp dir under ../thread-scratchpad or os.tmpdir()>)`. Client `alexa-sim` / secret `test-secret`, redirect `http://localhost/cb`. PKCE: `verifier = randomBytes(32).toString("base64url")`, `challenge = b64sha256(verifier)` (exported from oauth.ts). Use `app.request(url, init)` (Hono's in-process fetch). Follow redirects manually: read the `Location` header, then `new URL(location).searchParams.get("code")`.

## Conformance table (one test each in `server/test/auth.test.ts`)
| # | Case | Expect |
|---|---|---|
| A1 | GET AS metadata | grants, S256, `response_types_supported:["code"]`, issuer = base |
| A2 | GET PRM (both paths) | `resource` = base+"/mcp" |
| A3 | GET jwks | one key, `kty: "EC"`, no `d` |
| A4 | client_credentials, Basic auth | 200, scope `mcp:service`, `expires_in` 3600, no `refresh_token`, `Cache-Control: no-store` |
| A5 | client_credentials via POST body secret | 200 |
| A6 | client_credentials without `resource` / wrong resource | 400 `invalid_target` |
| A7 | wrong secret | 401 `invalid_client` |
| A8 | client_credentials with scope `mcp:tools` | 400 `invalid_scope` |
| A9 | Tier 1 token: initialize + tools/list over MCP | works (8 tools) |
| A10 | Tier 1 token: tools/call | HTTP 403 `insufficient_scope` |
| A11 | authorize with login_hint=maya (DEMO) | 302 to redirect_uri with `code` and the same `state` |
| A12 | authorize GET without login_hint | 200 HTML with buttons for Maya, Sam, Rosa (not Leo) |
| A13 | authorize with plain/missing PKCE, bad resource, bad scope | 302 with `error` = invalid_request / invalid_target / invalid_scope |
| A14 | authorize with unregistered redirect_uri | 400 (no redirect) |
| A15 | code exchange happy path | access + refresh token; the access token calls `list_threads` as maya over MCP |
| A16 | code exchange with wrong verifier | 400 `invalid_grant` |
| A17 | refresh_token grant | new access token works |
| A18 | code or refresh token used as Bearer on /mcp | 401 |
| A19 | access token for another audience / expired (sign one with the same key) | 401, no WWW-Authenticate |
| A20 | golden story over MCP using Tier 2 tokens for maya and sam | all steps pass (reuse the golden test's loop) |
| A21 | `AUTH_DEV_TOKENS` off → `Bearer dev-maya` | 401 |

## Docs
Update `docs/alexa-plus-readiness.md`: the OAuth rows become **done**, each naming its test id. Add `docs/adr/0005-embedded-authorization-server.md` (hand-rolled with jose; why not Cognito or oidc-provider; stateless signed codes; limitation: refresh tokens can't be revoked early). README: a short "Sign-in (OAuth)" section with the discovery URLs, and a note that DEMO_MODE auto-consents and is disclosed.
