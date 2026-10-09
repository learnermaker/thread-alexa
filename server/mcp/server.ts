// Builds one MCP server per request, bound to the principal resolved from the bearer token.
// Thin adapter: schemas come from thread-core, every tool calls exactly one core operation.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { operations, type ThreadApp } from "thread-core";
import { LENS_URI, TOOLS } from "./tools.ts";
import { speak } from "./speak.ts";

export interface McpDeps {
  core: ThreadApp;
  lensHtml: () => Promise<string>;
  onCall?: (entry: { tool: string; ms: number; ok: boolean; code?: string }) => void; // request log for the simulator drawer
}
export type PersonPrincipal = { kind: "person"; household_id: string; person_id: string };

export function buildMcpServer(deps: McpDeps, principal: PersonPrincipal): McpServer {
  const server = new McpServer({ name: "thread", title: "THREAD", version: "0.1.0" });
  for (const t of TOOLS) {
    const schema = operations[t.op];
    registerAppTool(
      server,
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: schema.input, // full zod object (not .shape): keeps strict mode -> additionalProperties: false
        outputSchema: schema.output,
        annotations: t.annotations,
        _meta: { ui: { resourceUri: LENS_URI } },
      },
      async (args: unknown) => {
        const started = performance.now();
        const r = await (deps.core[t.op] as (p: unknown, i: unknown) => Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string; next_steps: string[] } }>)(principal, args);
        deps.onCall?.({ tool: t.name, ms: Math.round(performance.now() - started), ok: r.ok, ...(r.ok ? {} : { code: r.error!.code }) });
        if (!r.ok) {
          // No structuredContent on errors: the SDK client validates it against outputSchema even when isError is true.
          const e = r.error!;
          return {
            isError: true,
            content: [
              { type: "text" as const, text: `${e.message}${e.next_steps.length ? ` Next: ${e.next_steps.join("; ")}.` : ""}` },
              { type: "text" as const, text: JSON.stringify({ error: e }) },
            ],
          };
        }
        return { content: [{ type: "text" as const, text: speak(t.op, r.data) }], structuredContent: r.data as Record<string, unknown> };
      },
    );
  }
  registerAppResource(server, "Thread Lens", LENS_URI, { description: "Visual card for Threads, ripples, handoffs and receipts." }, async () => ({
    contents: [{ uri: LENS_URI, mimeType: RESOURCE_MIME_TYPE, text: await deps.lensHtml() }],
  }));
  return server;
}
