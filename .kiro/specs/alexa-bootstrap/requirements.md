# Requirements Document: alexa-bootstrap

## Introduction
Set up the `thread-alexa` repository on a green, guarded baseline: the architect's files installed, thread-core installed from its **v0.1.0 GitHub release**, pinned dependencies, the `npm run verify` gate (which already includes the golden story over real MCP), Kiro hooks, CI on Windows and Ubuntu, a zero-credential `npm run demo`, and the first push. (Master Spec §D1, §D18; FAILURE_MODES W7, I6.)
**Prerequisite:** thread-core `v0.1.0` is released **and public** (spec core-package-oss); otherwise the dependency download fails.

## Glossary
- **Repo**: `../thread-alexa` (remote `learnermaker/thread-alexa`).
- **Verify_Gate**: `npm run verify` (contract checksums, dependency allowlist, secrets, typecheck, tests).

## Requirements

### Requirement 1: Install and dependencies
#### Acceptance Criteria
1. WHEN `node ../thread-prep/kiro/install.mjs alexa` runs from the Repo root THE Repo SHALL contain `.kiro/steering/product.md`, `.kiro/specs/mcp-tools/tasks.md`, `server/app.ts` and `fixtures/golden/ripple-story.json`.
2. WHEN `npm install` completes THE Repo SHALL resolve `thread-core@0.1.0` from the release tarball, with a single shared `zod@4.6.5` (`npm ls zod` shows only deduped copies).

### Requirement 2: Green baseline
#### Acceptance Criteria
1. WHEN `npm run verify` runs THE Verify_Gate SHALL print `VERIFY PASSED`, which includes the golden story over MCP test.
2. WHEN `npm run demo` runs with no `.env` THE server SHALL print its MCP URL, `GET /health` SHALL return `{"ok":true,"protocol":"2025-11-25"}`, and `POST /mcp` without a token SHALL return 401 with no `WWW-Authenticate` header.

### Requirement 3: Repository on GitHub with CI
#### Acceptance Criteria
1. WHEN the bootstrap commit is pushed THE CI workflow SHALL pass `npm ci` and `npm run verify` on `ubuntu-latest` and `windows-latest`.
2. THE GitHub repository SHALL have a description and the topics `alexa`, `mcp`, `mcp-apps`, `aws`, `kiro`, `hackathon`.
