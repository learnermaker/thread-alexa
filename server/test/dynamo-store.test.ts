// Unit tests for DynamoStore using an in-memory fake of the DocumentClient calls.
import { describe, expect, it } from "vitest";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { StoreConflictError, type HouseholdState, type ThreadEvent } from "thread-core";
import { dynamoStore, type DynamoStoreClient } from "../store/dynamo-store.ts";

// Minimal in-memory fake that mimics Get, Query, and TransactWrite for the single-table design.
function fakeClient(): DynamoStoreClient {
  const items = new Map<string, Record<string, unknown>>(); // key = pk|sk
  const key = (pk: string, sk: string) => `${pk}|${sk}`;

  return {
    async send(command: unknown) {
      if (command instanceof GetCommand) {
        const input = command.input;
        const item = items.get(key(input.Key!["pk"] as string, input.Key!["sk"] as string));
        return { Item: item ? { ...item } : undefined };
      }
      if (command instanceof QueryCommand) {
        const input = command.input;
        const pkVal = (input.ExpressionAttributeValues as Record<string, string>)[":pk"]!;
        const prefix = (input.ExpressionAttributeValues as Record<string, string>)[":prefix"]!;
        const matching: Array<Record<string, unknown>> = [];
        for (const [k, v] of items) {
          if (k.startsWith(`${pkVal}|${prefix}`)) matching.push({ ...v });
        }
        matching.sort((a, b) => String(a["sk"]).localeCompare(String(b["sk"])));
        return { Items: matching };
      }
      if (command instanceof TransactWriteCommand) {
        const transactItems = command.input.TransactItems!;
        // Check conditions first (all or nothing)
        for (const item of transactItems) {
          const put = item.Put!;
          const pk = put.Item!["pk"] as string;
          const sk = put.Item!["sk"] as string;
          if (put.ConditionExpression) {
            const existing = items.get(key(pk, sk));
            if (existing) {
              // condition: attribute_not_exists(pk) OR version = :v
              const expectedVersion = (put.ExpressionAttributeValues as Record<string, number>)[":v"];
              if (existing["version"] !== expectedVersion) {
                const err = new Error("Transaction cancelled") as Error & { name: string };
                err.name = "TransactionCanceledException";
                throw err;
              }
            }
            // if not existing, attribute_not_exists passes
          }
        }
        // All conditions passed, apply all puts
        for (const item of transactItems) {
          const put = item.Put!;
          const pk = put.Item!["pk"] as string;
          const sk = put.Item!["sk"] as string;
          items.set(key(pk, sk), { ...put.Item! });
        }
        return {};
      }
      throw new Error(`Unexpected command: ${(command as { constructor: { name: string } }).constructor.name}`);
    },
  };
}

const TABLE = "test-table";

// A minimal valid HouseholdState for testing (the store treats it as an opaque blob).
const sampleState: HouseholdState = {
  household: { id: "hh_test", name: "Test", timezone: "America/Los_Angeles", persons: [] },
  threads: [],
  facts: [],
  handoffs: [],
  evidence: [],
} as unknown as HouseholdState;

const sampleEvent: ThreadEvent = {
  seq: 0,
  at: "2026-10-09T09:00:00Z",
  type: "HOUSEHOLD_INITIALIZED",
  household_id: "hh_test",
  data: {},
} as unknown as ThreadEvent;

describe("DynamoStore", () => {
  it("load returns undefined for a missing household", async () => {
    const store = dynamoStore(TABLE, fakeClient());
    expect(await store.load("hh_missing")).toBeUndefined();
  });

  it("commit creates state and events, then load returns them", async () => {
    const store = dynamoStore(TABLE, fakeClient());
    const v = await store.commit("hh_test", sampleState, 0, [sampleEvent]);
    expect(v).toBe(1);
    const loaded = await store.load("hh_test");
    expect(loaded).toBeDefined();
    expect(loaded!.version).toBe(1);
    expect(loaded!.state.household.id).toBe("hh_test");
  });

  it("commit with wrong expectedVersion throws StoreConflictError", async () => {
    const store = dynamoStore(TABLE, fakeClient());
    await store.commit("hh_test", sampleState, 0, []);
    await expect(store.commit("hh_test", sampleState, 0, [])).rejects.toThrow(StoreConflictError);
  });

  it("events returns events sorted by sequence", async () => {
    const store = dynamoStore(TABLE, fakeClient());
    const ev1 = { ...sampleEvent, seq: 0 };
    const ev2 = { ...sampleEvent, seq: 1 };
    await store.commit("hh_test", sampleState, 0, [ev1, ev2]);
    const events = await store.events("hh_test");
    expect(events).toHaveLength(2);
    expect(events[0]!.seq).toBe(0);
    expect(events[1]!.seq).toBe(1);
  });

  it("second commit increments version", async () => {
    const store = dynamoStore(TABLE, fakeClient());
    const v1 = await store.commit("hh_test", sampleState, 0, [sampleEvent]);
    expect(v1).toBe(1);
    const v2 = await store.commit("hh_test", sampleState, 1, []);
    expect(v2).toBe(2);
    const loaded = await store.load("hh_test");
    expect(loaded!.version).toBe(2);
  });
});
