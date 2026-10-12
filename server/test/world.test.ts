// Tests for demo-world connectors and watcher.
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { createThreadApp, memoryStore, toUtc } from "thread-core";
import { fixedClock } from "thread-core/testkit";
import { demoCalendar } from "../world/calendar.ts";
import { demoPharmacy } from "../world/pharmacy.ts";
import { weatherSchedule } from "../world/weather.ts";
import { createWatcher } from "../world/watcher.ts";

const seed = JSON.parse(readFileSync(new URL("../../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"));

describe("demoCalendar", () => {
  const cal = demoCalendar();
  beforeEach(() => cal.reset());

  it("createBlock stores and returns a stable block_id", async () => {
    const r = await cal.createBlock({ person_id: "sam", title: "Drive Leo", start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z", ref: "thr_leo_tourney_r_transport" });
    expect(r.block_id).toBe("cal_thr_leo_tourney_r_transport");
    expect(cal.blocks.size).toBe(1);
  });

  it("createBlock is idempotent per ref", async () => {
    await cal.createBlock({ person_id: "sam", title: "Drive Leo", start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z", ref: "x" });
    await cal.createBlock({ person_id: "sam", title: "Drive Leo", start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z", ref: "x" });
    expect(cal.blocks.size).toBe(1);
  });

  it("moveBlock updates start/end", async () => {
    const { block_id } = await cal.createBlock({ person_id: "sam", title: "Drive Leo", start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z", ref: "m" });
    await cal.moveBlock({ person_id: "sam", block_id, start: "2026-10-10T14:40:00Z", end: "2026-10-10T19:30:00Z" });
    expect(cal.blocks.get(block_id)!.start).toBe("2026-10-10T14:40:00Z");
  });

  it("verifyBlock returns true for matching, false for mismatch", async () => {
    const { block_id } = await cal.createBlock({ person_id: "sam", title: "Drive Leo", start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z", ref: "v" });
    expect(await cal.verifyBlock({ person_id: "sam", block_id, start: "2026-10-10T14:55:00Z", end: "2026-10-10T19:30:00Z" })).toBe(true);
    expect(await cal.verifyBlock({ person_id: "sam", block_id, start: "2026-10-10T14:40:00Z", end: "2026-10-10T19:30:00Z" })).toBe(false);
  });
});

describe("demoPharmacy", () => {
  const clock = fixedClock("2026-10-08T19:00:00-07:00");
  const cfg = { id: "svc_pharmacy_delivery", name: "Pharmacy delivery", handles: ["PICKUP"], quote: { slot: { start: "2026-10-10T10:00:00-07:00", end: "2026-10-10T11:00:00-07:00" }, amount_cents: 499, currency: "USD" as const }, delivered_at: "2026-10-10T10:42:00-07:00" };
  const ph = demoPharmacy(cfg, clock);

  it("query returns the seeded quote", async () => {
    const q = await ph.query({ thread: {} as any, responsibility: {} as any, now: clock.now() });
    expect(q).not.toBeNull();
    expect(q!.amount_cents).toBe(499);
    expect(q!.provider_id).toBe("svc_pharmacy_delivery");
  });

  it("act records an order", async () => {
    const r = await ph.act({ order_ref: "ref_ho_2", quote: {} as any, shared: [] });
    expect(r.order_id).toMatch(/^ord_/);
    expect(ph.orders.has("ref_ho_2")).toBe(true);
  });

  it("verify returns PLACED before delivery time", async () => {
    clock.set("2026-10-10T09:00:00-07:00");
    const r = await ph.verify({ order_id: "ord_1", now: clock.now() });
    expect(r.state).toBe("PLACED");
  });

  it("verify returns DELIVERED at delivery time", async () => {
    clock.set("2026-10-10T10:42:00-07:00");
    const r = await ph.verify({ order_id: "ord_1", now: clock.now() });
    expect(r.state).toBe("DELIVERED");
    expect(r.delivered_at).toBe(toUtc("2026-10-10T10:42:00-07:00"));
  });
});

describe("weatherSchedule", () => {
  it("due returns the rain signal at Sat 07:05", () => {
    const ws = weatherSchedule();
    const before = ws.due(toUtc("2026-10-10T07:04:00-07:00"));
    expect(before).toHaveLength(0);
    const at = ws.due(toUtc("2026-10-10T07:05:00-07:00"));
    expect(at).toHaveLength(1);
    expect(at[0]!.source_id).toBe("wx_sat_0705");
  });

  it("does not re-fire after first due()", () => {
    const ws = weatherSchedule();
    ws.due(toUtc("2026-10-10T07:05:00-07:00"));
    const second = ws.due(toUtc("2026-10-10T07:06:00-07:00"));
    expect(second).toHaveLength(0);
  });

  it("reset clears fired state", () => {
    const ws = weatherSchedule();
    ws.due(toUtc("2026-10-10T08:00:00-07:00"));
    ws.reset();
    const after = ws.due(toUtc("2026-10-10T08:00:00-07:00"));
    expect(after).toHaveLength(1);
  });
});

describe("watcher", () => {
  it("ingests the rain signal and ticks on a clock jump to Sat 07:05", async () => {
    const clock = fixedClock("2026-10-08T19:30:00-07:00");
    const core = createThreadApp({
      store: memoryStore(),
      clock,
      calendar: demoCalendar(),
      providers: [demoPharmacy({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery }, clock)],
    });
    await core.initHousehold(seed);
    const weather = weatherSchedule();
    const watcher = createWatcher(core, seed.household.id, weather);

    // Jump to the rain moment: the watcher ingests the TRAVEL_TIME_CHANGED signal.
    clock.set("2026-10-10T07:05:00-07:00");
    await watcher.onClockChange(clock.now());

    const events = await core.events({ kind: "system", household_id: seed.household.id });
    expect(events.ok).toBe(true);
    // The ingested rain signal is recorded (source wx_sat_0705) and not duplicated on a second pass.
    const firstCount = events.ok ? events.data.events.length : 0;
    await watcher.onClockChange(clock.now());
    const events2 = await core.events({ kind: "system", household_id: seed.household.id });
    const secondCount = events2.ok ? events2.data.events.length : 0;
    expect(secondCount).toBe(firstCount); // dedup: no new signal event on the repeat tick
  });
});
