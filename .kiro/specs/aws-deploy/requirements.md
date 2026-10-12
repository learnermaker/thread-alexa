# Requirements Document: aws-deploy

## Introduction
Deploy the THREAD MCP server to AWS using CDK: a Lambda Function URL, DynamoDB for state, SSM for secrets, and CloudWatch for logs. Everything runs within the AWS Free Tier or under $5/month (Master Spec §D1, §D11, §D13). `npm run synth` synthesises the CloudFormation template offline; `npm run deploy` is documented but never run by automation.

## Glossary
- **DynamoStore**: the `thread-core` `Store` port backed by DynamoDB single-table design (§D11).
- **Function URL**: Lambda's built-in HTTPS endpoint (auth type NONE; the app handles OAuth).
- **synth-only**: CDK synthesises a CloudFormation template without deploying.

## Requirements
### Requirement 1: DynamoStore
1. WHEN `TABLE_NAME` is set in the environment THE server SHALL use DynamoStore instead of FileStore.
2. DynamoStore SHALL implement `thread-core`'s `Store` interface: `load`, `commit`, `events`.
3. THE `load` method SHALL read item `PK = HH#<householdId>`, `SK = STATE` and return `{ state, version }` or `undefined`.
4. THE `commit` method SHALL use `TransactWriteItems` to conditionally update the state item (condition: `version = expectedVersion`) and put `EVENT#<seq>` items for each event. It SHALL throw `StoreConflictError` on condition failure.
5. THE `events` method SHALL query items with `SK begins_with EVENT#` sorted by SK ascending.

### Requirement 2: Lambda entry point
1. THE Lambda handler SHALL export a `hono/aws-lambda` `handle(app)` wrapping the same Hono app as the local server.
2. WHEN `OAUTH_JWK_JSON` or `SSM_OAUTH_JWK` is set THE handler SHALL load OAuth signing keys from the environment or SSM.
3. WHEN `TABLE_NAME` is set THE handler SHALL use DynamoStore.
4. THE handler SHALL disable dev tokens (`AUTH_DEV_TOKENS` = false).

### Requirement 3: CDK stack
1. THE stack SHALL create a Lambda function: `nodejs24.x`, `arm64`, 512 MB, 10 s timeout, Function URL with auth type NONE.
2. THE stack SHALL bundle the server with `NodejsFunction` and esbuild, including SPA and Lens static assets when they exist.
3. THE stack SHALL create a DynamoDB table: provisioned 5 RCU / 5 WCU, PK `pk` (S), SK `sk` (S), `ttl` attribute enabled, removal policy DESTROY.
4. THE stack SHALL create SSM Parameter Store Standard parameters for the OAuth JWK and the client secret.
5. THE stack SHALL create a CloudWatch Logs log group with 1-week retention.
6. THE stack SHALL create an `AWS::Budgets::Budget` at $5/month with an email subscriber parameter.
7. THE Bedrock live agent SHALL be off by default, enabled by `LIVE_AGENT` env var, with per-IP 10/hour and `LIVE_AGENT_DAILY_CAP` default 50.

### Requirement 4: Scripts
1. `npm run synth` SHALL synthesise the CDK stack offline and pass with zero AWS credentials.
2. `npm run deploy` SHALL be documented in `package.json` but SHALL NOT be run by any automated task.
3. `cdk.out/` SHALL be gitignored.

### Requirement 5: Testing
1. DynamoStore SHALL have unit tests against an in-memory fake of the DynamoDB DocumentClient calls used.
2. The tests SHALL verify load, commit (happy path), commit (conflict), and events retrieval.
