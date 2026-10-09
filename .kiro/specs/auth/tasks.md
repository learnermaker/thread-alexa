# Implementation Plan: auth

- [ ] 1. Install the reference implementation
  - Copy the 6 files listed in design.md from `../thread-prep/kiro/reference/thread-alexa-ref/` (overwrite), then run `npm install --save-exact jose@6.2.12`
  - **Done when:** `npm run verify` passes (the existing golden-over-MCP and conformance tests still pass with dev tokens)
  - _Requirements: 4.3_
- [ ] 2. Checkpoint: commit `feat(auth): embedded OAuth authorization server (spec auth, task 1)`, then push
- [ ] 3. Conformance tests A1–A21
  - Create `server/test/oauth-harness.ts` and `server/test/auth.test.ts` per design.md. Fix code only where a test proves a bug; note each fix in the commit
  - **Done when:** `npx vitest run server/test/auth.test.ts` passes all 21, and `npm run verify` passes
  - _Requirements: 1.1–1.3, 2.1–2.3, 3.1–3.4, 4.1–4.4_
- [ ] 4. Docs: the readiness rows, ADR 0005, and the README sign-in section per design.md
  - **Done when:** the files are updated and `npm run verify` passes
- [ ] 5. Checkpoint: commit `test(auth): Alexa+ auth checklist conformance A1-A21 (spec auth, tasks 3-4)`, push, and confirm CI green
