# Product Feedback

One block per tool, API or SDK we actually used, drawn from **both**
`package.json` files (this repo and its dependency `thread-core`) plus the
build/submission tooling. Each block answers: **what we used it for**, **what
worked**, **what needs work**, **onboarding (zero to hello world)**, and **would
we build with it again, and why**.

Every statement is evidence-only — tied to a file, a commit, a test, or a
command output in this repository and the friction log. Where we have no
evidence of a problem we write **No issues observed**; where a product was not
exercised in this submission we write **Not exercised in this submission**. We
do not invent opinions, numbers or friction.

> **AWS Builder mini-challenge:** the AWS services we used (Bedrock Runtime,
> Polly, DynamoDB, Lambda, SSM via CDK) and how each is used are described in
> their blocks below. They are integrated in code and `cdk synth`-verified, not
> deployed. This section is the required AWS Builder answer.

---

## Alexa+ MCP (docs + constraints)

- **Used for:** Target platform. We built a self-hosted MCP server to the Alexa+
  MCP constraints (Streamable HTTP, < 500 ms, OAuth Tier 1/2, MCP Apps). See
  `docs/alexa-plus-readiness.md`.
- **What worked:** The constraints are specific enough to implement and test
  against (401 without a token, PRM at the well-known URI, one intent per tool).
  We encoded each as a readiness-matrix row with a backing test.
- **What needs work:** Scope-name inconsistency in the auth docs
  (`mcp:resource` vs `mcp:resources`) forced us to pick one — friction log #1.
  PRM coverage in the auth prose is thin.
- **Onboarding:** The written constraints got us to a conformant skeleton
  without a device, but there is no sandbox Alexa+ surface, so first-hour
  feedback is indirect (Inspector + our own simulator) rather than the real host.
- **Build again:** Yes. The constraints are a clear, testable contract and map
  onto a standard MCP server; the gap is verification surface, not the spec.

## MCP TypeScript SDK (`@modelcontextprotocol/sdk` 1.32.1)

- **Used for:** The MCP server, transport (`WebStandardStreamableHTTPServerTransport`,
  stateless) and tool/resource registration (`server/mcp/`).
- **What worked:** Stateless Streamable HTTP maps cleanly onto Lambda; the
  protocol negotiates `2025-11-25` as required (asserted in
  `server/test/conformance.test.ts`).
- **What needs work:** `structuredContent` is validated against each tool's
  `outputSchema`, which collides with Alexa+'s "always return a response" rule
  for error cases — friction log #4. The docs do not show the recommended error
  envelope next to `outputSchema`.
- **Onboarding:** Fast — registering a tool with a Zod schema and serving over
  Streamable HTTP is a few lines; the first conformance test passed the same day.
- **Build again:** Yes. It is the reference implementation of the spec, the
  transport fits serverless, and the one sharp edge (error-envelope validation)
  is a one-time fix now covered by tests.

## MCP Apps / ext-apps (`@modelcontextprotocol/ext-apps` 1.7.5)

- **Used for:** The Thread Lens UI resource (`ui://thread/lens`,
  `text/html;profile=mcp-app`) and the simulator acting as an ext-apps host.
- **What worked:** A single self-contained HTML resource renders in our host;
  the MIME profile is asserted in the conformance tests.
- **What needs work:** There is no neutral surface to verify host rendering
  against the real Alexa+ client — friction log #5. We can only prove the
  resource is served correctly and renders in our own simulator.
- **Onboarding:** Serving the resource was straightforward; the uncertainty is
  entirely about whether the real host renders it identically, which we cannot
  check.
- **Build again:** Yes for the resource contract. We would want a hosted verifier
  before relying on it for anything beyond a self-contained HTML panel.

## MCP Inspector CLI

- **Used for:** Proving the server is a real MCP server (schema listing,
  valid/invalid tool calls, idempotency). Transcripts are committed under
  `docs/evidence/inspector/`.
- **What worked:** Exported traces are concrete, reviewable evidence a judge can
  read without running anything.
- **What needs work:** It is effectively the only participant-facing testing
  surface; there is no public Local Inspector or hosted Alexa+ surface to
  complement it — friction log #5.
- **Onboarding:** Pointing it at our local `/mcp` endpoint and capturing a
  transcript worked first try; no setup beyond the running server.
- **Build again:** Yes. For MCP work it is the fastest way to produce auditable
  protocol evidence.

## Kiro IDE

- **Used for:** Spec-driven implementation. The committed `.kiro/specs/` (eight
  specs: alexa-bootstrap, auth, aws-deploy, demo-world, mcp-tools,
  simulator-agent, simulator-ui, thread-lens), `.kiro/steering/` (git, mcp-api,
  product, security, structure, tech, testing, windows) and `.kiro/hooks/`
  (`guard-protected`, `no-stop-while-red`, `post-task-log`) are the
  agentic-development evidence.
- **What worked:** Requirements → design → tasks per feature kept each phase
  scoped, and steering files pinned conventions (Windows paths, protected
  branches, test policy) that the build then actually followed.
- **What needs work:** No issues observed within this submission; the specs and
  steering did their job and no friction entry is attributed to the IDE itself.
- **Onboarding:** The spec/steering/hook layout is self-describing — the files
  committed here double as the example a new contributor would copy.
- **Build again:** Yes. The committed spec+steering trail is reusable evidence
  and made the autonomous build auditable after the fact.

## Kiro Crew (specs / steering / hooks / Task Runner)

- **Used for:** Running the overnight build phases unattended (Task Runner) and
  the submission pipeline, committing to the repo autonomously. Phase record in
  `crew/OVERNIGHT_REPORT.md`.
- **What worked:** Phases ran, built, verified and committed without
  supervision; the `no-stop-while-red` hook kept it from stopping on a red gate.
- **What needs work:** The runner starts each step in its own isolated working
  directory, not the repo, so a step that omits `Set-Location` sees an empty dir
  and a reviewer can mistake it for "no work" — friction log #6. The overnight
  build also raced on shared `package.json` in one worktree — `BLOCKED.md`.
- **Onboarding:** A task spec plus a repo path was enough to start; the
  working-directory surprise is the one thing a newcomer hits immediately.
- **Build again:** Yes, with per-phase worktrees (or serialized parallel groups)
  to remove the shared-worktree race, and an explicit resolved-repo-root echo per
  step.

## AWS SDK — Bedrock Runtime (`@aws-sdk/client-bedrock-runtime` 3.1147.0)

- **Used for:** The optional live agent (`server/agent/live.ts`), off by default;
  the scripted agent is the demo default. The model is a Bedrock inference
  profile id of the form `us.<vendor>.<model>`.
- **What worked:** Toggleable live reasoning without changing the tool surface,
  so the deterministic scripted path remains the demo default.
- **What needs work:** The legitimate Bedrock inference-profile id tripped our
  own wording gate because a vendor token is structurally required inside it —
  friction log #2 (fixed in commit `905a4c7`). Not exercised against a live
  endpoint in this submission (no deployment).
- **Onboarding:** The client API is standard AWS SDK v3; the non-obvious part was
  the inference-profile id format, not the SDK.
- **Build again:** Yes. Keeping live reasoning behind a flag over the same tool
  surface is a pattern we would reuse.

## AWS SDK — Amazon Polly (`@aws-sdk/client-polly` 3.1147.0)

- **Used for:** Pre-rendering voice MP3s for the demo (`npm run voices`,
  `scripts/voices.mjs`), served from `/voices/*`.
- **What worked:** Pre-rendering keeps the demo deterministic and offline-capable
  — no live Polly call on the demo path.
- **What needs work:** No issues observed; synthesis is a one-off build step, not
  on the request path, so there was nothing to tune.
- **Onboarding:** Standard AWS SDK v3 client; a single synthesize call per line.
- **Build again:** Yes. Pre-rendered audio is the right call for a demo that must
  run with zero credentials.

## AWS SDK — DynamoDB (`@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` 3.1147.0)

- **Used for:** The deployable state store (`server/store/dynamo-store.ts`),
  single table; a FileStore mirrors the same records locally for the demo.
- **What worked:** A single versioned state document plus an event log maps onto
  one table trivially; `lib-dynamodb`'s document client removed the marshalling
  boilerplate. Covered by `dynamo-store.test.ts`.
- **What needs work:** Not exercised against a live table in this submission
  (no deployment); behaviour is verified against the test suite and the FileStore
  mirror, not a running DynamoDB.
- **Onboarding:** The document client (`lib-dynamodb`) is the part to reach for
  first; the low-level client alone would have been more friction.
- **Build again:** Yes. The single-table mapping and the local FileStore mirror
  let us build and test the store without any AWS access.

## AWS CDK (`aws-cdk-lib` 2.272.0, `aws-cdk` 2.1145.0, `constructs` 10.8.1)

- **Used for:** Infrastructure as code (`infra/`): Lambda + DynamoDB + SSM +
  CloudWatch + a small budget. `npm run synth` passes offline with zero
  credentials.
- **What worked:** `NodejsFunction` bundling plus `cdk synth` without credentials
  gives reproducible infra a judge can inspect without us deploying anything.
- **What needs work:** Not exercised via `cdk deploy` in this submission; only
  `synth` is run. `@types/aws-lambda` 8.10.164 is present for the handler types
  and raised no issues.
- **Onboarding:** `cdk synth` offline is the fast feedback loop; getting the
  Node bundling options right for `NodejsFunction` was the main first-run detail.
- **Build again:** Yes. Synth-without-deploy is exactly what a hackathon needs:
  provable infra, no standing AWS cost.

## AWS Lambda (`@types/aws-lambda` 8.10.164, handler in `server/lambda.ts`)

- **Used for:** Hosting the same Hono app via a Function URL
  (`server/lambda.ts`), the deployable counterpart to `npm run demo`.
- **What worked:** The stateless MCP server runs unchanged on Lambda — one
  bundle, adapter swap only.
- **What needs work:** Cold-start latency against the 500 ms budget is unmeasured
  because we did not deploy — noted as an open candidate in the friction log.
- **Onboarding:** Reusing the web-standard Hono app meant the Lambda handler was
  thin; the open question is runtime behaviour, not authoring.
- **Build again:** Yes. "Same app, different adapter" between Node and Lambda is
  the reason the stateless transport choice paid off.

## Hono (`hono` 4.13.13, `@hono/node-server` 2.1.4)

- **Used for:** One web app for `/mcp`, `/health`, `/privacy`, `/terms`, OAuth,
  the demo API and the static SPA, on both Node and Lambda (`server/app.ts`).
- **What worked:** Web-standard `Request`/`Response` means the same app runs
  locally and on Lambda with only a different adapter.
- **What needs work:** No issues observed; the routing and adapter story held up
  across both runtimes with no entry in the friction log.
- **Onboarding:** Minimal — a single app object with route handlers; the Node
  server adapter is one import.
- **Build again:** Yes. The web-standard model is precisely what made the
  Node/Lambda portability free.

## jose (`jose` 6.2.12)

- **Used for:** ES256 JWT signing/verification and JWKS in the embedded OAuth
  authorization server (`server/auth/`).
- **What worked:** Standards-correct ES256 and JWKS with no cloud dependency, so
  the demo runs with zero credentials.
- **What needs work:** No issues observed; the OAuth flow and its tests passed
  without a friction entry against the library.
- **Onboarding:** The sign/verify/JWKS APIs matched the OAuth needs directly; no
  detour.
- **Build again:** Yes. A self-contained, standards-correct JWT/JWKS library is
  exactly what a zero-credential demo auth server needs.

## Zod (`zod` 4.6.5)

- **Used for:** Tool input/output schemas for the MCP tools (and the shared
  domain schemas in `thread-core`, which also depends on `zod` 4.6.5).
- **What worked:** One schema drives both runtime validation and the MCP
  `inputSchema`/`outputSchema`, keeping validation and contract in sync.
- **What needs work:** The interaction with the SDK's `outputSchema` validation
  on error branches needed care — covered under friction log #4 (an SDK/contract
  issue, not a Zod defect).
- **Onboarding:** Immediate for anyone who has used Zod; schema-first tools were
  the natural shape.
- **Build again:** Yes. Schema-as-contract is the backbone of the tool surface.

## React (`react` / `react-dom` 19.3.0, `@types/react*` 19.3.0)

- **Used for:** The Alexa+ experience simulator UI (`web/sim`) and the Thread
  Lens MCP App (`web/lens`).
- **What worked:** Standard component model; both front-ends build to
  self-contained bundles via Vite.
- **What needs work:** No issues observed; no friction entry is attributed to
  React itself.
- **Onboarding:** Standard; nothing project-specific to learn.
- **Build again:** Yes. Conventional, well-supported, and the single-file build
  output suited the MCP App resource constraint.

## Vite + `vite-plugin-singlefile` + `@vitejs/plugin-react` (`vite` 8.3.4, `vite-plugin-singlefile` 2.3.3, `@vitejs/plugin-react` 6.1.2)

- **Used for:** Building the Lens (`build:lens`) and simulator (`build:sim`); the
  single-file plugin inlines the Lens into one HTML document for the
  `ui://thread/lens` MCP App resource.
- **What worked:** `vite-plugin-singlefile` produced exactly the self-contained
  HTML the MCP App resource requires, with no manual inlining.
- **What needs work:** No issues observed across the two build targets.
- **Onboarding:** Two small `vite.config.ts` files, one per surface; the
  single-file plugin was a drop-in.
- **Build again:** Yes. The single-file output is the specific reason this stack
  fit the MCP App packaging requirement.

## esbuild (`esbuild` 0.28.2)

- **Used for:** Transitive bundling (Vite dev/transform and CDK `NodejsFunction`
  bundling). Listed in `allowScripts` so its install step is permitted.
- **What worked:** No issues observed; it did its job underneath Vite and CDK.
- **What needs work:** No issues observed.
- **Onboarding:** Not used directly; no direct onboarding surface.
- **Build again:** Yes, by consequence of using Vite and CDK — it is the engine,
  not a direct choice.

## Vitest (`vitest` 5.0.3, `@vitest/coverage-v8` 5.0.3, `fast-check` 4.10.2)

- **Used for:** The unit/contract test suite (`npm test` → `vitest run`) in both
  repos. `thread-core` adds `fast-check` for property-based tests and
  `@vitest/coverage-v8` for coverage. This repo reports **68 passing** (README
  badge, set from real `npm test` output).
- **What worked:** Fast, ESM-native, same runner across both repos; `fast-check`
  gave property coverage of `thread-core`'s domain logic rather than only
  examples.
- **What needs work:** No issues observed; the suite is green and no friction
  entry is attributed to the runner.
- **Onboarding:** Zero-config for a TypeScript ESM project; tests ran without a
  separate transform step.
- **Build again:** Yes. ESM-native, fast, and `fast-check` integration made
  property testing cheap.

## Playwright (`@playwright/test` 1.64.0)

- **Used for:** End-to-end tests (`npm run e2e`: build both front-ends, then
  `playwright test` via `playwright.config.ts`), including the golden story path.
- **What worked:** Drove the built simulator and Lens as a user would, catching
  integration issues the unit tests could not.
- **What needs work:** No issues observed in the suite; the e2e step depends on
  the two Vite builds completing first, which the `e2e` script already chains.
- **Onboarding:** One config file; the build-then-test chaining is explicit in
  the npm script so there was no hidden ordering to discover.
- **Build again:** Yes. For a UI-plus-server demo, real-browser e2e is worth the
  extra build step.

## ffmpeg-static (`ffmpeg-static` 5.3.0)

- **Used for:** The video pipeline (`npm run video`, `npm run video:final`) —
  assembling captures, captions and the gallery. Listed in `allowScripts` and in
  `devDependencies`.
- **What worked:** A pinned static ffmpeg binary means the video build has no
  system-ffmpeg dependency and is reproducible.
- **What needs work:** It first landed in `dependencies` and failed the
  dependency-allowlist gate until moved to `devDependencies` — friction log #3.
- **Onboarding:** The static binary path from the package was the one thing to
  wire up; otherwise standard ffmpeg invocation.
- **Build again:** Yes. A pinned, bundled ffmpeg is the right call for a
  reproducible, system-free video build.

## GitHub Actions (`.github/workflows/ci.yml`)

- **Used for:** CI on every push to `main` and every pull request: `npm ci` then
  `npm run verify` on a `ubuntu-latest` + `windows-latest` matrix, using
  `actions/checkout@v4` and `actions/setup-node@v4`.
- **What worked:** The Windows+Linux matrix caught platform differences before
  merge (this project is developed on Windows), and `npm run verify` as the
  single gate keeps the workflow tiny.
- **What needs work:** No issues observed; the workflow is one job with one gate
  and raised no friction entry.
- **Onboarding:** A ~15-line workflow reusing the repo's own `verify` script;
  nothing CI-specific to learn beyond the matrix syntax.
- **Build again:** Yes. "One `verify` script, run everywhere" keeps CI and local
  gates identical.

## gh CLI

- **Used for:** Opening pull requests, waiting for CI, merging to `main`, and
  setting repository visibility/About during the submission run
  (`gh pr create`, `gh pr merge`, `gh repo edit`).
- **What worked:** Scriptable PR-and-merge from the autonomous pipeline with no
  web UI step, so the whole submission flow stays in one script.
- **What needs work:** No issues observed in this submission.
- **Onboarding:** Assuming an authenticated `gh`, the create/merge/edit verbs map
  directly to the submission steps; no detour.
- **Build again:** Yes. For an autonomous pipeline that must open and merge its
  own PRs, a scriptable CLI is essential.

---

## Feature requests (optional)

- **[Important]** A hackathon-tier Alexa+ simulator so participants can verify
  MCP App rendering on the real host (from friction log #5).
- **[Nice-to-have]** A public Local Inspector (from friction log #5).
- **[Nice-to-have]** A dependency-allowlist check that prints the APPROVED field
  for a misplaced-but-known package (from friction log #3).
- **[Nice-to-have]** A task runner that echoes the resolved repository root it
  acted on, so a reviewer does not mistake an empty scratch dir for "no work"
  (from friction log #6).
