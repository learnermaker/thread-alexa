# Thread Lens MCP App — Design

## Architecture
```
web/lens/
  index.html          Vite entry
  src/
    main.tsx          App bootstrap (ext-apps connect)
    App.tsx           Mode router
    modes/            One component per mode
    ui.tsx            Shared UI primitives (StatusChip, Card, Badge)
    theme.css         CSS custom properties, system font, WCAG AA palette
  vite.config.ts      singlefile output → web/dist-lens/index.html
  tsconfig.json       React JSX, strict
```

## Mode routing
1. The `App` class connects via `PostMessageTransport`.
2. `ontoolinput` fires with `{ arguments }` → ignored (we wait for result).
3. `ontoolresult` fires with `{ structuredContent, content }`.
4. The host context's `toolInfo.tool.name` identifies which tool produced the result.
5. A router picks the mode component from tool name + structuredContent fields.

## Mode → component mapping

| Mode | Component | Data source (structuredContent) |
|---|---|---|
| OVERVIEW | `<Overview>` | `{ threads: Thread[], members: Person[] }` |
| RIPPLE | `<Ripple>` | `{ threads: [{title, severity, why}], proposals }` |
| ACTIVE | `<Active>` | `{ thread: Thread }` where status ∈ {ACTIVE, PLAN_SECURED} |
| AT_RISK | `<AtRisk>` | `{ thread: Thread }` where status ∈ {AT_RISK, NEEDS_ATTENTION} |
| HANDOFF | `<Handoff>` | `{ handoff, candidates, thread, requires_confirmation? }` |
| RECEIPT | `<Receipt>` | receipt object with shared[] and withheld[] |
| SECURED/RESOLVED | `<Resolved>` | `{ thread: Thread }` where status ∈ {PLAN_SECURED, RESOLVED} |

## Visual design
- Dark background (#0F172A), light text (#F8FAFC) — WCAG AA on dark.
- Status colours: green (secured/resolved), amber (active/handoff), red (at-risk), blue (overview/receipt).
- Cards: rounded corners (12px), subtle border, max 5 visible at once.
- Horizontal scroll for OVERVIEW carousel.
- `prefers-reduced-motion: reduce` disables transitions.
- System font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

## Server integration
- `server/local.ts` reads `web/dist-lens/index.html` if it exists, otherwise returns the placeholder.
- `buildMcpServer` already calls `deps.lensHtml()`.
- A `build:lens` npm script runs `vite build --config web/lens/vite.config.ts`.
