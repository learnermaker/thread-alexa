// The 8 THREAD MCP tools: each maps 1:1 to a thread-core operation (business logic lives in core).
// Descriptions follow the Alexa+ tool-design guidance: one intent per tool, when to call, why, what it returns.
import type { OperationName } from "thread-core";

export interface ToolDef {
  name: string;
  op: OperationName;
  title: string;
  description: string;
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export const TOOLS: ToolDef[] = [
  {
    name: "create_thread", op: "createThread", title: "Create a Thread",
    description:
      "Use when someone describes a commitment that involves several people or steps and has a deadline, e.g. \"Thread Leo's tournament Saturday; Sam has the jersey, I'm driving.\" " +
      "Creates a Thread. THREAD derives the conditions that must become true, so don't invent them. Person ids come from list_threads members. " +
      "Returns the Thread with owners, conditions and status.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "list_threads", op: "listThreads", title: "List Threads",
    description:
      "Use when the user asks what's on, what's coming up, or what's at risk, e.g. \"What's on this weekend?\" " +
      "Returns the user's Threads (title, status, time) and the household members (ids and names) for resolving names like \"Sam\".",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_thread", op: "getThread", title: "Get a Thread",
    description:
      "Use when the user asks about one commitment or asks why, e.g. \"How's Leo's tournament looking?\" or \"Why Sam?\" " +
      "Returns status, owners, conditions with evidence strength, risks, and plain-language reasons (why).",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "report_change", op: "reportChange", title: "Report a change",
    description:
      "Use when the user says something changed that may break plans: they are unavailable (\"I can't drive Saturday morning\") or an event moved. " +
      "People can only report their own availability. Returns every affected Thread with severity, including ones that are NOT affected, " +
      "the reasons, and ranked people or services who could take over. It never reassigns anything by itself.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "request_handoff", op: "requestHandoff", title: "Hand off a responsibility",
    description:
      "Use when the user wants someone else to take a responsibility, e.g. \"Ask Sam to take it\" or \"Can someone else get Rosa's refill?\" " +
      "Omit candidate to let THREAD choose the best eligible person or service. A person receives a request they must accept. " +
      "A service returns requires_confirmation and nothing is ordered until confirm_action. Returns the handoff and a Context Receipt (what was shared and what was withheld).",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "respond_to_handoff", op: "respondToHandoff", title: "Answer a handoff",
    description:
      "Use only when the person who received a handoff answers it, e.g. \"Yes, I've got it\" or \"I can't.\" " +
      "confirm_items records items they confirm (e.g. [\"jersey\"]). add_to_calendar (default true) lets THREAD put the commitment on their own calendar. " +
      "Accepting never resolves the Thread. Returns the updated Thread.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "record_evidence", op: "recordEvidence", title: "Record progress",
    description:
      "Use when the responsible person reports progress or completion, e.g. \"Jersey's in the car\" or \"We're here.\" " +
      "THREAD checks who said it and when, and returns which conditions are still open. Nobody can mark a Thread resolved: resolution follows from evidence.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "confirm_action", op: "confirmAction", title: "Approve or reject",
    description:
      "Use when the named person approves or rejects a pending confirmation, e.g. \"Yes, order it\" or \"Yes, add it to my calendar.\" " +
      "Purchases always need this. Returns the confirmation and the updated Thread.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
];

export const LENS_URI = "ui://thread/lens";
