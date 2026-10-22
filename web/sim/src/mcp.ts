// Simulator OAuth (authorization_code + PKCE S256) sign-in and MCP/HTTP client.
// Each device holds its own token and signs in through the REAL embedded authorization
// server (spec auth / Master Spec D12). DEMO auto-consent + login_hint make it one hop.

import type { Beat, ClockState, Household, Inbox, LogEntry, WireEntry } from "./types.ts";

const CLIENT_ID = "alexa-sim";
// The demo client is confidential; this is the public demo secret (also the server default).
const CLIENT_SECRET = "local-demo-secret";

const origin = () => window.location.origin;
const redirectUri = () => `${origin()}/oauth/callback`;
const resource = () => `${origin()}/mcp`;

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** 43-char base64url verifier (32 random bytes) and its S256 challenge. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export interface Token { access_token: string; refresh_token?: string }

/** Run the real code+PKCE flow for one persona; returns that device's token. */
export async function signIn(loginHint: string): Promise<Token> {
  const { verifier, challenge } = await pkcePair();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const authorize = new URL(`${origin()}/oauth/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: resource(),
    scope: "mcp:tools",
    login_hint: loginHint,
    state,
  }).toString();

  // Auto-consent redirects (302) straight to the callback carrying ?code=…. Browsers hide the Location
  // header of a manual redirect (opaque response), so follow it and read the code from the final URL.
  const res = await fetch(authorize);
  if (!res.redirected) throw new Error(`authorize did not redirect (status ${res.status})`);
  const code = new URL(res.url).searchParams.get("code");
  if (!code) throw new Error(`no code in callback: ${res.url}`);

  const tokenRes = await fetch(`${origin()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      resource: resource(),
    }),
  });
  if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}`);
  const t = (await tokenRes.json()) as Token;
  return t;
}

let rpcId = 1;

/** One JSON-RPC call to /mcp with the device's bearer token. Token never goes in the query string. */
export async function mcpCall<T = unknown>(token: string, method: string, params?: unknown): Promise<T> {
  const res = await fetch(`${origin()}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  const text = await res.text();
  // enableJsonResponse=true means the body is a single JSON object.
  const json = JSON.parse(text) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/** initialize + tools/list, once per device. */
export async function mcpHandshake(token: string): Promise<void> {
  await mcpCall(token, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "alexa-sim", version: "0.1.0" },
  });
  await mcpCall(token, "tools/list", {});
}

export interface ToolResult {
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}
export const callTool = (token: string, name: string, args: Record<string, unknown>) =>
  mcpCall<ToolResult>(token, "tools/call", { name, arguments: args });

// --- Demo API helpers (unauthenticated, simulator-facing) ---
const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${origin()}${path}`, init);
  return (await res.json()) as T;
};
export const getHousehold = () => api<Household>("/api/household");
export const getClock = () => api<ClockState>("/api/clock");
export const setClock = (body: { preset?: string; iso?: string }) =>
  api<ClockState>("/api/clock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const getInbox = (person: string) => api<Inbox>(`/api/inbox?person=${encodeURIComponent(person)}`);
export const getLog = () => api<LogEntry[]>("/api/log");
export const getWire = () => api<WireEntry[]>("/api/wire");
export const resetDemo = () => api<{ ok?: boolean }>("/api/reset", { method: "POST" });

export interface AgentReply { reply?: string; live?: boolean; lens?: { toolName: string; structuredContent: Record<string, unknown> } }
// The scripted/live agent endpoint (simulator-agent phase). Typed input always posts here.
export const sendToAgent = (device: string, text: string) =>
  api<AgentReply>("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device, text }) });

export const getStory = () => api<{ beats: Beat[] }>("/api/story");

// Playback: prefer the pre-rendered MP3 (npm run voices), else the browser's speech synthesis.
export function speak(beatId: string, text: string): void {
  try {
    const audio = new Audio(`${origin()}/voices/${beatId}.mp3`);
    audio.play().catch(() => speakSynth(text));
  } catch {
    speakSynth(text);
  }
}
function speakSynth(text: string): void {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch { /* no voice available */ }
}
