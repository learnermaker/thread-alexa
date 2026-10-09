# Design Document: demo-world

## Overview
Replace `fakeCalendar()` and `fakeServiceProvider()` from thread-core/testkit in `server/local.ts` with demo connectors that keep observable state: calendar blocks per person, pharmacy order status, weather events. A watcher ties them together on every clock jump, and four API routes let the simulator (and a human) drive the demo.

## Architecture
```text
Simulator / "Play the story"
   │  POST /api/clock { preset: "Sat 07:05" }
   ▼
/api/clock handler
   │  clock.set(iso)
   │  watcher.onClockChange(iso)
   │    ├─ weather: emit TRAVEL_TIME_CHANGED if due
   │    │    └─ core.ingestSignal(signal)  (as system principal)
   │    └─ core.tick()                     (as system principal)
   │  return { iso, presets }
   ▼
/api/inbox?person=sam  ──▶  core.inbox(as person)
/api/reset             ──▶  re-seed store + reset clock + clear watcher state
/api/log               ──▶  last 50 onCall entries (same array as the simulator drawer)
```

## Files
| File | What |
|---|---|
| `server/world/calendar.ts` | `demoCalendar(): CalendarConnector` — in-memory Map per person |
| `server/world/pharmacy.ts` | `demoPharmacy(cfg, clock): ServiceProvider` — seeded quote, scripted delivery |
| `server/world/weather.ts` | `WeatherSchedule` — list of timed signals, `due(now)` returns unfired ones |
| `server/world/watcher.ts` | `createWatcher(core, weather)` — `onClockChange(iso)` ingests signals then ticks |
| `server/world/index.ts` | Barrel export |
| `story/story.json` | E1 beats with tool_calls consistent with the golden fixture |

## Demo calendar connector
- In-memory `Map<string, { person_id, title, start, end, ref }>` keyed by `ref`.
- `createBlock`: upsert by `ref`, return `block_id = "cal_" + ref`. Idempotent.
- `moveBlock`: find by `block_id`, update `start`/`end`.
- `verifyBlock`: find by `block_id`, compare `start`/`end`.
- Exposes `blocks` for test inspection.

## Demo pharmacy connector
Implements `ServiceProvider`:
- `id`, `name`, `handles` from seed config.
- `query()`: return the fixed `quote` from config (slot, amount, currency, summary built from config).
- `act()`: store `order_ref → order_id`, return the `order_id`.
- `verify()`: if `clock.now() >= delivered_at` return `{ state: "DELIVERED", delivered_at }`; else `{ state: "PLACED" }`.
- Exposes `orders` for test inspection.

## Weather schedule
A simple array of `{ at: string, signal: IngestSignalInput }` entries. One entry for the rain:
```
{ at: "2026-10-10T07:05:00-07:00", signal: { type: "TRAVEL_TIME_CHANGED", place: "place_riverside", minutes: 40, cause: "heavy rain", source_id: "wx_sat_0705" } }
```
`due(now)` returns signals whose `at <= now` that haven't been fired yet. Tracks fired source_ids.

## Watcher
`createWatcher(core, weather)`:
- `onClockChange(iso)`: calls `weather.due(iso)` → for each, `core.ingestSignal(systemPrincipal, { signal })`. Then `core.tick(systemPrincipal, {})`.
- `reset()`: clears weather fired state.

## API routes (added to buildHttpApp or local.ts)
The routes are added in `server/local.ts` because they are demo-only (the deployed Lambda doesn't need them — the simulator calls through MCP).

### Clock presets
```ts
const PRESETS: Record<string, string> = {
  "Thu 19:30": "2026-10-08T19:30:00-07:00",
  "Sat 07:05": "2026-10-10T07:05:00-07:00",
  "Sat 08:21": "2026-10-10T08:21:00-07:00",
  "Sat 10:42": "2026-10-10T10:42:00-07:00",
};
```

## Decisions made by the developer
1. **Connectors in `server/world/`** rather than a separate package. They're demo-only; the deployed Lambda uses the same `fakeCalendar` / `fakeServiceProvider` unless upgraded.
2. **API routes in `local.ts`** not in `app.ts`. The `/api/*` routes are simulator-facing, not MCP-facing. They don't need auth. Keeping them in `local.ts` avoids polluting the production app shape.
3. **Weather schedule is static** (one entry). Extensible by adding to the array.
4. **Watcher is synchronous per clock change.** No timers. The simulator drives time via POST /api/clock.
5. **`story/story.json` is separate from the golden fixture.** It adds presentation metadata; the golden fixture is the canonical engine test. The story references the same operations.

## Don'ts
- Don't edit `fixtures/golden/**`, `scripts/**`, `.kiro/steering/**`, `.kiro/hooks/**`.
- Don't add npm dependencies.
- Don't add tools or change tool schemas.
- Don't use `Date.now()` or `Math.random()` in demo code.
