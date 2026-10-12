# simulator-ui — Requirements

Derived from Master Spec §D10 (simulator surface), §D2 (identity), §D12 (OAuth sign-in). The simulator is the Design-criterion surface and the honest proof that the MCP server, the embedded authorization server and the Lens App all work together. Label it **"Alexa+ experience simulator"** (§D10). Do not copy official Alexa UI assets; do not imply shipping Alexa+ hardware.

## Requirement 1 — Two devices side by side
**User story:** As a judge, I want to see Maya's Echo Show and Sam's phone at the same time, so that I can watch a commitment stay alive across two people.

#### Acceptance criteria (EARS)
1. WHEN the simulator loads THEN the system SHALL show two devices side by side: a "Kitchen Echo Show" for Maya and "Sam's phone" for Sam.
2. WHERE the Echo Show device is rendered, the system SHALL lay it out at 1280×800 (Echo Show 8 class) and scale it to fit, showing a voice-style transcript and the Lens.
3. WHERE the phone device is rendered, the system SHALL lay it out at 390×844, showing an inbox with Accept / Decline controls on each handoff item.
4. WHEN neither device has a result yet THEN the system SHALL show each device's empty state rather than an error.

## Requirement 2 — Each device signs in with the real OAuth flow
**User story:** As a judge checking the auth claim, I want each device to sign in through the real authorization server, so that the auth path I see is the one Alexa+ would use.

#### Acceptance criteria (EARS)
1. WHEN a device first needs a token THEN the system SHALL run the authorization-code + PKCE S256 flow against `/oauth/authorize` and `/oauth/token`, passing `login_hint` for that device's persona and `resource` = the canonical MCP URL.
2. WHILE DEMO_MODE auto-consent is on, the system SHALL let `login_hint` complete sign-in without a persona picker, because consent is auto-approved and disclosed.
3. WHEN a device holds a token THEN the system SHALL send it as `Authorization: Bearer <token>` on every `/mcp` call for that device, and SHALL never place the token in a query string.
4. IF a token request fails THEN the system SHALL surface the device as signed out and SHALL NOT fall back to a token-minting backdoor (there is none).

## Requirement 3 — Lens rendered through the real app-bridge
**User story:** As a judge checking the MCP Apps claim, I want the Lens to render through the real ext-apps host bridge, so that it is a true MCP Apps host, not a screenshot.

#### Acceptance criteria (EARS)
1. WHEN the Echo Show device mounts THEN the system SHALL load the Lens resource (served at `/lens`) in an iframe and connect to it with an ext-apps `AppBridge` over `PostMessageTransport`.
2. WHEN a tool result arrives for Maya's device THEN the system SHALL set the host context tool name and SHALL send the result to the Lens with `sendToolResult`, so the Lens renders the matching mode.
3. WHERE the Lens iframe has not initialized, the system SHALL queue the first result and send it once the Lens signals initialized, so no first result is lost.

## Requirement 4 — Under-the-hood drawer
**User story:** As a judge checking the Tech criterion, I want to see the live MCP request log, so that I can confirm every action is a real tool call.

#### Acceptance criteria (EARS)
1. WHEN the user opens the "under the hood" drawer THEN the system SHALL show the live MCP request log from `/api/log` (tool, latency ms, ok/error) and SHALL refresh it as new calls arrive.
2. WHERE a logged call errored, the system SHALL show its error code.

## Requirement 5 — Clock controls
**User story:** As a presenter, I want to move the demo clock, so that I can trigger the Saturday-morning ripple on cue.

#### Acceptance criteria (EARS)
1. WHEN the simulator loads THEN the system SHALL read the current demo time and preset list from `/api/clock`.
2. WHEN the user picks a preset or sets a time THEN the system SHALL POST it to `/api/clock` and SHALL reflect the new time, so the watcher re-evaluates.

## Requirement 6 — Agent badge, typed input, and reset
**User story:** As a judge, I want honesty about which agent is running and a way to drive it by typing, so that the demo always works and never overstates itself.

#### Acceptance criteria (EARS)
1. WHERE the simulator header is rendered, the system SHALL show a badge reading "Scripted agent" when no live agent is active and "Live agent" when one is.
2. WHEN the user types a line and submits it THEN the system SHALL always accept it (mic input is optional and never a dependency).
3. WHEN the user triggers "Reset demo" THEN the system SHALL POST `/api/reset` and SHALL reseed the household to the opening state.

## Requirement 7 — Built and served by the same Hono app
**User story:** As an operator, I want one service to serve the SPA and the API, so that one URL is the whole live judge link.

#### Acceptance criteria (EARS)
1. WHEN the SPA is built THEN the system SHALL emit a single-file bundle to `web/dist/` and SHALL NOT commit `web/dist*`.
2. WHEN the Hono app receives `GET /` THEN the system SHALL serve the built simulator SPA (or a clear "not built yet" placeholder when the bundle is absent).
3. WHEN `npm run verify` runs THEN the system SHALL pass (contract, deps, secrets, wording, typecheck including `web/tsconfig.json`, tests).
