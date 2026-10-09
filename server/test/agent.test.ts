// The scripted agent over REAL MCP: each story beat's utterance, routed to its device's person,
// drives exactly its tool calls and ends with Tournament RESOLVED, Refill RESOLVED, Dinner PLAN_SECURED.
// Mirrors the e2e's assertions without a browser, so a regression is caught in `npm run verify`.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "./harness.ts";
import { mcpClients } from "../agent/mcp-client.ts";
import { agentHandler } from "../agent/handler.ts";
import { loadStory } from "../agent/story.ts";

let s: TestServer;
let mcp: ReturnType<typeof mcpClients>;

beforeAll(async () => {
  s = await startServer();
  mcp = mcpClients(s.base);
});
afterAll(async () => {
  await mcp.close();
  await s.close();
});

describe("scripted agent", () => {
  test("plays every beat and reaches the resolved end state", async () => {
    const story = loadStory();
    const handle = agentHandler({ mcp, deviceToPerson: { echo: "maya", phone: "sam" }, story });

    for (const beat of story.beats) {
      s.clock.set(beat.clock);
      if (!beat.utterance) continue;
      const r = await handle(beat.device, beat.utterance);
      expect(r.live, beat.id).toBe(false);
      expect(r.reply.length, beat.id).toBeGreaterThan(0);
      // Beats that call a tool must surface a Lens result named after that tool's name.
      const last = beat.tool_calls.at(-1);
      if (last) {
        expect(r.lens, beat.id).toBeTruthy();
        expect(r.lens!.toolName, beat.id).toBe(last.name);
      }
    }

    // Final overview after the agent beats: the tournament is done (agent recorded arrival),
    // the refill is secured by the agent (its delivery RESOLVES on the watcher tick — covered by the e2e,
    // which runs the full demo server with the watcher), and dinner was never at risk.
    const summary = await handle("echo", "How did the weekend go?");
    expect(summary.reply).toContain("Leo's Saturday Tournament (done)");
    expect(summary.reply).toContain("Rosa's prescription refill (plan secured)");
    expect(summary.reply).toContain("Family dinner (plan secured)");
  });

  test("an unmatched utterance gets a safe fallback, no Lens", async () => {
    const handle = agentHandler({ mcp, deviceToPerson: { echo: "maya", phone: "sam" }, story: loadStory() });
    const r = await handle("echo", "what's the weather on mars");
    expect(r.live).toBe(false);
    expect(r.lens).toBeUndefined();
    expect(r.reply.length).toBeGreaterThan(0);
  });
});
