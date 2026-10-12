# Tasks — simulator-agent

- [x] 1. MCP client factory (`server/agent/mcp-client.ts`): one SDK `Client` per person to our own `/mcp`, dev-token default; `call`, `listTools`, `close`. (R2)
- [x] 2. Story loader + matcher (`server/agent/story.ts`): typed beats from `story/story.json`; `matchBeat`. (R3)
- [x] 3. Scripted + live handler (`server/agent/handler.ts`): `agentHandler` runs the matched beat's tool calls as its person; last call drives reply + Lens; `mountAgent` adds `POST /api/agent`. (R1, R3)
- [x] 4. Live Bedrock agent (`server/agent/live.ts`): Converse tool-use loop, system from `skills/thread/SKILL.md`, daily cap, throws on error. (R4)
- [x] 5. First agent skill (`skills/thread/SKILL.md`): when/how to use the eight tools; create on commitments, report on changes, never claim resolution. (R4; polished in Phase 7)
- [x] 6. Wire `server/local.ts`: `deviceToPerson`, `mountAgent`, `GET /api/story`, `GET /voices/:file`. (R1, R2, R5, R6)
- [x] 7. Simulator UI (`web/sim`): "Play the story" player with clock jumps (~90s), render agent `lens`, `data-lens-mode` marker, MP3/speech playback. (R5)
- [x] 8. Voices (`scripts/voices.mjs` + `npm run voices`): Polly generative, Ruth/Joanna/Matthew, write `web/public/voices/<beat>.mp3`, clean no-creds exit. (R6)
- [x] 9. Golden e2e (`playwright.config.ts`, `tests/golden.e2e.ts`, `npm run e2e`): real server on loopback, play, assert mode subsequence + resolved end state. (R7)
- [x] 10. Scripted-agent server test (`server/test/agent.test.ts`), kept in `npm run verify`. (R8)

**Done when:** `npm run verify` → VERIFY PASSED; `npx playwright install chromium` then `npm run e2e` passes; committed and pushed on `crew/overnight-alexa`.
