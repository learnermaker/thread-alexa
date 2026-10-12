// Minimal, spec-conformant demo authorization server implementing the Alexa+ MCP auth checklist:
//  - RFC 9728 Protected Resource Metadata + RFC 8414 AS metadata (no OIDC, no DCR)
//  - Tier 1: client_credentials (HTTP Basic or POST), scope mcp:service, `resource` required, <= 3600 s, no refresh
//  - Tier 2: authorization_code + PKCE S256 + `resource`, scopes mcp:tools / mcp:resources, refresh_token
//  - ES256 JWT access tokens (aud = canonical MCP URL). Codes and refresh tokens are signed JWTs too (stateless: Lambda-safe).
// ponytail: refresh tokens can't be revoked before they expire (stateless). Fine for a demo AS; a store-backed denylist is the upgrade.
import type { Context, Hono } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWK, type CryptoKey } from "jose";
import type { Principal } from "./principal.ts";

export interface OAuthClient {
  client_id: string;
  client_secret?: string; // absent = public client (PKCE only)
  redirect_uris: string[]; // exact match
  grants: Array<"client_credentials" | "authorization_code" | "refresh_token">;
}
export interface OAuthConfig {
  issuer: string; // e.g. http://localhost:8787
  resource: string; // canonical MCP URL, e.g. http://localhost:8787/mcp
  householdId: string;
  persons: Array<{ id: string; name: string }>; // people who can sign in (adults with accounts)
  clients: OAuthClient[];
  keys: { privateKey: CryptoKey; publicJwk: JWK; kid: string };
  autoConsent: boolean; // DEMO_MODE only: honour login_hint without showing the picker (disclosed in the README)
}

const TIER2_SCOPES = ["mcp:tools", "mcp:resources"];
const ALL_SCOPES = ["mcp:service", ...TIER2_SCOPES];
const ACCESS_TTL = 3600;
const REFRESH_TTL = 30 * 24 * 3600;
const CODE_TTL = 300;

export function oauthRoutes(app: Hono, cfg: OAuthConfig): void {
  const asMeta = {
    issuer: cfg.issuer,
    authorization_endpoint: `${cfg.issuer}/oauth/authorize`,
    token_endpoint: `${cfg.issuer}/oauth/token`,
    jwks_uri: `${cfg.issuer}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    scopes_supported: ALL_SCOPES,
  };
  const prm = {
    resource: cfg.resource,
    authorization_servers: [cfg.issuer],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "THREAD",
  };
  app.get("/.well-known/oauth-authorization-server", (c) => c.json(asMeta));
  app.get("/.well-known/oauth-protected-resource", (c) => c.json(prm));
  app.get("/.well-known/oauth-protected-resource/mcp", (c) => c.json(prm)); // RFC 9728 path-suffixed form
  app.get("/oauth/jwks", (c) => c.json({ keys: [{ ...cfg.keys.publicJwk, kid: cfg.keys.kid, alg: "ES256", use: "sig" }] }));

  // ---- /oauth/authorize (GET shows the persona picker; POST issues the code) ----
  const checkAuthorize = (q: Record<string, string | undefined>) => {
    const client = cfg.clients.find((x) => x.client_id === q["client_id"]);
    if (!client || !client.grants.includes("authorization_code")) return { err: "unknown client" };
    if (!q["redirect_uri"] || !client.redirect_uris.includes(q["redirect_uri"])) return { err: "redirect_uri not registered" };
    const fail = (error: string, desc: string) => ({ redirect: withQuery(q["redirect_uri"]!, { error, error_description: desc, state: q["state"] }) });
    if (q["response_type"] !== "code") return fail("unsupported_response_type", "response_type must be code");
    if (q["code_challenge_method"] !== "S256" || !q["code_challenge"] || q["code_challenge"].length !== 43) return fail("invalid_request", "PKCE S256 required");
    if (q["resource"] !== cfg.resource) return fail("invalid_target", "resource must be the MCP server URL");
    const scopes = (q["scope"] ?? "mcp:tools").split(" ").filter(Boolean);
    if (scopes.length === 0 || scopes.some((s) => !TIER2_SCOPES.includes(s))) return fail("invalid_scope", "scope must be mcp:tools and/or mcp:resources");
    return { client, scopes };
  };
  const issueCode = async (q: Record<string, string | undefined>, scopes: string[], person: string) =>
    withQuery(q["redirect_uri"]!, {
      code: await sign(cfg, { typ: "code", sub: person, cid: q["client_id"], ru: q["redirect_uri"], cc: q["code_challenge"], scope: scopes.join(" ") }, CODE_TTL),
      state: q["state"],
    });

  app.get("/oauth/authorize", async (c) => {
    const q = c.req.query();
    const r = checkAuthorize(q);
    if ("err" in r) return c.text(`Invalid authorization request: ${r.err}`, 400);
    if ("redirect" in r) return c.redirect(r.redirect!, 302);
    const hint = q["login_hint"];
    if (cfg.autoConsent && hint && cfg.persons.some((p) => p.id === hint)) return c.redirect(await issueCode(q, r.scopes, hint), 302);
    const hidden = Object.entries(q).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v ?? "")}">`).join("");
    const buttons = cfg.persons.map((p) => `<button name="person" value="${esc(p.id)}">${esc(p.name)}</button>`).join(" ");
    return c.html(`<!doctype html><meta charset="utf-8"><title>Sign in to THREAD</title>
<main style="font:18px system-ui;max-width:28rem;margin:4rem auto"><h1>Sign in to THREAD</h1>
<p>Demo sign-in: choose who you are. THREAD will be able to use its tools on your behalf (${esc(r.scopes.join(", "))}).</p>
<form method="post" action="/oauth/authorize">${hidden}${buttons}</form></main>`);
  });
  app.post("/oauth/authorize", async (c) => {
    const form = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([k, v]) => [k, String(v)]));
    const r = checkAuthorize(form);
    if ("err" in r) return c.text(`Invalid authorization request: ${r.err}`, 400);
    if ("redirect" in r) return c.redirect(r.redirect!, 302);
    if (!cfg.persons.some((p) => p.id === form["person"])) return c.text("Unknown person", 400);
    return c.redirect(await issueCode(form, r.scopes, form["person"]!), 302);
  });

  // ---- /oauth/token ----
  app.post("/oauth/token", async (c) => {
    const body = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([k, v]) => [k, String(v)]));
    const err = (status: 400 | 401, error: string, error_description: string) =>
      c.json({ error, error_description }, status, { "Cache-Control": "no-store" });
    const client = authenticateClient(c, body, cfg.clients);
    if (!client) return err(401, "invalid_client", "client authentication failed");
    const grant = body["grant_type"];
    if (!grant || !client.grants.includes(grant as OAuthClient["grants"][number])) return err(400, "unauthorized_client", "grant not allowed for this client");
    if (body["resource"] !== cfg.resource) return err(400, "invalid_target", "resource must be the MCP server URL");

    if (grant === "client_credentials") {
      const scope = body["scope"] ?? "mcp:service";
      if (scope !== "mcp:service") return err(400, "invalid_scope", "client_credentials only grants mcp:service");
      return tokenResponse(c, { access_token: await sign(cfg, { typ: "at", sub: `client:${client.client_id}`, scope, aud: cfg.resource }, ACCESS_TTL), scope });
    }
    if (grant === "authorization_code") {
      const code = await verify(cfg, body["code"], "code");
      if (!code || code["cid"] !== client.client_id || code["ru"] !== body["redirect_uri"]) return err(400, "invalid_grant", "invalid or expired code");
      const verifier = body["code_verifier"] ?? "";
      if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier) || b64sha256(verifier) !== code["cc"]) return err(400, "invalid_grant", "PKCE verification failed");
      return tokenResponse(c, await issuePair(cfg, String(code.sub), String(code["scope"]), client.client_id));
    }
    if (grant === "refresh_token") {
      const rt = await verify(cfg, body["refresh_token"], "rt");
      if (!rt || rt["cid"] !== client.client_id) return err(400, "invalid_grant", "invalid or expired refresh token");
      return tokenResponse(c, await issuePair(cfg, String(rt.sub), String(rt["scope"]), client.client_id));
    }
    return err(400, "unsupported_grant_type", "unsupported grant_type");
  });
}

/** Resource-server side: Bearer JWT -> principal. Tier 1 (mcp:service) -> service principal; Tier 2 -> person principal. */
export function jwtResolver(cfg: OAuthConfig) {
  return async (authorization: string | undefined): Promise<Principal | undefined> => {
    const token = /^Bearer (\S+)$/.exec(authorization ?? "")?.[1];
    const p = await verify(cfg, token, "at");
    if (!p || p.aud !== cfg.resource) return undefined;
    const scopes = String(p["scope"] ?? "").split(" ");
    if (scopes.includes("mcp:service")) return { kind: "service", scopes };
    if (!cfg.persons.some((x) => x.id === p.sub)) return undefined;
    return { kind: "person", household_id: cfg.householdId, person_id: String(p.sub), scopes };
  };
}

// ---------- helpers ----------
async function sign(cfg: OAuthConfig, claims: Record<string, unknown>, ttl: number): Promise<string> {
  const { sub, aud, ...rest } = claims as { sub: string; aud?: string };
  const jwt = new SignJWT(rest).setProtectedHeader({ alg: "ES256", kid: cfg.keys.kid }).setIssuer(cfg.issuer).setSubject(sub)
    .setIssuedAt().setExpirationTime(`${ttl}s`);
  if (aud) jwt.setAudience(aud);
  return jwt.sign(cfg.keys.privateKey);
}
async function verify(cfg: OAuthConfig, token: string | undefined, typ: string) {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, cfg.keys.publicJwk, { issuer: cfg.issuer, algorithms: ["ES256"] });
    return payload["typ"] === typ ? payload : undefined; // a code or refresh token can never be used as an access token
  } catch {
    return undefined;
  }
}
async function issuePair(cfg: OAuthConfig, person: string, scope: string, clientId: string) {
  return {
    access_token: await sign(cfg, { typ: "at", sub: person, scope, aud: cfg.resource }, ACCESS_TTL),
    refresh_token: await sign(cfg, { typ: "rt", sub: person, scope, cid: clientId }, REFRESH_TTL),
    scope,
  };
}
function tokenResponse(c: Context, t: { access_token: string; refresh_token?: string; scope: string }) {
  return c.json({ token_type: "Bearer", expires_in: ACCESS_TTL, ...t }, 200, { "Cache-Control": "no-store", Pragma: "no-cache" });
}
function authenticateClient(c: Context, body: Record<string, string>, clients: OAuthClient[]): OAuthClient | undefined {
  let id = body["client_id"];
  let secret = body["client_secret"];
  const basic = /^Basic (\S+)$/.exec(c.req.header("authorization") ?? "")?.[1];
  if (basic) {
    const [u, s] = Buffer.from(basic, "base64").toString().split(":");
    id = decodeURIComponent(u ?? "");
    secret = decodeURIComponent(s ?? "");
  }
  const client = clients.find((x) => x.client_id === id);
  if (!client) return undefined;
  if (!client.client_secret) return body["grant_type"] === "client_credentials" ? undefined : client; // public clients: PKCE only
  return secret !== undefined && safeEqual(secret, client.client_secret) ? client : undefined;
}
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const b64sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
function withQuery(url: string, q: Record<string, string | undefined>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(q)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}
