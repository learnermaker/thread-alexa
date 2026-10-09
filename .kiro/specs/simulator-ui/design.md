# simulator-ui — Design

## Overview
A Vite + React single-page app in `web/sim/`, built to a single HTML file in `web/dist/index.html` (via `vite-plugin-singlefile`, mirroring the Lens build), served by the existing Hono app at `GET /`. It is the "Alexa+ experience simulator" (§D10): two devices side by side, each signing in through the real OAuth flow (§D12), the Lens rendered through the real ext-apps `AppBridge`, a live MCP request-log drawer, clock controls, an agent badge, typed input, and a reset button.

No new runtime dependencies: it reuses `react`, `react-dom`, `@modelcontextprotocol/ext-apps` (app-bridge), `@modelcontextprotocol/sdk` and `vite-plugin-singlefile`, all already in `package.json`.

## Serving (Hono)
`buildHttpApp` gains an optional `simHtml: () => Promise<string>` dep. When set it serves:
- `GET /` → the built simulator SPA (`web/dist/index.html`), or a placeholder when the bundle is absent.
- `GET /lens` → the built Lens HTML (reuses the existing `lensHtml` dep), so the simulator can load the Lens into an iframe from a same-origin URL.

`local.ts` wires `simHtml` to read `web/dist/index.html` the same way it already reads `web/dist-lens/index.html` for `lensHtml`. The Lambda entry (aws-deploy) does the same. The `/mcp`, OAuth and `/api/*` routes are unchanged.

## Device sign-in (real OAuth code + PKCE)
Each device drives the authorization-code + PKCE S256 flow against the embedded server already implemented in `server/auth/oauth.ts`:
1. Generate a 43-char `code_verifier` (base64url of 32 random bytes) and `code_challenge = base64url(sha256(verifier))` using the Web Crypto API (`crypto.getRandomValues`, `crypto.subtle.digest`).
2. `GET /oauth/authorize?response_type=code&client_id=alexa-sim&redirect_uri=<origin>/oauth/callback&code_challenge=<cc>&code_challenge_method=S256&resource=<origin>/mcp&scope=mcp:tools&login_hint=<personId>&state=<nonce>` with `redirect: "manual"`, then read the `Location` header. DEMO auto-consent + `login_hint` make this one hop to the callback carrying `?code=…`.
3. `POST /oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`, `client_id`, `client_secret` (the demo client is confidential; the secret is the public demo secret), `resource`.
4. Hold `{access_token, refresh_token}` per device in memory; send `Authorization: Bearer` on every `/mcp` call. Never in a query string.

The two personas are Maya (`login_hint` from the seed) on the Echo Show and Sam on the phone. Person ids are read from `/api/clock`'s sibling — the sim fetches `/api/household` (added) for the id→name→device mapping, falling back to known seed ids if that call is unavailable. (We add a tiny `GET /api/household` that returns the signed-in-able persons and the household id, so the SPA has no hard-coded ids.)

## MCP calls over HTTP
A small `mcpCall(token, method, params)` posts JSON-RPC to `/mcp` with the bearer token and `Accept: application/json, text/event-stream` (the SDK's streamable-HTTP transport accepts a JSON response because the server sets `enableJsonResponse: true`). The sim calls `initialize`, `tools/list` once per device, then `tools/call` for each action. Results feed the transcript, the phone inbox and the Lens.

## Lens via the real app-bridge
On mount, the Echo Show panel:
1. Renders `<iframe src="/lens">`.
2. Creates `new AppBridge(null, { name: "alexa-sim", version: "0.1.0" }, { serverTools: {} })` and connects it with `new PostMessageTransport(iframe.contentWindow, iframe.contentWindow)`.
3. On `oninitialized`, drains a one-slot queue of the latest `{ toolName, structuredContent }`: `setHostContext({ toolInfo: { tool: { name } } })` then `sendToolResult({ structuredContent })`.
4. Each new tool result updates that slot and, if already initialized, pushes immediately. This matches how the Lens reads results (`toolresult.structuredContent` + `hostContext.toolInfo.tool.name`).

Using `AppBridge` (not a hand-rolled postMessage) is what makes the simulator a *real* MCP Apps host.

## Scripted vs live agent
The default is the scripted agent: typed utterances and the "Play the story" button map to concrete MCP tool calls (the mapping lives in the simulator-agent phase; this phase ships the UI, the typed-input box, the badge, and the `/api/agent` call-out point). The header badge reads "Scripted agent" unless `/api/agent` reports a live Bedrock agent is active. Typed input always posts to the agent endpoint and always works.

## State and polling
- Clock: `GET /api/clock` on load; `POST /api/clock` on preset/set.
- Inbox: short-poll `GET /api/inbox?person=<sam>` every 1 s (deterministic, Lambda-friendly — §D10).
- Log drawer: `GET /api/log` on open and every 1 s while open.
- Reset: `POST /api/reset`.

## Files
- `web/sim/index.html` — Vite entry.
- `web/sim/vite.config.ts` — React + singlefile, `outDir: web/dist`.
- `web/sim/src/main.tsx` — mounts the app.
- `web/sim/src/App.tsx` — layout: header (label, badge, clock, reset), two devices, drawer.
- `web/sim/src/mcp.ts` — OAuth PKCE sign-in + `mcpCall` + `/api/*` helpers.
- `web/sim/src/lens-host.tsx` — the `AppBridge` wiring and the Lens iframe.
- `web/sim/src/theme.css` — styling.
- `web/sim/src/types.ts` — shared view types.
- Edits: `server/app.ts` (add `simHtml`, serve `/` and `/lens`), `server/local.ts` and `server/lambda.ts` (wire `simHtml`, add `GET /api/household`), `web/tsconfig.json` (include `sim/src`, `sim/vite.config.ts`), `package.json` (add `build:sim`).

## Decisions
- **Single-file build** (vite-plugin-singlefile): one `web/dist/index.html` is trivial for both the Node server and Lambda to serve, no static-asset routing. Mirrors the Lens.
- **No router, no state library:** two devices and a drawer are plain React state. Smallest thing that works (§ steering).
- **`/lens` same-origin:** the Lens iframe is served from the same origin, so `PostMessageTransport(window.parent, window.parent)` on the Lens side works without cross-origin targetOrigin juggling.

## Risks / shortcuts
- `shortcut: tokens held in memory only (no refresh-on-expiry loop), re-sign-in on reload; upgrade when a demo session must outlive the access-token TTL (1 h).`
- The scripted-agent utterance→tool mapping is deliberately out of scope here (simulator-agent phase); this phase provides the typed-input box and the `/api/agent` call site.
