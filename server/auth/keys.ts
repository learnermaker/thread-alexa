// ES256 signing key for the demo authorization server.
// Source order: OAUTH_PRIVATE_JWK env var (JSON; used on AWS) -> <dataDir>/oauth-key.json -> generate and save there.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exportJWK, generateKeyPair, importJWK, type CryptoKey, type JWK } from "jose";

export interface SigningKeys { privateKey: CryptoKey; publicJwk: JWK; kid: string }

export async function loadOrCreateKeys(dataDir: string, envJwk = process.env["OAUTH_PRIVATE_JWK"]): Promise<SigningKeys> {
  const file = join(dataDir, "oauth-key.json");
  let jwk: JWK | undefined = envJwk ? (JSON.parse(envJwk) as JWK) : await readFile(file, "utf8").then((t) => JSON.parse(t) as JWK, () => undefined);
  if (!jwk) {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    jwk = { ...(await exportJWK(privateKey)), kid: `k${Date.now().toString(36)}` };
    await mkdir(dataDir, { recursive: true });
    await writeFile(file, JSON.stringify(jwk)); // .data/ is gitignored
  }
  const { d: _private, ...publicJwk } = jwk;
  return { privateKey: (await importJWK(jwk, "ES256")) as CryptoKey, publicJwk, kid: String(jwk.kid ?? "k1") };
}
