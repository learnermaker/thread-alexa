// One SDK MCP Client per person, connected to our OWN /mcp over real Streamable HTTP.
// The agent acts AS the signed-in person: identity comes from the bearer token, never from args.
// Locally that token is the dev token ("Bearer dev-<person>", AUTH_DEV_TOKENS=true); the same
// transport works unchanged against a real person token when one is supplied.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface ToolCallResult {
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface McpClients {
  /** Call one THREAD tool as `person`, over MCP. Reuses one connected client per person. */
  call(person: string, name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
  /** The tool list (name + schemas), for the live agent's toolConfig. Cached after first call. */
  listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>>;
  close(): Promise<void>;
}

/** tokenFor(person) returns the bearer VALUE (without "Bearer "). Default: dev token. */
export function mcpClients(baseUrl: string, tokenFor: (person: string) => string = (p) => `dev-${p}`): McpClients {
  const clients = new Map<string, Promise<Client>>();
  let toolsCache: Array<{ name: string; description?: string; inputSchema: unknown }> | undefined;

  const client = (person: string): Promise<Client> => {
    let p = clients.get(person);
    if (!p) {
      p = (async () => {
        const c = new Client({ name: "thread-agent", version: "0.1.0" });
        await c.connect(
          new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer ${tokenFor(person)}` } },
          }),
        );
        return c;
      })();
      clients.set(person, p);
    }
    return p;
  };

  return {
    async call(person, name, args) {
      const c = await client(person);
      return (await c.callTool({ name, arguments: args })) as ToolCallResult;
    },
    async listTools() {
      if (!toolsCache) {
        const c = await client("maya");
        const { tools } = await c.listTools();
        toolsCache = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
      }
      return toolsCache;
    },
    async close() {
      for (const p of clients.values()) await (await p).close();
      clients.clear();
    },
  };
}
