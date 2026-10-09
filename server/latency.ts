// Latency measurement: list_threads×20, get_thread×20, report_change×5.
// usage: node server/latency.ts [baseUrl=http://localhost:8787] [token=dev-maya]
// Exits 1 if any p95 >= 500 ms.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = process.argv[2] ?? "http://localhost:8787";
const token = process.argv[3] ?? "dev-maya";

const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
const client = new Client({ name: "latency", version: "0" });
await client.connect(transport);

async function time(fn: () => Promise<unknown>): Promise<number> {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}

function pct(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

// Warm up
await client.callTool({ name: "list_threads", arguments: {} });

// Collect samples
const samples: Record<string, number[]> = { list_threads: [], get_thread: [], report_change: [] };

for (let i = 0; i < 20; i++) {
  samples.list_threads!.push(await time(() => client.callTool({ name: "list_threads", arguments: {} })));
}
for (let i = 0; i < 20; i++) {
  samples.get_thread!.push(await time(() => client.callTool({ name: "get_thread", arguments: { thread_id: "thr_leo_tourney" } })));
}
for (let i = 0; i < 5; i++) {
  // An unrelated Sunday change that doesn't affect any active thread
  samples.report_change!.push(await time(() => client.callTool({
    name: "report_change",
    arguments: {
      change: { type: "PERSON_UNAVAILABLE", person: "maya", start: "2026-10-11T10:00:00-07:00", end: "2026-10-11T12:00:00-07:00" },
      idempotency_key: `latency-${i}-${Date.now()}`,
    },
  })));
}

await client.close();

// Print table
const col = (s: string, w: number) => s.padEnd(w);
const hdr = [col("tool", 22), col("n", 5), col("p50 ms", 9), col("p95 ms", 9)].join(" ");
console.log(hdr);
console.log("-".repeat(hdr.length));

let failed = false;
for (const [tool, times] of Object.entries(samples)) {
  const p50 = pct(times, 50);
  const p95 = pct(times, 95);
  if (p95 >= 500) failed = true;
  console.log([col(tool, 22), col(String(times.length), 5), col(String(p50), 9), col(String(p95), 9)].join(" "));
}

if (failed) {
  console.error("\nFAIL: one or more p95 >= 500 ms");
  process.exit(1);
}
