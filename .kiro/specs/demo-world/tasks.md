# Implementation Plan: demo-world

## Overview
Demo connectors, watcher, clock/inbox/reset/log APIs, story file, tests. Wire into local.ts.

## Tasks

- [x] 1. Demo connectors
  - [x] 1.1 Create `server/world/calendar.ts` per design.md
  - [x] 1.2 Create `server/world/pharmacy.ts` per design.md
  - [x] 1.3 Create `server/world/weather.ts` per design.md
  - [x] 1.4 Create `server/world/watcher.ts` per design.md
  - [x] 1.5 Create `server/world/index.ts` barrel export
    - **Done when:** `npx tsc --noEmit` passes
    - _Requirements: 1, 2, 3_

- [x] 2. Wire local.ts
  - [x] 2.1 Replace `fakeCalendar()` with `demoCalendar()`
  - [x] 2.2 Replace `fakeServiceProvider(...)` with `demoPharmacy(..., clock)`
  - [x] 2.3 Create watcher from `createWatcher(core, weather)`
  - [x] 2.4 Add `/api/clock` GET and POST routes with presets and watcher
  - [x] 2.5 Add `/api/inbox` GET route
  - [x] 2.6 Add `/api/reset` POST route
  - [x] 2.7 Add `/api/log` GET route
    - **Done when:** `npm run demo` starts, `/api/clock` returns the time and presets, `/api/inbox?person=sam` returns messages
    - _Requirements: 4, 5_

- [x] 3. Story file
  - [x] 3.1 Create `story/story.json` with every E1 beat, consistent with the golden fixture
    - **Done when:** the file parses as JSON and tool_calls match ripple-story.json operations
    - _Requirements: 6_

- [x] 4. Tests
  - [x] 4.1 Create `server/test/world.test.ts`: demo calendar (create/move/verify/idempotent), pharmacy (query/act/verify before and after delivery time), weather (due signals, dedup), watcher (ingestSignal + tick on clock change)
    - **Done when:** `npx vitest run server/test/world.test.ts` passes
    - _Requirements: 1, 2, 3_

- [ ] 5. Verify and commit
  - [x] 5.1 `npm run verify` → VERIFY PASSED (green across the whole tree once parallel Phase 5 committed; see BLOCKED.md)
  - [x] 5.2 Scoped commit of Phase 2 files only (NOT `git add -A`): `feat(world): demo connectors, clock, watcher, story.json`
  - [ ] 5.3 `git push`
