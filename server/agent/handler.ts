// POST /api/agent {device, text} -> {reply, live, lens?}. The simulator's one agent entry point.
// Scripted by default: match the utterance to a story beat and make exactly its THREAD tool calls
// over real MCP, as the beat's own person. Live only when enabled; any live error falls back to
// scripted so the demo is always deterministic.
import type { Hono } from "hono";
import { speak } from "../mcp/speak.ts";
import { TOOLS } from "../mcp/tools.ts";
import type { McpClients } from "./mcp-client.ts";
import { loadStory, matchBeat, type Beat, type Story } from "./story.ts";
import { liveAgentEnabled, runLiveAgent } from "./live.ts";

export interface AgentDeps {
  mcp: McpClients;
  /** device -> person id. Echo = Maya, phone = Sam (resolved from the seed personas). */
  deviceToPerson: Record<string, string>;
  story?: Story;
}

export interface AgentReply { reply: string; live: boolean; lens?: { toolName: string; structuredContent: Record<string, unknown> } }

const opFor = (toolName: string) => TOOLS.find((t) => t.name === toolName)?.op;

/** Execute a beat's tool calls as the beat's person; the LAST call drives the reply + Lens. */
async function runBeat(mcp: McpClients, person: string, beat: Beat): Promise<AgentReply> {
  let reply = beat.spoken_line || "Okay.";
  let lens: AgentReply["lens"];
  for (const call of beat.tool_calls) {
    const r = await mcp.call(person, call.name, call.args);
    if (r.structuredContent) {
      lens = { toolName: call.name, structuredContent: r.structuredContent };
      const op = opFor(call.name);
      if (op) reply = speak(op, r.structuredContent);
    } else if (r.isError) {
      reply = (r.content ?? []).map((c) => c.text ?? "").join(" ").trim() || "That didn't work.";
    }
  }
  return { reply, live: false, lens };
}

export function agentHandler(deps: AgentDeps): (device: string, text: string) => Promise<AgentReply> {
  const story = deps.story ?? loadStory();
  return async (device, text) => {
    const beat = matchBeat(story, text);
    // Faithful to "runs as that device's signed-in person": use the matched beat's device when known.
    const person = deps.deviceToPerson[beat?.device ?? device] ?? deps.deviceToPerson[device];
    if (!person) return { reply: "No one is signed in on that device.", live: false };

    if (liveAgentEnabled()) {
      try {
        const r = await runLiveAgent(deps.mcp, person, text);
        const lens = r.structuredContent && r.lastTool ? { toolName: r.lastTool, structuredContent: r.structuredContent } : undefined;
        return { reply: r.reply, live: true, lens };
      } catch {
        // fall through to scripted — never break the demo on a live failure.
      }
    }

    if (beat) return runBeat(deps.mcp, person, beat);
    return { reply: "I can help with your weekend plans. Try \u201cWhat\u2019s on this weekend?\u201d", live: false };
  };
}

/** Mount POST /api/agent on the Hono app. */
export function mountAgent(app: Hono, deps: AgentDeps): void {
  const handle = agentHandler(deps);
  app.post("/api/agent", async (c) => {
    const { device, text } = await c.req.json<{ device?: string; text?: string }>();
    if (!device || !text) return c.json({ error: "provide device and text" }, 400);
    return c.json(await handle(device, text));
  });
}
