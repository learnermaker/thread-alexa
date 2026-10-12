import type { Status, Severity, Strength } from "./types.ts";

export function Brand() {
  return (
    <div className="brand">
      <h1>THREAD</h1>
      <span className="tag">Don't lose the thread.</span>
    </div>
  );
}

const STATUS_WORD: Record<Status, string> = {
  ACTIVE: "On track", AT_RISK: "At risk", HANDOFF_PENDING: "Waiting on handoff",
  PLAN_SECURED: "Plan secured", RESOLVED: "Resolved", NEEDS_ATTENTION: "Needs attention",
  EXPIRED: "Missed", CANCELLED: "Cancelled",
};
const STATUS_TONE: Record<Status, string> = {
  ACTIVE: "amber", AT_RISK: "red", HANDOFF_PENDING: "amber",
  PLAN_SECURED: "green", RESOLVED: "green", NEEDS_ATTENTION: "red",
  EXPIRED: "red", CANCELLED: "red",
};
export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_WORD[status]}</span>;
}

const SEV_TONE: Record<Severity, string> = { NONE: "green", LOW: "amber", MEDIUM: "amber", HIGH: "red", CRITICAL: "red" };
export function SeverityChip({ severity }: { severity: Severity }) {
  return <span className={`chip ${SEV_TONE[severity]}`}>{severity === "NONE" ? "Not affected" : severity}</span>;
}

const STRENGTH_WORD: Record<Strength, string> = { ATTESTED: "Attested", SYSTEM_VERIFIED: "Verified", OUTCOME: "Confirmed" };
export function StrengthBadge({ strength }: { strength?: Strength }) {
  if (!strength) return null;
  return <span className="badge">{STRENGTH_WORD[strength]}</span>;
}

// The demo household is America/Los_Angeles; the host may override via timeZone context.
export function fmtDayTime(iso?: string, tz = "America/Los_Angeles") {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short", hour: "numeric", minute: "2-digit", timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function fmtMoney(cents?: number) {
  if (cents == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
