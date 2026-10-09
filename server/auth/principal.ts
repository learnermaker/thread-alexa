// Bearer token -> acting principal. Spec mcp-tools ships the DEV resolver; spec auth adds the JWT resolver.
// Identity always comes from the token, never from tool arguments.
import type { PersonPrincipal } from "../mcp/server.ts";

export type ResolvePrincipal = (authorization: string | undefined) => Promise<PersonPrincipal | undefined>;

/** DEV only: "Bearer dev-<person>" for the demo household. Enabled when AUTH_MODE=dev. */
export function devResolver(householdId: string, persons: string[]): ResolvePrincipal {
  return async (authorization) => {
    const m = /^Bearer dev-([a-z][a-z0-9_]*)$/.exec(authorization ?? "");
    return m && persons.includes(m[1]!) ? { kind: "person", household_id: householdId, person_id: m[1]! } : undefined;
  };
}
