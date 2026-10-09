# MCP Inspector CLI — Proof transcripts

**Date:** 2026-10-09  
**Inspector:** `@modelcontextprotocol/inspector` 2.10.1  
**Server commit:** `2a4812c`  
**Command:**
```
node ..\thread-scratchpad\inspector-proof.mjs --repo . --tmp ..\thread-scratchpad
```

All 8 checks ran. Exit codes match expected: 01–06 and 08 = `0`; 07 = `5` (Inspector's code for "tool returned isError: true", which is the correct outcome for that check).

| File | Proves | Observed |
|---|---|---|
| 01-initialize | protocol negotiation | `protocolVersion: "2025-11-25"`, `serverInfo.title: "THREAD"` — exact match |
| 02-tools-list | 8 tools, portable schemas | 8 tools returned (create_thread, list_threads, get_thread, report_change, request_handoff, respond_to_handoff, record_evidence, confirm_action); all schemas have `additionalProperties: false`; `--strict` exit 0 |
| 03-app-info | MCP App wiring | All 8 tools: `hasApp: true`, `resourceUri: "ui://thread/lens"`, `resourceMimeType: "text/html;profile=mcp-app"` — exact match |
| 04-lens-resource | UI resource | `mimeType: "text/html;profile=mcp-app"`, HTML body present — exact match |
| 05-report-change-ripple | the ripple | text: `"This affects Leo's Saturday Tournament and Rosa's prescription refill. Family dinner is fine. Best option: Sam."` — exact match; severities HIGH, HIGH, NONE — exact match |
| 06-request-handoff | handoff + Context Receipt | `handoff.id: "ho_1"`, `to: "sam"`, `status: "PENDING"`; withheld includes `"Maya's reason for being unavailable"` — exact match |
| 07-wrong-principal | identity comes from the token | `isError: true`, `error.code: "WRONG_PRINCIPAL"`, `content[0].text: "Only Sam can answer this handoff."` — exact match; exit code 5 as expected |
| 08-sam-accepts | the recipient accepts | `handoff.status: "ACCEPTED"`, `thread.status: "PLAN_SECURED"` — exact match |
