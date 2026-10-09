// Voice-only summaries (MCP text content). Short (<= ~25 words), one idea, no ids, no private values.
import type { OperationName } from "thread-core";

const STATUS: Record<string, string> = {
  ACTIVE: "on track", AT_RISK: "at risk", HANDOFF_PENDING: "waiting on a handoff", PLAN_SECURED: "plan secured",
  RESOLVED: "done", NEEDS_ATTENTION: "needs your attention", EXPIRED: "missed", CANCELLED: "cancelled",
};
const word = (s: string) => STATUS[s] ?? s.toLowerCase();
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// `d` is the operation output, already validated against the core output schema.
export function speak(op: OperationName, d: any): string {
  switch (op) {
    case "listThreads":
      return d.threads.length === 0 ? "You have no plans right now."
        : `You have ${d.threads.length} plan${d.threads.length > 1 ? "s" : ""}: ${list(d.threads.map((t: any) => `${t.title} (${word(t.status)})`))}.`;
    case "getThread":
    case "createThread": {
      const t = d.thread;
      const open = t.conditions.filter((c: any) => !c.satisfied).map((c: any) => c.label.toLowerCase());
      return `${t.title}: ${word(t.status)}.${open.length ? ` Still open: ${list(open)}.` : ""}`;
    }
    case "reportChange": {
      const hit = d.threads.filter((t: any) => t.severity !== "NONE").map((t: any) => t.title);
      const fine = d.threads.filter((t: any) => t.severity === "NONE").map((t: any) => t.title);
      const best = d.proposals[0]?.recommended?.name;
      if (hit.length === 0) return `Nothing is affected${fine.length ? `: ${list(fine)} ${fine.length > 1 ? "are" : "is"} fine` : ""}.`;
      return `This affects ${list(hit)}.${fine.length ? ` ${list(fine)} ${fine.length > 1 ? "are" : "is"} fine.` : ""}${best ? ` Best option: ${best}.` : ""}`;
    }
    case "requestHandoff":
      return d.requires_confirmation ? `${d.requires_confirmation.summary}. Want me to go ahead?`
        : `I've asked ${d.candidates.find((c: any) => c.id === d.handoff.to)?.name ?? "them"}, sharing only what they need.`;
    case "respondToHandoff":
      return d.handoff.status === "ACCEPTED" ? `Thanks. ${d.thread.title}: ${word(d.thread.status)}.`
        : `Okay. ${d.next_candidate ? `Next option: ${d.next_candidate.name}.` : "I'll let them know."}`;
    case "recordEvidence":
      return d.evidence.satisfied ? `Got it. ${d.thread.title}: ${word(d.thread.status)}.` : `Noted, but it doesn't count yet: ${d.evidence.reason}.`;
    case "confirmAction":
      return d.confirmation.status === "APPROVED" ? `Done. ${d.thread.title}: ${word(d.thread.status)}.` : "Okay, cancelled.";
  }
}
