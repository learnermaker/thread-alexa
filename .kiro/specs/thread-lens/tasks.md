# Thread Lens MCP App — Tasks

## Task 1: Build pipeline
- [x] Install approved deps: react, react-dom, @vitejs/plugin-react, vite-plugin-singlefile, @types/react, @types/react-dom
- [x] Create `web/lens/vite.config.ts` (singlefile → `web/dist-lens/`)
- [x] Create `web/lens/tsconfig.json` (React JSX, strict)
- [x] Create `web/lens/index.html` (Vite entry)
- [x] Add `build:lens` script to package.json
- [x] Verify `npm run build:lens` produces `web/dist-lens/index.html`

## Task 2: MCP App bootstrap
- [x] Create `web/lens/src/main.tsx` — init ext-apps `App`, connect, wire events
- [x] Wire `ontoolresult` to update React state with structuredContent + tool name

## Task 3: Seven mode components
- [x] `<Overview>` — carousel of Thread cards with status chip and deadline
- [x] `<Ripple>` — change centre, affected threads fanned out, "not affected" for NONE
- [x] `<Active>` — objective, owner map, conditions
- [x] `<AtRisk>` — broken link (red), severity, why[]
- [x] `<Handoff>` — from → to (person or service), amount for TRANSACT, acceptance state
- [x] `<Receipt>` — shared vs withheld columns
- [x] `<Resolved>` — condition checklist with evidence-strength badges

## Task 4: Theme and accessibility
- [x] CSS custom properties, WCAG AA palette, system font
- [x] `prefers-reduced-motion` respected
- [x] Semantic HTML, large type (≥18px)
- [x] Neutral THREAD branding header

## Task 5: Server integration
- [x] Update `server/local.ts` lensHtml to read built file (fallback to placeholder)
- [x] Verify `npm run verify` passes

## Task 6: Commit and push
- [x] `git add -A && git commit -m 'feat(lens): Thread Lens MCP App' && git push`
