// OAuth / identity checks against a running THREAD server (npm run demo), printed as plain evidence lines.
// Usage: node video/proof-auth.mjs [http://localhost:8787]
// Prints status codes and error codes only; no token or secret value is ever printed.
const base = process.argv[2] ?? "http://localhost:8787";
const mcp = `${base}/mcp`;
const secret = process.env.OAUTH_CLIENT_SECRET ?? "local-demo-secret"; // the demo client's default (see .env.example)

const rpc = (method, params, headers = {}, url = mcp) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
const line = (what, result) => console.log(`${what.padEnd(46)} -> ${result}`);

// 1. No token, and a token in the query string.
let r = await rpc("tools/list", {});
line("POST /mcp, no token", `${r.status} ${await r.text()}`);
r = await rpc("tools/list", {}, {}, `${mcp}?access_token=x`);
line("POST /mcp?access_token=..., token in query", `${r.status} ${await r.text()}`);

// 2. Tier 1: a client_credentials service token may list tools, never call them.
const tok = await fetch(`${base}/oauth/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`alexa-sim:${secret}`).toString("base64")}` },
  body: new URLSearchParams({ grant_type: "client_credentials", scope: "mcp:service", resource: mcp }),
});
const service = (await tok.json()).access_token;
line("client_credentials token (scope mcp:service)", service ? `${tok.status} issued` : `${tok.status} refused`);
const auth = { authorization: `Bearer ${service}` };
r = await rpc("tools/list", {}, auth);
line("service token: tools/list", `${r.status} ${(await r.json()).result.tools.length} tools`);
r = await rpc("tools/call", { name: "list_threads", arguments: {} }, auth);
const denied = await r.json();
line("service token: tools/call list_threads", `${r.status} ${denied.error ?? ""}`);

// 3. Tier 2: identity comes from the token. Maya cannot answer Sam's handoff.
const maya = { authorization: "Bearer dev-maya" };
r = await rpc("tools/call", { name: "request_handoff", arguments: { thread_id: "thr_leo_tourney", responsibility_id: "r_transport" } }, maya);
const handoff = (await r.json()).result.structuredContent.handoff;
line("Maya: request_handoff (Leo's ride, to Sam)", `${r.status} ${handoff.id} ${handoff.status}`);
r = await rpc("tools/call", { name: "respond_to_handoff", arguments: { handoff_id: handoff.id, accept: true } }, maya);
const wrong = await r.json();
line("Maya: respond_to_handoff for Sam", `${r.status} isError=${wrong.result.isError} "${wrong.result.content[0].text}"`);
