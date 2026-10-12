import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App as McpApp, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { App } from "./App.tsx";
import type { Payload } from "./types.ts";
import "./theme.css";

function Lens() {
  const [tool, setTool] = useState<string | undefined>();
  const [data, setData] = useState<Payload | undefined>();

  useEffect(() => {
    const app = new McpApp({ name: "thread-lens", version: "0.1.0" }, {});
    // Register handlers before connect so the first result is not missed.
    app.addEventListener("toolresult", (params) => {
      const sc = params.structuredContent as Payload | undefined;
      if (sc) setData(sc);
      const name = app.getHostContext()?.toolInfo?.tool?.name;
      if (name) setTool(name);
    });
    app.addEventListener("hostcontextchanged", () => {
      const name = app.getHostContext()?.toolInfo?.tool?.name;
      if (name) setTool(name);
    });
    app.connect(new PostMessageTransport(window.parent, window.parent)).catch(() => {
      // Standalone preview (no host): leave the empty state.
    });
    return () => { app.close(); };
  }, []);

  return <App tool={tool} data={data} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Lens />
  </StrictMode>,
);
