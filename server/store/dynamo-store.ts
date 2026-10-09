// DynamoStore: thread-core's Store port on DynamoDB single-table design (§D11).
// PK = HH#<hh>, SK = STATE (versioned state) or EVENT#<seq> (append-only log).
// Selected when TABLE_NAME is set; otherwise FileStore is used (zero-credential local run).
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { StoreConflictError, type HouseholdState, type Store, type ThreadEvent } from "thread-core";

export interface DynamoStoreClient {
  send(command: unknown): Promise<unknown>;
}

export function dynamoStore(tableName: string, client: DynamoStoreClient): Store {
  const pk = (hh: string) => `HH#${hh}`;

  return {
    async load(hh) {
      const res = await client.send(new GetCommand({ TableName: tableName, Key: { pk: pk(hh), sk: "STATE" } })) as { Item?: { state: HouseholdState; version: number } };
      return res.Item ? { state: res.Item.state, version: res.Item.version } : undefined;
    },

    async commit(hh, state, expectedVersion, events) {
      const version = expectedVersion + 1;
      const items: Array<{ Put: { TableName: string; Item: Record<string, unknown>; ConditionExpression?: string; ExpressionAttributeValues?: Record<string, unknown> } }> = [
        {
          Put: {
            TableName: tableName,
            Item: { pk: pk(hh), sk: "STATE", version, state },
            ConditionExpression: "attribute_not_exists(pk) OR version = :v",
            ExpressionAttributeValues: { ":v": expectedVersion },
          },
        },
      ];
      for (let i = 0; i < events.length; i++) {
        const seq = String(expectedVersion * 1000 + i).padStart(8, "0");
        items.push({
          Put: { TableName: tableName, Item: { pk: pk(hh), sk: `EVENT#${seq}`, event: events[i] } },
        });
      }
      try {
        await client.send(new TransactWriteCommand({ TransactItems: items }));
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "TransactionCanceledException") throw new StoreConflictError();
        throw err;
      }
      return version;
    },

    async events(hh) {
      const res = await client.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk(hh), ":prefix": "EVENT#" },
        ScanIndexForward: true,
      })) as { Items?: Array<{ event: ThreadEvent }> };
      return (res.Items ?? []).map((item) => item.event);
    },
  };
}
