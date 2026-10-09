// Fails if package.json dependencies differ from the approved, pinned list (architect-owned; updated per spec).
import { readFileSync } from "node:fs";

const approved = {
  dependencies: {
    "@hono/node-server": "2.1.4",
    "@modelcontextprotocol/ext-apps": "1.7.5",
    "@modelcontextprotocol/sdk": "1.32.1",
    hono: "4.13.13",
    "thread-core": "https://github.com/learnermaker/thread-core/releases/download/v0.1.0/thread-core-0.1.0.tgz",
    zod: "4.6.5",
  },
  devDependencies: { "@types/node": "24.19.1", typescript: "5.9.3", vitest: "5.0.3" },
};
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];
for (const field of ["dependencies", "devDependencies"]) {
  const want = approved[field];
  const have = pkg[field] ?? {};
  for (const [name, v] of Object.entries(have)) if (want[name] !== v) problems.push(`${field}.${name}@${v} is not approved`);
  for (const [name, v] of Object.entries(want)) if (have[name] !== v) problems.push(`${field}.${name} must be exactly ${v}`);
}
if (problems.length) {
  console.error(`Dependency allowlist violated (new deps need an architect decision):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("deps ok");
