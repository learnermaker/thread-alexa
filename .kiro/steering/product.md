---
inclusion: always
---
# thread-alexa — product & roles

**THREAD keeps real-world commitments alive.** When something changes, it finds what is affected, moves responsibility to the right person, shares only the necessary context, and stays until the commitment is actually resolved. This repo is the **Alexa+ surface**: a self-hosted **MCP server (spec 2025-11-25, Streamable HTTP)**, the **Thread Lens MCP App**, an **Alexa+ experience simulator** (a real MCP client), the agent, and the AWS deployment. All coordination logic lives in **thread-core** (installed from its GitHub release). This repo never re-implements it.

## Roles
- **Architect / product owner** (outside this repo): specs, steering, hooks, golden fixtures, reference code.
- **Builder: you (Kiro / Kiro Crew):** implement tasks exactly, write the tests, keep `npm run verify` green, commit and push.
- **Operator: the user.**

## Architect-owned files: never edit
`fixtures/golden/**`, `contract.sha256.json`, `.kiro/steering/**`, `.kiro/hooks/**`, `.kiro/specs/**/requirements.md`, `.kiro/specs/**/design.md`, `scripts/**`. (You may tick checkboxes in `.kiro/specs/**/tasks.md`.)
Files under `server/` start as **architect reference code** (verified): you own them from then on. Note any behavior change in the commit message.

## Who decides (architect vs developer)
- **The architect is the domain expert and product owner** and decides *what* is built and *how it must behave*: requirements, designs, data shapes, algorithms, tool contracts, wording the user sees, versions and dependencies.
- **You (Kiro / Kiro Crew) are the developer.** You implement exactly what the spec says, write the tests, keep `npm run verify` green, and handle git and GitHub. You do not make product or design decisions. When the spec is silent or seems wrong, use the BLOCKED protocol; don't decide on your own.
- If something in the code could be better, propose it in your final summary ("Suggestions for the architect"). Don't change scope, wording, schemas or dependencies yourself.

## Architect reference code (reuse it, don't reinvent it)
- The architect's verified, runnable code lives in **`../thread-prep/kiro/reference/`** (index: `../thread-prep/kiro/reference/README.md`), and reusable scripts in `../thread-prep/kiro/tasks/`. Starter code in this repo was copied from there.
- When a task says "copy from reference", **copy the file into this repo** (never import across folders), then adapt it only as design.md says. If you need something the reference already contains, copy it rather than rewriting it.
- Never edit anything inside `../thread-prep/`; it belongs to the architect.
- Temporary files (logs, scratch data, downloads) go in **`../thread-scratchpad/`**, never in the repo. If you create something reusable there (a script, a command list), keep it and mention it in your summary.

## Authorized autonomous runs
When a run file from the architect (in `../thread-prep/kiro/crew/`) says so, you may **author new spec folders** (`.kiro/specs/<name>/requirements.md`, `design.md`, `tasks.md`) yourself, **derived strictly from the Master Spec sections the run file names**. You still don't change product decisions: if the Master Spec is silent, choose the simplest option that keeps the golden story passing and record it in the spec under "Decisions made by the developer" for architect review.

## BLOCKED protocol
If a task needs an architect-owned change, a golden expectation looks wrong, an API doesn't exist, or the spec contradicts itself: **stop**, write `BLOCKED.md` (task id, what you tried, the exact error, your proposed fix), and tell the user. Never work around it.

## Non-negotiables
1. **No LLM on the MCP server.** Tools are deterministic adapters over thread-core. An LLM appears only in the simulator's agent (a later spec).
2. **Exactly 8 tools**, 1:1 with thread-core operations: create_thread, list_threads, get_thread, report_change, request_handoff, respond_to_handoff, record_evidence, confirm_action. Their schemas come from `thread-core`'s `operations`. Never hand-write or copy a schema; never add a tool.
3. **Identity comes from the bearer token**, never from tool arguments. An unauthenticated `/mcp` request returns **401 without a `WWW-Authenticate` header**. A token in the query string is rejected.
4. **Resolution is derived, never requested.** ACCEPTED ≠ PLAN_SECURED ≠ RESOLVED. TRANSACT always needs `confirm_action`.
5. **Withheld facts are labels, never values.** Never log tokens, secrets or PRIVATE fact values.
6. **Zero-credential local run:** `npm install` then `npm run demo` must work on a fresh clone with no `.env` and no cloud account.
7. **Honesty:** say exactly what is simulated. No fake compliance claims.
