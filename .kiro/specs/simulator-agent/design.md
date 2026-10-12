# Design — simulator-agent

## Overview
The agent is a thin server-side layer over the existing MCP server. It never embeds business logic: every action is one THREAD tool call made over real MCP as the signed-in person, exactly as Alexa+ would. Scripted is the deterministic default; the Bedrock live agent is an opt-in overlay that falls back to scripted on any error.

## Components (all under `server/agent/`)
- `mcp-client.ts` — `mcpClients(baseUrl, tokenFor?)`: one SDK `Client` per person connected to `baseUrl/mcp` with `Authorization: Bearer <token>` (default dev token `dev-<person>`). Exposes `call(person, name, args)`, `listTools()` and `close()`.
- `story.ts` — loads `story/story.json`, typed as `Beat[]`; `matchBeat(story, text)` normalises and matches an utterance to a beat.
- `handler.ts` — `agentHandler(deps)` returns `(device, text) => {reply, live, lens?}`:
  1. match the beat; resolve the person from the matched beat's device (falling back to the request device);
  2. if the live agent is enabled, try it and fall back on error;
  3. otherwise run the beat's tool calls — the LAST call's `structuredContent` becomes the Lens and `speak(op, data)` the reply.
  `mountAgent(app, deps)` adds `POST /api/agent`.
- `live.ts` — `runLiveAgent(mcp, person, text)`: Bedrock Converse loop. System prompt from `skills/thread/SKILL.md`; tools from `mcp.listTools()` mapped to Bedrock `toolConfig`; each `toolUse` executed via `mcp.call(person, …)` and fed back as a `toolResult`; stops on `end_turn` or a tool-round cap. A process-local per-day counter enforces `LIVE_AGENT_DAILY_CAP`. Throws on any error.

## Wiring (`server/local.ts`)
- `deviceToPerson = { echo: maya.id, phone: sam.id }` from the seed personas.
- `mountAgent(app, { mcp: mcpClients(base), deviceToPerson })`.
- `GET /api/story` serves `story.json` so the client player and e2e read one source of truth.
- `GET /voices/:file` serves an optional pre-rendered MP3 (404 when absent).

## Simulator UI (`web/sim`)
- "Play the story" button walks `/api/story` beats: set clock → send utterance to the beat's device → render the returned Lens and append the spoken line → attempt MP3/speech playback. `~90s / beats` per step.
- `data-lens-mode` on the stage mirrors the Lens mode (from the tool name, or the beat's `expected_lens_mode` during Play) so the e2e asserts modes without crossing the Lens iframe boundary.
- Typed input posts to `/api/agent` and renders `lens` when returned (previously the reply was shown but the Lens was dead).

## Voices (`scripts/voices.mjs`)
- Polly `SynthesizeSpeech`, `Engine: generative`, `OutputFormat: mp3`. `maya→Joanna`, `sam→Matthew`, everything else (THREAD/narrator/system) → `Ruth`. Writes `web/public/voices/<beat>.mp3`. No creds → message + exit 0.

## Testing
- `server/test/agent.test.ts` — the scripted agent over the real harness server: every beat produces a reply and the right-named Lens; the tournament resolves. Runs in `npm run verify`.
- `tests/golden.e2e.ts` + `playwright.config.ts` — the full browser path with the watcher: Play the story, assert the per-beat mode subsequence and the resolved end state. Server bound to `127.0.0.1`, fresh `.data-e2e`, `LIVE_AGENT` off.

## Decisions / tradeoffs
- The scripted beat ids (`ho_1`, `cf_1`) are the engine's deterministic ids on a fresh seed (confirmed by the golden fixture), so scripted calls are faithful.
- The refill's final RESOLVED is a watcher-tick outcome, present in the e2e (full demo server) but not in the harness-only unit test, which asserts PLAN_SECURED there.
- `shortcut: Bedrock toolConfig is cast at the SDK boundary` — the generated union types carry a `$unknown` member; upgrade if the SDK exports a cleaner constructor.
