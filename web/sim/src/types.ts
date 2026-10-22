// View types for the simulator SPA. Kept to the fields the UI reads.

export interface Person { id: string; name: string }
export interface Household { household_id: string; persons: Person[] }
export interface ClockState { iso: string; presets: string[] }
export interface LogEntry { tool: string; ms: number; ok: boolean; code?: string }
// One raw JSON-RPC exchange on /mcp (server/app.ts WireEntry): shown in the "Under the hood" drawer.
export interface WireEntry {
  at: string; request: string; rpc: string; tool?: string; status: number; ms: number;
  as: string; via: string; req_text: string; res_text: string; res_bytes: number;
}

// A line in a device's voice-style transcript.
export interface Turn { who: "you" | "thread"; text: string }

// What the Echo Show feeds the Lens: the tool name and its structuredContent.
export interface LensResult { toolName: string; structuredContent: Record<string, unknown> }

// A story beat (subset read by the player): /api/story.
export interface Beat {
  id: string;
  clock: string;
  device: "echo" | "phone";
  utterance: string;
  expected_lens_mode: string;
  spoken_line: string;
}

// A handoff item shown in Sam's inbox (shape from thread-core inbox output; only read fields typed).
export interface InboxItem {
  handoff_id?: string;
  kind?: string; // HANDOFF_REQUEST, or a notification such as an automatic travel-time change
  text?: string;
  id?: string;
  thread_id?: string;
  thread_title?: string;
  title?: string;
  summary?: string;
  status?: string;
}
export interface Inbox { items?: InboxItem[]; handoffs?: InboxItem[]; messages?: InboxItem[] }
