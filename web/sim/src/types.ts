// View types for the simulator SPA. Kept to the fields the UI reads.

export interface Person { id: string; name: string }
export interface Household { household_id: string; persons: Person[] }
export interface ClockState { iso: string; presets: string[] }
export interface LogEntry { tool: string; ms: number; ok: boolean; code?: string }

// A line in a device's voice-style transcript.
export interface Turn { who: "you" | "thread"; text: string }

// What the Echo Show feeds the Lens: the tool name and its structuredContent.
export interface LensResult { toolName: string; structuredContent: Record<string, unknown> }

// A handoff item shown in Sam's inbox (shape from thread-core inbox output; only read fields typed).
export interface InboxItem {
  handoff_id?: string;
  id?: string;
  thread_id?: string;
  thread_title?: string;
  title?: string;
  summary?: string;
  status?: string;
}
export interface Inbox { items?: InboxItem[]; handoffs?: InboxItem[] }
