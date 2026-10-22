import { useCallback, useEffect, useRef, useState } from "react";
import { LensHost } from "./lens-host.tsx";
import {
  callTool, getClock, getHousehold, getInbox, getLog, getStory, getWire, mcpHandshake, resetDemo,
  sendToAgent, setClock, signIn, speak as speakAudio, type Token,
} from "./mcp.ts";
import type { Beat, ClockState, Household, InboxItem, LensResult, LogEntry, Person, Turn, WireEntry } from "./types.ts";

interface DeviceState { token?: Token; person?: Person; transcript: Turn[] }

// Pick personas by name, falling back to the first two sign-in-able persons.
const pick = (hh: Household, name: string): Person | undefined =>
  hh.persons.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase())) ?? undefined;

// Which Lens mode a tool result shows (mirrors web/lens App.tsx), for the data-lens-mode marker.
const MODE_FOR: Record<string, string> = {
  list_threads: "CAROUSEL", report_change: "RIPPLE", request_handoff: "RECEIPT",
  respond_to_handoff: "SECURED", confirm_action: "SECURED", get_thread: "DETAIL", record_evidence: "RESOLVED",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The inbox API returns { messages: [...] } (thread-core inbox); older shapes used items/handoffs.
const inboxItems = (r: { items?: InboxItem[]; handoffs?: InboxItem[]; messages?: InboxItem[] }): InboxItem[] => r.items ?? r.handoffs ?? r.messages ?? [];
// The wire log shows the JSON-RPC body exactly as sent / received, clipped to `max` characters.
const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)} …` : text);

export function App() {
  const [hh, setHh] = useState<Household | null>(null);
  const [clock, setClockState] = useState<ClockState | null>(null);
  const [echo, setEcho] = useState<DeviceState>({ transcript: [] });
  const [phone, setPhone] = useState<DeviceState>({ transcript: [] });
  const [lens, setLens] = useState<LensResult | undefined>();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [wire, setWire] = useState<WireEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lensMode, setLensMode] = useState("IDLE");
  const [playing, setPlaying] = useState(false);
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
          setInbox(inboxItems(r));
        } catch { /* transient */ }
      }
      if (drawerOpen) {
        try { setLog(await getLog()); setWire(await getWire()); } catch { /* transient */ }
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
      setLensMode("IDLE");
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
      if (r.lens) {
        setLens(r.lens);
        setLensMode(MODE_FOR[r.lens.toolName] ?? "DETAIL");
      }
    } catch {
      setEcho((d) => ({ ...d, transcript: [...d.transcript, { who: "thread", text: "(agent unavailable)" }] }));
    }
  }, []);

  // "Play the story": walk every beat with real clock jumps, routed to each beat's device, in ~90s.
  const onPlay = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    try {
      await resetDemo();
      setLens(undefined);
      setLensMode("IDLE");
      setEcho((d) => ({ ...d, transcript: [{ who: "thread", text: "Playing the story…" }] }));
      const { beats } = await getStory();
      const perBeat = Math.max(800, Math.round(90000 / beats.length));
      for (const beat of beats as Beat[]) {
        setClockState(await setClock({ iso: beat.clock }));
        setLensMode(beat.expected_lens_mode);
        const set = beat.device === "phone" ? setPhone : setEcho;
        if (beat.utterance) {
          set((d) => ({ ...d, transcript: [...d.transcript, { who: "you", text: beat.utterance }] }));
          const r = await sendToAgent(beat.device, beat.utterance);
          setLive(Boolean(r.live));
          if (r.lens) { setLens(r.lens); setLensMode(MODE_FOR[r.lens.toolName] ?? beat.expected_lens_mode); }
          set((d) => ({ ...d, transcript: [...d.transcript, { who: "thread", text: r.reply ?? beat.spoken_line }] }));
          speakAudio(beat.id, r.reply ?? beat.spoken_line);
        } else if (beat.spoken_line) {
          set((d) => ({ ...d, transcript: [...d.transcript, { who: "thread", text: beat.spoken_line }] }));
          speakAudio(beat.id, beat.spoken_line);
        }
        if (samId.current) { try { setInbox(inboxItems(await getInbox(samId.current))); } catch { /* transient */ } }
        await sleep(perBeat);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPlaying(false);
    }
  }, [playing]);

  // Accept / Decline a handoff from the phone, using Sam's own token (real tool call).
  const respond = async (item: InboxItem, accept: boolean) => {
    const token = phone.token?.access_token;
    const handoffId = item.handoff_id ?? item.id;
    if (!token || !handoffId) return;
    try {
      // Accepting also confirms the items the recipient is holding (e.g. "Items: jersey: with Sam").
      const confirm_items = accept ? [...(item.text ?? "").matchAll(/Items: ([^:;]+): with/g)].map((m) => m[1]!.trim()) : [];
      const res = await callTool(token, "respond_to_handoff", { handoff_id: handoffId, accept, ...(confirm_items.length ? { confirm_items } : {}) });
      setAnswered((a) => ({ ...a, [handoffId]: accept ? "Accepted" : "Declined" }));
      if (res.structuredContent) setLens({ toolName: "respond_to_handoff", structuredContent: res.structuredContent });
      if (samId.current) setInbox(inboxItems(await getInbox(samId.current)));
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
        <button className="play" onClick={() => void onPlay()} disabled={playing} data-testid="play-story">
          {playing ? "Playing…" : "Play the story"}
        </button>
        <button onClick={() => setDrawerOpen((v) => !v)}>{drawerOpen ? "Hide" : "Under the hood"}</button>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="stage" data-lens-mode={lensMode} data-live={live ? "live" : "scripted"}>
        <section className="device echo">
          <div className="device-title">Kitchen Echo Show — {echo.person?.name ?? "…"}</div>
          <div className="echo-inner">
            <div className="transcript" data-testid="echo-transcript">
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
            {inbox.slice().reverse().map((item) => {
              const id = item.handoff_id ?? item.id ?? "";
              const isHandoff = (item.kind ?? "HANDOFF_REQUEST") === "HANDOFF_REQUEST";
              return (
                <div key={id} className="inbox-item">
                  <div className="inbox-title">{item.thread_title ?? item.title ?? (isHandoff ? "Handoff request" : "Heads-up")}</div>
                  {(item.summary ?? item.text) && <div className="inbox-sub">{item.summary ?? item.text}</div>}
                  {isHandoff && (answered[id] ? (
                    <div className="inbox-sub">{answered[id]} ✓</div>
                  ) : (
                    <div className="inbox-actions">
                      <button onClick={() => void respond(item, true)}>Accept</button>
                      <button className="decline" onClick={() => void respond(item, false)}>Decline</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {drawerOpen && (
        <aside className="drawer">
          <div className="drawer-title">Under the hood — live MCP wire log (JSON-RPC over Streamable HTTP, protocol 2025-11-25)</div>
          <div className="drawer-body">
            <table>
              <thead><tr><th>request</th><th>rpc</th><th>tool</th><th>status</th><th>ms</th><th>as</th></tr></thead>
              <tbody>
                {wire.slice().reverse().map((e, i) => (
                  <tr key={e.at + i} className={e.status < 400 ? "ok" : "err"}>
                    <td>{e.request}</td><td>{e.rpc}</td><td>{e.tool ?? ""}</td><td>{e.status}</td><td>{e.ms}</td><td>{e.as} ({e.via})</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wire.length > 0 && (() => {
              const last = wire[wire.length - 1]!;
              return (
                <div className="wire-detail" data-testid="wire-detail">
                  <div className="wire-head">{last.request} · {last.rpc}{last.tool ? ` · ${last.tool}` : ""} · {last.status} · {last.ms} ms · {last.res_bytes} bytes</div>
                  <div className="wire-label">request</div>
                  <pre>{clip(last.req_text, 600)}</pre>
                  <div className="wire-label">response</div>
                  <pre>{clip(last.res_text, 700)}</pre>
                </div>
              );
            })()}
          </div>
        </aside>
      )}
    </div>
  );
}

