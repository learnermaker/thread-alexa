// Lens host: a REAL ext-apps MCP Apps host. Mounts the Lens (served at /lens) in an iframe
// and drives it over AppBridge + PostMessageTransport, so the Lens renders exactly as it
// would inside Alexa+ — not a screenshot.
import { useEffect, useRef } from "react";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { LensResult } from "./types.ts";

export function LensHost({ result }: { result: LensResult | undefined }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<LensResult | undefined>(undefined);

  // Push the latest result to the Lens: set the tool name on host context, then send the result.
  const push = (r: LensResult) => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    // The Lens reads only hostContext.toolInfo.tool.name; a minimal Tool stand-in is enough.
    const tool = { name: r.toolName, inputSchema: { type: "object" as const } };
    bridge.setHostContext({ toolInfo: { tool } } as Parameters<AppBridge["setHostContext"]>[0]);
    void bridge.sendToolInput({ arguments: {} });
    void bridge.sendToolResult({ content: [], structuredContent: r.structuredContent });
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const bridge = new AppBridge(null, { name: "alexa-sim", version: "0.1.0" }, { serverTools: {} });
    bridgeRef.current = bridge;
    bridge.addEventListener("initialized", () => {
      readyRef.current = true;
      if (pendingRef.current) push(pendingRef.current);
    });
    void bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
    return () => {
      bridgeRef.current = null;
      readyRef.current = false;
      void bridge.close?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On each new result, push now if initialized, else queue the latest.
  useEffect(() => {
    if (!result) return;
    pendingRef.current = result;
    if (readyRef.current) push(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return <iframe ref={iframeRef} src="/lens" title="Thread Lens" className="lens-frame" />;
}
