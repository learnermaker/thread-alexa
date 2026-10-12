// Bearer token -> acting principal. Identity always comes from the token, never from tool arguments.
//  - person  (Tier 2 token or dev token): may call tools as that household member
//  - service (Tier 1 token, scope mcp:service): may only initialize / list tools; never touches user data
import type { PersonPrincipal } from "../mcp/server.ts";

export type Principal = (PersonPrincipal & { scopes: string[] }) | { kind: "service"; scopes: string[] };
export type ResolvePrincipal = (authorization: string | undefined) => Promise<Principal | undefined>;

/** DEV only: "Bearer dev-<person>" for the demo household (tests, MCP Inspector). Enabled with AUTH_DEV_TOKENS=true, never on AWS. */
export function devResolver(householdId: string, persons: string[]): ResolvePrincipal {
  return async (authorization) => {
    const m = /^Bearer dev-([a-z][a-z0-9_]*)$/.exec(authorization ?? "");
    return m && persons.includes(m[1]!)
      ? { kind: "person", household_id: householdId, person_id: m[1]!, scopes: ["mcp:tools", "mcp:resources"] }
      : undefined;
  };
}

/** Tries each resolver in order (e.g. JWT first, then dev tokens when enabled). */
export function anyOf(...resolvers: ResolvePrincipal[]): ResolvePrincipal {
  return async (authorization) => {
    for (const r of resolvers) {
      const p = await r(authorization);
      if (p) return p;
    }
    return undefined;
  };
}
