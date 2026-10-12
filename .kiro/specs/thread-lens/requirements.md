# Thread Lens MCP App — Requirements

## Overview
The Thread Lens is an MCP App rendered as a single HTML resource (`ui://thread/lens`) that visualises tool `structuredContent` on an Echo-Show-like inline canvas.

## Requirements (EARS format)

### R1 — Resource registration
When the MCP server starts, the system SHALL register an HTML resource at `ui://thread/lens` with MIME type `text/html;profile=mcp-app`.

### R2 — Single-file build
The Lens SHALL be built by Vite + vite-plugin-singlefile into one self-contained `web/dist-lens/index.html` with all CSS, JS and assets inlined.

### R3 — MCP App protocol
The Lens SHALL use the `@modelcontextprotocol/ext-apps` `App` class to:
- connect to the host via PostMessageTransport
- receive `toolinput` and `toolresult` notifications
- render the appropriate mode from `structuredContent`

### R4 — Seven display modes
The Lens SHALL render these modes, chosen from the tool name and structuredContent shape:

| Mode | Trigger |
|---|---|
| OVERVIEW | `list_threads` result (carousel of Thread cards) |
| RIPPLE | `report_change` result (change centre, severity fan-out, "not affected") |
| ACTIVE | `get_thread` / `create_thread` where status is ACTIVE or PLAN_SECURED |
| AT_RISK | `get_thread` where status is AT_RISK or NEEDS_ATTENTION |
| HANDOFF | `request_handoff` result (person or service + amount) |
| RECEIPT | `request_handoff` / `respond_to_handoff` with receipt (shared vs withheld) |
| SECURED / RESOLVED | `get_thread` / `record_evidence` / `confirm_action` where status is PLAN_SECURED or RESOLVED |

### R5 — Echo Show design
The Lens SHALL display at most 5 primary elements, use large type (≥18px body), and be readable at arm's length.

### R6 — Accessibility
The Lens SHALL meet WCAG AA contrast (4.5:1 text, 3:1 large text/UI), respect `prefers-reduced-motion`, and use semantic HTML.

### R7 — Branding
The Lens SHALL use neutral THREAD branding. No third-party logos.

### R8 — System font
The Lens MAY use the system font stack. No self-hosted fonts required at this phase.

### R9 — Degradation
When the Lens HTML is missing, the server SHALL serve a placeholder page.
