# Requirements Document: demo-world

## Introduction
Demo connectors, watcher, clock APIs and the story file that together make the THREAD ripple story (Master Spec E1) playable from the simulator, the golden e2e test and the video pipeline. Connectors implement thread-core ports (CalendarConnector, ServiceProvider) with seeded demo data from `fixtures/golden/rivera-seed.json`. The watcher ingests weather signals and ticks the engine on clock changes. Four HTTP API routes expose the clock, inbox, reset and MCP call log. (Master Spec D9, D3, E1, D18.1-3.)

## Glossary
- **DemoClock**: `server/clock.ts` (existing). Simulated clock for DEMO_MODE with `set(iso)`.
- **Watcher**: on every clock change, checks the weather schedule, ingests due signals via `core.ingestSignal()`, then calls `core.tick()`.
- **Preset**: a named clock position the simulator can jump to (e.g. "Sat 07:05").
- **Story**: `story/story.json`, the single source of truth for every E1 beat.

## Requirements

### Requirement 1: Demo calendar connector
#### Acceptance Criteria
1. THE demo calendar connector SHALL implement the thread-core `CalendarConnector` interface (`createBlock`, `moveBlock`, `verifyBlock`).
2. WHEN `createBlock` is called THE connector SHALL store the block per person and return a stable `block_id` derived from the `ref`.
3. WHEN `moveBlock` is called THE connector SHALL update the stored block's `start` and `end`.
4. WHEN `verifyBlock` is called THE connector SHALL return true if the block exists with matching times, false otherwise.
5. Calls SHALL be idempotent per `ref`.

### Requirement 2: Demo pharmacy connector
#### Acceptance Criteria
1. THE demo pharmacy connector SHALL implement the thread-core `ServiceProvider` interface (`query`, `act`, `verify`).
2. THE connector SHALL be configured from `seed.providers.svc_pharmacy_delivery` (quote, slot, delivered_at).
3. WHEN `query` is called THE connector SHALL return the seeded quote.
4. WHEN `act` is called THE connector SHALL record the order and return an `order_id`.
5. WHEN `verify` is called and the clock is at or past `delivered_at` THE connector SHALL return `state: "DELIVERED"` with the `delivered_at` time. Otherwise it SHALL return `state: "PLACED"`.

### Requirement 3: Weather schedule and watcher
#### Acceptance Criteria
1. THE weather schedule SHALL emit a `TRAVEL_TIME_CHANGED` signal for `place_riverside` at 40 minutes with cause "heavy rain" and source_id "wx_sat_0705" when the clock reaches Saturday 2026-10-10T07:05:00-07:00.
2. THE watcher SHALL run on every clock change: check the weather schedule for newly due signals, call `core.ingestSignal()` for each, then call `core.tick()`.
3. Duplicate signals (same `source_id`) SHALL be harmless (thread-core deduplicates).

### Requirement 4: Clock API
#### Acceptance Criteria
1. GET `/api/clock` SHALL return the current demo clock time as `{ iso, presets }` where presets is the list of named positions.
2. POST `/api/clock` with `{ preset }` or `{ iso }` SHALL set the clock, run the watcher, and return the updated clock.
3. THE presets SHALL be: "Thu 19:30" (`2026-10-08T19:30:00-07:00`), "Sat 07:05" (`2026-10-10T07:05:00-07:00`), "Sat 08:21" (`2026-10-10T08:21:00-07:00`), "Sat 10:42" (`2026-10-10T10:42:00-07:00`).

### Requirement 5: Inbox and reset APIs
#### Acceptance Criteria
1. GET `/api/inbox?person=<id>` SHALL call `core.inbox()` as that person and return the messages.
2. POST `/api/reset` SHALL re-seed the household (new store or clear + `initHousehold`), reset the clock to DEMO_START, clear the weather state, and return `{ ok: true }`.
3. GET `/api/log` SHALL return the last 50 MCP call entries (`{ tool, ms, ok, code? }`).

### Requirement 6: Story file
#### Acceptance Criteria
1. `story/story.json` SHALL contain every E1 beat as `{ id, clock, device, speaker, utterance, tool_calls, expected_lens_mode, spoken_line }`.
2. The tool calls, their arguments and their order SHALL be consistent with `fixtures/golden/ripple-story.json`.
3. THE story file SHALL NOT duplicate or replace the golden fixture; it adds presentation metadata (device, speaker, utterance, lens mode, spoken line) to the same operation sequence.
