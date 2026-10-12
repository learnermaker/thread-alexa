# Requirements — simulator-agent

Derived from Master Spec §D10 (Alexa+ experience simulator), §E1 (the demo beats) and §D14 (the golden story). The simulator-agent turns a typed utterance into real THREAD tool calls made as the signed-in person, and plays the whole E1 story end to end.

## R1 — One agent endpoint
- WHEN the simulator POSTs `{device, text}` to `/api/agent`, THE SYSTEM SHALL return `{reply, live, lens?}` where `reply` is a short spoken-style summary, `live` is whether the Bedrock agent produced it, and `lens` (when present) is `{toolName, structuredContent}` for the Lens.
- IF `device` or `text` is missing, THEN THE SYSTEM SHALL respond `400 {error}`.

## R2 — Acts as the signed-in person over real MCP
- THE SYSTEM SHALL make every THREAD tool call through a real MCP SDK `Client` connected to its own `/mcp`, with the acting person's bearer token — never by calling core directly and never by trusting identity in the request body.
- Echo = Maya and phone = Sam, resolved from the seed personas; a tool call runs as that device's person.

## R3 — Scripted agent (default, deterministic)
- WHEN the live agent is not enabled, THE SYSTEM SHALL match the utterance to a `story.json` beat and make exactly that beat's tool calls, in order.
- THE SYSTEM SHALL route each beat to its own device's person (so Sam answers his own handoff).
- IF no beat matches, THEN THE SYSTEM SHALL return a safe fallback reply and no Lens.

## R4 — Live agent (opt-in, self-healing)
- WHEN `LIVE_AGENT=true` AND AWS credentials resolve, THE SYSTEM SHALL run Bedrock Converse with tool use: model `BEDROCK_MODEL_ID` (default `us.anthropic.claude-haiku-5-5`), system prompt = `skills/thread/SKILL.md`, tools = the eight THREAD MCP tools.
- THE SYSTEM SHALL enforce the AWS-section rate limit via `LIVE_AGENT_DAILY_CAP` (default 50) per day.
- IF any live-agent error occurs (no creds, cap reached, model/tool error), THEN THE SYSTEM SHALL fall back to the scripted agent so the demo never breaks.

## R5 — Play the story
- WHEN the user clicks "Play the story", THE SYSTEM SHALL run every beat in order, setting the demo clock to each beat's time and routing each utterance to its device, completing in about 90 seconds.
- THE SYSTEM SHALL drive the Lens to each beat's mode and append the spoken line to the device transcript.

## R6 — Voices
- WHEN `npm run voices` runs with AWS credentials, THE SYSTEM SHALL synthesize each beat's spoken line with Amazon Polly (generative engine), THREAD in voice "Ruth" and Maya and Sam in distinct voices, writing `web/public/voices/<beat>.mp3`.
- IF no credentials are configured, THEN THE SYSTEM SHALL print a clear message and exit 0 without failing.
- Playback SHALL prefer the pre-rendered MP3 and fall back to the browser's speech synthesis.

## R7 — Golden e2e
- WHEN `npm run e2e` runs, THE SYSTEM SHALL start the real demo server, reset the demo, play the story, and assert the Lens visited each beat's expected mode in order and the end state is Tournament RESOLVED, Refill RESOLVED, Dinner PLAN_SECURED.
- THE SYSTEM SHALL run `npx playwright install chromium` before the first e2e run.

## R8 — Verify stays green
- THE SYSTEM SHALL keep `npm run verify` green: the scripted agent is covered by a server test over real MCP; the live agent and e2e do not run in `verify`.
