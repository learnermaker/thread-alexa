# Implementation Plan: aws-deploy

- [ ] 1. Install AWS dependencies
  - `npm install --save-exact @aws-sdk/client-dynamodb@3.1147.0 @aws-sdk/lib-dynamodb@3.1147.0`
  - `npm install --save-exact --save-dev aws-cdk-lib@2.272.0 aws-cdk@2.1145.0 constructs@10.8.1 esbuild@0.28.2 @types/aws-lambda@8.10.164`
  - **Done when:** `node scripts/check-deps.mjs` passes
  - _Requirements: 1.1, 3.2_

- [ ] 2. Implement DynamoStore
  - Create `server/store/dynamo-store.ts` per design.md
  - **Done when:** TypeScript compiles with no errors
  - _Requirements: 1.1–1.5_

- [ ] 3. Unit-test DynamoStore
  - Create `server/test/dynamo-store.test.ts` with in-memory DocumentClient fake
  - **Done when:** `npx vitest run server/test/dynamo-store.test.ts` passes and `npm run verify` passes
  - _Requirements: 5.1, 5.2_

- [ ] 4. Implement Lambda entry point
  - Create `server/lambda.ts` per design.md
  - **Done when:** TypeScript compiles with no errors
  - _Requirements: 2.1–2.4_

- [ ] 5. Create CDK stack
  - Create `infra/tsconfig.json`, `infra/app.ts`, `infra/stack.ts` per design.md
  - Add `npm run synth` and `npm run deploy` scripts to `package.json`
  - **Done when:** `npm run synth` passes offline and `npm run verify` passes
  - _Requirements: 3.1–3.7, 4.1–4.3_

- [ ] 6. Update .env.example with AWS variables
  - Add TABLE_NAME, OAUTH_JWK_JSON, OAUTH_CLIENT_SECRET, LIVE_AGENT, LIVE_AGENT_DAILY_CAP
  - _Requirements: 2.2, 2.3, 3.7_

- [ ] 7. Checkpoint: commit and push
  - `git add -A` (never cdk.out), commit `feat(aws): DynamoStore, Lambda entry, CDK stack (synth only)`, push
  - **Done when:** `npm run verify` and `npm run synth` both pass, commit pushed
  - _Requirements: 4.1_
