import { useCallback, useEffect, useRef, useState } from "react";
import { LensHost } from "./lens-host.tsx";
import {
  callTool, getClock, getHousehold, getInbox, getLog, mcpHandshake, resetDemo,
  sendToAgent, setClock, signIn, type Token,
} from "./mcp.ts";
import type { ClockState, Household, InboxItem, LensResult, LogEntry, Person, Turn } from "./types.ts";

interface DeviceState { token?: Token; person?: Person; transcript: Turn[] }

// Pick personas by name, falling back to the first two sign-in-able persons.
const pick = (hh: Household, name: string): Person | undefined =>
  hh.persons.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase())) ?? undefined;

export function App() {
  const [hh, setHh] = useState<Household | null>(null);
  const [clock, setClockState] = useState<ClockState | null>(null);
  const [echo, setEcho] = useState<DeviceState>({ transcript: [] });
  const [phone, setPhone] = useState<DeviceState>({ transcript: [] });
  const [lens, setLens] = useState<LensResult | undefined>();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const samId = useRef<string | undefined>(undefined);

  // Boot: load household + clock, then sign both devices in through the real OAuth flow.
  useEffect(() => {
    (async () => {
      try {
        const h = await getHousehold();
        setHh(h);
        setClockState(await getClock());
        const maya = pick(h, "maya") ?? h.persons[0];
        const sam = pick(h, "sam") ?? h.persons[1] ?? h.persons[0];
        samId.current = sam?.id;
        if (maya) {
          const token = await signIn(maya.id);
          await mcpHandshake(token.access_token);
          setEcho({ token, person: maya, transcript: [{ who: "thread", text: `Signed in as ${maya.name}.` }] });
        }
        if (sam) {
          const token = await signIn(sam.id);
          await mcpHandshake(token.access_token);
          setPhone({ token, person: sam, transcript: [{ who: "thread", text: `Signed in as ${sam.name}.` }] });
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Short-poll Sam's inbox (1 s) and the log while the drawer is open.
  useEffect(() => {
    const id = setInterval(async () => {
      if (samId.current) {
        try {
          const r = await getInbox(samId.current);
          setInbox(r.items ?? r.handoffs ?? []);
        } catch { /* transient */ }
      }
      if (drawerOpen) {
        try { setLog(await getLog()); } catch { /* transient */ }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [drawerOpen]);

  const onClockPreset = async (preset: string) => {
    try { setClockState(await setClock({ preset })); } catch (e) { setError(String(e)); }
  };

  const onReset = async () => {
    try {
      await resetDemo();
      setLens(undefined);
      setInbox([]);
      setEcho((d) => ({ ...d, transcript: [{ who: "thread", text: "Demo reset." }] }));
      setClockState(await getClock());
    } catch (e) { setError(String(e)); }
  };

  // Typed input ALWAYS works: post to the agent endpoint; render its reply and refresh the Lens.
  const onSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    setEcho((d) => ({ ...d, transcript: [...d.transcript, { who: "you", text }] }));
    try {
      const r = await sendToAgent("echo", text);
      setLive(Boolean(r.live));
      setEcho((d) => ({ ...d, transcript: [...d.transcript, { who: "thread", text: r.reply ?? "(no reply)" }] }));
      // If the agent surfaced a tool result for the Lens, it is echoed via /api/log; the Lens
      // itself is fed by the scripted/live agent phase. Here we keep the UI responsive.
    } catch {
      setEcho((d) => ({ ...d, transcript: [...d.transcript, { who: "thread", text: "(agent not wired yet — typed input is live; scripted agent arrives in the next phase)" }] }));
    }
  }, []);

  // Accept / Decline a handoff from the phone, using Sam's own token (real tool call).
  const respond = async (item: InboxItem, accept: boolean) => {
    const token = phone.token?.access_token;
    const handoffId = item.handoff_id ?? item.id;
    if (!token || !handoffId) return;
    try {
      const res = await callTool(token, "respond_to_handoff", { handoff_id: handoffId, accept });
      if (res.structuredContent) setLens({ toolName: "respond_to_handoff", structuredContent: res.structuredContent });
      if (samId.current) setInbox((await getInbox(samId.current)).items ?? []);
    } catch (e) { setError(String(e)); }
  };

  return (
    <div className="sim">
      <header className="bar">
        <span className="label">Alexa+ experience simulator</span>
        <span className={`badge ${live ? "live" : "scripted"}`}>{live ? "Live agent" : "Scripted agent"}</span>
        <span className="clock">
          {clock?.iso ? new Date(clock.iso).toLocaleString() : "…"}
          {clock?.presets.map((p) => (
            <button key={p} onClick={() => onClockPreset(p)}>{p}</button>
          ))}
        </span>
        <button onClick={onReset}>Reset demo</button>
        <button onClick={() => setDrawerOpen((v) => !v)}>{drawerOpen ? "Hide" : "Under the hood"}</button>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="stage">
        <section className="device echo">
          <div className="device-title">Kitchen Echo Show — {echo.person?.name ?? "…"}</div>
          <div className="echo-inner">
            <div className="transcript">
              {echo.transcript.map((t, i) => (
                <p key={i} className={t.who}>{t.text}</p>
              ))}
            </div>
            <LensHost result={lens} />
          </div>
          <form className="say" onSubmit={(e) => { e.preventDefault(); void onSubmit(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type to Alexa…" aria-label="Type to Alexa" />
            <button type="submit">Send</button>
          </form>
        </section>

        <section className="device phone">
          <div className="device-title">Sam&apos;s phone — {phone.person?.name ?? "…"}</div>
          <div className="inbox">
            {inbox.length === 0 && <p className="empty">No handoffs yet.</p>}
            {inbox.map((item) => (
              <div key={item.handoff_id ?? item.id} className="inbox-item">
                <div className="inbox-title">{item.thread_title ?? item.title ?? "Handoff"}</div>
                {item.summary && <div className="inbox-sub">{item.summary}</div>}
                <div className="inbox-actions">
                  <button onClick={() => void respond(item, true)}>Accept</button>
                  <button className="decline" onClick={() => void respond(item, false)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {drawerOpen && (
        <aside className="drawer">
          <div className="drawer-title">Under the hood — live MCP request log</div>
          <table>
            <thead><tr><th>tool</th><th>ms</th><th>status</th></tr></thead>
            <tbody>
              {log.slice().reverse().map((e, i) => (
                <tr key={i} className={e.ok ? "ok" : "err"}>
                  <td>{e.tool}</td><td>{e.ms}</td><td>{e.ok ? "ok" : e.code ?? "error"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      )}
    </div>
  );
}
