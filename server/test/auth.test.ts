// Alexa+ MCP auth checklist conformance A1-A21 (spec auth, Master Spec §B6/§D12).
// OAuth endpoints are exercised in-process via app.request; the MCP-over-token cases
// (A9, A10, A15, A17, A20, A21) use a real listening server with an SDK client, so the
// same tokens that pass the token endpoint are proven to act over Streamable HTTP.
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { serve } from "@hono/node-server";
import { SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { TOOLS } from "../mcp/tools.ts";
import { CLIENT_ID, CLIENT_SECRET, REDIRECT, RESOURCE, form, pkce, startAuthHarness, type AuthHarness } from "./oauth-harness.ts";

const story = JSON.parse(readFileSync(new URL("../../fixtures/golden/ripple-story.json", import.meta.url), "utf8"));
const toolFor = (op: string) => TOOLS.find((t) => t.op === op)?.name;

let h: AuthHarness;
let base = "";
let server: ReturnType<typeof serve>;

beforeAll(async () => {
  h = await startAuthHarness();
  server = serve({ fetch: h.app.fetch, port: 0 });
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const basic = () => `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
const json = async (r: Response) => [r.status, await r.json()] as const;

/** client_credentials -> Tier 1 token. */
async function serviceToken(): Promise<string> {
  const r = await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: RESOURCE }, { authorization: basic() }));
  return (await r.json()).access_token;
}

/** Full authorization_code + PKCE flow -> { access_token, refresh_token } for a person. */
async function userTokens(person: string): Promise<{ access_token: string; refresh_token: string }> {
  const { verifier, challenge } = pkce();
  const q = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge,
    code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools mcp:resources", state: "xyz", login_hint: person,
  });
  const auth = await h.app.request(`/oauth/authorize?${q}`);
  const code = new URL(auth.headers.get("location")!).searchParams.get("code")!;
  const r = await h.app.request("/oauth/token", form({
    grant_type: "authorization_code", code, redirect_uri: REDIRECT, resource: RESOURCE,
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code_verifier: verifier,
  }));
  return r.json();
}

async function mcpClient(token: string): Promise<Client> {
  const c = new Client({ name: "auth-test", version: "0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return c;
}

describe("auth conformance A1-A21", () => {
  test("A1 AS metadata", async () => {
    const [s, m] = await json(await h.app.request("/.well-known/oauth-authorization-server"));
    expect(s).toBe(200);
    expect(m.grant_types_supported).toEqual(expect.arrayContaining(["authorization_code", "client_credentials", "refresh_token"]));
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(m.response_types_supported).toEqual(["code"]);
    expect(m.issuer).toBe(h.oauth.issuer);
  });

  test("A2 PRM on both paths", async () => {
    for (const p of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
      const [s, m] = await json(await h.app.request(p));
      expect(s).toBe(200);
      expect(m.resource).toBe(RESOURCE);
    }
  });

  test("A3 jwks: one EC key, no private d", async () => {
    const [s, m] = await json(await h.app.request("/oauth/jwks"));
    expect(s).toBe(200);
    expect(m.keys).toHaveLength(1);
    expect(m.keys[0].kty).toBe("EC");
    expect(m.keys[0].d).toBeUndefined();
  });

  test("A4 client_credentials, Basic auth", async () => {
    const r = await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: RESOURCE }, { authorization: basic() }));
    const m = await r.json();
    expect(r.status).toBe(200);
    expect(m.scope).toBe("mcp:service");
    expect(m.expires_in).toBe(3600);
    expect(m.refresh_token).toBeUndefined();
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  test("A5 client_credentials via POST body secret", async () => {
    const [s] = await json(await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: RESOURCE, client_id: CLIENT_ID, client_secret: CLIENT_SECRET })));
    expect(s).toBe(200);
  });

  test("A6 client_credentials missing/wrong resource -> 400 invalid_target", async () => {
    const [s1, m1] = await json(await h.app.request("/oauth/token", form({ grant_type: "client_credentials" }, { authorization: basic() })));
    expect([s1, m1.error]).toEqual([400, "invalid_target"]);
    const [s2, m2] = await json(await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: "http://localhost/wrong" }, { authorization: basic() })));
    expect([s2, m2.error]).toEqual([400, "invalid_target"]);
  });

  test("A7 wrong secret -> 401 invalid_client", async () => {
    const [s, m] = await json(await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: RESOURCE, client_id: CLIENT_ID, client_secret: "nope" })));
    expect([s, m.error]).toEqual([401, "invalid_client"]);
  });

  test("A8 client_credentials with scope mcp:tools -> 400 invalid_scope", async () => {
    const [s, m] = await json(await h.app.request("/oauth/token", form({ grant_type: "client_credentials", resource: RESOURCE, scope: "mcp:tools" }, { authorization: basic() })));
    expect([s, m.error]).toEqual([400, "invalid_scope"]);
  });

  test("A9 Tier 1 token: initialize + tools/list (8 tools)", async () => {
    const c = await mcpClient(await serviceToken());
    const { tools } = await c.listTools();
    expect(tools).toHaveLength(TOOLS.length);
    await c.close();
  });

  test("A10 Tier 1 token: tools/call -> HTTP 403 insufficient_scope", async () => {
    const token = await serviceToken();
    const r = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_threads", arguments: {} } }),
    });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe("insufficient_scope");
  });

  test("A11 authorize login_hint=maya (DEMO) -> 302 with code and same state", async () => {
    const { challenge } = pkce();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools", state: "s123", login_hint: "maya" });
    const r = await h.app.request(`/oauth/authorize?${q}`);
    expect(r.status).toBe(302);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.searchParams.get("code")).toBeTruthy();
    expect(loc.searchParams.get("state")).toBe("s123");
  });

  test("A12 authorize GET without login_hint -> picker for Maya, Sam, Rosa (not Leo)", async () => {
    const { challenge } = pkce();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools" });
    const r = await h.app.request(`/oauth/authorize?${q}`);
    expect(r.status).toBe(200);
    const html = await r.text();
    for (const p of ["maya", "sam", "rosa"]) expect(html).toContain(`value="${p}"`);
    expect(html).not.toContain(`value="leo"`);
  });

  test("A13 authorize plain/missing PKCE, bad resource, bad scope -> 302 error", async () => {
    const { challenge } = pkce();
    const q = (over: Record<string, string>) => {
      const b: Record<string, string> = { client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools" };
      return new URLSearchParams({ ...b, ...over }).toString();
    };
    const err = async (over: Record<string, string>) => {
      const r = await h.app.request(`/oauth/authorize?${q(over)}`);
      expect(r.status).toBe(302);
      return new URL(r.headers.get("location")!).searchParams.get("error");
    };
    expect(await err({ code_challenge_method: "plain" })).toBe("invalid_request");
    expect(await err({ resource: "http://localhost/wrong" })).toBe("invalid_target");
    expect(await err({ scope: "mcp:service" })).toBe("invalid_scope");
  });

  test("A14 authorize unregistered redirect_uri -> 400 no redirect", async () => {
    const { challenge } = pkce();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: "http://evil/cb", response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools" });
    const r = await h.app.request(`/oauth/authorize?${q}`);
    expect(r.status).toBe(400);
    expect(r.headers.get("location")).toBeNull();
  });

  test("A15 code exchange happy path -> tokens; access token lists threads as maya", async () => {
    const t = await userTokens("maya");
    expect(t.access_token).toBeTruthy();
    expect(t.refresh_token).toBeTruthy();
    const c = await mcpClient(t.access_token);
    const r: any = await c.callTool({ name: "list_threads", arguments: {} });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.threads.length).toBeGreaterThan(0);
    await c.close();
  });

  test("A16 code exchange with wrong verifier -> 400 invalid_grant", async () => {
    const { challenge } = pkce();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools", login_hint: "maya" });
    const auth = await h.app.request(`/oauth/authorize?${q}`);
    const code = new URL(auth.headers.get("location")!).searchParams.get("code")!;
    const r = await h.app.request("/oauth/token", form({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, resource: RESOURCE, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code_verifier: pkce().verifier }));
    expect([r.status, (await r.json()).error]).toEqual([400, "invalid_grant"]);
  });

  test("A17 refresh_token grant -> new access token works", async () => {
    const t = await userTokens("sam");
    const r = await h.app.request("/oauth/token", form({ grant_type: "refresh_token", refresh_token: t.refresh_token, resource: RESOURCE, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }));
    const m = await r.json();
    expect(r.status).toBe(200);
    expect(m.access_token).toBeTruthy();
    const c = await mcpClient(m.access_token);
    const res: any = await c.callTool({ name: "list_threads", arguments: {} });
    expect(res.isError).toBeFalsy();
    await c.close();
  });

  test("A18 code or refresh token used as Bearer on /mcp -> 401", async () => {
    const { verifier, challenge } = pkce();
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", resource: RESOURCE, scope: "mcp:tools", login_hint: "maya" });
    const auth = await h.app.request(`/oauth/authorize?${q}`);
    const code = new URL(auth.headers.get("location")!).searchParams.get("code")!;
    const codeRes = await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: `Bearer ${code}`, "content-type": "application/json" }, body: "{}" });
    expect(codeRes.status).toBe(401);
    const t = await h.app.request("/oauth/token", form({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, resource: RESOURCE, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code_verifier: verifier }));
    const { refresh_token } = await t.json();
    const rtRes = await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: `Bearer ${refresh_token}`, "content-type": "application/json" }, body: "{}" });
    expect(rtRes.status).toBe(401);
  });

  test("A19 token for another audience / expired -> 401, no WWW-Authenticate", async () => {
    const sign = (claims: Record<string, unknown>, exp: string) =>
      new SignJWT(claims).setProtectedHeader({ alg: "ES256", kid: h.oauth.keys.kid }).setIssuer(h.oauth.issuer).setSubject("maya").setIssuedAt().setExpirationTime(exp).sign(h.oauth.keys.privateKey);
    const wrongAud = await sign({ typ: "at", scope: "mcp:tools", aud: "http://localhost/other" }, "1h");
    const expired = await sign({ typ: "at", scope: "mcp:tools", aud: RESOURCE }, "-1h");
    for (const token of [wrongAud, expired]) {
      const r = await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toBeNull();
    }
  });

  test("A20 golden story over MCP using Tier 2 tokens for maya and sam", async () => {
    const tokens: Record<string, string> = { maya: (await userTokens("maya")).access_token, sam: (await userTokens("sam")).access_token };
    const clients = new Map<string, Client>();
    const client = async (person: string) => {
      if (!clients.has(person)) clients.set(person, await mcpClient(tokens[person] ?? (await userTokens(person)).access_token));
      return clients.get(person)!;
    };
    for (const step of story.steps) {
      h.clock.set(step.at);
      const tool = toolFor(step.op);
      if (!tool) {
        const p = step.as === "system" ? { kind: "system", household_id: "hh_rivera" } : { kind: "person", household_id: "hh_rivera", person_id: step.as };
        const r = await (h.core as any)[step.op](p, step.input);
        expect(r, step.id).toMatchObject(step.expect);
        continue;
      }
      const r: any = await (await client(step.as)).callTool({ name: tool, arguments: step.input });
      if (step.expect.ok) {
        expect(r.isError, step.id).toBeFalsy();
        expect(r.structuredContent, step.id).toMatchObject(step.expect.data);
      } else {
        expect(r.isError, step.id).toBe(true);
        expect(JSON.parse(r.content[1].text).error.code, step.id).toBe(step.expect.error.code);
      }
    }
    for (const c of clients.values()) await c.close();
  });

  test("A21 AUTH_DEV_TOKENS off -> Bearer dev-maya rejected (401)", async () => {
    const noDev = await startAuthHarness({ devTokens: false });
    const srv = serve({ fetch: noDev.app.fetch, port: 0 });
    await new Promise<void>((r) => srv.once("listening", r));
    const b = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const r = await fetch(`${b}/mcp`, { method: "POST", headers: { authorization: "Bearer dev-maya", "content-type": "application/json" }, body: "{}" });
    expect(r.status).toBe(401);
    srv.close();
  });
});
