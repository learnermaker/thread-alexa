// FileStore unit tests: atomicity, versioning, JSONL events, restart resilience, path safety.
import { readFileSync, rmSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { StoreConflictError, createThreadApp } from "thread-core";
import { fakeCalendar, fakeServiceProvider, fixedClock } from "thread-core/testkit";
import { fileStore } from "../store/file-store.ts";

const seed = JSON.parse(
  readFileSync(new URL("../../fixtures/golden/rivera-seed.json", import.meta.url), "utf8"),
);

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "thread-filestore-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("commit / load / version", () => {
  test("load returns undefined for a new household", async () => {
    const store = fileStore(dir);
    expect(await store.load("hh_test")).toBeUndefined();
  });

  test("commit then load round-trips the state and increments version", async () => {
    const store = fileStore(dir);
    const state: any = { threads: {}, members: {}, signals: [], confirmations: {} };
    const v = await store.commit("hh_test", state, 0, []);
    expect(v).toBe(1);
    const loaded = await store.load("hh_test");
    expect(loaded).toBeTruthy();
    expect(loaded!.version).toBe(1);
    expect(loaded!.state).toMatchObject(state);
  });

  test("stale version throws StoreConflictError and leaves the file unchanged", async () => {
    const store = fileStore(dir);
    const state: any = { threads: {}, members: {}, signals: [], confirmations: {} };
    await store.commit("hh_test", state, 0, []);

    const stateBefore = await store.load("hh_test");

    // Attempt commit with wrong expected version (still 0 instead of 1)
    await expect(store.commit("hh_test", { ...state, extra: true } as any, 0, [])).rejects.toThrow(StoreConflictError);

    // File must be unchanged
    const stateAfter = await store.load("hh_test");
    expect(stateAfter!.version).toBe(stateBefore!.version);
    expect(stateAfter!.state).toEqual(stateBefore!.state);
  });
});

describe("events JSONL", () => {
  test("events are appended as JSONL in order and readable back", async () => {
    const store = fileStore(dir);
    const state: any = { threads: {}, members: {}, signals: [], confirmations: {} };
    const ev1 = { type: "HOUSEHOLD_INITIALIZED", household_id: "hh_test", at: "2026-10-08T00:00:00.000Z" } as any;
    const ev2 = { type: "THREAD_CREATED", household_id: "hh_test", at: "2026-10-08T00:01:00.000Z" } as any;
    await store.commit("hh_test", state, 0, [ev1]);
    await store.commit("hh_test", { ...state, v: 2 } as any, 1, [ev2]);

    const events = await store.events("hh_test");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject(ev1);
    expect(events[1]).toMatchObject(ev2);

    // Verify raw JSONL file format: each line is a separate JSON object
    const raw = await readFile(join(dir, "hh_test.events.jsonl"), "utf8");
    const lines = raw.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject(ev1);
    expect(JSON.parse(lines[1]!)).toMatchObject(ev2);
  });

  test("no events file → events() returns empty array", async () => {
    const store = fileStore(dir);
    const state: any = { threads: {}, members: {}, signals: [], confirmations: {} };
    await store.commit("hh_test", state, 0, []); // commit with no events
    expect(await store.events("hh_test")).toEqual([]);
  });
});

describe("restart resilience", () => {
  test("new fileStore(sameDir) sees committed state and events", async () => {
    // Simulate app run 1: init the household
    const clock = fixedClock("2026-10-08T19:00:00-07:00");
    const core1 = createThreadApp({
      store: fileStore(dir), clock, calendar: fakeCalendar(),
      providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
    });
    const init = await core1.initHousehold(seed);
    expect(init.ok, "init household").toBe(true);
    const list1 = await core1.listThreads({ kind: "person", household_id: "hh_rivera", person_id: "maya" }, {});
    expect(list1.ok).toBe(true);
    const statusesBefore = (list1 as any).data.threads.map((t: any) => `${t.thread_id}:${t.status}`);

    // Simulate restart: new fileStore on same dir, new app
    const core2 = createThreadApp({
      store: fileStore(dir), clock, calendar: fakeCalendar(),
      providers: [fakeServiceProvider({ id: "svc_pharmacy_delivery", ...seed.providers.svc_pharmacy_delivery })],
    });
    const list2 = await core2.listThreads({ kind: "person", household_id: "hh_rivera", person_id: "maya" }, {});
    expect(list2.ok).toBe(true);
    const statusesAfter = (list2 as any).data.threads.map((t: any) => `${t.thread_id}:${t.status}`);

    expect(statusesAfter).toEqual(statusesBefore);
  });
});

describe("path safety", () => {
  test("household id with path traversal throws", async () => {
    const store = fileStore(dir);
    const state: any = { threads: {}, members: {}, signals: [], confirmations: {} };
    await expect(store.commit("../x", state, 0, [])).rejects.toThrow(/invalid household id/i);
    await expect(store.load("../x")).rejects.toThrow(/invalid household id/i);
  });
});
