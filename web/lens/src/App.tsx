import type {
  Payload, Thread, Status, ListThreadsResult, ReportChangeResult,
  RequestHandoffResult, Receipt as ReceiptT,
} from "./types.ts";
import { Overview, Ripple, Active, AtRisk, Handoff, Receipt, Resolved } from "./modes.tsx";
import { Brand } from "./ui.tsx";

const SECURED: Status[] = ["PLAN_SECURED", "RESOLVED"];
const RISK: Status[] = ["AT_RISK", "NEEDS_ATTENTION"];

export interface AppProps { tool?: string; data?: Payload }

function Empty({ text }: { text: string }) {
  return (
    <div className="lens">
      <Brand />
      <p className="placeholder">{text}</p>
    </div>
  );
}

// Choose the mode from the tool that produced the result, falling back to the
// structuredContent shape so the Lens still renders if the tool name is absent.
export function App({ tool, data }: AppProps) {
  if (!data) return <Empty text="Ask THREAD about your weekend to see it here." />;

  const threads = (data as Partial<ListThreadsResult>).threads;
  const hasProposals = (data as Partial<ReportChangeResult>).proposals !== undefined;
  const looksRipple = Array.isArray(threads) && threads.some((t) => (t as { severity?: string }).severity !== undefined);

  if (tool === "report_change" || hasProposals || looksRipple) return <Ripple {...(data as unknown as ReportChangeResult)} />;
  if (tool === "list_threads" || Array.isArray(threads)) return <Overview {...(data as unknown as ListThreadsResult)} />;

  if (tool === "request_handoff" || tool === "respond_to_handoff") {
    const receipt = (data as unknown as RequestHandoffResult).handoff?.receipt;
    if (receipt) return <Receipt receipt={receipt} />;
    if (tool === "request_handoff") return <Handoff {...(data as unknown as RequestHandoffResult)} />;
  }

  const thread = (data as { thread?: Thread }).thread;
  if (thread) {
    if (SECURED.includes(thread.status)) return <Resolved thread={thread} />;
    if (RISK.includes(thread.status)) return <AtRisk thread={thread} />;
    return <Active thread={thread} />;
  }

  const bareReceipt = (data as { receipt?: ReceiptT }).receipt;
  if (bareReceipt) return <Receipt receipt={bareReceipt} />;

  return <Empty text="Nothing to show for this result." />;
}
