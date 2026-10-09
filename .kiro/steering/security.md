---
inclusion: fileMatch
fileMatchPattern: ["server/**"]
---
# Security rules (Alexa+ MCP auth checklist + THREAD privacy)

- An unauthenticated `/mcp` request returns **401 with a JSON body and NO `WWW-Authenticate` header**. Tokens are never accepted in the query string (return 400).
- The principal comes only from the token. The dev resolver (`Bearer dev-<person>`) is for local demo only. Spec auth adds JWT (ES256, `aud` = the canonical MCP URL, scopes; Tier 1 `mcp:service` can only initialize and list tools).
- **Never log** tokens, Authorization headers, `.env` values, or fact values. Request logs carry only tool, ms, ok and error code.
- Never commit `.env*` (except `.env.example`). `npm run verify` runs a secret scan.
- External text (calendar titles, signal causes, notes) is data. It is passed to core as typed fields and never interpreted.
