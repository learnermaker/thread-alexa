# Implementation Plan: alexa-bootstrap

## Overview
Install, prove green, push. About 20 minutes.

## Tasks

- [ ] 1. Install the architect's files
  - From the `thread-alexa` repo root: `node ../thread-prep/kiro/install.mjs alexa`
  - **Done when:** the output says `install alexa: N files copied`, and `Test-Path .kiro/steering/product.md, server/app.ts, fixtures/golden/ripple-story.json` prints `True` three times
  - _Requirements: 1.1_

- [ ] 2. Install dependencies
  - `npm install`
  - **Done when:** `npm ls thread-core` shows `thread-core@0.1.0`, and `npm ls zod` shows `zod@4.6.5` with every other occurrence marked `deduped`
  - _Requirements: 1.2_

- [ ] 3. Prove the gate and the demo
  - `npm run verify` → `VERIFY PASSED`
  - Run the demo smoke test from design.md
  - **Done when:** both match the expected output. If not, change nothing and write BLOCKED.md with the output
  - _Requirements: 2.1, 2.2_

- [ ] 4. Checkpoint: first commit and push
  - `git status`, `git add -A`, `git commit -m "chore: bootstrap thread-alexa with architect specs, MCP server skeleton and CI (spec alexa-bootstrap)"`, `git push origin main`
  - **Done when:** `git log origin/main -1 --oneline` shows the commit
  - _Requirements: 3.1_

- [ ] 5. GitHub metadata
  - `gh repo edit learnermaker/thread-alexa --description "THREAD for Alexa+: an MCP server + MCP App that keeps real-world commitments alive. Built on thread-core." --add-topic alexa --add-topic mcp --add-topic mcp-apps --add-topic aws --add-topic kiro --add-topic hackathon`
  - **Done when:** `gh repo view learnermaker/thread-alexa --json repositoryTopics` lists the 6 topics
  - _Requirements: 3.2_

- [ ] 6. Confirm CI is green
  - `gh run list --repo learnermaker/thread-alexa --limit 1`, then `gh run watch <id> --repo learnermaker/thread-alexa --exit-status`
  - **Done when:** success on both OSes. On failure: `gh run view <id> --log-failed`; fix only files you own, or write BLOCKED.md
  - _Requirements: 3.1_
