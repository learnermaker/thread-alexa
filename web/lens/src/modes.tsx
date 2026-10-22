import type {
  Thread, ListThreadsResult, ReportChangeResult, RequestHandoffResult,
  GetThreadResult, RespondResult, Condition, Receipt as ReceiptT,
} from "./types.ts";
import { Brand, StatusChip, SeverityChip, StrengthBadge, fmtDayTime, fmtMoney } from "./ui.tsx";

// OVERVIEW — carousel of the weekend's Thread cards.
export function Overview({ threads }: ListThreadsResult) {
  return (
    <div className="lens">
      <Brand />
      <div className="heading">What's on</div>
      {threads.length === 0 ? (
        <p className="placeholder">No plans right now.</p>
      ) : (
        <div className="carousel">
          {threads.slice(0, 5).map((t) => (
            <div className="card" key={t.id}>
              <div className="row spread">
                <strong>{t.title}</strong>
                <StatusChip status={t.status} />
              </div>
              {t.deadline && <div className="why">By {fmtDayTime(t.deadline)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// RIPPLE — the change at the centre, affected Threads fanned out; "not affected" shown for NONE.
export function Ripple({ threads, proposals }: ReportChangeResult) {
  const best = proposals?.[0]?.recommended?.name;
  return (
    <div className="lens">
      <Brand />
      <div className="heading">What does this change affect?</div>
      {threads.slice(0, 5).map((t) => (
        <div className="card" key={t.thread_id ?? t.title}>
          <div className="row spread">
            <strong>{t.title}</strong>
            <SeverityChip severity={t.severity} />
          </div>
          {t.why?.[0] && <div className="why">{t.why[0]}</div>}
        </div>
      ))}
      {best && <p className="sub">Best option: <strong>{best}</strong></p>}
    </div>
  );
}

function OwnerMap({ thread }: { thread: Thread }) {
  return (
    <ul className="clean">
      {(thread.responsibilities ?? []).slice(0, 5).map((r) => (
        <li key={r.id}>
          <span className="badge">{r.type}</span>
          <span>{r.item ? `${r.item} — ` : ""}{r.owner}</span>
        </li>
      ))}
    </ul>
  );
}

// ACTIVE — objective + owner map.
export function Active({ thread }: GetThreadResult) {
  return (
    <div className="lens">
      <Brand />
      <div className="row spread">
        <div className="heading">{thread.title}</div>
        <StatusChip status={thread.status} />
      </div>
      {thread.objective && <div className="sub">{thread.objective}</div>}
      <div className="card"><OwnerMap thread={thread} /></div>
    </div>
  );
}

// AT_RISK — the broken link (red), severity, why[].
export function AtRisk({ thread }: GetThreadResult) {
  const broken = (thread.responsibilities ?? []).find((r) => r.status === "AT_RISK");
  return (
    <div className="lens">
      <Brand />
      <div className="row spread">
        <div className="heading">{thread.title}</div>
        <StatusChip status={thread.status} />
      </div>
      {broken && (
        <div className="card">
          <div className="row"><span className="cross">✕</span><strong>{broken.type}: {broken.owner}</strong></div>
        </div>
      )}
      <ul className="clean">
        {(thread.why ?? []).slice(0, 4).map((w, i) => <li key={i} className="why">{w}</li>)}
      </ul>
    </div>
  );
}

// HANDOFF — current owner → candidate (person or service), ranked reasons, acceptance/confirmation state.
export function Handoff({ handoff, candidates, requires_confirmation }: RequestHandoffResult) {
  const toName = candidates?.find((c) => c.id === handoff?.to)?.name ?? handoff?.to ?? "someone";
  const fromName = handoff?.from ?? "current owner";
  const amount = requires_confirmation?.amount_cents ?? requires_confirmation?.amount;
  return (
    <div className="lens">
      <Brand />
      <div className="heading">Hand off</div>
      <div className="card">
        <div className="row">
          <span>{fromName}</span>
          <span className="arrow">→</span>
          <strong>{toName}</strong>
          {handoff?.to_kind === "service" && <span className="badge">service</span>}
        </div>
      </div>
      <ul className="clean">
        {(candidates ?? []).slice(0, 4).map((c) => (
          <li key={c.id}>
            <span className={c.eligible === false ? "cross" : "check"}>{c.eligible === false ? "✕" : "✓"}</span>
            <span>{c.name}</span>
            {(c.reason ?? c.reasons?.map((x) => x.text).join(", ")) && <span className="why">— {c.reason ?? c.reasons?.map((x) => x.text).join(", ")}</span>}
          </li>
        ))}
      </ul>
      {requires_confirmation && (
        <div className="card">
          <div className="row spread">
            <span>{requires_confirmation.summary}</span>
            {amount != null && <span className="amount">{fmtMoney(amount)}</span>}
          </div>
          <div className="why">Needs your confirmation.</div>
        </div>
      )}
      {!requires_confirmation && handoff && (
        <p className="sub">{handoff.status === "ACCEPTED" ? "Accepted." : "Request sent — waiting for an answer."}</p>
      )}
    </div>
  );
}

// RECEIPT — shared vs withheld columns.
export function Receipt({ receipt }: { receipt: ReceiptT }) {
  return (
    <div className="lens">
      <Brand />
      <div className="heading">Context Receipt</div>
      <div className="two-col">
        <div className="card">
          <div className="col-title">Shared</div>
          <ul className="clean">
            {receipt.shared.length === 0 && <li className="why">Nothing</li>}
            {receipt.shared.map((s) => <li key={s.key}><span className="check">✓</span>{s.label}</li>)}
          </ul>
        </div>
        <div className="card">
          <div className="col-title">Withheld</div>
          <ul className="clean">
            {receipt.withheld.length === 0 && <li className="why">Nothing</li>}
            {receipt.withheld.map((w, i) => <li key={i}><span className="cross">✕</span>{w.label}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

// SECURED / RESOLVED — condition checklist with evidence-strength badges.
export function Resolved({ thread }: GetThreadResult) {
  const conds: Condition[] = thread.conditions ?? [];
  return (
    <div className="lens">
      <Brand />
      <div className="row spread">
        <div className="heading">{thread.title}</div>
        <StatusChip status={thread.status} />
      </div>
      <div className="card">
        <ul className="clean">
          {conds.slice(0, 5).map((c) => (
            <li key={c.id}>
              <span className={c.satisfied ? "check" : "cross"}>{c.satisfied ? "✓" : "○"}</span>
              <span>{c.label}</span>
              <StrengthBadge strength={c.strength ?? c.min_strength} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
