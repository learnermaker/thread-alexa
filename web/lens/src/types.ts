// Minimal structural types for the structuredContent the Lens renders.
// These mirror thread-core output (snake_case), kept to the fields the UI reads.

export type Status =
  | "ACTIVE" | "AT_RISK" | "HANDOFF_PENDING" | "PLAN_SECURED"
  | "RESOLVED" | "NEEDS_ATTENTION" | "EXPIRED" | "CANCELLED";

export type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Strength = "ATTESTED" | "SYSTEM_VERIFIED" | "OUTCOME";

export interface Condition {
  id: string;
  label: string;
  satisfied?: boolean;
  min_strength?: Strength;
  strength?: Strength;
}

export interface Responsibility {
  id: string;
  type: string;
  owner: string;
  owner_kind: "person" | "service";
  status: string;
  item?: string;
}

export interface Thread {
  id: string;
  title: string;
  objective?: string;
  status: Status;
  deadline?: string;
  event?: { start: string; end: string; place: string };
  responsibilities?: Responsibility[];
  conditions?: Condition[];
  why?: string[];
}

export interface Member { id: string; name: string }

export interface ListThreadsResult { threads: Thread[]; members?: Member[] }

export interface RippleThread { thread_id?: string; title: string; severity: Severity; why?: string[] }
export interface Proposal { recommended?: { id: string; name: string } }
export interface ReportChangeResult { threads: RippleThread[]; proposals?: Proposal[] }

export interface Candidate { id: string; name: string; eligible?: boolean; reason?: string; reasons?: { text: string; ok: boolean }[]; kind?: "person" | "service" }
export interface Receipt {
  recipient?: string;
  recipient_kind?: "person" | "service";
  shared: { key: string; label: string; value: string }[];
  withheld: { label: string }[];
}
export interface Handoff { id: string; from: string; to: string; to_kind: "person" | "service"; status: string; receipt?: Receipt }
export interface RequestHandoffResult {
  handoff?: Handoff;
  candidates?: Candidate[];
  receipt?: Receipt;
  thread?: Thread;
  requires_confirmation?: { confirmation_id: string; summary: string; amount?: number; amount_cents?: number };
}

export interface GetThreadResult { thread: Thread }
export interface RespondResult { handoff: Handoff; thread?: Thread; next_candidate?: Candidate }

export type Payload = Record<string, unknown>;
