# Feature Requests

Each request below is **derived from a real entry in [`docs/friction-log.md`](./friction-log.md)** —
nothing here is invented. The linked friction entry is the evidence for why the
request exists. Priority is one of **Critical** (blocks the prize or ships broken),
**Important** (costs real time or risks a mistake), or **Nice-to-have** (quality-of-life).

| # | Request | Traces to | Priority |
|---|---------|-----------|----------|
| FR-1 | One canonical spelling for every MCP OAuth scope | Friction #1 | Important |
| FR-2 | Brand/wording linter allowlist for structural identifiers | Friction #2 | Important |
| FR-3 | Dependency-allowlist check prints the APPROVED field | Friction #3 | Nice-to-have |
| FR-4 | MCP SDK docs show the error envelope beside `outputSchema` | Friction #4 | Important |
| FR-5 | Public hosted Local Inspector for MCP Apps rendering | Friction #5 | Critical |
| FR-6 | Task runner surfaces the resolved repository root | Friction #6 | Important |

---

## FR-1 — One canonical spelling for every MCP OAuth scope — Important

- **Traces to:** [Friction #1](./friction-log.md#1-alexa-mcp-auth-docs-mcpresource-vs-mcpresources--) —
  the Alexa+ MCP docs use both `mcp:resource` (singular) and `mcp:resources`
  (plural), forcing a guess while writing `server/auth/oauth.ts`.
- **Request:** The Alexa+ MCP authorization documentation should use exactly one
  spelling of each custom scope everywhere, and publish a copy-pasteable scope
  string for the Tier 2 allowlist.
- **Why it matters:** An inconsistent scope name silently causes auth failures
  that are hard to attribute, because both spellings look plausible. We
  standardised on `mcp:resources` and recorded the choice rather than guessing
  silently.
- **Priority rationale:** Important — it cost hours to resolve and the wrong
  guess would have broken Tier 2 OAuth, but a documented workaround exists.

## FR-2 — Brand/wording linter allowlist for structural identifiers — Important

- **Traces to:** [Friction #2](./friction-log.md#2-wording-gate-vs-legitimate-bedrock-model-ids--) —
  the wording gate (`scripts/check-wording.mjs`) false-positived on the vendor
  token structurally required inside a real Bedrock inference-profile id.
- **Request:** A brand/wording linter should accept an allowlist for identifiers
  where a vendor token is structurally required (model ids, package names), so a
  legitimate `us|eu|apac|global.<vendor>.<model>` id does not trip the banned-word
  rule.
- **Why it matters:** Without it, adding the live Bedrock agent (Phase 5) failed
  `npm run verify` on a valid AWS model id. Fixed in commit `905a4c7`, but the
  fix had to be invented locally.
- **Priority rationale:** Important — blocked a green verify until patched, and
  any project referencing a Bedrock model id hits the same wall.

## FR-3 — Dependency-allowlist check prints the APPROVED field — Nice-to-have

- **Traces to:** [Friction #3](./friction-log.md#3-new-dependency-slipped-into-dependencies-instead-of-devdependencies--) —
  `ffmpeg-static` landed in `dependencies`; `check-deps` rejected it without
  saying it was approved as a **devDependency**.
- **Request:** When `scripts/check-deps.mjs` rejects a known-but-misplaced
  package, it should print the APPROVED field — e.g. "approved as a
  devDependency, found in dependencies" — to make the fix obvious.
- **Why it matters:** The current message (`... is not approved`) reads as
  "remove this package" when the real fix is "move it one section over".
- **Priority rationale:** Nice-to-have — the fix was quick once understood; this
  only shortens diagnosis.

## FR-4 — MCP SDK docs show the error envelope beside `outputSchema` — Important

- **Traces to:** [Friction #4](./friction-log.md#4-mcp-sdk-validates-structuredcontent-against-outputschema--) —
  `@modelcontextprotocol/sdk` validates `structuredContent` against each tool's
  `outputSchema`, so a plain `{ error }` was rejected until the schema admitted
  the error branch.
- **Request:** The MCP SDK documentation should show the recommended error
  envelope (`isError: true` + text summary + `structuredContent: { error }`)
  alongside `outputSchema`, since "always return a response" and schema
  validation pull in opposite directions.
- **Why it matters:** The two requirements conflict in practice; without guidance
  every tool author rediscovers the envelope. Ours is covered by
  `server/test/conformance.test.ts`.
- **Priority rationale:** Important — affects all 8 tools and any Alexa+ tool that
  must return structured errors.

## FR-5 — Public hosted Local Inspector for MCP Apps rendering — Critical

- **Traces to:** [Friction #5](./friction-log.md#5-testing-mcp-apps-the-lens-without-an-alexa-surface--) —
  there is no Alexa+ device or hosted Local Inspector for hackathon
  participants, so the Lens (`ui://thread/lens`) can only be verified in our own
  simulator host.
- **Request:** Provide a public, hosted Local Inspector (or a hackathon-tier
  simulator) so participants can verify MCP App rendering against the real host,
  not just the correct MIME and a self-built simulator.
- **Why it matters:** This is the one thing we **cannot** prove on the target
  surface — the highest-value user-facing feature (the Lens) is unverifiable on
  the real host. We mitigated with a conformance test plus committed Inspector
  transcripts under `docs/evidence/inspector/`, but that is a proxy, not the host.
- **Priority rationale:** Critical — it is the only gap we could not close with a
  workaround that reaches the actual rendering surface.

## FR-6 — Task runner surfaces the resolved repository root — Important

- **Traces to:** [Friction #6](./friction-log.md#6-crew-task-runner-writes-to-an-isolated-folder-not-the-repo--) —
  a review reported "no work found" because it inspected the runner's own working
  directory while every commit had landed in the actual repo.
- **Request:** The task runner should surface the resolved repository root it
  acted on (and the latest commit there), so a reviewer does not mistake an empty
  scratch directory for "no work done".
- **Why it matters:** The failure mode is a false negative on real, committed
  work — a reviewer can conclude a whole phase was skipped. Mitigated by starting
  every phase with `Set-Location` and verifying against the repo's `git log`.
- **Priority rationale:** Important — it does not break the build, but it can
  cause a correct run to be judged a failure.
