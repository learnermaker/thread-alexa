# simulator-ui — Tasks

- [x] 1. Serve the SPA and the Lens from the Hono app
  - Add optional `simHtml` dep to `buildHttpApp`; serve `GET /` (SPA or placeholder) and `GET /lens` (reuses `lensHtml`).
  - Add `GET /api/household` returning the household id and sign-in-able persons.
  - Wire `simHtml` in `server/local.ts` and `server/lambda.ts`.
  - _Requirements: 3.1, 7.2_

- [x] 2. Simulator OAuth + MCP client (`web/sim/src/mcp.ts`)
  - PKCE S256 sign-in via `/oauth/authorize` (manual redirect) + `/oauth/token`, `login_hint` per device.
  - `mcpCall(token, method, params)` JSON-RPC to `/mcp` with `Authorization: Bearer`; never token-in-query.
  - `/api/clock`, `/api/inbox`, `/api/log`, `/api/reset`, `/api/household`, `/api/agent` helpers.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 6.3_

- [x] 3. Lens host (`web/sim/src/lens-host.tsx`)
  - Iframe `src="/lens"`, ext-apps `AppBridge` over `PostMessageTransport`, queue first result until initialized, `setHostContext` + `sendToolResult` on each result.
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. App shell and devices (`web/sim/src/{App.tsx,theme.css,types.ts,main.tsx}`)
  - Header: label "Alexa+ experience simulator", agent badge, clock controls, Reset demo.
  - Echo Show (Maya, 1280×800 scaled): transcript + Lens. Phone (Sam, 390×844): inbox + Accept/Decline.
  - Under-the-hood drawer showing `/api/log`. Typed input box that always works.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3_

- [x] 5. Build wiring and verify
  - `web/sim/index.html`, `web/sim/vite.config.ts` (singlefile, `outDir: web/dist`); add `build:sim` to `package.json`; add `sim/src` + `sim/vite.config.ts` to `web/tsconfig.json`.
  - Run `npm run verify` to VERIFY PASSED; `git add -A` (never `web/dist*`); commit `feat(sim): Alexa+ experience simulator UI`; push `crew/overnight-alexa`.
  - _Requirements: 7.1, 7.3_
