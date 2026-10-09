# Design Document: alexa-bootstrap

## Overview
No new product code. The installer copies the architect's verified server skeleton (`server/`), which already serves the 8 MCP tools over thread-core and passes the golden story over MCP (verified Oct 8: 4/4 tests, about 150 ms for the ripple). This spec makes it green in the real repo and pushes it.

## What gets installed
```text
always overwritten : .kiro/steering, .kiro/hooks, .kiro/specs/*/requirements.md + design.md, scripts/**,
                     fixtures/golden/**, contract.sha256.json, LICENSE, NOTICE, .gitattributes, .nvmrc
copied if missing  : server/**, package.json, tsconfig.json, vitest.config.ts, README.md, AGENTS.md, .gitignore,
                     .env.example, .github/workflows/ci.yml, .kiro/specs/*/tasks.md
```

## Demo smoke test (PowerShell)
```powershell
$job = Start-Job { Set-Location $using:PWD; npm run demo }
Start-Sleep 6
Invoke-RestMethod http://localhost:8787/health
try { Invoke-WebRequest -Method Post http://localhost:8787/mcp -Body '{}' -ContentType 'application/json' } catch { $_.Exception.Response.StatusCode.value__; $_.Exception.Response.Headers['WWW-Authenticate'] }
Stop-Job $job; Remove-Job $job
node scripts/clean.mjs .data
```
Expected: `ok: True, protocol: 2025-11-25`, then `401`, then an empty WWW-Authenticate line.

## Error handling
- `npm install` fails on `thread-core` (404/403): the core release isn't public yet → BLOCKED.md ("waiting for thread-core v0.1.0 public").
- If `../thread-prep` isn't reachable from the agent, ask the user to run the install command.
- Push rejected: `git pull --rebase origin main`, then push. Never force.

## Don'ts
- Don't change dependency versions or edit `scripts/**`. Don't commit `.data/`.
