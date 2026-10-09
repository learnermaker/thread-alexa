# THREAD for Alexa+ — *Don't lose the thread.*

THREAD keeps real-world commitments alive across people, events and apps. When something changes, it finds what is affected, moves responsibility to the right person, shares only the necessary context, and stays with the commitment until it is actually resolved.

**Status:** under construction for the Amazon "Build, Ship, Shape" hackathon (Alexa+ track). Full README, video and live link arrive before submission.

- Self-hosted **MCP server** (spec 2025-11-25, Streamable HTTP) with 8 tools, built on [thread-core](https://github.com/learnermaker/thread-core)
- Local run, no cloud account needed: `npm install` then `npm run demo`
- Built spec-first with Kiro: see `.kiro/specs/` and `docs/kiro-log.md`

License: Apache-2.0

## Connect with MCP Inspector

1. Start the demo server: `npm run demo`
2. In another terminal: `npx @modelcontextprotocol/inspector`
3. In the Inspector UI:
   - Transport: **Streamable HTTP**
   - URL: `http://localhost:8787/mcp`
   - Add header — `Authorization`: `Bearer dev-maya`
4. Click **Connect** — you should see 8 tools and the Thread Lens resource.

## Sign-in (OAuth)

The demo server embeds a small OAuth 2.1 authorization server (ES256 JWTs, no cloud account). Discovery URLs:

- Authorization server metadata: `http://localhost:8787/.well-known/oauth-authorization-server`
- Protected-resource metadata: `http://localhost:8787/.well-known/oauth-protected-resource`
- Public signing keys (JWKS): `http://localhost:8787/oauth/jwks`

Two token tiers: **Tier 1** (`client_credentials`, scope `mcp:service`) may only `initialize` and `tools/list`; **Tier 2** (`authorization_code` + PKCE, scopes `mcp:tools` / `mcp:resources`) acts as a signed-in household member.

> **DEMO_MODE** (`DEMO_MODE=true`, the default locally) auto-consents: `/oauth/authorize` with a `login_hint` redirects immediately without showing the person picker. This is a demo convenience and is disclosed here; set `DEMO_MODE=false` to require the picker. Dev tokens (`Bearer dev-<person>`) are enabled by `AUTH_DEV_TOKENS=true` for the Inspector and tests, and are disabled on AWS.
