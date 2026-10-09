# Product Feedback

Per the submission rules (§B5.5), one block per tool, API or SDK we actually
used. Each block answers: **what we used it for**, **what worked**, **what needs
work**, **onboarding (zero to hello world)**, and **would we build with it again,
and why**.

**This is a skeleton.** Factual fields (what we used it for, versions, where it
is in the repo) are filled from this repository. Opinion fields that require a
final judgement — "what needs work", "would we build again" — are marked
**[TBD]** and completed from the friction log before submission (§E2 says write
the Devpost text by Oct 20). We do not invent opinions here.

> **AWS Builder mini-challenge:** the AWS services we used (Bedrock, Polly,
> DynamoDB, Lambda, CDK) and how each is used are described in their blocks
> below. This is the required AWS Builder answer.

---

## Alexa+ MCP (docs + constraints)

- **Used for:** Target platform. We built a self-hosted MCP server to the Alexa+
  MCP constraints (Streamable HTTP, < 500 ms, OAuth Tier 1/2, MCP Apps). See
  `docs/alexa-plus-readiness.md`.
- **What worked:** The constraints are specific enough to implement and test
  against (401 without `WWW-Authenticate`, PRM at the well-known URI, one intent
  per tool). We encoded each as a readiness-matrix row with a test.
- **What needs work:** Scope-name inconsistency (`mcp:resource` vs
  `mcp:resources`) — see friction log #1. PRM coverage is thin in the auth page.
- **Onboarding:** [TBD — summarise the first-hour experience from the friction log.]
- **Build again:** [TBD]

## MCP TypeScript SDK (`@modelcontextprotocol/sdk` 1.32.1)

- **Used for:** The MCP server, transport (`WebStandardStreamableHTTPServerTransport`,
  stateless) and tool/resource registration (`server/mcp/`).
- **What worked:** Stateless Streamable HTTP maps cleanly onto Lambda; protocol
  negotiates `2025-11-25` as required (asserted in `conformance.test.ts`).
- **What needs work:** The success/error envelope vs `outputSchema` validation
  needed care — friction log #4.
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## MCP Apps / ext-apps (`@modelcontextprotocol/ext-apps` 1.7.5)

- **Used for:** The Thread Lens UI resource (`ui://thread/lens`,
  `text/html;profile=mcp-app`) and the simulator acting as an ext-apps host.
- **What worked:** Single self-contained HTML resource renders in our host; MIME
  profile is asserted in conformance tests.
- **What needs work:** No neutral surface to verify host rendering — friction
  log #5.
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## MCP Inspector

- **Used for:** Proving the server is a real MCP server (schemas, valid/invalid
  calls, idempotency). Transcripts committed under `docs/evidence/inspector/`.
- **What worked:** Exported traces are concrete, reviewable evidence for judges.
- **What needs work:** It is the only testing surface available to participants;
  no Local Inspector — friction log #5.
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## Kiro

- **Used for:** Spec-driven implementation. The committed `.kiro/specs/`,
  `.kiro/steering/` and hooks are the agentic-development evidence (§D18.12).
- **What worked:** [TBD — fill from kiro-log.]
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## Kiro Crew (task runner)

- **Used for:** Running the overnight build phases unattended.
- **What worked:** Phases ran and committed to the repo autonomously.
- **What needs work:** The runner's working directory is not the repo by default;
  each step must `Set-Location` — friction log #6.
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## AWS Bedrock

- **Used for:** The optional live agent (`server/agent/live.ts`), off by default;
  the scripted agent is the demo default. Model is a Bedrock inference profile.
- **What worked:** Toggleable live reasoning without changing the tool surface.
- **What needs work:** [TBD — model-access / bearer-token setup notes.]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## Amazon Polly

- **Used for:** Pre-rendered voice MP3s for the demo (`npm run voices`,
  `scripts/voices.mjs`), served at `/voices/*`.
- **What worked:** Pre-rendering keeps the demo deterministic and offline-capable.
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## Amazon DynamoDB

- **Used for:** Deployed state store (`server/store/dynamo-store.ts`), single
  table; FileStore mirrors the same records locally.
- **What worked:** A single versioned state document + event log maps onto one
  table trivially (§D18 S7). Tested in `dynamo-store.test.ts`.
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## AWS Lambda

- **Used for:** Hosting the same Hono app via a Function URL (`server/lambda.ts`).
- **What worked:** The stateless MCP server runs unchanged on Lambda; one bundle.
- **What needs work:** Cold-start latency vs the 500 ms budget — to measure once
  deployed (friction log open candidates).
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## AWS CDK (`aws-cdk-lib` 2.272.0)

- **Used for:** Infrastructure as code (`infra/stack.ts`): Lambda + DynamoDB +
  SSM + CloudWatch + a $5 budget. `npm run synth` passes offline, zero creds.
- **What worked:** `NodejsFunction` bundling plus synth-without-credentials
  gives judges reproducible infra without deploying.
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## Hono (4.13.13)

- **Used for:** One web app for `/mcp`, `/health`, `/privacy`, `/terms`, OAuth,
  the demo API and the static SPA, on both Node and Lambda (`server/app.ts`).
- **What worked:** Web-standard `Request`/`Response` means the same app runs
  locally and on Lambda with a different adapter only.
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

## jose (6.2.12)

- **Used for:** ES256 JWT signing/verification and JWKS in the embedded OAuth
  authorization server (`server/auth/`).
- **What worked:** Standards-correct ES256 and JWKS without a cloud dependency,
  so the demo runs with zero credentials.
- **What needs work:** [TBD]
- **Onboarding:** [TBD]
- **Build again:** [TBD]

---

## Feature requests (optional, §E3)

- **[Important]** A hackathon-tier Alexa+ simulator so participants can verify MCP
  App rendering on the real host.
- **[Nice-to-have]** A public Local Inspector.
- **[Nice-to-have]** An Alexa+ proactive-notification API for add-ons.
