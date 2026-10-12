// Self-check for the simulator's PKCE math: the challenge it sends must be exactly what the
// embedded authorization server computes from the verifier, or sign-in would fail at /oauth/token.
import { describe, expect, it } from "vitest";
import { pkcePair } from "../../web/sim/src/mcp.ts";
import { b64sha256 } from "../auth/oauth.ts";

describe("simulator PKCE", () => {
  it("produces a 43-char verifier whose S256 challenge matches the server's", async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(challenge).toHaveLength(43);
    expect(b64sha256(verifier)).toBe(challenge);
  });
});
