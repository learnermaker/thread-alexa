# Design Document: aws-deploy

## Overview
One CDK stack deploys the entire THREAD application to AWS. The Hono app reuses its local shape; only the Store and the entry point change. `npm run synth` proves the IaC is valid offline; `npm run deploy` is the live command (run by a human, never by automation).

## DynamoStore (`server/store/dynamo-store.ts`)
Implements `Store` from `thread-core` using `@aws-sdk/lib-dynamodb` (`DynamoDBDocumentClient`).

**Table shape** (single table, §D11 v2.3):
| PK | SK | Content |
|---|---|---|
| `HH#<hh>` | `STATE` | `{ version, state }` (the full `HouseholdState`) |
| `HH#<hh>` | `EVENT#<seq>` | one `ThreadEvent` (seq is zero-padded 8 digits) |

- `load(hh)`: `GetCommand({ pk: "HH#<hh>", sk: "STATE" })`. Returns `{ state, version }` or `undefined`.
- `commit(hh, state, expectedVersion, events)`: `TransactWriteItems` with:
  - Put `STATE` item with condition `attribute_not_exists(pk) OR version = :v` (handles create + update).
  - Put one `EVENT#<seq>` item per event (seq = expectedVersion * 1000 + index, zero-padded to 8 digits).
  - On `TransactionCanceledException` with `ConditionalCheckFailed`: throw `StoreConflictError`.
- `events(hh)`: `QueryCommand` with `pk = "HH#<hh>"` and `sk begins_with "EVENT#"`, sorted ascending by SK.

The factory: `dynamoStore(tableName: string, client?: DynamoDBDocumentClient): Store`.

## Lambda entry (`server/lambda.ts`)
```ts
import { handle } from "hono/aws-lambda";
// Build the Hono app the same way local.ts does, but:
// - Store: dynamoStore(TABLE_NAME) when TABLE_NAME is set, else fileStore("/tmp/.data")
// - OAuth keys: from OAUTH_JWK_JSON env var (injected by CDK from SSM at deploy time)
// - Client secret: from OAUTH_CLIENT_SECRET env var
// - AUTH_DEV_TOKENS: "false"
// - DEMO_MODE: from env (default "true")
// - Lens HTML: read from bundled assets
export const handler = handle(app);
```

## CDK stack (`infra/stack.ts`, entry `infra/app.ts`)

**`infra/tsconfig.json`**: extends nothing, targets ES2024, module nodenext, strict, noEmit, includes `infra/`.

**Stack (`ThreadAlexaStack`):**
1. **DynamoDB Table**: `thread-state`, PK `pk` (S), SK `sk` (S), billing PROVISIONED 5/5, ttl on `ttl` attribute, removal policy DESTROY.
2. **SSM Parameters**: `/thread/oauth-jwk` (String) and `/thread/oauth-client-secret` (String). Values are CfnParameter defaults (replaced at deploy time).
3. **Lambda** (NodejsFunction): runtime nodejs24.x, architecture arm64, memory 512, timeout 10s, entry `server/lambda.ts`, handler `handler`, bundling with esbuild (external: `@aws-sdk/*`), environment: `TABLE_NAME`, `OAUTH_JWK_JSON` (from SSM resolve), `OAUTH_CLIENT_SECRET`, `PUBLIC_BASE_URL` (from Function URL), `DEMO_MODE`, `LIVE_AGENT` (default empty), `LIVE_AGENT_DAILY_CAP` (default "50").
4. **Function URL**: auth NONE (the Hono app handles auth).
5. **CloudWatch Logs**: 1-week retention on the Lambda's log group.
6. **Budget**: `AWS::Budgets::Budget` $5/month, `ACTUAL`, email subscriber from CfnParameter.
7. Grant Lambda: DynamoDB read/write, SSM read for the two parameters, Bedrock invoke (conditional on LIVE_AGENT).

## Scripts
- `npm run synth`: `cd infra && npx cdk synth --no-lookup`
- `npm run deploy`: `cd infra && npx cdk deploy --require-approval broadening` (documented, never auto-run)

## Test plan
`server/test/dynamo-store.test.ts`: a tiny in-memory fake that mimics `GetCommand`, `QueryCommand`, `TransactWriteCommand` responses. Tests:
1. `load` returns undefined for a missing household
2. `commit` creates state and events, then `load` returns them
3. `commit` with wrong expectedVersion throws StoreConflictError
4. `events` returns events sorted by sequence
5. second `commit` increments version
