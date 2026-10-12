# Friction Log

Real friction encountered while building THREAD, recorded as it happened. Each
entry names the tool, the task, the steps, expected vs actual, severity, the
workaround, and an actionable suggestion. **Nothing here is invented** — every
entry is tied to a commit, a file, or a command output in this repository. The
log is kept current through submission; new entries are appended with their date.

Severity: 🔴 blocks the prize · 🟠 costs a day · 🟡 costs hours.

---

## 1. Alexa+ MCP auth docs: `mcp:resource` vs `mcp:resources` — 🟡

- **Tool:** Alexa+ MCP developer documentation.
- **Task:** Implement the Tier 2 OAuth scopes for the embedded authorization
  server (`server/auth/oauth.ts`).
- **Steps:** Followed the Alexa+ MCP constraints while writing the scope
  allowlist.
- **Expected vs actual:** The constraints we captured (Master Spec §B6) name the
  user scopes as `mcp:tools` / `mcp:resources`, but surrounding auth prose and
  examples are inconsistent about singular `mcp:resource`. We had to pick one.
- **Resolution:** Standardised on `mcp:resources` (plural) in
  `TIER2_SCOPES = ["mcp:tools", "mcp:resources"]` and validated against it. The
  inconsistency is recorded here rather than guessed silently.
- **Suggestion:** The Alexa+ auth docs should use one spelling of each custom
  scope throughout, with a copy-pasteable scope string.

## 2. Wording gate vs legitimate Bedrock model ids — 🟡

- **Tool:** Our own public-repo wording rule (`scripts/check-wording.mjs`), which
  keeps development-tool vendor names out of a public submission repo.
- **Task:** Add the live Bedrock agent (Phase 5), whose config references a
  Bedrock inference-profile id of the form `us.<vendor>.<model>`.
- **Steps:** Ran `npm run verify`; the wording step failed because the vendor
  substring inside a legitimate Bedrock model id tripped the banned-word regex.
- **Expected vs actual:** Expected the gate to pass on a real AWS Bedrock model
  id; actual was a false positive on the vendor token embedded in that id.
- **Resolution:** Commit `905a4c7 fix(verify): allow Bedrock model ids in wording
  gate` — the gate now allows a line that also matches a Bedrock inference-profile
  id (`us|eu|apac|global.<vendor>.<model>`).
- **Suggestion:** A wording/brand linter needs an allowlist for identifiers where
  a vendor token is structurally required (model ids, package names).

## 3. New dependency slipped into `dependencies` instead of `devDependencies` — 🟡

- **Tool:** npm + our dependency allowlist (`scripts/check-deps.mjs`).
- **Task:** Preparing the video pipeline (Phase 8), which uses `ffmpeg-static`.
- **Steps:** `ffmpeg-static` was installed into `dependencies`; the next
  `npm run verify` failed at the dependency-allowlist step
  (`dependencies.ffmpeg-static@5.3.0 is not approved`).
- **Expected vs actual:** Expected a dev-only build tool to be a devDependency
  (the architect allowlist lists it there, and §D18.11 excludes it from the
  shipped bundle). Actual: it landed in runtime `dependencies`.
- **Resolution:** Moved it to `devDependencies` and reran
  `npm install --package-lock-only`; `check-deps` returns `deps ok`.
- **Suggestion:** The allowlist check could print the APPROVED field for a
  misplaced-but-known package ("approved as a devDependency, found in
  dependencies") to make the fix obvious.

## 4. MCP SDK validates `structuredContent` against `outputSchema` — 🟡

- **Tool:** `@modelcontextprotocol/sdk` 1.32.1.
- **Task:** Return structured errors from the 8 MCP tools without an empty
  result (Alexa+ "always return a response").
- **Steps:** The SDK validates each tool's `structuredContent` against its
  `outputSchema`. A plain error object would be rejected if the schema did not
  allow it.
- **Expected vs actual:** Expected to return an `{ error }` object on failure;
  the schema initially described only the success shape.
- **Resolution:** Errors return `isError: true` plus a text summary and
  `structuredContent: { error }`, and the output schemas admit the error branch.
  Covered by the conformance tests (`server/test/conformance.test.ts`).
- **Suggestion:** SDK docs should show the recommended error envelope alongside
  `outputSchema`, since "always return a response" and schema validation pull in
  opposite directions.

## 5. Testing MCP Apps (the Lens) without an Alexa surface — 🟠

- **Tool:** MCP Apps / `@modelcontextprotocol/ext-apps` 1.7.5; MCP Inspector.
- **Task:** Verify the `ui://thread/lens` resource renders in the modes the
  design calls for (Phase 3).
- **Steps:** Only MCP Inspector is available to hackathon participants; there is
  no Alexa+ device or Local Inspector surface to confirm host rendering.
- **Expected vs actual:** Expected to confirm the Lens on the target surface;
  actual, we can only prove the resource is served with the correct
  `text/html;profile=mcp-app` MIME and renders in our own simulator host.
- **Resolution:** The Lens is validated by (a) the conformance test asserting the
  resource and MIME, and (b) our Alexa+ experience simulator acting as an
  ext-apps host. Inspector transcripts are committed under
  `docs/evidence/inspector/`.
- **Suggestion:** A public, hosted Local Inspector (or a hackathon-tier simulator)
  would let participants verify MCP App rendering against the real host.

## 6. Crew Task Runner writes to an isolated folder, not the repo — 🟡

- **Tool:** The autonomous task runner used for the overnight build.
- **Task:** Run the overnight phases unattended against the repo.
- **Steps:** Review of an earlier task reported "no work found" because it
  inspected the runner's own working directory, while all commits landed in the
  actual repo (`thread-alexa`), as the git history shows.
- **Expected vs actual:** Expected the runner's working directory to be the repo;
  actual, the runner starts each step in its own folder and must `Set-Location`
  to the repo at the top of every step.
- **Resolution:** Every phase begins with `Set-Location` to the repo path, and
  work is verified against `git log` in the repo rather than the runner folder.
- **Suggestion:** A task runner should surface the resolved repository root it
  acted on, so a reviewer does not mistake an empty scratch dir for "no work".

---

_Open candidates to log as they occur: Lambda cold-start latency vs the 500 ms
budget once deployed; the 2025-11-25 vs 2026-07-28 SDK migration (tracked in
`docs/adr/0001-mcp-sdk-version.md`); clean-machine quickstart results._
