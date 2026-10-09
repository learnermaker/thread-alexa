// npm run verify: the single "is it green?" command (humans, hooks, checkpoints, CI).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const steps = [
  ["contract checksums", "node scripts/check-contract.mjs"],
  ["dependency allowlist", "node scripts/check-deps.mjs"],
  ["secret scan", "node scripts/check-secrets.mjs"],
  ["wording", "node scripts/check-wording.mjs"],
  ["typecheck", "npx tsc --noEmit"],
  ...["web/tsconfig.json", "infra/tsconfig.json"].filter((f) => existsSync(f)).map((f) => [`typecheck ${f}`, `npx tsc -p ${f} --noEmit`]),
  ["tests", "npx vitest run"],
];
for (const [name, cmd] of steps) {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.status !== 0) {
    console.log(`VERIFY FAILED at: ${name}\n$ ${cmd}\n${out.split("\n").slice(-60).join("\n")}`);
    process.exit(1);
  }
  console.log(`ok  ${name}`);
}
console.log("VERIFY PASSED");
