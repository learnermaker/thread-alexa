// Live agent (OFF by default): Bedrock Converse with tool use, acting as the device's person.
// Enabled only when LIVE_AGENT=true AND AWS credentials resolve. ANY error throws, so the
// /api/agent handler falls back to the scripted agent — the demo never breaks on a live failure.
import { readFileSync } from "node:fs";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import type { McpClients } from "./mcp-client.ts";

const MODEL = process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-haiku-5-5";
const DAILY_CAP = Number(process.env.LIVE_AGENT_DAILY_CAP ?? "50");
const MAX_TOOL_ROUNDS = 5; // one THREAD action per utterance is the norm; cap the loop regardless.

// Per-day call counter (process-local; the AWS section's rate ceiling, not a billing control).
let day = new Date().toISOString().slice(0, 10);
let used = 0;
function underCap(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; used = 0; }
  if (used >= DAILY_CAP) return false;
  used++;
  return true;
}

export function liveAgentEnabled(): boolean {
  return process.env.LIVE_AGENT === "true";
}

function systemPrompt(): string {
  // First version lives at skills/thread/SKILL.md (polished in Phase 7).
  return readFileSync(new URL("../../skills/thread/SKILL.md", import.meta.url), "utf8");
}

/** Our MCP tools -> Bedrock toolConfig. inputSchema is the tool's JSON Schema object. */
function toToolConfig(tools: Array<{ name: string; description?: string; inputSchema: unknown }>): Tool[] {
  // The SDK's Tool/ToolInputSchema unions carry a $unknown member; the {json} shape is the documented
  // ToolSpec form, cast at this boundary rather than fighting the generated union types.
  return tools.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description ?? t.name,
      inputSchema: { json: t.inputSchema as Record<string, unknown> },
    },
  }) as unknown as Tool);
}

export interface LiveResult { reply: string; lastTool?: string; structuredContent?: Record<string, unknown> }

/** Run one user turn through Bedrock as `person`, executing THREAD tools over MCP. Throws on any error. */
export async function runLiveAgent(mcp: McpClients, person: string, text: string): Promise<LiveResult> {
  if (!underCap()) throw new Error("live agent daily cap reached");
  const client = new BedrockRuntimeClient({}); // region + creds from the default chain
  const toolConfig = { tools: toToolConfig(await mcp.listTools()) };
  const messages: Message[] = [{ role: "user", content: [{ text }] }];
  let lastTool: string | undefined;
  let structuredContent: Record<string, unknown> | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const out = await client.send(new ConverseCommand({
      modelId: MODEL,
      system: [{ text: systemPrompt() }],
      messages,
      toolConfig,
      inferenceConfig: { maxTokens: 1024, temperature: 0 },
    }));
    const content = out.output?.message?.content ?? [];
    messages.push({ role: "assistant", content });

    const toolUses = content.filter((b): b is ContentBlock.ToolUseMember => "toolUse" in b);
    if (out.stopReason !== "tool_use" || toolUses.length === 0) {
      const reply = content.map((b) => ("text" in b ? b.text : "")).join(" ").trim();
      return { reply: reply || "Done.", lastTool, structuredContent };
    }

    const results: ContentBlock[] = [];
    for (const u of toolUses) {
      const { name, input, toolUseId } = u.toolUse;
      const r = await mcp.call(person, name!, (input ?? {}) as Record<string, unknown>);
      lastTool = name;
      if (r.structuredContent) structuredContent = r.structuredContent;
      const textOut = (r.content ?? []).map((c) => c.text ?? "").join("\n");
      results.push({ toolResult: { toolUseId: toolUseId!, content: [{ text: textOut || "ok" }], status: r.isError ? "error" : "success" } });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("live agent exceeded tool-round cap");
}
