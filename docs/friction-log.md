# Friction Log

Real friction encountered while building THREAD, recorded as it happened. Every
entry uses the same fields — **task, steps, expected vs actual, severity,
workaround, actionable suggestion** — and keeps its evidence (a commit, a file,
or a command output in this repository). **Nothing here is invented.** The log
is kept current through submission.

Severity: 🔴 blocks the prize · 🟠 costs a day · 🟡 costs hours.

---

## 1. Alexa+ MCP auth docs: `mcp:resource` vs `mcp:resources` — 🟡

- **Task:** Implement the Tier 2 OAuth scopes for the embedded authorization
  server (`server/auth/oauth.ts`), following the Alexa+ MCP developer docs.
- **Steps:** Followed the Alexa+ MCP constraints while writing the scope
  allowlist and scope validator.
- **Expected vs actual:** Expected one consistent spelling of each custom scope.
  Actual: the constraints we captured (Master Spec §B6) name them `mcp:tools` /
  `mcp:resources`, but surrounding auth prose and examples use singular
  `mcp:resource` inconsistently, so we had to pick one.
- **Severity:** 🟡 costs hours.
- **Workaround:** Standardised on `mcp:resources` (plural) in
  `TIER2_SCOPES = ["mcp:tools", "mcp:resources"]` and validated against it; the
  inconsistency is recorded here rather than guessed silently.
- **Actionable suggestion:** The Alexa+ auth docs should use one spelling of each
  custom scope throughout, with a copy-pasteable scope string.

## 2. Wording gate vs legitimate Bedrock model ids — 🟡

- **Task:** Add the live Bedrock agent (Phase 5), whose config references a
  Bedrock inference-profile id of the form `us.<vendor>.<model>`, past our own
  public-repo wording rule (`scripts/check-wording.mjs`) that keeps
  development-tool vendor names out of a public submission repo.
- **Steps:** Ran `npm run verify`; the wording step failed because the vendor
  substring inside a legitimate Bedrock model id tripped the banned-word regex.
- **Expected vs actual:** Expected the gate to pass on a real AWS Bedrock model
  id; actual was a false positive on the vendor token embedded in that id.
- **Severity:** 🟡 costs hours.
- **Workaround:** Commit `905a4c7 fix(verify): allow Bedrock model ids in wording
  gate` — the gate now allows a line that also matches a Bedrock inference-profile
  id (`us|eu|apac|global.<vendor>.<model>`).
- **Actionable suggestion:** A wording/brand linter needs an allowlist for
  identifiers where a vendor token is structurally required (model ids, package
  names).

## 3. New dependency slipped into `dependencies` instead of `devDependencies` — 🟡

- **Task:** Prepare the video pipeline (Phase 8), which uses `ffmpeg-static`,
  past our dependency allowlist (`scripts/check-deps.mjs`).
- **Steps:** `ffmpeg-static` was installed into `dependencies`; the next
  `npm run verify` failed at the dependency-allowlist step
  (`dependencies.ffmpeg-static@5.3.0 is not approved`).
- **Expected vs actual:** Expected a dev-only build tool to be a devDependency
  (the architect allowlist lists it there, and §D18.11 excludes it from the
  shipped bundle). Actual: it landed in runtime `dependencies`.
- **Severity:** 🟡 costs hours.
- **Workaround:** Moved it to `devDependencies` and reran
  `npm install --package-lock-only`; `check-deps` returns `deps ok`.
- **Actionable suggestion:** The allowlist check could print the APPROVED field
  for a misplaced-but-known package ("approved as a devDependency, found in
  dependencies") to make the fix obvious.

## 4. MCP SDK validates `structuredContent` against `outputSchema` — 🟡

- **Task:** Return structured errors from the 8 MCP tools without an empty result
  (Alexa+ "always return a response"), using `@modelcontextprotocol/sdk` 1.32.1.
- **Steps:** The SDK validates each tool's `structuredContent` against its
  `outputSchema`. A plain error object was rejected because the schema initially
  described only the success shape.
- **Expected vs actual:** Expected to return an `{ error }` object on failure;
  actual, the schema rejected it until the error branch was admitted.
- **Severity:** 🟡 costs hours.
- **Workaround:** Errors return `isError: true` plus a text summary and
  `structuredContent: { error }`, and the output schemas admit the error branch.
  Covered by the conformance tests (`server/test/conformance.test.ts`).
- **Actionable suggestion:** SDK docs should show the recommended error envelope
  alongside `outputSchema`, since "always return a response" and schema
  validation pull in opposite directions.

## 5. Testing MCP Apps (the Lens) without an Alexa surface — 🟠

- **Task:** Verify the `ui://thread/lens` resource renders in the modes the
  design calls for (Phase 3), using MCP Apps / `@modelcontextprotocol/ext-apps`
  1.7.5 and MCP Inspector.
- **Steps:** Only MCP Inspector is available to hackathon participants; there is
  no Alexa+ device or Local Inspector surface to confirm host rendering.
- **Expected vs actual:** Expected to confirm the Lens on the target surface;
  actual, we can only prove the resource is served with the correct
  `text/html;profile=mcp-app` MIME and renders in our own simulator host.
- **Severity:** 🟠 costs a day.
- **Workaround:** The Lens is validated by (a) the conformance test asserting the
  resource and MIME, and (b) our Alexa+ experience simulator acting as an
  ext-apps host. Inspector transcripts are committed under
  `docs/evidence/inspector/`.
- **Actionable suggestion:** A public, hosted Local Inspector (or a hackathon-tier
  simulator) would let participants verify MCP App rendering against the real
  host.

## 6. Crew Task Runner writes to an isolated folder, not the repo — 🟡

- **Task:** Run the overnight phases unattended against the repo with the
  autonomous Crew Task Runner.
- **Steps:** Review of an earlier task reported "no work found" because it
  inspected the runner's own working directory, while all commits landed in the
  actual repo (`thread-alexa`), as the git history shows.
- **Expected vs actual:** Expected the runner's working directory to be the repo;
  actual, the runner starts each step in its own folder and must `Set-Location`
  to the repo at the top of every step.
- **Severity:** 🟡 costs hours.
- **Workaround:** Every phase begins with `Set-Location` to the repo path, and
  work is verified against `git log` in the repo rather than the runner folder.
- **Actionable suggestion:** A task runner should surface the resolved repository
  root it acted on, so a reviewer does not mistake an empty scratch dir for "no
  work".

## 7. Crew parallel phases race in one shared worktree — 🟠

- **Task:** Reach "VERIFY PASSED" for Phase 2 while Phases 3 and 5 ran in
  parallel (evidence: `BLOCKED.md`).
- **Steps:** Ran `npm run verify` in Phase 2; it could not pass because the single
  shared worktree held uncommitted, non-compiling WIP from the parallel Phase 3
  (`web/lens/src/modes.tsx`) and Phase 5 (`server/lambda.ts`) tasks. Phase 2's own
  files compiled and tested green in isolation.
- **Expected vs actual:** Expected each parallel phase to verify against its own
  code; actual, parallel phases shared one worktree and momentarily red each
  other's `verify`, and they still race on `package.json`.
- **Severity:** 🟠 costs a day.
- **Workaround:** Committed only the 12 Phase 2 files with a scoped `git add`
  (not `-A`) to avoid entangling three phases in one commit; `verify` reached
  **VERIFY PASSED** once Phase 5 committed its fixes (`c3c22f9 feat(aws): …`).
- **Actionable suggestion:** Give each parallel phase its own git worktree (or
  serialize the parallel group) so tasks cannot red each other's gates or race on
  shared files.

## 8. No AWS account before the deadline — the stack is synth-only — 🟠

- **Task:** Stand up the integrated AWS stack (Bedrock, DynamoDB, Lambda, SSM,
  Polly, CDK) for the AWS Builder track.
- **Steps:** The CDK app defines the stack and `cdk synth` produces a valid
  CloudFormation template, but an AWS account suitable for deploying it could not
  be set up before the Oct 23 2026 deadline.
- **Expected vs actual:** Expected to demo the AWS stack as deployable (synth
  verified); actual, AWS is **not deployed** — integration is proven in code and
  by `cdk synth`, not at runtime.
- **Severity:** 🟠 costs a day.
- **Workaround:** Everything AWS is described honestly as **deployable (synth
  verified)**, never as running; the integrations are present and verifiable in
  the CDK source and synth output.
- **Actionable suggestion:** A hackathon-tier sandbox account (or a documented
  synth-only submission path) would let builders prove IaC integration without a
  billable deploy under deadline.

## 9. Simulator bug: opaque-redirect sign-in failed silently — 🟠

- **Task:** Sign in through the browser OAuth flow in the Alexa+ experience
  simulator (`web/sim`), exposed when recording the demo video.
- **Steps:** The sim's OAuth sign-in used an opaque redirect that the browser
  could not follow, so the flow stalled with no visible error.
- **Expected vs actual:** Expected the simulated sign-in to complete and return
  to the app; actual, it hung on the opaque redirect.
- **Severity:** 🟠 costs a day.
- **Workaround:** Fixed in commit `f5f7663 fix(sim): browser OAuth sign-in, Sam's
  inbox, Context Receipt in the Lens, pharmacy quote wording` (`web/sim/src/App.tsx`,
  `web/sim/src/mcp.ts`).
- **Actionable suggestion:** Add a browser end-to-end assertion for the sign-in
  flow so a regression fails a test instead of a demo recording.

## 10. Simulator bug: Sam's inbox field mismatch — 🟡

- **Task:** Render Sam's inbox in the simulator from the MCP tool payload, exposed
  while recording the demo video.
- **Steps:** The inbox UI read a field name that did not match the payload shape,
  so entries did not display.
- **Expected vs actual:** Expected Sam's inbox items to appear; actual, the field
  mismatch left the inbox empty.
- **Severity:** 🟡 costs hours.
- **Workaround:** Fixed in commit `f5f7663 fix(sim): browser OAuth sign-in, Sam's
  inbox, Context Receipt in the Lens, pharmacy quote wording`
  (`web/sim/src/types.ts`, `web/sim/src/App.tsx`).
- **Actionable suggestion:** Add a browser end-to-end assertion that Sam's inbox
  renders the expected entries from the payload.

## 11. Simulator bug: Context Receipt missing from the Lens — 🟡

- **Task:** Show the Context Receipt in the Lens (`web/lens`) in the simulator,
  exposed while recording the demo video.
- **Steps:** The receipt was absent from the rendered Lens despite being present
  in the tool result.
- **Expected vs actual:** Expected the Context Receipt to appear in the Lens;
  actual, it was missing.
- **Severity:** 🟡 costs hours.
- **Workaround:** Fixed in commit `f5f7663 fix(sim): browser OAuth sign-in, Sam's
  inbox, Context Receipt in the Lens, pharmacy quote wording`
  (`web/lens/src/App.tsx`, `web/lens/src/modes.tsx`, `web/lens/src/types.ts`).
- **Actionable suggestion:** Add a browser end-to-end assertion that the Context
  Receipt renders in the Lens.

---

_Open candidates to log as they occur: Lambda cold-start latency vs the 500 ms
budget once deployed; the 2025-11-25 vs 2026-07-28 SDK migration (tracked in
`docs/adr/0001-mcp-sdk-version.md`); clean-machine quickstart results._
